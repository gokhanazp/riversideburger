// Stripe ödemesinden rapor için normalize ödeme yöntemi etiketi.
//
// Stripe'ta Apple Pay / Google Pay de "card" tipidir; cüzdan bilgisi
// payment_method.card.wallet.type altında gelir. Raporda "kart mı cüzdan mı"
// ayrımı isteniyor, o yüzden etiket burada tek yerde üretiliyor:
//   apple_pay | google_pay | link | card | <diğer stripe tipi>
// Hata hiçbir koşulda ödemeyi/siparişi etkilemesin: bilinmiyorsa null.

// deno-lint-ignore no-explicit-any
type StripeLike = { paymentIntents: { retrieve: (id: string, params?: Record<string, unknown>) => Promise<any> } };

export async function paymentMethodLabel(stripe: StripeLike, paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['payment_method'] });
    const pm = typeof pi?.payment_method === 'object' ? pi.payment_method : null;
    if (!pm) return null;
    const wallet = pm.card?.wallet?.type as string | undefined;
    if (wallet === 'apple_pay' || wallet === 'google_pay' || wallet === 'link') return wallet;
    return (pm.type as string) || null;
  } catch (e) {
    console.warn('[payment-method] okunamadı', paymentIntentId, String(e).slice(0, 120));
    return null;
  }
}
