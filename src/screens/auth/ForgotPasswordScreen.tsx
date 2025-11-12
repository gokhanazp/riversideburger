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
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../../services/authService';
import Toast from 'react-native-toast-message';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Şifre sıfırlama emaili gönder (Send password reset email)
  const handleResetPassword = async () => {
    // Validasyon (Validation)
    if (!email) {
      Toast.show({
        type: 'error',
        text1: t('auth.error'),
        text2: t('auth.enterEmail'),
      });
      return;
    }

    try {
      setIsLoading(true);
      await resetPassword(email.trim().toLowerCase());

      setEmailSent(true);
      Toast.show({
        type: 'success',
        text1: t('auth.emailSent'),
        text2: t('auth.emailSentMessage'),
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      Toast.show({
        type: 'error',
        text1: t('auth.error'),
        text2: error.message || t('errors.unknownError'),
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={60} color="#E63946" />
          </View>

          <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
          <Text style={styles.subtitle}>
            {emailSent
              ? t('auth.forgotPasswordSubtitleSent')
              : t('auth.forgotPasswordSubtitle')}
          </Text>
        </View>

        {/* Form */}
        {!emailSent ? (
          <View style={styles.form}>
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

            {/* Gönder Butonu (Send Button) */}
            <TouchableOpacity
              style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendButtonText}>{t('auth.sendButton')}</Text>
              )}
            </TouchableOpacity>

            {/* Geri Dön Linki (Back to Login Link) */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.backToLogin}
            >
              <Ionicons name="arrow-back" size={16} color="#E63946" />
              <Text style={styles.backToLoginText}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color="#28A745" />
            </View>

            <Text style={styles.successTitle}>{t('auth.emailSentTitle')}</Text>
            <Text style={styles.successText}>
              {email} {t('auth.emailSentText')}
            </Text>

            <TouchableOpacity
              style={styles.backButton2}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.backButton2Text}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEmailSent(false)}
              style={styles.resendLink}
            >
              <Text style={styles.resendLinkText}>{t('auth.resendEmail')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    paddingHorizontal: 20,
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
    marginBottom: 24,
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
  sendButton: {
    backgroundColor: '#E63946',
    borderRadius: 12,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backToLoginText: {
    fontSize: 14,
    color: '#E63946',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  backButton2: {
    backgroundColor: '#E63946',
    borderRadius: 12,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  backButton2Text: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendLink: {
    padding: 12,
  },
  resendLinkText: {
    fontSize: 14,
    color: '#E63946',
    fontWeight: '600',
  },
});

