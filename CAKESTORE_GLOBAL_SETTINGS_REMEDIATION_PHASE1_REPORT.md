# CakeStore — Global Settings Remediation Phase 1 Report

## Executive Summary

This remediation report documents the successful implementation and verification of the three confirmed, independent defects identified in the Global Settings audit:
1. **Platform Currency UI:** Integrated the missing `Select` currency control into the Admin Dashboard (`/admin/settings`), initializing from backend `platformCurrency`, preserving the project default `INR`, and persisting user selections across reloads.
2. **Server-Side Validation:** Enforced rigorous request boundary validation using `@Valid`, Jakarta Bean Validation (`@Pattern`, `@Email`, `@Size`), and service-layer validation to reject blank or oversized platform names, malformed non-empty email addresses, and blank emails with HTTP 400 Bad Request, while preserving partial update semantics for omitted fields.
3. **Accessibility:** Associated all visible form labels with their corresponding input IDs using standard `htmlFor` / `id` bindings, correctly reused the shared `Input` and `Select` components, and added accessible names (`aria-label`) to secret password visibility toggles while preserving masking, show/hide behavior, and design aesthetics.

All changes adhere strictly to the mandatory safety constraints: encryption utilities (`EncryptionConverter.java`, `GlobalSettingsEncryptionMigrationUtility.java`) and production keys/environments were completely untouched.

---

## 1. Files Changed and Why

| File | Type | Reason for Change |
| :--- | :--- | :--- |
| `frontend_v2/app/admin/settings/page.tsx` | Frontend Page Component | Added the `Platform Currency` select dropdown; associated form input IDs (`platformName`, `supportEmail`, `platformCurrency`, `razorpayKeyId`, `razorpayKeySecret`, `razorpayWebhookSecret`) with their visible labels (`htmlFor`); reused shared `Input` and `Select` components; added `aria-label` to secret show/hide toggle buttons. |
| `frontend_v2/__tests__/adminGlobalSettingsRemediationPhase1.test.mjs` | Frontend Automated Test Suite | Added 7 unit tests verifying currency fallback to `INR`, currency preservation, non-standard currency option handling, secret sanitization preventing overwrites, secret trimming, accessible names for toggles, and input/label association contracts. |
| `backend/src/main/java/com/cakeplatform/api/modules/settings/dto/GlobalSettingsDTO.java` | Backend DTO | Added Bean Validation annotations (`@Pattern(regexp = "^(?!\\s*$).+")`, `@Size(max = 255)`, `@Email(regexp = "...")`, `@Size(max = 10)`) to validate `platformName`, `supportEmail`, and `platformCurrency` at request boundary. |
| `backend/src/main/java/com/cakeplatform/api/modules/settings/controller/AdminSettingsController.java` | Backend REST Controller | Added `@Valid` to `@RequestBody GlobalSettingsDTO dto` on `PUT /api/admin/settings` to trigger boundary validation and return HTTP 400 rather than reaching business logic or throwing unexpected 500s. |
| `backend/src/main/java/com/cakeplatform/api/modules/settings/GlobalSettingsService.java` | Backend Service | Enforced trimming and rejection of blank `platformName` and `supportEmail` (`IllegalArgumentException` mapped to HTTP 400 by `GlobalExceptionHandler`); ensured trimmed non-blank update for `platformCurrency`. |
| `backend/src/test/java/com/cakeplatform/api/modules/settings/AdminSettingsSecurityE2ETest.java` | Backend E2E Test Suite | Added 9 new test cases covering blank/whitespace platform names, oversized platform names, malformed email addresses, blank email addresses, oversized email addresses, valid updates, partial-update omitted field preservation, and currency update & persistence. |

---

## 2. Behavior Before and After

### 1. Platform Currency Control
- **Before:** The Global Settings page loaded `platformCurrency` from the API and included `platformCurrency` in the PUT payload, but lacked any form input or select element on the page. Administrators were unable to view or configure the platform currency from the UI.
- **After:** The "Platform Identity" card contains a `Select` dropdown for Platform Currency populated with supported options (`INR`, `USD`, `EUR`, `GBP`) defaulting cleanly to `INR`. Changing the selection updates local state, submits `platformCurrency` in the payload, persists in the database, and reloads reliably.

### 2. Server-Side Validation & Partial Updates
- **Before:** `AdminSettingsController.updateSettings` lacked `@Valid`. Blank platform names (`""`, `"   "`) or malformed emails (`"not-an-email"`) either bypassed boundary validation or risked unhandled server exceptions.
- **After:** Boundary validation via `@Valid` and Jakarta constraints intercepts invalid inputs:
  - Blank or whitespace-only platform name: Rejected with HTTP 400 (`MethodArgumentNotValidException`).
  - Oversized platform name (> 255 chars): Rejected with HTTP 400 (`MethodArgumentNotValidException`).
  - Malformed non-empty support email: Rejected with HTTP 400 (`MethodArgumentNotValidException`).
  - Blank support email: Rejected with HTTP 400 (`IllegalArgumentException` mapped to HTTP 400).
  - Oversized support email (> 255 chars): Rejected with HTTP 400 (`MethodArgumentNotValidException`).
  - Omitted fields (partial updates): Null values pass validation and are ignored by `GlobalSettingsService`, strictly preserving existing settings, stored credentials, and configured secrets.

