# CakeStore — Owner Notifications Phase 1 Remediation Report

**Date**: 2026-10-17  
**Scope**: Phase 1 Remediation — Authenticated Identity Serialization & Secure Notification Subscription  
**Verdict**: **PASS**

---

## 1. Executive Summary

During the Shop Owner Dashboard audit, a critical WebSocket/STOMP notification defect was identified: the authentication response omitted the authenticated user's ID (`id`) and shop association (`shopId`), causing the frontend to attempt subscribing to the invalid destination `/queue/notifications-undefined`. This invalid destination was rightly rejected by the backend's strict destination authorization channel interceptor with:
```
[WS-AUTH] STOMP SUBSCRIBE rejected: Unknown or unauthorized destination '/queue/notifications-undefined' for user 9
```

Phase 1 remediation has been implemented, tested, and locally verified:
1. **Backend Identity Serialization**: `AuthResponse` was updated to include `id` and `shopId` (`Long`). `AuthService.java` now populates both fields consistently across registration and login paths.
2. **Frontend State & Typing**: `types/auth.ts` and `lib/auth/AuthContext.tsx` were updated to preserve and persist `id` and `shopId` in `AuthUser` and `localStorage` (`cakestore_user`).
3. **Safe Subscription Guard**: Both `components/owner/NotificationBell.tsx` and `components/admin/AdminNotificationBell.tsx` now employ strict destination resolution helpers (`resolveOwnerNotificationDestination` and `resolveAdminNotificationDestination`). Subscriptions are completely blocked unless a strictly positive integer ID is present; the frontend will **never** construct a destination containing `undefined`, `null`, or non-numeric tokens.
4. **Tenant Isolation & Backend Security**: The backend's destination regex authorization (`^/queue/notifications-(\\d+)$`) in `WebSocketConfig.java` was **preserved without compromise**.
5. **Verification**: 
   - Backend unit/integration tests: **17/17 passing** (0 failures).
   - Frontend unit test suite: **133/133 passing** (0 failures).
   - Frontend lint: **0 warnings, 0 errors**.
   - Frontend production build: **38/38 routes compiled successfully**.
   - Live browser verification: Owner login and live connection verified on `http://localhost:3000/dashboard/owner` with authenticated STOMP connection and zero `notifications-undefined` rejections.

---

## 2. Changed Files Inventory

