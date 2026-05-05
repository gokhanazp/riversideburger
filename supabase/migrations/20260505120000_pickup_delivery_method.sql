-- Pickup vs Delivery seçeneği + admin notification para birimi düzeltmesi
-- Creation Date: 2026-05-05


-- ============================================================================
-- 1. orders tablosuna delivery_method kolonu ekle
--    (Add delivery_method column: 'pickup' or 'delivery')
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'delivery'
  CHECK (delivery_method IN ('pickup', 'delivery'));


-- ============================================================================
-- 2. Admin sipariş bildiriminde para birimi sembolünü düzelt
--    (Fix currency symbol in admin order notification: ₺ → $)
--    Restoran Kanada'da olduğu için CAD '$' sabit
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_admins_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_customer_name TEXT;
  v_order_total DECIMAL;
  v_method_label TEXT;
BEGIN
  SELECT full_name INTO v_customer_name
  FROM users
  WHERE id = NEW.user_id;

  v_order_total := NEW.total_amount;
  v_method_label := CASE WHEN NEW.delivery_method = 'pickup' THEN ' [Pickup]' ELSE '' END;

  FOR v_admin_id IN
    SELECT id FROM users WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (
      user_id,
      title,
      body,
      type,
      order_id,
      data,
      is_read
    ) VALUES (
      v_admin_id,
      '🔔 Yeni Sipariş!' || v_method_label,
      COALESCE(v_customer_name, 'Müşteri') || ' - $' || TO_CHAR(v_order_total, 'FM999990.00'),
      'new_order_admin',
      NEW.id,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'customer_name', v_customer_name,
        'total', v_order_total,
        'delivery_method', NEW.delivery_method
      ),
      FALSE
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
