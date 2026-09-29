-- Teslimattan bir saat sonra "Google'da değerlendir" ricası (push ya da e-posta).
--
-- Neden sunucu tarafı: uygulamadaki sipariş bildirimleri cihazda YEREL
-- kuruluyor; uygulama teslim anında açık değilse hiç gitmiyor, web
-- müşterisine ise zaten gitmiyor. Burada sipariş 'delivered' olunca bir
-- satır kuyruğa yazılıyor, pg_cron beş dakikada bir vadesi gelenleri
-- send-review-requests fonksiyonuna teslim ediyor (push varsa push, yoksa
-- e-posta). Tetikleme deseni admin push ve e-posta ile aynı: vault'tan URL +
-- sır, pg_net ile asenkron POST.
--
-- ÖN KOŞUL — fonksiyon URL'sini vault'a BİR KEZ kaydet (sır değil; e-posta
-- sırrı email_fn_secret yeniden kullanılıyor, fonksiyon da EMAIL_FN_SECRET'ı
-- bekliyor):
--   select vault.create_secret(
--     'https://srcslhltajjvteqeptrt.supabase.co/functions/v1/send-review-requests',
--     'review_fn_url');
--
-- Fonksiyon JWT denetimi KAPALI dağıtılmalı (cron oturum taşımıyor) —
-- supabase/config.toml bunu sabitliyor.

create extension if not exists pg_net;
create extension if not exists supabase_vault;
create extension if not exists pg_cron;

-- ── Kuyruk / defter ────────────────────────────────────────────────────────
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  send_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped', 'failed')),
  -- push | email — ne ile ulaşıldığı
  channel text check (channel in ('push', 'email')),
  note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Sipariş başına BİR rica.
create unique index if not exists review_requests_order_key on public.review_requests (order_id);
create index if not exists review_requests_due_idx on public.review_requests (send_at) where status = 'pending';
create index if not exists review_requests_user_idx on public.review_requests (user_id, sent_at desc);

alter table public.review_requests enable row level security;

-- Yalnızca admin okur; yazan yalnızca tetikleyici (security definer) ve
-- service_role ile çalışan fonksiyon.
drop policy if exists "Admins can read review requests" on public.review_requests;
create policy "Admins can read review requests" on public.review_requests
  for select to public
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

-- email_log yeni türü tanısın (send-email 'review_request' postasını buraya yazıyor).
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check check (kind in ('welcome', 'order', 'campaign', 'review_request'));

-- ── Tetikleyici: sipariş teslim edilince kuyruğa yaz ───────────────────────
--
-- Zamanlama: teslim + 60 dk. Sessiz saat 22:00–10:59 (Toronto): o aralığa
-- düşerse ertesi gün 11:00. Gece 1'de yemek alan birine 2'de rica gitmesin.
-- Müşteri başına 30 günde en fazla bir rica; personel hesabına ve ödenmemiş
-- siparişe hiç. Elenen satır da yazılıyor (status=skipped) ki "neden gitmedi"
-- sorusunun cevabı defterde olsun.
create or replace function public.queue_review_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp;
  v_send_at timestamptz;
  v_role text;
  v_recent int;
  v_status text := 'pending';
  v_note text := null;
begin
  if new.status <> 'delivered' or coalesce(old.status, '') = 'delivered' then
    return new;
  end if;

  if coalesce(new.payment_status, '') <> 'paid' then
    v_status := 'skipped'; v_note := 'not paid';
  end if;

  select role into v_role from public.users where id = new.user_id;
  if v_status = 'pending' and coalesce(v_role, 'customer') <> 'customer' then
    v_status := 'skipped'; v_note := 'staff account';
  end if;

  if v_status = 'pending' then
    select count(*) into v_recent
      from public.review_requests
     where user_id = new.user_id
       and status = 'sent'
       and sent_at > now() - interval '30 days';
    if v_recent > 0 then
      v_status := 'skipped'; v_note := 'asked within 30 days';
    end if;
  end if;

  v_local := (now() + interval '60 minutes') at time zone 'America/Toronto';
  if extract(hour from v_local) >= 22 then
    v_local := date_trunc('day', v_local) + interval '1 day' + interval '11 hours';
  elsif extract(hour from v_local) < 11 then
    v_local := date_trunc('day', v_local) + interval '11 hours';
  end if;
  v_send_at := v_local at time zone 'America/Toronto';

  insert into public.review_requests (order_id, user_id, send_at, status, note)
  values (new.id, new.user_id, v_send_at, v_status, v_note)
  on conflict (order_id) do nothing;

  return new;
exception when others then
  -- Rica hiçbir koşulda sipariş güncellemesini engellemesin.
  raise warning '[review request] kuyruga alinamadi: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_queue_review_request on public.orders;
create trigger trg_queue_review_request
  after update of status on public.orders
  for each row
  execute function public.queue_review_request();

-- ── Dağıtıcı: vadesi gelen varsa fonksiyonu çağır ──────────────────────────
create or replace function public.dispatch_review_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_due int;
begin
  select count(*) into v_due
    from public.review_requests
   where status = 'pending' and send_at <= now();
  if v_due = 0 then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'review_fn_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_fn_secret';
  if v_url is null or v_secret is null then
    raise warning '[review request] vault sirlari eksik (review_fn_url / email_fn_secret) — % rica bekliyor', v_due;
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', v_secret),
    body := jsonb_build_object('due', v_due),
    timeout_milliseconds := 15000
  );
end;
$$;

revoke all on function public.dispatch_review_requests() from public;

-- Beş dakikada bir. Aynı isimle ikinci kez kurulmasın diye önce kaldır.
do $$
begin
  perform cron.unschedule('send-review-requests');
exception when others then
  null;
end;
$$;
select cron.schedule('send-review-requests', '*/5 * * * *', $$select public.dispatch_review_requests()$$);
