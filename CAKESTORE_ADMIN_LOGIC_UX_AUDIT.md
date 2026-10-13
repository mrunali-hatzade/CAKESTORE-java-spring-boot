# CakeStore Admin Dashboard — Logic & UX Improvement Audit Report

**Document Version:** 1.0.0  
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity AI Engineering & Audit Agent  
**Target:** CakeStore Multi-Tenant SaaS Platform Administrator Role (`ROLE_ADMIN`)  
**Status:** Complete — Pending User Review & Approval  

---

## 1. Executive Summary and Current Readiness

The CakeStore SaaS platform administrator (`ROLE_ADMIN`) oversees the entire multi-tenant ecosystem: bakery onboarding and FSSAI compliance verification, SaaS subscription billing, tenant lifecycle moderation (activation, suspension, termination), public communication (feedback, enquiries, broadcasts), and global platform health.

This audit evaluates the platform's Admin Dashboard from an operational, logical, and user-experience perspective against the primary requirements documented in [`Cake_Platform_PRD_Final.md`](file:///d:/PROJECTS/CAKE%20SAAs1/text%20files/docs/old%20md%20files/Cake_Platform_PRD_Final.md) and the current production codebase (`backend/` and `frontend_v2/`).

### Overall System Readiness: **68% (Operational with Critical Metric & Visibility Gaps)**

1. **Security & Access Control (Strong):** Admin route guards (`frontend_v2/app/admin/layout.tsx`), JWT role claims, method-level authorization (`@PreAuthorize("hasAuthority('ROLE_ADMIN')")`), encrypted secrets, and private Azure Blob SAS KYC document viewing operate securely.
2. **Shop Lifecycle Moderation (Operational):** Bakery verification (FSSAI compliance review, document inspection, approval/rejection) and tenant suspension with mandatory reasons work end-to-end.
3. **CRITICAL FLAW — Revenue Contamination (P0):** Customer online cake order payments (`payments` table with `failureReason = "ORDER:..."`) are aggregated directly into SaaS Platform Revenue queries (`PaymentRepository.getTotalRevenue()` and `getRevenueBetween()`). SaaS subscription revenue is conflated with network cake sales GMV, and customer order payments contaminate the bakery owner's subscription billing history.
4. **CRITICAL FLAW — Overview Date Filter & Default Mismatch (P0):** When loading the dashboard with the default dropdown selection "All Time" (`startDate == null`), the backend calculates revenue for *today* (`startOfDay`) and assigns it to `monthlyPlatformRevenue`, causing the frontend to display today's revenue or ₹0 under the "All Time" label.
5. **CRITICAL FLAW — Platform-Wide Payments & Orders Blind Spot (P1):** Administrators currently have zero platform-wide visibility into individual order lifecycles, failed customer transactions, Razorpay transaction references, or store payment histories.
6. **Data Representation Bugs (P1):** The "SaaS Subscriptions" KPI card renders `{stats?.totalRegisteredBakeries}` instead of subscription counts; customer accounts are excluded from the "Platform Users" metric despite being tracked in the database.

---

## 2. Existing Admin Routes, Capabilities, and Components

| Route | Frontend Page Component | Primary Backend Controller | Current Admin Capability |
| :--- | :--- | :--- | :--- |
| `/admin` | `frontend_v2/app/admin/page.tsx` | `AdminDashboardController` | Executive KPI cards, SaaS vs GMV charts, pending approval alert banner, quick module shortcuts, top 5 recent bakeries table, live activity log feed. |
| `/admin/shops` | `frontend_v2/app/admin/shops/page.tsx` | `AdminDashboardController` | Bakery directory with server-side pagination, search by name/slug/owner/city, tabs (ALL, PENDING, ACTIVE, SUSPENDED), status badges, and direct links to storefronts/management. |
| `/admin/shops/[id]` | `frontend_v2/app/admin/shops/[id]/page.tsx` | `AdminDashboardController`, `AdminDocumentViewController` | Comprehensive bakery profile, FSSAI registration audit, secure SAS KYC document viewer, verify/reject KYC actions, activate/suspend shop actions, order metrics, subscription summary, and audit trail. |
| `/admin/plans` | `frontend_v2/app/admin/plans/page.tsx` | `AdminSubscriptionPlanController` | Catalog manager for subscription tiers (monthly/annual), price in INR, feature quotas (product limits, custom domain), status toggle (active/inactive), and display reordering. |
| `/admin/messages` | `frontend_v2/app/admin/messages/page.tsx` | `AdminMessageController` | System broadcast composer: broadcast platform announcements to all bakery owners or targeted individual owners with optional email dispatch; displays sent history. |
| `/admin/notifications` | `frontend_v2/app/admin/notifications/page.tsx` | `AdminNotificationController` | System administrative notification inbox with category filters (Bakery, Orders, Payments, Communication, Subscriptions, System, Security), search, mark-as-read, and mark-all-as-read. |
| `/admin/feedback` | `frontend_v2/app/admin/feedback/page.tsx` | `AdminCommunicationController` | Platform feedback portal: reviews owner and customer rating/comments, unread filters, search, and direct administrative replies. |
| `/admin/enquiries` | `frontend_v2/app/admin/enquiries/page.tsx` | `AdminCommunicationController` | Public contact inquiries from website visitors: unread badges, full message modal, read status toggling, and email replies. |
| `/admin/settings` | `frontend_v2/app/admin/settings/page.tsx` | `AdminSettingsController` | Global platform configuration: platform name, support email, currency (INR), Razorpay Key ID, write-only updates for Razorpay Key Secret and Webhook Secret with boolean configuration indicators. |

