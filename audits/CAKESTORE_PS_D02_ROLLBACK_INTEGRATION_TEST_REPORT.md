# CakeStore — PS-D02 Transaction Rollback Integration Test Report

**Execution Date:** October 16, 2026  
**Target Scope:** `AdminSubscriptionPlanController.reorderPlans` Transaction Boundary Verification  
**Artifact Generated:** `CAKESTORE_PS_D02_ROLLBACK_INTEGRATION_TEST_REPORT.md`  
**Test File Created:** `backend/src/test/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanRollbackIntegrationTest.java`

---

## 1. Executive Summary & Verdict

### Final Verdict: **FULLY VERIFIED**

The rollback verification gap identified in `CAKESTORE_PS_D01_D03_FINAL_VERIFICATION.md` has been closed.

A focused Spring Boot integration test was implemented and executed against a live transactional persistence context connected to the test PostgreSQL database. The test deterministically flushed SQL `UPDATE` statements across the JDBC connection into PostgreSQL and simulated a database failure mid-transaction. Raw native SQL queries executing directly on the database engine proved that:
1. Every modified row was completely rolled back by Spring's `@Transactional` boundary.
2. Every subscription plan in the database retained its original baseline `display_order`.
3. Valid permutation reordering commits atomically to the database.
4. Validation errors abort processing prior to persistence, leaving the database unmodified.

Zero production source code changes were needed; the production implementation in `AdminSubscriptionPlanController.java` passed all verification gates without modification.

---

## 2. Test Architecture & Design

### 2.1 Database & Persistence Environment
- **Framework:** Spring Boot Test (`@SpringBootTest`, `@ActiveProfiles("test")`).
- **Database Engine:** PostgreSQL (`jdbc:postgresql://localhost:5432/cake_platform`).
- **Database Migrations:** Managed by Flyway (`spring.flyway.enabled=true`).
- **Persistence Provider:** Hibernate ORM 6.5.2.Final with `PostgreSQLDialect`.
- **Security Context:** `@WithMockUser(roles = "ADMIN")` to satisfy method-level `@PreAuthorize("hasRole('ADMIN')")` on the controller.
- **Transaction Boundary Management:** The test class does **not** annotate test methods with `@Transactional`. This ensures that transactions are exclusively initiated, managed, and committed/rolled back by the production `@Transactional` boundary on `AdminSubscriptionPlanController.reorderPlans`.

### 2.2 Failure Injection Mechanism
To simulate a real persistence failure *after* updates have begun without corrupting external database schemas, the test uses a `@SpyBean` on `SubscriptionPlanRepository`:

```java
doAnswer(invocation -> {
    List<SubscriptionPlan> plansToSave = invocation.getArgument(0);
    for (SubscriptionPlan p : plansToSave) {
        entityManager.merge(p);
    }
    // Force Hibernate to generate and transmit SQL UPDATE statements over the JDBC wire
    entityManager.flush();

    // Deterministically simulate a persistence error (e.g. trigger, constraint, or connection error)
    throw new DataIntegrityViolationException("Simulated database failure during batch save");
}).when(planRepository).saveAll(any());
```

1. **Step 1:** The controller calls `planRepository.findAll()`, loading managed entities into the Hibernate persistence context.
2. **Step 2:** The controller updates `displayOrder` sequentially in memory for each plan.
3. **Step 3:** The controller calls `planRepository.saveAll(allPlans)`.
4. **Step 4:** The spy intercepts `saveAll`, calls `entityManager.flush()`, which executes real SQL `UPDATE subscription_plans SET display_order = ... WHERE id = ...` statements against PostgreSQL inside the open transaction.
5. **Step 5:** The spy immediately throws `DataIntegrityViolationException`.
6. **Step 6:** The exception propagates out of `reorderPlans`. Spring's transaction interceptor catches the unchecked exception and invokes `connection.rollback()`.
7. **Step 7:** The test resets the spy, clears the Hibernate 1st-level cache (`entityManager.clear()`), and issues direct raw native SQL queries (`SELECT display_order FROM subscription_plans WHERE id = :id`) to inspect the actual database table rows.

---

## 3. Persisted State Before and After Failure

### 3.1 Initial Baseline State
Sequential display orders were normalized and confirmed in PostgreSQL prior to the reorder attempt:

| Plan ID | Plan Name | Baseline `display_order` |
| :--- | :--- | :--- |
| **Plan 1** | Pro Baker Studio Suite (Monthly) | `0` |
| **Plan 2** | Pro Baker Studio Suite (Yearly) | `1` |
| **Plan 3** | Rollback Test Plan 3 | `2` |

### 3.2 Attempted Reorder (Reversed Order)
The reorder operation requested reversing the plan IDs: `[Plan 3, Plan 2, Plan 1]`.

- Expected display orders *if committed*:
  - Plan 3 $\rightarrow$ `0`
  - Plan 2 $\rightarrow$ `1`
  - Plan 1 $\rightarrow$ `2`

