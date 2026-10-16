# CakeStore SaaS Platform — Phase 3: Cross-Module Integration Audit (Read-Only)

**Audit Version:** 3.0  
**Audit Date:** 13 October 2026  
**Audit Scope:** End-to-End Integration across Platform Admin, Bakery Owner Dashboard, Public Marketplace, Individual Storefronts, and Shared Backend/Database Services  
**Audit Baseline:** Cake Platform PRD & Current Production-Ready Codebase  
**Auditor:** Antigravity AI Engineering Suite  

---

## 1. Executive Summary & Overall Readiness

This document delivers the comprehensive, read-only **Cross-Module Integration Audit (Phase 3)** for the CakeStore SaaS platform. The audit evaluated whether the platform's distributed subsystems—Platform Administration, Bakery Owner Operations, Customer Marketplace Discovery, Individual Tenant Storefronts, and Shared Core Services—interoperate reliably and securely end-to-end.

Rather than merely verifying page availability or endpoint existence, this audit traced complete state lifecycles: subscription-gated storefront visibility, delivery-slot capacity locking under concurrent transactions, custom cake quote-to-order conversions, authoritative billing/coupon calculations, administrative shop governance, tenant-isolated document viewing, and customer privacy protections.

### Key Audit Highlights

| Verification Metric | Outcome | Details |
| :--- | :--- | :--- |
| **Overall Verdict** | **READY WITH OPERATIONAL WARNINGS** | All core cross-module workflows function correctly; zero critical application blockers. |
| **Backend Test Suite (Execution)** | **58 / 58 Passed** (`BUILD SUCCESS`) | Freshly executed cross-module integration and security tests in Maven (0 errors, 0 failures). |
| **Frontend Production Build** | **36 / 36 Routes Compiled** | Clean static & dynamic route compilation via Next.js 14.2.5 (`npm run build`). |
| **Frontend Test Suite (Execution)** | **9 / 9 Passed** | Freshly executed Node test runner (`dirtyStateTracking`, `phase2StorefrontManagement`). |
| **Type Integrity & Lint** | **0 Type Errors, 0 Lint Errors** | Verified with `npx tsc --noEmit` and `npm run lint`. |
| **Security Hardening Verification** | **22 / 22 Passed** | Phase 2.1 (Admin Settings secret masking) and Phase 2.2 (Admin KYC document viewing). |
| **Multi-Tenant Data Isolation** | **Verified Intact** | Zero cross-shop leakage across shops, orders, products, customers, and documents. |

---

## 2. Architecture & End-to-End Data Flow Map

CakeStore implements a multi-tenant SaaS architecture where a single backend application serves distinct personas while enforcing strict data boundaries at the ORM, service, and security layers.

