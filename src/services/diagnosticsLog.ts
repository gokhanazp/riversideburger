// Cihaz üstü tanılama kaydı (On-device diagnostics log)
//
// Sipariş ekranının uzun süre sonra yeni sipariş almaması üç tur hipotez-odaklı
// düzeltmeye rağmen bitmedi. Sebep her seferinde tahmin edildi çünkü arıza
// yalnızca restorandaki tablette, saatler sonra ve geliştirici konsolu bağlı
// değilken oluşuyor. Bu modül o boşluğu kapatıyor: bağlantı, zamanlayıcı ve
// sorgu olaylarını halka tamponda tutup AsyncStorage'a yazıyor, böylece kayıt
// uygulama kapanıp açıldıktan SONRA da okunabiliyor.
//
// Konsol log'unun yerine geçmiyor, ona ek: __DEV__'de ikisi birlikte çalışır.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DiagEntry {
  /** epoch ms */
  t: number;
  /** olay kaynağı — 'rt:admin-orders-list', 'fetch', 'app' … */
  tag: string;
  msg: string;
}

const STORAGE_KEY = 'diag_log_v1';
// Halka tampon boyu. İki hook birlikte ~7 kayıt/dk üretiyor (dakikada bir
// watchdog nabzı + polling tikleri + sorgu sonuçları), yani 1000 kayıt ≈ 2.5
// saatlik geçmiş. Arıza 15-40 dakikada oluştuğu için donma anı tamponda
// rahatça kalıyor; daha küçük bir tampon kanıtı taşırıp yok ediyordu.
const MAX_ENTRIES = 1000;
// Her kayıtta disk yazmak pahalı; olaylar kümeler hâlinde geldiği için
// yazmayı geciktirip tek seferde topluyoruz. Tampon büyüdüğü için aralık da
// uzun: saatlerce açık kalan tablette 15 sn'de bir ~100 KB yazmak yeterli,
// arka plana geçişte zaten anında boşaltılıyor.
const FLUSH_DEBOUNCE_MS = 15000;

let entries: DiagEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let loaded = false;

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
};

const flush = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Disk yazılamazsa tanılama kaybolur ama uygulama etkilenmemeli
  }
};

/**
 * Bir olay kaydet. Asla throw etmez — tanılama kodu asıl akışı bozmamalı.
 */
export const diag = (tag: string, msg: string) => {
  try {
    entries.push({ t: Date.now(), tag, msg });
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
    scheduleFlush();
    if (__DEV__) console.log(`[${tag}] ${msg}`);
  } catch {
    // yut
  }
};

/**
 * Önceki oturumun kaydını geri yükle. Uygulama başlangıcında bir kez çağrılır.
 * Kritik: arıza sonrası kullanıcı uygulamayı kapatıp açıyor; kayıt bunu
 * atlatamazsa donma anına ait hiçbir kanıt elde kalmıyor.
 */
export const loadDiagnostics = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const previous = JSON.parse(raw) as DiagEntry[];
    if (!Array.isArray(previous)) return;
    // Önceki oturumu başa koy, bu oturumda birikenleri koru
    entries = [...previous, { t: Date.now(), tag: 'app', msg: '── uygulama yeniden başladı ──' }, ...entries];
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
  } catch {
    // Bozuk kayıt varsa görmezden gel
  }
};

export const getDiagnostics = (): DiagEntry[] => entries;

const pad = (n: number) => String(n).padStart(2, '0');

/** Kaydı okunabilir metne çevir (paylaşım / kopyalama için) */
export const formatDiagnostics = (): string => {
  if (!entries.length) return '(kayıt yok)';
  return entries
    .map((e) => {
      const d = new Date(e.t);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${e.tag} ${e.msg}`;
    })
    .join('\n');
};

export const clearDiagnostics = async () => {
  entries = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // yut
  }
};

/** Uygulama arka plana giderken kaydı hemen diske yaz */
export const flushDiagnostics = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  return flush();
};
