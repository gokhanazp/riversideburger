# Admin Sipariş Bildirimleri

> ⚠️ **Güncel akış için [ADMIN_PUSH_SETUP.md](ADMIN_PUSH_SETUP.md)'e bak.**
> Bu belgedeki "Push notification (orderService.ts)" adımı artık geçerli değil:
> push'u müşterinin cihazı gönderiyordu ve RLS yüzünden hiç çalışmıyordu.
> Yerine `orders` INSERT trigger'ı + `notify-admin-new-order` Edge Function'ı
> geldi (sunucu tarafı, uygulama kapalıyken de çalışır). Kurulum, test ve
> sorun giderme adımlarının tamamı o belgede.

## 🔔 Özellikler

Admin kullanıcıları için özel sipariş bildirim sistemi eklendi. Bu sistem, yeni siparişler geldiğinde admin kullanıcılarını anında bilgilendirir.

## ✨ Yeni Özellikler

### 1. Özel Admin Bildirim Kanalı
- **Kanal Adı**: `admin_orders`
- **Öncelik**: MAKSIMUM (MAX)
- **Titreşim**: Üç kez tekrarlayan güçlü titreşim (500ms-200ms-500ms-200ms-500ms)
- **LED Işığı**: Kırmızı (#E63946)
- **Ses**: Varsayılan bildirim sesi

### 2. Geliştirilmiş Bildirim Özellikleri
- ✅ Sesli bildirim (varsayılan sistem sesi)
- ✅ Güçlü ve uzun titreşim
- ✅ Maksimum öncelik (ekranın üstünde görünür)
- ✅ LED ışık desteği (Android)
- ✅ Badge sayısı güncelleme
- ✅ Tam ekran bildirim desteği (Android 12+)

### 3. Platform Desteği
- **Android**: Tam destek (bildirim kanalları, titreşim, LED, ses)
- **iOS**: Push notification desteği, arka plan bildirimleri
- **Web**: Toast bildirimleri (push notification desteklenmez)

## 📱 Bildirim Akışı

### Yeni Sipariş Geldiğinde:

1. **Veritabanı Trigger** (Supabase)
   - Yeni sipariş oluşturulduğunda otomatik tetiklenir
   - Tüm admin kullanıcılarına bildirim kaydı oluşturur

2. **Push Notification** (orderService.ts)
   - Admin kullanıcılarının push token'larını alır
   - Expo Push Notification API'ye istek gönderir
   - Özel `admin_orders` kanalı ile gönderilir

3. **Yerel Bildirim** (AdminOrders.tsx)
   - Realtime subscription ile sipariş dinlenir
   - Yeni sipariş geldiğinde yerel bildirim gönderilir
   - Toast mesajı gösterilir

4. **Bildirim Görüntüleme**
   - Kullanıcı bildirimi görür ve duyar
   - Telefon titreşir (3 kez)
   - LED ışığı yanar (Android)
   - Badge sayısı güncellenir

## 🔧 Teknik Detaylar

### Bildirim Kanalları (Android)

```typescript
// Admin sipariş bildirimleri kanalı
await Notifications.setNotificationChannelAsync('admin_orders', {
  name: 'Admin Sipariş Bildirimleri',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 500, 200, 500, 200, 500],
  lightColor: '#E63946',
  sound: 'default',
  enableLights: true,
  enableVibrate: true,
});
```

### Bildirim Gönderme

```typescript
// Yerel bildirim
await sendLocalNotification(
  '🔔 YENİ SİPARİŞ!',
  `${customerName} - ₺${total.toFixed(2)}`,
  { orderId, type: 'new_order_admin' },
  'admin_orders',
  Notifications.AndroidNotificationPriority.MAX
);

// Push notification
await sendPushNotificationToAdmins(
  '🔔 Yeni Sipariş!',
  `${customerName} - ₺${total.toFixed(2)}`,
  { orderId, orderNumber, type: 'new_order_admin' }
);
```

## 📋 İzinler

### Android (app.json)
```json
"permissions": [
  "INTERNET",
  "ACCESS_NETWORK_STATE",
  "RECEIVE_BOOT_COMPLETED",
  "VIBRATE",
  "POST_NOTIFICATIONS",
  "USE_FULL_SCREEN_INTENT"
]
```

### iOS (app.json)
```json
"infoPlist": {
  "UIBackgroundModes": ["remote-notification"]
}
```

## 🧪 Test Etme

1. **Admin Hesabı ile Giriş Yapın**
2. **Başka Bir Cihazdan Sipariş Verin**
3. **Admin Cihazında Bildirim Geldiğini Kontrol Edin**
   - Ses duyulmalı
   - Telefon titremeli (3 kez)
   - Bildirim görünmeli
   - Toast mesajı gösterilmeli

## 🔍 Sorun Giderme

### Bildirim Gelmiyor
1. Bildirim izinlerini kontrol edin
2. Push token'ın kaydedildiğini kontrol edin
3. Admin rolünün doğru atandığını kontrol edin
4. Uygulamanın arka planda çalıştığından emin olun

### Ses Çalmıyor
1. Telefonun sesli modda olduğunu kontrol edin
2. Bildirim ses ayarlarını kontrol edin
3. Uygulama bildirim ayarlarını kontrol edin

### Titreşim Çalışmıyor
1. Telefonun titreşim modunda olduğunu kontrol edin
2. Uygulama izinlerini kontrol edin (VIBRATE)
3. Bildirim kanalı ayarlarını kontrol edin

## 📚 İlgili Dosyalar

- `src/services/notificationService.ts` - Bildirim servisi
- `src/services/orderService.ts` - Sipariş servisi (push notification)
- `src/screens/admin/AdminOrders.tsx` - Admin sipariş ekranı (realtime)
- `database-updates/add-admin-notifications-trigger.sql` - Veritabanı trigger
- `app.json` - Uygulama konfigürasyonu

## 🎯 Sonraki Adımlar

- [ ] Özel bildirim sesi ekleme (assets/sounds/)
- [ ] Bildirim ayarları ekranı (ses/titreşim açma/kapama)
- [ ] Bildirim geçmişi ekranı
- [ ] Bildirim istatistikleri

