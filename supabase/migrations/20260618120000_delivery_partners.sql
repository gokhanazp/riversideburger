-- Delivery Partners management
-- Teslimat ortakları yönetimi (admin panelden yönetilebilir)

-- 1) delivery_partners tablosu (admin tarafından yönetilen teslimat ortakları)
CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  logo_url TEXT NOT NULL,
  link_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mevcut 3 ortağı varsayılan olarak ekle (seed existing partners)
INSERT INTO delivery_partners (name, logo_url, link_url, display_order, is_active) VALUES
  ('DoorDash', 'https://riversideburgers.ca/wp-content/uploads/elementor/thumbs/Food-delivery-icon-doordash-ozl8cebv125k1p7ay7gbam8zbts7ubzyb2nrjyb3l4.png', NULL, 1, true),
  ('Uber Eats', 'https://riversideburgers.ca/wp-content/uploads/elementor/thumbs/Food-delivery-icon-ubereats-ozl8dodybxwlulceh9d16smkfph7bi2stemk2iet48.png', NULL, 2, true),
  ('SkipTheDishes', 'https://riversideburgers.ca/wp-content/uploads/elementor/thumbs/skipthedishes@162px-ozl8vrs3w4obcd27tkxhoq903qakhqwsayq1n9kzc8.png', NULL, 3, true)
ON CONFLICT DO NOTHING;

-- 2) Bölümün komple aç/kapa ayarı (master on/off for the whole home section)
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('home_delivery_partners_enabled', 'true', 'Show the Delivery Partners section on the home screen')
ON CONFLICT (setting_key) DO NOTHING;

-- Index'ler (performans için)
CREATE INDEX IF NOT EXISTS idx_delivery_partners_display_order ON delivery_partners(display_order);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_is_active ON delivery_partners(is_active);

-- RLS (Satır düzeyinde güvenlik)
ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active delivery partners"
  ON delivery_partners
  FOR SELECT
  USING (is_active = true OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert delivery partners"
  ON delivery_partners
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update delivery partners"
  ON delivery_partners
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete delivery partners"
  ON delivery_partners
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Açıklamalar (comments)
COMMENT ON TABLE delivery_partners IS 'Delivery partner logos shown on the home screen, managed by admin';
COMMENT ON COLUMN delivery_partners.name IS 'Partner display name (e.g. DoorDash)';
COMMENT ON COLUMN delivery_partners.logo_url IS 'Partner logo image URL';
COMMENT ON COLUMN delivery_partners.link_url IS 'Optional URL opened when the logo is tapped';
COMMENT ON COLUMN delivery_partners.display_order IS 'Display order (lower numbers first)';
COMMENT ON COLUMN delivery_partners.is_active IS 'Whether this partner is shown';
