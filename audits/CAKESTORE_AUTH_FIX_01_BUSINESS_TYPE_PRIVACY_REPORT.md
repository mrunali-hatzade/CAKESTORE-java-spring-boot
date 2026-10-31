# CakeStore — Phase AUTH-2.1: BusinessType Mapping & Home-Baker Address Privacy Implementation Report

**Audit Identifier:** `AUTH-FIX-01`  
**Execution Date:** 2026-10-31  
**Target Environment:** Local / Staging Pre-Deployment  
**Status:** COMPLETE (All Backend & Frontend Tests Passing, Production Build & Lint Clean)

---

## 1. Root Cause Analysis

During Phase AUTH-1 audit, two related architectural discrepancies were identified between the frontend onboarding workflow and backend persistence/storefront logic:

1. **Enum String Mismatch & Silent Exception Swallowing:**
   - The frontend registration form (`frontend_v2/app/onboarding/page.tsx`) submitted legacy business-type strings: `HOME_BAKER`, `PASTRY_SHOP`, `CUSTOM_CAKE_STUDIO`, `COMMERCIAL_BAKERY`.
   - The backend `BusinessType` enum was defined with different constant names: `HOME_BAKERY`, `BAKERY_SHOP`, `CAKE_STUDIO`, `ONLINE_CAKE_BUSINESS`, `OTHER`.
   - When registering a new bakery, `AuthService.register()` executed:
     ```java
     try {
         if (request.getBusinessType() != null) {
             shop.setBusinessType(BusinessType.valueOf(request.getBusinessType().toUpperCase()));
         }
     } catch (IllegalArgumentException e) {
         // ignore or log
     }
     ```
   - Because `valueOf("HOME_BAKER")` failed, an `IllegalArgumentException` was thrown, caught, and silently ignored. Consequently, `shop.business_type` was saved as `NULL` in PostgreSQL for newly registered shops.

2. **Address Privacy Bypass Due to Null Business Type & Missing Settings Row:**
   - When `shop.getBusinessType()` evaluated to `null`, the privacy initialization check `savedShop.getBusinessType() == BusinessType.HOME_BAKERY` failed to trigger. As a result, no `ShopStorefrontSettings` record was created.
   - In `CustomerStorefrontService.getShopDetails()` and `mapProjectionToSummaryDTO()`, address masking was guarded only by `ss != null && Boolean.TRUE.equals(ss.getHideStreetAddress())`.
   - If a home bakery had `ss == null`, the storefront logic failed to mask the address, exposing the residential street address, apartment details, and exact GPS coordinates to anonymous marketplace visitors.
   - Similarly, in `CustomerStorefrontController`, filtering by `businessType=HOME_BAKER` failed `BusinessType.valueOf()`, returning empty results.

---

## 2. Files Modified

| Component | File Path | Nature of Change |
| :--- | :--- | :--- |
| **Backend Enum** | `backend/src/main/java/com/cakeplatform/api/modules/shop/BusinessType.java` | Added `fromString(String raw)` with canonical resolution, explicit legacy aliases, whitespace/hyphen normalization, and strict rejection of unknown values. |
| **Backend Auth** | `backend/src/main/java/com/cakeplatform/api/modules/auth/service/AuthService.java` | Replaced silent exception swallowing with `BusinessType.fromString()`. Invalid types trigger `IllegalArgumentException` (HTTP 400 + transactional rollback). Initializes `ShopStorefrontSettings` with `hideStreetAddress = true` for `HOME_BAKERY` and `false` for commercial bakeries. Added setter for unit test dependency injection. |
| **Backend Storefront** | `backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java` | Updated `discoverShops` and `searchShops` to use `BusinessType.fromString()`, allowing legacy query parameters (`HOME_BAKER`, etc.) to resolve cleanly without 500 errors or false empty results. |
| **Backend Storefront** | `backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java` | In `mapProjectionToSummaryDTO` and `getShopDetails`, implemented defense-in-depth fallback: if storefront settings are absent, `shop.getBusinessType() == BusinessType.HOME_BAKERY` enforces address hiding. Masked fields: `address`, `addressLine1`, `addressLine2`, `mapLocationUrl`, `latitude`, `longitude`. Preserved fields: `area`, `city`, `district`, `state`, `pincode`. |
| **Backend Shop Service** | `backend/src/main/java/com/cakeplatform/api/modules/shop/service/OwnerStorefrontService.java` | Updated `updateStorefrontSettings` so default settings initialization preserves `hideStreetAddress = (shop.getBusinessType() == BusinessType.HOME_BAKERY)`. |
| **Backend Invoicing** | `backend/src/main/java/com/cakeplatform/api/modules/order/InvoiceService.java` | Added fallback check `order.getShop().getBusinessType() == BusinessType.HOME_BAKERY` when evaluating `hideStreet` on generated PDF invoices. |
| **Frontend Form** | `frontend_v2/app/onboarding/page.tsx` | Updated default state to `'HOME_BAKERY'`. Updated `<Select>` options to canonical values (`HOME_BAKERY`, `BAKERY_SHOP`, `CAKE_STUDIO`, `ONLINE_CAKE_BUSINESS`, `OTHER`) while maintaining human-readable labels. |
| **Frontend Navigation** | `frontend_v2/components/common/Footer.tsx` | Updated exploration links to canonical query parameters `/explore?businessType=HOME_BAKERY` and `/explore?businessType=CAKE_STUDIO`. |
| **Frontend Explore** | `frontend_v2/app/explore/page.tsx` | Added `normalizeBusinessType()` helper mapping legacy URL query parameters (`HOME_BAKER` &rarr; `HOME_BAKERY`, etc.) so bookmarked links seamlessly highlight the correct category pill. |
| **Backend Automated Tests** | `backend/src/test/java/com/cakeplatform/api/modules/auth/BusinessTypeMappingAndPrivacyTest.java` | New test suite with 14 unit and integration tests covering enum mapping, aliases, invalid input rejection, transactional rollback, privacy defaults, and storefront address masking. |
| **Frontend Automated Tests** | `frontend_v2/__tests__/businessTypeMappingAndPrivacy.test.mjs` | New test suite with 5 automated tests verifying query normalization, onboarding default and select options, footer links, and client-side privacy representation. |

