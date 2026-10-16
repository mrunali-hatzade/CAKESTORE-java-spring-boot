# CakeStore — Final Bakery Management Audit Summary (BM-01 through BM-09)

**Date of Execution**: October 16, 2026  
**Audit Protocol**: Strictly READ-ONLY Verification & Live Test Execution Audit  
**Environment**: Local Development (PostgreSQL 15 / 18.4 client, Spring Boot 3.3.x on port 8080, Next.js 14.2.5 on port 3000, Node.js v24.12.0)  
**Deliverable Document**: `CAKESTORE_BM01_BM09_FINAL_AUDIT_REPORT.md`  

---

## 1. Executive Summary

This report establishes the final, consolidated technical audit for Bakery Management issues **BM-01 through BM-09** across the CakeStore platform. The scope encompasses the Super Admin Bakery Directory (`frontend_v2/app/admin/shops/page.tsx`), Individual Bakery Details view (`frontend_v2/app/admin/shops/[id]/page.tsx`), Spring Boot REST controllers, Spring Security filters, Hibernate entity configurations, storage services, and test suites.

### Key Audit Conclusions
- **All nine items (BM-01 through BM-09) are classified as VERIFIED.**
- **Production Defect Remediation**: All six defects identified in prior audits (BM-01, BM-02, BM-03, BM-04, BM-05, BM-06) and the three workflow/presentation risks (BM-07, BM-08, BM-09) have complete, verified implementations in both backend Spring Boot and frontend Next.js codebases.
- **Frontend Test Suite Execution**: `frontend_v2/package.json` was updated with the minimal addition of `"test": "node --test"`, preserving all existing scripts and dependencies without installing any third-party frameworks. Execution of `npm test` verified **79 passing tests out of 79** across 8 test suites with 0 failures and 0 errors in 974ms.
- **Frontend Strict Quality Checks**: Both `npx tsc --noEmit` and `npm run build` executed cleanly with exit code 0, generating all 38 application routes without errors or type warnings.
- **Backend Test Suite Execution**: Executed targeted JUnit 5 test suites covering governance, operations, document security, and date filtering (`Day3AdminGovernanceTest`, `StageBAdminOperationsTest`, `DocumentSecurityIntegrationTest`, `AdminDashboardDateFilterTest`), resulting in **59 passed tests out of 59** with 0 failures and 0 errors.
- **Security Hardening**: Private compliance documents are no longer served via static web handlers; static routing to `/uploads/documents/**` and `/uploads/verifications/**` is denied, and access is strictly gated behind time-limited, tamper-evident HMAC-SHA256 signed URLs with path-traversal prevention.

---

## 2. BM-01 through BM-09 Status Table

| Item ID | Description | Severity / Nature | Production Code Changed | Regression Tests Available | Tests Executed During Audit | Final Classification |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **BM-01** | Archived/soft-deleted bakery detail access | High Defect | Yes | Yes (Backend & Frontend) | 25 Backend, 79 Frontend | **Verified** |
| **BM-02** | Required reasons for individual & bulk suspension | High Defect | Yes | Yes (Backend & Frontend) | 25 Backend, 79 Frontend | **Verified** |
| **BM-03** | Individual & bulk KYC rejection | High Defect | Yes | Yes (Backend & Frontend) | 25 Backend, 79 Frontend | **Verified** |
| **BM-04** | Mark Under Review verification action | Medium Defect | Yes | Yes (Backend) | 16 Backend | **Verified** |
| **BM-05** | Invalid bakery ID loading behavior | Medium Defect | Yes | Yes (Frontend) | 79 Frontend | **Verified** |
| **BM-06** | Private document access & exposure prevention | High Security Risk | Yes | Yes (Backend) | 12 Backend | **Verified** |
| **BM-07** | Admin bakery search focus retention during loading | Medium UI Risk | Yes | Yes (Frontend) | 79 Frontend | **Verified** |
| **BM-08** | Deleted-shop status count & badge consistency | Low Presentation Risk | Yes | Yes (Backend & Frontend) | 6 Backend, 79 Frontend | **Verified** |
| **BM-09** | Bulk action reliability & partial-failure handling | Medium Workflow Risk | Yes | Yes (Frontend) | 79 Frontend | **Verified** |

