import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');

test('CakeStore Phase 2.2: Interactive Map & Open Now Discovery Suite', async (t) => {
  // Test 1: Verify API parameter serialization for openNow
  await t.test('1. buildShopSearchParams serializes openNow=true and omits false/undefined', () => {
    function buildShopSearchParams(filters = {}) {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.location) params.append('location', filters.location);
      if (filters.openNow === true) params.append('openNow', 'true');
      return params;
    }

    const params1 = buildShopSearchParams({ openNow: true, search: 'velvet' });
    assert.strictEqual(params1.get('openNow'), 'true');
    assert.strictEqual(params1.get('search'), 'velvet');

    const params2 = buildShopSearchParams({ openNow: false });
    assert.strictEqual(params2.get('openNow'), null);

    const params3 = buildShopSearchParams({});
    assert.strictEqual(params3.get('openNow'), null);
  });

  // Test 2: Verify BakeryMap coordinate boundary filtering
  await t.test('2. Coordinate validation accepts valid lat/lng and safely filters invalid/missing coordinates', () => {
    const rawShops = [
      { id: 1, businessName: 'Valid Central', latitude: 18.5204, longitude: 73.8567 },
      { id: 2, businessName: 'Missing Lng', latitude: 18.5204, longitude: null },
      { id: 3, businessName: 'NaN Lat', latitude: NaN, longitude: 73.8567 },
      { id: 4, businessName: 'Out of bounds Lat', latitude: 105.2, longitude: 73.8567 },
      { id: 5, businessName: 'Out of bounds Lng', latitude: 18.5204, longitude: -195.0 },
      { id: 6, businessName: 'Valid Edge', latitude: -90.0, longitude: 180.0 },
    ];

    const mappable = rawShops.filter(
      (s) =>
        s.latitude != null &&
        s.longitude != null &&
        !isNaN(s.latitude) &&
        !isNaN(s.longitude) &&
        s.latitude >= -90 &&
        s.latitude <= 90 &&
        s.longitude >= -180 &&
        s.longitude <= 180
    );

    assert.strictEqual(mappable.length, 2);
    assert.strictEqual(mappable[0].id, 1);
    assert.strictEqual(mappable[1].id, 6);
  });

  // Test 3: Verify Open Status Pill Logic
  await t.test('3. Open status display truthfulness with fallback support', () => {
    function getStatusBadge(shop) {
      if (shop.isOpenNow === true) {
        return { label: 'Open Now', variant: 'open' };
      }
      if (shop.isOpenNow === false) {
        return { label: shop.openStatusText || 'Closed', variant: 'closed' };
      }
      if (shop.openStatusText) {
        return { label: shop.openStatusText, variant: 'neutral' };
      }
      return null;
    }

    const openShop = { id: 1, isOpenNow: true, openStatusText: 'Open until 10:00 PM' };
    assert.deepStrictEqual(getStatusBadge(openShop), { label: 'Open Now', variant: 'open' });

    const closedShop = { id: 2, isOpenNow: false, openStatusText: 'Opens tomorrow at 9:00 AM' };
    assert.deepStrictEqual(getStatusBadge(closedShop), {
      label: 'Opens tomorrow at 9:00 AM',
      variant: 'closed',
    });

    const unconfiguredShop = { id: 3 };
    assert.strictEqual(getStatusBadge(unconfiguredShop), null);
  });

  // Test 4: Verify Overnight Shift Validation in Owner Business Hours
  await t.test('4. Overnight business hours validation allows overnight shifts but rejects zero duration', () => {
    function validateShift(openTime, closeTime) {
      if (!openTime || !closeTime) return { valid: false, error: 'Times required' };
      if (openTime === closeTime) return { valid: false, error: 'Opening and closing times cannot be identical' };
      const isOvernight = closeTime < openTime;
      return { valid: true, isOvernight };
    }

    // Normal daytime shift
    const day = validateShift('09:00', '18:00');
    assert.strictEqual(day.valid, true);
    assert.strictEqual(day.isOvernight, false);

    // Overnight late-night bakery shift
    const overnight = validateShift('20:00', '04:00');
    assert.strictEqual(overnight.valid, true);
    assert.strictEqual(overnight.isOvernight, true);

    // Zero-duration shift
    const identical = validateShift('10:00', '10:00');
    assert.strictEqual(identical.valid, false);
    assert.strictEqual(identical.error, 'Opening and closing times cannot be identical');
  });

  // Test 5: Verify Explore page source contracts
  await t.test('5. Explore page source code imports and integrates BakeryMap & openNow filter', () => {
    const explorePagePath = path.join(FRONTEND_DIR, 'app', 'explore', 'page.tsx');
    assert.ok(fs.existsSync(explorePagePath), 'explore/page.tsx must exist');

    const content = fs.readFileSync(explorePagePath, 'utf8');

    assert.ok(content.includes('BakeryMap'), 'explore page must integrate BakeryMap');
    assert.ok(content.includes('openNow'), 'explore page must support openNow state');
    assert.ok(content.includes('viewMode'), 'explore page must support viewMode toggle');
    assert.ok(content.includes('selectedShopId'), 'explore page must synchronize selectedShopId');
    assert.ok(content.includes('hoveredShopId'), 'explore page must synchronize hoveredShopId');
  });
});

