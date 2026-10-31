# CakeStore — Phase 1D: Read-Only Release Candidate Review

**Document**: `CAKESTORE_PHASE1D_RELEASE_CANDIDATE_REVIEW.md`  
**Execution Date**: October 22, 2026  
**Auditor**: Antigravity Quality & Release Safety Agent  
**Review Type**: **STRICTLY READ-ONLY RELEASE CANDIDATE AUDIT**  
**Source of Truth**: Active Workspace Repository & Prior Verification Reports (`CAKESTORE_PHASE1C_TEST_FIXTURE_REPORT.md`, `CAKESTORE_PHASE1B_CONSTRUCTOR_FIX_REPORT.md`, `CAKESTORE_RELEASE_PREPARATION_REPORT.md`, `CAKESTORE_FINAL_PRE_DEPLOYMENT_GATE.md`)  

---

## 1. Executive Summary & Verification State

This document provides a comprehensive, read-only audit of the CakeStore codebase prior to any release branching, staging, or deployment operations.

### Current Verified Health:
- **Backend Build & Tests**: **876 / 876 tests passing (100% green bar)** via `mvn clean verify` (Exit Code `0`, 0 failures, 0 errors, 0 skipped).
- **Backend Artifact**: `api-0.0.1-SNAPSHOT.jar` packaged and Spring Boot executable archive created successfully.
- **Frontend Unit Tests**: **200 / 200 tests passing** across 21 test suites via `npm test` (Exit Code `0`).
- **TypeScript Static Typing**: **0 errors reported** via `npx tsc --noEmit` (Exit Code `0`).
- **Next.js Production Build**: **38 / 38 routes statically compiled and optimized** via `npm run build` (Exit Code `0`).
- **Flyway Database Migrations**: `V51__add_unique_provider_payment_id.sql` and `V52__add_delivery_consistency_fields.sql` verified; local PostgreSQL schema `public` is up to date.
- **Production Validation Integrity**: Delivery street address validation for `HOME_DELIVERY` remains strictly enforced; no bypasses, weakenings, or regressions were introduced.

---

## 2. Git Topography & Branch Verification

### 2.1 Branch Positioning
- **Current Active Branch**: `development`
- **Active Commit**: `5ff3143` (*"20/10/269 updated github!"*)
- **Upstream Tracking**: `origin/development`
- **Target Production Branch**: `main`
- **Target Commit**: `cf5a58c` (*"integration checked of admin to owner and marketplace"*, dated 2026-10-04)
- **Upstream Tracking for Main**: `origin/main`

### 2.2 Branch Divergence Analysis
```
git log main..development --oneline
```
`development` is **exactly 15 commits ahead** of `main`:
1. `5ff3143` 20/10/269 updated github!
2. `2e7ba49` .
3. `61c134e` almost done
4. `38beb07` files added
5. `29d417f` .
6. `a1cd61a` bakery management audited!!!
7. `83dc8c3` docs: add final visual verification report
8. `6c5be87` admin dashboard overview completed!!
9. `74abea4` 1210
10. `0ea9165` port 3000 added
11. `29f356c` sweetdelight credentials added!
12. `ec97256` new files added
13. `87ff9c9` checkout page updated
14. `90ce4bf` owner dashboard reverted
15. `53effa1` owner dashboard logic and customer check out logic added with proper security of otp

```
git log development..main --oneline
```
`main` is **0 commits ahead** of `development` (0 commits behind `development`).

