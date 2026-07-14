// Epson TM-m30III (ve diğer Epson TM serisi) için ESC/POS yazdırma servisi.
// react-native-esc-pos-printer (Epson ePOS SDK) üzerinden Bluetooth ile doğrudan
// fiş basar. Seçilen yazıcı ve otomatik yazdırma tercihi cihaza özel olduğundan
// (kasadaki fiziksel yazıcı) Supabase'de değil AsyncStorage'da tutulur.
//
// NOT: Bu modül yalnızca development/production build'de (dev-client) çalışır.
// Expo Go veya web'de native modül bulunmadığından import güvenli tutulur.

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '../types/database.types';
import { getCurrencyInfo } from './currencyService';
import i18n from '../i18n';

// Fiş metinleri uygulamanın seçili diline göre gelir (tr/en).
const rt = (key: string) => i18n.t(`admin.printer.receipt.${key}`);

// Native modülü tembel (lazy) yükle: web/Expo Go'da import patlamasın.
let Printer: any = null;
let PrinterConstants: any = null;
let PrintersDiscovery: any = null;
let nativeLoadError: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const escpos = require('react-native-esc-pos-printer');
  Printer = escpos.Printer;
  PrinterConstants = escpos.PrinterConstants;
  PrintersDiscovery = escpos.PrintersDiscovery;
} catch (e: any) {
  nativeLoadError = e?.message || 'native module unavailable';
}

export interface SavedPrinter {
  target: string; // örn "BT:00:11:22:33:44:55" — bağlantı hedefi
  deviceName: string;
}

const PRINTER_KEY = 'escpos_printer';
const AUTOPRINT_KEY = 'escpos_autoprint';

// 80mm kağıtta Font A ~48 karakter/satır. m30III varsayılanı 80mm.
const CHARS_PER_LINE = 48;

export function isPrinterModuleAvailable(): boolean {
  return !!Printer && !!PrintersDiscovery;
}

export function getPrinterModuleError(): string | null {
  return nativeLoadError;
}

// ---- Kalıcı ayarlar (Persisted settings) ----

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_KEY);
    return raw ? (JSON.parse(raw) as SavedPrinter) : null;
  } catch {
    return null;
  }
}

export async function saveSelectedPrinter(p: SavedPrinter): Promise<void> {
  await AsyncStorage.setItem(PRINTER_KEY, JSON.stringify(p));
}

export async function clearSavedPrinter(): Promise<void> {
  await AsyncStorage.removeItem(PRINTER_KEY);
}

export async function isAutoPrintEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(AUTOPRINT_KEY);
  return v === 'true';
}

export async function setAutoPrintEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTOPRINT_KEY, enabled ? 'true' : 'false');
}

// ---- İzinler (Permissions) ----

