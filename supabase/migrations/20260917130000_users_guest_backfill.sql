-- 20260917120000'deki geriye dönük işaretleme 0 satır eşleşti.
--
-- Sebep: GoTrue, admin API ile şifresiz açılan hesaplara da encrypted_password
-- yazıyor (rastgele/boş bir değerin özeti) — canlıda 111 hesabın 111'inde
-- alan dolu. "Şifresi yok" kriteri misafiri ayıramıyor.
--
-- Doğru kriter: hiç giriş yapmamış + varsayılan 'app' etiketi + en az bir
-- WEB siparişi. Uygulamadan kayıt olan herkes kayıt anında oturum açar
-- (last_sign_in_at dolar); web'de "Create an account" ile açılan hesap ise
-- signup_source='web' taşır. Geriye yalnızca place-order'ın misafir için açtığı
-- hesaplar kalıyor. 2026-09-17'de 33 satır (31'inde puan birikmiş).
update public.users u
   set signup_source = 'guest'
  from auth.users a
 where a.id = u.id
   and a.last_sign_in_at is null
   and u.signup_source = 'app'
   and exists (
     select 1 from public.orders o
      where o.user_id = u.id
        and o.source = 'web'
   );
