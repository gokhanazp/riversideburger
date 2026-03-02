import React, { useState, useEffect, useLayoutEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Shadows } from '../../constants/theme';
import { customizationService } from '../../services/customizationService';
import { ProductOptionCategory, ProductOption } from '../../types/customization';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface ProductSpecificOption {
  id: string;
  option_id: string;
  is_required: boolean;
  is_default: boolean;
  option: ProductOption;
  category: ProductOptionCategory;
}

const AdminProductCustomization = ({ route, navigation }: any) => {
  const { product } = route.params;
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [categories, setCategories] = useState<ProductOptionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductOptionCategory | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<ProductOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductSpecificOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadCategoryOptions(selectedCategory.id);
    }
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const allCategories = await customizationService.getAllCategories();
      setCategories(allCategories);
      if (allCategories.length > 0) {
        setSelectedCategory(allCategories[0]);
      }
      await loadProductOptions();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: i18n.language === 'tr' ? 'Veriler yüklenirken hata oluştu' : 'Error loading data',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProductOptions = async () => {
    try {
      const options = await customizationService.getProductSpecificOptions(product.id);
      const formatted: ProductSpecificOption[] = options.map((opt: any) => ({
        id: opt.id,
        option_id: opt.option?.id || opt.option_id,
        is_required: opt.is_required,
        is_default: opt.is_default,
        option: opt.option,
        category: opt.option?.category,
      }));
      setProductOptions(formatted);
    } catch (error) {
      console.error('Error loading product options:', error);
    }
  };

  const loadCategoryOptions = async (categoryId: string) => {
    try {
      const options = await customizationService.getCategoryOptions(categoryId);
      setCategoryOptions(options);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: i18n.language === 'tr' ? 'Seçenekler yüklenemedi' : 'Failed to load options',
      });
    }
  };

  const toggleOption = async (option: ProductOption) => {
    try {
      const existing = productOptions.find((po) => po.option_id === option.id);
      if (existing) {
        await customizationService.removeProductSpecificOption(existing.id);
        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Kaldırıldı' : '✅ Removed',
          text2: i18n.language === 'tr'
            ? `${option.name} kaldırıldı`
            : `${option.name_en || option.name} removed`,
        });
      } else {
        await customizationService.addProductSpecificOption(product.id, option.id, false, false);
        Toast.show({
          type: 'success',
          text1: i18n.language === 'tr' ? '✅ Eklendi' : '✅ Added',
          text2: i18n.language === 'tr'
            ? `${option.name} eklendi`
            : `${option.name_en || option.name} added`,
        });
      }
      await loadProductOptions();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('admin.error'),
        text2: i18n.language === 'tr' ? 'İşlem başarısız' : 'Operation failed',
      });
    }
  };

  const getCategoryName = (category: ProductOptionCategory): string =>
    i18n.language === 'tr' ? category.name : category.name_en || category.name;

  const getOptionName = (option: ProductOption): string =>
    i18n.language === 'tr' ? option.name : option.name_en || option.name;

  const isOptionAdded = (optionId: string): boolean =>
    productOptions.some((po) => po.option_id === optionId);

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
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient colors={['#1a1a1a', '#333']} style={styles.header}>
        <View style={styles.breadcrumb}>
          <Text style={styles.breadText}>Admin</Text>
          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
          <Text style={styles.breadText}>{t('admin.products.title')}</Text>
          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" />
          <Text style={[styles.breadText, styles.breadActive]}>
            {i18n.language === 'tr' ? 'Özelleştirme' : 'Customization'}
          </Text>
        </View>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>
              {i18n.language === 'tr' ? 'Özelleştirme' : 'Customization'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{product.name}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Two-panel ── */}
      <View style={styles.mainContent}>

        {/* LEFT: Categories — fixed 160 px, same as AdminProductOptions */}
        <View style={styles.leftPanel}>
          <Text style={styles.panelLabel}>
            {i18n.language === 'tr' ? 'Kategoriler' : 'Categories'}
          </Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 80 }}
          >
            {categories.map((category, index) => {
              const isActive = selectedCategory?.id === category.id;
              const selectedCount = productOptions.filter(
                (po) => po.category?.id === category.id
              ).length;
              return (
                <Animated.View key={category.id} entering={FadeInDown.delay(index * 40)}>
                  <TouchableOpacity
                    style={[styles.catCard, isActive && styles.catCardActive]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[styles.catCardName, isActive && styles.catCardNameActive]}
                      numberOfLines={2}
                    >
                      {getCategoryName(category)}
                    </Text>
                    {selectedCount > 0 && (
                      <View style={[styles.badge, isActive && styles.badgeActive]}>
                        <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                          {selectedCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>

        {/* RIGHT: Options */}
        <View style={styles.rightPanel}>
          {selectedCategory ? (
            <>
              <View style={styles.rightHeader}>
                <Text style={styles.panelLabel}>
                  {i18n.language === 'tr' ? 'Seçenekler' : 'Options'}
                </Text>
                <Text style={styles.rightTitle} numberOfLines={1}>
                  {getCategoryName(selectedCategory)}
                </Text>
              </View>

              {categoryOptions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="fast-food-outline" size={64} color="#DDD" />
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
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
                  renderItem={({ item, index }) => {
                    const isAdded = isOptionAdded(item.id);
                    return (
                      <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
                        <TouchableOpacity
                          style={[styles.optionCard, isAdded && styles.optionCardActive]}
                          onPress={() => toggleOption(item)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.optionLeft}>
                            <View style={[styles.checkbox, isAdded && styles.checkboxActive]}>
                              {isAdded && <Ionicons name="checkmark" size={14} color="#FFF" />}
                            </View>
                            <View style={styles.optionInfo}>
                              <Text style={[styles.optionName, isAdded && styles.optionNameActive]}>
                                {getOptionName(item)}
                              </Text>
                              {item.description && (
                                <Text style={styles.optionDesc} numberOfLines={1}>
                                  {item.description}
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text style={[styles.optionPrice, isAdded && styles.optionPriceActive]}>
                            {item.price > 0
                              ? `+${item.price.toFixed(2)}₺`
                              : i18n.language === 'tr' ? 'Ücretsiz' : 'Free'}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  }}
                />
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={64} color="#DDD" />
              <Text style={styles.emptyText}>
                {i18n.language === 'tr' ? 'Bir kategori seçin' : 'Select a category'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#888', fontWeight: '600' },

  /* Header */
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Shadows.medium,
  },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, opacity: 0.8 },
  breadText: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  breadActive: { color: '#FFF', opacity: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },

  /* Layout */
  mainContent: { flex: 1, flexDirection: 'row' },

  /* Left panel — matches AdminProductOptions */
  leftPanel: {
    width: 160,
    minWidth: 140,
    backgroundColor: '#F0F0F0',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    padding: 12,
  },
  panelLabel: {
    fontSize: 11, fontWeight: '800', color: '#888',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  catCard: {
    padding: 12, borderRadius: 14, backgroundColor: '#FFF', ...Shadows.small,
  },
  catCardActive: { backgroundColor: Colors.primary },
  catCardName: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  catCardNameActive: { color: '#FFF' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '20',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  badgeTextActive: { color: '#FFF' },

  /* Right panel */
  rightPanel: { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  rightHeader: { marginBottom: 16 },
  rightTitle: { fontSize: 18, fontWeight: '800', color: '#222' },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 16, backgroundColor: '#FFF',
    borderWidth: 2, borderColor: 'transparent', ...Shadows.small,
  },
  optionCardActive: {
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primary + '05',
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 2, borderColor: '#DDD',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionInfo: { flex: 1 },
  optionName: { fontSize: 14, fontWeight: '700', color: '#222' },
  optionNameActive: { color: Colors.primary },
  optionDesc: { fontSize: 11, color: '#999', marginTop: 2 },
  optionPrice: { fontSize: 14, fontWeight: '800', color: '#AAA' },
  optionPriceActive: { color: Colors.primary },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: '#BBB', fontWeight: '600', fontSize: 14 },
});

export default AdminProductCustomization;
