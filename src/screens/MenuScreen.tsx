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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { CATEGORY_NAMES } from '../constants/mockData';
import { MenuItem, CategoryType } from '../types';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { getProducts, getCategories } from '../services/productService';
import { Product, Category } from '../types/database.types';

// Menü ekranı (Menu screen)
const MenuScreen = ({ navigation }: any) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const { toggleFavorite, isFavorite } = useFavoritesStore();

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
    // Product'ı MenuItem formatına çevir (Convert Product to MenuItem format)
    const menuItem: MenuItem = {
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      image: item.image_url,
      category: 'burger', // Varsayılan kategori (Default category)
      preparationTime: item.preparation_time || 15,
      rating: 4.5, // Varsayılan rating (Default rating)
      reviews: 0, // Varsayılan reviews (Default reviews)
    };

    addItem(menuItem);
    // Toast bildirimi göster (Show toast notification)
    Toast.show({
      type: 'success',
      text1: '🍔 Sepete Eklendi!',
      text2: `${item.name} sepetinize eklendi`,
      position: 'bottom',
      visibilityTime: 2000,
      bottomOffset: 100,
    });
  };

  // Kategori butonu componenti (Category button component)
  const CategoryButton = ({ category, label }: { category: string; label: string }) => {
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
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        }}
        onPress={() => setSelectedCategory(category)}
        activeOpacity={0.7}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 14,
            fontWeight: (isActive ? '800' : '700') as '800' | '700',
            color: isActive ? '#FFFFFF' : '#000000',
            textAlign: 'center' as const,
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
    // MenuItem formatına çevir (Convert to MenuItem format for favorites)
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
      ingredients: item.ingredients || [], // Malzemeler (Ingredients)
    };

    const favorite = isFavorite(item.id);
    const scale = useSharedValue(1);

    // Buton basıldığında animasyon (Button press animation)
    const animatedButtonStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handleAddPress = (e: any) => {
      e.stopPropagation();
      // Buton animasyonu (Button animation)
      scale.value = withSpring(0.9, {}, () => {
        scale.value = withSpring(1);
      });
      handleAddToCart(item);
    };

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).springify()}
      >
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => navigation.navigate('ProductDetail', { item: menuItem })}
          activeOpacity={0.9}
        >
          <Image source={{ uri: item.image_url }} style={styles.menuImage} />

          {/* Favori butonu (Favorite button) */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(menuItem);
              Toast.show({
                type: favorite ? 'info' : 'success',
                text1: favorite ? '💔 Favorilerden Çıkarıldı' : '❤️ Favorilere Eklendi',
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
              size={24}
              color={favorite ? Colors.primary : Colors.white}
            />
          </TouchableOpacity>

          <View style={styles.menuInfo}>
            <Text style={styles.menuName}>{item.name}</Text>
            <Text style={styles.menuDescription} numberOfLines={2}>
              {item.description || ''}
            </Text>
            <View style={styles.menuFooter}>
              <View>
                <Text style={styles.menuPrice}>₺{item.price.toFixed(2)}</Text>
                {item.preparation_time && (
                  <Text style={styles.preparationTime}>⏱️ {item.preparation_time} dk</Text>
                )}
              </View>
              <Animated.View style={animatedButtonStyle}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddPress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>Ekle +</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Loading state (Yükleniyor durumu)
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Arama çubuğu (Search bar) */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={styles.searchContainer}
      >
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün ara..."
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

      {/* Kategori filtreleri (Category filters) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        <CategoryButton category="all" label="Tümü" />
        {categories.map((cat) => (
          <CategoryButton key={cat.id} category={cat.id} label={cat.name} />
        ))}
      </ScrollView>

      {/* Menü listesi (Menu list) */}
      {filteredItems.length > 0 ? (
        <FlatList
          data={filteredItems}
          renderItem={({ item, index }) => <MenuItemCard item={item} index={index} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.menuList}
          showsVerticalScrollIndicator={false}
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
          <Text style={styles.emptyTitle}>Ürün Bulunamadı</Text>
          <Text style={styles.emptyText}>
            {searchQuery ? `"${searchQuery}" için sonuç bulunamadı` : 'Bu kategoride ürün yok'}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  categoriesContainer: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs, // Alt boşluk ekle (Add bottom spacing)
  },
  categoriesContent: {
    paddingHorizontal: Spacing.md,
  },
  categoryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: '#F8F9FA',
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: '#DEE2E6',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#E63946',
    borderColor: '#E63946',
    borderWidth: 2,
  },
  categoryButtonTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C757D',
    textAlign: 'center',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  menuList: {
    padding: Spacing.md,
  },
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
    height: 220, // Yükseklik artırıldı (Height increased from 180 to 220)
    backgroundColor: Colors.surface,
    resizeMode: 'cover', // Görselin tam kapsaması için (For full image coverage)
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
    marginBottom: Spacing.md,
    lineHeight: 20,
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
});

export default MenuScreen;

