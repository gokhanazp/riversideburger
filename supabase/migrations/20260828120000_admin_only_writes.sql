-- Yazma izinlerini "giriş yapmış herkes"ten "admin"e daralt.
--
-- Üç tabloda yazma politikaları `auth.role() = 'authenticated'` koşuluyla
-- tanımlıydı. Bu koşul admin demek DEĞİL; kaydolan HERHANGİ bir müşteriyi
-- kapsıyor. anon anahtarı mobil paketin içinde olduğu için kaydolan biri kendi
-- token'ıyla PostgREST'e istek atıp:
--   • app_settings      → restoranın telefonunu, adresini, anasayfa metnini değiştirebilir
--   • menu_categories   → menü yapısını silebilir
--   • delivery_partners → teslimat ayarlarını değiştirebilir
--
-- products tablosunda doğrusu zaten var; bu üçü atlanmış. Aynı kalıba
-- getiriliyor.
--
-- Uygulamaya etkisi yok: bu tablolara yazan her kod yolu bir admin ekranı
-- (AdminContactSettings, AdminCategories, AdminDeliveryPartners,
-- AdminLanguageSettings) ve üç admin hesabının hepsi users.role = 'admin'.
-- Edge Function'lar service_role ile çalıştığı için RLS'e hiç girmiyor.

-- ── app_settings ───────────────────────────────────────────────────────────
-- Burada YENİ politika gerekmiyor: "Enable insert for admins" ve
-- "Enable update for admins" politikaları hâlihazırda mevcut ve admin'i
-- kapsıyor. RLS politikaları permissive, yani OR'lanıyor — gevşek olanı
-- kaldırmak erişimi admin'e indirmeye yetiyor.
drop policy if exists "Authenticated users can update app settings" on public.app_settings;

-- ── menu_categories ────────────────────────────────────────────────────────
drop policy if exists "Authenticated users can insert menu categories" on public.menu_categories;
drop policy if exists "Authenticated users can update menu categories" on public.menu_categories;
drop policy if exists "Authenticated users can delete menu categories" on public.menu_categories;

create policy "Admins can insert menu categories" on public.menu_categories
  for insert to public
  with check (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

create policy "Admins can update menu categories" on public.menu_categories
  for update to public
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

create policy "Admins can delete menu categories" on public.menu_categories
  for delete to public
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

-- ── delivery_partners ──────────────────────────────────────────────────────
drop policy if exists "Authenticated users can insert delivery partners" on public.delivery_partners;
drop policy if exists "Authenticated users can update delivery partners" on public.delivery_partners;
drop policy if exists "Authenticated users can delete delivery partners" on public.delivery_partners;

create policy "Admins can insert delivery partners" on public.delivery_partners
  for insert to public
  with check (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

create policy "Admins can update delivery partners" on public.delivery_partners
  for update to public
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

create policy "Admins can delete delivery partners" on public.delivery_partners
  for delete to public
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

-- Okuma da aynı kalıptan muzdaripti: pasif teslimat ortaklarını "giriş yapmış
-- herkes" görebiliyordu. Admin paneli hepsini görmeye devam ediyor
-- (getAllDeliveryPartners yalnızca AdminDeliveryPartners'tan çağrılıyor),
-- müşteri yalnızca aktif olanları görüyor.
drop policy if exists "Anyone can read active delivery partners" on public.delivery_partners;

create policy "Anyone can read active delivery partners" on public.delivery_partners
  for select to public
  using (
    is_active = true
    or exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin')
  );
