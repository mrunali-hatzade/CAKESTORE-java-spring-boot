-- Flyway Migration V58: Add product review moderation schema
-- CakeStore SaaS Phase 2.9.5.1 Product Review Moderation

-- 1. Add moderation columns with default 'PUBLISHED' for zero-downtime backward compatibility
ALTER TABLE product_reviews
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS moderated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

-- 2. Ensure all existing reviews have status 'PUBLISHED'
UPDATE product_reviews
SET moderation_status = 'PUBLISHED'
WHERE moderation_status IS NULL;

-- 3. Add CHECK constraint allowing only 'PUBLISHED' and 'HIDDEN'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_reviews_moderation_status'
    ) THEN
        ALTER TABLE product_reviews
            ADD CONSTRAINT chk_product_reviews_moderation_status
            CHECK (moderation_status IN ('PUBLISHED', 'HIDDEN'));
    END IF;
END $$;

-- 4. Create performance indexes for moderation queries
CREATE INDEX IF NOT EXISTS idx_product_reviews_moderation_status
    ON product_reviews(moderation_status);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_moderation
    ON product_reviews(product_id, moderation_status);

CREATE INDEX IF NOT EXISTS idx_product_reviews_moderated_by
    ON product_reviews(moderated_by);

