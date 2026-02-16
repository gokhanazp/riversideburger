// Menü kategorisi için tip tanımı (Menu category type definition)
export interface MenuCategory {
  id: string;
  name_tr: string;
  name_en: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Eski kategori tipi - geriye dönük uyumluluk için (Old category type - for backward compatibility)
export type CategoryType = 'pizza' | 'burger' | 'pasta' | 'salad' | 'dessert' | 'drink';

// Menü öğesi için tip tanımı (Menu item type definition)
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // Fiyat - ülke seçimine göre sembol eklenir (Price - symbol added based on country selection)
  category: CategoryType;
  category_id?: string; // Yeni: Dinamik kategori ID (New: Dynamic category ID)
  image: string;
  available: boolean;
  preparationTime?: number; // dakika cinsinden (in minutes)
  ingredients?: string[]; // malzemeler (ingredients)
  rating?: number;
  reviews?: number;
}

// Sepet öğesi için tip tanımı (Cart item type definition)
export interface CartItem extends MenuItem {
  quantity: number;
  customizations?: Array<{
    option_id: string;
    option_name: string;
    option_price: number;
  }>;
  specialInstructions?: string;
}

// Sipariş durumu için tip tanımı (Order status type definition)
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

// Sipariş için tip tanımı (Order type definition)
export interface Order {
  id: string;
  items: CartItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  tableNumber?: string;
  notes?: string;
}

// Kullanıcı için tip tanımı (User type definition)
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

