// Supabase Edge Function: Uber Direct Create Delivery
// Stripe ödemesi onaylandıktan sonra mobil app tarafından çağrılır
// Order'daki snapshot'a göre Uber'e delivery oluşturur, tracking_url kaydeder

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getPickupAddressJson, getRestaurantPickup, uberFetch } from '../_shared/uber.ts';

interface CreateDeliveryRequest {
  order_id: string;
  quote_id: string;
}

interface UberDeliveryResponse {
  id: string;
  tracking_url: string;
  status: string;
  pickup_eta: string | null;
  dropoff_eta: string | null;
  fee: number;
  currency: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // User-scoped client for auth check
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { order_id, quote_id } = await req.json() as CreateDeliveryRequest;
    if (!order_id || !quote_id) throw new Error('order_id and quote_id are required');

    // Service-role client for trusted writes (bypass RLS for status updates)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Order'ı çek ve sahipliği doğrula
    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('*, order_items(quantity, price, products(name))')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !order) throw new Error(`Order not found: ${orderErr?.message ?? 'no data'}`);

    if (order.uber_delivery_id) {
      // Idempotency: zaten delivery oluşturulmuş, tekrar oluşturma
      return new Response(
        JSON.stringify({
          delivery_id: order.uber_delivery_id,
          tracking_url: order.uber_tracking_url,
          status: order.uber_status,
          already_exists: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    // Snapshot validation
    const required = [
      'delivery_full_name', 'delivery_street', 'delivery_city',
      'delivery_province', 'delivery_postal_code', 'delivery_lat', 'delivery_lng', 'phone',
    ] as const;
    for (const f of required) {
      if (order[f] === null || order[f] === undefined || order[f] === '') {
        throw new Error(`order.${f} is missing — can't dispatch to Uber`);
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

    // Manifest items — Uber ister minimum 1 kalem
    type OrderItem = { quantity: number; price: number; products: { name: string } | null };
    const items = (order.order_items as OrderItem[] | null) ?? [];
    const manifestItems = items.length > 0
      ? items.map((it) => ({
          name: it.products?.name ?? 'Item',
          quantity: it.quantity,
          price: Math.round(it.price * 100), // cents
        }))
      : [{ name: 'Order', quantity: 1, price: Math.round(Number(order.total_amount) * 100) }];

    const delivery = await uberFetch<UberDeliveryResponse>('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        quote_id,
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
        manifest_total_value: Math.round(Number(order.total_amount) * 100),
      }),
    });

    const { error: updateErr } = await adminClient
      .from('orders')
      .update({
        uber_delivery_id: delivery.id,
        uber_quote_id: quote_id,
        uber_tracking_url: delivery.tracking_url,
        uber_status: delivery.status,
        delivery_fee: delivery.fee / 100,
        delivery_currency: delivery.currency.toUpperCase(),
        pickup_eta: delivery.pickup_eta,
        dropoff_eta: delivery.dropoff_eta,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    if (updateErr) {
      console.error('Failed to update order with Uber delivery info:', updateErr);
      throw updateErr;
    }

    return new Response(
      JSON.stringify({
        delivery_id: delivery.id,
        tracking_url: delivery.tracking_url,
        status: delivery.status,
        pickup_eta: delivery.pickup_eta,
        dropoff_eta: delivery.dropoff_eta,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('uber-create-delivery error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
