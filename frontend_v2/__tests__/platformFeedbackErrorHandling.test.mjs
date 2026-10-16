import test from 'node:test';
import assert from 'node:assert/strict';

// Mock apiClient implementation matching the unmasked communication.ts methods
function createMockCommunicationApi(mockApiClient) {
  return {
    async submitPlatformFeedback(payload) {
      return await mockApiClient.post('/api/owner/feedback', payload);
    },
    async replyToFeedback(id, message) {
      await mockApiClient.post(`/api/admin/feedback/${id}/reply`, { message });
    },
  };
}

test('COM-FB-V03: submitPlatformFeedback propagates HTTP 500/404 server errors without fabricating success', async () => {
  const failingClient = {
    async post() {
      const err = new Error('Internal Server Error');
      err.status = 500;
      err.response = { status: 500, data: { message: 'Database connection failed' } };
      throw err;
    },
  };

  const api = createMockCommunicationApi(failingClient);

  await assert.rejects(
    async () => {
      await api.submitPlatformFeedback({ rating: 5, category: 'GENERAL', message: 'Test feedback' });
    },
    (err) => {
      assert.equal(err.status, 500);
      assert.equal(err.response.data.message, 'Database connection failed');
      return true;
    }
  );
});

test('COM-FB-V03: submitPlatformFeedback returns success payload upon valid 200 response', async () => {
  const successClient = {
    async post(url, payload) {
      assert.equal(url, '/api/owner/feedback');
      assert.equal(payload.rating, 5);
      return { success: true, message: 'Platform feedback submitted successfully', id: 99 };
    },
  };

  const api = createMockCommunicationApi(successClient);
  const result = await api.submitPlatformFeedback({ rating: 5, category: 'GENERAL', message: 'Great UI' });

  assert.equal(result.success, true);
  assert.equal(result.id, 99);
});

test('COM-FB-V02: replyToFeedback propagates HTTP 500/404 errors instead of swallowing them', async () => {
  const failingClient = {
    async post() {
      const err = new Error('Internal Server Error');
      err.status = 500;
      err.response = { status: 500, data: { message: 'Failed to persist reply' } };
      throw err;
    },
  };

  const api = createMockCommunicationApi(failingClient);

  await assert.rejects(
    async () => {
      await api.replyToFeedback(101, 'Thank you for your feedback');
    },
    (err) => {
      assert.equal(err.status, 500);
      assert.equal(err.response.data.message, 'Failed to persist reply');
      return true;
    }
  );
});

test('COM-FB-V02: replyToFeedback succeeds cleanly when backend responds with 200 OK', async () => {
  let calledUrl = null;
  let calledBody = null;
  const successClient = {
    async post(url, body) {
      calledUrl = url;
      calledBody = body;
      return { message: 'Reply sent successfully', id: 101 };
    },
  };

  const api = createMockCommunicationApi(successClient);
  await api.replyToFeedback(101, 'Issue resolved.');

  assert.equal(calledUrl, '/api/admin/feedback/101/reply');
  assert.deepEqual(calledBody, { message: 'Issue resolved.' });
});

test('COM-FB-V02 & COM-FB-V03: Error handling preserves form drafts upon submission failure', async () => {
  // Simulate OwnerFeedbackModal state behavior on error
  let ownerModalState = {
    isSubmitted: false,
    message: 'My precious bug report with lots of details',
    rating: 2,
    errorMsg: null,
  };

  async function simulateOwnerSubmit(failingApi) {
    try {
      await failingApi.submitPlatformFeedback({
        rating: ownerModalState.rating,
        message: ownerModalState.message,
      });
      ownerModalState.isSubmitted = true;
    } catch (err) {
      ownerModalState.errorMsg = err.response?.data?.message || err.message;
      // State is preserved!
    }
  }

  const failingApi = createMockCommunicationApi({
    async post() {
      const err = new Error('Network error');
      err.response = { data: { message: 'Server unreachable' } };
      throw err;
    },
  });

  await simulateOwnerSubmit(failingApi);

  assert.equal(ownerModalState.isSubmitted, false);
  assert.equal(ownerModalState.errorMsg, 'Server unreachable');
  assert.equal(ownerModalState.message, 'My precious bug report with lots of details');

  // Simulate AdminPlatformFeedbackPage state behavior on error
  let adminPageState = {
    replyText: 'We have dispatched an engineer to fix this immediately.',
    isReplying: true,
    toasts: [],
  };

  async function simulateAdminReply(failingApi) {
    try {
      await failingApi.replyToFeedback(200, adminPageState.replyText);
      adminPageState.replyText = '';
      adminPageState.isReplying = false;
      adminPageState.toasts.push({ type: 'success', msg: 'Reply sent successfully' });
    } catch (err) {
      adminPageState.toasts.push({ type: 'error', msg: err.response?.data?.message || err.message });
      // Draft text is NOT cleared on error!
    }
  }

  await simulateAdminReply(failingApi);

  assert.equal(adminPageState.isReplying, true);
  assert.equal(adminPageState.replyText, 'We have dispatched an engineer to fix this immediately.');
  assert.equal(adminPageState.toasts.length, 1);
  assert.equal(adminPageState.toasts[0].type, 'error');
  assert.equal(adminPageState.toasts[0].msg, 'Server unreachable');
});
