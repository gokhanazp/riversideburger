// place-order — ÖDENMİŞ bir Stripe oturumunu gerçek siparişe dönüştürür.
//
// Sipariş satırı ilk kez BURADA oluşuyor ve doğrudan payment_status='paid'
// olarak yazılıyor. Panele düşen her sipariş ödenmiştir; ödemesini
// tamamlamayan müşteri arkasında hiçbir şey bırakmaz.
//
// İki yerden çağrılıyor ve ikisi aynı anda tetiklenebilir:
//   • confirm-checkout — müşteri Stripe'tan siteye döndüğünde (hızlı yol)
//   • stripe-webhook   — müşteri dönmese bile Stripe haber verdiğinde (kalıcı yol)
//
// Çift sipariş orders.stripe_session_id üzerindeki BENZERSİZLİK KISITIYLA
// engelleniyor: yarışı kaybeden insert 23505 alır ve kazananın siparişini okur.
// Kilit protokolüne gerek yok, veritabanı zaten seri hale getiriyor.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { OrderDraft } from './order-draft.ts';

export interface PlaceOrderInput {
  draft: OrderDraft;
  sessionId: string;
  paymentIntentId: string | null;
  amount: number;
}

export interface PlacedOrder {
  id: string;
  order_number: string;
  public_token: string;
  created: boolean;
}

const UNIQUE_VIOLATION = '23505';

function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}

async function findBySession(admin: SupabaseClient, sessionId: string) {
  const { data } = await admin
    .from('orders')
    .select('id, order_number, public_token')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  return data;
}

/**
 * Misafirin kullanıcı kaydını çözer. Ödeme ALINDIKTAN sonra çalıştığı için
 * burada "hesap zaten var" diye vazgeçmek yok — müşteri parasını ödedi,
 * siparişi her hâlükârda oluşmalı.
 */
async function resolveUserId(admin: SupabaseClient, draft: OrderDraft): Promise<string> {
  if (draft.user_id) return draft.user_id;

  const guest = draft.guest;
  if (!guest) throw new Error('draft has neither user_id nor guest');

  // Taslak hazırlandıktan sonra kaydolmuş olabilir.
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', guest.email)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // public.users.id → auth.users(id) foreign key'i var, önce auth hesabı gerek.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: guest.email,
    email_confirm: true, // misafir akışında doğrulama e-postası yok
    user_metadata: { full_name: guest.full_name, phone: guest.phone },
  });

  let authId = authUser?.user?.id ?? null;

  if (!authId) {
    // Bu e-postayla auth hesabı VAR ama public.users satırı YOK — yarıda kalmış
    // eski bir denemeden kalmış olabilir. Ödeme alındıktan sonra buna takılıp
    // siparişi düşürmek müşteriyi parasız ve siparişsiz bırakırdı; mevcut auth
    // kimliğini bulup users satırını onun altına yazıyoruz.
    const { data: foundId, error: rpcError } = await admin.rpc('auth_user_id_for_email', {
      p_email: guest.email,
    });
    if (rpcError || !foundId) {
      console.error('[place-order] auth user unresolvable', { authError, rpcError });
      throw authError ?? new Error('could not resolve auth user for guest');
    }
    authId = foundId as string;
  }

  const { data: created, error: createError } = await admin
    .from('users')
    .insert({
      id: authId,
      email: guest.email,
      full_name: guest.full_name,
      phone: guest.phone,
      role: 'customer',
      points: 0,
    })
    .select('id')
    .single();

  if (created?.id) return created.id;

  // Aynı anda başka bir çağrı açmış olabilir — bir kez daha bak.
  const { data: raced } = await admin
    .from('users')
    .select('id')
    .eq('email', guest.email)
    .maybeSingle();
  if (raced?.id) return raced.id;

  console.error('[place-order] users insert failed', createError);
  throw createError ?? new Error('could not create guest record');
}

