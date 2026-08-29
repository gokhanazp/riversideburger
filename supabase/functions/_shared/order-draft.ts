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

const TAX_RATE_FALLBACK = 13; // Ontario HST
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 20;

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

export interface DraftLine {
  product_id: string;
  product_name: string;
  category_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  option_ids: string[];
  special_instructions: string | null;
}

export interface DraftOption {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
}

export interface Breakdown {
  subtotal: number;
  discount: number;
  campaign_name: string | null;
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
  if (!Array.isArray(body.items) || body.items.length === 0) return fail('items is required');
  if (body.items.length > MAX_ITEMS) return fail('too many items');
  if (body.delivery_method !== 'pickup' && body.delivery_method !== 'delivery') {
    return fail('delivery_method must be pickup or delivery');
  }
  for (const item of body.items) {
    if (!item.product_id) return fail('each item needs product_id');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY_PER_ITEM) {
      return fail('invalid quantity');
    }
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

  // ── Ürünler ve fiyatlar: DB'den ────────────────────────────────────────
  const productIds = [...new Set(body.items.map((i) => i.product_id))];
  const { data: products, error: productError } = await admin
    .from('products')
    .select('id, name, price, category_id, is_active, stock_status')
    .in('id', productIds);
  if (productError) return fail('could not load products', 500);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p) return fail(`unknown product: ${id}`);
    if (!p.is_active) return fail(`product is not available: ${p.name}`);
    // stock_status'a burada da uyuluyor. Uygulamada bir süre yok sayılmış ve
    // tükenen ürünler sipariş edilebilmişti; sunucu tarafı son savunma.
    if (p.stock_status === 'out_of_stock') return fail(`sold out: ${p.name}`);
  }

  // ── Ek malzeme fiyatları: DB'den ───────────────────────────────────────
  const optionIds = [...new Set(body.items.flatMap((i) => i.option_ids ?? []))];
  const optionById = new Map<string, DraftOption>();
  if (optionIds.length > 0) {
    const { data: options, error: optionError } = await admin
      .from('product_options')
      .select('id, name, name_en, price, is_active')
      .in('id', optionIds);
    if (optionError) return fail('could not load options', 500);
    for (const o of options ?? []) {
      if (!o.is_active) return fail(`option is not available: ${o.name}`);
      optionById.set(o.id, { id: o.id, name: o.name, name_en: o.name_en, price: Number(o.price ?? 0) });
    }
    for (const id of optionIds) {
      if (!optionById.has(id)) return fail(`unknown option: ${id}`);
    }
  }

  // ── Ara toplam ─────────────────────────────────────────────────────────
  // Kalem fiyatı = ürün fiyatı + seçilen ek malzemelerin toplamı.
  // Uygulamadaki davranışla aynı: ekstralar kalem fiyatının İÇİNDE.
  const lines: DraftLine[] = body.items.map((item) => {
    const product = productById.get(item.product_id)!;
    const extras = (item.option_ids ?? []).reduce(
      (sum, id) => sum + Number(optionById.get(id)!.price ?? 0),
      0
    );
    const unitPrice = round2(Number(product.price) + extras);
    return {
      product_id: product.id,
      product_name: product.name,
      category_id: (product.category_id as string | null) ?? null,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal: round2(unitPrice * item.quantity),
      option_ids: item.option_ids ?? [],
      special_instructions: item.special_instructions ?? null,
    };
  });
  const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));

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
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
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
      return fail('address is required for delivery');
    }
    if (address.latitude == null || address.longitude == null) {
      // Koordinat yoksa mesafe bilinemez, mesafe bilinmezse ücret uydurulamaz.
      return fail('address latitude and longitude are required for delivery');
    }
    const pickup = getRestaurantPickup();
    distanceKm = haversineKm(pickup.lat, pickup.lng, Number(address.latitude), Number(address.longitude));

    const tier1Km = Number(settings?.delivery_tier1_max_km ?? 5);
    const tier1Fee = Number(settings?.delivery_tier1_fee ?? 4.99);
    const tier2Km = Number(settings?.delivery_tier2_max_km ?? 8);
    const tier2Fee = Number(settings?.delivery_tier2_fee ?? 8.99);

    if (distanceKm <= tier1Km) deliveryFee = round2(tier1Fee);
    else if (distanceKm <= tier2Km) deliveryFee = round2(tier2Fee);
    else return fail(`outside our delivery area (${distanceKm} km)`, 422);
  }

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
        delivery_lat: isDelivery ? address!.latitude : null,
        delivery_lng: isDelivery ? address!.longitude : null,
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
