import { NavigatorScreenParams } from '@react-navigation/native';
import { MenuItem } from '../types';

// Ana tab navigator için parametre tipleri (Main tab navigator parameter types)
export type MainTabParamList = {
  HomeTab: undefined;
  MenuTab: undefined;
  CartTab: undefined;
  ProfileTab: undefined;
};

// Root stack navigator için parametre tipleri (Root stack navigator parameter types)
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  ProductDetail: { item: MenuItem };
  MenuDetail: { itemId: string };
  OrderConfirmation: { orderId: string };
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  // Payment ekranı geçici olarak devre dışı (Payment screen temporarily disabled)
  // Payment: {
  //   totalAmount: number;
  //   currency: string;
  //   deliveryAddress: string;
  //   phone: string;
  //   notes: string;
  //   pointsUsed: number;
  //   addressId: string | null;
  // };
  OrderHistory: undefined;
  PointsHistory: undefined;
  ProfileEdit: undefined;
  AddressList: undefined;
  AddressEdit: { addressId: string | null };
  Notifications: undefined;
  Settings: undefined; // Ayarlar ekranı (Settings screen)
  ReviewOrder: { orderId: string }; // Sipariş değerlendirme ekranı (Review order screen)
  RestaurantReview: undefined; // Restoran değerlendirme ekranı (Restaurant review screen)
  HelpSupport: undefined; // Yardım ve destek ekranı (Help & Support screen)
  PrivacyPolicy: undefined; // Gizlilik politikası ekranı (Privacy policy screen)
  // Admin ekranları (Admin screens)
  AdminDashboard: undefined;
  AdminOrders: { filter?: string } | undefined;
  AdminProducts: undefined;
  AdminProductCustomization: { product: any };
  AdminProductOptions: undefined; // Ekstra malzeme yönetimi (Extra ingredients management)
  AdminCategories: undefined; // Kategori yönetimi (Category management)
  AdminUsers: undefined;
  AdminSettings: undefined;
  AdminBanners: undefined;
  AdminNotifications: undefined;
  AdminReviews: undefined; // Yorum yönetimi (Review management)
  AdminLanguageSettings: undefined; // Dil ve para birimi yönetimi (Language and currency management)
};

