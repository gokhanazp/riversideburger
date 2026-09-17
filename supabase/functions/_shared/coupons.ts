// Kupon doğrulama ve indirim hesabı — SUNUCU TARAFI TEK DOĞRU KAYNAK.
//
// NEDEN SUNUCUDA: 27 Ağustos'taki HST kaybının kökü, `create-payment-intent`in
// tutarı istemciden alıp yalnızca "> 0" diye bakmasıydı. Kupon de aynı sınıf
// bir risk: istemci "bu kupon %100 indirim veriyor" diyebilirdi. O yüzden kod
// çözümlemesi, uygunluk denetimi ve indirim tutarı YALNIZCA burada hesaplanır.
// İstemci tarafı (src/services/couponService.ts) sadece önizleme gösterir.

export interface CouponRow {
  id: string;
  code: string | null;
  name_tr: string | null;
  name_en: string | null;
  description_tr: string | null;
  description_en: string | null;
  type: string;
  discount_percent: number | null;
  discount_amount: number | null;
  buy_quantity: number | null;
  free_quantity: number | null;
  target_type: string | null;
  target_category_ids: string[] | null;
  target_product_ids: string[] | null;
  min_order_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  per_customer_limit: number | null;
  max_redemptions: number | null;
  assigned_user_id: string | null;
  is_active: boolean;
  priority: number | null;
}

export interface CouponLine {
  product_id: string;
  category_id: string | null;
  unit_price: number;
  quantity: number;
}

/** Müşteriye gösterilecek ret sebebi. Uygulama bunları yerelleştirir. */
export type CouponRejection =
  | 'not_found'        // böyle bir kod yok
  | 'inactive'         // admin kapatmış
  | 'not_started'      // tarih aralığı başlamamış
  | 'expired'          // süresi geçmiş
  | 'login_required'   // kişiye atanmış kupon, misafir sipariş
  | 'not_yours'        // başka müşteriye atanmış
  | 'min_order'        // sepet tutarı yetmiyor
  | 'already_used'     // müşteri başına limit dolmuş
  | 'limit_reached'    // toplam kullanım hakkı bitmiş
  | 'no_match'         // sepette kuponun hedeflediği ürün yok
  | 'no_benefit'       // uygulanabilir ama indirim 0 çıkıyor
  | 'campaign_better'; // geçerli, ama aktif kampanya daha çok kazandırıyor

export interface CouponBenefit {
  campaign: CouponRow;
  /** Ara toplamdan düşülecek tutar. */
  discount: number;
  /** true ise teslimat ücreti sıfırlanır (type = 'free_delivery'). */
  waivesDelivery: boolean;
}

