-- Create app_settings table for global application settings
-- Uygulama ayarları tablosu oluştur

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE app_settings IS 'Global application settings managed by admin';

-- Insert default settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('app_country', 'canada', 'Application country: turkey or canada'),
  ('app_language', 'en', 'Application language: tr or en'),
  ('app_currency', 'CAD', 'Application currency: TRY or CAD')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);

-- Enable RLS (Row Level Security)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy: Everyone can read settings
CREATE POLICY "Anyone can read app settings"
  ON app_settings
  FOR SELECT
  USING (true);

-- Create policy: Only authenticated users can update settings (admin check should be done in app)
CREATE POLICY "Authenticated users can update app settings"
  ON app_settings
  FOR UPDATE
  USING (auth.role() = 'authenticated');

