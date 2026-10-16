# CakeStore — Plans & Subscriptions: Pre-Implementation Fix Plan

**Document**: `CAKESTORE_PLANS_SUBSCRIPTIONS_FIX_PLAN.md`  
**Status**: PRE-IMPLEMENTATION PLANNING ONLY (Strictly Read-Only, No Changes Applied)  
**Target Defects**: PS-D01, PS-D02, PS-D03 (from `CAKESTORE_PLANS_SUBSCRIPTIONS_EVIDENCE_VERIFICATION.md`)  
**Execution Environment**: Local Development (PostgreSQL 15, Spring Boot 3.3.x on port 8080, Next.js 14.2.5 on port 3000)  

---

## 1. Inventory of Current Source Files & Functions Involved

| Defect ID | Layer | File Path | Function / Method | Current Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **PS-D01** | Frontend Page | `frontend_v2/app/admin/shops/[id]/page.tsx` | Lines 611, 848–875, 882–894 | Renders active plan card, expiry date, days-remaining countdown badge, and historical subscription rows. |
| **PS-D01** | Frontend Types | `frontend_v2/types/admin.ts` | Lines 83–90 (`AdminShopDetails`) | TypeScript interface definition for the `subscriptions` array in the shop details payload. |
| **PS-D02** | Backend Controller | `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java` | Lines 69–80 (`reorderPlans`) | Receives ordered list of plan IDs, updates `displayOrder`, and saves entities. |
| **PS-D02** | Backend Repository | `backend/src/main/java/com/cakeplatform/api/modules/subscription/SubscriptionPlanRepository.java` | Line 12 (`findAllByOrderByDisplayOrderAsc`) | JPA Repository managing `SubscriptionPlan` persistence and order querying. |
| **PS-D03** | Backend Controller | `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java` | Line 70 (`reorderPlans`) | Handles request payload binding and parameter validation for reorder requests. |

---

## 2. Root Cause Analysis (Based on Current Code)

### 2.1 Finding PS-D01 — Bakery Details Subscription Mapping Mismatch
- **Evidence**:
  The backend endpoint `GET /api/admin/shops/{id}` is implemented in `AdminDashboardService.getShopDetails(Long shopId)` (lines 355–398):
  ```java
  details.setSubscriptions(subscriptionRepository.findByShopId(shopId));
  ```
  This returns raw JPA `Subscription` entity instances. In `Subscription.java`:
  - Plan relation: `private SubscriptionPlan plan;` (nested object with `name`, `price`, etc.)
  - Expiry field: `private LocalDateTime expiryDate;`
  
  When serialized by Jackson, the JSON response is structured as:
  ```json
  {
    "subscriptions": [
      {
        "id": 101,
        "plan": { "id": 10, "name": "Pro Baker Studio", "price": 999.00 },
        "amount": 999.00,
        "startDate": "2026-10-15T12:00:00",
        "expiryDate": "2026-11-14T12:00:00",
        "status": "ACTIVE"
      }
    ]
  }
  ```
  However, in `frontend_v2/app/admin/shops/[id]/page.tsx`, the component attempts to read flat properties:
  - Line 611: `subscriptions[0]?.planName || 'Starter Bakery'`
  - Line 849: `subscriptions[0]?.planName || 'No Active Plan'`
  - Line 866: `subscriptions[0]?.endDate || '—'`
  - Line 868: `subscriptions[0]?.endDate && (() => { const daysLeft = Math.ceil((new Date(subscriptions[0].endDate).getTime() - Date.now()) ...`
  - Line 888: `sub.planName`
  - Line 889: `sub.startDate - sub.endDate`
- **Root Cause**: The frontend TypeScript type and JSX accessors assume a flat schema (`planName`, `endDate`), whereas the backend REST API serializes the relational entity hierarchy (`plan.name`, `expiryDate`). Because `planName` and `endDate` are undefined, the UI permanently falls back to `"No Active Plan"`, hides the expiration date, and disables the countdown badge.

### 2.2 Finding PS-D02 — Non-Atomic Plan Reordering
- **Evidence**:
  In `AdminSubscriptionPlanController.java` (lines 69–80):
  ```java
  @PutMapping("/reorder")
  public ResponseEntity<Void> reorderPlans(@RequestBody List<Long> planIds) {
      for (int i = 0; i < planIds.size(); i++) {
          Long id = planIds.get(i);
          SubscriptionPlan plan = planRepository.findById(id).orElse(null);
          if (plan != null) {
              plan.setDisplayOrder(i);
              planRepository.save(plan);
          }
      }
      return ResponseEntity.ok().build();
  }
  ```
