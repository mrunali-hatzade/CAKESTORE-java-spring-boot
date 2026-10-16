# CAKESTORE Communication – Phase 2 Repair Plan

**Author:** Antigravity Agentic Pair Programmer  
**Date:** 2026‑10‑16

---

## 1. Findings Matrix & Confirmation Status
| ID | Finding (as defined) | Source‑Level Evidence | Runtime‑Verified | Status (✅ Ready / 🟡 Pending / ❌ Out‑of‑Scope) |
|---|---|---|---|---|
| **COM‑ENQ‑01** | Admin reply false‑success – HTTP 404/500 suppressed, draft erased | `frontend_v2/lib/api/communication.ts` (lines 97‑106) & `frontend_v2/app/admin/enquiries/page.tsx` (lines 96‑110) | Verified by code review – no runtime test covering this path | 🟡 Pending (requires code change) |
| **COM‑ENQ‑02** | Public contact form false‑success – synthetic success on any error, catch forces submitted state | `frontend_v2/lib/api/communication.ts` (lines 49‑58) & `frontend_v2/app/contact/page.tsx` (lines 24‑41) | Verified by code review – UI always shows “Message Sent” even on failure | 🟡 Pending |
| **COM‑ENQ‑03** | Email failure may abort reply transaction (email call before DB update, no try‑catch) | `backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java` (lines 93‑106) | No runtime test exercising failure path – only success path covered in Phase 1 | 🟡 Pending |
| **COM‑ENQ‑04** | Existing reply history never displayed in admin UI | Entity `ContactEnquiry` (lines 49‑52) + migration `V40` + TypeScript type `ContactEnquiry` (lines 40‑41) but UI (`enquiries/page.tsx` lines 334‑368) never renders `adminReply`/`repliedAt` | UI omission verified by inspection | 🟡 Pending |
| **COM‑ENQ‑05** | No activity‑logging for read/reply actions on enquiries | `ContactEnquiryService` lacks `ActivityLoggerService`; `AdminCommunicationController` does not receive `@AuthenticationPrincipal` for these endpoints | No logs recorded in `activity_logs` for enquiry actions | 🟡 Pending |
| **COM‑ENQ‑06** | Regression test gaps – no backend or frontend tests for reply persistence, error propagation, or draft preservation | `PhaseGCommunicationTest.java` covers submission & mark‑read only (lines 380‑550) – zero tests for `replyToEnquiry` or UI error handling | Test suite missing these scenarios | 🟡 Pending |
| **COM‑ENQ‑07** | Rate‑limiting uses `request.getRemoteAddr()` – may be inaccurate behind proxies; deployment topology unknown | `RateLimitingFilter.java` lines 62‑69 register `/api/contact/enquiries` as Sensitive endpoint with 20 req/min per IP. No forward‑header config in `application.yml`/`application‑prod.yml`. | No runtime evidence; could cause global throttling. | ❓ Unresolved – requires deployment info |

---