export async function placeOrder(
  admin: SupabaseClient,
  input: PlaceOrderInput
): Promise<PlacedOrder> {
  // Zaten dönüştürülmüş mü?
  const existing = await findBySession(admin, input.sessionId);
  if (existing) return { ...existing, created: false };

  const { draft, sessionId } = input;
  const userId = await resolveUserId(admin, draft);
  const paidAt = new Date().toISOString();

  // ── Sipariş ────────────────────────────────────────────────────────────
  let order: { id: string; order_number: string; public_token: string } | null = null;

  // order_number zaman damgası + rastgele sayıdan üretiliyor; çok küçük bir
  // çakışma ihtimali var. Oturum kimliği çakışması ise başka bir çağrının
  // aynı ödemeyi bizden önce işlediği anlamına gelir.
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    const { data, error } = await admin
      .from('orders')
      .insert({
        ...draft.order,
        user_id: userId,
        order_number: generateOrderNumber(),
        stripe_session_id: sessionId,
        payment_status: 'paid',
        paid_at: paidAt,
      })
      .select('id, order_number, public_token')
      .single();

    if (data) {
      order = data;
      break;
    }

    if (error?.code === UNIQUE_VIOLATION) {
      const raced = await findBySession(admin, sessionId);
      if (raced) return { ...raced, created: false }; // oturum çakışması
      continue; // order_number çakışması — yeni numarayla dene
    }

    console.error('[place-order] order insert failed', error);
    throw error ?? new Error('could not create order');
  }

  if (!order) throw new Error('could not create order after retries');

  // ── Kalemler ───────────────────────────────────────────────────────────
  const { error: itemsError } = await admin.from('order_items').insert(
    draft.lines.map((l) => ({
      order_id: order!.id,
      product_id: l.product_id,
      quantity: l.quantity,
      price: l.unit_price,
      subtotal: l.subtotal,
    }))
  );
  if (itemsError) {
    // Kalemsiz sipariş mutfak için işe yaramaz — ama ödeme ALINDI, siparişi
    // silmek parayı alıp siparişi yok etmek olurdu. Sipariş kalıyor, hata
    // loglanıyor; mutfak kalemsiz bir fiş görürse restoran müşteriyi arayabilir.
    console.error('[place-order] items insert failed — order kept', {
      order_id: order.id,
      itemsError,
    });
  }

  // ── Özelleştirmeler ────────────────────────────────────────────────────
  const optionById = new Map(draft.options.map((o) => [o.id, o]));
  const customizationRows = draft.lines.flatMap((l) =>
    l.option_ids
      .map((id) => optionById.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .map((o) => ({
        order_id: order!.id,
        product_id: l.product_id,
        product_name: l.product_name,
        option_id: o.id,
        option_name: o.name,
        option_name_en: o.name_en ?? null,
        option_price: Number(o.price ?? 0),
        quantity: l.quantity,
        special_instructions: l.special_instructions,
      }))
  );
  if (customizationRows.length > 0) {
    const { error: customError } = await admin
      .from('order_item_customizations')
      .insert(customizationRows);
    // Fişte "Domates Çıkar" gibi satırlar buradan basılıyor ama eksikliği
    // siparişi iptal ettirmez — uygulamadaki davranışın aynısı.
    if (customError) console.error('[place-order] customizations failed', customError);
  }

  // ── Ödeme kaydı ────────────────────────────────────────────────────────
  const { error: paymentError } = await admin.from('payments').insert({
    order_id: order.id,
    user_id: userId,
    amount: input.amount,
    currency: 'CAD',
    status: 'succeeded',
    paid_at: paidAt,
    stripe_payment_intent_id: input.paymentIntentId,
    metadata: { checkout_session_id: sessionId },
  });
  if (paymentError) console.error('[place-order] payment insert failed', paymentError);

  // Taslak işini bitirdi.
  await admin.from('web_checkouts').delete().eq('stripe_session_id', sessionId);

  return { ...order, created: true };
}

/** Stripe oturumundan ihtiyaç duyulan alanlar (Stripe tipine bağımlı olmamak için). */
export interface SettleSession {
  id: string;
  payment_status: string | null;
  payment_intent: string | { id: string } | null;
  amount_total: number | null;
}

export type SettleResult =
  | { status: 'placed'; order: PlacedOrder }
  | { status: 'unpaid'; payment_status: string | null }
  | { status: 'unknown_session' };

/**
 * Ödenmiş bir Stripe oturumunu siparişe çevirir. confirm-checkout ve
 * stripe-webhook'un ikisi de bunu çağırıyor; ikisi aynı anda çalışsa bile
 * tek sipariş oluşur (bkz. orders.stripe_session_id benzersizlik kısıtı).
 */
export async function settleSession(
  admin: SupabaseClient,
  session: SettleSession
): Promise<SettleResult> {
  const already = await findBySession(admin, session.id);
  if (already) return { status: 'placed', order: { ...already, created: false } };

  if (session.payment_status !== 'paid') {
    return { status: 'unpaid', payment_status: session.payment_status };
  }

  const { data: stash } = await admin
    .from('web_checkouts')
    .select('draft')
    .eq('stripe_session_id', session.id)
    .maybeSingle();

  if (!stash?.draft) {
    // Taslak yok ve sipariş de yok. Bu oturum bize ait değil (başka bir
    // entegrasyon) ya da taslak süresi dolup silinmiş. İkinci durumda para
    // alınmış demektir; loglayıp restoranın görebilmesi için gürültü çıkarıyoruz.
    console.error('[settleSession] paid session has no draft', session.id);
    return { status: 'unknown_session' };
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const order = await placeOrder(admin, {
    draft: stash.draft as OrderDraft,
    sessionId: session.id,
    paymentIntentId,
    amount: (session.amount_total ?? 0) / 100,
  });

  return { status: 'placed', order };
}
