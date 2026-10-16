# CakeStore Admin Notifications (`/admin/notifications`) — Deep Audit Report

**Status:** Completed (Read-Only Audit)  
**Date:** 2026-10-16  
**Auditor:** Antigravity Agentic Pair Programmer  
**Target Area:** Admin Notifications Module (`/admin/notifications`, Header Bell, WebSocket STOMP, API Client, Backend Controller, Service, Repository, Database Schema)

---

## 1. Audit Scope & Source Files Inspected

### Frontend Source Files
- `frontend_v2/app/admin/notifications/page.tsx` — Main notification center page, category tabs, unread filter, search, pagination, and mark-all-as-read actions.
- `frontend_v2/lib/api/adminNotifications.ts` — API client for notification endpoints.
- `frontend_v2/types/adminNotifications.ts` — TypeScript type definitions (`AdminNotification`, `AdminNotificationType`, `AdminNotificationPriority`, `AdminNotificationCategory`).
- `frontend_v2/components/admin/AdminNotificationBell.tsx` — Global header notification bell, STOMP SockJS listener, unread count polling, quick dropdown menu.
- `frontend_v2/components/admin/AdminCommandPalette.tsx` — Global command palette notification search and keyboard navigation.
- `frontend_v2/app/admin/layout.tsx` — Global header containing `AdminNotificationBell` and the `adminGlobalRefresh` event dispatcher.

### Backend Source Files
- `backend/src/main/java/com/cakeplatform/api/modules/notification/controller/AdminNotificationController.java` — REST endpoints (`/api/admin/notifications`).
- `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationService.java` — Business logic for multi-admin fanout, dual-layer idempotency, retrieval, and mark-read operations.
- `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationRepository.java` — Spring Data JPA repository and custom JPQL queries.
- `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotification.java` — JPA entity for `admin_notifications` table.
- `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationCategory.java` — Category enum.
- `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationType.java` — Notification event type enum.
- `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminNotificationPriority.java` — Priority enum.
- `backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java` — Spring WebSocket STOMP broker configuration (`/ws-endpoint`).

### Database Migrations
- `backend/src/main/resources/db/migration/V10__communication_and_admin_notifications.sql` — Schema definition for `admin_notifications` table, indexes, and idempotency constraints.

### Test Suites
- `backend/src/test/java/com/cakeplatform/api/modules/communication/PhaseGCommunicationTest.java` — Sections 4, 5, 6, 7, 8, 9, 11 covering fanout, idempotency, and controller endpoints.
- `backend/src/test/java/com/cakeplatform/api/modules/notification/NotificationServiceTest.java` — Shop owner/customer notifications (comparative reference).

---

## 2. Audit History & Current Repository State

1. **Audit History Check:**
   - Previous communication audits covered **Platform Feedback** (`/admin/feedback`, Phase 1 completed) and **Contact Enquiries** (`/admin/enquiries` and `/contact`, Phase 2 completed).
   - **Broadcast** (`/admin/messages`) was covered in the initial 3-tab audit (`CAKESTORE_ADMIN_COMMUNICATION_TABS_DEEP_AUDIT.md`).
   - Prior repo audits (`CAKESTORE_ADMIN_LOGIC_UX_AUDIT.md`, `CAKESTORE_ADMIN_DASHBOARD_RUNTIME_AUDIT.md`) listed `/admin/notifications` as an inventory route and verified basic 401/403 security filters, but **no dedicated deep audit** of Admin Notifications was ever conducted.
2. **Current Working Tree:**
   - Pre-existing modifications from Phase 1 and Phase 2 remain cleanly preserved.
   - Zero database migrations or source files were modified during this read-only audit.

---

## 3. End-to-End Architecture & Current Behavior

