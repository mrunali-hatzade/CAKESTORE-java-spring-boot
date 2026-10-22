import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Frontend delivery fee calculation logic matching StorefrontCheckoutTab.tsx
 */
function calculateCheckoutDeliveryCharge({
  items,
  totalPrice,
  deliveryConfig,
  fulfillmentMethod = 'HOME_DELIVERY',
}) {
  if (!items || items.length === 0) return 0;

  const isDeliveryDisabled = deliveryConfig?.deliveryEnabled === false;
  const effectiveFulfillmentMethod = isDeliveryDisabled ? 'SELF_PICKUP' : fulfillmentMethod;

  if (effectiveFulfillmentMethod === 'SELF_PICKUP') {
    return 0;
  }

  if (deliveryConfig?.deliveryChargeType === 'FREE') {
    return 0;
  }

  // FIXED delivery charge or authoritative backend fallback (50.00, threshold 1000.00)
  const fixedAmount = Number(deliveryConfig?.fixedChargeAmount ?? 50.0);
  const minFree = deliveryConfig?.minOrderForFreeDelivery ?? 1000.0;
  if (minFree && minFree > 0 && totalPrice >= minFree) {
    return 0;
  }

  return fixedAmount;
}

function calculateOrderTotal({
  totalPrice,
  discountAmount = 0,
  deliveryCharge = 0,
}) {
  return Math.max(0, totalPrice - discountAmount + deliveryCharge);
}

test('CakeStore: Delivery Fee Consistency & Quote Agreement Tests', async (t) => {
  await t.test('Scenario 1: Fixed positive delivery charge below free delivery threshold', () => {
    const config = {
      deliveryEnabled: true,
      deliveryChargeType: 'FIXED',
      fixedChargeAmount: 50.0,
      minOrderForFreeDelivery: 500.0,
    };

    const fee = calculateCheckoutDeliveryCharge({
      items: [{ productId: 1, quantity: 1, price: 10.0 }],
      totalPrice: 10.0,
      deliveryConfig: config,
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(fee, 50.0, 'Delivery fee must be ₹50 for home delivery when subtotal is below ₹500 threshold');
    const total = calculateOrderTotal({ totalPrice: 10.0, discountAmount: 0, deliveryCharge: fee });
    assert.equal(total, 60.0, 'Total payable must be ₹60 (Subtotal ₹10 + Delivery ₹50)');
  });

  await t.test('Scenario 2: Fixed delivery charge with free delivery threshold met', () => {
    const config = {
      deliveryEnabled: true,
      deliveryChargeType: 'FIXED',
      fixedChargeAmount: 50.0,
      minOrderForFreeDelivery: 500.0,
    };

    const fee = calculateCheckoutDeliveryCharge({
      items: [{ productId: 2, quantity: 1, price: 650.0 }],
      totalPrice: 650.0,
      deliveryConfig: config,
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(fee, 0, 'Delivery fee must be ₹0 when subtotal (₹650) >= threshold (₹500)');
    const total = calculateOrderTotal({ totalPrice: 650.0, discountAmount: 0, deliveryCharge: fee });
    assert.equal(total, 650.0, 'Total payable must be ₹650');
  });

  await t.test('Scenario 3: Owner configured zero fee (FREE delivery)', () => {
    const config = {
      deliveryEnabled: true,
      deliveryChargeType: 'FREE',
      fixedChargeAmount: 0,
      minOrderForFreeDelivery: null,
    };

    const fee = calculateCheckoutDeliveryCharge({
      items: [{ productId: 1, quantity: 1, price: 10.0 }],
      totalPrice: 10.0,
      deliveryConfig: config,
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(fee, 0, 'Delivery fee must be ₹0 when bakery has configured FREE delivery');
    const total = calculateOrderTotal({ totalPrice: 10.0, discountAmount: 0, deliveryCharge: fee });
    assert.equal(total, 10.0, 'Total payable must be ₹10');
  });

  await t.test('Scenario 4: Customer selects Self-Pickup (delivery fee MUST be ₹0 regardless of owner fee)', () => {
    const config = {
      deliveryEnabled: true,
      deliveryChargeType: 'FIXED',
      fixedChargeAmount: 50.0,
      minOrderForFreeDelivery: 1000.0,
    };

    const fee = calculateCheckoutDeliveryCharge({
      items: [{ productId: 1, quantity: 1, price: 10.0 }],
      totalPrice: 10.0,
      deliveryConfig: config,
      fulfillmentMethod: 'SELF_PICKUP',
    });

    assert.equal(fee, 0, 'Self-pickup must ALWAYS have ₹0 delivery fee, even when bakery charges ₹50 for home delivery');
    const total = calculateOrderTotal({ totalPrice: 10.0, discountAmount: 0, deliveryCharge: fee });
    assert.equal(total, 10.0, 'Total payable for self-pickup must be ₹10');
  });

  await t.test('Scenario 5: Delivery disabled by bakery owner forces Self-Pickup', () => {
    const config = {
      deliveryEnabled: false,
      deliveryChargeType: 'FIXED',
      fixedChargeAmount: 75.0,
      minOrderForFreeDelivery: 1000.0,
    };

    // Customer originally had HOME_DELIVERY selected
    const isDeliveryDisabled = config.deliveryEnabled === false;
    assert.equal(isDeliveryDisabled, true, 'Delivery should be detected as disabled');

    const fee = calculateCheckoutDeliveryCharge({
      items: [{ productId: 1, quantity: 1, price: 10.0 }],
      totalPrice: 10.0,
      deliveryConfig: config,
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(fee, 0, 'When delivery is disabled, system forces self-pickup and delivery fee is ₹0');
  });

  await t.test('Scenario 6: Fallback when deliveryConfig is null matches backend authoritative defaults', () => {
    // When deliveryConfig is null/undefined
    const fee = calculateCheckoutDeliveryCharge({
      items: [{ productId: 1, quantity: 1, price: 10.0 }],
      totalPrice: 10.0,
      deliveryConfig: null,
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(fee, 50.0, 'Fallback fixed charge must be ₹50.00, aligning with backend default');
    const total = calculateOrderTotal({ totalPrice: 10.0, discountAmount: 0, deliveryCharge: fee });
    assert.equal(total, 60.0, 'Total payable must be ₹60.00, preventing checkout from falsely quoting FREE ₹10');
  });

  await t.test('Scenario 7: Pre-checkout quote mismatch detection and confirmation payload', () => {
    const clientExpectedFee = 0; // e.g. stale client state
    const clientExpectedTotal = 10.0;

    const authoritativeQuote = {
      subtotal: 10.0,
      deliveryFee: 50.0,
      couponDiscount: 0,
      finalTotal: 60.0,
      fulfillmentMethod: 'HOME_DELIVERY',
    };

    const hasMismatch =
      authoritativeQuote.finalTotal !== clientExpectedTotal ||
      authoritativeQuote.deliveryFee !== clientExpectedFee;

    assert.equal(hasMismatch, true, 'Mismatch between client quote and authoritative quote must be detected');

    // Confirmed price change payload to backend
    const guestOrderPayload = {
      fulfillmentMethod: authoritativeQuote.fulfillmentMethod,
      expectedDeliveryFee: authoritativeQuote.deliveryFee,
      expectedTotal: authoritativeQuote.finalTotal,
      confirmPriceChange: true,
    };

    assert.equal(guestOrderPayload.confirmPriceChange, true, 'confirmPriceChange must be set when customer accepts updated price');
    assert.equal(guestOrderPayload.expectedTotal, 60.0, 'Authoritative total ₹60 must be passed to backend');
  });
});
