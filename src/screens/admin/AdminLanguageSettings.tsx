import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import Toast from 'react-native-toast-message';
import {
  getAppSettings,
  updateAppCountry,
  AppCountry,
  COUNTRIES,
} from '../../services/appSettingsService';

// Dil ve Para Birimi Yönetimi Ekranı (Language and Currency Management Screen)
const AdminLanguageSettings = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<AppCountry>('canada');

  // Ayarları yükle (Load settings)
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await getAppSettings();
      setSelectedCountry(settings.country);
    } catch (error) {
      console.error('Error loading settings:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Hata',
        text2: 'Ayarlar yüklenemedi',
      });
    } finally {
      setLoading(false);
    }
  };

  // Ülke değiştir (Change country)
  const handleCountryChange = async (country: AppCountry) => {
    try {
      setSaving(true);
      const success = await updateAppCountry(country);

      if (success) {
        setSelectedCountry(country);
        const countryInfo = COUNTRIES[country];
        Toast.show({
          type: 'success',
          text1: '✅ Başarılı',
          text2: `Ülke: ${countryInfo.name} | Dil: ${countryInfo.language.toUpperCase()} | Para: ${countryInfo.currency}`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '❌ Hata',
          text2: 'Ayarlar güncellenemedi',
        });
      }
    } catch (error) {
      console.error('Error updating country:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Hata',
        text2: 'Bir hata oluştu',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Ayarlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dil ve Para Birimi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Açıklama (Description) */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={Colors.primary} />
          <Text style={styles.infoText}>
            Uygulamanın hangi ülkede kullanılacağını seçin. Seçtiğiniz ülkeye göre dil ve para
            birimi otomatik olarak ayarlanır.
          </Text>
        </View>

        {/* Ülke Seçimi (Country Selection) */}
        <Text style={styles.sectionTitle}>Ülke Seçimi</Text>

        {/* Türkiye */}
        <TouchableOpacity
          style={[
            styles.countryCard,
            selectedCountry === 'turkey' && styles.countryCardActive,
          ]}
          onPress={() => handleCountryChange('turkey')}
          disabled={saving}
          activeOpacity={0.7}
        >
          <View style={styles.countryLeft}>
            <Text style={styles.countryFlag}>{COUNTRIES.turkey.flag}</Text>
            <View>
              <Text style={styles.countryName}>{COUNTRIES.turkey.name}</Text>
              <Text style={styles.countryDetails}>
                Dil: Türkçe | Para: ₺ TRY
              </Text>
            </View>
          </View>
          {selectedCountry === 'turkey' && (
            <Ionicons name="checkmark-circle" size={28} color={Colors.primary} />
          )}
        </TouchableOpacity>

        {/* Kanada */}
        <TouchableOpacity
          style={[
            styles.countryCard,
            selectedCountry === 'canada' && styles.countryCardActive,
          ]}
          onPress={() => handleCountryChange('canada')}
          disabled={saving}
          activeOpacity={0.7}
        >
          <View style={styles.countryLeft}>
            <Text style={styles.countryFlag}>{COUNTRIES.canada.flag}</Text>
            <View>
              <Text style={styles.countryName}>{COUNTRIES.canada.name}</Text>
              <Text style={styles.countryDetails}>
                Dil: English | Para: $ CAD
              </Text>
            </View>
          </View>
          {selectedCountry === 'canada' && (
            <Ionicons name="checkmark-circle" size={28} color={Colors.primary} />
          )}
        </TouchableOpacity>

        {/* Mevcut Ayarlar (Current Settings) */}
        <View style={styles.currentSettingsCard}>
          <Text style={styles.currentSettingsTitle}>Mevcut Ayarlar</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Ülke:</Text>
            <Text style={styles.settingValue}>
              {COUNTRIES[selectedCountry].flag} {COUNTRIES[selectedCountry].name}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Dil:</Text>
            <Text style={styles.settingValue}>
              {COUNTRIES[selectedCountry].language === 'tr' ? 'Türkçe' : 'English'}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Para Birimi:</Text>
            <Text style={styles.settingValue}>
              {COUNTRIES[selectedCountry].currency === 'TRY' ? '₺ TRY' : '$ CAD'}
            </Text>
          </View>
        </View>

        {/* Not (Note) */}
        <View style={styles.noteCard}>
          <Ionicons name="alert-circle-outline" size={20} color="#FF9800" />
          <Text style={styles.noteText}>
            Müşteriler dil ve para birimi seçemez. Tüm kullanıcılar admin'in seçtiği ayarları
            görür.
          </Text>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {saving && (
        <View style={styles.savingOverlay}>
          <View style={styles.savingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.savingText}>Kaydediliyor...</Text>
          </View>
        </View>
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
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.primary,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '10',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    ...Shadows.small,
  },
  countryCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
  },
  countryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  countryFlag: {
    fontSize: 40,
  },
  countryName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  countryDetails: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  currentSettingsCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  currentSettingsTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLabel: {
    fontSize: FontSizes.md,
    color: '#666',
  },
  settingValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  noteText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#666',
    lineHeight: 20,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingCard: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.large,
  },
  savingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '600',
  },
});

export default AdminLanguageSettings;

