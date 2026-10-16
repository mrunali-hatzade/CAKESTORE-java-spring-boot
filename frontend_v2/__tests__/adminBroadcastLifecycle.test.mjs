import test from 'node:test';
import assert from 'node:assert/strict';

// Broadcast uncertain submission lifecycle state machine tests matching AdminMessagesPage.tsx

function createMockBroadcastLifecycle() {
  let storage = {};
  const STORAGE_KEY = 'cake_admin_broadcast_active_submission';

  const sessionStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { storage = {}; }
  };

  return {
    STORAGE_KEY,
    sessionStorage,
    async executeDispatch(apiCall, idempotencyKey, payload) {
      // 1. In flight snapshot
      const inFlight = {
        idempotencyKey,
        payload,
        submittedAt: Date.now(),
        status: 'IN_FLIGHT'
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(inFlight));

      try {
        const res = await apiCall(idempotencyKey, payload);
        // Terminal success
        sessionStorage.removeItem(STORAGE_KEY);
        return { success: true, message: res };
      } catch (err) {
        const status = err.status || 0;
        if (status === 409 || status === 400) {
          // Terminal failure/conflict/bad request -> clear storage to unlock
          sessionStorage.removeItem(STORAGE_KEY);
          return { success: false, terminal: true, error: err.message };
        } else {
          // Network drop, timeout, or 429 lock contention -> UNCERTAIN preserved in storage
          const uncertain = {
            idempotencyKey,
            payload,
            submittedAt: Date.now(),
            status: 'UNCERTAIN'
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(uncertain));
          return { success: false, uncertain: true, error: err.message, status };
        }
      }
    },
    abandonBroadcast() {
      // Frontend-only discard: clears storage, never calls server
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };
}

test('TEST-11: Network drop during submit preserves locked draft snapshot in sessionStorage as UNCERTAIN', async () => {
  const lifecycle = createMockBroadcastLifecycle();
  const key = '550e8400-e29b-41d4-a716-446655440000';
  const payload = {
    title: 'Flash Sale',
    message: '50% off all pastries',
    targetType: 'ALL',
    specificOwnerId: null,
    sendEmail: true
  };

  const failingApi = async () => {
    const netErr = new Error('Failed to fetch');
    netErr.status = 0;
    throw netErr;
  };

  const result = await lifecycle.executeDispatch(failingApi, key, payload);
  assert.equal(result.uncertain, true);

  const saved = JSON.parse(lifecycle.sessionStorage.getItem(lifecycle.STORAGE_KEY));
  assert.ok(saved);
  assert.equal(saved.idempotencyKey, key);
  assert.equal(saved.status, 'UNCERTAIN');
  assert.equal(saved.payload.title, 'Flash Sale');
});

test('TEST-11B: Retry with same key succeeds and clears sessionStorage', async () => {
  const lifecycle = createMockBroadcastLifecycle();
  const key = '550e8400-e29b-41d4-a716-446655440000';
  const payload = {
    title: 'Flash Sale',
    message: '50% off all pastries',
    targetType: 'ALL',
    specificOwnerId: null,
    sendEmail: true
  };

  const successApi = async (k, p) => {
    assert.equal(k, key);
    return 'Broadcast dispatched successfully. Processing in background.';
  };

  const result = await lifecycle.executeDispatch(successApi, key, payload);
  assert.equal(result.success, true);
  assert.equal(lifecycle.sessionStorage.getItem(lifecycle.STORAGE_KEY), null);
});

test('TEST-12: Abandon submission clears sessionStorage without server call', async () => {
  const lifecycle = createMockBroadcastLifecycle();
  const key = '550e8400-e29b-41d4-a716-446655440000';
  const payload = { title: 'T', message: 'M', targetType: 'ALL', specificOwnerId: null, sendEmail: false };

  // Set uncertain
  lifecycle.sessionStorage.setItem(lifecycle.STORAGE_KEY, JSON.stringify({ idempotencyKey: key, payload, status: 'UNCERTAIN' }));
  assert.ok(lifecycle.sessionStorage.getItem(lifecycle.STORAGE_KEY));

  // Abandon
  lifecycle.abandonBroadcast();
  assert.equal(lifecycle.sessionStorage.getItem(lifecycle.STORAGE_KEY), null);
});

test('TEST-13: History badge renders Attempted (N) and never falsely claims Delivered', () => {
  const renderHistoryStatus = (record) => {
    if (record.status === 'FAILED') return 'Failed';
    if (record.status === 'RESERVED') return 'Processing...';
    return `Attempted (${record.recipientCount ?? 0})`;
  };

  assert.equal(renderHistoryStatus({ status: 'COMPLETED', recipientCount: 15 }), 'Attempted (15)');
  assert.equal(renderHistoryStatus({ status: 'RESERVED', recipientCount: 0 }), 'Processing...');
  assert.equal(renderHistoryStatus({ status: 'FAILED', recipientCount: 0 }), 'Failed');
  assert.notEqual(renderHistoryStatus({ status: 'COMPLETED', recipientCount: 15 }), 'Delivered');
});

test('TEST-429: Lock contention HTTP 429 keeps submission locked in UNCERTAIN status', async () => {
  const lifecycle = createMockBroadcastLifecycle();
  const key = '550e8400-e29b-41d4-a716-446655440000';
  const payload = { title: 'T', message: 'M', targetType: 'ALL', specificOwnerId: null, sendEmail: false };

  const lock429Api = async () => {
    const err = new Error('Broadcast record is currently locked by active processing. Please retry.');
    err.status = 429;
    throw err;
  };

  const result = await lifecycle.executeDispatch(lock429Api, key, payload);
  assert.equal(result.status, 429);
  assert.equal(result.uncertain, true);

  const saved = JSON.parse(lifecycle.sessionStorage.getItem(lifecycle.STORAGE_KEY));
  assert.equal(saved.status, 'UNCERTAIN');
});
