'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  Search,
  Printer,
  ChevronDown,
  Download,
  Eye,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Banknote,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cake,
  Sparkles,
  Truck,
  Store,
  Tag,
  IndianRupee,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ordersApi } from '@/lib/api/orders';
import { notificationsApi } from '@/lib/api/notifications';
import { useOwner } from '@/context/OwnerContext';
import { useToast } from '@/components/common/Toast';
import { Order, OrderStatus } from '@/types/order';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderDetailsModal } from '@/components/owner/OrderDetailsModal';

const ALL_STATUS_TABS = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'NEW', label: 'New' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PREPARING', label: 'Baking' },
  { key: 'READY', label: 'Ready' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New Order',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Baking / Preparing',
  READY: 'Ready for Pickup / Dispatch',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  CONFIRMED: ['NEW', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  PREPARING: ['CONFIRMED', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  READY: ['PREPARING', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  DELIVERED: ['READY', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function formatSlotDetails(slotStr?: string | null): string {
  if (!slotStr) return '';

  // 1. Clean any duplicated AM/PM artifact like 'AM AM' or 'AM PM'
  let result = slotStr.replace(/\b(AM|PM)\s+(AM|PM)\b/gi, (_, p1, p2) => p2);

  // 2. If AM or PM is already present, just strip leading zero from hours like '08:00 PM' -> '8:00 PM'
  if (/\b(?:AM|PM)\b/i.test(result)) {
    result = result.replace(/\b0([1-9]:\d{2}\s*(?:AM|PM))/gi, '$1');
  } else {
    // Convert 24-hour HH:mm to 12-hour h:mm AM/PM
    result = result.replace(/(\d{1,2}):(\d{2})(?::\d{2})?/g, (_, h, m) => {
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${m} ${ampm}`;
    });
  }

  // 3. Capitalize day names
  return result.replace(/\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/gi, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
}

function formatDeliveryDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === 'Standard') return 'Standard';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function formatOrderTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d
      .toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toUpperCase();
  } catch {
    return '';
  }
}

function formatOrderDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function OwnerOrdersContent() {
  const searchParams = useSearchParams();
  const { shop, registerRefreshHandler, refreshDashboard, refreshSidebarCounts, dashboardStats } = useOwner();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'CANCEL' | 'REFUND';
    orderId: number;
    orderNumber?: string;
  } | null>(null);

  // Pagination and Global Fetch State
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  
  // Dashboard stats for KPIs

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const data = await ordersApi.getOwnerOrders(
        filterStatus === 'ALL' ? undefined : filterStatus,
        filterPayment === 'ALL' ? undefined : filterPayment,
        currentPage, 
        itemsPerPage,
        search || undefined
      );
      setOrders(data?.content || []);
      setTotalPages(data?.totalPages || 1);
    } catch {
      setOrders([]);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [filterStatus, filterPayment, currentPage, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Deep-linking listener
  useEffect(() => {
    if (!searchParams) return;

    const p = searchParams.get('payment');
    if (p) setFilterPayment(p);

    const s = searchParams.get('search');
    if (s) setSearch(s);

    const orderId = searchParams.get('orderId');
    if (orderId) {
      ordersApi
        .getOrderDetails(Number(orderId))
        .then((ord) => {
          if (ord) {
            setSelectedOrder(ord);
            if (!s && ord.orderNumber) {
              setSearch(ord.orderNumber);
            }
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    notificationsApi
      .markTypeAsRead('NEW_ORDER')
      .then(() => refreshSidebarCounts?.())
      .catch(() => {});
  }, [refreshSidebarCounts]);

  useEffect(() => {
    const unregister = registerRefreshHandler(async () => {
      await fetchOrders(true);
    });
    return unregister;
  }, [registerRefreshHandler, fetchOrders]);

  const executeRefund = async () => {
    if (!confirmAction) return;
    setUpdatingPaymentId(confirmAction.orderId);
    try {
      const updated = await ordersApi.updatePaymentStatus(confirmAction.orderId, 'REFUNDED', 'REFUND_ISSUED');
      setOrders((prev) =>
        prev.map((o) =>
          o.id === confirmAction.orderId
            ? {
                ...o,
                ...updated,
                paymentStatus: 'REFUNDED',
              }
            : o
        )
      );
      if (selectedOrder && selectedOrder.id === confirmAction.orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                paymentStatus: 'REFUNDED',
              }
            : null
        );
      }
      toast.success(`Manual refund recorded for order #${updated.orderNumber || confirmAction.orderId}`);
      refreshDashboard().catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment status');
    } finally {
      setUpdatingPaymentId(null);
      setConfirmAction(null);
    }
  };

  const handlePaymentStatusChange = async (
    orderId: number,
    targetStatus: 'PAID' | 'PENDING' | 'REFUNDED'
  ) => {
    if (targetStatus === 'REFUNDED') {
      const order = orders.find((o) => o.id === orderId);
      setConfirmAction({ type: 'REFUND', orderId, orderNumber: order?.orderNumber });
      return;
    }

    setUpdatingPaymentId(orderId);
    try {
      const note = targetStatus === 'PAID' ? 'CASH_COLLECTED' : 'PENDING';
      const updated = await ordersApi.updatePaymentStatus(orderId, targetStatus, note);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                ...updated,
                paymentStatus: targetStatus,
                paidAt: targetStatus === 'PAID' ? updated.paidAt || new Date().toISOString() : undefined,
              }
            : o
        )
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                paymentStatus: targetStatus,
                paidAt: targetStatus === 'PAID' ? updated.paidAt || new Date().toISOString() : undefined,
              }
            : null
        );
      }
      toast.success(
        targetStatus === 'PAID'
          ? `Payment for order #${updated.orderNumber || orderId} marked as PAID`
          : `Payment for order #${updated.orderNumber || orderId} reset to PENDING`
      );
      refreshDashboard().catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment status');
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const executeStatusChange = async () => {
    if (!confirmAction) return;
    setUpdatingId(confirmAction.orderId);
    try {
      const updated = await ordersApi.updateOrderStatus(confirmAction.orderId, 'CANCELLED');
      const newStatus = (updated.orderStatus || updated.status || 'CANCELLED') as OrderStatus;
      setOrders((prev) =>
        prev.map((o) => (o.id === confirmAction.orderId ? { ...o, ...updated, status: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.id === confirmAction.orderId) {
        setSelectedOrder({ ...selectedOrder, ...updated, status: newStatus });
      }
      toast.success(`Order #${updated.orderNumber || confirmAction.orderId} moved to Cancelled`);
      refreshDashboard().catch(() => {});
      refreshSidebarCounts?.();
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || 'Failed to update status. Invalid transition.');
    } finally {
      setUpdatingId(null);
      setConfirmAction(null);
    }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
    if (status === 'CANCELLED') {
      const order = orders.find((o) => o.id === orderId);
      setConfirmAction({ type: 'CANCEL', orderId, orderNumber: order?.orderNumber });
      return;
    }

    setUpdatingId(orderId);
    try {
      const updated = await ordersApi.updateOrderStatus(orderId, status);
      const newStatus = (updated.orderStatus || updated.status || status) as OrderStatus;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated, status: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updated, status: newStatus });
      }
      toast.success(`Order #${updated.orderNumber || orderId} moved to ${STATUS_LABELS[status] || status}`);
      refreshDashboard().catch(() => {});
      refreshSidebarCounts?.();
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || 'Failed to update status. Invalid transition.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadInvoice = async (ord: Order) => {
    setDownloadingId(ord.id);
    try {
      await ordersApi.downloadInvoice(ord.id, ord.orderNumber);
      toast.success(`Tax invoice for #${ord.orderNumber} downloaded successfully!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrintKOT = (ord: Order) => {
    const win = window.open('', '_blank', 'width=450,height=650');
    if (!win) return;
    const isCod =
      (ord.paymentMethod || '').toUpperCase() === 'COD' ||
      (ord.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY';
    const isPaid = (ord.paymentStatus || '').toUpperCase() === 'PAID';
    const payModeStr = isCod ? 'CASH ON DELIVERY (COD)' : 'ONLINE PREPAID (RAZORPAY)';
    const payStatusStr = isPaid ? 'PAID' : isCod ? `PENDING (₹${ord.totalAmount})` : 'PENDING';
    const bakeryName = shop?.businessName || 'Artisanal Bakery';
    const bakeryAddress = shop?.address ? `<p class="center" style="font-size:10px; color:#555; margin:2px 0;">${shop.address}</p>` : '';

    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>KOT - ${ord.orderNumber}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; padding: 20px; font-size: 13px; color: #111; line-height: 1.4; }
        h2 { text-align: center; font-size: 16px; margin: 0 0 2px 0; }
        .center { text-align: center; }
        hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .alert-box { background: #fff3cd; border: 2px dashed #856404; color: #856404; padding: 8px; text-align: center; font-weight: bold; font-size: 13px; margin: 8px 0; border-radius: 4px; }
        .paid-box { background: #d4edda; border: 1px solid #155724; color: #155724; padding: 6px; text-align: center; font-weight: bold; margin: 8px 0; border-radius: 4px; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h2>${bakeryName}</h2>
        ${bakeryAddress}
        <p class="center" style="font-size:11px; font-weight:bold; letter-spacing:1px; margin-top:2px;">KITCHEN ORDER TICKET (KOT)</p>
        <hr/>
        <div class="row"><span><b>Order Number:</b></span><span>#${ord.orderNumber}</span></div>
        <div class="row"><span><b>Order Placed:</b></span><span>${formatOrderDate(ord.createdAt)} at ${formatOrderTime(ord.createdAt)}</span></div>
        <div class="row"><span><b>Customer:</b></span><span>${ord.customerName || 'Guest'}</span></div>
        <div class="row"><span><b>Phone:</b></span><span>${ord.customerPhone || '-'}</span></div>
        <div class="row"><span><b>Delivery Date:</b></span><span>${formatDeliveryDate(ord.deliveryDate)}</span></div>
        ${ord.deliverySlotDetails ? `<div class="row"><span><b>Delivery Window:</b></span><span>${formatSlotDetails(ord.deliverySlotDetails)}</span></div>` : ''}
        <div class="row"><span><b>Fulfillment:</b></span><span>${ord.deliveryAddress ? 'Doorstep Delivery' : 'Bakery Store Pickup'}</span></div>
        <div class="row"><span><b>Order Total:</b></span><span>₹${ord.totalAmount}</span></div>
        <div class="row"><span><b>Payment Mode:</b></span><span>${payModeStr}</span></div>
        <div class="row"><span><b>Payment Status:</b></span><span style="font-weight:bold; color: ${isPaid ? '#155724' : ord.paymentStatus === 'REFUNDED' ? '#6f42c1' : '#856404'};">${ord.paymentStatus === 'REFUNDED' ? 'REFUNDED' : payStatusStr}</span></div>
        ${!isPaid && isCod && ord.paymentStatus !== 'REFUNDED' ? `<div class="alert-box">💵 COD COLLECT DUE: ₹${ord.totalAmount}</div>` : ''}
        ${isPaid ? `<div class="paid-box">✓ PAYMENT SETTLED (PAID)</div>` : ''}
        ${ord.paymentStatus === 'REFUNDED' ? `<div class="alert-box" style="background:#f3e8ff; border-color:#9333ea; color:#6b21a8;">↩️ MANUAL REFUND RECORDED</div>` : ''}
        <hr/>
        <p style="margin:4px 0;"><b>Address / Instructions:</b><br/>${ord.deliveryAddress || 'Self Pickup at Store Counter'}</p>
        <hr/>
        <p style="margin:4px 0;"><b>Items Ordered:</b></p>
        ${(ord.items || []).map((it) => `
          <div style="margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px dotted #ccc;">
            <div style="display:flex; justify-content:space-between;">
              <b>${it.quantity}x ${it.productName || it.productNameSnapshot || 'Artisan Cake'}</b>
              <span>₹${it.unitPrice}</span>
            </div>
            ${it.variantName ? `<div style="font-size:11px; color:#555;">Variant: ${it.variantName}</div>` : ''}
            ${it.dietaryPreference ? `<div style="font-size:11px; color:#155724;">Dietary: ${it.dietaryPreference}</div>` : ''}
            ${it.cakeMessage || it.customMessage ? `<div style="font-size:11px; background:#f9f0f0; padding:3px 6px; border-radius:3px; margin-top:2px;"><b>Message:</b> "${it.cakeMessage || it.customMessage}"</div>` : ''}
            ${it.addonsSummary ? `<div style="font-size:11px; color:#333; margin-top:2px; white-space:pre-line;"><b>Specs / KOT:</b> ${it.addonsSummary}</div>` : ''}
          </div>
        `).join('')}
        <hr/>
        <div style="text-align:center; margin-top:10px;">
          <button onclick="window.print()" style="padding: 8px 18px; font-weight: bold; background:#4a154b; color:#fff; border:none; border-radius:6px; cursor: pointer;">Print Ticket</button>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // Use dashboardStats for global KPIs instead of current page
  const totalOrdersCount = dashboardStats?.totalOrders ?? 0;
  const totalOrderPayment = dashboardStats?.totalRevenue ?? 0; // Using realized revenue for simplicity
  const totalCollectedPayment = dashboardStats?.totalRevenue ?? 0;
  const codPendingCount = dashboardStats?.pendingCodOrders ?? 0;
  const codPendingAmount = dashboardStats?.pendingCodAmount ?? 0;
  const newOrConfirmedCount = dashboardStats?.pendingOrders ?? 0;
  
  // As a fallback for currently baking, use a rough estimate if not provided by stats
  const currentlyBakingCount = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.orderStatus || o.status || '').toUpperCase();
      return s === 'PREPARING';
    }).length; // Only counts current page
  }, [orders]);

  // Orders are pre-filtered by the backend
  const filtered = orders;

  // Reset to page 0 whenever filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filterStatus, filterPayment, search]);

  const isBespokeOrder = (ord: Order) => {
    return (
      ord.items?.some(
        (it) =>
          it.photoReferenceUrl ||
          (it.addonsSummary && it.addonsSummary.includes('Custom Cake Request')) ||
          (it.productNameSnapshot && it.productNameSnapshot.toLowerCase().includes('custom'))
      ) || false
    );
  };

  if (isLoading) return <LoadingState message="Loading bakery order sheets..." />;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-owner-border shadow-soft">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-blush text-brand-plum text-[11px] font-semibold">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Kitchen & Fulfillment Operations</span>
          </div>
          <h1 className="font-serif font-bold text-2xl text-owner-heading tracking-tight">
            Orders & Kitchen Fulfillment
          </h1>
          <p className="text-xs text-owner-muted">
            Track live kitchen tickets, manage status progression, collect COD payments, and print thermal KOT vouchers.
          </p>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Orders */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-owner-muted truncate">Total Orders</p>
            <p className="text-xl font-bold font-serif text-owner-heading">{totalOrdersCount}</p>
          </div>
        </Card>

        {/* Card 2: Total Order Payment / Sales */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-owner-muted truncate">Total Sales</p>
            <p className="text-xl font-bold font-serif text-owner-heading">
              ₹{totalOrderPayment.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-emerald-700 font-medium truncate">
              ₹{totalCollectedPayment.toLocaleString('en-IN')} Collected
            </p>
          </div>
        </Card>

        {/* Card 3: Needs Baking */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-owner-muted truncate">Needs Baking</p>
            <p className="text-xl font-bold font-serif text-owner-heading">{newOrConfirmedCount}</p>
            <p className="text-[10px] text-owner-muted truncate">New & Confirmed</p>
          </div>
        </Card>

        {/* Card 4: Currently Baking (Replaces In Production) */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Cake className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-owner-muted truncate">Currently Baking</p>
            <p className="text-xl font-bold font-serif text-owner-heading">{currentlyBakingCount}</p>
            <p className="text-[10px] text-purple-600 font-medium truncate">In Kitchen Prep</p>
          </div>
        </Card>

        {/* Card 5: COD Due Amount */}
        <Card className="p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-owner-muted truncate">COD Due Amount</p>
            <p className="text-xl font-bold font-serif text-owner-heading">
              ₹{codPendingAmount.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-owner-muted truncate">{codPendingCount} pending collection</p>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-owner-muted" />
            <input
              type="text"
              placeholder="Search by order #, customer, phone, cake flavor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-owner-border bg-white text-owner-heading placeholder:text-owner-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2 rounded-xl border border-owner-border text-xs font-semibold text-owner-heading bg-white focus:outline-none focus:ring-2 focus:ring-brand-plum/20 cursor-pointer"
            >
              <option value="ALL">All Payment Types</option>
              <option value="COD_PENDING">COD (Unpaid Due)</option>
              <option value="PAID">Settled / Paid</option>
              <option value="REFUND_DUE">⚠️ Refund Due (Cancelled & Paid)</option>
              <option value="REFUNDED">Refunded</option>
              <option value="COD">All Cash on Delivery</option>
              <option value="ONLINE">Prepaid Online</option>
            </select>
          </div>
        </div>

        {/* Status Stage Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {ALL_STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                filterStatus === tab.key
                  ? 'bg-brand-plum text-white border-brand-plum shadow-soft'
                  : 'bg-white text-owner-muted border-owner-border hover:border-brand-plum/40 hover:text-owner-heading'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-6 h-6" />}
          title={search || filterStatus !== 'ALL' || filterPayment !== 'ALL' ? 'No Matching Orders' : 'No Orders Received'}
          description="Customer orders placed on your storefront or converted from custom cake requests will appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-owner-border bg-owner-canvas/40 text-owner-muted font-bold tracking-wider">
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Order Placed</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">Delivery Window</th>
                  <th className="py-3.5 px-4">Financials & Payment</th>
                  <th className="py-3.5 px-4">Kitchen Stage</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-owner-border">
                {filtered
                  
                  .map((ord) => {
                  const currentStatus = (ord.orderStatus || ord.status || 'NEW').toUpperCase();
                  const customerDigits = (ord.customerPhone || '').replace(/\D/g, '');
                  const isCod =
                    (ord.paymentMethod || '').toUpperCase() === 'COD' ||
                    (ord.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY';
                  const isPaid = (ord.paymentStatus || '').toUpperCase() === 'PAID';
                  const isBespoke = isBespokeOrder(ord);

                  const nextOptions = ALLOWED_TRANSITIONS[currentStatus] || [];
                  const isTerminal = nextOptions.length === 0;

                  return (
                    <tr key={ord.id} className="hover:bg-owner-canvas/30 transition-colors">
                      {/* Order Number & Bespoke Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="font-bold text-brand-plum hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            #{ord.orderNumber}
                          </button>
                          {isBespoke && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-blush text-brand-plum border border-brand-blush-border">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Custom Cake</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-owner-heading">
                          {formatOrderDate(ord.createdAt) || '-'}
                        </p>
                        <p className="text-[10px] text-owner-muted flex items-center gap-1 mt-0.5 font-medium">
                          <Clock className="w-3 h-3 text-owner-muted" />
                          <span>{formatOrderTime(ord.createdAt)}</span>
                        </p>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-owner-heading">{ord.customerName || 'Guest'}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-owner-muted text-[11px]">
                          <span>{ord.customerPhone || '-'}</span>
                          {customerDigits && (
                            <a
                              href={`https://wa.me/91${customerDigits.slice(-10)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Delivery Schedule & Slot Window */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-owner-heading">{formatDeliveryDate(ord.deliveryDate)}</p>
                        <p className="text-[10px] text-owner-muted mt-0.5">
                          {ord.deliverySlotDetails ? (
                            <span className="font-medium text-brand-plum">
                              {formatSlotDetails(ord.deliverySlotDetails)}
                            </span>
                          ) : ord.deliveryAddress ? (
                            'Doorstep Delivery'
                          ) : (
                            'Bakery Store Pickup'
                          )}
                        </p>
                      </td>

                      {/* Amount & Payment Status */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-owner-heading text-sm">
                          ₹{Number(ord.totalAmount).toLocaleString('en-IN')}
                        </p>

                        {/* Refund Due Alert for Cancelled + Paid Orders */}
                        {currentStatus === 'CANCELLED' && isPaid ? (
                          <div className="mt-1 space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Refund Due</span>
                            </span>
                            <button
                              disabled={updatingPaymentId === ord.id}
                              onClick={() => handlePaymentStatusChange(ord.id, 'REFUNDED')}
                              className="block text-[10px] font-bold text-brand-plum hover:underline cursor-pointer disabled:opacity-50"
                              title="Click to record refund to customer"
                            >
                              Mark Refunded ➔
                            </button>
                          </div>
                        ) : (ord.paymentStatus || '').toUpperCase() === 'REFUNDED' ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              <RotateCcw className="w-3 h-3 text-purple-600" />
                              <span>Manual Refund Recorded</span>
                            </span>
                          </div>
                        ) : isCod ? (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 shrink-0">
                              COD
                            </span>
                            <div className="relative">
                              <select
                                disabled={updatingPaymentId === ord.id}
                                value={isPaid ? 'PAID' : 'PENDING'}
                                onChange={(e) =>
                                  handlePaymentStatusChange(ord.id, e.target.value as 'PAID' | 'PENDING' | 'REFUNDED')
                                }
                                className={`appearance-none pl-2 pr-5 py-0.5 text-[11px] font-bold rounded-lg border cursor-pointer focus:outline-none transition-colors disabled:opacity-50 ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                }`}
                              >
                                <option value="PENDING">Pending</option>
                                <option value="PAID">Paid</option>
                                <option value="REFUNDED">Refunded</option>
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-owner-muted pointer-events-none" />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Paid (Online)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Pending Payment</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={currentStatus as OrderStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Controlled Status Progression */}
                          <div className="relative">
                            <select
                              disabled={updatingId === ord.id || isTerminal}
                              value={currentStatus}
                              onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                              className="appearance-none pl-2 pr-6 py-1 text-[11px] font-semibold rounded-lg border border-owner-border bg-white text-owner-heading cursor-pointer hover:border-brand-plum/40 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value={currentStatus}>{STATUS_LABELS[currentStatus] || currentStatus}</option>
                              {nextOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  ➔ {STATUS_LABELS[opt] || opt}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-owner-muted pointer-events-none" />
                          </div>

                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="p-1.5 text-owner-muted hover:text-brand-plum hover:bg-brand-blush/60 rounded-lg transition-colors cursor-pointer"
                            title="View Full Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadInvoice(ord)}
                            disabled={downloadingId === ord.id}
                            className="p-1.5 text-owner-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Download Tax Invoice PDF"
                          >
                            <Download className={`w-4 h-4 ${downloadingId === ord.id ? 'animate-bounce' : ''}`} />
                          </button>
                          <button
                            onClick={() => handlePrintKOT(ord)}
                            className="p-1.5 text-owner-muted hover:text-owner-heading hover:bg-owner-canvas rounded-lg transition-colors cursor-pointer"
                            title="Print Kitchen Ticket (KOT)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-owner-border bg-white">
              <span className="text-xs text-owner-muted">
                Showing {filtered.length} of total matched orders
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="text-xs"
                >
                  Previous
                </Button>
                <span className="px-3 py-1.5 text-xs font-semibold text-owner-heading flex items-center">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleStatusChange}
        onUpdatePaymentStatus={handlePaymentStatusChange}
        onPrintKOT={handlePrintKOT}
        onDownloadInvoice={handleDownloadInvoice}
        updatingId={updatingId}
        updatingPaymentId={updatingPaymentId}
        downloadingId={downloadingId}
        ALL_STATUS_TABS={ALL_STATUS_TABS}
        ALLOWED_TRANSITIONS={ALLOWED_TRANSITIONS}
        STATUS_LABELS={STATUS_LABELS}
      />

      {/* Shared Confirmation Dialog for Orders */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.type === 'CANCEL' ? executeStatusChange : executeRefund}
        title={confirmAction?.type === 'CANCEL' ? 'Cancel Order' : 'Record Manual Refund'}
        description={
          confirmAction?.type === 'CANCEL'
            ? `Are you sure you want to cancel order #${confirmAction?.orderNumber}? This action cannot be undone.`
            : `Are you sure you want to record a manual refund for order #${confirmAction?.orderNumber}? This logs an offline/cash refund for internal bookkeeping and does not initiate an electronic gateway transfer.`
        }
        confirmLabel={confirmAction?.type === 'CANCEL' ? 'Confirm Cancellation' : 'Record Manual Refund'}
        isDestructive={true}
      />
    </div>
  );
}

export default function OwnerOrdersPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading bakery order sheets..." />}>
      <OwnerOrdersContent />
    </Suspense>
  );
}


