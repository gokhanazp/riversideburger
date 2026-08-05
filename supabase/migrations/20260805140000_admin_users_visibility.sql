-- Admin'lerin üye listesini görememesi — 3 admin'den yalnızca 1'i tüm üyeleri görüyordu
--
-- Sebep: veritabanındaki 46 politikadan 45'i admin kontrolünü users TABLOSUNDAN yapıyor
-- (users.role = 'admin'), ama `users` tablosunun kendi politikası JWT metadata'sına
-- bakıyordu: auth.jwt() -> 'user_metadata' ->> 'role'. İki admin'in tabloda rolü 'admin'
-- olmasına rağmen auth metadata'sında 'customer' kalmış, dolayısıyla:
--   - AdminUsers ekranı onlara yalnızca kendi satırlarını gösteriyordu (1 kişi)
--   - AdminOrders'ta siparişler görünüyordu ama gömülü müşteri bilgisi (email/ad/telefon)
--     boş geliyordu, çünkü o veri de users tablosundan okunuyor
--
-- Neden JWT kullanılmış: `users` üzerindeki bir politika doğrudan `users` sorgularsa
-- Postgres "infinite recursion detected in policy" hatası verir. Çözüm, RLS'i baypas eden
-- SECURITY DEFINER bir fonksiyon — böylece tek doğruluk kaynağı users.role olur ve rol
-- değişiklikleri için yeniden giriş / metadata senkronu gerekmez.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Oturumdaki kullanıcı admin mi? users tablosunu RLS baypas ederek okur — users üzerindeki politikalarda özyineleme olmadan kullanılabilir.';

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- users okuma politikasını tek doğruluk kaynağına bağla.
-- gokhanyildirim1905 hesabının erişimi korunur: tabloda rolü zaten 'admin'.
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (public.is_admin());