## 2. Files & Methods Affected
| Concern | File (clickable) | Class / Function | Scope of Change |
|---|---|---|---|
| **COM‑ENQ‑01** | [frontend_v2/lib/api/communication.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts) | `replyToEnquiry(id, message)` | Remove 404/500 suppression; propagate real errors. |
| | [frontend_v2/app/admin/enquiries/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx) | `handleSendReply` | Only clear draft on successful response; keep UI draft on error and surface toast. |
| **COM‑ENQ‑02** | [frontend_v2/lib/api/communication.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts) | `submitContactEnquiry(payload)` | Remove synthetic success fallback. |
| | [frontend_v2/app/contact/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/contact/page.tsx) | `handleSubmit` | Do not set `submitted` on catch; expose error message, retain form values. |
| **COM‑ENQ‑03** | [backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java) | `replyToEnquiry(Long id, String replyMessage)` | Wrap email dispatch in `try‑catch`; ensure DB update occurs regardless of email failure. |
| **COM‑ENQ‑04** | [frontend_v2/app/admin/enquiries/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx) | Reading pane JSX (lines 334‑368) | Render `adminReply` and `repliedAt` when present (styled similarly to message block). |
| **COM‑ENQ‑05** | [backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java) | Service class | Inject `ActivityLoggerService` and call it for read and reply actions. |
| | [backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java) | `replyToEnquiry` & `markEnquiryRead` endpoints | Add `@AuthenticationPrincipal CustomUserDetails userDetails` parameter, forward admin ID to service. |
| **COM‑ENQ‑06** | Backend test file | `PhaseGCommunicationTest.java` | Add tests for reply persistence, email‑failure isolation, activity‑log verification. |
| | Frontend test folder | New test files (e.g., `adminEnquiriesReplyError.test.mjs`, `contactFormErrorHandling.test.mjs`) | Verify UI retains draft on API error and surfaces proper toast/message. |
| **COM‑ENQ‑07** | Backend config | `application.yml` / `application-prod.yml` | Potential addition of `server.forward-headers-strategy` **only if** deployment evidence confirms reverse‑proxy use. |

---

## 3. Root Causes & Minimum Safe Corrections
### COM‑ENQ‑01 – Admin Reply False‑Success
- **Root Cause:** `communicationApi.replyToEnquiry` catches 404/500 and resolves the promise; UI (`handleSendReply`) treats any resolved promise as success and clears the draft.
- **Safe Correction:**
  1. Delete the `try { … } catch` block in `replyToEnquiry`; let non‑2xx responses throw.
  2. In `handleSendReply`, move `setReplyText('')` and `setIsReplying(false)` into the `try` branch **only** after the await succeeds. In the `catch` branch, keep `replyText` unchanged and display `toast.error(err?.message || 'Failed to send reply')`.

### COM‑ENQ‑02 – Public Contact Form False‑Success
- **Root Cause:** API client fabricates a success object on 404/500; component catch forces `submitted` state regardless of error.
- **Safe Correction:**
  1. Remove the synthetic return in `submitContactEnquiry`; allow the promise to reject on any non‑2xx status.
  2. Add an `errorMessage` state in `ContactPage`. In the `catch` block, set the error state, **do not** set `submitted`, and keep the form fields untouched so the user can retry.

### COM‑ENQ‑03 – Email Failure Isolation
- **Root Cause:** `replyToEnquiry` invokes `emailService.sendEmail` **before** persisting the reply, with no exception handling; a failure aborts the transaction.
- **Safe Correction:**
  1. Reorder: first set `adminReply`, `repliedAt`, `isRead`, and `save` the entity.
  2. Then fire `emailService.sendEmail` inside a `try {…} catch (Exception ex)` that logs the failure (already async) but does **not** roll back the DB transaction.
  3. Keep the method annotated `@Transactional` – the DB update will commit regardless of email outcome.

### COM‑ENQ‑04 – Existing Reply History Not Shown
- **Root Cause:** UI rendering logic never checks `selectedEnquiry.adminReply` or `selectedEnquiry.repliedAt`.
- **Safe Correction:** Insert a conditional block after the message `<div className="prose…">{selectedEnquiry.message}</div>` that, when `selectedEnquiry.adminReply` is truthy, displays a styled “Admin Reply” section with timestamp (formatted via the same `formatDateTime` helper) and the reply text.

### COM‑ENQ‑05 – Missing Activity Logging
- **Root Cause:** Service lacks `ActivityLoggerService`; controller does not expose the admin user ID to the service.
- **Safe Correction:**
  1. Add a `private final ActivityLoggerService activityLogger;` field with constructor injection.
  2. Extend `replyToEnquiry` signature to accept `Long adminUserId` (passed from controller). After persisting the reply, call `activityLogger.logAdminReply(adminUserId, id, replyMessage)` (mirroring Platform Feedback pattern).
  3. Similarly, modify `markEnquiryRead` to accept `adminUserId` and log the read action.

