// Kuponlarım — müşteriye ATANMIŞ kuponlar.
//
// Herkese açık kupon kodları burada LİSTELENMEZ. RLS onları kimseye
// göstermiyor: listelenebilir olsalardı kod, pazarlama yerine tablo okunarak
// keşfedilirdi. Müşteri o kodları sepetteki alana elle giriyor.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { getMyCoupons, MyCoupon } from '../services/couponService';
import { getCampaignName, getCampaignSummary } from '../services/campaignService';
import { formatPrice } from '../services/currencyService';
import { Colors } from '../constants/theme';

const MyCouponsScreen = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [coupons, setCoupons] = useState<MyCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setCoupons([]);
      setLoading(false);
      return;
    }
    try {
      setCoupons(await getMyCoupons(user.id));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Kupon başka bir siparişte tükenmiş olabilir — ekrana her dönüşte tazele.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: MyCoupon }) => {
    const c = item.campaign;
    const remaining =
      c.per_customer_limit != null ? Math.max(0, c.per_customer_limit - item.usedCount) : null;

    return (
      <View style={[styles.card, !item.usable && styles.cardSpent]}>
        <View style={styles.cardHeader}>
          <View style={styles.codeChip}>
            <Ionicons name="pricetag" size={14} color={Colors.primary} />
            <Text style={styles.codeText}>{c.code}</Text>
          </View>
          {!item.usable && <Text style={styles.spentText}>{t('coupon.usedUp')}</Text>}
        </View>

        <Text style={styles.name}>{getCampaignName(c, i18n.language)}</Text>
        <Text style={styles.summary}>{getCampaignSummary(c, i18n.language)}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color="#888" />
          <Text style={styles.metaText}>
            {c.ends_at
              ? t('coupon.expiresOn', { date: new Date(c.ends_at).toLocaleDateString(i18n.language) })
              : t('coupon.noExpiry')}
          </Text>
        </View>

        {Number(c.min_order_amount) > 0 && (
          <View style={styles.metaRow}>
            <Ionicons name="cart-outline" size={13} color="#888" />
            <Text style={styles.metaText}>
              {t('coupon.minOrder', { amount: formatPrice(Number(c.min_order_amount)) })}
            </Text>
          </View>
        )}

        {remaining != null && (
          <View style={styles.metaRow}>
            <Ionicons name="repeat-outline" size={13} color="#888" />
            <Text style={styles.metaText}>{t('coupon.usesLeft', { count: remaining })}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={coupons.length === 0 ? styles.emptyWrap : styles.listContent}
      data={coupons}
      keyExtractor={(item) => item.campaign.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          colors={[Colors.primary]}
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyCircle}>
            <Ionicons name="pricetags-outline" size={56} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('coupon.myCouponsEmpty')}</Text>
          <Text style={styles.emptyDesc}>{t('coupon.myCouponsEmptyDesc')}</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyWrap: { flexGrow: 1 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDEEF2',
  },
  cardSpent: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  codeText: { fontSize: 14, fontWeight: '800', color: Colors.primary, letterSpacing: 1.5 },
  spentText: { fontSize: 12, fontWeight: '700', color: '#999' },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  summary: { fontSize: 13, fontWeight: '600', color: '#28A745', marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 12, color: '#888', fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});

export default MyCouponsScreen;
