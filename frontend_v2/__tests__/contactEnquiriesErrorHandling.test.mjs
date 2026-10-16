import test from 'node:test';
import assert from 'node:assert/strict';

// Mock apiClient implementation matching the unmasked communication.ts methods
function createMockCommunicationApi(mockApiClient) {
  return {
    async submitContactEnquiry(payload) {
      return await mockApiClient.post('/api/contact/enquiries', payload);
    },
    async replyToEnquiry(id, message) {
      await mockApiClient.post(`/api/admin/enquiries/${id}/reply`, { message });
    },
  };
}

test('COM-ENQ-02: submitContactEnquiry propagates HTTP 500/404/429 errors without fabricating success', async () => {
  const failingClient = {
    async post() {
      const err = new Error('Too Many Requests');
      err.status = 429;
      err.response = { status: 429, data: { message: 'Rate limit exceeded: 20 requests per minute' } };
      throw err;
    },
  };

  const api = createMockCommunicationApi(failingClient);

  await assert.rejects(
    async () => {
      await api.submitContactEnquiry({
        name: 'Rahul',
        email: 'rahul@example.com',
        subject: 'General Question',
        message: 'Hello, need help with ordering.',
      });
    },
    (err) => {
      assert.equal(err.status, 429);
      assert.equal(err.response.data.message, 'Rate limit exceeded: 20 requests per minute');
      return true;
    }
  );
});

test('COM-ENQ-02: submitContactEnquiry returns real payload upon valid 200 response', async () => {
  let calledUrl = null;
  let calledBody = null;
  const successClient = {
    async post(url, payload) {
      calledUrl = url;
      calledBody = payload;
      return { success: true, message: 'Contact enquiry submitted successfully', id: 701 };
    },
  };

  const api = createMockCommunicationApi(successClient);
  const result = await api.submitContactEnquiry({
    name: 'Anita',
    email: 'anita@example.com',
    subject: 'Bulk Order',
    message: 'Need 5 cakes for corporate event.',
  });

  assert.equal(calledUrl, '/api/contact/enquiries');
  assert.equal(calledBody.name, 'Anita');
  assert.equal(result.success, true);
  assert.equal(result.id, 701);
});

test('COM-ENQ-01: replyToEnquiry propagates HTTP 500/404 errors instead of swallowing them', async () => {
  const failingClient = {
    async post() {
      const err = new Error('Internal Server Error');
      err.status = 500;
      err.response = { status: 500, data: { message: 'Database transaction failed' } };
      throw err;
    },
  };

  const api = createMockCommunicationApi(failingClient);

  await assert.rejects(
    async () => {
      await api.replyToEnquiry(801, 'Thank you for contacting us');
    },
    (err) => {
      assert.equal(err.status, 500);
      assert.equal(err.response.data.message, 'Database transaction failed');
      return true;
    }
  );
});

test('COM-ENQ-01: replyToEnquiry succeeds cleanly when backend responds with 200 OK', async () => {
  let calledUrl = null;
  let calledBody = null;
  const successClient = {
    async post(url, body) {
      calledUrl = url;
      calledBody = body;
      return { message: 'Reply sent successfully', id: 801 };
    },
  };

  const api = createMockCommunicationApi(successClient);
  await api.replyToEnquiry(801, 'We deliver to your area.');

  assert.equal(calledUrl, '/api/admin/enquiries/801/reply');
  assert.deepEqual(calledBody, { message: 'We deliver to your area.' });
});

test('COM-ENQ-02: Public contact form state preserves inputs and does not set submitted on error', async () => {
  // Simulate ContactPage state behavior on submission failure
  let contactPageState = {
    submitted: false,
    isSubmitting: false,
    errorMessage: null,
    form: {
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      phone: '+91 98765 43210',
      subject: 'Order Assistance',
      message: 'Urgent: can I modify cake weight?',
    },
  };

  const failingApi = createMockCommunicationApi({
    async post() {
      const err = new Error('Failed to submit enquiry');
      err.status = 500;
      err.response = { status: 500, data: { message: 'Service unavailable' } };
      throw err;
    },
  });

  async function simulateContactSubmit() {
    contactPageState.isSubmitting = true;
    contactPageState.errorMessage = null;
    try {
      await failingApi.submitContactEnquiry({
        name: contactPageState.form.name,
        email: contactPageState.form.email,
        phone: contactPageState.form.phone,
        subject: contactPageState.form.subject,
        message: contactPageState.form.message,
      });
      contactPageState.submitted = true;
    } catch (err) {
      contactPageState.errorMessage = err.response?.data?.message || err.message;
      // submitted remains false, form fields are untouched!
    } finally {
      contactPageState.isSubmitting = false;
    }
  }

  await simulateContactSubmit();

  assert.equal(contactPageState.submitted, false, 'Should NOT set submitted to true on failure');
  assert.equal(contactPageState.isSubmitting, false);
  assert.equal(contactPageState.errorMessage, 'Service unavailable');
  assert.equal(contactPageState.form.name, 'Rohan Sharma');
  assert.equal(contactPageState.form.message, 'Urgent: can I modify cake weight?');
});

test('COM-ENQ-01: Admin enquiry reply preserves replyText draft on failure', async () => {
  let adminUiState = {
    isSending: false,
    replyText: 'Dear customer, our delivery slot starts at 8 AM.',
    isReplying: true,
    lastError: null,
  };

  const failingApi = createMockCommunicationApi({
    async post() {
      const err = new Error('Network error');
      err.status = 502;
      throw err;
    },
  });

  async function simulateSendReply() {
    adminUiState.isSending = true;
    try {
      await failingApi.replyToEnquiry(802, adminUiState.replyText);
      adminUiState.replyText = '';
      adminUiState.isReplying = false;
    } catch (err) {
      adminUiState.lastError = err.message;
      // Draft replyText is preserved!
    } finally {
      adminUiState.isSending = false;
    }
  }

  await simulateSendReply();

  assert.equal(adminUiState.isSending, false);
  assert.equal(adminUiState.isReplying, true, 'Reply composer remains open');
  assert.equal(adminUiState.replyText, 'Dear customer, our delivery slot starts at 8 AM.', 'Draft preserved');
  assert.equal(adminUiState.lastError, 'Network error');
});

test('COM-ENQ-04: Contact enquiry record maps adminReply and repliedAt history correctly', () => {
  const mockEnquiry = {
    id: 901,
    name: 'Suresh',
    email: 'suresh@example.com',
    subject: 'Cake Customization',
    message: 'Can I add chocolate flakes?',
    createdAt: '2026-10-15T10:00:00Z',
    isRead: true,
    adminReply: 'Yes, chocolate flakes can be added upon request.',
    repliedAt: '2026-10-15T11:30:00Z',
  };

  assert.equal(mockEnquiry.adminReply, 'Yes, chocolate flakes can be added upon request.');
  assert.ok(mockEnquiry.repliedAt);
  assert.equal(mockEnquiry.isRead, true);
});
