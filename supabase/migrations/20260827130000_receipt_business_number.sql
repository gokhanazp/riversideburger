-- Fiş başlığı için işletme (HST) numarası
--
-- Kanada'da HST mükellefi işletmelerin fişte işletme numarasını göstermesi
-- gerekiyor. Fiş başlığında yalnızca "RIVERSIDE BURGERS" yazıyordu; adres,
-- telefon ve işletme numarası yoktu.
--
-- Adres ve telefon zaten app_settings'te (contact_address1 / contact_phone1) ve
-- admin panelinden düzenlenebiliyor; işletme numarası da aynı yere ekleniyor ki
-- değiştiğinde yeni sürüm çıkarmak gerekmesin.

insert into public.app_settings (setting_key, setting_value)
values ('contact_business_number', '772068078RT0001')
on conflict (setting_key) do nothing;

do $$
declare v text;
begin
  select setting_value into v from public.app_settings where setting_key='contact_business_number';
  raise notice '✅ contact_business_number = %', v;
end $$;
