-- Mevcut misafir hesaplarına tek seferlik "hesabını kaydet" daveti.
-- Gönderim send-email 'guest_invite' türüyle; kişi başı bir kez (email_log
-- tekil indeksi: kind + ref_id=user_id + email).
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('welcome', 'order', 'campaign', 'review_request', 'set_password', 'guest_invite'));
