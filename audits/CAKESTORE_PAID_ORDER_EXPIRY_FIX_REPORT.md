# CakeStore — Fix Paid-Order Cancellation on Delayed Payment Confirmation Report

**Date:** October 21, 2026  
**Status:** Verification Complete (Local Backend Test Suite Passed)  
**Target Environment:** Local Workspace & Git Working Tree (`development` branch)  

---

## 1. Executive Summary

This report documents the resolution of the unsafe order cancellation and delivery slot release behavior previously triggered by `OrderExpiryScheduler`.

### Problem Solved
Previously, `OrderExpiryScheduler` executed every 60 seconds and automatically cancelled all `PAYMENT_PENDING` orders older than 15 minutes via `OrderService.cancelStalePaymentPendingOrders()` and `OrderRepository.cancelIfPaymentPending()`. This automatic timeout:
1. Operated blindly without checking real-time payment status against the Razorpay gateway.
2. Released reserved delivery slot capacity for orders where the customer may have already completed payment (e.g. experiencing webhook delay, slow bank authorization, or client-side connection lag).
3. Left paid customers in a state where their order was marked `CANCELLED` and their delivery slot re-assigned to other buyers, causing business disruptions and customer frustration.

### Remediation Applied
- **Removed Unsafe Scheduled Cancellation:** `OrderExpiryScheduler` now invokes `orderService.monitorPendingPaymentOrders(threshold)`, retaining `PAYMENT_PENDING` orders in a pending reconciliation state rather than mutating their status to `CANCELLED`.
- **Preserved Delivery Slot Reservations:** Because CakeStore's slot availability query (`OrderRepository.countActiveOrdersForSlotAndDate`) treats `PAYMENT_PENDING` as an active capacity-consuming status (`CAPACITY_CONSUMING_STATUSES`), retaining orders in `PAYMENT_PENDING` preserves slot reservations automatically.
- **Hardened Late Payment Confirmation:** Both the asynchronous Razorpay webhook handler (`WebhookController`) and the client payment verification endpoint (`CustomerPaymentController`) were enhanced to safely recover orders to `CONFIRMED` and `PAID` even if delayed or if an order was previously marked cancelled, while strictly refusing reactivation for orders already marked `REFUNDED`.
- **Maintained Cryptographic & Idempotency Safeguards:** HMAC-SHA256 signature verification and `WebhookEventRepository.existsByEventId` duplicate suppression remain strictly active and unaltered.
- **Manual Cancellation Preserved:** Bakery owners and customers retain explicit, legitimate manual cancellation capabilities with appropriate payment-state safeguards.

---

## 2. Files Changed

