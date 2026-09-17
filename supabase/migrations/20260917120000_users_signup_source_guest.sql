-- Misafir siparişinin arkasında açılan hesaplar admin listesinde gerçek
-- üyelerden ayrılsın.
--
-- orders.user_id NOT NULL olduğu için place-order, misafir ödeme yaptığında
-- şifresiz bir auth hesabı + users satırı açıyor (resolveUserId). Bu satırlar
-- signup_source varsayılanıyla 'app' görünüyordu ve admin ekranında üye gibi
-- sayılıyordu: 2026-09-17'de 111 profilin 35'i hiç giriş yapmamış misafirdi.
--
-- Üçüncü değer: 'guest'. Mekanizma DEĞİŞMİYOR — tekrar gelen misafir yine
-- tanınıyor, "ilk sipariş" kampanyası yine ikinci kez verilmiyor. Sadece etiket.
alter table public.users
  drop constraint if exists users_signup_source_check;

alter table public.users
  add constraint users_signup_source_check check (signup_source in ('app', 'web', 'guest'));

comment on column public.users.signup_source is
  'Hesabın açıldığı kanal: app (mobil uygulamadan kayıt), web (sitede kayıt) veya '
  'guest (misafir siparişi için place-order''ın açtığı şifresiz hesap). Geçmiş '
  'app/web ayrımı için güvenilir sinyal yok; guest geriye dönük auth.users''tan '
  '(hiç giriş yok + şifre yok) türetildi.';

-- Geriye dönük: hiç giriş yapmamış VE şifresi hiç olmamış hesaplar misafirdir.
-- Web'de "Create an account" ile açılan hesaplar şifreli olduğu için (henüz
-- giriş yapmamış olsalar da) bu kümeye girmiyor.
update public.users u
   set signup_source = 'guest'
  from auth.users a
 where a.id = u.id
   and a.last_sign_in_at is null
   and coalesce(a.encrypted_password, '') = ''
   and u.signup_source <> 'guest';
