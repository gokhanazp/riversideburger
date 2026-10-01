-- Catering başvuruları (web /catering formu).
-- Yazma yalnızca service role ile (catering-request fonksiyonu); admin okur ve
-- durum günceller. Müşteri satırı hiç görmez.
create table if not exists public.catering_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'booked', 'declined')),
  name text not null,
  company text,
  email text not null,
  phone text not null,
  event_date date,
  event_time text,
  guests int,
  event_type text,
  service text check (service in ('delivery', 'pickup')),
  address text,
  notes text,
  source text not null default 'web',
  user_agent text
);

create index if not exists catering_requests_created_at_idx on public.catering_requests (created_at desc);

alter table public.catering_requests enable row level security;

drop policy if exists "admins read catering requests" on public.catering_requests;
create policy "admins read catering requests" on public.catering_requests
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update catering requests" on public.catering_requests;
create policy "admins update catering requests" on public.catering_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- email_log: restorana giden bildirim + müşteriye giden alındı postası.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('welcome', 'order', 'campaign', 'review_request', 'set_password', 'guest_invite', 'catering_request', 'catering_ack'));
