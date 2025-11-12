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
    const { amount, currency, orderId, metadata } = await req.json();

    // Validasyon (Validation)
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!currency) {
      throw new Error('Currency is required');
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

