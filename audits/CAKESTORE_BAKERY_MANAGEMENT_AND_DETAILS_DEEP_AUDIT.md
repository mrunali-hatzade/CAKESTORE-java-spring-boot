# CakeStore — Bakery Management & Bakery Details Deep Technical Audit Report

**Date of Execution**: October 15, 2026  
**Audit Protocol**: Strictly READ-ONLY Technical Audit & Live Runtime Verification  
**Environment**: Local Development (PostgreSQL 15, Spring Boot 3.3.x on port 8080, Next.js 14.2.5 on port 3000)  
**Deliverable Document**: `CAKESTORE_BAKERY_MANAGEMENT_AND_DETAILS_DEEP_AUDIT.md`  

---

## 1. Executive Summary

A comprehensive, strictly read-only technical audit of the CakeStore Super Admin Dashboard **Bakery Management directory** (`/admin/shops`) and **Individual Bakery Details page** (`/admin/shops/[id]`) was conducted. The audit inspected frontend React/Next.js components, TypeScript types, Spring Boot REST controllers, service-layer orchestration, Spring Security filters, Hibernate entity mappings, native PostgreSQL queries, and Flyway database migrations (up to V47).

### Overall Verdict: **CONDITIONALLY READY (WITH HIGH-PRIORITY DEFECTS IDENTIFIED)**
- **Working Foundation**: Core directory rendering, pagination, case-insensitive search, role-based authorization (401 unauthenticated, 403 non-admin, 200 admin), conservative storefront live availability computation, administrative marketplace restrictions, and financial metric separation (SaaS revenue vs. bakery retail GMV) are fully functional, verified by live runtime HTTP probes, database reconciliation, and 100% automated test passes (65/65 frontend tests, 44/44 backend governance/operational tests).
- **Critical & High Defects Found**:
  1. **Soft-Deleted Bakery Inspection Failure (Defect BM-01 - High)**: Navigating to a soft-deleted bakery detail page (`/admin/shops/[id]`) fails with `HTTP 400 Bad Request` ("Shop not found with id: X") because `AdminDashboardService.getShopDetails` executes `shopRepository.findById(shopId)`, which is intercepted and blocked by Hibernate `@SQLRestriction("is_deleted=false")`. The frontend archive inspection view is unreachable at runtime.
  2. **Directory Suspend Actions Fail with HTTP 400 (Defect BM-02 - High)**: In `/admin/shops`, both the row action "Suspend" and the "Bulk Suspend" control call `updateShopStatus(shopId, 'SUSPENDED')` without opening `AdminSuspensionModal` or capturing a reason. The backend strictly requires a mandatory reason, throwing `IllegalArgumentException` and failing with HTTP 400.
  3. **Directory Reject Actions Are Broken No-Ops (Defect BM-03 - High)**: In `/admin/shops`, row action "Reject" and "Bulk Reject" send `{ status: "REJECTED" }` to `/status`. Rejection is a KYC document action on `/verification` requiring a reason. The `ShopStatus` enum has no `REJECTED` value; the backend silently ignores the request, returning HTTP 200 while leaving the shop untouched.
  4. **Detail Page "Mark Under Review" Fails Silently (Defect BM-04 - Medium)**: Clicking "Mark Under Review" sends `status: "PENDING"` to `/status`. The backend service has no branch for `"PENDING"` in `updateShopStatus`, returning HTTP 200 with no database changes.
  5. **Invalid Shop ID Causes Permanent Loading Freeze (Defect BM-05 - Medium)**: Navigating to `/admin/shops/invalid` or non-numeric IDs causes `shopId` to evaluate to `NaN`; `loadShop` exits without resetting `isLoading`, leaving the page permanently stuck in `<LoadingState>`.
  6. **Static Document Security Exposure (Risk BM-01 - High Security)**: While `/api/admin/documents/{id}/view` requires `ROLE_ADMIN`, local `StorageService` returns raw static URLs (`/uploads/documents/...`), which are served publicly without authentication by Spring Web MVC.

---

## 2. Scope, Environment, and Limitations

### 2.1 Scope of Audit
1. **Directory Page**: `frontend_v2/app/admin/shops/page.tsx`
2. **Detail Page**: `frontend_v2/app/admin/shops/[id]/page.tsx`
3. **Subcomponents & Modals**:
   - `frontend_v2/components/admin/BakeryStatusBadge.tsx`
   - `frontend_v2/components/admin/shops/AdminSuspensionModal.tsx`
   - `frontend_v2/components/admin/shops/AdminKycRejectionModal.tsx`
   - `frontend_v2/components/admin/shops/AdminMarketplaceRestrictionModal.tsx`
   - `frontend_v2/components/ui/ConfirmDialog.tsx`
