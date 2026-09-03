// Restoranın şu anda açık olup olmadığı — SUNUCU tarafı.
//
// Neden burada bir kopya var: sepetteki düğmeyi kapatmak yeterli değil.
// Saatlerce açık kalmış bir sekme, önbellekten gelen bir sayfa ya da doğrudan
// atılan bir istek kapalı mutfağa sipariş geçirebilir. Gerçek engel burada.
//
// Mantık web (riverside-web/lib/hours.ts) ve uygulama
// (src/services/workingHoursService.ts) ile AYNI olmak zorunda; üçü aynı
// settings satırını okuyor ve farklı cevap verirlerse müşteri sepette "açık"
// görüp ödemede reddedilir.
//
// Saat AÇIKÇA Toronto'ya sabitlendi: fonksiyon UTC'de çalışıyor, sunucunun
// saatine bakmak gece yarısı civarında yanlış cevap verirdi.

const RESTAURANT_TZ = 'America/Toronto';

/**
 * "1:00" → "01:00". Panel saati serbest metin olarak alıyor ve veritabanında
 * tek haneli kapanış saatleri var ("1:00", "2:00").
 *
 * Karşılaştırma düz metin olduğu için bu sessizce yanlış cevap üretiyordu:
 * "23:30" <= "1:00" YANLIŞ ('2' > '1'), yani akşam saatlerinde restoran
 * kapalı sayılıyor ve BU FONKSİYON SİPARİŞİ REDDEDİYORDU. Aynı sebeple
 * "1:00" > "11:00" doğru çıkıp gece yarısı penceresi hiç tanınmıyordu.
 *
 * Veriyi düzeltmek yetmez — panel yarın yine tek haneli yazabilir.
 */
function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 24) return null;
  return `${String(hour % 24).padStart(2, '0')}:${match[2]}`;
}

function normalizedDay(day: DayHours | undefined): { open: string; close: string } | null {
  if (!day || !day.enabled) return null;
  const open = normalizeTime(day.open);
  const close = normalizeTime(day.close);
  if (!open || !close) return null;
  return { open, close };
}

export interface DayHours {
  open: string;
  close: string;
  enabled: boolean;
}

export type WorkingHours = Record<string, DayHours | undefined>;

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export interface OpenSettings {
  is_open: boolean;
  auto_close_enabled: boolean | null;
  working_hours: WorkingHours | null;
}

function restaurantNow(at: Date): { weekday: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    // h23 şart: bazı ortamlar gece yarısını "24" veriyor ve "24:10" >= "11:00"
    // karşılaştırması sessizce yanlış sonuç üretiyor.
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { weekday: get('weekday').toLowerCase(), time: `${get('hour')}:${get('minute')}` };
}

export function isOpenNow(settings: OpenSettings, at: Date = new Date()): boolean {
  if (!settings.is_open) return false;
  if (!settings.auto_close_enabled) return settings.is_open;
  if (!settings.working_hours) return settings.is_open;

  const { weekday, time } = restaurantNow(at);
  const hours = settings.working_hours;

  const today = normalizedDay(hours[weekday]);
  if (today) {
    if (today.close > today.open) {
      if (time >= today.open && time <= today.close) return true;
    } else if (time >= today.open) {
      // Gece yarısını geçen kapanış (11:00 → 01:00): açılıştan gün sonuna açık.
      return true;
    }
  }

  // Dün gece başlayan servis bu güne sarkmış olabilir.
  const index = DAY_ORDER.indexOf(weekday);
  const yesterday = normalizedDay(index < 0 ? undefined : hours[DAY_ORDER[(index + 6) % 7]]);
  if (yesterday && yesterday.close <= yesterday.open && time <= yesterday.close) {
    return true;
  }

  return false;
}
