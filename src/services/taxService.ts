// Satış vergisi (HST) servisi
//
// Vergi oranı sabit yazılmıyor: oranlar değişir ve her değişiklikte yeni sürüm
// çıkarmak istemiyoruz. settings.tax_rate'ten okunup önbelleğe alınıyor.
//
// Vergi tabanı (kullanıcı onayıyla belirlendi):
//   taban = max(0, kalem toplamı - indirim - puan) + teslimat ücreti
//   vergi = taban × oran
// Bahşiş vergiye tabi DEĞİL (Kanada'da gratuity HST'den muaf) ve bahşiş yine
// vergi öncesi tutardan hesaplanıyor.

import { supabase } from '../lib/supabase';

// Ontario HST. Ayar okunamazsa buna düşülür — vergiyi sessizce 0 yapmak
// müşteriden eksik tahsilat demek olur, o yüzden güvenli taraf bu.
const DEFAULT_TAX_RATE = 13;

let cachedRate: number | null = null;

/** Vergi oranını yüzde olarak döndürür (13 = %13) */
export const getTaxRate = (): number => cachedRate ?? DEFAULT_TAX_RATE;

/** Ayarlardan oranı yükle ve önbelleğe al. Uygulama açılışında çağrılır. */
export const loadTaxRate = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('tax_rate')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    const rate = Number(data?.tax_rate);
    if (Number.isFinite(rate) && rate >= 0) {
      cachedRate = rate;
    }
  } catch (e) {
    console.log('[tax] oran okunamadı, varsayılan kullanılıyor:', DEFAULT_TAX_RATE, e);
  }
  return getTaxRate();
};

/**
 * Verilen vergiye tabi taban üzerinden vergiyi hesaplar.
 * Kuruşa yuvarlanır; toplamın kırılımla birebir tutması için tek yer burası.
 */
export const calculateTax = (taxableBase: number): number => {
  if (!Number.isFinite(taxableBase) || taxableBase <= 0) return 0;
  return Number(((taxableBase * getTaxRate()) / 100).toFixed(2));
};
