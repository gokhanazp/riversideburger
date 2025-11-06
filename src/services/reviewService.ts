// Review Service - Değerlendirme ve yorum yönetimi
// Review and rating management service

import { supabase } from '../lib/supabase';
import { Review, ProductRating } from '../types/database.types';

/**
 * Yeni değerlendirme oluştur (Create new review)
 * @param orderId - Sipariş ID (Order ID)
 * @param productId - Ürün ID (Product ID)
 * @param rating - Puan (1-5)
 * @param comment - Yorum metni (Comment text)
 * @param images - Fotoğraf URL'leri (Image URLs)
 */
export async function createReview(
  orderId: string,
  productId: string,
  rating: number,
  comment?: string,
  images?: string[]
): Promise<Review> {
  try {
    // Kullanıcı ID'sini al (Get user ID)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    // Değerlendirme oluştur (Create review)
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        order_id: orderId,
        user_id: user.id,
        product_id: productId,
        rating,
        comment: comment || null,
        images: images || [],
        is_approved: false, // Admin onayı bekliyor (Waiting for admin approval)
        is_rejected: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Review creation error:', error);
      throw new Error('Değerlendirme oluşturulamadı: ' + error.message);
    }

    return data;
  } catch (error: any) {
    console.error('Create review error:', error);
    throw error;
  }
}

/**
 * Kullanıcının kendi değerlendirmelerini getir (Get user's own reviews)
 */
export async function getUserReviews(): Promise<Review[]> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        product:products(id, name, image_url),
        order:orders(id, order_number, created_at)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get user reviews error:', error);
      throw new Error('Değerlendirmeler getirilemedi');
    }

    return data || [];
  } catch (error: any) {
    console.error('Get user reviews error:', error);
    throw error;
  }
}

/**
 * Ürün için onaylanmış değerlendirmeleri getir (Get approved reviews for product)
 * @param productId - Ürün ID (Product ID)
 */
export async function getProductReviews(productId: string): Promise<Review[]> {
  try {
    const { data, error} = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(id, full_name)
      `)
      .eq('product_id', productId)
      .eq('is_approved', true)
      .eq('is_rejected', false)
      .order('created_at', { ascending: false});

    if (error) {
      console.error('Get product reviews error:', error);
      throw new Error('Ürün değerlendirmeleri getirilemedi');
    }

    return data || [];
  } catch (error: any) {
    console.error('Get product reviews error:', error);
    throw error;
  }
}

/**
 * Ürün değerlendirme özetini getir (Get product rating summary)
 * @param productId - Ürün ID (Product ID)
 */
export async function getProductRating(productId: string): Promise<ProductRating | null> {
  try {
    const { data, error } = await supabase
      .from('product_ratings')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error) {
      // Eğer hiç değerlendirme yoksa null dön (Return null if no reviews)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Get product rating error:', error);
      throw new Error('Ürün puanı getirilemedi');
    }

    return data;
  } catch (error: any) {
    console.error('Get product rating error:', error);
    return null;
  }
}

/**
 * Sipariş için değerlendirilebilir ürünleri getir (Get reviewable products for order)
 * @param orderId - Sipariş ID (Order ID)
 */
export async function getReviewableProducts(orderId: string): Promise<any[]> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    // Sipariş detaylarını ve ürünleri getir (Get order details and products)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        order_items(
          product_id,
          product:products(id, name, image_url)
        )
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      throw new Error('Sipariş bulunamadı');
    }

    // Sadece teslim edilen siparişler değerlendirilebilir (Only delivered orders can be reviewed)
    if (order.status !== 'delivered') {
      return [];
    }

    // Zaten değerlendirilmiş ürünleri getir (Get already reviewed products)
    const { data: existingReviews } = await supabase
      .from('reviews')
      .select('product_id')
      .eq('order_id', orderId)
      .eq('user_id', user.id);

    const reviewedProductIds = new Set(existingReviews?.map(r => r.product_id) || []);

    // Henüz değerlendirilmemiş ürünleri filtrele (Filter not yet reviewed products)
    const reviewableProducts = order.order_items
      .filter((item: any) => !reviewedProductIds.has(item.product_id))
      .map((item: any) => ({
        ...item.product,
        order_id: orderId,
      }));

    return reviewableProducts;
  } catch (error: any) {
    console.error('Get reviewable products error:', error);
    throw error;
  }
}

/**
 * Kullanıcının bir siparişi değerlendirip değerlendirmediğini kontrol et
 * (Check if user has reviewed an order)
 * @param orderId - Sipariş ID (Order ID)
 */
export async function hasUserReviewedOrder(orderId: string): Promise<boolean> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return false;
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      console.error('Check review error:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  } catch (error: any) {
    console.error('Check review error:', error);
    return false;
  }
}

/**
 * ADMIN: Bekleyen değerlendirmeleri getir (Get pending reviews)
 */
export async function getPendingReviews(): Promise<Review[]> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(id, full_name, email),
        product:products(id, name, image_url),
        order:orders(id, order_number)
      `)
      .eq('is_approved', false)
      .eq('is_rejected', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Get pending reviews error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Bekleyen değerlendirmeler getirilemedi: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('❌ Get pending reviews catch error:', error);
    throw error;
  }
}

