import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors, Shadows } from '../../constants/theme';
import Toast from 'react-native-toast-message';
import {
  getAppSettings,
  updateAppCountry,
  AppCountry,
  COUNTRIES,
} from '../../services/appSettingsService';

const AdminLanguageSettings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<AppCountry>('canada');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await getAppSettings();
      setSelectedCountry(settings.country);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.languageSettings.errorLoading'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = async (country: AppCountry) => {
    if (country === selectedCountry) return;
    try {
      setSaving(true);
      const success = await updateAppCountry(country);
      if (success) {
        setSelectedCountry(country);
        const countryInfo = COUNTRIES[country];
        Toast.show({
          type: 'success',
          text1: t('admin.languageSettings.success'),
          text2: t('admin.languageSettings.settingsUpdated', {
            country: countryInfo.name,
            language: countryInfo.language.toUpperCase(),
            currency: countryInfo.currency,
          }),
        });
      } else {
        Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.languageSettings.errorUpdating') });
      }
    } catch {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.languageSettings.errorGeneral') });
    } finally {
      setSaving(false);
    }
  };

  const currentCountry = COUNTRIES[selectedCountry];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.languageSettings.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient colors={['#1a1a1a', '#333333']} style={styles.header}>
        <View style={styles.breadcrumb}>
          <Text style={styles.breadText}>Admin</Text>
          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
          <Text style={[styles.breadText, styles.breadActive]}>
            {t('admin.languageSettingsMenu')}
          </Text>
        </View>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{t('admin.languageSettingsMenu')}</Text>
            <Text style={styles.headerSubtitle}>{t('admin.languageSettings.infoText')}</Text>
          </View>
          {/* Active country flag badge */}
          <View style={styles.flagBadge}>
            <Text style={styles.flagEmoji}>{currentCountry.flag}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ── Section label ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <Text style={styles.sectionLabel}>{t('admin.languageSettings.sectionTitle')}</Text>
        </Animated.View>

        {/* ── Country Cards ── */}
        {(Object.entries(COUNTRIES) as [AppCountry, typeof COUNTRIES[AppCountry]][]).map(
          ([key, info], index) => {
            const isActive = selectedCountry === key;
            return (
              <Animated.View key={key} entering={FadeInDown.delay(100 + index * 80).springify()}>
                <TouchableOpacity
                  style={[styles.countryCard, isActive && styles.countryCardActive]}
                  onPress={() => handleCountryChange(key)}
                  disabled={saving}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardLeft}>
                    <View style={[styles.flagCircle, isActive && styles.flagCircleActive]}>
                      <Text style={styles.flagLarge}>{info.flag}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.countryName, isActive && styles.countryNameActive]}>
                        {info.name}
                      </Text>
                      <View style={styles.pillRow}>
                        <View style={[styles.pill, isActive && styles.pillActive]}>
                          <Ionicons name="language-outline" size={11} color={isActive ? '#FFF' : '#888'} />
                          <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                            {info.language.toUpperCase()}
                          </Text>
                        </View>
                        <View style={[styles.pill, isActive && styles.pillActive]}>
                          <Ionicons name="cash-outline" size={11} color={isActive ? '#FFF' : '#888'} />
                          <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                            {info.currency}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {isActive ? (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    </View>
                  ) : (
                    <View style={styles.uncheckCircle} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          }
        )}

        {/* ── Current Settings Summary ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.summaryTitle}>{t('admin.languageSettings.currentSettingsTitle')}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('admin.languageSettings.labelCountry')}</Text>
              <Text style={styles.summaryValue}>{currentCountry.flag} {currentCountry.name}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('admin.languageSettings.labelLanguage')}</Text>
              <Text style={styles.summaryValue}>
                {currentCountry.language === 'tr'
                  ? t('admin.languageSettings.languageTurkish')
                  : t('admin.languageSettings.languageEnglish')}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('admin.languageSettings.labelCurrency')}</Text>
              <Text style={styles.summaryValue}>
                {currentCountry.currency === 'TRY' ? '₺ ' : '$ '}
                {currentCountry.currency === 'TRY'
                  ? t('admin.languageSettings.currencyTRY')
                  : t('admin.languageSettings.currencyCAD')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Note ── */}
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <View style={styles.noteCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#FF9800" />
            <Text style={styles.noteText}>{t('admin.languageSettings.noteText')}</Text>
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Saving Overlay ── */}
      {saving && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.overlayText}>{t('admin.settings.saving')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#888', fontWeight: '600' },

  /* Header */
  header: {
    paddingTop: 54,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Shadows.medium,
  },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, opacity: 0.8 },
  breadText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: '#FFF', opacity: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 3, lineHeight: 16 },
  flagBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  flagEmoji: { fontSize: 24 },

  /* Content */
  content: { flex: 1 },
  contentContainer: { padding: 20, gap: 14 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },

  /* Country Card */
  countryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', borderRadius: 20, padding: 18,
    borderWidth: 2, borderColor: 'transparent', ...Shadows.small,
  },
  countryCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '06' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  flagCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  flagCircleActive: { backgroundColor: Colors.primary + '15' },
  flagLarge: { fontSize: 32 },
  cardInfo: { flex: 1, gap: 6 },
  countryName: { fontSize: 16, fontWeight: '800', color: '#222' },
  countryNameActive: { color: Colors.primary },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { fontSize: 11, fontWeight: '700', color: '#888' },
  pillTextActive: { color: '#FFF' },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  uncheckCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#DDD' },

  /* Summary */
  summaryCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, ...Shadows.small },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: '#222' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  summaryLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#222' },
  divider: { height: 1, backgroundColor: '#F0F0F0' },

  /* Note */
  noteCard: { flexDirection: 'row', backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, gap: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, color: '#795548', lineHeight: 18, fontWeight: '500' },

  /* Overlay */
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  overlayCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 32, alignItems: 'center', gap: 14, ...Shadows.large },
  overlayText: { fontSize: 15, fontWeight: '700', color: '#333' },
});

export default AdminLanguageSettings;
