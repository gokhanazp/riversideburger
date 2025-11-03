// Notification Service - Bildirim yönetimi için servis
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Bildirim davranışını ayarla (Notification behavior configuration)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Bildirim göster (Show notification)
    shouldPlaySound: true, // Ses çal (Play sound)
    shouldSetBadge: true, // Badge göster (Show badge)
  }),
});

/**
 * Push notification izni iste ve token al
 * Request push notification permission and get token
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;

  // Fiziksel cihaz kontrolü (Physical device check)
  if (!Device.isDevice) {
    console.log('Push notifications sadece fiziksel cihazlarda çalışır');
    return undefined;
  }

  try {
    // Mevcut izinleri kontrol et (Check existing permissions)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // İzin yoksa iste (Request permission if not granted)
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // İzin verilmediyse çık (Exit if permission not granted)
    if (finalStatus !== 'granted') {
      console.log('Bildirim izni verilmedi');
      return undefined;
    }

    // Push token al (Get push token)
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })
    ).data;

    console.log('Push token:', token);
  } catch (error) {
    console.error('Push notification token alınamadı:', error);
  }

  // Android için bildirim kanalı oluştur (Create notification channel for Android)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E63946',
    });

    // Sipariş bildirimleri kanalı (Order notifications channel)
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Sipariş Bildirimleri',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E63946',
      sound: 'default',
    });

    // Kampanya bildirimleri kanalı (Campaign notifications channel)
    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Kampanya Bildirimleri',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#FF6B35',
      sound: 'default',
    });
  }

  return token;
}

/**
 * Yerel bildirim gönder (Send local notification)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any,
  channelId: string = 'default'
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Hemen gönder (Send immediately)
    });
  } catch (error) {
    console.error('Yerel bildirim gönderilemedi:', error);
  }
}

/**
 * Sipariş durumu bildirimi (Order status notification)
 */
export async function sendOrderStatusNotification(
  orderId: string,
  status: string,
  statusText: string
) {
  const titles: Record<string, string> = {
    pending: '⏳ Sipariş Alındı',
    preparing: '👨‍🍳 Sipariş Hazırlanıyor',
    ready: '✅ Sipariş Hazır',
    delivering: '🚚 Sipariş Yolda',
    delivered: '🎉 Sipariş Teslim Edildi',
    cancelled: '❌ Sipariş İptal Edildi',
  };

  const bodies: Record<string, string> = {
    pending: 'Siparişiniz alındı ve onaylandı.',
    preparing: 'Siparişiniz şu anda hazırlanıyor.',
    ready: 'Siparişiniz hazır ve teslimata çıkmak üzere.',
    delivering: 'Siparişiniz size doğru yola çıktı!',
    delivered: 'Siparişiniz teslim edildi. Afiyet olsun!',
    cancelled: 'Siparişiniz iptal edildi.',
  };

  await sendLocalNotification(
    titles[status] || 'Sipariş Güncellendi',
    bodies[status] || statusText,
    { orderId, status, type: 'order_status' },
    'orders'
  );
}

/**
 * Puan kazanma bildirimi (Points earned notification)
 */
export async function sendPointsEarnedNotification(points: number, orderId: string) {
  await sendLocalNotification(
    '🎁 Puan Kazandınız!',
    `${points} puan kazandınız! Toplam puanlarınızı profilinizden kontrol edebilirsiniz.`,
    { points, orderId, type: 'points_earned' },
    'default'
  );
}

/**
 * Kampanya bildirimi (Promotion notification)
 */
export async function sendPromotionNotification(title: string, message: string, promoId?: string) {
  await sendLocalNotification(
    `🎉 ${title}`,
    message,
    { promoId, type: 'promotion' },
    'promotions'
  );
}

/**
 * Admin: Yeni sipariş bildirimi (Admin: New order notification)
 */
export async function sendNewOrderNotificationToAdmin(orderId: string, customerName: string, total: number) {
  await sendLocalNotification(
    '🔔 Yeni Sipariş!',
    `${customerName} - ₺${total.toFixed(2)}`,
    { orderId, type: 'new_order_admin' },
    'orders'
  );
}

/**
 * Zamanlanmış bildirim gönder (Send scheduled notification)
 */
export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: any
) {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: triggerDate,
    });
    return identifier;
  } catch (error) {
    console.error('Zamanlanmış bildirim oluşturulamadı:', error);
    return null;
  }
}

/**
 * Zamanlanmış bildirimi iptal et (Cancel scheduled notification)
 */
export async function cancelScheduledNotification(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Zamanlanmış bildirim iptal edilemedi:', error);
  }
}

/**
 * Tüm bildirimleri temizle (Clear all notifications)
 */
export async function clearAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Bildirimler temizlenemedi:', error);
  }
}

/**
 * Bildirim badge sayısını ayarla (Set notification badge count)
 */
export async function setBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Badge sayısı ayarlanamadı:', error);
  }
}

/**
 * Bildirim badge sayısını sıfırla (Reset notification badge count)
 */
export async function clearBadgeCount() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Badge sayısı sıfırlanamadı:', error);
  }
}