---

## 3. Metric-to-API-to-Database Source Map

The table below maps every metric displayed on the Admin Dashboard to its exact frontend component, API endpoint, backend service method, and database query or aggregation.

| Metric Label | Frontend Display Component & Line | API Endpoint | Backend Service Method | Database Query / Aggregation | Data Accuracy Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Platform Users (Total)** | `app/admin/page.tsx:193`<br>`(stats?.totalAdmins ?? 0) + (stats?.totalShopOwners ?? 0)` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:187-190` | `userRepository.count()` | ⚠️ **Misleading:** Frontend sums only Admins + Owners, ignoring registered retail customers. |
| **Platform Admins** | `app/admin/page.tsx:197`<br>`{stats?.totalAdmins ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:188` | `userRepository.countByRole(ADMIN)` | ✅ **Accurate** |
| **Bakery Owners** | `app/admin/page.tsx:201`<br>`{stats?.totalShopOwners ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:189` | `userRepository.countByRole(SHOP_OWNER)` | ✅ **Accurate** |
| **Registered Customers** | *Omitted from Overview UI* | `GET /api/admin/dashboard/stats` | `AdminDashboardService:190` | `userRepository.countByRole(CUSTOMER)` | ❌ **Missing from UI** (present in backend DTO). |
| **Bakery Storefronts (Total)** | `app/admin/page.tsx:217`<br>`{stats?.totalRegisteredBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:193` | `shopRepository.count()` | ✅ **Accurate** |
| **Active Bakeries** | `app/admin/page.tsx:220`<br>`{stats?.activeBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:194` | `shopRepository.countByStatus(ACTIVE)` | ✅ **Accurate** |
| **Pending Bakeries** | `app/admin/page.tsx:222`<br>`{stats?.pendingBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:198` | `shopRepository.countByStatus(PENDING)` | ✅ **Accurate** |
| **Suspended Bakeries** | `app/admin/page.tsx:224`<br>`{stats?.suspendedBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:196` | `shopRepository.countByStatus(SUSPENDED)` | ✅ **Accurate** |
| **Inactive Bakeries** | `app/admin/page.tsx:226`<br>`{stats?.inactiveBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:197` | `shopRepository.countByStatus(INACTIVE)` | ✅ **Accurate** |
| **SaaS Subscriptions (Total)** | `app/admin/page.tsx:241`<br>`{stats?.totalRegisteredBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:193` | `shopRepository.count()` | ❌ **Incorrect:** Renders bakery count instead of subscription total. |
| **Active Subscriptions** | `app/admin/page.tsx:245`<br>`{stats?.activeSubscribedBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:202` | `subscriptionRepository.countUniqueShopsByStatus(ACTIVE)` | ✅ **Accurate** (unique shops with active sub). |
| **Expired Subscriptions** | `app/admin/page.tsx:249`<br>`{stats?.expiredSubscribedBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:206` | `subscriptionRepository.countUniqueShopsByStatusExcludingActive(EXPIRED)` | ✅ **Accurate** |
| **Pending Payment Subscriptions** | `app/admin/page.tsx:253`<br>`{stats?.pendingPaymentBakeries ?? 0}` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:205` | `subscriptionRepository.countUniqueShopsByStatusExcludingActive(PENDING)` | ✅ **Accurate** |
| **Platform Revenue (SaaS)** | `app/admin/page.tsx:273`<br>`formatCurrency(stats?.monthlyPlatformRevenue)` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:222-223` | `paymentRepository.getRevenueBetween(periodStart, periodEnd)` | ❌ **Critical Flaw:** Defaults to *today's* revenue when "All Time" selected; counts retail customer cake orders! |
| **Platform Revenue (Lifetime)** | `app/admin/page.tsx:276`<br>`formatCurrency(stats?.totalPlatformRevenue)` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:225-226` | `paymentRepository.getTotalRevenue()` | ❌ **Critical Flaw:** Directly sums customer cake order payments into SaaS revenue. |
| **Network GMV (Cake Sales)** | `app/admin/page.tsx:283`<br>`formatCurrency(stats?.monthlyGmv)` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:228-229` | `orderRepository.sumRealizedRevenueBetween(periodStart, periodEnd)` | ⚠️ **Misaligned Date Default:** Defaults to *today's* GMV when "All Time" selected. |
| **Network GMV (Lifetime)** | `app/admin/page.tsx:286`<br>`formatCurrency(stats?.totalGmv)` | `GET /api/admin/dashboard/stats` | `AdminDashboardService:231-232` | `orderRepository.sumTotalRealizedRevenue()` | ✅ **Accurate** (realized non-cancelled orders). |
| **SaaS Revenue Growth Chart** | `components/admin/AnalyticsCharts.tsx:58` | `GET /api/admin/dashboard/stats/analytics/revenue` | `AdminDashboardService:123-145` | `paymentRepository.findAll().stream()` | ❌ **Critical Flaw:** In-memory scan counts customer cake order payments as SaaS revenue; unscalable. |
| **Network GMV Chart** | `components/admin/AnalyticsCharts.tsx:73` | `GET /api/admin/dashboard/stats/analytics/revenue` | `AdminDashboardService:147-168` | `orderRepository.findAll().stream()` | ⚠️ **Performance Hazard:** In-memory scan of all platform orders. |
| **Platform Order Counts & Status Breakdown** | *Not available on Overview* | *No endpoint* | *None* | `orderRepository.countByOrderStatus(...)` | ❌ **Missing from Platform Overview** |

---

## 4. Comprehensive Table of Audit Findings

| ID | Severity | Affected Component(s) | Finding Summary | Exact Evidence in Codebase | User / Platform Impact | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | **P0** | `PaymentRepository.java`<br>`AdminDashboardService.java`<br>`CustomerPaymentController.java`<br>`OwnerPaymentController.java` | **Revenue Contamination:** Retail customer cake order payments are summed into SaaS Subscription Platform Revenue. | In `CustomerPaymentController.java:94-103` & `WebhookController.java:163-174`, online cake payments are saved to `payments` with `shop = order.getShop()`, `subscription = null`, `failureReason = "ORDER:" + orderNumber`. In `PaymentRepository.java:24,36`, queries use `WHERE p.status = 'COMPLETED'` without filtering for `subscription IS NOT NULL` or `plan IS NOT NULL`. In `OwnerPaymentController.java:78-84`, customer order payments appear in Owner Subscription History labeled "Pro Baker Studio"! | SaaS platform revenue is artificially inflated and double-counted with Network GMV. Bakery owners see customer cake payments in their personal subscription billing history. Financial reporting is invalid. | 1. Update `PaymentRepository` revenue queries to explicitly require `p.subscription IS NOT NULL` (or `p.plan IS NOT NULL` / `p.failureReason NOT LIKE 'ORDER:%'`).<br>2. Filter `findByShopIdOrderByCreatedAtDesc` in `OwnerPaymentController` to return only subscription payments.<br>3. Introduce clear segregation between SaaS Subscription Billing and Customer Order Payments. |
| **F-02** | **P0** | `AdminDashboardService.java`<br>`frontend_v2/app/admin/page.tsx` | **Date-Range Default Mismatch:** Initial dashboard load defaults to "All Time" but backend calculates revenue for *today*, showing ₹0 or today's amount under "All Time". | In `AdminDashboardService.java:211-217`: `LocalDateTime periodStart = startOfDay;` when `startDate == null`. The resulting `periodSubRev` and `periodGmv` are assigned to `monthlyPlatformRevenue` and `monthlyGmv`. In `frontend_v2/app/admin/page.tsx:36, 147`, the initial dropdown value is `"All Time"`, passing `start: undefined, end: undefined`. | Administrator sees "All Time" selected in the UI dropdown, but the primary figure displays only today's revenue (often ₹0), confusing the administrator. | When `startDate == null` and `endDate == null` ("All Time"), set `periodSubRev = totalSubRev` and `periodGmv = totalGmv`, OR change the frontend initial default to "This Month" with matching date bounds (`start = 1st of month`, `end = today`). Rename DTO field to `periodPlatformRevenue` and `periodGmv` to eliminate ambiguity. |
| **F-03** | **P1** | `frontend_v2/app/admin/page.tsx` | **SaaS Subscriptions Card Header Bug:** Displays total registered bakeries count instead of total subscriptions. | In `frontend_v2/app/admin/page.tsx:240-242`:<br>`<p className="text-3xl font-bold font-serif text-slate-900 mt-3">{stats?.totalRegisteredBakeries ?? 0}</p>`. | The "SaaS Subscriptions" KPI card displays the bakery count as its hero number, duplicating the "Bakery Storefronts" card and misrepresenting platform subscription volume. | Replace `{stats?.totalRegisteredBakeries}` with the sum of subscriptions or total subscribed shops: `(stats?.activeSubscribedBakeries ?? 0) + (stats?.expiredSubscribedBakeries ?? 0) + (stats?.pendingPaymentBakeries ?? 0)`. |
| **F-04** | **P1** | `frontend_v2/app/admin/page.tsx`<br>`DashboardStatsResponse.java` | **Retail Customers Omitted From Platform User Metric:** 100% of customer accounts are ignored on the Overview page. | In `frontend_v2/app/admin/page.tsx:193`:<br>`{(stats?.totalAdmins ?? 0) + (stats?.totalShopOwners ?? 0)}`. `stats.setTotalCustomers(...)` is populated in backend line 190, but completely unused in the frontend component. | Administrators cannot see how many consumer accounts exist on the marketplace. Understates platform reach and active user base. | Update "Platform Users" card to display `stats?.totalUsers` (or Admins + Owners + Customers) and show three breakdown tags: Admins, Bakery Owners, and Customers. |
| **F-05** | **P1** | `AdminDashboardController.java`<br>`frontend_v2` | **Missing Platform-Wide Orders & Payments Ledger:** Administrators cannot inspect customer orders or transaction logs across bakeries. | No `/api/admin/orders` or `/api/admin/payments` endpoints exist. `OrderRepository` only supports filtering by `shopId`. | Administrators cannot troubleshoot failed online payments, verify payment references reported by customers/bakeries, check platform-wide delivery statuses, or identify fraud. | Implement read-only admin endpoints `GET /api/admin/orders` (cross-shop pagination, status filter, search by orderNumber/customer) and `GET /api/admin/payments` (cross-shop payment ledger with provider payment ID, order vs subscription type, status filter). |
| **F-06** | **P1** | `AdminShopDetailsResponse.java`<br>`frontend_v2/app/admin/shops/[id]/page.tsx` | **Unrendered Payments List on Bakery Detail Page:** Backend returns payments list, but UI completely ignores it. | In `AdminDashboardService.java:304`, `details.setPayments(paymentRepository.findByShopId(shopId))` is populated. In `frontend_v2/app/admin/shops/[id]/page.tsx`, `details.payments` is never referenced or rendered. | Administrators viewing a bakery cannot see its subscription payment history, past invoices, or transaction IDs. | Add a "Subscription Billing & Payment History" table to the Admin Bakery Detail page rendering `details.payments` with dates, amounts, provider reference IDs, and statuses. |
| **F-07** | **P1** | `AdminDashboardService.java` | **Unscalable In-Memory Stream Aggregations for Analytics Charts:** `findAll().stream()` executed on every chart request. | In `AdminDashboardService.java:123, 147`: `List<Payment> allPayments = paymentRepository.findAll();` and `List<Order> allOrders = orderRepository.findAll();` followed by in-memory stream filtering over the last 6 months. | As platform order and payment volume grows to thousands of records, `/api/admin/dashboard/stats/analytics/revenue` will cause high memory pressure, GC pauses, and slow page loads. | Replace in-memory loops with database-level monthly grouping queries (e.g. `SELECT to_char(created_at, 'YYYY-MM'), SUM(amount) FROM payments WHERE status = 'COMPLETED' AND ... GROUP BY ...`). |
| **F-08** | **P2** | `frontend_v2/app/admin/page.tsx` | **Disconnected Alert Banner Navigation:** "Bakeries Awaiting Verification" alert button links to `/admin/shops` without filtering by PENDING. | In `frontend_v2/app/admin/page.tsx:172`:<br>`<Link href="/admin/shops">` with label "Review Applications". | When administrators click "Review Applications", they land on the "ALL" tab and must manually switch to the "PENDING" tab to find the applications. | Update link to `<Link href="/admin/shops?status=PENDING">` (or preserve filter state via URL params). |
| **F-09** | **P2** | `AdminDashboardController.java`<br>`frontend_v2/app/admin` | **Missing User Management / Lookup View:** No UI exists to search users or investigate account status across roles. | No `/admin/users` page or `/api/admin/users` endpoint exists. Soft-deleted accounts and user roles cannot be searched or inspected. | Administrators cannot look up user accounts by email/phone to resolve login issues or verify account status. | Provide a focused `/admin/users` directory (or user drawer) supporting search by email/name/phone, role filter, status badge, and linked shop association. |
| **F-10** | **P2** | `frontend_v2/app/admin` | **Missing Centralized Activity & Audit Explorer:** Overview shows only 10 recent activity logs without pagination or filters. | `ActivityLogRepository` has `findTop50ByOrderByTimestampDesc()`, but there is no paginated admin audit log explorer with action/date/actor filters. | Administrators cannot investigate past compliance actions, subscription activations, or security events beyond the last 10-50 global items. | Add an Activity / Audit Log viewer with search, action filter (e.g., `SHOP_SUSPENDED`, `KYC_VERIFIED`, `PLAN_UPDATED`), and date filtering. |
| **F-11** | **P2** | `frontend_v2/app/admin/plans/page.tsx` | **Misleading Navigation Label:** Sidebar says "Plans & Subscriptions", but page only manages plan templates, not active tenant subscriptions. | In `frontend_v2/app/admin/layout.tsx:73`, nav item is labeled "Plans & Subscriptions", linking to `/admin/plans`. The page manages `SubscriptionPlan` catalog items, with no list of subscribed shops. | Administrators expecting to see which shops are currently subscribed cannot find them here. | Rename page header to "Subscription Plan Catalog" and add a secondary tab or link to "Active Subscriptions" (filtering `/admin/shops` by subscription status). |

---

## 5. Existing Functionality That Must Be Preserved

Under Mandatory Rule 1 & 2, the following existing capabilities must be strictly preserved without breaking changes:

1. **Security & Authorization Framework:**
   - Strict `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` across all `/api/admin/**` endpoints.
   - Frontend route guarding redirecting unauthorized users to `/login`.
   - Write-only Razorpay secret updates in `AdminSettingsController` preserving encryption and returning boolean configuration indicators (`hasRazorpayKeySecret`, `hasRazorpayWebhookSecret`).
   - Secure SAS token-based Azure Blob viewing via `/api/admin/documents/{id}/view`.
2. **Bakery Onboarding & Moderation Lifecycle:**
   - Complete state machine: `PENDING` -> `ACTIVE` / `INACTIVE` / `SUSPENDED` / `EXPIRED` / `DELETED`.
   - Mandatory suspension reason capture and audit logging (`ActivityLoggerService`).
   - FSSAI document review and status management (`PENDING` -> `VERIFIED` / `REJECTED`).
   - Multi-tab directory (`ALL`, `PENDING`, `ACTIVE`, `SUSPENDED`) with zero-indexed page resetting and real-time count badges (`/api/admin/shops/counts`).
3. **Monetization Architecture (Zero Commission Rule):**
   - 100% fixed SaaS subscription monetization model for CakeStore.
   - **Zero platform commission** on customer cake sales: 100% of retail order value belongs to the individual bakery tenant.
   - Complete preservation of plan creation, editing, pricing in INR, feature quota toggling, and visual drag/order priority.
4. **Platform Communications:**
   - Multi-channel broadcasts (in-app + optional email dispatch) via `AdminMessageController`.
   - Administrative notification feed with category tabs and mark-as-read tracking.
   - Public contact enquiries inbox and customer/owner feedback moderation with direct reply handling.
5. **Multi-Tenant Isolation:**
   - Individual bakery owners must never see other bakeries' orders, customers, or financial records.
   - Retail customers must only access their own orders and authorized shop storefronts.

---

## 6. Feature Status Classification

| Module / Feature | Implemented | Partially Implemented | Missing | Not Verified | Evidence / Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Admin Authentication & Guards** | ✅ | | | | Verified in `AdminLayout.tsx` and Spring Security configuration. |
| **Settings Security Hardening** | ✅ | | | | Verified in `AdminSettingsSecurityE2ETest.java` (27/27 tests pass). |
| **KYC Private Document Viewing** | ✅ | | | | Verified via SAS streaming endpoint `/api/admin/documents/{id}/view`. |
| **Bakery Moderation (Approve/Reject)** | ✅ | | | | Verified in `AdminDashboardController` and `AdminShopService`. |
| **Bakery Suspension with Reason** | ✅ | | | | Verified with mandatory reason validation in `AdminDashboardService:345`. |
| **Bakery Table Filtering & Counts** | ✅ | | | | Verified in Phase 4.1 (`/api/admin/shops/counts` + page reset). |
| **Subscription Plan Catalog Manager** | ✅ | | | | Verified in `AdminPlansPage` and `AdminSubscriptionPlanController`. |
| **Broadcast Messaging System** | ✅ | | | | Verified in `AdminMessagesPage` with recipient history. |
| **Feedback & Contact Enquiries** | ✅ | | | | Verified in `AdminPlatformFeedbackPage` & `AdminContactEnquiriesPage`. |
| **Global Settings Management** | ✅ | | | | Verified in `AdminSettingsPage` with masked secrets. |
| **Overview Bakery Health Counts** | ✅ | | | | Verified in `AdminDashboardService:193-200`. |
| **Overview Subscription Health Counts** | ✅ | | | | Verified in `AdminDashboardService:202-208`. |
| **Overview User Metrics** | | ⚠️ | | | Backend tracks customers, but frontend sums only admins and owners. |
| **Overview Date Filtering** | | ⚠️ | | | Defaults to today's revenue when "All Time" selected; field naming ambiguous. |
| **Revenue Calculation Segregation** | | | ❌ | | Customer order payments are contaminating subscription revenue queries. |
| **Bakery Detail Subscription Payments** | | ⚠️ | | | Backend provides payments list, but frontend doesn't render it. |
| **Platform Orders Ledger** | | | ❌ | | No platform-wide order monitoring endpoint or UI exists for admins. |
| **Platform Payments Ledger** | | | ❌ | | No cross-tenant transaction ledger or payment lookup exists for admins. |
| **User Account Explorer** | | | ❌ | | No dedicated user directory or search across customer/owner accounts. |
| **Centralized Audit Log Explorer** | | ⚠️ | | | Recent 10 items shown on Overview; no dedicated search/filter log explorer. |

---

## 7. Prioritized Implementation Plan

### Priority P0: Security, Business Logic, and Data Integrity (Critical)

#### Task P0.1: Segregate Subscription Revenue from Customer Order Payments
- **Files Affected:**
  - `backend/src/main/java/com/cakeplatform/api/modules/payment/PaymentRepository.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java`
- **Specification:**
  1. Update `PaymentRepository.getTotalRevenue()`:
     ```sql
     SELECT COALESCE(SUM(p.amount), 0) FROM Payment p 
     WHERE p.status = 'COMPLETED' 
       AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL)
     ```
  2. Update `PaymentRepository.getRevenueBetween(start, end)`:
     ```sql
     SELECT COALESCE(SUM(p.amount), 0) FROM Payment p 
     WHERE p.status = 'COMPLETED' 
       AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL)
       AND p.createdAt BETWEEN :start AND :end
     ```
  3. Update `PaymentRepository.countCompletedPaymentsBetween(start, end)`:
     ```sql
     SELECT COUNT(p) FROM Payment p 
     WHERE p.status = 'COMPLETED' 
       AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL)
       AND p.createdAt BETWEEN :start AND :end
     ```
  4. In `OwnerPaymentController.getMyPayments()`, filter `findByShopIdOrderByCreatedAtDesc` to return only records where `p.subscription IS NOT NULL OR p.plan IS NOT NULL`, preventing customer retail cake payments from displaying as owner subscription charges.
  5. In `AdminDashboardService.getRevenueAnalytics()`, filter payments by `p.getSubscription() != null || p.getPlan() != null` for SaaS revenue calculation.

#### Task P0.2: Correct Overview Date Filter and Default Period Logic
- **Files Affected:**
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/dto/DashboardStatsResponse.java`
  - `frontend_v2/app/admin/page.tsx`
- **Specification:**
  1. In `AdminDashboardService.java:211-233`:
     - If `startDate == null && endDate == null` (All Time), set:
       - `periodSubRev = totalSubRev`
       - `periodGmv = totalGmv`
       - `todayRegistrations = userRepository.count()`
       - `todayPayments = paymentRepository.countCompletedSubscriptionPayments()`
     - If `startDate != null && endDate != null`, use the exact requested date range `[startDate 00:00:00, endDate 23:59:59.999999999]`.
  2. In `DashboardStatsResponse.java`, add/clarify fields:
     - `periodPlatformRevenue` (replaces or mirrors `monthlyPlatformRevenue`)
     - `periodGmv` (replaces or mirrors `monthlyGmv`)
     - `periodLabel` ("All Time", "Last 7 Days", "Last 30 Days", "This Month", etc.)
  3. In `frontend_v2/app/admin/page.tsx`:
     - Bind KPI card labels dynamically to selected filter (e.g. `PLATFORM REVENUE (${dateRange.toUpperCase()})`).
     - Display `formatCurrency(stats?.periodPlatformRevenue ?? stats?.monthlyPlatformRevenue)`.

---

### Priority P1: Essential Platform-Wide Visibility & Actionable Workflows

#### Task P1.1: Fix Overview KPI Metric Cards & Include Platform Customers
- **Files Affected:**
  - `frontend_v2/app/admin/page.tsx`
- **Specification:**
  1. In `Platform Users` Card:
     - Hero Number: `stats?.totalUsers ?? ((stats?.totalAdmins ?? 0) + (stats?.totalShopOwners ?? 0) + (stats?.totalCustomers ?? 0))`
     - Breakdown Tags:
       - `{stats?.totalAdmins ?? 0} Admins`
       - `{stats?.totalShopOwners ?? 0} Bakery Owners`
       - `{stats?.totalCustomers ?? 0} Customers`
  2. In `SaaS Subscriptions` Card:
     - Fix Hero Number: Replace `{stats?.totalRegisteredBakeries ?? 0}` with:
       ```typescript
       (stats?.activeSubscribedBakeries ?? 0) + 
       (stats?.expiredSubscribedBakeries ?? 0) + 
       (stats?.pendingPaymentBakeries ?? 0)
       ```

#### Task P1.2: Render Bakery Subscription Payments on Admin Shop Detail Page
- **Files Affected:**
  - `frontend_v2/app/admin/shops/[id]/page.tsx`
- **Specification:**
  1. Utilize the `details.payments` array already supplied by `AdminDashboardService:304`.
  2. Add a clean, responsive "Subscription Payments & Invoices" table under the Subscription Plan Card showing:
     - Payment Date (`paidAt` or `createdAt`)
     - Amount (`₹{amount}`)
     - Provider (`RAZORPAY`)
     - Razorpay Payment ID (`providerPaymentId`)
     - Status Badge (`COMPLETED`, `FAILED`, `PENDING`)
     - Plan Name (derived from payment or subscription)

#### Task P1.3: Provide Dedicated Platform Orders & Payments Ledger
- **Files Affected:**
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminPlatformOperationsController.java` (New or integrated into `AdminDashboardController`)
  - `backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/payment/PaymentRepository.java`
  - `frontend_v2/app/admin/orders/page.tsx` (New Admin Orders View)
  - `frontend_v2/app/admin/payments/page.tsx` (New Admin Payments View)
- **Specification:**
  1. **Cross-Shop Orders Endpoint:**
     - `GET /api/admin/orders?page=0&size=20&status=&search=`
     - Paginated query across all shops with columns: Order #, Bakery Name, Customer Name/Phone, Total Amount, Order Status, Payment Status, Delivery Date, Created Date.
  2. **Cross-Shop Payments Endpoint:**
     - `GET /api/admin/payments?page=0&size=20&type=&status=&search=`
     - Paginated query across all transactions distinguishing `TYPE = 'SUBSCRIPTION'` vs `TYPE = 'ORDER'`.
     - Displays Provider Payment ID, Provider Order ID, Bakery Name, Amount, Status, Failure Reason, Date.
  3. **Zero Commission Enforcement:** Orders view clearly displays 100% tenant settlement with zero platform commission deduction.

#### Task P1.4: Optimize Revenue Analytics Aggregations in Database
- **Files Affected:**
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/payment/PaymentRepository.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java`
- **Specification:**
  1. Replace `paymentRepository.findAll().stream()` with a targeted JPQL / native aggregation query grouping completed subscription payments by year-month over the last 6 months.
  2. Replace `orderRepository.findAll().stream()` with a targeted query grouping realized order amounts by year-month over the last 6 months.

---

### Priority P2: Usability Improvements & Navigation Polish

#### Task P2.1: Fix Deep-Link Navigation From Overview Alert Banners
- **Files Affected:**
  - `frontend_v2/app/admin/page.tsx`
  - `frontend_v2/app/admin/shops/page.tsx`
- **Specification:**
  1. Change "Review Applications" button link on Overview page to `/admin/shops?status=PENDING`.
  2. In `frontend_v2/app/admin/shops/page.tsx`, read the `status` search parameter on initial mount and synchronize the active tab state (`PENDING`) so the filtered view displays immediately.

#### Task P2.2: Add Centralized Audit Log Explorer
- **Files Affected:**
  - `backend/src/main/java/com/cakeplatform/api/modules/audit/ActivityLogRepository.java`
  - `frontend_v2/app/admin/audit/page.tsx` (or dedicated tab in settings)
- **Specification:**
  1. Expose paginated query in `ActivityLogRepository`: `findFilteredLogs(String action, Long shopId, Pageable pageable)`.
  2. Add an Audit Log viewer allowing search by actor, shop, or action (`SHOP_SUSPENDED`, `KYC_VERIFIED`, etc.) with JSON metadata inspection.

#### Task P2.3: Clarify Subscription Catalog Navigation & Tenant List
- **Files Affected:**
  - `frontend_v2/app/admin/layout.tsx`
  - `frontend_v2/app/admin/plans/page.tsx`
- **Specification:**
  1. Update sidebar label from "Plans & Subscriptions" to "Subscription Plans".
  2. Add a quick link button in `AdminPlansPage` to "View Subscribed Bakeries" linking to `/admin/shops?subscription=ACTIVE`.

---

## 8. Verification and Test Suite Specification

Each proposed fix must be validated with automated tests covering backend authorization, data integrity, and frontend contract compliance.

### Backend Test Requirements

1. **`RevenueSegregationE2ETest.java` (New):**
   - **Scenario 1:** Create 1 subscription payment (₹1,999) and 2 customer cake order payments (₹500, ₹1,200).
   - **Assertion:** Verify `GET /api/admin/dashboard/stats` returns `totalPlatformRevenue = 1999.00` and `totalGmv = 1700.00`. Customer order payments must not increase platform revenue.
   - **Scenario 2:** Call `GET /api/owner/payments` for the bakery.
   - **Assertion:** Response must only list the subscription payment (₹1,999); customer order payments must be excluded.
2. **`AdminDashboardDateFilterTest.java` (New):**
   - **Scenario 1:** Request stats with `startDate=null, endDate=null` ("All Time").
   - **Assertion:** `monthlyPlatformRevenue` (or `periodPlatformRevenue`) equals total lifetime revenue, not today's revenue.
   - **Scenario 2:** Request stats with specific 7-day window.
   - **Assertion:** Stats reflect transactions strictly within the window boundaries.
3. **`AdminCrossShopVisibilitySecurityTest.java` (New):**
   - **Scenario 1:** Admin accesses `GET /api/admin/orders` and `GET /api/admin/payments`.
   - **Assertion:** Returns HTTP 200 with cross-tenant records.
   - **Scenario 2:** Bakery Owner (`ROLE_SHOP_OWNER`) attempts to access `/api/admin/orders` or `/api/admin/payments`.
   - **Assertion:** Returns HTTP 403 Forbidden.
   - **Scenario 3:** Customer (`ROLE_CUSTOMER`) attempts to access `/api/admin/**`.
   - **Assertion:** Returns HTTP 403 Forbidden.
4. **`AdminShopDetailsPaymentsTest.java` (New):**
   - Verify `GET /api/admin/shops/{id}` returns correct `payments` list with provider payment IDs and statuses.

### Frontend Test Requirements

1. **Overview Page Contract Test:**
   - Verify Overview page renders total users including customers.
   - Verify SaaS Subscriptions card renders total subscriptions, not bakery count.
   - Verify "Review Applications" alert banner navigates to `/admin/shops?status=PENDING`.
2. **Bakery Detail Page Payments Table Test:**
   - Verify `payments` array renders in table with proper date, currency formatting, and status badges.
3. **Type Checking & Linting:**
   - TypeScript compilation check (`npm run build`).
   - ESLint check (0 errors, 0 warnings).

---

## 9. Risks, Dependencies, and Explicit Approvals Required

### Technical & Operational Risks

1. **Revenue Historical Discrepancy:**
   - Correcting the revenue query will cause the reported "Lifetime SaaS Revenue" figure on the Admin Dashboard to drop by the exact sum of online cake orders previously misattributed to it.
   - *Mitigation:* Document this correction clearly so stakeholders understand that the change reflects accurate SaaS subscription accounting rather than lost revenue.
2. **Dual Usage of `payments` Table:**
   - Both subscription payments and online cake order payments share the `payments` table (with order payments identified by `subscription IS NULL` and `failureReason = "ORDER:..."`).
   - *Mitigation:* Ensure all queries explicitly check `(p.subscription IS NOT NULL OR p.plan IS NOT NULL)` when querying SaaS revenue, and `(p.failureReason LIKE 'ORDER:%')` when querying customer order transactions.

### Decisions Requiring Approval Before Implementation

Before proceeding to implementation, please confirm approval for:

1. **Approval 1 (Revenue Query Correction):** Approve updating `PaymentRepository` and `AdminDashboardService` to filter revenue strictly by subscription payments (`p.subscription IS NOT NULL`), eliminating customer order payment contamination.
2. **Approval 2 (Date Filter All-Time Logic):** Approve setting the "All Time" period revenue equal to lifetime revenue when `startDate == null`, ensuring the overview hero number accurately reflects the dropdown selection.
3. **Approval 3 (Admin Orders & Payments Ledger):** Approve introducing dedicated read-only platform-wide Orders and Payments endpoints/views (`/admin/orders` and `/admin/payments`) to provide administrators with full operational oversight without violating tenant isolation.
4. **Approval 4 (User Directory):** Approve introducing a focused `/admin/users` directory allowing search and investigation of user accounts across roles (Admin, Owner, Customer).

---

## 10. Conclusion & Next Steps

This audit establishes an evidence-based roadmap to resolve critical data contamination, correct misleading overview metrics, and deliver complete operational visibility for platform administrators.

**Current Phase Status:** Audit Complete. Code modifications have been strictly withheld. Awaiting user review and authorization of the implementation priorities.
