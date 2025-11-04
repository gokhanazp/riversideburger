-- Create menu_categories table
-- Menü kategorileri tablosu oluştur

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_tr VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'fast-food-outline',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
-- Varsayılan kategorileri ekle
INSERT INTO menu_categories (name_tr, name_en, icon, display_order, is_active) VALUES
  ('Burgerler', 'Burgers', 'fast-food-outline', 1, true),
  ('Tavuk', 'Chicken', 'restaurant-outline', 2, true),
  ('Salatalar', 'Salads', 'leaf-outline', 3, true),
  ('İçecekler', 'Beverages', 'cafe-outline', 4, true),
  ('Tatlılar', 'Desserts', 'ice-cream-outline', 5, true),
  ('Yan Ürünler', 'Sides', 'pizza-outline', 6, true)
ON CONFLICT DO NOTHING;

-- Add category_id to products table
-- Ürünler tablosuna kategori ID ekle
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL;

-- Create index for better performance
-- Performans için index oluştur
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_display_order ON menu_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_menu_categories_is_active ON menu_categories(is_active);

-- Enable Row Level Security (RLS)
-- Satır düzeyinde güvenliği etkinleştir
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

-- Create policy: Everyone can read active categories
-- Herkes aktif kategorileri okuyabilir
CREATE POLICY "Anyone can read active menu categories"
  ON menu_categories
  FOR SELECT
  USING (is_active = true OR auth.role() = 'authenticated');

-- Create policy: Only authenticated users can insert categories
-- Sadece giriş yapmış kullanıcılar kategori ekleyebilir
CREATE POLICY "Authenticated users can insert menu categories"
  ON menu_categories
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create policy: Only authenticated users can update categories
-- Sadece giriş yapmış kullanıcılar kategori güncelleyebilir
CREATE POLICY "Authenticated users can update menu categories"
  ON menu_categories
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create policy: Only authenticated users can delete categories
-- Sadece giriş yapmış kullanıcılar kategori silebilir
CREATE POLICY "Authenticated users can delete menu categories"
  ON menu_categories
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE menu_categories IS 'Menu categories managed by admin';
COMMENT ON COLUMN menu_categories.name_tr IS 'Category name in Turkish';
COMMENT ON COLUMN menu_categories.name_en IS 'Category name in English';
COMMENT ON COLUMN menu_categories.icon IS 'Ionicons icon name';
COMMENT ON COLUMN menu_categories.display_order IS 'Display order (lower numbers first)';
COMMENT ON COLUMN menu_categories.is_active IS 'Whether category is active and visible';

