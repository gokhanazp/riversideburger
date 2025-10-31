import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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

// Admin ekranları (Admin screens)
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminOrders from '../screens/admin/AdminOrders';
import AdminProducts from '../screens/admin/AdminProducts';
import AdminUsers from '../screens/admin/AdminUsers';
import AdminSettings from '../screens/admin/AdminSettings';
import AdminBanners from '../screens/admin/AdminBanners';

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
  // Sepetteki toplam ürün sayısını al (Get total items count from cart)
  const totalItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
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
          title: 'Ana Sayfa',
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
          title: 'Menü',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="fast-food" size={26} color={Colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
                Menü
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
          title: 'Sepet',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cart" size={26} color={Colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
                Sepetim
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
          title: 'Profil',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="person" size={26} color={Colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text }}>
                Profilim
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
          options={{
            title: '📦 Sipariş Geçmişi',
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
          name="PointsHistory"
          component={PointsHistoryScreen}
          options={{
            title: '⭐ Puan Geçmişi',
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
          name="ProfileEdit"
          component={ProfileEditScreen}
          options={{
            title: '✏️ Profil Düzenle',
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
          name="AddressList"
          component={AddressListScreen}
          options={{
            title: '📍 Adreslerim',
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
          name="AddressEdit"
          component={AddressEditScreen}
          options={{
            title: '📝 Adres Düzenle',
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

        {/* Admin Ekranları (Admin Screens) */}
        <Stack.Screen
          name="AdminDashboard"
          component={AdminDashboard}
          options={{
            title: '👨‍💼 Admin Dashboard',
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
            title: '📋 Sipariş Yönetimi',
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
            title: '🍔 Ürün Yönetimi',
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
            title: '⚙️ Sistem Ayarları',
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
            title: '🖼️ Banner Yönetimi',
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

