-- RLS Hatası Düzeltmesi: Kullanıcı Ekleme İzni
-- public.users tablosuna kayıt ekleme (INSERT) politikası eksik olduğu için
-- mobil uygulamadan yeni üye olunduğunda veritabanı kaydı oluşturulamıyor.
-- Bu SQL kodunu Supabase Dashboard > SQL Editor kısmında çalıştırarak sorunu çözebilirsiniz.

-- Policy: Users can insert own data
-- Kullanıcıların sadece kendi ID'leriyle kayıt oluşturmasına izin verir.
CREATE POLICY "Users can insert own data" 
ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- NOT: Eğer 'Users can insert own data' zaten varsa hata verebilir, 
-- bu durumda endişelenmeyin veya önce mevcut politikayı silip tekrar deneyin:
-- DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
