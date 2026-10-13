# CakeStore Admin Overview — Final End-to-End Audit Report

**Date of Audit:** October 13, 2026  
**Audit Type:** Final Comprehensive Read-Only Audit (Functional, Data-Accuracy, Security, Usability, Performance, Non-Functional)  
**Target Surface:** CakeStore Super Admin Overview (`/admin`)  
**Audit Status:** Complete  

---

## 1. Executive Verdict

### **VERDICT: PASS WITH WARNINGS**

The CakeStore Admin Overview at `/admin` has successfully passed this comprehensive end-to-end audit. The dashboard is functionally robust, data-accurate, and production-ready following the Phase 2 light-theme redesign and Phase 3 layout and wording optimizations.

#### Key Verdict Highlights:
1. **Financial Integrity & Revenue Segregation (PASS):** Platform subscription revenue and bakery retail GMV are strictly segregated at every architectural layer (database queries, service calculations, API DTOs, and UI cards/charts). At no point is bakery retail GMV conflated as platform income, and the 0% platform commission model is clearly communicated.
2. **Data Accuracy & Soft-Delete Semantics (PASS):** Platform User and Bakery KPI counts accurately leverage Hibernate `@SQLRestriction("is_deleted=false")` for active entities, while deleted accounts and deleted bakeries use dedicated native SQL queries (`is_deleted=true`). The counts are mathematically disjoint and do not double-count.
3. **Security & Authorization (PASS):** All admin endpoints are protected by Spring Security `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`. The frontend layout enforces role verification and redirects unauthorized visitors. Crucially, payment gateway configuration responses return boolean flags (`razorpayKeySecretConfigured`, `razorpayWebhookSecretConfigured`) rather than plaintext secrets.
4. **Resilience & Fault Tolerance (PASS):** Peripheral API failures (Activity stream, Communication summaries, Global Settings) are isolated using `.catch(...)` fallbacks, preventing cascade failures and ensuring the dashboard never hangs in an infinite loading state.
5. **Warnings (Non-blocking):**
   - **Warning 1 (Low):** The frontend date filter uses `date.toISOString().split('T')[0]`, which computes UTC date strings. For users in `Asia/Kolkata` (UTC+5:30) between 12:00 AM and 5:30 AM IST, the generated date string reflects the previous UTC day.
   - **Warning 2 (Informational):** In the "Bakery Plans & Subscriptions" card, the headline metric (`totalSubscriptions`) counts historical subscription records, while the secondary status breakdown pills count distinct bakeries. Subtitles clarify this distinction, but an explicit informational tooltip would further assist administrators.

---

## 2. Scope & Files Inspected

This audit was conducted strictly in **read-only mode**. No source code, database tables, or Git states were altered.

### Frontend Components & Files:
- [frontend_v2/app/admin/page.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/page.tsx) — Main overview page, state management, KPI cards, tables, action center, and activity stream.
- [frontend_v2/components/admin/AnalyticsCharts.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AnalyticsCharts.tsx) — 6-month SaaS revenue and GMV chart visualizations.
- [frontend_v2/app/admin/layout.tsx](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx) — Admin shell layout, sidebar navigation, top header, command palette, and auth guard.
- [frontend_v2/types/admin.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/admin.ts) — TypeScript interfaces for dashboard stats, shop summaries, and admin models.
- [frontend_v2/lib/api/admin.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/admin.ts) — API client functions (`getPlatformStats`, `getAllShops`, `getRevenueAnalytics`, `getRecentActivity`).
- [frontend_v2/lib/api/communication.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts) — Operational communication summary client.
- [frontend_v2/lib/api/adminSettings.ts](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/adminSettings.ts) — Gateway settings client.

### Backend Services, Controllers, Entities & Repositories:
- [backend/.../controller/AdminDashboardController.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminDashboardController.java) — REST endpoints for stats, activity, analytics, and shops.
- [backend/.../AdminDashboardService.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java) — Business logic, date window parsing, and analytical metric aggregation.
- [backend/.../dto/DashboardStatsResponse.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/dto/DashboardStatsResponse.java) — Primary response DTO for dashboard metrics.
- [backend/.../user/User.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/user/User.java) & [UserRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/user/UserRepository.java) — Soft delete annotations and user query semantics.
- [backend/.../shop/Shop.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/Shop.java) & [ShopRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java) — Bakery lifecycle counts and deleted shop queries.
- [backend/.../subscription/SubscriptionRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/subscription/SubscriptionRepository.java) — Unique bakery subscription status queries.
- [backend/.../payment/PaymentRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/PaymentRepository.java) — SaaS subscription revenue queries.
- [backend/.../order/OrderRepository.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java) — Realized bakery retail GMV aggregation queries.
- [backend/.../settings/dto/GlobalSettingsResponse.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/dto/GlobalSettingsResponse.java) — Settings DTO and secret masking.

