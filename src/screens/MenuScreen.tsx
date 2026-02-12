import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { MenuItem } from '../types';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { getProducts, getCategories } from '../services/productService';
import { Product, Category } from '../types/database.types';
import { formatPrice } from '../services/currencyService';
import { getProductReviewCount } from '../services/reviewService';

// Menü ekranı (Menu screen)
const MenuScreen = ({ navigation, route }: any) => {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewCounts, setReviewCounts] = useState<{ [key: string]: number }>({});

  // View Mode: true = grid, false = list
  const [isGridView, setIsGridView] = useState(true);

  const addItem = useCartStore((state) => state.addItem);
  const { toggleFavorite, isFavorite } = useFavoritesStore();

  // Responsive Grid Hesaplama
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;

  // Tablette 3, büyük tablette 4, mobilde 2 kolon
  const numColumns = isGridView ? (isLargeTablet ? 4 : (isTablet ? 3 : 2)) : 1;
  const gap = Spacing.sm; // Boşluğu azalttık (Reduced gap)

  // Kategori ismini mevcut dile göre al (Get category name based on current language)
  const getCategoryName = (category: Category): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  // Ürünleri ve kategorileri yükle (Load products and categories)
  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);

      // Yorum sayılarını yükle (Load review counts)
      loadReviewCounts(productsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Ürünler yüklenirken bir hata oluştu',
      });
    } finally {
      setLoading(false);
    }
  };

  // Yorum sayılarını yükle (Load review counts)
  const loadReviewCounts = async (productsData: Product[]) => {
    try {
      const counts: { [key: string]: number } = {};
      await Promise.all(
        productsData.map(async (product) => {
          const count = await getProductReviewCount(product.id);
          counts[product.id] = count;
        })
      );
      setReviewCounts(counts);
    } catch (error) {
      console.error('Error loading review counts:', error);
    }
  };

  // Yenileme (Refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // İlk yüklemede verileri çek (Load data on mount)
  useEffect(() => {
    loadData();
  }, []);

  // Route parametresinden gelen kategoriyi ayarla (Set category from route params)
  useEffect(() => {
    if (route?.params?.categoryId) {
      console.log('🎯 Category ID from HomeScreen:', route.params.categoryId);
      setSelectedCategory(route.params.categoryId);
    }
  }, [route?.params?.categoryId]);

  // Seçili kategoriye ve arama sorgusuna göre menü öğelerini filtrele (Filter menu items by category and search query)
  const filteredItems = products.filter((item) => {
    // Kategori filtresi (Category filter)
    const categoryMatch = selectedCategory === 'all' || item.category_id === selectedCategory;

    // Arama filtresi (Search filter)
    const searchMatch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return categoryMatch && searchMatch;
  });

  // Sepete ekle butonu işlevi (Add to cart button handler)
  const handleAddToCart = (item: Product) => {
    const menuItem: MenuItem = {
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      image: item.image_url,
      category: 'burger',
      preparationTime: item.preparation_time || 15,
      rating: 4.5,
      reviews: 0,
    };

    addItem(menuItem);
    Toast.show({
      type: 'success',
      text1: '✅ ' + t('cart.addedToCart'),
      text2: item.name,
      position: 'bottom',
      visibilityTime: 2000,
      bottomOffset: 100,
    });
  };

  // Kategori butonu componenti (Category button component)
  const CategoryButton = ({ category, label, icon }: { category: string; label: string; icon?: string }) => {
    const isActive = selectedCategory === category;

    return (
      <TouchableOpacity
        style={{
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 25,
          backgroundColor: isActive ? '#E63946' : '#F8F9FA',
          marginRight: 12,
          borderWidth: 2,
          borderColor: isActive ? '#E63946' : '#DEE2E6',
          minWidth: 90,
          height: 50,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        onPress={() => setSelectedCategory(category)}
        activeOpacity={0.7}
      >
        {icon && (
          <Ionicons
            name={icon as any}
            size={18}
            color={isActive ? '#FFFFFF' : '#000000'}
          />
        )}
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 14,
            fontWeight: isActive ? '800' : '700',
            color: isActive ? '#FFFFFF' : '#000000',
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Menü öğesi kartı componenti (Menu item card component)
  const MenuItemCard = ({ item, index }: { item: Product; index: number }) => {
    const menuItem: MenuItem = {
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      image: item.image_url,
      category: 'burger',
      preparationTime: item.preparation_time || 15,
      rating: 4.5,
      reviews: 0,
      ingredients: item.ingredients || [],
    };

    const favorite = isFavorite(item.id);
    const scale = useSharedValue(1);

    const animatedButtonStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handleAddPress = (e: any) => {
      e.stopPropagation();
      scale.value = withSpring(0.9, {}, () => {
        scale.value = withSpring(1);
      });
      handleAddToCart(item);
    };

    // Grid stilini hesapla
    const gridStyle = isGridView ? {
      flex: 1,
      maxWidth: `${100 / numColumns}%`,
    } : {};

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).springify()}
        style={[isGridView ? styles.gridCardContainer : undefined, gridStyle]}
      >
        <TouchableOpacity
          style={[styles.menuCard, isGridView && styles.menuCardGrid]}
          onPress={() => navigation.navigate('ProductDetail', { item: menuItem })}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: item.image_url }}
            style={[
              isGridView ? styles.menuImageGrid : styles.menuImage,
              // Tablette görsel yüksekliğini artır (Increase image height on tablet)
              isGridView && isTablet && { height: 180 }
            ]}
          />

          <TouchableOpacity
            style={[styles.favoriteButton, isGridView && { padding: 6, top: 4, right: 4 }]}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(menuItem);
              Toast.show({
                type: favorite ? 'info' : 'success',
                text1: favorite ? '💔 ' + t('favorites.removedFromFavorites') : '❤️ ' + t('favorites.addedToFavorites'),
                text2: item.name,
                position: 'bottom',
                visibilityTime: 1500,
                bottomOffset: 100,
              });
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={isGridView ? 16 : 24}
              color={favorite ? Colors.primary : Colors.white}
            />
          </TouchableOpacity>

          <View style={[styles.menuInfo, isGridView && styles.menuInfoGrid]}>
            <Text
              style={[styles.menuName, isGridView && styles.menuNameGrid]}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            {!isGridView && (
              <Text style={styles.menuDescription} numberOfLines={2}>
                {item.description || ''}
              </Text>
            )}

            {!isGridView && reviewCounts[item.id] > 0 && (
              <View style={styles.reviewCountContainer}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={styles.reviewCountText}>
                  {reviewCounts[item.id]} {t('product.reviews')}
                </Text>
              </View>
            )}

            <View style={[styles.menuFooter, isGridView && { marginTop: 4, justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuPrice, isGridView && styles.menuPriceGrid]}>
                  {formatPrice(item.price)}
                </Text>

                {!isGridView && item.preparation_time && (
                  <Text style={styles.preparationTime}>⏱️ {item.preparation_time} {t('product.minutes')}</Text>
                )}
              </View>

              <Animated.View style={animatedButtonStyle}>
                <TouchableOpacity
                  style={[styles.addButton, isGridView && styles.addButtonGrid]}
                  onPress={handleAddPress}
                  activeOpacity={0.7}
                >
                  {isGridView ? (
                    <Ionicons name="add" size={20} color={Colors.white} />
                  ) : (
                    <Text style={styles.addButtonText}>{t('menu.addToCart')}</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header: Arama + Toggle */}
      <View style={styles.headerControls}>
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.searchContainer}
        >
          <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Animated.View entering={ZoomIn.duration(200)}>
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* Toggle Button */}
        <TouchableOpacity
          onPress={() => setIsGridView(!isGridView)}
          style={styles.viewSwitchButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isGridView ? 'list' : 'grid'}
            size={22}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Kategoriler */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          <CategoryButton
            category="all"
            label={t('menu.allCategories')}
            icon="apps-outline"
          />
          {categories.map((cat) => {
            const label = getCategoryName(cat);
            return (
              <CategoryButton
                key={cat.id}
                category={cat.id}
                label={label}
                icon={cat.icon}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Menü Listesi */}
      {filteredItems.length > 0 ? (
        <FlatList
          key={isGridView ? `grid-${numColumns}` : 'list'}
          data={filteredItems}
          renderItem={({ item, index }) => <MenuItemCard item={item} index={index} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.menuList}
          showsVerticalScrollIndicator={false}
          numColumns={numColumns}
          columnWrapperStyle={isGridView ? { gap: Spacing.sm } : undefined} // Gap spacing
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>{t('menu.noItems')}</Text>
          <Text style={styles.emptyText}>
            {searchQuery ? `"${searchQuery}"` : t('menu.noItems')}
          </Text>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // Header Controls (Search + Toggle)
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingRight: Spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 48,
    ...Shadows.small,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  viewSwitchButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },

  categoriesContainer: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.md,
  },
  menuList: {
    padding: Spacing.md,
    paddingBottom: 100,
  },

  // DEFAULT Styles (List View)
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.small,
  },
  menuImage: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.surface,
    resizeMode: 'cover',
  },
  menuInfo: {
    padding: Spacing.md,
  },
  menuName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  menuDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  reviewCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewCountText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  menuFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuPrice: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  preparationTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
  favoriteButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: BorderRadius.round,
    padding: Spacing.sm,
    zIndex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // GRID Styles (Compact)
  gridCardContainer: {
    flex: 1,
    marginBottom: Spacing.sm,
  },
  menuCardGrid: {
    height: '100%',
    marginBottom: 0,
    borderRadius: BorderRadius.md,
  },
  menuImageGrid: {
    width: '100%',
    height: 125, // Compact height
    backgroundColor: Colors.surface,
    resizeMode: 'cover',
  },
  menuInfoGrid: {
    padding: 8, // Less padding
  },
  menuNameGrid: {
    fontSize: 13, // Smaller font
    lineHeight: 18,
    marginBottom: 4,
  },
  menuPriceGrid: {
    fontSize: 14,
    fontWeight: '700',
  },
  addButtonGrid: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
    width: 32, // Smaller button
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default MenuScreen;
