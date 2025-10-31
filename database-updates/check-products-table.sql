-- Products Tablosu Kontrol ve Düzeltme (Check and Fix Products Table)
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

-- 2. Eksik kolonları ekle (Add missing columns if they don't exist)

-- is_featured kolonu yoksa ekle (Add is_featured column if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT false;
    RAISE NOTICE 'is_featured kolonu eklendi';
  ELSE
    RAISE NOTICE 'is_featured kolonu zaten mevcut';
  END IF;
END $$;

-- stock_status kolonu yoksa ekle (Add stock_status column if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'stock_status'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_status TEXT DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'out_of_stock'));
    RAISE NOTICE 'stock_status kolonu eklendi';
  ELSE
    RAISE NOTICE 'stock_status kolonu zaten mevcut';
  END IF;
END $$;

-- 3. Tüm ürünleri listele (List all products)
SELECT
  id,
  name,
  category,
  price,
  stock_status,
  is_featured,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;

-- Başarılı mesajı
DO $$
BEGIN
  RAISE NOTICE 'Products tablosu kontrol edildi ve güncellendi!';
END $$;