---

## 3. Canonical and Legacy Mappings

The backend `BusinessType` enum is the canonical source of truth. The table below outlines the mappings supported by both backend `BusinessType.fromString()` and frontend `normalizeBusinessType()`:

| Raw Input / Legacy Alias | Canonical Value | User-Facing Label | Privacy Default (`hideStreetAddress`) |
| :--- | :--- | :--- | :---: |
| `HOME_BAKERY` (canonical) | `HOME_BAKERY` | 🏠 Home Baker / Artisan Kitchen | **`true`** |
| `HOME_BAKER` (legacy alias) | `HOME_BAKERY` | 🏠 Home Baker / Artisan Kitchen | **`true`** |
| `home-baker` / `home_bakery` | `HOME_BAKERY` | 🏠 Home Baker / Artisan Kitchen | **`true`** |
| `BAKERY_SHOP` (canonical) | `BAKERY_SHOP` | 🏬 Pastry Boutique / Retail Shop | `false` |
| `PASTRY_SHOP` (legacy alias) | `BAKERY_SHOP` | 🏬 Pastry Boutique / Retail Shop | `false` |
| `pastry-shop` / `bakery_shop` | `BAKERY_SHOP` | 🏬 Pastry Boutique / Retail Shop | `false` |
| `CAKE_STUDIO` (canonical) | `CAKE_STUDIO` | 🎂 Custom Cake Studio | `false` |
| `CUSTOM_CAKE_STUDIO` (legacy) | `CAKE_STUDIO` | 🎂 Custom Cake Studio | `false` |
| `custom-cake-studio` | `CAKE_STUDIO` | 🎂 Custom Cake Studio | `false` |
| `ONLINE_CAKE_BUSINESS` (canonical) | `ONLINE_CAKE_BUSINESS` | 🏭 Commercial Bakery | `false` |
| `COMMERCIAL_BAKERY` (legacy) | `ONLINE_CAKE_BUSINESS` | 🏭 Commercial Bakery | `false` |
| `commercial-bakery` | `ONLINE_CAKE_BUSINESS` | 🏭 Commercial Bakery | `false` |
| `OTHER` (canonical) | `OTHER` | ✨ Other Specialty Bakery | `false` |
| Unsupported / Invalid String | *Throws `IllegalArgumentException`* | Rejected with HTTP 400 Bad Request | N/A |

---

## 4. Address Privacy Implementation

### 4.1 Onboarding & Registration Default
When `AuthService.register()` persists a shop:
```java
// Initialize storefront settings with home-baker address privacy enabled by default
if (shopStorefrontSettingsRepository != null) {
    try {
        boolean isHomeBakery = (savedShop.getBusinessType() == BusinessType.HOME_BAKERY);
        ShopStorefrontSettings settings = ShopStorefrontSettings.builder()
                .shop(savedShop)
                .hideStreetAddress(isHomeBakery)
                .build();
        shopStorefrontSettingsRepository.save(settings);
    } catch (Exception ex) {
        log.error("Failed to initialize shop storefront settings for shop {}: {}", savedShop.getId(), ex.getMessage());
    }
}
```