/**
 * ADMIN: Değerlendirmeyi onayla (Approve review)
 * @param reviewId - Değerlendirme ID (Review ID)
 */
export async function approveReview(reviewId: string): Promise<void> {
  try {
    console.log('📝 approveReview called with ID:', reviewId);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ User auth error:', userError);
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    console.log('👤 User ID:', user.id);
    console.log('📤 Sending update to Supabase...');

    const { data, error } = await supabase
      .from('reviews')
      .update({
        is_approved: true,
        is_rejected: false,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select();

    if (error) {
      console.error('❌ Supabase update error:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      throw new Error('Değerlendirme onaylanamadı: ' + error.message);
    }

    console.log('✅ Supabase update successful');
    console.log('✅ Updated data:', data);
  } catch (error: any) {
    console.error('❌ Approve review error:', error);
    throw error;
  }
}

/**
 * ADMIN: Değerlendirmeyi reddet (Reject review)
 * @param reviewId - Değerlendirme ID (Review ID)
 * @param reason - Red nedeni (Rejection reason)
 */
export async function rejectReview(reviewId: string, reason?: string): Promise<void> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const { error } = await supabase
      .from('reviews')
      .update({
        is_approved: false,
        is_rejected: true,
        rejection_reason: reason || null,
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Reject review error:', error);
      throw new Error('Değerlendirme reddedilemedi');
    }
  } catch (error: any) {
    console.error('Reject review error:', error);
    throw error;
  }
}

/**
 * ADMIN: Tüm değerlendirmeleri getir (Get all reviews)
 * @param status - Durum filtresi (Status filter): 'all' | 'pending' | 'approved' | 'rejected'
 */
export async function getAllReviews(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'): Promise<Review[]> {
  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(id, full_name, email),
        product:products(id, name, image_url),
        order:orders(id, order_number)
      `);

    // Durum filtresini uygula (Apply status filter)
    if (status === 'pending') {
      query = query.eq('is_approved', false).eq('is_rejected', false);
    } else if (status === 'approved') {
      query = query.eq('is_approved', true);
    } else if (status === 'rejected') {
      query = query.eq('is_rejected', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Get all reviews error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Değerlendirmeler getirilemedi: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('❌ Get all reviews catch error:', error);
    throw error;
  }
}

/**
 * Restoran hakkında yorum oluştur (Create restaurant review)
 * @param rating - Puan (1-5)
 * @param comment - Yorum metni (Comment text)
 */
export async function createRestaurantReview(
  rating: number,
  comment?: string
): Promise<Review> {
  try {
    // Kullanıcı ID'sini al (Get user ID)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    // Kullanıcının daha önce restoran yorumu yapıp yapmadığını kontrol et
    // (Check if user has already reviewed the restaurant)
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .is('product_id', null)
      .single();

    if (existingReview) {
      throw new Error('Daha önce restoran hakkında yorum yaptınız');
    }

    // Restoran yorumu oluştur (Create restaurant review)
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        product_id: null, // Restoran yorumu için null
        order_id: null, // Restoran yorumu için null
        rating,
        comment: comment || null,
        images: [],
        is_approved: false, // Admin onayı bekliyor (Waiting for admin approval)
        is_rejected: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Restaurant review creation error:', error);
      throw new Error('Restoran yorumu oluşturulamadı: ' + error.message);
    }

    return data;
  } catch (error: any) {
    console.error('Create restaurant review error:', error);
    throw error;
  }
}

/**
 * Onaylanmış restoran yorumlarını getir (Get approved restaurant reviews)
 */
export async function getRestaurantReviews(): Promise<Review[]> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(id, full_name)
      `)
      .is('product_id', null) // Sadece restoran yorumları (Only restaurant reviews)
      .eq('is_approved', true)
      .eq('is_rejected', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get restaurant reviews error:', error);
      throw new Error('Restoran yorumları getirilemedi');
    }

    return data || [];
  } catch (error: any) {
    console.error('Get restaurant reviews error:', error);
    throw error;
  }
}

/**
 * Kullanıcının restoran yorumu olup olmadığını kontrol et
 * (Check if user has restaurant review)
 */
export async function hasUserReviewedRestaurant(): Promise<boolean> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return false;
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .is('product_id', null)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Check restaurant review error:', error);
      return false;
    }

    return !!data;
  } catch (error: any) {
    console.error('Has user reviewed restaurant error:', error);
    return false;
  }
}

