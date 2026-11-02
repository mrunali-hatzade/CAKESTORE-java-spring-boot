import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Frontend PIN code validation utility matching DeliverySettingsSection.tsx
 */
function validateServiceablePincodes(val) {
  if (!val || !val.trim()) return { valid: true, error: null, tokens: [] };
  const tokens = val.split(/[,;\s\n]+/).map((t) => t.trim()).filter(Boolean);
  const invalidToken = tokens.find((t) => !/^[1-9][0-9]{5}$/.test(t));
  if (invalidToken) {
    return {
      valid: false,
      error: `"${invalidToken}" is not a valid 6-digit Indian PIN code.`,
      tokens,
    };
  }
  return { valid: true, error: null, tokens };
}

/**
 * Frontend delivery radius validation utility matching DeliverySettingsSection.tsx
 */
function validateDeliveryRadius(val) {
  if (val === '' || val === null || val === undefined) {
    return { valid: true, radius: null }; // Unrestricted
  }
  const num = Number(val);
  if (isNaN(num) || num < 0.1 || num > 100) {
    return { valid: false, error: 'Radius must be between 0.1 and 100 km.' };
  }
  return { valid: true, radius: num };
}

/**
 * Checkout eligibility simulation matching StorefrontCheckoutTab.tsx
 */
function evaluateCheckoutEligibility({
  quoteResponse,
  fulfillmentMethod = 'HOME_DELIVERY',
}) {
  const isPickup = fulfillmentMethod === 'SELF_PICKUP' || fulfillmentMethod === 'STORE_PICKUP';

  // Store pickup is always permitted
  if (isPickup) {
    return {
      allowed: true,
      error: null,
      effectiveFulfillmentMethod: 'SELF_PICKUP',
    };
  }

  // Home delivery checks quote eligibility
  if (quoteResponse && quoteResponse.canDeliver === false) {
    return {
      allowed: false,
      error: quoteResponse.rejectionReason || "This address is outside this bakery's delivery area. You can choose store pickup if available.",
      effectiveFulfillmentMethod: 'HOME_DELIVERY',
    };
  }

  return {
    allowed: true,
    error: null,
    effectiveFulfillmentMethod: 'HOME_DELIVERY',
  };
}

test('CakeStore Phase 2.1: Delivery Zone Geofencing & Service Area Tests', async (t) => {
  await t.test('1. Owner PIN code validation: Rejects invalid tokens', () => {
    const res = validateServiceablePincodes('411035, abc, 123');
    assert.equal(res.valid, false);
    assert.match(res.error, /"abc" is not a valid 6-digit Indian PIN code/);
  });

  await t.test('2. Owner PIN code validation: Accepts valid comma-separated PIN codes', () => {
    const res = validateServiceablePincodes('411035, 411033, 411019');
    assert.equal(res.valid, true);
    assert.equal(res.error, null);
    assert.deepEqual(res.tokens, ['411035', '411033', '411019']);
  });

  await t.test('3. Owner delivery radius validation: Accepts valid km and handles unrestricted null', () => {
    assert.deepEqual(validateDeliveryRadius('10.5'), { valid: true, radius: 10.5 });
    assert.deepEqual(validateDeliveryRadius(''), { valid: true, radius: null });
    assert.equal(validateDeliveryRadius('-5').valid, false);
    assert.equal(validateDeliveryRadius('150').valid, false);
  });

  await t.test('4. Checkout: Quote rejection blocks home delivery and displays reason', () => {
    const res = evaluateCheckoutEligibility({
      quoteResponse: {
        canDeliver: false,
        rejectionReason: "This address is outside this bakery's delivery area.",
      },
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(res.allowed, false);
    assert.equal(res.error, "This address is outside this bakery's delivery area.");
  });

  await t.test('5. Checkout: Store pickup succeeds even when quote flags delivery outside area', () => {
    const res = evaluateCheckoutEligibility({
      quoteResponse: {
        canDeliver: false,
        rejectionReason: "This address is outside this bakery's delivery area.",
      },
      fulfillmentMethod: 'SELF_PICKUP',
    });

    assert.equal(res.allowed, true);
    assert.equal(res.error, null);
    assert.equal(res.effectiveFulfillmentMethod, 'SELF_PICKUP');
  });

  await t.test('6. Legacy shops: Allowed when quote does not flag restrictions', () => {
    const res = evaluateCheckoutEligibility({
      quoteResponse: {
        canDeliver: true,
        rejectionReason: null,
      },
      fulfillmentMethod: 'HOME_DELIVERY',
    });

    assert.equal(res.allowed, true);
    assert.equal(res.error, null);
  });
});

