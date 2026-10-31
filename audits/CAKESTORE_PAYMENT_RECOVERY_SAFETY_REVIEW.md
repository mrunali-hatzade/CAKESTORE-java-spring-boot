# CakeStore — Phase A.2.2: Payment Recovery Safety Review

**Document ID:** `CAKESTORE_PAYMENT_RECOVERY_SAFETY_REVIEW.md`  
**Review Date:** October 21, 2026  
**Auditor:** Antigravity Autonomous Pair Programmer (DeepMind Advanced Agentic Coding)  
**Target Repository:** `D:\PROJECTS\CAKE SAAs1`  
**Active Branch:** `development`  
**Audit Mode:** Strict Read-Only Payment Recovery & Concurrency Safety Audit  

---

## 1. Overall Review Verdict

### **VERDICT: SAFE AFTER FIXES**

While the elimination of `OrderExpiryScheduler`'s automatic 15-minute cancellation successfully prevents unverified cancellation of `PAYMENT_PENDING` orders, **the subsequent "late payment recovery" logic introduced in `WebhookController` and `CustomerPaymentController` contains critical fulfillment and concurrency risks** when handling payments on previously `CANCELLED` orders:

1. **Blind Reactivation Overbooking Risk:** When a payment is captured on an already `CANCELLED` order, both `WebhookController` and `CustomerPaymentController` unconditionally transition `orderStatus` to `CONFIRMED`. Because the delivery slot was already released when the order was cancelled, another customer may have booked that slot in the interim. Blindly reactivating the order to `CONFIRMED` **violates delivery slot maximum capacity limits (`bookedCount > maxOrders`) and creates unfulfillable orders**.
2. **Override of Intentional Bakery Cancellation:** If a bakery owner intentionally cancelled an order (e.g. kitchen equipment failure, missing ingredients, or bakery closed), a late payment capture will silently resurrect the order to `CONFIRMED` on the owner's dashboard without checking if the bakery can fulfill it.
3. **Webhook vs. Client-Side Concurrency Race:** `CustomerPaymentController.verifyCustomerPayment` is **not annotated with `@Transactional`**, and the `payments` table lacks a database-level unique constraint on `provider_payment_id`. Concurrent execution of client verification and gateway webhook can create duplicate `Payment` ledger records.

Until these three specific edge-case fixes are applied, the system is **NOT SAFE TO PROCEED** for blind reactivation of cancelled orders, but is otherwise safe for normal `PAYMENT_PENDING` orders.

---

## 2. Detailed Technical Verification of the 7 Review Criteria

---

### Criterion 1: Delayed Valid Razorpay Success Webhook on `PAYMENT_PENDING` Orders
- **Requirement:** A delayed valid Razorpay success webhook correctly confirms a `PAYMENT_PENDING` order.
- **Verification Finding:** **PASSED / VERIFIED SAFE**.
- **Technical Analysis:**
  - `OrderExpiryScheduler` was modified to call `orderService.monitorPendingPaymentOrders(threshold)` instead of cancelling orders. Orders remain in `PAYMENT_PENDING` status indefinitely or until manually acted upon.
  - In `WebhookController.java` (lines 158–170), when a valid `payment.captured` event arrives:
    ```java
    order.setPaymentStatus("PAID");
    order.setTransactionId(transactionId);
    order.setPaidAt(LocalDateTime.now());
    if ("NEW".equalsIgnoreCase(order.getOrderStatus()) 
            || "PENDING".equalsIgnoreCase(order.getOrderStatus()) 
            || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())) {
        order.setOrderStatus("CONFIRMED");
    }
    orderRepository.save(order);
    ```
  - The delivery slot reservation was never released during the waiting period because `OrderRepository.CAPACITY_CONSUMING_STATUSES` includes `"PAYMENT_PENDING"`.
  - The order transitions cleanly from `PAYMENT_PENDING` to `CONFIRMED`, `paymentStatus` is updated to `PAID`, `Payment` entity is persisted, and the bakery owner receives a real-time notification.
- **Evidence:** Verified by `DelayedPaymentConfirmationRegressionTest.testDelayedRazorpaySuccessWebhookUpdatesOrderCorrectly()`.

---

