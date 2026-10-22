import test from 'node:test';
import assert from 'node:assert/strict';

export function buildShopSearchParams(filters = {}) {
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

export function normalizeShopSearchResponse(raw, requestedFilters) {
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

  // Malformed, null, undefined, or unexpected shape
  const emptyList = [];
  return emptyList;
}

export function normalizeToPaginatedResponse(raw, requestedFilters) {
  const list = normalizeShopSearchResponse(raw, requestedFilters);
  const pagination = list.pagination;

  return {
    content: list,
    totalElements: pagination?.totalElements ?? list.length,
    totalPages: pagination?.totalPages ?? (list.length > 0 ? 1 : 0),
    number: pagination?.page ?? (requestedFilters?.page ?? 0),
    size: pagination?.size ?? (requestedFilters?.size ?? (list.length || 20)),
    first: pagination?.first ?? true,
    last: pagination?.last ?? true,
    empty: pagination?.empty ?? (list.length === 0),
    numberOfElements: list.length,
    pageable: null,
    sort: null,
  };
}

test('CakeStore Phase 2E.2: Paginated Bakery Search Response Handling Tests', async (t) => {
  const mockShopA = {
    id: 1,
    businessName: 'The Parisian Bakery',
    city: 'Pune',
    state: 'Maharashtra',
    status: 'ACTIVE',
    rating: 4.8,
  };

  const mockShopB = {
    id: 2,
    businessName: 'Velvet Crust Pastries',
    city: 'Mumbai',
    state: 'Maharashtra',
    status: 'ACTIVE',
    rating: 4.9,
  };

  await t.test('1. Plain array response (unpaginated search) returns array directly', () => {
    const rawArray = [mockShopA, mockShopB];
    const result = normalizeShopSearchResponse(rawArray);

    assert.ok(Array.isArray(result), 'Result must be a JavaScript Array');
    assert.equal(result.length, 2, 'Must contain all 2 shops');
    assert.equal(result[0].id, 1);
    assert.equal(result[1].id, 2);
    assert.equal(result[0].businessName, 'The Parisian Bakery');
  });

  await t.test('2. Valid Spring Page response with content, totalElements, totalPages, number, and size', () => {
    const springPage = {
      content: [mockShopA, mockShopB],
      pageable: { pageNumber: 1, pageSize: 2 },
      totalElements: 50,
      totalPages: 25,
      size: 2,
      number: 1,
      numberOfElements: 2,
      first: false,
      last: false,
      empty: false,
    };

    const result = normalizeShopSearchResponse(springPage, { page: 1, size: 2 });

    // Must NOT be turned into an empty array (the bug in Phase 2E audit)
    assert.ok(Array.isArray(result), 'Result must be an Array');
    assert.equal(result.length, 2, 'Result must contain the page content items');
    assert.equal(result[0].id, 1);
    assert.equal(result[1].id, 2);

    // Verify attached pagination metadata
    assert.ok(result.pagination, 'Pagination metadata must be preserved on the returned list');
    assert.equal(result.pagination.totalElements, 50);
    assert.equal(result.pagination.totalPages, 25);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.size, 2);
    assert.equal(result.pagination.first, false);
    assert.equal(result.pagination.last, false);
    assert.equal(result.pagination.empty, false);
  });

  await t.test('3. Empty Spring Page response returns empty array with accurate empty metadata', () => {
    const emptyPage = {
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: true,
    };

    const result = normalizeShopSearchResponse(emptyPage);

    assert.ok(Array.isArray(result), 'Result must be an Array');
    assert.equal(result.length, 0, 'Length must be 0');
    assert.ok(result.pagination, 'Pagination metadata should be present');
    assert.equal(result.pagination.totalElements, 0);
    assert.equal(result.pagination.totalPages, 0);
    assert.equal(result.pagination.empty, true);
    assert.equal(result.pagination.first, true);
    assert.equal(result.pagination.last, true);
  });

  await t.test('4. Malformed, null, undefined, or unexpected shapes recover safely without throwing', () => {
    // Null
    const resNull = normalizeShopSearchResponse(null);
    assert.ok(Array.isArray(resNull));
    assert.equal(resNull.length, 0);

    // Undefined
    const resUndef = normalizeShopSearchResponse(undefined);
    assert.ok(Array.isArray(resUndef));
    assert.equal(resUndef.length, 0);

    // String / Error message
    const resStr = normalizeShopSearchResponse('502 Bad Gateway');
    assert.ok(Array.isArray(resStr));
    assert.equal(resStr.length, 0);

    // Number
    const resNum = normalizeShopSearchResponse(500);
    assert.ok(Array.isArray(resNum));
    assert.equal(resNum.length, 0);

    // Object with error structure
    const resErrObj = normalizeShopSearchResponse({ error: 'Database unavailable', status: 503 });
    assert.ok(Array.isArray(resErrObj));
    assert.equal(resErrObj.length, 0);

    // Object with non-array content
    const resInvalidContent = normalizeShopSearchResponse({ content: 'invalid' });
    assert.ok(Array.isArray(resInvalidContent));
    assert.equal(resInvalidContent.length, 0);
  });

  await t.test('5. normalizeToPaginatedResponse formats full PaginatedResponse contract', () => {
    // A: From Spring Page
    const springPage = {
      content: [mockShopA],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: false,
    };
    const pagedA = normalizeToPaginatedResponse(springPage);
    assert.equal(pagedA.content.length, 1);
    assert.equal(pagedA.totalElements, 1);
    assert.equal(pagedA.totalPages, 1);
    assert.equal(pagedA.number, 0);
    assert.equal(pagedA.first, true);
    assert.equal(pagedA.last, true);
    assert.equal(pagedA.empty, false);

    // B: From plain array
    const pagedB = normalizeToPaginatedResponse([mockShopA, mockShopB]);
    assert.equal(pagedB.content.length, 2);
    assert.equal(pagedB.totalElements, 2);
    assert.equal(pagedB.totalPages, 1);
    assert.equal(pagedB.number, 0);

    // C: From malformed
    const pagedC = normalizeToPaginatedResponse(null);
    assert.equal(pagedC.content.length, 0);
    assert.equal(pagedC.totalElements, 0);
    assert.equal(pagedC.empty, true);
  });

  await t.test('6. buildShopSearchParams maps all filter parameters accurately without regressions', () => {
    const filters = {
      search: 'chocolate',
      location: 'Kothrud',
      state: 'Maharashtra',
      district: 'Pune',
      city: 'Pune',
      area: 'Kothrud',
      pincode: '411038',
      country: 'India',
      businessType: 'HOME_BAKERY',
      latitude: 18.5074,
      longitude: 73.8077,
      radiusKm: 15.5,
      sortBy: 'rating',
      page: 2,
      size: 10,
    };

    const params = buildShopSearchParams(filters);

    assert.equal(params.search, 'chocolate');
    assert.equal(params.location, 'Kothrud');
    assert.equal(params.state, 'Maharashtra');
    assert.equal(params.district, 'Pune');
    assert.equal(params.city, 'Pune');
    assert.equal(params.area, 'Kothrud');
    assert.equal(params.pincode, '411038');
    assert.equal(params.country, 'India');
    assert.equal(params.businessType, 'HOME_BAKERY');
    assert.equal(params.latitude, '18.5074');
    assert.equal(params.longitude, '73.8077');
    assert.equal(params.radiusKm, '15.5');
    assert.equal(params.sortBy, 'rating');
    assert.equal(params.page, '2');
    assert.equal(params.size, '10');

    // Ignores 'ALL' filters
    const allFilters = {
      state: 'All States',
      city: 'All Cities',
      businessType: 'ALL',
    };
    const paramsAll = buildShopSearchParams(allFilters);
    assert.equal(paramsAll.state, undefined);
    assert.equal(paramsAll.city, undefined);
    assert.equal(paramsAll.businessType, undefined);
  });

  await t.test('7. Compatibility with existing callers (Array method calls, spread, and state setting)', () => {
    const springPage = {
      content: [mockShopA, mockShopB],
      totalElements: 2,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: false,
    };

    const data = normalizeShopSearchResponse(springPage);

    // Existing caller pattern 1: Array spread / fallback
    const shops1 = data || [];
    assert.equal(shops1.length, 2);

    // Existing caller pattern 2: .map() iteration
    const names = data.map((s) => s.businessName);
    assert.deepEqual(names, ['The Parisian Bakery', 'Velvet Crust Pastries']);

    // Existing caller pattern 3: Array.isArray check
    assert.equal(Array.isArray(data), true);

    // Existing caller pattern 4: for...of iteration
    let count = 0;
    for (const shop of data) {
      count++;
      assert.ok(shop.id > 0);
    }
    assert.equal(count, 2);
  });
});
