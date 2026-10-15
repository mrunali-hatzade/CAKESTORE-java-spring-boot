-- =========================================================================
-- V47: Add Marketplace Restriction, Operational Status & Subscription Non-Renewal Intent
-- =========================================================================

-- 1. Owner operational toggle (vacation mode / store open-close toggle)
ALTER TABLE shops 
    ADD COLUMN IF NOT EXISTS is_owner_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Admin temporary marketplace restriction & mandatory administrative reason
ALTER TABLE shops 
    ADD COLUMN IF NOT EXISTS is_marketplace_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS marketplace_restriction_reason VARCHAR(500);

-- 3. Subscription cancellation timestamp and non-renewal intent declaration
ALTER TABLE subscriptions 
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(500);

-- 4. Compound index for optimized storefront marketplace visibility queries
CREATE INDEX IF NOT EXISTS idx_shops_marketplace_visibility 
    ON shops (status, is_owner_enabled, is_marketplace_restricted, is_deleted);

-- =========================================================================
-- 5. Safe Historical Backfill for Legacy INACTIVE Shops
-- =========================================================================
-- Rule: Do not classify from stale events. Compute ROW_NUMBER() across ALL
-- activity logs for each shop without pre-filtering action codes.
-- Only if rn = 1 matches confirmed admin or confirmed owner action is the
-- record auto-classified. Otherwise, it falls through to conservative fallback.

-- Step 5.1: Ensure all non-INACTIVE shops have explicit default flags
UPDATE shops 
SET is_owner_enabled = TRUE, 
    is_marketplace_restricted = FALSE,
    marketplace_restriction_reason = NULL
WHERE status != 'INACTIVE';

-- Step 5.2: Classify INACTIVE shops where the ABSOLUTE LATEST event is a CONFIRMED administrative restriction
WITH all_latest_shop_logs AS (
    SELECT 
        al.shop_id,
        al.action,
        al.actor_user_id,
        u.role AS actor_role,
        ROW_NUMBER() OVER (
            PARTITION BY al.shop_id 
            ORDER BY al.timestamp DESC, al.id DESC
        ) AS rn
    FROM activity_logs al
    LEFT JOIN users u ON al.actor_user_id = u.id
    WHERE al.entity_type = 'SHOP'
)
UPDATE shops s
SET is_marketplace_restricted = TRUE,
    marketplace_restriction_reason = 'Administrative temporary restriction (migrated from legacy inactive status)',
    is_owner_enabled = TRUE
FROM all_latest_shop_logs lsl
WHERE s.id = lsl.shop_id
  AND lsl.rn = 1
  AND s.status = 'INACTIVE'
  AND lsl.action = 'SHOP_BECAME_INACTIVE'
  AND lsl.actor_role = 'ADMIN';

-- Step 5.3: Classify INACTIVE shops where the ABSOLUTE LATEST event is a CONFIRMED owner action
WITH all_latest_shop_logs AS (
    SELECT 
        al.shop_id,
        al.action,
        al.actor_user_id,
        u.role AS actor_role,
        ROW_NUMBER() OVER (
            PARTITION BY al.shop_id 
            ORDER BY al.timestamp DESC, al.id DESC
        ) AS rn
    FROM activity_logs al
    LEFT JOIN users u ON al.actor_user_id = u.id
    WHERE al.entity_type = 'SHOP'
)
UPDATE shops s
SET is_owner_enabled = FALSE,
    is_marketplace_restricted = FALSE,
    marketplace_restriction_reason = NULL
FROM all_latest_shop_logs lsl
WHERE s.id = lsl.shop_id
  AND lsl.rn = 1
  AND s.status = 'INACTIVE'
  AND s.is_marketplace_restricted = FALSE
  AND lsl.action = 'STATUS_CHANGE'
  AND (lsl.actor_role = 'SHOP_OWNER' OR lsl.actor_user_id = s.owner_id);

-- Step 5.4: Conservative Fallback for All Remaining Legacy INACTIVE Shops
-- (Catches shops with no logs, null actors, role mismatches, or unsupported latest events)
UPDATE shops s
SET is_owner_enabled = FALSE,
    is_marketplace_restricted = FALSE,
    marketplace_restriction_reason = NULL
WHERE s.status = 'INACTIVE'
  AND s.is_marketplace_restricted = FALSE;
