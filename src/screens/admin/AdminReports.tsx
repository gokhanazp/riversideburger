import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Colors, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../services/currencyService';

// Admin raporları. Toplamlar SUNUCUDA hesaplanıyor (report_* SQL
// fonksiyonları, 20260930120000_admin_reports.sql); buraya yalnızca sonuç
// satırları geliyor. Grafikler düz View'larla çizildi: react-native-svg
// projede yok ve eklemek mağaza sürümü gerektirir — bu ekran OTA ile gidiyor.

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'year' | 'custom';
type Bucket = 'day' | 'week' | 'month';
type StatusFilter = 'all' | 'delivered' | 'in_progress' | 'cancelled';
// null = ödenmiş ve iptal edilmemiş (varsayılan). Kümeler sunucudaki
// report_order_matches ile aynı anlamı taşıyor.
const STATUS_SETS: Record<StatusFilter, string[] | null> = {
  all: null,
  delivered: ['delivered'],
  in_progress: ['pending', 'confirmed', 'preparing', 'ready', 'delivering'],
  cancelled: ['cancelled'],
};
const TZ = 'America/Toronto';

// Toronto saat dilimi, Intl'siz. Hermes (React Native'in JS motoru)
// "new Date(toLocaleString(...))" biçimini ayrıştıramıyor; ilk sürümde bu
// yüzden tarih NaN oldu ve ekran sonsuza kadar "yükleniyor"da kaldı.
// Toronto = UTC−5, yaz saatinde UTC−4. DST: Mart'ın 2. Pazarı 02:00 (yerel)
// başlar, Kasım'ın 1. Pazarı 02:00 (yerel) biter.
function nthSunday(year: number, month0: number, nth: number): number {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (nth - 1) * 7;
}
function torontoOffsetMin(utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear();
  const dstStart = Date.UTC(y, 2, nthSunday(y, 2, 2), 7, 0, 0); // 02:00 EST = 07:00 UTC
  const dstEnd = Date.UTC(y, 10, nthSunday(y, 10, 1), 6, 0, 0); // 02:00 EDT = 06:00 UTC
  return utcMs >= dstStart && utcMs < dstEnd ? -240 : -300;
}
// Toronto yerel gece yarısı → UTC Date.
function torontoMidnight(y: number, m: number, d: number): Date {
  const naive = Date.UTC(y, m, d, 0, 0, 0);
  let off = torontoOffsetMin(naive + 5 * 3600000);
  let utc = naive - off * 60000;
  const off2 = torontoOffsetMin(utc);
  if (off2 !== off) utc = naive - off2 * 60000;
  return new Date(utc);
}
function torontoToday(): { y: number; m: number; d: number } {
  const now = Date.now();
  const local = new Date(now + torontoOffsetMin(now) * 60000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}
const addDays = (dt: Date, n: number) => new Date(dt.getTime() + n * 86400000);
const parseYmd = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const dt = torontoMidnight(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(dt.getTime()) ? null : dt;
};

function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: Date; to: Date } | null {
  const t = torontoToday();
  const today = torontoMidnight(t.y, t.m, t.d);
  switch (preset) {
    case 'today': return { from: today, to: addDays(today, 1) };
    case 'yesterday': return { from: addDays(today, -1), to: today };
    case '7d': return { from: addDays(today, -6), to: addDays(today, 1) };
    case '30d': return { from: addDays(today, -29), to: addDays(today, 1) };
    case 'month': return { from: torontoMidnight(t.y, t.m, 1), to: addDays(today, 1) };
    case 'lastMonth': return { from: torontoMidnight(t.y, t.m - 1, 1), to: torontoMidnight(t.y, t.m, 1) };
    case 'year': return { from: torontoMidnight(t.y, 0, 1), to: addDays(today, 1) };
    case 'custom': {
      const f = parseYmd(customFrom); const to = parseYmd(customTo);
      if (!f || !to || to < f) return null;
      return { from: f, to: addDays(to, 1) }; // bitiş günü dahil
    }
  }
}

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const n = (v: unknown) => Number(v) || 0;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (iso: string, bucket: Bucket) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const mon = MONTHS[Number(m[2]) - 1] ?? m[2];
  return bucket === 'month' ? `${mon} ${m[1].slice(2)}` : `${Number(m[3])} ${mon}`;
};

