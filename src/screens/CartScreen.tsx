import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { CartItem } from '../types';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../components/ConfirmModal';
import { createOrder } from '../services/orderService';
import { getUserPoints, pointsToTL } from '../services/pointsService';
import { getDefaultAddress, getUserAddresses } from '../services/addressService';
import { Address } from '../types/database.types';

// Sepet ekranı (Cart screen)
const CartScreen = ({ navigation }: any) => {
  const { items, updateQuantity, removeItem, getTotalPrice, clearCart } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();

  // Modal state'leri (Modal states)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Puan state'leri (Points states)
  const [userPoints, setUserPoints] = useState<number>(0);
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [pointsInputValue, setPointsInputValue] = useState<string>('');

  // Adres state'leri (Address states)
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [userAddresses, setUserAddresses] = useState<Address[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Kullanıcı puanlarını ve adresini yükle (Load user points and address)
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserPoints();
      loadUserAddress();
    }
  }, [isAuthenticated, user]);

  const loadUserPoints = async () => {
    if (!user) return;
    try {
      console.log('🔍 Loading points for user:', user.id);
      const points = await getUserPoints(user.id);
      console.log('✅ User points loaded:', points);
      setUserPoints(points);
    } catch (error) {
      console.error('❌ Error loading points:', error);
    }
  };

  // Kullanıcı adresini yükle (Load user address)
  const loadUserAddress = async () => {
    if (!user) return;
    try {
      setIsLoadingAddress(true);
      console.log('🔍 Loading address for user:', user.id);

      // Varsayılan adresi al (Get default address)
      const defaultAddr = await getDefaultAddress(user.id);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr);
        console.log('✅ Default address loaded:', defaultAddr);
      } else {
        console.log('⚠️ No default address found');
      }

      // Tüm adresleri al (Get all addresses)
      const addresses = await getUserAddresses(user.id);
      setUserAddresses(addresses);
      console.log('✅ User addresses loaded:', addresses.length);
    } catch (error) {
      console.error('❌ Error loading address:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // Puan kullanma miktarını ayarla (Set points to use)
  const handlePointsChange = (value: string) => {
    setPointsInputValue(value);
    const numValue = parseFloat(value) || 0;

    // Maksimum kullanılabilir puan: Kullanıcının puanı ve sepet toplamının küçük olanı
    const maxPoints = Math.min(userPoints, getTotalPrice());

    if (numValue > maxPoints) {
      setPointsToUse(maxPoints);
      setPointsInputValue(maxPoints.toFixed(2));
      Toast.show({
        type: 'info',
        text1: 'Maksimum Puan',
        text2: `En fazla ${maxPoints.toFixed(2)} puan kullanabilirsiniz`,
      });
    } else if (numValue < 0) {
      setPointsToUse(0);
      setPointsInputValue('0');
    } else {
      setPointsToUse(numValue);
    }
  };

  // Tüm puanları kullan (Use all points)
  const handleUseAllPoints = () => {
    const maxPoints = Math.min(userPoints, getTotalPrice());
    setPointsToUse(maxPoints);
    setPointsInputValue(maxPoints.toFixed(2));
  };

  // Puanları temizle (Clear points)
  const handleClearPoints = () => {
    setPointsToUse(0);
    setPointsInputValue('');
  };

  // İndirimli toplam fiyat (Discounted total price)
  const getFinalPrice = () => {
    return Math.max(0, getTotalPrice() - pointsToUse);
  };

  // Sipariş onaylama işlevi (Order confirmation handler)
  const handleCheckout = () => {
    if (items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Sepet Boş',
        text2: 'Lütfen sepete ürün ekleyin',
      });
      return;
    }

    // Giriş kontrolü (Check if user is authenticated)
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    // Adres kontrolü (Check if address is selected)
    if (!selectedAddress) {
      Toast.show({
        type: 'error',
        text1: 'Adres Seçilmedi',
        text2: 'Lütfen teslimat adresi seçin veya ekleyin',
      });
      return;
    }

    // Sipariş onay modal'ını göster (Show checkout confirmation modal)
    setShowCheckoutModal(true);
  };

  // Giriş modal onayı (Login modal confirm)
  const handleLoginConfirm = () => {
    setShowLoginModal(false);
    navigation.navigate('Login');
  };

  // Sipariş onayı (Checkout confirm)
  const handleCheckoutConfirm = async () => {
    if (!user) return;

    try {
      setIsCreatingOrder(true);
      setShowCheckoutModal(false);

      // Sipariş verilerini hazırla (Prepare order data)
      const orderItems = items.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
      }));

      // Adres bilgisini hazırla (Prepare address info)
      const fullAddress = selectedAddress
        ? `${selectedAddress.street_number} ${selectedAddress.street_name}${
            selectedAddress.unit_number ? `, ${selectedAddress.unit_number}` : ''
          }, ${selectedAddress.city}, ${selectedAddress.province} ${selectedAddress.postal_code}`
        : 'Adres belirtilmedi';

      // Siparişi oluştur (Create order)
      const order = await createOrder({
        user_id: user.id,
        total_amount: getFinalPrice(), // İndirimli fiyat (Discounted price)
        delivery_address: fullAddress,
        phone: selectedAddress?.phone || user.phone || 'Telefon belirtilmedi',
        notes: pointsToUse > 0 ? `${pointsToUse.toFixed(2)} puan kullanıldı` : '',
        items: orderItems,
        points_used: pointsToUse,
        address_id: selectedAddress?.id,
      });

      // Sepeti ve puanları temizle (Clear cart and points)
      clearCart();
      handleClearPoints();

      // Puanları yeniden yükle (Reload points)
      await loadUserPoints();

      Toast.show({
        type: 'success',
        text1: '🎉 Sipariş Alındı!',
        text2: `Sipariş numaranız: #${order.order_number}`,
        visibilityTime: 4000,
      });

      // Sipariş geçmişine yönlendir (Navigate to order history)
      setTimeout(() => {
        navigation.navigate('OrderHistory');
      }, 1500);

    } catch (error: any) {
      console.error('Error creating order:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Sipariş Oluşturulamadı',
        text2: error.message || 'Bir hata oluştu, lütfen tekrar deneyin',
      });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Ürün silme onayı (Item removal confirmation)
  const handleRemoveItem = (itemId: string, itemName: string) => {
    setItemToDelete({ id: itemId, name: itemName });
    setShowDeleteModal(true);
  };

  // Silme onayı (Delete confirm)
  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      removeItem(itemToDelete.id);
      Toast.show({
        type: 'success',
        text1: '🗑️ Ürün Silindi',
        text2: `${itemToDelete.name} sepetten çıkarıldı`,
      });
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  // Sepet öğesi kartı componenti (Cart item card component)
  const CartItemCard = ({ item }: { item: CartItem }) => (
    <View style={styles.cartCard}>
      <Image source={{ uri: item.image }} style={styles.cartImage} />
      <View style={styles.cartInfo}>
        <Text style={styles.cartName}>{item.name}</Text>
        <Text style={styles.cartPrice}>₺{item.price.toFixed(2)}</Text>
        <View style={styles.quantityContainer}>
          {/* Azalt butonu (Decrease button) */}
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          {/* Artır butonu (Increase button) */}
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Sil butonu (Delete button) */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleRemoveItem(item.id, item.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  // Boş sepet görünümü (Empty cart view)
  const EmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🛒</Text>
      <Text style={styles.emptyTitle}>Sepetiniz Boş</Text>
      <Text style={styles.emptySubtitle}>Menüden ürün ekleyerek başlayın</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          {/* Sepet listesi (Cart list) */}
          <FlatList
            data={items}
            renderItem={({ item }) => <CartItemCard item={item} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
          />

          {/* Alt özet ve ödeme bölümü (Bottom summary and checkout section) */}
          <View style={styles.footer}>
            {/* Adres Seçimi Bölümü (Address Selection Section) */}
            {isAuthenticated && (
              <View style={styles.addressSection}>
                <View style={styles.addressHeader}>
                  <Ionicons name="location" size={20} color={Colors.primary} />
                  <Text style={styles.addressHeaderText}>Teslimat Adresi</Text>
                </View>

                {isLoadingAddress ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
                ) : selectedAddress ? (
                  <TouchableOpacity
                    style={styles.selectedAddressCard}
                    onPress={() => setShowAddressModal(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressCardContent}>
                      <View style={styles.addressCardLeft}>
                        <Text style={styles.addressTitle}>{selectedAddress.title}</Text>
                        <Text style={styles.addressName}>{selectedAddress.full_name}</Text>
                        <Text style={styles.addressText}>
                          {selectedAddress.street_number} {selectedAddress.street_name}
                          {selectedAddress.unit_number ? `, ${selectedAddress.unit_number}` : ''}
                        </Text>
                        <Text style={styles.addressText}>
                          {selectedAddress.city}, {selectedAddress.province} {selectedAddress.postal_code}
                        </Text>
                        <Text style={styles.addressPhone}>{selectedAddress.phone}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#999" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.addAddressButton}
                    onPress={() => navigation.navigate('AddressList')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                    <Text style={styles.addAddressText}>Adres Ekle</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ara Toplam:</Text>
              <Text style={styles.summaryValue}>₺{getTotalPrice().toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Servis Ücreti:</Text>
              <Text style={styles.summaryValue}>₺0.00</Text>
            </View>

            {/* Puan Kullanma Bölümü (Points Usage Section) */}
            {isAuthenticated && (
              <View style={styles.pointsSection}>
                <View style={styles.pointsHeader}>
                  <View style={styles.pointsHeaderLeft}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                    <Text style={styles.pointsHeaderText}>
                      Puanlarınız: {userPoints.toFixed(2)}
                    </Text>
                  </View>
                  {pointsToUse > 0 && (
                    <TouchableOpacity onPress={handleClearPoints}>
                      <Text style={styles.clearPointsText}>Temizle</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {userPoints > 0 ? (
                  <>
                    <View style={styles.pointsInputContainer}>
                      <TextInput
                        style={styles.pointsInput}
                        placeholder="Kullanmak istediğiniz puan"
                        keyboardType="decimal-pad"
                        value={pointsInputValue}
                        onChangeText={handlePointsChange}
                      />
                      <TouchableOpacity
                        style={styles.useAllButton}
                        onPress={handleUseAllPoints}
                      >
                        <Text style={styles.useAllButtonText}>Tümünü Kullan</Text>
                      </TouchableOpacity>
                    </View>

                    {pointsToUse > 0 && (
                      <View style={styles.pointsDiscountRow}>
                        <Text style={styles.pointsDiscountLabel}>Puan İndirimi:</Text>
                        <Text style={styles.pointsDiscountValue}>-₺{pointsToUse.toFixed(2)}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.noPointsText}>
                    Henüz puanınız yok. Sipariş vererek puan kazanabilirsiniz! 🎁
                  </Text>
                )}
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Toplam:</Text>
              <View style={styles.totalPriceContainer}>
                {pointsToUse > 0 && (
                  <Text style={styles.originalPrice}>₺{getTotalPrice().toFixed(2)}</Text>
                )}
                <Text style={styles.totalValue}>₺{getFinalPrice().toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={handleCheckout}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutButtonText}>Siparişi Onayla</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Giriş gerekli modal (Login required modal) */}
      <ConfirmModal
        visible={showLoginModal}
        title="Giriş Gerekli"
        message="Sipariş vermek için giriş yapmanız gerekiyor."
        confirmText="Giriş Yap"
        cancelText="İptal"
        onConfirm={handleLoginConfirm}
        onCancel={() => setShowLoginModal(false)}
        type="default"
      />

      {/* Sipariş onay modal (Checkout confirmation modal) */}
      <ConfirmModal
        visible={showCheckoutModal}
        title="Sipariş Onayı"
        message={
          pointsToUse > 0
            ? `Ara Toplam: ₺${getTotalPrice().toFixed(2)}\nPuan İndirimi: -₺${pointsToUse.toFixed(2)}\n\nÖdenecek Tutar: ₺${getFinalPrice().toFixed(2)}\n\nSiparişinizi onaylıyor musunuz?`
            : `Toplam: ₺${getTotalPrice().toFixed(2)}\n\nSiparişinizi onaylıyor musunuz?`
        }
        confirmText="Onayla"
        cancelText="İptal"
        onConfirm={handleCheckoutConfirm}
        onCancel={() => setShowCheckoutModal(false)}
        type="success"
      />

      {/* Ürün silme modal (Delete item modal) */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Ürünü Sil"
        message={`${itemToDelete?.name || 'Bu ürün'} sepetten çıkarılsın mı?`}
        confirmText="Sil"
        cancelText="İptal"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        type="danger"
      />

      {/* Adres seçme modal (Address selection modal) */}
      {showAddressModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.addressModal}>
            <View style={styles.addressModalHeader}>
              <Text style={styles.addressModalTitle}>Teslimat Adresi Seçin</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={userAddresses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.addressModalItem,
                    selectedAddress?.id === item.id && styles.addressModalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedAddress(item);
                    setShowAddressModal(false);
                    Toast.show({
                      type: 'success',
                      text1: '✅ Adres Seçildi',
                      text2: item.title,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressModalItemContent}>
                    <View style={styles.addressModalItemLeft}>
                      <Text style={styles.addressModalItemTitle}>{item.title}</Text>
                      <Text style={styles.addressModalItemName}>{item.full_name}</Text>
                      <Text style={styles.addressModalItemText}>
                        {item.street_number} {item.street_name}
                        {item.unit_number ? `, ${item.unit_number}` : ''}
                      </Text>
                      <Text style={styles.addressModalItemText}>
                        {item.city}, {item.province} {item.postal_code}
                      </Text>
                    </View>
                    {selectedAddress?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyAddressList}>
                  <Ionicons name="location-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyAddressText}>Henüz adres eklenmemiş</Text>
                </View>
              }
              style={styles.addressModalList}
            />

            <TouchableOpacity
              style={styles.addNewAddressButton}
              onPress={() => {
                setShowAddressModal(false);
                navigation.navigate('AddressList');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addNewAddressText}>Yeni Adres Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading overlay (Sipariş oluşturulurken) */}
      {isCreatingOrder && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Siparişiniz oluşturuluyor...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cartList: {
    padding: Spacing.md,
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  cartImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  cartInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'space-between',
  },
  cartName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cartPrice: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  quantityText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginHorizontal: Spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  deleteButtonText: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.large,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  totalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  totalPriceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: FontSizes.sm,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  pointsSection: {
    backgroundColor: '#FFF9E6',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  pointsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsHeaderText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#333',
  },
  clearPointsText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  noPointsText: {
    fontSize: FontSizes.sm,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pointsInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pointsInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSizes.md,
  },
  useAllButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
  },
  useAllButtonText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  pointsDiscountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
  },
  pointsDiscountLabel: {
    fontSize: FontSizes.md,
    color: '#666',
    fontWeight: '600',
  },
  pointsDiscountValue: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: '#E63946',
  },
  checkoutButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  checkoutButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.large,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '600',
  },
  // Adres bölümü stilleri (Address section styles)
  addressSection: {
    backgroundColor: '#F0F8FF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  addressHeaderText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#333',
  },
  selectedAddressCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  addressCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressCardLeft: {
    flex: 1,
  },
  addressTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  addressName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  addressText: {
    fontSize: FontSizes.sm,
    color: '#666',
    marginBottom: 1,
  },
  addressPhone: {
    fontSize: FontSizes.sm,
    color: '#666',
    marginTop: 2,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addAddressText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  // Adres modal stilleri (Address modal styles)
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  addressModal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxHeight: '80%',
    ...Shadows.large,
  },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  addressModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
  },
  addressModalList: {
    maxHeight: 400,
  },
  addressModalItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  addressModalItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  addressModalItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressModalItemLeft: {
    flex: 1,
  },
  addressModalItemTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  addressModalItemName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  addressModalItemText: {
    fontSize: FontSizes.sm,
    color: '#666',
    marginBottom: 1,
  },
  emptyAddressList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyAddressText: {
    fontSize: FontSizes.md,
    color: '#999',
    marginTop: Spacing.sm,
  },
  addNewAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  addNewAddressText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default CartScreen;

