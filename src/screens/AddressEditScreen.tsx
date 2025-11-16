import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { getAddress, createAddress, updateAddress } from '../services/addressService';
import { Address } from '../types/database.types';
import Toast from 'react-native-toast-message';
import {
  CANADIAN_PROVINCES,
  ONTARIO_CITIES,
  formatPostalCode as formatCanadianPostalCode,
  validatePostalCode as validateCanadianPostalCode,
  formatPhoneNumber as formatCanadianPhoneNumber,
  validatePhoneNumber as validateCanadianPhoneNumber,
} from '../constants/canada';
import {
  TURKISH_CITIES,
  TURKISH_DISTRICTS,
  formatPostalCode as formatTurkishPostalCode,
  validatePostalCode as validateTurkishPostalCode,
  formatPhoneNumber as formatTurkishPhoneNumber,
  validatePhoneNumber as validateTurkishPhoneNumber,
} from '../constants/turkey';
import { useTranslation } from 'react-i18next';
import { getAppSettings, AppCountry } from '../services/appSettingsService';

// Adres düzenleme ekranı - Canada Format (Address edit screen - Canada Format)
const AddressEditScreen = ({ route, navigation }: any) => {
  const { t } = useTranslation();
  const { addressId } = route.params || {};
  const { user } = useAuthStore();
  const isEditMode = !!addressId;

  // Form state'leri (Form states)
  const [country, setCountry] = useState<AppCountry>('canada'); // Admin'den gelecek (From admin settings)
  const [title, setTitle] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [province, setProvince] = useState('İstanbul'); // İl (Province/City)
  const [district, setDistrict] = useState(''); // İlçe (District) - Sadece Türkiye için
  const [city, setCity] = useState('Toronto'); // Şehir (City) - Sadece Kanada için
  const [postalCode, setPostalCode] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // Admin settings yüklenene kadar true
  const [showProvinceModal, setShowProvinceModal] = useState(false); // İl seçimi
  const [showDistrictModal, setShowDistrictModal] = useState(false); // İlçe seçimi
  const [showCityModal, setShowCityModal] = useState(false); // Kanada şehir seçimi

  // Adres başlıkları (Address titles)
  const addressTitles = [
    t('addressEdit.home'),
    t('addressEdit.work'),
    t('addressEdit.other')
  ];

  // Admin settings'den ülke bilgisini yükle (Load country from admin settings)
  useEffect(() => {
    loadCountrySettings();
  }, []);

  const loadCountrySettings = async () => {
    try {
      const settings = await getAppSettings();
      setCountry(settings.country);

      // Ülkeye göre varsayılan değerleri ayarla (Set default values based on country)
      if (settings.country === 'canada') {
        setCity('Toronto');
        setProvince('ON');
      } else {
        setProvince('İstanbul');
        setDistrict('');
      }
    } catch (error) {
      console.error('Error loading country settings:', error);
      // Varsayılan olarak Kanada (Default to Canada)
      setCountry('canada');
      setCity('Toronto');
      setProvince('ON');
    } finally {
      setIsLoadingData(false);
    }
  };

  // İl değiştiğinde ilçeyi sıfırla (Reset district when province changes)
  useEffect(() => {
    if (country === 'turkey') {
      setDistrict('');
    }
  }, [province]);

  // İlçe listesini getir (Get district list)
  const getDistrictList = (): string[] => {
    if (country === 'turkey' && TURKISH_DISTRICTS[province]) {
      return TURKISH_DISTRICTS[province];
    }
    return [];
  };

  // Ülkeye göre format fonksiyonları (Format functions based on country)
  const formatPostalCode = (code: string) => {
    return country === 'canada' ? formatCanadianPostalCode(code) : formatTurkishPostalCode(code);
  };

  const validatePostalCode = (code: string) => {
    return country === 'canada' ? validateCanadianPostalCode(code) : validateTurkishPostalCode(code);
  };

  const formatPhoneNumber = (phoneNum: string) => {
    return country === 'canada' ? formatCanadianPhoneNumber(phoneNum) : formatTurkishPhoneNumber(phoneNum);
  };

  const validatePhoneNumber = (phoneNum: string) => {
    return country === 'canada' ? validateCanadianPhoneNumber(phoneNum) : validateTurkishPhoneNumber(phoneNum);
  };

  // Düzenleme modunda adresi yükle (Load address in edit mode)
  useEffect(() => {
    // Country yüklendikten sonra adresi yükle
    if (!isLoadingData && country) {
      if (isEditMode) {
        loadAddress();
      } else if (user) {
        // Yeni adres eklerken kullanıcı bilgilerini doldur (Fill user info for new address)
        setFullName(user.full_name || '');
        setPhone(user.phone || '');
      }
    }
  }, [addressId, user, country, isLoadingData]);

  const loadAddress = async () => {
    try {
      const address = await getAddress(addressId);
      if (address) {
        setTitle(address.title);
        setFullName(address.full_name);
        setPhone(address.phone);
        setStreetNumber(address.street_number);
        setStreetName(address.street_name);
        setUnitNumber(address.unit_number || '');

        // Türkiye için: city alanı ilçe bilgisini içerir, province il bilgisini içerir
        // Kanada için: city şehir bilgisini içerir, province eyalet kodunu içerir
        if (country === 'turkey') {
          setProvince(address.province); // İl
          setDistrict(address.city); // İlçe
        } else {
          setCity(address.city); // Şehir
          setProvince(address.province); // Eyalet
        }

        setPostalCode(address.postal_code);
        setDeliveryInstructions(address.delivery_instructions || '');
      }
    } catch (error) {
      console.error('Error loading address:', error);
      Toast.show({
        type: 'error',
        text1: t('addressEdit.errorTitle'),
        text2: t('addressEdit.errorSave'),
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Kaydet (Save)
  const handleSave = async () => {
    if (!user) return;

    // Validasyon (Validation)
    const requiredFields = [fullName, phone, streetNumber, streetName, postalCode];

    // Türkiye için ilçe zorunlu, Kanada için city zorunlu
    if (country === 'turkey') {
      requiredFields.push(district);
    } else {
      requiredFields.push(city);
    }

    if (requiredFields.some(field => !field.trim())) {
      Toast.show({
        type: 'error',
        text1: t('addressEdit.errorTitle'),
        text2: t('addressEdit.errorAllFields')
      });
      return;
    }

    if (!validatePhoneNumber(phone)) {
      Toast.show({
        type: 'error',
        text1: t('addressEdit.errorTitle'),
        text2: t('addressEdit.errorPhone')
      });
      return;
    }

    if (!validatePostalCode(postalCode)) {
      Toast.show({
        type: 'error',
        text1: t('addressEdit.errorTitle'),
        text2: t('addressEdit.errorPostalCode')
      });
      return;
    }

    try {
      setIsLoading(true);

      const addressData = {
        user_id: user.id,
        title,
        full_name: fullName.trim(),
        phone: formatPhoneNumber(phone.trim()),
        street_number: streetNumber.trim(),
        street_name: streetName.trim(),
        unit_number: unitNumber.trim() || undefined,
        city: country === 'turkey' ? district.trim() : city.trim(), // Türkiye için ilçe, Kanada için city
        province,
        postal_code: formatPostalCode(postalCode.trim()),
        delivery_instructions: deliveryInstructions.trim() || undefined,
        is_default: false,
      };

      if (isEditMode) {
        await updateAddress(addressId, addressData);
        Toast.show({
          type: 'success',
          text1: t('addressEdit.successUpdate'),
          text2: '',
        });
      } else {
        await createAddress(addressData);
        Toast.show({
          type: 'success',
          text1: t('addressEdit.successCreate'),
          text2: '',
        });
      }

      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving address:', error);
      Toast.show({
        type: 'error',
        text1: t('addressEdit.errorTitle'),
        text2: error.message || t('addressEdit.errorSave'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Adres Başlığı (Address Title) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('addressEdit.addressTitle')}</Text>
          <View style={styles.titleButtons}>
            {addressTitles.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.titleButton, title === t && styles.titleButtonActive]}
                onPress={() => setTitle(t)}
              >
                <Text style={[styles.titleButtonText, title === t && styles.titleButtonTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* İletişim Bilgileri (Contact Info) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('addressEdit.contactInformation')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('addressEdit.fullName')} *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={t('addressEdit.fullNamePlaceholder')}
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('addressEdit.phone')} *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={t('addressEdit.phonePlaceholder')}
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={country === 'canada' ? 17 : 18}
              />
            </View>
          </View>
        </View>

        {/* Adres Bilgileri (Address Info) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('addressEdit.addressDetails')}</Text>

          {/* Türkiye için İl seçimi (Province selection for Turkey) */}
          {country === 'turkey' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('addressEdit.province')} *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowProvinceModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="map-outline" size={20} color={Colors.primary} />
                <Text style={styles.selectButtonText}>{province}</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Türkiye için İlçe seçimi (District selection for Turkey) */}
          {country === 'turkey' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('addressEdit.district')} *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => {
                  if (getDistrictList().length > 0) {
                    setShowDistrictModal(true);
                  } else {
                    Toast.show({
                      type: 'info',
                      text1: t('addressEdit.noDistricts'),
                      text2: t('addressEdit.noDistrictsDesc'),
                    });
                  }
                }}
                activeOpacity={0.7}
                disabled={getDistrictList().length === 0}
              >
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <Text style={[styles.selectButtonText, !district && { color: '#999' }]}>
                  {district || t('addressEdit.selectDistrict')}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sokak Adı ve Bina No (Street Name and Number) */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={styles.label}>{t('addressEdit.streetName')} *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('addressEdit.streetNamePlaceholder')}
                  placeholderTextColor="#999"
                  value={streetName}
                  onChangeText={setStreetName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>{t('addressEdit.streetNumber')} *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('addressEdit.streetNumberPlaceholder')}
                  placeholderTextColor="#999"
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          {/* Daire No (Unit Number) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('addressEdit.unitNumber')}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="home-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={t('addressEdit.unitNumberPlaceholder')}
                placeholderTextColor="#999"
                value={unitNumber}
                onChangeText={setUnitNumber}
              />
            </View>
          </View>

          {/* Kanada için City seçimi (City selection for Canada) */}
          {country === 'canada' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('addressEdit.city')} *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCityModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <Text style={styles.selectButtonText}>{city}</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Kanada için Province seçimi (Province selection for Canada) */}
          {country === 'canada' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('addressEdit.province')} *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowProvinceModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="map-outline" size={20} color={Colors.primary} />
                <Text style={styles.selectButtonText}>
                  {CANADIAN_PROVINCES.find(p => p.code === province)?.name || province}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('addressEdit.postalCode')} *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={t('addressEdit.postalCodePlaceholder')}
                placeholderTextColor="#999"
                value={postalCode}
                onChangeText={setPostalCode}
                autoCapitalize={country === 'canada' ? 'characters' : 'none'}
                keyboardType={country === 'canada' ? 'default' : 'number-pad'}
                maxLength={country === 'canada' ? 7 : 5}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('addressEdit.deliveryInstructions')}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={t('addressEdit.deliveryInstructionsPlaceholder')}
                placeholderTextColor="#999"
                value={deliveryInstructions}
                onChangeText={setDeliveryInstructions}
                multiline
              />
            </View>
          </View>
        </View>

        {/* Kaydet Butonu (Save Button) */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.white} />
              <Text style={styles.saveButtonText}>
                {isEditMode ? t('common.save') : t('common.save')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* City Seçim Modal (City Selection Modal) - Sadece Kanada için */}
      {country === 'canada' && (
        <Modal
          visible={showCityModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCityModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('addressEdit.selectCity')}</Text>
                <TouchableOpacity onPress={() => setShowCityModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={ONTARIO_CITIES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      city === item && styles.modalItemActive,
                    ]}
                    onPress={() => {
                      setCity(item);
                      setShowCityModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        city === item && styles.modalItemTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {city === item && (
                      <Ionicons name="checkmark" size={24} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Province/İl Seçim Modal (Province Selection Modal) */}
      <Modal
        visible={showProvinceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProvinceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {country === 'canada' ? t('addressEdit.selectProvince') : t('addressEdit.selectProvince')}
              </Text>
              <TouchableOpacity onPress={() => setShowProvinceModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={country === 'canada' ? CANADIAN_PROVINCES : TURKISH_CITIES.map(c => ({ code: c, name: c }))}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    province === item.code && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setProvince(item.code);
                    setShowProvinceModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.modalItemText,
                        province === item.code && styles.modalItemTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {country === 'canada' && (
                      <Text style={styles.modalItemSubtext}>{item.code}</Text>
                    )}
                  </View>
                  {province === item.code && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* İlçe Seçim Modal (District Selection Modal) - Sadece Türkiye için */}
      {country === 'turkey' && (
        <Modal
          visible={showDistrictModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDistrictModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('addressEdit.selectDistrict')}</Text>
                <TouchableOpacity onPress={() => setShowDistrictModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={getDistrictList()}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      district === item && styles.modalItemActive,
                    ]}
                    onPress={() => {
                      setDistrict(item);
                      setShowDistrictModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        district === item && styles.modalItemTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {district === item && (
                      <Ionicons name="checkmark" size={24} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  titleButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  titleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  titleButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  titleButtonText: {
    fontSize: FontSizes.md,
    color: '#666',
    fontWeight: '600',
  },
  titleButtonTextActive: {
    color: Colors.white,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...Shadows.small,
  },
  textInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...Shadows.small,
  },
  selectButtonText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalItemActive: {
    backgroundColor: '#FFF5F5',
  },
  modalItemText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '500',
  },
  modalItemTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  modalItemSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default AddressEditScreen;

