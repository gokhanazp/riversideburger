import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

// Ekranları import et (Import screens)
import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import FavoritesScreen from '../screens/FavoritesScreen';

// Auth ekranları (Auth screens)
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

// Sipariş ve Puan ekranları (Order and Points screens)
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import PointsHistoryScreen from '../screens/PointsHistoryScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressEditScreen from '../screens/AddressEditScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ReviewOrderScreen from '../screens/ReviewOrderScreen';
import RestaurantReviewScreen from '../screens/RestaurantReviewScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

// Ödeme ekranı (Payment screen)
import PaymentScreen from '../screens/PaymentScreen';

// Sipariş takip ekranı (Order tracking screen — Uber Direct live tracking)
import OrderTrackingScreen from '../screens/OrderTrackingScreen';

// Admin ekranları (Admin screens)
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminOrders from '../screens/admin/AdminOrders';
import AdminProducts from '../screens/admin/AdminProducts';
import AdminProductCustomization from '../screens/admin/AdminProductCustomization';
import AdminProductOptions from '../screens/admin/AdminProductOptions';
import AdminCategories from '../screens/admin/AdminCategories';
import AdminUsers from '../screens/admin/AdminUsers';
import AdminSettings from '../screens/admin/AdminSettings';
import AdminContactSettings from '../screens/admin/AdminContactSettings';
import AdminBanners from '../screens/admin/AdminBanners';
import AdminDeliveryPartners from '../screens/admin/AdminDeliveryPartners';
import AdminPrinterSettings from '../screens/admin/AdminPrinterSettings';
import AdminCampaigns from '../screens/admin/AdminCampaigns';
import AdminNotifications from '../screens/admin/AdminNotifications';
import AdminReviews from '../screens/admin/AdminReviews';
import AdminLanguageSettings from '../screens/admin/AdminLanguageSettings';

// Type'ları import et (Import types)
import { MainTabParamList, RootStackParamList } from './types';

// Tema import et (Import theme)
import { Colors, FontSizes, Shadows } from '../constants/theme';

// Store import et (Import store)
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

