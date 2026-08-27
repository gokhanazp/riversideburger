// Dayanıklı realtime abonelik hook'u (Resilient realtime subscription hook)
//
// Tablet saatlerce açık kaldığında Supabase realtime bağlantısı sessizce ölüyor:
//   • OS uygulamayı arka plana alınca WebSocket'i kapatıyor; JS timer'ları da
//     donduğu için realtime-js'in kendi reconnect timer'ı hiç çalışmıyor.
//   • Wi-Fi kopması / IP değişimi sonrası socket JS tarafında "open" görünüp
//     hiç veri akmıyor (zombi socket).
//   • Access token yenilenmezse realtime sunucusu bağlantıyı düşürüyor.
// Sonuç: ekran açık kalıyor ama yeni siparişler düşmüyor, uygulamayı kapatıp
// açmak gerekiyor. Bu hook üç katmanlı savunma kuruyor:
//   1) subscribe() status callback'i: CHANNEL_ERROR / TIMED_OUT / CLOSED gelirse
//      artan gecikmeyle yeniden abone ol; ısrarlı hatada socket'i tamamen sıfırla.
//   2) Watchdog: kanal 'joined' değilse veya socket kapalıysa zorla yenile.
//   3) Polling: realtime hiç çalışmasa bile veriyi periyodik olarak tazele.
// Ayrıca uygulama ön plana döndüğünde oturumu tazeleyip anında yeniden abone olur.

import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { diag } from '../services/diagnosticsLog';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

/** Yeniden senkronizasyon sebebi — kaçan kayıtları yakalamak için kullanılır */
export type ResyncReason = 'subscribed' | 'reconnect' | 'foreground' | 'poll';

type PostgresEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeTableOptions {
  /** Kanal adı — cihaz içinde tekil olmalı (Channel name, must be unique per device) */
  channel: string;
  table: string;
  event?: PostgresEvent;
  enabled?: boolean;
  /** Realtime event geldiğinde (When a realtime event arrives) */
  onEvent?: (payload: any) => void;
  /**
   * Abonelik kurulduğunda, bağlantı geri geldiğinde, uygulama ön plana
   * döndüğünde ve her polling tikinde çağrılır. Bağlantının koptuğu sürede
   * kaçan kayıtları yakalamak için buradan veri çekilmeli.
   */
  onResync?: (reason: ResyncReason) => void | Promise<void> | Promise<boolean>;
  /** Realtime tamamen ölse bile çalışan güvenlik ağı (ms). 0 = kapalı */
  pollIntervalMs?: number;
  /** Kanal sağlığını kontrol eden watchdog aralığı (ms) */
  watchdogIntervalMs?: number;
}

// Artan bekleme: hızlı toparlanma ama sunucuyu da dövmeyen üst sınır
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];
// getSession() beklemesinin üst sınırı. Supabase auth kilidi süresiz beklediği
// için (acquireTimeout = -1), asılı bir token yenilemesi bu çağrıyı sonsuza
// kadar bloklayabiliyor. Öyle olursa aboneliği token doğrulamadan kurmayı
// deniyoruz — çalışmazsa status callback'i zaten yeniden denemeyi tetikler.
// Bu sınır olmadan `subscribing` bayrağı asılı kalıp watchdog'u da öldürüyordu.
const SESSION_WAIT_MS = 10000;
// Bu süre boyunca hiç başarılı veri gelmediyse (ne realtime event, ne polling)
// arıza sebebini teşhis etmeye çalışmadan zorla toparlanıyoruz. Sebep odaklı
// kontroller (socket açık mı, kanal joined mı, appState ne) yanlış olabiliyor;
// "veri bayat" ölçütü arıza türünden bağımsız ve yanılmıyor.
const STALE_LIMIT_MS = 90000;
// Socket TÜM kanallar arasında paylaşılıyor: supabase.realtime.disconnect()
// çağıran hook yalnızca kendi kanalını değil, diğer hook'un kanalını da
// düşürüyor. İki hook (sipariş listesi + global bildirimci) aynı tabloyu
// dinlediği için birbirlerinin yeni kurduğu socket'i sırayla kapatıp
// bağlantının hiç oturmadığı bir salınım üretebiliyorlar. Bu yüzden zorla
// sıfırlama modül düzeyinde kısıtlanıyor: tüm örnekler için tek pencere.
let lastGlobalHardResetAt = 0;