```
               +--------------------------------------------------------------+
               |                       EVENT SOURCES                          |
               | (AuthService, WebhookController, ShopStatusManager, etc.)    |
               +------------------------------+-------------------------------+
                                              |
                                              v
               +--------------------------------------------------------------+
               |               AdminNotificationService                       |
               | - Multi-Admin Fanout (userRepository.findByRole(ADMIN))     |
               | - Dual-Layer Idempotency (App query + DB unique index)       |
               +------------------------------+-------------------------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
   +------------------------------------+             +------------------------------------+
   |          PostgreSQL DB             |             |          SimpMessagingTemplate     |
   |   `admin_notifications` table      |             |   WebSocket `/queue/admin-...`     |
   +-----------------+------------------+             +----------------+-------------------+
                     |                                                 |
                     v                                                 v
   +------------------------------------+             +------------------------------------+
   |   AdminNotificationController      |             |   AdminNotificationBell.tsx        |
   |   - GET /api/admin/notifications   |             |   - STOMP subscription (SockJS)    |
   |   - GET /unread-count              |             |   - 60s fallback polling           |
   |   - PATCH /{id}/read               |             +------------------------------------+
   |   - POST /mark-all-read            |                              |
   +-----------------+------------------+                              v
                     |                                +------------------------------------+
                     v                                |   Header Badge Counter             |
   +------------------------------------+             +------------------------------------+
   |   AdminNotificationCenterPage      |
   |   (`admin/notifications/page.tsx`) |
   +------------------------------------+
```

### Event Generation & Multi-Admin Fanout
When platform events occur (new bakery registration, owner feedback, contact enquiry, failed payment, expired subscription), services call `adminNotificationService.dispatchAdminNotification(...)`.
- The service retrieves all active administrators via `userRepository.findByRole(UserRole.ADMIN)`.
- It creates an individual `AdminNotification` row per admin (`recipient_id = admin.getId()`).
- If no admin exists, it creates a single fallback broadcast record with `recipient_id = null`.
- Dual-layer idempotency prevents duplicate notifications:
  1. **Layer 1 (Application):** Checks `existsByTypeAndReferenceTypeAndReferenceIdAndRecipientId`.
  2. **Layer 2 (Database):** Unique index `uq_admin_notifications_idempotency` on `(type, reference_type, reference_id, recipient_id) WHERE ... NOT NULL`.

### Notification Ingestion & Read Tracking
- Admins retrieve their alerts via `GET /api/admin/notifications`, which queries rows where `recipient_id = currentAdminId OR recipient_id IS NULL`.
- Unread badge count is served via `GET /api/admin/notifications/unread-count`.
- Marking a notification read updates `is_read = true` and `read_at = CURRENT_TIMESTAMP`.
- Marking all read executes a bulk update on the admin's unread rows.

---

## 4. Findings Matrix

| Finding ID | Severity | Category | Title | Affected Files / Methods | Impact | Status |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **NOTIF-01** | **High** | UI / Error Handling | False success on `markAsRead` and `markAllAsRead` failure | `frontend_v2/lib/api/adminNotifications.ts`<br>`frontend_v2/app/admin/notifications/page.tsx`<br>`AdminNotificationBell.tsx` | Swallows HTTP 500/401/403; UI shows success toast and clears badges even when server update failed. | **Source Confirmed** |
| **NOTIF-02** | **High** | API / Authorization | Missing 404/403 status on unauthorized or missing notification mark-read | `AdminNotificationService.markAsRead`<br>`AdminNotificationController.markAsRead` | Returns HTTP 200 `{"success": true}` when notification does not exist or belongs to another admin. | **Source & Test Confirmed** |
| **NOTIF-03** | **Medium** | Schema / Domain Model | Filter concepts (`ALL`, `UNREAD`) embedded in entity Enum `AdminNotificationCategory` | `AdminNotificationCategory.java`<br>`AdminNotificationRepository.findWithFilters`<br>`types/adminNotifications.ts` | Querying `category=UNREAD` matches no database records; frontend type omits `category` field on `AdminNotification`. | **Source Confirmed** |
| **NOTIF-04** | **Medium** | Deployment / Network | Hardcoded `http://localhost:8080` WebSocket endpoint in `AdminNotificationBell` | `frontend_v2/components/admin/AdminNotificationBell.tsx:137` | Live WebSocket alerts fail in staging/production due to hardcoded localhost origin and Mixed Content blocking over HTTPS. | **Source Confirmed** |
| **NOTIF-05** | **Medium** | UX / State Sync | Header bell does not synchronize with `adminGlobalRefresh` or page read actions | `frontend_v2/app/admin/layout.tsx`<br>`frontend_v2/components/admin/AdminNotificationBell.tsx` | Unread badge in header remains stale after notifications are read or global refresh is clicked. | **Source Confirmed** |
| **NOTIF-06** | **Medium** | Accessibility / UX | Keyboard `Enter` on notifications in `AdminCommandPalette` does nothing | `frontend_v2/components/admin/AdminCommandPalette.tsx:139-148` | `handleKeyDown` handles shortcut, shop, feedback, enquiry, but omits `notification`, breaking keyboard navigation. | **Source Confirmed** |
| **NOTIF-07** | **Low** | Performance / API | Notification center page issues heavy paginated query instead of `unread-count` endpoint | `frontend_v2/app/admin/notifications/page.tsx:167` | Executes redundant `getNotifications({ isRead: false, page: 0, size: 1 })` on every render/filter change. | **Source Confirmed** |
| **NOTIF-08** | **Low** | Governance / Audit | Absence of activity audit logging on admin notification mark-read actions | `AdminNotificationService.java`<br>`AdminNotificationController.java` | Bulk and single notification read state changes are not recorded in `activity_logs`. | **Source Confirmed** |