// Navigator'ları oluştur (Create navigators)
const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigation ref - ayrı dosyada (döngüsel import'u önlemek için); geriye dönük uyum için re-export
export { navigationRef } from './navigationRef';
import { navigationRef } from './navigationRef';

// Global admin sipariş bildirimcisi (her ekranda ses + toast)
import { useAdminOrderNotifier } from '../hooks/useAdminOrderNotifier';

// Custom Tab Bar Component for "Floating Island" Style
const CustomTabBar = ({ state, descriptors, navigation, totalItems }: any) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[
      styles.tabBarWrapper, 
      { bottom: Platform.OS === 'ios' ? insets.bottom + 10 : 20 }
    ]}>
      <View style={styles.floatingContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName: any = 'home-outline';
          let label = '';

          switch (route.name) {
            case 'HomeTab':
              iconName = isFocused ? 'home' : 'home-outline';
              label = t('navigation.home');
              break;
            case 'MenuTab':
              iconName = isFocused ? 'fast-food' : 'fast-food-outline';
              label = t('navigation.menu');
              break;
            case 'CartTab':
              iconName = isFocused ? 'cart' : 'cart-outline';
              label = t('navigation.cart');
              break;
            case 'ProfileTab':
              iconName = isFocused ? 'person' : 'person-outline';
              label = t('navigation.profile');
              break;
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tabButton}
            >
              {isFocused ? (
                <View style={styles.activePill}>
                  <Ionicons name={iconName} size={20} color={Colors.black} />
                  <Text style={styles.activeLabel}>{label}</Text>
                </View>
              ) : (
                <View style={styles.inactiveIconContainer}>
                  <Ionicons name={iconName} size={22} color="rgba(255,255,255,0.7)" />
                  {route.name === 'CartTab' && totalItems > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{totalItems}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Ana tab navigator (Main tab navigator)
const MainTabs = () => {
  const { t } = useTranslation();

  // Sepetteki toplam ürün sayısını al (Get total items count from cart)
  const totalItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} totalItems={totalItems} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.white,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        },
        headerTitleStyle: {
          fontSize: FontSizes.xl,
          fontWeight: 'bold',
          color: Colors.text,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="restaurant" size={28} color={Colors.primary} />
              <View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
                  Riverside Burgers
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                  Toronto, Canada 🇨🇦
                </Text>
              </View>
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12, marginRight: 16 }}>
              <TouchableOpacity
                onPress={() => {}}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: Colors.surface,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={focused ? Colors.primary : Colors.textSecondary}
            />
          ),
        }}
      />
      <Tab.Screen
        name="MenuTab"
        component={MenuScreen}
        options={{
          title: t('navigation.menu'),
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="fast-food" size={24} color={Colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>
                {t('navigation.menu')}
              </Text>
            </View>
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'fast-food' : 'fast-food-outline'}
              size={24}
              color={focused ? Colors.primary : Colors.textSecondary}
            />
          ),
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: t('navigation.cart'),
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cart" size={26} color={Colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
                {t('navigation.cart')}
              </Text>
            </View>
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'cart' : 'cart-outline'}
              size={24}
              color={focused ? Colors.primary : Colors.textSecondary}
            />
          ),
          // Badge göster (Show badge) - sadece ürün varsa (only if items exist)
          tabBarBadge: totalItems > 0 ? totalItems : undefined,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: t('navigation.profile'),
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="person" size={26} color={Colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
                {t('navigation.profile')}
              </Text>
            </View>
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={focused ? Colors.primary : Colors.textSecondary}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Root stack navigator (Root stack navigator)
const AppNavigator = () => {
  const { t } = useTranslation();

  // Admin ise: her ekranda yeni sipariş ses + bildirim (global realtime abonesi)
  useAdminOrderNotifier();

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Ana uygulama - Misafir olarak gezebilir (Main app - Can browse as guest) */}
        <Stack.Screen name="Main" component={MainTabs} />

        {/* Ürün detay modal (Product detail modal) */}
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            headerShown: false,
          }}
        />

        {/* Auth ekranları - Sipariş verirken açılacak (Auth screens - Will open when ordering) */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Ödeme ekranı (Payment screen) */}
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Sipariş takip ekranı (Order tracking — Uber Direct live tracking) */}
        <Stack.Screen
          name="OrderTracking"
          component={OrderTrackingScreen}
          options={{ headerShown: false }}
        />

        {/* Sipariş ve Puan ekranları (Order and Points screens) */}
        <Stack.Screen
          name="OrderHistory"
          component={OrderHistoryScreen}
          options={({ navigation }) => ({
            title: t('navigation.orderHistory'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen
          name="PointsHistory"
          component={PointsHistoryScreen}
          options={({ navigation }) => ({
            title: t('navigation.pointsHistory'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen
          name="ProfileEdit"
          component={ProfileEditScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddressList"
          component={AddressListScreen}
          options={({ navigation }) => ({
            title: t('navigation.addressList'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen
          name="AddressEdit"
          component={AddressEditScreen}
          options={({ navigation }) => ({
            title: t('navigation.addressEdit'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={({ navigation }) => ({
            title: t('navigation.notifications'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ReviewOrder"
          component={ReviewOrderScreen}
          options={({ navigation }) => ({
            title: t('navigation.reviewOrder'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />

        <Stack.Screen
          name="RestaurantReview"
          component={RestaurantReviewScreen}
          options={{
            headerShown: false,
          }}
        />

        {/* Yardım ve Destek (Help & Support) */}
        <Stack.Screen
          name="HelpSupport"
          component={HelpSupportScreen}
          options={{
            headerShown: false,
          }}
        />

        {/* Gizlilik Politikası (Privacy Policy) */}
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{
            headerShown: false,
          }}
        />

        {/* Admin Ekranları (Admin Screens) */}
        <Stack.Screen
          name="AdminDashboard"
          component={AdminDashboard}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminOrders"
          component={AdminOrders}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminProducts"
          component={AdminProducts}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminProductCustomization"
          component={AdminProductCustomization}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AdminProductOptions"
          component={AdminProductOptions}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AdminCategories"
          component={AdminCategories}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AdminUsers"
          component={AdminUsers}
          options={{
            title: t('admin.users.title'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminSettings"
          component={AdminSettings}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminContactSettings"
          component={AdminContactSettings}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminBanners"
          component={AdminBanners}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminDeliveryPartners"
          component={AdminDeliveryPartners}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminPrinterSettings"
          component={AdminPrinterSettings}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminCampaigns"
          component={AdminCampaigns}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminNotifications"
          component={AdminNotifications}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerShadowVisible: true,
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminReviews"
          component={AdminReviews}
          options={{
            title: t('admin.reviews.title'),
            headerShown: false, // Kendi header'ını kullanıyor
          }}
        />
        <Stack.Screen
          name="AdminLanguageSettings"
          component={AdminLanguageSettings}
          options={{
            title: t('admin.languageSettings.title'),
            headerShown: false, // Kendi header'ını kullanıyor
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.95)', // Slightly more opaque
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 8,
    ...Shadows.large,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
  },
  inactiveIconContainer: {
    padding: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 5,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.9)',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
});

export default AppNavigator;

