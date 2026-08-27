import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  StatusBar,
  Dimensions,
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
import { getCurrencyInfo } from '../../services/currencyService';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface Settings {
  id: string;
  points_percentage: number;
  min_order_amount: number;
  // Mesafeye göre teslimat tarifesi (admin'den değiştirilebilir)
  delivery_tier1_max_km: number;
  delivery_tier1_fee: number;
  delivery_tier2_max_km: number;
  delivery_tier2_fee: number;
  is_open: boolean;
  auto_close_enabled?: boolean;
  working_hours?: WorkingHours;
  updated_at?: string;
}

const AdminSettings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  
  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    id: '',
    points_percentage: 5,
    min_order_amount: 50,
    delivery_tier1_max_km: 5,
    delivery_tier1_fee: 5.99,
    delivery_tier2_max_km: 8,
    delivery_tier2_fee: 8.99,
    is_open: true,
    auto_close_enabled: false,
    working_hours: DEFAULT_WORKING_HOURS,
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);

  // Input değerlerini ref'lerde tut (render tetiklemesin)
  const inputRefs = useRef({
    points_percentage: '5',
    min_order_amount: '50',
    delivery_tier1_max_km: '5',
    delivery_tier1_fee: '5.99',
    delivery_tier2_max_km: '8',
    delivery_tier2_fee: '8.99',
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();

      if (error) throw error;
      if (!data) {
        await createDefaultSettings();
        return;
      }

      setSettings({
        ...data,
        working_hours: data.working_hours || DEFAULT_WORKING_HOURS,
        auto_close_enabled: data.auto_close_enabled || false,
      });
      inputRefs.current = {
        points_percentage: String(data.points_percentage ?? 5),
        min_order_amount: String(data.min_order_amount ?? 50),
        delivery_tier1_max_km: String(data.delivery_tier1_max_km ?? 5),
        delivery_tier1_fee: String(data.delivery_tier1_fee ?? 5.99),
        delivery_tier2_max_km: String(data.delivery_tier2_max_km ?? 8),
        delivery_tier2_fee: String(data.delivery_tier2_fee ?? 8.99),
      };
    } catch (error: any) {
      console.error('Error:', error);
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.settings.errorLoading') });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const defaultSettings = {
        points_percentage: 5,
        min_order_amount: 50,
        delivery_tier1_max_km: 5,
        delivery_tier1_fee: 5.99,
        delivery_tier2_max_km: 8,
        delivery_tier2_fee: 8.99,
        is_open: true,
      };
      const { data, error } = await supabase.from('settings').insert(defaultSettings).select().single();
      if (error) throw error;
      setSettings(data);
    } catch (error: any) {
      console.error('Error defaults:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const pts = parseFloat(inputRefs.current.points_percentage) || 0;
      if (pts < 0 || pts > 100) {
        Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.settings.pointsPercentageError') });
        setSaving(false);
        return;
      }

      const tier1MaxKm = parseFloat(inputRefs.current.delivery_tier1_max_km) || 0;
      const tier2MaxKm = parseFloat(inputRefs.current.delivery_tier2_max_km) || 0;
      // Kademe 2 üst sınırı kademe 1'den büyük olmalı (aksi halde 2. kademe erişilemez)
      if (tier2MaxKm <= tier1MaxKm) {
        Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.settings.deliveryTierKmError') });
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.from('settings').update({
        points_percentage: pts,
        min_order_amount: parseFloat(inputRefs.current.min_order_amount) || 0,
        delivery_tier1_max_km: tier1MaxKm,
        delivery_tier1_fee: parseFloat(inputRefs.current.delivery_tier1_fee) || 0,
        delivery_tier2_max_km: tier2MaxKm,
        delivery_tier2_fee: parseFloat(inputRefs.current.delivery_tier2_fee) || 0,
        is_open: settings.is_open,
      }).eq('id', settings.id).select().single();

      if (error) throw error;
      setSettings(data);
      setShowSaveModal(false);
      Toast.show({ type: 'success', text1: t('admin.success'), text2: t('admin.settings.settingsSavedDesc') });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.settings.errorSaving') });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkingHours = async (workingHours: WorkingHours, autoCloseEnabled: boolean) => {
    try {
      const success = await updateWorkingHours(workingHours, autoCloseEnabled, settings.id);
      if (!success) throw new Error('Failed');
      setSettings({ ...settings, working_hours: workingHours, auto_close_enabled: autoCloseEnabled });
      Toast.show({ type: 'success', text1: t('admin.settings.workingHours.saved') });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.settings.workingHours.errorSaving') });
    }
  };

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

  const InputRow = ({ suffix, prefix, defaultValue, field, placeholder }: any) => (
      <View style={styles.inputRow}>
          {prefix && <Text style={styles.prefix}>{prefix}</Text>}
          <TextInput
            style={styles.input}
            defaultValue={defaultValue}
            onChangeText={(text) => { inputRefs.current[field as keyof typeof inputRefs.current] = text; }}
            placeholder={placeholder}
            placeholderTextColor="#CCC"
            keyboardType="numeric"
          />
          {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
  );

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
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.screenTitles.systemSettings')}</Text>
        </View>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('admin.screenTitles.systemSettings')}</Text>
            <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* RESTAURANT STATUS */}
        <SettingCard 
          delay={100}
          icon="storefront-outline" 
          title={t('admin.settings.restaurantStatusTitle')} 
          description={t('admin.settings.restaurantStatusDesc')}
        >
           <View style={styles.switchRow}>
              <Text style={[styles.statusText, { color: settings.is_open ? '#4CAF50' : '#F44336' }]}>
                  {settings.is_open ? t('admin.settings.statusOpen') : t('admin.settings.statusClosed')}
              </Text>
              <Switch
                value={settings.is_open}
                onValueChange={(val) => setSettings({ ...settings, is_open: val })}
                trackColor={{ false: '#EEE', true: Colors.primary + '50' }}
                thumbColor={settings.is_open ? Colors.primary : '#AAA'}
              />
           </View>
        </SettingCard>

        {/* POINTS */}
        <SettingCard 
          delay={200}
          icon="star-outline" 
          title={t('admin.settings.pointsEarningPercentage')} 
          description={t('admin.settings.pointsEarningDesc')}
        >
            <InputRow
                defaultValue={String(settings.points_percentage)}
                field="points_percentage"
                suffix="%"
                placeholder="5"
            />
        </SettingCard>

        {/* ORDER */}
        <SettingCard 
          delay={300}
          icon="cart-outline" 
          title={t('admin.settings.minOrderTitle')} 
          description={t('admin.settings.minOrderDesc')}
        >
            <InputRow
                prefix={getCurrencyInfo().symbol}
                defaultValue={String(settings.min_order_amount)}
                field="min_order_amount"
                placeholder="50"
            />
        </SettingCard>

        {/* DELIVERY — TIER 1 (yakın bölge) */}
        <SettingCard
          delay={400}
          icon="bicycle-outline"
          title={t('admin.settings.deliveryTier1Title')}
          description={t('admin.settings.deliveryTier1Desc')}
        >
            <View>
              <Text style={styles.fieldLabel}>{t('admin.settings.tierMaxKm')}</Text>
              <InputRow
                  suffix="km"
                  defaultValue={String(settings.delivery_tier1_max_km)}
                  field="delivery_tier1_max_km"
                  placeholder="5"
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>{t('admin.settings.tierFee')}</Text>
              <InputRow
                  prefix={getCurrencyInfo().symbol}
                  defaultValue={String(settings.delivery_tier1_fee)}
                  field="delivery_tier1_fee"
                  placeholder="5.99"
              />
            </View>
        </SettingCard>

        {/* DELIVERY — TIER 2 (uzak bölge) */}
        <SettingCard
          delay={500}
          icon="navigate-outline"
          title={t('admin.settings.deliveryTier2Title')}
          description={t('admin.settings.deliveryTier2Desc')}
        >
            <View>
              <Text style={styles.fieldLabel}>{t('admin.settings.tierMaxKm')}</Text>
              <InputRow
                  suffix="km"
                  defaultValue={String(settings.delivery_tier2_max_km)}
                  field="delivery_tier2_max_km"
                  placeholder="8"
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>{t('admin.settings.tierFee')}</Text>
              <InputRow
                  prefix={getCurrencyInfo().symbol}
                  defaultValue={String(settings.delivery_tier2_fee)}
                  field="delivery_tier2_fee"
                  placeholder="8.99"
              />
            </View>
            <View style={styles.tierNote}>
              <Ionicons name="information-circle-outline" size={16} color="#888" />
              <Text style={styles.tierNoteText}>{t('admin.settings.deliveryTiersNote')}</Text>
            </View>
        </SettingCard>

        {/* WORKING HOURS */}
        <SettingCard 
          delay={600}
          icon="time-outline" 
          title={t('admin.settings.workingHours.title')} 
          description={t('admin.settings.workingHours.description')}
        >
           <TouchableOpacity style={styles.hoursBtn} onPress={() => setShowWorkingHoursModal(true)}>
               <View style={styles.hoursInfo}>
                   <View style={[styles.smallIcon, settings.auto_close_enabled && {backgroundColor: Colors.primary+'20'}]}>
                       <Ionicons name="time" size={18} color={settings.auto_close_enabled ? Colors.primary : '#888'} />
                   </View>
                   <View>
                       <Text style={styles.hoursTitle}>{settings.auto_close_enabled ? t('admin.settings.workingHours.autoCloseEnabled') : t('admin.settings.workingHours.autoCloseDisabled')}</Text>
                       <Text style={styles.hoursSub}>{t('admin.settings.workingHours.tapToEdit')}</Text>
                   </View>
               </View>
               <Ionicons name="chevron-forward" size={18} color="#CCC" />
           </TouchableOpacity>
        </SettingCard>

        {/* Sürüm bilgisi — "hangi kod çalışıyor?" sorusunu bitirmek için.
            OTA güncellemeleri, mağaza sürümü ve dev sunucusu birbirinden
            ayırt edilemediği için testlerde sürekli belirsizlik yaşanıyordu. */}
        <SettingCard
          delay={700}
          icon="information-circle-outline"
          title={t('admin.settings.buildTitle')}
          description={t('admin.settings.buildDesc')}
        >
          {(() => {
            const dash = t('admin.settings.buildNone');
            // Updates.isEnabled dev/web'de false; updateId yalnızca OTA ile çalışırken dolu
            const source = !Updates.isEnabled
              ? t('admin.settings.buildSourceDev')
              : Updates.isEmbeddedLaunch
              ? t('admin.settings.buildSourceEmbedded')
              : t('admin.settings.buildSourceOta');
            const shortId = Updates.updateId ? Updates.updateId.slice(0, 8) : dash;
            const when = Updates.createdAt
              ? new Date(Updates.createdAt).toLocaleString()
              : dash;
            const rows: [string, string][] = [
              [t('admin.settings.buildAppVersion'), Constants.expoConfig?.version || dash],
              [t('admin.settings.buildSource'), source],
              [t('admin.settings.buildUpdate'), Updates.updateId ? `${shortId} · ${when}` : dash],
              [t('admin.settings.buildChannel'), Updates.channel || dash],
            ];
            return (
              <View>
                {rows.map(([label, value]) => (
                  <View key={label} style={styles.buildRow}>
                    <Text style={styles.buildLabel}>{label}</Text>
                    <Text style={styles.buildValue} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
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
                        <Text style={styles.saveText}>{t('admin.settings.saveSettings')}</Text>
                      </>
                  )}
              </LinearGradient>
          </TouchableOpacity>
      </View>

      <ConfirmModal visible={showSaveModal} title={t('admin.settings.modalTitle')} message={t('admin.settings.modalMessage')} confirmText={t('common.save')} cancelText={t('common.cancel')} onConfirm={handleSaveSettings} onCancel={() => setShowSaveModal(false)} type="success" />
      <WorkingHoursModal visible={showWorkingHoursModal} workingHours={settings.working_hours || DEFAULT_WORKING_HOURS} autoCloseEnabled={settings.auto_close_enabled || false} onClose={() => setShowWorkingHoursModal(false)} onSave={handleSaveWorkingHours} />
    </View>
  );
};

const styles = StyleSheet.create({
  buildRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 12 },
  buildLabel: { fontSize: 13, color: '#777' },
  buildValue: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1A1A1A', textAlign: 'right' },
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
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 12, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: '#EEE' },
  prefix: { fontSize: 16, fontWeight: '800', color: Colors.text, marginRight: 8 },
  suffix: { fontSize: 16, fontWeight: '800', color: '#999', marginLeft: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  tierNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F4F6F8', borderRadius: 12, padding: 12 },
  tierNoteText: { flex: 1, fontSize: 12, color: '#777', lineHeight: 17 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  statusText: { fontSize: 16, fontWeight: '800' },
  hoursBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9F9F9', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EEE' },
  hoursInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
  hoursTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  hoursSub: { fontSize: 11, color: '#999' },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: '#EEE' },
  saveBtn: { height: 56, borderRadius: 20, ...Shadows.large },
  saveGrad: { flex: 1, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
});

export default AdminSettings;
