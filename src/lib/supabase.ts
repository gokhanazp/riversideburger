import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

// Supabase URL ve Anon Key (Environment variables)
// Production build'de app.json'dan, development'ta .env'den alınır
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  '';

// İsteklere üst sınır koyan fetch (Fetch with a hard timeout)
//
// React Native'in fetch'inde varsayılan timeout YOK. Tablet saatlerce açık
// kalınca (Wi-Fi güç tasarrufu, IP değişimi, uyku/uyanma) TCP bağlantısı yarı
// açık kalabiliyor ve istek sonsuza kadar asılı kalıyor.
//
// Bu tek başına da kötü, ama asıl felaket şu zincirde: token yenileme isteği
// auth kilidinin (processLock) İÇİNDE çalışıyor ve supabase-js kilidi
// acquireTimeout = -1 ile alıyor — yani süresiz bekliyor. Yenileme isteği
// asılı kalırsa kilit hiç bırakılmıyor; ondan sonra getSession() çağıran
// HER ŞEY sonsuza kadar bekliyor. Her PostgREST sorgusu access token için
// getSession() çağırdığı için sonuç: sipariş ekranında aşağı çekip yenileme
// spinner'da takılıyor, hiç hata da vermiyor ve yalnızca uygulamayı kapatıp
// açmak düzeltiyor (kilit bellekte olduğu için restart onu temizliyor).
//
// Çözüm: AbortController ile her isteğe üst sınır. Asılı istek hata verip
// kilidi bırakır, bir sonraki deneme çalışır — uygulama kendini toparlar.
// Amaç hızlı olmayı zorlamak değil, SONSUZ beklemeyi kırmak. Bu yüzden sınır
// normal gecikmenin çok üstünde: restoranın yavaş Wi-Fi'sinde gerçek bir sorguyu
// boşuna kesip kullanıcıya hata göstermek istemiyoruz.
const REQUEST_TIMEOUT_MS = 20000;
// Depolama yüklemeleri (ürün fotoğrafı) yavaş bağlantıda uzun sürebilir;
// onları erken kesmek gerçek bir yüklemeyi bozar.
const UPLOAD_TIMEOUT_MS = 120000;

const timeoutFetch = (input: any, init?: any): Promise<Response> => {
  // Çağıran kendi AbortSignal'ini verdiyse ona karışma
  if (init?.signal) return fetch(input, init);

  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  const limitMs = url.includes('/storage/v1/') ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limitMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

// Supabase client oluştur (Create Supabase client)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: timeoutFetch },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Web'de varsayılan navigator.locks zaman zaman deadlock'a giriyor (Expo Web'de
    // getSession() sonsuza dek asılı kalıyor). In-memory processLock her platformda
    // güvenli, tek-tab SPA için yeterli.
    lock: processLock,
  },
  realtime: {
    // Varsayılan 25sn heartbeat, mobil ağlarda ölü bağlantıyı geç fark ediyor.
    // 15sn'de bir nabız: kopan socket daha çabuk tespit edilip yeniden kurulur.
    // (Her heartbeat aynı zamanda realtime auth token'ını da tazeliyor.)
    heartbeatIntervalMs: 15000,
  },
});

// Token yenilemeyi uygulama yaşam döngüsüne bağla
// (Wire token auto-refresh to the app lifecycle)
//
// React Native'de arka plana düşen uygulamanın JS timer'ları donuyor;
// autoRefreshToken tek başına yetmiyor. Tablet saatlerce açık kalınca access
// token'ın süresi geçiyor, realtime sunucusu bağlantıyı düşürüyor ve yeni
// siparişler ekrana hiç düşmüyor. Supabase'in RN için önerdiği kurulum:
// ön plana dönüşte yenilemeyi başlat, arka plana geçişte durdur.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  // İlk açılışta uygulama zaten ön planda olduğu için listener tetiklenmez
  if (AppState.currentState === 'active') {
    supabase.auth.startAutoRefresh();
  }
}

