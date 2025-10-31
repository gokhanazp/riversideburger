// Canada Eyaletleri ve Bölgeleri (Canadian Provinces and Territories)
export const CANADIAN_PROVINCES = [
  { code: 'ON', name: 'Ontario' },
  { code: 'QC', name: 'Quebec' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'YT', name: 'Yukon' },
  { code: 'NU', name: 'Nunavut' },
];

// Ontario'daki büyük şehirler (Major cities in Ontario)
export const ONTARIO_CITIES = [
  'Toronto',
  'Ottawa',
  'Mississauga',
  'Brampton',
  'Hamilton',
  'London',
  'Markham',
  'Vaughan',
  'Kitchener',
  'Windsor',
  'Richmond Hill',
  'Oakville',
  'Burlington',
  'Oshawa',
  'Barrie',
  'St. Catharines',
  'Cambridge',
  'Waterloo',
  'Guelph',
  'Sudbury',
];

// Posta kodu formatı doğrulama (Postal code format validation)
// Canada posta kodu formatı: A1A 1A1 (harf-rakam-harf boşluk rakam-harf-rakam)
export const POSTAL_CODE_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

// Posta kodunu formatla (Format postal code)
export const formatPostalCode = (postalCode: string): string => {
  // Boşlukları ve tire işaretlerini kaldır (Remove spaces and dashes)
  const cleaned = postalCode.replace(/[\s-]/g, '').toUpperCase();
  
  // Eğer 6 karakter ise, ortaya boşluk ekle (If 6 characters, add space in middle)
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  
  return cleaned;
};

// Posta kodu doğrulama (Validate postal code)
export const validatePostalCode = (postalCode: string): boolean => {
  return POSTAL_CODE_REGEX.test(postalCode);
};

// Telefon numarası formatı (Phone number format)
// Canada telefon formatı: (XXX) XXX-XXXX veya XXX-XXX-XXXX
export const PHONE_REGEX = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/;

// Telefon numarasını formatla (Format phone number)
export const formatPhoneNumber = (phone: string): string => {
  // Sadece rakamları al (Get only digits)
  const cleaned = phone.replace(/\D/g, '');
  
  // Eğer 10 rakam ise, formatla (If 10 digits, format)
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Eğer 11 rakam ve 1 ile başlıyorsa (If 11 digits starting with 1)
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
};

// Telefon numarası doğrulama (Validate phone number)
export const validatePhoneNumber = (phone: string): boolean => {
  return PHONE_REGEX.test(phone);
};

