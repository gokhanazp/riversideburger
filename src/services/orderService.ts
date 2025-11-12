import { supabase } from '../lib/supabase';
import { Order, OrderItem, OrderStatus } from '../types/database.types';
import { usePoints } from './pointsService';

// Sipariş numarası oluştur (Generate order number)
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
};

// Sipariş oluştur (Create order)
interface CreateOrderParams {
  user_id: string;
  total_amount: number;
  delivery_address: string;
  phone: string;
  notes?: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
    subtotal: number;
    customizations?: Array<{
      option_id: string;
      option_name: string;
      option_price: number;
    }>;
    specialInstructions?: string;
  }[];
  points_used?: number;
  address_id?: string;
}

export const createOrder = async (params: CreateOrderParams): Promise<Order> => {
  try {
    const { user_id, total_amount, delivery_address, phone, notes, items, points_used = 0, address_id } = params;

    // Sipariş oluştur (Create order)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id,
        order_number: generateOrderNumber(),
        status: 'pending',
        total_amount,
        delivery_address,
        phone,
        notes,
        points_earned: 0, // Trigger otomatik hesaplayacak (Trigger will calculate automatically)
        points_used: points_used || 0,
        address_id: address_id || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Sipariş kalemlerini ekle (Add order items)
    const orderItems = items.map(item => ({
      order_id: orderData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Özelleştirmeleri kaydet (Save customizations)
    for (const item of items) {
      if (item.customizations && item.customizations.length > 0) {
        // Sadece gerçek UUID'leri kaydet (dinamik "ingredient-X" ID'lerini filtrele)
        // Only save real UUIDs (filter out dynamic "ingredient-X" IDs)
        const validCustomizations = item.customizations.filter(custom => {
          // UUID formatını kontrol et (36 karakter, tire içerir)
          // Check UUID format (36 characters, contains dashes)
          const isValidUUID = custom.option_id.length === 36 && custom.option_id.includes('-') && !custom.option_id.startsWith('ingredient-');
          return isValidUUID;
        });

        if (validCustomizations.length > 0) {
          const customizationsData = validCustomizations.map(custom => ({
            order_id: orderData.id,
            product_id: item.product_id,
            product_name: item.product_name,
            option_id: custom.option_id,
            option_name: custom.option_name,
            option_price: custom.option_price,
            quantity: item.quantity,
            special_instructions: item.specialInstructions || null,
          }));

          const { error: customError } = await supabase
            .from('order_item_customizations')
            .insert(customizationsData);

          if (customError) {
            console.error('Error saving customizations:', customError);
            // Özelleştirme hatası siparişi iptal etmez, sadece log'lanır
            // (Customization error doesn't cancel order, just logged)
          }
        }

        // Dinamik özelleştirmeleri (çıkarılan malzemeler) ayrı kaydet
        // Save dynamic customizations (removed ingredients) separately
        const dynamicCustomizations = item.customizations.filter(custom =>
          custom.option_id.startsWith('ingredient-')
        );

        if (dynamicCustomizations.length > 0) {
          const dynamicData = dynamicCustomizations.map(custom => ({
            order_id: orderData.id,
            product_id: item.product_id,
            product_name: item.product_name,
            option_id: null, // Dinamik seçenekler için option_id null
            option_name: custom.option_name,
            option_price: custom.option_price,
            quantity: item.quantity,
            special_instructions: item.specialInstructions || null,
          }));

          const { error: dynamicError } = await supabase
            .from('order_item_customizations')
            .insert(dynamicData);

          if (dynamicError) {
            console.error('Error saving dynamic customizations:', dynamicError);
          }
        }
      }
    }

    // Eğer puan kullanıldıysa, kullanıcının puanını azalt (If points used, decrease user's points)
    if (points_used > 0) {
      await usePoints(user_id, orderData.id, points_used);
    }

    // Admin kullanıcılarına push notification gönder (Send push notification to admins)
    try {
      // Müşteri bilgilerini al (Get customer info)
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user_id)
        .single();

      const customerName = userData?.full_name || 'Müşteri';

      // Push notification gönder (Send push notification)
      const { sendPushNotificationToAdmins } = await import('./notificationService');
      await sendPushNotificationToAdmins(
        '🔔 Yeni Sipariş!',
        `${customerName} - ₺${total_amount.toFixed(2)}`,
        {
          orderId: orderData.id,
          orderNumber: orderData.order_number,
          type: 'new_order_admin',
        }
      );

      console.log('✅ Admin push notification gönderildi');
    } catch (notifError) {
      // Bildirim hatası siparişi etkilemez (Notification error doesn't affect order)
      console.error('⚠️ Admin bildirim hatası:', notifError);
    }

    return orderData;
  } catch (error: any) {
    console.error('Create order error:', error);
    throw error;
  }
};

// Kullanıcının siparişlerini getir (Get user orders)
export const getUserOrders = async (userId: string): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Get user orders error:', error);
    throw error;
  }
};

// Tek sipariş getir (Get single order)
export const getOrder = async (orderId: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:users (*),
        order_items (
          *,
          product:products (*)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Get order error:', error);
    return null;
  }
};

// Tüm siparişleri getir (Get all orders) - ADMIN
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:users (*),
        order_items (
          *,
          product:products (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Get all orders error:', error);
    throw error;
  }
};

// Aktif siparişleri getir (Get active orders) - ADMIN
export const getActiveOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:users (*),
        order_items (
          *,
          product:products (*)
        )
      `)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Get active orders error:', error);
    throw error;
  }
};

// Sipariş durumunu güncelle (Update order status) - ADMIN
export const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<Order> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', orderId)
      .select(`
        *,
        user:users (*),
        order_items (
          *,
          product:products (*)
        )
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Update order status error:', error);
    throw error;
  }
};

// Sipariş iptal et (Cancel order)
export const cancelOrder = async (orderId: string): Promise<Order> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Cancel order error:', error);
    throw error;
  }
};

// Sipariş durumunu dinle (Subscribe to order status) - Real-time
export const subscribeToOrder = (
  orderId: string,
  callback: (order: Order) => void
) => {
  return supabase
    .channel(`order:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      async (payload) => {
        // Güncellenmiş siparişi getir (Get updated order)
        const order = await getOrder(orderId);
        if (order) callback(order);
      }
    )
    .subscribe();
};

// Yeni siparişleri dinle (Subscribe to new orders) - ADMIN - Real-time
export const subscribeToNewOrders = (callback: (order: Order) => void) => {
  return supabase
    .channel('new-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      },
      async (payload) => {
        // Yeni siparişi getir (Get new order)
        const order = await getOrder(payload.new.id);
        if (order) callback(order);
      }
    )
    .subscribe();
};

// Bugünkü istatistikleri getir (Get today's statistics) - ADMIN
export const getTodayStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Bugünkü siparişler (Today's orders)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', todayISO);

    if (ordersError) throw ordersError;

    // İstatistikleri hesapla (Calculate statistics)
    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
    const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;
    const activeOrders = orders?.filter(o => 
      ['pending', 'confirmed', 'preparing', 'ready', 'delivering'].includes(o.status)
    ).length || 0;

    return {
      totalOrders,
      totalRevenue,
      completedOrders,
      activeOrders,
      successRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
    };
  } catch (error: any) {
    console.error('Get today stats error:', error);
    throw error;
  }
};

