# CakeStore — Checkout OTP Fallback & Payment Cancellation Security Implementation Report

**Phase:** Checkout OTP Fallback & Payment Cancellation Security  
**Date:** October 26, 2026  
**Status:** Completed & Fully Verified  

---

## 1. Executive Summary

This phase addressed two critical operational and security requirements in the CakeStore customer checkout flow:

1. **Email OTP Delivery Fallback:** Implemented reliable transactional email fallback during customer checkout verification so customers are never blocked when SMS delivery (Twilio) is unconfigured or operating in local development/mock mode. Preserves customer trusted email association, ensures raw OTPs are never exposed in API responses or logs, and maintains the 6-digit code length, BCrypt hashing, 10-minute expiry, 60-second resend cooldown, 3-attempt lockout, and IP rate limiting (10 req/min).
2. **Payment Cancellation Security Guard:** Secured `POST /api/storefront/orders/{orderNumber}/cancel-payment` with server-side ownership authorization. Authenticated customers can cancel only their own eligible unpaid orders (phone number in request payload cannot override authenticated identity). Unauthenticated guest checkout flows require a trustworthy server-issued session token (`X-Checkout-Token` or valid Razorpay transaction ID). Guessed order numbers and untrusted phone fields are strictly rejected with HTTP 401/403. Idempotency, coupon restoration, and late-payment slot protection safeguards remain 100% intact.

Both features have been comprehensively verified with focused tests, full backend test suite (`mvn test`, 927 tests), full frontend test suite (`npm test`, 241 tests), frontend linting, and Next.js production build (`npm run build`).

---

## 2. Files Changed and Behavior Implemented

