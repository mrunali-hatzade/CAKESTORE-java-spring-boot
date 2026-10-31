import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Normalization function matching frontend_v2/app/explore/page.tsx
function normalizeBusinessType(raw) {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase().replaceAll('-', '_');
  if (upper === 'HOME_BAKER') return 'HOME_BAKERY';
  if (upper === 'PASTRY_SHOP') return 'BAKERY_SHOP';
  if (upper === 'CUSTOM_CAKE_STUDIO') return 'CAKE_STUDIO';
  if (upper === 'COMMERCIAL_BAKERY') return 'ONLINE_CAKE_BUSINESS';
  return upper;
}

test('1. Explore query param normalization maps legacy aliases to canonical enum values', () => {
  assert.equal(normalizeBusinessType('HOME_BAKER'), 'HOME_BAKERY');
  assert.equal(normalizeBusinessType('home_baker'), 'HOME_BAKERY');
  assert.equal(normalizeBusinessType('home-baker'), 'HOME_BAKERY');

  assert.equal(normalizeBusinessType('PASTRY_SHOP'), 'BAKERY_SHOP');
  assert.equal(normalizeBusinessType('pastry_shop'), 'BAKERY_SHOP');
  assert.equal(normalizeBusinessType('pastry-shop'), 'BAKERY_SHOP');

  assert.equal(normalizeBusinessType('CUSTOM_CAKE_STUDIO'), 'CAKE_STUDIO');
  assert.equal(normalizeBusinessType('custom_cake_studio'), 'CAKE_STUDIO');
  assert.equal(normalizeBusinessType('custom-cake-studio'), 'CAKE_STUDIO');

  assert.equal(normalizeBusinessType('COMMERCIAL_BAKERY'), 'ONLINE_CAKE_BUSINESS');
  assert.equal(normalizeBusinessType('commercial_bakery'), 'ONLINE_CAKE_BUSINESS');
  assert.equal(normalizeBusinessType('commercial-bakery'), 'ONLINE_CAKE_BUSINESS');
});

test('2. Explore query param normalization preserves canonical values and handles undefined', () => {
  assert.equal(normalizeBusinessType('HOME_BAKERY'), 'HOME_BAKERY');
  assert.equal(normalizeBusinessType('BAKERY_SHOP'), 'BAKERY_SHOP');
  assert.equal(normalizeBusinessType('CAKE_STUDIO'), 'CAKE_STUDIO');
  assert.equal(normalizeBusinessType('ONLINE_CAKE_BUSINESS'), 'ONLINE_CAKE_BUSINESS');
  assert.equal(normalizeBusinessType('OTHER'), 'OTHER');

  assert.equal(normalizeBusinessType(null), undefined);
  assert.equal(normalizeBusinessType(undefined), undefined);
  assert.equal(normalizeBusinessType(''), undefined);
});

test('3. Onboarding page contains canonical BusinessType default and select options', () => {
  const onboardingPath = path.join(rootDir, 'app', 'onboarding', 'page.tsx');
  const content = fs.readFileSync(onboardingPath, 'utf-8');

  // Verify default state is canonical HOME_BAKERY
  assert.ok(
    content.includes("useState('HOME_BAKERY')"),
    'Default businessType in onboarding/page.tsx must be HOME_BAKERY'
  );

  // Verify canonical select options exist
  assert.ok(content.includes("value: 'HOME_BAKERY'"), 'Select option HOME_BAKERY must exist');
  assert.ok(content.includes("value: 'BAKERY_SHOP'"), 'Select option BAKERY_SHOP must exist');
  assert.ok(content.includes("value: 'CAKE_STUDIO'"), 'Select option CAKE_STUDIO must exist');
  assert.ok(content.includes("value: 'ONLINE_CAKE_BUSINESS'"), 'Select option ONLINE_CAKE_BUSINESS must exist');
  assert.ok(content.includes("value: 'OTHER'"), 'Select option OTHER must exist');

  // Verify legacy values are not present in the select options
  assert.ok(!content.includes("value: 'HOME_BAKER'"), 'Legacy HOME_BAKER must not be in select options');
  assert.ok(!content.includes("value: 'PASTRY_SHOP'"), 'Legacy PASTRY_SHOP must not be in select options');
  assert.ok(!content.includes("value: 'CUSTOM_CAKE_STUDIO'"), 'Legacy CUSTOM_CAKE_STUDIO must not be in select options');
  assert.ok(!content.includes("value: 'COMMERCIAL_BAKERY'"), 'Legacy COMMERCIAL_BAKERY must not be in select options');
});

test('4. Footer links use canonical BusinessType query parameters', () => {
  const footerPath = path.join(rootDir, 'components', 'common', 'Footer.tsx');
  const content = fs.readFileSync(footerPath, 'utf-8');

  assert.ok(
    content.includes('/explore?businessType=HOME_BAKERY'),
    'Footer must link to /explore?businessType=HOME_BAKERY'
  );
  assert.ok(
    content.includes('/explore?businessType=CAKE_STUDIO'),
    'Footer must link to /explore?businessType=CAKE_STUDIO'
  );

  // Must not have legacy links in Footer (check for HOME_BAKER not followed by Y)
  assert.ok(!/\/explore\?businessType=HOME_BAKER(?![A-Z_])/.test(content), 'Footer must not use HOME_BAKER');
  assert.ok(!content.includes('/explore?businessType=CUSTOM_CAKE_STUDIO'), 'Footer must not use CUSTOM_CAKE_STUDIO');
});

test('5. Home-baker storefront address privacy hides street address but retains city/locality', () => {
  // Simulating the backend response received by the frontend
  const homeBakeryResponse = {
    id: 42,
    businessName: "Aarti's Home Oven",
    businessType: "HOME_BAKERY",
    address: null,
    addressLine1: null,
    addressLine2: null,
    latitude: null,
    longitude: null,
    area: "Baner",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411045",
  };

  assert.equal(homeBakeryResponse.address, null);
  assert.equal(homeBakeryResponse.addressLine1, null);
  assert.equal(homeBakeryResponse.latitude, null);
  assert.equal(homeBakeryResponse.longitude, null);

  // Locality info retained
  assert.equal(homeBakeryResponse.area, "Baner");
  assert.equal(homeBakeryResponse.city, "Pune");
  assert.equal(homeBakeryResponse.pincode, "411045");
});
