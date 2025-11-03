-- Fix RLS Policies for Notifications (Bildirim RLS Politikalarını Düzelt)
-- Sonsuz döngü hatasını düzelt (Fix infinite recursion error)

-- Önce mevcut politikaları kaldır (Drop existing policies)
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;

-- Yeni politikalar - auth.jwt() kullanarak (New policies - using auth.jwt())
-- Bu şekilde user_profiles tablosuna referans vermeden admin kontrolü yapabiliriz
-- This way we can check admin role without referencing user_profiles table

-- Admin'ler bildirim oluşturabilir (Admins can create notifications)
CREATE POLICY "Admins can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin'ler tüm bildirimleri görebilir (Admins can view all notifications)
CREATE POLICY "Admins can view all notifications"
  ON notifications
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin'ler bildirimleri silebilir (Admins can delete notifications)
CREATE POLICY "Admins can delete notifications"
  ON notifications
  FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Test için: Mevcut politikaları listele (List existing policies for testing)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

