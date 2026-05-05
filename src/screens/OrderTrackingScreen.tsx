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
import { RouteProp, useRoute } from '@react-navigation/native';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';

const MAPTILER_KEY = (Constants.expoConfig?.extra?.mapTilerKey as string) ?? '';
const MAP_STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

// MapLibre native modülü içeren build var mı? app.json'da `mapsEnabled: true` olunca aktif olur.
// (Map renders only when the dev client has the native MapLibre module — flip the flag after EAS build.)
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
  { key: 'pending',         icon: 'receipt-outline' },
  { key: 'pickup',          icon: 'restaurant-outline' },
  { key: 'pickup_complete', icon: 'bicycle-outline' },
  { key: 'dropoff',         icon: 'navigate-outline' },
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

const OrderTrackingScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderTracking'>>();
  const insets = useSafeAreaInsets();
  const orderId = route.params.orderId;

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const cameraRef = useRef<any>(null);

  // İlk yükleme
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('orders')
      .select(
        'id, status, uber_status, uber_tracking_url, delivery_lat, delivery_lng, delivery_full_name, delivery_fee, pickup_eta, dropoff_eta, courier_name, courier_phone, courier_image_url, courier_vehicle_make, courier_vehicle_model, courier_vehicle_color, courier_license_plate, courier_lat, courier_lng, total_amount',
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

  // Realtime subscription
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

  // Harita kamerası tüm pin'leri kapsasın
  const cameraBounds = useMemo(() => {
    if (!order) return null;
    const points: [number, number][] = [
      [RESTAURANT_LNG, RESTAURANT_LAT],
    ];
    if (order.delivery_lat != null && order.delivery_lng != null) {
      points.push([order.delivery_lng, order.delivery_lat]);
    }
    if (order.courier_lat != null && order.courier_lng != null) {
      points.push([order.courier_lng, order.courier_lat]);
    }
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
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('tracking.orderNotFound')}</Text>
      </View>
    );
  }

  const currentStep = statusIndex(order.uber_status);
  const isCanceled = order.uber_status === 'canceled' || order.uber_status === 'returned';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Harita — sadece MapLibre içeren dev client'ta render olur */}
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

            {/* Restoran pin */}
            <MapLibreGL.PointAnnotation id="restaurant" coordinate={[RESTAURANT_LNG, RESTAURANT_LAT]}>
              <View style={styles.pinRestaurant}>
                <Ionicons name="restaurant" size={16} color="#FFF" />
              </View>
            </MapLibreGL.PointAnnotation>

            {/* Müşteri pin */}
            {order.delivery_lat != null && order.delivery_lng != null && (
              <MapLibreGL.PointAnnotation
                id="customer"
                coordinate={[order.delivery_lng, order.delivery_lat]}
              >
                <View style={styles.pinCustomer}>
                  <Ionicons name="home" size={16} color="#FFF" />
                </View>
              </MapLibreGL.PointAnnotation>
            )}

            {/* Kurye pin */}
            {order.courier_lat != null && order.courier_lng != null && (
              <MapLibreGL.PointAnnotation
                id="courier"
                coordinate={[order.courier_lng, order.courier_lat]}
              >
                <View style={styles.pinCourier}>
                  <Ionicons name="bicycle" size={18} color="#FFF" />
                </View>
              </MapLibreGL.PointAnnotation>
            )}
          </MapLibreGL.MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={48} color="#CCC" />
            <Text style={styles.mapFallbackTitle}>{t('tracking.mapPendingTitle')}</Text>
            <Text style={styles.mapFallbackSubtitle}>{t('tracking.mapPendingSubtitle')}</Text>
          </View>
        )}
      </View>

      {/* Statü + kurye kartı */}
      <ScrollView
        style={styles.bottomSheet}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ETA Header */}
        <View style={styles.etaHeader}>
          <Text style={styles.etaLabel}>
            {isCanceled ? t('tracking.canceled') : t('tracking.etaLabel')}
          </Text>
          {!isCanceled && (
            <Text style={styles.etaTime}>{formatEta(order.dropoff_eta, i18n.language)}</Text>
          )}
        </View>

        {/* Statü Timeline */}
        {!isCanceled && (
          <View style={styles.timelineRow}>
            {STATUS_STEPS.map((step, idx) => {
              const isActive = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.key} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineDot,
                      isActive && styles.timelineDotActive,
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  >
                    <Ionicons
                      name={step.icon}
                      size={14}
                      color={isActive ? '#FFF' : '#999'}
                    />
                  </View>
                  {idx < STATUS_STEPS.length - 1 && (
                    <View style={[styles.timelineLine, isActive && styles.timelineLineActive]} />
                  )}
                </View>
              );
            })}
          </View>
        )}
        {!isCanceled && STATUS_STEPS[currentStep] && (
          <Text style={styles.statusLabel}>{t(`tracking.status.${STATUS_STEPS[currentStep].key}`)}</Text>
        )}

        {/* Kurye kartı */}
        {order.courier_name ? (
          <View style={styles.courierCard}>
            <View style={styles.courierLeft}>
              {order.courier_image_url ? (
                <Image source={{ uri: order.courier_image_url }} style={styles.courierAvatar} />
              ) : (
                <View style={[styles.courierAvatar, styles.courierAvatarFallback]}>
                  <Ionicons name="person" size={28} color="#999" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.courierName}>{order.courier_name}</Text>
                {(order.courier_vehicle_make || order.courier_vehicle_model) && (
                  <Text style={styles.courierVehicle}>
                    {[
                      order.courier_vehicle_color,
                      order.courier_vehicle_make,
                      order.courier_vehicle_model,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    {order.courier_license_plate ? `  ·  ${order.courier_license_plate}` : ''}
                  </Text>
                )}
              </View>
            </View>
            {order.courier_phone && (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${order.courier_phone}`)}
              >
                <Ionicons name="call" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          !isCanceled && (
            <View style={styles.courierPending}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.courierPendingText}>{t('tracking.courierAssigning')}</Text>
            </View>
          )
        )}

        {/* Restoran bilgisi */}
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Ionicons name="restaurant-outline" size={18} color="#999" />
            <Text style={styles.infoText}>{RESTAURANT_NAME}</Text>
          </View>
          {order.delivery_fee != null && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={18} color="#999" />
              <Text style={styles.infoText}>
                {t('tracking.deliveryFeeLabel')}: ${order.delivery_fee.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Uber'in detaylı tracking sayfasına link */}
        {order.uber_tracking_url && (
          <TouchableOpacity
            style={styles.uberLinkBtn}
            onPress={() => Linking.openURL(order.uber_tracking_url!)}
          >
            <Text style={styles.uberLinkText}>{t('tracking.uberLink')}</Text>
            <Ionicons name="open-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  errorText: { fontSize: 16, color: '#666' },

  mapContainer: { flex: 0.55, overflow: 'hidden' },
  map: { flex: 1 },

  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 32,
    gap: 8,
  },
  mapFallbackTitle: { fontSize: 15, fontWeight: '700', color: '#666' },
  mapFallbackSubtitle: { fontSize: 13, color: '#999', textAlign: 'center' },

  pinRestaurant: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pinCustomer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pinCourier: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },

  bottomSheet: {
    flex: 0.45,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  etaHeader: { alignItems: 'center', marginBottom: 16 },
  etaLabel: { fontSize: 13, color: '#999', textTransform: 'uppercase', fontWeight: '700' },
  etaTime: { fontSize: 32, fontWeight: '900', color: '#1A1A1A', marginTop: 4 },

  timelineRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  timelineItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotActive: { backgroundColor: Colors.primary },
  timelineDotCurrent: { transform: [{ scale: 1.15 }] },
  timelineLine: { flex: 1, height: 2, backgroundColor: '#EEE', marginHorizontal: 4 },
  timelineLineActive: { backgroundColor: Colors.primary },

  statusLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },

  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  courierLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  courierAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEE' },
  courierAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  courierName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  courierVehicle: { fontSize: 12, color: '#666', marginTop: 2 },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  courierPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  courierPendingText: { fontSize: 14, color: '#666' },

  infoBlock: { gap: 8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: '#666' },

  uberLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginTop: 4,
  },
  uberLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});

export default OrderTrackingScreen;
