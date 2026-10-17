'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { ShopSettings, SubscriptionRecord, OwnerDashboardStats } from '@/types/owner';
import { ownerApi } from '@/lib/api/owner';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuth } from '@/lib/auth/AuthContext';
import { createOwnerRefreshCoordinator } from '@/lib/owner/ownerRefreshCoordinator';

interface OwnerContextType {
  shop: ShopSettings | null;
  isLoadingShop: boolean;
  subscription: SubscriptionRecord | null;
  isLoadingSubscription: boolean;
  refreshSubscription: () => Promise<SubscriptionRecord | null>;
  isRefreshing: boolean;
  refreshStatus: 'idle' | 'refreshing' | 'updated' | 'warning' | 'error';
  refreshError: string | null;
  clearRefreshError: () => void;
  refreshDashboard: () => Promise<void>;
  refreshShop: () => Promise<ShopSettings | null>;
  updateShop: (newShop: ShopSettings) => void;
  setOperationalStatus: (enabled: boolean) => Promise<void>;
  registerRefreshHandler: (handler: () => Promise<void>) => () => void;
  pendingOrdersCount: number;
  pendingCustomCakesCount: number;
  pendingInquiriesCount: number;
  pendingEnquiriesCount: number;
  pendingReviewsCount: number;
  refreshSidebarCounts: () => Promise<void>;
  dashboardStats: OwnerDashboardStats | null;
  isLoadingStats: boolean;
  refreshDashboardStats: () => Promise<OwnerDashboardStats | null>;
}

const OwnerContext = createContext<OwnerContextType | undefined>(undefined);

