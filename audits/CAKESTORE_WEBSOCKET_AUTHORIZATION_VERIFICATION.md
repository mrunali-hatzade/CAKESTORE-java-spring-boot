# CakeStore — WebSocket Authorization Verification Report

**Target Feature:** WebSocket STOMP Messaging & Notification Subscriptions  
**Investigation Mode:** STRICT READ-ONLY SECURITY VERIFICATION  
**Operating System:** Windows  
**Completion Date:** October 16, 2026  
**Investigator:** Antigravity AI (Google DeepMind - Advanced Agentic Coding)

---

## 1. Executive Verdict

### Verification Result: **CONFIRMED VULNERABLE (Channel Authorization Gap)**

The previously reported security concern regarding **unauthorized STOMP SUBSCRIBE destination access** is **CONFIRMED at the source-code level**:

1. **Authentication is Performed at CONNECT Only:**  
   `WebSocketConfig.java` validates the JWT Bearer token only when processing `StompCommand.CONNECT`. Once a connection is established, the connection receives an authenticated principal based on the valid token.
2. **Zero Destination-Level Authorization on SUBSCRIBE:**  
   There is **no** `AuthorizationManager<Message<?>>`, **no** Spring Security WebSocket interceptor (`@EnableWebSocketSecurity`), and **no** custom destination check implemented in `configureClientInboundChannel` for `StompCommand.SUBSCRIBE`.
3. **Open Destination Subscriptions:**  
   Any user possessing a valid JWT—regardless of role (`CUSTOMER`, `SHOP_OWNER`, or `ADMIN`)—can send a STOMP `SUBSCRIBE` frame to **any** `/queue/**` destination, including:
   - `/queue/admin-notifications-{adminUserId}` (Exposes sensitive admin platform alerts, security notices, and enquiry metadata).
   - `/queue/notifications-{ownerUserId}` (Exposes private shop orders, customer names, addresses, and delivery alerts).
4. **No Server-Side Action Invocation Risk via SEND:**  
   There are **no** `@MessageMapping` controller endpoints registered in the application. Inbound `SEND` frames cannot execute arbitrary server logic or inject notifications into the database. However, simple broker message reflection may permit unauthenticated message broadcasting depending on broker configuration.

---

## 2. Relevant Architecture and Authentication Flow

```
[ Frontend STOMP Client (SockJS) ]
                 │
                 │ 1. HTTP Handshake: GET /ws-endpoint/info
                 │    (Permitted by SecurityConfig: .requestMatchers("/ws-endpoint/**").permitAll())
                 │
                 ▼
[ WebSocket Inbound Channel Interceptor ]
                 │
                 ├─► 2. STOMP CONNECT:
                 │      - Reads header: "Authorization: Bearer <jwt>"
                 │      - Extracts username -> CustomUserDetailsService -> UserDetails
                 │      - Validates signature, expiry, and user status via JwtService
                 │      - Sets accessor.setUser(UsernamePasswordAuthenticationToken)
                 │
                 ├─► 3. STOMP SUBSCRIBE (Destination: /queue/admin-notifications-1):
                 │      - [GAP] PreSend interceptor does NOT inspect destination!
                 │      - Does NOT verify if accessor.getUser().getId() == destination ID.
                 │      - Frame passes straight to Spring SimpleBroker.
                 │
                 ▼
[ Spring In-Memory SimpleBroker (/queue) ]
                 │
                 └─► Subscription accepted and registered.
                     Future messages converted & sent to /queue/admin-notifications-1
                     are immediately delivered to this client.
```

---

## 3. CONNECT Authentication Analysis

### 3.1 Trace of CONNECT Handling
In `backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java`:
```java
44:    @Override
45:    public void configureClientInboundChannel(ChannelRegistration registration) {
46:        registration.interceptors(new ChannelInterceptor() {
47:            @Override
48:            public Message<?> preSend(Message<?> message, MessageChannel channel) {
49:                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
50:
51:                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
52:                    String authHeader = accessor.getFirstNativeHeader("Authorization");
53:                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
54:                        String jwt = authHeader.substring(7);
55:                        String username = jwtService.extractUsername(jwt);
56:
57:                        if (username != null) {
58:                            UserDetails userDetails = customUserDetailsService.loadUserByUsername(username);
59:                            if (jwtService.isTokenValid(jwt, userDetails)) {
60:                                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
61:                                        userDetails, null, userDetails.getAuthorities()
62:                                );
63:                                accessor.setUser(authToken);
64:                                SecurityContextHolder.getContext().setAuthentication(authToken);
65:                            }
66:                        }
67:                    }
68:                }
69:                return message;
70:            }
71:        });
72:    }
```

