import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage harness
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

// Pure validation logic extracted from AdminPasswordChangeCard.tsx
function validatePasswordChangeForm({ currentPassword, newPassword, confirmPassword }) {
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = 'Current password is required.';
  }

  if (!newPassword) {
    errors.newPassword = 'New password is required.';
  } else if (newPassword.length < 8) {
    errors.newPassword = 'New password must be at least 8 characters long.';
  } else if (currentPassword && newPassword === currentPassword) {
    errors.newPassword = 'New password must be different from current password.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm new password is required.';
  } else if (newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// Controller simulator for Admin Password Change flow
class AdminPasswordChangeHarness {
  constructor({ apiSuccess = true, apiError = null, delay = 0 } = {}) {
    this.localStorage = new MockLocalStorage();
    this.localStorage.setItem('cakestore_token', 'mock.admin.jwt.token');
    this.localStorage.setItem('cakestore_user', JSON.stringify({
      id: 1,
      email: 'admin@cakestore.com',
      role: 'ROLE_ADMIN',
      fullName: 'Super Admin',
    }));

    this.apiSuccess = apiSuccess;
    this.apiError = apiError;
    this.delay = delay;
    this.apiCallCount = 0;
    this.lastPayload = null;
    this.isSubmitting = false;
    this.redirectUrl = null;
    this.state = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      fieldErrors: {},
      generalError: null,
      successMessage: null,
    };
  }

  async submit({ currentPassword, newPassword, confirmPassword }) {
    if (this.isSubmitting) {
      return { status: 'BLOCKED_DUPLICATE_SUBMISSION' };
    }

    this.state.generalError = null;
    this.state.successMessage = null;

    const validation = validatePasswordChangeForm({ currentPassword, newPassword, confirmPassword });
    this.state.fieldErrors = validation.errors;

    if (!validation.isValid) {
      return { status: 'VALIDATION_FAILED', errors: validation.errors };
    }

    this.isSubmitting = true;
    try {
      if (this.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
      }

      this.apiCallCount++;
      this.lastPayload = { currentPassword, newPassword };

      if (!this.apiSuccess) {
        const errorMsg = this.apiError || 'Failed to update password.';
        this.state.generalError = errorMsg;
        if (errorMsg.toLowerCase().includes('current password')) {
          this.state.fieldErrors.currentPassword = errorMsg;
        } else if (errorMsg.toLowerCase().includes('at least 8 characters')) {
          this.state.fieldErrors.newPassword = errorMsg;
        } else if (errorMsg.toLowerCase().includes('different from current password')) {
          this.state.fieldErrors.newPassword = errorMsg;
        }
        return { status: 'API_ERROR', error: errorMsg };
      }

      // Clear memory
      this.state.currentPassword = '';
      this.state.newPassword = '';
      this.state.confirmPassword = '';
      this.state.fieldErrors = {};
      this.state.successMessage = 'Password successfully changed.';

      // Session cleanup & redirect
      this.localStorage.removeItem('cakestore_token');
      this.localStorage.removeItem('cakestore_user');
      this.redirectUrl = '/login?password_changed=true&redirect=/admin';

      return { status: 'SUCCESS' };
    } finally {
      this.isSubmitting = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Admin Password Change Interface & Session Mechanics
// ─────────────────────────────────────────────────────────────────────────────

test('1. Successful password change: submits valid payload, clears memory, wipes session, and initiates redirect', async () => {
  const harness = new AdminPasswordChangeHarness({ apiSuccess: true });

  const result = await harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'NewAdminSecurePass456#',
    confirmPassword: 'NewAdminSecurePass456#',
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(harness.apiCallCount, 1);

  // Exact backend DTO payload: currentPassword and newPassword only (confirmPassword never transmitted)
  assert.deepEqual(harness.lastPayload, {
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'NewAdminSecurePass456#',
  });
  assert.equal(harness.lastPayload.confirmPassword, undefined);

  // Memory wiped
  assert.equal(harness.state.currentPassword, '');
  assert.equal(harness.state.newPassword, '');
  assert.equal(harness.state.confirmPassword, '');

  // Session invalidated in local storage
  assert.equal(harness.localStorage.getItem('cakestore_token'), null);
  assert.equal(harness.localStorage.getItem('cakestore_user'), null);

  // Redirected to login with confirmation
  assert.equal(harness.redirectUrl, '/login?password_changed=true&redirect=/admin');
});

test('2. Incorrect current password: displays inline error on currentPassword and preserves user session', async () => {
  const harness = new AdminPasswordChangeHarness({
    apiSuccess: false,
    apiError: 'Current password is incorrect',
  });

  const result = await harness.submit({
    currentPassword: 'WrongPassword!',
    newPassword: 'NewAdminSecurePass456#',
    confirmPassword: 'NewAdminSecurePass456#',
  });

  assert.equal(result.status, 'API_ERROR');
  assert.equal(harness.state.generalError, 'Current password is incorrect');
  assert.equal(harness.state.fieldErrors.currentPassword, 'Current password is incorrect');

  // Session is NOT wiped when password verification fails (admin stays logged in)
  assert.notEqual(harness.localStorage.getItem('cakestore_token'), null);
  assert.equal(harness.redirectUrl, null);
});

test('3. Password mismatch: rejects before API call when confirm password does not match new password', async () => {
  const harness = new AdminPasswordChangeHarness();

  const result = await harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'NewAdminSecurePass456#',
    confirmPassword: 'DifferentPass456#',
  });

  assert.equal(result.status, 'VALIDATION_FAILED');
  assert.equal(harness.state.fieldErrors.confirmPassword, 'Passwords do not match.');
  assert.equal(harness.apiCallCount, 0, 'No API call should be made on validation failure');
});

test('4. Missing required fields: validates all 3 fields and flags each individually', async () => {
  const harness = new AdminPasswordChangeHarness();

  // All blank
  const result1 = await harness.submit({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  assert.equal(result1.status, 'VALIDATION_FAILED');
  assert.equal(result1.errors.currentPassword, 'Current password is required.');
  assert.equal(result1.errors.newPassword, 'New password is required.');
  assert.equal(result1.errors.confirmPassword, 'Confirm new password is required.');
  assert.equal(harness.apiCallCount, 0);

  // Missing only new password
  const result2 = await harness.submit({
    currentPassword: 'ValidCurrentPassword1!',
    newPassword: '',
    confirmPassword: 'ValidCurrentPassword1!',
  });
  assert.equal(result2.errors.newPassword, 'New password is required.');
});

test('5. New password equal to current password: rejects before API call to prevent identical password reuse', async () => {
  const harness = new AdminPasswordChangeHarness();

  const result = await harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'CurrentAdminPass123!',
    confirmPassword: 'CurrentAdminPass123!',
  });

  assert.equal(result.status, 'VALIDATION_FAILED');
  assert.equal(
    harness.state.fieldErrors.newPassword,
    'New password must be different from current password.'
  );
  assert.equal(harness.apiCallCount, 0);
});

test('6. New password minimum length rule: enforces at least 8 characters consistent with backend', async () => {
  const harness = new AdminPasswordChangeHarness();

  const result = await harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'short',
    confirmPassword: 'short',
  });

  assert.equal(result.status, 'VALIDATION_FAILED');
  assert.equal(
    harness.state.fieldErrors.newPassword,
    'New password must be at least 8 characters long.'
  );
  assert.equal(harness.apiCallCount, 0);
});