4. **API Clients & Types**:
   - `frontend_v2/lib/api/admin.ts`
   - `frontend_v2/types/admin.ts`, `types/shop.ts`
5. **Backend Controllers, Services, & Repositories**:
   - `AdminDashboardController.java` (`/api/admin/shops`, `/api/admin/shops/counts`, `/api/admin/shops/{id}`, `/status`, `/marketplace-restriction`, `/verification`)
   - `DocumentAccessController.java` (`/api/admin/documents/{id}/view`)
   - `AdminDashboardService.java`, `ShopStatusManager.java`
   - `ShopRepository.java`, `SubscriptionRepository.java`, `PaymentRepository.java`, `OrderRepository.java`, `BusinessDocumentRepository.java`
   - Database entities: `Shop.java`, `BusinessDocument.java`, `Subscription.java`, `Payment.java`, `Order.java`
   - Flyway migrations: `V47__add_marketplace_restriction_and_operational_status.sql`

### 2.2 Environment
- **PostgreSQL 15**: Running on default port 5432, database `cake_platform`.
- **Spring Boot 3.3.x**: Running on `http://localhost:8080`.
- **Next.js 14.2.5**: Running on `http://localhost:3000`.
- **Operating Timezone**: `Asia/Kolkata` (UTC+05:30).

### 2.3 Limitations & Read-Only Constraints
- In accordance with the mandatory read-only protocol, zero source code, database records, Flyway migrations, or configuration files were modified.
- Mutating endpoints (`PATCH /status`, `PATCH /marketplace-restriction`, `PATCH /verification`) were verified via source inspection, automated isolated mock/slice tests, and non-destructive negative probe requests. No live bakery was suspended or rejected in the database.

---

## 3. Previous Audit Findings & What Was Reverified

| Prior Finding / Topic | Prior Status | Current Audit Re-Verification | Observed Reality |
| :--- | :--- | :--- | :--- |
| **Directory Search & Pagination** | Reported Working | Live HTTP GET & unit tests | **Verified**. Case-insensitive, handles whitespace, resets page on query change. |
| **Storefront Availability Separation** | Phase 1 & 2 Refactor | 13 unit tests & source inspection | **Verified**. 5-flag predicate in `computeStorefrontAvailability` correctly separates account status from storefront live state. |
| **Marketplace Restriction** | Step 5.3 Implementation | 8 unit tests & backend inspection | **Verified on Detail Page**. Reason validation (<=500 chars), owner notification, audit log. |
| **Soft-Deleted Inspection** | Reported Preserved | Live HTTP GET to `/api/admin/shops/2222` | **FAILED (CONFIRMED DEFECT)**. Directory lists deleted shops, but detail page fails with HTTP 400 due to Hibernate `@SQLRestriction`. |
| **Admin Authorization** | Reported Secure | Live curl probe with unauthenticated & owner token | **Verified**. 401 unauthenticated, 403 owner, 200 admin. |

---

## 4. Complete Frontend File and Component Inventory

### 4.1 Directory Page (`/admin/shops`)
- **File**: `frontend_v2/app/admin/shops/page.tsx` (610 lines, 25.4 KB)
- **Interactive Controls & Sections**:
  1. *Header Section*: Title ("Bakery Directory & Moderation") and subtitle.
  2. *Status Filter Tabs*: `ALL`, `PENDING`, `ACTIVE`, `SUSPENDED`, `DELETED`. Dynamic count badges from `getShopCounts()`.
  3. *Search Input*: Debounced text input (500ms delay) with icon and clear action.
  4. *Bulk Selection Header*: "Select All" checkbox in table header.
  5. *Bulk Actions Bar*: Rendered when `>= 1` shop is selected (Bulk Approve, Bulk Suspend, Bulk Reject).
  6. *Bulk Confirmation Modal*: Confirmation dialog (`Modal`) for executing batch operations.
  7. *Bakeries Table*:
     - Column 1: Multi-select checkbox.
     - Column 2: Initial avatar, Business Name (link to `/admin/shops/[id]`), and Tenant ID (`#id`).
     - Column 3: Owner Name & Owner Email.
     - Column 4: Registration Date formatted (`en-IN`).
     - Column 5: Storefront availability badge (`BakeryStatusBadge`).
     - Column 6: Moderation actions (View/Preview Storefront button, Manage / Inspect Archive button, Approve, Suspend, Reject).
  8. *Pagination Bar*: Current page indicator (`Showing page X of Y (Z total shops)`), Previous/Next buttons.
  9. *Empty State*: `<EmptyState>` with "Clear Filters" button when query/filter has zero matches.
  10. *Loading State*: Root-level `<LoadingState>` spinner.

