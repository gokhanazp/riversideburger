-- Bir üyenin hesabı web'den mi (riversideburgers.ca) yoksa mobil uygulamadan
-- mı açıldığı admin tarafında görünsün.
--
-- orders.source (20260829150000_order_source.sql) ile aynı gerekçe ve aynı
-- desen: restoran web'den açılan üyelikleri uygulamadan açılanlardan ayırt
-- edemiyordu.
--
-- Varsayılan 'app': mobil uygulamanın kendi kayıt insert'ini (authService.ts)
-- DEĞİŞTİRMEK GEREKMİYOR, oradan açılan hesaplar otomatik doğru işaretleniyor.
-- Yalnızca web'deki hesap açma yolu (start-checkout/index.ts, sepette
-- "Create an account") artık açıkça 'web' yazıyor.
--
-- orders.source'un aksine burada geçmiş satırlar için güvenilir bir ayrım
-- sinyali YOK (orada stripe_session_id is not null gibi temiz bir iz vardı).
-- Yani bu migration'dan ÖNCE açılmış, aslında web'den gelmiş birkaç hesap da
-- yanlışlıkla 'app' görünecek — bundan sonraki her yeni kayıt kesin doğru.
alter table public.users
  add column if not exists signup_source text not null default 'app';

alter table public.users
  drop constraint if exists users_signup_source_check;

alter table public.users
  add constraint users_signup_source_check check (signup_source in ('app', 'web'));

comment on column public.users.signup_source is
  'Hesabın açıldığı kanal: app (mobil uygulamadan kayıt) veya web (sepette "Create an account"). '
  'Bu migration''dan ÖNCEki satırlar için güvenilir bir ayrım sinyali yok, hepsi app varsayılıyor.';
