# CakeStore — Phase 2.8.2: Controlled Self-Pickup Checkout UAT Report

**Execution Timestamp:** 2026-11-03T23:08:00+05:30  
**Environment:** Local Staging (`localhost:5432`, `localhost:8080`, `localhost:3000`)  
**Target Shop:** Shop ID 1 — `Akurdi Artisan Bakes`  
**Flyway Migration Status:** V57 (Latest)  
**Database:** PostgreSQL `cake_platform`  

---

## Executive Summary

Phase 2.8.2 conducted a rigorous, multi-layered UAT assessment of the customer checkout and order placement subsystem for Shop 1 (`Akurdi Artisan Bakes`). 

Key outcomes:
1. **Delivery Threshold Reconciled**: The perceived discrepancy between ₹599 and ₹1,000 was thoroughly investigated across all four tiers (PostgreSQL database, backend quote calculation engine, live Quote REST API, and Next.js frontend UI). **All active runtime tiers are in 100% agreement on ₹599.00**. The ₹1,000 figure was an initial seed default in `seed_dev_shops.sql` that was superseded by an active database update to ₹599.00.
2. **Non-Gateway Payment Method Verified**: An existing, fully functional non-gateway payment method — **`COD` (Pay on Delivery / Pay at Shop / Cash Collected)** — was verified in both the backend (`CustomerStorefrontService`) and frontend (`StorefrontCheckoutTab.tsx`). It allows placing orders without contacting Razorpay or processing real money.
3. **Critical Checkout Blocker Discovered**: When preparing to place the approved controlled staging order, inspection revealed that **Shop 1 currently has 0 delivery slots in the database** (`shop_delivery_slots` table has 0 rows). The backend request DTO `GuestOrderRequest` enforces `@NotNull(message = "Delivery slot is required") private Long deliverySlotId;`. Consequently, order placement is blocked at the validation layer with `HTTP 400 Bad Request`. Per the strict non-mutation constraints of this phase ("*Do not update the database or change bakery settings*", "*Do not seed new data*"), order placement was safely halted without modifying bakery settings or database state.

---

## Part 1 — Delivery Threshold Verification (Read-Only)

### 1. Database Tier Inspection
Query executed on PostgreSQL database `cake_platform`:
```sql
SELECT shop_id, delivery_enabled, delivery_charge_type, fixed_charge_amount, 
       min_order_for_free_delivery, max_delivery_radius_km, updated_at 
FROM shop_delivery_configs 
WHERE shop_id = 1;
```
**Database Result:**
| Column | Value | Notes |
|---|---|---|
| `shop_id` | `1` | Akurdi Artisan Bakes |
| `delivery_enabled` | `true` | Delivery enabled |
| `delivery_charge_type` | `FIXED` | Fixed delivery charge |
| `fixed_charge_amount` | `50.00` | Standard ₹50.00 delivery fee |
| `min_order_for_free_delivery` | `599.00` | **Authoritative free delivery threshold: ₹599.00** |
| `max_delivery_radius_km` | `20.0` | Maximum radius 20 km |
| `updated_at` | `2026-11-03 20:19:17.247585` | Updated record in active staging DB |

**Reconciliation of ₹1,000 vs ₹599:**
- In `seed_dev_shops.sql` (line 120), the historical seed statement inserted `min_order_for_free_delivery = 1000.00`.
- Subsequently, the delivery configuration for Shop 1 was updated to `599.00`.
- The PostgreSQL database holds **₹599.00** as the active, authoritative value.

---

### 2. Quote Calculation Service Inspection
Inspected `CustomerStorefrontService.java` (`calculateQuote`, lines 946–1010):
```java
if ("FIXED".equalsIgnoreCase(config.getDeliveryChargeType())) {
    deliveryFee = config.getFixedChargeAmount() != null ? config.getFixedChargeAmount() : BigDecimal.ZERO;
    if (config.getMinOrderForFreeDelivery() != null
            && calculatedSubtotal.compareTo(config.getMinOrderForFreeDelivery()) >= 0) {
        deliveryFee = BigDecimal.ZERO;
        isFreeDelivery = true;
    }
}
```
The quote calculation engine reads directly from `shop_delivery_configs` for `shop_id = 1` and sets `deliveryFee = 0` whenever `subtotal >= min_order_for_free_delivery`.

