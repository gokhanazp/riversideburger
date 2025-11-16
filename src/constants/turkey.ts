// Türkiye İlleri (Turkish Provinces/Cities)
export const TURKISH_CITIES = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Aksaray',
  'Amasya',
  'Ankara',
  'Antalya',
  'Ardahan',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bartın',
  'Batman',
  'Bayburt',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Düzce',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Iğdır',
  'Isparta',
  'İstanbul',
  'İzmir',
  'Kahramanmaraş',
  'Karabük',
  'Karaman',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırıkkale',
  'Kırklareli',
  'Kırşehir',
  'Kilis',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Mardin',
  'Mersin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Osmaniye',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Şanlıurfa',
  'Şırnak',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Uşak',
  'Van',
  'Yalova',
  'Yozgat',
  'Zonguldak',
];

// Posta kodu formatı doğrulama (Postal code format validation)
// Türkiye posta kodu formatı: 5 rakam (örn: 34000)
export const POSTAL_CODE_REGEX = /^\d{5}$/;

// Posta kodunu formatla (Format postal code)
export const formatPostalCode = (postalCode: string): string => {
  // Sadece rakamları al (Get only digits)
  const cleaned = postalCode.replace(/\D/g, '');
  
  // İlk 5 rakamı al (Take first 5 digits)
  return cleaned.slice(0, 5);
};

// Posta kodu doğrulama (Validate postal code)
export const validatePostalCode = (postalCode: string): boolean => {
  return POSTAL_CODE_REGEX.test(postalCode);
};

// Telefon numarası formatı (Phone number format)
// Türkiye telefon formatı: 0(5XX) XXX XX XX veya +90 5XX XXX XX XX
export const PHONE_REGEX = /^(\+?90|0)?5\d{9}$/;

// Telefon numarasını formatla (Format phone number)
export const formatPhoneNumber = (phone: string): string => {
  // Sadece rakamları al (Get only digits)
  const cleaned = phone.replace(/\D/g, '');
  
  // Eğer 11 rakam ve 0 ile başlıyorsa (If 11 digits starting with 0)
  if (cleaned.length === 11 && cleaned[0] === '0') {
    return `0(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
  }
  
  // Eğer 12 rakam ve 90 ile başlıyorsa (If 12 digits starting with 90)
  if (cleaned.length === 12 && cleaned.startsWith('90')) {
    return `+90 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  
  // Eğer 10 rakam ve 5 ile başlıyorsa (If 10 digits starting with 5)
  if (cleaned.length === 10 && cleaned[0] === '5') {
    return `0(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  
  return phone;
};

// Telefon numarası doğrulama (Validate phone number)
export const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return PHONE_REGEX.test(cleaned);
};