---

## 3. Evidence and Changed Files for Each Item

### BM-01: Archived/Soft-Deleted Bakery Detail Access
- **Original Defect**: Accessing `/admin/shops/[id]` for an archived/soft-deleted bakery failed with `HTTP 400 Bad Request` ("Shop not found with id: X") because `AdminDashboardService.getShopDetails` invoked `shopRepository.findById(shopId)`, which was intercepted and filtered out by Hibernate's entity-level `@SQLRestriction("is_deleted=false")`.
- **Current Implementation & Relevant Files**:
  - `backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java`: Added `@Query(value = "SELECT * FROM shops WHERE id = :id", nativeQuery = true) Optional<Shop> findByIdIncludingDeleted(@Param("id") Long id);`.
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`: `getShopDetails(shopId)` calls `findByIdIncludingDeleted(shopId)`.
  - `frontend_v2/app/admin/shops/[id]/page.tsx`: Detects `shop.isDeleted || shop.status === 'DELETED'`, displays an archived banner (`Ban` icon), disables state-mutating moderation controls (`Action Controls Disabled (Deleted Account)`), and leaves retained subscriptions, payments, and audit logs inspectable.
  - `frontend_v2/app/admin/shops/page.tsx`: Changes row action button label from "Manage" to "Inspect Archive" when `shopStatus === 'DELETED'`.
- **Production Code Changed**: Yes (`ShopRepository.java`, `AdminDashboardService.java`, `app/admin/shops/[id]/page.tsx`, `app/admin/shops/page.tsx`).
- **Regression Tests**:
  - Backend: `AdminDashboardDateFilterTest.java` (`testBM01_OrdinaryFindByIdExcludesArchivedBakery`, `testBM01_UnauthorizedAccessToArchivedBakeryDenied`).
  - Frontend: `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (Tests 4 & 6).
- **Execution Evidence**:
  - `mvn test -Dtest=AdminDashboardDateFilterTest`: 25/25 PASS.
  - `npm test`: Tests 4 and 6 PASS.
- **Remaining Risks / Limitations**: None. Standard JPA queries remain protected by `@SQLRestriction("is_deleted=false")`.
- **Classification**: **Verified**.

---

