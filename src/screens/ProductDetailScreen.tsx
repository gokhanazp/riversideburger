import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
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
import { customizationService } from '../services/customizationService';
import { CategoryWithOptions, SelectedCustomization } from '../types/customization';
import { getProductReviews, getProductRating } from '../services/reviewService';
import { Review, ProductRating } from '../types/database.types';
import { formatPrice } from '../services/currencyService';

const { width } = Dimensions.get('window');

// Ürün detay ekranı (Product detail screen)
const ProductDetailScreen = ({ route, navigation }: any) => {
  const { t, i18n } = useTranslation();
  const { item } = route.params as { item: MenuItem };
  const [quantity, setQuantity] = useState(1);
  const [customizations, setCustomizations] = useState<CategoryWithOptions[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedCustomization[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loadingCustomizations, setLoadingCustomizations] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<ProductRating | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const addItem = useCartStore((state) => state.addItem);
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const favorite = isFavorite(item.id);

  // Animasyon değerleri (Animation values)
  const buttonScale = useSharedValue(1);

  // Özelleştirmeleri yükle (Load customizations)
  useEffect(() => {
    loadCustomizations();
    loadReviews();
  }, [item.id]);

  // Özelleştirmeleri getir (Fetch customizations)
  const loadCustomizations = async () => {
    try {
      setLoadingCustomizations(true);

      console.log('🔍 Loading customizations for product:', item.id, item.name);

      // Yeni sistem: Ürün bazlı spesifik seçenekleri getir
      const specificOptions = await customizationService.getProductSpecificOptions(item.id);

      console.log('📦 Specific options fetched:', specificOptions.length, 'options');
      console.log('📋 Options data:', JSON.stringify(specificOptions, null, 2));

      // Kategorilere göre grupla (Group by categories)
      const grouped: { [key: string]: CategoryWithOptions } = {};

      specificOptions.forEach((opt: any) => {
        const categoryId = opt.option.category.id;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {
            category: opt.option.category,
            options: [],
            is_required: opt.is_required,
            max_selections: undefined,
          };
        }

        grouped[categoryId].options.push(opt.option);
      });

      const data = Object.values(grouped);
      console.log('✅ Customizations grouped into', data.length, 'categories');
      setCustomizations(data);
    } catch (error) {
      console.error('❌ Error loading customizations:', error);
    } finally {
      setLoadingCustomizations(false);
    }
  };

  // Yorumları getir (Fetch reviews)
  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      console.log('🔍 Loading reviews for product:', item.id);
      const [reviewsData, ratingData] = await Promise.all([
        getProductReviews(item.id),
        getProductRating(item.id),
      ]);
      console.log('✅ Reviews loaded:', reviewsData.length, 'reviews');
      console.log('✅ Rating data:', ratingData);
      setReviews(reviewsData);
      setRating(ratingData);
    } catch (error) {
      console.error('❌ Error loading reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Buton animasyon stili (Button animation style)
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Miktar artır (Increase quantity)
  const increaseQuantity = () => {
    setQuantity((prev) => prev + 1);
  };

  // Miktar azalt (Decrease quantity)
  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  // Seçenek toggle (Toggle option)
  const toggleOption = (categoryWithOptions: CategoryWithOptions, optionId: string, dynamicOption?: any) => {
    // Dinamik seçenek (malzeme çıkarma) veya normal seçenek
    // (Dynamic option - ingredient removal - or normal option)
    const option = dynamicOption || categoryWithOptions.options.find((opt) => opt.id === optionId);
    if (!option) return;

    const isSelected = selectedOptions.some((sel) => sel.option.id === optionId);

    if (isSelected) {
      // Seçimi kaldır (Remove selection)
      setSelectedOptions((prev) => prev.filter((sel) => sel.option.id !== optionId));
    } else {
      // Maksimum seçim kontrolü (Check max selections)
      const categorySelections = selectedOptions.filter(
        (sel) => sel.category.id === categoryWithOptions.category.id
      );

      if (
        categoryWithOptions.max_selections &&
        categorySelections.length >= categoryWithOptions.max_selections
      ) {
        Toast.show({
          type: 'error',
          text1: '⚠️ ' + t('product.maxSelection'),
          text2: t('product.maxSelectionDesc', { max: categoryWithOptions.max_selections }),
          position: 'bottom',
          visibilityTime: 2000,
        });
        return;
      }

      // Seçimi ekle (Add selection)
      setSelectedOptions((prev) => [
        ...prev,
        {
          option,
          category: categoryWithOptions.category,
        },
      ]);
    }
  };

  // Toplam ekstra fiyat hesapla (Calculate total extra price)
  const calculateExtraPrice = () => {
    return selectedOptions.reduce((sum, sel) => sum + sel.option.price, 0);
  };

  // Toplam fiyat hesapla (Calculate total price)
  const calculateTotalPrice = () => {
    const basePrice = item.price * quantity;
    const extraPrice = calculateExtraPrice() * quantity;
    return basePrice + extraPrice;
  };

  // Sepete ekle (Add to cart)
  const handleAddToCart = () => {
    // Buton animasyonu (Button animation)
    buttonScale.value = withSpring(0.95, {}, () => {
      buttonScale.value = withSpring(1);
    });

    // Özelleştirmeleri hazırla (Prepare customizations)
    const customizationsData = selectedOptions.map(sel => ({
      option_id: sel.option.id,
      option_name: sel.option.name,
      option_price: sel.option.price,
    }));

    // Seçilen miktarda sepete ekle (Add selected quantity to cart)
    for (let i = 0; i < quantity; i++) {
      addItem(
        item,
        customizationsData.length > 0 ? customizationsData : undefined,
        specialInstructions || undefined
      );
    }

    // Toast bildirimi göster (Show toast notification)
    Toast.show({
      type: 'success',
      text1: '🍔 ' + t('cart.addedToCart'),
      text2: t('product.addedToCartDesc', { quantity, name: item.name }),
      position: 'bottom',
      visibilityTime: 2000,
      bottomOffset: 100,
    });

    // Menü ekranına geri dön (Go back to menu screen)
    setTimeout(() => navigation.goBack(), 500);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Ürün görseli (Product image) */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image }} style={styles.image} />

          {/* Geri butonu (Back button) */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>

          {/* Favori butonu (Favorite button) */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => {
              toggleFavorite(item);
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
              size={28}
              color={favorite ? Colors.primary : Colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Ürün bilgileri (Product information) */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.content}>
          {/* Başlık ve fiyat (Title and price) */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.name}>{item.name}</Text>
              {item.preparationTime && (
                <Text style={styles.preparationTime}>⏱️ {item.preparationTime} {t('product.minutes')}</Text>
              )}
            </View>
            <Text style={styles.price}>
              {formatPrice(item.price)}
            </Text>
          </View>

          {/* Açıklama (Description) */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('product.description')}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </Animated.View>

          {/* İçindekiler (Ingredients) */}
          {item.ingredients && item.ingredients.length > 0 && (
            <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('product.ingredients')}</Text>
              <View style={styles.ingredientsContainer}>
                {item.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientTag}>
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Özelleştirme seçenekleri (Customization options) */}
          {loadingCustomizations ? (
            <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.section}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>{t('common.loading')}...</Text>
            </Animated.View>
          ) : customizations.length > 0 ? (
            <>
              {customizations.map((categoryWithOptions, catIndex) => {
                // "Çıkarılacak Malzemeler" kategorisi için ürünün kendi malzemelerini kullan
                // (Use product's own ingredients for "Remove Ingredients" category)
                const isRemoveCategory = categoryWithOptions.category.name === 'Çıkarılacak Malzemeler';
                const displayOptions = isRemoveCategory && item.ingredients && item.ingredients.length > 0
                  ? item.ingredients.map((ingredient, idx) => ({
                      id: `ingredient-${idx}`,
                      category_id: categoryWithOptions.category.id,
                      name: `${ingredient} Çıkar`,
                      name_en: `Remove ${ingredient}`,
                      description: null,
                      price: 0,
                      is_active: true,
                      display_order: idx,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }))
                  : categoryWithOptions.options;

                // Eğer "Çıkarılacak Malzemeler" kategorisiyse ve ürünün malzemesi yoksa, gösterme
                // (If it's "Remove Ingredients" category and product has no ingredients, don't show)
                if (isRemoveCategory && (!item.ingredients || item.ingredients.length === 0)) {
                  return null;
                }

                return (
                  <Animated.View
                    key={categoryWithOptions.category.id}
                    entering={FadeInDown.delay(500 + catIndex * 100).duration(600)}
                    style={styles.section}
                  >
                    <View style={styles.categoryHeader}>
                      <Text style={styles.sectionTitle}>
                        {i18n.language === 'en'
                          ? (categoryWithOptions.category.name_en || categoryWithOptions.category.name)
                          : categoryWithOptions.category.name}
                        {categoryWithOptions.is_required && (
                          <Text style={styles.requiredText}> *</Text>
                        )}
                      </Text>
                      {categoryWithOptions.max_selections && (
                        <Text style={styles.maxSelectionsText}>
                          {t('product.maxSelectionsLabel', { max: categoryWithOptions.max_selections })}
                        </Text>
                      )}
                    </View>

                    <View style={styles.optionsContainer}>
                      {displayOptions.map((option) => {
                        const isSelected = selectedOptions.some(
                          (sel) => sel.option.id === option.id
                        );

                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              styles.optionCard,
                              isSelected && styles.optionCardSelected,
                            ]}
                            onPress={() => toggleOption(categoryWithOptions, option.id, isRemoveCategory ? option : undefined)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.optionContent}>
                              <View style={styles.optionLeft}>
                                <View
                                  style={[
                                    styles.optionCheckbox,
                                    isSelected && styles.optionCheckboxSelected,
                                  ]}
                                >
                                  {isSelected && (
                                    <Ionicons name="checkmark" size={16} color={Colors.white} />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.optionName,
                                    isSelected && styles.optionNameSelected,
                                  ]}
                                >
                                  {i18n.language === 'en'
                                    ? (option.name_en || option.name)
                                    : option.name}
                                </Text>
                              </View>
                              {option.price > 0 && (
                                <Text
                                  style={[
                                    styles.optionPrice,
                                    isSelected && styles.optionPriceSelected,
                                  ]}
                                >
                                  +{formatPrice(option.price)}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Animated.View>
                );
              })}

              {/* Özel notlar (Special instructions) */}
              <Animated.View
                entering={FadeInDown.delay(500 + customizations.length * 100).duration(600)}
                style={styles.section}
              >
                <Text style={styles.sectionTitle}>{t('product.specialInstructions')}</Text>
                <TextInput
                  style={styles.specialInstructionsInput}
                  placeholder={t('product.specialInstructionsPlaceholder')}
                  placeholderTextColor="#999"
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Animated.View>
            </>
          ) : null}

          {/* Yorumlar ve Değerlendirmeler (Reviews and Ratings) */}
          {loadingReviews ? (
            <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('reviews.title')}</Text>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>{t('common.loading')}...</Text>
            </Animated.View>
          ) : reviews.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.section}>
              <View style={styles.reviewsHeader}>
                <Text style={styles.sectionTitle}>{t('reviews.title')}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {rating?.average_rating.toFixed(1) || '0.0'} ({reviews.length})
                  </Text>
                </View>
              </View>

              {reviews.slice(0, 3).map((review, index) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewUserName}>
                      {review.user?.full_name || t('common.user')}
                    </Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={star <= review.rating ? '#FFD700' : '#CCC'}
                        />
                      ))}
                    </View>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment} numberOfLines={3}>
                      {review.comment}
                    </Text>
                  )}
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
              ))}

              {reviews.length > 3 && (
                <Text style={styles.moreReviewsText}>
                  {t('reviews.moreReviews', { count: reviews.length - 3 })}
                </Text>
              )}
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Alt bar - Miktar ve Sepete ekle butonu (Bottom bar - Quantity and Add to cart button) */}
      <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.bottomBar}>
        {/* Miktar seçici (Quantity selector) */}
        <View style={styles.bottomQuantityContainer}>
          <TouchableOpacity
            style={styles.bottomQuantityButton}
            onPress={decreaseQuantity}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color={Colors.primary} />
          </TouchableOpacity>

          <Animated.View
            key={quantity}
            entering={ZoomIn.duration(200)}
            style={styles.bottomQuantityDisplay}
          >
            <Text style={styles.bottomQuantityText}>{quantity}</Text>
          </Animated.View>

          <TouchableOpacity
            style={styles.bottomQuantityButton}
            onPress={increaseQuantity}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Toplam (Total) */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>{t('cart.total')}</Text>
          <Text style={styles.totalPrice}>
            {formatPrice(calculateTotalPrice())}
          </Text>
        </View>

        {/* Sepete Ekle Butonu (Add to Cart Button) */}
        <Animated.View style={[animatedButtonStyle, styles.addToCartButtonContainer]}>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={handleAddToCart}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={20} color={Colors.white} style={styles.cartIcon} />
            <Text style={styles.addToCartButtonText}>{t('menu.addToCart')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageContainer: {
    width: width,
    height: width * 0.8,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 50,
    right: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  titleContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  name: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  preparationTime: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  price: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  ingredientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  ingredientTag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ingredientText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quantityButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  quantityDisplay: {
    minWidth: 60,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.large,
  },
  // Bottom bar miktar seçici (Bottom bar quantity selector)
  bottomQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    gap: 4,
  },
  bottomQuantityButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottomQuantityDisplay: {
    minWidth: 32,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  bottomQuantityText: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  // Toplam container (Total container)
  totalContainer: {
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  totalLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  totalPrice: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  // Sepete ekle butonu container (Add to cart button container)
  addToCartButtonContainer: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  extraPriceText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  requiredText: {
    color: Colors.primary,
    fontSize: FontSizes.lg,
  },
  maxSelectionsText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5F5',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  optionCheckboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionName: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    flex: 1,
  },
  optionNameSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  optionPrice: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  optionPriceSelected: {
    color: Colors.primary,
  },
  specialInstructionsInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  addToCartButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
  },
  cartIcon: {
    marginRight: 6,
  },
  addToCartButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.white,
  },
  // Yorum stilleri (Review styles)
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  ratingText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.xs,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  reviewUserName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  reviewDate: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  moreReviewsText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
});

export default ProductDetailScreen;

