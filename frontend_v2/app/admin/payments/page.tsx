'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  Filter,
  Calendar,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  ShieldAlert,
  ArrowUpRight,
  Store,
  Layers,
  ShoppingBag,
  ExternalLink,
  X,
  FileQuestion,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import { getAdminPayments, getAdminPaymentDetail } from '@/lib/api/admin';
import { AdminPaymentSummary, AdminPaymentDetail } from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/common/Toast';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

type TransactionTypeFilter = 'ALL' | 'SUBSCRIPTION' | 'RETAIL_ORDER' | 'UNKNOWN';
type GatewayStatusFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionTypeFilter>('ALL');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusFilter>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Detail Modal
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<AdminPaymentDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const toast = useToast();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchSeqRef = useRef<number>(0);
  const detailSeqRef = useRef<number>(0);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(0);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Date validation
  const validateDates = (start: string, end: string) => {
    if (start && end && start > end) {
      setDateError('Start date cannot be after end date');
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (validateDates(val, endDate)) {
      setPage(0);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (validateDates(startDate, val)) {
      setPage(0);
    }
  };

  const fetchPayments = useCallback(async (isManual = false) => {
    const currentSeq = ++fetchSeqRef.current;
    if (!isManual) setIsLoading(true);
    setError(null);

    try {
      const res = await getAdminPayments({
        page,
        size,
        query: debouncedQuery.trim() || undefined,
        type: transactionType !== 'ALL' ? transactionType : undefined,
        status: gatewayStatus !== 'ALL' ? gatewayStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (currentSeq === fetchSeqRef.current) {
        setPayments(res.content || []);
        setTotalPages(res.totalPages || 0);
        setTotalElements(res.totalElements || 0);
      }
    } catch (err: any) {
      if (currentSeq === fetchSeqRef.current) {
        console.error('Failed to load admin payments:', err);
        setError(err?.message || 'Failed to fetch gateway transactions. Please check your network or try again.');
      }
    } finally {
      if (currentSeq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, size, debouncedQuery, transactionType, gatewayStatus, startDate, endDate]);

  // Register with shared AdminRefreshContext so header Refresh button awaits payments fetch
  useRegisterAdminRefresh(
    useCallback(async () => {
      await fetchPayments(true);
    }, [fetchPayments])
  );

  useEffect(() => {
    fetchPayments();

    const handleRefresh = () => {
      fetchPayments(true);
    };

    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [fetchPayments]);

  // Open Payment Details
  const handleOpenDetail = async (paymentId: number) => {
    const currentDetailSeq = ++detailSeqRef.current;
    setSelectedPaymentId(paymentId);
    setIsLoadingDetail(true);
    setDetailError(null);
    setPaymentDetail(null);

    try {
      const data = await getAdminPaymentDetail(paymentId);
      if (currentDetailSeq === detailSeqRef.current) {
        setPaymentDetail(data);
      }
    } catch (err: any) {
      if (currentDetailSeq === detailSeqRef.current) {
        console.error('Failed to load payment details:', err);
        setDetailError(err?.message || 'Failed to load payment details.');
      }
    } finally {
      if (currentDetailSeq === detailSeqRef.current) {
        setIsLoadingDetail(false);
      }
    }
  };

  const handleCloseDetail = () => {
    detailSeqRef.current++;
    setSelectedPaymentId(null);
    setPaymentDetail(null);
    setDetailError(null);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setTransactionType('ALL');
    setGatewayStatus('ALL');
    setStartDate('');
    setEndDate('');
    setDateError(null);
    setPage(0);
  };

  const hasActiveFilters =
    debouncedQuery !== '' ||
    transactionType !== 'ALL' ||
    gatewayStatus !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const formatCurrency = (val?: number | null, curr = 'INR') => {
    if (val === null || val === undefined) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr || 'INR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getGatewayStatusBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    switch (upper) {
      case 'COMPLETED':
        return (
          <Badge variant="default" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Completed
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="default" className="bg-amber-50 text-amber-700 border-amber-200">
            Pending
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="default" className="bg-rose-50 text-rose-700 border-rose-200">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    const upper = (type || '').toUpperCase();
    switch (upper) {
      case 'SUBSCRIPTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <TrendingUp className="w-3 h-3 text-indigo-600" />
            Subscription
          </span>
        );
      case 'RETAIL_ORDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShoppingBag className="w-3 h-3 text-emerald-600" />
            Retail Order
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <FileQuestion className="w-3 h-3 text-amber-600" />
            Unlinked Record
          </span>
        );
    }
  };

  const getFinancialClassificationBadge = (classification: string) => {
    const upper = (classification || '').toUpperCase();
    switch (upper) {
      case 'PLATFORM_REVENUE':
        return (
          <span className="text-xs font-medium text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded">
            Platform SaaS Revenue
          </span>
        );
      case 'NETWORK_GMV_ZERO_COMMISSION':
        return (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded">
            0% Comm. Network GMV
          </span>
        );
      case 'UNLINKED_TRANSACTION':
      default:
        return (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Unlinked Gateway Record
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <Receipt className="w-4 h-4" />
            <span>Financial Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
            Payments Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete audit trail of cross-shop gateway transactions, distinguishing CakeStore SaaS subscription revenue from 0% commission retail bakery GMV.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPayments(true)}
            disabled={isLoading}
            className="flex items-center gap-2 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Explanatory 3-Tier Classification Banner */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-0 shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-400/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              CakeStore Three-Tier Financial Segregation Invariant
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="font-semibold text-indigo-300 mb-0.5">1. Platform SaaS Revenue</div>
                <div className="text-[11px] text-slate-300">
                  Software subscription fees earned by CakeStore platform from bakeries. Directly counts toward ARR and dashboard revenue.
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="font-semibold text-emerald-300 mb-0.5">2. Bakery GMV (0% Commission)</div>
                <div className="text-[11px] text-slate-300">
                  Customer payments for retail cake orders. CakeStore charges <span className="font-bold text-white">0.00% commission</span>. 100% of order GMV belongs to the bakeries.
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="font-semibold text-amber-300 mb-0.5">3. Unlinked Gateway Records</div>
                <div className="text-[11px] text-slate-300">
                  Orphaned gateway charges without verified subscription or order links. Strictly excluded from platform revenue and never presented as orders.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters and Search Bar Card */}
      <Card className="p-4 sm:p-5 shadow-xs border-slate-200/80 bg-white">
        <div className="space-y-4">
          {/* Top row: Search and primary selects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search payment ID, order ID, bakery, reason..."
                className="pl-9 pr-8 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Transaction Type Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Transaction Classification</label>
              <select
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value as TransactionTypeFilter);
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Classifications</option>
                <option value="SUBSCRIPTION">SaaS Subscription (Platform Rev)</option>
                <option value="RETAIL_ORDER">Retail Order GMV (0% Comm)</option>
                <option value="UNKNOWN">Unlinked Gateway Records</option>
              </select>
            </div>

            {/* Gateway Status Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gateway Status</label>
              <select
                value={gatewayStatus}
                onChange={(e) => {
                  setGatewayStatus(e.target.value as GatewayStatusFilter);
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Gateway Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {/* Bottom row: Date Filters and Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date Range:</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-xs rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                placeholder="From date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="text-xs rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                placeholder="To date"
              />
              {dateError && <span className="text-xs text-rose-600 font-medium">{dateError}</span>}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                Clear all filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden shadow-xs border-slate-200/80 bg-white">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-rose-700 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchPayments(true)}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-20">
            <LoadingState message="Loading payments ledger..." />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={<Receipt className="w-7 h-7" />}
              title="No payments found"
              description={
                hasActiveFilters
                  ? 'No gateway payment records match your active criteria. Try broadening your filter selection.'
                  : 'No payment transactions recorded yet.'
              }
              action={
                hasActiveFilters ? (
                  <Button size="sm" variant="outline" onClick={handleResetFilters}>
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Payment #</th>
                  <th className="py-3.5 px-4">Bakery</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Gateway Status</th>
                  <th className="py-3.5 px-4">Transaction Type</th>
                  <th className="py-3.5 px-4">Financial Classification</th>
                  <th className="py-3.5 px-4">Association / Entity</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Payment # / Gateway ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-medium text-slate-900 text-xs">
                        {p.providerPaymentId || `PAY-${p.id}`}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.providerOrderId ? p.providerOrderId : `ID: #${p.id}`}
                      </div>
                    </td>

                    {/* Bakery / Shop Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{p.shopName || 'Unknown Bakery'}</div>
                      {p.shopId && <div className="text-xs text-slate-400">Shop ID: #{p.shopId}</div>}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(p.amount, p.currency)}
                    </td>

                    {/* Gateway Status */}
                    <td className="py-3.5 px-4">
                      {getGatewayStatusBadge(p.gatewayStatus)}
                    </td>

                    {/* Transaction Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getTransactionTypeBadge(p.transactionType)}
                    </td>

                    {/* Financial Classification */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getFinancialClassificationBadge(p.financialClassification)}
                    </td>

                    {/* Association / Entity */}
                    <td className="py-3.5 px-4">
                      {p.transactionType === 'SUBSCRIPTION' ? (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{p.planName || 'Plan Purchase'}</span>
                        </div>
                      ) : p.transactionType === 'RETAIL_ORDER' && p.relatedOrderNumber ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium font-mono">
                          <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{p.relatedOrderNumber}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          No confirmed order
                        </span>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(p.paidAt || p.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(p.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 border-indigo-200 hover:border-indigo-300"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && payments.length > 0 && (
          <div className="px-4 py-3.5 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{page * size + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">
                {Math.min((page + 1) * size, totalElements)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{totalElements}</span> transactions
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium">
                  Page {page + 1} of {Math.max(totalPages, 1)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Payment Detail Modal */}
      {selectedPaymentId !== null && (
        <Modal
          isOpen={true}
          onClose={handleCloseDetail}
          title={`Transaction Details (ID #${selectedPaymentId})`}
          maxWidth="3xl"
        >
          {isLoadingDetail ? (
            <div className="py-12">
              <LoadingState message="Loading payment transaction..." />
            </div>
          ) : detailError ? (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-lg text-sm flex items-center justify-between">
              <span>{detailError}</span>
              <Button size="sm" variant="outline" onClick={() => handleOpenDetail(selectedPaymentId)}>
                Retry
              </Button>
            </div>
          ) : paymentDetail ? (
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
              {/* Classification Overview Box */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Classification:</span>
                    {getTransactionTypeBadge(paymentDetail.transactionType)}
                  </div>
                  <div>
                    {getFinancialClassificationBadge(paymentDetail.financialClassification)}
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200/80 leading-relaxed">
                  {paymentDetail.transactionType === 'SUBSCRIPTION' ? (
                    <span className="text-indigo-900 font-medium">
                      This transaction is software subscription platform revenue earned by CakeStore from {paymentDetail.shopName}. It contributes directly to CakeStore platform ARR and dashboard metrics.
                    </span>
                  ) : paymentDetail.transactionType === 'RETAIL_ORDER' ? (
                    <span className="text-emerald-900 font-medium">
                      This transaction is customer payment for retail cake order #{paymentDetail.relatedOrderNumber}. CakeStore charges 0.00% commission. 100% of the funds belong to {paymentDetail.shopName}.
                    </span>
                  ) : (
                    <span className="text-amber-900 font-medium">
                      Unlinked Gateway Record: This payment has no established subscription or verified same-bakery order link. It is NOT counted as CakeStore SaaS subscription revenue and charges 0% commission.
                    </span>
                  )}
                </div>
              </div>

              {/* Transaction Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white rounded-lg border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold block">Amount</span>
                  <div className="mt-1 font-bold text-slate-900 text-sm">
                    {formatCurrency(paymentDetail.amount, paymentDetail.currency)}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold block">Gateway Status</span>
                  <div className="mt-1">{getGatewayStatusBadge(paymentDetail.gatewayStatus)}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold block">Provider</span>
                  <div className="mt-1 font-mono text-xs text-slate-700 font-semibold">{paymentDetail.provider || 'RAZORPAY'}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold block">Timestamp</span>
                  <div className="mt-1 text-xs text-slate-700 font-medium">
                    {formatDate(paymentDetail.paidAt || paymentDetail.createdAt)}
                  </div>
                </div>
              </div>

              {/* Gateway References */}
              <Card className="p-4 bg-white border-slate-200">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Gateway References</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Provider Payment ID</span>
                    <span className="font-mono text-slate-900 font-medium">
                      {paymentDetail.providerPaymentId || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Provider Order ID</span>
                    <span className="font-mono text-slate-900 font-medium">
                      {paymentDetail.providerOrderId || '—'}
                    </span>
                  </div>
                  {paymentDetail.failureReason && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                      <span className="text-slate-400 block">Diagnostic Log / Failure Reason</span>
                      <span className="font-mono text-slate-700 text-[11px] bg-slate-100 px-2 py-1 rounded block mt-1">
                        {paymentDetail.failureReason}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Entity Snapshots */}
              {paymentDetail.subscriptionDetails ? (
                /* Subscription Snapshot */
                <Card className="p-4 bg-indigo-50/50 border-indigo-200">
                  <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Associated Subscription Snapshot</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-indigo-400 block">Plan Name</span>
                      <span className="font-semibold text-indigo-950 text-sm">
                        {paymentDetail.subscriptionDetails.planName || 'Custom Plan'}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-400 block">Subscription Status</span>
                      <span className="font-semibold text-indigo-950">
                        {paymentDetail.subscriptionDetails.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-400 block">Subscription ID</span>
                      <span className="font-mono text-indigo-950">
                        #{paymentDetail.subscriptionDetails.subscriptionId}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-400 block">Start Date</span>
                      <span className="text-indigo-900">
                        {formatDate(paymentDetail.subscriptionDetails.startDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-400 block">Expiry Date</span>
                      <span className="text-indigo-900">
                        {formatDate(paymentDetail.subscriptionDetails.expiryDate)}
                      </span>
                    </div>
                  </div>
                </Card>
              ) : paymentDetail.orderDetails ? (
                /* Order Snapshot */
                <Card className="p-4 bg-emerald-50/50 border-emerald-200">
                  <h4 className="text-xs font-semibold text-emerald-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>Confirmed Retail Order Snapshot (Same Bakery Match)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-emerald-600 block">Order Number</span>
                      <span className="font-mono font-bold text-emerald-950 text-sm">
                        {paymentDetail.orderDetails.orderNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block">Order Total</span>
                      <span className="font-bold text-emerald-950 font-mono">
                        {formatCurrency(paymentDetail.orderDetails.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block">Order Status</span>
                      <span className="font-semibold text-emerald-950">
                        {paymentDetail.orderDetails.orderStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block">Customer</span>
                      <span className="text-emerald-950 font-medium">
                        {paymentDetail.orderDetails.customerName || 'Guest'}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block">Delivery Date</span>
                      <span className="text-emerald-950">
                        {paymentDetail.orderDetails.deliveryDate || 'Standard'}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block">Order ID</span>
                      <span className="font-mono text-emerald-950">
                        #{paymentDetail.orderDetails.orderId}
                      </span>
                    </div>
                  </div>
                </Card>
              ) : (
                /* Unlinked Card */
                <Card className="p-4 bg-amber-50/50 border-amber-200">
                  <div className="flex items-start gap-3">
                    <FileQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 space-y-1">
                      <div className="font-semibold text-sm">No Confirmed Entity Association</div>
                      <p>
                        This transaction could not be safely matched to a retail order in the same bakery or a platform subscription.
                      </p>
                      <p className="text-amber-800 text-[11px]">
                        Possible reasons: abandoned checkout, test transaction, or payment gateway reconciliation mismatch.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bakery Details */}
              <Card className="p-4 bg-white border-slate-200">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>Associated Bakery</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Bakery Business Name</span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {paymentDetail.shopName || 'Unknown Shop'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Bakery Phone</span>
                    <span className="text-slate-700">{paymentDetail.shopPhone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Bakery Email</span>
                    <span className="text-slate-700">{paymentDetail.shopEmail || '—'}</span>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
