package com.cakeplatform.api.modules.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AdminMessageControllerTest {

    @Mock
    private BroadcastService broadcastService;

    @InjectMocks
    private AdminMessageController controller;

    @Test
    @DisplayName("Lock timeout returns HTTP 429 with Retry-After header")
    void testLockTimeoutReturns429WithRetryAfter() {
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(UUID.randomUUID())
                .title("Busy Broadcast")
                .message("Locked record.")
                .targetType("ALL")
                .build();

        when(broadcastService.reserveBroadcast(any()))
                .thenThrow(new CannotAcquireLockException("Lock wait timeout exceeded"));

        ResponseEntity<String> response = controller.sendAdminMessage(request);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("2", response.getHeaders().getFirst("Retry-After"));
        assertTrue(response.getBody().contains("locked by active processing"));
    }

    @Test
    @DisplayName("PostgreSQL SQLState 55P03 root cause maps to HTTP 429 with Retry-After header")
    void testPostgreSQLLockNotAvailableRootCause() {
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(UUID.randomUUID())
                .title("Busy Broadcast")
                .message("Locked record.")
                .targetType("ALL")
                .build();

        SQLException sqlEx = new SQLException("canceling statement due to lock timeout", "55P03");
        RuntimeException wrapped = new RuntimeException("Wrapped DB error", sqlEx);

        when(broadcastService.reserveBroadcast(any())).thenThrow(wrapped);

        ResponseEntity<String> response = controller.sendAdminMessage(request);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("2", response.getHeaders().getFirst("Retry-After"));
    }

    @Test
    @DisplayName("Terminal failure outcome returns HTTP 409 Conflict")
    void testTerminalFailureReturns409() {
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(UUID.randomUUID())
                .title("Terminal")
                .message("Failed previously.")
                .targetType("ALL")
                .build();

        ReservationOutcome outcome = ReservationOutcome.builder()
                .type(ReservationOutcome.Type.TERMINAL_FAILURE)
                .broadcastId(99L)
                .message("Previous broadcast attempt failed: fatal DB timeout")
                .build();

        when(broadcastService.reserveBroadcast(any())).thenReturn(outcome);

        ResponseEntity<String> response = controller.sendAdminMessage(request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertTrue(response.getBody().contains("failed"));
        verify(broadcastService, never()).processBroadcastAsync(any(), any());
    }

    @Test
    @DisplayName("Duplicate in-flight or unexpired lease returns HTTP 200 without scheduling worker")
    void testAlreadyProcessingReturns200WithoutWorker() {
        AdminMessageRequest request = AdminMessageRequest.builder()
                .idempotencyKey(UUID.randomUUID())
                .title("In Flight")
                .message("Processing.")
                .targetType("ALL")
                .build();

        ReservationOutcome outcome = ReservationOutcome.builder()
                .type(ReservationOutcome.Type.ALREADY_PROCESSING)
                .broadcastId(99L)
                .message("Broadcast already queued or processing.")
                .build();

        when(broadcastService.reserveBroadcast(any())).thenReturn(outcome);

        ResponseEntity<String> response = controller.sendAdminMessage(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().contains("already queued or processing"));
        verify(broadcastService, never()).processBroadcastAsync(any(), any());
    }
}
