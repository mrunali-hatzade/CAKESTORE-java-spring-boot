-- =========================================================================
-- V46: Storefront Website Phase 2 - Flexible Social Links & Address Privacy
-- =========================================================================

-- 1. Create table for flexible social media and custom external links
CREATE TABLE IF NOT EXISTS shop_social_links (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- INSTAGRAM, FACEBOOK, YOUTUBE, WHATSAPP, PINTEREST, TELEGRAM, LINKEDIN, TIKTOK, WEBSITE, CUSTOM
    title VARCHAR(100) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    icon_key VARCHAR(50),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_social_links_shop_order
    ON shop_social_links(shop_id, display_order ASC);

-- 2. Add home baker street address privacy toggle to shop_storefront_settings
ALTER TABLE shop_storefront_settings
    ADD COLUMN IF NOT EXISTS hide_street_address BOOLEAN NOT NULL DEFAULT FALSE;