### 4.2 Customer Storefront Privacy Enforcement
In `CustomerStorefrontService.getShopDetails()`:
```java
boolean hideStreet = (ss != null)
        ? Boolean.TRUE.equals(ss.getHideStreetAddress())
        : (shop.getBusinessType() == BusinessType.HOME_BAKERY);

if (hideStreet) {
    response.setAddress(null);
    response.setAddressLine1(null);
    response.setAddressLine2(null);
    response.setMapLocationUrl(null);
    response.setLatitude(null);
    response.setLongitude(null);
}
```

In `CustomerStorefrontService.mapProjectionToSummaryDTO()` (Search & Discovery):
```java
boolean hideStreet = false;
if (p.getHideStreetAddress() != null) {
    hideStreet = Boolean.TRUE.equals(p.getHideStreetAddress());
} else if (shopStorefrontSettingsRepository != null) {
    hideStreet = shopStorefrontSettingsRepository.findByShopId(p.getId())
            .map(s -> Boolean.TRUE.equals(s.getHideStreetAddress()))
            .orElse(bType == BusinessType.HOME_BAKERY);
} else {
    hideStreet = (bType == BusinessType.HOME_BAKERY);
}
```

### 4.3 Invoice Privacy Defense
In `InvoiceService.generateInvoicePdf()`:
```java
boolean hideStreet = (order.getShop().getStorefrontSettings() != null)
        ? Boolean.TRUE.equals(order.getShop().getStorefrontSettings().getHideStreetAddress())
        : (order.getShop().getBusinessType() == BusinessType.HOME_BAKERY);
```

### 4.4 Data Visibility Summary
- **Scrubbed Fields (Hidden):** `address`, `addressLine1`, `addressLine2`, `latitude`, `longitude`, `mapLocationUrl`.
- **Retained Fields (Public):** `area`, `city`, `district`, `state`, `pincode`, `businessName`, `businessType`, `description`, `businessPhone`, `businessEmail`.

---

## 5. Review of Existing Database Records

A read-only audit of the local development/staging PostgreSQL database was performed (`cake_platform`):

### 5.1 Inspection Summary
```sql
SELECT business_type, count(*) FROM shops GROUP BY business_type;
```
- **Total Shops in Database:** 386
- **`business_type IS NULL`:** 334 shops
- **`HOME_BAKERY`:** 26 shops
- **`BAKERY_SHOP`:** 26 shops
- **`CAKE_STUDIO` / `ONLINE_CAKE_BUSINESS` / `OTHER`:** 0 shops

```sql
SELECT hide_street_address, count(*) FROM shop_storefront_settings GROUP BY hide_street_address;
```
- **Total `shop_storefront_settings` Records:** 27
- **`hide_street_address = true`:** 3 shops (IDs: 394, 403, 409)
- **`hide_street_address = false`:** 24 shops
- **Shops without `shop_storefront_settings` Record:** 359 shops

### 5.2 Recommendation for Existing Records
In accordance with safety restrictions:
- **No automated or destructive database updates were run.**
- The application now includes defense-in-depth fallbacks: any shop with `business_type = HOME_BAKERY` automatically masks street addresses even without a `shop_storefront_settings` row.
- For the 334 legacy shops where `business_type IS NULL`:
  - **Recommended Migration Plan (Post-Audit):** During a planned maintenance window, administrators can prompt owners via an in-app banner to confirm their business type, or run an opt-in migration script based on business description analysis or owner self-service settings.

---

## 6. Automated Tests Executed & Actual Results

### 6.1 Backend Test Results
Test File: `backend/src/test/java/com/cakeplatform/api/modules/auth/BusinessTypeMappingAndPrivacyTest.java`

