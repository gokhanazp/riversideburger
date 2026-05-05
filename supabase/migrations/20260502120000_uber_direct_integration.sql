-- Uber Direct Integration Migration
-- Creation Date: 2026-05-02
-- Adds:
--   1. lat/lng columns to addresses (for geocoded customer addresses)
--   2. Structured delivery snapshot + Uber Direct tracking columns on orders
--   3. Realtime publication for orders (idempotent)


-- ============================================================================
-- 1. addresses tablosuna lat/lng ekle (Add lat/lng to addresses)
-- LocationIQ ile geocode edilmiş müşteri adresinin koordinatları
-- ============================================================================

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);


-- ============================================================================
-- 2. orders tablosuna teslimat snapshot'ı ve Uber Direct kolonları ekle
--    (Structured delivery snapshot + Uber Direct tracking fields)
-- ============================================================================

ALTER TABLE orders
  -- Structured delivery address snapshot (sipariş anındaki teslimat adresi)
  -- Uber API yapılandırılmış adres istiyor: street, city, province, postal_code
  ADD COLUMN IF NOT EXISTS delivery_full_name      TEXT,
  ADD COLUMN IF NOT EXISTS delivery_street         TEXT,
  ADD COLUMN IF NOT EXISTS delivery_unit           TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city           TEXT,
  ADD COLUMN IF NOT EXISTS delivery_province       TEXT,
  ADD COLUMN IF NOT EXISTS delivery_postal_code    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country        TEXT DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS delivery_lat            NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS delivery_lng            NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS delivery_instructions   TEXT,

  -- Uber Direct delivery
  ADD COLUMN IF NOT EXISTS uber_delivery_id        TEXT,
  ADD COLUMN IF NOT EXISTS uber_quote_id           TEXT,
  ADD COLUMN IF NOT EXISTS uber_tracking_url       TEXT,
  ADD COLUMN IF NOT EXISTS uber_status             TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee            DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS delivery_currency       TEXT DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS pickup_eta              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dropoff_eta             TIMESTAMPTZ,

  -- Courier (kurye) bilgileri
  ADD COLUMN IF NOT EXISTS courier_name            TEXT,
  ADD COLUMN IF NOT EXISTS courier_phone           TEXT,
  ADD COLUMN IF NOT EXISTS courier_image_url       TEXT,
  ADD COLUMN IF NOT EXISTS courier_vehicle_make    TEXT,
  ADD COLUMN IF NOT EXISTS courier_vehicle_model   TEXT,
  ADD COLUMN IF NOT EXISTS courier_vehicle_color   TEXT,
  ADD COLUMN IF NOT EXISTS courier_license_plate   TEXT,
  ADD COLUMN IF NOT EXISTS courier_lat             NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS courier_lng             NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS courier_location_updated_at TIMESTAMPTZ,

  -- Webhook payload audit (debug + replay)
  ADD COLUMN IF NOT EXISTS uber_raw                JSONB;


-- ============================================================================
-- 3. uber_delivery_id'ye index (webhook lookups için)
--    (Index for webhook lookups by Uber delivery ID)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_uber_delivery_id
  ON orders(uber_delivery_id)
  WHERE uber_delivery_id IS NOT NULL;


-- ============================================================================
-- 4. orders tablosunu Realtime publication'a ekle (idempotent)
--    (Add orders to realtime publication if not already)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    RAISE NOTICE '✅ Realtime orders tablosu için etkinleştirildi';
  ELSE
    RAISE NOTICE 'ℹ️ Orders tablosu zaten Realtime publication''ında';
  END IF;
END $$;
