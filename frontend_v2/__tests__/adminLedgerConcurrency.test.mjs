import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper creating an Admin Orders Ledger state machine mirroring app/admin/orders/page.tsx
function createOrdersLedgerStateMachine(mockApi) {
  const state = {
    orders: [],
    totalPages: 0,
    totalElements: 0,
    isLoading: true,
    error: null,
    selectedOrderId: null,
    orderDetail: null,
    isLoadingDetail: false,
    detailError: null,
  };

  const fetchSeqRef = { current: 0 };
  const detailSeqRef = { current: 0 };

  const fetchOrders = async (params = {}, isManual = false) => {
    const currentSeq = ++fetchSeqRef.current;
    if (!isManual) state.isLoading = true;
    state.error = null;

    try {
      const res = await mockApi.getAdminOrders(params);
      if (currentSeq === fetchSeqRef.current) {
        state.orders = res.content || [];
        state.totalPages = res.totalPages || 0;
        state.totalElements = res.totalElements || 0;
      }
    } catch (err) {
      if (currentSeq === fetchSeqRef.current) {
        state.error = err?.message || 'Failed to fetch cross-shop orders.';
      }
    } finally {
      if (currentSeq === fetchSeqRef.current) {
        state.isLoading = false;
      }
    }
  };

  const handleOpenDetail = async (orderId) => {
    const currentDetailSeq = ++detailSeqRef.current;
    state.selectedOrderId = orderId;
    state.isLoadingDetail = true;
    state.detailError = null;
    state.orderDetail = null;

    try {
      const data = await mockApi.getAdminOrderDetail(orderId);
      if (currentDetailSeq === detailSeqRef.current) {
        state.orderDetail = data;
      }
    } catch (err) {
      if (currentDetailSeq === detailSeqRef.current) {
        state.detailError = err?.message || 'Failed to load order details.';
      }
    } finally {
      if (currentDetailSeq === detailSeqRef.current) {
        state.isLoadingDetail = false;
      }
    }
  };

  const handleCloseDetail = () => {
    detailSeqRef.current++;
    state.selectedOrderId = null;
    state.orderDetail = null;
    state.detailError = null;
  };

  return { state, fetchOrders, handleOpenDetail, handleCloseDetail, fetchSeqRef, detailSeqRef };
}

