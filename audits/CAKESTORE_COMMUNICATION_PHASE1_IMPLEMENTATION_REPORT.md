# CakeStore Communication Phase 1 — Implementation Report (Platform Feedback Only)

**Date:** 2026-10-16  
**Status:** Implementation & Verification Complete  
**Scope:** COM-FB-V01 through COM-FB-V04 (Platform Feedback tab & Owner Feedback modal)  
**Execution Context:** Local development & test environment (Strict isolation: production database not accessed, real emails not sent)

---

## 1. Finding & Implementation Status Matrix

| Finding ID | Finding Description | Implementation Status | Verification Result |
|---|---|---|---|
| **COM-FB-V01** | `platform_feedback` entity/migration schema mismatch (`admin_reply` and `replied_at` missing) | **RESOLVED** | Flyway migration `V48__add_admin_reply_to_platform_feedback.sql` created with non-breaking `IF NOT EXISTS` syntax. |
| **COM-FB-V02** | `replyToFeedback` suppresses 404/500 errors, shows false success, and risks transaction rollback on email exception | **RESOLVED** | Removed 404/500 swallowing in `communication.ts`; moved draft clearing in `feedback/page.tsx` into `try` block; in backend `PlatformFeedbackService`, isolated email dispatch inside `try-catch` so database persistence always commits. |
| **COM-FB-V03** | `submitPlatformFeedback` fabricates `{ success: true }` after 404/500 server errors | **RESOLVED** | Removed artificial fallback in `communication.ts`; `OwnerFeedbackModal.tsx` surfaces true server error messages and preserves user inputs. |
| **COM-FB-V04** | Communication actions omit the existing `ActivityLoggerService` | **RESOLVED** | Injected `ActivityLoggerService` into `PlatformFeedbackService`; extracted `@AuthenticationPrincipal CustomUserDetails` in `AdminCommunicationController`; audit events `PLATFORM_FEEDBACK_READ` and `PLATFORM_FEEDBACK_REPLIED` are now asynchronously recorded in `activity_logs`. |

---

## 2. Changed Files & Explanation

### Backend Files

1. **`backend/src/main/resources/db/migration/V48__add_admin_reply_to_platform_feedback.sql` (NEW)**
   - Adds `admin_reply TEXT` and `replied_at TIMESTAMP WITHOUT TIME ZONE` columns to table `platform_feedback`.
   - Uses `ADD COLUMN IF NOT EXISTS` for idempotent, non-locking execution compatible with PostgreSQL 16 and Flyway.
   - Eliminates the schema mismatch with `PlatformFeedback.java` lines 51–54.

2. **`backend/src/main/java/com/cakeplatform/api/modules/communication/PlatformFeedbackService.java` (MODIFIED)**
   - Injected `private final ActivityLoggerService activityLogger;`.
   - In `replyToFeedback`:
     - Validates that `replyMessage` is not blank.
     - Performs database update first (`feedback.setAdminReply(...)`, `repliedAt`, `isRead = true`, `feedbackRepository.save(feedback)`).
     - Isolates `emailService.sendEmail(...)` within an explicit `try-catch` block so email failures never roll back the saved reply.
     - Asynchronously writes audit log `PLATFORM_FEEDBACK_REPLIED` with admin actor ID, shop ID, and metadata.
   - In `markAsRead`:
     - Overloaded with `markAsRead(Long id, Long adminUserId)`.
     - Writes audit log `PLATFORM_FEEDBACK_READ`.

3. **`backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java` (MODIFIED)**
   - Added `@AuthenticationPrincipal CustomUserDetails userDetails` to `markFeedbackRead` and `replyToFeedback`.
   - Passes `adminUserId` to `feedbackService.markAsRead(id, adminUserId)` and `feedbackService.replyToFeedback(id, request.getMessage(), adminUserId)`.

4. **`backend/src/test/java/com/cakeplatform/api/modules/communication/PhaseGCommunicationTest.java` (MODIFIED)**
   - Mocked `ActivityLoggerService` in `setUp`.
   - Updated existing test `G1.6` to verify audit logging on mark-read.
   - Added test `G1.7`: Verifies reply persistence, audit logging, and email invocation.
   - Added test `G1.8`: Verifies safe failure isolation when `emailService.sendEmail` throws an exception (reply still persists).
   - Added test `G1.9`: Verifies `AdminCommunicationController.replyToFeedback` endpoint delegation with principal.

### Frontend Files

5. **`frontend_v2/lib/api/communication.ts` (MODIFIED)**
   - `submitPlatformFeedback`: Removed `try-catch` block that previously caught 404/500 errors and returned fake `{ success: true, message: 'Feedback received by CakeStore team' }`. True server and network errors now reject the promise.
   - `replyToFeedback`: Removed `try-catch` block that previously caught 404/500 errors and swallowed them.

6. **`frontend_v2/app/admin/feedback/page.tsx` (MODIFIED)**
   - In `handleSendReply`: Moved `setReplyText('')` and `setIsReplying(false)` inside the `try` block so they execute **only** upon successful response.
   - In `catch`: Extracts server error message (`error?.response?.data?.message || error?.message`) and flashes `toast.error(errorMsg)`.
   - Admin's typed reply text and open textarea are preserved upon any network or backend failure.

