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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 400;

// Banner tipi (Banner type)
interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  button_text?: string;
  button_link?: string;
  order_index: number;
  is_active: boolean;
}

interface BannerSliderProps {
  onBannerPress?: (banner: Banner) => void;
}


const BannerSlider: React.FC<BannerSliderProps> = ({ onBannerPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(width);


  // Banner'ları database'den getir (Fetch banners from database)
  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching banners...');

      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }

      console.log('✅ Banners fetched:', data?.length || 0);
      setBanners(data || []);
    } catch (error: any) {
      console.error('❌ Error fetching banners:', error);
      // Hata durumunda boş array
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  // Sayfa değiştirme fonksiyonu (Change page function)
  const scrollIndex = (index: number) => {
    if (banners.length === 0 || !flatListRef.current) return;
    try {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
      });
      setActiveIndex(index);
    } catch (error) {
      console.log('Scroll error:', error);
    }
  };

  const handlePrev = () => {
    const prevIndex = activeIndex === 0 ? banners.length - 1 : activeIndex - 1;
    scrollIndex(prevIndex);
  };

  const handleNext = () => {
    const nextIndex = (activeIndex + 1) % banners.length;
    scrollIndex(nextIndex);
  };

  // Otomatik kaydırma (Auto scroll)
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      handleNext();
    }, 5000); // 5 saniyede bir değiş (Change every 5 seconds)

    return () => clearInterval(interval);
  }, [activeIndex, banners.length]);


  // Banner item render (Banner item render)
  const renderBanner = ({ item }: { item: Banner }) => (
    <TouchableOpacity
      style={[styles.bannerContainer, { width: containerWidth }]}
      onPress={() => onBannerPress?.(item)}
      activeOpacity={0.9}
    >

      {/* Arka plan görseli (Background image) */}
      <Image source={{ uri: item.image_url }} style={styles.bannerImage} />

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      />

      {/* İçerik (Content) */}
      <View style={styles.bannerContent}>
        {/* Başlık ve açıklama (Title and description) */}
        <View style={styles.textContainer}>
          {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
          <Text style={styles.title}>{item.title}</Text>

          {/* Sipariş butonu (Order button) - Tıklanabilir alan sorununu çözmek için içeriği View içine aldık */}
          {item.button_text && (
            <View style={styles.orderButtonContainer}>
              <TouchableOpacity
                style={styles.orderButton}
                activeOpacity={0.8}
                onPress={() => onBannerPress?.(item)}
              >
                <Text style={styles.orderButtonText}>{item.button_text}</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </TouchableOpacity>

  );

  // Pagination dots render (Pagination dots render)
  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      {banners.map((_, index) => {
        const inputRange = [
          (index - 1) * containerWidth,
          index * containerWidth,
          (index + 1) * containerWidth,
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
          <TouchableOpacity
            key={index}
            onPress={() => scrollIndex(index)}
            activeOpacity={0.7}
            style={styles.dotTouchArea}
          >
            <Animated.View
              style={[
                styles.paginationDot,
                {
                  width: dotWidth,
                  opacity,
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );


  // Yükleniyor durumu (Loading state)
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Banner yoksa gösterme (Don't show if no banners)
  if (banners.length === 0) {
    return null;
  }

  return (
    <View 
      style={styles.container} 
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        snapToInterval={containerWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: containerWidth,
          offset: containerWidth * index,
          index,
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / containerWidth
          );
          setActiveIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {/* Navigasyon Okları (Navigation Arrows) */}
      {banners.length > 1 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowButtonLeft]}
            onPress={handlePrev}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowButtonRight]}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {renderPagination()}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    height: BANNER_HEIGHT,
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  dotTouchArea: {
    padding: Spacing.xs,
  },

  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  arrowButtonLeft: {
    left: Spacing.md,
  },
  arrowButtonRight: {
    right: Spacing.md,
  },
  orderButtonContainer: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
});


export default BannerSlider;

