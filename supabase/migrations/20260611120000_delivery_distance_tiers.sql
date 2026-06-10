-- Distance-based Uber delivery fee tiers (admin-configurable)
-- Müşteriye gösterilen teslimat ücreti artık restorana olan kuş uçuşu mesafeye
-- göre sabit tarifeden hesaplanır. Mesafe son kademenin üst sınırını aşarsa
-- teslimat kabul edilmez (uber-quote edge function bunu uygular).

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS delivery_tier1_max_km NUMERIC(6, 2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS delivery_tier1_fee    NUMERIC(10, 2) NOT NULL DEFAULT 5.99,
  ADD COLUMN IF NOT EXISTS delivery_tier2_max_km NUMERIC(6, 2) NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS delivery_tier2_fee    NUMERIC(10, 2) NOT NULL DEFAULT 8.99;

COMMENT ON COLUMN settings.delivery_tier1_max_km IS 'Yakın kademe üst sınırı (km, kuş uçuşu)';
COMMENT ON COLUMN settings.delivery_tier1_fee    IS 'Yakın kademe teslimat ücreti';
COMMENT ON COLUMN settings.delivery_tier2_max_km IS 'Uzak kademe üst sınırı (km). Bu mesafeyi aşan adreslere teslimat yapılmaz';
COMMENT ON COLUMN settings.delivery_tier2_fee    IS 'Uzak kademe teslimat ücreti';
