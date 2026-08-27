// Order History Screen - Sipariş Geçmişi Ekranı
import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Order } from '../types/database.types';
import { supabase } from '../lib/supabase';
import Toast from 'react-native-toast-message';
import { Colors, Shadows } from '../constants/theme';
import { hasUserReviewedOrder } from '../services/reviewService';
import { formatPrice } from '../services/currencyService';

type FilterType = 'all' | 'active' | 'completed';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivering'];

const OrderHistoryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

      const deliveredOrders = (data || []).filter((o) => o.status === 'delivered');
      const reviewedSet = new Set<string>();

      for (const order of deliveredOrders) {
        const hasReviewed = await hasUserReviewedOrder(order.id);
        if (hasReviewed) reviewedSet.add(order.id);
      }
      setReviewedOrders(reviewedSet);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      Toast.show({
        type: 'error',
        text1: t('orderHistory.error'),
        text2: t('orderHistory.errorMessage'),
        topOffset: 60,
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

  const filteredOrders = useMemo(() => {
    if (filter === 'active') return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    if (filter === 'completed') return orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
    return orders;
  }, [orders, filter]);

  const counts = useMemo(() => ({
    all: orders.length,
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    completed: orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled').length,
  }), [orders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFC107';
      case 'confirmed': return '#2196F3';
      case 'preparing': return '#FF9800';
      case 'ready': return '#4CAF50';
      case 'delivering': return '#9C27B0';
      case 'delivered': return '#28A745';
      case 'cancelled': return '#DC3545';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: t('orderHistory.statusPending'),
      confirmed: t('orderHistory.statusConfirmed'),
      preparing: t('orderHistory.statusPreparing'),
      ready: t('orderHistory.statusReady'),
      delivering: t('orderHistory.statusDelivering'),
      delivered: t('orderHistory.statusDelivered'),
      cancelled: t('orderHistory.statusCancelled'),
    };
    return map[status] ?? status;
  };

  const getStatusIcon = (status: string): any => {
    switch (status) {
      case 'pending': return 'time';
      case 'confirmed': return 'checkmark-circle';
      case 'preparing': return 'restaurant';
      case 'ready': return 'checkmark-done';
      case 'delivering': return 'bicycle';
      case 'delivered': return 'checkmark-done-circle';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return t('orderHistory.justNow') || 'Az önce';
    if (diffMin < 60) return t('orderHistory.minutesAgo', { count: diffMin }) || `${diffMin} dk önce`;
    if (diffHour < 24) return t('orderHistory.hoursAgo', { count: diffHour }) || `${diffHour} sa önce`;
    if (diffDay < 7) return t('orderHistory.daysAgo', { count: diffDay }) || `${diffDay} gün önce`;

    const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const itemCount = item.order_items?.reduce((sum, oi) => sum + oi.quantity, 0) || 0;
    const previewItems = item.order_items?.slice(0, 3) || [];
    const remainingCount = (item.order_items?.length || 0) - previewItems.length;
    const isPickup = (item as any).delivery_method === 'pickup';
    const statusColor = getStatusColor(item.status);
    const canTrack = !['delivered', 'cancelled'].includes(item.status) && !isPickup && (item as any).uber_delivery_id;
    const canReview = item.status === 'delivered' && !reviewedOrders.has(item.id);
    const isReviewed = item.status === 'delivered' && reviewedOrders.has(item.id);

    return (
      <View style={styles.orderCard}>
        {/* Top: order # + date | status pill */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderNumberRow}>
              <View style={styles.orderNumberIcon}>
                <Ionicons name="receipt" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
            </View>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
            <Ionicons name={getStatusIcon(item.status)} size={13} color={statusColor} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        {/* Method badge */}
        <View style={styles.methodRow}>
          <View style={[styles.methodBadge, { backgroundColor: isPickup ? '#FFF3E0' : '#E8F5E9' }]}>
            <Ionicons
              name={isPickup ? 'storefront' : 'bicycle'}
              size={13}
              color={isPickup ? '#E65100' : '#2E7D32'}
            />
            <Text style={[styles.methodBadgeText, { color: isPickup ? '#E65100' : '#2E7D32' }]}>
              {isPickup ? t('cart.deliveryMethodPickup') : t('cart.deliveryMethodDelivery')}
            </Text>
          </View>
          <Text style={styles.itemCountText}>
            {t('orderHistory.products', { count: itemCount })}
          </Text>
        </View>

        {/* Product preview thumbnails */}
        {previewItems.length > 0 && (
          <View style={styles.productsPreview}>
            {previewItems.map((orderItem, idx) => (
              <View key={idx} style={styles.productRow}>
                {orderItem.product?.image_url ? (
                  <Image source={{ uri: orderItem.product.image_url }} style={styles.productThumb} />
                ) : (
                  <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
                    <Ionicons name="fast-food" size={20} color="#CCC" />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {orderItem.product?.name || t('orderHistory.product')}
                  </Text>
                  <Text style={styles.productMeta}>
                    {orderItem.quantity}× · {formatPrice(orderItem.subtotal)}
                  </Text>
                </View>
              </View>
            ))}
            {remainingCount > 0 && (
              <Text style={styles.moreItemsText}>
                +{remainingCount} {t('orderHistory.moreItems') || 'ürün daha'}
              </Text>
            )}
          </View>
        )}

        {/* Footer total + points */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('orderHistory.total')}</Text>
            <Text style={styles.totalPrice}>{formatPrice(item.total_amount)}</Text>
          </View>
          {(item.points_earned > 0 || item.points_used > 0) && (
            <View style={styles.pointsRow}>
              {item.points_earned > 0 && (
                <View style={styles.pointsChip}>
                  <Ionicons name="star" size={12} color="#FFB300" />
                  <Text style={styles.pointsChipText}>
                    {t('orderHistory.pointsEarned', { points: item.points_earned })}
                  </Text>
                </View>
              )}
              {item.points_used > 0 && (
                <View style={[styles.pointsChip, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="gift" size={12} color={Colors.primary} />
                  <Text style={[styles.pointsChipText, { color: Colors.primary }]}>
                    {t('orderHistory.pointsUsed', { points: item.points_used })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action */}
        {canTrack && (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => (navigation as any).navigate('OrderTracking', { orderId: item.id })}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={18} color="#FFF" />
            <Text style={styles.primaryActionText}>{t('tracking.trackOrder')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}

        {canReview && (
          <TouchableOpacity
            style={styles.outlineAction}
            onPress={() => (navigation as any).navigate('ReviewOrder', { orderId: item.id })}
            activeOpacity={0.85}
          >
            <Ionicons name="star-outline" size={18} color={Colors.primary} />
            <Text style={styles.outlineActionText}>{t('orderHistory.reviewOrder')}</Text>
          </TouchableOpacity>
        )}

        {/* Sipariş özeti — tutar dökümü, ek malzemeler ve indirim burada görünür.
            Müşteri siparişin detayına sonradan da bakabilsin. */}
        <TouchableOpacity
          style={styles.outlineAction}
          onPress={() => (navigation as any).navigate('OrderConfirmation', { orderId: item.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
          <Text style={styles.outlineActionText}>{t('orderConfirmation.viewSummary')}</Text>
        </TouchableOpacity>

        {isReviewed && (
          <View style={styles.reviewedRow}>
            <Ionicons name="checkmark-circle" size={16} color="#28A745" />
            <Text style={styles.reviewedText}>{t('orderHistory.reviewed')}</Text>
          </View>
        )}
      </View>
    );
  };

  // Header (always rendered, custom design)
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{t('navigation.orderHistory') || 'Sipariş Geçmişi'}</Text>
        <Text style={styles.headerSubtitle}>
          {orders.length} {t('orderHistory.totalOrders') || 'toplam sipariş'}
        </Text>
      </View>
      <View style={styles.headerBadge}>
        <Ionicons name="time" size={16} color={Colors.primary} />
      </View>
    </View>
  );

  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {(['all', 'active', 'completed'] as FilterType[]).map((key) => {
        const labels: Record<FilterType, string> = {
          all: t('orderHistory.filterAll') || 'Tümü',
          active: t('orderHistory.filterActive') || 'Aktif',
          completed: t('orderHistory.filterCompleted') || 'Tamamlandı',
        };
        const active = filter === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => setFilter(key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
              {labels[key]}
            </Text>
            <View style={[styles.filterCount, active && styles.filterCountActive]}>
              <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                {counts[key]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('orderHistory.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {orders.length > 0 && renderFilterChips()}

      {filteredOrders.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="receipt-outline" size={64} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {orders.length === 0
              ? t('orderHistory.noOrders')
              : t('orderHistory.noOrdersInFilter') || 'Bu filtrede sipariş yok'}
          </Text>
          <Text style={styles.emptyText}>
            {orders.length === 0 ? t('orderHistory.noOrdersMessage') : t('orderHistory.changeFilter') || 'Farklı bir filtre deneyin'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Shadows.small,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontWeight: '500',
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Filter chips
  filterRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5E8',
  },
  filterChipActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
  },
  filterCountTextActive: {
    color: '#FFF',
  },
  // Empty / Loading
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // List
  listContainer: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  // Order Card
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  orderNumberIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginLeft: 34,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // Method row
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemCountText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  // Products
  productsPreview: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  productThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 4,
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  pointsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: '#FFF8E1',
  },
  pointsChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B8860B',
  },
  // Actions
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 14,
    gap: 8,
  },
  primaryActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  outlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginTop: 14,
    gap: 8,
  },
  outlineActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  reviewedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 14,
    gap: 6,
  },
  reviewedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#28A745',
  },
});

export default OrderHistoryScreen;
