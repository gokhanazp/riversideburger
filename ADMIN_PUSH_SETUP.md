# Admin Sipariş Bildirimi — Kurulum ve Test

Yeni sipariş uyarısının **hiçbir koşulda kaçmaması** için üç bağımsız yol var.
Biri çökse diğerleri devreye giriyor.

| # | Yol | Ne zaman çalışır | Gecikme |
|---|-----|------------------|---------|
| 1 | **Sunucu push'u** (Edge Function) | Her zaman — uygulama kapalı, arka planda, telefon uykuda olsa bile | 1-3 sn |
| 2 | **Realtime abonelik** | Uygulama açıkken | anında |
| 3 | **Polling** (20-25 sn) | Uygulama açıkken, realtime ölse bile | ≤25 sn |

Aynı sipariş için iki yol birden tetiklenirse `orderAlertRegistry` ikinci uyarıyı
yutar — admin çift ses duymaz.

```
Müşteri sipariş verir
      │
      ▼
orders INSERT ──┬──► trg_push_admins_on_new_order (pg_net)
                │         └──► notify-admin-new-order (Edge Function)
                │                  └──► Expo Push API ──► admin cihazları  [YOL 1]
                │
                └──► Supabase Realtime ──► useAdminOrderNotifier            [YOL 2]
                                                └──► ses + toast + fiş baskısı
                     (bağlantı ölürse 20-25 sn'lik polling yakalar)          [YOL 3]
```

---

## 1. Kurulum (bir kez)

Dört adım var ve **hepsi aynı yerde çalışmıyor.** Karışmasın diye:

| Adım | Nerede | Neden orada |
|------|--------|-------------|
| 1.2 Edge Function deploy | **Terminal** (`supabase functions ...`) | SQL değil, kod yüklüyor |
| 1.3 Vault sırları | **Dashboard → SQL Editor** | İçinde sır var, repoya yazılamaz |
| 1.4 Migration | **Terminal** (`supabase db push`) | Dosya `supabase/migrations/`'ta, CLI takip ediyor |
| 1.5 Doğrulama | **Dashboard → SQL Editor** | Sadece okuma sorguları |

> **`supabase/migrations/*.sql` dosyalarını SQL Editor'e elle yapıştırma.**
> Bu klasör CLI tarafından takip ediliyor; elle çalıştırırsan CLI migration'ı
> "uygulanmamış" sanmaya devam eder ve bir dahaki `db push` aynı dosyayı tekrar
> çalıştırmaya kalkar. Elle uygulanan SQL için ayrı `database-updates/` klasörü
> var — oraya bilerek hiçbir şey koymadım.
>
> Ne olacağını önce görmek istersen (hiçbir şey uygulamaz):
> `supabase db push --dry-run`

### 1.1 Paylaşılan sır üret

```bash
openssl rand -hex 32
```

Çıkan değeri aşağıda `<SIR>` yerine kullan. **Repoya yazma.**

### 1.2 Edge Function'ı deploy et

`--no-verify-jwt` şart: isteği veritabanı trigger'ı atıyor, JWT'si yok.
Kimlik doğrulama `x-admin-push-secret` başlığıyla yapılıyor.

```bash
supabase functions deploy notify-admin-new-order --no-verify-jwt
supabase secrets set ADMIN_PUSH_SECRET='<SIR>'
```

### 1.3 Vault sırlarını kaydet

Supabase Dashboard → SQL Editor:

```sql
select vault.create_secret(
  'https://srcslhltajjvteqeptrt.supabase.co/functions/v1/notify-admin-new-order',
  'admin_push_fn_url'
);
select vault.create_secret('<SIR>', 'admin_push_secret');
```

Sır zaten varsa (`create_secret` ikinci kez hata verir):

```sql
select vault.update_secret(id, '<YENI_SIR>')
from vault.secrets where name = 'admin_push_secret';
```

### 1.4 Migration'ı uygula

Terminalden, proje kök dizininde:

```bash
supabase db push
```

Bu komut yalnızca **uzakta olmayan** migration'ları uygular. Bu projede yerel ve
uzak geçmiş birebir aynı (11 migration), tek eksik olan bu yeni dosya — yani
komut sadece `20260817120000_admin_push_on_new_order.sql`'i çalıştırır, eski
hiçbir dosyaya dokunmaz. Kontrol etmek için: `supabase migration list`

### 1.5 Kurulumu doğrula

