# CakeStore Admin Notifications — Implementation-Ready Repair Plan

**Document:** `CAKESTORE_ADMIN_NOTIFICATIONS_REPAIR_PLAN.md`  
**Status:** Planning Only (Awaiting Approval)  
**Date:** 2026-10-16  
**Auditor/Planner:** Antigravity Agentic Pair Programmer  
**Scope:** NOTIF-01 through NOTIF-08 (Admin Notifications Module)

---

## 1. Executive Summary & Verification of Findings

A rigorous read-only source-level re-verification was conducted against the current codebase (`HEAD`) to ensure all findings from `CAKESTORE_ADMIN_NOTIFICATIONS_DEEP_AUDIT.md` remain valid and implementation-ready.

| Finding ID | Severity | Area | Source Confirmation | Finding Validity Status |
| :--- | :---: | :--- | :--- | :---: |
| **NOTIF-01** | **High** | Client Error Handling | Swallowed errors in `adminNotifications.ts` causing false success toasts and incorrect UI state updates. | **Confirmed Active** |
| **NOTIF-02** | **High** | API Status & Auth | `AdminNotificationController.markAsRead` returns 200 OK for missing IDs and unauthorized cross-admin attempts. | **Confirmed Active** |
| **NOTIF-03** | **Medium** | Schema & DTOs | Filter concepts (`ALL`, `UNREAD`) embedded in entity Enum `AdminNotificationCategory`; DTO omits `category`. | **Confirmed Active** |
| **NOTIF-04** | **Medium** | WebSocket Deployment | Hardcoded `http://localhost:8080/ws-endpoint` in `AdminNotificationBell.tsx`. | **Confirmed Active** |
| **NOTIF-05** | **Medium** | UI State Sync | `AdminNotificationBell` ignores `adminGlobalRefresh` and page-level read events. | **Confirmed Active** |
| **NOTIF-06** | **Medium** | Command Palette | Keyboard `Enter` handler in `AdminCommandPalette.tsx` omits `notification` items. | **Confirmed Active** |
| **NOTIF-07** | **Low** | Performance | `page.tsx` issues redundant heavy paginated query instead of calling `getUnreadCount()`. | **Confirmed Active** |
| **NOTIF-08** | **Low** | Auditability | Bulk and single mark-read actions bypass `ActivityLoggerService`. | **Confirmed Active** |

---

## 2. Detailed Finding-by-Finding Repair Specifications

### NOTIF-01 — False Success and Swallowed Errors in Frontend API Client
- **Confirmed Source Evidence:**
  - `frontend_v2/lib/api/adminNotifications.ts` (lines 56–77):
    `markAsRead` and `markAllAsRead` catch errors and silently resolve without rethrowing:
    ```typescript
    // Current defect:
    async markAsRead(id: string): Promise<void> {
      try {
        await apiClient.patch(`/api/admin/notifications/${id}/read`, {});
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Failed to mark notification read:', err);
      }
    }
    ```
  - `frontend_v2/app/admin/notifications/page.tsx` (lines 190–211):
    `handleMarkAllRead` calls `adminNotificationsApi.markAllAsRead()` and immediately triggers `toast.success('All notifications marked as read')`.
  - `frontend_v2/components/admin/AdminNotificationBell.tsx` (lines 170–187):
    `handleMarkAllRead` and `handleItemClick` optimistically clear counters and mark items read even if the network call failed.
- **Severity & Impact:**
  - **High:** Administrators are falsely told operations succeeded when the backend returned 500, 401, or 403. Upon page reload, unread counts reappear, causing administrative confusion and distrust in governance alerts.
