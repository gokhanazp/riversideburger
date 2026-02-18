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
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { supabase } from '../lib/supabase';
import reanimated, { FadeInDown } from 'react-native-reanimated';

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

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      console.error('Error fetching banners:', error);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleNext = () => {
    const nextIndex = (activeIndex + 1) % banners.length;
    scrollIndex(nextIndex);
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeIndex, banners.length]);

  const renderBanner = ({ item }: { item: Banner }) => (
    <View style={[styles.bannerWrapper, { width: containerWidth }]}>
      <TouchableOpacity
        style={styles.bannerContainer}
        onPress={() => onBannerPress?.(item)}
        activeOpacity={0.9}
      >
        <Image source={{ uri: item.image_url }} style={styles.bannerImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          style={styles.gradient}
        />
        <View style={styles.bannerContent}>
          <View style={styles.textContainer}>
            {item.subtitle && (
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            )}
            <Text style={styles.title}>{item.title}</Text>
            {item.button_text && (
              <View style={styles.btnContainer}>
                 <Text style={styles.orderButtonText}>{item.button_text}</Text>
                 <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      {banners.map((_, index) => {
        const opacity = scrollX.interpolate({
          inputRange: [
            (index - 1) * containerWidth,
            index * containerWidth,
            (index + 1) * containerWidth,
          ],
          outputRange: [0.4, 1, 0.4],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[styles.paginationDot, { opacity }]}
          />
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (banners.length === 0) return null;

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
        showsHorizontalScrollIndicator={false}
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
      {renderPagination()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: BANNER_HEIGHT,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerWrapper: {
    paddingHorizontal: 16,
    height: BANNER_HEIGHT,
  },
  bannerContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EEE',
    ...Shadows.small,
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
    height: '100%',
  },
  bannerContent: {
    position: 'absolute',
    left: 24,
    bottom: 32,
    right: 24,
  },
  textContainer: {
    gap: 8,
  },
  subtitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    marginBottom: 8,
  },
  btnContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  paginationContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 12,
    right: 32,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
});

export default BannerSlider;
