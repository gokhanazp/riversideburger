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
