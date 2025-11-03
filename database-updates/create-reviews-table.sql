-- Reviews Tablosu Oluştur (Create Reviews Table)
-- Sipariş değerlendirme ve yorum sistemi
-- Order review and rating system
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Reviews tablosunu oluştur (Create reviews table)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- İlişkiler (Relations)
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Değerlendirme (Rating)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Yorum (Comment)
  comment TEXT,
  
  -- Fotoğraflar (Images) - JSON array olarak saklanacak
  images TEXT[], -- ['url1', 'url2', 'url3']
  
  -- Admin onayı (Admin approval)
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Reddedilme durumu (Rejection status)
  is_rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  
  -- Zaman damgaları (Timestamps)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Bir sipariş için bir ürüne sadece bir kez yorum yapılabilir
  -- (One review per product per order)
  UNIQUE(order_id, product_id)
);

-- 2. İndeksler oluştur (Create indexes)
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- Onaylanmış yorumlar için composite index (Composite index for approved reviews)
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved ON reviews(product_id, is_approved) 
WHERE is_approved = true;

-- 3. Trigger fonksiyonu - updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur (Create trigger)
DROP TRIGGER IF EXISTS reviews_updated_at_trigger ON reviews;
CREATE TRIGGER reviews_updated_at_trigger
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- 4. RLS (Row Level Security) politikalarını ayarla
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi yorumlarını görebilir (Users can view their own reviews)
DROP POLICY IF EXISTS "Users can view own reviews" ON reviews;
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Herkes onaylanmış yorumları görebilir (Everyone can view approved reviews)
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews;
CREATE POLICY "Anyone can view approved reviews"
  ON reviews FOR SELECT
  USING (is_approved = true AND is_rejected = false);

-- Kullanıcılar kendi siparişlerine yorum yapabilir (Users can create reviews for their orders)
DROP POLICY IF EXISTS "Users can create reviews for own orders" ON reviews;
CREATE POLICY "Users can create reviews for own orders"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_id 
      AND orders.user_id = auth.uid()
      AND orders.status = 'delivered' -- Sadece teslim edilen siparişler için
    )
  );

-- Kullanıcılar kendi yorumlarını güncelleyebilir (sadece onaylanmamışsa)
-- (Users can update their own reviews, only if not approved yet)
DROP POLICY IF EXISTS "Users can update own pending reviews" ON reviews;
CREATE POLICY "Users can update own pending reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_approved = false)
  WITH CHECK (user_id = auth.uid() AND is_approved = false);

-- Kullanıcılar kendi yorumlarını silebilir (Users can delete their own reviews)
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin kullanıcılar tüm yorumları görebilir (Admin users can view all reviews)
DROP POLICY IF EXISTS "Admins can view all reviews" ON reviews;
CREATE POLICY "Admins can view all reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin kullanıcılar yorumları onaylayabilir/reddedebilir (Admin users can approve/reject reviews)
DROP POLICY IF EXISTS "Admins can update reviews" ON reviews;
CREATE POLICY "Admins can update reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin kullanıcılar yorumları silebilir (Admin users can delete reviews)
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;
CREATE POLICY "Admins can delete reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 5. View oluştur - Ürün ortalama puanları için (Create view for product average ratings)
CREATE OR REPLACE VIEW product_ratings AS
SELECT 
  product_id,
  COUNT(*) as review_count,
  ROUND(AVG(rating)::numeric, 1) as average_rating,
  COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
  COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
  COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
  COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
  COUNT(*) FILTER (WHERE rating = 1) as one_star_count
FROM reviews
WHERE is_approved = true AND is_rejected = false
GROUP BY product_id;

-- View için RLS (RLS for view)
ALTER VIEW product_ratings SET (security_invoker = true);

-- 6. Fonksiyon - Kullanıcının bir siparişi değerlendirip değerlendirmediğini kontrol et
-- (Function - Check if user has reviewed an order)
CREATE OR REPLACE FUNCTION has_user_reviewed_order(p_order_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM reviews 
    WHERE order_id = p_order_id 
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fonksiyon - Ürünün değerlendirilebilir olup olmadığını kontrol et
-- (Function - Check if product can be reviewed by user)
CREATE OR REPLACE FUNCTION can_review_product(p_order_id UUID, p_product_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = p_order_id
    AND o.user_id = p_user_id
    AND o.status = 'delivered'
    AND oi.product_id = p_product_id
    AND NOT EXISTS (
      SELECT 1 FROM reviews 
      WHERE order_id = p_order_id 
      AND product_id = p_product_id
      AND user_id = p_user_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Test verisi ekle (Insert test data) - Opsiyonel
-- Bu kısmı test için kullanabilirsiniz, production'da çalıştırmayın

/*
-- Örnek yorum (Example review)
INSERT INTO reviews (order_id, user_id, product_id, rating, comment, is_approved)
VALUES (
  'order-uuid-here',
  'user-uuid-here',
  'product-uuid-here',
  5,
  'Harika bir burger! Çok lezzetliydi, kesinlikle tekrar sipariş vereceğim.',
  false -- Admin onayı bekliyor
);
*/

-- ✅ Tablo başarıyla oluşturuldu!
-- ✅ Table created successfully!