export function OwnerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'refreshing' | 'updated' | 'warning' | 'error'>('idle');
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [pendingCustomCakesCount, setPendingCustomCakesCount] = useState<number>(0);
  const [pendingInquiriesCount, setPendingInquiriesCount] = useState<number>(0);
  const [pendingEnquiriesCount, setPendingEnquiriesCount] = useState<number>(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);
  const [dashboardStats, setDashboardStats] = useState<OwnerDashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Synchronous duplicate-click prevention lock
  const isRefreshingRef = useRef(false);

  // Active page-level and widget refresh handlers (Set-based to support multiple components without clobbering)
  const handlersRef = useRef<Set<() => Promise<void>>>(new Set());

  // Isolated refresh coordinator engine
  const coordinatorRef = useRef<ReturnType<typeof createOwnerRefreshCoordinator> | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createOwnerRefreshCoordinator({
      isRefreshingRef,
      handlers: handlersRef.current,
      onDispatchEvent: (eventName: string) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(eventName));
        }
      },
      onError: (failed: any[]) => console.error('[OwnerRefresh] All refresh operations failed:', failed),
      onWarn: (failed: any[]) => console.warn('[OwnerRefresh] Partial refresh completed with failed operations:', failed),
    });
  }

  // Subscribe React state to coordinator
  useEffect(() => {
    const coordinator = coordinatorRef.current;
    if (!coordinator) return;
    const unsubscribe = coordinator.subscribe((state: { isRefreshing: boolean; refreshStatus: any; refreshError: string | null }) => {
      setIsRefreshing(state.isRefreshing);
      setRefreshStatus(state.refreshStatus);
      setRefreshError(state.refreshError);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Clean up coordinator timers on unmount
  useEffect(() => {
    return () => {
      coordinatorRef.current?.destroy();
    };
  }, []);

  const fetchShop = useCallback(async (throwOnError = false): Promise<ShopSettings | null> => {
    try {
      const data = await ownerApi.getShopSettings();
      setShop(data);
      return data;
    } catch (err) {
      if (throwOnError) throw err;
      return null;
    }
  }, []);

  const fetchDashboardStats = useCallback(async (throwOnError = false): Promise<OwnerDashboardStats | null> => {
    try {
      const data = await ownerApi.getDashboardStats();
      setDashboardStats(data);
      return data;
    } catch (err) {
      if (throwOnError) throw err;
      return null;
    }
  }, []);

  const fetchSubscription = useCallback(async (throwOnError = false): Promise<SubscriptionRecord | null> => {
    try {
      const data = await ownerApi.getCurrentSubscription();
      setSubscription(data);
      return data;
    } catch (err) {
      if (throwOnError) throw err;
      return null;
    }
  }, []);

  const fetchSidebarCounts = useCallback(async (throwOnError = false): Promise<void> => {
    try {
      const summary = await notificationsApi.getUnreadSummary();
      const byType = summary?.byType || {};

      const newOrders = byType['NEW_ORDER'] || 0;
      const newCustomCakes = byType['CUSTOM_ORDER_REQUEST'] || 0;
      const newInquiries = byType['NEW_ENQUIRY'] || 0;
      const newReviews = byType['NEW_FEEDBACK'] || 0;

      setPendingOrdersCount(newOrders);
      setPendingCustomCakesCount(newCustomCakes);
      setPendingInquiriesCount(newInquiries);
      setPendingEnquiriesCount(newCustomCakes + newInquiries);
      setPendingReviewsCount(newReviews);
    } catch (err) {
      if (throwOnError) throw err;
    }
  }, []);

  // Initial authoritative shop and subscription fetch on authentication
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setIsLoadingShop(true);
      setIsLoadingSubscription(true);
      setIsLoadingStats(true);
      Promise.allSettled([
        fetchShop().finally(() => setIsLoadingShop(false)),
        fetchSubscription().finally(() => setIsLoadingSubscription(false)),
        fetchSidebarCounts(),
        fetchDashboardStats().finally(() => setIsLoadingStats(false)),
      ]);
    } else if (!authLoading && !isAuthenticated) {
      setShop(null);
      setSubscription(null);
      setIsLoadingShop(false);
      setIsLoadingSubscription(false);
      setPendingOrdersCount(0);
      setPendingCustomCakesCount(0);
      setPendingInquiriesCount(0);
      setPendingEnquiriesCount(0);
      setPendingReviewsCount(0);
      setDashboardStats(null);
      setIsLoadingStats(false);
    }
  }, [authLoading, isAuthenticated, fetchShop, fetchSubscription, fetchSidebarCounts, fetchDashboardStats]);

  // Periodic live background poll for sidebar badges every 20s
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    const interval = setInterval(() => {
      fetchSidebarCounts();
    }, 20000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authLoading, fetchSidebarCounts]);


  const lastFocusRefreshRef = useRef<number>(0);

  // Throttled window focus / visibility listener: refreshes active page, counts, shop, and subscription without duplicate calls or loops
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const now = Date.now();
      // Throttle to at most once every 15 seconds
      if (now - lastFocusRefreshRef.current < 15000) return;
      lastFocusRefreshRef.current = now;

      fetchShop().catch(() => {});
      fetchSubscription().catch(() => {});
      fetchSidebarCounts().catch(() => {});
      const handlers = Array.from(handlersRef.current);
      if (handlers.length > 0) {
        handlers.forEach((fn) => {
          fn().catch(() => {});
        });
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, authLoading, fetchShop, fetchSubscription, fetchSidebarCounts]);

  const updateShop = useCallback((newShop: ShopSettings) => {
    setShop(newShop);
  }, []);

  const registerRefreshHandler = useCallback((handler: () => Promise<void>) => {
    return coordinatorRef.current!.registerRefreshHandler(handler);
  }, []);

  const clearRefreshError = useCallback(() => {
    coordinatorRef.current?.clearRefreshError();
  }, []);

  const refreshDashboard = useCallback(async () => {
    await coordinatorRef.current!.refresh([
      { name: 'Shop Profile', promise: fetchShop(true) },
      { name: 'Subscription', promise: fetchSubscription(true) },
      { name: 'Notifications & Badges', promise: fetchSidebarCounts(true) },
      { name: 'Dashboard Stats', promise: fetchDashboardStats(true) },
    ]);
  }, [fetchShop, fetchSubscription, fetchSidebarCounts, fetchDashboardStats]);

  const setOperationalStatus = useCallback(async (enabled: boolean): Promise<void> => {
    const updated = await ownerApi.updateOperationalStatus(enabled);
    if (updated) {
      setShop(updated);
    }
  }, []);

  return (
    <OwnerContext.Provider
      value={{
        shop,
        isLoadingShop,
        subscription,
        isLoadingSubscription,
        refreshSubscription: fetchSubscription,
        isRefreshing,
        refreshStatus,
        refreshError,
        clearRefreshError,
        refreshDashboard,
        refreshShop: fetchShop,
        updateShop,
        setOperationalStatus,
        registerRefreshHandler,
        pendingOrdersCount,
        pendingCustomCakesCount,
        pendingInquiriesCount,
        pendingEnquiriesCount,
        pendingReviewsCount,
        refreshSidebarCounts: fetchSidebarCounts,
        dashboardStats,
        isLoadingStats,
        refreshDashboardStats: fetchDashboardStats,
      }}
    >
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner(): OwnerContextType {
  const context = useContext(OwnerContext);
  if (!context) {
    throw new Error('useOwner must be used within an OwnerProvider');
  }
  return context;
}

/**
 * Hook for child owner dashboard pages and components to register an asynchronous refresh handler.
 * Automatically cleans up on unmount.
 */
export function useRegisterOwnerRefresh(handler: () => Promise<void>) {
  const { registerRefreshHandler } = useOwner();

  useEffect(() => {
    return registerRefreshHandler(handler);
  }, [registerRefreshHandler, handler]);
}
