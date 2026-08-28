// create-order — siparişi SUNUCUDA oluşturur ve fiyatı sunucuda belirler.
//
// Neden var:
// Uygulama bugün toplamı istemcide hesaplayıp `total_amount` olarak yazıyor
// (PaymentScreen.tsx). Derlenmiş bir mobil uygulamada katlanılır; halka açık bir
// web sitesinde bu doğrudan istismar — tarayıcıdan 0,01 $ toplam gönderilebilir.
// Bu fonksiyon fiyatın tek gerçek kaynağı: istemci NE İSTEDİĞİNİ söyler, NE
// KADAR ödeyeceğini söylemez.
//
// İstemciden gelen ve GÜVENİLMEYEN her şey:
//   • ürün fiyatı        → products.price'tan okunur
//   • ek malzeme fiyatı  → product_options.price'tan okunur
//   • kampanya indirimi  → aktif kampanyalardan sunucuda seçilir
//   • teslimat ücreti    → mesafe + settings kademelerinden hesaplanır
//   • vergi              → settings.tax_rate'ten
//   • kullanılan puan    → kullanıcının gerçek bakiyesiyle sınırlanır
//
// Toplam formülü uygulamayla BİREBİR aynı (CartScreen:218,221 + PaymentScreen:127):
//   preTax = max(0, subtotal - discount - pointsUsed) + deliveryFee
//   tax    = preTax * rate/100            (bahşiş vergiye dahil değil)
//   total  = preTax + tax + tip
//
// Misafir sipariş: public.users.id, auth.users(id)'ye foreign key ile bağlı
// (users_id_fkey). Yani "auth hesabı olmadan users satırı" mümkün DEĞİL.
// Bu yüzden misafir için önce Admin API ile parolasız bir auth kullanıcısı
// açılıyor, sonra public.users satırı o id ile yazılıyor. Müşteri isterse
// sonradan "parolamı unuttum" ile aynı hesabı sahiplenebiliyor.
// Şema değişikliği yine gerekmiyor.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getRestaurantPickup } from '../_shared/uber.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TAX_RATE_FALLBACK = 13; // Ontario HST
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 20;

interface RequestItem {
  product_id: string;
  quantity: number;
  /** product_options.id listesi — fiyatları sunucuda okunur */
  option_ids?: string[];
  special_instructions?: string | null;
}

interface RequestBody {
  items: RequestItem[];
  delivery_method: 'pickup' | 'delivery';
  /** Girişsiz sipariş için; oturum varsa yok sayılır */
  guest?: { full_name: string; phone: string; email: string };
  address?: {
    full_name?: string;
    phone?: string;
    street_number: string;
    street_name: string;
    unit_number?: string | null;
    city: string;
    province: string;
    postal_code: string;
    delivery_instructions?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  tip_amount?: number;
  points_to_use?: number;
  notes?: string | null;
}

const round2 = (n: number) => Number(n.toFixed(2));

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((2 * 6371 * Math.asin(Math.sqrt(h))).toFixed(2));
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad('POST required', 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    const body = (await req.json()) as RequestBody;

    // ── Girdi doğrulama ────────────────────────────────────────────────────
    if (!Array.isArray(body.items) || body.items.length === 0) return bad('items is required');
    if (body.items.length > MAX_ITEMS) return bad('too many items');
    if (body.delivery_method !== 'pickup' && body.delivery_method !== 'delivery') {
      return bad('delivery_method must be pickup or delivery');
    }
    for (const item of body.items) {
      if (!item.product_id) return bad('each item needs product_id');
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY_PER_ITEM) {
        return bad('invalid quantity');
      }
    }

