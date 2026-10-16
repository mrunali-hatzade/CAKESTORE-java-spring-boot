package com.cakeplatform.api.modules.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BroadcastFailureService {

    private final BroadcastHistoryRepository broadcastHistoryRepository;

    /**
     * Persists broadcast failure in an isolated REQUIRES_NEW transaction, strictly fenced by the worker's leaseToken.
     * Guaranteed never to throw or propagate exceptions to the caller.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailedRequiresNew(Long id, UUID workerLeaseToken, String reason) {
        try {
            BroadcastHistory history = broadcastHistoryRepository.findById(id).orElse(null);
            if (history == null) {
                log.warn("[FAILURE-FENCE] Broadcast {} not found for failure recording", id);
                return;
            }

            if (!workerLeaseToken.equals(history.getLeaseToken())) {
                log.warn("[FAILURE-FENCE] Lease token mismatch for broadcast {}. Worker has {}, DB has {}. Aborting failure write.",
                        id, workerLeaseToken, history.getLeaseToken());
                return;
            }

            history.setStatus("FAILED");
            history.setFailureReason(reason != null && reason.length() > 2000 ? reason.substring(0, 2000) : reason);
            broadcastHistoryRepository.save(history);
            log.info("[FAILURE-RECORDED] Marked broadcast {} as FAILED with reason: {}", id, reason);
        } catch (Exception ex) {
            log.error("[CRITICAL-FAILURE-WRITE] Failed to persist FAILED status for broadcast {}: {}", id, ex.getMessage(), ex);
        }
    }
}
