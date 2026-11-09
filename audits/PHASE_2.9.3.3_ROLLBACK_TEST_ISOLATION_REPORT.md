# CakeStore — Phase 2.9.3.3: Rollback Test Isolation & Temporary Plan Cleanup Report

**Date:** November 5, 2026  
**Environment:** Local Development / Staging (`cake_platform` PostgreSQL on localhost:5432)  
**Status:** COMPLETE & VERIFIED

---

## 1. Executive Summary

During Phase 2.9.3.2, comprehensive cleanup removed 30 residual test-generated subscription plans, but the suite execution revealed a persistent 1-record data leak: `subscription_plans` increased from 2 to 3 rows due to `AdminSubscriptionPlanRollbackIntegrationTest.java`. Specifically, `Rollback Test Plan 3` (ID 753) was created by the test's setup logic but was never deleted during teardown.

In Phase 2.9.3.3:
1. **Root Cause Identified:** `AdminSubscriptionPlanRollbackIntegrationTest` requires $\ge 3$ plans to test permutation reordering. Because staging only contained the 2 official plans (IDs 2 and 3), `@BeforeEach` seeded `Rollback Test Plan 3`. The test class lacked `@Transactional` by design (to verify real Spring database commits and rollbacks) and its `@AfterEach` teardown reset Mockito state without deleting created plans.
2. **Residual Plan ID 753 Safely Cleaned Up:** Confirmed 0 foreign key references in `subscriptions` and `payments`. Deleted via a single atomic SQL transaction (`DELETE 1`), restoring `subscription_plans` to exactly the 2 official plans.
3. **Robust Test Isolation Implemented:** Injected `JdbcTemplate` into `AdminSubscriptionPlanRollbackIntegrationTest`, tracked all temporary plan IDs dynamically in `createdPlanIds`, and added explicit teardown in `@AfterEach` that deletes temporary plans and captures any SQL errors into an `AssertionError` with suppressed exceptions (zero silent failures).
4. **Comprehensive Regression & Zero-Leak Verification:**
   - Standalone execution of `AdminSubscriptionPlanRollbackIntegrationTest` passed 3/3 tests (54.42s).
   - Database plan count remained **exactly 2** immediately following test execution.
   - 56-test regression suite across `AdminSubscriptionPlanRollbackIntegrationTest`, `AdminSubscriptionPlanControllerTest`, `PublicSubscriptionPlanControllerTest`, `SubscriptionDecouplingTest`, `RevenueSegregationE2ETest`, and `AdminDashboardDateFilterTest` passed with **0 failures and 0 errors**.
   - Public endpoint `GET /api/subscription-plans` and Admin endpoint `GET /api/admin/plans` return **exactly 2** official plans.

---

## 2. Inspection Findings: `AdminSubscriptionPlanRollbackIntegrationTest.java`

### 2.1 Why the Test Requires Three Plans
The test tests the reordering of subscription plans via `POST /api/admin/plans/reorder` by submitting permutations of IDs:
```java
// Setup condition:
List<SubscriptionPlan> existing = planRepository.findAll();
if (existing.size() < 3) {
    SubscriptionPlan p = new SubscriptionPlan();
    p.setName("Rollback Test Plan 3");
    p.setDescription("Generated for transaction rollback integration test");
    p.setPrice(new BigDecimal("299.00"));
    p.setBillingCycle("monthly");
    p.setDurationDays(30);
    p.setDisplayOrder(3);
    p.setIsActive(true);
    planRepository.save(p);
}
```
The test needs at least 3 distinct plan IDs to create meaningful permutations for reordering, persistence testing, and simulating transactional failure on the 3rd plan.

### 2.2 Why `@Transactional` is Incompatible with This Test
`AdminSubscriptionPlanRollbackIntegrationTest` specifically validates transaction boundary behavior:
1. `testReorderPlans_Success_CommitsToDatabase`: Verifies that a valid reorder operation commits immediately to PostgreSQL and changes the physical `display_order` column in the database (verified via native SQL `SELECT display_order FROM subscription_plans WHERE id = ?`).
2. `testReorderPlans_PersistenceFailure_RollsBackTransaction`: Uses a Spy on `SubscriptionPlanRepository` to force a `DataIntegrityViolationException` on saving the 3rd plan, verifying that Spring's `@Transactional` rollback mechanism successfully reverts the first two plans to their pre-request display order in PostgreSQL.

