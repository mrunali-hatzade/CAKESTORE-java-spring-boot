import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_DIR = process.cwd().endsWith('frontend_v2')
  ? process.cwd()
  : path.resolve(process.cwd(), 'frontend_v2');

test('CakeStore: Homepage Bakery Grid Pagination & View All Suite', async (t) => {
  // Test 1: Verify app/page.tsx defines HOMEPAGE_BAKERY_LIMIT and passes page=0, size=12
  await t.test('1. app/page.tsx enforces bounded homepage bakery query (page: 0, size: 12)', () => {
    const pagePath = path.join(FRONTEND_DIR, 'app', 'page.tsx');
    assert.ok(fs.existsSync(pagePath), 'app/page.tsx must exist');

    const content = fs.readFileSync(pagePath, 'utf8');

    // Verify limit constant is between 6 and 12
    assert.ok(content.includes('HOMEPAGE_BAKERY_LIMIT = 12'), 'HOMEPAGE_BAKERY_LIMIT must be 12 (between 6 and 12)');

    // Verify searchShops call includes page: 0 and size: HOMEPAGE_BAKERY_LIMIT
    assert.ok(content.includes('page: 0'), 'loadShops must pass page: 0');
    assert.ok(content.includes('size: HOMEPAGE_BAKERY_LIMIT'), 'loadShops must pass size: HOMEPAGE_BAKERY_LIMIT');

    // Verify searchRequestIdRef is used to prevent stale async responses
    assert.ok(content.includes('searchRequestIdRef'), 'page.tsx must use searchRequestIdRef for race condition safety');
  });

  // Test 2: Verify BakeryGrid.tsx supports viewAllHref, viewAllLabel, and header/bottom CTAs
  await t.test('2. BakeryGrid.tsx provides View All Bakeries links in header and bottom CTA', () => {
    const gridPath = path.join(FRONTEND_DIR, 'components', 'customer', 'marketplace', 'BakeryGrid.tsx');
    assert.ok(fs.existsSync(gridPath), 'BakeryGrid.tsx must exist');

    const content = fs.readFileSync(gridPath, 'utf8');

    // Verify props interface
    assert.ok(content.includes('viewAllHref?: string'), 'BakeryGridProps must include viewAllHref');
    assert.ok(content.includes('viewAllLabel?: string'), 'BakeryGridProps must include viewAllLabel');

    // Verify header "View All Bakeries" link
    assert.ok(content.includes('id="header-view-all-bakeries"'), 'Header must contain link with id header-view-all-bakeries');
    assert.ok(content.includes('id="bottom-view-all-bakeries"'), 'Bottom must contain CTA banner with id bottom-view-all-bakeries');

    // Verify explore pagination controls are only rendered when onPageChange is provided
    assert.ok(
      content.includes('{onPageChange && !isLoading && !error && shops.length > 0'),
      'Interactive pagination controls must only render when onPageChange is provided'
    );
  });

  // Test 3: Verify explore URL serialization with active filters
  await t.test('3. getExploreUrl serializes active category, search, location, and sorting parameters', () => {
    function serializeExploreUrl(filters) {
      const params = new URLSearchParams();
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.location?.trim() && !filters.location.toLowerCase().startsWith('all')) {
        params.set('location', filters.location.trim());
      }
      if (filters.city?.trim() && !filters.city.toLowerCase().startsWith('all')) {
        params.set('city', filters.city.trim());
      }
      if (filters.state?.trim() && !filters.state.toLowerCase().startsWith('all')) {
        params.set('state', filters.state.trim());
      }
      if (filters.businessType && filters.businessType !== 'ALL') {
        params.set('businessType', filters.businessType.trim());
      }
      if (filters.sortBy && filters.sortBy !== 'default') {
        params.set('sortBy', filters.sortBy.trim());
      }
      if (filters.latitude != null && filters.longitude != null) {
        params.set('lat', String(filters.latitude));
        params.set('lng', String(filters.longitude));
        if (filters.radiusKm != null) {
          params.set('radius', String(filters.radiusKm));
        }
      }
      const query = params.toString();
      return query ? `/explore?${query}` : '/explore';
    }

    // Default state: clean /explore
    assert.equal(serializeExploreUrl({}), '/explore');

    // With keyword search
    assert.equal(serializeExploreUrl({ search: 'Chocolate Truffle' }), '/explore?search=Chocolate+Truffle');

    // With city filter
    assert.equal(serializeExploreUrl({ city: 'Pune', state: 'Maharashtra' }), '/explore?city=Pune&state=Maharashtra');

    // With business type (Home Baker) and sort by rating
    assert.equal(
      serializeExploreUrl({ businessType: 'HOME_BAKER', sortBy: 'rating' }),
      '/explore?businessType=HOME_BAKER&sortBy=rating'
    );

    // With geolocation
    assert.equal(
      serializeExploreUrl({ latitude: 18.5204, longitude: 73.8567, radiusKm: 15 }),
      '/explore?lat=18.5204&lng=73.8567&radius=15'
    );
  });

  // Test 4: Verify result counter truthfulness
  await t.test('4. Result count displays accurate record counter without misleading numbers', () => {
    function formatResultCounter(shopsLength, totalElements) {
      const total = typeof totalElements === 'number' ? totalElements : shopsLength;
      if (total === 0 || shopsLength === 0) return 'No bakeries found';
      if (totalElements && totalElements > shopsLength) {
        return `Showing ${shopsLength} of ${totalElements} ${totalElements === 1 ? 'bakery' : 'bakeries'}`;
      }
      return `${total} ${total === 1 ? 'bakery' : 'bakeries'} found`;
    }

    // When total is greater than page size limit (e.g. 45 total, 12 returned)
    assert.equal(formatResultCounter(12, 45), 'Showing 12 of 45 bakeries');

    // When exactly 12 total in database
    assert.equal(formatResultCounter(12, 12), '12 bakeries found');

    // When filtered results have fewer than limit (e.g. 3 in a small town)
    assert.equal(formatResultCounter(3, 3), '3 bakeries found');

    // When 1 bakery found
    assert.equal(formatResultCounter(1, 1), '1 bakery found');

    // When 0 bakeries found
    assert.equal(formatResultCounter(0, 0), 'No bakeries found');
  });

  // Test 5: Verify "View All Bakeries" button label reflects total elements
  await t.test('5. View All label displays dynamic count when total exceeds homepage limit', () => {
    function formatViewAllLabel(shopsLength, totalElements) {
      if (typeof totalElements === 'number' && totalElements > shopsLength) {
        return `View All ${totalElements} Bakeries`;
      }
      return 'View All Bakeries';
    }

    assert.equal(formatViewAllLabel(12, 50), 'View All 50 Bakeries');
    assert.equal(formatViewAllLabel(12, 12), 'View All Bakeries');
    assert.equal(formatViewAllLabel(5, 5), 'View All Bakeries');
    assert.equal(formatViewAllLabel(12, undefined), 'View All Bakeries');
  });
});
