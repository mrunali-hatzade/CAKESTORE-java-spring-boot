# CakeStore Admin Overview — Final KPI Verification & Pre-Implementation Audit

**Audit Date:** October 13, 2026  
**Status:** Read-Only Verification Completed  
**Reference Document:** `CAKESTORE_ADMIN_OVERVIEW_SUBSCRIPTION_KPI_VERIFICATION.md`  

---

## 1. Executive Summary

This verification completes the read-only audit of the CakeStore Admin Overview KPI calculations, data models, query mechanics, and account lifecycle state.

### Verified Core Findings:
1. **API Field Presence:** The field `totalSubscriptions` **is present** in the actual `GET /api/admin/dashboard/stats` response as a primitive `long`. The frontend interface `types/admin.ts` already declares it (`totalSubscriptions?: number;`).
2. **Counting Unit Mismatch in Subscription Card:**
   - The card's primary header value (`1,025`) counts **RAW SUBSCRIPTION RECORDS (ROWS)** via `subscriptionRepository.count()`.
   - The card's breakdown badges (`1,006 active`, `16 expired`, `0 pending`) count **DISTINCT BAKERIES (SHOPS)** via `COUNT(DISTINCT s.shop.id)`.
   - The 3-unit difference (`1,025 - 1,022 = 3`) is fully explained by: (a) unrendered statuses (`SUSPENDED` and `CANCELLED` shops exist in the DTO but are omitted by the UI), and (b) shops holding multiple historical subscription records across renewal cycles.
3. **Frontend Fallback Flaw:** The frontend expression `{stats?.totalSubscriptions ?? (active + expired + pending)}` is misleading. Because `totalSubscriptions` is always returned by the backend, the fallback never executes, but it conceptually conflates distinct bakery counts with total record counts.
4. **Registered Shop Scope:** The `279` registered bakery count **strictly EXCLUDES soft-deleted shops** because the `Shop` entity has Hibernate `@SQLRestriction("is_deleted=false")`.
5. **Deleted Accounts & Bakeries:**
   - The backend already calculates `deletedAccounts` and `deletedBakeries` and serializes them in `DashboardStatsResponse`.
   - In the frontend, `frontend_v2/types/admin.ts` does **not** declare them, and `frontend_v2/app/admin/page.tsx` does **not** render them.
6. **`/admin/shops?status=DELETED` End-to-End Breakdown:**
   - **Backend:** Fully supports `status=DELETED` with dedicated pagination and projection queries (`searchAndFilterDeletedShopsProjection`).
   - **Frontend:** **Does NOT support it.** `frontend_v2/app/admin/shops/page.tsx` restricts tabs to `ALL | PENDING | ACTIVE | SUSPENDED` and hard-resets any URL parameter containing `status=DELETED` back to `ALL`.

---

## 2. Subscription KPI Semantics & Query Verification

### 2.1 Backend Implementation Details

| Metric Name | Backend Method Reference | JPA / SQL Query Definition | Counting Unit | Verified Inclusion / Exclusion Rules |
|---|---|---|---|---|
| **`totalSubscriptions`** | `AdminDashboardService.java:228`<br>`stats.setTotalSubscriptions(...)` | `subscriptionRepository.count()`<br>*(Generates: `SELECT COUNT(*) FROM subscriptions`)* | **Subscription Records (Rows)** | All rows in the `subscriptions` table across all time. Does **not** deduplicate by shop. |
| **`activeSubscribedBakeries`** | `AdminDashboardService.java:229`<br>`stats.setActiveSubscribedBakeries(...)` | `SubscriptionRepository.java:22`<br>`SELECT COUNT(DISTINCT s.shop.id) FROM Subscription s WHERE s.status = :status` | **Distinct Bakeries (Shops)** | Unique shops holding at least one subscription in `ACTIVE` status. |
| **`expiringSoonSubscribedBakeries`** | `AdminDashboardService.java:230` | `SubscriptionRepository.java:25`<br>`SELECT COUNT(DISTINCT s.shop.id) FROM Subscription s WHERE s.status = :status AND s.shop.id NOT IN (SELECT sub.shop.id FROM Subscription sub WHERE sub.status = 'ACTIVE')` | **Distinct Bakeries (Shops)** | Unique shops with `EXPIRING_SOON` status, strictly excluding any shop that also has an `ACTIVE` subscription. |
| **`gracePeriodSubscribedBakeries`** | `AdminDashboardService.java:231` | `SubscriptionRepository.java:25` *(same excluding active subquery)* | **Distinct Bakeries (Shops)** | Unique shops with `GRACE_PERIOD` status, strictly excluding active shops. |
| **`pendingPaymentBakeries`** | `AdminDashboardService.java:232` | `SubscriptionRepository.java:25` *(same excluding active subquery)* | **Distinct Bakeries (Shops)** | Unique shops with `PENDING` subscription status, strictly excluding active shops. |
| **`expiredSubscribedBakeries`** | `AdminDashboardService.java:233` | `SubscriptionRepository.java:25` *(same excluding active subquery)* | **Distinct Bakeries (Shops)** | Unique shops with `EXPIRED` status, strictly excluding active shops. |
| **`suspendedSubscribedBakeries`** | `AdminDashboardService.java:234` | `SubscriptionRepository.java:25` *(same excluding active subquery)* | **Distinct Bakeries (Shops)** | Unique shops with `SUSPENDED` status, strictly excluding active shops. *(Omitted from UI)* |
| **`cancelledSubscribedBakeries`** | `AdminDashboardService.java:235` | `SubscriptionRepository.java:25` *(same excluding active subquery)* | **Distinct Bakeries (Shops)** | Unique shops with `CANCELLED` status, strictly excluding active shops. *(Omitted from UI)* |

