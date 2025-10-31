import { supabase } from '../lib/supabase';
import { User } from '../types/database.types';

/**
 * Kullanıcı profilini getir
 * Get user profile
 */
export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

/**
 * Kullanıcı profilini güncelle
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  profileData: {
    full_name?: string;
    phone?: string;
  }
): Promise<User> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Email güncelle
 * Update email
 */
export const updateUserEmail = async (newEmail: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating email:', error);
    throw error;
  }
};

/**
 * Şifre güncelle
 * Update password
 */
export const updateUserPassword = async (newPassword: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

