// Kupon indirim motoru testi.
//
// Buradaki her satır PARA. Kuponun hedeflemesi, tavanı ve "en ucuz bedava"
// seçimi yanlış olursa ya müşteri hak etmediği indirimi alır ya da hak ettiğini
// alamaz — ikisi de sessizce olur. Bu projede aynı sınıf iki hata yaşandı:
// buy_x_get_y hedeflemesi web kopyasında yoktu ve sepetteki HER ürüne
// uygulanıyordu; vergi yuvarlaması sunucu ile istemcide ayrışıyordu.
//
// Çalıştırma (node TypeScript'i doğrudan çalıştırıyor):
//   node supabase/functions/_shared/coupons.test.ts
import { computeCouponBenefit, normalizeCouponCode, type CouponRow, type CouponLine } from './coupons.ts';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n      beklenen: ${e}\n      gerçek:   ${a}`}`);
};

const coupon = (over: Partial<CouponRow>): CouponRow => ({
  id: 'c1', code: 'TEST', name_tr: null, name_en: null,
  description_tr: null, description_en: null,
  type: 'percentage', discount_percent: null, discount_amount: null,
  buy_quantity: null, free_quantity: null,
  target_type: 'all', target_category_ids: null, target_product_ids: null,
  min_order_amount: null, starts_at: null, ends_at: null,
  per_customer_limit: null, max_redemptions: null, assigned_user_id: null,
  is_active: true, priority: 0,
  ...over,
});

const line = (product_id: string, unit_price: number, quantity: number, category_id: string | null = null): CouponLine =>
  ({ product_id, category_id, unit_price, quantity });

// Sepet: 2× burger 12.00 (kategori BURGER), 1× kola 3.50 (kategori DRINK)
const cart = [line('burger', 12, 2, 'cat-burger'), line('cola', 3.5, 1, 'cat-drink')];
const subtotal = 27.5;

console.log('\n═══ Yüzde indirim ═══');
check('tüm sepete %10',
  computeCouponBenefit(coupon({ type: 'percentage', discount_percent: 10 }), cart, subtotal, 0).discount, 2.75);
check('yalnızca BURGER kategorisine %50 (kola hariç)',
  computeCouponBenefit(coupon({ type: 'percentage', discount_percent: 50, target_type: 'category', target_category_ids: ['cat-burger'] }), cart, subtotal, 0).discount, 12);
check('yalnızca kola ürününe %100',
  computeCouponBenefit(coupon({ type: 'percentage', discount_percent: 100, target_type: 'product', target_product_ids: ['cola'] }), cart, subtotal, 0).discount, 3.5);
check('yüzde 0 → indirim yok',
  computeCouponBenefit(coupon({ type: 'percentage', discount_percent: 0 }), cart, subtotal, 0).discount, 0);
check('sepette olmayan ürünü hedefleyen kupon → 0',
  computeCouponBenefit(coupon({ type: 'percentage', discount_percent: 50, target_type: 'product', target_product_ids: ['yok'] }), cart, subtotal, 0).discount, 0);

console.log('\n═══ Sabit tutar ═══');
check('5$ indirim',
  computeCouponBenefit(coupon({ type: 'fixed_amount', discount_amount: 5 }), cart, subtotal, 0).discount, 5);
check('TAVAN: 100$ kupon 27.50$ sepette 27.50$ ile sınırlı (negatif toplam olamaz)',
  computeCouponBenefit(coupon({ type: 'fixed_amount', discount_amount: 100 }), cart, subtotal, 0).discount, 27.5);
check('TAVAN: kategoriye 100$ → yalnızca o kategorinin tutarı (24.00)',
  computeCouponBenefit(coupon({ type: 'fixed_amount', discount_amount: 100, target_type: 'category', target_category_ids: ['cat-burger'] }), cart, subtotal, 0).discount, 24);

console.log('\n═══ Bedava teslimat ═══');
check('teslimat varsa ücret sıfırlanır',
  computeCouponBenefit(coupon({ type: 'free_delivery' }), cart, subtotal, 5.99).waivesDelivery, true);
check('gel-al siparişte kazanç yok',
  computeCouponBenefit(coupon({ type: 'free_delivery' }), cart, subtotal, 0).waivesDelivery, false);
check('ara toplamdan indirim YAPMAZ',
  computeCouponBenefit(coupon({ type: 'free_delivery' }), cart, subtotal, 5.99).discount, 0);

console.log('\n═══ Bedava ürün ═══');
check('en UCUZ kalem bedava (kola 3.50, burger değil)',
  computeCouponBenefit(coupon({ type: 'free_item', free_quantity: 1 }), cart, subtotal, 0).discount, 3.5);
check('yalnızca burger hedefliyse burger bedava',
  computeCouponBenefit(coupon({ type: 'free_item', free_quantity: 1, target_type: 'product', target_product_ids: ['burger'] }), cart, subtotal, 0).discount, 12);
check('2 adet bedava → kola + bir burger',
  computeCouponBenefit(coupon({ type: 'free_item', free_quantity: 2 }), cart, subtotal, 0).discount, 15.5);
check('sepetteki adetten fazla istense de sepetle sınırlı',
  computeCouponBenefit(coupon({ type: 'free_item', free_quantity: 99 }), cart, subtotal, 0).discount, 27.5);
check('free_quantity boş → 1 kabul edilir',
  computeCouponBenefit(coupon({ type: 'free_item' }), cart, subtotal, 0).discount, 3.5);

console.log('\n═══ X al Y bedava ═══');
check('2 al 1 bedava, 3 burger varsa en ucuzu bedava',
  computeCouponBenefit(coupon({ type: 'buy_x_get_y', buy_quantity: 2, free_quantity: 1, target_type: 'product', target_product_ids: ['burger'] }), [line('burger', 12, 3)], 36, 0).discount, 12);
check('grup tamamlanmadıysa indirim yok (2 burger, 2+1 grubu)',
  computeCouponBenefit(coupon({ type: 'buy_x_get_y', buy_quantity: 2, free_quantity: 1, target_type: 'product', target_product_ids: ['burger'] }), [line('burger', 12, 2)], 24, 0).discount, 0);

console.log('\n═══ Kod normalleştirme ═══');
check('boşluk ve küçük harf', normalizeCouponCode('  yaz20 '), 'YAZ20');
check('içteki boşluklar atılır', normalizeCouponCode('yaz 20'), 'YAZ20');
check('null → boş', normalizeCouponCode(null), '');

console.log(`\n${failures === 0 ? '✅ tüm kontroller geçti' : `❌ ${failures} kontrol başarısız`}\n`);
process.exit(failures === 0 ? 0 : 1);