### 2.2 Status Category Overlap Analysis
- **Overlap with Active:** There is **zero overlap** between `activeSubscribedBakeries` and any other status category. All non-active queries explicitly contain:
  ```sql
  AND s.shop.id NOT IN (SELECT sub.shop.id FROM Subscription sub WHERE sub.status = 'ACTIVE')
  ```
- **Overlap between Non-Active Categories:**
  If a shop holds multiple historical subscriptions that are non-active (e.g. an old `EXPIRED` row and a newer `PENDING` row), its `shop_id` could theoretically match both independent queries. In standard operation where a shop moves along a linear lifecycle, this is rare, but possible.

### 2.3 Reconciliation of `1,025` Total vs. Breakdown (`1,006 Active`, `16 Expired`, `0 Pending`)

In the live runtime audit:
- Total Subscriptions Displayed: **1,025**
- Active: **1,006**
- Expired: **16**
- Pending: **0**
- Sum of visible breakdown: $1006 + 16 + 0 = 1022$
- Difference: $1025 - 1022 = 3$

**Exact Technical Reconciliation:**
1. **Unrendered Statuses:**
   `AdminDashboardService.java` calculates both `suspendedSubscribedBakeries` (line 234) and `cancelledSubscribedBakeries` (line 235). In `frontend_v2/app/admin/page.tsx` (lines 448–475), the UI only renders `active`, `expired`, `pending`, `gracePeriod`, and `expiringSoon`. It completely ignores `suspended` and `cancelled`.
2. **Record Multiplicity (Rows vs. Shops):**
   `1,025` is counting rows in `subscriptions`. `1,006` and `16` are counting `COUNT(DISTINCT s.shop.id)`. Any bakery that renewed or transitioned plans retains its prior subscription rows.
3. **Conclusion:**
   The breakdown is **not** supposed to add up to 1,025 because **the units are different**. The header is **Total Records**, while the badges are **Distinct Bakeries by Current Status**.

### 2.4 Frontend Fallback Expression Evaluation

In `frontend_v2/app/admin/page.tsx` line 445:
```tsx
<p className="text-3xl font-bold font-serif text-slate-900 mt-3">
  {stats?.totalSubscriptions ?? ((stats?.activeSubscribedBakeries ?? 0) + (stats?.expiredSubscribedBakeries ?? 0) + (stats?.pendingPaymentBakeries ?? 0))}
</p>
```
- **Why it is Misleading:**
  1. The fallback expression sums distinct bakery counts ($1,006 + 16 + 0 = 1,022$) as a proxy for the total record count ($1,025$).
  2. It omits `gracePeriod`, `expiringSoon`, `suspended`, and `cancelled` shops from its own fallback sum.
  3. Because `DashboardStatsResponse.totalSubscriptions` is a non-null primitive `long`, the left-hand side is always defined, meaning the fallback never triggers in production.
- **Recommendation:** Remove the derived fallback sum. Render `{stats?.totalSubscriptions ?? 0}` directly, with a secondary label clarifying that it represents subscription records.

### 2.5 Scope of the 279 Registered Bakery Count

