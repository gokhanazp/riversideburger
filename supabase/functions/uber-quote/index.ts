// Supabase Edge Function: Uber Direct Delivery Quote
// Müşteri checkout'a yaklaşırken teslimat ücretini ve ETA'yı çeker
// Mobile app calls this before showing the payment screen

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getPickupAddressJson, getRestaurantPickup, uberFetch } from '../_shared/uber.ts';

interface QuoteRequest {
  dropoff_address: string;      // single line, human-readable
  dropoff_street: string;       // "688 Queen Street East" (no unit)
  dropoff_unit?: string;
  dropoff_city: string;
  dropoff_province: string;     // "ON"
  dropoff_postal_code: string;  // "M4M 2G1"
  dropoff_country?: string;     // "CA" default
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_phone: string;        // E.164: +14165551234
  dropoff_name: string;
  // Manifest detayları — eksik bırakılırsa Uber daha yüksek ücret çıkarabiliyor
  manifest_total_value?: number; // cents
  manifest_items?: Array<{
    name: string;
    quantity: number;
    price_cents: number;
  }>;
}

interface UberQuoteResponse {
  id: string;
  fee: number;            // cents
  currency: string;       // "cad"
  duration: number;       // total minutes
  pickup_duration: number;
  dropoff_eta: string;    // ISO
  expires: string;
}

// Mesafe tarifesi varsayılanları — settings tablosunda kolon yoksa/null ise kullanılır
const TIER_DEFAULTS = {
  tier1MaxKm: 5,
  tier1Fee: 5.99,
  tier2MaxKm: 8,
  tier2Fee: 8.99,
};

// İki koordinat arası kuş uçuşu mesafe (km). Uber quote.distance döndürmüyor.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((2 * 6371 * Math.asin(Math.sqrt(h))).toFixed(2));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const body = await req.json() as QuoteRequest;
    if (!body.dropoff_lat || !body.dropoff_lng || !body.dropoff_phone) {
      throw new Error('dropoff_lat, dropoff_lng, dropoff_phone are required');
    }

    const pickup = getRestaurantPickup();

    // Mesafe tarifesi: restorana olan kuş uçuşu mesafeye göre sabit ücret.
    // Uber'i çağırmadan ÖNCE hesapla — son kademe üst sınırını aşan adresleri
    // erken reddet (gereksiz Uber çağrısı yapma).
    const distanceKm = haversineKm(pickup.lat, pickup.lng, body.dropoff_lat, body.dropoff_lng);

    const { data: cfg } = await supabase
      .from('settings')
      .select('delivery_tier1_max_km, delivery_tier1_fee, delivery_tier2_max_km, delivery_tier2_fee')
      .limit(1)
      .maybeSingle();

    const num = (v: unknown, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const tier1MaxKm = num(cfg?.delivery_tier1_max_km, TIER_DEFAULTS.tier1MaxKm);
    const tier1Fee = num(cfg?.delivery_tier1_fee, TIER_DEFAULTS.tier1Fee);
    const tier2MaxKm = num(cfg?.delivery_tier2_max_km, TIER_DEFAULTS.tier2MaxKm);
    const tier2Fee = num(cfg?.delivery_tier2_fee, TIER_DEFAULTS.tier2Fee);

    let tierFee: number;
    if (distanceKm <= tier1MaxKm) {
      tierFee = tier1Fee;
    } else if (distanceKm <= tier2MaxKm) {
      tierFee = tier2Fee;
    } else {
      // Teslimat alanı dışında — Uber'i çağırma, müşteriye bilgi dön
      console.log('[uber-quote][out-of-range]', JSON.stringify({
        distance_km: distanceKm,
        max_km: tier2MaxKm,
        dropoff_postal: body.dropoff_postal_code,
        dropoff_city: body.dropoff_city,
      }));
      return new Response(
        JSON.stringify({ available: false, distance_km: distanceKm, max_km: tier2MaxKm }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const dropoffStreet = body.dropoff_unit
      ? [body.dropoff_street, body.dropoff_unit]
      : [body.dropoff_street];

    const dropoffAddressJson = JSON.stringify({
      street_address: dropoffStreet,
      city: body.dropoff_city,
      state: body.dropoff_province,
      zip_code: body.dropoff_postal_code,
      country: body.dropoff_country || 'CA',
    });

    // /delivery_quotes manifest_items kabul etmiyor (sadece /deliveries için).
    // Quote için sinyaller: manifest_total_value + external_store_id (Eats merchant
    // tier pricing'i için zorunlu) + pickup_ready_dt (ASAP).
    const externalStoreId = Deno.env.get('UBER_EXTERNAL_STORE_ID') || undefined;

    const uberRequestBody: Record<string, unknown> = {
      pickup_address: getPickupAddressJson(),
      pickup_latitude: pickup.lat,
      pickup_longitude: pickup.lng,
      pickup_phone_number: pickup.phone,
      dropoff_address: dropoffAddressJson,
      dropoff_latitude: body.dropoff_lat,
      dropoff_longitude: body.dropoff_lng,
      dropoff_phone_number: body.dropoff_phone,
      manifest_total_value: body.manifest_total_value ?? 0,
      pickup_ready_dt: new Date().toISOString(),
    };
    if (externalStoreId) uberRequestBody.external_store_id = externalStoreId;

    console.log('[uber-quote][req→Uber]', JSON.stringify(uberRequestBody));

    const quote = await uberFetch<UberQuoteResponse>('/delivery_quotes', {
      method: 'POST',
      body: JSON.stringify(uberRequestBody),
    });
    console.log('[uber-quote][res←Uber]', JSON.stringify(quote));

    // Quote teşhis logu — sokak adresi/telefon loglanmaz; sadece postal+lat/lng+fee.
    // Müşteriye yansıyan ücret bizim mesafe tarifemiz (tier_fee); quote_fee_cad ise
    // Uber'in bize çıkardığı gerçek maliyet (fark restorana kalır).
    const tierFeeCents = Math.round(tierFee * 100);
    console.log('[uber-quote]', JSON.stringify({
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      pickup_postal: 'M4M 1G9',
      dropoff_lat: body.dropoff_lat,
      dropoff_lng: body.dropoff_lng,
      dropoff_postal: body.dropoff_postal_code,
      dropoff_city: body.dropoff_city,
      haversine_km: distanceKm,         // mesafe tarifesinin baz aldığı kuş uçuşu mesafe
      tier_fee_cad: tierFee,            // müşteriden alınan
      quote_id: quote.id,
      uber_fee_cad: quote.fee / 100,    // Uber'in gerçek maliyeti (teşhis)
      currency: quote.currency,
      duration_min: quote.duration,
      pickup_duration_min: quote.pickup_duration,
      dropoff_eta: quote.dropoff_eta,
    }));

    return new Response(
      JSON.stringify({
        available: true,
        quote_id: quote.id,
        fee_cents: tierFeeCents,
        fee: tierFee,
        currency: 'CAD',
        distance_km: distanceKm,
        duration_minutes: quote.duration,
        dropoff_eta: quote.dropoff_eta,
        expires_at: quote.expires,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('uber-quote error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
