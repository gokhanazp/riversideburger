import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import { toastConfig } from './src/components/ToastConfig';
import { useAuthStore } from './src/store/authStore';

// Ana uygulama componenti (Main application component)
export default function App() {
  const { initialize, isLoading } = useAuthStore();

  // Uygulama başladığında auth durumunu kontrol et (Check auth state on app start)
  useEffect(() => {
    initialize();
  }, []);

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
