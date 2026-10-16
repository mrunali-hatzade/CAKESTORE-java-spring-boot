# CakeStore Admin Overview — Phase 3: Layout & Wording Report

**Document:** `CAKESTORE_ADMIN_OVERVIEW_LAYOUT_AND_WORDING_REPORT.md`  
**Date:** October 13, 2026  
**Status:** Implementation Complete & Validated  
**Target Route:** `/admin` (`frontend_v2/app/admin/page.tsx` & `frontend_v2/components/admin/AnalyticsCharts.tsx`)  

---

## 1. Executive Summary

Phase 3 of the CakeStore Admin Overview improvements has been successfully implemented:
1. **Simplified & Clear Display Wording:** Applied all 15 simplified terminology mappings across the dashboard, replacing ambiguous or overly technical jargon with plain, intuitive SaaS terms (e.g. `Registered Users`, `Registered Bakeries`, `Subscription Revenue`, `Bakery Sales`, `Manage Bakeries`, `Manage Plans & Pricing`, `Announcements`).
2. **Full-Width Bakery Table:** Recently Registered Bakeries has been upgraded from a cramped 2/3 column layout to a dedicated, full-width section with generous cell padding, clear owner/contact alignment, non-wrapping status badges, and prominent Storefront / Manage action buttons.
3. **Full-Width Recent Platform Activity:** Relocated from a constrained right sidebar into its own full-width section situated directly **below** the bakery table, complete with compact vertical spacing, a clean timeline feed, relative timestamps, and internal scrolling (`max-h-[360px]`).
4. **Logical Communications & Quick Actions Hub:** Platform Management quick actions (`Manage Bakeries`, `Manage Plans & Pricing`, `Announcements`) and Communications cards (`Feedback & Reviews`, `Customer Enquiries`) are positioned cohesively above the bakery table.

---

## 2. Summary of Changes

### A. Display Label Wording Simplification

| Previous Display Label | New Simplified Display Label | Location / Component |
|---|---|---|
| `Platform Intelligence & Control` | **Admin Overview** | `page.tsx` (Page Header) |
| `Platform Users` | **Registered Users** | `page.tsx` (KPI Card 1) |
| `Bakery Storefronts` | **Registered Bakeries** | `page.tsx` (KPI Card 2) |
| `SaaS Subscriptions` | **Bakery Plans & Subscriptions** | `page.tsx` (KPI Card 3) |
| `Subscription Records` | **Total Subscription Records** | `page.tsx` (KPI Card 3 Subtitle) |
| `Platform Revenue` | **Subscription Revenue** | `page.tsx` (KPI Card 4) |
| `Network Retail` / `Network Retail GMV` | **Bakery Sales** | `page.tsx` (KPI Card 4 Callout) |
| `Financial Intelligence & Volume Trends` | **Revenue & Sales Overview** | `AnalyticsCharts.tsx` (Section Header) |
| `SaaS Revenue Growth` | **Subscription Revenue Trend** | `AnalyticsCharts.tsx` (Chart 1 Header) |
| `Network GMV (Cake Sales)` | **Bakery Sales Trend** | `AnalyticsCharts.tsx` (Chart 2 Header) |
| `Bakery Moderation` | **Manage Bakeries** | `page.tsx` (Quick Action Card 1) |
| `SaaS Subscription Plans` | **Manage Plans & Pricing** | `page.tsx` (Quick Action Card 2) |
| `System Broadcasts` | **Announcements** | `page.tsx` (Quick Action Card 3) |
| `Recent Bakery Registrations` | **Recently Registered Bakeries** | `page.tsx` (Table Heading) |
| `Platform Feedback` | **Feedback & Reviews** | `page.tsx` (Communication Card 1) |
| `Contact Enquiries` | **Customer Enquiries** | `page.tsx` (Communication Card 2) |

*Metric calculations, underlying API contracts (`getPlatformStats`, `getRevenueAnalytics`, `getAllShops`, `getRecentActivity`, `getCommunicationSummary`), and date filters remain strictly unchanged.*

---

### B. Layout Architecture Restructuring

```
┌────────────────────────────────────────────────────────────────────────┐
│ Header: Admin Overview + Live Dashboard + Date Filter                  │
├────────────────────────────────────────────────────────────────────────┤
│ Action Center: Payment Gateway Alert | Pending Verification Alert       │
├────────────────────────────────────────────────────────────────────────┤
│ 4-Card KPI Row:                                                        │
│ [Registered Users] [Reg. Bakeries] [Plans & Subs] [Subscription Rev]   │
├────────────────────────────────────────────────────────────────────────┤
│ Revenue & Sales Overview (<AnalyticsCharts />)                         │
│ [Subscription Revenue Trend]          [Bakery Sales Trend]             │
├────────────────────────────────────────────────────────────────────────┤
│ Platform Management (Quick Actions):                                   │
│ [Manage Bakeries]     [Manage Plans & Pricing]    [Announcements]      │
├────────────────────────────────────────────────────────────────────────┤
│ Communications Hub:                                                    │
│ [Feedback & Reviews (Unread pill)]   [Customer Enquiries (Unread pill)]│
├────────────────────────────────────────────────────────────────────────┤
│ Recently Registered Bakeries Table (FULL WIDTH)                        │
│ - Spacious Bakery, Owner/Contact, Date, Non-wrapping Status, Actions   │
├────────────────────────────────────────────────────────────────────────┤
│ Recent Platform Activity (FULL WIDTH - BELOW TABLE)                    │
│ - Compact timeline with max-h-[360px] internal scrolling               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Verification & Test Results

| Step | Test Suite / Command | Result | Details |
|---|---|---|---|
| 1 | `node --test __tests__/*.test.mjs` | **PASS (19/19)** | Concurrency, dirty-state, and privacy suites all pass |
| 2 | `npx tsc --noEmit` | **PASS (0 errors)** | Full TypeScript static analysis passed without errors |
| 3 | `npm run lint` | **PASS (0 warnings)** | Next.js ESLint passed with 0 warnings/errors |
| 4 | `npm run build` | **PASS (38/38 routes)** | Full production bundle compiled cleanly for all pages |

---

## 4. Responsive Verification & Horizontal Overflow Check

- **Mobile Viewport (375px):**
  - KPI cards stack cleanly in 1 column.
  - Action Center cards stack cleanly.
  - Recently Registered Bakeries table has a dedicated overflow wrapper (`overflow-x-auto min-w-[680px]`) allowing swipeable inspection without causing page-wide horizontal overflow.
  - Recent Platform Activity cards display cleanly with wrapping metadata and prominent shop links.
- **Tablet Viewport (768px):**
  - 2-column KPI grid and side-by-side action center.
  - Quick action modules and communication cards adapt to medium breakpoint.
- **Desktop & Widescreen Viewports (1280px & 1920px):**
  - Full-width bakery table has optimal breathing room for long business names and emails.
  - Activity feed below the table eliminates the previously awkward empty column on widescreen displays.

---

## 5. Preservation & Scope Confirmation

- **Backend / Database:** 0 changes to Java services, DTOs, controllers, database tables, or migrations.
- **Data & APIs:** All dynamic values, state hooks, error fallbacks, and event handlers are preserved.
- **Working Tree:** Unrelated modified and untracked files remain intact. No git commits, staging, or pushes performed.

---

*Phase 3 is complete and ready for your manual checkup. Awaiting approval.*
