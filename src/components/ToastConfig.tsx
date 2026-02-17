import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';

// Toast konfigürasyonu (Toast configuration)
// Riverside Burgers temasına uygun özel toast tasarımı
export const toastConfig = {
  // Başarı toast'u (Success toast)
  success: ({ text1, text2 }: any) => (
    <View style={styles.successToast}>
      <Text style={styles.toastTitle}>{text1}</Text>
      {text2 && <Text style={styles.toastMessage}>{text2}</Text>}
    </View>
  ),
  
  // Hata toast'u (Error toast)
  error: ({ text1, text2 }: any) => (
    <View style={styles.errorToast}>
      <Text style={styles.toastTitle}>{text1}</Text>
      {text2 && <Text style={styles.toastMessage}>{text2}</Text>}
    </View>
  ),
  
  // Bilgi toast'u (Info toast)
  info: ({ text1, text2 }: any) => (
    <View style={styles.infoToast}>
      <Text style={styles.toastTitle}>{text1}</Text>
      {text2 && <Text style={styles.toastMessage}>{text2}</Text>}
    </View>
  ),
};

const styles = StyleSheet.create({
  // Başarı toast stili (Success toast style)
  successToast: {
    width: '90%',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 6,
    borderLeftColor: '#1E7E34',
    ...Shadows.large,
    elevation: 10,
    zIndex: 9999,
    minHeight: 70,
  },

  // Hata toast stili (Error toast style)
  errorToast: {
    width: '90%',
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 6,
    borderLeftColor: '#C62828',
    ...Shadows.large,
    elevation: 10,
    zIndex: 9999,
    minHeight: 70,
  },

  // Bilgi toast stili (Info toast style)
  infoToast: {
    width: '90%',
    backgroundColor: Colors.info,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 6,
    borderLeftColor: '#117A8B',
    ...Shadows.large,
    elevation: 10,
    zIndex: 9999,
    minHeight: 70,
  },

  // Toast başlık stili (Toast title style)
  toastTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },

  // Toast mesaj stili (Toast message style)
  toastMessage: {
    fontSize: FontSizes.md,
    color: '#FFFFFF',
    opacity: 1,
    fontWeight: '500',
  },
});

