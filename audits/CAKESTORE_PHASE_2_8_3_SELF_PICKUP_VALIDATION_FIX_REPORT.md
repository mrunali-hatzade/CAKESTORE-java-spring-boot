# CakeStore — Phase 2.8.3: Self-Pickup Validation Fix Report

**Execution Timestamp:** 2026-11-04T00:18:00+05:30  
**Environment:** Local Staging (`localhost:5432`, `localhost:8080`, `localhost:3000`)  
**Target Subsystem:** Customer Storefront Checkout & Delivery Slot Validation  
**Branch:** `development`  

---

## 1. Root Cause

During Phase 2.8.2 testing, attempting to place a controlled `SELF_PICKUP` staging order for Shop 1 (`Akurdi Artisan Bakes`) revealed that order creation was blocked at the validation layer with `HTTP 400 Bad Request: {"deliverySlotId": "Delivery slot is required"}`.

### Identified Mechanism:
1. **Unconditional Bean Validation**: `GuestOrderRequest.java` had an unconditional `@NotNull(message = "Delivery slot is required")` constraint on `private Long deliverySlotId;`.
2. **Missing Delivery Slots in Staging**: Shop 1 (and all default seeded bakeries) has zero rows in `shop_delivery_slots` (`SELECT * FROM shop_delivery_slots;` returned `0 rows`).
3. **Premature Slot Resolution in Service**: In `CustomerStorefrontService.java` (`placeGuestOrder`), delivery slot lookup, row locking, and capacity evaluation were executed *before* determining `fulfillmentMethod` or `isSelfPickup`. If a caller passed a dummy or unseeded slot ID to bypass `@NotNull`, the service failed with `HTTP 400: {"error": "Delivery slot not found or does not belong to this shop"}`.
4. **Unconditional Frontend Blocking**: `StorefrontCheckoutTab.tsx` unconditionally asserted `if (!selectedSlotId) setError('Please select a delivery slot window.')`, blocking self-pickup checkout in the browser when bakeries had zero slots.

---

## 2. Files Inspected and Modified

### Files Modified:
1. [`backend/.../storefront/dto/GuestOrderRequest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/dto/GuestOrderRequest.java): Removed `@NotNull` on `deliverySlotId`; added class-level `@ValidDeliverySlot`.
2. [`backend/.../storefront/CustomerStorefrontService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java): Moved fulfillment method resolution before slot processing; made slot lookup and capacity reservation strictly conditional on `!isSelfPickup`.
3. [`backend/.../config/GlobalExceptionHandler.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/GlobalExceptionHandler.java): Defensively handled non-`FieldError` violations to prevent `ClassCastException`.
4. [`frontend_v2/.../tabs/StorefrontCheckoutTab.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx): Allowed self-pickup checkout without requiring delivery slot selection; adapted date and timing labels conditionally (`Pickup Date` / `Pickup Timing Preference`).
5. [`backend/.../storefront/DeliveryFeeConsistencyRegressionTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/storefront/DeliveryFeeConsistencyRegressionTest.java): Updated slot stubbing to `lenient()` to accommodate self-pickup skipping slot lookups.

### Files Created:
1. [`backend/.../storefront/validation/ValidDeliverySlot.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/validation/ValidDeliverySlot.java): Custom constraint annotation for conditional delivery slot validation.
2. [`backend/.../storefront/validation/ValidDeliverySlotValidator.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/validation/ValidDeliverySlotValidator.java): Constraint validator enforcing `deliverySlotId != null` for `HOME_DELIVERY`, allowing null for `SELF_PICKUP`.
3. [`backend/.../storefront/CustomerSelfPickupOrderValidationTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/storefront/CustomerSelfPickupOrderValidationTest.java): Comprehensive 11-test regression suite.

---

## 3. Exact Implementation Details

### A. Conditional Bean Validation Annotation & Validator
```java
// ValidDeliverySlotValidator.java
@Override
public boolean isValid(GuestOrderRequest request, ConstraintValidatorContext context) {
    if (request == null) return true;

    String rawFulfillment = request.getFulfillmentMethod();
    boolean isSelfPickup = rawFulfillment != null && (
            "SELF_PICKUP".equalsIgnoreCase(rawFulfillment)
            || "STORE_PICKUP".equalsIgnoreCase(rawFulfillment)
            || "PICKUP".equalsIgnoreCase(rawFulfillment)
    );

    // For SELF_PICKUP, deliverySlotId is optional (may be null)
    if (isSelfPickup) return true;

    // For HOME_DELIVERY, deliverySlotId is strictly required
    if (request.getDeliverySlotId() == null) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                .addPropertyNode("deliverySlotId")
                .addConstraintViolation();
        return false;
    }
    return true;
}
```

