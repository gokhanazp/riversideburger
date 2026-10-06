// İleri tarihli sipariş dilimleri ("Schedule for later").
//
// SAF modül: Intl.timeZone yok, Date-tz yok. Hermes (uygulama), Deno (edge
// function) ve Node/tarayıcı (web) aynı dosyayı çalıştırıyor; üç kopya da
// birebir aynı olmalı. Kaynak: riverside-web/lib/scheduling.ts; diğer ikisi
// (src/services/scheduling.ts, supabase/functions/_shared/scheduling.ts) kopya.
//
// Kurallar panelden geliyor (settings.scheduling_*). Dilimler restoranın
// gününe göre: Pazartesi 11:00–01:00 servisi, gece 00:30'u da Pazartesi'nin
// dilimi sayar. Son dilim kapanıştan `close_buffer_minutes` önce.
// Veritabanındaki scheduling_slot_ok() aynı kuralları SQL'de uyguluyor;
// buradaki liste yalnızca seçim içindir, son söz sunucuda.

export interface SchedulingConfig {
  enabled: boolean;
  min_lead_minutes: number;
  max_days: number;
  slot_minutes: number;
  close_buffer_minutes: number;
}

export const DEFAULT_SCHEDULING: SchedulingConfig = {
  enabled: false,
  min_lead_minutes: 45,
  max_days: 7,
  slot_minutes: 15,
  close_buffer_minutes: 30,
};

export interface DayHoursLike {
  open: string;
  close: string;
  enabled: boolean;
}
export type WorkingHoursLike = Record<string, DayHoursLike | undefined> | null | undefined;

export interface Slot {
  /** UTC anı, ISO 8601 — sunucuya giden değer bu. */
  iso: string;
  /** Toronto saatiyle "12:30 PM" */
  label: string;
}
export interface SlotDay {
  /** Servis günü, Toronto, YYYY-MM-DD */
  key: string;
  /** 0 = bugün, 1 = yarın … */
  offset: number;
  weekday: string;
  /** "Tue, Oct 7" */
  label: string;
  slots: Slot[];
}

const MIN = 60_000;
const DAY = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Toronto UTC ofseti, dakika: yaz saati −240, kış −300 (ABD/Kanada kuralı). */
export function torontoOffsetMinutes(utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear();
  const nthSunday = (month: number, nth: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (nth - 1) * 7;
  };
  const dstStart = Date.UTC(y, 2, nthSunday(2, 2), 7); // Mart 2. Pazar 02:00 EST
  const dstEnd = Date.UTC(y, 10, nthSunday(10, 1), 6); // Kasım 1. Pazar 02:00 EDT
  return utcMs >= dstStart && utcMs < dstEnd ? -240 : -300;
}

export interface LocalParts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  weekday: number;
}

export function torontoLocal(utcMs: number): LocalParts {
  const s = new Date(utcMs + torontoOffsetMinutes(utcMs) * MIN);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate(), hh: s.getUTCHours(), mm: s.getUTCMinutes(), weekday: s.getUTCDay() };
}

/** Toronto yerel saatini UTC anına çevirir (yaz saati geçişleri dahil). */
export function torontoToUtcMs(y: number, m: number, d: number, hh: number, mm: number): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - torontoOffsetMinutes(guess) * MIN;
  const off2 = torontoOffsetMinutes(utc);
  if (off2 !== torontoOffsetMinutes(guess)) utc = guess - off2 * MIN;
  return utc;
}

function parseTime(value: string | null | undefined): { h: number; m: number } | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value ?? '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  return { h: h % 24, m };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (p: LocalParts) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;

export function timeLabel(p: LocalParts): string {
  const suffix = p.hh < 12 ? 'AM' : 'PM';
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return `${h12}:${pad(p.mm)} ${suffix}`;
}

export function dayLabel(p: LocalParts): string {
  return `${WEEKDAY_SHORT[p.weekday]}, ${MONTH_SHORT[p.m - 1]} ${p.d}`;
}

/** "Tue, Oct 7 · 12:30 PM" — onay sayfası, fiş, admin kartı. */
export function formatScheduled(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const p = torontoLocal(ms);
  return `${dayLabel(p)} · ${timeLabel(p)}`;
}

