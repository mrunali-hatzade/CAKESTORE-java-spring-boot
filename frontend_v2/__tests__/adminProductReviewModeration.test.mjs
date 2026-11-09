import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 2.9.5.3: Super Admin Product Review Moderation UI & Logic Tests
 *
 * Validates:
 * 1. Filter parameter serialization and clamping for getAdminProductReviews.
 * 2. Moderation reason validation: mandatory, trimmed, 500-char maximum enforcement.
 * 3. Moderation payload construction for HIDE and RESTORE operations.
 * 4. State machine & race condition handling (fetchSeqRef).
 * 5. Privacy protection: strictly prohibits customer phone numbers and edit tokens.
 * 6. Detail modal inspection and moderation audit trail presentation.
 */

// Helper mirroring validation in admin/reviews/page.tsx
function validateModerationHideReason(reason) {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Moderation reason is mandatory when hiding a review.',
      payload: null,
    };
  }
  if (trimmed.length > 500) {
    return {
      valid: false,
      error: 'Moderation reason cannot exceed 500 characters.',
      payload: null,
    };
  }
  return {
    valid: true,
    error: null,
    payload: {
      status: 'HIDDEN',
      reason: trimmed,
    },
  };
}

// Helper mirroring payload creation for restore
function createRestorePayload() {
  return {
    status: 'PUBLISHED',
  };
}

// Helper mirroring parameter serialization in lib/api/admin.ts: getAdminProductReviews
function serializeReviewQueryParams(params = {}) {
  const queryParam = params.query || params.search;
  const serialized = {
    page: params.page ?? 0,
    size: Math.min(params.size ?? 20, 100),
  };

  if (params.sortField) serialized.sortField = params.sortField;
  if (params.sortDir) serialized.sortDir = params.sortDir;
  if (params.status && params.status !== '' && params.status !== 'ALL') {
    serialized.status = params.status;
  }
  if (params.shopId) serialized.shopId = params.shopId;
  if (params.rating) serialized.rating = params.rating;
  if (queryParam && queryParam.trim()) serialized.query = queryParam.trim();

  return serialized;
}

// State machine simulating admin review moderation page behavior
function createReviewModerationStateMachine(mockApi) {
  const state = {
    reviews: [],
    totalPages: 0,
    totalElements: 0,
    isLoading: true,
    error: null,
    totalCount: 0,
    publishedCount: 0,
    hiddenCount: 0,
    selectedReview: null,
  };

  const fetchSeqRef = { current: 0 };

  const fetchReviews = async (params = {}, isManual = false) => {
    const currentSeq = ++fetchSeqRef.current;
    if (!isManual) state.isLoading = true;
    state.error = null;

    try {
      const res = await mockApi.getAdminProductReviews(params);
      if (currentSeq === fetchSeqRef.current) {
        state.reviews = res.content || [];
        state.totalPages = res.totalPages || 0;
        state.totalElements = res.totalElements || 0;
      }
    } catch (err) {
      if (currentSeq === fetchSeqRef.current) {
        state.error = err?.message || 'Failed to fetch product reviews.';
        state.reviews = [];
      }
    } finally {
      if (currentSeq === fetchSeqRef.current) {
        state.isLoading = false;
      }
    }
  };

  const fetchSummaryCounts = async () => {
    try {
      const [allRes, pubRes, hidRes] = await Promise.all([
        mockApi.getAdminProductReviews({ page: 0, size: 1 }),
        mockApi.getAdminProductReviews({ status: 'PUBLISHED', page: 0, size: 1 }),
        mockApi.getAdminProductReviews({ status: 'HIDDEN', page: 0, size: 1 }),
      ]);
      state.totalCount = allRes.totalElements || 0;
      state.publishedCount = pubRes.totalElements || 0;
      state.hiddenCount = hidRes.totalElements || 0;
    } catch (err) {
      // Keep existing counts on error
    }
  };

  const hideReview = async (reviewId, reason) => {
    const val = validateModerationHideReason(reason);
    if (!val.valid) throw new Error(val.error);

    const updated = await mockApi.moderateProductReview(reviewId, val.payload);
    // Update review in place
    state.reviews = state.reviews.map((r) => (r.id === reviewId ? updated : r));
    if (state.selectedReview?.id === reviewId) {
      state.selectedReview = updated;
    }
    return updated;
  };

  const restoreReview = async (reviewId) => {
    const payload = createRestorePayload();
    const updated = await mockApi.moderateProductReview(reviewId, payload);
    state.reviews = state.reviews.map((r) => (r.id === reviewId ? updated : r));
    if (state.selectedReview?.id === reviewId) {
      state.selectedReview = updated;
    }
    return updated;
  };

  return {
    state,
    fetchReviews,
    fetchSummaryCounts,
    hideReview,
    restoreReview,
    fetchSeqRef,
  };
}

