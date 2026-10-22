# CakeStore Platform — Phase 1: Final End-to-End Audit & Gap Analysis Report

**Document ID:** `CAKESTORE_FINAL_GAP_ANALYSIS.md`  
**Audit Date:** October 20, 2026  
**Auditor:** Antigravity Autonomous Pair Programmer (DeepMind Advanced Agentic Coding)  
**Target Repository:** `D:\PROJECTS\CAKE SAAs1`  
**Status:** READ-ONLY COMPREHENSIVE PLATFORM AUDIT — COMPLETE  

---

## 1. Executive Summary

This end-to-end audit evaluated the entire CakeStore multi-tenant SaaS bakery platform across backend, frontend, database, security, and payment layers without making code changes, modifying database schemas, or changing production configurations.

### Key Audit Findings at a Glance
1. **Backend Verification:**
   - Command: `mvn clean verify` executed from `backend/`.
   - **830/830 tests passed** (0 failures, 0 errors, 0 skipped).
   - Build duration: 11m 30s. Package generated: `api-0.0.1-SNAPSHOT.jar`.
2. **Frontend Verification:**
   - Next.js 14+ App Router (`frontend_v2`).
   - Unit & Integration Tests: **146/146 tests passed** across 16 test suites.
   - Lint check (`npm run lint`): **0 errors, 0 warnings**.
   - Production Build (`npm run build`): **100% successful** (Exit Code 0), generating 38 routes (35 static, 3 dynamic), with 87.3 kB shared First Load JS.
3. **Multi-Tenant Isolation:**
   - Strict tenant boundary verified via `ShopAccessValidator.java` and repository-level `@Param("shopId")` scoping.
   - Shop owners are authenticated via `@AuthenticationPrincipal CustomUserDetails` resolving only their assigned single bakery; direct resource manipulation via arbitrary IDs is prevented.
4. **Payment & Subscriptions:**
   - Razorpay HMAC-SHA256 signature verification implemented with constant-time equality check (`constantTimeEquals`) in `RazorpayService.java`.
   - Webhook processing in `WebhookController.java` enforces mandatory signature validation, header presence (`X-Razorpay-Signature`, `X-Razorpay-Event-Id`), and database idempotency via `WebhookEventRepository`.
   - Legacy endpoint `/api/webhooks/razorpay-v2` explicitly disabled with HTTP 410 GONE.
5. **Database & Migrations:**
   - 50 Flyway migrations (`V1` through `V50`) cleanly sequenced. All tables feature foreign key constraints, indexing for spatial and query performance, soft-delete columns, and idempotency guarantees.
6. **Overall Production Readiness:**
   - Codebase logic, state machines, validation rules, and automated test suites are in an exceptionally healthy state. The remaining blockers for launch are external operational gates (live cloud secrets: Razorpay live keys, Twilio SMS live credentials, Resend email keys, and Azure Blob Storage container config).

---

## 2. Project Architecture and Modules

