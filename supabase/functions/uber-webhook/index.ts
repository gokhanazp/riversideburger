// Supabase Edge Function: Uber Direct Webhook Receiver
// Public endpoint — Uber delivery durumu/kurye konumu değiştiğinde POST eder
// HMAC-SHA256 signature ile doğrular, orders satırını günceller

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapUberStatusToOrderStatus } from '../_shared/uber.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-uber-signature',
};

interface UberWebhookEvent {
  kind: string;            // "event.delivery_status" | "event.courier_update"
  delivery_id: string;
  status?: string;
  data?: {
    status?: string;
    pickup_eta?: string;
    dropoff_eta?: string;
    courier?: {
      name?: string;
      phone_number?: string;
      img_href?: string;
      vehicle?: {
        make?: string;
        model?: string;
        color?: string;
        license_plate?: string;
      };
      location?: { lat: number; lng: number };
    };
    location?: { lat: number; lng: number };
  };
}

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const secret = Deno.env.get('UBER_WEBHOOK_SIGNING_SECRET');
  if (!secret) {
    console.error('UBER_WEBHOOK_SIGNING_SECRET not configured');
    return false;
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-uber-signature');

    const valid = await verifySignature(rawBody, signature);
    if (!valid) {
      console.warn('Invalid Uber webhook signature');
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(rawBody) as UberWebhookEvent;
    const deliveryId = event.delivery_id;
    if (!deliveryId) {
      return new Response(JSON.stringify({ error: 'delivery_id missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const update: Record<string, unknown> = {
      uber_raw: event,
      updated_at: new Date().toISOString(),
    };

    const uberStatus = event.status ?? event.data?.status;
    if (uberStatus) {
      update.uber_status = uberStatus;
      const mapped = mapUberStatusToOrderStatus(uberStatus);
      if (mapped) update.status = mapped;
    }

    if (event.data?.pickup_eta) update.pickup_eta = event.data.pickup_eta;
    if (event.data?.dropoff_eta) update.dropoff_eta = event.data.dropoff_eta;

    const courier = event.data?.courier;
    if (courier) {
      if (courier.name) update.courier_name = courier.name;
      if (courier.phone_number) update.courier_phone = courier.phone_number;
      if (courier.img_href) update.courier_image_url = courier.img_href;
      if (courier.vehicle?.make) update.courier_vehicle_make = courier.vehicle.make;
      if (courier.vehicle?.model) update.courier_vehicle_model = courier.vehicle.model;
      if (courier.vehicle?.color) update.courier_vehicle_color = courier.vehicle.color;
      if (courier.vehicle?.license_plate) update.courier_license_plate = courier.vehicle.license_plate;
      if (courier.location) {
        update.courier_lat = courier.location.lat;
        update.courier_lng = courier.location.lng;
        update.courier_location_updated_at = new Date().toISOString();
      }
    }

    // Bazı event'lerde courier objesi olmadan sadece location gelebilir
    if (!courier?.location && event.data?.location) {
      update.courier_lat = event.data.location.lat;
      update.courier_lng = event.data.location.lng;
      update.courier_location_updated_at = new Date().toISOString();
    }

    const { error } = await admin
      .from('orders')
      .update(update)
      .eq('uber_delivery_id', deliveryId);

    if (error) {
      console.error('Order update failed:', error);
      throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('uber-webhook error:', err);
    // Uber retry'lar — 5xx döndür ki tekrar denesinler
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