```sql
-- Trigger duruyor mu?
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.orders'::regclass and not tgisinternal;

-- Vault sırları yerinde mi?
select name from vault.decrypted_secrets
where name in ('admin_push_fn_url', 'admin_push_secret');

-- pg_net açık mı?
select extname from pg_extension where extname = 'pg_net';
```

---

## 2. Test

`SUPABASE_SERVICE_ROLE_KEY`: Dashboard → Project Settings → API → `service_role`.
**Bu anahtar RLS'i tamamen bypass eder, kimseyle paylaşma, repoya yazma.**

```bash
export SUPABASE_URL='https://srcslhltajjvteqeptrt.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
export ADMIN_PUSH_SECRET='<SIR>'
```

### Adım 1 — Cihaz kayıtlı mı? (zincirin en sık kopan halkası)

```bash
node scripts/test-admin-push.mjs tokens
```

Aktif token yoksa push imkânsız. Sebepleri:
- **Expo Go kullanılıyor.** Expo Go push token alamaz — admin tabletinde
  **dev-client veya production build** olmalı.
- Bildirim izni verilmemiş (cihaz ayarlarından kontrol et).
- Admin hesabıyla giriş yapılmamış (`savePushToken` sadece giriş sonrası çalışır).

### Adım 2 — Cihaz push alabiliyor mu? (DB/trigger'dan bağımsız)

```bash
node scripts/test-admin-push.mjs send
```

Tablet **kilitliyken** çalıştır. Bildirim düşüyorsa Expo ↔ FCM/APNs zinciri sağlam.
`DeviceNotRegistered` görürsen o token ölmüş — uygulamayı açıp yeniden giriş yap.

### Adım 3 — Edge Function çalışıyor mu?

```bash
node scripts/test-admin-push.mjs orders          # gerçek bir order_id al
node scripts/test-admin-push.mjs fn <order_id>
```

Beklenen çıktı:

```json
{ "orderNumber": "...", "tokens": 1, "sent": 1, "deactivated": 0, "errors": [] }
```

