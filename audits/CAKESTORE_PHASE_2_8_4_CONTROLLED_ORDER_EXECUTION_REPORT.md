# CakeStore — Phase 2.8.4: Controlled Self-Pickup Order Execution Report

**Execution Timestamp:** 2026-11-04T01:07:00+05:30  
**Environment:** Local Staging (`localhost:5432`, `localhost:8080`, `localhost:3000`)  
**Target Shop:** Shop ID 1 — `Akurdi Artisan Bakes`  
**Target Product:** Product ID 1 — `Belgian Dark Chocolate Truffle Cake` (Price: ₹650.00)  
**Database:** PostgreSQL `cake_platform` (Flyway Schema Version V57)  
**Created Order Reference:** `ORD-C6866484` (Order ID: `3296`)  

---

## Executive Summary

Phase 2.8.4 executed the single approved customer staging order for Shop 1 (`Akurdi Artisan Bakes`) using the newly verified conditional delivery-slot validation code from Phase 2.8.3.

**Key Results:**
1. **Application Health & Fresh Deployment**: The backend Spring Boot service and Next.js frontend dev server were cleanly restarted. All updated conditional delivery slot validation logic and frontend adaptations were active.
2. **Passwordless OTP Checkout Succeeded**: The customer mobile (`9876500001`) initiated passwordless checkout. The local test OTP was processed via the secure in-app dev fallback without external SMS dispatch, issuing an authenticated `ROLE_CUSTOMER` JWT token.
3. **Controlled Order Placed with ₹0 Delivery Fee**: Exactly **one** order (`ORD-C6866484`) was created for Shop 1. The order completed cleanly with `fulfillmentMethod = SELF_PICKUP`, `deliverySlotId = null`, and `deliveryCharge = 0.00`.
4. **Zero Payment Gateway Invocation**: Because `COD` (Pay on Delivery / Pay at Shop) was selected, Razorpay was completely bypassed (`razorpayOrderId = null`). Order initial state was set directly to `orderStatus = NEW` and `paymentStatus = PENDING`.
5. **Owner Dashboard Verified**: Shop 1 owner (`owner@example.com`) logged into the Owner Dashboard and observed `ORD-C6866484` in the order queue. No lifecycle transitions were performed; the order was not marked as paid.
6. **Customer Tracking & Cross-Customer Isolation Verified**: Customer `9876500001` successfully retrieved order details, tracking status, and invoice PDF (`200 OK`). Unauthenticated requests were blocked with `401 Unauthorized`. Owner and cross-customer access attempts were strictly rejected with `403 Forbidden`.

---

## 1. Environment Verification

| Component | Target Requirement | Live State Verified | Verdict |
|---|---|---|---|
| **Environment Type** | Local / Staging (Never Production) | `localhost:5432`, `localhost:8080`, `localhost:3000` | **PASS** |
| **Database** | PostgreSQL `cake_platform` | PostgreSQL 16 on `localhost:5432` | **PASS** |
| **Flyway Schema** | Version V57 | Verified latest migration V57 (`add dietary flags to products`) | **PASS** |
| **Backend Service** | Spring Boot 3.3.2 | Restarted and listening on `http://localhost:8080` | **PASS** |
| **Frontend Service** | Next.js 14.2.5 (`frontend_v2`) | Restarted and listening on `http://localhost:3000` | **PASS** |
| **Initial Shop 1 Slots** | Zero delivery slots | `SELECT COUNT(*) FROM shop_delivery_slots WHERE shop_id = 1;` $\rightarrow$ `0` | **PASS** |
| **Initial Shop 1 Orders** | Zero orders | `SELECT COUNT(*) FROM orders WHERE shop_id = 1;` $\rightarrow$ `0` | **PASS** |
| **Conditional Code** | Phase 2.8.3 validation active | Verified `@ValidDeliverySlot` active in running Spring container | **PASS** |

---

## 2. Checkout Execution & Evidence

