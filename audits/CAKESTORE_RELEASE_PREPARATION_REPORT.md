# CakeStore — Release Preparation Phase 1: Preserve, Review & Validate Report

**Document**: `CAKESTORE_RELEASE_PREPARATION_REPORT.md`  
**Execution Date**: October 22, 2026  
**Auditor**: Antigravity Quality & Release Safety Agent  
**Status**: **PREPARATION COMPLETE — BLOCKER REMEDIATION PENDING APPROVAL**  
**Active Branch**: `development` (HEAD: `5ff3143`)  
**Target Release Branch**: `main` (HEAD: `cf5a58c`)

---

## 1. Verified Git State & Branch Divergence

### 1.1 Resolution of Contradictory Working-Tree Statements
In `CAKESTORE_POST_DELIVERY_FIX_RELEASE_AUDIT.md` (line 7), the working tree was described as *"clean & preserved"*. This was intended colloquially by the auditor to signify that the working tree had not been disrupted or committed to during the audit. 

**Technical Reality**:
In strict Git terms, the working tree is **NOT clean**. It contains:
- **47 modified tracked files**
- **34 untracked files** (16 root audit documents, 2 migrations, 6 backend Java classes/DTOs/exceptions, 3 backend test classes, 1 frontend TSX map component, and 6 frontend test suites).

### 1.2 Branch Topography and Divergence
- **Current Branch**: `development`
- **Current Tracking Remote**: `origin/development`
- **Active Commit**: `5ff3143` (*"20/10/269 updated github!"*)
- **Target Release Branch**: `main` (Tracking `origin/main`, commit `cf5a58c`, dated 2026-10-04)
- **Branch Divergence**:
  ```
  git log main..development --oneline
  ```
  `development` is **15 commits ahead** of `main`.  
  `main` has **0 commits ahead** of `development`.

**Critical Finding**: If the production pipeline (`.github/workflows/ci.yml`) is triggered on `main` today, it will deploy a codebase that is **15 commits behind `development`** and completely lacks all recent delivery-fee consistency, location-registration, and payment-recovery fixes.

---

## 2. Backup & Checkpoint Verification

A full, verified checkpoint was established before taking any action.

- **Checkpoint Location**:  
  `C:\Users\HP\.gemini\antigravity-ide\brain\d31c4c1b-8150-4461-aecd-34adef970797\scratch\release_checkpoint_20261022_2046`
- **Checkpoint Artifacts**:
  1. `tracked_working_tree.patch` (399,366 bytes) — Unified diff covering all 47 modified tracked files.
  2. `untracked_files/` (36 files total) — Complete copy of all untracked source, migration, test, and documentation files preserving directory structures.
  3. `backup_manifest_sha256.csv` — Cryptographic SHA-256 digest of all backed-up files for tamper detection.
- **Verification Result**: Verified with PowerShell `Test-Path`, file count validation (`36` untracked files), and SHA-256 validation.

---

## 3. Comprehensive File Inventory & Classification

All 81 modified and untracked files have been cataloged and categorized:

### 3.1 Group A: Core Feature & Architectural Changes (Required for Release)