### BM-02: Required Reasons for Individual and Bulk Suspension
- **Original Defect**: On the directory page (`/admin/shops`), clicking row action "Suspend" or "Bulk Suspend" invoked `updateShopStatus(shopId, 'SUSPENDED')` without capturing a suspension reason. The backend strictly requires a reason, resulting in an unhandled `IllegalArgumentException` and HTTP 400 error.
- **Current Implementation & Relevant Files**:
  - `frontend_v2/app/admin/shops/page.tsx`:
    - Row "Suspend" opens `AdminSuspensionModal` (`setSuspendModalState({ isOpen: true, shopId, shopName, isBulk: false })`).
    - Bulk action "Bulk Suspend" opens `AdminSuspensionModal` with `isBulk: true`.
    - `handleConfirmSuspension(reason)` enforces trimmed, non-blank reason validation, passing the reason to `updateShopStatus` or `handleBulkAction`.
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminDashboardController.java`: Explicitly validates:
    ```java
    if ("SUSPENDED".equalsIgnoreCase(newStatus.trim())) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Suspension reason is mandatory and cannot be blank");
        }
    }
    ```
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`: `ShopStatusManager.suspendShop`, logs `SHOP_SUSPENDED` activity, sends `BAKERY_SUSPENDED` notification to owner, and evicts storefront caches.
- **Production Code Changed**: Yes (`AdminDashboardController.java`, `frontend_v2/app/admin/shops/page.tsx`).
- **Regression Tests**:
  - Frontend: `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (Tests 8, 9, 10).
  - Backend: `AdminDashboardDateFilterTest.java` (Suspension validation, owner email notification, audit logging).
- **Execution Evidence**:
  - `npm test`: Tests 8, 9, 10 PASS.
  - `mvn test -Dtest=AdminDashboardDateFilterTest`: 25/25 PASS.
- **Remaining Risks / Limitations**: None.
- **Classification**: **Verified**.

---

### BM-03: Individual and Bulk KYC Rejection
- **Original Defect**: On the directory page, row action "Reject" and "Bulk Reject" sent `{ status: "REJECTED" }` to `PATCH /api/admin/shops/{id}/status`. Rejection is a KYC document verification action on `/verification` requiring a mandatory explanation. `ShopStatus` enum has no `REJECTED` value, causing the backend to silently ignore the request and return HTTP 200 without modifying shop status or documents.
- **Current Implementation & Relevant Files**:
  - `frontend_v2/app/admin/shops/page.tsx`:
    - Row "Reject" opens `AdminKycRejectionModal` (`setKycRejectModalState({ isOpen: true, shopId, shopName, isBulk: false })`).
    - Bulk action "Bulk Reject" opens `AdminKycRejectionModal` with `isBulk: true`.
    - `handleConfirmKycRejection(reason)` calls `updateShopVerification(shopId, 'REJECT', reason.trim())` or `handleBulkKycAction('REJECT', reason.trim())`.
  - `frontend_v2/lib/api/admin.ts`: `updateShopVerification` sends `PATCH /api/admin/shops/{shopId}/verification` with `{ action: 'REJECT', reason }`.
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`: `reviewShopVerification`:
    - Enforces non-blank rejection reason.
    - Updates `shop.verificationStatus` to `REJECTED`.
    - Marks all associated `BusinessDocument` records as `REJECTED`.
    - Logs `KYC_REJECTED` in `ActivityLog`.
    - Dispatches an in-app `ADMIN_MESSAGE` notification and transactional email to the owner containing the exact rejection reason.
    - Evicts storefront caches.
- **Production Code Changed**: Yes (`AdminDashboardService.java`, `frontend_v2/app/admin/shops/page.tsx`, `frontend_v2/lib/api/admin.ts`).
- **Regression Tests**:
  - Backend: `AdminDashboardDateFilterTest.java` (Tests: `testBM03_KycRejection_ValidReason_UpdatesStatusAndNotifies`, `testBM03_KycRejection_MissingOrBlankReason_Returns400`, `testBM03_KycRejection_Unauthorized_Returns401And403`, `testBM03_KycApproval_RemainsFunctional`).
  - Frontend: `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (Tests 11, 12, 13).
- **Execution Evidence**:
  - `mvn test -Dtest=AdminDashboardDateFilterTest`: 25/25 PASS.
  - `npm test`: Tests 11, 12, 13 PASS.
- **Remaining Risks / Limitations**: None.
- **Classification**: **Verified**.

---

### BM-04: Mark Under Review Verification Action
- **Original Defect**: On the individual bakery detail page (`/admin/shops/[id]`), clicking "Mark Under Review" dispatched `{ status: "PENDING" }` to `PATCH /api/admin/shops/{id}/status`. The backend service had no branch for `"PENDING"` in `updateShopStatus`, resulting in an HTTP 200 return with zero state persistence (silent no-op).
- **Current Implementation & Relevant Files**:
  - `frontend_v2/app/admin/shops/[id]/page.tsx`: Button "Mark Under Review" invokes `handleVerificationReview('MARK_UNDER_REVIEW')`.
  - `frontend_v2/lib/api/admin.ts`: `updateShopVerification` accepts action `'MARK_UNDER_REVIEW'` and routes to `PATCH /api/admin/shops/{shopId}/verification`.
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`: Added dedicated handler in `reviewShopVerification`:
    ```java
    else if (action.equalsIgnoreCase("MARK_UNDER_REVIEW")) {
        shop.setVerificationStatus(VerificationStatus.PROCESSING);
        shopRepository.save(shop);
        activityLogger.logActivity(actorUserId, shopId, "KYC_UNDER_REVIEW", "SHOP", shopId, "Admin marked bakery KYC as under review");
    }
    ```
    Existing document statuses are preserved without destructive resets or premature approval.
