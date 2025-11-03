// Notifications Screen - Bildirimler ekranı
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/styles';
import Toast from 'react-native-toast-message';

// Bildirim tipi (Notification type)
interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  order_id?: string;
  data?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bildirimleri yükle (Load notifications)
  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
    } catch (error: any) {
      console.error('Bildirimler yüklenemedi:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Bildirimler yüklenemedi',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Bildirimi okundu olarak işaretle (Mark notification as read)
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      // Yerel state'i güncelle (Update local state)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch (error: any) {
      console.error('Bildirim güncellenemedi:', error);
    }
  };

  // Tüm bildirimleri okundu olarak işaretle (Mark all as read)
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Yerel state'i güncelle (Update local state)
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );

      Toast.show({
        type: 'success',
        text1: 'Başarılı',
        text2: 'Tüm bildirimler okundu olarak işaretlendi',
      });
    } catch (error: any) {
      console.error('Bildirimler güncellenemedi:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Bildirimler güncellenemedi',
      });
    }
  };

  // Bildirime tıklandığında (On notification press)
  const handleNotificationPress = (notification: Notification) => {
    // Okunmadıysa okundu olarak işaretle (Mark as read if unread)
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Bildirim tipine göre yönlendir (Navigate based on notification type)
    if (notification.type === 'order_status' && notification.order_id) {
      navigation.navigate('OrderHistory');
    } else if (notification.type === 'points_earned') {
      navigation.navigate('Profile');
    } else if (notification.type === 'promotion') {
      navigation.navigate('Menu');
    }
  };

  // Yenileme (Refresh)
  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  // İlk yükleme (Initial load)
  useEffect(() => {
    loadNotifications();
  }, [user]);

  // Bildirim ikonu (Notification icon)
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_status':
        return 'receipt-outline';
      case 'points_earned':
        return 'gift-outline';
      case 'promotion':
        return 'pricetag-outline';
      case 'new_order_admin':
        return 'notifications-outline';
      default:
        return 'information-circle-outline';
    }
  };

  // Bildirim rengi (Notification color)
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order_status':
        return Colors.primary;
      case 'points_earned':
        return Colors.accent;
      case 'promotion':
        return '#FF6B35';
      case 'new_order_admin':
        return '#4CAF50';
      default:
        return Colors.textSecondary;
    }
  };

  // Zaman formatla (Format time)
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  // Bildirim kartı (Notification card)
  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
        <Ionicons name={getNotificationIcon(item.type) as any} size={24} color={getNotificationColor(item.type)} />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  // Yükleniyor (Loading)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
      </View>
    );
  }

  // Boş durum (Empty state)
  if (notifications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={80} color={Colors.textSecondary} />
        <Text style={styles.emptyTitle}>Henüz bildirim yok</Text>
        <Text style={styles.emptyText}>Siparişleriniz ve kampanyalar hakkında bildirimler burada görünecek</Text>
      </View>
    );
  }

  // Okunmamış bildirim sayısı (Unread count)
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      {unreadCount > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerText}>{unreadCount} okunmamış bildirim</Text>
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Tümünü Okundu İşaretle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bildirimler listesi (Notifications list) */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  markAllButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  markAllText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  notificationBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  notificationTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

