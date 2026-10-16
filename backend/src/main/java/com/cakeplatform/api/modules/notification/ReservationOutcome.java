package com.cakeplatform.api.modules.notification;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class ReservationOutcome {

    public enum Type {
        RESERVED_NEW,           // Newly inserted, schedule async worker
        RECLAIMED_EXPIRED,      // Expired lease rotated, schedule async worker
        ALREADY_PROCESSING,     // Exists, unexpired lease or already processing, do not schedule
        COMPLETED_IDEMPOTENT,   // Already completed, do not schedule
        TERMINAL_FAILURE,       // Status is FAILED, terminal conflict
        PAYLOAD_CONFLICT        // Payload hash mismatch, conflict
    }

    Type type;
    Long broadcastId;
    UUID leaseToken;
    String message;
}