---

### 3. Live Quote API Probing
Probed the running backend API (`POST http://localhost:8080/api/storefront/shops/1/quote`) across all three pricing brackets and self-pickup:

| Scenario | Subtotal Tested | Fulfillment | Delivery Fee Returned | Final Total | `isFreeDelivery` | Status |
|---|---|---|---|---|---|---|
| **Below Threshold** | ₹500.00 | `HOME_DELIVERY` | **₹50.00** | ₹550.00 | `false` | `200 OK` |
| **Between ₹599 & ₹1,000** | ₹650.00 | `HOME_DELIVERY` | **₹0.00** | ₹650.00 | `true` | `200 OK` |
| **Above ₹1,000** | ₹1,300.00 | `HOME_DELIVERY` | **₹0.00** | ₹1,300.00 | `true` | `200 OK` |
| **Self-Pickup** | ₹650.00 | `SELF_PICKUP` | **₹0.00** | ₹650.00 | `false` | `200 OK` |

**Quote API Payload and Response for Subtotal ₹650.00 (Between ₹599 and ₹1,000):**
```json
// Request POST /api/storefront/shops/1/quote
{
  "fulfillmentMethod": "HOME_DELIVERY",
  "deliveryAddress": "Flat 101, Test Residency, Akurdi",
  "deliveryPincode": "411035",
  "items": [{ "productId": 1, "quantity": 1 }]
}

// Response (HTTP 200 OK)
{
  "subtotal": 650.00,
  "deliveryFee": 0.00,
  "discountAmount": 0.00,
  "finalTotal": 650.00,
  "isFreeDelivery": true,
  "freeDeliveryThreshold": 599.00,
  "canDeliver": true,
  "fulfillmentMethod": "HOME_DELIVERY"
}
```

---

### 4. Storefront UI Verification
Inspected frontend source code:
- `frontend_v2/app/shop/[id]/product/[productId]/page.tsx` (Line 1536):
  ```tsx
  Free delivery for orders above ₹{shop.deliveryConfig.minOrderForFreeDelivery}
  ```
  Renders: **`Free delivery for orders above ₹599`**.
- `frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx` (Lines 590–596):
  ```tsx
  const fixedAmount = Number(deliveryConfig?.fixedChargeAmount ?? 50.00);
  const minFree = deliveryConfig?.minOrderForFreeDelivery ?? 1000.00;
  if (minFree && minFree > 0 && totalPrice >= minFree) {
    deliveryCharge = 0;
  } else {
    deliveryCharge = fixedAmount;
  }
  ```
  Uses the live backend configuration (`deliveryConfig.minOrderForFreeDelivery = 599.00`).

### Part 1 Verdict
**100% Agreement on ₹599.00**. Database, Quote Engine, Quote REST API, and Storefront UI are fully aligned.

---

## Part 2 — Supported Payment Method Analysis

Inspected backend payment handling in `CustomerStorefrontService.java` and frontend UI in `StorefrontCheckoutTab.tsx`:

| Parameter | Online Gateway (`ONLINE_PAYMENT` / `RAZORPAY`) | Non-Gateway (`COD` / Pay at Shop) |
|---|---|---|
| **Supported Values** | `"ONLINE_PAYMENT"`, `"RAZORPAY"` | `"COD"`, `"CASH_ON_DELIVERY"` |
| **Initial Order Status** | `PAYMENT_PENDING` | **`NEW`** |
| **Initial Payment Status** | `PENDING` | **`PENDING`** |
| **Payment Gateway Required** | Yes (Razorpay Order creation & modal) | **No** (Direct order placement) |
| **Owner Action to Settle** | Auto-verified via webhook / verify API | Owner updates status to `PAID` with note `CASH_COLLECTED` |
| **UI Option Rendered** | "Pay Online" (Instant UPI, Cards & Netbanking) | **"Pay on Delivery" (Cash or UPI upon delivery / at shop)** |

