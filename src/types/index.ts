// Menü kategorileri için tip tanımı (Menu category type definition)
export type CategoryType = 'pizza' | 'burger' | 'pasta' | 'salad' | 'dessert' | 'drink';

// Menü öğesi için tip tanımı (Menu item type definition)
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency?: 'TRY' | 'CAD'; // Para birimi (Currency)
  category: CategoryType;
  image: string;
  available: boolean;
  preparationTime?: number; // dakika cinsinden (in minutes)
  ingredients?: string[]; // malzemeler (ingredients)
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

