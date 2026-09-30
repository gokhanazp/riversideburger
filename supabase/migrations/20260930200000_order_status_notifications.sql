-- Müşteriye sipariş durumu bildirimi (push / uygulama içi / e-posta).
--
-- Şimdiye kadar müşteriye hiçbir durum bildirimi gitmiyordu; uygulamadaki
-- sendOrderStatusNotification yerel bir yardımcıydı ve hiç çağrılmıyordu.
-- Artık orders.status değişince tetikleyici pg_net ile notify-order-status
-- fonksiyonuna haber veriyor; kanal seçimi ve metinler orada.
--
-- Mükerrer koruması: order_status_notifications (order_id, status, channel)
-- tekil. Aynı duruma iki kez geçilse bile ikinci bildirim gitmez.

create table if not exists public.order_status_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  channel text not null check (channel in ('push', 'inapp', 'email')),
  note text,
  created_at timestamptz not null default now(),
  unique (order_id, status, channel)
);
alter table public.order_status_notifications enable row level security;
-- Yalnızca service role yazar/okur; müşteri ve admin için politika yok.

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('welcome', 'order', 'campaign', 'review_request', 'set_password', 'guest_invite', 'catering_request', 'catering_ack', 'order_status'));

create or replace function public.notify_customer_on_status_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  -- send-email ile aynı sırlar; URL'de yalnızca fonksiyon adı değişiyor.
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_fn_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_fn_secret';
  if v_url is null or v_secret is null then
    raise warning '[order status] vault sirlari eksik (email_fn_url / email_fn_secret) — bildirim atlandi';
    return new;
  end if;
  v_url := replace(v_url, '/send-email', '/notify-order-status');

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', v_secret),
    body := jsonb_build_object('order_id', new.id, 'status', new.status, 'previous_status', old.status),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Bildirim hiçbir koşulda durum güncellemesini engellemesin.
  raise warning '[order status] gonderilemedi: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_notify_customer_on_status_change on public.orders;
create trigger trg_notify_customer_on_status_change
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status
        and new.status in ('confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'))
  execute function public.notify_customer_on_status_change();