Canlı log: Dashboard → Edge Functions → `notify-admin-new-order` → Logs
(CLI 2.98'de `functions logs` komutu yok).

**Tamamen yerel çalıştırmak istersen** (Docker gerekir):

```bash
# supabase/functions/.env.local  (gitignore'da — .env*.local)
#   ADMIN_PUSH_SECRET=<SIR>
#   SUPABASE_URL=https://srcslhltajjvteqeptrt.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local

# başka bir terminalde
FUNCTIONS_BASE=http://127.0.0.1:54321/functions/v1 \
  node scripts/test-admin-push.mjs fn <order_id>
```

`serve` tüm fonksiyonları birden ayağa kaldırır ve `console.log` çıktısını
doğrudan terminale basar — hata ayıklamanın en hızlı yolu bu.

Not: veritabanı trigger'ı Supabase sunucusunda çalıştığı için `127.0.0.1`'e
ulaşamaz — yerel serve yalnızca fonksiyonun kendisini test etmeye yarar.

### Adım 4 — Trigger tetikleniyor mu?

SQL Editor'da sahte bir sipariş oluştur (`<ADMIN_USER_ID>` yerine gerçek bir
kullanıcı id'si koy):

```sql
insert into orders (
  user_id, order_number, status, total_amount,
  delivery_address, phone, points_earned, points_used, delivery_method
) values (
  '<ADMIN_USER_ID>', 'TEST-' || floor(random() * 100000)::text, 'pending', 42.50,
  '688 Queen St E, Toronto', '+14165550000', 0, 0, 'delivery'
)
returning id, order_number;
```

Birkaç saniye sonra pg_net'in aldığı yanıtı kontrol et:

```sql
select id, status_code, content, created
from net._http_response
order by created desc
limit 5;
```

- `status_code = 200` → zincir tam çalışıyor.
- `401` → Vault'taki sır ile `ADMIN_PUSH_SECRET` uyuşmuyor.
- `404` → fonksiyon deploy edilmemiş veya URL yanlış.
- Hiç satır yok → trigger çalışmadı ya da Vault sırları eksik. Postgres loglarında
  `[admin push]` uyarısını ara (Dashboard → Logs → Postgres).

Test siparişini sil (`notifications.order_id` `ON DELETE SET NULL` olduğu için
bildirim kaydı silinmez, onu da temizle):

```sql
delete from notifications
where order_id in (select id from orders where order_number like 'TEST-%');

delete from orders where order_number like 'TEST-%';
```

### Adım 5 — Uçtan uca gerçek test

1. Admin tabletinde uygulamayı aç, sipariş ekranında bırak → başlıkta yeşil **"Canlı"** yazmalı.
2. Başka bir telefondan gerçek sipariş ver.
3. Beklenen: **tek** ses + bildirim + listede sipariş + (yazıcı bağlıysa) fiş.
4. Tableti kilitle, tekrar sipariş ver → kilit ekranında bildirim düşmeli, dokununca sipariş listesi açılmalı.
5. **Uygulamayı tamamen kapat** (recent apps'ten kaydır), tekrar sipariş ver → bildirim yine düşmeli. Bu, YOL 1'in çalıştığının kanıtı.

---

## 3. Realtime dayanıklılığını test etme

Bildirilen asıl sorun buydu: ekran açık kalıyor ama bir süre sonra siparişler düşmüyordu.
Log satırlarını görmek için tableti bilgisayara bağla:

```bash
npx expo start --dev-client        # ardından terminalde logları izle
# Android alternatif: adb logcat | grep -i "realtime\|admin-notifier"
```

**Test A — bağlantı kopması**
1. Sipariş ekranını aç, gösterge yeşil "Canlı".
2. Uçak modunu aç → 15-30 sn içinde gösterge kırmızı "Bağlantı yok" olmalı.
   Log: `[realtime:admin-orders-list] socket kapalı görünüyor → yeniden bağlanılıyor`
3. Uçak modunu kapat → gösterge tekrar yeşile dönmeli (en fazla ~30 sn).
   Log: `status: SUBSCRIBED`
4. Uçak modu kapalıyken **uçak modu açıkken verilmiş** bir sipariş varsa
   `[admin-notifier] reconnect: N kaçan sipariş yakalandı` görünmeli ve ses çalmalı.

**Test B — arka plan / uyku**
1. Sipariş ekranı açık, tableti kilitle veya başka uygulamaya geç.
2. Başka cihazdan sipariş ver.
3. Uygulamaya geri dön → `uygulama ön plana döndü → bağlantı yenileniyor` +
   sipariş listede olmalı. (Push zaten kilit ekranında düşmüş olacak.)

**Test C — uzun süre (asıl senaryo)**
Tableti sipariş ekranında **birkaç saat** açık bırak (access token ömrü 1 saat,
eski hata tam burada çıkıyordu). Sonra sipariş ver — uygulamaya dokunmadan
düşmeli. Gösterge sürekli yeşil kalmalı.

**Test D — realtime'ı bile bile öldür**
Dashboard → Database → Replication'dan `orders` tablosunun realtime yayınını
kapat. Sipariş ver: gösterge kırmızıya döner ama sipariş **en fazla 20 saniyede**
listeye düşer (polling) ve push yine gelir. Testten sonra yayını geri aç.

---

## 4. Sorun giderme

| Belirti | Bakılacak yer |
|---------|---------------|
| Hiç push gelmiyor | Adım 1 → aktif token var mı? Expo Go mu kullanılıyor? |
| Push var, ses yok | Android: `admin_orders` kanalı ayarları (kanal oluşturulduktan sonra sesi kod değiştiremez — uygulamayı kaldırıp kurmak gerekir). iOS: sessiz modda mı? |
| Çift ses | `orderAlertRegistry` yalnızca ön planda çalışır; arka planda OS bildirimi gösterip JS'i çalıştırmadığı için uygulamaya dönünce özet bildirim gelebilir — beklenen davranış |
| Gösterge sürekli kırmızı | `orders` tablosu realtime publication'da mı? (`database-updates/enable-realtime-orders.sql`) |
| `net._http_response` boş | Vault sırları eksik, Postgres loglarında `[admin push]` uyarısını ara |
| Fiş basılmıyor | Yazıcı yalnızca uygulama çalışırken basar; arka planda basılamaz, uygulamaya dönünce kaçanlar basılır (yalnızca `pending`/`confirmed`/`preparing` durumundakiler) |

## 5. Bilinen sınır

- **iOS özel bildirim sesi:** `order_sound.mp3` — iOS bildirim sesleri mp3'ü
  desteklemiyor (wav/aiff/caf gerekir). Android'de kanal üzerinden çalıyor,
  iOS'ta varsayılan sese düşüyor. Düzeltmek için ses dosyasının `.wav` sürümü
  `app.json` → `expo-notifications.sounds` listesine eklenmeli.
- **Ödeme öncesi bildirim:** sipariş satırı ödeme onaylanmadan önce oluşuyor,
  push da o anda gidiyor. Ödeme başarısız olursa admin yine de bildirim almış
  olur. İstenirse trigger `payment_status = 'paid'` olduğunda tetiklenecek
  şekilde daraltılabilir.
