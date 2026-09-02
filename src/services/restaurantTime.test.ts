// Restoran saati testi — asıl konu CİHAZ SAATİNDEN BAĞIMSIZLIK.
//
// Uygulama cihazın saatiyle karar verdiği sürece, telefonu İstanbul'da olan
// müşteri kapalı restoranı açık görüyordu. Bu testler aynı UTC anının, işlem
// hangi saat diliminde çalışırsa çalışsın aynı cevabı vermesini ölçüyor.
//
// Çalıştırma (node TypeScript'i doğrudan çalıştırıyor):
//   node src/services/restaurantTime.test.ts
//   TZ=Europe/Istanbul node src/services/restaurantTime.test.ts
import { restaurantNow, torontoOffsetHours, isOpenAtRestaurantTime } from './restaurantTime.ts';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n      beklenen: ${e}\n      gerçek:   ${a}`}`);
};

console.log(`\n═══ Süreç saat dilimi: ${Intl.DateTimeFormat().resolvedOptions().timeZone} ═══`);

console.log('\n═══ 1) Toronto saatine çeviriyor ═══');
// Kullanıcının hatayı bildirdiği an: Toronto 06:13, İstanbul 13:13.
check('2026-09-02T10:13Z → Çar 06:13', restaurantNow(new Date('2026-09-02T10:13:00Z')), { day: 'wednesday', time: '06:13' });
check('2026-09-02T19:00Z → Çar 15:00', restaurantNow(new Date('2026-09-02T19:00:00Z')), { day: 'wednesday', time: '15:00' });

console.log('\n═══ 2) Gün sınırı ═══');
// UTC'de perşembe, Toronto'da hâlâ çarşamba.
check('2026-09-03T03:30Z → Çar 23:30', restaurantNow(new Date('2026-09-03T03:30:00Z')), { day: 'wednesday', time: '23:30' });
check('2026-09-03T04:00Z → Per 00:00', restaurantNow(new Date('2026-09-03T04:00:00Z')), { day: 'thursday', time: '00:00' });

console.log('\n═══ 3) Yaz saati ═══');
check('Yaz (Eylül) ofseti -4', torontoOffsetHours(new Date('2026-09-02T12:00:00Z')), -4);
check('Kış (Ocak) ofseti -5', torontoOffsetHours(new Date('2026-01-15T12:00:00Z')), -5);
check('DST başlangıcından önce (8 Mart 2026 06:00Z) -5', torontoOffsetHours(new Date('2026-03-08T06:00:00Z')), -5);
check('DST başlangıcından sonra (8 Mart 2026 08:00Z) -4', torontoOffsetHours(new Date('2026-03-08T08:00:00Z')), -4);
check('DST bitişinden önce (1 Kasım 2026 05:00Z) -4', torontoOffsetHours(new Date('2026-11-01T05:00:00Z')), -4);
check('DST bitişinden sonra (1 Kasım 2026 07:00Z) -5', torontoOffsetHours(new Date('2026-11-01T07:00:00Z')), -5);

console.log('\n═══ 4) Yedek yol Intl ile aynı sonucu veriyor ═══');
// Intl'i geçici olarak bozup yedeğin aynı cevabı verdiğini ölçüyoruz.
const realIntl = Intl.DateTimeFormat;
const instants = [
  '2026-09-02T10:13:00Z',
  '2026-09-03T03:30:00Z',
  '2026-09-03T04:00:00Z',
  '2026-01-15T17:45:00Z',
  '2026-11-01T09:20:00Z',
];
for (const iso of instants) {
  const withIntl = restaurantNow(new Date(iso));
  (Intl as any).DateTimeFormat = function () { throw new Error('Intl yok'); };
  const withFallback = restaurantNow(new Date(iso));
  (Intl as any).DateTimeFormat = realIntl;
  check(`${iso} — yedek = Intl`, withFallback, withIntl);
}

console.log('\n═══ 5) Açık/kapalı kararı — gerçek saatlerle ═══');
// Her gün 11:00 açılış; Pzt/Sal/Çar/Paz 01:00, Per/Cum/Cmt 02:00 kapanış.
const HOURS = {
  monday: { enabled: true, open: '11:00', close: '01:00' },
  tuesday: { enabled: true, open: '11:00', close: '01:00' },
  wednesday: { enabled: true, open: '11:00', close: '01:00' },
  thursday: { enabled: true, open: '11:00', close: '02:00' },
  friday: { enabled: true, open: '11:00', close: '02:00' },
  saturday: { enabled: true, open: '11:00', close: '02:00' },
  sunday: { enabled: true, open: '11:00', close: '01:00' },
};

// HATANIN BİLDİRİLDİĞİ AN. Toronto'da Çarşamba 06:13 — restoran kapalı.
// Telefon İstanbul saatindeyken 13:13 okunuyor ve eski kod "açık" diyordu.
check('Toronto Çar 06:13 → kapalı (hatanın bildirildiği an)', isOpenAtRestaurantTime(HOURS, new Date('2026-09-02T10:13:00Z')), false);
check('Toronto Çar 15:00 → açık', isOpenAtRestaurantTime(HOURS, new Date('2026-09-02T19:00:00Z')), true);
check('Toronto Çar 23:30 → açık', isOpenAtRestaurantTime(HOURS, new Date('2026-09-03T03:30:00Z')), true);
check('Toronto Per 00:30 → açık (Çarşamba servisi)', isOpenAtRestaurantTime(HOURS, new Date('2026-09-03T04:30:00Z')), true);
check('Toronto Per 01:30 → kapalı', isOpenAtRestaurantTime(HOURS, new Date('2026-09-03T05:30:00Z')), false);
check('Toronto Cum 01:59 → açık (Perşembe 02:00 kapanış)', isOpenAtRestaurantTime(HOURS, new Date('2026-09-04T05:59:00Z')), true);
check('Toronto Cum 02:01 → kapalı', isOpenAtRestaurantTime(HOURS, new Date('2026-09-04T06:01:00Z')), false);
check('Kış saatinde Çar 06:13 → kapalı', isOpenAtRestaurantTime(HOURS, new Date('2026-01-14T11:13:00Z')), false);

console.log(failures === 0 ? '\n✅ TÜM KONTROLLER GEÇTİ' : `\n❌ ${failures} KONTROL BAŞARISIZ`);
process.exit(failures ? 1 : 0);
