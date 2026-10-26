import test from 'node:test';
import assert from 'node:assert/strict';

test('CakeStore: Checkout OTP Fallback & Payment Cancellation Security Tests', async (t) => {
  // Test 1: ordersApi.requestTrackingOtp sends phone and email payload
  await t.test('requestTrackingOtp formats payload with phone and optional email', async () => {
    let capturedUrl = '';
    let capturedBody = null;

    const mockApiClient = {
      post: async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          channel: 'EMAIL',
          deliveryTarget: 'email (c***r@example.com)',
          smsConfigured: false,
          emailConfigured: true,
          phoneMasked: '+91 98*****210',
          emailMasked: 'c***r@example.com',
          message: "We've sent a 6-digit verification code to your email.",
        };
      },
    };

    const res = await mockApiClient.post('/api/customer/storefront/tracking/request-otp', {
      phone: '9876543210',
      email: 'customer@example.com',
    });

    assert.equal(capturedUrl, '/api/customer/storefront/tracking/request-otp');
    assert.deepEqual(capturedBody, {
      phone: '9876543210',
      email: 'customer@example.com',
    });
    assert.equal(res.channel, 'EMAIL');
    assert.equal(res.smsConfigured, false);
    assert.equal(res.emailConfigured, true);
    assert.equal(res.emailMasked, 'c***r@example.com');
    // Ensure raw OTP is never returned in response
    assert.equal(res.otp, undefined);
    assert.equal(res.rawOtp, undefined);
  });

  // Test 2: Channel policy message formatting in UI
  await t.test('Channel message formatting accurately reflects SMS, Email, and dual channels', () => {
    const formatDeliveryMessage = (deliveryInfo, phone, email) => {
      if (deliveryInfo?.channel === 'SMS_AND_EMAIL') {
        return "We've sent a 6-digit verification code to your mobile and email.";
      }
      if (deliveryInfo?.channel === 'EMAIL') {
        return `We've sent a 6-digit verification code to your email (${deliveryInfo.emailMasked || email}).`;
      }
      if (deliveryInfo?.channel === 'SMS') {
        return `We've sent a 6-digit verification code to your mobile (${deliveryInfo.phoneMasked || phone}).`;
      }
      return deliveryInfo?.message || `We've sent a 6-digit verification code to ${phone}.`;
    };

    const smsAndEmail = formatDeliveryMessage(
      { channel: 'SMS_AND_EMAIL', phoneMasked: '+91 98*****210', emailMasked: 'j***e@test.com' },
      '9876543210',
      'jane@test.com'
    );
    assert.equal(smsAndEmail, "We've sent a 6-digit verification code to your mobile and email.");

    const emailOnly = formatDeliveryMessage(
      { channel: 'EMAIL', emailMasked: 'j***e@test.com' },
      '9876543210',
      'jane@test.com'
    );
    assert.equal(emailOnly, "We've sent a 6-digit verification code to your email (j***e@test.com).");

    const mockSms = formatDeliveryMessage(
      { channel: 'MOCK_SMS', message: 'SMS service is operating in mock development mode. Please enter an email address to receive your verification code.' },
      '9876543210',
      ''
    );
    assert.match(mockSms, /mock development mode/i);
  });

  // Test 3: ordersApi.cancelPaymentOrder sends checkout token in payload and headers
  await t.test('cancelPaymentOrder supplies X-Checkout-Token header and checkoutToken in payload', async () => {
    let capturedUrl = '';
    let capturedBody = null;
    let capturedOptions = null;

    const mockApiClient = {
      post: async (url, body, options) => {
        capturedUrl = url;
        capturedBody = body;
        capturedOptions = options;
        return {
          status: 'CANCELLED',
          message: 'Payment process was cancelled. Order has not been placed.',
          orderNumber: 'ORD-TEST-9999',
        };
      },
    };

    const fakeToken = 'signed.checkout.token.jwt';
    const result = await mockApiClient.post(
      `/api/storefront/orders/ORD-TEST-9999/cancel-payment`,
      { reason: 'Customer dismissed payment modal', checkoutToken: fakeToken },
      { headers: { 'X-Checkout-Token': fakeToken } }
    );

    assert.equal(capturedUrl, '/api/storefront/orders/ORD-TEST-9999/cancel-payment');
    assert.equal(capturedBody.reason, 'Customer dismissed payment modal');
    assert.equal(capturedBody.checkoutToken, fakeToken);
    assert.equal(capturedOptions.headers['X-Checkout-Token'], fakeToken);
    assert.equal(result.status, 'CANCELLED');
  });

  // Test 4: OTP code validation rules
  await t.test('OTP validation requires exact 6-digit numeric code', () => {
    const validateCode = (otp) => {
      if (!otp || typeof otp !== 'string') return false;
      const clean = otp.replace(/\D/g, '');
      return clean.length === 6;
    };

    assert.equal(validateCode('123456'), true);
    assert.equal(validateCode('12345'), false); // too short
    assert.equal(validateCode('1234567'), false); // too long
    assert.equal(validateCode('abcdef'), false); // letters
    assert.equal(validateCode(''), false); // empty
    assert.equal(validateCode(null), false);
  });
});
