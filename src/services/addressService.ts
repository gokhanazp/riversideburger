import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { Address } from '../types/database.types';

const FUNCTIONS_URL = (Constants.expoConfig?.extra?.supabaseFunctionsUrl as string) ?? '';

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

/**
 * Adresi LocationIQ ile geocode et
 * Geocode an address via LocationIQ (called through geocode-address Edge Function)
 * Returns null when address is not found.
 */
export const geocodeAddress = async (parts: {
  street_number: string;
  street_name: string;
  unit_number?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
}): Promise<GeocodeResult | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const street = `${parts.street_number} ${parts.street_name}`.trim();
  const res = await fetch(`${FUNCTIONS_URL}/geocode-address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      street,
      unit: parts.unit_number,
      city: parts.city,
      province: parts.province,
      postal_code: parts.postal_code,
      country: parts.country || 'CA',
    }),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Geocode failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return { lat: json.lat, lng: json.lng, display_name: json.display_name };
};


/**
 * Kullanıcının tüm adreslerini getir
 * Get all addresses for a user
 */
export const getUserAddresses = async (userId: string): Promise<Address[]> => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching addresses:', error);
    throw error;
  }
};

/**
 * Varsayılan adresi getir
 * Get default address
 */
export const getDefaultAddress = async (userId: string): Promise<Address | null> => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data || null;
  } catch (error) {
    console.error('Error fetching default address:', error);
    return null;
  }
};

/**
 * Tek bir adresi getir
 * Get a single address
 */
export const getAddress = async (addressId: string): Promise<Address | null> => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching address:', error);
    return null;
  }
};

/**
 * Yeni adres ekle
 * Add new address
 */
export const createAddress = async (
  addressData: Omit<Address, 'id' | 'created_at' | 'updated_at'>
): Promise<Address> => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .insert(addressData)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating address:', error);
    throw error;
  }
};

/**
 * Adresi güncelle
 * Update address
 */
export const updateAddress = async (
  addressId: string,
  addressData: Partial<Omit<Address, 'id' | 'created_at' | 'user_id'>>
): Promise<Address> => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .update(addressData)
      .eq('id', addressId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating address:', error);
    throw error;
  }
};

/**
 * Adresi sil
 * Delete address
 */
export const deleteAddress = async (addressId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting address:', error);
    throw error;
  }
};

/**
 * Varsayılan adresi ayarla
 * Set default address
 */
export const setDefaultAddress = async (
  addressId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase.rpc('set_default_address', {
      address_id: addressId,
      user_id_param: userId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error setting default address:', error);
    throw error;
  }
};

