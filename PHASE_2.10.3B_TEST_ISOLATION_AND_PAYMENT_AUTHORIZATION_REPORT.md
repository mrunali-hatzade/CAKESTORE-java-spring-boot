# Phase 2.10.3B — Integration Test Isolation & Payment Authorization Report

**Date:** 2026-11-07  
**Scope:** Integration Test Isolation Remediation & Payment Authorization Boundary Hardening  
**Status:** COMPLETED & VERIFIED  

---

## 1. Executive Summary

In Phase 2.10.2, an audit uncovered persistent record accumulation in the PostgreSQL staging database and identified test execution pollution as the primary driver behind historical count inflation between Phase 2.9.6 and Phase 2.10.1 (e.g. shops jumping from 43 to 113, users jumping from 102 to 370). Furthermore, payment authorization boundaries required verification to ensure role privilege separation and verify that development fallbacks cannot compromise staging or production.

In Phase 2.10.3B, all outstanding test isolation defects and authorization weaknesses were systematically remediated:
1. **Integration Test Isolation Restored:** `AdminSettingsSecurityE2ETest`, `AdminDocumentAccessSecurityTest`, and `AdminLedgerSecurityE2ETest` now feature deterministic, foreign-key-safe `@AfterEach` teardown, tracked entity IDs, and exact singleton baseline restoration.
2. **Global Settings Invariance:** The singleton `global_settings` table is snapshotted before execution, restored via native parameterized SQL in `@AfterEach`, and cache-cleared in `GlobalSettingsService` without credential exposure or drift.
3. **Customer Payment Authorization Boundary Hardened:** In `CustomerPaymentController.java`, blanket exemptions for `ROLE_ADMIN` and `ROLE_SHOP_OWNER` were removed. Customer payment verification strictly enforces customer mobile ownership (returning `403 Forbidden` if mismatched).
4. **Owner Subscription Fallback Hardened:** In `OwnerPaymentController.java`, `isAllowedMockEnvironment()` was locked down to only allow explicit non-production profiles (`test`, `dev`, `local`). Fallback to `placeholder` string heuristics was eliminated, and `staging`, `prod`, and `production` profiles strictly reject simulated signatures.
5. **Verified Zero Mutation:** Verified via before-and-after probe runs that executing the test suites leaves 0 residual database records and causes 0 settings drift.

---

## 2. Integration Test Isolation: Findings & Mutations

### A. `AdminSettingsSecurityE2ETest`
- **Tables Mutated:** `users`, `global_settings`.
- **Records Inserted/Updated:**
  - `users`: Inserted 3 users (`admin`, `owner`, `customer`) per test. With 18 test methods, 54 user rows were created without cleanup.
  - `global_settings`: In `@BeforeEach`, permanently overwrote singleton `id=1` with `rzp_test_initial_key_id` and test credentials. Multiple tests mutated `platform_currency` to `"USD"` and updated platform names.
  - `GlobalSettingsService.cachedSettings`: In-memory volatile cache retained test values across subsequent executions.
- **Commit/Rollback Requirements:** Required real database updates to test PUT validation and persistence across HTTP requests. Transactional rollback alone would not clear Spring in-memory cache or handle out-of-transaction singleton persistence.
- **Root Cause of Phase 2.10.2 Anomaly:** This test was the direct cause of `rzp_test_initial_key_id` being permanently stored in the `global_settings` database row!

### B. `AdminDocumentAccessSecurityTest`
- **Tables Mutated:** `users`, `shops`, `business_documents`.
- **Records Inserted/Updated:**
  - `users`: Inserted 4 users (`admin`, `ownerA`, `ownerB`, `customer`) per test method. With 13 tests, 52 users were persisted into the database.
  - `shops`: Inserted 2 shops (`shopA`, `shopB`) per test method. With 13 tests, 26 shops were persisted.
  - `business_documents`: Inserted 3 documents (`docShopA`, `docShopB`, `emptyFileDoc`) per test method. With 13 tests, 39 documents were persisted.
- **Commit/Rollback Requirements:** All 13 tests perform GET operations. However, no `@Transactional` or `@AfterEach` existed, so all `@BeforeEach` setup persisted permanently in PostgreSQL.