| Test Suite / Method | Description | Result |
| :--- | :--- | :---: |
| `testCanonicalValues` | Verifies `HOME_BAKERY`, `BAKERY_SHOP`, `CAKE_STUDIO`, `ONLINE_CAKE_BUSINESS`, `OTHER` (case-insensitive & trimmed). | **PASS** |
| `testLegacyAliases` | Verifies `HOME_BAKER`, `PASTRY_SHOP`, `CUSTOM_CAKE_STUDIO`, `COMMERCIAL_BAKERY` (including kebab-case). | **PASS** |
| `testNullOrBlank` | Verifies `null`, `""`, and `"   "` return `null` without throwing. | **PASS** |
| `testInvalidBusinessType` | Verifies unsupported types throw `IllegalArgumentException` with descriptive message. | **PASS** |
| `testRegister_CanonicalHomeBakery_EnablesPrivacy` | Verifies registration persists `HOME_BAKERY` and creates settings with `hideStreetAddress = true`. | **PASS** |
| `testRegister_LegacyHomeBakerAlias_EnablesPrivacy` | Verifies registration with `HOME_BAKER` resolves to `HOME_BAKERY` and sets `hideStreetAddress = true`. | **PASS** |
| `testRegister_BakeryShop_LeavesPrivacyFalse` | Verifies registration with `PASTRY_SHOP` resolves to `BAKERY_SHOP` and sets `hideStreetAddress = false`. | **PASS** |
| `testRegister_InvalidBusinessType_ThrowsExceptionAndRollsBack` | Verifies invalid type rejects registration before `shopRepository.save()` (triggering transactional rollback). | **PASS** |
| `testGlobalExceptionHandler_Returns400` | Verifies `GlobalExceptionHandler` converts `IllegalArgumentException` to HTTP 400 Bad Request. | **PASS** |
| `testGetShopDetails_HomeBakery_WithPrivacySetting_HidesAddress` | Verifies street address and GPS coordinates are masked when `hideStreetAddress = true`. | **PASS** |
| `testGetShopDetails_HomeBakery_WithoutSettingsRow_FallsBackToHidingAddress` | Verifies defense-in-depth fallback masks address for `HOME_BAKERY` when settings row is missing. | **PASS** |
| `testGetShopDetails_RetailBakery_RetainsStreetAddress` | Verifies `BAKERY_SHOP` retains street address and GPS coordinates when privacy is false. | **PASS** |
| `testSearch_LegacyAlias_ResolvesToCanonical` | Verifies controller search with `HOME_BAKER` calls service with `HOME_BAKERY`. | **PASS** |
| `testSearch_InvalidBusinessType_ReturnsEmptyGracefully` | Verifies invalid search type returns HTTP 200 with empty list instead of 500 error. | **PASS** |

**Summary: Tests run: 14, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS.**

### 6.2 Backend Regression Test Results
Run Command: `mvn -f backend/pom.xml test -Dtest="RegistrationIdentityIntegrityTest,CustomerPrivacySecurityTest,CustomerStorefrontDetailsTest"`
- `RegistrationIdentityIntegrityTest`: 17 passed, 0 failed.
- `CustomerPrivacySecurityTest`: 7 passed, 0 failed.
- `CustomerStorefrontDetailsTest`: 25 passed, 0 failed.
- **Total Regression Suite: 49 tests passed, 0 failures, 0 errors — BUILD SUCCESS.**

### 6.3 Frontend Test Results
Test File: `frontend_v2/__tests__/businessTypeMappingAndPrivacy.test.mjs`
- Test 1: Explore query param normalization maps legacy aliases to canonical enum values (**PASS**)
- Test 2: Explore query param normalization preserves canonical values and handles undefined (**PASS**)
- Test 3: Onboarding page contains canonical BusinessType default and select options (**PASS**)
- Test 4: Footer links use canonical BusinessType query parameters (**PASS**)
- Test 5: Home-baker storefront address privacy hides street address but retains city/locality (**PASS**)

**Summary: Tests run: 5, Passed: 5, Failed: 0.**

### 6.4 Entire Frontend Test Suite
Run Command: `npm --prefix frontend_v2 test`
- **Total Test Files:** 21 suites
- **Total Tests Run:** 264
- **Pass:** 264
- **Fail:** 0
- **Duration:** 5.18 seconds

---

## 7. Build and Lint Verification

### 7.1 Frontend Lint
Command: `npm --prefix frontend_v2 run lint`
- Output: `next lint` exited with **code 0**.
- Zero ESLint errors. (1 pre-existing warning in unrelated `InteractiveLocationMap.tsx`).

### 7.2 Frontend Production Build
Command: `npm --prefix frontend_v2 run build`
- Output: `next build` exited with **code 0**.
- All 43 routes (`/onboarding`, `/explore`, `/shop/[id]`, etc.) compiled, typechecked, and statically generated successfully.

### 7.3 Backend Compilation
Command: `mvn -f backend/pom.xml compile`
- Output: 350 source files compiled successfully with release 17 target.
- Exit code: 0.

---

## 8. Remaining Risks and Manual Verification Requirements

1. **Owner Storefront Settings Toggle:**
   - In the owner dashboard settings (`/dashboard/owner/settings`), bakery owners have an operational toggle to show or hide their street address. Verification confirmed that updating this setting through `OwnerStorefrontService.updateStorefrontSettings()` adheres to the owner's explicit toggle preference while defaulting new home bakeries to `true`.
2. **Legacy Null Business Type Records:**
   - Existing shops created before this fix that have `business_type IS NULL` will not automatically be identified as `HOME_BAKERY` unless an owner updates their profile. A non-destructive owner prompt upon dashboard login is recommended during Phase 3 rollout.
3. **Safety Restrictions Maintained:**
   - No Flyway migrations were modified.
   - No production database records were altered.
   - No unrelated authentication features or payment configurations were changed.

---

## 9. Conclusion

Phase AUTH-2.1 (`AUTH-FIX-01`) is **COMPLETE**. All requirements have been fulfilled, verified with comprehensive automated tests, regression-checked against existing suites, and confirmed clean via production build and linting.

