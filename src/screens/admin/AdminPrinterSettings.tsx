import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Colors, Shadows } from '../../constants/theme';
import {
  SavedPrinter,
  isPrinterModuleAvailable,
  getSavedPrinter,
  saveSelectedPrinter,
  clearSavedPrinter,
  isAutoPrintEnabled,
  setAutoPrintEnabled,
  discoverBluetoothPrinters,
  testPrint,
} from '../../services/printerService';

const AdminPrinterSettings = ({ navigation }: any) => {
  const { t } = useTranslation();

  const moduleAvailable = isPrinterModuleAvailable();

  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<SavedPrinter[]>([]);
  const [selected, setSelected] = useState<SavedPrinter | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [testing, setTesting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      setSelected(await getSavedPrinter());
      setAutoPrint(await isAutoPrintEnabled());
    })();
  }, []);

  const handleScan = useCallback(async () => {
    if (!moduleAvailable) {
      Toast.show({ type: 'error', text1: t('admin.printer.moduleUnavailable') });
      return;
    }
    setScanning(true);
    setFound([]);
    try {
      const printers = await discoverBluetoothPrinters(8000);
      setFound(printers);
      if (printers.length === 0) {
        Toast.show({ type: 'info', text1: t('admin.printer.noneFound') });
      }
    } catch (e: any) {
      const msg =
        e?.message === 'NO_PERMISSION'
          ? t('admin.printer.permissionDenied')
          : t('admin.printer.scanError');
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setScanning(false);
    }
  }, [moduleAvailable, t]);

  const handleSelect = useCallback(
    async (p: SavedPrinter) => {
      await saveSelectedPrinter(p);
      setSelected(p);
      Toast.show({ type: 'success', text1: t('admin.printer.saved'), text2: p.deviceName });
    },
    [t]
  );

  const handleClear = useCallback(async () => {
    await clearSavedPrinter();
    setSelected(null);
    Toast.show({ type: 'success', text1: t('admin.printer.cleared') });
  }, [t]);

  const handleToggleAuto = useCallback(async (v: boolean) => {
    setAutoPrint(v);
    await setAutoPrintEnabled(v);
  }, []);

  const handleTest = useCallback(async () => {
    if (!selected) return;
    setTesting(true);
    try {
      const res = await testPrint(selected);
      if (res.success) {
        Toast.show({ type: 'success', text1: t('admin.printer.testOk') });
      } else {
        Toast.show({ type: 'error', text1: t('admin.printer.testFailed'), text2: res.error });
      }
    } finally {
      setTesting(false);
    }
  }, [selected, t]);

  const isSelected = (p: SavedPrinter) => selected?.target === p.target;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.headerArea}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.printer.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {!moduleAvailable && (
          <Animated.View entering={FadeInDown} style={[styles.card, styles.warnCard]}>
            <Ionicons name="warning-outline" size={22} color="#B8860B" />
            <Text style={styles.warnText}>{t('admin.printer.moduleUnavailableDesc')}</Text>
          </Animated.View>
        )}

        {/* Seçili yazıcı (Selected printer) */}
        <Animated.View entering={FadeInDown.delay(50)} style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin.printer.currentPrinter')}</Text>
          {selected ? (
            <View style={styles.selectedRow}>
              <Ionicons name="print" size={22} color={Colors.success} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.printerName}>{selected.deviceName}</Text>
                <Text style={styles.printerTarget}>{selected.target}</Text>
              </View>
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.mutedText}>{t('admin.printer.noneSelected')}</Text>
          )}

          {selected && (
            <TouchableOpacity
              style={[styles.testBtn, testing && styles.btnDisabled]}
              onPress={handleTest}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={Colors.white} />
                  <Text style={styles.testBtnText}>{t('admin.printer.testPrint')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Otomatik yazdırma (Auto-print) */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.cardTitle}>{t('admin.printer.autoPrint')}</Text>
              <Text style={styles.mutedText}>{t('admin.printer.autoPrintDesc')}</Text>
            </View>
            <Switch
              value={autoPrint}
              onValueChange={handleToggleAuto}
              trackColor={{ true: Colors.primary }}
            />
          </View>
        </Animated.View>

        {/* Tarama (Scan) */}
        <Animated.View entering={FadeInDown.delay(150)} style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin.printer.availablePrinters')}</Text>
          <Text style={styles.mutedText}>{t('admin.printer.scanHint')}</Text>

          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.btnDisabled]}
            onPress={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="bluetooth" size={18} color={Colors.white} />
                <Text style={styles.scanBtnText}>{t('admin.printer.scan')}</Text>
              </>
            )}
          </TouchableOpacity>

          {found.map((p) => (
            <TouchableOpacity
              key={p.target}
              style={[styles.foundRow, isSelected(p) && styles.foundRowActive]}
              onPress={() => handleSelect(p)}
            >
              <Ionicons
                name={isSelected(p) ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isSelected(p) ? Colors.primary : Colors.textSecondary}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.printerName}>{p.deviceName}</Text>
                <Text style={styles.printerTarget}>{p.target}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        <Text style={styles.footerHint}>{t('admin.printer.pairHint')}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  headerArea: {
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 50) + 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...Shadows.small,
  },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warnText: { flex: 1, color: '#8A6D00', fontSize: 13, lineHeight: 18 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  mutedText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  printerName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  printerTarget: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  clearBtn: { padding: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 12,
  },
  scanBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  testBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#F4F5F7',
  },
  foundRowActive: { backgroundColor: Colors.primary + '12', borderWidth: 1, borderColor: Colors.primary + '40' },
  footerHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});

export default AdminPrinterSettings;