/** Bir servis gününün (Toronto yerel tarihi) pencere sınırları, UTC ms. */
function serviceWindow(hours: WorkingHoursLike, y: number, m: number, d: number, weekday: number, config: SchedulingConfig): { start: number; end: number } | null {
  const dh = hours?.[WEEKDAYS[weekday]];
  if (!dh || !dh.enabled) return null;
  const open = parseTime(dh.open);
  const close = parseTime(dh.close);
  if (!open || !close) return null;
  const start = torontoToUtcMs(y, m, d, open.h, open.m);
  const closesNextDay = close.h * 60 + close.m <= open.h * 60 + open.m;
  const next = new Date(Date.UTC(y, m - 1, d + (closesNextDay ? 1 : 0)));
  const end = torontoToUtcMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), close.h, close.m) - config.close_buffer_minutes * MIN;
  return end > start ? { start, end } : null;
}

export function listSlots(hours: WorkingHoursLike, config: SchedulingConfig, nowMs: number = Date.now()): SlotDay[] {
  if (!config.enabled || !hours) return [];
  const step = Math.max(5, config.slot_minutes) * MIN;
  const earliest = nowMs + config.min_lead_minutes * MIN;
  const today = torontoLocal(nowMs);
  const days: SlotDay[] = [];
  for (let offset = 0; offset <= config.max_days; offset++) {
    const date = new Date(Date.UTC(today.y, today.m - 1, today.d + offset));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const weekday = date.getUTCDay();
    const win = serviceWindow(hours, y, m, d, weekday, config);
    if (!win) continue;
    const slots: Slot[] = [];
    for (let t = win.start; t <= win.end; t += step) {
      if (t < earliest) continue;
      slots.push({ iso: new Date(t).toISOString(), label: timeLabel(torontoLocal(t)) });
    }
    if (slots.length === 0) continue;
    const p: LocalParts = { y, m, d, hh: 0, mm: 0, weekday };
    days.push({ key: dayKey(p), offset, weekday: WEEKDAYS[weekday], label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : dayLabel(p), slots });
  }
  return days;
}

export type SlotVerdict = { ok: true } | { ok: false; reason: 'disabled' | 'invalid' | 'too_soon' | 'too_far' | 'closed' };

/**
 * Sunucu tarafı doğrulama (web edge function). `graceMinutes`: müşteri dilimi
 * seçip ödemeye geçerken birkaç dakika geçebilir; en erken dilim bu kadar
 * tolerans alıyor. Veritabanı tetikleyicisi de aynı toleransla bakıyor.
 */
export function validateSlot(iso: string, hours: WorkingHoursLike, config: SchedulingConfig, nowMs: number = Date.now(), graceMinutes = 2): SlotVerdict {
  if (!config.enabled) return { ok: false, reason: 'disabled' };
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { ok: false, reason: 'invalid' };
  const p = torontoLocal(ms);
  if (ms % MIN !== 0 || p.mm % config.slot_minutes !== 0) return { ok: false, reason: 'invalid' };
  if (ms < nowMs + (config.min_lead_minutes - graceMinutes) * MIN) return { ok: false, reason: 'too_soon' };
  if (ms > nowMs + (config.max_days + 1) * DAY) return { ok: false, reason: 'too_far' };
  // Servis günü: yerel tarih ya da bir önceki (gece yarısını geçen kapanış).
  for (let back = 0; back <= 1; back++) {
    const date = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
    const win = serviceWindow(hours, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay(), config);
    if (win && ms >= win.start && ms <= win.end) return { ok: true };
  }
  return { ok: false, reason: 'closed' };
}

export function slotReasonMessage(reason: Exclude<SlotVerdict, { ok: true }>['reason']): string {
  switch (reason) {
    case 'disabled': return 'Scheduled orders are not available right now.';
    case 'too_soon': return 'That time is too soon — please pick a later slot.';
    case 'too_far': return 'That date is too far ahead.';
    case 'closed': return "We're closed at that time — please pick another slot.";
    default: return 'Please pick a valid time slot.';
  }
}