### 4.2 Bakery Details Page (`/admin/shops/[id]`)
- **File**: `frontend_v2/app/admin/shops/[id]/page.tsx` (1042 lines, 46.3 KB)
- **Interactive Controls & Sections**:
  1. *Sticky Navigation Bar*: "Back to Bakery Directory" link, Storefront View/Preview link button.
  2. *Soft-Deleted Account Banner*: Black/rose banner (`Ban` icon) when `isDeleted === true || status === 'DELETED'`.
  3. *Marketplace Restriction Banner*: Amber alert banner displaying `marketplaceRestrictionReason` with "Lift Restriction" button.
  4. *Main Header Card*:
     - Initial avatar, Business Name, Status Badge, Verification Badge, Marketplace Restricted Badge, Pure Veg Badge.
     - Tenant ID, Registration Date, "Bakery Paused by Owner" indicator.
     - Action Controls: "Restrict Marketplace" / "Lift Marketplace Restriction", "Activate Storefront", "Suspend Storefront", "Mark Under Review".
  5. *Metrics Row (4 Cards)*:
     - Card 1: Catalog Products (`details.totalProducts`), links to `/shop/[id]`.
     - Card 2: Total Orders (`details.totalOrders`).
     - Card 3: FSSAI Status (License number or "Not Submitted").
     - Card 4: Active Plan (`subscriptions[0]?.planName` & status).
  6. *Left Column — Business & Verification Details*:
     - About & Bio description.
     - Phone (clickable `tel:`) and Email (clickable `mailto:`).
     - Address, City, State, Pincode.
     - FSSAI License Number compliance block.
     - Submitted Verification Documents list (`BusinessDocumentItem[]`) with status badge and secure document view button (`handleViewDocument`).
     - Administrative KYC Actions: "Verify Bakery" (`handleVerificationReview('APPROVE')`) and "Reject Application" (`setIsRejectKycModalOpen(true)`).
  7. *Right Column — Performance & Billing*:
     - Bakery Performance Card: Sales GMV, This Month, This Week, Total Orders, Completed Orders, Avg Order Value.
     - Subscription Plan Card: Active plan name, price, start date, end date, expiration countdown badge, past billing cycles list.
     - Subscription Billing History Card: List of B2B invoice payments (`payments[]`), status badge, amount, currency, payment ID, order ID, payment date.
     - Security & Audit Trail Card: Chronological list of `ActivityLog` records (`SHOP`, `SUBSCRIPTION`, `PAYMENT` entity types).
  8. *Administrative Action Modals*:
     - `AdminSuspensionModal`: Mandatory suspension reason capture.
     - `AdminKycRejectionModal`: Mandatory rejection reason capture.
     - `AdminMarketplaceRestrictionModal`: Mandatory restriction reason capture (<= 500 chars).
     - `ConfirmDialog`: Confirmation dialog for lifting marketplace restrictions.

---

## 5. Bakery Management Directory — Functional Audit

### 5.1 Data and Table Correctness
- **Backend Driven**: Data is retrieved from `GET /api/admin/shops` with parameters `page`, `size`, `search`, and `status`. Zero hardcoded data arrays.
- **Field Rendering**: Correctly renders `shopId`, `businessName`, `ownerName`, `ownerEmail`, `registeredAt`, and `shopStatus`. Missing fields render em-dash (`—`).
- **Pagination Sync**: Changing pages requests `page=N` correctly; backend caps `size` at 50 (`AdminDashboardController.java:52`).
- **Loading State Unmounting Issue (Risk BM-02)**: Because `if (isLoading) return <LoadingState />` is placed at line 213 before the controls bar, every debounced search and page change completely unmounts the search input, causing loss of input focus.

### 5.2 Search Behavior
- **Case-Insensitivity**: Tested live with `search=Sweet` and `search=sweet`. Both return identical results (`totalElements: 13`).
- **Whitespace Handling**: Tested live with `search=   `. Query is trimmed on backend to `""`, returning all 66 non-deleted shops safely.
- **Non-existent Queries**: Tested live with `search=XYZ_NONEXISTENT_999`. Correctly returns `totalElements: 0` and renders the empty state.
- **Combined Search & Status**: Tested live:
  - `status=ACTIVE&search=sweet` -> 13 shops.
  - `status=PENDING&search=sweet` -> 0 shops.
  - `status=DELETED&search=sweet` -> 227 shops.

