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

// Supabase client oluştur (Create Supabase client)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