### B. Service-Level Validation in `CustomerStorefrontService.java`
```java
// Determine fulfillment method and authoritative delivery configuration
String rawFulfillment = request.getFulfillmentMethod();
boolean isSelfPickup = rawFulfillment != null && (
        "SELF_PICKUP".equalsIgnoreCase(rawFulfillment)
        || "STORE_PICKUP".equalsIgnoreCase(rawFulfillment)
        || "PICKUP".equalsIgnoreCase(rawFulfillment)
);
String fulfillmentMethod = isSelfPickup ? "SELF_PICKUP" : "HOME_DELIVERY";

com.cakeplatform.api.modules.shop.ShopDeliverySlot slot = null;
if (!isSelfPickup) {
    if (request.getDeliverySlotId() == null) {
        throw new IllegalArgumentException("Delivery slot is required for home delivery");
    }
    // Pessimistic Row Lock with strict tenant isolation: locks slot row for (slotId, shopId)
    if (deliverySlotRepository != null) {
        slot = deliverySlotRepository.findByIdAndShopIdWithLock(request.getDeliverySlotId(), shopId).orElse(null);
    }
    if (slot == null && shop.getDeliverySlots() != null) {
        slot = shop.getDeliverySlots().stream()
                .filter(s -> s.getId() != null && s.getId().equals(request.getDeliverySlotId())
                        && (s.getShop() == null || s.getShop().getId() == null || s.getShop().getId().equals(shopId)))
                .findFirst().orElse(null);
    }
    if (slot == null) {
        throw new IllegalArgumentException("Delivery slot not found or does not belong to this shop");
    }
    if (!Boolean.TRUE.equals(slot.getIsActive())) {
        throw new IllegalArgumentException("Selected delivery slot is currently inactive");
    }
    // Day of week check ...
    // Pessimistic capacity count & row lock check ...
}
```

### C. Frontend Adaptation in `StorefrontCheckoutTab.tsx`
```tsx
let finalSlotId = selectedSlotId;
if (effectiveFulfillmentMethod === 'HOME_DELIVERY') {
  if (timeSelectionMode === 'CUSTOM') {
    if (!customDeliveryTime.trim()) {
      setError('Please choose or enter your desired delivery time.');
      return;
    }
    finalSlotId = resolvedSlotForCustomTime?.id || selectedSlotId || applicableSlots[0]?.id || slots[0]?.id;
  } else {
    if (!selectedSlotId) {
      setError('Please select a delivery slot window.');
      return;
    }
  }

  if (!finalSlotId && slots.length > 0) {
    finalSlotId = slots[0]?.id;
  }
} else {
  // For SELF_PICKUP, delivery slot selection is optional
  if (timeSelectionMode === 'CUSTOM' && customDeliveryTime.trim()) {
    finalSlotId = resolvedSlotForCustomTime?.id || selectedSlotId || applicableSlots[0]?.id || slots[0]?.id;
  }
}
```

---

## 4. `HOME_DELIVERY` vs `SELF_PICKUP` Validation Matrix

| Behavior / Rule | `HOME_DELIVERY` | `SELF_PICKUP` |
|---|---|---|
| **`deliverySlotId` presence** | **Required** (Non-null) | **Optional** (Nullable) |
| **Bean Validation Error** | Emits violation on property `deliverySlotId` | Passes cleanly with 0 violations |
| **Service Validation Error** | Throws `IllegalArgumentException("Delivery slot is required for home delivery")` | Bypasses slot check |
| **Database Slot Query** | Queried via `findByIdAndShopIdWithLock` | **Never queried** (0 DB calls) |
| **Pessimistic Row Lock** | Enforces row lock on `shop_delivery_slots` | **No lock requested** |
| **Capacity Reservation** | Checks `countActiveOrdersForSlotAndDate < maxOrders` | **No capacity reserved** |
| **Date Validation** | Mandatory; cannot be null or past date | **Mandatory**; cannot be null or past date |
| **Delivery Address** | Mandatory street address required | Optional; auto-defaults to bakery address snapshot |
| **Geofencing / Radius** | Enforced against shop delivery config | **Bypassed** (Store pickup always allowed) |
| **Delivery Fee** | Evaluates threshold & fixed fee (e.g. ₹50 / ₹0) | **Always ₹0.00** |

---

## 5. Regression Test Results

### Dedicated Test Suite: `CustomerSelfPickupOrderValidationTest`
Command: `mvn test -Dtest=CustomerSelfPickupOrderValidationTest`  
**Results: 11 tests run, 11 passed, 0 failures, 0 errors, 0 skipped.**

