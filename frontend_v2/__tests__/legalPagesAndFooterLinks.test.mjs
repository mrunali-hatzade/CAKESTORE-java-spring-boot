import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_DIR = process.cwd().endsWith('frontend_v2')
  ? process.cwd()
  : path.resolve(process.cwd(), 'frontend_v2');

test('CakeStore: Legal & Policy Pages and Footer Links Suite', async (t) => {
  // Test 1: Footer.tsx contains working links to /terms, /privacy, and /refund-policy
  await t.test('1. Footer.tsx includes accessible links to Terms, Privacy, and Refund Policy', () => {
    const footerPath = path.join(FRONTEND_DIR, 'components', 'common', 'Footer.tsx');
    assert.ok(fs.existsSync(footerPath), 'Footer.tsx must exist');

    const content = fs.readFileSync(footerPath, 'utf8');

    // Verify all 3 routes exist in Footer
    assert.ok(content.includes('href="/terms"'), 'Footer must have link to /terms');
    assert.ok(content.includes('href="/privacy"'), 'Footer must have link to /privacy');
    assert.ok(content.includes('href="/refund-policy"'), 'Footer must have link to /refund-policy');

    // Verify link labels
    assert.ok(content.includes('Terms of Service'), 'Footer must include "Terms of Service" label');
    assert.ok(content.includes('Privacy Policy'), 'Footer must include "Privacy Policy" label');
    assert.ok(content.includes('Refund Policy'), 'Footer must include "Refund Policy" label');

    // Verify links appear in both Help & Support column and bottom copyright bar
    const termsCount = (content.match(/href="\/terms"/g) || []).length;
    const privacyCount = (content.match(/href="\/privacy"/g) || []).length;
    const refundCount = (content.match(/href="\/refund-policy"/g) || []).length;

    assert.ok(termsCount >= 2, `Expected /terms link in both column and bottom bar, found ${termsCount}`);
    assert.ok(privacyCount >= 2, `Expected /privacy link in both column and bottom bar, found ${privacyCount}`);
    assert.ok(refundCount >= 2, `Expected /refund-policy link in both column and bottom bar, found ${refundCount}`);
  });

  // Test 2: Terms of Service page (/terms) verification
  await t.test('2. Terms of Service page file exists with correct metadata, structure, and disclaimers', () => {
    const termsPath = path.join(FRONTEND_DIR, 'app', 'terms', 'page.tsx');
    assert.ok(fs.existsSync(termsPath), 'Terms page file must exist at frontend_v2/app/terms/page.tsx');

    const content = fs.readFileSync(termsPath, 'utf8');

    // Verify metadata
    assert.ok(content.includes("title: 'Terms of Service — CakeStore Platform'"), 'Terms page must have proper title metadata');
    assert.ok(content.includes("description: 'Terms and conditions governing the use"), 'Terms page must have description metadata');

    // Verify key platform role and responsibilities
    assert.ok(content.includes('Intermediary Status'), 'Terms must clarify CakeStore intermediary status');
    assert.ok(content.includes('Bakery Partner Responsibilities'), 'Terms must state bakery partner responsibilities');
    assert.ok(content.includes('Razorpay'), 'Terms must accurately cite Razorpay payment gateway');
    assert.ok(content.includes('Critical Food Allergy Notice'), 'Terms must include allergen & dietary disclaimers');
    assert.ok(content.includes('Draft Document'), 'Terms must prominently state draft status requiring legal review');

    // Verify no dead placeholder links (e.g. href="#" or href="javascript:void(0)")
    assert.ok(!content.includes('href="#"'), 'Terms page must not contain "#" placeholder links');
    assert.ok(!content.includes('javascript:void'), 'Terms page must not contain javascript:void placeholder links');

    // Verify cross-policy links
    assert.ok(content.includes('href="/privacy"'), 'Terms page must link to Privacy Policy');
    assert.ok(content.includes('href="/refund-policy"'), 'Terms page must link to Refund Policy');
    assert.ok(content.includes('href="/contact"'), 'Terms page must link to Contact page');
  });

  // Test 3: Privacy Policy page (/privacy) verification
  await t.test('3. Privacy Policy page file exists with data collection, third-party services, and security practices', () => {
    const privacyPath = path.join(FRONTEND_DIR, 'app', 'privacy', 'page.tsx');
    assert.ok(fs.existsSync(privacyPath), 'Privacy page file must exist at frontend_v2/app/privacy/page.tsx');

    const content = fs.readFileSync(privacyPath, 'utf8');

    // Verify metadata
    assert.ok(content.includes("title: 'Privacy Policy — CakeStore Platform'"), 'Privacy page must have proper title metadata');
    assert.ok(content.includes("description: 'Understand what personal data CakeStore collects"), 'Privacy page must have description metadata');

    // Verify accurate verified service mentions
    assert.ok(content.includes('Razorpay'), 'Privacy policy must cite Razorpay');
    assert.ok(content.includes('Resend Email Service'), 'Privacy policy must cite Resend email service');
    assert.ok(content.includes('Twilio SMS Service'), 'Privacy policy must cite Twilio SMS service');
    assert.ok(content.includes('BCrypt'), 'Privacy policy must accurately document BCrypt OTP hashing');
    assert.ok(content.includes('10 minutes'), 'Privacy policy must cite 10-minute OTP expiration');
    assert.ok(content.includes('support@cakestore.in'), 'Privacy policy must cite support@cakestore.in');

    // Verify no dead placeholder links
    assert.ok(!content.includes('href="#"'), 'Privacy page must not contain "#" placeholder links');
    assert.ok(!content.includes('javascript:void'), 'Privacy page must not contain javascript:void placeholder links');

    // Verify cross-policy links
    assert.ok(content.includes('href="/terms"'), 'Privacy page must link to Terms page');
    assert.ok(content.includes('href="/refund-policy"'), 'Privacy page must link to Refund Policy');
    assert.ok(content.includes('href="/contact"'), 'Privacy page must link to Contact page');
  });

  // Test 4: Refund Policy page (/refund-policy) verification
  await t.test('4. Refund Policy page file exists with cancellation rules, late-payment protections, and refund workflows', () => {
    const refundPath = path.join(FRONTEND_DIR, 'app', 'refund-policy', 'page.tsx');
    assert.ok(fs.existsSync(refundPath), 'Refund policy file must exist at frontend_v2/app/refund-policy/page.tsx');

    const content = fs.readFileSync(refundPath, 'utf8');

    // Verify metadata
    assert.ok(content.includes("title: 'Refund & Cancellation Policy — CakeStore Platform'"), 'Refund page must have proper title metadata');

    // Verify core verified policies
    assert.ok(content.includes('In-Flight Checkout Cancellation'), 'Refund policy must document in-flight cancellation');
    assert.ok(content.includes('Cancellation of Confirmed & Paid Orders'), 'Refund policy must document confirmed order rules');
    assert.ok(content.includes('Failed Payments & Bank Debits'), 'Refund policy must document banking debits on failed checkout');
    assert.ok(content.includes('RECONCILIATION_REQUIRED'), 'Refund policy must cite RECONCILIATION_REQUIRED safeguard');
    assert.ok(content.includes('Damaged or Incorrect Deliveries'), 'Refund policy must document damaged delivery protocols');
    assert.ok(content.includes('No Automatic or Cash Refunds'), 'Refund policy must not promise instant automatic refunds');

    // Verify no dead placeholder links
    assert.ok(!content.includes('href="#"'), 'Refund policy page must not contain "#" placeholder links');
    assert.ok(!content.includes('javascript:void'), 'Refund policy page must not contain javascript:void placeholder links');

    // Verify cross-policy links
    assert.ok(content.includes('href="/terms"'), 'Refund policy must link to Terms of Service');
    assert.ok(content.includes('href="/privacy"'), 'Refund policy must link to Privacy Policy');
    assert.ok(content.includes('href="/contact"'), 'Refund policy must link to Contact page');
  });
});
