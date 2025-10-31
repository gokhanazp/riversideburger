import React from 'react';
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
          tabBarIcon: ({ focused }) => <TabIcon iconName="home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MenuTab"
        component={MenuScreen}
        options={{
          title: 'Menü',
          tabBarIcon: ({ focused }) => <TabIcon iconName="restaurant" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Sepet',
          tabBarIcon: ({ focused }) => <TabIcon iconName="cart" focused={focused} />,
          // Badge göster (Show badge) - sadece ürün varsa (only if items exist)
          tabBarBadge: totalItems > 0 ? totalItems : undefined,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon iconName="person" focused={focused} />,
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