### 2.1 Customer Identity & OTP Flow
- **Customer Name:** `Staging Test Customer`
- **Customer Phone:** `9876500001`
- **Customer Email:** `staging.test.customer@example.com`
- **OTP Request Endpoint:** `POST /api/customer/storefront/tracking/request-otp`
- **OTP Verification Endpoint:** `POST /api/customer/storefront/tracking/verify-otp`
- **In-App Dev Mode Delivery:** Dispatched mock SMS logged internally (`log-payloads: true`), zero external network calls.
- **JWT Issued:** Valid `ROLE_CUSTOMER` bearer token linked to mobile `9876500001` (User ID `13739`).

### 2.2 Live Order Creation HTTP Request & Response
```http
POST /api/storefront/shops/1/orders HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9... [ROLE_CUSTOMER Token]

{
  "customerName": "Staging Test Customer",
  "customerEmail": "staging.test.customer@example.com",
  "customerPhone": "9876500001",
  "paymentMethod": "COD",
  "fulfillmentMethod": "SELF_PICKUP",
  "deliveryAddress": "Flat 101, Test Residency, Akurdi",
  "deliveryPincode": "411035",
  "deliveryDate": "2026-11-05",
  "deliverySlotId": null,
  "specialInstructions": "Phase 2.8.4 Controlled Staging UAT Verification — Self-Pickup COD",
  "expectedDeliveryFee": 0,
  "expectedTotal": 650,
  "confirmPriceChange": false,
  "items": [
    {
      "productId": 1,
      "quantity": 1,
      "dietaryPreference": "EGGLESS",
      "cakeMessage": "UAT Test"
    }
  ]
}
```

**HTTP Response (Status: `200 OK`):**
```json
{
  "id": 3296,
  "orderNumber": "ORD-C6866484",
  "subtotal": 650,
  "deliveryCharge": 0,
  "totalAmount": 650,
  "paymentStatus": "PENDING",
  "orderStatus": "NEW",
  "fulfillmentMethod": "SELF_PICKUP",
  "razorpayOrderId": null,
  "deliveryAddress": "Flat 101, Test Residency, Akurdi",
  "specialInstructions": "Phase 2.8.4 Controlled Staging UAT Verification — Self-Pickup COD",
  "customerName": "Staging Test Customer",
  "customerEmail": "staging.test.customer@example.com",
  "customerPhone": "9876500001",
  "paymentMethod": "COD",
  "transactionId": null,
  "paidAt": null,
  "items": [
    {
      "id": 929,
      "productNameSnapshot": "Belgian Dark Chocolate Truffle Cake",
      "unitPrice": 650,
      "quantity": 1,
      "totalPrice": 650,
      "variantName": null,
      "dietaryPreference": "EGGLESS",
      "cakeMessage": "UAT Test",
      "photoReferenceUrl": null,
      "addonsSummary": "",
      "productImageUrl": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
      "originalPrice": 750
    }
  ],
  "createdAt": "2026-11-04T01:02:59.607796",
  "updatedAt": "2026-11-04T01:02:59.607796",
  "deliveryDate": "2026-11-05",
  "discountAmount": 0,
  "couponCode": null,
  "deliverySlotDetails": null,
  "shopId": 1,
  "shopName": "Akurdi Artisan Bakes"
}
```

---

## 3. Order Reference & Specifications

| Field | Captured Value | Validation Notes |
|---|---|---|
| **Order Number** | `ORD-C6866484` | Authoritative unique reference |
| **Order Database ID** | `3296` | Primary key in `orders` table |
| **Bakery** | Akurdi Artisan Bakes (`shop_id = 1`) | Matched Shop 1 |
| **Item** | Belgian Dark Chocolate Truffle Cake (`product_id = 1`) | 1 Unit @ ₹650.00 |
| **Dietary Preference** | `EGGLESS` | Preserved eggless choice |
| **Custom Cake Message** | `UAT Test` | Persisted snapshot |
| **Subtotal** | `₹650.00` | Authoritative catalog price |
| **Delivery Charge** | `₹0.00` | Strictly ₹0 for self-pickup |
| **Total Amount** | `₹650.00` | Exactly subtotal |
| **Fulfillment Method** | `SELF_PICKUP` | Successfully processed with `deliverySlotId = null` |
| **Payment Method** | `COD` | Cash on Delivery / Pay at Shop |
| **Order Status** | `NEW` | Correct initial state for non-gateway orders |
| **Payment Status** | `PENDING` | Unpaid awaiting store pickup collection |
| **Pickup Date** | `2026-11-05` | Valid next-day pickup |
| **Delivery Slot ID** | `NULL` | Zero delivery slots required or reserved |

