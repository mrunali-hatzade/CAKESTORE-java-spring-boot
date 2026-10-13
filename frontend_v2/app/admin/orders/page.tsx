'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Filter,
  Calendar,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Sparkles,
  User,
  Phone,
  Mail,
  MapPin,
  X,
  CreditCard,
  DollarSign,
  Store,
  Layers,
} from 'lucide-react';
import { getAdminOrders, getAdminOrderDetail } from '@/lib/api/admin';
import { AdminOrderSummary, AdminOrderDetail } from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/common/Toast';

type OrderStatusFilter = 'ALL' | 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
type PaymentStatusFilter = 'ALL' | 'PAID' | 'PENDING' | 'FAILED' | 'REFUND_DUE' | 'REFUNDED' | 'COD' | 'ONLINE';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatusFilter>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Detail Modal
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetail, setOrderDetail] = useState<AdminOrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const toast = useToast();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchSeqRef = useRef<number>(0);
  const detailSeqRef = useRef<number>(0);

  // Debounce search input
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

  const fetchOrders = useCallback(async (isManual = false) => {
    const currentSeq = ++fetchSeqRef.current; // increment request sequence
    if (!isManual) setIsLoading(true);
    setError(null);

    try {
      const res = await getAdminOrders({
        page,
        size,
        query: debouncedQuery.trim() || undefined,
        status: orderStatus !== 'ALL' ? orderStatus : undefined,
        paymentStatus: paymentStatus !== 'ALL' ? paymentStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      // Only apply results if this is the latest request
      if (currentSeq === fetchSeqRef.current) {
        setOrders(res.content || []);
        setTotalPages(res.totalPages || 0);
        setTotalElements(res.totalElements || 0);
      }
    } catch (err: any) {
      if (currentSeq === fetchSeqRef.current) {
        console.error('Failed to load admin orders:', err);
        setError(err?.message || 'Failed to fetch cross-shop orders. Please check your network or try again.');
      }
    } finally {
      if (currentSeq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, size, debouncedQuery, orderStatus, paymentStatus, startDate, endDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Load Order Details
  const handleOpenDetail = async (orderId: number) => {
    const currentDetailSeq = ++detailSeqRef.current;
    setSelectedOrderId(orderId);
    setIsLoadingDetail(true);
    setDetailError(null);
    setOrderDetail(null);

    try {
      const data = await getAdminOrderDetail(orderId);
      if (currentDetailSeq === detailSeqRef.current) {
        setOrderDetail(data);
      }
    } catch (err: any) {
      if (currentDetailSeq === detailSeqRef.current) {
        console.error('Failed to load order details:', err);
        setDetailError(err?.message || 'Failed to load order details.');
      }
    } finally {
      if (currentDetailSeq === detailSeqRef.current) {
        setIsLoadingDetail(false);
      }
    }
  };

  const handleCloseDetail = () => {
    detailSeqRef.current++;
    setSelectedOrderId(null);
    setOrderDetail(null);
    setDetailError(null);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setOrderStatus('ALL');
    setPaymentStatus('ALL');
    setStartDate('');
    setEndDate('');
    setDateError(null);
    setPage(0);
  };

  const hasActiveFilters =
    debouncedQuery !== '' ||
    orderStatus !== 'ALL' ||
    paymentStatus !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const formatCurrency = (val?: number | null) => {
    if (val === null || val === undefined) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
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

  const getOrderStatusBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    switch (upper) {
      case 'NEW':
      case 'PENDING':
        return <Badge variant="default" className="bg-sky-50 text-sky-700 border-sky-200">Pending</Badge>;
      case 'CONFIRMED':
        return <Badge variant="default" className="bg-indigo-50 text-indigo-700 border-indigo-200">Confirmed</Badge>;
      case 'PREPARING':
        return <Badge variant="default" className="bg-amber-50 text-amber-700 border-amber-200">Preparing</Badge>;
      case 'READY':
      case 'READY_FOR_PICKUP':
        return <Badge variant="default" className="bg-purple-50 text-purple-700 border-purple-200">Ready</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="default" className="bg-cyan-50 text-cyan-700 border-cyan-200">Out for Delivery</Badge>;
      case 'DELIVERED':
      case 'COMPLETED':
        return <Badge variant="default" className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="default" className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (pStatus: string, oStatus?: string) => {
    const upperP = (pStatus || '').toUpperCase();
    const upperO = (oStatus || '').toUpperCase();

    // Derived Refund Due state
    if (upperO === 'CANCELLED' && upperP === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Refund Due
        </span>
      );
    }

    switch (upperP) {
      case 'PAID':
        return <Badge variant="default" className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>;
      case 'PENDING':
        return <Badge variant="default" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case 'FAILED':
        return <Badge variant="default" className="bg-rose-50 text-rose-700 border-rose-200">Failed</Badge>;
      case 'REFUNDED':
        return <Badge variant="default" className="bg-slate-100 text-slate-700 border-slate-300">Refunded</Badge>;
      default:
        return <Badge variant="default">{pStatus || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <ShoppingBag className="w-4 h-4" />
            <span>Platform Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
            Orders Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cross-shop retail customer orders across all registered bakeries with customer privacy protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(true)}
            disabled={isLoading}
            className="flex items-center gap-2 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
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
                placeholder="Search order #, customer, bakery, phone..."
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

            {/* Order Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Order Status</label>
              <select
                value={orderStatus}
                onChange={(e) => {
                  setOrderStatus(e.target.value as OrderStatusFilter);
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Order Statuses</option>
                <option value="NEW">New / Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY">Ready for Pickup</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value as PaymentStatusFilter);
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="REFUND_DUE">Refund Due (Cancelled + Paid)</option>
                <option value="REFUNDED">Refunded</option>
                <option value="FAILED">Failed</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="ONLINE">Online Payment</option>
              </select>
            </div>
          </div>

          {/* Bottom row: Date Filters and Active Filter status */}
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
            <Button size="sm" variant="outline" onClick={() => fetchOrders(true)}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-20">
            <LoadingState message="Loading cross-shop orders ledger..." />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={<ShoppingBag className="w-7 h-7" />}
              title="No orders found"
              description={
                hasActiveFilters
                  ? 'No retail orders match your selected filters. Try broadening your criteria.'
                  : 'No customer orders have been placed on the platform yet.'
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
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Bakery</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-center">Items</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Delivery Date</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Order Number */}
                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-600">
                      {o.orderNumber}
                    </td>

                    {/* Bakery / Shop Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{o.shopName || 'Unknown Bakery'}</div>
                      {o.shopId && <div className="text-xs text-slate-400">Shop ID: #{o.shopId}</div>}
                    </td>

                    {/* Customer (Name & Masked PII) */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{o.customerName || 'Guest Customer'}</div>
                      <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-0.5">
                        {o.customerPhoneMasked && <span>{o.customerPhoneMasked}</span>}
                        {o.customerEmailMasked && <span>{o.customerEmailMasked}</span>}
                      </div>
                    </td>

                    {/* Items Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {o.itemCount || 1}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {formatCurrency(o.totalAmount)}
                    </td>

                    {/* Order Status */}
                    <td className="py-3.5 px-4">
                      {getOrderStatusBadge(o.orderStatus)}
                    </td>

                    {/* Payment Status & Method */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        {getPaymentStatusBadge(o.paymentStatus, o.orderStatus)}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {o.paymentMethod || 'ONLINE'}
                        </span>
                      </div>
                    </td>

                    {/* Delivery Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {o.deliveryDate ? o.deliveryDate : '—'}
                      {o.deliverySlotDetails && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {o.deliverySlotDetails}
                        </div>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(o.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(o.id)}
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
        {!isLoading && orders.length > 0 && (
          <div className="px-4 py-3.5 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{page * size + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">
                {Math.min((page + 1) * size, totalElements)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{totalElements}</span> orders
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

      {/* Order Detail Modal */}
      {selectedOrderId !== null && (
        <Modal
          isOpen={true}
          onClose={handleCloseDetail}
          title={`Order #${orderDetail?.orderNumber || selectedOrderId}`}
          maxWidth="3xl"
        >
          {isLoadingDetail ? (
            <div className="py-12">
              <LoadingState message="Loading order details..." />
            </div>
          ) : detailError ? (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-lg text-sm flex items-center justify-between">
              <span>{detailError}</span>
              <Button size="sm" variant="outline" onClick={() => handleOpenDetail(selectedOrderId)}>
                Retry
              </Button>
            </div>
          ) : orderDetail ? (
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
              {/* Refund Due Alert Banner */}
              {orderDetail.orderStatus === 'CANCELLED' && orderDetail.paymentStatus === 'PAID' && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">Refund Action Required</h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      This order was cancelled while in a paid state. A refund is due to the customer for the full amount of {formatCurrency(orderDetail.totalAmount)}.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Header Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Order Status</span>
                  <div className="mt-1">{getOrderStatusBadge(orderDetail.orderStatus)}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Payment Status</span>
                  <div className="mt-1">{getPaymentStatusBadge(orderDetail.paymentStatus, orderDetail.orderStatus)}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Total Amount</span>
                  <div className="mt-1 font-bold text-slate-900 text-sm">{formatCurrency(orderDetail.totalAmount)}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Placed On</span>
                  <div className="mt-1 text-xs text-slate-700 font-medium">{formatDate(orderDetail.createdAt)}</div>
                </div>
              </div>

              {/* Two columns: Customer & Bakery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Details */}
                <Card className="p-4 bg-white border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">
                    <User className="w-4 h-4" />
                    <span>Customer Details (Authorized Admin View)</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div>
                      <span className="text-slate-400 block">Full Name</span>
                      <span className="font-semibold text-slate-900 text-sm">{orderDetail.customerName || 'Guest'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{orderDetail.customerPhone || 'No phone provided'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{orderDetail.customerEmail || 'No email provided'}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block">Delivery Address</span>
                        <span className="text-slate-800 font-medium leading-relaxed">
                          {orderDetail.deliveryAddress || 'Pickup at Store'}
                        </span>
                      </div>
                    </div>
                    {orderDetail.specialInstructions && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-400 block">Special Instructions</span>
                        <span className="text-amber-800 font-medium bg-amber-50 px-2 py-1 rounded inline-block mt-1">
                          &ldquo;{orderDetail.specialInstructions}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Bakery & Delivery Details */}
                <Card className="p-4 bg-white border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">
                    <Store className="w-4 h-4" />
                    <span>Bakery & Fulfillment Slot</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div>
                      <span className="text-slate-400 block">Bakery Name</span>
                      <span className="font-semibold text-slate-900 text-sm">{orderDetail.shopName || 'Unknown Shop'}</span>
                    </div>
                    {orderDetail.shopPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{orderDetail.shopPhone}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-400 block">Scheduled Delivery Date</span>
                      <span className="font-semibold text-slate-800 text-sm">
                        {orderDetail.deliveryDate ? orderDetail.deliveryDate : 'As soon as ready'}
                      </span>
                    </div>
                    {orderDetail.deliverySlotDetails && (
                      <div>
                        <span className="text-slate-400 block">Time Slot</span>
                        <span className="font-medium text-slate-800">{orderDetail.deliverySlotDetails}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-400 block">Payment Method</span>
                      <span className="font-mono text-slate-800 font-medium">{orderDetail.paymentMethod}</span>
                    </div>
                    {orderDetail.transactionId && (
                      <div>
                        <span className="text-slate-400 block">Gateway Transaction ID</span>
                        <span className="font-mono text-slate-800 text-[11px]">{orderDetail.transactionId}</span>
                      </div>
                    )}
                    {orderDetail.razorpayOrderId && (
                      <div>
                        <span className="text-slate-400 block">Gateway Order ID</span>
                        <span className="font-mono text-slate-800 text-[11px]">{orderDetail.razorpayOrderId}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ordered Items ({orderDetail.items?.length || 0})</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3">Variant / Options</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderDetail.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {item.productNameSnapshot}
                            {item.cakeMessage && (
                              <div className="text-[11px] text-indigo-600 italic mt-0.5">
                                Msg: &ldquo;{item.cakeMessage}&rdquo;
                              </div>
                            )}
                            {item.addonsSummary && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Addons: {item.addonsSummary}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.variantName || 'Standard'}
                            {item.dietaryPreference && (
                              <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                                {item.dietaryPreference}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 font-mono">
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price Breakdown Footer */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div>* CakeStore charges 0.00% commission on cake retail sales.</div>
                  <div>100% of order value belongs to {orderDetail.shopName || 'the bakery'}.</div>
                </div>

                <div className="w-full sm:w-64 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatCurrency(orderDetail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span className="font-mono">{formatCurrency(orderDetail.deliveryCharge)}</span>
                  </div>
                  {orderDetail.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount ({orderDetail.couponCode || 'Promo'}):</span>
                      <span className="font-mono">-{formatCurrency(orderDetail.discountAmount)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-indigo-600 font-mono">{formatCurrency(orderDetail.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