---

## 3. Feature-by-Feature Verification Matrix

| Area / Feature | Component / Method | Status | Verification Observations |
| :--- | :--- | :---: | :--- |
| **Date Range Filter** | `handleDateRangeChange` | **PASS** | Supports All Time, Last 7 Days, Last 30 Days, This Month, This Year. Sends `startDate` and `endDate` query params to `GET /api/admin/dashboard/stats`. |
| **Live Refresh Handling** | `adminGlobalRefresh` event | **PASS** | Event listener in `useEffect` re-triggers `loadData(true)`. Unsubscribes cleanly on unmount. |
| **Loading & Spinner States** | `LoadingState`, `isFiltering` | **PASS** | Initial load displays full-page loader; date changes display non-blocking inline "Updating..." indicator without jarring layout shifts. |
| **Error Handling & Recovery** | `Promise.all` with individual catches | **PASS** | Secondary API errors do not fail the whole dashboard; failure triggers non-destructive toast notification and resets loading flags. |
| **Action Alert: Gateway Config** | `gatewayAlert` memo | **PASS** | Triggers only if `razorpayKeyId`, `razorpayKeySecretConfigured`, or `razorpayWebhookSecretConfigured` is missing. Directs to `/admin/settings`. |
| **Action Alert: Pending Bakeries** | Pending count banner | **PASS** | Triggers only if `stats.pendingBakeries > 0`. Links directly to `/admin/shops?status=PENDING`. |
| **KPI Card 1: Users** | `Card` (Platform Users) | **PASS** | Accurately renders total non-deleted users, with breakdown for Admins, Owners, Customers, and soft-deleted accounts (`deletedAccounts`). |
| **KPI Card 2: Bakeries** | `Card` (Registered Bakeries) | **PASS** | Renders total bakeries, with breakdown for Active, Pending (clickable link), Suspended, Inactive, and Deleted (`deletedBakeries` link). |
| **KPI Card 3: Subscriptions** | `Card` (Plans & Subscriptions) | **PASS** | Shows total historical subscription records, with breakdowns for Active, Expired, Pending, Grace, Expiring Soon, Suspended, and Cancelled shops. |
| **KPI Card 4: Financials** | `Card` (Subscription Revenue) | **PASS** | Displays SaaS subscription revenue. Highlights lifetime revenue for bounded filters. Contains segregated Bakery Sales (GMV) callout pill with "0% platform fee". |
| **6-Month Trend Charts** | `AnalyticsCharts.tsx` | **PASS** | Loads from `/api/admin/dashboard/stats/analytics/revenue`. Visualizes SaaS revenue (emerald line) and GMV (indigo bar) separately. Includes INR formatting and retry button. |
| **Platform Management Shortcuts** | Quick Action Cards | **PASS** | 3 links: "Manage Bakeries" (`/admin/shops`), "Manage Plans & Pricing" (`/admin/plans`), and "Announcements" (`/admin/messages`). |
| **Operational Communications** | Feedback & Enquiry Cards | **PASS** | Shows unread counts for Feedback & Reviews and Customer Enquiries. "Unavailable" pill shown gracefully if API fails. |
| **Recently Registered Bakeries** | Full-width Table | **PASS** | Displays top 5 recent bakeries with business name, ID, owner details, formatted date, live status badge, Storefront link (`/shop/:id`), and Manage link (`/admin/shops/:id`). |
| **Recent Platform Activity** | Audit Stream Card | **PASS** | Relocated below table. Displays top 50 global audit events with humanized action labels, entity badges, relative and exact timestamps, and shop links. |

---

## 4. Data Lineage & Metric Reconciliation

### 4.1. Platform Users & Soft Deletion Semantics
- **User Entity Annotations:**
  ```java
  @SQLDelete(sql = "UPDATE users SET is_deleted = true WHERE id=?")
  @SQLRestriction("is_deleted=false")
  ```
- **Active User Counts:**
  `userRepository.count()`, `countByRole(ADMIN)`, `countByRole(SHOP_OWNER)`, and `countByRole(CUSTOMER)` are standard Spring Data JPA queries. Hibernate automatically injects `WHERE is_deleted=false`.
