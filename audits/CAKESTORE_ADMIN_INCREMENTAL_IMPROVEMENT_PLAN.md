# CakeStore Admin — Incremental UI Improvement Plan
## Balanced Scope | Read-Only Audit & Controlled Planning Document

**Document Version:** 1.0.0  
**Date:** October 13, 2026  
**Status:** Planning Document — Strictly Awaiting User Approval Before Execution  
**Target:** CakeStore Platform Administrator Dashboard (`ROLE_ADMIN`)  
**Source of Truth:** Current workspace code, API contracts, schema migrations, and test suites  

---

## 1. Executive Summary & Preservation Principles

This document establishes a concrete, read-only audit and incremental improvement plan for the CakeStore Platform Administrator Dashboard (`ROLE_ADMIN`). The objective is to enhance administrative situational awareness, operational responsiveness, and data readability while strictly preserving the existing dashboard layout, visual identity, architecture, and business semantics.

### Non-Negotiable Preservation Principles

1. **Layout & Navigation Preservation:**
   - The current layout in [`frontend_v2/app/admin/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/page.tsx) and [`frontend_v2/app/admin/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx) remains the structural foundation.
   - The sidebar, header, global `Ctrl+K` command palette, route structure, and breadcrumbs are preserved as-is.
   - No pages, routes, or components will be relocated, renamed, or redesigned wholesale.
2. **Financial Integrity & Zero Commission Model:**
   - **Platform Revenue:** Consists strictly of qualifying completed SaaS subscription fees (`p.subscription_id IS NOT NULL OR p.plan_id IS NOT NULL`).
   - **Network GMV:** Represents gross realized retail customer cake orders (`paymentStatus IN ('PAID', 'COMPLETED')` or `orderStatus IN ('COMPLETED', 'DELIVERED')`, excluding cancelled/refunded).
   - **Zero Platform Commission:** 100% of order totals remain with bakery owners; platform revenue and GMV remain strictly segregated.
   - **Date Filtering:** All Time returns genuine cumulative lifetime totals; date filters apply inclusive operational boundaries in `Asia/Kolkata`. Daily counters (`todayPayments`, `todayRegistrations`) remain independent of filter windows.
3. **Database & Infrastructure Integrity:**
   - **Zero Migrations:** No Flyway migration scripts are modified or created.
   - **Zero Dependencies:** No external UI libraries, charting libraries, or CSS frameworks are introduced.
   - **Zero Premature Optimizations / Caching:** No caching layer is added.
4. **Strict Safety & Production Governance:**
   - **Read-Only Gate:** No code, tests, configuration, or deployment state are modified in this planning step.
   - **Explicit Approval Required:** Implementation can begin only after explicit user review and approval.

---

## 2. Actual Current Dashboard Structure & File Paths

The administrator overview dashboard is rendered primarily by three core files:

```
frontend_v2/
├── app/
│   └── admin/
│       ├── layout.tsx         # Admin sidebar, header, auth guard, command palette
│       └── page.tsx           # Overview page: header, alert banner, 4 KPI cards, charts, 2-column grid
└── components/
    └── admin/
        ├── AnalyticsCharts.tsx    # 6-month SaaS Revenue (Line) & Network GMV (Bar) charts
        ├── AdminNotificationBell.tsx # Header notification bell
        └── AdminCommandPalette.tsx  # Ctrl+K modal for quick navigation
```

### Visual Grid Hierarchy in `page.tsx`

1. **Header Row (Lines 131–154):**
   - Title: *"Platform Intelligence & Control"*
   - Subtitle: *"Real-time multi-tenant health, GMV volume, and bakery compliance status"*
   - Date range selector dropdown: `All Time`, `Last 7 Days`, `Last 30 Days`, `This Month`, `This Year`.
2. **Pending Approval Alert Banner (Lines 156–178):**
   - Rendered conditionally when `(stats?.pendingBakeries ?? 0) > 0`.
   - Amber alert box with clock icon, bakery count, and button linking to `/admin/shops`.
