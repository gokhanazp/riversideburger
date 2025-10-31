-- Canada Adres Sistemi Güncellemesi (Canada Address System Update)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Mevcut addresses tablosunu yedekle (Backup existing addresses table)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'addresses') THEN
    DROP TABLE IF EXISTS addresses_backup;
    CREATE TABLE addresses_backup AS SELECT * FROM addresses;
  END IF;
END $$;

-- 2. Addresses tablosunu sil ve yeniden oluştur (Drop and recreate addresses table)
DROP TABLE IF EXISTS addresses CASCADE;

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- Home, Work, Other
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  street_number TEXT NOT NULL, -- Bina numarası (Building number) - örn: 123
  street_name TEXT NOT NULL, -- Sokak adı (Street name) - örn: Main Street
  unit_number TEXT, -- Daire/Apartman numarası (Unit/Apartment number) - örn: Apt 4B
  city TEXT NOT NULL, -- Şehir (City) - örn: Toronto
  province TEXT NOT NULL, -- Eyalet (Province) - ON, BC, AB, QC, etc.
  postal_code TEXT NOT NULL, -- Posta kodu (Postal code) - A1A 1A1 format
  delivery_instructions TEXT, -- Teslimat talimatları (Delivery instructions)
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi adreslerini görebilir (Users can view their own addresses)
CREATE POLICY "Users can view own addresses" 
ON addresses 
FOR SELECT 
USING (auth.uid() = user_id);

-- Kullanıcılar kendi adreslerini ekleyebilir (Users can insert their own addresses)
CREATE POLICY "Users can insert own addresses" 
ON addresses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi adreslerini güncelleyebilir (Users can update their own addresses)
CREATE POLICY "Users can update own addresses" 
ON addresses 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Kullanıcılar kendi adreslerini silebilir (Users can delete their own addresses)
CREATE POLICY "Users can delete own addresses" 
ON addresses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Adminler tüm adresleri görebilir (Admins can view all addresses)
CREATE POLICY "Admins can view all addresses" 
ON addresses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Varsayılan adres ayarlama fonksiyonu (Function to set default address)
CREATE OR REPLACE FUNCTION set_default_address(address_id UUID, user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- Önce tüm adresleri varsayılan olmaktan çıkar (Remove default from all addresses)
  UPDATE addresses 
  SET is_default = false 
  WHERE user_id = user_id_param;
  
  -- Seçilen adresi varsayılan yap (Set selected address as default)
  UPDATE addresses 
  SET is_default = true 
  WHERE id = address_id AND user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. İlk adres eklendiğinde otomatik varsayılan yap (Auto set first address as default)
CREATE OR REPLACE FUNCTION auto_set_first_address_default()
RETURNS TRIGGER AS $$
DECLARE
  address_count INTEGER;
BEGIN
  -- Kullanıcının kaç adresi var kontrol et (Check how many addresses user has)
  SELECT COUNT(*) INTO address_count 
  FROM addresses 
  WHERE user_id = NEW.user_id;
  
  -- Eğer bu ilk adres ise, varsayılan yap (If this is first address, set as default)
  IF address_count = 0 THEN
    NEW.is_default := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_set_first_address_default ON addresses;
CREATE TRIGGER trigger_auto_set_first_address_default
  BEFORE INSERT ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_first_address_default();

-- 6. Updated_at trigger'ı addresses için
DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. İndexler (Indexes for performance)
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON addresses(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_addresses_province ON addresses(province);
CREATE INDEX IF NOT EXISTS idx_addresses_city ON addresses(city);

-- Başarılı mesajı
DO $$
BEGIN
  RAISE NOTICE 'Canada adres sistemi basariyla kuruldu!';
END $$;

