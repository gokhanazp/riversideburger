import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
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

const { width } = Dimensions.get('window');

// Ürün detay ekranı (Product detail screen)
const ProductDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params as { item: MenuItem };
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const favorite = isFavorite(item.id);

  // Animasyon değerleri (Animation values)
  const buttonScale = useSharedValue(1);

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

  // Sepete ekle (Add to cart)
  const handleAddToCart = () => {
    // Buton animasyonu (Button animation)
    buttonScale.value = withSpring(0.95, {}, () => {
      buttonScale.value = withSpring(1);
    });

    // Seçilen miktarda sepete ekle (Add selected quantity to cart)
    for (let i = 0; i < quantity; i++) {
      addItem(item);
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

          {/* İçindekiler (Ingredients) - Örnek (Example) */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>İçindekiler</Text>
            <View style={styles.ingredientsContainer}>
              <View style={styles.ingredientTag}>
                <Text style={styles.ingredientText}>🥬 Marul</Text>
              </View>
              <View style={styles.ingredientTag}>
                <Text style={styles.ingredientText}>🍅 Domates</Text>
              </View>
              <View style={styles.ingredientTag}>
                <Text style={styles.ingredientText}>🧀 Peynir</Text>
              </View>
              <View style={styles.ingredientTag}>
                <Text style={styles.ingredientText}>🥒 Turşu</Text>
              </View>
            </View>
          </Animated.View>

          {/* Miktar seçici (Quantity selector) */}
          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.section}>
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
          <Text style={styles.totalPrice}>₺{(item.price * quantity).toFixed(2)}</Text>
        </View>

        <Animated.View style={animatedButtonStyle}>
            <TouchableOpacity
            style={styles.addToCartButton}
            onPress={handleAddToCart}
            activeOpacity={0.8}
          >
            <Text style={styles.addToCartButtonText}>Sepete Ekle 🛒</Text>
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
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
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
  addToCartButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
  },
  addToCartButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

export default ProductDetailScreen;

