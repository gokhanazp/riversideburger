// Global admin sipariş bildirimcisi (Global admin new-order notifier)
// Admin giriş yaptığında — hangi ekranda olursa olsun — yeni sipariş geldiğinde
// ses çalar ve toast gösterir. Realtime aboneliği AdminOrders ekranından bağımsızdır,
// böylece dashboard/anasayfa gibi başka ekranlarda da bildirim düşer.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../services/currencyService';
import { sendLocalNotification, playAdminOrderSound, initAdminOrderSound } from '../services/notificationService';
import { navigationRef } from '../navigation/navigationRef';

export function useAdminOrderNotifier() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;

    // Web'de ses için autoplay kilidini kullanıcı jestiyle aç
    initAdminOrderSound();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const handleNewOrder = async (payload: any) => {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, user:users(email, full_name, phone)')
        .eq('id', payload.new.id)
        .single();

      if (!orderData) return;

      const customerName = (orderData as any).user?.full_name || 'Müşteri';
      const priceText = formatPrice(orderData.total_amount);

      if (Platform.OS === 'web') {
        playAdminOrderSound();
      } else {
        await sendLocalNotification(
          '🔔 YENİ SİPARİŞ!',
          `${customerName} - ${priceText}`,
          { orderId: orderData.id, type: 'new_order_admin' },
          'admin_orders',
          Notifications.AndroidNotificationPriority.MAX,
          'order_sound.mp3'
        );
      }

      Toast.show({
        type: 'success',
        text1: '🔔 Yeni Sipariş!',
        text2: `${customerName} - ${priceText}`,
        visibilityTime: 5000,
        onPress: () => {
          // Toast'a tıklanınca sipariş listesine git
          if (navigationRef.isReady()) {
            navigationRef.navigate('AdminOrders' as never);
          }
          Toast.hide();
        },
      });
    };

    (async () => {
      // Realtime socket'ini admin JWT'siyle authenticate et; aksi halde orders RLS
      // INSERT event'lerini anon rolde eleyip web'e hiç düşürmez.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel('global-admin-new-orders')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          handleNewOrder
        )
        .subscribe((status) => {
          console.log('[global-admin-orders realtime] status:', status);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAdmin]);
}
