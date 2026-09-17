// Supabase Edge Function: validate-coupon
//
// Müşteri sepette bir kupon kodu yazdığında çağrılır. Kodun geçerliliğine ve
// indirim tutarına KARAR VEREN tek yer burası (ve ödeme anında aynı ortak
// modülü kullanan create-payment-intent / order-draft).
//
// NEDEN SERVICE_ROLE: kupon satırları RLS ile gizli. `campaigns` okuma
// politikası kupon kodlarını yalnızca sahibine gösteriyor; herkese açık
// kodları hiç kimseye listelemiyor. Müşteri kodu bilerek giriyor, tabloyu
// okuyarak keşfetmiyor. Bu fonksiyon RLS'i atladığı için TEK bir kodu
// doğruluyor, hiçbir zaman kupon LİSTESİ döndürmüyor.
//
// Geçersiz kupon 200 + { valid: false, reason } ile döner; 4xx değil. Böylece
// uygulamanın genel hata yakalayıcısı sebebi yutup "bir şeyler ters gitti"
// demek zorunda kalmıyor, müşteri gerçek sebebi görüyor.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { priceCartLines, validateCartShape } from '../_shared/cart-pricing.ts';
import { normalizeCouponCode, validateCoupon } from '../_shared/coupons.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: 'invalid request body' }, 400);

    const code = normalizeCouponCode(body.code);
    if (!code) return json({ valid: false, reason: 'not_found' });

    const shapeError = validateCartShape(body.items);
    if (shapeError && !shapeError.ok) return json({ error: shapeError.error }, shapeError.status);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Oturum ZORUNLU DEĞİL: misafir de kupon deneyebilir. Ama kişiye atanmış
    // kuponlar ve müşteri başına limit ancak kullanıcı bilinirse uygulanabilir,
    // o yüzden atanmış kupon oturumsuz reddedilir (reason: 'login_required').
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const asUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await asUser.auth.getUser();
      userId = data?.user?.id ?? null;
    }

    // Fiyatlar DB'den okunur — istemcinin gönderdiği tutara güvenilmez.
    const priced = await priceCartLines(admin, body.items);
    if (!priced.ok) return json({ error: priced.error }, priced.status);

    // Teslimat ücreti "bedava teslimat" kuponunun değerini belirliyor. Burada
    // ÖNİZLEME amaçlı istemciden alınıyor; bağlayıcı olan, ödeme anında
    // mesafeden hesaplanan ücret (order-draft / PaymentScreen).
    //
    // ÜCRET HENÜZ BİLİNMEYEBİLİR: web'de müşteri adresini girmeden ücret
    // hesaplanmıyor. Teslimat seçiliyken ücreti sıfır saymak, geçerli bir
    // "bedava teslimat" kuponunu 'no_benefit' diye reddetmek demek olurdu.
    // Teslimat seçiliyse simgesel bir ücretle kuponu geçerli sayıyoruz;
    // gerçek tutarı zaten ödeme anında sunucu hesaplıyor.
    const reportedFee = Math.max(0, Number(body.delivery_fee ?? 0)) || 0;
    const deliveryFee =
      reportedFee > 0 ? reportedFee : body.delivery_method === 'delivery' ? 0.01 : 0;

    const verdict = await validateCoupon(admin, {
      code,
      userId,
      lines: priced.lines.map((l) => ({
        product_id: l.product_id,
        category_id: l.category_id,
        unit_price: l.unit_price,
        quantity: l.quantity,
      })),
      subtotal: priced.subtotal,
      deliveryFee,
    });

    if (!verdict.ok) {
      return json({
        valid: false,
        reason: verdict.reason,
        ...(verdict.minOrderAmount != null ? { min_order_amount: verdict.minOrderAmount } : {}),
      });
    }

    const c = verdict.campaign;
    return json({
      valid: true,
      code: c.code,
      campaign_id: c.id,
      type: c.type,
      discount: verdict.discount,
      waives_delivery: verdict.waivesDelivery,
      subtotal: priced.subtotal,
      name_tr: c.name_tr,
      name_en: c.name_en,
      description_tr: c.description_tr,
      description_en: c.description_en,
    });
  } catch (error) {
    console.error('[validate-coupon] beklenmeyen hata', error);
    return json({ error: 'could not validate coupon' }, 500);
  }
});