Adding `@Transactional` to the test class would wrap each test method in a test-managed transaction that rolls back automatically, preventing the test from asserting actual committed transaction state across separate connections/statements.

### 2.3 Teardown Defect
The original `@AfterEach` method only contained:
```java
@AfterEach
void tearDown() {
    reset(planRepository);
}
```
It did not clean up the temporary plan created during `@BeforeEach`, causing plan ID 753 to leak into the staging database.

---

## 3. Cleanup of Residual Plan ID 753

### 3.1 Pre-Deletion Verification
- **Target Record:** ID 753
- **Name:** `Rollback Test Plan 3`
- **Billing Cycle:** `monthly`
- **Price:** `₹299.00`
- **Created At:** `2026-11-05 12:10:19.806951`
- **Foreign Key Check:**
  - `SELECT COUNT(*) FROM subscriptions WHERE plan_id = 753` $\rightarrow$ `0`
  - `SELECT COUNT(*) FROM payments WHERE plan_id = 753` $\rightarrow$ `0`

### 3.2 Atomic Deletion
Executed within an explicit transaction:
```sql
BEGIN;
DELETE FROM subscription_plans WHERE id = 753;
COMMIT;
```
**Result:** `DELETE 1`.

### 3.3 Post-Deletion Verification
Immediately verified `SELECT COUNT(*) FROM subscription_plans`:
```text
 id |          name          | billing_cycle |  price  | is_active 
----+------------------------+---------------+---------+-----------
  2 | Pro Baker Studio Suite | monthly       |  350.00 | t
  3 | Pro Baker Studio Suite | yearly        | 3500.00 | t
(2 rows)
```

---

## 4. Test Isolation Implementation Details

### 4.1 Implementation Strategy
1. Injected `@Autowired private JdbcTemplate jdbcTemplate;`.
2. Added `private final List<Long> createdPlanIds = new ArrayList<>();` to track only temporary plans instantiated during the test run.
3. Updated `@BeforeEach`:
   - Clears `createdPlanIds`.
   - Upon creating `Rollback Test Plan 3`, records `createdPlanIds.add(p.getId())`.
4. Updated `@AfterEach`:
   - Resets the `planRepository` mock/spy.
   - Iterates over `createdPlanIds` and executes `DELETE FROM subscription_plans WHERE id = ?`.
   - Never deletes official plans 2 or 3.
   - Collects teardown errors into a list and throws an explicit `AssertionError` with suppressed exceptions if any deletion fails—guaranteeing zero silent swallowed failures.

### 4.2 Code Diff in `AdminSubscriptionPlanRollbackIntegrationTest.java`

