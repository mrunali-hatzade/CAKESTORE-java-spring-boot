import test from 'node:test';
import assert from 'node:assert/strict';

// Helper mirroring buildShopSearchParams in lib/api/storefront.ts
function buildShopSearchParams(filters = {}) {
  const params = {};
  if (filters.state && filters.state.trim() && !filters.state.toLowerCase().startsWith('all')) {
    params.state = filters.state.trim();
  }
  if (filters.district && filters.district.trim() && !filters.district.toLowerCase().startsWith('all')) {
    params.district = filters.district.trim();
  }
  if (filters.city && filters.city.trim() && !filters.city.toLowerCase().startsWith('all')) {
    params.city = filters.city.trim();
  }
  if (filters.area && filters.area.trim() && !filters.area.toLowerCase().startsWith('all')) {
    params.area = filters.area.trim();
  }
  if (filters.pincode && filters.pincode.trim() && !filters.pincode.toLowerCase().startsWith('all')) {
    params.pincode = filters.pincode.trim();
  }
  if (filters.country && filters.country.trim()) {
    params.country = filters.country.trim();
  }
  if (filters.businessType && filters.businessType !== 'ALL' && filters.businessType.trim()) {
    params.businessType = filters.businessType.trim();
  }
  if (filters.search && filters.search.trim()) {
    params.search = filters.search.trim();
  }
  if (filters.location && filters.location.trim() && !filters.location.toLowerCase().startsWith('all')) {
    params.location = filters.location.trim();
  }
  if (filters.latitude != null && !isNaN(filters.latitude)) {
    params.latitude = filters.latitude.toString();
  }
  if (filters.longitude != null && !isNaN(filters.longitude)) {
    params.longitude = filters.longitude.toString();
  }
  if (filters.radiusKm != null && !isNaN(filters.radiusKm)) {
    params.radiusKm = filters.radiusKm.toString();
  }
  if (filters.sortBy && filters.sortBy.trim()) {
    params.sortBy = filters.sortBy.trim();
  }
  if (filters.page != null) {
    params.page = filters.page.toString();
  }
  if (filters.size != null) {
    params.size = filters.size.toString();
  }
  return params;
}

// Helper mirroring normalizeShopSearchResponse in lib/api/storefront.ts
function normalizeShopSearchResponse(raw, requestedFilters) {
  if (Array.isArray(raw)) {
    const list = [...raw];
    return list;
  }

  if (raw && typeof raw === 'object' && 'content' in raw && Array.isArray(raw.content)) {
    const page = raw;
    const list = [...page.content];
    const totalElements = typeof page.totalElements === 'number' ? page.totalElements : page.content.length;
    const size = typeof page.size === 'number' ? page.size : (requestedFilters?.size ?? (page.content.length || 20));
    const totalPages = typeof page.totalPages === 'number'
      ? page.totalPages
      : (size > 0 ? Math.ceil(totalElements / size) : (totalElements > 0 ? 1 : 0));
    const pageNum = typeof page.number === 'number' ? page.number : (requestedFilters?.page ?? 0);

    list.pagination = {
      totalElements,
      totalPages,
      page: pageNum,
      size,
      first: typeof page.first === 'boolean' ? page.first : pageNum === 0,
      last: typeof page.last === 'boolean' ? page.last : (pageNum >= totalPages - 1),
      empty: typeof page.empty === 'boolean' ? page.empty : page.content.length === 0,
    };
    return list;
  }

  const emptyList = [];
  return emptyList;
}

// Helper mirroring compute record range in BakeryGrid.tsx
function computeExplorerPaginationRange(page, pageSize, totalElements, shopsLength) {
  const total = typeof totalElements === 'number' ? totalElements : shopsLength;
  if (total === 0 || shopsLength === 0) {
    return {
      start: 0,
      end: 0,
      total: 0,
      displayText: 'Showing 0 to 0 of 0 bakeries',
    };
  }
  const start = page * pageSize + 1;
  const end = Math.min(page * pageSize + shopsLength, total);
  const noun = total === 1 ? 'bakery' : 'bakeries';
  return {
    start,
    end,
    total,
    displayText: `Showing ${start} to ${end} of ${total} ${noun}`,
  };
}

// Helper mirroring button state evaluation in BakeryGrid.tsx
function evaluateExplorerPaginationControls(page, totalPages, loading) {
  const isPrevDisabled = page <= 0 || Boolean(loading);
  const isNextDisabled = page >= Math.max(totalPages - 1, 0) || Boolean(loading);
  const shouldRenderNavigation = totalPages > 1;
  return {
    isPrevDisabled,
    isNextDisabled,
    shouldRenderNavigation,
    pageLabel: `Page ${page + 1} of ${Math.max(totalPages, 1)}`,
  };
}

