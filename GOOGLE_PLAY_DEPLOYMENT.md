# 🚀 Google Play Store Yayınlama Rehberi

Bu rehber, Riverside Burgers uygulamasını Google Play Store'a yayınlamak için gereken adımları içerir.

## 📋 Ön Gereksinimler

### 1. Google Play Console Hesabı
- [Google Play Console](https://play.google.com/console) hesabı oluşturun
- **25 USD** tek seferlik kayıt ücreti ödemeniz gerekiyor
- Geliştirici hesabınızı doğrulayın (kimlik doğrulama gerekebilir)

### 2. Expo Hesabı
- [Expo.dev](https://expo.dev) hesabı oluşturun (ücretsiz)
- Expo CLI'yi yükleyin: `npm install -g eas-cli`
- Giriş yapın: `eas login`

### 3. Gerekli Bilgiler
- Uygulama adı: **Riverside Burgers**
- Package name: **com.riversideburgers.app**
- Kategori: **Yiyecek ve İçecek**
- Hedef kitle: **18+** (yemek siparişi)

---

## 🔧 Adım 1: EAS Build Kurulumu

### 1.1. EAS CLI Kurulumu
```bash
npm install -g eas-cli
```

### 1.2. EAS'a Giriş Yapın
```bash
eas login
```

### 1.3. Projeyi EAS'a Bağlayın
```bash
eas build:configure
```

Bu komut çalıştırıldığında:
- Expo hesabınızla ilişkilendirilecek
- `app.json` dosyasında `projectId` otomatik eklenecek

---

## 🏗️ Adım 2: İlk Build'i Oluşturun

### 2.1. Production APK Build (Test için)
```bash
eas build --platform android --profile preview
```

Bu komut:
- APK dosyası oluşturur (test için)
- Yaklaşık 10-20 dakika sürer
- Build tamamlandığında indirme linki verilir

### 2.2. Production AAB Build (Google Play için)
```bash
eas build --platform android --profile production
```

Bu komut:
- AAB (Android App Bundle) oluşturur
- Google Play Store'a yüklemek için gerekli
- Yaklaşık 10-20 dakika sürer

---

## 📱 Adım 3: Google Play Console Kurulumu

### 3.1. Yeni Uygulama Oluşturun
1. [Google Play Console](https://play.google.com/console) → **Tüm uygulamalar** → **Uygulama oluştur**
2. Uygulama adı: **Riverside Burgers**
3. Varsayılan dil: **Türkçe**
4. Uygulama türü: **Uygulama**
5. Ücretsiz/Ücretli: **Ücretsiz**

### 3.2. Mağaza Kaydı (Store Listing)
Aşağıdaki bilgileri doldurun:

#### Uygulama Detayları
- **Uygulama adı**: Riverside Burgers
- **Kısa açıklama** (80 karakter):
  ```
  Riverside Burgers'dan hızlı ve kolay sipariş! Lezzetli burgerler kapınızda.
  ```
- **Tam açıklama** (4000 karakter):
  ```
  🍔 Riverside Burgers Mobil Uygulaması
  
  Riverside Burgers'ın resmi mobil uygulamasıyla favori burgerlerinizi kolayca sipariş edin!
  
  ✨ Özellikler:
  • 🍔 Geniş menü seçenekleri
  • 🎨 Özelleştirilebilir burgerler
  • 🚚 Hızlı teslimat takibi
  • 💳 Güvenli ödeme seçenekleri
  • ⭐ Puan kazanın, indirim kazanın
  • 🌍 Çoklu dil desteği (Türkçe/İngilizce)
  • 💰 Çoklu para birimi (TRY/CAD)
  • 📝 Ürün ve restoran yorumları
  
  📱 Nasıl Çalışır?
  1. Menüden favori burgerinizi seçin
  2. İstediğiniz gibi özelleştirin
  3. Sepete ekleyin ve siparişi tamamlayın
  4. Siparişinizi gerçek zamanlı takip edin
  5. Kapınızda teslim alın!
  
  🎁 Sadakat Programı
  Her siparişte puan kazanın ve bir sonraki siparişinizde indirim kazanın!
  
  📞 Destek
  Herhangi bir sorunuz için bizimle iletişime geçin.
  
  İyi iştahlar! 🍔
  ```

#### Uygulama İkonu
- **512x512 PNG** (assets/icon.png dosyanızı kullanın)

#### Ekran Görüntüleri (Screenshots)
En az **2 adet**, maksimum **8 adet** ekran görüntüsü gerekli:
- Telefon: 16:9 veya 9:16 oran
- Önerilen boyut: 1080x1920 veya 1080x2340

**Hangi ekranları çekelim:**
1. Ana sayfa (Home Screen)
2. Menü ekranı (Menu Screen)
3. Ürün detay ekranı (Product Detail)
4. Sepet ekranı (Cart)
5. Sipariş takip ekranı (Order Tracking)
6. Profil ekranı (Profile)

#### Kategori
- **Kategori**: Yiyecek ve İçecek
- **Alt kategori**: Yemek Siparişi

#### İletişim Bilgileri
- **E-posta**: [Destek e-postanız]
- **Telefon**: [Opsiyonel]
- **Web sitesi**: [Varsa]

#### Gizlilik Politikası
- **Gizlilik Politikası URL'si**: [Gerekli - bir web sayfası oluşturmanız gerekiyor]

### 3.3. İçerik Derecelendirmesi
1. **İçerik derecelendirmesi** → **Anketi başlat**
2. Kategori: **Yardımcı programlar, üretkenlik, iletişim veya diğer**
3. Tüm soruları "Hayır" olarak yanıtlayın (şiddet, cinsellik vb. yok)
4. Derecelendirmeyi kaydedin

### 3.4. Hedef Kitle ve İçerik
1. **Hedef kitle** → **Hedef yaş grubu**: 18+
2. **Mağaza varlığı** → **Uygulama erişimi**: Tüm kullanıcılar
3. **Reklamlar**: Uygulamada reklam var mı? (Hayır)

### 3.5. Veri Güvenliği
1. **Veri güvenliği** bölümünü doldurun
2. Toplanan veriler:
   - ✅ Kişisel bilgiler (ad, e-posta, telefon)
   - ✅ Konum bilgisi (teslimat adresi)
   - ✅ Ödeme bilgileri
3. Veri kullanımı:
   - Uygulama işlevselliği
   - Sipariş yönetimi
   - Müşteri desteği

---

## 📦 Adım 4: AAB Dosyasını Yükleyin

### 4.1. Production Track Seçin
1. **Üretim** → **Yeni sürüm oluştur**
2. **App Bundle'ı yükle** → EAS'dan indirdiğiniz `.aab` dosyasını seçin

### 4.2. Sürüm Notları
```
İlk sürüm - v1.0.0

✨ Özellikler:
• Geniş menü seçenekleri
• Özelleştirilebilir burgerler
• Hızlı teslimat takibi
• Güvenli ödeme seçenekleri
• Puan kazanma sistemi
• Çoklu dil desteği (TR/EN)
• Ürün ve restoran yorumları
```

### 4.3. İncelemeye Gönderin
1. Tüm bilgileri kontrol edin
2. **İncelemeye gönder** butonuna tıklayın
3. Google'ın incelemesi **1-7 gün** sürebilir

---

## 🔄 Adım 5: Güncelleme Yayınlama

### 5.1. Version Numarasını Artırın
`app.json` dosyasında:
```json
{
  "expo": {
    "version": "1.0.1",  // Artırın
    "android": {
      "versionCode": 2   // Her sürümde 1 artırın
    }
  }
}
```

### 5.2. Yeni Build Oluşturun
```bash
eas build --platform android --profile production
```

### 5.3. Google Play Console'a Yükleyin
1. **Üretim** → **Yeni sürüm oluştur**
2. Yeni `.aab` dosyasını yükleyin
3. Sürüm notlarını ekleyin
4. **İncelemeye gönder**

---

## 🎨 Adım 6: Ekran Görüntüleri Alma

### 6.1. Android Emulator'da Çalıştırın
```bash
npm start
# Sonra 'a' tuşuna basarak Android emulator'u açın
```

### 6.2. Ekran Görüntüsü Alın
- **Mac**: `Cmd + Shift + 4` → Alanı seçin
- **Windows**: `Windows + Shift + S`
- **Emulator**: Emulator'ün sağ tarafındaki kamera ikonuna tıklayın

### 6.3. Görüntüleri Düzenleyin
- Boyut: 1080x1920 veya 1080x2340
- Format: PNG veya JPEG
- Maksimum dosya boyutu: 8 MB

---

## 📝 Adım 7: Gizlilik Politikası Oluşturma

Google Play, gizlilik politikası URL'si gerektirir. Basit bir HTML sayfası oluşturabilirsiniz:

### 7.1. Örnek Gizlilik Politikası
```html
<!DOCTYPE html>
<html>
<head>
    <title>Riverside Burgers - Gizlilik Politikası</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>Gizlilik Politikası</h1>
    <p>Son güncelleme: [Tarih]</p>
    
    <h2>Toplanan Bilgiler</h2>
    <p>Riverside Burgers uygulaması aşağıdaki bilgileri toplar:</p>
    <ul>
        <li>Ad ve soyad</li>
        <li>E-posta adresi</li>
        <li>Telefon numarası</li>
        <li>Teslimat adresi</li>
        <li>Sipariş geçmişi</li>
    </ul>
    
    <h2>Bilgilerin Kullanımı</h2>
    <p>Toplanan bilgiler şu amaçlarla kullanılır:</p>
    <ul>
        <li>Sipariş işleme ve teslimat</li>
        <li>Müşteri desteği</li>
        <li>Uygulama iyileştirmeleri</li>
    </ul>
    
    <h2>Veri Güvenliği</h2>
    <p>Verileriniz Supabase güvenli sunucularında saklanır ve şifrelenir.</p>
    
    <h2>İletişim</h2>
    <p>Sorularınız için: [E-posta adresiniz]</p>
</body>
</html>
```

Bu dosyayı bir web sunucusuna yükleyin veya GitHub Pages kullanın.

---

## ✅ Kontrol Listesi

Yayınlamadan önce kontrol edin:

- [ ] `app.json` dosyası yapılandırıldı
- [ ] `eas.json` dosyası oluşturuldu
- [ ] EAS hesabı oluşturuldu ve giriş yapıldı
- [ ] Production AAB build oluşturuldu
- [ ] Google Play Console hesabı oluşturuldu (25 USD ödendi)
- [ ] Mağaza kaydı tamamlandı (açıklama, ikon, ekran görüntüleri)
- [ ] İçerik derecelendirmesi yapıldı
- [ ] Veri güvenliği formu dolduruldu
- [ ] Gizlilik politikası URL'si eklendi
- [ ] AAB dosyası yüklendi
- [ ] İncelemeye gönderildi

---

## 🚨 Önemli Notlar

1. **İlk inceleme 1-7 gün sürebilir**
2. **Red edilirse**: Google'ın geri bildirimlerini okuyun ve düzeltin
3. **Güncelleme incelemesi daha hızlıdır** (genellikle 1-2 gün)
4. **Test edin**: Yayınlamadan önce APK'yı gerçek cihazda test edin
5. **Yedekleme**: Keystore dosyalarını güvenli bir yerde saklayın

---

## 📞 Yardım

Sorun yaşarsanız:
- [Expo Documentation](https://docs.expo.dev/build/setup/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

## 🎉 Başarılar!

Uygulamanız yayınlandığında, kullanıcılar Google Play Store'da "Riverside Burgers" arayarak bulabilir!