export type CouponResult =
  | ({ ok: true } & CouponBenefit)
  | { ok: false; reason: CouponRejection; minOrderAmount?: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Müşteri "  yaz20 " yazdığında "YAZ20" kuponunu bulmalı. */
export function normalizeCouponCode(raw: unknown): string {
  return String(raw ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

/** ilike deseni olarak kullanılacağı için joker karakterler kaçırılmalı;
 *  aksi halde "%" yazan biri rastgele bir kuponu ele geçirebilir. */
function escapeLike(code: string): string {
  return code.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Kuponun hedeflediği sepet kalemleri — campaignEngine.eligibleLines'ın eşi. */
function targetedLines(c: CouponRow, lines: CouponLine[]): CouponLine[] {
  if (c.target_type === 'category') {
    const set = new Set(c.target_category_ids ?? []);
    return lines.filter((l) => l.category_id != null && set.has(l.category_id));
  }
  if (c.target_type === 'product') {
    const set = new Set(c.target_product_ids ?? []);
    return lines.filter((l) => set.has(l.product_id));
  }
  // 'all' ya da tanımsız → tüm sepet
  return lines;
}

/** Hedeflenen kalemleri birim birim aç, en ucuzdan sırala. */
function sortedUnitPrices(lines: CouponLine[]): number[] {
  const units: number[] = [];
  for (const l of lines) {
    for (let i = 0; i < Math.max(0, Math.floor(l.quantity)); i++) units.push(l.unit_price);
  }
  return units.sort((a, b) => a - b);
}

/**
 * Kuponun para değerini hesapla. Uygunluk denetimi YAPMAZ (onu validateCoupon
 * yapar) — yalnızca "bu kupon bu sepete ne kazandırır" sorusunu yanıtlar.
 * Böylece aynı hesap hem doğrulamada hem sipariş oluşturmada kullanılır.
 */
export function computeCouponBenefit(
  c: CouponRow,
  lines: CouponLine[],
  subtotal: number,
  deliveryFee: number
): CouponBenefit {
  const targeted = targetedLines(c, lines);
  const targetedAmount = round2(targeted.reduce((s, l) => s + l.unit_price * l.quantity, 0));
  const none: CouponBenefit = { campaign: c, discount: 0, waivesDelivery: false };

  if (c.type === 'free_delivery') {
    // Teslimat yoksa (gel-al) kupon bir şey kazandırmaz; validateCoupon bunu
    // 'no_benefit' diye reddeder.
    return { campaign: c, discount: 0, waivesDelivery: deliveryFee > 0 };
  }

  if (c.type === 'fixed_amount') {
    const amount = Number(c.discount_amount) || 0;
    if (amount <= 0) return none;
    // Sabit tutar, hedeflenen tutarı AŞAMAZ — aksi halde 20$ kupon 12$'lık
    // sepette negatif toplam üretirdi.
    return { campaign: c, discount: round2(Math.min(amount, targetedAmount)), waivesDelivery: false };
  }

  if (c.type === 'percentage' || c.type === 'first_order') {
    const percent = Number(c.discount_percent) || 0;
    if (percent <= 0) return none;
    // Kupon olarak gelen first_order, percentage gibi davranır: hedefe uygulanır.
    const base = c.target_type === 'all' || c.target_type == null ? subtotal : targetedAmount;
    return { campaign: c, discount: round2(Math.min((base * percent) / 100, base)), waivesDelivery: false };
  }

  if (c.type === 'free_item') {
    // Hedeflenen kalemlerden EN UCUZ free_quantity adedi bedava.
    // (free_quantity boşsa 1 kabul edilir.)
    const freeUnits = Math.max(1, Math.floor(Number(c.free_quantity ?? 1)));
    const units = sortedUnitPrices(targeted);
    if (units.length === 0) return none;
    const take = Math.min(freeUnits, units.length);
    return {
      campaign: c,
      discount: round2(units.slice(0, take).reduce((s, u) => s + u, 0)),
      waivesDelivery: false,
    };
  }

  if (c.type === 'buy_x_get_y') {
    const buy = Math.max(0, Math.floor(Number(c.buy_quantity ?? 0)));
    const free = Math.max(0, Math.floor(Number(c.free_quantity ?? 0)));
    const group = buy + free;
    if (group <= 0 || free <= 0) return none;
    const units = sortedUnitPrices(targeted);
    const freeUnits = Math.floor(units.length / group) * free;
    if (freeUnits <= 0) return none;
    return {
      campaign: c,
      discount: round2(units.slice(0, freeUnits).reduce((s, u) => s + u, 0)),
      waivesDelivery: false,
    };
  }

  return none;
}

/** PostgREST istemcisinin ihtiyaç duyulan asgari yüzü (Deno'da tip için). */
interface AdminClient {
  from(table: string): any;
}

/**
 * Kodu çöz, uygunluğunu denetle, indirimi hesapla.
 *
 * `userId` null olabilir (misafir sipariş): o durumda kişiye atanmış kuponlar ve
 * müşteri başına limit uygulanamaz, bu yüzden atanmış kupon reddedilir.
 */
export async function validateCoupon(
  admin: AdminClient,
  params: {
    code: string;
    userId: string | null;
    lines: CouponLine[];
    subtotal: number;
    deliveryFee: number;
    nowMs?: number;
  }
): Promise<CouponResult> {
  const code = normalizeCouponCode(params.code);
  if (!code) return { ok: false, reason: 'not_found' };

  const nowMs = params.nowMs ?? Date.now();

  // Kod büyük/küçük harf duyarsız aranır (campaigns_code_unique = upper(code)).
  const { data: rows } = await admin
    .from('campaigns')
    .select('*')
    .not('code', 'is', null)
    .ilike('code', escapeLike(code))
    .limit(2);

  const c: CouponRow | undefined = (rows ?? [])[0];
  if (!c) return { ok: false, reason: 'not_found' };

  if (!c.is_active) return { ok: false, reason: 'inactive' };
  if (c.starts_at && new Date(c.starts_at).getTime() > nowMs) return { ok: false, reason: 'not_started' };
  if (c.ends_at && new Date(c.ends_at).getTime() < nowMs) return { ok: false, reason: 'expired' };

  if (c.assigned_user_id) {
    if (!params.userId) return { ok: false, reason: 'login_required' };
    if (c.assigned_user_id !== params.userId) return { ok: false, reason: 'not_yours' };
  }

  const minOrder = Number(c.min_order_amount) || 0;
  if (minOrder > 0 && params.subtotal < minOrder) {
    return { ok: false, reason: 'min_order', minOrderAmount: minOrder };
  }

  // Kullanım sayıları DEFTERDEN okunur, siparişlerden değil: otomatik
  // kampanyalarda kullanım `orders.campaign_id` taranarak sayılıyor ama o
  // sayım iptalleri ve mükerrer ödeme denemelerini ayırt edemiyor.
  if (c.max_redemptions != null) {
    const { count } = await admin
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', c.id);
    if ((count ?? 0) >= Number(c.max_redemptions)) return { ok: false, reason: 'limit_reached' };
  }

  if (params.userId && c.per_customer_limit != null) {
    const { count } = await admin
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', c.id)
      .eq('user_id', params.userId);
    if ((count ?? 0) >= Number(c.per_customer_limit)) return { ok: false, reason: 'already_used' };
  }

  // Hedefleme: sepette kuponun kapsadığı ürün var mı?
  if (c.target_type === 'category' || c.target_type === 'product') {
    if (targetedLines(c, params.lines).length === 0) return { ok: false, reason: 'no_match' };
  }

  const benefit = computeCouponBenefit(c, params.lines, params.subtotal, params.deliveryFee);
  if (benefit.discount <= 0 && !benefit.waivesDelivery) {
    return { ok: false, reason: 'no_benefit' };
  }

  return { ok: true, ...benefit };
}
