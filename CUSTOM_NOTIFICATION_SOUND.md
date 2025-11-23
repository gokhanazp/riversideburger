# Özel Bildirim Sesi Yapılandırması

## 📱 iOS Özel Ses Kullanımı

### ⚠️ Önemli Notlar:

1. **Expo Go Sınırlaması:**
   - ❌ Expo Go'da özel sesler **ÇALIŞMAZ**
   - ✅ Development Build veya Production Build gereklidir
   - ℹ️ Expo Go'da varsayılan iOS sesi çalar

2. **Ses Dosyası Formatı:**
   - ✅ **Format:** Linear PCM, MA4 (IMA/ADPCM), µLaw, aLaw
   - ✅ **Uzantı:** .aiff, .wav, .caf (önerilen: .caf)
   - ⚠️ **MP3 Desteği:** Sınırlı (Development Build'de çalışabilir)
   - ⏱️ **Süre:** Maksimum 30 saniye

3. **Ses Dosyası Konumu:**
   ```
   /assets/order-sound.mp3
   ```

### 🔧 Yapılandırma:

#### 1. app.json
```json
{
  "plugins": [
    [
      "expo-notifications",
      {
        "sounds": ["./assets/order-sound.mp3"]
      }
    ]
  ]
}
```

#### 2. Kod Kullanımı
```typescript
// iOS: Uzantı olmadan (without extension)
// Android: Tam dosya adı ile (with full filename)
await sendLocalNotification(
  '🔔 YENİ SİPARİŞ!',
  'Müşteri - ₺100.00',
  { orderId: '123', type: 'new_order_admin' },
  'admin_orders',
  Notifications.AndroidNotificationPriority.MAX,
  'order-sound.mp3' // Otomatik olarak iOS için 'order-sound' olur
);
```

## 🤖 Android Özel Ses Kullanımı

### ✅ Android'de Çalışır:

- ✅ Expo Go'da çalışır
- ✅ Development Build'de çalışır
- ✅ Production Build'de çalışır

### 🔧 Yapılandırma:

#### 1. Notification Channel
```typescript
await Notifications.setNotificationChannelAsync('admin_orders', {
  name: 'Admin Sipariş Bildirimleri',
  importance: Notifications.AndroidImportance.MAX,
  sound: 'order-sound.mp3', // Özel ses
  vibrationPattern: [0, 500, 200, 500, 200, 500],
});
```

#### 2. Ses Dosyası
- **Konum:** `/assets/order-sound.mp3`
- **Format:** MP3, WAV, OGG
- **Süre:** Maksimum 30 saniye

## 🚀 Development Build Oluşturma (iOS için özel ses)

### Adım 1: EAS CLI Kurulumu
```bash
npm install -g eas-cli
```

### Adım 2: EAS'a Giriş
```bash
eas login
```

### Adım 3: Development Build
```bash
# iOS için
eas build --profile development --platform ios

# Android için
eas build --profile development --platform android
```

### Adım 4: Build'i Yükleme
1. Build tamamlandığında QR kod gelecek
2. iPhone'da Camera ile QR kodu tarayın
3. Build'i indirin ve yükleyin
4. Artık özel sesler çalışacak! 🎉

## 🧪 Test Senaryoları

### Expo Go (Mevcut Durum):
- ✅ **Android:** Özel ses çalışır
- ❌ **iOS:** Varsayılan ses çalar (özel ses çalışmaz)

### Development Build:
- ✅ **Android:** Özel ses çalışır
- ✅ **iOS:** Özel ses çalışır

### Production Build:
- ✅ **Android:** Özel ses çalışır
- ✅ **iOS:** Özel ses çalışır

## 📋 Kontrol Listesi

- [x] Ses dosyası `/assets/order-sound.mp3` konumunda
- [x] `app.json` içinde ses dosyası tanımlandı
- [x] `notificationService.ts` içinde özel ses desteği eklendi
- [x] Android notification channel'a özel ses eklendi
- [x] iOS için uzantı kaldırma mantığı eklendi
- [ ] Development Build oluşturuldu (iOS için özel ses)

## 🎯 Sonuç

**Mevcut Durum:**
- ✅ Bildirimler çalışıyor
- ✅ Realtime subscription aktif
- ✅ Android'de özel ses çalışacak
- ⚠️ iOS'ta varsayılan ses çalıyor (Expo Go sınırlaması)

**Kalıcı Çözüm:**
- 🚀 Development Build oluşturun
- ✅ iOS'ta da özel ses çalışacak

