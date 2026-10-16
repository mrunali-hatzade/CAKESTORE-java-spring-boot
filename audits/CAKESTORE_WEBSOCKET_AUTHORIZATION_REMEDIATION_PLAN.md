# CakeStore — WebSocket Authorization Remediation Plan

**Target Feature:** WebSocket STOMP Messaging Security Remediation  
**Status:** PLAN ONLY (Read-Only Planning Phase — No Application Code Modified)  
**Operating System:** Windows  
**Date:** October 16, 2026  
**Planner:** Antigravity AI (Google DeepMind - Advanced Agentic Coding)

---

## 1. Validated Root Causes

Investigation of `backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java` confirmed four specific architectural deficiencies:

1. **CONNECT Silent Fallback on Missing/Invalid Credentials (`WebSocketConfig.java:L50-68`):**  
   If the `Authorization` header is missing, expired, or invalid, the interceptor logs nothing and returns `message` without throwing an `AuthenticationException`. Spring WebSocket interprets this as an anonymous session, keeping the connection open.
2. **Missing Inbound SUBSCRIBE Destination Authorization (`WebSocketConfig.java:L45-71`):**  
   The interceptor inspects only `StompCommand.CONNECT`. `StompCommand.SUBSCRIBE` passes uninspected to `SimpleBroker`, permitting any connected client to register subscriptions to `/queue/admin-notifications-{anyId}` or `/queue/notifications-{anyId}`.
3. **Unrestricted Inbound SEND Frames (`WebSocketConfig.java:L32-34`):**  
   The broker enables `/queue` and destination prefixes `/app`. While 0 `@MessageMapping` handlers exist in the backend (meaning no server business logic can be invoked), `SimpleBroker` by default permits clients to send STOMP `SEND` frames directly to `/queue/**`, reflecting forged payloads to other active subscribers.
4. **Missing WebSocket Security Tests:**  
   No unit or integration tests exist in `backend/src/test/java/` verifying STOMP connection rejection, subscription filtering, or message permissions.

---

## 2. Selected Authorization Approach vs Alternatives Considered

### Selected Approach: Enhanced `ChannelInterceptor` in `WebSocketConfig.java`
- **Mechanism:** Extend the existing `configureClientInboundChannel` interceptor to explicitly handle:
  1. `StompCommand.CONNECT`: Enforce valid JWT Bearer authentication or throw `AccessDeniedException`.
  2. `StompCommand.SUBSCRIBE`: Inspect `accessor.getDestination()`, parse target user ID, and verify against `accessor.getUser()`.
  3. `StompCommand.SEND`: Reject all client `SEND` frames directed to `/queue/**` (and any other unmapped destinations).
- **Pros:**
  - Zero new Maven dependencies (no need to pull in `spring-security-messaging` which requires complex XML or experimental Spring 6 `AuthorizationManager` beans).
  - Minimal diff footprint (confined to `WebSocketConfig.java`).
  - High performance: regex pattern matching and principal casting take under 1 microsecond per frame.
  - Full compatibility with existing SockJS client in `AdminNotificationBell.tsx` and `owner/NotificationBell.tsx`.

### Alternatives Considered & Rejected:
1. **`spring-security-messaging` (`AbstractSecurityWebSocketMessageBrokerConfigurer` or `@EnableWebSocketSecurity`):**  
   *Rejected.* `spring-security-messaging` is not present in `pom.xml`. Introducing it requires altering dependencies, risk of version alignment conflicts with Spring Boot 3.3 / Spring Security 6, and introduces CSRF requirements that break standard SockJS/STOMP browser clients without extensive configuration.
2. **User-Destination Prefix (`/user/queue/...` with `SimpMessagingTemplate.convertAndSendToUser`):**  
   *Rejected.* While user destinations are idiomatic in Spring STOMP, switching would require altering:
   - Backend `NotificationService.java` (`convertAndSendToUser`)
   - Backend `AdminNotificationService.java`
   - Backend `BroadcastCommittedEventListener.java`
   - Frontend `AdminNotificationBell.tsx` (`/user/queue/admin-notifications`)
   - Frontend `owner/NotificationBell.tsx` (`/user/queue/notifications`)  
   This expands scope across multiple frontend and backend files. Restricting `/queue/admin-notifications-{userId}` at the interceptor level achieves identical security isolation with zero frontend contract changes.

---

## 3. Destination-by-Role Authorization Policy

