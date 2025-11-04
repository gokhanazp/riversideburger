// Currency Service - Para Birimi Servisi
// Basitleştirilmiş versiyon: Sadece sembol gösterimi (Simplified version: Only symbol display)
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const CURRENCY_KEY = '@app_currency';

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

// Varsayılan para birimi (Default currency)
const DEFAULT_CURRENCY: Currency = 'TRY';

// Mevcut para birimini al (Get current currency)
let currentCurrency: Currency = DEFAULT_CURRENCY;

// Dil seçimine göre para birimini otomatik belirle (Auto-determine currency based on language)
export const updateCurrencyFromLanguage = () => {
  const currentLanguage = i18n.language;
  if (currentLanguage === 'tr') {
    currentCurrency = 'TRY';
  } else if (currentLanguage === 'en') {
    currentCurrency = 'CAD';
  }
};

// Kaydedilmiş para birimini yükle (Load saved currency)
// Not: Artık dil ile senkronize (Note: Now synced with language)
export const loadSavedCurrency = async (): Promise<Currency> => {
  try {
    // Dil seçimine göre para birimini belirle (Determine currency based on language)
    updateCurrencyFromLanguage();
    return currentCurrency;
  } catch (error) {
    console.error('Error loading saved currency:', error);
    return DEFAULT_CURRENCY;
  }
};

// Para birimini değiştir (Change currency)
// Not: Artık kullanılmıyor, dil değişince otomatik değişiyor (Note: No longer used, changes automatically with language)
export const changeCurrency = async (currency: Currency): Promise<void> => {
  try {
    currentCurrency = currency;
    await AsyncStorage.setItem(CURRENCY_KEY, currency);
  } catch (error) {
    console.error('Error changing currency:', error);
    throw error;
  }
};

// Mevcut para birimini al (Get current currency)
export const getCurrentCurrency = (): Currency => {
  updateCurrencyFromLanguage(); // Her çağrıda dil ile senkronize et (Sync with language on every call)
  return currentCurrency;
};

// Para birimi bilgisini al (Get currency info)
export const getCurrencyInfo = (currency?: Currency) => {
  const curr = currency || currentCurrency;
  return CURRENCIES[curr];
};

// Fiyatı formatla (Format price)
// Basitleştirilmiş: Sadece sembol ekler, dönüştürme yapmaz (Simplified: Only adds symbol, no conversion)
export const formatPrice = (price: number, showSymbol: boolean = true): string => {
  updateCurrencyFromLanguage(); // Dil ile senkronize et (Sync with language)
  const currencyInfo = CURRENCIES[currentCurrency];

  // Fiyatı formatla (Format price with 2 decimals)
  const formattedPrice = price.toFixed(2);

  if (showSymbol) {
    return `${currencyInfo.symbol}${formattedPrice}`;
  }

  return formattedPrice;
};

// Servis başlatma (Initialize service)
export const initializeCurrencyService = async (): Promise<void> => {
  await loadSavedCurrency();
};

