-- Remove currency column from products table
-- Para birimi kolonunu kaldır (Remove currency column)

-- Drop the currency column
ALTER TABLE products 
DROP COLUMN IF EXISTS currency;

-- Comment
COMMENT ON TABLE products IS 'Products table - prices are displayed with currency symbol based on user country selection';

