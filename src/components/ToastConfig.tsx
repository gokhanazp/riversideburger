import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const CONFIGS = {
  success: { icon: 'checkmark-circle' as const, accent: '#16A34A', bg: '#F0FDF4', border: '#16A34A' },
  error:   { icon: 'close-circle' as const,     accent: '#DC2626', bg: '#FEF2F2', border: '#DC2626' },
  info:    { icon: 'information-circle' as const, accent: '#2563EB', bg: '#EFF6FF', border: '#2563EB' },
};

const ToastBase = ({ text1, text2, type }: { text1?: string; text2?: string; type: keyof typeof CONFIGS }) => {
  const { icon, accent, bg, border } = CONFIGS[type];
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => Toast.hide()}
      style={[styles.container, { backgroundColor: bg, borderLeftColor: border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <View style={styles.textWrap}>
        {text1 ? <Text style={[styles.title, { color: accent }]} numberOfLines={1}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message} numberOfLines={2}>{text2}</Text> : null}
      </View>
      <Ionicons name="close" size={18} color="#CCC" style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
};

export const toastConfig = {
  success: (props: any) => <ToastBase text1={props.text1} text2={props.text2} type="success" />,
  error:   (props: any) => <ToastBase text1={props.text1} text2={props.text2} type="error" />,
  info:    (props: any) => <ToastBase text1={props.text1} text2={props.text2} type="info" />,
};

const styles = StyleSheet.create({
  container: {
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    gap: 12,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    lineHeight: 18,
  },
});
