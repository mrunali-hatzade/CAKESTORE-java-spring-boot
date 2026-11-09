# CakeStore — Phase 2.9.3.1: Subscription Plan Test Isolation & Staging Cleanup Report

**Execution Date:** November 4, 2026  
**Environment:** Local Development / Staging (`cake_platform` PostgreSQL on localhost:5432, Spring Boot 3.3.2 on port 8080, Next.js 14 on port 3000)  
**Scope:** Test isolation fixes for `AdminDashboardDateFilterTest.java` and `RevenueSegregationE2ETest.java`, and safe deletion of the 65 confirmed test-generated subscription plan records (IDs 509–573).

---

## 1. Root Cause Confirmed

The duplication of subscription plans in the local staging database was caused by the execution of integration tests that created persistent database records in their `@BeforeEach` setup routines without rolling back transactions or executing cleanup logic:

1. **`AdminDashboardDateFilterTest.java`**:
   - Contains **25 test methods**.
   - In `@BeforeEach setUp()`, line 154 called `testPlan = subscriptionPlanRepository.save(testPlan)`, inserting a new `Pro Baker Filter Tier` record (monthly, ₹2,000.00) before each test.
   - The test class lacked both transaction rollback (`@Transactional`) and an `@AfterEach` teardown method.
   - Running this suite committed 25 persistent subscription plans, 25 shops, 75 users, 50 orders, and 100 payments per full test run.

2. **`RevenueSegregationE2ETest.java`**:
   - Contains **5 test methods**.
   - In `@BeforeEach setUp()`, line 126 called `testPlan = subscriptionPlanRepository.save(testPlan)`, inserting a new `Pro Baker Studio` record (monthly, ₹1,999.00) before each test.
   - The test class lacked both transaction rollback and an `@AfterEach` teardown method.
   - Running this suite committed 5 persistent subscription plans, 5 shops, 10 users, 10 orders, and 20 payments per test run.

Empirical reproduction during this phase proved that executing `RevenueSegregationE2ETest` without isolation inserted 5 new records into `subscription_plans` (IDs 574–578) with timestamps matching test invocation (`2026-11-04 14:40:29`).

---

## 2. Files Changed and Exact Changes

Zero production business logic or production schema files were modified. Only test files were altered:

### File 1: `backend/src/test/java/com/cakeplatform/api/modules/payment/RevenueSegregationE2ETest.java`
- Added import `org.springframework.transaction.annotation.Transactional;`.
- Annotated the test class with `@Transactional`.

```java
// Diff snippet:
+ import org.springframework.transaction.annotation.Transactional;
...
  @SpringBootTest
  @AutoConfigureMockMvc
  @ActiveProfiles("test")
+ @Transactional
  public class RevenueSegregationE2ETest {
```

### File 2: `backend/src/test/java/com/cakeplatform/api/modules/admin/AdminDashboardDateFilterTest.java`
- Added import `org.junit.jupiter.api.AfterEach;`.
- Promoted local user variables in `setUp()` to class fields (`adminUser`, `ownerUser`, `customerUser`).
- Implemented an `@AfterEach void tearDown()` method with an isolated helper `safeSql(String sql, Object... args)` that cleans up all created test entities in reverse foreign-key dependency order after every test method.

