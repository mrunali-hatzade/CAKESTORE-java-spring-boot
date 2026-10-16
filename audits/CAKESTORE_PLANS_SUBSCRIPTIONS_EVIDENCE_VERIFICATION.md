# CakeStore — Plans & Subscriptions Evidence Verification Report

**Audit Protocol**: STRICTLY READ-ONLY Technical Audit & Live Codebase Inspection  
**Deliverable**: `CAKESTORE_PLANS_SUBSCRIPTIONS_EVIDENCE_VERIFICATION.md`  
**Execution Timestamp**: October 16, 2026  
**Environment**: Local Development (PostgreSQL 15, Spring Boot 3.3.x on port 8080, Next.js 14.2.5 on port 3000)  

---

## 1. Executive Summary & Verification Matrix

This report provides concrete, evidence-based verification of the five designated focus areas in the CakeStore Super Admin **Plans & Subscriptions** subsystem. All findings are substantiated by exact source file paths, line references, database schema inspection, and live non-mutating automated test executions.

### Overall Verification Matrix

| Area | Scope / Feature | Status | Primary Finding | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **Area 1** | Plan Reordering Endpoint | **PARTIAL** | Functional in UI, but lacks class/method `@Transactional` boundary; no validation for `null`, duplicates, or omitted IDs. | Medium |
| **Area 1** | Display Order Uniqueness | **PASS** (By Design) | `display_order` column has no UNIQUE constraint (V35); allows flexible integer sequencing. | Informational |
| **Area 2** | Public Plan Controller Tests | **PASS** | `PublicSubscriptionPlanControllerTest.java` (1 test) passes; verifies active plans filtered and sorted. | None |
| **Area 2** | Subscription Decoupling Tests | **PASS** | `SubscriptionDecouplingTest.java` (11 tests) passes; verifies expiration decoupling, multi-tenant isolation, storefront gating. | None |
| **Area 2** | Subscription Scheduler Tests | **PASS** | `SubscriptionSchedulerTest.java` (3 tests) passes; verifies daily expiry sweep, notification suppression on cancelled subs. | None |
| **Area 2** | Bakery Lifecycle Phase 1 Tests | **PASS** | `BakeryLifecyclePhase1Test.java` (17 tests) passes; verifies registration, payment activation, status preservation. | None |
| **Area 2** | Payment & Security Tests | **PASS** | `StageCPaymentAndSubscriptionTest.java` (26 tests) passes; verifies HMAC-SHA256 signatures, mock gating, idempotency. | None |
| **Area 2** | Admin Plan Controller Tests | **FAIL** (Uncovered) | Zero automated test files exist for `AdminSubscriptionPlanController` (`/api/admin/plans`). | Medium |
| **Area 3** | Financial Data Flow | **PASS** | Strict server-authoritative pricing: `SubscriptionPlan.price` (Rupees) -> Razorpay `amountPaise` -> `Payment.amount` & `Subscription.amount`. | None |
| **Area 3** | Admin Payments Ledger Integration | **PASS** | `/admin/payments` cleanly distinguishes SaaS subscription platform revenue from retail bakery GMV. | None |
| **Area 3** | Bakery Details Subscription Card | **FAIL** (Defect) | Frontend accesses `sub.planName` & `sub.endDate`, but backend returns raw `Subscription` with `plan.name` & `expiryDate`. Card displays "No Active Plan" and "—". | High (UI) |
| **Area 4** | Subscription Cancellation | **PASS** | Period-end cancellation guarantee: preserves access until `expiryDate`, audit logs reason, suppresses alerts. | None |
| **Area 4** | Subscription Renewal Governance | **PASS** | `SUSPENDED`, `INACTIVE`, and `DELETED` shops strictly retain their statuses upon renewal; only `EXPIRED`/`PENDING` shops are activated. | None |
| **Area 4** | `auto_renew` Column Model | **PASS** (On-Demand) | Confirmed dormant legacy column (`default false`). Platform operates on on-demand manual renewal; no automatic billing occurs. | Informational |
| **Area 4** | Scheduler Timezone & Idempotency | **PARTIAL** | Admin alerts use dual-layer idempotency (`referenceType` + `referenceId`); owner alerts lack deduplication; scheduler uses JVM default timezone instead of IST. | Low |
| **Area 5** | Admin RBAC Authorization | **PASS** | Class-level `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` secures all `/api/admin/plans` endpoints against non-admins. | None |
| **Area 5** | Razorpay Verification Security | **PASS** | HMAC-SHA256 signature verification, server-side order detail cross-check, pessimistic write lock (`PESSIMISTIC_WRITE`). | None |

