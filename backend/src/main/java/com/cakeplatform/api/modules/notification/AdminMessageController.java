package com.cakeplatform.api.modules.notification;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/messages")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminMessageController {

    private final BroadcastService broadcastService;

    @PostMapping
    public ResponseEntity<String> sendAdminMessage(@Valid @RequestBody AdminMessageRequest request) {
        if (request.getIdempotencyKey() == null) {
            request.setIdempotencyKey(UUID.randomUUID());
        }

        try {
            ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

            switch (outcome.getType()) {
                case RESERVED_NEW:
                case RECLAIMED_EXPIRED:
                    // Schedule asynchronous batch worker
                    broadcastService.processBroadcastAsync(outcome.getBroadcastId(), outcome.getLeaseToken());
                    return ResponseEntity.ok("Broadcast dispatched successfully. Processing in background.");

                case ALREADY_PROCESSING:
                case COMPLETED_IDEMPOTENT:
                    // Idempotent duplicate: return 200 OK without triggering worker
                    return ResponseEntity.ok("Broadcast already queued or processing.");

                case TERMINAL_FAILURE:
                case PAYLOAD_CONFLICT:
                    // Terminal failure or payload mismatch: return 409 Conflict
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(outcome.getMessage());

                default:
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Unknown reservation state.");
            }
        } catch (IllegalArgumentException ex) {
            log.warn("Validation error for broadcast request: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (CannotAcquireLockException | QueryTimeoutException ex) {
            log.warn("Row lock timeout encountered during broadcast reservation: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, "2")
                    .body("Broadcast record is currently locked by active processing. Please retry.");
        } catch (Exception ex) {
            // Check if root cause is PostgreSQL SQLState 55P03 (lock_not_available)
            if (isLockTimeoutException(ex)) {
                log.warn("PostgreSQL lock_timeout detected via root cause: {}", ex.getMessage());
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header(HttpHeaders.RETRY_AFTER, "2")
                        .body("Broadcast record is currently locked by active processing. Please retry.");
            }
            log.error("Unexpected error in broadcast controller: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An unexpected error occurred while processing broadcast.");
        }
    }

    @GetMapping("/history")
    public ResponseEntity<List<BroadcastHistory>> getBroadcastHistory() {
        return ResponseEntity.ok(broadcastService.getHistory());
    }

    private boolean isLockTimeoutException(Throwable ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof SQLException sqlEx) {
                if ("55P03".equals(sqlEx.getSQLState())) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }
}
