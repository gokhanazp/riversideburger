import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Colors, Shadows } from '../../constants/theme';
import ConfirmModal from '../../components/ConfirmModal';
import { Campaign, CampaignType, CampaignTargetType, Category, Product } from '../../types/database.types';
import {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../../services/campaignService';
import { getCategories, getProducts } from '../../services/productService';

const TYPES: CampaignType[] = ['first_order', 'percentage', 'buy_x_get_y'];
const TARGETS: CampaignTargetType[] = ['all', 'category', 'product'];

interface FormState {
  name_tr: string;
  name_en: string;
  type: CampaignType;
  discount_percent: string;
  buy_quantity: string;
  free_quantity: string;
  target_type: CampaignTargetType;
  target_category_ids: string[];
  target_product_ids: string[];
  min_order_amount: string;
  validity_days: string; // boş = süresiz
  per_customer_limit: string; // boş = sınırsız
  is_active: boolean;
}

const emptyForm: FormState = {
  name_tr: '',
  name_en: '',
  type: 'first_order',
  discount_percent: '50',
  buy_quantity: '1',
  free_quantity: '1',
  target_type: 'all',
  target_category_ids: [],
  target_product_ids: [],
  min_order_amount: '0',
  validity_days: '',
  per_customer_limit: '',
  is_active: true,
};

const AdminCampaigns = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const isTr = i18n.language === 'tr';

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [c, cats, prods] = await Promise.all([getAllCampaigns(), getCategories(), getProducts()]);
      setCampaigns(c);
      setCategories(cats);
      setProducts(prods);
    } catch (e) {
      Toast.show({ type: 'error', text1: t('admin.campaigns.error') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const typeLabel = (type: CampaignType) =>
    type === 'first_order' ? t('admin.campaigns.typeFirstOrder')
    : type === 'percentage' ? t('admin.campaigns.typePercentage')
    : t('admin.campaigns.typeBuyXGetY');

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      name_tr: c.name_tr,
      name_en: c.name_en,
      type: c.type,
      discount_percent: String(c.discount_percent ?? 0),
      buy_quantity: String(c.buy_quantity ?? 1),
      free_quantity: String(c.free_quantity ?? 1),
      target_type: c.target_type,
      target_category_ids: c.target_category_ids || [],
      target_product_ids: c.target_product_ids || [],
      min_order_amount: String(c.min_order_amount ?? 0),
      validity_days: '',
      per_customer_limit: c.per_customer_limit != null ? String(c.per_customer_limit) : '',
      is_active: c.is_active,
    });
    setShowModal(true);
  };

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const validate = (): string | null => {
    if (!form.name_tr.trim() || !form.name_en.trim()) return t('admin.campaigns.required');
    if (form.type === 'first_order' || form.type === 'percentage') {
      const p = parseFloat(form.discount_percent);
      if (!Number.isFinite(p) || p <= 0 || p > 100) return t('admin.campaigns.invalidPercent');
    }
    if (form.type === 'buy_x_get_y') {
      const b = parseInt(form.buy_quantity, 10);
      const f = parseInt(form.free_quantity, 10);
      if (!Number.isFinite(b) || b < 1 || !Number.isFinite(f) || f < 1) return t('admin.campaigns.invalidBuyGet');
    }
    if (form.type !== 'first_order') {
      if (form.target_type === 'category' && form.target_category_ids.length === 0) return t('admin.campaigns.selectAtLeastOne');
      if (form.target_type === 'product' && form.target_product_ids.length === 0) return t('admin.campaigns.selectAtLeastOne');
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Toast.show({ type: 'error', text1: err });
      return;
    }
    setSaving(true);
    try {
      // first_order her zaman tüm sepete uygulanır
      const targetType: CampaignTargetType = form.type === 'first_order' ? 'all' : form.target_type;
      const now = Date.now();
      const days = parseInt(form.validity_days, 10);
      const hasValidity = Number.isFinite(days) && days > 0;

      const payload: Partial<Campaign> = {
        name_tr: form.name_tr.trim(),
        name_en: form.name_en.trim(),
        type: form.type,
        discount_percent:
          form.type === 'buy_x_get_y' ? 0 : parseFloat(form.discount_percent) || 0,
        buy_quantity: form.type === 'buy_x_get_y' ? parseInt(form.buy_quantity, 10) || 1 : 1,
        free_quantity: form.type === 'buy_x_get_y' ? parseInt(form.free_quantity, 10) || 1 : 1,
        target_type: targetType,
        target_category_ids: targetType === 'category' ? form.target_category_ids : [],
        target_product_ids: targetType === 'product' ? form.target_product_ids : [],
        min_order_amount: parseFloat(form.min_order_amount) || 0,
        per_customer_limit: form.per_customer_limit.trim() ? parseInt(form.per_customer_limit, 10) : null,
        is_active: form.is_active,
      };

      // Geçerlilik günü girildiyse tarih aralığını ayarla (yeni kayıt veya yeniden ayarlama)
      if (hasValidity) {
        payload.starts_at = new Date(now).toISOString();
        payload.ends_at = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
      } else if (!editing) {
        payload.starts_at = null;
        payload.ends_at = null;
      }

      if (editing) {
        await updateCampaign(editing.id, payload);
        Toast.show({ type: 'success', text1: t('admin.campaigns.saved') });
      } else {
        await createCampaign(payload);
        Toast.show({ type: 'success', text1: t('admin.campaigns.saved') });
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('admin.campaigns.error'), text2: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: Campaign) => {
    try {
      await updateCampaign(c.id, { is_active: !c.is_active });
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !c.is_active } : x)));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('admin.campaigns.error') });
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteCampaign(toDelete.id);
      setShowDelete(false);
      setToDelete(null);
      fetchData();
      Toast.show({ type: 'success', text1: t('admin.campaigns.deleted') });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('admin.campaigns.error') });
    }
  };

  const summaryText = (c: Campaign): string => {
    if (c.type === 'buy_x_get_y') return `${c.buy_quantity} + ${c.free_quantity} 🎁`;
    return `%${c.discount_percent}`;
  };

  const catName = (cat: Category) => (isTr ? cat.name_tr : cat.name_en) || cat.name;

  const renderItem = ({ item, index }: { item: Campaign; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40)} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{isTr ? item.name_tr : item.name_en}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeLabel(item.type)}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: Colors.primary + '15' }]}>
              <Text style={[styles.typeBadgeText, { color: Colors.primary }]}>{summaryText(item)}</Text>
            </View>
          </View>
        </View>
        <Switch value={item.is_active} onValueChange={() => handleToggleActive(item)} trackColor={{ true: Colors.primary }} />
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Ionicons name="create-outline" size={16} color={Colors.text} />
          <Text style={styles.editBtnText}>{t('admin.campaigns.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.delBtn} onPress={() => { setToDelete(item); setShowDelete(true); }}>
          <Ionicons name="trash-outline" size={16} color="#DC3545" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.headerArea}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.campaigns.title')}</Text>
          <TouchableOpacity onPress={openCreate} style={styles.iconBtn}>
            <Ionicons name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : campaigns.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pricetags-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{t('admin.campaigns.empty')}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
            <Text style={styles.emptyBtnText}>{t('admin.campaigns.add')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? t('admin.campaigns.edit') : t('admin.campaigns.add')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* İsim */}
              <Text style={styles.label}>{t('admin.campaigns.nameTr')}</Text>
              <TextInput style={styles.input} value={form.name_tr} onChangeText={(v) => setForm({ ...form, name_tr: v })} placeholder="1 Alana 1 Bedava" placeholderTextColor="#B0B0B0" />
              <Text style={styles.label}>{t('admin.campaigns.nameEn')}</Text>
              <TextInput style={styles.input} value={form.name_en} onChangeText={(v) => setForm({ ...form, name_en: v })} placeholder="Buy 1 Get 1 Free" placeholderTextColor="#B0B0B0" />

              {/* Tip */}
              <Text style={styles.label}>{t('admin.campaigns.type')}</Text>
              <View style={styles.chipRow}>
                {TYPES.map((tp) => (
                  <Chip key={tp} active={form.type === tp} label={typeLabel(tp)} onPress={() => setForm({ ...form, type: tp })} />
                ))}
              </View>

              {/* Tipe göre parametreler */}
              {(form.type === 'first_order' || form.type === 'percentage') && (
                <>
                  <Text style={styles.label}>{t('admin.campaigns.percent')}</Text>
                  <TextInput style={styles.input} value={form.discount_percent} onChangeText={(v) => setForm({ ...form, discount_percent: v })} keyboardType="decimal-pad" placeholder="50" placeholderTextColor="#B0B0B0" />
                </>
              )}
              {form.type === 'buy_x_get_y' && (
                <>
                  <View style={styles.rowGap}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t('admin.campaigns.buyQty')}</Text>
                      <TextInput style={styles.input} value={form.buy_quantity} onChangeText={(v) => setForm({ ...form, buy_quantity: v })} keyboardType="number-pad" placeholder="1" placeholderTextColor="#B0B0B0" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t('admin.campaigns.freeQty')}</Text>
                      <TextInput style={styles.input} value={form.free_quantity} onChangeText={(v) => setForm({ ...form, free_quantity: v })} keyboardType="number-pad" placeholder="1" placeholderTextColor="#B0B0B0" />
                    </View>
                  </View>
                  <Text style={styles.hint}>{t('admin.campaigns.buyGetHint')}</Text>
                </>
              )}

              {/* Hedefleme (first_order hariç) */}
              {form.type !== 'first_order' && (
                <>
                  <Text style={styles.label}>{t('admin.campaigns.target')}</Text>
                  <View style={styles.chipRow}>
                    <Chip active={form.target_type === 'all'} label={t('admin.campaigns.targetAll')} onPress={() => setForm({ ...form, target_type: 'all' })} />
                    <Chip active={form.target_type === 'category'} label={t('admin.campaigns.targetCategory')} onPress={() => setForm({ ...form, target_type: 'category' })} />
                    <Chip active={form.target_type === 'product'} label={t('admin.campaigns.targetProduct')} onPress={() => setForm({ ...form, target_type: 'product' })} />
                  </View>

                  {form.target_type === 'category' && (
                    <>
                      <Text style={styles.hint}>{t('admin.campaigns.selectCategories')}</Text>
                      <View style={styles.chipWrap}>
                        {categories.map((cat) => (
                          <Chip key={cat.id} active={form.target_category_ids.includes(cat.id)} label={catName(cat)} onPress={() => setForm({ ...form, target_category_ids: toggleId(form.target_category_ids, cat.id) })} />
                        ))}
                      </View>
                    </>
                  )}
                  {form.target_type === 'product' && (
                    <>
                      <Text style={styles.hint}>{t('admin.campaigns.selectProducts')}</Text>
                      <View style={styles.chipWrap}>
                        {products.map((p) => (
                          <Chip key={p.id} active={form.target_product_ids.includes(p.id)} label={p.name} onPress={() => setForm({ ...form, target_product_ids: toggleId(form.target_product_ids, p.id) })} />
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Koşullar */}
              <Text style={styles.label}>{t('admin.campaigns.minOrder')}</Text>
              <TextInput style={styles.input} value={form.min_order_amount} onChangeText={(v) => setForm({ ...form, min_order_amount: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B0B0B0" />

              <Text style={styles.label}>{t('admin.campaigns.validityDays')}</Text>
              <TextInput style={styles.input} value={form.validity_days} onChangeText={(v) => setForm({ ...form, validity_days: v })} keyboardType="number-pad" placeholder={t('admin.campaigns.validityHint')} placeholderTextColor="#B0B0B0" />

              <Text style={styles.label}>{t('admin.campaigns.perCustomerLimit')}</Text>
              <TextInput style={styles.input} value={form.per_customer_limit} onChangeText={(v) => setForm({ ...form, per_customer_limit: v })} keyboardType="number-pad" placeholder={t('admin.campaigns.perCustomerHint')} placeholderTextColor="#B0B0B0" />

              <View style={styles.switchRow}>
                <Text style={styles.label}>{t('admin.campaigns.active')}</Text>
                <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ true: Colors.primary }} />
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{t('admin.campaigns.save')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={showDelete}
        title={t('admin.campaigns.delete')}
        message={t('admin.campaigns.deleteConfirm')}
        confirmText={t('admin.campaigns.delete')}
        cancelText={t('admin.campaigns.cancel')}
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setToDelete(null); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  headerArea: {
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 50) + 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { marginTop: 12, color: Colors.textSecondary, fontSize: 15 },
  emptyBtn: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, ...Shadows.small },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  typeBadge: { backgroundColor: '#EEF0F3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F4F5F7', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  delBtn: { backgroundColor: '#FDECEC', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 14, marginBottom: 6 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 4, marginBottom: 4 },
  input: { backgroundColor: '#F4F5F7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: '#EDEEF2' },
  rowGap: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F4F5F7', borderWidth: 1.5, borderColor: '#E6E6E6' },
  chipActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

export default AdminCampaigns;