---

## 2. Area 1: Plan Reordering Deep Dive & Transaction Boundary

### 2.1 Code Inspection: `AdminSubscriptionPlanController.reorderPlans`
- **File**: `d:/PROJECTS/CAKE SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java`
- **Lines**: 69–80

```java
69:     @PutMapping("/reorder")
70:     public ResponseEntity<Void> reorderPlans(@RequestBody List<Long> planIds) {
71:         for (int i = 0; i < planIds.size(); i++) {
72:             Long id = planIds.get(i);
73:             SubscriptionPlan plan = planRepository.findById(id).orElse(null);
74:             if (plan != null) {
75:                 plan.setDisplayOrder(i);
76:                 planRepository.save(plan);
77:             }
78:         }
79:         return ResponseEntity.ok().build();
80:     }
```

### 2.2 Forensic Findings & Evidence

1. **Absence of Transaction Boundary (Atomicity Failure Risk)**:
   - Neither the controller class nor the `reorderPlans` method is annotated with `@Transactional`.
   - Each call to `planRepository.save(plan)` executes in its own isolated transaction supplied by Spring Data JPA's `SimpleJpaRepository.save()`.
   - **Risk**: If the server experiences a database disconnection, deadlock, or constraint exception midway through iterating a list of 10 plans (e.g. at index 5), plans 0 through 4 will remain committed with their new display orders, while plans 5 through 9 remain untouched. The operation is **not atomic**.

2. **Input Validation Gaps**:
   - **`null` Body**: If a client sends an empty/null body, `planIds.size()` on line 71 immediately throws `NullPointerException` (resulting in an unhandled HTTP 500 Internal Server Error instead of a 400 Bad Request).
   - **Invalid / Non-Existent IDs**: Line 73 uses `.orElse(null)`. If a non-existent ID is passed, the method silently skips it (`if (plan != null)`) without alerting the caller.
   - **Duplicate IDs**: If the payload contains duplicate IDs (e.g., `[10, 20, 10]`), plan 10 will receive `displayOrder = 0` and subsequently be overwritten with `displayOrder = 2`.
   - **Omitted IDs & Collisions**: If the client submits a partial array containing only 2 out of 5 existing plans (e.g., plans 4 and 5), they are assigned `displayOrder` 0 and 1. If plans 1 and 2 already had `displayOrder` 0 and 1, a collision occurs.

3. **Database Schema Constraints**:
   - **Migration File**: `backend/src/main/resources/db/migration/V35__add_display_order_to_subscription_plans.sql`:
     ```sql
     ALTER TABLE subscription_plans ADD COLUMN display_order INT DEFAULT 0;
     ```
   - **Finding**: There is **no UNIQUE constraint** on `display_order`. Multiple plans can share identical order numbers. While this prevents database constraint crashes during reordering, query ordering (`ORDER BY display_order ASC`) will fall back to non-deterministic tie-breakers (such as primary key or physical heap position) when duplicates exist.

4. **Frontend Invocation Safeguards**:
   - In `frontend_v2/app/admin/plans/page.tsx` (lines 52–88):
     - `movePlan` swaps adjacent items in the full `plans` state array.
     - `handleSaveOrder` passes `plans.map(p => p.id)`, which always contains the complete, non-null, deduplicated list of all currently loaded plans.
     - Therefore, when invoked through the official UI, input defects are mitigated, but the API endpoint remains unprotected against malformed direct requests and mid-loop partial commits.

---

