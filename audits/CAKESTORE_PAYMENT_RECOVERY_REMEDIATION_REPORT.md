# CakeStore Phase A.2.3 — Payment Recovery Safety Remediation Report

**Date:** 2026-10-21  
**Target Branch:** `development`  
**Execution Environment:** Local Development / Host Sandbox (No Cloud Deployments Executed)  
**Final Status & Verdict:** **READY FOR RE-REVIEW**  

---

## Executive Summary

Phase A.2.3 has successfully resolved all safety, concurrency, and reconciliation risks identified during the Phase A.2.2 review (`CAKESTORE_PAYMENT_RECOVERY_SAFETY_REVIEW.md`). 

The core vulnerability—where a delayed Razorpay webhook or client-side payment verification could blind-reactivate an intentionally cancelled order without verifying kitchen capacity or slot availability—has been fully remediated. If a valid payment is confirmed for an order already marked `CANCELLED`:
1. The order status is **never** changed to `CONFIRMED`; it permanently remains `CANCELLED`.
2. Financial integrity is preserved: the order's `paymentStatus` is updated to `PAID`, transaction metadata is recorded, and a completed `Payment` ledger entry is persisted idempotently.
3. Bakery owners and platform administrators immediately receive high-priority action-required alerts directing them to reconcile the order (fulfill or refund).
4. The customer is notified via email and SMS that payment was received for a cancelled checkout session and is under review, explicitly avoiding any premature claim that a refund has already taken place.
5. All database operations are wrapped in transactional boundaries with pessimistic write row locks and guarded by a new Flyway migration (`V51`) establishing a partial unique index on `payments(provider_payment_id)` to prevent concurrent double-entry race conditions.

---

## 1. Summary of Changes

| Component / File | Change Type | Purpose |
|---|---|---|
| `backend/src/main/resources/db/migration/V51__add_unique_provider_payment_id.sql` | **New File** | Preflight duplicate check and partial unique index on `payments(provider_payment_id)` WHERE `provider_payment_id IS NOT NULL`. |
| `backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java` | **Modified** | Added `findByOrderNumberWithLock(String orderNumber)` with `@Lock(LockModeType.PESSIMISTIC_WRITE)`. |
| `backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java` | **Modified** | Hardened `payment.captured` handler with row locking, non-reactivation of `CANCELLED` orders, idempotent `savePaymentRecordIdempotent` with unique index catch, alerts, and customer notifications. |
| `backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java` | **Modified** | Added `@Transactional` to `verifyCustomerPayment` & `cancelCustomerPayment`, row locking, non-reactivation of `CANCELLED` orders, returns `status: "RECONCILIATION_REQUIRED"`, and idempotent payment persistence. |
| `backend/src/test/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentControllerTest.java` | **Modified** | Added 3 unit tests verifying non-reactivation of cancelled orders, rejection of refunded orders, and idempotent duplicate verification. |
| `backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/DelayedPaymentConfirmationRegressionTest.java` | **Modified** | Expanded from 5 to 10 end-to-end integration tests verifying webhooks, client verification, concurrency race safety, duplicate suppression, and notifications. |
| `backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java` | **Preserved** | Preserves fix preventing automatic cancellation of stale `PAYMENT_PENDING` orders. |
| `backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java` | **Preserved** | Preserves monitoring and slot reservation guarantees. |

---

## 2. Detailed Behavior: Before vs. After

### A. Delayed Payment on Cancelled Orders

