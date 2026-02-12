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
  footerAbout: string;
  footerCopyright: string;
  // About Us Section
  aboutTitleTr: string;
  aboutTitleEn: string;
  aboutDescTr: string;
  aboutDescEn: string;
  aboutImage: string;
  // Why Riverside Section
  whyTitleTr: string;
  whyTitleEn: string;
  // Feature 1
  whyFeature1TitleTr: string;
  whyFeature1TitleEn: string;
  whyFeature1DescTr: string;
  whyFeature1DescEn: string;
  // Feature 2
  whyFeature2TitleTr: string;
  whyFeature2TitleEn: string;
  whyFeature2DescTr: string;
  whyFeature2DescEn: string;
  // Feature 3
  whyFeature3TitleTr: string;
  whyFeature3TitleEn: string;
  whyFeature3DescTr: string;
  whyFeature3DescEn: string;
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
  footerAbout: 'Riverside Burgers was established in 2019. Our passion for fresh and high quality burgers led us to creating our Signature Burger.',
  footerCopyright: '© 2024 Riverside Burgers. All rights reserved.',
  
  // About Us Defaults
  aboutTitleTr: 'Hakkımızda',
  aboutTitleEn: 'About Us',
  aboutDescTr: 'Riverside Burgers 2019 yılında kuruldu. Taze ve kaliteli burgerlere olan tutkumuz bizi İmza Burgerimizi yaratmaya yöneltti. Yanı sıra herkesin favorisi Klasik Burgerlerimizi de sunuyoruz. Her şeyi taze, lezzetli ve ağız sulandıran bir şekilde sizin için hazırlamaktan gurur duyuyoruz!',
  aboutDescEn: 'Riverside Burgers was established in 2019. Our passion for fresh and high quality burgers led us to creating our Signature Burger, along with serving you everyone\'s favourite Classic Burgers. We take pride in making everything in house with the highest quality of meat and produces to keep it fresh, tasty and mouth-watering to keep you coming back for more!',
  aboutImage: 'https://riversideburgers.ca/wp-content/uploads/2020/12/83333940_125121939016697_1418790697863077606_n-1.jpg',
  
  // Why Riverside Defaults
  whyTitleTr: '🎯 Neden Riverside Burgers?',
  whyTitleEn: '🎯 Why Riverside Burgers?',
  
  whyFeature1TitleTr: 'Hızlı Teslimat',
  whyFeature1TitleEn: 'Fast Delivery',
  whyFeature1DescTr: '30 dakikada kapınızda, sıcacık teslim',
  whyFeature1DescEn: 'At your door in 30 minutes, hot and fresh',
  
  whyFeature2TitleTr: 'Kalite Garantisi',
  whyFeature2TitleEn: 'Quality Guarantee',
  whyFeature2DescTr: 'Her zaman taze malzemeler ve hijyen',
  whyFeature2DescEn: 'Always fresh ingredients and hygiene',
  
  whyFeature3TitleTr: '5 Yıldız Memnuniyet',
  whyFeature3TitleEn: '5 Star Satisfaction',
  whyFeature3DescTr: 'Binlerce mutlu müşteri yorumu',
  whyFeature3DescEn: 'Thousands of happy customer reviews',
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
        'footer_about',
        'footer_copyright',
        // About Us
        'home_about_title_tr',
        'home_about_title_en',
        'home_about_desc_tr',
        'home_about_desc_en',
        'home_about_image',
        // Why Riverside
        'home_why_title_tr',
        'home_why_title_en',
        'home_why_f1_title_tr',
        'home_why_f1_title_en',
        'home_why_f1_desc_tr',
        'home_why_f1_desc_en',
        'home_why_f2_title_tr',
        'home_why_f2_title_en',
        'home_why_f2_desc_tr',
        'home_why_f2_desc_en',
        'home_why_f3_title_tr',
        'home_why_f3_title_en',
        'home_why_f3_desc_tr',
        'home_why_f3_desc_en',
      ]);

    if (error) {
      console.error('Error fetching contact info:', error);
      return DEFAULT_CONTACT_INFO;
    }

    // Ayarları objeye çevir (Convert settings to object)
    const contactInfo: any = { ...DEFAULT_CONTACT_INFO };
    data?.forEach((item) => {
      let key = item.setting_key;
      
      if (key.startsWith('contact_')) {
        key = key.replace('contact_', '');
      } else if (key.startsWith('social_')) {
        key = key.replace('social_', '');
      } else if (key.startsWith('footer_')) {
        key = key.replace('footer_', '');
        if (key === 'about') key = 'footerAbout';
        if (key === 'copyright') key = 'footerCopyright';
      } else if (key.startsWith('home_')) {
        // Map home_ settings to camelCase
        if (key === 'home_about_title_tr') key = 'aboutTitleTr';
        else if (key === 'home_about_title_en') key = 'aboutTitleEn';
        else if (key === 'home_about_desc_tr') key = 'aboutDescTr';
        else if (key === 'home_about_desc_en') key = 'aboutDescEn';
        else if (key === 'home_about_image') key = 'aboutImage';
        else if (key === 'home_why_title_tr') key = 'whyTitleTr';
        else if (key === 'home_why_title_en') key = 'whyTitleEn';
        else if (key === 'home_why_f1_title_tr') key = 'whyFeature1TitleTr';
        else if (key === 'home_why_f1_title_en') key = 'whyFeature1TitleEn';
        else if (key === 'home_why_f1_desc_tr') key = 'whyFeature1DescTr';
        else if (key === 'home_why_f1_desc_en') key = 'whyFeature1DescEn';
        else if (key === 'home_why_f2_title_tr') key = 'whyFeature2TitleTr';
        else if (key === 'home_why_f2_title_en') key = 'whyFeature2TitleEn';
        else if (key === 'home_why_f2_desc_tr') key = 'whyFeature2DescTr';
        else if (key === 'home_why_f2_desc_en') key = 'whyFeature2DescEn';
        else if (key === 'home_why_f3_title_tr') key = 'whyFeature3TitleTr';
        else if (key === 'home_why_f3_title_en') key = 'whyFeature3TitleEn';
        else if (key === 'home_why_f3_desc_tr') key = 'whyFeature3DescTr';
        else if (key === 'home_why_f3_desc_en') key = 'whyFeature3DescEn';
      }

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

