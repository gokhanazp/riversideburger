# 🎯 STRIPE ÖDEME ENTEGRASYONU

Riverside Burgers uygulamasına Stripe ödeme sistemi entegrasyonu.

---

## 📋 ADIM 1: STRIPE HESABI OLUŞTURMA

### 1.1 Stripe Hesabı
1. https://stripe.com adresine gidin
2. "Start now" ile hesap oluşturun
3. Email doğrulaması yapın
4. Dashboard'a giriş yapın

### 1.2 API Anahtarları
1. Dashboard → Developers → API keys
2. **Test Mode** anahtarlarını alın:
   - **Publishable key** (pk_test_...) - Frontend'de kullanılır
   - **Secret key** (sk_test_...) - Backend'de kullanılır

⚠️ **ÖNEMLİ:** Secret key'i asla frontend'de kullanmayın!

---

## 📦 ADIM 2: PAKET KURULUMU

### 2.1 React Native Paketleri

```bash
# Stripe React Native SDK
npx expo install @stripe/stripe-react-native

# HTTP istekleri için (opsiyonel, zaten var olabilir)
npm install axios
```

### 2.2 Supabase Edge Functions için

```bash
# Supabase CLI kurulumu (eğer yoksa)
npm install -g supabase

# Stripe Deno paketi (Edge Functions'da kullanılacak)
# Deno otomatik olarak import eder, kurulum gerekmez
```

---

## 🗄️ ADIM 3: DATABASE TABLOLARI

### 3.1 Payments Tablosu

```sql
-- Ödeme kayıtları tablosu (Payments table)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stripe bilgileri (Stripe information)
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  
  -- Ödeme bilgileri (Payment information)
  amount DECIMAL(10, 2) NOT NULL, -- Ödenen tutar (Amount paid)
  currency TEXT NOT NULL DEFAULT 'CAD', -- Para birimi (Currency)
  status TEXT NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded
  payment_method TEXT, -- card, apple_pay, google_pay
  
  -- Kart bilgileri (Card information - son 4 hane)
  card_brand TEXT, -- visa, mastercard, amex
  card_last4 TEXT, -- Son 4 hane (Last 4 digits)
  
  -- Hata bilgileri (Error information)
  error_message TEXT,
  error_code TEXT,
  
  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status kontrolü (Status validation)
  CONSTRAINT valid_status CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled'))
);

-- İndeksler (Indexes)
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- RLS Politikaları (RLS Policies)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi ödemelerini görebilir (Users can view their own payments)
CREATE POLICY "Users can view own payments"
ON payments FOR SELECT
USING (auth.uid() = user_id);

-- Admin'ler tüm ödemeleri görebilir (Admins can view all payments)
CREATE POLICY "Admins can view all payments"
ON payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Sistem ödemeleri oluşturabilir (System can create payments)
CREATE POLICY "System can create payments"
ON payments FOR INSERT
WITH CHECK (true);

-- Sistem ödemeleri güncelleyebilir (System can update payments)
CREATE POLICY "System can update payments"
ON payments FOR UPDATE
USING (true);
```

### 3.2 Orders Tablosuna Payment Alanları Ekleme

```sql
-- Orders tablosuna ödeme durumu ekle (Add payment status to orders table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Payment status kontrolü (Payment status validation)
ALTER TABLE orders ADD CONSTRAINT valid_payment_status 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
```

---

## 🔧 ADIM 4: SUPABASE EDGE FUNCTIONS

### 4.1 Edge Function Oluşturma

```bash
# Supabase projesine bağlan
supabase login

# Edge function oluştur
supabase functions new create-payment-intent
supabase functions new confirm-payment
supabase functions new refund-payment
```

---

## 🔐 ADIM 5: ENVIRONMENT VARIABLES

### 5.1 Supabase Secrets

```bash
# Stripe secret key'i Supabase'e ekle
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key_here
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### 5.2 React Native .env

```bash
# .env dosyası oluştur (proje root'unda)
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
SUPABASE_FUNCTIONS_URL=https://your-project-ref.supabase.co/functions/v1
```

---

## 📱 ADIM 6: REACT NATIVE KURULUM

### 6.1 App.tsx'e Stripe Provider Ekleme

```typescript
import { StripeProvider } from '@stripe/stripe-react-native';

// ...

<StripeProvider publishableKey={process.env.STRIPE_PUBLISHABLE_KEY}>
  <AppNavigator />
