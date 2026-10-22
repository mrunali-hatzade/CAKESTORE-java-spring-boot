import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Store, Tag, CheckCircle2, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { storefrontApi } from '@/lib/api/storefront';
import { ShopDeliveryConfig } from '@/types/shop';

export const CartDrawer: React.FC = () => {
  const router = useRouter();
  const {
    items,
    totalPrice,
    totalItems,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    currentShopName,
    currentShopId,
    appliedCoupon,
    setAppliedCoupon,
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<
    Array<{
      code: string;
      discountType: string;
      discountValue: number;
      minOrderValue?: number;
      maxDiscountCap?: number;
      expiryDate?: string;
    }>
  >([]);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<ShopDeliveryConfig | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentShopId && isCartOpen) {
      storefrontApi.getShopById(currentShopId)
        .then((s) => {
          if (isMounted) {
            setDeliveryConfig(s?.deliveryConfig || null);
          }
        })
        .catch(() => {
          if (isMounted) setDeliveryConfig(null);
        });

      storefrontApi.getShopCoupons(currentShopId)
        .then((coupons) => {
          if (isMounted) {
            setAvailableCoupons(coupons || []);
          }
        })
        .catch(() => {
          if (isMounted) setAvailableCoupons([]);
        });
    } else if (!currentShopId) {
      setDeliveryConfig(null);
      setAvailableCoupons([]);
    }
    return () => {
      isMounted = false;
    };
  }, [currentShopId, isCartOpen]);

  if (!isCartOpen) return null;

  const handleApplyCoupon = async (specificCode?: string) => {
    const codeToTest = (specificCode || couponCode).trim();
    if (!codeToTest) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (!currentShopId) return;

    setIsValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await storefrontApi.validateCoupon(currentShopId, codeToTest, totalPrice);
      if (res.valid && res.code) {
        setAppliedCoupon({
          code: res.code,
          discountType: res.discountType || 'PERCENTAGE',
          discountValue: res.discountValue || 0,
          discountAmount: res.discountAmount || 0,
        });
        setCouponSuccess(res.message || 'Coupon applied successfully!');
        setCouponCode('');
      } else {
        setCouponError(res.message || 'Invalid coupon code for this bakery.');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Failed to validate coupon.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponSuccess(null);
  };

  const isDeliveryDisabled = deliveryConfig?.deliveryEnabled === false;
  let deliveryCharge = 0;
  if (items.length > 0) {
    if (isDeliveryDisabled) {
      deliveryCharge = 0;
    } else if (deliveryConfig?.deliveryChargeType === 'FREE') {
      deliveryCharge = 0;
    } else {
      // FIXED delivery charge or authoritative backend fallback (50.00, threshold 1000.00)
      const fixedAmount = Number(deliveryConfig?.fixedChargeAmount ?? 50.00);
      const minFree = deliveryConfig?.minOrderForFreeDelivery ?? 1000.00;
      if (minFree && minFree > 0 && totalPrice >= minFree) {
        deliveryCharge = 0;
      } else {
        deliveryCharge = fixedAmount;
      }
    }
  }

  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount + deliveryCharge);

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    if (currentShopId) {
      router.push(`/shop/${currentShopId}?tab=checkout`);
    } else {
      router.push('/explore');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-espresso/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-elevated flex flex-col">
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-brand-border/60 flex items-center justify-between bg-brand-cream-light/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-plum text-white flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-base text-brand-espresso leading-tight">
                  In-Store Basket
                </h2>
                {currentShopName && (
                  <p className="text-[11px] text-brand-muted flex items-center gap-1">
                    <Store className="w-3 h-3 text-brand-plum" />
                    <span>Ordering from: {currentShopName}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 rounded-full text-brand-muted hover:text-brand-espresso hover:bg-brand-cream transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-12 h-12 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-muted mb-3">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-sm text-brand-espresso">Your basket is empty</h3>
                <p className="text-xs text-brand-muted max-w-xs mt-1">
                  Select handcrafted cakes and confections from this bakery to begin your order.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {items.map((item) => (
                  <div
                    key={item.cartLineId}
                    className="p-4 rounded-2xl border border-brand-border/80 bg-white shadow-subtle space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-brand-cream shrink-0 border border-brand-border/60">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              sizes="48px"
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-plum">
                              <ShoppingBag className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-serif font-bold text-sm text-brand-espresso line-clamp-1">
                            {item.name}
                          </h4>
                          <span className="text-[11px] text-brand-muted">
                            {item.isEggless ? '🌱 Eggless' : 'Regular'} • ₹{item.price} each
                          </span>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-sm text-brand-espresso shrink-0">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>

                    {item.customMessage && (
                      <p className="text-[11px] text-brand-plum bg-brand-blush/60 p-2 rounded-xl italic">
                        &quot;{item.customMessage}&quot;
                      </p>
                    )}

                    {(item.deliveryDate || item.deliverySlotName || item.deliveryTime) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#5C1D2E] bg-[#FAF7F2] px-2.5 py-1.5 rounded-xl border border-brand-border/60">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-[#5C1D2E]" />
                        <span className="font-medium line-clamp-1">
                          {item.deliveryDate && new Date(item.deliveryDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {item.deliveryDate && (item.deliveryTime || item.deliverySlotName) ? ' • ' : ''}
                          {item.deliveryTime ? `🕒 Preferred: ${item.deliveryTime}` : item.deliverySlotName}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-brand-border/40">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 border border-brand-border rounded-full px-2 py-0.5 bg-brand-cream-light/50">
                        <button
                          onClick={() => updateQuantity(item.cartLineId!, item.quantity - 1)}
                          className="p-0.5 text-brand-muted hover:text-brand-espresso"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-brand-espresso px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartLineId!, item.quantity + 1)}
                          className="p-0.5 text-brand-muted hover:text-brand-espresso"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.cartLineId!)}
                        className="text-brand-muted hover:text-red-600 p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-brand-border/80 pt-6 mt-6 space-y-4">
                {/* Coupon Validation Block */}
              <div className="space-y-2">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-800 uppercase tracking-wider">{appliedCoupon.code}</span>
                        <span className="text-emerald-700 ml-1.5 font-medium">applied (-₹{appliedCoupon.discountAmount})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="p-1 rounded-md text-emerald-700 hover:text-red-600 hover:bg-emerald-100 transition-colors"
                      title="Remove coupon"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                        <input
                          type="text"
                          placeholder="Coupon code (e.g. SWEET10)"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError(null);
                          }}
                          className="w-full pl-8 pr-3 py-2 text-xs uppercase font-medium bg-white rounded-xl border border-brand-border focus:outline-none focus:border-brand-plum focus:ring-1 focus:ring-brand-plum"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyCoupon()}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        className="rounded-xl px-4 text-xs font-bold text-brand-plum border-brand-plum hover:bg-brand-plum hover:text-white shrink-0"
                      >
                        {isValidatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>

                    {couponError && (
                      <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1.5 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{couponError}</span>
                      </p>
                    )}
                    {couponSuccess && (
                      <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1.5 font-medium">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{couponSuccess}</span>
                      </p>
                    )}

                    {/* Available Bakery Coupons */}
                    {availableCoupons.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-espresso">
                          <Tag className="w-3.5 h-3.5 text-brand-plum" />
                          <span>Bakery Offers You Can Apply:</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {availableCoupons.map((c) => {
                            const isApplicable = !c.minOrderValue || totalPrice >= c.minOrderValue;
                            return (
                              <div
                                key={c.code}
                                className="flex items-center justify-between p-2 rounded-xl bg-amber-50/80 border border-amber-200 text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 border border-dashed border-amber-400">
                                      {c.code}
                                    </span>
                                    <span className="font-semibold text-brand-espresso text-[11px]">
                                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT OFF`}
                                    </span>
                                  </div>
                                  {c.minOrderValue && c.minOrderValue > 0 && (
                                    <p className="text-[10px] text-brand-muted mt-0.5">
                                      Min order: ₹{c.minOrderValue} {!isApplicable && `(Add ₹${c.minOrderValue - totalPrice} more)`}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleApplyCoupon(c.code)}
                                  disabled={isValidatingCoupon || !isApplicable}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand-plum text-white hover:bg-brand-plum-dark transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                >
                                  Apply
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bill Breakdown */}
              <div className="bg-white rounded-2xl p-3.5 border border-brand-border/70 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-brand-muted">
                  <span>Subtotal ({totalItems} items):</span>
                  <span className="text-brand-espresso font-medium">₹{totalPrice}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex items-center justify-between text-emerald-700 font-medium">
                    <span>Coupon Discount ({appliedCoupon.code}):</span>
                    <span>-₹{appliedCoupon.discountAmount}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-brand-muted">
                  <span>{isDeliveryDisabled ? 'Fulfillment (Pickup Only):' : 'Delivery Estimate:'}</span>
                  <span className="font-medium text-brand-espresso">
                    {isDeliveryDisabled ? (
                      <span className="text-emerald-700 font-semibold">Store Pickup (FREE)</span>
                    ) : deliveryCharge === 0 ? (
                      <span className="text-emerald-700 font-semibold">FREE</span>
                    ) : (
                      `₹${deliveryCharge}`
                    )}
                  </span>
                </div>

                <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between font-bold text-sm">
                  <span className="text-brand-espresso">Total Payable:</span>
                  <span className="font-serif font-bold text-xl text-brand-plum">
                    ₹{finalTotal}
                  </span>
                </div>
              </div>
              </div>
              </>
            )}
          </div>

          {/* Drawer Footer */}
          {items.length > 0 && (
            <div className="p-5 sm:p-6 border-t border-brand-border/80 bg-white shrink-0">
              {/* Checkout Action */}
              <div className="space-y-2">
                <Button onClick={handleProceedToCheckout} className="w-full rounded-2xl h-11 font-bold shadow-sm" size="lg">
                  <span>Proceed to Delivery & Payment</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
                <button
                  onClick={clearCart}
                  className="w-full text-center text-xs text-brand-muted hover:text-red-600 py-1 transition-colors"
                >
                  Clear store basket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};




