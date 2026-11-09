# Phase 2.10.2 — Razorpay Configuration & Database Integrity Audit Report

**Date:** November 6, 2026  
**Auditor:** Antigravity Agent (Google DeepMind Advanced Agentic Coding)  
**Execution Nature:** Strictly READ-ONLY Investigation (Zero Code Modifications, Zero Database Mutations)  
**Target Environment:** Local Staging (`cake_platform` PostgreSQL 18.4, Spring Boot 3.3.2, Next.js 14.2.5)  
**Final Verdict:** **PASS WITH LIMITATIONS**

---

## 1. Executive Summary

This comprehensive, strictly read-only audit was conducted to resolve two outstanding operational concerns in the CakeStore multi-tenant SaaS platform:
1. **The root cause of Razorpay payment failures** during subscription initiation (`POST /api/owner/payments/initiate-subscription`) and customer online order checkout (`POST /api/storefront/orders/{orderNumber}/create-payment-order`) as reported during Phase 2.10.1 UAT.
2. **The origin of database count discrepancies** between the Phase 2.9.6 audit (43 shops, 102 users, 67 orders, 22 products) and the Phase 2.10.1 UAT report (113 shops, 370 users, 85 orders, 22 products).

### Summary of Audit Findings
1. **Razorpay Failure Root Cause (Confirmed):**
   - The failure was **not** caused by missing environment variables, missing backend code, or frontend SDK bugs.
   - Both `backend/.env` and `frontend_v2/.env.local` are configured with matching Razorpay test keys (`rzp_test_...`, length 23).
   - However, the singleton row in the database table `global_settings` (ID 1) was overwritten with dummy values: `razorpay_key_id = 'rzp_test_initial_key_id'`, `razorpay_key_secret = 'super_secret_rzp_key_999'` (encrypted), and `razorpay_webhook_secret = 'super_secret_rzp_webhook_888'` (encrypted).
   - In `RazorpayService.java`, database values take precedence over application environment variables. Furthermore, `RazorpayService.isConfigured()` only checks if the keys contain the literal substring `"placeholder"`. Because `"rzp_test_initial_key_id"` and `"super_secret_rzp_key_999"` do not contain `"placeholder"`, the service treated them as valid credentials and attempted to create orders against `https://api.razorpay.com/v1/orders`. Razorpay's API server rejected the invalid key ID with `HTTP 400 Bad Request (Authentication failed)`.
   - In addition, this database override created a mismatch with `frontend_v2`, which was configured to use the test key from `.env.local`.

2. **Database Record Growth Root Cause (Confirmed & Proven):**
   - Both Phase 2.9.6 and Phase 2.10.1 inspected the **exact same database**: `cake_platform` on PostgreSQL 18.4 (`localhost:5432`, public schema).
   - The record growth of **+70 shops, +268 users, and +18 orders** occurred on **November 6, 2026 between 00:32 and 00:35**.
   - This was caused by the execution of three non-transactional integration test classes during the Phase 2.9.6 test suite (`AdminSettingsSecurityE2ETest`, `AdminDocumentAccessSecurityTest`, and `AdminLedgerSecurityE2ETest`). These test classes lack `@Transactional` and lack `@AfterEach` teardown logic, committing all `@BeforeEach` fixtures directly into the staging database.
   - Specifically, `AdminSettingsSecurityE2ETest.java` (line 96) is the exact source that overwrote `global_settings` with `rzp_test_initial_key_id`.
   - `products` remained constant at 22 because none of these test classes insert product records.
   - Post-UAT cleanup in Phase 2.10.1 successfully removed all 10 disposable business entities created during UAT (Shop 588, User 15381, Customer, Doc 963, Products 193/194, Slot 813, Subscription 342, Orders 4155/4156), intentionally retaining only the Super Admin account (User ID 15375).

3. **Database Relational Integrity (Confirmed Pristine):**
   - 15 cross-table foreign key relationships were verified. **Zero orphan records** exist across shops, products, orders, order items, subscriptions, subscription plans, documents, delivery slots/configs, storefront settings, and payments.

4. **Security Vulnerability Identified (High Severity):**
   - In `CustomerPaymentController.java` (line 217), the payment signature verification is wrapped in `if (razorpayService.isConfigured())`. If Razorpay is not configured (or configured with a placeholder), the controller **silently bypasses signature verification** and updates the order status to `PAID` and `CONFIRMED`.

---

## 2. Environment Identity & Target Specification

| Component | Target / Value | Verification Status |
| :--- | :--- | :--- |
| **Database Engine** | PostgreSQL 18.4 on x86_64-windows (MSVC 19.44.35227, 64-bit) | Verified via `SELECT version()` |
| **Database Host & Port** | `localhost:5432` / `127.0.0.1:5432` (connected via IPv6 `::1`) | Active & Operational |
| **Database Name & Schema** | `cake_platform`, schema: `public`, search_path: `"$user", public` | Verified |
| **Flyway Schema Version** | **V58** (`V58__add_product_review_moderation.sql`) | 58 migrations applied, all `success = true` |
| **Backend Framework** | Java 17 / Spring Boot 3.3.2 (`backend`, Port 8080) | Verified (`application.yml`, `application-prod.yml`) |
| **Frontend Framework** | Next.js 14.2.5 (App Router, React 18, TypeScript, Tailwind CSS) | Verified (`frontend_v2`) |
| **Backend Active Profile** | Default / Staging (`!prod`) | Verified |