| Scenario | Behavior Before (Vulnerable) | Behavior After (Remediated) |
|---|---|---|
| **Webhook arrives for `CANCELLED` order** | Blindly flipped `orderStatus` to `CONFIRMED`. If delivery slot was reassigned to another customer, kitchen suffered overbooking or unfulfillable promise. | Retains `orderStatus = CANCELLED`. Updates `paymentStatus = "PAID"`. Saves completed `Payment` row. Flags order for manual reconciliation. |
| **Client verification for `CANCELLED` order** | Blindly recovered `orderStatus` to `CONFIRMED` and returned `SUCCESS`. | Retains `orderStatus = CANCELLED`. Updates `paymentStatus = "PAID"`. Returns `status: "RECONCILIATION_REQUIRED"`. |
| **Refunded order re-payment attempt** | Risk of state corruption if late webhook arrived. | Both webhook and client verification explicitly inspect `paymentStatus == "REFUNDED"` and reject / ignore further modifications. |

### B. Concurrency Safeguards & Duplicate Prevention

| Potential Race Condition | Vulnerability Before | Safeguard Implemented |
|---|---|---|
| **Concurrent Webhook & Client Verification** | Separate un-synchronized transactions could read `paymentStatus = PENDING` simultaneously, resulting in duplicate `Payment` ledger records and duplicate owner notifications. | 1. `orderRepository.findByOrderNumberWithLock(orderNumber)` acquires a `PESSIMISTIC_WRITE` lock on the `orders` row.<br>2. Database-level partial unique index `uq_payments_provider_payment_id` on `payments(provider_payment_id)`.<br>3. `savePaymentRecordIdempotent` catches `DataIntegrityViolationException` and safely falls back to the existing record. |
| **Duplicate Webhook Delivery** | Repeated delivery of identical or new event IDs for an already processed order could re-trigger alerts. | Dual-layer check: Webhook event repository deduplication + order payment status check (`order.getPaymentStatus().equalsIgnoreCase("PAID")`) skips duplicate notifications and operations. |

---

## 3. Flyway Migration Details

- **File:** `backend/src/main/resources/db/migration/V51__add_unique_provider_payment_id.sql`
- **Target Table:** `payments`
- **Target Column:** `provider_payment_id`
- **Schema Evolution Strategy:**
  1. **Preflight Duplicate Validation (Stage 1):** An anonymous PL/pgSQL block scans for existing duplicate non-null `provider_payment_id` values. If duplicates exist, migration halts with an informative error rather than silently dropping records.
  2. **Partial Unique Index (Stage 2):**
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment_id 
     ON payments(provider_payment_id) 
     WHERE provider_payment_id IS NOT NULL;
     ```
     Using a partial index ensures that cash-on-delivery, internal pending payments, or test transactions without a gateway provider payment ID (where column is `NULL`) do not collide.

---

## 4. Multi-Channel Notification & Alerting

When a genuine payment is captured for an order that is already `CANCELLED`, the system dispatches:

1. **Bakery Owner Alert (`NotificationService`):**
   - **Type:** `NotificationType.PAYMENT_SUCCESS`
   - **Title:** `Action Required: Payment Received on Cancelled Order`
   - **Message:** Explains that payment was received for cancelled Order `<OrderNumber>` (Tx: `<TxId>`), notes that the delivery slot was not preserved, and directs the baker to review the order in the dashboard to fulfill or refund.
2. **Platform Administrator Alert (`AdminNotificationService`):**
   - **Type:** `AdminNotificationType.PAYMENT_RECEIVED`
   - **Priority:** `HIGH`
   - **Category:** `PAYMENTS`
   - **Title:** `Payment on Cancelled Order`
   - **Reference ID:** `RECON_ORD_<OrderNumber>`
   - **Action URL:** `/admin/orders`
3. **Customer Notification (`EmailService` & `SmsService`):**
   - **Email Subject:** `Payment Received for Cancelled Order #<OrderNumber> - Review in Progress`
   - **Content:** Truthful notice informing customer that payment was received, the session was previously cancelled, and the bakery is reviewing fulfillment or refund options.
   - **Honesty Guarantee:** **Does not** claim that a refund has been processed unless a refund transaction is actually confirmed.
4. **Audit Activity Log (`ActivityLoggerService`):**
   - Logs `PAYMENT_CAPTURED_CANCELLED_ORDER` or `PAYMENT_VERIFIED_CANCELLED_ORDER` with transaction ID and order reference.