### 3. Accessibility & Password Visibility Toggles
- **Before:** Visible `<label>` elements were placed in detached `<div>` containers without `htmlFor`, and `<Input>` components had no `id` assigned. Password visibility toggles were `<button>` elements with SVG icons and no text or `aria-label`, failing accessibility screen-reader audits.
- **After:** Every input has a unique `id` matching its visible label's `htmlFor` (`id="platformName"`, `id="supportEmail"`, `id="platformCurrency"`, `id="razorpayKeyId"`, `id="razorpayKeySecret"`, `id="razorpayWebhookSecret"`). Password toggle buttons include dynamic `aria-label`s (`"Show/Hide Razorpay key secret"` and `"Show/Hide Razorpay webhook secret"`), making them accessible to assistive technologies while preserving visual styling.

---

## 3. Tests Executed and Actual Results

### Backend Automated Tests
- **Test File 1:** `com.cakeplatform.api.modules.settings.AdminSettingsSecurityE2ETest`
  - **Command:** `mvn test -Dtest=AdminSettingsSecurityE2ETest`
  - **Result:** `Tests run: 18, Failures: 0, Errors: 0, Skipped: 0` (BUILD SUCCESS, Total time: 02:30 min)
  - **Verified Cases:**
    1. `AUTHENTICATION: Unauthenticated GET /api/admin/settings is rejected` (PASS)
    2. `AUTHENTICATION: Unauthenticated PUT /api/admin/settings is rejected` (PASS)
    3. `AUTHORIZATION: SHOP_OWNER token cannot GET /api/admin/settings` (PASS)
    4. `AUTHORIZATION: SHOP_OWNER token cannot PUT /api/admin/settings` (PASS)
    5. `AUTHORIZATION: CUSTOMER token cannot GET /api/admin/settings` (PASS)
    6. `AUTHORIZATION: CUSTOMER token cannot PUT /api/admin/settings` (PASS)
    7. `DATA PROTECTION: ROLE_ADMIN GET returns settings without raw secrets` (PASS)
    8. `FUNCTIONAL: ROLE_ADMIN PUT updates secrets securely and never echoes them back` (PASS)
    9. `PRESERVATION: Leaving secrets blank preserves existing configured secrets` (PASS)
    10. `VALIDATION: Blank platformName (empty string) is rejected with HTTP 400` (PASS)
    11. `VALIDATION: Blank platformName (whitespace only) is rejected with HTTP 400` (PASS)
    12. `VALIDATION: Oversized platformName (> 255 chars) is rejected with HTTP 400` (PASS)
    13. `VALIDATION: Malformed non-empty supportEmail is rejected with HTTP 400` (PASS)
    14. `VALIDATION: Blank supportEmail is rejected with HTTP 400` (PASS)
    15. `VALIDATION: Oversized supportEmail (> 255 chars) is rejected with HTTP 400` (PASS)
    16. `VALIDATION: Valid platformName and supportEmail update successfully with HTTP 200` (PASS)
    17. `PARTIAL UPDATE: Omitted fields preserve existing values without overwrite` (PASS)
    18. `CURRENCY: Updating platformCurrency persists and returns on reload` (PASS)

- **Test File 2:** `com.cakeplatform.api.modules.settings.GlobalSettingsSchemaAndMigrationTest`
  - **Command:** `mvn test -Dtest=GlobalSettingsSchemaAndMigrationTest`
  - **Result:** `Tests run: 3, Failures: 0, Errors: 0, Skipped: 0` (BUILD SUCCESS, Total time: 01:43 min)

### Frontend Automated Tests & Lint
- **ESLint Check:** `npm run lint`
  - **Result:** `✔ No ESLint warnings or errors`
- **TypeScript Typecheck:** `npx tsc --noEmit`
  - **Result:** `0 errors, exited with code 0`
- **Frontend Unit Tests:** `node --test`
  - **Result:** `113 tests pass, 0 fail, 4 suites, duration: 2.24s`
  - Including 7 newly added tests in `adminGlobalSettingsRemediationPhase1.test.mjs` verifying currency defaults, non-standard options, secret sanitization, accessible names, and input/label associations.

---

## 4. Confirmation of Mandatory Safety Constraints

- **Encryption untouched:** Neither `EncryptionConverter.java` nor `GlobalSettingsEncryptionMigrationUtility.java` were modified.
- **Key configuration untouched:** No encryption keys or secrets were created, modified, or rotated.
- **Production infrastructure untouched:** No Azure resources, Docker compose configurations, Flyway migrations beyond existing V50, or production database records were altered.
- **Gateways and Auth untouched:** Razorpay gateway processing logic, Spring Security filter chains, and JWT authorization rules were preserved verbatim.
- **Write-only secrets preserved:** Secrets continue to be masked on read operations (`razorpayKeySecret` and `razorpayWebhookSecret` never echoed in responses).

---

## 5. Unresolved Issues

None. All three confirmed defects from Phase 1 have been remediated, verified, and backed by automated unit and E2E tests.
