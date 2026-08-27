import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import { clearContactCache } from '../../services/contactService';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// İletişim ayarları tipi
interface ContactSettings {
  phone1: string;
  phone2: string;
  email: string;
  address1: string;
  address2: string;
  businessNumber: string;
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

// ÖNEMLİ: Bu iki bileşen bilerek modül seviyesinde. Eskiden AdminContactSettings'in
// İÇİNDE tanımlıydılar; her render'da yeni bir fonksiyon (yani yeni bir bileşen
// TİPİ) üretildiği için React tüm alt ağacı söküp yeniden kuruyordu. Sonuç: her
// tuş vuruşunda TextInput odağı kaybediyor ve FadeInDown animasyonu baştan
// oynuyordu — kullanıcının "her işlemde sayfa yenileniyor" dediği şey buydu.
const SettingCard = ({ icon, title, description, children, delay = 0 }: any) => (
  <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.headerTexts}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
      </View>
    </View>
    <View style={styles.cardContent}>{children}</View>
  </Animated.View>
);

// Kontrolsüz input (defaultValue): yazarken state güncellenmediği için render
// hiç tetiklenmiyor. Değer settingsRef'te tutuluyor ve kaydetme oradan okuyor.
// AdminSettings ekranında zaten bu kalıp kullanılıyordu; burada eksik kalmıştı.
const InputField = ({ label, defaultValue, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      defaultValue={defaultValue}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      keyboardType={keyboardType}
    />
  </View>
);

const AdminContactSettings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  
  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ContactSettings>({
    phone1: '',
    phone2: '',
    email: '',
    address1: '',
    address2: '',
    businessNumber: '',
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
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Input refs
  const settingsRef = useRef<ContactSettings>(settings);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInputChange = useCallback((field: keyof ContactSettings, value: string) => {
    // Yalnızca ref'e yaz. Eskiden burada setSettings de çağrılıyordu; her tuş
    // vuruşunda render tetikleniyor, o da (modül seviyesine taşınana kadar)
    // input'ların yeniden kurulmasına ve odağın kaybedilmesine yol açıyordu.
    // State'e ihtiyaç yok: input'lar kontrolsüz (defaultValue) ve kaydetme
    // settingsRef.current'tan okuyor.
    settingsRef.current[field] = value;
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'contact_phone1', 'contact_phone2', 'contact_email',
          'contact_address1', 'contact_address2', 'contact_business_number',
          'social_facebook', 'social_instagram', 'social_whatsapp',
          'footer_about', 'footer_copyright',
          'home_about_title_tr', 'home_about_title_en',
          'home_about_desc_tr', 'home_about_desc_en', 'home_about_image',
          'home_why_title_tr', 'home_why_title_en',
          'home_why_f1_title_tr', 'home_why_f1_title_en', 'home_why_f1_desc_tr', 'home_why_f1_desc_en',
          'home_why_f2_title_tr', 'home_why_f2_title_en', 'home_why_f2_desc_tr', 'home_why_f2_desc_en',
          'home_why_f3_title_tr', 'home_why_f3_title_en', 'home_why_f3_desc_tr', 'home_why_f3_desc_en',
        ]);

      if (error) throw error;

      const settingsObj: any = {};
      data?.forEach((item) => {
        settingsObj[item.setting_key] = item.setting_value || '';
      });

      const newSettings: ContactSettings = {
        phone1: settingsObj['contact_phone1'] || '',
        phone2: settingsObj['contact_phone2'] || '',
        email: settingsObj['contact_email'] || '',
        address1: settingsObj['contact_address1'] || '',
        address2: settingsObj['contact_address2'] || '',
        businessNumber: settingsObj['contact_business_number'] || '',
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
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.contactSettings.errorMessage') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const currentSettings = settingsRef.current;
      const updates = [
        { key: 'contact_phone1', value: currentSettings.phone1 },
        { key: 'contact_phone2', value: currentSettings.phone2 },
        { key: 'contact_email', value: currentSettings.email },
        { key: 'contact_address1', value: currentSettings.address1 },
        { key: 'contact_address2', value: currentSettings.address2 },
        { key: 'contact_business_number', value: currentSettings.businessNumber },
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
          const { error } = await supabase.from('app_settings').upsert({ setting_key: update.key, setting_value: update.value }, { onConflict: 'setting_key' });
          if (error) throw error;
        }
      }

      clearContactCache();
      Toast.show({ type: 'success', text1: t('admin.success'), text2: t('admin.contactSettings.successMessage') });
      setShowSaveModal(false);
    } catch (error: any) {
      console.error('Error:', error);
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.contactSettings.errorMessage') });
    } finally {
      setSaving(false);
    }
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

      {/* HEADER */}
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>Panel</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.contactSettings.title')}</Text>
        </View>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('admin.contactSettings.title')}</Text>
            <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* CONTACT INFO */}
        <SettingCard 
          delay={100}
          icon="call-outline" 
          title={t('admin.contactSettings.phoneNumbers')} 
          description={t('admin.contactSettings.phoneNumbersDesc')}
        >
          <InputField label={t('admin.contactSettings.phone1')} defaultValue={settings.phone1} onChangeText={(t: string) => handleInputChange('phone1', t)} placeholder="+1 (416) 850-7026" keyboardType="phone-pad" />
          <InputField label={t('admin.contactSettings.phone2')} defaultValue={settings.phone2} onChangeText={(t: string) => handleInputChange('phone2', t)} placeholder="+1 (416) 935-6600" keyboardType="phone-pad" />
        </SettingCard>

        <SettingCard 
          delay={200}
          icon="mail-outline" 
          title={t('admin.contactSettings.emailAddress')} 
          description={t('admin.contactSettings.emailAddressDesc')}
        >
          <InputField label={t('admin.contactSettings.email')} defaultValue={settings.email} onChangeText={(t: string) => handleInputChange('email', t)} placeholder="info@riversideburgers.com" keyboardType="email-address" />
        </SettingCard>

        <SettingCard 
          delay={300}
          icon="location-outline" 
          title={t('admin.contactSettings.addresses')} 
          description={t('admin.contactSettings.addressesDesc')}
        >
          <InputField label={t('admin.contactSettings.address1')} defaultValue={settings.address1} onChangeText={(t: string) => handleInputChange('address1', t)} placeholder="688 Queen Street East, Toronto" multiline />
          <InputField label={t('admin.contactSettings.address2')} defaultValue={settings.address2} onChangeText={(t: string) => handleInputChange('address2', t)} placeholder="1228 King St W, Toronto" multiline />
          {/* Fişte yasal olarak gösterilmesi gereken HST/CRA işletme numarası */}
          <InputField label={t('admin.contactSettings.businessNumber')} defaultValue={settings.businessNumber} onChangeText={(t: string) => handleInputChange('businessNumber', t)} placeholder="772068078RT0001" />
        </SettingCard>

        {/* SOCIAL */}
        <SettingCard 
          delay={400}
          icon="share-social-outline" 
          title={t('admin.contactSettings.socialMedia')} 
          description={t('admin.contactSettings.socialMediaDesc')}
        >
          <InputField label="Facebook" defaultValue={settings.facebook} onChangeText={(t: string) => handleInputChange('facebook', t)} placeholder="https://facebook.com/..." />
          <InputField label="Instagram" defaultValue={settings.instagram} onChangeText={(t: string) => handleInputChange('instagram', t)} placeholder="https://instagram.com/..." />
          <InputField label="WhatsApp" defaultValue={settings.whatsapp} onChangeText={(t: string) => handleInputChange('whatsapp', t)} placeholder="+14168507026" keyboardType="phone-pad" />
        </SettingCard>

        {/* FOOTER */}
        <SettingCard 
          delay={500}
          icon="document-text-outline" 
          title={t('admin.contactSettings.footerTexts')} 
          description={t('admin.contactSettings.footerTextsDesc')}
        >
          <InputField label={t('admin.contactSettings.footerAbout')} defaultValue={settings.footerAbout} onChangeText={(t: string) => handleInputChange('footerAbout', t)} placeholder="..." multiline />
          <InputField label={t('admin.contactSettings.footerCopyright')} defaultValue={settings.footerCopyright} onChangeText={(t: string) => handleInputChange('footerCopyright', t)} placeholder="© 2024 Riverside Burgers" />
        </SettingCard>

        {/* ABOUT US */}
        <SettingCard 
          delay={600}
          icon="information-circle-outline" 
          title={i18n.language === 'tr' ? 'Hakkımızda Bölümü' : 'About Us Section'}
          description={i18n.language === 'tr' ? 'Hakkımızda yazısı ve görseli' : 'About us text and image'}
        >
           {i18n.language === 'tr' ? (
              <>
                 <View style={styles.langSwitch}><Text style={styles.langTag}>TR</Text></View>
                 <InputField label="Başlık (TR)" defaultValue={settings.aboutTitleTr} onChangeText={(t: string) => handleInputChange('aboutTitleTr', t)} />
                 <InputField label="Açıklama (TR)" defaultValue={settings.aboutDescTr} onChangeText={(t: string) => handleInputChange('aboutDescTr', t)} multiline />
              </>
           ) : (
              <>
                 <View style={[styles.langSwitch, {backgroundColor: '#E3F2FD'}]}><Text style={[styles.langTag, {color: '#1976D2'}]}>EN</Text></View>
                 <InputField label="Title (EN)" defaultValue={settings.aboutTitleEn} onChangeText={(t: string) => handleInputChange('aboutTitleEn', t)} />
                 <InputField label="Description (EN)" defaultValue={settings.aboutDescEn} onChangeText={(t: string) => handleInputChange('aboutDescEn', t)} multiline />
              </>
           )}
           <InputField label="Görsel URL / Image URL" defaultValue={settings.aboutImage} onChangeText={(t: string) => handleInputChange('aboutImage', t)} placeholder="https://..." />
        </SettingCard>

      </ScrollView>

      {/* FOOTER ACTION */}
      <View style={styles.bottomArea}>
          <TouchableOpacity 
            style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
            onPress={() => setShowSaveModal(true)}
            disabled={saving}
          >
              <LinearGradient colors={[Colors.primary, '#FF6B6B']} style={styles.saveGrad}>
                  {saving ? (
                      <ActivityIndicator color="#FFF" />
                  ) : (
                      <>
                        <Ionicons name="save-outline" size={20} color="#FFF" style={{marginRight: 8}} />
                        <Text style={styles.saveText}>{t('admin.contactSettings.saveButton')}</Text>
                      </>
                  )}
              </LinearGradient>
          </TouchableOpacity>
      </View>

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
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 20, ...Shadows.small },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  headerTexts: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  cardContent: { gap: 16 },
  inputContainer: {},
  label: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: '#EEE' },
  textArea: { height: 80, textAlignVertical: 'top' },
  langSwitch: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFF3E0', borderRadius: 6, marginBottom: 8 },
  langTag: { fontSize: 10, fontWeight: '800', color: '#E65100' },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: '#EEE' },
  saveBtn: { height: 56, borderRadius: 20, ...Shadows.large },
  saveGrad: { flex: 1, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
});

export default AdminContactSettings;
