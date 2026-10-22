/* eslint-disable @next/next/no-img-element */
import React from 'react';
import {
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Banknote,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Cake,
  Tag,
  Printer,
  Download,
  ChevronDown
} from 'lucide-react';
import { Order, OrderStatus } from '@/types/order';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: number, status: string) => Promise<void>;
  onUpdatePaymentStatus: (orderId: number, status: 'PAID' | 'PENDING' | 'REFUNDED') => Promise<void>;
  onPrintKOT: (order: Order) => void;
  onDownloadInvoice: (order: Order) => Promise<void>;
  updatingId: number | null;
  updatingPaymentId: number | null;
  downloadingId: number | null;
  ALL_STATUS_TABS: { key: string; label: string }[];
  ALLOWED_TRANSITIONS: Record<string, string[]>;
  STATUS_LABELS: Record<string, string>;
}

function formatSlotDetails(slotStr?: string | null): string {
  if (!slotStr) return '';
  let result = slotStr.replace(/\b(AM|PM)\s+(AM|PM)\b/gi, (_, p1, p2) => p2);
  if (/\b(?:AM|PM)\b/i.test(result)) {
    result = result.replace(/\b0([1-9]:\d{2}\s*(?:AM|PM))/gi, '$1');
  } else {
    result = result.replace(/(\d{1,2}):(\d{2})(?::\d{2})?/g, (_, h, m) => {
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${m} ${ampm}`;
    });
  }
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

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onUpdatePaymentStatus,
  onPrintKOT,
  onDownloadInvoice,
  updatingId,
  updatingPaymentId,
  downloadingId,
  ALL_STATUS_TABS,
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
}: OrderDetailsModalProps) {
  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      title={`Order #${order.orderNumber}`}
      description={`Placed on ${formatOrderDate(order.createdAt)} at ${formatOrderTime(order.createdAt)}`}
    >
      <div className="space-y-6 text-xs">
        {/* 2-Column Landscape Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Customer & Order Fulfillment & Payment (col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Meta summary card */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-owner-canvas/70 border border-owner-border">
              <div>
                <span className="text-[10px] text-owner-muted font-bold uppercase tracking-wider block">
                  Order Placed
                </span>
                <p className="text-xs font-semibold text-owner-heading mt-0.5">
                  {formatOrderDate(order.createdAt) || '-'}
                </p>
                <p className="text-[10px] text-owner-muted">
                  {formatOrderTime(order.createdAt)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-owner-muted font-bold uppercase tracking-wider block">
                  {order.fulfillmentMethod === 'SELF_PICKUP' ? 'Pickup Window' : 'Delivery Window'}
                </span>
                <p className="text-xs font-bold text-brand-plum mt-0.5">
                  {formatDeliveryDate(order.deliveryDate)}
                </p>
                <p className="text-[10px] text-owner-muted">
                  {formatSlotDetails(order.deliverySlotDetails) || (order.fulfillmentMethod === 'SELF_PICKUP' ? 'Bakery Counter Pickup' : 'Doorstep Delivery')}
                </p>
              </div>
            </div>

            {/* Customer Details Card */}
            <div className="p-4 rounded-2xl bg-white border border-owner-border space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-owner-border/60">
                <h4 className="font-serif font-bold text-xs text-owner-heading uppercase tracking-wider">
                  Customer Information
                </h4>
                {order.customerPhone && (
                  <a
                    href={`https://wa.me/91${order.customerPhone.replace(/\D/g, '').slice(-10)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
              <div className="space-y-2 text-owner-muted">
                <p className="font-bold text-sm text-owner-heading">
                  {order.customerName || 'Guest Customer'}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-brand-plum shrink-0" />
                  <span className="font-medium text-owner-heading">
                    {order.customerPhone || 'No phone provided'}
                  </span>
                </p>
                {order.customerEmail && (
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-brand-plum shrink-0" />
                    <span>{order.customerEmail}</span>
                  </p>
                )}
                <p className="flex items-start gap-2 pt-1 border-t border-owner-border/40">
                  <MapPin className="w-3.5 h-3.5 text-brand-plum shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {order.deliveryAddress || 'Self Pickup directly at Bakery Store Counter'}
                  </span>
                </p>
                <div className="pt-2 border-t border-owner-border/40">
                  <span className="text-[10px] text-owner-muted font-bold uppercase tracking-wider block mb-1">
                    Special Delivery Instructions
                  </span>
                  <span className="text-xs text-owner-heading italic whitespace-pre-wrap">
                    {order.specialInstructions || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Breakdown & Settlement Card */}
            <div
              className={`p-4 rounded-2xl border ${
                ((order.paymentMethod || '').toUpperCase() === 'COD' ||
                  (order.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY') &&
                (order.paymentStatus || '').toUpperCase() !== 'PAID'
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-white border-owner-border shadow-xs'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-owner-border/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-owner-muted">
                    Financial Summary
                  </span>
                  <span className="text-base font-bold text-brand-plum">
                    ₹{Number(order.totalAmount).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Itemized charges */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-owner-muted">
                    <span>Items Subtotal</span>
                    <span className="font-medium text-owner-heading">
                      ₹
                      {(
                        order.subtotal ??
                        Number(order.totalAmount) -
                          (Number(order.deliveryCharge) || 0) +
                          (Number(order.discountAmount) || 0)
                      ).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-owner-muted">
                    <span>Delivery Fee ({order.fulfillmentMethod === 'SELF_PICKUP' ? 'Pickup' : 'Home Delivery'})</span>
                    <span className="font-medium text-owner-heading">
                      {order.fulfillmentMethod === 'SELF_PICKUP'
                        ? 'Self-Pickup (FREE)'
                        : order.deliveryCharge && Number(order.deliveryCharge) > 0
                        ? `+ ₹${Number(order.deliveryCharge).toLocaleString('en-IN')}`
                        : 'Free Delivery'}
                    </span>
                  </div>
                  {order.discountAmount && Number(order.discountAmount) > 0 ? (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>Coupon ({order.couponCode || 'Discount'})</span>
                      </span>
                      <span>- ₹{Number(order.discountAmount).toLocaleString('en-IN')}</span>
                    </div>
                  ) : null}
                </div>

                {/* Payment Mode Selector */}
                <div className="pt-2 border-t border-owner-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {(order.paymentMethod || '').toUpperCase() === 'COD' ||
                    (order.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY' ? (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                        <Banknote className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-xs text-owner-heading">
                        {(order.paymentMethod || '').toUpperCase() === 'COD' ||
                        (order.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY'
                          ? 'Cash on Delivery (COD)'
                          : 'Online Payment (Razorpay)'}
                      </p>
                      <p className="text-[10px] text-owner-muted">
                        {(order.paymentMethod || '').toUpperCase() === 'COD' ||
                        (order.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY'
                          ? (order.paymentStatus || '').toUpperCase() === 'PAID'
                            ? 'Cash payment collected & verified'
                            : 'Pending cash collection on delivery'
                          : `Ref: ${order.transactionId || 'Verified'}`}
                      </p>
                    </div>
                  </div>

                  {/* Dropdown for COD or Paid Badge for Online */}
                  {(order.paymentMethod || '').toUpperCase() === 'COD' ||
                  (order.paymentMethod || '').toUpperCase() === 'CASH_ON_DELIVERY' ? (
                    <div className="relative">
                      <select
                        disabled={updatingPaymentId === order.id}
                        value={(order.paymentStatus || '').toUpperCase()}
                        onChange={(e) =>
                          onUpdatePaymentStatus(order.id, e.target.value as 'PAID' | 'PENDING' | 'REFUNDED')
                        }
                        className={`appearance-none pl-2.5 pr-6 py-1 text-xs font-bold rounded-xl border cursor-pointer focus:outline-none transition-colors ${
                          (order.paymentStatus || '').toUpperCase() === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : (order.paymentStatus || '').toUpperCase() === 'REFUNDED'
                            ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                            : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        }`}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="REFUNDED">Refunded</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-owner-muted pointer-events-none" />
                    </div>
                  ) : (order.paymentStatus || '').toUpperCase() === 'REFUNDED' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-300">
                      <RotateCcw className="w-3.5 h-3.5" /> Manual Refund Recorded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                    </span>
                  )}
                </div>

                {/* Refund Due Action Banner for Cancelled + Paid Orders */}
                {(order.orderStatus || order.status || '').toUpperCase() === 'CANCELLED' &&
                  (order.paymentStatus || '').toUpperCase() === 'PAID' && (
                    <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-800">Refund Required for Cancelled Order</p>
                          <p className="text-[11px] text-rose-700">
                            This order was cancelled after payment of ₹{Number(order.totalAmount).toLocaleString('en-IN')} was collected.
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={updatingPaymentId === order.id}
                        onClick={() => onUpdatePaymentStatus(order.id, 'REFUNDED')}
                        className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Record Manual Refund (₹{Number(order.totalAmount).toLocaleString('en-IN')})</span>
                      </button>
                    </div>
                  )}

                {(order.paymentStatus || '').toUpperCase() === 'REFUNDED' && (
                  <div className="mt-3 p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-purple-900">Manual Refund Recorded</p>
                      <p className="text-[11px] text-purple-700">
                        Manual cash/direct refund of ₹{Number(order.totalAmount).toLocaleString('en-IN')} has been recorded.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Transitions */}
            <div className="p-4 rounded-2xl bg-owner-canvas border border-owner-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-owner-heading">Current Stage:</span>
                <StatusBadge status={(order.orderStatus || order.status) as OrderStatus} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_STATUS_TABS.filter((t) => t.key !== 'ALL').map((tab) => {
                  const currentStatus = (
                    order.orderStatus ||
                    order.status ||
                    ''
                  ).toUpperCase();
                  const isCurrent = currentStatus === tab.key;
                  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
                  const canTransition = isCurrent || allowedNext.includes(tab.key);

                  return (
                    <button
                      key={tab.key}
                      disabled={updatingId === order.id || !canTransition || isCurrent}
                      onClick={() => onUpdateStatus(order.id, tab.key)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-plum text-white shadow-soft ring-2 ring-brand-plum/30'
                          : canTransition
                          ? 'bg-white text-owner-heading border border-owner-border hover:border-brand-plum/50 hover:bg-brand-cream/40'
                          : 'bg-owner-canvas/40 text-owner-muted/40 border border-owner-border/40 cursor-not-allowed'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Ordered Cakes & Reference Images (col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-owner-border">
              <h4 className="font-serif font-bold text-sm text-owner-heading">
                Celebration Cakes & Items Ordered
              </h4>
              <span className="text-[11px] text-owner-muted font-semibold">
                {order.items?.length || 0}{' '}
                {order.items?.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="space-y-3">
              {order.items && order.items.length > 0 ? (
                order.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white border border-owner-border space-y-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Cake Photo */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-brand-cream border border-brand-border shrink-0">
                        {it.productImageUrl ? (
                          <img
                            src={it.productImageUrl}
                            alt={it.productName || 'Ordered Cake'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-brand-muted p-1">
                            <Cake className="w-6 h-6 text-brand-plum/40 mb-0.5" />
                            <span className="text-[9px] text-center font-medium">Cake</span>
                          </div>
                        )}
                      </div>

                      {/* Cake Info & Pricing */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="font-bold text-sm text-owner-heading leading-tight">
                              {it.productName || it.productNameSnapshot || 'Artisan Cake'}
                            </h5>
                            {it.variantName && (
                              <p className="text-[11px] font-semibold text-brand-plum mt-0.5">
                                Variant: {it.variantName}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm text-owner-heading">
                              ₹{it.quantity * it.unitPrice}
                            </p>
                            <p className="text-[10px] text-owner-muted">
                              {it.quantity} × ₹{it.unitPrice}
                            </p>
                          </div>
                        </div>

                        {/* Dietary badge */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {it.dietaryPreference && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {it.dietaryPreference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Custom Specifications / KOT Addons Summary */}
                    {it.addonsSummary && (
                      <div className="p-3 rounded-xl bg-brand-cream/70 border border-brand-border/80 text-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-owner-muted mb-1">
                          Kitchen Specifications & Addons:
                        </p>
                        <p className="text-[11px] text-brand-espresso whitespace-pre-line leading-relaxed">
                          {it.addonsSummary}
                        </p>
                      </div>
                    )}

                    {/* Inscription Message Banner */}
                    {(it.cakeMessage || it.customMessage) && (
                      <div className="p-2.5 rounded-xl bg-brand-blush/30 border border-brand-blush-border text-brand-plum flex items-start gap-2">
                        <span className="text-xs font-bold shrink-0">🎂 Inscription:</span>
                        <span className="text-xs font-serif font-semibold italic text-brand-espresso">
                          &ldquo;{it.cakeMessage || it.customMessage}&rdquo;
                        </span>
                      </div>
                    )}

                    {/* Customer Desired Design Reference Photo */}
                    {it.photoReferenceUrl ? (
                      <div className="p-3 rounded-xl bg-owner-canvas border border-owner-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-owner-heading flex items-center gap-1">
                            <span>📸 Customer Design Reference Photo</span>
                          </span>
                          <a
                            href={it.photoReferenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-brand-plum hover:underline"
                          >
                            View Full Size ↗
                          </a>
                        </div>
                        <p className="text-[10px] text-owner-muted">
                          Customer attached this image showing how they want the cake decorated:
                        </p>
                        <div className="relative aspect-video max-h-48 sm:max-h-56 w-full rounded-xl overflow-hidden border border-brand-border bg-black/5">
                          <a
                            href={it.photoReferenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Click to view full resolution"
                          >
                            <img
                              src={it.photoReferenceUrl}
                              alt="Customer Desired Cake Reference"
                              className="w-full h-full object-contain hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                            />
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-owner-muted border rounded-2xl bg-white">
                  Celebration cake order (Total: ₹{order.totalAmount})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-4 border-t border-owner-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPrintKOT(order)}
            className="gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Kitchen Ticket (KOT)</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => onDownloadInvoice(order)}
              disabled={downloadingId === order.id}
              className="gap-1.5 bg-brand-plum hover:bg-brand-plum/90 text-white"
            >
              <Download className={`w-4 h-4 ${downloadingId === order.id ? 'animate-bounce' : ''}`} />
              <span>Download PDF Invoice</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