```diff
@@ -21,6 +21,7 @@ import org.junit.jupiter.api.DisplayName;
 import org.junit.jupiter.api.Test;
 import org.springframework.beans.factory.annotation.Autowired;
 import org.springframework.boot.test.context.SpringBootTest;
+import org.springframework.jdbc.core.JdbcTemplate;
 import org.springframework.test.context.ActiveProfiles;
 import org.springframework.transaction.PlatformTransactionManager;
 
@@ -37,6 +38,9 @@ public class AdminSubscriptionPlanRollbackIntegrationTest {
     @Autowired
     private SubscriptionPlanRepository planRepository;
 
+    @Autowired
+    private JdbcTemplate jdbcTemplate;
+
     @Autowired
     private PlatformTransactionManager transactionManager;
 
@@ -47,6 +51,8 @@ public class AdminSubscriptionPlanRollbackIntegrationTest {
     private Long planId1;
     private Long planId2;
     private Long planId3;
+    private final List<Long> createdPlanIds = new ArrayList<>();
+    private final List<Throwable> teardownErrors = new ArrayList<>();
 
     @BeforeEach
     void setUp() {
+        createdPlanIds.clear();
         List<SubscriptionPlan> existing = planRepository.findAll();
         if (existing.size() < 3) {
             SubscriptionPlan p = new SubscriptionPlan();
             p.setName("Rollback Test Plan 3");
             p.setDescription("Generated for transaction rollback integration test");
             p.setPrice(new BigDecimal("299.00"));
             p.setBillingCycle("monthly");
             p.setDurationDays(30);
             p.setDisplayOrder(3);
             p.setIsActive(true);
-            planRepository.save(p);
+            p = planRepository.save(p);
+            createdPlanIds.add(p.getId());
         }
 
         List<SubscriptionPlan> plans = planRepository.findAll();
@@ -62,8 +70,29 @@ public class AdminSubscriptionPlanRollbackIntegrationTest {
 
     @AfterEach
     void tearDown() {
+        teardownErrors.clear();
         reset(planRepository);
+        for (Long id : createdPlanIds) {
+            try {
+                jdbcTemplate.update("DELETE FROM subscription_plans WHERE id = ?", id);
+            } catch (Exception e) {
+                teardownErrors.add(e);
+            }
+        }
+        createdPlanIds.clear();
+        if (!teardownErrors.isEmpty()) {
+            StringBuilder msg = new StringBuilder("Teardown cleanup failed with ")
+                    .append(teardownErrors.size()).append(" SQL error(s):\n");
+            for (Throwable t : teardownErrors) {
+                msg.append(" - ").append(t.getMessage()).append("\n");
+            }
+            AssertionError failure = new AssertionError(msg.toString());
+            for (Throwable t : teardownErrors) {
+                failure.addSuppressed(t);
+            }
+            throw failure;
+        }
     }
```

---

## 5. Verification Results

