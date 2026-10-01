// Ekstra satış ("Goes well with") — sepete göre öneri.
// Mantık sunucuda (upsell_suggestions): önce sepettekilerin eşleri, sonra
// admin'in işaretlediği genel havuz; sepettekiler ve stokta olmayanlar elenir.
import { supabase } from '../lib/supabase';
import { MenuItem } from '../types';

export interface UpsellSuggestion {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  has_options: boolean;
  source: 'pairing' | 'pool';
}

export async function getUpsellSuggestions(productIds: string[], limit = 3): Promise<UpsellSuggestion[]> {
  const { data, error } = await supabase.rpc('upsell_suggestions', { p_product_ids: productIds, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as UpsellSuggestion[]).map((r) => ({ ...r, price: Number(r.price) }));
}

/** Öneriyi sepetin beklediği MenuItem biçimine çevirir. */
export const suggestionToMenuItem = (s: UpsellSuggestion): MenuItem => ({
  id: s.id,
  name: s.name,
  description: s.description ?? '',
  price: s.price,
  category: 'burger',
  category_id: s.category_id ?? undefined,
  image: s.image_url ?? '',
  available: true,
});