### 5.3 Filter Tabs & Tab Counts
- **Counts Endpoint**: `GET /api/admin/shops/counts` returns `{ "total": 66, "active": 65, "pending": 1, "suspended": 0 }`.
- **Deleted Tab Count Omission (Risk BM-03)**: When viewing `ALL`, `PENDING`, `ACTIVE`, or `SUSPENDED`, the `Deleted` tab label shows no count (`Deleted`). Only when clicked does it read `Deleted (3717)` from `totalElements`.
- **Inactive Tab Absence**: There is no tab for `INACTIVE` bakeries, even though `ShopStatus.INACTIVE` is a valid lifecycle status.

### 5.4 Directory Row Actions
- **View / Preview Storefront**:
  - Dynamically computes availability via `computeStorefrontAvailability`.
  - When store is live (`ACTIVE`, active sub, owner-enabled, not restricted, not deleted): button label is "View Storefront", text indigo, opens `/shop/[id]` in new tab.
  - When store is offline: button label is "Preview Storefront", text slate, tooltip warns admin that storefront will show offline state.
- **Manage / Inspect Archive**: Links to `/admin/shops/[id]`. Correctly shows "Inspect Archive" when `shopStatus === 'DELETED'`.
- **Row "Approve" Action**: Calls `updateShopStatus(shopId, 'ACTIVE')`. Works for pending shops.
- **Row "Suspend" Action (Defect BM-02)**: Calls `updateShopStatus(shopId, 'SUSPENDED')` without reason. Fails with HTTP 400.
- **Row "Reject" Action (Defect BM-03)**: Calls `updateShopStatus(shopId, 'REJECTED')`. Silently ignored by backend.

---

## 6. Bakery Details Page — Deep Functional Audit

### 6.1 Data Integrity
- **Profile & Business Data**: Retrieves `shop` object from `AdminDashboardService.getShopDetails`. Correctly binds business name, description, address, city, state, pincode, phone, email, FSSAI registration number.
- **Owner Information Limitation**: In `Shop.java`, `owner` is marked `@JsonIgnore`. Consequently, `details.shop.owner` is `null` in the JSON response. The detail page displays `shop.phone` and `shop.email`, but does not display the owner's personal account name or login email.
- **Subscriptions & Billing**: Populated via `subscriptionRepository.findByShopId(shopId)`. Displays plan name, pricing, start/end dates, and expiry countdown.
- **B2B Billing History**: Populated via `paymentRepository.findSubscriptionPaymentsByShopId(shopId)`. Displays payments with Razorpay provider IDs, dates, and amounts.
- **Activity Logs**: Populated via `activityLogRepository.findByShopIdAndEntityTypeInOrderByTimestampDesc(shopId, ['SHOP', 'SUBSCRIPTION', 'PAYMENT'])`.
- **Verification Documents**: Populated via `businessDocumentRepository.findByShopId(shopId)`.

### 6.2 Financial & Metric Integrity
- **Bakery Sales GMV**: Evaluated via `orderRepository.sumRevenueByShopId(shopId)`. Strict query conditions:
  - `o.orderStatus != 'CANCELLED'`
  - `(o.paymentStatus IN ('PAID', 'COMPLETED') OR o.orderStatus IN ('COMPLETED', 'DELIVERED'))`
  - `o.paymentStatus NOT IN ('REFUNDED', 'FAILED')`
  - This guarantees retail GMV reflects realized customer cake orders with 0% platform commission.
- **SaaS Subscription Revenue**: Stored in `payments[]`, representing B2B platform subscription revenue. Completely separated from retail orders.

### 6.3 Document Access & Verification Workflow
- **Verification Review**: Admin can approve (`APPROVE`) or reject (`REJECT`) with mandatory reason. Updates `shop.verificationStatus` and all associated `BusinessDocument` records in a single `@Transactional` boundary, generates an `ActivityLog` entry (`KYC_VERIFIED` or `KYC_REJECTED`), and dispatches an in-app `Notification`.
- **Document Viewing**: Clicking the view document button calls `getAdminDocumentViewUrl(doc.id)` (`/api/admin/documents/{id}/view?redirect=false`). Endpoint verifies `ROLE_ADMIN` and returns `{ url: ... }`.
- **Static Storage Security Flaw (Risk BM-01)**: The returned URL points to `/uploads/documents/{uuid}.jpg`, which is served statically without authorization.

