import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 2 Unit Tests: Accurate Bakery Status Labels & Storefront Availability Logic
 *
 * Validates:
 * 1. Fully operational shop (ACTIVE, sub ACTIVE, isOwnerEnabled true, not restricted, not deleted) -> STORE LIVE
 * 2. Expired subscription -> STORE OFFLINE, subReason: EXPIRED
 * 3. Missing/None subscription -> STORE OFFLINE, subReason: NONE
 * 4. Inactive/Cancelled/Suspended subscription -> STORE OFFLINE
 * 5. Owner-disabled (vacation) shop -> STORE OFFLINE, paused by owner
 * 6. Admin-restricted shop -> STORE OFFLINE, marketplace restricted
 * 7. Multiple simultaneous restrictions -> STORE OFFLINE, all reasons present
 * 8. Suspended shop -> SUSPENDED badge
 * 9. Pending shop -> PENDING badge
 * 10. Soft-deleted shop -> SOFT-DELETED badge
 * 11. Missing/null operational flags -> conservative evaluation (never false-positive live)
 * 12. Storefront preview/view action button label & tooltip mapping
 */

// Mirroring the pure logic in BakeryStatusBadge.tsx
function computeStorefrontAvailability(props) {
  const status = (props?.shopStatus || 'UNKNOWN').toUpperCase();
  const isDeleted = Boolean(props?.isDeleted || status === 'DELETED');
  const subStatus = (props?.subscriptionStatus || 'NONE').toUpperCase();
  const isSubActive = subStatus === 'ACTIVE';
  const isOwnerOn = props?.isOwnerEnabled === true;
  const isRestricted = Boolean(props?.isMarketplaceRestricted);

  const isStoreLive =
    !isDeleted &&
    status === 'ACTIVE' &&
    isSubActive &&
    isOwnerOn &&
    !isRestricted;

  return {
    isStoreLive,
    isDeleted,
    status,
    subStatus,
    isOwnerOn,
    isRestricted,
  };
}

function getBadgeViewModel(props) {
  const avail = computeStorefrontAvailability(props);

  if (avail.isDeleted) {
    return {
      primaryBadge: 'SOFT-DELETED',
      variant: 'deleted',
      isLive: false,
      reasons: [],
    };
  }

  if (avail.status === 'SUSPENDED') {
    return {
      primaryBadge: 'Suspended',
      variant: 'error',
      isLive: false,
      reasons: [],
    };
  }

  if (avail.status === 'PENDING' || avail.status === 'PENDING_APPROVAL') {
    return {
      primaryBadge: 'Pending Approval',
      variant: 'warning',
      isLive: false,
      reasons: [],
    };
  }

  if (avail.status === 'REJECTED') {
    return {
      primaryBadge: 'Rejected',
      variant: 'default',
      isLive: false,
      reasons: [],
    };
  }

  if (avail.status === 'ACTIVE') {
    if (avail.isStoreLive) {
      return {
        primaryBadge: 'ACTIVE • STORE LIVE',
        variant: 'live',
        isLive: true,
        reasons: [],
      };
    }

    const reasons = [];
    if (avail.isRestricted) reasons.push('Marketplace Restricted');
    if (avail.subStatus !== 'ACTIVE') reasons.push(`Sub: ${avail.subStatus}`);
    if (!avail.isOwnerOn) reasons.push('Paused by Owner');

    return {
      primaryBadge: 'ACTIVE • STORE OFFLINE',
      variant: 'offline',
      isLive: false,
      reasons,
    };
  }

  return {
    primaryBadge: avail.status,
    variant: 'default',
    isLive: false,
    reasons: [],
  };
}

function getStorefrontActionModel(props) {
  const avail = computeStorefrontAvailability(props);
  return {
    label: avail.isStoreLive ? 'View Storefront' : 'Preview Storefront',
    tooltip: avail.isStoreLive
      ? 'Open live customer storefront in new tab'
      : 'Storefront currently unavailable to customers (Admin preview will show offline state)',
    isLive: avail.isStoreLive,
  };
}

