import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { Order, OrderStatus } from '../../types/database.types';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../services/currencyService';
import {
  isPrinterModuleAvailable,
  getSavedPrinter,
  printOrder,
} from '../../services/printerService';
import {
  cancelUberDelivery,
  CANCELATION_REASONS,
  CancelationReason,
} from '../../services/uberDeliveryService';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { buildOrderBreakdown } from '../../services/orderBreakdown';

const { width } = Dimensions.get('window');

// Sipariş sorgusunun üst sınırı. Ağ katmanındaki sınırdan (20 sn) BİLEREK daha
// uzun: iki farklı arıza var ve ikisi de kapatılmalı.
//   • İstek yola çıktı ama yanıt gelmiyor → ağ katmanı 20 sn'de keser
//   • İstek HİÇ yola çıkmadı, tıkanmış auth kilidinde kuyrukta bekliyor →
//     ortada fetch olmadığı için ağ sınırı devreye girmez, spinner'ı yalnızca
//     buradaki sınır kurtarır
const FETCH_TIMEOUT_MS = 25000;

// Listenin gerçekten değişip değişmediğini anlamak için hafif bir parmak izi.
// Sadece admin ekranında değişebilen alanlar yeterli.
const ordersSignature = (rows: Order[]) =>
  rows
    .map((o) =>
      [o.id, o.status, o.payment_status ?? '', o.uber_status ?? '', o.updated_at ?? ''].join(':')
    )
    .join('|');

// Sipariş durumu renkleri (Order status colors) - Elite Palette
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#FFC107',
  confirmed: '#17A2B8',
  preparing: '#FF6B35',
  ready: '#28A745',
  delivering: '#007BFF',
  delivered: '#6C757D',
  cancelled: '#DC3545',
};