- **Deleted Accounts Count:**
  ```java
  @Query(value = "SELECT COUNT(*) FROM users WHERE is_deleted = true", nativeQuery = true)
  long countDeletedUsers();
  ```
  This native SQL query bypasses Hibernate's `@SQLRestriction`, accurately returning the total number of soft-deleted accounts.
- **Reconciliation & Mathematical Proof:**
  $$\text{Total Users} = \text{Admins} + \text{Shop Owners} + \text{Customers}$$
  $\text{Deleted Accounts}$ is completely disjoint from $\text{Total Users}$. There is zero double-counting.

### 4.2. Registered Bakeries & Lifecycle Status
- **Active / Pending / Suspended / Inactive:**
  Calculated via `shopRepository.countByStatus(ShopStatus.<STATUS>)`. Hibernate `@SQLRestriction("is_deleted=false")` ensures deleted shops are excluded.
- **Deleted Bakeries Count:**
  Calculated via native query `SELECT COUNT(*) FROM shops WHERE is_deleted = true`.
- **Filter Linking:**
  Clicking "pending" navigates to `/admin/shops?status=PENDING`. Clicking "deleted" navigates to `/admin/shops?status=DELETED`. Both filters map to verified backend query branches in `AdminDashboardService.getAllShops(...)`.

### 4.3. Bakery Plans & Subscriptions Semantics
- **Headline Count (`totalSubscriptions`):**
  Calculated via `subscriptionRepository.count()`. This represents the total historical subscription ledger entries across the platform's lifetime.
- **Unique Shop Status Breakdown:**
  Calculated using dedicated `DISTINCT` queries:
  - `activeSubscribedBakeries`: `SELECT COUNT(DISTINCT s.shop.id) FROM Subscription s WHERE s.status = 'ACTIVE'`
  - `expiredSubscribedBakeries`: `SELECT COUNT(DISTINCT s.shop.id) FROM Subscription s WHERE s.status = 'EXPIRED' AND s.shop.id NOT IN (SELECT sub.shop.id FROM Subscription sub WHERE sub.status = 'ACTIVE')`
- **Exclusion of Active Subscribers:**
  The `NOT IN (SELECT ... sub.status = 'ACTIVE')` clause guarantees that bakeries with multiple subscription records (e.g., an expired introductory plan followed by an active Pro plan) are categorized strictly as **active**, completely eliminating overlapping counts.

### 4.4. Subscription Revenue vs. Bakery GMV (100% Segregation)
- **Subscription Revenue (`paymentRepository.getTotalRevenue()`):**
  ```sql
  SELECT COALESCE(SUM(p.amount), 0) FROM payments p 
  WHERE p.status = 'COMPLETED' AND (p.subscription_id IS NOT NULL OR p.plan_id IS NOT NULL)
  ```
  Every subscription revenue query explicitly mandates that the payment record is linked to a subscription tier. Retail customer cake purchases are 100% excluded.
- **Bakery Retail GMV (`orderRepository.sumTotalRealizedRevenue()`):**
  ```sql
  SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o 
  WHERE UPPER(COALESCE(o.order_status, '')) != 'CANCELLED' 
    AND (UPPER(COALESCE(o.payment_status, '')) IN ('PAID', 'COMPLETED') 
         OR UPPER(COALESCE(o.order_status, '')) IN ('COMPLETED', 'DELIVERED')) 
    AND UPPER(COALESCE(o.payment_status, '')) NOT IN ('REFUNDED', 'FAILED')
  ```
  GMV strictly computes realized retail cake orders (excluding cancelled, refunded, or failed orders).
- **Zero Commission Guarantee:**
  The UI explicitly displays the subtitle `"SaaS Subscription Fees"` on the revenue KPI, and `"0% platform fee"` with a `"0% Platform Commission Model"` badge in the charts header, preventing any confusion between platform earnings and network retail volume.

### 4.5. Investigation of Historical "High Deleted Accounts" Screenshot
In earlier development screenshots, the `deletedAccounts` count appeared high relative to `totalUsers`. Investigation confirms:
1. It is **not** a query bug or double-count.
2. In early QA/test seeding stages, batch account deletion tests were executed.
3. Because CakeStore correctly uses soft-delete (`UPDATE users SET is_deleted = true`), those test records remain in the database as intended.
4. Active users and deleted accounts are completely separated by Hibernate filters and native queries.

---

