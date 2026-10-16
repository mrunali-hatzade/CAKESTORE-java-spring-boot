package com.cakeplatform.api.modules.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
@Slf4j
public class BroadcastHistoryRepositoryCustomImpl implements BroadcastHistoryRepositoryCustom {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Optional<Long> insertIfAbsent(NormalizedBroadcastPayload payload, String payloadHash, UUID idempotencyKey, UUID leaseToken) {
        String sql = """
            INSERT INTO broadcast_history (
                title, message, target_type, target_owner_id, recipient_count,
                sent_email, sent_at, idempotency_key, status, payload_hash,
                lease_token, lease_expires_at, worker_heartbeat
            ) VALUES (
                ?, ?, ?, ?, 0,
                ?, NOW(), ?, 'RESERVED', ?,
                ?, NOW() + INTERVAL '60 seconds', NULL
            )
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
            """;

        try {
            Long id = jdbcTemplate.queryForObject(
                sql,
                Long.class,
                payload.getTitle(),
                payload.getMessage(),
                payload.getTargetType(),
                payload.getSpecificOwnerId(),
                payload.isSendEmail(),
                idempotencyKey,
                payloadHash,
                leaseToken
            );
            return Optional.ofNullable(id);
        } catch (EmptyResultDataAccessException e) {
            // Row already exists with this idempotency_key (conflict handled)
            return Optional.empty();
        }
    }

    @Override
    public boolean reclaimStaleLease(UUID idempotencyKey, String payloadHash, UUID newLeaseToken) {
        // Enforce lock timeout protection to prevent HTTP thread starvation on row contention
        jdbcTemplate.execute("SET LOCAL lock_timeout = '2s'");

        String sql = """
            UPDATE broadcast_history
            SET lease_token = ?,
                lease_expires_at = NOW() + INTERVAL '60 seconds',
                worker_heartbeat = NOW()
            WHERE idempotency_key = ?
              AND status = 'RESERVED'
              AND payload_hash = ?
              AND lease_expires_at <= NOW()
            """;

        int rows = jdbcTemplate.update(sql, newLeaseToken, idempotencyKey, payloadHash);
        return rows > 0;
    }
}
