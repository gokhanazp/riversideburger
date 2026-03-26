import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import { sendPushNotificationToUsers } from '../../services/notificationService';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// Bildirim tipi
type NotificationType = 'general' | 'promotion' | 'order_status' | 'points_earned';

const AdminNotifications = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  
  // States
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [notificationType, setNotificationType] = useState<NotificationType>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 5;
  
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.notifications.errorLoadingUsers'),
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u.id));
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page
    if (query.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter((user) => {
        const searchLower = query.toLowerCase();
        return (
          user.full_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredUsers(filtered);
    }
  };

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const sendNotification = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.notifications.errorTitleRequired') });
      return;
    }
    if (!body.trim()) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.notifications.errorBodyRequired') });
      return;
    }
    if (selectedUsers.length === 0) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.notifications.errorSelectUsers') });
      return;
    }

    try {
      setSendingNotification(true);
      const notifications = selectedUsers.map((userId) => ({
        user_id: userId,
        title: title.trim(),
        body: body.trim(),
        type: notificationType,
        data: null,
        is_read: false,
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;

      // Seçilen kullanıcılara push notification gönder
      const result = await sendPushNotificationToUsers(
        selectedUsers,
        title.trim(),
        body.trim(),
        { type: notificationType }
      );

      Toast.show({
        type: 'success',
        text1: t('admin.notifications.success'),
        text2: `${selectedUsers.length} ${t('admin.notifications.notificationSent')}` +
          (result.sent < result.total ? ` (${result.sent} push)` : ''),
      });

      setTitle('');
      setBody('');
      setSelectedUsers([]);
      setNotificationType('general');
    } catch (error: any) {
      console.error('Error sending notification:', error);
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.notifications.errorSending') });
    } finally {
      setSendingNotification(false);
    }
  };

  const quickTemplates = [
    {
      type: 'promotion' as NotificationType,
      title: t('admin.notifications.template1Title'),
      body: t('admin.notifications.template1Body'),
      icon: 'pricetag',
      color: '#FF6B35',
    },
    {
      type: 'general' as NotificationType,
      title: t('admin.notifications.template2Title'),
      body: t('admin.notifications.template2Body'),
      icon: 'fast-food',
      color: '#E63946',
    },
    {
      type: 'general' as NotificationType,
      title: t('admin.notifications.template3Title'),
      body: t('admin.notifications.template3Body'),
      icon: 'time',
      color: '#007BFF',
    },
  ];

  const applyTemplate = (template: typeof quickTemplates[0]) => {
    setNotificationType(template.type);
    setTitle(template.title);
    setBody(template.body);
  };

  const UserItem = ({ user, index }: { user: any, index: number }) => {
    const isSelected = selectedUsers.includes(user.id);
    return (
      <TouchableOpacity onPress={() => toggleUserSelection(user.id)} activeOpacity={0.7} style={{ marginBottom: 10 }}>
        <Animated.View entering={FadeInDown.delay(index * 30).springify()} style={[styles.userCard, isSelected && styles.userCardSelected]}>
            <View style={styles.userLeft}>
                <LinearGradient
                    colors={isSelected ? [Colors.primary, Colors.primary + '80'] : ['#E0E0E0', '#F5F5F5']}
                    style={styles.avatar}
                >
                    <Text style={[styles.avatarText, isSelected && { color: '#FFF' }]}>
                        {(user.full_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                </LinearGradient>
                <View>
                    <Text style={[styles.userName, isSelected && { color: Colors.primary, fontWeight: '800' }]}>{user.full_name || t('admin.notifications.unnamedUser')}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                </View>
            </View>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
     return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('admin.loading')}</Text>
        </View>
      );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER SECTION */}
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>Panel</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.screenTitles.sendNotification')}</Text>
        </View>
        
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('admin.screenTitles.sendNotification')}</Text>
            <TouchableOpacity onPress={fetchUsers} style={styles.iconBtn}>
                <Ionicons name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          
          {/* QUICK TEMPLATES */}
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.notifications.quickTemplates')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                  {quickTemplates.map((tpl, i) => (
                      <TouchableOpacity 
                        key={i} 
                        style={[styles.templateCard, { borderBottomColor: tpl.color }]}
                        onPress={() => applyTemplate(tpl)}
                    >
                          <View style={[styles.tpIcon, { backgroundColor: tpl.color + '15' }]}>
                              <Ionicons name={tpl.icon as any} size={20} color={tpl.color} />
                          </View>
                          <Text style={styles.tpTitle} numberOfLines={1}>{tpl.title}</Text>
                          <Text style={styles.tpBody} numberOfLines={2}>{tpl.body}</Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>
          </View>

          {/* NOTIFICATION FORM */}
          <View style={styles.formCard}>
              <Text style={styles.formTitle}>{t('admin.notifications.createNotification')}</Text>
              
              <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('admin.notifications.notificationType')}</Text>
                  <View style={styles.typeRow}>
                      {['general', 'promotion', 'order_status'].map(type => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.typeChip, notificationType === type && styles.typeChipActive]}
                            onPress={() => setNotificationType(type as NotificationType)}
                          >
                              <Text style={[styles.typeText, notificationType === type && styles.typeTextActive]}>
                                  {type === 'general' && t('admin.notifications.typeGeneral')}
                                  {type === 'promotion' && t('admin.notifications.typePromotion')}
                                  {type === 'order_status' && t('admin.notifications.typeOrderStatus')}
                              </Text>
                          </TouchableOpacity>
                      ))}
                  </View>
              </View>

              <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('admin.notifications.labelTitle')}</Text>
                  <TextInput 
                    style={styles.input} 
                    value={title} 
                    onChangeText={setTitle} 
                    placeholder={t('admin.notifications.notificationTitlePlaceholder')}
                    placeholderTextColor="#999"
                  />
              </View>

              <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('admin.notifications.labelBody')}</Text>
                  <TextInput 
                    style={[styles.input, styles.textArea]} 
                    value={body} 
                    onChangeText={setBody} 
                    placeholder={t('admin.notifications.notificationBodyPlaceholder')}
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
              </View>
          </View>

          {/* USER SELECTION */}
          <View style={styles.section}>
              <View style={styles.userHeader}>
                  <Text style={styles.sectionTitle}>
                      {t('admin.notifications.recipients')} <Text style={{color: Colors.primary}}>({selectedUsers.length})</Text>
                  </Text>
                  <TouchableOpacity onPress={toggleAllUsers}>
                      <Text style={styles.selectAllText}>
                          {selectedUsers.length === users.length ? t('admin.notifications.deselectAllButton') : t('admin.notifications.selectAllButton')}
                      </Text>
                  </TouchableOpacity>
              </View>

              <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color="#999" style={{ marginRight: 10 }} />
                  <TextInput 
                    style={{ flex: 1, color: Colors.text, fontSize: 15 }}
                    placeholder={t('admin.notifications.searchUsers')}
                    value={searchQuery}
                    onChangeText={handleSearch}
                  />
              </View>

              <View style={styles.userList}>
                  {paginatedUsers.map((user, idx) => (
                      <UserItem key={user.id} user={user} index={idx} />
                  ))}
                  {filteredUsers.length === 0 && (
                      <Text style={styles.emptyText}>{t('admin.notifications.noUsersFound')}</Text>
                  )}
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                      <View style={styles.paginationRow}>
                          <TouchableOpacity 
                            style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                            onPress={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                              <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? '#CCC' : Colors.primary} />
                          </TouchableOpacity>
                          
                          <Text style={styles.pageInfoText}>
                              {currentPage} / {totalPages}
                          </Text>

                          <TouchableOpacity 
                            style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                            onPress={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                              <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? '#CCC' : Colors.primary} />
                          </TouchableOpacity>
                      </View>
                  )}
              </View>
          </View>

      </ScrollView>

      {/* FLOAT SEND BUTTON */}
      <View style={styles.bottomArea}>
          <TouchableOpacity 
            style={[styles.sendBtn, sendingNotification && { opacity: 0.7 }]} 
            onPress={sendNotification}
            disabled={sendingNotification}
          >
              <LinearGradient colors={[Colors.primary, '#FF6B6B']} style={styles.sendGrad}>
                  {sendingNotification ? (
                      <ActivityIndicator color="#FFF" />
                  ) : (
                      <>
                        <Ionicons name="send" size={20} color="#FFF" style={{marginRight: 8}} />
                        <Text style={styles.sendText}>{t('admin.notifications.sendButton')}</Text>
                      </>
                  )}
              </LinearGradient>
          </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#888' },
  header: { paddingTop: 50, paddingBottom: 25, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15, opacity: 0.8 },
  breadText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: '#FFF', opacity: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 15, letterSpacing: -0.5 },
  templateScroll: { paddingBottom: 10 },
  templateCard: { width: 150, padding: 16, backgroundColor: '#FFF', borderRadius: 20, marginRight: 12, borderBottomWidth: 4, ...Shadows.small },
  tpIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  tpTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  tpBody: { fontSize: 11, color: '#888', lineHeight: 16 },
  formCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 30, ...Shadows.small },
  formTitle: { fontSize: 18, fontWeight: '900', color: Colors.text, marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '800', color: '#AAA', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#F9F9F9', borderRadius: 16, padding: 16, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: '#EEE' },
  textArea: { height: 100, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#EEE' },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: 13, fontWeight: '600', color: '#666' },
  typeTextActive: { color: '#FFF' },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  selectAllText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, height: 50, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  userList: { gap: 0 },
  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EEE' },
  userCardSelected: { borderColor: Colors.primary, backgroundColor: '#FFFBF0' },
  userLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#555' },
  userName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  userEmail: { fontSize: 11, color: '#999' },
  checkbox: { width: 22, height: 22, borderRadius: 8, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 20 },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: '#EEE' },
  sendBtn: { height: 56, borderRadius: 20, ...Shadows.large },
  sendGrad: { flex: 1, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15, gap: 15 },
  pageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  pageBtnDisabled: { backgroundColor: '#F5F5F5', borderColor: '#EEE' },
  pageInfoText: { fontSize: 14, fontWeight: '700', color: Colors.text },
});

export default AdminNotifications;
