import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { getUserAddresses, deleteAddress, setDefaultAddress } from '../services/addressService';
import { Address } from '../types/database.types';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../components/ConfirmModal';

// Adres listesi ekranı - Canada Format (Address list screen - Canada Format)
const AddressListScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  // State'ler (States)
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  // Adresleri yükle (Load addresses)
  const loadAddresses = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getUserAddresses(user.id);
      setAddresses(data);
    } catch (error) {
      console.error('Error loading addresses:', error);
      Toast.show({
        type: 'error',
        text1: t('address.error'),
        text2: t('address.loadError'),
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // Yenile (Refresh)
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAddresses();
  };

  // Varsayılan adres yap (Set as default)
  const handleSetDefault = async (address: Address) => {
    if (!user || address.is_default) return;

    try {
      await setDefaultAddress(address.id, user.id);
      Toast.show({
        type: 'success',
        text1: '✅ ' + t('address.setDefaultSuccess'),
        text2: t('address.setDefaultSuccess'),
      });
      loadAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      Toast.show({
        type: 'error',
        text1: t('address.error'),
        text2: t('address.setDefaultError'),
      });
    }
  };

  // Adres sil (Delete address)
  const handleDeleteAddress = async () => {
    if (!addressToDelete) return;

    try {
      await deleteAddress(addressToDelete.id);
      Toast.show({
        type: 'success',
        text1: '✅ ' + t('address.deleteSuccess'),
        text2: t('address.deleteSuccess'),
      });
      setShowDeleteModal(false);
      setAddressToDelete(null);
      loadAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      Toast.show({
        type: 'error',
        text1: t('address.error'),
        text2: t('address.deleteError'),
      });
    }
  };

  // Adres kartı render (Render address card)
  const renderAddressCard = ({ item }: { item: Address }) => {
    const getTitleIcon = (title: string) => {
      switch (title.toLowerCase()) {
        case 'home':
          return 'home';
        case 'work':
          return 'briefcase';
        default:
          return 'location';
      }
    };

    // Canada formatında adres oluştur (Build address in Canada format)
    const fullAddress = `${item.street_number} ${item.street_name}${
      item.unit_number ? `, ${item.unit_number}` : ''
    }\n${item.city}, ${item.province} ${item.postal_code}`;

    return (
      <View style={styles.addressCard}>
        {/* Başlık ve Varsayılan Badge (Title and Default Badge) */}
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Ionicons name={getTitleIcon(item.title)} size={20} color={Colors.primary} />
            <Text style={styles.addressTitle}>{item.title}</Text>
          </View>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.defaultBadgeText}>{t('address.default')}</Text>
            </View>
          )}
        </View>

        {/* İletişim Bilgileri (Contact Info) */}
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.full_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{fullAddress}</Text>
          </View>
          {item.delivery_instructions && (
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={[styles.infoText, { fontStyle: 'italic', color: '#888' }]}>
                "{item.delivery_instructions}"
              </Text>
            </View>
          )}
        </View>

        {/* Aksiyon Butonları (Action Buttons) */}
        <View style={styles.cardActions}>
          {!item.is_default && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleSetDefault(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="star-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionButtonText}>{t('address.setDefault')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddressEdit', { addressId: item.id })}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionButtonText}>{t('address.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => {
              setAddressToDelete(item);
              setShowDeleteModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#DC3545" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>{t('address.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Boş liste (Empty list)
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={80} color="#CCC" />
      <Text style={styles.emptyTitle}>{t('address.noAddresses')}</Text>
      <Text style={styles.emptyText}>{t('address.noAddressesMessage')}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('address.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={addresses}
        renderItem={renderAddressCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          addresses.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Yeni Adres Ekle Butonu (Add New Address Button) */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddressEdit', { addressId: null })}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
        <Text style={styles.addButtonText}>{t('address.addNew')}</Text>
      </TouchableOpacity>

      {/* Silme Onay Modal'ı (Delete Confirmation Modal) */}
      <ConfirmModal
        visible={showDeleteModal}
        title={t('address.deleteTitle')}
        message={`${t('address.deleteMessage')}\n\n${
          addressToDelete
            ? `${addressToDelete.street_number} ${addressToDelete.street_name}, ${addressToDelete.city}`
            : ''
        }`}
        confirmText={t('address.deleteConfirm')}
        cancelText={t('address.deleteCancel')}
        onConfirm={handleDeleteAddress}
        onCancel={() => {
          setShowDeleteModal(false);
          setAddressToDelete(null);
        }}
        confirmButtonColor="#DC3545"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  addressCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  defaultBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: '#F59E0B',
  },
  cardContent: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#666',
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F8F9FA',
    gap: 4,
  },
  actionButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#DC3545',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#999',
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: '#BBB',
    marginTop: Spacing.xs,
  },
  addButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: 8,
    ...Shadows.large,
  },
  addButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default AddressListScreen;
