# CakeStore — Post-Fix Release-Safety Audit Report

**Audit Target**: Delivery-Fee Consistency Architecture & Flyway Migration `V52__add_delivery_consistency_fields.sql`  
**Date**: October 22, 2026  
**Auditor**: Antigravity Quality & Release Safety Agent  
**Status**: **PASSED (WITH GO-LIVE RECOMMENDATIONS)**  
**Branch**: `development` (Working tree clean & preserved)

---

## Executive Summary

A comprehensive, non-destructive, read-only release-safety audit was conducted to evaluate the delivery-fee consistency fix across backend services, database schema migrations, and frontend checkout/tracking interfaces. 

The audit focused on:
1. Evaluating whether the schema defaults introduced in `V52__add_delivery_consistency_fields.sql` accurately reflect historical business settings across all 4,456 shops.
2. Assessing the risk of bakeries incorrectly appearing as offering paid delivery.
3. Formulating a backward-compatible correction strategy without breaking Flyway checksums.
4. Verifying mathematical consistency across all 8 customer- and owner-facing financial touchpoints.
5. Verifying that historical order records, specifically `ORD-43BDD1FD` (Order #2679), remain untouched and intact.
6. Executing automated test suites across backend, frontend unit tests, TypeScript type checking, and Next.js production bundle compilation.

---

## 1. Audit of Migration `V52__add_delivery_consistency_fields.sql`

### 1.1 Migration Contents
Migration `V52` performed three database operations:
```sql
-- 1. Add delivery_enabled toggle to shop_delivery_configs
ALTER TABLE shop_delivery_configs
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add fulfillment_method to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_method VARCHAR(50) NOT NULL DEFAULT 'HOME_DELIVERY';

-- 3. Ensure any existing shops that do not have a shop_delivery_configs row receive the authoritative default
INSERT INTO shop_delivery_configs (shop_id, delivery_charge_type, fixed_charge_amount, min_order_for_free_delivery, delivery_enabled)
SELECT s.id, 'FIXED', 50.00, 1000.00, TRUE
FROM shops s
WHERE NOT EXISTS (SELECT 1 FROM shop_delivery_configs dc WHERE dc.shop_id = s.id);
```

### 1.2 Database Reality & Shop Breakdown
A deep query of the PostgreSQL database (`cake_platform`) revealed the following breakdown:
- **Total rows in `shops`**: 4,457
- **Soft-deleted shops (`is_deleted = true`)**: 4,428
- **Active non-deleted shops (`is_deleted = false`)**: 29
  - **Real Bakeries**:
    1. **Shop 17**: Sweet Delight Bakery (Pimpri-Chinchwad, Maharashtra)
    2. **Shop 4**: John's Premium Cakes (London, Greater London; `HOME_BAKERY`)
    3. **Shop 5**: Mruns bakery (Pune, Maharashtra)
  - **Automated Test Bakeries**: 26 integration test records (Shops 5183–5208) generated during test runs.

### 1.3 Historical Settings & Business Intent Analysis
- **Pre-existing Default Origin**: The ₹50 fixed fee with ₹1,000 free-delivery threshold was **not invented in V52**. It was originally introduced in `V14__storefront_master_upgrade.sql` (lines 125–128), which seeded all shops with `('FIXED', 50.00, 1000.00)`.
- **Pre-existing Capabilities**: In the original owner portal (`DeliverySettingsSection.tsx`), owners were only presented with two radio options: *"Free Delivery"* or *"Fixed Delivery Charge"*. Prior to V52, the platform did **not** provide any toggle or switch for bakeries to disable delivery or declare "Store Pickup Only".
- **Historical Orders**: Every one of the 6 historical orders in the database was created as a doorstep delivery:
  - 5 orders charged ₹50.00 delivery fee.
  - 1 order (Order 2674, ₹2,000 subtotal) charged ₹0.00 because it qualified for free delivery above the ₹1,000 threshold.
- **`shop_storefront_settings.fulfillment_enabled`**: Historical records showed only 1 row in `shop_storefront_settings` (Shop 17). Source code inspection confirmed that `fulfillment_enabled` in `shop_storefront_settings` controls the visibility of the lead-time notice banner (*"Orders require 2 days advance booking"*) on the About page; it was never a delivery toggle.

### 1.4 Finding & Risk Assessment
- **Accurate Reflection**: Seeding `delivery_enabled = TRUE`, `FIXED`, `₹50.00`, and `₹1,000.00` is **100% consistent with the platform's historical architecture and pre-existing business defaults**. No custom owner delivery settings were overwritten or corrupted because no custom configurations existed.
- **Operational Nuance**: Any bakery that physically operated as counter-pickup only had previously been forced to display the platform's default ₹50 delivery fee. With V52 and the updated Owner Storefront settings UI, bakery owners now have an explicit switch to turn off delivery (`delivery_enabled = false`), which locks customer checkout into Store Pickup Only (₹0 fee).

---

## 2. Backward-Compatible Correction Recommendation

### 2.1 Immutability of Applied Migrations
> [!CAUTION]
> Migration `V52` has already been applied to the active database environment, and its SHA-256 checksum is recorded in `flyway_schema_history`. Modifying the V52 SQL script file would cause Flyway checksum validation to fail on backend startup, halting deployments.

### 2.2 Recommended Forward Strategy (If Opt-In Delivery is Desired)
If business management decides that newly registered shops or specific business types (e.g. `HOME_BAKERY` without dedicated logistics) should default to "Pickup Only" rather than "Delivery Enabled", it should be handled via a forward migration `V53`:

```sql
-- V53__adjust_home_bakery_delivery_defaults.sql (OPTIONAL FORWARD MIGRATION)
-- For shops registered as HOME_BAKERY with zero delivery slots, set delivery_enabled to false
-- so they default to counter pickup until the owner explicitly enables delivery.
UPDATE shop_delivery_configs dc
SET delivery_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
FROM shops s
WHERE dc.shop_id = s.id
  AND s.business_type = 'HOME_BAKERY'
  AND NOT EXISTS (
      SELECT 1 FROM shop_delivery_slots ds 
      WHERE ds.shop_id = s.id AND ds.is_active = TRUE
  );
```
*Recommendation*: For current release, keep `V52` as is. Provide an onboarding prompt or banner in the Owner Dashboard informing bakery owners of the new Delivery Availability Switch.

---

## 3. End-to-End Mathematical & Architectural Invariant Audit

All 8 financial touchpoints were traced end-to-end to verify that no screen, service, or PDF uses unauthoritative, cached, or client-derived pricing:

| # | Touchpoint | Location | Authoritative Mechanism | Audit Result |
|---|---|---|---|---|
| **1** | **Quote Endpoint** | `CustomerStorefrontController#calculateOrderQuote` | Invokes `CustomerStorefrontService#calculateQuote`. Retrieves `ShopDeliveryConfig` from database. Evaluates fulfillment method (`HOME_DELIVERY` vs `SELF_PICKUP`), fee type (`FIXED` vs `FREE`), and subtotal threshold. | **VERIFIED** |
| **2** | **Storefront Checkout** | `StorefrontCheckoutTab.tsx` | Calls `storefrontApi.calculateQuote`. Sends client-expected totals (`expectedTotal`, `expectedDeliveryFee`). If backend calculation differs, modal dialog prompts customer before order creation. | **VERIFIED** |
| **3** | **Order Creation** | `CustomerStorefrontService#placeGuestOrder` | Authoritatively re-computes subtotal from active product catalog, addons, and dietary prices. Computes authoritative delivery fee. Rejects mismatched client totals with `PriceMismatchException` (HTTP 409). | **VERIFIED** |
| **4** | **COD Settlement** | `CustomerStorefrontService` / DB | Persists exact `order.delivery_charge` and `order.total_amount`. Returns authoritative amounts for counter/doorstep cash collection. | **VERIFIED** |
| **5** | **Razorpay Gateway** | `CustomerPaymentController#createCustomerPaymentOrder` | Calculates `amountPaise = order.getTotalAmount() * 100` with strict `RoundingMode.UNNECESSARY`. Zero client manipulation possible. | **VERIFIED** |
| **6** | **Customer Order Tracking** | `StorefrontTrackOrderTab.tsx` & `/orders/[id]` | Reads persisted `order.subtotal`, `order.deliveryCharge`, `order.discountAmount`, `order.totalAmount`, and `order.fulfillmentMethod`. | **VERIFIED** |
| **7** | **Tax Invoice PDF** | `InvoiceService#generateInvoice` | Streams item table and prints: `Subtotal: ₹order.getSubtotal()`, `Delivery Charge: ₹order.getDeliveryCharge()`, `Total: ₹order.getTotalAmount()`. | **VERIFIED** |
| **8** | **Owner Orders Modal** | `OrderDetailsModal.tsx` | Displays breakdown directly from order entity: subtotal, delivery fee (`Self-Pickup (FREE)` or `+₹50`), coupon discount, and total. | **VERIFIED** |

---

## 4. Verification of Historical Financial Records

Historical order **`ORD-43BDD1FD`** (Order ID 2679) was inspected via direct SQL query against the production PostgreSQL instance:

```sql
SELECT id, order_number, shop_id, customer_name, subtotal, delivery_charge, 
       total_amount, payment_method, fulfillment_method, created_at 
FROM orders WHERE order_number = 'ORD-43BDD1FD';
```

**Database Record Verification**:
- **Order ID**: `2679`
- **Order Number**: `ORD-43BDD1FD`
- **Shop ID**: `17` (Sweet Delight Bakery)
- **Customer Name**: `Mrunali Hatzade`
- **Items Subtotal**: `₹10.00`
- **Delivery Charge**: `₹50.00`
- **Total Amount**: `₹60.00`
- **Payment Method**: `COD`
- **Order Status**: `NEW`
- **Payment Status**: `PENDING`
- **Fulfillment Method**: `HOME_DELIVERY` (Populated safely by V52 non-null default)
- **Created At**: `2026-10-21 21:04:27.988543`

> [!NOTE]
> Order `ORD-43BDD1FD` remains completely intact and unaltered. Historical financial integrity is 100% preserved.

---

## 5. End-to-End Test Execution Results

### 5.1 Backend Regression Test Suite
Automated regression tests in `DeliveryFeeConsistencyRegressionTest.java` were executed:

```
[INFO] Running com.cakeplatform.api.modules.storefront.DeliveryFeeConsistencyRegressionTest
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.756 s
```

**Test Scenario Coverage**:
1. `testPaidHomeDelivery_DefaultFeeApplied`: Subtotal ₹10.00 + fixed delivery ₹50.00 = ₹60.00 (**PASSED**).
2. `testFreeHomeDelivery_OwnerZeroFee`: Owner sets `deliveryChargeType='FREE'` -> fee is ₹0.00 (**PASSED**).
3. `testFreeHomeDelivery_ThresholdMet`: Subtotal ₹150.00 exceeds threshold ₹100.00 -> fee waived to ₹0.00 (**PASSED**).
4. `testSelfPickup_DeliveryFeeIsZeroRegardlessOfConfig`: Customer selects `SELF_PICKUP` -> fee is ₹0.00 even with ₹50 fixed config (**PASSED**).
5. `testDisabledDelivery_HomeDeliveryRejected`: Owner sets `deliveryEnabled=false` -> home delivery throws `IllegalArgumentException` (**PASSED**).
6. `testDisabledDelivery_QuoteRejection`: Quote returns `canDeliver=false`, `deliveryEnabled=false`, rejection reason (**PASSED**).
7. `testPriceMismatch_RejectedWhenClientExpectedTotalDiffers`: Client tampered total triggers `PriceMismatchException` (**PASSED**).
8. `testPriceMismatch_AcceptedWhenCustomerConfirms`: Customer confirmation flag permits proceeding with authoritative total (**PASSED**).
9. `testGetShopDetails_ReturnsAuthoritativeDefaultDeliveryConfig`: Missing DB row cleanly defaults to authoritative config (**PASSED**).
10. `testQuoteAndOrderPlacementAgreement`: Quote response and placed order agree down to the exact paise (**PASSED**).

### 5.2 Core Storefront Services Test Suite
```
[INFO] Running com.cakeplatform.api.modules.storefront.CustomerStorefrontServiceTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.cakeplatform.api.modules.storefront.StorefrontUpgradeCoreTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```
*Total Backend Core Storefront Tests Passed*: **18 / 18**

### 5.3 Complete Frontend Test Suite
Executed `npm test` in `frontend_v2`:
```
ℹ tests 200
ℹ suites 21
ℹ pass 200
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 4946.15
```
*All 200 unit tests passed without failure.*

### 5.4 TypeScript Static Type Analysis
Executed `npx tsc --noEmit` in `frontend_v2`:
```
Exit code: 0 (Zero type errors)
```

### 5.5 Next.js Production Build
Executed `npm run build` in `frontend_v2`:
```
▲ Next.js 14.2.5
✓ Compiled successfully
Linting and checking validity of types ...
Generating static pages (38/38) ...
✓ Finalizing page optimization
Exit code: 0 (Build Successful)
```
All 38 application routes compiled into optimized production bundles.

---

## 6. Risk Analysis & Mitigation Matrix

| Risk Identified | Severity | Probability | Existing Mitigation | Recommended Action |
|---|---|---|---|---|
| A bakery never offering delivery appears with ₹50 fee | Low | Low | Only 3 genuine bakeries exist in DB; Sweet Delight Bakery confirmed they offer delivery. V52 default matches V14. | Display delivery settings banner in owner dashboard to encourage custom fee configuration. |
| Client manipulates checkout cart price | High | High | Backend `PriceMismatchException` re-validates catalog prices, coupons, and delivery fees under row lock before persisting. | Fully mitigated. |
| Inconsistency between Razorpay amount and COD total | Critical | Low | `CustomerPaymentController` reads `order.getTotalAmount() * 100` directly from the persisted entity. | Fully mitigated. |
| Breakage of historical invoice totals | Medium | Zero | `InvoiceService` pulls strictly from persisted columns (`subtotal`, `delivery_charge`, `total_amount`). | Fully mitigated. |
| Flyway checksum corruption on deployment | Critical | Low | `V52` SQL file was not modified or renamed. Checksum remains valid. | Do not edit V52. Any future data adjustments must use `V53`. |

---

## 7. Release Gate Recommendation

**DECISION: APPROVED FOR DEPLOYMENT**

The delivery-fee consistency architecture and migration `V52` satisfy all functional, architectural, financial, and release-safety requirements. Historical records are preserved, client-side pricing tampering is prevented, and all testing pipelines passed with 100% success.
