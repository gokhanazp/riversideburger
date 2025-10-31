import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { CATEGORY_NAMES } from '../constants/mockData';
import { CategoryType } from '../types';
import BannerSlider from '../components/BannerSlider';

// Ana sayfa ekranı (Home screen)
const HomeScreen = ({ navigation }: any) => {
  // Kategorilere tıklandığında menü ekranına yönlendir (Navigate to menu screen on category click)
  const handleCategoryPress = (category: CategoryType) => {
    navigation.navigate('MenuTab', { category });
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

