-- User Profiles Tablosu (User Profiles Table) - Eğer yoksa oluştur
-- Bu tablo kullanıcı profillerini ve rollerini saklar
-- This table stores user profiles and roles

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Kullanıcı bilgileri (User information)
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer', -- 'customer', 'admin'

  -- Puan sistemi (Points system)
  total_points INTEGER DEFAULT 0,

  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Rol kontrolü (Role validation)
  CONSTRAINT valid_role CHECK (role IN ('customer', 'admin'))
);

-- İndeksler (Indexes)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- RLS Politikaları (RLS Policies)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi profillerini görebilir (Users can view their own profile)
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kullanıcılar kendi profillerini güncelleyebilir (Users can update their own profile)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin'ler tüm profilleri görebilir (Admins can view all profiles)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- Trigger: Yeni kullanıcı için varsayılan profil oluştur
-- Trigger: Create default profile for new users
CREATE OR REPLACE FUNCTION create_default_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_profile();

-- Trigger: updated_at otomatik güncelleme (Auto-update updated_at)
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Notifications Table (Bildirimler Tablosu)
-- Bu tablo kullanıcılara gönderilen bildirimleri saklar
-- This table stores notifications sent to users

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bildirim içeriği (Notification content)
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL, -- 'order_status', 'points_earned', 'promotion', 'new_order_admin'
  
  -- İlişkili veriler (Related data)
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  data JSONB, -- Ek veriler (Additional data)
  
  -- Durum (Status)
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- İndeksler için (For indexes)
  CONSTRAINT valid_notification_type CHECK (type IN ('order_status', 'points_earned', 'promotion', 'new_order_admin', 'general'))
);

-- İndeksler (Indexes)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS Politikaları (RLS Policies)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi bildirimlerini görebilir (Users can only see their own notifications)
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kullanıcılar kendi bildirimlerini güncelleyebilir (okundu olarak işaretleme)
-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin'ler tüm bildirimleri görebilir (Admins can view all notifications)
CREATE POLICY "Admins can view all notifications"
  ON notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admin'ler bildirim oluşturabilir (Admins can create notifications)
CREATE POLICY "Admins can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admin'ler bildirimleri silebilir (Admins can delete notifications)
CREATE POLICY "Admins can delete notifications"
  ON notifications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Push Tokens Tablosu (Push Tokens Table)
-- Kullanıcıların push notification token'larını saklar
-- Stores users' push notification tokens

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token bilgileri (Token information)
  token TEXT NOT NULL UNIQUE,
  device_type TEXT, -- 'ios', 'android', 'web'
  device_name TEXT,
  
  -- Ayarlar (Settings)
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler (Indexes)
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_is_active ON push_tokens(is_active);

-- RLS Politikaları (RLS Policies)
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi token'larını görebilir (Users can view their own tokens)
CREATE POLICY "Users can view own tokens"
  ON push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kullanıcılar kendi token'larını ekleyebilir (Users can insert their own tokens)
CREATE POLICY "Users can insert own tokens"
  ON push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi token'larını güncelleyebilir (Users can update their own tokens)
CREATE POLICY "Users can update own tokens"
  ON push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Kullanıcılar kendi token'larını silebilir (Users can delete their own tokens)
CREATE POLICY "Users can delete own tokens"
  ON push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Notification Preferences Tablosu (Bildirim Tercihleri Tablosu)
-- Kullanıcıların bildirim tercihlerini saklar
-- Stores users' notification preferences

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bildirim tercihleri (Notification preferences)
  order_status_enabled BOOLEAN DEFAULT TRUE,
  points_enabled BOOLEAN DEFAULT TRUE,
  promotions_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  
  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler (Indexes)
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- RLS Politikaları (RLS Policies)
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi tercihlerini görebilir (Users can view their own preferences)
CREATE POLICY "Users can view own preferences"
  ON notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Kullanıcılar kendi tercihlerini ekleyebilir (Users can insert their own preferences)
CREATE POLICY "Users can insert own preferences"
  ON notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi tercihlerini güncelleyebilir (Users can update their own preferences)
CREATE POLICY "Users can update own preferences"
  ON notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger: Yeni kullanıcı için varsayılan bildirim tercihleri oluştur
-- Trigger: Create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Trigger: updated_at otomatik güncelleme (Auto-update updated_at)
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Trigger: push_tokens updated_at otomatik güncelleme
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Yorum ekle (Add comments)
COMMENT ON TABLE notifications IS 'Kullanıcılara gönderilen bildirimler';
COMMENT ON TABLE push_tokens IS 'Kullanıcıların push notification token''ları';
COMMENT ON TABLE notification_preferences IS 'Kullanıcıların bildirim tercihleri';

