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

    const quote = await uberFetch<UberQuoteResponse>('/delivery_quotes', {
      method: 'POST',
      body: JSON.stringify({
        pickup_address: getPickupAddressJson(),
        pickup_latitude: pickup.lat,
        pickup_longitude: pickup.lng,
        pickup_phone_number: pickup.phone,
        dropoff_address: dropoffAddressJson,
        dropoff_latitude: body.dropoff_lat,
        dropoff_longitude: body.dropoff_lng,
        dropoff_phone_number: body.dropoff_phone,
      }),
    });

    return new Response(
      JSON.stringify({
        quote_id: quote.id,
        fee_cents: quote.fee,
        fee: quote.fee / 100,
        currency: quote.currency.toUpperCase(),
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
