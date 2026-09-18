-- İşlemsel e-posta: üyelik ve sipariş postaları.
--
-- Gönderim Resend üzerinden, send.riversideburgers.ca alt alan adından
-- yapılıyor. Alt alan bilinçli: kök alan adının MX/SPF/DMARC kayıtlarına
-- dokunulmuyor, böylece Google Workspace kurulumu (bugün ya da yarın)
-- etkilenmiyor.
--
-- Tetikleme deseni admin push bildirimiyle AYNI (20260817120000):
-- vault'tan URL + sır okunur, pg_net ile asenkron POST atılır. Böylece
-- e-posta göndermek sipariş oluşturmayı ne yavaşlatır ne de geri alır.

-- ÖN KOŞUL — bu iki sırrı BİR KEZ elle kaydet (repoya sır yazmıyoruz).
-- Aynı desen admin push bildiriminde de kullanılıyor.
--
--   select vault.create_secret(
--     'https://srcslhltajjvteqeptrt.supabase.co/functions/v1/send-email',
--     'email_fn_url');
--   select vault.create_secret('<uzun-rastgele-sir>', 'email_fn_secret');
--
-- Aynı sır Edge Function tarafında da tanımlı olmalı:
--   supabase secrets set EMAIL_FN_SECRET='<uzun-rastgele-sir>'
--
-- Sır güncellemek için (create_secret aynı isimde ikinci kez hata verir):
--   select vault.update_secret(id, '<yeni-deger>')
--     from vault.secrets where name = 'email_fn_secret';
--
-- Ayrıca RESEND_API_KEY secret'ı gerekiyor ve iki fonksiyon JWT denetimi
-- KAPALI dağıtılmalı — tetikleyici ve e-postadaki bağlantı oturum taşımıyor:
--   supabase functions deploy send-email --no-verify-jwt
--   supabase functions deploy unsubscribe --no-verify-jwt

create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- ── users: pazarlama izni ve abonelikten çıkma ─────────────────────────────
--
-- Kanada'da kampanya (ticari) postası için rıza, gönderen kimliği ve çalışan
-- bir abonelikten çıkma yolu gerekiyor. Sipariş onayı ve şifre sıfırlama gibi
-- işlemsel postalar bu kapsamda değil.
--
-- İZİN ZAMANI KAYDEDİLİYOR, boolean değil: "ne zaman onay verdi" sorusunun
-- yanıtı gerektiğinde boolean hiçbir şey söylemiyor.
alter table public.users
  add column if not exists marketing_consent_at timestamptz;

alter table public.users
  add column if not exists marketing_opt_out_at timestamptz;

-- Abonelikten çıkma bağlantısı oturum gerektirmemeli: müşteri postadaki linke
-- tıklayıp giriş yapmak zorunda kalmasın. Tahmin edilemez bir jeton bunu
-- güvenli kılıyor.
alter table public.users
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists users_unsubscribe_token_key
  on public.users (unsubscribe_token);

-- ── email_log: ne gönderildi, bir kez gönderildi ───────────────────────────
--
-- İki işi var:
--   1. MÜKERRER GÖNDERİMİ ENGELLEMEK. Sipariş postası hem INSERT hem
--      payment_status güncellemesiyle tetiklenebiliyor; ayrıca pg_net
--      isteğini yeniden deneyebiliyor. Müşteriye aynı fişi iki kez yollamak
--      güven kaybı.
--   2. DENETİM. "Kampanya postası kime gitti" sorusunun yanıtı burada.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  -- Adres ayrıca saklanıyor: kullanıcı silinse de kime gönderdiğimiz kalır.
  email text not null,
  kind text not null check (kind in ('welcome', 'order', 'campaign')),
  -- welcome → user_id, order → order_id, campaign → campaign_id
  ref_id uuid,
  provider_id text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- Aynı türden posta, aynı referans için, aynı adrese BİR kez.
