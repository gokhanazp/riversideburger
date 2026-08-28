// stripe-webhook — ödemenin KALICI yolu.
//
// confirm-checkout müşteri sayfaya döndüğünde çalışıyor. Ama müşteri ödemeyi
// yapıp sekmeyi kapatabilir, ağı kopabilir, telefonu kilitlenebilir. O durumda
// para tahsil edilmiş ama sipariş 'pending' kalır — mutfak ödenmiş bir siparişi
// ödenmemiş görür. Webhook bunu kapatıyor: Stripe olayı bize kendi gönderiyor.
//
// İmza DOĞRULANIYOR. Doğrulamasız bir webhook, herkesin sipariş ödenmiş
// işaretleyebileceği açık bir uç nokta olurdu.
//
// KURULUM (Stripe Dashboard → Developers → Webhooks):
//   uç nokta : https://<proje>.supabase.co/functions/v1/stripe-webhook
//   olaylar  : checkout.session.completed, checkout.session.async_payment_succeeded
//   sonra    : supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//   ve       : supabase functions deploy stripe-webhook --no-verify-jwt
// (Stripe JWT göndermediği için bu fonksiyon --no-verify-jwt ile dağıtılmalı.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { markOrderPaid } from '../_shared/mark-paid.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST required', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return new Response('not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    // Gövde İMZALANDIĞI GİBİ okunmalı — JSON.parse edilip yeniden
    // serialize edilirse imza doğrulaması başarısız olur.
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (error) {
    console.error('[stripe-webhook] signature verification failed', error);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;

      if (!orderId) {
        console.warn('[stripe-webhook] session without order_id', session.id);
        // 200 dönüyoruz: Stripe aksi halde saatlerce yeniden denemeye devam eder
        // ve bu olay bizim siparişimize ait değil.
        return new Response('ignored', { status: 200 });
      }

      if (session.payment_status !== 'paid') {
        return new Response('not paid yet', { status: 200 });
      }

      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } }
      );

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      const result = await markOrderPaid(admin, {
        orderId,
        sessionId: session.id,
        paymentIntentId,
        amount: (session.amount_total ?? 0) / 100,
      });

      console.log('[stripe-webhook]', event.type, orderId, 'changed:', result.changed);
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('[stripe-webhook] handler failed', error);
    // 500 dönmek Stripe'ın yeniden denemesini sağlıyor — ödeme kaybolmasın.
    return new Response('handler error', { status: 500 });
  }
});
