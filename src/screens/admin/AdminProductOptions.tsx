// Admin Ekstra Malzeme Yönetimi Ekranı (Admin Product Options Management Screen)
// Özelleştirme kategorileri ve seçenekleri yönetmek için (For managing customization categories and options)
import React, { useState, useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ProductOptionCategory, ProductOption } from '../../types/customization';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 768;

const AdminProductOptions = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ProductOptionCategory[]>([]);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductOptionCategory | null>(null);

  // Modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductOptionCategory | null>(null);
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);

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
    }
  }, [selectedCategory]);

  // Kategorileri yükle (Load categories)
  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_option_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      
      // İlk kategoriyi seç (Select first category)
      if (data && data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Kategoriler yüklenemedi' : 'Failed to load categories',
      });
    } finally {
      setLoading(false);
    }
  };

  // Seçenekleri yükle (Load options)
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
      console.error('Error loading options:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Seçenekler yüklenemedi' : 'Failed to load options',
      });
    }
  };

  // Kategori ekle/düzenle modal aç (Open add/edit category modal)
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
      setCategoryForm({
        name: '',
        name_en: '',
        description: '',
        display_order: '0',
      });
    }
    setCategoryModalVisible(true);
  };

  // Seçenek ekle/düzenle modal aç (Open add/edit option modal)
  const openOptionModal = (option?: ProductOption) => {
    if (!selectedCategory) {
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Önce bir kategori seçin' : 'Please select a category first',
      });
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
      setOptionForm({
        name: '',
        name_en: '',
        description: '',
        price: '0',
        display_order: '0',
      });
    }
    setOptionModalVisible(true);
  };

  // Kategori kaydet (Save category)
  const handleSaveCategory = async () => {
    // Validasyon - sadece mevcut dilin alanını kontrol et (Validation - check only current language field)
    const currentLanguageField = i18n.language === 'tr' ? categoryForm.name : categoryForm.name_en;
    if (!currentLanguageField.trim()) {
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Kategori adı gerekli' : 'Category name is required',
      });
      return;
    }

    // Diğer dil alanı boşsa, mevcut dil değerini kopyala (If other language field is empty, copy current language value)
    if (i18n.language === 'tr' && !categoryForm.name_en.trim()) {
      categoryForm.name_en = categoryForm.name;
    } else if (i18n.language === 'en' && !categoryForm.name.trim()) {
      categoryForm.name = categoryForm.name_en;
    }

    try {
      if (editingCategory) {
        // Güncelle (Update)
        const { error } = await supabase
          .from('product_option_categories')
          .update({
            name: categoryForm.name,
            name_en: categoryForm.name_en || null,
            description: categoryForm.description || null,
            display_order: parseInt(categoryForm.display_order) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
          text2: i18n.language === 'tr' ? 'Kategori güncellendi' : 'Category updated',
        });
      } else {
        // Yeni ekle (Insert new)
        const { error } = await supabase
          .from('product_option_categories')
          .insert([{
            name: categoryForm.name,
            name_en: categoryForm.name_en || null,
            description: categoryForm.description || null,
            display_order: parseInt(categoryForm.display_order) || 0,
          }]);

        if (error) throw error;

        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
          text2: i18n.language === 'tr' ? 'Kategori eklendi' : 'Category added',
        });
      }

      setCategoryModalVisible(false);
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Kategori kaydedilemedi' : 'Failed to save category',
      });
    }
  };

  // Seçenek kaydet (Save option)
  const handleSaveOption = async () => {
    // Validasyon - sadece mevcut dilin alanını kontrol et (Validation - check only current language field)
    const currentLanguageField = i18n.language === 'tr' ? optionForm.name : optionForm.name_en;
    if (!currentLanguageField.trim()) {
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Seçenek adı gerekli' : 'Option name is required',
      });
      return;
    }

    // Diğer dil alanı boşsa, mevcut dil değerini kopyala (If other language field is empty, copy current language value)
    if (i18n.language === 'tr' && !optionForm.name_en.trim()) {
      optionForm.name_en = optionForm.name;
    } else if (i18n.language === 'en' && !optionForm.name.trim()) {
      optionForm.name = optionForm.name_en;
    }

    if (!selectedCategory) return;

    try {
      const price = parseFloat(optionForm.price) || 0;

      if (editingOption) {
        // Güncelle (Update)
        const { error } = await supabase
          .from('product_options')
          .update({
            name: optionForm.name,
            name_en: optionForm.name_en || null,
            description: optionForm.description || null,
            price: price,
            display_order: parseInt(optionForm.display_order) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingOption.id);

        if (error) throw error;

        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
          text2: i18n.language === 'tr' ? 'Seçenek güncellendi' : 'Option updated',
        });
      } else {
        // Yeni ekle (Insert new)
        const { error } = await supabase
          .from('product_options')
          .insert([{
            category_id: selectedCategory.id,
            name: optionForm.name,
            name_en: optionForm.name_en || null,
            description: optionForm.description || null,
            price: price,
            display_order: parseInt(optionForm.display_order) || 0,
          }]);

        if (error) throw error;

        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
          text2: i18n.language === 'tr' ? 'Seçenek eklendi' : 'Option added',
        });
      }

      setOptionModalVisible(false);
      loadOptions(selectedCategory.id);
    } catch (error) {
      console.error('Error saving option:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Seçenek kaydedilemedi' : 'Failed to save option',
      });
    }
  };

  // Kategori sil (Delete category)
  const handleDeleteCategory = (category: ProductOptionCategory) => {
    Alert.alert(
      i18n.language === 'tr' ? 'Kategori Sil' : 'Delete Category',
      i18n.language === 'tr' 
        ? `"${category.name}" kategorisini silmek istediğinize emin misiniz? Bu kategoriye ait tüm seçenekler de silinecektir.`
        : `Are you sure you want to delete "${category.name}" category? All options in this category will also be deleted.`,
      [
        { text: i18n.language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
        {
          text: i18n.language === 'tr' ? 'Sil' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('product_option_categories')
                .delete()
                .eq('id', category.id);

              if (error) throw error;

              Toast.show({
                type: 'success',
                text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
                text2: i18n.language === 'tr' ? 'Kategori silindi' : 'Category deleted',
              });

              if (selectedCategory?.id === category.id) {
                setSelectedCategory(null);
              }
              loadCategories();
            } catch (error) {
              console.error('Error deleting category:', error);
              Toast.show({
                type: 'error',
                text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
                text2: i18n.language === 'tr' ? 'Kategori silinemedi' : 'Failed to delete category',
              });
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {i18n.language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {i18n.language === 'tr' ? 'Ekstra Malzemeler' : 'Extra Ingredients'}
        </Text>
        <TouchableOpacity onPress={() => openCategoryModal()} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.content, isSmallScreen && styles.contentVertical]}>
        {/* Sol taraf - Kategoriler (Left side - Categories) */}
        <View style={[styles.leftPanel, isSmallScreen && styles.leftPanelVertical]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
              {i18n.language === 'tr' ? 'Kategoriler' : 'Categories'}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categories.length}</Text>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            horizontal={isSmallScreen}
            style={isSmallScreen && styles.categoryScrollHorizontal}
          >
            <View style={isSmallScreen && styles.categoryRowContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    isSmallScreen && styles.categoryItemHorizontal,
                    selectedCategory?.id === category.id && styles.categoryItemActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <View style={styles.categoryItemLeft}>
                    <Text
                      style={[
                        styles.categoryItemName,
                        selectedCategory?.id === category.id && styles.categoryItemNameActive,
                      ]}
                      numberOfLines={isSmallScreen ? 2 : 2}
                      ellipsizeMode="tail"
                    >
                      {i18n.language === 'tr' ? category.name : (category.name_en || category.name)}
                    </Text>
                  </View>
                  {!isSmallScreen && (
                    <View style={styles.categoryItemActions}>
                      <TouchableOpacity
                        onPress={() => openCategoryModal(category)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="pencil" size={18} color={
                          selectedCategory?.id === category.id ? '#FFF' : Colors.primary
                        } />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteCategory(category)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash" size={18} color={
                          selectedCategory?.id === category.id ? '#FFF' : '#DC3545'
                        } />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Sağ taraf - Seçenekler (Right side - Options) */}
        <View style={[styles.rightPanel, isSmallScreen && styles.rightPanelVertical]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleContainer}>
              <Text style={styles.panelTitle}>
                {i18n.language === 'tr' ? 'Seçenekler' : 'Options'}
              </Text>
              {selectedCategory && (
                <View style={styles.optionBadge}>
                  <Text style={styles.optionBadgeText}>{options.length}</Text>
                </View>
              )}
            </View>
            {selectedCategory && (
              <TouchableOpacity
                onPress={() => openOptionModal()}
                style={styles.addOptionButton}
              >
                <Ionicons name="add-circle" size={24} color={Colors.primary} />
                {!isSmallScreen && (
                  <Text style={styles.addOptionButtonText}>
                    {i18n.language === 'tr' ? 'Ekle' : 'Add'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {selectedCategory ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="fast-food-outline" size={48} color={Colors.textSecondary} />
                  <Text style={styles.emptyStateText}>
                    {i18n.language === 'tr' 
                      ? 'Bu kategoride henüz seçenek yok' 
                      : 'No options in this category yet'}
                  </Text>
                </View>
              ) : (
                options.map((option) => (
                  <View key={option.id} style={styles.optionCard}>
                    <View style={styles.optionCardLeft}>
                      <Text style={styles.optionName}>
                        {i18n.language === 'tr' ? option.name : (option.name_en || option.name)}
                      </Text>
                      {option.description && (
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      )}
                      <Text style={styles.optionPrice}>
                        {option.price > 0 ? `+${option.price}` : i18n.language === 'tr' ? 'Ücretsiz' : 'Free'}
                      </Text>
                    </View>
                    <View style={styles.optionCardActions}>
                      <TouchableOpacity
                        onPress={() => openOptionModal(option)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateText}>
                {i18n.language === 'tr' 
                  ? 'Bir kategori seçin' 
                  : 'Select a category'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Kategori Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory 
                ? (i18n.language === 'tr' ? 'Kategori Düzenle' : 'Edit Category')
                : (i18n.language === 'tr' ? 'Yeni Kategori' : 'New Category')}
            </Text>

            {/* Sadece mevcut dile göre kategori adı alanını göster (Show only current language category name field) */}
            {i18n.language === 'tr' ? (
              <>
                <Text style={styles.inputLabel}>Kategori Adı (Türkçe) *</Text>
                <TextInput
                  style={styles.input}
                  value={categoryForm.name}
                  onChangeText={(text) => setCategoryForm({ ...categoryForm, name: text })}
                  placeholder="Örn: Ekstra Malzemeler"
                />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Category Name (English) *</Text>
                <TextInput
                  style={styles.input}
                  value={categoryForm.name_en}
                  onChangeText={(text) => setCategoryForm({ ...categoryForm, name_en: text })}
                  placeholder="E.g: Extra Ingredients"
                />
              </>
            )}

            <Text style={styles.inputLabel}>
              {i18n.language === 'tr' ? 'Açıklama' : 'Description'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={categoryForm.description}
              onChangeText={(text) => setCategoryForm({ ...categoryForm, description: text })}
              placeholder={i18n.language === 'tr' ? 'Kategori açıklaması...' : 'Category description...'}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setCategoryModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>
                  {i18n.language === 'tr' ? 'İptal' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveCategory}
              >
                <Text style={styles.modalButtonTextSave}>
                  {i18n.language === 'tr' ? 'Kaydet' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Seçenek Modal (Option Modal) */}
      <Modal
        visible={optionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: Spacing.lg }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingOption
                  ? (i18n.language === 'tr' ? 'Seçenek Düzenle' : 'Edit Option')
                  : (i18n.language === 'tr' ? 'Yeni Seçenek' : 'New Option')}
              </Text>

              {/* Sadece mevcut dile göre seçenek adı alanını göster (Show only current language option name field) */}
              {i18n.language === 'tr' ? (
                <>
                  <Text style={styles.inputLabel}>Seçenek Adı (Türkçe) *</Text>
                  <TextInput
                    style={styles.input}
                    value={optionForm.name}
                    onChangeText={(text) => setOptionForm({ ...optionForm, name: text })}
                    placeholder="Örn: Ekstra Peynir"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Option Name (English) *</Text>
                  <TextInput
                    style={styles.input}
                    value={optionForm.name_en}
                    onChangeText={(text) => setOptionForm({ ...optionForm, name_en: text })}
                    placeholder="E.g: Extra Cheese"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>
                {i18n.language === 'tr' ? 'Açıklama' : 'Description'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={optionForm.description}
                onChangeText={(text) => setOptionForm({ ...optionForm, description: text })}
                placeholder={i18n.language === 'tr' ? 'Seçenek açıklaması...' : 'Option description...'}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>
                {i18n.language === 'tr' ? 'Ekstra Fiyat *' : 'Extra Price *'}
              </Text>
              <TextInput
                style={styles.input}
                value={optionForm.price}
                onChangeText={(text) => setOptionForm({ ...optionForm, price: text })}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputHelper}>
                {i18n.language === 'tr'
                  ? '0 girerseniz ücretsiz olur'
                  : 'Enter 0 for free'}
              </Text>

              <Text style={styles.inputLabel}>
                {i18n.language === 'tr' ? 'Sıralama' : 'Display Order'}
              </Text>
              <TextInput
                style={styles.input}
                value={optionForm.display_order}
                onChangeText={(text) => setOptionForm({ ...optionForm, display_order: text })}
                placeholder="0"
                keyboardType="number-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setOptionModalVisible(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>
                    {i18n.language === 'tr' ? 'İptal' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveOption}
                >
                  <Text style={styles.modalButtonTextSave}>
                    {i18n.language === 'tr' ? 'Kaydet' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.primary,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#FFF',
  },
  addButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  contentVertical: {
    flexDirection: 'column',
  },
  leftPanel: {
    width: '35%',
    backgroundColor: Colors.white,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: Spacing.md,
  },
  leftPanelVertical: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
    maxHeight: 120,
  },
  rightPanel: {
    flex: 1,
    padding: Spacing.md,
  },
  rightPanelVertical: {
    flex: 1,
    paddingTop: Spacing.md,
  },
  panelTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  panelTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeText: {
    color: '#FFF',
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  optionBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeText: {
    color: '#FFF',
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  categoryScrollHorizontal: {
    flexGrow: 0,
    paddingVertical: Spacing.xs, // Üst ve alt padding (Top and bottom padding)
  },
  categoryRowContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.xs, // Yazıların kesilmemesi için (To prevent text clipping)
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  categoryItemHorizontal: {
    marginBottom: 0,
    marginRight: Spacing.sm,
    minWidth: 140,
    maxWidth: 180,
    paddingVertical: Spacing.md + 4, // Yazıların kesilmemesi için ekstra padding (Extra padding to prevent text clipping)
    minHeight: 56, // Minimum yükseklik (Minimum height)
  },
  categoryItemActive: {
    backgroundColor: Colors.primary,
  },
  categoryItemLeft: {
    flex: 1,
    paddingRight: Spacing.xs, // Sağ tarafta boşluk (Space on the right)
  },
  categoryItemName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: FontSizes.md * 1.4, // Satır yüksekliği (Line height)
  },
  categoryItemNameActive: {
    color: '#FFF',
  },
  categoryItemActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconButton: {
    padding: Spacing.xs,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addOptionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  optionCardLeft: {
    flex: 1,
  },
  optionName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  optionPrice: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  optionCardActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyStateText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.surface,
  },
  modalButtonSave: {
    backgroundColor: Colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  modalButtonTextSave: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFF',
  },
  inputHelper: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
});

export default AdminProductOptions;

