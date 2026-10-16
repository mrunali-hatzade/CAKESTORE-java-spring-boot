-- =========================================================================
-- V48: Add Admin Reply Fields to Platform Feedback
-- Phase 1: Resolves COM-FB-V01 schema mismatch with PlatformFeedback JPA entity
-- =========================================================================

ALTER TABLE platform_feedback
    ADD COLUMN IF NOT EXISTS admin_reply TEXT,
    ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITHOUT TIME ZONE;
