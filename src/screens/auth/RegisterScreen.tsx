import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

export default function RegisterScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const register = useAuthStore((state) => state.register);

  // Kayıt ol (Handle register)
  const handleRegister = async () => {
    console.log('📝 Register button pressed');

    // Validasyon (Validation)
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      console.log('❌ Validation failed: Missing fields');
      Toast.show({
        type: 'error',
        text1: t('auth.error'),
        text2: t('auth.fillAllFields'),
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    if (password !== confirmPassword) {
      console.log('❌ Validation failed: Password mismatch');
      Toast.show({
        type: 'error',
        text1: t('auth.error'),
        text2: t('auth.passwordMismatch'),
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    if (password.length < 6) {
      console.log('❌ Validation failed: Password too short');
      Toast.show({
        type: 'error',
        text1: t('auth.error'),
        text2: t('auth.passwordTooShort'),
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('🚀 Calling register function...');

      await register(email.trim().toLowerCase(), password, fullName.trim(), phone.trim());

      console.log('✅ Registration successful!');

      // Başarılı kayıt mesajı (Success message)
      Toast.show({
        type: 'success',
        text1: '🎉 ' + t('auth.registerSuccess'),
        text2: '✅ ' + t('auth.welcome') + ' ' + fullName.split(' ')[0] + '!',
        position: 'top',
        visibilityTime: 4000,
      });

      // Biraz bekle ve modal'ı kapat (Wait a bit and close modal)
      setTimeout(() => {
        console.log('🔙 Navigating back...');
        navigation.goBack();
      }, 1500);

    } catch (error: any) {
      console.error('❌ Register error:', error);

      // Hata mesajını göster (Show error message)
      Toast.show({
        type: 'error',
        text1: '❌ ' + t('auth.registerFailed'),
        text2: error.message || t('auth.error'),
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Kapat butonu (Close button) */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={28} color="#000" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.register')}</Text>
          <Text style={styles.subtitle}>{t('auth.createAccount')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.fullName')}
              placeholderTextColor="#ADB5BD"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.email')}
              placeholderTextColor="#ADB5BD"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.phone')}
              placeholderTextColor="#ADB5BD"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.password')}
              placeholderTextColor="#ADB5BD"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6C757D"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.confirmPassword')}
              placeholderTextColor="#ADB5BD"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6C757D"
              />
            </TouchableOpacity>
          </View>

          {/* Kayıt Ol Butonu (Register Button) */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.registerButtonText}>{t('auth.register')}</Text>
            )}
          </TouchableOpacity>

          {/* Giriş Yap Linki (Login Link) */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>{t('auth.alreadyHaveAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>{t('auth.login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#000000',
  },
  eyeIcon: {
    padding: 8,
  },
  registerButton: {
    backgroundColor: '#E63946',
    borderRadius: 12,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#6C757D',
  },
  loginLink: {
    fontSize: 14,
    color: '#E63946',
    fontWeight: '700',
  },
});

