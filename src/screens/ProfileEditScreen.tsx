import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { updateUserProfile } from '../services/userService';
import Toast from 'react-native-toast-message';

// Profil düzenleme ekranı (Profile edit screen)
const ProfileEditScreen = ({ navigation }: any) => {
  const { user, setUser } = useAuthStore();

  // Form state'leri (Form states)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Kullanıcı bilgilerini yükle (Load user data)
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  // Profili kaydet (Save profile)
  const handleSave = async () => {
    if (!user) return;

    // Validasyon (Validation)
    if (!fullName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen adınızı ve soyadınızı girin',
      });
      return;
    }

    if (!phone.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen telefon numaranızı girin',
      });
      return;
    }

    // Telefon formatı kontrolü (Phone format validation)
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen geçerli bir telefon numarası girin (10-11 rakam)',
      });
      return;
    }

    try {
      setIsLoading(true);

      // Profili güncelle (Update profile)
      const updatedUser = await updateUserProfile(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });

      // Store'u güncelle (Update store)
      setUser(updatedUser);

      Toast.show({
        type: 'success',
        text1: '✅ Başarılı',
        text2: 'Profiliniz güncellendi',
      });

      // Geri dön (Go back)
      navigation.goBack();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: error.message || 'Profil güncellenirken bir hata oluştu',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık (Header) */}
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={80} color={Colors.primary} />
          <Text style={styles.headerTitle}>Profil Bilgileriniz</Text>
          <Text style={styles.headerSubtitle}>
            Adınızı ve telefon numaranızı güncelleyin
          </Text>
        </View>

        {/* Form (Form) */}
        <View style={styles.form}>
          {/* Email (sadece gösterim) - Email (display only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.input, styles.disabledInput]}>
              <Ionicons name="mail-outline" size={20} color="#999" />
              <Text style={styles.disabledText}>{user?.email}</Text>
            </View>
            <Text style={styles.helperText}>Email değiştirilemez</Text>
          </View>

          {/* Ad Soyad (Full Name) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ad Soyad *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder="Adınız ve soyadınız"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Telefon (Phone) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefon *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder="5XX XXX XX XX"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={11}
              />
            </View>
            <Text style={styles.helperText}>Örnek: 5551234567</Text>
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
              <Text style={styles.saveButtonText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: '#666',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
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
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
  },
  disabledText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: '#999',
  },
  helperText: {
    fontSize: FontSizes.xs,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xl,
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

export default ProfileEditScreen;

