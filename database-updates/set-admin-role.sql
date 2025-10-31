-- Admin Rolü Ayarlama (Set Admin Role)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Kullanıcıyı admin yap (Set user as admin)
UPDATE users 
SET role = 'admin' 
WHERE email = 'gokhanyildirim1905@gmail.com';

-- 2. Kontrol et (Check if successful)
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM users 
WHERE email = 'gokhanyildirim1905@gmail.com';

-- Başarılı mesajı
DO $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM users WHERE email = 'gokhanyildirim1905@gmail.com';
  
  IF user_role = 'admin' THEN
    RAISE NOTICE 'Kullanici basariyla admin yapildi!';
  ELSE
    RAISE NOTICE 'HATA: Kullanici admin yapilamadi! Mevcut rol: %', user_role;
  END IF;
END $$;

