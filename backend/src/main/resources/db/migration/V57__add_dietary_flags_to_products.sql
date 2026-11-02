-- Flyway Migration V57: Add dietary flags and indexes to products table
-- CakeStore SaaS Phase 2.4 Marketplace Dietary Discovery

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_eggless BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill is_eggless for existing products based on existing egg choice configuration
UPDATE products
SET is_eggless = TRUE
WHERE (allow_egg_choice = TRUE OR egg_preference_default = 'EGGLESS')
  AND is_eggless = FALSE;

-- Composite index for high-performance marketplace dietary filtering and active status verification
CREATE INDEX IF NOT EXISTS idx_products_shop_dietary_status
    ON products (shop_id, status, availability, is_deleted, is_eggless, is_vegan, is_gluten_free);

