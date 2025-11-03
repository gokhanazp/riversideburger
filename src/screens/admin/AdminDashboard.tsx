import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

// Admin Dashboard Ekranı (Admin Dashboard Screen)
const AdminDashboard = ({ navigation }: any) => {
  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalProducts: 0,
    todayOrders: 0,
  });

  // Sayfa yüklendiğinde istatistikleri getir (Fetch stats on page load)
  useEffect(() => {
    fetchStats();
  }, []);

  // İstatistikleri getir (Fetch statistics)
  const fetchStats = async () => {
    try {
      setLoading(true);

      // Toplam sipariş sayısı (Total orders count)
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Bekleyen sipariş sayısı (Pending orders count)
      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Toplam gelir (Total revenue)
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'delivered');

      const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      // Toplam kullanıcı sayısı (Total users count)
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Toplam ürün sayısı (Total products count)
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Bugünkü siparişler (Today's orders)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      setStats({
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue,
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        todayOrders: todayOrders || 0,
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'İstatistikler yüklenirken bir hata oluştu',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Yenileme (Refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  // İstatistik kartı componenti (Stat card component)
  const StatCard = ({
    iconName,
    title,
    value,
    color,
    onPress,
  }: {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    value: string | number;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={iconName} size={28} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={20} color="#999" />}
    </TouchableOpacity>
  );

  // Menü kartı componenti (Menu card component)
  const MenuCard = ({
    iconName,
    title,
    subtitle,
    color,
    onPress,
  }: {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    color: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.menuCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={iconName} size={32} color={color} />
      </View>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* Başlık (Header) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Riverside Burgers Yönetim Paneli</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* İstatistikler (Statistics) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 İstatistikler</Text>
        <View style={styles.statsGrid}>
          <StatCard
            iconName="receipt"
            title="Toplam Sipariş"
            value={stats.totalOrders}
            color="#E63946"
            onPress={() => navigation.navigate('AdminOrders')}
          />
          <StatCard
            iconName="time"
            title="Bekleyen Sipariş"
            value={stats.pendingOrders}
            color="#FF6B35"
            onPress={() => navigation.navigate('AdminOrders', { filter: 'pending' })}
          />
          <StatCard
            iconName="cash"
            title="Toplam Gelir"
            value={`₺${stats.totalRevenue.toFixed(2)}`}
            color="#28A745"
          />
          <StatCard
            iconName="calendar"
            title="Bugünkü Sipariş"
            value={stats.todayOrders}
            color="#007BFF"
          />
          <StatCard
            iconName="people"
            title="Toplam Kullanıcı"
            value={stats.totalUsers}
            color="#6F42C1"
            onPress={() => navigation.navigate('AdminUsers')}
          />
          <StatCard
            iconName="fast-food"
            title="Toplam Ürün"
            value={stats.totalProducts}
            color="#FD7E14"
            onPress={() => navigation.navigate('AdminProducts')}
          />
        </View>
      </View>

      {/* Hızlı Erişim Menüsü (Quick Access Menu) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Hızlı Erişim</Text>
        <View style={styles.menuGrid}>
          <MenuCard
            iconName="receipt-outline"
            title="Siparişler"
            subtitle="Sipariş yönetimi"
            color="#E63946"
            onPress={() => navigation.navigate('AdminOrders')}
          />
          <MenuCard
            iconName="fast-food-outline"
            title="Ürünler"
            subtitle="Ürün yönetimi"
            color="#FF6B35"
            onPress={() => navigation.navigate('AdminProducts')}
          />
          <MenuCard
            iconName="people-outline"
            title="Kullanıcılar"
            subtitle="Kullanıcı listesi"
            color="#6F42C1"
            onPress={() => navigation.navigate('AdminUsers')}
          />
          <MenuCard
            iconName="images-outline"
            title="Banner'lar"
            subtitle="Slider yönetimi"
            color="#007BFF"
            onPress={() => navigation.navigate('AdminBanners')}
          />
          <MenuCard
            iconName="notifications-outline"
            title="Bildirimler"
            subtitle="Bildirim gönder"
            color="#FD7E14"
            onPress={() => navigation.navigate('AdminNotifications')}
          />
          <MenuCard
            iconName="settings-outline"
            title="Ayarlar"
            subtitle="Sistem ayarları"
            color="#28A745"
            onPress={() => navigation.navigate('AdminSettings')}
          />
          <MenuCard
            iconName="stats-chart-outline"
            title="Raporlar"
            subtitle="İstatistikler"
            color="#17A2B8"
            onPress={() => {
              Toast.show({
                type: 'info',
                text1: '📊 Raporlar',
                text2: 'Yakında eklenecek!',
              });
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: Spacing.md,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: Spacing.md,
  },
  statsGrid: {
    gap: Spacing.md,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.small,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#333',
  },
  statTitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  menuIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  menuTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default AdminDashboard;

