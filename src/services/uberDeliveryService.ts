import Constants from 'expo-constants';
import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import { Address } from '../types/database.types';

const FUNCTIONS_URL = (Constants.expoConfig?.extra?.supabaseFunctionsUrl as string) ?? '';

export interface UberQuote {
  quote_id: string;
  fee_cents: number;
  fee: number;          // dollars (mesafe tarifesi — müşteriden alınan)
  currency: string;     // "CAD"
  distance_km: number;  // restorana kuş uçuşu mesafe
  duration_minutes: number;
  dropoff_eta: string;  // ISO
  expires_at: string;   // ISO
}

// Adres son kademe üst sınırını aştığında fırlatılır — CartScreen bunu yakalayıp
// "teslimat alanı dışında" mesajını gösterir, checkout'u bloklar.
export class OutOfDeliveryRangeError extends Error {
  distanceKm: number;
  maxKm: number;
  constructor(distanceKm: number, maxKm: number) {
    super(i18n.t('cart.outOfDeliveryRange', { km: maxKm }));
    this.name = 'OutOfDeliveryRangeError';
    this.distanceKm = distanceKm;
    this.maxKm = maxKm;
  }
}

export interface UberCreateDeliveryResult {
  delivery_id: string;
  tracking_url: string;
  status: string;
  pickup_eta: string | null;
  dropoff_eta: string | null;
  already_exists?: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface QuoteManifestItem {
  name: string;
  quantity: number;
  price_cents: number;
}

// Uber Direct E.164 telefon ister: +14165551234. Display formatlar (parantezli,
// tireli) bazen kabul edilse de Uber pricing fallback'ine düşürebiliyor.
function toE164CA(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

/**
 * Uber Direct delivery quote al
 * Get a delivery quote for a customer address before checkout.
 * Returns null if address has no lat/lng (e.g., Turkey legacy address).
 *
 * subtotal_cents ve items'ı geçmek Uber'in manifest bilgisini doldurmasını
 * sağlar — eksik bırakıldığında Uber yüksek değerli paket varsayıp ücreti
 * artırabiliyor.
 */
export const getDeliveryQuote = async (
  address: Address,
  manifest?: { subtotal_cents: number; items: QuoteManifestItem[] },
): Promise<UberQuote | null> => {
  if (address.latitude == null || address.longitude == null) {
    return null;
  }
  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/uber-quote`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dropoff_address: `${address.street_number} ${address.street_name}, ${address.city}`,
      dropoff_street: `${address.street_number} ${address.street_name}`,
      dropoff_unit: address.unit_number || undefined,
      dropoff_city: address.city,
      dropoff_province: address.province,
      dropoff_postal_code: address.postal_code,
      dropoff_country: 'CA',
      dropoff_lat: address.latitude,
      dropoff_lng: address.longitude,
      dropoff_phone: toE164CA(address.phone),
      dropoff_name: address.full_name,
      manifest_total_value: manifest?.subtotal_cents,
      manifest_items: manifest?.items,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Quote failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // Mesafe son kademeyi aşarsa edge function available:false döner (200)
  if (data?.available === false) {
    throw new OutOfDeliveryRangeError(Number(data.distance_km ?? 0), Number(data.max_km ?? 0));
  }
  return data as UberQuote;
};

/**
 * Stripe ödemesi başarılı olduktan sonra Uber'e delivery oluştur
 * Create the Uber Direct delivery after successful Stripe payment.
 */
export const createUberDelivery = async (
  orderId: string,
  quoteId: string,
): Promise<UberCreateDeliveryResult> => {
  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/uber-create-delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ order_id: orderId, quote_id: quoteId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create delivery failed (${res.status}): ${text}`);
  }
  return res.json();
};

// Uber Direct iptal sebepleri — yazım/case Uber dokümanıyla birebir eşleşmeli.
// "other" seçilirse additional_description zorunludur.
export const CANCELATION_REASONS = [
  'out_of_items',
  'store_closed',
  'store_too_busy',
  'customer_called_to_cancel',
  'customer_changed_order_requirements',
  'courier_delayed_en_route_to_pickup',
  'too_expensive',
  'delivery_vehicle_too_small',
  'no_courier_assigned',
  'other',
] as const;

export type CancelationReason = typeof CANCELATION_REASONS[number];

/**
 * Siparişi iptal et — Uber teslimatı varsa ÖNCE Uber'e cancel bildirilir (zorunlu),
 * sonra sipariş 'cancelled' işaretlenir. Sadece admin çağırabilir (edge function doğrular).
 * @param orderId Sipariş ID
 * @param reason Uber'in kabul ettiği iptal sebebi
 * @param description "other" için zorunlu ek açıklama; diğerlerinde opsiyonel
 */
export const cancelUberDelivery = async (
  orderId: string,
  reason: CancelationReason,
  description?: string,
): Promise<{ ok: boolean; uber_canceled: boolean }> => {
  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/uber-cancel-delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      order_id: orderId,
      cancelation_reason: reason,
      additional_description: description,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cancel delivery failed (${res.status}): ${text}`);
  }
  return res.json();
};
