-- Orders tablosundaki tüm trigger ve function'ları detaylı kontrol et
-- Debug orders table triggers and functions

-- 1. Orders tablosundaki tüm trigger'ları göster (Show all triggers on orders table)
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON p.proname = REPLACE(REPLACE(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '')
WHERE t.event_object_table = 'orders';

-- 2. Orders ile ilgili tüm function'ları göster (Show all functions related to orders)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%order%' 
   OR p.proname LIKE '%point%'
   OR pg_get_functiondef(p.oid) LIKE '%orders%'
ORDER BY p.proname;

-- 3. Orders tablosundaki tüm constraint'leri göster (Show all constraints)
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'orders';

-- 4. Settings tablosu yapısını göster (Show settings table structure)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'settings' 
ORDER BY ordinal_position;

-- 5. Tüm trigger'ları geçici olarak devre dışı bırak ve test et
-- (Temporarily disable all triggers and test)
ALTER TABLE orders DISABLE TRIGGER ALL;

-- Test update (bu çalışmalı)
-- UPDATE orders SET status = 'cancelled' WHERE id = 'TEST_ID';

-- Trigger'ları tekrar aktif et
ALTER TABLE orders ENABLE TRIGGER ALL;

-- Başarılı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Debug sorguları tamamlandı! Sonuçları inceleyin.';
END $$;

