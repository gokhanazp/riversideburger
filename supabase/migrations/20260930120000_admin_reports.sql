-- Admin raporları: toplamlar VERİTABANINDA hesaplanır, uygulamaya yalnızca
-- sonuç satırları gider.
--
-- Neden: AdminDashboard teslim edilmiş tüm siparişlerin tutarını telefona
-- çekip orada topluyor. 157 siparişte fark etmiyor; 5.000'de her açılış
-- megabaytlarca veri demek. Buradaki fonksiyonlar bir tarih aralığı alır ve
-- Postgres'in bir milisaniyede yaptığı işi yapar.
--
-- Ortak kurallar:
--   • Yalnızca admin (is_admin()). security definer, çünkü RLS müşteriye
--     kendi siparişlerinden fazlasını göstermiyor.
--   • "Sipariş" = payment_status='paid' ve status<>'cancelled'. İptal ayrı
--     sayılıyor, ciroya girmiyor.
--   • Tüm gün/hafta/ay kırılımları America/Toronto saatine göre.
--   • Tarih aralığı yarı açık: [p_from, p_to).

-- ── Zaman serisi ───────────────────────────────────────────────────────────
create or replace function public.report_timeseries(
  p_from timestamptz, p_to timestamptz, p_bucket text default 'day'
)
returns table (
  bucket date, orders bigint, revenue numeric, avg_order numeric,
  pickup bigint, delivery bigint, web bigint, app bigint, cancelled bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_bucket not in ('day', 'week', 'month', 'year') then raise exception 'bucket: day|week|month|year'; end if;
  return query
  select
    date_trunc(p_bucket, o.created_at at time zone 'America/Toronto')::date as bucket,
    count(*) filter (where o.payment_status = 'paid' and o.status <> 'cancelled') as orders,
    coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid' and o.status <> 'cancelled'), 0)::numeric(12,2) as revenue,
    coalesce(avg(o.total_amount) filter (where o.payment_status = 'paid' and o.status <> 'cancelled'), 0)::numeric(12,2) as avg_order,
    count(*) filter (where o.payment_status = 'paid' and o.status <> 'cancelled' and o.delivery_method = 'pickup') as pickup,
    count(*) filter (where o.payment_status = 'paid' and o.status <> 'cancelled' and o.delivery_method = 'delivery') as delivery,
    count(*) filter (where o.payment_status = 'paid' and o.status <> 'cancelled' and o.source = 'web') as web,
    count(*) filter (where o.payment_status = 'paid' and o.status <> 'cancelled' and coalesce(o.source, 'app') = 'app') as app,
    count(*) filter (where o.status = 'cancelled') as cancelled
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  group by 1
  order by 1;
end $$;

-- ── Dönem özeti (tek satır) ────────────────────────────────────────────────
create or replace function public.report_summary(p_from timestamptz, p_to timestamptz)
returns table (
  orders bigint, revenue numeric, avg_order numeric, cancelled bigint,
  pickup bigint, delivery bigint, web bigint, app bigint,
  discount_total numeric, points_used numeric, points_earned numeric, tips numeric, tax numeric,
  customers bigint, new_customers bigint, returning_customers bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with paid as (
    select o.* from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
      and o.payment_status = 'paid' and o.status <> 'cancelled'
  ),
  -- Dönemde sipariş veren müşterinin bu dönemden ÖNCE ödenmiş siparişi var mı?
  cust as (
    select p.user_id,
           exists (select 1 from public.orders q
                    where q.user_id = p.user_id and q.payment_status = 'paid'
                      and q.status <> 'cancelled' and q.created_at < p_from) as seen_before
    from paid p group by p.user_id
  )
  select
    (select count(*) from paid),
    coalesce((select sum(total_amount) from paid), 0)::numeric(12,2),
    coalesce((select avg(total_amount) from paid), 0)::numeric(12,2),
    (select count(*) from public.orders o where o.created_at >= p_from and o.created_at < p_to and o.status = 'cancelled'),
    (select count(*) from paid where delivery_method = 'pickup'),
    (select count(*) from paid where delivery_method = 'delivery'),
    (select count(*) from paid where source = 'web'),
    (select count(*) from paid where coalesce(source, 'app') = 'app'),
    coalesce((select sum(discount_amount) from paid), 0)::numeric(12,2),
    coalesce((select sum(points_used) from paid), 0)::numeric(12,2),
    coalesce((select sum(points_earned) from paid), 0)::numeric(12,2),
    coalesce((select sum(tip_amount) from paid), 0)::numeric(12,2),
    coalesce((select sum(tax_amount) from paid), 0)::numeric(12,2),
    (select count(*) from cust),
    (select count(*) from cust where not seen_before),
    (select count(*) from cust where seen_before);
end $$;

-- ── En çok satan ürünler ───────────────────────────────────────────────────
create or replace function public.report_top_products(
  p_from timestamptz, p_to timestamptz, p_limit int default 20
)
returns table (
  product_id uuid, name text, category text, qty bigint, revenue numeric, share_pct numeric
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with lines as (
    select oi.product_id, oi.quantity, oi.subtotal
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at >= p_from and o.created_at < p_to
      and o.payment_status = 'paid' and o.status <> 'cancelled'
  ),
  agg as (
    select l.product_id, sum(l.quantity)::bigint as qty, sum(l.subtotal)::numeric(12,2) as revenue
    from lines l group by l.product_id
  ),
  tot as (select coalesce(sum(a.revenue), 0) as r from agg a)
  select a.product_id, coalesce(p.name, 'Deleted product') as name, c.name_en as category,
         a.qty, a.revenue,
         case when tot.r > 0 then round(100 * a.revenue / tot.r, 1) else 0 end as share_pct
  from agg a
  left join public.products p on p.id = a.product_id
  left join public.menu_categories c on c.id = p.category_id
  cross join tot
  order by a.qty desc, a.revenue desc
  limit p_limit;
end $$;

-- ── En çok seçilen ek malzeme / seçenek ────────────────────────────────────
create or replace function public.report_top_options(
  p_from timestamptz, p_to timestamptz, p_limit int default 15
)
returns table (option_name text, qty bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select coalesce(oc.option_name_en, oc.option_name) as option_name,
         sum(coalesce(oc.quantity, 1))::bigint as qty,
         sum(coalesce(oc.option_price, 0) * coalesce(oc.quantity, 1))::numeric(12,2) as revenue
  from public.order_item_customizations oc
  join public.orders o on o.id = oc.order_id
  where o.created_at >= p_from and o.created_at < p_to
    and o.payment_status = 'paid' and o.status <> 'cancelled'
  group by 1
  order by qty desc
  limit p_limit;
end $$;

-- ── Müşteriler: tekrar edenler ve "kaybolanlar" ────────────────────────────
create or replace function public.report_customers(
  p_from timestamptz, p_to timestamptz, p_limit int default 50
)
returns table (
  user_id uuid, name text, email text, is_guest boolean,
  orders_in_period bigint, spent_in_period numeric,
  lifetime_orders bigint, lifetime_spent numeric,
  first_order_at timestamptz, last_order_at timestamptz, days_since_last int
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with paid as (
    select o.user_id, o.total_amount, o.created_at
    from public.orders o
    where o.payment_status = 'paid' and o.status <> 'cancelled'
  ),
  life as (
    select p.user_id, count(*) as n, sum(p.total_amount) as s,
           min(p.created_at) as first_at, max(p.created_at) as last_at
    from paid p group by p.user_id
  ),
  period as (
    select p.user_id, count(*) as n, sum(p.total_amount) as s
    from paid p where p.created_at >= p_from and p.created_at < p_to
    group by p.user_id
  )
  select l.user_id, u.full_name, u.email, (u.signup_source = 'guest') as is_guest,
         coalesce(pe.n, 0)::bigint, coalesce(pe.s, 0)::numeric(12,2),
         l.n::bigint, l.s::numeric(12,2),
         l.first_at, l.last_at,
         extract(day from now() - l.last_at)::int
  from life l
  join public.users u on u.id = l.user_id
  left join period pe on pe.user_id = l.user_id
  where coalesce(u.role, 'customer') = 'customer'
    and (pe.user_id is not null or l.n >= 2)
  order by coalesce(pe.n, 0) desc, l.n desc, l.s desc
  limit p_limit;
end $$;

-- ── Gün × saat yoğunluğu ───────────────────────────────────────────────────
create or replace function public.report_hours(p_from timestamptz, p_to timestamptz)
returns table (dow int, hour int, orders bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select extract(isodow from (o.created_at at time zone 'America/Toronto'))::int as dow,
         extract(hour from (o.created_at at time zone 'America/Toronto'))::int as hour,
         count(*)::bigint, coalesce(sum(o.total_amount), 0)::numeric(12,2)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and o.payment_status = 'paid' and o.status <> 'cancelled'
  group by 1, 2
  order by 1, 2;
end $$;

-- ── Kanal / ödeme yöntemi / teslimat ──────────────────────────────────────
create or replace function public.report_channels(p_from timestamptz, p_to timestamptz)
returns table (source text, payment_method text, delivery_method text, orders bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select coalesce(o.source, 'app'), coalesce(o.payment_method, 'unknown'), o.delivery_method,
         count(*)::bigint, coalesce(sum(o.total_amount), 0)::numeric(12,2)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and o.payment_status = 'paid' and o.status <> 'cancelled'
  group by 1, 2, 3
  order by 4 desc;
end $$;

-- ── Teslimat ekonomisi ─────────────────────────────────────────────────────
-- delivery_fee sütunu kurye çağrıldığında Uber'in restorana çıkardığı ücretle
-- EZİLİYOR (dispatch-uber.ts). Müşteriden alınan ücret toplamdan türetiliyor,
-- web sipariş sayfasındaki formülle aynı.
create or replace function public.report_delivery(p_from timestamptz, p_to timestamptz)
returns table (
  delivery_orders bigint, charged_delivery numeric, uber_cost numeric, net_delivery numeric,
  avg_charged numeric, avg_uber_cost numeric
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with d as (
    select o.id, o.total_amount, o.tax_amount, o.tip_amount, o.discount_amount, o.points_used,
           o.delivery_fee, o.uber_delivery_id,
           coalesce((select sum(oi.subtotal) from public.order_items oi where oi.order_id = o.id), 0) as items
    from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
      and o.payment_status = 'paid' and o.status <> 'cancelled'
      and o.delivery_method = 'delivery'
  ),
  calc as (
    select id,
           greatest(0, total_amount - coalesce(tax_amount, 0) - coalesce(tip_amount, 0)
                       - greatest(0, items - coalesce(discount_amount, 0) - coalesce(points_used, 0))) as charged,
           case when uber_delivery_id is not null then coalesce(delivery_fee, 0) else null end as uber
    from d
  )
  select count(*)::bigint,
         coalesce(sum(charged), 0)::numeric(12,2),
         coalesce(sum(uber), 0)::numeric(12,2),
         (coalesce(sum(charged), 0) - coalesce(sum(uber), 0))::numeric(12,2),
         coalesce(avg(charged), 0)::numeric(12,2),
         coalesce(avg(uber), 0)::numeric(12,2)
  from calc;
end $$;

-- Yalnızca oturumlu istemci çağırabilsin; içerideki is_admin() asıl kapı.
grant execute on function
  public.report_timeseries(timestamptz, timestamptz, text),
  public.report_summary(timestamptz, timestamptz),
  public.report_top_products(timestamptz, timestamptz, int),
  public.report_top_options(timestamptz, timestamptz, int),
  public.report_customers(timestamptz, timestamptz, int),
  public.report_hours(timestamptz, timestamptz),
  public.report_channels(timestamptz, timestamptz),
  public.report_delivery(timestamptz, timestamptz)
to authenticated;