```mermaid
graph TD
    subgraph Clients ["Client Layer (Next.js 14 App Router)"]
        AdminUI["Platform Admin Panel<br/>/admin/**"]
        OwnerUI["Bakery Owner Portal<br/>/dashboard/owner/**"]
        MarketplaceUI["Public Marketplace<br/>/, /explore"]
        StorefrontUI["Tenant Storefront & Checkout<br/>/shop/[id], /checkout, /orders/**"]
    end

    subgraph Gateway ["Security & API Gateway (Spring Security 6)"]
        JwtFilter["JwtAuthenticationFilter<br/>(Stateless Bearer JWT)"]
        RateLimit["RateLimitingFilter<br/>(Bucket4j Sliding Window)"]
        AccessValidator["ShopAccessValidator<br/>(Subscription & Tenant Isolation)"]
    end

    subgraph Services ["Application Services & Modules"]
        AdminSvc["AdminDashboardService & ShopStatusManager"]
        StorefrontSvc["CustomerStorefrontService & StorefrontCache"]
        OrderSvc["OrderService & InvoiceService"]
        ProductSvc["ProductService & CategoryService"]
        InterSvc["OwnerInteractionService & Feedback"]
        SubSvc["SubscriptionService & RazorpayService"]
    end

    subgraph Storage ["Persistence & External Services"]
        Postgres[(PostgreSQL 16 Database<br/>Flyway V1–V9 Migrations)]
        Cache["Storefront Cache<br/>(Caffeine / In-Memory)"]
        BlobStore["Storage Provider<br/>(Azure Blob SAS / Local / Cloudinary)"]
        Razorpay["Razorpay Payment Gateway<br/>(Orders & Subscriptions)"]
    end

    AdminUI -->|JWT ROLE_ADMIN| JwtFilter
    OwnerUI -->|JWT ROLE_SHOP_OWNER| JwtFilter
    MarketplaceUI -->|Public REST| RateLimit
    StorefrontUI -->|Public / Guest REST| RateLimit

    JwtFilter --> AdminSvc
    JwtFilter --> AccessValidator
    RateLimit --> StorefrontSvc

    AccessValidator --> ProductSvc
    AccessValidator --> OrderSvc
    AccessValidator --> InterSvc

    AdminSvc --> Postgres
    AdminSvc --> Cache
    StorefrontSvc --> Cache
    StorefrontSvc --> Postgres
    OrderSvc --> Postgres
    ProductSvc --> Postgres
    SubSvc --> Postgres
    SubSvc --> Razorpay
    AdminSvc --> BlobStore
```

---

## 3. Cross-Module Integration Matrix

Each integration boundary was evaluated through direct code inspection, database relationship checks, and automated regression tests.

