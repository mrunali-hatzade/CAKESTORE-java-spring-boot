   # CakeStore — Phase 2.6.1: Customer Authentication & Identity Deep Technical Audit Report

   **Audit Date:** November 2, 2026  
   **Environment:** Local Staging (`127.0.0.1:5432/cake_platform`, Flyway V57)  
   **Audit Type:** Strictly Read-Only Architecture, Security, API & Customer Identity Verification  
   **Auditor:** Antigravity AI Engineering Assistant  
   **Final Verdict:** **`READY FOR PHASE 2.6.2 IMPLEMENTATION`**

   ---

   ## 1. Executive Summary

   CakeStore's core business requirement dictates that the customer shopping experience must be **completely guest-friendly**:
   - Customers must **NEVER** be forced to register separately.
   - Customers must **NEVER** have to create a password or remember credentials.
   - Customers must be able to discover cakes, add items to the cart, enter their contact and delivery details, and verify their mobile number via a simple 6-digit OTP during checkout.
   - The platform backend must **automatically create or associate a persistent customer identity** using that verified phone number.
   - Repeat orders across any bakery must seamlessly attach to that same identity, and customers must be able to view their complete order history and saved delivery addresses across all bakeries using only their phone number and OTP.

   This deep technical audit evaluated the existing codebase across frontend React contexts, Next.js components, Spring Boot services, security filters, PostgreSQL database tables, and automated test suites.

   ### Key Audit Findings:
   1. **Passwordless Identity Engine is Already Present and Functional:**
      - The backend `GuestOtpService.java` automatically creates a `User` entity with `role = CUSTOMER` upon successful OTP verification.
      - If the customer identity already exists for that phone number, `GuestOtpService` reuses it without creating duplicates.
      - If the customer was previously soft-deleted, `GuestOtpService` resurrects the record (`user.setDeleted(false)`), preventing unique index collisions.
   2. **Checkout OTP Gating is Fully Integrated in Frontend:**
      - In `StorefrontCheckoutTab.tsx`, order placement detects whether the current session is authenticated for the entered phone number (`!customerAuth.isAuthenticated || customerAuth.phone !== cleanPhone`).
      - If unverified, the 6-digit OTP verification modal opens, dispatches OTP via SMS and/or Email, and upon verification automatically proceeds to place the order with the returned `ROLE_CUSTOMER` JWT token.
      - If the customer is already verified for that phone number, the OTP modal is skipped completely.
   3. **Multi-Bakery Order Association Operates Authoritatively:**
      - `OrderRepository.findVisibleOrdersByCustomerPhone` retrieves orders across **all shops** matching the customer's phone number, ensuring buyers have unified visibility of their order history.
   4. **Primary Architectural Gaps to Address in Phase 2.6.2:**
      - **Marketplace Navbar Disconnect (`Navbar.tsx`):** The main navigation header only reads `AuthContext.tsx` (owners/admins). It shows "Owner Login" even when a customer has an active OTP session, and offers no customer profile dropdown, saved address shortcut, or customer logout.
      - **Missing Standalone Customer Portal Route:** There is no `/account` or `/profile` page. Customers can only view their profile and saved addresses by entering an individual bakery's storefront (`/shop/[id]?tab=profile`).
      - **Customer Name & Email Sync Gap:** `GuestOtpService.verifyOtp` initializes the `User` with `mobile` and `role = CUSTOMER`, but leaves `fullName` and `email` null. When a customer enters their name and email during checkout, these fields are saved on the `Order`, but not propagated to the persistent `User` profile.
      - **Dead Code in `frontend_v2/app/checkout/page.tsx`:** 460 lines of unmaintained legacy checkout code remain behind a client redirect to `/shop/${currentShopId}?tab=checkout`.

   ---

   ## 2. Existing Architecture

   CakeStore maintains an intentional **dual-authentication model** separating bakery owners/administrators from buyers/customers:

   ```
   ┌─────────────────────────────────────────────────────────────────────────────────┐
   │                           CakeStore Authentication Systems                      │
   ├───────────────────────────────────┬─────────────────────────────────────────────┤
   │   Owner & Admin Identity          │   Customer / Buyer Identity                 │
   ├───────────────────────────────────┼─────────────────────────────────────────────┤
   │ • Handled by AuthContext.tsx      │ • Handled by CustomerAuthContext.tsx        │
   │ • Credential: Email + Password    │ • Credential: Phone Number + 6-digit OTP    │
   │ • Storage: localStorage (auth_token)│ • Storage: sessionStorage (guestToken)   │
   │ • Roles: ROLE_SHOP_OWNER, ADMIN   │ • Roles: ROLE_CUSTOMER                      │
   │ • Scope: Bakery management / admin│ • Scope: Cart, checkout, addresses, orders  │
   └───────────────────────────────────┴─────────────────────────────────────────────┘
   ```

   ### Key Modules and File Locations
   | Layer | File / Module | Responsibility |
   |---|---|---|
   | **Frontend Auth Context** | `frontend_v2/lib/auth/CustomerAuthContext.tsx` | Manages customer session (`cakeStoreGuestToken`, `cakeStoreGuestPhone`) in `sessionStorage`. |
   | **Frontend Checkout** | `frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx` | Form validation, address selector, inline OTP trigger, order submission, Razorpay initiation. |
   | **Frontend Tracking Modal** | `frontend_v2/components/customer/common/CustomerOrderLookupModal.tsx` | Phone + OTP lookup or direct order number lookup from marketplace header. |
   | **Frontend Address Selector**| `frontend_v2/components/customer/storefront/CustomerAddressSelector.tsx` | Address card rendering, default badge, selection callback. |
   | **Backend OTP Service** | `backend/.../modules/auth/service/GuestOtpService.java` | Secure OTP generation, hashing, dispatch, attempt tracking, and user hydration. |
   | **Backend Tracking Controller** | `backend/.../modules/storefront/GuestTrackingController.java` | `/api/customer/storefront/tracking/*` (OTP request, verify, customer order list). |
   | **Backend Customer Profile** | `backend/.../modules/user/controller/CustomerProfileController.java` | `/api/customer/profile` (Profile details and addresses under `ROLE_CUSTOMER`). |
   | **Backend Customer Addresses** | `backend/.../modules/user/controller/CustomerAddressController.java` | `/api/customer/addresses` (V56 address CRUD and default address toggle). |
   | **Backend Storefront Orders** | `backend/.../modules/storefront/CustomerStorefrontController.java` | `/api/storefront/shops/{shopId}/orders` (Order creation with user linkage). |
   | **Backend Security Filters** | `backend/.../security/JwtAuthenticationFilter.java` & `JwtService.java` | Validates JWT, extracts `granted_role = CUSTOMER`, scopes Spring authorities. |

   ---

   ## 3. Complete Customer Authentication Flow

   ```mermaid
   sequenceDiagram
      autonumber
      actor Customer as Buyer (Customer)
      participant UI as StorefrontCheckoutTab / LookupModal
      participant AuthCtx as CustomerAuthContext (sessionStorage)
      participant TrackCtrl as GuestTrackingController
      participant OtpSvc as GuestOtpService
      participant DB as PostgreSQL (users & otp_verifications)
      participant Comm as Twilio SMS / Resend Email

      Customer->>UI: Enters Mobile Number (+91 9876543210)
      UI->>AuthCtx: requestOtp(phone, email)
      AuthCtx->>TrackCtrl: POST /api/customer/storefront/tracking/request-otp
      TrackCtrl->>OtpSvc: requestOtp(phone, email)
      OtpSvc->>DB: Check resend cooldown (< 60s) & invalidate old OTPs
      OtpSvc->>DB: Save OtpVerification (hashed OTP, expires in 10m, attempts=0)
      OtpSvc->>Comm: Dispatch 6-digit code via SMS / Email
      OtpSvc-->>UI: OtpDeliveryResponse (channel, masked targets)
      UI-->>Customer: Displays OTP Modal with 60s countdown
      Customer->>UI: Enters 6-digit OTP (e.g. 123456)
      UI->>AuthCtx: verifyOtp(phone, otp)
      AuthCtx->>TrackCtrl: POST /api/customer/storefront/tracking/verify-otp
      TrackCtrl->>OtpSvc: verifyOtp(phone, otp)
      OtpSvc->>DB: Verify BCrypt match & increment attempt count
      OtpSvc->>DB: Find user by mobile (including deleted)
      alt User does not exist
         OtpSvc->>DB: INSERT into users (mobile, role='CUSTOMER', status='ACTIVE')
      else User is deleted
         OtpSvc->>DB: UPDATE users SET is_deleted=false
      end
      OtpSvc->>OtpSvc: Generate JWT with extra claim granted_role='CUSTOMER'
      OtpSvc-->>AuthCtx: Return JWT Token string
      AuthCtx->>AuthCtx: Persist cakeStoreGuestToken & cakeStoreGuestPhone in sessionStorage
      AuthCtx-->>UI: Session established (isAuthenticated=true)
      UI->>UI: Auto-execute order placement with JWT token
   ```

   ---

   ## 4. Guest Checkout Flow

   ### 4.1 Step-by-Step Checkout Flow (`StorefrontCheckoutTab.tsx`)
   1. **Cart Retrieval:**
      - Reads items from `useCart()`. Enforces single-shop cart scoping (`currentShopId`).
   2. **Identity Hydration (If session active):**
      - If `customerAuth.isAuthenticated` is true, calls `customerProfileApi.getProfile(token)` and `customerProfileApi.getAddresses(token)`.
      - Pre-fills `customerName` and `customerEmail` if available.
      - Populates saved addresses and selects the default address.
   3. **Form Completion:**
      - Customer enters/edits: Name, 10-digit mobile number, email, delivery street address, delivery PIN code, delivery date, time slot, and payment method (COD or ONLINE).
   4. **Authoritative Quote Re-validation:**
      - Calls `storefrontApi.calculateQuote(shopId, quotePayload)` to ensure delivery geofencing, item prices, addons, and delivery fees match server authoritative amounts.
   5. **OTP Verification Trigger:**
      - Inspects `customerAuth`:
      ```tsx
      if (!customerAuth.isAuthenticated || customerAuth.phone !== cleanPhone) {
         await customerAuth.requestOtp(cleanPhone, customerEmail.trim());
         setShowOtpModal(true);
         return; // Pauses order placement
      }
      ```
      - If the customer already verified that exact phone number in the current session, OTP is **skipped**.
   6. **Order Placement (`executeOrderPlacement`):**
      - Dispatches `ordersApi.createGuestOrder(shop.id, orderData, tokenToUse)`.
      - Attaches `Authorization: Bearer <tokenToUse>`.
   7. **Payment & Confirmation:**
      - If `COD`: Displays order confirmation screen immediately and clears cart.
      - If `ONLINE`: Launches Razorpay SDK modal via `paymentsService.openCustomerRazorpayCheckout`. Upon signature verification (`POST /verify-payment`), shows confirmed order screen and clears cart.

   ---

   ## 5. Automatic Customer Identity Creation & Lookup

   ### 5.1 Backend Logic in `GuestOtpService.java`
   ```java
   // Hydrate Customer Account
   com.cakeplatform.api.modules.user.User user = 
      userRepository.findByMobileIncludingDeleted(normalizedPhone).orElse(null);

   if (user == null) {
      user = new com.cakeplatform.api.modules.user.User();
      user.setMobile(normalizedPhone);
      user.setRole(com.cakeplatform.api.modules.user.UserRole.CUSTOMER);
      user = userRepository.save(user);
   } else if (user.isDeleted()) {
      user.setDeleted(false);
      user = userRepository.save(user);
   }

   // Issue CUSTOMER JWT
   com.cakeplatform.api.security.CustomUserDetails userDetails = 
      new com.cakeplatform.api.security.CustomUserDetails(user);
   java.util.Map<String, Object> extraClaims = new java.util.HashMap<>();
   extraClaims.put("granted_role", "CUSTOMER");
   return jwtService.generateToken(extraClaims, userDetails);
   ```

   ### 5.2 Evaluation of Identity Lifecycle Requirements
   | Requirement | Status | Technical Implementation & Evidence |
   |---|---|---|
   | **No separate customer registration** | **COMPLETE** | Identity is automatically created on first OTP verification; no password or signup form. |
   | **Reuse existing customer identity** | **COMPLETE** | `findByMobileIncludingDeleted` retrieves existing record. `userRepository.save()` is bypassed on existing users. |
   | **Resurrection of deleted identity** | **COMPLETE** | If a customer account was soft-deleted, `user.setDeleted(false)` un-deletes it rather than failing unique constraints. |
   | **Multi-bakery order association** | **COMPLETE** | `OrderRepository.findVisibleOrdersByCustomerPhone` fetches all orders across any bakery matching the customer's phone. |
   | **Order linkage on creation** | **PARTIAL** | `CustomerStorefrontService.placeGuestOrder` links `order.setCustomer(user)` if `user` exists in DB. However, it does not sync `customerName` and `customerEmail` to the `User` entity. |
   | **Backfill past orders on late OTP** | **PARTIAL** | Orders table stores `customer_phone`. Querying by phone returns all past orders, but `orders.customer_id` remains NULL for orders placed before account creation unless backfilled. |

   ---

   ## 6. Database Relationships

   Direct schema inspection of PostgreSQL `cake_platform`:

   ```
   ┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
   │              users              │                 │             orders              │
   ├─────────────────────────────────┤                 ├─────────────────────────────────┤
   │ id (PK, BIGINT)                 │◄───┐            │ id (PK, BIGINT)                 │
   │ mobile (VARCHAR, UNIQUE INDEX)  │    │            │ shop_id (FK -> shops.id)        │
   │ email (VARCHAR, UNIQUE)         │    │            │ customer_id (FK -> users.id)    ├───┐ (ON DELETE SET NULL)
   │ role (VARCHAR: CUSTOMER, ...)   │    │            │ customer_phone (VARCHAR, INDEX) │   │
   │ is_deleted (BOOLEAN)            │    │            │ customer_name (VARCHAR)         │   │
   │ created_at / updated_at         │    │            │ customer_email (VARCHAR)        │   │
   └─────────────────────────────────┘    │            │ order_number (UNIQUE)           │   │
                                          │            └─────────────────────────────────┘   │
                                          │                                                  │
                                          │            ┌─────────────────────────────────┐   │
                                          │            │       customer_addresses        │   │
                                          │            ├─────────────────────────────────┤   │
                                          └────────────┤ user_id (FK -> users.id)        │   │
                                                      │ address_line_1, pincode, etc.   │   │
                                                      │ is_default (BOOLEAN, INDEX)     │   │
                                                      └─────────────────────────────────┘   │
                                                                                             │
                                                      ┌─────────────────────────────────┐   │
                                                      │        otp_verifications        │   │
                                                      ├─────────────────────────────────┤   │
                                                      │ phone_number (VARCHAR, INDEX)   │   │
                                                      │ otp_hash (VARCHAR, BCrypt)      │   │
                                                      │ expires_at (TIMESTAMP)          │   │
                                                      │ attempts (INTEGER, max 3)       │   │
                                                      └─────────────────────────────────┘   │
   ```

   ### Constraints & Indexes Verified in Staging:
   1. `idx_users_mobile_unique`: Partial unique B-Tree index on `users(mobile) WHERE (mobile IS NOT NULL AND mobile <> '')`.
   2. `idx_orders_customer_phone`: B-Tree index on `orders(customer_phone)` enabling fast multi-bakery order lookups by phone.
   3. `fk_order_customer`: Foreign key on `orders(customer_id)` referencing `users(id) ON DELETE SET NULL`.
   4. `idx_customer_addresses_user_default`: Composite B-Tree index on `customer_addresses(user_id, is_default)`.
   5. `idx_otp_verifications_phone`: Index on `otp_verifications(phone_number)`.

   ---

   ## 7. Security Findings

   | Security Area | Verified Implementation | Risk Level | Verdict / Recommendation |
   |---|---|---|---|
   | **OTP Expiry & Attempts** | Expires in 10 minutes (`expiresAt`). Maximum 3 attempts (`MAX_ATTEMPTS = 3`). Invalidated upon successful verification. | **Low** | **COMPLETE** (`GuestOtpService.java:30-32`). |
   | **OTP Generation & Hashing** | Generated via `SecureRandom`. Stored as a one-way BCrypt hash via Spring `PasswordEncoder`. Plain OTP is never logged or returned in responses. | **Low** | **COMPLETE** (`GuestOtpService.java:35, 99`). |
   | **Resend Rate Limiting** | Enforces a 60-second cooldown between OTP requests for the same phone number (`RESEND_COOLDOWN_SECONDS = 60`). | **Low** | **COMPLETE** (`GuestOtpService.java:31, 76-79`). |
   | **Session Isolation** | Customer JWT stored in `sessionStorage` (cleared on tab close). Role strictly constrained to `ROLE_CUSTOMER` via `granted_role` claim in `JwtAuthenticationFilter`. | **Low** | **COMPLETE** (`CustomerAuthContext.tsx:13, 95`). |
   | **Address Data Isolation** | `CustomerAddressController` queries `findByIdAndCustomerId(addressId, userDetails.getId())`. Customers cannot access other users' addresses. | **Low** | **COMPLETE** (`CustomerAddressService.java:46`). |
   | **Order Tracking Access** | `CustomerStorefrontController.getGuestOrderDetails` requires matching phone number if unauthenticated; returns 404 on mismatch to prevent enumeration. Authenticated customers with non-matching phone receive 403. | **Low** | **COMPLETE** (`CustomerStorefrontGuestTrackingTest.java`). |
   | **Backend Direct Order Placement** | `POST /api/storefront/shops/{shopId}/orders` is `permitAll()` in `SecurityConfig.java`. Order linkage currently relies on `request.getCustomerPhone()`. An external caller bypassing the UI could place an order under an arbitrary phone number without proving OTP ownership. | **Medium** | **PARTIAL** — Recommend verifying JWT principal when Authorization header is supplied, and attaching the verified customer ID. |

   ---

   ## 8. Existing Test Coverage and Results

   ### 8.1 Backend Automated Tests (52/52 Passed)
   - **Execution Command:**
   ```powershell
   cd backend; mvn test "-Dtest=CustomerAccountHydrationTest,CustomerStorefrontGuestTrackingTest,GuestTrackingTest,CustomerAddressControllerTest,CustomerAddressServiceTest,GuestTrackingRateLimitTest,OtpRateLimitSecurityTest,CustomerPrivacySecurityTest"
   ```
   - **Results:**
   - `CustomerAccountHydrationTest`: **2/2 passed** (New phone creates account, existing phone reuses account).
   - `CustomerStorefrontGuestTrackingTest`: **8/8 passed** (Own order access, wrong order forbidden, guest phone masking).
   - `GuestTrackingTest`: **11/11 passed** (OTP generation, channel delivery, verification logic).
   - `CustomerAddressControllerTest`: **7/7 passed** (REST contracts, status codes, default toggles).
   - `CustomerAddressServiceTest`: **11/11 passed** (Address CRUD, default clearing, customer isolation).
   - `GuestTrackingRateLimitTest`: **4/4 passed** (Burst protection, IP throttling).
   - `OtpRateLimitSecurityTest`: **2/2 passed** (Resend cooldown enforcement).
   - `CustomerPrivacySecurityTest`: **7/7 passed** (Cross-customer boundary isolation).
   - **Total:** **`52 passed, 0 failures, 0 errors` (Time: 31.2s)**.

   ### 8.2 Frontend Automated Tests (11/11 Passed)
   - **Execution Command:**
   ```bash
   cd frontend_v2; node --test __tests__/checkoutOtpAndCancellation.test.mjs __tests__/checkoutCartHydration.test.mjs
   ```
   - **Results:**
   - `checkoutOtpAndCancellation.test.mjs`: **4/4 passed** (OTP request payload, channel formatting, cancellation security, 6-digit validation).
   - `checkoutCartHydration.test.mjs`: **7/7 passed** (Single-shop cart restoration, idempotency, storage recovery).
   - **Total:** **`11 passed, 0 failures` (Time: 164ms)**.

   ---

   ## 9. Confirmed Gaps and Risks

   | ID | Classification | Priority | Gap Description | Evidence | Business / Customer Impact |
   |---|---|---|---|---|---|
   | **GAP-01** | **PARTIAL** | **P1** | **Navbar Ignores Customer Authentication** | `Navbar.tsx:7` only imports `useAuth()`. Shows "Owner Login" even after a customer verifies OTP. | Confusing buyer experience; customers cannot view their logged-in phone, manage saved addresses, or log out from the main marketplace. |
   | **GAP-02** | **MISSING** | **P1** | **No Standalone Customer Account Route** | No `/account` or `/profile` directory in `frontend_v2/app`. Profile tab exists only inside `/shop/[id]?tab=profile`. | A buyer cannot check order history or manage delivery addresses unless they enter a specific bakery's shop page. |
   | **GAP-03** | **PARTIAL** | **P1** | **Name & Email Omitted on Initial User Creation** | `GuestOtpService.java:198-201` sets `mobile` and `role`, but not `fullName` or `email`. | When a customer enters their name/email during guest checkout, it is saved on the `Order`, but the `User` entity remains nameless/email-less. |
   | **GAP-04** | **PARTIAL** | **P2** | **Raw Order Placement Does Not Verify JWT Principal** | `CustomerStorefrontService.java:1111-1116` links customer solely by `request.getCustomerPhone()`. | External API requests to `POST /orders` could associate orders to arbitrary phone numbers without proving ownership. |
   | **GAP-05** | **PARTIAL** | **P2** | **No Backfill of `orders.customer_id` for Prior Orders** | `GuestOtpService.verifyOtp` does not update `orders.customer_id` for orders previously placed with that phone number. | Orders are retrieved by phone query, but SQL queries joining `orders.customer_id` miss earlier guest purchases. |
   | **GAP-06** | **BROKEN** | **P2** | **Dead Code in `frontend_v2/app/checkout/page.tsx`** | 460 lines of bypassed legacy code redirected to `/shop/${currentShopId}?tab=checkout`. | Dead bundle weight and code maintenance hazard. |

   ---

   ## 10. Existing Features That Should Be Reused

   The following production-ready features must **NOT** be rebuilt or refactored:

   1. **`CustomerAuthContext.tsx`**: Session hydration, `requestOtp`, `verifyOtp`, and token persistence in `sessionStorage`.
   2. **`GuestOtpService.java`**: OTP generation, hashing, rate limiting, and user account hydration logic.
   3. **`CustomerAddressController.java` & `CustomerAddressService.java`**: Full CRUD, V56 Indian address fields, and default address logic.
   4. **`CustomerProfileController.java` & `CustomerProfileService.java`**: Customer profile retrieval and update endpoints.
   5. **`CustomerOrderLookupModal.tsx`**: Dual-tab order lookup (Phone+OTP or Order Number).
   6. **`StorefrontCheckoutTab.tsx` Address & Slot Logic**: Saved address dropdown, inline address creation modal, and slot capacity validation.
   7. **`OrderRepository.findVisibleOrdersByCustomerPhone`**: Multi-bakery order retrieval query.

   ---

   ## 11. Features That Actually Need Modification

   1. **`frontend_v2/components/common/Navbar.tsx` (Targeted Edit):**
      - Import `useCustomerAuth()` alongside `useAuth()`.
      - If `customerAuth.isAuthenticated` is true, render a customer pill dropdown displaying `customerAuth.phone` with links to `/account` and a `Logout` action.
      - Retain "Owner Login" when no customer or owner session is active.
   2. **Create `frontend_v2/app/account/page.tsx` (New Route):**
      - Provide a clean, standalone customer portal with three tabs:
      - **Profile:** View/edit full name, email, and phone number.
      - **Saved Addresses:** Add, edit, delete, and set default addresses using `CustomerAddressSelector` and `AddressModal`.
      - **Past Orders:** View order history across all bakeries with status steppers and track links.
      - Guard route: If unauthenticated, show an inline phone + OTP verification prompt.
   3. **`CustomerStorefrontService.java` (Targeted Edit):**
      - In `placeGuestOrder()`, if `request.getCustomerName()` or `request.getCustomerEmail()` is provided, update the linked `User` record if those fields are currently empty.
   4. **`frontend_v2/app/checkout/page.tsx` (Targeted Cleanup):**
      - Replace 460 lines of dead code with a clean client redirect component.

   ---

   ## 12. Recommended Phase 2.6.2 Implementation Plan

   ```mermaid
   graph TD
      A["Phase 2.6.2 Start"] --> B["Step 1: Backend Identity Enrichment"]
      B --> C["Step 2: Navbar Customer Session Integration"]
      C --> D["Step 3: Standalone Customer Account Route (/account)"]
      D --> E["Step 4: Cleanup app/checkout/page.tsx"]
      E --> F["Step 5: Automated Verification & E2E Tests"]
      F --> G["Phase 2.6.2 Complete"]
   ```

   ### Detailed Step Breakdown:
   1. **Step 1: Backend User Profile Enrichment on Order Placement**
      - Update `CustomerStorefrontService.java` to hydrate `User.fullName` and `User.email` from `GuestOrderRequest` when associating the order, preserving existing names if already set.
      - Ensure `order.setCustomer(user)` is linked to the authenticated JWT principal when available.
   2. **Step 2: Navbar Customer Session Integration**
      - In `Navbar.tsx`, consume `useCustomerAuth()`.
      - Show a mobile-friendly and desktop-friendly Customer Account dropdown when authenticated.
      - Include a "Customer Login" button that opens `CustomerOrderLookupModal` or an inline phone prompt.
   3. **Step 3: Standalone Customer Account Route (`/account`)**
      - Create `frontend_v2/app/account/page.tsx`.
      - Provide authenticated tabs: "My Orders", "Delivery Addresses", and "Personal Details".
      - Include unauthenticated state with phone+OTP verification form.
   4. **Step 4: Cleanup `app/checkout/page.tsx`**
      - Remove unused states and components. Replace with an elegant loading redirect to `/shop/${currentShopId}?tab=checkout` or `/explore`.
   5. **Step 5: Automated Verification**
      - Run backend test suite (`mvn test`).
      - Run frontend test suite (`npm test`).
      - Run TypeScript check (`npx tsc --noEmit`).

   ---

   ## 13. Final Verdict

   ### **`READY FOR PHASE 2.6.2 IMPLEMENTATION`**

   **Rationale:**  
   The technical foundation for passwordless customer authentication and automatic identity management is complete, secure, and rigorously tested (52 backend tests and 11 frontend tests passing). The database schema V57 supports all required relationships without schema migrations. The roadmap for Phase 2.6.2 is clear, minimal, and non-breaking.

