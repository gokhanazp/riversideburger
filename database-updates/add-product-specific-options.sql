-- Ürün Bazlı Spesifik Seçenek Sistemi (Product-Specific Option System)
-- Bu dosya ürünlere spesifik seçeneklerin atanmasını sağlar

-- 1. Ürün-Seçenek ilişkisi tablosu (Product-Option relationship)
-- Hangi ürünlerde hangi spesifik seçenekler mevcut
CREATE TABLE IF NOT EXISTS product_specific_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_id UUID REFERENCES product_options(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false, -- Bu seçenek zorunlu mu? (Is this option required?)
  is_default BOOLEAN DEFAULT false, -- Varsayılan olarak seçili mi? (Is selected by default?)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, option_id) -- Aynı ürüne aynı seçenek birden fazla eklenemez
);

-- 2. Index'ler (Indexes)
CREATE INDEX IF NOT EXISTS idx_product_specific_options_product_id 
  ON product_specific_options(product_id);

CREATE INDEX IF NOT EXISTS idx_product_specific_options_option_id 
  ON product_specific_options(option_id);

-- 3. RLS (Row Level Security) Politikaları
ALTER TABLE product_specific_options ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (Everyone can read)
CREATE POLICY "Anyone can view product specific options"
  ON product_specific_options FOR SELECT
  USING (true);

-- Sadece admin ekleyebilir (Only admin can insert)
CREATE POLICY "Only admin can insert product specific options"
  ON product_specific_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Sadece admin güncelleyebilir (Only admin can update)
CREATE POLICY "Only admin can update product specific options"
  ON product_specific_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Sadece admin silebilir (Only admin can delete)
CREATE POLICY "Only admin can delete product specific options"
  ON product_specific_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 4. Örnek Veri (Sample Data)
-- Not: Bu kısım isteğe bağlı, test için kullanılabilir

-- Örnek: Classic Burger için ekstra malzemeler
-- INSERT INTO product_specific_options (product_id, option_id, is_required, is_default)
-- SELECT 
--   (SELECT id FROM products WHERE name = 'Classic Burger' LIMIT 1),
--   id,
--   false,
--   false
-- FROM product_options
-- WHERE category_id = (SELECT id FROM product_option_categories WHERE name = 'Ekstra Malzemeler' LIMIT 1);

-- 5. Trigger: updated_at otomatik güncelleme (Auto-update updated_at)
-- Not: Eğer updated_at kolonu eklenirse bu trigger kullanılabilir
-- CREATE OR REPLACE FUNCTION update_product_specific_options_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trigger_update_product_specific_options_updated_at
--   BEFORE UPDATE ON product_specific_options
--   FOR EACH ROW
--   EXECUTE FUNCTION update_product_specific_options_updated_at();

-- 6. Yardımcı View: Ürün seçeneklerini kategorilere göre grupla
CREATE OR REPLACE VIEW product_options_grouped AS
SELECT 
  pso.product_id,
  poc.id as category_id,
  poc.name as category_name,
  poc.name_en as category_name_en,
  poc.display_order as category_order,
  po.id as option_id,
  po.name as option_name,
  po.name_en as option_name_en,
  po.price as option_price,
  po.display_order as option_order,
  pso.is_required,
  pso.is_default
FROM product_specific_options pso
JOIN product_options po ON pso.option_id = po.id
JOIN product_option_categories poc ON po.category_id = poc.id
WHERE po.is_active = true AND poc.is_active = true
ORDER BY pso.product_id, poc.display_order, po.display_order;

-- 7. Yardımcı Fonksiyon: Ürün için tüm seçenekleri getir
CREATE OR REPLACE FUNCTION get_product_options(p_product_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_name_en TEXT,
  option_id UUID,
  option_name TEXT,
  option_name_en TEXT,
  option_price DECIMAL,
  is_required BOOLEAN,
  is_default BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    poc.id,
    poc.name,
    poc.name_en,
    po.id,
    po.name,
    po.name_en,
    po.price,
    pso.is_required,
    pso.is_default
  FROM product_specific_options pso
  JOIN product_options po ON pso.option_id = po.id
  JOIN product_option_categories poc ON po.category_id = poc.id
  WHERE pso.product_id = p_product_id
    AND po.is_active = true
    AND poc.is_active = true
  ORDER BY poc.display_order, po.display_order;
END;
$$ LANGUAGE plpgsql;

-- 8. Yardımcı Fonksiyon: Kategoriye göre ürün seçeneklerini getir
CREATE OR REPLACE FUNCTION get_product_options_by_category(
  p_product_id UUID,
  p_category_id UUID
)
RETURNS TABLE (
  option_id UUID,
  option_name TEXT,
  option_name_en TEXT,
  option_price DECIMAL,
  is_required BOOLEAN,
  is_default BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.name,
    po.name_en,
    po.price,
    pso.is_required,
    pso.is_default
  FROM product_specific_options pso
  JOIN product_options po ON pso.option_id = po.id
  WHERE pso.product_id = p_product_id
    AND po.category_id = p_category_id
    AND po.is_active = true
  ORDER BY po.display_order;
END;
$$ LANGUAGE plpgsql;

-- 9. Kullanım Örnekleri (Usage Examples)
-- 
-- Ürün için tüm seçenekleri getir:
-- SELECT * FROM get_product_options('product-uuid-here');
--
-- Kategoriye göre seçenekleri getir:
-- SELECT * FROM get_product_options_by_category('product-uuid-here', 'category-uuid-here');
--
-- View'den veri çek:
-- SELECT * FROM product_options_grouped WHERE product_id = 'product-uuid-here';

