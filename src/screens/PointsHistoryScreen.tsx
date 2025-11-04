// Points History Screen - Puan Geçmişi Ekranı
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { PointsHistory } from '../types/database.types';
import { getPointsHistory } from '../services/pointsService';
import Toast from 'react-native-toast-message';
import { Colors } from '../constants/theme';
import { useTranslation } from 'react-i18next';

const PointsHistoryScreen = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getPointsHistory(user.id);
      setHistory(data);
    } catch (error: any) {
      console.error('Error fetching points history:', error);
      Toast.show({
        type: 'error',
        text1: t('pointsHistory.errorTitle'),
        text2: t('pointsHistory.errorMessage'),
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  // Puan tipi ikonu (Points type icon)
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'earned':
        return 'arrow-down-circle';
      case 'used':
        return 'arrow-up-circle';
      case 'expired':
        return 'time-outline';
      case 'admin_adjustment':
        return 'settings-outline';
      default:
        return 'help-circle-outline';
    }
  };

  // Puan tipi rengi (Points type color)
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'earned':
        return '#4CAF50';
      case 'used':
        return '#F44336';
      case 'expired':
        return '#FF9800';
      case 'admin_adjustment':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  // Puan tipi metni (Points type text)
  const getTypeText = (type: string) => {
    switch (type) {
      case 'earned':
        return t('pointsHistory.typeEarned');
      case 'used':
        return t('pointsHistory.typeUsed');
      case 'expired':
        return t('pointsHistory.typeExpired');
      case 'admin_adjustment':
        return t('pointsHistory.typeAdjustment');
      default:
        return type;
    }
  };

  const renderHistoryItem = ({ item }: { item: PointsHistory }) => {
    const isPositive = item.points > 0;
    const color = getTypeColor(item.type);

    return (
      <View style={styles.historyCard}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={getTypeIcon(item.type) as any} size={24} color={color} />
        </View>
        
        <View style={styles.historyInfo}>
          <Text style={styles.historyType}>{getTypeText(item.type)}</Text>
          {item.description && (
            <Text style={styles.historyDescription}>{item.description}</Text>
          )}
          <Text style={styles.historyDate}>
            {new Date(item.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        <View style={styles.pointsContainer}>
          <Text style={[styles.pointsValue, { color }]}>
            {isPositive ? '+' : ''}{item.points.toFixed(2)}
          </Text>
          <Text style={styles.pointsLabel}>{t('pointsHistory.points')}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('pointsHistory.loading')}</Text>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="star-outline" size={80} color="#CCC" />
        <Text style={styles.emptyTitle}>{t('pointsHistory.emptyTitle')}</Text>
        <Text style={styles.emptyText}>
          {t('pointsHistory.emptyMessage')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  historyDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default PointsHistoryScreen;

