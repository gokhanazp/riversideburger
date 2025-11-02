-- Ürün Özelleştirme Sistemi (Product Customization System)
-- Bu dosya ürün özelleştirme için gerekli tabloları oluşturur

-- 1. Ürün seçenek kategorileri tablosu (Product option categories)
-- Örnek: "Ekstra Malzemeler", "Soslar", "Pişirme Tercihi"
CREATE TABLE IF NOT EXISTS product_option_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ürün seçenekleri tablosu (Product options)
-- Örnek: "Cheddar Peyniri", "BBQ Sos", "Az Pişmiş"
CREATE TABLE IF NOT EXISTS product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES product_option_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description TEXT,
  price DECIMAL(10, 2) DEFAULT 0.00, -- Ekstra ücret (Extra charge)
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ürün-Seçenek ilişkisi tablosu (Product-Option relationship)
-- Hangi ürünlerde hangi seçenekler mevcut
CREATE TABLE IF NOT EXISTS product_available_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_option_categories(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false, -- Zorunlu mu? (Is required?)
  max_selections INTEGER, -- Maksimum seçim sayısı (Max selections, NULL = unlimited)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Sipariş ürün özelleştirmeleri tablosu (Order item customizations)
-- Müşterinin seçtiği özelleştirmeler
CREATE TABLE IF NOT EXISTS order_item_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL, -- Ürün adı (snapshot)
  option_id UUID REFERENCES product_options(id) ON DELETE SET NULL,
  option_name VARCHAR(100) NOT NULL, -- Seçenek adı (snapshot)
  option_price DECIMAL(10, 2) DEFAULT 0.00, -- Seçenek fiyatı (snapshot)
  quantity INTEGER DEFAULT 1,
  special_instructions TEXT, -- Özel notlar (Special notes)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes oluştur (Create indexes)
CREATE INDEX IF NOT EXISTS idx_product_options_category ON product_options(category_id);
CREATE INDEX IF NOT EXISTS idx_product_available_options_product ON product_available_options(product_id);
CREATE INDEX IF NOT EXISTS idx_product_available_options_category ON product_available_options(category_id);
CREATE INDEX IF NOT EXISTS idx_order_item_customizations_order ON order_item_customizations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_customizations_product ON order_item_customizations(product_id);

-- 6. Updated_at trigger'ları ekle (Add updated_at triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_option_categories_updated_at ON product_option_categories;
CREATE TRIGGER update_product_option_categories_updated_at
  BEFORE UPDATE ON product_option_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_options_updated_at ON product_options;
CREATE TRIGGER update_product_options_updated_at
  BEFORE UPDATE ON product_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS Policies (Row Level Security)
ALTER TABLE product_option_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_available_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_customizations ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (Everyone can read)
DROP POLICY IF EXISTS "Public read access for product_option_categories" ON product_option_categories;
CREATE POLICY "Public read access for product_option_categories"
  ON product_option_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read access for product_options" ON product_options;
CREATE POLICY "Public read access for product_options"
  ON product_options FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read access for product_available_options" ON product_available_options;
CREATE POLICY "Public read access for product_available_options"
  ON product_available_options FOR SELECT
  USING (true);

-- Sadece adminler yazabilir (Only admins can write)
DROP POLICY IF EXISTS "Admin full access for product_option_categories" ON product_option_categories;
CREATE POLICY "Admin full access for product_option_categories"
  ON product_option_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin full access for product_options" ON product_options;
CREATE POLICY "Admin full access for product_options"
  ON product_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin full access for product_available_options" ON product_available_options;
CREATE POLICY "Admin full access for product_available_options"
  ON product_available_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Kullanıcılar kendi siparişlerinin özelleştirmelerini görebilir
DROP POLICY IF EXISTS "Users can read their own order customizations" ON order_item_customizations;
CREATE POLICY "Users can read their own order customizations"
  ON order_item_customizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_item_customizations.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Kullanıcılar kendi siparişlerine özelleştirme ekleyebilir
DROP POLICY IF EXISTS "Users can insert their own order customizations" ON order_item_customizations;
CREATE POLICY "Users can insert their own order customizations"
  ON order_item_customizations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_item_customizations.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Adminler tüm özelleştirmeleri görebilir
DROP POLICY IF EXISTS "Admin full access for order_item_customizations" ON order_item_customizations;
CREATE POLICY "Admin full access for order_item_customizations"
  ON order_item_customizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 8. Örnek veriler ekle (Insert sample data)

-- Kategoriler (Categories)
INSERT INTO product_option_categories (name, name_en, description, display_order) VALUES
  ('Ekstra Malzemeler', 'Extra Ingredients', 'Burgerinize ekstra malzeme ekleyin', 1),
  ('Soslar', 'Sauces', 'Favori sosunuzu seçin', 2),
  ('Çıkarılacak Malzemeler', 'Remove Ingredients', 'İstemediğiniz malzemeleri çıkarın', 3),
  ('Pişirme Tercihi', 'Cooking Preference', 'Etin pişme derecesini seçin', 4)
ON CONFLICT DO NOTHING;

-- Ekstra Malzemeler (Extra Ingredients)
INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Cheddar Peyniri',
  'Cheddar Cheese',
  2.00,
  1
FROM product_option_categories WHERE name = 'Ekstra Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Mozzarella Peyniri',
  'Mozzarella Cheese',
  2.50,
  2
FROM product_option_categories WHERE name = 'Ekstra Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Bacon',
  'Bacon',
  3.00,
  3
FROM product_option_categories WHERE name = 'Ekstra Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Avokado',
  'Avocado',
  3.50,
  4
FROM product_option_categories WHERE name = 'Ekstra Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Mantar',
  'Mushroom',
  2.00,
  5
FROM product_option_categories WHERE name = 'Ekstra Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Soğan Halkası',
  'Onion Rings',
  2.50,
  6
FROM product_option_categories WHERE name = 'Ekstra Malzemeler'
ON CONFLICT DO NOTHING;

-- Soslar (Sauces)
INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'BBQ Sos',
  'BBQ Sauce',
  0.00,
  1
FROM product_option_categories WHERE name = 'Soslar'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Ranch Sos',
  'Ranch Sauce',
  0.00,
  2
FROM product_option_categories WHERE name = 'Soslar'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Mayonez',
  'Mayonnaise',
  0.00,
  3
FROM product_option_categories WHERE name = 'Soslar'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Hardal',
  'Mustard',
  0.00,
  4
FROM product_option_categories WHERE name = 'Soslar'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Acı Sos',
  'Hot Sauce',
  0.00,
  5
FROM product_option_categories WHERE name = 'Soslar'
ON CONFLICT DO NOTHING;

-- Çıkarılacak Malzemeler (Remove Ingredients)
INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Turşu Çıkar',
  'No Pickles',
  0.00,
  1
FROM product_option_categories WHERE name = 'Çıkarılacak Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Soğan Çıkar',
  'No Onions',
  0.00,
  2
FROM product_option_categories WHERE name = 'Çıkarılacak Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Domates Çıkar',
  'No Tomatoes',
  0.00,
  3
FROM product_option_categories WHERE name = 'Çıkarılacak Malzemeler'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Marul Çıkar',
  'No Lettuce',
  0.00,
  4
FROM product_option_categories WHERE name = 'Çıkarılacak Malzemeler'
ON CONFLICT DO NOTHING;

-- Pişirme Tercihi (Cooking Preference)
INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Az Pişmiş (Rare)',
  'Rare',
  0.00,
  1
FROM product_option_categories WHERE name = 'Pişirme Tercihi'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'Orta Pişmiş (Medium)',
  'Medium',
  0.00,
  2
FROM product_option_categories WHERE name = 'Pişirme Tercihi'
ON CONFLICT DO NOTHING;

INSERT INTO product_options (category_id, name, name_en, price, display_order)
SELECT 
  id,
  'İyi Pişmiş (Well Done)',
  'Well Done',
  0.00,
  3
FROM product_option_categories WHERE name = 'Pişirme Tercihi'
ON CONFLICT DO NOTHING;

-- ✅ Tamamlandı!
-- Artık ürünlere özelleştirme seçenekleri ekleyebilirsiniz

