// Restoranın yerel saati. Supabase'e ya da React Native'e bağımlı DEĞİL:
// bu yüzden Deno ile doğrudan test edilebiliyor (supabase/tests/... yanında
// bir eşi yok; testi src/services/restaurantTime.test.ts).

export type RestaurantDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

// ── Restoranın saati ───────────────────────────────────────────────────────
//
// Cihazın saati KULLANILMAZ. Müşteri Toronto'da olmak zorunda değil: telefonu
// İstanbul saatindeyken 13:13 okunuyordu, Toronto'da ise 06:13 idi — uygulama
// kapalı restoranı açık gösterip sipariş alıyordu. Restoranın tableti Toronto'da
// olduğu için bu hata yıllarca görünmedi.
//
// Web ve edge function da aynı şekilde Toronto'ya sabitli
// (riverside-web/lib/hours.ts, supabase/functions/_shared/hours.ts).
const RESTAURANT_TZ = 'America/Toronto';

export const DAY_BY_INDEX: RestaurantDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * ABD/Kanada yaz saati kuralıyla Toronto ofseti: mart ayının ikinci pazarı
 * 02:00'den kasımın ilk pazarı 02:00'ye kadar EDT (UTC-4), kalan zaman EST
 * (UTC-5).
 *
 * Bu YEDEK yol. Asıl hesap Intl ile yapılıyor; Intl saat dilimi desteği
 * olmayan bir ortamda burası devreye giriyor. Kural elle yazıldığı için yaz
 * saati uygulaması değişirse burası da güncellenmeli — Intl kendi kendine
 * güncellenir, o yüzden sıra bilerek böyle.
 */
export const torontoOffsetHours = (date: Date): number => {
  const year = date.getUTCFullYear();
  const nthSunday = (month: number, nth: number) => {
    const first = new Date(Date.UTC(year, month, 1));
    const offsetToSunday = (7 - first.getUTCDay()) % 7;
    return 1 + offsetToSunday + (nth - 1) * 7;
  };
  // Geçişler yerel 02:00'de; EST/EDT farkıyla UTC karşılıkları 07:00 ve 06:00.
  const dstStart = Date.UTC(year, 2, nthSunday(2, 2), 7);
  const dstEnd = Date.UTC(year, 10, nthSunday(10, 1), 6);
  const t = date.getTime();
  return t >= dstStart && t < dstEnd ? -4 : -5;
};

/** Toronto'daki gün adı ve HH:MM saati. */
export const restaurantNow = (date: Date = new Date()): { day: RestaurantDay; time: string } => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: RESTAURANT_TZ,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    const weekday = get('weekday').toLowerCase() as RestaurantDay;
    // Bazı ortamlar gece yarısını "24" veriyor; "24:10" >= "11:00" sessizce
    // yanlış sonuç üretirdi.
    const hour = get('hour') === '24' ? '00' : get('hour');
    const minute = get('minute');
    if (DAY_BY_INDEX.includes(weekday) && hour.length === 2 && minute.length === 2) {
      return { day: weekday, time: `${hour}:${minute}` };
    }
  } catch {
    // Intl saat dilimi desteği yok — yedeğe düşülüyor.
  }

  const shifted = new Date(date.getTime() + torontoOffsetHours(date) * 3600_000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return { day: DAY_BY_INDEX[shifted.getUTCDay()], time: `${hh}:${mm}` };
};

export interface DayHoursLike {
  enabled: boolean;
  open: string;
  close: string;
}

/**
 * Verilen ana göre restoran açık mı? SAF fonksiyon: cihazın saat dilimine ve
 * ağa bağlı değil, o yüzden test edilebiliyor.
 *
 * Gece yarısını geçen kapanış (11:00 → 01:00) iki pencereyle ele alınıyor:
 * bugünün açılışından gün sonuna kadar, ve DÜNÜN sarkan oturumu. İkincisi
 * olmadan gece 00:30'da mağaza kapalı görünüyor, oysa dün akşam başlayan
 * servis sürüyor.
 */
export const isOpenAtRestaurantTime = (
  // Gün adlarına göre eşlenmiş, hepsi isteğe bağlı: hem uygulamanın
  // WorkingHours arayüzü hem de eksik günlü bir nesne buraya geçebiliyor.
  workingHours: { [K in RestaurantDay]?: DayHoursLike },
  date: Date = new Date()
): boolean => {
  const { day, time } = restaurantNow(date);

  const today = workingHours[day];
  if (today?.enabled) {
    if (today.close > today.open) {
      if (time >= today.open && time <= today.close) return true;
    } else if (time >= today.open) {
      return true;
    }
  }

  const index = DAY_BY_INDEX.indexOf(day);
  const yesterday = index < 0 ? undefined : workingHours[DAY_BY_INDEX[(index + 6) % 7]];
  if (yesterday?.enabled && yesterday.close <= yesterday.open && time <= yesterday.close) {
    return true;
  }

  return false;
};
