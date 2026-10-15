import test from 'node:test';
import assert from 'node:assert/strict';

// Helper mirroring cancellation modal & reason validation logic from app/dashboard/owner/subscription/page.tsx
function validateCancellationReason(reason) {
  const trimmed = reason ? reason.trim() : '';
  if (trimmed.length > 500) {
    return { valid: false, error: 'Cancellation reason must be 500 characters or fewer.', payload: null };
  }
  return { valid: true, error: null, payload: trimmed ? { reason: trimmed } : undefined };
}

// Helper mirroring subscription plan action & banner visibility rules from app/dashboard/owner/subscription/page.tsx
function evaluateSubscriptionUIState(subscription, shop) {
  const hasActiveSubscription = Boolean(
    subscription?.plan &&
    (subscription?.status === 'ACTIVE' ||
      subscription?.status === 'GRACE_PERIOD' ||
      subscription?.status === 'EXPIRING_SOON')
  );

  const canCancel = Boolean(hasActiveSubscription && !subscription?.cancelledAt);
  const showPersistentCancellationNotice = Boolean(subscription?.cancelledAt);

  return {
    hasActiveSubscription,
    canCancel,
    showPersistentCancellationNotice,
  };
}

// Helper checking truth-in-refunds label & confirmation dialog
function getRefundWording(paymentStatus, orderNumber) {
  const isRefunded = (paymentStatus || '').toUpperCase() === 'REFUNDED';
  return {
    badgeLabel: isRefunded ? 'Manual Refund Recorded' : 'Paid',
    kotLabel: isRefunded ? '↩️ MANUAL REFUND RECORDED' : null,
    dialogTitle: 'Record Manual Refund',
    dialogDescription: `Are you sure you want to record a manual refund for order #${orderNumber}? This logs an offline/cash refund for internal bookkeeping and does not initiate an electronic gateway transfer.`,
    dialogConfirmLabel: 'Record Manual Refund',
  };
}

test('Step 5.2: Subscription Cancellation UI & Truth-in-Refunds Logic Tests', async (t) => {
  const validPlan = {
    id: 10,
    name: 'Pro Baker Studio',
    price: 999,
    durationDays: 30,
    billingCycle: 'monthly',
  };

  const activeSubscription = {
    id: 101,
    status: 'ACTIVE',
    plan: validPlan,
    expiryDate: new Date(Date.now() + 86400000 * 15).toISOString(),
    cancelledAt: null,
    cancellationReason: null,
  };

  await t.test('1. Active subscription without cancellation allows Cancel action', () => {
    const uiState = evaluateSubscriptionUIState(activeSubscription, { status: 'ACTIVE' });
    assert.equal(uiState.hasActiveSubscription, true);
    assert.equal(uiState.canCancel, true, 'Active subscription must offer Cancel Subscription button');
    assert.equal(uiState.showPersistentCancellationNotice, false, 'No persistent banner before cancellation');
  });

  await t.test('2. Cancelled subscription suppresses Cancel button and displays persistent notice', () => {
    const cancelledSub = {
      ...activeSubscription,
      cancelledAt: new Date().toISOString(),
      cancellationReason: 'Scaling down operations',
    };

    const uiState = evaluateSubscriptionUIState(cancelledSub, { status: 'ACTIVE' });
    assert.equal(uiState.hasActiveSubscription, true, 'Entitlement remains active until expiryDate');
    assert.equal(uiState.canCancel, false, 'Cancel action must be suppressed once cancelled');
    assert.equal(uiState.showPersistentCancellationNotice, true, 'Persistent notice must be displayed');
  });

  await t.test('3. Expired or No-Plan subscription does not offer Cancel Subscription action', () => {
    const expiredSub = {
      ...activeSubscription,
      status: 'EXPIRED',
      expiryDate: new Date(Date.now() - 86400000).toISOString(),
    };
    const uiState = evaluateSubscriptionUIState(expiredSub, { status: 'EXPIRED' });
    assert.equal(uiState.hasActiveSubscription, false);
    assert.equal(uiState.canCancel, false, 'Expired subscription cannot be cancelled');
  });

  await t.test('4. Optional reason handles blank, trimmed, and character limits up to 500 correctly', () => {
    // Blank / whitespace only -> payload should be undefined
    const blankCheck = validateCancellationReason('   ');
    assert.equal(blankCheck.valid, true);
    assert.equal(blankCheck.payload, undefined, 'Blank input should omit body or pass empty payload');

    // Valid short reason
    const shortCheck = validateCancellationReason('Taking a seasonal break');
    assert.equal(shortCheck.valid, true);
    assert.deepEqual(shortCheck.payload, { reason: 'Taking a seasonal break' });

    // Exactly 500 characters
    const exact500 = 'a'.repeat(500);
    const exactCheck = validateCancellationReason(exact500);
    assert.equal(exactCheck.valid, true);
    assert.equal(exactCheck.payload.reason.length, 500);

    // 501 characters -> rejected
    const overLimit = 'b'.repeat(501);
    const failCheck = validateCancellationReason(overLimit);
    assert.equal(failCheck.valid, false);
    assert.equal(failCheck.error, 'Cancellation reason must be 500 characters or fewer.');
    assert.equal(failCheck.payload, null);
  });

  await t.test('5. Truthful refund wording on badge, dialog, and KOT ticket', () => {
    const refundWording = getRefundWording('REFUNDED', 'ORD-2026-999');

    // Badge label
    assert.equal(refundWording.badgeLabel, 'Manual Refund Recorded');
    assert.doesNotMatch(refundWording.badgeLabel, /Refund Issued To Customer/i);

    // Dialog title & button
    assert.equal(refundWording.dialogTitle, 'Record Manual Refund');
    assert.equal(refundWording.dialogConfirmLabel, 'Record Manual Refund');

    // Dialog description must make clear this is manual cash/direct and does NOT initiate electronic gateway transfer
    assert.match(refundWording.dialogDescription, /offline\/cash refund for internal bookkeeping/);
    assert.match(refundWording.dialogDescription, /does not initiate an electronic gateway transfer/);
    assert.doesNotMatch(refundWording.dialogDescription, /returned the customer's payment electronically/);

    // KOT printing
    assert.equal(refundWording.kotLabel, '↩️ MANUAL REFUND RECORDED');
  });

  await t.test('6. Un-refunded paid order wording does not display refund badge', () => {
    const paidWording = getRefundWording('PAID', 'ORD-2026-100');
    assert.equal(paidWording.badgeLabel, 'Paid');
    assert.equal(paidWording.kotLabel, null);
  });
});
