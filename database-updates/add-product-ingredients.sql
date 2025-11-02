-- Ürünlere malzeme listesi ekle (Add ingredients list to products)

-- 1. Products tablosuna ingredients kolonu ekle
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS ingredients TEXT[];

-- 2. Örnek ürünlere malzeme ekle (Add ingredients to sample products)

-- Burger ürünlerine malzeme ekle
UPDATE products 
SET ingredients = ARRAY['Et', 'Peynir', 'Marul', 'Domates', 'Soğan', 'Turşu', 'Sos']
WHERE category = 'burger' AND ingredients IS NULL;

-- Pizza ürünlerine malzeme ekle
UPDATE products 
SET ingredients = ARRAY['Hamur', 'Domates Sosu', 'Mozzarella', 'Zeytin', 'Mantar', 'Biber']
WHERE category = 'pizza' AND ingredients IS NULL;

-- Pasta ürünlerine malzeme ekle
UPDATE products 
SET ingredients = ARRAY['Makarna', 'Sos', 'Parmesan', 'Fesleğen']
WHERE category = 'pasta' AND ingredients IS NULL;

-- Salata ürünlerine malzeme ekle
UPDATE products 
SET ingredients = ARRAY['Marul', 'Domates', 'Salatalık', 'Soğan', 'Zeytin', 'Sos']
WHERE category = 'salad' AND ingredients IS NULL;

-- ✅ Tamamlandı!
-- Artık ürünlere malzeme listesi ekleyebilirsiniz

