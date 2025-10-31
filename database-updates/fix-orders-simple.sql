-- Orders tablosundaki TÜM trigger'ları kaldır ve sadece gerekli olanı ekle
-- Remove ALL triggers from orders table and add only necessary ones

-- 1. Orders tablosundaki TÜM trigger'ları kaldır (Drop ALL triggers on orders table)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'orders') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON orders CASCADE';
        RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
    END LOOP;
END $$;

-- 2. Sadece updated_at trigger'ını ekle (Add only updated_at trigger)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS policy'leri düzelt (Fix RLS policies)
-- Önce tüm policy'leri kaldır (Drop all policies)
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON orders;
DROP POLICY IF EXISTS "Enable update for admins" ON orders;

-- 4. Basit ve temiz policy'ler oluştur (Create simple and clean policies)
-- Kullanıcılar kendi siparişlerini görebilir veya admin ise tümünü görebilir
CREATE POLICY "orders_select_policy"
ON orders FOR SELECT
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Kullanıcılar kendi siparişlerini oluşturabilir
CREATE POLICY "orders_insert_policy"
ON orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi siparişlerini güncelleyebilir veya admin ise tümünü güncelleyebilir
CREATE POLICY "orders_update_policy"
ON orders FOR UPDATE
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. RLS'in aktif olduğundan emin ol (Make sure RLS is enabled)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 6. Test sorgusu (Test query)
SELECT 
    id,
    order_number,
    status,
    total_amount,
    user_id,
    created_at,
    updated_at
FROM orders
ORDER BY created_at DESC
LIMIT 3;

-- Başarılı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Orders tablosu temizlendi ve düzeltildi!';
    RAISE NOTICE '✅ Tüm eski trigger''lar kaldırıldı';
    RAISE NOTICE '✅ Sadece updated_at trigger''ı eklendi';
    RAISE NOTICE '✅ RLS policy''leri basitleştirildi';
END $$;

