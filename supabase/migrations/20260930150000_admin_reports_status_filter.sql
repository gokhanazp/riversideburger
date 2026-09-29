-- Raporlara sipariş durumu filtresi.
--
-- p_statuses NULL → eski davranış: ödenmiş ve iptal edilmemiş siparişler.
-- p_statuses dolu → status = any(p_statuses). 'cancelled' seçilince ödeme
-- durumuna bakılmaz (iptalde payment_status 'refunded' ya da 'paid' olabilir);
-- diğer durumlarda yine yalnızca ödenmişler sayılır.
--
-- İmza değiştiği için eski fonksiyonlar DÜŞÜRÜLÜP yeniden yaratılıyor; aksi
-- halde PostgREST iki aşırı yükleme arasında kalıp "ambiguous" derdi.

create or replace function public.report_order_matches(
  p_status text, p_payment_status text, p_statuses text[]
) returns boolean
language sql immutable as $$
  select case
    when p_statuses is null then p_payment_status = 'paid' and p_status <> 'cancelled'
    when p_status = 'cancelled' then 'cancelled' = any(p_statuses)
    else p_payment_status = 'paid' and p_status = any(p_statuses)
  end;
$$;

drop function if exists public.report_timeseries(timestamptz, timestamptz, text);
drop function if exists public.report_summary(timestamptz, timestamptz);
drop function if exists public.report_top_products(timestamptz, timestamptz, int);
drop function if exists public.report_top_options(timestamptz, timestamptz, int);
drop function if exists public.report_customers(timestamptz, timestamptz, int);
drop function if exists public.report_hours(timestamptz, timestamptz);
drop function if exists public.report_channels(timestamptz, timestamptz);
drop function if exists public.report_delivery(timestamptz, timestamptz);

