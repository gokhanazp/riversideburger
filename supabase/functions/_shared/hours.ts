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

  const today = hours[weekday];
  if (today?.enabled) {
    if (today.close > today.open) {
      if (time >= today.open && time <= today.close) return true;
    } else if (time >= today.open) {
      // Gece yarısını geçen kapanış (11:00 → 01:00): açılıştan gün sonuna açık.
      return true;
    }
  }

  // Dün gece başlayan servis bu güne sarkmış olabilir.
  const index = DAY_ORDER.indexOf(weekday);
  const yesterday = index < 0 ? undefined : hours[DAY_ORDER[(index + 6) % 7]];
  if (yesterday?.enabled && yesterday.close <= yesterday.open && time <= yesterday.close) {
    return true;
  }

  return false;
}
