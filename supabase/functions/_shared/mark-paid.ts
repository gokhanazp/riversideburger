// Bir siparişi ödenmiş olarak işaretle. İki yerden çağrılıyor:
//   • confirm-checkout — müşteri Stripe'tan sayfamıza döndüğünde
//   • stripe-webhook   — müşteri dönmese bile Stripe haber verdiğinde
// İkisinin de aynı sonucu üretmesi için mantık tek yerde.
//
// Fikir olarak idempotent: zaten 'paid' olan sipariş tekrar yazılmıyor, çünkü
// iki yol aynı ödeme için birlikte tetiklenebilir.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface MarkPaidInput {
  orderId: string;
  sessionId: string;
  paymentIntentId: string | null;
  amount: number;
}

export async function markOrderPaid(
  admin: SupabaseClient,
  input: MarkPaidInput
): Promise<{ changed: boolean }> {
  const { data: order } = await admin
    .from('orders')
    .select('id, payment_status')
    .eq('id', input.orderId)
    .maybeSingle();

  if (!order) return { changed: false };
  if (order.payment_status === 'paid') return { changed: false };

  const paidAt = new Date().toISOString();

  const { error: orderError } = await admin
    .from('orders')
    .update({ payment_status: 'paid', paid_at: paidAt })
    .eq('id', input.orderId);

  if (orderError) {
    console.error('[markOrderPaid] order update failed', orderError);
    throw orderError;
  }

  // Ödeme kaydını da güncelle. Oturum kimliği metadata'da tutuluyor; eşleşen
  // satır yoksa (ör. eski bir kayıt) sipariş yine ödenmiş sayılır — kasadaki
  // gerçek Stripe ödemesi belirleyici olan.
  const { error: paymentError } = await admin
    .from('payments')
    .update({
      status: 'succeeded',
      paid_at: paidAt,
      stripe_payment_intent_id: input.paymentIntentId,
    })
    .eq('order_id', input.orderId)
    .contains('metadata', { checkout_session_id: input.sessionId });

  if (paymentError) console.error('[markOrderPaid] payment update failed', paymentError);

  return { changed: true };
}