## 5. Security & Reliability Audit

### 5.1. Authentication & Role-Based Authorization
- **Backend Protection:**
  `AdminDashboardController` is protected at the class level:
  ```java
  @RestController
  @RequestMapping("/api/admin")
  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  ```
  Any attempt to invoke `/api/admin/dashboard/stats`, `/activity`, or `/analytics/revenue` without `ROLE_ADMIN` returns an immediate `403 Forbidden` or `401 Unauthorized`.
- **Frontend Route Guard:**
  `AdminLayout` checks `user?.role === 'ROLE_ADMIN'`. If the user is unauthenticated or not an admin, it immediately redirects to `/login?redirect=/admin`.

### 5.2. Data Masking & Secret Protection
- **No Secret Leakage:**
  `adminSettingsApi.getSettings()` calls `GET /api/admin/settings`, which returns `GlobalSettingsResponse`. Inspecting this DTO confirms:
  ```java
  private String razorpayKeyId; // Public key ID
  private boolean razorpayKeySecretConfigured; // Boolean flag only
  private boolean razorpayWebhookSecretConfigured; // Boolean flag only
  ```
  Neither the Razorpay Key Secret nor the Webhook Secret is ever transmitted across the network to the frontend.
- **PII Protection:**
  In the Recently Registered Bakeries table, owner emails and names are displayed only to authorized Super Admins. In the activity stream, user passwords and sensitive metadata are never logged or exposed.
- **User Password Hashes:**
  `User.java` marks `passwordHash` with `@JsonIgnore`, ensuring password hashes are never serialized.

### 5.3. Resilience & Degradation
- The Overview executes 5 concurrent requests on mount via `Promise.all`:
  1. `getPlatformStats`: Core dashboard stats
  2. `getAllShops`: Recent bakeries
  3. `getRecentActivity`: Audit events (isolated with `.catch`)
  4. `communicationApi.getCommunicationSummary`: Message counts (isolated with `.catch`)
  5. `adminSettingsApi.getSettings`: Gateway config (isolated with `.catch`)
- If any peripheral service (e.g. Communications or Audit) is temporarily unavailable, the primary stats and bakery table still render seamlessly.
- Error handling in `loadData` guarantees that `setIsInitialLoading(false)` and `setIsFiltering(false)` execute in the `finally` block, completely preventing hanging states.

---

## 6. Non-Functional, Visual & Accessibility Audit

### 6.1. Visual Polish & Light Theme
- The dashboard utilizes a cohesive slate/indigo/emerald light-theme palette matching modern SaaS standards.
- Replaced outdated stacked banners with a balanced side-by-side Action Center grid (`md:grid-cols-2`).
- KPI cards have consistent vertical heights, subtle borders (`border-slate-200/80`), gentle soft shadows (`shadow-soft`), and smooth hover lift animations (`hover:-translate-y-0.5`).

### 6.2. Table & Activity Reorganization (Phase 3)
- **Full-Width Table:** The Recently Registered Bakeries table now spans the full container width, providing ample breathing room for bakery names, IDs, owner emails, registration dates, dual status badges (Store Status + Sub Status), and action buttons.
- **Activity Stream:** Located below the table as a clean full-width feed with a fixed scrollable height (`max-h-[360px]`), event counts badge, formatted relative and exact timestamps (`formatTimestamp`), and human-readable action labels (`formatActionLabel`).

### 6.3. Responsive Layout
- **Mobile (<640px):** Single-column layout for Action Center, KPI cards, and quick actions. The bakery table features horizontal scrolling (`overflow-x-auto`) with a minimum width of `680px`, preventing cramped data.
- **Tablet (768px):** 2-column grid for KPI cards and Action Center alerts.
- **Desktop (1024px+):** 4-column executive KPI row, 2-column analytics charts, full-width bakery table, and full-width activity feed.