### COM‑ENQ‑06 – Regression Test Gaps
- **Root Cause:** Test suite only covers submission and mark‑read.
- **Safe Correction:** Add targeted unit/integration tests:
  - **Backend:**
    - `testReplyToEnquiry_Success()` – asserts reply fields persisted, email service called, activity logger invoked.
    - `testReplyToEnquiry_EmailFailure_Isolated()` – mock `emailService.sendEmail` to throw; verify DB still updated and no rollback.
    - `testReplyToEnquiry_ActivityLog()` – verify logger called with correct admin ID.
  - **Frontend:**
    - `adminEnquiriesReplyError.test.mjs` – mock API to return 500; ensure UI keeps draft and shows error toast.
    - `contactFormErrorHandling.test.mjs` – mock API to return 429; ensure form remains populated and error message displayed.

### COM‑ENQ‑07 – Rate‑Limiting Deployment Verification
- **Root Cause Uncertainty:** The filter uses `request.getRemoteAddr()`. If the app sits behind a reverse proxy without proper `ForwardedHeaderFilter` or `server.forward-headers-strategy`, all external callers could appear under a single IP, causing premature throttling.
- **Evidence Needed:** Runtime access to the deployment descriptor (e.g., Kubernetes Ingress, Cloudflare settings) or logs showing `X‑Forwarded‑For` headers. If unavailable, list as an **open question**.
- **Potential Safe Action (if verified needed):** Add `server.forward-headers-strategy: framework` to `application-prod.yml` and configure trusted proxy CIDRs in a `ForwardedHeaderFilter`. **Do not** propose this change until deployment evidence confirms the problem.

---

## 4. Dependency‑Ordered Implementation Plan (Phase 2)
| Step | Work Item | Files Modified | Owner | Notes |
|---|---|---|---|---|
| **1** | Remove synthetic success handling in public API client | `frontend_v2/lib/api/communication.ts` | Frontend dev | Ensure all callers propagate errors. |
| **2** | Update Contact page error handling | `frontend_v2/app/contact/page.tsx` | Frontend dev | Add `errorMessage` state, keep form values on error. |
| **3** | Remove 404/500 suppression in admin reply client | `frontend_v2/lib/api/communication.ts` (reply method) | Frontend dev | Same file as Step 1. |
| **4** | Adjust admin reply UI draft preservation | `frontend_v2/app/admin/enquiries/page.tsx` | Frontend dev | Move draft clearing into success path only. |
| **5** | Add reply‑history rendering to admin reading pane | `frontend_v2/app/admin/enquiries/page.tsx` | Frontend dev | Use existing `formatDateTime`. |
| **6** | Reorder DB update and wrap email in try‑catch in service | `backend/src/main/java/com/cakeplatform/api/modules/communication/ContactEnquiryService.java` | Backend dev | Keep `@Transactional`. |
| **7** | Inject `ActivityLoggerService` into service & controller, add adminUserId param | `ContactEnquiryService.java`, `AdminCommunicationController.java` | Backend dev | Follow Platform Feedback pattern (see Phase 1 report). |
| **8** | Add backend unit/integration tests for reply flow | `PhaseGCommunicationTest.java` (new methods) | QA / Backend dev | Use Mockito `doThrow` for email failure test. |
| **9** | Add frontend Jest/Vitest tests for error handling | New files under `frontend_v2/__tests__/` | QA / Frontend dev | Mock `apiClient` responses. |
| **10** | Run full test suite; confirm all new tests pass. | – | CI pipeline | Ensure no regression. |
| **11** | **Optional** (pending evidence): Adjust rate‑limiting forward‑header strategy in `application‑prod.yml`. | `backend/src/main/resources/application-prod.yml` | Ops / Backend dev | Only if deployment topology confirms need. |

