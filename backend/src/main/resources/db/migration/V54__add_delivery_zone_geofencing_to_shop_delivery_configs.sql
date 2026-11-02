-- ====================================================================
-- CAKESTORE FLYWAY MIGRATION V54: DELIVERY ZONE GEOFENCING
-- Adds maximum delivery radius in kilometers and serviceable PIN codes.
-- Fully backward-compatible; NULL values preserve legacy unrestricted delivery.
-- ====================================================================

-- 1. Add maximum delivery radius in kilometers (nullable)
ALTER TABLE shop_delivery_configs
ADD COLUMN IF NOT EXISTS max_delivery_radius_km DOUBLE PRECISION;

-- 2. Add comma-separated or text serviceable PIN codes (nullable)
ALTER TABLE shop_delivery_configs
ADD COLUMN IF NOT EXISTS serviceable_pincodes TEXT;

-- 3. Document column comments for DB administrators
COMMENT ON COLUMN shop_delivery_configs.max_delivery_radius_km IS 'Maximum delivery service radius in kilometers from shop location. NULL means unrestricted radius.';
COMMENT ON COLUMN shop_delivery_configs.serviceable_pincodes IS 'Comma-separated list of 6-digit Indian PIN codes serviceable for home delivery. NULL or empty means all pincodes within radius are serviceable.';

