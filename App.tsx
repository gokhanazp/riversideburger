import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { toastConfig } from './src/components/ToastConfig';
import { useAuthStore } from './src/store/authStore';
import { registerForPushNotificationsAsync, clearBadgeCount } from './src/services/notificationService';

// Ana uygulama componenti (Main application component)
export default function App() {
  const { initialize, isLoading, user } = useAuthStore();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // Uygulama başladığında auth durumunu kontrol et (Check auth state on app start)
  useEffect(() => {
    initialize();
  }, []);

  // Notification listener'ları kur (Setup notification listeners)
  useEffect(() => {
    if (!user) return;

    // Push notification izni iste ve token al (Request push notification permission and get token)
    registerForPushNotificationsAsync();

    // Bildirim geldiğinde (When notification is received)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Bildirim alındı:', notification);
    });

    // Bildirime tıklandığında (When notification is tapped)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Bildirime tıklandı:', response);
      // Badge sayısını temizle (Clear badge count)
      clearBadgeCount();
    });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
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

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <AppNavigator />
        <StatusBar style="dark" />
        {/* Toast bildirimleri - Riverside Burgers teması (Toast notifications - Riverside Burgers theme) */}
        <Toast config={toastConfig} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
