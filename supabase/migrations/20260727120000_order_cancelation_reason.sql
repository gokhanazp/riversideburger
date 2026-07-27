-- Order cancelation reason (Uber Direct certification)
-- Bir sipariş iptal edildiğinde Uber'e gönderilen iptal sebebini ve açıklamasını saklar.
-- Uber cancel endpoint'i cancelation_reason (önceden tanımlı liste) ister;
-- "other" seçildiğinde additional_description zorunludur.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelation_reason      TEXT,
  ADD COLUMN IF NOT EXISTS cancelation_description TEXT;

COMMENT ON COLUMN orders.cancelation_reason IS
  'Uber Direct cancelation_reason: out_of_items | store_closed | customer_called_to_cancel | store_too_busy | courier_delayed_en_route_to_pickup | too_expensive | customer_changed_order_requirements | delivery_vehicle_too_small | no_courier_assigned | other';
COMMENT ON COLUMN orders.cancelation_description IS
  'Uber additional_description — "other" sebebi için zorunlu, diğerlerinde opsiyonel ek bağlam.';