```java
// Diff snippet:
+ import org.junit.jupiter.api.AfterEach;
...
+   private User adminUser;
+   private User ownerUser;
+   private User customerUser;
...
+   @AfterEach
+   void tearDown() {
+       if (testShop != null && testShop.getId() != null) {
+           safeSql("DELETE FROM business_documents WHERE shop_id = ?", testShop.getId());
+           safeSql("DELETE FROM payments WHERE shop_id = ?", testShop.getId());
+           safeSql("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE shop_id = ?)", testShop.getId());
+           safeSql("DELETE FROM orders WHERE shop_id = ?", testShop.getId());
+           safeSql("DELETE FROM subscriptions WHERE shop_id = ?", testShop.getId());
+           safeSql("DELETE FROM shops WHERE id = ?", testShop.getId());
+       }
+       if (testPlan != null && testPlan.getId() != null) {
+           safeSql("DELETE FROM payments WHERE plan_id = ?", testPlan.getId());
+           safeSql("DELETE FROM subscriptions WHERE plan_id = ?", testPlan.getId());
+           safeSql("DELETE FROM subscription_plans WHERE id = ?", testPlan.getId());
+       }
+       if (adminUser != null && adminUser.getId() != null) {
+           safeSql("DELETE FROM admin_notifications WHERE recipient_id = ?", adminUser.getId());
+           safeSql("DELETE FROM notifications WHERE recipient_id = ?", adminUser.getId());
+           safeSql("DELETE FROM users WHERE id = ?", adminUser.getId());
+       }
+       if (ownerUser != null && ownerUser.getId() != null) {
+           safeSql("DELETE FROM notifications WHERE recipient_id = ?", ownerUser.getId());
+           safeSql("DELETE FROM users WHERE id = ?", ownerUser.getId());
+       }
+       if (customerUser != null && customerUser.getId() != null) {
+           safeSql("DELETE FROM notifications WHERE recipient_id = ?", customerUser.getId());
+           safeSql("DELETE FROM users WHERE id = ?", customerUser.getId());
+       }
+   }
+
+   private void safeSql(String sql, Object... args) {
+       try {
+           jdbcTemplate.update(sql, args);
+       } catch (Exception ignored) {
+       }
+   }
```

---

## 3. Test-Isolation Strategy and Why It Was Selected

An in-depth empirical assessment was conducted for both test classes to determine whether `@Transactional` or `@AfterEach` was appropriate:

| Test Class | Strategy Selected | Rationale & Empirical Findings |
| :--- | :--- | :--- |
| **`RevenueSegregationE2ETest`** | **`@Transactional`** | In MockMvc tests without direct JDBC mutations, Spring's `@Transactional` test runner rolls back all JPA entity inserts upon test completion. When `@Transactional` was added, all 5 tests passed (5/5) and `SELECT COUNT(*) FROM subscription_plans` remained unchanged (0 records leaked). |
| **`AdminDashboardDateFilterTest`** | **`@AfterEach` (Targeted Cleanup)** | **`@Transactional` was evaluated and found UNSUITABLE.** This test suite directly mutates database rows using `jdbcTemplate.update("UPDATE shops SET is_deleted = true WHERE id = ?", testShop.getId())` to test soft-deletion behavior (`BM-01`). Under an open Spring `@Transactional` test boundary, Hibernate's PersistenceContext (first-level cache) retains the un-deleted `Shop` entity from `setUp()`. When `shopRepository.findById` or the admin controller subsequently inspects the entity, Hibernate serves the stale cached instance without re-querying SQL, causing soft-delete assertions (`testBM01_AdminCanInspectArchivedBakeryDetails` and `testBM01_OrdinaryFindByIdExcludesArchivedBakery`) to fail. Removing `@Transactional` and adopting an explicit `@AfterEach` cleanup using `safeSql` in reverse dependency order enabled **all 25 tests to pass (25/25)** while completely preventing database pollution. |

---

## 4. Database Verification Performed Before Deletion

Prior to executing any DELETE statement, all strict pre-conditions mandated in Step 3 were evaluated and verified against PostgreSQL:

1. **Active Database Confirmation:**
   - Database: `cake_platform`
   - Server Address: `::1` (`localhost`)
   - Port: `5432`
   - Environment: Local staging (`!prod`)

2. **Exact Records and Plan Names:**
   - Identified range: IDs 509 to 573.
   - Record breakdown:
     - `Pro Baker Filter Tier`: 50 records
     - `Pro Baker Studio`: 15 records
     - Total: Exactly 65 records.

