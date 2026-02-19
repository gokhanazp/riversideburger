import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, FontSizes, Shadows } from '../constants/theme';
import { useFavoritesStore } from '../store/favoritesStore';
import { useCartStore } from '../store/cartStore';
import { MenuItem as MenuItemType } from '../types';
import { formatPrice } from '../services/currencyService';

const { width } = Dimensions.get('window');

const FavoritesScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const addItem = useCartStore((state) => state.addItem);

  const FavoriteCard = ({ item }: { item: MenuItemType }) => (
    <Animated.View entering={ZoomIn} style={styles.favoriteCardWrapper}>
      <TouchableOpacity
        style={styles.modernFavoriteCard}
        onPress={() => navigation.navigate('ProductDetail', { item })}
        activeOpacity={0.9}
      >
        <Image source={{ uri: item.image }} style={styles.favoriteImage} />
        
        <TouchableOpacity
          style={styles.favoriteBadge}
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(item);
            Toast.show({
              type: 'info',
              text1: `💔 ${t('favorites.removedFromFavorites')}`,
              text2: item.name,
              position: 'bottom',
              visibilityTime: 1500,
              bottomOffset: 100,
            });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={18} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.favoriteInfo}>
          <Text style={styles.favoriteName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.favoriteFooter}>
            <Text style={styles.favoritePrice}>{formatPrice(item.price)}</Text>
            <TouchableOpacity
              style={styles.favoriteAddBtn}
              onPress={(e) => {
                e.stopPropagation();
                addItem(item);
                Toast.show({
                  type: 'success',
                  text1: `🍔 ${t('profile.addedToCart')}`,
                  text2: item.name,
                  position: 'bottom',
                  visibilityTime: 1500,
                  bottomOffset: 100,
                });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('favorites.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.favoritesBase}>
        {favorites.length > 0 ? (
          <FlatList
            data={favorites}
            renderItem={({ item }) => <FavoriteCard item={item} />}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.favoritesGrid}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
          />
        ) : (
          <View style={styles.emptyComplex}>
            <View style={styles.emptyCircle}>
              <Ionicons name="heart-outline" size={80} color={Colors.border} />
            </View>
            <Text style={styles.emptyMainTitle}>{t('favorites.empty')}</Text>
            <Text style={styles.emptySubDesc}>
              {t('favorites.emptyDescription')}
            </Text>
            <TouchableOpacity 
              style={styles.browseBtn}
              onPress={() => navigation.navigate('MenuTab')}
            >
              <Text style={styles.browseBtnText}>{t('home.explore') || 'Explore'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.white,
    ...Shadows.small,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  favoritesBase: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  favoritesGrid: {
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  favoriteCardWrapper: {
    width: (width - 48) / 2,
    marginBottom: 16,
  },
  modernFavoriteCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    overflow: 'hidden',
    ...Shadows.small,
  },
  favoriteImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  favoriteBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  favoriteInfo: {
    padding: 12,
  },
  favoriteName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  favoriteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoritePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  favoriteAddBtn: {
    backgroundColor: Colors.black,
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyComplex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
    marginBottom: 24,
  },
  emptyMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  emptySubDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  browseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 20,
    ...Shadows.medium,
  },
  browseBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});

export default FavoritesScreen;