### Criterion 2: Blind Reactivation of Previously `CANCELLED` Orders
- **Requirement:** A previously `CANCELLED` order cannot be reactivated blindly if its delivery slot has already been reassigned or its cancellation was intentional.
- **Verification Finding:** **FAILED / CRITICAL RISK IDENTIFIED**.
- **Technical Analysis:**
  - In `WebhookController.java` (lines 161–169):
    ```java
    if ("NEW".equalsIgnoreCase(order.getOrderStatus()) 
            || "PENDING".equalsIgnoreCase(order.getOrderStatus()) 
            || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())
            || "CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
        if ("CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
            log.warn("Late payment captured for previously CANCELLED order {}. Recovering order to CONFIRMED.", order.getOrderNumber());
        }
        order.setOrderStatus("CONFIRMED");
    }
    ```
  - In `CustomerPaymentController.java` (lines 196–203):
    ```java
    if ("NEW".equalsIgnoreCase(order.getOrderStatus()) 
            || "PENDING".equalsIgnoreCase(order.getOrderStatus()) 
            || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())
            || "CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
        if ("CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
            log.warn("Late payment verified for previously CANCELLED order {}. Recovering order to CONFIRMED.", order.getOrderNumber());
        }
        order.setOrderStatus("CONFIRMED");
    }
    ```
  - **The Risk:** 
    1. When an order is moved to `CANCELLED`, its delivery slot is released because `CANCELLED` is not in `CAPACITY_CONSUMING_STATUSES`.
    2. Other customers can immediately book that delivery slot. If the slot had `maxOrders = 1` and another customer booked it, the slot capacity is now at 100%.
    3. If a late webhook or client redirect arrives with a captured payment for the old cancelled order, line 168 blindly sets `order.setOrderStatus("CONFIRMED")`.
    4. **Result:** The slot is now overbooked (`activeOrders = 2 > maxOrders = 1`). The bakery has committed to deliver two orders in a slot that only accommodates one.
    5. Furthermore, if the bakery owner explicitly cancelled the order because they ran out of ingredients or closed the shop, this code silently overrides the owner's operational decision.

---

### Criterion 3: Handling Payments Arriving After Cancellation (Refund vs. Reconciliation)
- **Requirement:** A successful payment arriving after cancellation has a safe, explicit handling path that does not create an unfulfillable order.
- **Verification Finding:** **INADEQUATE / MANUAL RECONCILIATION REQUIRED**.
- **Technical Analysis:**
  - When payment is captured by Razorpay for an order already in `CANCELLED` status, customer money has legitimately left their bank account.
  - **Required Safe Path:**
    1. **Financial Accounting:** The incoming payment MUST be recorded in the `Payment` table with `status = "COMPLETED"` and the order's `paymentStatus` must reflect `PAID`. (Discarding the payment or throwing an exception is dangerous because the platform would hold customer money with zero ledger record).
    2. **Order Fulfillment Protection:** The `orderStatus` must **NOT** be changed to `CONFIRMED` automatically. It should remain `CANCELLED` (or enter an explicit status such as `NEEDS_RECONCILIATION`).
    3. **Owner & Admin Alerting:** A high-priority notification and activity log must be dispatched to the bakery owner and platform administrator:
       > *"Payment of ₹X was captured for CANCELLED order #ORD-123. Delivery slot capacity may be unavailable. Please review this order in your dashboard to either accept fulfillment or issue a customer refund."*
    4. **Customer Communication:** An automated email/SMS must inform the customer that their payment was received after the checkout session was cancelled, and that the bakery is reviewing whether the order can be fulfilled or if a refund will be processed.
    5. **Refund Capability:** The platform already possesses `orderService.updatePaymentStatus(userId, orderId, "REFUNDED", note)`, which dispatches refund notification emails/SMS to the customer.

---