| File Path | Component | Description of Changes |
|---|---|---|
| [`backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java) | Scheduler | Replaced `cancelStalePaymentPendingOrders` with `monitorPendingPaymentOrders`. No order status transitions to `CANCELLED` on schedule. |
| [`backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java) | Service Layer | Added `monitorPendingPaymentOrders(LocalDateTime threshold)` (read-only audit/logging). Deprecated and converted `cancelStalePaymentPendingOrders` into a non-cancelling delegation method. |
| [`backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java) | Webhook Controller | Enabled late `payment.captured` webhooks to confirm `PAYMENT_PENDING` and recover non-refunded `CANCELLED` orders to `CONFIRMED`, with explicit guard blocking `REFUNDED` orders. |
| [`backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java) | Payment Controller | Added `REFUNDED` check to block verification of refunded orders; allowed signature verification and recovery to `CONFIRMED` for non-refunded orders upon valid client HMAC signature verification. |
| [`backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/StorefrontExpiryTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/StorefrontExpiryTest.java) | Existing Test Suite | Updated tests to assert that stale `PAYMENT_PENDING` orders are retained across scheduler runs, slot capacity is preserved, and slot capacity is only freed when manually cancelled by the owner. |
| [`backend/src/test/java/com/cakeplatform/api/modules/order/service/CustomCakeOrderLifecycleSyncTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/order/service/CustomCakeOrderLifecycleSyncTest.java) | Existing Test Suite | Updated test to assert that converted custom cake orders in `PAYMENT_PENDING` are retained rather than cancelled on expiry check. |
| [`backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/DelayedPaymentConfirmationRegressionTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/order/scheduler/DelayedPaymentConfirmationRegressionTest.java) | New Test Suite | Added 5 dedicated regression test cases covering order retention, slot capacity preservation, delayed webhook confirmation, webhook idempotency, and manual owner cancellation. |

---

## 3. Previous vs. New Behavior Matrix

| Dimension | Previous Behavior | New Behavior |
|---|---|---|
| **Scheduled Expiry Trigger** | Every 60s, queries `OrderRepository.findStalePaymentPendingOrders` (>15m) and calls `cancelIfPaymentPending()`. | Every 60s, queries `OrderRepository.findStalePaymentPendingOrders` and calls `monitorPendingPaymentOrders()`. |
| **Order Status on Timeout** | Forcefully changed from `PAYMENT_PENDING` to `CANCELLED`. | Retained as `PAYMENT_PENDING` in a pending reconciliation state. |
| **Delivery Slot Reservation** | Slot capacity was released immediately upon timeout, allowing other buyers to snatch the slot. | Slot capacity is continuously preserved because `PAYMENT_PENDING` is part of `CAPACITY_CONSUMING_STATUSES`. |
| **Delayed Razorpay Webhook** | If webhook arrived after 15m, order was already `CANCELLED`. `WebhookController` set `paymentStatus="PAID"` but left `orderStatus="CANCELLED"`. | Delayed webhook transitions `PAYMENT_PENDING` to `CONFIRMED` and `PAID`. If order was somehow `CANCELLED` (and not `REFUNDED`), safely recovers it to `CONFIRMED`. |
| **Duplicate Webhook Events** | Idempotency handled by `WebhookEventRepository`. | Unchanged: `WebhookEventRepository.existsByEventId` and order `PAID` check guarantee strict idempotency. |
| **Manual Cancellation** | Bakery owners could cancel orders via `OrderService.updateOrderStatus(..., "CANCELLED")`. | Preserved: Owners can still manually cancel genuinely abandoned or unpaid orders, which legitimately frees slot capacity. |
| **Customer Checkout Cancellation** | Customer closing modal could trigger `/cancel-payment`. | Preserved: Explicit modal cancellation sets order to `CANCELLED` and payment to `FAILED`, with late webhook recovery safety. |

---

## 4. Scheduler and Delivery-Slot Logic Review

### Schedulers Reviewed
1. **`OrderExpiryScheduler` (`backend/src/main/java/.../OrderExpiryScheduler.java`)**
   - *Frequency:* Runs every 60 seconds (`@Scheduled(fixedDelay = 60000)`).
   - *Audit:* Was the sole scheduler performing automatic order cancellation. Now safely monitors pending orders without cancellation.
2. **`SubscriptionScheduler` (`backend/src/main/java/.../SubscriptionScheduler.java`)**
   - *Frequency:* Runs once daily at midnight (`@Scheduled(cron = "0 0 0 * * ?")`).
   - *Audit:* Only expires shop owner subscriptions. Does not touch customer orders or delivery slots.
3. **`SystemAutomationsScheduler` (`backend/src/main/java/.../SystemAutomationsScheduler.java`)**
   - *Frequency:* Runs once daily at 10 AM (`@Scheduled(cron = "0 0 10 * * ?")`).
   - *Audit:* Only dispatches KYC completion reminders to pending shops. Does not touch customer orders or delivery slots.

### Delivery-Slot Reservation Architecture
- **Capacity Consuming Statuses:** Defined in `OrderRepository.java` (lines 235-237):
  ```java
  List<String> CAPACITY_CONSUMING_STATUSES = List.of(
      "PAYMENT_PENDING", "NEW", "CONFIRMED", "PREPARING", "READY", 
      "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "DELIVERED"
  );
  ```
- **Capacity Verification Query:** `OrderRepository.countActiveOrdersForSlotAndDate` evaluates active orders for a specific slot and date against the slot's `maxOrders`.
- **Checkout Enforcement:** `CustomerStorefrontService.placeGuestOrder` calls `countActiveOrdersForSlotAndDate` under row lock to prevent overbooking.
- **Slot Release Trigger:** Because `CANCELLED` is excluded from `CAPACITY_CONSUMING_STATUSES`, the ONLY action that releases slot capacity is transitioning an order status to `CANCELLED`.
- **Conclusion:** By ensuring `PAYMENT_PENDING` orders never transition to `CANCELLED` on elapsed time, delivery slot reservations are completely protected against premature release.

---

## 5. Verification and Test Results

The backend test suite was executed locally using Maven:

```powershell
mvn test "-Dtest=StorefrontExpiryTest,DelayedPaymentConfirmationRegressionTest,WebhookControllerIntegrationTest,CustomCakeOrderLifecycleSyncTest,CustomerPaymentControllerTest"
```

### Test Execution Summary

| Test Class | Tests Run | Failures | Errors | Result |
|---|:---:|:---:|:---:|:---:|
| `StorefrontExpiryTest` | 5 | 0 | 0 | **PASSED** |
| `DelayedPaymentConfirmationRegressionTest` | 5 | 0 | 0 | **PASSED** |
| `WebhookControllerIntegrationTest` | 6 | 0 | 0 | **PASSED** |
| `CustomCakeOrderLifecycleSyncTest` | 7 | 0 | 0 | **PASSED** |
| `CustomerPaymentControllerTest` | 11 | 0 | 0 | **PASSED** |
| **Total** | **34** | **0** | **0** | **BUILD SUCCESS** |

### Detailed Regression Test Results (`DelayedPaymentConfirmationRegressionTest`)
1. **`testPaymentPendingOrderOlderThan15MinutesIsNotAutomaticallyCancelled`**: PASSED. Verified an order placed 25 minutes ago remains in `PAYMENT_PENDING` / `PENDING` across scheduler execution.
2. **`testReservedDeliverySlotIsNotReleasedSolelyDueToElapsedTime`**: PASSED. Verified that after 35 minutes and scheduler execution, slot capacity is preserved and a second order for the same slot is rejected with `DeliverySlotFullException`.
3. **`testDelayedRazorpaySuccessWebhookUpdatesOrderCorrectly`**: PASSED. Verified that a delayed `payment.captured` webhook for an order aged 45 minutes transitions the order to `CONFIRMED` and `PAID`, sets `transactionId` and `paidAt`, and persists a `COMPLETED` payment entity.
4. **`testDuplicateWebhooksRemainIdempotent`**: PASSED. Verified that replay of the same webhook event ID and subsequent calls for an already paid order return HTTP 200 OK without creating duplicate payment rows.
5. **`testManualCancellationSafelyReleasesDeliverySlot`**: PASSED. Verified that when a bakery owner explicitly cancels an order, status becomes `CANCELLED` and slot capacity is legitimately released for subsequent customers.

---

## 6. Payment Reconciliation Analysis & Remaining Risks

1. **Genuinely Abandoned Checkouts (No Customer Payment):**
   - *Risk:* If a customer starts an online checkout, selects a delivery slot, and abandons their browser without completing payment, the delivery slot remains reserved in `PAYMENT_PENDING`.
   - *Mitigation & Recommendation:* 
     - Because CakeStore allows bakery owners to manage their order queue directly, owners can view pending orders in their dashboard and manually cancel orders if needed.
     - For future enhancement (Phase 3), a dedicated Razorpay Order Status Reconciliation Job can be introduced. Rather than blindly cancelling orders on a timer, this job would poll Razorpay's API (`GET /orders/{order_id}/payments`) to query the gateway directly; only when Razorpay explicitly confirms that the payment attempt failed or expired at the gateway level would the order be marked cancelled.
2. **Double Webhook & Client Signature Race Conditions:**
   - Both `WebhookController` and `CustomerPaymentController` use database transactions and check `"PAID".equalsIgnoreCase(order.getPaymentStatus())` before processing. If a webhook and client redirect arrive simultaneously, the first to commit marks the order `PAID`, and the second exits idempotently.
3. **Refunded Order Protection:**
   - If an order has been cancelled and refunded (`paymentStatus == "REFUNDED"`), both the webhook handler and the payment verification endpoint will reject any reactivation attempt.

---

## 7. Operational & Deployment Notes

- **Working Tree State:** All changes reside cleanly in the local repository on the `development` branch.
- **Production Secrets:** No production secrets or environment variables were modified.
- **Deployment Status:** No cloud deployments to Azure Container Apps or Vercel were performed. Live bank/Razorpay testing requires deploying to a staging/production environment with valid webhooks configured.