### 6.4 Administrative Marketplace Restriction
- Implemented in Step 5.3 via `V47` migration and `updateMarketplaceRestriction`:
  - Enforces mandatory reason (non-blank, <= 500 characters).
  - Persists `isMarketplaceRestricted = true` and `marketplaceRestrictionReason`.
  - Creates `MARKETPLACE_RESTRICTION_APPLIED` activity log with actor user ID.
  - Dispatches `ADMIN_MESSAGE` notification to owner.
  - Evicts storefront caches (`evictShopDetails`, `evictShopProducts`).
  - Owner dashboard remains accessible for order fulfillment; storefront is hidden from customer discovery.

---

## 7. Frontend–Backend–Database Integration Matrix

| UI Action / View | Frontend API Client | HTTP Route & Method | Backend Controller & Service Method | DB Entity & Query / SQL | Verified Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Fetch Directory** | `getAllShops(p, s, q, status)` | `GET /api/admin/shops` | `AdminDashboardController.getAllShops` -> `AdminDashboardService.getAllShops` | `ShopRepository.searchAndFilterAllShops` (JPA) / `searchAndFilterDeletedShopsProjection` (Native) | **PASS** | Live verified. Paginated, search-filtered. |
| **Tab Counts** | `getShopCounts()` | `GET /api/admin/shops/counts` | `AdminDashboardController.getShopCounts` -> `AdminDashboardService.getShopStatusCounts` | `shopRepository.count()`, `countByStatus(ACTIVE, PENDING, SUSPENDED)` | **PASS** | Lightweight 4-query endpoint. |
| **Fetch Shop Details** | `getShopDetails(shopId)` | `GET /api/admin/shops/{id}` | `AdminDashboardController.getShopDetails` -> `AdminDashboardService.getShopDetails` | `shopRepository.findById(shopId)`, `subscriptionRepository`, `paymentRepository`, etc. | **PARTIAL** | **FAILS for soft-deleted shops** (HTTP 400). Passes for active/pending. |
| **Detail Suspend** | `updateShopStatus(id, 'SUSPENDED', reason)` | `PATCH /api/admin/shops/{id}/status` | `AdminDashboardController.updateShopStatus` -> `AdminDashboardService.updateShopStatus` | `ShopStatusManager.suspendShop`, `activityLogger`, `evictShopDetails` | **PASS** | Enforces mandatory reason. |
| **Directory Suspend** | `updateShopStatus(id, 'SUSPENDED')` | `PATCH /api/admin/shops/{id}/status` | Same as above | Fails in service validation | **FAIL** | **Defect BM-02**: No reason sent, fails HTTP 400. |
| **Detail Reject KYC**| `updateShopVerification(id, 'REJECT', reason)` | `PATCH /api/admin/shops/{id}/verification` | `AdminDashboardController.reviewShopVerification` -> `AdminDashboardService.reviewShopVerification` | `shop.setVerificationStatus(REJECTED)`, `businessDocumentRepository.saveAll`, `activityLogger` | **PASS** | Updates docs, logs, dispatches notification. |
| **Directory Reject** | `updateShopStatus(id, 'REJECTED')` | `PATCH /api/admin/shops/{id}/status` | `AdminDashboardController.updateShopStatus` -> `AdminDashboardService.updateShopStatus` | No-op; status ignored | **FAIL** | **Defect BM-03**: Targets `/status` with invalid enum. |
| **Apply Restriction**| `updateMarketplaceRestriction(id, true, reason)` | `PATCH /api/admin/shops/{id}/marketplace-restriction` | `AdminDashboardController.updateMarketplaceRestriction` -> `AdminDashboardService.updateMarketplaceRestriction` | `shops.is_marketplace_restricted = true`, `activityLogger`, notification, cache eviction | **PASS** | Fully integrated in V47. |
| **Lift Restriction** | `updateMarketplaceRestriction(id, false)` | `PATCH /api/admin/shops/{id}/marketplace-restriction` | `AdminDashboardController.updateMarketplaceRestriction` -> `AdminDashboardService.updateMarketplaceRestriction` | `shops.is_marketplace_restricted = false`, `activityLogger`, notification, cache eviction | **PASS** | Fully integrated in V47. |
| **View Document** | `getAdminDocumentViewUrl(id)` | `GET /api/admin/documents/{id}/view?redirect=false` | `DocumentAccessController.viewDocumentAdmin` | `businessDocumentRepository.findById(id)` -> `storageService.generateSignedUrl` | **PASS / RISK** | Endpoint secured, but returned URL is public static. |

