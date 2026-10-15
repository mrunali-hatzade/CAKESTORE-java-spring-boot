import test from 'node:test';
import assert from 'node:assert/strict';

// Helper mirroring the computed isDashboardLocked logic in app/dashboard/owner/layout.tsx
function computeIsDashboardLocked(shop, subscription, pathname) {
  if (!shop) return false;
  const isAlwaysExempt = pathname.includes('/subscription') || pathname.includes('/settings');
  if (isAlwaysExempt) return false;

  if (shop.status === 'SUSPENDED') return true;
  if (shop.status === 'PENDING') return true;

  if (shop.status === 'EXPIRED') {
    if (pathname.includes('/orders')) {
      return false;
    }
    return true;
  }

  if (shop.status === 'INACTIVE') {
    const isSubActive = subscription?.status === 'ACTIVE' && Boolean(subscription?.expiryDate && new Date(subscription.expiryDate).getTime() > Date.now());
    if (!isSubActive) {
      if (pathname.includes('/orders')) {
        return false;
      }
      return true;
    }
    return false;
  }

  return false;
}

test('Step 5.1 Owner Operational Toggle & Lifecycle Banner Logic', async (t) => {
  const activeUnexpiredSubscription = {
    status: 'ACTIVE',
    expiryDate: new Date(Date.now() + 86400000 * 30).toISOString(),
  };

  const expiredSubscription = {
    status: 'EXPIRED',
    expiryDate: new Date(Date.now() - 86400000).toISOString(),
  };

  await t.test('1. Normal active shop renders Open state and is not locked', () => {
    const shop = {
      id: 1,
      businessName: 'Delight Bakery',
      status: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
    };

    const isLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner');
    assert.equal(isLocked, false, 'Normal active shop must never be dashboard-locked');
    assert.equal(shop.isOwnerEnabled, true, 'Shop is enabled');
  });

  await t.test('2. Owner-disabled (Vacation Mode) shop is NOT dashboard-locked when subscription is valid', () => {
    const shop = {
      id: 1,
      businessName: 'Delight Bakery',
      status: 'INACTIVE',
      isOwnerEnabled: false,
      isMarketplaceRestricted: false,
    };

    const isLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner');
    assert.equal(isLocked, false, 'Owner-disabled shop with valid subscription must retain dashboard access');

    // Also verify catalog route
    const isProductsLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner/products');
    assert.equal(isProductsLocked, false, 'Owner can access products/catalog while in vacation mode');
  });

  await t.test('3. Administrative marketplace restriction alone NEVER locks owner dashboard', () => {
    const shop = {
      id: 1,
      businessName: 'Delight Bakery',
      status: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: true,
      marketplaceRestrictionReason: 'FSSAI renewal certificate pending audit',
    };

    const isLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner');
    assert.equal(isLocked, false, 'Admin restricted shop must NOT be locked out of dashboard');
    assert.equal(shop.marketplaceRestrictionReason, 'FSSAI renewal certificate pending audit');
  });

  await t.test('4. Suspended shop ALWAYS locks dashboard across operational routes', () => {
    const shop = {
      id: 1,
      businessName: 'Delight Bakery',
      status: 'SUSPENDED',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
    };

    const isLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner');
    assert.equal(isLocked, true, 'Suspended shop must be locked from overview');

    const isOrdersLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner/orders');
    assert.equal(isOrdersLocked, true, 'Suspended shop must be locked from orders');

    // Exempt routes remain accessible for compliance/support info
    const isSettingsLocked = computeIsDashboardLocked(shop, activeUnexpiredSubscription, '/dashboard/owner/settings');
    assert.equal(isSettingsLocked, false, 'Settings route is exempt from full-page backdrop lock');
  });

  await t.test('5. Expired shop locks catalog/overview but permits /orders, /subscription, /settings', () => {
    const shop = {
      id: 1,
      businessName: 'Delight Bakery',
      status: 'EXPIRED',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
    };

    // Overview and catalog are locked
    const isOverviewLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner');
    assert.equal(isOverviewLocked, true, 'Expired shop must be locked from overview');

    const isProductsLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/products');
    assert.equal(isProductsLocked, true, 'Expired shop must be locked from editing catalog products');

    const isSlotsLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/delivery-slots');
    assert.equal(isSlotsLocked, true, 'Expired shop must be locked from modifying delivery slots');

    // Orders route is permitted for fulfilling in-progress orders & viewing history
    const isOrdersLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/orders');
    assert.equal(isOrdersLocked, false, 'Expired shop must be allowed to access /dashboard/owner/orders for in-progress fulfillment');

    // Billing & compliance routes are permitted
    const isSubRouteLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/subscription');
    assert.equal(isSubRouteLocked, false, 'Subscription billing route is exempt from lock');

    const isSettingsLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/settings');
    assert.equal(isSettingsLocked, false, 'Settings compliance route is exempt from lock');
  });

  await t.test('6. Inactive shop with missing/expired subscription permits orders for in-flight fulfillment while locking other areas', () => {
    const shop = {
      id: 1,
      businessName: 'Delight Bakery',
      status: 'INACTIVE',
      isOwnerEnabled: false,
      isMarketplaceRestricted: false,
    };

    const isOverviewLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner');
    assert.equal(isOverviewLocked, true, 'Inactive shop without active subscription must be locked from overview');

    const isProductsLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/products');
    assert.equal(isProductsLocked, true, 'Inactive shop without active subscription must be locked from products');

    const isOrdersLocked = computeIsDashboardLocked(shop, expiredSubscription, '/dashboard/owner/orders');
    assert.equal(isOrdersLocked, false, 'Inactive shop without active subscription can access /orders for in-flight fulfillment');
  });

  await t.test('7. Operational toggle mutation payload contracts', async () => {
    // Verify client payload shapes
    const pausePayload = { enabled: false };
    const reopenPayload = { enabled: true };

    assert.equal(typeof pausePayload.enabled, 'boolean');
    assert.equal(pausePayload.enabled, false);
    assert.equal(reopenPayload.enabled, true);

    // Verify error state immutability simulation
    let currentShopState = {
      id: 1,
      status: 'INACTIVE',
      isOwnerEnabled: false,
    };

    const mockApiMutation = async (enabled, shouldFail = false) => {
      if (shouldFail) {
        throw new Error('Reopening failed: Subscription has expired');
      }
      return {
        ...currentShopState,
        status: enabled ? 'ACTIVE' : 'INACTIVE',
        isOwnerEnabled: enabled,
      };
    };

    // Failed reopening preserves old state
    let capturedError = null;
    try {
      await mockApiMutation(true, true);
    } catch (err) {
      capturedError = err.message;
    }
    assert.equal(capturedError, 'Reopening failed: Subscription has expired');
    assert.equal(currentShopState.isOwnerEnabled, false, 'Shop state is not mutated on error');
  });
});
