// Admin Categories Screen - Admin Kategori Yönetim Ekranı
// Menü kategorilerini yönetmek için (For managing menu categories)
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

const AdminCategories = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation(); // Mevcut dili almak için (Get current language)
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Kategori ismini mevcut dile göre al (Get category name based on current language)
  const getCategoryName = (category: MenuCategory): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  // Form state
  const [formData, setFormData] = useState({
    name_tr: '',
    name_en: '',
    icon: 'fast-food-outline',
    display_order: 0,
    is_active: true,
  });

  // Kategorileri yükle (Load categories)
  useEffect(() => {
    loadCategories();
  }, []);

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
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Kategoriler yüklenemedi' : 'Failed to load categories',
      });
    } finally {
      setLoading(false);
    }
  };

  // Yeni kategori ekle (Add new category)
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

  // Kategori düzenle (Edit category)
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

  // Kategori kaydet (Save category)
  const handleSaveCategory = async () => {
    // Validasyon (Validation)
    if (!formData.name_tr.trim() || !formData.name_en.trim()) {
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '⚠️ Uyarı' : '⚠️ Warning',
        text2: i18n.language === 'tr' ? 'Lütfen tüm alanları doldurun' : 'Please fill all fields',
      });
      return;
    }

    try {
      if (editingCategory) {
        // Güncelle (Update)
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

        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
          text2: i18n.language === 'tr' ? 'Kategori güncellendi' : 'Category updated',
        });
      } else {
        // Yeni ekle (Insert new)
        const { error } = await supabase
          .from('menu_categories')
          .insert([formData]);

        if (error) throw error;

        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
          text2: i18n.language === 'tr' ? 'Kategori eklendi' : 'Category added',
        });
      }

      setShowForm(false);
      loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Kategori kaydedilemedi' : 'Failed to save category',
      });
    }
  };

  // Kategori sil (Delete category)
  const handleDeleteCategory = (category: MenuCategory) => {
    const categoryName = getCategoryName(category);
    Alert.alert(
      i18n.language === 'tr' ? 'Kategoriyi Sil' : 'Delete Category',
      i18n.language === 'tr'
        ? `"${categoryName}" kategorisini silmek istediğinize emin misiniz?`
        : `Are you sure you want to delete "${categoryName}" category?`,
      [
        { text: i18n.language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
        {
          text: i18n.language === 'tr' ? 'Sil' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('menu_categories')
                .delete()
                .eq('id', category.id);

              if (error) throw error;

              Toast.show({
                type: 'success',
                text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
                text2: i18n.language === 'tr' ? 'Kategori silindi' : 'Category deleted',
              });

              loadCategories();
            } catch (error: any) {
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

  // Aktif/Pasif durumu değiştir (Toggle active status)
  const handleToggleActive = async (category: MenuCategory) => {
    try {
      const { error } = await supabase
        .from('menu_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: i18n.language === 'tr' ? '✅ Başarılı' : '✅ Success',
        text2: category.is_active
          ? (i18n.language === 'tr' ? 'Kategori pasif edildi' : 'Category deactivated')
          : (i18n.language === 'tr' ? 'Kategori aktif edildi' : 'Category activated'),
      });

      loadCategories();
    } catch (error: any) {
      console.error('Error toggling category:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Durum değiştirilemedi' : 'Failed to change status',
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
          {i18n.language === 'tr' ? 'Menü Kategorileri' : 'Menu Categories'}
        </Text>
        <TouchableOpacity onPress={handleAddCategory} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Kategori listesi (Category list) */}
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryCard}>
            <View style={styles.categoryLeft}>
              <View style={[
                styles.iconContainer,
                !category.is_active && styles.iconContainerInactive
              ]}>
                <Ionicons
                  name={category.icon as any}
                  size={28}
                  color={category.is_active ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={[
                  styles.categoryName,
                  !category.is_active && styles.categoryNameInactive
                ]}>
                  {getCategoryName(category)}
                </Text>
                <Text style={styles.categorySubtitle}>
                  {i18n.language === 'tr' ? category.name_en : category.name_tr}
                </Text>
                <Text style={styles.categoryOrder}>
                  {i18n.language === 'tr' ? 'Sıra' : 'Order'}: {category.display_order}
                </Text>
              </View>
            </View>

            <View style={styles.categoryActions}>
              <TouchableOpacity
                onPress={() => handleToggleActive(category)}
                style={styles.actionButton}
              >
                <Ionicons
                  name={category.is_active ? 'eye' : 'eye-off'}
                  size={20}
                  color={category.is_active ? Colors.success : Colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleEditCategory(category)}
                style={styles.actionButton}
              >
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteCategory(category)}
                style={styles.actionButton}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {categories.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              {i18n.language === 'tr' ? 'Henüz kategori eklenmemiş' : 'No categories added yet'}
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddCategory}>
              <Text style={styles.emptyButtonText}>
                {i18n.language === 'tr' ? 'İlk Kategoriyi Ekle' : 'Add First Category'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Form Modal */}
      {showForm && (
        <View style={styles.formOverlay}>
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {editingCategory
                ? (i18n.language === 'tr' ? 'Kategori Düzenle' : 'Edit Category')
                : (i18n.language === 'tr' ? 'Yeni Kategori' : 'New Category')
              }
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>
                {i18n.language === 'tr' ? 'Türkçe İsim' : 'Turkish Name'}
              </Text>
              <TextInput
                style={styles.input}
                value={formData.name_tr}
                onChangeText={(text) => setFormData({ ...formData, name_tr: text })}
                placeholder={i18n.language === 'tr' ? 'Örn: Burgerler' : 'Ex: Burgerler'}
              />

              <Text style={styles.inputLabel}>
                {i18n.language === 'tr' ? 'İngilizce İsim' : 'English Name'}
              </Text>
              <TextInput
                style={styles.input}
                value={formData.name_en}
                onChangeText={(text) => setFormData({ ...formData, name_en: text })}
                placeholder={i18n.language === 'tr' ? 'Örn: Burgers' : 'Ex: Burgers'}
              />

              <IconPicker
                label="Icon"
                selectedIcon={formData.icon}
                onSelectIcon={(icon) => setFormData({ ...formData, icon })}
              />

              <Text style={styles.inputLabel}>
                {i18n.language === 'tr' ? 'Sıra' : 'Order'}
              </Text>
              <TextInput
                style={styles.input}
                value={formData.display_order.toString()}
                onChangeText={(text) => setFormData({ ...formData, display_order: parseInt(text) || 0 })}
                keyboardType="numeric"
                placeholder="1"
              />

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
              >
                <Ionicons
                  name={formData.is_active ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={Colors.primary}
                />
                <Text style={styles.checkboxLabel}>
                  {i18n.language === 'tr' ? 'Aktif' : 'Active'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.cancelButtonText}>
                  {i18n.language === 'tr' ? 'İptal' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.saveButton]}
                onPress={handleSaveCategory}
              >
                <Text style={styles.saveButtonText}>
                  {i18n.language === 'tr' ? 'Kaydet' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    padding: Spacing.lg,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  iconContainerInactive: {
    backgroundColor: Colors.surface,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  categoryNameInactive: {
    color: Colors.textSecondary,
  },
  categorySubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  categoryOrder: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
  formOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxHeight: '80%',
    ...Shadows.large,
  },
  formTitle: {
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
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.sm,
  },
  checkboxLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  formButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  formButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default AdminCategories;

