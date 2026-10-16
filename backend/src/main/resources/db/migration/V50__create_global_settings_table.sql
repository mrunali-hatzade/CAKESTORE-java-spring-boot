-- =========================================================================
-- V50: Create global_settings Table
-- =========================================================================
-- Defines platform-level settings and payment gateway configurations.
-- Matches JPA entity com.cakeplatform.api.modules.settings.GlobalSettings.
-- Safe for fresh databases and existing environments (idempotent DDL & seed).
-- =========================================================================

CREATE TABLE IF NOT EXISTS global_settings (
    id BIGINT PRIMARY KEY,
    platform_name VARCHAR(255) DEFAULT 'CakeStore',
    support_email VARCHAR(255) DEFAULT 'support@cakestore.com',
    razorpay_key_id VARCHAR(255),
    razorpay_key_secret VARCHAR(500),
    razorpay_webhook_secret VARCHAR(500),
    platform_currency VARCHAR(10) DEFAULT 'INR',
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- Seed singleton configuration row (id = 1) if not already present.
-- Safe non-secret defaults; preserves any existing configuration or secrets.
INSERT INTO global_settings (id, platform_name, support_email, platform_currency, updated_at)
VALUES (1, 'CakeStore', 'support@cakestore.com', 'INR', NOW())
ON CONFLICT (id) DO NOTHING;
