import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useFavoritesStore } from '../store/favoritesStore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { MenuItem as MenuItemType } from '../types';
import Toast from 'react-native-toast-message';

// Profil ekranı (Profile screen)
const ProfileScreen = ({ navigation }: any) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'favorites'>('profile');
  const { favorites, toggleFavorite } = useFavoritesStore();
  const addItem = useCartStore((state) => state.addItem);
  const { user, isAuthenticated, logout } = useAuthStore();

  // Çıkış yap (Logout)
  const handleLogout = async () => {
    try {
      await logout();
      Toast.show({
        type: 'success',
        text1: '👋 Çıkış Yapıldı',
        text2: 'Başarıyla çıkış yaptınız',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Çıkış yapılırken bir hata oluştu',
      });
    }
  };

  // Menü öğesi componenti (Menu item component)
  const MenuItem = ({
    iconName,
    title,
    subtitle,
    onPress
  }: {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={iconName} size={24} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  // Favori ürün kartı (Favorite item card)
  const FavoriteCard = ({ item }: { item: MenuItemType }) => (
    <TouchableOpacity
      style={styles.favoriteCard}
      onPress={() => navigation.navigate('ProductDetail', { item })}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image }} style={styles.favoriteImage} />

      {/* Favori butonu (Favorite button) */}
      <TouchableOpacity
        style={styles.favoriteBadge}
        onPress={(e) => {
          e.stopPropagation();
          toggleFavorite(item);
          Toast.show({
            type: 'info',
            text1: '💔 Favorilerden Çıkarıldı',
            text2: item.name,
            position: 'bottom',
            visibilityTime: 1500,
            bottomOffset: 100,
          });
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="heart" size={20} color={Colors.primary} />
      </TouchableOpacity>

      <View style={styles.favoriteInfo}>
        <Text style={styles.favoriteName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.favoritePrice}>₺{item.price.toFixed(2)}</Text>
        <TouchableOpacity
          style={styles.favoriteAddButton}
          onPress={(e) => {
            e.stopPropagation();
            addItem(item);
            Toast.show({
              type: 'success',
              text1: '🍔 Sepete Eklendi!',
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Tab seçici (Tab selector) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="person"
            size={20}
            color={activeTab === 'profile' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            Profil
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
          onPress={() => setActiveTab('favorites')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="heart"
            size={20}
            color={activeTab === 'favorites' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
            Favoriler ({favorites.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profil başlığı (Profile header) */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={48} color={Colors.white} />
            </View>
            {isAuthenticated && user ? (
              <>
                <Text style={styles.userName}>{user.full_name || 'Kullanıcı'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </>
            ) : (
              <>
                <Text style={styles.userName}>Misafir Kullanıcı</Text>
                <Text style={styles.userEmail}>Sipariş vermek için giriş yapın</Text>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loginButtonText}>Giriş Yap / Kayıt Ol</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Hesap bölümü (Account section) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hesap</Text>
            <View style={styles.card}>
              <MenuItem iconName="person-outline" title="Profil Bilgileri" subtitle="Kişisel bilgilerinizi düzenleyin" />
              <MenuItem iconName="location-outline" title="Adreslerim" subtitle="Teslimat adreslerinizi yönetin" />
              <MenuItem iconName="card-outline" title="Ödeme Yöntemleri" subtitle="Kayıtlı kartlarınız" />
            </View>
          </View>

          {/* Siparişler bölümü (Orders section) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Siparişler</Text>
            <View style={styles.card}>
              <MenuItem iconName="receipt-outline" title="Sipariş Geçmişi" subtitle="Geçmiş siparişlerinizi görün" />
            </View>
          </View>

          {/* Ayarlar bölümü (Settings section) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ayarlar</Text>
            <View style={styles.card}>
              <MenuItem iconName="notifications-outline" title="Bildirimler" subtitle="Bildirim tercihleriniz" />
              <MenuItem iconName="language-outline" title="Dil" subtitle="Türkçe" />
              <MenuItem iconName="help-circle-outline" title="Yardım & Destek" subtitle="SSS ve iletişim" />
              <MenuItem iconName="shield-outline" title="Gizlilik Politikası" />
              <MenuItem iconName="document-text-outline" title="Kullanım Koşulları" />
            </View>
          </View>

          {/* Çıkış butonu (Logout button) - Sadece giriş yapmışsa göster (Only show if authenticated) */}
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
              <Text style={styles.logoutText}>Çıkış Yap</Text>
            </TouchableOpacity>
          )}

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

          {/* Versiyon bilgisi (Version info) */}
          <Text style={styles.version}>Versiyon 1.0.0</Text>
        </ScrollView>
      ) : (
        <View style={styles.favoritesContainer}>
          {favorites.length > 0 ? (
            <FlatList
              data={favorites}
              renderItem={({ item }) => <FavoriteCard item={item} />}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.favoritesList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>Henüz Favori Yok</Text>
              <Text style={styles.emptyText}>
                Beğendiğiniz ürünleri favorilere ekleyerek buradan kolayca ulaşabilirsiniz
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  favoritesContainer: {
    flex: 1,
  },
  favoritesList: {
    padding: Spacing.sm,
  },
  favoriteCard: {
    flex: 1,
    margin: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },
  favoriteImage: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.surface,
  },
  favoriteBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.round,
    padding: Spacing.xs,
    ...Shadows.small,
  },
  favoriteInfo: {
    padding: Spacing.sm,
  },
  favoriteName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  favoritePrice: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  favoriteAddButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  loginButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.medium,
  },
  loginButtonText: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.small,
  },
  logoutText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Footer stilleri (Footer styles)
  footer: {
    backgroundColor: Colors.black,
    padding: Spacing.xl,
    marginTop: Spacing.xl,
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

export default ProfileScreen;