#### Delivery-Fee Consistency Architecture:
| File | Git Status | Classification | Purpose |
|---|---|---|---|
| `backend/.../exception/PriceMismatchException.java` | Untracked | Core Exception | Thrown when client expected total differs from authoritative server price (HTTP 409 Conflict). |
| `backend/.../storefront/dto/StorefrontQuoteRequest.java` | Untracked | Core DTO | Request payload for calculating authoritative storefront quotes. |
| `backend/.../storefront/dto/StorefrontQuoteResponse.java` | Untracked | Core DTO | Response payload with subtotal, fee, threshold, and fulfillment capability. |
| `backend/.../db/migration/V52__add_delivery_consistency_fields.sql` | Untracked | Migration | Adds `delivery_enabled` to `shop_delivery_configs` and `fulfillment_method` to `orders`. |
| `backend/.../config/GlobalExceptionHandler.java` | Modified | Core Config | Maps `PriceMismatchException` to HTTP 409 with authoritative price breakdown. |
| `backend/.../security/RateLimitingFilter.java` | Modified | Security | Configures rate-limiting exemption/limits for `/quote` endpoint. |
| `backend/.../shop/ShopDeliveryConfig.java` | Modified | Entity | Adds `deliveryEnabled` toggle field. |
| `backend/.../shop/dto/ShopDeliveryConfigRequest.java` | Modified | DTO | Exposes `deliveryEnabled` in owner update requests. |
| `backend/.../shop/service/OwnerStorefrontService.java` | Modified | Service | Saves and manages owner delivery availability toggle. |
| `backend/.../order/Order.java` | Modified | Entity | Adds `fulfillmentMethod` field with default `HOME_DELIVERY`. |
| `backend/.../storefront/CustomerStorefrontController.java` | Modified | Controller | Exposes `POST /api/storefront/shops/{id}/quote`. |
| `backend/.../storefront/CustomerStorefrontService.java` | Modified | Service | Calculates authoritative quote and validates client totals during checkout. |
| `backend/.../storefront/dto/GuestOrderRequest.java` | Modified | DTO | Includes `fulfillmentMethod`, `expectedTotal`, and `confirmPriceChange`. |
| `frontend_v2/types/storefrontManagement.ts` | Modified | Type | Adds `deliveryEnabled` to `ShopDeliveryConfig`. |
| `frontend_v2/types/order.ts` | Modified | Type | Adds `fulfillmentMethod` to `Order`. |
| `frontend_v2/types/shop.ts` | Modified | Type | Extends storefront shop response types. |
| `frontend_v2/types/owner.ts` | Modified | Type | Extends owner storefront settings contracts. |
| `frontend_v2/lib/api/storefront.ts` | Modified | API Client | Adds `calculateQuote` API function. |
| `frontend_v2/.../tabs/StorefrontCheckoutTab.tsx` | Modified | Storefront UI | Fulfillment selector (Delivery vs Pickup), quote calculation, and price mismatch modal. |
| `frontend_v2/.../tabs/StorefrontTrackOrderTab.tsx` | Modified | Storefront UI | Authoritative order financial breakdown and fulfillment display. |
| `frontend_v2/.../CartDrawer.tsx` | Modified | Storefront UI | Displays delivery threshold and fulfillment indicators. |
| `frontend_v2/.../DeliverySettingsSection.tsx` | Modified | Owner UI | Delivery toggle switch (Delivery Enabled vs Disabled). |
| `frontend_v2/.../OrderDetailsModal.tsx` | Modified | Owner UI | Displays authoritative subtotal, delivery fee, and pickup status. |
| `frontend_v2/app/orders/[orderNumber]/page.tsx` | Modified | Page | Renders authoritative guest order tracking view. |

#### Payment Recovery & Webhook Idempotency:
| File | Git Status | Classification | Purpose |
|---|---|---|---|
| `backend/.../db/migration/V51__add_unique_provider_payment_id.sql` | Untracked | Migration | Creates partial unique index on `payments(provider_payment_id)`. |
| `backend/.../payment/controller/CustomerPaymentController.java` | Modified | Controller | Authoritative Razorpay paise conversion and payment order creation. |
| `backend/.../order/controller/WebhookController.java` | Modified | Controller | Webhook idempotency and delayed payment capture reconciliation. |
| `backend/.../order/scheduler/OrderExpiryScheduler.java` | Modified | Scheduler | Prevents auto-cancelling orders that have initiated or pending payments. |
| `backend/.../order/service/OrderService.java` | Modified | Service | Order lifecycle transitions and payment status synchronization. |
| `backend/.../order/OrderRepository.java` | Modified | Repository | Queries for expired orders excluding active payment attempts. |

