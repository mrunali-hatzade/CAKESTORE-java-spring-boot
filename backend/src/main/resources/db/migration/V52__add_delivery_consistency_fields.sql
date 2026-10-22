-- V52: Add delivery consistency fields to shop_delivery_configs and orders

-- 1. Add delivery_enabled toggle to shop_delivery_configs
ALTER TABLE shop_delivery_configs
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add fulfillment_method to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_method VARCHAR(50) NOT NULL DEFAULT 'HOME_DELIVERY';

-- 3. Ensure any existing shops that do not have a shop_delivery_configs row receive the authoritative default
INSERT INTO shop_delivery_configs (shop_id, delivery_charge_type, fixed_charge_amount, min_order_for_free_delivery, delivery_enabled)
SELECT s.id, 'FIXED', 50.00, 1000.00, TRUE
FROM shops s
WHERE NOT EXISTS (SELECT 1 FROM shop_delivery_configs dc WHERE dc.shop_id = s.id);