**Critical Release Finding**:
`main` contains none of the commits from the last 18 days. The GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`) triggers builds only on pushes/PRs to `main`. If `main` were deployed today without merging `development`, production would deploy a state that is 15 commits behind and completely lacks:
- Delivery fee consistency & self-pickup architecture
- Razorpay payment recovery & webhook idempotency
- Location discovery, geocoding & Leaflet interactive map
- Fixes for constructor wiring (`NominatimGeocodingService`) and legacy test fixtures.

---

## 3. Working-Tree Inventory & Categorization

The active working tree contains:
- **49 modified tracked files** (2,115 line additions, 340 line deletions)
- **18 untracked source, migration, and test files**
- **22 untracked release & audit markdown documentation files**

### 3.1 Category 1: Backend Production Code & Configuration (25 files)
| File Path | Status | Purpose / Architecture |
|---|---|---|
| `backend/.../exception/PriceMismatchException.java` | Untracked | Thrown on client price drift during checkout (HTTP 409 Conflict) |
| `backend/.../modules/location/dto/GeocodeResultDTO.java` | Untracked | Geocoding coordinate and locality data transfer model |
| `backend/.../modules/location/service/GeocodingService.java` | Untracked | Core contract for geocoding providers |
| `backend/.../modules/location/service/NominatimGeocodingService.java` | Untracked | Nominatim OSM client with constructor `@Autowired` fix |
| `backend/.../modules/storefront/dto/StorefrontQuoteRequest.java` | Untracked | Request DTO for `/api/storefront/shops/{id}/quote` |
| `backend/.../modules/storefront/dto/StorefrontQuoteResponse.java` | Untracked | Authoritative response DTO with subtotal, fee, threshold |
| `backend/.../config/GlobalExceptionHandler.java` | Modified | Maps `PriceMismatchException` to HTTP 409 |
| `backend/.../modules/auth/service/AuthService.java` | Modified | Geocodes shop address on owner onboarding |
| `backend/.../modules/location/controller/LocationReferenceController.java` | Modified | Exposes forward geocoding and reverse locality endpoints |
| `backend/.../modules/order/Order.java` | Modified | Adds `fulfillmentMethod` field with default `HOME_DELIVERY` |
| `backend/.../modules/order/OrderRepository.java` | Modified | Queries for expired orders excluding active payments |
| `backend/.../modules/order/controller/WebhookController.java` | Modified | Razorpay webhook idempotency & delayed payment capture |
| `backend/.../modules/order/scheduler/OrderExpiryScheduler.java` | Modified | Protects orders with initiated payments from auto-cancellation |
| `backend/.../modules/order/service/OrderService.java` | Modified | Order lifecycle & payment status synchronization |
| `backend/.../modules/payment/controller/CustomerPaymentController.java` | Modified | Razorpay order creation, paise conversion, client verify |
| `backend/.../modules/shop/ShopDeliveryConfig.java` | Modified | Entity: Adds `deliveryEnabled` master toggle |
| `backend/.../modules/shop/ShopRepository.java` | Modified | Spatial queries for nearest bakeries |
| `backend/.../modules/shop/dto/ShopDeliveryConfigRequest.java` | Modified | Exposes `deliveryEnabled` toggle in owner updates |
| `backend/.../modules/shop/service/OwnerStorefrontService.java` | Modified | Manages delivery availability configuration |
| `backend/.../modules/shop/service/ShopService.java` | Modified | Bakery registration coordinate validation |
| `backend/.../modules/storefront/CustomerStorefrontController.java` | Modified | Exposes `POST /api/storefront/shops/{id}/quote` |
| `backend/.../modules/storefront/CustomerStorefrontService.java` | Modified | Authoritative quote calculation & checkout price validation |
| `backend/.../modules/storefront/dto/GuestOrderRequest.java` | Modified | Adds `fulfillmentMethod`, `expectedTotal`, `confirmPriceChange` |
| `backend/.../security/RateLimitingFilter.java` | Modified | Rate limiting exemption for `/quote` endpoint |
| `backend/src/main/resources/application.yml` | Modified | Geocoding service configuration defaults |

### 3.2 Category 2: Database Migrations (2 files)
| File Path | Status | SHA-256 Checksum | Purpose |
|---|---|---|---|
| `backend/.../db/migration/V51__add_unique_provider_payment_id.sql` | Untracked | `658AA70714154686C534610BC5D4148EB04AE389A2CA5E918A7E2613174E3835` | Partial unique index on `payments(provider_payment_id)` |
| `backend/.../db/migration/V52__add_delivery_consistency_fields.sql` | Untracked | `25017D097404199822B48076A65E3819220B2F5340D8D852CE826F318384BE37` | `delivery_enabled` column & `fulfillment_method` column |

### 3.3 Category 3: Backend Test Suites (9 files)
| File Path | Status | Test Scope |
|---|---|---|
| `backend/.../order/scheduler/DelayedPaymentConfirmationRegressionTest.java` | Untracked | 10 regression tests for webhook idempotency & late payments |
| `backend/.../storefront/DeliveryFeeConsistencyRegressionTest.java` | Untracked | 4 unit tests verifying quote calculation & pickup fee = 0 |
| `backend/.../storefront/LocationDiscoveryUnitTest.java` | Untracked | 22 unit tests for geocoding & location registration |
| `backend/.../e2e/Day3Phase2E2ETest.java` | Modified | 4 E2E customer journey tests (isolated mock delivery config) |
| `backend/.../order/scheduler/StorefrontExpiryTest.java` | Modified | 5 scheduler capacity & order expiry tests |
| `backend/.../order/service/CustomCakeOrderLifecycleSyncTest.java` | Modified | Lifecycle transitions for custom cake orders |
| `backend/.../payment/controller/CustomerPaymentControllerTest.java` | Modified | Payment controller endpoints & Razorpay signature verify |
| `backend/.../storefront/StorefrontCacheSubscriptionTest.java` | Modified | Cache eviction & subscription status caching |
| `backend/.../storefront/StorefrontCapacityTest.java` | Modified | 3 capacity locking & concurrency tests |

### 3.4 Category 4: Frontend Production Code & Tests (31 files)
| File Path | Status | Purpose |
|---|---|---|
| `frontend_v2/components/owner/InteractiveLocationMap.tsx` | Untracked | Interactive Leaflet pin-drop map for bakery location |
| `frontend_v2/__tests__/checkoutCartHydration.test.mjs` | Untracked | Cart hydration & coupon persistence unit tests |
| `frontend_v2/__tests__/deliveryFeeConsistency.test.mjs` | Untracked | Quote API client & delivery consistency unit tests |
| `frontend_v2/__tests__/locationDiscoveryAndDistance.test.mjs` | Untracked | Geocoding & distance calculation unit tests |
| `frontend_v2/__tests__/locationRegistrationCompletion.test.mjs` | Untracked | Bakery location registration flow tests |
| `frontend_v2/__tests__/phase2dUiImprovements.test.mjs` | Untracked | UI enhancements & modal layout tests |
| `frontend_v2/__tests__/storefrontSearchResponseHandling.test.mjs` | Untracked | Search response normalization tests |
| `frontend_v2/app/admin/shops/page.tsx` | Modified | Bakery suspension management |
| `frontend_v2/app/checkout/page.tsx` | Modified | Standalone checkout quote integration |
| `frontend_v2/app/explore/page.tsx` | Modified | Distance filtering on marketplace |
| `frontend_v2/app/onboarding/page.tsx` | Modified | Bakery onboarding map integration |
| `frontend_v2/app/orders/[orderNumber]/page.tsx` | Modified | Guest order tracking financial breakdown |
| `frontend_v2/components/admin/shops/AdminSuspensionModal.tsx` | Modified | Admin suspension confirmation modal |
| `frontend_v2/components/customer/marketplace/BakeryCard.tsx` | Modified | Distance badge on bakery card |
| `frontend_v2/components/customer/marketplace/BakeryGrid.tsx` | Modified | Marketplace sorting by distance |
| `frontend_v2/components/customer/storefront/CartDrawer.tsx` | Modified | Free delivery threshold progress bar |
| `frontend_v2/components/customer/storefront/StorefrontNavbar.tsx` | Modified | Storefront navigation & location indicator |
| `frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx` | Modified | Fulfillment selector (Pickup vs Delivery), quote call, price mismatch modal |
| `frontend_v2/components/customer/storefront/tabs/StorefrontTrackOrderTab.tsx` | Modified | Authoritative financial breakdown & fulfillment display |
| `frontend_v2/components/owner/OrderDetailsModal.tsx` | Modified | Subtotal, delivery fee, and pickup status in owner view |
| `frontend_v2/components/owner/ProductModal.tsx` | Modified | Product image upload validation |
| `frontend_v2/components/owner/settings/ProfileTab.tsx` | Modified | Bakery profile location map picker |
| `frontend_v2/components/owner/storefront/DeliverySettingsSection.tsx` | Modified | Master delivery availability toggle switch |
| `frontend_v2/context/CartContext.tsx` | Modified | Cart hydration & state synchronization |
| `frontend_v2/lib/api/storefront.ts` | Modified | `calculateQuote` API client function |
| `frontend_v2/package-lock.json` | Modified | Locked dependency tree (includes leaflet) |
| `frontend_v2/package.json` | Modified | Added `leaflet` and `@types/leaflet` |
| `frontend_v2/types/order.ts` | Modified | Added `fulfillmentMethod` to `Order` |
| `frontend_v2/types/owner.ts` | Modified | Added delivery settings types |
| `frontend_v2/types/shop.ts` | Modified | Added `deliveryConfig` to `StorefrontShopResponse` |
| `frontend_v2/types/storefrontManagement.ts` | Modified | Added `deliveryEnabled` to `ShopDeliveryConfig` |

### 3.5 Category 5: Documentation & Audit Reports (22 files)
All located in repository root:
- `CAKESTORE_COMPREHENSIVE_PRODUCT_AND_MARKET_AUDIT.md`
- `CAKESTORE_DELIVERY_FEE_MISMATCH_FIX_REPORT.md`
- `CAKESTORE_ENCRYPTION_PHASE2_3_CONFIGURATION_DISCOVERY.md`
- `CAKESTORE_FINAL_GAP_ANALYSIS.md`
- `CAKESTORE_FINAL_PRE_DEPLOYMENT_GATE.md`
- `CAKESTORE_GIT_RECONCILIATION_REPORT.md`
- `CAKESTORE_LOCATION_DISCOVERY_AUDIT.md`
- `CAKESTORE_LOCATION_DISCOVERY_IMPLEMENTATION_REPORT.md`
- `CAKESTORE_LOCATION_REGISTRATION_COMPLETION_REPORT.md`
- `CAKESTORE_MARKETPLACE_CUSTOMER_EXPERIENCE_AUDIT.md`
- `CAKESTORE_PAID_ORDER_EXPIRY_FIX_REPORT.md`
- `CAKESTORE_PAYMENT_RECOVERY_REMEDIATION_REPORT.md`
- `CAKESTORE_PAYMENT_RECOVERY_SAFETY_REVIEW.md`
- `CAKESTORE_PHASE1B_CONSTRUCTOR_FIX_REPORT.md`
- `CAKESTORE_PHASE1C_TEST_FIXTURE_REPORT.md`
- `CAKESTORE_PHASE2A_PRELAUNCH_VERIFICATION.md`
- `CAKESTORE_PHASE2C_PRODUCT_QUALITY_AUDIT.md`
- `CAKESTORE_PHASE2D_UI_IMPROVEMENTS_REPORT.md`
- `CAKESTORE_POST_DELIVERY_FIX_RELEASE_AUDIT.md`
- `CAKESTORE_PRE_COMMIT_RELEASE_GATE_REPORT.md`
- `CAKESTORE_PRODUCTION_READINESS_REPORT.md`
- `CAKESTORE_RELEASE_PREPARATION_REPORT.md`

---

## 4. Phase 1C Verification & Production Integrity Confirmation

A strict line-by-line inspection confirms:
1. **Production Code Untouched**:
   - `CustomerStorefrontService.java` lines 926–928:
     ```java
     if (request.getDeliveryAddress() == null || request.getDeliveryAddress().trim().isEmpty()) {
         throw new IllegalArgumentException("Delivery street address is required for home delivery");
     }
     ```
     This validation remains unaltered, active, and strictly enforced.
2. **Phase 1C Edits Strictly Confined to Tests**:
   - `Day3Phase2E2ETest.java`: Added dummy addresses to test requests; added mock `ShopDeliveryConfigRepository` so the test's subtotal of ₹1,000.00 evaluates against a ₹2,000.00 free delivery threshold, preserving the original ₹50.00 delivery fee assertion.
   - `DelayedPaymentConfirmationRegressionTest.java`: Added dummy addresses to order requests for slot retention and cancellation tests.
   - `StorefrontCapacityTest.java`: Added dummy addresses to order requests in capacity consumption, multi-threaded checkout, and order cancellation tests.
   - `StorefrontExpiryTest.java`: Added dummy addresses to order requests in capacity preservation tests.
3. **Negative Test Cases Preserved**:
   - Unit tests explicitly asserting that a missing delivery address throws an exception continue to pass without modification.

---

## 5. Database & Flyway Migration Check

- **Migration Files Checked**:
  - `V51__add_unique_provider_payment_id.sql`: SHA-256 = `658AA70714154686C534610BC5D4148EB04AE389A2CA5E918A7E2613174E3835`
  - `V52__add_delivery_consistency_fields.sql`: SHA-256 = `25017D097404199822B48076A65E3819220B2F5340D8D852CE826F318384BE37`
- **Tamper Verification**: SHA-256 hashes match `backup_manifest_sha256.csv` in the release checkpoint byte-for-byte.
- **Migration History**: Both migrations applied cleanly during integration tests; Flyway reported: `Schema "public" is up to date. No migration necessary.`
- **Flyway Checksum Safety**: Neither V51 nor V52 has been modified after execution. No checksum mismatches or startup locks exist.

---

## 6. Review of Production Deployment Blockers & Operational Risks

To ensure total transparency, all items are classified as **Verified Fact**, **Report-Derived Claim**, or **Unverifiable Locally**.

| Area | Status / Classification | Technical Finding | Pre-Deployment Requirement |
|---|---|---|---|
| **Spring Boot Context Startup** | **VERIFIED FACT** | Constructor wiring fix (`@Autowired` on primary constructor) verified across all tests; 876/876 passed. | None — Resolved. |
| **Delivery Fee Consistency** | **VERIFIED FACT** | Authoritative server quote calculation and client price mismatch validation (HTTP 409) verified across unit and integration tests. | None — Resolved. |
| **Razorpay Webhook Idempotency** | **VERIFIED FACT** | Partial unique index on `payments(provider_payment_id)` and concurrency handlers verified in `DelayedPaymentConfirmationRegressionTest`. | None — Resolved. |
| **Actuator Health Probes** | **VERIFIED FACT** | `management.endpoint.health.probes.enabled: true` in `application.yml`; `/actuator/health/liveness` and `/actuator/health/readiness` exposed. | Configure Container App probes to hit `/actuator/health/liveness` and `/readiness`. |
| **Azure Production Profile & Secrets** | **UNVERIFIABLE LOCALLY** | Code relies on environment variables (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`). Secret values cannot be verified without Azure portal access. | Verify Azure Container App environment variables are populated prior to container startup. |
| **CORS Origins** | **REPORT-DERIVED CLAIM** | Default in `application.yml` is `localhost:3000,3001,3002`. In production, `CORS_ALLOWED_ORIGINS` must include the production frontend domain (e.g. Vercel domain). | Ensure `CORS_ALLOWED_ORIGINS` environment variable is set on the Azure Container App. |
| **Razorpay Key/Mode Consistency** | **UNVERIFIABLE LOCALLY** | Code correctly handles test and live Razorpay webhooks and signatures. Gateway key mode (live `rzp_live_...` vs test `rzp_test_...`) cannot be verified locally. | Verify that production frontend Razorpay key ID matches backend `RAZORPAY_KEY_ID` and webhook secret matches the Razorpay dashboard. |
| **Email Sender Verification** | **REPORT-DERIVED CLAIM** | Default `mail.from-address` is `onboarding@resend.dev`. Resend restricts `onboarding@resend.dev` to sending only to the account owner's email address. | In production, `MAIL_FROM_ADDRESS` must use a verified domain in Resend to send to customer emails. |
| **SMS / DLT Readiness** | **VERIFIED FACT** | `SmsService.java` operates as a mock logger (`Mock SMS (Local Dev)`). No live SMS gateway (Twilio, MSG91, Fast2SMS) or Indian DLT registration is configured. | Non-blocking for beta launch; customer OTPs and order status updates will be logged to server stdout rather than dispatched via SMS. |
| **File-Upload Persistence** | **REPORT-DERIVED CLAIM** | Default `app.storage.provider` is `local` (saves to container `uploads/`). In Azure Container Apps, container local storage is ephemeral. | Ensure `APP_STORAGE_PROVIDER: azure` and Azure Storage credentials (`AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_PUBLIC_CONTAINER`) are set on the Azure Container App. |
| **Demo Data Seeding** | **VERIFIED FACT** | `app.demo-data.enabled: ${APP_DEMO_DATA_ENABLED:true}` defaults to `true`. | In production, `APP_DEMO_DATA_ENABLED` must be explicitly set to `false` to avoid seeding demo shops/users on each restart. |
| **Database Backup & Rollback** | **UNVERIFIABLE LOCALLY** | V51 and V52 add non-destructive columns and indexes. Rollback script exists logically, but Azure PostgreSQL automated snapshot status cannot be verified locally. | Take an on-demand PostgreSQL backup snapshot in Azure prior to running migrations. |

