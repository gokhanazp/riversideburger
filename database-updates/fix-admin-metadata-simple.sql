-- Fix Admin Metadata - Basit Versiyon (Simple Version)
-- Manuel olarak admin kullanıcının metadata'sını güncelle
-- Manually update admin user's metadata

-- 1. Önce mevcut durumu kontrol et (Check current state)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
ORDER BY u.email;

-- 2. Eğer user_profiles tablosunda role sütunu yoksa ekle (Add role column if not exists)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- 3. Mevcut kullanıcıya role ekle (Add role to existing user)
-- NOT: Email adresinizi buraya yazın (NOTE: Write your email here)
UPDATE user_profiles
SET role = 'admin'
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'  -- ← Buraya email adresinizi yazın
);

-- 4. Auth.users tablosuna metadata ekle (Add metadata to auth.users)
-- NOT: Email adresinizi buraya yazın (NOTE: Write your email here)
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object('role', 'admin')
WHERE email = 'YOUR_EMAIL_HERE';  -- ← Buraya email adresinizi yazın

-- 5. Sonucu kontrol et (Check result)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as jwt_role,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE u.email = 'YOUR_EMAIL_HERE';  -- ← Buraya email adresinizi yazın

