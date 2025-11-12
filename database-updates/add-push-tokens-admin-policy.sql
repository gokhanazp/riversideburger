-- Push Tokens Admin Policy
-- Admin kullanıcılarının tüm push token'lara erişmesini sağlar
-- Allows admin users to access all push tokens for sending notifications

-- Admin'ler tüm token'ları görebilir (Admins can view all tokens)
CREATE POLICY "Admins can view all tokens"
  ON push_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Başarı mesajı (Success message)
DO $$
BEGIN
  RAISE NOTICE '✅ Push tokens admin policy oluşturuldu!';
END $$;

