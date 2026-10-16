package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BroadcastServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private BroadcastHistoryRepository broadcastHistoryRepository;

    @Mock
    private BroadcastFailureService broadcastFailureService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private BroadcastService broadcastService;

    private User activeOwner;

    @BeforeEach
    void setUp() {
        activeOwner = new User();
        activeOwner.setId(5L);
        activeOwner.setRole(UserRole.SHOP_OWNER);
        activeOwner.setStatus(UserStatus.ACTIVE);
        activeOwner.setEmail("owner5@example.com");
    }

    @Test
    @DisplayName("TEST-01: New valid broadcast reserves slot with RESERVED_NEW")
    void testReserveNewBroadcast() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Maintenance Alert")
                .message("Platform update tonight.")
                .targetType("ALL")
                .sendEmail(true)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.of(100L));

        ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

        assertEquals(ReservationOutcome.Type.RESERVED_NEW, outcome.getType());
        assertEquals(100L, outcome.getBroadcastId());
        assertNotNull(outcome.getLeaseToken());
    }

    @Test
    @DisplayName("TEST-02: Duplicate identical request with completed status returns COMPLETED_IDEMPOTENT")
    void testDuplicateCompletedBroadcast() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Maintenance Alert")
                .message("Platform update tonight.")
                .targetType("ALL")
                .sendEmail(true)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        NormalizedBroadcastPayload norm = NormalizedBroadcastPayload.builder()
                .title("Maintenance Alert")
                .message("Platform update tonight.")
                .targetType("ALL")
                .sendEmail(true)
                .build();
        String hash = CanonicalPayloadHasher.computeHash(norm);

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(100L)
                .idempotencyKey(key)
                .payloadHash(hash)
                .status("COMPLETED")
                .leaseToken(UUID.randomUUID())
                .leaseExpiresAt(LocalDateTime.now().plusMinutes(10))
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

        assertEquals(ReservationOutcome.Type.COMPLETED_IDEMPOTENT, outcome.getType());
        assertEquals(100L, outcome.getBroadcastId());
    }

    @Test
    @DisplayName("TEST-03B: Active lease during unexpired window returns ALREADY_PROCESSING")
    void testActiveLeaseReturnsAlreadyProcessing() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Active Alert")
                .message("In flight broadcast.")
                .targetType("ALL")
                .sendEmail(false)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        NormalizedBroadcastPayload norm = NormalizedBroadcastPayload.builder()
                .title("Active Alert")
                .message("In flight broadcast.")
                .targetType("ALL")
                .sendEmail(false)
                .build();
        String hash = CanonicalPayloadHasher.computeHash(norm);

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(101L)
                .idempotencyKey(key)
                .payloadHash(hash)
                .status("RESERVED")
                .leaseToken(UUID.randomUUID())
                .leaseExpiresAt(LocalDateTime.now().plusSeconds(45)) // unexpired
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

        assertEquals(ReservationOutcome.Type.ALREADY_PROCESSING, outcome.getType());
        assertEquals(101L, outcome.getBroadcastId());
    }

    @Test
    @DisplayName("TEST-03: Stale expired lease reclaims lease with RECLAIMED_EXPIRED")
    void testExpiredLeaseReclaims() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Stale Alert")
                .message("Reclaiming stale lease.")
                .targetType("ALL")
                .sendEmail(false)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        NormalizedBroadcastPayload norm = NormalizedBroadcastPayload.builder()
                .title("Stale Alert")
                .message("Reclaiming stale lease.")
                .targetType("ALL")
                .sendEmail(false)
                .build();
        String hash = CanonicalPayloadHasher.computeHash(norm);

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(102L)
                .idempotencyKey(key)
                .payloadHash(hash)
                .status("RESERVED")
                .leaseToken(UUID.randomUUID())
                .leaseExpiresAt(LocalDateTime.now().minusSeconds(10)) // expired
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));
        when(broadcastHistoryRepository.reclaimStaleLease(eq(key), eq(hash), any())).thenReturn(true);

        ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

        assertEquals(ReservationOutcome.Type.RECLAIMED_EXPIRED, outcome.getType());
        assertEquals(102L, outcome.getBroadcastId());
        assertNotNull(outcome.getLeaseToken());
    }

    @Test
    @DisplayName("TEST-06: Target ALL with specificOwnerId throws IllegalArgumentException")
    void testTargetTypeAllWithSpecificOwnerIdFails() {
        AdminMessageRequest request = AdminMessageRequest.builder()
                .title("Invalid Target")
                .message("Invalid.")
                .targetType("ALL")
                .specificOwnerId(123L)
                .build();

        assertThrows(IllegalArgumentException.class, () -> broadcastService.reserveBroadcast(request));
    }

    @Test
    @DisplayName("TEST-07 & 08: Target SPECIFIC with null or negative ownerId throws IllegalArgumentException")
    void testTargetTypeSpecificWithInvalidOwnerIdFails() {
        AdminMessageRequest reqNull = AdminMessageRequest.builder()
                .title("Specific Null")
                .message("Invalid.")
                .targetType("SPECIFIC")
                .specificOwnerId(null)
                .build();

        assertThrows(IllegalArgumentException.class, () -> broadcastService.reserveBroadcast(reqNull));

        AdminMessageRequest reqNeg = AdminMessageRequest.builder()
                .title("Specific Neg")
                .message("Invalid.")
                .targetType("SPECIFIC")
                .specificOwnerId(-5L)
                .build();

        assertThrows(IllegalArgumentException.class, () -> broadcastService.reserveBroadcast(reqNeg));
    }

    @Test
    @DisplayName("TEST-09: Reusing key with different payload returns PAYLOAD_CONFLICT")
    void testReusingKeyWithDifferentPayloadReturnsConflict() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("First Title")
                .message("Original message.")
                .targetType("ALL")
                .sendEmail(true)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(105L)
                .idempotencyKey(key)
                .payloadHash("different-hash-value-0000000000000000000000000000000000000000000000")
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

        assertEquals(ReservationOutcome.Type.PAYLOAD_CONFLICT, outcome.getType());
    }

    @Test
    @DisplayName("TEST-09B: Retry on FAILED broadcast returns TERMINAL_FAILURE")
    void testRetryOnFailedBroadcastReturnsTerminalFailure() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Failed Title")
                .message("Failed message.")
                .targetType("ALL")
                .sendEmail(true)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        NormalizedBroadcastPayload norm = NormalizedBroadcastPayload.builder()
                .title("Failed Title")
                .message("Failed message.")
                .targetType("ALL")
                .sendEmail(true)
                .build();
        String hash = CanonicalPayloadHasher.computeHash(norm);

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(106L)
                .idempotencyKey(key)
                .payloadHash(hash)
                .status("FAILED")
                .failureReason("Simulated fatal database connection abort")
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ReservationOutcome outcome = broadcastService.reserveBroadcast(request);

        assertEquals(ReservationOutcome.Type.TERMINAL_FAILURE, outcome.getType());
    }

    @Test
    @DisplayName("TEST-04: Stale worker with mismatched lease token aborts execution")
    void testStaleWorkerFencing() {
        UUID workerToken = UUID.randomUUID();
        UUID dbToken = UUID.randomUUID();

        BroadcastHistory history = BroadcastHistory.builder()
                .id(200L)
                .leaseToken(dbToken) // Mismatched
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findById(200L)).thenReturn(Optional.of(history));

        broadcastService.processBroadcastAsync(200L, workerToken);

        // Verify zero notifications saved
        verify(notificationRepository, never()).save(any());
        verify(broadcastHistoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("Worker batch process creates notifications and marks COMPLETED for matching lease")
    void testWorkerBatchProcessSuccess() {
        UUID token = UUID.randomUUID();

        BroadcastHistory history = BroadcastHistory.builder()
                .id(201L)
                .title("Announce")
                .message("Body")
                .targetType("ALL")
                .leaseToken(token)
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findById(201L)).thenReturn(Optional.of(history));
        when(userRepository.findByRoleAndStatus(UserRole.SHOP_OWNER, UserStatus.ACTIVE))
                .thenReturn(List.of(activeOwner));

        broadcastService.processBroadcastAsync(201L, token);

        verify(notificationRepository, times(1)).save(any());
        assertEquals("COMPLETED", history.getStatus());
        assertEquals(1, history.getRecipientCount());
        verify(broadcastHistoryRepository, times(1)).save(history);
        verify(eventPublisher, times(1)).publishEvent(any(BroadcastCommittedEvent.class));
    }
}