test('Bakery Status Label & Storefront Availability Logic', async (t) => {
  await t.test('1. Fully operational shop renders ACTIVE • STORE LIVE', () => {
    const shop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE LIVE');
    assert.equal(badge.variant, 'live');
    assert.equal(badge.isLive, true);
    assert.equal(badge.reasons.length, 0);

    const action = getStorefrontActionModel(shop);
    assert.equal(action.label, 'View Storefront');
    assert.equal(action.isLive, true);
  });

  await t.test('2. Active shop with expired subscription renders ACTIVE • STORE OFFLINE and Sub: EXPIRED reason', () => {
    const shop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'EXPIRED',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE OFFLINE');
    assert.equal(badge.variant, 'offline');
    assert.equal(badge.isLive, false);
    assert.deepEqual(badge.reasons, ['Sub: EXPIRED']);

    const action = getStorefrontActionModel(shop);
    assert.equal(action.label, 'Preview Storefront');
    assert.equal(action.isLive, false);
  });

  await t.test('3. Active shop with missing/NONE subscription renders ACTIVE • STORE OFFLINE and Sub: NONE reason', () => {
    const shop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: null,
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE OFFLINE');
    assert.equal(badge.isLive, false);
    assert.deepEqual(badge.reasons, ['Sub: NONE']);
  });

  await t.test('4. Active shop with cancelled or suspended subscription renders ACTIVE • STORE OFFLINE', () => {
    const cancelledShop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'CANCELLED',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badgeCancelled = getBadgeViewModel(cancelledShop);
    assert.equal(badgeCancelled.isLive, false);
    assert.deepEqual(badgeCancelled.reasons, ['Sub: CANCELLED']);

    const suspendedSubShop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'SUSPENDED',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badgeSuspendedSub = getBadgeViewModel(suspendedSubShop);
    assert.equal(badgeSuspendedSub.isLive, false);
    assert.deepEqual(badgeSuspendedSub.reasons, ['Sub: SUSPENDED']);
  });

  await t.test('5. Owner-disabled (vacation mode) active shop renders ACTIVE • STORE OFFLINE with Paused by Owner reason', () => {
    const shop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: false,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE OFFLINE');
    assert.equal(badge.isLive, false);
    assert.deepEqual(badge.reasons, ['Paused by Owner']);

    const action = getStorefrontActionModel(shop);
    assert.equal(action.label, 'Preview Storefront');
  });

  await t.test('6. Admin-restricted active shop renders ACTIVE • STORE OFFLINE with Marketplace Restricted reason', () => {
    const shop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: true,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE OFFLINE');
    assert.equal(badge.isLive, false);
    assert.deepEqual(badge.reasons, ['Marketplace Restricted']);

    const action = getStorefrontActionModel(shop);
    assert.equal(action.label, 'Preview Storefront');
  });

  await t.test('7. Multiple simultaneous restrictions display all sub-reasons under ACTIVE • STORE OFFLINE', () => {
    const shop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'EXPIRED',
      isOwnerEnabled: false,
      isMarketplaceRestricted: true,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE OFFLINE');
    assert.equal(badge.isLive, false);
    assert.equal(badge.reasons.includes('Marketplace Restricted'), true);
    assert.equal(badge.reasons.includes('Sub: EXPIRED'), true);
    assert.equal(badge.reasons.includes('Paused by Owner'), true);
    assert.equal(badge.reasons.length, 3);
  });

  await t.test('8. Suspended shop renders Suspended badge regardless of flags', () => {
    const shop = {
      shopStatus: 'SUSPENDED',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'Suspended');
    assert.equal(badge.variant, 'error');
    assert.equal(badge.isLive, false);
  });

  await t.test('9. Pending shop renders Pending Approval badge regardless of flags', () => {
    const shop = {
      shopStatus: 'PENDING',
      subscriptionStatus: 'NONE',
      isOwnerEnabled: false,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    const badge = getBadgeViewModel(shop);
    assert.equal(badge.primaryBadge, 'Pending Approval');
    assert.equal(badge.variant, 'warning');
    assert.equal(badge.isLive, false);
  });

  await t.test('10. Soft-deleted shop renders SOFT-DELETED badge using isDeleted or DELETED status', () => {
    const deletedByStatus = {
      shopStatus: 'DELETED',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: false,
    };
    assert.equal(getBadgeViewModel(deletedByStatus).primaryBadge, 'SOFT-DELETED');

    const deletedByFlag = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
      isDeleted: true,
    };
    assert.equal(getBadgeViewModel(deletedByFlag).primaryBadge, 'SOFT-DELETED');
  });

  await t.test('11. Missing or null operational flags evaluate conservatively (never infer storefront is live)', () => {
    const nullFlagsShop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: null,
      isOwnerEnabled: null,
      isMarketplaceRestricted: null,
      isDeleted: null,
    };
    const badge = getBadgeViewModel(nullFlagsShop);
    assert.equal(badge.isLive, false);
    assert.equal(badge.primaryBadge, 'ACTIVE • STORE OFFLINE');

    const emptyShop = {};
    const badgeEmpty = getBadgeViewModel(emptyShop);
    assert.equal(badgeEmpty.isLive, false);
  });

  await t.test('12. Storefront preview/view action button label & tooltip mapping', () => {
    const liveShop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
    };
    const liveAction = getStorefrontActionModel(liveShop);
    assert.equal(liveAction.label, 'View Storefront');
    assert.equal(liveAction.tooltip, 'Open live customer storefront in new tab');

    const offlineShop = {
      shopStatus: 'ACTIVE',
      subscriptionStatus: 'EXPIRED',
      isOwnerEnabled: true,
      isMarketplaceRestricted: false,
    };
    const offlineAction = getStorefrontActionModel(offlineShop);
    assert.equal(offlineAction.label, 'Preview Storefront');
    assert.equal(
      offlineAction.tooltip,
      'Storefront currently unavailable to customers (Admin preview will show offline state)'
    );
  });
});
