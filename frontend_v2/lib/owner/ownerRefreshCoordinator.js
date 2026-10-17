/**
 * CakeStore Owner Dashboard Refresh Coordinator
 *
 * Provides a synchronous-locking, failure-resilient refresh coordination engine
 * shared by OwnerContext and automated regression test suites.
 */

/**
 * Creates an instance of the owner refresh coordinator.
 *
 * @param {Object} [options]
 * @param {{ current: boolean }} [options.isRefreshingRef] Synchronous lock ref
 * @param {Set<() => Promise<void>>} [options.handlers] Pre-existing handlers set
 * @param {Function} [options.onDispatchEvent] Callback to fire custom events
 * @param {Function} [options.onError] Error logger
 * @param {Function} [options.onWarn] Warning logger
 * @param {number} [options.successTimeoutMs] Milliseconds before 'updated' resets to 'idle' (default: 2500)
 * @param {number} [options.warningTimeoutMs] Milliseconds before 'warning' resets to 'idle' (default: 4000)
 * @param {number} [options.errorTimeoutMs] Milliseconds before 'error' resets to 'idle' (default: 4000)
 */
export function createOwnerRefreshCoordinator(options = {}) {
  const isRefreshingRef = options.isRefreshingRef || { current: false };
  const handlers = options.handlers || new Set();
  let isRefreshing = false;
  let refreshStatus = 'idle';
  let refreshError = null;
  let statusTimeout = null;
  const listeners = new Set();

  const notify = () => {
    const state = { isRefreshing, refreshStatus, refreshError };
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch {
        // Safe listener execution
      }
    });
  };

  const registerRefreshHandler = (handler) => {
    if (typeof handler !== 'function') return () => {};
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  };

  const clearRefreshError = () => {
    refreshError = null;
    if (refreshStatus === 'warning' || refreshStatus === 'error') {
      refreshStatus = 'idle';
    }
    notify();
  };

  /**
   * Triggers a coordinated refresh across core platform tasks and active page handlers.
   *
   * @param {Array<{ name: string, promise: Promise<any> } | (() => { name: string, promise: Promise<any> })>} [coreTaskProviders]
   * @returns {Promise<boolean>} True if refresh ran, false if suppressed by synchronous lock
   */
  const refresh = async (coreTaskProviders = []) => {
    // 1. Synchronous duplicate-click prevention
    if (isRefreshingRef.current) {
      return false;
    }
    isRefreshingRef.current = true;
    isRefreshing = true;
    refreshStatus = 'refreshing';
    refreshError = null;
    notify();

    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }

    if (options.onDispatchEvent) {
      try {
        options.onDispatchEvent('ownerGlobalRefresh');
      } catch {
        // Quiet event dispatch failure
      }
    }

    try {
      const registeredHandlers = Array.from(handlers);
      const hasPageHandlers = registeredHandlers.length > 0;

      // Resolve core tasks
      const resolvedCoreTasks = (coreTaskProviders || []).map((provider) =>
        typeof provider === 'function' ? provider() : provider
      );

      const tasks = [
        ...resolvedCoreTasks.map((t) => ({
          name: t.name || 'Core Platform Query',
          isPageHandler: false,
          promise: t.promise,
        })),
        ...registeredHandlers.map((fn, idx) => ({
          name: fn.name ? fn.name.replace(/^bound\s+/, '') : `Page Handler ${idx + 1}`,
          isPageHandler: true,
          promise: Promise.resolve().then(() => fn()),
        })),
      ];

      // Await all tasks concurrently via Promise.allSettled
      const results = await Promise.allSettled(tasks.map((t) => t.promise));

      const failedTasks = [];
      const successfulTasks = [];

      results.forEach((res, index) => {
        const task = tasks[index];
        if (res.status === 'fulfilled') {
          successfulTasks.push(task.name);
        } else {
          failedTasks.push({
            name: task.name,
            reason: res.reason,
            isPageHandler: task.isPageHandler,
          });
        }
      });

      // Honest status evaluation
      if (tasks.length > 0 && successfulTasks.length === 0) {
        // Complete failure: every task rejected
        refreshStatus = 'error';
        refreshError = 'Failed to refresh dashboard: network or server error.';
        if (options.onError) options.onError(failedTasks);
        statusTimeout = setTimeout(() => {
          refreshStatus = 'idle';
          notify();
        }, options.errorTimeoutMs ?? 4000);
      } else if (failedTasks.length > 0) {
        // Partial failure: some tasks succeeded, some failed
        const failedNames = failedTasks.map((f) => f.name).join(', ');
        refreshStatus = 'warning';
        refreshError = `Partial refresh: updated successfully except [${failedNames}].`;
        if (options.onWarn) options.onWarn(failedTasks);
        statusTimeout = setTimeout(() => {
          refreshStatus = 'idle';
          notify();
        }, options.warningTimeoutMs ?? 4000);
      } else if (!hasPageHandlers) {
        // Core queries succeeded but no page handler is registered;
        // Avoid displaying a misleading "Data Updated" message
        refreshStatus = 'idle';
        refreshError = null;
      } else {
        // Full success: all handlers settled cleanly
        refreshStatus = 'updated';
        refreshError = null;
        statusTimeout = setTimeout(() => {
          refreshStatus = 'idle';
          notify();
        }, options.successTimeoutMs ?? 2500);
      }

      return true;
    } catch (unexpectedErr) {
      refreshStatus = 'error';
      refreshError = unexpectedErr?.message || 'Unexpected error during refresh';
      statusTimeout = setTimeout(() => {
        refreshStatus = 'idle';
        notify();
      }, options.errorTimeoutMs ?? 4000);
      return false;
    } finally {
      // 5. Restore lock and refreshing state
      isRefreshingRef.current = false;
      isRefreshing = false;
      notify();
    }
  };

  return {
    registerRefreshHandler,
    clearRefreshError,
    refresh,
    getState: () => ({ isRefreshing, refreshStatus, refreshError }),
    getHandlersCount: () => handlers.size,
    isLocked: () => isRefreshingRef.current,
    subscribe: (fn) => {
      listeners.add(fn);
      fn({ isRefreshing, refreshStatus, refreshError });
      return () => {
        listeners.delete(fn);
      };
    },
    destroy: () => {
      if (statusTimeout) clearTimeout(statusTimeout);
      listeners.clear();
      handlers.clear();
    },
  };
}
