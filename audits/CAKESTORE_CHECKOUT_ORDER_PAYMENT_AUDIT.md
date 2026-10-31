# CakeStore — Customer Checkout, Order Management & Payment Audit

**Audit Status:** Complete (Read-Only)  
**Date:** October 26, 2026  
**Audited Targets:** `frontend_v2` (Next.js 14 App Router), `backend` (Spring Boot 3.3.2, Java 17, PostgreSQL)  
**Execution Environment:** Local development test suite and active database schemas  

---

## 1. Executive Summary

This comprehensive, evidence-based audit evaluates the implementation status of three critical subsystems in the CakeStore platform:
1. **Customer OTP Verification & Delivery Fallback**
2. **Customer Self-Service Order Cancellation & Lifecycle Management**
3. **Payment Reconciliation & Handling of Late Payments on Cancelled/Expired Orders**

### High-Level Audit Findings Matrix

| Focus Area | Feature / Capability | Classification | Current Implementation Status |
|---|---|---|---|
| **Area 1: OTP & Fallback** | OTP Generation & Hash Verification | **IMPLEMENTED AND TESTED** | `SecureRandom` 6-digit OTP, BCrypt hashing, 10-minute expiry, 60s cooldown, 3-attempt limit. |
| | IP & Rate-Limiting Protection | **IMPLEMENTED AND TESTED** | Bucket4j Tier 1 rate limiting (10 req/min/IP) on `/api/customer/storefront/tracking/request-otp`. |
| | Passwordless Customer Session JWT | **IMPLEMENTED AND TESTED** | Verified phone hydrates `users` table (`ROLE_CUSTOMER`), issues customer JWT stored in `sessionStorage`. |
| | Live SMS Provider Integration | **PARTIALLY IMPLEMENTED** | `SmsService.java` is wired to Twilio SDK, but lacks production credentials; operates in local mock logger mode. |
| | WhatsApp OTP Delivery | **MISSING** | WhatsApp is only stored as bakery storefront contact data. No WhatsApp OTP integration exists. |
| | Email OTP Delivery Fallback | **MISSING** | No email fallback exists for customer checkout or guest order tracking. |
| | Checkout Blocked on SMS Failure | **CRITICAL PRODUCTION RISK** | If SMS delivery fails, checkout modal cannot proceed; customer is permanently blocked from placing orders. |
| **Area 2: Cancellation** | Customer Self-Service Order Cancellation | **MISSING** | Customers cannot cancel placed orders. Order tracking page has no cancellation action or grace window. |
| | Customer Checkout Payment Cancellation | **IMPLEMENTED AND TESTED** | Dismissing Razorpay modal triggers `POST /cancel-payment`, setting status to `CANCELLED` and `FAILED`. |
| | Bakery Owner Order Cancellation | **IMPLEMENTED AND TESTED** | Owner can cancel orders via `PATCH /api/owner/orders/{id}/status`. Syncs custom cakes and customer notifications. |
| | Delivery-Slot Capacity Release | **IMPLEMENTED AND TESTED** | Slot capacity queries strictly filter out `CANCELLED` orders. Slot capacity is instantly and safely restored. |
| | Cross-Customer Order Isolation | **IMPLEMENTED AND TESTED** | Tracking orders requires phone matching (authenticated customer JWT or unauthenticated `trackPhone`). |
| | Unauthorized Payment Cancellation Endpoint | **HIGH RISK / PARTIAL** | `POST /api/storefront/orders/{orderNumber}/cancel-payment` lacks auth or phone ownership check. |
| **Area 3: Reconciliation** | Razorpay Order Creation & Signatures | **IMPLEMENTED AND TESTED** | Authoritative server-side amounts, HMAC-SHA256 signature verification, pessimistic DB locks. |
| | Webhook Handling & Deduplication | **IMPLEMENTED AND TESTED** | Raw payload HMAC validation, `X-Razorpay-Event-Id` deduplication in `webhook_events`, idempotent updates. |
| | Late Payment on Cancelled Order Guard | **IMPLEMENTED AND TESTED** | **Slot overbooking prevented**: Cancelled orders NEVER flip to `CONFIRMED`; status remains `CANCELLED`. |
| | Cancelled Order Payment Accounting | **IMPLEMENTED AND TESTED** | `paymentStatus` updated to `PAID`, `Payment` entity recorded `COMPLETED`, owner/admin/customer alerted. |
| | Automatic Gateway Refunds | **MISSING** | No automated Razorpay refund API integration. Refunds are recorded manually by the bakery owner. |
| | Background Razorpay Reconciliation Poller | **MISSING** | Schedulers only monitor local DB timestamps; no polling job queries Razorpay API for dropped callbacks. |