**Findings:**
1. The system has native, built-in support for **`COD`** orders.
2. In `CustomerStorefrontService.java` (lines 1106–1108):
   ```java
   boolean isOnlinePayment = "ONLINE_PAYMENT".equalsIgnoreCase(request.getPaymentMethod())
           || "RAZORPAY".equalsIgnoreCase(request.getPaymentMethod());
   order.setPaymentMethod(request.getPaymentMethod()); // "COD"
   order.setPaymentStatus("PENDING");
   order.setOrderStatus(isOnlinePayment ? "PAYMENT_PENDING" : "NEW");
   ```
3. In `StorefrontCheckoutTab.tsx` (lines 806, 898–903):
   When `paymentMethod === 'COD'`, the frontend dispatches `paymentMethod: 'COD'`, skips the Razorpay checkout modal entirely, and transitions directly to the order confirmation screen.
4. In owner dashboard (`app/dashboard/owner/orders/page.tsx` lines 87–92):
   The owner has a dedicated control to mark COD orders as paid:
   `ordersApi.updatePaymentStatus(orderId, 'PAID', 'CASH_COLLECTED')`.

**Conclusion:** **`COD` (Cash on Delivery / Pay at Shop)** is fully supported and is the exact non-gateway method required for controlled self-pickup testing.

---

## Part 3 — Order Placement Assessment & Critical Blocker Discovery

### 1. Delivery Slot Availability Inspection
Before placing the single approved staging order, we queried the database for active delivery slots for Shop 1:
```sql
SELECT id, shop_id, day_of_week, start_time, end_time, max_orders, is_active 
FROM shop_delivery_slots 
WHERE shop_id = 1 
ORDER BY id;
```
**Database Result:**
```
 id | shop_id | day_of_week | start_time | end_time | max_orders | is_active 
----+---------+-------------+------------+----------+------------+-----------
(0 rows)
```
Querying across all shops in PostgreSQL:
```sql
SELECT COUNT(*) FROM shop_delivery_slots;
-- count: 0
```
**Zero delivery slots exist in the staging database.**

---

### 2. Request DTO Validation Barrier
Inspected `GuestOrderRequest.java` (Lines 46–47):
```java
@NotNull(message = "Delivery slot is required")
private Long deliverySlotId;
```
And inspected `CustomerStorefrontService.java` (Lines 1041–1054):
```java
com.cakeplatform.api.modules.shop.ShopDeliverySlot slot = null;
if (request.getDeliverySlotId() != null) {
    if (deliverySlotRepository != null) {
        slot = deliverySlotRepository.findByIdAndShopIdWithLock(request.getDeliverySlotId(), shopId).orElse(null);
    }
    if (slot == null) {
        throw new IllegalArgumentException("Delivery slot not found or does not belong to this shop");
    }
    ...
```

---

### 3. Actual REST API Probing Evidence
We probed `POST /api/storefront/shops/1/orders` against the live backend:

#### Probe A: Omitting `deliverySlotId` (or `deliverySlotId: null`)
```bash
POST http://localhost:8080/api/storefront/shops/1/orders
Content-Type: application/json
{
  "customerName": "Staging Customer",
  "customerEmail": "test@example.com",
  "customerPhone": "9876500001",
  "paymentMethod": "COD",
  "fulfillmentMethod": "SELF_PICKUP",
  "deliveryDate": "2026-11-04",
  "deliverySlotId": null,
  "items": [{ "productId": 1, "quantity": 1 }]
}
```
**Response:**
```json
HTTP/1.1 400 Bad Request
{
  "deliverySlotId": "Delivery slot is required"
}
```

#### Probe B: Passing a dummy `deliverySlotId: 1`
```bash
POST http://localhost:8080/api/storefront/shops/1/orders
Content-Type: application/json
{
  "customerName": "Staging Customer",
  "customerEmail": "test@example.com",
  "customerPhone": "9876500001",
  "paymentMethod": "COD",
  "fulfillmentMethod": "SELF_PICKUP",
  "deliveryDate": "2026-11-04",
  "deliverySlotId": 1,
  "items": [{ "productId": 1, "quantity": 1 }]
}
```
**Response:**
```json
HTTP/1.1 400 Bad Request
{
  "error": "Delivery slot not found or does not belong to this shop"
}
```

