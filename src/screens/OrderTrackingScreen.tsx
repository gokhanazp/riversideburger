import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Shadows } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';

const MAPTILER_KEY = (Constants.expoConfig?.extra?.mapTilerKey as string) ?? '';
const MAP_STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

const MAPS_ENABLED = (Constants.expoConfig?.extra?.mapsEnabled as boolean) === true;
let MapLibreGL: any = null;
if (MAPS_ENABLED) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapLibreGL = require('@maplibre/maplibre-react-native').default;
}

const RESTAURANT_NAME = 'Riverside Burgers';
const RESTAURANT_LAT = 43.6588015;
const RESTAURANT_LNG = -79.3506881;

type StatusKey = 'pending' | 'pickup' | 'pickup_complete' | 'dropoff' | 'delivered' | 'canceled' | 'returned';

interface OrderRow {
  id: string;
  order_number?: string | null;
  status: string;
  uber_status: StatusKey | null;
  uber_tracking_url: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_full_name: string | null;
  delivery_fee: number | null;
  pickup_eta: string | null;
  dropoff_eta: string | null;
  courier_name: string | null;
  courier_phone: string | null;
  courier_image_url: string | null;
  courier_vehicle_make: string | null;
  courier_vehicle_model: string | null;
  courier_vehicle_color: string | null;
  courier_license_plate: string | null;
  courier_lat: number | null;
  courier_lng: number | null;
  total_amount: number;
}

const STATUS_STEPS: { key: StatusKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'pending',         icon: 'receipt' },
  { key: 'pickup',          icon: 'restaurant' },
  { key: 'pickup_complete', icon: 'bicycle' },
  { key: 'dropoff',         icon: 'navigate' },
  { key: 'delivered',       icon: 'checkmark-circle' },
];

