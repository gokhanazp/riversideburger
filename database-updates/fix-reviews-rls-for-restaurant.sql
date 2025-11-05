-- Fix Reviews RLS Policies for Restaurant Reviews
-- Restoran yorumları için RLS politikalarını düzelt

-- 1. Önce mevcut INSERT politikasını kaldır (Drop existing INSERT policy)
DROP POLICY IF EXISTS "Users can create reviews for own orders" ON reviews;

-- 2. Yeni INSERT politikası - hem ürün hem restoran yorumları için (New INSERT policy - for both product and restaurant reviews)
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

-- 3. Başarılı mesajı (Success message)
DO $$
BEGIN
    RAISE NOTICE '✅ Reviews RLS politikaları restoran yorumları için güncellendi!';
    RAISE NOTICE '   - Kullanıcılar artık hem ürün hem de restoran yorumu yapabilir';
    RAISE NOTICE '   - Ürün yorumları için sipariş kontrolü devam ediyor';
    RAISE NOTICE '   - Restoran yorumları için order_id ve product_id null olabilir';
END $$;