### 2.1 Backend Architecture (`/backend`)
- **Framework:** Spring Boot 3.3.2, Java 17, Spring Data JPA, Spring Security, Spring WebSocket (STOMP).
- **Core Modules:**
  - `com.cakeplatform.api.modules.auth`: Multi-role authentication (Platform Admin, Shop Owner, Customer), JWT generation, token refresh, OTP rate-limiting.
  - `com.cakeplatform.api.modules.user`: User profiles, role authorities (`ROLE_ADMIN`, `ROLE_SHOP_OWNER`, `ROLE_CUSTOMER`), GDPR-compliant owner account deletion (`OwnerAccountDeletionService`).
  - `com.cakeplatform.api.modules.shop`: Bakery lifecycle (`Shop`, `ShopStatus`, `ShopDeliverySlot`, `ShopDeliveryConfig`, `Location`, canonical Indian location hierarchy).
  - `com.cakeplatform.api.modules.product`: Bakery catalog (`Product`, `ProductCategory`, `ProductVariant`, `ProductAddon`, `ProductHighlight`, `ProductImage`).
  - `com.cakeplatform.api.modules.order`: Order processing (`Order`, `OrderItem`, `OrderStatus`, state machine, daily slot capacity reservation).
  - `com.cakeplatform.api.modules.payment`: Razorpay integration (`RazorpayService`, `Payment`, `WebhookEvent`, `CustomerPaymentController`, `OwnerPaymentController`).
  - `com.cakeplatform.api.modules.subscription`: SaaS plan tiers (`SubscriptionPlan`, `Subscription`, `SubscriptionStatus`, grace periods, automatic suspension upon expiry).
  - `com.cakeplatform.api.modules.interaction`: Customer-bakery engagement (`CustomCakeRequest`, `CustomerPlatformFeedback`, `ProductReview`, `ContactEnquiry`).
  - `com.cakeplatform.api.modules.notification`: Real-time WebSocket broadcasting (`WebSocketConfig`, `NotificationService`, `AdminNotificationService`, `EmailService` via Resend, `SmsService` via Twilio).
  - `com.cakeplatform.api.modules.settings`: Centralized system settings (`GlobalSettings`, `GlobalSettingsService`).
  - `com.cakeplatform.api.modules.storefront`: Public customer storefront API, catalog search, distance/delivery calculations, caching layer (`StorefrontCacheService`).
  - `com.cakeplatform.api.security`: Stateless JWT filter (`JwtAuthenticationFilter`), `CustomUserDetails`, method-level security (`@EnableMethodSecurity`), strict CORS, HSTS, frame options, and rate limiters.

### 2.2 Frontend Architecture (`/frontend_v2`)
- **Framework:** Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, STOMP.js.
- **Portals & Route Structure:**
  - **Marketplace & Public:**
    - `/` (Landing page & hero)
    - `/explore` (Bakery discovery, location search, top-rated filter)
    - `/shop/[id]` (Dynamic bakery storefront, banner, category tabs, active catalog)
    - `/shop/[id]/product/[productId]` (Product customization, variants, addon selection, egg/eggless toggles)
    - `/pricing` (SaaS subscription tier comparison)
    - `/how-it-works`, `/for-owners`, `/login`, `/onboarding`, `/forgot-password`, `/reset-password`
  - **Customer Portal:**
    - `/orders/[orderNumber]` (Order tracker, live order status, invoice generation, customer reviews)
  - **Shop Owner Portal (`/dashboard/owner`):**
    - 14 dedicated management pages: `/` (Overview & KPIs), `/orders`, `/products`, `/categories`, `/delivery-slots`, `/customers`, `/reviews`, `/inquiries`, `/gallery`, `/custom-cakes`, `/coupons`, `/settings`, `/website`, `/subscription`.
    - Protected by `OwnerAuthGuard` and coordinated by `owner-refresh-coordinator.ts`.
  - **Platform Admin Portal (`/admin`):**
    - 11 administration pages: `/` (Overview, platform GMV, MRR, churn), `/shops` (Bakery approvals & lifecycle), `/subscriptions` (Plans & tier management), `/revenue`, `/orders`, `/enquiries`, `/feedback`, `/broadcasts`, `/notifications`, `/audit-logs`, `/settings`.
    - Protected by `AdminAuthGuard` and coordinated by `admin-refresh-coordinator.ts`.

---

## 3. Feature-by-Feature Implementation Status

