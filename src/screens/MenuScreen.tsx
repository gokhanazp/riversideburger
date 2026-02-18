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
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInRight,
  Layout,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme';
import { MenuItem } from '../types';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { getProducts, getCategories } from '../services/productService';
import { Product, Category } from '../types/database.types';
import { formatPrice } from '../services/currencyService';
import { getProductReviewCount } from '../services/reviewService';

const MenuScreen = ({ navigation, route }: any) => {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewCounts, setReviewCounts] = useState<{ [key: string]: number }>({});

  const [selectedCategory, setSelectedCategory] = useState<string>(route?.params?.categoryId || 'all');
  const [searchQuery, setSearchQuery] = useState(route?.params?.searchQuery || '');
  const [isGridView, setIsGridView] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const { toggleFavorite, isFavorite } = useFavoritesStore();

  const numColumns = isGridView ? (width >= 768 ? 3 : 2) : 1;

  // Data loading optimization to prevent double-render
  const loadData = async () => {
    if (loading && products.length > 0) return; // Prevent unnecessary execution

    try {
      setLoading(true);
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);

      // Fetch reviews in parallel
      const counts: { [key: string]: number } = {};
      await Promise.all(
        productsData.map(async (product) => {
          counts[product.id] = await getProductReviewCount(product.id);
        })
      );

      // Batch updates
      setProducts(productsData);
      setCategories(categoriesData);
      setReviewCounts(counts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (route?.params?.categoryId) setSelectedCategory(route.params.categoryId);
    if (route?.params?.searchQuery) setSearchQuery(route.params.searchQuery);
  }, [route?.params?.categoryId, route?.params?.searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getCategoryName = (category: Category): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  const filteredItems = products.filter((item) => {
    const categoryMatch = selectedCategory === 'all' || item.category_id === selectedCategory;
    const searchMatch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return categoryMatch && searchMatch;
  });

  const CategoryTab = ({ category, label, icon }: { category: string; label: string; icon?: string }) => {
    const isActive = selectedCategory === category;
    return (
      <TouchableOpacity
        style={[styles.categoryTab, isActive && styles.categoryTabActive]}
        onPress={() => setSelectedCategory(category)}
        activeOpacity={0.7}
      >
        <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const EliteProductCard = ({ item, index }: { item: Product; index: number }) => {
    const menuItem: MenuItem = {
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      image: item.image_url,
      category: 'burger',
      preparationTime: item.preparation_time || 15,
      available: item.is_active,
      rating: 4.5,
      reviews: reviewCounts[item.id] || 0,
    };

    const favorite = isFavorite(item.id);

    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50).springify()}
        style={isGridView ? { flex: 1 / numColumns, margin: 6 } : { marginBottom: 16 }}
      >
        <TouchableOpacity
          style={isGridView ? styles.gridCard : styles.listCard}
          onPress={() => navigation.navigate('ProductDetail', { item: menuItem })}
          activeOpacity={0.9}
        >
          {/* Image Section */}
          <View style={isGridView ? styles.gridImageContainer : styles.listImageContainer}>
             <Image source={{ uri: item.image_url }} style={styles.productImage} />
             <TouchableOpacity 
                style={styles.favoriteBadge} 
                onPress={(e) => { e.stopPropagation(); toggleFavorite(menuItem); }}
              >
                <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={18} color={favorite ? '#FF4B4B' : '#FFF'} />
              </TouchableOpacity>
              {(menuItem.reviews ?? 0) > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#FFD700" />
                  <Text style={styles.ratingText}>{menuItem.reviews}</Text>
                </View>
              )}
          </View>

          {/* Info Section */}
          <View style={styles.cardInfo}>
            <View>
               <Text style={styles.productName} numberOfLines={isGridView ? 1 : 2}>{item.name}</Text>
               {!isGridView && (
                 <Text style={styles.productDescription} numberOfLines={2}>
                   {item.description}
                 </Text>
               )}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={(e) => { e.stopPropagation(); addItem(menuItem); }}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Avant-Garde Header */}
      <View style={styles.eliteHeader}>
        <View style={styles.headerRow}>
          <View style={styles.searchBarElite}>
            <Ionicons name="search" size={20} color="#1A1A1A" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('home.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
          <TouchableOpacity 
            onPress={() => setIsGridView(!isGridView)} 
            style={styles.viewToggle}
            activeOpacity={0.7}
          >
            <Ionicons name={isGridView ? 'list' : 'grid'} size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Minimalist Categories */}
        <View style={styles.categoryContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.categoryScroll}
          >
            <CategoryTab category="all" label={t('menu.allCategories')} />
            {categories.map((cat) => (
              <CategoryTab 
                key={cat.id} 
                category={cat.id} 
                label={getCategoryName(cat)} 
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          key={isGridView ? 'grid' : 'list'}
          data={filteredItems}
          renderItem={({ item, index }) => <EliteProductCard item={item} index={index} />}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                tintColor={Colors.primary} 
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={80} color="#E0E0E0" />
              <Text style={styles.emptyTitle}>{t('menu.noItems')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FB' // Slightly cooler gray
  },
  eliteHeader: {
    backgroundColor: '#FFF',
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    ...Shadows.small,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  viewToggle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Shadows.small,
  },
  searchBarElite: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  categoryContainer: {
    paddingBottom: 12,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryTab: {
    marginRight: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  categoryTabActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  categoryTabTextActive: {
    color: '#FFF',
  },
  tabIndicator: {
    display: 'none', // Removed invalid line-style indicator
  },
  listPadding: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  // Cards
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 12,
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  gridCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 10,
    flex: 1,
    minHeight: 240,
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  listImageContainer: {
    width: 110,
    height: 110,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5F5F7',
  },
  gridImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5F5F7',
    marginBottom: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoriteBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', // Glassmorphism dark
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    ...Shadows.small,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  cardInfo: {
    flex: 1,
    paddingLeft: 16,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 17, // Larger title
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  productDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  addButton: {
    backgroundColor: '#1A1A1A',
    width: 40,
    height: 40,
    borderRadius: 20, // Perfectly rounded
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
});

export default MenuScreen;