---

## 4. Database Verification (Read-Only)

Executed direct SQL queries on PostgreSQL:
```sql
SELECT id, shop_id, customer_id, order_number, subtotal, delivery_charge, total_amount, 
       payment_status, order_status, fulfillment_method, payment_method, customer_name, customer_phone, delivery_slot_id, delivery_date
FROM orders 
WHERE order_number = 'ORD-C6866484';
```
**`orders` Table Record:**
| id | shop_id | customer_id | order_number | subtotal | delivery_charge | total_amount | payment_status | order_status | fulfillment_method | payment_method | customer_name | customer_phone | delivery_slot_id | delivery_date |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `3296` | `1` | `13739` | `ORD-C6866484` | `650.00` | `0.00` | `650.00` | `PENDING` | `NEW` | `SELF_PICKUP` | `COD` | Staging Test Customer | `9876500001` | *NULL* | `2026-11-05` |

```sql
SELECT id, order_id, product_id, product_name_snapshot, unit_price, quantity, total_price, dietary_preference, cake_message
FROM order_items
WHERE order_id = 3296;
```
**`order_items` Table Record:**
| id | order_id | product_id | product_name_snapshot | unit_price | quantity | total_price | dietary_preference | cake_message |
|---|---|---|---|---|---|---|---|---|
| `929` | `3296` | `1` | Belgian Dark Chocolate Truffle Cake | `650.00` | `1` | `650.00` | `EGGLESS` | UAT Test |

**Order Count Isolation:**
```sql
SELECT COUNT(*) FROM orders WHERE shop_id = 1;
-- Result: 1
```
Exactly **one** order exists for Shop 1 in the database.

---

## 5. Owner Dashboard Verification

Authenticated as the primary staging owner for Shop 1 (`owner@example.com` / User ID `12781`) via `POST /api/auth/login`.

Queried `GET /api/owner/orders`:
```json
{
  "totalElements": 1,
  "totalPages": 1,
  "content": [
    {
      "id": 3296,
      "orderNumber": "ORD-C6866484",
      "customerName": "Staging Test Customer",
      "customerPhone": "9876500001",
      "subtotal": 650,
      "deliveryCharge": 0,
      "totalAmount": 650,
      "fulfillmentMethod": "SELF_PICKUP",
      "paymentMethod": "COD",
      "paymentStatus": "PENDING",
      "orderStatus": "NEW",
      "deliveryDate": "2026-11-05",
      "specialInstructions": "Phase 2.8.4 Controlled Staging UAT Verification — Self-Pickup COD"
    }
  ]
}
```
**Owner Verification Verdict:**
- The new order appeared immediately in the bakery owner's active orders queue.
- Order details, items snapshot, subtotal, and total match the customer's cart.
- Fulfillment is clearly presented as `SELF_PICKUP`.
- Payment method is displayed as `COD`.
- **Restriction Preserved:** The order status was **not** transitioned or marked as paid.

---

## 6. Customer Order Tracking & Authorization Verification

Tested customer order tracking endpoints across four security scenarios:

| Scenario | Request | Authorization Header | Result Status | Behavior Verified |
|---|---|---|---|---|
| **1. Unauthenticated Tracking** | `GET /api/customer/storefront/orders/ORD-C6866484` | None | **`401 UNAUTHORIZED`** | Anonymous visitors cannot access order tracking. |
| **2. Shop Owner Token** | `GET /api/customer/storefront/orders/ORD-C6866484` | Bearer Token (`ROLE_SHOP_OWNER`) | **`403 FORBIDDEN`** | Bakery owners cannot view customer storefront tracking directly. |
| **3. Mismatched Customer Token** | `GET /api/customer/storefront/orders/ORD-C6866484` | Bearer Token for `9876599999` | **`403 FORBIDDEN`** | Customer B cannot access Customer A's order tracking. |
| **4. Matching Customer Token** | `GET /api/customer/storefront/orders/ORD-C6866484` | Bearer Token for `9876500001` | **`200 OK`** | Customer A successfully retrieves order details, item snapshots, and tracking history. |
| **5. My Orders Directory** | `GET /api/customer/storefront/tracking/orders` | Bearer Token for `9876500001` | **`200 OK`** | Returns `totalElements: 1`, listing `ORD-C6866484`. |
| **6. Invoice Download (Mismatched)** | `GET /api/storefront/shops/orders/ORD-C6866484/invoice` | Bearer Token for `9876599999` | **`403 FORBIDDEN`** | Cross-customer invoice download is strictly denied. |
| **7. Invoice Download (Matching)** | `GET /api/storefront/shops/orders/ORD-C6866484/invoice` | Bearer Token for `9876500001` | **`200 OK`** | Streams `application/pdf` invoice with correct billing details. |