| Inbound Command | Target Destination Pattern | Required Role | Required Ownership Check | Outcome if Violating |
|:---|:---|:---|:---|:---|
| **CONNECT** | N/A | Any valid account | Valid non-expired JWT; Account not locked | `AccessDeniedException("Authentication required")` |
| **SUBSCRIBE** | `/queue/admin-notifications-{userId}` | `ROLE_ADMIN` | `CustomUserDetails.getId() == {userId}` | `AccessDeniedException("Access denied to admin destination")` |
| **SUBSCRIBE** | `/queue/notifications-{userId}` | `ROLE_SHOP_OWNER` or `ROLE_ADMIN` | `CustomUserDetails.getId() == {userId}` (or `ROLE_ADMIN`) | `AccessDeniedException("Access denied to user destination")` |
| **SUBSCRIBE** | Any other `/queue/**` or arbitrary destination | N/A | None (Unmapped destination) | `AccessDeniedException("Invalid subscription destination")` |
| **SEND** | Any destination (`/queue/**`, `/app/**`, etc.) | N/A | Clients have no publishing privileges | `AccessDeniedException("Client publish not permitted")` |

*Security Invariants:*
- Anonymous sessions cannot connect or subscribe.
- Admins cannot eavesdrop on other admins' notifications.
- Non-admins cannot access admin notification streams.
- Shop owners cannot eavesdrop on other shop owners' notifications.
- No client can forge notification messages to the broker.

---

## 4. Exact Proposed File Changes

### 1. `backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java` (REQUIRED)
- **Nature of Change:** Remediation of `configureClientInboundChannel`.
- **Details:**
  - On `CONNECT`: If header missing, invalid token, or user locked, throw `org.springframework.security.access.AccessDeniedException`.
  - On `SUBSCRIBE`:
    - Verify `accessor.getUser()` is non-null and is an instance of `Authentication` with `CustomUserDetails`.
    - Match `destination` against compiled regex patterns:
      - `^/queue/admin-notifications-(\\d+)$`
      - `^/queue/notifications-(\\d+)$`
    - Extract `{targetUserId}` and compare with authenticated user's ID and authorities.
    - If no pattern matches or authorization fails, throw `AccessDeniedException`.
  - On `SEND`:
    - Throw `AccessDeniedException("Client-side publishing is disabled")`.

### 2. `backend/src/test/java/com/cakeplatform/api/modules/notification/WebSocketSecurityTest.java` (REQUIRED)
- **Nature of Change:** New unit/integration test suite.
- **Details:**
  - Tests STOMP message channel interceptor directly using mock STOMP frames (`StompHeaderAccessor`).
  - Verifies all 14 required security scenarios without needing a live network port.

### 3. `frontend_v2/components/owner/NotificationBell.tsx` (OPTIONAL / MINOR REFINEMENT)
- **Current Observation:** `owner/NotificationBell.tsx:L122` hardcodes `'http://localhost:8080/ws-endpoint'`, whereas `AdminNotificationBell.tsx` uses dynamic `getWebSocketEndpoint()`.
- **Note:** While not a security vulnerability (since connect headers send the bearer token), aligning it with `getWebSocketEndpoint()` prevents connection failures in staging/production environments.

---

## 5. Minimal Implementation Sequence

1. **Step 1 — Implement Channel Interceptor Authorization:**
   Update `WebSocketConfig.java` with strict destination parsing, role verification, and frame filtering.
2. **Step 2 — Implement Automated Security Test Suite:**
   Create `WebSocketSecurityTest.java` using Spring Messaging test utilities (`MessageBuilder`, `StompHeaderAccessor`) to validate all edge cases.
3. **Step 3 — Execute Test Suite:**
   Run `mvn test -Dtest=WebSocketSecurityTest` to verify 100% pass rate.
4. **Step 4 — Verify Full Regression:**
   Run `mvn test "-Dtest=WebSocketSecurityTest,AdminMessageControllerTest,BroadcastAutomatedSmokeTest,BroadcastServiceTest"` to ensure existing notification and broadcast functionality is unaffected.

---

## 6. Test Cases and Expected Outcomes