---

## 7. Proposed Three-Commit Release Manifest

To ensure atomic, clean, and reviewable version control history, changes should be staged using exact file paths (avoiding `git add .`):

### Commit 1: Backend Architecture, Migrations & Test Suites
**Suggested Commit Message**:
```
fix(backend): delivery fee consistency, location constructor injection, and payment idempotency

- Add PriceMismatchException and server-side quote calculation endpoint
- Add V51 unique provider payment id migration and V52 delivery consistency fields migration
- Fix NominatimGeocodingService constructor autowiring for Spring context bootstrap
- Add DeliveryFeeConsistencyRegressionTest, LocationDiscoveryUnitTest, and payment regression tests
- Update legacy test fixtures in Day3Phase2E2ETest, StorefrontCapacityTest, and StorefrontExpiryTest
```
**Exact Files (36 files)**:
```
# Migrations (2)
backend/src/main/resources/db/migration/V51__add_unique_provider_payment_id.sql
backend/src/main/resources/db/migration/V52__add_delivery_consistency_fields.sql

# Production Code & DTOs (25)
backend/src/main/java/com/cakeplatform/api/config/GlobalExceptionHandler.java
backend/src/main/java/com/cakeplatform/api/exception/PriceMismatchException.java
backend/src/main/java/com/cakeplatform/api/modules/auth/service/AuthService.java
backend/src/main/java/com/cakeplatform/api/modules/location/controller/LocationReferenceController.java
backend/src/main/java/com/cakeplatform/api/modules/location/dto/GeocodeResultDTO.java
backend/src/main/java/com/cakeplatform/api/modules/location/service/GeocodingService.java
backend/src/main/java/com/cakeplatform/api/modules/location/service/NominatimGeocodingService.java
backend/src/main/java/com/cakeplatform/api/modules/order/Order.java
backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java
backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java
backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java
backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java
backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java
backend/src/main/java/com/cakeplatform/api/modules/shop/ShopDeliveryConfig.java
backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java
backend/src/main/java/com/cakeplatform/api/modules/shop/dto/ShopDeliveryConfigRequest.java
backend/src/main/java/com/cakeplatform/api/modules/shop/service/OwnerStorefrontService.java
backend/src/main/java/com/cakeplatform/api/modules/shop/service/ShopService.java
backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java
backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java
backend/src/main/java/com/cakeplatform/api/modules/storefront/dto/GuestOrderRequest.java
backend/src/main/java/com/cakeplatform/api/modules/storefront/dto/StorefrontQuoteRequest.java
backend/src/main/java/com/cakeplatform/api/modules/storefront/dto/StorefrontQuoteResponse.java
backend/src/main/java/com/cakeplatform/api/security/RateLimitingFilter.java
backend/src/main/resources/application.yml

# Backend Tests (9)
backend/src/test/java/com/cakeplatform/api/modules/e2e/Day3Phase2E2ETest.java
backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/DelayedPaymentConfirmationRegressionTest.java
backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/StorefrontExpiryTest.java
backend/src/test/java/com/cakeplatform/api/modules/order/service/CustomCakeOrderLifecycleSyncTest.java
backend/src/test/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentControllerTest.java
backend/src/test/java/com/cakeplatform/api/modules/storefront/DeliveryFeeConsistencyRegressionTest.java
backend/src/test/java/com/cakeplatform/api/modules/storefront/LocationDiscoveryUnitTest.java
backend/src/test/java/com/cakeplatform/api/modules/storefront/StorefrontCacheSubscriptionTest.java
backend/src/test/java/com/cakeplatform/api/modules/storefront/StorefrontCapacityTest.java
```

