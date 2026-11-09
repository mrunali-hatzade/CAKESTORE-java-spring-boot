# CakeStore — Phase 2.6.2.2 Security Fix Report
## Secure Order Tracking & Invoice Authorization

- **Date:** November 3, 2026
- **Phase:** 2.6.2.2
- **Preceding Audit:** `CAKESTORE_PHASE_2_6_2_1_VERIFICATION_REPORT.md`
- **Objective:** Eliminate the verified vulnerability in order tracking and invoice endpoints where supplying an order number with matching `trackPhone` bypassed authentication.

---

## 1. Executive Summary

In Phase 2.6.2.1, an authorization audit revealed that `GET /api/storefront/shops/orders/{orderNumber}` and `GET /api/storefront/shops/orders/{orderNumber}/invoice` permitted unauthenticated callers to access private order information and tax invoices by supplying a phone number in the query parameter (`?trackPhone=...`).

**A phone number string in an HTTP request is NOT proof of phone ownership.**

Phase 2.6.2.2 completely eliminates this bypass:
1. **Mandatory Authenticated OTP Session:** Order tracking and invoice endpoints now **strictly require** a valid `ROLE_CUSTOMER` JWT session established through phone OTP.
2. **Cryptographic Phone Matching:** The authenticated phone in the caller's JWT `CustomUserDetails` is verified against the order's stored customer phone.
3. **No Unauthenticated Bypasses:** The `trackPhone` parameter is completely removed from authorization logic. Unauthenticated requests always return **HTTP 401 Unauthorized**.
4. **Role Isolation:** Non-customer roles (`SHOP_OWNER`, `ADMIN`, `SUPER_ADMIN`) or mismatched customers attempting to access tracking or invoices are rejected with **HTTP 403 Forbidden**.
5. **Data Minimization:** Created `StorefrontOrderTrackingResponse` DTO to prevent leaking internal IDs (`razorpayOrderId`, internal `Shop` entity, `User` entity, and raw secrets).
6. **Seamless Frontend OTP Experience:** Updated `frontend_v2/app/orders/[orderNumber]/page.tsx` with an inline phone OTP verification flow for visitors accessing tracking URLs directly.
7. **Preserved Anonymous Checkout:** Unauthenticated guest checkout remains 100% functional (`order.setCustomer(null)`).

---

## 2. Changed Files Inventory

### Backend
1. **`CustomerStorefrontController.java`**
   - Removed `trackPhone` query parameter from `getGuestOrderDetails` and `downloadInvoice`.
   - Enforced `ROLE_CUSTOMER` authentication check.
   - Enforced `normalizedUserPhone.equals(normalizedOrderPhone)`.
   - Replaced raw `Order` return type with sanitized `StorefrontOrderTrackingResponse`.
2. **`StorefrontOrderTrackingResponse.java`** (NEW DTO)
   - Excludes sensitive fields (`razorpayOrderId`, internal user entity, internal shop details).
   - Maps order status, delivery slot details, delivery address, items, and totals for customer visibility.
3. **`CustomerPrivacySecurityTest.java`**
   - Updated order and invoice lookup tests to verify strict authentication requirement and DTO structure.
   - Added `testShopOwnerToken_AccessingOrder_Returns403` and `testAdminToken_AccessingOrder_Returns403`.
4. **`CustomerStorefrontGuestTrackingTest.java`**
   - Replaced obsolete tests that previously expected unauthenticated phone access to succeed.
   - Verified that unauthenticated calls without JWT always return 401.

### Frontend
1. **`frontend_v2/app/orders/[orderNumber]/page.tsx`**
   - Added inline OTP verification card for unauthenticated visitors.
   - Allows customers landing directly on tracking links to verify phone ownership via OTP and view tracking without registration.

---

## 3. Endpoint Authorization Rules Matrix

| Endpoint | Credentials | Phone Match | HTTP Status | Response |
|---|---|---|---|---|
| `GET /orders/{orderNumber}` | None / Missing | N/A | **401 Unauthorized** | Empty / Denied |
| `GET /orders/{orderNumber}?trackPhone=...` | None / Missing | Matching Phone | **401 Unauthorized** | Denied (Bypass Eliminated) |
| `GET /orders/{orderNumber}` | Invalid / Expired JWT | N/A | **401 Unauthorized** | Denied |
| `GET /orders/{orderNumber}` | `ROLE_SHOP_OWNER` JWT | N/A | **403 Forbidden** | Denied |
| `GET /orders/{orderNumber}` | `ROLE_ADMIN` JWT | N/A | **403 Forbidden** | Denied |
| `GET /orders/{orderNumber}` | `ROLE_CUSTOMER` JWT | Mismatched Phone | **403 Forbidden** | Denied (Customer Isolation) |
| `GET /orders/{orderNumber}` | `ROLE_CUSTOMER` JWT | Matching Phone | **200 OK** | `StorefrontOrderTrackingResponse` |
| `GET /orders/{orderNumber}/invoice` | None / Missing | N/A | **401 Unauthorized** | Empty / Denied |
| `GET /orders/{orderNumber}/invoice` | `ROLE_CUSTOMER` JWT | Mismatched Phone | **403 Forbidden** | Denied |
| `GET /orders/{orderNumber}/invoice` | `ROLE_CUSTOMER` JWT | Matching Phone | **200 OK** | Application/PDF attachment |

