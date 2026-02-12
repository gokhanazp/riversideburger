-- Admin Kullanıcılarının Herkesi Görebilmesi İçin RLS Politikası
-- Şu anda `public.users` tablosunda "Select" (Okuma) izni muhtemelen herkesin sadece kendini görebileceği şekilde ayarlanmış;
-- "Users can view own data" -> (auth.uid() = id)
-- Bu yüzden admin paneline giriş yapan admin, sadece kendini (1 kişi) görüyor.

-- ÇÖZÜM: Admin rolüne sahip kullanıcıların tüm kullanıcıları görebilmesini sağlayan politika eklenmeli.

-- 1. Önce eski politikayı temizleyelim (çakışma olmaması için)
-- DROP POLICY IF EXISTS "Users can view own data" ON public.users;

-- 2. Yeni ve daha kapsamlı bir politika oluşturalım:
-- "Kullanıcılar kendi verisini görebilir VEYA Admin rolündekiler herkesi görebilir"

CREATE POLICY "Users can view own data OR Admins can view all" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- NOT: Eğer "Users can view own data" isimli eski bir politika varsa, 
-- her iki politika aynı anda çalışır (OR mantığıyla değil, ayrı ayrı).
-- Temiz bir yapı için eski politikayı silip bunu kullanmak en doğrusudur.
-- SQL Editor'de şunu çalıştırın:

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data OR Admins can view all" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin' -- recursive bir sorgu olabilir, dikkat edilmeli
  )
);

-- Recursive sorgu (sonsuz döngü) riskini önlemek için metot 2: auth.jwt() kullanımı
-- Bu yöntem daha güvenli ve performanslıdır çünkü veritabanına tekrar sorgu atmaz.
-- Ancak bunun için login olurken user_metadata içine role bilgisinin doğru yazıldığından emin olmalıyız.
-- authService.ts dosyasında metadata yazılıyor, bu yüzden bunu kullanabiliriz.

-- TERCİH EDİLEN YÖNTEM:
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Kural 1: Herkes kendi verisini görebilir
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);

-- Kural 2: Adminler herkesi görebilir
-- (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin' kontrolü 
-- veya daha basitçe auth.jwt() map'inden 'role' okuma (Supabase config'e bağlı)
-- En garantisi, sonsuz döngüden kaçınan bir EXISTS sorgusudur ama users tablosu kendi üzerinde sorgu yapacağı için dikkatli olunmalı.

-- Güvenli Admin Sorgusu (Infinite recursion'ı engellemek için)
-- Admin olup olmadığını kontrol eden fonksiyon kullanabiliriz veya JWT metadata'ya güvenebiliriz.
-- JWT metadata daha performanslıdır.

CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