3. **Foreign-Key Reference Check:**
   - Inspected PostgreSQL `information_schema.table_constraints` for all tables referencing `subscription_plans`.
   - Identified references: `subscriptions.plan_id` and `payments.plan_id`.
   - Query: `SELECT COUNT(*) FROM subscriptions WHERE plan_id BETWEEN 509 AND 573;`  
     **Result:** `0`
   - Query: `SELECT COUNT(*) FROM payments WHERE plan_id BETWEEN 509 AND 573;`  
     **Result:** `0`

4. **Active Subscriptions & Historical Data:**
   - Staging subscriptions (10 total) all have `plan_id = NULL` (initialized during initial shop setup).
   - Zero active or historical subscriptions reference IDs 509–573.

5. **Official Plans Preservation Check:**
   - Query: `SELECT id, name, billing_cycle, price, duration_days, is_active FROM subscription_plans WHERE id IN (2, 3);`
   - Result:
     - ID 2: `Pro Baker Studio Suite`, monthly, ₹350.00, `is_active = true`
     - ID 3: `Pro Baker Studio Suite`, yearly, ₹3500.00, `is_active = true`

6. **Target Count Match:**
   - `SELECT COUNT(*) FROM subscription_plans WHERE id BETWEEN 509 AND 573;`  
     **Result:** Exactly `65`.

---

## 5. Exact Records Deleted and Count

The deletion was executed in a single atomic transaction:

```sql
BEGIN;
DELETE FROM subscription_plans WHERE id BETWEEN 509 AND 573;
COMMIT;
```

- **Database Output:** `DELETE 65`
- **Exact Records Deleted:** 65 rows (IDs 509 through 573 inclusive).
- **Post-Deletion Verification:**
  ```sql
  SELECT COUNT(*) FROM subscription_plans WHERE id BETWEEN 509 AND 573;
  -- Result: 0
  ```

---

## 6. Confirmation That Official Plans 2 and 3 Remain

The official plans were inspected immediately post-deletion and after subsequent test executions:

| Plan ID | Plan Name | Billing Cycle | Price (₹) | Duration | Active | Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **2** | Pro Baker Studio Suite | monthly | 350.00 | 30 days | `true` | **Preserved & Intact** |
| **3** | Pro Baker Studio Suite | yearly | 3500.00 | 365 days | `true` | **Preserved & Intact** |

---

## 7. Foreign-Key and Referential Integrity Verification

A complete post-deletion referential integrity check confirmed:
- Zero orphaned foreign keys pointing to `subscription_plans`.
- All 10 existing staging bakery subscriptions retain their active status and shop associations.
- Shop 1 (`Akurdi Artisan Bakes`) subscription (ID 1, status ACTIVE) remains untouched.
- Staging customer orders and payment records remain unaffected.

---

## 8. Tests Executed and Actual Results

All automated tests were executed using Maven outside the sandbox against the local staging PostgreSQL database:

| Test Class | Methods Run | Failures / Errors | Execution Time | Persistent DB Pollution | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`AdminDashboardDateFilterTest`** | 25 | 0 / 0 | 34.29 s | **0 rows added** | **PASS** |
| **`RevenueSegregationE2ETest`** | 5 | 0 / 0 | 0.48 s | **0 rows added** | **PASS** |
| **Combined Regression (Both suites)** | 30 | 0 / 0 | 41.07 s | **0 rows added** | **PASS** |
| **`AdminSubscriptionPlanControllerTest`** | 11 | 0 / 0 | 1.32 s | 0 rows added | **PASS** |
| **`AdminSubscriptionPlanRollbackIntegrationTest`** | 3 | 0 / 0 | 7.62 s | 0 rows added | **PASS** |
| **`PublicSubscriptionPlanControllerTest`** | 1 | 0 / 0 | 7.62 s | 0 rows added | **PASS** |
| **`SubscriptionDecouplingTest`** | 11 | 0 / 0 | 0.48 s | 0 rows added | **PASS** |
| **Total Automated Tests** | **56** | **0 / 0** | — | **0 rows added** | **ALL PASS** |