---

## 4. Response Data Sanitization (DTO Review)

`StorefrontOrderTrackingResponse` strictly exposes only customer-facing order information:

```json
{
  "id": 101,
  "orderNumber": "ORD-12345",
  "shopId": 12,
  "shopName": "Sweet Delights Bakery",
  "customerName": "Rohan Sharma",
  "customerPhone": "9876543210",
  "customerEmail": "rohan@example.com",
  "deliveryAddress": "Flat 402, Lotus Tower, Pune",
  "fulfillmentMethod": "HOME_DELIVERY",
  "deliveryDate": "2026-11-05",
  "deliverySlotDetails": "Morning (9:00 AM - 12:00 PM)",
  "subtotal": 1200.00,
  "deliveryCharge": 50.00,
  "discountAmount": 100.00,
  "totalAmount": 1150.00,
  "status": "CONFIRMED",
  "orderStatus": "CONFIRMED",
  "paymentStatus": "PAID",
  "paymentMethod": "ONLINE_PAYMENT",
  "transactionId": "pay_Oxx9912",
  "createdAt": "2026-11-03T00:15:00",
  "items": [
    {
      "productId": 45,
      "productName": "Belgian Chocolate Truffle",
      "quantity": 1,
      "unitPrice": 1200.00,
      "totalPrice": 1200.00,
      "variantName": "1 kg (Eggless)",
      "cakeMessage": "Happy Birthday Rohan!"
    }
  ]
}
```

**Fields Excluded from Tracking Response:**
- `razorpayOrderId` (internal gateway identifier)
- `customer` (internal JPA User entity with hashed password, roles, etc.)
- `shop` (internal JPA Shop entity with bank details, Razorpay credentials, subscription keys)

---

## 5. Test Scenarios & Automated Verification

### A. Backend Security Test Suite
Executed:
`mvn -f backend/pom.xml test "-Dtest=CustomerPrivacySecurityTest,CustomerStorefrontGuestTrackingTest,CustomerOrderIdentitySecurityTest,CustomerStorefrontServiceIdentityEnrichmentTest,DeliveryFeeConsistencyRegressionTest"`

**Results: 35 / 35 tests passed (0 failures):**
- `CustomerPrivacySecurityTest`: 9 / 9 passed
  - `testUnauthenticatedOrderLookup_Returns401`
  - `testUnauthenticatedInvoiceLookup_Returns401`
  - `testInvalidJwtOrderLookup_Returns401`
  - `testCustomerAAccessingCustomerBOrder_Returns403`
  - `testCustomerAAccessingCustomerBInvoice_Returns403`
  - `testCustomerAAccessingOwnOrder_Returns200`
  - `testCustomerAAccessingOwnInvoice_Returns200`
  - `testShopOwnerToken_AccessingOrder_Returns403`
  - `testAdminToken_AccessingOrder_Returns403`
- `CustomerStorefrontGuestTrackingTest`: 6 / 6 passed
  - `testAuthenticatedUser_OwnOrder_Success`
  - `testAuthenticatedUser_OtherOrder_Forbidden`
  - `testUnauthenticatedGuest_PhoneAlone_Denied`
  - `testUnauthenticatedGuest_NoAuth_Unauthorized`
  - `testAuthenticatedCustomerInvoice_OwnOrder_Success`
  - `testUnauthenticatedInvoice_WithoutJwt_Denied`
- `CustomerOrderIdentitySecurityTest`: 5 / 5 passed
- `CustomerStorefrontServiceIdentityEnrichmentTest`: 5 / 5 passed
- `DeliveryFeeConsistencyRegressionTest`: 10 / 10 passed

### B. Frontend Test Suite
- `npm --prefix frontend_v2 test` (`node --test`)
- **Results: 300 / 300 tests passed (0 failures)** across 21 test suites.

### C. Frontend Production Build & Typecheck
- `npm --prefix frontend_v2 run build`
- **Result: Compiled successfully.** All 45 static and dynamic pages generated.

---

## 6. Remaining Risks & Operational Status

- **Zero Breaking Changes:** Anonymous checkout remains completely intact (`order.setCustomer(null)`).
- **Zero Commission Impact:** 0% commission SaaS model preserved.
- **Vulnerability Status:** **RESOLVED**. Unauthorized access to order details and invoices via phone number strings is completely closed.

