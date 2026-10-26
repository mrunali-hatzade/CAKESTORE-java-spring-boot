import test from 'node:test';
import assert from 'node:assert/strict';

// Helper mirroring the calculation of record range and boundary buttons
function computePaginationRange(page, pageSize, totalElements) {
  if (totalElements === 0) {
    return {
      from: 0,
      to: 0,
      total: 0,
      displayText: 'Showing 0 to 0 of 0 records',
    };
  }
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalElements);
  return {
    from,
    to,
    total: totalElements,
    displayText: `Showing ${from} to ${to} of ${totalElements} records`,
  };
}

function evaluatePaginationControls(page, totalPages, loading) {
  const isPrevDisabled = page === 0 || Boolean(loading);
  const isNextDisabled = page >= Math.max(totalPages - 1, 0) || Boolean(loading);
  return {
    isPrevDisabled,
    isNextDisabled,
    pageLabel: `Page ${page + 1} of ${Math.max(totalPages, 1)}`,
  };
}

function normalizePaymentResponse(res) {
  if (Array.isArray(res)) {
    return {
      content: res,
      pageable: {},
      totalElements: res.length,
      totalPages: 1,
      last: true,
      size: res.length,
      number: 0,
      sort: {},
      numberOfElements: res.length,
      first: true,
      empty: res.length === 0,
    };
  }
  return {
    content: res?.content || [],
    totalElements: res?.totalElements || 0,
    totalPages: res?.totalPages || 0,
    number: res?.number || 0,
    size: res?.size || 10,
    first: res?.first ?? (res?.number === 0),
    last: res?.last ?? (res?.number >= (res?.totalPages || 1) - 1),
    empty: res?.empty ?? ((res?.content?.length || 0) === 0),
  };
}

function recoverFromEmptyFinalPage(requestedPage, contentCount, totalPages) {
  if (requestedPage > 0 && contentCount === 0 && totalPages > 0) {
    return Math.max(0, totalPages - 1);
  }
  return requestedPage;
}

test('CakeStore Owner Subscription Billing History Pagination Tests', async (t) => {
  await t.test('1. Default page 0 and size 10 range calculations', () => {
    const range = computePaginationRange(0, 10, 25);
    assert.equal(range.from, 1);
    assert.equal(range.to, 10);
    assert.equal(range.total, 25);
    assert.equal(range.displayText, 'Showing 1 to 10 of 25 records');
  });

  await t.test('2. Mid-page and final-page range calculations', () => {
    const midRange = computePaginationRange(1, 10, 25);
    assert.equal(midRange.from, 11);
    assert.equal(midRange.to, 20);
    assert.equal(midRange.displayText, 'Showing 11 to 20 of 25 records');

    const finalRange = computePaginationRange(2, 10, 25);
    assert.equal(finalRange.from, 21);
    assert.equal(finalRange.to, 25);
    assert.equal(finalRange.displayText, 'Showing 21 to 25 of 25 records');
  });

  await t.test('3. Empty result pagination range', () => {
    const emptyRange = computePaginationRange(0, 10, 0);
    assert.equal(emptyRange.from, 0);
    assert.equal(emptyRange.to, 0);
    assert.equal(emptyRange.total, 0);
    assert.equal(emptyRange.displayText, 'Showing 0 to 0 of 0 records');
  });

  await t.test('4. Boundary button states on first page, middle page, and last page', () => {
    // First page of 3
    const firstPage = evaluatePaginationControls(0, 3, false);
    assert.equal(firstPage.isPrevDisabled, true);
    assert.equal(firstPage.isNextDisabled, false);
    assert.equal(firstPage.pageLabel, 'Page 1 of 3');

    // Middle page of 3
    const midPage = evaluatePaginationControls(1, 3, false);
    assert.equal(midPage.isPrevDisabled, false);
    assert.equal(midPage.isNextDisabled, false);
    assert.equal(midPage.pageLabel, 'Page 2 of 3');

    // Last page of 3
    const lastPage = evaluatePaginationControls(2, 3, false);
    assert.equal(lastPage.isPrevDisabled, false);
    assert.equal(lastPage.isNextDisabled, true);
    assert.equal(lastPage.pageLabel, 'Page 3 of 3');

    // Single page total
    const singlePage = evaluatePaginationControls(0, 1, false);
    assert.equal(singlePage.isPrevDisabled, true);
    assert.equal(singlePage.isNextDisabled, true);
    assert.equal(singlePage.pageLabel, 'Page 1 of 1');
  });

  await t.test('5. Loading state disables both navigation buttons', () => {
    const loadingState = evaluatePaginationControls(1, 3, true);
    assert.equal(loadingState.isPrevDisabled, true);
    assert.equal(loadingState.isNextDisabled, true);
  });

  await t.test('6. Out-of-bounds page recovery when data changes', () => {
    // Owner was on page 3, but records were pruned so totalPages is now 2
    const recovered = recoverFromEmptyFinalPage(3, 0, 2);
    assert.equal(recovered, 1, 'Should recover to last available page index (totalPages - 1)');

    // Normal non-empty page does not redirect
    const normal = recoverFromEmptyFinalPage(1, 5, 2);
    assert.equal(normal, 1);
  });

  await t.test('7. API response normalization handles Spring Page and legacy Array', () => {
    // Spring Data Page
    const pageResponse = {
      content: [{ id: 101, amount: 499, status: 'COMPLETED' }],
      totalElements: 25,
      totalPages: 3,
      number: 0,
      size: 10,
    };
    const normalizedPage = normalizePaymentResponse(pageResponse);
    assert.equal(normalizedPage.content.length, 1);
    assert.equal(normalizedPage.totalElements, 25);
    assert.equal(normalizedPage.totalPages, 3);
    assert.equal(normalizedPage.number, 0);

    // Legacy plain Array
    const legacyArray = [
      { id: 201, amount: 999, status: 'COMPLETED' },
      { id: 202, amount: 999, status: 'COMPLETED' },
    ];
    const normalizedArray = normalizePaymentResponse(legacyArray);
    assert.equal(normalizedArray.content.length, 2);
    assert.equal(normalizedArray.totalElements, 2);
    assert.equal(normalizedArray.totalPages, 1);
  });
});