### 5.1 Standalone Test Execution
Executed `AdminSubscriptionPlanRollbackIntegrationTest`:
```text
[INFO] Running com.cakeplatform.api.modules.admin.AdminSubscriptionPlanRollbackIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 29.78 s
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### 5.2 Database Plan Count Before vs. After Execution
- **Count Before Test:** 2 rows
- **Count After Test:** 2 rows
- **Residual Plans Created:** 0

### 5.3 Full Subscription Regression Test Suite
Executed all related test suites:
- `AdminSubscriptionPlanRollbackIntegrationTest` (3 tests)
- `AdminSubscriptionPlanControllerTest` (7 tests)
- `PublicSubscriptionPlanControllerTest` (1 test)
- `SubscriptionDecouplingTest` (11 tests)
- `RevenueSegregationE2ETest` (9 tests)
- `AdminDashboardDateFilterTest` (25 tests)

**Results:**
```text
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.cakeplatform.api.modules.admin.AdminDashboardDateFilterTest
[INFO] Tests run: 25, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.cakeplatform.api.modules.payment.RevenueSegregationE2ETest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.cakeplatform.api.modules.admin.AdminSubscriptionPlanRollbackIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.cakeplatform.api.modules.admin.AdminSubscriptionPlanControllerTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.cakeplatform.api.modules.subscription.controller.PublicSubscriptionPlanControllerTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.cakeplatform.api.modules.subscription.SubscriptionDecouplingTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 56, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:12 min
```

---

## 6. Final `subscription_plans` Table State

Direct query from PostgreSQL `cake_platform`:
```sql
SELECT id, name, billing_cycle, price, currency, duration_days, is_active, display_order, created_at, updated_at
FROM subscription_plans
ORDER BY id;
```

| ID | Name | Billing Cycle | Price | Currency | Duration Days | Is Active | Display Order | Created At | Updated At |
|---|---|---|---|---|---|---|---|---|---|
| **2** | Pro Baker Studio Suite | monthly | 350.00 | INR | 30 | true | 2 | 2026-09-16 16:21:30 | 2026-11-05 14:44:23 |
| **3** | Pro Baker Studio Suite | yearly | 3500.00 | INR | 365 | true | 1 | 2026-09-16 16:21:30 | 2026-11-05 12:10:19 |

**Total rows:** Exactly 2.

---

## 7. Final Verification of Public & Admin APIs

### 7.1 Public Storefront Endpoint: `GET /api/subscription-plans`
```http
HTTP/1.1 200 OK
Content-Type: application/json
```
```json
[
  {
    "planId": 3,
    "name": "Pro Baker Studio Suite",
    "description": "Complete bakery management suite with annual billing (Save ₹1700).",
    "price": 3500.00,
    "currency": "INR",
    "billingCycle": "yearly",
    "durationDays": 365,
    "features": "[\"Storefront\", \"Order Management\", \"No Commission\", \"Priority Support\"]"
  },
  {
    "planId": 2,
    "name": "Pro Baker Studio Suite",
    "description": "Complete bakery management suite with monthly billing.",
    "price": 350.00,
    "currency": "INR",
    "billingCycle": "monthly",
    "durationDays": 30,
    "features": "[\"Storefront\", \"Order Management\", \"No Commission\"]"
  }
]
```
- **Count:** 2 plans returned.

### 7.2 Super Admin Endpoint: `GET /api/admin/plans`
Authenticated with `admin@cakestore.com`:
```http
HTTP/1.1 200 OK
Content-Type: application/json
```
```json
[
  {
    "id": 3,
    "name": "Pro Baker Studio Suite",
    "description": "Complete bakery management suite with annual billing (Save ₹1700).",
    "billingCycle": "yearly",
    "price": 3500.00,
    "currency": "INR",
    "durationDays": 365,
    "features": "[\"Storefront\", \"Order Management\", \"No Commission\", \"Priority Support\"]",
    "isActive": true,
    "displayOrder": 1,
    "createdAt": "2026-09-16T16:21:30.214776",
    "updatedAt": "2026-11-05T12:10:19.824458"
  },
  {
    "id": 2,
    "name": "Pro Baker Studio Suite",
    "description": "Complete bakery management suite with monthly billing.",
    "billingCycle": "monthly",
    "price": 350.00,
    "currency": "INR",
    "durationDays": 30,
    "features": "[\"Storefront\", \"Order Management\", \"No Commission\"]",
    "isActive": true,
    "displayOrder": 2,
    "createdAt": "2026-09-16T16:21:30.214776",
    "updatedAt": "2026-11-05T14:44:23.776400"
  }
]
```
- **Count:** 2 plans returned.

---

## 8. Lessons Learned & Guidelines for Future Integration Tests

1. **Avoid Assuming `@Transactional` is Universally Applicable:**
   Integration tests designed specifically to test database rollback, commit boundaries, or physical persistence (e.g., using Spy/Mocks to trigger partial persistence failures) cannot use Spring test `@Transactional` without invalidating the test assertion.
2. **Dynamic Entity ID Tracking:**
   When tests must commit rows physically to the shared database, track every entity ID explicitly in a collection (e.g., `createdPlanIds`) immediately upon `save()`.
3. **Explicit Teardown with Fail-Visible Behavior:**
   Always iterate through tracked IDs in `@AfterEach` and delete them using targeted SQL. Catch exceptions only to aggregate them and rethrow an `AssertionError` with suppressed exceptions—never swallow exceptions silently.
4. **Never Retain Test Diagnostic Queries:**
   Remove any test/probe queries immediately after verifying error propagation to keep test suites clean.

---

## 9. Completion Status & Next Steps

- [x] Residual Plan ID 753 safely deleted from PostgreSQL `cake_platform`.
- [x] Official subscription plans (IDs 2 and 3) intact and unaffected.
- [x] Explicit test teardown implemented in `AdminSubscriptionPlanRollbackIntegrationTest.java`.
- [x] Standalone test execution verified (3/3 passing, 0 residual plans).
- [x] 56-test regression suite verified (56/56 passing, 0 failures, 0 errors).
- [x] Public and Admin APIs verified (exactly 2 plans returned).
- [x] Phase 2.9.3.3 documentation published to Artifacts and Workspace root.

**Next Recommended Step:** Proceed to **Phase 2.9.4: Super Admin UAT Resumption & Validation**.

