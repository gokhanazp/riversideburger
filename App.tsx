import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { View, ActivityIndicator, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Stripe sadece native platformlarda yükle (Load Stripe only on native platforms)
// Web'de Stripe paketini hiç yükleme (Don't load Stripe package on web at all)
let StripeProvider: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProvider = stripe.StripeProvider;
  } catch (error) {
    console.warn('Stripe could not be loaded:', error);
  }
}
import './src/i18n'; // i18n'i başlat (Initialize i18n)
import AppNavigator from './src/navigation/AppNavigator';
import { toastConfig } from './src/components/ToastConfig';
import { useAuthStore } from './src/store/authStore';
import {
  registerForPushNotificationsAsync,
  clearBadgeCount,
  savePushToken,
} from './src/services/notificationService';
import { getAppSettings } from './src/services/appSettingsService';
import { loadCurrency } from './src/services/currencyService';
import { loadTaxRate } from './src/services/taxService';
import { navigationRef } from './src/navigation/navigationRef';
import i18n from './src/i18n';

// Stripe Publishable Key (Test Mode)
const STRIPE_PUBLISHABLE_KEY =
  Constants.expoConfig?.extra?.stripePublishableKey ||
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  '';

// Ana uygulama componenti (Main application component)
export default function App() {
  const { initialize, isLoading, user } = useAuthStore();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Uygulama başladığında auth durumunu kontrol et ve admin ayarlarını yükle
  // (Check auth state on app start and load admin settings)
  useEffect(() => {
    const initializeApp = async () => {
      // Auth'u başlat (Initialize auth)
      await initialize();

      // Admin'in seçtiği ülke ayarlarını yükle (Load admin's country settings)
      const settings = await getAppSettings();

      // Dili ayarla (Set language)
      await i18n.changeLanguage(settings.language);

      // Para birimini yükle (Load currency)
      await loadCurrency();

      // Vergi oranını yükle (ayarlardan; okunamazsa Ontario HST %13'e düşer)
      await loadTaxRate();

      console.log('🌍 Uygulama ayarları yüklendi:', settings);
    };
    initializeApp();
  }, []);

  // Notification listener'ları kur (Setup notification listeners)
  useEffect(() => {
    // Web'de notification çalışmaz (Notifications don't work on web)
    if (Platform.OS === 'web') {
      return undefined; // Web'de cleanup yok (No cleanup on web)
    }
    if (!user) return;

    // Push notification izni iste ve token al (Request push notification permission and get token)
    registerForPushNotificationsAsync().then((token) => {
      if (token && user.id) {
        console.log('✅ Push token alındı, kaydediliyor...');
        // Token'ı Supabase'e kaydet (Save token to Supabase)
        const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        savePushToken(user.id, token, deviceType);
      } else {
        console.log('ℹ️ Push token alınamadı (Expo Go modunda normal)');
      }
    });

    // Bildirim geldiğinde (When notification is received)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Bildirim alındı:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
      });
    });

    // Bildirime tıklandığında (When notification is tapped)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('👆 Bildirime tıklandı:', {
        title: response.notification.request.content.title,
        data,
      });
      // Badge sayısını temizle (Clear badge count)
      clearBadgeCount();

      // Yeni sipariş bildirimine dokunan admin'i doğrudan sipariş listesine götür.
      // Tablet uyurken push geldiğinde tek dokunuşla siparişi görebilsin.
      if (
        data?.type === 'new_order_admin' &&
        user.role === 'admin' &&
        navigationRef.isReady()
      ) {
        navigationRef.navigate('AdminOrders' as never);
      }
    });

    // Cleanup - sadece mobilde ve removeNotificationSubscription varsa çalışır
    // (Cleanup - only runs on mobile and if removeNotificationSubscription exists)
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  // Loading ekranı (Loading screen)
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E63946" />
      </View>
    );
  }

  // Web'de Stripe olmadan render et (Render without Stripe on web)
  const appContent = (
    <SafeAreaProvider>
      <PaperProvider>
        <AppNavigator />
        <StatusBar style="dark" />
        {/* Toast bildirimleri - Riverside Burgers teması (Toast notifications - Riverside Burgers theme) */}
        <Toast config={toastConfig} />
      </PaperProvider>
    </SafeAreaProvider>
  );

  // Native platformlarda Stripe ile wrap et (Wrap with Stripe on native platforms)
  if (Platform.OS !== 'web' && StripeProvider) {
    return (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.riversideburgers" // Apple Pay için (For Apple Pay)
      >
        {appContent}
      </StripeProvider>
    );
  }

  // Web'de Stripe olmadan (Without Stripe on web)
  return appContent;
}
