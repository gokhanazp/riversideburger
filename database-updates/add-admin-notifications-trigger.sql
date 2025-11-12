-- Admin Bildirim Trigger'ları (Admin Notification Triggers)
-- Yeni sipariş ve yorum geldiğinde admin kullanıcılarına bildirim gönderir
-- Sends notifications to admin users when new orders and reviews are created

-- 1. Yeni sipariş geldiğinde admin'lere bildirim gönder
-- Send notification to admins when new order is created
CREATE OR REPLACE FUNCTION notify_admins_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_customer_name TEXT;
  v_order_total DECIMAL;
BEGIN
  -- Müşteri bilgilerini al (Get customer info)
  SELECT full_name INTO v_customer_name
  FROM users
  WHERE id = NEW.user_id;
  
  v_order_total := NEW.total_amount;
  
  -- Tüm admin kullanıcılarına bildirim oluştur (Create notification for all admin users)
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
      '🔔 Yeni Sipariş!',
      COALESCE(v_customer_name, 'Müşteri') || ' - ₺' || v_order_total::TEXT,
      'new_order_admin',
      NEW.id,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'customer_name', v_customer_name,
        'total', v_order_total
      ),
      FALSE
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur (Create trigger)
DROP TRIGGER IF EXISTS trigger_notify_admins_on_new_order ON orders;
CREATE TRIGGER trigger_notify_admins_on_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_order();

-- 2. Yeni yorum geldiğinde admin'lere bildirim gönder
-- Send notification to admins when new review is created
CREATE OR REPLACE FUNCTION notify_admins_on_new_review()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_customer_name TEXT;
  v_product_name TEXT;
  v_rating INTEGER;
BEGIN
  -- Müşteri bilgilerini al (Get customer info)
  SELECT full_name INTO v_customer_name
  FROM users
  WHERE id = NEW.user_id;
  
  -- Ürün bilgilerini al (Get product info)
  SELECT name INTO v_product_name
  FROM products
  WHERE id = NEW.product_id;
  
  v_rating := NEW.rating;
  
  -- Tüm admin kullanıcılarına bildirim oluştur (Create notification for all admin users)
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
      '⭐ Yeni Yorum!',
      COALESCE(v_customer_name, 'Müşteri') || ' - ' || COALESCE(v_product_name, 'Ürün') || ' (' || v_rating || ' yıldız)',
      'new_review_admin',
      NEW.order_id,
      jsonb_build_object(
        'review_id', NEW.id,
        'customer_name', v_customer_name,
        'product_name', v_product_name,
        'rating', v_rating,
        'comment', NEW.comment
      ),
      FALSE
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur (Create trigger)
DROP TRIGGER IF EXISTS trigger_notify_admins_on_new_review ON reviews;
CREATE TRIGGER trigger_notify_admins_on_new_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_review();

-- Başarı mesajı (Success message)
DO $$
BEGIN
  RAISE NOTICE '✅ Admin bildirim trigger''ları başarıyla oluşturuldu!';
  RAISE NOTICE '   - Yeni sipariş bildirimi: trigger_notify_admins_on_new_order';
  RAISE NOTICE '   - Yeni yorum bildirimi: trigger_notify_admins_on_new_review';
END $$;

