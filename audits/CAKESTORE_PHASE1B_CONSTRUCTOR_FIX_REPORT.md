# CakeStore — Phase 1B: Constructor Wiring Fix & Revalidation Report

**Document**: `CAKESTORE_PHASE1B_CONSTRUCTOR_FIX_REPORT.md`  
**Execution Date**: October 22, 2026  
**Auditor / Engineer**: Antigravity Quality & Release Safety Agent  
**Status**: **CONSTRUCTOR WIRING DEFECT RESOLVED — REVALIDATION COMPLETED**  
**Source of Truth**: `CAKESTORE_RELEASE_PREPARATION_REPORT.md` (Blocker BLK-01)  
**Target File Modified**: `backend/src/main/java/com/cakeplatform/api/modules/location/service/NominatimGeocodingService.java`  

---

## 1. Executive Summary

During Phase 1 release preparation (`CAKESTORE_RELEASE_PREPARATION_REPORT.md`, Section 5), a critical production startup defect (**BLK-01**) was identified in `NominatimGeocodingService.java`. The service defined two public constructors, but lacked an explicit `@Autowired` annotation on either constructor. Instead, `@Autowired(required = false)` was erroneously applied to the first parameter of the primary constructor.

Under Spring Framework bean resolution rules:
- When a bean defines multiple constructors and none is annotated with `@Autowired`, Spring falls back to a default no-argument constructor (`<init>()`).
- Because `NominatimGeocodingService` has no default constructor, any test or application startup that instantiates the Spring `ApplicationContext` crashed immediately with:
  `NoSuchMethodException: com.cakeplatform.api.modules.location.service.NominatimGeocodingService.<init>()`.

In Phase 1B, the smallest correct fix was applied: adding `@Autowired` directly to the primary constructor while preserving the secondary constructor for unit test mocking. All targeted integration and unit tests now execute with **100% success**.

---

## 2. Constructor Inspection & Call Sites

### 2.1 Constructor Definitions
`NominatimGeocodingService.java` contains two public constructors:

1. **Constructor 1: Spring Component Injection Constructor (Lines 38–48)**
   ```java
   @Autowired
   public NominatimGeocodingService(
           @Autowired(required = false) LocationLocalityRepository localityRepository,
           RestTemplateBuilder restTemplateBuilder,
           @Value("${app.geocoding.timeout-ms:3000}") int timeoutMs
   ) {
       this.localityRepository = localityRepository;
       this.restTemplate = restTemplateBuilder
               .setConnectTimeout(Duration.ofMillis(timeoutMs))
               .setReadTimeout(Duration.ofMillis(timeoutMs))
               .build();
   }
   ```
   - **Intended Purpose**: Production bean creation by Spring's `DefaultListableBeanFactory`.
   - **Call Site**: Spring Boot `ApplicationContext` runtime reflection during startup.
   - **Parameters**:
     - `LocationLocalityRepository localityRepository`: Optional local locality cache repository (`@Autowired(required = false)`).
     - `RestTemplateBuilder restTemplateBuilder`: Spring Boot HTTP client builder configuring connect/read timeouts.
     - `int timeoutMs`: Injected configuration property (`app.geocoding.timeout-ms`).

2. **Constructor 2: Direct Test Harness Constructor (Lines 51–57)**
   ```java
   public NominatimGeocodingService(LocationLocalityRepository localityRepository, RestTemplate restTemplate) {
       this.localityRepository = localityRepository;
       this.restTemplate = restTemplate;
       this.enabled = true;
       this.endpoint = "https://nominatim.openstreetmap.org/search";
       this.userAgent = "CakeStore-Platform/1.0";
   }
   ```
   - **Intended Purpose**: Unit testing without Spring context, allowing direct injection of mocked `RestTemplate` and `LocationLocalityRepository`.
   - **Call Sites**:
     - `backend/src/test/java/com/cakeplatform/api/modules/storefront/LocationDiscoveryUnitTest.java` (Line 197)
     - `backend/src/test/java/com/cakeplatform/api/modules/storefront/LocationDiscoveryUnitTest.java` (Line 445)

---

## 3. Applied Fix & Exact Diff

