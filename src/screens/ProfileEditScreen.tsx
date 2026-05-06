import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { updateUserProfile } from '../services/userService';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/ConfirmModal';
import { deleteAccount } from '../services/authService';

const ProfileEditScreen = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const initials = (user?.full_name || user?.email || '?')
    .split(' ')
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '—';

  const handleSave = async () => {
    if (!user) return;

    if (!fullName.trim()) {
      Toast.show({ type: 'error', text1: t('profileEdit.errorTitle'), text2: t('profileEdit.errorFullName'), topOffset: 60 });
      return;
    }

    if (!phone.trim()) {
      Toast.show({ type: 'error', text1: t('profileEdit.errorTitle'), text2: t('profileEdit.errorPhone'), topOffset: 60 });
      return;
    }

    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      Toast.show({ type: 'error', text1: t('profileEdit.errorTitle'), text2: t('profileEdit.errorPhoneFormat'), topOffset: 60 });
      return;
    }

    try {
      setIsLoading(true);
      const updatedUser = await updateUserProfile(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      setUser(updatedUser);
      Toast.show({ type: 'success', text1: t('profileEdit.successTitle'), text2: t('profileEdit.successMessage'), topOffset: 60 });
      navigation.goBack();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Toast.show({ type: 'error', text1: t('profileEdit.errorTitle'), text2: error.message || t('profileEdit.errorUpdate'), topOffset: 60 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      setShowDeleteModal(false);

      await deleteAccount();
      setUser(null);

      Toast.show({ type: 'success', text1: t('profileEdit.successTitle'), text2: t('profileEdit.deleteAccountSuccess'), topOffset: 60 });

      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error: any) {
      console.error('Account deletion error:', error);
      Toast.show({ type: 'error', text1: 'Hata', text2: error.message || 'Hesap silinirken bir hata oluştu.', topOffset: 60 });
    } finally {
      setIsDeleting(false);
    }
  };

  const isDirty = fullName !== (user?.full_name || '') || phone !== (user?.phone || '');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('navigation.profileEdit') || 'Profil Düzenle'}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Hero */}
          <View style={styles.heroCard}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              </View>
              <View style={styles.avatarBadge}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
            </View>
            <Text style={styles.heroName}>{user?.full_name || t('profileEdit.fullNamePlaceholder')}</Text>
            <Text style={styles.heroEmail}>{user?.email}</Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatChip}>
                <Ionicons name="star" size={12} color="#FFB300" />
                <Text style={styles.heroStatText}>{user?.points ?? 0} {t('profileEdit.pointsLabel') || 'puan'}</Text>
              </View>
              <View style={styles.heroStatChip}>
                <Ionicons name="calendar" size={12} color={Colors.primary} />
                <Text style={styles.heroStatText}>
                  {t('profileEdit.memberSince') || 'Üyelik'} {memberSince}
                </Text>
              </View>
            </View>
          </View>

          {/* Personal Info Card */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderIcon}>
                <Ionicons name="person" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{t('profileEdit.personalInfo') || 'Kişisel Bilgiler'}</Text>
            </View>

            {/* Email - locked */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('profileEdit.email')}</Text>
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={10} color="#999" />
                  <Text style={styles.lockBadgeText}>{t('profileEdit.locked') || 'Sabit'}</Text>
                </View>
              </View>
              <View style={[styles.inputWrap, styles.inputWrapLocked]}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="mail" size={16} color="#999" />
                </View>
                <Text style={styles.lockedText}>{user?.email}</Text>
              </View>
              <Text style={styles.helperText}>{t('profileEdit.emailHelper')}</Text>
            </View>

            {/* Full Name */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  {t('profileEdit.fullName')} <Text style={styles.required}>*</Text>
                </Text>
              </View>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'name' && styles.inputWrapFocused,
                ]}
              >
                <View style={styles.inputIconWrap}>
                  <Ionicons name="person" size={16} color={focusedField === 'name' ? Colors.primary : '#999'} />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('profileEdit.fullNamePlaceholder')}
                  placeholderTextColor="#BBB"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
                {fullName.length > 0 && (
                  <TouchableOpacity onPress={() => setFullName('')} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#CCC" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  {t('profileEdit.phone')} <Text style={styles.required}>*</Text>
                </Text>
              </View>
              <View
                style={[
                  styles.inputWrap,
                  focusedField === 'phone' && styles.inputWrapFocused,
                ]}
              >
                <View style={styles.inputIconWrap}>
                  <Ionicons name="call" size={16} color={focusedField === 'phone' ? Colors.primary : '#999'} />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('profileEdit.phonePlaceholder')}
                  placeholderTextColor="#BBB"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
                {phone.length > 0 && (
                  <TouchableOpacity onPress={() => setPhone('')} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#CCC" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.helperText}>{t('profileEdit.phoneHelper')}</Text>
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.dangerCard}>
            <View style={styles.dangerHeader}>
              <View style={styles.dangerIconWrap}>
                <Ionicons name="warning" size={16} color="#DC3545" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerTitle}>{t('profileEdit.dangerZone') || 'Tehlikeli Bölge'}</Text>
                <Text style={styles.dangerSubtitle}>
                  {t('profileEdit.dangerSubtitle') || 'Bu işlem geri alınamaz'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setShowDeleteModal(true)}
              disabled={isLoading || isDeleting}
              activeOpacity={0.85}
            >
              {isDeleting ? (
                <ActivityIndicator color="#DC3545" size="small" />
              ) : (
                <>
                  <Ionicons name="trash" size={18} color="#DC3545" />
                  <Text style={styles.deleteButtonText}>{t('profileEdit.deleteButton')}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#DC3545" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sticky save footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isDirty || isLoading) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!isDirty || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <View style={styles.saveContent}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.saveButtonText}>{t('profileEdit.saving') || 'Kaydediliyor...'}</Text>
              </View>
            ) : (
              <View style={styles.saveContent}>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>{t('profileEdit.save')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showDeleteModal}
        title={t('profileEdit.deleteModalTitle')}
        message={t('profileEdit.deleteModalMessage')}
        confirmText={t('profileEdit.deleteModalConfirm')}
        cancelText={t('profileEdit.deleteModalCancel')}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Shadows.small,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', letterSpacing: 0.3 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Hero
  heroCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    padding: 4,
    borderRadius: 60,
    backgroundColor: '#FEF2F2',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#28A745',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  heroName: { fontSize: 19, fontWeight: '900', color: '#1A1A1A', letterSpacing: 0.2 },
  heroEmail: { fontSize: 13, color: '#888', fontWeight: '500', marginTop: 4 },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  heroStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  heroStatText: { fontSize: 12, fontWeight: '700', color: '#444' },

  // Section
  section: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  sectionHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', letterSpacing: 0.2 },

  // Field
  field: { marginBottom: 16 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: Colors.primary },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  lockBadgeText: { fontSize: 9, fontWeight: '800', color: '#999', letterSpacing: 0.4 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 54,
  },
  inputWrapFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primary,
  },
  inputWrapLocked: {
    backgroundColor: '#F0F0F0',
  },
  inputIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  lockedText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#888', paddingVertical: 12 },
  clearBtn: { padding: 6 },
  helperText: { fontSize: 11, color: '#999', marginTop: 6, fontWeight: '500', paddingLeft: 4 },

  // Danger
  dangerCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCE4E6',
    ...Shadows.small,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dangerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: { fontSize: 14, fontWeight: '800', color: '#DC3545', letterSpacing: 0.2 },
  dangerSubtitle: { fontSize: 12, color: '#999', marginTop: 2, fontWeight: '500' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCE4E6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deleteButtonText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#DC3545', textAlign: 'center', letterSpacing: 0.2 },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Shadows.large,
  },
  saveButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    paddingVertical: 16,
  },
  saveButtonDisabled: { opacity: 0.35 },
  saveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});

export default ProfileEditScreen;
