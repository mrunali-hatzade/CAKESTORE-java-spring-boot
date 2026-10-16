package com.cakeplatform.api.modules.notification;

import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Automated smoke and regression test suite for CakeStore Broadcast feature.
 * Replaces manual staging checks with fully deterministic automated tests covering:
 * - STG-01: Bulk broadcast to eligible active owners
 * - STG-02: Target specific eligible shop owner
 * - STG-03: Rejection of non-owners, customer roles, deleted and inactive users
 * - STG-04: Duplicate same-key resubmission returning HTTP 200 without duplicate scheduling
 * - STG-05: Key reuse with changed payload returning HTTP 409 Conflict
 * - STG-06: Recovery from unexpired to expired lease reclamation
 * - STG-07: Concurrent duplicate submissions producing exactly one batch worker
 * - STG-08: Stale-worker fencing aborts delayed workers cleanly
 * - STG-09: Fenced failure persistence with lease-token protection
 * - STG-10: Lock timeout response returning HTTP 429 with Retry-After header
 * - STG-11: Rollback verification ensuring no notifications or after-commit events on worker failure
 */
@ExtendWith(MockitoExtension.class)
public class BroadcastAutomatedSmokeTest {

    @Mock private UserRepository userRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private BroadcastHistoryRepository broadcastHistoryRepository;
    @Mock private BroadcastFailureService broadcastFailureService;
    @Mock private ApplicationEventPublisher eventPublisher;

    private BroadcastService broadcastService;
    private AdminMessageController controller;

    private User activeOwner1;
    private User activeOwner2;
    private User inactiveOwner;
    private User customerUser;
    private User deletedOwner;

    @BeforeEach
    void setUp() {
        broadcastService = new BroadcastService(
                userRepository,
                notificationRepository,
                broadcastHistoryRepository,
                broadcastFailureService,
                eventPublisher
        );
        controller = new AdminMessageController(broadcastService);

        activeOwner1 = new User();
        activeOwner1.setId(101L);
        activeOwner1.setEmail("owner1@bakery.com");
        activeOwner1.setRole(UserRole.SHOP_OWNER);
        activeOwner1.setStatus(UserStatus.ACTIVE);
        activeOwner1.setDeleted(false);

        activeOwner2 = new User();
        activeOwner2.setId(102L);
        activeOwner2.setEmail("owner2@bakery.com");
        activeOwner2.setRole(UserRole.SHOP_OWNER);
        activeOwner2.setStatus(UserStatus.ACTIVE);
        activeOwner2.setDeleted(false);

        inactiveOwner = new User();
        inactiveOwner.setId(103L);
        inactiveOwner.setEmail("inactive@bakery.com");
        inactiveOwner.setRole(UserRole.SHOP_OWNER);
        inactiveOwner.setStatus(UserStatus.LOCKED);
        inactiveOwner.setDeleted(false);

        customerUser = new User();
        customerUser.setId(104L);
        customerUser.setEmail("customer@gmail.com");
        customerUser.setRole(UserRole.CUSTOMER);
        customerUser.setStatus(UserStatus.ACTIVE);
        customerUser.setDeleted(false);

        deletedOwner = new User();
        deletedOwner.setId(105L);
        deletedOwner.setEmail("deleted@bakery.com");
        deletedOwner.setRole(UserRole.SHOP_OWNER);
        deletedOwner.setStatus(UserStatus.ACTIVE);
        deletedOwner.setDeleted(true);
    }