---

## 5. Detailed Finding Analysis

### NOTIF-01: False Success on `markAsRead` and `markAllAsRead`
- **Location:** `frontend_v2/lib/api/adminNotifications.ts` (lines 56–77) & `frontend_v2/app/admin/notifications/page.tsx` (lines 190–211)
- **Root Cause:**
  ```typescript
  async markAsRead(id: string): Promise<void> {
    try {
      await apiClient.patch(`/api/admin/notifications/${id}/read`, {});
    } catch (err: any) {
      if (err?.status !== 404) console.warn('Failed to mark notification read:', err);
    }
  }
  ```
  The method catches all errors and resolves with `undefined`. In `page.tsx`:
  ```typescript
  const handleMarkAllRead = async () => {
    setIsMarkingAllRead(true);
    try {
      await adminNotificationsApi.markAllAsRead();
      toast.success('All notifications marked as read');
  ```
  The `catch` block in `page.tsx` is unreachable because `adminNotificationsApi.markAllAsRead()` never throws. The user is presented with `"All notifications marked as read"` even when the backend fails with HTTP 500.
- **Evidence:** Code inspection of `adminNotifications.ts` lines 56–77.

---

### NOTIF-02: Controller Returns HTTP 200 for Missing or Unauthorized Mark-Read Operations
- **Location:** `AdminNotificationService.java` (lines 151–167) and `AdminNotificationController.java` (lines 51–59)
- **Root Cause:**
  ```java
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
  In `AdminNotificationController`:
  ```java
  @PatchMapping("/{id}/read")
  public ResponseEntity<Map<String, Object>> markAsRead(...) {
      adminNotificationService.markAsRead(id, userDetails.getId());
      return ResponseEntity.ok(Map.of("success", true)); // Always 200 OK!
  }
  ```
- **Discrepancy with Customer/Shop Notifications:**
  In `NotificationService.java` (lines 94–98), the exact same operation throws `ResourceNotFoundException` on missing ID and `AccessDeniedException` on unauthorized caller. In contrast, `AdminNotificationService` silently returns, and the controller claims success.
- **Evidence:** Confirmed in `PhaseGCommunicationTest.testAdminNotificationController_UnauthorizedMarkReadRejected` (test G6.4), where Admin 1 attempts to mark Admin 2's notification read: the test passes specifically because the repository is never saved, but the controller returned HTTP 200.

---

### NOTIF-03: Filter Concepts Embedded in Entity Enum `AdminNotificationCategory`
- **Location:** `AdminNotificationCategory.java` (lines 3–13) & `AdminNotificationRepository.java` (lines 15–29)
- **Root Cause:**
  `AdminNotificationCategory` defines:
  ```java
  public enum AdminNotificationCategory {
      ALL, UNREAD, BAKERY, ORDERS, PAYMENTS, COMMUNICATION, SUBSCRIPTIONS, SYSTEM, SECURITY
  }
  ```
  `ALL` and `UNREAD` are UI filter concepts, not entity categories.
  When a caller queries `GET /api/admin/notifications?category=UNREAD`:
  In `AdminNotificationService`:
  `categoryEnum = AdminNotificationCategory.UNREAD;`
  In `AdminNotificationRepository`:
  `AND (:category IS NULL OR :category = 'ALL' OR n.category = :categoryEnum)`
  This queries `n.category = 'UNREAD'`. Since no notification is ever persisted with `category = UNREAD`, this query always returns 0 results.
- **Frontend Type Omission:**
  In `frontend_v2/types/adminNotifications.ts`, the `AdminNotification` interface does not declare `category?: AdminNotificationCategory`, forcing `page.tsx` to redundantly re-derive categories via a client-side switch statement `getCategoryFromType(n.type)`.

---

### NOTIF-04: Hardcoded `http://localhost:8080` WebSocket URL
- **Location:** `frontend_v2/components/admin/AdminNotificationBell.tsx` (line 137)
- **Root Cause:**
  ```typescript
  const client = new Client({
    webSocketFactory: () => new SockJS('http://localhost:8080/ws-endpoint'),
    ...
  });
  ```