7. **`frontend_v2/components/owner/OwnerFeedbackModal.tsx` (MODIFIED)**
   - In `handleSubmit`: `setErrorMsg` extracts backend error messages defensively.
   - On error, `isSubmitted` remains `false`, the modal stays open with a visible error banner, and the user's drafted message and rating remain intact.

8. **`frontend_v2/__tests__/platformFeedbackErrorHandling.test.mjs` (NEW)**
   - 5 automated unit tests verifying error unmasking, HTTP 200 success handling, draft preservation for `OwnerFeedbackModal`, and draft preservation for `AdminPlatformFeedbackPage`.

---

## 3. Migration Behavior & Production Safety Confirmation

- **Migration File:** `V48__add_admin_reply_to_platform_feedback.sql`.
- **Target Table:** `platform_feedback`.
- **Production Safeguard Confirmation:**
  - No remote or production database was connected to or altered during this task.
  - The migration file is committed to source control for Flyway to apply automatically on startup.
  - Both added columns are nullable with no default expressions or foreign key constraints. Applying this migration requires no table lock or rewrite.

---

## 4. Test Execution & Verification Results

### Test Suite 1: Frontend Regression Tests
- **Command Executed:**
  ```powershell
  node --test __tests__/platformFeedbackErrorHandling.test.mjs
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\frontend_v2`
- **Actual Output:**
  ```text
  ✔ COM-FB-V03: submitPlatformFeedback propagates HTTP 500/404 server errors without fabricating success (1.856ms)
  ✔ COM-FB-V03: submitPlatformFeedback returns success payload upon valid 200 response (0.1596ms)
  ✔ COM-FB-V02: replyToFeedback propagates HTTP 500/404 errors instead of swallowing them (0.2123ms)
  ✔ COM-FB-V02: replyToFeedback succeeds cleanly when backend responds with 200 OK (1.3474ms)
  ✔ COM-FB-V02 & COM-FB-V03: Error handling preserves form drafts upon submission failure (1.5465ms)
  ℹ tests 5
  ℹ suites 0
  ℹ pass 5
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 122.3423
  ```
- **Result:** **PASSED (5/5 tests passing)**

### Test Suite 2: Backend Communication Unit & Regression Tests
- **Command Executed:**
  ```powershell
  mvn test -Dtest=PhaseGCommunicationTest
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\backend`
- **Actual Output:**
  ```text
  [INFO] Tests run: 36, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.500 s -- in com.cakeplatform.api.modules.communication.PhaseGCommunicationTest
  [INFO] 
  [INFO] Results:
  [INFO] 
  [INFO] Tests run: 36, Failures: 0, Errors: 0, Skipped: 0
  [INFO] 
  [INFO] ------------------------------------------------------------------------
  [INFO] BUILD SUCCESS
  [INFO] ------------------------------------------------------------------------
  [INFO] Total time:  41.595 s
  [INFO] Finished at: 2026-10-16T12:15:10+05:30
  ```
- **Result:** **PASSED (36/36 tests passing, 0 failures, 0 errors, 0 skipped)**

### Summary of Executed vs. Skipped Tests
- **Executed:** 36 backend tests in `PhaseGCommunicationTest`, 5 frontend tests in `platformFeedbackErrorHandling.test.mjs`. Total = 41 tests.
- **Failures:** 0.
- **Skipped / Unexecuted:** None within the approved scope. Broader whole-project integration tests were not run to adhere strictly to time and Phase 1 scope limits.

---

## 5. Draft Preservation & Failure Survival Confirmation

1. **Admin Reply Drafts:**
   - **Verification:** In `frontend_v2/app/admin/feedback/page.tsx`, `setReplyText('')` and `setIsReplying(false)` only execute upon successful promise resolution.
   - **Tested Behavior:** When an API failure occurs, `toast.error(errorMsg)` is displayed, while `replyText` remains in state and the textarea stays open. The admin does not lose their typed reply.
2. **Owner Feedback Submission Drafts:**
   - **Verification:** In `frontend_v2/components/owner/OwnerFeedbackModal.tsx`, `isSubmitted` remains `false` on failure, and `setErrorMsg(...)` surfaces the real failure reason.
   - **Tested Behavior:** `message`, `rating`, and `category` remain populated in component state, allowing the owner to retry.

---

## 6. Git Diff & Working Tree Review

- All pre-existing modifications in unrelated files (`AdminSubscriptionPlanController.java`, `frontend_v2/types/admin.ts`, `frontend_v2/app/admin/shops/[id]/page.tsx`, etc.) were left completely untouched.
- No changes were made to Contact Enquiries (`/admin/enquiries`), Broadcast (`/admin/messages`), or external delivery providers.
- Git status confirms that only the 8 designated Phase 1 files were created or modified.

---

## 7. Remaining Risks & Manual Verification Items

1. **Flyway Migration on Staging / Production Boot:**
   - When the backend application next boots in an environment connected to PostgreSQL, Flyway will detect and execute `V48__add_admin_reply_to_platform_feedback.sql`. Ensure the PostgreSQL user has `ALTER TABLE` privileges on `platform_feedback`.
2. **Resend API Key Configuration:**
   - As verified in previous audits, `EmailService` dispatches transactional emails via the Resend REST API if `RESEND_API_KEY` is set in the environment. If unset, it gracefully logs structured email notifications. The safe isolation implemented in `PlatformFeedbackService.replyToFeedback` ensures reply persistence succeeds regardless of email provider credentials.

---
*Phase 1 Implementation Complete. Awaiting user review before proceeding to any subsequent phases.*
