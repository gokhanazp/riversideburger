// Supabase Edge Function: Confirm Payment
// Stripe ödeme durumunu kontrol eder ve günceller (Checks and updates Stripe payment status)

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
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      throw new Error('Payment Intent ID is required');
    }

    // Stripe'dan ödeme durumunu al (Get payment status from Stripe)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Ödeme durumunu güncelle (Update payment status)
    const updateData: any = {
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 
              paymentIntent.status === 'processing' ? 'processing' :
              paymentIntent.status === 'canceled' ? 'cancelled' : 'failed',
      updated_at: new Date().toISOString(),
    };

    // Eğer başarılı olduysa ek bilgileri ekle (If succeeded, add additional info)
    if (paymentIntent.status === 'succeeded') {
      updateData.paid_at = new Date().toISOString();
      updateData.stripe_charge_id = paymentIntent.latest_charge;
      
      // Kart bilgilerini ekle (Add card information)
      if (paymentIntent.payment_method) {
        const paymentMethod = await stripe.paymentMethods.retrieve(
          paymentIntent.payment_method as string
        );
        
        if (paymentMethod.card) {
          updateData.card_brand = paymentMethod.card.brand;
          updateData.card_last4 = paymentMethod.card.last4;
          updateData.card_exp_month = paymentMethod.card.exp_month;
          updateData.card_exp_year = paymentMethod.card.exp_year;
          updateData.payment_method = paymentMethod.type;
        }
      }
    }

    // Eğer başarısız olduysa hata bilgilerini ekle (If failed, add error info)
    if (paymentIntent.status === 'requires_payment_method' || 
        paymentIntent.status === 'canceled') {
      updateData.error_message = paymentIntent.last_payment_error?.message || 'Payment failed';
      updateData.error_code = paymentIntent.last_payment_error?.code || 'unknown';
    }

    // Database'i güncelle (Update database)
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update(updateData)
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      throw updateError;
    }

    // Sonucu döndür (Return result)
    return new Response(
      JSON.stringify({
        status: paymentIntent.status,
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
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

