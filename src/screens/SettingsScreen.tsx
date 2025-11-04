// Settings Screen - Ayarlar Ekranı
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { changeLanguage } from '../i18n';
import { changeCurrency, getCurrentCurrency, getCurrencyInfo, Currency } from '../services/currencyService';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [currentCurr, setCurrentCurr] = useState<Currency>(getCurrentCurrency());

  // Dil değiştir (Change language)
  const handleLanguageChange = async (language: 'tr' | 'en') => {
    try {
      setLoading(true);
      await changeLanguage(language);
      setCurrentLang(language);
      Toast.show({
        type: 'success',
        text1: '✅ ' + t('settings.settingsSaved'),
        position: 'bottom',
        visibilityTime: 2000,
        bottomOffset: 100,
      });
    } catch (error) {
      console.error('Error changing language:', error);
      Toast.show({
        type: 'error',
        text1: '❌ ' + t('settings.settingsError'),
        position: 'bottom',
        visibilityTime: 2000,
        bottomOffset: 100,
      });
    } finally {
      setLoading(false);
    }
  };

  // Para birimi değiştir (Change currency)
  const handleCurrencyChange = async (currency: Currency) => {
    try {
      setLoading(true);
      await changeCurrency(currency);
      setCurrentCurr(currency);
      Toast.show({
        type: 'success',
        text1: '✅ ' + t('settings.settingsSaved'),
        position: 'bottom',
        visibilityTime: 2000,
        bottomOffset: 100,
      });
      // Sayfayı yenile (Refresh to update prices)
      setTimeout(() => {
        navigation.goBack();
      }, 2000); // Toast'ın görünmesi için 2 saniye bekle
    } catch (error) {
      console.error('Error changing currency:', error);
      Toast.show({
        type: 'error',
        text1: '❌ ' + t('settings.settingsError'),
        position: 'bottom',
        visibilityTime: 2000,
        bottomOffset: 100,
      });
    } finally {
      setLoading(false);
    }
  };

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
        {/* Dil ve Para Birimi Bölümü (Language and Currency Section) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.languageAndCurrency')}</Text>

          {/* Dil Seçimi (Language Selection) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('settings.selectLanguage')}</Text>
            
            <TouchableOpacity
              style={[styles.option, currentLang === 'tr' && styles.optionSelected]}
              onPress={() => handleLanguageChange('tr')}
              disabled={loading}
            >
              <View style={styles.optionLeft}>
                <Ionicons 
                  name="language" 
                  size={24} 
                  color={currentLang === 'tr' ? Colors.primary : Colors.textSecondary} 
                />
                <Text style={[styles.optionText, currentLang === 'tr' && styles.optionTextSelected]}>
                  {t('settings.turkish')}
                </Text>
              </View>
              {currentLang === 'tr' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, currentLang === 'en' && styles.optionSelected]}
              onPress={() => handleLanguageChange('en')}
              disabled={loading}
            >
              <View style={styles.optionLeft}>
                <Ionicons 
                  name="language" 
                  size={24} 
                  color={currentLang === 'en' ? Colors.primary : Colors.textSecondary} 
                />
                <Text style={[styles.optionText, currentLang === 'en' && styles.optionTextSelected]}>
                  {t('settings.english')}
                </Text>
              </View>
              {currentLang === 'en' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Para Birimi Seçimi (Currency Selection) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('settings.selectCurrency')}</Text>
            
            <TouchableOpacity
              style={[styles.option, currentCurr === 'TRY' && styles.optionSelected]}
              onPress={() => handleCurrencyChange('TRY')}
              disabled={loading}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.currencySymbol}>₺</Text>
                <Text style={[styles.optionText, currentCurr === 'TRY' && styles.optionTextSelected]}>
                  {t('settings.turkishLira')}
                </Text>
              </View>
              {currentCurr === 'TRY' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, currentCurr === 'CAD' && styles.optionSelected]}
              onPress={() => handleCurrencyChange('CAD')}
              disabled={loading}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.currencySymbol}>$</Text>
                <Text style={[styles.optionText, currentCurr === 'CAD' && styles.optionTextSelected]}>
                  {t('settings.canadianDollar')}
                </Text>
              </View>
              {currentCurr === 'CAD' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
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
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  cardTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  optionText: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  currencySymbol: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
});

export default SettingsScreen;

