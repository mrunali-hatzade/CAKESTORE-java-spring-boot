# CakeStore Communication Phase 2 — Contact Enquiries Implementation Report

**Status:** Implementation & Verification Complete  
**Date:** 2026-10-16  
**Scope:** COM-ENQ-01 through COM-ENQ-06 (Contact Enquiries Tab & Public Contact Form)  
**Strict Exclusions Maintained:** No database migrations created, COM-ENQ-07 untouched (no proxy changes without deployment evidence), Broadcast tab untouched, no commits, pushes, or deployments.

---

## 1. Executive Summary

Phase 2 implementation for the Contact Enquiries communication module has been completed in strict accordance with the approved repair plan (`CAKESTORE_COMMUNICATION_PHASE2_REPAIR_PLAN.md`).

- **False Success Elimination:** Both public enquiry submission (`submitContactEnquiry`) and admin reply dispatch (`replyToEnquiry`) now propagate genuine server errors (HTTP 404, 429, 500) rather than swallowing them or returning fabricated success.
- **Form & Draft Preservation:** The public contact form retains user input on error without toggling the `submitted` state, displaying a clear error banner. The admin enquiry reading pane preserves the drafted reply text on failure without closing the reply editor.
- **Reply Persistence & Email Failure Isolation:** Admin replies are persisted to the database within a managed Spring transaction (`@Transactional`) first. Asynchronous/external email dispatch is wrapped in an isolated exception handler so that email transport failures do not abort or roll back the database persistence.
- **Reply History Rendering:** The existing `adminReply` and `repliedAt` fields are now rendered in the admin enquiry reading pane with clear timestamps and styling.
- **Admin Activity Logging:** Read and reply actions on contact enquiries now integrate the existing `ActivityLoggerService.logActivity` method, recording the administrator's identity via Spring Security's `@AuthenticationPrincipal CustomUserDetails`.
- **Automated Regression Test Suites:**
  - **Backend:** `PhaseGCommunicationTest` expanded from 36 to **41 tests**, with all 41 passing (0 failures, 0 errors).
  - **Frontend:** New dedicated Node.js test suite `contactEnquiriesErrorHandling.test.mjs` with **7 passing tests**; `platformFeedbackErrorHandling.test.mjs` with **5 passing tests**; total **12 passing frontend regression tests**.
  - **Production Build:** Next.js production build (`npm run build`) succeeded with 0 errors across all 38 routes.

---

## 2. Finding-by-Finding Matrix & Verification Status

| Finding ID | Title | Summary of Implementation | Verification Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **COM-ENQ-01** | Admin reply false success & draft erasure | Removed HTTP 404/500 catch and warn suppression in `replyToEnquiry`. In `AdminContactEnquiriesPage`, updated `handleSendReply` to preserve `replyText` in state on error and surface real error toast. Updated state with `adminReply` on success. | **Runtime Verified** | `contactEnquiriesErrorHandling.test.mjs` (tests 3, 4, 6 passed); Next.js build passed. |
| **COM-ENQ-02** | Public contact form false success & input erasure | Removed synthetic `{ success: true }` fallback in `submitContactEnquiry`. In `ContactPage`, added `errorMessage` state, updated `handleSubmit` to catch errors, preserve form inputs, and render an accessible error banner without switching to the success view. | **Runtime Verified** | `contactEnquiriesErrorHandling.test.mjs` (tests 1, 2, 5 passed); Next.js build passed. |
| **COM-ENQ-03** | Email failure isolation in admin reply | In `ContactEnquiryService.replyToEnquiry`, reordered operations to update `adminReply`, `repliedAt`, and `isRead = true` in `ContactEnquiryRepository` first. Wrapped `emailService.sendEmail` in isolated `try-catch` logging error without throwing. | **Runtime Verified** | `PhaseGCommunicationTest.testReplyToEnquiry_EmailFailureIsolated` (G2.7 passed). |
| **COM-ENQ-04** | Reading pane enquiry reply history | In `AdminContactEnquiriesPage`, added conditional rendering block in the reading pane for `selectedEnquiry.adminReply` and `selectedEnquiry.repliedAt`, reusing `formatDateTime` and existing Tailwind typography tokens. | **Source-Level & Build Verified** | `contactEnquiriesErrorHandling.test.mjs` (test 7 passed); Next.js build passed. |
| **COM-ENQ-05** | Admin activity audit logging | Injected `ActivityLoggerService` into `ContactEnquiryService`. Overloaded `replyToEnquiry` and `markAsRead` with `Long adminUserId`. Updated `AdminCommunicationController` endpoints with `@AuthenticationPrincipal CustomUserDetails userDetails` to record `CONTACT_ENQUIRY_REPLIED` and `CONTACT_ENQUIRY_READ`. | **Runtime Verified** | `PhaseGCommunicationTest.testMarkEnquiryRead` (G2.5) and `testReplyToEnquiry_Success` (G2.6) passed; controller delegation verified (G2.9, G2.10). |
| **COM-ENQ-06** | Automated regression tests | Added 5 new backend JUnit tests in `PhaseGCommunicationTest` and 7 new frontend assertions in `contactEnquiriesErrorHandling.test.mjs`. | **Runtime Verified** | Maven output: 41 tests run, 0 failures, 0 errors. Node test output: 7 passed, 0 failed. |

