-- ============================================
-- USERS TABLOSUNU YENİDEN OLUŞTUR
-- (RECREATE USERS TABLE)
-- ============================================
-- UYARI: Bu tüm kullanıcı verilerini siler!
-- (WARNING: This deletes all user data!)
-- Sadece geliştirme aşamasında kullanın!
-- (Only use during development!)
-- ============================================

-- 1. Mevcut tabloyu ve bağımlılıkları kaldır
-- (Drop existing table and dependencies)
DROP TABLE IF EXISTS users CASCADE;

-- 2. Users tablosunu oluştur
-- (Create users table)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'staff')),
  full_name TEXT,
  phone TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. İndeksler oluştur (Create indexes)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 4. RLS'i etkinleştir (Enable RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. RLS politikalarını oluştur (Create RLS policies)

-- Kullanıcılar kendi verilerini görebilir (Users can view their own data)
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Kullanıcılar kendi verilerini güncelleyebilir (Users can update their own data)
CREATE POLICY "Users can update own data"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Authenticated kullanıcılar INSERT yapabilir (Authenticated users can insert)
CREATE POLICY "Enable insert for authenticated users"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Service role için tam erişim (Full access for service role)
CREATE POLICY "Service role can insert"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update"
ON users FOR UPDATE
TO service_role
USING (true);

-- 6. Trigger fonksiyonu oluştur (Create trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 7. Trigger oluştur (Create trigger)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Updated_at trigger fonksiyonu (Updated_at trigger function)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 9. Updated_at trigger (Updated_at trigger)
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- TAMAMLANDI! (COMPLETED!)
-- ============================================
-- Şimdi uygulamadan yeni bir kullanıcı kayıt edin
-- (Now register a new user from the app)
-- ============================================