### C. `AdminLedgerSecurityE2ETest`
- **Tables Mutated:** `users`, `shops`, `orders`, `payments`.
- **Records Inserted/Updated:**
  - `users`: Inserted 3 users (`admin`, `owner`, `customer`) per test method. With 9 tests, 27 users were persisted.
  - `shops`: Inserted 1 shop per test method. With 9 tests, 9 shops were persisted.
  - `orders`: Inserted 1 order per test method. With 9 tests, 9 orders were persisted.
  - `payments`: Inserted 1 payment per test method. With 9 tests, 9 payments were persisted.
- **Commit/Rollback Requirements:** Tests perform GET operations on admin cross-shop ledger endpoints. Lack of `@AfterEach` teardown leaked orders, payments, shops, and users on every test run.

---

## 3. Implemented Isolation Strategies

### A. Strategy for `AdminSettingsSecurityE2ETest`
1. **Baseline Snapshot:** In `@BeforeEach`, query raw columns of `global_settings WHERE id = 1` into a snapshot map `baselineGlobalSettings`.
2. **ID Tracking:** Record all generated user IDs in `createdUserIds`.
3. **Deterministic `@AfterEach` Cleanup:**
   - Deletes all tracked test users: `DELETE FROM users WHERE id = ?`.
   - Restores raw baseline columns (`platform_name`, `support_email`, `razorpay_key_id`, `razorpay_key_secret`, `razorpay_webhook_secret`, `platform_currency`) via parameterized SQL.
   - Clears `GlobalSettingsService.cachedSettings` using reflection (`f.set(globalSettingsService, null)`) so subsequent services re-fetch authoritative baseline data.
   - Any failure during cleanup immediately fails the test via `Assertions.fail(...)`.

### B. Strategy for `AdminDocumentAccessSecurityTest`
1. **Entity Tracking:** Maintained `createdDocumentIds`, `createdShopIds`, and `createdUserIds`.
2. **Foreign-Key Safe Teardown:**
   - Step 1: `DELETE FROM business_documents WHERE id = ?`
   - Step 2: `DELETE FROM business_documents WHERE shop_id = ?` followed by `DELETE FROM shops WHERE id = ?`
   - Step 3: `DELETE FROM users WHERE id = ?`
3. **Fail-Visible Teardown:** Aggregates exceptions and asserts `fail()` if teardown encounters errors.

### C. Strategy for `AdminLedgerSecurityE2ETest`
1. **Entity Tracking:** Maintained `createdPaymentIds`, `createdOrderIds`, `createdShopIds`, and `createdUserIds`.
2. **Foreign-Key Safe Teardown:**
   - Step 1: `DELETE FROM payments WHERE id = ?`
   - Step 2: `DELETE FROM order_items WHERE order_id = ?` followed by `DELETE FROM orders WHERE id = ?`
   - Step 3: `DELETE FROM shops WHERE id = ?`
   - Step 4: `DELETE FROM users WHERE id = ?`
3. **Fail-Visible Teardown:** Errors immediately fail the test.

---

## 4. Before-and-After Database Verification

Direct probe verification was conducted before and after executing all three isolated test suites:

| Metric / Table | Baseline (Before Run) | After Individual Runs | After Combined Run (40 Tests) | Net Delta |
|---|---|---|---|---|
| **Users (`users`)** | 371 | 371 | 371 | **0** |
| **Shops (`shops`)** | 113 | 113 | 113 | **0** |
| **Orders (`orders`)** | 85 | 85 | 85 | **0** |
| **Payments (`payments`)** | 140 | 140 | 140 | **0** |
| **Documents (`business_documents`)** | 80 | 80 | 80 | **0** |
| **`platform_name`** | CakeStore Platform | CakeStore Platform | CakeStore Platform | **Exact match** |
| **`support_email`** | support@cakestore.test | support@cakestore.test | support@cakestore.test | **Exact match** |
| **`razorpay_key_id`** | rzp_test_initial_key_id | rzp_test_initial_key_id | rzp_test_initial_key_id | **Exact match** |
| **`platform_currency`** | INR | INR | INR | **Exact match** |

