// Order History Screen - Sipariş Geçmişi Ekranı
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Order } from '../types/database.types';
import { supabase } from '../lib/supabase';
import Toast from 'react-native-toast-message';
import { Colors } from '../constants/theme';
import { hasUserReviewedOrder } from '../services/reviewService';
import { formatPrice } from '../services/currencyService';

const OrderHistoryScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set()); // Değerlendirilmiş siparişler (Reviewed orders)

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            product:products(name, image_url)
          ),
          order_item_customizations(
            *
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      // Teslim edilen siparişler için değerlendirme durumunu kontrol et
      // (Check review status for delivered orders)
      const deliveredOrders = (data || []).filter(o => o.status === 'delivered');
      const reviewedSet = new Set<string>();

      for (const order of deliveredOrders) {
        const hasReviewed = await hasUserReviewedOrder(order.id);
        if (hasReviewed) {
          reviewedSet.add(order.id);
        }
      }

      setReviewedOrders(reviewedSet);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      Toast.show({
        type: 'error',
        text1: t('orderHistory.error'),
        text2: t('orderHistory.errorMessage'),
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  // Sipariş durumu rengi (Order status color)
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFC107';
      case 'confirmed':
        return '#2196F3';
      case 'preparing':
        return '#FF9800';
      case 'ready':
        return '#4CAF50';
      case 'delivering':
        return '#9C27B0';
      case 'delivered':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  // Sipariş durumu metni (Order status text)
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return t('orderHistory.statusPending');
      case 'confirmed':
        return t('orderHistory.statusConfirmed');
      case 'preparing':
        return t('orderHistory.statusPreparing');
      case 'ready':
        return t('orderHistory.statusReady');
      case 'delivering':
        return t('orderHistory.statusDelivering');
      case 'delivered':
        return t('orderHistory.statusDelivered');
      case 'cancelled':
        return t('orderHistory.statusCancelled');
      default:
        return status;
    }
  };

  // Sipariş durumu ikonu (Order status icon)
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'confirmed':
        return 'checkmark-circle-outline';
      case 'preparing':
        return 'restaurant-outline';
      case 'ready':
        return 'checkmark-done-outline';
      case 'delivering':
        return 'bicycle-outline';
      case 'delivered':
        return 'checkmark-done-circle-outline';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const itemCount = item.order_items?.reduce((sum, oi) => sum + oi.quantity, 0) || 0;

    return (
      <View style={styles.orderCard}>
        {/* Üst Kısım - Sipariş Numarası ve Durum (Top - Order Number and Status) */}
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberContainer}>
            <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons
              name={getStatusIcon(item.status) as any}
              size={16}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {/* Tarih Bilgisi (Date Info) */}
        <View style={styles.orderInfo}>
          <Ionicons name="calendar-outline" size={16} color="#999" />
          <Text style={styles.orderInfoText}>
            {new Date(item.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Ürünler Listesi (Products List) */}
        {item.order_items && item.order_items.length > 0 && (
          <View style={styles.productsContainer}>
            <Text style={styles.productsTitle}>{t('orderHistory.products', { count: itemCount })}:</Text>
            {item.order_items.map((orderItem, index) => {
              // Bu ürüne ait özelleştirmeleri bul (Find customizations for this product)
              const allCustomizations = (item as any).order_item_customizations || [];
              const customizations = allCustomizations.filter(
                (c: any) => c.product_id === orderItem.product_id
              );

              return (
                <View key={index} style={styles.productItem}>
                  <View style={styles.productLeft}>
                    <View style={styles.quantityBadge}>
                      <Text style={styles.quantityBadgeText}>{orderItem.quantity}x</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {orderItem.product?.name || t('orderHistory.product')}
                      </Text>
                      {/* Özelleştirmeler (Customizations) */}
                      {customizations.length > 0 && (
                        <View style={styles.customizationsContainer}>
                          {customizations.map((custom: any, idx: number) => (
                            <Text key={idx} style={styles.customizationText}>
                              • {custom.option_name}
                              {custom.option_price > 0 && ` (+${formatPrice(custom.option_price)})`}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.productPrice}>
                    {formatPrice(orderItem.subtotal)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Alt Kısım - Fiyat ve Puan (Bottom - Price and Points) */}
        <View style={styles.orderFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.totalLabel}>{t('orderHistory.total')}</Text>
            <Text style={styles.totalPrice}>{formatPrice(item.total_amount)}</Text>
          </View>
          {item.points_earned > 0 && (
            <View style={styles.pointsEarned}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.pointsEarnedText}>{t('orderHistory.pointsEarned', { points: item.points_earned })}</Text>
            </View>
          )}
          {item.points_used > 0 && (
            <View style={styles.pointsUsed}>
              <Ionicons name="gift-outline" size={16} color={Colors.primary} />
              <Text style={styles.pointsUsedText}>{t('orderHistory.pointsUsed', { points: item.points_used })}</Text>
            </View>
          )}
        </View>

        {/* Değerlendirme Butonu (Review Button) - Sadece teslim edilen siparişler için */}
        {item.status === 'delivered' && !reviewedOrders.has(item.id) && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => (navigation as any).navigate('ReviewOrder', { orderId: item.id })}
          >
            <Ionicons name="star-outline" size={20} color={Colors.primary} />
            <Text style={styles.reviewButtonText}>{t('orderHistory.reviewOrder')}</Text>
          </TouchableOpacity>
        )}

        {/* Değerlendirildi Badge (Reviewed Badge) */}
        {item.status === 'delivered' && reviewedOrders.has(item.id) && (
          <View style={styles.reviewedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
            <Text style={styles.reviewedBadgeText}>{t('orderHistory.reviewed')}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('orderHistory.loading')}</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="receipt-outline" size={80} color="#CCC" />
        <Text style={styles.emptyTitle}>{t('orderHistory.noOrders')}</Text>
        <Text style={styles.emptyText}>
          {t('orderHistory.noOrdersMessage')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  orderInfoText: {
    fontSize: 13,
    color: '#999',
  },
  productsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  productsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  productLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 8,
  },
  customizationsContainer: {
    marginTop: 4,
    paddingLeft: 4,
  },
  customizationText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  quantityBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  quantityBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
  },
  productName: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 12,
    gap: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  pointsEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsEarnedText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  pointsUsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsUsedText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  // Değerlendirme butonu stilleri (Review button styles)
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10', // 10% opacity
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50' + '10', // 10% opacity
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 6,
  },
  reviewedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
});

export default OrderHistoryScreen;

