import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { User } from '../../types/database.types';
import Toast from 'react-native-toast-message';

// Admin Kullanıcılar Ekranı (Admin Users Screen)
const AdminUsers = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterRole, setFilterRole] = useState<'all' | 'customer' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 5;

  // Sayfa başlığını ayarla (Set page title)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('admin.screenTitles.userManagement'),
    });
  }, [navigation, t, i18n.language]);

  // Sayfa yüklendiğinde kullanıcıları getir (Fetch users on page load)
  useEffect(() => {
    fetchUsers();
  }, [filterRole]);

  // Kullanıcıları getir (Fetch users)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching users, filter:', filterRole);

      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // Rol filtresi (Role filter)
      if (filterRole !== 'all') {
        query = query.eq('role', filterRole);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Users fetched:', data?.length || 0);
      setUsers(data || []);
      applyFilters(data || [], searchQuery);
    } catch (error: any) {
      console.error('❌ Error fetching users:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.users.errorLoading'),
      });
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtreleri uygula (Apply filters)
  const applyFilters = (userList: User[], query: string) => {
    let filtered = userList;

    // Arama filtresi (Search filter)
    if (query.trim() !== '') {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter((user) => {
        return (
          user.full_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.phone?.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page
  };

  // Kullanıcı arama (Search users)
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(users, query);
  };

  // Yenileme (Refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Kullanıcı detaylarını göster (Show user details)
  const handleShowDetails = async (user: User) => {
    try {
      // Kullanıcının sipariş sayısını ve toplam harcamasını getir
      // (Fetch user's order count and total spending)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('user_id', user.id);

      if (error) throw error;

      const orderCount = orders?.length || 0;
      const totalSpent = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
      const deliveredCount = orders?.filter((o) => o.status === 'delivered').length || 0;

      setSelectedUser({
        ...user,
        orderCount,
        totalSpent,
        deliveredCount,
      } as any);

      setShowDetailsModal(true);
    } catch (error: any) {
      console.error('Error fetching user details:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.users.errorLoadingDetails'),
      });
    }
  };

  // Kullanıcı kartı (User card)
  const UserCard = ({ user }: { user: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleShowDetails(user)}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        <Ionicons name="person" size={32} color={Colors.white} />
      </View>

      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>{user.full_name || t('admin.users.anonymousUser')}</Text>
          {user.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FFD700" />
              <Text style={styles.adminBadgeText}>{t('admin.users.admin')}</Text>
            </View>
          )}
        </View>

        <View style={styles.userDetail}>
          <Ionicons name="mail" size={14} color="#666" />
          <Text style={styles.userDetailText}>{user.email}</Text>
        </View>

        {user.phone && (
          <View style={styles.userDetail}>
            <Ionicons name="call" size={14} color="#666" />
            <Text style={styles.userDetailText}>{user.phone}</Text>
          </View>
        )}

        <View style={styles.userFooter}>
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.pointsText}>{user.points?.toFixed(2) || '0.00'} Puan</Text>
          </View>
          <Text style={styles.joinDate}>
            {new Date(user.created_at).toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  // Filtre butonları (Filter buttons)
  const FilterButton = ({ role, label }: { role: 'all' | 'customer' | 'admin'; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filterRole === role && styles.filterButtonActive]}
      onPress={() => setFilterRole(role)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterButtonText, filterRole === role && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Pagination hesaplamaları (Pagination calculations)
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Sayfa değiştir (Change page)
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.users.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtreler (Filters) */}
      <View style={styles.filtersContainer}>
        <FilterButton role="all" label={t('admin.users.filterAll')} />
        <FilterButton role="customer" label={t('admin.users.filterCustomers')} />
        <FilterButton role="admin" label={t('admin.users.filterAdmins')} />
      </View>

      {/* Arama ve Liste (Search and List) */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Arama Kutusu (Search Box) */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.users.searchUsers')}
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Kullanıcı Sayısı (User Count) */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {filteredUsers.length} {t('admin.users.usersFound')}
          </Text>
        </View>

        {/* Kullanıcı Listesi (User List) */}
        {paginatedUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? t('admin.users.noUsersFound') : t('admin.users.noUsers')}
            </Text>
          </View>
        ) : (
          <>
            {paginatedUsers.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}

            {/* Pagination (Sayfalama) */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                  onPress={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? Colors.textSecondary : Colors.primary} />
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    {t('admin.users.page')} {currentPage} / {totalPages}
                  </Text>
                  <Text style={styles.paginationSubtext}>
                    {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} {t('admin.users.of')} {filteredUsers.length}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                  onPress={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? Colors.textSecondary : Colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Kullanıcı detay modal (User details modal) */}
      {showDetailsModal && selectedUser && (
        <Modal visible={showDetailsModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.detailsModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('admin.users.userDetails')}</Text>
                <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Avatar */}
                <View style={styles.modalAvatar}>
                  <Ionicons name="person" size={48} color={Colors.white} />
                </View>

                {/* Kullanıcı Bilgileri (User Info) */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('admin.users.name')}</Text>
                  <Text style={styles.detailValue}>{selectedUser.full_name || '-'}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('admin.users.email')}</Text>
                  <Text style={styles.detailValue}>{selectedUser.email}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('admin.users.phone')}</Text>
                  <Text style={styles.detailValue}>{selectedUser.phone || '-'}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('admin.users.role')}</Text>
                  <View style={styles.roleBadge}>
                    <Ionicons
                      name={selectedUser.role === 'admin' ? 'shield-checkmark' : 'person'}
                      size={16}
                      color={selectedUser.role === 'admin' ? '#FFD700' : Colors.primary}
                    />
                    <Text style={styles.roleText}>
                      {selectedUser.role === 'admin' ? t('admin.users.admin') : t('admin.users.customer')}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Toplam Puan</Text>
                  <Text style={styles.detailValue}>{selectedUser.points?.toFixed(2) || '0.00'} Puan</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('admin.users.createdAt')}</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedUser.created_at).toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {/* İstatistikler (Statistics) */}
                <Text style={styles.statsTitle}>📊 Sipariş İstatistikleri</Text>

                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{(selectedUser as any).orderCount || 0}</Text>
                    <Text style={styles.statLabel}>Toplam Sipariş</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{(selectedUser as any).deliveredCount || 0}</Text>
                    <Text style={styles.statLabel}>Tamamlanan</Text>
                  </View>
                  <View style={[styles.statBox, { width: '100%' }]}>
                    <Text style={[styles.statValue, { color: Colors.primary }]}>
                      ₺{((selectedUser as any).totalSpent || 0).toFixed(2)}
                    </Text>
                    <Text style={styles.statLabel}>Toplam Harcama</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  filtersContainer: {
    flexDirection: 'row',
    padding: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: Colors.white,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  filterButtonTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  countContainer: {
    marginBottom: Spacing.md,
  },
  countText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  userName: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: '#333',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FFD70020',
  },
  adminBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  userDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  userDetailText: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FFD70020',
  },
  pointsText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  joinDate: {
    fontSize: FontSizes.xs,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: '#999',
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  detailsModal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: Spacing.lg,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  detailSection: {
    marginBottom: Spacing.md,
  },
  detailLabel: {
    fontSize: FontSizes.sm,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: FontSizes.md,
    color: '#333',
    fontWeight: '500',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F0F0F0',
  },
  roleText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: '#333',
  },
  statsTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: '#666',
    marginTop: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    ...Shadows.small,
  },
  paginationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  paginationButtonDisabled: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  paginationInfo: {
    alignItems: 'center',
    flex: 1,
  },
  paginationText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  paginationSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});

export default AdminUsers;

