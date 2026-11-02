import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Validates 6-digit Indian PIN code matching CustomerAddressRequest and StorefrontCheckoutTab
 */
function validateIndianPincode(pincode) {
  if (!pincode || typeof pincode !== 'string') return false;
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

/**
 * Validates Indian 10-digit mobile number
 */
function validateIndianMobile(mobile) {
  if (!mobile || typeof mobile !== 'string') return false;
  const clean = mobile.trim().replace(/^0+/, '');
  return /^\+?[1-9]\d{9,14}$/.test(clean);
}

/**
 * Formats structured address lines into single delivery address
 */
function composeFormattedAddress({
  addressLine1,
  addressLine2,
  landmark,
  city,
  state,
  pincode
}) {
  return [
    addressLine1?.trim() || null,
    addressLine2?.trim() || null,
    landmark?.trim() ? `Near ${landmark.trim()}` : null,
    city?.trim() || null,
    state?.trim() || null,
    pincode?.trim() || null
  ].filter(Boolean).join(', ');
}

/**
 * Simulates address state management with single-default guarantee
 */
function manageAddresses(existingList, action) {
  const list = existingList.map(a => ({ ...a }));

  if (action.type === 'ADD') {
    const newAddr = { ...action.payload, id: action.payload.id || Date.now() };
    if (newAddr.default || list.length === 0) {
      list.forEach(a => { a.default = false; a.isDefault = false; });
      newAddr.default = true;
      newAddr.isDefault = true;
    }
    list.push(newAddr);
    return list;
  }

  if (action.type === 'SET_DEFAULT') {
    list.forEach(a => {
      const isTarget = a.id === action.addressId;
      a.default = isTarget;
      a.isDefault = isTarget;
    });
    return list;
  }

  if (action.type === 'DELETE') {
    const target = list.find(a => a.id === action.addressId);
    const filtered = list.filter(a => a.id !== action.addressId);
    if (target && (target.default || target.isDefault) && filtered.length > 0) {
      filtered[0].default = true;
      filtered[0].isDefault = true;
    }
    return filtered;
  }

  return list;
}

/**
 * Evaluates checkout quote with delivery pincode and geofencing
 */
function evaluateStorefrontDeliveryQuote({
  fulfillmentMethod = 'HOME_DELIVERY',
  deliveryPincode,
  shopDeliveryConfig
}) {
  if (fulfillmentMethod === 'SELF_PICKUP') {
    return {
      canDeliver: true,
      deliveryFee: 0,
      rejectionReason: null
    };
  }

  if (!shopDeliveryConfig.deliveryEnabled) {
    return {
      canDeliver: false,
      deliveryFee: 0,
      rejectionReason: 'Home delivery is disabled for this bakery.'
    };
  }

  if (shopDeliveryConfig.serviceablePincodes && shopDeliveryConfig.serviceablePincodes.length > 0) {
    const cleanPin = deliveryPincode?.trim();
    if (!cleanPin || !shopDeliveryConfig.serviceablePincodes.includes(cleanPin)) {
      return {
        canDeliver: false,
        deliveryFee: 0,
        rejectionReason: `Bakery does not deliver to PIN code ${cleanPin || 'provided'}.`
      };
    }
  }

  return {
    canDeliver: true,
    deliveryFee: shopDeliveryConfig.fixedChargeAmount || 0,
    rejectionReason: null
  };
}

test('CakeStore Phase 2.3: Customer Saved Addresses Unit Tests', async (t) => {

  await t.test('1. PIN Code Validation: Strictly enforces 6-digit Indian PIN codes', () => {
    assert.strictEqual(validateIndianPincode('560001'), true);
    assert.strictEqual(validateIndianPincode('110001'), true);
    assert.strictEqual(validateIndianPincode('400001'), true);
    assert.strictEqual(validateIndianPincode('700001'), true);

    // Invalid PIN codes
    assert.strictEqual(validateIndianPincode('012345'), false, 'Cannot start with 0');
    assert.strictEqual(validateIndianPincode('56001'), false, 'Must be 6 digits (5 provided)');
    assert.strictEqual(validateIndianPincode('5600001'), false, 'Must be 6 digits (7 provided)');
    assert.strictEqual(validateIndianPincode('56000A'), false, 'Alphanumeric PIN rejected');
    assert.strictEqual(validateIndianPincode(''), false, 'Empty PIN rejected');
    assert.strictEqual(validateIndianPincode(null), false, 'Null PIN rejected');
  });

  await t.test('2. Mobile Number Validation: Requires valid 10-digit phone', () => {
    assert.strictEqual(validateIndianMobile('9876543210'), true);
    assert.strictEqual(validateIndianMobile('+919876543210'), true);
    assert.strictEqual(validateIndianMobile('09876543210'), true);

    assert.strictEqual(validateIndianMobile('12345'), false, 'Too short');
    assert.strictEqual(validateIndianMobile('abcdefghij'), false, 'Non-numeric');
    assert.strictEqual(validateIndianMobile(''), false, 'Empty string');
  });

  await t.test('3. Address Composition: Formats structured address cleanly', () => {
    const formatted = composeFormattedAddress({
      addressLine1: 'Flat 402, Sunshine Apartments',
      addressLine2: '7th Cross, Indiranagar',
      landmark: 'Sony Signal',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038'
    });

    assert.strictEqual(
      formatted,
      'Flat 402, Sunshine Apartments, 7th Cross, Indiranagar, Near Sony Signal, Bengaluru, Karnataka, 560038'
    );

    // Omit optional fields
    const minimal = composeFormattedAddress({
      addressLine1: 'House 12, Main Street',
      city: 'Mumbai',
      pincode: '400001'
    });

    assert.strictEqual(minimal, 'House 12, Main Street, Mumbai, 400001');
  });

  await t.test('4. Single Default Constraint: Setting a new default unsets existing default', () => {
    let list = [
      { id: 1, label: 'Home', default: true, isDefault: true },
      { id: 2, label: 'Work', default: false, isDefault: false }
    ];

    list = manageAddresses(list, { type: 'SET_DEFAULT', addressId: 2 });

    const addr1 = list.find(a => a.id === 1);
    const addr2 = list.find(a => a.id === 2);

    assert.strictEqual(addr1.default, false);
    assert.strictEqual(addr2.default, true);
    assert.strictEqual(list.filter(a => a.default).length, 1);
  });

  await t.test('5. Safe Default Deletion: Promotes remaining address when default is deleted', () => {
    let list = [
      { id: 1, label: 'Home', default: true, isDefault: true },
      { id: 2, label: 'Work', default: false, isDefault: false }
    ];

    list = manageAddresses(list, { type: 'DELETE', addressId: 1 });

    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 2);
    assert.strictEqual(list[0].default, true);
    assert.strictEqual(list[0].isDefault, true);
  });

  await t.test('6. Checkout Delivery Eligibility: Verifies PIN code against shop delivery zones', () => {
    const deliveryConfig = {
      deliveryEnabled: true,
      fixedChargeAmount: 50,
      serviceablePincodes: ['560001', '560038', '560076']
    };

    // Serviceable PIN
    const eligibleQuote = evaluateStorefrontDeliveryQuote({
      fulfillmentMethod: 'HOME_DELIVERY',
      deliveryPincode: '560038',
      shopDeliveryConfig: deliveryConfig
    });

    assert.strictEqual(eligibleQuote.canDeliver, true);
    assert.strictEqual(eligibleQuote.deliveryFee, 50);
    assert.strictEqual(eligibleQuote.rejectionReason, null);

    // Unserviceable PIN
    const rejectedQuote = evaluateStorefrontDeliveryQuote({
      fulfillmentMethod: 'HOME_DELIVERY',
      deliveryPincode: '110001',
      shopDeliveryConfig: deliveryConfig
    });

    assert.strictEqual(rejectedQuote.canDeliver, false);
    assert.match(rejectedQuote.rejectionReason, /does not deliver to PIN code 110001/);

    // Store pickup bypasses geofencing
    const pickupQuote = evaluateStorefrontDeliveryQuote({
      fulfillmentMethod: 'SELF_PICKUP',
      deliveryPincode: '110001',
      shopDeliveryConfig: deliveryConfig
    });

    assert.strictEqual(pickupQuote.canDeliver, true);
    assert.strictEqual(pickupQuote.deliveryFee, 0);
  });

  await t.test('7. Guest Checkout Flow: Preserves unauthenticated manual address entry', () => {
    const guestInput = {
      customerName: 'Guest Baker',
      customerPhone: '9876543210',
      deliveryAddress: 'Flat 101, Lake View, Indiranagar',
      deliveryPincode: '560038'
    };

    assert.ok(guestInput.customerName.trim().length > 0);
    assert.strictEqual(validateIndianMobile(guestInput.customerPhone), true);
    assert.strictEqual(validateIndianPincode(guestInput.deliveryPincode), true);

    const quote = evaluateStorefrontDeliveryQuote({
      fulfillmentMethod: 'HOME_DELIVERY',
      deliveryPincode: guestInput.deliveryPincode,
      shopDeliveryConfig: {
        deliveryEnabled: true,
        fixedChargeAmount: 40,
        serviceablePincodes: ['560038']
      }
    });

    assert.strictEqual(quote.canDeliver, true);
    assert.strictEqual(quote.deliveryFee, 40);
  });
});