### 6.4. Accessibility
- All interactive select inputs include descriptive `aria-label` tags (e.g., `aria-label="Filter analytics by date period"`).
- Links and action buttons have visible focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500`).
- Color contrast meets WCAG AA standards with dark slate text (`text-slate-900`, `text-slate-800`) against crisp white cards and light backgrounds.

---

## 7. Automated Test Results

The existing automated test suites were executed to verify that no regressions exist:

| Test Suite / Command | Target Scope | Results | Notes |
| :--- | :--- | :---: | :--- |
| `node --test __tests__/*.test.mjs` | Orders, Ledger, Concurrency, Masking | **19 / 19 PASSED** | Zero failures. Verified dirty state tracking, ledger balance assertions, and privacy masking. |
| `npx tsc --noEmit` | Frontend Static Type Safety | **0 ERRORS** | Verified strict TypeScript compatibility across all pages, components, and types. |
| `npm run lint` | Next.js ESLint Suite | **0 ERRORS / 0 WARNINGS** | Clean code formatting and adherence to Next.js best practices. |
| `npm run build` | Next.js Production Build | **38 / 38 PAGES PASSED** | Generated production bundle cleanly. `/admin` compiled at 2.38 kB (167 kB First Load JS). |
| `mvn test -Dtest="AdminDashboardDateFilterTest,RevenueSegregationE2ETest,StageBAdminOperationsTest"` | Backend Integration & Date Filtering | **30 / 30 PASSED** | 11 Date filter tests, 5 revenue segregation tests, and 14 admin operation tests passed cleanly. |

---

## 8. Manual & Runtime Verification Summary

- **Automated Verification:** Completed comprehensively across frontend and backend suites.
- **Source Code Verification:** All queries, DTOs, API clients, and component renderings were verified line-by-line in the actual source code.
- **Manual Verification:** As requested by the user, manual exploratory walkthroughs of the live browser interface are conducted directly by the user.

---

## 9. Prioritized Findings

### Critical (P0): 0 Findings
*No blocking defects, security vulnerabilities, or data integrity bugs identified.*

### High (P1): 0 Findings
*No functional breakdowns or broken workflows identified.*

### Medium (P2): 0 Findings
*No major UI regressions or performance bottlenecks identified.*

### Low (P3): 1 Finding
- **FINDING-01: Timezone Offset in Frontend Date Formatting**
  - **Location:** `frontend_v2/app/admin/page.tsx` (Lines 234–258)
  - **Description:** The date picker helper uses `const formatDate = (date: Date) => date.toISOString().split('T')[0]`. Because `toISOString()` formats in UTC, users in `Asia/Kolkata` (UTC+5:30) between 12:00 AM and 5:30 AM local time will generate date strings corresponding to the previous calendar day.
  - **Impact:** Minimal. Only affects bounded date filter selections (e.g. "Last 7 Days", "This Month") triggered in the first 5.5 hours of the day. Backend handles timezones accurately once parsed.
  - **Recommendation:** In a future non-read-only maintenance sprint, replace with local string formatting: `date.toLocaleDateString('en-CA')` or manual YYYY-MM-DD formatting.

### Informational: 2 Findings
- **INFO-01: Historical Subscription Record Count vs Unique Bakery Breakdown**
  - **Location:** `frontend_v2/app/admin/page.tsx` (KPI Card 3)
  - **Description:** The top number (`stats.totalSubscriptions`) displays the total count of subscription records ever created, while the breakdown pills below show the number of unique bakeries in each status (Active, Expired, Pending, etc.).
  - **Impact:** Subtitles `"Bakery Plans & Subscriptions"` and `"Total Subscription Records"` already clarify this, but a tooltip could provide additional clarity for new platform admins.
- **INFO-02: Soft-Deleted User Records Retention**
  - **Location:** `User.java` & `UserRepository.java`
  - **Description:** Soft-deleted user accounts remain permanently in the database table with `is_deleted = true`. They are excluded from active user counts via `@SQLRestriction` and tracked separately via `deletedAccounts`. This confirms that previous screenshot observations were standard test data retention rather than a query defect.

---

## 10. Recommended Remediation Plan

Since this phase is strictly read-only, **no modifications have been made**. When future implementation is scheduled, the following low-risk improvements are recommended:

1. **Phase 4 Maintenance (Low Risk, Non-Breaking):**
   - Update `formatDate` in `frontend_v2/app/admin/page.tsx` to format in local IST date format (`en-CA` format `YYYY-MM-DD`) instead of `toISOString()`.
   - Add a subtle informational tooltip on KPI Card 3 explaining that the primary figure represents cumulative subscription records, while status chips represent unique bakery accounts.

---

## 11. Confirmation of Read-Only Compliance

It is explicitly confirmed that during this audit:
- **Zero source files were modified or deleted.**
- **Zero database writes, migrations, or DDL changes were executed.**
- **No dependencies were installed, updated, or removed.**
- **No Git commits, branches, stashes, or resets were performed.**
- **Pre-existing modified and untracked files in the working directory remain untouched.**

---
*Report prepared and finalized for CakeStore Super Admin Overview.*
