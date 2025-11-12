-- ============================================
-- STRIPE ÖDEME SİSTEMİ - DATABASE SCHEMA
-- Riverside Burgers - Stripe Payment Integration
-- ============================================

-- 1. Payments Tablosu (Payments Table)
-- Tüm ödeme işlemlerini saklar (Stores all payment transactions)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stripe bilgileri (Stripe information)
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  stripe_customer_id TEXT, -- Müşteri ID'si (Customer ID)
  
  -- Ödeme bilgileri (Payment information)
  amount DECIMAL(10, 2) NOT NULL, -- Ödenen tutar (Amount paid)
  currency TEXT NOT NULL DEFAULT 'CAD', -- Para birimi (Currency: CAD, TRY)
  status TEXT NOT NULL DEFAULT 'pending', -- Ödeme durumu (Payment status)
  payment_method TEXT, -- Ödeme yöntemi (card, apple_pay, google_pay)
  
  -- Kart bilgileri (Card information - sadece son 4 hane)
  card_brand TEXT, -- Kart markası (visa, mastercard, amex, discover)
  card_last4 TEXT, -- Son 4 hane (Last 4 digits)
  card_exp_month INTEGER, -- Son kullanma ayı (Expiry month)
  card_exp_year INTEGER, -- Son kullanma yılı (Expiry year)
  
  -- Hata bilgileri (Error information)
  error_message TEXT,
  error_code TEXT,
  
  -- Metadata
  metadata JSONB, -- Ek bilgiler (Additional information)
  
  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE, -- Ödeme tarihi (Payment date)
  
  -- Status kontrolü (Status validation)
  CONSTRAINT valid_payment_status CHECK (status IN (
    'pending',      -- Bekliyor (Waiting)
    'processing',   -- İşleniyor (Processing)
    'succeeded',    -- Başarılı (Successful)
    'failed',       -- Başarısız (Failed)
    'cancelled',    -- İptal edildi (Cancelled)
    'refunded'      -- İade edildi (Refunded)
  ))
);

-- 2. İndeksler (Indexes)
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_customer_id ON payments(stripe_customer_id);

-- 3. Orders Tablosuna Ödeme Alanları Ekleme
-- (Add payment fields to orders table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Payment status kontrolü (Payment status validation)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_payment_status'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT valid_payment_status 
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

-- 4. RLS Politikaları (RLS Policies)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi ödemelerini görebilir (Users can view their own payments)
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
ON payments FOR SELECT
USING (auth.uid() = user_id);

-- Admin'ler tüm ödemeleri görebilir (Admins can view all payments)
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments"
ON payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Sistem ödemeleri oluşturabilir (System can create payments)
DROP POLICY IF EXISTS "System can create payments" ON payments;
CREATE POLICY "System can create payments"
ON payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Sistem ödemeleri güncelleyebilir (System can update payments)
DROP POLICY IF EXISTS "System can update payments" ON payments;
CREATE POLICY "System can update payments"
ON payments FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Updated_at Trigger Fonksiyonu
-- (Trigger function for updated_at)
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur (Create trigger)
DROP TRIGGER IF EXISTS payments_updated_at_trigger ON payments;
CREATE TRIGGER payments_updated_at_trigger
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- 6. Ödeme Başarılı Olduğunda Sipariş Durumunu Güncelle
-- (Update order status when payment succeeds)
CREATE OR REPLACE FUNCTION update_order_on_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer ödeme başarılı olduysa (If payment succeeded)
  IF NEW.status = 'succeeded' AND OLD.status != 'succeeded' THEN
    -- Siparişi güncelle (Update order)
    UPDATE orders
    SET 
      payment_status = 'paid',
      payment_method = NEW.payment_method,
      paid_at = NEW.paid_at,
      status = CASE 
        WHEN status = 'pending' THEN 'confirmed'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;
  
  -- Eğer ödeme başarısız olduysa (If payment failed)
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    UPDATE orders
    SET 
      payment_status = 'failed',
      updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur (Create trigger)
DROP TRIGGER IF EXISTS payment_status_trigger ON payments;
CREATE TRIGGER payment_status_trigger
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_on_payment_success();

-- 7. Test Verisi (Test Data) - Sadece development için
-- UNCOMMENT ONLY FOR TESTING
/*
INSERT INTO payments (
  order_id,
  user_id,
  stripe_payment_intent_id,
  amount,
  currency,
  status,
  payment_method
) VALUES (
  (SELECT id FROM orders LIMIT 1),
  (SELECT id FROM users WHERE role = 'customer' LIMIT 1),
  'pi_test_' || gen_random_uuid()::text,
  50.00,
  'CAD',
  'succeeded',
  'card'
);
*/

-- ============================================
-- TAMAMLANDI! (COMPLETED!)
-- ============================================
-- Şimdi Supabase SQL Editor'de bu dosyayı çalıştırın
-- (Now run this file in Supabase SQL Editor)

