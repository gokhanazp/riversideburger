-- ============================================
-- RIVERSIDE BURGERS - SUPABASE SETUP
-- ============================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- (This file should be run in Supabase SQL Editor)
-- ============================================

-- 1. Users tablosu için RLS politikalarını düzelt
-- (Fix RLS policies for users table)
-- ============================================

-- Önce mevcut politikaları kaldır (Drop existing policies)
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;

-- RLS'i etkinleştir (Enable RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Yeni politikalar oluştur (Create new policies)

-- 1. Kullanıcılar kendi verilerini görebilir (Users can view their own data)
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- 2. Kullanıcılar kendi verilerini güncelleyebilir (Users can update their own data)
CREATE POLICY "Users can update own data"
ON users FOR UPDATE
USING (auth.uid() = id);

-- 3. Authenticated kullanıcılar INSERT yapabilir (Authenticated users can insert)
-- Bu politika trigger için gerekli (This policy is needed for the trigger)
CREATE POLICY "Enable insert for authenticated users"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Service role için tam erişim (Full access for service role)
-- Trigger'ın çalışması için gerekli (Needed for trigger to work)
CREATE POLICY "Service role can insert"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update"
ON users FOR UPDATE
TO service_role
USING (true);


-- ============================================
-- 2. Trigger'ı yeniden oluştur
-- (Recreate the trigger)
-- ============================================

-- Önce mevcut trigger'ı kaldır (Drop existing trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Yeni trigger fonksiyonu oluştur (Create new trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Users tablosuna yeni kullanıcı ekle (Insert new user into users table)
  INSERT INTO public.users (
    id,
    email,
    role,
    full_name,
    phone,
    points,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    0,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Hata durumunda log (Log error)
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Trigger'ı oluştur (Create trigger)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- 3. Email confirmation'ı devre dışı bırak
-- (Disable email confirmation)
-- ============================================
-- NOT: Bu ayar Supabase Dashboard'dan yapılmalı
-- (NOTE: This setting must be done from Supabase Dashboard)
-- 
-- Adımlar (Steps):
-- 1. Supabase Dashboard → Authentication → Settings
-- 2. "Enable email confirmations" → KAPALI (OFF)
-- 3. "Enable email change confirmations" → KAPALI (OFF)
-- 4. Save


-- ============================================
-- 4. Test için örnek kullanıcı oluştur
-- (Create test user)
-- ============================================
-- NOT: Bu kısmı çalıştırmayın, sadece referans için
-- (NOTE: Don't run this part, it's just for reference)
-- 
-- Test kullanıcısı oluşturmak için uygulamadan kayıt olun
-- (To create a test user, register from the app)


-- ============================================
-- 5. Mevcut kullanıcıları kontrol et
-- (Check existing users)
-- ============================================
-- Bu sorguyu çalıştırarak mevcut kullanıcıları görebilirsiniz
-- (Run this query to see existing users)

SELECT 
  id,
  email,
  role,
  full_name,
  phone,
  points,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;


-- ============================================
-- 6. Auth kullanıcılarını kontrol et
-- (Check auth users)
-- ============================================
-- Bu sorguyu çalıştırarak auth.users tablosundaki kullanıcıları görebilirsiniz
-- (Run this query to see users in auth.users table)

SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;


-- ============================================
-- 7. Trigger'ın çalışıp çalışmadığını test et
-- (Test if trigger is working)
-- ============================================
-- Uygulamadan yeni bir kullanıcı kayıt edin
-- Sonra bu sorguyu çalıştırın:
-- (Register a new user from the app, then run this query:)

SELECT 
  au.id,
  au.email AS auth_email,
  au.email_confirmed_at,
  u.email AS user_email,
  u.full_name,
  u.phone,
  u.role,
  CASE 
    WHEN u.id IS NULL THEN '❌ Trigger çalışmadı (Trigger did not work)'
    ELSE '✅ Trigger çalıştı (Trigger worked)'
  END AS trigger_status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
ORDER BY au.created_at DESC
LIMIT 5;


-- ============================================
-- 8. Sorun giderme (Troubleshooting)
-- ============================================

-- Eğer hala sorun varsa, users tablosunu yeniden oluşturun:
-- (If still having issues, recreate the users table:)

-- UYARI: Bu tüm kullanıcı verilerini siler!
-- (WARNING: This deletes all user data!)
-- DROP TABLE IF EXISTS users CASCADE;

-- Sonra users tablosunu yeniden oluşturun
-- (Then recreate the users table)
-- Tablo yapısı için database.types.ts dosyasına bakın
-- (See database.types.ts for table structure)


-- ============================================
-- 9. RLS politikalarını test et
-- (Test RLS policies)
-- ============================================

-- Politikaları listele (List policies)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users';


-- ============================================
-- 10. Trigger'ları listele
-- (List triggers)
-- ============================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';


-- ============================================
-- TAMAMLANDI! (COMPLETED!)
-- ============================================
-- Bu SQL dosyasını Supabase SQL Editor'de çalıştırdıktan sonra:
-- (After running this SQL file in Supabase SQL Editor:)
--
-- 1. ✅ RLS politikaları düzeltildi
-- 2. ✅ Trigger yeniden oluşturuldu
-- 3. ⚠️  Email confirmation'ı Dashboard'dan kapatın
-- 4. 🧪 Uygulamadan test edin
-- ============================================

