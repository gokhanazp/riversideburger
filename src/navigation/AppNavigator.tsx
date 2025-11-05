import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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

// Auth ekranları (Auth screens)
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Sipariş ve Puan ekranları (Order and Points screens)
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import PointsHistoryScreen from '../screens/PointsHistoryScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressEditScreen from '../screens/AddressEditScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ReviewOrderScreen from '../screens/ReviewOrderScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Admin ekranları (Admin screens)
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminOrders from '../screens/admin/AdminOrders';
import AdminProducts from '../screens/admin/AdminProducts';
import AdminProductCustomization from '../screens/admin/AdminProductCustomization';
import AdminProductOptions from '../screens/admin/AdminProductOptions';
import AdminCategories from '../screens/admin/AdminCategories';
import AdminUsers from '../screens/admin/AdminUsers';
import AdminSettings from '../screens/admin/AdminSettings';
import AdminBanners from '../screens/admin/AdminBanners';
import AdminNotifications from '../screens/admin/AdminNotifications';
import AdminReviews from '../screens/admin/AdminReviews';
import AdminLanguageSettings from '../screens/admin/AdminLanguageSettings';

// Type'ları import et (Import types)
import { MainTabParamList, RootStackParamList } from './types';

// Tema import et (Import theme)
import { Colors, FontSizes } from '../constants/theme';

// Store import et (Import store)
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

// Navigator'ları oluştur (Create navigators)
const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Tab icon componenti (Tab icon component)
const TabIcon = ({
  iconName,
  focused
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) => (
  <Ionicons
    name={iconName}
    size={24}
    color={focused ? Colors.primary : Colors.textSecondary}
  />
);

// Ana tab navigator (Main tab navigator)
const MainTabs = () => {
  const { t } = useTranslation();

  // Sepetteki toplam ürün sayısını al (Get total items count from cart)
  const totalItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  // Safe area insets (Güvenli alan kenar boşlukları)
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#999', // Daha açık gri (Lighter gray)
        tabBarStyle: {
          backgroundColor: '#000', // Siyah arka plan (Black background)
          height: 60 + insets.bottom, // Safe area için yükseklik (Height for safe area)
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8, // Safe area padding
          paddingTop: 8,
          borderTopWidth: 0, // Üst border kaldırıldı (Top border removed)
        },
        tabBarLabelStyle: {
          fontSize: FontSizes.xs,
          fontWeight: '600',
        },
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
          title: t('navigation.home'),
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="fast-food" size={26} color={Colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
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

  return (
    <NavigationContainer>
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

        {/* Sipariş ve Puan ekranları (Order and Points screens) */}
        <Stack.Screen
          name="OrderHistory"
          component={OrderHistoryScreen}
          options={({ navigation }) => ({
            title: t('navigation.orderHistory'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
          options={({ navigation }) => ({
            title: t('navigation.profileEdit'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen
          name="AddressList"
          component={AddressListScreen}
          options={({ navigation }) => ({
            title: t('navigation.addressList'),
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          })}
        />

        {/* Admin Ekranları (Admin Screens) */}
        <Stack.Screen
          name="AdminDashboard"
          component={AdminDashboard}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
            title: '👥 Kullanıcı Yönetimi',
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="AdminNotifications"
          component={AdminNotifications}
          options={{
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
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
            title: '⭐ Yorum Yönetimi',
            headerShown: false, // Kendi header'ını kullanıyor
          }}
        />
        <Stack.Screen
          name="AdminLanguageSettings"
          component={AdminLanguageSettings}
          options={{
            title: '🌍 Dil ve Para Birimi',
            headerShown: false, // Kendi header'ını kullanıyor
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