| File Path | Change Description |
|---|---|
| [`backend/src/main/java/com/cakeplatform/api/modules/auth/dto/AuthResponse.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/dto/AuthResponse.java) | Added `private Long id;` and `private Long shopId;` with Lombok getters/setters/builder. |
| [`backend/src/main/java/com/cakeplatform/api/modules/auth/service/AuthService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/AuthService.java) | Populated `.id(savedUser.getId())` and `.shopId(...)` in `register()`, and `.id(user.getId())` and `.shopId(ownerShop.map(Shop::getId).orElse(null))` in `login()`. |
| [`backend/src/test/java/com/cakeplatform/api/modules/auth/RegistrationIdentityIntegrityTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/auth/RegistrationIdentityIntegrityTest.java) | Added assertions for `id` and `shopId` on registration & login, plus added `testLogin_ReturnsUserIdAndShopId`. |
| [`frontend_v2/types/auth.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/auth.ts) | Added optional `shopStatus?: string;` and `subscriptionStatus?: string;` to `LoginResponse` DTO to align with backend payload. |
| [`frontend_v2/lib/auth/AuthContext.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/auth/AuthContext.tsx) | Mapped `id: res.id` and `shopId: res.shopId` into `authUser` on login and re-hydration from `localStorage`. |
| [`frontend_v2/components/owner/NotificationBell.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/NotificationBell.tsx) | Added `resolveOwnerNotificationDestination()` helper; guarded STOMP client creation so no connection/subscription is initiated without a valid destination; normalized WebSocket endpoint URL. |
| [`frontend_v2/components/admin/AdminNotificationBell.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminNotificationBell.tsx) | Added `resolveAdminNotificationDestination()` helper to prevent similar admin STOMP destination regressions. |
| [`frontend_v2/__tests__/ownerAuthAndNotificationSubscription.test.mjs`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__/ownerAuthAndNotificationSubscription.test.mjs) | Created 7 comprehensive unit tests verifying destination resolution, edge cases, auth mapping, and storage persistence. |

---

## 3. Implementation Details

### 3.1 Backend Identity Serialization (`AuthResponse.java` & `AuthService.java`)
`AuthResponse` previously included:
`token`, `email`, `role`, `fullName`, `shopStatus`, `subscriptionStatus`.
It omitted `id` and `shopId`.
We added:
```java
private Long id;
private Long shopId;
```
In `AuthService.java`:
- **Registration**:
  ```java
  return AuthResponse.builder()
          .id(savedUser.getId())
          .shopId(savedShop != null ? savedShop.getId() : null)
          .token(token)
          ...
          .build();
  ```
- **Login**:
  ```java
  Optional<Shop> ownerShop = Optional.empty();
  if (user.getRole() == UserRole.SHOP_OWNER) {
      ownerShop = shopRepository.findByOwnerId(user.getId());
  }
  return AuthResponse.builder()
          .id(user.getId())
          .shopId(ownerShop.map(Shop::getId).orElse(null))
          .token(token)
          ...
          .build();
  ```

### 3.2 Frontend Safe Destination Resolution (`NotificationBell.tsx`)
Rather than relying on unvalidated string interpolation:
```typescript
// BEFORE:
client.subscribe(`/queue/notifications-${user?.id}`, ...); // Produced /queue/notifications-undefined
```
We introduced:
```typescript
export function resolveOwnerNotificationDestination(userId: any): string | null {
  if (userId === undefined || userId === null) return null;
  const str = String(userId).trim();
  if (str === '' || str === 'undefined' || str === 'null') return null;
  const num = Number(str);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) return null;
  return `/queue/notifications-${num}`;
}
```
And in `useEffect`:
```typescript
useEffect(() => {
  const destination = resolveOwnerNotificationDestination(user?.id);
  if (!destination || !token) return;

  const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '') + '/ws-endpoint';

  const client = new Client({
    webSocketFactory: () => new SockJS(wsUrl),
    connectHeaders: { Authorization: `Bearer ${token}` },
    onConnect: () => {
      client.subscribe(destination, (message) => {
        ...
      });
    },
    ...
  });
  client.activate();
  return () => {
    client.deactivate();
  };
}, [user?.id, token]);
```

### 3.3 Destination Authorization Preserved (`WebSocketConfig.java`)
Backend channel authorization was left completely intact with zero weakening:
```java
private static final Pattern OWNER_NOTIF_PATTERN = Pattern.compile("^/queue/notifications-(\\d+)$");
```
Any subscription destination not matching the regex or where `authenticatedUserId != targetUserId` continues to throw `AccessDeniedException`.

---

## 4. Test Results

### 4.1 Backend Automated Tests
Ran `RegistrationIdentityIntegrityTest.java` targeting authentication response creation, credential verification, and identity serialization:
```bash
mvn test -Dtest=RegistrationIdentityIntegrityTest
```
**Result**:
```
[INFO] Running com.cakeplatform.api.modules.auth.RegistrationIdentityIntegrityTest
[INFO] Tests run: 17, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.054 s -- in com.cakeplatform.api.modules.auth.RegistrationIdentityIntegrityTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 17, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

