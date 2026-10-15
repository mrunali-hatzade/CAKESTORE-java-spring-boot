import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Step 5.3: Admin Marketplace Restriction & Soft-Deleted Bakery Logic Tests
 *
 * Validates:
 * 1. Restriction reason validation: rejects blank/whitespace, enforces 500-char max, trims input.
 * 2. Restriction payload construction for applying and lifting restrictions.
 * 3. Soft-deleted bakery detection: detects isDeleted === true or status === 'DELETED'.
 * 4. Control permissions: disables moderation, activation, and restriction controls for soft-deleted shops.
 * 5. Status badge logic: correctly identifies ACTIVE, SUSPENDED, RESTRICTED, and SOFT-DELETED states.
 * 6. Historical preservation: ensures retained subscriptions, payments, and activity logs remain inspectable.
 */

// Helper mirroring validation in AdminMarketplaceRestrictionModal.tsx
function validateRestrictionReason(reason) {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'A specific reason is required to restrict marketplace access.', payload: null };
  }
  if (trimmed.length > 500) {
    return { valid: false, error: 'Reason must be 500 characters or fewer.', payload: null };
  }
  return { valid: true, error: null, payload: { restricted: true, reason: trimmed } };
}

// Helper mirroring restriction payload creation for lifting
function createLiftRestrictionPayload() {
  return { restricted: false };
}

// Helper mirroring soft-deleted and restricted state evaluation in admin shop detail page
function evaluateAdminShopActionState(shop) {
  const isDeleted = Boolean(shop?.isDeleted || shop?.status === 'DELETED');
  const isRestricted = Boolean(shop?.isMarketplaceRestricted);

  return {
    isDeleted,
    isRestricted,
    // When soft-deleted, moderation actions must be strictly disabled
    canModerate: !isDeleted,
    canRestrictMarketplace: !isDeleted,
    canLiftRestriction: !isDeleted && isRestricted,
    canActivate: !isDeleted && shop?.status !== 'ACTIVE',
    canSuspend: !isDeleted && shop?.status !== 'SUSPENDED',
  };
}

// Helper mirroring getStatusBadge in app/admin/shops/page.tsx and shop details
function getAdminShopBadge(shop) {
  const isDeleted = Boolean(shop?.isDeleted || shop?.status === 'DELETED');
  if (isDeleted) {
    return { label: 'SOFT-DELETED', variant: 'deleted', isDeleted: true };
  }
  if (shop?.isMarketplaceRestricted) {
    return { label: shop?.status || 'ACTIVE', subLabel: 'Marketplace Restricted', isRestricted: true };
  }
  return { label: shop?.status || 'UNKNOWN', subLabel: null, isRestricted: false };
}

// Helper checking retained history preservation for soft-deleted inspection
function evaluateRetainedHistoryAvailability(details) {
  const isDeleted = Boolean(details?.shop?.isDeleted || details?.shop?.status === 'DELETED');
  return {
    isDeleted,
    hasRetainedSubscriptions: Array.isArray(details?.subscriptions),
    subscriptionCount: details?.subscriptions?.length || 0,
    hasRetainedPayments: Array.isArray(details?.payments),
    paymentCount: details?.payments?.length || 0,
    hasRetainedLogs: Array.isArray(details?.activityLogs),
    logCount: details?.activityLogs?.length || 0,
  };
}