### Criterion 4: Race Conditions Between Webhook and Client-Side Verification
- **Requirement:** Webhook and client-side payment verification cannot race into inconsistent order, payment, or slot states.
- **Verification Finding:** **POTENTIAL RACE IDENTIFIED**.
- **Technical Analysis:**
  - **`WebhookController.handleRazorpayWebhook`** is annotated with `@Transactional`. It records the event in `WebhookEventRepository.saveAndFlush()`. If the event ID was already processed, it exits immediately.
  - **`CustomerPaymentController.verifyCustomerPayment`** is **NOT** annotated with `@Transactional`.
  - **Database Constraints:** 
    - Inspected `V1__init_schema.sql` (lines 68–84). The `payments` table has `id BIGSERIAL PRIMARY KEY`, foreign keys to `shops` and `subscriptions`, but **NO UNIQUE CONSTRAINT** on `provider_payment_id` or `provider_order_id`.
  - **Race Scenario:**
    1. Customer completes payment on Razorpay.
    2. Client frontend immediately redirects to `/verify-payment` on Thread 1.
    3. Razorpay webhook fires `/api/webhooks/razorpay` on Thread 2 at the exact same millisecond.
    4. Thread 1 queries `paymentRepository.findByProviderPaymentId(transactionId)` -> Returns `Optional.empty()`.
    5. Thread 2 queries `paymentRepository.findByProviderPaymentId(transactionId)` -> Returns `Optional.empty()`.
    6. Both threads execute `paymentRepository.save(payment)`.
    7. **Result:** Two duplicate `Payment` rows are inserted for the same payment transaction ID. While the order status remains `CONFIRMED`, payment analytics and ledger reporting now double-count the revenue.

---

### Criterion 5: Protection Against Reactivation of `REFUNDED` Orders
- **Requirement:** `REFUNDED` orders cannot be reactivated.
- **Verification Finding:** **PASSED / VERIFIED SAFE**.
- **Technical Analysis:**
  - In `WebhookController.java` (lines 152–156):
    ```java
    if ("REFUNDED".equalsIgnoreCase(order.getPaymentStatus())) {
        log.warn("Webhook ignored: Order {} is already marked REFUNDED.", orderNumber);
        return ResponseEntity.ok("Webhook processed (ignored, order refunded)");
    }
    ```
  - In `CustomerPaymentController.java` (lines 134–136):
    ```java
    if ("REFUNDED".equalsIgnoreCase(order.getPaymentStatus())) {
        throw new IllegalStateException("Cannot verify payment for a refunded order");
    }
    ```
  - In `OrderService.java` (lines 167–169):
    ```java
    if ("REFUNDED".equals(currentPaymentStatus)) {
        throw new IllegalStateException("Order is already REFUNDED and cannot be changed.");
    }
    ```
  - Any webhook or client verification call for an order with `paymentStatus == "REFUNDED"` is immediately blocked from updating status or reactivating the order.

---

### Criterion 6: Safety of Manual Owner Cancellation
- **Requirement:** Manual owner cancellation remains safe for genuinely unpaid orders, without accidentally discarding a successful payment.
- **Verification Finding:** **PASSED WITH OBSERVATION**.
- **Technical Analysis:**
  - Bakery owners can cancel orders via `OrderService.updateOrderStatus(userId, orderId, "CANCELLED")`.
  - When an owner cancels an order:
    - If `paymentStatus` is `PENDING`, the order is cancelled and the delivery slot is released.
    - If `paymentStatus` is already `PAID`, `orderStatus` changes to `CANCELLED`, but `paymentStatus` remains `PAID`. The payment row is NOT deleted. The owner is expected to issue a refund via `updatePaymentStatus(..., "REFUNDED", ...)`.
  - **Observation:** If the owner cancels an order while customer payment is in flight (e.g. at minute 14 when payment was authorized at minute 13:59), the arrival of the payment captures the funds. As analyzed in Criterion 2 & 3, the payment is preserved, but the order should not be blindly confirmed without checking capacity.

---

### Criterion 7: Database Locking & Concurrency Protection
- **Requirement:** Existing database locking and transaction boundaries protect these state transitions under concurrent requests.
- **Verification Finding:** **PARTIALLY PROTECTED / GAP IDENTIFIED**.
- **Technical Analysis:**
  - **Slot Booking:** In `CustomerStorefrontService.placeGuestOrder` (line 708), slot availability is verified under row lock during initial order placement.
  - **Order Expiry:** `OrderExpiryScheduler` runs in single-thread scheduled executor, invoking read-only `monitorPendingPaymentOrders`.
  - **Webhook Idempotency:** Protected by `WebhookEventRepository.existsByEventId(eventIdHeader)` with `saveAndFlush`.
  - **Gaps:**
    1. Neither `WebhookController` nor `CustomerPaymentController` uses pessimistic locking (`SELECT ... FOR UPDATE` or `findByIdWithPessimisticLock`) when updating the `Order` entity.
    2. `CustomerPaymentController.verifyCustomerPayment` lacks `@Transactional`.
    3. `payments` table lacks a database unique constraint on `provider_payment_id`.