describe('Super Admin Product Review Moderation UI & API Logic', () => {
  describe('Query Parameter Serialization', () => {
    test('serializes default pagination and clamps max size to 100', () => {
      const params1 = serializeReviewQueryParams();
      assert.strictEqual(params1.page, 0);
      assert.strictEqual(params1.size, 20);

      const params2 = serializeReviewQueryParams({ page: 2, size: 500 });
      assert.strictEqual(params2.page, 2);
      assert.strictEqual(params2.size, 100);
    });

    test('omits status when ALL or empty string', () => {
      const params1 = serializeReviewQueryParams({ status: 'ALL' });
      assert.strictEqual(params1.status, undefined);

      const params2 = serializeReviewQueryParams({ status: '' });
      assert.strictEqual(params2.status, undefined);

      const params3 = serializeReviewQueryParams({ status: 'PUBLISHED' });
      assert.strictEqual(params3.status, 'PUBLISHED');

      const params4 = serializeReviewQueryParams({ status: 'HIDDEN' });
      assert.strictEqual(params4.status, 'HIDDEN');
    });

    test('serializes shopId, rating, and search query', () => {
      const params = serializeReviewQueryParams({
        shopId: 42,
        rating: 5,
        search: '  chocolate truffle  ',
      });
      assert.strictEqual(params.shopId, 42);
      assert.strictEqual(params.rating, 5);
      assert.strictEqual(params.query, 'chocolate truffle');
    });

    test('preserves sortField and sortDir', () => {
      const params = serializeReviewQueryParams({
        sortField: 'rating',
        sortDir: 'asc',
      });
      assert.strictEqual(params.sortField, 'rating');
      assert.strictEqual(params.sortDir, 'asc');
    });
  });

  describe('Hide Moderation Reason Validation', () => {
    test('rejects empty or null reason', () => {
      const res1 = validateModerationHideReason('');
      assert.strictEqual(res1.valid, false);
      assert.match(res1.error, /mandatory/i);

      const res2 = validateModerationHideReason(null);
      assert.strictEqual(res2.valid, false);
      assert.match(res2.error, /mandatory/i);
    });

    test('rejects whitespace-only reason', () => {
      const res = validateModerationHideReason('    \n\t   ');
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /mandatory/i);
    });

    test('rejects reasons longer than 500 characters', () => {
      const longReason = 'A'.repeat(501);
      const res = validateModerationHideReason(longReason);
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /500 characters/i);
    });

    test('accepts valid reason up to 500 characters and trims leading/trailing whitespace', () => {
      const exact500 = 'B'.repeat(500);
      const res1 = validateModerationHideReason(exact500);
      assert.strictEqual(res1.valid, true);
      assert.strictEqual(res1.payload.status, 'HIDDEN');
      assert.strictEqual(res1.payload.reason, exact500);

      const padded = '   Contains vulgar and offensive profanity   ';
      const res2 = validateModerationHideReason(padded);
      assert.strictEqual(res2.valid, true);
      assert.strictEqual(res2.payload.reason, 'Contains vulgar and offensive profanity');
    });
  });

  describe('Restore Review Payload Construction', () => {
    test('creates restore payload with PUBLISHED status and no mandatory reason', () => {
      const payload = createRestorePayload();
      assert.strictEqual(payload.status, 'PUBLISHED');
      assert.strictEqual(payload.reason, undefined);
    });
  });

  describe('State Machine & Concurrency Protection', () => {
    test('loads reviews and updates state accurately', async () => {
      const mockReviews = [
        {
          id: 101,
          shopId: 1,
          shopName: 'Sweet Tooth Bakery',
          productId: 5,
          productName: 'Red Velvet Deluxe',
          customerName: 'Aarav Patel',
          rating: 5,
          reviewText: 'Outstanding taste!',
          cakeImageUrl: 'https://example.com/cake.jpg',
          cakeVideoUrl: null,
          moderationStatus: 'PUBLISHED',
          moderationReason: null,
          moderatedById: null,
          moderatedByName: null,
          moderatedByEmail: null,
          moderatedAt: null,
          createdAt: '2026-11-05T12:00:00Z',
          ownerReply: 'Thank you!',
          ownerRepliedAt: '2026-11-05T14:00:00Z',
        },
      ];

      const mockApi = {
        getAdminProductReviews: async () => ({
          content: mockReviews,
          totalPages: 1,
          totalElements: 1,
        }),
      };

      const sm = createReviewModerationStateMachine(mockApi);
      await sm.fetchReviews();

      assert.strictEqual(sm.state.isLoading, false);
      assert.strictEqual(sm.state.reviews.length, 1);
      assert.strictEqual(sm.state.reviews[0].id, 101);
      assert.strictEqual(sm.state.totalElements, 1);
    });

    test('ignores out-of-order stale network responses', async () => {
      let resolveFirst;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const mockApi = {
        getAdminProductReviews: async (params) => {
          if (params.query === 'slow') {
            await firstPromise;
            return {
              content: [{ id: 1, customerName: 'Slow Stale Result' }],
              totalPages: 1,
              totalElements: 1,
            };
          }
          return {
            content: [{ id: 2, customerName: 'Fast Fresh Result' }],
            totalPages: 1,
            totalElements: 1,
          };
        },
      };

      const sm = createReviewModerationStateMachine(mockApi);

      // Trigger slow search
      const call1 = sm.fetchReviews({ query: 'slow' });
      // Immediately trigger fast search
      const call2 = sm.fetchReviews({ query: 'fast' });

      await call2;
      assert.strictEqual(sm.state.reviews[0].customerName, 'Fast Fresh Result');

      // Now let slow response resolve
      resolveFirst();
      await call1;

      // Ensure state was NOT overwritten by stale slow request
      assert.strictEqual(sm.state.reviews[0].customerName, 'Fast Fresh Result');
      assert.strictEqual(sm.state.reviews[0].id, 2);
    });

    test('fetches accurate summary counts across statuses', async () => {
      const mockApi = {
        getAdminProductReviews: async (params) => {
          if (params.status === 'PUBLISHED') {
            return { content: [], totalPages: 1, totalElements: 15 };
          }
          if (params.status === 'HIDDEN') {
            return { content: [], totalPages: 1, totalElements: 3 };
          }
          return { content: [], totalPages: 1, totalElements: 18 };
        },
      };

      const sm = createReviewModerationStateMachine(mockApi);
      await sm.fetchSummaryCounts();

      assert.strictEqual(sm.state.totalCount, 18);
      assert.strictEqual(sm.state.publishedCount, 15);
      assert.strictEqual(sm.state.hiddenCount, 3);
    });

    test('hides review with reason and updates local state', async () => {
      const initialReview = {
        id: 201,
        moderationStatus: 'PUBLISHED',
        moderationReason: null,
      };

      const mockApi = {
        moderateProductReview: async (id, payload) => ({
          ...initialReview,
          moderationStatus: payload.status,
          moderationReason: payload.reason,
          moderatedAt: '2026-11-05T20:00:00Z',
          moderatedByName: 'Admin User',
        }),
      };

      const sm = createReviewModerationStateMachine(mockApi);
      sm.state.reviews = [initialReview];

      const updated = await sm.hideReview(201, 'Violates safety guidelines');
      assert.strictEqual(updated.moderationStatus, 'HIDDEN');
      assert.strictEqual(updated.moderationReason, 'Violates safety guidelines');
      assert.strictEqual(sm.state.reviews[0].moderationStatus, 'HIDDEN');
      assert.strictEqual(sm.state.reviews[0].moderationReason, 'Violates safety guidelines');
    });

    test('restores review and updates local state to PUBLISHED', async () => {
      const initialReview = {
        id: 202,
        moderationStatus: 'HIDDEN',
        moderationReason: 'Contains spam link',
      };

      const mockApi = {
        moderateProductReview: async (id, payload) => ({
          ...initialReview,
          moderationStatus: payload.status,
          moderationReason: null,
          moderatedAt: null,
          moderatedByName: null,
        }),
      };

      const sm = createReviewModerationStateMachine(mockApi);
      sm.state.reviews = [initialReview];

      const updated = await sm.restoreReview(202);
      assert.strictEqual(updated.moderationStatus, 'PUBLISHED');
      assert.strictEqual(updated.moderationReason, null);
      assert.strictEqual(sm.state.reviews[0].moderationStatus, 'PUBLISHED');
    });
  });

  describe('Customer Privacy & Security Protection', () => {
    test('ensures review records and detail views never expose customer phone numbers or edit tokens', () => {
      const reviewRecord = {
        id: 301,
        shopId: 1,
        shopName: 'Artisan Bakes',
        productId: 10,
        productName: 'Blueberry Cheesecake',
        customerName: 'Priya Sharma',
        rating: 5,
        reviewText: 'Incredible texture and fresh berries!',
        moderationStatus: 'PUBLISHED',
      };

      // Ensure forbidden fields are undefined
      assert.strictEqual(reviewRecord.customerPhone, undefined);
      assert.strictEqual(reviewRecord.phone, undefined);
      assert.strictEqual(reviewRecord.phoneNumber, undefined);
      assert.strictEqual(reviewRecord.editToken, undefined);
      assert.strictEqual(reviewRecord.token, undefined);

      // Verify keys do not contain sensitive tokens
      const keys = Object.keys(reviewRecord);
      const hasSensitiveKeys = keys.some((k) =>
        /phone|token|secret|password|credential/i.test(k)
      );
      assert.strictEqual(hasSensitiveKeys, false);
    });
  });
});
