// Settings Screen - Ayarlar Ekranı
// Basitleştirilmiş: Sadece bilgilendirme (Simplified: Information only)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { getCurrentCurrency, getCurrencyInfo } from '../services/currencyService';
import { getAppSettings, COUNTRIES } from '../services/appSettingsService';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [countryName, setCountryName] = useState('');

  // Uygulama ayarlarını yükle (Load app settings)
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getAppSettings();
    const country = COUNTRIES[settings.country];
    setCountryName(country.name);
  };

  const currentCurrency = getCurrentCurrency();
  const currencyInfo = getCurrencyInfo();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bilgilendirme (Information) */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={32} color={Colors.primary} />
          <Text style={styles.infoText}>
            {t('settings.adminControlsLanguage')}
          </Text>
        </View>

        {/* Mevcut Ayarlar (Current Settings) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.currentSettings')}</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="globe-outline" size={24} color={Colors.primary} />
                <Text style={styles.settingLabel}>{t('settings.country')}</Text>
              </View>
              <Text style={styles.settingValue}>{countryName}</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="language-outline" size={24} color={Colors.primary} />
                <Text style={styles.settingLabel}>{t('settings.language')}</Text>
              </View>
              <Text style={styles.settingValue}>
                {i18n.language === 'tr' ? 'Türkçe' : 'English'}
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="cash-outline" size={24} color={Colors.primary} />
                <Text style={styles.settingLabel}>{t('settings.currency')}</Text>
              </View>
              <Text style={styles.settingValue}>
                {currencyInfo.symbol} {currencyInfo.code}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    padding: Spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}10`,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.small,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.medium,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default SettingsScreen;

