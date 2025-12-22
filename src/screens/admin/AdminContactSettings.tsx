import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { clearContactCache } from '../../services/contactService';

// İletişim ayarları tipi (Contact settings type)
interface ContactSettings {
  phone1: string;
  phone2: string;
  email: string;
  address1: string;
  address2: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  footerAbout: string;
  footerCopyright: string;
}

// Admin İletişim Ayarları Ekranı (Admin Contact Settings Screen)
const AdminContactSettings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();

  // Sayfa başlığını ayarla (Set page title)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('admin.contactSettings.title'),
    });
  }, [navigation, t, i18n.language]);

  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ContactSettings>({
    phone1: '',
    phone2: '',
    email: '',
    address1: '',
    address2: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    footerAbout: '',
    footerCopyright: '',
  });
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Input ref'leri (Input refs) - Değerleri tutmak için
  const phone1Ref = useRef<any>(null);
  const phone2Ref = useRef<any>(null);
  const emailRef = useRef<any>(null);
  const address1Ref = useRef<any>(null);
  const address2Ref = useRef<any>(null);
  const facebookRef = useRef<any>(null);
  const instagramRef = useRef<any>(null);
  const whatsappRef = useRef<any>(null);
  const footerAboutRef = useRef<any>(null);
  const footerCopyrightRef = useRef<any>(null);

  // Input değerlerini tutmak için ref'ler (Refs to hold input values)
  const settingsRef = useRef<ContactSettings>({
    phone1: '',
    phone2: '',
    email: '',
    address1: '',
    address2: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    footerAbout: '',
    footerCopyright: '',
  });

  // Input değişiklik handler'ları (Input change handlers)
  const handleInputChange = useCallback((field: keyof ContactSettings, value: string) => {
    settingsRef.current[field] = value;
  }, []);

  // Ayarları getir (Fetch settings)
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching contact settings...');

      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'contact_phone1',
          'contact_phone2',
          'contact_email',
          'contact_address1',
          'contact_address2',
          'social_facebook',
          'social_instagram',
          'social_whatsapp',
          'footer_about',
          'footer_copyright',
        ]);

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Contact settings fetched:', data);

      // Ayarları objeye çevir (Convert settings to object)
      const settingsObj: any = {};
      data?.forEach((item) => {
        const key = item.setting_key
          .replace('contact_', '')
          .replace('social_', '')
          .replace('footer_', '');
        settingsObj[key] = item.setting_value || '';
      });

      const newSettings = {
        phone1: settingsObj.phone1 || '',
        phone2: settingsObj.phone2 || '',
        email: settingsObj.email || '',
        address1: settingsObj.address1 || '',
        address2: settingsObj.address2 || '',
        facebook: settingsObj.facebook || '',
        instagram: settingsObj.instagram || '',
        whatsapp: settingsObj.whatsapp || '',
        footerAbout: settingsObj.about || '',
        footerCopyright: settingsObj.copyright || '',
      };

      setSettings(newSettings);
      settingsRef.current = newSettings;
    } catch (error: any) {
      console.error('Error fetching contact settings:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.contactSettings.errorTitle'),
        text2: t('admin.contactSettings.errorMessage'),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Sayfa yüklendiğinde ayarları getir (Fetch settings on page load)
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Ayarları kaydet (Save settings)
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      console.log('💾 Saving contact settings...');

      // Ref'teki güncel değerleri al (Get current values from ref)
      const currentSettings = settingsRef.current;

      // Her ayarı ayrı ayrı güncelle (Update each setting separately)
      const updates = [
        { key: 'contact_phone1', value: currentSettings.phone1 },
        { key: 'contact_phone2', value: currentSettings.phone2 },
        { key: 'contact_email', value: currentSettings.email },
        { key: 'contact_address1', value: currentSettings.address1 },
        { key: 'contact_address2', value: currentSettings.address2 },
        { key: 'social_facebook', value: currentSettings.facebook },
        { key: 'social_instagram', value: currentSettings.instagram },
        { key: 'social_whatsapp', value: currentSettings.whatsapp },
        { key: 'footer_about', value: currentSettings.footerAbout },
        { key: 'footer_copyright', value: currentSettings.footerCopyright },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(
            {
              setting_key: update.key,
              setting_value: update.value,
            },
            { onConflict: 'setting_key' }
          );

        if (error) throw error;
      }

      console.log('✅ Contact settings saved successfully');

      // Cache'i temizle (Clear cache)
      clearContactCache();

      Toast.show({
        type: 'success',
        text1: t('admin.contactSettings.successTitle'),
        text2: t('admin.contactSettings.successMessage'),
      });

      setShowSaveModal(false);
    } catch (error: any) {
      console.error('Error saving contact settings:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.contactSettings.errorTitle'),
        text2: t('admin.contactSettings.errorMessage'),
      });
    } finally {
      setSaving(false);
    }
  };

  // Yükleniyor ekranı (Loading screen)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  // Ayar kartı componenti (Setting card component)
  const SettingCard = ({
    icon,
    title,
    description,
    children,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.settingCard}>
      <View style={styles.settingHeader}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={24} color={Colors.primary} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.settingContent}>{children}</View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Telefon Numaraları (Phone Numbers) */}
        <SettingCard
          icon="call-outline"
          title={t('admin.contactSettings.phoneNumbers')}
          description={t('admin.contactSettings.phoneNumbersDesc')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.phone1')}</Text>
            <TextInput
              ref={phone1Ref}
              style={styles.input}
              defaultValue={settings.phone1}
              onChangeText={(text) => handleInputChange('phone1', text)}
              placeholder="+1 (416) 850-7026"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => phone2Ref.current?.focus()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.phone2')}</Text>
            <TextInput
              ref={phone2Ref}
              style={styles.input}
              defaultValue={settings.phone2}
              onChangeText={(text) => handleInputChange('phone2', text)}
              placeholder="+1 (416) 935-6600"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>
        </SettingCard>

        {/* E-posta (Email) */}
        <SettingCard
          icon="mail-outline"
          title={t('admin.contactSettings.emailAddress')}
          description={t('admin.contactSettings.emailAddressDesc')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.email')}</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              defaultValue={settings.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="info@riversideburgers.com"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => address1Ref.current?.focus()}
            />
          </View>
        </SettingCard>

        {/* Adresler (Addresses) */}
        <SettingCard
          icon="location-outline"
          title={t('admin.contactSettings.addresses')}
          description={t('admin.contactSettings.addressesDesc')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.address1')}</Text>
            <TextInput
              ref={address1Ref}
              style={[styles.input, styles.textArea]}
              defaultValue={settings.address1}
              onChangeText={(text) => handleInputChange('address1', text)}
              placeholder="688 Queen Street East, Toronto, Ontario"
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={3}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => address2Ref.current?.focus()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.address2')}</Text>
            <TextInput
              ref={address2Ref}
              style={[styles.input, styles.textArea]}
              defaultValue={settings.address2}
              onChangeText={(text) => handleInputChange('address2', text)}
              placeholder="1228 King St W, Toronto, Ontario"
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={3}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => facebookRef.current?.focus()}
            />
          </View>
        </SettingCard>

        {/* Sosyal Medya (Social Media) */}
        <SettingCard
          icon="share-social-outline"
          title={t('admin.contactSettings.socialMedia')}
          description={t('admin.contactSettings.socialMediaDesc')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.facebookUrl')}</Text>
            <TextInput
              ref={facebookRef}
              style={styles.input}
              defaultValue={settings.facebook}
              onChangeText={(text) => handleInputChange('facebook', text)}
              placeholder="https://www.facebook.com/riversideburgers"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => instagramRef.current?.focus()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.instagramUrl')}</Text>
            <TextInput
              ref={instagramRef}
              style={styles.input}
              defaultValue={settings.instagram}
              onChangeText={(text) => handleInputChange('instagram', text)}
              placeholder="https://www.instagram.com/riversideburgers"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => whatsappRef.current?.focus()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.whatsappNumber')}</Text>
            <TextInput
              ref={whatsappRef}
              style={styles.input}
              defaultValue={settings.whatsapp}
              onChangeText={(text) => handleInputChange('whatsapp', text)}
              placeholder="+14168507026"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => footerAboutRef.current?.focus()}
            />
          </View>
        </SettingCard>

        {/* Footer Metinleri (Footer Texts) */}
        <SettingCard
          title={t('admin.contactSettings.footerTexts')}
          description={t('admin.contactSettings.footerTextsDesc')}
          iconName="document-text-outline"
          iconColor="#9C27B0"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.footerAbout')}</Text>
            <TextInput
              ref={footerAboutRef}
              style={[styles.input, styles.textArea]}
              defaultValue={settings.footerAbout}
              onChangeText={(text) => handleInputChange('footerAbout', text)}
              placeholder={t('admin.contactSettings.footerAboutPlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={3}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => footerCopyrightRef.current?.focus()}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('admin.contactSettings.footerCopyright')}</Text>
            <TextInput
              ref={footerCopyrightRef}
              style={styles.input}
              defaultValue={settings.footerCopyright}
              onChangeText={(text) => handleInputChange('footerCopyright', text)}
              placeholder={t('admin.contactSettings.footerCopyrightPlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              returnKeyType="done"
            />
          </View>
        </SettingCard>

        {/* Boşluk (Spacing) */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Kaydet butonu (Save button) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => setShowSaveModal(true)}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.saveButtonText}>{t('admin.contactSettings.saveButton')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Kaydetme Onay Modal (Save Confirmation Modal) */}
      <ConfirmModal
        visible={showSaveModal}
        title={t('admin.contactSettings.saveConfirmTitle')}
        message={t('admin.contactSettings.saveConfirmMessage')}
        confirmText={t('common.save')}
        cancelText={t('common.cancel')}
        onConfirm={handleSaveSettings}
        onCancel={() => setShowSaveModal(false)}
        type="success"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  scrollView: {
    flex: 1,
  },
  settingCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.medium,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  settingContent: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.medium,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.medium,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default AdminContactSettings;

