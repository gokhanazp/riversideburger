// order-draft — sepeti SUNUCUDA fiyatlar ve bir sipariş TASLAĞI üretir.
//
// Hiçbir şey yazmaz. Taslak, ödeme tamamlanana kadar web_checkouts'ta bekler;
// orders satırına dönüşmesi place-order.ts'in işi.
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

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getRestaurantPickup } from './uber.ts';
import { geocodeAddress } from './geocode.ts';
import {
  normalizeCouponCode,
  validateCoupon,
  type CouponRejection,
} from './coupons.ts';
import {
  priceCartLines,
  validateCartShape,
  type PricedLine,
  type PricedOption,
} from './cart-pricing.ts';

const TAX_RATE_FALLBACK = 13; // Ontario HST

export const round2 = (n: number) => Number(n.toFixed(2));

export interface RequestItem {
  product_id: string;
  quantity: number;
  /** product_options.id listesi — fiyatları sunucuda okunur */
  option_ids?: string[];
  special_instructions?: string | null;
}

export interface RequestBody {
  items: RequestItem[];
  delivery_method: 'pickup' | 'delivery';
  /** Girişsiz sipariş için; oturum varsa yok sayılır */
  guest?: { full_name: string; phone: string; email: string };
  /** Doluysa müşteri hesap açmak istiyor. Taslağa ASLA yazılmaz. */
  account_password?: string;
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
  /** Müşterinin elle girdiği kupon kodu. Doğrulama sunucuda yapılır. */
  coupon_code?: string | null;
}

// Fiyatlama modülünün ürettiği tiplerin aynısı — ikinci bir tanım yazmak,
// alanlar ayrıştığında sessiz hataya yol açardı.
export type DraftLine = PricedLine;
export type DraftOption = PricedOption;

export interface Breakdown {
  subtotal: number;
  discount: number;
  campaign_name: string | null;
  /** Uygulanan kuponun kodu; kupon uygulanmadıysa null. */
  coupon_code: string | null;
  points_used: number;
  delivery_fee: number;
  distance_km: number | null;
  tax: number;
  tax_rate: number;
  tip: number;
  total: number;
}

export interface OrderDraft {
  /** Oturumlu müşteri ya da e-postası tanınan misafir; yeni misafirde null */
  user_id: string | null;
  guest: { full_name: string; phone: string; email: string } | null;
  lines: DraftLine[];
  options: DraftOption[];
  /** orders insert'ine gidecek alanlar. user_id, order_number, ödeme alanları
   *  place-order tarafından ekleniyor. */
  order: Record<string, unknown>;
  breakdown: Breakdown;
}

export type DraftResult =
  | { ok: true; draft: OrderDraft }
  | { ok: false; error: string; status: number };

const fail = (error: string, status = 400): DraftResult => ({ ok: false, error, status });