// Helper creating an Admin Payments Ledger state machine mirroring app/admin/payments/page.tsx
function createPaymentsLedgerStateMachine(mockApi) {
  const state = {
    payments: [],
    totalPages: 0,
    totalElements: 0,
    isLoading: true,
    error: null,
    selectedPaymentId: null,
    paymentDetail: null,
    isLoadingDetail: false,
    detailError: null,
  };

  const fetchSeqRef = { current: 0 };
  const detailSeqRef = { current: 0 };

  const fetchPayments = async (params = {}, isManual = false) => {
    const currentSeq = ++fetchSeqRef.current;
    if (!isManual) state.isLoading = true;
    state.error = null;

    try {
      const res = await mockApi.getAdminPayments(params);
      if (currentSeq === fetchSeqRef.current) {
        state.payments = res.content || [];
        state.totalPages = res.totalPages || 0;
        state.totalElements = res.totalElements || 0;
      }
    } catch (err) {
      if (currentSeq === fetchSeqRef.current) {
        state.error = err?.message || 'Failed to fetch gateway transactions.';
      }
    } finally {
      if (currentSeq === fetchSeqRef.current) {
        state.isLoading = false;
      }
    }
  };

  const handleOpenDetail = async (paymentId) => {
    const currentDetailSeq = ++detailSeqRef.current;
    state.selectedPaymentId = paymentId;
    state.isLoadingDetail = true;
    state.detailError = null;
    state.paymentDetail = null;

    try {
      const data = await mockApi.getAdminPaymentDetail(paymentId);
      if (currentDetailSeq === detailSeqRef.current) {
        state.paymentDetail = data;
      }
    } catch (err) {
      if (currentDetailSeq === detailSeqRef.current) {
        state.detailError = err?.message || 'Failed to load payment details.';
      }
    } finally {
      if (currentDetailSeq === detailSeqRef.current) {
        state.isLoadingDetail = false;
      }
    }
  };

  const handleCloseDetail = () => {
    detailSeqRef.current++;
    state.selectedPaymentId = null;
    state.paymentDetail = null;
    state.detailError = null;
  };

  return { state, fetchPayments, handleOpenDetail, handleCloseDetail, fetchSeqRef, detailSeqRef };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Admin Orders Ledger - Concurrency & Race-Condition Tests', () => {
  test('Out-of-order list responses: slower older request does not overwrite newer request', async () => {
    const mockApi = {
      getAdminOrders: async (params) => {
        if (params.query === 'slow-search') {
          await sleep(50);
          return { content: [{ id: 1, orderNumber: 'ORD-OLD-1' }], totalPages: 1, totalElements: 1 };
        }
        await sleep(10);
        return { content: [{ id: 2, orderNumber: 'ORD-NEW-2' }], totalPages: 1, totalElements: 1 };
      },
    };

    const ledger = createOrdersLedgerStateMachine(mockApi);

    // Fire slow request #1, then fast request #2
    const p1 = ledger.fetchOrders({ query: 'slow-search' });
    const p2 = ledger.fetchOrders({ query: 'fast-search' });

    await Promise.all([p1, p2]);

    assert.equal(ledger.state.orders.length, 1);
    assert.equal(ledger.state.orders[0].orderNumber, 'ORD-NEW-2', 'Newer request results must be preserved');
    assert.equal(ledger.state.isLoading, false);
    assert.equal(ledger.state.error, null);
  });

  test('Stale request failures: slow earlier failure does not overwrite newer successful results or set error', async () => {
    const mockApi = {
      getAdminOrders: async (params) => {
        if (params.query === 'failing-query') {
          await sleep(50);
          throw new Error('Network timeout');
        }
        await sleep(10);
        return { content: [{ id: 99, orderNumber: 'ORD-VALID' }], totalPages: 1, totalElements: 1 };
      },
    };

    const ledger = createOrdersLedgerStateMachine(mockApi);

    const p1 = ledger.fetchOrders({ query: 'failing-query' });
    const p2 = ledger.fetchOrders({ query: 'valid-query' });

    await Promise.all([p1, p2]);

    assert.equal(ledger.state.error, null, 'Stale error must be discarded');
    assert.equal(ledger.state.orders[0].orderNumber, 'ORD-VALID', 'Valid orders must remain in state');
    assert.equal(ledger.state.isLoading, false);
  });

  test('Loading-state ownership: older request resolving early does not terminate active loading state', async () => {
    const mockApi = {
      getAdminOrders: async (params) => {
        if (params.query === 'first-call') {
          await sleep(15);
          return { content: [{ id: 1 }], totalPages: 1, totalElements: 1 };
        }
        await sleep(60);
        return { content: [{ id: 2 }], totalPages: 1, totalElements: 1 };
      },
    };

    const ledger = createOrdersLedgerStateMachine(mockApi);

    const p1 = ledger.fetchOrders({ query: 'first-call' });
    const p2 = ledger.fetchOrders({ query: 'second-call' });

    // Wait until p1 finishes, but p2 is still in-flight
    await sleep(25);
    assert.equal(ledger.state.isLoading, true, 'isLoading must remain true while request #2 is pending');

    await Promise.all([p1, p2]);
    assert.equal(ledger.state.isLoading, false, 'isLoading must become false once request #2 completes');
    assert.equal(ledger.state.orders[0].id, 2);
  });

  test('Detail-modal closure: modal close invalidates in-flight response and prevents state leaks', async () => {
    const mockApi = {
      getAdminOrderDetail: async (orderId) => {
        await sleep(40);
        return { id: orderId, orderNumber: `ORD-${orderId}` };
      },
    };

    const ledger = createOrdersLedgerStateMachine(mockApi);

    const pDetail = ledger.handleOpenDetail(500);
    assert.equal(ledger.state.isLoadingDetail, true);
    assert.equal(ledger.state.selectedOrderId, 500);

    // User closes modal before request returns
    await sleep(10);
    ledger.handleCloseDetail();
    assert.equal(ledger.state.selectedOrderId, null);

    // Wait for the async API call to complete
    await pDetail;

    assert.equal(ledger.state.orderDetail, null, 'Closed modal must not receive obsolete detail payload');
    assert.equal(ledger.state.selectedOrderId, null);
  });

  test('Rapid detail modal switching: slower first order detail does not overwrite second order detail', async () => {
    const mockApi = {
      getAdminOrderDetail: async (orderId) => {
        if (orderId === 101) {
          await sleep(50);
          return { id: 101, orderNumber: 'ORD-101' };
        }
        await sleep(10);
        return { id: 102, orderNumber: 'ORD-102' };
      },
    };

    const ledger = createOrdersLedgerStateMachine(mockApi);

    const p1 = ledger.handleOpenDetail(101);
    const p2 = ledger.handleOpenDetail(102);

    await Promise.all([p1, p2]);

    assert.equal(ledger.state.orderDetail.id, 102, 'Detail state must contain the latest requested order (102)');
    assert.equal(ledger.state.orderDetail.orderNumber, 'ORD-102');
    assert.equal(ledger.state.isLoadingDetail, false);
  });
});