| File | Subsystem | Nature of Change |
| :--- | :--- | :--- |
| [`SmsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java) | Backend (Notification) | Added `public boolean isConfigured()` to allow services to distinguish real Twilio credentials from mock development mode. |
| [`EmailService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java) | Backend (Notification) | Added `public boolean isConfigured()` and enhanced `maskSensitiveLog` to redact 6-digit OTP codes in structured logs. |
| [`OtpDeliveryResponse.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/dto/OtpDeliveryResponse.java) | Backend (Auth DTO) | Created response DTO containing `channel`, `deliveryTarget`, `smsConfigured`, `emailConfigured`, `phoneMasked`, `emailMasked`, and `message` without exposing raw OTP. |
| [`GuestOtpService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/GuestOtpService.java) | Backend (Auth Service) | Injected `EmailService`, added `requestOtp(phoneNumber, candidateEmail)`, prioritized trusted account email from database, implemented channel selection policy, and returned `OtpDeliveryResponse`. |
| [`GuestTrackingController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/GuestTrackingController.java) | Backend (Controller) | Updated `PhoneRequest` to accept optional `email`, and changed `requestOtp` return type to `ResponseEntity<OtpDeliveryResponse>`. |
| [`JwtService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/JwtService.java) | Backend (Security) | Added `generateCheckoutToken(orderNumber, phone)` and `validateCheckoutToken(token, orderNumber, phone)` for cryptographically secure guest checkout cancellation validation. |
| [`CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java) | Backend (Payment) | Added server-side ownership authorization in `cancelCustomerPayment` via `validateCancellationAuthorization`. Emits `checkoutToken` in `createCustomerPaymentOrder` response. |
| [`RateLimitingFilter.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/RateLimitingFilter.java) | Backend (Security) | Enforced `request.getRemoteAddr()` in `getClientIp` to prevent spoofed `X-Forwarded-For` header rate-limit bypass. |
| [`GuestTrackingTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/storefront/GuestTrackingTest.java) | Backend (Test) | Added 4 unit tests covering email fallback, dual channel delivery, trusted account email preservation, and invalid email handling. |
| [`CustomerPaymentControllerTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentControllerTest.java) | Backend (Test) | Added 5 unit tests verifying customer cancellation ownership, mismatched JWT rejection, spoofed payload phone rejection, unauthenticated rejection, and guest token cancellation. |
| [`orders.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/orders.ts) | Frontend (API Client) | Exported `OtpDeliveryResponse`, updated `requestTrackingOtp(phone, email)`, and updated `cancelPaymentOrder(orderNumber, reason, checkoutToken)` to send `X-Checkout-Token` header. |
| [`CustomerAuthContext.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/auth/CustomerAuthContext.tsx) | Frontend (Auth Context) | Updated `requestOtp(phone, email)` contract to accept optional email and return `OtpDeliveryResponse`. |
| [`StorefrontCheckoutTab.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx) | Frontend (Component) | Enhanced OTP modal with channel banner, dynamic channel message, optional email fallback input, and passed `checkoutToken` upon payment cancellation. |
| [`checkoutOtpAndCancellation.test.mjs`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__/checkoutOtpAndCancellation.test.mjs) | Frontend (Test) | Added 4 automated unit tests verifying API payload formatting, channel messaging logic, `X-Checkout-Token` header transmission, and 6-digit code validation. |

---

## 3. Detailed Architecture & Design Decisions

### Task A — OTP Delivery and Fallback Design

#### 1. Identity Resolution & Email Trust Hierarchy
- When an OTP is requested for phone `P` with optional candidate email `E`:
  1. Phone `P` is normalized via `AuthService.normalizeIndianMobile(P)`.
  2. The database is queried for an existing customer account via `userRepository.findByMobileIncludingDeleted(P)`.
  3. **Trusted Account Email Reuse:** If the customer account already has an email associated with it (`existingUser.getEmail() != null`), that email is authoritative and reused. An attacker supplying a candidate email in the request cannot override the customer's trusted email on file.
  4. **Guest Candidate Email:** If no user exists or the user has no registered email, the candidate email `E` is validated against RFC-compliant regex pattern (`^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$`). If valid, it is utilized as the delivery target.
  5. If candidate email is invalid or missing, it is safely ignored without throwing an unhandled exception.

#### 2. Channel Selection Policy
- `SmsService.isConfigured()` indicates whether Twilio credentials (`accountSid`, `authToken`, `fromPhoneNumber`) are active.
- `EmailService.isConfigured()` indicates whether Resend API key is present.
- Channel resolution:
  - **`SMS_AND_EMAIL`:** Both Twilio and Resend are configured, and a verified/candidate email exists. Sends SMS and Email concurrently.
  - **`SMS`:** Twilio is configured, but no email exists or Resend is unconfigured. Dispatches SMS only.
  - **`EMAIL`:** Twilio is unconfigured or in mock mode, but an email is available. Falls back directly to email delivery via `emailService.sendEmail`. SMS logger records mock event for local development.
  - **`MOCK_SMS`:** Neither SMS nor Email is configured with external provider credentials. Dispatches mock SMS event and alerts UI that system is in local development mode.

#### 3. Security & Privacy Guarantees
- **No Raw OTP Exposure:** The raw 6-digit OTP is never present in `OtpDeliveryResponse` or controller responses.
- **Log Masking:** `EmailService.maskSensitiveLog` masks 6-digit OTP codes in transactional logs (`[REDACTED]`).
- **Destinations Masked:** API responses return masked identifiers, e.g., `+91 98*****210` and `c***r@example.com`.
- **Integrity Preserved:** 10-minute validity, BCrypt password hashing, 60-second resend cooldown per phone, 3-attempt maximum before invalidation, and strict 10 req/min IP rate limiting remain unchanged.

---

### Task B — Payment Cancellation Authorization Design

#### 1. Threat Model & Vulnerability Resolved
Previously, `POST /api/storefront/orders/{orderNumber}/cancel-payment` only required an `orderNumber` path variable. Any anonymous caller guessing an in-flight order number could prematurely cancel an order and disrupt checkout.

#### 2. Server-Side Ownership Authorization Guard
When a cancellation request is received:
1. **Order Resolution:** The order is looked up with pessimistic row locking (`findByOrderNumberWithLock`). If absent, returns HTTP 400/404 without leaking other order information.
2. **Eligibility Verification:** If `order.getPaymentStatus()` is `"PAID"`, the request is immediately rejected with HTTP 400 (`IllegalStateException: Cannot cancel payment for an already paid order`).
3. **Idempotency:** If the order is already `"CANCELLED"` and payment status is `"FAILED"`, returns HTTP 200 immediately (`Payment already cancelled`).
4. **Ownership Authorization Check (`validateCancellationAuthorization`):**
   - **Authenticated Customers (JWT):**
     - Identity is resolved server-side from `SecurityContextHolder` (`CustomUserDetails` or `userRepository`).
     - Caller phone is normalized and compared against normalized `order.getCustomerPhone()`.
     - If phones do not match, throws `AccessDeniedException` (HTTP 403 Forbidden).
     - **Anti-Spoofing Rule:** A phone number provided in the request payload CANNOT override the server-resolved authenticated identity.
     - Platform administrators (`ROLE_ADMIN`) and shop owners owning the order's bakery (`ROLE_SHOP_OWNER`) are authorized.
   - **Unauthenticated Guest Checkout:**
     - The caller must provide proof of possession of the checkout session via:
       a) Server-signed `checkoutToken` in `X-Checkout-Token` header or payload, validated via `jwtService.validateCheckoutToken(token, orderNumber, phone)`, OR
       b) High-entropy Razorpay transaction ID (`razorpayOrderId`) returned by `createCustomerPaymentOrder` matching `order.getTransactionId()` and matching customer phone.
     - If caller only provides a guessed `orderNumber` and an arbitrary phone number without a server token, the request is rejected with `AccessDeniedException` (HTTP 401 Unauthorized / 403 Forbidden).

#### 3. Late-Payment Slot Overbooking Protection Preserved
- If a late payment succeeds after an order was cancelled, `verifyCustomerPayment` detects `order.getOrderStatus().equals("CANCELLED")`.
- It executes `handlePaymentOnCancelledOrder`, flagging the payment for reconciliation and alerting owner/admin.
- The order status remains strictly `"CANCELLED"` and payment status `"RECONCILIATION_REQUIRED"`. It **never reactivates the order** and **never consumes the released delivery slot capacity**.

---

## 4. Test Execution & Verification Results

### 1. Focused Backend Unit & Security Tests
Command: `mvn test '-Dtest=GuestTrackingTest,CustomerPaymentControllerTest'`
- `GuestTrackingTest`: 11 tests run, 0 failures, 0 errors.
  - `testRequestOtp_NewPhone`: PASSED
  - `testRequestOtp_ResendCooldown`: PASSED
  - `testRequestOtp_PreviousOtpInvalidation`: PASSED
  - `testVerifyOtp_SuccessSingleUse`: PASSED
  - `testVerifyOtp_WrongOtp`: PASSED
  - `testVerifyOtp_TooManyAttempts`: PASSED
  - `testVerifyOtp_Expired`: PASSED
  - `testRequestOtp_EmailFallback_WhenSmsUnconfigured`: PASSED
  - `testRequestOtp_BothChannels_WhenSmsAndEmailConfigured`: PASSED
  - `testRequestOtp_ReusesTrustedAccountEmail_DoesNotOverrideWithUntrusted`: PASSED
  - `testRequestOtp_InvalidEmailHandledSafely`: PASSED
- `CustomerPaymentControllerTest`: 19 tests run, 0 failures, 0 errors.
  - `createCustomerPaymentOrder_UsesAuthoritativeDbAmountAndCallsRazorpayService`: PASSED
  - `createCustomerPaymentOrder_RejectsCancelledOrder`: PASSED
  - `createCustomerPaymentOrder_RejectsAlreadyPaidOrder`: PASSED
  - `verifyCustomerPayment_SuccessfulVerificationUpdatesOrderAndPayment`: PASSED
  - `verifyCustomerPayment_FailsOnSignatureMismatch`: PASSED
  - `verifyCustomerPayment_FailsWhenRazorpayOrderIdDoesNotMatch`: PASSED
  - `verifyCustomerPayment_IsIdempotentOnDuplicateCall`: PASSED
  - `verifyCustomerPayment_OnCancelledOrder_RetainsCancelledStatusAndFlagsReconciliation`: PASSED
  - `verifyCustomerPayment_LateCapturedPaymentOnCancelledOrder_DoesNotRestoreConfirmed`: PASSED
  - `verifyCustomerPayment_ZeroAmountOrder_BypassesRazorpayServiceAndConfirmsDirectly`: PASSED
  - `cancelCustomerPayment_SuccessfullyCancelsOrderAndSetsPaymentFailed`: PASSED
  - `cancelCustomerPayment_AuthorizedCustomer_CanCancelOwnOrder`: PASSED
  - `cancelCustomerPayment_DifferentCustomer_RejectedWithForbidden`: PASSED
  - `cancelCustomerPayment_MismatchedPayloadPhone_CannotOverrideAuthenticatedCustomer`: PASSED
  - `cancelCustomerPayment_UnauthenticatedWithoutValidToken_RejectedWithUnauthorized`: PASSED
  - `cancelCustomerPayment_UnauthenticatedWithValidCheckoutToken_CanCancel`: PASSED
  - `cancelCustomerPayment_FailsIfOrderIsAlreadyPaid`: PASSED
  - `cancelCustomerPayment_IsIdempotentWhenAlreadyCancelled`: PASSED
  - `cancelCustomerPayment_RestoresCouponUsage`: PASSED

### 2. Rate-Limiting & Delayed Payment Regression Tests
Command: `mvn test '-Dtest=GuestTrackingRateLimitTest,OtpRateLimitSecurityTest,DelayedPaymentConfirmationRegressionTest'`
- `GuestTrackingRateLimitTest`: 4 tests run, 0 failures, 0 errors. PASSED.
- `OtpRateLimitSecurityTest`: 2 tests run, 0 failures, 0 errors. PASSED.
- `DelayedPaymentConfirmationRegressionTest`: 10 tests run, 0 failures, 0 errors. PASSED.

### 3. Full Backend Test Suite
Command: `mvn test`
- **Result:** Tests run: **927**, Failures: **0**, Errors: **0**, Skipped: **0**.
- **Build Status:** `BUILD SUCCESS` (Total time: 09:01 min).

### 4. Full Frontend Test Suite
Command: `npm test` (running 22 test files in `frontend_v2/__tests__`)
- **Result:** Tests: **241**, Suites: **21**, Pass: **241**, Fail: **0**.
- **Duration:** 7.67s.

### 5. Frontend Production Build & Lint Checks
- `npm run lint`: `0 errors`, 1 pre-existing warning in `InteractiveLocationMap.tsx`.
- `npm run build`: `Compiled successfully`, all 38 static and dynamic routes generated cleanly.

---

## 5. Configuration Requirements & Operational Notes

1. **Third-Party Credentials Notice:**
   - Real email (Resend) and real SMS (Twilio) deliveries were tested under unit and mock harness environments.
   - Live external SMS/email delivery was not dispatched to real user devices or live mailboxes, adhering to sandbox and project constraints.
   - In production, set `twilio.account-sid`, `twilio.auth-token`, and `twilio.phone-number` in `application.yml` or environment variables for SMS, and `mail.resend.api-key` (`RESEND_API_KEY`) for email.
2. **Late-Payment Protection Integrity:**
   - Verified that orders marked `CANCELLED` continue to reject confirmation on delayed payment callbacks and webhook events, correctly escalating them for manual bakery review without reactivating slots.
3. **Database Integrity:**
   - No database migrations or schema alterations were performed. Existing tables (`users`, `orders`, `otp_verifications`, `payments`, `coupons`) remain 100% compliant with existing Flyway migration state.

---

## 6. Verification Summary Checklist

- [x] OTP email dispatch uses expected recipient and structured body.
- [x] Email fallback activates when SMS delivery is unconfigured or operating in mock mode.
- [x] Missing or invalid candidate email is handled gracefully without crashing.
- [x] Trusted customer account email cannot be overridden by untrusted request payload email.
- [x] OTP 10-minute expiry, 60-second cooldown, 3-attempt limit, and 10 req/min IP rate limiting remain intact.
- [x] OTP values are never exposed in API responses or logs.
- [x] Authenticated customer can cancel only their own eligible unpaid order.
- [x] Different customer JWT is rejected with HTTP 403 Forbidden.
- [x] Payload phone cannot override authenticated customer identity.
- [x] Guessed order number without server checkout token is rejected with HTTP 401/403.
- [x] Legitimate guest checkout cancellation with server checkout token succeeds.
- [x] Paid orders cannot be cancelled via this endpoint (HTTP 400).
- [x] Duplicate cancellations are safe and idempotent (HTTP 200).
- [x] Full backend test suite passes (927 tests).
- [x] Full frontend test suite passes (241 tests).
- [x] Frontend linting and Next.js production build pass.