---

### Commit 2: Frontend Storefront, Checkout & Owner Dashboard
**Suggested Commit Message**:
```
feat(frontend): quote calculation, fulfillment selector, and location map

- Add fulfillment method selector (Doorstep Delivery vs Bakery Pickup) in checkout tab
- Integrate live quote calculation API and Price Mismatch Confirmation Modal
- Add master delivery toggle in owner storefront settings
- Add InteractiveLocationMap with Leaflet coordinate selection
- Add frontend unit test suites covering delivery consistency and location registration
```
**Exact Files (31 files)**:
```
# Dependencies & Types (7)
frontend_v2/package.json
frontend_v2/package-lock.json
frontend_v2/types/order.ts
frontend_v2/types/owner.ts
frontend_v2/types/shop.ts
frontend_v2/types/storefrontManagement.ts
frontend_v2/lib/api/storefront.ts

# State & App Pages (6)
frontend_v2/context/CartContext.tsx
frontend_v2/app/checkout/page.tsx
frontend_v2/app/explore/page.tsx
frontend_v2/app/onboarding/page.tsx
frontend_v2/app/orders/[orderNumber]/page.tsx
frontend_v2/app/admin/shops/page.tsx

# Components (12)
frontend_v2/components/owner/InteractiveLocationMap.tsx
frontend_v2/components/admin/shops/AdminSuspensionModal.tsx
frontend_v2/components/customer/marketplace/BakeryCard.tsx
frontend_v2/components/customer/marketplace/BakeryGrid.tsx
frontend_v2/components/customer/storefront/CartDrawer.tsx
frontend_v2/components/customer/storefront/StorefrontNavbar.tsx
frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx
frontend_v2/components/customer/storefront/tabs/StorefrontTrackOrderTab.tsx
frontend_v2/components/owner/OrderDetailsModal.tsx
frontend_v2/components/owner/ProductModal.tsx
frontend_v2/components/owner/settings/ProfileTab.tsx
frontend_v2/components/owner/storefront/DeliverySettingsSection.tsx

# Frontend Tests (6)
frontend_v2/__tests__/checkoutCartHydration.test.mjs
frontend_v2/__tests__/deliveryFeeConsistency.test.mjs
frontend_v2/__tests__/locationDiscoveryAndDistance.test.mjs
frontend_v2/__tests__/locationRegistrationCompletion.test.mjs
frontend_v2/__tests__/phase2dUiImprovements.test.mjs
frontend_v2/__tests__/storefrontSearchResponseHandling.test.mjs
```