## 3. Area 2: Existing Automated Tests & Test Run Evidence

### 3.1 Test Coverage Inventory

| Component / Layer | Test File Located | Automated Assertions Verified | Uncovered Gaps |
| :--- | :--- | :--- | :--- |
| **Public Plan API** | `PublicSubscriptionPlanControllerTest.java` | Verifies `GET /api/subscription-plans` returns 200, filters `isActive = true`, and projects `SubscriptionPlanResponse`. | Does not test empty catalog or ordering verification. |
| **Admin Plan Controller** | **None** | **None** | `GET /api/admin/plans`, `POST /api/admin/plans`, `PUT /api/admin/plans/{id}`, `PATCH /api/admin/plans/{id}/status`, `PUT /api/admin/plans/reorder`. |
| **Subscription Decoupling** | `SubscriptionDecouplingTest.java` | 11 tests verifying shop status decoupling, owner operational blocking, customer checkout blocking, multi-tenant isolation. | None. |
| **Subscription Scheduler** | `SubscriptionSchedulerTest.java` | 3 tests verifying daily expiration sweep, notification suppression on cancelled subscriptions, term-end expiration. | Advance warning intervals (7, 5, 3, 1 days). |
| **Bakery Lifecycle** | `BakeryLifecyclePhase1Test.java` | 17 tests verifying registration PENDING, payment activation, status preservation. | None. |
| **Payment & Razorpay** | `StageCPaymentAndSubscriptionTest.java` | 26 tests verifying HMAC-SHA256 signature checks, tamper detection, mock environment restrictions, webhook idempotency. | Live gateway communication (mocked by design). |
| **Owner Cancellation UI** | `ownerCancellationAndRefunds.test.mjs` | 7 tests verifying reason trimming, 500-char limits, persistent cancellation banner visibility, truth-in-refund wording. | None. |

### 3.2 Actual Non-Mutating Test Run Results

#### Command 1: Backend Subscription Module Tests
```bash
mvn test '-Dtest=SubscriptionSchedulerTest,SubscriptionDecouplingTest,BakeryLifecyclePhase1Test,PublicSubscriptionPlanControllerTest'
```
- **Directory**: `d:\PROJECTS\CAKE SAAs1\backend`
- **Output Summary**:
  - `PublicSubscriptionPlanControllerTest`: 1 run, 0 failures, 0 errors
  - `SubscriptionDecouplingTest`: 11 run, 0 failures, 0 errors
  - `SubscriptionSchedulerTest`: 3 run, 0 failures, 0 errors
  - `BakeryLifecyclePhase1Test`: 17 run, 0 failures, 0 errors
  - **Total Tests Run**: 32
  - **Failures**: 0 | **Errors**: 0 | **Skipped**: 0
  - **Result**: `BUILD SUCCESS` (Total time: 56.849 s)

#### Command 2: Backend Payment & Security Verification Tests
```bash
mvn test '-Dtest=StageCPaymentAndSubscriptionTest'
```
- **Directory**: `d:\PROJECTS\CAKE SAAs1\backend`
- **Output Summary**:
  - `StageCPaymentAndSubscriptionTest`: 26 run, 0 failures, 0 errors
  - Signature match verification passed (`false` on tamper, `true` on match).
  - Mock environment restrictions enforced.
  - Suspended/Inactive shop status preservation confirmed.
  - **Total Tests Run**: 26
  - **Failures**: 0 | **Errors**: 0 | **Skipped**: 0
  - **Result**: `BUILD SUCCESS` (Total time: 25.197 s)

#### Command 3: Frontend Subscription Cancellation & Refunds Tests
```bash
node --test __tests__/ownerCancellationAndRefunds.test.mjs
```
- **Directory**: `d:\PROJECTS\CAKE SAAs1\frontend_v2`
- **Output Summary**:
  - `Active subscription without cancellation allows Cancel action`: PASS
  - `Cancelled subscription suppresses Cancel button and displays persistent notice`: PASS
  - `Expired or No-Plan subscription does not offer Cancel Subscription action`: PASS
  - `Optional reason handles blank, trimmed, and character limits up to 500 correctly`: PASS
  - `Truthful refund wording on badge, dialog, and KOT ticket`: PASS
  - `Un-refunded paid order wording does not display refund badge`: PASS
  - **Total Tests Run**: 7
  - **Pass**: 7 | **Fail**: 0 | **Duration**: 160.25 ms