- **Root Cause**:
  1. Neither the `AdminSubscriptionPlanController` class nor the `reorderPlans` method possesses a `@Transactional` annotation.
  2. Each call to `planRepository.save(plan)` runs in an individual transaction scoped to `SimpleJpaRepository.save()`.
  3. If a network interruption, deadlock, or database constraint error occurs midway through the loop, previously processed plans remain committed with modified `displayOrder` values while remaining plans are not updated. The database is left in a corrupted, non-deterministic display order state.

### 2.3 Finding PS-D03 — Null / Malformed Reorder Request
- **Evidence**:
  In `AdminSubscriptionPlanController.reorderPlans`:
  - If a client sends an empty body (`null`), calling `planIds.size()` on line 71 immediately triggers a `NullPointerException`, which surfaces as an unhandled HTTP 500 error instead of a client-side 400 error.
  - If a client passes an empty list (`[]`), the loop terminates with 0 iterations and returns HTTP 200 OK without performing any work or alerting the user.
  - If a client passes duplicate IDs (e.g. `[1, 2, 1]`) or non-existent IDs, invalid IDs are silently ignored (`if (plan != null)`), and duplicate plans are sequentially assigned multiple display orders without validation errors.
- **Root Cause**: Complete absence of input validation guards on the request body, list contents, uniqueness, and completeness.

---

## 3. Exact Proposed Changes (By File and Method)

### 3.1 Fix for PS-D01: Frontend Backward-Compatible Field Mapping

#### Strategy
In accordance with the instruction (*"Do not change the API contract merely for convenience if a safe frontend mapping resolves the mismatch"*), we resolve the defect cleanly in the frontend by extending the TypeScript type and using defensive accessors that check **both** the entity structure (`plan?.name`, `expiryDate`) and the flat structure (`planName`, `endDate`). This guarantees complete backward and forward compatibility without risking backend serialization regressions.

#### File 1: `frontend_v2/types/admin.ts`
- **Location**: Lines 83–90
- **Proposed Change**: Update the `subscriptions` interface inside `AdminShopDetails` to support nested `plan` and `expiryDate`:

```typescript
// Proposed update in frontend_v2/types/admin.ts
export interface AdminShopSubscriptionItem {
  id: number;
  plan?: {
    id: number;
    name: string;
    description?: string;
    price?: number;
    billingCycle?: string;
    durationDays?: number;
  } | null;
  planName?: string;
  status?: string;
  startDate?: string;
  expiryDate?: string;
  endDate?: string;
  amount?: number;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

// In AdminShopDetails:
subscriptions?: AdminShopSubscriptionItem[];
```

#### File 2: `frontend_v2/app/admin/shops/[id]/page.tsx`
- **Location**: Helper resolution and lines 611, 848–875, 882–894
- **Proposed Helper Functions** (placed right before JSX rendering, around line 328):
```typescript
// Safe field resolution helpers
const getSubPlanName = (sub?: AdminShopSubscriptionItem | null): string => {
  return sub?.plan?.name || sub?.planName || 'No Active Plan';
};

const getSubExpiryDate = (sub?: AdminShopSubscriptionItem | null): string | undefined => {
  return sub?.expiryDate || sub?.endDate;
};
```
- **Proposed JSX Adjustments**:
  1. **Quick Summary Card (Line 611)**:
     ```tsx
     <p className="text-sm font-bold text-slate-900 mt-2 truncate">
       {subscriptions[0]?.plan?.name || subscriptions[0]?.planName || 'Starter Bakery'}
     </p>
     ```
  2. **Active Subscription Card (Lines 848–875)**:
     ```tsx
     <div className="flex items-center justify-between">
       <span className="font-bold text-slate-800 text-sm">
         {getSubPlanName(subscriptions[0])}
       </span>
       <span className="font-extrabold text-purple-700 text-sm">
         {subscriptions[0]?.amount ? `₹${subscriptions[0].amount} / billing cycle` : '—'}
       </span>
     </div>
     <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-purple-100/60">
       <div>
         <span className="text-slate-400 block font-medium">Start Date</span>
         <span className="font-semibold text-slate-700">
           {subscriptions[0]?.startDate ? new Date(subscriptions[0].startDate).toLocaleDateString('en-IN') : '—'}
         </span>
       </div>
       <div>
         <span className="text-slate-400 block font-medium">Renewal / Expiry</span>
         <div className="flex items-center gap-2">
           <span className="font-semibold text-slate-700">
             {getSubExpiryDate(subscriptions[0]) ? new Date(getSubExpiryDate(subscriptions[0])!).toLocaleDateString('en-IN') : '—'}
           </span>
           {getSubExpiryDate(subscriptions[0]) && (() => {
             const daysLeft = Math.ceil((new Date(getSubExpiryDate(subscriptions[0])!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
             if (daysLeft < 0) return <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">⚠️ EXPIRED</span>;
             if (daysLeft <= 7) return <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ Expires in {daysLeft} day(s)</span>;
             return null;
           })()}
         </div>
       </div>
     </div>
     ```
  3. **Past Billing Cycles (Lines 888–892)**:
     ```tsx
     {subscriptions.slice(1).map((sub) => {
       const planTitle = getSubPlanName(sub);
       const startStr = sub.startDate ? new Date(sub.startDate).toLocaleDateString('en-IN') : '—';
       const endStr = getSubExpiryDate(sub) ? new Date(getSubExpiryDate(sub)!).toLocaleDateString('en-IN') : '—';
       return (
         <div key={sub.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
           <div>
             <p className="font-semibold text-slate-800">{planTitle}</p>
             <p className="text-[10px] text-slate-400">{startStr} - {endStr}</p>
           </div>
           <span className="font-bold text-slate-700">₹{sub.amount}</span>
         </div>
       );
     })}
     ```