---

## 8. Database Relationships, Queries, and Data Integrity

### 8.1 Entity Model & Soft Deletion
- **Shop Entity (`Shop.java`)**:
  - Annotated with `@SQLDelete(sql = "UPDATE shops SET is_deleted = true WHERE id=?")`.
  - Annotated with `@SQLRestriction("is_deleted=false")`.
  - Consequence: All standard Spring Data JPA queries (`findById`, `findAll`, `count()`) automatically inject `AND is_deleted=false`.
  - This guarantees active directories and KPI cards never count or display deleted bakeries.
  - **The Defect Consequence**: Because `shopRepository.findById(shopId)` is used in `getShopDetails`, soft-deleted shops cannot be loaded by ID.

### 8.2 Native Query Projections for Deleted Shops
- `ShopRepository.searchAndFilterDeletedShopsProjection`:
  ```sql
  SELECT s.id as shopId, s.business_name as businessName, u.full_name as ownerName, u.email as ownerEmail, s.status as shopStatus, s.created_at as registeredAt
  FROM shops s LEFT JOIN users u ON s.owner_id = u.id
  WHERE s.is_deleted = true AND (:search IS NULL OR ...)
  ```
  This native query correctly bypasses Hibernate `@SQLRestriction` to display deleted shops in `/admin/shops?status=DELETED`.

### 8.3 Data Scoping & Multi-Tenancy Isolation
- In `AdminDashboardService.getShopDetails(shopId)`:
  - Subscriptions: `subscriptionRepository.findByShopId(shopId)` -> strictly shop-scoped.
  - Payments: `paymentRepository.findSubscriptionPaymentsByShopId(shopId)` -> strictly shop-scoped.
  - Documents: `businessDocumentRepository.findByShopId(shopId)` -> strictly shop-scoped.
  - Products: `productRepository.countByShopId(shopId)` -> strictly shop-scoped.
  - Orders: `orderRepository.countByShopId(shopId)` -> strictly shop-scoped.
  - Activity Logs: `activityLogRepository.findByShopIdAndEntityTypeInOrderByTimestampDesc(shopId, ...)` -> strictly shop-scoped.
  - **Verdict**: Cross-shop data leakage does not exist. All sub-queries filter strictly by `shopId`.

---

## 9. Security, Authorization, and Multi-Tenancy

### 9.1 Role-Based Access Control (RBAC) Verification
A live HTTP test suite was executed against the running Spring Boot server on port 8080:

| Test Case | Route & Method | Credentials Used | Expected HTTP | Actual HTTP | Verdict |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **RBAC-01** | `GET /api/admin/shops` | Unauthenticated | 401 | **401** | **PASS** |
| **RBAC-02** | `GET /api/admin/shops` | `ROLE_SHOP_OWNER` (`owner@example.com`) | 403 | **403** | **PASS** |
| **RBAC-03** | `GET /api/admin/shops` | `ROLE_ADMIN` (`admin@cakeplatform.com`) | 200 | **200** | **PASS** |
| **RBAC-04** | `GET /api/admin/shops/17` | Unauthenticated | 401 | **401** | **PASS** |
| **RBAC-05** | `GET /api/admin/shops/17` | `ROLE_SHOP_OWNER` (`owner@example.com`) | 403 | **403** | **PASS** |
| **RBAC-06** | `GET /api/admin/shops/17` | `ROLE_ADMIN` (`admin@cakeplatform.com`) | 200 | **200** | **PASS** |
| **RBAC-07** | `GET /api/admin/documents/4/view` | Unauthenticated | 401 | **401** | **PASS** |
| **RBAC-08** | `GET /api/admin/documents/4/view` | `ROLE_SHOP_OWNER` (`owner@example.com`) | 403 | **403** | **PASS** |
| **RBAC-09** | `GET /api/admin/documents/4/view` | `ROLE_ADMIN` (`admin@cakeplatform.com`) | 200 | **200** | **PASS** |

### 9.2 Public Static File Upload Exposure (Risk BM-01)
- Probed unauthenticated access directly to:
  `http://localhost:8080/uploads/documents/2eab4629-13ed-4514-8e35-70f42fe49ff4.jpg`
- **Result**: `HTTP 200 OK` returning full JPEG binary.
- **Finding**: Static file handler bypasses Spring Security filters. Document URLs are unguessable UUIDs, but anyone possessing the URL can access private FSSAI documents without authentication.

---

