import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Colors } from '../constants/theme';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../services/currencyService';
import { getUpsellSuggestions, suggestionToMenuItem, UpsellSuggestion } from '../services/upsellService';

// Sepetin altındaki "Goes well with" şeridi. En fazla 3 kart, tek dokunuşla
// eklenir; eklenen kalem sepette addedVia='upsell' taşır ve raporda sayılır.
// Öneri yoksa (havuz boş, hepsi sepette) hiç görünmez.
export default function UpsellStrip() {
  const { t } = useTranslation();
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const [suggestions, setSuggestions] = useState<UpsellSuggestion[]>([]);

  // Yalnızca sepetteki ürün KÜMESİ değişince yeniden sor; miktar değişimi sormaz.
  const key = useMemo(() => [...new Set(items.map((i) => i.id))].sort().join(','), [items]);

  useEffect(() => {
    let alive = true;
    if (!key) {
      setSuggestions([]);
      return;
    }
    getUpsellSuggestions(key.split(','), 3)
      .then((rows) => { if (alive) setSuggestions(rows); })
      .catch(() => { if (alive) setSuggestions([]); });
    return () => { alive = false; };
  }, [key]);

  if (suggestions.length === 0) return null;

  const add = (s: UpsellSuggestion) => {
    addItem(suggestionToMenuItem(s), undefined, undefined, { addedVia: 'upsell' });
    Toast.show({ type: 'success', text1: t('cart.itemAdded'), text2: s.name, position: 'top', topOffset: 60 });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('cart.goesWellWith')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.hScroll}>
        {suggestions.map((s) => (
          <TouchableOpacity key={s.id} style={styles.card} activeOpacity={0.85} onPress={() => add(s)}>
            {s.image_url ? <Image source={{ uri: s.image_url }} style={styles.image} /> : <View style={[styles.image, styles.imageEmpty]} />}
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={2}>{s.name}</Text>
              <View style={styles.bottom}>
                <Text style={styles.price}>{formatPrice(s.price)}</Text>
                <View style={styles.plus}>
                  <Ionicons name="add" size={16} color="#FFF" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 16 },
  title: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  // flexGrow 0: yatay ScrollView dikeyde sıkışmasın (AdminReports'taki aynı ders).
  hScroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: 10, paddingRight: 4 },
  card: { width: 150, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },
  image: { width: '100%', height: 84 },
  imageEmpty: { backgroundColor: '#F1F3F5' },
  body: { padding: 10 },
  name: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', minHeight: 34 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  price: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  plus: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
