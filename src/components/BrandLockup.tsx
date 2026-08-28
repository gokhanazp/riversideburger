// Marka kilidi — web sitesindeki (riverside-web) düzenin uygulama karşılığı.
//
// Uygulamada dört ayrı yerde marka gösteriliyordu ve hiçbirinde GERÇEK logo
// yoktu: başlıkta `Ionicons name="restaurant"` (jenerik çatal-kaşık), giriş
// ekranında `fast-food`, anasayfada "Riverside Burgers 🍔" emojisi, profilde
// yalnız metin. Dördü de artık aynı bileşeni kullanıyor, yani marka tek yerden
// değişiyor.
//
// Dizilim sitedekiyle birebir: logo dairesi + tek satır isim (BURGERS marka
// kırmızısında) + kısa kırmızı çizgi ve künye satırı. İsim iki satıra
// bölünmüyor — sitede öyle denenmişti ve hiyerarşisi olmadığı için dairenin
// içindeki yazıyla yarışıyordu.

import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../constants/theme';

const LOGO = require('../../assets/logo-mark.png');

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { logo: number; name: number; tagline: number; rule: number; gap: number }> = {
  sm: { logo: 40, name: 14, tagline: 8, rule: 14, gap: 10 },
  md: { logo: 52, name: 17, tagline: 9, rule: 18, gap: 12 },
  lg: { logo: 96, name: 22, tagline: 11, rule: 24, gap: 14 },
};

interface Props {
  size?: Size;
  /** 'dark' = koyu zemin üstünde (beyaz metin) */
  variant?: 'light' | 'dark';
  /** Künye satırı ("TORONTO · EST. 2019") gösterilsin mi */
  showTagline?: boolean;
  /** Logo üstte, metin altta ve ortalanmış — giriş/kayıt ekranları için */
  stacked?: boolean;
  style?: ViewStyle;
}

export default function BrandLockup({
  size = 'md',
  variant = 'light',
  showTagline = true,
  stacked = false,
  style,
}: Props) {
  const s = SIZES[size];
  const nameColor = variant === 'dark' ? Colors.white : Colors.text;
  const taglineColor = variant === 'dark' ? 'rgba(255,255,255,0.55)' : Colors.textSecondary;

  return (
    <View
      style={[
        stacked ? styles.stacked : styles.row,
        !stacked && { gap: s.gap },
        style,
      ]}
    >
      <Image
        source={LOGO}
        style={{ width: s.logo, height: s.logo }}
        resizeMode="contain"
        // Logo metnin görsel karşılığı; ekran okuyucu için isim zaten yanında.
        accessible={false}
      />

      <View style={stacked ? styles.stackedText : undefined}>
        <Text
          style={[styles.name, { fontSize: s.name, color: nameColor }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          RIVERSIDE<Text style={{ color: Colors.primary }}> BURGERS</Text>
        </Text>

        {showTagline && (
          <View style={[styles.taglineRow, stacked && styles.taglineRowCentered]}>
            <View style={[styles.rule, { width: s.rule }]} />
            <Text
              style={[styles.tagline, { fontSize: s.tagline, color: taglineColor }]}
              allowFontScaling={false}
            >
              TORONTO · EST. 2019
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stacked: { alignItems: 'center' },
  stackedText: { alignItems: 'center', marginTop: 12 },
  name: {
    fontWeight: '900',
    // Sıkı harf aralığı sitedeki görünümü veriyor. Android'de negatif
    // letterSpacing bazı yazı tiplerinde harfleri kırpıyor, o yüzden ölçülü.
    letterSpacing: -0.3,
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6 },
  taglineRowCentered: { justifyContent: 'center' },
  rule: { height: 1.5, backgroundColor: Colors.primary, borderRadius: 1 },
  tagline: { fontWeight: '700', letterSpacing: 1.6 },
});