- **Impact:**
  - In staging or production, client browsers execute JavaScript pointing to `http://localhost:8080`.
  - On HTTPS deployments, browsers immediately block this with a Mixed Content security error.
  - Live notification pushes over WebSockets are completely non-functional outside local development.

---

### NOTIF-05: Missing Global Refresh Synchronization Between Bell & Page
- **Location:** `frontend_v2/app/admin/layout.tsx` (lines 325–334) & `AdminNotificationBell.tsx`
- **Root Cause:**
  `admin/layout.tsx` dispatches `adminGlobalRefresh` when the admin clicks the refresh button.
  `notifications/page.tsx` registers an event listener for `adminGlobalRefresh`.
  `AdminNotificationBell.tsx` does NOT listen to `adminGlobalRefresh`.
  Furthermore, `AdminNotificationBell` relies on a 60-second polling interval and STOMP messages. When an admin marks all notifications read on `/admin/notifications`, the bell counter does not update until the next 60s poll.

---

### NOTIF-06: Command Palette Keyboard Enter Navigation Misses Notifications
- **Location:** `frontend_v2/components/admin/AdminCommandPalette.tsx` (lines 139–148)
- **Root Cause:**
  ```typescript
  if (item._type === 'shortcut') handleSelect(item.href);
  if (item._type === 'shop') handleSelect(`/admin/shops/${item.id}`);
  if (item._type === 'feedback') handleSelect(`/admin/feedback?search=${encodeURIComponent(item.subject || query)}`);
  if (item._type === 'enquiry') handleSelect(`/admin/enquiries?search=${encodeURIComponent(item.subject || query)}`);
  // item._type === 'notification' is completely missing!
  ```
  Pressing Enter on a notification item in the palette falls through to the generic fallback `handleSelect('/admin/shops?search=' + query)`.

---

### NOTIF-07: Redundant Unread Count Queries on Notification Center Page
- **Location:** `frontend_v2/app/admin/notifications/page.tsx` (line 167)
- **Root Cause:**
  The backend provides a dedicated, lightweight `GET /api/admin/notifications/unread-count` endpoint that runs `SELECT COUNT(n) FROM AdminNotification n WHERE ...`.
  Instead of using `adminNotificationsApi.getUnreadCount()`, `page.tsx` calls:
  `adminNotificationsApi.getNotifications({ isRead: false, page: 0, size: 1 })`
  to read `totalElements`, which performs a heavier query with pagination metadata.

---

### NOTIF-08: Absence of Activity Audit Logging on Admin Mark-Read Actions
- **Location:** `AdminNotificationService.java`
- **Root Cause:**
  `ActivityLoggerService` is not injected.
  While individual alert dismissal is lightweight, bulk `markAllAsRead()` is a state-mutating action affecting all active governance alerts and lacks audit trail tracking.

---

## 6. Existing Test Coverage & Testing Gaps

### Existing Backend Tests (`PhaseGCommunicationTest.java`)
- `testDispatchAdminNotification_MultiAdminFanout` (G4.1) — Verifies fanout creates 1 record per active admin.
- `testDispatchAdminNotification_NoAdminsFallback` (G4.2) — Verifies fallback to `recipient = null`.
- `testNotificationIdempotency_ApplicationLevelSkip` (G5.1) — Verifies application-level check prevents duplicate save.
- `testNotificationIdempotency_DatabaseConstraintViolationHandled` (G5.2) — Verifies `DataIntegrityViolationException` is caught gracefully.
- `testAdminNotificationController_GetNotifications` (G6.1) — Verifies retrieval with category/read filters.
- `testAdminNotificationController_GetUnreadCount` (G6.2) — Verifies unread count query.
- `testAdminNotificationController_MarkAsRead` (G6.3) — Verifies marking single notification read.
- `testAdminNotificationController_UnauthorizedMarkReadRejected` (G6.4) — Verifies unauthorized save is skipped.
- `testAdminNotificationController_MarkAllAsRead` (G6.5) — Verifies bulk mark read.

