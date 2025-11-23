-- Admin Contact Settings için RLS politikaları
-- Bu dosyayı Supabase Dashboard > SQL Editor'de çalıştırın

-- Önce mevcut politikaları kontrol et ve varsa sil
DROP POLICY IF EXISTS "Admin users can read contact settings" ON app_settings;
DROP POLICY IF EXISTS "Admin users can upsert contact settings" ON app_settings;
DROP POLICY IF EXISTS "Admin users can update contact settings" ON app_settings;

-- Admin kullanıcılar contact settings okuyabilir
CREATE POLICY "Admin users can read contact settings"
ON app_settings
FOR SELECT
TO authenticated
USING (
  setting_key IN (
    'contact_phone1',
    'contact_phone2', 
    'contact_email',
    'contact_address1',
    'contact_address2',
    'social_facebook',
    'social_instagram',
    'social_whatsapp'
  )
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Admin kullanıcılar contact settings güncelleyebilir/ekleyebilir
CREATE POLICY "Admin users can upsert contact settings"
ON app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  setting_key IN (
    'contact_phone1',
    'contact_phone2',
    'contact_email',
    'contact_address1',
    'contact_address2',
    'social_facebook',
    'social_instagram',
    'social_whatsapp'
  )
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Admin kullanıcılar contact settings güncelleyebilir
CREATE POLICY "Admin users can update contact settings"
ON app_settings
FOR UPDATE
TO authenticated
USING (
  setting_key IN (
    'contact_phone1',
    'contact_phone2',
    'contact_email',
    'contact_address1',
    'contact_address2',
    'social_facebook',
    'social_instagram',
    'social_whatsapp'
  )
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
)
WITH CHECK (
  setting_key IN (
    'contact_phone1',
    'contact_phone2',
    'contact_email',
    'contact_address1',
    'contact_address2',
    'social_facebook',
    'social_instagram',
    'social_whatsapp'
  )
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Varsayılan değerleri ekle (eğer yoksa)
INSERT INTO app_settings (setting_key, setting_value)
VALUES 
  ('contact_phone1', '+1 (416) 850-7026'),
  ('contact_phone2', '+1 (416) 935-6600'),
  ('contact_email', 'riversideburgerss@gmail.com'),
  ('contact_address1', E'688 Queen Street East\nToronto, Ontario'),
  ('contact_address2', E'1228 King St W\nToronto, Ontario'),
  ('social_facebook', 'https://www.facebook.com/riversideburgers'),
  ('social_instagram', 'https://www.instagram.com/riversideburgers'),
  ('social_whatsapp', '+14168507026')
ON CONFLICT (setting_key) DO NOTHING;

