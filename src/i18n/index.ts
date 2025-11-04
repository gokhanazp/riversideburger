// i18n Configuration - Çoklu Dil Yapılandırması
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tr from './locales/tr.json';
import en from './locales/en.json';

const LANGUAGE_KEY = '@app_language';

// Varsayılan dil (Default language)
const DEFAULT_LANGUAGE = 'tr';

// Dil kaynaklarını tanımla (Define language resources)
const resources = {
  tr: { translation: tr },
  en: { translation: en },
};

// i18n'i başlat (Initialize i18n)
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    compatibilityJSON: 'v3',
    returnNull: false,
    returnEmptyString: false,
    interpolation: {
      escapeValue: false,
    },
  });

// Kaydedilmiş dili yükle (Load saved language)
export const loadSavedLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage && (savedLanguage === 'tr' || savedLanguage === 'en')) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (error) {
    console.error('Error loading saved language:', error);
  }
};

// Dili değiştir ve kaydet (Change and save language)
export const changeLanguage = async (language: 'tr' | 'en') => {
  try {
    await i18n.changeLanguage(language);
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    console.error('Error changing language:', error);
  }
};

export default i18n;

