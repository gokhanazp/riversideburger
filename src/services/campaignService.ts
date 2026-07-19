// Kampanya servisi (Campaign service)
// - Aktif kampanyaları getirir
// - Müşteri lehine EN AVANTAJLI tek kampanyayı hesaplar (otomatik uygulama)
// - İndirim motoru saf (pure) fonksiyondur; Supabase'e bağımlı değildir → test edilebilir.

import { supabase } from '../lib/supabase';
import { Campaign } from '../types/database.types';
import {
  CampaignCartLine,
  AppliedCampaign,
  ProductPromo,
  CampaignNudge,
  computeBestCampaign,
  computeNudge,
  getFirstOrderCampaign,
} from './campaignEngine';

export type {
  CampaignCartLine,
  AppliedCampaign,
  CampaignContext,
  ProductPromo,
  ProductLike,
  CampaignNudge,
} from './campaignEngine';
export {
  computeBestCampaign,
  computeDiscount,
  isEligible,
  getProductPromo,
  computeNudge,
  getFirstOrderCampaign,
} from './campaignEngine';

// buy_x_get_y için pazarlama etiketi: grup=al, ödenen=öde → "3 AL 2 ÖDE"
function buyGetLabel(buy: number, free: number, lang: string): string {
  const group = (buy || 1) + (free || 1);
  return lang === 'tr' ? `${group} AL ${buy} ÖDE` : `${group} FOR ${buy}`;
}

// Promosyon rozeti metni (dile göre kısa etiket)
export function formatPromoBadge(promo: ProductPromo, lang: string): string {
  if (promo.kind === 'percentage') {
    const p = promo.percent || 0;
    return lang === 'tr' ? `%${p}` : `${p}%`;
  }
  return buyGetLabel(promo.buyQuantity ?? 1, promo.freeQuantity ?? 1, lang);
}

// Kampanya özeti (ana sayfa şeridi / listeler için kısa açıklama)
export function getCampaignSummary(c: Campaign, lang: string): string {
  if (c.type === 'buy_x_get_y') return buyGetLabel(c.buy_quantity, c.free_quantity, lang);
  const p = c.discount_percent || 0;
  if (c.type === 'first_order') return lang === 'tr' ? `İlk siparişe %${p}` : `${p}% off first order`;
  return lang === 'tr' ? `%${p} indirim` : `${p}% off`;
}

// ---- Supabase erişimi (Data access) ----

export async function getActiveCampaigns(): Promise<Campaign[]> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true);
    if (error) {
      console.warn('getActiveCampaigns error:', error.message);
      return [];
    }
    return (data as Campaign[]) || [];
  } catch (e) {
    console.warn('getActiveCampaigns exception:', e);
    return [];
  }
}

// Admin: tüm kampanyalar
export async function getAllCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Campaign[]) || [];
}

export async function createCampaign(input: Partial<Campaign>): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').insert(input).select().single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(id: string, input: Partial<Campaign>): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

// Müşterinin sipariş geçmişinden ilk-sipariş ve kampanya kullanım bilgisini çıkar.
async function getCustomerOrderContext(
  userId: string | null | undefined
): Promise<{ isFirstOrder: boolean; usageByCampaign: Record<string, number> }> {
  if (!userId) {
    // Giriş yapılmadıysa: ilk sipariş kampanyasını iyimser göster; kullanım boş.
    return { isFirstOrder: true, usageByCampaign: {} };
  }
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('campaign_id, status')
      .eq('user_id', userId);
    if (error || !data) return { isFirstOrder: true, usageByCampaign: {} };

    // İptal edilenler hariç geçerli sipariş sayısı
    const valid = data.filter((o: any) => o.status !== 'cancelled');
    const usageByCampaign: Record<string, number> = {};
    for (const o of data as any[]) {
      if (o.campaign_id) usageByCampaign[o.campaign_id] = (usageByCampaign[o.campaign_id] || 0) + 1;
    }
    return { isFirstOrder: valid.length === 0, usageByCampaign };
  } catch {
    return { isFirstOrder: true, usageByCampaign: {} };
  }
}

// Yüksek seviye: sepet için en avantajlı kampanyayı çöz (fetch + hesap).
export async function resolveBestCampaign(
  userId: string | null | undefined,
  lines: CampaignCartLine[],
  subtotal: number
): Promise<AppliedCampaign | null> {
  if (!lines.length || subtotal <= 0) return null;
  const [campaigns, orderCtx] = await Promise.all([
    getActiveCampaigns(),
    getCustomerOrderContext(userId),
  ]);
  if (!campaigns.length) return null;
  return computeBestCampaign(campaigns, lines, {
    subtotal,
    isFirstOrder: orderCtx.isFirstOrder,
    usageByCampaign: orderCtx.usageByCampaign,
    nowMs: Date.now(),
  });
}

// Sepet için kampanya durumunu tek seferde çöz: uygulanan + teşvik (nudge) + ilk sipariş.
export interface CartCampaignState {
  applied: AppliedCampaign | null;
  nudge: CampaignNudge | null;
  isFirstOrder: boolean;
  firstOrderCampaign: Campaign | null;
}

export async function resolveCartCampaigns(
  userId: string | null | undefined,
  lines: CampaignCartLine[],
  subtotal: number
): Promise<CartCampaignState> {
  const [campaigns, orderCtx] = await Promise.all([
    getActiveCampaigns(),
    getCustomerOrderContext(userId),
  ]);
  const nowMs = Date.now();
  const ctx = {
    subtotal,
    isFirstOrder: orderCtx.isFirstOrder,
    usageByCampaign: orderCtx.usageByCampaign,
    nowMs,
  };
  const hasCart = lines.length > 0 && subtotal > 0;
  return {
    applied: hasCart ? computeBestCampaign(campaigns, lines, ctx) : null,
    nudge: hasCart ? computeNudge(campaigns, lines, ctx) : null,
    isFirstOrder: orderCtx.isFirstOrder,
    firstOrderCampaign: getFirstOrderCampaign(campaigns, nowMs),
  };
}

// Müşteri ilk siparişini mi veriyor? (ana sayfa banner'ı için)
export async function checkIsFirstOrder(userId: string | null | undefined): Promise<boolean> {
  const ctx = await getCustomerOrderContext(userId);
  return ctx.isFirstOrder;
}

// Kampanya adını dile göre getir
export function getCampaignName(c: Campaign, lang: string): string {
  return (lang === 'tr' ? c.name_tr : c.name_en) || c.name_tr || c.name_en;
}