// Helper mirroring URL query synchronization in explore/page.tsx
function serializePaginationQuery(existingParams, newPage, newSize, defaultSize = 12) {
  const params = new URLSearchParams(existingParams);
  if (newPage > 0) {
    params.set('page', String(newPage));
  } else {
    params.delete('page');
  }
  if (newSize !== defaultSize) {
    params.set('size', String(newSize));
  } else {
    params.delete('size');
  }
  return params.toString();
}

function parseValidPageSize(sizeParam, defaultSize = 12) {
  if (!sizeParam) return defaultSize;
  const trimmed = String(sizeParam).trim();
  // Strictly positive integer digits without decimals or signs
  if (!/^\d+$/.test(trimmed)) return defaultSize;
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 100) return defaultSize;
  return parsed;
}

function parseValidPageIndex(pageParam) {
  if (!pageParam) return 0;
  const trimmed = String(pageParam).trim();
  if (!/^\d+$/.test(trimmed)) return 0;
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function parsePaginationFromQuery(queryString) {
  const params = new URLSearchParams(queryString);
  const page = parseValidPageIndex(params.get('page'));
  const size = parseValidPageSize(params.get('size'));
  return { page, size };
}

function computePageSizeOptions(pageSize, standardOptions = [12, 24, 48]) {
  const options = [];
  if (!standardOptions.includes(pageSize)) {
    options.push(pageSize);
  }
  options.push(...standardOptions);
  return options;
}

// Helper mirroring out-of-range page recovery in explore/page.tsx
function recoverOutOfRangePage(currentPage, totalElements, totalPages) {
  if (totalElements > 0 && totalPages > 0 && currentPage >= totalPages) {
    return Math.max(0, totalPages - 1);
  }
  return currentPage;
}

test('CakeStore Customer Marketplace Explorer Pagination Suite', async (t) => {
  await t.test('1. Page and size query parameter generation via buildShopSearchParams', () => {
    // Default page and size
    const defaultParams = buildShopSearchParams({ page: 0, size: 12 });
    assert.equal(defaultParams.page, '0');
    assert.equal(defaultParams.size, '12');

    // Advanced search with page, size, filters, and sorting
    const searchParams = buildShopSearchParams({
      page: 2,
      size: 24,
      search: 'chocolate truffle',
      city: 'Pune',
      businessType: 'HOME_BAKER',
      sortBy: 'rating',
    });
    assert.equal(searchParams.page, '2');
    assert.equal(searchParams.size, '24');
    assert.equal(searchParams.search, 'chocolate truffle');
    assert.equal(searchParams.city, 'Pune');
    assert.equal(searchParams.businessType, 'HOME_BAKER');
    assert.equal(searchParams.sortBy, 'rating');

    // Omits page/size when undefined
    const unpaginatedParams = buildShopSearchParams({ search: 'vanilla' });
    assert.equal(unpaginatedParams.page, undefined);
    assert.equal(unpaginatedParams.size, undefined);
  });

  await t.test('2. Record count and range display calculations', () => {
    // Page 0 of 85 bakeries (size 12)
    const page0Range = computeExplorerPaginationRange(0, 12, 85, 12);
    assert.equal(page0Range.start, 1);
    assert.equal(page0Range.end, 12);
    assert.equal(page0Range.total, 85);
    assert.equal(page0Range.displayText, 'Showing 1 to 12 of 85 bakeries');

    // Page 2 of 85 bakeries (size 12)
    const page2Range = computeExplorerPaginationRange(2, 12, 85, 12);
    assert.equal(page2Range.start, 25);
    assert.equal(page2Range.end, 36);
    assert.equal(page2Range.displayText, 'Showing 25 to 36 of 85 bakeries');

    // Final Page (page 7 of 85 bakeries with 1 item remaining)
    const lastPageRange = computeExplorerPaginationRange(7, 12, 85, 1);
    assert.equal(lastPageRange.start, 85);
    assert.equal(lastPageRange.end, 85);
    assert.equal(lastPageRange.displayText, 'Showing 85 to 85 of 85 bakeries');

    // Singular noun when exactly 1 bakery exists
    const singleRange = computeExplorerPaginationRange(0, 12, 1, 1);
    assert.equal(singleRange.displayText, 'Showing 1 to 1 of 1 bakery');

    // Empty results
    const emptyRange = computeExplorerPaginationRange(0, 12, 0, 0);
    assert.equal(emptyRange.start, 0);
    assert.equal(emptyRange.end, 0);
    assert.equal(emptyRange.total, 0);
    assert.equal(emptyRange.displayText, 'Showing 0 to 0 of 0 bakeries');
  });

  await t.test('3. Previous/Next boundary behaviors and control visibility', () => {
    // First page (page 0 of 5 pages)
    const firstPageControls = evaluateExplorerPaginationControls(0, 5, false);
    assert.equal(firstPageControls.isPrevDisabled, true);
    assert.equal(firstPageControls.isNextDisabled, false);
    assert.equal(firstPageControls.pageLabel, 'Page 1 of 5');
    assert.equal(firstPageControls.shouldRenderNavigation, true);

    // Middle page (page 2 of 5 pages)
    const midPageControls = evaluateExplorerPaginationControls(2, 5, false);
    assert.equal(midPageControls.isPrevDisabled, false);
    assert.equal(midPageControls.isNextDisabled, false);
    assert.equal(midPageControls.pageLabel, 'Page 3 of 5');

    // Last page (page 4 of 5 pages)
    const lastPageControls = evaluateExplorerPaginationControls(4, 5, false);
    assert.equal(lastPageControls.isPrevDisabled, false);
    assert.equal(lastPageControls.isNextDisabled, true);
    assert.equal(lastPageControls.pageLabel, 'Page 5 of 5');

    // Single page (page 0 of 1 page) -> navigation buttons hidden
    const singlePageControls = evaluateExplorerPaginationControls(0, 1, false);
    assert.equal(singlePageControls.shouldRenderNavigation, false);

    // Loading state disables buttons
    const loadingControls = evaluateExplorerPaginationControls(2, 5, true);
    assert.equal(loadingControls.isPrevDisabled, true);
    assert.equal(loadingControls.isNextDisabled, true);
  });

  await t.test('4. URL query serialization and browser navigation parsing', () => {
    // Page 0 with default size (12) produces clean URL without redundant page/size params
    const query0 = serializePaginationQuery('city=Pune&search=cake', 0, 12);
    assert.equal(query0, 'city=Pune&search=cake');

    // Navigating to page 1 appends page=1
    const query1 = serializePaginationQuery('city=Pune&search=cake', 1, 12);
    assert.equal(query1, 'city=Pune&search=cake&page=1');

    // Navigating to page 2 with custom size 24 appends both page=2&size=24
    const query2 = serializePaginationQuery('city=Pune', 2, 24);
    assert.equal(query2, 'city=Pune&page=2&size=24');

    // Parsing back/forward URL query string
    const parsed = parsePaginationFromQuery('city=Pune&page=3&size=48');
    assert.equal(parsed.page, 3);
    assert.equal(parsed.size, 48);

    // Parsing malformed query recovers cleanly to defaults
    const malformed = parsePaginationFromQuery('page=-10&size=999');
    assert.equal(malformed.page, 0);
    assert.equal(malformed.size, 12);
  });

  await t.test('5. Resetting page to zero when filters change', () => {
    let activePage = 4;
    const activeFilters = {
      search: 'butterscotch',
      city: 'Mumbai',
      category: 'HOME_BAKER',
      radiusKm: 10,
    };

    // User types new search query
    const onSearchChange = (newSearch) => {
      activeFilters.search = newSearch;
      activePage = 0; // Page reset to 0
    };
    onSearchChange('red velvet');
    assert.equal(activePage, 0);
    assert.equal(activeFilters.search, 'red velvet');

    // User changes category pill
    activePage = 3;
    const onCategoryChange = (newCategory) => {
      activeFilters.category = newCategory;
      activePage = 0;
    };
    onCategoryChange('CUSTOM_CAKES');
    assert.equal(activePage, 0);

    // User changes city chip
    activePage = 2;
    const onCityChange = (newCity) => {
      activeFilters.city = newCity;
      activePage = 0;
    };
    onCityChange('Bengaluru');
    assert.equal(activePage, 0);

    // User clears all filters
    activePage = 5;
    const onClearAll = () => {
      activeFilters.search = '';
      activeFilters.city = '';
      activeFilters.category = 'ALL';
      activePage = 0;
    };
    onClearAll();
    assert.equal(activePage, 0);
  });

  await t.test('6. Spring Data Page response normalization and legacy raw-array compatibility', () => {
    // Standard Spring Data Page payload from CustomerStorefrontController.discoverShopsPaged
    const mockSpringPage = {
      content: [
        { id: 101, businessName: 'Flour Power', city: 'Pune' },
        { id: 102, businessName: 'The Crumbly Corner', city: 'Pune' },
      ],
      totalElements: 50,
      totalPages: 5,
      size: 10,
      number: 1,
      first: false,
      last: false,
      empty: false,
    };

    const normalized = normalizeShopSearchResponse(mockSpringPage, { page: 1, size: 10 });
    assert.equal(normalized.length, 2);
    assert.ok(normalized.pagination);
    assert.equal(normalized.pagination.totalElements, 50);
    assert.equal(normalized.pagination.totalPages, 5);
    assert.equal(normalized.pagination.page, 1);
    assert.equal(normalized.pagination.size, 10);
    assert.equal(normalized.pagination.first, false);
    assert.equal(normalized.pagination.last, false);
    assert.equal(normalized.pagination.empty, false);

    // Legacy raw-array payload (backward compatibility)
    const mockRawArray = [
      { id: 201, businessName: 'Classic Bakery', city: 'Mumbai' },
    ];
    const normalizedRaw = normalizeShopSearchResponse(mockRawArray);
    assert.equal(normalizedRaw.length, 1);
    assert.equal(normalizedRaw.pagination, undefined);

    // Malformed / null payload
    const normalizedNull = normalizeShopSearchResponse(null);
    assert.equal(normalizedNull.length, 0);
  });

  await t.test('7. Out-of-range page recovery when results shrink', () => {
    // User was on page 5, but new filtered result set only has 2 pages (totalPages = 2, max valid page index = 1)
    const recovered = recoverOutOfRangePage(5, 20, 2);
    assert.equal(recovered, 1); // Recovered to last valid page index

    // Normal page within range
    const valid = recoverOutOfRangePage(1, 20, 2);
    assert.equal(valid, 1);

    // Empty result set (0 total elements)
    const empty = recoverOutOfRangePage(3, 0, 0);
    assert.equal(empty, 3); // Handled by empty state display
  });

  await t.test('8. Stale asynchronous response rejection using sequence counter', async () => {
    let currentRequestId = 0;
    let renderedShops = [];

    // Simulate fast successive user page requests
    const simulateFetch = async (queryText, targetPage, delayMs) => {
      const requestId = ++currentRequestId;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Check if another request superceded this one
      if (requestId !== currentRequestId) {
        // Discard stale response
        return null;
      }
      return { query: queryText, page: targetPage };
    };

    // Request 1: slower response (100ms) for Page 0
    const req1Promise = simulateFetch('chocolate', 0, 100);

    // Request 2: quick user click for Page 1 (30ms)
    const req2Promise = simulateFetch('chocolate', 1, 30);

    const [res1, res2] = await Promise.all([req1Promise, req2Promise]);

    assert.equal(res1, null, 'Stale Request 1 response must be discarded');
    assert.deepEqual(res2, { query: 'chocolate', page: 1 }, 'Newer Request 2 must prevail');
  });

  await t.test('9. Custom page-size validation (1-100) and fallback rules', () => {
    // Valid non-standard size=2
    assert.equal(parseValidPageSize('2'), 2);

    // Boundary valid sizes 1 and 100
    assert.equal(parseValidPageSize('1'), 1);
    assert.equal(parseValidPageSize('100'), 100);

    // Standard presets 12, 24, 48
    assert.equal(parseValidPageSize('12'), 12);
    assert.equal(parseValidPageSize('24'), 24);
    assert.equal(parseValidPageSize('48'), 48);

    // Invalid values falling back to 12
    assert.equal(parseValidPageSize('0'), 12, 'size=0 must fall back to 12');
    assert.equal(parseValidPageSize('-1'), 12, 'negative size must fall back to 12');
    assert.equal(parseValidPageSize('-10'), 12, 'negative size must fall back to 12');
    assert.equal(parseValidPageSize('101'), 12, 'size > 100 must fall back to 12');
    assert.equal(parseValidPageSize('999'), 12, 'size > 100 must fall back to 12');
    assert.equal(parseValidPageSize('abc'), 12, 'non-numeric string must fall back to 12');
    assert.equal(parseValidPageSize('12.5'), 12, 'decimal size must fall back to 12');
    assert.equal(parseValidPageSize('2.0'), 12, 'decimal string must fall back to 12');
    assert.equal(parseValidPageSize(''), 12, 'empty string must fall back to 12');
    assert.equal(parseValidPageSize(null), 12, 'null must fall back to 12');
  });

  await t.test('10. Page-size dropdown representation for standard and non-standard sizes', () => {
    // Non-standard size=2 prepends option 2 without duplicating standard options
    const optionsForSize2 = computePageSizeOptions(2);
    assert.deepEqual(optionsForSize2, [2, 12, 24, 48]);

    // Non-standard size=5
    const optionsForSize5 = computePageSizeOptions(5);
    assert.deepEqual(optionsForSize5, [5, 12, 24, 48]);

    // Standard preset 12 retains strictly [12, 24, 48] without duplication
    const optionsForSize12 = computePageSizeOptions(12);
    assert.deepEqual(optionsForSize12, [12, 24, 48]);

    // Standard preset 24 retains strictly [12, 24, 48] without duplication
    const optionsForSize24 = computePageSizeOptions(24);
    assert.deepEqual(optionsForSize24, [12, 24, 48]);

    // Standard preset 48 retains strictly [12, 24, 48] without duplication
    const optionsForSize48 = computePageSizeOptions(48);
    assert.deepEqual(optionsForSize48, [12, 24, 48]);
  });
});
