-- orders tablosundaki eksik ödeme kolonları — SİPARİŞ OLUŞTURMAYI TAMAMEN BLOKLUYORDU
--
-- Sebep: database-updates/stripe-payments.sql elle (dashboard SQL editor) uygulanıyor ve
-- sadece kısmen çalışmış — `payments` tablosu oluşmuş ama `orders`'a eklenecek üç kolon
-- eklenmemiş. Uygulama 2026-07-15'ten beri (commit 8a60ca1) her siparişte payment_status
-- ve paid_at yazmaya çalışıyor; kolonlar olmadığı için PostgREST insert'i tümden
-- reddediyor. Sonuç: 2026-07-14'ten sonra hiç sipariş oluşmadı, admin panele düşmedi,
-- Uber'e dispatch edilmedi — buna karşılık Stripe tarafında ödemeler alındı.
--
-- Bu migration o kısmı takip edilebilir hale getirir (artık elle SQL gerekmez).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Kısıt adı bilinçli olarak 'valid_payment_status' DEĞİL: o ad payments tablosunun
-- inline kısıtı tarafından zaten kullanılıyor. stripe-payments.sql'deki DO bloğu
-- pg_constraint'te bu ada global baktığı için kısıtı hep "var" sanıp atlıyordu.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_status_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

COMMENT ON COLUMN orders.payment_status IS 'pending | paid | failed | refunded — paid yalnızca sunucu doğrulamalı Stripe succeeded ile';
COMMENT ON COLUMN orders.paid_at IS 'Ödemenin doğrulandığı an (payment_status = paid olduğunda)';
