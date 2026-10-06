-- İleri tarihli sipariş ("Schedule for later"), 1. aşama: yalnızca gel-al.
--
-- Akış: müşteri dilim seçer → sipariş status='scheduled' olarak doğar, ödeme
-- hemen alınır, mutfak bildirimi ve fiş GİTMEZ → pg_cron dakikada bir
-- release_scheduled_orders() çalıştırır: teslim saatinden prep dakika önce
-- status 'pending' olur ve o anda normal "yeni sipariş" akışı başlar.
-- Dilim kuralları panelden (settings.scheduling_*); doğrulama BURADA, çünkü
-- uygulama siparişi doğrudan tabloya yazıyor.

-- ── Ayarlar ────────────────────────────────────────────────────────────────
alter table public.settings
  add column if not exists scheduling_enabled boolean not null default true,
  add column if not exists scheduling_min_lead_minutes int not null default 45,
  add column if not exists scheduling_max_days int not null default 7,
  add column if not exists scheduling_slot_minutes int not null default 15,
  add column if not exists scheduling_prep_minutes int not null default 20,
  add column if not exists scheduling_close_buffer_minutes int not null default 30;

-- ── Sipariş alanları ───────────────────────────────────────────────────────
alter table public.orders
  add column if not exists scheduled_for timestamptz,
  add column if not exists released_at timestamptz;
comment on column public.orders.scheduled_for is 'İleri tarihli siparişte müşterinin seçtiği teslim anı (UTC). NULL = hemen.';
comment on column public.orders.released_at is 'scheduled → pending geçiş anı (zamanlayıcı ya da admin "şimdi başlat").';

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.orders'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%delivering%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.orders add constraint orders_status_check
  check (status in ('scheduled', 'pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'));

create index if not exists orders_scheduled_release_idx on public.orders (scheduled_for) where status = 'scheduled';

-- ── Dilim doğrulaması (scheduling.ts ile aynı kurallar) ────────────────────
create or replace function public.scheduling_slot_ok(p_ts timestamptz, p_now timestamptz default now())
returns text
language plpgsql stable set search_path = public as $$
declare
  s record;
  local_ts timestamp;
  d date; wd text; dh jsonb;
  open_t time; close_t time;
  win_start timestamptz; win_end timestamptz;
  ok boolean := false;
  i int;
begin
  select * into s from public.settings limit 1;
  if s is null or not coalesce(s.scheduling_enabled, false) then return 'disabled'; end if;
  if p_ts < p_now + make_interval(mins => s.scheduling_min_lead_minutes - 2) then return 'too_soon'; end if;
  if p_ts > p_now + make_interval(days => s.scheduling_max_days + 1) then return 'too_far'; end if;
  local_ts := p_ts at time zone 'America/Toronto';
  if extract(second from local_ts) <> 0
     or (extract(minute from local_ts)::int % greatest(5, s.scheduling_slot_minutes)) <> 0 then
    return 'invalid';
  end if;
  -- Servis günü: yerel tarih ya da bir önceki gün (gece yarısını geçen kapanış).
  for i in 0..1 loop
    d := local_ts::date - i;
    wd := trim(to_char(d, 'day'));
    dh := s.working_hours -> wd;
    if dh is null or not coalesce((dh->>'enabled')::boolean, false) then continue; end if;
    begin
      open_t := (dh->>'open')::time;
      close_t := (dh->>'close')::time;
    exception when others then continue; end;
    win_start := (d + open_t) at time zone 'America/Toronto';
    if close_t <= open_t then
      win_end := ((d + 1) + close_t) at time zone 'America/Toronto';
    else
      win_end := (d + close_t) at time zone 'America/Toronto';
    end if;
    win_end := win_end - make_interval(mins => s.scheduling_close_buffer_minutes);
    if p_ts >= win_start and p_ts <= win_end then ok := true; end if;
  end loop;
  if not ok then return 'closed'; end if;
  return null;
