// Currency Service - Para Birimi Servisi
// Admin'in seçtiği ülkeye göre para birimi gösterimi (Currency display based on admin's country selection)
import { getAppSettings } from './appSettingsService';

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

// Global currency cache (to avoid multiple async calls)
let cachedCurrency: Currency = 'CAD'; // Default

// Mevcut para birimini al (Get current currency)
// App settings'ten para birimini alır (Gets currency from app settings)
export const getCurrentCurrency = (): Currency => {
  return cachedCurrency;
};

// Para birimini yükle ve cache'e al (Load and cache currency)
export const loadCurrency = async (): Promise<Currency> => {
  try {
    const settings = await getAppSettings();
    cachedCurrency = settings.currency;
    return cachedCurrency;
  } catch (error) {
    console.error('Error loading currency:', error);
    return cachedCurrency; // Return cached or default
  }
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

