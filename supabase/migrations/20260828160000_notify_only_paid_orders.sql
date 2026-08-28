-- Mutfak yalnızca ÖDENMİŞ siparişten haberdar olsun.
--
-- Sorun: iki bildirim tetikleyicisi de AFTER INSERT ile çalışıyordu ve ödeme
-- durumuna hiç bakmıyordu. Web sitesi siparişi ödemeden ÖNCE oluşturuyor
-- (fiyatı sunucuda hesaplayıp Stripe oturumunu ona göre açabilmek için), yani
-- müşteri ödeme sayfasını kapatsa bile tablet zil çalıyor, fiş basılıyor ve
-- mutfak ödenmemiş bir siparişe başlıyordu.
--
-- Çözüm: tetikleyiciler artık siparişin ÖDENDİĞİ anda çalışıyor:
--   • INSERT'te, sipariş zaten 'paid' geliyorsa (mobil uygulamanın normal yolu)
--   • UPDATE'te, payment_status 'paid'e GEÇTİĞİNDE (web sitesinin yolu)
-- WHEN koşulları sayesinde her sipariş için yalnızca bir kez tetikleniyor.
--
-- Fonksiyonlar DEĞİŞMİYOR; ikisi de sadece NEW.* alanlarını kullandığı için
-- UPDATE'te de aynı şekilde çalışıyorlar.

-- ── Edge Function'a push (pg_net) ──────────────────────────────────────────
drop trigger if exists trg_push_admins_on_new_order on public.orders;

create trigger trg_push_admins_on_paid_order_insert
  after insert on public.orders
  for each row
  when (new.payment_status = 'paid')
  execute function push_admins_on_new_order();

create trigger trg_push_admins_on_paid_order_update
  after update of payment_status on public.orders
  for each row
  when (old.payment_status is distinct from 'paid' and new.payment_status = 'paid')
  execute function push_admins_on_new_order();

-- ── notifications tablosuna kayıt ──────────────────────────────────────────
drop trigger if exists trigger_notify_admins_on_new_order on public.orders;

create trigger trg_notify_admins_on_paid_order_insert
  after insert on public.orders
  for each row
  when (new.payment_status = 'paid')
  execute function notify_admins_on_new_order();

create trigger trg_notify_admins_on_paid_order_update
  after update of payment_status on public.orders
  for each row
  when (old.payment_status is distinct from 'paid' and new.payment_status = 'paid')
  execute function notify_admins_on_new_order();
