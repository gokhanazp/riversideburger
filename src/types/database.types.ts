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
  full_name?: string; // Tam ad (Full name) - optional
  phone?: string; // Telefon (Phone) - optional
  points: number; // Kullanıcının toplam puanı (User's total points)
  created_at: string;
  updated_at?: string;
}

// Address (Adres) - Canada Format
export interface Address {
  id: string;
  user_id: string;
  title: string; // Home, Work, Other
  full_name: string;
  phone: string;
  street_number: string; // Bina numarası (Building number) - e.g., 123
  street_name: string; // Sokak adı (Street name) - e.g., Main Street
  unit_number?: string; // Daire/Apartman numarası (Unit/Apartment number) - e.g., Apt 4B
  city: string; // Şehir (City) - e.g., Toronto
  province: string; // Eyalet (Province) - ON, BC, AB, QC, etc.
  postal_code: string; // Posta kodu (Postal code) - A1A 1A1 format
  delivery_instructions?: string; // Teslimat talimatları (Delivery instructions)
  is_default: boolean;
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
  ingredients?: string[]; // Malzemeler (Ingredients)
  created_at: string;
  updated_at?: string;
  // Relations
  category?: Category;
}

// Address (Adres) - Duplicate removed, using the one above

// Order (Sipariş)
export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  delivery_address: string; // Eski format için (For old format)
  phone: string;
  notes?: string;
  address_id?: string; // Yeni adres sistemi için (For new address system)
  points_earned: number; // Bu siparişten kazanılan puan (Points earned from this order)
  points_used: number; // Bu siparişte kullanılan puan (Points used in this order)
  created_at: string;
  updated_at?: string;
  // Relations
  user?: User;
  order_items?: OrderItem[];
  address?: Address; // Adres ilişkisi (Address relation)
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

// Settings (Ayarlar)
export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

// Points History (Puan Geçmişi)
export type PointsHistoryType = 'earned' | 'used' | 'expired' | 'admin_adjustment';

export interface PointsHistory {
  id: string;
  user_id: string;
  order_id?: string;
  points: number;
  type: PointsHistoryType;
  description?: string;
  created_at: string;
  // Relations
  order?: Order;
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
      settings: {
        Row: Setting;
        Insert: Omit<Setting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Setting, 'id' | 'created_at'>>;
      };
      points_history: {
        Row: PointsHistory;
        Insert: Omit<PointsHistory, 'id' | 'created_at'>;
        Update: Partial<Omit<PointsHistory, 'id' | 'created_at'>>;
      };
      addresses: {
        Row: Address;
        Insert: Omit<Address, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Address, 'id' | 'created_at'>>;
      };
    };
  };
}

