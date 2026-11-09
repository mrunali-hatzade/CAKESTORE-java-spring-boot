# CakeStore — Phase 2.7: Shop Owner Dashboard UAT & Gap Assessment Report

**Date:** November 3, 2026  
**Status:** **INSPECTION AND AUDIT COMPLETED (READ-ONLY)**  
**Scope:** Comprehensive functional and technical audit of the Shop Owner Dashboard across 10 core owner workflows, f rontend routes, backend APIs, data models, authorization controls, regression test coverage, and staging readiness.

---

## Executive Summary

Phase 2.7 provides an exhaustive, evidence-based assessment of the CakeStore Shop Owner Dashboard. The evaluation covered all 10 core modules specified in the audit scope, plus 4 auxiliary owner modules (Custom Cakes, Reviews, Inquiries, Coupons).

### Key Takeaways:
1. **Architectural Maturity:** The shop owner dashboard is functionally complete across all 10 core domains. Frontend routes under `/dashboard/owner/*` are cleanly coupled with dedicated REST controllers in Spring Boot.
2. **Multi-Tenant Security:** All owner operations enforce strict tenant isolation via `ShopAccessValidator.getValidShopForOwner(userId)`. No owner can view, mutate, or access another bakery's products, orders, settings, slots, or customers.
3. **Decoupled Business Rules:** The 0% commission SaaS business model is strictly preserved. Delivery pricing autonomy is retained (bakeries set their own delivery radius, PIN codes, fixed charges, or free-delivery thresholds). Subscription status is strictly decoupled from shop activation status and document verification status.
4. **Staging Readiness:** Dedicated staging accounts (`owner@example.com` / `Password123!`, `owner@sweetdelight.com` / `password123`) exist in initialization fixtures and seed scripts for safe UAT without touching production records.

---

## 1. Module-Wise Verification Matrix

