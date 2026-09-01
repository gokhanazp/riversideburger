// "Ödeme tamamlanmadan sipariş oluşmaz" değişmezinin testi.
import { FakeDB } from './fakedb.ts';
import { buildOrderDraft } from '../functions/_shared/order-draft.ts';
import { settleSession } from '../functions/_shared/place-order.ts';

// deno-lint-ignore no-explicit-any
const asClient = (db: FakeDB) => db as any;

const BURGER = '11111111-1111-4111-8111-111111111111';
const EXTRA = '22222222-2222-4222-8222-222222222222';

function seed() {
  const db = new FakeDB();
  db.tables.products = [
    { id: BURGER, name: 'Riverside Classic', price: 16.99, category_id: 'cat-burgers', is_active: true, stock_status: 'in_stock' },
  ];
  db.tables.product_options = [
    { id: EXTRA, name: 'Ekstra Cheddar', name_en: 'Extra Cheddar', price: 2.0, is_active: true },
  ];
  db.tables.settings = [{ tax_rate: 13, delivery_tier1_max_km: 5, delivery_tier1_fee: 4.99, delivery_tier2_max_km: 8, delivery_tier2_fee: 8.99 }];
  db.tables.campaigns = [
    { id: 'camp-first', name_en: 'First order 50% off', is_active: true, type: 'first_order',
      discount_percent: 50, target_type: 'all', priority: 10, min_order_amount: 0, per_customer_limit: 1 },
  ];
  return db;
}

const CART = {
  items: [{ product_id: BURGER, quantity: 2, option_ids: [EXTRA] }],
  delivery_method: 'pickup' as const,
  guest: { full_name: 'Test Guest', phone: '4165550000', email: 'Guest@Example.com' },
  notes: null,
};

const session = (id: string, paid: boolean, amount: number) => ({
  id, payment_status: paid ? 'paid' : 'unpaid',
  payment_intent: paid ? 'pi_test_123' : null,
  amount_total: Math.round(amount * 100),
});

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n      beklenen: ${e}\n      gerçek:   ${a}`}`);
};

// ── 1. Fiyatlama HİÇBİR ŞEY yazmıyor ────────────────────────────────────────
console.log('\n═══ 1) Sepet fiyatlanıyor — ödeme öncesi ═══');
const db = seed();
const result = await buildOrderDraft(asClient(db), CART, null);
if (!result.ok) { console.log('  ✗ taslak üretilemedi:', result.error); Deno.exit(1); }
const draft = result.draft;

console.log(`  döküm: ara toplam ${draft.breakdown.subtotal}, indirim ${draft.breakdown.discount} `
  + `(${draft.breakdown.campaign_name}), HST ${draft.breakdown.tax}, TOPLAM ${draft.breakdown.total}`);
check('orders tablosu BOŞ', db.tables.orders.length, 0);
check('users tablosu BOŞ (misafir hesabı açılmadı)', db.tables.users.length, 0);
check('auth kullanıcısı açılmadı', db.authUsers.length, 0);
check('HİÇ yazma işlemi olmadı', db.writes, []);
// 2 × (16.99 + 2.00) = 37.98 · ilk sipariş %50 = 18.99 · HST %13 = 2.47 · toplam 21.46
check('ara toplam doğru', draft.breakdown.subtotal, 37.98);
check('ilk-sipariş indirimi uygulandı', draft.breakdown.discount, 18.99);
check('toplam doğru', draft.breakdown.total, 21.46);

// ── 2. Ödenmemiş oturum sipariş oluşturmuyor ────────────────────────────────
console.log('\n═══ 2) Müşteri ödemeyi yarıda bıraktı ═══');
db.tables.web_checkouts = [{ stripe_session_id: 'cs_abandoned', draft, created_at: '2026-08-29T00:00:00Z' }];
const abandoned = await settleSession(asClient(db), session('cs_abandoned', false, 21.46));
check('sonuç: unpaid', abandoned.status, 'unpaid');
check('orders HÂLÂ BOŞ', db.tables.orders.length, 0);
check('panele düşecek sipariş yok', db.tables.orders.length, 0);

// ── 3. Ödeme tamamlandı → sipariş oluşuyor ──────────────────────────────────
console.log('\n═══ 3) Müşteri ödemeyi tamamladı ═══');
db.tables.web_checkouts = [{ stripe_session_id: 'cs_paid', draft, created_at: '2026-08-29T00:00:00Z' }];
const placed = await settleSession(asClient(db), session('cs_paid', true, 21.46));
check('sonuç: placed', placed.status, 'placed');
check('tam BİR sipariş oluştu', db.tables.orders.length, 1);
const order = db.tables.orders[0];
check("payment_status doğrudan 'paid'", order.payment_status, 'paid');
check('paid_at dolu', typeof order.paid_at === 'string', true);
check('tutar sunucunun hesabı', order.total_amount, 21.46);
check('oturum kimliği bağlandı', order.stripe_session_id, 'cs_paid');
check('kalemler yazıldı', db.tables.order_items.length, 1);
check('özelleştirme yazıldı (Ekstra Cheddar)', db.tables.order_item_customizations.length, 1);
check('ödeme kaydı succeeded', db.tables.payments[0]?.status, 'succeeded');
check('misafir hesabı ŞİMDİ açıldı', db.tables.users.length, 1);
check('taslak temizlendi', db.tables.web_checkouts.length, 0);

