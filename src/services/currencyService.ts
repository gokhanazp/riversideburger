// Currency Service - Para Birimi Servisi
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    rate: 1, // Base currency
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    name: 'Canadian Dollar',
    nameTR: 'Kanada Doları',
    rate: 0.05, // 1 TRY = 0.05 CAD (örnek kur - example rate)
  },
};

// Varsayılan para birimi (Default currency)
const DEFAULT_CURRENCY: Currency = 'TRY';

// Mevcut para birimini al (Get current currency)
let currentCurrency: Currency = DEFAULT_CURRENCY;

// Kaydedilmiş para birimini yükle (Load saved currency)
export const loadSavedCurrency = async (): Promise<Currency> => {
  try {
    const savedCurrency = await AsyncStorage.getItem(CURRENCY_KEY);
    if (savedCurrency && (savedCurrency === 'TRY' || savedCurrency === 'CAD')) {
      currentCurrency = savedCurrency;
      return savedCurrency;
    }
    return DEFAULT_CURRENCY;
  } catch (error) {
    console.error('Error loading saved currency:', error);
    return DEFAULT_CURRENCY;
  }
};

// Para birimini değiştir ve kaydet (Change and save currency)
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
  return currentCurrency;
};

// Para birimi bilgisini al (Get currency info)
export const getCurrencyInfo = (currency?: Currency) => {
  const curr = currency || currentCurrency;
  return CURRENCIES[curr];
};

// Fiyatı dönüştür (Convert price)
export const convertPrice = (price: number, fromCurrency: Currency = 'TRY', toCurrency?: Currency): number => {
  const targetCurrency = toCurrency || currentCurrency;
  
  if (fromCurrency === targetCurrency) {
    return price;
  }

  // TRY'den hedef para birimine dönüştür (Convert from TRY to target currency)
  if (fromCurrency === 'TRY') {
    return price * CURRENCIES[targetCurrency].rate;
  }

  // Diğer para biriminden TRY'ye dönüştür (Convert from other currency to TRY)
  if (targetCurrency === 'TRY') {
    return price / CURRENCIES[fromCurrency].rate;
  }

  // İki para birimi arasında dönüştür (Convert between two currencies)
  const priceInTRY = price / CURRENCIES[fromCurrency].rate;
  return priceInTRY * CURRENCIES[targetCurrency].rate;
};

// Fiyatı formatla (Format price)
// Eski fonksiyon - geriye dönük uyumluluk için (Old function - for backward compatibility)
export const formatPrice = (price: number, currency?: Currency, showSymbol: boolean = true): string => {
  const curr = currency || currentCurrency;
  const currencyInfo = CURRENCIES[curr];
  const convertedPrice = convertPrice(price, 'TRY', curr);

  // Fiyatı formatla (Format price with 2 decimals)
  const formattedPrice = convertedPrice.toFixed(2);

  if (showSymbol) {
    // Para birimi sembolünü ekle (Add currency symbol)
    if (curr === 'TRY') {
      return `${currencyInfo.symbol}${formattedPrice}`;
    } else {
      return `${currencyInfo.symbol}${formattedPrice}`;
    }
  }

  return formattedPrice;
};

// Ürün fiyatını formatla (Format product price with its own currency)
// Ürünün kendi para biriminden mevcut gösterim para birimine dönüştürür
// (Converts from product's own currency to current display currency)
export const formatProductPrice = (
  price: number,
  productCurrency: Currency = 'TRY',
  displayCurrency?: Currency,
  showSymbol: boolean = true
): string => {
  const targetCurrency = displayCurrency || currentCurrency;
  const currencyInfo = CURRENCIES[targetCurrency];

  // Ürünün para biriminden hedef para birimine dönüştür
  // (Convert from product currency to target currency)
  const convertedPrice = convertPrice(price, productCurrency, targetCurrency);

  // Fiyatı formatla (Format price with 2 decimals)
  const formattedPrice = convertedPrice.toFixed(2);

  if (showSymbol) {
    return `${currencyInfo.symbol}${formattedPrice}`;
  }

  return formattedPrice;
};

// Kur güncelleme fonksiyonu (Update exchange rate)
// Not: Gerçek uygulamada bu bir API'den alınmalı (In production, this should fetch from an API)
export const updateExchangeRate = async (currency: Currency, rate: number): Promise<void> => {
  try {
    CURRENCIES[currency].rate = rate;
    // Kuru kaydet (Save rate to storage if needed)
    await AsyncStorage.setItem(`@exchange_rate_${currency}`, rate.toString());
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    throw error;
  }
};

// Kaydedilmiş kurları yükle (Load saved exchange rates)
export const loadSavedExchangeRates = async (): Promise<void> => {
  try {
    const cadRate = await AsyncStorage.getItem('@exchange_rate_CAD');
    if (cadRate) {
      CURRENCIES.CAD.rate = parseFloat(cadRate);
    }
  } catch (error) {
    console.error('Error loading saved exchange rates:', error);
  }
};

// Servis başlatma (Initialize service)
export const initializeCurrencyService = async (): Promise<void> => {
  await loadSavedCurrency();
  await loadSavedExchangeRates();
};

