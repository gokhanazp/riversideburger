-- Sepet SATIRI kimliği. Özelleştirmeler (patty seçimi, ekstra, çıkarma)
-- şimdiye kadar yalnızca ürün kimliğiyle eşleşiyordu: aynı ürün iki satırda
-- (1 yükseltilmiş + 2 normal) olunca fiş ve admin ekranı yükseltmeyi her
-- satıra yazıyordu. Artık her satır bir line_id taşır; özelleştirme ona bağlı.
-- Eski siparişlerde NULL kalır, ekranlar ürün kimliğine düşer.
alter table public.order_items add column if not exists line_id text;
alter table public.order_item_customizations add column if not exists line_id text;
create index if not exists order_items_line_idx on public.order_items (order_id, line_id);
create index if not exists order_item_customizations_line_idx on public.order_item_customizations (order_id, line_id);
