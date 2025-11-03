-- Mevcut Durumu Kontrol Et ve Admin Yap (Check Current State and Make Admin)

-- ADIM 1: Tüm kullanıcıları listele (List all users)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
ORDER BY u.created_at;

-- ADIM 2: user_profiles tablosunda role sütunu var mı kontrol et (Check if role column exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'role';

-- ADIM 3: Eğer role sütunu yoksa ekle (Add role column if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'customer';
  END IF;
END $$;

-- ADIM 4: İlk kullanıcıyı admin yap (Make first user admin)
-- Bu genellikle sizin hesabınızdır (This is usually your account)
WITH first_user AS (
  SELECT id FROM auth.users ORDER BY created_at LIMIT 1
)
UPDATE user_profiles
SET role = 'admin'
WHERE user_id IN (SELECT id FROM first_user);

-- ADIM 5: İlk kullanıcının auth.users metadata'sını güncelle (Update first user's auth.users metadata)
WITH first_user AS (
  SELECT id FROM auth.users ORDER BY created_at LIMIT 1
)
UPDATE auth.users
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data IS NULL THEN '{"role": "admin"}'::jsonb
    ELSE jsonb_set(raw_user_meta_data, '{role}', '"admin"')
  END
WHERE id IN (SELECT id FROM first_user);

-- ADIM 6: Diğer kullanıcıları customer yap (Make other users customer)
UPDATE user_profiles
SET role = 'customer'
WHERE role IS NULL OR role = '';

UPDATE auth.users
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data IS NULL THEN '{"role": "customer"}'::jsonb
    WHEN raw_user_meta_data->>'role' IS NULL THEN jsonb_set(raw_user_meta_data, '{role}', '"customer"')
    ELSE raw_user_meta_data
  END
WHERE raw_user_meta_data->>'role' IS NULL;

-- ADIM 7: Sonuçları kontrol et (Check results)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data,
  u.raw_user_meta_data->>'role' as jwt_role,
  up.role as profile_role,
  CASE 
    WHEN u.raw_user_meta_data->>'role' = up.role THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as status
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
ORDER BY u.created_at;

-- ADIM 8: Admin kullanıcıları göster (Show admin users)
SELECT 
  u.email,
  u.raw_user_meta_data->>'role' as jwt_role,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE up.role = 'admin' OR u.raw_user_meta_data->>'role' = 'admin';

