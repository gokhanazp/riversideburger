-- Yeni sipariş geldiğinde admin'lere sunucu tarafından push gönder
--
-- Sorun: yeni sipariş uyarısı yalnızca uygulamanın içindeki realtime aboneliğine
-- bağlıydı. Uygulama kapalıysa, OS process'i öldürdüyse veya socket öldüyse
-- admin hiçbir uyarı almıyordu. Push'u gönderen ikinci yol da müşterinin
-- cihazıydı (orderService -> sendPushNotificationToAdmins); müşteri RLS yüzünden
-- admin listesini ve push_tokens'ı okuyamadığı için o yol sessizce hiç çalışmıyordu.
--
-- Çözüm: orders INSERT trigger'ı pg_net ile notify-admin-new-order Edge
-- Function'ını çağırıyor, fonksiyon service role ile token'ları okuyup Expo Push
-- API'ye gönderiyor.
--
-- ÖN KOŞUL — bu iki sırrı BİR KEZ elle kaydet (repoya sır yazmıyoruz):
--   select vault.create_secret(
--     'https://srcslhltajjvteqeptrt.supabase.co/functions/v1/notify-admin-new-order',
--     'admin_push_fn_url');
--   select vault.create_secret('<uzun-rastgele-sir>', 'admin_push_secret');
-- Aynı sır Edge Function tarafında da tanımlı olmalı:
--   supabase secrets set ADMIN_PUSH_SECRET='<uzun-rastgele-sir>'
--
-- Sır güncellemek için (create_secret aynı isimde ikinci kez hata verir):
--   select vault.update_secret(id, '<yeni-deger>')
--     from vault.secrets where name = 'admin_push_secret';

create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.push_admins_on_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'admin_push_fn_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'admin_push_secret';

  -- Sırlar kurulmadıysa sipariş akışını bozmadan sessizce çık
  if v_url is null or v_secret is null then
    raise warning '[admin push] vault sirlari eksik (admin_push_fn_url / admin_push_secret) — push atlandi';
    return new;
  end if;

  -- net.http_post isteği kuyruğa yazar ve COMMIT sonrası arka plan worker'ı
  -- gönderir: transaction'ı bloklamaz, hata siparişi geri almaz.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-admin-push-secret', v_secret
    ),
    body := jsonb_build_object('order_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  -- Bildirim hiçbir koşulda sipariş oluşturmayı engellemesin
  raise warning '[admin push] gonderilemedi: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_push_admins_on_new_order on public.orders;
create trigger trg_push_admins_on_new_order
  after insert on public.orders
  for each row
  execute function public.push_admins_on_new_order();

do $$
begin
  raise notice '✅ trg_push_admins_on_new_order kuruldu';
  if not exists (select 1 from vault.decrypted_secrets where name = 'admin_push_fn_url') then
    raise notice '⚠️  vault secret eksik: admin_push_fn_url';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'admin_push_secret') then
    raise notice '⚠️  vault secret eksik: admin_push_secret';
  end if;
end $$;
