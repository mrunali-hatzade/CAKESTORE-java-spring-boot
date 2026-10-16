package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BroadcastService {

    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final BroadcastHistoryRepository broadcastHistoryRepository;
    private final BroadcastFailureService broadcastFailureService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Synchronously validates request, normalizes payload, computes deterministic hash,
     * and reserves an idempotency lease. Returns outcome directing controller behavior.
     */
    public ReservationOutcome reserveBroadcast(AdminMessageRequest request) {
        // Step 1: Normalize payload
        NormalizedBroadcastPayload payload = normalize(request);

        // Step 2: Validate normalized payload
        validatePayload(payload);

        // Step 3: Compute canonical hash
        String payloadHash = CanonicalPayloadHasher.computeHash(payload);
        UUID idempotencyKey = request.getIdempotencyKey();
        UUID newLeaseToken = UUID.randomUUID();

        // Step 4: Atomic insert reservation attempt
        var insertedIdOpt = broadcastHistoryRepository.insertIfAbsent(payload, payloadHash, idempotencyKey, newLeaseToken);
        if (insertedIdOpt.isPresent()) {
            Long broadcastId = insertedIdOpt.get();
            log.info("Reserved new broadcast id={} with idempotencyKey={}", broadcastId, idempotencyKey);
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.RESERVED_NEW)
                    .broadcastId(broadcastId)
                    .leaseToken(newLeaseToken)
                    .message("Broadcast reserved and scheduled for processing.")
                    .build();
        }

        // Step 5: Row exists. Retrieve existing record
        BroadcastHistory existing = broadcastHistoryRepository.findByIdempotencyKey(idempotencyKey)
                .orElseThrow(() -> new IllegalStateException("Broadcast record with idempotency key " + idempotencyKey + " disappeared unexpectedly."));

        // Step 6: Hash comparison
        if (!existing.getPayloadHash().equals(payloadHash)) {
            log.warn("Payload mismatch for idempotencyKey={}. DB hash={}, request hash={}",
                    idempotencyKey, existing.getPayloadHash(), payloadHash);
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.PAYLOAD_CONFLICT)
                    .broadcastId(existing.getId())
                    .message("The provided idempotency key was previously used with different parameters.")
                    .build();
        }

        // Step 7: Handle status
        String status = existing.getStatus();
        if ("COMPLETED".equalsIgnoreCase(status)) {
            log.info("Broadcast id={} already COMPLETED for idempotencyKey={}", existing.getId(), idempotencyKey);
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.COMPLETED_IDEMPOTENT)
                    .broadcastId(existing.getId())
                    .message("Broadcast already completed successfully.")
                    .build();
        }

        if ("FAILED".equalsIgnoreCase(status)) {
            log.warn("Broadcast id={} reached terminal FAILED state for idempotencyKey={}", existing.getId(), idempotencyKey);
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.TERMINAL_FAILURE)
                    .broadcastId(existing.getId())
                    .message("Previous broadcast attempt failed: " + existing.getFailureReason())
                    .build();
        }

        // Status is RESERVED. Check lease
        LocalDateTime now = LocalDateTime.now();
        if (existing.getLeaseExpiresAt().isAfter(now)) {
            log.info("Broadcast id={} is actively RESERVED with valid lease until {}", existing.getId(), existing.getLeaseExpiresAt());
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.ALREADY_PROCESSING)
                    .broadcastId(existing.getId())
                    .message("Broadcast already queued or processing.")
                    .build();
        }

        // Lease expired! Attempt atomic lease reclaim
        boolean reclaimed = broadcastHistoryRepository.reclaimStaleLease(idempotencyKey, payloadHash, newLeaseToken);
        if (reclaimed) {
            log.info("Reclaimed stale lease for broadcast id={} with new leaseToken={}", existing.getId(), newLeaseToken);
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.RECLAIMED_EXPIRED)
                    .broadcastId(existing.getId())
                    .leaseToken(newLeaseToken)
                    .message("Stale broadcast lease reclaimed and re-queued.")
                    .build();
        } else {
            // Reclaim lost race or status changed concurrently
            log.info("Lease reclamation lost race or no longer expired for broadcast id={}", existing.getId());
            return ReservationOutcome.builder()
                    .type(ReservationOutcome.Type.ALREADY_PROCESSING)
                    .broadcastId(existing.getId())
                    .message("Broadcast already queued or processing.")
                    .build();
        }
    }

    /**
     * Executes asynchronous batch processing inside a single atomic database transaction.
     * Guarded by the worker's leaseToken.
     */
    @Async
    @Transactional
    public void processBroadcastAsync(Long broadcastId, UUID leaseToken) {
        log.info("Worker starting batch for broadcast id={}, leaseToken={}", broadcastId, leaseToken);
        BroadcastHistory history = broadcastHistoryRepository.findById(broadcastId).orElse(null);
        if (history == null) {
            log.error("Broadcast record id={} not found in worker", broadcastId);
            return;
        }

        // Startup Guard: Lease Token Fencing
        if (!leaseToken.equals(history.getLeaseToken())) {
            log.warn("[STALE-WORKER-FENCE] Aborting execution for broadcast id={}. Worker token={}, DB token={}",
                    broadcastId, leaseToken, history.getLeaseToken());
            return;
        }

        try {
            // Heartbeat
            history.setWorkerHeartbeat(LocalDateTime.now());

            // Resolve target recipients (active SHOP_OWNERs only)
            List<User> targets;
            if ("SPECIFIC".equalsIgnoreCase(history.getTargetType())) {
                User owner = userRepository.findById(history.getTargetOwnerId()).orElse(null);
                if (owner != null && owner.getRole() == UserRole.SHOP_OWNER && owner.getStatus() == UserStatus.ACTIVE && !owner.isDeleted()) {
                    targets = List.of(owner);
                } else {
                    targets = Collections.emptyList();
                }
            } else {
                targets = userRepository.findByRoleAndStatus(UserRole.SHOP_OWNER, UserStatus.ACTIVE);
            }

            // Insert notifications
            int count = 0;
            for (User recipient : targets) {
                Notification notification = Notification.builder()
                        .recipient(recipient)
                        .type(NotificationType.ADMIN_MESSAGE)
                        .title(history.getTitle())
                        .message(history.getMessage())
                        .referenceId(null)
                        .isRead(false)
                        .build();
                notificationRepository.save(notification);
                count++;
            }

            // Update status and recipient count
            history.setStatus("COMPLETED");
            history.setRecipientCount(count);
            broadcastHistoryRepository.save(history);

            // Publish post-commit event for WebSocket/Email dispatch
            eventPublisher.publishEvent(new BroadcastCommittedEvent(broadcastId));

            log.info("Broadcast id={} batch committed successfully with {} recipients", broadcastId, count);
        } catch (Exception ex) {
            log.error("Broadcast id={} execution encountered error: {}", broadcastId, ex.getMessage(), ex);
            // Re-throw to force Transaction 2 rollback
            // Delegate failure persistence to isolated REQUIRES_NEW service
            broadcastFailureService.markFailedRequiresNew(broadcastId, leaseToken, ex.getMessage());
            throw new RuntimeException("Broadcast batch execution failed for id=" + broadcastId, ex);
        }
    }

    public List<BroadcastHistory> getHistory() {
        return broadcastHistoryRepository.findAllByOrderBySentAtDesc();
    }

    private NormalizedBroadcastPayload normalize(AdminMessageRequest request) {
        String title = request.getTitle() != null ? request.getTitle().trim() : "";
        String message = request.getMessage() != null
                ? request.getMessage().trim().replace("\r\n", "\n").replace("\r", "\n")
                : "";
        String targetType = request.getTargetType() != null ? request.getTargetType().trim().toUpperCase() : "ALL";
        Long specificOwnerId = request.getSpecificOwnerId();
        boolean sendEmail = request.isSendEmail();

        return NormalizedBroadcastPayload.builder()
                .title(title)
                .message(message)
                .targetType(targetType)
                .specificOwnerId(specificOwnerId)
                .sendEmail(sendEmail)
                .build();
    }

    private void validatePayload(NormalizedBroadcastPayload payload) {
        if (payload.getTitle() == null || payload.getTitle().isEmpty() || payload.getTitle().length() > 255) {
            throw new IllegalArgumentException("Title must be between 1 and 255 characters");
        }
        if (payload.getMessage() == null || payload.getMessage().isEmpty() || payload.getMessage().length() > 1024) {
            throw new IllegalArgumentException("Message must be between 1 and 1024 characters");
        }
        if (!"ALL".equals(payload.getTargetType()) && !"SPECIFIC".equals(payload.getTargetType())) {
            throw new IllegalArgumentException("targetType must be either ALL or SPECIFIC");
        }
        if ("ALL".equals(payload.getTargetType()) && payload.getSpecificOwnerId() != null) {
            throw new IllegalArgumentException("specificOwnerId must be null when targetType is ALL");
        }
        if ("SPECIFIC".equals(payload.getTargetType())) {
            if (payload.getSpecificOwnerId() == null || payload.getSpecificOwnerId() <= 0) {
                throw new IllegalArgumentException("specificOwnerId must be provided and positive when targetType is SPECIFIC");
            }
            User owner = userRepository.findById(payload.getSpecificOwnerId()).orElse(null);
            if (owner == null || owner.getRole() != UserRole.SHOP_OWNER || owner.getStatus() != UserStatus.ACTIVE || owner.isDeleted()) {
                throw new IllegalArgumentException("Recipient must be an active, non-deleted bakery shop owner (userId=" + payload.getSpecificOwnerId() + ")");
            }
        }
    }
}
