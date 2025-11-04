import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { customizationService } from '../../services/customizationService';
import { ProductOptionCategory, ProductOption } from '../../types/customization';

// Seçenek ile birlikte ürün bilgisi (Option with product info)
interface ProductSpecificOption {
  id: string;
  option_id: string;
  is_required: boolean;
  is_default: boolean;
  option: ProductOption;
  category: ProductOptionCategory;
}

// Admin ürün özelleştirme yönetimi (Admin product customization management)
const AdminProductCustomization = ({ route, navigation }: any) => {
  const { product } = route.params;
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();

  const [categories, setCategories] = useState<ProductOptionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductOptionCategory | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<ProductOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductSpecificOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadCategoryOptions(selectedCategory.id);
    }
  }, [selectedCategory]);

  // Verileri yükle (Load data)
  const loadData = async () => {
    try {
      setLoading(true);

      // Tüm kategorileri getir (Get all categories)
      const allCategories = await customizationService.getAllCategories();
      setCategories(allCategories);

      // İlk kategoriyi seç (Select first category)
      if (allCategories.length > 0) {
        setSelectedCategory(allCategories[0]);
      }

      // Ürün için mevcut seçenekleri getir (Get existing options for product)
      await loadProductOptions();
    } catch (error) {
      console.error('Error loading data:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Veriler yüklenirken hata oluştu' : 'Error loading data',
      });
    } finally {
      setLoading(false);
    }
  };

  // Ürün seçeneklerini yükle (Load product options)
  const loadProductOptions = async () => {
    try {
      console.log('📥 Loading product options for:', product.id);
      const options = await customizationService.getProductSpecificOptions(product.id);
      console.log('📦 Raw options received:', options);

      // Veriyi düzenle (Format data)
      const formatted: ProductSpecificOption[] = options.map((opt: any) => ({
        id: opt.id,
        option_id: opt.option?.id || opt.option_id,
        is_required: opt.is_required,
        is_default: opt.is_default,
        option: opt.option,
        category: opt.option?.category,
      }));

      console.log('✅ Formatted options:', formatted);
      setProductOptions(formatted);
    } catch (error) {
      console.error('❌ Error loading product options:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  };

  // Kategori seçeneklerini yükle (Load category options)
  const loadCategoryOptions = async (categoryId: string) => {
    try {
      const options = await customizationService.getCategoryOptions(categoryId);
      setCategoryOptions(options);
    } catch (error) {
      console.error('Error loading category options:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'Seçenekler yüklenemedi' : 'Failed to load options',
      });
    }
  };

  // Seçenek ekleme/çıkarma (Add/remove option)
  const toggleOption = async (option: ProductOption) => {
    try {
      // Seçenek zaten ekli mi kontrol et (Check if option already added)
      const existing = productOptions.find((po) => po.option_id === option.id);

      console.log('🔄 Toggle option:', {
        optionId: option.id,
        optionName: option.name,
        existing: existing ? 'YES' : 'NO',
        productId: product.id,
      });

      if (existing) {
        // Kaldır (Remove)
        console.log('🗑️ Removing option:', existing.id);
        await customizationService.removeProductSpecificOption(existing.id);
        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Kaldırıldı' : '✅ Removed',
          text2: i18n.language === 'tr'
            ? `${option.name} kaldırıldı`
            : `${option.name_en || option.name} removed`,
        });
      } else {
        // Ekle (Add)
        console.log('➕ Adding option:', option.id, 'to product:', product.id);
        const result = await customizationService.addProductSpecificOption(product.id, option.id, false, false);
        console.log('✅ Added result:', result);
        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Eklendi' : '✅ Added',
          text2: i18n.language === 'tr'
            ? `${option.name} eklendi`
            : `${option.name_en || option.name} added`,
        });
      }

      // Listeyi yenile (Refresh list)
      console.log('🔄 Reloading product options...');
      await loadProductOptions();
      console.log('✅ Product options reloaded. Count:', productOptions.length);
    } catch (error) {
      console.error('❌ Error toggling option:', error);
      Toast.show({
        type: 'error',
        text1: i18n.language === 'tr' ? '❌ Hata' : '❌ Error',
        text2: i18n.language === 'tr' ? 'İşlem başarısız' : 'Operation failed',
      });
    }
  };

  // Kategori adını al (Get category name)
  const getCategoryName = (category: ProductOptionCategory): string => {
    return i18n.language === 'tr' ? category.name : category.name_en || category.name;
  };

  // Seçenek adını al (Get option name)
  const getOptionName = (option: ProductOption): string => {
    return i18n.language === 'tr' ? option.name : option.name_en || option.name;
  };

  // Seçenek ekli mi kontrol et (Check if option is added)
  const isOptionAdded = (optionId: string): boolean => {
    return productOptions.some((po) => po.option_id === optionId);
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {i18n.language === 'tr' ? '🎨 Ürün Özelleştirme' : '🎨 Product Customization'}
          </Text>
          <Text style={styles.headerSubtitle}>{product.name}</Text>
        </View>
      </View>

      {/* İki panelli layout (Two-panel layout) */}
      <View style={styles.mainContent}>
        {/* Sol panel: Kategoriler (Left panel: Categories) */}
        <View style={styles.leftPanel}>
          <Text style={styles.panelTitle}>
            {i18n.language === 'tr' ? 'Kategoriler' : 'Categories'}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryItem,
                  selectedCategory?.id === category.id && styles.categoryItemActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryItemText,
                    selectedCategory?.id === category.id && styles.categoryItemTextActive,
                  ]}
                >
                  {getCategoryName(category)}
                </Text>
                {/* Seçili seçenek sayısı (Selected option count) */}
                {(() => {
                  const count = productOptions.filter(
                    (po) => po.category.id === category.id
                  ).length;
                  return count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{count}</Text>
                    </View>
                  ) : null;
                })()}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sağ panel: Seçenekler (Right panel: Options) */}
        <View style={styles.rightPanel}>
          {selectedCategory ? (
            <>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>
                  {i18n.language === 'tr' ? 'Seçenekler' : 'Options'}
                </Text>
                <Text style={styles.panelSubtitle}>
                  {getCategoryName(selectedCategory)}
                </Text>
              </View>

              {categoryOptions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="fast-food-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyText}>
                    {i18n.language === 'tr'
                      ? 'Bu kategoride seçenek yok'
                      : 'No options in this category'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={categoryOptions}
                  keyExtractor={(item) => item.id}
                  extraData={productOptions}
                  renderItem={({ item }) => {
                    const isAdded = isOptionAdded(item.id);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionCard,
                          isAdded && styles.optionCardActive,
                        ]}
                        onPress={() => toggleOption(item)}
                      >
                        <View style={styles.optionLeft}>
                          <View style={[
                            styles.checkbox,
                            isAdded && styles.checkboxActive,
                          ]}>
                            {isAdded && (
                              <Ionicons name="checkmark" size={16} color="#FFF" />
                            )}
                          </View>
                          <View style={styles.optionInfo}>
                            <Text style={[
                              styles.optionName,
                              isAdded && styles.optionNameActive,
                            ]}>
                              {getOptionName(item)}
                            </Text>
                            {item.description && (
                              <Text style={styles.optionDescription}>
                                {item.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text style={[
                          styles.optionPrice,
                          isAdded && styles.optionPriceActive,
                        ]}>
                          +{item.price.toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>
                {i18n.language === 'tr'
                  ? 'Bir kategori seçin'
                  : 'Select a category'}
              </Text>
            </View>
          )}
        </View>
      </View>
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
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
    borderBottomWidth: 0,
    borderBottomColor: Colors.border,
    ...Shadows.small,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: '#FFF',
    marginTop: 2,
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: '35%',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: Spacing.md,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: Spacing.md,
  },
  panelTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  panelHeader: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  panelSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.white,
  },
  categoryItemActive: {
    backgroundColor: Colors.primary,
  },
  categoryItemText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    flex: 1,
  },
  categoryItemTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardActive: {
    backgroundColor: '#FFF5F5',
    borderColor: Colors.primary,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '500',
  },
  optionNameActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  optionPriceActive: {
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});

export default AdminProductCustomization;

