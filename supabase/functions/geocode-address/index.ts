// Supabase Edge Function: Geocode Address
// LocationIQ ile adres → lat/lng dönüşümü
// Mobil app adres ekleme/düzenleme sırasında çağırır
// Token Supabase secret olarak duruyor, client'ta açığa çıkmıyor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  // Yapılandırılmış (tercih edilen)
  street?: string;
  unit?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  // Veya tek satır free-form (fallback)
  query?: string;
}

interface LocationIQResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
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

    const token = Deno.env.get('LOCATIONIQ_TOKEN');
    if (!token) throw new Error('LOCATIONIQ_TOKEN not configured');

    const body = await req.json() as GeocodeRequest;

    const queryString = body.query || [
      body.unit ? `${body.unit}-${body.street ?? ''}` : body.street,
      body.city,
      body.province,
      body.postal_code,
      body.country || 'Canada',
    ].filter(Boolean).join(', ');

    if (!queryString.trim()) throw new Error('address query is required');

    const url = new URL('https://us1.locationiq.com/v1/search');
    url.searchParams.set('key', token);
    url.searchParams.set('q', queryString);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', body.country?.toLowerCase() === 'us' ? 'us' : 'ca');

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LocationIQ ${res.status}: ${text}`);
    }

    const results = await res.json() as LocationIQResult[];
    if (!results.length) {
      return new Response(
        JSON.stringify({ error: 'address_not_found', query: queryString }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      );
    }

    const r = results[0];
    return new Response(
      JSON.stringify({
        lat: Number(r.lat),
        lng: Number(r.lon),
        display_name: r.display_name,
        components: r.address ?? null,
        query: queryString,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('geocode-address error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