### 3.2 Key Findings on CONNECT
- **JWT Validation:** **Protected.** Token signature, expiration, and user account status (`!LOCKED`) are verified through `jwtService.isTokenValid(jwt, userDetails)`.
- **Principal Derivation:** **Protected.** The principal is loaded from `customUserDetailsService` based on the subject claim inside the cryptographic JWT, not arbitrary client headers.
- **Unauthenticated Connection Behavior:**  
  If the `Authorization` header is missing, malformed, or contains an invalid JWT, `accessor.setUser(...)` is **not** called. However, **`preSend` returns `message` without throwing an `AuthenticationException` or rejecting the frame**.  
  Consequently, in Spring STOMP, the connection proceeds as an **anonymous / unauthenticated session**!

---

## 4. SUBSCRIBE Destination Authorization Analysis

### 4.1 Trace of SUBSCRIBE Handling
When a STOMP client issues a `SUBSCRIBE` frame (e.g. `destination: /queue/admin-notifications-1`):
1. `preSend` checks `if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand()))`.
2. Because `accessor.getCommand()` is `StompCommand.SUBSCRIBE`, the `if` block evaluates to `false`.
3. Line 69 simply executes: `return message;`.
4. The message passes to `SimpleBrokerMessageHandler`.
5. Spring's built-in `SimpleBroker` registers the session's subscription to the destination path verbatim.

### 4.2 Specific Assessment Questions

| Question | Assessment | Evidence |
|:---|:---|:---|
| **1. Can an authenticated admin subscribe to another admin's queue?** | **Confirmed Vulnerable** | `WebSocketConfig.java:L45-70` does not filter subscriptions. Admin A (id=2) can subscribe to `/queue/admin-notifications-1`. |
| **2. Can an ordinary user subscribe to an admin's queue?** | **Confirmed Vulnerable** | Any user with role `CUSTOMER` or `SHOP_OWNER` possessing a valid login JWT can subscribe to `/queue/admin-notifications-{adminId}`. |
| **3. Can an admin subscribe to a shop owner's queue?** | **Confirmed Vulnerable** | Any authenticated user can subscribe to `/queue/notifications-{ownerId}`. |
| **4. Can an owner or customer subscribe to another owner's queue?** | **Confirmed Vulnerable** | Owner B can subscribe to `/queue/notifications-{ownerAId}`. Customer C can also subscribe. |
| **5. Can anonymous (unauthenticated) clients subscribe?** | **Confirmed Vulnerable** | Missing JWT does not abort `CONNECT`. Anonymous sessions can issue `SUBSCRIBE` frames to `/queue/**`. |
| **6. Are wildcard / malformed destinations possible?** | **Confirmed Vulnerable** | In Spring's `AntPathMatcher` used by `SimpleBroker`, patterns like `/queue/**` or `/queue/notifications-*` can match broadcasted destinations. |
| **7. Are inbound SEND frames restricted?** | **Potentially Vulnerable** | Clients sending messages to `/queue/...` directly will have those messages dispatched by `SimpleBroker` to all subscribers of that destination! |
| **8. Does any broker/Spring configuration block these?** | **No** | No other interceptors or `SecurityConfig` rules exist for STOMP destinations. |

---

## 5. SEND and Inbound-Message Authorization Analysis

### 5.1 Server-Side Command Execution
- **Inspection of `@MessageMapping`:** A full codebase search found **0 occurrences** of `@MessageMapping`.
- **Verdict:** Clients **cannot** invoke backend business logic, service methods, or database mutations via WebSocket SEND frames.

### 5.2 Direct Message Injection / Reflection via SimpleBroker
- `SimpleBroker` handles prefixes `/queue`.
- When a client sends a STOMP `SEND` frame with `destination: /queue/admin-notifications-1`:
  - Because no interceptor blocks `StompCommand.SEND`, `SimpleBrokerMessageHandler` broadcasts that payload to all current subscribers of `/queue/admin-notifications-1`.
  - An attacker could forge a fake notification payload that appears in the frontend bell of an admin or shop owner currently connected to that server instance.

---

## 6. Role-by-Destination Security Matrix

| Role | Destination: `/queue/admin-notifications-{adminId}` | Destination: `/queue/notifications-{ownerId}` | Direct `SEND` to `/queue/**` |
|:---|:---|:---|:---|
| **Anonymous (No JWT)** | ❌ **Allowed** (Defect: Connection not rejected) | ❌ **Allowed** (Defect: Connection not rejected) | ❌ **Allowed** (Can reflect messages) |
| **CUSTOMER** | ❌ **Allowed** (Unauthorized cross-role read) | ❌ **Allowed** (Unauthorized cross-user read) | ❌ **Allowed** (Can reflect messages) |
| **SHOP_OWNER** | ❌ **Allowed** (Unauthorized cross-role read) | ❌ **Allowed** (Unauthorized cross-user read) | ❌ **Allowed** (Can reflect messages) |
| **ADMIN** | ⚠️ **Allowed** (Can read other admins' queues) | ⚠️ **Allowed** (Can read all owners' queues) | ❌ **Allowed** (Can reflect messages) |

