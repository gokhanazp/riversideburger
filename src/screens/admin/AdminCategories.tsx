import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
  Dimensions,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { MenuCategory } from '../../types';
import Toast from 'react-native-toast-message';
import IconPicker from '../../components/IconPicker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import ConfirmModal from '../../components/ConfirmModal';

const { width } = Dimensions.get('window');

const AdminCategories = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name_tr: '',
    name_en: '',
    icon: 'fast-food-outline',
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const getCategoryName = (category: MenuCategory): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.categories.errorLoading'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setFormData({
      name_tr: '',
      name_en: '',
      icon: 'fast-food-outline',
      display_order: categories.length + 1,
      is_active: true,
    });
    setShowForm(true);
  };

  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setFormData({
      name_tr: category.name_tr,
      name_en: category.name_en,
      icon: category.icon,
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setShowForm(true);
  };

  const handleSaveCategory = async () => {
    const currentLanguageField = i18n.language === 'tr' ? formData.name_tr : formData.name_en;
    if (!currentLanguageField.trim()) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: t('admin.categories.fillAllFields'),
      });
      return;
    }

    if (i18n.language === 'tr' && !formData.name_en.trim()) formData.name_en = formData.name_tr;
    else if (i18n.language === 'en' && !formData.name_tr.trim()) formData.name_tr = formData.name_en;

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('menu_categories')
          .update({
            name_tr: formData.name_tr,
            name_en: formData.name_en,
            icon: formData.icon,
            display_order: formData.display_order,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.categories.success'), text2: t('admin.categories.categoryUpdated') });
      } else {
        const { error } = await supabase.from('menu_categories').insert([formData]);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.categories.success'), text2: t('admin.categories.categoryAdded') });
      }

      setShowForm(false);
      loadCategories();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.categories.errorSaving') });
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', selectedCategory.id);
      if (error) throw error;
      Toast.show({ type: 'success', text1: t('admin.categories.success'), text2: t('admin.categories.categoryDeleted') });
      setShowDeleteModal(false);
      loadCategories();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.categories.errorDeleting') });
    }
  };

  const handleToggleActive = async (category: MenuCategory) => {
    try {
      const { error } = await supabase
        .from('menu_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;
      loadCategories();
      Toast.show({
        type: 'success',
        text1: t('admin.categories.success'),
        text2: !category.is_active ? t('admin.categories.categoryActivated') : t('admin.categories.categoryDeactivated'),
      });
    } catch {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.categories.errorToggling') });
    }
  };

  const formContent = (
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          {i18n.language === 'tr' ? (
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.categories.name')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name_tr}
                  onChangeText={(text) => setFormData({ ...formData, name_tr: text })}
                  placeholder={t('admin.categories.namePlaceholder')}
                />
            </View>
          ) : (
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('admin.categories.nameEn')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name_en}
                  onChangeText={(text) => setFormData({ ...formData, name_en: text })}
                  placeholder={t('admin.categories.nameEnPlaceholder')}
                />
            </View>
          )}

          <View style={styles.inputGroup}>
             <Text style={styles.inputLabel}>{t('admin.categories.icon')}</Text>
             <IconPicker
                selectedIcon={formData.icon}
                onSelectIcon={(icon) => setFormData({ ...formData, icon })}
             />
          </View>

          <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('admin.categories.displayOrder')}</Text>
              <TextInput
                style={styles.input}
                value={formData.display_order.toString()}
                onChangeText={(text) => setFormData({ ...formData, display_order: parseInt(text) || 0 })}
                keyboardType="numeric"
                placeholder="1"
              />
          </View>

          <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('admin.categories.categoryActivated')}</Text>
              <Switch 
                value={formData.is_active}
                onValueChange={v => setFormData({...formData, is_active: v})}
                trackColor={{ false: '#eee', true: Colors.success + '40' }}
                thumbColor={formData.is_active ? Colors.success : '#999'}
              />
          </View>

          <View style={{height: 100}} />
      </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>Menu</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.categories.title')}</Text>
        </View>

        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('admin.categories.title')}</Text>
            <TouchableOpacity onPress={handleAddCategory} style={styles.addBtn}>
                <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{paddingBottom: 100}}>
          {categories.length === 0 ? (
            <View style={styles.emptyView}>
              <Ionicons name="albums-outline" size={64} color="#DDD" />
              <Text style={styles.emptyText}>{t('admin.categories.noCategories')}</Text>
            </View>
          ) : (
            categories.map((category, index) => (
              <Animated.View 
                key={category.id} 
                entering={FadeInDown.delay(index * 50).springify()}
                layout={Layout.springify()}
                style={styles.card}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.iconBox, !category.is_active && styles.iconBoxInactive]}>
                    <Ionicons name={category.icon as any} size={24} color={category.is_active ? Colors.primary : '#999'} />
                  </View>
                  <View>
                    <Text style={[styles.catName, !category.is_active && styles.textInactive]}>{getCategoryName(category)}</Text>
                    <Text style={styles.catOrder}>#{category.display_order}</Text>
                  </View>
                </View>
                
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleToggleActive(category)} style={styles.actionBtn}>
                    <Ionicons name={category.is_active ? 'eye' : 'eye-off'} size={20} color={category.is_active ? Colors.success : '#999'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleEditCategory(category)} style={[styles.actionBtn, {backgroundColor: '#E3F2FD'}]}>
                    <Ionicons name="create-outline" size={20} color="#1976D2" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSelectedCategory(category); setShowDeleteModal(true); }} style={[styles.actionBtn, {backgroundColor: '#FFEBEE'}]}>
                    <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingCategory ? t('admin.categories.editCategory') : t('admin.categories.addCategory')}</Text>
                  <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeModalBtn}>
                      <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
              </View>
              {formContent}
              <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
                      <Text style={styles.saveBtnText}>{t('admin.categories.save')}</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      <ConfirmModal
        visible={showDeleteModal}
        title={t('admin.categories.deleteCategory')}
        message={t('admin.categories.deleteConfirm')}
        confirmText={t('admin.categories.delete')}
        cancelText={t('admin.categories.cancel')}
        onConfirm={handleDeleteCategory}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingTop: 50, paddingBottom: 24, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...Shadows.medium },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, opacity: 0.8 },
  breadText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  breadActive: { color: Colors.white, opacity: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  emptyView: { alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: '#CCC', fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 16, ...Shadows.small },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  iconBoxInactive: { backgroundColor: '#F5F5F5' },
  catName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  textInactive: { color: '#999', textDecorationLine: 'line-through' },
  catOrder: { fontSize: 12, color: '#999', fontWeight: '600', backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  
  modalContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.text },
  closeModalBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  formScroll: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 16, padding: 16, fontSize: 16, color: Colors.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#EEE' },
  switchLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalFooter: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' },
  saveBtn: { backgroundColor: Colors.primary, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});

export default AdminCategories;

