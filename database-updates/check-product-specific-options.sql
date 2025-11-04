-- Ürün Bazlı Seçenekleri Kontrol Et (Check Product-Specific Options)

-- 1. Tablo var mı kontrol et (Check if table exists)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'product_specific_options'
) AS table_exists;

-- 2. Tablodaki tüm kayıtları göster (Show all records)
SELECT 
  pso.id,
  p.name AS product_name,
  po.name AS option_name,
  po.price AS option_price,
  poc.name AS category_name,
  pso.is_required,
  pso.is_default,
  pso.created_at
FROM product_specific_options pso
JOIN products p ON pso.product_id = p.id
JOIN product_options po ON pso.option_id = po.id
JOIN product_option_categories poc ON po.category_id = poc.id
ORDER BY p.name, poc.display_order, po.display_order;

-- 3. Ürün başına seçenek sayısı (Option count per product)
SELECT 
  p.name AS product_name,
  COUNT(pso.id) AS option_count
FROM products p
LEFT JOIN product_specific_options pso ON p.id = pso.product_id
GROUP BY p.id, p.name
ORDER BY option_count DESC, p.name;

-- 4. Kategori başına seçenek sayısı (Option count per category)
SELECT 
  poc.name AS category_name,
  COUNT(DISTINCT po.id) AS total_options,
  COUNT(DISTINCT pso.id) AS assigned_options
FROM product_option_categories poc
LEFT JOIN product_options po ON poc.id = po.category_id
LEFT JOIN product_specific_options pso ON po.id = pso.option_id
GROUP BY poc.id, poc.name
ORDER BY poc.display_order;