---

### Commit 3: Release & Audit Documentation
**Suggested Commit Message**:
```
docs: add release audit, pre-deployment gate, and test verification reports
```
**Exact Files (22 files)**:
```
CAKESTORE_COMPREHENSIVE_PRODUCT_AND_MARKET_AUDIT.md
CAKESTORE_DELIVERY_FEE_MISMATCH_FIX_REPORT.md
CAKESTORE_ENCRYPTION_PHASE2_3_CONFIGURATION_DISCOVERY.md
CAKESTORE_FINAL_GAP_ANALYSIS.md
CAKESTORE_FINAL_PRE_DEPLOYMENT_GATE.md
CAKESTORE_GIT_RECONCILIATION_REPORT.md
CAKESTORE_LOCATION_DISCOVERY_AUDIT.md
CAKESTORE_LOCATION_DISCOVERY_IMPLEMENTATION_REPORT.md
CAKESTORE_LOCATION_REGISTRATION_COMPLETION_REPORT.md
CAKESTORE_MARKETPLACE_CUSTOMER_EXPERIENCE_AUDIT.md
CAKESTORE_PAID_ORDER_EXPIRY_FIX_REPORT.md
CAKESTORE_PAYMENT_RECOVERY_REMEDIATION_REPORT.md
CAKESTORE_PAYMENT_RECOVERY_SAFETY_REVIEW.md
CAKESTORE_PHASE1B_CONSTRUCTOR_FIX_REPORT.md
CAKESTORE_PHASE1C_TEST_FIXTURE_REPORT.md
CAKESTORE_PHASE1D_RELEASE_CANDIDATE_REVIEW.md
CAKESTORE_PHASE2A_PRELAUNCH_VERIFICATION.md
CAKESTORE_PHASE2C_PRODUCT_QUALITY_AUDIT.md
CAKESTORE_PHASE2D_UI_IMPROVEMENTS_REPORT.md
CAKESTORE_POST_DELIVERY_FIX_RELEASE_AUDIT.md
CAKESTORE_PRE_COMMIT_RELEASE_GATE_REPORT.md
CAKESTORE_PRODUCTION_READINESS_REPORT.md
CAKESTORE_RELEASE_PREPARATION_REPORT.md
```
*(Recommendation: These markdown files can remain at root or be moved into a `docs/` folder in a future reorganization. All are currently excluded from the Docker container build via `.dockerignore`)*.

