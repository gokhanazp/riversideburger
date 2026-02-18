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
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
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

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = width * 1.1;

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

  const buttonScale = useSharedValue(1);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Animated Header Styling
  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT * 0.5, HERO_HEIGHT * 0.8],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      backgroundColor: Colors.white,
      borderBottomWidth: opacity > 0.9 ? 1 : 0,
    };
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [HERO_HEIGHT * 0.8, HERO_HEIGHT * 1],
        [0, 1],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [HERO_HEIGHT * 0.8, HERO_HEIGHT * 1],
            [10, 0],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  // True Parallax & Scale Effect
  const imageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(
            scrollY.value,
            [-HERO_HEIGHT, 0],
            [2.5, 1],
            Extrapolation.CLAMP
          ),
        },
        {
          translateY: interpolate(
            scrollY.value,
            [0, HERO_HEIGHT],
            [0, HERO_HEIGHT * 0.4],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const imageOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [0, HERO_HEIGHT * 0.8],
        [0, 0.4],
        Extrapolation.CLAMP
      ),
    };
  });

  useEffect(() => {
    if (item?.id) {
      loadCustomizations();
      loadReviews();
    }
  }, [item?.id]);

  const loadCustomizations = async () => {
    try {
      setLoadingCustomizations(true);
      const specificOptions = await customizationService.getProductSpecificOptions(item.id);
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

      setCustomizations(Object.values(grouped));
    } catch (error) {
      console.error('Error loading customizations:', error);
    } finally {
      setLoadingCustomizations(false);
    }
  };

  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      const [reviewsData, ratingData] = await Promise.all([
        getProductReviews(item.id),
        getProductRating(item.id),
      ]);
      setReviews(reviewsData);
      setRating(ratingData);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const calculateTotalPrice = () => {
    const extraPrice = selectedOptions.reduce((sum, sel) => sum + sel.option.price, 0);
    return (item.price + extraPrice) * quantity;
  };

  const toggleOption = (categoryWithOptions: CategoryWithOptions, optionId: string) => {
    const isSelected = selectedOptions.some((sel) => sel.option.id === optionId);

    if (isSelected) {
      setSelectedOptions((prev) => prev.filter((sel) => sel.option.id !== optionId));
    } else {
      const categorySelections = selectedOptions.filter(
        (sel) => sel.category.id === categoryWithOptions.category.id
      );

      if (categoryWithOptions.max_selections && categorySelections.length >= categoryWithOptions.max_selections) {
        Toast.show({
          type: 'error',
          text1: t('product.maxSelection'),
          position: 'top',
          topOffset: 60,
        });
        return;
      }

      const option = categoryWithOptions.options.find((opt) => opt.id === optionId);
      if (option) {
        setSelectedOptions((prev) => [...prev, { option, category: categoryWithOptions.category }]);
      }
    }
  };

  const handleAddToCart = () => {
    const customizationsData = selectedOptions.map(sel => ({
      option_id: sel.option.id,
      option_name: sel.option.name,
      option_price: sel.option.price,
    }));

    for (let i = 0; i < quantity; i++) {
      addItem(item, customizationsData.length > 0 ? customizationsData : undefined, specialInstructions || undefined);
    }

    Toast.show({
      type: 'success',
      text1: '🍔 ' + t('cart.addedToCart'),
      position: 'top',
      topOffset: 60,
    });

    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Animated Header */}
      <Animated.View style={[styles.headerFloating, headerStyle]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={Colors.black} />
          </TouchableOpacity>
          <Animated.Text style={[styles.headerTitle, headerTitleStyle]} numberOfLines={1}>
            {item.name}
          </Animated.Text>
          <TouchableOpacity style={styles.circleBtn} onPress={() => toggleFavorite(item)}>
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={24}
              color={favorite ? Colors.primary : Colors.black}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        onScroll={scrollHandler} 
        scrollEventThrottle={16} 
        showsVerticalScrollIndicator={false}
      >
        {/* Parallax Image Section */}
        <View style={styles.heroContainer}>
          <Animated.View style={[styles.imageWrapper, imageStyle]}>
            <Image source={{ uri: item.image }} style={styles.heroImage} resizeMode="cover" />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, imageOverlayStyle]} />
          </Animated.View>
          
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={styles.topGradient} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bottomGradient} />

          <View style={styles.heroControls}>
            <TouchableOpacity style={styles.glassBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.glassBtn} onPress={() => toggleFavorite(item)}>
              <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? Colors.primary : Colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroIndicator}>
            <View style={styles.dotsRow}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <View style={styles.trendingBadge}>
              <Ionicons name="flame" size={12} color={Colors.white} />
              <Text style={styles.trendingText}>TRENDING</Text>
            </View>
          </View>
        </View>

        {/* Content Card */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.contentCard}>
          <View style={styles.dragHandle} />
          
          <View style={styles.mainInfo}>
            <View style={styles.titleArea}>
              <Text style={styles.productName}>{item.name}</Text>
              <View style={styles.ratingSummary}>
                <View style={styles.scoreBadge}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={styles.scoreText}>{rating?.average_rating.toFixed(1) || '4.9'}</Text>
                </View>
                <Text style={styles.reviewVolume}>({reviews.length || 124} {t('reviews.title')})</Text>
              </View>
            </View>
            <View style={styles.priceBadge}>
              <Text style={styles.currencySymbol}>$</Text>
              <Text style={styles.priceValue}>{item.price.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>15-20 min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>450 kcal</Text>
            </View>
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionHeading}>{t('product.description')}</Text>
            <Text style={styles.descriptionText}>{item.description}</Text>
          </View>

          {customizations.map((cat, idx) => (
            <View key={cat.category.id} style={styles.customSection}>
              <Text style={styles.sectionHeading}>{i18n.language === 'en' ? (cat.category.name_en || cat.category.name) : cat.category.name}</Text>
              <View style={styles.optionsList}>
                {cat.options.map((opt) => {
                  const selected = selectedOptions.some(s => s.option.id === opt.id);
                  return (
                    <TouchableOpacity 
                      key={opt.id} 
                      style={[styles.optionItem, selected && styles.optionItemSelected]} 
                      onPress={() => toggleOption(cat, opt.id)}
                    >
                      <View style={styles.optionInfo}>
                        <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                          {selected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                        </View>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
                          {i18n.language === 'en' ? (opt.name_en || opt.name) : opt.name}
                        </Text>
                      </View>
                      {opt.price > 0 && <Text style={styles.optionExtra}>+{formatPrice(opt.price)}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={styles.instructionSection}>
            <Text style={styles.sectionHeading}>{t('product.specialInstructions')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('product.specialInstructionsPlaceholder')}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
            />
          </View>
          
          <View style={{ height: 100 }} />
        </Animated.View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.footer}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']} style={styles.footerGradient} />
        <View style={styles.actionRow}>
          <View style={styles.counter}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
              <Ionicons name="remove" size={20} color={Colors.black} />
            </TouchableOpacity>
            <Text style={styles.counterText}>{quantity}</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => setQuantity(quantity + 1)}>
              <Ionicons name="add" size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.addBtnGradient}>
              <View style={styles.addBtnContent}>
                <Text style={styles.addBtnText}>{t('menu.addToCart')}</Text>
                <View style={styles.addBtnSpacer} />
                <Text style={styles.addBtnPrice}>{formatPrice(calculateTotalPrice())}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  headerFloating: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, paddingTop: 50, zIndex: 100, borderBottomColor: Colors.border },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', ...Shadows.small },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.black, flex: 1, textAlign: 'center' },

  heroContainer: { width: width, height: HERO_HEIGHT, backgroundColor: '#000' },
  imageWrapper: { width: width, height: HERO_HEIGHT },
  heroImage: { width: '100%', height: '100%' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
  heroControls: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  glassBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroIndicator: { position: 'absolute', bottom: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  activeDot: { width: 20, backgroundColor: Colors.white },
  trendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  trendingText: { color: Colors.white, fontSize: 10, fontWeight: '900' },

  contentCard: { marginTop: -40, backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 100 },
  dragHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  mainInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titleArea: { flex: 1 },
  productName: { fontSize: 28, fontWeight: '900', color: Colors.black, marginBottom: 8 },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF9E5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  scoreText: { fontSize: 13, fontWeight: '700', color: '#B8860B' },
  reviewVolume: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  priceBadge: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  currencySymbol: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  priceValue: { fontSize: 24, fontWeight: '900', color: Colors.primary },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  statDivider: { width: 1, height: 14, backgroundColor: Colors.border },

  descriptionSection: { marginBottom: 32 },
  sectionHeading: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 16 },
  descriptionText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24 },

  customSection: { marginBottom: 32 },
  optionsList: { gap: 12 },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  optionItemSelected: { borderColor: Colors.primary, backgroundColor: '#FFF5F5' },
  optionInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  optionLabelActive: { color: Colors.primary },
  optionExtra: { fontSize: 15, fontWeight: '700', color: Colors.primary },

  instructionSection: { marginBottom: 20 },
  textInput: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, fontSize: 15, minHeight: 120, textAlignVertical: 'top', color: Colors.text, borderWidth: 1, borderColor: Colors.border },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 40 },
  footerGradient: { position: 'absolute', top: -60, left: 0, right: 0, height: 60 },
  actionRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  counter: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 6, borderRadius: 30, ...Shadows.small },
  counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', ...Shadows.small },
  counterText: { fontSize: 18, fontWeight: '800', marginHorizontal: 16, minWidth: 20, textAlign: 'center' },
  addBtn: { flex: 1, height: 60, borderRadius: 30, overflow: 'hidden', ...Shadows.large },
  addBtnGradient: { flex: 1, paddingHorizontal: 24 },
  addBtnContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  addBtnSpacer: { width: 12 },
  addBtnPrice: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)', paddingLeft: 12 },
});

export default ProductDetailScreen;
