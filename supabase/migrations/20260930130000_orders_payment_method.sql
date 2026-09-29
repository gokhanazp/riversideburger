-- orders.payment_method hiç yazılmıyordu (157 siparişin hepsinde boş) — rapor
-- "ödeme yöntemi" kırılımı için gerek. İki iş:
--   1. Geriye dönük: uygulama ödemeleri payments tablosuna yöntemi zaten
--      yazıyor (confirm-payment → 'card'); order_id üzerinden siparişe taşınır.
--   2. Bundan sonrası kodda: web (place-order, Stripe Checkout) ve uygulama
--      (confirm-payment) siparişe normalize edilmiş etiket yazar:
--      card | apple_pay | google_pay | link (| cash — elden alınırsa).
update public.orders o
   set payment_method = p.payment_method
  from public.payments p
 where p.order_id = o.id
   and p.status = 'succeeded'
   and p.payment_method is not null
   and o.payment_method is null;

create index if not exists orders_payment_method_idx on public.orders (payment_method);
