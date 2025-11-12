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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg, // md → lg (daha yüksek)
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
    ...Shadows.medium,
    minHeight: 70, // Minimum yükseklik (Minimum height)
  },

  // Hata toast stili (Error toast style)
  errorToast: {
    width: '90%',
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg, // md → lg (daha yüksek)
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#C62828',
    ...Shadows.medium,
    minHeight: 70, // Minimum yükseklik (Minimum height)
  },

  // Bilgi toast stili (Info toast style)
  infoToast: {
    width: '90%',
    backgroundColor: Colors.river,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg, // md → lg (daha yüksek)
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.riverLight,
    ...Shadows.medium,
    minHeight: 70, // Minimum yükseklik (Minimum height)
  },

  // Toast başlık stili (Toast title style)
  toastTitle: {
    fontSize: FontSizes.lg, // md → lg (daha büyük)
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },

  // Toast mesaj stili (Toast message style)
  toastMessage: {
    fontSize: FontSizes.md, // sm → md (daha büyük)
    color: Colors.white,
    opacity: 0.95, // 0.9 → 0.95 (daha belirgin)
  },
});

