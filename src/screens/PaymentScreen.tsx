// Payment Screen - Ödeme Ekranı
// Stripe ile ödeme işlemlerini yönetir (Manages payment operations with Stripe)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { createPaymentIntent, confirmPayment } from '../services/stripeService';
import { createOrder } from '../services/orderService';
import { useCartStore } from '../store/cartStore';
import Toast from 'react-native-toast-message';

interface PaymentScreenProps {
  navigation: any;
  route: any;
}

export default function PaymentScreen({ navigation, route }: PaymentScreenProps) {
  const { t } = useTranslation();
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
  } = route.params;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // DEMO MODE - Stripe API anahtarı yoksa demo modda çalış
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Payment Intent oluştur (Create Payment Intent)
  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      setIsLoading(true);

      // DEMO MODE: Stripe API anahtarı yoksa demo modda çalış
      // (DEMO MODE: If no Stripe API key, run in demo mode)
      const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (!stripeKey || stripeKey.includes('your_publishable_key_here')) {
        console.log('⚠️ DEMO MODE: Stripe API anahtarı bulunamadı, demo modda çalışıyor');
        setIsDemoMode(true);
        setIsLoading(false);
        return;
      }

      const { clientSecret: secret, paymentIntentId: intentId } = await createPaymentIntent(
        totalAmount,
        currency,
        undefined, // Order ID henüz yok (Order ID not yet created)
        {
          pointsUsed,
          itemCount: items.length,
        }
      );

      setClientSecret(secret);
      setPaymentIntentId(intentId);
    } catch (error: any) {
      console.error('❌ Error initializing payment:', error);

      // Hata durumunda demo moda geç
      console.log('⚠️ Stripe API hatası, demo moda geçiliyor');
      setIsDemoMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Ödeme yap (Process payment)
  const handlePayment = async () => {
    // DEMO MODE: Stripe olmadan direkt sipariş oluştur
    if (isDemoMode) {
      return handleDemoPayment();
    }

    if (!cardComplete) {
      Toast.show({
        type: 'error',
        text1: t('payment.error'),
        text2: t('payment.completeCardInfo'),
        visibilityTime: 3000,
        topOffset: 60,
      });
      return;
    }

    if (!clientSecret || !paymentIntentId) {
      Toast.show({
        type: 'error',
        text1: t('payment.error'),
        text2: t('payment.initializationError'),
        visibilityTime: 3000,
        topOffset: 60,
      });
      return;
    }

    try {
      setIsLoading(true);

      // Stripe ile ödemeyi onayla (Confirm payment with Stripe)
      const { error, paymentIntent } = await stripeConfirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'Succeeded') {
        // Ödeme başarılı, backend'i güncelle (Payment succeeded, update backend)
        await confirmPayment(paymentIntentId);

        // Siparişi oluştur (Create order)
        await createOrderAndNavigate();
      }
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      Toast.show({
        type: 'error',
        text1: t('payment.failed'),
        text2: error.message || t('payment.tryAgain'),
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // DEMO MODE: Stripe olmadan sipariş oluştur
  const handleDemoPayment = async () => {
    if (!cardComplete) {
      Toast.show({
        type: 'error',
        text1: t('payment.error'),
        text2: t('payment.completeCardInfo'),
        visibilityTime: 3000,
        topOffset: 60,
      });
      return;
    }

    try {
      setIsLoading(true);

      console.log('🎭 DEMO MODE: Simulating payment...');

      // 2 saniye bekle (ödeme simülasyonu)
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('✅ DEMO MODE: Payment simulation successful');

      // Siparişi oluştur
      await createOrderAndNavigate();

    } catch (error: any) {
      console.error('❌ Demo payment error:', error);
      Toast.show({
        type: 'error',
        text1: t('payment.failed'),
        text2: error.message || t('payment.tryAgain'),
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sipariş oluştur ve yönlendir (Create order and navigate)
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

    console.log('📦 Creating order with items:', orderItems.length);

    const order = await createOrder({
      user_id: user!.id,
      total_amount: totalAmount,
      delivery_address: deliveryAddress,
      phone: phone,
      notes: notes,
      items: orderItems,
      points_used: pointsUsed,
      address_id: addressId,
    });

    console.log('✅ Order created:', order.order_number);

    // Sepeti temizle (Clear cart)
    clearCart();

    // Başarı mesajı (Success message)
    Toast.show({
      type: 'success',
      text1: t('payment.success'),
      text2: t('payment.orderCreated', { orderNumber: order.order_number }),
      visibilityTime: 4000,
      topOffset: 60,
    });

    // Ana ekrana dön (Navigate to home)
    setTimeout(() => {
      navigation.navigate('Main', { screen: 'HomeTab' });
    }, 2000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payment.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* DEMO MODE Uyarısı */}
        {isDemoMode && (
          <View style={styles.demoWarning}>
            <Ionicons name="information-circle" size={24} color="#FF9800" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.demoWarningTitle}>
                🎭 DEMO MODE
              </Text>
              <Text style={styles.demoWarningText}>
                Stripe API anahtarı bulunamadı. Ödeme simüle edilecek.
                {'\n'}Gerçek ödeme için Stripe hesabı oluşturun.
              </Text>
            </View>
          </View>
        )}

        {/* Tutar Bilgisi (Amount Info) */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t('payment.totalAmount')}</Text>
          <Text style={styles.amountValue}>
            {currency === 'CAD' ? '$' : '₺'}{totalAmount.toFixed(2)}
          </Text>
        </View>

        {/* Kart Bilgileri (Card Information) */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>{t('payment.cardInformation')}</Text>

          <CardField
            postalCodeEnabled={false}
            placeholders={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={styles.card}
            style={styles.cardField}
            onCardChange={(cardDetails) => {
              setCardComplete(cardDetails.complete);
            }}
          />

          {isDemoMode && (
            <Text style={styles.demoHint}>
              💡 Demo modda herhangi bir kart bilgisi girebilirsiniz
            </Text>
          )}
        </View>

        {/* Güvenlik Bilgisi (Security Info) */}
        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          <Text style={styles.securityText}>
            {isDemoMode ? '🎭 Demo Mode - Test Ödeme' : t('payment.securePayment')}
          </Text>
        </View>
      </ScrollView>

      {/* Ödeme Butonu (Payment Button) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, (!cardComplete || isLoading) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!cardComplete || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="card" size={20} color={Colors.white} />
              <Text style={styles.payButtonText}>
                {t('payment.pay')} {currency === 'CAD' ? '$' : '₺'}{totalAmount.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl + 20,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    ...Shadows.small,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  amountCard: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  amountLabel: {
    fontSize: FontSizes.md,
    color: Colors.white,
    opacity: 0.9,
    marginBottom: Spacing.xs,
  },
  amountValue: {
    fontSize: FontSizes.xxl + 8,
    fontWeight: 'bold',
    color: Colors.white,
  },
  cardSection: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  card: {
    backgroundColor: Colors.lightGray,
    textColor: Colors.text,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  securityText: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    marginLeft: Spacing.xs,
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    ...Shadows.medium,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md + 4,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  // Demo Mode Styles
  demoWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  demoWarningTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: Spacing.xs,
  },
  demoWarningText: {
    fontSize: FontSizes.sm,
    color: '#E65100',
    lineHeight: 20,
  },
  demoHint: {
    fontSize: FontSizes.sm,
    color: '#FF9800',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});

