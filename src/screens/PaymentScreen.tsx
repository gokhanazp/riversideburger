// Payment Screen - Ödeme Ekranı
// Stripe ile ödeme işlemlerini yönetir (Manages payment operations with Stripe)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { createPaymentIntent, confirmPayment } from '../services/stripeService';
import { createOrder } from '../services/orderService';
import { createUberDelivery } from '../services/uberDeliveryService';
import { Address } from '../types/database.types';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../services/currencyService';
import Toast from 'react-native-toast-message';

// Stripe sadece native platformlarda yükle (Load Stripe only on native platforms)
let CardField: any = null;
let useStripe: any = () => ({ confirmPayment: null });
if (Platform.OS !== 'web') {
  const stripe = require('@stripe/stripe-react-native');
  CardField = stripe.CardField;
  useStripe = stripe.useStripe;
}

interface PaymentScreenProps {
  navigation: any;
  route: any;
}

export default function PaymentScreen({ navigation, route }: PaymentScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { confirmPayment: stripeConfirmPayment } = useStripe();
  const { user } = useAuthStore();
  const { items, clearCart } = useCartStore();

  // Route params
  const {
    totalAmount,
    currency,
    deliveryAddress,
    phone,
    notes,
    pointsUsed,
    addressId,
    deliveryFee,
    quoteId,
    address,
    deliveryMethod = 'delivery',
  } = route.params as {
    totalAmount: number;
    currency: string;
    deliveryAddress: string;
    phone: string;
    notes?: string;
    pointsUsed: number;
    addressId: string | null;
    deliveryFee?: number;
    quoteId?: string | null;
    address?: Address | null;
    deliveryMethod?: 'pickup' | 'delivery';
  };

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Animations
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  const isPickup = deliveryMethod === 'pickup';

  useEffect(() => {
    initializePayment();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const initializePayment = async () => {
    try {
      setIsLoading(true);
      const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (!stripeKey || stripeKey.includes('your_publishable_key_here')) {
        setIsDemoMode(true);
        setIsLoading(false);
        return;
      }

      const { clientSecret: secret, paymentIntentId: intentId } = await createPaymentIntent(
        totalAmount,
        currency,
        undefined,
        { pointsUsed, itemCount: items.length }
      );

      setClientSecret(secret);
      setPaymentIntentId(intentId);
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (isDemoMode) return handleDemoPayment();

    if (!cardComplete) {
      Toast.show({ type: 'error', text1: t('payment.error'), text2: t('payment.completeCardInfo'), visibilityTime: 3000, topOffset: 60 });
      return;
    }

    if (!clientSecret || !paymentIntentId) {
      Toast.show({ type: 'error', text1: t('payment.error'), text2: t('payment.initializationError'), visibilityTime: 3000, topOffset: 60 });
      return;
    }

    try {
      setIsLoading(true);
      const { error, paymentIntent } = await stripeConfirmPayment(clientSecret, { paymentMethodType: 'Card' });

      if (error) throw new Error(error.message);

      if (paymentIntent?.status === 'Succeeded') {
        await confirmPayment(paymentIntentId);
        await createOrderAndNavigate();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Toast.show({ type: 'error', text1: t('payment.failed'), text2: error.message || t('payment.tryAgain'), visibilityTime: 4000, topOffset: 60 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoPayment = async () => {
    if (!cardComplete) {
      Toast.show({ type: 'error', text1: t('payment.error'), text2: t('payment.completeCardInfo'), visibilityTime: 3000, topOffset: 60 });
      return;
    }

    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await createOrderAndNavigate();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('payment.failed'), text2: error.message || t('payment.tryAgain'), visibilityTime: 4000, topOffset: 60 });
    } finally {
      setIsLoading(false);
    }
  };

  const createOrderAndNavigate = async () => {
    const orderItems = items.map((item) => ({
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      customizations: item.customizations,
      specialInstructions: item.specialInstructions,
    }));

    const order = await createOrder({
      user_id: user!.id,
      total_amount: totalAmount,
      delivery_address: deliveryAddress,
      phone,
      notes,
      items: orderItems,
      points_used: pointsUsed,
      address_id: addressId ?? undefined,
      delivery_method: deliveryMethod,
      // Uber Direct snapshot — sadece delivery için doldurulur
      delivery_full_name: deliveryMethod === 'delivery' ? address?.full_name : undefined,
      delivery_street: deliveryMethod === 'delivery' && address ? `${address.street_number} ${address.street_name}` : undefined,
      delivery_unit: deliveryMethod === 'delivery' ? (address?.unit_number ?? null) : null,
      delivery_city: deliveryMethod === 'delivery' ? address?.city : undefined,
      delivery_province: deliveryMethod === 'delivery' ? address?.province : undefined,
      delivery_postal_code: deliveryMethod === 'delivery' ? address?.postal_code : undefined,
      delivery_country: 'CA',
      delivery_lat: deliveryMethod === 'delivery' ? (address?.latitude ?? null) : null,
      delivery_lng: deliveryMethod === 'delivery' ? (address?.longitude ?? null) : null,
      delivery_instructions: deliveryMethod === 'delivery' ? (address?.delivery_instructions ?? null) : null,
      delivery_fee: deliveryFee,
    });

    clearCart();

    // Uber dispatch sadece delivery + Kanada adresi + quote varsa
    let uberDispatchFailed = false;
    if (deliveryMethod === 'delivery' && quoteId && address?.latitude != null) {
      try {
        await createUberDelivery(order.id, quoteId);
      } catch (err) {
        console.error('Uber dispatch failed:', err);
        uberDispatchFailed = true;
      }
    }

    Toast.show({
      type: uberDispatchFailed ? 'error' : 'success',
      text1: uberDispatchFailed ? t('payment.failed') : t('payment.success'),
      text2: uberDispatchFailed
        ? t('payment.uberDispatchFailed')
        : t('payment.orderCreated', { orderNumber: order.order_number }),
      visibilityTime: 4000,
      topOffset: 60,
    });

    setTimeout(() => {
      // Sadece delivery + Uber dispatch başarılı → tracking; pickup veya başarısız → home
      if (deliveryMethod === 'delivery' && quoteId && !uberDispatchFailed) {
        navigation.replace('OrderTracking', { orderId: order.id });
      } else {
        navigation.navigate('Main', { screen: 'HomeTab' });
      }
    }, 2000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payment.title')}</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="lock-closed" size={14} color={Colors.primary} />
        </View>
      </View>

      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 }}
      >
        {/* DEMO MODE Uyarisi */}
        {isDemoMode && (
          <View style={styles.demoWarning}>
            <View style={styles.demoIconWrap}>
              <Ionicons name="flask" size={18} color="#FF9800" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoWarningTitle}>Test Mode</Text>
              <Text style={styles.demoWarningText}>
                {t('payment.demoModeDesc') || 'Stripe test modunda. Gercek odeme alinmaz.'}
              </Text>
            </View>
          </View>
        )}

        {/* Tutar Karti */}
        <View style={styles.amountCard}>
          <View style={styles.amountTopRow}>
            <View style={styles.amountIconCircle}>
              <Ionicons name="receipt-outline" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.amountLabel}>{t('payment.totalAmount')}</Text>
          </View>
          <Text style={styles.amountValue}>{formatPrice(totalAmount)}</Text>
          <View style={styles.amountDivider} />
          <View style={styles.amountDetails}>
            <View style={styles.amountDetailRow}>
              <Text style={styles.detailLabel}>{t('cart.subtotal')}</Text>
              <Text style={styles.detailValue}>{formatPrice(totalAmount + pointsUsed)}</Text>
            </View>
            {pointsUsed > 0 && (
              <View style={styles.amountDetailRow}>
                <Text style={styles.detailLabel}>{t('cart.pointsDiscount') || 'Puan indirimi'}</Text>
                <Text style={[styles.detailValue, { color: '#28A745' }]}>-{formatPrice(pointsUsed)}</Text>
              </View>
            )}
            <View style={styles.amountDetailRow}>
              <Text style={styles.detailLabel}>{t('cart.deliveryFee')}</Text>
              <Text style={[styles.detailValue, { color: '#28A745' }]}>{t('cart.free')}</Text>
            </View>
          </View>
        </View>

        {/* Teslimat Bilgisi */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="location" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('checkout.deliveryAddress') || 'Teslimat adresi'}</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{deliveryAddress}</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="call" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('checkout.phone') || 'Telefon'}</Text>
              <Text style={styles.infoValue}>{phone}</Text>
            </View>
          </View>
        </View>

        {/* Pickup bilgi notu — ödeme sonrası restorandan teslim alınacak */}
        {isPickup && (
          <View style={styles.demoWarning}>
            <View style={styles.demoIconWrap}>
              <Ionicons name="storefront" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoWarningTitle}>{t('cart.deliveryMethodPickup')}</Text>
              <Text style={styles.demoWarningText}>{t('payment.pickupNote')}</Text>
            </View>
          </View>
        )}

        {/* Kart Bilgileri */}
        <View style={styles.cardSection}>
          <View style={styles.cardSectionHeader}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="card" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={styles.cardSectionTitle}>{t('payment.cardInformation')}</Text>
              <Text style={styles.cardSectionSubtitle}>{t('payment.enterCardDetails')}</Text>
            </View>
          </View>

          <View style={styles.cardFieldContainer}>
            {Platform.OS !== 'web' && CardField ? (
              <View style={styles.cardFieldWrapper}>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{ number: '4242 4242 4242 4242' }}
                  cardStyle={{
                    backgroundColor: '#F8F9FA',
                    textColor: '#1A1A1A',
                    placeholderColor: '#B0B0B0',
                    borderColor: cardComplete ? '#28A745' : '#DDDFE3',
                    borderWidth: 1.5,
                    borderRadius: 14,
                    fontSize: 16,
                    textErrorColor: '#DC3545',
                  }}
                  style={styles.cardField}
                  onCardChange={(cardDetails: any) => setCardComplete(cardDetails.complete)}
                />
                {cardComplete && (
                  <View style={styles.cardCompleteIndicator}>
                    <View style={styles.completeBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.webCardPlaceholder}>
                <Ionicons name="phone-portrait-outline" size={40} color="#CCC" />
                <Text style={styles.webCardText}>
                  {t('payment.mobileOnly') || 'Kart girisi sadece mobil uygulamada mevcuttur'}
                </Text>
              </View>
            )}
          </View>

          {/* Kabul edilen kartlar */}
          <View style={styles.acceptedCards}>
            <Text style={styles.acceptedCardsLabel}>{t('payment.acceptedCards')}</Text>
            <View style={styles.cardBrands}>
              <View style={[styles.cardBrand, { backgroundColor: '#1A1F71' }]}>
                <Text style={[styles.cardBrandText, { color: '#FFF' }]}>VISA</Text>
              </View>
              <View style={[styles.cardBrand, { backgroundColor: '#EB001B' }]}>
                <Text style={[styles.cardBrandText, { color: '#FFF' }]}>MC</Text>
              </View>
              <View style={[styles.cardBrand, { backgroundColor: '#006FCF' }]}>
                <Text style={[styles.cardBrandText, { color: '#FFF' }]}>AMEX</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Guvenlik Bilgisi */}
        <View style={styles.securitySection}>
          <View style={styles.securityRow}>
            <Ionicons name="shield-checkmark" size={18} color="#28A745" />
            <Text style={styles.securityText}>{t('payment.securePayment') || '256-bit SSL ile guvenli odeme'}</Text>
          </View>
          <View style={styles.securityRow}>
            <Ionicons name="lock-closed" size={18} color="#28A745" />
            <Text style={styles.securityText}>{t('payment.dataProtected') || 'Kart bilgileriniz saklanmaz'}</Text>
          </View>
          <View style={styles.securityRow}>
            <Ionicons name="logo-no-smoking" size={18} color="#28A745" />
            <Text style={styles.securityText}>Powered by Stripe</Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Footer - Odeme Butonu */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
        <View style={styles.footerTotalRow}>
          <Text style={styles.footerLabel}>{t('payment.totalAmount')}</Text>
          <Text style={styles.footerAmount}>{formatPrice(totalAmount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, (!cardComplete || isLoading) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!cardComplete || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.payButtonText}>{t('payment.processing') || 'Isleniyor...'}</Text>
            </View>
          ) : (
            <View style={styles.payButtonContent}>
              <View style={styles.payButtonLeft}>
                <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.payButtonText}>
                  {`${t('payment.pay')} ${formatPrice(totalAmount)}`}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Demo Warning
  demoWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
    gap: 12,
  },
  demoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 2,
  },
  demoWarningText: {
    fontSize: 12,
    color: '#BF360C',
    lineHeight: 17,
  },
  // Amount Card
  amountCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 14,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  amountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  amountIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 16,
    marginLeft: 48,
  },
  amountDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 14,
  },
  amountDetails: {
    gap: 10,
  },
  amountDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  // Info Card
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#AAA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 14,
    marginLeft: 52,
  },
  // Card Section
  cardSection: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 24,
    marginBottom: 14,
    ...Shadows.medium,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  cardSectionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  cardFieldContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
  },
  cardFieldWrapper: {
    position: 'relative',
  },
  cardField: {
    width: '100%',
    height: 54,
  },
  cardCompleteIndicator: {
    position: 'absolute',
    right: 10,
    top: 14,
  },
  completeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#28A745',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptedCards: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  acceptedCardsLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardBrands: {
    flexDirection: 'row',
    gap: 8,
  },
  cardBrand: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardBrandText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 0.5,
  },
  // Web Placeholder
  webCardPlaceholder: {
    alignItems: 'center',
    padding: 30,
    gap: 12,
  },
  webCardText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Security Section
  securitySection: {
    backgroundColor: '#F8FFF8',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...Shadows.large,
  },
  footerTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  payButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  payButtonDisabled: {
    opacity: 0.35,
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
