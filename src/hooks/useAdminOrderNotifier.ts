// Global admin sipariş bildirimcisi (Global admin new-order notifier)
// Admin giriş yaptığında — hangi ekranda olursa olsun — yeni sipariş geldiğinde
// ses çalar ve toast gösterir. Realtime aboneliği AdminOrders ekranından bağımsızdır,
// böylece dashboard/anasayfa gibi başka ekranlarda da bildirim düşer.
//
// Realtime tek başına güvenilir değil (tablet uzun süre açık kalınca socket ölüyor),
// bu yüzden useRealtimeTable'ın "resync" mekanizmasıyla birlikte çalışıyor:
// bağlantı koptuğu / uygulama arka planda olduğu sürede gelen siparişler
// created_at karşılaştırmasıyla sonradan yakalanıp bildiriliyor ve basılıyor.

import { useEffect, useRef } from 'react';
import i18n from '../i18n';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../services/currencyService';
import { sendLocalNotification, playAdminOrderSound, initAdminOrderSound } from '../services/notificationService';
import { navigationRef } from '../navigation/navigationRef';
import { useRealtimeTable } from './useRealtimeTable';
import type { ResyncReason } from './useRealtimeTable';
import { resetOrderAlerts } from '../services/orderAlertRegistry';
import {
  isPrinterModuleAvailable,
  isAutoPrintEnabled,
  getSavedPrinter,
  printOrder,
} from '../services/printerService';

// Tek turda en fazla bu kadar kaçan sipariş işlenir (kontrolden çıkmayı önler)
const MAX_CATCH_UP = 20;
// Sonradan yakalanan siparişlerden yalnızca hâlâ mutfağı ilgilendirenler basılır
const PRINTABLE_STATUSES = ['pending', 'confirmed', 'preparing'];

