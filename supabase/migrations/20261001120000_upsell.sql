-- Ekstra satış ("Goes well with").
--
-- İki kaynak: ürün bazlı eşler (product_pairings) ve genel havuz
-- (products.upsell_rank dolu olanlar). upsell_suggestions() sepetteki ürünlere
-- göre önce eşleri, sonra havuzu döndürür; sepettekileri ve stokta olmayanları
-- eler. Uygulama ve web aynı fonksiyonu anon anahtarla çağırır.
-- Ölçüm: order_items.added_via ('menu' | 'upsell'); report_upsell() raporlar.

alter table public.products add column if not exists upsell_rank int;
comment on column public.products.upsell_rank is
  'Dolu ise ürün genel ekstra-satış havuzunda; küçük sayı önce gelir. NULL = havuzda değil.';

create table if not exists public.product_pairings (
  product_id uuid not null references public.products(id) on delete cascade,
  suggested_product_id uuid not null references public.products(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, suggested_product_id),
  check (product_id <> suggested_product_id)
);
alter table public.product_pairings enable row level security;
drop policy if exists "anyone reads pairings" on public.product_pairings;
create policy "anyone reads pairings" on public.product_pairings for select using (true);
drop policy if exists "admins manage pairings" on public.product_pairings;
create policy "admins manage pairings" on public.product_pairings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.order_items add column if not exists added_via text
  check (added_via is null or added_via in ('menu', 'upsell'));
comment on column public.order_items.added_via is 'upsell = sepetteki "Goes well with" şeridinden eklendi.';

-- Öneriler. p_product_ids = sepetteki ürünler (boş olabilir: ürün sayfası
-- için tek ürün verilir). has_options: web'de seçenekli ürün sepete doğrudan
-- girmez, ürün sayfasına gider.
create or replace function public.upsell_suggestions(p_product_ids uuid[] default '{}', p_limit int default 3)
returns table (
  id uuid, name text, description text, price numeric, image_url text, category_id uuid,
  has_options boolean, source text
)
language sql stable security definer set search_path = public as $$
  with cart as (select unnest(coalesce(p_product_ids, '{}'::uuid[])) as pid),
  candidates as (
    -- 1) sepettekilerin eşleri
    select pp.suggested_product_id as id, 0 as tier, min(pp.sort_order) as ord
    from public.product_pairings pp join cart on cart.pid = pp.product_id
    group by pp.suggested_product_id
    union all
    -- 2) genel havuz
    select p.id, 1 as tier, p.upsell_rank as ord
    from public.products p where p.upsell_rank is not null
  ),
  ranked as (
    select c.id, min(c.tier) as tier, min(c.ord) as ord from candidates c group by c.id
  )
  select p.id, p.name, p.description, p.price, p.image_url, p.category_id,
         exists (select 1 from public.product_specific_options o where o.product_id = p.id) as has_options,
         case when r.tier = 0 then 'pairing' else 'pool' end as source
  from ranked r join public.products p on p.id = r.id
  where p.is_active = true
    and coalesce(p.stock_status, 'in_stock') = 'in_stock'
    and p.id <> all (coalesce(p_product_ids, '{}'::uuid[]))
  order by r.tier, r.ord nulls last, p.display_order nulls last, p.name
  limit greatest(1, least(coalesce(p_limit, 3), 8));
$$;
grant execute on function public.upsell_suggestions(uuid[], int) to anon, authenticated;

-- Rapor: ekstra satış katkısı.
create or replace function public.report_upsell(p_from timestamptz, p_to timestamptz, p_statuses text[] default null, p_source text default null)
returns table (orders_total bigint, orders_with_upsell bigint, upsell_items bigint, upsell_revenue numeric, attach_rate_pct numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  with sel as (
    select o.id from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
      and public.report_source_matches(o.source, p_source)
      and public.report_order_matches(o.status, o.payment_status, p_statuses)
  ),
  up as (
    select i.order_id, sum(i.quantity)::bigint as qty, sum(i.subtotal)::numeric as rev
    from public.order_items i join sel on sel.id = i.order_id
    where i.added_via = 'upsell' group by i.order_id
  )
  select (select count(*) from sel)::bigint,
         (select count(*) from up)::bigint,
         coalesce((select sum(qty) from up), 0)::bigint,
         coalesce((select sum(rev) from up), 0)::numeric(12,2),
         (case when (select count(*) from sel) > 0
               then round(100.0 * (select count(*) from up) / (select count(*) from sel), 1) else 0 end)::numeric;
end $$;
grant execute on function public.report_upsell(timestamptz, timestamptz, text[], text) to authenticated;
