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
import { useTranslation } from 'react-i18next';
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
import { formatPrice } from '../services/currencyService';

// Sepet ekranı (Cart screen)
const CartScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
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

  // Sipariş onayı - Direkt sipariş oluştur (Checkout confirm - Create order directly)
  // ÖNEMLİ: Ödeme sistemi geçici olarak devre dışı (IMPORTANT: Payment system temporarily disabled)
  const handleCheckoutConfirm = async () => {
    if (!user) return;

    try {
      setShowCheckoutModal(false);
      setIsCreatingOrder(true);

      // Adres bilgisini hazırla (Prepare address info)
      const fullAddress = selectedAddress
        ? `${selectedAddress.street_number} ${selectedAddress.street_name}${
            selectedAddress.unit_number ? `, ${selectedAddress.unit_number}` : ''
          }, ${selectedAddress.city}, ${selectedAddress.province} ${selectedAddress.postal_code}`
        : 'Adres belirtilmedi';

      console.log('📦 Creating order directly (payment disabled):', {
        totalAmount: getFinalPrice(),
        deliveryAddress: fullAddress,
        phone: selectedAddress?.phone || user.phone,
        pointsUsed: pointsToUse,
      });

      // Sipariş kalemlerini hazırla (Prepare order items)
      const orderItems = items.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        customizations: item.customizations?.map((opt) => ({
          option_id: opt.option_id,
          option_name: opt.option_name,
          option_price: opt.option_price,
        })),
        specialInstructions: item.specialInstructions,
      }));

      // Siparişi oluştur (Create order)
      const order = await createOrder({
        user_id: user.id,
        total_amount: getFinalPrice(),
        delivery_address: fullAddress,
        phone: selectedAddress?.phone || user.phone || 'Telefon belirtilmedi',
        notes: pointsToUse > 0 ? `${pointsToUse.toFixed(2)} puan kullanıldı` : '',
        items: orderItems,
        points_used: pointsToUse,
        address_id: selectedAddress?.id || null,
      });

      console.log('✅ Order created successfully:', order.id);

      // Sepeti temizle (Clear cart)
      clearCart();

      // Başarı mesajı (Success message)
      Toast.show({
        type: 'success',
        text1: '✅ Sipariş Oluşturuldu!',
        text2: `Sipariş numaranız: ${order.order_number}`,
        visibilityTime: 4000,
        topOffset: 60,
      });

      // Sipariş geçmişi ekranına yönlendir (Navigate to order history)
      navigation.navigate('OrderHistory');

    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      Toast.show({
        type: 'error',
        text1: t('cart.error'),
        text2: error.message || t('cart.orderError'),
        visibilityTime: 3000,
        topOffset: 60,
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
        text1: t('cart.itemDeleted'),
        text2: t('cart.itemRemovedFromCart', { name: itemToDelete.name }),
      });
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  // Elite sepet öğesi kartı (Elite Cart item card component)
  const EliteCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.eliteCard}>
      <View style={styles.cardMainContent}>
        <Image source={{ uri: item.image }} style={styles.eliteImage} />
        <View style={styles.eliteInfo}>
          <View style={styles.eliteHeaderRow}>
            <Text style={styles.eliteName} numberOfLines={2}>{item.name}</Text>
            <TouchableOpacity
              onPress={() => handleRemoveItem(item.id, item.name)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Özelleştirmeler (Customizations) */}
          {((item.customizations?.length ?? 0) > 0 || item.specialInstructions) && (
            <View style={styles.eliteCustomizations}>
              {item.customizations?.map((custom, idx) => (
                <Text key={idx} style={styles.eliteCustomizationText}>
                  + {custom.option_name}
                </Text>
              ))}
              {item.specialInstructions && (
                <Text style={styles.eliteNoteText}>
                  Note: {item.specialInstructions}
                </Text>
              )}
            </View>
          )}

          <View style={styles.eliteFooterRow}>
            <Text style={styles.elitePrice}>
              {formatPrice(item.price * item.quantity)}
            </Text>
            
            <View style={styles.eliteQuantityContainer}>
              <TouchableOpacity
                style={styles.eliteQtyBtn}
                onPress={() => updateQuantity(item.id, item.quantity - 1)}
              >
                <Ionicons name="remove" size={16} color={Colors.black} />
              </TouchableOpacity>
              <Text style={styles.eliteQtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.eliteQtyBtn}
                onPress={() => updateQuantity(item.id, item.quantity + 1)}
              >
                <Ionicons name="add" size={16} color={Colors.black} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  // Boş sepet görünümü (Empty cart view)
  const EmptyCart = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="basket-outline" size={80} color={Colors.primary} style={{ opacity: 0.8 }} />
      </View>
      <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
      <Text style={styles.emptySubtitle}>{t('cart.emptyDescription')}</Text>
      <TouchableOpacity
        style={styles.shopNowButton}
        onPress={() => navigation.navigate('MenuTab')}
        activeOpacity={0.9}
      >
        <Text style={styles.shopNowText}>{t('navigation.menu')}</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.white} />
      </TouchableOpacity>
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
            renderItem={({ item }) => <EliteCartItem item={item} />}
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
                  <Text style={styles.addressHeaderText}>{t('checkout.deliveryAddress')}</Text>
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
                    <Text style={styles.addAddressText}>{t('cart.addAddress')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.subtotal')}:</Text>
              <Text style={styles.summaryValue}>
                {formatPrice(getTotalPrice())}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.deliveryFee')}:</Text>
              <Text style={styles.summaryValue}>
                {formatPrice(0)}
              </Text>
            </View>

            {/* Puan Kullanma Bölümü (Points Usage Section) */}
            {isAuthenticated && (
              <View style={styles.pointsSection}>
                <View style={styles.pointsHeader}>
                  <View style={styles.pointsHeaderLeft}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                    <Text style={styles.pointsHeaderText}>
                      {t('cart.availablePoints')}: {userPoints.toFixed(2)}
                    </Text>
                  </View>
                  {pointsToUse > 0 && (
                    <TouchableOpacity onPress={handleClearPoints}>
                      <Text style={styles.clearPointsText}>{t('cart.clear')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {userPoints > 0 ? (
                  <>
                    <View style={styles.pointsInputContainer}>
                      <TextInput
                        style={styles.pointsInput}
                        placeholder={t('cart.enterPoints')}
                        keyboardType="decimal-pad"
                        value={pointsInputValue}
                        onChangeText={handlePointsChange}
                      />
                      <TouchableOpacity
                        style={styles.useAllButton}
                        onPress={handleUseAllPoints}
                      >
                        <Text style={styles.useAllButtonText}>{t('cart.apply')}</Text>
                      </TouchableOpacity>
                    </View>

                    {pointsToUse > 0 && (
                      <View style={styles.pointsDiscountRow}>
                        <Text style={styles.pointsDiscountLabel}>{t('cart.discount')}:</Text>
                        <Text style={styles.pointsDiscountValue}>
                          -{formatPrice(pointsToUse)}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.noPointsText}>
                    {t('loyalty.noPoints')} 🎁
                  </Text>
                )}
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t('cart.total')}:</Text>
              <View style={styles.totalPriceContainer}>
                {pointsToUse > 0 && (
                  <Text style={styles.originalPrice}>
                    {formatPrice(getTotalPrice())}
                  </Text>
                )}
                <Text style={styles.totalValue}>
                  {formatPrice(getFinalPrice())}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.checkoutButton, isCreatingOrder && styles.checkoutButtonDisabled]}
              onPress={handleCheckout}
              activeOpacity={0.8}
              disabled={isCreatingOrder}
            >
              {isCreatingOrder ? (
                <View style={styles.checkoutButtonContent}>
                  <ActivityIndicator color={Colors.white} size="small" />
                  <Text style={styles.checkoutButtonText}>Sipariş Oluşturuluyor...</Text>
                </View>
              ) : (
                <Text style={styles.checkoutButtonText}>{t('cart.confirmOrder')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Giriş gerekli modal (Login required modal) */}
      <ConfirmModal
        visible={showLoginModal}
        title={t('cart.loginRequired')}
        message={t('cart.loginRequiredDesc')}
        confirmText={t('cart.login')}
        cancelText={t('cart.cancel')}
        onConfirm={handleLoginConfirm}
        onCancel={() => setShowLoginModal(false)}
        type="default"
      />

      {/* Sipariş onay modal (Checkout confirmation modal) */}
      <ConfirmModal
        visible={showCheckoutModal}
        title={t('cart.confirmOrder')}
        message={
          pointsToUse > 0
            ? `${t('cart.subtotal')}: ${formatPrice(getTotalPrice())}\n${t('cart.discount')}: -${formatPrice(pointsToUse)}\n\n${t('cart.finalTotal')}: ${formatPrice(getFinalPrice())}\n\n${t('cart.confirmOrderDesc')}`
            : `${t('cart.total')}: ${formatPrice(getTotalPrice())}\n\n${t('cart.confirmOrderDesc')}`
        }
        confirmText={t('cart.confirm')}
        cancelText={t('cart.cancel')}
        onConfirm={handleCheckoutConfirm}
        onCancel={() => setShowCheckoutModal(false)}
        type="success"
      />

      {/* Ürün silme modal (Delete item modal) */}
      <ConfirmModal
        visible={showDeleteModal}
        title={t('cart.deleteItem')}
        message={t('cart.deleteItemDesc', { name: itemToDelete?.name || '' })}
        confirmText={t('cart.delete')}
        cancelText={t('cart.cancel')}
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
              <Text style={styles.addressModalTitle}>{t('cart.selectAddress')}</Text>
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
                      text1: '✅ ' + t('address.addressSelected'),
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
                  <Text style={styles.emptyAddressText}>{t('cart.noAddress')}</Text>
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
              <Text style={styles.addNewAddressText}>{t('cart.addAddress')}</Text>
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
    backgroundColor: '#F8F9FA',
  },
  cartList: {
    padding: Spacing.lg,
    paddingBottom: 200,
  },
  // Elite Card Styles
  eliteCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 20,
    padding: 12,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardMainContent: {
    flexDirection: 'row',
  },
  eliteImage: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  eliteInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  eliteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eliteName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  eliteCustomizations: {
    marginTop: 6,
    marginBottom: 8,
  },
  eliteCustomizationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  eliteNoteText: {
    fontSize: 12,
    color: Colors.primary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  eliteFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  elitePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.black,
  },
  eliteQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 30, // Pill shape
    padding: 4,
    gap: 8,
  },
  eliteQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  eliteQtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    minWidth: 16,
    textAlign: 'center',
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FEF2F2', // Light red bg
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  shopNowButton: {
    flexDirection: 'row',
    backgroundColor: Colors.black,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
    gap: 12,
    ...Shadows.medium,
  },
  shopNowText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },

  // Footer Styles
  footer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...Shadows.large,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  addressSection: {
    marginBottom: 20,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  addressHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedAddressCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDEEF2',
  },
  addressCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressCardLeft: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  addressName: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  addressPhone: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDEEF2',
    borderStyle: 'dashed',
    gap: 8,
  },
  addAddressText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },

  pointsSection: {
    marginBottom: 20,
    backgroundColor: '#FFF9C4', // Very light yellow for points context
    borderRadius: 16,
    padding: 16,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
  },
  clearPointsText: {
    fontSize: 12,
    color: '#856404',
    textDecorationLine: 'underline',
  },
  pointsInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  pointsInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  useAllButton: {
    backgroundColor: '#856404',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  useAllButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  pointsDiscountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pointsDiscountLabel: {
    fontSize: 14,
    color: '#856404',
  },
  pointsDiscountValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
  },
  noPointsText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
  },

  checkoutButton: {
    backgroundColor: Colors.black,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    ...Shadows.medium,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
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
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Shadows.large,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  // Address Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addressModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  addressModalList: {
    maxHeight: 400,
  },
  addressModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDEEF2',
    borderRadius: 16,
    marginBottom: 12,
  },
  addressModalItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F0',
  },
  addressModalItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  addressModalItemLeft: {
    flex: 1,
  },
  addressModalItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  addressModalItemName: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  addressModalItemText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 1,
  },
  emptyAddressList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyAddressText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  addNewAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  addNewAddressText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default CartScreen;
