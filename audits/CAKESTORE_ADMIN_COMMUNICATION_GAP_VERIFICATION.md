# CakeStore Communication Tabs — Gap Verification Report (Read-Only)

**Date:** 2026-10-16  
**Status:** Verification Complete (Strictly Read-Only — No source, configuration, migration, or database modifications)  
**Target Tabs:** Platform Feedback (`/admin/feedback`), Contact Enquiries (`/admin/enquiries`), Broadcast (`/admin/messages`)  
**Reference Document:** `CAKESTORE_ADMIN_COMMUNICATION_TABS_DEEP_AUDIT.md`

---

## 1. Executive Summary & Audit Re-Evaluation

This second-pass verification conducted an exhaustive, evidence-backed inspection of the three Admin Dashboard Communication tabs across the entire stack: Next.js frontend pages, API client handlers, Spring Boot controllers, transactional service boundaries, JPA repositories, Flyway migrations, security filters, and unit/integration test suites.

### Key Corrections to the First-Pass Deep Audit

1. **Broadcast Delivery Channel Was Mischaracterized:**
   - *Previous claim:* The delivery channel is completely absent and only logs.
   - *Verified reality:* Real delivery channels **do exist**. `BroadcastService` delegates to `NotificationService.createNotification`, which persists in-app notifications to PostgreSQL, broadcasts real-time alerts via STOMP WebSocket (`/queue/notifications-{userId}` via `SimpMessagingTemplate`), and triggers transactional email dispatch via `EmailService` (using the Resend HTTP API when configured) if `sendEmail=true`.
2. **Audit Logging Mechanism Already Exists:**
   - *Previous claim:* No audit logging entity exists in the project; an audit table must be created from scratch.
   - *Verified reality:* A global audit logging system already exists: `com.cakeplatform.api.modules.audit.ActivityLoggerService` backed by entity `ActivityLog` and table `activity_logs`. It is actively used across shop management, subscriptions, and orders. The communication modules simply neglected to inject and call `activityLogger.logActivity(...)`.
3. **Email Provider Configuration:**
   - *Previous claim:* Email integration requires JavaMailSender/SMTP.
   - *Verified reality:* CakeStore's `EmailService` is built entirely on Java 11+ `java.net.http.HttpClient` targeting the Resend REST API (`https://api.resend.com/emails`), with a fallback structured log for local/dev environments. There is no `JavaMailSender` dependency.
4. **Critical Schema Gap Discovered in `platform_feedback`:**
   - While `contact_enquiries` received `admin_reply` and `replied_at` via Flyway migration `V40__add_admin_reply_to_contact_enquiries.sql`, `platform_feedback` **never received an equivalent migration**. If an admin replies to feedback in production, Hibernate validation or PostgreSQL runtime execution will fail because `admin_reply` and `replied_at` columns do not exist in the `platform_feedback` table.

---

## 2. Verified Findings by Tab

### Tab 1: Platform Feedback (`/admin/feedback`)

