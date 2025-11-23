-- Enable Realtime for Orders Table
-- Supabase Realtime için orders tablosunda replication'ı etkinleştir
-- Enable replication on orders table for Supabase Realtime

-- 1. Realtime publication'a orders tablosunu ekle
-- Add orders table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 2. Kontrol et (Check if it's enabled)
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'orders';

-- Başarı mesajı (Success message)
DO $$
BEGIN
  RAISE NOTICE '✅ Realtime orders tablosu için etkinleştirildi!';
  RAISE NOTICE 'ℹ️ Supabase Dashboard > Database > Replication bölümünden de kontrol edebilirsiniz.';
END $$;

