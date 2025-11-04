import { supabase } from '../config/supabase';

// Uygulama ayarları tipleri (App settings types)
export type AppCountry = 'turkey' | 'canada';
export type AppLanguage = 'tr' | 'en';
export type AppCurrency = 'TRY' | 'CAD';

export interface AppSettings {
  country: AppCountry;
  language: AppLanguage;
  currency: AppCurrency;
}

// Ülke bilgisi (Country info)
export const COUNTRIES = {
  turkey: {
    code: 'turkey',
    name: 'Türkiye',
    flag: '🇹🇷',
    language: 'tr' as AppLanguage,
    currency: 'TRY' as AppCurrency,
  },
  canada: {
    code: 'canada',
    name: 'Canada',
    flag: '🇨🇦',
    language: 'en' as AppLanguage,
    currency: 'CAD' as AppCurrency,
  },
};

// Uygulama ayarlarını getir (Get app settings)
export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['app_country', 'app_language', 'app_currency']);

    if (error) {
      console.error('Error fetching app settings:', error);
      // Varsayılan ayarları döndür (Return default settings)
      return {
        country: 'canada',
        language: 'en',
        currency: 'CAD',
      };
    }

    // Ayarları objeye çevir (Convert settings to object)
    const settings: any = {};
    data?.forEach((item) => {
      const key = item.setting_key.replace('app_', '');
      settings[key] = item.setting_value;
    });

    return {
      country: settings.country || 'canada',
      language: settings.language || 'en',
      currency: settings.currency || 'CAD',
    };
  } catch (error) {
    console.error('Error in getAppSettings:', error);
    // Varsayılan ayarları döndür (Return default settings)
    return {
      country: 'canada',
      language: 'en',
      currency: 'CAD',
    };
  }
};

// Ülke ayarını güncelle (Update country setting)
// Ülke değiştiğinde dil ve para birimi otomatik güncellenir
// (When country changes, language and currency are automatically updated)
export const updateAppCountry = async (country: AppCountry): Promise<boolean> => {
  try {
    const countryInfo = COUNTRIES[country];

    // Ülke, dil ve para birimini güncelle (Update country, language, and currency)
    const updates = [
      { setting_key: 'app_country', setting_value: country },
      { setting_key: 'app_language', setting_value: countryInfo.language },
      { setting_key: 'app_currency', setting_value: countryInfo.currency },
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('app_settings')
        .update({ setting_value: update.setting_value, updated_at: new Date().toISOString() })
        .eq('setting_key', update.setting_key);

      if (error) {
        console.error(`Error updating ${update.setting_key}:`, error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in updateAppCountry:', error);
    return false;
  }
};

// Tek bir ayarı getir (Get single setting)
export const getSetting = async (key: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error) {
      console.error(`Error fetching setting ${key}:`, error);
      return null;
    }

    return data?.setting_value || null;
  } catch (error) {
    console.error(`Error in getSetting for ${key}:`, error);
    return null;
  }
};

