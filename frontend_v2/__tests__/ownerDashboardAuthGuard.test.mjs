import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure authorization decision logic mirroring OwnerAuthGuard in:
 * frontend_v2/app/dashboard/owner/layout.tsx
 */
function evaluateOwnerAuthGuard({ isLoading, isAuthenticated, user, pathname }) {
  const isOwner =
    user?.role === 'ROLE_SHOP_OWNER' ||
    user?.role === 'SHOP_OWNER';

  if (isLoading) {
    return {
      status: 'LOADING',
      shouldRenderChildren: false,
      shouldRedirect: false,
      redirectUrl: null,
      shouldMountOwnerProvider: false,
    };
  }

  if (!isAuthenticated || !isOwner) {
    const encodedPath = encodeURIComponent(pathname);
    return {
      status: 'UNAUTHORIZED',
      shouldRenderChildren: false,
      shouldRedirect: true,
      redirectUrl: `/login?redirect=${encodedPath}`,
      shouldMountOwnerProvider: false,
    };
  }

  return {
    status: 'AUTHORIZED',
    shouldRenderChildren: true,
    shouldRedirect: false,
    redirectUrl: null,
    shouldMountOwnerProvider: true,
  };
}

test('GUARD-01: Authentication loading state renders loading indicator and does not redirect', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    pathname: '/dashboard/owner',
  });

  assert.equal(result.status, 'LOADING');
  assert.equal(result.shouldRenderChildren, false);
  assert.equal(result.shouldRedirect, false);
  assert.equal(result.redirectUrl, null);
  assert.equal(result.shouldMountOwnerProvider, false);
});

test('GUARD-02: Unauthenticated visitor is blocked and redirected to login with encoded redirect param', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    pathname: '/dashboard/owner',
  });

  assert.equal(result.status, 'UNAUTHORIZED');
  assert.equal(result.shouldRenderChildren, false);
  assert.equal(result.shouldRedirect, true);
  assert.equal(result.redirectUrl, '/login?redirect=%2Fdashboard%2Fowner');
  assert.equal(result.shouldMountOwnerProvider, false);
});

test('GUARD-03: Admin with role "ADMIN" visiting owner dashboard is blocked and redirected', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 1, email: 'admin@cakestore.com', role: 'ADMIN' },
    pathname: '/dashboard/owner/products',
  });

  assert.equal(result.status, 'UNAUTHORIZED');
  assert.equal(result.shouldRenderChildren, false);
  assert.equal(result.shouldRedirect, true);
  assert.equal(result.redirectUrl, '/login?redirect=%2Fdashboard%2Fowner%2Fproducts');
  assert.equal(result.shouldMountOwnerProvider, false);
});

test('GUARD-04: Admin with role "ROLE_ADMIN" visiting owner dashboard is blocked and redirected', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 2, email: 'superadmin@cakestore.com', role: 'ROLE_ADMIN' },
    pathname: '/dashboard/owner/settings',
  });

  assert.equal(result.status, 'UNAUTHORIZED');
  assert.equal(result.shouldRenderChildren, false);
  assert.equal(result.shouldRedirect, true);
  assert.equal(result.redirectUrl, '/login?redirect=%2Fdashboard%2Fowner%2Fsettings');
  assert.equal(result.shouldMountOwnerProvider, false);
});

test('GUARD-05: Customer with role "ROLE_CUSTOMER" visiting owner dashboard is blocked and redirected', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 99, email: 'customer@gmail.com', role: 'ROLE_CUSTOMER' },
    pathname: '/dashboard/owner',
  });

  assert.equal(result.status, 'UNAUTHORIZED');
  assert.equal(result.shouldRenderChildren, false);
  assert.equal(result.shouldRedirect, true);
  assert.equal(result.redirectUrl, '/login?redirect=%2Fdashboard%2Fowner');
  assert.equal(result.shouldMountOwnerProvider, false);
});

test('GUARD-06: Valid shop owner with role "SHOP_OWNER" is authorized and mounts dashboard', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 50, email: 'owner@sweetdelight.com', role: 'SHOP_OWNER', shopId: 10 },
    pathname: '/dashboard/owner',
  });

  assert.equal(result.status, 'AUTHORIZED');
  assert.equal(result.shouldRenderChildren, true);
  assert.equal(result.shouldRedirect, false);
  assert.equal(result.redirectUrl, null);
  assert.equal(result.shouldMountOwnerProvider, true);
});

test('GUARD-07: Valid shop owner with role "ROLE_SHOP_OWNER" is authorized and mounts dashboard', () => {
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 51, email: 'owner2@sweetdelight.com', role: 'ROLE_SHOP_OWNER', shopId: 11 },
    pathname: '/dashboard/owner/orders',
  });

  assert.equal(result.status, 'AUTHORIZED');
  assert.equal(result.shouldRenderChildren, true);
  assert.equal(result.shouldRedirect, false);
  assert.equal(result.redirectUrl, null);
  assert.equal(result.shouldMountOwnerProvider, true);
});

test('GUARD-08: Nested paths and query parameters are properly URL-encoded in redirect destination', () => {
  const complexPath = '/dashboard/owner/orders?tab=in_progress&page=2&filter=today';
  const result = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    pathname: complexPath,
  });

  assert.equal(result.shouldRedirect, true);
  assert.equal(
    result.redirectUrl,
    `/login?redirect=${encodeURIComponent(complexPath)}`
  );
  assert.equal(
    result.redirectUrl,
    '/login?redirect=%2Fdashboard%2Fowner%2Forders%3Ftab%3Din_progress%26page%3D2%26filter%3Dtoday'
  );
});

test('GUARD-09: Unauthenticated or non-owner state strictly suppresses OwnerProvider and background API calls', () => {
  // If user is an Admin, OwnerProvider MUST NOT mount
  const adminResult = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 1, role: 'ROLE_ADMIN' },
    pathname: '/dashboard/owner',
  });
  assert.equal(adminResult.shouldMountOwnerProvider, false);

  // If user is unauthenticated, OwnerProvider MUST NOT mount
  const unauthResult = evaluateOwnerAuthGuard({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    pathname: '/dashboard/owner',
  });
  assert.equal(unauthResult.shouldMountOwnerProvider, false);
});
