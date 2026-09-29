# 🍔 Riverside Burgers - Mobile Restaurant App

Modern ve kullanıcı dostu bir restoran mobil uygulaması. React Native ve Expo ile geliştirilmiştir.

## 📱 Özellikler

### ✅ Tamamlanan Özellikler

#### Müşteri Özellikleri
- 🏠 **Ana Sayfa**: Banner slider, kategoriler, popüler ürünler, müşteri yorumları, footer
- 📋 **Menü**: Kategorilere göre filtreleme, arama, favorilere ekleme, Supabase entegrasyonu
- 🛒 **Sepet**: Ürün ekleme/çıkarma, miktar güncelleme, sipariş verme, custom modal'lar
- 👤 **Profil**: Kullanıcı bilgileri, favoriler, giriş/çıkış, misafir modu
- 🔐 **Authentication**: Kayıt ol, giriş yap, şifre sıfırlama, Supabase Auth
- ⭐ **Favoriler**: Ürünleri favorilere ekleme/çıkarma
- 🔍 **Arama**: Ürün arama özelliği
- 🎭 **Animasyonlar**: React Native Reanimated ile smooth animasyonlar
- 🔔 **Toast Notifications**: Kullanıcı dostu bildirimler
- 🎨 **Modern UI**: Riverside Burgers marka renkleri ve tasarımı

#### Teknik Özellikler
- 💾 **Supabase Backend**: PostgreSQL database, Row Level Security
- 🔐 **Güvenli Authentication**: JWT token, metadata storage
- 📊 **State Management**: Zustand ile merkezi state yönetimi
- 🎯 **TypeScript**: Type-safe kod
- 📱 **Responsive**: Web ve mobil uyumlu tasarım
- 🚀 **Real-time**: Supabase real-time subscriptions hazır

### 🚧 Gelecek Özellikler
- 💳 Ödeme entegrasyonu
- 📍 Adres yönetimi
- 📦 Sipariş takibi (real-time)
- 👨‍💼 Admin paneli (sipariş yönetimi, menü yönetimi)
- 🔔 Push notifications
- 🌐 Çoklu dil desteği

## 🛠️ Teknoloji Stack

- **Framework**: React Native + Expo SDK 54
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **Navigation**: React Navigation (Bottom Tabs + Stack)
- **State Management**: Zustand
- **Language**: TypeScript
- **Animations**: React Native Reanimated
- **Icons**: Expo Vector Icons (Ionicons)
- **Notifications**: React Native Toast Message

## 📦 Kurulum

### Gereksinimler
- Node.js 18+
- npm veya yarn
- Expo CLI
- Supabase hesabı

### Adımlar

1. **Repository'yi klonlayın:**
```bash
git clone https://github.com/yourusername/riverside-burgers-mobile.git
cd riverside-burgers-mobile
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
# veya
yarn install
```

3. **Environment variables ayarlayın:**
```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin ve Supabase bilgilerinizi ekleyin:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Supabase Database'i kurun:**

Supabase SQL Editor'de `database/schema.sql` dosyasını çalıştırın.
Ardından `database/seed.sql` dosyasını çalıştırarak test verilerini ekleyin.

5. **Uygulamayı başlatın:**
```bash
npm start
# veya
yarn start
```

## 📱 Test Etme

### PC'de Test (Web)
```bash
npm start
# Terminalde 'w' tuşuna basın
```
Tarayıcınızda `http://localhost:8081` adresinde açılacaktır.

### Telefonda Test (Expo Go)
1. App Store veya Google Play'den **Expo Go** uygulamasını indirin
2. `npm start` komutuyla uygulamayı başlatın
3. Terminalde görünen QR kodu Expo Go ile tarayın
4. Uygulama telefonunuzda açılacaktır

### Android Emulator
```bash
npm run android
```

### iOS Simulator (Sadece Mac)
```bash
npm run ios
```

## 📁 Proje Yapısı

```
mobilerestaurant/
├── src/
│   ├── components/         # Yeniden kullanılabilir componentler
│   ├── screens/           # Ekran componentleri
│   │   ├── HomeScreen.tsx
│   │   ├── MenuScreen.tsx
│   │   ├── CartScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── navigation/        # Navigation yapısı
│   │   ├── AppNavigator.tsx
│   │   └── types.ts
│   ├── store/            # State management (Zustand)
│   │   └── cartStore.ts
│   ├── types/            # TypeScript type tanımları
│   │   └── index.ts
│   ├── constants/        # Sabitler ve tema
│   │   ├── theme.ts
│   │   └── mockData.ts
│   ├── services/         # API servisleri (gelecek)
│   └── utils/            # Yardımcı fonksiyonlar
├── assets/               # Resimler ve fontlar
├── App.tsx              # Ana uygulama dosyası
└── package.json
```

## 🎨 Tema ve Renkler

Riverside Burgers marka renkleri:
- **Primary**: #E63946 (Kırmızı)
- **Secondary**: #FF6B35 (Turuncu)
- **Background**: #F8F9FA (Açık gri)
- **Text**: #212529 (Koyu gri)
- **White**: #FFFFFF (Beyaz)

## 🔧 Geliştirme

### Yeni Ekran Ekleme
1. `src/screens/` klasörüne yeni ekran dosyası oluşturun
2. `src/navigation/types.ts` dosyasına route ekleyin
3. `src/navigation/AppNavigator.tsx` dosyasına ekranı ekleyin

### Yeni Store Ekleme
1. `src/store/` klasörüne yeni store dosyası oluşturun
2. Zustand `create` fonksiyonunu kullanın
3. İhtiyaç duyulan componentlerde import edin

### Tema Değişiklikleri
`src/constants/theme.ts` dosyasından renkleri ve stilleri düzenleyebilirsiniz.

## 📝 Örnek Kullanım

### Sepete Ürün Ekleme
```typescript
import { useCartStore } from '../store/cartStore';

const addItem = useCartStore((state) => state.addItem);
addItem(menuItem);
```

### Sepet Toplam Fiyatı
```typescript
const getTotalPrice = useCartStore((state) => state.getTotalPrice());
```

## 🚀 Production Build

### Android APK
```bash
eas build --platform android
```

### iOS IPA
```bash
eas build --platform ios
```

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 👨‍💻 Geliştirici

Gökhan Yıldırım

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add some amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

---

**Not**: Bu uygulama development aşamasındadır. Production kullanımı için ek güvenlik ve optimizasyon gereklidir.


## Runtime version vs store version

`expo.runtimeVersion` is pinned to a string (`"2.0.7"`) on purpose and is
**not** tied to `expo.version`. A store build only needs a new `version`
(e.g. 2.0.8 for new App Store screenshots); as long as the native layer is
unchanged, keep the runtime string as is so one OTA line reaches every
installed build. Bump the runtime string only when native code changes
(Expo SDK upgrade, new native module, config plugin change) — and ship a
store build at the same time.
