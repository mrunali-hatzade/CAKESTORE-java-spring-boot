-- =========================================================================
-- V49: Add Idempotency Key, Status, Payload Hash, and Dedicated Lease Columns
-- =========================================================================

-- Stage 1: Preflight Data Integrity Check
DO $$
DECLARE
    v_total_rows INTEGER;
    v_null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_rows FROM broadcast_history;
    
    -- Verify no unexpected NULLs in legacy NOT NULL columns
    SELECT COUNT(*) INTO v_null_count FROM broadcast_history
    WHERE title IS NULL OR message IS NULL;
    
    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'V49 Preflight Aborted: Found % rows with NULL title or message in broadcast_history.', v_null_count;
    END IF;
    
    RAISE NOTICE 'V49 Preflight Passed: % historical broadcast rows detected for backfill.', v_total_rows;
END $$;

-- Stage 2: Add new columns as nullable
ALTER TABLE broadcast_history
    ADD COLUMN idempotency_key UUID,
    ADD COLUMN status VARCHAR(20),
    ADD COLUMN payload_hash VARCHAR(64),
    ADD COLUMN lease_token UUID,
    ADD COLUMN lease_expires_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN worker_heartbeat TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN failure_reason TEXT;

-- Stage 3: Extension-free deterministic backfill of existing historical records
-- 1. Deterministic UUID generated from immutable primary key 'id'
-- 2. Status set to 'COMPLETED'
-- 3. Dedicated lease_expires_at set to sent_at + 60s
-- 4. 64-character payload hash generated using core md5() with COALESCE safeguards
UPDATE broadcast_history
SET idempotency_key = md5('cakeplatform:broadcast_history:' || id::text)::uuid,
    status = 'COMPLETED',
    lease_token = md5('cakeplatform:broadcast_history:lease:' || id::text)::uuid,
    lease_expires_at = sent_at + INTERVAL '60 seconds',
    payload_hash = md5('cakeplatform:broadcast_history:payload:a:' || id::text || ':' || COALESCE(title, '')) ||
                   md5('cakeplatform:broadcast_history:payload:b:' || id::text || ':' || COALESCE(substr(message, 1, 100), ''))
WHERE idempotency_key IS NULL OR status IS NULL OR payload_hash IS NULL;

-- Stage 4: Preflight Duplicate Check Before Adding Unique Constraint
DO $$
DECLARE
    v_duplicate_keys INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicate_keys FROM (
        SELECT idempotency_key FROM broadcast_history
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
    ) dups;

    IF v_duplicate_keys > 0 THEN
        RAISE EXCEPTION 'V49 Preflight Aborted: % duplicate idempotency keys detected after backfill.', v_duplicate_keys;
    END IF;
END $$;

-- Stage 5: Enforce NOT NULL constraints and application defaults
ALTER TABLE broadcast_history
    ALTER COLUMN idempotency_key SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'RESERVED',
    ALTER COLUMN payload_hash SET NOT NULL,
    ALTER COLUMN lease_token SET NOT NULL,
    ALTER COLUMN lease_expires_at SET NOT NULL;

-- Stage 6: Enforce Uniqueness and Performance Indexing
ALTER TABLE broadcast_history
    ADD CONSTRAINT uq_broadcast_history_idempotency_key UNIQUE (idempotency_key);

CREATE INDEX idx_broadcast_history_status ON broadcast_history(status);
CREATE INDEX idx_broadcast_history_lease ON broadcast_history(status, lease_expires_at);