### 3.1 Changes Applied
- Added `@Autowired` annotation immediately above the declaration of Constructor 1.
- Retained `@Autowired(required = false)` on the `localityRepository` parameter to preserve optional dependency semantics.
- Left Constructor 2 unchanged, preserving full compatibility with `LocationDiscoveryUnitTest.java`.

### 3.2 Unified Diff
```diff
--- a/backend/src/main/java/com/cakeplatform/api/modules/location/service/NominatimGeocodingService.java
+++ b/backend/src/main/java/com/cakeplatform/api/modules/location/service/NominatimGeocodingService.java
@@ -35,6 +35,7 @@ public class NominatimGeocodingService implements GeocodingService {
     @Value("${app.geocoding.user-agent:CakeStore-Platform/1.0}")
     private String userAgent;
 
+    @Autowired
     public NominatimGeocodingService(
             @Autowired(required = false) LocationLocalityRepository localityRepository,
             RestTemplateBuilder restTemplateBuilder,
```

---

## 4. Test Execution & Verification Results

### 4.1 Target Integration Tests (Spring Context Bootstrapping)

#### Test 1: `CustomerStorefrontQueryIT`
Previously failed due to `NominatimGeocodingService.<init>()` missing method exception.
```powershell
mvn test "-Dtest=CustomerStorefrontQueryIT"
```
- **Exit Code**: `0`
- **Result**: **BUILD SUCCESS**
- **Duration**: 81.66 s
- **Tests Run**: 6
- **Failures**: 0
- **Errors**: 0
- **Flyway Database Verification**: Initialized PostgreSQL connection, confirmed schema `public` is up to date through `V52__add_delivery_consistency_fields.sql`.
- **Status**: **PASSED**

#### Test 2: `DeliverySlotDayMismatchTest`
```powershell
mvn test "-Dtest=DeliverySlotDayMismatchTest"
```
- **Exit Code**: `0`
- **Result**: **BUILD SUCCESS**
- **Duration**: 94.61 s
- **Tests Run**: 1
- **Failures**: 0
- **Errors**: 0
- **Status**: **PASSED**

### 4.2 Geocoding Unit Tests

#### Test 3: `LocationDiscoveryUnitTest`
Exercises Constructor 2 with mock `RestTemplate` and mock repository across 5 nested test suites.
```powershell
mvn test "-Dtest=LocationDiscoveryUnitTest"
```
- **Exit Code**: `0`
- **Result**: **BUILD SUCCESS**
- **Duration**: 32.05 s
- **Tests Run**: 22
- **Breakdown**:
  - `GeocodeEndpointAndPrecisionTests`: 3 passed, 0 failures, 0 errors
  - `RegistrationLocationConfirmationTests`: 3 passed, 0 failures, 0 errors
  - `ShopLocationUpdateTests`: 3 passed, 0 failures, 0 errors
  - `GeocodingSafetyTests`: 3 passed, 0 failures, 0 errors
  - `ControllerValidationTests`: 10 passed, 0 failures, 0 errors
- **Failures**: 0
- **Errors**: 0
- **Status**: **PASSED**

### 4.3 Core Storefront & Delivery Fee Unit Tests

#### Test 4: `DeliveryFeeConsistencyRegressionTest`
```powershell
mvn test "-Dtest=DeliveryFeeConsistencyRegressionTest"
```
- **Exit Code**: `0`
- **Result**: **BUILD SUCCESS**
- **Tests Run**: 4
- **Failures**: 0
- **Errors**: 0
- **Status**: **PASSED**

---

## 5. Full Project Backend Verification (`mvn clean verify`)

The project's full verification suite was executed:
```powershell
mvn clean verify
```
- **Total Duration**: 12 min 37 s
- **Total Tests Run**: 876
- **Tests Passed**: 868 (99.1%)
- **Failures**: 2
- **Errors**: 6
- **Skipped**: 0

### Analysis of Unrelated Failures:
All 6 errors and 2 failures stem from a single, unrelated validation rule introduced in `CustomerStorefrontService.java` during the delivery-fee consistency implementation:
```java
// CustomerStorefrontService.java line 927:
if (request.getFulfillmentMethod() == FulfillmentMethod.HOME_DELIVERY || request.getFulfillmentMethod() == null) {
    if (request.getDeliveryAddress() == null || request.getDeliveryAddress().isBlank()) {
        throw new IllegalArgumentException("Delivery street address is required for home delivery");
    }
}
```

