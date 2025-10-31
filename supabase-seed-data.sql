-- Riverside Burgers Test Data
-- Bu SQL'i şema oluşturduktan sonra çalıştırın

-- Kategoriler ekle (Insert categories)
INSERT INTO categories (name, name_en, icon, "order", is_active) VALUES
('Pizza', 'Pizza', 'pizza', 1, true),
('Burger', 'Burger', 'fast-food', 2, true),
('Makarna', 'Pasta', 'restaurant', 3, true),
('Salata', 'Salad', 'leaf', 4, true),
('Tatlı', 'Dessert', 'ice-cream', 5, true),
('İçecek', 'Drink', 'cafe', 6, true);

-- Ürünler ekle (Insert products)
-- Pizza kategorisi
INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Margherita Pizza',
  'Klasik domates sosu, mozzarella peyniri ve fesleğen',
  89.90,
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
  20,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Pizza';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Pepperoni Pizza',
  'Domates sosu, mozzarella ve bol pepperoni',
  99.90,
  'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400',
  20,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Pizza';

-- Burger kategorisi
INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Double Riverside Burger',
  'Çift köfte, cheddar peyniri, marul, domates, özel sos',
  119.90,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
  15,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Burger';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Classic Burger',
  'Tek köfte, cheddar peyniri, marul, domates, turşu',
  89.90,
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400',
  15,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Burger';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Cheese Burger',
  'Köfte, çift cheddar peyniri, soğan, özel sos',
  99.90,
  'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400',
  15,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Burger';

-- Makarna kategorisi
INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Fettuccine Alfredo',
  'Kremalı alfredo sosu, parmesan peyniri',
  79.90,
  'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400',
  18,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Pasta';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Spaghetti Bolognese',
  'Kıymalı domates sosu, parmesan peyniri',
  74.90,
  'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400',
  18,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Pasta';

-- Salata kategorisi
INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Caesar Salad',
  'Marul, kruton, parmesan, caesar sos',
  64.90,
  'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400',
  10,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Salad';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Greek Salad',
  'Domates, salatalık, zeytin, beyaz peynir',
  59.90,
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400',
  10,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Salad';

-- Tatlı kategorisi
INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Chocolate Brownie',
  'Sıcak brownie, vanilyalı dondurma',
  49.90,
  'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=400',
  12,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Dessert';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Cheesecake',
  'New York usulü cheesecake, çilek sosu',
  54.90,
  'https://images.unsplash.com/photo-1533134486753-c833f0ed4866?w=400',
  5,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Dessert';

-- İçecek kategorisi
INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Coca Cola',
  '330ml kutu',
  15.00,
  'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',
  2,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Drink';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Fresh Orange Juice',
  'Taze sıkılmış portakal suyu',
  29.90,
  'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400',
  5,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Drink';

INSERT INTO products (category_id, name, description, price, image_url, preparation_time, is_active, stock_status) 
SELECT 
  id,
  'Lemonade',
  'Ev yapımı limonata',
  24.90,
  'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?w=400',
  5,
  true,
  'in_stock'
FROM categories WHERE name_en = 'Drink';

