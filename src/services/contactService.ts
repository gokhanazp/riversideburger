import { supabase } from '../lib/supabase';

// İletişim bilgileri tipi (Contact information type)
export interface ContactInfo {
  phone1: string;
  phone2: string;
  email: string;
  address1: string;
  address2: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
}

// Varsayılan iletişim bilgileri (Default contact information)
const DEFAULT_CONTACT_INFO: ContactInfo = {
  phone1: '+1 (416) 850-7026',
  phone2: '+1 (416) 935-6600',
  email: 'riversideburgerss@gmail.com',
  address1: '688 Queen Street East\nToronto, Ontario',
  address2: '1228 King St W\nToronto, Ontario',
  facebook: 'https://www.facebook.com/riversideburgers',
  instagram: 'https://www.instagram.com/riversideburgers',
  whatsapp: '+14168507026',
};

// Global cache (to avoid multiple async calls)
let cachedContactInfo: ContactInfo | null = null;

/**
 * İletişim bilgilerini getir (Get contact information)
 * Cache'den döner, yoksa veritabanından yükler
 * (Returns from cache, loads from database if not cached)
 */
export const getContactInfo = async (): Promise<ContactInfo> => {
  // Cache'de varsa döndür (Return from cache if available)
  if (cachedContactInfo) {
    return cachedContactInfo;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'contact_phone1',
        'contact_phone2',
        'contact_email',
        'contact_address1',
        'contact_address2',
        'social_facebook',
        'social_instagram',
        'social_whatsapp',
      ]);

    if (error) {
      console.error('Error fetching contact info:', error);
      return DEFAULT_CONTACT_INFO;
    }

    // Ayarları objeye çevir (Convert settings to object)
    const contactInfo: any = { ...DEFAULT_CONTACT_INFO };
    data?.forEach((item) => {
      const key = item.setting_key
        .replace('contact_', '')
        .replace('social_', '');
      contactInfo[key] = item.setting_value || DEFAULT_CONTACT_INFO[key as keyof ContactInfo];
    });

    // Cache'e kaydet (Save to cache)
    cachedContactInfo = contactInfo;
    return contactInfo;
  } catch (error) {
    console.error('Error in getContactInfo:', error);
    return DEFAULT_CONTACT_INFO;
  }
};

/**
 * Cache'i temizle (Clear cache)
 * Admin ayarları güncellendiğinde çağrılmalı
 * (Should be called when admin settings are updated)
 */
export const clearContactCache = () => {
  cachedContactInfo = null;
  console.log('📞 Contact info cache cleared');
};

/**
 * İletişim bilgilerini yeniden yükle (Reload contact information)
 */
export const reloadContactInfo = async (): Promise<ContactInfo> => {
  clearContactCache();
  return await getContactInfo();
};

/**
 * Telefon numarasını formatla (Format phone number)
 * +14168507026 -> (416) 850-7026
 */
export const formatPhoneNumber = (phone: string): string => {
  // Sadece rakamları al (Get only digits)
  const digits = phone.replace(/\D/g, '');
  
  // +1 ile başlıyorsa kaldır (Remove +1 if starts with it)
  const cleaned = digits.startsWith('1') ? digits.substring(1) : digits;
  
  // Format: (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  
  return phone; // Formatlanamazsa olduğu gibi döndür
};

/**
 * Telefon numarasını tel: formatına çevir (Convert to tel: format)
 * (416) 850-7026 -> tel:+14168507026
 */
export const getPhoneLink = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return `tel:+${digits.startsWith('1') ? digits : '1' + digits}`;
};

/**
 * WhatsApp linkini oluştur (Create WhatsApp link)
 * +14168507026 -> https://wa.me/14168507026
 */
export const getWhatsAppLink = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('1') ? digits : '1' + digits}`;
};

/**
 * E-posta linkini oluştur (Create email link)
 * info@example.com -> mailto:info@example.com
 */
export const getEmailLink = (email: string, subject?: string): string => {
  if (subject) {
    return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  }
  return `mailto:${email}`;
};

