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
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { User } from '../../types/database.types';
import Toast from 'react-native-toast-message';
import { formatPrice } from '../../services/currencyService';

const { width } = Dimensions.get('window');

const AdminUsers = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterRole, setFilterRole] = useState<'all' | 'customer' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchUsers();
  }, [filterRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase.from('users').select('*').order('created_at', { ascending: false });
      if (filterRole !== 'all') query = query.eq('role', filterRole);
      
      const { data, error } = await query;
      if (error) throw error;
      
      setUsers(data || []);
      applyFilters(data || [], searchQuery);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.users.errorLoading') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (userList: User[], query: string) => {
    let filtered = userList;
    if (query.trim() !== '') {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter((user) => 
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phone?.toLowerCase().includes(searchLower)
      );
    }
    setFilteredUsers(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(users, query);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleShowDetails = async (user: User) => {
    try {
      const { data: orders, error } = await supabase.from('orders').select('total_amount, status').eq('user_id', user.id);
      if (error) throw error;

      const orderCount = orders?.length || 0;
      const totalSpent = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
      const deliveredCount = orders?.filter((o) => o.status === 'delivered').length || 0;

      setSelectedUser({ ...user, orderCount, totalSpent, deliveredCount });
      setShowDetailsModal(true);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.users.errorLoadingDetails') });
    }
  };

  const UserCard = ({ user, index }: { user: User, index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      layout={Layout.springify()}
      style={styles.userCard}
    >
      <TouchableOpacity onPress={() => handleShowDetails(user)} activeOpacity={0.8} style={styles.cardInner}>
        <View style={styles.userAvatar}>
          <LinearGradient colors={[Colors.primary, '#FF4D4D']} style={styles.avatarGradient}>
            <Text style={styles.avatarInitial}>{(user.full_name || 'U').charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        </View>

        <View style={styles.userCoreInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>{user.full_name || t('admin.users.anonymousUser')}</Text>
            {user.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={10} color={Colors.white} />
                <Text style={styles.adminBadgeText}>{t('admin.users.roleAdmin')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          
          <View style={styles.userMeta}>
            <View style={styles.metaBadge}>
                <Ionicons name="star" size={10} color="#FFD700" />
                <Text style={styles.metaBadgeText}>{user.points?.toFixed(0) || '0'} {t('common.points')}</Text>
            </View>
            <View style={styles.metaBadge}>
                <Ionicons name="calendar-outline" size={10} color="#888" />
                <Text style={[styles.metaBadgeText, { color: '#888' }]}>
                    {new Date(user.created_at).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'short' }).toUpperCase()}
                </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardAction}>
            <Ionicons name="chevron-forward" size={20} color="#DDD" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const StatIcon = ({ icon, label, val, color }: any) => (
    <View style={styles.headerStatItem}>
        <View style={[styles.statIconCircle, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={16} color={color} />
        </View>
        <View>
            <Text style={styles.statVal}>{val}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.topSection}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>Panel</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.users.title')}</Text>
        </View>

        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('admin.users.title')}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerStatsRow}>
            <StatIcon icon="people" label={t('admin.users.filterAll')} val={users.length} color="#4DACFF" />
            <StatIcon icon="medal" label={t('admin.users.filterAdmins')} val={users.filter(u => u.role === 'admin').length} color="#FFD700" />
        </View>

        <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
            <TextInput 
                style={styles.searchInput}
                placeholder={t('admin.users.searchUsers')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
            )}
        </View>
      </LinearGradient>

      <View style={styles.filterRow}>
            {(['all', 'customer', 'admin'] as const).map((role) => (
                <TouchableOpacity 
                    key={role}
                    style={[styles.filterChip, filterRole === role && styles.filterChipActive]}
                    onPress={() => setFilterRole(role)}
                >
                    <Text style={[styles.filterChipText, filterRole === role && styles.filterChipTextActive]}>
                        {t(`admin.users.filter${role.charAt(0).toUpperCase() + role.slice(1)}${role === 'all' ? '' : 's'}`)}
                    </Text>
                </TouchableOpacity>
            ))}
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={({ item, index }) => <UserCard user={item} index={index} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Ionicons name="people-outline" size={64} color="#DDD" />
            <Text style={styles.emptyText}>{t('admin.users.noUsersFound')}</Text>
          </View>
        }
      />

      {/* Details Bottom Sheet Style Modal */}
      <Modal visible={showDetailsModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
              <View style={styles.detailsSheet}>
                  <View style={styles.sheetHeader}>
                      <Text style={styles.sheetTitle}>{t('admin.users.userDetails')}</Text>
                      <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={styles.closeBtn}>
                          <Ionicons name="close" size={24} color="#333" />
                      </TouchableOpacity>
                  </View>

                  {selectedUser && (
                    <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                        <View style={styles.profileHeader}>
                            <View style={styles.mainAvatar}>
                                <LinearGradient colors={[Colors.primary, '#FF4D4D']} style={styles.mainAvatarGrad}>
                                    <Text style={styles.mainAvatarText}>{(selectedUser.full_name || 'U').charAt(0).toUpperCase()}</Text>
                                </LinearGradient>
                            </View>
                            <Text style={styles.profileName}>{selectedUser.full_name || t('admin.users.anonymousUser')}</Text>
                            <View style={styles.profileRoleBox}>
                                <Ionicons name={selectedUser.role === 'admin' ? 'shield-checkmark' : 'person'} size={14} color={Colors.primary} />
                                <Text style={styles.profileRoleText}>{selectedUser.role.toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>{t('admin.users.email')}</Text>
                                <Text style={styles.infoVal}>{selectedUser.email}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>{t('admin.users.phone')}</Text>
                                <Text style={styles.infoVal}>{selectedUser.phone || '-'}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>{t('admin.users.customerPoints')}</Text>
                                <View style={styles.pointsBig}>
                                    <Ionicons name="star" size={16} color="#FFD700" />
                                    <Text style={styles.pointsBigVal}>{selectedUser.points?.toFixed(2) || '0.00'}</Text>
                                </View>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>{t('admin.users.createdAt')}</Text>
                                <Text style={styles.infoVal}>
                                    {new Date(selectedUser.created_at).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>{t('admin.users.orderSummary')}</Text>
                        <View style={styles.statsSummary}>
                            <View style={styles.summaryBox}>
                                <Text style={styles.summaryVal}>{selectedUser.orderCount}</Text>
                                <Text style={styles.summaryLabel}>{t('admin.users.orderCount')}</Text>
                            </View>
                            <View style={styles.summaryBox}>
                                <Text style={styles.summaryVal}>{selectedUser.deliveredCount}</Text>
                                <Text style={styles.summaryLabel}>{t('admin.users.deliveredCount')}</Text>
                            </View>
                            <View style={[styles.summaryBox, { width: '100%', marginTop: 12 }]}>
                                <Text style={[styles.summaryVal, { color: Colors.primary }]}>{formatPrice(selectedUser.totalSpent)}</Text>
                                <Text style={styles.summaryLabel}>{t('admin.users.totalSpent')}</Text>
                            </View>
                        </View>
                        <View style={{ height: 50 }} />
                    </ScrollView>
                  )}
              </View>
          </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topSection: { paddingTop: 50, paddingBottom: 24, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, opacity: 0.8 },
  breadText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: Colors.white, opacity: 1 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.white },
  headerStatsRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  headerStatItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900', color: Colors.white },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase' },
  searchBarWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 18, paddingHorizontal: 16, height: 50 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: Colors.white, fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, gap: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#EEE' },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#666' },
  filterChipTextActive: { color: Colors.white },
  listContainer: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  userCard: { backgroundColor: Colors.white, borderRadius: 24, marginBottom: 16, ...Shadows.small },
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  userAvatar: { width: 52, height: 52, borderRadius: 20, overflow: 'hidden' },
  avatarGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: Colors.white, fontSize: 20, fontWeight: '900' },
  userCoreInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  userName: { fontSize: 17, fontWeight: '900', color: Colors.text, letterSpacing: -0.3 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  adminBadgeText: { fontSize: 9, fontWeight: '900', color: Colors.white, letterSpacing: 0.5 },
  userEmail: { fontSize: 13, color: Colors.textMuted, marginBottom: 10, fontWeight: '500' },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F6F8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  metaBadgeText: { fontSize: 10, fontWeight: '800', color: '#B8860B', letterSpacing: 0.3 },
  cardAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  emptyView: { alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: '#CCC', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  detailsSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 36, borderTopRightRadius: 36, height: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: Colors.text },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  sheetScroll: { padding: 24 },
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  mainAvatar: { width: 90, height: 90, borderRadius: 32, overflow: 'hidden', marginBottom: 16, ...Shadows.medium },
  mainAvatarGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  mainAvatarText: { color: Colors.white, fontSize: 36, fontWeight: '900' },
  profileName: { fontSize: 24, fontWeight: '900', color: Colors.text, marginBottom: 8 },
  profileRoleBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  profileRoleText: { color: Colors.primary, fontWeight: '800', fontSize: 11 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 32 },
  infoItem: { width: '46%' },
  infoLabel: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  infoVal: { fontSize: 14, fontWeight: '700', color: '#444' },
  pointsBig: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointsBigVal: { fontSize: 18, fontWeight: '900', color: '#B8860B' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: Colors.text, marginBottom: 16 },
  statsSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryBox: { width: '48%', backgroundColor: '#F8F9FA', padding: 20, borderRadius: 24 },
  summaryVal: { fontSize: 24, fontWeight: '900', color: Colors.text },
  summaryLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', marginTop: 4 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default AdminUsers;
