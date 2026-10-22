-- =========================================================================
-- V51: Add Unique Index on payments(provider_payment_id)
-- =========================================================================
-- Ensures idempotency and prevents concurrent race conditions from creating
-- duplicate payment rows for the same external gateway transaction ID.
-- =========================================================================

-- Stage 1: Preflight duplicate check for provider_payment_id
DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_dup_count FROM (
        SELECT provider_payment_id
        FROM payments
        WHERE provider_payment_id IS NOT NULL
        GROUP BY provider_payment_id
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'V51 Preflight Aborted: % duplicate provider_payment_id values detected in payments table.', v_dup_count;
    END IF;

    RAISE NOTICE 'V51 Preflight Passed: No duplicate provider_payment_id values detected.';
END $$;

-- Stage 2: Create partial unique index on non-null provider_payment_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment_id 
ON payments(provider_payment_id) 
WHERE provider_payment_id IS NOT NULL;
