'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

export interface AdminRefreshContextType {
  isRefreshing: boolean;
  triggerRefresh: () => Promise<void>;
  registerRefreshHandler: (handler: () => Promise<void>) => () => void;
}

const AdminRefreshContext = createContext<AdminRefreshContextType>({
  isRefreshing: false,
  triggerRefresh: async () => {},
  registerRefreshHandler: () => () => {},
});

export const useAdminRefresh = () => useContext(AdminRefreshContext);

/**
 * Hook for child pages and components to register an asynchronous refresh handler.
 * Automatically cleans up on unmount.
 */
export function useRegisterAdminRefresh(handler: () => Promise<void>) {
  const { registerRefreshHandler } = useAdminRefresh();

  useEffect(() => {
    return registerRefreshHandler(handler);
  }, [registerRefreshHandler, handler]);
}

export const AdminRefreshProvider = ({ children }: { children: ReactNode }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const handlersRef = useRef<Set<() => Promise<void>>>(new Set());

  const registerRefreshHandler = useCallback((handler: () => Promise<void>) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const triggerRefresh = useCallback(async () => {
    // Prevent duplicate/overlapping concurrent refresh executions
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      // 1. Dispatch custom DOM event for legacy or event-based listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminGlobalRefresh'));
      }

      // 2. Await all actively registered async handlers concurrently
      const handlers = Array.from(handlersRef.current);
      if (handlers.length > 0) {
        await Promise.allSettled(handlers.map((fn) => fn()));
      }
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  return (
    <AdminRefreshContext.Provider
      value={{
        isRefreshing,
        triggerRefresh,
        registerRefreshHandler,
      }}
    >
      {children}
    </AdminRefreshContext.Provider>
  );
};
