// Kampanya indirim motoru (Campaign discount engine) — SAF (pure), bağımlılıksız.
// Supabase/React içermez; kolayca test edilebilir. campaignService bunu kullanır.

import { Campaign } from '../types/database.types';

// Motorun ihtiyaç duyduğu minimal sepet kalemi (Minimal cart line for the engine)
export interface CampaignCartLine {
  product_id: string;
  category_id?: string | null;
  unit_price: number; // birim fiyat, özelleştirmeler dahil (per-unit price incl. customizations)
  quantity: number;
}

export interface CampaignContext {
  subtotal: number; // kampanya öncesi ürün ara toplamı (item subtotal before discount)
  isFirstOrder: boolean;
  usageByCampaign: Record<string, number>; // müşterinin kampanya başına kullanım sayısı
  nowMs: number; // Date.now()
}

export interface AppliedCampaign {
  campaign: Campaign;
  discount: number; // > 0
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Tarih aralığı kontrolü (start <= now <= end; null = sınırsız)
function isWithinDate(c: Campaign, nowMs: number): boolean {
  if (c.starts_at && new Date(c.starts_at).getTime() > nowMs) return false;
  if (c.ends_at && new Date(c.ends_at).getTime() < nowMs) return false;
  return true;
}

// Kampanyanın hedeflediği kalemler (all / category / product)
function eligibleLines(c: Campaign, lines: CampaignCartLine[]): CampaignCartLine[] {
  if (c.target_type === 'all') return lines;
  if (c.target_type === 'category') {
    const set = new Set(c.target_category_ids || []);
    return lines.filter((l) => l.category_id != null && set.has(l.category_id));
  }
  if (c.target_type === 'product') {
    const set = new Set(c.target_product_ids || []);
    return lines.filter((l) => set.has(l.product_id));
  }
  return [];
}

// Hedeflenen kalemlerin toplam tutarı
function eligibleAmount(lines: CampaignCartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
}

// Bir kampanyanın indirim tutarını hesapla (0 => uygulanamaz)
export function computeDiscount(
  c: Campaign,
  lines: CampaignCartLine[],
  subtotal: number
): number {
  const targeted = eligibleLines(c, lines);
  if (targeted.length === 0 && c.target_type !== 'all') return 0;

  if (c.type === 'first_order' || c.type === 'percentage') {
    const percent = Number(c.discount_percent) || 0;
    if (percent <= 0) return 0;
    // first_order her zaman tüm sepete; percentage hedefe göre
    const base = c.type === 'first_order' ? subtotal : eligibleAmount(targeted);
    const discount = (base * percent) / 100;
    return round2(Math.min(discount, base));
  }

  if (c.type === 'buy_x_get_y') {
    const buy = Math.max(0, Math.floor(c.buy_quantity ?? 0));
    const free = Math.max(0, Math.floor(c.free_quantity ?? 0));
    const group = buy + free;
    if (group <= 0 || free <= 0) return 0;

    // Hedeflenen kalemleri birim birim aç (expand into per-unit prices)
    const units: number[] = [];
    for (const l of targeted) {
      for (let i = 0; i < l.quantity; i++) units.push(l.unit_price);
    }
    const completeGroups = Math.floor(units.length / group);
    const freeUnits = completeGroups * free;
    if (freeUnits <= 0) return 0;

    // En ucuz freeUnits adet birim ücretsiz (cheapest units are free)
    units.sort((a, b) => a - b);
    let discount = 0;
    for (let i = 0; i < freeUnits; i++) discount += units[i];
    return round2(discount);
  }

  return 0;
}

// Bir kampanya, hesap dışı koşulları sağlıyor mu? (aktiflik, tarih, min tutar, ilk sipariş, limit)
export function isEligible(c: Campaign, ctx: CampaignContext): boolean {
  if (!c.is_active) return false;
  if (!isWithinDate(c, ctx.nowMs)) return false;
  if (ctx.subtotal < (Number(c.min_order_amount) || 0)) return false;
  if (c.type === 'first_order' && !ctx.isFirstOrder) return false;
  if (c.per_customer_limit != null) {
    const used = ctx.usageByCampaign[c.id] || 0;
    if (used >= c.per_customer_limit) return false;
  }
  return true;
}

// ---- Ürün bazlı gösterim (Product-level display) ----
// Ürün listesi/detayında rozet + indirimli fiyat göstermek için. Bu bilgilendirme
// amaçlıdır; gerçek indirim sepette tek-en-iyi kurala göre uygulanır.
// first_order (sipariş bazlı, koşullu) ve min tutar/limit (sepet/müşteri bazlı) burada
// değerlendirilmez — yalnızca aktiflik + tarih + hedefleme.

export interface ProductLike {
  id: string;
  category_id?: string | null;
  price: number;
}

export interface ProductPromo {
  campaign: Campaign;
  kind: 'percentage' | 'buy_x_get_y';
  percent?: number; // percentage için
  discountedPrice?: number; // percentage için indirimli birim fiyat
  buyQuantity?: number; // buy_x_get_y için
  freeQuantity?: number; // buy_x_get_y için
}

function targetsProduct(c: Campaign, p: ProductLike): boolean {
  if (c.target_type === 'all') return true;
  if (c.target_type === 'category') {
    return p.category_id != null && (c.target_category_ids || []).includes(p.category_id);
  }
  if (c.target_type === 'product') {
    return (c.target_product_ids || []).includes(p.id);
  }
  return false;
}

// Bir ürün için gösterilecek en iyi promosyon (yüzde indirim > X al Y bedava).
export function getProductPromo(
  p: ProductLike,
  campaigns: Campaign[],
  nowMs: number
): ProductPromo | null {
  let best: ProductPromo | null = null;
  for (const c of campaigns) {
    if (!c.is_active) continue;
    if (!isWithinDate(c, nowMs)) continue;
    if (c.type === 'first_order') continue; // sipariş bazlı + koşullu → üründe gösterme
    if (!targetsProduct(c, p)) continue;

    if (c.type === 'percentage') {
      const percent = Number(c.discount_percent) || 0;
      if (percent <= 0) continue;
      // Yüzde indirimler arasında en yükseği tercih et
      if (!best || best.kind !== 'percentage' || (best.percent || 0) < percent) {
        best = {
          campaign: c,
          kind: 'percentage',
          percent,
          discountedPrice: round2(p.price * (1 - percent / 100)),
        };
      }
    } else if (c.type === 'buy_x_get_y') {
      // Yüzde bulunmadıysa yedek olarak göster
      if (!best) {
        best = {
          campaign: c,
          kind: 'buy_x_get_y',
          buyQuantity: c.buy_quantity,
          freeQuantity: c.free_quantity,
        };
      }
    }
  }
  return best;
}

// ---- Sepet teşviki (Cart nudge) ----
// "Eşiğe az kaldı" mesajı için: min tutara ya da bir sonraki bedava ürüne ne kadar kaldığı.
export interface CampaignNudge {
  campaign: Campaign;
  kind: 'amount' | 'items';
  remaining: number; // amount: para birimi; items: adet
}

export function computeNudge(
  campaigns: Campaign[],
  lines: CampaignCartLine[],
  ctx: CampaignContext
): CampaignNudge | null {
  const now = ctx.nowMs;
  let amountNudge: CampaignNudge | null = null;
  let itemsNudge: CampaignNudge | null = null;

  for (const c of campaigns) {
    if (!c.is_active || !isWithinDate(c, now)) continue;
    if (c.type === 'first_order' && !ctx.isFirstOrder) continue;
    if (c.per_customer_limit != null && (ctx.usageByCampaign[c.id] || 0) >= c.per_customer_limit) continue;

    // Minimum sepet tutarı henüz karşılanmadıysa → "X daha ekle"
    const minOrder = Number(c.min_order_amount) || 0;
    if (minOrder > 0 && ctx.subtotal < minOrder) {
      const yields = c.type === 'buy_x_get_y' ? true : (Number(c.discount_percent) || 0) > 0;
      if (yields) {
        const remaining = round2(minOrder - ctx.subtotal);
        if (!amountNudge || remaining < amountNudge.remaining) {
          amountNudge = { campaign: c, kind: 'amount', remaining };
        }
      }
      continue; // min tutar karşılanmadan ürün-nudge anlamsız
    }

    // buy_x_get_y: bir sonraki bedava ürüne kaç ürün kaldı
    if (c.type === 'buy_x_get_y') {
      const buy = Math.max(0, Math.floor(c.buy_quantity ?? 0));
      const free = Math.max(0, Math.floor(c.free_quantity ?? 0));
      const group = buy + free;
      if (group <= 0 || free <= 0) continue;
      const targeted = eligibleLines(c, lines);
      let units = 0;
      for (const l of targeted) units += l.quantity;
      if (units <= 0) continue;
      const rem = units % group;
      if (rem !== 0) {
        const need = group - rem;
        if (!itemsNudge || need < itemsNudge.remaining) {
          itemsNudge = { campaign: c, kind: 'items', remaining: need };
        }
      }
    }
  }

  // Kolay ulaşılır ürün-nudge'ı (<=2) önceliklendir; yoksa tutar-nudge
  if (itemsNudge && itemsNudge.remaining <= 2) return itemsNudge;
  return amountNudge || itemsNudge;
}

// Aktif ilk-sipariş kampanyası (en yüksek yüzde)
export function getFirstOrderCampaign(campaigns: Campaign[], nowMs: number): Campaign | null {
  let best: Campaign | null = null;
  for (const c of campaigns) {
    if (c.type !== 'first_order' || !c.is_active || !isWithinDate(c, nowMs)) continue;
    if (!best || (Number(c.discount_percent) || 0) > (Number(best.discount_percent) || 0)) best = c;
  }
  return best;
}

// EN AVANTAJLI tek kampanyayı seç (highest discount; eşitlikte priority)
export function computeBestCampaign(
  campaigns: Campaign[],
  lines: CampaignCartLine[],
  ctx: CampaignContext
): AppliedCampaign | null {
  let best: AppliedCampaign | null = null;
  for (const c of campaigns) {
    if (!isEligible(c, ctx)) continue;
    const discount = computeDiscount(c, lines, ctx.subtotal);
    if (discount <= 0) continue;
    if (
      !best ||
      discount > best.discount ||
      (discount === best.discount && c.priority > best.campaign.priority)
    ) {
      best = { campaign: c, discount };
    }
  }
  return best;
}
