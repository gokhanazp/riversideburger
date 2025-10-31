import { supabase } from '../lib/supabase';
import { Address } from '../types/database.types';

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

