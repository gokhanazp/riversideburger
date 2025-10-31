-- Puan Sistemi ve Sipariş Geçmişi Güncellemeleri
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Users tablosuna puan kolonu ekle (Add points column to users table)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS points DECIMAL(10,2) DEFAULT 0.00;

-- 2. Settings tablosu oluştur (Create settings table for admin configurations)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Puan oranı ayarını ekle (Insert default points rate setting)
INSERT INTO settings (key, value, description) 
VALUES 
  ('points_rate', '5', 'Her 100 TL harcamada kazanılan puan yüzdesi (%)'),
  ('points_min_order', '50', 'Puan kazanmak için minimum sipariş tutarı (TL)')
ON CONFLICT (key) DO NOTHING;

-- 4. Orders tablosuna puan kolonları ekle (Add points columns to orders table)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS points_earned DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS points_used DECIMAL(10,2) DEFAULT 0.00;

-- 5. Points history tablosu oluştur (Create points history table)
CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  points DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'used', 'expired', 'admin_adjustment')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS Policies - Settings tablosu
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (Everyone can read)
CREATE POLICY "Settings are viewable by everyone" 
ON settings 
FOR SELECT 
USING (true);

-- Sadece adminler güncelleyebilir (Only admins can update)
CREATE POLICY "Only admins can update settings" 
ON settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 7. RLS Policies - Points History tablosu
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi puan geçmişini görebilir (Users can view their own points history)
CREATE POLICY "Users can view own points history" 
ON points_history 
FOR SELECT 
USING (auth.uid() = user_id);

-- Adminler tüm puan geçmişini görebilir (Admins can view all points history)
CREATE POLICY "Admins can view all points history" 
ON points_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Sistem puan ekleyebilir (System can insert points)
CREATE POLICY "System can insert points" 
ON points_history 
FOR INSERT 
WITH CHECK (true);

-- 8. Puan hesaplama fonksiyonu (Function to calculate points)
CREATE OR REPLACE FUNCTION calculate_points_earned(order_total DECIMAL, points_rate DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  -- Her 100 TL'de points_rate kadar puan
  RETURN ROUND((order_total / 100) * points_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- 9. Sipariş oluşturulduğunda puan ekleyen trigger
CREATE OR REPLACE FUNCTION add_points_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_points_rate DECIMAL;
  v_min_order DECIMAL;
  v_points_earned DECIMAL;
BEGIN
  -- Ayarları al (Get settings)
  SELECT value::DECIMAL INTO v_points_rate FROM settings WHERE key = 'points_rate';
  SELECT value::DECIMAL INTO v_min_order FROM settings WHERE key = 'points_min_order';
  
  -- Eğer sipariş tamamlandıysa ve minimum tutarı geçtiyse puan ekle
  IF NEW.status = 'delivered' AND NEW.total_amount >= v_min_order THEN
    -- Puan hesapla
    v_points_earned := calculate_points_earned(NEW.total_amount, v_points_rate);
    
    -- Kullanıcıya puan ekle
    UPDATE users 
    SET points = points + v_points_earned 
    WHERE id = NEW.user_id;
    
    -- Puan geçmişine ekle
    INSERT INTO points_history (user_id, order_id, points, type, description)
    VALUES (
      NEW.user_id, 
      NEW.id, 
      v_points_earned, 
      'earned', 
      'Sipariş #' || NEW.id || ' için kazanılan puan'
    );
    
    -- Order'a kazanılan puanı kaydet
    NEW.points_earned := v_points_earned;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_add_points_on_order ON orders;
CREATE TRIGGER trigger_add_points_on_order
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION add_points_on_order();

-- 10. İndexler (Indexes for performance)
CREATE INDEX IF NOT EXISTS idx_points_history_user_id ON points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_points_history_created_at ON points_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at DESC);

-- 11. Updated_at trigger'ı settings için
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Başarılı mesajı
DO $$
BEGIN
  RAISE NOTICE 'Puan sistemi basariyla kuruldu!';
  RAISE NOTICE 'Varsayilan ayarlar:';
  RAISE NOTICE '   - Puan orani: 5 puan (Her 100 TL de 5 puan)';
  RAISE NOTICE '   - Minimum siparis: 50 TL';
END $$;

