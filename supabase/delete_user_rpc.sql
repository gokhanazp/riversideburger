-- ⚠️ DİKKAT: Bu SQL kodunu Supabase Dashboard > SQL Editor kısmında çalıştırmanız gerekmektedir.
-- Bu fonksiyon, mobil uygulamadan "Hesabımı Sil" butonuna tıklandığında çalışır.

-- Fonksiyonu oluştur
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Public tablodan kullanıcı verilerini sil
  -- (İlişkili tablolar 'ON DELETE CASCADE' özelliği ile otomatik silinir)
  DELETE FROM public.users WHERE id = auth.uid();
  
  -- 2. Auth sisteminden kullanıcıyı sil
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Çalıştırmak için izin ver (Authenticated users only)
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