---

## 3. Summary of Identified Risks and Necessary Fixes

| Risk # | Description | Severity | Impact | Required Remediation |
|:---:|---|:---:|---|---|
| **R1** | **Blind Reactivation of CANCELLED Orders** | **HIGH** | Delivery slots can be overbooked beyond `maxOrders`; owners forced to fulfill orders they cancelled. | In `WebhookController` and `CustomerPaymentController`, do NOT set `orderStatus = "CONFIRMED"` if the order is already `CANCELLED`. Instead, set `paymentStatus = "PAID"`, record the payment, keep `orderStatus = "CANCELLED"`, and alert the owner to reconcile or refund. |
| **R2** | **Duplicate Payment Records on Race** | **MEDIUM** | Simultaneous client verification and webhook can create two `Payment` rows for the same transaction. | 1. Add `@Transactional` to `CustomerPaymentController.verifyCustomerPayment`.<br>2. Add a unique database constraint on `payments(provider_payment_id)` in a Flyway migration. |
| **R3** | **Unnotified Customer on Post-Cancellation Payment** | **MEDIUM** | Customer is charged but does not know why their order remains cancelled. | Dispatch an explicit email/SMS template informing the customer that payment was received for a cancelled session and is pending bakery review/refund. |

---

## 4. Test Verification Evidence

The test suite was run locally to verify baseline test stability:

```powershell
mvn test "-Dtest=StorefrontExpiryTest,DelayedPaymentConfirmationRegressionTest,WebhookControllerIntegrationTest,CustomCakeOrderLifecycleSyncTest,CustomerPaymentControllerTest"
```

**Results:**
- `StorefrontExpiryTest`: 5 passed / 5 total.
- `DelayedPaymentConfirmationRegressionTest`: 5 passed / 5 total.
- `WebhookControllerIntegrationTest`: 6 passed / 6 total.
- `CustomCakeOrderLifecycleSyncTest`: 7 passed / 7 total.
- `CustomerPaymentControllerTest`: 11 passed / 11 total.
- **Total: 34 tests passed, 0 failures, 0 errors.**

*Note on Test Limitations:* Existing tests currently assert that `CANCELLED` orders recover to `CONFIRMED`. While this passed the tests as written, this audit proves that blind recovery violates real-world slot capacity constraints when slots are full.

---

## 5. Recommended Remediation Code Changes

When authorized to implement fixes, apply the following adjustments:

### 1. In `WebhookController.java` & `CustomerPaymentController.java`:
```java
// For PAYMENT_PENDING, NEW, PENDING orders: Normal confirmation
if ("NEW".equalsIgnoreCase(order.getOrderStatus()) 
        || "PENDING".equalsIgnoreCase(order.getOrderStatus()) 
        || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())) {
    order.setOrderStatus("CONFIRMED");
} else if ("CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
    // DO NOT blindly confirm a cancelled order.
    // Retain CANCELLED status, record payment as PAID, and notify owner for manual reconciliation.
    log.warn("Payment captured for CANCELLED order {}. Retaining CANCELLED status to prevent slot overbooking. Flagged for owner reconciliation.", order.getOrderNumber());
    
    // Notify owner of action required
    notificationService.createNotification(
        order.getShop().getOwner(),
        NotificationType.ORDER_STATUS_CHANGED,
        "Action Required: Payment Received for Cancelled Order",
        String.format("Payment of ₹%s was received for cancelled Order %s. Please review and fulfill or issue refund.", order.getTotalAmount(), order.getOrderNumber()),
        order.getId().toString(),
        true
    );
}
```

### 2. In `CustomerPaymentController.java`:
Add `@org.springframework.transaction.annotation.Transactional` to `verifyCustomerPayment`.

### 3. In Flyway Migration (e.g. `V51__add_unique_provider_payment_id.sql`):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment_id 
ON payments(provider_payment_id) 
WHERE provider_payment_id IS NOT NULL;
```