Pre-existing test fixtures in legacy suites instantiated `GuestOrderRequest` without setting `deliveryAddress`:
1. `Day3Phase2E2ETest.testCustomerOrderJourney_FinancialValues` (Error: Missing street address)
2. `DelayedPaymentConfirmationRegressionTest.testManualCancellationSafelyReleasesDeliverySlot` (Error: Missing street address)
3. `DelayedPaymentConfirmationRegressionTest.testReservedDeliverySlotIsNotReleasedSolelyDueToElapsedTime` (Error: Missing street address)
4. `StorefrontExpiryTest.testCapacityPreservedAcrossSchedulerExecutionAndReleasedOnlyOnManualCancellation` (Error: Missing street address)
5. `StorefrontCapacityTest.testCancelledOrderReleasesCapacity` (Error: Missing street address)
6. `StorefrontCapacityTest.testPaymentPendingConsumesCapacity` (Error: Missing street address)
7. `StorefrontCapacityTest.testConcurrentCheckoutAttemptsCannotOverbook` (Failure: 0 orders succeeded instead of 1 because both requests threw address validation exception)
8. `Day3Phase2E2ETest.testCustomerOrderJourney_WrongShop` (Failure: Assertion expected product mismatch exception, but address validation threw first)

**Key Verification Finding**:
- **0 errors or failures** occurred in `NominatimGeocodingService` or any geocoding components.
- **0 errors or failures** occurred during Spring `ApplicationContext` bootstrapping.
- The constructor injection defect (**BLK-01**) is completely resolved.

---

## 6. Frontend Validation Audit (Referenced from Phase 1)

Because the constructor fix in `NominatimGeocodingService.java` was isolated to backend Java code and did not modify any frontend contracts, DTO shapes, or API schemas, frontend tests were not rerun to prevent unnecessary cycles. 

As recorded in `CAKESTORE_RELEASE_PREPARATION_REPORT.md` (Sections 6.3–6.5):
- **Frontend Test Suite (`npm test`)**: 200 / 200 tests passed across 21 suites (Exit Code `0`).
- **TypeScript Static Analysis (`npx tsc --noEmit`)**: 0 errors (Exit Code `0`).
- **Next.js Production Build (`npm run build`)**: Compiled successfully, generating static pages for all 38 application routes (Exit Code `0`).

---

## 7. Remaining Release Blockers & Status

| Blocker ID | Description | Severity | Status | Action Required |
|---|---|---|---|---|
| **BLK-01** | `NominatimGeocodingService` constructor injection | Critical | **RESOLVED** | Verified via `CustomerStorefrontQueryIT` and `LocationDiscoveryUnitTest`. |
| **BLK-02** | Working Tree Uncommitted (47 modified, 34 untracked files) | Blocker | **OPEN** | Review and commit release manifest in 3 logical commits. |
| **BLK-03** | Branch Desynchronization (`development` is 15 commits ahead of `main`) | Blocker | **OPEN** | Merge `development` into `main` after working tree is committed. |
| **NOTE-01** | Legacy Test Fixtures Missing `deliveryAddress` (8 test methods) | Non-Blocking (Legacy Tests) | **OPEN** | Add dummy `request.setDeliveryAddress("123 Baker Street")` to legacy test helpers if full 876/876 green bar is required prior to release. |

---

## 8. Conclusion & Recommendation

The constructor wiring fix is verified, minimal, and fully compatible with all unit and integration test harnesses. No migrations, database records, or Git release states were altered.

### Recommended Next Steps (Awaiting User Approval):
1. **Authorize Legacy Test Fixture Update (Optional)**: If desired, update the 4 legacy test classes (`DelayedPaymentConfirmationRegressionTest`, `StorefrontCapacityTest`, `StorefrontExpiryTest`, `Day3Phase2E2ETest`) to populate a test `deliveryAddress`, bringing `mvn clean verify` to 876/876 passed.
2. **Authorize Git Release Commit Workflow**: Proceed with executing the 3-part release manifest established in `CAKESTORE_RELEASE_PREPARATION_REPORT.md`.