// Kupon ret sebebinin müşteriye görünen İngilizce karşılığı. Web istemcisi bu
// metni doğrudan gösteriyor; uygulama kendi yerelleştirmesini couponService'te
// yapıyor.
function couponFailureMessage(reason: CouponRejection, minOrder?: number): string {
  switch (reason) {
    case 'not_found':
      return 'That coupon code is not valid.';
    case 'inactive':
      return 'That coupon is no longer available.';
    case 'not_started':
      return 'That coupon is not active yet.';
    case 'expired':
      return 'That coupon has expired.';
    case 'login_required':
      return 'Please sign in to use this coupon.';
    case 'not_yours':
      return 'That coupon belongs to another account.';
    case 'min_order':
      return minOrder != null
        ? `This coupon needs a minimum order of $${minOrder.toFixed(2)}.`
        : 'Your order does not meet this coupon\'s minimum.';
    case 'already_used':
      return 'You have already used this coupon.';
    case 'limit_reached':
      return 'This coupon has reached its usage limit.';
    case 'no_match':
      return 'This coupon does not apply to the items in your cart.';
    default:
      return 'This coupon cannot be applied to your order.';
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((2 * 6371 * Math.asin(Math.sqrt(h))).toFixed(2));
}

export async function buildOrderDraft(
  admin: SupabaseClient,
  body: RequestBody,
  signedInUserId: string | null
): Promise<DraftResult> {
  // ── Girdi doğrulama ────────────────────────────────────────────────────
  const shapeError = validateCartShape(body.items);
  if (shapeError && !shapeError.ok) return fail(shapeError.error, shapeError.status);
  if (body.delivery_method !== 'pickup' && body.delivery_method !== 'delivery') {
    return fail('delivery_method must be pickup or delivery');
  }

  let userId: string | null = signedInUserId;
  let guest: { full_name: string; phone: string; email: string } | null = null;

  if (!userId) {
    const g = body.guest;
    if (!g?.full_name?.trim() || !g?.phone?.trim() || !g?.email?.trim()) {
      return fail('guest full_name, phone and email are required when not signed in');
    }
    guest = {
      full_name: g.full_name.trim(),
      phone: g.phone.trim(),
      email: g.email.trim().toLowerCase(),
    };
  }

  // ── Fiyatlama: ortak modül (cart-pricing.ts) ───────────────────────────
  // Aynı hesap validate-coupon tarafından da kullanılıyor; kupon önizlemesinde
  // görülen ara toplam ile ödemede tahsil edilen ara toplam ayrışamaz.
  const priced = await priceCartLines(admin, body.items);
  if (!priced.ok) return fail(priced.error, priced.status);

  const lines: DraftLine[] = priced.lines;
  const optionById = new Map(priced.options.map((o) => [o.id, o]));
  const subtotal = priced.subtotal;

  // Misafirin e-postası tanınıyorsa mevcut müşteri satırı kullanılır; böylece
  // kampanya geçmişi ve puan bakiyesi doğru okunur. Kullanıcı BURADA
  // AÇILMIYOR — hesap ancak ödeme alındıktan sonra oluşuyor (place-order).
  if (!userId && guest) {
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('email', guest.email)
      .maybeSingle();
    if (existing?.id) userId = existing.id;
  }

  // ── Kampanya: sunucuda seçilir ─────────────────────────────────────────
  // `code` DOLU olan satırlar kupondur ve kendiliğinden uygulanmaz — yalnızca
  // müşteri kodu girdiğinde devreye girer. Bu filtre olmadan her yeni kupon,
  // sepetinde uygun ürün olan HERKESE otomatik indirim olurdu.
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .is('code', null)
    .order('priority', { ascending: true });

  // İlk-sipariş kampanyası ve müşteri başına kullanım limiti için gerçek
  // sipariş geçmişine bakılır; istemcinin "ben ilk siparişimi veriyorum"
  // demesine güvenilmez. Sayım uygulamadakiyle aynı: iptal edilmiş
  // siparişler sayılmıyor (campaignService.ts:125).
  // Hiç kullanıcısı olmayan yeni misafirde geçmiş de yok: previousOrders = 0.
  let history: { campaign_id: string | null; status: string }[] = [];
  if (userId) {
    const { data } = await admin
      .from('orders')
      .select('campaign_id, status')
      .eq('user_id', userId)
      .neq('status', 'cancelled');
    history = data ?? [];
  }

  const previousOrders = history.length;
  const usageByCampaign: Record<string, number> = {};
  for (const row of history) {
    if (row.campaign_id) {
      usageByCampaign[row.campaign_id] = (usageByCampaign[row.campaign_id] ?? 0) + 1;
    }
  }

  const nowMs = Date.now();
  let campaignId: string | null = null;
  let discount = 0;
  let campaignName: string | null = null;
  let chosenPriority = -Infinity;

  for (const c of campaigns ?? []) {
    const startsOk = !c.starts_at || new Date(c.starts_at).getTime() <= nowMs;
    const endsOk = !c.ends_at || new Date(c.ends_at).getTime() >= nowMs;
    if (!startsOk || !endsOk) continue;
    if (subtotal < Number(c.min_order_amount ?? 0)) continue;
    if (c.type === 'first_order' && previousOrders > 0) continue;

    // Müşteri başına kullanım limiti. Uygulamanın isEligible'ı bunu zaten
    // denetliyor (campaignEngine.ts) ama ilk aktarımım atlamıştı: limiti
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

    // Eşitlik kuralı uygulamayla aynı olmalı: aynı tutarda daha YÜKSEK
    // priority kazanır (campaignEngine.computeBestCampaign). Yalnızca
    // "candidate > discount" yazmak, iki kampanya aynı indirimi verdiğinde
    // web'in mobilden FARKLI kampanya adı yazmasına yol açıyordu.
    const better =
      campaignId === null ||
      candidate > discount ||
      (candidate === discount && Number(c.priority ?? 0) > Number(chosenPriority));
    if (candidate > 0 && better) {
      discount = candidate;
      campaignId = c.id;
      campaignName = c.name_en ?? c.name_tr ?? null;
      chosenPriority = Number(c.priority ?? 0);
    }
  }

  // ── Teslimat ücreti: mesafe + ayarlardaki kademeler ────────────────────
  const { data: settings } = await admin
    .from('settings')
    .select('delivery_tier1_max_km, delivery_tier1_fee, delivery_tier2_max_km, delivery_tier2_fee, tax_rate')
    .limit(1)
    .maybeSingle();

  let deliveryFee = 0;
  let distanceKm: number | null = null;
  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;

  if (body.delivery_method === 'delivery') {
    const address = body.address;
    if (!address?.street_number || !address?.street_name || !address?.city || !address?.postal_code) {
      return fail('street number, street name, city and postal code are required for delivery');
    }

    // Koordinat yoksa mesafe bilinemez, mesafe bilinmezse ücret uydurulamaz.
    // Web istemcisi koordinat göndermiyor — adresi BURADA çeviriyoruz. Mobil
    // uygulama koordinatı kendi geocode adımından gönderdiği için o yol
    // olduğu gibi çalışmaya devam ediyor.
    let lat = address.latitude == null ? null : Number(address.latitude);
    let lng = address.longitude == null ? null : Number(address.longitude);

    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      const located = await geocodeAddress(address);
      if (!located) {
        return fail(
          'We could not find that address. Please check the street number, name and postal code.',
          422
        );
      }
      lat = located.lat;
      lng = located.lng;
    }

    resolvedLat = lat;
    resolvedLng = lng;

    const pickup = getRestaurantPickup();
    distanceKm = haversineKm(pickup.lat, pickup.lng, lat, lng);

    const tier1Km = Number(settings?.delivery_tier1_max_km ?? 5);
    const tier1Fee = Number(settings?.delivery_tier1_fee ?? 4.99);
    const tier2Km = Number(settings?.delivery_tier2_max_km ?? 8);
    const tier2Fee = Number(settings?.delivery_tier2_fee ?? 8.99);

    if (distanceKm <= tier1Km) deliveryFee = round2(tier1Fee);
    else if (distanceKm <= tier2Km) deliveryFee = round2(tier2Fee);
    else return fail(`outside our delivery area (${distanceKm} km)`, 422);
  }

  // ── Kupon kodu: müşteri ELLE girer, kampanyayla YARIŞIR ────────────────
  //
  // Üst üste binme yok — sipariş başına tek indirim taşınıyor
  // (orders.campaign_id) ve müşteriye HANGİSİ DAHA İYİYSE o veriliyor.
  // "Teslimat bedava" kuponu ara toplamı değil ücreti düşürdüğü için
  // karşılaştırma toplam kazanç üzerinden yapılır.
  //
  // Sıra önemli: kupon teslimat ücretini sıfırlayabildiği için ücret bu
  // satırdan ÖNCE hesaplanmış olmak zorunda; puan ise indirim sonrası tutarla
  // sınırlı olduğu için SONRA hesaplanıyor.
  let couponCode: string | null = null;
  const requestedCoupon = normalizeCouponCode(body.coupon_code ?? '');

  if (requestedCoupon) {
    const verdict = await validateCoupon(admin, {
      code: requestedCoupon,
      userId,
      lines: lines.map((l) => ({
        product_id: l.product_id,
        category_id: l.category_id,
        unit_price: l.unit_price,
        quantity: l.quantity,
      })),
      subtotal,
      deliveryFee,
      nowMs,
    });

    if (!verdict.ok) {
      // GEÇERSİZ KUPON SİPARİŞİ DURDURUR. Sessizce yutmak, müşterinin
      // "kuponum uygulandı" sanıp beklediğinden fazla ödemesi demek olurdu —
      // HST kaybındaki hatanın aynı sınıfı: istemcinin gösterdiği tutarla
      // tahsil edilen tutar ayrışıyor.
      return fail(couponFailureMessage(verdict.reason, verdict.minOrderAmount), 422);
    }

    const couponValue = verdict.discount + (verdict.waivesDelivery ? deliveryFee : 0);
    if (couponValue > discount) {
      discount = verdict.discount;
      campaignId = verdict.campaign.id;
      campaignName = verdict.campaign.name_en ?? verdict.campaign.name_tr ?? null;
      couponCode = verdict.campaign.code;
      if (verdict.waivesDelivery) deliveryFee = 0;
    }
    // Aktif kampanya kupondan iyiyse kampanya kalır, kupon TÜKETİLMEZ —
    // müşteri onu bir sonraki siparişinde kullanabilir.
  }

  // ── Puan: kullanıcının GERÇEK bakiyesiyle sınırlı ──────────────────────
  let userRow: { points: number | null; phone: string | null; full_name: string | null } | null = null;
  if (userId) {
    const { data } = await admin
      .from('users')
      .select('points, phone, full_name')
      .eq('id', userId)
      .single();
    userRow = data;
  }

  const balance = Math.max(0, Number(userRow?.points ?? 0));
  const requested = Math.max(0, Number(body.points_to_use ?? 0));
  // Puan indirimden SONRAKİ tutarı aşamaz — sepetteki kuralın aynısı
  // (CartScreen:132).
  const pointsUsed = round2(Math.min(requested, balance, Math.max(0, subtotal - discount)));

  // ── Vergi ve toplam ────────────────────────────────────────────────────
  const taxRate = Number(settings?.tax_rate ?? TAX_RATE_FALLBACK);
  const preTax = round2(Math.max(0, subtotal - discount - pointsUsed) + deliveryFee);
  const tax = round2((preTax * taxRate) / 100);
  // Bahşiş vergiye tabi değil (kuryeye gidiyor).
  const tip = round2(Math.max(0, Number(body.tip_amount ?? 0)));
  const total = round2(preTax + tax + tip);

  if (!(total > 0)) return fail('order total is not payable', 422);

  // ── Sipariş satırı (henüz yazılmıyor) ──────────────────────────────────
  const address = body.address;
  const isDelivery = body.delivery_method === 'delivery';
  const deliveryAddressText = isDelivery
    ? [
        `${address!.street_number} ${address!.street_name}`,
        address!.unit_number ? `Unit ${address!.unit_number}` : null,
        address!.city,
        address!.province,
        address!.postal_code,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Pickup';

  const phone = (guest?.phone ?? address?.phone ?? userRow?.phone ?? '').trim();

  return {
    ok: true,
    draft: {
      user_id: userId,
      guest,
      lines,
      options: [...optionById.values()],
      order: {
        status: 'pending',
        total_amount: total,
        delivery_address: deliveryAddressText,
        phone,
        notes: body.notes ?? null,
        points_earned: 0, // trigger hesaplıyor
        points_used: pointsUsed,
        delivery_method: body.delivery_method,
        delivery_full_name: isDelivery ? (address?.full_name ?? userRow?.full_name ?? guest?.full_name ?? null) : null,
        delivery_street: isDelivery ? `${address!.street_number} ${address!.street_name}` : null,
        delivery_unit: isDelivery ? (address?.unit_number ?? null) : null,
        delivery_city: isDelivery ? address!.city : null,
        delivery_province: isDelivery ? address!.province : null,
        delivery_postal_code: isDelivery ? address!.postal_code : null,
        delivery_country: 'CA',
        // Çözümlenen koordinatlar: Uber Direct kuryeyi bunlarla çağırıyor,
        // istemcinin gönderdiği (belki hiç göndermediği) değerle değil.
        delivery_lat: isDelivery ? resolvedLat : null,
        delivery_lng: isDelivery ? resolvedLng : null,
        delivery_instructions: isDelivery ? (address?.delivery_instructions ?? null) : null,
        delivery_fee: deliveryFee,
        tip_amount: tip,
        campaign_id: campaignId,
        discount_amount: discount,
        tax_amount: tax,
      },
      breakdown: {
        subtotal,
        discount,
        campaign_name: campaignName,
        coupon_code: couponCode,
        points_used: pointsUsed,
        delivery_fee: deliveryFee,
        distance_km: distanceKm,
        tax,
        tax_rate: taxRate,
        tip,
        total,
      },
    },
  };
}
