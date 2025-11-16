import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import ConfirmModal from '../../components/ConfirmModal';
import WorkingHoursModal from '../../components/WorkingHoursModal';
import {
  WorkingHours,
  DEFAULT_WORKING_HOURS,
  updateWorkingHours,
} from '../../services/workingHoursService';

// Ayarlar tipi (Settings type)
interface Settings {
  id: string;
  points_percentage: number;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  is_open: boolean;
  auto_close_enabled?: boolean;
  working_hours?: WorkingHours;
  updated_at?: string;
}

// Admin Ayarlar Ekranı (Admin Settings Screen)
const AdminSettings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();

  // Sayfa başlığını ayarla (Set page title)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('admin.screenTitles.systemSettings'),
    });
  }, [navigation, t, i18n.language]);
  // State'ler (States)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    id: '',
    points_percentage: 5,
    min_order_amount: 50,
    delivery_fee: 15,
    free_delivery_threshold: 150,
    is_open: true,
    auto_close_enabled: false,
    working_hours: DEFAULT_WORKING_HOURS,
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);

  // Sayfa yüklendiğinde ayarları getir (Fetch settings on page load)
  useEffect(() => {
    fetchSettings();
  }, []);

  // Ayarları getir (Fetch settings)
  const fetchSettings = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching settings...');

      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      if (!data) {
        // Eğer ayar yoksa varsayılan değerlerle oluştur
        // (If no settings exist, create with default values)
        console.log('⚠️ No settings found, creating default...');
        await createDefaultSettings();
        return;
      }

      console.log('✅ Settings fetched:', data);
      setSettings({
        ...data,
        working_hours: data.working_hours || DEFAULT_WORKING_HOURS,
        auto_close_enabled: data.auto_close_enabled || false,
      });
    } catch (error: any) {
      console.error('❌ Error fetching settings:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.settings.errorLoading'),
      });
    } finally {
      setLoading(false);
    }
  };

  // Varsayılan ayarları oluştur (Create default settings)
  const createDefaultSettings = async () => {
    try {
      const defaultSettings = {
        points_percentage: 5,
        min_order_amount: 50,
        delivery_fee: 15,
        free_delivery_threshold: 150,
        is_open: true,
      };

      const { data, error } = await supabase
        .from('settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Default settings created:', data);
      setSettings(data);
    } catch (error: any) {
      console.error('❌ Error creating default settings:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.settings.errorCreatingDefaults'),
      });
    }
  };

  // Ayarları kaydet (Save settings)
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      console.log('💾 Saving settings:', settings);

      // Validasyon (Validation)
      if (settings.points_percentage < 0 || settings.points_percentage > 100) {
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: t('admin.settings.pointsPercentageError'),
        });
        return;
      }

      if (settings.min_order_amount < 0) {
        Toast.show({
          type: 'error',
          text1: t('admin.error'),
          text2: t('admin.settings.minOrderAmountError'),
        });
        return;
      }

      const { data, error } = await supabase
        .from('settings')
        .update({
          points_percentage: settings.points_percentage,
          min_order_amount: settings.min_order_amount,
          delivery_fee: settings.delivery_fee,
          free_delivery_threshold: settings.free_delivery_threshold,
          is_open: settings.is_open,
        })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Settings saved:', data);
      setSettings(data);
      setShowSaveModal(false);

      Toast.show({
        type: 'success',
        text1: t('admin.settings.settingsSaved'),
        text2: t('admin.settings.settingsSavedDesc'),
      });
    } catch (error: any) {
      console.error('❌ Error saving settings:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.settings.errorSaving'),
      });
    } finally {
      setSaving(false);
    }
  };

  // Çalışma saatlerini kaydet (Save working hours)
  const handleSaveWorkingHours = async (
    workingHours: WorkingHours,
    autoCloseEnabled: boolean
  ) => {
    try {
      console.log('💾 Saving working hours:', { workingHours, autoCloseEnabled });

      const success = await updateWorkingHours(workingHours, autoCloseEnabled);

      if (!success) {
        throw new Error('Failed to update working hours');
      }

      // State'i güncelle (Update state)
      setSettings({
        ...settings,
        working_hours: workingHours,
        auto_close_enabled: autoCloseEnabled,
      });

      Toast.show({
        type: 'success',
        text1: t('admin.settings.workingHours.saved'),
        text2: t('admin.settings.workingHours.savedDesc'),
        visibilityTime: 3000,
        topOffset: 60,
      });
    } catch (error: any) {
      console.error('❌ Error saving working hours:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: error.message || t('admin.settings.workingHours.errorSaving'),
        visibilityTime: 4000,
        topOffset: 60,
      });
    }
  };

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.settings.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Puan Sistemi (Points System) */}
        <Text style={styles.sectionTitle}>{t('admin.settings.sectionPointsSystem')}</Text>
        <SettingCard
          icon="star"
          title={t('admin.settings.pointsEarningPercentage')}
          description={t('admin.settings.pointsEarningDesc')}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={settings.points_percentage.toString()}
              onChangeText={(text) =>
                setSettings({ ...settings, points_percentage: parseFloat(text) || 0 })
              }
              keyboardType="decimal-pad"
              placeholder="5"
              placeholderTextColor="#999"
            />
            <Text style={styles.inputSuffix}>%</Text>
          </View>
          <Text style={styles.helperText}>
            {t('admin.settings.pointsExample')}
          </Text>
        </SettingCard>

        {/* Sipariş Ayarları (Order Settings) */}
        <Text style={styles.sectionTitle}>{t('admin.settings.sectionOrderSettings')}</Text>
        <SettingCard
          icon="cart"
          title={t('admin.settings.minOrderTitle')}
          description={t('admin.settings.minOrderDesc')}
        >
          <View style={styles.inputRow}>
            <Text style={styles.inputPrefix}>₺</Text>
            <TextInput
              style={styles.input}
              value={settings.min_order_amount.toString()}
              onChangeText={(text) =>
                setSettings({ ...settings, min_order_amount: parseFloat(text) || 0 })
              }
              keyboardType="decimal-pad"
              placeholder="50"
              placeholderTextColor="#999"
            />
          </View>
        </SettingCard>

        {/* Teslimat Ayarları (Delivery Settings) */}
        <Text style={styles.sectionTitle}>{t('admin.settings.sectionDeliverySettings')}</Text>
        <SettingCard
          icon="bicycle"
          title={t('admin.settings.deliveryFeeTitle')}
          description={t('admin.settings.deliveryFeeDescription')}
        >
          <View style={styles.inputRow}>
            <Text style={styles.inputPrefix}>₺</Text>
            <TextInput
              style={styles.input}
              value={settings.delivery_fee.toString()}
              onChangeText={(text) =>
                setSettings({ ...settings, delivery_fee: parseFloat(text) || 0 })
              }
              keyboardType="decimal-pad"
              placeholder="15"
              placeholderTextColor="#999"
            />
          </View>
        </SettingCard>

        <SettingCard
          icon="gift"
          title={t('admin.settings.freeDeliveryTitle')}
          description={t('admin.settings.freeDeliveryDesc')}
        >
          <View style={styles.inputRow}>
            <Text style={styles.inputPrefix}>₺</Text>
            <TextInput
              style={styles.input}
              value={settings.free_delivery_threshold.toString()}
              onChangeText={(text) =>
                setSettings({ ...settings, free_delivery_threshold: parseFloat(text) || 0 })
              }
              keyboardType="decimal-pad"
              placeholder="150"
              placeholderTextColor="#999"
            />
          </View>
        </SettingCard>

        {/* Restoran Durumu (Restaurant Status) */}
        <Text style={styles.sectionTitle}>{t('admin.settings.sectionRestaurantStatus')}</Text>
        <SettingCard
          icon="storefront"
          title={t('admin.settings.restaurantStatusTitle')}
          description={t('admin.settings.restaurantStatusDesc')}
        >
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {settings.is_open ? t('admin.settings.statusOpen') : t('admin.settings.statusClosed')}
            </Text>
            <Switch
              value={settings.is_open}
              onValueChange={(value) => setSettings({ ...settings, is_open: value })}
              trackColor={{ false: '#DC3545', true: Colors.primary + '40' }}
              thumbColor={settings.is_open ? Colors.primary : '#999'}
            />
          </View>
        </SettingCard>

        {/* Çalışma Saatleri (Working Hours) */}
        <SettingCard
          icon="time-outline"
          title={t('admin.settings.workingHours.title')}
          description={t('admin.settings.workingHours.description')}
        >
          <TouchableOpacity
            style={styles.workingHoursButton}
            onPress={() => setShowWorkingHoursModal(true)}
          >
            <View style={styles.workingHoursInfo}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={styles.workingHoursText}>
                {settings.auto_close_enabled
                  ? t('admin.settings.workingHours.autoCloseEnabled')
                  : t('admin.settings.workingHours.autoCloseDisabled')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </SettingCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Kaydet Butonu (Save Button) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => setShowSaveModal(true)}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.saveButtonText}>{t('admin.settings.saveSettings')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Kaydetme Onay Modal (Save Confirmation Modal) */}
      <ConfirmModal
        visible={showSaveModal}
        title={t('admin.settings.modalTitle')}
        message={t('admin.settings.modalMessage')}
        confirmText={t('admin.settings.modalConfirm')}
        cancelText={t('admin.settings.modalCancel')}
        onConfirm={handleSaveSettings}
        onCancel={() => setShowSaveModal(false)}
        type="success"
      />

      {/* Çalışma Saatleri Modal (Working Hours Modal) */}
      <WorkingHoursModal
        visible={showWorkingHoursModal}
        workingHours={settings.working_hours || DEFAULT_WORKING_HOURS}
        autoCloseEnabled={settings.auto_close_enabled || false}
        onClose={() => setShowWorkingHoursModal(false)}
        onSave={handleSaveWorkingHours}
      />
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
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  settingCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: FontSizes.sm,
    color: '#666',
  },
  settingContent: {
    marginTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
  },
  inputPrefix: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: Spacing.md,
  },
  inputSuffix: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  helperText: {
    fontSize: FontSizes.xs,
    color: '#999',
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#333',
  },
  workingHoursButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: Spacing.medium,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  workingHoursInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.small,
  },
  workingHoursText: {
    fontSize: FontSizes.medium,
    color: Colors.text,
    fontWeight: '500',
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

export default AdminSettings;

