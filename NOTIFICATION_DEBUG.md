# Bildirim Sistemi Debug Rehberi

## 🔍 Sorun: iPhone'da Bildirim Gelmiyor

### Durum Analizi:
- ✅ Uygulama içi bildirimler çalışıyor (notifications tablosuna kaydediliyor)
- ❌ Push notification gelmiyor (telefon bildirimi olarak)
- ❌ Yerel bildirim (local notification) görünmüyor

## 📱 Expo Go Sınırlamaları

### Push Notifications (Uzak Bildirimler):
- ❌ **Expo Go'da tam olarak çalışmaz**
- ✅ Development build veya production build gerekir
- ⚠️ `projectId` var ama token alınamıyor olabilir

### Local Notifications (Yerel Bildirimler):
- ✅ **Expo Go'da çalışmalı**
- ⚠️ Uygulama ön plandayken görünmeyebilir (iOS)
- ✅ Uygulama arka plandayken çalışır

## 🔧 Yapılan İyileştirmeler

### 1. iOS Ön Plan Bildirimleri
```typescript
// iOS'ta uygulama açıkken de bildirim göster
const iosConfig = Platform.OS === 'ios' ? {
  _displayInForeground: true,
} : {};
```

### 2. Detaylı İzin İsteme
```typescript
await Notifications.requestPermissionsAsync({
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
    allowAnnouncements: true,
  },
});
```

### 3. Debug Logları
- ✅ Bildirim gönderildiğinde log
- ✅ Bildirim alındığında log
- ✅ Token kaydedildiğinde log
- ✅ Hata durumlarında log

## 🧪 Test Adımları

### 1. İzinleri Kontrol Et
```bash
# iPhone'da:
# Ayarlar > Riverside Burgers > Bildirimler
# - Bildirimlere İzin Ver: AÇIK
# - Sesler: AÇIK
# - Rozetler: AÇIK
# - Kilit Ekranında Göster: AÇIK
```

### 2. Uygulama Loglarını İzle
```bash
# Terminal'de:
npx expo start

# iPhone'da uygulamayı aç
# Console'da şu logları ara:
# - "✅ Bildirim izni verildi"
# - "✅ Push token alındı, kaydediliyor..."
# - "📱 Yerel bildirim gönderiliyor..."
# - "✅ Yerel bildirim başarıyla gönderildi"
# - "📬 Bildirim alındı:"
```

### 3. Test Senaryoları

#### Senaryo 1: Uygulama Açıkken
1. Admin hesabı ile iPhone'da giriş yap
2. Admin Orders ekranını aç
3. Başka cihazdan sipariş ver
4. **Beklenen:**
   - Console'da log görünmeli
   - Toast mesajı görünmeli
   - Bildirim görünmeli (iOS 14+)

#### Senaryo 2: Uygulama Arka Plandayken
1. Admin hesabı ile iPhone'da giriş yap
2. Uygulamayı arka plana at (Home'a bas)
3. Başka cihazdan sipariş ver
4. **Beklenen:**
   - Bildirim banner'ı görünmeli
   - Ses çalmalı
   - Badge sayısı artmalı

#### Senaryo 3: Uygulama Kapalıyken
1. Admin hesabı ile iPhone'da giriş yap
2. Uygulamayı tamamen kapat
3. Başka cihazdan sipariş ver
4. **Beklenen:**
   - ❌ Bildirim gelmez (Expo Go sınırlaması)
   - ✅ Uygulamayı açınca bildirimler görünür

## 🚀 Kalıcı Çözüm: Development Build

### Expo Go Yerine Development Build Kullan

```bash
# 1. EAS CLI kur
npm install -g eas-cli

# 2. EAS'a giriş yap
eas login

# 3. Development build oluştur
eas build --profile development --platform ios

# 4. Build tamamlandığında iPhone'a yükle
# QR kod ile veya TestFlight ile
```

### Development Build Avantajları:
- ✅ Push notifications tam çalışır
- ✅ Uygulama kapalıyken bildirim gelir
- ✅ Arka plan bildirimleri çalışır
- ✅ Tüm native özellikler çalışır

## 📊 Bildirim Akışı

### Mevcut Akış (Expo Go):
```
Sipariş Oluştur
    ↓
Database Trigger → notifications tablosuna kaydet
    ↓
orderService.ts → sendPushNotificationToAdmins() çağır
    ↓
Expo Push API'ye istek gönder (❌ Token yok)
    ↓
AdminOrders.tsx → Realtime subscription
    ↓
sendLocalNotification() çağır
    ↓
Bildirim göster (⚠️ Ön planda görünmeyebilir)
```

### İdeal Akış (Development Build):
```
Sipariş Oluştur
    ↓
Database Trigger → notifications tablosuna kaydet
    ↓
orderService.ts → sendPushNotificationToAdmins() çağır
    ↓
Expo Push API'ye istek gönder (✅ Token var)
    ↓
Apple/Google Push Service
    ↓
iPhone'a bildirim gelir (✅ Her durumda)
```

## 🔍 Debug Komutları

### Console'da Kontrol Et:
```javascript
// Bildirim izinlerini kontrol et
await Notifications.getPermissionsAsync()

// Push token'ı kontrol et
await Notifications.getExpoPushTokenAsync({
  projectId: '8fe95f1d-8d84-4ccf-8b75-cdd48aceb0fd'
})

// Test bildirimi gönder
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Test Bildirim',
    body: 'Bu bir test bildirimidir',
    sound: true,
  },
  trigger: null,
})
```

## 📝 Sonuç

### Expo Go ile:
- ✅ Uygulama içi bildirimler çalışıyor
- ⚠️ Yerel bildirimler kısıtlı çalışıyor
- ❌ Push notifications çalışmıyor

### Development Build ile:
- ✅ Tüm bildirimler tam çalışır
- ✅ Uygulama kapalıyken bile bildirim gelir
- ✅ Production'a hazır

## 🎯 Önerilen Çözüm

1. **Kısa Vadeli:** Uygulama içi bildirimleri kullan (mevcut durum)
2. **Orta Vadeli:** Development build oluştur ve test et
3. **Uzun Vadeli:** Production build ile App Store'a yükle

