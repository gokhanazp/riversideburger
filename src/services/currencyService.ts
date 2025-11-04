// Currency Service - Para Birimi Servisi
// Admin'in seçtiği ülkeye göre para birimi gösterimi (Currency display based on admin's country selection)
import i18n from '../i18n';

// Para birimi tipleri (Currency types)
export type Currency = 'TRY' | 'CAD';

// Para birimi bilgileri (Currency information)
export const CURRENCIES = {
  TRY: {
    code: 'TRY',
    symbol: '₺',
    name: 'Turkish Lira',
    nameTR: 'Türk Lirası',
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    name: 'Canadian Dollar',
    nameTR: 'Kanada Doları',
  },
};

// Mevcut para birimini al (Get current currency)
// Dil seçimine göre otomatik belirlenir (Automatically determined by language selection)
export const getCurrentCurrency = (): Currency => {
  const currentLanguage = i18n.language;
  return currentLanguage === 'tr' ? 'TRY' : 'CAD';
};

// Para birimi bilgisini al (Get currency info)
export const getCurrencyInfo = (currency?: Currency) => {
  const curr = currency || getCurrentCurrency();
  return CURRENCIES[curr];
};

// Fiyatı formatla (Format price)
// Sadece sembol ekler, dönüştürme yapmaz (Only adds symbol, no conversion)
export const formatPrice = (price: number, showSymbol: boolean = true): string => {
  const currency = getCurrentCurrency();
  const currencyInfo = CURRENCIES[currency];

  // Fiyatı formatla (Format price with 2 decimals)
  const formattedPrice = price.toFixed(2);

  if (showSymbol) {
    return `${currencyInfo.symbol}${formattedPrice}`;
  }

  return formattedPrice;
};