export default function AdminReports() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [preset, setPreset] = useState<Preset>('30d');
  const [bucket, setBucket] = useState<Bucket | 'auto'>('auto');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const days = range ? Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86400000)) : 0;
  const effBucket: Bucket = bucket !== 'auto' ? bucket : days <= 31 ? 'day' : days <= 180 ? 'week' : 'month';

  const load = useCallback(async (silent = false) => {
    if (!range) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime())) throw new Error('invalid date range');
      const p_statuses = STATUS_SETS[statusFilter];
      const p = { p_from: range.from.toISOString(), p_to: range.to.toISOString(), p_statuses };
      const prevFrom = new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime()));
      const prev = { p_from: prevFrom.toISOString(), p_to: range.from.toISOString(), p_statuses };
      const [summary, prevSummary, series, products, options, customers, hours, channels, delivery, statuses] = await Promise.all([
        supabase.rpc('report_summary', p),
        supabase.rpc('report_summary', prev),
        supabase.rpc('report_timeseries', { ...p, p_bucket: effBucket }),
        supabase.rpc('report_top_products', { ...p, p_limit: 10 }),
        supabase.rpc('report_top_options', { ...p, p_limit: 8 }),
        supabase.rpc('report_customers', { ...p, p_limit: 20 }),
        supabase.rpc('report_hours', p),
        supabase.rpc('report_channels', p),
        supabase.rpc('report_delivery', p),
        // Durum dağılımı filtreden BAĞIMSIZ: filtre "iptal" seçiliyken bile
        // dönemin tamamı görünsün.
        supabase.rpc('report_status_breakdown', { p_from: p.p_from, p_to: p.p_to }),
      ]);
      const firstErr = [summary, prevSummary, series, products, options, customers, hours, channels, delivery, statuses].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setData({
        summary: summary.data?.[0] ?? {},
        prev: prevSummary.data?.[0] ?? {},
        series: series.data ?? [],
        products: products.data ?? [],
        options: options.data ?? [],
        customers: customers.data ?? [],
        hours: hours.data ?? [],
        channels: channels.data ?? [],
        delivery: delivery.data?.[0] ?? {},
        statuses: statuses.data ?? [],
      });
    } catch (e: any) {
      const msg = e?.message ?? t('admin.reports.loadError');
      setError(msg);
      Toast.show({ type: 'error', text1: t('admin.error'), text2: msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, effBucket, statusFilter, t]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    if (!data) return;
    const lines = [
      ['bucket', 'orders', 'revenue', 'pickup', 'delivery', 'web', 'app', 'cancelled'].join(','),
      ...data.series.map((r: any) => [r.bucket, r.orders, r.revenue, r.pickup, r.delivery, r.web, r.app, r.cancelled].join(',')),
      '',
      ['product', 'category', 'qty', 'revenue', 'share_pct'].join(','),
      ...data.products.map((r: any) => [`"${r.name}"`, `"${r.category ?? ''}"`, r.qty, r.revenue, r.share_pct].join(',')),
    ];
    await Share.share({ title: 'riverside-report.csv', message: lines.join('\n') });
  };

  const S = data?.summary ?? {};
  const P = data?.prev ?? {};
  const dOrders = pct(n(S.orders), n(P.orders));
  const dRevenue = pct(n(S.revenue), n(P.revenue));

  // Ödeme yöntemi: kanallar tablosundan yönteme göre topla.
  const byMethod = useMemo(() => {
    const m: Record<string, { orders: number; revenue: number }> = {};
    for (const r of data?.channels ?? []) {
      const k = r.payment_method || 'unknown';
      m[k] = m[k] || { orders: 0, revenue: 0 };
      m[k].orders += n(r.orders); m[k].revenue += n(r.revenue);
    }
    return Object.entries(m).sort((a, b) => b[1].orders - a[1].orders);
  }, [data]);

  // Saat dağılımı: günlerden bağımsız 0–23.
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, () => 0);
    for (const r of data?.hours ?? []) arr[n(r.hour)] += n(r.orders);
    return arr;
  }, [data]);
  const byDow = useMemo(() => {
    const arr = Array.from({ length: 7 }, () => 0);
    for (const r of data?.hours ?? []) arr[n(r.dow) - 1] += n(r.orders);
    return arr;
  }, [data]);

  const presets: { key: Preset; label: string }[] = [
    { key: 'today', label: t('admin.reports.today') },
    { key: 'yesterday', label: t('admin.reports.yesterday') },
    { key: '7d', label: t('admin.reports.last7') },
    { key: '30d', label: t('admin.reports.last30') },
    { key: 'month', label: t('admin.reports.thisMonth') },
    { key: 'lastMonth', label: t('admin.reports.lastMonth') },
    { key: 'year', label: t('admin.reports.thisYear') },
    { key: 'custom', label: t('admin.reports.custom') },
  ];

  const Delta = ({ v }: { v: number | null }) =>
    v === null ? null : (
      <Text style={[styles.delta, { color: v >= 0 ? '#28A745' : Colors.primary }]}>{v >= 0 ? '▲' : '▼'} {Math.abs(v)}%</Text>
    );

  const Bars = ({ rows, valueKey, labelKey, money }: { rows: any[]; valueKey: string; labelKey: string; money?: boolean }) => {
    const max = Math.max(1, ...rows.map((r) => n(r[valueKey])));
    const every = rows.length > 14 ? Math.ceil(rows.length / 7) : 1;
    return (
      <View style={styles.barsWrap}>
        {rows.map((r, i) => {
          const v = n(r[valueKey]);
          return (
            <View key={i} style={styles.barCol}>
              {rows.length <= 14 && (
                <Text style={styles.barValue} numberOfLines={1}>{money ? Math.round(v) : v}</Text>
              )}
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max(3, (v / max) * 100)}%` }]} />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>{i % every === 0 ? shortDay(r[labelKey], effBucket) : ''}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const Split = ({ a, b, labelA, labelB, colorA = Colors.primary, colorB = '#4DACFF' }: { a: number; b: number; labelA: string; labelB: string; colorA?: string; colorB?: string }) => {
    const total = a + b;
    const pa = total ? Math.round((a / total) * 100) : 0;
    return (
      <View style={{ marginTop: 8 }}>
        <View style={styles.splitTrack}>
          <View style={[styles.splitA, { flex: Math.max(pa, 1), backgroundColor: colorA }]} />
          <View style={[styles.splitB, { flex: Math.max(100 - pa, 1), backgroundColor: colorB }]} />
        </View>
        <View style={styles.splitLegend}>
          <Text style={styles.legendText}><Text style={{ color: colorA }}>●</Text> {labelA} {a} ({pa}%)</Text>
          <Text style={styles.legendText}><Text style={{ color: colorB }}>●</Text> {labelB} {b} ({100 - pa}%)</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.topSection}>
        <View style={styles.breadcrumb}>
          <Text style={styles.breadText}>Admin</Text>
          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
          <Text style={[styles.breadText, styles.breadActive]}>{t('admin.reports.title')}</Text>
        </View>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('admin.reports.title')}</Text>
          <TouchableOpacity onPress={exportCsv} style={styles.roundBtn} disabled={!data}>
            <Ionicons name="share-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerStatsRow}>
          <View style={styles.headerStat}>
            <Text style={styles.statVal}>{n(S.orders)}</Text>
            <Text style={styles.statLabel}>{t('admin.reports.orders')}</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.statVal}>{formatPrice(n(S.revenue))}</Text>
            <Text style={styles.statLabel}>{t('admin.reports.revenue')}</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.statVal}>{formatPrice(n(S.avg_order))}</Text>
            <Text style={styles.statLabel}>{t('admin.reports.avgOrder')}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* style={flexGrow: 0} ŞART: yatay ScrollView aksi halde dikeyde
          sıkıştırılıyor (alttaki liste yeri alıyor) ve çip yazıları kırpılıyor. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.chipsRow}>
        {presets.map((p) => (
          <TouchableOpacity key={p.key} onPress={() => setPreset(p.key)} style={[styles.chip, preset === p.key && styles.chipActive]}>
            <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.statusRow}>
        {(['all', 'delivered', 'in_progress', 'cancelled'] as StatusFilter[]).map((k) => (
          <TouchableOpacity key={k} onPress={() => setStatusFilter(k)} style={[styles.statusChip, statusFilter === k && styles.statusChipActive]}>
            <Text style={[styles.statusChipText, statusFilter === k && styles.statusChipTextActive]}>{t(`admin.reports.status_${k}`)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {preset === 'custom' && (
        <View style={styles.customRow}>
          <TextInput value={customFrom} onChangeText={setCustomFrom} placeholder="2026-09-01" placeholderTextColor="#AAA" style={styles.dateInput} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          <Text style={{ color: '#888' }}>→</Text>
          <TextInput value={customTo} onChangeText={setCustomTo} placeholder="2026-09-30" placeholderTextColor="#AAA" style={styles.dateInput} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          {!range && <Text style={styles.hint}>{t('admin.reports.customHint')}</Text>}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={Colors.primary} />}
      >
        {loading && !data ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : !data ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admin.reports.loadError')}</Text>
            {error ? <Text style={styles.cardSub}>{error}</Text> : null}
            <TouchableOpacity onPress={() => void load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>{t('admin.reports.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* KPI */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.orders')}</Text><Text style={styles.kpiVal}>{n(S.orders)}</Text><Delta v={dOrders} /></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.revenue')}</Text><Text style={styles.kpiVal}>{formatPrice(n(S.revenue))}</Text><Delta v={dRevenue} /></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.newCustomers')}</Text><Text style={styles.kpiVal}>{n(S.new_customers)}</Text><Text style={styles.kpiSub}>{t('admin.reports.returning')}: {n(S.returning_customers)}</Text></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.cancelled')}</Text><Text style={styles.kpiVal}>{n(S.cancelled)}</Text></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.discounts')}</Text><Text style={styles.kpiVal}>{formatPrice(n(S.discount_total))}</Text></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.tips')}</Text><Text style={styles.kpiVal}>{formatPrice(n(S.tips))}</Text></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.pointsUsed')}</Text><Text style={styles.kpiVal}>{formatPrice(n(S.points_used))}</Text></View>
              <View style={styles.kpi}><Text style={styles.kpiLabel}>{t('admin.reports.pointsEarned')}</Text><Text style={styles.kpiVal}>{formatPrice(n(S.points_earned))}</Text></View>
            </View>
            <Text style={styles.prevNote}>{t('admin.reports.vsPrevious', { days })}</Text>

            {/* Durum dağılımı */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.reports.statusBreakdown')}</Text>
              {data.statuses.map((r: any) => (
                <View key={r.status} style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>{t(`admin.reports.st_${r.status}`, { defaultValue: r.status })}</Text>
                  <Text style={styles.rowVal}>{n(r.orders)} · {formatPrice(n(r.revenue))}</Text>
                </View>
              ))}
              {statusFilter !== 'all' && <Text style={styles.hint}>{t('admin.reports.statusFilterHint', { filter: t(`admin.reports.status_${statusFilter}`) })}</Text>}
            </View>

            {/* Satış zaman serisi */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{t('admin.reports.salesOverTime')}</Text>
                <View style={styles.bucketRow}>
                  {(['auto', 'day', 'week', 'month'] as const).map((b) => (
                    <TouchableOpacity key={b} onPress={() => setBucket(b)} style={[styles.bucketChip, bucket === b && styles.bucketChipActive]}>
                      <Text style={[styles.bucketText, bucket === b && styles.bucketTextActive]}>{t(`admin.reports.bucket_${b}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={styles.cardSub}>{t('admin.reports.revenueByBucket', { bucket: t(`admin.reports.bucket_${effBucket}`) })}</Text>
              {data.series.length ? <Bars rows={data.series} valueKey="revenue" labelKey="bucket" money /> : <Text style={styles.empty}>{t('admin.reports.noData')}</Text>}
              <Text style={[styles.cardSub, { marginTop: 14 }]}>{t('admin.reports.ordersByBucket')}</Text>
              {data.series.length ? <Bars rows={data.series} valueKey="orders" labelKey="bucket" /> : null}
            </View>

            {/* Kanal ve teslimat */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.reports.pickupVsDelivery')}</Text>
              <Split a={n(S.pickup)} b={n(S.delivery)} labelA={t('admin.reports.pickup')} labelB={t('admin.reports.delivery')} />
              <Text style={[styles.cardTitle, { marginTop: 18 }]}>{t('admin.reports.webVsApp')}</Text>
              <Split a={n(S.web)} b={n(S.app)} labelA="Web" labelB="App" colorA="#0D6EFD" colorB="#6F42C1" />
              {n(data.delivery.delivery_orders) > 0 && (
                <View style={styles.deliveryBox}>
                  <Text style={styles.cardSub}>{t('admin.reports.deliveryEconomics')}</Text>
                  <View style={styles.rowBetween}><Text style={styles.rowLabel}>{t('admin.reports.chargedToCustomers')}</Text><Text style={styles.rowVal}>{formatPrice(n(data.delivery.charged_delivery))}</Text></View>
                  <View style={styles.rowBetween}><Text style={styles.rowLabel}>{t('admin.reports.uberCost')}</Text><Text style={styles.rowVal}>{formatPrice(n(data.delivery.uber_cost))}</Text></View>
                  <View style={styles.rowBetween}><Text style={[styles.rowLabel, { fontWeight: '800', color: Colors.text }]}>{t('admin.reports.netDelivery')}</Text><Text style={[styles.rowVal, { color: n(data.delivery.net_delivery) < 0 ? Colors.primary : '#28A745' }]}>{formatPrice(n(data.delivery.net_delivery))}</Text></View>
                </View>
              )}
            </View>

            {/* Ödeme yöntemi */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.reports.paymentMethods')}</Text>
              {byMethod.map(([k, v]) => (
                <View key={k} style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>{t(`admin.reports.pm_${k}`, { defaultValue: k })}</Text>
                  <Text style={styles.rowVal}>{v.orders} · {formatPrice(v.revenue)}</Text>
                </View>
              ))}
              {byMethod.some(([k]) => k === 'unknown') && <Text style={styles.hint}>{t('admin.reports.pmUnknownHint')}</Text>}
            </View>

            {/* En çok satanlar */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.reports.topProducts')}</Text>
              {data.products.map((r: any, i: number) => (
                <View key={r.product_id ?? i} style={styles.rankRow}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.rankName} numberOfLines={1}>{r.name}</Text>
                      <Text style={styles.rowVal}>{n(r.qty)} · {formatPrice(n(r.revenue))}</Text>
                    </View>
                    <View style={styles.shareTrack}><View style={[styles.shareFill, { width: `${Math.min(100, n(r.share_pct))}%` }]} /></View>
                    <Text style={styles.rankMeta}>{r.category ?? ''} · {n(r.share_pct)}%</Text>
                  </View>
                </View>
              ))}
              {data.options.length > 0 && (
                <>
                  <Text style={[styles.cardSub, { marginTop: 12 }]}>{t('admin.reports.topOptions')}</Text>
                  {data.options.map((r: any, i: number) => (
                    <View key={i} style={styles.rowBetween}><Text style={styles.rowLabel}>{r.option_name}</Text><Text style={styles.rowVal}>{n(r.qty)}{n(r.revenue) > 0 ? ` · ${formatPrice(n(r.revenue))}` : ''}</Text></View>
                  ))}
                </>
              )}
            </View>

            {/* Müşteriler */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.reports.repeatCustomers')}</Text>
              <Text style={styles.cardSub}>{t('admin.reports.repeatHint')}</Text>
              {data.customers.map((c: any) => (
                <View key={c.user_id} style={styles.custRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankName} numberOfLines={1}>{c.name || c.email || '—'}{c.is_guest ? '  ·  ' + t('admin.users.sourceGuest') : ''}</Text>
                    <Text style={styles.rankMeta}>{t('admin.reports.lifetime')}: {n(c.lifetime_orders)} · {formatPrice(n(c.lifetime_spent))} · {t('admin.reports.lastOrderDaysAgo', { days: n(c.days_since_last) })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowVal}>{n(c.orders_in_period)}</Text>
                    {n(c.lifetime_orders) >= 2 && n(c.days_since_last) > 30 && <Text style={styles.atRisk}>{t('admin.reports.atRisk')}</Text>}
                  </View>
                </View>
              ))}
            </View>

            {/* Yoğun saatler */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.reports.busiestHours')}</Text>
              <View style={styles.hoursRow}>
                {byHour.map((v, h) => {
                  const max = Math.max(1, ...byHour);
                  return (
                    <View key={h} style={styles.hourCol}>
                      <View style={[styles.hourFill, { height: 4 + (v / max) * 44, opacity: v ? 0.35 + 0.65 * (v / max) : 0.12 }]} />
                      {h % 3 === 0 && <Text style={styles.hourLabel}>{h}</Text>}
                    </View>
                  );
                })}
              </View>
              <View style={styles.dowRow}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
                  const max = Math.max(1, ...byDow);
                  return (
                    <View key={d} style={styles.dowItem}>
                      <View style={[styles.dowDot, { opacity: byDow[i] ? 0.25 + 0.75 * (byDow[i] / max) : 0.1 }]} />
                      <Text style={styles.hourLabel}>{d}</Text>
                      <Text style={styles.dowVal}>{byDow[i]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topSection: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, opacity: 0.8 },
  breadText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: Colors.white, opacity: 1 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.white },
  headerStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headerStat: { flex: 1 },
  statVal: { fontSize: 17, fontWeight: '900', color: Colors.white },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  hScroll: { flexGrow: 0, flexShrink: 0 },
  chipsRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#EEE' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: '#666' },
  chipTextActive: { color: Colors.white },
  statusRow: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, alignItems: 'center' },
  statusChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: '#F1F3F5' },
  statusChipActive: { backgroundColor: Colors.text },
  statusChipText: { fontSize: 12, fontWeight: '700', color: '#666' },
  statusChipTextActive: { color: Colors.white },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8, flexWrap: 'wrap' },
  dateInput: { flex: 1, minWidth: 120, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', paddingHorizontal: 12, height: 42, fontSize: 14, color: Colors.text },
  hint: { fontSize: 11, color: '#999', marginTop: 6, width: '100%' },
  body: { padding: 20, paddingTop: 6, paddingBottom: 48 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', flexGrow: 1, backgroundColor: Colors.white, borderRadius: 18, padding: 14, ...Shadows.small },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.3 },
  kpiVal: { fontSize: 20, fontWeight: '900', color: Colors.text, marginTop: 4 },
  kpiSub: { fontSize: 11, color: '#888', marginTop: 2 },
  delta: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  prevNote: { fontSize: 11, color: '#999', marginTop: 8, marginBottom: 4, marginLeft: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 22, padding: 16, marginTop: 14, ...Shadows.small },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  cardSub: { fontSize: 12, color: '#888', marginTop: 4, marginBottom: 6 },
  bucketRow: { flexDirection: 'row', gap: 6 },
  bucketChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F3F5' },
  bucketChipActive: { backgroundColor: Colors.text },
  bucketText: { fontSize: 11, fontWeight: '700', color: '#666' },
  bucketTextActive: { color: Colors.white },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4, marginTop: 6 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 9, color: '#888', marginBottom: 2 },
  barTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: Colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 9, color: '#999', marginTop: 4, height: 12 },
  splitTrack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#EEE' },
  splitA: { height: '100%' },
  splitB: { height: '100%' },
  splitLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legendText: { fontSize: 12, color: '#555', fontWeight: '600' },
  deliveryBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F3F5', paddingTop: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 12 },
  rowLabel: { fontSize: 13, color: '#555', flex: 1 },
  rowVal: { fontSize: 13, fontWeight: '800', color: Colors.text },
  rankRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rank: { width: 22, fontSize: 13, fontWeight: '900', color: '#BBB', textAlign: 'center', marginTop: 6 },
  rankName: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  rankMeta: { fontSize: 11, color: '#999', marginTop: 4 },
  shareTrack: { height: 5, borderRadius: 3, backgroundColor: '#F1F3F5', marginTop: 6, overflow: 'hidden' },
  shareFill: { height: '100%', backgroundColor: Colors.primary },
  custRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  atRisk: { fontSize: 10, fontWeight: '800', color: '#E8590C', marginTop: 4 },
  hoursRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 72, marginTop: 8 },
  hourCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hourFill: { width: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  hourLabel: { fontSize: 9, color: '#999', marginTop: 4 },
  dowRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dowItem: { alignItems: 'center', flex: 1 },
  dowDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary },
  dowVal: { fontSize: 11, fontWeight: '800', color: Colors.text },
  empty: { fontSize: 13, color: '#999', paddingVertical: 12 },
  retryBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: Colors.white, fontWeight: '800' },
});