#### Finding COM-FB-V01: Missing Database Columns for Platform Feedback Admin Reply
- **Classification:** **Confirmed Defect (Critical)**
- **Layer:** Database Schema / Flyway Migrations / Entity Mapping
- **Evidence:**
  - Entity: `com.cakeplatform.api.modules.communication.PlatformFeedback` ([PlatformFeedback.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/PlatformFeedback.java#L51-L54)):
    ```java
    @Column(columnDefinition = "TEXT")
    private String adminReply;

    private java.time.LocalDateTime repliedAt;
    ```
  - Initial Migration: [V10__communication_and_admin_notifications.sql](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V10__communication_and_admin_notifications.sql#L7-L17) creates `platform_feedback` with only:
    `id`, `owner_id`, `shop_id`, `rating`, `category`, `message`, `is_read`, `created_at`, `updated_at`.
  - Incremental Migration [V40__add_admin_reply_to_contact_enquiries.sql](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V40__add_admin_reply_to_contact_enquiries.sql#L2-L4) added `admin_reply` and `replied_at` exclusively to `contact_enquiries`:
    ```sql
    ALTER TABLE contact_enquiries
        ADD COLUMN IF NOT EXISTS admin_reply TEXT,
        ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;
    ```
  - Configuration: [application.yml](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L19) specifies `spring.jpa.hibernate.ddl-auto: validate`.
- **Expected Behavior:** `platform_feedback` table must contain `admin_reply TEXT` and `replied_at TIMESTAMP` columns to store admin replies.
- **Actual Behavior:** The columns are absent in all Flyway migrations (V1 through V47). When `PlatformFeedbackService.replyToFeedback` attempts to persist `feedbackRepository.save(feedback)` against a validated schema, execution fails with SQL error `column "admin_reply" of relation "platform_feedback" does not exist`.

---

#### Finding COM-FB-V02: Silent Error Masking & False Success Toast on Admin Reply Failure
- **Classification:** **Confirmed Defect (High)**
- **Layer:** Frontend API Client / UI State Management / Backend Service Transaction
- **Evidence:**
  - Backend Service: [PlatformFeedbackService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/PlatformFeedbackService.java#L124-L138):
    ```java
    @Transactional
    public void replyToFeedback(Long id, String replyMessage) {
        ...
        emailService.sendEmail(feedback.getOwnerEmail(), ...); // Not in try-catch
        feedback.setAdminReply(replyMessage);
        feedback.setRepliedAt(java.time.LocalDateTime.now());
        feedback.setIsRead(true);
        feedbackRepository.save(feedback);
    }
    ```
  - If `emailService.sendEmail` throws an unhandled error or database persistence fails due to missing columns, Spring rolls back the entire transaction. The controller throws an exception resulting in HTTP 500.
  - Frontend API: [frontend_v2/lib/api/communication.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts#L119-L127):
    ```ts
    async replyToFeedback(id: string | number, message: string): Promise<void> {
      try {
        await apiClient.post(`/api/admin/feedback/${id}/reply`, { message });
      } catch (err: any) {
        if (err?.status !== 404 && err?.status !== 500) {
          throw err;
        }
        console.warn('Backend feedback reply unavailable:', err);
      }
    }
    ```
  - Frontend Page: [frontend_v2/app/admin/feedback/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/feedback/page.tsx#L103-L114):
    ```tsx
    try {
      setIsSending(true);
      await communicationApi.replyToFeedback(selectedFeedback.id, replyText);
      toast.success('Reply sent successfully');
      setReplyText('');
      setIsReplying(false);
      fetchFeedback();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reply');
    }
    ```
- **Expected Behavior:** If the backend fails to send the email or persist the reply, the frontend API should rethrow the error, and the UI should display an error toast `Failed to send reply` while keeping the admin's draft intact in the textarea.
- **Actual Behavior:** The frontend API suppresses both HTTP 404 and HTTP 500 errors. `handleSendReply` receives a resolved promise, clears the admin's draft reply, and flashes a false `Reply sent successfully` green toast. When `fetchFeedback()` runs or the page is refreshed, the reply is absent and the item remains unread.

---

#### Finding COM-FB-V03: Owner Feedback Submission Endpoint Masks Server Outages
- **Classification:** **Confirmed Defect (Medium)**
- **Layer:** Frontend API Client (`communicationApi.submitPlatformFeedback`)
- **Evidence:**
  - [frontend_v2/lib/api/communication.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts#L15-L25):
    ```ts
    async submitPlatformFeedback(payload: CreatePlatformFeedbackPayload): Promise<{ success: boolean; message: string }> {
      try {
        return await apiClient.post<{ success: boolean; message: string }>('/api/owner/feedback', payload);
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 500) {
          return { success: true, message: 'Feedback received by CakeStore team' };
        }
        throw err;
      }
    }
    ```
- **Expected Behavior:** If the backend is unreachable (500) or route is unmapped (404), the shop owner should receive an error notification indicating submission failed.
- **Actual Behavior:** The client intercepts 404 and 500 errors and fabricates a success response `{ success: true, message: 'Feedback received by CakeStore team' }`. The owner's feedback is silently dropped without reaching the database.

---

#### Finding COM-FB-V04: Absence of Activity Audit Logging for Feedback Actions
- **Classification:** **Confirmed Gap (Low)**
- **Layer:** Backend Service (`PlatformFeedbackService`)
- **Evidence:**
  - Neither `markAsRead` ([line 142](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/PlatformFeedbackService.java#L142)) nor `replyToFeedback` ([line 120](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/PlatformFeedbackService.java#L120)) calls `ActivityLoggerService.logActivity(...)`.
  - `ActivityLoggerService` ([ActivityLoggerService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/audit/ActivityLoggerService.java#L14)) is already implemented and injected across 7 other services.
- **Expected Behavior:** Administrative actions on customer/owner feedback should write audit logs to `activity_logs`.
- **Actual Behavior:** Only local loggers (`log.info`) record the actions; no audit trail is stored in PostgreSQL.

---

### Tab 2: Contact Enquiries (`/admin/enquiries`)

#### Finding COM-ENQ-V01: Missing Delete and Status Lifecycle Controls
- **Classification:** **Confirmed Functional Gap (Medium)**
- **Layer:** UI / Controller / Service / Entity
- **Evidence:**
  - Backend Controller: [AdminCommunicationController.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java) defines only:
    - `GET /api/admin/enquiries`
    - `PATCH /api/admin/enquiries/{id}/read`
    - `POST /api/admin/enquiries/{id}/reply`
  - There is no `@DeleteMapping` endpoint for enquiries in `AdminCommunicationController`.
  - Frontend Page: [frontend_v2/app/admin/enquiries/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx) provides only `Mark Read` and `Reply` buttons. There are no delete buttons, archive options, or status transition pickers (e.g. `IN_PROGRESS`, `RESOLVED`, `CLOSED`).
  - Database Entity: [ContactEnquiry.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiry.java#L45-L49) tracks only `isRead` (boolean).
- **Expected Behavior:** Administrative communication panels typically require enquiry resolution statuses and the ability to purge spam or resolved enquiries.
- **Actual Behavior:** Enquiries can only be toggled to `is_read = true` or replied to. They can never be deleted, archived, or transitioned through a lifecycle.

---

#### Finding COM-ENQ-V02: Rate-Limiting Configuration & Route Verification
- **Classification:** **Verified Working Implementation**
- **Layer:** Security Filter (`RateLimitingFilter.java`)
- **Evidence:**
  - Class: [RateLimitingFilter.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/RateLimitingFilter.java#L25-L34)
  - Actual Threshold: **20 requests per minute per IP** via Bucket4j:
    ```java
    // Tier 2: Abuse-sensitive public actions (20 requests per minute per IP)
    private final Map<String, Bucket> sensitiveBuckets = new ConcurrentHashMap<>();
    ...
    Bucket bucket = sensitiveBuckets.computeIfAbsent(ip, k -> createBucket(20, Duration.ofMinutes(1)));
    ```
  - Route Coverage ([lines 84-93](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/RateLimitingFilter.java#L84-L93)):
    ```java
    private boolean isSensitiveEndpoint(String uri) {
        return uri.contains("/verify-payment")
                || uri.contains("/create-payment-order")
                || uri.contains("/coupons/validate")
                || uri.endsWith("/enquiry")
                || uri.startsWith("/api/contact/enquiries")
                || uri.startsWith("/api/owner/feedback")
                || uri.startsWith("/api/owner/media/upload")
                || isGuestOrderTrackingEndpoint(uri);
    }
    ```
  - Exceeding Response: HTTP 429 Too Many Requests with header `Retry-After: 60` and body:
    `{"error":"Too Many Requests","message":"Rate limit exceeded. Please try again later.","retryAfter":60}`.
- **Evaluation:** Rate limiting on the public contact form `/api/contact/enquiries` is genuinely configured and active in code at 20 req/min/IP.

---

#### Finding COM-ENQ-V03: Email Dispatch Configuration & Destination Verification
- **Classification:** **Verified Working Implementation with Gaps**
- **Layer:** Notification / External Email Integration
- **Evidence:**
  - Method: [EmailService.sendContactEnquiryEmail](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java#L37-L63):
    - Configured admin destination: `${mail.admin-notification-email:${app.admin.default-email:admin@cakeplatform.com}}`.
    - Defined in [application.yml](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L75): `mail.admin-notification-email: ${APP_ADMIN_DEFAULT_EMAIL:admin@cakeplatform.com}`.
    - Sender address: `${MAIL_FROM_ADDRESS:onboarding@resend.dev}`.
    - Delivery provider: Resend API via `java.net.http.HttpClient` targeting `https://api.resend.com/emails` when `RESEND_API_KEY` is present.
    - Safe execution: Decorated with `@Async` and all network calls are wrapped in `try-catch` inside `deliverEmail`.
- **Evaluation:** Email dispatch does not block database persistence. If Resend credentials are not provided, it gracefully outputs structured delivery logs. However, the reply action (`replyToEnquiry`) does not record audit logs and suppresses HTTP 500 errors in the frontend API client just like Platform Feedback.

---

#### Finding COM-ENQ-V04: Public Contact Form Submissions Swallow Server Errors
- **Classification:** **Confirmed Defect (Medium)**
- **Layer:** Frontend API Client (`communicationApi.submitContactEnquiry`)
- **Evidence:**
  - [frontend_v2/lib/api/communication.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts#L57-L66):
    ```ts
    async submitContactEnquiry(payload: CreateContactEnquiryPayload): Promise<{ success: boolean; message: string }> {
      try {
        return await apiClient.post<{ success: boolean; message: string }>('/api/contact/enquiries', payload);
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 500) {
          return { success: true, message: 'Enquiry submitted successfully' };
        }
        throw err;
      }
    }
    ```
- **Expected Behavior:** If the public submission fails due to server errors or validation issues, the contact page should display an error message.
- **Actual Behavior:** 404 and 500 errors are caught and masked as `{ success: true, message: 'Enquiry submitted successfully' }`.

---

### Tab 3: Broadcast (`/admin/messages`)

#### Finding COM-BC-V01: Disconnect Between Real Delivery Infrastructure and Audit Claims
- **Classification:** **Verified Working Implementation (Correction of False Audit Defect)**
- **Layer:** Backend Services / Multi-Channel Delivery
- **Evidence:**
  - In [BroadcastService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L38-L52):
    ```java
    for (User owner : targets) {
        try {
            notificationService.createNotification(
                    owner,
                    NotificationType.ADMIN_MESSAGE,
                    request.getTitle(),
                    request.getMessage(),
                    null,
                    request.isSendEmail()
            );
            count++;
        } catch (Exception e) {
            log.error("Failed to send broadcast to user {}: {}", owner.getId(), e.getMessage());
        }
    }
    ```
  - In [NotificationService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationService.java#L25-L56):
    1. Saves notification entity to `notifications` database table.
    2. Publishes internal `NotificationCreatedEvent`.
    3. Handles event on transaction commit:
       - Pushes real-time WebSocket alert via `SimpMessagingTemplate.convertAndSend("/queue/notifications-" + recipientId, notification)`.
       - If `sendEmail=true`, dispatches email via `emailService.sendEmail(...)` to the recipient's registered email address.
- **Evaluation:** Real delivery channels exist. The broadcast is not merely a database record; it triggers in-app notification creation, real-time WebSocket messaging, and email delivery.

---

#### Finding COM-BC-V02: UI Hardcodes "Delivered" Status for Staged/Asynchronous Operations
- **Classification:** **Confirmed Defect (Medium)**
- **Layer:** Frontend UI (`frontend_v2/app/admin/messages/page.tsx`) / Data Model
- **Evidence:**
  - [frontend_v2/app/admin/messages/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L315-L318):
    ```tsx
    <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Delivered
    </div>
    ```
  - Database entity [BroadcastHistory.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java#L18-L45) has **no status column**:
    Fields: `id`, `title`, `message`, `targetType`, `targetOwnerId`, `recipientCount`, `sentEmail`, `sentAt`.
  - Backend controller [AdminMessageController.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java#L24-L25) delegates to `@Async BroadcastService` and returns immediately:
    `"Broadcast dispatched successfully. Processing in background."`
- **Expected Behavior:** If the broadcast is processed asynchronously in the background, history should reflect status states like `PROCESSING`, `COMPLETED`, or `FAILED`.
- **Actual Behavior:** The UI hardcodes a green `Delivered` badge for every broadcast row, misleading administrators into believing delivery has been confirmed.

---

#### Finding COM-BC-V03: Over-Broad Audience Targeting & Inactive Account Inclusion
- **Classification:** **Confirmed Defect (Medium)**
- **Layer:** Backend Business Logic (`BroadcastService.java`)
- **Evidence:**
  - [BroadcastService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L31-L36):
    ```java
    if (request.getSpecificOwnerId() != null) {
        User owner = userRepository.findById(request.getSpecificOwnerId()).orElse(null);
        targets = (owner != null) ? List.of(owner) : Collections.emptyList();
    } else {
        targets = userRepository.findByRole(UserRole.SHOP_OWNER);
    }
    ```
- **Expected Behavior:**
  1. For `ALL`: Only active, non-suspended, non-deleted shop owners whose bakeries are approved should receive operational broadcasts.
  2. For `SPECIFIC`: The service should validate that the target user ID actually belongs to a `SHOP_OWNER`.
- **Actual Behavior:**
  1. `userRepository.findByRole(UserRole.SHOP_OWNER)` selects every user with that role, including soft-deleted users, disabled accounts, and owners of suspended/rejected shops.
  2. For `SPECIFIC`, it looks up `userRepository.findById` without verifying `role == SHOP_OWNER`. Passing an admin or customer ID results in targeting that user.

---

#### Finding COM-BC-V04: Definition of `recipientCount`
- **Classification:** **Confirmed Semantic Inaccuracy (Low)**
- **Layer:** Backend Business Logic (`BroadcastService.java`)
- **Evidence:**
  - In [BroadcastService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L40-L48):
    `count++` increments when `notificationService.createNotification` successfully persists an in-app notification row to the DB.
  - Actual delivery via WebSocket and email happens after transaction commit in an asynchronous event listener.
- **Verified Finding:** `recipientCount` in `BroadcastHistory` reflects **"in-app notification database records successfully queued"**, not confirmed WebSocket receptions or delivered emails.

---

#### Finding COM-BC-V05: Lack of Idempotency Protection on Broadcast Dispatch
- **Classification:** **Confirmed Defect (Low)**
- **Layer:** Backend Controller / Service
- **Evidence:**
  - `POST /api/admin/messages` accepts payload and spawns an `@Async` broadcast worker with no deduplication or idempotency key.
  - If an admin double-clicks the dispatch button, two jobs run concurrently, inserting duplicate in-app notification records and sending duplicate emails to all recipients.

---

## 3. Summary of Confirmed Defects vs. Unverified Items

| Item ID | Tab | Type | Verified Status | Root Cause Layer |
|---|---|---|---|---|
| **COM-FB-V01** | Platform Feedback | Missing Schema Columns | **Confirmed Defect** | Database Schema / Flyway Migrations |
| **COM-FB-V02** | Platform Feedback | False Success Toast on Failure | **Confirmed Defect** | Frontend API Client (`communication.ts`) |
| **COM-FB-V03** | Platform Feedback | Masking Outages on Submit | **Confirmed Defect** | Frontend API Client (`communication.ts`) |
| **COM-FB-V04** | Platform Feedback | Missing Activity Audit Log | **Confirmed Gap** | Backend Service (`PlatformFeedbackService`) |
| **COM-ENQ-V01** | Contact Enquiries | No Delete or Status Lifecycle | **Confirmed Gap** | UI / Controller / Entity Design |
| **COM-ENQ-V02** | Contact Enquiries | Rate Limiting (20 req/min) | **Verified Working** | Security Filter (`RateLimitingFilter.java`) |
| **COM-ENQ-V03** | Contact Enquiries | Email Provider via Resend | **Verified Working** | Notification Service (`EmailService.java`) |
| **COM-ENQ-V04** | Contact Enquiries | Masking Outages on Submit | **Confirmed Defect** | Frontend API Client (`communication.ts`) |
| **COM-BC-V01** | Broadcast | Real Delivery Channels | **Verified Working** | In-App, WebSocket & Resend Email |
| **COM-BC-V02** | Broadcast | Hardcoded "Delivered" Badge | **Confirmed Defect** | Frontend UI (`messages/page.tsx`) |
| **COM-BC-V03** | Broadcast | Over-broad Recipient Scope | **Confirmed Defect** | Backend Service (`BroadcastService.java`) |
| **COM-BC-V04** | Broadcast | `recipientCount` Semantics | **Verified Semantics** | Represents DB Queued Records |
| **COM-BC-V05** | Broadcast | Double-Click Duplication | **Confirmed Defect** | Controller / Service Idempotency |

---

## 4. Test Coverage & Testing Gaps Analysis

### Existing Test Suite Assessment
The existing test suite in `backend/src/test/java/com/cakeplatform/api/modules/communication/PhaseGCommunicationTest.java` (1,081 lines) uses Mockito to unit-test the communication layer:
- **G1.1 – G1.6:** Validates feedback submission, priority escalation for low ratings, rejection of non-owner roles, email failure isolation, and mark-read operations.
- **G2.1 – G2.5:** Validates enquiry submission, authenticated customer association, email failure isolation, controller response, and mark-read operations.
- **G3.1:** Validates communication summary unread counters.
- **G4.1 – G5.2:** Validates admin notification multi-fanout and database-level idempotency constraints.

### Uncovered & Missing Test Paths
1. **Zero Tests for Feedback Admin Replies:** Neither `PlatformFeedbackService.replyToFeedback` nor `AdminCommunicationController.replyToFeedback` has a unit test or integration test.
2. **Zero Tests for Enquiry Admin Replies:** Neither `ContactEnquiryService.replyToEnquiry` nor `AdminCommunicationController.replyToEnquiry` has a unit test or integration test.
3. **Zero Tests for Broadcast:** There are **no unit or integration tests whatsoever** for `BroadcastService`, `AdminMessageController`, or `BroadcastHistoryRepository`.
4. **Zero Integration Schema Tests:** All tests mock `PlatformFeedbackRepository`, so the missing `admin_reply` and `replied_at` columns in Flyway migrations were never exercised against a real database schema.
5. **Zero Rate-Limiting Tests:** No automated test asserts HTTP 429 when public contact enquiries exceed 20 requests/minute.

---

## 5. Corrected Severity Ranking

### Critical Severity
1. **COM-FB-V01 (Missing Schema Columns in `platform_feedback`):** Admin replies to platform feedback cannot be stored in PostgreSQL because the columns `admin_reply` and `replied_at` were omitted from Flyway migrations while Hibernate DDL validation is enforced.

### High Severity
2. **COM-FB-V02 (Error Suppression & False Success Toast):** Frontend API clients catch and swallow HTTP 500 errors, causing the admin dashboard to flash "Reply sent successfully" when the backend transaction actually failed or rolled back.

### Medium Severity
3. **COM-FB-V03 & COM-ENQ-V04 (Public Form Error Masking):** Both owner feedback and public contact submission API calls catch 404/500 errors and report fake success to users.
4. **COM-BC-V02 (Hardcoded "Delivered" Badge):** Broadcast history displays an unearned green "Delivered" badge immediately upon dispatch, masking async failures.
5. **COM-BC-V03 (Over-broad Audience Targeting):** Broadcast targeting includes deleted, disabled, and suspended owners, and does not validate role on specific owner IDs.
6. **COM-ENQ-V01 (No Delete or Lifecycle Workflow):** Administrators cannot delete spam enquiries or mark them as resolved/closed.

### Low Severity
7. **COM-FB-V04 (Omission of Activity Audit Logging):** Admin replies and read toggles are not recorded in `activity_logs`.
8. **COM-BC-V05 (Broadcast Double-Click Risk):** Missing dispatch debounce/idempotency token allows concurrent duplicate broadcasts.

---

## 6. Concise List of Confirmed Fixes (Planning Only — Not Implemented)

1. **Add Flyway Migration `V48__add_admin_reply_to_platform_feedback.sql`:**
   Add `admin_reply TEXT` and `replied_at TIMESTAMP` columns to `platform_feedback` to match the JPA entity.
2. **Remove Error Masking in `frontend_v2/lib/api/communication.ts`:**
   Remove catch blocks that swallow 404 and 500 errors in `submitPlatformFeedback`, `replyToFeedback`, `submitContactEnquiry`, and `replyToEnquiry` so genuine network and server errors bubble up to UI toast notifications.
3. **Wrap Email Dispatch in `replyToFeedback` and `replyToEnquiry` with Safe Try-Catch:**
   Ensure transactional saving of the reply in the database is not rolled back if email delivery throws a runtime exception.
4. **Target Only Active Owners in `BroadcastService`:**
   Filter `userRepository.findByRole(UserRole.SHOP_OWNER)` to ensure `user.isEnabled()` and that associated shops are not suspended or soft-deleted. For specific owner ID, verify `owner.getRole() == UserRole.SHOP_OWNER`.
5. **Incorporate `ActivityLoggerService` into Communication Services:**
   Inject `ActivityLoggerService` into `PlatformFeedbackService` and `ContactEnquiryService` to write an audit entry when an admin replies or updates status.
6. **Add Status Field to `BroadcastHistory` and Align UI:**
   Add `status` (e.g. `COMPLETED`, `PROCESSING`) to `broadcast_history` instead of hardcoding "Delivered" in `frontend_v2/app/admin/messages/page.tsx`.
7. **Add Automated Tests:**
   Add unit and rollback integration tests covering `replyToFeedback`, `replyToEnquiry`, `BroadcastService.sendAndRecordBroadcast`, and `RateLimitingFilter`.

---
*Report compiled strictly through read-only inspection.*
