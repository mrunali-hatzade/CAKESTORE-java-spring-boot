# CakeStore Phase 5.5 — Cross-Shop Orders & Payments Ledger
## Read-Only Repository Audit and Implementation Plan

**Document Path:** `CAKESTORE_PHASE5_5_ORDERS_PAYMENTS_LEDGER_PLAN.md`  
**Status:** Planning & Audit Only — Awaiting Explicit Approval  
**Operating Mode:** Read-Only Audit (Zero code, migration, or test changes applied)  
**Target:** Centralized Admin Orders Ledger (`/admin/orders`) and Admin Payments Ledger (`/admin/payments`)

---

## 1. Executive Summary and Current Readiness Assessment

### 1.1 Executive Summary
CakeStore platform administrators currently monitor aggregate platform financial metrics (Platform SaaS Subscription Revenue and Network GMV) via the Admin Overview Dashboard (`/admin`) and manage bakery profiles via the Bakery Directory (`/admin/shops` and `/admin/shops/[id]`). 

However, administrators currently have **no centralized cross-shop visibility into individual retail customer orders or payment gateway transactions**. When a customer dispute, refund inquiry, payment failure, or operational anomaly occurs, administrators must either inspect shops individually or run direct database queries.

This plan details the design for:
1. **Admin Orders Ledger (`/admin/orders`):** Cross-shop visibility into retail customer cake orders across all bakeries, equipped with multi-field search (order number, customer, bakery), multi-dimensional status filtering, bounded pagination, privacy-safe customer presentation (PII masking in list views), and a read-only order inspection modal.
2. **Admin Payments Ledger (`/admin/payments`):** Cross-shop visibility into all gateway transactions, strictly distinguishing **CakeStore SaaS Subscription Payments** (Platform Revenue) from **Retail Customer Order Payments** (Bakery Sales / GMV, 0% platform commission), tracking gateway provider identifiers (`razorpay_order_id`, `razorpay_payment_id`), transaction statuses, and failure diagnostics.

### 1.2 Current Readiness Assessment
- **Readiness Rating: HIGH FEASIBILITY WITH MAXIMUM REUSE**
- **Domain Entities:** Both `Order` and `Payment` entities already exist in the database with rich metadata, status tracking, timestamps, and relational links to `Shop` and `Subscription`/`Plan`.
- **Existing Endpoints:** There are currently **zero** cross-shop order or payment endpoints exposed under `/api/admin`. Existing order endpoints are strictly tenant-isolated to `ROLE_SHOP_OWNER` (`/api/owner/orders`), and existing payment endpoints are isolated to `ROLE_SHOP_OWNER` (`/api/owner/payments`) or public storefront checkouts (`/api/storefront/orders`).
- **Financial Architecture:** The core financial segregation model is already codified in the database repository queries and verified by [`RevenueSegregationE2ETest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/payment/RevenueSegregationE2ETest.java). Platform revenue strictly equals completed subscription payments; retail cake sales represent 0% commission network GMV.
- **Architectural Reality (COD vs. Gateway Transactions):** Online customer payments create rows in the `payments` table with `subscription = null` and `plan = null`. In contrast, Cash-on-Delivery (COD) orders only exist in the `orders` table (with `paymentMethod = 'COD'` and `paymentStatus = 'PENDING'` / `'PAID'`). The implementation reflects this reality: COD orders appear in the Orders Ledger but are **never fabricated** as non-existent gateway records in the Payments Ledger.

---

## 2. Exact Repository Artifacts Inspected

The following repository components were inspected during this read-only audit:

### Backend Entities, Repositories & Controllers
- [`Order.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/Order.java): Stores order number, shop association, total amount, subtotal, delivery fee, discount, coupon code, customer PII (name, phone, email, address), payment method, payment status, order status, transaction ID, and line items.
- [`OrderItem.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/OrderItem.java): Stores line item snapshots, product ID, variant name, unit price, quantity, dietary preferences, and add-ons.
- [`Payment.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/Payment.java): Stores transaction ID, shop ID, subscription ID (nullable), plan ID (nullable), amount, currency, provider (`RAZORPAY`), provider order ID, provider payment ID, status (`PENDING`, `COMPLETED`, `FAILED`), failure reason, paid at, and timestamps.
- [`OrderRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java): Contains shop-scoped queries (`findFilteredOrdersByShopId`), aggregate revenue sums (`sumTotalRealizedRevenue`, `sumRealizedRevenueBetween`), but **no cross-shop filtered query**.
- [`PaymentRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/PaymentRepository.java): Contains subscription revenue aggregations (`getTotalRevenue`, `getMonthlyRevenue`), provider lookups, and shop subscription payments (`findSubscriptionPaymentsByShopId`), but **no cross-shop filtered query**.
- [`AdminDashboardController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminDashboardController.java): Current super-admin controller protected by `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`. Hosts stats, analytics, shops directory, and status mutations.
- [`AdminDashboardService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java): Coordinates platform stats, date filtering, shop directory pagination, and shop detail assembly.
- [`OwnerOrderController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java): Reference implementation for paginated order retrieval, status updates, and invoice generation for bakery owners.
- [`OwnerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java): Reference implementation for shop owner payment history and tax invoice downloads.
- [`CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java): Handles Razorpay order creation, payment signature verification, and checkout cancellation.
- [`WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java): Handles `payment.captured` and `payment.failed` webhooks from Razorpay.
- [`ActivityLogRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/audit/ActivityLogRepository.java): Stores platform activity logs. Does not have entity-specific lookup queries.

### Flyway Database Migrations & Actual Indexes
- `V1__init_schema.sql`: Initial creation of `orders`, `order_items`, `subscriptions`, and `payments` tables with foreign keys and initial indexes (`idx_orders_shop_id`, `idx_payments_shop_id`).
- `V3__add_subscriptions_and_payouts.sql`: Creation of `subscription_plans` and subscription plan linkages.
- `V5__orders_and_customers.sql`: Added customer details (`customer_name`, `customer_email`, `payment_method`, `transaction_id`, `paid_at`) to `orders`.
- `V22__add_plan_id_to_payments.sql`: Added `plan_id` to `payments` table.
- `V24__add_missing_performance_indexes.sql`: Added `idx_order_items_order_id`, `idx_payments_provider_order_id`, and `idx_payments_provider_payment_id`.
- `V26__owner_order_pagination_index.sql`: Added `idx_orders_shop_created` on `orders(shop_id, created_at DESC)`.

### Frontend Components & Types
- [`frontend_v2/app/admin/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx): Admin shell with sidebar navigation groups (`Platform`, `Communication`, `System`), mobile drawer, and top header.
- [`frontend_v2/components/admin/AdminCommandPalette.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminCommandPalette.tsx): Admin Ctrl+K command palette with static shortcuts and debounced live multi-entity search.
- [`frontend_v2/app/admin/shops/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx): Reference admin table implementation with status tabs, search input, badges, loading skeleton, empty states, and pagination controls.
- [`frontend_v2/components/owner/OrderDetailsModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/OrderDetailsModal.tsx): Reusable modal displaying full order details, delivery slot formatting, items list, pricing summary, and customer contacts.
- [`frontend_v2/types/admin.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/admin.ts): Current admin TypeScript types.
- [`frontend_v2/types/order.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/order.ts): Order, OrderItem, and PaginatedResponse interfaces.
- [`frontend_v2/lib/api/admin.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/admin.ts): Admin API client methods.

