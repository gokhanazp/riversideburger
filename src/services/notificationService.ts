// Notification Service - Bildirim yönetimi için servis
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { markOrderAlerted } from './orderAlertRegistry';

// ── Web'de admin sipariş sesi (Web admin order alert sound) ──
// Native'de ses bildirim üzerinden çalar. Web'de tarayıcı autoplay politikası
// HTMLAudioElement'i sık engellediği için Web Audio API kullanılır: context bir
// kullanıcı jestiyle "resume" edilir, mp3 buffer'a decode edilir, event geldiğinde
// buffer çalınır. mp3 yüklenemezse kısa bir beep'e düşülür.
// DOM tipleri RN TS projesinde tanımlı olmadığı için `any` kullanılır.
let webAudioCtx: any = null;
let webOrderBuffer: any = null;

async function loadWebOrderBuffer(): Promise<void> {
  if (webOrderBuffer || !webAudioCtx) return;
  try {
    const asset = Asset.fromModule(require('../../assets/order_sound.mp3'));
    const res = await fetch(asset.uri);
    const arr = await res.arrayBuffer();
    webOrderBuffer = await webAudioCtx.decodeAudioData(arr);
  } catch (e) {
    console.warn('⚠️ Sipariş sesi yüklenemedi, beep fallback kullanılacak:', e);
  }
}

/**
 * Web'de ses için AudioContext'i kullanıcı jestiyle hazırlar (autoplay kilidini açar).
 * AdminOrders mount olduğunda bir kez çağrılmalı.
 */
export function initAdminOrderSound(): void {
  if (Platform.OS !== 'web') return;
  const g: any = globalThis;
  if (g.__adminOrderSoundInit) return;
  g.__adminOrderSoundInit = true;

  const AudioCtxCtor = g.AudioContext || g.webkitAudioContext;
  if (!AudioCtxCtor) return;

  const unlock = () => {
    try {
      if (!webAudioCtx) webAudioCtx = new AudioCtxCtor();
      if (webAudioCtx.state === 'suspended') webAudioCtx.resume();
      loadWebOrderBuffer();
    } catch (e) {
      console.warn('⚠️ Ses kilidi açılamadı:', e);
    }
  };

  const doc: any = g.document;
  if (doc?.addEventListener) {
    ['pointerdown', 'keydown', 'touchstart'].forEach((evt) =>
      doc.addEventListener(evt, unlock, { once: true })
    );
  }
  unlock(); // Belki zaten etkileşim olmuştur; hemen de dene
}

// Sesin art arda kaç kez çalacağı ve tekrarlar arası boşluk (sn)
const ORDER_SOUND_REPEAT = 2;
const ORDER_SOUND_GAP = 0.15;

function playWebBeep(ctx: any, when: number): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.4, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.6);
  } catch { /* yoksay */ }
}

/**
 * Admin paneli açıkken yeni sipariş sesi çalar (art arda ORDER_SOUND_REPEAT kez).
 * Web: Web Audio API (order_sound.mp3, yoksa beep). Native: no-op (bildirim sesi çalar).
 */
export async function playAdminOrderSound(): Promise<void> {
  if (Platform.OS !== 'web') return; // Native'de bildirim sesi devrede
  const g: any = globalThis;
  try {
    const AudioCtxCtor = g.AudioContext || g.webkitAudioContext;
    if (!AudioCtxCtor) return;
    if (!webAudioCtx) webAudioCtx = new AudioCtxCtor();
    if (webAudioCtx.state === 'suspended') await webAudioCtx.resume();

    if (!webOrderBuffer) await loadWebOrderBuffer();

    if (webOrderBuffer) {
      // Tekrarları AudioContext saatiyle art arda zamanla (kesin ve üst üste binmez)
      const dur = webOrderBuffer.duration || 0.5;
      for (let i = 0; i < ORDER_SOUND_REPEAT; i++) {
        const src = webAudioCtx.createBufferSource();
        src.buffer = webOrderBuffer;
        src.connect(webAudioCtx.destination);
        src.start(webAudioCtx.currentTime + i * (dur + ORDER_SOUND_GAP));
      }
    } else {
      for (let i = 0; i < ORDER_SOUND_REPEAT; i++) {
        playWebBeep(webAudioCtx, webAudioCtx.currentTime + i * (0.6 + ORDER_SOUND_GAP)); // mp3 yoksa beep
      }
    }
  } catch (error) {
    console.warn('⚠️ Web sipariş sesi çalınamadı (autoplay politikası olabilir):', error);
  }
}