| # | Test Name | Assertion Verified | Result |
|---|---|---|---|
| 1 | `testSelfPickup_WithNullDeliverySlotId_Succeeds` | Null slot ID succeeds; fulfillment = `SELF_PICKUP`; slot = null | **PASS** |
| 2 | `testSelfPickup_DoesNotReserveDeliverySlotCapacity` | Slot repo and order capacity repo are never touched | **PASS** |
| 3 | `testSelfPickup_ValidatesRequiredPickupDate` | Null date and past dates throw `IllegalArgumentException` | **PASS** |
| 4 | `testSelfPickup_DeliveryFeeRemainsZero` | Delivery fee = ₹0.00; total = subtotal | **PASS** |
| 5 | `testHomeDelivery_WithNullDeliverySlotId_IsRejected` | Null slot throws `"Delivery slot is required for home delivery"` | **PASS** |
| 6 | `testHomeDelivery_WithNonexistentSlot_IsRejected` | Nonexistent slot throws `"Delivery slot not found or does not belong to this shop"` | **PASS** |
| 7 | `testHomeDelivery_WithAnotherBakerySlot_IsRejected` | Slot from another bakery throws tenant isolation error | **PASS** |
| 8 | `testHomeDelivery_WithInactiveSlot_IsRejected` | Inactive slot throws `"Selected delivery slot is currently inactive"` | **PASS** |
| 9 | `testHomeDelivery_CapacityProtection_ThrowsWhenSlotFull` | Throws `DeliverySlotFullException` when capacity reached | **PASS** |
| 10 | `testPaymentMethods_CodAndOnlinePayment_Preserved` | COD $\rightarrow$ `NEW`, `PENDING`; Razorpay $\rightarrow$ `PAYMENT_PENDING`, `PENDING` | **PASS** |
| 11 | `testBeanValidation_ConditionalDeliverySlot` | Bean Validator yields 0 violations for pickup, 1 for delivery | **PASS** |

### Related Storefront Regression Test Suite:
Command: `mvn test -Dtest=CustomerStorefrontServiceTest,CustomerOrderIdentitySecurityTest,DeliveryFeeConsistencyRegressionTest,CustomerSelfPickupOrderValidationTest`  
**Results: 30 tests run, 30 passed, 0 failures, 0 errors, 0 skipped.**
- `CustomerStorefrontServiceTest`: 4/4 passed
- `CustomerOrderIdentitySecurityTest`: 5/5 passed
- `DeliveryFeeConsistencyRegressionTest`: 10/10 passed
- `CustomerSelfPickupOrderValidationTest`: 11/11 passed

### Frontend Automated Test Suite:
Command: `npm --prefix frontend_v2 test`  
**Results: 300 tests run across 21 test suites, 300 passed, 0 failures.**

---

## 6. Build Results

1. **Backend Maven Compilation & Test Execution**:
   - `BUILD SUCCESS`
   - Total time: 59.434 s
   - Clean compilation of all 363 main classes and 122 test classes.
2. **Frontend Typecheck & Tests**:
   - Zero errors in modified components.
   - 300/300 frontend tests passed.

---

## 7. Database and Schema Impact

- **Schema Changes**: **None (0 migrations applied, 0 DDL statements)**.
- **Database Inserts/Updates**: **None**.
- **Delivery Slots**: **0 slots created**. The database retains its clean, unmutated state.
- **Order Count for Shop 1**: **0 orders** (Verified via `SELECT COUNT(*) FROM orders WHERE shop_id = 1;` $\rightarrow$ `0`).

---

## 8. Remaining Limitations

1. **Staging Seed Data**: `seed_dev_shops.sql` still contains no delivery slots in `shop_delivery_slots`. While `SELF_PICKUP` now works seamlessly without slots, testing `HOME_DELIVERY` will require either owner dashboard slot creation or database seeding in a future phase.
2. **Operating Hours for Pickup**: Pickup timing currently relies on user date selection and optional custom time entry. An optional enhancement for future phases could validate customer pickup time against the shop's configured `shop_business_hours`.

---

## 9. Final Verdict

| Requirement | Target | Achieved Status | Verdict |
|---|---|---|---|
| **Conditional Slot Validation** | Relax for `SELF_PICKUP`, enforce for `HOME_DELIVERY` | Custom validator + dual-layer service check implemented | **PASS** |
| **No Capacity Reservation for Pickup** | Do not lock/reserve slot rows for self-pickup | Slot repository queries completely bypassed for pickup | **PASS** |
| **Date Validation Preservation** | Still validate required pickup date | Null and past dates strictly rejected | **PASS** |
| **Zero Delivery Fee Preservation** | Self-pickup delivery fee = ₹0 | Verified via both service and quote engine | **PASS** |
| **Zero DB Mutations** | No DB schema changes, inserts, or slot mutations | Verified (0 DB alterations) | **PASS** |
| **Test Verification** | Run focused backend and regression tests | 30/30 backend tests passed; 300/300 frontend tests passed | **PASS** |

**Status:** **Phase 2.8.3 Completed Successfully.** Ready for controlled staging order placement upon user approval.
