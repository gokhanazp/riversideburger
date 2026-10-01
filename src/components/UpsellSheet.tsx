import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../services/currencyService';
import { suggestionToMenuItem, UpsellSuggestion } from '../services/upsellService';

// Ürün sepete eklendikten SONRA açılan "Goes well with" paneli (Uber Eats
// deseni): öneriler alt alta, artı ile eklenir, "Hayır, teşekkürler" kapatır.
// Öneri listesi ekran açılırken önceden çekiliyor; boşsa panel hiç açılmaz.
export default function UpsellSheet({
  visible,
  suggestions,
  onClose,
  onGoToCart,
}: {
  visible: boolean;
  suggestions: UpsellSuggestion[];
  onClose: () => void;
  onGoToCart: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);

  // "✓ n" yerel durumdan DEĞİL sepetten okunuyor: panel kök seviyede tek
  // örnek olduğu için yerel sayaç bir sonraki açılışa taşınıyordu — sepetten
  // silinen ürün bile tikli görünüyordu.
  const inCart = (id: string) => items.filter((i) => i.id === id).reduce((sum, i) => sum + i.quantity, 0);

  const add = (s: UpsellSuggestion) => {
    addItem(suggestionToMenuItem(s), undefined, undefined, { addedVia: 'upsell' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.addedPill}>
              <Ionicons name="checkmark-circle" size={14} color="#1E7F3A" />
              <Text style={styles.addedPillText}>{t('cart.addedToCart')}</Text>
            </View>
            <Text style={styles.title}>{t('cart.goesWellWith')}</Text>
            <Text style={styles.subtitle}>{t('cart.upsellSubtitle')}</Text>
          </View>

          <ScrollView style={styles.list} bounces={false}>
            {suggestions.map((s) => {
              const n = inCart(s.id);
              return (
                <View key={s.id} style={styles.row}>
                  {s.image_url ? <Image source={{ uri: s.image_url }} style={styles.image} /> : <View style={[styles.image, styles.imageEmpty]} />}
                  <View style={styles.rowBody}>
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.price}>{formatPrice(s.price)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => add(s)} style={[styles.plus, n > 0 && styles.plusDone]} activeOpacity={0.85}>
                    {n > 0 ? <Text style={styles.plusCount}>✓ {n}</Text> : <Ionicons name="add" size={20} color="#FFF" />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>{t('cart.noThanks')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={onGoToCart} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{t('cart.goToCart')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', marginBottom: 12 },
  header: { paddingHorizontal: 20 },
  addedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#EAF7EE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  addedPillText: { fontSize: 12, fontWeight: '800', color: '#1E7F3A' },
  title: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  list: { marginTop: 10, paddingHorizontal: 20, flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F1F1' },
  image: { width: 56, height: 56, borderRadius: 14 },
  imageEmpty: { backgroundColor: '#F1F3F5' },
  rowBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  price: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginTop: 2 },
  plus: { minWidth: 40, height: 40, borderRadius: 20, paddingHorizontal: 10, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  plusDone: { backgroundColor: '#28A745' },
  plusCount: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
