-- Add currency column to products table
-- Para birimi kolonu ekle (Add currency column)

-- Add currency column with default value TRY
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TRY' CHECK (currency IN ('TRY', 'CAD'));

-- Update existing products to have TRY currency
UPDATE products 
SET currency = 'TRY' 
WHERE currency IS NULL;

-- Make currency column NOT NULL
ALTER TABLE products 
ALTER COLUMN currency SET NOT NULL;

-- Add comment to column
COMMENT ON COLUMN products.currency IS 'Product price currency (TRY or CAD)';