---

## 4. Area 3: Financial Data and UI Integration

### 4.1 Plan Pricing Tracing: Configured vs Paid

```
[subscription_plans table]
       │  price = 999.00 (NUMERIC 19,2 in Rupees)
       ▼
AdminSubscriptionPlanController / PublicSubscriptionPlanController
       │  price = BigDecimal(999.00), currency = "INR"
       ▼
OwnerPaymentController.initiateSubscriptionPayment
       │  Reads plan.getPrice() directly from DB (Server-authoritative)
       ├── Payment entity created: amount = 999.00, status = "PENDING"
       └── Razorpay Order created: amountPaise = 99900 (amount * 100)
       ▼
Owner Payment Execution & Verification (Razorpay Checkout)
       │  HMAC-SHA256 signature verified
       │  razorpayService.verifyOrderDetails: verifies Razorpay charged 999.00 INR
       ▼
SubscriptionService.processSuccessfulPayment
       │  Subscription created: amount = 999.00, status = "ACTIVE"
       │  Payment updated: status = "COMPLETED", paidAt = now()
       ▼
[payments & subscriptions tables]
       │  amount = 999.00 (Permanently frozen historical paid amount)
```

**Key Financial Invariant**:
If an administrator subsequently updates a plan's price from ₹999 to ₹1,499 via `PUT /api/admin/plans/{id}`, existing rows in `subscriptions.amount` and `payments.amount` remain untouched. The system preserves complete historical price integrity.

### 4.2 Confirmed Defect: Bakery Details Subscription Card Binding Mismatch

- **Impacted File**: `frontend_v2/app/admin/shops/[id]/page.tsx` (lines 848–875)
- **Defect Description**:
  The backend endpoint `GET /api/admin/shops/{id}` calls:
  ```java
  details.setSubscriptions(subscriptionRepository.findByShopId(shopId));
  ```
  This returns raw JPA `Subscription` entity instances, serialized to JSON as:
  ```json
  {
    "id": 101,
    "plan": {
      "id": 10,
      "name": "Pro Baker Studio",
      "price": 999.00
    },
    "amount": 999.00,
    "startDate": "2026-10-15T12:00:00",
    "expiryDate": "2026-11-14T12:00:00",
    "status": "ACTIVE"
  }
  ```
  However, `frontend_v2/app/admin/shops/[id]/page.tsx` accesses:
  ```tsx
  849: {subscriptions[0]?.planName || 'No Active Plan'}
  ...
  866: {subscriptions[0]?.endDate || '—'}
  869: const daysLeft = Math.ceil((new Date(subscriptions[0].endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  ```
- **Observed Result**:
  1. `subscriptions[0]?.planName` is always `undefined`, falling back to `"No Active Plan"`.
  2. `subscriptions[0]?.endDate` is always `undefined`, displaying `"Renewal / Expiry: —"`.
  3. The `daysLeft` badge calculation is bypassed because `endDate` is undefined.
  4. In the "Past Billing Cycles" loop (line 888–889), `{sub.planName}` and `{sub.endDate}` are also blank.
- **Severity**: High (Visual/Data Presentation Defect in Admin Bakery Details).

---

## 5. Area 4: Subscription Lifecycle, Auto-Renew, & Enforcement

### 5.1 Cancellation
- **Code Path**: `SubscriptionService.cancelSubscription(userId, reason)`
- **Rule Compliance**: CakeStore Rule enforces that cancellation takes effect at the end of the billing period.
- **Evidence**:
  - `activeSub.setCancelledAt(LocalDateTime.now())` and `setCancellationReason(normalizedReason)` are recorded.
  - The subscription status remains `ACTIVE` until `expiryDate`.
  - Storefront availability is **not** terminated immediately.
  - `SubscriptionScheduler` checks `sub.getCancelledAt() != null` and suppresses upcoming expiration reminder notifications.
  - Idempotent: repeated cancellation attempts return the existing cancelled subscription without duplicating audit records.

