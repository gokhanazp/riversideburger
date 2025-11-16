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
  formatPostalCode as formatTurkishPostalCode,
  validatePostalCode as validateTurkishPostalCode,
  formatPhoneNumber as formatTurkishPhoneNumber,
  validatePhoneNumber as validateTurkishPhoneNumber,
} from '../constants/turkey';
import { useTranslation } from 'react-i18next';

// Adres düzenleme ekranı - Canada Format (Address edit screen - Canada Format)
const AddressEditScreen = ({ route, navigation }: any) => {
  const { t } = useTranslation();
  const { addressId } = route.params || {};
  const { user } = useAuthStore();
  const isEditMode = !!addressId;

  // Form state'leri (Form states)
  const [country, setCountry] = useState<'Canada' | 'Turkey'>('Canada'); // Ülke seçimi (Country selection)
  const [title, setTitle] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [city, setCity] = useState('Toronto');
  const [province, setProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);

  // Adres başlıkları (Address titles)
  const addressTitles = ['Home', 'Work', 'Other'];

  // Ülkeler (Countries)
  const countries = ['Canada', 'Turkey'];

  // Ülkeye göre şehir listesi (City list based on country)
  const getCityList = () => {
    return country === 'Canada' ? ONTARIO_CITIES : TURKISH_CITIES;
  };

  // Ülkeye göre eyalet/il listesi (Province list based on country)
  const getProvinceList = () => {
    return country === 'Canada' ? CANADIAN_PROVINCES : TURKISH_CITIES.map(city => ({ code: city, name: city }));
  };

  // Ülkeye göre format fonksiyonları (Format functions based on country)
  const formatPostalCode = (code: string) => {
    return country === 'Canada' ? formatCanadianPostalCode(code) : formatTurkishPostalCode(code);
  };

  const validatePostalCode = (code: string) => {
    return country === 'Canada' ? validateCanadianPostalCode(code) : validateTurkishPostalCode(code);
  };

  const formatPhoneNumber = (phoneNum: string) => {
    return country === 'Canada' ? formatCanadianPhoneNumber(phoneNum) : formatTurkishPhoneNumber(phoneNum);
  };

  const validatePhoneNumber = (phoneNum: string) => {
    return country === 'Canada' ? validateCanadianPhoneNumber(phoneNum) : validateTurkishPhoneNumber(phoneNum);
  };

  // Ülke değiştiğinde şehir ve eyalet/il bilgilerini sıfırla (Reset city and province when country changes)
  useEffect(() => {
    if (country === 'Canada') {
      setCity('Toronto');
      setProvince('ON');
    } else if (country === 'Turkey') {
      setCity('İstanbul');
      setProvince('İstanbul');
    }
  }, [country]);

  // Düzenleme modunda adresi yükle (Load address in edit mode)
  useEffect(() => {
    if (isEditMode) {
      loadAddress();
    } else if (user) {
      // Yeni adres eklerken kullanıcı bilgilerini doldur (Fill user info for new address)
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [addressId, user]);

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
        setCity(address.city);
        setProvince(address.province);
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
    if (!fullName.trim() || !phone.trim() || !streetNumber.trim() || !streetName.trim() || !city.trim() || !postalCode.trim()) {
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
        city: city.trim(),
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
        <Text style={styles.loadingText}>Loading address...</Text>
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
          <Text style={styles.sectionTitle}>Address Label</Text>
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
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder="John Doe"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={country === 'Canada' ? '(416) 555-1234' : '0(555) 123 45 67'}
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={country === 'Canada' ? 17 : 18}
              />
            </View>
          </View>
        </View>

        {/* Adres Bilgileri (Address Info) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Details</Text>

          {/* Ülke Seçimi (Country Selection) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country *</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowCountryModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
              <Text style={styles.selectButtonText}>{country}</Text>
              <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Street Number *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="123"
                  placeholderTextColor="#999"
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={styles.label}>Street Name *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Main Street"
                  placeholderTextColor="#999"
                  value={streetName}
                  onChangeText={setStreetName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit/Apartment Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="home-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder="Apt 4B (optional)"
                placeholderTextColor="#999"
                value={unitNumber}
                onChangeText={setUnitNumber}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City *</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {country === 'Canada' ? 'Province *' : 'City *'}
            </Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowProvinceModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color={Colors.primary} />
              <Text style={styles.selectButtonText}>
                {getProvinceList().find(p => p.code === province)?.name || province}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {country === 'Canada' ? 'Postal Code *' : 'Postal Code *'}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder={country === 'Canada' ? 'M5H 2N2' : '34000'}
                placeholderTextColor="#999"
                value={postalCode}
                onChangeText={setPostalCode}
                autoCapitalize={country === 'Canada' ? 'characters' : 'none'}
                keyboardType={country === 'Canada' ? 'default' : 'number-pad'}
                maxLength={country === 'Canada' ? 7 : 5}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Delivery Instructions</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Ring doorbell, Leave at door"
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
                {isEditMode ? 'Update Address' : 'Save Address'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* City Seçim Modal (City Selection Modal) */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={getCityList()}
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

      {/* Province Seçim Modal (Province Selection Modal) */}
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
                {country === 'Canada' ? 'Select Province' : 'Select City'}
              </Text>
              <TouchableOpacity onPress={() => setShowProvinceModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={getProvinceList()}
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
                    {country === 'Canada' && (
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

      {/* Country Seçim Modal (Country Selection Modal) */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countries}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    country === item && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setCountry(item as 'Canada' | 'Turkey');
                    setShowCountryModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      country === item && styles.modalItemTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {country === item && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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