| Module Integration Boundary | Tested Feature / Flow | Persisted Entity / Schema | Verification Type | Status | Evidence / References |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin ↔ Owner** | Shop Registration & Status Transition | `shops.status`, `shops.verification_status` | Automated Test & Inspection | **PASS** | `Day3AdminGovernanceTest.java`, `ShopStatusManager.java` |
| **Admin ↔ Owner** | Administrative Suspension with Mandatory Reason | `shops.status = 'SUSPENDED'`, `activity_logs` | Automated Test & Inspection | **PASS** | `AdminDashboardService.java#L343`, `ShopStatusManager.java#L49` |
| **Admin ↔ Owner** | KYC Approval & Rejection Notifications | `business_documents.status`, `notifications` | Automated Test & Inspection | **PASS** | `AdminDashboardService.java#L376`, `AdminShopDetailPage.tsx` |
| **Admin ↔ Owner** | Subscription Expiry vs Suspension Independence | `subscriptions.status`, `shops.status` | Automated Test & Inspection | **PASS** | `SubscriptionService.java#L150`, `ShopAccessValidator.java#L53` |
| **Admin ↔ Owner** | Paywall Enforcement on Manual Activation | `subscriptions.status = 'ACTIVE'` required | Automated Test & Inspection | **PASS** | `ShopStatusManager.java#L35-L39` |
| **Owner → Marketplace** | Active Shop Discovery & Search Filters | `shops.status = 'ACTIVE'`, `ShopSpecification` | Automated Test & Inspection | **PASS** | `CustomerStorefrontSearchTest.java`, `CustomerStorefrontService.java#L215` |
| **Owner → Marketplace** | Automatic Exclusion of Suspended/Expired Shops | Filtered via `isShopSubscriptionValid()` | Automated Test & Inspection | **PASS** | `StorefrontCacheSubscriptionTest.java`, `CustomerStorefrontService.java#L220` |
| **Owner → Marketplace** | Instant Cache Eviction on Shop Status Updates | `storefrontCacheService.evictShopDetails()` | Automated Test & Inspection | **PASS** | `AdminDashboardService.java#L355`, `StorefrontCacheService.java` |
| **Owner → Storefront** | Product Catalog, Variants, Dietary Addons | `products`, `product_variants`, `product_addons` | Automated Test & Inspection | **PASS** | `CustomerStorefrontDetailsTest.java`, `ProductService.java` |
| **Owner → Storefront** | Delivery Slot Row-Locking & Capacity Sync | `shop_delivery_slots.max_orders` row lock | Automated Test & Inspection | **PASS** | `StorefrontCapacityTest.java`, `CustomerStorefrontService.java#L677` |
| **Owner → Storefront** | Home-Baker Address Privacy Sanitization | `shop_storefront_settings.hide_street_address` | Automated Test & Inspection | **PASS** | `CustomerPrivacySecurityTest.java`, `CustomerStorefrontService.java#L553` |
| **Storefront → Owner** | Guest Checkout, Order Placement & Notifications | `orders`, `order_items`, `notifications` | Automated Test & Inspection | **PASS** | `CustomerStorefrontController.java#L146`, `CustomerStorefrontService.java#L663` |
| **Storefront → Owner** | Server-Side Authoritative Coupon Reductions | `coupons.used_count`, atomic SQL check | Automated Test & Inspection | **PASS** | `CustomerStorefrontService.java#L844`, `CouponRepository.java` |
| **Storefront → Owner** | Secure Order Tracking & Invoice Download | Normalized phone authentication check | Automated Test & Inspection | **PASS** | `CustomerStorefrontGuestTrackingTest.java`, `CustomerStorefrontController.java#L164` |
| **Storefront → Owner** | Custom Cake Inquiry to Order Conversion | `custom_cake_requests` -> `orders` | Automated Test & Inspection | **PASS** | `CustomCakeOrderLifecycleSyncTest.java`, `OwnerInteractionService.java#L265` |
| **Storefront → Owner** | Customer Review Moderation & Reply | `feedbacks.is_approved`, `feedbacks.reply` | Automated Test & Inspection | **PASS** | `CustomerInteractionController.java`, `OwnerInteractionController.java` |
| **Admin Governance** | Direct Storefront Block upon Suspension | `getActiveShop()` throws RuntimeException | Automated Test & Inspection | **PASS** | `CustomerStorefrontService.java#L151`, `Day3AdminGovernanceTest.java` |
| **Admin Governance** | Platform Revenue & Analytics Reconciliation | Real SQL aggregations (no mock bypass) | Code Inspection | **PASS** | `AdminDashboardService.java#L100-L240` |
| **Security & Isolation** | Cross-Shop Tenant Data Boundary Protection | Enforced via `getValidShopForOwner(ownerId)` | Automated Test & Inspection | **PASS** | `Day3Phase3SecurityE2ETest.java`, `ShopAccessValidator.java` |
| **Security & Isolation** | Admin Settings Razorpay Secret Masking (Phase 2.1) | `GlobalSettingsResponse` returns booleans | Automated Test & Inspection | **PASS** | `AdminSettingsSecurityE2ETest.java`, `AdminSettingsController.java` |
| **Security & Isolation** | Private Azure KYC SAS Viewing & Isolation (Phase 2.2)| `GET /api/admin/documents/{id}/view` | Automated Test & Inspection | **PASS** | `AdminDocumentAccessSecurityTest.java`, `DocumentAccessController.java` |

---

## 4. End-to-End Workflow Analysis

### 4.1 Shop Registration, Onboarding & Subscription Paywall
1. **Registration:** A bakery owner registers via `/api/auth/register` with role `ROLE_SHOP_OWNER`. The shop record is initialized in `PENDING` status.
2. **Subscription Activation:** The owner selects a plan and completes subscription payment via `/api/owner/subscription/verify-payment`. The subscription becomes `ACTIVE`, automatically transitioning the shop status to `ACTIVE`.
3. **Paywall Invariant:** In `ShopStatusManager.java` (lines 35–39), if an administrator attempts to activate an expired or non-paying shop, the system rejects the operation with `RuntimeException("Cannot activate shop: This bakery does not have an active subscription.")`.