*Expected Policy:*
- `/queue/admin-notifications-{id}` should require `ROLE_ADMIN` **AND** `principal.id == {id}`.
- `/queue/notifications-{id}` should require `principal.id == {id}` (or `ROLE_ADMIN`).
- Inbound `SEND` frames from clients to `/queue/**` should be **denied completely** (only server-side `SimpMessagingTemplate` should publish).

---

## 7. Exact Source Evidence

### 1. Endpoint Unrestricted in HTTP Security
`backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java:L73`:
```java
73:  .requestMatchers("/ws-endpoint/**").permitAll()
```
*Allows initial SockJS HTTP handshake without Bearer token in HTTP header.*

### 2. Missing Exception on Invalid/Missing JWT in CONNECT
`backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java:L51-68`:
```java
51:  if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
52:      String authHeader = accessor.getFirstNativeHeader("Authorization");
53:      if (authHeader != null && authHeader.startsWith("Bearer ")) {
             ...
65:      }
66:  }
68:  return message;
```
*If `authHeader` is null or invalid, the method silently returns `message` without throwing an `AccessDeniedException` or closing the connection.*

### 3. Missing SUBSCRIBE Interception
`backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java:L50-70`:
*Only `StompCommand.CONNECT` is checked. `StompCommand.SUBSCRIBE` and `StompCommand.SEND` have zero handling or destination authorization.*

---

## 8. Practical Impact Assessment

### What IS Exposed:
1. **Real-time Admin Notifications:**
   - Platform feedback submissions with customer phone numbers and feedback text.
   - Contact enquiries containing sender name, email, and inquiry messages.
   - Bakery shop registrations and administrative status transitions.
2. **Real-time Shop Owner Notifications:**
   - Customer orders containing delivery addresses, customer phone numbers, order items, and amounts.
   - Administrative broadcast announcements sent to specific shop owners.
3. **Spoofed UI Notifications:**
   - An attacker can send a fabricated STOMP `SEND` frame to `/queue/admin-notifications-{id}`, causing the admin's notification bell to display a forged alert until the page is refreshed from the database.

### What is NOT Exposed:
- **Historical Notification Records:** The WebSocket only pushes live events. An attacker subscribing to a queue does not get past database records unless an event occurs while they are listening.
- **Database / REST Endpoints:** REST API endpoints (`GET /api/admin/notifications`, `PATCH /api/admin/notifications/{id}/read`) are strictly secured by `@PreAuthorize("hasRole('ADMIN')")` and SQL recipient checks. An attacker cannot read or alter persistent database state via this WebSocket gap.

---

## 9. Existing Test Coverage and Gaps

- **Existing Tests:**
  - `NotificationServiceTest.java`: Only mocks `SimpMessagingTemplate` to verify `convertAndSend` is called with `/queue/notifications-101`.
  - `adminNotificationsErrorHandling.test.mjs`: Tests REST client error propagation.
- **Test Gaps:**
  - **Zero** tests exist for `WebSocketConfig`.
  - **Zero** tests test STOMP authentication, subscription rejections, or cross-user destination attempts.

---

## 10. Recommended Minimal Corrective Direction (Plan Outline Only)

To completely mitigate this vulnerability without introducing architectural overhead:

1. **Enforce CONNECT Authentication:**
   In `WebSocketConfig.configureClientInboundChannel`:
   - If `StompCommand.CONNECT` lacks a valid JWT, throw `new org.springframework.security.access.AccessDeniedException("Authentication required")`.
2. **Enforce SUBSCRIBE Destination Authorization:**
   - Intercept `StompCommand.SUBSCRIBE`.
   - Extract `destination = accessor.getDestination()`.
   - Reject anonymous users.
   - For `/queue/admin-notifications-{userId}`:
     - Require user to have `ROLE_ADMIN`.
     - Require `user.getId().toString().equals(userId)`.
   - For `/queue/notifications-{userId}`:
     - Require `user.getId().toString().equals(userId)` (or `ROLE_ADMIN`).
   - If unauthorized, throw `new AccessDeniedException("Unauthorized subscription destination")`.
3. **Block Inbound Client SEND Frames:**
   - Intercept `StompCommand.SEND`.
   - Deny client messages to `/queue/**` (clients should only listen, not send).

---

## 11. Safety Check & Verification Confirmation

- **Application code modified:** NONE (Strictly read-only).
- **Test files modified:** NONE.
- **Database records altered:** NONE.
- **Git working tree status:** Verified unchanged via `git status --short`. All pre-existing modifications remain preserved.
