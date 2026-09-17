-- Kupon kodları.
--
-- TASARIM KARARI: kupon AYRI BİR TABLO DEĞİL, `campaigns` satırı — ayırt edici
-- alanı `code`. Gerekçe: kuponun istediği her şey (tarih aralığı, kategori/ürün
-- hedefleme, minimum sepet, müşteri başı limit, yüzde indirim) kampanyalarda
-- ZATEN var ve fiyatlama motoru (campaignEngine.ts + _shared/order-draft.ts)
-- bunları biliyor. Ayrı tablo, o motorun ikinci bir kopyasını yazmak olurdu ve
-- iki kopya ilk fiyat değişikliğinde ayrışırdı.
--
-- KURAL: `code` dolu olan satır KENDİLİĞİNDEN UYGULANMAZ. Yalnızca müşteri kodu
-- girdiğinde devreye girer. `code` boş olanlar bugünkü otomatik kampanyalar.
-- Bu ayrım motorda da uygulanmak zorunda; aksi halde bir kupon herkese
-- otomatik indirim olur.
--
-- Sipariş başına TEK indirim uygulanmaya devam ediyor (orders.campaign_id) —
-- kupon ile otomatik kampanya yarışır, müşteriye yüksek olanı verilir. Üst üste
-- binme bilinçli olarak yok: kampanyalar %50 seviyesinde ve üstüne kupon
-- binmesi marjı götürür.

-- ── campaigns: kupon alanları ──────────────────────────────────────────────

-- Müşterinin gireceği kod. Boş = otomatik kampanya (bugünkü davranış).
alter table public.campaigns
  add column if not exists code text;

-- Doluysa kuponu YALNIZCA bu müşteri kullanabilir. Boş = herkese açık kupon.
alter table public.campaigns
  add column if not exists assigned_user_id uuid references public.users(id) on delete cascade;

-- Tüm müşteriler toplamında kaç kez kullanılabilir. Boş = sınırsız.
-- (Müşteri BAŞINA limit için mevcut per_customer_limit kullanılıyor.)
alter table public.campaigns
  add column if not exists max_redemptions integer;

-- Sabit tutar indirimi (type = 'fixed_amount'). discount_percent'in tutar
-- karşılığı; yüzde ile aynı satırda ikisi birden anlamlı değil.
alter table public.campaigns
  add column if not exists discount_amount numeric(10, 2);

-- Kod BÜYÜK/küçük harf duyarsız tekil olmalı: müşteri "yaz20" yazdığında
-- "YAZ20" kuponunu bulmalı, ama iki kupon aynı koda sahip olamamalı.
create unique index if not exists campaigns_code_unique
  on public.campaigns (upper(code))
  where code is not null;

-- Atanmış kuponları müşteri bazında listelemek için (Kuponlarım ekranı).
create index if not exists campaigns_assigned_user_idx
  on public.campaigns (assigned_user_id)
  where assigned_user_id is not null;

