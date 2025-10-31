-- Banners Tablosu Oluştur (Create Banners Table)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Banners tablosunu oluştur (Create banners table)
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  button_text TEXT,
  button_link TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Varsayılan banner'ları ekle (Insert default banners)
INSERT INTO banners (title, subtitle, image_url, button_text, button_link, order_index, is_active)
VALUES 
  (
    'Welcome to Riverside Burgers',
    'Toronto''s Best Burgers Since 2010',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop',
    'Order Now',
    '/menu',
    1,
    true
  ),
  (
    'Fresh Ingredients Daily',
    'Made with love, served with care',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=400&fit=crop',
    'View Menu',
    '/menu',
    2,
    true
  ),
  (
    'Free Delivery Over $150',
    'Fast delivery to your door',
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&h=400&fit=crop',
    'Order Now',
    '/menu',
    3,
    true
  )
ON CONFLICT DO NOTHING;

-- 3. Updated_at trigger'ı oluştur (Create updated_at trigger)
CREATE OR REPLACE FUNCTION update_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banners_updated_at ON banners;
CREATE TRIGGER banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION update_banners_updated_at();

-- 4. RLS (Row Level Security) politikalarını ayarla
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Herkes aktif banner'ları görebilir (Everyone can view active banners)
DROP POLICY IF EXISTS "Anyone can view active banners" ON banners;
CREATE POLICY "Anyone can view active banners"
  ON banners FOR SELECT
  USING (is_active = true);

-- Admin kullanıcılar tüm banner'ları görebilir (Admins can view all banners)
DROP POLICY IF EXISTS "Admins can view all banners" ON banners;
CREATE POLICY "Admins can view all banners"
  ON banners FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin kullanıcılar banner ekleyebilir (Admins can insert banners)
DROP POLICY IF EXISTS "Admins can insert banners" ON banners;
CREATE POLICY "Admins can insert banners"
  ON banners FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin kullanıcılar banner güncelleyebilir (Admins can update banners)
DROP POLICY IF EXISTS "Admins can update banners" ON banners;
CREATE POLICY "Admins can update banners"
  ON banners FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin kullanıcılar banner silebilir (Admins can delete banners)
DROP POLICY IF EXISTS "Admins can delete banners" ON banners;
CREATE POLICY "Admins can delete banners"
  ON banners FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- 5. Index ekle (Add indexes for faster queries)
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, order_index);
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(order_index);

-- 6. Mevcut banner'ları göster (Show current banners)
SELECT 
  id,
  title,
  subtitle,
  image_url,
  button_text,
  order_index,
  is_active,
  created_at
FROM banners
ORDER BY order_index;

-- Başarılı mesajı
DO $$ 
BEGIN
  RAISE NOTICE '✅ Banners tablosu basariyla olusturuldu!';
  RAISE NOTICE '🎨 3 varsayilan banner eklendi';
  RAISE NOTICE '📊 RLS politikalari ayarlandi';
  RAISE NOTICE '⚡ Index''ler olusturuldu';
END $$;