**Conclusion:** 100% database invariance achieved. Zero records accumulated and zero settings drifted across 40 test executions.

---

## 5. Customer Payment Authorization Review (Part B)

### Analysis of Previous Phase 2.10.3A Logic
In Phase 2.10.3A, `validatePaymentVerificationAuthorization(...)` included:
```java
// Check if caller is platform admin
boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
if (isAdmin) return;

// Check if caller is the shop owner of this shop
boolean isShopOwner = auth.getAuthorities().stream().anyMatch(a -> "ROLE_SHOP_OWNER".equals(a.getAuthority()));
if (isShopOwner && order.getShop() != null && order.getShop().getOwner() != null) {
    if (order.getShop().getOwner().getEmail().equalsIgnoreCase(auth.getName())) return;
}
```

### Authorization Review Findings
1. **Storefront Checkout Context:** `POST /api/storefront/orders/{orderNumber}/verify-payment` is exclusively invoked by the customer's browser upon completion of the Razorpay modal checkout (`StorefrontCheckoutTab.tsx:861`).
2. **No Legitimate Business Workflow for Admin/Owner Exemption:** Neither platform admins nor bakery owners perform customer checkout on the storefront. Bakery owners accept/reject orders in the owner portal (`/api/owner/orders`), and admins monitor orders via ledger (`/api/admin/orders`).
3. **Least Privilege Violation:** Granting blanket verification authorization to `ROLE_ADMIN` or `ROLE_SHOP_OWNER` bypassed phone matching, creating an unnecessary surface where an owner or admin could invoke customer verification for any order.
4. **Remediation Implemented:**
   - Removed blanket `ROLE_ADMIN` and `ROLE_SHOP_OWNER` bypasses in `validatePaymentVerificationAuthorization(...)`.
   - Now, ANY authenticated user must match `order.getCustomerPhone()`. Mismatched callers receive `403 Forbidden`.
   - Added programmatic overload `verifyCustomerPayment(String orderNumber, Map<String, String> payload)` to maintain full compatibility with internal testing and programmatic callers.
   - Added regression security tests:
     - `security_ShopOwnerCannotVerifyCustomerPayment_ReturnsForbidden`
     - `security_AdminCannotVerifyCustomerPaymentWithoutCustomerAuth_ReturnsForbidden`

---

## 6. Owner Subscription Fallback Security Review (Part C)

### Analysis of `isAllowedMockEnvironment()` in `OwnerPaymentController.java`
Previously:
```java
private boolean isAllowedMockEnvironment() {
    if (environment != null) {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return false;
            }
        }
        for (String profile : environment.getActiveProfiles()) {
            if ("test".equalsIgnoreCase(profile) || "dev".equalsIgnoreCase(profile) || "local".equalsIgnoreCase(profile)) {
                return true;
            }
        }
    }
    return razorpayService.getKeyId() != null && razorpayService.getKeyId().contains("placeholder");
}
```

### Defects Identified
1. **Staging Profile Vulnerability:** `staging` was omitted from the blacklist. If an environment ran under `spring.profiles.active=staging`, it bypassed the production block.
2. **Dangerous Heuristic Fallback:** Line 63 returned `true` if `keyId.contains("placeholder")` even when NO profile or an unexpected profile was active. If someone deployed placeholder keys into staging or cloud infrastructure, simulated signatures could activate real bakery subscriptions without payment.
3. **Remediation Implemented:**
   ```java
   private boolean isAllowedMockEnvironment() {
       if (environment == null) {
           return false;
       }
       for (String profile : environment.getActiveProfiles()) {
           if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile) || "staging".equalsIgnoreCase(profile)) {
               return false;
           }
       }
       for (String profile : environment.getActiveProfiles()) {
           if ("test".equalsIgnoreCase(profile) || "dev".equalsIgnoreCase(profile) || "local".equalsIgnoreCase(profile)) {
               return true;
           }
       }
       return false;
   }
   ```
