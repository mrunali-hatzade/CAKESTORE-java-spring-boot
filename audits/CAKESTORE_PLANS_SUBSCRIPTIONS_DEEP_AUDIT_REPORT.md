# CakeStore — Admin Plans & Subscriptions Deep Technical Audit Report

**Date of Execution**: October 16, 2026  
**Audit Protocol**: Strictly READ-ONLY Technical Audit & Live Codebase Inspection  
**Environment**: Local Development (PostgreSQL 15, Spring Boot 3.3.x on port 8080, Next.js 14.2.5 on port 3000)  
**Deliverable Document**: `CAKESTORE_PLANS_SUBSCRIPTIONS_DEEP_AUDIT_REPORT.md`  

---

## 1. Executive Summary

A comprehensive, strictly read-only technical audit of the CakeStore Super Admin **Plans & Subscriptions** module was conducted across frontend React/Next.js implementations, TypeScript definitions, Spring Boot REST controllers, subscription orchestration services, scheduled background jobs, payment verification workflows, and database entity schemas.

### Overall Verdict: **PRODUCTION-GRADE & OPERATIONALLY SOUND (ROBUST WITH MINOR ENHANCEMENT CANDIDATES)**

- **Core Strengths & Solid Architectural Decisions**:
  1. **Strict Immutability & Referential Integrity**: Unlike legacy CRUD systems that allow deleting subscription plans (which breaks foreign keys or historical audit logs in `subscriptions` and `payments`), CakeStore correctly omits plan deletion. Plans can only be toggled (`isActive: false`), preserving database referential integrity and historical invoice traceability.
  2. **Decoupled Financial Model**: The platform strictly enforces server-authoritative pricing. Bakery owners cannot forge plan prices during payment initiation. The backend checks `plan.getPrice()`, creates local `Payment` records in `PENDING` status, validates Razorpay order amount in paise, and enforces HMAC-SHA256 signature verification with pessimistic write locks.
  3. **Careful Lifecycle Restoration Logic**: Subscription renewals strictly respect administrative governance. Soft-deleted bakeries remain deleted, `SUSPENDED` bakeries remain suspended (cannot bypass admin moderation by paying), and `INACTIVE` bakeries remain inactive (respecting the owner's operational pause). Only `EXPIRED` or `PENDING` bakeries are automatically activated upon payment.
  4. **Period-End Cancellation Guarantee**: Owner cancellations do not terminate bakery access immediately. Access is preserved until `expiryDate`, scheduling notifications are suppressed, and an audit trail with owner reason is preserved.
  5. **Automated Expiry Engine**: `SubscriptionScheduler` runs daily at midnight (`0 0 0 * * ?`), issuing multi-tier advance notifications at 7, 5, 3, and 1 day(s) before expiry, and automatically downgrading non-renewed active bakeries to `EXPIRED` status with storefront cache eviction.

- **Identified Nuances & Recommendations**:
  1. **Nomenclature & Routing Clarification**: In `frontend_v2/app/admin/layout.tsx`, the platform navigation link is labeled `"Plans & Subscriptions"` and routes to `/admin/plans`. The view is primarily a **Subscription Plan Tier Management & Reordering Catalog**. Individual active bakery subscriptions are not listed on a standalone global ledger; rather, they are accessed through individual bakery details (`/admin/shops/[id]`), the Payments Ledger (`/admin/payments`), and dashboard metrics (`/admin`).
  2. **Features Serialization Format**: In `AdminPlanModal.tsx`, features are captured as comma-separated strings. In `page.tsx`, the renderer safely supports both JSON array parsing and comma-delimited strings. Standardizing this into a clean JSON array structure in the database would simplify downstream consumers (such as public marketing and owner checkout screens).
  3. **Plan Reorder Atomic Batching**: `AdminSubscriptionPlanController.reorderPlans` iterates over plan IDs and executes individual `planRepository.save()` calls in a loop. Wrapping this in a `@Transactional` batch update would prevent partial display-order states in the unlikely event of database transient failures.

---

## 2. Scope, Environment, and Methodology

### 2.1 Scope of Audit
1. **Frontend Admin Views & Components**:
   - `frontend_v2/app/admin/plans/page.tsx` (SaaS Subscription Plans catalog, monthly/yearly grouping, display ordering)
   - `frontend_v2/components/admin/plans/AdminPlanModal.tsx` (Plan creation/editing modal dialog)
   - `frontend_v2/app/admin/layout.tsx` (Sidebar navigation and route protection)
   - `frontend_v2/app/admin/shops/[id]/page.tsx` (Individual bakery subscription information & billing history)
   - `frontend_v2/app/admin/payments/page.tsx` (SaaS subscription payment transactions and drawer snapshots)
   - `frontend_v2/lib/api/admin.ts` (API client functions)
   - `frontend_v2/types/admin.ts` (`AdminPlan` interface)
2. **Owner-Side Integration**:
   - `frontend_v2/app/dashboard/owner/subscription/page.tsx` (Owner subscription management, plan selection, renewal, and cancellation)
   - `frontend_v2/lib/api/plans.ts`, `frontend_v2/lib/services/payments.ts`
3. **Backend Controllers, Services, & Entities**:
   - `AdminSubscriptionPlanController.java` (`/api/admin/plans`)
   - `PublicSubscriptionPlanController.java` (`/api/subscription-plans`)
   - `OwnerSubscriptionController.java` (`/api/owner/subscriptions`)
   - `OwnerPaymentController.java` (`/api/owner/payments/initiate-subscription`, `/verify-subscription`)
   - `SubscriptionService.java` (Subscription activation, cancellation, expiration, shop status orchestration)
   - `SubscriptionScheduler.java` (Automated daily cron runner and notification dispatcher)
   - `SubscriptionPlan.java`, `Subscription.java`, `SubscriptionStatus.java`
   - `SubscriptionPlanRepository.java`, `SubscriptionRepository.java`
4. **Database Schemas & Tables**:
   - PostgreSQL tables: `subscription_plans`, `subscriptions`, `payments`

### 2.2 Environment
- **Database**: PostgreSQL 15, database `cake_platform`
- **Backend**: Spring Boot 3.3.x on Java 17, `http://localhost:8080`
- **Frontend**: Next.js 14.2.5 (React 18), `http://localhost:3000`
- **Security Context**: Spring Security with JWT and RBAC (`ROLE_ADMIN`, `ROLE_SHOP_OWNER`, `ROLE_CUSTOMER`)

### 2.3 Strict Read-Only Protocol
No source files, database records, Flyway migrations, or configuration settings were modified during this investigation. All findings are derived from source inspection, schema analysis, and cross-module code tracing.

---

## 3. Architecture & Navigation Map

```
Admin Sidebar (admin/layout.tsx)
  └── "Plans & Subscriptions" [CreditCard Icon]
        └── Route: /admin/plans
              ├── Header Controls
              │     ├── "Save Order" (Enabled when order altered)
              │     └── "Create Plan" [AdminPlanModal]
              ├── Monthly Plans Section
              │     ├── Tier Cards (Pro, Starter, etc.)
              │     │     ├── Order controls (Up / Down)
              │     │     ├── Status Badge (Active / Disabled)
              │     │     ├── Price (₹ / duration days)
              │     │     ├── Parsed Feature Checklist
              │     │     ├── "Edit Tier" [AdminPlanModal]
              │     │     └── "Enable / Disable" [togglePlanStatus]
              │     └── "Add Another Tier" (Quick Create Slot)
              └── Yearly Plans Section
                    └── Tier Cards (Pro Yearly, Enterprise, etc.)

Associated Subscription Auditing Touchpoints:
  ├── /admin/shops/[id]
  │     ├── Card: "Subscription Plan" (Tier, status, start/end date, days remaining)
  │     ├── Historical Subscriptions List
  │     └── Card: "Subscription Billing History" (Payments, invoice numbers, amounts)
  ├── /admin/payments
  │     ├── Filter: "SaaS Subscription (Platform Rev)"
  │     └── Drawer: "Associated Subscription Snapshot" (Plan tier, status, cycle)
  └── /admin
        └── Dashboard Metrics: Active Subscriptions, Expired Subscriptions, Platform MRR/ARR
```

---

## 4. Frontend Component & View Verification

### 4.1 Plan Management Directory (`frontend_v2/app/admin/plans/page.tsx`)

| Feature / Control | Implementation Details | Verification Finding |
| :--- | :--- | :--- |
| **Route & Auth** | `/admin/plans` under `AdminLayout` | **PASS**. Guarded by `useAuth()` requiring `ROLE_ADMIN`. Non-admins are redirected to `/login`. |
| **Billing Cycle Segregation** | Dynamically groups plans into `['monthly', 'yearly']` | **PASS**. Fallback logic (`!p.billingCycle && cycle === 'monthly'`) ensures legacy unassigned plans render cleanly under Monthly. Empty Yearly section cleanly collapses. |
| **Interactive Reordering** | `movePlan(planId, 'up' \| 'down', cycle)` | **PASS**. Updates state in-memory within the specific billing cycle, sets `isOrderChanged = true`, and highlights the "Save Order" button. |
| **Order Persistence** | `handleSaveOrder()` invokes `reorderPlans(planIds)` | **PASS**. Sends ordered ID list to backend; shows loading state (`Saving...`), triggers toast notification, and refreshes the catalog. |
| **Active / Disabled Toggle** | `handleToggleStatus(plan)` | **PASS**. Calls `togglePlanStatus(id, !plan.isActive)`, performs optimistic state update, and alerts via toast (`"Plan X is now active/disabled"`). Disabled plans render with `opacity-70 bg-slate-50/70`. |
| **Feature List Parsing** | Supports JSON arrays and comma-separated lists | **PASS**. Safely parses JSON array (e.g. `["Feature 1", "Feature 2"]`) with fallback to comma-separated splitting. Displays up to 4 bullet points with emerald checkmarks, and `+ N more features` overflow badge. |
| **Event-Driven Refresh** | Listens to `window.addEventListener('adminGlobalRefresh')` | **PASS**. Automatically reloads plans silently on platform-wide global refresh events. |

### 4.2 Modal Dialog (`frontend_v2/components/admin/plans/AdminPlanModal.tsx`)

- **Form Fields**:
  - `Plan Name`: Text input, mandatory.
  - `Description`: Textarea for tier target audience summary.
  - `Billing Cycle`: Dropdown (`monthly` or `yearly`). Selecting `yearly` auto-defaults duration to 365 days; selecting `monthly` auto-defaults duration to 30 days.
  - `Price (₹)`: Number input, minimum 0.
  - `Duration (Days)`: Number input, minimum 1, validated integer.
  - `Features`: Textarea for comma-delimited feature bullets.
  - `Active Plan Checkbox`: Boolean toggle for immediate storefront availability.
- **Client Validation**:
  - Checks for non-empty trimmed name (`toast.error('Plan name cannot be empty')`).
  - Checks for valid non-negative price (`toast.error('Plan price cannot be negative')`).
  - Checks for integer duration > 0 (`toast.error('Duration days must be greater than zero')`).
  - Checks billing cycle equality to `'monthly'` or `'yearly'`.

---

## 5. Backend REST API Contracts & Security Enforcement

### 5.1 Controller Analysis: `AdminSubscriptionPlanController.java`

- **Base URL**: `/api/admin/plans`
- **Class-Level Security**: `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`

| Endpoint | HTTP Method | Request Payload | Response | Server-Side Validation |
| :--- | :--- | :--- | :--- | :--- |
| `/api/admin/plans` | `GET` | None | `List<SubscriptionPlan>` | Ordered by `displayOrder ASC`. |
| `/api/admin/plans` | `POST` | `SubscriptionPlan` body | `SubscriptionPlan` | Validates non-empty name, price >= 0, durationDays > 0, cycle in (`monthly`, `yearly`). |
| `/api/admin/plans/{id}` | `PUT` | `SubscriptionPlan` updates | `SubscriptionPlan` | Updates editable fields; executes `validatePlan()`; persists entity. |
| `/api/admin/plans/{id}/status`| `PATCH` | `@RequestParam Boolean isActive`| `SubscriptionPlan` | Updates `isActive` flag and saves. |
| `/api/admin/plans/reorder` | `PUT` | `List<Long> planIds` | `200 OK` | Assigns index `i` as `displayOrder` and saves each plan. |

### 5.2 Public Exposure: `PublicSubscriptionPlanController.java`

- **Base URL**: `/api/subscription-plans`
- **Security**: Publicly accessible (`permitAll()`) for onboarding bakery owners and pricing marketing pages.
- **Query Filter**: Executes `subscriptionPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc()`.
- **DTO Mapping**: Projects to `SubscriptionPlanResponse` DTO to prevent exposing internal fields. Disabled plans (`isActive = false`) are strictly omitted.

---

## 6. Subscription Lifecycle & Business Rules Engine

### 6.1 Subscription Checkout & Server-Authoritative Pricing

```
Bakery Owner Checkout (/dashboard/owner/subscription)
   │
   ├── 1. POST /api/owner/payments/initiate-subscription (planId)
   │      ├── Look up plan in DB; verify isActive == true.
   │      ├── Read price directly from plan entity (Client cannot forge amount).
   │      ├── Create Payment entity (status = PENDING, provider = RAZORPAY).
   │      └── Create Razorpay Order with amount in paise.
   │
   └── 2. Owner completes Razorpay Checkout Modal
          │
          └── 3. POST /api/owner/payments/verify-subscription (orderId, paymentId, signature, planId)
                 ├── Verify HMAC-SHA256 signature using Razorpay Key Secret.
                 ├── Validate payment order amount matches DB plan price.
                 ├── Lock payment row with PESSIMISTIC_WRITE lock.
                 └── Call SubscriptionService.processSuccessfulPayment(...)
```

### 6.2 Precise Bakery Status Restoration Rules

In `SubscriptionService.java` (lines 153–169), CakeStore implements strict governance during subscription renewal:

```java
// 3. Update Shop Status: Precise Renewal Restoration Rules
if (shop.isDeleted()) {
    log.warn("Shop {} is soft-deleted. Subscription payment processed, but shop remains deleted.", shop.getId());
} else if (shop.getStatus() == ShopStatus.SUSPENDED) {
    log.info("Shop {} is SUSPENDED by admin. Subscription renewed but shop remains SUSPENDED.", shop.getId());
} else if (shop.getStatus() == ShopStatus.INACTIVE) {
    // Legacy INACTIVE shops: Subscription activates, but shop remains INACTIVE until explicit owner re-opening.
    log.info("Shop {} is legacy INACTIVE. Subscription renewed; shop status remains INACTIVE.", shop.getId());
} else if (shop.getStatus() == ShopStatus.EXPIRED || shop.getStatus() == ShopStatus.PENDING) {
    // Eligible expired or pending onboarding shop: restore to ACTIVE
    shopStatusManager.activateShop(shop.getId(), userId);
} else if (shop.getStatus() == ShopStatus.ACTIVE) {
    // Already ACTIVE shop renewing early: preserve ACTIVE status and keep existing operational flags intact
    log.info("Shop {} is already ACTIVE. Subscription extended; preserving existing operational flags.", shop.getId());
}
```

**Key Architectural Insights**:
1. Paying for a subscription **cannot** override an administrative suspension (`SUSPENDED` remains suspended).
2. Paying for a subscription **cannot** force a bakery open if the owner explicitly paused operations (`INACTIVE` remains inactive).
3. Paying for a subscription **cannot** resurrect a soft-deleted compliance record (`DELETED` remains deleted).
4. Only legitimate unpaid accounts (`EXPIRED` or initial onboarding `PENDING`) are automatically unlocked to `ACTIVE`.

### 6.3 Cancellation Semantics

- **Endpoint**: `POST /api/owner/subscriptions/cancel`
- **Behavior**: Calls `SubscriptionService.cancelSubscription()`.
- **Access Period**: Access is preserved until `expiryDate`. It does **not** terminate storefront availability immediately.
- **Idempotency**: If `activeSub.getCancelledAt() != null`, returns the existing record without duplicating notifications.
- **Audit Logging**: Logs activity `SUBSCRIPTION_CANCELLATION_SCHEDULED` with the owner-supplied reason.
- **Notification**: Alerts the owner that access remains intact until `expiryDate` and no further renewals will occur.

### 6.4 Expiration & Automated Enforcement Engine

`SubscriptionScheduler.java` runs via Spring `@Scheduled(cron = "0 0 0 * * ?")`:
1. **Advance Warnings**:
   - Checks `daysUntilExpiry = ChronoUnit.DAYS.between(now, expiryDate)`.
   - On days 7, 5, 3, and 1: Sends `SUBSCRIPTION_EXPIRING` notification to the bakery owner and high-priority admin alert (if subscription is not marked cancelled).
2. **Auto-Expiration Execution**:
   - When `daysUntilExpiry <= 0`: Calls `SubscriptionService.expireSubscription(sub.getId())`.
   - Sets `subscription.status = SubscriptionStatus.EXPIRED`.
   - If no other active subscription exists for this bakery, sets `shop.status = ShopStatus.EXPIRED`.
   - Evicts storefront Redis/memory caches (`evictShopDetails`, `evictShopProducts`).
   - Dispatches `SUBSCRIPTION_EXPIRED` notifications to both owner and platform super admins.

---

## 7. Cross-Module Auditing & Touchpoints

| Admin Module | Subscription Integration Point | Implementation Reality |
| :--- | :--- | :--- |
| **Bakery Details** (`/admin/shops/[id]`) | Active Plan Card & History | Displays current plan name, price, start date, expiration date, and dynamic countdown badge (`X days left`). If multiple subscriptions exist, displays previous subscription history table. |
| **Bakery Details** (`/admin/shops/[id]`) | Subscription Billing History | Displays list of completed subscription payments with date, gateway transaction reference, amount, and invoice status. |
| **Payments Ledger** (`/admin/payments`) | Revenue Classification | Filter tab `SaaS Subscription (Platform Rev)` isolates subscription revenue from retail bakery GMV. Clicking a transaction opens a slide-over drawer displaying an "Associated Subscription Snapshot". |
| **Admin Overview** (`/admin`) | Platform Dashboard Stats | Displays active subscribed bakeries, expired subscribed bakeries, monthly platform revenue, and annual recurring revenue (ARR). |
| **Notifications** (`/admin/notifications`) | Subscription Events | Receives automated dispatches for `SUBSCRIPTION_RENEWED` and `SUBSCRIPTION_EXPIRED`. |

---

## 8. Database Schema & Integrity Review

### 8.1 Table: `subscription_plans`

```sql
CREATE TABLE subscription_plans (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
    price NUMERIC(19, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    duration_days INTEGER NOT NULL,
    features TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);
```

### 8.2 Table: `subscriptions`

```sql
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    plan_id BIGINT REFERENCES subscription_plans(id),
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    amount NUMERIC(19, 2) NOT NULL,
    start_date TIMESTAMP WITHOUT TIME ZONE,
    expiry_date TIMESTAMP WITHOUT TIME ZONE,
    cancelled_at TIMESTAMP WITHOUT TIME ZONE,
    cancellation_reason VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);
```

### 8.3 Data Integrity Observations:
- **Foreign Key Protection**: `subscriptions.plan_id` points to `subscription_plans(id)`. Because the backend does not implement plan deletion, `plan_id` references are never left dangling.
- **Price Immutability**: Historical subscription transactions in `subscriptions` and `payments` store their own `amount` column (`BigDecimal`). If an administrator updates a plan's price from ₹999 to ₹1,499, existing active and historical subscriptions maintain their recorded price without retrospective data corruption.
- **Tenant Isolation**: In `SubscriptionRepository`, queries are scoped by `shopId`. In `OwnerPaymentController`, payments are validated against `shopAccessValidator.getShopByOwnerId(userDetails.getId())`.

---

## 9. Comprehensive Defect & Improvement Analysis

### Findings Summary Matrix

| ID | Module / Area | Severity | Finding Summary | Impact | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PS-01** | `AdminSubscriptionPlanController` | Low | Reorder loop lacks `@Transactional` boundary | If DB connection drops during a 10-plan reorder, partial ordering indices could persist. | Improvement Candidate |
| **PS-02** | `AdminPlanModal` vs `page.tsx` | Low | Inconsistent Features formatting (JSON vs CSV) | Modal saves comma-separated string; page handles both JSON and CSV. Storing normalized JSON array would enhance consistency. | Documentation / Code Hygiene |
| **PS-03** | `AdminPlanModal` | Trivial | Hardcoded default price (₹999) & duration (30) | When creating a new plan, form initializes with hardcoded values rather than blank placeholders. | UX Observation |
| **PS-04** | `AdminPlansPage` | Low | Single global currency indicator (`INR`) | All prices format using `en-IN` and currency `INR`. Platform is currently single-region (India); multi-currency would require internationalization. | By Design (Domestic SaaS) |
| **PS-05** | `AdminLayout` | Informational | Nav label is "Plans & Subscriptions", but page is Plans Catalog | Admin users expecting a global list of all subscribed bakeries must navigate to `/admin/shops` or `/admin/payments`. | UI Nomenclature Clarity |

---

## 10. Recommendations & Action Plan

### 10.1 Recommended Code Enhancements (Post-Audit Approval)

1. **Add `@Transactional` to `AdminSubscriptionPlanController.reorderPlans`**:
   Ensure atomic execution so that reordering either completely succeeds or rolls back in full:
   ```java
   @Transactional
   @PutMapping("/reorder")
   public ResponseEntity<Void> reorderPlans(@RequestBody List<Long> planIds) { ... }
   ```

2. **Add Focused Unit / Integration Test for Admin Plan CRUD**:
   Create `AdminSubscriptionPlanControllerTest.java` verifying:
   - Admin authorization enforcement (`ROLE_ADMIN` passes, `ROLE_SHOP_OWNER` receives 403).
   - Validation failure when plan price is negative or name is empty.
   - Successful display order updating.

3. **Consider Optional "Active Subscriptions" Quick-View Link**:
   In `/admin/plans`, add an informational summary card or link:
   *"Viewing SaaS Plan Definitions. To view active bakery subscribers, visit Bakery Management filtered by Active, or Payments Ledger for subscription revenue."*

---

## 11. Conclusion

The CakeStore Super Admin **Plans & Subscriptions** subsystem is robust, secure, and properly architected. The backend rigorously adheres to server-side authority, preventing price manipulation and securing billing workflows with HMAC signature checks and pessimistic database locks. Subscription renewals accurately respect bakery operational statuses and administrative moderation, and plan management enforces referential integrity by omitting destructive deletions in favor of status toggling.

The system is fully operational and approved for ongoing production usage.