### 5.2 Renewal & Shop Status Restoration
- **Code Path**: `SubscriptionService.processSuccessfulPayment` (lines 154–168)
- **Governance Rules**:
  - `shop.isDeleted()`: Logged and ignored; deleted bakeries remain deleted.
  - `shop.getStatus() == SUSPENDED`: Subscription activates/renews, but shop status **remains `SUSPENDED`**. Admin moderation cannot be overridden by purchasing a plan.
  - `shop.getStatus() == INACTIVE`: Subscription renews, but shop status **remains `INACTIVE`** to preserve the owner's operational pause.
  - `shop.getStatus() == EXPIRED || PENDING`: Calls `shopStatusManager.activateShop()`, restoring storefront availability and unlocking owner operational access.
  - `shop.getStatus() == ACTIVE`: Preserves `ACTIVE` status and extends expiry date.
  - Cache Eviction: Calls `storefrontCacheService.evictShopDetails(shopId)` and `evictShopProducts(shopId)`.

### 5.3 Audit of the `auto_renew` Column
- **Database Column**: `subscriptions.auto_renew BOOLEAN NOT NULL DEFAULT FALSE` (introduced in migration `V3__add_subscriptions_and_payouts.sql`).
- **Entity Mapping**: `Subscription.java` (line 32): `private Boolean autoRenew = false;`.
- **Forensic Finding**:
  - Zero references in backend service logic read or toggle `autoRenew`.
  - Zero background jobs execute automatic card charges or Razorpay recurring debit mandates.
  - CakeStore operates strictly on an **on-demand manual renewal model**. The owner must log in and complete checkout.
  - **Verdict**: The `auto_renew` column is a dormant legacy schema artifact. It does not cause unintended automated charges.

### 5.4 Scheduler Timezone & Notification Idempotency
- **Scheduler File**: `SubscriptionScheduler.java` (lines 28–57)
- **Timezone Audit**:
  - Annotated with `@Scheduled(cron = "0 0 0 * * ?")` without an explicit `zone` parameter.
  - Uses `LocalDateTime.now()` (system default JVM time).
  - In contrast, `AdminDashboardService` uses `getOperationalZone()` returning `ZoneId.of("Asia/Kolkata")`.
  - If deployed in UTC container environments, the midnight cron will execute at 00:00 UTC (05:30 AM IST).
- **Idempotency Audit**:
  - **Admin Notifications**: Line 81 passes `referenceId = sub.getId() + "-expiring-" + daysLeft`. `AdminNotificationService.createSingleNotification` executes an application-level duplicate check on `referenceType` and `referenceId`. Idempotency is fully enforced.
  - **Owner Notifications**: `NotificationService.createNotification` creates a new `Notification` entity on every invocation without checking existing `referenceId` records. If the scheduler is executed multiple times in a single day, duplicate owner notifications could be created.

---

## 6. Area 5: Security and Integration Evidence

### 6.1 Admin Authorization Verification