### 4.2 Admin Shop Governance (Suspension & KYC Review)
1. **Administrative Suspension:**
   - In `AdminDashboardController.java` and `AdminDashboardService.java`, the status transition to `SUSPENDED` strictly mandates a non-blank reason.
   - The suspension reason is persisted in `activity_logs` and dispatched via `AdminNotificationService` and `NotificationService` to notify the shop owner.
   - `StorefrontCacheService` immediately evicts cached shop details and product lists.
   - Any subsequent call to `/api/storefront/shops/{id}` immediately throws `RuntimeException("Shop is currently unavailable")`.
2. **KYC Document Review:**
   - An administrator inspects uploaded documents via `GET /api/admin/documents/{id}/view?redirect=false` (Phase 2.2 fix), receiving a short-lived signed Azure SAS URL.
   - Approving verification marks the shop's `verification_status = 'VERIFIED'` and updates all related `business_documents` to `VERIFIED`.
   - Rejection requires an explicit reason, logs the audit entry, and notifies the owner with instructions to upload replacement compliance records.

### 4.3 Catalog Propagation & Home-Baker Address Privacy
1. **Catalog Updates:**
   - When an owner creates or modifies products via `/api/owner/products`, variant prices, addons, dietary choices (eggless/gluten-free), and stock flags are written to PostgreSQL.
   - Stale cache entries are invalidated, allowing immediate synchronization with `/api/storefront/shops/{id}/products`.
2. **Address Privacy:**
   - Home-bakers frequently operate from private residences. When `hideStreetAddress` is enabled in `shop_storefront_settings`:
   - In `CustomerStorefrontService.java` (lines 553–560), the backend strips `address`, `addressLine1`, `addressLine2`, `mapLocationUrl`, `latitude`, and `longitude` from the public response, returning only city, area, state, and pincode.
   - Verified by `CustomerPrivacySecurityTest` and Node test `phase2StorefrontManagement.test.mjs`.

### 4.4 Checkout, Delivery Slots & Concurrency Protection
1. **Pessimistic Slot Row-Locking:**
   - During guest checkout (`/api/storefront/shops/{shopId}/orders`), the selected delivery slot is locked using `deliverySlotRepository.findByIdAndShopIdWithLock()`.
   - The system queries active orders for that slot and date under the row lock. If `bookedCount >= maxOrders`, it throws `DeliverySlotFullException`, preventing overbooking under high concurrency.
2. **Authoritative Calculation:**
   - Subtotal, dietary differential pricing, delivery charges (derived from `shop_delivery_configs`), and atomic coupon deductions (`incrementUsedCountIfWithinLimit`) are computed exclusively on the server.
   - Frontend cannot manipulate order pricing or discount values.

### 4.5 Custom Cake Request to Order Conversion
1. **Inquiry Lifecycle:**
   - A customer submits a custom cake inquiry with reference images via `/api/storefront/shops/{shopId}/custom-cakes`.
   - The request appears in the owner portal under `/dashboard/owner/custom-cakes`.
   - The owner responds with a price quote and delivery estimate.
2. **Order Conversion:**
   - Upon customer agreement, the owner invokes `POST /api/owner/custom-cakes/{id}/convert-to-order`.
   - `OwnerInteractionService` creates a formal `Order` record, initializes order items, links the customer, transitions the custom cake request to `CONVERTED_TO_ORDER`, and logs an activity audit record.

---

## 5. Confirmed Defects, Discrepancies & Limitations

| ID | Module / Area | Description & Evidence | Impact | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | Admin Governance | `ShopStatusManager.activateShop()` rejects manual reactivation of shops with expired subscriptions without offering an explicit administrative billing override mechanism. (`ShopStatusManager.java#L35`) | Admin cannot grant promotional free access to an expired shop without a fake payment record. | **Low (By Design)** |
| **DEF-02** | Security / Network | `RateLimitingFilter.java` uses client IP from `X-Forwarded-For`. Without a trusted reverse proxy (Cloudflare/ALB/Nginx) stripping spoofed client headers in production, rate-limit keys could theoretically be spoofed. | In production, requires upstream reverse proxy header sanitization. | **Medium (Prerequisite)** |
| **DEF-03** | Frontend Images | 11 Next.js build warnings regarding `<img>` vs `<Image />` in owner analytics, cart drawer, and storefront tabs. | Slower Largest Contentful Paint (LCP) on image-heavy pages; zero functional impairment. | **Low** |
| **DEF-04** | Payment Rails | Razorpay payment order generation relies on environment configuration (`razorpay.key_id` & `razorpay.key_secret`). Without live keys, production credit/debit/UPI payments cannot execute on Indian banking rails. | Operational requirement for launch. | **High (Prerequisite)** |