export function useRealtimeTable({
  channel: channelName,
  table,
  event = '*',
  enabled = true,
  onEvent,
  onResync,
  pollIntervalMs = 30000,
  watchdogIntervalMs = 15000,
}: UseRealtimeTableOptions): { status: RealtimeStatus; isStale: boolean } {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  // Kanal 'SUBSCRIBED' olsa bile veri akmıyor olabilir: WebSocket mevcut
  // bağlantı üzerinden nabızla ayakta kalırken, her HTTP sorgusu YENİ bağlantı
  // istiyor ve cihazın ağ yığını bozulduysa asılı kalıyor. O durumda gösterge
  // 'Canlı' derken liste hiç güncellenmiyordu — yani gösterge yalan söylüyordu.
  // Artık tazelik ölçütü socket durumu değil, GERÇEKTEN veri gelip gelmediği.
  const [isStale, setIsStale] = useState(false);

  // Callback'leri ref'te tut: parent her render'da yeni fonksiyon üretse bile
  // aboneliği baştan kurmayalım (Keep callbacks in refs to avoid resubscribing)
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  onEventRef.current = onEvent;
  onResyncRef.current = onResync;

  useEffect(() => {
    if (!enabled) {
      setStatus('offline');
      return;
    }

    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // Her subscribe() çağrısına bir nesil numarası ver: eski kanalın geç gelen
    // 'CLOSED' callback'i yeni aboneliği bozmasın
    let generation = 0;
    let subscribing = false;
    let appState: AppStateStatus = AppState.currentState;
    // Son kez ne zaman GERÇEKTEN veri aldık (realtime event veya başarılı fetch)
    let lastOkAt = Date.now();
    let lastHardResetAt = 0;
    // Watchdog nabzını her tikte değil, dakikada bir kaydet. Amaç
    // zamanlayıcının yaşadığını kanıtlamak; her 15 sn'de bir satır tamponu
    // gereksiz doldurup donma anını taşırıyordu. Bir şey ANORMALSE (bayatlama
    // başladı, socket kapalı, kanal joined değil) tik atlanmaz.
    let watchdogTick = 0;

    const markOk = () => {
      lastOkAt = Date.now();
      setIsStale(false);
    };

    // onResync'i çağır ve başarıyla tamamlanırsa "veri geldi" olarak işaretle
    const resync = (reason: ResyncReason) => {
      try {
        const maybePromise = onResyncRef.current?.(reason);
        if (maybePromise && typeof (maybePromise as any).then === 'function') {
          // false dönerse BAŞARISIZ sayılır. Bu şart: fetch fonksiyonları hatayı
          // kendi içinde yakalayıp sessizce dönüyor; her çağrıyı başarı saysak
          // bayat-veri kontrolü hiç tetiklenmez ve tek kurtarma yolumuz ölür.
          (maybePromise as Promise<any>)
            .then((ok) => {
              // YALNIZCA açıkça true tazelik damgalar. Eskiden `ok !== false`
              // yeterliydi ve undefined dönen (yani hiç veri çekmeyen) bir
              // callback veriyi taze gösteriyordu. catchUp yeniden-giriş
              // korumasında olduğu gibi "şu an atlıyorum" durumları da böylece
              // yanlışlıkla başarı sayılıyordu — tek kurtarma mekanizmamız kör
              // kalıyordu. Her iki çağıran da boolean döndürüyor.
              if (ok === true) markOk();
              else log(`resync(${reason}) veri tazelemedi (dönüş=${String(ok)})`);
            })
            .catch((e) => log(`resync(${reason}) hata: ${String(e?.message || e).slice(0, 60)}`));
        }
        // DİKKAT: burada eskiden markOk() vardı. Callback senkron olarak
        // undefined döndüğünde (yani hiç veri çekmediğinde) bile veriyi "taze"
        // damgalıyordu. Sonuç: yeniden abone olunca gösterge yeşile dönüyor,
        // uyarı şeridi çıkmıyor, ama liste hiç güncellenmiyordu — arıza tamamen
        // görünmez oluyordu. Artık tazelik yalnızca GERÇEKTEN veri geldiğinde
        // yenilenir: promise başarıyla çözülürse ya da realtime event gelirse.
      } catch {
        // onResync hatası kurtarma döngüsünü bozmasın
        log(`resync(${reason}) senkron hata`);
      }
    };

    const log = (msg: string) => diag(`rt:${channelName}`, msg);

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleResubscribe = (reason: string) => {
      if (disposed || retryTimer || subscribing) return;
      setStatus('offline');

      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      log(`${reason} → ${delay}ms sonra yeniden abone olunacak (deneme ${attempt})`);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        subscribe();
      }, delay);
    };

    const subscribe = async () => {
      if (disposed || subscribing) return;
      subscribing = true;
      clearRetry();

      try {
        await subscribeInner();
      } finally {
        // Ne olursa olsun bayrağı indir. Aksi halde tek bir asılı çağrı
        // watchdog'u ve yeniden abone olmayı kalıcı olarak devre dışı bırakıyor.
        subscribing = false;
      }
    };

    const subscribeInner = async () => {
      const myGen = ++generation;

      // Oturumu doğrula — token'ın süresi geçmişse burada yenilenir. Aksi halde
      // realtime sunucusu bizi anon rolde bırakıp orders RLS'inde tüm event'leri eler.
      // Süre sınırı şart: auth kilidi tıkanmışsa bu çağrı asla dönmeyebiliyor.
      try {
        await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS)),
        ]);
      } catch {
        // Ağ yoksa yine de dene; hata subscribe status'ünden yakalanır
      }
      if (disposed || myGen !== generation) return;

      // Her denemede topic'e yeni bir nesil eki ver. supabase.channel() aynı
      // isimde bir kanal varsa YENİ kanal üretmeyip mevcut (ölmüş) kanalı geri
      // veriyor; o kanal 'errored' durumdaysa subscribe() hiç join etmiyor ve
      // abonelik sessizce ölü kalıyor. Tekil isim bu tuzağı tamamen atlatıyor.
      const previous = channel;
      const nextChannel = supabase.channel(`${channelName}#${myGen}`);
      channel = nextChannel;
      // Eski kanalı yeni kanal listeye eklendikten SONRA kaldır: aksi halde
      // kanal sayısı sıfıra düşüyor ve removeChannel socket'i tamamen kapatıyor.
      if (previous) supabase.removeChannel(previous);

      // event tipi burada union olduğu için realtime-js'in literal overload'ları
      // eşleşmiyor; filtre nesnesini cast ediyoruz.
      nextChannel.on('postgres_changes', { event, schema: 'public', table } as any, (payload: any) => {
        if (disposed) return;
        markOk();
        onEventRef.current?.(payload);
      });

      // Bayrağı subscribe()'tan ÖNCE indir: status callback'i senkron gelirse
      // scheduleResubscribe "abone olunuyor" diye atlanmasın.
      subscribing = false;

      nextChannel.subscribe((subStatus) => {
        // Eski nesle ait callback'leri yok say
        if (disposed || myGen !== generation) return;
        log(`status: ${subStatus}`);

        if (subStatus === 'SUBSCRIBED') {
          const wasRecovering = attempt > 0;
          attempt = 0;
          setStatus('live');
          // Bağlantının kapalı olduğu sürede kaçan kayıtları yakala
          resync(wasRecovering ? 'reconnect' : 'subscribed');
        } else if (
          subStatus === 'CHANNEL_ERROR' ||
          subStatus === 'TIMED_OUT' ||
          subStatus === 'CLOSED'
        ) {
          scheduleResubscribe(subStatus);
        }
      });
    };

    subscribe();

    // 2) Watchdog — kanal/socket sağlığını ve verinin tazeliğini kontrol et
    //
    // DİKKAT: burada eskiden `appState !== 'active'` kapısı vardı ve bu bir
    // hataydı. appState yalnızca AppState 'change' olayıyla güncellenen bir
    // closure değişkeni; bir kez 'active' dışında bir değerde takılırsa watchdog
    // ve polling KALICI olarak devre dışı kalıyor, realtime de ölürse hiçbir şey
    // toparlamıyordu. Admin tabletinde her siparişte push bildirimi geldiği ve
    // bildirim başlığı uygulamayı geçici olarak 'inactive' yaptığı için bu
    // senaryo çok olası. Arka planda çalışmasının maliyeti bir sorgu; sessizce
    // ölmesinin maliyeti kaçan sipariş.
    const watchdog = setInterval(() => {
      if (disposed) return;
      const staleForNow = Date.now() - lastOkAt;
      // Bayatlık bilgisi yeniden abonelik sürerken de güncellenmeli
      setIsStale(staleForNow > STALE_LIMIT_MS);
      // Watchdog'un HER tiki kaydedilir. Amaç yalnızca arızayı değil,
      // zamanlayıcının çalışıp çalışmadığını da kanıtlamak: kayıtta 15 sn'lik
      // aralıklar kesiliyorsa sorun bağlantıda değil, JS zamanlayıcısındadır.
      let socketUp: boolean | string;
      try {
        socketUp = supabase.realtime.isConnected();
      } catch (e) {
        socketUp = `hata:${String((e as any)?.message || e).slice(0, 30)}`;
      }
      watchdogTick += 1;
      const abnormal =
        socketUp !== true ||
        channel?.state !== 'joined' ||
        staleForNow > STALE_LIMIT_MS / 2 ||
        subscribing ||
        !!retryTimer;
      const everyMinute =
        watchdogTick % Math.max(1, Math.round(60000 / watchdogIntervalMs)) === 0;
      if (abnormal || everyMinute) {
        log(
          `nabız bayat=${Math.round(staleForNow / 1000)}sn socket=${socketUp} kanal=${channel?.state ?? 'yok'} appState=${appState} abone=${subscribing} bekleyen=${!!retryTimer}`
        );
      }
      if (subscribing || retryTimer) return;

      // Sebep ne olursa olsun uzun süre veri gelmediyse zorla toparlan.
      // Son çare olduğu için nadir: en fazla STALE_LIMIT_MS'de bir.
      const staleFor = staleForNow;
      if (
        staleFor > STALE_LIMIT_MS &&
        Date.now() - lastHardResetAt > STALE_LIMIT_MS &&
        // Diğer hook örneği az önce socket'i sıfırladıysa bekle: yeni socket'i
        // hemen tekrar kapatmak bağlantının hiç oturmamasına yol açıyor.
        Date.now() - lastGlobalHardResetAt > STALE_LIMIT_MS / 2
      ) {
        lastHardResetAt = Date.now();
        lastGlobalHardResetAt = Date.now();
        log(`${Math.round(staleFor / 1000)}sn veri yok → zorla toparlanma`);
        setStatus('offline');
        attempt = 0;
        clearRetry();
        try {
          // Socket zombi olabilir: JS tarafında açık görünüp veri akmıyor olabilir.
          // Tamamen kapat, yeni abonelik sıfırdan bağlansın.
          supabase.realtime.disconnect();
        } catch {
          // zaten kapalıysa sorun değil
        }
        resync('poll');
        // subscribe()'i DOĞRUDAN çağırmıyoruz: disconnect() socket'i
        // 'disconnecting' durumuna alıyor ve o durumda connect() erken dönüyor,
        // yani yeni kanal hiç bağlanmazdı. scheduleResubscribe en az 1 sn
        // beklediği için kapanma tamamlanıyor.
        scheduleResubscribe('stale-hard-reset');
        return;
      }

      // socketUp yukarıda try/catch ile hesaplandı; burada tekrar çağırmıyoruz.
      // isConnected() bazı ara durumlarda throw edebiliyor ve o hata doğrudan
      // setInterval callback'inden çıkarsa watchdog'un o turu hiç tamamlanmıyor.
      // Hata durumunu "bağlı değil" sayıyoruz: yanlış alarmın maliyeti bir
      // yeniden bağlanma, sessiz kalmanın maliyeti kaçan sipariş.
      if (socketUp !== true) {
        log('socket kapalı görünüyor → yeniden bağlanılıyor');
        // realtime-js'in kendi reconnect timer'ı arka planda donmuş olabilir;
        // socket'i elle ayağa kaldır, aboneliği de yeniden kur.
        try {
          supabase.realtime.connect();
        } catch {
          // connect zaten devam ediyorsa hata verebilir — yut
        }
        scheduleResubscribe('socket-closed');
        return;
      }
      const channelState = channel?.state;
      if (channelState !== 'joined') {
        scheduleResubscribe(`watchdog(state=${channelState ?? 'yok'})`);
      }
    }, watchdogIntervalMs);

    // 3) Polling güvenlik ağı — realtime hiç çalışmasa bile ekran taze kalsın
    const poller =
      pollIntervalMs > 0
        ? setInterval(() => {
            if (disposed) return;
            log('polling tiki');
            resync('poll');
          }, pollIntervalMs)
        : null;

    // Uygulama ön plana döndüğünde: oturumu + aboneliği anında yenile
    const appStateSub = AppState.addEventListener('change', (next) => {
      const cameBack = appState !== 'active' && next === 'active';
      log(`appState ${appState} → ${next}`);
      appState = next;
      if (!cameBack || disposed) return;

      log('uygulama ön plana döndü → bağlantı yenileniyor');
      attempt = 0;
      clearRetry();
      // Arka planda kaçan kayıtları hemen çek; abonelik paralelde kurulur
      resync('foreground');
      subscribe();
    });

    return () => {
      disposed = true;
      generation += 1;
      clearRetry();
      clearInterval(watchdog);
      if (poller) clearInterval(poller);
      appStateSub.remove();
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, channelName, table, event, pollIntervalMs, watchdogIntervalMs]);

  return { status, isStale };
}
