'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Clock, Truck, Package, ArrowLeft, Store, Download, MessageCircle, AlertCircle, ShoppingBag, ShieldCheck, Star, Pencil, Trash2 } from 'lucide-react';
import { ordersApi } from '@/lib/api/orders';
import { storefrontApi } from '@/lib/api/storefront';
import { reviewsApi, OrderItemEligibility } from '@/lib/api/reviews';
import { ProductReviewSubmissionModal } from '@/components/customer/storefront/ProductReviewSubmissionModal';
import { Order, OrderItem } from '@/types/order';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { useToast } from '@/components/common/Toast';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderNumber = params?.orderNumber as string;
  const toast = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [shop, setShop] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review states
  const [eligibilityMap, setEligibilityMap] = useState<Record<number, OrderItemEligibility>>({});
  const [selectedItemForReview, setSelectedItemForReview] = useState<OrderItem | null>(null);
  const [editingReview, setEditingReview] = useState<{
    id: number;
    rating: number;
    reviewText?: string;
    cakeImageUrl?: string;
    cakeVideoUrl?: string;
  } | null>(null);

  const fetchEligibility = async (currentOrder: Order) => {
    if (!currentOrder?.shopId || !currentOrder?.orderNumber) return;
    try {
      const eligibilityList = await reviewsApi.checkOrderEligibility(
        currentOrder.shopId,
        currentOrder.orderNumber,
        currentOrder.customerPhone || ''
      );
      const map: Record<number, OrderItemEligibility> = {};
      eligibilityList.forEach((e) => {
        map[e.orderItemId] = e;
      });
      setEligibilityMap(map);
    } catch {
      // Non-blocking if review check fails
    }
  };

  const handleOpenReview = (item: OrderItem) => {
    setEditingReview(null);
    setSelectedItemForReview(item);
  };

  const handleOpenEditReview = (item: OrderItem, eligibility?: OrderItemEligibility) => {
    if (!eligibility?.existingReviewId) return;
    setEditingReview({
      id: eligibility.existingReviewId,
      rating: eligibility.existingRating ?? 5,
      reviewText: eligibility.existingReviewText,
      cakeImageUrl: eligibility.existingCakeImageUrl,
      cakeVideoUrl: eligibility.existingCakeVideoUrl,
    });
    setSelectedItemForReview(item);
  };

  const handleDirectDeleteReview = async (item: OrderItem, eligibility?: OrderItemEligibility) => {
    if (!order?.shopId || !eligibility?.existingReviewId) return;
    if (!window.confirm('Are you sure you want to delete your review? This will remove your rating and feedback from the bakery.')) {
      return;
    }
    try {
      await reviewsApi.deleteProductReview(
        order.shopId,
        item.productId || 0,
        eligibility.existingReviewId,
        order.orderNumber,
        order.customerPhone || ''
      );
      toast.success('Your review has been deleted.');
      fetchEligibility(order);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review.');
    }
  };

  const fetchOrder = React.useCallback(async () => {
    if (!orderNumber) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await ordersApi.getOrderByNumber(orderNumber);
      setOrder(data);
      if (data) {
        fetchEligibility(data);
      }
      if (data?.shopId) {
        try {
          const shopData = await storefrontApi.getShopById(data.shopId);
          if (shopData && !shopData.businessPhone && shopData.phone) {
            shopData.businessPhone = shopData.phone;
          }
          setShop(shopData);
        } catch {
          // ignore error fetching shop
        }
      }
    } catch (err: any) {
      setError(err.message || 'Order not found');
    } finally {
      setIsLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloading(true);
    try {
      await ordersApi.downloadStorefrontInvoice(order.orderNumber);
      toast.success('Tax invoice downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download invoice. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-cream-light">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Fetching live order tracking..." />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-cream-light">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorState message={error || 'Order not found'} onRetry={fetchOrder} />
        </div>
        <Footer />
      </div>
    );
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      case 'OUT_FOR_DELIVERY':
      case 'PREPARING':
        return 'warning';
      default:
        return 'plum';
    }
  };

  const isConfirmed = ['CONFIRMED', 'PREPARING', 'READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status);
  const isBaking = ['PREPARING', 'READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status);
  const isDelivered = order.status === 'DELIVERED';

  const cleanPhone = (shop?.whatsappNumber || shop?.businessPhone || shop?.phone || '9876543210').replace(/\D/g, '');

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream-light font-sans">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/explore"
            className="inline-flex items-center text-xs sm:text-sm font-semibold text-brand-muted hover:text-brand-plum transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Explore Other Bakeries
          </Link>

          {order.shopId && (
            <Link
              href={`/shop/${order.shopId}`}
              className="text-xs font-semibold text-brand-plum hover:underline inline-flex items-center"
            >
              <Store className="w-3.5 h-3.5 mr-1" /> Visit Bakery Storefront
            </Link>
          )}
        </div>

        <Card className="p-6 sm:p-8 rounded-3xl border border-brand-border/80 shadow-soft">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-brand-border/60 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-plum uppercase tracking-wider">
                  Live Order Tracker
                </span>
                <span className="text-xs text-brand-muted">•</span>
                <span className="text-xs text-brand-muted">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso mt-1">
                #{order.orderNumber}
              </h1>
            </div>

            <div className="flex items-center gap-2.5">
              <Badge variant={statusVariant(order.status)} size="md" className="capitalize text-xs font-bold px-3 py-1">
                {order.status.replace(/_/g, ' ').toLowerCase()}
              </Badge>
            </div>
          </div>

          {/* 4-Stage Animated Visual Timeline */}
          <div className="py-8 border-b border-brand-border/60">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {/* Step 1: Received */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1.5 transition-all ${
                  order.status === 'PENDING'
                    ? 'bg-brand-plum text-white shadow-xs animate-pulse ring-4 ring-brand-plum/20'
                    : 'bg-brand-blush text-brand-plum font-bold'
                }`}>
                  <Clock className="w-5 h-5" />
                </div>
                <span className={`font-semibold ${order.status === 'PENDING' ? 'text-brand-plum' : 'text-brand-espresso'}`}>
                  Received
                </span>
                <span className="text-[10px] text-brand-muted hidden sm:inline">Order placed</span>
              </div>

              {/* Step 2: Confirmed */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1.5 transition-all ${
                  order.status === 'CONFIRMED'
                    ? 'bg-brand-plum text-white shadow-xs animate-pulse ring-4 ring-brand-plum/20'
                    : isConfirmed
                    ? 'bg-brand-blush text-brand-plum'
                    : 'bg-brand-cream-light text-brand-muted'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className={`font-semibold ${isConfirmed ? 'text-brand-espresso' : 'text-brand-muted'}`}>
                  Confirmed
                </span>
                <span className="text-[10px] text-brand-muted hidden sm:inline">Accepted by baker</span>
              </div>

              {/* Step 3: Baking */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1.5 transition-all ${
                  ['PREPARING', 'READY'].includes(order.status)
                    ? 'bg-brand-plum text-white shadow-xs animate-pulse ring-4 ring-brand-plum/20'
                    : isBaking
                    ? 'bg-brand-blush text-brand-plum'
                    : 'bg-brand-cream-light text-brand-muted'
                }`}>
                  <Package className="w-5 h-5" />
                </div>
                <span className={`font-semibold ${isBaking ? 'text-brand-espresso' : 'text-brand-muted'}`}>
                  Baking
                </span>
                <span className="text-[10px] text-brand-muted hidden sm:inline">In the kitchen</span>
              </div>

              {/* Step 4: Delivered */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1.5 transition-all ${
                  order.status === 'OUT_FOR_DELIVERY'
                    ? 'bg-brand-plum text-white shadow-xs animate-pulse ring-4 ring-brand-plum/20'
                    : isDelivered
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-brand-cream-light text-brand-muted'
                }`}>
                  <Truck className="w-5 h-5" />
                </div>
                <span className={`font-semibold ${isDelivered ? 'text-emerald-700' : 'text-brand-muted'}`}>
                  {order.status === 'OUT_FOR_DELIVERY' ? 'On The Way' : 'Delivered'}
                </span>
                <span className="text-[10px] text-brand-muted hidden sm:inline">Celebration ready</span>
              </div>
            </div>
          </div>

          {/* Itemized Order Summary (if items present) */}
          {order.items && order.items.length > 0 && (
            <div className="py-6 border-b border-brand-border/60">
              <h3 className="text-xs font-bold text-brand-espresso uppercase tracking-wider mb-3">
                Cakes in this Order
              </h3>
              <div className="divide-y divide-brand-border/40 space-y-3">
                {order.items.map((item, idx) => {
                  const eligibility = item.id ? eligibilityMap[item.id] : undefined;
                  return (
                    <div key={idx} className="pt-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-brand-espresso">
                          {item.productName || item.productNameSnapshot || 'Artisan Cake'} × {item.quantity}
                        </p>
                        {item.variantName && (
                          <span className="text-[11px] text-brand-muted">{item.variantName}</span>
                        )}
                        {item.cakeMessage && (
                          <p className="text-[11px] text-brand-plum italic mt-0.5">
                            &ldquo;{item.cakeMessage}&rdquo;
                          </p>
                        )}

                        {/* Review Action if Delivered */}
                        {isDelivered && (
                          <div className="mt-2">
                            {eligibility?.hasReviewed ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Reviewed ({eligibility.existingRating}★)</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditReview(item, eligibility)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-plum hover:text-brand-plum-dark px-2 py-0.5 rounded-lg bg-brand-blush/60 hover:bg-brand-blush border border-brand-blush-border transition-colors cursor-pointer"
                                  title="Edit your review, rating or media"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDirectDeleteReview(item, eligibility)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                  title="Delete your review"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            ) : eligibility?.isEligible ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReview(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-blush text-brand-plum text-xs font-bold hover:bg-brand-plum hover:text-white transition-all cursor-pointer border border-brand-blush-border shadow-2xs"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span>Review This Cake</span>
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <span className="font-serif font-bold text-brand-espresso">
                        ₹{item.totalPrice ?? item.unitPrice * item.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delivery & Recipient Details */}
          {/* Delivery & Recipient Details */}
          <div className="my-6 bg-brand-cream-light/60 rounded-2xl p-4 sm:p-5 space-y-2.5 text-xs border border-brand-border/70">
            <div className="flex justify-between">
              <span className="text-brand-muted">Recipient Name:</span>
              <span className="font-semibold text-brand-espresso">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Contact Phone:</span>
              <span className="font-semibold text-brand-espresso">{order.customerPhone}</span>
            </div>
            {order.customerEmail && (
              <div className="flex justify-between">
                <span className="text-brand-muted">Email Address:</span>
                <span className="font-medium text-brand-espresso">{order.customerEmail}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-brand-muted">Fulfillment Method:</span>
              <span className="font-semibold text-brand-espresso">
                {order.fulfillmentMethod === 'SELF_PICKUP'
                  ? '🏪 Bakery Store Pickup'
                  : '🚚 Doorstep Delivery'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">
                {order.fulfillmentMethod === 'SELF_PICKUP' ? 'Pickup Location:' : 'Delivery Address:'}
              </span>
              <span className="font-semibold text-brand-espresso text-right max-w-xs">{order.deliveryAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Schedule Date:</span>
              <span className="font-semibold text-brand-espresso">{order.deliveryDate}</span>
            </div>

            <div className="pt-2 border-t border-brand-border/40 space-y-1.5">
              <div className="flex justify-between text-brand-muted">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-brand-espresso">
                  ₹{order.subtotal ?? (Number(order.totalAmount) - Number(order.deliveryCharge || 0) + Number(order.discountAmount || 0))}
                </span>
              </div>

              <div className="flex justify-between text-brand-muted">
                <span>Delivery Fee:</span>
                <span className="font-semibold text-brand-espresso">
                  {order.fulfillmentMethod === 'SELF_PICKUP'
                    ? 'FREE (₹0 - Pickup)'
                    : Number(order.deliveryCharge) === 0
                    ? 'FREE (₹0)'
                    : `+₹${order.deliveryCharge}`}
                </span>
              </div>

              {order.couponCode && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Coupon Applied ({order.couponCode}):</span>
                  <span>-₹{order.discountAmount || 0}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2.5 border-t border-brand-border/60 font-bold text-sm">
              <span className="text-brand-espresso">
                {order.paymentMethod === 'ONLINE_PAYMENT' || order.paymentStatus === 'PAID'
                  ? 'Total Paid:'
                  : 'Total Due on Delivery (COD):'}
              </span>
              <span className="text-brand-plum font-serif text-lg">₹{order.totalAmount}</span>
            </div>
          </div>

          {/* Actions: Download Invoice & Chat on WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Download Tax Invoice PDF Button */}
            <Button
              variant="outline"
              size="md"
              onClick={handleDownloadInvoice}
              disabled={isDownloading}
              className="w-full justify-center gap-2 rounded-2xl h-12 font-bold"
            >
              <Download className="w-4 h-4 text-brand-plum" />
              <span>{isDownloading ? 'Generating PDF...' : 'Download Tax Invoice (PDF)'}</span>
            </Button>

            {/* Direct WhatsApp Chat with Bakery */}
            <a
              href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
                `Hello ${shop?.businessName || 'Bakery'}! I am inquiring about my CakeStore Order #${order.orderNumber}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold shadow-xs transition-all active:scale-95 h-12"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>Chat with Baker on WhatsApp</span>
            </a>
          </div>
        </Card>
      </main>

      {/* Review Modal Trigger */}
      {selectedItemForReview && order.shopId && (
        <ProductReviewSubmissionModal
          isOpen={Boolean(selectedItemForReview)}
          onClose={() => {
            setSelectedItemForReview(null);
            setEditingReview(null);
          }}
          shopId={order.shopId}
          productId={selectedItemForReview.productId || 0}
          productName={selectedItemForReview.productName || selectedItemForReview.productNameSnapshot || 'Artisan Cake'}
          orderNumber={order.orderNumber}
          customerPhone={order.customerPhone || ''}
          orderItemId={selectedItemForReview.id ?? 0}
          initialReview={editingReview}
          onSuccess={() => {
            fetchEligibility(order);
          }}
          onDelete={() => {
            fetchEligibility(order);
          }}
        />
      )}

      <Footer />
    </div>
  );
}