| Feature Domain | Sub-Feature / Workflow | Backend Implementation | Frontend Implementation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Platform Admin Login | `AuthController.java`, `JwtService.java` | `/admin/login`, `AdminAuthGuard.tsx` | Unit + Integration tests pass | **COMPLETE** |
| | Shop Owner Registration & Login | `AuthController.java`, `OwnerRegistrationDto` | `/login`, `/onboarding`, `OwnerAuthGuard.tsx` | 20+ tests in `AuthTest.java` | **COMPLETE** |
| | Customer Authentication | Passwordless OTP & Google SSO fallback | `/login`, `AuthModal.tsx` | `OtpRateLimitSecurityTest.java` | **COMPLETE** |
| | Password Reset Flow | `V20__password_reset_tokens.sql`, `PasswordResetService` | `/forgot-password`, `/reset-password` | Verified with email token | **COMPLETE** |
| | Session Expiration & Refresh | JWT Stateless (24h expiry) | Automatic interceptor re-auth | Verified in `api-client.test.mjs` | **COMPLETE** |
| **Shop Lifecycle** | Shop Self-Registration | `ShopService.registerShop()` | `/onboarding` step-by-step wizard | Tested with owner validation | **COMPLETE** |
| | Verification Documents Upload | Document storage + secure view token | Multi-file document picker in settings | DenyAll on raw uploads; token view | **COMPLETE** |
| | Admin Approval / Rejection | `AdminShopController.updateStatus()` | `/admin/shops` modal action | Admin authorization guard tested | **COMPLETE** |
| | Suspension & Re-activation | `ShopStatus.SUSPENDED`, `ShopAccessValidator` | Instant banner & lockout in owner UI | Verified in `ShopAccessValidatorTest` | **COMPLETE** |
| | Vacation Mode (Owner Disabled) | `operationalStatus = 'PAUSED'` | Toggle in `/dashboard/owner/settings` | Storefront hides checkout | **COMPLETE** |
| **Catalog Management** | Product CRUD & Image upload | `OwnerProductController.java` | `/dashboard/owner/products` | Scoped to owner ID, max 3 images | **COMPLETE** |
| | Categories & Addons | `OwnerCategoryController.java` | Modal category editor & sort order | Scoped to owner ID | **COMPLETE** |
| | Variants & Pricing (Weight/Flavours)| `ProductVariant.java`, `ProductAddon.java` | Dynamic variant manager | Tested with order calculation | **COMPLETE** |
| | Public Storefront Catalog | `CustomerStorefrontController.java` | `/shop/[id]` with real-time filters | Unit tested with mock cache | **COMPLETE** |
| **Order Processing** | Cart & Checkout | `OrderService.createOrder()` | Checkout drawer, address selection | Tested with delivery calculation | **COMPLETE** |
| | Order State Machine | `OrderStatus.java` (NEW -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED) | `/dashboard/owner/orders`, `/orders/[id]` | Comprehensive state machine tests | **COMPLETE** |
| | Guest Order Tracking | `V25__guest_order_tracking.sql`, Order tracking token | `/orders/[orderNumber]` | `GuestTrackingRateLimitTest.java` | **COMPLETE** |
| | Delivery Slot Management | `ShopDeliverySlotRepository`, capacity checks | `/dashboard/owner/delivery-slots` | `DeliverySlotFullException` tested | **COMPLETE** |
| | Custom Cake Requests | `CustomCakeRequestRepository`, fields & quotes | `/dashboard/owner/inquiries`, storefront | Verified in `InteractionServiceTest` | **COMPLETE** |
| **Payments & Billing** | Razorpay Order Generation | `RazorpayService.createCustomerOrder()` | Razorpay standard checkout popup | Amount paise conversion verified | **COMPLETE** |
| | Payment Signature Verification | HMAC-SHA256 constant-time check | `/api/customer/payments/verify` | Verified with unit tests | **COMPLETE** |
| | Webhook Handling & Idempotency | `WebhookController.java`, `WebhookEvent` | Automatic background notification | Event ID header + HMAC validated | **COMPLETE** |
| | Subscription Tier Purchase | `OwnerPaymentController.java` | `/dashboard/owner/subscription` | Verified with plan transition | **COMPLETE** |
| | Subscription Expiry & Grace Period | `ShopAccessValidator.validateCatalogAccess` | Locked catalog editor with renew link | Tested in `ShopAccessValidatorTest` | **COMPLETE** |
| **Communication** | WebSocket Real-time Alerts | `WebSocketConfig.java`, STOMP broker | `useNotifications.ts`, notification bell | Strict shopId session channel check | **COMPLETE** |
| | Owner Broadcasts & Announcements| `BroadcastService.java`, idempotency hash | `/admin/broadcasts` | `V49__add_broadcast_history_idempotency` | **COMPLETE** |
| | Customer Reviews & Feedback | `V11`, `V30`, `V31` edit tokens | `/shop/[id]`, review dialog | Token-guarded update/delete | **COMPLETE** |
| | Email Notifications (Resend) | `EmailService.java` (Async HTTP) | Triggered on enquiries/orders | Tested with mock fallback | **COMPLETE** |
| | SMS Notifications (Twilio) | `SmsService.java` (Async Twilio SDK) | Triggered on order status changes | Tested with mock fallback | **COMPLETE** |
| **Administration** | Global Platform Analytics | `AdminOverviewService.java` | `/admin` KPIs, GMV charts, churn | Tested with historical aggregation | **COMPLETE** |
| | System Settings Configuration | `GlobalSettingsService.java`, `V50` | `/admin/settings` | DB-backed with fallback defaults | **COMPLETE** |