---

## 8. Pre-Merge & Post-Deployment Smoke-Test Checklists

### 8.1 Pre-Merge Validation Checklist (Local Environment)
- [x] Full Backend Verification: `mvn clean verify` passes with 876/876 (Exit 0).
- [x] Frontend Test Suites: `npm test` in `frontend_v2` passes 200/200 (Exit 0).
- [x] TypeScript Static Check: `npx tsc --noEmit` in `frontend_v2` reports 0 errors (Exit 0).
- [x] Production Build: `npm run build` in `frontend_v2` generates 38 routes without errors (Exit 0).
- [x] Checkpoint Preserved: Release checkpoint at `scratch/release_checkpoint_20261022_2046` verified.
- [ ] Working Tree Staged & Committed: Execute proposed 3-commit release manifest.
- [ ] Merge Execution: Merge `development` into `main` using fast-forward or standard merge commit.
- [ ] Push to Remote: Push `main` to `origin/main` to trigger GitHub Actions CI/CD.

### 8.2 Post-Deployment Smoke-Test Checklist (Production / Staging Environment)
Once deployed to Azure Container Apps and Vercel:

1. **Container & Health Probes**:
   - Query `GET https://<api-domain>/actuator/health` — Expect `{"status":"UP"}`.
   - Query `GET https://<api-domain>/actuator/health/readiness` — Expect `{"status":"UP"}`.
