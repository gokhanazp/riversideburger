-- Web siparişi artık ödeme tamamlanmadan orders tablosuna YAZILMIYOR.
--
-- Eski akış: create-order siparişi payment_status='pending' ile yazıyor, müşteri
-- sonra Stripe'a gidiyordu. Ödemeyi yarıda bırakan herkes panelde bir sipariş
-- bırakıyordu — restoran ödenmemiş siparişleri görüyordu.
--
-- Yeni akış: sunucuda fiyatlanmış TASLAK ödeme bitene kadar web_checkouts'ta
-- bekler; orders satırı yalnızca Stripe "paid" dedikten sonra, doğrudan
-- payment_status='paid' olarak oluşur. Panele düşen her sipariş ödenmiştir.

create table if not exists public.web_checkouts (
  stripe_session_id text        primary key,
  draft             jsonb       not null,
  created_at        timestamptz not null default now()
);

comment on table public.web_checkouts is
  'Ödeme tamamlanana kadar bekleyen, sunucuda fiyatlanmış sipariş taslakları. Yalnızca service_role erişir.';

-- RLS açık ve HİÇ policy yok: anon ve authenticated için tamamen kapalı.
-- Edge Function''lar service_role ile bağlandığı için RLS''i baypas eder.
alter table public.web_checkouts enable row level security;

-- ── Ödeme oturumu başına EN FAZLA BİR sipariş ────────────────────────────────
-- confirm-checkout (müşteri siteye döndüğünde) ve stripe-webhook (Stripe haber
-- verdiğinde) aynı ödeme için birlikte tetiklenebiliyor. Kilit protokolü yerine
-- benzersizlik kısıtı: ikinci insert 23505 ile düşer, çağıran mevcut siparişi
-- okur. Aksi halde tek ödemeden iki sipariş çıkar ve mutfak yemeği iki kez yapar.
alter table public.orders
  add column if not exists stripe_session_id text;

create unique index if not exists orders_stripe_session_id_key
  on public.orders (stripe_session_id)
  where stripe_session_id is not null;

comment on column public.orders.stripe_session_id is
  'Bu siparişi doğuran Stripe Checkout oturumu. Aynı ödemeden ikinci sipariş oluşmasını engeller.';

-- ── Misafir için auth kullanıcısı arama ──────────────────────────────────────
-- public.users.id, auth.users(id)''ye foreign key ile bağlı. Bir e-postada auth
-- hesabı VAR ama public.users satırı YOKSA (yarıda kalmış eski bir denemeden),
-- createUser hata verir. Ödeme ALINDIKTAN sonra bunun olması müşteriyi parasını
-- ödemiş ama siparişi oluşmamış halde bırakırdı. Bu fonksiyon o durumda mevcut
-- auth kimliğini bulup users satırının onun altına yazılmasını sağlıyor.
create or replace function public.auth_user_id_for_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- Yalnızca service_role çağırabilsin; auth e-postaları müşteriye açılmasın.
revoke all on function public.auth_user_id_for_email(text) from public;
revoke all on function public.auth_user_id_for_email(text) from anon;
revoke all on function public.auth_user_id_for_email(text) from authenticated;