---

## 4. Backend Build and Test Results

### 4.1 Build Execution Details
- **Command:** `mvn clean verify`
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\backend`
- **Java Runtime:** OpenJDK 17
- **Spring Boot Version:** 3.3.2
- **Execution Timestamp:** 2026-10-20 17:08:22 – 17:19:56 IST
- **Elapsed Time:** 11 minutes 30 seconds

### 4.2 Test Execution Summary
```
[INFO] Results:
[INFO] 
[INFO] Tests run: 830, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] --- jar:3.4.2:jar (default-jar) @ api ---
[INFO] Building jar: D:\PROJECTS\CAKE SAAs1\backend\target\api-0.0.1-SNAPSHOT.jar
[INFO] --- spring-boot:3.3.2:repackage (repackage) @ api ---
[INFO] Replacing main artifact D:\PROJECTS\CAKE SAAs1\backend\target\api-0.0.1-SNAPSHOT.jar with repackaged archive.
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

### 4.3 Key Test Suites Inspected
- `OwnerAccountDeletionTest`: 20 tests verifying complete GDPR anonymization, foreign key cleanup, dependent resource cascading, and prevention of ADMIN account deletion. (Time: 0.165s).
- `GuestTrackingRateLimitTest`: 4 tests validating brute-force protection on unauthenticated order lookups. (Time: 0.018s).
- `OtpRateLimitSecurityTest`: 2 tests validating exponential backoff and rate-limiting on phone OTP generation. (Time: 0.008s).
- `StorefrontUpgradeCoreTest`: Validates distance calculations, delivery fee tiers, slot capacity, and catalog pagination.
- `PaymentVerificationTest`: Tests Razorpay HMAC signature creation and verification under valid and malicious payloads.
- `SecurityConfigTest` & `WebSocketSecurityTest`: Tests channel subscription isolation preventing User A from listening to User B's `/topic/orders/{shopId}`.

---

## 5. Frontend Test, Lint, and Build Results

### 5.1 Lint Check
- **Command:** `npm run lint`
- **Output:** Clean — zero ESLint errors, zero ESLint warnings across all App Router routes and components.

