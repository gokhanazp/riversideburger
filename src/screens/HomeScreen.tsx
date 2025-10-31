import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { CATEGORY_NAMES } from '../constants/mockData';
import { CategoryType } from '../types';
import BannerSlider from '../components/BannerSlider';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import Toast from 'react-native-toast-message';

// Ürün tipi (Product type)
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  stock_status: 'in_stock' | 'out_of_stock';
  is_featured: boolean;
}

// Ana sayfa ekranı (Home screen)
const HomeScreen = ({ navigation }: any) => {
  // State'ler (States)
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Store'lar (Stores)
  const { addItem } = useCartStore();
  const { favorites, toggleFavorite } = useFavoritesStore();

  // Sayfa yüklendiğinde öne çıkan ürünleri getir (Fetch featured products on page load)
  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  // Öne çıkan ürünleri getir (Fetch featured products)
  const fetchFeaturedProducts = async () => {
    try {
      setLoadingProducts(true);
      console.log('🔍 Fetching featured products...');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_featured', true)
        .eq('stock_status', 'in_stock')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Featured products fetched:', data?.length || 0);
      setFeaturedProducts(data || []);
    } catch (error: any) {
      console.error('❌ Error fetching featured products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Kategorilere tıklandığında menü ekranına yönlendir (Navigate to menu screen on category click)
  const handleCategoryPress = (category: CategoryType) => {
    navigation.navigate('MenuTab', { category });
  };

  // Ürüne tıklandığında detay sayfasına git (Navigate to product detail)
  const handleProductPress = (product: Product) => {
    // Product'ı MenuItem formatına çevir (Convert Product to MenuItem format)
    const menuItem = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image_url,
      rating: 4.5, // Varsayılan rating (Default rating)
      reviews: 0, // Varsayılan review sayısı (Default review count)
    };
    navigation.navigate('ProductDetail', { item: menuItem });
  };

  // Sepete ekle (Add to cart)
  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url,
      quantity: 1,
    });

    Toast.show({
      type: 'success',
      text1: '✅ Sepete Eklendi',
      text2: product.name,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  // Favorilere ekle/çıkar (Toggle favorite)
  const handleToggleFavorite = (product: Product) => {
    toggleFavorite(product);
    const isFavorite = favorites.some((fav) => fav.id === product.id);

    Toast.show({
      type: isFavorite ? 'info' : 'success',
      text1: isFavorite ? '💔 Favorilerden Çıkarıldı' : '❤️ Favorilere Eklendi',
      text2: product.name,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  // Kategori kartı componenti (Category card component)
  const CategoryCard = ({
    category,
    iconName,
    index
  }: {
    category: CategoryType;
    iconName: keyof typeof Ionicons.glyphMap;
    index: number;
  }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(category)}
      activeOpacity={0.7}
    >
      <Animated.View
        entering={FadeInDown.delay(index * 100).springify()}
        style={styles.categoryCardContent}
      >
        <View style={styles.categoryIconContainer}>
          <Ionicons name={iconName} size={32} color={Colors.primary} />
        </View>
        <Text style={styles.categoryName}>{CATEGORY_NAMES[category]}</Text>
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header bölümü (Header section) */}
      <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.restaurantName}>RIVERSIDE</Text>
            <Text style={styles.restaurantSubname}>BURGERS</Text>
          </View>
          <TouchableOpacity style={styles.locationButton}>
            <Ionicons name="location-outline" size={20} color={Colors.text} />
            <Text style={styles.locationText}>Toronto</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Banner Slider (Banner Slider) */}
      <BannerSlider onBannerPress={(id) => console.log('Banner pressed:', id)} />

      {/* Kategoriler bölümü (Categories section) */}
      <View style={styles.section}>
        <Animated.Text
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.sectionTitle}
        >
          Menümüz
        </Animated.Text>
        <View style={styles.categoriesGrid}>
          <CategoryCard category="burger" iconName="fast-food" index={0} />
          <CategoryCard category="pizza" iconName="pizza" index={1} />
          <CategoryCard category="pasta" iconName="restaurant" index={2} />
          <CategoryCard category="salad" iconName="leaf" index={3} />
          <CategoryCard category="dessert" iconName="ice-cream" index={4} />
          <CategoryCard category="drink" iconName="cafe" index={5} />
        </View>
      </View>

      {/* Önerilen Ürünler bölümü (Recommended Products section) */}
      <View style={styles.section}>
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.sectionHeader}
        >
          <View>
            <Text style={styles.sectionTitle}>Önerilen Ürünler</Text>
            <Text style={styles.sectionSubtitle}>Sizin için seçtiklerimiz</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('MenuTab')}
            style={styles.viewAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>Tümünü Gör</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        {loadingProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
          </View>
        ) : featuredProducts.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsScrollContent}
          >
            {featuredProducts.map((product, index) => {
              const isFavorite = favorites.some((fav) => fav.id === product.id);
              return (
                <Animated.View
                  key={product.id}
                  entering={FadeInDown.delay(400 + index * 100).duration(600)}
                >
                  <TouchableOpacity
                    style={styles.productCard}
                    onPress={() => handleProductPress(product)}
                    activeOpacity={0.9}
                  >
                    {/* Ürün Resmi (Product Image) */}
                    <Image
                      source={{ uri: product.image_url }}
                      style={styles.productImage}
                    />

                    {/* Favori Butonu (Favorite Button) */}
                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={() => handleToggleFavorite(product)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isFavorite ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isFavorite ? Colors.primary : '#666'}
                      />
                    </TouchableOpacity>

                    {/* Önerilen Badge (Recommended Badge) */}
                    <View style={styles.recommendedBadge}>
                      <Ionicons name="star" size={12} color={Colors.white} />
                      <Text style={styles.recommendedText}>ÖNERİLEN</Text>
                    </View>

                    {/* Ürün Bilgileri (Product Info) */}
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text style={styles.productDescription} numberOfLines={2}>
                        {product.description}
                      </Text>

                      {/* Fiyat ve Sepete Ekle (Price and Add to Cart) */}
                      <View style={styles.productFooter}>
                        <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                        <TouchableOpacity
                          style={styles.addToCartButton}
                          onPress={() => handleAddToCart(product)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={20} color={Colors.white} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>Henüz önerilen ürün yok</Text>
            <Text style={styles.emptySubtext}>
              Admin panelinden ürünleri "Öne Çıkan" olarak işaretleyebilirsiniz
            </Text>
          </View>
        )}
      </View>

      {/* About Us bölümü (About Us section) */}
      <View style={styles.section}>
        <Animated.Text
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.sectionTitle}
        >
          Hakkımızda
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.aboutCard}>
          <Image
            source={{ uri: 'https://riversideburgers.ca/wp-content/uploads/2020/12/83333940_125121939016697_1418790697863077606_n-1.jpg' }}
            style={styles.aboutImage}
          />
          <View style={styles.aboutContent}>
            <Text style={styles.aboutText}>
              Riverside Burgers was established in 2019. Our passion for fresh and high quality burgers led us to creating our Signature Burger, along with serving you everyone's favourite Classic Burgers. We take pride in making everything in house with the highest quality of meat and produces to keep it fresh, tasty and mouth-watering to keep you coming back for more!
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Müşteri Yorumları bölümü (Customer Reviews section) */}
      <View style={styles.section}>
        <Animated.Text
          entering={FadeInDown.delay(500).duration(600)}
          style={styles.sectionTitle}
        >
          Müşteri Yorumları
        </Animated.Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reviewsScrollContent}
        >
          <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                <Ionicons name="person" size={24} color={Colors.white} />
              </View>
              <View style={styles.reviewInfo}>
                <Text style={styles.reviewName}>Ahmet Y.</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={14} color={Colors.accent} />
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.reviewText}>
              "Harika burgerler! Özellikle Riverside Classic'i denemenizi tavsiye ederim. Taze malzemeler ve lezzetli soslar."
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                <Ionicons name="person" size={24} color={Colors.white} />
              </View>
              <View style={styles.reviewInfo}>
                <Text style={styles.reviewName}>Zeynep K.</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={14} color={Colors.accent} />
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.reviewText}>
              "Teslimat çok hızlı geldi ve burgerler sıcacıktı. Kesinlikle tekrar sipariş vereceğim!"
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                <Ionicons name="person" size={24} color={Colors.white} />
              </View>
              <View style={styles.reviewInfo}>
                <Text style={styles.reviewName}>Mehmet S.</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={14} color={Colors.accent} />
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.reviewText}>
              "Toronto'daki en iyi burger! Double Riverside'ı mutlaka deneyin. Fiyat performans açısından da çok iyi."
            </Text>
          </Animated.View>
        </ScrollView>
      </View>

      {/* Özellikler bölümü (Features section) */}
      <View style={styles.section}>
        <View style={styles.featuresContainer}>
          <View style={styles.featureCard}>
            <Ionicons name="time-outline" size={32} color={Colors.primary} />
            <Text style={styles.featureTitle}>Hızlı Teslimat</Text>
            <Text style={styles.featureText}>30 dakikada kapınızda</Text>
          </View>
          <View style={styles.featureCard}>
            <Ionicons name="shield-checkmark-outline" size={32} color={Colors.primary} />
            <Text style={styles.featureTitle}>Kalite Garantisi</Text>
            <Text style={styles.featureText}>Taze malzemeler</Text>
          </View>
          <View style={styles.featureCard}>
            <Ionicons name="star-outline" size={32} color={Colors.primary} />
            <Text style={styles.featureTitle}>5 Yıldız</Text>
            <Text style={styles.featureText}>Müşteri memnuniyeti</Text>
          </View>
        </View>
      </View>

      {/* Footer bölümü (Footer section) */}
      <View style={styles.footer}>
        {/* About Us */}
        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>About Us</Text>
          <Text style={styles.footerText}>
            Riverside Burgers was established in 2019. Our passion for fresh and high quality burgers led us to creating our Signature Burger.
          </Text>
          {/* Social Media */}
          <View style={styles.socialContainer}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://www.facebook.com/riversideburgers')}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-facebook" size={24} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => Linking.openURL('https://www.instagram.com/riversideburgers')}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-instagram" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Locations - Yan yana (Side by side) */}
        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Locations</Text>
          <View style={styles.locationsRow}>
            <TouchableOpacity
              style={styles.locationItem}
              onPress={() => Linking.openURL('tel:+14168507026')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerText}>
                688 Queen Street East{'\n'}Toronto, Ontario{'\n'}(416) 850-7026
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationItem}
              onPress={() => Linking.openURL('tel:+14169356600')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerText}>
                1228 King St W{'\n'}Toronto, Ontario{'\n'}(416) 935-6600
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:riversideburgerss@gmail.com')}
            activeOpacity={0.7}
            style={styles.emailButton}
          >
            <Text style={styles.footerText}>riversideburgerss@gmail.com</Text>
          </TouchableOpacity>
        </View>

        {/* Copyright */}
        <View style={styles.copyright}>
          <Text style={styles.copyrightText}>
            © 2023 Riverside Burgers. All rights reserved.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: FontSizes.xxl + 8,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 2,
  },
  restaurantSubname: {
    fontSize: FontSizes.xl,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
  },
  locationText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 140,
    ...Shadows.small,
  },
  categoryCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  featureCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.small,
  },
  featureTitle: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  featureText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  // About Us stilleri (About Us styles)
  aboutCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  aboutImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  aboutContent: {
    padding: Spacing.lg,
  },
  aboutText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 24,
    textAlign: 'justify',
  },
  // Müşteri Yorumları stilleri (Customer Reviews styles)
  reviewsScrollContent: {
    paddingRight: Spacing.lg,
  },
  reviewCard: {
    width: 280,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    ...Shadows.small,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  reviewAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  // Öne Çıkan Ürünler stilleri (Featured Products styles)
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  viewAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  productsScrollContent: {
    paddingRight: Spacing.md,
  },
  productCard: {
    width: 200,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  productImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#F0F0F0',
  },
  favoriteButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  recommendedBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    ...Shadows.small,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  productInfo: {
    padding: Spacing.md,
  },
  productName: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  productDescription: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: Spacing.sm,
    height: 32,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  addToCartButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: '#999',
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: '#BBB',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  // Footer stilleri (Footer styles)
  footer: {
    backgroundColor: Colors.black,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
  },
  footerSection: {
    marginBottom: Spacing.xl,
  },
  footerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  socialContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  locationItem: {
    flex: 1,
  },
  emailButton: {
    marginTop: Spacing.sm,
  },
  copyright: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderDark,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

export default HomeScreen;