// Web'de notification handler'ı ayarlama (Don't set notification handler on web)
if (Platform.OS !== 'web') {
  // Bildirim davranışını ayarla (Notification behavior configuration)
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Admin sipariş bildirimleri için özel ayarlar
      // (Special settings for admin order notifications)
      const data = notification.request.content.data as any;
      const isAdminOrder = data?.type === 'new_order_admin';

      // Aynı sipariş için hem uygulama içi yerel bildirim hem de sunucudan gelen
      // push düşebiliyor (ikisi bilerek var: biri anında, diğeri uygulama
      // kapalıyken çalışıyor). Ön planda ikisi çakışırsa admin çift ses duymasın —
      // ilk gelen gösterilir, aynı orderId ile gelen ikincisi sessizce yutulur.
      if (isAdminOrder && typeof data?.orderId === 'string') {
        const isFirstAlert = markOrderAlerted(data.orderId);
        if (!isFirstAlert) {
          console.log('🔇 Bu sipariş için zaten uyarı verildi, kopyası yutuldu:', data.orderId);
          return {
            shouldShowAlert: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            priority: Notifications.AndroidNotificationPriority.LOW,
          };
        }
      }

      return {
        shouldShowAlert: true, // Eski API (deprecated ama geriye dönük uyumluluk)
        shouldShowBanner: true, // Ön planda banner göster (SDK 54+)
        shouldShowList: true, // Bildirim merkezine ekle (SDK 54+)
        shouldPlaySound: true, // Ses çal (Play sound)
        shouldSetBadge: true, // Badge göster (Show badge)
        // iOS için kritik bildirim (Critical notification for iOS)
        priority: isAdminOrder ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });
}

/**
 * Push notification izni iste ve token al
 * Request push notification permission and get token
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Web'de çalışmaz (Not supported on web)
  if (Platform.OS === 'web') {
    console.log('Push notifications web\'de desteklenmiyor');
    return undefined;
  }

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
      // iOS için tüm izinleri iste (Request all permissions for iOS)
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: false, // Kritik uyarılar için özel izin gerekir (Requires special entitlement)
        },
      });
      finalStatus = status;
    }

    // İzin verilmediyse çık (Exit if permission not granted)
    if (finalStatus !== 'granted') {
      console.log('❌ Bildirim izni verilmedi');
      return undefined;
    }

    console.log('✅ Bildirim izni verildi');

    // Push token al (Get push token)
    // Expo Go'da projectId olmayabilir, bu durumda yerel bildirimler çalışır
    // (In Expo Go, projectId might not exist, but local notifications still work)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.log('⚠️ Push token alınamadı (Expo Go - projectId yok). Yerel bildirimler çalışacak.');
      return undefined;
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    console.log('✅ Push token:', token);
  } catch (error: any) {
    // ÖNEMLİ: burada eskiden her hata "Expo Go modunda normal" diye yutuluyordu.
    // Bu yüzden gerçek bir sorun (Android'de Firebase/FCM yapılandırmasının
    // eksikliği) hiç fark edilmedi: production build'de de aynı zararsız mesaj
    // basıldığı için hiçbir Android cihazı token kaydetmemesine rağmen kimse
    // görmedi. Artık gerçek hata ve olası sebebi yazılıyor.
    const message = error?.message || String(error);
    console.warn(`❌ Push token alınamadı (${Platform.OS}): ${message}`);
    if (Platform.OS === 'android') {
      console.warn(
        '   Android push için Firebase/FCM yapılandırması şart: google-services.json ' +
          'app.json içinde android.googleServicesFile ile tanımlanmalı ve FCM V1 ' +
          'service account anahtarı EAS credentials\'a yüklenmeli. Eksikse token alınamaz.'
      );
    }
    console.warn('   Bu cihaz uygulama kapalıyken bildirim ALMAYACAK; uygulama açıkken yerel bildirim çalışır.');
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

    // Admin sipariş bildirimleri kanalı - Daha yüksek öncelik, uzun titreşim ve özel ses
    // (Admin order notifications channel - Higher priority, longer vibration and custom sound)
    await Notifications.setNotificationChannelAsync('admin_orders', {
      name: 'Admin Sipariş Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500], // Üç kez titreşim (Triple vibration)
      lightColor: '#E63946',
      sound: 'order_sound.mp3', // Özel sipariş sesi — app.json'da bundle edilen dosya adıyla eşleşmeli
      enableLights: true,
      enableVibrate: true,
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
 * iOS'ta uygulama açıkken de bildirim gösterir
 * (Shows notification even when app is open on iOS)
 *
 * @param customSound - Özel ses dosyası (örn: 'order-sound.mp3')
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any,
  channelId: string = 'default',
  priority: Notifications.AndroidNotificationPriority = Notifications.AndroidNotificationPriority.HIGH,
  customSound?: string // Özel ses dosyası (Custom sound file)
) {
  try {
    // iOS için özel ayarlar (Special settings for iOS)
    const iosConfig = Platform.OS === 'ios' ? {
      _displayInForeground: true, // iOS'ta ön planda göster (Show in foreground on iOS)
    } : {};

    // Ses ayarı (Sound configuration)
    // iOS: .mp3 uzantısı olmadan, Android: tam dosya adı ile
    // (iOS: without .mp3 extension, Android: with full filename)
    let soundConfig: string | boolean = true;
    if (customSound) {
      if (Platform.OS === 'ios') {
        // iOS için uzantıyı kaldır (Remove extension for iOS)
        soundConfig = customSound.replace('.mp3', '');
      } else {
        // Android için tam dosya adı (Full filename for Android)
        soundConfig = customSound;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: soundConfig,
        priority: priority,
        vibrate: channelId === 'admin_orders' ? [0, 500, 200, 500, 200, 500] : [0, 250, 250, 250],
        ...iosConfig,
      },
      trigger: null, // Hemen gönder (Send immediately)
    });

    console.log('✅ Yerel bildirim gönderildi:', {
      title,
      body,
      channelId,
      sound: soundConfig,
      platform: Platform.OS
    });
  } catch (error) {
    console.error('❌ Yerel bildirim gönderilemedi:', error);
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
 * Özel kanal, maksimum öncelik ve özel ses ile gönderilir
 * (Sent with special channel, maximum priority and custom sound)
 */
