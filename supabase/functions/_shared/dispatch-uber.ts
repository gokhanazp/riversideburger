// Ödenmiş bir teslimat siparişi için Uber Direct kuryesi çağırır.
//
// Neden ayrı bir modül: uber-quote ve uber-create-delivery fonksiyonlarının
// ikisi de `supabase.auth.getUser()` ile GERÇEK BİR OTURUM istiyor, çünkü
// mobil uygulamanın ödeme ekranı için yazıldılar (PaymentScreen ödemeden hemen
// sonra createUberDelivery çağırıyor). Web'de misafir siparişinde oturum yok
// ve kurye çağrısı ödeme tamamlandıktan SONRA, sunucuda oluyor — o yüzden aynı
// iş burada, HTTP katmanı olmadan yapılıyor.
//
// Bu eksikti: web'den verilen teslimat siparişleri ödendiği halde hiçbir zaman
// Uber'e düşmüyor, kurye atanmıyordu.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPickupAddressJson, getRestaurantPickup, uberFetch } from './uber.ts';

interface UberQuoteResponse {
  id: string;
  fee: number;
  currency: string;
  dropoff_eta?: string | null;
}

interface UberDeliveryResponse {
  id: string;
  tracking_url: string;
  status: string;
  fee: number;
  currency: string;
  pickup_eta: string | null;
  dropoff_eta: string | null;
}

export type DispatchResult =
  | { status: 'dispatched'; deliveryId: string; trackingUrl: string }
  | { status: 'already' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

const REQUIRED = [
  'delivery_full_name', 'delivery_street', 'delivery_city',
  'delivery_province', 'delivery_postal_code', 'delivery_lat', 'delivery_lng', 'phone',
] as const;

export async function dispatchUberDelivery(
  admin: SupabaseClient,
  orderId: string
): Promise<DispatchResult> {
  try {
    const { data: order, error } = await admin
      .from('orders')
      .select('*, order_items(quantity, price, products(name))')
      .eq('id', orderId)
      .single();

    if (error || !order) return { status: 'failed', reason: `order not found: ${error?.message}` };
    if (order.delivery_method !== 'delivery') return { status: 'skipped', reason: 'pickup order' };
    if (order.uber_delivery_id) return { status: 'already' };

    for (const field of REQUIRED) {
      const value = (order as Record<string, unknown>)[field];
      if (value === null || value === undefined || value === '') {
        return { status: 'failed', reason: `order.${field} is missing` };
      }
    }

    const pickup = getRestaurantPickup();
    const dropoffStreet = order.delivery_unit
      ? [order.delivery_street, order.delivery_unit]
      : [order.delivery_street];
    const dropoffAddressJson = JSON.stringify({
      street_address: dropoffStreet,
      city: order.delivery_city,
      state: order.delivery_province,
      zip_code: order.delivery_postal_code,
      country: order.delivery_country || 'CA',
    });
    const manifestTotalValue = Math.round(Number(order.total_amount) * 100);

    // ── 1) Teklif ────────────────────────────────────────────────────────
    // /deliveries bir quote_id istiyor. /delivery_quotes manifest_items
    // kabul etmiyor; Eats kademeli fiyatlaması için external_store_id şart.
    const externalStoreId = Deno.env.get('UBER_EXTERNAL_STORE_ID') || undefined;
    const quoteBody: Record<string, unknown> = {
      pickup_address: getPickupAddressJson(),
      pickup_latitude: pickup.lat,
      pickup_longitude: pickup.lng,
      pickup_phone_number: pickup.phone,
      dropoff_address: dropoffAddressJson,
      dropoff_latitude: Number(order.delivery_lat),
      dropoff_longitude: Number(order.delivery_lng),
      dropoff_phone_number: order.phone,
      manifest_total_value: manifestTotalValue,
      pickup_ready_dt: new Date().toISOString(),
    };
    if (externalStoreId) quoteBody.external_store_id = externalStoreId;

    const quote = await uberFetch<UberQuoteResponse>('/delivery_quotes', {
      method: 'POST',
      body: JSON.stringify(quoteBody),
    });

    // ── 2) Teslimat ──────────────────────────────────────────────────────
    type OrderItem = { quantity: number; price: number; products: { name: string } | null };
    const items = (order.order_items as OrderItem[] | null) ?? [];
    const manifestItems = items.length > 0
      ? items.map((it) => ({
          name: it.products?.name ?? 'Item',
          quantity: it.quantity,
          price: Math.round(it.price * 100),
        }))
      : [{ name: 'Order', quantity: 1, price: manifestTotalValue }];

    const delivery = await uberFetch<UberDeliveryResponse>('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        quote_id: quote.id,
        pickup_name: pickup.name,
        pickup_business_name: pickup.name,
        pickup_phone_number: pickup.phone,
        pickup_address: getPickupAddressJson(),
        pickup_latitude: pickup.lat,
        pickup_longitude: pickup.lng,
        dropoff_name: order.delivery_full_name,
        dropoff_phone_number: order.phone,
        dropoff_address: dropoffAddressJson,
        dropoff_latitude: Number(order.delivery_lat),
        dropoff_longitude: Number(order.delivery_lng),
        dropoff_notes: order.delivery_instructions ?? undefined,
        manifest_items: manifestItems,
        manifest_total_value: manifestTotalValue,
      }),
    });

    // delivery_fee'nin ÜZERİNE Uber'in ücreti yazılıyor — uber-create-delivery
    // ile aynı davranış. Kolon müşteriden tahsil edileni değil, restoranın
    // Uber'e ödediğini tutuyor; müşteriye gösterilen ücret toplamdan
    // türetiliyor (orderBreakdown.ts ve web'de aynı formül).
    const { error: updateError } = await admin
      .from('orders')
      .update({
        uber_delivery_id: delivery.id,
        uber_quote_id: quote.id,
        uber_tracking_url: delivery.tracking_url,
        uber_status: delivery.status,
        delivery_fee: delivery.fee / 100,
        delivery_currency: delivery.currency.toUpperCase(),
        pickup_eta: delivery.pickup_eta,
        dropoff_eta: delivery.dropoff_eta,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      // Kurye ÇAĞRILDI ama kaydedemedik. Sipariş kaybolmasın diye hata
      // fırlatmıyoruz; kimliği loglayıp restoranın panelden görmesini sağlıyoruz.
      console.error('[dispatch-uber] delivery created but order update failed', {
        orderId, deliveryId: delivery.id, updateError,
      });
    }

    return { status: 'dispatched', deliveryId: delivery.id, trackingUrl: delivery.tracking_url };
  } catch (err) {
    return { status: 'failed', reason: err instanceof Error ? err.message : String(err) };
  }
}