// Android 12+ (API 31) için BLUETOOTH_SCAN + BLUETOOTH_CONNECT, öncesi için
// ACCESS_FINE_LOCATION runtime izni ister. Hepsi verildiyse true döner.
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const sdk = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    const perms: string[] =
      sdk >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    const result = await PermissionsAndroid.requestMultiple(perms as any);
    return perms.every(
      (p) => (result as any)[p] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

// ---- Keşif (Discovery) ----
// Not: UI tarafında usePrintersDiscovery hook'u da kullanılabilir. Bu fonksiyon
// hook dışı (ör. test) kullanımlar için tek seferlik bir tarama yapar.
export async function discoverBluetoothPrinters(
  timeoutMs = 8000
): Promise<SavedPrinter[]> {
  if (!isPrinterModuleAvailable()) throw new Error('MODULE_UNAVAILABLE');
  const granted = await requestBluetoothPermissions();
  if (!granted) throw new Error('NO_PERMISSION');

  return new Promise<SavedPrinter[]>((resolve, reject) => {
    const found = new Map<string, SavedPrinter>();
    let unsub: (() => void) | null = null;
    let unsubErr: (() => void) | null = null;

    const cleanup = async () => {
      unsub?.();
      unsubErr?.();
      try {
        await PrintersDiscovery.stop();
      } catch {}
    };

    unsub = PrintersDiscovery.onDiscovery((printers: any[]) => {
      printers.forEach((d) => {
        if (d?.target) {
          found.set(d.target, {
            target: d.target,
            deviceName: d.deviceName || d.target,
          });
        }
      });
    });

    unsubErr = PrintersDiscovery.onError(async (err: any) => {
      await cleanup();
      reject(new Error(err?.message || 'DISCOVERY_ERROR'));
    });

    PrintersDiscovery.start({
      timeout: timeoutMs,
      autoStop: true,
      // Bluetooth portu + eşleşmiş cihazlar
      filterOption: {
        portType: PrinterConstants?.PORTTYPE_BLUETOOTH,
      },
    }).catch(async (err: any) => {
      await cleanup();
      reject(err);
    });

    setTimeout(async () => {
      await cleanup();
      resolve(Array.from(found.values()));
    }, timeoutMs + 500);
  });
}

// ---- Fiş oluşturma (Receipt building) ----

// Sol/sağ hizalı iki sütunlu satır (ürün adı ... fiyat gibi).
function twoColumns(left: string, right: string, width = CHARS_PER_LINE): string {
  const space = width - left.length - right.length;
  if (space >= 1) return left + ' '.repeat(space) + right;
  // Sol taraf çok uzunsa alt satıra sığdır
  const maxLeft = width - right.length - 1;
  const trimmed = left.length > maxLeft ? left.slice(0, Math.max(0, maxLeft)) : left;
  const gap = Math.max(1, width - trimmed.length - right.length);
  return trimmed + ' '.repeat(gap) + right;
}

function line(char = '-', width = CHARS_PER_LINE): string {
  return char.repeat(width);
}

// Order + ESC/POS komutlarını yazıcıya kuyruklar. sendData() çağrılmadan önce.
async function buildReceipt(printer: any, order: Order): Promise<void> {
  const C = PrinterConstants;
  const symbol = getCurrencyInfo().symbol;
  const money = (n: number) => `${symbol}${(n ?? 0).toFixed(2)}`;

  // Başlık (ortalı, büyük)
  await printer.addTextAlign(C.ALIGN_CENTER);
  await printer.addTextSize({ width: 2, height: 2 });
  await printer.addTextStyle({ em: C.TRUE });
  await printer.addText('RIVERSIDE BURGERS\n');
  await printer.addTextStyle({ em: C.FALSE });
  await printer.addTextSize({ width: 1, height: 1 });

  // Sipariş no (büyük)
  await printer.addTextSize({ width: 2, height: 2 });
  await printer.addText(`${rt('orderPrefix')}${order.order_number}\n`);
  await printer.addTextSize({ width: 1, height: 1 });

  const dateStr = new Date(order.created_at).toLocaleString();
  await printer.addText(`${dateStr}\n`);

  const methodLabel =
    order.delivery_method === 'pickup' ? rt('pickup') : rt('delivery');
  await printer.addTextStyle({ em: C.TRUE });
  await printer.addText(`${methodLabel}\n`);
  await printer.addTextStyle({ em: C.FALSE });

  // Müşteri bilgileri (sola hizalı)
  await printer.addTextAlign(C.ALIGN_LEFT);
  await printer.addText(line() + '\n');

  const customerName = order.user?.full_name || rt('guest');
  const phone = order.phone || order.user?.phone || '-';
  await printer.addText(`${rt('customer')}: ${customerName}\n`);
  await printer.addText(`${rt('phone')}: ${phone}\n`);
  if (order.delivery_method !== 'pickup' && order.delivery_address) {
    await printer.addText(`${rt('address')}:\n${order.delivery_address}\n`);
  }

  if (order.notes) {
    await printer.addTextStyle({ em: C.TRUE });
    await printer.addText(`${rt('note')}: ${order.notes}\n`);
    await printer.addTextStyle({ em: C.FALSE });
  }

  // Ürünler
  await printer.addText(line() + '\n');
  const items = order.order_items || [];
  for (const item of items) {
    const name = `${item.quantity}x ${item.product?.name || rt('product')}`;
    await printer.addText(twoColumns(name, money(item.subtotal)) + '\n');
  }
  await printer.addText(line() + '\n');

  // Toplam (büyük)
  await printer.addTextSize({ width: 2, height: 2 });
  await printer.addTextStyle({ em: C.TRUE });
  await printer.addText(twoColumns(rt('total'), money(order.total_amount), CHARS_PER_LINE / 2) + '\n');
  await printer.addTextStyle({ em: C.FALSE });
  await printer.addTextSize({ width: 1, height: 1 });

  if (order.tip_amount && order.tip_amount > 0) {
    await printer.addText(twoColumns(rt('tip'), money(order.tip_amount)) + '\n');
  }

  // Alt boşluk + kesme
  await printer.addFeedLine(2);
  await printer.addTextAlign(C.ALIGN_CENTER);
  await printer.addText(`${rt('thanks')}\n`);
  await printer.addFeedLine(2);
  await printer.addCut(C.CUT_FEED);
}

// ---- Yazdırma (Printing) ----

export interface PrintResult {
  success: boolean;
  error?: string;
}

// Belirli bir hedefe (ya da kayıtlı yazıcıya) sipariş fişi basar.
export async function printOrder(
  order: Order,
  target?: SavedPrinter
): Promise<PrintResult> {
  if (!isPrinterModuleAvailable()) {
    return { success: false, error: 'MODULE_UNAVAILABLE' };
  }

  const dest = target || (await getSavedPrinter());
  if (!dest) return { success: false, error: 'NO_PRINTER' };

  const granted = await requestBluetoothPermissions();
  if (!granted) return { success: false, error: 'NO_PERMISSION' };

  const printer = new Printer({
    target: dest.target,
    deviceName: dest.deviceName,
    lang: PrinterConstants.MODEL_ANK,
  });

  try {
    const result = await printer.addQueueTask(async () => {
      await printer.connect(10000);
      try {
        await buildReceipt(printer, order);
        return await printer.sendData();
      } finally {
        await printer.disconnect().catch(() => {});
        await printer.clearCommandBuffer?.().catch?.(() => {});
      }
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'PRINT_FAILED' };
  }
}

// Bağlantı ve çıktı doğrulaması için basit test fişi.
export async function testPrint(target: SavedPrinter): Promise<PrintResult> {
  if (!isPrinterModuleAvailable()) {
    return { success: false, error: 'MODULE_UNAVAILABLE' };
  }
  const granted = await requestBluetoothPermissions();
  if (!granted) return { success: false, error: 'NO_PERMISSION' };

  const printer = new Printer({
    target: target.target,
    deviceName: target.deviceName,
    lang: PrinterConstants.MODEL_ANK,
  });

  try {
    await printer.addQueueTask(async () => {
      await printer.connect(10000);
      try {
        const C = PrinterConstants;
        await printer.addTextAlign(C.ALIGN_CENTER);
        await printer.addTextSize({ width: 2, height: 2 });
        await printer.addText(`${rt('testTitle')}\n`);
        await printer.addTextSize({ width: 1, height: 1 });
        await printer.addText('Riverside Burgers\n');
        await printer.addText(`${rt('testLine')}\n`);
        await printer.addFeedLine(3);
        await printer.addCut(C.CUT_FEED);
        return await printer.sendData();
      } finally {
        await printer.disconnect().catch(() => {});
      }
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'PRINT_FAILED' };
  }
}