- **Minimum Safe Correction:**
  1. In `adminNotifications.ts`:
     - Modify `markAsRead(id: string): Promise<void>` to directly await `apiClient.patch(...)` without swallowing exceptions.
     - Modify `markAllAsRead(): Promise<void>` to directly await `apiClient.post(...)` without swallowing exceptions.
  2. In `page.tsx`:
     - In `handleMarkRead`: Wrap in `try/catch`. Only update local notification state (`setNotifications`) and decrement `unreadCount` upon successful resolution. On failure, surface `toast.error('Failed to mark notification as read')`.
     - In `handleMarkAllRead`: Ensure the `catch` block receives real errors, surfaces `toast.error(err?.message || 'Failed to mark all as read')`, and avoids refreshing into an inconsistent state.
  3. In `AdminNotificationBell.tsx`:
     - In `handleMarkAllRead`: Wrap in `try/catch`. Only set `unreadCount(0)` on success.
     - In `handleItemClick`: Wrap `markAsRead` in `try/catch`. Only decrement `unreadCount` on success.

---

### NOTIF-02 — Missing 404 / 403 Status Codes on Mark-Read Operations
- **Confirmed Source Evidence:**
  - `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationService.java` (lines 151–167):
    ```java
    // Current defect:
    public void markAsRead(Long notificationId, Long adminId) {
        AdminNotification notification = notificationRepository.findById(notificationId).orElse(null);
        if (notification == null) {
            log.warn("Notification ID {} not found to mark read", notificationId);
            return; // Returns silently
        }
        if (notification.getRecipient() != null && !notification.getRecipient().getId().equals(adminId)) {
            log.warn("Admin ID {} unauthorized to mark notification ID {} read", adminId, notificationId);
            return; // Returns silently
        }
        ...
    }
    ```
  - `backend/src/main/java/com/cakeplatform/api/modules/notification/controller/AdminNotificationController.java` (lines 51–59):
    ```java
    @PatchMapping("/{id}/read")
    public ResponseEntity<Map<String, Object>> markAsRead(...) {
        adminNotificationService.markAsRead(id, userDetails.getId());
        return ResponseEntity.ok(Map.of("success", true)); // Returns 200 OK unconditionally!
    }
    ```
- **Verified Exception & Status Mappings:**
  Inspected [GlobalExceptionHandler.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/GlobalExceptionHandler.java):
  - `com.cakeplatform.api.exception.ResourceNotFoundException` is explicitly mapped to **`HttpStatus.NOT_FOUND` (404)** (lines 85–90).
  - `org.springframework.security.access.AccessDeniedException` is explicitly mapped to **`HttpStatus.FORBIDDEN` (403)** (lines 101–110).
  - Comparative Reference: In `NotificationService.java` (lines 94–98), the shop-owner notification service already throws `ResourceNotFoundException` and `AccessDeniedException` for this exact scenario.
- **Severity & Impact:**
  - **High:** Violates REST principles and security isolation. When Admin 1 attempts to mark Admin 2's notification read, or when any client sends an invalid ID, the API returns HTTP 200 OK `{"success": true}` despite nothing changing in the database.
- **Minimum Safe Correction:**
  1. In `AdminNotificationService.markAsRead`:
     - If `notification == null`, throw `new ResourceNotFoundException("Notification not found with ID: " + notificationId)`.
     - If `notification.getRecipient() != null && !notification.getRecipient().getId().equals(adminId)`, throw `new AccessDeniedException("Unauthorized to mark notification ID " + notificationId + " as read")`.
  2. In `PhaseGCommunicationTest.java`:
     - Update test `testAdminNotificationController_UnauthorizedMarkReadRejected` (G6.4) to assert `assertThrows(AccessDeniedException.class, () -> adminNotificationController.markAsRead(adminUserDetails, 1003L))`.
     - Add test `testAdminNotificationController_NotFoundThrows` asserting `assertThrows(ResourceNotFoundException.class, () -> adminNotificationController.markAsRead(adminUserDetails, 9999L))`.

---

### NOTIF-03 — Separate Category Values from UI Filter Concepts
- **Confirmed Source Evidence:**
  - `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationCategory.java`:
    Contains `ALL` and `UNREAD` alongside real categories `BAKERY`, `ORDERS`, `PAYMENTS`, `COMMUNICATION`, `SUBSCRIPTIONS`, `SYSTEM`, `SECURITY`.
  - `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationService.java` (lines 121–137):
    Maps `categoryStr` to `categoryEnum`. If a client passes `category=UNREAD`, the query searches `n.category = 'UNREAD'`, returning 0 records because no notification is ever saved with category `UNREAD`.
  - `frontend_v2/types/adminNotifications.ts`:
    The `AdminNotification` TypeScript interface omits the `category` property entirely.