end $$;
grant execute on function public.scheduling_slot_ok(timestamptz, timestamptz) to anon, authenticated;

create or replace function public.orders_scheduling_guard()
returns trigger
language plpgsql set search_path = public as $$
declare reason text;
begin
  if new.scheduled_for is null then return new; end if;
  if tg_op = 'UPDATE' and old.scheduled_for is not distinct from new.scheduled_for then return new; end if;
  if coalesce(new.delivery_method, 'pickup') <> 'pickup' then
    raise exception 'scheduling: pickup only' using errcode = 'check_violation';
  end if;
  reason := public.scheduling_slot_ok(new.scheduled_for);
  if reason is not null then
    raise exception 'scheduling: %', reason using errcode = 'check_violation';
  end if;
  -- İleri tarihli sipariş HER ZAMAN scheduled doğar; istemci ne yazarsa yazsın.
  if tg_op = 'INSERT' then new.status := 'scheduled'; end if;
  return new;
end $$;

drop trigger if exists trg_orders_scheduling_guard on public.orders;
create trigger trg_orders_scheduling_guard
  before insert or update of scheduled_for on public.orders
  for each row execute function public.orders_scheduling_guard();

-- ── Serbest bırakma ────────────────────────────────────────────────────────
create or replace function public.release_scheduled_orders()
returns int
language plpgsql security definer set search_path = public as $$
declare n int; prep int;
begin
  select coalesce(scheduling_prep_minutes, 20) into prep from public.settings limit 1;
  update public.orders
     set status = 'pending', released_at = now()
   where status = 'scheduled'
     and payment_status = 'paid'
     and scheduled_for - make_interval(mins => coalesce(prep, 20)) <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.release_scheduled_orders() from public;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'release-scheduled-orders';
  perform cron.schedule('release-scheduled-orders', '* * * * *', $cron$select public.release_scheduled_orders()$cron$);
end $$;

-- ── Mutfak bildirimleri: scheduled doğan sipariş SESSİZ, serbest kalınca sesli ──
drop trigger if exists trg_notify_admins_on_paid_order_insert on public.orders;
create trigger trg_notify_admins_on_paid_order_insert
  after insert on public.orders for each row
  when (new.payment_status = 'paid' and new.status <> 'scheduled')
  execute function public.notify_admins_on_new_order();

drop trigger if exists trg_notify_admins_on_paid_order_update on public.orders;
create trigger trg_notify_admins_on_paid_order_update
  after update of payment_status on public.orders for each row
  when (old.payment_status is distinct from 'paid' and new.payment_status = 'paid' and new.status <> 'scheduled')
  execute function public.notify_admins_on_new_order();

drop trigger if exists trg_push_admins_on_paid_order_insert on public.orders;
create trigger trg_push_admins_on_paid_order_insert
  after insert on public.orders for each row
  when (new.payment_status = 'paid' and new.status <> 'scheduled')
  execute function public.push_admins_on_new_order();

drop trigger if exists trg_push_admins_on_paid_order_update on public.orders;
create trigger trg_push_admins_on_paid_order_update
  after update of payment_status on public.orders for each row
  when (old.payment_status is distinct from 'paid' and new.payment_status = 'paid' and new.status <> 'scheduled')
  execute function public.push_admins_on_new_order();

drop trigger if exists trg_notify_admins_on_release on public.orders;
create trigger trg_notify_admins_on_release
  after update of status on public.orders for each row
  when (old.status = 'scheduled' and new.status = 'pending' and new.payment_status = 'paid')
  execute function public.notify_admins_on_new_order();

drop trigger if exists trg_push_admins_on_release on public.orders;
create trigger trg_push_admins_on_release
  after update of status on public.orders for each row
  when (old.status = 'scheduled' and new.status = 'pending' and new.payment_status = 'paid')
  execute function public.push_admins_on_new_order();