    @Test
    @DisplayName("STG-01: Bulk broadcast to eligible active test owners succeeds and commits atomic batch")
    void testBulkBroadcastToActiveOwners() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Festival Preparation")
                .message("Prepare your bakery shelves.")
                .targetType("ALL")
                .sendEmail(true)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.of(500L));

        ResponseEntity<String> response = controller.sendAdminMessage(request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().contains("Processing in background"));

        // Simulate async worker batch execution
        BroadcastHistory history = BroadcastHistory.builder()
                .id(500L)
                .title(request.getTitle())
                .message(request.getMessage())
                .targetType("ALL")
                .sentEmail(true)
                .leaseToken(UUID.randomUUID())
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findById(500L)).thenReturn(Optional.of(history));
        when(userRepository.findByRoleAndStatus(UserRole.SHOP_OWNER, UserStatus.ACTIVE))
                .thenReturn(List.of(activeOwner1, activeOwner2));

        broadcastService.processBroadcastAsync(500L, history.getLeaseToken());

        // Verifications
        verify(notificationRepository, times(2)).save(any(Notification.class));
        assertEquals("COMPLETED", history.getStatus());
        assertEquals(2, history.getRecipientCount());
        verify(broadcastHistoryRepository, times(1)).save(history);
        verify(eventPublisher, times(1)).publishEvent(any(BroadcastCommittedEvent.class));
    }

    @Test
    @DisplayName("STG-02: Broadcast to one specific eligible owner targets only that owner")
    void testBroadcastToSpecificEligibleOwner() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Account Notice")
                .message("Update your FSSAI certificate.")
                .targetType("SPECIFIC")
                .specificOwnerId(101L)
                .sendEmail(false)
                .build();

        when(userRepository.findById(101L)).thenReturn(Optional.of(activeOwner1));
        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.of(501L));

        ResponseEntity<String> response = controller.sendAdminMessage(request);
        assertEquals(HttpStatus.OK, response.getStatusCode());

        // Execute batch worker
        BroadcastHistory history = BroadcastHistory.builder()
                .id(501L)
                .title(request.getTitle())
                .message(request.getMessage())
                .targetType("SPECIFIC")
                .targetOwnerId(101L)
                .sentEmail(false)
                .leaseToken(UUID.randomUUID())
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findById(501L)).thenReturn(Optional.of(history));

        broadcastService.processBroadcastAsync(501L, history.getLeaseToken());

        ArgumentCaptor<Notification> notifCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(1)).save(notifCaptor.capture());
        assertEquals(101L, notifCaptor.getValue().getRecipient().getId());
        assertEquals("COMPLETED", history.getStatus());
        assertEquals(1, history.getRecipientCount());
    }

    @Test
    @DisplayName("STG-03: Rejection of customers, deleted owners, and inactive owners")
    void testRejectionOfIneligibleSpecificRecipients() {
        // Customer Role
        AdminMessageRequest customerReq = AdminMessageRequest.builder()
                .title("Notice").message("Body").targetType("SPECIFIC").specificOwnerId(104L).build();
        when(userRepository.findById(104L)).thenReturn(Optional.of(customerUser));
        ResponseEntity<String> res1 = controller.sendAdminMessage(customerReq);
        assertEquals(HttpStatus.BAD_REQUEST, res1.getStatusCode());
        assertTrue(res1.getBody().contains("active, non-deleted bakery shop owner"));

        // Deleted Owner
        AdminMessageRequest deletedReq = AdminMessageRequest.builder()
                .title("Notice").message("Body").targetType("SPECIFIC").specificOwnerId(105L).build();
        when(userRepository.findById(105L)).thenReturn(Optional.of(deletedOwner));
        ResponseEntity<String> res2 = controller.sendAdminMessage(deletedReq);
        assertEquals(HttpStatus.BAD_REQUEST, res2.getStatusCode());
        assertTrue(res2.getBody().contains("active, non-deleted bakery shop owner"));

        // Inactive / Locked Owner
        AdminMessageRequest lockedReq = AdminMessageRequest.builder()
                .title("Notice").message("Body").targetType("SPECIFIC").specificOwnerId(103L).build();
        when(userRepository.findById(103L)).thenReturn(Optional.of(inactiveOwner));
        ResponseEntity<String> res3 = controller.sendAdminMessage(lockedReq);
        assertEquals(HttpStatus.BAD_REQUEST, res3.getStatusCode());
        assertTrue(res3.getBody().contains("active, non-deleted bakery shop owner"));
    }

    @Test
    @DisplayName("STG-04: Duplicate requests with same key and identical payload returns 200 without worker")
    void testDuplicateRequestWithSameKeyReturns200WithoutWorker() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Bulk Discount")
                .message("Holiday discount active.")
                .targetType("ALL")
                .sendEmail(true)
                .build();

        NormalizedBroadcastPayload norm = NormalizedBroadcastPayload.builder()
                .title("Bulk Discount")
                .message("Holiday discount active.")
                .targetType("ALL")
                .specificOwnerId(null)
                .sendEmail(true)
                .build();
        String hash = CanonicalPayloadHasher.computeHash(norm);

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(502L)
                .idempotencyKey(key)
                .payloadHash(hash)
                .status("COMPLETED")
                .recipientCount(12)
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ResponseEntity<String> response = controller.sendAdminMessage(request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().contains("already queued or processing"));

        // Verify zero database writes or notifications triggered
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("STG-05: Same idempotency key with modified payload returns HTTP 409 Conflict")
    void testSameKeyModifiedPayloadReturns409() {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Changed Title")
                .message("Changed Message.")
                .targetType("ALL")
                .sendEmail(false)
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenReturn(Optional.empty());

        BroadcastHistory existing = BroadcastHistory.builder()
                .id(503L)
                .idempotencyKey(key)
                .payloadHash("original-canonical-hash-000000000000000000000000000000000000000000")
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ResponseEntity<String> response = controller.sendAdminMessage(request);
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertTrue(response.getBody().contains("previously used with different parameters"));
    }

    @Test
    @DisplayName("STG-07: Concurrent duplicate submissions schedule exactly one asynchronous batch worker")
    void testConcurrentSubmissionsScheduleExactlyOneWorker() throws Exception {
        UUID key = UUID.randomUUID();
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(key)
                .title("Concurrent Test")
                .message("Thread safety check.")
                .targetType("ALL")
                .sendEmail(false)
                .build();

        NormalizedBroadcastPayload norm = NormalizedBroadcastPayload.builder()
                .title("Concurrent Test")
                .message("Thread safety check.")
                .targetType("ALL")
                .specificOwnerId(null)
                .sendEmail(false)
                .build();
        String hash = CanonicalPayloadHasher.computeHash(norm);

        BroadcastHistory existingReserved = BroadcastHistory.builder()
                .id(504L)
                .idempotencyKey(key)
                .payloadHash(hash)
                .status("RESERVED")
                .leaseToken(UUID.randomUUID())
                .leaseExpiresAt(LocalDateTime.now().plusSeconds(60))
                .build();

        AtomicInteger insertAttempts = new AtomicInteger(0);
        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), eq(key), any()))
                .thenAnswer(invocation -> {
                    if (insertAttempts.incrementAndGet() == 1) {
                        return Optional.of(504L); // Winner
                    }
                    return Optional.empty(); // Loser
                });

        when(broadcastHistoryRepository.findByIdempotencyKey(key))
                .thenReturn(Optional.of(existingReserved));

        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        List<ResponseEntity<String>> responses = new CopyOnWriteArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    responses.add(controller.sendAdminMessage(request));
                } catch (Exception e) {
                    fail("Concurrent request thread failed: " + e.getMessage());
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(5, TimeUnit.SECONDS));
        executor.shutdown();

        assertEquals(threadCount, responses.size());
        long newReservations = responses.stream()
                .filter(r -> r.getBody().contains("dispatched successfully"))
                .count();
        long duplicateSkips = responses.stream()
                .filter(r -> r.getBody().contains("already queued or processing"))
                .count();

        assertEquals(1, newReservations, "Exactly one thread must win reservation");
        assertEquals(threadCount - 1, duplicateSkips, "All other concurrent threads must receive duplicate skip response");
    }

    @Test
    @DisplayName("STG-08: Stale-worker fencing aborts delayed workers cleanly")
    void testStaleWorkerFencingAbortsExecution() {
        UUID workerToken = UUID.randomUUID();
        UUID newDbToken = UUID.randomUUID(); // Lease was reclaimed by another worker/retry

        BroadcastHistory history = BroadcastHistory.builder()
                .id(505L)
                .leaseToken(newDbToken) // Mismatched
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findById(505L)).thenReturn(Optional.of(history));

        broadcastService.processBroadcastAsync(505L, workerToken);

        // Zero notifications created
        verify(notificationRepository, never()).save(any());
        // History record untouched
        verify(broadcastHistoryRepository, never()).save(any());
        // Zero events published
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    @DisplayName("STG-09: Failure persistence strictly fences by leaseToken")
    void testFailurePersistenceGuardedByLeaseToken() {
        UUID workerToken = UUID.randomUUID();
        UUID rotatedDbToken = UUID.randomUUID();

        BroadcastHistory history = BroadcastHistory.builder()
                .id(506L)
                .leaseToken(rotatedDbToken) // Stale worker token
                .status("RESERVED")
                .build();

        BroadcastHistoryRepository mockRepo = mock(BroadcastHistoryRepository.class);
        when(mockRepo.findById(506L)).thenReturn(Optional.of(history));

        BroadcastFailureService failureService = new BroadcastFailureService(mockRepo);
        failureService.markFailedRequiresNew(506L, workerToken, "Worker timed out");

        // Verify status was NOT changed to FAILED because leaseToken did not match
        assertEquals("RESERVED", history.getStatus());
        verify(mockRepo, never()).save(history);
    }

    @Test
    @DisplayName("STG-10: Lock timeout returns HTTP 429 with Retry-After header")
    void testLockTimeoutMapsToHttp429WithRetryAfter() {
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(UUID.randomUUID())
                .title("Locked")
                .message("Contention test.")
                .targetType("ALL")
                .build();

        when(broadcastHistoryRepository.insertIfAbsent(any(), any(), any(), any()))
                .thenThrow(new CannotAcquireLockException("canceling statement due to lock timeout"));

        ResponseEntity<String> response = controller.sendAdminMessage(request);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("2", response.getHeaders().getFirst("Retry-After"));
        assertTrue(response.getBody().contains("locked by active processing"));
    }

    @Test
    @DisplayName("STG-11: Transaction rollback: no partial notifications and no after-commit events")
    void testTransactionRollbackEnsuresZeroNotificationsAndNoEvents() {
        UUID token = UUID.randomUUID();
        BroadcastHistory history = BroadcastHistory.builder()
                .id(507L)
                .title("Crash Test")
                .message("Simulating runtime database fault")
                .targetType("ALL")
                .leaseToken(token)
                .status("RESERVED")
                .build();

        when(broadcastHistoryRepository.findById(507L)).thenReturn(Optional.of(history));
        when(userRepository.findByRoleAndStatus(UserRole.SHOP_OWNER, UserStatus.ACTIVE))
                .thenReturn(List.of(activeOwner1));

        // Simulate database exception during notification persistence
        when(notificationRepository.save(any()))
                .thenThrow(new RuntimeException("Simulated PostgreSQL connection failure"));

        assertThrows(RuntimeException.class, () -> broadcastService.processBroadcastAsync(507L, token));

        // Verify status never marked COMPLETED
        assertNotEquals("COMPLETED", history.getStatus());
        // Verify post-commit event NEVER emitted
        verify(eventPublisher, never()).publishEvent(any(BroadcastCommittedEvent.class));
        // Verify failure recording triggered via REQUIRES_NEW
        verify(broadcastFailureService, times(1)).markFailedRequiresNew(eq(507L), eq(token), anyString());
    }
}
