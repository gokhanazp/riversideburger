import React, { useState, useEffect } from 'react';
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
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import { sendLocalNotification } from '../../services/notificationService';

// Bildirim tipi (Notification type)
type NotificationType = 'general' | 'promotion' | 'order_status' | 'points_earned';

// Admin Notifications Ekranı (Admin Notifications Screen)
const AdminNotifications = ({ navigation }: any) => {
  // State'ler (States)
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [notificationType, setNotificationType] = useState<NotificationType>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

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
    } catch (error: any) {
      console.error('Error fetching users:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Kullanıcılar yüklenirken bir hata oluştu',
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

  // Bildirim gönder (Send notification)
  const sendNotification = async () => {
    // Validasyon (Validation)
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen bildirim başlığı girin',
      });
      return;
    }

    if (!body.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen bildirim içeriği girin',
      });
      return;
    }

    if (selectedUsers.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen en az bir kullanıcı seçin',
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
        text1: 'Başarılı',
        text2: `${selectedUsers.length} kullanıcıya bildirim gönderildi`,
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
        text1: 'Hata',
        text2: 'Bildirim gönderilirken bir hata oluştu',
      });
    } finally {
      setSendingNotification(false);
    }
  };

  // Hızlı bildirim şablonları (Quick notification templates)
  const quickTemplates = [
    {
      type: 'promotion' as NotificationType,
      title: '🎉 Özel İndirim!',
      body: 'Bugün tüm ürünlerde %20 indirim! Kaçırmayın!',
      icon: 'pricetag',
      color: '#FF6B35',
    },
    {
      type: 'general' as NotificationType,
      title: '🍔 Yeni Menü!',
      body: 'Yeni burger menümüz çıktı! Hemen deneyin!',
      icon: 'fast-food',
      color: '#E63946',
    },
    {
      type: 'general' as NotificationType,
      title: '⏰ Açılış Saatleri',
      body: 'Hafta sonu özel saatlerimiz: 10:00 - 23:00',
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
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Hızlı Şablonlar (Quick Templates) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Hızlı Şablonlar</Text>
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
        <Text style={styles.sectionTitle}>📝 Bildirim Oluştur</Text>

        {/* Bildirim Tipi (Notification Type) */}
        <Text style={styles.label}>Bildirim Tipi</Text>
        <View style={styles.typeContainer}>
          {(['general', 'promotion', 'order_status', 'points_earned'] as NotificationType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeButton, notificationType === type && styles.typeButtonActive]}
              onPress={() => setNotificationType(type)}
            >
              <Text style={[styles.typeButtonText, notificationType === type && styles.typeButtonTextActive]}>
                {type === 'general' && '📢 Genel'}
                {type === 'promotion' && '🏷️ Kampanya'}
                {type === 'order_status' && '🧾 Sipariş'}
                {type === 'points_earned' && '🎁 Puan'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Başlık (Title) */}
        <Text style={styles.label}>Başlık</Text>
        <TextInput
          style={styles.input}
          placeholder="Bildirim başlığı..."
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* İçerik (Body) */}
        <Text style={styles.label}>İçerik</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Bildirim içeriği..."
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
          <Text style={styles.sectionTitle}>👥 Alıcılar ({selectedUsers.length}/{users.length})</Text>
          <TouchableOpacity onPress={toggleAllUsers} style={styles.selectAllButton}>
            <Text style={styles.selectAllText}>
              {selectedUsers.length === users.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
            </Text>
          </TouchableOpacity>
        </View>

        {users.map((user) => (
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
                <Text style={styles.userName}>{user.full_name || 'İsimsiz Kullanıcı'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
            <Text style={styles.sendButtonText}>Bildirim Gönder</Text>
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