const AdminOrders = ({ navigation, route }: any) => {
  const { t, i18n } = useTranslation();
  const filterParam = route?.params?.filter;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const STATUS_NAMES: Record<OrderStatus, string> = {
    pending: t('admin.orders.statusPending'),
    confirmed: t('admin.orders.statusConfirmed'),
    preparing: t('admin.orders.statusPreparing'),
    ready: t('admin.orders.statusReady'),
    delivering: t('admin.orders.statusDelivering'),
    delivered: t('admin.orders.statusDelivered'),
    cancelled: t('admin.orders.statusCancelled'),
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>(filterParam || 'all');
  // İptal (Uber cancel) akışı
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelationReason | null>(null);
  const [cancelDesc, setCancelDesc] = useState('');
  const [cancelling, setCancelling] = useState(false);
  // Son çekilen listenin parmak izi — gereksiz render'ları engellemek için
  const signatureRef = useRef<string | null>(null);
  // Arka plandaki sessiz yenilemeler üst üste başarısız olursa kullanıcıya
  // bir kez haber ver. Her denemede toast göstermek 20 saniyede bir yağmur
  // olurdu; hiç göstermemek de arızayı 90 saniye görünmez bırakıyordu.
  const silentFailuresRef = useRef(0);

  useEffect(() => {
    // Filtre değişince parmak izi geçersiz — listeyi mutlaka yenile
    signatureRef.current = null;
    fetchOrders();
  }, [filterStatus]);

  // Ekran açıkken tabletin uykuya geçmesini engelle. Ekran kapanınca OS
  // uygulamayı arka plana alıp realtime bağlantısını kesiyor ve siparişler
  // düşmüyordu. (Keep the tablet awake while the orders screen is focused.)
  useFocusEffect(
    useCallback(() => {
      activateKeepAwakeAsync('admin-orders').catch(() => {});
      return () => {
        // Zaten kapalıysa hata verebilir — sorun değil
        deactivateKeepAwake('admin-orders').catch(() => {});
      };
    }, [])
  );

  // true = veri çekildi, false = başarısız. Dönüş değeri useRealtimeTable'ın
  // bayat-veri kontrolü için kullanılıyor; başarısızlığı yutmak o mekanizmayı
  // devre dışı bırakır.
  const fetchOrders = async (opts?: { silent?: boolean; notifyErrors?: boolean }): Promise<boolean> => {
    const silent = opts?.silent === true;
    // Hata bildirimi spinner'dan ayrı: kullanıcı elle yenilediğinde (aşağı çekme)
    // spinner'ı listeyi kaplamasın diye "silent" kullanıyoruz ama sessiz kalmak
    // yanlış olur — hiçbir geri bildirim olmadan dönen spinner tam olarak
    // kullanıcının şikâyet ettiği belirsizlikti.
    const notifyErrors = opts?.notifyErrors ?? !silent;
    try {
      if (!silent) setLoading(true);
      let query = supabase.from('orders').select('*, user:users(email, full_name, phone), order_items(*, product:products(name, image_url)), order_item_customizations(*), campaign:campaigns(name_tr, name_en)').order('created_at', { ascending: false });
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);

      // Sorguya üst sınır koy. Supabase auth kilidi tıkanırsa sorgu hiç
      // başlamıyor ve await sonsuza kadar bekliyordu; finally çalışmadığı için
      // yenileme spinner'ı dönüp duruyordu. Artık en kötü durumda hata verip
      // spinner'ı bırakıyor ve bir sonraki denemede toparlanıyor.
      const { data, error } = (await Promise.race([
        query,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ORDERS_FETCH_TIMEOUT')), FETCH_TIMEOUT_MS)
        ),
      ])) as any;
      if (error) throw error;

      // Değişiklik yoksa state'e dokunma. Aksi halde 20 saniyelik polling
      // listeyi her seferinde yeniden render edip kart animasyonlarını
      // baştan oynatıyor. (Skip the state update when nothing actually changed.)
      silentFailuresRef.current = 0;
      const signature = ordersSignature(data || []);
      if (signature === signatureRef.current) return true;
      signatureRef.current = signature;
      setOrders(data || []);
      return true;
    } catch (error: any) {
      // Arka plandaki polling'de hata gösterme — 20 saniyede bir toast yağmasın.
      // Elle yenilemede ise mutlaka göster.
      silentFailuresRef.current += 1;
      // Elle yenilemede her zaman göster; sessiz yenilemede ikinci üst üste
      // başarısızlıkta bir kez göster (tek seferlik ağ hıçkırığı için toast
      // yağdırmamak, ama süregelen arızayı da 90 saniye saklamamak için).
      const shouldNotify = notifyErrors || silentFailuresRef.current === 2;
      if (shouldNotify) {
        // Gerçek hata metnini göster: genel mesaj hiçbir şey anlatmıyordu ve
        // teşhis için her seferinde cihazı bilgisayara bağlamak gerekiyordu.
        const reason = String(error?.message || error || '').slice(0, 90);
        Toast.show({
          type: 'error',
          text1: t('admin.orders.errorLoading'),
          text2: reason,
          visibilityTime: 6000,
        });
      }
      console.log('[AdminOrders] sipariş çekilemedi:', error?.message || error);
      return false;
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  // fetchOrders her render'da yeniden üretiliyor; realtime callback'lerinin
  // her zaman güncel filtreyle çalışan sürümü çağırması için ref'te tut.
  const fetchOrdersRef = useRef(fetchOrders);
  fetchOrdersRef.current = fetchOrders;

  // Tek siparişte birden çok event (INSERT + UPDATE) gelebiliyor; art arda
  // gelen event'leri tek sorguya indir. (Debounce burst realtime events.)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSilentRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      fetchOrdersRef.current({ silent: true });
    }, 400);
  };
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Sipariş listesini realtime canlı tut. Ses + toast global bildirimci
  // (useAdminOrderNotifier) tarafından yönetilir; burada sadece liste yenilenir.
  // useRealtimeTable kopan bağlantıyı yeniden kurar, uygulama ön plana
  // döndüğünde tazeler ve realtime tamamen ölse bile polling ile liste güncel kalır.
  const { status: realtimeStatus, isStale } = useRealtimeTable({
    channel: 'admin-orders-list',
    table: 'orders',
    event: '*',
    onEvent: scheduleSilentRefresh,
    onResync: () => {
      // HER resync'te sorgu yapılıyor — 'subscribed' sebebi eskiden atlanıyordu
      // ve yeniden abone olunduğunda (offline'dan dönüşte) bağlantı koptuğu
      // sürede gelen siparişler HİÇ çekilmiyordu. Mount'takiyle çakışması
      // zararsız: parmak izi aynıysa state'e dokunulmuyor, render tetiklenmiyor.
      // Promise'i DÖNDÜR: hook başarıyı buradan ölçüyor.
      return fetchOrdersRef.current({ silent: true });
    },
    pollIntervalMs: 20000,
  });

  const onRefresh = () => {
    setRefreshing(true);
    // Kullanıcı elle çekti: spinner listeyi kaplamasın ama hata olursa görsün
    fetchOrders({ silent: true, notifyErrors: true });
  };

  const handlePrintOrder = async (order: Order) => {
    // Önce doğrudan ESC/POS termal yazıcıya bas (Epson TM-m30III vb.). Yazıcı
    // seçili ve native modül mevcutsa bu yolu kullan; değilse PDF paylaşımına düş.
    try {
      if (isPrinterModuleAvailable() && (await getSavedPrinter())) {
        const res = await printOrder(order);
        if (res.success) {
          Toast.show({ type: 'success', text1: t('admin.printer.printed') });
          return;
        }
        Toast.show({
          type: 'error',
          text1: t('admin.printer.printFailedFallback'),
          text2: res.error,
          visibilityTime: 4000,
        });
        // Hata durumunda PDF paylaşımına devam et (aşağıya düşer)
      }
    } catch (e) {
      // ESC/POS yolunda beklenmedik hata — PDF'e düş
    }

    try {
      const { getCurrencyInfo } = await import('../../services/currencyService');
      const currencySymbol = getCurrencyInfo().symbol;
      // İşletme künyesi ayarlardan (app_settings) — termal fişle aynı kaynak
      const { getContactInfo } = await import('../../services/contactService');
      const contact = await getContactInfo().catch(() => null);

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; max-width: 80mm; margin: 0 auto; font-size: 12px; line-height: 1.4; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 15px; }
              .order-number { font-size: 16px; font-weight: bold; margin: 10px 0; }
              .section { margin: 15px 0; padding: 10px 0; border-bottom: 1px dashed #000; }
              .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
              .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <div style="font-size: 20px; font-weight: bold;">🍔 RIVERSIDE BURGERS</div>
              ${contact?.address1 ? contact.address1.split('\n').map((l: string) => `<div>${l.trim()}</div>`).join('') : ''}
              ${contact?.phone1 ? `<div>${contact.phone1}</div>` : ''}
              ${contact?.businessNumber ? `<div>${contact.businessNumber}</div>` : ''}
              <div class="order-number">ORDER #${order.order_number}</div>
              <div>${t('admin.printer.receipt.orderDateTime')}: ${new Date(order.created_at).toLocaleString()}</div>
            </div>
            <div class="section">
              <div class="info-row"><b>Customer:</b> <span>${order.user?.full_name || 'Guest'}</span></div>
              <div class="info-row"><b>Phone:</b> <span>${order.phone || order.user?.phone || '-'}</span></div>
              <div><b>Address:</b><br/>${order.delivery_address}</div>
            </div>
            <div class="section">
              ${order.order_items?.map(item => {
                // Seçilen/çıkarılan malzemeleri ürünün altına yaz — mutfak fişten
                // hazırlıyor, bu satırlar olmadan yanlış ürün çıkıyor.
                const customs = (order.order_item_customizations || [])
                  .filter(c => c.product_id === item.product_id);
                const customLines = customs.map(c =>
                  `<div style="padding-left:14px; font-weight:bold;">&gt;&gt; ${
                    i18n.language === 'en' ? (c.option_name_en || c.option_name) : c.option_name
                  }</div>`
                ).join('');
                const itemNote = customs.find(c => c.special_instructions?.trim())?.special_instructions;
                const noteLine = itemNote
                  ? `<div style="padding-left:14px; font-weight:bold;">${t('admin.printer.receipt.note')}: ${itemNote}</div>`
                  : '';
                return `
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                  <span>${item.quantity}x ${item.product?.name}</span>
                  <span>${currencySymbol}${item.subtotal.toFixed(2)}</span>
                </div>
                ${customLines}
                ${noteLine}
              `;
              }).join('')}
            </div>
            ${(() => {
              // Tutar dökümü — termal yazıcıdaki ile aynı hesaplama (orderBreakdown)
              const c: any = (order as any).campaign;
              const campaignName = c ? (i18n.language === 'tr' ? c.name_tr : c.name_en) || c.name_en : null;
              const bd = buildOrderBreakdown(order, campaignName);
              if (!bd.hasDetail) return '';
              const labels: Record<string, string> = {
                subtotal: t('admin.orders.sumSubtotal'),
                extras: t('admin.orders.sumExtras'),
                discount: t('admin.orders.sumDiscount'),
                pointsUsed: t('admin.orders.sumPoints'),
                deliveryFee: t('admin.orders.sumDelivery'),
                tax: t('admin.orders.sumTax'),
                tip: t('admin.orders.sumTip'),
              };
              const rows = bd.lines.map((row) => {
                const label = labels[row.key] + (row.key === 'discount' && row.note ? ` (${row.note})` : '');
                const value = row.informational
                  ? `(${currencySymbol}${row.amount.toFixed(2)})`
                  : `${row.negative ? '-' : ''}${currencySymbol}${row.amount.toFixed(2)}`;
                const style = row.informational ? 'padding-left:12px; color:#666; font-style:italic;' : '';
                return `<div class="info-row" style="${style}"><span>${label}</span> <span>${value}</span></div>`;
              }).join('');
              return `<div class="section">${rows}</div>`;
            })()}
            <div class="total-row"><span>TOTAL:</span> <span>${currencySymbol}${order.total_amount.toFixed(2)}</span></div>
          </body>
        </html>
      `;
      // WEB: expo-print'in web implementasyonu html parametresini TAMAMEN yok
      // sayıp window.print() çağırıyor, yani açık olan sayfayı yazdırıyor —
      // fiş şablonu hiç görünmüyordu. Fişi gizli bir iframe'e yazıp onu
      // yazdırıyoruz; yeni sekme açmadığı için popup engelleyicilere de
      // takılmıyor. Bilgisayardan yöneten admin böylece fiş basabiliyor.
      if (Platform.OS === 'web') {
        const doc: any = (globalThis as any).document;
        if (!doc) throw new Error('WEB_PRINT_UNAVAILABLE');

        const frame = doc.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        frame.onload = () => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } finally {
            // Yazdırma diyalogu kapanana kadar dursun, sonra temizle
            setTimeout(() => frame.remove(), 60000);
          }
        };
        frame.srcdoc = html;
        doc.body.appendChild(frame);
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert(t('admin.error'), t('admin.orders.printError'));
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    // İptalde: Uber teslimatı varsa doğrudan iptal etme — sebep seç, Uber'e cancel bildir.
    if (newStatus === 'cancelled' && selectedOrder?.uber_delivery_id) {
      setShowStatusModal(false);
      setCancelReason(null);
      setCancelDesc('');
      setShowCancelModal(true);
      return;
    }
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      Toast.show({ type: 'success', text1: t('admin.orders.success'), text2: t('admin.orders.statusUpdated') });
      setShowStatusModal(false);
      fetchOrders();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.orders.errorUpdating') });
    }
  };

  // Uber teslimatlı siparişi iptal et: önce Uber'e cancel (zorunlu), sonra 'cancelled'.
  const confirmUberCancel = async () => {
    if (!selectedOrder || !cancelReason) return;
    if (cancelReason === 'other' && !cancelDesc.trim()) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.orders.cancelDescRequired') });
      return;
    }
    try {
      setCancelling(true);
      await cancelUberDelivery(selectedOrder.id, cancelReason, cancelDesc.trim() || undefined);
      Toast.show({ type: 'success', text1: t('admin.orders.success'), text2: t('admin.orders.cancelSuccess') });
      setShowCancelModal(false);
      setCancelReason(null);
      setCancelDesc('');
      fetchOrders();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: error?.message || t('admin.orders.cancelError') });
    } finally {
      setCancelling(false);
    }
  };

  const OrderCard = ({ order, index }: { order: Order, index: number }) => {
    const statusColor = STATUS_COLORS[order.status];
    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50).springify()}
        layout={Layout.springify()}
        style={styles.orderCard}
      >
        <TouchableOpacity 
          onPress={() => { setSelectedOrder(order); setShowDetailsModal(true); }}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={styles.orderIdent}>
              <View style={[styles.idCircle, { backgroundColor: statusColor + '15' }]}>
                <Ionicons name="receipt" size={16} color={statusColor} />
              </View>
              <Text style={styles.cardOrderNo}>#{order.order_number}</Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: statusColor + '10' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusTagText, { color: statusColor }]}>{STATUS_NAMES[order.status]}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.customerLine}>
                <Ionicons name="person-outline" size={14} color="#666" />
                <Text style={styles.customerName}>{order.user?.full_name || order.user?.email || t('admin.orders.guest')}</Text>
            </View>
            <View style={styles.addressLine}>
                <Ionicons name="location-outline" size={14} color="#888" />
                <Text style={styles.addressText} numberOfLines={1}>{order.delivery_address}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View>
                <Text style={styles.cardDate}>
                {new Date(order.created_at).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
                </Text>
                <Text style={styles.cardPrice}>{formatPrice(order.total_amount)}</Text>
            </View>
            <TouchableOpacity 
                style={styles.actionBtnIcon}
                onPress={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowStatusModal(true); }}
            >
                <LinearGradient colors={[Colors.primary, Colors.primary + 'CC']} style={styles.btnGradient}>
                    <Ionicons name="create-outline" size={16} color={Colors.white} />
                    <Text style={styles.btnTextSmall}>{t('common.status').toUpperCase()}</Text>
                </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const FilterItem = ({ status, label, icon }: { status: OrderStatus | 'all', label: string, icon: string }) => (
    <TouchableOpacity
      style={[styles.filterItem, filterStatus === status && styles.filterItemActive]}
      onPress={() => setFilterStatus(status)}
    >
      <Ionicons 
        name={icon as any} 
        size={18} 
        color={filterStatus === status ? Colors.white : Colors.textMuted} 
      />
      <Text style={[styles.filterLabel, filterStatus === status && styles.filterLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle}>
                <Ionicons name="arrow-back" size={20} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
                <Text style={styles.headerSubtitle}>{t('admin.dashboard')}</Text>
                <Text style={styles.headerTitle}>{t('admin.orders.title')}</Text>
                {/* Canlı bağlantı göstergesi — liste gerçekten güncel mi? */}
                {/* Gösterge artık socket durumuna DEĞİL verinin tazeliğine bakıyor.
                    Kanal 'SUBSCRIBED' olsa bile veri akmıyorsa "Canlı" demek
                    yanlıştı: personel yeşil noktaya bakıp her şeyin yolunda
                    olduğunu sanıyordu. */}
                <View style={styles.liveRow}>
                    <View style={[styles.liveDot, { backgroundColor: isStale ? '#DC3545' : realtimeStatus === 'live' ? '#28A745' : realtimeStatus === 'connecting' ? '#FFC107' : '#DC3545' }]} />
                    <Text style={styles.liveText}>
                        {isStale
                          ? t('admin.orders.liveOffline')
                          : realtimeStatus === 'live'
                          ? t('admin.orders.liveConnected')
                          : realtimeStatus === 'connecting'
                          ? t('admin.orders.liveConnecting')
                          : t('admin.orders.liveOffline')}
                    </Text>
                </View>
            </View>
            <TouchableOpacity style={styles.refreshCircle} onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color={Colors.white} />
            </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
            <FilterItem status="all" label={t('admin.orders.filterAll')} icon="grid-outline" />
            <FilterItem status="pending" label={t('admin.orders.filterPending')} icon="time-outline" />
            <FilterItem status="confirmed" label={t('admin.orders.filterConfirmed')} icon="checkmark-done-outline" />
            <FilterItem status="preparing" label={t('admin.orders.filterPreparing')} icon="restaurant-outline" />
            <FilterItem status="ready" label={t('admin.orders.filterReady')} icon="bag-check-outline" />
            <FilterItem status="delivering" label={t('admin.orders.filterDelivering')} icon="moped-outline" />
        </ScrollView>
      </LinearGradient>

      {/* Veri bayatladıysa personele ne yapacağını söyle. Sessizce boş liste
          göstermek en kötüsü: sipariş var sanmıyorlar ve sipariş kaçıyor. */}
      {isStale && (
        <View style={styles.staleBanner}>
          <Ionicons name="warning" size={18} color="#8A2B00" />
          <View style={{ flex: 1 }}>
            <Text style={styles.staleTitle}>{t('admin.orders.staleTitle')}</Text>
            <Text style={styles.staleDesc}>{t('admin.orders.staleDesc')}</Text>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
          <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
          </View>
      ) : (
          <FlatList
            data={orders}
            renderItem={({ item, index }) => <OrderCard order={item} index={index} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={64} color="#ddd" />
                <Text style={styles.emptyText}>{t('admin.orders.noOrders')}</Text>
              </View>
            }
          />
      )}

      {/* Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.statusSheet}>
            <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t('admin.orders.updateStatus')}</Text>
                <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                    <Ionicons name="close-circle" size={28} color="#ddd" />
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
                {(Object.keys(STATUS_NAMES) as OrderStatus[]).map((status) => (
                    <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, selectedOrder?.status === status && { backgroundColor: STATUS_COLORS[status] + '10', borderColor: STATUS_COLORS[status] }]}
                        onPress={() => updateOrderStatus(selectedOrder!.id, status)}
                    >
                        <View style={[styles.optionDot, { backgroundColor: STATUS_COLORS[status] }]} />
                        <Text style={[styles.optionLabel, selectedOrder?.status === status && { color: STATUS_COLORS[status], fontWeight: '800' }]}>{STATUS_NAMES[status]}</Text>
                        {selectedOrder?.status === status && <Ionicons name="checkmark-circle" size={20} color={STATUS_COLORS[status]} />}
                    </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Uber İptal Sebebi Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.statusSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('admin.orders.cancelTitle')}</Text>
              <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                <Ionicons name="close-circle" size={28} color="#ddd" />
              </TouchableOpacity>
            </View>
            <Text style={styles.cancelHint}>{t('admin.orders.cancelHint')}</Text>
            <ScrollView style={styles.sheetBody}>
              {CANCELATION_REASONS.map((reason) => {
                const active = cancelReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.statusOption, active && { backgroundColor: '#DC354510', borderColor: '#DC3545' }]}
                    onPress={() => setCancelReason(reason)}
                  >
                    <View style={[styles.optionDot, { backgroundColor: active ? '#DC3545' : '#ddd' }]} />
                    <Text style={[styles.optionLabel, active && { color: '#DC3545', fontWeight: '800' }]}>
                      {t(`admin.orders.cancelReasons.${reason}`)}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color="#DC3545" />}
                  </TouchableOpacity>
                );
              })}
              {/* "other" için açıklama zorunlu */}
              {cancelReason === 'other' && (
                <TextInput
                  style={styles.cancelInput}
                  value={cancelDesc}
                  onChangeText={setCancelDesc}
                  placeholder={t('admin.orders.cancelDescPlaceholder')}
                  placeholderTextColor="#B0B0B0"
                  multiline
                />
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.cancelConfirmBtn, (!cancelReason || cancelling) && { opacity: 0.4 }]}
              onPress={confirmUberCancel}
              disabled={!cancelReason || cancelling}
              activeOpacity={0.85}
            >
              {cancelling ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.cancelConfirmText}>{t('admin.orders.cancelConfirm')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      {showDetailsModal && selectedOrder && (
        <Modal visible={showDetailsModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.detailsSheet}>
              <View style={styles.detailsHeader}>
                <View style={styles.detailsHeaderTitle}>
                    <Text style={styles.detailsNo}>#{selectedOrder.order_number}</Text>
                    <View style={[styles.detailsBadge, { backgroundColor: STATUS_COLORS[selectedOrder.status] + '10' }]}>
                        <Text style={{ color: STATUS_COLORS[selectedOrder.status], fontWeight: '800', fontSize: 10 }}>{STATUS_NAMES[selectedOrder.status]}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={styles.sheetCloseBtn}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>{t('admin.orders.customerInfo')}</Text>
                    <View style={styles.detailsInfoBox}>
                        <View style={styles.infoRow}><Ionicons name="person" size={16} color={Colors.primary} /><Text style={styles.infoVal}>{selectedOrder.user?.full_name || t('admin.orders.guest')}</Text></View>
                        <View style={styles.infoRow}><Ionicons name="call" size={16} color={Colors.primary} /><Text style={styles.infoVal}>{selectedOrder.phone}</Text></View>
                        <View style={styles.infoRow}><Ionicons name="mail" size={16} color={Colors.primary} /><Text style={styles.infoVal}>{selectedOrder.user?.email || '-'}</Text></View>
                    </View>
                </View>

                <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>{t('admin.orders.deliveryAddress')}</Text>
                    <View style={styles.detailsInfoBox}>
                        <Text style={styles.infoVal}>{selectedOrder.delivery_address}</Text>
                    </View>
                </View>

                <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>{t('admin.orders.orderItems')}</Text>
                    {selectedOrder.order_items?.map((it, idx) => (
                        <View key={idx} style={styles.orderItemRow}>
                            <View style={styles.itLeft}>
                                <View style={styles.itQtyBox}><Text style={styles.itQty}>{it.quantity}x</Text></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itName}>{it.product?.name}</Text>
                                    {/* Özelleştirmeyi panelin dilinde göster. option_name_en sipariş
                                        anında kaydediliyor; eski siparişlerde boş olabilir, o zaman
                                        Türkçe ada düşülür. */}
                                    {(selectedOrder as any).order_item_customizations?.filter((c:any)=>c.product_id===it.product_id).map((c:any, i:number) => (
                                        <Text key={i} style={styles.itCustom}>
                                            • {i18n.language === 'en' ? (c.option_name_en || c.option_name) : c.option_name}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                            <Text style={styles.itPrice}>{formatPrice(it.subtotal)}</Text>
                        </View>
                    ))}
                </View>

                {selectedOrder.notes && (
                    <View style={styles.detailsSection}>
                        <Text style={styles.detailsLabel}>{t('admin.orders.specialNotes')}</Text>
                        <View style={styles.notesBox}><Text style={styles.notesText}>{selectedOrder.notes}</Text></View>
                    </View>
                )}

                {/* Tutar dökümü — eskiden yalnızca TOPLAM vardı, indirimin ya da ek
                    malzemenin tutarı nasıl etkilediği görünmüyordu. */}
                {(() => {
                  const c: any = (selectedOrder as any).campaign;
                  const campaignName = c ? (i18n.language === 'tr' ? c.name_tr : c.name_en) || c.name_en : null;
                  const bd = buildOrderBreakdown(selectedOrder, campaignName);
                  if (!bd.hasDetail) return null;
                  return (
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>{t('admin.orders.sumTitle')}</Text>
                      {bd.lines.map((row, i) => (
                        <View key={i} style={styles.sumRow}>
                          <Text style={[styles.sumLabel, row.informational && styles.sumLabelInfo]}>
                            {row.key === 'subtotal' && t('admin.orders.sumSubtotal')}
                            {row.key === 'extras' && t('admin.orders.sumExtras')}
                            {row.key === 'discount' && t('admin.orders.sumDiscount')}
                            {row.key === 'pointsUsed' && t('admin.orders.sumPoints')}
                            {row.key === 'deliveryFee' && t('admin.orders.sumDelivery')}
                            {row.key === 'tax' && t('admin.orders.sumTax')}
                            {row.key === 'tip' && t('admin.orders.sumTip')}
                            {row.key === 'discount' && row.note ? ` (${row.note})` : ''}
                          </Text>
                          <Text
                            style={[
                              styles.sumVal,
                              row.informational && styles.sumLabelInfo,
                              row.negative && styles.sumValNegative,
                            ]}
                          >
                            {row.informational ? '' : row.negative ? '-' : ''}
                            {formatPrice(row.amount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                <View style={styles.detailsTotalRow}>
                    <Text style={styles.totalLabel}>{t('admin.orders.total')}</Text>
                    <Text style={styles.totalVal}>{formatPrice(selectedOrder.total_amount)}</Text>
                </View>
              </ScrollView>

              <View style={styles.detailsFooter}>
                <TouchableOpacity style={[styles.footerBtn, styles.printBtn]} onPress={() => handlePrintOrder(selectedOrder)}>
                    <Ionicons name="print" size={20} color={Colors.white} />
                    <Text style={styles.footerBtnText}>{t('admin.orders.print')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.footerBtn, styles.statusBtn]} onPress={() => { setShowDetailsModal(false); setTimeout(() => setShowStatusModal(true), 300); }}>
                    <Ionicons name="create" size={20} color={Colors.white} />
                    <Text style={styles.footerBtnText}>{t('admin.orders.changeStatus')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingTop: 60, paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  backCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitleBox: { flex: 1, marginHorizontal: 16 },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: Colors.white },
  refreshCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  staleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFE9D6', borderLeftWidth: 4, borderLeftColor: '#DC3545',
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10,
  },
  staleTitle: { fontSize: 13, fontWeight: '900', color: '#8A2B00' },
  staleDesc: { fontSize: 12, color: '#8A2B00', marginTop: 2, lineHeight: 16 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  filterBar: { marginTop: 20, paddingLeft: 20 },
  filterBarContent: { paddingRight: 40, gap: 10, paddingBottom: 15 },
  filterItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 8 },
  filterItemActive: { backgroundColor: Colors.primary },
  filterLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' },
  filterLabelActive: { color: Colors.white },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 20, gap: 16, paddingBottom: 100 },
  orderCard: { backgroundColor: Colors.white, borderRadius: 24, padding: 16, ...Shadows.small },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderIdent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardOrderNo: { fontSize: 16, fontWeight: '900', color: Colors.text },
  statusTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cardBody: { marginBottom: 16, gap: 8 },
  customerLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 13, fontWeight: '600', color: '#444' },
  addressLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { fontSize: 12, color: '#888', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f1f1' },
  cardDate: { fontSize: 10, color: '#aaa', fontWeight: '600' },
  cardPrice: { fontSize: 18, fontWeight: '900', color: Colors.primary, marginTop: 2 },
  actionBtnIcon: { overflow: 'hidden', borderRadius: 12 },
  btnGradient: { flexDirection: 'row', paddingHorizontal: 12, height: 36, justifyContent: 'center', alignItems: 'center', gap: 6 },
  btnTextSmall: { color: Colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: '#bbb', fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  statusSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: Colors.text },
  sheetBody: { gap: 12 },
  statusOption: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#eee', gap: 12, marginBottom: 10 },
  optionDot: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#555' },
  cancelHint: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 16 },
  cancelInput: { backgroundColor: '#F4F5F7', borderRadius: 14, padding: 14, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: '#EDEEF2', minHeight: 72, textAlignVertical: 'top', marginTop: 4, marginBottom: 6 },
  cancelConfirmBtn: { backgroundColor: '#DC3545', borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  cancelConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  detailsSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%' },
  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  detailsHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailsNo: { fontSize: 22, fontWeight: '900', color: Colors.text },
  detailsBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  sheetCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  detailsScroll: { padding: 24 },
  detailsSection: { marginBottom: 32 },
  detailsLabel: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  detailsInfoBox: { gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoVal: { fontSize: 15, fontWeight: '600', color: '#333' },
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  itLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  itQtyBox: { backgroundColor: Colors.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  itQty: { color: Colors.primary, fontWeight: '900', fontSize: 12 },
  itName: { fontSize: 15, fontWeight: '700', color: '#444' },
  itCustom: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 2 },
  itPrice: { fontSize: 15, fontWeight: '800', color: Colors.text },
  notesBox: { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 16 },
  notesText: { fontSize: 14, color: '#666', lineHeight: 20 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  sumLabel: { flex: 1, fontSize: 13, color: '#444', marginRight: 8 },
  sumLabelInfo: { fontSize: 12, color: '#999', fontStyle: 'italic', paddingLeft: 12 },
  sumVal: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  sumValNegative: { color: '#28A745' },
  detailsTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 24, borderTopWidth: 2, borderTopColor: '#f1f1f1' },
  totalLabel: { fontSize: 18, fontWeight: '900', color: Colors.text },
  totalVal: { fontSize: 28, fontWeight: '900', color: Colors.primary },
  detailsFooter: { flexDirection: 'row', padding: 24, gap: 12, borderTopWidth: 1, borderTopColor: '#f1f1f1' },
  footerBtn: { flex: 1, flexDirection: 'row', height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8, ...Shadows.medium },
  printBtn: { backgroundColor: '#28A745' },
  statusBtn: { backgroundColor: Colors.primary },
  footerBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
});

export default AdminOrders;