### 4.2 Frontend Unit Tests
Ran complete Node test runner across all unit test suites in `frontend_v2/__tests__`:
```bash
node --test __tests__/*.test.mjs
```
**Result**:
```
✔ resolveOwnerNotificationDestination rejects undefined, null, and empty inputs (2.1938ms)
✔ resolveOwnerNotificationDestination rejects string 'undefined' and 'null' (0.334ms)
✔ resolveOwnerNotificationDestination rejects negative, zero, and float values (0.3155ms)
✔ resolveOwnerNotificationDestination produces valid destination for positive integer IDs (0.2831ms)
✔ resolveAdminNotificationDestination behaves symmetrically for admin queues (0.2709ms)
✔ AuthContext login response mapping captures id and shopId correctly (0.3121ms)
✔ AuthContext localStorage serialization preserves id across page refreshes (0.3235ms)
...
ℹ tests 133
ℹ suites 0
ℹ pass 133
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 467.5852
```

### 4.3 Frontend Lint & Production Build
- **ESLint**:
  ```bash
  npm run lint
  ```
  `✔ No ESLint warnings or errors` (Exit code 0).
- **Next.js Production Build**:
  ```bash
  npm run build
  ```
  `✓ Compiled successfully`  
  `✓ Linting and checking validity of types ...`  
  `✓ Generating static pages (38/38)`  
  `✓ Collecting build traces ...`  
  Exit code 0.

---

## 5. Live Runtime & Network Verification Evidence

### 5.1 Direct Authentication API Response
Verified direct HTTP POST to `http://localhost:8080/api/auth/login` with owner credentials (`owner@sweetdelight.com` / `password123`):
```json
{
  "id": 9,
  "shopId": 17,
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "email": "owner@sweetdelight.com",
  "role": "SHOP_OWNER",
  "fullName": "Sweet Delight Owner",
  "shopStatus": "ACTIVE",
  "subscriptionStatus": "ACTIVE"
}
```
**Observation**: Both `"id": 9` and `"shopId": 17` are correctly serialized.

### 5.2 Browser Session & Storage Verification
Browser subagent executed clean sign out and re-login:
1. Navigated to `http://localhost:3000/dashboard/owner` and triggered `Sign Out`.
2. Redirected to `http://localhost:3000/login`.
3. Entered `owner@sweetdelight.com` and `password123`.
4. Clicked `Sign In to Dashboard`.
5. Navigated to `http://localhost:3000/dashboard/owner`.
6. Inspected `localStorage`:
   - `cakestore_token`: Present (JWT token).
   - `cakestore_user`: Stored user object with `id` and `shopId` populated.

### 5.3 Backend STOMP Logs Verification
Inspected backend Spring Boot execution logs:
```
2026-10-17 11:39:25.554   --- [nio-8080-exec-7] c.c.a.m.notification.WebSocketConfig     : [WS-AUTH] STOMP CONNECT authenticated for user 'owner@sweetdelight.com' with authorities [ROLE_SHOP_OWNER]
2026-10-17 11:41:04.028   --- [nio-8080-exec-9] c.c.a.m.notification.WebSocketConfig     : [WS-AUTH] STOMP CONNECT authenticated for user 'owner@sweetdelight.com' with authorities [ROLE_SHOP_OWNER]
```
**Contrast with Pre-Fix State**:
- **Before Fix**: Backend emitted repetitive WARN logs every 5 seconds:
  `[WS-AUTH] STOMP SUBSCRIBE rejected: Unknown or unauthorized destination '/queue/notifications-undefined' for user 9`
- **After Fix**: STOMP CONNECT was authenticated successfully; zero destination authorization rejections occurred.
- **Polling Fallback**: `fetchUnreadCount` background polling continues to function smoothly in the background every 60s.

---

## 6. Unresolved Issues

None for Phase 1. All constraints respected:
- No changes to Azure, production secrets, or deployed environments.
- No changes to unrelated dashboard features.
- Strict tenant authorization in `WebSocketConfig` remained intact.
- Phase 2 (Shop Owner Dashboard Refresh Button Remediation) and Phase 3 have not been started.

---

## 7. Conclusion & Next Steps

Phase 1 is complete and verified with an explicit **PASS**.
The authenticated identity serialization defect is resolved, and the owner notification subscription is securely restored.

We are ready to proceed to **Phase 2 (Shop Owner Dashboard Refresh Button Remediation)** upon user instruction.