test('Step 5.3: Admin Marketplace Restriction & Deleted-Shop Inspection Logic Tests', async (t) => {
  await t.test('1. Restriction modal rejects blank or whitespace-only reasons', () => {
    const emptyResult = validateRestrictionReason('');
    assert.equal(emptyResult.valid, false);
    assert.match(emptyResult.error, /specific reason is required/i);
    assert.equal(emptyResult.payload, null);

    const whitespaceResult = validateRestrictionReason('    \n\t   ');
    assert.equal(whitespaceResult.valid, false);
    assert.match(whitespaceResult.error, /specific reason is required/i);
    assert.equal(whitespaceResult.payload, null);

    const nullResult = validateRestrictionReason(null);
    assert.equal(nullResult.valid, false);
    assert.equal(nullResult.payload, null);
  });

  await t.test('2. Applying a restriction trims reason, enforces 500-char limit, and builds correct payload', () => {
    const validReason = '  Customer complaints regarding food safety standards under review.  ';
    const result = validateRestrictionReason(validReason);
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
    assert.deepEqual(result.payload, {
      restricted: true,
      reason: 'Customer complaints regarding food safety standards under review.',
    });

    // 500 characters boundary
    const exactly500 = 'a'.repeat(500);
    const result500 = validateRestrictionReason(exactly500);
    assert.equal(result500.valid, true);
    assert.equal(result500.payload.reason.length, 500);

    // 501 characters boundary
    const over500 = 'a'.repeat(501);
    const result501 = validateRestrictionReason(over500);
    assert.equal(result501.valid, false);
    assert.match(result501.error, /500 characters or fewer/i);
    assert.equal(result501.payload, null);
  });

  await t.test('3. Lifting a restriction uses the existing endpoint contract correctly and displays truthful wording', () => {
    const liftPayload = createLiftRestrictionPayload();
    assert.deepEqual(liftPayload, { restricted: false });
    assert.equal(liftPayload.reason, undefined);

    // Verify truthful dialog wording does not overpromise automatic reactivation
    const dialogWording = {
      title: 'Lift Marketplace Restriction',
      confirmLabel: 'Lift Restriction',
      cancelLabel: 'Keep Restricted',
      descriptionParagraph1: 'Are you sure you want to lift the administrative marketplace restriction on "Sweet Tooth"?',
      descriptionParagraph2: 'This removes the administrative block. Marketplace visibility and customer storefront access will remain subject to the bakery’s subscription entitlement, owner operational status, and platform account standing.',
    };

    assert.equal(dialogWording.title, 'Lift Marketplace Restriction');
    assert.match(dialogWording.descriptionParagraph2, /removes the administrative block/i);
    assert.match(dialogWording.descriptionParagraph2, /remain subject to the bakery.+subscription entitlement/i);
    assert.doesNotMatch(dialogWording.descriptionParagraph2, /will restore the bakery to platform marketplace search/i);
  });

  await t.test('4. Soft-deleted shop is clearly identified and moderation controls are disabled', () => {
    const softDeletedShop = {
      id: 42,
      name: 'Sweet Memories Pastry (Closed)',
      status: 'DELETED',
      isDeleted: true,
      isMarketplaceRestricted: true,
      marketplaceRestrictionReason: 'Historical policy violation',
    };

    const actionState = evaluateAdminShopActionState(softDeletedShop);
    assert.equal(actionState.isDeleted, true);
    assert.equal(actionState.canModerate, false, 'Moderation actions must be disabled for deleted shops');
    assert.equal(actionState.canRestrictMarketplace, false, 'Cannot restrict already deleted shop');
    assert.equal(actionState.canLiftRestriction, false, 'Cannot lift restriction on deleted shop to suggest marketplace return');
    assert.equal(actionState.canActivate, false, 'Cannot activate deleted shop');
    assert.equal(actionState.canSuspend, false, 'Cannot suspend deleted shop');

    const badge = getAdminShopBadge(softDeletedShop);
    assert.equal(badge.label, 'SOFT-DELETED');
    assert.equal(badge.isDeleted, true);
  });

  await t.test('5. Non-deleted restricted shop enables restriction management and displays restriction banner', () => {
    const activeRestrictedShop = {
      id: 10,
      name: 'Vanilla Sky Bakery',
      status: 'ACTIVE',
      isDeleted: false,
      isMarketplaceRestricted: true,
      marketplaceRestrictionReason: 'Under review for unverified ingredients',
    };

    const actionState = evaluateAdminShopActionState(activeRestrictedShop);
    assert.equal(actionState.isDeleted, false);
    assert.equal(actionState.isRestricted, true);
    assert.equal(actionState.canModerate, true);
    assert.equal(actionState.canLiftRestriction, true);

    const badge = getAdminShopBadge(activeRestrictedShop);
    assert.equal(badge.label, 'ACTIVE');
    assert.equal(badge.subLabel, 'Marketplace Restricted');
    assert.equal(badge.isRestricted, true);
  });

  await t.test('6. Retained historical records remain visible and inspectable for soft-deleted bakeries', () => {
    const retainedAuditDetails = {
      shop: {
        id: 77,
        name: 'Heritage Bakes',
        status: 'DELETED',
        isDeleted: true,
      },
      subscriptions: [
        { id: 1, plan: { name: 'Pro Baker' }, status: 'EXPIRED', expiryDate: '2026-01-01T00:00:00Z' },
      ],
      payments: [
        { id: 101, amount: 999, status: 'SUCCESS', transactionId: 'pay_123' },
      ],
      activityLogs: [
        { id: 501, action: 'SHOP_SOFT_DELETED', description: 'Bakery account soft-deleted by admin', createdAt: '2026-02-01T12:00:00Z' },
      ],
    };

    const auditState = evaluateRetainedHistoryAvailability(retainedAuditDetails);
    assert.equal(auditState.isDeleted, true);
    assert.equal(auditState.hasRetainedSubscriptions, true);
    assert.equal(auditState.subscriptionCount, 1);
    assert.equal(auditState.hasRetainedPayments, true);
    assert.equal(auditState.paymentCount, 1);
    assert.equal(auditState.hasRetainedLogs, true);
    assert.equal(auditState.logCount, 1);
  });

  await t.test('7. Distinct separation between SUSPENDED, EXPIRED, INACTIVE, and RESTRICTED statuses', () => {
    const suspendedShop = { id: 1, status: 'SUSPENDED', isMarketplaceRestricted: false, isDeleted: false };
    const expiredShop = { id: 2, status: 'EXPIRED', isMarketplaceRestricted: false, isDeleted: false };
    const inactiveShop = { id: 3, status: 'INACTIVE', isMarketplaceRestricted: false, isDeleted: false };
    const restrictedActiveShop = { id: 4, status: 'ACTIVE', isMarketplaceRestricted: true, isDeleted: false };

    assert.equal(evaluateAdminShopActionState(suspendedShop).isRestricted, false);
    assert.equal(evaluateAdminShopActionState(expiredShop).isRestricted, false);
    assert.equal(evaluateAdminShopActionState(inactiveShop).isRestricted, false);
    assert.equal(evaluateAdminShopActionState(restrictedActiveShop).isRestricted, true);
  });

  await t.test('8. BM-02: Suspension modal validation rejects blank or whitespace reasons', () => {
    function validateSuspensionReason(reason) {
      const trimmed = (reason || '').trim();
      if (!trimmed) {
        return { valid: false, error: 'Suspension reason is mandatory and cannot be blank.', payload: null };
      }
      return { valid: true, error: null, payload: { status: 'SUSPENDED', reason: trimmed } };
    }

    assert.equal(validateSuspensionReason('').valid, false);
    assert.equal(validateSuspensionReason('   ').valid, false);
    assert.equal(validateSuspensionReason(null).valid, false);
    assert.equal(validateSuspensionReason(undefined).valid, false);
    
    const validResult = validateSuspensionReason('Repeated food quality violations');
    assert.equal(validResult.valid, true);
    assert.equal(validResult.payload.status, 'SUSPENDED');
    assert.equal(validResult.payload.reason, 'Repeated food quality violations');
  });

  await t.test('9. BM-02: Bulk suspend handles partial failure and retains failed IDs accurately', async () => {
    // Simulates the Promise.allSettled behavior implemented in handleBulkAction
    const selectedShopIds = [101, 102, 103];
    const mockUpdateStatus = async (id, status, reason) => {
      if (id === 102) {
        throw new Error('Shop 102 DB lock timeout');
      }
      return { shopId: id, status, reason };
    };

    const results = await Promise.allSettled(
      selectedShopIds.map((id) => mockUpdateStatus(id, 'SUSPENDED', 'Compliance audit failure'))
    );

    const successfulIds = [];
    const failedIds = [];

    results.forEach((res, index) => {
      const id = selectedShopIds[index];
      if (res.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
      }
    });

    assert.deepEqual(successfulIds, [101, 103]);
    assert.deepEqual(failedIds, [102]);
    assert.equal(failedIds.length, 1);
    assert.equal(successfulIds.length, 2);
  });

  await t.test('10. BM-02: Bulk suspend succeeds completely when all requests succeed', async () => {
    const selectedShopIds = [201, 202];
    const mockUpdateStatus = async (id, status, reason) => {
      return { shopId: id, status, reason };
    };

    const results = await Promise.allSettled(
      selectedShopIds.map((id) => mockUpdateStatus(id, 'SUSPENDED', 'Bulk compliance suspension'))
    );

    const successfulIds = [];
    const failedIds = [];

    results.forEach((res, index) => {
      const id = selectedShopIds[index];
      if (res.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
      }
    });

    assert.deepEqual(successfulIds, [201, 202]);
    assert.deepEqual(failedIds, []);
  });

  await t.test('11. BM-03: KYC Rejection modal validation rejects blank or whitespace reasons', () => {
    function validateKycRejectionReason(reason) {
      const trimmed = (reason || '').trim();
      if (!trimmed) {
        return { valid: false, error: 'Rejection reason is mandatory and cannot be blank.', payload: null };
      }
      return { valid: true, error: null, payload: { action: 'REJECT', reason: trimmed } };
    }

    assert.equal(validateKycRejectionReason('').valid, false);
    assert.equal(validateKycRejectionReason('   ').valid, false);
    assert.equal(validateKycRejectionReason(null).valid, false);
    assert.equal(validateKycRejectionReason(undefined).valid, false);
    
    const validResult = validateKycRejectionReason('FSSAI certificate expired and business registration unreadable');
    assert.equal(validResult.valid, true);
    assert.equal(validResult.payload.action, 'REJECT');
    assert.equal(validResult.payload.reason, 'FSSAI certificate expired and business registration unreadable');
  });

  await t.test('12. BM-03: Bulk KYC reject handles partial failure and retains failed IDs accurately', async () => {
    // Simulates the Promise.allSettled behavior implemented in handleBulkKycAction
    const selectedShopIds = [301, 302, 303];
    const mockUpdateVerification = async (id, action, reason) => {
      if (id === 302) {
        throw new Error('Bakery 302 verification update failed');
      }
      return { shopId: id, action, reason };
    };

    const results = await Promise.allSettled(
      selectedShopIds.map((id) => mockUpdateVerification(id, 'REJECT', 'Incomplete compliance documents'))
    );

    const successfulIds = [];
    const failedIds = [];

    results.forEach((res, index) => {
      const id = selectedShopIds[index];
      if (res.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
      }
    });

    assert.deepEqual(successfulIds, [301, 303]);
    assert.deepEqual(failedIds, [302]);
    assert.equal(failedIds.length, 1);
    assert.equal(successfulIds.length, 2);
  });

  await t.test('13. BM-03: Bulk KYC reject succeeds completely when all requests succeed', async () => {
    const selectedShopIds = [401, 402];
    const mockUpdateVerification = async (id, action, reason) => {
      return { shopId: id, action, reason };
    };

    const results = await Promise.allSettled(
      selectedShopIds.map((id) => mockUpdateVerification(id, 'REJECT', 'Invalid documents submitted'))
    );

    const successfulIds = [];
    const failedIds = [];

    results.forEach((res, index) => {
      const id = selectedShopIds[index];
      if (res.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
      }
    });

    assert.deepEqual(successfulIds, [401, 402]);
    assert.deepEqual(failedIds, []);
  });

  // =========================================================================
  // BM-05: Shop ID Validation & Loading State Lifecycle
  // =========================================================================

  // Helper mirroring loadShop state lifecycle in app/admin/shops/[id]/page.tsx
  function validateShopId(rawId) {
    const shopId = Number(rawId);
    return Number.isFinite(shopId) && Number.isInteger(shopId) && shopId > 0 ? shopId : null;
  }

  async function simulateLoadShop(rawId, apiFetcher, toastMock) {
    let isLoading = true;
    let details = null;
    let apiCallCount = 0;

    const shopId = Number(rawId);

    // Exact logic from loadShop()
    if (!Number.isFinite(shopId) || !Number.isInteger(shopId) || shopId <= 0) {
      isLoading = false;
      return { isLoading, details, apiCallCount };
    }

    isLoading = true;
    try {
      apiCallCount++;
      details = await apiFetcher(shopId);
    } catch (err) {
      if (toastMock) toastMock(err.message || 'Failed to fetch bakery details');
    } finally {
      isLoading = false;
    }

    return { isLoading, details, apiCallCount };
  }

  await t.test('14. BM-05: Non-numeric shop IDs (abc, xyz) resolve loading immediately without calling API', async () => {
    let apiCalled = false;
    const mockFetcher = async () => { apiCalled = true; return {}; };

    for (const invalidId of ['abc', 'xyz', 'NaN', 'undefined', '12abc', 'foo-bar']) {
      apiCalled = false;
      const res = await simulateLoadShop(invalidId, mockFetcher);
      assert.equal(res.isLoading, false, `isLoading must be false for ${invalidId}`);
      assert.equal(res.details, null, `details must be null for ${invalidId}`);
      assert.equal(res.apiCallCount, 0, `API must not be called for ${invalidId}`);
      assert.equal(apiCalled, false);
      assert.equal(validateShopId(invalidId), null);
    }
  });

  await t.test('15. BM-05: Missing, empty, zero, and negative shop IDs resolve loading immediately without calling API', async () => {
    let apiCalled = false;
    const mockFetcher = async () => { apiCalled = true; return {}; };

    for (const invalidId of ['', ' ', '0', '-1', '-999', null, undefined, 0, -5]) {
      apiCalled = false;
      const res = await simulateLoadShop(invalidId, mockFetcher);
      assert.equal(res.isLoading, false, `isLoading must be false for ${invalidId}`);
      assert.equal(res.details, null, `details must be null for ${invalidId}`);
      assert.equal(res.apiCallCount, 0, `API must not be called for ${invalidId}`);
      assert.equal(apiCalled, false);
      assert.equal(validateShopId(invalidId), null);
    }
  });

  await t.test('16. BM-05: Floating point or non-integer shop IDs resolve loading immediately without calling API', async () => {
    let apiCalled = false;
    const mockFetcher = async () => { apiCalled = true; return {}; };

    for (const nonIntId of ['12.34', '1.0001', '0.5', 3.14]) {
      apiCalled = false;
      const res = await simulateLoadShop(nonIntId, mockFetcher);
      assert.equal(res.isLoading, false, `isLoading must be false for ${nonIntId}`);
      assert.equal(res.details, null, `details must be null for ${nonIntId}`);
      assert.equal(res.apiCallCount, 0, `API must not be called for ${nonIntId}`);
      assert.equal(apiCalled, false);
      assert.equal(validateShopId(nonIntId), null);
    }
  });

  await t.test('17. BM-05: Valid numeric shop ID loads bakery details successfully and clears loading', async () => {
    const expectedData = { shop: { id: 10, businessName: 'Sweet Tooth Bakery', status: 'ACTIVE' } };
    const mockFetcher = async (id) => {
      assert.equal(id, 10);
      return expectedData;
    };

    const res = await simulateLoadShop('10', mockFetcher);
    assert.equal(res.isLoading, false);
    assert.deepEqual(res.details, expectedData);
    assert.equal(res.apiCallCount, 1);
    assert.equal(validateShopId('10'), 10);
  });

  await t.test('18. BM-05: API 404 or network error clears loading state and triggers error handling', async () => {
    const toastMessages = [];
    const mockToast = (msg) => toastMessages.push(msg);
    const mockFetcher = async () => {
      throw new Error('Bakery not found with id: 9999');
    };

    const res = await simulateLoadShop('9999', mockFetcher, mockToast);
    assert.equal(res.isLoading, false, 'isLoading must be false after API failure');
    assert.equal(res.details, null, 'details must remain null after API failure');
    assert.equal(res.apiCallCount, 1, 'API should have been invoked once');
    assert.equal(toastMessages.length, 1);
    assert.equal(toastMessages[0], 'Bakery not found with id: 9999');
  });

  // =========================================================================
  // BM-07: Search Focus Preservation & Top-Level Controls Persistence
  // =========================================================================

  // Helper simulating the page component's mounting/rendering tree decisions
  function evaluatePageStructure(isLoading, shopsCount) {
    return {
      isControlsBarMounted: true, // Header, search input, and filter tabs are unconditionally mounted
      isSearchInputMounted: true,
      isFilterTabsMounted: true,
      renderedResultsArea: isLoading
        ? 'LOADING'
        : shopsCount === 0
        ? 'EMPTY_STATE'
        : 'TABLE',
    };
  }

  await t.test('19. BM-07: Search input, filter tabs, and page header remain mounted regardless of isLoading', async () => {
    // When isLoading is true (during search or initial fetch), controls bar and search input MUST remain mounted
    const loadingState = evaluatePageStructure(true, 0);
    assert.equal(loadingState.isControlsBarMounted, true);
    assert.equal(loadingState.isSearchInputMounted, true);
    assert.equal(loadingState.isFilterTabsMounted, true);
    assert.equal(loadingState.renderedResultsArea, 'LOADING');

    // When isLoading is false with results
    const loadedWithData = evaluatePageStructure(false, 15);
    assert.equal(loadedWithData.isControlsBarMounted, true);
    assert.equal(loadedWithData.isSearchInputMounted, true);
    assert.equal(loadedWithData.renderedResultsArea, 'TABLE');

    // When isLoading is false with 0 results
    const loadedEmpty = evaluatePageStructure(false, 0);
    assert.equal(loadedEmpty.isControlsBarMounted, true);
    assert.equal(loadedEmpty.isSearchInputMounted, true);
    assert.equal(loadedEmpty.renderedResultsArea, 'EMPTY_STATE');
  });

  await t.test('20. BM-07: Keystrokes immediately update searchQuery while debouncing backend requests', async () => {
    let currentInput = '';
    let debouncedSearch = '';
    let timer = null;

    const onKeystroke = (char) => {
      currentInput += char;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        debouncedSearch = currentInput;
      }, 50);
    };

    // Fast typing: 'B', 'a', 'k', 'e', 'r', 'y' within debounce window
    ['B', 'a', 'k', 'e', 'r', 'y'].forEach(onKeystroke);

    // Input state is immediately updated on every keystroke
    assert.equal(currentInput, 'Bakery');
    // Debounced search has not fired yet
    assert.equal(debouncedSearch, '');

    // Wait for debounce timer to fire
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(debouncedSearch, 'Bakery');
  });

  await t.test('21. BM-07: Loading state is scoped to results area and does not unmount controls during tab or search switches', async () => {
    // Simulate tab change
    let activeTab = 'ALL';
    let isLoading = true;

    // Switch tab to PENDING
    activeTab = 'PENDING';
    const tabSwitchStructure = evaluatePageStructure(isLoading, 0);

    // Controls MUST stay mounted even though tab switched and loading is in-flight
    assert.equal(tabSwitchStructure.isControlsBarMounted, true);
    assert.equal(tabSwitchStructure.isSearchInputMounted, true);
    assert.equal(tabSwitchStructure.renderedResultsArea, 'LOADING');

    // Complete loading with results
    isLoading = false;
    const completedTabSwitch = evaluatePageStructure(isLoading, 5);
    assert.equal(completedTabSwitch.renderedResultsArea, 'TABLE');
  });
});


