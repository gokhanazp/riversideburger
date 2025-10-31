-- Settings Tablosu Düzelt (Fix Settings Table)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Mevcut settings tablosu yapısını kontrol et (Check current structure)
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'settings'
ORDER BY ordinal_position;

-- 2. Settings tablosunu yeniden oluştur (Recreate settings table)
DO $$ 
BEGIN
  -- Eski tabloyu sil (Drop old table if exists)
  DROP TABLE IF EXISTS settings CASCADE;
  
  -- Yeni tabloyu oluştur (Create new table)
  CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    points_percentage DECIMAL(5,2) DEFAULT 5.00 CHECK (points_percentage >= 0 AND points_percentage <= 100),
    min_order_amount DECIMAL(10,2) DEFAULT 50.00 CHECK (min_order_amount >= 0),
    delivery_fee DECIMAL(10,2) DEFAULT 15.00 CHECK (delivery_fee >= 0),
    free_delivery_threshold DECIMAL(10,2) DEFAULT 150.00 CHECK (free_delivery_threshold >= 0),
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  RAISE NOTICE '✅ Settings tablosu yeniden olusturuldu';
END $$;

-- 3. Varsayılan ayarları ekle (Insert default settings)
INSERT INTO settings (
  points_percentage,
  min_order_amount,
  delivery_fee,
  free_delivery_threshold,
  is_open
)
VALUES (5.00, 50.00, 15.00, 150.00, true);

-- 4. Updated_at trigger'ı oluştur (Create updated_at trigger)
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- 5. RLS (Row Level Security) politikalarını ayarla
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Admin kullanıcılar tüm işlemleri yapabilir (Admin users can do all operations)
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update settings" ON settings;
CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Herkes ayarları okuyabilir (Everyone can read settings - for public info)
DROP POLICY IF EXISTS "Public can view settings" ON settings;
CREATE POLICY "Public can view settings"
  ON settings FOR SELECT
  TO anon
  USING (true);

-- 6. Mevcut ayarları göster (Show current settings)
SELECT 
  id,
  points_percentage,
  min_order_amount,
  delivery_fee,
  free_delivery_threshold,
  is_open,
  created_at,
  updated_at
FROM settings;

-- Başarılı mesajı
DO $$ 
BEGIN
  RAISE NOTICE '✅ Settings tablosu basariyla olusturuldu!';
  RAISE NOTICE '📊 Varsayilan ayarlar:';
  RAISE NOTICE '   - Puan Yuzdesi: 5%%';
  RAISE NOTICE '   - Min Siparis: 50 TL';
  RAISE NOTICE '   - Teslimat Ucreti: 15 TL';
  RAISE NOTICE '   - Ucretsiz Teslimat: 150 TL';
  RAISE NOTICE '   - Restoran Durumu: Acik';
END $$;

