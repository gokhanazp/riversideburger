import React, { useState, useRef, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
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
import { resetPassword, setPasswordRecoveryFlag } from '../../services/authService';
import { supabase } from '../../lib/supabase';

type Step = 'email' | 'code' | 'newPassword' | 'success';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const codeInputs = useRef<(TextInput | null)[]>([]);

  // Ekran her focus olduğunda state'i resetle
  useEffect(() => {
    if (isFocused) {
      setStep('email');
      setCode(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage('');
      setIsLoading(false);
    }
  }, [isFocused]);

  // 1. Email gönder
  const handleSendEmail = async () => {
    if (!email) { setErrorMessage(t('auth.enterEmail')); return; }
    try {
      setIsLoading(true);
      setErrorMessage('');
      await resetPassword(email.trim().toLowerCase());
      setStep('code');
    } catch (error: any) {
      setErrorMessage(error.message || 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Kodu dogrula
  const handleVerifyCode = async () => {
    const otp = code.join('');
    if (otp.length !== 6) { setErrorMessage(t('auth.enterCode')); return; }
    try {
      setIsLoading(true);
      setErrorMessage('');
      setPasswordRecoveryFlag(true);
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'recovery',
      });
      if (error) throw error;
      setStep('newPassword');
    } catch (error: any) {
      setPasswordRecoveryFlag(false);
      if (error.message?.includes('Token has expired')) {
        setErrorMessage('Code has expired. Please request a new one.');
      } else {
        setErrorMessage('Invalid code. Please check and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Sifre guncelle
  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) { setErrorMessage(t('auth.fillAllFields')); return; }
    if (newPassword.length < 6) { setErrorMessage(t('auth.passwordTooShort')); return; }
    if (newPassword !== confirmPassword) { setErrorMessage(t('auth.passwordsDoNotMatch')); return; }
    try {
      setIsLoading(true);
      setErrorMessage('');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordRecoveryFlag(false);
      setStep('success');
    } catch (error: any) {
      setPasswordRecoveryFlag(false);
      setErrorMessage(error.message || 'Error updating password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 5) codeInputs.current[index + 1]?.focus();
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const handleBack = () => {
    setErrorMessage('');
    if (step === 'email') navigation.goBack();
    else if (step === 'code') setStep('email');
    else if (step === 'newPassword') setStep('code');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Back + Steps */}
        {step !== 'success' && (
          <>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, (step === 'email' || step === 'code' || step === 'newPassword') && styles.stepDotActive]} />
              <View style={[styles.stepLine, (step === 'code' || step === 'newPassword') && styles.stepLineActive]} />
              <View style={[styles.stepDot, (step === 'code' || step === 'newPassword') && styles.stepDotActive]} />
              <View style={[styles.stepLine, step === 'newPassword' && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 'newPassword' && styles.stepDotActive]} />
            </View>
          </>
        )}

        {/* STEP 1: Email */}
        {step === 'email' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-outline" size={48} color="#E63946" />
            </View>
            <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.forgotPasswordSubtitle')}</Text>

            {errorMessage !== '' && <ErrorBox message={errorMessage} />}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#6C757D" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                placeholderTextColor="#ADB5BD"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrorMessage(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, isLoading && styles.btnDisabled]} onPress={handleSendEmail} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{t('auth.sendButton')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
              <Ionicons name="arrow-back" size={16} color="#E63946" />
              <Text style={styles.linkText}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Code */}
        {step === 'code' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="keypad-outline" size={48} color="#E63946" />
            </View>
            <Text style={styles.title}>{t('auth.enterVerificationCode')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.codeSentTo')}{'\n'}
              <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>{email}</Text>
            </Text>

            {errorMessage !== '' && <ErrorBox message={errorMessage} />}

            <View style={styles.codeRow}>
              {code.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { codeInputs.current[i] = ref; }}
                  style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, i)}
                  onKeyPress={(e) => handleCodeKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, isLoading && styles.btnDisabled]} onPress={handleVerifyCode} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{t('auth.verifyCode')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('email'); setCode(['', '', '', '', '', '']); setErrorMessage(''); }} style={styles.linkRow}>
              <Text style={styles.linkText}>{t('auth.resendEmail')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: New Password */}
        {step === 'newPassword' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={48} color="#E63946" />
            </View>
            <Text style={styles.title}>{t('auth.setNewPassword')}</Text>
            <Text style={styles.subtitle}>{t('auth.setNewPasswordDesc')}</Text>

            {errorMessage !== '' && <ErrorBox message={errorMessage} />}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6C757D" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.newPassword')}
                placeholderTextColor="#ADB5BD"
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setErrorMessage(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6C757D" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6C757D" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.confirmPassword')}
                placeholderTextColor="#ADB5BD"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrorMessage(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, isLoading && styles.btnDisabled]} onPress={handleUpdatePassword} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{t('auth.updatePassword')}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Success */}
        {step === 'success' && (
          <View style={[styles.stepContainer, { marginTop: 80 }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9', width: 120, height: 120, borderRadius: 60 }]}>
              <Ionicons name="checkmark-circle" size={64} color="#28A745" />
            </View>
            <Text style={styles.title}>{t('auth.passwordUpdated')}</Text>
            <Text style={styles.subtitle}>{t('auth.passwordUpdatedDesc')}</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => {
              supabase.auth.signOut().then(() => {
                navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'Login' }] });
              });
            }}>
              <Text style={styles.primaryBtnText}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ErrorBox = ({ message }: { message: string }) => (
  <View style={styles.errorBox}>
    <Ionicons name="alert-circle" size={18} color="#DC3545" />
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E0E0E0' },
  stepDotActive: { backgroundColor: '#E63946', width: 12, height: 12, borderRadius: 6 },
  stepLine: { width: 40, height: 2, backgroundColor: '#E0E0E0', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#E63946' },
  stepContainer: { alignItems: 'center' },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 28, lineHeight: 22, paddingHorizontal: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: '#FECACA', width: '100%' },
  errorText: { flex: 1, fontSize: 14, color: '#DC3545', fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 14, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E8E8E8', width: '100%' },
  input: { flex: 1, height: 52, fontSize: 16, color: '#1A1A1A' },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 24, justifyContent: 'center' },
  codeInput: { width: 46, height: 54, borderRadius: 14, backgroundColor: '#F5F5F7', borderWidth: 1.5, borderColor: '#E0E0E0', textAlign: 'center', fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  codeInputFilled: { borderColor: '#E63946', backgroundColor: '#FEF2F2' },
  primaryBtn: { backgroundColor: '#1A1A1A', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 20 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  linkText: { fontSize: 14, color: '#E63946', fontWeight: '600' },
});
