import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerRefreshCoordinator } from '../lib/owner/ownerRefreshCoordinator.js';

/**
 * Helper to construct a deferred promise for deterministic asynchronous test control.
 * Avoids arbitrary sleep delays and timing flakiness.
 */
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Owner Dashboard Global Refresh Coordination Test Suite (Phase 3)', () => {
  // --------------------------------------------------------------------------
  // 1. Handler Registration and Unmount Cleanup
  // --------------------------------------------------------------------------
  describe('1. Handler registration and cleanup', () => {
    test('Multiple handlers can register simultaneously without overwriting each other', () => {
      const coordinator = createOwnerRefreshCoordinator();
      assert.equal(coordinator.getHandlersCount(), 0);

      const handler1 = async () => {};
      const handler2 = async () => {};
      const handler3 = async () => {};

      const unregister1 = coordinator.registerRefreshHandler(handler1);
      const unregister2 = coordinator.registerRefreshHandler(handler2);
      const unregister3 = coordinator.registerRefreshHandler(handler3);

      assert.equal(coordinator.getHandlersCount(), 3, 'All 3 handlers must be stored concurrently in the Set');

      // Unregister one handler
      unregister2();
      assert.equal(coordinator.getHandlersCount(), 2, 'Unregistering handler2 must reduce handler count to 2');

      // Unregister remaining
      unregister1();
      unregister3();
      assert.equal(coordinator.getHandlersCount(), 0, 'Unregistering all handlers must leave Set empty');
    });

    test('Unregistering an already unregistered or invalid handler is safe and idempotent', () => {
      const coordinator = createOwnerRefreshCoordinator();
      const handler = async () => {};
      const unregister = coordinator.registerRefreshHandler(handler);

      assert.equal(coordinator.getHandlersCount(), 1);
      unregister();
      assert.equal(coordinator.getHandlersCount(), 0);
      unregister(); // Idempotent call
      assert.equal(coordinator.getHandlersCount(), 0);

      const noopUnregister = coordinator.registerRefreshHandler(null);
      assert.equal(typeof noopUnregister, 'function');
      noopUnregister();
      assert.equal(coordinator.getHandlersCount(), 0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Synchronous Duplicate-Click Protection
  // --------------------------------------------------------------------------
  describe('2. Synchronous duplicate-click protection', () => {
    test('First refresh acquires lock immediately and suppresses simultaneous second click', async () => {
      const isRefreshingRef = { current: false };
      const coordinator = createOwnerRefreshCoordinator({ isRefreshingRef });

      const deferred = createDeferred();
      let executionCount = 0;

      coordinator.registerRefreshHandler(async function slowOverviewHandler() {
        executionCount++;
        await deferred.promise;
      });

      // 1. Trigger initial refresh
      const refreshPromise1 = coordinator.refresh();

      // Check synchronous state immediately on the first tick (before promise resolves)
      assert.equal(isRefreshingRef.current, true, 'isRefreshingRef lock must be set synchronously on initial click');
      assert.equal(coordinator.isLocked(), true, 'Coordinator must report locked state');
      assert.equal(coordinator.getState().isRefreshing, true, 'isRefreshing state must be active');
      assert.equal(coordinator.getState().refreshStatus, 'refreshing', 'Status must be refreshing');

      // 2. Trigger second and third clicks immediately while first is in-flight
      const refreshResult2 = await coordinator.refresh();
      const refreshResult3 = await coordinator.refresh();

      assert.equal(refreshResult2, false, 'Second simultaneous click must return false (suppressed)');
      assert.equal(refreshResult3, false, 'Third simultaneous click must return false (suppressed)');
      assert.equal(executionCount, 1, 'Only one refresh sequence must execute');

      // 3. Resolve slow operation and let refresh 1 complete
      deferred.resolve();
      const refreshResult1 = await refreshPromise1;

      assert.equal(refreshResult1, true, 'First refresh must resolve to true');
      assert.equal(isRefreshingRef.current, false, 'Synchronous lock must reset to false after completion');
      assert.equal(coordinator.getState().isRefreshing, false, 'isRefreshing state must clear');
      assert.equal(coordinator.getState().refreshStatus, 'updated', 'Status must transition to updated');
    });

    test('Synchronous lock is reliably released in finally block even if a task throws', async () => {
      const isRefreshingRef = { current: false };
      const coordinator = createOwnerRefreshCoordinator({ isRefreshingRef });

      const deferred = createDeferred();
      coordinator.registerRefreshHandler(async function failingHandler() {
        await deferred.promise;
        throw new Error('Fatal database outage');
      });

      const refreshPromise = coordinator.refresh();
      assert.equal(isRefreshingRef.current, true);

      // Trigger failure
      deferred.reject(new Error('Fatal database outage'));
      await refreshPromise;

      assert.equal(isRefreshingRef.current, false, 'Synchronous lock must release even upon error');
      assert.equal(coordinator.getState().isRefreshing, false, 'Loading state must clear');
      assert.equal(coordinator.getState().refreshStatus, 'error', 'Status must reflect error');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Full Success Coordination
  // --------------------------------------------------------------------------
  describe('3. Full success coordination', () => {
    test('All core queries and registered handlers succeed and report updated status', async () => {
      const coordinator = createOwnerRefreshCoordinator();
      let coreShopRefreshed = false;
      let coreSubscriptionRefreshed = false;
      let pageOrdersRefreshed = false;
      let pageProductsRefreshed = false;

      const coreTasks = [
        {
          name: 'Shop Profile',
          promise: (async () => {
            coreShopRefreshed = true;
          })(),
        },
        {
          name: 'Subscription',
          promise: (async () => {
            coreSubscriptionRefreshed = true;
          })(),
        },
      ];

      coordinator.registerRefreshHandler(async function fetchOrders() {
        pageOrdersRefreshed = true;
      });

      coordinator.registerRefreshHandler(async function fetchProducts() {
        pageProductsRefreshed = true;
      });

      const result = await coordinator.refresh(coreTasks);

      assert.equal(result, true);
      assert.equal(coreShopRefreshed, true, 'Core shop profile query must run');
      assert.equal(coreSubscriptionRefreshed, true, 'Core subscription query must run');
      assert.equal(pageOrdersRefreshed, true, 'Page orders query must run');
      assert.equal(pageProductsRefreshed, true, 'Page products query must run');

      const state = coordinator.getState();
      assert.equal(state.isRefreshing, false);
      assert.equal(state.refreshStatus, 'updated', 'Status must be updated on full success');
      assert.equal(state.refreshError, null, 'refreshError must be null');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Partial Failure Resilience (Promise.allSettled)
  // --------------------------------------------------------------------------
  describe('4. Partial failure resilience', () => {
    test('Rejected auxiliary handler does not abort successful handlers and reports warning', async () => {
      const warnedTasks = [];
      const coordinator = createOwnerRefreshCoordinator({
        onWarn: (tasks) => warnedTasks.push(...tasks),
      });

      let ordersCompleted = false;
      let productsCompleted = false;

      // Successful handler 1
      coordinator.registerRefreshHandler(async function fetchOrders() {
        ordersCompleted = true;
      });

      // Failing handler 2 (e.g. auxiliary analytics chart glitch)
      coordinator.registerRefreshHandler(async function fetchAnalyticsCharts() {
        throw new Error('500 Internal Server Error in Analytics service');
      });

      // Successful handler 3
      coordinator.registerRefreshHandler(async function fetchProducts() {
        productsCompleted = true;
      });

      const result = await coordinator.refresh([
        {
          name: 'Shop Profile',
          promise: Promise.resolve({ id: 17, name: 'Sweet Delight' }),
        },
      ]);

      assert.equal(result, true);
      assert.equal(ordersCompleted, true, 'Orders handler must have completed successfully');
      assert.equal(productsCompleted, true, 'Products handler must have completed successfully');

      const state = coordinator.getState();
      assert.equal(state.isRefreshing, false, 'Spinner must reset after settlement');
      assert.equal(state.refreshStatus, 'warning', 'Status must be warning, not updated');
      assert.match(
        state.refreshError,
        /fetchAnalyticsCharts/,
        'Failure information must identify the rejected handler'
      );
      assert.match(state.refreshError, /Partial refresh: updated successfully except/);

      assert.equal(warnedTasks.length, 1);
      assert.equal(warnedTasks[0].name, 'fetchAnalyticsCharts');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Complete Failure Handling
  // --------------------------------------------------------------------------
  describe('5. Complete failure handling', () => {
    test('When all tasks fail, status transitions to error and records honest failure message', async () => {
      const errorLogs = [];
      const coordinator = createOwnerRefreshCoordinator({
        onError: (tasks) => errorLogs.push(...tasks),
      });

      coordinator.registerRefreshHandler(async function ordersService() {
        throw new Error('Connection refused');
      });

      const coreTasks = [
        {
          name: 'Shop Profile',
          promise: Promise.reject(new Error('Gateway timeout')),
        },
      ];

      const result = await coordinator.refresh(coreTasks);

      assert.equal(result, true);
      const state = coordinator.getState();
      assert.equal(state.isRefreshing, false, 'isRefreshing must reset to false');
      assert.equal(state.refreshStatus, 'error', 'Status must transition to error');
      assert.equal(
        state.refreshError,
        'Failed to refresh dashboard: network or server error.',
        'Must display honest network/server failure error'
      );
      assert.equal(errorLogs.length, 2, 'Both failed tasks must be recorded in error log');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Empty Handler Set (Static or Unmigrated Page)
  // --------------------------------------------------------------------------
  describe('6. Empty handler set handling', () => {
    test('Refreshes core queries but resets directly to idle to avoid false "Updated" claim', async () => {
      const coordinator = createOwnerRefreshCoordinator();
      let coreQueryRan = false;

      const coreTasks = [
        {
          name: 'Shop Profile',
          promise: (async () => {
            coreQueryRan = true;
          })(),
        },
      ];

      // No page handler registered
      assert.equal(coordinator.getHandlersCount(), 0);

      const result = await coordinator.refresh(coreTasks);

      assert.equal(result, true);
      assert.equal(coreQueryRan, true, 'Core platform query must still execute');

      const state = coordinator.getState();
      assert.equal(state.isRefreshing, false);
      assert.equal(
        state.refreshStatus,
        'idle',
        'Status must reset to idle (must NOT claim page data updated when no page handler is registered)'
      );
      assert.equal(state.refreshError, null);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Handler Cleanup and Sequential Refreshes
  // --------------------------------------------------------------------------
  describe('7. Handler cleanup and repeated refreshes', () => {
    test('Unregistered handlers are not called on subsequent refreshes', async () => {
      const coordinator = createOwnerRefreshCoordinator();
      let handler1Runs = 0;
      let handler2Runs = 0;

      const unregister1 = coordinator.registerRefreshHandler(async () => {
        handler1Runs++;
      });
      const unregister2 = coordinator.registerRefreshHandler(async () => {
        handler2Runs++;
      });

      // First refresh
      await coordinator.refresh();
      assert.equal(handler1Runs, 1);
      assert.equal(handler2Runs, 1);

      // Unregister handler 1
      unregister1();

      // Second refresh
      await coordinator.refresh();
      assert.equal(handler1Runs, 1, 'Unregistered handler 1 must NOT run on second refresh');
      assert.equal(handler2Runs, 2, 'Still-registered handler 2 must run on second refresh');

      unregister2();
      await coordinator.refresh();
      assert.equal(handler1Runs, 1);
      assert.equal(handler2Runs, 2);
    });

    test('Coordinator fully recovers and accepts a second refresh after a prior failure', async () => {
      const coordinator = createOwnerRefreshCoordinator();
      let shouldFail = true;

      coordinator.registerRefreshHandler(async () => {
        if (shouldFail) {
          throw new Error('Transient 503 error');
        }
      });

      // 1. First refresh fails completely
      await coordinator.refresh();
      assert.equal(coordinator.getState().refreshStatus, 'error');
      assert.equal(coordinator.isLocked(), false, 'Lock must be free');

      // 2. Recover backend and trigger second refresh
      shouldFail = false;
      const result2 = await coordinator.refresh();
      assert.equal(result2, true, 'Second refresh must run successfully');
      assert.equal(coordinator.getState().refreshStatus, 'updated', 'Status must transition to updated');
      assert.equal(coordinator.getState().refreshError, null);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Error Dismissal and State Reset
  // --------------------------------------------------------------------------
  describe('8. State and error dismissal', () => {
    test('clearRefreshError resets warning and error states back to idle', async () => {
      const coordinator = createOwnerRefreshCoordinator();

      // Create a warning state
      coordinator.registerRefreshHandler(async function goodTask() {});
      coordinator.registerRefreshHandler(async function badTask() {
        throw new Error('Fails');
      });

      await coordinator.refresh();
      assert.equal(coordinator.getState().refreshStatus, 'warning');
      assert.notEqual(coordinator.getState().refreshError, null);

      // User clicks dismiss button (X)
      coordinator.clearRefreshError();

      assert.equal(coordinator.getState().refreshError, null, 'Error message must be cleared');
      assert.equal(coordinator.getState().refreshStatus, 'idle', 'Status must return to idle');
    });

    test('Subscribers receive state change notifications during refresh life cycle', async () => {
      const coordinator = createOwnerRefreshCoordinator();
      const statusTransitions = [];

      const unsubscribe = coordinator.subscribe((state) => {
        statusTransitions.push(state.refreshStatus);
      });

      coordinator.registerRefreshHandler(async () => {});

      await coordinator.refresh();

      assert.deepEqual(
        statusTransitions,
        ['idle', 'refreshing', 'updated'],
        'Lifecycle transitions must follow idle -> refreshing -> updated'
      );

      unsubscribe();
    });

    test('Custom DOM event ownerGlobalRefresh is dispatched when onDispatchEvent is configured', async () => {
      const dispatchedEvents = [];
      const coordinator = createOwnerRefreshCoordinator({
        onDispatchEvent: (evt) => dispatchedEvents.push(evt),
      });

      coordinator.registerRefreshHandler(async () => {});

      await coordinator.refresh();

      assert.deepEqual(dispatchedEvents, ['ownerGlobalRefresh']);
    });
  });
});
