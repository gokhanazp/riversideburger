// Firebase Analytics (GA4). Web sitesindeki olay adlarıyla aynı:
// screen_view, add_to_cart, begin_checkout, purchase, login, sign_up.
//
// Yerel modül yalnızca mağaza derlemesinde var (runtime 2.0.9+). Expo web'de
// ve eski derlemelerde import patlamasın diye tembel yükleniyor; modül yoksa
// her çağrı sessizce yok sayılır. Hiçbir ölçüm hatası uygulamayı durdurmasın.
import { Platform } from 'react-native';

type AnalyticsModule = {
  logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>;
  logScreenView: (p: { screen_name: string; screen_class?: string }) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
  setUserProperty: (name: string, value: string | null) => Promise<void>;
};

let instance: AnalyticsModule | null | undefined;

function get(): AnalyticsModule | null {
  if (instance !== undefined) return instance;
  if (Platform.OS === 'web') {
    instance = null;
    return instance;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-firebase/analytics');
    const analytics = (mod.default ?? mod) as () => AnalyticsModule;
    instance = analytics();
  } catch {
    instance = null;
  }
  return instance;
}

const safe = (fn: (a: AnalyticsModule) => Promise<void>) => {
  const a = get();
  if (!a) return;
  fn(a).catch(() => {});
};

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

const money = (v: number) => Number((Number(v) || 0).toFixed(2));

export function logScreen(name: string) {
  safe((a) => a.logScreenView({ screen_name: name, screen_class: name }));
}

export function logAddToCart(item: AnalyticsItem) {
  safe((a) => a.logEvent('add_to_cart', { currency: 'CAD', value: money(item.price * item.quantity), items: [item] }));
}

export function logBeginCheckout(value: number, items: AnalyticsItem[]) {
  safe((a) => a.logEvent('begin_checkout', { currency: 'CAD', value: money(value), items }));
}

export function logPurchase(input: { orderNumber: string; value: number; tax: number; shipping: number; items: AnalyticsItem[]; method: 'pickup' | 'delivery'; scheduled: boolean }) {
  safe((a) =>
    a.logEvent('purchase', {
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
  safe((a) => a.logEvent(kind, { method: 'password' }));
}

export function setAnalyticsUser(userId: string | null, role?: string | null) {
  safe(async (a) => {
    await a.setUserId(userId);
    await a.setUserProperty('role', role ?? null);
  });
}
