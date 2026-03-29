// Points Service - Puan sistemi servisi
import { supabase } from '../lib/supabase';
import { PointsHistory, Setting } from '../types/database.types';

/**
 * Kullanıcının toplam puanını getir
 * Get user's total points
 */
export const getUserPoints = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.points || 0;
  } catch (error) {
    console.error('Error fetching user points:', error);
    throw error;
  }
};

/**
 * Kullanıcının puan geçmişini getir
 * Get user's points history
 */
export const getPointsHistory = async (userId: string): Promise<PointsHistory[]> => {
  try {
    const { data, error } = await supabase
      .from('points_history')
      .select(`
        *,
        order:orders(order_number, total_amount, created_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching points history:', error);
    throw error;
  }
};

/**
 * Puan oranı ayarını getir
 * Get points rate setting
 */
export const getPointsRate = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('points_percentage')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return parseFloat(data?.points_percentage) || 5;
  } catch (error) {
    console.warn('Error fetching points rate:', error);
    return 5;
  }
};

/**
 * Minimum sipariş tutarını getir
 * Get minimum order amount for points
 */
export const getMinOrderAmount = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('min_order_amount')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return parseFloat(data?.min_order_amount) || 50;
  } catch (error) {
    console.warn('Error fetching min order amount:', error);
    return 50;
  }
};

/**
 * Tüm ayarları getir
 * Get all settings
 */
export const getAllSettings = async (): Promise<Setting[]> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }
};

/**
 * Ayar güncelle (sadece admin)
 * Update setting (admin only)
 */
export const updateSetting = async (key: string, value: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('settings')
      .update({ value })
      .eq('key', key);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating setting:', error);
    throw error;
  }
};

/**
 * Puan kullan (sipariş verirken)
 * Use points (when placing order)
 */
export const usePoints = async (
  userId: string,
  orderId: string,
  pointsToUse: number
): Promise<void> => {
  try {
    console.log('🔍 Using points:', { userId, orderId, pointsToUse });

    // Önce kullanıcının mevcut puanını al (First get user's current points)
    const { data: userData, error: getUserError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single();

    if (getUserError) {
      console.error('❌ Error getting user points:', getUserError);
      throw getUserError;
    }

    const currentPoints = userData?.points || 0;
    console.log('💰 Current points:', currentPoints);

    // Yeterli puan var mı kontrol et (Check if user has enough points)
    if (currentPoints < pointsToUse) {
      throw new Error('Yetersiz puan bakiyesi');
    }

    // Kullanıcının puanını azalt (Decrease user's points)
    const newPoints = currentPoints - pointsToUse;
    console.log('💰 New points:', newPoints);

    const { error: updateError } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating user points:', updateError);
      throw updateError;
    }

    console.log('✅ User points updated successfully');

    // Puan geçmişine ekle (Add to points history)
    const { error: historyError } = await supabase
      .from('points_history')
      .insert({
        user_id: userId,
        order_id: orderId,
        points: -pointsToUse,
        type: 'used',
        description: `Sipariş için kullanılan puan`,
      });

    if (historyError) {
      console.error('❌ Error adding points history:', historyError);
      throw historyError;
    }

    console.log('✅ Points history added successfully');
  } catch (error) {
    console.error('❌ Error using points:', error);
    throw error;
  }
};

/**
 * Kazanılacak puan miktarını hesapla
 * Calculate points to be earned
 */
export const calculatePointsToEarn = async (orderAmount: number): Promise<number> => {
  try {
    const pointsRate = await getPointsRate();
    const minOrder = await getMinOrderAmount();

    if (orderAmount < minOrder) {
      return 0;
    }

    // Her 100 TL'de pointsRate kadar puan
    // pointsRate points for every 100 TL
    return Math.floor((orderAmount / 100) * pointsRate * 100) / 100;
  } catch (error) {
    console.error('Error calculating points:', error);
    return 0;
  }
};

/**
 * Puan değerini TL'ye çevir (1 puan = 1 TL)
 * Convert points to TL (1 point = 1 TL)
 */
export const pointsToTL = (points: number): number => {
  return points;
};

/**
 * TL'yi puana çevir (1 TL = 1 puan)
 * Convert TL to points (1 TL = 1 point)
 */
export const tlToPoints = (amount: number): number => {
  return amount;
};

