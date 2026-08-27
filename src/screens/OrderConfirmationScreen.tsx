// Sipariş onay ekranı (Order confirmation screen)
//
// Sipariş verildikten sonra müşteriye hiçbir özet gösterilmiyordu: PaymentScreen
// yalnızca bir toast gösterip anasayfaya atıyordu. Teslimat siparişlerinde Uber
// dispatch başarılıysa OrderTracking'e gidiliyordu, ama PICKUP siparişlerinde
// (ki çoğunluk onlar) müşterinin elinde sipariş numarası bile kalmıyordu.
//
// RootStackParamList'te OrderConfirmation rotası zaten tanımlıydı fakat ekran hiç
// yazılmamıştı — bu dosya o eksiği kapatıyor.
//
// Tutar dökümü admin fişiyle AYNI hesaplamayı (orderBreakdown) kullanıyor;
// müşteriye ve mutfağa farklı sayı göstermek en kötü sonuç olurdu.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors, Shadows } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../services/currencyService';
import { buildOrderBreakdown } from '../services/orderBreakdown';
import { Order } from '../types/database.types';

const OrderConfirmationScreen = ({ navigation, route }: any) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const orderId: string = route?.params?.orderId;
  // Ödemeden hemen sonra kutlama başlığı; sipariş geçmişinden açıldığında
  // sadece "Sipariş özeti" — eski bir sipariş için "Siparişiniz alındı!" demek yanlış olur.
  const justPlaced: boolean = route?.params?.justPlaced === true;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, order_items(*, product:products(name, image_url)), order_item_customizations(*), campaign:campaigns(name_tr, name_en)'
        )
        .eq('id', orderId)
        .single();
      if (error) throw error;
      setOrder(data as Order);
    } catch (e) {
      console.log('[OrderConfirmation] sipariş yüklenemedi:', e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const goHome = () => navigation.navigate('Main', { screen: 'HomeTab' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Sipariş çekilemese bile müşteriyi boş ekranda bırakma: sipariş OLUŞTU,
  // sadece detayını gösteremiyoruz.
  if (failed || !order) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={72} color="#28A745" />
        <Text style={[styles.heading, { color: '#1A1A1A' }]}>
          {justPlaced ? t('orderConfirmation.heading') : t('orderConfirmation.summaryHeading')}
        </Text>
        <Text style={styles.failedText}>{t('orderConfirmation.loadError')}</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
          <Text style={styles.secondaryBtnText}>{t('orderConfirmation.backHome')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPickup = order.delivery_method === 'pickup';
  const campaign: any = (order as any).campaign;
  const campaignName = campaign
    ? (i18n.language === 'tr' ? campaign.name_tr : campaign.name_en) || campaign.name_en
    : null;
  const breakdown = buildOrderBreakdown(order, campaignName);
  const customizations: any[] = (order as any).order_item_customizations ?? [];

  const sumLabel = (key: string) => {
    switch (key) {
      case 'subtotal': return t('admin.orders.sumSubtotal');
      case 'extras': return t('admin.orders.sumExtras');
      case 'discount': return t('admin.orders.sumDiscount');
      case 'pointsUsed': return t('admin.orders.sumPoints');
      case 'deliveryFee': return t('admin.orders.sumDelivery');
      case 'tax': return t('admin.orders.sumTax');
      case 'tip': return t('admin.orders.sumTip');
      default: return key;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={['#1F8A46', '#28A745']} style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <Animated.View entering={FadeInDown.springify()} style={styles.heroInner}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={38} color="#1F8A46" />
          </View>
          <Text style={styles.heading}>
            {justPlaced ? t('orderConfirmation.heading') : t('orderConfirmation.summaryHeading')}
          </Text>
          {justPlaced && (
            <Text style={styles.subheading}>{t('orderConfirmation.subheading')}</Text>
          )}
          <View style={styles.orderNoBox}>
            <Text style={styles.orderNoLabel}>{t('orderConfirmation.orderNumber')}</Text>
            <Text style={styles.orderNoValue}>#{order.order_number}</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {/* Teslimat şekli */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={isPickup ? 'storefront' : 'bicycle'} size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>
              {isPickup ? t('orderConfirmation.methodPickup') : t('orderConfirmation.methodDelivery')}
            </Text>
          </View>
          {isPickup ? (
            <Text style={styles.cardText}>{t('orderConfirmation.pickupInfo')}</Text>
          ) : (
            <>
              <Text style={styles.cardLabel}>{t('orderConfirmation.deliveryTo')}</Text>
              <Text style={styles.cardText}>{order.delivery_address}</Text>
            </>
          )}
          {!!order.phone && (
            <>
              <Text style={[styles.cardLabel, { marginTop: 10 }]}>{t('orderConfirmation.contactPhone')}</Text>
              <Text style={styles.cardText}>{order.phone}</Text>
            </>
          )}
        </View>

        {/* Sipariş içeriği */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="fast-food" size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>{t('orderConfirmation.items')}</Text>
          </View>
          {(order.order_items ?? []).map((item: any, idx: number) => {
            const itemCustoms = customizations.filter((c) => c.product_id === item.product_id);
            return (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyText}>{item.quantity}x</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.product?.name}</Text>
                  {itemCustoms.map((c, i) => (
                    <Text key={i} style={styles.itemCustom}>
                      • {i18n.language === 'en' ? c.option_name_en || c.option_name : c.option_name}
                    </Text>
                  ))}
                </View>
                <Text style={styles.itemPrice}>{formatPrice(item.subtotal)}</Text>
              </View>
            );
          })}
        </View>

        {/* Tutar dökümü — admin fişiyle aynı hesap */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>{t('admin.orders.sumTitle')}</Text>
          </View>
          {breakdown.lines.map((row, i) => (
            <View key={i} style={styles.sumRow}>
              <Text style={[styles.sumLabel, row.informational && styles.sumInfo]}>
                {sumLabel(row.key)}
                {row.key === 'discount' && row.note ? ` (${row.note})` : ''}
              </Text>
              <Text
                style={[
                  styles.sumVal,
                  row.informational && styles.sumInfo,
                  row.negative && styles.sumNegative,
                ]}
              >
                {row.informational ? '' : row.negative ? '-' : ''}
                {formatPrice(row.amount)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('admin.orders.sumTotal')}</Text>
            <Text style={styles.totalVal}>{formatPrice(order.total_amount)}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.cardLabel}>{t('orderConfirmation.paymentStatus')}</Text>
            <View
              style={[
                styles.payBadge,
                { backgroundColor: order.payment_status === 'paid' ? '#28A74515' : '#FFC10720' },
              ]}
            >
              <Ionicons
                name={order.payment_status === 'paid' ? 'checkmark-circle' : 'time-outline'}
                size={13}
                color={order.payment_status === 'paid' ? '#28A745' : '#B8860B'}
              />
              <Text
                style={[
                  styles.payText,
                  { color: order.payment_status === 'paid' ? '#28A745' : '#B8860B' },
                ]}
              >
                {order.payment_status === 'paid'
                  ? t('orderConfirmation.paid')
                  : t('orderConfirmation.unpaid')}
              </Text>
            </View>
          </View>
        </View>

        {!!order.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>{t('orderConfirmation.notes')}</Text>
            </View>
            <Text style={styles.cardText}>{order.notes}</Text>
          </View>
        )}

        {!!order.points_earned && order.points_earned > 0 && (
          <View style={styles.pointsBox}>
            <Ionicons name="star" size={16} color="#B8860B" />
            <Text style={styles.pointsText}>
              {t('orderConfirmation.pointsEarned')}: {order.points_earned.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Aksiyonlar */}
        {!isPickup && !!order.uber_tracking_url && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.replace('OrderTracking', { orderId: order.id })}
          >
            <Ionicons name="navigate" size={18} color="#FFF" />
            <Text style={styles.primaryBtnText}>{t('orderConfirmation.trackOrder')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('OrderHistory')}>
          <Text style={styles.secondaryBtnText}>{t('orderConfirmation.myOrders')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={goHome}>
          <Text style={styles.ghostBtnText}>{t('orderConfirmation.backHome')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F6F7F9' },
  hero: { paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroInner: { alignItems: 'center', paddingHorizontal: 24 },
  checkCircle: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  heading: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  subheading: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  orderNoBox: {
    marginTop: 16, backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
  },
  orderNoLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  orderNoValue: { fontSize: 19, color: '#FFF', fontWeight: '900', marginTop: 2 },
  body: { padding: 16, gap: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, ...Shadows.small },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardLabel: { fontSize: 11, color: '#999', fontWeight: '700', textTransform: 'uppercase' },
  cardText: { fontSize: 14, color: '#333', lineHeight: 20, marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  qtyBox: { backgroundColor: Colors.primary + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  qtyText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  itemName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  itemCustom: { fontSize: 12, color: '#777', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  sumLabel: { flex: 1, fontSize: 13, color: '#444', marginRight: 8 },
  sumVal: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  sumInfo: { fontSize: 12, color: '#999', fontStyle: 'italic', paddingLeft: 12 },
  sumNegative: { color: '#28A745' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEE',
  },
  totalLabel: { fontSize: 14, fontWeight: '900', color: '#1A1A1A' },
  totalVal: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  payBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  payText: { fontSize: 12, fontWeight: '800' },
  pointsBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', borderRadius: 14, padding: 14,
  },
  pointsText: { flex: 1, fontSize: 13, color: '#8A6D00', fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 15, marginTop: 4,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 15,
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: Colors.primary, marginTop: 4,
  },
  secondaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  ghostBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  ghostBtnText: { color: '#777', fontSize: 14, fontWeight: '700' },
  failedText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 10, marginBottom: 20 },
});

export default OrderConfirmationScreen;