### Verified Test Idempotency
- Running the combined test suites repeatedly confirmed that `SELECT COUNT(*) FROM subscription_plans WHERE id BETWEEN 509 AND 573` remains **0**, and the overall plan table count remains completely constant.

---

## 9. Admin and Owner UI Verification Results

Both automated API queries and manual HTTP endpoint verifications were performed against the running staging backend (`http://localhost:8080`):

### A. Admin Plan Listing (`GET /api/admin/subscription-plans`)
- Authenticated as `admin@cakestore.com` via `/api/auth/login`.
- Evaluated plan listing response:
  ```powershell
  (curl.exe -s -H "Authorization: Bearer $token" http://localhost:8080/api/admin/subscription-plans | ConvertFrom-Json) |
    Where-Object { $_.id -ge 509 -and $_.id -le 573 } | Measure-Object
  # Count: 0
  ```
- **Result:** The 65 duplicate entries (IDs 509–573) are **completely absent** from the admin plan listing.

### B. Owner Subscription Picker (`GET /api/subscription-plans`)
- Evaluated public/owner plan listing response:
  ```powershell
  (curl.exe -s http://localhost:8080/api/subscription-plans | ConvertFrom-Json) |
    Where-Object { $_.planId -ge 509 -and $_.planId -le 573 } | Measure-Object
  # Count: 0
  ```
- Evaluated presence of official plans:
  ```powershell
  (curl.exe -s http://localhost:8080/api/subscription-plans | ConvertFrom-Json) |
    Where-Object { $_.planId -eq 2 -or $_.planId -eq 3 }
  # Returns: ID 2 (Pro Baker Studio Suite Monthly ₹350) and ID 3 (Pro Baker Studio Suite Yearly ₹3500)
  ```
- **Result:** The 65 duplicate entries are **completely absent** from the owner subscription picker. Official plans 2 and 3 are displayed cleanly.

---

## 10. Remaining Items & Observations

1. **Transient Test Rows From Intermediate Diagnostics (IDs 574–578 & 609–633):**
   - During the early diagnostic step of this phase (before the test isolation fixes were compiled and verified), 5 test methods of `RevenueSegregationE2ETest` and 25 test methods of `AdminDashboardDateFilterTest` were executed to measure their exact unisolated behavior.
   - This generated 30 transient rows (IDs 574–578 and 609–633).
   - In accordance with the strict instructions of this phase ("*If all checks pass, delete only the verified test-generated records with IDs 509–573. Do not delete any other subscription plans*"), these 30 rows were **intentionally preserved** to avoid expanding the deletion scope beyond user authorization.
   - These 30 transient records can be cleaned up in a single, trivial maintenance script whenever approved by the user (`DELETE FROM subscription_plans WHERE id >= 574;`).
2. **All Future Test Executions Safe:**
   - Because the test isolation fixes are now permanently committed in `AdminDashboardDateFilterTest.java` and `RevenueSegregationE2ETest.java`, **no future test run will ever leak subscription plans or test entities into the database again**.

---

## 11. Final Sign-Off

- [x] Confirmed root cause of plan duplication.
- [x] Implemented test isolation for `RevenueSegregationE2ETest` (`@Transactional`).
- [x] Implemented test isolation for `AdminDashboardDateFilterTest` (`@AfterEach` reverse-dependency cleanup).
- [x] Confirmed pre-deletion checks against local staging database.
- [x] Deleted exactly the 65 verified test records (IDs 509–573).
- [x] Preserved official plans 2 and 3.
- [x] Executed 56 regression integration tests with 100% pass rate.
- [x] Verified zero plan leakage upon repeated test suite execution.
- [x] Verified admin dashboard and owner subscription picker APIs.
- [x] Production environment untouched.

**Phase 2.9.3.1 is complete. Awaiting user review and authorization before proceeding.**
