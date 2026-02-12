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
  // About Us
  aboutTitleTr: string;
  aboutTitleEn: string;
  aboutDescTr: string;
  aboutDescEn: string;
  aboutImage: string;
  // Why Riverside
  whyTitleTr: string;
  whyTitleEn: string;
  whyFeature1TitleTr: string;
  whyFeature1TitleEn: string;
  whyFeature1DescTr: string;
  whyFeature1DescEn: string;
  whyFeature2TitleTr: string;
  whyFeature2TitleEn: string;
  whyFeature2DescTr: string;
  whyFeature2DescEn: string;
  whyFeature3TitleTr: string;
  whyFeature3TitleEn: string;
  whyFeature3DescTr: string;
  whyFeature3DescEn: string;
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
    // Defaults
    aboutTitleTr: '',
    aboutTitleEn: '',
    aboutDescTr: '',
    aboutDescEn: '',
    aboutImage: '',
    whyTitleTr: '',
    whyTitleEn: '',
    whyFeature1TitleTr: '',
    whyFeature1TitleEn: '',
    whyFeature1DescTr: '',
    whyFeature1DescEn: '',
    whyFeature2TitleTr: '',
    whyFeature2TitleEn: '',
    whyFeature2DescTr: '',
    whyFeature2DescEn: '',
    whyFeature3TitleTr: '',
    whyFeature3TitleEn: '',
    whyFeature3DescTr: '',
    whyFeature3DescEn: '',
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
    aboutTitleTr: '',
    aboutTitleEn: '',
    aboutDescTr: '',
    aboutDescEn: '',
    aboutImage: '',
    whyTitleTr: '',
    whyTitleEn: '',
    whyFeature1TitleTr: '',
    whyFeature1TitleEn: '',
    whyFeature1DescTr: '',
    whyFeature1DescEn: '',
    whyFeature2TitleTr: '',
    whyFeature2TitleEn: '',
    whyFeature2DescTr: '',
    whyFeature2DescEn: '',
    whyFeature3TitleTr: '',
    whyFeature3TitleEn: '',
    whyFeature3DescTr: '',
    whyFeature3DescEn: '',
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
          // New Fields
          'home_about_title_tr',
          'home_about_title_en',
          'home_about_desc_tr',
          'home_about_desc_en',
          'home_about_image',
          'home_why_title_tr',
          'home_why_title_en',
          'home_why_f1_title_tr',
          'home_why_f1_title_en',
          'home_why_f1_desc_tr',
          'home_why_f1_desc_en',
          'home_why_f2_title_tr',
          'home_why_f2_title_en',
          'home_why_f2_desc_tr',
          'home_why_f2_desc_en',
          'home_why_f3_title_tr',
          'home_why_f3_title_en',
          'home_why_f3_desc_tr',
          'home_why_f3_desc_en',
        ]);

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Contact settings fetched:', data);

      // Ayarları objeye çevir (Convert settings to object)
      const settingsObj: any = {};
      data?.forEach((item) => {
        const key = item.setting_key;
        settingsObj[key] = item.setting_value || '';
      });

      const newSettings: ContactSettings = {
        phone1: settingsObj['contact_phone1'] || '',
        phone2: settingsObj['contact_phone2'] || '',
        email: settingsObj['contact_email'] || '',
        address1: settingsObj['contact_address1'] || '',
        address2: settingsObj['contact_address2'] || '',
        facebook: settingsObj['social_facebook'] || '',
        instagram: settingsObj['social_instagram'] || '',
        whatsapp: settingsObj['social_whatsapp'] || '',
        footerAbout: settingsObj['footer_about'] || '',
        footerCopyright: settingsObj['footer_copyright'] || '',
        
        aboutTitleTr: settingsObj['home_about_title_tr'] || '',
        aboutTitleEn: settingsObj['home_about_title_en'] || '',
        aboutDescTr: settingsObj['home_about_desc_tr'] || '',
        aboutDescEn: settingsObj['home_about_desc_en'] || '',
        aboutImage: settingsObj['home_about_image'] || '',
        
        whyTitleTr: settingsObj['home_why_title_tr'] || '',
        whyTitleEn: settingsObj['home_why_title_en'] || '',
        
        whyFeature1TitleTr: settingsObj['home_why_f1_title_tr'] || '',
        whyFeature1TitleEn: settingsObj['home_why_f1_title_en'] || '',
        whyFeature1DescTr: settingsObj['home_why_f1_desc_tr'] || '',
        whyFeature1DescEn: settingsObj['home_why_f1_desc_en'] || '',
        
        whyFeature2TitleTr: settingsObj['home_why_f2_title_tr'] || '',
        whyFeature2TitleEn: settingsObj['home_why_f2_title_en'] || '',
        whyFeature2DescTr: settingsObj['home_why_f2_desc_tr'] || '',
        whyFeature2DescEn: settingsObj['home_why_f2_desc_en'] || '',
        
        whyFeature3TitleTr: settingsObj['home_why_f3_title_tr'] || '',
        whyFeature3TitleEn: settingsObj['home_why_f3_title_en'] || '',
        whyFeature3DescTr: settingsObj['home_why_f3_desc_tr'] || '',
        whyFeature3DescEn: settingsObj['home_why_f3_desc_en'] || '',
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
        
        { key: 'home_about_title_tr', value: currentSettings.aboutTitleTr },
        { key: 'home_about_title_en', value: currentSettings.aboutTitleEn },
        { key: 'home_about_desc_tr', value: currentSettings.aboutDescTr },
        { key: 'home_about_desc_en', value: currentSettings.aboutDescEn },
        { key: 'home_about_image', value: currentSettings.aboutImage },
        
        { key: 'home_why_title_tr', value: currentSettings.whyTitleTr },
        { key: 'home_why_title_en', value: currentSettings.whyTitleEn },
        
        { key: 'home_why_f1_title_tr', value: currentSettings.whyFeature1TitleTr },
        { key: 'home_why_f1_title_en', value: currentSettings.whyFeature1TitleEn },
        { key: 'home_why_f1_desc_tr', value: currentSettings.whyFeature1DescTr },
        { key: 'home_why_f1_desc_en', value: currentSettings.whyFeature1DescEn },
        
        { key: 'home_why_f2_title_tr', value: currentSettings.whyFeature2TitleTr },
        { key: 'home_why_f2_title_en', value: currentSettings.whyFeature2TitleEn },
        { key: 'home_why_f2_desc_tr', value: currentSettings.whyFeature2DescTr },
        { key: 'home_why_f2_desc_en', value: currentSettings.whyFeature2DescEn },
        
        { key: 'home_why_f3_title_tr', value: currentSettings.whyFeature3TitleTr },
        { key: 'home_why_f3_title_en', value: currentSettings.whyFeature3TitleEn },
        { key: 'home_why_f3_desc_tr', value: currentSettings.whyFeature3DescTr },
        { key: 'home_why_f3_desc_en', value: currentSettings.whyFeature3DescEn },
      ];

      for (const update of updates) {
        if (update.value !== undefined) {
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
          icon="document-text-outline"
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

        {/* Hakkımızda Bölümü (About Us Section) */}
        <SettingCard
          title={i18n.language === 'tr' ? 'Hakkımızda Bölümü' : 'About Us Section'}
          description={i18n.language === 'tr' ? 'Hakkımızda yazısı ve görseli' : 'About us text and image'}
          icon="information-circle-outline"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Başlık' : 'Title'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.aboutTitleTr : settings.aboutTitleEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'aboutTitleTr' : 'aboutTitleEn', text)}
              placeholder={i18n.language === 'tr' ? 'Hakkımızda' : 'About Us'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Açıklama' : 'Description'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              defaultValue={i18n.language === 'tr' ? settings.aboutDescTr : settings.aboutDescEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'aboutDescTr' : 'aboutDescEn', text)}
              placeholder={i18n.language === 'tr' ? 'Hakkımızda açıklaması...' : 'About us description...'}
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={4}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Görsel URL' : 'Image URL'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={settings.aboutImage}
              onChangeText={(text) => handleInputChange('aboutImage', text)}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        </SettingCard>

        {/* Neden Riverside Bölümü (Why Riverside Section) */}
        <SettingCard
          title={i18n.language === 'tr' ? 'Neden Riverside?' : 'Why Riverside?'}
          description={i18n.language === 'tr' ? 'Ana sayfa özellikleri' : 'Homepage features'}
          icon="star-outline"
        >
          {/* Main Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Bölüm Başlığı' : 'Section Title'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyTitleTr : settings.whyTitleEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyTitleTr' : 'whyTitleEn', text)}
              placeholder={i18n.language === 'tr' ? '🎯 Neden Riverside Burgers?' : '🎯 Why Riverside Burgers?'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.divider} />

          {/* Feature 1 */}
          <Text style={styles.subHeader}>
            {i18n.language === 'tr' ? 'Özellik 1 (Hızlı Teslimat)' : 'Feature 1 (Fast Delivery)'}
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Başlık' : 'Title'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyFeature1TitleTr : settings.whyFeature1TitleEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyFeature1TitleTr' : 'whyFeature1TitleEn', text)}
              placeholder={i18n.language === 'tr' ? 'Hızlı Teslimat' : 'Fast Delivery'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Açıklama' : 'Description'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyFeature1DescTr : settings.whyFeature1DescEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyFeature1DescTr' : 'whyFeature1DescEn', text)}
              placeholder={i18n.language === 'tr' ? '30 dakikada kapınızda' : 'At your door in 30 minutes'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.divider} />

          {/* Feature 2 */}
          <Text style={styles.subHeader}>
            {i18n.language === 'tr' ? 'Özellik 2 (Kalite)' : 'Feature 2 (Quality)'}
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Başlık' : 'Title'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyFeature2TitleTr : settings.whyFeature2TitleEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyFeature2TitleTr' : 'whyFeature2TitleEn', text)}
              placeholder={i18n.language === 'tr' ? 'Kalite Garantisi' : 'Quality Guarantee'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Açıklama' : 'Description'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyFeature2DescTr : settings.whyFeature2DescEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyFeature2DescTr' : 'whyFeature2DescEn', text)}
              placeholder={i18n.language === 'tr' ? 'Her zaman taze malzemeler' : 'Always fresh ingredients'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.divider} />

          {/* Feature 3 */}
          <Text style={styles.subHeader}>
            {i18n.language === 'tr' ? 'Özellik 3 (Memnuniyet)' : 'Feature 3 (Satisfaction)'}
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Başlık' : 'Title'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyFeature3TitleTr : settings.whyFeature3TitleEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyFeature3TitleTr' : 'whyFeature3TitleEn', text)}
              placeholder={i18n.language === 'tr' ? '5 Yıldız Memnuniyet' : '5 Star Satisfaction'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Açıklama' : 'Description'}
            </Text>
            <TextInput
              style={styles.input}
              defaultValue={i18n.language === 'tr' ? settings.whyFeature3DescTr : settings.whyFeature3DescEn}
              onChangeText={(text) => handleInputChange(i18n.language === 'tr' ? 'whyFeature3DescTr' : 'whyFeature3DescEn', text)}
              placeholder={i18n.language === 'tr' ? 'Binlerce mutlu müşteri' : 'Thousands of happy customers'}
              placeholderTextColor={Colors.textSecondary}
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  subHeader: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});

export default AdminContactSettings;