---

## 3. Files Modified & Exact Changes

### 1. `backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java`
- Injected `ActivityLoggerService activityLogger`.
- Overloaded `replyToEnquiry(Long id, String replyMessage)` -> `replyToEnquiry(Long id, String replyMessage, Long adminUserId)`.
- Validated `replyMessage` is non-empty.
- Persisted `adminReply`, `repliedAt`, and `isRead = true` via `enquiryRepository.save()` before email dispatch.
- Enclosed email sending in a `try-catch` block to guarantee error isolation.
- Logged admin activity via `activityLogger.logActivity(adminUserId, null, "CONTACT_ENQUIRY_REPLIED", "CONTACT_ENQUIRY", saved.getId(), details)`.
- Overloaded `markAsRead(Long id)` -> `markAsRead(Long id, Long adminUserId)` with activity audit logging.

### 2. `backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java`
- Added `@AuthenticationPrincipal CustomUserDetails userDetails` to `/enquiries/{id}/read` (`markEnquiryRead`).
- Added `@AuthenticationPrincipal CustomUserDetails userDetails` to `/enquiries/{id}/reply` (`replyToEnquiry`).
- Passed `adminUserId` to `enquiryService.markAsRead(id, adminUserId)` and `enquiryService.replyToEnquiry(id, request.getMessage(), adminUserId)`.

### 3. `backend/src/test/java/com/cakeplatform/api/modules/communication/PhaseGCommunicationTest.java`
- Updated `setUp` to pass mock `activityLogger` to `ContactEnquiryService`.
- Updated test `testMarkEnquiryRead` (G2.5) to assert activity audit log recording.
- Added test `testReplyToEnquiry_Success` (G2.6).
- Added test `testReplyToEnquiry_EmailFailureIsolated` (G2.7).
- Added test `testReplyToEnquiry_EmptyMessage_Throws` (G2.8).
- Added test `testAdminCommunicationController_ReplyEnquiryEndpoint` (G2.9).
- Added test `testAdminCommunicationController_MarkEnquiryReadEndpoint` (G2.10).

### 4. `frontend_v2/lib/api/communication.ts`
- Removed 404/500 catch and synthetic return `{ success: true, message: 'Enquiry submitted successfully' }` from `submitContactEnquiry`.
- Removed 404/500 catch and suppression from `replyToEnquiry`.

### 5. `frontend_v2/app/contact/page.tsx`
- Added `errorMessage` state.
- In `handleSubmit`, caught API error, extracted response message, set `errorMessage`, and avoided setting `submitted = true`.
- Preserved user inputs in `form` state.
- Rendered dismissible error alert box in the contact form.

### 6. `frontend_v2/app/admin/enquiries/page.tsx`
- In `handleSendReply`:
  - Validated `replyText.trim()`.
  - On error: extracted `error?.response?.data?.message || error?.message`, displayed error toast, and preserved `replyText` in state.
  - On success: updated `selectedEnquiry` state with `adminReply: replyText.trim(), repliedAt: new Date().toISOString(), isRead: true`, cleared draft, closed reply composer, and triggered `fetchEnquiries()`.
- In reading pane body:
  - Rendered `selectedEnquiry.adminReply` and `selectedEnquiry.repliedAt` when present.

