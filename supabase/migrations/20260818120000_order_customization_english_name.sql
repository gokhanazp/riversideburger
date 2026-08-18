-- Sipariş özelleştirmelerinin İngilizce adını da sakla
--
-- Sorun: admin panelinde gelen siparişte özelleştirmeler her zaman Türkçe
-- görünüyordu ("Domates Çıkar", "Marul Çıkar"), uygulama dili İngilizce olsa bile.
--
-- Sebep: product_options tablosunda İngilizce karşılıklar zaten var
-- ("Domates Çıkar" → "No Tomatoes") ve ürün detay ekranı müşteriye doğru dilde
-- gösteriyor. Ama sipariş verilirken order_item_customizations.option_name'e
-- yalnızca Türkçe `name` yazılıyordu; sipariş kaydı tek dilli bir kopya oluyordu.
--
-- Çözüm: sipariş anında iki adı birlikte sakla. Sipariş geçmişe dönük bir kayıt
-- olduğu için, seçenek sonradan yeniden adlandırılsa/silinse bile siparişteki
-- metin değişmemeli — bu yüzden görüntüleme anında JOIN etmek yerine
-- snapshot alıyoruz.

alter table public.order_item_customizations
  add column if not exists option_name_en text;

comment on column public.order_item_customizations.option_name_en is
  'Özelleştirmenin sipariş anındaki İngilizce adı (product_options.name_en kopyası). Boşsa option_name kullanılır.';

-- Mevcut siparişleri de doldur: gerçek seçeneğe bağlı satırlarda (option_id dolu)
-- İngilizce ad product_options''tan alınabiliyor. Dinamik/eski satırlarda
-- (option_id null) kaynak yok; option_name'e düşmeye devam edecekler.
update public.order_item_customizations oic
set option_name_en = po.name_en
from public.product_options po
where oic.option_id = po.id
  and oic.option_name_en is null
  and po.name_en is not null
  and btrim(po.name_en) <> '';

do $$
declare
  v_total int;
  v_filled int;
begin
  select count(*), count(option_name_en) into v_total, v_filled
  from public.order_item_customizations;
  raise notice '✅ option_name_en eklendi — % kayıttan %''si dolduruldu', v_total, v_filled;
end $$;