---

## PART A — Razorpay Configuration Audit

### 1. Configuration Sources & Runtime Hierarchy

The CakeStore platform configures Razorpay credentials across multiple layers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Database Table: global_settings (ID=1)                   │
│    - razorpay_key_id (VARCHAR)                              │
│    - razorpay_key_secret (VARCHAR, AES encrypted)           │
│    - razorpay_webhook_secret (VARCHAR, AES encrypted)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Highest Precedence
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend Environment Variables (backend/.env)             │
│    - RAZORPAY_KEY_ID                                        │
│    - RAZORPAY_KEY_SECRET                                    │
│    - RAZORPAY_WEBHOOK_SECRET                                │
└──────────────────────────────┬──────────────────────────────┘
                               │ Fallback Precedence
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Spring Boot Default Placeholders (application.yml)       │
│    - razorpay.key-id: ${RAZORPAY_KEY_ID:}                   │
│    - razorpay.key-secret: ${RAZORPAY_KEY_SECRET:}           │
│    - razorpay.webhook-secret: ${RAZORPAY_WEBHOOK_SECRET:}   │
└─────────────────────────────────────────────────────────────┘
```

#### Razorpay Runtime Configuration Map

| Setting | Configuration Layer | Source Key / Field | Configured? | Value Type / Classification | Consistent with Frontend? |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Backend Key ID (Runtime)** | Database (`global_settings`) | `global_settings.razorpay_key_id` | **YES** | `'rzp_test_initial_key_id'` (Test Placeholder) | **NO** (Mismatch) |
| **Backend Key ID (Env)** | Environment file | `backend/.env` -> `RAZORPAY_KEY_ID` | **YES** | Valid format (`rzp_test_...`, 23 chars) | **YES** |
| **Backend Key Secret (Runtime)** | Database (`global_settings`) | `global_settings.razorpay_key_secret` | **YES** | Encrypted (`ENC:...`, length 48, raw: `super_secret_rzp_key_999`) | N/A (Secret) |
| **Backend Key Secret (Env)** | Environment file | `backend/.env` -> `RAZORPAY_KEY_SECRET` | **YES** | Valid format (length 24) | N/A (Secret) |
| **Webhook Secret (Runtime)** | Database (`global_settings`) | `global_settings.razorpay_webhook_secret` | **YES** | Encrypted (`ENC:...`, length 48, raw: `super_secret_rzp_webhook_888`) | N/A (Secret) |
| **Webhook Secret (Env)** | Environment file | `backend/.env` -> `RAZORPAY_WEBHOOK_SECRET` | **YES** | Valid format (length 64) | N/A (Secret) |
| **Frontend Key ID** | Environment file | `frontend_v2/.env.local` -> `NEXT_PUBLIC_RAZORPAY_KEY_ID` | **YES** | Valid format (`rzp_test_...`, 23 chars) | Matches `backend/.env`, **Conflicts with DB** |

*Security Confirmation: Zero actual secret values or decrypted tokens are exposed in this report.*

---

### 2. Investigation of the Placeholder Failure

During Phase 2.10.1 UAT, both `POST /api/owner/payments/initiate-subscription` and `POST /api/storefront/orders/{orderNumber}/create-payment-order` returned:
`HTTP 400 Bad Request: Authentication failed`

#### Direct Code & Execution Root Cause Analysis
1. **Precedence Resolution in [`RazorpayService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L48-L64):**
   ```java
   private String getActiveKeyId() {
       GlobalSettings s = settingsService.getSettings();
       if (s != null && s.getRazorpayKeyId() != null && !s.getRazorpayKeyId().isBlank()) return s.getRazorpayKeyId();
       return this.keyId;
   }
   private String getActiveKeySecret() {
       GlobalSettings s = settingsService.getSettings();
       if (s != null && s.getRazorpayKeySecret() != null && !s.getRazorpayKeySecret().isBlank()) return s.getRazorpayKeySecret();
       return this.keySecret;
   }
   ```
   The database setting in `global_settings` explicitly overrides any environment variables present in `backend/.env`.

2. **The `isConfigured()` Check Flaw ([`RazorpayService.java:235-240`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L235-L240)):**
   ```java
   public boolean isConfigured() {
       String currentKey = getActiveKeyId();
       String currentSecret = getActiveKeySecret();
       return currentKey != null && !currentKey.isBlank() && !currentKey.contains("placeholder")
               && currentSecret != null && !currentSecret.isBlank() && !currentSecret.contains("placeholder");
   }
   ```
   The value in `global_settings.razorpay_key_id` is `"rzp_test_initial_key_id"`. Because it does not contain the literal word `"placeholder"`, `isConfigured()` returns `true`.