---

## 5. Verification & Test Evidence

### A. Focused Backend Payment & Order Tests

Execution Command:
```bash
mvn test "-Dtest=CustomerPaymentControllerTest,DelayedPaymentConfirmationRegressionTest,StorefrontExpiryTest,CustomCakeOrderLifecycleSyncTest,WebhookControllerIntegrationTest,StageCPaymentAndSubscriptionTest,OrderServiceTest,StorefrontCapacityTest"
```

**Results:**
- **Tests Run:** 81
- **Failures:** 0
- **Errors:** 0
- **Skipped:** 0
- **Build Status:** **BUILD SUCCESS**

#### Detailed Test Breakdown:
1. `com.cakeplatform.api.modules.order.scheduler.DelayedPaymentConfirmationRegressionTest` (10/10 Passed):
   - `Regression 1: PAYMENT_PENDING order older than 15 minutes is NOT automatically cancelled`
   - `Regression 2: Reserved delivery slot is NOT released solely due to elapsed time`
   - `Regression 3: Valid delayed Razorpay success webhook updates order to CONFIRMED and PAID`
   - `Regression 4: Duplicate webhooks remain idempotent`
   - `Regression 5: Manual cancellation by bakery owner safely releases delivery slot`
   - `Regression 6: Captured payment for CANCELLED order via webhook does NOT reactivate it, preserves payment, flags reconciliation`
   - `Regression 7: Captured payment for CANCELLED order via client verification does NOT reactivate it`
   - `Regression 8: Refunded orders remain protected against reactivation`
   - `Regression 9: Concurrent webhook and client verification do not create duplicate payment rows`
   - `Regression 10: Duplicate webhook deliveries do not send duplicate alerts on cancelled orders`
2. `com.cakeplatform.api.modules.payment.controller.CustomerPaymentControllerTest` (14/14 Passed):
   - Authoritative amount verification, Razorpay creation, cancellation, idempotency, cancelled order reconciliation, and refunded order protection.
3. `com.cakeplatform.api.modules.order.scheduler.StorefrontExpiryTest` (5/5 Passed).
4. `com.cakeplatform.api.modules.order.service.CustomCakeOrderLifecycleSyncTest` (7/7 Passed).
5. `com.cakeplatform.api.modules.order.controller.WebhookControllerIntegrationTest` (6/6 Passed).
6. `com.cakeplatform.api.modules.payment.StageCPaymentAndSubscriptionTest` (26/26 Passed).
7. `com.cakeplatform.api.modules.order.service.OrderServiceTest` (10/10 Passed).
8. `com.cakeplatform.api.modules.storefront.StorefrontCapacityTest` (3/3 Passed).

### B. Frontend Verification

Execution Command:
```bash
npm test (in frontend_v2)
```

**Results:**
- **Total Tests:** 176
- **Test Suites:** 15
- **Passed:** 176
- **Failed:** 0
- **Duration:** 5.34s

---

## 6. Remaining Risks & Operational Recommendations

1. **Manual Reconciliation Flow in UI:**
   - *Current State:* Bakery owners and admins receive distinct dashboard notifications with order numbers and direct links (`/admin/orders`).
   - *Recommendation for Phase A.3:* Provide a 1-click "Issue Razorpay Refund" button within the bakery owner order drawer specifically enabled for `CANCELLED + PAID` orders.
2. **Database Migration Deployment Check:**
   - *Current State:* Migration `V51` has a preflight duplicate check that protects against unique constraint creation failures.
   - *Recommendation for Deployment:* Run Flyway migrations during off-peak hours as index creation on large production tables can briefly acquire table locks.

---

## 7. Final Verdict

### **READY FOR RE-REVIEW**

All requirements from Phase A.2.3 have been fully implemented, concurrency-protected, verified across 81 backend tests and 176 frontend tests, and documented without staging, committing, or cloud-deploying.
