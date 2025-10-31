-- Supabase Storage bucket'ları oluştur (Create Supabase Storage buckets)
-- Ürün ve banner resimleri için storage bucket'ları

-- 1. Product images bucket oluştur (Create product images bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Banner images bucket oluştur (Create banner images bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banner-images',
  'banner-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 3. Eski policy'leri sil (Drop old policies if exist)
DROP POLICY IF EXISTS "Public Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for Banner Images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload for Banner Images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update for Banner Images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete for Banner Images" ON storage.objects;

-- 4. Product images için RLS policy'leri (RLS policies for product images)
-- Herkes okuyabilir (Everyone can read)
CREATE POLICY "Public Access for Product Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Sadece adminler yükleyebilir (Only admins can upload)
CREATE POLICY "Admin Upload for Product Images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Sadece adminler güncelleyebilir (Only admins can update)
CREATE POLICY "Admin Update for Product Images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Sadece adminler silebilir (Only admins can delete)
CREATE POLICY "Admin Delete for Product Images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Banner images için RLS policy'leri (RLS policies for banner images)
-- Herkes okuyabilir (Everyone can read)
CREATE POLICY "Public Access for Banner Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'banner-images');

-- Sadece adminler yükleyebilir (Only admins can upload)
CREATE POLICY "Admin Upload for Banner Images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banner-images'
  AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Sadece adminler güncelleyebilir (Only admins can update)
CREATE POLICY "Admin Update for Banner Images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'banner-images'
  AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Sadece adminler silebilir (Only admins can delete)
CREATE POLICY "Admin Delete for Banner Images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banner-images'
  AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Başarılı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Storage bucket''ları oluşturuldu!';
    RAISE NOTICE '✅ product-images bucket (5MB limit, jpeg/png/webp)';
    RAISE NOTICE '✅ banner-images bucket (5MB limit, jpeg/png/webp)';
    RAISE NOTICE '✅ RLS policy''leri eklendi (sadece adminler yükleyebilir)';
END $$;

