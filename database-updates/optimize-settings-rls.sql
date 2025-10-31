-- Settings RLS Politikalarını Optimize Et (Optimize Settings RLS Policies)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Eski politikaları sil (Drop old policies)
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;
DROP POLICY IF EXISTS "Public can view settings" ON settings;

-- 2. Yeni optimize edilmiş politikalar (New optimized policies)

-- Herkes ayarları okuyabilir (Everyone can read settings)
-- Çünkü ayarlar public bilgi (min order amount, delivery fee, etc.)
CREATE POLICY "Anyone can view settings"
  ON settings FOR SELECT
  USING (true);

-- Sadece admin kullanıcılar güncelleyebilir (Only admins can update)
CREATE POLICY "Only admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- 3. Index ekle (Add index for faster queries)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(id, role);

-- Başarılı mesajı
DO $$ 
BEGIN
  RAISE NOTICE '✅ Settings RLS politikalari optimize edildi!';
  RAISE NOTICE '⚡ Artik cok daha hizli calisacak!';
END $$;