## 10. Automated Test and Build Results

### 10.1 Frontend Automated Tests
Executed: `node --test frontend_v2/__tests__/*.test.mjs`
- **Total Test Files**: 8
- **Total Tests Executed**: 65
- **Passed**: 65
- **Failed**: 0
- **Duration**: 820ms
- **Key Suites Verified**:
  - `adminMarketplaceRestrictionAndDeletedShops.test.mjs`: 8/8 PASS (Restriction reason validation, payload construction, soft-deleted detection, control disabling, historical retention).
  - `bakeryStatusLabelsPhase2.test.mjs`: 13/13 PASS (Store live vs. store offline logic, subscription status mapping, owner vacation mode, restriction badge).
  - `adminMetricsPresentation.test.mjs`: 10/10 PASS (Total bakeries separation, awaiting payment eligibility).

### 10.2 Frontend Typecheck
Executed: `npx tsc --noEmit`
- **Exit Code**: 0
- **Errors**: 0 (Full TypeScript strict compilation passed without warnings).

### 10.3 Backend Automated Tests
Executed via Maven:
1. `mvn test -Dtest=Day3AdminGovernanceTest`
   - **Tests Run**: 6, Failures: 0, Errors: 0, Skipped: 0 (BUILD SUCCESS)
   - Verified: User metrics with soft-deleted users, shop metrics with soft-deleted shops, subscription metrics excluding active intersections, admin deleted shops query with DELETED status, active shop operational flags.
2. `mvn test -Dtest=OperationalAccessModelTest`
   - **Tests Run**: 38, Failures: 0, Errors: 0, Skipped: 0 (BUILD SUCCESS)
   - Verified: ShopAccessValidator operational gating, owner-disabled vacation mode, marketplace restriction storefront isolation, subscription expiration scheduler transitions.

---

## 11. Detailed Finding Classification

| Finding ID | Classification | Severity | Affected Component / File | Summary Description |
| :--- | :--- | :--- | :--- | :--- |
| **BM-01** | **CONFIRMED DEFECT** | **HIGH** | `AdminDashboardService.java:354`, `app/admin/shops/[id]/page.tsx` | Soft-deleted shop inspection fails with HTTP 400 because `shopRepository.findById(shopId)` is blocked by Hibernate `@SQLRestriction("is_deleted=false")`. |
| **BM-02** | **CONFIRMED DEFECT** | **HIGH** | `app/admin/shops/page.tsx:185, 322, 521` | Row action "Suspend" and "Bulk Suspend" on directory invoke status update without mandatory reason, causing backend `IllegalArgumentException` and HTTP 400 error. |
| **BM-03** | **CONFIRMED DEFECT** | **HIGH** | `app/admin/shops/page.tsx:185, 331, 533` | Row action "Reject" and "Bulk Reject" send `{ status: "REJECTED" }` to `/status`. Rejection is a KYC document action on `/verification`; backend silently ignores request. |
| **BM-04** | **CONFIRMED DEFECT** | **MEDIUM** | `app/admin/shops/[id]/page.tsx:541`, `AdminDashboardService.java:481` | Detail page button "Mark Under Review" sends `status: "PENDING"` to `/status`. Backend has no branch for `"PENDING"`, returning HTTP 200 without persisting change. |
| **BM-05** | **CONFIRMED DEFECT** | **MEDIUM** | `app/admin/shops/[id]/page.tsx:76` | Non-numeric or invalid shop ID evaluates to `NaN`; `loadShop` exits without setting `isLoading(false)`, causing permanent loading spinner freeze. |
| **BM-06** | **RISK** | **HIGH** | `StorageService.java:11`, `WebConfig.java` | Local storage returns direct static file URLs for compliance documents, allowing unauthenticated public access to FSSAI certificates. |
| **BM-07** | **RISK** | **MEDIUM** | `app/admin/shops/page.tsx:213` | Full-page loading state at root level completely unmounts table, search input, and controls during debounced typing, destroying user focus. |
| **BM-08** | **RISK** | **LOW** | `app/admin/shops/page.tsx:32`, `AdminDashboardService.java:102` | Tab counts and filter tabs omit `INACTIVE` status; `Deleted` tab count is omitted until clicked. |
| **BM-09** | **INCOMPLETE** | **MEDIUM** | `app/admin/shops/page.tsx:152-167` | Bulk actions execute via concurrent individual PATCH requests (`Promise.all`) without atomic transactional semantics, and lack reason input dialogs. |
| **BM-10** | **GOOD / VERIFIED** | **N/A** | `AdminDashboardController.java:21` | Multi-tier RBAC authorization verified live (401 unauthenticated, 403 non-admin, 200 admin). |
| **BM-11** | **GOOD / VERIFIED** | **N/A** | `ShopRepository.java:36` | Case-insensitive multi-field search (business name, owner name, owner email) verified live. |
| **BM-12** | **GOOD / VERIFIED** | **N/A** | `BakeryStatusBadge.tsx:22` | Storefront availability computation accurately evaluates live order readiness vs. offline states. |
| **BM-13** | **GOOD / VERIFIED** | **N/A** | `AdminMarketplaceRestrictionModal.tsx` | Administrative marketplace restriction applies and lifts cleanly with mandatory reason and owner notification. |
| **BM-14** | **GOOD / VERIFIED** | **N/A** | `OrderRepository.java:73`, `PaymentRepository.java:44` | Authoritative financial model separation: SaaS subscriptions vs. 0%-commission bakery GMV verified. |

