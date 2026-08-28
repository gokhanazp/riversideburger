// confirm-checkout — müşteri Stripe'tan döndüğünde ödemeyi doğrular.
//
// success_url bize session_id ile dönüyor ama URL'deki bir parametreye
// GÜVENİLMEZ: ödeme gerçekten alındı mı diye Stripe'a sorulur. Sipariş ancak
// Stripe "paid" derse ödenmiş işaretlenir.
//
// Webhook da aynı işi yapıyor; bu yol müşteri sayfaya döndüğünde sonucu
// ANINDA göstermek için var. İkisi birlikte tetiklenebilir, mantık idempotent.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { markOrderPaid } from '../_shared/mark-paid.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { order_number, token, session_id } = (await req.json()) as {
      order_number?: string;
      token?: string;
      session_id?: string;
    };
    if (!order_number || !token || !UUID.test(token) || !session_id) {
      return json({ error: 'order_number, token and session_id are required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, payment_status')
      .eq('order_number', order_number)
      .eq('public_token', token)
      .maybeSingle();

    if (!order) return json({ error: 'not found' }, 404);
    if (order.payment_status === 'paid') return json({ paid: true, already: true });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Oturum bu siparişe mi ait? Başka bir siparişin ödenmiş oturum kimliğiyle
    // bu siparişi ödenmiş göstermeye çalışmak engellenmeli.
    if (session.metadata?.order_id !== order.id) {
      return json({ error: 'session does not belong to this order' }, 409);
    }
    if (session.payment_status !== 'paid') {
      return json({ paid: false, payment_status: session.payment_status });
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    await markOrderPaid(admin, {
      orderId: order.id,
      sessionId: session.id,
      paymentIntentId,
      amount: (session.amount_total ?? 0) / 100,
    });

    return json({ paid: true });
  } catch (error) {
    console.error('[confirm-checkout] unhandled', error);
    return json({ error: 'unexpected error' }, 500);
  }
});
