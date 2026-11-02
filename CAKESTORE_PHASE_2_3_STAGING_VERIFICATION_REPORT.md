   # CakeStore — Phase 2.3 Staging Verification & V56 Migration Audit Report

   **Date:** November 2, 2026  
   **Auditor:** Antigravity (Google DeepMind Advanced Agentic Coding)  
   **Target Environment:** Local Staging (`127.0.0.1:5432/cake_platform`, Spring Boot 3.3.2, Next.js 14)  
   **Execution Mode:** STRICTLY READ-ONLY (No mutations, no DDL execution, no server restarts)  
   **Final Verdict:** ⚠️ **VERIFIED WITH CONDITIONS**  

   ---

   ## 1. Executive Summary

   A comprehensive, strictly read-only audit of CakeStore Phase 2.3 (Saved Customer Addresses & Checkout Integration) was conducted across the source code, PostgreSQL database, Flyway schema history, API contracts, and test execution evidence.

   ### Summary of Audit Findings
   1. **Codebase Implementation (PASS):** The backend services, controllers, DTOs, domain models, and Next.js frontend checkout/profile components are completely implemented and verified by automated regression test suites (72/72 backend tests pass, 294/294 frontend tests pass).
   2. **Flyway V56 Migration File (PASS):** `V56__enhance_customer_addresses_schema.sql` exists in `backend/src/main/resources/db/migration`, adheres to PostgreSQL dialect, contains all 9 structured address columns, backfill logic, and index creation.
   3. **Database Schema State in Staging (FAIL / PENDING):** Inspection of `flyway_schema_history` in `cake_platform` revealed that the staging database is currently at **V53** (installed on `2026-10-24 18:34:09`). Migrations V54, V55, and V56 have not yet been applied to the live PostgreSQL instance. Consequently, the live `customer_addresses` table currently retains its legacy V43 schema without the 9 new columns.
   4. **Live Staging Services (NOT EXECUTED):** Neither the backend application (`localhost:8080`) nor the frontend (`localhost:3000`) is currently running. Per strict audit safety rules, starting or deploying services or running Flyway migrations was not performed.
   5. **Verdict Rationale:** The implementation is code-complete and architecturally sound, but **VERIFIED WITH CONDITIONS** pending the execution of the Spring Boot application boot lifecycle which automatically runs Flyway to apply V54-V56 to the staging database.

   ---

   ## 2. Flyway V56 Migration Verification

   | Check Item | Description | Status | Evidence / Observation |
   |---|---|:---:|---|
   | Migration File Presence | `V56__enhance_customer_addresses_schema.sql` exists in repository | **PASS** | `backend/src/main/resources/db/migration/V56__enhance_customer_addresses_schema.sql` (1,251 bytes, 30 lines) |
   | Schema Specification Match | File contains all required columns, types, and constraints | **PASS** | Verified columns: `address_line_1`, `address_line_2`, `landmark`, `city`, `state`, `pincode`, `address_type`, `latitude`, `longitude` |
   | Flyway Schema History in DB | V56 recorded in `flyway_schema_history` table | **FAIL** | Latest recorded migration in `flyway_schema_history` is **V53** (`installed_rank: 53`, `2026-10-24 18:34:09`). V54, V55, and V56 are not yet installed in `cake_platform`. |
   | Migration Success Flag in DB | V56 status is `success = true` in DB | **NOT EXECUTED** | Not recorded in database yet. |
   | Backfill Execution in DB | Existing rows backfilled from `delivery_address` and `label` | **NOT EXECUTED** | Migration has not been applied to staging DB yet. Currently 0 rows exist in `customer_addresses`. |

   ---

   ## 3. Actual Database Schema Verification

   Inspection executed via `psql (PostgreSQL 18.4)` directly querying `127.0.0.1:5432/cake_platform`:

   ### Table Structure: `public.customer_addresses`
   ```text
         Column      |            Type             | Collation | Nullable |                    Default                     
   ------------------+-----------------------------+-----------+----------+------------------------------------------------
   id               | bigint                      |           | not null | nextval('customer_addresses_id_seq'::regclass)
   user_id          | bigint                      |           | not null | 
   label            | character varying(50)       |           | not null | 
   recipient_name   | character varying(255)      |           | not null | 
   recipient_phone  | character varying(50)       |           | not null | 
   delivery_address | text                        |           | not null | 
   is_default       | boolean                     |           | not null | false
   created_at       | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
   updated_at       | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
   ```

   ### Column Verification Breakdown

   | Expected Column | Expected Type | Present in Live DB | Status | Details |
   |---|---|:---:|:---:|---|
   | `address_line_1` | `VARCHAR(255)` | **NO** | **FAIL** | Pending V56 migration |
   | `address_line_2` | `VARCHAR(255)` | **NO** | **FAIL** | Pending V56 migration |
   | `landmark` | `VARCHAR(255)` | **NO** | **FAIL** | Pending V56 migration |
   | `city` | `VARCHAR(100)` | **NO** | **FAIL** | Pending V56 migration |
   | `state` | `VARCHAR(100)` | **NO** | **FAIL** | Pending V56 migration |
   | `pincode` | `VARCHAR(10)` | **NO** | **FAIL** | Pending V56 migration |
   | `address_type` | `VARCHAR(20)` | **NO** | **FAIL** | Pending V56 migration |
   | `latitude` | `DOUBLE PRECISION` | **NO** | **FAIL** | Pending V56 migration |
   | `longitude` | `DOUBLE PRECISION` | **NO** | **FAIL** | Pending V56 migration |

   ### Indexes on `customer_addresses`
   - `customer_addresses_pkey` (PRIMARY KEY, btree `id`): **PASS** (Present)
   - `idx_customer_addresses_user_id` (btree `user_id`): **PASS** (Present)
   - `idx_customer_addresses_user_default` (btree `user_id, is_default`): **FAIL** (Not yet created in live DB; defined in V56)

   ---

   ## 4. Backend API Verification Matrix

   Because the backend server (`localhost:8080`) was not running and cannot be started under the read-only audit safety instructions, live HTTP requests against the staging network were **NOT EXECUTED**. 

   The verification was performed via strict source-code contract analysis and verified unit/integration test suite executions:

   | API Operation / Invariant | Implementation File | Verification Method | Status | Findings |
   |---|---|---|:---:|---|
   | `GET /api/customer/addresses` | `CustomerAddressController.java:26` | Code Audit & `CustomerAddressControllerTest` | **PASS** | Scoped strictly to `@AuthenticationPrincipal CustomUserDetails userDetails.getId()`. Returns HTTP 200 with list of `CustomerAddressResponse`. |
   | `GET /api/customer/addresses/{id}` | `CustomerAddressController.java:35` | Code Audit & `CustomerAddressControllerTest` | **PASS** | Validates `findByIdAndCustomerId`. Throws 404/400 if not found or unauthorized. |
   | `POST /api/customer/addresses` | `CustomerAddressController.java:45` | Code Audit & `CustomerAddressServiceTest` | **PASS** | Validates required fields, PIN code, and mobile. First address defaults to `is_default=true`. |
   | `PUT /api/customer/addresses/{id}` | `CustomerAddressController.java:56` | Code Audit & `CustomerAddressControllerTest` | **PASS** | Updates structured fields, syncs formatted address, respects default status. |
   | `DELETE /api/customer/addresses/{id}` | `CustomerAddressController.java:67` | Code Audit & `CustomerAddressServiceTest` | **PASS** | Returns HTTP 204. Automatically reassigns default to oldest remaining address if deleted address was default. |
   | `PATCH /api/customer/addresses/{id}/default` | `CustomerAddressController.java:78` | Code Audit & `CustomerAddressControllerTest` | **PASS** | Unsets all other defaults for that customer and sets target address as `is_default=true`. |
   | `PUT /api/customer/addresses/{id}/default` | `CustomerAddressController.java:89` | Code Audit & `CustomerAddressControllerTest` | **PASS** | Backward-compatible alias matching PATCH behavior. |
   | Backward Compatibility: `/api/customer/profile/addresses` | `CustomerProfileController.java:46-106` | Code Audit | **PASS** | Delegates all calls directly to `CustomerProfileService` -> `CustomerAddressService`. |
   | Indian PIN Code Validation | `CustomerAddressService.java:24,180` | `CustomerAddressServiceTest` | **PASS** | Strictly validates regex `^[1-9][0-9]{5}$`. Rejects letters, non-6 digits, and leading zeros. |
   | Single Default Invariant | `CustomerAddressService.java:65,142` | `CustomerAddressServiceTest` | **PASS** | `clearDefaultAddress(customerId)` executes before assigning a new default. |
   | Multi-Tenant / Ownership Isolation | `CustomerAddressService.java:46,85,108` | `CustomerAddressServiceTest` | **PASS** | Queries always pair `addressId` with `customerId`. Cross-tenant manipulation impossible. |

   ---

   ## 5. Frontend Staging Verification Matrix

   Inspected in `frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx` and `StorefrontProfileTab.tsx`:

   | Capability / Interaction | Code Location | Status | Details |
   |---|---|:---:|---|
   | Display Saved Address Cards | `StorefrontCheckoutTab.tsx:1366-1413` | **PASS** | Renders cards in grid with radio selection, `HOME`, `WORK`, `OTHER` badges with Lucide icons (`Home`, `Briefcase`, `Building2`), and multi-line structured address. |
   | Address Type & Default Badges | `StorefrontCheckoutTab.tsx:1383-1393` | **PASS** | Displays uppercase badge for type and green pill for `Default`. |
   | 1-Click Address Selection | `StorefrontCheckoutTab.tsx:322-378` | **PASS** | `handleSelectSavedAddress` populates `deliveryAddress`, `customerName`, `customerPhone`, and `deliveryPincode`. |
   | Cart Preservation during Address Modal | `StorefrontCheckoutTab.tsx:2260-2388` | **PASS** | Opening/closing the modal toggles `isAddAddressModalOpen` without mutating `items`, `totalPrice`, or cart state. |
   | Add New Address Modal Inputs | `StorefrontCheckoutTab.tsx:2270-2365` | **PASS** | Structured inputs for Recipient Name, Phone, Address Line 1, Line 2, Landmark, City, State, and 6-digit PIN code. Checkboxes for "Save to profile" and "Make default". |
   | Delivery Destination Review Card | `StorefrontCheckoutTab.tsx:1960-1988` | **PASS** | Summary sidebar displays destination preview with recipient name, phone, address, and PIN code before payment. |
   | Store Pickup Option Availability | `StorefrontCheckoutTab.tsx:1279-1331` | **PASS** | Radio option for "Bakery Store Pickup" with FREE (₹0) charge and bakery address card. |
   | Guest Checkout Flow Preservation | `StorefrontCheckoutTab.tsx:1422-1450` | **PASS** | Manual address and PIN code inputs remain fully accessible to unauthenticated guests. |

   ---

   ## 6. Delivery Eligibility Integration

   The integration with `DeliveryEligibilityService.java` was verified:

   | Check Item | Evidence | Status |
   |---|---|:---:|
   | `deliveryPincode` Forwarded to Quote | `StorefrontCheckoutTab.tsx:367, 472, 673` forwards `deliveryPincode` to `storefrontApi.calculateQuote` | **PASS** |
   | `deliveryPincode` Forwarded to Order | `StorefrontCheckoutTab.tsx:815` forwards `deliveryPincode` to `ordersApi.createGuestOrder` | **PASS** |
   | Rejection Reason Display | `StorefrontCheckoutTab.tsx:1453-1469` displays red warning banner with `addressEligibility.rejectionReason` when `quote.canDeliver === false` | **PASS** |
   | Switch to Store Pickup CTA | Warning banner provides a 1-click button: `"Switch to Bakery Store Pickup instead"` | **PASS** |
   | Store Pickup Bypass | `DeliveryEligibilityService.java:153-157` allows pickup unconditionally with ₹0 fee | **PASS** |
   | Owner Autonomy Preserved | Delivery fees, thresholds, and serviceable PIN lists are read from each shop's `ShopDeliveryConfig` without global hardcoding | **PASS** |

   ---

   ## 7. Security Verification

   | Security Control | Implementation | Status |
   |---|---|:---:|
   | Role Authorization | `@PreAuthorize("hasAuthority('ROLE_CUSTOMER')")` on all address endpoints | **PASS** |
   | Anonymous Access Control | Anonymous requests receive HTTP 401 | **PASS** |
   | Cross-Tenant Protection | Scoped by `findByIdAndCustomerId`; unauthorized address IDs return error | **PASS** |
   | PII Exposure in Logs | Service logs only `id` and `customerId` (`log.info("Saved new customer address id={} for customer id={}", ...)`); zero customer names, phone numbers, or street addresses logged | **PASS** |
   | Credential Masking | Passwords and JWT secrets are absent from address responses | **PASS** |

   ---

   ## 8. Regression Verification

   | Test Suite | Test Type | Total Tests | Passed | Failed | Status |
   |---|---|:---:|:---:|:---:|:---:|
   | `CustomerAddressServiceTest` | Backend Unit | 11 | 11 | 0 | **PASS** |
   | `CustomerAddressControllerTest` | Backend Integration | 7 | 7 | 0 | **PASS** |
   | `DeliveryEligibilityServiceTest` | Backend Integration | 22 | 22 | 0 | **PASS** |
   | `CustomerStorefrontDeliveryGeofencingTest` | Backend Integration | 9 | 9 | 0 | **PASS** |
   | `OperatingHoursServiceTest` | Backend Unit | 13 | 13 | 0 | **PASS** |
   | `CustomerStorefrontOpenNowAndMapTest` | Backend Integration | 5 | 5 | 0 | **PASS** |
   | `OwnerStorefrontDeliveryZoneSecurityTest` | Backend Integration | 3 | 3 | 0 | **PASS** |
   | `GeocodingLoggingSecurityTest` | Backend Integration | 2 | 2 | 0 | **PASS** |
   | **Total Backend Verification** | — | **72** | **72** | **0** | **PASS (100%)** |
   | `customerSavedAddresses.test.mjs` | Frontend Unit | 8 | 8 | 0 | **PASS** |
   | Full Frontend Suite (21 files) | Frontend Suites | 294 | 294 | 0 | **PASS (100%)** |

   ---

   ## 9. Issues, Discrepancies, and Unverified Items

   1. **Pending Flyway Migrations V54–V56 in Staging Database:**
      - **Observation:** PostgreSQL `cake_platform` database has only applied migrations up to V53. Migrations V54 (`add_delivery_zone_geofencing`), V55 (`add_timezone_to_shops`), and V56 (`enhance_customer_addresses_schema`) have not yet been applied.
      - **Root Cause:** In the standard deployment pipeline, Flyway migrations run automatically upon Spring Boot backend startup (`spring.flyway.enabled: true`). The backend application was not running prior to this audit.
      - **Action Required for Deployment Team:** Start the backend Spring Boot application (`mvn spring-boot:run` or via systemd/docker). Spring Boot will automatically detect and execute migrations V54, V55, and V56 sequentially.
   2. **Live HTTP Staging Endpoints Not Executed:**
      - **Observation:** Live network calls to `http://localhost:8080/api/customer/addresses` could not be executed because the server is offline and audit rules explicitly forbid starting/restarting servers.
      - **Mitigation:** Comprehensive MockMvc and unit tests confirmed 100% test pass rate for all endpoints.

   ---

   ## 10. Final Verdict

   ### **VERIFIED WITH CONDITIONS** ⚠️

   - **Code Quality & Architecture:** **VERIFIED (PASS)**.
   - **Unit & Integration Test Coverage:** **VERIFIED (PASS - 72/72 Backend, 294/294 Frontend)**.
   - **Security & Data Privacy:** **VERIFIED (PASS)**.
   - **Checkout & Geofencing Integration:** **VERIFIED (PASS)**.
   - **Staging Database Application Condition:** **PENDING BACKEND STARTUP**. The staging PostgreSQL database must have migrations V54–V56 applied via Spring Boot's automatic Flyway migration runner upon next startup.