// ── 4. Webhook + tarayıcı dönüşü aynı anda → TEK sipariş ────────────────────
console.log('\n═══ 4) Webhook ve tarayıcı dönüşü aynı anda ═══');
const db2 = seed();
const r2 = await buildOrderDraft(asClient(db2), CART, null);
if (!r2.ok) { console.log('  ✗ taslak üretilemedi'); Deno.exit(1); }
db2.tables.web_checkouts = [{ stripe_session_id: 'cs_race', draft: r2.draft, created_at: '2026-08-29T00:00:00Z' }];

const both = await Promise.all([
  settleSession(asClient(db2), session('cs_race', true, 21.46)),
  settleSession(asClient(db2), session('cs_race', true, 21.46)),
]);
check('orders tablosunda TEK satır', db2.tables.orders.length, 1);
const numbers = both.map((r) => (r.status === 'placed' ? r.order.order_number : null));
check('iki yol AYNI sipariş numarasını döndü', numbers[0] === numbers[1], true);
check('yalnızca biri oluşturdu', both.filter((r) => r.status === 'placed' && r.order.created).length, 1);
check('misafir hesabı da TEK', db2.tables.users.length, 1);
check('ödeme kaydı da TEK', db2.tables.payments.length, 1);

// ── 5. Yarıda kalmış auth hesabı ödemeyi bloklamıyor ────────────────────────
console.log('\n═══ 5) Bu e-postada auth hesabı var, users satırı yok ═══');
const db3 = seed();
db3.authUsers.push({ id: 'orphan-auth-id', email: 'guest@example.com' });
const r3 = await buildOrderDraft(asClient(db3), CART, null);
if (!r3.ok) { console.log('  ✗ taslak üretilemedi'); Deno.exit(1); }
db3.tables.web_checkouts = [{ stripe_session_id: 'cs_orphan', draft: r3.draft, created_at: '2026-08-29T00:00:00Z' }];
const orphan = await settleSession(asClient(db3), session('cs_orphan', true, 21.46));
check('ödeme alındıysa sipariş HER ZAMAN oluşur', orphan.status, 'placed');
check('mevcut auth kimliğinin altına yazıldı', db3.tables.users[0]?.id, 'orphan-auth-id');

// ── 6. Teslimat: Uber çağrısı başarısız olsa bile sipariş DURMALI ───────────
console.log('\n═══ 6) Teslimat siparişi, Uber ulaşılamıyor ═══');
const db4 = seed();
// Teslimat taslağını elle kuruyoruz: buildOrderDraft teslimat için geocode
// istiyor ve testte LocationIQ anahtarı yok. Ölçmek istediğimiz şey zaten
// place-order'ın Uber hatası karşısındaki davranışı.
const deliveryDraft = {
  user_id: null,
  guest: { full_name: 'Teslimat Testi', phone: '4165550000', email: 'teslimat@example.com' },
  lines: [{
    product_id: BURGER, product_name: 'Riverside Classic', category_id: 'cat-burgers',
    quantity: 1, unit_price: 16.99, subtotal: 16.99, option_ids: [], special_instructions: null,
  }],
  options: [],
  order: {
    status: 'pending', total_amount: 24.15, delivery_address: '250 Broadview Avenue, Toronto, ON, M4M 2G6',
    phone: '4165550000', notes: null, points_earned: 0, points_used: 0,
    delivery_method: 'delivery', delivery_full_name: 'Teslimat Testi',
    delivery_street: '250 Broadview Avenue', delivery_unit: null, delivery_city: 'Toronto',
    delivery_province: 'ON', delivery_postal_code: 'M4M 2G6', delivery_country: 'CA',
    delivery_lat: 43.6655, delivery_lng: -79.3505, delivery_instructions: null,
    delivery_fee: 4.99, tip_amount: 0, campaign_id: null, discount_amount: 0, tax_amount: 2.17,
  },
  breakdown: { subtotal: 16.99, discount: 0, campaign_name: null, points_used: 0,
    delivery_fee: 4.99, distance_km: 0.45, tax: 2.17, tax_rate: 13, tip: 0, total: 24.15 },
};
db4.tables.web_checkouts = [{ stripe_session_id: 'cs_delivery', draft: deliveryDraft, created_at: '2026-09-01T00:00:00Z' }];
const delivered = await settleSession(asClient(db4), session('cs_delivery', true, 24.15));
check('Uber ulaşılamasa da sipariş oluştu', delivered.status, 'placed');
check('tek sipariş', db4.tables.orders.length, 1);
check("payment_status 'paid'", db4.tables.orders[0]?.payment_status, 'paid');
check('kalemler yazıldı', db4.tables.order_items.length, 1);
// Kurye çağrılamadığı için bu alanlar boş kalmalı — panelden elle gönderilecek.
check('uber_delivery_id boş', db4.tables.orders[0]?.uber_delivery_id ?? null, null);

console.log(failures === 0 ? '\n✅ TÜM KONTROLLER GEÇTİ' : `\n❌ ${failures} KONTROL BAŞARISIZ`);
Deno.exit(failures ? 1 : 0);
