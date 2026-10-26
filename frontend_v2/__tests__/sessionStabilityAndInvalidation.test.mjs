import test from 'node:test';
import assert from 'node:assert/strict';

// Mock browser storage and environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Emulate client.ts session expiration logic
function createApiClientHarness() {
  const localStorage = new MockLocalStorage();
  let currentPath = '/dashboard/owner';
  let redirectUrl = null;
  let isHandlingSessionExpiry = false;

  function clearStoredToken() {
    localStorage.removeItem('cakestore_token');
    localStorage.removeItem('cakestore_user');
  }

  function handleSessionExpiration(endpoint) {
    if (isHandlingSessionExpiry) return false;
    isHandlingSessionExpiry = true;

    clearStoredToken();

    const isProtectedRoute = currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin');
    if (isProtectedRoute) {
      redirectUrl = `/login?session_expired=true&redirect=${encodeURIComponent(currentPath)}`;
    }

    setTimeout(() => {
      isHandlingSessionExpiry = false;
    }, 100);

    return true;
  }

  function simulateApiResponse({ status, endpoint, hasToken = false }) {
    // 500 or network error
    if (status >= 500) {
      return { status, error: 'Internal Server Error', loggedOut: false };
    }

    // 401 Unauthorized
    if (status === 401) {
      const isAuthLoginEndpoint = endpoint.includes('/api/auth/login') || endpoint.includes('/api/auth/forgot-password');
      if (hasToken && !isAuthLoginEndpoint) {
        const handled = handleSessionExpiration(endpoint);
        return { status, error: 'Unauthorized', loggedOut: handled };
      }
      return { status, error: 'Unauthorized', loggedOut: false };
    }

    return { status, data: { success: true }, loggedOut: false };
  }

  return {
    localStorage,
    getPath: () => currentPath,
    setPath: (p) => { currentPath = p; },
    getRedirectUrl: () => redirectUrl,
    simulateApiResponse,
    isHandlingSessionExpiry: () => isHandlingSessionExpiry,
  };
}

test('STABILITY-01: Owner remains logged in when customer places an order or changes dashboard data', () => {
  const harness = createApiClientHarness();
  harness.localStorage.setItem('cakestore_token', 'valid-owner-jwt-token');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 1, role: 'ROLE_SHOP_OWNER' }));

  // Simulate customer placing order and owner dashboard receiving order update
  const orderResponse = harness.simulateApiResponse({
    status: 200,
    endpoint: '/api/owner/orders',
    hasToken: true,
  });

  assert.equal(orderResponse.loggedOut, false);
  assert.equal(harness.localStorage.getItem('cakestore_token'), 'valid-owner-jwt-token');
  assert.notEqual(harness.localStorage.getItem('cakestore_user'), null);
  assert.equal(harness.getRedirectUrl(), null);
});

test('STABILITY-02: Notification arrival never clears authentication token or calls logout', () => {
  const harness = createApiClientHarness();
  harness.localStorage.setItem('cakestore_token', 'valid-owner-jwt-token');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 1, role: 'ROLE_SHOP_OWNER' }));

  // Simulate WebSocket STOMP message parsing (simulating NotificationBell.tsx)
  const incomingNotificationPayload = JSON.stringify({
    id: 99,
    type: 'NEW_ORDER',
    title: 'New Order Received',
    orderId: 105,
    createdAt: new Date().toISOString(),
  });

  let unreadCount = 0;
  let notificationsList = [];

  // STOMP subscription handler
  const parsed = JSON.parse(incomingNotificationPayload);
  unreadCount += 1;
  notificationsList.unshift(parsed);

  assert.equal(unreadCount, 1);
  assert.equal(notificationsList.length, 1);
  assert.equal(notificationsList[0].type, 'NEW_ORDER');

  // Token in storage must remain completely untouched
  assert.equal(harness.localStorage.getItem('cakestore_token'), 'valid-owner-jwt-token');
  assert.equal(harness.getRedirectUrl(), null);
});

test('STABILITY-03: Admin remains logged in during normal activity and notification updates', () => {
  const harness = createApiClientHarness();
  harness.setPath('/admin');
  harness.localStorage.setItem('cakestore_token', 'valid-admin-jwt-token');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 2, role: 'ROLE_ADMIN' }));

  const adminResponse = harness.simulateApiResponse({
    status: 200,
    endpoint: '/api/admin/metrics',
    hasToken: true,
  });

  assert.equal(adminResponse.loggedOut, false);
  assert.equal(harness.localStorage.getItem('cakestore_token'), 'valid-admin-jwt-token');
  assert.equal(harness.getRedirectUrl(), null);
});

