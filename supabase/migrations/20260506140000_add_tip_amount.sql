-- Müşteri bahşişi (delivery driver tip)
-- Customer-entered tip routed to the delivery courier on delivery orders.
-- Stored in dollars; included in total_amount alongside delivery_fee.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10, 2) DEFAULT 0;