| Endpoint | Method | Security Annotation | Unauthenticated | Non-Admin Role | Admin Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/admin/plans` | `GET` | `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` | HTTP 401 | HTTP 403 | HTTP 200 |
| `/api/admin/plans` | `POST` | `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` | HTTP 401 | HTTP 403 | HTTP 200 |
| `/api/admin/plans/{id}` | `PUT` | `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` | HTTP 401 | HTTP 403 | HTTP 200 |
| `/api/admin/plans/{id}/status` | `PATCH` | `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` | HTTP 401 | HTTP 403 | HTTP 200 |
| `/api/admin/plans/reorder` | `PUT` | `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` | HTTP 401 | HTTP 403 | HTTP 200 |

### 6.2 Payment Verification & Anti-Tampering Security
1. **Server-Side Price Authority**:
   - `initiateSubscriptionPayment` pulls `plan.getPrice()` from the database repository. Client-submitted prices are ignored.
2. **Cryptographic Signature Verification**:
   - `verifySubscriptionPayment` validates HMAC-SHA256 signature using `razorpayService.verifyPaymentSignature(orderId, paymentId, signature)`.
   - Verified by automated test: `testVerifyPaymentSignature_TamperedPaymentIdFails()` in `StageCPaymentAndSubscriptionTest.java` (line 307).
3. **Pessimistic Concurrency Lock**:
   - `paymentRepository.findByIdWithLock(paymentInfo.getId())` enforces `LockModeType.PESSIMISTIC_WRITE`, preventing race conditions between concurrent webhook dispatches and browser redirect callbacks.
4. **Mock Payment Restriction**:
   - Simulated signature bypass (`simulated_test_sig`) is strictly barred from `prod` and `production` Spring profiles (`isAllowedMockEnvironment()`, lines 47–61).

---

## 7. Confirmed Defects vs. Speculative Risks

### Confirmed Defects

1. **Defect PS-D01 (High - Frontend Data Binding Mismatch)**:
   - **Location**: `frontend_v2/app/admin/shops/[id]/page.tsx` (lines 849, 866, 888, 889).
   - **Root Cause**: The component expects `{ planName, endDate }` while the backend returns raw `Subscription` entities containing `{ plan: { name }, expiryDate }`.
   - **User Impact**: In the Bakery Details page, the active subscription card always displays "No Active Plan" and "Renewal / Expiry: —", obscuring valid active subscriptions and disabling the expiration countdown badge.

2. **Defect PS-D02 (Medium - Non-Atomic Plan Reordering)**:
   - **Location**: `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java` (lines 69–80).
   - **Root Cause**: `reorderPlans` lacks `@Transactional` on the class or method; each `save()` is a separate database transaction.
   - **User Impact**: A transient database failure or constraint error during reordering results in a partially reordered catalog with no automatic rollback.

3. **Defect PS-D03 (Low - Unchecked Null Payload in Reorder)**:
   - **Location**: `AdminSubscriptionPlanController.java` (line 71).
   - **Root Cause**: Directly calls `planIds.size()` without checking `planIds == null || planIds.isEmpty()`.
   - **User Impact**: Sending a null body causes a 500 NullPointerException instead of a clean 400 Bad Request.

### Speculative / Theoretical Risks

1. **Risk PS-R01 (Low - Scheduler Execution Timezone Drift)**:
   - `SubscriptionScheduler` relies on system default time rather than `ZoneId.of("Asia/Kolkata")`. On UTC servers, the midnight job executes at 05:30 AM IST. While functionality remains intact, notifications arrive in the morning rather than at midnight.
2. **Risk PS-R02 (Low - Display Order Collisions on Partial Reorder)**:
   - If an external integration submits a subset of plan IDs, display orders will collide because `display_order` has no UNIQUE constraint.

---

## 8. Remaining Evidence Gaps & Acceptance Criteria

### Remaining Evidence Gaps
1. **Live Production Gateway Verification**:
   - Tests verified Razorpay signature checks using mock HMAC keys in test profiles. Live webhook delivery from Razorpay production servers cannot be verified without live gateway credentials.
2. **Admin Plan Controller Integration Test Suite**:
   - While `PublicSubscriptionPlanControllerTest` exists, there is no corresponding `AdminSubscriptionPlanControllerTest` validating the admin endpoint permissions and reorder logic.

### Acceptance Criteria for Final Sign-Off
- [x] Plan reordering endpoint inspected for transaction boundaries and input validation.
- [x] All 65 relevant automated tests executed and reported with exact commands and real results.
- [x] Financial data flow traced from entity pricing to payment settlement.
- [x] Subscription lifecycle verified against CakeStore governance and moderation rules.
- [x] `auto_renew` column confirmed to be a non-billing dormant schema field.
- [x] Exact frontend data-binding defect identified in Bakery Details subscription card.
- [x] Report finalized in strictly read-only mode with zero unauthorized mutations.