3. **KPI Cards Grid (Lines 180–303):** 4 responsive columns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`):
   - **Card 1: Platform Users** — Total user count (`totalUsers`), segmented by `Admins`, `Bakery Owners`, and `Customers`.
   - **Card 2: Bakery Storefronts** — Total registered bakeries (`totalRegisteredBakeries`), segmented by `active`, `pending`, `suspended`, and `inactive`.
   - **Card 3: SaaS Subscriptions** — Total subscription records (`totalSubscriptions`), segmented by `active`, `expired`, and `pending`.
   - **Card 4: Financials** — Dual-metric card showing `PLATFORM REVENUE` (SaaS fees) and `NETWORK GMV` (cake sales), with lifetime context.
4. **Analytics Charts Section (Line 305):**
   - [`AnalyticsCharts.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AnalyticsCharts.tsx): Two side-by-side Recharts components (LineChart for SaaS Revenue, BarChart for Network GMV).
5. **Two-Column Lower Section (Lines 307–517):**
   - **Left Column (`xl:col-span-2`, Lines 309–493):**
     - Quick Administration Shortcuts: 3 cards linking to `/admin/shops` (Bakery Moderation), `/admin/plans` (SaaS Plans), and `/admin/messages` (Broadcasts).
     - Operational Communication Widgets: 2 cards linking to `/admin/feedback` (Platform Feedback) and `/admin/enquiries` (Contact Enquiries).
     - Recent Bakery Registrations Table: Top 5 newest registered bakeries with business name, owner details, date, status badges, and Storefront / Manage action buttons.
   - **Right Column (`xl:col-span-1`, Lines 495–516):**
     - Live Platform Activity Feed: Vertical scrollable card rendering events from `GET /api/admin/dashboard/stats/activity`.

---

## 3. Inventory of Existing Features, APIs & Reusable Data Sources

| Feature / UI Slot | Existing API Endpoint | Data Source / Repository Method | Current Frontend Call Site |
| :--- | :--- | :--- | :--- |
| **KPI Platform Metrics** | `GET /api/admin/dashboard/stats` | `AdminDashboardService.getPlatformStats()` | `lib/api/admin.ts:getPlatformStats` |
| **Shop Status Badges & Counts** | `GET /api/admin/shops/counts` | `AdminDashboardService.getShopStatusCounts()` | `lib/api/admin.ts:getShopCounts` |
| **Bakery Registrations (Top 5)** | `GET /api/admin/shops?page=0&size=5` | `AdminDashboardService.getAllShops()` | `lib/api/admin.ts:getAllShops` |
| **Recent Activity Log (Top 50)** | `GET /api/admin/dashboard/stats/activity` | `ActivityLogRepository.findTop50ByEntityTypeInOrderByTimestampDesc` | `lib/api/admin.ts:getRecentActivity` |
| **Monthly Revenue Analytics** | `GET /api/admin/dashboard/stats/analytics/revenue` | `PaymentRepository.getMonthlySubscriptionRevenueSince` & `OrderRepository.getMonthlyNetworkGmvSince` | `lib/api/admin.ts:getRevenueAnalytics` |
| **Communication Summary (Unread)** | `GET /api/admin/communication/summary` | `PlatformFeedbackRepository.countByIsReadFalse()` & `ContactEnquiryRepository.countByIsReadFalse()` | `lib/api/communication.ts:getCommunicationSummary` |
| **Platform Feedback List** | `GET /api/admin/feedback` | `PlatformFeedbackRepository.findWithFilters()` | `lib/api/communication.ts:getPlatformFeedback` |
| **Contact Enquiries List** | `GET /api/admin/enquiries` | `ContactEnquiryRepository.findWithFilters()` | `lib/api/communication.ts:getContactEnquiries` |
| **Global Integration Settings** | `GET /api/admin/settings` | `GlobalSettingsService.getSettings()` | `lib/api/adminSettings.ts:getSettings` |

