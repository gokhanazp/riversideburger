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
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { Colors, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { createPaymentIntent, confirmPayment, attachOrderToPayment } from '../services/stripeService';
import { createOrder } from '../services/orderService';
import { createUberDelivery } from '../services/uberDeliveryService';
import { Address } from '../types/database.types';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../services/currencyService';
import Toast from 'react-native-toast-message';

// Stripe sadece native platformlarda yükle (Load Stripe only on native platforms)
let CardField: any = null;
let useStripe: any = () => ({ confirmPayment: null });
let PlatformPayButton: any = null;
let PlatformPay: any = null;
let isPlatformPaySupported: any = async () => false;
let confirmPlatformPayPayment: any = null;
if (Platform.OS !== 'web') {
  const stripe = require('@stripe/stripe-react-native');
  CardField = stripe.CardField;
  useStripe = stripe.useStripe;
  // Apple Pay (iOS) / Google Pay (Android) — tek PlatformPay API'si
  PlatformPayButton = stripe.PlatformPayButton;
  PlatformPay = stripe.PlatformPay;
  isPlatformPaySupported = stripe.isPlatformPaySupported;
  confirmPlatformPayPayment = stripe.confirmPlatformPayPayment;
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
    campaignId = null,
    campaignDiscount = 0,
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
    campaignId?: string | null;
    campaignDiscount?: number;
  };

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentAmount, setIntentAmount] = useState<number | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [initError, setInitError] = useState(false);
  const [platformPaySupported, setPlatformPaySupported] = useState(false);

  // Tip state — sadece delivery için aktif (kuryeye gider)
  const [selectedTipPercent, setSelectedTipPercent] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState<number>(0);
  const [isCustomTipActive, setIsCustomTipActive] = useState(false);
  const [showCustomTipModal, setShowCustomTipModal] = useState(false);
  const [customTipInput, setCustomTipInput] = useState('');

  // Animations
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  const isPickup = deliveryMethod === 'pickup';

  // Bahşiş tabanı = yemek tutarı (subtotal); delivery fee'yi düşer, kullanılan puanı geri ekler
  const tipBase = Math.max(0, totalAmount + pointsUsed - (deliveryFee ?? 0));
  const tipAmount = isCustomTipActive
    ? customTipAmount
    : selectedTipPercent != null
      ? Number((tipBase * (selectedTipPercent / 100)).toFixed(2))
      : 0;
  const finalTotal = Number((totalAmount + tipAmount).toFixed(2));

  const handleSelectTipPercent = (pct: number) => {
    if (selectedTipPercent === pct && !isCustomTipActive) {
      setSelectedTipPercent(null); // ikinci tıklamada bahşişi kaldırır
      return;
    }
    setSelectedTipPercent(pct);
    setIsCustomTipActive(false);
    setCustomTipAmount(0);
  };

  const handleOpenCustomTip = () => {
    setCustomTipInput(isCustomTipActive && customTipAmount > 0 ? customTipAmount.toFixed(2) : '');
    setShowCustomTipModal(true);
  };

  const handleApplyCustomTip = () => {
    const parsed = parseFloat(customTipInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      Toast.show({ type: 'error', text1: t('payment.error'), text2: t('payment.tipCustomPlaceholder'), visibilityTime: 2500, topOffset: 60 });
      return;
    }
    if (parsed === 0) {
      setIsCustomTipActive(false);
      setCustomTipAmount(0);
      setSelectedTipPercent(null);
    } else {
      setCustomTipAmount(Number(parsed.toFixed(2)));
      setIsCustomTipActive(true);
      setSelectedTipPercent(null);
    }
    setShowCustomTipModal(false);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Apple Pay / Google Pay cihazda kullanılabilir mi? (Wallet availability)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    isPlatformPaySupported({ googlePay: { testEnv: false } })
      .then((supported: boolean) => setPlatformPaySupported(!!supported))
      .catch(() => setPlatformPaySupported(false));
  }, []);

  // Bahşiş değiştiğinde Stripe payment intent yeniden oluşturulur (debounced).
  useEffect(() => {
    const t = setTimeout(() => { initializePayment(finalTotal); }, 300);
    return () => clearTimeout(t);
  }, [finalTotal]);

  const initializePayment = async (amount: number) => {
    try {
      // App.tsx ile aynı kaynaktan oku: önce app.json -> extra (git'te, build'e dahil),
      // sonra .env fallback. .env gitignore'da olduğu için EAS build'lerinde bulunmaz.
      const stripeKey =
        Constants.expoConfig?.extra?.stripePublishableKey ||
        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      // Demo mode YALNIZCA gerçek Stripe anahtarı yokken (geliştirme ortamı) devreye girer.
      // pk_live_/pk_test_ ile başlayan gerçek anahtarlarda asla demo'ya düşmeyiz —
      // aksi halde ödeme alınmadan sipariş oluşabilir.
      const isRealStripeKey = stripeKey?.startsWith('pk_live_') || stripeKey?.startsWith('pk_test_');
      if (!stripeKey || stripeKey.includes('your_publishable_key_here') || !isRealStripeKey) {
        setIsDemoMode(true);
        return;
      }

      if (intentAmount === amount) return; // aynı tutar için yeniden create etme

      const { clientSecret: secret, paymentIntentId: intentId } = await createPaymentIntent(
        amount,
        currency,
        undefined,
        { pointsUsed, itemCount: items.length, tipAmount }
      );

      setClientSecret(secret);
      setPaymentIntentId(intentId);
      setIntentAmount(amount);
      setInitError(false);
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      // ÖNEMLİ: Gerçek anahtarla payment intent oluşturulamazsa demo mode'a DÜŞME.
      // Ödemeyi engelle; kullanıcı tekrar denesin. Böylece ödemesiz sipariş oluşmaz.
      setClientSecret(null);
      setPaymentIntentId(null);
      setInitError(true);
    }
  };

  // Ödeme onaylandıktan sonra ortak son adım: SUNUCU tarafında doğrula + siparişi oluştur.
  // Kart ve Apple/Google Pay akışlarının ikisi de buraya düşer (tek doğruluk kaynağı: Stripe).
  // ÖNEMLİ: Buraya YALNIZCA SDK ödemeyi hatasız onayladığında (error yok) gelinir —
  // yani PARA ALINDI. O yüzden sipariş HER DURUMDA oluşturulur; siparişi asla düşürmeyiz.
  // Sunucu doğrulaması yalnızca payment_status'u belirler:
  //   sunucu 'succeeded' → 'paid';  aksi halde (processing / doğrulanamadı) → 'pending'.
  // Apple/Google Pay çoğu zaman önce 'processing' döner ve saniyeler içinde 'succeeded'a
  // geçer; bu yüzden kısa aralıklarla birkaç kez yeniden sorarız.
  const finalizePayment = async (intentId: string) => {
    let verifiedStatus: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await confirmPayment(intentId);
        verifiedStatus = result?.status ?? null; // 'succeeded' | 'processing' | ...
      } catch (verifyErr) {
        // Doğrulama ağ hatasıyla başarısız oldu → durumu bilemiyoruz (pending olarak devam).
        console.warn('Server payment verification failed:', verifyErr);
        verifiedStatus = null;
      }
      // 'processing' ise kısa süre sonra 'succeeded'a döner — birkaç kez dene
      if (verifiedStatus !== 'processing') break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 'paid' YALNIZCA sunucu-doğrulamalı 'succeeded' ile. Diğer tüm durumlarda 'pending',
    // ama sipariş HER HALÜKÂRDA oluşturulur — para alındı, siparişi kaybetmeyiz.
    const orderPaymentStatus: 'paid' | 'pending' = verifiedStatus === 'succeeded' ? 'paid' : 'pending';
    await createOrderAndNavigate(orderPaymentStatus, intentId);
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
      const { error } = await stripeConfirmPayment(clientSecret, { paymentMethodType: 'Card' });

      // error yoksa Stripe ödemeyi kabul etti (Succeeded/Processing) → para alındı.
      // Sipariş oluşturmayı finalizePayment'e bırak; o asla siparişi düşürmez.
      if (error) throw new Error(error.message);

      await finalizePayment(paymentIntentId);
    } catch (error: any) {
      console.error('Payment error:', error);
      Toast.show({ type: 'error', text1: t('payment.failed'), text2: error.message || t('payment.tryAgain'), visibilityTime: 4000, topOffset: 60 });
    } finally {
      setIsLoading(false);
    }
  };

  // Apple Pay cüzdan sayfasında gösterilecek dökümlü kalemler.
  // Apple Pay son kalemi "toplam" (merchant satırı) olarak gösterir; Google Pay yalnızca toplamı kullanır.
  const buildWalletCartItems = () => {
    const immediate = PlatformPay.PaymentType.Immediate;
    const cart: any[] = [{ label: t('cart.subtotal'), amount: tipBase.toFixed(2), paymentType: immediate }];
    if (pointsUsed > 0) {
      cart.push({ label: t('cart.pointsDiscount') || 'Points', amount: (-pointsUsed).toFixed(2), paymentType: immediate });
    }
    if (!isPickup && deliveryFee && deliveryFee > 0) {
      cart.push({ label: t('cart.deliveryFee'), amount: deliveryFee.toFixed(2), paymentType: immediate });
    }
    if (tipAmount > 0) {
      cart.push({ label: isPickup ? t('payment.tipLabelPickup') : t('payment.tipLabel'), amount: tipAmount.toFixed(2), paymentType: immediate });
    }
    // Son satır: toplam (Apple Pay bunu "MerchantName'e öde" satırı olarak gösterir)
    cart.push({ label: 'Riverside Burgers', amount: finalTotal.toFixed(2), paymentType: immediate });
    return cart;
  };

  // Apple Pay (iOS) / Google Pay (Android) ile öde
  const handlePlatformPay = async () => {
    if (!clientSecret || !paymentIntentId) {
      Toast.show({ type: 'error', text1: t('payment.error'), text2: t('payment.initializationError'), visibilityTime: 3000, topOffset: 60 });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await confirmPlatformPayPayment(clientSecret, {
        applePay: {
          cartItems: buildWalletCartItems(),
          merchantCountryCode: 'CA',
          currencyCode: currency,
        },
        googlePay: {
          testEnv: false,
          merchantName: 'Riverside Burgers',
          merchantCountryCode: 'CA',
          currencyCode: currency,
        },
      });

      if (error) {
        // Kullanıcı cüzdan sayfasını kapattı → sessizce çık, hata gösterme.
        if (error.code === 'Canceled') return;
        throw new Error(error.message);
      }

      // error yoksa Apple/Google Pay ödemeyi kabul etti (Succeeded/Processing) → para alındı.
      // Sipariş MUTLAKA oluşturulmalı — bu yüzden status kontrolüyle erken çıkış YOK.
      await finalizePayment(paymentIntentId);
    } catch (error: any) {
      console.error('Platform Pay error:', error);
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
      // Demo mode gerçek ödeme almaz → 'pending' olarak işaretlenir (fişte belli olur).
      await createOrderAndNavigate('pending');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('payment.failed'), text2: error.message || t('payment.tryAgain'), visibilityTime: 4000, topOffset: 60 });
    } finally {
      setIsLoading(false);
    }
  };

  const createOrderAndNavigate = async (
    paymentStatus: 'paid' | 'pending' = 'paid',
    intentId?: string | null
  ) => {
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
      total_amount: finalTotal,
      tip_amount: tipAmount,
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
      payment_status: paymentStatus,
      campaign_id: campaignId,
      discount_amount: campaignDiscount,
    });

    // Stripe ödeme kaydını bu siparişe bağla (payments.order_id).
    // Böylece sipariş ↔ Stripe ödemesi ilişkisi kurulur (doğrulama/eşleştirme).
    if (intentId) {
      try {
        await attachOrderToPayment(intentId, order.id);
      } catch (linkErr) {
        console.warn('attachOrderToPayment failed:', linkErr);
      }
    }

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
      // Her durumda sipariş onay ekranına git. Eskiden pickup ve Uber hatası
      // durumunda doğrudan anasayfaya atılıyordu; müşterinin elinde sipariş
      // numarası bile kalmıyordu. Onay ekranı teslimat takibi varsa "Siparişi
      // Takip Et" butonunu kendisi gösteriyor.
      navigation.replace('OrderConfirmation', { orderId: order.id, justPlaced: true });
    }, 1200);
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

        {/* Ödeme başlatma hatası — ödeme engellenir, tekrar denenebilir */}
        {initError && !isDemoMode && (
          <View style={[styles.demoWarning, { backgroundColor: '#FEECEC', borderColor: '#F5B5B5' }]}>
            <View style={[styles.demoIconWrap, { backgroundColor: '#FBDADA' }]}>
              <Ionicons name="alert-circle" size={18} color="#D32F2F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.demoWarningTitle, { color: '#C62828' }]}>{t('payment.failed')}</Text>
              <Text style={[styles.demoWarningText, { color: '#B71C1C' }]}>{t('payment.initFailed')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setInitError(false); initializePayment(finalTotal); }}
              style={styles.retryBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.retryBtnText}>{t('payment.retry')}</Text>
            </TouchableOpacity>
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
          <Text style={styles.amountValue}>{formatPrice(finalTotal)}</Text>
          <View style={styles.amountDivider} />
          <View style={styles.amountDetails}>
            <View style={styles.amountDetailRow}>
              <Text style={styles.detailLabel}>{t('cart.subtotal')}</Text>
              <Text style={styles.detailValue}>{formatPrice(tipBase)}</Text>
            </View>
            {pointsUsed > 0 && (
              <View style={styles.amountDetailRow}>
                <Text style={styles.detailLabel}>{t('cart.pointsDiscount') || 'Puan indirimi'}</Text>
                <Text style={[styles.detailValue, { color: '#28A745' }]}>-{formatPrice(pointsUsed)}</Text>
              </View>
            )}
            {!isPickup && (
              <View style={styles.amountDetailRow}>
                <Text style={styles.detailLabel}>{t('cart.deliveryFee')}</Text>
                {deliveryFee && deliveryFee > 0 ? (
                  <Text style={styles.detailValue}>{formatPrice(deliveryFee)}</Text>
                ) : (
                  <Text style={[styles.detailValue, { color: '#28A745' }]}>{t('cart.free')}</Text>
                )}
              </View>
            )}
            {tipAmount > 0 && (
              <View style={styles.amountDetailRow}>
                <Text style={styles.detailLabel}>
                  {isPickup ? t('payment.tipLabelPickup') : t('payment.tipLabel')}
                </Text>
                <Text style={styles.detailValue}>{formatPrice(tipAmount)}</Text>
              </View>
            )}
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

        {/* Bahşiş — delivery'de kuryeye, pickup'ta restoran ekibine gider */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>{t('payment.addTip')}</Text>
          <Text style={styles.tipDescription}>
            {isPickup ? t('payment.tipDescriptionPickup') : t('payment.tipDescription')}
          </Text>
          <View style={styles.tipRow}>
            {[5, 10, 15, 20].map((pct) => {
              const active = !isCustomTipActive && selectedTipPercent === pct;
              const amount = (tipBase * pct) / 100;
              return (
                <TouchableOpacity
                  key={pct}
                  activeOpacity={0.7}
                  onPress={() => handleSelectTipPercent(pct)}
                  style={[styles.tipCell, active && styles.tipCellActive]}
                >
                  <Text style={[styles.tipPercent, active && styles.tipTextActive]}>{pct}%</Text>
                  <Text style={[styles.tipAmount, active && styles.tipTextActive]}>
                    {formatPrice(amount)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenCustomTip}
              style={[styles.tipCell, isCustomTipActive && styles.tipCellActive]}
            >
              {isCustomTipActive && customTipAmount > 0 ? (
                <>
                  <Text style={[styles.tipPercent, styles.tipTextActive]}>{t('payment.tipOther')}</Text>
                  <Text style={[styles.tipAmount, styles.tipTextActive]}>
                    {formatPrice(customTipAmount)}
                  </Text>
                </>
              ) : (
                <Text style={styles.tipOtherLabel}>{t('payment.tipOther')}</Text>
              )}
            </TouchableOpacity>
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

        {/* Apple Pay (iOS) / Google Pay (Android) — cihaz destekliyor + ödeme hazırsa */}
        {platformPaySupported && !isDemoMode && !initError && PlatformPayButton && (
          <View style={styles.walletSection}>
            <PlatformPayButton
              type={PlatformPay.ButtonType.Pay}
              appearance={PlatformPay.ButtonStyle.Black}
              onPress={handlePlatformPay}
              disabled={!clientSecret || isLoading}
              style={styles.platformPayButton}
            />
            <View style={styles.walletDivider}>
              <View style={styles.walletDividerLine} />
              <Text style={styles.walletDividerText}>{t('payment.orPayWithCard')}</Text>
              <View style={styles.walletDividerLine} />
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
          <Text style={styles.footerAmount}>{formatPrice(finalTotal)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, (!cardComplete || isLoading || (initError && !isDemoMode)) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!cardComplete || isLoading || (initError && !isDemoMode)}
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
                  {`${t('payment.pay')} ${formatPrice(finalTotal)}`}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Custom Tip Modal */}
      <Modal
        visible={showCustomTipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomTipModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.tipModalBackdrop}
        >
          <View style={styles.tipModalCard}>
            <Text style={styles.tipModalTitle}>{t('payment.tipCustomTitle')}</Text>
            <View style={styles.tipModalInputRow}>
              <Text style={styles.tipModalCurrency}>$</Text>
              <TextInput
                style={styles.tipModalInput}
                placeholder="0.00"
                placeholderTextColor="#B0B0B0"
                keyboardType="decimal-pad"
                value={customTipInput}
                onChangeText={setCustomTipInput}
                autoFocus
              />
            </View>
            <View style={styles.tipModalActions}>
              <TouchableOpacity
                style={[styles.tipModalBtn, styles.tipModalBtnCancel]}
                onPress={() => setShowCustomTipModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.tipModalBtnCancelText}>{t('payment.tipCustomCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipModalBtn, styles.tipModalBtnConfirm]}
                onPress={handleApplyCustomTip}
                activeOpacity={0.85}
              >
                <Text style={styles.tipModalBtnConfirmText}>{t('payment.tipCustomConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  retryBtn: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
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
  // Wallet (Apple Pay / Google Pay)
  walletSection: {
    marginBottom: 14,
  },
  platformPayButton: {
    width: '100%',
    height: 50,
  },
  walletDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  walletDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  walletDividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  // Tip section
  tipCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  tipDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipCell: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tipCellActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  tipPercent: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  tipAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    marginTop: 3,
  },
  tipTextActive: {
    color: Colors.primary,
  },
  tipOtherLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  // Tip Modal
  tipModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  tipModalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 22,
  },
  tipModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  tipModalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 18,
  },
  tipModalCurrency: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginRight: 8,
  },
  tipModalInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  tipModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  tipModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipModalBtnCancel: {
    backgroundColor: '#F2F2F2',
  },
  tipModalBtnCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444',
  },
  tipModalBtnConfirm: {
    backgroundColor: Colors.primary,
  },
  tipModalBtnConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
