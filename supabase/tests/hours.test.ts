// Açılış saatleri testi — asıl konu GECE YARISINI GEÇEN kapanış.
//
// Restoran her gün 11:00'de açıyor, Pazartesi–Çarşamba ve Pazar 01:00'de,
// Perşembe–Cumartesi 02:00'de kapanıyor. Yani kapanış her zaman ERTESİ GÜN.
// Düz metin karşılaştırması ("11:00" <= şimdi <= "01:00") bu durumda hiçbir
// zaman doğru olmuyor; sürekli "kapalı" demek de sipariş kaybettiriyor.
//
// Çalıştırma:
//   deno run --allow-read supabase/tests/hours.test.ts
import { isOpenNow, type OpenSettings, type WorkingHours } from '../functions/_shared/hours.ts';

const HOURS: WorkingHours = {
  monday: { enabled: true, open: '11:00', close: '01:00' },
  tuesday: { enabled: true, open: '11:00', close: '01:00' },
  wednesday: { enabled: true, open: '11:00', close: '01:00' },
  thursday: { enabled: true, open: '11:00', close: '02:00' },
  friday: { enabled: true, open: '11:00', close: '02:00' },
  saturday: { enabled: true, open: '11:00', close: '02:00' },
  sunday: { enabled: true, open: '11:00', close: '01:00' },
};

const settings: OpenSettings = {
  is_open: true,
  auto_close_enabled: true,
  working_hours: HOURS,
};

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n      beklenen: ${e}\n      gerçek:   ${a}`}`);
};

// Saatler Toronto'ya göre; buradaki değerler UTC (Eylül = EDT, UTC-4).
console.log('\n═══ 1) Normal gün ═══');
check('Çar 04:15 kapalı', isOpenNow(settings, new Date('2026-09-02T08:15:00Z')), false);
check('Çar 10:59 kapalı (açılıştan bir dakika önce)', isOpenNow(settings, new Date('2026-09-02T14:59:00Z')), false);
check('Çar 11:00 açık', isOpenNow(settings, new Date('2026-09-02T15:00:00Z')), true);
check('Çar 23:59 açık', isOpenNow(settings, new Date('2026-09-03T03:59:00Z')), true);

console.log('\n═══ 2) Gece yarısını geçen servis ═══');
check('Per 00:30 açık — Çarşamba servisi sürüyor', isOpenNow(settings, new Date('2026-09-03T04:30:00Z')), true);
check('Per 01:00 açık — kapanış anı', isOpenNow(settings, new Date('2026-09-03T05:00:00Z')), true);
check('Per 01:30 kapalı — Çarşamba bitti, Perşembe 11:00da açıyor', isOpenNow(settings, new Date('2026-09-03T05:30:00Z')), false);
check('Cum 01:59 açık — Perşembe 02:00da kapanıyor', isOpenNow(settings, new Date('2026-09-04T05:59:00Z')), true);
check('Cum 02:01 kapalı', isOpenNow(settings, new Date('2026-09-04T06:01:00Z')), false);
check('Pzt 00:30 açık — Pazar servisi sürüyor', isOpenNow(settings, new Date('2026-09-07T04:30:00Z')), true);

console.log('\n═══ 3) Şalterler ═══');
check(
  'is_open kapalıysa saat ne olursa olsun kapalı',
  isOpenNow({ ...settings, is_open: false }, new Date('2026-09-02T18:00:00Z')),
  false
);
check(
  'auto_close kapalıysa saat tablosu yok sayılıyor',
  isOpenNow({ ...settings, auto_close_enabled: false }, new Date('2026-09-02T08:15:00Z')),
  true
);
check(
  'saat verisi yoksa is_open geçerli',
  isOpenNow({ ...settings, working_hours: null }, new Date('2026-09-02T08:15:00Z')),
  true
);
check(
  'gün kapalı işaretliyse o gün kapalı',
  isOpenNow(
    { ...settings, working_hours: { ...HOURS, wednesday: { enabled: false, open: '11:00', close: '01:00' } } },
    new Date('2026-09-02T18:00:00Z')
  ),
  false
);

console.log(failures === 0 ? '\n✅ TÜM KONTROLLER GEÇTİ' : `\n❌ ${failures} KONTROL BAŞARISIZ`);
Deno.exit(failures ? 1 : 0);