3. **External Gateway Call:**
   Because `isConfigured()` evaluates to `true`, `RazorpayService.createSubscriptionOrder` and `createCustomerOrder` instantiate a real `RazorpayClient` with `"rzp_test_initial_key_id"` and `"super_secret_rzp_key_999"`:
   ```java
   RazorpayClient razorpayClient = new RazorpayClient(getActiveKeyId(), getActiveKeySecret());
   Order order = razorpayClient.orders.create(orderRequest);
   ```
   Razorpay's API server (`https://api.razorpay.com/v1/orders`) authenticates the basic auth header and returns `HTTP 400 Bad Request: Authentication failed`.

4. **Origin of the Database Override:**
   In [`AdminSettingsSecurityE2ETest.java:92-101`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/settings/AdminSettingsSecurityE2ETest.java#L92-L101):
   ```java
   @BeforeEach
   void setUp() {
       ...
       GlobalSettingsDTO initDTO = new GlobalSettingsDTO();
       initDTO.setPlatformName("CakeStore Platform");
       initDTO.setSupportEmail("support@cakestore.test");
       initDTO.setRazorpayKeyId("rzp_test_initial_key_id");
       initDTO.setRazorpayKeySecret(TEST_RAW_KEY_SECRET); // "super_secret_rzp_key_999"
       initDTO.setRazorpayWebhookSecret(TEST_RAW_WEBHOOK_SECRET); // "super_secret_rzp_webhook_888"
       initDTO.setPlatformCurrency("INR");
       globalSettingsService.updateSettings(initDTO);
   }
   ```
   Because `AdminSettingsSecurityE2ETest` was run against the shared staging database without `@Transactional` and without an `@AfterEach` rollback, it overwrote the singleton row in `global_settings` on `2026-11-06 00:34:32`.

---

### 3. Trace Subscription Payment Flow

```
[Bakery Owner]
      │
      ▼ 1. POST /api/owner/payments/initiate-subscription (planId)
[OwnerPaymentController]
      │ - Validates owner billing access and plan active status
      │ - Creates local Payment entity (status = PENDING)
      │ - Calls RazorpayService.createSubscriptionOrder()
      ▼
[RazorpayService]
      │ - Creates Razorpay Order on gateway (HTTP 400 blocked due to placeholder DB key)
      │ - Returns razorpayOrderId
      ▼
[Frontend Checkout (subscription/page.tsx)]
      │ - Loads Razorpay checkout modal (window.Razorpay)
      │ - If key contains "placeholder": uses simulated callback
      │ - If key does not contain "placeholder": waits for user OTP/gateway modal
      ▼
[Payment Callback]
      │ - Handler receives razorpay_order_id, razorpay_payment_id, razorpay_signature
      ▼ 2. POST /api/owner/payments/verify-subscription
[OwnerPaymentController]
      │ - Checks razorpayService.verifyPaymentSignature()
      │ - Calls razorpayService.verifyOrderDetails(orderId, expectedAmount, "INR")
      │ - Verifies payment belongs to owner's shop and is in PENDING state
      ▼
[SubscriptionService.processSuccessfulPayment]
      │ - Acquires PESSIMISTIC_WRITE lock on Payment entity
      │ - Idempotency guard: skips if already COMPLETED
      │ - Creates Subscription record (status = ACTIVE, term = durationDays)
      │ - Updates Payment (status = COMPLETED, paidAt = now, providerPaymentId)
      │ - Evaluates shop renewal restoration rules (activates EXPIRED/PENDING shops)
      │ - Emits audit logs: SUBSCRIPTION_ACTIVATED, PAYMENT_COMPLETED
      ▼
[Response: HTTP 200 OK]
```

#### Evaluation of Subscription Flow:
- **Implementation Status:** Fully implemented.
- **Safety Transitions:** Safe. Uses server-authoritative pricing from `SubscriptionPlan`, pessimistic row locking on payment verification, and idempotency safeguards.
- **Identified Gap:** The mock environment bypass check `isAllowedMockEnvironment()` in `OwnerPaymentController` checks `razorpayService.getKeyId().contains("placeholder")`. Because the key ID in the database is `"rzp_test_initial_key_id"`, the mock fallback is bypassed, forcing the real gateway call.

---

### 4. Trace Customer Order Payment Flow

```
[Customer Checkout]
      │
      ▼ 1. POST /api/storefront/shops/{shopId}/orders (paymentMethod = ONLINE)
[OrderService]
      │ - Validates shop, delivery slot capacity, minimum lead time, address
      │ - Computes totalAmount, creates Order (status = PAYMENT_PENDING, paymentStatus = PENDING)
      ▼
[Frontend]
      │
      ▼ 2. POST /api/storefront/orders/{orderNumber}/create-payment-order
[CustomerPaymentController]
      │ - Enforces order is not CANCELLED or PAID
      │ - Reuses existing PENDING payment if present
      │ - Calls RazorpayService.createCustomerOrder(totalAmount, orderNumber, shopId, receiptId)
      │ - Creates/updates Payment entity (status = PENDING)
      │ - Sets order.transactionId = razorpayOrderId, paymentMethod = RAZORPAY
      │ - Returns orderNumber, razorpayOrderId, amountPaise, keyId
      ▼
[Frontend Checkout]
      │ - Mounts Razorpay modal with public keyId
      │ - User submits payment at gateway
      ▼
[Customer Payment Callback]
      │
      ▼ 3. POST /api/storefront/orders/{orderNumber}/verify-payment
[CustomerPaymentController]
      │ - Locks Order with findByOrderNumberWithLock()
      │ - Checks if order is REFUNDED (rejects if true)
      │ - Idempotency: if already PAID, returns success immediately
      │ - [SECURITY CHECK]:
      │     if (razorpayService.isConfigured()) {
      │         verifyPaymentSignature();
      │         verifyOrderDetails();
      │     }
      │ - Updates Order: paymentStatus = PAID, transactionId = razorpayPaymentId, paidAt = now
      │ - If order was not CANCELLED: sets orderStatus = CONFIRMED
      │ - If order WAS CANCELLED: retains CANCELLED status, flags for reconciliation
      │ - Saves Payment record idempotently with unique constraint handling
      │ - Dispatches notification to bakery owner
      ▼
[Response: HTTP 200 OK]
```

#### Evaluation of Customer Order Flow:
- **Critical Security Finding:** In [`CustomerPaymentController.java:217-231`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L217-L231), the signature verification is conditioned on:
  ```java
  if (razorpayService.isConfigured()) {
      boolean valid = razorpayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!valid) {
          ...
          throw new IllegalArgumentException("Payment verification failed. Invalid signature.");
      }
      razorpayService.verifyOrderDetails(razorpayOrderId, order.getTotalAmount(), "INR");
  }
  ```
  **Vulnerability:** If `razorpayService.isConfigured()` returns `false`, the entire `if` block is skipped with **no exception thrown**. The code continues straight to line 234: `order.setPaymentStatus("PAID")`. An unauthenticated attacker could call this endpoint in any environment where credentials contain `"placeholder"` and mark orders as paid without a valid signature.

---

### 5. Webhook and Payment Security Review

Audited [`WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java#L69-L357) (`POST /api/webhooks/razorpay`):

| Security Check | Implementation Details | Verdict |
| :--- | :--- | :---: |
| **Signature Validation** | Computes HMAC-SHA256 of raw request payload using `razorpayService.verifyWebhookSignature()` against `X-Razorpay-Signature` header using constant-time comparison (`MessageDigest.isEqual`). Rejects missing or invalid headers. | **SECURE** |
| **Idempotency** | Checks `webhookEventRepository.existsByEventId(eventIdHeader)`. Stores event ID atomically in `WebhookEvent` table. Skips duplicate events with `200 OK`. | **SECURE** |
| **Payload Entity Parsing** | Extracts payment entity, notes (`internal_order_number`, `shop_id`, `plan_id`), amount, and currency. | **SECURE** |
| **Order Ownership Validation** | Verifies `orderNumber` exists in database and matches order record. Checks `shopId` against local `Payment` entity. | **SECURE** |
| **Amount & Currency Validation** | Converts amount to paise and verifies `capturedAmountPaise == expectedAmountPaise` and `currency.equalsIgnoreCase("INR")`. | **SECURE** |
| **Cancelled Order Protection** | If a payment is captured for an order that was previously CANCELLED (e.g. timeout during checkout), the status is **retained as CANCELLED** to prevent slot overbooking, and flags the order for admin/owner reconciliation. | **SECURE** |
| **Refunded Order Protection** | Rejects reactivation if order status is already `REFUNDED`. | **SECURE** |
| **Failed Event Handling** | On `payment.failed`, records failure in `activity_logs`, updates subscription payment status to `FAILED`, and dispatches `AdminNotification` (`PAYMENT_FAILED`). | **SECURE** |
| **Sensitive Data Logging** | Logs order numbers and masked transaction IDs. Does not log secrets or customer payment card details. | **SECURE** |
| **Webhook Secret Override Conflict** | Because `global_settings.razorpay_webhook_secret` has `super_secret_rzp_webhook_888`, legitimate webhooks signed with the secret from `.env` would fail verification. | **MISCONFIGURED** |

---

### 6. Razorpay Audit Verdict Matrix

| Component | Audit Classification | Justification |
| :--- | :--- | :--- |
| **Subscription Payment Initiation** | **MISCONFIGURED** | Code is complete and sound, but blocked by database override with placeholder key `rzp_test_initial_key_id`. |
| **Subscription Payment Verification** | **IMPLEMENTED AND VERIFIED BY CODE/TESTS** | Strict HMAC-SHA256 signature verification, plan matching, and pessimistic locking verified in unit/integration tests. |
| **Customer Payment Order Creation** | **MISCONFIGURED** | Code is complete and sound, but blocked by database override with placeholder key `rzp_test_initial_key_id`. |
| **Customer Payment Verification** | **SECURITY CONCERN** | In unconfigured environments, signature verification is bypassed without error, allowing arbitrary marking of orders as PAID. |
| **Webhook Signature Verification** | **MISCONFIGURED** | Code implementation is fully secure, but database override with dummy webhook secret would cause valid webhooks to be rejected. |
| **Webhook Idempotency & Events** | **IMPLEMENTED AND VERIFIED BY CODE/TESTS** | Event table deduplication, amount matching, and cancelled-order protections verified. |
| **Frontend Razorpay Checkout Integration** | **IMPLEMENTED BUT NOT END-TO-END VERIFIED** | Checkout component and Razorpay script loader implemented; interactive browser gateway test blocked by key mismatch/placeholder. |
| **Legacy Webhook Controller** (`/razorpay-v2`) | **NOT APPLICABLE** | Deprecated, returns HTTP 410 GONE as designed. |

---

## PART B — Database Count Discrepancy Investigation

### 1. Comparison of Historical Reports

| Table | Phase 2.9.6 Reported Count | Phase 2.10.1 Reported Count | Net Difference | Current Audit Count |
| :--- | :---: | :---: | :---: | :---: |
| **`shops`** | 43 | 113 | **+70** | **113** |
| **`users`** | 102 | 370 | **+268** | **371** (*+1 Admin 15375*) |
| **`orders`** | 67 | 85 | **+18** | **85** |
| **`products`** | 22 | 22 | **0** | **22** |
| **`order_items`** | N/A | 5 | N/A | **5** |
| **`subscriptions`** | 40 | 40 | **0** | **40** |
| **`business_documents`** | N/A | 80 | N/A | **80** |
| **`subscription_plans`** | 2 | 2 | **0** | **2** |
| **`product_reviews`** | 0 | 0 | **0** | **0** |
| **`feedback`** | 12 | 12 | **0** | **12** |

---

### 2. Confirmation of Active Database Identity

SQL queries executed against the active datasource confirmed:
- **Server Version:** `PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35227, 64-bit`
- **Connected Database:** `cake_platform`
- **Connected User:** `postgres`
- **Active Schema:** `public`
- **Port:** `5432`
- **Flyway State:** Exactly 58 migrations installed, with latest migration `V58__add_product_review_moderation.sql` applied on `2026-11-05 21:53:16`.
- **Datasource Consistency:** Both `backend/src/main/resources/application.yml` (`jdbc:postgresql://localhost:5432/cake_platform`) and `backend/.env` point to the exact same host, port, database, and credentials. Both Phase 2.9.6 and Phase 2.10.1 inspected the **identical database and schema**.

---

### 3. Investigation of Record Changes with Empirical Evidence

#### A. When and Why Shops Increased from 43 to 113 (+70 Shops)
Temporal analysis of `shops.created_at`:
- `2026-11-02 15:00`: 9 shops (IDs 1–9)
- `2026-11-03 23:00`: 4 shops (IDs 10–13)
- `2026-11-04 14:00`: 30 shops (IDs 14–73)
  *Subtotal before Nov 6:* Exactly **43 shops** (matches Phase 2.9.6 count).
- `2026-11-06 00:32 - 00:35`: **70 shops** (IDs 435–583).

**Root Cause Breakdown of the 70 Shops:**
1. **52 Shops:** Created by [`AdminDocumentAccessSecurityTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/shop/controller/AdminDocumentAccessSecurityTest.java).
   - In `setUp()`, creates 2 shops per test: `"Bakery Alpha " + uniq` and `"Bakery Beta " + uniq`.
   - The test class has 13 test methods and was executed across 2 test suite passes (13 * 2 * 2 = 52 shops).
2. **18 Shops:** Created by [`AdminLedgerSecurityE2ETest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/admin/AdminLedgerSecurityE2ETest.java).
   - In `setUp()`, creates 1 shop per test: `"Sweet Delights " + uniq`.
   - The test class has 9 test methods and was executed across 2 test suite passes (9 * 2 = 18 shops).
- **Total:** 52 + 18 = **70 shops**.

#### B. When and Why Users Increased from 102 to 370/371 (+268 / +269 Users)
Temporal analysis of `users.created_at`:
- Prior to Nov 6: Exactly **102 users** (matches Phase 2.9.6 count).
- `2026-11-06 00:32 - 00:35`: **268 test users** + 1 Super Admin (ID 15375).

**Root Cause Breakdown by Test Fixture Patterns:**
1. **108 Users:** Created by [`AdminSettingsSecurityE2ETest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/settings/AdminSettingsSecurityE2ETest.java).
   - 3 users per test (`admin_settings_*`, `owner_settings_*`, `customer_settings_*`).
   - 18 test methods * 2 passes * 3 users = 108 users.
2. **104 Users:** Created by [`AdminDocumentAccessSecurityTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/shop/controller/AdminDocumentAccessSecurityTest.java).
   - 4 users per test (`admin_doc_*`, `ownera_doc_*`, `ownerb_doc_*`, `customer_doc_*`).
   - 13 test methods * 2 passes * 4 users = 104 users.
3. **54 Users:** Created by [`AdminLedgerSecurityE2ETest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/admin/AdminLedgerSecurityE2ETest.java).
   - 3 users per test (`admin_ledger_*`, `owner_ledger_*`, `customer_ledger_*`).
   - 9 test methods * 2 passes * 3 users = 54 users.
4. **2 Users:** `cakestore.local` system accounts.
5. **1 User:** `simplifiedworks.official@gmail.com` (Super Admin User ID 15375, intentionally retained during Phase 2.10.1).
- **Total:** 108 + 104 + 54 + 2 + 1 = **269 new users** (102 + 269 = **371 users**).

#### C. When and Why Orders Increased from 67 to 85 (+18 Orders)
Temporal analysis of `orders.created_at`:
- Prior to Nov 6: Exactly **67 orders** (matches Phase 2.9.6 count).
- `2026-11-06 00:32 - 00:35`: Exactly **18 orders** (IDs 4032–4126).
- All 18 orders have `customer_name = 'Rohan Sharma'`, `total_amount = 1250.00`, and format `ORD-[A-F0-9]{8}`.
- This exactly matches [`AdminLedgerSecurityE2ETest.java:110-120`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/admin/AdminLedgerSecurityE2ETest.java#L110-L120):
  9 test methods * 2 test passes = **18 orders**.

#### D. Why Product Count Remained Constant at 22
- None of the three non-transactional test classes insert records into the `products` table.
- During Phase 2.10.1, the UAT workflow created 2 ephemeral products (IDs 193 and 194), which were both deleted before the final UAT count was recorded. Thus, products remained at 22.

#### E. Disposable UAT Records Verification
Verification of disposable entity IDs from Phase 2.10.1 confirmed:
- Shop 588: **0** (Deleted)
- Owner User 15381: **0** (Deleted)
- Customer User (`aarav.mehta.uat@testcust.com`): **0** (Deleted)
- Business Document 963: **0** (Deleted)
- Products 193 & 194: **0** (Deleted)
- Delivery Slot 813: **0** (Deleted)
- Subscription 342: **0** (Deleted)
- Orders 4155 & 4156: **0** (Deleted)
- Super Admin 15375: **1** (Preserved as intended)
**Verdict:** Phase 2.10.1 UAT cleanup was completely successful. Zero disposable business workflow entities remain.

---

### 4. Relational Integrity & Foreign Key Audit

A comprehensive SQL join check was performed across all key foreign-key relationships in the database:

| Entity Relationship Tested | Foreign Key Checked | Orphan Records Found | Relational Integrity Status |
| :--- | :--- | :---: | :---: |
| **Shops -> Users** | `shops.owner_id = users.id` | **0** | **PRISTINE** |
| **Products -> Shops** | `products.shop_id = shops.id` | **0** | **PRISTINE** |
| **Orders -> Shops** | `orders.shop_id = shops.id` | **0** | **PRISTINE** |
| **Order Items -> Orders** | `order_items.order_id = orders.id` | **0** | **PRISTINE** |
| **Order Items -> Products** | `order_items.product_id = products.id` | **0** | **PRISTINE** |
| **Subscriptions -> Shops** | `subscriptions.shop_id = shops.id` | **0** | **PRISTINE** |
| **Subscriptions -> Plans** | `subscriptions.plan_id = subscription_plans.id` | **0** | **PRISTINE** |
| **Business Documents -> Shops** | `business_documents.shop_id = shops.id` | **0** | **PRISTINE** |
| **Delivery Slots -> Shops** | `shop_delivery_slots.shop_id = shops.id` | **0** | **PRISTINE** |
| **Delivery Configs -> Shops** | `shop_delivery_configs.shop_id = shops.id` | **0** | **PRISTINE** |
| **Storefront Settings -> Shops** | `shop_storefront_settings.shop_id = shops.id` | **0** | **PRISTINE** |
| **Payments -> Subscriptions** | `payments.subscription_id = subscriptions.id` | **0** | **PRISTINE** |
| **Payments -> Plans** | `payments.plan_id = subscription_plans.id` | **0** | **PRISTINE** |
| **Payments -> Shops** | `payments.shop_id = shops.id` | **0** | **PRISTINE** |
| **Product Reviews -> Products** | `product_reviews.product_id = products.id` | **0** | **PRISTINE** |

**Summary:** Total foreign-key violations = **0**. The database is structurally healthy and has zero broken references.

---

### 5. Database Investigation Verdict Matrix

| Discrepancy Item | Classification | Root Cause Summary |
| :--- | :--- | :--- |
| **Shops (43 -> 113)** | **EXPLAINED — TEST DATA** | Non-transactional test execution of `AdminDocumentAccessSecurityTest` (+52) and `AdminLedgerSecurityE2ETest` (+18). |
| **Users (102 -> 371)** | **EXPLAINED — TEST DATA** | Non-transactional test execution of `AdminSettingsSecurityE2ETest` (+108), `AdminDocumentAccessSecurityTest` (+104), and `AdminLedgerSecurityE2ETest` (+54), plus 1 retained Super Admin. |
| **Orders (67 -> 85)** | **EXPLAINED — TEST DATA** | Non-transactional test execution of `AdminLedgerSecurityE2ETest` (+18). |
| **Products (22 -> 22)** | **EXPLAINED — LEGITIMATE DATA CONSISTENCY** | No test pollution in `products` table; UAT test products safely cleaned up. |
| **Razorpay DB Key (`rzp_test_initial_key_id`)** | **EXPLAINED — TEST DATA** | Overwritten by `AdminSettingsSecurityE2ETest.setUp()` updating `global_settings` singleton row without rollback. |

---

## PART C — Consolidated Findings & Severity Ranking

### Severity-Ranked Findings

```
┌────────────────────────────────────────────────────────────────────────┐
│ CRITICAL: None                                                         │
├────────────────────────────────────────────────────────────────────────┤
│ HIGH:                                                                  │
│  1. Unverified Customer Payment Bypass in Unconfigured Environments    │
│  2. Global Settings Database Override Blocks Gateway Operations        │
├────────────────────────────────────────────────────────────────────────┤
│ MEDIUM:                                                                │
│  3. Non-Transactional Integration Test Pollution in Staging Database   │
│  4. Webhook Secret Database Override Causes Webhook Rejection          │
├────────────────────────────────────────────────────────────────────────┤
│ LOW:                                                                   │
│  5. 268 Test User Artifacts and 70 Test Shop Artifacts in Staging DB   │
│  6. Incomplete Mock Environment Check in RazorpayService.isConfigured  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Findings

1. **[HIGH] Unverified Customer Payment Bypass in Unconfigured Environments**
   - **Location:** [`CustomerPaymentController.java:217-231`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L217-L231)
   - **Impact:** When `razorpayService.isConfigured()` returns `false`, `POST /api/storefront/orders/{orderNumber}/verify-payment` skips signature verification and immediately marks the order as `PAID` and `CONFIRMED`.
   - **Risk:** In any non-production or staging environment where keys are missing or marked with `"placeholder"`, anyone can confirm orders without payment.

2. **[HIGH] Global Settings Database Override Blocks Gateway Operations**
   - **Location:** Table `global_settings`, row `id = 1`
   - **Impact:** `razorpay_key_id` is set to `'rzp_test_initial_key_id'` and `razorpay_key_secret` is set to `'super_secret_rzp_key_999'`. Because `RazorpayService` queries `global_settings` before environment variables, valid credentials in `backend/.env` are ignored.
   - **Consequence:** Razorpay rejects order creation with HTTP 400, breaking all online payment checkout and subscription flows.

3. **[MEDIUM] Non-Transactional Integration Tests Commit Test Data to Staging Database**
   - **Location:**
     - `AdminSettingsSecurityE2ETest.java`
     - `AdminDocumentAccessSecurityTest.java`
     - `AdminLedgerSecurityE2ETest.java`
   - **Impact:** Tests lack `@Transactional` and lack `@AfterEach` teardown logic. Running Maven tests against the staging database causes cumulative row pollution (+70 shops, +268 users, +18 orders) and corrupts singleton platform settings.

4. **[MEDIUM] Webhook Secret Database Override Causes Webhook Rejection**
   - **Location:** `global_settings.razorpay_webhook_secret`
   - **Impact:** Set to `'super_secret_rzp_webhook_888'`, overriding `RAZORPAY_WEBHOOK_SECRET` from `backend/.env`. Any real Razorpay webhook signed with the actual secret from `.env` will fail signature verification with HTTP 400.

5. **[LOW] Residual Test Artifacts in Staging Database**
   - **Impact:** 70 dummy shops, 268 dummy users, and 18 dummy orders inflate administrative metrics and inventory screens in staging. Does not cause foreign key corruption (0 orphans).

6. **[LOW] Incomplete Placeholder Detection in `RazorpayService.isConfigured()`**
   - **Location:** [`RazorpayService.java:235-240`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L235-L240)
   - **Impact:** `isConfigured()` only tests `!key.contains("placeholder")`. Keys like `"rzp_test_initial_key_id"` or `"rzp_test_dummy"` pass this check and trigger real external API calls that inevitably fail.

---

## 4. Recommended Targeted Corrective Actions (For Future Phases)

> [!IMPORTANT]
> In accordance with the Phase 2.10.2 STRICTLY READ-ONLY directive, **no changes were made during this audit**. The following corrective actions are documented for execution in subsequent phases upon approval:

1. **Restore Global Settings in Database (High Priority):**
   - Clear or update the singleton row in `global_settings` to either `NULL` for `razorpay_key_id`, `razorpay_key_secret`, and `razorpay_webhook_secret` (allowing fallback to `backend/.env`), or update them with the valid test credentials matching `backend/.env` and `frontend_v2/.env.local`.

2. **Patch Customer Payment Verification Security Guard (High Priority):**
   - In `CustomerPaymentController.java`, mirror the strict check implemented in `OwnerPaymentController.java`:
     ```java
     if (!razorpayService.isConfigured()) {
         if (isAllowedMockEnvironment() && "simulated_test_sig".equals(razorpaySignature)) {
             log.info("[TEST/DEV MOCK] Bypassing Razorpay signature check in non-production environment");
         } else {
             throw new IllegalArgumentException("Razorpay is not configured for production use.");
         }
     }
     ```

3. **Isolate Backend Integration Test Classes (Medium Priority):**
   - Add `@Transactional` to `AdminSettingsSecurityE2ETest`, `AdminDocumentAccessSecurityTest`, and `AdminLedgerSecurityE2ETest`, or implement dedicated `@AfterEach` teardown methods (similar to `AdminDashboardDateFilterTest`) so integration tests never persist data into the shared database.
   - In `AdminSettingsSecurityE2ETest`, save and restore the existing `GlobalSettings` state before and after testing.

4. **Enhance `RazorpayService.isConfigured()` Detection (Medium Priority):**
   - Extend `isConfigured()` to check for known placeholders:
     `currentKey.contains("placeholder") || currentKey.contains("initial") || currentKey.contains("dummy")`.

5. **Clean Up Test Artifacts in Staging (Low Priority):**
   - Perform a scoped cleanup of the 70 test shops (IDs 435–583), 268 test users (`%@test.com`), and 18 test orders (IDs 4032–4126), restoring the database baseline to its pre-pollution state.

---

## 5. Evidence & Key File References

### Backend References
- [`backend/src/main/resources/application.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L84-L87) (Razorpay configuration properties)
- [`backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java) (Active credential resolution & HMAC signature verification)
- [`backend/src/main/java/com/cakeplatform/api/modules/settings/GlobalSettingsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/GlobalSettingsService.java) (Settings persistence & singleton caching)
- [`backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java#L151-L297) (Subscription payment initiation & verification)
- [`backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L98-L252) (Customer order payment order creation & verification)
- [`backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java#L69-L357) (Webhook processing, signature check & idempotency)
- [`backend/src/test/java/com/cakeplatform/api/modules/settings/AdminSettingsSecurityE2ETest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/settings/AdminSettingsSecurityE2ETest.java#L91-L101) (Pollution source for `rzp_test_initial_key_id`)
- [`backend/src/test/java/com/cakeplatform/api/modules/shop/controller/AdminDocumentAccessSecurityTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/shop/controller/AdminDocumentAccessSecurityTest.java) (Pollution source for 52 shops and 104 users)
- [`backend/src/test/java/com/cakeplatform/api/modules/admin/AdminLedgerSecurityE2ETest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/admin/AdminLedgerSecurityE2ETest.java) (Pollution source for 18 shops, 54 users, and 18 orders)

### Frontend References
- [`frontend_v2/.env.local`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/.env.local) (`NEXT_PUBLIC_RAZORPAY_KEY_ID` configuration)
- [`frontend_v2/app/dashboard/owner/subscription/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/subscription/page.tsx) (Owner subscription Razorpay checkout modal)
- [`frontend_v2/lib/services/payments.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/services/payments.ts) (Client-side script loader)

---

## 6. Final Verdict

### **PASS WITH LIMITATIONS**

#### Final Verdict Rationale:
1. **Underlying Architecture & Code Rigor:** The core business implementation of Razorpay payments, HMAC-SHA256 signature verification, webhook idempotency, and subscription lifecycle management is structurally complete, robust, and mathematically sound.
2. **Database Structural Integrity:** Database relational integrity is **100% pristine** with exactly **0 orphan records** across all 15 audited foreign-key relationships.
3. **Identified Limitations:**
   - **Configuration Override:** Staging database table `global_settings` contains test key ID `'rzp_test_initial_key_id'` written by an integration test, which overrides environment variables and causes HTTP 400 Authentication Failure against Razorpay's live servers.
   - **Security Guard Missing:** Customer order payment verification contains an unguarded fallback when `razorpayService.isConfigured()` is false.
   - **Test Isolation Gaps:** Three backend integration test classes lack transaction rollbacks, leading to database record growth (+70 shops, +268 users, +18 orders).
4. **Safety Compliance:** Audit was executed in 100% read-only mode with zero mutations and zero exposed secrets.

The root causes of both issues have been conclusively identified, empirically verified, and supported with file and line references. No further action or implementation is performed in this phase.

