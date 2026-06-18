import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ProductOptionCategory, ProductOption } from '../../types/customization';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import ConfirmModal from '../../components/ConfirmModal';
import { getCurrencyInfo } from '../../services/currencyService';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 768;

const AdminProductOptions = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ProductOptionCategory[]>([]);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductOptionCategory | null>(null);

  // Modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductOptionCategory | null>(null);
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'category' | 'option', item: any} | null>(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    name_en: '',
    description: '',
    display_order: '0',
  });

  const [optionForm, setOptionForm] = useState({
    name: '',
    name_en: '',
    description: '',
    price: '',
    display_order: '0',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadOptions(selectedCategory.id);
    } else {
      setOptions([]);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_option_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      
      if (data && data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0]);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.errorLoadingCategories') });
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.errorLoadingOptions') });
    }
  };

  const openCategoryModal = (category?: ProductOptionCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        name_en: category.name_en || '',
        description: category.description || '',
        display_order: category.display_order.toString(),
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', name_en: '', description: '', display_order: (categories.length + 1).toString() });
    }
    setCategoryModalVisible(true);
  };

  const openOptionModal = (option?: ProductOption) => {
    if (!selectedCategory) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.selectCategoryFirst') });
      return;
    }

    if (option) {
      setEditingOption(option);
      setOptionForm({
        name: option.name,
        name_en: option.name_en || '',
        description: option.description || '',
        price: option.price.toString(),
        display_order: option.display_order.toString(),
      });
    } else {
      setEditingOption(null);
      setOptionForm({ name: '', name_en: '', description: '', price: '0', display_order: (options.length + 1).toString() });
    }
    setOptionModalVisible(true);
  };

  const handleSaveCategory = async () => {
    const currentLanguageField = i18n.language === 'tr' ? categoryForm.name : categoryForm.name_en;
    if (!currentLanguageField.trim()) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.categoryNameRequired') });
      return;
    }

    if (i18n.language === 'tr' && !categoryForm.name_en.trim()) categoryForm.name_en = categoryForm.name;
    else if (i18n.language === 'en' && !categoryForm.name.trim()) categoryForm.name = categoryForm.name_en;

    try {
      const payload = {
        name: categoryForm.name,
        name_en: categoryForm.name_en || null,
        description: categoryForm.description || null,
        display_order: parseInt(categoryForm.display_order) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingCategory) {
        const { error } = await supabase.from('product_option_categories').update(payload).eq('id', editingCategory.id);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.options.success'), text2: t('admin.options.categoryUpdated') });
      } else {
        const { error } = await supabase.from('product_option_categories').insert([payload]);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.options.success'), text2: t('admin.options.categoryAdded') });
      }
      setCategoryModalVisible(false);
      loadCategories();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.errorSavingCategory') });
    }
  };

  const handleSaveOption = async () => {
    const currentLanguageField = i18n.language === 'tr' ? optionForm.name : optionForm.name_en;
    if (!currentLanguageField.trim()) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.optionNameRequired') });
      return;
    }

    if (i18n.language === 'tr' && !optionForm.name_en.trim()) optionForm.name_en = optionForm.name;
    else if (i18n.language === 'en' && !optionForm.name.trim()) optionForm.name = optionForm.name_en;

    if (!selectedCategory) return;

    try {
      const payload = {
        category_id: selectedCategory.id,
        name: optionForm.name,
        name_en: optionForm.name_en || null,
        description: optionForm.description || null,
        price: parseFloat(optionForm.price) || 0,
        display_order: parseInt(optionForm.display_order) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingOption) {
        const { error } = await supabase.from('product_options').update(payload).eq('id', editingOption.id);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.options.success'), text2: t('admin.options.optionUpdated') });
      } else {
        const { error } = await supabase.from('product_options').insert([payload]);
        if (error) throw error;
        Toast.show({ type: 'success', text1: t('admin.options.success'), text2: t('admin.options.optionAdded') });
      }
      setOptionModalVisible(false);
      loadOptions(selectedCategory.id);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.errorSavingOption') });
    }
  };

  const confirmDelete = (type: 'category' | 'option', item: any) => {
      setItemToDelete({ type, item });
      setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
      if (!itemToDelete) return;
      
      try {
          if (itemToDelete.type === 'category') {
              const { error } = await supabase.from('product_option_categories').delete().eq('id', itemToDelete.item.id);
              if (error) throw error;
              if (selectedCategory?.id === itemToDelete.item.id) setSelectedCategory(null);
              loadCategories();
              Toast.show({ type: 'success', text1: t('admin.options.success'), text2: t('admin.options.categoryDeleted') });
          } else {
              const { error } = await supabase.from('product_options').delete().eq('id', itemToDelete.item.id);
              if (error) throw error;
              if (selectedCategory) loadOptions(selectedCategory.id);
              Toast.show({ type: 'success', text1: t('admin.options.success'), text2: t('admin.options.optionDeleted') });
          }
      } catch (error) {
           Toast.show({ type: 'error', text1: t('admin.error'), text2: t('admin.options.errorDeleting') });
      } finally {
          setShowDeleteConfirm(false);
          setItemToDelete(null);
      }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.breadcrumb}>
            <Text style={styles.breadText}>Admin</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={styles.breadText}>{t('admin.products.title')}</Text>
            <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
            <Text style={[styles.breadText, styles.breadActive]}>{t('admin.options.title')}</Text>
        </View>

        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('admin.options.title')}</Text>
            <TouchableOpacity onPress={() => openCategoryModal()} style={styles.addBtn}>
                 <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <View style={styles.content}>
          {/* CATEGORIES SIDEBAR */}
          <View style={[styles.leftPanel]}>
             <Text style={styles.panelTitle}>{t('admin.options.categoriesTitle')}</Text>
             <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
             >
                {categories.map((cat, index) => (
                    <Animated.View 
                        key={cat.id} 
                        entering={FadeInDown.delay(index * 50)}
                    >
                         <TouchableOpacity 
                            style={[styles.catItem, selectedCategory?.id === cat.id && styles.catItemActive]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                             <Text style={[styles.catName, selectedCategory?.id === cat.id && styles.catNameActive]} numberOfLines={2}>
                                 {i18n.language === 'tr' ? cat.name : (cat.name_en || cat.name)}
                             </Text>
                             <View style={styles.catFooter}>
                                 <Text style={[styles.catOrder, selectedCategory?.id === cat.id && {color: 'rgba(255,255,255,0.6)'}]}>#{cat.display_order}</Text>
                                 <View style={styles.catActions}>
                                     <TouchableOpacity onPress={() => openCategoryModal(cat)} style={[styles.miniBtn, selectedCategory?.id === cat.id && {backgroundColor: 'rgba(255,255,255,0.2)'}]}>
                                         <Ionicons name="create-outline" size={13} color={selectedCategory?.id === cat.id ? '#FFF' : Colors.primary} />
                                     </TouchableOpacity>
                                     <TouchableOpacity onPress={() => confirmDelete('category', cat)} style={[styles.miniBtn, {backgroundColor: '#FFEBEE'}, selectedCategory?.id === cat.id && {backgroundColor: 'rgba(255,255,255,0.2)'}]}>
                                         <Ionicons name="trash-outline" size={13} color={selectedCategory?.id === cat.id ? '#FFF' : '#D32F2F'} />
                                     </TouchableOpacity>
                                 </View>
                             </View>
                        </TouchableOpacity>
                    </Animated.View>
                ))}
             </ScrollView>
          </View>

          {/* OPTIONS PANEL */}
          <View style={[styles.rightPanel]}>
             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
                 <View style={styles.optionsHeader}>
                     <Text style={styles.panelTitle}>{t('admin.options.optionsTitle')}</Text>
                     {selectedCategory && (
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {i18n.language === 'tr' ? selectedCategory.name : (selectedCategory.name_en || selectedCategory.name)}
                        </Text>
                     )}
                     {selectedCategory && (
                         <TouchableOpacity onPress={() => openOptionModal()} style={styles.addOptionBtn}>
                             <Ionicons name="add" size={18} color="#FFF" />
                             <Text style={styles.addOptionText}>{t('admin.options.addOption')}</Text>
                         </TouchableOpacity>
                     )}
                 </View>

                {!selectedCategory ? (
                    <View style={styles.emptyView}>
                        <Ionicons name="arrow-back-circle-outline" size={64} color="#DDD" />
                        <Text style={styles.emptyText}>{t('admin.options.selectCategoryFirst')}</Text>
                    </View>
                ) : options.length === 0 ? (
                    <View style={styles.emptyView}>
                        <Ionicons name="list-outline" size={64} color="#DDD" />
                        <Text style={styles.emptyText}>{t('admin.options.noOptions')}</Text>
                    </View>
                ) : (
                    options.map((opt, index) => (
                        <Animated.View 
                            key={opt.id} 
                            entering={FadeInDown.delay(index * 50).springify()} 
                            style={styles.optionCard}
                        >
                            <View style={styles.optionLeft}>
                                <Text style={styles.optionName}>{i18n.language === 'tr' ? opt.name : (opt.name_en || opt.name)}</Text>
                                <Text style={styles.optionPrice}>
                                    {opt.price > 0 ? `+${getCurrencyInfo().symbol}${opt.price}` : t('admin.options.free')}
                                </Text>
                            </View>
                            <View style={styles.optionActions}>
                                <TouchableOpacity onPress={() => openOptionModal(opt)} style={styles.actionBtn}>
                                     <Ionicons name="create-outline" size={18} color={Colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => confirmDelete('option', opt)} style={[styles.actionBtn, {backgroundColor: '#FFEBEE'}]}>
                                     <Ionicons name="trash-outline" size={18} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    ))
                )}
             </ScrollView>
          </View>
        </View>
      )}

      {/* CATEGORY MODAL */}
      <Modal visible={categoryModalVisible} animationType="slide" presentationStyle="pageSheet">
           <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{editingCategory ? t('admin.options.editCategory') : t('admin.options.addCategory')}</Text>
                    <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={styles.closeModalBtn}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('admin.options.categoryNameLabel')} (TR)</Text>
                        <TextInput 
                          style={styles.input} 
                          value={categoryForm.name} 
                          onChangeText={t => setCategoryForm({...categoryForm, name: t})} 
                          placeholder={t('admin.categories.namePlaceholder') || "Kategori adı"}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('admin.options.categoryNameLabel')} (EN)</Text>
                        <TextInput 
                          style={styles.input} 
                          value={categoryForm.name_en} 
                          onChangeText={t => setCategoryForm({...categoryForm, name_en: t})} 
                          placeholder={t('admin.categories.nameEnPlaceholder') || "Category name"}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('admin.options.sortOrder')}</Text>
                        <TextInput style={styles.input} value={categoryForm.display_order} onChangeText={t => setCategoryForm({...categoryForm, display_order: t})} keyboardType="numeric" />
                    </View>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
                         <LinearGradient colors={[Colors.primary, '#FF6B6B']} style={styles.saveGrad}>
                            <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                         </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
           </View>
      </Modal>

      {/* OPTION MODAL */}
      <Modal visible={optionModalVisible} animationType="slide" presentationStyle="pageSheet">
           <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{editingOption ? t('admin.options.editOption') : t('admin.options.addOption')}</Text>
                    <TouchableOpacity onPress={() => setOptionModalVisible(false)} style={styles.closeModalBtn}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('admin.options.optionNameLabel')} (TR)</Text>
                        <TextInput style={styles.input} value={optionForm.name} onChangeText={t => setOptionForm({...optionForm, name: t})} />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('admin.options.optionNameLabel')} (EN)</Text>
                        <TextInput style={styles.input} value={optionForm.name_en} onChangeText={t => setOptionForm({...optionForm, name_en: t})} />
                    </View>
                    <View style={styles.rowInputs}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                             <Text style={styles.inputLabel}>{t('admin.options.price')} ({getCurrencyInfo().symbol})</Text>
                             <TextInput style={styles.input} value={optionForm.price} onChangeText={t => setOptionForm({...optionForm, price: t})} keyboardType="numeric" />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                             <Text style={styles.inputLabel}>{t('admin.options.sortOrder')}</Text>
                             <TextInput style={styles.input} value={optionForm.display_order} onChangeText={t => setOptionForm({...optionForm, display_order: t})} keyboardType="numeric" />
                        </View>
                    </View>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveOption}>
                         <LinearGradient colors={[Colors.primary, '#FF6B6B']} style={styles.saveGrad}>
                            <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                         </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
           </View>
      </Modal>

      <ConfirmModal
        visible={showDeleteConfirm}
        title={t('common.delete')}
        message={t('admin.products.deleteConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
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
  
  content: { flex: 1, flexDirection: 'row' },
  
  leftPanel: { width: 160, minWidth: 140, backgroundColor: '#F0F0F0', borderRightWidth: 1, borderRightColor: '#E0E0E0', padding: 12 },
  
  rightPanel: { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },

  panelTitle: { fontSize: 11, fontWeight: '800', color: '#888', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  subtitle: { fontSize: 16, fontWeight: '800', color: Colors.text, flex: 1 },
  
  catItem: { flexDirection: 'column', padding: 12, borderRadius: 14, marginBottom: 8, backgroundColor: '#FFF', ...Shadows.small },
  catItemActive: { backgroundColor: Colors.primary },
  catName: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  catNameActive: { color: '#FFF' },
  catOrder: { fontSize: 10, color: '#999' },
  catFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  catActions: { flexDirection: 'row', gap: 4 },
  miniBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  
  optionsHeader: { flexDirection: 'column', gap: 12, marginBottom: 20 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, alignSelf: 'flex-start', ...Shadows.small },
  addOptionText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  
  optionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, ...Shadows.small },
  optionLeft: { gap: 4 },
  optionName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  optionPrice: { fontSize: 13, fontWeight: '800', color: Colors.success },
  optionActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' },
  
  emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#AAA', fontWeight: '600' },
  
  modalContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.text },
  closeModalBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 16, padding: 16, fontSize: 15, color: Colors.text },
  rowInputs: { flexDirection: 'row', gap: 16 },
  saveBtn: { height: 60, borderRadius: 20, marginTop: 20, ...Shadows.medium, overflow: 'hidden' },
  saveGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});

export default AdminProductOptions;
