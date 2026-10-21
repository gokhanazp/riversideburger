-- orders.payment_method uygulama siparişlerinde yine boş kalıyordu.
--
-- Neden: uygulama akışı önce confirm-payment'i çağırıyor (Stripe'tan kart
-- bilgisini alıp payments satırına yazıyor ve siparişe etiket basmaya
-- çalışıyor), siparişi ONDAN SONRA oluşturuyor, en son payments.order_id'yi
-- bağlıyor. Yani confirm-payment çalıştığında güncellenecek sipariş henüz yok;
-- 20260930130000'deki tek seferlik doldurma o günden sonrasını kapsamıyordu
-- (29 Eylül'den bu yana 41 uygulama siparişi "Kayıt yok").
--
-- Çözüm iki katmanlı:
--   1) Uygulama artık siparişi oluştururken payment_method'u kendisi yazıyor
--      (card / apple_pay / google_pay) — OTA ile gelen sürümlerde.
--   2) Bu tetikleyici: payments.order_id bağlandığında (ya da payments
--      satırına yöntem sonradan yazıldığında) siparişin yöntemi boşsa
--      payments'tan kopyala. Güncellenmemiş uygulamalar ve geçmiş için
--      güvenlik ağı. Uygulamanın yazdığı değer her zaman öncelikli (boş
--      değilse dokunulmaz).

create or replace function public.orders_payment_method_from_payment()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.order_id is null or new.payment_method is null then
    return new;
  end if;
  update public.orders o
     set payment_method = new.payment_method
   where o.id = new.order_id
     and o.payment_method is null;
  return new;
end $$;

drop trigger if exists trg_orders_payment_method_from_payment on public.payments;
create trigger trg_orders_payment_method_from_payment
  after insert or update of order_id, payment_method on public.payments
  for each row execute function public.orders_payment_method_from_payment();

-- Geçmiş: payments'ta yöntemi olan ama siparişte boş kalan satırlar.
-- Web'in eski siparişlerinde payments.payment_method da boş; onlar "Kayıt yok"
-- olarak kalır (rapordaki ipucu metni bunu zaten açıklıyor).
update public.orders o
   set payment_method = p.payment_method
  from public.payments p
 where p.order_id = o.id
   and p.payment_method is not null
   and o.payment_method is null;