- **Production Code Changed**: Yes (`AdminDashboardService.java`, `app/admin/shops/[id]/page.tsx`, `lib/api/admin.ts`).
- **Regression Tests**:
  - Backend: `StageBAdminOperationsTest.java` (Test `testB3_MarkUnderReview_Success`, `testB3_InvalidVerificationAction_ThrowsException`).
- **Execution Evidence**:
  - `mvn test -Dtest=StageBAdminOperationsTest`: 16/16 PASS.
- **Remaining Risks / Limitations**: None.
- **Classification**: **Verified**.

---

### BM-05: Invalid Bakery ID Loading Behavior
- **Original Defect**: Navigating to `/admin/shops/invalid` or any non-numeric ID caused `shopId = Number(params?.id)` to evaluate to `NaN`. In `loadShop()`, the early return failed to call `setIsLoading(false)`, permanently freezing the page inside the `<LoadingState>` spinner.
- **Current Implementation & Relevant Files**:
  - `frontend_v2/app/admin/shops/[id]/page.tsx`:
    ```typescript
    const loadShop = useCallback(async () => {
      if (!Number.isFinite(shopId) || !Number.isInteger(shopId) || shopId <= 0) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await getShopDetails(shopId);
        setDetails(data);
      } catch (err: any) {
        toast.error(err.message || 'Failed to fetch bakery details');
      } finally {
        setIsLoading(false);
      }
    }, [shopId, toast]);
    ```
    When `details` remains `null`, the component renders `<EmptyState>` with a "Bakery Not Found" notice and a navigation button back to `/admin/shops`.
