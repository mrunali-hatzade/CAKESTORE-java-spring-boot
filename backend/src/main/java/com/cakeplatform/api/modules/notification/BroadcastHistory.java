package com.cakeplatform.api.modules.notification;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "broadcast_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BroadcastHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "target_type", nullable = false)
    private String targetType; // "ALL" or "SPECIFIC"

    @Column(name = "target_owner_id")
    private Long targetOwnerId;

    @Column(name = "recipient_count", nullable = false)
    private Integer recipientCount;

    @Column(name = "sent_email", nullable = false)
    private Boolean sentEmail;

    @CreationTimestamp
    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private UUID idempotencyKey;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "payload_hash", nullable = false, length = 64)
    private String payloadHash;

    @Column(name = "lease_token", nullable = false)
    private UUID leaseToken;

    @Column(name = "lease_expires_at", nullable = false)
    private LocalDateTime leaseExpiresAt;

    @Column(name = "worker_heartbeat")
    private LocalDateTime workerHeartbeat;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;
}
