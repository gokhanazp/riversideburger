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
  onResync?: (reason: ResyncReason) => void;
  /** Realtime tamamen ölse bile çalışan güvenlik ağı (ms). 0 = kapalı */
  pollIntervalMs?: number;
  /** Kanal sağlığını kontrol eden watchdog aralığı (ms) */
  watchdogIntervalMs?: number;
}

// Artan bekleme: hızlı toparlanma ama sunucuyu da dövmeyen üst sınır
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];

export function useRealtimeTable({
  channel: channelName,
  table,
  event = '*',
  enabled = true,
  onEvent,
  onResync,
  pollIntervalMs = 30000,
  watchdogIntervalMs = 15000,
}: UseRealtimeTableOptions): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

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

    const log = (msg: string) => console.log(`[realtime:${channelName}] ${msg}`);

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

      const myGen = ++generation;

      // Oturumu doğrula — token'ın süresi geçmişse burada yenilenir. Aksi halde
      // realtime sunucusu bizi anon rolde bırakıp orders RLS'inde tüm event'leri eler.
      try {
        await supabase.auth.getSession();
      } catch {
        // Ağ yoksa yine de dene; hata subscribe status'ünden yakalanır
      }
      if (disposed || myGen !== generation) {
        subscribing = false;
        return;
      }

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
          onResyncRef.current?.(wasRecovering ? 'reconnect' : 'subscribed');
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

    // 2) Watchdog — kanal/socket sağlığını periyodik kontrol et
    const watchdog = setInterval(() => {
      if (disposed || appState !== 'active' || subscribing || retryTimer) return;

      if (!supabase.realtime.isConnected()) {
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
            if (disposed || appState !== 'active') return;
            onResyncRef.current?.('poll');
          }, pollIntervalMs)
        : null;

    // Uygulama ön plana döndüğünde: oturumu + aboneliği anında yenile
    const appStateSub = AppState.addEventListener('change', (next) => {
      const cameBack = appState !== 'active' && next === 'active';
      appState = next;
      if (!cameBack || disposed) return;

      log('uygulama ön plana döndü → bağlantı yenileniyor');
      attempt = 0;
      clearRetry();
      // Arka planda kaçan kayıtları hemen çek; abonelik paralelde kurulur
      onResyncRef.current?.('foreground');
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

  return { status };
}
