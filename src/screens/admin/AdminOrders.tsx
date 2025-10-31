import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { Order, OrderStatus } from '../../types/database.types';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';

// Sipariş durumu renkleri (Order status colors)
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#FFC107',
  confirmed: '#17A2B8',
  preparing: '#FF6B35',
  ready: '#28A745',
  delivering: '#007BFF',
  delivered: '#6C757D',
  cancelled: '#DC3545',
};

// Sipariş durumu isimleri (Order status names)
const STATUS_NAMES: Record<OrderStatus, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  delivering: 'Yolda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
};

// Admin Siparişler Ekranı (Admin Orders Screen)
const AdminOrders = ({ navigation, route }: any) => {
  const filterParam = route?.params?.filter;

  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>(filterParam || 'all');

  // Sayfa yüklendiğinde siparişleri getir (Fetch orders on page load)
  useEffect(() => {
    fetchOrders();
  }, [filterStatus]);

  // Siparişleri getir (Fetch orders)
  const fetchOrders = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('orders')
        .select(`
          *,
          user:users(email, full_name, phone),
          order_items(
            *,
            product:products(name, image_url)
          )
        `)
        .order('created_at', { ascending: false });

      // Filtre uygula (Apply filter)
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Siparişler yüklenirken bir hata oluştu',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Yenileme (Refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Sipariş durumunu güncelle (Update order status)
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: '✅ Durum Güncellendi',
        text2: `Sipariş durumu: ${STATUS_NAMES[newStatus]}`,
      });

      setShowStatusModal(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error updating order status:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Durum güncellenirken bir hata oluştu',
      });
    }
  };

  // Sipariş kartı (Order card)
  const OrderCard = ({ order }: { order: Order }) => {
    const statusColor = STATUS_COLORS[order.status];
    const statusName = STATUS_NAMES[order.status];

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => {
          setSelectedOrder(order);
          setShowDetailsModal(true);
        }}
        activeOpacity={0.7}
      >
        {/* Üst kısım - Sipariş numarası ve durum (Top - Order number and status) */}
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberContainer}>
            <Ionicons name="receipt" size={20} color={Colors.primary} />
            <Text style={styles.orderNumber}>#{order.order_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusName}</Text>
          </View>
        </View>

        {/* Müşteri bilgileri (Customer info) */}
        <View style={styles.customerInfo}>
          <Ionicons name="person" size={16} color="#666" />
          <Text style={styles.customerText}>{order.user?.full_name || order.user?.email || 'Misafir'}</Text>
        </View>

        {/* Adres (Address) */}
        <View style={styles.addressInfo}>
          <Ionicons name="location" size={16} color="#666" />
          <Text style={styles.addressText} numberOfLines={1}>
            {order.delivery_address}
          </Text>
        </View>

        {/* Alt kısım - Tutar ve tarih (Bottom - Amount and date) */}
        <View style={styles.orderFooter}>
          <Text style={styles.orderAmount}>₺{order.total_amount.toFixed(2)}</Text>
          <Text style={styles.orderDate}>
            {new Date(order.created_at).toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Durum değiştir butonu (Change status button) */}
        <TouchableOpacity
          style={styles.changeStatusButton}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedOrder(order);
            setShowStatusModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="create" size={16} color={Colors.primary} />
          <Text style={styles.changeStatusText}>Durum Değiştir</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Filtre butonları (Filter buttons)
  const FilterButton = ({ status, label }: { status: OrderStatus | 'all'; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterStatus === status && styles.filterButtonActive,
        status !== 'all' && { borderColor: STATUS_COLORS[status as OrderStatus] },
      ]}
      onPress={() => setFilterStatus(status)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterButtonText,
          filterStatus === status && styles.filterButtonTextActive,
          filterStatus === status && status !== 'all' && { color: STATUS_COLORS[status as OrderStatus] },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtreler (Filters) */}
      <View style={styles.filtersContainer}>
        <FilterButton status="all" label="Tümü" />
        <FilterButton status="pending" label="Bekliyor" />
        <FilterButton status="confirmed" label="Onaylandı" />
        <FilterButton status="preparing" label="Hazırlanıyor" />
        <FilterButton status="ready" label="Hazır" />
        <FilterButton status="delivering" label="Yolda" />
      </View>

      {/* Sipariş listesi (Orders list) */}
      <FlatList
        data={orders}
        renderItem={({ item }) => <OrderCard order={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Sipariş bulunamadı</Text>
          </View>
        }
      />

      {/* Durum değiştirme modal (Status change modal) */}
      {showStatusModal && selectedOrder && (
        <Modal visible={showStatusModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.statusModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sipariş Durumu Değiştir</Text>
                <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalOrderNumber}>#{selectedOrder.order_number}</Text>

              <View style={styles.statusOptions}>
                {(Object.keys(STATUS_NAMES) as OrderStatus[]).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      { borderColor: STATUS_COLORS[status] },
                      selectedOrder.status === status && styles.statusOptionActive,
                    ]}
                    onPress={() => updateOrderStatus(selectedOrder.id, status)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
                    <Text style={styles.statusOptionText}>{STATUS_NAMES[status]}</Text>
                    {selectedOrder.status === status && (
                      <Ionicons name="checkmark-circle" size={20} color={STATUS_COLORS[status]} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: Colors.white,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  filterButtonTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  orderNumber: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  customerText: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  addressText: {
    fontSize: FontSizes.sm,
    color: '#666',
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  orderAmount: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  orderDate: {
    fontSize: FontSizes.xs,
    color: '#999',
  },
  changeStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary + '10',
  },
  changeStatusText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: '#999',
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statusModal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOrderNumber: {
    fontSize: FontSizes.md,
    color: '#666',
    marginBottom: Spacing.lg,
  },
  statusOptions: {
    gap: Spacing.sm,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    backgroundColor: Colors.white,
  },
  statusOptionActive: {
    backgroundColor: '#F8F9FA',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusOptionText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: '#333',
  },
});

export default AdminOrders;

