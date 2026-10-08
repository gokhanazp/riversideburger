-- Siparişin pazarlama kaynağı (web). Google Ads / organik / Meta / doğrudan
-- sayımı GA4'ten bağımsız, bizim kesin sayımız olsun diye siparişe yazılıyor.
-- Ham parametreler attribution (jsonb), türetilmiş kanal channel (text).
-- Uygulama siparişlerinde boş kalır; raporda 'app' sayılır.
alter table public.orders
  add column if not exists attribution jsonb,
  add column if not exists channel text;
comment on column public.orders.channel is
  'google_ads | google_organic | meta | other_campaign | direct | referral; web siparişinde order-draft türetiyor.';
create index if not exists orders_channel_idx on public.orders (channel) where channel is not null;

create or replace function public.report_acquisition(p_from timestamptz, p_to timestamptz, p_statuses text[] default null, p_source text default null)
returns table (channel text, orders bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select coalesce(o.channel, case when coalesce(o.source, 'app') = 'app' then 'app' else 'unknown' end)::text,
         count(*)::bigint,
         coalesce(sum(o.total_amount), 0)::numeric(12,2)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and public.report_source_matches(o.source, p_source)
    and public.report_order_matches(o.status, o.payment_status, p_statuses)
  group by 1 order by 2 desc;
end $$;
grant execute on function public.report_acquisition(timestamptz, timestamptz, text[], text) to authenticated;