</StripeProvider>
```

---

## 🎨 ÖDEME AKIŞI (PAYMENT FLOW)

### Kullanıcı Perspektifi:
1. Sepete ürün ekle
2. Checkout'a git
3. Adres seç
4. Ödeme yöntemini seç (Kart, Apple Pay, Google Pay)
5. Kart bilgilerini gir
6. "Ödeme Yap" butonuna tıkla
7. Ödeme işleniyor...
8. Başarılı → Sipariş oluşturuldu
9. Başarısız → Hata mesajı göster

### Teknik Akış:
1. Frontend: Payment Intent oluştur (Edge Function çağır)
2. Backend: Stripe'a Payment Intent oluştur
3. Frontend: Stripe Elements ile kart bilgisi al
4. Frontend: Payment Intent'i confirm et
5. Backend: Ödeme durumunu kontrol et
6. Backend: Siparişi oluştur ve ödeme kaydı ekle
7. Frontend: Başarı/hata mesajı göster

---

## 💰 FİYATLANDIRMA

### Stripe Ücretleri (Kanada):
- **Kart ödemeleri:** 2.9% + $0.30 CAD per transaction
- **Apple Pay / Google Pay:** 2.9% + $0.30 CAD per transaction
- **Uluslararası kartlar:** +1.5% ek ücret

### Test Kartları:
- **Başarılı:** 4242 4242 4242 4242
- **Başarısız:** 4000 0000 0000 0002
- **3D Secure:** 4000 0027 6000 3184

---

## 🔒 GÜVENLİK

### PCI Compliance:
- ✅ Kart bilgileri asla sunucuya gönderilmez
- ✅ Stripe Elements kullanılır (tokenization)
- ✅ HTTPS zorunlu
- ✅ Secret key backend'de saklanır

### Best Practices:
- ✅ Payment Intent kullan (SCA uyumlu)
- ✅ Webhook'lar ile ödeme durumunu doğrula
- ✅ Idempotency key kullan (duplicate önleme)
- ✅ Hata durumlarını logla

---

## 📊 SONRAKI ADIMLAR

1. ✅ Stripe hesabı oluştur
2. ✅ API anahtarlarını al
3. ✅ Database tablolarını oluştur
4. ✅ Edge Functions yaz
5. ✅ React Native UI oluştur
6. ✅ Test et
7. ✅ Production'a geç

---

## 🚀 KURULUM ADIMLARI (STEP BY STEP)

### 1️⃣ Stripe Hesabı ve API Anahtarları

```bash
# 1. https://stripe.com adresine gidin ve hesap oluşturun
# 2. Dashboard → Developers → API keys
# 3. Test Mode anahtarlarını kopyalayın:
#    - Publishable key: pk_test_...
#    - Secret key: sk_test_...
```

### 2️⃣ Paketleri Kurun

```bash
# React Native Stripe SDK
npx expo install @stripe/stripe-react-native

# Axios (HTTP istekleri için)
npm install axios
```

### 3️⃣ Database Tablolarını Oluşturun

```bash
# Supabase Dashboard → SQL Editor
# database-updates/stripe-payments.sql dosyasını çalıştırın
```

### 4️⃣ Environment Variables Ayarlayın

```bash
# .env dosyası oluşturun (proje root'unda)
echo "STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here" >> .env
echo "SUPABASE_FUNCTIONS_URL=https://your-project-ref.supabase.co/functions/v1" >> .env

# Supabase secrets ayarlayın
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

### 5️⃣ Supabase Edge Functions Deploy Edin

```bash
# Supabase CLI kurulumu (eğer yoksa)
npm install -g supabase

# Supabase'e login
supabase login

# Edge functions deploy et
supabase functions deploy create-payment-intent
supabase functions deploy confirm-payment
```

### 6️⃣ App.tsx'e Stripe Provider Ekleyin

```typescript
// App.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

// ...

export default function App() {
  return (
    <StripeProvider publishableKey="pk_test_your_key_here">
      <SafeAreaProvider>
        <PaperProvider>
          <AppNavigator />
          <StatusBar style="dark" />
          <Toast config={toastConfig} />
        </PaperProvider>
      </SafeAreaProvider>
    </StripeProvider>
  );
}
```

### 7️⃣ Navigation'a Payment Screen Ekleyin

```typescript
// src/navigation/AppNavigator.tsx
import PaymentScreen from '../screens/PaymentScreen';

// ...

<Stack.Screen
  name="Payment"
  component={PaymentScreen}
  options={{ headerShown: false }}
/>
```

### 8️⃣ CartScreen'den Payment Screen'e Yönlendirme

