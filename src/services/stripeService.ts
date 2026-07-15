// Stripe Payment Service
// Stripe ödeme işlemlerini yönetir (Manages Stripe payment operations)

import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

// Supabase Functions URL
const FUNCTIONS_URL =
  Constants.expoConfig?.extra?.supabaseFunctionsUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ||
  'https://srcslhltajjvteqeptrt.supabase.co/functions/v1';

/**
 * Payment Intent oluştur (Create Payment Intent)
 * @param amount - Ödeme tutarı (Payment amount)
 * @param currency - Para birimi (Currency: CAD, TRY)
 * @param orderId - Sipariş ID (Order ID)
 * @param metadata - Ek bilgiler (Additional metadata)
 */
export const createPaymentIntent = async (
  amount: number,
  currency: string,
  orderId?: string,
  metadata?: Record<string, any>
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  try {
    console.log('💳 Creating payment intent:', { amount, currency, orderId });

    // Supabase session token al (Get Supabase session token)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    // Edge Function çağır (Call Edge Function)
    const response = await fetch(`${FUNCTIONS_URL}/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        orderId,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create payment intent');
    }

    const data = await response.json();
    console.log('✅ Payment intent created:', data.paymentIntentId);

    return {
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
    };
  } catch (error: any) {
    console.error('❌ Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Ödeme durumunu kontrol et (Confirm payment status)
 * @param paymentIntentId - Payment Intent ID
 */
export const confirmPayment = async (
  paymentIntentId: string
): Promise<{ status: string; paymentIntent: any }> => {
  try {
    console.log('🔍 Confirming payment:', paymentIntentId);

    // Supabase session token al (Get Supabase session token)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    // Edge Function çağır (Call Edge Function)
    const response = await fetch(`${FUNCTIONS_URL}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        paymentIntentId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm payment');
    }

    const data = await response.json();
    console.log('✅ Payment confirmed:', data.status);

    return data;
  } catch (error: any) {
    console.error('❌ Error confirming payment:', error);
    throw error;
  }
};

/**
 * Ödeme kaydını siparişe bağla (Link the payment record to an order)
 * Sipariş ödemeden SONRA oluşturulduğu için payments.order_id başta boştur;
 * sipariş oluşunca burada bağlarız. Böylece Stripe ödemesi ↔ sipariş ilişkisi kurulur
 * (admin/muhasebe eşleştirmesi + Stripe kaynaklı doğrulama için).
 * @param paymentIntentId - Stripe Payment Intent ID
 * @param orderId - Oluşturulan sipariş ID
 */
export const attachOrderToPayment = async (
  paymentIntentId: string,
  orderId: string
): Promise<void> => {
  const { error } = await supabase
    .from('payments')
    .update({ order_id: orderId })
    .eq('stripe_payment_intent_id', paymentIntentId);

  if (error) {
    // Bağlama başarısız olsa da sipariş akışını bozmayalım; sadece logla.
    console.warn('⚠️ Could not link payment to order:', error.message);
  }
};

/**
 * Kullanıcının ödeme geçmişini getir (Get user's payment history)
 * @param userId - Kullanıcı ID (User ID)
 */
export const getUserPayments = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        orders (
          order_number,
          total_amount,
          status,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error: any) {
    console.error('❌ Error fetching user payments:', error);
    throw error;
  }
};

/**
 * Sipariş için ödeme kaydını getir (Get payment record for order)
 * @param orderId - Sipariş ID (Order ID)
 */
export const getPaymentByOrderId = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('❌ Error fetching payment:', error);
    throw error;
  }
};

