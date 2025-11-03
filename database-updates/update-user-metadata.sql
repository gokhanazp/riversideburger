-- Update User Metadata with Role (Kullanıcı Metadata'sına Role Ekle)
-- JWT'de role bilgisi olması için user metadata'yı güncelle
-- Update user metadata to include role in JWT

-- 1. Önce mevcut admin kullanıcılarını kontrol et (Check existing admin users)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE up.role = 'admin';

-- 2. Admin kullanıcıların metadata'sını güncelle (Update admin users' metadata)
-- NOT: Bu sorguyu çalıştırmadan önce yukarıdaki SELECT ile admin kullanıcıları kontrol edin
-- NOTE: Check admin users with the SELECT above before running this update

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE id IN (
  SELECT user_id 
  FROM user_profiles 
  WHERE role = 'admin'
);

-- 3. Customer kullanıcıların metadata'sını güncelle (Update customer users' metadata)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"customer"'
)
WHERE id IN (
  SELECT user_id 
  FROM user_profiles 
  WHERE role = 'customer' OR role IS NULL
);

-- 4. Trigger oluştur: Yeni kullanıcı oluşturulduğunda metadata'ya role ekle
-- Create trigger: Add role to metadata when new user is created
CREATE OR REPLACE FUNCTION sync_user_metadata_role()
RETURNS TRIGGER AS $$
BEGIN
  -- user_profiles'dan role bilgisini al ve auth.users metadata'sına ekle
  -- Get role from user_profiles and add to auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(NEW.role)
  )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı user_profiles tablosuna ekle (Add trigger to user_profiles table)
DROP TRIGGER IF EXISTS sync_user_metadata_role_trigger ON user_profiles;
CREATE TRIGGER sync_user_metadata_role_trigger
  AFTER INSERT OR UPDATE OF role ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metadata_role();

-- 5. Trigger oluştur: user_profiles oluşturulduğunda varsayılan role ekle
-- Create trigger: Add default role when user_profiles is created
CREATE OR REPLACE FUNCTION set_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer role belirtilmemişse 'customer' yap
  -- If role is not specified, set to 'customer'
  IF NEW.role IS NULL THEN
    NEW.role := 'customer';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_default_user_role_trigger ON user_profiles;
CREATE TRIGGER set_default_user_role_trigger
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_user_role();

-- 6. Sonuçları kontrol et (Check results)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as jwt_role,
  up.role as profile_role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
ORDER BY up.role DESC, u.email;