export function useAdminOrderNotifier() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  // Aynı sipariş için çift baskıyı/bildirimi önle — realtime ve catch-up
  // aynı siparişi iki kez görebilir
  const printedRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());
  // Bu tarihten sonrasını "yeni sipariş" say (Baseline for what counts as new)
  const lastSeenAtRef = useRef<string | null>(null);
  const catchingUpRef = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    // Web'de ses için autoplay kilidini kullanıcı jestiyle aç
    initAdminOrderSound();
  }, [isAdmin]);

  // Admin oturumu kapanırsa/değişirse durumu sıfırla
  useEffect(() => {
    if (!isAdmin) {
      lastSeenAtRef.current = null;
      printedRef.current.clear();
      notifiedRef.current.clear();
      resetOrderAlerts();
    }
  }, [isAdmin]);

  // Fiş baskısı (Auto-print) — yalnızca native modül varsa (dev/prod build),
  // ayar açıksa ve yazıcı seçiliyse.
  const autoPrint = async (orderId: string) => {
    try {
      if (
        !isPrinterModuleAvailable() ||
        printedRef.current.has(orderId) ||
        !(await isAutoPrintEnabled()) ||
        !(await getSavedPrinter())
      ) {
        return;
      }
      printedRef.current.add(orderId);

      const { data: fullOrder } = await supabase
        .from('orders')
        // Özelleştirmeler de çekilmeli: fişte "Domates Çıkar" gibi satırlar
        // bunlardan basılıyor, eksik select yüzünden fişe hiç düşmüyordu.
        .select('*, user:users(full_name, phone), order_items(*, product:products(name)), order_item_customizations(*), campaign:campaigns(name_tr, name_en)')
        .eq('id', orderId)
        .single();

      if (!fullOrder) {
        printedRef.current.delete(orderId);
        return;
      }

      const res = await printOrder(fullOrder as any);
      if (!res.success) {
        // Baskı başarısızsa tekrar denenebilsin diye dedupe kaydını geri al
        printedRef.current.delete(orderId);
        Toast.show({
          type: 'error',
          text1: i18n.t('admin.orderAlert.printerError'),
          text2: res.error,
          visibilityTime: 4000,
        });
      }
    } catch (e) {
      console.log('[auto-print] error:', e);
    }
  };

  // Tek sipariş için ses + bildirim + toast
  const announceOne = async (orderId: string) => {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, user:users(email, full_name, phone)')
      .eq('id', orderId)
      .single();

    if (!orderData) return;

    const customerName = (orderData as any).user?.full_name || i18n.t('admin.orderAlert.customer');
    const priceText = formatPrice(orderData.total_amount);

    if (Platform.OS === 'web') {
      playAdminOrderSound();
    } else {
      await sendLocalNotification(
        i18n.t('admin.orderAlert.newOrderTitle'),
        `${customerName} - ${priceText}`,
        { orderId: orderData.id, type: 'new_order_admin' },
        'admin_orders',
        Notifications.AndroidNotificationPriority.MAX,
        'order_sound.mp3'
      );
    }

    Toast.show({
      type: 'success',
      text1: i18n.t('admin.orderAlert.newOrderToast'),
      text2: `${customerName} - ${priceText}`,
      visibilityTime: 5000,
      onPress: () => {
        // Toast'a tıklanınca sipariş listesine git
        if (navigationRef.isReady()) {
          navigationRef.navigate('AdminOrders' as never);
        }
        Toast.hide();
      },
    });
  };

  // Birden fazla kaçan sipariş için tek özet bildirim (N kez ses çalmasın)
  const announceMany = async (count: number) => {
    if (Platform.OS === 'web') {
      playAdminOrderSound();
    } else {
      await sendLocalNotification(
        i18n.t('admin.orderAlert.newOrdersTitle', { count }),
        i18n.t('admin.orderAlert.missedOrdersBody'),
        { type: 'new_order_admin' },
        'admin_orders',
        Notifications.AndroidNotificationPriority.MAX,
        'order_sound.mp3'
      );
    }

    Toast.show({
      type: 'success',
      text1: i18n.t('admin.orderAlert.newOrdersToast', { count }),
      text2: i18n.t('admin.orderAlert.tapToView'),
      visibilityTime: 6000,
      onPress: () => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('AdminOrders' as never);
        }
        Toast.hide();
      },
    });
  };

  // Realtime'ın kaçırdığı siparişleri yakala (Catch up on missed orders)
  // Taban çizgisi olarak cihaz saati değil, veritabanındaki en yeni siparişin
  // created_at'i kullanılıyor — cihaz saati kayıksa eski siparişler bildirilmesin.
  // true = sorgu çalıştı, false = başarısız. Dönüş değeri useRealtimeTable'ın
  // bayat-veri kontrolü için; hatayı başarı olarak bildirmek o mekanizmayı kör eder.
  const catchUp = async (reason: ResyncReason): Promise<boolean> => {
    if (catchingUpRef.current) return true;
    catchingUpRef.current = true;
    try {
      if (lastSeenAtRef.current === null) {
        const { data } = await supabase
          .from('orders')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
        // Sipariş yoksa taban çizgisi "şimdi" olur
        lastSeenAtRef.current = data?.[0]?.created_at ?? new Date().toISOString();
        return true;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .gt('created_at', lastSeenAtRef.current)
        .order('created_at', { ascending: true })
        .limit(MAX_CATCH_UP + 1);

      if (error) return false;
      if (!data.length) return true;

      const rows = data.slice(0, MAX_CATCH_UP);
      if (data.length > MAX_CATCH_UP) {
        console.log(`[admin-notifier] ${MAX_CATCH_UP}+ kaçan sipariş var, ilk ${MAX_CATCH_UP} işleniyor`);
      }
      // İşaretlemeyi hemen ilerlet: aynı siparişler bir sonraki turda tekrar gelmesin
      lastSeenAtRef.current = rows[rows.length - 1].created_at;

      const fresh = rows.filter((row) => !notifiedRef.current.has(row.id));
      if (!fresh.length) return true;

      console.log(`[admin-notifier] ${reason}: ${fresh.length} kaçan sipariş yakalandı`);
      fresh.forEach((row) => notifiedRef.current.add(row.id));

      if (fresh.length === 1) {
        await announceOne(fresh[0].id);
      } else {
        await announceMany(fresh.length);
      }

      // Kaçan siparişlerin fişleri de basılsın — mutfak siparişi kaçırmasın.
      // Ama uygulama uzun süre kapalı kaldıysa (gece boyu) çoktan işlenmiş
      // siparişlerin fişini tekrar basmayalım: sadece hâlâ mutfağı ilgilendiren
      // durumlar basılır.
      for (const row of fresh.filter((r) => PRINTABLE_STATUSES.includes(r.status))) {
        await autoPrint(row.id);
      }
      return true;
    } finally {
      catchingUpRef.current = false;
    }
  };

  const handleRealtimeInsert = async (payload: any) => {
    const orderId = payload?.new?.id as string | undefined;
    if (!orderId) return;

    // Catch-up ile çakışmasın
    if (notifiedRef.current.has(orderId)) return;
    notifiedRef.current.add(orderId);

    const createdAt = payload?.new?.created_at as string | undefined;
    if (createdAt && (!lastSeenAtRef.current || createdAt > lastSeenAtRef.current)) {
      lastSeenAtRef.current = createdAt;
    }

    await announceOne(orderId);
    await autoPrint(orderId);
  };

  useRealtimeTable({
    channel: 'global-admin-new-orders',
    table: 'orders',
    event: 'INSERT',
    enabled: isAdmin,
    onEvent: handleRealtimeInsert,
    onResync: catchUp,
    // Realtime tamamen ölse bile en fazla 25 saniyede yeni sipariş duyulur
    pollIntervalMs: 25000,
  });
}