### 7. `frontend_v2/__tests__/contactEnquiriesErrorHandling.test.mjs` (New File)
- Added 7 tests covering API error propagation, draft preservation, form validation, and reply history mapping.

---

## 4. Verification Evidence & Test Execution Results

### Backend Test Execution
```bash
mvn test -Dtest=PhaseGCommunicationTest
```
**Result:**
```text
[INFO] Running com.cakeplatform.api.modules.communication.PhaseGCommunicationTest
[INFO] Tests run: 41, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 5.812 s -- in com.cakeplatform.api.modules.communication.PhaseGCommunicationTest
[INFO] Results:
[INFO] Tests run: 41, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Frontend Test Execution
```bash
node --test __tests__/contactEnquiriesErrorHandling.test.mjs
```
**Result:**
```text
✔ COM-ENQ-02: submitContactEnquiry propagates HTTP 500/404/429 errors without fabricating success (2.182ms)
✔ COM-ENQ-02: submitContactEnquiry returns real payload upon valid 200 response (0.1745ms)
✔ COM-ENQ-01: replyToEnquiry propagates HTTP 500/404 errors instead of swallowing them (0.2388ms)
✔ COM-ENQ-01: replyToEnquiry succeeds cleanly when backend responds with 200 OK (2.4066ms)
✔ COM-ENQ-02: Public contact form state preserves inputs and does not set submitted on error (0.6093ms)
✔ COM-ENQ-01: Admin enquiry reply preserves replyText draft on failure (0.2408ms)
✔ COM-ENQ-04: Contact enquiry record maps adminReply and repliedAt history correctly (0.158ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
```

```bash
node --test __tests__/platformFeedbackErrorHandling.test.mjs
```
**Result:**
```text
✔ COM-FB-V03: submitPlatformFeedback propagates HTTP 500/404 server errors without fabricating success (1.3296ms)
✔ COM-FB-V03: submitPlatformFeedback returns success payload upon valid 200 response (0.2232ms)
✔ COM-FB-V02: replyToFeedback propagates HTTP 500/404 errors instead of swallowing them (0.2163ms)
✔ COM-FB-V02: replyToFeedback succeeds cleanly when backend responds with 200 OK (0.7138ms)
✔ COM-FB-V02 & COM-FB-V03: Error handling preserves form drafts upon submission failure (1.0573ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
```

### Frontend Production Build
```bash
npm run build
```
**Result:**
```text
   ▲ Next.js 14.2.5
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (38/38)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
├ ○ /admin/enquiries                     3.4 kB          102 kB
├ ○ /admin/feedback                      3.64 kB         102 kB
├ ○ /contact                             5.03 kB         119 kB
...
Exit code: 0
```

---

## 5. Deployment & Runtime Limitations

1. **COM-ENQ-07 Rate-Limiting Behind Reverse Proxies (Unresolved / Awaiting Evidence):**
   - As mandated, no changes were made to `RateLimitingFilter.java` or `application-prod.yml`.
   - `request.getRemoteAddr()` continues to be used. If the production deployment is fronted by AWS ALB, Cloudflare, or an Nginx ingress without Tomcat `RemoteIpValve` or Spring `server.forward-headers-strategy`, all requests may share the ingress node's IP, triggering 429 throttling. This requires deployment infrastructure verification before modifying proxy header strategies.
2. **Physical Email Delivery:**
   - Unit tests use Mockito mocks for `EmailService.sendEmail`. Physical email delivery requires live Resend API keys and network connectivity in the target deployment environment. Safe isolation ensures that email transport issues will not break admin reply persistence.

---

## 6. Git Status & Working Tree Summary

### Modified in Phase 2:
- `backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java`
- `backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java`
- `backend/src/test/java/com/cakeplatform/api/modules/communication/PhaseGCommunicationTest.java`
- `frontend_v2/lib/api/communication.ts`
- `frontend_v2/app/contact/page.tsx`
- `frontend_v2/app/admin/enquiries/page.tsx`

### Created in Phase 2:
- `frontend_v2/__tests__/contactEnquiriesErrorHandling.test.mjs`
- `CAKESTORE_COMMUNICATION_PHASE2_IMPLEMENTATION_REPORT.md`

All pre-existing working tree modifications and untracked artifacts from previous phases remain intact. No commits, pushes, or deployments were performed.