### 3.3 State During Execution (Post-Flush)
Before the failure was thrown, `entityManager.flush()` sent the following updates to the active PostgreSQL transaction:
```sql
UPDATE subscription_plans SET display_order = 0 WHERE id = 3;
UPDATE subscription_plans SET display_order = 1 WHERE id = 2;
UPDATE subscription_plans SET display_order = 2 WHERE id = 1;
```

### 3.4 Persisted State After Exception & Rollback (Verified via Raw Native SQL)
The test caught `DataIntegrityViolationException`, cleared the L1 cache, and ran:
```sql
SELECT display_order FROM subscription_plans WHERE id = :id
```

| Plan ID | Desired Mutated Order | Actual Database State After Rollback | Result |
| :--- | :--- | :--- | :--- |
| **Plan 1** | `2` | **`0`** | **Restored to baseline** |
| **Plan 2** | `1` | **`1`** | **Restored to baseline** |
| **Plan 3** | `0` | **`2`** | **Restored to baseline** |

**Conclusion:** The database rows were not updated. PostgreSQL rolled back the transaction in full.

---

## 4. Test Execution Evidence

### 4.1 Focused Integration Test
Command:
```bash
mvn test '-Dtest=AdminSubscriptionPlanRollbackIntegrationTest'
```

Output:
```text
[INFO] Running com.cakeplatform.api.modules.admin.AdminSubscriptionPlanRollbackIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 51.06 s -- in com.cakeplatform.api.modules.admin.AdminSubscriptionPlanRollbackIntegrationTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:16 min
[INFO] Finished at: 2026-10-16T11:26:33+05:30
```

Individual test methods verified:
1. `testReorderPlans_Success_CommitsToDatabase`: **PASSED** (New display orders committed and verified via native SQL).
2. `testReorderPlans_PersistenceFailure_RollsBackTransaction`: **PASSED** (Flushed SQL updates undone; native SQL proves baseline values retained).
3. `testReorderPlans_ValidationFailure_LeavesDatabaseUnchanged`: **PASSED** (Invalid input rejected with `IllegalArgumentException` prior to DB writes; native SQL proves baseline values retained).

---

### 4.2 Combined Subscription Regression Suite
Command:
```bash
mvn test '-Dtest=AdminSubscriptionPlanRollbackIntegrationTest,AdminSubscriptionPlanControllerTest,SubscriptionSchedulerTest,SubscriptionDecouplingTest,BakeryLifecyclePhase1Test,PublicSubscriptionPlanControllerTest'
```

Output:
```text
[INFO] Running com.cakeplatform.api.modules.admin.AdminSubscriptionPlanRollbackIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 50.84 s
[INFO] Running com.cakeplatform.api.modules.admin.AdminSubscriptionPlanControllerTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.451 s
[INFO] Running com.cakeplatform.api.modules.subscription.controller.PublicSubscriptionPlanControllerTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.89 s
[INFO] Running com.cakeplatform.api.modules.subscription.SubscriptionDecouplingTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.142 s
[INFO] Running com.cakeplatform.api.modules.subscription.SubscriptionSchedulerTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.214 s
[INFO] Running com.cakeplatform.api.modules.bakery.BakeryLifecyclePhase1Test
[INFO] Tests run: 17, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.150 s
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 46, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:23 min
[INFO] Finished at: 2026-10-16T11:28:05+05:30
```

---

## 5. Scope & Git Status Confirmation

```bash
$ git status --short
 M backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java
 M frontend_v2/app/admin/shops/[id]/page.tsx
 M frontend_v2/types/admin.ts
?? CAKESTORE_PLANS_SUBSCRIPTIONS_DEEP_AUDIT_REPORT.md
?? CAKESTORE_PLANS_SUBSCRIPTIONS_EVIDENCE_VERIFICATION.md
?? CAKESTORE_PLANS_SUBSCRIPTIONS_FIX_PLAN.md
?? CAKESTORE_PS_D01_D03_FINAL_VERIFICATION.md
?? CAKESTORE_PS_D02_ROLLBACK_INTEGRATION_TEST_REPORT.md
?? backend/src/test/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanControllerTest.java
?? backend/src/test/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanRollbackIntegrationTest.java
?? frontend_v2/__tests__/bakeryDetailsSubscriptionMapping.test.mjs
```

- **Production code:** Intact; zero changes needed during this task.
- **Database mutations:** Zero external/production database impact.
- **Git state:** Zero commits, merges, or branch changes.

---

## 6. Conclusion

With `AdminSubscriptionPlanRollbackIntegrationTest` passing all 3 scenarios against live PostgreSQL database queries, the transactional rollback behavior of `AdminSubscriptionPlanController.reorderPlans` is conclusively established. 

Findings **PS-D01**, **PS-D02**, and **PS-D03** are all **FULLY VERIFIED**.
