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
  OrderHistory: undefined;
  PointsHistory: undefined;
  ProfileEdit: undefined;
  AddressList: undefined;
  AddressEdit: { addressId: string | null };
  // Admin ekranları (Admin screens)
  AdminDashboard: undefined;
  AdminOrders: { filter?: string } | undefined;
  AdminProducts: undefined;
  AdminUsers: undefined;
  AdminSettings: undefined;
  AdminBanners: undefined;
};

