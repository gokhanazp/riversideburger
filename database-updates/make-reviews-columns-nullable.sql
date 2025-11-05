-- Make Reviews Columns Nullable for Restaurant Reviews
-- Restoran yorumları için reviews tablosu kolonlarını nullable yap

-- 1. order_id kolonunu nullable yap (Make order_id nullable)
ALTER TABLE reviews 
ALTER COLUMN order_id DROP NOT NULL;

-- 2. product_id kolonunu nullable yap (Make product_id nullable)
ALTER TABLE reviews 
ALTER COLUMN product_id DROP NOT NULL;

-- 3. Mevcut INSERT politikasını kaldır (Drop existing INSERT policy)
DROP POLICY IF EXISTS "Users can create reviews for own orders" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;

-- 4. Yeni INSERT politikası - hem ürün hem restoran yorumları için (New INSERT policy - for both product and restaurant reviews)
CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND (
      -- Ürün yorumu için: sipariş kontrolü (For product review: check order)
      (
        product_id IS NOT NULL 
        AND order_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM orders 
          WHERE orders.id = order_id 
          AND orders.user_id = auth.uid()
          AND orders.status = 'delivered'
        )
      )
      OR
      -- Restoran yorumu için: sadece kullanıcı kontrolü (For restaurant review: just user check)
      (
        product_id IS NULL 
        AND order_id IS NULL
      )
    )
  );

-- 5. Tablo yorumunu güncelle (Update table comment)
COMMENT ON TABLE reviews IS 'Reviews table - supports both product reviews (with product_id and order_id) and restaurant reviews (with null product_id and order_id)';
COMMENT ON COLUMN reviews.product_id IS 'Product ID for product reviews, NULL for restaurant reviews';
COMMENT ON COLUMN reviews.order_id IS 'Order ID for product reviews, NULL for restaurant reviews';

-- 6. Başarılı mesajı (Success message)
DO $$
BEGIN
    RAISE NOTICE '✅ Reviews tablosu restoran yorumları için güncellendi!';
    RAISE NOTICE '   - order_id artık nullable';
    RAISE NOTICE '   - product_id artık nullable';
    RAISE NOTICE '   - RLS politikası hem ürün hem restoran yorumları için çalışıyor';
    RAISE NOTICE '   - Ürün yorumları: product_id ve order_id dolu olmalı';
    RAISE NOTICE '   - Restoran yorumları: product_id ve order_id null olmalı';
END $$;

