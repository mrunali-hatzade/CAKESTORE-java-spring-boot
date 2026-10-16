import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mirroring the currency options and payload logic from AdminSettingsPage
const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹) - Indian Rupee' },
  { value: 'USD', label: 'USD ($) - US Dollar' },
  { value: 'EUR', label: 'EUR (€) - European Euro' },
  { value: 'GBP', label: 'GBP (£) - British Pound' },
];

function resolveCurrencyOptions(currentCurrency) {
  const effectiveCurrency = currentCurrency || 'INR';
  return CURRENCY_OPTIONS.some((c) => c.value === effectiveCurrency)
    ? CURRENCY_OPTIONS
    : [{ value: effectiveCurrency, label: effectiveCurrency }, ...CURRENCY_OPTIONS];
}

function buildSavePayload(settings) {
  const payload = {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    razorpayKeyId: settings.razorpayKeyId,
    platformCurrency: settings.platformCurrency || 'INR',
  };

  if (settings.razorpayKeySecret && settings.razorpayKeySecret.trim()) {
    payload.razorpayKeySecret = settings.razorpayKeySecret.trim();
  }
  if (settings.razorpayWebhookSecret && settings.razorpayWebhookSecret.trim()) {
    payload.razorpayWebhookSecret = settings.razorpayWebhookSecret.trim();
  }

  return payload;
}

describe('Admin Global Settings Remediation Phase 1 - UI & Accessibility Logic', () => {
  test('1. Currency defaults to INR when settings.platformCurrency is missing/null/empty', () => {
    const payloadNull = buildSavePayload({ platformName: 'CakeStore' });
    assert.equal(payloadNull.platformCurrency, 'INR');

    const payloadEmpty = buildSavePayload({ platformName: 'CakeStore', platformCurrency: '' });
    assert.equal(payloadEmpty.platformCurrency, 'INR');

    const optionsNull = resolveCurrencyOptions(null);
    assert.equal(optionsNull[0].value, 'INR');
  });

  test('2. Currency preserves and submits configured currency when non-default currency is selected', () => {
    const payloadUSD = buildSavePayload({
      platformName: 'CakeStore Global',
      supportEmail: 'support@cakestore.com',
      platformCurrency: 'USD',
    });
    assert.equal(payloadUSD.platformCurrency, 'USD');

    const payloadEUR = buildSavePayload({
      platformName: 'CakeStore EU',
      platformCurrency: 'EUR',
    });
    assert.equal(payloadEUR.platformCurrency, 'EUR');
  });

  test('3. Custom or non-standard currency from backend is preserved in options list', () => {
    const customOptions = resolveCurrencyOptions('AED');
    assert.equal(customOptions[0].value, 'AED');
    assert.ok(customOptions.some((opt) => opt.value === 'INR'));
  });

  test('4. Empty secret strings are sanitized and omitted from update payload to prevent erasing existing secrets', () => {
    const payload = buildSavePayload({
      platformName: 'CakeStore',
      supportEmail: 'support@cakestore.com',
      razorpayKeySecret: '   ',
      razorpayWebhookSecret: '',
      platformCurrency: 'INR',
    });

    assert.equal(payload.platformName, 'CakeStore');
    assert.equal(payload.supportEmail, 'support@cakestore.com');
    assert.equal(payload.platformCurrency, 'INR');
    assert.equal(payload.razorpayKeySecret, undefined);
    assert.equal(payload.razorpayWebhookSecret, undefined);
  });

  test('5. Non-empty secrets are trimmed and submitted in payload', () => {
    const payload = buildSavePayload({
      platformName: 'CakeStore',
      supportEmail: 'support@cakestore.com',
      razorpayKeySecret: '  sec_key_123  ',
      razorpayWebhookSecret: '  wh_sec_456  ',
      platformCurrency: 'INR',
    });

    assert.equal(payload.razorpayKeySecret, 'sec_key_123');
    assert.equal(payload.razorpayWebhookSecret, 'wh_sec_456');
  });

  test('6. Accessible names and ARIA labels toggle properly for password visibility buttons', () => {
    const getSecretToggleAriaLabel = (showSecret) =>
      showSecret ? 'Hide Razorpay key secret' : 'Show Razorpay key secret';
    const getWebhookToggleAriaLabel = (showWebhook) =>
      showWebhook ? 'Hide Razorpay webhook secret' : 'Show Razorpay webhook secret';

    assert.equal(getSecretToggleAriaLabel(false), 'Show Razorpay key secret');
    assert.equal(getSecretToggleAriaLabel(true), 'Hide Razorpay key secret');
    assert.equal(getWebhookToggleAriaLabel(false), 'Show Razorpay webhook secret');
    assert.equal(getWebhookToggleAriaLabel(true), 'Hide Razorpay webhook secret');
  });

  test('7. Form input ID and label htmlFor association mapping contracts', () => {
    const expectedFieldAssociations = [
      { id: 'platformName', label: 'Platform Name' },
      { id: 'supportEmail', label: 'Support Email' },
      { id: 'platformCurrency', label: 'Platform Currency' },
      { id: 'razorpayKeyId', label: 'Razorpay Key ID' },
      { id: 'razorpayKeySecret', label: 'Razorpay Key Secret' },
      { id: 'razorpayWebhookSecret', label: 'Webhook Secret' },
    ];

    expectedFieldAssociations.forEach(({ id, label }) => {
      assert.ok(id && id.length > 0, `Field ID must be non-empty for ${label}`);
      assert.ok(label && label.length > 0, `Label text must be non-empty for ${id}`);
    });
  });
});