---

## 4. Improvement Findings & Classification

Each proposed candidate is classified using the mandatory four-tier status:
- **Status 1: Already implemented and usable**
- **Status 2: Partially implemented and reusable**
- **Status 3: Missing and potentially requiring new work**
- **Status 4: Not verifiable from the current repository**

---

### Improvement A — Priority Actions and Pending Tasks

#### A.1: Pending Bakery Approvals
- **Classification:** **Status 1: Already implemented and usable**
- **Source of Truth:** `ShopRepository.countByStatus(ShopStatus.PENDING)`.
- **API:** `GET /api/admin/dashboard/stats` (`stats.pendingBakeries`).
- **Current UI:** Amber alert banner at the top of [`frontend_v2/app/admin/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/page.tsx#L157-L178).
- **Usability Gap:** Currently button links to `/admin/shops` (all bakeries) instead of pre-filtering pending bakeries (`/admin/shops?status=PENDING`).
- **Proposed Enhancement:** Update destination link to `/admin/shops?status=PENDING`. In the Bakery Storefronts KPI card, make the `pending` sub-badge clickable (`/admin/shops?status=PENDING`).

#### A.2: Unread Platform Feedback & Contact Enquiries
- **Classification:** **Status 2: Partially implemented and reusable**
- **Source of Truth:** `PlatformFeedbackRepository.countByIsReadFalse()` and `ContactEnquiryRepository.countByIsReadFalse()`.
- **API:** `GET /api/admin/communication/summary` returns `CommunicationSummaryResponse(unreadFeedbackCount, unreadEnquiriesCount)`.
- **Frontend Client:** `communicationApi.getCommunicationSummary()` in [`frontend_v2/lib/api/communication.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/communication.ts#L98-L104) is already implemented!
- **Current UI:** Lines 366–402 of `page.tsx` display two static cards for Platform Feedback and Contact Enquiries with zero counts or badges.
- **Proposed Enhancement:** Call `communicationApi.getCommunicationSummary()` inside `loadData()` in `page.tsx`. Display prominent unread count badges on both cards (e.g., `3 Unread` in amber/indigo). If count is 0, show `All resolved` in subtle slate.

#### A.3: Subscriptions Requiring Attention
- **Classification:** **Status 1: Already implemented and usable**
- **Source of Truth:**
  - `SubscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.EXPIRING_SOON)`
  - `SubscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.GRACE_PERIOD)`
  - `SubscriptionRepository.countUniqueShopsByStatusExcludingActive(SubscriptionStatus.PENDING)`
- **API:** `GET /api/admin/dashboard/stats` exposes `expiringSoonSubscribedBakeries`, `gracePeriodSubscribedBakeries`, and `pendingPaymentBakeries`.
- **Current UI:** SaaS Subscriptions card shows `expired` and `pending`, but does not surface grace period or expiring soon bakeries.
- **Proposed Enhancement:** Add an actionable sub-badge or inline warning badge in the SaaS Subscriptions card if `gracePeriodSubscribedBakeries > 0` (e.g. `2 in grace period`) linking to `/admin/shops`.

#### A.4: Failed or Unresolved Payments
- **Classification:** **Status 3: Missing and potentially requiring new work**
- **Source of Truth:** In the `payments` table, `status = 'FAILED'`. In `orders`, `payment_status = 'FAILED'`.
- **Current State:** Neither `PaymentRepository` nor `DashboardStatsResponse` provides a platform-wide failed payments counter.
- **Recommendation:** Do **not** invent an arbitrary API or run client-side polling. If requested, this can be addressed in Phase 5.5 (where the full cross-shop payment ledger with `FAILED` status filtering is introduced).

---

### Improvement B — Recent Admin Activity

- **Classification:** **Status 2: Partially implemented and reusable**
- **Source of Truth:** `ActivityLogRepository.findTop50ByEntityTypeInOrderByTimestampDesc(List.of("SHOP", "SUBSCRIPTION", "PAYMENT", "USER"))`.
- **API:** `GET /api/admin/dashboard/stats/activity`.
- **Events Logged in Repository:**
  - `SHOP`: `KYC_VERIFIED`, `KYC_REJECTED`, `STATUS_CHANGE` (`ACTIVE`, `SUSPENDED`, `INACTIVE`)
  - `SUBSCRIPTION`: `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_EXPIRED`
  - `PAYMENT`: `PAYMENT_COMPLETED`
  - `USER`: `ACCOUNT_DELETED`
- **Sensitive Data Audit:** `ActivityLog.metadata` contains human-readable audit summaries (e.g., `"Bakery KYC verified by admin"`, `"Rejection reason: Incomplete FSSAI"`, `"Amount: 2000.00"`). It does **not** contain passwords, tokens, API keys, or credit card numbers.
- **Current UI:** Lines 496–516 of `page.tsx` render raw strings:
  ```tsx
  <p className="text-xs font-semibold text-slate-800">{log.action}</p>
  {log.metadata && <p className="text-[11px] text-slate-500 mt-0.5">{log.metadata}</p>}
  ```
- **Proposed Enhancements:**
  1. **Action Formatting Map:** Map raw codes to user-friendly titles (e.g., `KYC_VERIFIED` $\rightarrow$ "KYC Approved", `STATUS_CHANGE` $\rightarrow$ "Status Updated", `SUBSCRIPTION_ACTIVATED` $\rightarrow$ "Subscription Activated").
  2. **Entity Icons & Badges:** Render distinct colored micro-badges by `entityType` (`SHOP`: indigo, `SUBSCRIPTION`: emerald, `PAYMENT`: amber, `USER`: purple).
  3. **Direct Deep Links:** If `log.shopId` is present, render a clickable link to [`/admin/shops/${log.shopId}`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/%5Bid%5D/page.tsx).
  4. **Clean Empty State:** When no activity records are returned, display: *"No recent platform events recorded."*
  5. **Relative Time Formatting:** Show relative time (e.g., *"12 minutes ago"*, *"2 hours ago"*) alongside the exact locale date-time.

---

### Improvement C — Revenue and Subscription Trends

- **Classification:** **Status 1: Already implemented and usable** (with UI clarity enhancements)
- **Source of Truth:** `PaymentRepository.getMonthlySubscriptionRevenueSince` (Phase 5.4 optimized) and `OrderRepository.getMonthlyNetworkGmvSince` (Phase 5.4 optimized).
- **API:** `GET /api/admin/dashboard/stats/analytics/revenue` returns `AnalyticsChartResponse(saasRevenue, networkGmv)` with 6 chronological data points.
- **Current UI:** [`frontend_v2/components/admin/AnalyticsCharts.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AnalyticsCharts.tsx):
  - Left card: LineChart for `SaaS Revenue Growth` (emerald `#10b981`).
  - Right card: BarChart for `Network GMV (Cake Sales)` (indigo `#6366f1`).
- **Proposed Enhancements (Frontend Only):**
  1. **Subtitles with Financial Definitions:**
     - SaaS Revenue: *"Platform subscription billing across active bakeries (CakeStore Revenue)"*
     - Network GMV: *"Total realized retail cake orders across all storefronts (0% Commission — 100% Retained by Bakeries)"*
  2. **Chart Header Aggregate Metrics:** Display the 6-month cumulative total in the top-right corner of each chart card (e.g., `6-Month Total: ₹14,999`).
  3. **Custom Tooltips:** Replace raw Recharts tooltip with a styled tooltip showing `fullMonth` (e.g., `"October 2026"`) and formatted currency (e.g., `₹2,500.00`).
  4. **Graceful Error State:** If the fetch fails, replace the disappearing component with a retry card (`"Unable to load analytics charts — [Retry]"`).

---

### Improvement D — Platform Health and Payment Alerts

#### D.1: Payment Gateway Configuration Status
- **Classification:** **Status 1: Already implemented and usable**
- **Source of Truth:** `GlobalSettingsService.getSettings()`.
- **API:** `GET /api/admin/settings` (returns `razorpayKeyId`, `razorpayKeySecretConfigured`, `razorpayWebhookSecretConfigured`).
- **Frontend Client:** `adminSettingsApi.getSettings()` in [`frontend_v2/lib/api/adminSettings.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/adminSettings.ts) is already implemented.
- **Proposed Enhancement:** If Razorpay credentials are missing (`!settings.razorpayKeyId || !settings.razorpayKeySecretConfigured`), display an informational configuration alert banner below the header:
  *"Payment Gateway Incomplete: Razorpay API Key or Webhook secret is not configured. Online customer checkouts and subscription billing will fail."* with a button linking to `/admin/settings`.
- **Preservation Principle Compliance:** Clearly labeled as **"Configuration Status"**, not live network connectivity ping.

#### D.2: Email / Notification Delivery Failures
- **Classification:** **Status 4: Not verifiable from the current repository**
- **Investigation:** `EmailService.java` sends emails via Resend HTTP API. Failures are logged to SLF4J (`log.warn`, `log.error`). No database table or entity stores email dispatch failures. `SmsService.java` similarly logs to SLF4J.
- **Decision:** Do **not** create fake health status indicators. Do not add background polling or monitoring tables.

#### D.3: Failed Payment Real-time Telemetry
- **Classification:** **Status 3: Missing and potentially requiring new work**
- **Decision:** Defer to Phase 5.5 when the full cross-shop payment ledger with `FAILED` filters is implemented.

---

### Improvement E — Small Visual Refinements

- **Classification:** **Status 1: Already implemented and usable**
- **Scope:** Pure frontend polish in `page.tsx` and `AnalyticsCharts.tsx` using existing Tailwind tokens:
  1. **Consistent Metric Alignments:** Standardize card padding (`p-6`), borders (`border-slate-200/80`), and shadow transitions (`shadow-soft hover:shadow-card`).
  2. **Refined Loading States:** Maintain loading skeleton/overlay during date filter updates instead of unmounting the full dashboard.
  3. **Consistent Badging:** Ensure all status tags use established color semantics (Emerald = Active/Live, Amber = Pending/Action Required, Rose = Expired/Failed, Indigo = Info/Platform).
  4. **Accessible Focus Rings:** Ensure all interactive links and buttons have consistent `focus-visible:ring-2 focus-visible:ring-indigo-500` outlines.

---

## 5. Current-Versus-Proposed Comparison

| Area | Current Implementation | Proposed Incremental Improvement | Benefit / Rationale |
| :--- | :--- | :--- | :--- |
| **Pending Bakery Alert** | Links to `/admin/shops` (all bakeries). | Links to `/admin/shops?status=PENDING`. | Takes admin directly to pending applications without manual filtering. |
| **Operational Communication** | 2 static cards with no count indicators. | Fetches `getCommunicationSummary()` and displays unread badges (`3 Unread`). | Alerts admin immediately to unresolved visitor enquiries and bakery feedback. |
| **Subscription Attention** | Shows total, active, expired, pending counts. | Surfaces `gracePeriodSubscribedBakeries` when $>0$. | Prevents unexpected bakery churn by highlighting accounts in grace period. |
| **Live Activity Feed** | Plain text display of raw action codes and raw ISO dates. | Human-readable titles, entity-type badge icons, relative timestamps, and shop links. | Transforms a raw debug log into an intuitive, readable operational stream. |
| **Activity Feed Empty State** | Renders blank empty box if no events. | Clean empty state with icon and descriptive message. | Avoids broken-looking UI when activity log table has no recent entries. |
| **Analytics Charts Tooltips** | Default unformatted Recharts tooltip (`amount: 2500`). | Formatted currency tooltip (`₹2,500`) with full month name (`October 2026`). | Accurate, clear presentation of financial numbers. |
| **Analytics Subtitles** | Bare headings (`SaaS Revenue Growth`, `Network GMV`). | Explanatory subtitles emphasizing 0% commission and platform revenue segregation. | Eliminates financial confusion between bakery GMV and CakeStore SaaS income. |
| **Integration Config Alert** | Not displayed on overview dashboard. | Subtle amber warning banner if Razorpay API keys are unconfigured. | Proactively alerts admin to misconfiguration before customer checkouts break. |

---

## 6. Proposed UI Placement (Preserving Layout)

All additions fit seamlessly into the existing layout without rearranging or adding new page sections:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Page Header: "Platform Intelligence & Control"   [Date Range Filter]   │
├────────────────────────────────────────────────────────────────────────┤
│  [Alert 1] (Conditional) Razorpay Keys Missing Banner ───> /settings    │
├────────────────────────────────────────────────────────────────────────┤
│  [Alert 2] (Conditional) N Bakeries Awaiting Verification ──> ?status=PENDING│
├────────────────────────────────────────────────────────────────────────┤
│  4 KPI CARDS:                                                          │
│  [Users]       [Bakery Storefronts]  [SaaS Subscriptions] [Financials] │
│  (Existing)    (Add clickable link)  (Surface grace period)(Existing)  │
├────────────────────────────────────────────────────────────────────────┤
│  ANALYTICS CHARTS:                                                     │
│  [SaaS Revenue Growth - 6 Mo]    [Network GMV (Cake Sales) - 6 Mo]     │
│  (Add 6-Mo Total & Tooltips)     (Add 0% Commission Subtitle)          │
├────────────────────────────────────────────────────────────────────────┤
│  2-COLUMN SECTION:                                                     │
│  LEFT (xl:col-span-2):                        RIGHT (xl:col-span-1):   │
│  ┌──────────────────────────────────────────┐ ┌──────────────────────┐ │
│  │ 3 Quick Nav Shortcuts (Existing)        │ │ Live Activity Feed   │ │
│  ├──────────────────────────────────────────┤ │ (Humanized actions,  │ │
│  │ 2 Communication Widgets                  │ │  entity badges,      │ │
│  │ [Feedback]          [Enquiries]          │ │  relative time,      │ │
│  │ (Add unread count)   (Add unread count)   │ │  deep shop links)    │ │
│  ├──────────────────────────────────────────┤ │                      │ │
│  │ Recent Bakery Registrations Table        │ │                      │ │
│  │ (Existing 5 rows with badges & actions)  │ │                      │ │
│  └──────────────────────────────────────────┘ └──────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Exact API & Data-Source Mappings

| UI Element | Source API Endpoint | JSON / DTO Properties Used | Error / Empty Fallback |
| :--- | :--- | :--- | :--- |
| **Verification Alert** | `GET /api/admin/dashboard/stats` | `pendingBakeries` | Hidden if `0` or null. |
| **Gateway Config Alert** | `GET /api/admin/settings` | `razorpayKeyId`, `razorpayKeySecretConfigured` | Hidden if configured. |
| **Feedback Unread Badge** | `GET /api/admin/communication/summary` | `unreadFeedbackCount` | Hidden if `0`; fallback `{ unreadFeedbackCount: 0 }`. |
| **Enquiry Unread Badge** | `GET /api/admin/communication/summary` | `unreadEnquiriesCount` | Hidden if `0`; fallback `{ unreadEnquiriesCount: 0 }`. |
| **SaaS Subscriptions Card** | `GET /api/admin/dashboard/stats` | `gracePeriodSubscribedBakeries`, `expiringSoonSubscribedBakeries` | Fallback to `0`. |
| **Activity Feed** | `GET /api/admin/dashboard/stats/activity` | `action`, `entityType`, `metadata`, `timestamp`, `shopId` | Renders clean empty state if list is empty. |
| **Analytics Charts** | `GET /api/admin/dashboard/stats/analytics/revenue` | `saasRevenue[].{month, fullMonth, amount}`, `networkGmv[].{month, fullMonth, amount}` | Displays retry card if fetch fails. |

---

## 8. Minimal Frontend Changes & Backend Requirements

### Frontend Changes (Strictly Additive)
- [`frontend_v2/app/admin/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/page.tsx):
  - In `loadData()`: Include `communicationApi.getCommunicationSummary()` and `adminSettingsApi.getSettings()` in the existing `Promise.all` fetch.
  - In Alert Banner: Update URL from `/admin/shops` to `/admin/shops?status=PENDING`.
  - In Communication Widgets: Add `{commSummary?.unreadFeedbackCount > 0 && <Badge variant="warning">{commSummary.unreadFeedbackCount} unread</Badge>}`.
  - In Activity Feed: Add humanized action labels map, entity type badge styling, shop deep link, and empty state.
  - In SaaS Subscriptions Card: Render `gracePeriodSubscribedBakeries` tag if $> 0$.
- [`frontend_v2/components/admin/AnalyticsCharts.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AnalyticsCharts.tsx):
  - Add descriptive subtitle under each chart header.
  - Add 6-month aggregate sum badge in the card header.
  - Format Recharts tooltips with Indian currency formatting (`₹X,XXX`) and `fullMonth`.
  - Add clean error retry state.

### Backend Requirements: **ZERO Changes Needed!**
All required data, endpoints, services, and queries **already exist and are verified**:
- `GET /api/admin/dashboard/stats` $\rightarrow$ Already implemented & verified.
- `GET /api/admin/dashboard/stats/activity` $\rightarrow$ Already implemented & verified.
- `GET /api/admin/dashboard/stats/analytics/revenue` $\rightarrow$ Already implemented & verified.
- `GET /api/admin/communication/summary` $\rightarrow$ Already implemented & verified.
- `GET /api/admin/settings` $\rightarrow$ Already implemented & verified.
- `GET /api/admin/shops?page=0&size=5` $\rightarrow$ Already implemented & verified.

---

## 9. Security, Privacy, Multi-Tenancy & Performance

1. **Authorization & RBAC:**
   - All targeted endpoints require `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`.
   - Non-admin users receiving 401/403 are redirected to login.
2. **Multi-Tenant Boundary:**
   - Platform metrics aggregate across all shops without cross-contaminating private shop settings or exposing owner credentials.
   - Activity logs show shop actions at a platform governance level, preserving tenant isolation.
3. **Sensitive Data Protection:**
   - `ActivityLog` entries do not contain user passwords, hashes, tokens, or credit card details.
   - Razorpay secret values remain masked as booleans (`razorpayKeySecretConfigured: true`); secret strings are never returned in `GlobalSettingsResponse`.
4. **Performance Impact:**
   - `getCommunicationSummary()` runs two indexed count queries (`countByIsReadFalse()`).
   - `getSettings()` reads a single row from the database.
   - All fetches occur in parallel via `Promise.all`, adding negligible (< 15ms) overhead.

---

## 10. Proposed Regression Tests & Acceptance Checks

### Automated Test Coverage
- Existing backend test suites already cover all underlying endpoints:
  - `AdminDashboardDateFilterTest`: 11/11 tests pass.
  - `RevenueSegregationE2ETest`: 5/5 tests pass.
  - `StageBAdminOperationsTest`: 14/14 tests pass.
  - `AdminSettingsSecurityE2ETest`: 5/5 tests pass.
- Verification checks:
  - Execute `npm run lint` and `npx tsc --noEmit` in `frontend_v2` to guarantee zero type errors or lint warnings.

### Manual Acceptance Checklist
1. **Pending Approval Alert:** Confirm clicking "Review Applications" opens `/admin/shops` with the PENDING tab active.
2. **Communication Badges:** Confirm unread badges appear when unread feedback/enquiries exist, and display `0` / hidden when all are read.
3. **Activity Feed:** Confirm humanized text displays (e.g., "KYC Approved" instead of `KYC_VERIFIED`), timestamps are readable, and clicking a shop navigates to `/admin/shops/:id`.
4. **Activity Empty State:** Confirm an informative empty state appears if activity logs are empty.
5. **Chart Tooltips & Subtitles:** Confirm hovering over chart data points displays `₹{amount}` and `"Month Year"`, and subtitles clarify 0% commission.
6. **Gateway Alert:** In a test environment without Razorpay keys, confirm the amber warning banner displays; with keys configured, confirm banner is hidden.

---

## 11. Phased Implementation Order & Dependencies

| Step | Scope | Target File | Pre-requisites | Acceptance Criteria |
| :---: | :--- | :--- | :--- | :--- |
| **Step 1** | **Priority Actions & Communication Badges** | `frontend_v2/app/admin/page.tsx` | Plan approval | Unread feedback & enquiry counts appear on communication cards; pending bakery link updated. |
| **Step 2** | **Activity Feed Enhancement** | `frontend_v2/app/admin/page.tsx` | Step 1 | Humanized action labels, entity badges, relative time, and empty state rendered. |
| **Step 3** | **Analytics Charts Polish** | `frontend_v2/components/admin/AnalyticsCharts.tsx` | Step 1 | Formatted tooltips, explanatory subtitles, and 6-month totals rendered. |
| **Step 4** | **Payment Gateway Configuration Alert** | `frontend_v2/app/admin/page.tsx` | Step 1 | Amber banner appears only if Razorpay credentials are unconfigured. |
| **Step 5** | **Typecheck & Regression Verification** | Whole workspace | Steps 1–4 | `npx tsc --noEmit` and `npm run lint` pass with 0 errors. |

---

## 12. Explicit List of Untouched Functionality & Files

The following components and files **must remain 100% untouched**:
1. All Flyway database migrations (`backend/src/main/resources/db/migration/*`).
2. Authentication & security filters (`JwtAuthenticationFilter.java`, `SecurityConfig.java`).
3. Core multi-tenant models (`Shop.java`, `User.java`, `Order.java`, `Payment.java`, `Subscription.java`).
4. Webhook controllers & payment processors (`WebhookController.java`, `RazorpayService.java`).
5. Bakery storefronts & customer ordering flows (`StorefrontCheckoutTab.tsx`, `CartDrawer.tsx`).
6. Owner dashboard pages (`frontend_v2/app/dashboard/owner/*`).
7. Sidebar navigation layout structure (`frontend_v2/app/admin/layout.tsx`).

---

## 13. Open Questions Requiring User Decisions

Before proceeding to implementation, please confirm your preference on the following two optional enhancements:

1. **Payment Gateway Alert Banner:**
   - *Option A (Recommended):* Display an amber warning banner on the admin overview page **only if** Razorpay API credentials are missing in `GlobalSettings`.
   - *Option B:* Omit the banner from the overview page and keep gateway status exclusively within `/admin/settings`.
2. **Activity Feed Display Limit:**
   - *Option A (Recommended):* Keep the existing scrollable card showing the latest 10 events with a scrollbar to view up to 50.
   - *Option B:* Limit the view to exactly 5 recent events with a compact *"View more in Bakery Moderation"* footer link.

---

## 14. Stop Condition & Confirmation

- **No Application Code Changed:** Zero lines of production or frontend code were modified.
- **No Tests Modified:** Test suites and test configurations remain untouched.
- **No Migrations Created:** Zero SQL migration files were introduced or modified.
- **No Git State Altered:** No commits, pushes, or deployments were executed.

**Execution stopped. Awaiting explicit user approval of this plan before beginning Step 1.**