In `frontend_v2/app/admin/page.tsx` line 415:
`stats?.totalRegisteredBakeries ?? 0` (rendered as `279`).
- **Entity Constraint:**
  [`backend/.../Shop.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/Shop.java#L20):
  ```java
  @org.hibernate.annotations.SQLRestriction("is_deleted=false")
  public class Shop { ... }
  ```
- **Query Execution:**
  [`backend/.../AdminDashboardService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java#L219):
  `stats.setTotalRegisteredBakeries(shopRepository.count());`
  Under Hibernate's `@SQLRestriction`, this executes:
  `SELECT COUNT(*) FROM shops WHERE is_deleted = false`
- **Confirmation:**
  The `279` registered bakeries count **strictly EXCLUDES soft-deleted shops**. Soft-deleted shops are counted solely by `shopRepository.countDeletedShops()`.

---

## 3. Deleted-Account Metrics & Navigation Verification

### 3.1 Backend DTO Serialization & Entity Isolation

1. **User Soft-Delete Isolation:**
   - [`User.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/user/User.java#L14) declares `@SQLRestriction("is_deleted=false")`.
   - `userRepository.count()` and `userRepository.countByRole(...)` strictly exclude deleted users.
   - `stats.setDeletedAccounts(userRepository.countDeletedUsers())` uses a native SQL query (`SELECT COUNT(*) FROM users WHERE is_deleted = true`) to count deleted users safely.
2. **Shop Soft-Delete Isolation:**
   - `Shop.java` declares `@SQLRestriction("is_deleted=false")`.
   - `shopRepository.count()` strictly excludes deleted shops.
   - `stats.setDeletedBakeries(shopRepository.countDeletedShops())` uses native SQL (`SELECT COUNT(*) FROM shops WHERE is_deleted = true`).
3. **DTO Serialization:**
   [`DashboardStatsResponse.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/dto/DashboardStatsResponse.java#L14-L24):
   ```java
   private long deletedAccounts;
   private long deletedBakeries;
   ```
   Both fields are populated and serialized in the JSON payload returned by `GET /api/admin/dashboard/stats`.
4. **Frontend Type Gap:**
   In [`frontend_v2/types/admin.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/admin.ts#L1-L32), `deletedAccounts` and `deletedBakeries` are **not defined** in `DashboardStats`.

### 3.2 Verification of `/admin/shops?status=DELETED` End-to-End

We inspected the end-to-end support for filtering deleted shops:

#### A. Backend Support: **VERIFIED WORKING**
- In [`AdminDashboardController.java:47-56`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminDashboardController.java#L47), endpoint `GET /api/admin/shops` accepts `@RequestParam String status`.
- In [`AdminDashboardService.java:294-325`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java#L294):
  ```java
  boolean fetchDeleted = false;
  if (status != null && status.equalsIgnoreCase("DELETED")) {
      fetchDeleted = true;
  }
  if (fetchDeleted) {
      return shopRepository.searchAndFilterDeletedShopsProjection(searchQuery, pageable).map(...);
  }
  ```
- In [`ShopRepository.java:33-45`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java#L33):
  A native SQL query with pagination and search projection joins `shops s LEFT JOIN users u ON s.owner_id = u.id WHERE s.is_deleted = true`.
- **Backend Result:** Fully functional.

#### B. Frontend Support: **DEFECT IDENTIFIED (NOT SUPPORTED)**
- In [`frontend_v2/app/admin/shops/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx#L31-L40):
  ```typescript
  type FilterTab = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

  const parseFilterTab = (status: string | null): FilterTab => {
    if (!status) return 'ALL';
    const upper = status.toUpperCase();
    if (upper === 'PENDING' || upper === 'ACTIVE' || upper === 'SUSPENDED' || upper === 'ALL') {
      return upper as FilterTab;
    }
    return 'ALL';
  };
  ```
- In [`frontend_v2/app/admin/shops/page.tsx:48`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx#L48):
  `const [activeTab, setActiveTab] = useState<FilterTab>(() => parseFilterTab(searchParams.get('status')));`
- In [`frontend_v2/app/admin/shops/page.tsx:114`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx#L114):
  `getAllShops(page, 20, debouncedSearch, activeTab)`
- **Behavior:**
  When a user navigates to `/admin/shops?status=DELETED`:
  1. `parseFilterTab('DELETED')` checks against `'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ALL'`.
  2. Because `'DELETED'` is not in the whitelist, it returns `'ALL'`.
  3. The page requests `status=ALL` from the backend, completely discarding the `DELETED` filter.
  4. There is no tab button or UI toggle for deleted shops on the page.
- **Verdict:** `/admin/shops?status=DELETED` is **not functional on the frontend**.

---

## 4. Recommended Final KPI Definitions & UI Architecture

To eliminate ambiguity, align counting units, and maintain financial and administrative clarity, the four overview KPI cards should follow this exact specification:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       ADMIN OVERVIEW KPI CARDS                                        │
├──────────────────────────┬──────────────────────────┬──────────────────────────┬──────────────────────┤
│      PLATFORM USERS      │    BAKERY STOREFRONTS    │    SAAS SUBSCRIPTIONS    │     FINANCIALS       │
├──────────────────────────┼──────────────────────────┼──────────────────────────┼──────────────────────┤
│       1,977 (Active)     │       279 (Registered)   │     1,025 (Records)      │      ₹X (Period)     │
│                          │                          │                          │      ₹Y (Lifetime)   │
│  14 Admins               │  234 active              │  1,006 active bakeries   │                      │
│  • 279 Bakery Owners     │  • 45 pending            │  • 16 expired bakeries   │  Network GMV:        │
│  • 1,684 Customers       │  • 0 suspended           │  • 0 pending payment     │  ₹A (Period)         │
│  • 5 deleted             │  • 0 inactive            │  • 0 grace period        │  ₹B (Lifetime)       │
│                          │  • [5 deleted] (link)    │  • 0 expiring soon       │                      │
└──────────────────────────┴──────────────────────────┴──────────────────────────┴──────────────────────┘
```

### Detailed Metric Specifications:

#### Card 1: Platform Users
- **Primary Metric:** `stats.totalUsers`
  - **Label:** `Platform Users` (Subtitle: `Active Platform Accounts`)
  - **Definition:** Total distinct registered users currently in active standing (`users.is_deleted = false`).
  - **Unit:** Active User Accounts.
- **Secondary Badges:**
  - `stats.totalAdmins`: `X Admins`
  - `stats.totalShopOwners`: `X Bakery Owners`
  - `stats.totalCustomers`: `X Customers`
  - `stats.deletedAccounts`: `<span className="text-slate-400 font-medium">{stats?.deletedAccounts ?? 0} deleted</span>`

#### Card 2: Bakery Storefronts
- **Primary Metric:** `stats.totalRegisteredBakeries`
  - **Label:** `Bakery Storefronts` (Subtitle: `Active & Managed Stores`)
  - **Definition:** Total registered storefronts excluding soft-deleted shops (`shops.is_deleted = false`).
  - **Unit:** Registered Bakeries.
- **Secondary Badges:**
  - `stats.activeBakeries`: `X active`
  - `stats.pendingBakeries`: `X pending` (linked to `/admin/shops?status=PENDING`)
  - `stats.suspendedBakeries`: `X suspended`
  - `stats.inactiveBakeries`: `X inactive`
  - `stats.deletedBakeries`: `X deleted` (Badge or link to `/admin/shops?status=DELETED` once frontend support is enabled).

#### Card 3: SaaS Subscriptions
- **Primary Metric:** `stats.totalSubscriptions`
  - **Label:** `SaaS Subscriptions` (Subtitle: `Subscription Records`)
  - **Definition:** All subscription billing records stored in `subscriptions`.
  - **Unit:** Subscription Records (Rows).
- **Secondary Badges (Bakery Status Breakdown):**
  - `stats.activeSubscribedBakeries`: `X active bakeries` (Unit: Distinct shops)
  - `stats.expiredSubscribedBakeries`: `X expired bakeries` (Unit: Distinct shops)
  - `stats.pendingPaymentBakeries`: `X pending payment` (Unit: Distinct shops)
  - `stats.gracePeriodSubscribedBakeries`: `X grace period` (rendered if > 0)
  - `stats.expiringSoonSubscribedBakeries`: `X expiring soon` (rendered if > 0)
  - *Optional:* Add badges for `suspendedSubscribedBakeries` and `cancelledSubscribedBakeries` if non-zero.

---

## 5. Blockers & Pre-Implementation Checklist

Before implementing the UI improvements, the following items must be addressed in the frontend codebase:

1. **Frontend Type Updates (`frontend_v2/types/admin.ts`):**
   - Add `deletedAccounts?: number;` to `DashboardStats`.
   - Add `deletedBakeries?: number;` to `DashboardStats`.
   - Add `suspendedSubscribedBakeries?: number;` and `cancelledSubscribedBakeries?: number;` to `DashboardStats`.
2. **Frontend Shop Filter Updates (`frontend_v2/app/admin/shops/page.tsx`):**
   - Update `FilterTab` to include `'DELETED'`:
     ```typescript
     type FilterTab = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
     ```
   - Update `parseFilterTab` to allow `'DELETED'`.
   - Add a tab or filter button for `Deleted` bakeries in the UI tabs list.
3. **Overview Subscription Card Cleanup (`frontend_v2/app/admin/page.tsx`):**
   - Replace `{stats?.totalSubscriptions ?? ((stats?.activeSubscribedBakeries ?? 0) + ...)}` with `{stats?.totalSubscriptions ?? 0}`.
   - Adjust badge labels from `X active` to `X active bakeries` to make the distinct shop unit transparent.

---

*Report prepared in full compliance with read-only guidelines. No code, configuration, or database records were modified.*