- **Severity & Impact:**
  - **Medium:** Querying `GET /api/admin/notifications?category=UNREAD` produces 0 results instead of unread notifications. In the frontend, `page.tsx` was forced to re-derive category badges via an artificial client-side switch statement.
- **Minimum Safe Correction:**
  1. In `AdminNotificationService.getNotificationsForAdmin`:
     - If `categoryStr != null && "UNREAD".equalsIgnoreCase(categoryStr.trim())`:
       - Do not set `categoryEnum`. Set `isRead = false` (if not already explicitly specified) and set `categoryStr = null`.
     - If `categoryStr != null && "ALL".equalsIgnoreCase(categoryStr.trim())`:
       - Set `categoryStr = null` and `categoryEnum = null`.
  2. In `AdminNotificationCategory.java`:
     - Retain `ALL` and `UNREAD` in the enum for backward compatibility with existing deserializers, but add deprecation docstrings indicating they are UI filter pseudo-categories.
  3. In `frontend_v2/types/adminNotifications.ts`:
     - Add `category?: AdminNotificationCategory` to `interface AdminNotification`.
  4. In `frontend_v2/app/admin/notifications/page.tsx`:
     - Render `n.category || getCategoryFromType(n.type)` so server-persisted categories are displayed directly.

---

### NOTIF-04 — Environment-Aware WebSocket URL Resolution
- **Confirmed Source Evidence:**
  - `frontend_v2/components/admin/AdminNotificationBell.tsx` line 137:
    ```typescript
    // Current defect:
    webSocketFactory: () => new SockJS('http://localhost:8080/ws-endpoint')
    ```
- **Established Project Conventions:**
  - Inspected `frontend_v2/lib/api/client.ts`:
    `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';`
  - In browser contexts, WebSocket / SockJS endpoints must connect to the active backend origin (or relative path if reverse-proxied) to avoid Mixed Content errors when the site runs on HTTPS.
- **Severity & Impact:**
  - **Medium:** Live push notifications fail in any non-local deployment. Staging and production users never receive real-time alerts without manually refreshing or waiting for the 60s poll.
- **Minimum Safe Correction:**
  1. In `AdminNotificationBell.tsx`:
     - Define a safe URL resolver:
       ```typescript
       function getWebSocketEndpoint(): string {
         if (typeof window !== 'undefined') {
           const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
           if (baseUrl) {
             return `${baseUrl.replace(/\/$/, '')}/ws-endpoint`;
           }
           return '/ws-endpoint';
         }
         return 'http://localhost:8080/ws-endpoint';
       }
       ```
     - Pass `webSocketFactory: () => new SockJS(getWebSocketEndpoint())`.
     - Retain existing JWT authorization header in `connectHeaders: { Authorization: 'Bearer ' + token }`.

---

### NOTIF-05 — Global Refresh and Read-State Cross-Component Synchronization
- **Confirmed Source Evidence:**
  - `frontend_v2/app/admin/layout.tsx` lines 325–331 dispatches `adminGlobalRefresh` on the custom event bus.
  - `frontend_v2/app/admin/notifications/page.tsx` listens to `adminGlobalRefresh` and refetches notifications.
  - `frontend_v2/components/admin/AdminNotificationBell.tsx` does NOT listen to `adminGlobalRefresh` and does NOT listen to read mutations from `page.tsx`.
- **Severity & Impact:**
  - **Medium:** When an admin clicks the header refresh button or marks notifications read on `/admin/notifications`, the bell counter badge remains stale until the 60-second polling interval fires.
- **Minimum Safe Correction:**
  1. In `AdminNotificationBell.tsx`:
     - Add `adminGlobalRefresh` to the `useEffect` event listener hook.
     - Add a custom `adminNotificationsUpdated` event listener.
  2. In `notifications/page.tsx`:
     - Whenever `handleMarkRead` or `handleMarkAllRead` succeeds, dispatch `window.dispatchEvent(new CustomEvent('adminNotificationsUpdated'))`.
  3. Ensure listeners are cleaned up properly in `useEffect` return blocks to prevent memory leaks.