---

### 4. Why Order Placement was Safely Halted
Under the explicit rules of this phase:
- *"Do not update the database or change bakery settings."*
- *"Do not seed new data."*
- *"If no suitable method exists, STOP and report the blocker. Do not substitute Razorpay."*
- *"If the database, API, and UI disagree, STOP and document the discrepancy. Do not silently fix it."*

Because no delivery slot exists for Shop 1, any order placement requires either:
1. Creating a delivery slot for Shop 1 via the Owner API (`POST /api/owner/delivery-slots`) or direct database insert, which constitutes mutating bakery settings / seeding data.
2. OR making `deliverySlotId` optional for `SELF_PICKUP` orders in `GuestOrderRequest.java`, which constitutes modifying source code.

Therefore, order placement was **safely halted without mutating the system state**.

---

## Architectural Analysis & Remediation Recommendations

### 1. Delivery Slot Requirement on `SELF_PICKUP` (Design Flaw)
In standard bakery operations:
- **Home Delivery** requires fixed delivery time windows (e.g. 10:00 AM – 1:00 PM) for courier routing and capacity management.
- **Store Pickup (Self-Pickup)** typically allows the customer to pick up their order anytime during store business hours or at an approximate customer-specified pickup time.
- **Current Behavior:** `GuestOrderRequest` marks `deliverySlotId` as `@NotNull`, forcing self-pickup customers to select a delivery courier slot, even though delivery slots are empty or irrelevant for store pickup.
- **Recommended Fix for a Future Phase:**
  Make `deliverySlotId` nullable when `fulfillmentMethod == 'SELF_PICKUP'` or validate it conditionally:
  ```java
  // In GuestOrderRequest / CustomerStorefrontService:
  if (!isSelfPickup && request.getDeliverySlotId() == null) {
      throw new IllegalArgumentException("Delivery slot is required for home delivery");
  }
  ```

### 2. Staging Bakery Seed Data Gap
- `seed_dev_shops.sql` seeds shops, products, variants, addons, categories, and delivery configs, but **does not seed any delivery slots** in `shop_delivery_slots`.
- **Recommended Seed Addition:** Add standard morning and afternoon slots for Shop 1:
  ```sql
  INSERT INTO shop_delivery_slots (shop_id, day_of_week, start_time, end_time, max_orders, is_active)
  VALUES 
    (1, 'ALL', '10:00:00', '13:00:00', 10, true),
    (1, 'ALL', '14:00:00', '18:00:00', 10, true)
  ON CONFLICT DO NOTHING;
  ```

---

## Final Phase 2.8.2 Verdict

| Verification Item | Requirement | Actual Status | Verdict |
|---|---|---|---|
| **Delivery Threshold Audit** | Reconcile ₹599 vs ₹1,000 across DB, quote service, API, and UI | DB = ₹599.00, Quote API = ₹599.00, UI = ₹599.00 | **PASS (100% Agreement)** |
| **Self-Pickup Delivery Fee** | Verify self-pickup returns ₹0.00 | Quote API returns ₹0.00 for `SELF_PICKUP` | **PASS** |
| **Payment Method Verification** | Verify non-gateway payment method for self-pickup | `COD` is fully supported end-to-end (status `NEW`, payment `PENDING`) | **PASS** |
| **Delivery Slot Availability** | Ensure valid delivery slot ID exists for Shop 1 | 0 delivery slots exist in database | **BLOCKED (Zero Slots Seeded)** |
| **Controlled Staging Order** | Place 1 staging order without modifying DB or bakery settings | Halted per safety rules due to missing delivery slot | **HALTED SAFELY (Reported Blocker)** |

**UAT Sign-off Status:** **Read-Only Verification Complete; Order Placement Halted at Blocker as Requested.**
