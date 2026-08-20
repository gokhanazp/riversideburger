-- Özelleştirmelerin İngilizce adını sunucuda doldur
--
-- Sorun: fişte ve admin panelinde ek malzemeler hâlâ Türkçe basılıyordu
-- ("Domates Çıkar"), uygulama dili İngilizce olmasına rağmen.
--
-- Sebep: option_name_en kolonu eklendi ve uygulama onu okuyor, ama sipariş
-- kaydını MÜŞTERİNİN uygulaması yazıyor. Kolonu dolduran kod
-- (ProductDetailScreen -> cartStore -> orderService) müşteri cihazında çalışıyor
-- ve App Store'da hâlâ 2.0.0 var. Yani müşterilerin uygulamasında o kod yok;
-- 19 Ağustos'ta verilen siparişlerde alan boş geldi. Tüm müşterilerin uygulamayı
-- güncellemesini beklemek bir çözüm değil — güncellemeyi kendileri, kendi
-- zamanlarında yapıyor.
--
-- Çözüm: türetilebilir bir veriyi istemciye bırakmamak. option_id zaten kayıtta
-- olduğu için İngilizce ad product_options'tan sunucuda çözülebiliyor. Trigger
-- yalnızca alan BOŞ geldiğinde dolduruyor; güncel uygulama değeri gönderdiğinde
-- ona dokunmuyor (sipariş anındaki ad korunsun — seçenek sonradan yeniden
-- adlandırılırsa eski sipariş değişmemeli).

create or replace function public.fill_customization_english_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- İstemci göndermişse dokunma; snapshot mantığı korunuyor
  if new.option_name_en is not null and btrim(new.option_name_en) <> '' then
    return new;
  end if;

  -- Dinamik özelleştirmelerde (option_id null) kaynak yok; option_name'e düşülür
  if new.option_id is null then
    return new;
  end if;

  select nullif(btrim(po.name_en), '')
  into new.option_name_en
  from public.product_options po
  where po.id = new.option_id;

  return new;
exception when others then
  -- Bu alan bir kolaylık; hiçbir koşulda sipariş kaydını engellemesin
  raise warning '[customization en-name] doldurulamadi: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_fill_customization_english_name on public.order_item_customizations;
create trigger trg_fill_customization_english_name
  before insert on public.order_item_customizations
  for each row
  execute function public.fill_customization_english_name();

-- Halihazırda boş kalmış satırları da doldur (19 Ağustos siparişleri dahil)
update public.order_item_customizations oic
set option_name_en = po.name_en
from public.product_options po
where oic.option_id = po.id
  and (oic.option_name_en is null or btrim(oic.option_name_en) = '')
  and po.name_en is not null
  and btrim(po.name_en) <> '';

do $$
declare
  v_total int;
  v_empty int;
begin
  select count(*), count(*) filter (where option_name_en is null)
  into v_total, v_empty
  from public.order_item_customizations;
  raise notice '✅ trigger kuruldu — % kayıttan %''si hala bos (dinamik/kaynaksiz)', v_total, v_empty;
end $$;
