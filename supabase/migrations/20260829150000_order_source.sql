-- Siparişin nereden geldiği admin panelinde görünsün.
--
-- Restoran mobil uygulamadan gelen siparişle web sitesinden gelen siparişi
-- ayırt edemiyordu. Ayrım stripe_session_id'nin dolu olmasından da çıkarılabilirdi
-- ama bu örtük bir kural olurdu; açık bir sütun ileride telefon siparişi gibi
-- yeni kanallar için de yer bırakıyor.
--
-- Varsayılan 'app': mobil uygulama insert'lerini DEĞİŞTİRMEK GEREKMİYOR ve
-- mevcut tüm siparişler doğru şekilde 'app' olarak işaretleniyor.
alter table public.orders
  add column if not exists source text not null default 'app';

alter table public.orders
  drop constraint if exists orders_source_check;

alter table public.orders
  add constraint orders_source_check check (source in ('app', 'web'));

comment on column public.orders.source is
  'Siparişin geldiği kanal: app (mobil uygulama) veya web (riversideburgers.ca).';

-- Yeni akıştan önce web'den gelmiş siparişler varsa onları da işaretle.
update public.orders set source = 'web' where stripe_session_id is not null;