---

## 2. Area 1 — Customer OTP Verification & Fallback Findings

### 2.1 OTP Generation, Lifecycle, and State Machine
- **Generation & Storage:** Handled by [`GuestOtpService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/GuestOtpService.java#L20-L126). Generates a 6-digit numeric string using `java.security.SecureRandom`. OTP values are hashed via BCrypt (`PasswordEncoder.encode`) and persisted to the `otp_verifications` table (`OtpVerification` entity).
- **Expiry:** Strict 10-minute expiry (`OTP_EXPIRY_MINUTES = 10`). Expired records throw `"Invalid or expired OTP"`.
- **Resend Cooldown:** Strict 60-second cooldown (`RESEND_COOLDOWN_SECONDS = 60`). Subsequent requests within 60 seconds reject with `"Please wait X seconds before requesting a new OTP."`
- **Attempt Throttling:** Strict 3-attempt limit (`MAX_ATTEMPTS = 3`). Exceeding 3 incorrect entries rejects with `"Maximum verification attempts exceeded. Please request a new OTP."`
- **Phone Normalization:** [`AuthService.normalizeIndianMobile`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/AuthService.java#L129-L140) sanitizes non-numeric characters, strips leading `91` (12-digit) or leading `0` (11-digit), yielding a normalized 10-digit mobile number.
- **Session Hydration:** Upon verification, [`GuestOtpService.verifyOtp`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/GuestOtpService.java#L74-L117) finds or provisions a record in the `users` table with role `CUSTOMER` (restoring deleted records if applicable) and issues a session JWT containing `granted_role: "CUSTOMER"`.

### 2.2 Frontend Integration
- In [`StorefrontCheckoutTab.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx#L492-L566), when a customer clicks "Place Order" or "Proceed to Payment", the client evaluates:
  ```typescript
  if (!customerAuth.isAuthenticated || customerAuth.phone !== cleanPhone) {
    await customerAuth.requestOtp(cleanPhone);
    setShowOtpModal(true);
    setResendTimer(60);
    return; // Pause order placement, wait for OTP
  }
  ```
- The frontend pops up a modal prompting for the 6-digit code.
- Verification calls `customerAuth.verifyOtp(cleanPhone, checkoutOtp)` in [`CustomerAuthContext.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/auth/CustomerAuthContext.tsx#L89-L107), storing the token in browser `sessionStorage` (`cakeStoreGuestToken`, `cakeStoreGuestPhone`).
- Once verified, `handleVerifyOtpAndPlaceOrder` invokes `executeOrderPlacement` with the token.

### 2.3 Provider Status, Fallbacks, and Fast2SMS Analysis
- **Twilio SMS Provider:** [`SmsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java#L14-L63) contains Twilio SDK initialization. In development, `twilio.account-sid`, `twilio.auth-token`, and `twilio.phone-number` are null. It logs:
  `Mock SMS (Local Dev): To +91..., Message: Your CakeStore order tracking code is: ...`
- **Fast2SMS / MSG91:** **NOT IMPLEMENTED**. A search across the repository reveals Fast2SMS was mentioned in previous architectural reviews ([`CAKESTORE_PHASE1D_RELEASE_CANDIDATE_REVIEW.md`](file:///d:/PROJECTS/CAKE%20SAAs1/CAKESTORE_PHASE1D_RELEASE_CANDIDATE_REVIEW.md#L234) and [`CAKESTORE_AUTH_AUTHZ_PHASE_3A_READ_ONLY_REVIEW.md`](file:///d:/PROJECTS/CAKE%20SAAs1/CAKESTORE_AUTH_AUTHZ_PHASE_3A_READ_ONLY_REVIEW.md#L89)) as a recommended Indian DLT provider, but **no Fast2SMS client, HTTP service, or dependency exists in code**.
- **WhatsApp OTP:** **NOT IMPLEMENTED**. WhatsApp is only stored as a bakery contact field (`Shop.whatsappNumber`) and social link. No WhatsApp Business API or OTP dispatch exists.
- **Email OTP Fallback:** **NOT IMPLEMENTED**. Email is only configured for owner/admin transactional receipts and password resets (`/api/auth/forgot-password`).
- **Critical Checkout Block Failure Mode:** In any environment where SMS is not delivered (mock mode without console access, missing Twilio funds, or unapproved Indian DLT templates), the customer never receives the code. Because the UI requires OTP entry to proceed with order placement, **customer checkout becomes permanently blocked**.

---

## 3. Area 2 — Customer Self-Service Order Cancellation Findings

### 3.1 Customer Cancellation Capabilities
- **Post-Placement Cancellation:** **MISSING**. Once an order is placed (e.g. COD order in `NEW`, or paid order in `CONFIRMED`), the customer has **no self-service cancellation mechanism**.
- **UI Inspection:** [`frontend_v2/app/orders/[orderNumber]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/orders/%5BorderNumber%5D/page.tsx) and [`StorefrontTrackOrderTab.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontTrackOrderTab.tsx) provide order progress badges, financial breakdowns, PDF invoice downloads, and product review submissions, but have **no cancel button or cancellation request form**.
- **Cancellation Grace Period:** **MISSING**. No 5-minute or 15-minute cancellation window exists anywhere in frontend or backend.

### 3.2 Pre-Completion Checkout Cancellation
- **Implemented Feature:** If a customer aborts an online checkout by dismissing or closing the Razorpay modal, [`StorefrontCheckoutTab.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx#L652-L666) invokes `ordersApi.cancelPaymentOrder(order.orderNumber, 'Customer closed payment window')`.
- **Backend Handler:** [`CustomerPaymentController.cancelCustomerPayment`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L273-L330) handles `POST /api/storefront/orders/{orderNumber}/cancel-payment`:
  - Enforces that order cannot be cancelled if already `PAID`.
  - Sets `orderStatus = "CANCELLED"` and `paymentStatus = "FAILED"`.
  - Restores coupon usage if applicable (`couponRepository.decrementUsedCount`).
  - Sets linked `Payment` record status to `FAILED`.
  - Returns `200 OK` idempotently if already cancelled.

### 3.3 Bakery Owner & Admin Cancellation
- **Bakery Owner:** **IMPLEMENTED**. Bakery owners can cancel orders via `PATCH /api/owner/orders/{id}/status` ([`OwnerOrderController.java:48-57`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java#L48-L57)).
  - Supported transitions to `CANCELLED` from: `PAYMENT_PENDING`, `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`.
  - Terminal statuses `COMPLETED` and `CANCELLED` cannot be transitioned.
  - Automatically resets linked bespoke custom cakes back to `REVIEWED` status ([`OrderService.java:115-128`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java#L115-L128)).
  - Dispatches customer notification after transaction commit.
- **Admin:** **MISSING BY DESIGN**. The admin portal is an analytics, compliance, and dispute overview dashboard; admins do not directly alter order statuses.

### 3.4 Delivery-Slot Capacity Release
- **Safe Slot Reclaim:** **IMPLEMENTED AND TESTED**.
- In [`OrderRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java#L240-L255):
  ```java
  CAPACITY_CONSUMING_STATUSES = List.of(
      "PAYMENT_PENDING", "NEW", "CONFIRMED", "PREPARING", "READY", 
      "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "DELIVERED"
  );
  ```
- Because `"CANCELLED"` is excluded from active capacity, whenever an order is marked `CANCELLED` (via `cancel-payment` or bakery owner action), its booked delivery slot is **immediately and automatically restored** for subsequent orders.

### 3.5 Cross-Customer Order Isolation & Authorization
- **Customer Order Tracking (`/api/customer/storefront/tracking/orders`):** Protected by `ROLE_CUSTOMER` JWT; filters strictly by authenticated mobile number (`findVisibleOrdersByCustomerPhone`).
- **Guest Single Order Lookup (`/api/storefront/shops/orders/{orderNumber}`):**
  - Authenticated: Verifies caller phone matches `order.customerPhone`; returns `403 FORBIDDEN` if mismatched.
  - Unauthenticated: Requires `trackPhone` query parameter; returns `404 NOT FOUND` if mismatched, preventing order enumeration.
- **Authorization Flaw in Cancel-Payment:**
  [`CustomerPaymentController.cancelCustomerPayment`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L273) takes `@PathVariable String orderNumber` with no customer JWT check or `trackPhone` verification. Anyone with knowledge of an uncompleted order number can invoke cancellation.

---

## 4. Area 3 — Payment Reconciliation & Late Payments Findings

### 4.1 Razorpay Payment Creation & Signature Verification
- **Payment Order Creation:** Handled by `POST /api/storefront/orders/{orderNumber}/create-payment-order` ([`CustomerPaymentController.java:84-145`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L84-L145)).
  - Strictly derives payable amount from the server-side `Order.totalAmount` entity (never trusts client price).
  - Reuses existing `PENDING` Razorpay order ID if already initiated to avoid duplicate checkout sessions.
- **Client Payment Verification:** Handled by `POST /api/storefront/orders/{orderNumber}/verify-payment` ([`CustomerPaymentController.java:151-265`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L151-L265)).
  - Uses pessimistic row locking: `orderRepository.findByOrderNumberWithLock(orderNumber)`.
  - Rejects verification on `REFUNDED` orders (`400 Bad Request`).
  - Verifies HMAC-SHA256 signature using [`RazorpayService.verifyPaymentSignature`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L70-L100).
  - Verifies order details against Razorpay API (`verifyOrderDetails`).

### 4.2 Razorpay Webhook Handling & Deduplication
- **Webhook Endpoint:** `POST /api/webhooks/razorpay` ([`WebhookController.java:68-218`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java#L68-L218)).
- **HMAC Verification:** Computes HMAC-SHA256 against exact unmodified raw payload.
- **Startup Guard:** Rejects processing with `500 Internal Server Error` if `webhookSecret` is unconfigured or contains placeholder values.
- **Event Deduplication:** Evaluates `X-Razorpay-Event-Id` header against `webhookEventRepository.existsByEventId(eventIdHeader)`. Existing events return `200 OK ("Webhook processed (idempotent duplicate)")`.
- **Atomic Event Persist:** Unprocessed events are committed immediately via `webhookEventRepository.saveAndFlush(webhookEvent)`.

### 4.3 Late Payments on Cancelled / Expired Orders: The Delivery Slot Overbooking Risk
- **Core Investigation Scenario:** *An order is cancelled and its delivery slot released to another customer. Subsequently, a delayed payment callback or webhook arrives for the cancelled order. Does the system reactivate the order and cause delivery slot overbooking?*
- **Audit Determination:** **THE ARCHITECTURE FULLY PREVENTS OVERBOOKING.**
- Both [`CustomerPaymentController.java:221-230`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L221-L230) and [`WebhookController.java:181-190`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java#L181-L190) implement explicit protection:
  ```java
  boolean wasCancelled = "CANCELLED".equalsIgnoreCase(order.getOrderStatus());
  order.setPaymentStatus("PAID");
  order.setTransactionId(transactionId);
  order.setPaidAt(LocalDateTime.now());

  if (!wasCancelled) {
      if ("NEW".equalsIgnoreCase(order.getOrderStatus()) || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())) {
          order.setOrderStatus("CONFIRMED");
      }
  } else {
      // Retain CANCELLED status! Never automatically change to CONFIRMED.
      log.warn("Payment captured for previously CANCELLED order {}. Retaining CANCELLED status to prevent slot overbooking. Flagged for reconciliation.", order.getOrderNumber());
  }
  ```
- **Execution Lifecycle on Late Payment:**
  1. The order status **strictly remains `CANCELLED`**. It is NEVER flipped to `CONFIRMED`.
  2. The released delivery slot remains safe and is not double-booked.
  3. `paymentStatus` is updated to `PAID`, ensuring money is not lost from accounting ledgers.
  4. The `Payment` entity is updated to `COMPLETED`.
  5. The bakery owner receives an immediate high-priority alert: `"Action Required: Payment Received on Cancelled Order... Delivery slot was not preserved. Please review order in your dashboard to fulfill or refund."`
  6. The platform administrator receives a notification under category `PAYMENTS`: `"Payment on Cancelled Order... Requires reconciliation or refund."`
  7. The customer receives an email and SMS explaining that payment was captured after session cancellation and that the bakery is reviewing fulfillment or refund options.
  8. An activity log entry `PAYMENT_CAPTURED_CANCELLED_ORDER` is registered.
  9. The owner orders dashboard highlights the record under the `REFUND_DUE` filter query.

### 4.4 Automated Gateway Refunds vs. Manual Settlement
- **Automated Gateway Refunds:** **MISSING**. There is no invocation of Razorpay's refund API (`POST /v1/payments/{payment_id}/refund`).
- **Manual Recording:** Bakery owners mark refunds via `PATCH /api/owner/orders/{id}/payment-status` with `paymentStatus = "REFUNDED"`. This transitions the database status and sends a manual refund notification instructing the customer to contact the bakery for offline settlement.

### 4.5 Background Payment Reconciliation / Polling Scheduler
- **Background Gateway Poller:** **MISSING**.
- [`OrderExpiryScheduler.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java#L14-L35) triggers every 60 seconds, but delegates to `orderService.monitorPendingPaymentOrders`, which **only logs** stale orders older than 15 minutes.
- Automatic cancellation of stale pending orders was removed/deprecated in [`OrderService.java:292-300`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java#L292-L300) to protect customers from race conditions.
- No background task polls Razorpay to verify the status of abandoned checkouts.

---

## 5. Relevant Files, Endpoints, Methods, and Automated Tests

### 5.1 Key Files & Endpoints

| Domain | File Path | Method / Component | Endpoint |
|---|---|---|---|
| **OTP Auth** | [`GuestOtpService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/GuestOtpService.java) | `requestOtp()`, `verifyOtp()` | N/A (Service) |
| **OTP Auth** | [`GuestTrackingController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/GuestTrackingController.java) | `requestOtp()`, `verifyOtp()` | `POST /api/customer/storefront/tracking/request-otp`<br>`POST /api/customer/storefront/tracking/verify-otp` |
| **Rate Limit**| [`RateLimitingFilter.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/RateLimitingFilter.java) | `doFilter()` | Intercepts `/api/customer/storefront/tracking/*` |
| **SMS** | [`SmsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java) | `sendSms()` | Non-blocking Async SMS (Twilio/Mock) |
| **Order Cancel**| [`CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java) | `cancelCustomerPayment()` | `POST /api/storefront/orders/{orderNumber}/cancel-payment` |
| **Owner Cancel**| [`OwnerOrderController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java) | `updateOrderStatus()` | `PATCH /api/owner/orders/{id}/status` |
| **Payment Init**| [`CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java) | `createCustomerPaymentOrder()` | `POST /api/storefront/orders/{orderNumber}/create-payment-order` |
| **Payment Verify**| [`CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java) | `verifyCustomerPayment()` | `POST /api/storefront/orders/{orderNumber}/verify-payment` |
| **Webhook** | [`WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java) | `handleRazorpayWebhook()` | `POST /api/webhooks/razorpay` |
| **Expiry Monitor**| [`OrderExpiryScheduler.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java) | `processExpiredOrders()` | Scheduled fixedDelay 60000ms |
| **Frontend Checkout**| [`StorefrontCheckoutTab.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx) | `handleVerifyOtpAndPlaceOrder()`, `openCustomerRazorpayCheckout()` | Client UI |
| **Frontend Auth**| [`CustomerAuthContext.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/auth/CustomerAuthContext.tsx) | `requestOtp()`, `verifyOtp()` | Client Session Context |

### 5.2 Automated Tests Actually Executed During Audit

All tests listed below were **actively executed** in this audit session. Zero tests were fabricated:

```
[TEST EXECUTION LOG: 2026-10-26]
---------------------------------------------------------------------------------------------------
1. com.cakeplatform.api.modules.storefront.GuestTrackingTest
   - testRequestOtp_NewPhone                                                    [PASSED]
   - testRequestOtp_ResendCooldown                                              [PASSED]
   - testRequestOtp_PreviousOtpInvalidation                                     [PASSED]
   - testVerifyOtp_SuccessSingleUse                                             [PASSED]
   - testVerifyOtp_MaxAttemptsExceeded                                          [PASSED]
   - testVerifyOtp_ExpiredFails                                                 [PASSED]
   - testGetMyOrders_RequiresRoleCustomer                                        [PASSED]
   Result: 7 tests run, 0 failures.

2. com.cakeplatform.api.modules.auth.service.CustomerAccountHydrationTest
   - testNewPhone_CreatesCustomerAccount                                        [PASSED]
   - testDeletedUser_RestoresAccount                                            [PASSED]
   Result: 2 tests run, 0 failures.

3. com.cakeplatform.api.security.OtpRateLimitSecurityTest
   - testOtpRequestRateLimiting                                                 [PASSED]
   - testDifferentIpCanRequestOtp                                               [PASSED]
   Result: 2 tests run, 0 failures.

4. com.cakeplatform.api.modules.order.scheduler.DelayedPaymentConfirmationRegressionTest
   - Regression 1: PAYMENT_PENDING order older than 15 mins NOT cancelled       [PASSED]
   - Regression 2: Reserved delivery slot NOT released solely by elapsed time   [PASSED]
   - Regression 3: Valid delayed Razorpay webhook updates to CONFIRMED & PAID   [PASSED]
   - Regression 4: Duplicate webhooks remain idempotent                         [PASSED]
   - Regression 5: Manual cancellation safely releases delivery slot            [PASSED]
   - Regression 6: Late webhook on CANCELLED order DOES NOT reactivate          [PASSED]
   - Regression 7: Late client verify on CANCELLED order DOES NOT reactivate    [PASSED]
   - Regression 8: Refunded orders remain protected against reactivation        [PASSED]
   - Regression 9: Concurrent webhook & client verification do not duplicate    [PASSED]
   - Regression 10: Duplicate webhooks do not duplicate owner alerts            [PASSED]
   Result: 10 tests run, 0 failures.

5. com.cakeplatform.api.modules.payment.controller.CustomerPaymentControllerTest
   - cancelCustomerPayment_SuccessfullyCancelsOrderAndSetsPaymentFailed         [PASSED]
   - cancelCustomerPayment_FailsIfOrderIsAlreadyPaid                            [PASSED]
   - cancelCustomerPayment_IsIdempotentWhenAlreadyCancelled                     [PASSED]
   - verifyCustomerPayment_OnCancelledOrder_RetainsCancelledStatus              [PASSED]
   - verifyCustomerPayment_RejectsRefundedOrder                                 [PASSED]
   - verifyCustomerPayment_CancelledOrder_IdempotentWhenAlreadyPaid             [PASSED]
   (and 8 additional payment order creation/validation tests)
   Result: 14 tests run, 0 failures.

6. frontend_v2 Node Test Suite (npm test)
   - 236 tests across 21 test suites                                            [PASSED]
---------------------------------------------------------------------------------------------------
Grand Total Executed: 35 backend tests + 236 frontend tests = 271 tests PASSED, 0 FAILED.
```

---

## 6. Risk Assessment Matrix

| Risk ID | Severity | Category | Risk Description | Current Mitigation | Residual Risk Level |
|---|---|---|---|---|---|
| **RISK-01** | **CRITICAL** | Customer Checkout Block | Live SMS provider is unconfigured. In production without SMS delivery, customer cannot receive OTP, permanently blocking checkout and payment. | Local stdout logger logs OTP for testing. | **CRITICAL** (Requires Email OTP fallback or live provider). |
| **RISK-02** | **HIGH** | Authorization / Privacy | `POST /api/storefront/orders/{orderNumber}/cancel-payment` does not check phone matching or JWT auth. Anyone guessing an in-flight `orderNumber` can cancel the payment. | Idempotency prevents cancelling `PAID` orders. | **HIGH** (Should require caller phone verification). |
| **RISK-03** | **MEDIUM** | Accounting / Operations | No automated Razorpay refund integration for late payments on cancelled orders. All refunds require manual owner action. | Alerts dispatched to owner, admin, and customer; flagged as `REFUND_DUE`. | **MEDIUM** (Operational friction for bakery owners). |
| **RISK-04** | **MEDIUM** | In-Flight Order Drift | No active Razorpay polling job reconciles `PAYMENT_PENDING` orders if both webhook and client verify fail. | `OrderExpiryScheduler` logs stale orders older than 15 minutes. | **MEDIUM** (Requires customer or owner to report stuck orders). |
| **RISK-05** | **LOW** | Customer Self-Service | Customers cannot cancel placed orders online within a grace window; must call or WhatsApp the bakery directly. | Bakery phone & WhatsApp contact info displayed on order tracking screen. | **LOW** (Standard for bespoke bakery operations). |

---

## 7. Prioritized List of Genuinely Unfinished Tasks

Based on the audit of actual codebase state, the following tasks represent genuinely incomplete features:

1. **Email OTP Checkout Fallback & Development Bypass Modal:**
   - Add optional Email OTP dispatch when SMS delivery fails or is not configured.
   - For local/staging environments, show a development notification or permit seamless verification so checkouts are never blocked.
2. **Customer Order Cancellation Endpoint Authorization Guard:**
   - Update `POST /api/storefront/orders/{orderNumber}/cancel-payment` to verify caller phone (via customer JWT or payload `phone`) against `order.customerPhone`.
3. **Customer Self-Service Cancellation Grace Period (Optional Product Feature):**
   - Provide a 5–15 minute customer self-service cancellation window on [`orders/[orderNumber]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/orders/%5BorderNumber%5D/page.tsx) for orders in `NEW` or `PAYMENT_PENDING` status before the bakery accepts or begins `PREPARING`.
4. **Active Razorpay Payment Reconciliation Poller:**
   - Create a background scheduler that queries the Razorpay API for orders remaining in `PAYMENT_PENDING` for >30 minutes to auto-confirm or cleanly close abandoned sessions.
5. **Automated Razorpay Refund API Integration:**
   - Provide a 1-click refund button in the Bakery Owner / Admin dashboard that calls Razorpay's refund API for orders with `REFUND_DUE`.

---

## 8. Recommended Single Next Task & Acceptance Criteria

### Recommended Next Task: Email OTP Verification Fallback & Authorization Guard
To solve the **CRITICAL checkout block defect** without purchasing commercial SMS/DLT credits, implement an **Email OTP Fallback** in customer checkout and protect the payment cancellation endpoint.

### Acceptance Criteria:
1. When requesting OTP, if customer email is provided during checkout, dispatch the 6-digit OTP to both SMS (mock/Twilio) and customer email via the existing [`EmailService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/email/EmailService.java).
2. Update the checkout OTP modal to indicate: *"Code sent to your mobile and email."*
3. Update `cancelCustomerPayment` in `CustomerPaymentController.java` to validate that the caller's phone matches `order.customerPhone`, eliminating the unauthorized cancellation vulnerability.
4. Add focused unit tests verifying email delivery fallback and phone authorization.
5. Verify frontend build, lint, and all existing tests pass without regressions.
