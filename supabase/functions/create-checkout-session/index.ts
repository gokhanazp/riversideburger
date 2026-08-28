// create-checkout-session — bir sipariş için Stripe Checkout sayfası açar.
//
// Tutar İSTEMCİDEN GELMİYOR: order_number + public_token doğrulanıp sipariş
// service_role ile okunuyor ve `total_amount` ne diyorsa o tahsil ediliyor.
// Böylece "sepette gördüğüm fiyat" ile "kartımdan çekilen" arasında ayrışma
// mümkün değil — ikisi de aynı satırdan geliyor.
//
// Tek kalem olarak yazılıyor, sipariş kalemleri tek tek değil. Sebep: indirim
// ve vergi Stripe'ta ayrı nesneler (coupon, tax_rate) ve bizim hesabımızla
// Stripe'ın hesabı arasında kuruş farkı doğabilir. Müşteri kalem dökümünü
// zaten onay sayfasında görüyor; Stripe'ta yalnızca tahsil edilecek tutar var.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

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
    const { order_number, token, return_origin } = (await req.json()) as {
      order_number?: string;
      token?: string;
      return_origin?: string;
    };

    if (!order_number || !token || !UUID.test(token)) {
      return json({ error: 'order_number and token are required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: order, error } = await admin
      .from('orders')
      .select('id, order_number, user_id, total_amount, payment_status')
      .eq('order_number', order_number)
      .eq('public_token', token)
      .maybeSingle();

    if (error) {
      console.error('[create-checkout-session] load failed', error);
      return json({ error: 'could not load order' }, 500);
    }
    if (!order) return json({ error: 'not found' }, 404);

    // Ödenmiş siparişi ikinci kez tahsil etmeye kalkmıyoruz.
    if (order.payment_status === 'paid') {
      return json({ error: 'already paid', already_paid: true }, 409);
    }

    const amountCents = Math.round(Number(order.total_amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json({ error: 'order total is not payable' }, 422);
    }

    // Dönüş adresi yalnızca izin verilen kaynaklardan olabilir; aksi halde
    // saldırgan kendi sitesine yönlendiren bir ödeme bağlantısı üretebilir.
    const allowed = (Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const origin = allowed.includes(return_origin ?? '') ? return_origin! : allowed[0];
    if (!origin) return json({ error: 'CHECKOUT_ALLOWED_ORIGINS is not configured' }, 500);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const orderPath = `/order/${order.order_number}?t=${token}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Kart alanları bizim sayfamızda hiç olmuyor; PCI yükü Stripe'ta kalıyor.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'cad',
            unit_amount: amountCents,
            product_data: {
              name: `Riverside Burgers — order ${order.order_number}`,
              description: 'Includes any discount and HST as shown on your order page.',
            },
          },
        },
      ],
      success_url: `${origin}${orderPath}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${orderPath}&cancelled=1`,
      metadata: { order_id: order.id, order_number: order.order_number },
      payment_intent_data: {
        metadata: { order_id: order.id, order_number: order.order_number },
      },
    });

    // Ödeme kaydını şimdi aç: dönüş olmasa bile Stripe oturumunun hangi
    // siparişe ait olduğu veritabanında duruyor.
    await admin.from('payments').insert({
      order_id: order.id,
      user_id: order.user_id,
      amount: Number(order.total_amount),
      currency: 'CAD',
      status: 'pending',
      metadata: { checkout_session_id: session.id },
    });

    return json({
      url: session.url,
      session_id: session.id,
      // Canlı mı test mi — yanlış modda ödeme denemesini fark etmek için.
      livemode: session.livemode,
    });
  } catch (error) {
    console.error('[create-checkout-session] unhandled', error);
    return json({ error: error instanceof Error ? error.message : 'unexpected error' }, 500);
  }
});