2. **Flyway Migration Verification**:
   - Inspect container startup logs — Verify V51 and V52 show `Successfully applied 2 migrations`.
   - Verify index `idx_payments_provider_payment_id` exists on `payments`.
3. **Storefront Quote API**:
   - Dispatch `POST /api/storefront/shops/{shopId}/quote` with test cart items.
   - Test `fulfillmentMethod: "SELF_PICKUP"` — Verify delivery fee is ₹0.00.
   - Test `fulfillmentMethod: "HOME_DELIVERY"` with subtotal < threshold — Verify fixed delivery charge is applied.
   - Test `fulfillmentMethod: "HOME_DELIVERY"` with subtotal >= threshold — Verify delivery charge is ₹0.00.
4. **Checkout Price Mismatch Modal**:
   - In browser storefront, place a test order with intentional price drift.
   - Verify HTTP 409 Conflict is returned and the frontend displays the Price Mismatch Confirmation Modal showing old vs authoritative price.
5. **Bakery Self-Pickup vs Home Delivery**:
   - In owner settings, toggle delivery disabled.
   - Verify storefront shows delivery disabled and forces self-pickup.
6. **Razorpay Payment Recovery**:
   - Verify Razorpay checkout modal opens with correct paise amount.
   - Dispatch test captured webhook — Verify order transitions to `CONFIRMED` and `PAID`.
   - Test late payment on cancelled order — Verify order remains `CANCELLED` and triggers reconciliation alert.
7. **Interactive Location Map**:
   - Open owner bakery profile settings — Verify Leaflet map renders without CORS/tile loading errors.
   - Drag or click pin — Verify latitude/longitude coordinates update and save.

---

## 9. Next Action & Release Authorization

All checks and verifications have been conducted strictly in **READ-ONLY** mode. No files were modified, committed, merged, or pushed.

The codebase is technically validated and ready for Git release operations.

**Awaiting user authorization to proceed with committing the proposed 3-commit release manifest.**
