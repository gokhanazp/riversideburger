-- Misafirin kendi siparişini görebilmesi için tahmin edilemez bir belirteç.
--
-- Sorun: sipariş verildikten sonra onay sayfası siparişi okuyamıyordu. orders
-- üzerindeki SELECT politikaları `auth.uid() = user_id` istiyor; misafir
-- oturumsuz olduğu için anon rolü hiçbir satır göremiyor.
--
-- RLS'i "herkes okuyabilsin"e çevirmek yanlış olurdu: sipariş numarası
-- ORD + zaman damgasının son 6 hanesi + 3 rastgele rakam, yani tahmin
-- edilebilir. Onun yerine her siparişe rastgele bir uuid takılıyor; onay
-- bağlantısı bunu taşıyor ve get-order fonksiyonu ikisinin eşleşmesini
-- şart koşuyor. Belirteci bilmeyen siparişi göremiyor.
--
-- Politikalar DEĞİŞMİYOR: okuma yine service_role ile get-order üzerinden
-- yapılıyor, anon rolüne yeni bir yetki verilmiyor.

alter table public.orders
  add column if not exists public_token uuid not null default gen_random_uuid();

comment on column public.orders.public_token is
  'Misafir onay sayfası için tahmin edilemez belirteç. get-order fonksiyonu order_number ile birlikte doğrular. Asla listelenmez.';
