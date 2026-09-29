-- İki düzeltme (ilk denemede gerçek veride yakalandı):
--   • report_summary: RETURNS TABLE sütun adları (points_used, tips…) tablo
--     sütunlarıyla çakışıyordu → "ambiguous". #variable_conflict use_column
--     ile niteliksiz adlar tablo sütununa çözülüyor.
--   • report_top_products: products.name / menu_categories.name_en
--     varchar(100); dönüş tipi text → açık cast.

create or replace function public.report_summary(p_from timestamptz, p_to timestamptz)
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
      and o.payment_status = 'paid' and o.status <> 'cancelled'
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
  p_from timestamptz, p_to timestamptz, p_limit int default 20
)
returns table (
  product_id uuid, name text, category text, qty bigint, revenue numeric, share_pct numeric
)
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
      and o.payment_status = 'paid' and o.status <> 'cancelled'
  ),
  agg as (
    select l.product_id, sum(l.quantity)::bigint as qty, sum(l.subtotal)::numeric(12,2) as revenue
    from lines l group by l.product_id
  ),
  tot as (select coalesce(sum(a.revenue), 0) as r from agg a)
  select a.product_id, coalesce(p.name, 'Deleted product')::text, c.name_en::text,
         a.qty, a.revenue,
         (case when tot.r > 0 then round(100 * a.revenue / tot.r, 1) else 0 end)::numeric
  from agg a
  left join public.products p on p.id = a.product_id
  left join public.menu_categories c on c.id = p.category_id
  cross join tot
  order by a.qty desc, a.revenue desc
  limit p_limit;
end $$;
