-- ============================================
-- KAMPANYA MODÜLÜ - DATABASE SCHEMA
-- Riverside Burgers - Campaigns / Promotions
-- ============================================
-- Supabase SQL Editor'de çalıştırın. Uygulama build'inden ÖNCE.
-- (Run in Supabase SQL Editor BEFORE deploying the new app build.)

-- 1. Campaigns tablosu (Campaigns table)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name_tr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_tr TEXT,
  description_en TEXT,

  -- Kampanya tipi (Campaign type)
  --  first_order   : İlk siparişe yüzde indirim (percentage on first order)
  --  percentage    : Yüzde indirim (tüm sepet / kategori / ürün)
  --  buy_x_get_y   : X al Y bedava — en ucuz ürün(ler) ücretsiz (BOGO, 3 al 2 öde)
  type TEXT NOT NULL CHECK (type IN ('first_order', 'percentage', 'buy_x_get_y')),

  -- first_order + percentage için
  discount_percent NUMERIC(5, 2) DEFAULT 0,

  -- buy_x_get_y için: buy_quantity kadar öde, free_quantity kadar bedava
  --  1 alana 1 bedava -> buy_quantity=1, free_quantity=1  (2'li grup, 1 bedava)
  --  3 al 2 öde       -> buy_quantity=2, free_quantity=1  (3'lü grup, 1 bedava)
  buy_quantity INT DEFAULT 1,
  free_quantity INT DEFAULT 1,

  -- Hedefleme (Targeting): tüm sepet / kategori / ürün
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'category', 'product')),
  target_category_ids UUID[] DEFAULT '{}',
  target_product_ids UUID[] DEFAULT '{}',

  -- Koşullar (Conditions)
  min_order_amount NUMERIC(10, 2) DEFAULT 0,       -- Minimum sepet tutarı
  starts_at TIMESTAMP WITH TIME ZONE,              -- Başlangıç (null = hemen)
  ends_at TIMESTAMP WITH TIME ZONE,                -- Bitiş (null = süresiz)
  per_customer_limit INT,                          -- Müşteri başına kullanım (null = sınırsız)

  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,                           -- Eşitlikte öncelik (tie-break)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);

-- 2. Orders tablosuna kampanya alanları (Campaign fields on orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_campaign_id ON orders(campaign_id);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaigns_updated_at_trigger ON campaigns;
CREATE TRIGGER campaigns_updated_at_trigger
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

-- 4. RLS Politikaları (RLS Policies)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Herkes AKTİF kampanyaları görebilir (customers need to read active campaigns)
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON campaigns;
CREATE POLICY "Anyone can view active campaigns"
ON campaigns FOR SELECT
USING (is_active = TRUE);

-- Admin tüm kampanyaları görebilir (Admins can view all campaigns)
DROP POLICY IF EXISTS "Admins can view all campaigns" ON campaigns;
CREATE POLICY "Admins can view all campaigns"
ON campaigns FOR SELECT
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Admin kampanya oluşturabilir/güncelleyebilir/silebilir (Admins manage campaigns)
DROP POLICY IF EXISTS "Admins can insert campaigns" ON campaigns;
CREATE POLICY "Admins can insert campaigns"
ON campaigns FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update campaigns" ON campaigns;
CREATE POLICY "Admins can update campaigns"
ON campaigns FOR UPDATE
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can delete campaigns" ON campaigns;
CREATE POLICY "Admins can delete campaigns"
ON campaigns FOR DELETE
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- TAMAMLANDI! (COMPLETED!)
-- ============================================
