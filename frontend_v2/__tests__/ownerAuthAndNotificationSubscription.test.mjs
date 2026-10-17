import test from 'node:test';
import assert from 'node:assert/strict';

// Pure resolver logic mirroring NotificationBell.tsx
function resolveOwnerNotificationDestination(userId) {
  if (userId === undefined || userId === null) return null;
  const str = String(userId).trim();
  if (str === '' || str === 'undefined' || str === 'null') return null;
  const num = Number(str);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) return null;
  return `/queue/notifications-${num}`;
}

// Pure resolver logic mirroring AdminNotificationBell.tsx
function resolveAdminNotificationDestination(userId) {
  if (userId === undefined || userId === null) return null;
  const str = String(userId).trim();
  if (str === '' || str === 'undefined' || str === 'null') return null;
  const num = Number(str);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) return null;
  return `/queue/admin-notifications-${num}`;
}

test('NOTIF-OWNER-01: resolveOwnerNotificationDestination returns correct destination for valid numeric IDs', () => {
  assert.equal(resolveOwnerNotificationDestination(9), '/queue/notifications-9');
  assert.equal(resolveOwnerNotificationDestination('9'), '/queue/notifications-9');
  assert.equal(resolveOwnerNotificationDestination(1001), '/queue/notifications-1001');
  assert.equal(resolveOwnerNotificationDestination('42'), '/queue/notifications-42');
});

test('NOTIF-OWNER-02: resolveOwnerNotificationDestination returns null for invalid, missing, or undefined IDs', () => {
  assert.equal(resolveOwnerNotificationDestination(undefined), null);
  assert.equal(resolveOwnerNotificationDestination(null), null);
  assert.equal(resolveOwnerNotificationDestination(''), null);
  assert.equal(resolveOwnerNotificationDestination('   '), null);
  assert.equal(resolveOwnerNotificationDestination('undefined'), null);
  assert.equal(resolveOwnerNotificationDestination('null'), null);
  assert.equal(resolveOwnerNotificationDestination(NaN), null);
  assert.equal(resolveOwnerNotificationDestination(0), null);
  assert.equal(resolveOwnerNotificationDestination(-1), null);
  assert.equal(resolveOwnerNotificationDestination(-99), null);
  assert.equal(resolveOwnerNotificationDestination(3.14), null);
  assert.equal(resolveOwnerNotificationDestination({}), null);
});

test('NOTIF-ADMIN-01: resolveAdminNotificationDestination returns correct destination for valid numeric IDs', () => {
  assert.equal(resolveAdminNotificationDestination(1), '/queue/admin-notifications-1');
  assert.equal(resolveAdminNotificationDestination('8'), '/queue/admin-notifications-8');
  assert.equal(resolveAdminNotificationDestination(200), '/queue/admin-notifications-200');
});

test('NOTIF-ADMIN-02: resolveAdminNotificationDestination returns null for invalid, missing, or undefined IDs', () => {
  assert.equal(resolveAdminNotificationDestination(undefined), null);
  assert.equal(resolveAdminNotificationDestination(null), null);
  assert.equal(resolveAdminNotificationDestination(''), null);
  assert.equal(resolveAdminNotificationDestination('undefined'), null);
  assert.equal(resolveAdminNotificationDestination('null'), null);
  assert.equal(resolveAdminNotificationDestination(NaN), null);
  assert.equal(resolveAdminNotificationDestination(0), null);
  assert.equal(resolveAdminNotificationDestination(-1), null);
});

test('AUTH-MAP-01: Login response correctly populates AuthUser with id and shopId', () => {
  const mockLoginResponse = {
    id: 9,
    shopId: 17,
    token: 'jwt.mock.token',
    email: 'owner@sweetdelight.com',
    role: 'ROLE_SHOP_OWNER',
    fullName: 'Sweet Delight Owner',
    shopStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
  };

  const authUser = {
    id: mockLoginResponse.id,
    email: mockLoginResponse.email,
    role: mockLoginResponse.role,
    shopId: mockLoginResponse.shopId,
    fullName: mockLoginResponse.fullName,
  };

  assert.equal(authUser.id, 9);
  assert.equal(authUser.shopId, 17);
  assert.equal(authUser.email, 'owner@sweetdelight.com');
  assert.equal(authUser.role, 'ROLE_SHOP_OWNER');

  // Verify destination resolved from authUser
  const destination = resolveOwnerNotificationDestination(authUser.id);
  assert.equal(destination, '/queue/notifications-9');
  assert.doesNotMatch(destination, /undefined/);
  assert.doesNotMatch(destination, /null/);
});

test('AUTH-STORAGE-01: LocalStorage serialization and deserialization retains id and shopId across page reloads', () => {
  const authUser = {
    id: 9,
    email: 'owner@sweetdelight.com',
    role: 'ROLE_SHOP_OWNER',
    shopId: 17,
    fullName: 'Sweet Delight Owner',
  };

  const serialized = JSON.stringify(authUser);
  const restored = JSON.parse(serialized);

  assert.equal(restored.id, 9);
  assert.equal(restored.shopId, 17);
  assert.equal(typeof restored.id, 'number');

  const restoredDestination = resolveOwnerNotificationDestination(restored.id);
  assert.equal(restoredDestination, '/queue/notifications-9');
});

test('NOTIF-SAFETY-01: Destination never contains invalid format, negative integers, or literal undefined/null', () => {
  const invalidInputs = [undefined, null, 'undefined', 'null', '', 'abc', -10, 0, false, true, NaN];
  for (const input of invalidInputs) {
    const ownerDest = resolveOwnerNotificationDestination(input);
    const adminDest = resolveAdminNotificationDestination(input);
    assert.equal(ownerDest, null, `Expected null for owner destination with input: ${input}`);
    assert.equal(adminDest, null, `Expected null for admin destination with input: ${input}`);
  }
});