---

## 3. Candidate-by-Candidate Implementation Classification

Each functional requirement candidate is classified into one of four verified categories:

| Candidate Requirement | Classification | Repository Evidence & Analysis |
| :--- | :---: | :--- |
| **A1. Cross-shop order visibility** | **Partially implemented and reusable** | The `Order` entity contains all required data. `OrderRepository.findAll(Pageable)` is inherited from JpaRepository, but no cross-shop filtered query or admin API endpoint exists. |
| **A2. Order search (order #, customer, bakery)** | **Missing and requires new work** | `OrderRepository.findFilteredOrdersByShopId` only searches within a single `shopId`. A cross-shop JPQL query searching across `orderNumber`, `customerName`, `customerPhone`, and joined `shop.businessName` must be created. |
| **A3. Order status, payment status, bakery & date filters** | **Missing and requires new work** | Enum values exist in code (`NEW`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`, `COMPLETED`, `CANCELLED`; `PENDING`, `PAID`, `FAILED`, `REFUNDED`), but a unified cross-shop filter method for admin does not exist. |
| **A4. Order pagination and sorting** | **Partially implemented and reusable** | Standard Spring Data `Pageable` and `PageRequest.of(page, size)` patterns are heavily used across `AdminDashboardController` and `OwnerOrderController`. Bounded limit (`size <= 50`) is reusable. |
| **A5. Order detail view using safe DTOs** | **Partially implemented and reusable** | Entity and item structure exist. UI modal structure exists in `OrderDetailsModal.tsx`. Direct serialization of `Order` exposes raw customer PII. An admin-safe DTO (`AdminOrderDetailResponse`) must be created. |
| **A6. Bakery identification in orders** | **Already implemented and usable** | `Order.java` already has `@JsonProperty("shopId")` and `@JsonProperty("shopName")` dynamically resolving `shop.getId()` and `shop.getBusinessName()`. |
| **B1. Cross-shop payment visibility** | **Partially implemented and reusable** | `Payment` entity exists and stores all gateway transactions. `PaymentRepository` has shop-level methods and aggregation queries, but lacks cross-shop listing for admin. |
| **B2. Payment search (payment ID, order ID, shop)** | **Missing and requires new work** | Provider IDs (`providerPaymentId`, `providerOrderId`) are indexed in DB, but there is no combined search query across provider IDs, failure reason order reference, and bakery name. |
| **B3. Payment status, provider, type & date filters** | **Missing and requires new work** | Statuses (`COMPLETED`, `PENDING`, `FAILED`) and provider (`RAZORPAY`) exist in DB, but no query filters by transaction type (`SUBSCRIPTION` vs `RETAIL_ORDER`) or date range for admin. |
| **B4. Payment pagination and sorting** | **Partially implemented and reusable** | `JpaRepository<Payment, Long>` supports `Pageable`. Reusable with standard bounded `PageRequest`. |
| **B5. Completed, pending, failed & refund visibility** | **Partially implemented and reusable** | Gateway status tracks `COMPLETED`, `PENDING`, `FAILED`. Order payment status tracks `PAID`, `PENDING`, `FAILED`, `REFUNDED`. There is no gateway refund status in DB; refunds are manual order status markers. |
| **B6. Subscription vs. retail order payment distinction** | **Already implemented and usable** | Existing canonical rule: `(p.subscription IS NOT NULL OR p.plan IS NOT NULL)` is a **Subscription Payment**; otherwise, it is a **Retail Order Payment**. Verified in `RevenueSegregationE2ETest.java`. |
| **B7. Payment detail view using safe DTOs** | **Missing and requires new work** | Neither `AdminPaymentDetailResponse` DTO, backend detail endpoint, nor admin payment modal inspector currently exists. Both must be created in Phase 5.5. |
| **C1. Financial integrity (0% commission, revenue separation)** | **Already implemented and usable** | Fully enforced in backend calculations. Must be preserved in ledger summary totals. |
| **D1. Admin authorization (`ROLE_ADMIN`)** | **Already implemented and usable** | Spring Security `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` pattern in `AdminDashboardController` provides strict role enforcement. |
| **D2. Customer privacy and PII minimization** | **Missing and requires new work** | Existing `Order` serialization exposes raw customer phone, email, and address. List-view masking (e.g. `+91 ******1234`, `j***@example.com`) and safe DTO projections must be introduced. |
| **E1. Query performance & bounding** | **Partially implemented and reusable** | Existing indexes (`idx_orders_shop_id`, `idx_payments_shop_id`, `idx_payments_provider_order_id`, `idx_payments_provider_payment_id`) exist. Page sizes are clamped (`size <= 50`). |
| **F1. Sidebar and command palette integration** | **Partially implemented and reusable** | Navigation arrays in `AdminLayout.tsx` and shortcuts in `AdminCommandPalette.tsx` can be cleanly augmented under the existing Platform group. |

---

## 4. Current-versus-Proposed Functionality Matrix

| Feature Dimension | Current Repository State | Proposed Phase 5.5 State |
| :--- | :--- | :--- |
| **Admin Orders Route** | Does not exist (404 on `/admin/orders`). | Fully interactive `/admin/orders` page with status tabs, search, bakery filter, and date picker. |
| **Admin Orders API** | No cross-shop orders endpoint. | `GET /api/admin/orders` returning `Page<AdminOrderSummaryResponse>`. |
| **Admin Order Detail API** | No admin order detail endpoint. | `GET /api/admin/orders/{orderId}` returning `AdminOrderDetailResponse`. |
| **Order Search Scope** | Shop owner search only (`/api/owner/orders`), strictly tenant-isolated to owner's shop. | Global search matching `orderNumber`, `shopName`, `customerName`, `customerPhone` (exact or partial). |
| **Order Filters** | By shop owner's own shop orders only. | Global filters: `orderStatus`, `paymentStatus`, `shopId`, `startDate`, `endDate`. |
| **Customer PII Exposure** | Raw unmasked fields in `Order` entity. | List view masks phone and email (`+91 ******4567`, `a***@domain.com`); detail drawer exposes address only for authorized audit. |
| **Admin Payments Route** | Does not exist (404 on `/admin/payments`). | Fully interactive `/admin/payments` page with transaction type tabs, provider badges, and failure diagnostics. |
| **Admin Payments API** | No cross-shop payments endpoint. | `GET /api/admin/payments` returning `Page<AdminPaymentSummaryResponse>`. |
| **Admin Payment Detail API**| No admin payment detail endpoint. | `GET /api/admin/payments/{paymentId}` returning `AdminPaymentDetailResponse`. |
| **Payment Classification** | Evaluated internally during aggregate revenue queries. | Explicitly surfaced in response DTO as `transactionType: "SUBSCRIPTION" \| "RETAIL_ORDER"` with association state. |
| **Payment-to-Order Link** | Implicit string matching in some controllers. | Multi-stage resolution: direct provider ID matching $\rightarrow$ `failureReason` prefix $\rightarrow$ explicit `UNLINKED_GATEWAY_RECORD`. |
| **Order Audit History** | Partial events scattered in `activity_logs`. | **Explicitly deferred**. Unsupported `auditEvents` field removed from initial contract. |
| **Navigation & Palette** | Sidebar lists Overview, Bakeries, Plans, Feedback, Enquiries, Broadcasts, Notifications, Settings. | Adds "Orders Ledger" and "Payments Ledger" under existing Platform group; adds Ctrl+K shortcuts and live search results. |

---

## 5. Proposed Endpoint Contracts & Data Models

> [!IMPORTANT]
> All endpoints, DTOs, and request parameters below are **PROPOSALS** for Phase 5.5. None of them currently exist in the codebase.

### 5.1 Admin Orders Ledger Endpoints

#### `GET /api/admin/orders`
- **Security:** `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`
- **Query Parameters:**
  - `page` (int, default `0`)
  - `size` (int, default `20`, max `50`)
  - `query` (string, optional): Matches order number, customer name, customer phone, or bakery business name.
  - `orderStatus` (string, optional): `ALL`, `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`, `COMPLETED`, `CANCELLED`.
  - `paymentStatus` (string, optional): `ALL`, `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `REFUND_DUE`.
  - `shopId` (Long, optional): Restricts to a specific bakery.
  - `startDate` (ISO LocalDate `YYYY-MM-DD`, optional)
  - `endDate` (ISO LocalDate `YYYY-MM-DD`, optional)
- **Response Contract (`Page<AdminOrderSummaryResponse>`):**
```json
{
  "content": [
    {
      "id": 1042,
      "orderNumber": "ORD-A1B2C3D4",
      "shopId": 12,
      "shopName": "Sweet Delights Bakery",
      "customerName": "Rohan Sharma",
      "customerPhoneMasked": "+91 ******8910",
      "customerEmailMasked": "r***@gmail.com",
      "totalAmount": 1450.00,
      "subtotal": 1350.00,
      "deliveryCharge": 100.00,
      "discountAmount": 0.00,
      "couponCode": null,
      "orderStatus": "CONFIRMED",
      "paymentStatus": "PAID",
      "paymentMethod": "RAZORPAY",
      "transactionId": "pay_O7dK3m9XyZ1234",
      "itemCount": 2,
      "deliveryDate": "2026-10-15",
      "deliverySlotDetails": "Thursday (2:00 PM - 5:00 PM)",
      "createdAt": "2026-10-13T14:30:00",
      "paidAt": "2026-10-13T14:32:15"
    }
  ],
  "totalElements": 248,
  "totalPages": 13,
  "number": 0,
  "size": 20
}
```

#### `GET /api/admin/orders/{orderId}`
- **Security:** `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`
- **Response Contract (`AdminOrderDetailResponse`):**
```json
{
  "id": 1042,
  "orderNumber": "ORD-A1B2C3D4",
  "shopId": 12,
  "shopName": "Sweet Delights Bakery",
  "shopPhone": "+91 9876543210",
  "customerName": "Rohan Sharma",
  "customerPhone": "+91 9876548910",
  "customerEmail": "rohan.sharma@gmail.com",
  "deliveryAddress": "Flat 402, Royal Palms, MG Road, Pune, 411001",
  "specialInstructions": "Please write 'Happy 30th Birthday Amit!' in blue gel.",
  "subtotal": 1350.00,
  "deliveryCharge": 100.00,
  "discountAmount": 0.00,
  "totalAmount": 1450.00,
  "couponCode": null,
  "orderStatus": "CONFIRMED",
  "paymentStatus": "PAID",
  "paymentMethod": "RAZORPAY",
  "transactionId": "pay_O7dK3m9XyZ1234",
  "razorpayOrderId": "order_O7dJ2k8WxY0987",
  "deliveryDate": "2026-10-15",
  "deliverySlotDetails": "Thursday (2:00 PM - 5:00 PM)",
  "createdAt": "2026-10-13T14:30:00",
  "paidAt": "2026-10-13T14:32:15",
  "items": [
    {
      "id": 2084,
      "productId": 45,
      "productNameSnapshot": "Belgian Chocolate Truffle Cake",
      "variantName": "1 kg",
      "unitPrice": 1200.00,
      "quantity": 1,
      "totalPrice": 1200.00,
      "dietaryPreference": "EGGLESS",
      "cakeMessage": "Happy 30th Birthday Amit!",
      "addonsSummary": "Sparkler Candle (+₹50), Birthday Banner (+₹100)",
      "productImageUrl": "https://..."
    }
  ]
}
```
*(Note: `auditEvents` field is explicitly removed from this initial contract. See Section 6.2).*

---

### 5.2 Admin Payments Ledger Endpoints

#### `GET /api/admin/payments`
- **Security:** `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`
- **Query Parameters:**
  - `page` (int, default `0`)
  - `size` (int, default `20`, max `50`)
  - `query` (string, optional): Matches provider order ID (`order_...`), provider payment ID (`pay_...`), shop name, or order number reference.
  - `status` (string, optional): `ALL`, `COMPLETED`, `PENDING`, `FAILED`.
  - `transactionType` (string, optional): `ALL`, `SUBSCRIPTION`, `RETAIL_ORDER`.
  - `shopId` (Long, optional)
  - `startDate` (ISO LocalDate, optional)
  - `endDate` (ISO LocalDate, optional)
- **Response Contract (`Page<AdminPaymentSummaryResponse>`):**
```json
{
  "content": [
    {
      "id": 501,
      "shopId": 12,
      "shopName": "Sweet Delights Bakery",
      "transactionType": "SUBSCRIPTION",
      "financialClassification": "PLATFORM_REVENUE",
      "associationState": "SUBSCRIPTION_LINKED",
      "planName": "Pro Baker Annual",
      "relatedOrderNumber": null,
      "amount": 4999.00,
      "currency": "INR",
      "provider": "RAZORPAY",
      "providerOrderId": "order_sub_89xK12",
      "providerPaymentId": "pay_sub_90yL34",
      "gatewayStatus": "COMPLETED",
      "failureReason": null,
      "paidAt": "2026-10-12T11:20:00",
      "createdAt": "2026-10-12T11:18:30"
    },
    {
      "id": 502,
      "shopId": 12,
      "shopName": "Sweet Delights Bakery",
      "transactionType": "RETAIL_ORDER",
      "financialClassification": "NETWORK_GMV_ZERO_COMMISSION",
      "associationState": "ORDER_MATCHED",
      "planName": null,
      "relatedOrderNumber": "ORD-A1B2C3D4",
      "amount": 1450.00,
      "currency": "INR",
      "provider": "RAZORPAY",
      "providerOrderId": "order_O7dJ2k8WxY0987",
      "providerPaymentId": "pay_O7dK3m9XyZ1234",
      "gatewayStatus": "COMPLETED",
      "failureReason": "ORDER:ORD-A1B2C3D4",
      "paidAt": "2026-10-13T14:32:15",
      "createdAt": "2026-10-13T14:30:10"
    },
    {
      "id": 503,
      "shopId": 12,
      "shopName": "Sweet Delights Bakery",
      "transactionType": "RETAIL_ORDER",
      "financialClassification": "NETWORK_GMV_ZERO_COMMISSION",
      "associationState": "UNLINKED_GATEWAY_RECORD",
      "planName": null,
      "relatedOrderNumber": null,
      "amount": 750.00,
      "currency": "INR",
      "provider": "RAZORPAY",
      "providerOrderId": "order_abandoned_882",
      "providerPaymentId": null,
      "gatewayStatus": "FAILED",
      "failureReason": "Payment cancelled by customer during checkout",
      "paidAt": null,
      "createdAt": "2026-10-13T12:15:00"
    }
  ],
  "totalElements": 312,
  "totalPages": 16,
  "number": 0,
  "size": 20
}
```

#### `GET /api/admin/payments/{paymentId}`
- **Security:** `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`
- **Response Contract (`AdminPaymentDetailResponse`):**
```json
{
  "id": 502,
  "shopId": 12,
  "shopName": "Sweet Delights Bakery",
  "shopPhone": "+91 9876543210",
  "transactionType": "RETAIL_ORDER",
  "financialClassification": "NETWORK_GMV_ZERO_COMMISSION",
  "associationState": "ORDER_MATCHED",
  "planName": null,
  "relatedOrderNumber": "ORD-A1B2C3D4",
  "relatedOrderId": 1042,
  "amount": 1450.00,
  "currency": "INR",
  "provider": "RAZORPAY",
  "providerOrderId": "order_O7dJ2k8WxY0987",
  "providerPaymentId": "pay_O7dK3m9XyZ1234",
  "gatewayStatus": "COMPLETED",
  "failureReason": "ORDER:ORD-A1B2C3D4",
  "paidAt": "2026-10-13T14:32:15",
  "createdAt": "2026-10-13T14:30:10",
  "updatedAt": "2026-10-13T14:32:15",
  "subscriptionDetails": null,
  "orderDetails": {
    "orderNumber": "ORD-A1B2C3D4",
    "orderStatus": "CONFIRMED",
    "orderPaymentStatus": "PAID",
    "totalAmount": 1450.00,
    "customerName": "Rohan Sharma",
    "deliveryDate": "2026-10-15"
  }
}
```

---

## 6. Verified Repository Findings vs. Assumptions

### 6.1 Historical Payment-to-Order Association
- **Repository Fact:** There is **no foreign key column `order_id`** in the `payments` table.
- **Verification of `failureReason = "ORDER:<orderNumber>"`:**
  - In `CustomerPaymentController.java` (line 102 & 212) and `WebhookController.java` (line 173), `"ORDER:" + order.getOrderNumber()` is populated in `failureReason`.
  - **However, this is NOT consistently available across all states:** When a customer cancels checkout, `CustomerPaymentController.java` (line 275) overwrites `failureReason` with the user-facing cancellation reason (e.g., `"Payment cancelled by customer during checkout"`), dropping the `"ORDER:"` prefix.
  - Furthermore, in early manual testing or historical migrations, `failureReason` may be null.
- **Safe Resolution Order (Never Fabricate Relationships):**
  1. Primary Match: Check if `orders.transaction_id = payment.provider_payment_id` OR `orders.transaction_id = payment.provider_order_id` OR `orders.razorpay_order_id = payment.provider_order_id`.
  2. Fallback Match: Parse `payment.failureReason` if it starts with `"ORDER:"` and look up `orders.order_number`.
  3. Safe Unlinked State: If neither match succeeds, or if the transaction is a subscription payment, or if the order cannot be found, mark:
     `relatedOrderNumber = null`  
     `associationState = "UNLINKED_GATEWAY_RECORD"`
  4. **Strict Rule:** No database migrations or schema additions will be introduced to force links.

### 6.2 Order-Detail Audit History (Deferred)
- **Repository Fact:** Platform events are logged to `activity_logs`, but coverage is **not comprehensive** for orders:
  - Order creation in `CustomerStorefrontService` does not write an activity log.
  - Storefront payment verification does not write an activity log.
  - Only owner status updates (`OrderService`) and webhooks (`WebhookController`) write logs.
  - `ActivityLogRepository` does not possess an indexed query method by `entity_type` and `entity_id`.
- **Decision:** The proposed `auditEvents` array is **explicitly deferred**. It is removed from the Phase 5.5 `AdminOrderDetailResponse` contract to avoid fabricating incomplete or unindexed audit history. No new audit subsystem will be created in this phase.

### 6.3 Payment Gateway Status vs. Order Payment Status & Refunds
- **Repository Fact (Payment Table):** The column `payments.status` stores strictly:
  - `PENDING`
  - `COMPLETED`
  - `FAILED`
  *(There is NO `REFUNDED` value in `payments.status`).*
- **Repository Fact (Orders Table):** The column `orders.payment_status` stores:
  - `PENDING`
  - `PAID`
  - `FAILED`
  - `REFUNDED`
- **Repository Fact (Order Lifecycle):** `orders.order_status` stores:
  - `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`, `COMPLETED`, `CANCELLED` (and intermediate `PAYMENT_PENDING`).
- **Derived Business Filter (`REFUND_DUE`):**
  - In `OrderRepository.java` (line 38), `REFUND_DUE` is a **derived filter query predicate**: `orderStatus = 'CANCELLED' AND paymentStatus = 'PAID'`. It is not an enum column value.
- **Refund Engine Truth:** CakeStore backend has **no automated Razorpay refund disbursement API integration**. In `OrderService.java` (lines 185-189), when an owner marks an order as `REFUNDED`, it merely updates the database column and sets `transaction_id = "REFUND_ISSUED"`.
- **Ledger Presentation Rule:**
  - Payments Ledger displays `gatewayStatus` (`COMPLETED`, `PENDING`, `FAILED`).
  - Orders Ledger displays `paymentStatus` (`PAID`, `PENDING`, `FAILED`, `REFUNDED`) and highlights `REFUND_DUE` warning badges when an order is cancelled after payment.
  - The plan strictly avoids implying that automated refund processing exists.

---

## 7. Financial Invariants & Segregation Rules

The CakeStore business and financial rules remain **strictly immutable**:

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    TRANSACTION FLOW                    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                        ┌──────────────────┴──────────────────┐
                                        ▼                                     ▼
                        ┌───────────────────────────────┐     ┌───────────────────────────────┐
                        │   payment.subscription != null│     │    payment.subscription == null│
                        │   OR payment.plan != null     │     │    AND payment.plan == null   │
                        └───────────────┬───────────────┘     └───────────────┬───────────────┘
                                        │                                     │
                                        ▼                                     ▼
                        ┌───────────────────────────────┐     ┌───────────────────────────────┐
                        │     CONFIRMED SUBSCRIPTION    │     │   MATCHED TO VERIFIED ORDER?  │
                        │       (Platform Revenue)      │     └───┬───────────────────────┬───┘
                        └───────────────────────────────┘         │ (YES)                 │ (NO)
                                                                  ▼                       ▼
                                                ┌──────────────────────────┐  ┌──────────────────────────┐
                                                │  CONFIRMED RETAIL ORDER  │  │   UNKNOWN / UNLINKED     │
                                                │   (0% Comm. Network GMV) │  │     GATEWAY RECORD       │
                                                └──────────────────────────┘  └──────────────────────────┘
```

### 7.1 Strict Classification Predicates (Three-Tier Classification)
1. **Confirmed SaaS Subscription Revenue (`SUBSCRIPTION`):**
   - Established strictly through an actual subscription or plan association: `p.status = 'COMPLETED' AND (p.subscription IS NOT NULL OR p.plan IS NOT NULL)`.
   - Represents software subscription fees earned by CakeStore platform.
   - Surfaced in Payments Ledger as `transactionType = "SUBSCRIPTION"`, `classification = "PLATFORM_REVENUE"`.
2. **Confirmed Retail Order Payments (`RETAIL_ORDER`):**
   - Condition: Payment has **neither** subscription nor plan (`p.subscription IS NULL AND p.plan IS NULL`), **AND** a payment-to-order relationship is successfully confirmed through the documented matching strategy (order transaction ID, razorpay order ID, or verified order number reference).
   - Represents retail customer payments for bakery cake orders.
   - **CakeStore Commission: EXACTLY 0.00%**. CakeStore earns zero commission on cake retail sales.
   - Surfaced in Payments Ledger as `transactionType = "RETAIL_ORDER"`, `classification = "NETWORK_GMV_ZERO_COMMISSION"`.
3. **Unlinked / Unknown Gateway Records (`UNKNOWN` / `UNLINKED_GATEWAY_RECORD`):**
   - **Critical Rule:** A payment with neither a subscription nor a plan association **must NOT automatically be classified as a retail sale**.
   - If available data cannot establish a verified link to an existing order (e.g. abandoned checkout, test transaction, orphaned gateway charge), it is designated as:
     `transactionType = "UNKNOWN"`, `associationState = "UNLINKED_GATEWAY_RECORD"`, `classification = "UNLINKED_TRANSACTION"`.
   - **Financial Invariant:** An unlinked transaction must **never** be counted as CakeStore subscription revenue, nor presented as a confidently matched retail order, nor alter aggregate GMV calculations.
4. **Cash-on-Delivery (COD) Treatment:**
   - COD orders exist in the `orders` table. They are surfaced in the Orders Ledger.
   - **COD orders are NEVER fabricated as gateway records** in the Payments Ledger.
5. **Dashboard KPI Invariance:**
   - Ledger summary counts and tables must never redefine or alter the existing calculation rules in `AdminDashboardService.getPlatformStats()`. All platform metrics remain strictly immutable.

---

## 8. Authorization, Privacy, and Tenant Isolation

### 8.1 Authorization
- Every new endpoint is placed under `/api/admin/` and protected with Spring Security `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`.
- `ROLE_SHOP_OWNER` and `ROLE_CUSTOMER` tokens must receive `403 Forbidden` if attempting to query cross-shop ledgers.
- Unauthenticated requests must receive `401 Unauthorized`.

### 8.2 Customer Privacy (Data Minimization)
- In the **Orders Ledger list view** (`/admin/orders`), customer PII is masked:
  - Phone: `+91 ******8910` (first 3 and last 4 visible, middle 6 masked).
  - Email: `r***@gmail.com` (first char + `***` + domain).
  - Delivery Address: **Omitted** from list view completely.
- In the **Order Detail modal** (`/admin/orders/{id}`), unmasked customer phone, email, and delivery address are returned only to authenticated administrators for dispute resolution.
- Application logs and payment DTOs must never log raw customer PII, gateway secret keys (`razorpay_key_secret`), or webhook secrets.

---

## 9. Query Performance & Indexing Analysis

### 9.1 Actual Existing Database Indexes
- `orders`:
  - `orders_pkey` on `id`
  - `orders_order_number_key` on `order_number` (UNIQUE)
  - `idx_orders_shop_id` on `shop_id`
  - `idx_orders_shop_created` on `(shop_id, created_at DESC)` (from V26)
- `order_items`:
  - `idx_order_items_order_id` on `order_id` (from V24)
- `payments`:
  - `payments_pkey` on `id`
  - `idx_payments_shop_id` on `shop_id`
  - `idx_payments_provider_order_id` on `provider_order_id` (from V24)
  - `idx_payments_provider_payment_id` on `provider_payment_id` (from V24)

### 9.2 Honest Performance Assessment
- **Cross-shop sorting:** The existing index `idx_orders_shop_created` has `shop_id` as the leading column. A cross-shop query `ORDER BY o.createdAt DESC` across all shops cannot use this index without a leading `shop_id` equality condition. It will perform a scan and filesort.
- **Wildcard search:** `LOWER(customer_name) LIKE '%query%'` cannot use standard b-tree indexes and triggers sequential scans.
- **Mitigation & Policy:**
  - Bounded `PageRequest` (`size <= 50`) prevents large heap allocations and serialization bottlenecks.
  - Direct lookups on `order_number`, `provider_order_id`, and `provider_payment_id` leverage existing unique and b-tree indexes.
  - **No Flyway migrations will be introduced in Phase 5.5 without separate explicit approval.** The plan acknowledges this operational boundary honestly.

---

## 10. Reuse-Before-Create Assessment

| Need | Reusable Existing Component / Code | New Code Needed |
| :--- | :--- | :--- |
| **Card container & layout** | [`components/ui/Card.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/ui/Card.tsx) | None. 100% reusable. |
| **Status Badges** | [`components/ui/Badge.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/ui/Badge.tsx), [`components/common/StatusBadge.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/common/StatusBadge.tsx) | Extend color mappings for payment types. |
| **Loading & Empty states** | [`components/ui/LoadingState.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/ui/LoadingState.tsx), [`components/ui/EmptyState.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/ui/EmptyState.tsx) | None. 100% reusable. |
| **Pagination controls** | Table pagination pattern in [`app/admin/shops/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx) | Reusable markup & state handlers. |
| **Search input** | [`components/ui/Input.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/ui/Input.tsx) with debounce hook | None. 100% reusable. |
| **Order Details Modal** | Layout and item rendering in [`OrderDetailsModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/OrderDetailsModal.tsx) | Adapt into a read-only Admin Order Inspector without owner status mutation buttons. |
| **Payment Details Modal** | Slide-over inspector pattern matching `AdminOrderDetailsModal` | New `AdminPaymentDetailsModal.tsx` for transaction diagnostics. |
| **API Client & Auth** | [`lib/api/client.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/lib/api/client.ts) (Axios with Bearer token interceptor) | Add typed methods in `lib/api/admin.ts`. |
| **Backend Auth & Roles** | Spring Security `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` | Annotate new methods in controller. |
| **Currency formatting** | `formatIndianCurrency` helper established in `AnalyticsCharts.tsx` | Export and reuse across ledgers. |

---

## 11. Minimal Proposed File Changes (Grouped by Phase)

Implementation will proceed in five isolated, sequential phases only after explicit approval:

### Phase 5.5.1: Backend Repositories & DTOs
1. `backend/src/main/java/com/cakeplatform/api/modules/admin/dto/AdminOrderSummaryResponse.java` *(New DTO with PII masking)*
2. `backend/src/main/java/com/cakeplatform/api/modules/admin/dto/AdminOrderDetailResponse.java` *(New DTO for audit inspection)*
3. `backend/src/main/java/com/cakeplatform/api/modules/admin/dto/AdminPaymentSummaryResponse.java` *(New DTO with classification)*
4. `backend/src/main/java/com/cakeplatform/api/modules/admin/dto/AdminPaymentDetailResponse.java` *(New DTO for payment diagnostics)*
5. `backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java` *(Add cross-shop JPQL query with pagination)*
6. `backend/src/main/java/com/cakeplatform/api/modules/payment/PaymentRepository.java` *(Add cross-shop JPQL query with pagination)*

### Phase 5.5.2: Backend Service & Controller
7. `backend/src/main/java/com/cakeplatform/api/modules/admin/AdminDashboardService.java` *(Implement `getCrossShopOrders`, `getCrossShopOrderDetail`, `getCrossShopPayments`, `getCrossShopPaymentDetail`)*
8. `backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminDashboardController.java` *(Expose `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `GET /api/admin/payments`, `GET /api/admin/payments/{id}`)*

### Phase 5.5.3: Frontend Types & API Client
9. `frontend_v2/types/admin.ts` *(Add `AdminOrderSummary`, `AdminOrderDetail`, `AdminPaymentSummary`, `AdminPaymentDetail`, and filter interfaces)*
10. `frontend_v2/lib/api/admin.ts` *(Add `getAdminOrders`, `getAdminOrderDetail`, `getAdminPayments`, `getAdminPaymentDetail`)*

### Phase 5.5.4: Frontend Ledger Pages & Detail Modals
11. `frontend_v2/app/admin/orders/page.tsx` *(New page: Orders Ledger with status tabs, search, pagination)*
12. `frontend_v2/components/admin/AdminOrderDetailsModal.tsx` *(New component: Read-only Order Inspector)*
13. `frontend_v2/app/admin/payments/page.tsx` *(New page: Payments Ledger with type tabs, provider badges)*
14. `frontend_v2/components/admin/AdminPaymentDetailsModal.tsx` *(New component: Read-only Payment Inspector)*

### Phase 5.5.5: Navigation, Command Palette & Regression Validation
15. `frontend_v2/app/admin/layout.tsx` *(Add "Orders Ledger" and "Payments Ledger" under existing `platformNavItems`)*
16. `frontend_v2/components/admin/AdminCommandPalette.tsx` *(Add command palette static shortcuts & live search)*
17. `backend/src/test/java/com/cakeplatform/api/modules/admin/AdminCrossShopLedgerE2ETest.java` *(New test verifying security, isolation, masking, and classification)*

---

## 12. Regression Tests and Acceptance Criteria

### 12.1 Backend Regression Tests
1. **Security & Authorization Test (`AdminCrossShopLedgerE2ETest`):**
   - Verify `GET /api/admin/orders` and `GET /api/admin/payments` return `200 OK` for `ROLE_ADMIN`.
   - Verify `GET /api/admin/orders` and `GET /api/admin/payments` return `403 FORBIDDEN` for `ROLE_SHOP_OWNER`.
   - Verify `GET /api/admin/orders` and `GET /api/admin/payments` return `403 FORBIDDEN` for `ROLE_CUSTOMER`.
   - Verify unauthenticated requests return `401 UNAUTHORIZED`.
2. **Customer Privacy Masking Test:**
   - In `GET /api/admin/orders`, verify customer phone is masked (`+91 ******8910`) and email is masked (`r***@domain.com`).
   - In `GET /api/admin/orders/{id}`, verify unmasked phone and address are returned only to `ROLE_ADMIN`.
3. **Financial Integrity & Classification Test:**
   - Create 1 subscription payment (₹1,999) and 2 retail customer orders (₹850, ₹1,200).
   - Verify Payments Ledger returns all 3 records, but clearly classifies the subscription payment as `SUBSCRIPTION` (`PLATFORM_REVENUE`) and customer payments as `RETAIL_ORDER` (`NETWORK_GMV_ZERO_COMMISSION`).
   - Verify aggregate platform revenue strictly equals ₹1,999 and does not count customer payments.
4. **Pagination Bounding Test:**
   - Request `size = 100`; verify returned page size is clamped to `50`.

### 12.2 Frontend Acceptance Criteria
1. `/admin/orders` and `/admin/payments` render within existing Admin layout under Platform sidebar group.
2. Search filters orders dynamically with 400ms debounce.
3. Customer phone and email appear masked in Orders Ledger table.
4. Clicking an order opens read-only detail modal with items, delivery info, and bakery name.
5. Clicking a payment opens read-only detail modal with provider IDs, failure reason, and linked order/subscription info.
6. TypeScript (`npx tsc --noEmit`) and ESLint (`npm run lint`) pass with zero errors.

---

## 13. Selected Product Decisions & Deferred Items

### 13.1 Selected Product Decisions
1. **Sidebar Navigation Placement:** Both ledgers will be placed under the existing **"Platform"** sidebar navigation group (`platformNavItems` in `frontend_v2/app/admin/layout.tsx`).
2. **Manual Reconciliation:** **No manual Razorpay reconciliation action** will be implemented in Phase 5.5. Both ledgers remain strictly read-only and diagnostic.
3. **Audit History Source:** Order-level audit events (`auditEvents`) are **explicitly deferred**. No new audit subsystem will be created in Phase 5.5.
4. **Database Migrations:** **Zero Flyway migrations** will be added or modified in Phase 5.5.

---

## 14. Untouched Boundaries and Preservation Guarantee

The following components, features, and business rules are **strictly out of scope** and must remain completely untouched:
- Storefront customer checkout flow (`CustomerStorefrontService`, `CartDrawer`, `StorefrontCheckoutTab`).
- Bakery Owner order management and kitchen preparation workflow (`OwnerOrderController`, `OrderService`).
- Existing Razorpay webhook signature validation and idempotency logic (`WebhookController`).
- Existing Admin Overview KPI cards and revenue calculation formulas (`AdminDashboardService.getPlatformStats`).
- Existing Flyway migrations `V1` through `V46`.
- Existing uncommitted working-tree modifications from Steps 1–5 and Phases 5.1–5.4.

---

## 15. Stop Condition

> [!CAUTION]
> **STOP CONDITION IN EFFECT:**
> This audit and plan is strictly read-only. No code, configuration, test, or migration files have been created or modified (with the sole exception of this planning document).
> 
> **Do not proceed with implementation until the user has reviewed this document and provided explicit authorization.**
