import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 400;

// Banner verileri (Banner data)
const BANNERS = [
  {
    id: '1',
    title: 'Riverside Classic',
    subtitle: 'En sevilen burgerimiz',
    description: '200gr dana eti, cheddar, özel sos',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    discount: '%20 İndirim',
  },
  {
    id: '2',
    title: 'Double Riverside',
    subtitle: 'Çift lezzet',
    description: '2x200gr dana eti, çift cheddar',
    image: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=800',
    discount: 'Yeni',
  },
  {
    id: '3',
    title: 'BBQ Bacon Burger',
    subtitle: 'Barbekü tutkunları için',
    description: 'Çıtır bacon, barbekü sosu',
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800',
    discount: 'Özel',
  },
];

interface BannerSliderProps {
  onBannerPress?: (bannerId: string) => void;
}

const BannerSlider: React.FC<BannerSliderProps> = ({ onBannerPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Otomatik kaydırma (Auto scroll)
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % BANNERS.length;
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setActiveIndex(nextIndex);
    }, 5000); // 5 saniyede bir değiş (Change every 5 seconds)

    return () => clearInterval(interval);
  }, [activeIndex]);

  // Banner item render (Banner item render)
  const renderBanner = ({ item }: { item: typeof BANNERS[0] }) => (
    <TouchableOpacity
      style={styles.bannerContainer}
      onPress={() => onBannerPress?.(item.id)}
      activeOpacity={0.9}
    >
      {/* Arka plan görseli (Background image) */}
      <Image source={{ uri: item.image }} style={styles.bannerImage} />
      
      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      />
      
      {/* İçerik (Content) */}
      <View style={styles.bannerContent}>
        {/* İndirim badge'i (Discount badge) */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{item.discount}</Text>
        </View>
        
        {/* Başlık ve açıklama (Title and description) */}
        <View style={styles.textContainer}>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
          
          {/* Sipariş butonu (Order button) */}
          <TouchableOpacity style={styles.orderButton} activeOpacity={0.8}>
            <Text style={styles.orderButtonText}>Sipariş Ver</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Pagination dots render (Pagination dots render)
  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      {BANNERS.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.paginationDot,
              {
                width: dotWidth,
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={BANNERS}
        renderItem={renderBanner}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / width
          );
          setActiveIndex(index);
        }}
        scrollEventThrottle={16}
      />
      {renderPagination()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: BANNER_HEIGHT,
    marginBottom: Spacing.lg,
  },
  bannerContainer: {
    width: width,
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  bannerContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.xl,
  },
  discountBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  discountText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  textContainer: {
    gap: Spacing.xs,
  },
  subtitle: {
    color: Colors.white,
    fontSize: FontSizes.md,
    opacity: 0.9,
  },
  title: {
    color: Colors.white,
    fontSize: FontSizes.xxl + 8,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  description: {
    color: Colors.white,
    fontSize: FontSizes.md,
    opacity: 0.8,
    marginBottom: Spacing.md,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
    gap: Spacing.sm,
  },
  orderButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: Spacing.lg,
    alignSelf: 'center',
    gap: Spacing.xs,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
});

export default BannerSlider;