---

### NOTIF-06 — Command Palette Keyboard Enter Navigation for Notifications
- **Confirmed Source Evidence:**
  - `frontend_v2/components/admin/AdminCommandPalette.tsx` lines 139–148:
    ```typescript
    // Current defect:
    if (item._type === 'shortcut') handleSelect(item.href);
    if (item._type === 'shop') handleSelect(`/admin/shops/${item.id}`);
    if (item._type === 'feedback') handleSelect(`/admin/feedback?search=${encodeURIComponent(item.subject || query)}`);
    if (item._type === 'enquiry') handleSelect(`/admin/enquiries?search=${encodeURIComponent(item.subject || query)}`);
    // 'notification' is missing!
    ```
  - Mouse click on line 273 uses:
    `handleSelect('/admin/notifications?search=' + encodeURIComponent(notif.title))`
- **Severity & Impact:**
  - **Medium:** Keyboard users selecting a notification result and pressing `Enter` are unexpectedly redirected to the fallback `/admin/shops?search=...`.
- **Minimum Safe Correction:**
  1. In `AdminCommandPalette.tsx`:
     - Add:
       ```typescript
       if (item._type === 'notification') handleSelect(`/admin/notifications?search=${encodeURIComponent(item.title || query)}`);
       ```

---

### NOTIF-07 — Reuse Lightweight `/unread-count` Endpoint on Notification Center Page
- **Confirmed Source Evidence:**
  - `frontend_v2/app/admin/notifications/page.tsx` line 167:
    ```typescript
    // Current redundancy:
    const unreadData = await adminNotificationsApi.getNotifications({ isRead: false, page: 0, size: 1 });
    setUnreadCount(unreadData?.totalElements || 0);
    ```
  - The backend already provides `GET /api/admin/notifications/unread-count`, which runs `SELECT COUNT(n) FROM AdminNotification n WHERE (n.recipient.id = :adminId OR n.recipient IS NULL) AND n.isRead = false`.
  - The client method `adminNotificationsApi.getUnreadCount()` is already implemented in `adminNotifications.ts` (lines 44–51).
- **Severity & Impact:**
  - **Low:** Wasteful entity serialization and metadata generation on every page load/filter change.
- **Minimum Safe Correction:**
  1. In `page.tsx`:
     - Replace `adminNotificationsApi.getNotifications({ isRead: false, page: 0, size: 1 })` with `adminNotificationsApi.getUnreadCount()`.

---

### NOTIF-08 — Activity Audit Logging for Bulk Mark-Read Actions
- **Confirmed Source Evidence:**
  - Neither `AdminNotificationService.java` nor `AdminNotificationController.java` injects `ActivityLoggerService`.
  - In contrast, Platform Feedback and Contact Enquiries log all administrative actions.
- **Evaluation & Decision:**
  - Individual alert dismissal (`markAsRead(id)`) is a routine, high-frequency UI action. Logging every single dismissal would flood the `activity_logs` table with low-value entries.
  - However, bulk `markAllAsRead()` clears all unread administrative governance alerts for the tenant/admin.
- **Minimum Safe Correction:**
  1. In `AdminNotificationService.java`:
     - Inject `ActivityLoggerService activityLogger`.
     - In `markAllAsRead(Long adminId)`:
       ```java
       if (activityLogger != null && adminId != null) {
           activityLogger.logActivity(
                   adminId,
                   null,
                   "ADMIN_NOTIFICATIONS_BULK_READ",
                   "ADMIN_NOTIFICATION",
                   null,
                   "Admin marked all notifications as read"
           );
       }
       ```
     - Single `markAsRead` remains lightweight to avoid log spam, matching standard audit practices.

---

## 3. Dependency-Ordered Implementation Plan

