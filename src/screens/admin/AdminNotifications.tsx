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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import { sendLocalNotification } from '../../services/notificationService';

// Bildirim tipi (Notification type)
type NotificationType = 'general' | 'promotion' | 'order_status' | 'points_earned';

// Admin Notifications Ekranı (Admin Notifications Screen)
const AdminNotifications = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  // State'ler (States)
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

  // Sayfa başlığını ayarla (Set page title)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('admin.screenTitles.sendNotification'),
    });
  }, [navigation, t, i18n.language]);

  // Kullanıcıları getir (Fetch users)
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

  // Kullanıcı seçimi (Toggle user selection)
  const toggleUserSelection = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  // Tüm kullanıcıları seç/kaldır (Select/deselect all users)
  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u.id));
    }
  };

  // Kullanıcı arama (Search users)
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search

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

  // Bildirim gönder (Send notification)
  const sendNotification = async () => {
    // Validasyon (Validation)
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.notifications.errorTitleRequired'),
      });
      return;
    }

    if (!body.trim()) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.notifications.errorBodyRequired'),
      });
      return;
    }

    if (selectedUsers.length === 0) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.notifications.errorSelectUsers'),
      });
      return;
    }

    try {
      setSendingNotification(true);

      // Her seçili kullanıcı için bildirim oluştur (Create notification for each selected user)
      const notifications = selectedUsers.map((userId) => ({
        user_id: userId,
        title: title.trim(),
        body: body.trim(),
        type: notificationType,
        data: null,
        is_read: false,
      }));

      // Supabase'e kaydet (Save to Supabase)
      const { error } = await supabase.from('notifications').insert(notifications);

      if (error) throw error;

      // Yerel bildirim gönder (sadece mobil cihazlarda) (Send local notification - mobile only)
      if (Platform.OS !== 'web') {
        await sendLocalNotification(title.trim(), body.trim());
      }

      Toast.show({
        type: 'success',
        text1: t('admin.notifications.success'),
        text2: `${selectedUsers.length} ${t('admin.notifications.notificationSent')}`,
      });

      // Formu temizle (Clear form)
      setTitle('');
      setBody('');
      setSelectedUsers([]);
      setNotificationType('general');
    } catch (error: any) {
      console.error('Error sending notification:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.notifications.errorSending'),
      });
    } finally {
      setSendingNotification(false);
    }
  };

  // Hızlı bildirim şablonları (Quick notification templates)
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.notifications.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Hızlı Şablonlar (Quick Templates) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.notifications.quickTemplates')}</Text>
        <View style={styles.templatesContainer}>
          {quickTemplates.map((template, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.templateCard, { borderColor: template.color }]}
              onPress={() => applyTemplate(template)}
              activeOpacity={0.7}
            >
              <Ionicons name={template.icon as any} size={24} color={template.color} />
              <Text style={styles.templateTitle}>{template.title}</Text>
              <Text style={styles.templateBody} numberOfLines={2}>
                {template.body}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bildirim Formu (Notification Form) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.notifications.createNotification')}</Text>

        {/* Bildirim Tipi (Notification Type) */}
        <Text style={styles.label}>{t('admin.notifications.notificationType')}</Text>
        <View style={styles.typeContainer}>
          {(['general', 'promotion', 'order_status', 'points_earned'] as NotificationType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeButton, notificationType === type && styles.typeButtonActive]}
              onPress={() => setNotificationType(type)}
            >
              <Text style={[styles.typeButtonText, notificationType === type && styles.typeButtonTextActive]}>
                {type === 'general' && t('admin.notifications.typeGeneral')}
                {type === 'promotion' && t('admin.notifications.typePromotion')}
                {type === 'order_status' && t('admin.notifications.typeOrderStatus')}
                {type === 'points_earned' && t('admin.notifications.typePointsEarned')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Başlık (Title) */}
        <Text style={styles.label}>{t('admin.notifications.labelTitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('admin.notifications.notificationTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* İçerik (Body) */}
        <Text style={styles.label}>{t('admin.notifications.labelBody')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('admin.notifications.notificationBodyPlaceholder')}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          maxLength={500}
        />
      </View>

      {/* Kullanıcı Seçimi (User Selection) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('admin.notifications.recipients')} ({selectedUsers.length}/{users.length})</Text>
          <TouchableOpacity onPress={toggleAllUsers} style={styles.selectAllButton}>
            <Text style={styles.selectAllText}>
              {selectedUsers.length === users.length ? t('admin.notifications.deselectAllButton') : t('admin.notifications.selectAllButton')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Arama Kutusu (Search Box) */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.notifications.searchUsers')}
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

        {/* Kullanıcı Listesi (User List) */}
        {paginatedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyStateText}>
              {searchQuery ? t('admin.notifications.noUsersFound') : t('admin.notifications.noUsers')}
            </Text>
          </View>
        ) : (
          <>
            {paginatedUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userCard}
                onPress={() => toggleUserSelection(user.id)}
                activeOpacity={0.7}
              >
                <View style={styles.userInfo}>
                  <Ionicons
                    name={selectedUsers.includes(user.id) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={selectedUsers.includes(user.id) ? Colors.primary : Colors.textSecondary}
                  />
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.full_name || t('admin.notifications.unnamedUser')}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                </View>
              </TouchableOpacity>
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
                    {t('admin.notifications.page')} {currentPage} / {totalPages}
                  </Text>
                  <Text style={styles.paginationSubtext}>
                    {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} {t('admin.notifications.of')} {filteredUsers.length}
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
      </View>

      {/* Gönder Butonu (Send Button) */}
      <TouchableOpacity
        style={[styles.sendButton, sendingNotification && styles.sendButtonDisabled]}
        onPress={sendNotification}
        disabled={sendingNotification}
        activeOpacity={0.7}
      >
        {sendingNotification ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#FFF" />
            <Text style={styles.sendButtonText}>{t('admin.notifications.sendButton')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  templatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  templateCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
    ...Shadows.small,
  },
  templateTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  templateBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  typeButtonTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectAllButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  selectAllText: {
    color: '#FFF',
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  userCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  userName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  emptyStateText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
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
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    marginLeft: Spacing.sm,
  },
});

export default AdminNotifications;

