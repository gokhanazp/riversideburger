-- Fix Profile Role (Profile Role'u Düzelt)
-- jwt_role = admin ama profile_role = null sorunu

-- ADIM 1: user_profiles tablosunu kontrol et (Check user_profiles table)
SELECT * FROM user_profiles;

-- ADIM 2: Eğer user_profiles tablosu boşsa, kullanıcı kaydı oluştur (Create user profile if empty)
INSERT INTO user_profiles (user_id, role, full_name, phone, total_points)
SELECT 
  u.id,
  u.raw_user_meta_data->>'role' as role,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'phone' as phone,
  0 as total_points
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE user_id = u.id
);

-- ADIM 3: Mevcut kayıtların role'unu güncelle (Update existing records' role)
UPDATE user_profiles up
SET role = u.raw_user_meta_data->>'role'
FROM auth.users u
WHERE up.user_id = u.id
AND (up.role IS NULL OR up.role = '');

-- ADIM 4: Sonuçları kontrol et (Check results)
SELECT 
  u.email,
  u.raw_user_meta_data->>'role' as jwt_role,
  up.role as profile_role,
  CASE 
    WHEN u.raw_user_meta_data->>'role' = up.role THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as status
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
ORDER BY u.created_at;

