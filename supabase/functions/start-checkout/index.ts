// start-checkout — sepeti sunucuda fiyatlar ve müşteriyi doğrudan Stripe'a yollar.
//
// SİPARİŞ BURADA OLUŞMAZ. Fiyatlanmış taslak web_checkouts'ta bekler; orders
// satırı yalnızca ödeme tamamlandıktan sonra (confirm-checkout / stripe-webhook
// → place-order) oluşur. Bu yüzden ödemesini yarıda bırakan müşteri admin
// panelinde hiçbir iz bırakmaz.
//
// Bunu değiştirmeden önce: eski akış siparişi 'pending' yazıp sonra ödemeye
// gidiyordu ve restoran ödenmemiş siparişleri panelde görüyordu. Sıra bilerek
// böyle.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { buildOrderDraft, type RequestBody } from '../_shared/order-draft.ts';
import { isOpenNow, type OpenSettings } from '../_shared/hours.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const money = (v: number) => `$${v.toFixed(2)}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    const body = (await req.json()) as RequestBody & { return_origin?: string; quote_only?: boolean };

    // Oturumu service_role ile değil, gelen token'la çözüyoruz; aksi halde
    // istemci başka birinin user_id'sini gönderip onun puanını harcayabilirdi.
    let signedInUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await admin.auth.getUser(authHeader.slice(7));
      if (data?.user) signedInUserId = data.user.id;
    }

    const result = await buildOrderDraft(admin, body, signedInUserId);
    if (!result.ok) return json({ error: result.error }, result.status);
    const { draft } = result;

    // ── Yalnızca fiyat teklifi ─────────────────────────────────────────────
    // Teslimat ücreti adrese bağlı ve müşteri onu ÖDEME SAYFASINA GİTMEDEN
    // görmeli. Bu mod sepete dökümü verir: hesap açmaz, Stripe oturumu
    // açmaz, taslak saklamaz. Hesap açma bloğundan ÖNCE dönüyor ki bir
    // fiyat sorgusu yanlışlıkla hesap oluşturmasın.
    if (body.quote_only) {
      return json({ quote: true, breakdown: draft.breakdown });
    }

    // ── Mutfak kapalıysa sipariş alınmıyor ─────────────────────────────────
    // Fiyat teklifinden SONRA, hesap açmadan ÖNCE: kapalıyken de müşteri
    // dökümü görebilsin, ama reddedilecek bir sipariş için hesap açılmasın.
    //
    // Sepetteki düğme de kapalı (riverside-web CartView) — burası eski bir
    // sekmenin ya da doğrudan atılan bir isteğin geçmemesi için.
    const { data: openSettings, error: openError } = await admin
      .from('settings')
      .select('is_open, auto_close_enabled, working_hours')
      .limit(1)
      .maybeSingle();

    // Ayar okunamazsa AÇIK kabul ediliyor — uygulamanın ve web'in davranışı da
    // bu. Bir okuma hatası yüzünden bütün siparişleri reddetmek, açık bir
    // restoranı kapatmak demek olurdu.
    if (!openError && openSettings && !isOpenNow(openSettings as OpenSettings)) {
      return json(
        {
          error: 'We are closed right now, so we cannot take this order.',
          code: 'restaurant_closed',
        },
        409
      );
    }

    // ── İsteğe bağlı üyelik ────────────────────────────────────────────────
    // Müşteri sepette şifre girdiyse hesabı BURADA açıyoruz, ödemeden önce.
    // Gerekçe: hesap açılmasını müşteri açıkça istedi; ödeme yarıda kalsa bile
    // istediği hesaba sahip olmalı. Şifre taslağa YAZILMIYOR — web_checkouts'ta
    // açık şifre beklemesi kabul edilemez.
    //
    // Zaten hesabı olan bir e-postaya şifre atamıyoruz: kimliği doğrulanmamış
    // bir istekle mevcut hesabın şifresini değiştirmek hesap ele geçirme olurdu.
    const password = body.account_password?.trim();
    if (password && !signedInUserId) {
      if (password.length < 6) {
        return json({ error: 'Password must be at least 6 characters.' }, 400);
      }
      if (draft.user_id) {
        return json(
          {
            error: 'An account already exists for this email. Sign in first, or leave the password blank to order as a guest.',
            code: 'account_exists',
          },
          409
        );
      }

      const guest = draft.guest!;
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: guest.email,
        password,
        email_confirm: true, // projede mailer_autoconfirm açık; doğrulama e-postası yok
        user_metadata: { full_name: guest.full_name, phone: guest.phone },
      });

      if (authError || !authUser?.user) {
        // public.users satırı olmayan bir auth hesabı olabilir.
        console.error('[start-checkout] account create failed', authError);
        return json(
          {
            error: 'An account already exists for this email. Please sign in to continue.',
            code: 'account_exists',
          },
          409
        );
      }

      const { error: rowError } = await admin.from('users').insert({
        id: authUser.user.id,
        email: guest.email,
        full_name: guest.full_name,
        phone: guest.phone,
        role: 'customer',
        points: 0,
      });
      if (rowError) {
        // Yarım hesap bırakma.
        await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {});
        console.error('[start-checkout] users insert failed', rowError);
        return json({ error: 'could not create your account' }, 500);
      }

      draft.user_id = authUser.user.id;
    }

    const amountCents = Math.round(draft.breakdown.total * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json({ error: 'order total is not payable' }, 422);
    }

    // Dönüş adresi yalnızca izin verilen kaynaklardan olabilir; aksi halde
    // saldırgan kendi sitesine yönlendiren bir ödeme bağlantısı üretebilir.
    const allowed = (Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const origin = allowed.includes(body.return_origin ?? '') ? body.return_origin! : allowed[0];
    if (!origin) return json({ error: 'CHECKOUT_ALLOWED_ORIGINS is not configured' }, 500);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Müşteri artık ara bir döküm sayfası görmüyor, doğrudan Stripe'a gidiyor.
    // İndirimin ve HST'nin görünmeden kalmaması için döküm kalem açıklamasına
    // yazılıyor — Stripe sayfasında tutarın hemen altında görünür.
    const b = draft.breakdown;
    const parts = [`Subtotal ${money(b.subtotal)}`];
    if (b.discount > 0) parts.push(`Discount −${money(b.discount)}${b.campaign_name ? ` (${b.campaign_name})` : ''}`);
    if (b.points_used > 0) parts.push(`Points −${money(b.points_used)}`);
    if (b.delivery_fee > 0) parts.push(`Delivery ${money(b.delivery_fee)}`);
    parts.push(`HST ${money(b.tax)}`);
    if (b.tip > 0) parts.push(`Tip ${money(b.tip)}`);

    const itemCount = draft.lines.reduce((sum, l) => sum + l.quantity, 0);

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
              name: `Riverside Burgers — ${itemCount} ${itemCount === 1 ? 'item' : 'items'} (${draft.order.delivery_method})`,
              description: parts.join(' · '),
            },
          },
        },
      ],
      // Sipariş numarası henüz YOK — dönüş sayfası oturum kimliğiyle çalışıyor.
      success_url: `${origin}/order/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?cancelled=1`,
      ...(draft.guest?.email ? { customer_email: draft.guest.email } : {}),
      metadata: { kind: 'web_checkout' },
    });

    if (!session.url) return json({ error: 'Stripe did not return a checkout url' }, 502);

    // Taslağı sakla: ödeme tamamlandığında sipariş bundan doğacak.
    // Stripe oturumu oluştuktan SONRA yazılıyor ki anahtar oturum kimliği olsun.
    const { error: stashError } = await admin.from('web_checkouts').insert({
      stripe_session_id: session.id,
      draft,
    });
    if (stashError) {
      // Taslak saklanamazsa ödeme alınıp sipariş oluşturulamaz. Müşteriyi
      // Stripe'a hiç göndermiyoruz — oturum ödenmediği sürece zararsız.
      console.error('[start-checkout] draft stash failed', stashError);
      return json({ error: 'could not start checkout' }, 500);
    }

    // Tamamlanmamış eski taslakları temizle (ödenmiş olanlar zaten siliniyor).
    await admin
      .from('web_checkouts')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return json({
      url: session.url,
      session_id: session.id,
      // Canlı mı test mi — yanlış modda ödeme denemesini fark etmek için.
      livemode: session.livemode,
      breakdown: b,
    });
  } catch (error) {
    console.error('[start-checkout] unhandled', error);
    return json({ error: error instanceof Error ? error.message : 'unexpected error' }, 500);
  }
});
