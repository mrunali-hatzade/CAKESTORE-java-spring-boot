package com.cakeplatform.api.modules.notification;

import java.util.Optional;
import java.util.UUID;

public interface BroadcastHistoryRepositoryCustom {

    /**
     * Executes atomic INSERT ... ON CONFLICT DO NOTHING RETURNING id.
     * Returns the generated database primary key ID if inserted, or Optional.empty() if conflict occurred.
     */
    Optional<Long> insertIfAbsent(NormalizedBroadcastPayload payload, String payloadHash, UUID idempotencyKey, UUID leaseToken);

    /**
     * Attempts atomic lease reclamation with strict lock_timeout protection.
     * Sets local lock_timeout to 2s, verifies status='RESERVED', payload_hash, and expired lease, then updates lease.
     * Returns true if lease was reclaimed and rotated, false if not matched.
     * Throws QueryTimeoutException / CannotAcquireLockException if lock timeout occurs.
     */
    boolean reclaimStaleLease(UUID idempotencyKey, String payloadHash, UUID newLeaseToken);
}
