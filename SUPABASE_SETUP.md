# 🗄️ Supabase Kurulum Rehberi

Bu dosya, uygulamanıza Supabase backend'ini entegre etmek için adım adım talimatlar içerir.

## 📋 Supabase Nedir?

Supabase, açık kaynaklı bir Firebase alternatifidir ve şunları sağlar:
- PostgreSQL veritabanı
- Real-time subscriptions
- Authentication (Kimlik doğrulama)
- Storage (Dosya depolama)
- REST API

## 🚀 Kurulum Adımları

### 1. Supabase Hesabı Oluşturma

1. [supabase.com](https://supabase.com) adresine gidin
2. "Start your project" butonuna tıklayın
3. GitHub hesabınızla giriş yapın
4. Yeni bir organizasyon oluşturun
5. Yeni bir proje oluşturun:
   - Proje adı: `mobile-restaurant`
   - Database şifresi: Güçlü bir şifre belirleyin (kaydedin!)
   - Region: En yakın bölgeyi seçin (Europe West için Frankfurt)

### 2. Supabase Client Kurulumu

```bash
npm install @supabase/supabase-js
```

### 3. Environment Variables

Proje kök dizininde `.env` dosyası oluşturun:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Not**: Supabase dashboard'unuzdan bu bilgileri alabilirsiniz:
- Settings > API > Project URL
- Settings > API > Project API keys > anon public

### 4. Supabase Client Oluşturma

`src/services/supabase.ts` dosyası oluşturun:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## 🗃️ Database Şeması

### Tablolar

#### 1. `menu_items` Tablosu

```sql
CREATE TABLE menu_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  image TEXT,
  available BOOLEAN DEFAULT true,
  preparation_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index oluştur
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);
```

#### 2. `orders` Tablosu

```sql
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  table_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index oluştur
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

#### 3. `order_items` Tablosu

```sql
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index oluştur
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

#### 4. `users` Tablosu (Profil bilgileri için)

```sql
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
```

### Row Level Security (RLS) Politikaları

```sql
-- menu_items için RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu items are viewable by everyone"
  ON menu_items FOR SELECT
  USING (true);

-- orders için RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- order_items için RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );
```

## 📝 Örnek Veri Ekleme

Supabase SQL Editor'de çalıştırın:

```sql
INSERT INTO menu_items (name, description, price, category, image, available, preparation_time)
VALUES
  ('Margherita Pizza', 'Klasik domates sosu, mozzarella peyniri ve fesleğen', 89.90, 'pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400', true, 15),
  ('Pepperoni Pizza', 'Domates sosu, mozzarella ve bol pepperoni', 99.90, 'pizza', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400', true, 15),
  ('Klasik Burger', 'Dana eti, marul, domates, turşu, özel sos', 79.90, 'burger', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', true, 12);
```

## 🔧 API Servisleri

### Menu Service

`src/services/menuService.ts` dosyası oluşturun:

```typescript
import { supabase } from './supabase';
import { MenuItem } from '../types';

export const menuService = {
  // Tüm menü öğelerini getir
  async getAllItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Kategoriye göre menü öğelerini getir
  async getItemsByCategory(category: string): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('category', category)
      .eq('available', true);

    if (error) throw error;
    return data || [];
  },

  // Tek bir menü öğesini getir
  async getItemById(id: string): Promise<MenuItem | null> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },
};
```

### Order Service

`src/services/orderService.ts` dosyası oluşturun:

```typescript
import { supabase } from './supabase';
import { Order, CartItem } from '../types';

export const orderService = {
  // Sipariş oluştur
  async createOrder(
    items: CartItem[],
    totalAmount: number,
    tableNumber?: string,
    notes?: string
  ): Promise<Order> {
    // Önce siparişi oluştur
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        total_amount: totalAmount,
        status: 'pending',
        table_number: tableNumber,
        notes: notes,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Sipariş öğelerini ekle
    const orderItems = items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return order;
  },

  // Kullanıcının siparişlerini getir
  async getUserOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          menu_items (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Sipariş durumunu güncelle
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;
  },
};
```

## 🔐 Authentication (Opsiyonel)

### Email/Password ile Kayıt

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});
```

### Giriş

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});
```

### Çıkış

```typescript
const { error } = await supabase.auth.signOut();
```

## 📱 Real-time Subscriptions

Sipariş durumu değişikliklerini dinleme:

```typescript
const subscription = supabase
  .channel('orders')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
    },
    (payload) => {
      console.log('Order updated:', payload);
    }
  )
  .subscribe();

// Cleanup
subscription.unsubscribe();
```

## 🎯 Sonraki Adımlar

1. ✅ Supabase hesabı oluşturun
2. ✅ Database şemasını oluşturun
3. ✅ Örnek verileri ekleyin
4. ✅ Environment variables'ı ayarlayın
5. ✅ Supabase client'ı kurun
6. ✅ API servislerini entegre edin
7. ✅ Authentication ekleyin (opsiyonel)
8. ✅ Real-time özelliklerini test edin

## 📚 Kaynaklar

- [Supabase Dokümantasyonu](https://supabase.com/docs)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [PostgreSQL Dokümantasyonu](https://www.postgresql.org/docs/)

---

**Not**: Bu rehber temel bir kurulum içindir. Production ortamı için ek güvenlik önlemleri ve optimizasyonlar gereklidir.

