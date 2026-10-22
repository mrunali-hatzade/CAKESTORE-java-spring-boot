'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, CheckCircle2, Calendar, MapPin, ArrowRight, Store, CreditCard, Banknote, Download, Tag, AlertCircle } from 'lucide-react';
import { Shop } from '@/types/shop';
import { DeliverySlot } from '@/types/deliverySlot';
import { Order } from '@/types/order';
import { useCart } from '@/context/CartContext';
import { ordersApi } from '@/lib/api/orders';
import { deliverySlotsApi } from '@/lib/api/deliverySlots';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { storefrontApi } from '@/lib/api/storefront';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/common/Toast';
import { paymentsService } from '@/lib/services/payments';



export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart, appliedCoupon, currentShopId, isHydrated } = useCart();
  const toast = useToast();

  const [shop, setShop] = useState<Shop | null>(null);

  useEffect(() => {
    if (!isHydrated) return;

    if (currentShopId) {
      router.replace(`/shop/${currentShopId}?tab=checkout`);
    } else {
      router.replace('/explore');
    }
  }, [isHydrated, currentShopId, router]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<number | undefined>(undefined);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const hasInitializedFromCart = React.useRef(false);
  useEffect(() => {
    if (items.length > 0 && !hasInitializedFromCart.current) {
      if (items[0].deliveryDate) setDeliveryDate(items[0].deliveryDate);
      if (items[0].deliverySlotId) setSelectedSlotId(items[0].deliverySlotId);
      hasInitializedFromCart.current = true;
    }
  }, [items]);

  useEffect(() => {
    if (shop?.id) {
      deliverySlotsApi
        .getStorefrontSlots(shop.id, deliveryDate || undefined)
        .then(setSlots)
        .catch(() => setSlots([]));
    }
  }, [shop?.id, deliveryDate]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream-light font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-brand-plum border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs sm:text-sm text-brand-muted font-medium">Checking your basket...</p>
        </div>
      </div>
    );
  }

  if (!shop && items.length > 0) return <div className="min-h-screen flex items-center justify-center">Loading checkout...</div>;
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-cream-light font-sans">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 flex flex-col items-center justify-center text-center">
          <ShoppingBag className="w-16 h-16 text-brand-muted mb-4" />
          <h2 className="text-2xl font-bold text-brand-espresso mb-2">Your basket is empty</h2>
          <p className="text-brand-muted mb-6">Looks like you haven&apos;t added anything to your cart yet.</p>
          <Button onClick={() => router.push('/')}>Discover Bakeries</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const deliveryCharge = items.length > 0 ? 50 : 0;
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount + deliveryCharge);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Your store basket is empty.');
      return;
    }

    if (!customerName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const cleanPhone = customerPhone.trim().replace(/^0+/, '');
    if (!cleanPhone || !/^\+?[1-9]\d{9,14}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      return;
    }

    if (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('Please enter your delivery street address.');
      return;
    }

    if (!deliveryDate) {
      setError('Please select a delivery date.');
      return;
    }

    if (!selectedSlotId) {
      setError('Please select a delivery slot window.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const backendPaymentMethod = paymentMethod === 'ONLINE' ? 'ONLINE_PAYMENT' : 'COD';

    try {
      const order = await ordersApi.createGuestOrder(shop!.id, {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: cleanPhone,
        paymentMethod: backendPaymentMethod,
        deliveryAddress: deliveryAddress.trim(),
        deliveryDate,
        deliverySlotId: Number(selectedSlotId),
        specialInstructions: specialInstructions.trim() || undefined,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          customMessage: i.customMessage?.trim() || undefined,
        })),
      });

      if (paymentMethod === 'ONLINE') {
        await paymentsService.initiatePayment({
          orderId: String(order.id),
          amount: order.totalAmount ?? finalTotal,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: cleanPhone,
          shopName: shop?.businessName,
          onSuccess: (paymentId) => {
            setConfirmedOrder(order);
            clearCart();
            toast.success(`Payment verified (${paymentId})! Order #${order.orderNumber} confirmed.`);
          },
          onFailure: async (errMsg) => {
            try {
              await ordersApi.cancelPaymentOrder(order.orderNumber, errMsg || 'Payment was cancelled');
            } catch (_) {}
            setError(errMsg || 'Online payment was cancelled or failed. Your order was not placed.');
            setIsSubmitting(false);
          },
        });
      } else {
        setConfirmedOrder(order);
        clearCart();
        toast.success(`Order #${order.orderNumber} successfully placed!`);
      }
    } catch (err: any) {
      const isSlotFull = err?.error === 'SLOT_FULL' || err?.message?.includes('SLOT_FULL') || err?.message?.toLowerCase().includes('fully booked');
      if (isSlotFull) {
        setError('This delivery slot was just filled by another order. Please select an available slot below.');
        if (shop?.id) {
          deliverySlotsApi.getStorefrontSlots(shop.id, deliveryDate || undefined)
            .then(setSlots)
            .catch(() => {});
        }
        setSelectedSlotId(undefined);
      } else {
        setError(err.message || 'Failed to submit order. Please check all fields.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadInvoice = async (orderNumber: string) => {
    setIsDownloadingInvoice(true);
    try {
      await ordersApi.downloadStorefrontInvoice(orderNumber);
      toast.success('Tax invoice downloaded successfully!');
    } catch {
      toast.error('Failed to download invoice. Please try again or contact the bakery.');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleModalClose = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream-light font-sans">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-3xl shadow-sm border border-brand-border/60 overflow-hidden">
          <div className="px-6 py-5 border-b border-brand-border/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blush flex items-center justify-center text-brand-plum">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif text-brand-espresso">{confirmedOrder ? 'Order Confirmed!' : `Complete Order with ${shop?.businessName || 'Storefront'}`}</h1>
              <p className="text-xs text-brand-muted">{confirmedOrder ? 'Your artisan order has been received by the bakery.' : 'Please review your items and provide delivery details.'}</p>
            </div>
          </div>
          <div className="p-6 sm:p-8">
      {confirmedOrder ? (
        /* Order Success Screen */
        <div className="space-y-6 py-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-semibold text-brand-plum uppercase tracking-wider">
              Order Confirmed
            </span>
            <h2 className="text-2xl font-serif font-bold text-brand-espresso mt-1">
              #{confirmedOrder.orderNumber}
            </h2>
            <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
              Thank you, {confirmedOrder.customerName}. {shop?.businessName} has received your order and will begin preparation according to your delivery schedule.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-brand-cream-light/60 border border-brand-border/60 text-xs text-left space-y-2 max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-brand-muted">Bakery:</span>
              <span className="font-semibold text-brand-espresso">{shop?.businessName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Delivery Schedule:</span>
              <span className="font-semibold text-brand-espresso">{confirmedOrder.deliveryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Total Amount:</span>
              <span className="font-serif font-bold text-brand-plum text-sm">
                Ã¢â€šÂ¹{confirmedOrder.totalAmount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Payment:</span>
              <span className="font-medium text-emerald-700">
                {paymentMethod === 'ONLINE' ? 'Paid via Razorpay' : 'Pay on Delivery / UPI'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href={`/orders/${confirmedOrder.orderNumber}`} className="w-full sm:w-auto">
              <Button size="md" className="w-full sm:w-auto font-bold">
                Track Live Order Status <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="md"
              onClick={() => handleDownloadInvoice(confirmedOrder.orderNumber)}
              disabled={isDownloadingInvoice}
              className="w-full sm:w-auto gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingInvoice ? 'Downloading...' : 'Download Invoice (PDF)'}</span>
            </Button>
            <Button variant="ghost" size="md" onClick={handleModalClose} className="w-full sm:w-auto">
              Continue Browsing
            </Button>
          </div>
        </div>
      ) : (
        /* Checkout Form */
        <form onSubmit={handlePlaceOrder} className="space-y-4">
          {error && <ErrorState message={error} className="mb-4" />}

          {/* Order Items Recap */}
          <div className="p-3.5 rounded-2xl bg-brand-cream-light/60 border border-brand-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-brand-plum uppercase tracking-wider">
                Basket Items ({items.length})
              </span>
              {appliedCoupon && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Coupon: {appliedCoupon.code} (-Ã¢â€šÂ¹{appliedCoupon.discountAmount})
                </span>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-brand-border/40 text-xs">
              {items.map((i) => (
                <div key={i.productId} className="pt-1.5 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-brand-espresso">
                      {i.name} Ãƒâ€” {i.quantity}
                    </span>
                    {i.customMessage && (
                      <span className="block text-[10px] text-brand-plum italic">
                        &quot;{i.customMessage}&quot;
                      </span>
                    )}
                  </div>
                  <span className="font-serif font-bold text-brand-espresso">
                    Ã¢â€šÂ¹{i.price * i.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Your Full Name"
              required
              placeholder="e.g. Priya Sharma"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              label="Mobile Number (10 digits)"
              required
              placeholder="9876543210"
              value={customerPhone}
              onChange={(e) => {
                const sanitized = e.target.value.replace(/^0+/, '');
                setCustomerPhone(sanitized);
              }}
            />
          </div>

          <Input
            label="Email Address (for tax invoice & kitchen updates)"
            type="email"
            required
            placeholder="priya@example.com"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />

          <Input
            label="Delivery Street Address"
            required
            placeholder="Flat 302, Green Valley Apartments, Near City Center"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
          />

          {/* Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Delivery Date"
              type="date"
              required
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <Select
              label="Delivery Slot Window"
              required
              options={[
                { value: '', label: 'Select Delivery Window' },
                ...slots.map((s) => ({
                  value: s.id,
                  label: `${s.dayOfWeek ? s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase() : 'Everyday'} (${s.startTime.slice(0, 5)} - ${s.endTime.slice(0, 5)})`,
                })),
              ]}
              value={selectedSlotId || ''}
              onChange={(e) => setSelectedSlotId(e.target.value ? Number(e.target.value) : undefined)}
              helperText={slots.length === 0 ? 'No delivery slots found for this shop' : undefined}
            />
          </div>

          <Textarea
            label="Special Delivery Instructions (Optional)"
            placeholder="Please ring bell twice or call before arriving"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
          />

          {/* Payment Method Selector */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-brand-espresso block">
              Choose Payment Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('COD')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  paymentMethod === 'COD'
                    ? 'bg-brand-blush/80 border-brand-plum text-brand-espresso shadow-xs'
                    : 'bg-white border-brand-border hover:bg-brand-cream/40 text-brand-espresso'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  paymentMethod === 'COD' ? 'bg-brand-plum text-white' : 'bg-brand-cream text-brand-plum'
                }`}>
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Pay on Delivery</p>
                  <p className="text-[10px] text-brand-muted mt-0.5">Cash or UPI upon receiving the cake</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('ONLINE')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  paymentMethod === 'ONLINE'
                    ? 'bg-brand-blush/80 border-brand-plum text-brand-espresso shadow-xs'
                    : 'bg-white border-brand-border hover:bg-brand-cream/40 text-brand-espresso'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  paymentMethod === 'ONLINE' ? 'bg-brand-plum text-white' : 'bg-brand-cream text-brand-plum'
                }`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Pay Online</p>
                  <p className="text-[10px] text-brand-muted mt-0.5">UPI, GPay, Cards & Netbanking</p>
                </div>
              </button>
            </div>
          </div>

          {/* Action Footer with Detailed Bill */}
          <div className="pt-4 border-t border-brand-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-brand-muted">
                <span>Subtotal: Ã¢â€šÂ¹{totalPrice}</span>
                {discountAmount > 0 && <span className="text-emerald-700 font-semibold ml-1.5">-Ã¢â€šÂ¹{discountAmount}</span>}
                <span className="ml-1.5">+Ã¢â€šÂ¹{deliveryCharge} Delivery</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-brand-muted">Total:</span>
                <span className="font-serif font-bold text-xl text-brand-plum">
                  Ã¢â€šÂ¹{finalTotal}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" type="button" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button type="submit" size="md" isLoading={isSubmitting} className="font-bold">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {paymentMethod === 'ONLINE' ? 'Pay with Razorpay' : 'Place Bakery Order (COD)'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};






