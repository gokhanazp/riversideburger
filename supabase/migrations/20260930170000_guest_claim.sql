-- Misafir hesabını sahiplenme ("şifre belirle") akışı.
--
-- Misafir siparişiyle açılan hesap (users.signup_source = 'guest') gerçek bir
-- auth kullanıcısı; tek eksiği şifre. Müşteri web'deki /account/set-password
-- sayfasından şifre belirleyince bu fonksiyon hesabı üyeliğe çeviriyor:
-- signup_source 'web' olur (admin listesi ve mevcut raporlar başka değişiklik
-- istemeden üye sayar), claimed_at ise dönüşümü saymak için kalır.

alter table public.users add column if not exists claimed_at timestamptz;
comment on column public.users.claimed_at is
  'Misafir (signup_source=guest) hesabın şifre belirleyip üyeliğe dönüştüğü an. '
  'O anda signup_source web olur; bu sütun dönüşüm sayımı için tutuluyor.';

create or replace function public.claim_guest_account()
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update public.users
     set signup_source = 'web', claimed_at = now()
   where id = auth.uid() and signup_source = 'guest';
  return found;
end $$;

revoke all on function public.claim_guest_account() from public;
grant execute on function public.claim_guest_account() to authenticated;

-- email_log yeni türü tanısın (request-password-link buraya yazıyor; ref_id
-- boş bırakılıyor ki tekil indeks yeniden göndermeyi engellemesin — aralık
-- sınırı fonksiyonun kendisinde).
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('welcome', 'order', 'campaign', 'review_request', 'set_password'));