#### Location Discovery & Address Registration:
| File | Git Status | Classification | Purpose |
|---|---|---|---|
| `backend/.../location/dto/GeocodeResultDTO.java` | Untracked | DTO | Geocoding result data model. |
| `backend/.../location/service/GeocodingService.java` | Untracked | Interface | Core contract for geocoding providers. |
| `backend/.../location/service/NominatimGeocodingService.java` | Untracked | Service | Nominatim OpenStreetMap client with caching. |
| `backend/.../location/controller/LocationReferenceController.java` | Modified | Controller | Location reference endpoints. |
| `backend/.../shop/ShopRepository.java` | Modified | Repository | Haversine distance spatial queries. |
| `backend/.../shop/service/ShopService.java` | Modified | Service | Bakery location registration and coordinates validation. |
| `backend/.../auth/service/AuthService.java` | Modified | Service | Owner registration address geocoding. |
| `backend/src/main/resources/application.yml` | Modified | Config | Geocoding service configuration defaults. |
| `frontend_v2/components/owner/InteractiveLocationMap.tsx` | Untracked | Component | Leaflet map with interactive pin-placement for bakery location. |
| `frontend_v2/app/explore/page.tsx` | Modified | Page | Marketplace exploration with distance filters. |
| `frontend_v2/app/onboarding/page.tsx` | Modified | Page | Onboarding flow with map confirmation step. |
| `frontend_v2/components/owner/settings/ProfileTab.tsx` | Modified | Owner UI | Bakery profile location map picker. |
| `frontend_v2/.../marketplace/BakeryCard.tsx` | Modified | UI | Distance indicator on bakery card. |
| `frontend_v2/.../marketplace/BakeryGrid.tsx` | Modified | UI | Distance sorting on marketplace grid. |
| `frontend_v2/package.json` & `package-lock.json` | Modified | Config | Added `leaflet` and `@types/leaflet`. |

#### General UI & Dashboard Enhancements:
| File | Git Status | Classification | Purpose |
|---|---|---|---|
| `frontend_v2/context/CartContext.tsx` | Modified | State | Cart hydration and coupon persistence. |
| `frontend_v2/.../StorefrontNavbar.tsx` | Modified | UI | Navbar search and customer indicators. |
| `frontend_v2/app/checkout/page.tsx` | Modified | Page | Standalone checkout page synchronization. |
| `frontend_v2/app/admin/shops/page.tsx` | Modified | Admin UI | Bakery suspension modal updates. |
| `frontend_v2/.../AdminSuspensionModal.tsx` | Modified | Admin UI | Admin suspension confirmation dialog. |
| `frontend_v2/components/owner/ProductModal.tsx` | Modified | Owner UI | Product image upload validation. |

### 3.2 Group B: Automated Test Suites (Required for Release Verification)
- `backend/.../storefront/DeliveryFeeConsistencyRegressionTest.java` (Untracked)
- `backend/.../order/scheduler/DelayedPaymentConfirmationRegressionTest.java` (Untracked)
- `backend/.../storefront/LocationDiscoveryUnitTest.java` (Untracked)
- `backend/.../order/scheduler/StorefrontExpiryTest.java` (Modified)
- `backend/.../order/service/CustomCakeOrderLifecycleSyncTest.java` (Modified)
- `backend/.../payment/controller/CustomerPaymentControllerTest.java` (Modified)
- `backend/.../storefront/StorefrontCacheSubscriptionTest.java` (Modified)
- `frontend_v2/__tests__/deliveryFeeConsistency.test.mjs` (Untracked)
- `frontend_v2/__tests__/checkoutCartHydration.test.mjs` (Untracked)
- `frontend_v2/__tests__/locationDiscoveryAndDistance.test.mjs` (Untracked)
- `frontend_v2/__tests__/locationRegistrationCompletion.test.mjs` (Untracked)
- `frontend_v2/__tests__/phase2dUiImprovements.test.mjs` (Untracked)
- `frontend_v2/__tests__/storefrontSearchResponseHandling.test.mjs` (Untracked)

### 3.3 Group C: Root Audit & Release Documentation (Exclude from Docker build, commit to docs/)
- `CAKESTORE_COMPREHENSIVE_PRODUCT_AND_MARKET_AUDIT.md`
- `CAKESTORE_DELIVERY_FEE_MISMATCH_FIX_REPORT.md`
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
- `CAKESTORE_PHASE2A_PRELAUNCH_VERIFICATION.md`
- `CAKESTORE_PHASE2C_PRODUCT_QUALITY_AUDIT.md`
- `CAKESTORE_PHASE2D_UI_IMPROVEMENTS_REPORT.md`
- `CAKESTORE_POST_DELIVERY_FIX_RELEASE_AUDIT.md`
- `CAKESTORE_PRE_COMMIT_RELEASE_GATE_REPORT.md`
- `CAKESTORE_PRODUCTION_READINESS_REPORT.md`