*All steps are read‑only until explicit approval; no code is written yet.*

---

## 5. Regression Test Blueprint
### Backend (JUnit + Mockito)
- **Test Class:** `ContactEnquiryServiceTest`
- **Methods:**
  - `testReplyToEnquiry_Success()` – verify `adminReply`, `repliedAt`, `isRead` persisted; `emailService.sendEmail` called once; `activityLogger.logAdminReply` invoked.
  - `testReplyToEnquiry_EmailFailure_Isolated()` – mock `emailService.sendEmail` to throw; expect DB update still committed, no exception propagated, activity log still recorded.
  - `testMarkEnquiryRead_LogsActivity()` – ensure `activityLogger.logEnquiryRead(adminId, enquiryId)` called.
- **Assertions:** `assertEquals`, `assertNotNull`, `verify(emailService).sendEmail(...)`, `verify(activityLogger).log…`.

### Frontend (Vitest / Jest)
- **File:** `adminEnquiriesReplyError.test.mjs`
  - Mock `communicationApi.replyToEnquiry` to reject with `status:500`.
  - Simulate selecting an enquiry, typing a reply, clicking **Send Reply**.
  - **Assertions:** Draft textarea still contains original text; `toast.error` called with appropriate message; no navigation occurs.

- **File:** `contactFormErrorHandling.test.mjs`
  - Mock `communicationApi.submitContactEnquiry` to reject with `status:429`.
  - Fill the contact form, submit.
  - **Assertions:** Form fields retain user input; error banner with “Rate limit exceeded” displayed; `submitted` flag remains `false`.

- **File:** `adminEnquiriesReplyHistory.test.mjs`
  - Provide a mock enquiry object containing `adminReply` and `repliedAt`.
  - Verify that the reading pane renders a distinct “Admin Reply” section with correct timestamp and message.

---

## 6. Rate‑Limiting Configuration Risks & Outstanding Evidence
| Question | Current Evidence | Gap | Recommendation |
|---|---|---|---|
| Does the deployment sit behind a reverse proxy that strips/rewrites the client IP? | `RateLimitingFilter` uses `request.getRemoteAddr()`. No `server.forward-headers-strategy` in config files. | No visibility into actual ingress (e.g., AWS ALB, Cloudflare). | Request deployment diagram / ingress configuration from ops. If a proxy is present, consider adding `server.forward-headers-strategy: framework` and configuring trusted proxy CIDRs. Until then, **do not modify** rate‑limiting logic. |
| Are the 20 req/min limits for the public contact endpoint appropriate for production traffic? | Defined in `RateLimitingFilter` (Sensitive endpoints). | No observed traffic metrics. | Capture runtime metrics (e.g., Prometheus counter) before adjusting limits. |

---

## 7. Rollback Considerations
- **Frontend changes** (API client, UI error handling) are isolated to component files; a simple revert of the modified files restores previous behavior.
- **Backend service reordering** is backward compatible: persisting the reply before email dispatch cannot cause regressions; the only change is added `try‑catch` which can be removed without side effects.
- **Activity logging injection** adds calls to an existing service; rolling back involves removing the injected bean and related log calls.
- **Database schema** already contains `admin_reply`/`replied_at`; no migration rollback needed.
- **Testing additions** are additive; removal reverts to original test suite.

---

## 8. Out‑of‑Scope Items
- Creation of new Flyway migrations (the schema already supports reply fields).
- Modifications to the Broadcast tab or any unrelated communication modules.
- Implementation of new API endpoints or DTOs beyond those already present.
- Deployment of production email delivery (Resend) or any changes to SMTP configuration.
- Any UI redesign beyond the minimal addition of reply history rendering.
- Changes to rate‑limiting that require altering the bucket size or overall policy without concrete deployment evidence.

---

**Prepared for review.** Awaiting explicit approval before any implementation steps are executed.
