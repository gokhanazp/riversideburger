-- Add Working Hours to Settings Table
-- Çalışma saatleri ekle

-- 1. Working hours JSON field ekle (Add working hours JSON field)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
  "monday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "tuesday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "wednesday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "thursday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "friday": {"enabled": true, "open": "09:00", "close": "23:00"},
  "saturday": {"enabled": true, "open": "10:00", "close": "23:00"},
  "sunday": {"enabled": true, "open": "10:00", "close": "22:00"}
}'::jsonb;

-- 2. Auto close enabled field ekle (Add auto close enabled field)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS auto_close_enabled BOOLEAN DEFAULT false;

-- 3. Mevcut kayıtları güncelle (Update existing records)
UPDATE settings 
SET working_hours = '{
  "monday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "tuesday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "wednesday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "thursday": {"enabled": true, "open": "09:00", "close": "22:00"},
  "friday": {"enabled": true, "open": "09:00", "close": "23:00"},
  "saturday": {"enabled": true, "open": "10:00", "close": "23:00"},
  "sunday": {"enabled": true, "open": "10:00", "close": "22:00"}
}'::jsonb,
auto_close_enabled = false
WHERE working_hours IS NULL;

-- 4. Mevcut ayarları göster (Show current settings)
SELECT 
  id,
  points_percentage,
  min_order_amount,
  delivery_fee,
  free_delivery_threshold,
  is_open,
  auto_close_enabled,
  working_hours,
  created_at,
  updated_at
FROM settings;

-- Başarılı mesajı
DO $$ 
BEGIN
  RAISE NOTICE '✅ Working hours eklendi!';
  RAISE NOTICE '📅 Varsayilan calisma saatleri:';
  RAISE NOTICE '   - Pazartesi-Persembe: 09:00 - 22:00';
  RAISE NOTICE '   - Cuma: 09:00 - 23:00';
  RAISE NOTICE '   - Cumartesi: 10:00 - 23:00';
  RAISE NOTICE '   - Pazar: 10:00 - 22:00';
  RAISE NOTICE '   - Otomatik kapanma: Kapali';
END $$;