-- Yeni indirim türleri. Mevcut veride yalnızca first_order ve buy_x_get_y var,
-- o yüzden kısıt eklemek güvenli.
--   fixed_amount  → discount_amount kadar indirim
--   free_delivery → teslimat ücreti sıfırlanır (restoran üstlenir)
--   free_item     → target_product_ids içindeki en ucuz kalem bedava
-- Kısıtın adını VARSAYMIYORUZ. Tablo satır içi `CHECK (type IN (...))` ile
-- kuruldu; Postgres ona otomatik ad verdi ve bu ad ortamlar arasında
-- farklılaşabilir (database-updates/*.sql elle uygulanıyor). Yanlış adı
-- düşürmeye çalışmak sessizce başarısız olur ve ESKİ kısıt yerinde kalır —
-- o zaman yeni kupon türleri veritabanı tarafından reddedilirdi.
-- 'first_order' geçen kısıt yalnızca type kısıtıdır; target_type kısıtı
-- 'all'/'category'/'product' içerir ve etkilenmez.
do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.campaigns'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%first_order%'
  loop
    execute format('alter table public.campaigns drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.campaigns
  add constraint campaigns_type_check check (
    type in ('first_order', 'percentage', 'buy_x_get_y', 'fixed_amount', 'free_delivery', 'free_item')
  );

-- ── coupon_redemptions: kullanım defteri ───────────────────────────────────
--
-- Neden ayrı defter: kampanya kullanımı bugün `orders.campaign_id` taranarak
-- sayılıyor (campaignService.getCustomerOrderContext). Bu kupon için yetersiz:
--   1. max_redemptions'ı yarış koşulu olmadan uygulamanın yolu yok — iki
--      müşteri aynı anda son kuponu kullanabilir.
--   2. İptal edilen sipariş kuponu tüketmemeli; sipariş taramasında bu ayrım
--      status'e bakmakla yapılıyor ve kolayca kaçıyor.
--   3. Kimin hangi kuponu ne zaman kullandığı denetlenebilir olmalı.
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  -- Misafir siparişinde kullanıcı satırı olmayabilir; kullanım yine de
  -- max_redemptions'a sayılmalı, o yüzden nullable.
  user_id uuid references public.users(id) on delete cascade,
  -- Sipariş silinirse kayıt kalır (denetim izi), ama sipariş iptal edilirse
  -- kullanım geri verilir: sunucu satırı siler.
  order_id uuid references public.orders(id) on delete set null,
  discount_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Bir sipariş kuponu yalnızca BİR kez tüketir. Ödeme onayı iki kez düşse bile
-- (Apple Pay 'processing' → 'succeeded' yeniden denemesi) sayaç bir artar.
create unique index if not exists coupon_redemptions_order_unique
  on public.coupon_redemptions (order_id)
  where order_id is not null;

create index if not exists coupon_redemptions_campaign_idx
  on public.coupon_redemptions (campaign_id);

create index if not exists coupon_redemptions_user_idx
  on public.coupon_redemptions (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.coupon_redemptions enable row level security;

-- Müşteri kendi kullanımını görebilir (Kuponlarım ekranında "kullanıldı").
drop policy if exists "Users can read own coupon redemptions" on public.coupon_redemptions;
create policy "Users can read own coupon redemptions" on public.coupon_redemptions
  for select to public
  using (
    user_id = auth.uid()
    or exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin')
  );

-- YAZMA YOK. Bilerek: hiçbir istemci role'ü bu tabloya insert/update/delete
-- edemez. Defteri yalnızca service_role ile çalışan edge function yazıyor.
-- İstemci yazabilse kullanım sayacı istismara açık olurdu — müşteri kendi
-- kaydını silip kuponu tekrar kullanabilirdi.
--
-- (2026-08-28'deki admin_only_writes dersinin devamı: "authenticated" rolüne
-- açık bir yazma politikası, o role sahip HERKESE açıktır.)

-- ── Kuponu TETİKLEYİCİ tüketir ─────────────────────────────────────────────
--
-- NEDEN TETİKLEYİCİ, NEDEN EDGE FUNCTION DEĞİL: sipariş iki ayrı yoldan
-- oluşuyor ve ikisinin yetkisi farklı.
--   • web  → place-order, service_role ile orders'a yazıyor
--   • mobil → uygulama kendi oturumuyla orders'a yazıyor (RLS altında),
--     sipariş ödeme ONAYLANDIKTAN SONRA oluşuyor (PaymentScreen:264)
-- Mobil istemci coupon_redemptions'a yazamaz — yazabilse kupon istismara
-- açılırdı. Tetikleyici tablo sahibinin yetkisiyle çalıştığı için iki yol da
-- aynı tek noktadan geçer ve sipariş ile kullanım kaydı AYNI İŞLEMDE oluşur:
-- "indirim verildi ama sayaç artmadı" durumu doğmaz.
--
-- Kullanım hakkı ödemeden ÖNCE denetlenir (validate-coupon ve
-- create-payment-intent). Tetikleyici reddetmez, KAYDEDER: müşteri kuponla
-- ödemeyi tamamladıysa o kullanım gerçekleşmiştir, defter gerçeği yazmalı.
create or replace function public.record_coupon_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.campaign_id is null then
    return new;
  end if;

  -- Yalnızca KUPON satırları deftere yazılır; otomatik kampanyaların kullanımı
  -- eskiden olduğu gibi orders.campaign_id taranarak sayılıyor.
  if not exists (
    select 1 from public.campaigns
     where id = new.campaign_id
       and code is not null
  ) then
    return new;
  end if;

  -- on conflict: aynı sipariş ikinci kez işlenirse (mükerrer ödeme onayı)
  -- sayaç bir kez artar.
  --
  -- `where order_id is not null` ŞART: coupon_redemptions_order_unique KISMİ
  -- bir indeks ve Postgres, kısmi indeksi çakışma hedefi olarak kabul etmek
  -- için indeksin koşulunu da ister. Koşulsuz yazıldığında "there is no unique
  -- or exclusion constraint matching the ON CONFLICT specification" hatası
  -- veriyor ve tetikleyici patladığı için SİPARİŞ INSERT'İ DE BAŞARISIZ
  -- oluyor — yani kuponla verilen her sipariş düşerdi.
  insert into public.coupon_redemptions (campaign_id, user_id, order_id, discount_amount)
  values (new.campaign_id, new.user_id, new.id, coalesce(new.discount_amount, 0))
  on conflict (order_id) where order_id is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_record_coupon_redemption on public.orders;
create trigger trg_record_coupon_redemption
  after insert on public.orders
  for each row
  execute function public.record_coupon_redemption();

-- Sipariş iptal edilirse kupon hakkı müşteriye geri verilir.
create or replace function public.release_coupon_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    delete from public.coupon_redemptions where order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_release_coupon_redemption on public.orders;
create trigger trg_release_coupon_redemption
  after update of status on public.orders
  for each row
  execute function public.release_coupon_redemption();

-- ── campaigns okuma politikası: kupon kodları sızmasın ─────────────────────
--
-- MEVCUT DURUM TEHLİKELİ: "Anyone can view active campaigns" politikası
-- USING (is_active = true) diyor — giriş yapmamış biri bile tüm satırları TÜM
-- KOLONLARIYLA okuyabiliyor. `code` kolonu eklendiği anda bu, herkesin
-- `select code from campaigns` ile bütün kupon kodlarını (başkasına atanmış
-- olanlar dahil) toplayabilmesi demek olurdu.
--
-- Yeni kural:
--   • kod'u olmayan satır (otomatik kampanya) → herkese açık, bugünkü davranış
--   • kendisine atanmış kupon               → yalnızca sahibine ("Kuponlarım")
--   • herkese açık kupon kodu               → KİMSEYE listelenmez; kod pazarlama
--     ile dağıtılır, tablo okunarak keşfedilmez. Doğrulama service_role ile
--     çalışan validate-coupon fonksiyonunda yapılır, RLS'i atlar.
drop policy if exists "Anyone can view active campaigns" on public.campaigns;
create policy "Anyone can view active campaigns" on public.campaigns
  for select to public
  using (
    is_active = true
    and (
      code is null
      or assigned_user_id = auth.uid()
    )
  );
