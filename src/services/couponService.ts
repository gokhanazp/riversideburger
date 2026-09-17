// Kupon servisi — kupon kodlarının UYGULAMA tarafındaki yüzü.
//
// ÖNEMLİ: burada hiçbir indirim HESAPLANMIYOR. Kodun geçerliliğine ve
// kazandırdığı tutara sunucu karar veriyor (validate-coupon edge function) ve
// ödeme anında create-payment-intent aynı hesabı yeniden yapıyor. Bu dosya
// yalnızca sunucunun söylediğini taşıyor ve ekranda gösteriyor.
//
// Neden böyle: 27 Ağustos'ta tahsil edilecek tutara uygulama karar veriyordu
// ve HST'si eksik bir paket üç hafta boyunca vergisiz sipariş aldı. Kupon,
// aynı sınıf bir risk taşıyor — indirime istemci karar verirse istismar edilir.

import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { Campaign } from '../types/database.types';

const FUNCTIONS_URL =
  Constants.expoConfig?.extra?.supabaseFunctionsUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ||
  'https://srcslhltajjvteqeptrt.supabase.co/functions/v1';

/** Sunucunun döndürebileceği ret sebepleri (_shared/coupons.ts ile aynı). */
export type CouponRejection =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'login_required'
  | 'not_yours'
  | 'min_order'
  | 'already_used'
  | 'limit_reached'
  | 'no_match'
  | 'no_benefit'
  | 'campaign_better';

export interface AppliedCoupon {
  code: string;
  campaignId: string;
  type: string;
  /** Ara toplamdan düşülecek tutar (sunucu hesabı). */
  discount: number;
  /** true ise teslimat ücreti sıfırlanır. */
  waivesDelivery: boolean;
  nameTr: string | null;
  nameEn: string | null;
}

export type CouponCheck =
  | { valid: true; coupon: AppliedCoupon }
  | { valid: false; reason: CouponRejection; minOrderAmount?: number };

/** Sepetin sunucuya gönderilen biçimi — fiyat YOK, fiyatı sunucu okuyor. */
export interface CouponCartItem {
  product_id: string;
  quantity: number;
  option_ids?: string[];
}

/**
 * Kupon kodunu sunucuda doğrula.
 * Ağ hatası da bir ret sayılıyor ('not_found' değil) — çağıran tarafın
 * "kupon geçersiz" ile "bağlanamadım"ı ayırt edebilmesi için hata fırlatılıyor.
 */
export async function validateCouponCode(params: {
  code: string;
  items: CouponCartItem[];
  deliveryFee?: number;
}): Promise<CouponCheck> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${FUNCTIONS_URL}/validate-coupon`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Oturum zorunlu değil; varsa kişiye atanmış kuponlar da çalışır.
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({
      code: params.code,
      items: params.items,
      delivery_fee: params.deliveryFee ?? 0,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'could not validate coupon');
  }

  if (!data?.valid) {
    return {
      valid: false,
      reason: (data?.reason ?? 'not_found') as CouponRejection,
      minOrderAmount: data?.min_order_amount,
    };
  }

  return {
    valid: true,
    coupon: {
      code: data.code,
      campaignId: data.campaign_id,
      type: data.type,
      discount: Number(data.discount) || 0,
      waivesDelivery: Boolean(data.waives_delivery),
      nameTr: data.name_tr ?? null,
      nameEn: data.name_en ?? null,
    },
  };
}

export interface MyCoupon {
  campaign: Campaign;
  /** Müşterinin bu kuponu kaç kez kullandığı. */
  usedCount: number;
  /** Hakkı bittiyse ya da süresi geçtiyse false. */
  usable: boolean;
}

/**
 * "Kuponlarım" — müşteriye ATANMIŞ kuponlar.
 *
 * Herkese açık kupon kodları burada listelenmez: RLS onları kimseye
 * göstermiyor, çünkü listelenebilir olmaları kodun pazarlama yerine tablo
 * okunarak keşfedilmesi demek olurdu.
 */
export async function getMyCoupons(userId: string): Promise<MyCoupon[]> {
  const nowIso = new Date().toISOString();

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .eq('assigned_user_id', userId)
    .not('code', 'is', null)
    .order('ends_at', { ascending: true, nullsFirst: false });

  if (error) {
    console.warn('getMyCoupons error:', error.message);
    return [];
  }

  const rows = (campaigns ?? []) as Campaign[];
  if (rows.length === 0) return [];

  // Kullanım sayıları defterden — müşteri kendi kayıtlarını okuyabiliyor.
  const { data: redemptions } = await supabase
    .from('coupon_redemptions')
    .select('campaign_id')
    .eq('user_id', userId)
    .in(
      'campaign_id',
      rows.map((c) => c.id)
    );

  const usedByCampaign: Record<string, number> = {};
  for (const r of (redemptions ?? []) as { campaign_id: string }[]) {
    usedByCampaign[r.campaign_id] = (usedByCampaign[r.campaign_id] ?? 0) + 1;
  }

  return rows.map((c) => {
    const usedCount = usedByCampaign[c.id] ?? 0;
    const notExpired = !c.ends_at || c.ends_at >= nowIso;
    const started = !c.starts_at || c.starts_at <= nowIso;
    const underLimit = c.per_customer_limit == null || usedCount < c.per_customer_limit;
    return { campaign: c, usedCount, usable: notExpired && started && underLimit };
  });
}

/** Ret sebebinin i18n anahtarı. */
export function couponRejectionKey(reason: CouponRejection): string {
  return `coupon.error.${reason}`;
}