```typescript
// src/screens/CartScreen.tsx

// Checkout butonuna tıklandığında:
const handleCheckout = () => {
  // ... validasyonlar ...

  // Ödeme ekranına git
  navigation.navigate('Payment', {
    totalAmount: getFinalPrice(),
    currency: 'CAD', // veya 'TRY'
    deliveryAddress: fullAddress,
    phone: selectedAddress?.phone,
    notes: notes,
    pointsUsed: pointsToUse,
    addressId: selectedAddress?.id,
  });
};
```

---

## 🧪 TEST ETME

### Test Kartları:

| Kart Numarası | Sonuç | Açıklama |
|---------------|-------|----------|
| 4242 4242 4242 4242 | ✅ Başarılı | Standart test kartı |
| 4000 0000 0000 0002 | ❌ Başarısız | Kart reddedildi |
| 4000 0027 6000 3184 | 🔐 3D Secure | 3D Secure doğrulama gerektirir |

**Diğer Bilgiler:**
- **CVV:** Herhangi 3 rakam (örn: 123)
- **Son Kullanma:** Gelecekteki herhangi bir tarih (örn: 12/25)
- **Posta Kodu:** Herhangi bir kod (örn: 12345)

### Test Adımları:

1. ✅ Uygulamayı başlatın
2. ✅ Sepete ürün ekleyin
3. ✅ Checkout'a gidin
4. ✅ Adres seçin
5. ✅ Payment ekranına gidin
6. ✅ Test kartı bilgilerini girin
7. ✅ "Öde" butonuna tıklayın
8. ✅ Ödeme başarılı mesajını görün
9. ✅ Sipariş oluşturulduğunu kontrol edin

---

## 📊 STRIPE DASHBOARD

### Ödemeleri Görüntüleme:

1. https://dashboard.stripe.com/test/payments
2. Son ödemeleri göreceksiniz
3. Her ödemeye tıklayarak detayları görebilirsiniz

### Webhook'lar (Opsiyonel):

```bash
# Webhook endpoint oluşturun
# Dashboard → Developers → Webhooks → Add endpoint

# Endpoint URL:
https://your-project-ref.supabase.co/functions/v1/stripe-webhook

# Events to send:
- payment_intent.succeeded
- payment_intent.payment_failed
- charge.refunded
```

---

## 🔒 PRODUCTION'A GEÇME

### 1. Live API Anahtarlarını Alın

```bash
# Stripe Dashboard → Developers → API keys
# Toggle: Test mode → Live mode
# Anahtarları kopyalayın:
#   - Live Publishable key: pk_live_...
#   - Live Secret key: sk_live_...
```

### 2. Environment Variables Güncelleyin

```bash
# .env dosyasını güncelleyin
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key_here

# Supabase secrets güncelleyin
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_live_secret_key_here
```

### 3. Stripe Hesabını Aktive Edin

```bash
# Dashboard → Settings → Account details
# İş bilgilerini doldurun
# Banka hesabı ekleyin
# Kimlik doğrulama yapın
```

---

## 💡 İPUÇLARI

### Güvenlik:
- ✅ Secret key'i asla frontend'de kullanmayın
- ✅ HTTPS kullanın (production'da zorunlu)
- ✅ Webhook signature'ları doğrulayın
- ✅ Ödeme tutarlarını backend'de kontrol edin

### Performans:
- ✅ Payment Intent'i önceden oluşturun
- ✅ Hata durumlarını handle edin
- ✅ Loading state'leri gösterin
- ✅ Timeout ayarlayın

### Kullanıcı Deneyimi:
- ✅ Kart bilgilerini otomatik formatlayın
- ✅ Hata mesajlarını açık yazın
- ✅ Başarı animasyonu gösterin
- ✅ Ödeme geçmişini gösterin

---

## 📞 DESTEK

### Stripe Dokümantasyon:
- https://stripe.com/docs
- https://stripe.com/docs/payments/accept-a-payment

### Stripe React Native:
- https://stripe.com/docs/payments/accept-a-payment?platform=react-native

### Supabase Edge Functions:
- https://supabase.com/docs/guides/functions

---

## ✅ TAMAMLANDI!

Artık Stripe ödeme sistemi entegre edildi! 🎉

**Sonraki Adımlar:**
1. ✅ Test kartları ile test edin
2. ✅ Hata durumlarını test edin
3. ✅ UI/UX iyileştirmeleri yapın
4. ✅ Production'a geçin

---

Devam etmek için hazır mısınız? 🚀

