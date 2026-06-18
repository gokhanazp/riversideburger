import { supabase } from '../lib/supabase';

// Teslimat ortağı tipi (Delivery partner type)
export interface DeliveryPartner {
  id: string;
  name: string;
  logo_url: string;
  link_url?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const SECTION_ENABLED_KEY = 'home_delivery_partners_enabled';

// Global cache (gereksiz async çağrıları önlemek için)
let cachedPartners: DeliveryPartner[] | null = null;
let cachedSectionEnabled: boolean | null = null;

/**
 * Ana sayfa için aktif teslimat ortaklarını getir (cache'li)
 * (Get active delivery partners for the home screen, cached)
 */
export const getDeliveryPartners = async (): Promise<DeliveryPartner[]> => {
  if (cachedPartners) {
    return cachedPartners;
  }
  try {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw error;
    cachedPartners = data || [];
    return cachedPartners;
  } catch (error) {
    console.error('Error fetching delivery partners:', error);
    return [];
  }
};

/**
 * Bölümün ana sayfada gösterilip gösterilmeyeceği (master on/off, cache'li)
 * (Whether the Delivery Partners section is shown on the home screen)
 */
export const isDeliveryPartnersSectionEnabled = async (): Promise<boolean> => {
  if (cachedSectionEnabled !== null) {
    return cachedSectionEnabled;
  }
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', SECTION_ENABLED_KEY)
      .maybeSingle();
    if (error) throw error;
    // Varsayılan: kayıt yoksa açık (default to enabled when no row exists)
    cachedSectionEnabled = data ? data.setting_value === 'true' : true;
    return cachedSectionEnabled;
  } catch (error) {
    console.error('Error fetching delivery partners section flag:', error);
    return true;
  }
};

/**
 * Admin: tüm ortakları getir (aktif/pasif fark etmeksizin, cache'siz)
 * (Admin: get all partners regardless of active state, no cache)
 */
export const getAllDeliveryPartners = async (): Promise<DeliveryPartner[]> => {
  const { data, error } = await supabase
    .from('delivery_partners')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Admin: yeni ortak ekle (Create a partner)
 */
export const createDeliveryPartner = async (
  partner: Omit<DeliveryPartner, 'id' | 'created_at' | 'updated_at'>
): Promise<void> => {
  const { error } = await supabase.from('delivery_partners').insert(partner);
  if (error) throw error;
  clearDeliveryPartnersCache();
};

/**
 * Admin: ortağı güncelle (Update a partner)
 */
export const updateDeliveryPartner = async (
  id: string,
  partner: Partial<Omit<DeliveryPartner, 'id' | 'created_at' | 'updated_at'>>
): Promise<void> => {
  const { error } = await supabase
    .from('delivery_partners')
    .update({ ...partner, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  clearDeliveryPartnersCache();
};

/**
 * Admin: ortağı sil (Delete a partner)
 */
export const deleteDeliveryPartner = async (id: string): Promise<void> => {
  const { error } = await supabase.from('delivery_partners').delete().eq('id', id);
  if (error) throw error;
  clearDeliveryPartnersCache();
};

/**
 * Admin: bölümü komple aç/kapa (Toggle the whole section on/off)
 */
export const setDeliveryPartnersSectionEnabled = async (enabled: boolean): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert(
    {
      setting_key: SECTION_ENABLED_KEY,
      setting_value: enabled ? 'true' : 'false',
      description: 'Show the Delivery Partners section on the home screen',
    },
    { onConflict: 'setting_key' }
  );
  if (error) throw error;
  clearDeliveryPartnersCache();
};

/**
 * Cache'i temizle (admin değişikliklerinden sonra çağrılmalı)
 * (Clear cache, call after admin updates)
 */
export const clearDeliveryPartnersCache = () => {
  cachedPartners = null;
  cachedSectionEnabled = null;
};
