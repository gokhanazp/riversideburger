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
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { MenuItem } from '../types';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { customizationService } from '../services/customizationService';
import { CategoryWithOptions, SelectedCustomization } from '../types/customization';

const { width } = Dimensions.get('window');

// Ürün detay ekranı (Product detail screen)
const ProductDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params as { item: MenuItem };
  const [quantity, setQuantity] = useState(1);
  const [customizations, setCustomizations] = useState<CategoryWithOptions[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedCustomization[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loadingCustomizations, setLoadingCustomizations] = useState(true);
  const addItem = useCartStore((state) => state.addItem);
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const favorite = isFavorite(item.id);

  // Animasyon değerleri (Animation values)
  const buttonScale = useSharedValue(1);

  // Özelleştirmeleri yükle (Load customizations)
  useEffect(() => {
    loadCustomizations();
  }, [item.id]);

  // Özelleştirmeleri getir (Fetch customizations)
  const loadCustomizations = async () => {
    try {
      setLoadingCustomizations(true);
      const data = await customizationService.getProductCustomizations(item.id);
      setCustomizations(data);
    } catch (error) {
      console.error('Error loading customizations:', error);
    } finally {
      setLoadingCustomizations(false);
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
          text1: '⚠️ Maksimum Seçim',
          text2: `Bu kategoriden en fazla ${categoryWithOptions.max_selections} seçenek seçebilirsiniz`,
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
      text1: '🍔 Sepete Eklendi!',
      text2: `${quantity}x ${item.name} sepetinize eklendi`,
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
                <Text style={styles.preparationTime}>⏱️ {item.preparationTime} dk</Text>
              )}
            </View>
            <Text style={styles.price}>₺{item.price.toFixed(2)}</Text>
          </View>

          {/* Açıklama (Description) */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>Açıklama</Text>
            <Text style={styles.description}>{item.description}</Text>
          </Animated.View>

          {/* İçindekiler (Ingredients) */}
          {item.ingredients && item.ingredients.length > 0 && (
            <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.section}>
              <Text style={styles.sectionTitle}>İçindekiler</Text>
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
              <Text style={styles.loadingText}>Seçenekler yükleniyor...</Text>
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
                        {categoryWithOptions.category.name}
                        {categoryWithOptions.is_required && (
                          <Text style={styles.requiredText}> *</Text>
                        )}
                      </Text>
                      {categoryWithOptions.max_selections && (
                        <Text style={styles.maxSelectionsText}>
                          En fazla {categoryWithOptions.max_selections} seçim
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
                                  {option.name}
                                </Text>
                              </View>
                              {option.price > 0 && (
                                <Text
                                  style={[
                                    styles.optionPrice,
                                    isSelected && styles.optionPriceSelected,
                                  ]}
                                >
                                  +₺{option.price.toFixed(2)}
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
                <Text style={styles.sectionTitle}>Özel Notlar</Text>
                <TextInput
                  style={styles.specialInstructionsInput}
                  placeholder="Özel bir isteğiniz var mı? (Opsiyonel)"
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

          {/* Miktar seçici (Quantity selector) */}
          <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>Miktar</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={decreaseQuantity}
                activeOpacity={0.7}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>

              <Animated.View
                key={quantity}
                entering={ZoomIn.duration(200)}
                style={styles.quantityDisplay}
              >
                <Text style={styles.quantityText}>{quantity}</Text>
              </Animated.View>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={increaseQuantity}
                activeOpacity={0.7}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>

      {/* Alt bar - Sepete ekle butonu (Bottom bar - Add to cart button) */}
      <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalPrice}>₺{calculateTotalPrice().toFixed(2)}</Text>
          {selectedOptions.length > 0 && (
            <Text style={styles.extraPriceText}>
              (Ekstra: ₺{(calculateExtraPrice() * quantity).toFixed(2)})
            </Text>
          )}
        </View>

        <Animated.View style={[animatedButtonStyle, { flex: 2 }]}>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={handleAddToCart}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={24} color={Colors.white} style={styles.cartIcon} />
            <Text style={styles.addToCartButtonText}>Sepete Ekle</Text>
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
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.large,
  },
  totalContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  totalLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  totalPrice: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
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
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
    elevation: 8,
  },
  cartIcon: {
    marginRight: Spacing.sm,
  },
  addToCartButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
});

export default ProductDetailScreen;