    // ── Kimlik: oturum varsa o, yoksa misafir ──────────────────────────────
    // Oturumu service_role ile değil, gelen token'la çözüyoruz; aksi halde
    // istemci başka birinin user_id'sini gönderip onun puanını harcayabilirdi.
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data } = await admin.auth.getUser(token);
      if (data?.user) userId = data.user.id;
    }

    // Misafir alanları BURADA doğrulanıyor ama kullanıcı BURADA açılmıyor —
    // hesap oluşturma sepet doğrulamasından sonraya bırakıldı. İlk sürümde
    // önce açılıyordu ve geçersiz bir sipariş reddedildiğinde ardında sahipsiz
    // bir kullanıcı kalıyordu; geçersiz istek göndererek hesap üretilebilirdi.
    if (!userId) {
      const g = body.guest;
      if (!g?.full_name?.trim() || !g?.phone?.trim() || !g?.email?.trim()) {
        return bad('guest full_name, phone and email are required when not signed in');
      }
    }

    // ── Ürünler ve fiyatlar: DB'den ────────────────────────────────────────
    const productIds = [...new Set(body.items.map((i) => i.product_id))];
    const { data: products, error: productError } = await admin
      .from('products')
      .select('id, name, price, category_id, is_active, stock_status')
      .in('id', productIds);
    if (productError) return bad('could not load products', 500);

    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    for (const id of productIds) {
      const p = productById.get(id);
      if (!p) return bad(`unknown product: ${id}`);
      if (!p.is_active) return bad(`product is not available: ${p.name}`);
      // stock_status'a burada da uyuluyor. Uygulamada bir süre yok sayılmış ve
      // tükenen ürünler sipariş edilebilmişti; sunucu tarafı son savunma.
      if (p.stock_status === 'out_of_stock') return bad(`sold out: ${p.name}`);
    }

    // ── Ek malzeme fiyatları: DB'den ───────────────────────────────────────
    const optionIds = [...new Set(body.items.flatMap((i) => i.option_ids ?? []))];
    const optionById = new Map<string, { id: string; name: string; name_en: string | null; price: number }>();
    if (optionIds.length > 0) {
      const { data: options, error: optionError } = await admin
        .from('product_options')
        .select('id, name, name_en, price, is_active')
        .in('id', optionIds);
      if (optionError) return bad('could not load options', 500);
      for (const o of options ?? []) {
        if (!o.is_active) return bad(`option is not available: ${o.name}`);
        optionById.set(o.id, o);
      }
      for (const id of optionIds) {
        if (!optionById.has(id)) return bad(`unknown option: ${id}`);
      }
    }

    // ── Ara toplam ─────────────────────────────────────────────────────────
    // Kalem fiyatı = ürün fiyatı + seçilen ek malzemelerin toplamı.
    // Uygulamadaki davranışla aynı: ekstralar kalem fiyatının İÇİNDE.
    const lines = body.items.map((item) => {
      const product = productById.get(item.product_id)!;
      const extras = (item.option_ids ?? []).reduce(
        (sum, id) => sum + Number(optionById.get(id)!.price ?? 0),
        0
      );
      const unitPrice = round2(Number(product.price) + extras);
      return {
        product_id: product.id,
        product_name: product.name,
        category_id: product.category_id as string | null,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: round2(unitPrice * item.quantity),
        option_ids: item.option_ids ?? [],
        special_instructions: item.special_instructions ?? null,
      };
    });
    const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));

    if (!userId) {
      const guest = body.guest;
      if (!guest?.full_name?.trim() || !guest?.phone?.trim() || !guest?.email?.trim()) {
        return bad('guest full_name, phone and email are required when not signed in');
      }
      const email = guest.email.trim().toLowerCase();

      // Aynı e-postayla daha önce sipariş verilmiş ya da kayıt olunmuşsa o
      // satır kullanılır; her siparişte yeni kullanıcı üretilmez.
      const { data: existing } = await admin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing?.id) {
        userId = existing.id;
      } else {
        // Önce auth kullanıcısı — public.users.id ona foreign key ile bağlı.
        const { data: authUser, error: authError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true, // misafir akışında doğrulama e-postası yok
          user_metadata: { full_name: guest.full_name.trim(), phone: guest.phone.trim() },
        });

        if (authError || !authUser?.user) {
          // Bu e-postayla bir auth hesabı var ama public.users satırı yok.
          // Sessizce o hesabın altına sipariş yazmak yanlış olur — müşteriyi
          // giriş yapmaya yönlendiriyoruz.
          console.error('[create-order] auth user create failed', authError);
          return bad('An account already exists for this email — please sign in to order.', 409);
        }

        const { data: created, error: createError } = await admin
          .from('users')
          .insert({
            id: authUser.user.id,
            email,
            full_name: guest.full_name.trim(),
            phone: guest.phone.trim(),
            role: 'customer',
            points: 0,
          })
          .select('id')
          .single();

        if (createError || !created) {
          // Yetim auth kullanıcısı bırakma.
          await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {});
          console.error('[create-order] users insert failed', createError);
          return bad('could not create guest record', 500);
        }
        userId = created.id;
      }
    }

    // ── Kampanya: sunucuda seçilir ─────────────────────────────────────────
    const { data: campaigns } = await admin
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // İlk-sipariş kampanyası ve müşteri başına kullanım limiti için gerçek
    // sipariş geçmişine bakılır; istemcinin "ben ilk siparişimi veriyorum"
    // demesine güvenilmez. Sayım uygulamadakiyle aynı: iptal edilmiş
    // siparişler sayılmıyor (campaignService.ts:125).
    const { data: history } = await admin
      .from('orders')
      .select('campaign_id, status')
      .eq('user_id', userId)
      .neq('status', 'cancelled');

    const previousOrders = (history ?? []).length;
    const usageByCampaign: Record<string, number> = {};
    for (const row of history ?? []) {
      if (row.campaign_id) {
        usageByCampaign[row.campaign_id] = (usageByCampaign[row.campaign_id] ?? 0) + 1;
      }
    }

    const nowMs = Date.now();
    let campaignId: string | null = null;
    let discount = 0;
    let campaignName: string | null = null;

    for (const c of campaigns ?? []) {
      const startsOk = !c.starts_at || new Date(c.starts_at).getTime() <= nowMs;
      const endsOk = !c.ends_at || new Date(c.ends_at).getTime() >= nowMs;
      if (!startsOk || !endsOk) continue;
      if (subtotal < Number(c.min_order_amount ?? 0)) continue;
      if (c.type === 'first_order' && previousOrders > 0) continue;

      // Müşteri başına kullanım limiti. Uygulamanın isEligible'ı bunu zaten
      // denetliyor (campaignEngine.ts) ama benim aktarımım atlamıştı: limiti
      // dolmuş bir kampanya web'de tekrar uygulanabiliyordu.
      const limit = c.per_customer_limit;
      if (limit != null && (usageByCampaign[c.id] ?? 0) >= Number(limit)) continue;

      // HEDEFLEME — uygulamadaki eligibleLines'ın karşılığı
      // (src/services/campaignEngine.ts). İlk sürümde bu filtre yoktu ve
      // yalnızca üç ürünü hedefleyen "Buy one get one free" kampanyası
      // sepetteki HER ürüne uygulanıyordu; test siparişinde Ginger Ale
      // hak etmediği bir indirim aldı.
      let targeted = lines;
      if (c.target_type === 'category') {
        const set = new Set<string>(c.target_category_ids ?? []);
        targeted = lines.filter((l) => l.category_id != null && set.has(l.category_id));
      } else if (c.target_type === 'product') {
        const set = new Set<string>(c.target_product_ids ?? []);
        targeted = lines.filter((l) => set.has(l.product_id));
      } else if (c.target_type !== 'all') {
        targeted = [];
      }
      if (targeted.length === 0 && c.target_type !== 'all') continue;

      const targetedAmount = round2(targeted.reduce((sum, l) => sum + l.unit_price * l.quantity, 0));

      let candidate = 0;
      if (c.type === 'first_order' || c.type === 'percentage') {
        const percent = Number(c.discount_percent) || 0;
        // first_order her zaman TÜM sepete, percentage yalnızca hedefe —
        // uygulamadaki ayrımın aynısı.
        const base = c.type === 'first_order' ? subtotal : targetedAmount;
        if (percent > 0) candidate = round2(Math.min((base * percent) / 100, base));
      } else if (c.type === 'buy_x_get_y') {
        const buy = Math.max(0, Math.floor(Number(c.buy_quantity ?? 0)));
        const free = Math.max(0, Math.floor(Number(c.free_quantity ?? 0)));
        const group = buy + free;
        if (group > 0 && free > 0) {
          const units: number[] = [];
          for (const l of targeted) for (let i = 0; i < l.quantity; i++) units.push(l.unit_price);
          const freeUnits = Math.floor(units.length / group) * free;
          if (freeUnits > 0) {
            // En ucuz birimler bedava — uygulamadaki davranış.
            units.sort((a, b) => a - b);
            candidate = round2(units.slice(0, freeUnits).reduce((s, u) => s + u, 0));
          }
        }
      }

      if (candidate > discount) {
        discount = candidate;
        campaignId = c.id;
        campaignName = c.name_en ?? c.name_tr ?? null;
      }
    }

    // ── Puan: kullanıcının GERÇEK bakiyesiyle sınırlı ──────────────────────
    const { data: userRow } = await admin
      .from('users')
      .select('points, phone, full_name')
      .eq('id', userId)
      .single();

    const balance = Math.max(0, Number(userRow?.points ?? 0));
    const requested = Math.max(0, Number(body.points_to_use ?? 0));
    // Puan indirimden SONRAKİ tutarı aşamaz — sepetteki kuralın aynısı
    // (CartScreen:132).
    const pointsUsed = round2(Math.min(requested, balance, Math.max(0, subtotal - discount)));

    // ── Teslimat ücreti: mesafe + ayarlardaki kademeler ────────────────────
    const { data: settings } = await admin
      .from('settings')
      .select('delivery_tier1_max_km, delivery_tier1_fee, delivery_tier2_max_km, delivery_tier2_fee, tax_rate')
      .limit(1)
      .maybeSingle();

    let deliveryFee = 0;
    let distanceKm: number | null = null;

    if (body.delivery_method === 'delivery') {
      const address = body.address;
      if (!address?.street_name || !address?.city || !address?.postal_code) {
        return bad('address is required for delivery');
      }
      if (address.latitude == null || address.longitude == null) {
        // Koordinat yoksa mesafe bilinemez, mesafe bilinmezse ücret
        // uydurulamaz. Çağıran tarafın geocode-address ile koordinat alması
        // gerekiyor — uygulamada da akış böyle.
        return bad('address latitude and longitude are required for delivery');
      }
      const pickup = getRestaurantPickup();
      distanceKm = haversineKm(pickup.lat, pickup.lng, Number(address.latitude), Number(address.longitude));

      const tier1Km = Number(settings?.delivery_tier1_max_km ?? 5);
      const tier1Fee = Number(settings?.delivery_tier1_fee ?? 4.99);
      const tier2Km = Number(settings?.delivery_tier2_max_km ?? 8);
      const tier2Fee = Number(settings?.delivery_tier2_fee ?? 8.99);

      if (distanceKm <= tier1Km) deliveryFee = round2(tier1Fee);
      else if (distanceKm <= tier2Km) deliveryFee = round2(tier2Fee);
      else return bad(`outside our delivery area (${distanceKm} km)`, 422);
    }

    // ── Vergi ve toplam ────────────────────────────────────────────────────
    const taxRate = Number(settings?.tax_rate ?? TAX_RATE_FALLBACK);
    const preTax = round2(Math.max(0, subtotal - discount - pointsUsed) + deliveryFee);
    const tax = round2((preTax * taxRate) / 100);
    // Bahşiş vergiye tabi değil (kuryeye gidiyor).
    const tip = round2(Math.max(0, Number(body.tip_amount ?? 0)));
    const total = round2(preTax + tax + tip);

    // ── Sipariş satırı ─────────────────────────────────────────────────────
    const address = body.address;
    const deliveryAddressText =
      body.delivery_method === 'pickup'
        ? 'Pickup'
        : [
            `${address!.street_number} ${address!.street_name}`,
            address!.unit_number ? `Unit ${address!.unit_number}` : null,
            address!.city,
            address!.province,
            address!.postal_code,
          ]
            .filter(Boolean)
            .join(', ');

    const phone = (body.guest?.phone ?? address?.phone ?? userRow?.phone ?? '').trim();

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total_amount: total,
        delivery_address: deliveryAddressText,
        phone,
        notes: body.notes ?? null,
        points_earned: 0, // trigger hesaplıyor
        points_used: pointsUsed,
        delivery_method: body.delivery_method,
        delivery_full_name:
          body.delivery_method === 'delivery' ? (address?.full_name ?? userRow?.full_name ?? null) : null,
        delivery_street:
          body.delivery_method === 'delivery' ? `${address!.street_number} ${address!.street_name}` : null,
        delivery_unit: body.delivery_method === 'delivery' ? (address?.unit_number ?? null) : null,
        delivery_city: body.delivery_method === 'delivery' ? address!.city : null,
        delivery_province: body.delivery_method === 'delivery' ? address!.province : null,
        delivery_postal_code: body.delivery_method === 'delivery' ? address!.postal_code : null,
        delivery_country: 'CA',
        delivery_lat: body.delivery_method === 'delivery' ? address!.latitude : null,
        delivery_lng: body.delivery_method === 'delivery' ? address!.longitude : null,
        delivery_instructions:
          body.delivery_method === 'delivery' ? (address?.delivery_instructions ?? null) : null,
        delivery_fee: deliveryFee,
        tip_amount: tip,
        // Ödeme henüz alınmadı: Stripe akışı bu siparişi 'paid'e çeviriyor.
        payment_status: 'pending',
        paid_at: null,
        campaign_id: campaignId,
        discount_amount: discount,
        tax_amount: tax,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('[create-order] order insert failed', orderError);
      return bad('could not create order', 500);
    }

    // ── Kalemler ───────────────────────────────────────────────────────────
    const { error: itemsError } = await admin.from('order_items').insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        quantity: l.quantity,
        price: l.unit_price,
        subtotal: l.subtotal,
      }))
    );
    if (itemsError) {
      // Kalemsiz sipariş mutfak için işe yaramaz; siparişi geri al.
      await admin.from('orders').delete().eq('id', order.id);
      console.error('[create-order] items insert failed', itemsError);
      return bad('could not create order items', 500);
    }

    // ── Özelleştirmeler ────────────────────────────────────────────────────
    const customizationRows = lines.flatMap((l) =>
      l.option_ids.map((id) => {
        const o = optionById.get(id)!;
        return {
          order_id: order.id,
          product_id: l.product_id,
          product_name: l.product_name,
          option_id: o.id,
          option_name: o.name,
          option_name_en: o.name_en ?? null,
          option_price: Number(o.price ?? 0),
          quantity: l.quantity,
          special_instructions: l.special_instructions,
        };
      })
    );
    if (customizationRows.length > 0) {
      const { error: customError } = await admin
        .from('order_item_customizations')
        .insert(customizationRows);
      // Fişte "Domates Çıkar" gibi satırlar buradan basılıyor ama eksikliği
      // siparişi iptal ettirmez — uygulamadaki davranışın aynısı.
      if (customError) console.error('[create-order] customizations failed', customError);
    }

    return new Response(
      JSON.stringify({
        order_id: order.id,
        order_number: order.order_number,
        breakdown: {
          subtotal,
          discount,
          campaign_name: campaignName,
          points_used: pointsUsed,
          delivery_fee: deliveryFee,
          distance_km: distanceKm,
          tax,
          tax_rate: taxRate,
          tip,
          total,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-order] unhandled', error);
    return bad('unexpected error', 500);
  }
});