---

### 3.2 Fix for PS-D02 & PS-D03: Atomic & Validated Reorder Endpoint

#### Strategy
Coordinate PS-D02 and PS-D03 into a unified, hardened implementation in `AdminSubscriptionPlanController.reorderPlans`:
1. Annotate `@Transactional` on the method to establish a clear database transaction boundary.
2. Validate that `planIds` is non-null and non-empty; throw `IllegalArgumentException` (which `GlobalExceptionHandler` converts to HTTP 400 Bad Request).
3. Validate that `planIds` contains no null elements and no duplicate IDs.
4. Verify that the submitted list represents a complete permutation of all existing plans in the database, preventing order collisions and orphaned display indices.
5. Apply new sequential orders (0, 1, 2...) in memory and persist via `planRepository.saveAll(...)`.

#### File: `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java`
- **Location**: Method `reorderPlans`, lines 69–80
- **Proposed Code Replacement**:

```java
    @Transactional
    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderPlans(@RequestBody(required = false) List<Long> planIds) {
        if (planIds == null || planIds.isEmpty()) {
            throw new IllegalArgumentException("Plan IDs list cannot be null or empty");
        }

        if (planIds.contains(null)) {
            throw new IllegalArgumentException("Plan IDs list cannot contain null elements");
        }

        Set<Long> uniqueIds = new HashSet<>(planIds);
        if (uniqueIds.size() != planIds.size()) {
            throw new IllegalArgumentException("Plan IDs list cannot contain duplicate IDs");
        }

        List<SubscriptionPlan> allPlans = planRepository.findAll();
        if (allPlans.size() != planIds.size()) {
            throw new IllegalArgumentException(String.format(
                    "Reorder list must contain all %d subscription plans (received %d)",
                    allPlans.size(), planIds.size()));
        }

        Map<Long, SubscriptionPlan> planMap = allPlans.stream()
                .collect(Collectors.toMap(SubscriptionPlan::getId, p -> p));

        for (Long id : planIds) {
            if (!planMap.containsKey(id)) {
                throw new IllegalArgumentException("Plan ID not found: " + id);
            }
        }

        for (int i = 0; i < planIds.size(); i++) {
            SubscriptionPlan plan = planMap.get(planIds.get(i));
            plan.setDisplayOrder(i);
        }

        planRepository.saveAll(allPlans);
        return ResponseEntity.ok().build();
    }
```

---

## 4. Validation and Error-Response Behavior

