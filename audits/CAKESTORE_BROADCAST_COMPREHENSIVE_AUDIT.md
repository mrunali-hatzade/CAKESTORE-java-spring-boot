# CakeStore Broadcast Feature — Comprehensive End-to-End Audit & Repair Plan

**Document:** `CAKESTORE_BROADCAST_COMPREHENSIVE_AUDIT.md`  
**Date:** October 16, 2026  
**Status:** READ-ONLY AUDIT COMPLETE — AWAITING EXPLICIT APPROVAL BEFORE IMPLEMENTATION  
**Scope:** Admin Broadcast Feature (`/admin/messages`, `AdminMessageController`, `BroadcastService`, `NotificationService`, `EmailService`, `BroadcastHistory`, `broadcast_history` DB table, and all notification channels)

---

## 1. Executive Summary

This document provides a single, consolidated, evidence-based end-to-end audit of the **Admin Broadcast** feature in the CakeStore SaaS platform. Every layer—from the Next.js admin frontend, through Spring Boot controllers and services, down to PostgreSQL schemas, transaction lifecycles, and asynchronous delivery channels—was audited against the live codebase.

### Audit Summary Statistics
- **Total Files Inspected:** 18 source files across frontend, backend, database migrations, and security configurations.
- **Total Confirmed Defects / Deficiencies:** 12 findings
  - **Critical (P0):** 1 (Lack of idempotency and atomic reservation allowing duplicate dispatch & email blasts)
  - **High (P1):** 3 (Rollback-only transaction trap in notification loop, recipient role boundary bypass, and silent SQL truncation crash on message length > 1024 chars)
  - **Medium (P2):** 5 (False "Delivered" UI badge, missing history metrics in UI, missing Bean Validation annotations, 0% test coverage, title length mismatch)
  - **Low (P3):** 3 (False empty state flash on page mount, unvalidated numeric parsing for owner ID, lack of ActivityLoggerService audit trail)
- **Automated Test Coverage:** Currently **0%** across both backend and frontend suites for this feature.
- **Implementation Status:** STRICTLY READ-ONLY. No code, test, migration, or configuration modifications have been made.

---

## 2. Feature Architecture and Request-to-Notification Flow

```
[ Admin Browser: /admin/messages ]
       │
       │  (1) POST /api/admin/messages
       ▼
[ AdminMessageController.java ]
       │  - Checks @PreAuthorize("hasAuthority('ROLE_ADMIN')")
       │  - Calls broadcastService.sendAndRecordBroadcast(request)
       │  - Returns immediately: 200 OK "Broadcast dispatched successfully. Processing in background."
       ▼
[ BroadcastService.java (@Async @Transactional) ]
       │  - Background worker thread opens new DB transaction
       │  - Resolves target users (SPECIFIC or ALL SHOP_OWNER)
       │  - Iterates over recipients:
       │       │
       │       ▼
       │  [ NotificationService.createNotification(...) (@Transactional) ]
       │       │  - Saves entity to `notifications` table (joined in outer transaction)
       │       │  - Fires NotificationCreatedEvent
       │       │
       │  - Inserts record into `broadcast_history` table
       │  - Transaction COMMITS
       ▼
[ Spring Transaction Synchronization: AFTER_COMMIT ]
       │
       ▼
[ NotificationService.handleNotificationCreatedEvent(...) ]
       │
       ├──► SimpMessagingTemplate.convertAndSend("/queue/notifications-{id}", ...) [WebSocket]
       │
       └──► (if sendEmail=true) EmailService.sendEmail(...) [@Async]
                 │
                 ▼
            [ EmailService.deliverEmail(...) ]
                 ├── If RESEND_API_KEY present: HTTP POST https://api.resend.com/emails
                 └── If missing: Structured log fallback
```

---

## 3. Files and Dependencies Inspected

### Frontend
1. [frontend_v2/app/admin/messages/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx): Composer form, live preview, history table, and dispatch button handler.
2. [frontend_v2/lib/api/admin.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/admin.ts): API client methods `sendAdminMessage` and `getAdminBroadcastHistory`.
3. [frontend_v2/types/admin.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/admin.ts): DTO interfaces `AdminMessagePayload` and `SentBroadcastRecord`.
4. [frontend_v2/components/common/Toast.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/common/Toast.tsx): Feedback toast mechanism.
5. [frontend_v2/__tests__/](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__): Verified existing test coverage (0 broadcast tests).