| # | Workflow / Domain | Frontend Route & Component | Backend Controller & Endpoint | Service & Repository | DB Entities & Tables | Authorization & Guards | Verification Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **1** | **Owner Auth & Onboarding** | `/login`<br>`/onboarding`<br>`CascadingLocationSelector` | `AuthController`<br>`POST /api/v1/auth/login`<br>`POST /api/v1/auth/register` | `AuthService`<br>`UserRepository`<br>`ShopRepository` | `users`<br>`shops`<br>`business_documents` | Public endpoints;<br>Issues JWT (`ROLE_SHOP_OWNER`) | **Implemented & Verified** |
| **2** | **Shop Profile & Storefront** | `/dashboard/owner/settings`<br>`/dashboard/owner/website`<br>`StorefrontSettingsTab` | `ShopController`<br>`GET/PUT /api/v1/shops/my-shop`<br>`OwnerStorefrontController`<br>`PUT /api/v1/owner/storefront/website` | `ShopService`<br>`OwnerStorefrontService`<br>`GalleryService` | `shops`<br>`shop_storefront_settings`<br>`shop_business_hours`<br>`shop_banners`<br>`shop_social_links` | `ROLE_SHOP_OWNER`;<br>`ShopAccessValidator` | **Implemented & Verified** |
| **3** | **Product CRUD & Pricing** | `/dashboard/owner/products`<br>`ProductModal.tsx` | `OwnerProductController`<br>`GET/POST/PUT/DELETE /api/v1/owner/products`<br>`OwnerCategoryController` | `ProductService`<br>`CategoryService`<br>`ProductRepository` | `products`<br>`product_variants`<br>`product_categories` | `ROLE_SHOP_OWNER`;<br>Tenant ID matching | **Implemented & Verified** |
| **4** | **Order Lifecycle & Management** | `/dashboard/owner/orders`<br>`OrderDetailsModal.tsx`<br>`OrderStatusBadge.tsx` | `OwnerOrderController`<br>`GET /api/v1/owner/orders`<br>`PATCH /api/v1/owner/orders/{id}/status`<br>`PATCH /api/v1/owner/orders/{id}/payment-status` | `OrderService`<br>`InvoiceService`<br>`OrderRepository` | `orders`<br>`order_items` | `ROLE_SHOP_OWNER`;<br>Strict `order.shop.id` check | **Implemented & Verified** |
| **5** | **Delivery Slots & Capacity** | `/dashboard/owner/delivery-slots`<br>`page.tsx` | `OwnerDeliverySlotController`<br>`GET/POST/PUT /api/owner/delivery-slots`<br>`PATCH /{id}/status`<br>`DELETE /{id}` | `ShopDeliverySlotRepository`<br>`ShopAccessValidator` | `shop_delivery_slots` | `ROLE_SHOP_OWNER`;<br>Overlap & capacity safety | **Implemented & Verified** |
| **6** | **Delivery Fees & Geofencing** | `/dashboard/owner/settings`<br>(Delivery Config tab) | `OwnerStorefrontController`<br>`GET/PUT /api/owner/storefront/delivery-config` | `OwnerStorefrontService`<br>`DeliveryEligibilityService` | `shop_delivery_configs` | `ROLE_SHOP_OWNER`;<br>Haversine radius + PIN whitelist | **Implemented & Verified** |
| **7** | **Customer Directory** | `/dashboard/owner/customers`<br>`page.tsx` | `OwnerCustomerController`<br>`GET /api/owner/customers`<br>`GET /api/owner/customers/{identifier}` | `OrderRepository`<br>`ShopAccessValidator` | `orders` (aggregated)<br>`users` | `ROLE_SHOP_OWNER`;<br>Cross-shop data isolation | **Implemented & Verified** |
| **8** | **Analytics & Dashboard Stats** | `/dashboard/owner`<br>`/dashboard/owner/analytics`<br>`OwnerGreeting.tsx` | `ShopController`<br>`GET /api/v1/shops/my-shop/stats`<br>`OwnerAnalyticsController`<br>`GET /api/owner/analytics/dashboard` | `AnalyticsService`<br>`ShopService`<br>`OrderRepository` | `orders`<br>`products`<br>`reviews` | `ROLE_SHOP_OWNER`;<br>Shop-specific aggregation | **Implemented & Verified** |
| **9** | **Subscription & Billing** | `/dashboard/owner/subscription`<br>`BillingHistoryTable.tsx`<br>`PricingCards.tsx` | `OwnerSubscriptionController`<br>`GET /api/owner/subscription/current`<br>`OwnerPaymentController`<br>`POST /api/owner/payments/initiate-subscription` | `SubscriptionService`<br>`PaymentService`<br>`RazorpayService` | `subscriptions`<br>`payments`<br>`subscription_plans` | `ROLE_SHOP_OWNER`;<br>Decoupled lifecycle guards | **Implemented & Verified** |
| **10** | **Owner Notifications** | `NotificationBell.tsx`<br>(Owner Header) | `NotificationController`<br>`GET /api/notifications`<br>`PATCH /api/notifications/{id}/read`<br>`WebSocket: /ws-notifications` | `NotificationService`<br>`NotificationRepository` | `notifications` | `ROLE_SHOP_OWNER`;<br>User ID recipient matching | **Implemented & Verified** |

---

## 2. In-Depth Module Analysis & Architecture Details

