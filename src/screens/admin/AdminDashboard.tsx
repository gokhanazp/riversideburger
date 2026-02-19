import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import { formatPrice } from '../../services/currencyService';

const { width } = Dimensions.get('window');

// Admin Dashboard Ekranı (Admin Dashboard Screen) - Elite Redesign
const AdminDashboard = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalProducts: 0,
    todayOrders: 0,
    pendingReviews: 0,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      const { count: pendingOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const { data: revenueData } = await supabase.from('orders').select('total_amount').eq('status', 'delivered');
      const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
      const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
      const { count: pendingReviews } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('is_approved', false).eq('is_rejected', false);

      setStats({
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue,
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        todayOrders: todayOrders || 0,
        pendingReviews: pendingReviews || 0,
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.errorLoadingStats') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  // Modern Stat Card - Bento Style
  const StatCard = ({ icon, title, value, color, onPress, index, wide = false }: any) => (
    <Animated.View 
        entering={FadeInDown.delay(index * 100).springify()}
        style={[styles.statBox, wide ? styles.statBoxWide : styles.statBoxSmall]}
    >
      <TouchableOpacity 
        style={styles.statBoxTouch} 
        onPress={onPress} 
        activeOpacity={0.8}
        disabled={!onPress}
      >
        <View style={[styles.statIconCircle, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.statTextGroup}>
            <Text style={styles.statCardValue} numberOfLines={1}>{value}</Text>
            <Text style={styles.statCardTitle}>{title}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // Modern Action Card
  const ActionCard = ({ icon, title, color, onPress, index }: any) => (
    <Animated.View entering={FadeInUp.delay(500 + index * 50).springify()} style={styles.actionItem}>
        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
            <LinearGradient
                colors={['#fff', '#f9f9f9']}
                style={styles.actionGradient}
            >
                <View style={[styles.actionIconBox, { backgroundColor: color + '10' }]}>
                    <Ionicons name={icon} size={24} color={color} />
                </View>
                <Text style={styles.actionTitle} numberOfLines={2}>{title}</Text>
            </LinearGradient>
        </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.white} />}
      >
        {/* Elite Header */}
        <LinearGradient
            colors={['#1a1a1a', '#333333']}
            style={styles.header}
        >
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
                    <Ionicons name="arrow-back" size={24} color={Colors.white} />
                </TouchableOpacity>
                <View style={styles.headerTitleUnit}>
                    <Text style={styles.welcomeText}>Welcome Master,</Text>
                    <Text style={styles.dashboardTitle}>{t('admin.dashboardTitle')}</Text>
                </View>
                <TouchableOpacity style={styles.avatarCircle} onPress={onRefresh}>
                    <Ionicons name="refresh" size={20} color={Colors.white} />
                </TouchableOpacity>
            </View>

            {/* Top Metrics Row */}
            <View style={styles.revenueRow}>
                <View>
                    <Text style={styles.revLabel}>{t('admin.totalRevenue')}</Text>
                    <Text style={styles.revValue}>{formatPrice(stats.totalRevenue)}</Text>
                </View>
                <View style={styles.revBadge}>
                    <Ionicons name="trending-up" size={14} color={Colors.success} />
                    <Text style={styles.revBadgeText}>+12%</Text>
                </View>
            </View>
        </LinearGradient>

        <View style={styles.content}>
            {/* Highlights - Bento Grid */}
            <Text style={styles.sectionHeader}>{t('admin.statisticsTitle')}</Text>
            <View style={styles.bentoGrid}>
                <StatCard
                    index={1}
                    icon="receipt"
                    title={t('admin.totalOrders')}
                    value={stats.totalOrders}
                    color="#E63946"
                    wide
                    onPress={() => navigation.navigate('AdminOrders')}
                />
                <StatCard
                    index={2}
                    icon="time"
                    title={t('admin.pendingOrders')}
                    value={stats.pendingOrders}
                    color="#FF6B35"
                    onPress={() => navigation.navigate('AdminOrders', { filter: 'pending' })}
                />
                <StatCard
                    index={3}
                    icon="star"
                    title={t('admin.pendingReviews')}
                    value={stats.pendingReviews}
                    color="#FFD700"
                    onPress={() => navigation.navigate('AdminReviews')}
                />
                <StatCard
                    index={4}
                    icon="calendar"
                    title={t('admin.todayOrders')}
                    value={stats.todayOrders}
                    color="#007BFF"
                />
                <StatCard
                    index={5}
                    icon="people"
                    title={t('admin.totalUsers')}
                    value={stats.totalUsers}
                    color="#6F42C1"
                    onPress={() => navigation.navigate('AdminUsers')}
                />
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionHeader}>{t('admin.quickActions')}</Text>
            <View style={styles.actionsGrid}>
                <ActionCard index={0} icon="receipt-outline" title={t('admin.orders.title')} color="#E63946" onPress={() => navigation.navigate('AdminOrders')} />
                <ActionCard index={1} icon="fast-food-outline" title={t('admin.products.title')} color="#FF6B35" onPress={() => navigation.navigate('AdminProducts')} />
                <ActionCard index={2} icon="albums-outline" title={t('admin.categories.title')} color="#28A745" onPress={() => navigation.navigate('AdminCategories')} />
                <ActionCard index={3} icon="restaurant-outline" title={t('admin.extraIngredients')} color="#9C27B0" onPress={() => navigation.navigate('AdminProductOptions')} />
                <ActionCard index={4} icon="images-outline" title={t('admin.banners.title')} color="#007BFF" onPress={() => navigation.navigate('AdminBanners')} />
                <ActionCard index={5} icon="notifications-outline" title={t('admin.notifications.title')} color="#FD7E14" onPress={() => navigation.navigate('AdminNotifications')} />
                <ActionCard index={6} icon="star-outline" title={t('admin.reviews.title')} color="#FFD700" onPress={() => navigation.navigate('AdminReviews')} />
                <ActionCard index={7} icon="call-outline" title={t('admin.contactSettingsMenu')} color="#17A2B8" onPress={() => navigation.navigate('AdminContactSettings')} />
                <ActionCard index={8} icon="settings-outline" title={t('admin.settingsMenu')} color="#6c757d" onPress={() => navigation.navigate('AdminSettings')} />
                <ActionCard index={9} icon="people-outline" title={t('admin.users.title')} color="#6F42C1" onPress={() => navigation.navigate('AdminUsers')} />
            </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Shadows.medium,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleUnit: {
    flex: 1,
    marginHorizontal: 16,
  },
  welcomeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dashboardTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    marginTop: 2,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  revLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  revValue: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.white,
    marginTop: 4,
  },
  revBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 8,
  },
  revBadgeText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    ...Shadows.small,
    overflow: 'hidden',
  },
  statBoxWide: {
    width: '100%',
    padding: 20,
  },
  statBoxSmall: {
    width: (width - 52) / 2,
    padding: 16,
  },
  statBoxTouch: {
    width: '100%',
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statTextGroup: {},
  statCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  statCardTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionItem: {
    width: (width - 60) / 3,
  },
  actionBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Shadows.small,
  },
  actionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#444',
    textAlign: 'center',
  },
});

export default AdminDashboard;


