import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching proposed page.tsx mapping logic
function resolveSubscriptionDetails(sub) {
  if (!sub) {
    return {
      planTitle: 'No Active Plan',
      quickPlanTitle: 'Starter Bakery',
      amountDisplay: '—',
      startDateDisplay: '—',
      expiryDateDisplay: '—',
      daysLeft: null,
      isExpired: false,
    };
  }

  const planTitle = sub.plan?.name || sub.planName || 'No Active Plan';
  const quickPlanTitle = sub.plan?.name || sub.planName || 'Starter Bakery';
  const amountDisplay = sub.amount ? `₹${sub.amount} / billing cycle` : '—';
  const expiryRaw = sub.expiryDate || sub.endDate;
  const startRaw = sub.startDate;

  const startDateDisplay = startRaw ? new Date(startRaw).toLocaleDateString('en-IN') : '—';
  const expiryDateDisplay = expiryRaw ? new Date(expiryRaw).toLocaleDateString('en-IN') : '—';

  let daysLeft = null;
  let isExpired = false;
  if (expiryRaw) {
    daysLeft = Math.ceil((new Date(expiryRaw).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    isExpired = daysLeft < 0;
  }

  return { planTitle, quickPlanTitle, amountDisplay, startDateDisplay, expiryDateDisplay, daysLeft, isExpired };
}

test('PS-D01: Subscription mapping correctly binds entity structure (plan.name, expiryDate)', () => {
  const entityResponse = {
    id: 101,
    plan: { id: 10, name: 'Pro Baker Studio', price: 999 },
    amount: 999,
    startDate: '2026-10-01T00:00:00',
    expiryDate: '2026-11-01T00:00:00',
    status: 'ACTIVE'
  };

  const res = resolveSubscriptionDetails(entityResponse);
  assert.equal(res.planTitle, 'Pro Baker Studio');
  assert.equal(res.quickPlanTitle, 'Pro Baker Studio');
  assert.equal(res.amountDisplay, '₹999 / billing cycle');
  assert.notEqual(res.expiryDateDisplay, '—');
  assert.ok(typeof res.daysLeft === 'number');
});

test('PS-D01: Subscription mapping preserves backward-compatibility with flat structure (planName, endDate)', () => {
  const flatResponse = {
    id: 102,
    planName: 'Growth Baker Tier',
    amount: 1499,
    startDate: '2026-09-01T00:00:00',
    endDate: '2026-10-01T00:00:00',
    status: 'EXPIRED'
  };

  const res = resolveSubscriptionDetails(flatResponse);
  assert.equal(res.planTitle, 'Growth Baker Tier');
  assert.equal(res.quickPlanTitle, 'Growth Baker Tier');
  assert.equal(res.amountDisplay, '₹1499 / billing cycle');
  assert.notEqual(res.expiryDateDisplay, '—');
});

test('PS-D01: Null or empty subscription falls back to default empty state', () => {
  const res = resolveSubscriptionDetails(null);
  assert.equal(res.planTitle, 'No Active Plan');
  assert.equal(res.quickPlanTitle, 'Starter Bakery');
  assert.equal(res.amountDisplay, '—');
  assert.equal(res.startDateDisplay, '—');
  assert.equal(res.expiryDateDisplay, '—');
  assert.equal(res.daysLeft, null);
});