export async function sendNewOrderNotificationToAdmin(orderId: string, customerName: string, total: number) {
  // Para birimi formatla (Format with currency)
  const { formatPrice } = await import('./currencyService');
  const formattedPrice = formatPrice(total);

  await sendLocalNotification(
    '🔔 YENİ SİPARİŞ!',
    `${customerName} - ${formattedPrice}`,
    { orderId, type: 'new_order_admin' },
    'admin_orders', // Özel admin kanalı (Special admin channel)
    Notifications.AndroidNotificationPriority.MAX, // Maksimum öncelik (Maximum priority)
    'order_sound.mp3' // Özel sipariş sesi (Custom order sound)
  );
}

/**
 * Admin: Yeni yorum bildirimi (Admin: New review notification)
 */
export async function sendNewReviewNotificationToAdmin(
  reviewId: string,
  customerName: string,
  productName: string,
  rating: number
) {
  await sendLocalNotification(
    '⭐ Yeni Yorum!',
    `${customerName} - ${productName} (${rating} yıldız)`,
    { reviewId, type: 'new_review_admin' },
    'orders'
  );
}

/**
 * Push token'ı Supabase'e kaydet (Save push token to Supabase)
 */
export async function savePushToken(userId: string, token: string, deviceType: string) {
  try {
    const { error } = await import('../lib/supabase').then((m) =>
      m.supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token: token,
          device_type: deviceType,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'token',
        }
      )
    );

    if (error) {
      console.error('❌ Push token kaydetme hatası:', error);
    } else {
      console.log('✅ Push token kaydedildi:', token);
    }
  } catch (error) {
    console.error('❌ Push token kaydetme hatası:', error);
  }
}

/**
 * Admin kullanıcılarına push notification gönder
 * Send push notification to admin users
 */
export async function sendPushNotificationToAdmins(title: string, body: string, data?: any) {
  try {
    // Supabase'den admin kullanıcılarının push token'larını al
    const { supabase } = await import('../lib/supabase');

    // Admin kullanıcılarını bul
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.log('⚠️ Admin kullanıcı bulunamadı');
      return;
    }

    const adminIds = adminUsers.map((u) => u.id);

    // Admin kullanıcılarının aktif push token'larını al
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', adminIds)
      .eq('is_active', true);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log('⚠️ Admin push token bulunamadı');
      return;
    }

    // Expo Push Notification API'ye istek gönder
    // Admin bildirimleri için özel kanal ve maksimum öncelik
    // (Special channel and maximum priority for admin notifications)
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title: title,
      body: body,
      data: data || {},
      priority: 'high',
      channelId: data?.type === 'new_order_admin' ? 'admin_orders' : 'orders',
      badge: 1, // Badge sayısını artır (Increment badge count)
    }));

    console.log(`📤 ${messages.length} admin'e push notification gönderiliyor...`);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('✅ Push notification gönderildi:', result);

    return result;
  } catch (error) {
    console.error('❌ Push notification gönderme hatası:', error);
  }
}

/**
 * Belirli kullanıcılara push notification gönder
 * Send push notification to specific users by their user IDs
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: any
) {
  try {
    const { supabase } = await import('../lib/supabase');

    // Seçilen kullanıcıların aktif push token'larını al
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log('⚠️ Seçilen kullanıcılar için push token bulunamadı');
      return { sent: 0, total: userIds.length };
    }

    // Expo Push Notification API'ye istek gönder
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high' as const,
      channelId: 'default',
      badge: 1,
    }));

    console.log(`📤 ${messages.length} kullanıcıya push notification gönderiliyor...`);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('✅ Push notification gönderildi:', result);

    return { sent: messages.length, total: userIds.length };
  } catch (error) {
    console.error('❌ Push notification gönderme hatası:', error);
    return { sent: 0, total: userIds.length };
  }
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