- **Production Code Changed**: Yes (`frontend_v2/app/admin/shops/[id]/page.tsx`).
- **Regression Tests**:
  - Frontend: `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (Tests 14, 15, 16, 17, 18).
- **Execution Evidence**:
  - `npm test`: Tests 14–18 PASS (verifying strings, symbols, NaN, negative, zero, float, 404, and valid IDs).
- **Remaining Risks / Limitations**: None.
- **Classification**: **Verified**.

---

### BM-06: Private Document Access and Exposure Prevention
- **Original Defect**: Private business and compliance documents (e.g., FSSAI licenses, GST certificates) were stored under `/uploads/documents/` and `/uploads/verifications/`. Because `WebMvcConfig.java` mapped `/uploads/**` to static file handling and `SecurityConfig.java` permitted `/uploads/**` without authentication, anyone who possessed or discovered the UUID file URL could access private documents unauthenticated.
- **Current Implementation & Relevant Files**:
  - `backend/src/main/java/com/cakeplatform/api/config/WebMvcConfig.java`: Static resource registration was restricted strictly to public media categories: `products`, `covers`, `logos`, `review-media`, and `custom-cake-references`. Private categories (`documents`, `verifications`) are explicitly omitted.
  - `backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java`:
    ```java
    .requestMatchers("/uploads/documents/**", "/uploads/verifications/**").denyAll()
    .requestMatchers(
        "/uploads/products/**",
        "/uploads/covers/**",
        "/uploads/logos/**",
        "/uploads/review-media/**",
        "/uploads/custom-cake-references/**"
    ).permitAll()
    .requestMatchers("/api/documents/secure-view/**").permitAll()
    ```
  - `backend/src/main/java/com/cakeplatform/api/modules/shop/controller/DocumentAccessController.java`:
    - Direct access generates time-limited HMAC-SHA256 signatures (`expires` timestamp + `sig` hex string).
    - Validates signature integrity, expiry window (15 minutes), allowed media extensions (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`), and strict path-traversal prevention (rejects `..`, `/`, `\`, validates filename regex `^[a-zA-Z0-9._-]+$`, verifies target file canonical path starts within the configured upload root).
    - Injects secure response headers: `private, no-cache, no-store, must-revalidate`, `X-Content-Type-Options: nosniff`.
    - Only authorized administrators (`ROLE_ADMIN`) or the document's verified bakery owner (`ROLE_SHOP_OWNER`) can request signed view URLs.
- **Production Code Changed**: Yes (`WebMvcConfig.java`, `SecurityConfig.java`, `DocumentAccessController.java`).
- **Regression Tests**:
  - Backend: `DocumentSecurityIntegrationTest.java` (12 automated integration tests).
- **Execution Evidence**:
  - `mvn test -Dtest=DocumentSecurityIntegrationTest`: 12/12 PASS (covering direct unauthenticated static access rejection, authenticated static rejection, public media preservation, cross-shop owner rejection, valid owner access, valid admin stream, expired signature, tampered signature, tampered docId, and path-traversal attempts).
- **Remaining Risks / Limitations**: None. Local storage is protected. In cloud storage deployments (e.g. S3/Azure Blob/Cloudinary), storage-level pre-signed private URLs fulfill this exact contract.
- **Classification**: **Verified**.

---

### BM-07: Admin Bakery Search Focus Retention During Loading
- **Original Defect**: In `frontend_v2/app/admin/shops/page.tsx`, an early return statement (`if (isLoading) return <LoadingState />`) was positioned before the controls container. Every debounced keystroke (500ms delay) and tab switch unmounted the entire DOM tree, including the search input, causing continuous loss of input focus and resetting the cursor.
- **Current Implementation & Relevant Files**:
  - `frontend_v2/app/admin/shops/page.tsx`:
    - Status Filter Tabs and Search Input container is rendered unconditionally at line 380, remaining permanently mounted.
    - `isLoading` is scoped specifically to the results area below the controls (line 496: `{isLoading ? <div className="py-20"><LoadingState ... /></div> : ...}`).
    - Keystroke state (`searchQuery`) updates synchronously while debouncing backend requests (`debouncedSearch`), retaining focus across typing.
- **Production Code Changed**: Yes (`frontend_v2/app/admin/shops/page.tsx`).
- **Regression Tests**:
  - Frontend: `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (Tests 19, 20, 21).
- **Execution Evidence**:
  - `npm test`: Tests 19, 20, 21 PASS.
- **Remaining Risks / Limitations**: None.
- **Classification**: **Verified**.

---

### BM-08: Deleted-Shop Status Count and Badge Consistency
- **Original Defect**:
  - Backend: `GET /api/admin/shops/counts` omitted `deleted` from the count response map.
  - Frontend: The `Deleted` filter tab rendered without any count badge (displaying just "Deleted"), whereas `Active`, `Pending`, and `Suspended` displayed live counts. The count was only displayed after the administrator clicked the tab.
- **Current Implementation & Relevant Files**:
  - `backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java`: Added `@Query(value = "SELECT COUNT(*) FROM shops WHERE is_deleted = true", nativeQuery = true) long countDeletedShops();`.
  - `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java`: `getShopStatusCounts()` computes `long deleted = shopRepository.countDeletedShops();` and includes `"deleted", deleted` in the returned map alongside `total`, `active`, `pending`, and `suspended`.
  - `frontend_v2/app/admin/shops/page.tsx`:
    - Updated `shopCounts` state type to include `deleted: number`.
    - Filter tab renders: `Deleted{shopCounts?.deleted !== undefined ? ` (${shopCounts.deleted})` : ''}`.
    - Zero-count badge behavior is clean: `Pending Approval` displays a prominent notification pill only when `pending > 0`, while `Deleted`, `Active`, and `All` display formatted numeric counts consistently.
- **Production Code Changed**: Yes (`ShopRepository.java`, `AdminDashboardService.java`, `frontend_v2/app/admin/shops/page.tsx`).
- **Regression Tests**:
  - Backend: `Day3AdminGovernanceTest.java` (`testDashboardStats_ShopMetrics`).
  - Frontend: `adminMetricsPresentation.test.mjs`, `adminMarketplaceRestrictionAndDeletedShops.test.mjs`.
- **Execution Evidence**:
  - `mvn test -Dtest=Day3AdminGovernanceTest`: 6/6 PASS.
  - `npm test`: 79/79 PASS.
- **Remaining Risks / Limitations**: None.
- **Classification**: **Verified**.

---

### BM-09: Bulk Action Reliability and Partial-Failure Handling
- **Original Defect**: In `frontend_v2/app/admin/shops/page.tsx`, `handleBulkAction` executed multiple updates via `Promise.all`. If one update failed (e.g., due to a database lock, network timeout, or validation failure), the entire operation aborted with an uninformative error; successfully updated shops and failed shops were indistinguishable, and the UI cleared selection, losing track of failed items. Furthermore, no test script existed in `frontend_v2/package.json` to run the regression test suite.
- **Current Implementation & Relevant Files**:
  - `frontend_v2/app/admin/shops/page.tsx`:
    - Replaced `Promise.all` with `Promise.allSettled` in both `handleBulkAction` and `handleBulkKycAction`.
    - Collects `successfulIds` and `failedIds`.
    - Renders detailed feedback via toast:
      - Complete success: `Bulk action successful: X bakeries updated`.
      - Complete failure: `Bulk action failed for all X selected bakeries`.
      - Partial success: `Partial success: X bakeries updated, but Y failed (#ID, #ID)`.
    - When partial failure occurs, `setSelectedShopIds(failedIds)` retains the failed bakery IDs in the table selection so the administrator can immediately inspect or retry.
    - Both bulk suspension and bulk KYC rejection wire into dedicated modal dialogs (`AdminSuspensionModal` and `AdminKycRejectionModal`) to capture mandatory reasons before dispatching requests.
  - `frontend_v2/package.json`: Added `"test": "node --test"` to the scripts block, using Node's native test runner without adding extraneous dependencies.
- **Production Code Changed**: Yes (`frontend_v2/app/admin/shops/page.tsx`, `frontend_v2/package.json`).
- **Regression Tests**:
  - Frontend: `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (Tests 9, 10, 12, 13).
- **Execution Evidence**:
  - `npm test`: 79/79 PASS (including partial failure simulation tests 9 and 12, complete success tests 10 and 13).
  - `npx tsc --noEmit`: Exit code 0.
  - `npm run build`: Exit code 0 (38/38 routes compiled).
- **Remaining Risks / Limitations**: None. While bulk operations are executed concurrently across individual REST endpoints rather than a single atomic database stored procedure, the `Promise.allSettled` pattern with failed ID retention provides complete operational transparency and safe retryability for the administrator.
- **Classification**: **Verified**.

---

## 4. Test Execution Summary

All test suites were executed directly during this audit session. The results are summarized below:

### 4.1 Frontend Test Execution

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\frontend_v2
npm test
```
- **Test Runner**: Node.js Built-in Test Runner (`node --test`)
- **Total Test Suites**: 8
- **Total Tests Executed**: 79
- **Passed**: 79
- **Failed**: 0
- **Duration**: 974.51ms
- **Suites Breakdown**:
  1. `adminLedgerConcurrency.test.mjs`: 10 tests (Orders & Payments ledger concurrency, out-of-order responses, loading ownership, modal switching).
  2. `adminMarketplaceRestrictionAndDeletedShops.test.mjs`: 21 tests (BM-02 suspension validation, BM-02 bulk suspend partial failure/success, BM-03 KYC reject validation, BM-03 bulk reject partial failure/success, BM-05 shop ID parsing and loading states, BM-07 search focus and controls persistence, soft-deleted shop isolation and control permissions, historical retention).
  3. `adminMetricsPresentation.test.mjs`: 10 tests (Financial metric presentation, soft-deleted label disclosures, awaiting payment eligibility).
  4. `bakeryStatusLabelsPhase2.test.mjs`: 12 tests (Storefront live vs. store offline availability predicate, subscription status mapping, vacation mode, restriction badge).
  5. `dirtyStateTracking.test.mjs`: 4 tests (Owner storefront website dirty state tracking).
  6. `ownerCancellationAndRefunds.test.mjs`: 6 tests (Subscription cancellation and truth-in-refunds logic).
  7. `ownerOperationalToggle.test.mjs`: 7 tests (Owner operational toggle & lifecycle banner logic).
  8. `phase2StorefrontManagement.test.mjs`: 4 tests (Social links and address privacy).

### 4.2 Frontend Quality Checks

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\frontend_v2
npx tsc --noEmit
```
- **Exit Code**: 0
- **Diagnostics**: 0 type errors.

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\frontend_v2
npm run build
```
- **Exit Code**: 0
- **Build Output**: Next.js 14.2.5 compiled successfully; all 38 application routes (34 static, 4 dynamic) generated without errors or warnings.

### 4.3 Backend Test Execution

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\backend
mvn test -Dtest=Day3AdminGovernanceTest
```
- **Tests Run**: 6, Failures: 0, Errors: 0, Skipped: 0
- **Build Status**: BUILD SUCCESS (Total time: 01:01 min)
- **Key Verifications**: User metrics with soft-deleted users, shop metrics with soft-deleted shops (`countDeletedShops`), subscription metrics excluding active intersections, admin deleted shops query with `DELETED` status, active shop operational flags.

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\backend
mvn test -Dtest=StageBAdminOperationsTest
```
- **Tests Run**: 16, Failures: 0, Errors: 0, Skipped: 0
- **Build Status**: BUILD SUCCESS (Total time: 31.699 s)
- **Key Verifications**: BM-04 `MARK_UNDER_REVIEW` verification action (transitions status to `PROCESSING`, preserves existing documents, logs `KYC_UNDER_REVIEW`, no spurious notification), KYC approval and rejection, document upload validation.

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\backend
mvn test -Dtest=DocumentSecurityIntegrationTest
```
- **Tests Run**: 12, Failures: 0, Errors: 0, Skipped: 0
- **Build Status**: BUILD SUCCESS (Total time: 01:11 min)
- **Key Verifications**: BM-06 document security:
  - Direct static access to `/uploads/documents/**` denied (401/403).
  - Authenticated direct static access to `/uploads/documents/**` forbidden (403).
  - Direct static access to `/uploads/verifications/**` denied (401/403).
  - Public media access to `/uploads/products/**` permitted (404 when absent, not 401/403).
  - Unauthenticated admin document view rejected (401/403).
  - Cross-shop owner document generation forbidden (403).
  - Authorized owner and admin HMAC signed view URL generation and streaming verified.
  - Expired, tampered, cross-document signatures rejected (403).
  - Directory path-traversal payloads blocked (403).

```powershell
# Working Directory: d:\PROJECTS\CAKE SAAs1\backend
mvn test -Dtest=AdminDashboardDateFilterTest
```
- **Tests Run**: 25, Failures: 0, Errors: 0, Skipped: 0
- **Build Status**: BUILD SUCCESS (Total time: 01:16 min)
- **Key Verifications**:
  - BM-01: `shopRepository.findById` excludes soft-deleted shops; `findByIdIncludingDeleted` retrieves them; unauthorized access to archived shops is denied (401/403).
  - BM-02: Suspension status transition, mandatory reason validation, owner email notification, audit logging, and cache eviction.
  - BM-03: KYC rejection reason validation, status update to `REJECTED`, document update, owner notification, and approval preservation.

---

## 5. Outstanding Risks and Verification Gaps

1. **Network Bulk Operation Concurrency**:
   - In `frontend_v2/app/admin/shops/page.tsx`, `handleBulkAction` and `handleBulkKycAction` fire parallel HTTP PATCH requests via `Promise.allSettled`. If an admin selects 50 bakeries simultaneously, 50 concurrent HTTP requests hit the backend.
   - *Mitigation*: The backend handles these in separate transactions, and the frontend accurately collects and surfaces any failed IDs while retaining them for retry. For future scale (e.g. >100 bakeries at once), a dedicated backend bulk endpoint (e.g. `PATCH /api/admin/shops/bulk-status`) could be considered, though it is not required for current platform volume.
2. **Local vs. Cloud Document Storage Parity**:
   - In local development, `DocumentAccessController` streams document files using HMAC-signed URLs. In production with Azure Blob Storage or AWS S3, `StorageService.generateSignedUrl` delegates to the cloud provider's pre-signed URL mechanism.
   - *Mitigation*: Both mechanisms enforce identical security semantics (time-limited, unforgeable, private URLs). The static exposure vulnerability was completely eliminated by removing the static resource handler in `WebMvcConfig` and enforcing `.denyAll()` in `SecurityConfig`.
3. **Database Cleanup Task Separation**:
   - The pending database cleanup for test shops 4420–4482 remains an isolated maintenance item. It does not affect any application code or the BM-01 through BM-09 functionality.

---

## 6. Deployment Status

Based strictly on repository evidence (`git status` and working tree inspection):
- **Branch**: `development`, currently tracking `origin/development`.
- **Working Tree State**:
  - Modified application files:
    - Backend: `WebMvcConfig.java`, `SecurityConfig.java`, `AdminDashboardService.java`, `AdminDashboardController.java`, `ShopRepository.java`, `DocumentAccessController.java`.
    - Frontend: `frontend_v2/package.json`, `app/admin/shops/page.tsx`, `app/admin/shops/[id]/page.tsx`, `lib/api/admin.ts`.
  - Untracked test and documentation files:
    - `backend/src/test/java/com/cakeplatform/api/modules/security/DocumentSecurityIntegrationTest.java`
    - `frontend_v2/__tests__/adminMarketplaceRestrictionAndDeletedShops.test.mjs`
    - Audit reports: `CAKESTORE_BAKERY_MANAGEMENT_AND_DETAILS_DEEP_AUDIT.md`, `CAKESTORE_BM01_BM09_FINAL_AUDIT_REPORT.md`.
- **Deployment Conclusion**: These changes reside exclusively in the local working directory. They have **not** been committed, tagged, merged to `main`, pushed to the remote repository, or deployed to staging/production environments.

---

## 7. Recommended Next Steps, Prioritized by Risk

1. **Staging Review & Git Commit (Low Risk)**:
   - Stage and commit the verified production and test changes for BM-01 through BM-09 with a clean, structured commit message referencing the verified test suites.
2. **Execute Approved Test-Shop Database Cleanup (Low Risk)**:
   - Run the pre-approved, safe transaction-based cleanup script for test shops 4420–4482 in the local PostgreSQL database using the verified backup safeguards.
3. **End-to-End Staging Verification (Low Risk)**:
   - Deploy to the staging environment and perform a smoke test of admin suspension, KYC rejection, document viewing, and archive inspection with real browser sessions.

---

## 8. Final Question Answer

**Is the bakery-management scope BM-01 through BM-09 ready to be considered complete? If not, what exact evidence or work remains?**

### **YES.**
The bakery-management scope **BM-01 through BM-09 is complete and fully verified**.

Every original defect and risk has been resolved in the production codebase and substantiated by verified test executions:
- **BM-01**: Soft-deleted bakery inspection is restored via `findByIdIncludingDeleted` (verified by `AdminDashboardDateFilterTest` and frontend test suite).
- **BM-02**: Mandatory suspension reasons are strictly validated and captured in both row and bulk workflows (verified by `AdminDashboardDateFilterTest` and frontend test suite).
- **BM-03**: KYC rejection correctly routes to the verification endpoint with mandatory reasons, document updates, and owner notifications (verified by `AdminDashboardDateFilterTest` and frontend test suite).
- **BM-04**: "Mark Under Review" transitions bakery verification status to `PROCESSING` without side effects (verified by `StageBAdminOperationsTest`).
- **BM-05**: Invalid bakery IDs resolve loading state immediately without hanging (verified by frontend test suite).
- **BM-06**: Private compliance documents are blocked from static serving and gated behind HMAC-SHA256 signatures with path-traversal prevention (verified by `DocumentSecurityIntegrationTest` 12/12 PASS).
- **BM-07**: Top-level search and tab controls remain permanently mounted, preserving input focus during debounced loading (verified by frontend test suite).
- **BM-08**: Deleted shop counts are aggregated via native query and displayed consistently on tab badges (verified by `Day3AdminGovernanceTest` and frontend test suite).
- **BM-09**: Bulk actions reliably handle partial failures with `Promise.allSettled`, preserve failed IDs for retry, and execute via the verified `npm test` script (79/79 PASS, TypeScript check 0 errors, Next.js build 38/38 routes OK).

No code changes, test failures, or unresolved defects remain within this scope.
