// Firebase Analytics (GA4). Web sitesindeki olay adlarıyla aynı:
// screen_view, add_to_cart, begin_checkout, purchase, login.
//
// @react-native-firebase v22+ yalnızca MODÜLER API sunuyor (getAnalytics +
// logEvent(instance, …)); eski `analytics()` varsayılan dışa aktarımı yok.
// İlk sürüm onu çağırmaya çalışıp sessizce susmuştu: TestFlight'ta hiçbir
// olay gitmedi. Şimdi modüler çağrılar; modül yoksa (Expo web, eski runtime)
// her çağrı yine sessizce yok sayılır.
import { Platform } from 'react-native';

type Mod = {
  getAnalytics: () => unknown;
  logEvent: (a: unknown, name: string, params?: Record<string, unknown>) => Promise<void>;
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

const safe = (fn: (m: Mod, a: unknown) => Promise<unknown>) => {
  const l = get();
  if (!l) return;
  fn(l.mod, l.a).catch((e) => console.warn('[analytics]', e instanceof Error ? e.message : e));
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

export function logAddToCart(item: AnalyticsItem) {
  safe((m, a) => m.logEvent(a, 'add_to_cart', { currency: 'CAD', value: money(item.price * item.quantity), items: [item] }));
}

export function logBeginCheckout(value: number, items: AnalyticsItem[]) {
  safe((m, a) => m.logEvent(a, 'begin_checkout', { currency: 'CAD', value: money(value), items }));
}

export function logPurchase(input: { orderNumber: string; value: number; tax: number; shipping: number; items: AnalyticsItem[]; method: 'pickup' | 'delivery'; scheduled: boolean }) {
  safe((m, a) =>
    m.logEvent(a, 'purchase', {
      transaction_id: input.orderNumber,
      currency: 'CAD',
      value: money(input.value),
      tax: money(input.tax),
      shipping: money(input.shipping),
      items: input.items,
      delivery_method: input.method,
      scheduled: input.scheduled ? 'yes' : 'no',
    })
  );
}

export function logAuth(kind: 'login' | 'sign_up') {
  safe((m, a) => m.logEvent(a, kind, { method: 'password' }));
}

export function setAnalyticsUser(userId: string | null, role?: string | null) {
  safe(async (m, a) => {
    await m.setUserId(a, userId);
    await m.setUserProperty(a, 'role', role ?? null);
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