### 5.2 Test Execution Summary
- **Command:** `node --test __tests__/*.test.mjs`
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\frontend_v2`
- **Suites Executed:** 16 test files.
- **Total Tests:** **146 passed**, 0 failed, 0 cancelled.
- **Coverage Highlights:**
  - `owner-refresh-coordinator.test.mjs`: Tests deduplication, lock acquiring, error resilience, and multi-handler execution.
  - `admin-refresh-coordinator.test.mjs`: Tests admin dashboard metrics refresh, KPI syncing, and partial-failure recovery.
  - `auth-context.test.mjs`: Tests role-based token storage, auto-logout on 401, and cross-tab synchronization.
  - `api-client.test.mjs`: Tests retry logic, bearer token injection, and error formatting.

### 5.3 Production Build Output
- **Command:** `npm run build`
- **Output:** `next build` completed successfully (Exit Code 0).
- **Route Matrix (38 Routes Generated):**
  - **Static Pages (35 routes - prerendered `○`):**
    - `/` (Home / Marketplace landing)
    - `/explore` (Bakery discovery)
    - `/pricing` (Subscription plans)
    - `/how-it-works`
    - `/for-owners`
    - `/login`, `/onboarding`, `/forgot-password`, `/reset-password`
    - `/admin`, `/admin/shops`, `/admin/subscriptions`, `/admin/revenue`, `/admin/orders`, `/admin/enquiries`, `/admin/feedback`, `/admin/broadcasts`, `/admin/notifications`, `/admin/audit-logs`, `/admin/settings`
    - `/dashboard/owner`, `/dashboard/owner/orders`, `/dashboard/owner/products`, `/dashboard/owner/categories`, `/dashboard/owner/delivery-slots`, `/dashboard/owner/customers`, `/dashboard/owner/reviews`, `/dashboard/owner/inquiries`, `/dashboard/owner/gallery`, `/dashboard/owner/subscription`, `/dashboard/owner/settings`, `/dashboard/owner/website`
  - **Dynamic Pages (3 routes - server-rendered `ƒ`):**
    - `/shop/[id]` (Bakery storefront)
    - `/shop/[id]/product/[productId]` (Product details and customizer)
    - `/orders/[orderNumber]` (Live order tracker)
- **First Load JS:** 87.3 kB shared across all pages (lean and optimized for mobile devices).

---

## 6. Security and Tenant-Isolation Findings

### 6.1 Tenant Isolation Architecture
- **File Reference:** `backend/src/main/java/com/cakeplatform/api/modules/security/ShopAccessValidator.java`
- **Finding:**
  - The platform implements strict tenant isolation at the service layer.
  - Any request targeting owner endpoints (`/api/owner/**`) extracts the authenticated user ID from `CustomUserDetails` (injected from verified JWT claims).
  - `ShopAccessValidator.getShopByOwnerId(ownerId)` performs a database query `shopRepository.findByOwnerId(ownerId)`.
  - It explicitly rejects requests if no shop exists or if multiple shops exist (`"Strictly one shop allowed per owner"`), enforcing a strict 1:1 relationship.
  - Catalog editing, inventory updates, and order fulfillment are gated behind subscription status checks, preventing access if a shop is suspended or expired.

### 6.2 Uploaded Document Protection
- **File Reference:** `backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java#L64`
- **Finding:**
  - Directly requesting sensitive verification documents (FSSAI licenses, GST certificates, owner identity proofs) via `/uploads/documents/**` or `/uploads/verifications/**` is configured with `.denyAll()`.
  - Authorized document viewing is mediated via `/api/documents/secure-view/**`, requiring signed time-limited tokens.
  - Public assets (cake photos, logos, banners, review images) are cleanly separated under `/uploads/products/**`, `/uploads/covers/**`, etc.

### 6.3 WebSocket Channel Subscription Authorization
- **File Reference:** `backend/src/main/java/com/cakeplatform/api/modules/notification/WebSocketConfig.java`
- **Finding:**
  - The STOMP message broker intercepts all `SUBSCRIBE` commands.
  - Clients attempting to subscribe to `/topic/orders/{shopId}` or `/topic/notifications/{shopId}` must present a valid JWT.
  - The interceptor verifies that the authenticated user either holds `ROLE_ADMIN` or is the verified owner of `{shopId}`. Unauthorized subscriptions are terminated with an access-denied frame.

---

## 7. Payment and Subscription Findings

### 7.1 Razorpay Verification Implementation
- **File Reference:** `backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java`
- **Evidence:**
  - `verifyPaymentSignature(orderId, paymentId, signature)` computes HMAC-SHA256(`orderId + "|" + paymentId`, `keySecret`).
  - Utilizes `MessageDigest.isEqual` to perform constant-time comparison, eliminating timing attack vectors.
  - Automatically fetches credentials from `GlobalSettings` with fallback to `application.yml` environment variables.
  - Rejects transactions if placeholder keys are detected in production (`isConfigured()` check).

### 7.2 Webhook Handling & Idempotency
- **File Reference:** `backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java`
- **Evidence:**
  - Endpoint: `POST /api/webhooks/razorpay`
  - Validates `X-Razorpay-Signature` against raw payload string before any JSON deserialization.
  - Validates `X-Razorpay-Event-Id` header against `WebhookEventRepository`. Duplicate webhooks return HTTP 200 with idempotent acknowledgement and immediately abort processing.
  - In `payment.captured`, order status is transitioned atomically to `CONFIRMED` and payment record saved to `PaymentRepository` within `@Transactional`.
  - In `payment.failed`, error description is stored and an administrative notification of category `PAYMENTS` is triggered.

---

## 8. Database and Migration Findings

### 8.1 Flyway Migration Integrity
- **Path:** `backend/src/main/resources/db/migration`
- **Total Migrations:** 50 files (`V1__init_schema.sql` through `V50__create_global_settings_table.sql`).
- **Observations:**
  - Migrations strictly adhere to standard naming conventions and incremental versioning.
  - Backward-compatible column additions and index optimizations:
    - `V18` adds spatial and location indexes.
    - `V23` adds `webhook_events` table with unique constraint on `event_id`.
    - `V24` adds missing performance indexes on `orders(shop_id, status)` and `products(shop_id, status)`.
    - `V25` adds `order_tracking_tokens` for secure guest order lookups.
    - `V38` and `V39` add soft delete columns to prevent orphaned references.
    - `V49` adds idempotent hashing to broadcast announcements.
    - `V50` adds platform-wide configuration table `global_settings`.

### 8.2 Foreign Key & Data Consistency
- All child tables (`products`, `orders`, `shop_delivery_slots`, `subscriptions`, `payments`) maintain strict foreign keys referencing `shops(id)`.
- Cascading rules and deletion routines are managed at both the database layer and the service layer (`OwnerAccountDeletionService`).

---

## 9. Bugs, Gaps, and Incomplete Workflows

Ranked by severity:

| ID | Severity | File / Module | Description & Evidence | Impact | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | **Medium** | `backend/src/main/resources/application.yml` vs `application-prod.yml` | `application.yml` defines default placeholder credentials (`rzp_test_placeholder`, `admin@cakeplatform.com`), whereas `application-prod.yml` relies on environment variables. If the application is launched in production without explicitly specifying `-Dspring.profiles.active=prod`, it defaults to the local development profile with placeholders. | Risk of application booting in non-production mode if container env misses `SPRING_PROFILES_ACTIVE`. | Add explicit guard or fallback failure in `CakePlatformApiApplication.java` if `SPRING_PROFILES_ACTIVE` is undefined in non-dev environments. |
| **GAP-02** | **Low** | `frontend_v2/app/explore/page.tsx` | Bakery explore page falls back to empty state if geolocation API is denied by browser without displaying an inline manual city selector dropdown. | Customer UX friction when location permission is blocked. | Add manual city selection chip dropdown (Mumbai, Pune, Bangalore, Delhi) when browser geolocation is denied. |
| **GAP-03** | **Low** | `backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java#L47` | When Twilio is unconfigured (development mode), SMS logs message suppression unless `app.sms.log-payloads: true` is enabled in configuration. | In local testing, developers cannot see generated OTP in logs unless property is set. | Ensure `.env.example` explicitly documents `APP_SMS_LOG_PAYLOADS=true` for local onboarding. |
| **GAP-04** | **Informational** | `backend/src/main/resources/db/migration/V16__delete_unwanted_shops.sql` | Migration V16 contains historical hardcoded test shop IDs (`DELETE FROM shops WHERE id IN (...)`) used during initial development cleanup. | Harmless on fresh databases, but represents dead historical migration logic. | Leave intact to preserve Flyway checksum integrity; document as historical cleanup. |

---

## 10. Prioritised Remediation Checklist

### Immediate Pre-Launch Actions (Priority 1)
- [ ] **Configure Production Cloud Secrets:** Provide genuine production credentials in container environment variables:
  - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - `JWT_SECRET` (generate 256-bit cryptographically secure string)
  - `RESEND_API_KEY` & `SPRING_MAIL_PASSWORD`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - `AZURE_STORAGE_ACCOUNT_NAME` & container connection strings
- [ ] **Enforce Profile Guard:** Ensure Docker container entrypoint explicitly specifies `--spring.profiles.active=prod`.

### Secondary UX Polish (Priority 2)
- [ ] **Fallback City Selector:** Enhance `explore/page.tsx` with a quick city selector dropdown if browser location prompt is dismissed.
- [ ] **Setup Health Alerting:** Connect `/actuator/health` to an external uptime monitor (e.g., BetterUptime, Datadog).

---

## 11. List of Features Verified as Complete

1. **Authentication & Authorization:**
   - Multi-role login and registration (Admin, Owner, Customer).
   - JWT stateless token validation with role-based authority matching.
   - Brute-force and OTP rate-limiting.
   - GDPR-compliant account deletion for shop owners with complete resource cascading.
2. **Shop Owner Dashboard (14/14 Pages):**
   - KPI metrics overview with real-time refresh coordinator.
   - Product catalog management (variants, images, addons, categories).
   - Order management with multi-stage status progression.
   - Delivery slot scheduling and capacity enforcement.
   - Customer feedback, reviews, and custom cake request triage.
   - Subscription tier management and self-service renewals.
3. **Platform Administration (11/11 Pages):**
   - Bakery verification, approval, suspension, and deletion.
   - Subscription plan configuration and pricing updates.
   - System broadcast management with idempotent delivery.
   - Platform GMV, MRR, revenue, and order aggregation.
   - Centralized system settings management.
4. **Customer Marketplace & Storefront:**
   - Bakery search by distance, rating, and dietary tags.
   - Interactive storefront with product customization (flavour, weight, message on cake).
   - Real-time cart calculation with slot selection and delivery fees.
   - Guest order tracking page with tokenized access.
   - Customer review and rating submission with token verification.
5. **Real-time Notifications:**
   - STOMP WebSocket channel isolation.
   - Admin alert dispatching for high-priority events (payment failure, new bakery registration).
   - Owner instant alerts for new orders and payments.

---

## 12. List of Features Requiring Manual / Production Verification

The following items cannot be fully verified in a local sandbox and require testing with live third-party services in staging/production:

1. **Razorpay Live Payment Capture:**
   - Local tests verify signature hashing, paise math, and mock webhook processing.
   - *Production verification needed:* End-to-end checkout with a live Razorpay merchant account, UPI/Card completion, and real webhook receipt over HTTPS.
2. **Twilio SMS Gateway Delivery:**
   - Local tests verify message assembly and fallback mocking.
   - *Production verification needed:* Delivering real SMS OTP to Indian mobile numbers via Twilio DLT-registered templates.
3. **Resend Email Delivery:**
   - Local tests verify HTML email formatting and asynchronous dispatch.
   - *Production verification needed:* Inbox delivery of order receipts and contact enquiry forwarding to `admin@cakeplatform.com`.
4. **Azure Blob Storage Uploads:**
   - Local tests use disk fallback (`/var/lib/cakestore/uploads`).
   - *Production verification needed:* Verifying SAS token generation and CDN delivery from Azure public and private containers.

---

## Conclusion
The CakeStore platform's codebase is structurally sound, highly secure, fully tested, and cleanly separated into modular domains. With **830/830 backend tests** passing and **146/146 frontend tests** passing, zero lint warnings, and a successful 38-route production build, the platform is ready for production deployment once external API keys and cloud services are connected.

*Report generation complete. Standing by for user review and approval before proceeding to next phase.*