4. **Behavioral Invariant:**
   - `prod`, `production`, and `staging` profiles STRICTLY reject simulated signatures.
   - Environments with no active profiles or unapproved profiles STRICTLY reject simulated signatures.
   - Only explicitly active `test`, `dev`, or `local` profiles may simulate signatures in non-production unit/integration testing.
   - Verified via new unit tests:
     - `testVerifySubscriptionPayment_SimulatedSignature_RejectedInStagingProfile`
     - `testVerifySubscriptionPayment_SimulatedSignature_RejectedWhenNoExplicitProfile`

---

## 7. Files Modified

| File | Change Description |
|---|---|
| `backend/src/test/java/com/cakeplatform/api/modules/settings/AdminSettingsSecurityE2ETest.java` | Added baseline settings snapshot, user tracking, and `@AfterEach` restoring database settings & clearing cache |
| `backend/src/test/java/com/cakeplatform/api/modules/shop/controller/AdminDocumentAccessSecurityTest.java` | Added tracking for documents, shops, users and `@AfterEach` foreign-key-safe deletion |
| `backend/src/test/java/com/cakeplatform/api/modules/admin/AdminLedgerSecurityE2ETest.java` | Added tracking for payments, orders, shops, users and `@AfterEach` foreign-key-safe deletion |
| `backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java` | Removed Admin/Owner blanket bypass in `validatePaymentVerificationAuthorization`; added 2-param convenience overload |
| `backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java` | Hardened `isAllowedMockEnvironment()`: blocked staging, removed placeholder fallback, fail-closed |
| `backend/src/test/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentControllerTest.java` | Added 2 security tests verifying Shop Owner and Admin 403 Forbidden on customer payment verification |
| `backend/src/test/java/com/cakeplatform/api/modules/payment/StageCPaymentAndSubscriptionTest.java` | Added 2 unit tests verifying staging profile and default profile reject simulated signatures |

---

## 8. Test Execution Results

### 1. Isolated Admin Integration Suites
- `AdminSettingsSecurityE2ETest`: **18/18 PASSED** (0 failures, 0 errors)
- `AdminDocumentAccessSecurityTest`: **13/13 PASSED** (0 failures, 0 errors)
- `AdminLedgerSecurityE2ETest`: **9/9 PASSED** (0 failures, 0 errors)
- **Combined Run:** **40/40 PASSED**

### 2. Payment & Authorization Suites
- `CustomerPaymentControllerTest`: **28/28 PASSED** (includes new Owner/Admin 403 security tests)
- `StageCPaymentAndSubscriptionTest`: **28/28 PASSED** (includes staging/default profile rejection tests)
- `OwnerPaymentControllerTest`: **13/13 PASSED**
- `CustomerOrderIdentitySecurityTest`: **5/5 PASSED**
- `RevenueSegregationE2ETest`: **5/5 PASSED**

### 3. Established Governance & Rollback Suites
- `AdminSubscriptionPlanRollbackIntegrationTest`: **3/3 PASSED**
- `AdminDashboardDateFilterTest`: **25/25 PASSED**

**Total Test Executions in Phase 2.10.3B:** **147 tests executed with 100% pass rate (0 failures, 0 errors).**

---

## 9. Invariance and Scope Confirmation

- **Razorpay Credentials:** Untouched. No keys or secrets were created, modified, or printed.
- **Environment Configuration:** No changes to `.env`, `.env.local`, Azure secrets, or Vercel configuration.
- **Database Records & Settings:** No changes to `global_settings` configuration values. No cleanup of existing historical test data was performed.
- **Live Payments:** No real payments or live gateway requests were initiated.

---

## 10. Unresolved Limitations & Recommendations for Subsequent Phases

1. **Historical Staging Data Cleanup (Requires Separate Approval):**
   The 371 users and 113 shops currently present in the shared database are historical artifacts from Phase 2.10.1 and earlier runs before test isolation was enacted. While no new artifacts are being created, cleanup of these historical rows should be performed under a dedicated migration/cleanup plan.
2. **Razorpay Key Resolver & Live Payment Gateway Configuration:**
   Resolving the database `global_settings` placeholder override vs. Azure environment variables remains deferred as specified in the Phase 2.10.2 audit plan.

---

## 11. Sign-off

Phase 2.10.3B is **COMPLETED**.
Execution stops here as instructed.