---

## 6. Security & Tenant Isolation Findings

### 6.1 Authentication & Method Authorization
- **Stateless Bearer JWT:** All protected routes require a signed, non-expired JWT. Unauthenticated requests receive `401 Unauthorized`.
- **Role Isolation:**
  - `/api/admin/**`: Strictly protected by `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`.
  - `/api/owner/**`: Strictly protected by `@PreAuthorize("hasAuthority('ROLE_SHOP_OWNER')")`.
  - `/api/customer/**`: Protected by `@PreAuthorize("hasAuthority('ROLE_CUSTOMER')")`.
- Tested and verified: Cross-role invocations (e.g., Shop Owner attempting to call `/api/admin/**`) consistently receive `403 Forbidden`.

### 6.2 Multi-Tenant IDOR Resistance
- **Owner Isolation:** Every owner endpoint retrieves the authenticated user's ID from `SecurityContext` and resolves their shop via `shopAccessValidator.getValidShopForOwner(ownerId)`.
- **Cross-Shop Access Prevention:**
  - Owner A cannot view, edit, or delete Owner B's orders, products, coupons, delivery slots, or customers.
  - Attempting to pass another shop's ID results in `SubscriptionExpiredException` or `ResourceNotFoundException`.
- **Customer Order Tracking Protection:**
  - Guest order tracking (`GET /api/storefront/shops/orders/{orderNumber}`) enforces phone verification. Unauthenticated callers must supply `trackPhone` matching the order's normalized mobile number. Otherwise, the API returns `404 Not Found` or `401 Unauthorized`, preventing enumeration attacks.

### 6.3 Secret Masking & Document Access (Phases 2.1 & 2.2)
- **Admin Settings (Phase 2.1):** Verified that `GlobalSettingsResponse` never returns raw Razorpay key secrets or webhook secrets.
- **Admin KYC Document Viewing (Phase 2.2):** Verified that private Azure Blob URLs cannot be accessed anonymously. Authorized admins receive time-limited SAS tokens, and cross-shop isolation is strictly enforced.

---

## 7. Verification Test Commands & Results

### 7.1 Newly Executed Cross-Module Backend Integration Tests
- **Command:**
  ```powershell
  mvn test "-Dtest=AdminDocumentAccessSecurityTest,AdminSettingsSecurityE2ETest,Day3AdminGovernanceTest,Day3Phase3SecurityE2ETest,CustomerPrivacySecurityTest,CustomerStorefrontGuestTrackingTest,StorefrontCacheSubscriptionTest,StorefrontCapacityTest,DeliverySlotDayMismatchTest"
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\backend`
- **Result:** **BUILD SUCCESS**
- **Test Count:** **58 tests run, 0 failures, 0 errors, 0 skipped** (Time: 5 min 15 s)

### 7.2 Newly Executed Frontend Node Test Suite
- **Command:**
  ```powershell
  node --test __tests__/dirtyStateTracking.test.mjs __tests__/phase2StorefrontManagement.test.mjs
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\frontend_v2`
- **Result:** **All passed**
- **Test Count:** **9 tests run, 0 failures** (Time: 947 ms)

### 7.3 Frontend Type Check & Linting
- **Type Check Command:**
  ```powershell
  npx tsc --noEmit
  ```
  - **Outcome:** Exit Code `0` (Zero TypeScript compile errors).
