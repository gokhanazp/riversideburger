// Firebase Analytics (GA4). Web sitesindeki olay adlarıyla aynı:
// screen_view, view_item, add_to_cart, remove_from_cart, view_cart,
// begin_checkout, add_payment_info, purchase, login, sign_up.
//
// Özel parametreler (added_via, delivery_method, scheduled, payment_type)
// ve kullanıcı özellikleri (role, signup_source, points_tier) GA4 raporlarında
// ancak "özel boyut" olarak tanımlanınca görünür — README'de liste var.
//
// @react-native-firebase v22+ yalnızca MODÜLER API sunuyor (getAnalytics +
// logEvent(instance, …)); eski `analytics()` varsayılan dışa aktarımı yok.
// İlk sürüm onu çağırmaya çalışıp sessizce susmuştu: TestFlight'ta hiçbir
// olay gitmedi. Şimdi modüler çağrılar; modül yoksa (Expo web, eski runtime)
// her çağrı yine sessizce yok sayılır.
import { Platform } from 'react-native';

type Mod = {
  getAnalytics: () => unknown;
  logEvent: (a: unknown, name: string, params?: Record<string, unknown>) => void;
  logScreenView: (a: unknown, p: { screen_name: string; screen_class?: string }) => Promise<void>;
  setUserId: (a: unknown, id: string | null) => Promise<void>;
  setUserProperty: (a: unknown, name: string, value: string | null) => Promise<void>;
  getAppInstanceId: (a: unknown) => Promise<string | null>;
  setAnalyticsCollectionEnabled: (a: unknown, enabled: boolean) => Promise<void>;
};

let loaded: { mod: Mod; a: unknown } | null | undefined;

function get(): { mod: Mod; a: unknown } | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === 'web') {
    loaded = null;
    return loaded;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-firebase/analytics') as Mod;
    const a = mod.getAnalytics();
    loaded = { mod, a };
  } catch (e) {
    console.warn('[analytics] Firebase modülü yüklenemedi', e instanceof Error ? e.message : e);
    loaded = null;
  }
  return loaded;
}

// Modüler logEvent Promise DÖNDÜRMÜYOR (`void analytics.logEvent(...)`), yani
// undefined. Eskiden burada doğrudan `.catch` çağrılıyordu: 2.0.9'da ürün
// detayı, sepet ve giriş "Cannot read property 'catch' of undefined" ile
// uygulamayı çökertti. Analitik hiçbir koşulda uygulamayı düşürmemeli.
const warn = (e: unknown) => console.warn('[analytics]', e instanceof Error ? e.message : e);
const safe = (fn: (m: Mod, a: unknown) => unknown) => {
  const l = get();
  if (!l) return;
  try {
    Promise.resolve(fn(l.mod, l.a)).catch(warn);
  } catch (e) {
    warn(e);
  }
};

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

const money = (v: number) => Number((Number(v) || 0).toFixed(2));

export function logScreen(name: string) {
  safe((m, a) => m.logScreenView(a, { screen_name: name, screen_class: name }));
}

/** Ürün detayı açıldı. */
export function logViewItem(item: AnalyticsItem) {
  safe((m, a) => m.logEvent(a, 'view_item', { currency: 'CAD', value: money(item.price * item.quantity), items: [item] }));
}

/** added_via: menü/ürün detayından mı, "Goes well with" panelinden mi eklendi. */
export function logAddToCart(item: AnalyticsItem, addedVia: 'menu' | 'upsell' = 'menu') {
  safe((m, a) =>
    m.logEvent(a, 'add_to_cart', { currency: 'CAD', value: money(item.price * item.quantity), items: [item], added_via: addedVia })
  );
}

/** Satır silindi ya da miktarı azaldı; quantity = çıkarılan adet. */
export function logRemoveFromCart(item: AnalyticsItem) {
  safe((m, a) => m.logEvent(a, 'remove_from_cart', { currency: 'CAD', value: money(item.price * item.quantity), items: [item] }));
}

/** Sepet sekmesi dolu sepetle odağa geldi. */
export function logViewCart(value: number, items: AnalyticsItem[]) {
  safe((m, a) => m.logEvent(a, 'view_cart', { currency: 'CAD', value: money(value), items }));
}

export interface CheckoutContext {
  method: 'pickup' | 'delivery';
  scheduled: boolean;
  coupon?: string | null;
}