```
Step 1: Backend Service & Controller (NOTIF-02, NOTIF-03, NOTIF-08)
   └── Add ResourceNotFoundException & AccessDeniedException to AdminNotificationService.markAsRead
   └── Add category=UNREAD filter normalization in AdminNotificationService.getNotificationsForAdmin
   └── Inject ActivityLoggerService into AdminNotificationService for markAllAsRead
   └── Run backend unit tests to verify 404/403 exceptions and category normalization

Step 2: Frontend Types & API Client (NOTIF-01, NOTIF-03)
   └── Add category to AdminNotification in types/adminNotifications.ts
   └── Remove error suppression from markAsRead and markAllAsRead in adminNotifications.ts

Step 3: Frontend Pages & Components (NOTIF-01, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07)
   └── Update notifications/page.tsx: handle rejections, use getUnreadCount(), dispatch sync event
   └── Update AdminNotificationBell.tsx: dynamic WebSocket URL, error handling, event sync
   └── Update AdminCommandPalette.tsx: add keyboard navigation for notifications

Step 4: Regression Tests & Build Verification
   └── Update PhaseGCommunicationTest.java (G6.4 and G6.6)
   └── Create frontend_v2/__tests__/adminNotificationsErrorHandling.test.mjs
   └── Run mvn test and node --test
   └── Execute frontend production build (npm run build)
```

---

## 4. Regression Test Blueprint

### Backend Tests (`PhaseGCommunicationTest.java`)
1. `testAdminNotificationController_MarkAsRead_Success()` — Verifies valid ID updates `isRead = true`, `readAt != null`.
2. `testAdminNotificationController_UnauthorizedMarkReadRejected()` (Updated G6.4) — Verifies calling `markAsRead` on another admin's notification throws `AccessDeniedException` (HTTP 403).
3. `testAdminNotificationController_NotFoundThrows()` (New G6.6) — Verifies calling `markAsRead` on non-existent ID throws `ResourceNotFoundException` (HTTP 404).
4. `testAdminNotificationController_CategoryUnreadNormalization()` (New G6.7) — Verifies passing `category=UNREAD` is normalized to `isRead=false` and returns unread notifications.
5. `testAdminNotificationController_MarkAllAsRead_AuditLogged()` (New G6.8) — Verifies `activityLogger.logActivity` is called with action `"ADMIN_NOTIFICATIONS_BULK_READ"`.

### Frontend Tests (`frontend_v2/__tests__/adminNotificationsErrorHandling.test.mjs`)
1. `markAsRead propagates HTTP 500/403/404 errors without swallowing them`.
2. `markAllAsRead propagates HTTP 500 server errors without fabricating success`.
3. `handleMarkAllRead displays toast error on failure and preserves unread state`.
4. `AdminCommandPalette handles Enter key navigation for notifications`.
5. `Dynamic WebSocket resolver correctly builds endpoint from environment`.

---

## 5. Outstanding Infrastructure Questions (Staging/Production Evidence Needed)

1. **WebSocket Ingress Proxy Upgrades:**
   - The frontend connects via SockJS to `/ws-endpoint`. Reverse proxies (AWS ALB, Cloudflare, Nginx, or Traefik) must have WebSocket upgrade headers (`Upgrade: $http_upgrade`, `Connection: "Upgrade"`) enabled. If the proxy strips these headers, SockJS falls back to HTTP xhr-streaming or xhr-polling.
2. **Multi-Instance Broker Relaying:**
   - `WebSocketConfig.java` currently uses Spring's in-memory `SimpleBroker` (`config.enableSimpleBroker("/queue")`).
   - If production runs multiple container instances of the backend API, an event dispatched on Instance A will not reach a WebSocket connection open on Instance B unless an external STOMP message broker relay (such as RabbitMQ or Redis STOMP) is configured.
   - For a single-instance backend deployment, the in-memory broker is completely sufficient.

---

## 6. Rollback Considerations

- All proposed changes are strictly additive or standard error-handling corrections.
- No database migrations are required (`admin_notifications` schema already supports all operations).
- In the event of an unforeseen issue, reverting the modified controller, service, and frontend component files restores the current baseline without database or deployment side effects.

---

**Plan Complete.** Awaiting explicit user approval before beginning any implementation work.