describe('Admin Payments Ledger - Concurrency & Race-Condition Tests', () => {
  test('Out-of-order list responses: slower older request does not overwrite newer request', async () => {
    const mockApi = {
      getAdminPayments: async (params) => {
        if (params.query === 'slow-search') {
          await sleep(50);
          return { content: [{ id: 10, providerPaymentId: 'pay_old' }], totalPages: 1, totalElements: 1 };
        }
        await sleep(10);
        return { content: [{ id: 20, providerPaymentId: 'pay_new' }], totalPages: 1, totalElements: 1 };
      },
    };

    const ledger = createPaymentsLedgerStateMachine(mockApi);

    const p1 = ledger.fetchPayments({ query: 'slow-search' });
    const p2 = ledger.fetchPayments({ query: 'fast-search' });

    await Promise.all([p1, p2]);

    assert.equal(ledger.state.payments.length, 1);
    assert.equal(ledger.state.payments[0].providerPaymentId, 'pay_new', 'Newer payment results must be preserved');
    assert.equal(ledger.state.isLoading, false);
    assert.equal(ledger.state.error, null);
  });

  test('Stale request failures: slow earlier failure does not overwrite newer successful results or set error', async () => {
    const mockApi = {
      getAdminPayments: async (params) => {
        if (params.query === 'failing-query') {
          await sleep(50);
          throw new Error('Gateway connection reset');
        }
        await sleep(10);
        return { content: [{ id: 88, providerPaymentId: 'pay_success' }], totalPages: 1, totalElements: 1 };
      },
    };

    const ledger = createPaymentsLedgerStateMachine(mockApi);

    const p1 = ledger.fetchPayments({ query: 'failing-query' });
    const p2 = ledger.fetchPayments({ query: 'success-query' });

    await Promise.all([p1, p2]);

    assert.equal(ledger.state.error, null, 'Stale error must be discarded');
    assert.equal(ledger.state.payments[0].providerPaymentId, 'pay_success');
    assert.equal(ledger.state.isLoading, false);
  });

  test('Loading-state ownership: older request resolving early does not terminate active loading state', async () => {
    const mockApi = {
      getAdminPayments: async (params) => {
        if (params.query === 'first-call') {
          await sleep(15);
          return { content: [{ id: 100 }], totalPages: 1, totalElements: 1 };
        }
        await sleep(60);
        return { content: [{ id: 200 }], totalPages: 1, totalElements: 1 };
      },
    };

    const ledger = createPaymentsLedgerStateMachine(mockApi);

    const p1 = ledger.fetchPayments({ query: 'first-call' });
    const p2 = ledger.fetchPayments({ query: 'second-call' });

    await sleep(25);
    assert.equal(ledger.state.isLoading, true, 'isLoading must remain true while payment request #2 is pending');

    await Promise.all([p1, p2]);
    assert.equal(ledger.state.isLoading, false);
    assert.equal(ledger.state.payments[0].id, 200);
  });

  test('Detail-modal closure: modal close invalidates in-flight response and prevents state leaks', async () => {
    const mockApi = {
      getAdminPaymentDetail: async (paymentId) => {
        await sleep(40);
        return { id: paymentId, providerPaymentId: `pay_${paymentId}` };
      },
    };

    const ledger = createPaymentsLedgerStateMachine(mockApi);

    const pDetail = ledger.handleOpenDetail(777);
    assert.equal(ledger.state.isLoadingDetail, true);
    assert.equal(ledger.state.selectedPaymentId, 777);

    // User closes modal before request returns
    await sleep(10);
    ledger.handleCloseDetail();
    assert.equal(ledger.state.selectedPaymentId, null);

    await pDetail;

    assert.equal(ledger.state.paymentDetail, null, 'Closed modal must not receive obsolete payment detail payload');
    assert.equal(ledger.state.selectedPaymentId, null);
  });

  test('Rapid detail modal switching: slower first payment detail does not overwrite second payment detail', async () => {
    const mockApi = {
      getAdminPaymentDetail: async (paymentId) => {
        if (paymentId === 301) {
          await sleep(50);
          return { id: 301, providerPaymentId: 'pay_301' };
        }
        await sleep(10);
        return { id: 302, providerPaymentId: 'pay_302' };
      },
    };

    const ledger = createPaymentsLedgerStateMachine(mockApi);

    const p1 = ledger.handleOpenDetail(301);
    const p2 = ledger.handleOpenDetail(302);

    await Promise.all([p1, p2]);

    assert.equal(ledger.state.paymentDetail.id, 302, 'Detail state must contain the latest requested payment (302)');
    assert.equal(ledger.state.paymentDetail.providerPaymentId, 'pay_302');
    assert.equal(ledger.state.isLoadingDetail, false);
  });
});