function statusIndex(status: string | null): number {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function formatEta(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-CA';
  return d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 0;
  return Math.max(1, Math.round(diff / 60000));
}

const OrderTrackingScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderTracking'>>();
  const insets = useSafeAreaInsets();
  const orderId = route.params.orderId;

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('orders')
      .select(
        'id, order_number, status, uber_status, uber_tracking_url, delivery_lat, delivery_lng, delivery_full_name, delivery_fee, pickup_eta, dropoff_eta, courier_name, courier_phone, courier_image_url, courier_vehicle_make, courier_vehicle_model, courier_vehicle_color, courier_license_plate, courier_lat, courier_lng, total_amount',
      )
      .eq('id', orderId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Order load failed:', error);
        else setOrder(data as OrderRow);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev) => ({ ...(prev ?? {} as OrderRow), ...(payload.new as OrderRow) }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const cameraBounds = useMemo(() => {
    if (!order) return null;
    const points: [number, number][] = [[RESTAURANT_LNG, RESTAURANT_LAT]];
    if (order.delivery_lat != null && order.delivery_lng != null) points.push([order.delivery_lng, order.delivery_lat]);
    if (order.courier_lat != null && order.courier_lng != null) points.push([order.courier_lng, order.courier_lat]);
    if (points.length === 1) return null;
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    };
  }, [order]);

  useEffect(() => {
    if (!cameraBounds || !cameraRef.current) return;
    cameraRef.current.fitBounds(cameraBounds.ne, cameraBounds.sw, [80, 80, 240, 80], 600);
  }, [cameraBounds]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>{t('tracking.loading') || 'Sipariş yükleniyor...'}</Text>
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="alert-circle" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.errorTitle}>{t('tracking.orderNotFound')}</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color="#FFF" />
          <Text style={styles.errorBackText}>{t('common.back') || 'Geri'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = statusIndex(order.uber_status);
  const isCanceled = order.uber_status === 'canceled' || order.uber_status === 'returned';
  const isDelivered = order.uber_status === 'delivered';
  const minsLeft = minutesUntil(order.dropoff_eta);
  const currentStatusKey = STATUS_STEPS[currentStep]?.key;

  return (
    <View style={styles.root}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {MAPS_ENABLED && MapLibreGL ? (
          <MapLibreGL.MapView style={styles.map} styleURL={MAP_STYLE_URL} logoEnabled={false}>
            <MapLibreGL.Camera
              ref={(r: any) => { cameraRef.current = r; }}
              defaultSettings={{
                centerCoordinate: [RESTAURANT_LNG, RESTAURANT_LAT],
                zoomLevel: 13,
              }}
            />
            <MapLibreGL.PointAnnotation id="restaurant" coordinate={[RESTAURANT_LNG, RESTAURANT_LAT]}>
              <View style={styles.pinRestaurant}>
                <Ionicons name="restaurant" size={16} color="#FFF" />
              </View>
            </MapLibreGL.PointAnnotation>
            {order.delivery_lat != null && order.delivery_lng != null && (
              <MapLibreGL.PointAnnotation id="customer" coordinate={[order.delivery_lng, order.delivery_lat]}>
                <View style={styles.pinCustomer}>
                  <Ionicons name="home" size={16} color="#FFF" />
                </View>
              </MapLibreGL.PointAnnotation>
            )}
            {order.courier_lat != null && order.courier_lng != null && (
              <MapLibreGL.PointAnnotation id="courier" coordinate={[order.courier_lng, order.courier_lat]}>
                <View style={styles.pinCourier}>
                  <View style={styles.pinCourierPulse} />
                  <Ionicons name="bicycle" size={18} color="#FFF" />
                </View>
              </MapLibreGL.PointAnnotation>
            )}
          </MapLibreGL.MapView>
        ) : (
          <View style={styles.mapFallback}>
            <View style={styles.mapFallbackIconWrap}>
              <Ionicons name="map" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.mapFallbackTitle}>{t('tracking.mapPendingTitle')}</Text>
            <Text style={styles.mapFallbackSubtitle}>{t('tracking.mapPendingSubtitle')}</Text>
          </View>
        )}

        {/* Floating header buttons */}
        <View style={[styles.mapHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.floatingBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={styles.floatingTitle}>
            <Text style={styles.floatingTitleText}>{t('tracking.title')}</Text>
            {order.order_number && (
              <Text style={styles.floatingSubtitle}>#{order.order_number}</Text>
            )}
          </View>
          {order.uber_tracking_url ? (
            <TouchableOpacity
              style={styles.floatingBtn}
              onPress={() => Linking.openURL(order.uber_tracking_url!)}
            >
              <Ionicons name="open-outline" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.floatingBtn} />
          )}
        </View>
      </View>

      {/* Bottom sheet */}
      <ScrollView
        style={styles.bottomSheet}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 18, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ETA Hero Card */}
        <View
          style={[
            styles.etaCard,
            isCanceled && styles.etaCardCanceled,
            isDelivered && styles.etaCardDelivered,
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.etaLabel}>
              {isCanceled
                ? t('tracking.canceled')
                : isDelivered
                ? t('tracking.status.delivered')
                : t('tracking.etaLabel')}
            </Text>
            {!isCanceled && !isDelivered && (
              <>
                <Text style={styles.etaTime}>{formatEta(order.dropoff_eta, i18n.language)}</Text>
                {minsLeft != null && (
                  <Text style={styles.etaSubtext}>
                    {minsLeft === 0
                      ? t('tracking.arrivingNow') || 'Şu anda geliyor'
                      : `${t('tracking.arrivesIn') || 'Tahmini'} ${minsLeft} ${t('tracking.minutes') || 'dakika'}`}
                  </Text>
                )}
              </>
            )}
            {isDelivered && (
              <Text style={styles.etaSubtext}>{t('tracking.deliveredAt') || 'Sipariş başarıyla teslim edildi'}</Text>
            )}
            {isCanceled && (
              <Text style={styles.etaSubtext}>{t('tracking.canceledNote') || 'Bu sipariş iptal edildi'}</Text>
            )}
          </View>
          <View style={styles.etaIconWrap}>
            <Ionicons
              name={isCanceled ? 'close-circle' : isDelivered ? 'checkmark-done-circle' : 'bicycle'}
              size={36}
              color="#FFF"
            />
          </View>
        </View>

        {/* Status timeline */}
        {!isCanceled && (
          <View style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineHeaderText}>
                {currentStatusKey ? t(`tracking.status.${currentStatusKey}`) : ''}
              </Text>
              <View style={styles.stepCounter}>
                <Text style={styles.stepCounterText}>
                  {currentStep + 1}/{STATUS_STEPS.length}
                </Text>
              </View>
            </View>

            <View style={styles.timelineRow}>
              {STATUS_STEPS.map((step, idx) => {
                const isActive = idx <= currentStep;
                const isCurrent = idx === currentStep && !isDelivered;
                const isLast = idx === STATUS_STEPS.length - 1;
                return (
                  <View key={step.key} style={styles.timelineItem}>
                    <View style={styles.timelineDotWrap}>
                      {isCurrent && <View style={styles.timelineDotPulse} />}
                      <View
                        style={[
                          styles.timelineDot,
                          isActive && styles.timelineDotActive,
                        ]}
                      >
                        <Ionicons name={step.icon} size={15} color={isActive ? '#FFF' : '#BBB'} />
                      </View>
                    </View>
                    {!isLast && (
                      <View style={[styles.timelineLine, idx < currentStep && styles.timelineLineActive]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Courier card */}
        {order.courier_name ? (
          <View style={styles.courierCard}>
            <View style={styles.courierTop}>
              <Text style={styles.courierLabel}>
                {t('tracking.courierLabel') || 'KURYE'}
              </Text>
              <View style={styles.courierLiveBadge}>
                <View style={styles.courierLiveDot} />
                <Text style={styles.courierLiveText}>{t('tracking.live') || 'CANLI'}</Text>
              </View>
            </View>

            <View style={styles.courierMain}>
              {order.courier_image_url ? (
                <Image source={{ uri: order.courier_image_url }} style={styles.courierAvatar} />
              ) : (
                <View style={[styles.courierAvatar, styles.courierAvatarFallback]}>
                  <Ionicons name="person" size={28} color="#999" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.courierName}>{order.courier_name}</Text>
                {(order.courier_vehicle_make || order.courier_vehicle_model || order.courier_license_plate) && (
                  <View style={styles.courierVehicleRow}>
                    <Ionicons name="car-sport" size={13} color="#999" />
                    <Text style={styles.courierVehicle}>
                      {[order.courier_vehicle_color, order.courier_vehicle_make, order.courier_vehicle_model]
                        .filter(Boolean)
                        .join(' ')}
                    </Text>
                  </View>
                )}
                {order.courier_license_plate && (
                  <View style={styles.platePill}>
                    <Text style={styles.plateText}>{order.courier_license_plate}</Text>
                  </View>
                )}
              </View>
            </View>

            {order.courier_phone && (
              <View style={styles.courierActions}>
                <TouchableOpacity
                  style={styles.courierActionPrimary}
                  onPress={() => Linking.openURL(`tel:${order.courier_phone}`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call" size={18} color="#FFF" />
                  <Text style={styles.courierActionPrimaryText}>{t('tracking.callCourier') || 'Kuryeyi Ara'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.courierActionSecondary}
                  onPress={() => Linking.openURL(`sms:${order.courier_phone}`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubble" size={18} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : !isCanceled && !isDelivered ? (
          <View style={styles.courierPending}>
            <View style={styles.courierPendingIconWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.courierPendingTitle}>{t('tracking.courierAssigning')}</Text>
              <Text style={styles.courierPendingSubtitle}>
                {t('tracking.courierAssigningSubtitle') || 'En yakın kurye atanıyor'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Order info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="restaurant" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('tracking.restaurantLabel') || 'RESTORAN'}</Text>
              <Text style={styles.infoValue}>{RESTAURANT_NAME}</Text>
            </View>
          </View>

          {order.delivery_full_name && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{t('tracking.deliveryToLabel') || 'TESLİMAT'}</Text>
                  <Text style={styles.infoValue}>{order.delivery_full_name}</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="receipt" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('tracking.totalLabel') || 'TOPLAM'}</Text>
              <Text style={styles.infoValueBold}>${order.total_amount.toFixed(2)}</Text>
            </View>
            {order.delivery_fee != null && (
              <Text style={styles.infoFee}>
                {t('tracking.deliveryFeeLabel')}: ${order.delivery_fee.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Uber link */}
        {order.uber_tracking_url && (
          <TouchableOpacity
            style={styles.uberLinkBtn}
            onPress={() => Linking.openURL(order.uber_tracking_url!)}
            activeOpacity={0.85}
          >
            <Ionicons name="open" size={16} color="#666" />
            <Text style={styles.uberLinkText}>{t('tracking.uberLink')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F7', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 14, color: '#999', fontWeight: '500' },
  errorIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 20 },
  errorBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  errorBackText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Map
  mapContainer: { flex: 0.5, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF1F4',
    paddingHorizontal: 32,
    gap: 8,
  },
  mapFallbackIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mapFallbackTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  mapFallbackSubtitle: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },

  // Floating header
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  floatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.medium,
  },
  floatingTitle: { alignItems: 'center', flex: 1, marginHorizontal: 12 },
  floatingTitleText: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', letterSpacing: 0.3 },
  floatingSubtitle: { fontSize: 11, color: '#999', fontWeight: '600', marginTop: 2 },

  // Pins
  pinRestaurant: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    ...Shadows.medium,
  },
  pinCustomer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    ...Shadows.medium,
  },
  pinCourier: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    ...Shadows.medium,
  },
  pinCourierPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    opacity: 0.25,
  },

  // Bottom sheet
  bottomSheet: {
    flex: 0.5,
    backgroundColor: '#F5F5F7',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    ...Shadows.large,
  },

  // ETA Card
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
    ...Shadows.medium,
  },
  etaCardCanceled: { backgroundColor: '#DC3545' },
  etaCardDelivered: { backgroundColor: '#28A745' },
  etaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  etaTime: { fontSize: 38, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  etaSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 4,
  },
  etaIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Timeline
  timelineCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timelineHeaderText: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  stepCounter: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  stepCounterText: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 0.3 },
  timelineRow: { flexDirection: 'row', alignItems: 'center' },
  timelineItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  timelineDotWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  timelineDotPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    opacity: 0.18,
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotActive: { backgroundColor: Colors.primary },
  timelineLine: { flex: 1, height: 3, backgroundColor: '#F0F0F0', marginHorizontal: 4, borderRadius: 2 },
  timelineLineActive: { backgroundColor: Colors.primary },

  // Courier card
  courierCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  courierTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  courierLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  courierLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  courierLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#28A745' },
  courierLiveText: { fontSize: 10, fontWeight: '800', color: '#28A745', letterSpacing: 0.5 },
  courierMain: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  courierAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE' },
  courierAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  courierName: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  courierVehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  courierVehicle: { fontSize: 12, color: '#666', fontWeight: '500' },
  platePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  plateText: { fontSize: 11, fontWeight: '800', color: '#333', letterSpacing: 1 },
  courierActions: { flexDirection: 'row', gap: 10 },
  courierActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
  },
  courierActionPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  courierActionSecondary: {
    width: 50,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5E8',
  },

  // Courier pending
  courierPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  courierPendingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierPendingTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  courierPendingSubtitle: { fontSize: 12, color: '#999', marginTop: 2, fontWeight: '500' },

  // Info card
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  infoValueBold: { fontSize: 18, fontWeight: '900', color: '#1A1A1A' },
  infoFee: { fontSize: 11, color: '#999', fontWeight: '600' },
  infoDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12, marginLeft: 48 },

  // Uber link
  uberLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5E8',
  },
  uberLinkText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#666', textAlign: 'center' },
});

export default OrderTrackingScreen;