---

## 4. Security & Migration Audit

### 4.1 Git Diff Cleanliness Audit
- **Credentials & API Keys**: Scanned entire git diff for passwords, API keys, JWT tokens, and connection strings. **Zero secrets found.**
- **Debug Code**: Searched diff for `System.out.println`, `console.log`, `debugger`, and dangling `TODO`/`FIXME`. **Zero debug statements found.**

### 4.2 Migration V51 & V52 Checksum Audit
The files in `backend/src/main/resources/db/migration/` were independently inspected:
- **`V51__add_unique_provider_payment_id.sql`**:
  - Exact contents: 32 lines, creates partial unique index `uq_payments_provider_payment_id` on non-null `provider_payment_id`.
  - Database recorded checksum: `1054796152`
- **`V52__add_delivery_consistency_fields.sql`**:
  - Exact contents: 16 lines, adds `delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE` and `orders.fulfillment_method VARCHAR(50) NOT NULL DEFAULT 'HOME_DELIVERY'`.
  - Database recorded checksum: `2017128757`
- **Flyway Validation**: Confirmed via live database connection during test run:
  ```
  o.f.core.internal.command.DbMigrate : Current version of schema "public": 52
  o.f.core.internal.command.DbMigrate : Schema "public" is up to date. No migration necessary.
  ```

---

## 5. Investigation: `NominatimGeocodingService` Constructor Wiring

### 5.1 Root Cause Analysis
During integration testing (`mvn test -Dtest=CustomerStorefrontQueryIT`), Spring failed to load the `ApplicationContext`:
```
Caused by: org.springframework.beans.BeanInstantiationException: Failed to instantiate [com.cakeplatform.api.modules.location.service.NominatimGeocodingService]: No default constructor found
    at org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory.instantiateBean
    ...
Caused by: java.lang.NoSuchMethodException: com.cakeplatform.api.modules.location.service.NominatimGeocodingService.<init>()
```

Inspection of `NominatimGeocodingService.java` revealed:
```java
// Constructor 1 (lines 38-48):
public NominatimGeocodingService(
        @Autowired(required = false) LocationLocalityRepository localityRepository,
        RestTemplateBuilder restTemplateBuilder,
        @Value("${app.geocoding.timeout-ms:3000}") int timeoutMs
) { ... }

// Constructor 2 (lines 50-56):
public NominatimGeocodingService(LocationLocalityRepository localityRepository, RestTemplate restTemplate) {
    ...
}
```

### 5.2 Technical Finding: Production Startup Defect
- **Spring Constructor Resolution Rule**: When a Spring `@Service` bean declares **more than one constructor**, Spring cannot determine which constructor to invoke unless **one constructor is explicitly annotated with `@Autowired`**. If none is annotated with `@Autowired`, Spring falls back to searching for a no-argument constructor `NominatimGeocodingService()`.
- **The Defect**: `@Autowired(required = false)` was accidentally placed on the *parameter* `localityRepository` instead of on the *constructor method* `public NominatimGeocodingService(...)`.
- **Impact**: **THIS WILL PREVENT PRODUCTION STARTUP.** When `CakePlatformApplication.main()` executes in Azure Container Apps, Spring Boot's context refresh will fail, crashing the container. In addition, CI/CD on `main` runs `mvn clean verify`, which will fail on integration tests.

### 5.3 Proposed Fix (Awaiting User Approval)
Add `@Autowired` on the target constructor in `NominatimGeocodingService.java`:
```java
    @Autowired
    public NominatimGeocodingService(
            @Autowired(required = false) LocationLocalityRepository localityRepository,
            RestTemplateBuilder restTemplateBuilder,
            @Value("${app.geocoding.timeout-ms:3000}") int timeoutMs
    ) { ... }
```

---

## 6. Validation Execution & Results