-- ── Duruma göre dağılım ────────────────────────────────────────────────────
create or replace function public.report_status_breakdown(p_from timestamptz, p_to timestamptz)
returns table (status text, orders bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select o.status::text, count(*)::bigint, coalesce(sum(o.total_amount), 0)::numeric(12,2)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  group by o.status
  order by 2 desc;
end $$;

create or replace function public.report_timeseries(
  p_from timestamptz, p_to timestamptz, p_bucket text default 'day', p_statuses text[] default null
)
returns table (
  bucket date, orders bigint, revenue numeric, avg_order numeric,
  pickup bigint, delivery bigint, web bigint, app bigint, cancelled bigint
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_bucket not in ('day', 'week', 'month', 'year') then raise exception 'bucket: day|week|month|year'; end if;
  return query
  with sel as (
    select o.*, public.report_order_matches(o.status, o.payment_status, p_statuses) as m
    from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
  )
  select
    date_trunc(p_bucket, s.created_at at time zone 'America/Toronto')::date,
    count(*) filter (where s.m),
    coalesce(sum(s.total_amount) filter (where s.m), 0)::numeric(12,2),
    coalesce(avg(s.total_amount) filter (where s.m), 0)::numeric(12,2),
    count(*) filter (where s.m and s.delivery_method = 'pickup'),
    count(*) filter (where s.m and s.delivery_method = 'delivery'),
    count(*) filter (where s.m and s.source = 'web'),
    count(*) filter (where s.m and coalesce(s.source, 'app') = 'app'),
    count(*) filter (where s.status = 'cancelled')
  from sel s
  group by 1
  order by 1;
end $$;

create or replace function public.report_summary(
  p_from timestamptz, p_to timestamptz, p_statuses text[] default null
)
returns table (
  orders bigint, revenue numeric, avg_order numeric, cancelled bigint,
  pickup bigint, delivery bigint, web bigint, app bigint,
  discount_total numeric, points_used numeric, points_earned numeric, tips numeric, tax numeric,
  customers bigint, new_customers bigint, returning_customers bigint
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with paid as (
    select o.* from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
      and public.report_order_matches(o.status, o.payment_status, p_statuses)
  ),
  cust as (
    select p.user_id,
           exists (select 1 from public.orders q
                    where q.user_id = p.user_id and q.payment_status = 'paid'
                      and q.status <> 'cancelled' and q.created_at < p_from) as seen_before
    from paid p group by p.user_id
  )
  select
    (select count(*) from paid),
    coalesce((select sum(pa.total_amount) from paid pa), 0)::numeric(12,2),
    coalesce((select avg(pa.total_amount) from paid pa), 0)::numeric(12,2),
    (select count(*) from public.orders o where o.created_at >= p_from and o.created_at < p_to and o.status = 'cancelled'),
    (select count(*) from paid pa where pa.delivery_method = 'pickup'),
    (select count(*) from paid pa where pa.delivery_method = 'delivery'),
    (select count(*) from paid pa where pa.source = 'web'),
    (select count(*) from paid pa where coalesce(pa.source, 'app') = 'app'),
    coalesce((select sum(pa.discount_amount) from paid pa), 0)::numeric(12,2),
    coalesce((select sum(pa.points_used) from paid pa), 0)::numeric(12,2),
    coalesce((select sum(pa.points_earned) from paid pa), 0)::numeric(12,2),
    coalesce((select sum(pa.tip_amount) from paid pa), 0)::numeric(12,2),
    coalesce((select sum(pa.tax_amount) from paid pa), 0)::numeric(12,2),
    (select count(*) from cust),
    (select count(*) from cust c where not c.seen_before),
    (select count(*) from cust c where c.seen_before);
end $$;

create or replace function public.report_top_products(
  p_from timestamptz, p_to timestamptz, p_limit int default 20, p_statuses text[] default null
)
returns table (product_id uuid, name text, category text, qty bigint, revenue numeric, share_pct numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with lines as (
    select oi.product_id, oi.quantity, oi.subtotal
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at >= p_from and o.created_at < p_to
      and public.report_order_matches(o.status, o.payment_status, p_statuses)
  ),
  agg as (select l.product_id, sum(l.quantity)::bigint as qty, sum(l.subtotal)::numeric(12,2) as revenue from lines l group by l.product_id),
  tot as (select coalesce(sum(a.revenue), 0) as r from agg a)
  select a.product_id, coalesce(p.name, 'Deleted product')::text, c.name_en::text, a.qty, a.revenue,
         (case when tot.r > 0 then round(100 * a.revenue / tot.r, 1) else 0 end)::numeric
  from agg a
  left join public.products p on p.id = a.product_id
  left join public.menu_categories c on c.id = p.category_id
  cross join tot
  order by a.qty desc, a.revenue desc
  limit p_limit;
end $$;

create or replace function public.report_top_options(
  p_from timestamptz, p_to timestamptz, p_limit int default 15, p_statuses text[] default null
)
returns table (option_name text, qty bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select coalesce(oc.option_name_en, oc.option_name)::text,
         sum(coalesce(oc.quantity, 1))::bigint,
         sum(coalesce(oc.option_price, 0) * coalesce(oc.quantity, 1))::numeric(12,2)
  from public.order_item_customizations oc
  join public.orders o on o.id = oc.order_id
  where o.created_at >= p_from and o.created_at < p_to
    and public.report_order_matches(o.status, o.payment_status, p_statuses)
  group by 1
  order by 2 desc
  limit p_limit;
end $$;

create or replace function public.report_customers(
  p_from timestamptz, p_to timestamptz, p_limit int default 50, p_statuses text[] default null
)
returns table (
  user_id uuid, name text, email text, is_guest boolean,
  orders_in_period bigint, spent_in_period numeric,
  lifetime_orders bigint, lifetime_spent numeric,
  first_order_at timestamptz, last_order_at timestamptz, days_since_last int
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with paid as (
    select o.user_id, o.total_amount, o.created_at from public.orders o
    where o.payment_status = 'paid' and o.status <> 'cancelled'
  ),
  life as (select p.user_id, count(*) as n, sum(p.total_amount) as s, min(p.created_at) as first_at, max(p.created_at) as last_at from paid p group by p.user_id),
  period as (
    select o.user_id, count(*) as n, sum(o.total_amount) as s from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
      and public.report_order_matches(o.status, o.payment_status, p_statuses)
    group by o.user_id
  )
  select l.user_id, u.full_name::text, u.email::text, (u.signup_source = 'guest'),
         coalesce(pe.n, 0)::bigint, coalesce(pe.s, 0)::numeric(12,2),
         l.n::bigint, l.s::numeric(12,2), l.first_at, l.last_at,
         extract(day from now() - l.last_at)::int
  from life l
  join public.users u on u.id = l.user_id
  left join period pe on pe.user_id = l.user_id
  where coalesce(u.role, 'customer') = 'customer'
    and (pe.user_id is not null or (p_statuses is null and l.n >= 2))
  order by coalesce(pe.n, 0) desc, l.n desc, l.s desc
  limit p_limit;
end $$;

create or replace function public.report_hours(p_from timestamptz, p_to timestamptz, p_statuses text[] default null)
returns table (dow int, hour int, orders bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select extract(isodow from (o.created_at at time zone 'America/Toronto'))::int,
         extract(hour from (o.created_at at time zone 'America/Toronto'))::int,
         count(*)::bigint, coalesce(sum(o.total_amount), 0)::numeric(12,2)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and public.report_order_matches(o.status, o.payment_status, p_statuses)
  group by 1, 2 order by 1, 2;
end $$;

create or replace function public.report_channels(p_from timestamptz, p_to timestamptz, p_statuses text[] default null)
returns table (source text, payment_method text, delivery_method text, orders bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select coalesce(o.source, 'app')::text, coalesce(o.payment_method, 'unknown')::text, o.delivery_method::text,
         count(*)::bigint, coalesce(sum(o.total_amount), 0)::numeric(12,2)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and public.report_order_matches(o.status, o.payment_status, p_statuses)
  group by 1, 2, 3 order by 4 desc;
end $$;

create or replace function public.report_delivery(p_from timestamptz, p_to timestamptz, p_statuses text[] default null)
returns table (delivery_orders bigint, charged_delivery numeric, uber_cost numeric, net_delivery numeric, avg_charged numeric, avg_uber_cost numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with d as (
    select o.id, o.total_amount, o.tax_amount, o.tip_amount, o.discount_amount, o.points_used, o.delivery_fee, o.uber_delivery_id,
           coalesce((select sum(oi.subtotal) from public.order_items oi where oi.order_id = o.id), 0) as items
    from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
      and public.report_order_matches(o.status, o.payment_status, p_statuses)
      and o.delivery_method = 'delivery'
  ),
  calc as (
    select id,
           greatest(0, total_amount - coalesce(tax_amount, 0) - coalesce(tip_amount, 0)
                       - greatest(0, items - coalesce(discount_amount, 0) - coalesce(points_used, 0))) as charged,
           case when uber_delivery_id is not null then coalesce(delivery_fee, 0) else null end as uber
    from d
  )
  select count(*)::bigint, coalesce(sum(charged), 0)::numeric(12,2), coalesce(sum(uber), 0)::numeric(12,2),
         (coalesce(sum(charged), 0) - coalesce(sum(uber), 0))::numeric(12,2),
         coalesce(avg(charged), 0)::numeric(12,2), coalesce(avg(uber), 0)::numeric(12,2)
  from calc;
end $$;

grant execute on function
  public.report_status_breakdown(timestamptz, timestamptz),
  public.report_timeseries(timestamptz, timestamptz, text, text[]),
  public.report_summary(timestamptz, timestamptz, text[]),
  public.report_top_products(timestamptz, timestamptz, int, text[]),
  public.report_top_options(timestamptz, timestamptz, int, text[]),
  public.report_customers(timestamptz, timestamptz, int, text[]),
  public.report_hours(timestamptz, timestamptz, text[]),
  public.report_channels(timestamptz, timestamptz, text[]),
  public.report_delivery(timestamptz, timestamptz, text[])
to authenticated;
