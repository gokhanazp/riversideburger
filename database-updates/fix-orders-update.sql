-- Orders tablosunu kontrol et ve düzelt (Check and fix orders table)
-- Bu SQL orders tablosundaki trigger ve RLS policy'leri düzeltir

-- 1. Mevcut orders tablosu yapısını göster (Show current orders table structure)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- 2. Mevcut trigger'ları göster (Show current triggers)
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'orders';

-- 3. Mevcut RLS policy'leri göster (Show current RLS policies)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'orders';

-- 4. Eğer sorunlu trigger varsa sil ve yeniden oluştur (Drop and recreate trigger if problematic)
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

-- 5. Updated_at trigger'ını yeniden oluştur (Recreate updated_at trigger)
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

-- 6. RLS policy'leri düzelt (Fix RLS policies)
-- Önce mevcut policy'leri sil (Drop existing policies)
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;

-- Yeni policy'ler oluştur (Create new policies)
-- Kullanıcılar kendi siparişlerini görebilir (Users can view their own orders)
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
USING (
    auth.uid() = user_id 
    OR 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Kullanıcılar kendi siparişlerini oluşturabilir (Users can create their own orders)
CREATE POLICY "Users can create their own orders"
ON orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi siparişlerini iptal edebilir (Users can cancel their own orders)
CREATE POLICY "Users can update their own orders"
ON orders FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Adminler tüm siparişleri görebilir (Admins can view all orders)
CREATE POLICY "Admins can view all orders"
ON orders FOR SELECT
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Adminler tüm siparişleri güncelleyebilir (Admins can update all orders)
CREATE POLICY "Admins can update all orders"
ON orders FOR UPDATE
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- 7. Test sorgusu (Test query)
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
LIMIT 5;

-- Başarılı mesajı (Success message)
DO $$
BEGIN
    RAISE NOTICE '✅ Orders tablosu trigger ve RLS policy''leri düzeltildi!';
END $$;