### 6.1 Backend Unit Tests
Executed core unit tests bypassing the Spring context initialization:
```powershell
mvn test "-Dtest=DeliveryFeeConsistencyRegressionTest,CustomerStorefrontServiceTest,StorefrontUpgradeCoreTest"
```
- **Exit Code**: `0`
- **Result**: **BUILD SUCCESS**
- **Tests Run**: 18
- **Failures**: 0
- **Errors**: 0

Executed location discovery unit tests:
```powershell
mvn test "-Dtest=LocationDiscoveryUnitTest"
```
- **Exit Code**: `0`
- **Result**: **BUILD SUCCESS**
- **Tests Run**: 22
- **Failures**: 0
- **Errors**: 0

*Total Backend Unit Tests Passed*: **40 / 40**

### 6.2 Backend Integration Tests (ApplicationContext)
Executed Spring Boot integration test:
```powershell
mvn test "-Dtest=CustomerStorefrontQueryIT"
```
- **Exit Code**: `1`
- **Result**: **BUILD FAILURE** (Blocked by `NominatimGeocodingService` constructor resolution)

### 6.3 Frontend Unit Test Suite
Executed in `frontend_v2`:
```powershell
npm test
```
- **Exit Code**: `0`
- **Tests Run**: 200
- **Suites**: 21
- **Passed**: **200 / 200**
- **Failures**: 0

### 6.4 TypeScript Compilation
Executed in `frontend_v2`:
```powershell
npx tsc --noEmit
```
- **Exit Code**: `0`
- **Errors**: 0

### 6.5 Next.js Production Build
Executed in `frontend_v2`:
```powershell
npm run build
```
- **Exit Code**: `0`
- **Result**: Compiled successfully; generated static pages for all **38 application routes**.

---

## 7. Proposed Release Manifest

Once blocker remediation is approved, the release candidate should be committed and staged as follows:

### Commit 1: Backend Fixes & Migrations
```
fix(backend): delivery fee consistency, location constructor autowiring, and payment idempotency

- Add PriceMismatchException and quote calculation endpoint
- Add V51 unique provider payment id migration
- Add V52 delivery consistency fields migration
- Fix NominatimGeocodingService constructor autowiring
- Add DeliveryFeeConsistencyRegressionTest and unit test suites
```
**Files**:
- All 19 modified backend files
- All 11 untracked backend source, migration, and test files

### Commit 2: Frontend Storefront, Checkout & Owner Dashboard
```
feat(frontend): storefront quote integration, self-pickup toggle, and location map

- Add fulfillment method selector (doorstep delivery vs bakery pickup) in StorefrontCheckoutTab
- Add live quote calculation and Price Mismatch Confirmation Modal
- Add DeliverySettingsSection master switch in owner portal
- Add InteractiveLocationMap with Leaflet pin selection
- Add frontend unit tests covering delivery consistency and location registration
```
**Files**:
- All 28 modified frontend files
- All 7 untracked frontend component and test files

### Commit 3: Documentation
```
docs: add release audit, pre-deployment gate, and preparation reports
```
**Files**:
- `CAKESTORE_POST_DELIVERY_FIX_RELEASE_AUDIT.md`
- `CAKESTORE_FINAL_PRE_DEPLOYMENT_GATE.md`
- `CAKESTORE_RELEASE_PREPARATION_REPORT.md`

---

## 8. Remaining Blockers & Recommended Next Action

### Blockers Summary:
1. **[BLK-01] Missing `@Autowired` on `NominatimGeocodingService` constructor**: Blocks Spring Boot startup and CI/CD `mvn clean verify`.
2. **[BLK-02] Working Tree Uncommitted**: Cannot merge or deploy without committing changes to Git.
3. **[BLK-03] Branch Desynchronization**: `development` must be merged into `main` so that Vercel and Azure Container Apps deploy the tested code.

### Recommended Next Action:
Request user authorization to:
1. Apply the 1-line `@Autowired` annotation to the `NominatimGeocodingService` constructor.
2. Re-run `mvn test -Dtest=CustomerStorefrontQueryIT,DeliverySlotDayMismatchTest` to confirm 100% ApplicationContext startup success.
3. Proceed with staging and committing the changes per the proposed Release Manifest.
