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
import { settleSession } from '../_shared/place-order.ts';

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

      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } }
      );

      // Sipariş satırı burada doğuyor. Müşteri ödeme sonrası sekmeyi kapatsa
      // bile bu yol siparişi oluşturur — kalıcı yol bu, tarayıcı dönüşü değil.
      const result = await settleSession(admin, session);

      if (result.status === 'unknown_session') {
        // Bizim taslağımıza ait değil (ya da süresi dolmuş). 200 dönüyoruz:
        // aksi halde Stripe saatlerce yeniden dener.
        console.warn('[stripe-webhook] unmatched session', session.id);
        return new Response('ignored', { status: 200 });
      }
      if (result.status === 'unpaid') {
        return new Response('not paid yet', { status: 200 });
      }

      console.log(
        '[stripe-webhook]', event.type, session.id,
        'order:', result.order.order_number, 'created:', result.order.created
      );
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('[stripe-webhook] handler failed', error);
    // 500 dönmek Stripe'ın yeniden denemesini sağlıyor — ödeme kaybolmasın.
    return new Response('handler error', { status: 500 });
  }
});
