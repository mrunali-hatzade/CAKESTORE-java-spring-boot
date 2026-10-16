import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching adminNotifications.ts implementation
function createMockAdminNotificationsApi(mockApiClient) {
  return {
    async getNotifications(params) {
      return await mockApiClient.get('/api/admin/notifications', { params });
    },
    async getUnreadCount() {
      try {
        const res = await mockApiClient.get('/api/admin/notifications/unread-count');
        return res.unreadCount ?? 0;
      } catch {
        return 0;
      }
    },
    async markAsRead(id) {
      await mockApiClient.patch(`/api/admin/notifications/${id}/read`, {});
    },
    async markAllAsRead() {
      await mockApiClient.post('/api/admin/notifications/mark-all-read', {});
    },
  };
}

// WebSocket URL resolver matching AdminNotificationBell.tsx
function resolveWebSocketEndpoint(envApiUrl) {
  const baseUrl = (envApiUrl || 'http://localhost:8080').replace(/\/$/, '');
  return `${baseUrl}/ws-endpoint`;
}

// Command palette Enter resolver matching AdminCommandPalette.tsx
function resolveCommandPaletteEnterAction(item, query) {
  if (item._type === 'shortcut') return item.href;
  if (item._type === 'shop') return `/admin/shops/${item.id}`;
  if (item._type === 'feedback') return `/admin/feedback?search=${encodeURIComponent(item.subject || query)}`;
  if (item._type === 'enquiry') return `/admin/enquiries?search=${encodeURIComponent(item.subject || query)}`;
  if (item._type === 'notification') return `/admin/notifications?search=${encodeURIComponent(item.title || query)}`;
  return `/admin/shops?search=${encodeURIComponent(query.trim())}`;
}

test('NOTIF-01: markAsRead propagates HTTP 500/403/404 errors without swallowing them', async () => {
  const failingClient = {
    async patch(url) {
      const err = new Error('Access Denied');
      err.status = 403;
      err.response = { status: 403, data: { error: 'Unauthorized to mark notification ID 1003 as read' } };
      throw err;
    },
  };

  const api = createMockAdminNotificationsApi(failingClient);

  await assert.rejects(
    async () => {
      await api.markAsRead('1003');
    },
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.response.data.error, 'Unauthorized to mark notification ID 1003 as read');
      return true;
    }
  );
});

test('NOTIF-01: markAsRead propagates HTTP 404 when notification is not found', async () => {
  const failingClient = {
    async patch(url) {
      const err = new Error('Not Found');
      err.status = 404;
      err.response = { status: 404, data: { error: 'Notification not found with ID: 9999' } };
      throw err;
    },
  };

  const api = createMockAdminNotificationsApi(failingClient);

  await assert.rejects(
    async () => {
      await api.markAsRead('9999');
    },
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.response.data.error, 'Notification not found with ID: 9999');
      return true;
    }
  );
});

test('NOTIF-01: markAllAsRead propagates HTTP 500 server errors without fabricating success', async () => {
  const failingClient = {
    async post(url) {
      const err = new Error('Internal Server Error');
      err.status = 500;
      err.response = { status: 500, data: { message: 'Database transaction deadlock' } };
      throw err;
    },
  };

  const api = createMockAdminNotificationsApi(failingClient);

  await assert.rejects(
    async () => {
      await api.markAllAsRead();
    },
    (err) => {
      assert.equal(err.status, 500);
      assert.equal(err.response.data.message, 'Database transaction deadlock');
      return true;
    }
  );
});

test('NOTIF-01: markAsRead and markAllAsRead succeed cleanly upon HTTP 200 OK', async () => {
  let patchCalled = null;
  let postCalled = null;
  const successClient = {
    async patch(url) {
      patchCalled = url;
      return { success: true };
    },
    async post(url) {
      postCalled = url;
      return { success: true };
    },
  };

  const api = createMockAdminNotificationsApi(successClient);

  await api.markAsRead('1002');
  assert.equal(patchCalled, '/api/admin/notifications/1002/read');

  await api.markAllAsRead();
  assert.equal(postCalled, '/api/admin/notifications/mark-all-read');
});

test('NOTIF-07: getUnreadCount returns integer count directly from lightweight endpoint', async () => {
  let requestedUrl = null;
  const mockClient = {
    async get(url) {
      requestedUrl = url;
      return { unreadCount: 14 };
    },
  };

  const api = createMockAdminNotificationsApi(mockClient);
  const count = await api.getUnreadCount();

  assert.equal(requestedUrl, '/api/admin/notifications/unread-count');
  assert.equal(count, 14);
});

test('NOTIF-04: resolveWebSocketEndpoint correctly resolves URLs across environments', () => {
  // Local default fallback
  assert.equal(resolveWebSocketEndpoint(undefined), 'http://localhost:8080/ws-endpoint');
  assert.equal(resolveWebSocketEndpoint(''), 'http://localhost:8080/ws-endpoint');

  // HTTPS Production URL with and without trailing slash
  assert.equal(
    resolveWebSocketEndpoint('https://api.cakestore.in'),
    'https://api.cakestore.in/ws-endpoint'
  );
  assert.equal(
    resolveWebSocketEndpoint('https://api.cakestore.in/'),
    'https://api.cakestore.in/ws-endpoint'
  );

  // Staging / preview environments
  assert.equal(
    resolveWebSocketEndpoint('https://staging-api.cakestore.internal:8443'),
    'https://staging-api.cakestore.internal:8443/ws-endpoint'
  );
});

test('NOTIF-06: resolveCommandPaletteEnterAction handles notification search routing', () => {
  const notifItem = {
    _type: 'notification',
    id: '1001',
    title: 'New Bakery Approval: Sweet Treats',
  };
  const route = resolveCommandPaletteEnterAction(notifItem, 'Sweet');
  assert.equal(route, '/admin/notifications?search=New%20Bakery%20Approval%3A%20Sweet%20Treats');

  // Fallback to query if title is missing
  const notifNoTitle = {
    _type: 'notification',
    id: '1002',
  };
  const routeFallback = resolveCommandPaletteEnterAction(notifNoTitle, 'Payment Failed');
  assert.equal(routeFallback, '/admin/notifications?search=Payment%20Failed');

  // Verify other item types remain unaffected
  assert.equal(
    resolveCommandPaletteEnterAction({ _type: 'shortcut', href: '/admin/shops' }, ''),
    '/admin/shops'
  );
  assert.equal(
    resolveCommandPaletteEnterAction({ _type: 'shop', id: '42' }, ''),
    '/admin/shops/42'
  );
  assert.equal(
    resolveCommandPaletteEnterAction({ _type: 'feedback', subject: 'Slow loading' }, 'Slow'),
    '/admin/feedback?search=Slow%20loading'
  );
  assert.equal(
    resolveCommandPaletteEnterAction({ _type: 'enquiry', subject: 'Custom cake' }, 'Custom'),
    '/admin/enquiries?search=Custom%20cake'
  );
});
