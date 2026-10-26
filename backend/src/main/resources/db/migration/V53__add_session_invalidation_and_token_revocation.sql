-- Phase 2: Session Invalidation and Token Revocation Schema
-- 1. Add token_version and tokens_invalidated_before to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_invalidated_before TIMESTAMP;

-- 2. Create revoked_tokens table to persist individual token logouts across restarts and multiple instances
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id BIGSERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    expiry_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_hash ON revoked_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiry ON revoked_tokens(expiry_date);
