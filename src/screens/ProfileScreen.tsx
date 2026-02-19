import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Linking, StatusBar, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, FadeInLeft, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useFavoritesStore } from '../store/favoritesStore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { MenuItem as MenuItemType } from '../types';
import Toast from 'react-native-toast-message';
import { getUserPoints } from '../services/pointsService';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../services/currencyService';
import { getContactInfo, getPhoneLink, getEmailLink, ContactInfo } from '../services/contactService';

const { width } = Dimensions.get('window');

// Profil ekranı (Profile screen) - Elite Redesign
const ProfileScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { favorites } = useFavoritesStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [userPoints, setUserPoints] = useState<number>(0);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserPoints();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    loadContactInfo();
  }, []);

  const loadContactInfo = async () => {
    try {
      const info = await getContactInfo();
      setContactInfo(info);
    } catch (error) {
      console.error('Error loading contact info:', error);
    }
  };

  const loadUserPoints = async () => {
    if (!user) return;
    try {
      const points = await getUserPoints(user.id);
      setUserPoints(points);
    } catch (error) {
      console.error('Error loading points:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      Toast.show({
        type: 'success',
        text1: `👋 ${t('profile.logoutSuccess')}`,
        text2: t('profile.logoutSuccessMessage'),
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('profile.logoutError'),
        text2: t('profile.logoutErrorMessage'),
      });
    }
  };

  // Modern Menü öğesi (Modern Menu Item)
  const MenuItem = ({
    iconName,
    title,
    subtitle,
    onPress,
    index
  }: {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    index: number;
  }) => (
    <Animated.View entering={FadeInLeft.delay(100 * index).springify()}>
      <TouchableOpacity
        style={styles.modernMenuItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={[styles.modernIconContainer, { backgroundColor: Colors.surface }]}>
            <Ionicons name={iconName} size={22} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.modernMenuTitle}>{title}</Text>
            {subtitle && <Text style={styles.modernMenuSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
        {/* Elite Profile Header */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={['#1a1a1a', '#333333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Animated.View entering={ZoomIn.duration(600)} style={styles.avatarBorder}>
                <View style={styles.avatarBg}>
                  <Ionicons name="person" size={40} color={Colors.textSecondary} />
                </View>
                {isAuthenticated && (
                    <View style={styles.onlineBadge} />
                )}
              </Animated.View>
              
              <View style={styles.userTextContainer}>
                {isAuthenticated && user ? (
                  <>
                    <Animated.Text entering={FadeInDown.delay(200)} style={styles.eliteUserName}>
                      {user.full_name || t('common.user')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(300)} style={styles.eliteUserEmail}>
                      {user.email}
                    </Animated.Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.eliteUserName}>{t('profile.guestUser')}</Text>
                    <Text style={styles.eliteUserEmail}>{t('profile.guestMessage')}</Text>
                    <TouchableOpacity
                      style={styles.eliteLoginBtn}
                      onPress={() => navigation.navigate('Login')}
                    >
                      <Text style={styles.eliteLoginBtnText}>{t('profile.loginRegister')}</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </LinearGradient>

          {/* Loyalty Card - Overlapping */}
          {isAuthenticated && user && (
            <Animated.View entering={FadeInUp.delay(400)} style={styles.loyaltyPosition}>
              <LinearGradient
                colors={['#E63946', '#FF6B35']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loyaltyCard}
              >
                <View style={styles.loyaltyInfo}>
                  <Text style={styles.loyaltyLabel}>{t('profile.totalPoints')}</Text>
                  <Text style={styles.loyaltyValue}>{userPoints.toFixed(0)} <Text style={styles.loyaltyUnit}>PTS</Text></Text>
                  <Text style={styles.loyaltySubtext}>{t('profile.pointsDiscount')}</Text>
                </View>
                <View style={styles.loyaltyIconBox}>
                  <Ionicons name="star" size={32} color="rgba(255,255,255,0.4)" />
                </View>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        <View style={[styles.mainContent, { marginTop: isAuthenticated ? 70 : 0 }]}>
          {/* Admin Panel */}
          {isAuthenticated && user?.role === 'admin' && (
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>{t('profile.adminPanel')}</Text>
              <View style={styles.modernCard}>
                <MenuItem
                  index={1}
                  iconName="shield-checkmark"
                  title={t('profile.adminDashboard')}
                  subtitle={t('profile.adminDashboardSubtitle')}
                  onPress={() => navigation.navigate('AdminDashboard')}
                />
              </View>
            </View>
          )}

          {/* Account Settings */}
          {isAuthenticated && (
            <View style={styles.modernSection}>
              <Text style={styles.modernSectionTitle}>{t('profile.accountSection')}</Text>
              <View style={styles.modernCard}>
                <MenuItem
                  index={2}
                  iconName="person-outline"
                  title={t('profile.profileInfo')}
                  subtitle={t('profile.profileInfoSubtitle')}
                  onPress={() => navigation.navigate('ProfileEdit')}
                />
                <MenuItem
                  index={3}
                  iconName="location-outline"
                  title={t('profile.myAddresses')}
                  subtitle={t('profile.myAddressesSubtitle')}
                  onPress={() => navigation.navigate('AddressList')}
                />
                <MenuItem
                  index={4}
                  iconName="heart-outline"
                  title={t('favorites.title')}
                  subtitle={`${favorites.length} ${t('profile.favoritesTabSubtitle') || 'items saved'}`}
                  onPress={() => navigation.navigate('Favorites')}
                />
              </View>
            </View>
          )}

          {/* Orders & History */}
          {isAuthenticated && (
              <View style={styles.modernSection}>
                <Text style={styles.modernSectionTitle}>{t('profile.ordersSection')}</Text>
                <View style={styles.modernCard}>
                  <MenuItem
                    index={5}
                    iconName="receipt-outline"
                    title={t('profile.orderHistory')}
                    subtitle={t('profile.orderHistorySubtitle')}
                    onPress={() => navigation.navigate('OrderHistory')}
                  />
                  <MenuItem
                      index={6}
                      iconName="star-outline"
                      title={t('profile.pointsHistory')}
                      subtitle={t('profile.pointsHistorySubtitle')}
                      onPress={() => navigation.navigate('PointsHistory')}
                  />
                  <MenuItem
                      index={7}
                      iconName="chatbox-ellipses-outline"
                      title={t('profile.restaurantReview')}
                      subtitle={t('profile.restaurantReviewSubtitle')}
                      onPress={() => navigation.navigate('RestaurantReview')}
                  />
                </View>
              </View>
          )}

          {/* Other Settings */}
          <View style={styles.modernSection}>
            <Text style={styles.modernSectionTitle}>{t('profile.settingsSection')}</Text>
            <View style={styles.modernCard}>
              <MenuItem
                index={8}
                iconName="notifications-outline"
                title={t('profile.notifications')}
                subtitle={t('profile.notificationsSubtitle')}
                onPress={() => navigation.navigate('Notifications')}
              />
              <MenuItem
                index={9}
                iconName="help-circle-outline"
                title={t('profile.helpSupport')}
                subtitle={t('profile.helpSupportSubtitle')}
                onPress={() => navigation.navigate('HelpSupport')}
              />
              <MenuItem
                index={10}
                iconName="shield-outline"
                title={t('profile.privacyPolicy')}
                onPress={() => navigation.navigate('PrivacyPolicy')}
              />
            </View>
          </View>

          {/* Logout */}
          {isAuthenticated && (
            <Animated.View entering={FadeInDown.delay(1000)}>
              <TouchableOpacity
                style={styles.eliteLogoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
                <Text style={styles.eliteLogoutText}>{t('profile.logout')}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Footer */}
          <View style={styles.eliteFooter}>
              <Text style={styles.footerBrand}>Riverside Burgers</Text>
              <Text style={styles.footerTagline}>{contactInfo?.footerAbout || t('profile.aboutUsText')}</Text>
              
              <View style={styles.footerSocials}>
                  {contactInfo?.facebook && (
                      <TouchableOpacity onPress={() => Linking.openURL(contactInfo.facebook)} style={styles.socialCircle}>
                          <Ionicons name="logo-facebook" size={20} color={Colors.white} />
                      </TouchableOpacity>
                  )}
                  {contactInfo?.instagram && (
                      <TouchableOpacity onPress={() => Linking.openURL(contactInfo.instagram)} style={styles.socialCircle}>
                          <Ionicons name="logo-instagram" size={20} color={Colors.white} />
                      </TouchableOpacity>
                  )}
              </View>

              <View style={styles.footerDivider} />
              <Text style={styles.footerCopy}>{contactInfo?.footerCopyright || t('profile.copyright')}</Text>
              <Text style={styles.footerVersion}>V 1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    marginBottom: 0,
    position: 'relative',
    paddingTop: 0,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBorder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  userTextContainer: {
    marginLeft: Spacing.lg,
    flex: 1,
  },
  eliteUserName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  eliteUserEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  eliteLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  eliteLoginBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  loyaltyPosition: {
    position: 'absolute',
    bottom: -50,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  loyaltyCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.large,
  },
  loyaltyInfo: {
    flex: 1,
  },
  loyaltyLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loyaltyValue: {
    color: Colors.white,
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 4,
  },
  loyaltyUnit: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  loyaltySubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  loyaltyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    paddingHorizontal: Spacing.xl,
  },
  modernSection: {
    marginTop: 32,
  },
  modernSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
    paddingLeft: 4,
  },
  modernCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Shadows.small,
  },
  modernMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modernMenuSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  eliteLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 40,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fee2e2',
    gap: 12,
  },
  eliteLogoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  eliteFooter: {
    marginTop: 60,
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 1,
  },
  footerTagline: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  footerSocials: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  socialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
    marginVertical: 24,
  },
  footerCopy: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  footerVersion: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    opacity: 0.6,
  },
});

export default ProfileScreen;