---

## 7. Database State Changes Audit

| Table Name | Operation | Records Affected | Details |
|---|---|---|---|
| `orders` | `INSERT` | **1 row** (`id = 3296`) | Order `ORD-C6866484`, `shop_id = 1`, `customer_id = 13739`, `total = 650.00`, `status = NEW`, `payment_status = PENDING`. |
| `order_items` | `INSERT` | **1 row** (`id = 929`) | `Belgian Dark Chocolate Truffle Cake`, `qty = 1`, `unit_price = 650.00`, `total_price = 650.00`. |
| `users` | `SELECT / HYDRATE` | **1 row** (`id = 13739`) | Customer account for `9876500001` linked as order customer. |
| `otp_verifications` | `UPDATE` | **1 row** | Invalidate OTP record upon successful authentication. |
| `shop_delivery_slots` | *NONE* | **0 rows** | Zero delivery slots modified or created. |
| `shops` | *NONE* | **0 rows** | Zero bakery settings modified. |

---

## 8. Summary of Strict Restrictions Adherence

- [x] **Exactly one staging order created**: Total Shop 1 orders = 1.
- [x] **Zero production access**: All calls targeted local/staging host.
- [x] **Zero Razorpay transactions**: No payment gateway order generated; `razorpayOrderId` remains null.
- [x] **Zero real money spent**: Cash on Delivery / Pay at Shop used.
- [x] **Zero external SMS or emails sent**: In-app test OTP fallback used.
- [x] **Zero delivery slots created**: Database table `shop_delivery_slots` remains at 0 rows.
- [x] **Zero bakery settings changed**: Shop delivery configuration and parameters untouched.
- [x] **No order deletion**: Order `ORD-C6866484` remains persisted in the database for ongoing UAT audit.
- [x] **Order not prematurely marked as paid**: `paymentStatus` remains `PENDING`.
- [x] **Zero source code modified during Phase 2.8.4**: Runtime execution phase only.

---

## 9. Final Phase 2.8.4 Verdict

| Verification Item | Requirement | Actual Status | Verdict |
|---|---|---|---|
| **Environment Check** | Local staging, PostgreSQL, Flyway V57 | Verified running on port 8080 & 3000 | **PASS** |
| **Passwordless OTP Checkout** | 6-digit test OTP login for customer | `200 OK` (`ROLE_CUSTOMER` JWT issued) | **PASS** |
| **Self-Pickup Order Creation** | Create order without delivery slot | `200 OK` (`ORD-C6866484` created) | **PASS** |
| **Delivery Fee Calculation** | Zero delivery fee for self-pickup | `deliveryCharge: 0.00`, `totalAmount: 650.00` | **PASS** |
| **Payment Method Handling** | COD creates order in `NEW` / `PENDING` | Verified; zero gateway transactions | **PASS** |
| **Owner Dashboard Visibility** | Order appears in Shop 1 owner list | Verified via `GET /api/owner/orders` | **PASS** |
| **Customer Tracking & Isolation** | Verified access for matching phone; 401/403 for unauthorized | All 7 tracking & invoice scenarios verified | **PASS** |
| **Order Count Isolation** | Exactly 1 order created for Shop 1 | DB query confirms count = 1 | **PASS** |

**Final Status:** **PASS — Phase 2.8.4 Completed Successfully.**