---

## 12. Frontend Defect Summary

The following existing issues in the frontend components directly impact functionality, usability, or correctness:

1. **Missing Suspension Modal on Directory Table (`app/admin/shops/page.tsx:521`)**: Clicking "Suspend" on a table row immediately fires an API request without prompting for the required suspension reason. It must open `AdminSuspensionModal` (as the detail page does).
2. **Incorrect Rejection Wiring on Directory Table (`app/admin/shops/page.tsx:533`)**: Clicking "Reject" on a pending bakery sends a status change instead of opening `AdminKycRejectionModal` and calling `updateShopVerification(shopId, 'REJECT', reason)`.
3. **Broken Bulk Suspension & Rejection (`app/admin/shops/page.tsx:322, 331`)**: Bulk actions confirm modal does not capture reasons, causing Bulk Suspend to fail with HTTP 400 and Bulk Reject to be ignored.
4. **Detail Page "Mark Under Review" Disconnected (`app/admin/shops/[id]/page.tsx:541`)**: The button attempts to set `ShopStatus.PENDING` on `/status`, which the backend does not process.
5. **Detail Page NaN Loading Lockout (`app/admin/shops/[id]/page.tsx:76`)**: If `params.id` is not a valid number, the page hangs forever in `<LoadingState>`.
6. **Focus-Stealing Root `<LoadingState>` (`app/admin/shops/page.tsx:213`)**: The search input is unmounted whenever `isLoading` is true, resetting cursor position on every 500ms debounce.
7. **Deleted Tab Count Badge Missing (`app/admin/shops/page.tsx:286`)**: Unlike `All`, `Pending Approval`, `Active`, and `Suspended`, the `Deleted` tab count is absent until the tab is clicked.

---

## 13. Final Readiness Assessment

### Current Production Readiness: **CONDITIONALLY READY (REPAIRS REQUIRED BEFORE PRODUCTION USE)**

| Subsystem | Readiness Status | Confidence | Primary Blocking Factor |
| :--- | :---: | :---: | :--- |
| **Bakery Directory Loading & Pagination** | **READY** | High | Works reliably, pagination and sorting consistent. |
| **Directory Search & Filter Tabs** | **READY** | High | Search is fast, case-insensitive, and correctly scoped. |
| **Directory Moderation Controls** | **NOT READY** | High | Row Suspend fails (no reason); Row Reject fails silently (wrong endpoint). |
| **Bakery Detail Data Rendering** | **READY** | High | Live active/pending shops render complete profiles, plans, and metrics. |
| **Soft-Deleted Bakery Inspection** | **NOT READY** | High | Detail page fails with HTTP 400 due to Hibernate `@SQLRestriction`. |
| **Administrative Marketplace Restriction** | **READY** | High | Modal, reason validation, audit log, and cache eviction work as specified. |
| **Document Access & KYC Verification** | **CONDITIONALLY READY** | Medium | Detail page verification review works, but local document URLs are statically exposed. |
| **Financial & Ledger Isolation** | **READY** | High | Strict separation between SaaS subscription billings and bakery order GMV. |
| **Security & RBAC Enforcement** | **READY** | High | Server-side `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` strictly enforced. |

### Working Tree & Environment Integrity Statement
Throughout this entire technical audit:
- The git working tree, source code files, application configuration, test suites, database data, database schema, Flyway migrations, and git commit history **remained 100% unchanged**.
- Zero state-mutating actions were executed against the database.
- The audit was conducted strictly via read-only source analysis, non-mutating automated unit tests, and safe HTTP GET and negative probe requests.
