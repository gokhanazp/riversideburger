-- Products Tablosu Yapısını Düzelt (Fix Products Table Structure)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Mevcut tablo yapısını kontrol et (Check current table structure)
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 2. category kolonu ekle (category_id yerine category string kullanacağız)
DO $$ 
BEGIN
  -- category kolonu yoksa ekle (Add category column if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    ALTER TABLE products ADD COLUMN category TEXT;
    RAISE NOTICE 'category kolonu eklendi';
    
    -- Eğer category_id varsa, ona göre category değerlerini doldur
    -- (If category_id exists, populate category values based on it)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'category_id'
    ) THEN
      -- categories tablosundan category isimlerini al ve products'a yaz
      UPDATE products p
      SET category = c.name
      FROM categories c
      WHERE p.category_id = c.id;
      
      RAISE NOTICE 'category degerleri category_id''den dolduruldu';
    END IF;
  ELSE
    RAISE NOTICE 'category kolonu zaten mevcut';
  END IF;
  
  -- is_featured kolonu yoksa ekle (Add is_featured column if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT false;
    RAISE NOTICE 'is_featured kolonu eklendi';
  ELSE
    RAISE NOTICE 'is_featured kolonu zaten mevcut';
  END IF;
  
  -- stock_status kolonu yoksa ekle (Add stock_status column if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'stock_status'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_status TEXT DEFAULT 'in_stock';
    RAISE NOTICE 'stock_status kolonu eklendi';
  ELSE
    RAISE NOTICE 'stock_status kolonu zaten mevcut';
  END IF;
END $$;

-- 3. Tüm ürünleri listele (List all products)
SELECT 
  id,
  name,
  COALESCE(category, 'burger') as category,
  price,
  COALESCE(stock_status, 'in_stock') as stock_status,
  COALESCE(is_featured, false) as is_featured,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;

-- 4. Başarılı mesajı
DO $$ 
BEGIN
  RAISE NOTICE '✅ Products tablosu basariyla guncellendi!';
END $$;

