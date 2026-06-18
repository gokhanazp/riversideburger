-- Add optional calories (kcal) to products
-- Ürünlere opsiyonel kalori (kcal) bilgisi ekle
-- NULL bırakılırsa ürün detayında gösterilmez (hidden when NULL)

ALTER TABLE products ADD COLUMN IF NOT EXISTS calories INTEGER;

COMMENT ON COLUMN products.calories IS 'Energy in kcal; shown on the product detail screen only when set (NULL = hidden)';
