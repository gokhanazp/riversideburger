import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { CATEGORY_NAMES } from '../constants/mockData';
import { CategoryType } from '../types';
import BannerSlider from '../components/BannerSlider';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { formatPrice } from '../services/currencyService';
import { getCategories } from '../services/productService';
import { Category, Review } from '../types/database.types';
import { getRestaurantReviews } from '../services/reviewService';
import { getContactInfo, getPhoneLink, getEmailLink, ContactInfo } from '../services/contactService';

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
  ingredients?: string[];
}

// Ana sayfa ekranı (Home screen)
const HomeScreen = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();

  // State'ler (States)
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [restaurantReviews, setRestaurantReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Store'lar (Stores)
  const { addItem } = useCartStore();
  const { favorites, toggleFavorite } = useFavoritesStore();

  // Sayfa yüklendiğinde öne çıkan ürünleri, kategorileri ve restoran yorumlarını getir
  useEffect(() => {
    fetchFeaturedProducts();
    fetchCategories();
    fetchRestaurantReviews();
    loadContactInfo();
  }, []);

  const loadContactInfo = async () => {
    try {
      const info = await getContactInfo();
      setContactInfo(info);
    } catch (error) {
      console.error('Error loading contact info:', error);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_featured', true)
        .eq('stock_status', 'in_stock')
        .order('display_order', { ascending: true })
        .limit(6);
      if (error) throw error;
      setFeaturedProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching featured products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await getCategories();
      setCategories(data.slice(0, 6));
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchRestaurantReviews = async () => {
    try {
      setLoadingReviews(true);
      const data = await getRestaurantReviews();
      setRestaurantReviews(data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const getCategoryName = (category: Category): string => {
    return i18n.language === 'tr' ? category.name_tr : category.name_en;
  };

  const handleCategoryPress = (categoryId: string) => {
    navigation.navigate('MenuTab', { categoryId });
  };

  const handleProductPress = (product: Product) => {
    const menuItem: any = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image_url,
      available: product.stock_status === 'in_stock',
      rating: 4.5,
      reviews: 0,
      ingredients: product.ingredients || [],
    };
    navigation.navigate('ProductDetail', { item: menuItem });
  };

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url,
    } as any);
    Toast.show({
      type: 'success',
      text1: '✅ ' + t('cart.addedToCart'),
      text2: product.name,
      position: 'top',
      topOffset: 60,
    });
  };

  const handleToggleFavorite = (product: Product) => {
    const menuItem: any = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image_url,
      available: product.stock_status === 'in_stock',
    };
    toggleFavorite(menuItem);
  };

  const handleBannerPress = async (banner: any) => {
    const link = banner.button_link;
    if (!link) return;
    if (link.startsWith('product:')) {
      const productId = link.split(':')[1];
      const { data } = await supabase.from('products').select('*').eq('id', productId).single();
      if (data) handleProductPress(data);
    } else if (link.startsWith('category:')) {
      handleCategoryPress(link.split(':')[1]);
    } else if (link.startsWith('http')) {
      Linking.openURL(link);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate('MenuTab', { searchQuery: searchQuery.trim() });
    } else {
      navigation.navigate('MenuTab');
    }
  };

  const CategoryCard = ({ category, index }: { category: Category; index: number }) => (
    <TouchableOpacity
      style={styles.modernCategoryCard}
      onPress={() => handleCategoryPress(category.id)}
      activeOpacity={0.8}
    >
      <Animated.View entering={FadeInDown.delay(100 + index * 100).springify()} style={styles.categoryCardContent}>
        <LinearGradient
          colors={index % 2 === 0 ? ['#FFF', '#FDF2F2'] : ['#FFF', '#F0F7FF']}
          style={styles.modernCategoryIconContainer}
        >
          <Ionicons name={category.icon as any} size={28} color={Colors.primary} />
        </LinearGradient>
        <Text style={styles.modernCategoryName} numberOfLines={1}>{getCategoryName(category)}</Text>
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingTop: 16 }}
      >
        {/* Simple Branded Header - Internal */}
        <View style={styles.brandedHeader}>
          <View>
            <Text style={styles.greetingText}>{t('home.welcome') || 'Hello,'}</Text>
            <Text style={styles.brandNameText}>Riverside Burgers 🍔</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileCircle}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroBanner}>
          <BannerSlider onBannerPress={handleBannerPress} />
        </View>

        {/* Minimalist Search Area */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('home.searchPlaceholder') || 'Search your favorites...'}
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.filterInline} onPress={handleSearch}>
               <Ionicons name="options-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

      {/* Kategoriler bölümü (Categories section) */}
      <View style={styles.modernSection}>
        <View style={[styles.sectionHeader, { paddingRight: Spacing.lg }]}>
          <Text style={styles.modernSectionTitle}>{t('home.ourMenu')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MenuTab')}>
            <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        
        {loadingCategories ? (
          <View style={styles.loadingPlaceholder}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modernCategoriesScroll}
          >
            {categories.map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </ScrollView>
        )}
      </View>


      {/* Önerilen Ürünler bölümü (Recommended Products section) */}
      <View style={styles.section}>
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.sectionHeader}
        >
          <View>
            <Text style={styles.sectionTitle}>{t('home.featuredProducts')}</Text>
            <Text style={styles.sectionSubtitle}>{t('home.featuredProductsSubtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('MenuTab')}
            style={styles.viewAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        {loadingProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
                      <Text style={styles.recommendedText}>{t('home.featured').toUpperCase()}</Text>
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
                        <Text style={styles.productPrice}>
                          {formatPrice(product.price)}
                        </Text>
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
            <Text style={styles.emptyText}>{t('home.noFeaturedProducts')}</Text>
            <Text style={styles.emptySubtext}>
              {t('home.noFeaturedProductsSubtext')}
            </Text>
          </View>
        )}
      </View>

      {/* Pro Branded About Section */}
      <View style={styles.eliteAboutSection}>
        <Animated.View 
          entering={FadeInDown.delay(300).springify()}
          style={styles.aboutImageWrapper}
        >
          <Image
            source={{ uri: contactInfo?.aboutImage || 'https://riversideburgers.ca/wp-content/uploads/2020/12/83333940_125121939016697_1418790697863077606_n-1.jpg' }}
            style={styles.eliteAboutImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.aboutImageOverlay}
          />
          <View style={styles.estBadge}>
            <Text style={styles.estText}>EST.</Text>
            <Text style={styles.estYear}>2019</Text>
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(450).springify()}
          style={styles.eliteAboutCard}
        >
          <Text style={styles.eliteAboutTitle}>
            {contactInfo ? (i18n.language === 'tr' ? contactInfo.aboutTitleTr : contactInfo.aboutTitleEn) : t('home.aboutUs')}
          </Text>
          <Text style={styles.eliteAboutText}>
            {contactInfo ? (i18n.language === 'tr' ? contactInfo.aboutDescTr : contactInfo.aboutDescEn) : 'Riverside Burgers was established in 2019. Our passion for fresh and high quality burgers led us to creating our Signature Burger, along with serving you everyone\'s favourite Classic Burgers. We take pride in making everything in house with the highest quality of meat and produces to keep it fresh, tasty and mouth-watering to keep you coming back for more!'}
          </Text>
          <View style={styles.aboutSignatureRow}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Riverside Quality</Text>
          </View>
        </Animated.View>
      </View>

      {/* Delivery Partners bölümü (Delivery Partners section) */}
      <View style={styles.section}>
        <Animated.Text
          entering={FadeInDown.delay(500).duration(600)}
          style={styles.sectionTitle}
        >
          {t('home.deliveryPartners')}
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.deliveryPartnersContainer}>
          <View style={styles.deliveryPartnerCard}>
            <Image
              source={{ uri: 'https://riversideburgers.ca/wp-content/uploads/elementor/thumbs/Food-delivery-icon-doordash-ozl8cebv125k1p7ay7gbam8zbts7ubzyb2nrjyb3l4.png' }}
              style={styles.deliveryPartnerImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.deliveryPartnerCard}>
            <Image
              source={{ uri: 'https://riversideburgers.ca/wp-content/uploads/elementor/thumbs/Food-delivery-icon-ubereats-ozl8dodybxwlulceh9d16smkfph7bi2stemk2iet48.png' }}
              style={styles.deliveryPartnerImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.deliveryPartnerCard}>
            <Image
              source={{ uri: 'https://riversideburgers.ca/wp-content/uploads/elementor/thumbs/skipthedishes@162px-ozl8vrs3w4obcd27tkxhoq903qakhqwsayq1n9kzc8.png' }}
              style={styles.deliveryPartnerImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      </View>

      {/* Müşteri Yorumları Bölümü (Customer Reviews Section) - Elite Redesign */}
      <View style={styles.eliteReviewSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eliteSectionTitle}>{t('home.customerReviews')}</Text>
            <Text style={styles.eliteSectionSubtitle}>{t('home.customerReviewsSubtitle')}</Text>
          </View>
        </View>

        {loadingReviews ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : restaurantReviews.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eliteReviewsScroll}
            snapToInterval={310}
            decelerationRate="fast"
          >
            {restaurantReviews.map((review, index) => (
              <Animated.View
                key={review.id}
                entering={FadeInDown.delay(700 + index * 100).springify()}
                style={styles.eliteReviewCard}
              >
                <View style={styles.reviewHeaderRow}>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.rating ? 'star' : 'star-outline'}
                        size={14}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-seal" size={14} color={Colors.primary} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>

                {review.comment && (
                  <Text style={styles.eliteReviewText} numberOfLines={4}>
                    "{review.comment}"
                  </Text>
                )}

                <View style={styles.eliteReviewFooter}>
                  <View style={styles.eliteAvatar}>
                    <Text style={styles.avatarText}>
                      {review.user?.full_name?.charAt(0) || 'U'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.eliteReviewName}>{review.user?.full_name}</Text>
                    <Text style={styles.eliteReviewDate}>
                      {new Date(review.created_at).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-CA')}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyReviewsPlaceholder}>
            <Ionicons name="chatbubble-outline" size={40} color="#DDD" />
            <Text style={styles.emptyText}>{t('home.noReviews')}</Text>
          </View>
        )}
      </View>

      {/* Özellikler Bölümü (Why Riverside Burgers) - Bento Grid Redesign */}
      <View style={styles.bentoSection}>
        <View style={styles.bentoHeader}>
          <Text style={styles.bentoTitle}>
            {contactInfo ? (i18n.language === 'tr' ? contactInfo.whyTitleTr : contactInfo.whyTitleEn) : t('home.whyRiversideBurgers')}
          </Text>
          <View style={styles.titleUnderline} />
        </View>

        <View style={styles.bentoGrid}>
          {/* Row 1: Two Columns */}
          <View style={styles.bentoRow}>
            <Animated.View 
              entering={FadeInDown.delay(900).springify()} 
              style={[styles.bentoCardSmall, { backgroundColor: '#FDF2F2' }]}
            >
              <View style={styles.bentoIconBox}>
                <Ionicons name="timer-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.bentoCardTitle}>
                {contactInfo ? (i18n.language === 'tr' ? contactInfo.whyFeature1TitleTr : contactInfo.whyFeature1TitleEn) : t('home.fastDelivery')}
              </Text>
              <Text style={styles.bentoCardDesc}>{t('home.fastDeliveryBadge')}</Text>
            </Animated.View>

            <Animated.View 
              entering={FadeInDown.delay(1000).springify()} 
              style={[styles.bentoCardSmall, { backgroundColor: '#F0F7FF' }]}
            >
              <View style={styles.bentoIconBox}>
                <Ionicons name="shield-checkmark-outline" size={28} color="#007AFF" />
              </View>
              <Text style={styles.bentoCardTitle}>
                {contactInfo ? (i18n.language === 'tr' ? contactInfo.whyFeature2TitleTr : contactInfo.whyFeature2TitleEn) : t('home.qualityGuarantee')}
              </Text>
              <Text style={styles.bentoCardDesc}>{t('home.qualityGuaranteeBadge')}</Text>
            </Animated.View>
          </View>

          {/* Row 2: Full Width */}
          <Animated.View 
            entering={FadeInDown.delay(1100).springify()} 
            style={[styles.bentoCardLarge, { backgroundColor: '#FFF9F0' }]}
          >
            <View style={styles.bentoCardContent}>
              <View style={styles.bentoIconBox}>
                <Ionicons name="star-outline" size={32} color="#FF9500" />
              </View>
              <View style={styles.bentoTextGroup}>
                <Text style={styles.bentoCardTitle}>
                  {contactInfo ? (i18n.language === 'tr' ? contactInfo.whyFeature3TitleTr : contactInfo.whyFeature3TitleEn) : t('home.fiveStarSatisfaction')}
                </Text>
                <Text style={styles.bentoCardFullDesc}>
                  {contactInfo ? (i18n.language === 'tr' ? contactInfo.whyFeature3DescTr : contactInfo.whyFeature3DescEn) : t('home.fiveStarSatisfactionDesc')}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Footer bölümü (Footer section) */}
      <View style={styles.footer}>
        {/* About Us */}
        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>About Us</Text>
          <Text style={styles.footerText}>
            {contactInfo?.footerAbout || 'Riverside Burgers was established in 2019. Our passion for fresh and high quality burgers led us to creating our Signature Burger.'}
          </Text>
          {/* Social Media */}
          {contactInfo && (
            <View style={styles.socialContainer}>
              {contactInfo.facebook && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => Linking.openURL(contactInfo.facebook)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-facebook" size={24} color={Colors.white} />
                </TouchableOpacity>
              )}
              {contactInfo.instagram && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => Linking.openURL(contactInfo.instagram)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-instagram" size={24} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Locations - Yan yana (Side by side) */}
        {contactInfo && (
          <View style={styles.footerSection}>
            <Text style={styles.footerTitle}>Locations</Text>
            <View style={styles.locationsRow}>
              {contactInfo.address1 && contactInfo.phone1 && (
                <TouchableOpacity
                  style={styles.locationItem}
                  onPress={() => Linking.openURL(getPhoneLink(contactInfo.phone1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerText}>
                    {contactInfo.address1.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < contactInfo.address1.split('\n').length - 1 && '\n'}
                      </React.Fragment>
                    ))}
                    {'\n'}{contactInfo.phone1}
                  </Text>
                </TouchableOpacity>
              )}
              {contactInfo.address2 && contactInfo.phone2 && (
                <TouchableOpacity
                  style={styles.locationItem}
                  onPress={() => Linking.openURL(getPhoneLink(contactInfo.phone2))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerText}>
                    {contactInfo.address2.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < contactInfo.address2.split('\n').length - 1 && '\n'}
                      </React.Fragment>
                    ))}
                    {'\n'}{contactInfo.phone2}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {contactInfo.email && (
              <TouchableOpacity
                onPress={() => Linking.openURL(getEmailLink(contactInfo.email))}
                activeOpacity={0.7}
                style={styles.emailButton}
              >
                <Text style={styles.footerText}>{contactInfo.email}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Copyright */}
        <View style={styles.copyright}>
          <Text style={styles.copyrightText}>
            {contactInfo?.footerCopyright || '© 2024 Riverside Burgers. All rights reserved.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  brandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  greetingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  brandNameText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.black,
  },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  searchWrapper: {
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.black,
    fontWeight: '500',
  },
  filterInline: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
  },
  heroBanner: {
    marginHorizontal: 0,
    marginBottom: 0,
    position: 'relative',
  },
  locationFloat: {
    position: 'absolute',
    bottom: -15,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.black,
  },
  section: {
    padding: Spacing.lg,
  },
  modernSection: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modernSectionTitle: {
    fontSize: FontSizes.lg + 2,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modernCategoriesScroll: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modernCategoryCard: {
    alignItems: 'center',
    marginRight: Spacing.lg,
    width: 80,
  },
  modernCategoryIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  modernCategoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  loadingPlaceholder: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: Spacing.lg,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.large,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  featureIconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    ...Shadows.medium,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  featureText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  featureBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  featureBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.white,
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
  // Delivery Partners stilleri (Delivery Partners styles)
  deliveryPartnersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  deliveryPartnerCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  deliveryPartnerImage: {
    width: 100,
    height: 100,
  },
  // Elite Review Styles
  eliteReviewSection: {
    paddingVertical: Spacing.xl,
    backgroundColor: '#FAFBFD',
  },
  eliteSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    paddingHorizontal: Spacing.lg,
    marginBottom: 4,
  },
  eliteSectionSubtitle: {
    fontSize: 14,
    color: '#888',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  eliteReviewsScroll: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    paddingBottom: 10,
  },
  eliteReviewCard: {
    width: 300,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    marginRight: 16,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  eliteReviewText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 20,
  },
  eliteReviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 16,
  },
  eliteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  eliteReviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  eliteReviewDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyReviewsPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  // Bento Grid Styles (Why Riverside Burgers)
  bentoSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  bentoHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  bentoTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleUnderline: {
    width: 40,
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  bentoGrid: {
    gap: 12,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCardSmall: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  bentoCardLarge: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    ...Shadows.small,
  },
  bentoIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Shadows.small,
  },
  bentoCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  bentoCardDesc: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bentoTextGroup: {
    flex: 1,
  },
  bentoCardFullDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    textAlign: 'left',
  },

  // Öne Çıkan Ürünler stilleri (Featured Products styles)
  sectionSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'left',
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
    width: 220,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginRight: Spacing.md,
    overflow: 'hidden',
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  productImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#F0F0F0',
    resizeMode: 'cover',
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
    zIndex: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(230, 57, 70, 0.9)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    zIndex: 2,
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
    fontWeight: '800',
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
    fontWeight: '900',
    color: Colors.primary,
  },
  addToCartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.black,
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
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

  // Elite Review Styles
  eliteReviewSection: {
    paddingVertical: Spacing.xl,
    backgroundColor: '#FAFBFD',
  },
  eliteSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    paddingHorizontal: Spacing.lg,
    marginBottom: 4,
  },
  eliteSectionSubtitle: {
    fontSize: 14,
    color: '#888',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  eliteReviewsScroll: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.md,
    paddingBottom: 10,
  },
  eliteReviewCard: {
    width: 300,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    marginRight: 16,
    ...Shadows.small,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  eliteReviewText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 20,
  },
  eliteReviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 16,
  },
  eliteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  eliteReviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  eliteReviewDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyReviewsPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  // Bento Grid Styles (Why Riverside Burgers)
  bentoSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  bentoHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  bentoTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleUnderline: {
    width: 40,
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  bentoGrid: {
    gap: 12,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCardSmall: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  bentoCardLarge: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    ...Shadows.small,
  },
  bentoIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Shadows.small,
  },
  bentoCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  bentoCardDesc: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bentoTextGroup: {
    flex: 1,
  },
  bentoCardFullDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    textAlign: 'left',
  },

  // Elite About Section Styles
  eliteAboutSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    marginTop: 10,
  },
  aboutImageWrapper: {
    width: '100%',
    height: 300,
    borderRadius: 32,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  eliteAboutImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  aboutImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  estBadge: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Shadows.medium,
  },
  estText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.8)',
  },
  estYear: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  eliteAboutCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginTop: -60,
    marginHorizontal: 16,
    ...Shadows.large,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  eliteAboutTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  eliteAboutText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
    fontWeight: '500',
  },
  aboutSignatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  signatureLine: {
    width: 30,
    height: 1,
    backgroundColor: Colors.primary,
  },
  signatureText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default HomeScreen;