export function logBeginCheckout(value: number, items: AnalyticsItem[], ctx?: CheckoutContext) {
  safe((m, a) =>
    m.logEvent(a, 'begin_checkout', {
      currency: 'CAD',
      value: money(value),
      items,
      ...(ctx
        ? { delivery_method: ctx.method, scheduled: ctx.scheduled ? 'yes' : 'no', ...(ctx.coupon ? { coupon: ctx.coupon } : {}) }
        : {}),
    })
  );
}

/** Müşteri ödemeyi onayladı (kart / Apple Pay / Google Pay), Stripe'a gitmeden hemen önce. */
export function logAddPaymentInfo(value: number, items: AnalyticsItem[], paymentType: 'card' | 'apple_pay' | 'google_pay' | 'demo') {
  safe((m, a) => m.logEvent(a, 'add_payment_info', { currency: 'CAD', value: money(value), items, payment_type: paymentType }));
}

/** "Goes well with" paneli gerçekten göründü (öneri boşsa panel açılmıyor, olay da gitmiyor). */
export function logUpsellShown(triggerProductId: string, suggestionCount: number) {
  safe((m, a) => m.logEvent(a, 'upsell_shown', { item_id: triggerProductId, suggestion_count: suggestionCount }));
}

export function logPurchase(input: {
  orderNumber: string;
  value: number;
  tax: number;
  shipping: number;
  items: AnalyticsItem[];
  method: 'pickup' | 'delivery';
  scheduled: boolean;
  coupon?: string | null;
  pointsUsed?: number;
}) {
  safe(async (m, a) => {
    await m.logEvent(a, 'purchase', {
      transaction_id: input.orderNumber,
      currency: 'CAD',
      value: money(input.value),
      tax: money(input.tax),
      shipping: money(input.shipping),
      items: input.items,
      delivery_method: input.method,
      scheduled: input.scheduled ? 'yes' : 'no',
      ...(input.coupon ? { coupon: input.coupon } : {}),
      points_used: money(input.pointsUsed ?? 0),
    });
    // GA4'ün önerilen olayı: puan harcandı. Puanlar CAD cinsinden tutuluyor.
    if ((input.pointsUsed ?? 0) > 0) {
      await m.logEvent(a, 'spend_virtual_currency', {
        value: money(input.pointsUsed ?? 0),
        virtual_currency_name: 'points',
        item_name: 'order_discount',
      });
    }
  });
}

export function logAuth(kind: 'login' | 'sign_up') {
  safe((m, a) => m.logEvent(a, kind, { method: 'password' }));
}

/** Puan bakiyesi kademesi (CAD): kitle tanımlarında "puanı olup harcamayanlar" için. */
export function pointsTier(points: number | null | undefined): 'none' | 'under_5' | '5_to_20' | 'over_20' {
  const p = Number(points) || 0;
  if (p <= 0) return 'none';
  if (p < 5) return 'under_5';
  if (p <= 20) return '5_to_20';
  return 'over_20';
}

export interface AnalyticsUserTraits {
  role?: string | null;
  signupSource?: string | null;
  points?: number | null;
}

/** Kullanıcı kimliği + özellikleri. Çıkışta hepsi null'a çekilir. */
export function setAnalyticsUser(userId: string | null, traits: AnalyticsUserTraits = {}) {
  safe(async (m, a) => {
    await m.setUserId(a, userId);
    await m.setUserProperty(a, 'role', userId ? traits.role ?? null : null);
    await m.setUserProperty(a, 'signup_source', userId ? traits.signupSource ?? 'app' : null);
    await m.setUserProperty(a, 'points_tier', userId ? pointsTier(traits.points) : null);
  });
}

/** Admin tanı düğmesi: SDK ayakta mı, kurulum kimliği ne, bir test olayı gönder. */
export async function analyticsDiagnostics(): Promise<{ ok: boolean; instanceId: string | null; error?: string }> {
  const l = get();
  if (!l) return { ok: false, instanceId: null, error: 'module not available' };
  try {
    await l.mod.setAnalyticsCollectionEnabled(l.a, true);
    const instanceId = await l.mod.getAppInstanceId(l.a);
    await l.mod.logEvent(l.a, 'rb_analytics_test', { source: 'admin_settings' });
    return { ok: true, instanceId };
  } catch (e) {
    return { ok: false, instanceId: null, error: e instanceof Error ? e.message : String(e) };
  }
}