test('7. API failure handling: server error sets general error alert without logging out or redirecting', async () => {
  const harness = new AdminPasswordChangeHarness({
    apiSuccess: false,
    apiError: 'Database connection failure. Please try again later.',
  });

  const result = await harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'NewAdminSecurePass456#',
    confirmPassword: 'NewAdminSecurePass456#',
  });

  assert.equal(result.status, 'API_ERROR');
  assert.equal(harness.state.generalError, 'Database connection failure. Please try again later.');
  assert.equal(harness.redirectUrl, null);
  assert.notEqual(harness.localStorage.getItem('cakestore_token'), null);
});

test('8. Duplicate submission prevention: in-flight request blocks simultaneous duplicate triggers', async () => {
  const harness = new AdminPasswordChangeHarness({ apiSuccess: true, delay: 50 });

  const p1 = harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'NewAdminSecurePass456#',
    confirmPassword: 'NewAdminSecurePass456#',
  });

  // Simultaneous second click
  const p2 = harness.submit({
    currentPassword: 'CurrentAdminPass123!',
    newPassword: 'NewAdminSecurePass456#',
    confirmPassword: 'NewAdminSecurePass456#',
  });

  const [res1, res2] = await Promise.all([p1, p2]);

  assert.equal(res1.status, 'SUCCESS');
  assert.equal(res2.status, 'BLOCKED_DUPLICATE_SUBMISSION');
  assert.equal(harness.apiCallCount, 1, 'API should only be invoked once');
});

test('9. Structural & routing contract: component files and navigation routes exist and are properly linked', () => {
  const cardPath = path.join(rootDir, 'components', 'admin', 'AdminPasswordChangeCard.tsx');
  const pagePath = path.join(rootDir, 'app', 'admin', 'security', 'page.tsx');
  const layoutPath = path.join(rootDir, 'app', 'admin', 'layout.tsx');
  const palettePath = path.join(rootDir, 'components', 'admin', 'AdminCommandPalette.tsx');
  const settingsPath = path.join(rootDir, 'app', 'admin', 'settings', 'page.tsx');
  const loginPath = path.join(rootDir, 'app', 'login', 'page.tsx');

  assert.ok(fs.existsSync(cardPath), 'AdminPasswordChangeCard.tsx must exist');
  assert.ok(fs.existsSync(pagePath), 'app/admin/security/page.tsx must exist');

  const cardContent = fs.readFileSync(cardPath, 'utf-8');
  assert.ok(cardContent.includes("authApi.changePassword"), 'Card must invoke authApi.changePassword');
  assert.ok(cardContent.includes("currentPassword"), 'Card must accept currentPassword');
  assert.ok(cardContent.includes("newPassword"), 'Card must accept newPassword');
  assert.ok(cardContent.includes("confirmPassword"), 'Card must accept confirmPassword');
  assert.ok(cardContent.includes("showCurrentPassword"), 'Card must support current password visibility toggle');
  assert.ok(cardContent.includes("showNewPassword"), 'Card must support new password visibility toggle');
  assert.ok(cardContent.includes("showConfirmPassword"), 'Card must support confirm password visibility toggle');
  assert.ok(cardContent.includes("password_changed=true"), 'Card must redirect with password_changed query param');

  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  assert.ok(layoutContent.includes('/admin/security'), 'Admin layout navigation must link to /admin/security');

  const paletteContent = fs.readFileSync(palettePath, 'utf-8');
  assert.ok(paletteContent.includes('/admin/security'), 'Command palette must include /admin/security shortcut');

  const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
  assert.ok(settingsContent.includes('/admin/security'), 'Admin settings page must link to /admin/security');

  const loginContent = fs.readFileSync(loginPath, 'utf-8');
  assert.ok(loginContent.includes('password_changed'), 'Login page must handle password_changed query parameter');
});

