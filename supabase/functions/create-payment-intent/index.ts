// Supabase Edge Function: Create Payment Intent
// Stripe Payment Intent oluşturur (Creates Stripe Payment Intent)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Stripe client oluştur (Create Stripe client)
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Supabase client oluştur (Create Supabase client)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Kullanıcı doğrulama (Verify user)
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Request body'yi parse et (Parse request body)
    const { amount, currency, orderId, metadata, breakdown } = await req.json();

    // Validasyon (Validation)
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!currency) {
      throw new Error('Currency is required');
    }

    // ── Tahsil edilecek tutarın SUNUCUDA doğrulanması ──────────────────────
    //
    // Neden: bu fonksiyon tutarı istemciden alıyordu ve yalnızca "> 0" diye
    // bakıyordu. Yani ne kadar tahsil edileceğine uygulama karar veriyordu.
    // 27 Ağustos – 7 Eylül arasında HST'si eksik bir uygulama paketi 19
    // siparişte hiç vergi almadı ve hiçbir yerde uyarı çıkmadı; toplam 38,34
    // CAD eksik tahsilat üç hafta boyunca fark edilmedi.
    //
    // Artık istemci dökümü de gönderiyor ve toplam burada yeniden
    // hesaplanıyor. Vergi oranı istemciden DEĞİL, settings'ten okunuyor.
    //
    // Döküm göndermeyen ESKİ paketler reddedilmiyor: ödeme akışını kırmak,
    // eksik vergiden daha pahalı. Onlar loglanıyor ki mağaza sürümleriyle
    // ne zaman tükendikleri görülebilsin.
    if (breakdown && typeof breakdown === 'object') {
      const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const subtotal = num(breakdown.subtotal);
      const discount = num(breakdown.discount);
      const pointsUsed = num(breakdown.pointsUsed);
      const deliveryFee = num(breakdown.deliveryFee);
      const tip = num(breakdown.tip);

      const { data: settingsRow } = await supabaseClient
        .from('settings')
        .select('tax_rate')
        .limit(1)
        .maybeSingle();

      // Oran okunamazsa Ontario HST'sine düşülüyor — uygulamadaki davranışın
      // aynısı. Sıfır GEÇERLİ SAYILMIYOR: vergiyi sessizce sıfırlamak tam da
      // buradaki hatanın kendisiydi.
      const rawRate = Number(settingsRow?.tax_rate);
      const taxRate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 13;

      // Yuvarlama ifadesi istemcidekiyle BİREBİR aynı olmalı
      // (src/services/taxService.ts → calculateTax ve PaymentScreen →
      // finalTotal). Farklı yazımlar 30.000 senaryoluk karşılaştırmada 2
      // kuruşa kadar sapıyordu; bu, geçerli ödemelerin reddedilmesi demekti.
      const base = Math.max(0, subtotal - discount - pointsUsed) + deliveryFee;
      const tax = base > 0 ? Number(((base * taxRate) / 100).toFixed(2)) : 0;
      const expected = Number((base + tax + tip).toFixed(2));

      // Bir kuruşluk yuvarlama farkı kabul ediliyor; ötesi reddediliyor.
      if (Math.abs(expected - Number(amount)) > 0.01) {
        console.error('[create-payment-intent] tutar uyuşmuyor', {
          gonderilen: amount,
          beklenen: expected,
          taban: base,
          vergi: tax,
          oran: taxRate,
        });
        return new Response(
          JSON.stringify({
            error: 'amount does not match the server-calculated total',
            expected,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.warn('[create-payment-intent] döküm gönderilmedi — eski istemci paketi', {
        amount,
        userId: user.id,
      });
    }

    // Stripe Payment Intent oluştur (Create Stripe Payment Intent)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe cent cinsinden çalışır (Stripe works in cents)
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: user.id,
        orderId: orderId || '',
        ...metadata,
      },
    });

    // Payment kaydı oluştur (Create payment record)
    const { error: insertError } = await supabaseClient
      .from('payments')
      .insert({
        order_id: orderId,
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: amount,
        currency: currency,
        status: 'pending',
        metadata: metadata || {},
      });

    if (insertError) {
      console.error('Error inserting payment:', insertError);
      throw insertError;
    }

    // Client secret döndür (Return client secret)
    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