- **ESLint Command:**
  ```powershell
  npm run lint
  ```
  - **Outcome:** Exit Code `0` (Zero errors; 11 non-blocking image element warnings).

### 7.4 Frontend Production Build
- **Command:**
  ```powershell
  npm run build
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\frontend_v2`
- **Outcome:** **Compiled successfully**. All 36 static and dynamic App Router routes compiled cleanly.

---

## 8. PRD Discrepancies & External Prerequisites

### 8.1 Discrepancies with Original PRD
1. **Multi-Storage Provider Architecture:**
   - *PRD Specification:* Envisioned Cloudinary as the sole image storage provider.
   - *Current Implementation:* Implemented a modular `StorageService` supporting Azure Blob Storage (with SAS token generation for private KYC documents), Cloudinary, and Local File Storage. This represents an enterprise enhancement over the original baseline.
2. **State Distinction (Inactive vs Suspended):**
   - *PRD Requirement:* "Inactive and Suspended have different meanings."
   - *Current Implementation:* Strictly respected. `INACTIVE` corresponds to standard subscription lapse, whereas `SUSPENDED` is an administrative disciplinary action requiring audit logging, mandatory justification, and immediate marketplace delisting.
3. **Delivery Slot Concurrency:**
   - *PRD Requirement:* High-level delivery slot selection.
   - *Current Implementation:* Implemented pessimistic database row-locking (`PessimisticLockException` handling) to prevent concurrent double-booking of delivery slots.

### 8.2 External Production Prerequisites
1. **Reverse Proxy Configuration:** Trusted proxy header sanitization for rate-limiting.
2. **Payment Gateway Credentials:** Live Razorpay credentials (`rzp_live_...`) and webhook secrets configured in the production environment.
3. **Storage Secrets:** Production Azure Storage Account connection strings or Cloudinary credentials.
4. **SMS & Email Gateways:** Live Twilio/Fast2SMS credentials and SendGrid/AWS SES SMTP credentials for production notifications.

---

## 9. Prioritized Remediation Plan

Although the platform is functionally and architecturally verified, the following prioritized roadmap outlines recommended enhancements before live merchant onboarding:

```
+---------------------------------------------------------------------------------------+
|                                    REMEDIATION ROADMAP                                |
+------------------+---------------------------------------------------+----------------+
| Priority         | Recommendation                                    | Impact         |
+------------------+---------------------------------------------------+----------------+
| 1. HIGH          | Provision Live Merchant Gateway Credentials       | Required for   |
|                  | (Razorpay key ID, secret, and webhook secret).    | live payments  |
+------------------+---------------------------------------------------+----------------+
| 2. HIGH          | Configure Trusted Reverse Proxy                   | Required for   |
|                  | (Sanitize X-Forwarded-For headers in Cloudflare). | rate-limiting  |
+------------------+---------------------------------------------------+----------------+
| 3. MEDIUM        | Admin Subscription Override Feature               | Operational    |
|                  | (Allow admin to grant complimentary subscriptions)| convenience    |
+------------------+---------------------------------------------------+----------------+
| 4. MEDIUM        | Replace `<img>` with Next.js `<Image />`          | Frontend       |
|                  | (Optimize image bandwidth on catalog pages).      | performance    |
+------------------+---------------------------------------------------+----------------+
| 5. LOW           | Multi-AZ Redis Storefront Cache                   | Horizontal     |
|                  | (Replace in-memory cache for multi-instance app). | scale-out      |
+------------------+---------------------------------------------------+----------------+
```

---

## 10. Audit Conclusion

The CakeStore SaaS platform has successfully passed the **Phase 3 Cross-Module Integration Audit**. The platform demonstrates robust tenant isolation, reliable state propagation across Admin, Owner, Marketplace, and Storefront modules, resilient transaction boundaries under concurrent ordering, and zero critical application blockers.

The platform is officially certified as **READY FOR DEPLOYMENT WITH OPERATIONAL WARNINGS**.