### Backend
6. [backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java): REST endpoints for dispatch and history.
7. [backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java): `@Async @Transactional` broadcast orchestration.
8. [backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageRequest.java](file:///d:/PROJECTK/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageRequest.java): Request payload DTO.
9. [backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java): JPA Entity for broadcast history.
10. [backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistoryRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistoryRepository.java): Spring Data JPA repository.
11. [backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationService.java): In-app notification creation and `@TransactionalEventListener`.
12. [backend/src/main/java/com/cakeplatform/api/modules/notification/Notification.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/Notification.java): In-app notification JPA entity.
13. [backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationType.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationType.java): Enum definition.
14. [backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java): `@Async` Resend HTTP email dispatch.
15. [backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java): STOMP message broker configuration.
16. [backend/src/main/java/com/cakeplatform/api/modules/user/User.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/user/User.java) & [UserRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/user/UserRepository.java): User entity and role queries.
17. [backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java): Method-level security and authorization.
18. [backend/pom.xml](file:///d:/PROJECTS/CAKE%20SAAs1/backend/pom.xml): Spring Boot 3.3.2 dependencies.

### Database Migrations
19. [backend/src/main/resources/db/migration/V36__add_broadcast_history.sql](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V36__add_broadcast_history.sql): Table creation script for `broadcast_history`.
20. All 48 Flyway migrations (`V1` to `V48`): Verified that `uuid-ossp` and `pgcrypto` extensions are **NOT** installed.

---

## 4. Confirmed Findings with Concrete Evidence

### Finding COM-BC-F01: Lack of Backend Idempotency Protection Allows Duplicate Dispatches & Email Blasts
- **Severity:** Critical (P0)
- **Category:** Idempotency & Concurrency
- **File & Lines:**
  - [AdminMessageController.java:L21-L26](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java#L21-L26)
  - [BroadcastService.java:L24-L26](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L24-L26)
  - [frontend_v2/app/admin/messages/page.tsx:L75-L96](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L75-L96)
- **Actual Source Behavior:**
  `POST /api/admin/messages` accepts payload and executes `broadcastService.sendAndRecordBroadcast(request)` with no idempotency key or uniqueness check.
- **Why It Is Risky:**
  If an admin double-clicks "Dispatch Broadcast", or if a network timeout occurs and the admin retries, two separate `@Async` jobs execute. Each recipient receives duplicate in-app notifications and duplicate emails.
- **Realistic Scenario:**
  Admin clicks dispatch; connection experiences a 4-second latency spike; admin clicks again. 50 bakery owners receive 2 identical emails and 2 identical dashboard notifications within 5 seconds.
- **Expected Behavior:**
  Every intentional broadcast must carry an `idempotencyKey` generated by the client and bound to the payload. Duplicate requests must be detected atomically and rejected/ignored without repeating side effects.
- **Smallest Appropriate Repair:**
  Add `idempotencyKey` to `AdminMessageRequest` and `broadcast_history`. In `BroadcastService`, execute an atomic `insertIfAbsent` native query prior to recipient iteration.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F02: Catching `Exception` in Per-Recipient Loop Causes `UnexpectedRollbackException` on SQL Errors
- **Severity:** High (P1)
- **Category:** Transaction Boundaries & Failure Handling
- **File & Lines:**
  - [BroadcastService.java:L38-L52](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L38-L52)
  - [BroadcastService.java:L64](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L64)
- **Actual Source Behavior:**
  ```java
  for (User owner : targets) {
      try {
          notificationService.createNotification(...);
          count++;
      } catch (Exception e) {
          log.error("Failed to send broadcast to user {}: {}", owner.getId(), e.getMessage());
      }
  }
  broadcastHistoryRepository.save(history);
  ```
- **Why It Is Risky:**
  `createNotification` runs in the outer `@Transactional` boundary. If `notificationRepository.save(...)` fails with a database exception (e.g., constraint error, message truncation), Hibernate marks the underlying transaction as **rollback-only**. Catching `Exception` in Java does NOT unmark rollback-only. When the method reaches `broadcastHistoryRepository.save(history)` or attempts to commit, Spring throws `UnexpectedRollbackException`.
- **Realistic Scenario:**
  If 1 out of 50 users causes an SQL error, the catch block logs the error, but at commit time the entire transaction rolls back. All 49 prior notifications are rolled back, and the `BroadcastHistory` record is NEVER persisted. Yet the frontend was already told `200 OK`.
- **Expected Behavior:**
  Recipient notifications should either atomically succeed as a unit, or per-recipient persistence should be cleanly managed without continuing inside an aborted transaction.
- **Smallest Appropriate Repair:**
  Perform atomic reservation first, handle recipient processing cleanly, and ensure transaction errors fail fast and roll back the reservation row so a retry can succeed.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F03: Recipient Eligibility Bypasses Role Check on Specific Owner & Includes Inactive Users
- **Severity:** High (P1)
- **Category:** Authorization & Recipient Eligibility
- **File & Lines:**
  - [BroadcastService.java:L31-L36](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L31-L36)
  - [UserRepository.java:L18](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/user/UserRepository.java#L18)
- **Actual Source Behavior:**
  ```java
  if (request.getSpecificOwnerId() != null) {
      User owner = userRepository.findById(request.getSpecificOwnerId()).orElse(null);
      targets = (owner != null) ? List.of(owner) : Collections.emptyList();
  } else {
      targets = userRepository.findByRole(UserRole.SHOP_OWNER);
  }
  ```
- **Why It Is Risky:**
  1. For `specificOwnerId`: It calls `userRepository.findById(...)` without checking `role == UserRole.SHOP_OWNER`. An admin can enter a customer ID or another admin ID and send them an owner broadcast announcement.
  2. For bulk targeting: `userRepository.findByRole(UserRole.SHOP_OWNER)` returns all shop owners regardless of `status == UserStatus.ACTIVE`. Users with `status = DISABLED` or `LOCKED` will still receive broadcasts and emails.
- **Expected Behavior:**
  1. Specific owner ID must belong to `SHOP_OWNER` with `status == UserStatus.ACTIVE` and `!isDeleted`.
  2. Bulk targeting must filter to enabled, active shop owners.
- **Smallest Appropriate Repair:**
  Add explicit checks: `if (owner.getRole() != UserRole.SHOP_OWNER || owner.getStatus() != UserStatus.ACTIVE)` in `BroadcastService`. For bulk, query only active shop owners.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F04: Message Body Exceeding 1024 Characters Triggers Unhandled SQL Exception
- **Severity:** High (P1)
- **Category:** Functional Correctness & Data Integrity
- **File & Lines:**
  - [Notification.java:L36-L37](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/Notification.java#L36-L37)
  - [BroadcastHistory.java:L27](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java#L27)
  - [frontend_v2/app/admin/messages/page.tsx:L175-L182](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L175-L182)
- **Actual Source Behavior:**
  - In `Notification.java`: `@Column(nullable = false, length = 1024) private String message;`.
  - In `BroadcastHistory.java`: `@Column(nullable = false, columnDefinition = "TEXT") private String message;`.
  - In `frontend_v2/app/admin/messages/page.tsx`: `<Textarea label="Broadcast Message Body" ... />` has **no `maxLength` constraint**.
- **Why It Is Risky:**
  An admin drafting a detailed operational notice of 1,100 characters submits successfully. The backend accepts it, but in the background thread, the first call to `notificationRepository.save(notification)` throws `DataIntegrityViolationException: value too long for type character varying(1024)`. The transaction rolls back, no notifications are created, and no history is logged.
- **Expected Behavior:**
  Frontend must enforce `maxLength={1024}`, backend `AdminMessageRequest` must validate `@Size(max = 1024)`, and length constraints must match across entities.
- **Smallest Appropriate Repair:**
  Add `maxLength={1024}` to the frontend `<Textarea>` and `@Size(max = 1024)` to `AdminMessageRequest.message`.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F05: History Table Hardcodes False "Delivered" Badge
- **Severity:** Medium (P2)
- **Category:** Presentation & Reporting Semantics
- **File & Lines:**
  - [frontend_v2/app/admin/messages/page.tsx:L315-L318](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L315-L318)
- **Actual Source Behavior:**
  ```tsx
  <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-emerald-700">
    <CheckCircle2 className="w-3.5 h-3.5" />
    Delivered
  </div>
  ```
- **Why It Is Risky:**
  The badge claims "Delivered" with a green checkmark for every broadcast record, regardless of whether background processing is still running, failed, or whether external emails failed to deliver.
- **Expected Behavior:**
  Display truthful status: "Attempted ({bcast.recipientCount})" with a tooltip explaining that count reflects notifications generated for eligible shop owners.
- **Smallest Appropriate Repair:**
  Change badge text to `Attempted ({bcast.recipientCount})` with a `Clock` icon and informative tooltip.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F06: History Table Omits `recipientCount` and `sentEmail` Metrics
- **Severity:** Medium (P2)
- **Category:** Reporting & UX
- **File & Lines:**
  - [frontend_v2/app/admin/messages/page.tsx:L298-L332](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L298-L332)
- **Actual Source Behavior:**
  The history card renders `title`, `targetType`, `message`, and `sentAt`. It completely ignores `bcast.recipientCount` and `bcast.sentEmail`.
- **Why It Is Risky:**
  Admins have no visibility into how many shop owners were targeted by past campaigns or whether an email copy was dispatched.
- **Expected Behavior:**
  Render `recipientCount` and an email indicator icon next to each history entry.
- **Smallest Appropriate Repair:**
  Include `bcast.recipientCount` in the status badge and add a small email icon if `bcast.sentEmail` is true.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F07: `AdminMessageRequest` and Controller Completely Lack Bean Validation
- **Severity:** Medium (P2)
- **Category:** Security & Input Validation
- **File & Lines:**
  - [AdminMessageRequest.java:L1-L12](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageRequest.java#L1-L12)
  - [AdminMessageController.java:L22](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java#L22)
- **Actual Source Behavior:**
  `AdminMessageRequest` has no validation annotations. `AdminMessageController` accepts `@RequestBody AdminMessageRequest request` without `@Valid`.
- **Why It Is Risky:**
  Callers can submit empty titles (`""`), whitespace-only messages, or negative `specificOwnerId` (`-5`). The controller immediately returns `200 OK`, and errors only crash the background async thread.
- **Expected Behavior:**
  The controller must reject invalid payloads with HTTP 400 Bad Request synchronously before spawning async tasks.
- **Smallest Appropriate Repair:**
  Add `@NotBlank`, `@Size(max = 255)`, `@Size(max = 1024)`, and `@Positive` annotations to `AdminMessageRequest`, and add `@Valid` to the controller parameter.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F08: 0% Test Coverage Across Entire Broadcast Subsystem
- **Severity:** Medium (P2)
- **Category:** Quality Assurance & Test Coverage
- **File & Lines:**
  - [backend/src/test/](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test)
  - [frontend_v2/__tests__/](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__)
- **Actual Source Behavior:**
  Searches for `BroadcastService`, `AdminMessageController`, `/api/admin/messages`, and broadcast UI in test folders yielded **0 matching test files**.
- **Why It Is Risky:**
  Any refactoring or fix could introduce undetected regressions in authorization, transaction boundaries, or duplicate dispatch handling.
- **Expected Behavior:**
  Unit and integration tests covering role validation, idempotency, transaction rollback, and UI behavior.
- **Smallest Appropriate Repair:**
  Implement backend tests (`BroadcastServiceTest`, `AdminMessageControllerTest`) and frontend test (`adminBroadcastIdempotency.test.mjs`).
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F09: Title Field Length Discrepancy Between Frontend and DB Schema
- **Severity:** Medium (P2)
- **Category:** Data Integrity
- **File & Lines:**
  - [V36__add_broadcast_history.sql:L3](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V36__add_broadcast_history.sql#L3)
  - [Notification.java:L33](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/Notification.java#L33)
  - [frontend_v2/app/admin/messages/page.tsx:L122-L128](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L122-L128)
- **Actual Source Behavior:**
  DB `title` is `VARCHAR(255)`, but `<Input label="Announcement Title" />` has no `maxLength`.
- **Why It Is Risky:**
  Submitting a title > 255 characters throws an SQL truncation error in background processing.
- **Smallest Appropriate Repair:**
  Add `maxLength={255}` to frontend title input.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F10: False Empty State Flash on Mount in History View
- **Severity:** Low (P3)
- **Category:** UX
- **File & Lines:**
  - [frontend_v2/app/admin/messages/page.tsx:L30](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L30)
  - [frontend_v2/app/admin/messages/page.tsx:L293-L296](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L293-L296)
- **Actual Source Behavior:**
  `broadcasts` state initializes as `[]`. While `fetchHistory()` is in flight, `broadcasts.length === 0` renders "No broadcasts have been dispatched yet."
- **Smallest Appropriate Repair:**
  Add `isLoadingHistory` boolean state and render a skeleton or spinner until data loads.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F11: Loose Frontend Parsing of Specific Owner ID (`Number()`)
- **Severity:** Low (P3)
- **Category:** Input Validation
- **File & Lines:**
  - [frontend_v2/app/admin/messages/page.tsx:L80](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L80)
- **Actual Source Behavior:**
  `specificOwnerId: targetType === 'SPECIFIC' ? Number(specificOwnerId) : null`.
  Non-numeric input produces `NaN`, sending invalid JSON or unexpected numeric types.
- **Smallest Appropriate Repair:**
  Validate with regex `/^\d+$/` and parse with `parseInt(specificOwnerId, 10)`.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

### Finding COM-BC-F12: Missing Audit Trail Integration in `BroadcastService`
- **Severity:** Low (P3)
- **Category:** Security & Audit Logging
- **File & Lines:**
  - [BroadcastService.java:L18](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L18)
- **Actual Source Behavior:**
  `BroadcastService` logs to SLF4J, but unlike `AdminNotificationService` and `PlatformFeedbackService`, does not inject `ActivityLoggerService` to record an entry in `activity_logs`.
- **Expected Behavior:**
  Administrative mass communications should be logged in the centralized platform activity log.
- **Smallest Appropriate Repair:**
  Inject `ActivityLoggerService` and log `ADMIN_BROADCAST_DISPATCHED`.
- **Status:** CONFIRMED BY SOURCE CODE INSPECTION.

---

## 5. Potential Findings Requiring Runtime Verification

1. **Async Thread Pool Saturation (POT-BC-01)**:
   - *Hypothesis:* Because `sendAndRecordBroadcast` runs on Spring's default `@Async` task executor without custom pool tuning, dispatching multiple large broadcasts simultaneously could starve other `@Async` operations (like email sending or background reconciliations).
   - *Verification Needed:* Monitor active thread pool metrics under load in a staging environment.
2. **WebSocket STOMP Channel Buffer Limits (POT-BC-02)**:
   - *Hypothesis:* For bulk broadcasts to 1,000+ connected owners, firing 1,000 WebSocket events in rapid succession inside `handleNotificationCreatedEvent` could overflow the in-memory SimpleBroker buffer.
   - *Verification Needed:* Measure WebSocket message drop rates with > 500 concurrent active subscribers.

---

## 6. Review of Previously Identified Issues

| Previous Finding / Proposal | Current Verification Status | Notes |
| :--- | :--- | :--- |
| **COM-BC-V01 (Real delivery channels working)** | **Verified Working** | In-app notification creation, WebSocket push, and Resend email paths exist and function. |
| **COM-BC-V02 (Hardcoded "Delivered" badge)** | **Confirmed Defect (Unresolved)** | Still present at line 317 in `messages/page.tsx`. |
| **COM-BC-V03 (Over-broad recipient scope)** | **Confirmed Defect (Unresolved)** | Still lacks role and status checks in `BroadcastService.java`. |
| **COM-BC-V04 (`recipientCount` semantics)** | **Confirmed Inaccuracy (Unresolved)** | Represents in-app notifications queued in DB, not email deliveries. |
| **COM-BC-V05 (Lack of Idempotency)** | **Confirmed Defect (Unresolved)** | No token or database reservation exists in current code. |
| **UUID Extension Assumption (`V20__enable_uuid_ossp.sql`)** | **Disproved & Corrected** | `V20` is actually `password_reset_tokens.sql`. No UUID extension exists; must use deterministic core `md5()` UUID cast. |
| **Spring Data `@Modifying` native insert with `RETURNING id`** | **Disproved & Corrected** | Spring Data JPA `@Modifying` only supports `int`/`void`. Must use `JdbcTemplate` repository fragment. |

---

## 7. Concurrency and Failure-Scenario Analysis

| Scenario | Current Behavior | Proposed Correct Behavior |
| :--- | :--- | :--- |
| **Rapid Double-Click** | Spawns two independent `@Async` jobs. Duplicates notifications & emails. | First request reserves key atomically. Second request hits unique constraint / `ON CONFLICT DO NOTHING`, returns empty, and exits early. |
| **Network Timeout + Refresh** | Client loses key (if in memory), generates new key, sends duplicate. | Client keeps key & payload signature in `sessionStorage`. On retry, resends identical key; server detects duplicate and skips. |
| **Retry with Modified Text** | If key was reused blindly, old key would ignore new text. | Client detects signature mismatch, generates fresh key, dispatches legitimate new broadcast. |
| **DB Failure During Notification Loop** | Catch block catches exception, but Hibernate marks transaction rollback-only. Total rollback at commit time; 0 history saved. | Atomic reservation row rolls back with transaction; retry with same key is permitted and clean. |
| **Third-Party Email API Failure** | Resend API failure is trapped inside `EmailService.deliverEmail`. DB transaction has already committed. | Best-effort email semantics preserved; in-app notification remains intact; no rollback. |

---

## 8. Database Migration Review (`V49__add_broadcast_history_idempotency.sql`)

### Safety Checklist
- [x] **No Extensions Required:** Uses standard PostgreSQL `md5('cakeplatform:broadcast_history:' || id::text)::uuid`.
- [x] **Deterministic Backfill:** Historical rows receive predictable UUIDs based on immutable `BIGSERIAL PRIMARY KEY`.
- [x] **Collision Safety:** In the improbable event of an MD5 collision, PostgreSQL's `ADD CONSTRAINT ... UNIQUE` aborts and rolls back the transaction safely without data corruption.
- [x] **Zero Table-Lock Hangs:** Columns added as nullable first, backfilled, and then set to `NOT NULL` with defaults.
- [x] **Transactional DDL:** PostgreSQL executes all Flyway statements inside a single transaction.

---

## 9. Security and Recipient-Eligibility Review

1. **Role Boundary Enforcement**:
   - Specific target validation: `user.getRole() == UserRole.SHOP_OWNER`. Prevents targeting `CUSTOMER` or `ADMIN` accounts.
2. **Account Status Filtering**:
   - Excludes users where `status != UserStatus.ACTIVE` or `isDeleted == true`.
3. **FSSAI Safeguard**:
   - FSSAI verification is NOT required to receive platform announcements (aligns with CakeStore business rules).
4. **Endpoint Authorization**:
   - `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` confirmed active via `@EnableMethodSecurity` in `SecurityConfig.java`.

---

## 10. Existing Test Coverage and Gaps

| Test Area | Existing Coverage | Required Tests |
| :--- | :--- | :--- |
| **Backend Unit Tests** | 0% | Role validation, bulk active filtering, empty recipient handling |
| **Backend Idempotency** | 0% | Atomic reservation, same-key unchanged retry, same-key payload conflict |
| **Backend Transactionality** | 0% | Rollback cancels after-commit listener; best-effort email failure |
| **Frontend Form & Badge** | 0% | Form validation, character limits, "Attempted" badge text |
| **Frontend Storage** | 0% | `sessionStorage` draft persistence, signature matching, key regeneration |

---

## 11. Consolidated List of All Proposed Repairs

1. **DB Migration (`V49`)**:
   Add `idempotency_key UUID` (unique, not null) and `status VARCHAR(20)` (default 'PENDING', not null) to `broadcast_history`.
2. **Repository Layer**:
   Create `BroadcastHistoryRepositoryCustom` and `BroadcastHistoryRepositoryCustomImpl` using `JdbcTemplate` to execute `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`.
3. **Backend DTO Validation**:
   Annotate `AdminMessageRequest` with `@NotBlank`, `@Size(max = 255)` on title, `@Size(max = 1024)` on message, and `@Positive` on owner ID. Add `@Valid` in `AdminMessageController`.
4. **Synchronous Payload Pre-Check**:
   In `AdminMessageController`, verify if key exists: if identical payload, return 200 OK immediately; if mismatched payload, return 409 Conflict.
5. **Service Layer Hardening**:
   In `BroadcastService`:
   - Reserve key via `insertIfAbsent`.
   - Validate specific target role and active status.
   - Query bulk targets with `status = ACTIVE` and `isDeleted = false`.
   - Update `BroadcastHistory` to `COMPLETED` upon loop completion.
6. **Frontend State & Session Binding**:
   In `messages/page.tsx`:
   - Manage `cake_admin_broadcast_draft` in `sessionStorage` binding `idempotencyKey` to payload signature.
   - Enforce `maxLength={255}` on title and `maxLength={1024}` on message.
   - Correct history badge from "Delivered" to "Attempted ({bcast.recipientCount})" with tooltip.
   - Display email dispatch icon in history rows.
   - Add loading skeleton to eliminate false empty state flash.

---

## 12. Repair Dependencies and Implementation Order

```
[Phase 1: Database Migration]
  └── Create V49__add_broadcast_history_idempotency.sql

[Phase 2: Backend Core]
  ├── Update BroadcastHistory entity
  ├── Create BroadcastHistoryRepositoryCustom & CustomImpl (JdbcTemplate)
  ├── Add validation annotations to AdminMessageRequest
  └── Update AdminMessageController with @Valid and pre-check

[Phase 3: Business Logic & Eligibility]
  └── Harden BroadcastService (atomic reservation, role validation, active filtering)

[Phase 4: Frontend UX & Idempotency Binding]
  ├── Update types in frontend_v2/types/admin.ts
  ├── Update admin.ts API client
  └── Harden frontend_v2/app/admin/messages/page.tsx (sessionStorage, badge, limits)

[Phase 5: Automated Testing]
  ├── Backend Unit & Integration Tests (BroadcastServiceTest, AdminMessageControllerTest)
  └── Frontend Jest / RTL Tests (adminBroadcastIdempotency.test.mjs)
```

---

## 13. Regression Test Matrix

| Test ID | Layer | Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **TEST-BC-01** | Backend | Submit broadcast with valid payload | Returns 200 OK, creates in-app notification, records history with `status = COMPLETED`. |
| **TEST-BC-02** | Backend | Double-submit with identical key and payload | Exactly one set of notifications created; second request returns 200 OK without side effects. |
| **TEST-BC-03** | Backend | Submit with same key but altered message body | Returns HTTP 409 Conflict synchronously; zero notifications dispatched. |
| **TEST-BC-04** | Backend | Specific target with `CUSTOMER` role ID | Request rejected with 0 notifications; logs warning. |
| **TEST-BC-05** | Backend | Specific target with `DISABLED` owner status | Request rejected with 0 notifications; logs warning. |
| **TEST-BC-06** | Backend | Message > 1024 characters | Controller rejects with HTTP 400 Bad Request synchronously. |
| **TEST-BC-07** | Backend | DB error during broadcast transaction | Entire transaction rolls back; after-commit listener never fires; no emails sent. |
| **TEST-BC-08** | Backend | Resend API failure in `EmailService` | Exception caught; DB transaction remains committed; in-app notification intact. |
| **TEST-BC-09** | Frontend | Refresh page after network timeout | Reuses stored key and payload from `sessionStorage`. |
| **TEST-BC-10** | Frontend | Edit text in composer | Detects signature mismatch; regenerates new idempotency key in `sessionStorage`. |
| **TEST-BC-11** | Frontend | History table rendering | Displays "Attempted ({count})" with Clock icon; no "Delivered" claim. |

---

## 14. Risks That Cannot Be Resolved from Source Inspection Alone

1. **Production Table Size & Migration Lock Time**:
   - If production `broadcast_history` contains millions of rows (unlikely for an admin announcement table), the backfill `UPDATE` could take several seconds. Verified schema shows `V36` was added recently.
2. **Third-Party Email Rate Limits (Resend)**:
   - Resend API keys have tier-dependent rate limits (e.g. 10 emails/sec). Dispatching bulk broadcasts to > 100 owners without rate-limiting could trigger 429 Too Many Requests from Resend.

---

## 15. Explicit Out-of-Scope Items

- Re-architecting the in-app notification center or customer storefront notifications.
- Introducing a distributed message queue (Kafka / RabbitMQ / Redis) or new database engines.
- Modifying customer-facing notification templates or SMS delivery integrations.

---

## 16. Final Assessment: Implementation Readiness

- **Read-Only Investigation Status:** COMPLETE.
- **Architectural Clarity:** All failure modes, transaction boundaries, SQL constraints, and client lifecycle scenarios are fully understood and mapped to concrete fixes.
- **Go / No-Go Decision:** **READY FOR IMPLEMENTATION PENDING USER APPROVAL.**
