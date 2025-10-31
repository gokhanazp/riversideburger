// Database types (Veritabanı tipleri)

export type UserRole = 'customer' | 'admin';

export type OrderStatus = 
  | 'pending'      // Bekliyor
  | 'confirmed'    // Onaylandı
  | 'preparing'    // Hazırlanıyor
  | 'ready'        // Hazır
  | 'delivering'   // Yolda
  | 'delivered'    // Teslim Edildi
  | 'cancelled';   // İptal Edildi

export type StockStatus = 'in_stock' | 'out_of_stock';

// User (Kullanıcı)
export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string;
  created_at: string;
  updated_at?: string;
}

// Category (Kategori)
export interface Category {
  id: string;
  name: string;
  name_en: string;
  icon: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Product (Ürün)
export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  preparation_time: number;
  is_active: boolean;
  stock_status: StockStatus;
  created_at: string;
  updated_at?: string;
  // Relations
  category?: Category;
}

// Address (Adres)
export interface Address {
  id: string;
  user_id: string;
  title: string;
  address: string;
  city: string;
  district: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

// Order (Sipariş)
export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  delivery_address: string;
  phone: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Relations
  user?: User;
  order_items?: OrderItem[];
}

// Order Item (Sipariş Kalemi)
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  created_at: string;
  // Relations
  product?: Product;
}

// Database Tables (Veritabanı Tabloları)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at'>>;
      };
      addresses: {
        Row: Address;
        Insert: Omit<Address, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Address, 'id' | 'created_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'order_number'>;
        Update: Partial<Omit<Order, 'id' | 'created_at' | 'order_number'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderItem, 'id' | 'created_at'>>;
      };
    };
  };
}