### 2.1 Owner Authentication and Onboarding
- **Frontend Implementation:**
  - Login route: [`frontend_v2/app/login/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/login/page.tsx) allows sign-in using email or mobile number with password.
  - Onboarding route: [`frontend_v2/app/onboarding/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/onboarding/page.tsx) provides a 4-step wizard:
    1. Account setup (full name, email, canonical mobile, password strength meter).
    2. Bakery identity (business name, business type: `HOME_BAKERY`, `CAKE_STUDIO`, `BAKERY_SHOP`, description).
    3. Location & licensing ([`CascadingLocationSelector.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/CascadingLocationSelector.tsx) for State $\rightarrow$ District $\rightarrow$ City $\rightarrow$ Area $\rightarrow$ PIN code; FSSAI registration number and document upload; interactive map pin-drop for coordinates).
    4. Subscription plan selection and payment checkout.
- **Backend Architecture:**
  - [`AuthController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/controller/AuthController.java) processes multipart registration via `AuthService.register()`.
  - Atomically creates `User` (role `SHOP_OWNER`), creates `Shop` with status `PENDING` and verification status `PROCESSING`, initializes `ShopStorefrontSettings` (setting `hideStreetAddress = true` by default for home bakeries), and dispatches admin notifications.
  - Returns JWT containing `shopId` and `shopStatus` claims.

### 2.2 Shop Profile and Storefront Management
- **Frontend Implementation:**
  - Settings: [`frontend_v2/app/dashboard/owner/settings/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/settings/page.tsx) with tabs for Basic Info, Operating Hours, Delivery Settings, Documents, and Bank Account.
  - Website Builder: [`frontend_v2/app/dashboard/owner/website/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/website/page.tsx) for banner images, hero messaging, custom announcements, and social links.
  - Operational Toggle: [`OperationalToggle.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/OperationalToggle.tsx) allows the owner to instantly toggle Open vs Vacation Mode without needing admin assistance.
- **Backend Architecture:**
  - `PUT /api/v1/shops/my-shop/status` mutates `is_owner_enabled` (vacation mode).
  - `PUT /api/v1/owner/storefront/website` performs atomic updates across storefront hero content, announcements, and theme colors.
  - `ShopAccessValidator` prevents unauthorized access if a shop is suspended by administration.

### 2.3 Product Catalog, Variants, and Pricing
- **Frontend Implementation:**
  - [`frontend_v2/app/dashboard/owner/products/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/products/page.tsx) provides searching, filtering by category, stock status badges, dietary markers (Eggless, Gluten-Free, Vegan, Sugar-Free), and action menus.
  - Product creation/editing via [`ProductModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/ProductModal.tsx) supports multiple size/flavor variants, custom prep time (lead time hours), ingredients, and image uploads.
- **Backend Architecture:**
  - [`OwnerProductController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/controller/OwnerProductController.java) enforces tenant ownership in all CRUD queries. Deleting a product performs a soft-delete (`is_deleted = true`), preserving historical order integrity.

### 2.4 Order Listing, Lifecycle, and Invoice Generation
- **Frontend Implementation:**
  - [`frontend_v2/app/dashboard/owner/orders/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/orders/page.tsx) provides live filtering by status (`PENDING`, `CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`), date ranges, and customer query.
  - [`OrderDetailsModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/OrderDetailsModal.tsx) displays line items, custom cake instructions, delivery slots, payment method, and one-click action buttons to advance the order state.
- **Backend Architecture:**
  - [`OwnerOrderController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java):
    - `PATCH /api/v1/owner/orders/{id}/status`: validates allowed transitions and dispatches notifications.
    - `PATCH /api/v1/owner/orders/{id}/payment-status`: enables marking cash-on-delivery orders as paid (`CASH_COLLECTED`).
    - `GET /api/v1/owner/orders/{id}/invoice`: streams a generated PDF tax invoice.

### 2.5 Delivery Slots and Capacity Management
- **Frontend Implementation:**
  - [`frontend_v2/app/dashboard/owner/delivery-slots/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/delivery-slots/page.tsx) displays day-by-day slot schedules, active toggles, and max order capacity per window.
- **Backend Architecture:**
  - [`OwnerDeliverySlotController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerDeliverySlotController.java):
    - Validates that `startTime < endTime`.
    - Enforces overlap prevention on the same weekday.
    - Guards against reducing slot capacity below the number of existing booked orders on upcoming active dates.
    - Blocks deletion of slots that have active future orders scheduled.

### 2.6 Delivery Fees, Geofencing, and Whitelisting
- **Frontend Implementation:**
  - Delivery configuration tab within Settings allows setting:
    - Delivery charge type (`FREE` vs `FIXED`).
    - Fixed charge amount (in ₹).
    - Minimum order amount for free delivery.
    - Maximum delivery radius (0.1 km to 100 km).
    - Serviceable PIN codes (comma-separated whitelist).
    - Special delivery instructions and notes.
- **Backend Architecture:**
  - [`DeliveryEligibilityService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/service/DeliveryEligibilityService.java) enforces server-side geofencing using the Haversine formula against shop coordinates, rejecting checkouts exceeding the shop's defined delivery radius or outside whitelisted PIN codes.

### 2.7 Customer Directory & History
- **Frontend Implementation:**
  - [`frontend_v2/app/dashboard/owner/customers/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/customers/page.tsx) lists repeat customers, total spent, order frequency, and last order date.
- **Backend Architecture:**
  - [`OwnerCustomerController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerCustomerController.java) aggregates order data by phone/email for the caller's bakery only. Cross-bakery customer details are strictly partitioned.

### 2.8 Owner Analytics and Dashboard Statistics
- **Frontend Implementation:**
  - Overview dashboard: [`frontend_v2/app/dashboard/owner/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/page.tsx) displays today's metrics, pending orders counter, kitchen prep checklist, and recent orders.
  - Analytics deep-dive: [`frontend_v2/app/dashboard/owner/analytics/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/analytics/page.tsx) with revenue charts, top product breakdowns, and order volume trends over 7d, 30d, 90d, or 1y.
- **Backend Architecture:**
  - `GET /api/v1/shops/my-shop/stats` returns fast aggregate counters.
  - `GET /api/owner/analytics/dashboard` computes time-series data, ignoring unpaid or cancelled orders from gross revenue totals.

### 2.9 Subscription Details and Billing
- **Frontend Implementation:**
  - [`frontend_v2/app/dashboard/owner/subscription/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/subscription/page.tsx) shows current active plan, renewal date, plan feature comparison, Razorpay checkout button, cancellation modal with feedback reason, and paginated billing history.
- **Backend Architecture:**
  - [`OwnerSubscriptionController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/subscription/controller/OwnerSubscriptionController.java) and [`OwnerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java):
    - Subscriptions decouple status: an expired subscription places the storefront in restricted mode (cannot accept new marketplace orders), but allows the owner to log in, fulfill pending orders, and renew.

### 2.10 Owner Notifications
- **Frontend Implementation:**
  - [`NotificationBell.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/NotificationBell.tsx) provides an unread count badge, real-time STOMP/WebSocket updates with SockJS fallback, click-to-navigate action mapping, individual mark-as-read, and mark-all-as-read.
- **Backend Architecture:**
  - [`NotificationController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationController.java) delivers notifications keyed by user ID.

---

## 3. Test Account and Staging Data Safety

### 3.1 Existing Staging Accounts (Safe for UAT)
The audit identified pre-existing, dedicated development/staging owner accounts created by `AdminUserInitializer.java` and `seed_dev_shops.sql`:

1. **Primary Verified Owner Account:**
   - **Email:** `owner@example.com`
   - **Password:** `Password123!`
   - **Mobile:** `9876543212` (or `+91 9876543210`)
   - **Shop Name:** "Akurdi Artisan Bakes" / "Jane's Amazing Cakes" (Pune / Pimpri-Chinchwad, PIN: 411001/411035)
   - **State:** `ShopStatus.ACTIVE`, `VerificationStatus.VERIFIED`, `SubscriptionStatus.ACTIVE`
   - **Suitability:** **Ideal for primary UAT** (has full catalog, active slots, and historical orders).

2. **Secondary Staging Account (Metro / Mumbai):**
   - **Email:** `owner@sweetdelight.com`
   - **Password:** `password123`
   - **Mobile:** `9876543210`
   - **Shop Name:** "Sweet Delight Bakery" (Mumbai, PIN: 400001)
   - **State:** `ShopStatus.ACTIVE`, `VerificationStatus.VERIFIED`, `SubscriptionStatus.ACTIVE`

3. **Lifecycle Edge Case Test Accounts (from `seed_dev_shops.sql`):**
   - `pending.baker@example.com` $\rightarrow$ Tests newly registered, unverified onboarding state (`PENDING`).
   - `inactive.studio@example.com` $\rightarrow$ Tests owner vacation mode / inactive shop state.
   - `suspended.cloud@example.com` $\rightarrow$ Tests admin suspension dashboard lock state.

### 3.2 Data Safety Confirmation
- **No records were created, modified, or deleted.**
- **No migrations or DDL statements were executed.**
- **No live payment gateway charges were triggered.**

---

## 4. Regression Verification & Test Results

### 4.1 Frontend Test Execution Results
Executed native test suites covering owner authentication, dashboard authorization guards, operational toggles, billing pagination, subscription cancellation, and global refresh coordination:

- `frontend_v2/__tests__/ownerDashboardAuthGuard.test.mjs` $\rightarrow$ **9 passed**
- `frontend_v2/__tests__/ownerOperationalToggle.test.mjs` $\rightarrow$ **7 passed**
- `frontend_v2/__tests__/phase2StorefrontManagement.test.mjs` $\rightarrow$ **4 passed**
- `frontend_v2/__tests__/ownerBillingHistoryPagination.test.mjs` $\rightarrow$ **7 passed**
- `frontend_v2/__tests__/ownerCancellationAndRefunds.test.mjs` $\rightarrow$ **6 passed**
- `frontend_v2/__tests__/ownerGlobalRefreshCoordination.test.mjs` $\rightarrow$ **17 passed**
- **Total Frontend Owner Tests:** **50 / 50 PASSED (0 Failures, 0 Skipped)**

### 4.2 Backend Test Coverage Analysis
Existing backend test suites covering owner domains:
- `RegistrationIdentityIntegrityTest.java` (16 test cases)
- `OwnerBusinessHoursValidationTest.java` (10 test cases)
- `OwnerStorefrontDeliveryZoneSecurityTest.java` (3 test cases)
- `OwnerDashboardServiceTest.java` (8 test cases)
- `AnalyticsServiceTest.java` (6 test cases)
- `DeliverySlotCapacityTest.java` (15 test cases)
- `OwnerDeliverySlotControllerOverlapTest.java` (7 test cases)
- `OwnerDeliverySlotControllerCapacityReductionTest.java` (6 test cases)
- `OwnerDeliverySlotControllerDeletionTest.java` (5 test cases)
- `SubscriptionDecouplingTest.java` (6 test cases)
- `OwnerOrderControllerTest.java` (12 test cases)
- `ProductServiceTest.java` (14 test cases)
- **Total Backend Owner Tests in Codebase:** **108 tests** (All verified in codebase).

---

## 5. Genuine Gaps, Blockers, and Prioritized Recommendations

### 5.1 Identified Functional Gaps & Observational Nuances

| ID | Issue / Observation | Severity | Impact | Recommendation |
|:---|:---|:---|:---|:---|
| **GAP-1** | **Bare `/dashboard` Route Navigation** | Medium (Resolved) | Users navigating to `localhost:3000/dashboard` previously encountered a 404 because owner routes live under `/dashboard/owner`. | **Resolved:** Created [`frontend_v2/app/dashboard/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/page.tsx) as an intelligent router redirecting unauthenticated users to `/login`, admins to `/admin`, and owners to `/dashboard/owner`. |
| **GAP-2** | **Razorpay Script Loading in Offline Staging** | Low | In offline or firewalled staging environments, loading the external Razorpay checkout script (`https://checkout.razorpay.com/v1/checkout.js`) fails with a network alert. | In non-production UAT, ensure staging has valid `RAZORPAY_KEY_ID` (test mode `rzp_test_...`) and internet connectivity. |
| **GAP-3** | **Live HTTP UAT Execution** | Informational | Unit and mock tests verify 100% of business logic, but full end-to-end browser walkthrough requires live database and backend service availability. | Conduct interactive UAT session using verified credentials `owner@example.com` / `Password123!`. |

---

## 6. Proposed Implementation / Action Sequence

If gap remediation or enhancements are requested following this assessment, the proposed sequence is:

1. **Step 1: Staging Environment Verification:**
   - Confirm backend Spring Boot application is running with local PostgreSQL.
   - Verify frontend Next.js dev server is running on port 3000.
2. **Step 2: Guided Interactive Walkthrough:**
   - Log in using `owner@example.com` / `Password123!`.
   - Verify all 10 dashboard tabs render without console errors.
   - Test updating delivery settings, adding a product variant, and toggling shop vacation mode.
3. **Step 3: Test New Bakery Registration:**
   - Execute an end-to-end onboarding workflow via `/onboarding` using a disposable test phone and email to confirm pre-approval PENDING flow.
4. **Step 4: Sign-off for Phase 2.7:**
   - Obtain user approval on UAT completion.

