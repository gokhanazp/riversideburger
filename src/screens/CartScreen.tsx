import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { CartItem } from '../types';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../components/ConfirmModal';
import { getUserPoints } from '../services/pointsService';
import { getDefaultAddress, getUserAddresses } from '../services/addressService';
import { Address } from '../types/database.types';
import { formatPrice, getCurrentCurrency } from '../services/currencyService';
import { getDeliveryQuote, UberQuote } from '../services/uberDeliveryService';
import { resolveBestCampaign, getCampaignName, AppliedCampaign } from '../services/campaignService';

const CartScreen = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, removeItem, getTotalPrice } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);
  const [isPointsExpanded, setIsPointsExpanded] = useState(false);

  const [userPoints, setUserPoints] = useState<number>(0);
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [appliedCampaign, setAppliedCampaign] = useState<AppliedCampaign | null>(null);
  const pointsInputRef = useRef<any>(null);
  const pointsTextRef = useRef<string>('');

  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [userAddresses, setUserAddresses] = useState<Address[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Teslimat şekli (Delivery method): 'pickup' = restorandan al, 'delivery' = adrese teslimat
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('delivery');

  // Uber Direct delivery quote state
  const [deliveryQuote, setDeliveryQuote] = useState<UberQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserPoints();
    }
  }, [isAuthenticated, user]);

  // Adresleri ekran her odağa geldiğinde tazele — başka ekrandan (AddressEdit)
  // yeni adres ekleyip sepete dönünce listede görünsün, hard refresh gerekmesin.
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user) {
        loadUserAddress();
      }
    }, [isAuthenticated, user])
  );

  const loadUserPoints = async () => {
    if (!user) return;
    try {
      const points = await getUserPoints(user.id);
      setUserPoints(points);
    } catch (error) {
      console.error('Error loading points:', error);
    }
  };

  const loadUserAddress = async () => {
    if (!user) return;
    try {
      setIsLoadingAddress(true);
      const addresses = await getUserAddresses(user.id);
      setUserAddresses(addresses);
      const defaultAddr = await getDefaultAddress(user.id);
      // Mevcut seçimi koru (silinmişse default'a düş); hiç seçim yoksa default seç
      setSelectedAddress((prev) =>
        prev
          ? addresses.find((a) => a.id === prev.id) ?? defaultAddr ?? null
          : defaultAddr ?? null,
      );
    } catch (error) {
      console.error('Error loading address:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleApplyPoints = () => {
    const text = pointsTextRef.current;
    const numValue = parseFloat(text);
    if (isNaN(numValue) || text === '') {
      setPointsToUse(0);
      return;
    }
    // Puan, kampanya indirimi sonrası kalan tutarı aşamaz
    const maxPoints = Math.min(userPoints, Math.max(0, getTotalPrice() - campaignDiscount));
    if (numValue > maxPoints) {
      setPointsToUse(maxPoints);
      pointsTextRef.current = maxPoints.toFixed(2);
      if (pointsInputRef.current) pointsInputRef.current.setNativeProps({ text: maxPoints.toFixed(2) });
    } else {
      setPointsToUse(numValue);
    }
  };

  // Adres veya teslimat şekli değiştiğinde teslimat ücretini güncelle
  // (Refresh quote when address or delivery method changes; skip entirely for pickup)
  useEffect(() => {
    let cancelled = false;
    if (deliveryMethod === 'pickup' || !selectedAddress || selectedAddress.latitude == null || selectedAddress.longitude == null) {
      setDeliveryQuote(null);
      setQuoteError(null);
      setIsLoadingQuote(false);
      return;
    }
    setIsLoadingQuote(true);
    setQuoteError(null);
    const subtotal_cents = Math.round(getTotalPrice() * 100);
    const manifestItems = items.map((it) => {
      const customizationTotal = (it.customizations ?? []).reduce((s, c) => s + c.option_price, 0);
      return {
        name: it.name,
        quantity: it.quantity,
        price_cents: Math.round((it.price + customizationTotal) * 100),
      };
    });
    getDeliveryQuote(selectedAddress, { subtotal_cents, items: manifestItems })
      .then((quote) => {
        if (!cancelled) setDeliveryQuote(quote);
      })
      .catch((err) => {
        console.error('Quote fetch failed:', err);
        if (!cancelled) {
          setDeliveryQuote(null);
          setQuoteError(err.message || t('cart.feeUnavailable'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAddress, deliveryMethod, items]);

  // En avantajlı kampanyayı otomatik hesapla (sepet/kullanıcı değişince)
  useEffect(() => {
    let cancelled = false;
    const subtotal = getTotalPrice();
    if (items.length === 0 || subtotal <= 0) {
      setAppliedCampaign(null);
      return;
    }
    const lines = items.map((it) => ({
      product_id: it.id,
      category_id: (it as any).category_id ?? null,
      unit_price: it.price,
      quantity: it.quantity,
    }));
    resolveBestCampaign(user?.id ?? null, lines, subtotal)
      .then((res) => { if (!cancelled) setAppliedCampaign(res); })
      .catch(() => { if (!cancelled) setAppliedCampaign(null); });
    return () => { cancelled = true; };
  }, [items, user?.id]);

  const campaignDiscount = appliedCampaign?.discount ?? 0;
  const deliveryFee = deliveryMethod === 'pickup' ? 0 : (deliveryQuote?.fee ?? 0);
  // İndirim sırası: ürün ara toplamı - kampanya - puan, sonra + teslimat ücreti
  const getFinalPrice = () =>
    Math.max(0, getTotalPrice() - campaignDiscount - pointsToUse) + deliveryFee;

  const handleCheckout = () => {
    if (items.length === 0) {
      Toast.show({ type: 'error', text1: t('cart.emptyCartTitle'), text2: t('cart.emptyCartDesc'), position: 'top', topOffset: 60 });
      return;
    }
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    if (deliveryMethod === 'delivery') {
      if (!selectedAddress) {
        Toast.show({ type: 'error', text1: t('cart.noAddressSelectedTitle'), text2: t('cart.noAddressSelectedDesc'), position: 'top', topOffset: 60 });
        return;
      }
      if (selectedAddress.latitude != null && !deliveryQuote) {
        Toast.show({
          type: quoteError ? 'error' : 'info',
          text1: quoteError ? t('cart.quoteFailedTitle') : t('cart.quoteNotReadyTitle'),
          text2: quoteError ?? t('cart.quoteNotReadyDesc'),
          position: 'top',
          topOffset: 60,
        });
        return;
      }
    }
    setShowCheckoutModal(true);
  };

  const handleCheckoutConfirm = () => {
    if (!user) return;
    setShowCheckoutModal(false);

    // Pickup için adres gönderme; delivery için seçilen adresi gönder
    const fullAddress = deliveryMethod === 'pickup'
      ? `${t('cart.deliveryMethodPickup')}: Riverside Burgers`
      : selectedAddress
        ? `${selectedAddress.street_number} ${selectedAddress.street_name}, ${selectedAddress.city}`
        : t('cart.addressNotSpecified');

    navigation.navigate('Payment', {
      totalAmount: getFinalPrice(),
      currency: getCurrentCurrency(),
      deliveryAddress: fullAddress,
      phone: deliveryMethod === 'pickup' ? (user.phone ?? '') : (selectedAddress?.phone || t('cart.phoneNotSpecified')),
      notes: pointsToUse > 0 ? t('cart.pointsUsed', { points: pointsToUse.toFixed(2) }) : '',
      pointsUsed: pointsToUse,
      addressId: deliveryMethod === 'pickup' ? null : (selectedAddress?.id || null),
      deliveryFee,
      quoteId: deliveryMethod === 'pickup' ? null : (deliveryQuote?.quote_id ?? null),
      address: deliveryMethod === 'pickup' ? null : selectedAddress,
      deliveryMethod,
      campaignId: appliedCampaign?.campaign.id ?? null,
      campaignDiscount: campaignDiscount,
    });
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      removeItem(itemToDelete.id);
      Toast.show({ type: 'success', text1: t('cart.itemDeleted'), position: 'top', topOffset: 60 });
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const EliteCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.eliteCard}>
      <View style={styles.cardMainContent}>
        <Image source={{ uri: item.image }} style={styles.eliteImage} />
        <View style={styles.eliteInfo}>
          <View style={styles.eliteHeaderRow}>
            <Text style={styles.eliteName} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity onPress={() => { setItemToDelete({ id: item.id, name: item.name }); setShowDeleteModal(true); }}>
              <Ionicons name="trash-outline" size={18} color="#999" />
            </TouchableOpacity>
          </View>
          <Text style={styles.elitePrice}>{formatPrice(item.price * item.quantity)}</Text>
          <View style={styles.eliteQuantityContainer}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, item.quantity - 1)}>
              <Ionicons name="remove" size={14} color="#000" />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, item.quantity + 1)}>
              <Ionicons name="add" size={14} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const ListFooter = () => (
    <View style={styles.listFooter}>
      {/* Teslimat Şekli (Delivery Method) */}
      {isAuthenticated && (
        <View style={styles.deliveryMethodRow}>
          <TouchableOpacity
            style={[styles.deliveryMethodOption, deliveryMethod === 'delivery' && styles.deliveryMethodOptionActive]}
            onPress={() => setDeliveryMethod('delivery')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="bicycle"
              size={20}
              color={deliveryMethod === 'delivery' ? '#FFF' : Colors.primary}
            />
            <Text style={[styles.deliveryMethodLabel, deliveryMethod === 'delivery' && styles.deliveryMethodLabelActive]}>
              {t('cart.deliveryMethodDelivery')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deliveryMethodOption, deliveryMethod === 'pickup' && styles.deliveryMethodOptionActive]}
            onPress={() => setDeliveryMethod('pickup')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="storefront"
              size={20}
              color={deliveryMethod === 'pickup' ? '#FFF' : Colors.primary}
            />
            <Text style={[styles.deliveryMethodLabel, deliveryMethod === 'pickup' && styles.deliveryMethodLabelActive]}>
              {t('cart.deliveryMethodPickup')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Adres Bölümü (Address Section) — sadece teslimat seçilince */}
      {isAuthenticated && deliveryMethod === 'delivery' && (
        <View style={styles.sectionContainer}>
          <TouchableOpacity 
            style={styles.sectionHeader} 
            onPress={() => setIsAddressExpanded(!isAddressExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.headerTitleRow}>
              <Ionicons name="location" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitleText}>{t('checkout.deliveryAddress')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {!isAddressExpanded && selectedAddress && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>{selectedAddress.title}</Text>
              )}
              <Ionicons name={isAddressExpanded ? "chevron-up" : "chevron-down"} size={18} color="#999" />
            </View>
          </TouchableOpacity>
          
          {isAddressExpanded && (
            <View style={styles.expandedContent}>
              {selectedAddress ? (
                <TouchableOpacity 
                  style={styles.addressCard} 
                  onPress={() => {
                    console.log('Opening address modal...');
                    setShowAddressModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressCardInfo}>
                    <Text style={styles.addressTitleText}>{selectedAddress.title}</Text>
                    <Text style={styles.addressDetailText}>
                      {selectedAddress.street_name} {selectedAddress.street_number}
                      {selectedAddress.unit_number ? `, No: ${selectedAddress.unit_number}` : ''}
                    </Text>
                    <Text style={styles.addressDetailText}>{selectedAddress.city} / {selectedAddress.province}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.addAddressBtnInline} 
                  onPress={() => navigation.navigate('AddressList')}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  <Text style={styles.addAddressTextInline}>{t('cart.addAddress')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Teslimat alanı dışı / ücret alınamadı uyarısı */}
      {isAuthenticated && deliveryMethod === 'delivery' && quoteError && (
        <View style={styles.quoteErrorBanner}>
          <Ionicons name="alert-circle" size={18} color="#D32F2F" />
          <Text style={styles.quoteErrorText}>{quoteError}</Text>
        </View>
      )}

      {/* Puan Bölümü (Points Section) */}
      {isAuthenticated && (
        <View style={styles.sectionContainer}>
          <TouchableOpacity 
            style={styles.sectionHeader} 
            onPress={() => setIsPointsExpanded(!isPointsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.headerTitleRow}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.sectionTitleText}>{t('cart.availablePoints')}: {userPoints.toFixed(0)}</Text>
            </View>
            <Ionicons name={isPointsExpanded ? "chevron-up" : "chevron-down"} size={18} color="#999" />
          </TouchableOpacity>
          
          {isPointsExpanded && (
            <View style={styles.expandedContent}>
              {userPoints > 0 ? (
                <View style={styles.pointsInputRow}>
                  <TextInput
                    ref={pointsInputRef}
                    style={styles.pointsInput}
                    defaultValue=""
                    keyboardType="numeric"
                    placeholder={t('cart.enterPoints')}
                    onChangeText={(text) => { pointsTextRef.current = text; }}
                    onSubmitEditing={handleApplyPoints}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.applyBtn} onPress={handleApplyPoints}>
                    <Text style={styles.applyBtnText}>{t('cart.apply')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noPointsContainer}>
                  <Text style={styles.noPointsText}>{t('loyalty.noPoints')} 🎁</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Özet Bölümü (Summary Section) */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('cart.subtotal')}</Text>
          <Text style={styles.summaryValue}>{formatPrice(getTotalPrice())}</Text>
        </View>
        {appliedCampaign && campaignDiscount > 0 && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: Colors.primary }]} numberOfLines={1}>
                🎉 {getCampaignName(appliedCampaign.campaign, i18n.language)}
              </Text>
              <Text style={[styles.summaryValue, { color: '#28A745' }]}>
                -{formatPrice(campaignDiscount)}
              </Text>
            </View>
          </>
        )}
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('cart.deliveryFee')}</Text>
          <Text style={styles.summaryValue}>
            {deliveryMethod === 'pickup'
              ? t('cart.free')
              : isLoadingQuote
                ? t('cart.calculatingFee')
                : quoteError
                  ? t('cart.feeUnavailable')
                  : deliveryQuote
                    ? formatPrice(deliveryQuote.fee)
                    : t('cart.free')}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="basket-outline" size={80} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
          <Text style={styles.emptySubtitle}>{t('cart.emptyDescription')}</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('MenuTab')}>
            <Text style={styles.shopBtnText}>{t('navigation.menu')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.flatListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {items.map(item => <EliteCartItem key={item.id} item={item} />)}
            <ListFooter />
          </ScrollView>
          
          <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom + 85, 100) }]}>
            <View style={styles.stickyRow}>
              <View>
                <Text style={styles.totalLabel}>{t('cart.total')}</Text>
                <Text style={styles.totalPrice}>{formatPrice(getFinalPrice())}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
                <Text style={styles.checkoutBtnText}>{t('cart.confirm')}</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <ConfirmModal visible={showLoginModal} title={t('cart.loginRequired')} message={t('cart.loginRequiredDesc')} confirmText={t('cart.login')} cancelText={t('cart.cancel')} onConfirm={() => { setShowLoginModal(false); navigation.navigate('Login'); }} onCancel={() => setShowLoginModal(false)} />
      <ConfirmModal visible={showCheckoutModal} title={t('cart.confirmOrder')} message={t('cart.confirmOrderDesc', { price: formatPrice(getFinalPrice()) })} confirmText={t('cart.confirm')} cancelText={t('cart.cancel')} onConfirm={handleCheckoutConfirm} onCancel={() => setShowCheckoutModal(false)} type="success" />
      <ConfirmModal visible={showDeleteModal} title={t('cart.deleteItem')} message={t('cart.deleteItemDesc', { name: itemToDelete?.name || '' })} confirmText={t('cart.delete')} cancelText={t('cart.cancel')} onConfirm={handleDeleteConfirm} onCancel={() => setShowDeleteModal(false)} type="danger" />

      {showAddressModal && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.overlayClose} activeOpacity={1} onPress={() => setShowAddressModal(false)} />
          <View style={styles.addressModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('cart.selectAddress')}</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={userAddresses}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalAddressItem, selectedAddress?.id === item.id && styles.modalAddressItemSelected]} 
                  onPress={() => { setSelectedAddress(item); setShowAddressModal(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalAddressTitle}>{item.title}</Text>
                    <Text style={styles.modalAddressText}>{item.street_name} {item.street_number}</Text>
                  </View>
                  {selectedAddress?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Ionicons name="location-outline" size={48} color="#CCC" />
                  <Text style={styles.modalEmptyText}>{t('cart.noAddress')}</Text>
                </View>
              }
            />
            
            <TouchableOpacity 
              style={styles.modalNewAddressBtn} 
              onPress={() => { setShowAddressModal(false); navigation.navigate('AddressList'); }}
            >
              <Ionicons name="add-circle" size={22} color={Colors.primary} />
              <Text style={styles.modalNewAddressText}>{t('cart.addAddress')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  flatListContent: { padding: 16, paddingBottom: 220 },
  eliteCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 12, ...Shadows.small },
  cardMainContent: { flexDirection: 'row' },
  eliteImage: { width: 85, height: 85, borderRadius: 16 },
  eliteInfo: { flex: 1, marginLeft: 14, justifyContent: 'space-between' },
  eliteHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  eliteName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  elitePrice: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  eliteQuantityContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#F5F5F7', borderRadius: 20, padding: 2 },
  qtyBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 15, ...Shadows.small },
  qtyText: { marginHorizontal: 14, fontWeight: '700', fontSize: 15 },
  listFooter: { marginTop: 10 },
  deliveryMethodRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  deliveryMethodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#EDEEF2',
  },
  deliveryMethodOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  deliveryMethodLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  deliveryMethodLabelActive: { color: '#FFF' },
  sectionContainer: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 14, ...Shadows.small, borderWidth: 1, borderColor: '#F0F0F0' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerSubtitle: { fontSize: 12, color: '#888', maxWidth: 120 },
  sectionTitleText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: 0.5 },
  expandedContent: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#EDEEF2' },
  addressCardInfo: { flex: 1 },
  addressTitleText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  addressDetailText: { fontSize: 13, color: '#666', lineHeight: 18 },
  addAddressBtnInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  addAddressTextInline: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  pointsInputRow: { flexDirection: 'row', gap: 10 },
  pointsInput: { flex: 1, height: 46, backgroundColor: '#F5F5F7', borderRadius: 12, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: '#EDEEF2' },
  applyBtn: { backgroundColor: '#FFD700', paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', ...Shadows.small },
  applyBtnText: { fontSize: 13, fontWeight: '800', color: '#856404' },
  noPointsContainer: { alignItems: 'center', paddingVertical: 10 },
  noPointsText: { fontSize: 14, color: '#999', fontStyle: 'italic' },
  quoteErrorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FDECEA', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F5C6C2' },
  quoteErrorText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#D32F2F', lineHeight: 18 },
  summaryGrid: { 
    flexDirection: 'row', 
    backgroundColor: '#F8F9FA', 
    borderRadius: 20, 
    padding: 18, 
    marginBottom: 20, 
    alignItems: 'center', 
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 24, backgroundColor: '#EDEEF2' },
  summaryLabel: { fontSize: 10, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 24, paddingTop: 20, borderTopLeftRadius: 36, borderTopRightRadius: 36, ...Shadows.large },
  stickyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 11, color: '#999', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  totalPrice: { fontSize: 28, fontWeight: '900', color: '#1A1A1A' },
  checkoutBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 28, borderRadius: 22, gap: 10, ...Shadows.medium },
  checkoutBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIconCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 32 },
  shopBtn: { backgroundColor: '#1A1A1A', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, ...Shadows.medium },
  shopBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  modalOverlay: { 
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000
  },
  overlayClose: { ...StyleSheet.absoluteFillObject },
  addressModal: { 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 24, 
    maxHeight: '80%', 
    width: '100%',
    maxWidth: 450,
    ...Shadows.large 
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A1A' },
  modalAddressItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0', backgroundColor: '#FAFBFD' },
  modalAddressItemSelected: { borderColor: Colors.primary, backgroundColor: '#FEF2F2' },
  modalAddressTitle: { fontWeight: '800', fontSize: 16, color: '#1A1A1A', marginBottom: 4 },
  modalAddressText: { fontSize: 14, color: '#666' },
  modalEmpty: { alignItems: 'center', padding: 40 },
  modalEmptyText: { marginTop: 12, color: '#AAA', fontSize: 15 },
  modalNewAddressBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  modalNewAddressText: { color: Colors.primary, fontWeight: '800', fontSize: 16 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  loadingText: { marginTop: 16, fontWeight: '800', color: Colors.primary, fontSize: 16 }
});

export default CartScreen;