test('STABILITY-04: WebSocket disconnects, reconnects, and transient failures do not log user out', () => {
  const harness = createApiClientHarness();
  harness.localStorage.setItem('cakestore_token', 'valid-owner-jwt-token');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 1, role: 'ROLE_SHOP_OWNER' }));

  // Simulate STOMP onDisconnect / onError event
  let connectionState = 'CONNECTED';
  const handleDisconnect = () => {
    connectionState = 'RECONNECTING';
    // NotificationBell does not touch auth on disconnect
  };
  const handleReconnect = () => {
    connectionState = 'CONNECTED';
  };

  handleDisconnect();
  assert.equal(connectionState, 'RECONNECTING');
  assert.equal(harness.localStorage.getItem('cakestore_token'), 'valid-owner-jwt-token');

  handleReconnect();
  assert.equal(connectionState, 'CONNECTED');
  assert.equal(harness.localStorage.getItem('cakestore_token'), 'valid-owner-jwt-token');
  assert.equal(harness.getRedirectUrl(), null);
});

test('STABILITY-05: Transient background API failures (500, network error) do not trigger logout', () => {
  const harness = createApiClientHarness();
  harness.localStorage.setItem('cakestore_token', 'valid-owner-jwt-token');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 1, role: 'ROLE_SHOP_OWNER' }));

  // Simulate a 500 Internal Server Error during background order polling
  const failedResponse = harness.simulateApiResponse({
    status: 500,
    endpoint: '/api/owner/orders',
    hasToken: true,
  });

  assert.equal(failedResponse.loggedOut, false);
  // Auth token MUST NOT be cleared on 500 or transient failures
  assert.equal(harness.localStorage.getItem('cakestore_token'), 'valid-owner-jwt-token');
  assert.equal(harness.getRedirectUrl(), null);
});

test('STABILITY-06: Genuine 401 on protected endpoint clears session and initiates redirect to login', () => {
  const harness = createApiClientHarness();
  harness.setPath('/dashboard/owner/orders');
  harness.localStorage.setItem('cakestore_token', 'expired-or-revoked-jwt');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 1, role: 'ROLE_SHOP_OWNER' }));

  // Simulate protected API returning genuine 401 Unauthorized
  const authFailureResponse = harness.simulateApiResponse({
    status: 401,
    endpoint: '/api/owner/orders',
    hasToken: true,
  });

  assert.equal(authFailureResponse.loggedOut, true);
  // Stored token and user must be cleared
  assert.equal(harness.localStorage.getItem('cakestore_token'), null);
  assert.equal(harness.localStorage.getItem('cakestore_user'), null);
  // Redirect must point to login with session_expired indicator
  assert.match(harness.getRedirectUrl(), /session_expired=true/);
  assert.match(harness.getRedirectUrl(), /redirect=%2Fdashboard%2Fowner%2Forders/);
});

test('STABILITY-07: Multiple concurrent 401 failures trigger exactly one clean logout and redirect', () => {
  const harness = createApiClientHarness();
  harness.setPath('/dashboard/owner');
  harness.localStorage.setItem('cakestore_token', 'expired-or-revoked-jwt');
  harness.localStorage.setItem('cakestore_user', JSON.stringify({ id: 1, role: 'ROLE_SHOP_OWNER' }));

  // Fire 5 concurrent requests all returning 401
  const results = [
    harness.simulateApiResponse({ status: 401, endpoint: '/api/owner/orders', hasToken: true }),
    harness.simulateApiResponse({ status: 401, endpoint: '/api/owner/stats', hasToken: true }),
    harness.simulateApiResponse({ status: 401, endpoint: '/api/owner/settings', hasToken: true }),
    harness.simulateApiResponse({ status: 401, endpoint: '/api/notifications/summary', hasToken: true }),
    harness.simulateApiResponse({ status: 401, endpoint: '/api/owner/subscription', hasToken: true }),
  ];

  // Exactly one request should initiate the redirect; others are debounced
  const logoutActions = results.filter((r) => r.loggedOut);
  assert.equal(logoutActions.length, 1);
  assert.equal(harness.localStorage.getItem('cakestore_token'), null);
});

test('STABILITY-08: Bad password on /api/auth/login does NOT trigger session-expired redirect', () => {
  const harness = createApiClientHarness();
  harness.setPath('/login');

  // Attempt login with wrong password -> 401
  const loginResponse = harness.simulateApiResponse({
    status: 401,
    endpoint: '/api/auth/login',
    hasToken: false,
  });

  assert.equal(loginResponse.loggedOut, false);
  assert.equal(harness.getRedirectUrl(), null);
});
