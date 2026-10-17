'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Store,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { getAllShops, updateShopStatus, updateShopVerification, getShopCounts } from '@/lib/api/admin';
import { AdminShopSummary } from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/common/Toast';
import { BakeryStatusBadge, computeStorefrontAvailability } from '@/components/admin/BakeryStatusBadge';
import { AdminSuspensionModal } from '@/components/admin/shops/AdminSuspensionModal';
import { AdminKycRejectionModal } from '@/components/admin/shops/AdminKycRejectionModal';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

type FilterTab = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

const parseFilterTab = (status: string | null): FilterTab => {
  if (!status) return 'ALL';
  const upper = status.toUpperCase();
  if (upper === 'PENDING' || upper === 'ACTIVE' || upper === 'SUSPENDED' || upper === 'DELETED' || upper === 'ALL') {
    return upper as FilterTab;
  }
  return 'ALL';
};

export default function AdminShopsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<AdminShopSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>(() => parseFilterTab(searchParams.get('status')));
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  
  const [shopCounts, setShopCounts] = useState<{ total: number; active: number; pending: number; suspended: number; deleted: number } | null>(null);

  // Bulk selection state
  const [selectedShopIds, setSelectedShopIds] = useState<number[]>([]);
  const [isBulkMutating, setIsBulkMutating] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{ action: string; label: string } | null>(null);

  // Suspend modal state (handles both single row and bulk suspension)
  const [suspendModalState, setSuspendModalState] = useState<{
    isOpen: boolean;
    shopId?: number;
    shopName?: string;
    isBulk: boolean;
  }>({
    isOpen: false,
    isBulk: false,
  });

  // KYC Rejection modal state (handles both single row and bulk rejection)
  const [kycRejectModalState, setKycRejectModalState] = useState<{
    isOpen: boolean;
    shopId?: number;
    shopName?: string;
    isBulk: boolean;
  }>({
    isOpen: false,
    isBulk: false,
  });

  // Sync URL search params with local state
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchQuery((prev) => (q !== prev ? q : prev));
    }
    const statusParam = searchParams.get('status');
    if (statusParam !== null) {
      const parsed = parseFilterTab(statusParam);
      setActiveTab((prev) => (parsed !== prev ? parsed : prev));
    }
  }, [searchParams]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const toast = useToast();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0); // Reset page on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(0);
    setSelectedShopIds([]);

    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', tab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedShopIds([]);
  };

  // Reset page and selection on tab change
  useEffect(() => {
    setPage(0);
    setSelectedShopIds([]);
  }, [activeTab]);

  const fetchShops = useCallback(async (isManual = false) => {
    if (!isManual) setIsLoading(true);

    try {
      setError('');
      // Fetch stats for the tab counts
      const statsRes = await getShopCounts();
      setShopCounts(statsRes);

      const response = await getAllShops(page, 20, debouncedSearch, activeTab);
      setShops(response.content || []);
      setTotalPages(response.totalPages || 0);
      setTotalElements(response.totalElements || 0);
    } catch (err: any) {
      console.error('Failed to fetch shops:', err);
      setError(err?.message || 'Failed to load shops. Please try again.');
      toast.error('Failed to load shops');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, activeTab, toast]);

  useRegisterAdminRefresh(
    useCallback(async () => {
      await fetchShops(true);
    }, [fetchShops])
  );

  useEffect(() => {
    fetchShops();

    const handleRefresh = () => {
      fetchShops(true);
    };

    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [fetchShops]);

  const handleBulkAction = async (newStatus: string, reason?: string) => {
    if (!selectedShopIds.length) return;
    setIsBulkMutating(true);
    try {
      const results = await Promise.allSettled(
        selectedShopIds.map((id) => updateShopStatus(id, newStatus, reason?.trim()))
      );

      const successfulIds: number[] = [];
      const failedIds: number[] = [];

      results.forEach((res, index) => {
        const id = selectedShopIds[index];
        if (res.status === 'fulfilled') {
          successfulIds.push(id);
        } else {
          failedIds.push(id);
        }
      });

      if (failedIds.length === 0) {
        toast.success(`Bulk action successful: ${successfulIds.length} bakeries updated to ${newStatus}`);
        setSelectedShopIds([]);
      } else if (successfulIds.length === 0) {
        toast.error(`Bulk action failed for all ${failedIds.length} selected bakeries`);
      } else {
        toast.error(`Partial success: ${successfulIds.length} bakeries updated to ${newStatus}, but ${failedIds.length} failed (#${failedIds.join(', #')})`);
        // Keep failed IDs selected so admin can inspect or retry
        setSelectedShopIds(failedIds);
      }

      fetchShops(true);
    } catch (err: any) {
      toast.error(err.message || 'Bulk action failed');
    } finally {
      setIsBulkMutating(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedShopIds(shops.map(s => s.shopId));
    } else {
      setSelectedShopIds([]);
    }
  };

  const handleSelectShop = (shopId: number, checked: boolean) => {
    if (checked) {
      setSelectedShopIds(prev => [...prev, shopId]);
    } else {
      setSelectedShopIds(prev => prev.filter(id => id !== shopId));
    }
  };

  const handleStatusChange = async (shopId: number, newStatus: string, reason?: string) => {
    if (newStatus === 'SUSPENDED') {
      const targetShop = shops.find(s => s.shopId === shopId);
      setSuspendModalState({
        isOpen: true,
        shopId,
        shopName: targetShop?.businessName,
        isBulk: false,
      });
      return;
    }

    setMutatingId(shopId);
    try {
      await updateShopStatus(shopId, newStatus, reason?.trim());
      toast.success(`Bakery #${shopId} status changed to ${newStatus}`);
      // Optimistic update
      setShops((prev) =>
        prev.map((s) => (s.shopId === shopId ? { ...s, shopStatus: newStatus } : s))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update bakery status');
    } finally {
      setMutatingId(null);
    }
  };

  const handleConfirmSuspension = async (reason: string) => {
    if (!reason || !reason.trim()) {
      toast.error('Suspension reason is mandatory and cannot be blank.');
      return;
    }

    if (suspendModalState.isBulk) {
      await handleBulkAction('SUSPENDED', reason);
      setSuspendModalState({ isOpen: false, isBulk: false });
    } else if (suspendModalState.shopId) {
      const shopId = suspendModalState.shopId;
      setMutatingId(shopId);
      try {
        await updateShopStatus(shopId, 'SUSPENDED', reason.trim());
        toast.success(`Bakery #${shopId} suspended successfully`);
        setShops((prev) =>
          prev.map((s) => (s.shopId === shopId ? { ...s, shopStatus: 'SUSPENDED' } : s))
        );
        setSuspendModalState({ isOpen: false, isBulk: false });
        fetchShops(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to suspend bakery');
      } finally {
        setMutatingId(null);
      }
    }
  };

  const handleBulkKycAction = async (action: 'APPROVE' | 'REJECT', reason?: string) => {
    if (!selectedShopIds.length) return;
    setIsBulkMutating(true);
    try {
      const results = await Promise.allSettled(
        selectedShopIds.map((id) => updateShopVerification(id, action, reason?.trim()))
      );

      const successfulIds: number[] = [];
      const failedIds: number[] = [];

      results.forEach((res, index) => {
        const id = selectedShopIds[index];
        if (res.status === 'fulfilled') {
          successfulIds.push(id);
        } else {
          failedIds.push(id);
        }
      });

      const actionLabel = action === 'APPROVE' ? 'verified' : 'rejected';
      if (failedIds.length === 0) {
        toast.success(`Bulk KYC review successful: ${successfulIds.length} bakeries marked as ${actionLabel}`);
        setSelectedShopIds([]);
      } else if (successfulIds.length === 0) {
        toast.error(`Bulk KYC review failed for all ${failedIds.length} selected bakeries`);
      } else {
        toast.error(`Partial success: ${successfulIds.length} bakeries marked as ${actionLabel}, but ${failedIds.length} failed (#${failedIds.join(', #')})`);
        setSelectedShopIds(failedIds);
      }

      fetchShops(true);
    } catch (err: any) {
      toast.error(err.message || 'Bulk KYC review failed');
    } finally {
      setIsBulkMutating(false);
    }
  };

  const handleConfirmKycRejection = async (reason: string) => {
    if (!reason || !reason.trim()) {
      toast.error('Rejection reason is mandatory and cannot be blank.');
      return;
    }

    if (kycRejectModalState.isBulk) {
      await handleBulkKycAction('REJECT', reason.trim());
      setKycRejectModalState({ isOpen: false, isBulk: false });
    } else if (kycRejectModalState.shopId) {
      const shopId = kycRejectModalState.shopId;
      setMutatingId(shopId);
      try {
        await updateShopVerification(shopId, 'REJECT', reason.trim());
        toast.success(`Bakery #${shopId} verification status marked as REJECTED`);
        setShops((prev) =>
          prev.map((s) => (s.shopId === shopId ? { ...s, shopStatus: 'REJECTED' } : s))
        );
        setKycRejectModalState({ isOpen: false, isBulk: false });
        fetchShops(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to reject verification');
      } finally {
        setMutatingId(null);
      }
    }
  };

  const getStatusBadge = (shop: AdminShopSummary) => {
    return (
      <BakeryStatusBadge
        shopStatus={shop.shopStatus}
        subscriptionStatus={shop.subscriptionStatus}
        isOwnerEnabled={shop.isOwnerEnabled}
        isMarketplaceRestricted={shop.isMarketplaceRestricted}
        isDeleted={shop.isDeleted}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900">
            Bakery Directory & Moderation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit FSSAI credentials, inspect bakery onboarding, and manage store operational status
          </p>
        </div>
      </div>

      {/* Controls Bar: Tabs & Search */}
      <Card className="p-4 border-slate-200 shadow-soft space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => handleTabChange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({(shopCounts?.total || 0)})
          </button>
          <button
            onClick={() => handleTabChange('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'PENDING'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending Approval</span>
            {(shopCounts?.pending || 0) > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {(shopCounts?.pending || 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({(shopCounts?.active || 0)})
          </button>
          <button
            onClick={() => handleTabChange('SUSPENDED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'SUSPENDED'
                ? 'bg-white text-rose-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suspended ({(shopCounts?.suspended || 0)})
          </button>
          <button
            onClick={() => handleTabChange('DELETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'DELETED'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Deleted{shopCounts?.deleted !== undefined ? ` (${shopCounts.deleted})` : ''}
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <Input
            placeholder="Search by bakery or owner..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Bulk Actions Panel */}
      {selectedShopIds.length > 0 && activeTab !== 'DELETED' && (
        <Card className="p-4 border-slate-200 shadow-soft bg-indigo-50 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-indigo-900">
            {selectedShopIds.length} bakery(s) selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={isBulkMutating}
              onClick={() => setBulkConfirm({ action: 'ACTIVE', label: 'approve' })}
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-xs px-3 py-1.5"
            >
              Bulk Approve (KYC)
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isBulkMutating}
              onClick={() => setSuspendModalState({ isOpen: true, isBulk: true })}
              className="text-xs px-3 py-1.5"
            >
              Bulk Suspend
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isBulkMutating}
              onClick={() => setKycRejectModalState({ isOpen: true, isBulk: true })}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs px-3 py-1.5 bg-white"
            >
              Bulk Reject
            </Button>
            {isBulkMutating && (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            )}
          </div>
        </Card>
      )}

      {error && (<div className='p-4 m-4 bg-red-100 text-red-800 border border-red-300 rounded-lg whitespace-pre-wrap'><h3 className='font-bold'>Error loading shops:</h3><p>{error}</p></div>)}

      {/* Bakeries Table */}
      {isLoading ? (
        <div className="py-20">
          <LoadingState message="Loading bakery directory & compliance registry..." />
        </div>
      ) : shops.length === 0 ? (
        <EmptyState
          icon={<Store className="w-8 h-8 text-slate-400" />}
          title="No Bakeries Found"
          description={
            debouncedSearch
              ? `No bakeries matching "${debouncedSearch}" found in the ${activeTab === 'ALL' ? 'platform directory' : activeTab.toLowerCase() + ' category'}.`
              : `No bakeries currently found in the ${activeTab === 'ALL' ? 'platform directory' : activeTab.toLowerCase() + ' category'}.`
          }
          action={
            (debouncedSearch || activeTab !== 'ALL') ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setActiveTab('ALL');
                  setPage(0);
                  setSelectedShopIds([]);
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden border-slate-200/80 shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold">
                  <th className="py-3.5 px-4 w-12">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={shops.length > 0 && selectedShopIds.length === shops.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="py-3.5 px-5">Bakery Name & ID</th>
                  <th className="py-3.5 px-4">Owner Profile</th>
                  <th className="py-3.5 px-4">Registration Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shops.map((shop) => {
                  const isMutating = mutatingId === shop.shopId;

                  return (
                    <tr key={shop.shopId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Checkbox */}
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedShopIds.includes(shop.shopId)}
                          onChange={(e) => handleSelectShop(shop.shopId, e.target.checked)}
                        />
                      </td>

                      {/* Name & ID */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {shop.businessName.charAt(0)}
                          </div>
                          <div>
                            <Link
                              href={`/admin/shops/${shop.shopId}`}
                              className="font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                            >
                              <span>{shop.businessName}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </Link>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Tenant #{shop.shopId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner Profile */}
                      <td className="py-4 px-4">
                        <p className="font-semibold text-slate-800">{shop.ownerName || '—'}</p>
                        <p className="text-[11px] text-slate-400">{shop.ownerEmail || '—'}</p>
                      </td>

                      {/* Registration Date */}
                      <td className="py-4 px-4 text-slate-600">
                        {shop.registeredAt
                          ? new Date(shop.registeredAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {getStatusBadge(shop)}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {shop.shopStatus !== 'DELETED' && (() => {
                            const availability = computeStorefrontAvailability({
                              shopStatus: shop.shopStatus,
                              subscriptionStatus: shop.subscriptionStatus,
                              isOwnerEnabled: shop.isOwnerEnabled,
                              isMarketplaceRestricted: shop.isMarketplaceRestricted,
                              isDeleted: shop.isDeleted,
                            });

                            return (
                              <Link
                                href={`/shop/${shop.shopId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={
                                  availability.isStoreLive
                                    ? 'Open live customer storefront in new tab'
                                    : 'Storefront currently unavailable to customers (Admin preview will show offline state)'
                                }
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`text-xs gap-1 ${
                                    availability.isStoreLive
                                      ? 'text-indigo-600 hover:text-indigo-800'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  <Store className="w-3.5 h-3.5" />
                                  <span>{availability.isStoreLive ? 'View Storefront' : 'Preview Storefront'}</span>
                                </Button>
                              </Link>
                            );
                          })()}
                          <Link href={`/admin/shops/${shop.shopId}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              {shop.shopStatus === 'DELETED' ? 'Inspect Archive' : 'Manage'}
                            </Button>
                          </Link>

                          {shop.shopStatus === 'DELETED' ? (
                            <span className="text-[11px] font-semibold text-slate-400 italic px-2">
                              Archived
                            </span>
                          ) : (
                            <>
                              {shop.shopStatus !== 'ACTIVE' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={isMutating}
                                  onClick={() => handleStatusChange(shop.shopId, 'ACTIVE')}
                                  className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-xs px-2.5 py-1"
                                >
                                  Approve
                                </Button>
                              )}

                              {shop.shopStatus === 'ACTIVE' && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={isMutating}
                                  onClick={() => handleStatusChange(shop.shopId, 'SUSPENDED')}
                                  className="text-xs px-2.5 py-1"
                                >
                                  Suspend
                                </Button>
                              )}

                              {shop.shopStatus === 'PENDING' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isMutating}
                                  onClick={() =>
                                    setKycRejectModalState({
                                      isOpen: true,
                                      shopId: shop.shopId,
                                      shopName: shop.businessName,
                                      isBulk: false,
                                    })
                                  }
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs px-2 py-1"
                                >
                                  Reject
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {totalElements > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-200 p-4 bg-gray-50/50">
              <span className="text-xs text-slate-500">
                Showing page {page + 1} of {totalPages || 1} ({totalElements} {totalElements === 1 ? 'total shop' : 'total shops'})
              </span>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs rounded-lg font-medium border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs rounded-lg font-medium border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Bulk Confirmation Modal */}
      {bulkConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setBulkConfirm(null)}
          title="Confirm Bulk Action"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to {bulkConfirm.label} {selectedShopIds.length} bakery(s)? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setBulkConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await handleBulkAction(bulkConfirm.action);
                  setBulkConfirm(null);
                }}
                disabled={isBulkMutating}
              >
                {isBulkMutating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Suspension Confirmation Modal (handles single row and bulk suspension) */}
      <AdminSuspensionModal
        isOpen={suspendModalState.isOpen}
        onClose={() => setSuspendModalState({ isOpen: false, isBulk: false })}
        onConfirm={handleConfirmSuspension}
        isMutating={suspendModalState.isBulk ? isBulkMutating : mutatingId !== null}
        title={
          suspendModalState.isBulk
            ? `Bulk Suspend ${selectedShopIds.length} Bakery Storefronts`
            : suspendModalState.shopName
            ? `Suspend ${suspendModalState.shopName}`
            : 'Suspend Bakery Storefront'
        }
        description={
          suspendModalState.isBulk
            ? `Immediately revoke public storefront access and suspend operational permissions for all ${selectedShopIds.length} selected bakeries.`
            : 'Immediately revoke public storefront access and suspend operational permissions.'
        }
      />

      {/* KYC Rejection Modal (handles single row and bulk verification rejection) */}
      <AdminKycRejectionModal
        isOpen={kycRejectModalState.isOpen}
        onClose={() => setKycRejectModalState({ isOpen: false, isBulk: false })}
        onConfirm={handleConfirmKycRejection}
        isMutating={kycRejectModalState.isBulk ? isBulkMutating : mutatingId !== null}
        title={
          kycRejectModalState.isBulk
            ? `Bulk Reject KYC Verification (${selectedShopIds.length} Bakeries)`
            : kycRejectModalState.shopName
            ? `Reject Verification: ${kycRejectModalState.shopName}`
            : 'Reject Bakery Verification'
        }
        description={
          kycRejectModalState.isBulk
            ? `Provide a clear, actionable rejection reason explaining what business compliance issues or document discrepancies must be resolved for all ${selectedShopIds.length} selected bakeries.`
            : 'Provide a clear, actionable rejection reason explaining what business compliance issues or document discrepancies must be resolved.'
        }
      />
    </div>
  );
}