### Testing Gaps
1. **Frontend:** Zero automated frontend tests exist for `adminNotificationsApi`, `AdminNotificationBell`, or `/admin/notifications/page.tsx`.
2. **Error Propagation:** No tests verify that frontend API client methods reject upon HTTP 500/401/403.
3. **HTTP Status Codes:** No backend test verifies that `markAsRead` returns 404 for non-existent IDs or 403 for unauthorized cross-admin actions.
4. **WebSocket URL Configuration:** No test verifies environment-aware WebSocket base URL resolution.

---

## 7. Recommended Repair Priorities (Non-Implementation)

| Priority | Finding | Recommended Minimal Safe Correction |
| :---: | :--- | :--- |
| **P1** | **NOTIF-01** | Remove error suppression from `adminNotificationsApi.markAsRead` and `markAllAsRead`. In `page.tsx` and `AdminNotificationBell`, handle rejections properly and do not show false success toasts. |
| **P1** | **NOTIF-02** | In `AdminNotificationService.markAsRead`, throw `ResourceNotFoundException` when notification is not found, and `AccessDeniedException` when unauthorized. Controller will return HTTP 404 / 403. |
| **P2** | **NOTIF-04** | Replace hardcoded `'http://localhost:8080/ws-endpoint'` in `AdminNotificationBell.tsx` with dynamic resolution using `process.env.NEXT_PUBLIC_API_URL` or relative URL. |
| **P2** | **NOTIF-05** | Add `adminGlobalRefresh` event listener to `AdminNotificationBell.tsx` and dispatch a lightweight sync event when notifications are read in `page.tsx`. |
| **P2** | **NOTIF-06** | Add `if (item._type === 'notification') handleSelect('/admin/notifications?search=' + encodeURIComponent(item.title))` to `AdminCommandPalette.tsx`. |
| **P3** | **NOTIF-03** | Deprecate `ALL` and `UNREAD` from `categoryEnum` handling or handle them as query flags in `findWithFilters`. Add `category?: AdminNotificationCategory` to `types/adminNotifications.ts`. |
| **P3** | **NOTIF-07** | Replace `adminNotificationsApi.getNotifications({ isRead: false, page: 0, size: 1 })` in `page.tsx` with `adminNotificationsApi.getUnreadCount()`. |
| **P4** | **NOTIF-08** | Optionally inject `ActivityLoggerService` into `AdminNotificationService` and log `ADMIN_NOTIFICATIONS_BULK_READ` when `markAllAsRead` is executed. |

---

## 8. Security & Data Integrity Considerations

1. **Cross-Admin Notification Isolation:**
   - Multi-admin fanout ensures private notifications (`recipient_id = X`) cannot be read by another admin in list queries.
   - However, because `markAsRead` currently returns HTTP 200 instead of 403 on unauthorized attempts, client applications cannot detect that their mutation was ignored.
2. **Dual-Layer Idempotency:**
   - Well-architected with unique database indexes in migration V10 preventing event storms or race-condition duplicate alerts.
3. **WebSocket Authentication:**
   - `WebSocketConfig.java` implements a STOMP channel interceptor validating JWT tokens on connection. However, the client SockJS factory must use dynamic URLs to prevent Mixed Content security failures in production.

---

## 9. Verdict & Questions Requiring Evidence Unavailable from Repository

### Verdict
The Admin Notifications system possesses a solid architectural foundation (multi-admin fanout, dual-layer idempotency, and STOMP broker integration). However, it suffers from the same **false-success error suppression patterns** discovered in Platform Feedback and Contact Enquiries, alongside an **unauthorized 200 OK masking defect**, a **hardcoded localhost WebSocket URL**, and **UI event desynchronization**.

### Questions Requiring Infrastructure / Deployment Evidence
1. **WebSocket Ingress Routing:** Is the production reverse proxy (e.g. ALB, Cloudflare, Nginx) configured to support WebSocket upgrades (`Upgrade: websocket`, `Connection: Upgrade`) on `/ws-endpoint`?
2. **STOMP Broker Topology:** Currently using Spring's in-memory `SimpleBroker` (`/queue`). If multiple backend API instances are deployed behind a load balancer, messages sent to `/queue/admin-notifications-{id}` on Instance A will not reach a WebSocket connection open on Instance B. Does production use a single instance or an external RabbitMQ/ActiveMQ STOMP broker relay?

---

**Audit Complete. No code or migrations have been modified. Awaiting user review and authorization.**