| Scenario | Input Condition | Exception Thrown | HTTP Status | Response Body |
| :--- | :--- | :--- | :--- | :--- |
| **Null Body** | `null` payload | `IllegalArgumentException("Plan IDs list cannot be null or empty")` | `400 BAD_REQUEST` | `{"error": "Plan IDs list cannot be null or empty"}` |
| **Empty List** | `[]` payload | `IllegalArgumentException("Plan IDs list cannot be null or empty")` | `400 BAD_REQUEST` | `{"error": "Plan IDs list cannot be null or empty"}` |
| **Null Element** | `[1, null, 2]` | `IllegalArgumentException("Plan IDs list cannot contain null elements")` | `400 BAD_REQUEST` | `{"error": "Plan IDs list cannot contain null elements"}` |
| **Duplicates** | `[1, 2, 1]` | `IllegalArgumentException("Plan IDs list cannot contain duplicate IDs")` | `400 BAD_REQUEST` | `{"error": "Plan IDs list cannot contain duplicate IDs"}` |
| **Missing IDs** | `[1, 2]` (when 4 plans exist) | `IllegalArgumentException("Reorder list must contain all 4 subscription plans (received 2)")` | `400 BAD_REQUEST` | `{"error": "Reorder list must contain all 4 subscription plans (received 2)"}` |
| **Unknown ID** | `[1, 2, 9999, 4]` | `IllegalArgumentException("Plan ID not found: 9999")` | `400 BAD_REQUEST` | `{"error": "Plan ID not found: 9999"}` |
| **Valid Order** | Complete list of all IDs | None | `200 OK` | Empty response body |
| **Database Failure Mid-Save** | DB connection drops or constraint failure | `DataAccessException` / `RuntimeException` | `500 INTERNAL_SERVER_ERROR` | Transaction automatically rolls back; zero partial display-order commits. |

---

## 5. Test Plan with Expected Outcomes