| # | Test Case Description | Inbound Frame & Destination | Authenticated Principal | Expected Outcome |
|:---|:---|:---|:---|:---|
| 1 | Valid Admin CONNECT | `CONNECT` with valid Admin JWT | Admin (ID: 1) | **PASS** (Session authenticated) |
| 2 | Missing JWT on CONNECT | `CONNECT` without `Authorization` header | None | **FAIL / REJECTED** (`AccessDeniedException`) |
| 3 | Malformed / Expired JWT | `CONNECT` with garbage token | None | **FAIL / REJECTED** (`AccessDeniedException`) |
| 4 | Locked User CONNECT | `CONNECT` with valid JWT for `status=LOCKED` | Locked User | **FAIL / REJECTED** (`AccessDeniedException`) |
| 5 | Admin own queue SUBSCRIBE | `SUBSCRIBE` to `/queue/admin-notifications-1` | Admin (ID: 1, `ROLE_ADMIN`) | **PASS** (Subscription accepted) |
| 6 | Cross-Admin SUBSCRIBE | `SUBSCRIBE` to `/queue/admin-notifications-2` | Admin (ID: 1, `ROLE_ADMIN`) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 7 | Owner to Admin SUBSCRIBE | `SUBSCRIBE` to `/queue/admin-notifications-1` | Owner (ID: 5, `ROLE_SHOP_OWNER`) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 8 | Customer to Admin SUBSCRIBE | `SUBSCRIBE` to `/queue/admin-notifications-1` | Customer (ID: 10, `ROLE_CUSTOMER`) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 9 | Owner own queue SUBSCRIBE | `SUBSCRIBE` to `/queue/notifications-5` | Owner (ID: 5, `ROLE_SHOP_OWNER`) | **PASS** (Subscription accepted) |
| 10 | Cross-Owner SUBSCRIBE | `SUBSCRIBE` to `/queue/notifications-6` | Owner (ID: 5, `ROLE_SHOP_OWNER`) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 11 | Customer to Owner SUBSCRIBE | `SUBSCRIBE` to `/queue/notifications-5` | Customer (ID: 10, `ROLE_CUSTOMER`) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 12 | Wildcard Destination | `SUBSCRIBE` to `/queue/**` or `/queue/notifications-*` | Admin (ID: 1) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 13 | Malformed Destination | `SUBSCRIBE` to `/queue/admin-notifications-abc` | Admin (ID: 1) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 14 | Client SEND Attempt | `SEND` to `/queue/admin-notifications-1` | Admin (ID: 1) | **FAIL / REJECTED** (`AccessDeniedException`) |
| 15 | Broadcast Event Delivery | Server publishes to `/queue/notifications-5` via `SimpMessagingTemplate` | Server-side execution | **PASS** (Delivered to authorized owner) |

---

## 7. Backward-Compatibility Risks & Mitigations

- **Frontend Client Impact:**  
  Both `AdminNotificationBell.tsx` and `NotificationBell.tsx` already transmit `Authorization: Bearer <token>` in `connectHeaders` during `client.activate()` and subscribe exclusively to their own IDs (`/queue/admin-notifications-${user.id}` and `/queue/notifications-${user.id}`). **Zero breaking changes will be introduced for legitimate clients.**
- **SockJS Heartbeats and Session Disconnects:**  
  STOMP `DISCONNECT`, `UNSUBSCRIBE`, and heartbeat frames (`accessor.getCommand() == null` or `StompCommand.DISCONNECT`) will pass through without obstruction, ensuring clean session termination.

---

## 8. Acceptance Criteria

1. STOMP `CONNECT` requests without a valid, unexpired JWT are rejected immediately with `AccessDeniedException`.
2. STOMP `SUBSCRIBE` frames directed to `/queue/admin-notifications-{id}` succeed **only** if the client is authenticated, has `ROLE_ADMIN`, and has user ID equal to `{id}`.
3. STOMP `SUBSCRIBE` frames directed to `/queue/notifications-{id}` succeed **only** if the client is authenticated and has user ID equal to `{id}` (or `ROLE_ADMIN`).
4. Any attempt to subscribe to wildcards, non-existent destinations, or another user's queue is rejected with `AccessDeniedException`.
5. Any client-originated STOMP `SEND` frame is rejected with `AccessDeniedException`.
6. All existing notification delivery (admin alerts, order notifications, broadcasts) continues to function seamlessly.
7. Automated test suite passes 100% of defined security and regression scenarios.

---

## 9. Safety Confirmation

- **No application files modified.**
- **No tests created or executed during this planning turn.**
- **No database mutations performed.**
- **Git working tree verified clean and preserved.**
