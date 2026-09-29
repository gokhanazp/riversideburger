// confirm-checkout — müşteri Stripe'tan döndüğünde siparişi OLUŞTURUR.
//
// Sipariş satırı ilk kez burada (ya da webhook'ta, hangisi önce gelirse)
// doğuyor. Ödeme öncesinde orders tablosunda hiçbir şey yok — restoranın
// panelinde ödenmemiş sipariş görünmemesinin sebebi bu.
//
// URL'den gelen session_id'ye GÜVENİLMEZ: ödeme gerçekten alındı mı diye
// Stripe'a sorulur. Webhook da aynı işi yapıyor; bu yol müşteri sayfaya
// döndüğünde sonucu ANINDA gösterebilmek için var. İkisi birlikte
// tetiklenebilir, tek sipariş oluşur.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { settleSession } from '../_shared/place-order.ts';
import { paymentMethodLabel } from '../_shared/stripe-payment-method.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { session_id } = (await req.json()) as { session_id?: string };
    if (!session_id) return json({ error: 'session_id is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    // Rapor için ödeme yöntemi (kart / Apple Pay / Google Pay). Okunamazsa
    // null; sipariş yine oluşur.
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
    const payment_method = await paymentMethodLabel(stripe, piId);
    const result = await settleSession(admin, { ...session, payment_method });

    if (result.status === 'unpaid') {
      return json({ paid: false, payment_status: result.payment_status });
    }
    if (result.status === 'unknown_session') {
      return json({ error: 'this checkout could not be matched to an order' }, 404);
    }

    return json({
      paid: true,
      order_number: result.order.order_number,
      public_token: result.order.public_token,
    });
  } catch (error) {
    console.error('[confirm-checkout] unhandled', error);
    return json({ error: 'unexpected error' }, 500);
  }
});
