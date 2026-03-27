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
import { updatePassword } from '../../services/authService';

export default function ResetPasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    setErrorMessage('');

    if (!password || !confirmPassword) {
      setErrorMessage(t('auth.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t('auth.passwordTooShort') || 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('auth.passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      await updatePassword(password);
      setIsSuccess(true);
    } catch (error: any) {
      setErrorMessage(error.message || t('auth.error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#28A745" />
          </View>
          <Text style={styles.successTitle}>{t('auth.passwordUpdated') || 'Password Updated!'}</Text>
          <Text style={styles.successText}>
            {t('auth.passwordUpdatedDesc') || 'Your password has been successfully updated. You can now log in with your new password.'}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="key-outline" size={60} color="#E63946" />
          </View>
          <Text style={styles.title}>{t('auth.setNewPassword') || 'Set New Password'}</Text>
          <Text style={styles.subtitle}>
            {t('auth.setNewPasswordDesc') || 'Enter your new password below'}
          </Text>
        </View>

        <View style={styles.form}>
          {errorMessage !== '' && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#DC3545" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.newPassword') || 'New Password'}
              placeholderTextColor="#ADB5BD"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.confirmPassword') || 'Confirm Password'}
              placeholderTextColor="#ADB5BD"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.resetButtonText}>{t('auth.updatePassword') || 'Update Password'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 80, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#000', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6C757D', textAlign: 'center', paddingHorizontal: 20 },
  form: { width: '100%' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { flex: 1, fontSize: 14, color: '#DC3545', fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#DEE2E6' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 50, fontSize: 16, color: '#000' },
  eyeIcon: { padding: 8 },
  resetButton: { backgroundColor: '#E63946', borderRadius: 12, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  resetButtonDisabled: { opacity: 0.6 },
  resetButtonText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#000', marginBottom: 16 },
  successText: { fontSize: 16, color: '#6C757D', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  loginButton: { backgroundColor: '#E63946', borderRadius: 12, height: 54, width: '100%', alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
});