### 5.1 Frontend Verification Tests (PS-D01)
Create test file: `frontend_v2/__tests__/bakeryDetailsSubscriptionMapping.test.mjs` using the native Node.js test runner (`node --test`):

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching proposed page.tsx mapping logic
function resolveSubscriptionDetails(sub) {
  if (!sub) {
    return {
      planTitle: 'No Active Plan',
      quickPlanTitle: 'Starter Bakery',
      amountDisplay: '—',
      startDateDisplay: '—',
      expiryDateDisplay: '—',
      daysLeft: null,
      isExpired: false,
    };
  }

  const planTitle = sub.plan?.name || sub.planName || 'No Active Plan';
  const quickPlanTitle = sub.plan?.name || sub.planName || 'Starter Bakery';
  const amountDisplay = sub.amount ? `₹${sub.amount} / billing cycle` : '—';
  const expiryRaw = sub.expiryDate || sub.endDate;
  const startRaw = sub.startDate;

  const startDateDisplay = startRaw ? new Date(startRaw).toLocaleDateString('en-IN') : '—';
  const expiryDateDisplay = expiryRaw ? new Date(expiryRaw).toLocaleDateString('en-IN') : '—';

  let daysLeft = null;
  let isExpired = false;
  if (expiryRaw) {
    daysLeft = Math.ceil((new Date(expiryRaw).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    isExpired = daysLeft < 0;
  }

  return { planTitle, quickPlanTitle, amountDisplay, startDateDisplay, expiryDateDisplay, daysLeft, isExpired };
}

test('PS-D01: Subscription mapping correctly binds entity structure (plan.name, expiryDate)', () => {
  const entityResponse = {
    id: 101,
    plan: { id: 10, name: 'Pro Baker Studio', price: 999 },
    amount: 999,
    startDate: '2026-10-01T00:00:00',
    expiryDate: '2026-11-01T00:00:00',
    status: 'ACTIVE'
  };

  const res = resolveSubscriptionDetails(entityResponse);
  assert.equal(res.planTitle, 'Pro Baker Studio');
  assert.equal(res.quickPlanTitle, 'Pro Baker Studio');
  assert.equal(res.amountDisplay, '₹999 / billing cycle');
  assert.notEqual(res.expiryDateDisplay, '—');
  assert.ok(typeof res.daysLeft === 'number');
});

test('PS-D01: Subscription mapping preserves backward-compatibility with flat structure (planName, endDate)', () => {
  const flatResponse = {
    id: 102,
    planName: 'Growth Baker Tier',
    amount: 1499,
    startDate: '2026-09-01T00:00:00',
    endDate: '2026-10-01T00:00:00',
    status: 'EXPIRED'
  };

  const res = resolveSubscriptionDetails(flatResponse);
  assert.equal(res.planTitle, 'Growth Baker Tier');
  assert.equal(res.quickPlanTitle, 'Growth Baker Tier');
  assert.equal(res.amountDisplay, '₹1499 / billing cycle');
  assert.notEqual(res.expiryDateDisplay, '—');
});

test('PS-D01: Null or empty subscription falls back to default empty state', () => {
  const res = resolveSubscriptionDetails(null);
  assert.equal(res.planTitle, 'No Active Plan');
  assert.equal(res.quickPlanTitle, 'Starter Bakery');
  assert.equal(res.amountDisplay, '—');
  assert.equal(res.startDateDisplay, '—');
  assert.equal(res.expiryDateDisplay, '—');
  assert.equal(res.daysLeft, null);
});
```

### 5.2 Backend Verification Tests (PS-D02 & PS-D03)
Create test file: `backend/src/test/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanControllerTest.java` using Spring Boot `@WebMvcTest` or mock controller tests:

1. `testReorderPlans_Success_UpdatesDisplayOrderSequentially`:
   - Mock repository returning plans with IDs `10L, 20L, 30L`.
   - Pass payload `[30L, 10L, 20L]`.
   - Verify `saveAll` is called with plans having `displayOrder` 0, 1, and 2 respectively.
   - Status: `200 OK`.
2. `testReorderPlans_NullPayload_Throws400`:
   - Pass `null` request body.
   - Assert `400 BAD_REQUEST` with error message `"Plan IDs list cannot be null or empty"`.
3. `testReorderPlans_EmptyPayload_Throws400`:
   - Pass `[]`.
   - Assert `400 BAD_REQUEST` with error message `"Plan IDs list cannot be null or empty"`.
4. `testReorderPlans_DuplicateIds_Throws400`:
   - Pass `[10L, 20L, 10L]`.
   - Assert `400 BAD_REQUEST` with error message `"Plan IDs list cannot contain duplicate IDs"`.
5. `testReorderPlans_PartialList_Throws400`:
   - DB has 3 plans; pass `[10L, 20L]`.
   - Assert `400 BAD_REQUEST` with error message containing `"must contain all 3 subscription plans"`.
6. `testReorderPlans_NonExistentId_Throws400`:
   - Pass `[10L, 20L, 9999L]`.
   - Assert `400 BAD_REQUEST` with error message containing `"Plan ID not found: 9999"`.
7. `testReorderPlans_TransactionRollbackOnException`:
   - Simulate `DataAccessException` on `saveAll`.
   - Verify `@Transactional` ensures no intermediate database records are modified.
8. `testReorderPlans_Security_NonAdminForbidden`:
   - Perform request as `ROLE_SHOP_OWNER`.
   - Verify `403 FORBIDDEN`.

---

## 6. Regression Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Frontend Date Formatting Breakage** | Low | Low | Use defensive fallback: `sub.expiryDate || sub.endDate`. Wrap date parsing in null checks so missing or malformed ISO strings gracefully render `'—'`. |
| **Frontend Reorder Fails on Partial List** | Low | Medium | Verify that `frontend_v2/app/admin/plans/page.tsx` line 79 always sends `plans.map(p => p.id)`. The frontend loads the complete plan list from `getAllPlans()` and never sends partial arrays. |
| **Concurrent Plan Creation During Reorder** | Very Low | Low | If another admin creates a plan simultaneously, the count check will safely reject with a 400 error requiring a catalog refresh (`loadPlans()`), preventing orphaned display order values. |
| **Database Lock Contention** | Very Low | Low | The plans table contains small record sets (<20 rows). Executing `saveAll` in a single transaction takes <5ms, minimizing lock duration. |

---

## 7. Dependencies Between the Three Fixes

```
┌────────────────────────────────────────────────────────┐
│ PS-D01: Bakery Details Subscription Mapping            │
│ (Frontend Only: types/admin.ts & shops/[id]/page.tsx) │
└────────────────────────────────────────────────────────┘
                       ▲
                       │ (Completely Independent)
                       ▼
┌────────────────────────────────────────────────────────┐
│ PS-D02: Non-Atomic Reordering (@Transactional)         │
│                        +                               │
│ PS-D03: Request Validation Guards (400 Bad Request)    │
│ (Backend: AdminSubscriptionPlanController.java)        │
└────────────────────────────────────────────────────────┘
```

- **PS-D01** is entirely decoupled from PS-D02 and PS-D03. It fixes a frontend data visualization mismatch on the Bakery Details page without altering backend endpoints.
- **PS-D02** and **PS-D03** share the exact same method (`AdminSubscriptionPlanController.reorderPlans`). They must be implemented and deployed together in a single coordinated backend update to ensure both atomicity and validation guards are active simultaneously.

---

## 8. Explicit Confirmation

**STRICT READ-ONLY COMPLIANCE CONFIRMATION**:
- Zero source code files were modified, created, or deleted (aside from creating this planning document).
- Zero database records, migrations, schema definitions, or test fixtures were altered.
- Zero Git branches, commits, stashes, or configuration settings were changed.
- No network payment calls, email dispatches, or state-altering commands were executed.
- The plan is ready for review and implementation will begin only upon explicit user approval.