create unique index if not exists email_log_once
  on public.email_log (kind, ref_id, email)
  where ref_id is not null;

create index if not exists email_log_user_idx on public.email_log (user_id);
create index if not exists email_log_created_idx on public.email_log (created_at desc);

alter table public.email_log enable row level security;

-- Yalnızca admin okuyabilir. YAZMA POLİTİKASI YOK: deftere yalnızca
-- service_role ile çalışan edge function yazıyor. İstemci yazabilse
-- mükerrer-engelini atlatmak ya da sahte kayıt bırakmak mümkün olurdu.
drop policy if exists "Admins can read email log" on public.email_log;
create policy "Admins can read email log" on public.email_log
  for select to public
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

-- ── Tetikleyiciler ─────────────────────────────────────────────────────────

-- Ortak gönderim çağrısı. Sır yoksa sessizce çıkıyor: e-posta altyapısı
-- kurulmamış bir ortamda sipariş ve kayıt akışı çalışmaya devam etmeli.
create or replace function public.queue_email(p_kind text, p_ref_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'email_fn_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'email_fn_secret';

  if v_url is null or v_secret is null then
    raise warning '[email] vault sirlari eksik (email_fn_url / email_fn_secret) — % postasi atlandi', p_kind;
    return;
  end if;

  -- net.http_post isteği kuyruğa yazar; COMMIT sonrası arka plan worker'ı
  -- gönderir. Transaction bloklanmaz, hata veri yazmayı geri almaz.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-secret', v_secret
    ),
    body := jsonb_build_object('kind', p_kind, 'ref_id', p_ref_id),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function public.queue_email(text, uuid) from public;

-- Üyelik postası: yeni kullanıcı satırı.
-- Uygulamadan ve web'den gelen kayıt aynı tabloya yazdığı için tek nokta
-- yeterli. Misafir siparişinde de users satırı açılıyor (place-order), o
-- yüzden misafir de "hesabınız hazır" postası alır — bu istenen davranış:
-- müşteri puanlarının biriktiğini bilmeli.
create or replace function public.email_on_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or new.email = '' then
    return new;
  end if;
  -- Personel hesaplarına hoş geldin postası gitmesin.
  if coalesce(new.role, 'customer') <> 'customer' then
    return new;
  end if;
  perform public.queue_email('welcome', new.id);
  return new;
exception when others then
  raise warning '[email] hos geldin postasi kuyruga alinamadi: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_email_on_new_user on public.users;
create trigger trg_email_on_new_user
  after insert on public.users
  for each row
  execute function public.email_on_new_user();

-- Sipariş postası: ödeme alındığında.
--
-- İKİ YOLDAN TETİKLENİYOR, bilinçli olarak:
--   • web  → place-order satırı doğrudan payment_status='paid' yazıyor (INSERT)
--   • mobil → sipariş 'pending' açılıp sonra 'paid'e geçebiliyor (UPDATE)
-- Mükerrer gönderimi email_log'daki tekil indeks engelliyor, tetikleyici
-- değil: hangi yolun önce geldiğini tahmin etmeye çalışmak kırılgan olurdu.
create or replace function public.email_on_paid_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status <> 'paid' then
    return new;
  end if;
  -- UPDATE'te yalnızca 'paid'e GEÇİŞTE gönder; her güncellemede değil.
  if tg_op = 'UPDATE' and coalesce(old.payment_status, '') = 'paid' then
    return new;
  end if;
  perform public.queue_email('order', new.id);
  return new;
exception when others then
  raise warning '[email] siparis postasi kuyruga alinamadi: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_email_on_paid_order_ins on public.orders;
create trigger trg_email_on_paid_order_ins
  after insert on public.orders
  for each row
  execute function public.email_on_paid_order();

drop trigger if exists trg_email_on_paid_order_upd on public.orders;
create trigger trg_email_on_paid_order_upd
  after update of payment_status on public.orders
  for each row
  execute function public.email_on_paid_order();
