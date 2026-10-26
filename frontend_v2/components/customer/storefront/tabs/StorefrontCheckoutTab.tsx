'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  CheckCircle2,
  Calendar,
  MapPin,
  ArrowRight,
  Store,
  Truck,
  CreditCard,
  Banknote,
  Download,
  Tag,
  AlertCircle,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Sparkles,
  Eye,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Shop } from '@/types/shop';
import { DeliverySlot } from '@/types/deliverySlot';
import { Order } from '@/types/order';
import { useCart } from '@/context/CartContext';
import { ordersApi, OtpDeliveryResponse } from '@/lib/api/orders';
import { deliverySlotsApi } from '@/lib/api/deliverySlots';
import { storefrontApi } from '@/lib/api/storefront';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/common/Toast';
import { paymentsService } from '@/lib/services/payments';
import { ShopDeliveryConfig } from '@/types/shop';
import { useCustomerAuth } from '@/lib/auth/CustomerAuthContext';
import { Modal } from '@/components/ui/Modal';
import { customerProfileApi, CustomerAddress, CustomerProfile } from '@/lib/api/customerProfile';

interface StorefrontCheckoutTabProps {
  shop: Shop;
  onNavigateTab: (tab: any) => void;
}

const FALLBACK_CAKE = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80';

const formatTimeTo12Hour = (timeStr?: string): string => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hoursStr}:${minutes} ${ampm}`;
};

const format24To12 = (time24: string): string => {
  if (!time24) return '';
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return `${hStr}:${m} ${ampm}`;
};

const format12To24 = (time12: string): string => {
  if (!time12) return '';
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return `${hStr}:${m}`;
};

export const StorefrontCheckoutTab: React.FC<StorefrontCheckoutTabProps> = ({
  shop,
  onNavigateTab,
}) => {
  const router = useRouter();
  const { items, totalPrice, clearCart, appliedCoupon, setAppliedCoupon, updateQuantity, removeItem } = useCart();
  const toast = useToast();
  const customerAuth = useCustomerAuth();

  const [viewingItem, setViewingItem] = useState<any | null>(null);

  // OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [checkoutOtp, setCheckoutOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpDeliveryInfo, setOtpDeliveryInfo] = useState<OtpDeliveryResponse | null>(null);
  const [emailFallbackInput, setEmailFallbackInput] = useState('');
  const [isRequestingEmailFallback, setIsRequestingEmailFallback] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showOtpModal && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [showOtpModal, resendTimer]);

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
  const [couponInput, setCouponInput] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<number | undefined>(undefined);
  const [timeSelectionMode, setTimeSelectionMode] = useState<'SLOT' | 'CUSTOM'>('SLOT');
  const [customDeliveryTime, setCustomDeliveryTime] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'HOME_DELIVERY' | 'SELF_PICKUP'>('HOME_DELIVERY');
  const [priceMismatchModal, setPriceMismatchModal] = useState<{
    isOpen: boolean;
    authoritativeTotal: number;
    authoritativeDeliveryFee: number;
    expectedTotal: number;
    expectedDeliveryFee: number;
    fulfillmentMethod: 'HOME_DELIVERY' | 'SELF_PICKUP';
    reason: string;
    pendingCleanPhone?: string;
    pendingSlotId?: number;
    pendingAddress?: string;
    pendingInstructions?: string;
    pendingToken?: string | null;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  // Always fetch the latest delivery config fresh from the API when checkout loads
  const [liveDeliveryConfig, setLiveDeliveryConfig] = useState<ShopDeliveryConfig | null>(
    shop.deliveryConfig || null
  );

  useEffect(() => {
    if (liveDeliveryConfig?.deliveryEnabled === false) {
      setFulfillmentMethod('SELF_PICKUP');
    }
  }, [liveDeliveryConfig?.deliveryEnabled]);

  useEffect(() => {
    if (shop?.id) {
      storefrontApi
        .getShopCoupons(shop.id)
        .then((coupons) => setAvailableCoupons(coupons || []))
        .catch(() => setAvailableCoupons([]));
    }
  }, [shop?.id]);

  const handleApplyCoupon = async (specificCode?: string) => {
    const codeToTest = (specificCode || couponInput).trim();
    if (!codeToTest) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (!shop?.id) return;

    setIsValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await storefrontApi.validateCoupon(shop.id, codeToTest, totalPrice);
      if (res.valid && res.code) {
        setAppliedCoupon({
          code: res.code,
          discountType: res.discountType || 'PERCENTAGE',
          discountValue: res.discountValue || 0,
          discountAmount: res.discountAmount || 0,
        });
        setCouponSuccess(res.message || 'Coupon applied successfully!');
        setCouponInput('');
        toast.success(`Coupon "${res.code}" applied! You saved ₹${res.discountAmount}`);
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
    toast.info('Coupon removed.');
  };

  const hasInitializedFromCart = React.useRef(false);
  useEffect(() => {
    if (items.length > 0 && !hasInitializedFromCart.current) {
      if (items[0].deliveryDate) setDeliveryDate(items[0].deliveryDate);
      if (items[0].deliverySlotId) setSelectedSlotId(items[0].deliverySlotId);
      if (items[0].deliveryTime) {
        setCustomDeliveryTime(items[0].deliveryTime);
        setTimeSelectionMode('CUSTOM');
      } else if (items[0].deliveryTimeType) {
        setTimeSelectionMode(items[0].deliveryTimeType);
      }
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

  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  useEffect(() => {
    if (customerAuth.isAuthenticated && customerAuth.token) {
      if (customerAuth.phone && !customerPhone) {
        setCustomerPhone(customerAuth.phone);
      }
      
      const fetchProfileData = async () => {
        setIsLoadingAddresses(true);
        try {
          const prof = await customerProfileApi.getProfile(customerAuth.token!);
          if (prof.fullName && !customerName) setCustomerName(prof.fullName);
          if (prof.email && !customerEmail) setCustomerEmail(prof.email);
          
          const addrs = await customerProfileApi.getAddresses(customerAuth.token!);
          setSavedAddresses(addrs);
          
          const defaultAddr = addrs.find(a => a.default);
          if (defaultAddr && !deliveryAddress) {
            setSelectedAddressId(defaultAddr.id);
            setDeliveryAddress(defaultAddr.deliveryAddress);
            if (defaultAddr.recipientName && !customerName) setCustomerName(defaultAddr.recipientName);
            if (defaultAddr.recipientPhone && !customerPhone) setCustomerPhone(defaultAddr.recipientPhone);
          }
        } catch (err) {
          console.error("Failed to fetch customer profile data", err);
        } finally {
          setIsLoadingAddresses(false);
        }
      };
      
      fetchProfileData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerAuth.isAuthenticated, customerAuth.token]);

  const handleSelectSavedAddress = (addr: CustomerAddress) => {
    setSelectedAddressId(addr.id);
    setDeliveryAddress(addr.deliveryAddress);
    setCustomerName(addr.recipientName);
    setCustomerPhone(addr.recipientPhone);
  };

  const applicableSlots = useMemo<DeliverySlot[]>(() => {
    if (!deliveryDate || slots.length === 0) return slots;
    const [year, month, day] = deliveryDate.split('-').map(Number);
    const chosenDate = new Date(year, month - 1, day);
    const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const weekday = weekdayNames[chosenDate.getDay()];

    const matched = slots.filter((s: DeliverySlot) => {
      if (!s.dayOfWeek) return true;
      const dow = s.dayOfWeek.toUpperCase();
      return dow === weekday || dow === 'EVERYDAY' || dow === 'ALL';
    });

    return matched.length > 0 ? matched : slots;
  }, [slots, deliveryDate]);

  const resolvedSlotForCustomTime = useMemo(() => {
    if (!customDeliveryTime || applicableSlots.length === 0) {
      return applicableSlots.find((s) => s.available !== false) || applicableSlots[0] || null;
    }
    const raw24 = customDeliveryTime.includes('M') ? format12To24(customDeliveryTime) : customDeliveryTime;
    const [h, m] = raw24.split(':').map(Number);
    const customMinutes = (h || 0) * 60 + (m || 0);

    const covering = applicableSlots.find((slot) => {
      if (slot.available === false) return false;
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const startMin = (sh || 0) * 60 + (sm || 0);
      let endMin = (eh || 0) * 60 + (em || 0);
      if (endMin < startMin) endMin += 24 * 60;
      return customMinutes >= startMin && customMinutes <= endMin;
    });

    if (covering) return covering;
    return applicableSlots.find((s) => s.available !== false) || applicableSlots[0] || null;
  }, [customDeliveryTime, applicableSlots]);

  useEffect(() => {
    if (selectedSlotId && applicableSlots.length > 0) {
      const isValid = applicableSlots.some(
        (s: DeliverySlot) => s.id === selectedSlotId && s.available !== false && (s.remainingCapacity === undefined || s.remainingCapacity > 0)
      );
      if (!isValid) {
        setSelectedSlotId(undefined);
      }
    }
  }, [applicableSlots, selectedSlotId]);

  // Fetch fresh delivery config every time checkout tab is shown
  useEffect(() => {
    if (shop?.id) {
      storefrontApi.getShopById(shop.id)
        .then((freshShop) => {
          if (freshShop?.deliveryConfig) {
            setLiveDeliveryConfig(freshShop.deliveryConfig);
          }
        })
        .catch(() => {/* keep existing config on error */});
    }
  }, [shop?.id]);

  // Dynamic delivery charge calculation based on live deliveryConfig and fulfillmentMethod
  const deliveryConfig = liveDeliveryConfig;
  const isDeliveryDisabled = deliveryConfig?.deliveryEnabled === false;
  const effectiveFulfillmentMethod: 'HOME_DELIVERY' | 'SELF_PICKUP' = isDeliveryDisabled
    ? 'SELF_PICKUP'
    : fulfillmentMethod;

  let deliveryCharge = 0;
  if (items.length > 0) {
    if (effectiveFulfillmentMethod === 'SELF_PICKUP') {
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

    if (effectiveFulfillmentMethod === 'HOME_DELIVERY' && !deliveryAddress.trim()) {
      setError('Please enter your delivery street address.');
      return;
    }

    if (!deliveryDate) {
      setError('Please select a delivery date.');
      return;
    }

    let finalSlotId = selectedSlotId;
    if (timeSelectionMode === 'CUSTOM') {
      if (!customDeliveryTime.trim()) {
        setError('Please choose or enter your desired delivery time.');
        return;
      }
      finalSlotId = resolvedSlotForCustomTime?.id || selectedSlotId || applicableSlots[0]?.id || slots[0]?.id;
    } else {
      if (!selectedSlotId) {
        setError('Please select a delivery slot window.');
        return;
      }
    }

    if (!finalSlotId && slots.length > 0) {
      finalSlotId = slots[0]?.id;
    }

    const preferredTimeStr = timeSelectionMode === 'CUSTOM' && customDeliveryTime.trim()
      ? (customDeliveryTime.includes('M') ? customDeliveryTime.trim() : format24To12(customDeliveryTime))
      : undefined;

    const baseAddress = effectiveFulfillmentMethod === 'SELF_PICKUP'
      ? (deliveryAddress.trim() || `Store Pickup at ${shop.businessName}, ${[shop.address || shop.addressLine1, shop.city].filter(Boolean).join(', ')}`)
      : deliveryAddress.trim();

    const enrichedDeliveryAddress = preferredTimeStr
      ? `${baseAddress} [Preferred Delivery Time: ${preferredTimeStr}]`
      : baseAddress;

    const enrichedInstructions = preferredTimeStr
      ? `Preferred Delivery Time: ${preferredTimeStr}.${specialInstructions.trim() ? ' ' + specialInstructions.trim() : ''}`
      : (specialInstructions.trim() || undefined);

    // Revalidate authoritative quote with backend before order placement
    try {
      const quote = await storefrontApi.calculateQuote(shop.id, {
        fulfillmentMethod: effectiveFulfillmentMethod,
        couponCode: appliedCoupon?.code || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variantId: i.variantId,
          addonIds: i.addonIds && i.addonIds.length > 0 ? i.addonIds : undefined,
        })),
      });

      if (quote && (quote.finalTotal !== finalTotal || quote.deliveryFee !== deliveryCharge)) {
        setPriceMismatchModal({
          isOpen: true,
          authoritativeTotal: quote.finalTotal,
          authoritativeDeliveryFee: quote.deliveryFee,
          expectedTotal: finalTotal,
          expectedDeliveryFee: deliveryCharge,
          fulfillmentMethod: effectiveFulfillmentMethod,
          reason: 'Delivery charges or pricing has been adjusted by the bakery.',
          pendingCleanPhone: cleanPhone,
          pendingSlotId: finalSlotId,
          pendingAddress: enrichedDeliveryAddress,
          pendingInstructions: enrichedInstructions,
          pendingToken: customerAuth.token,
        });
        return;
      }
    } catch (qErr: any) {
      // If quote fails due to delivery disabled on home delivery
      if (qErr?.message?.includes('disabled') || qErr?.response?.data?.message?.includes('disabled')) {
        setError('Home delivery is currently disabled for this bakery. Please switch to Bakery Store Pickup.');
        setFulfillmentMethod('SELF_PICKUP');
        return;
      }
    }

    // Auth Check - Request OTP if not authenticated for this phone number
    if (!customerAuth.isAuthenticated || customerAuth.phone !== cleanPhone) {
      setIsSubmitting(true);
      setError(null);
      try {
        const delivery = await customerAuth.requestOtp(cleanPhone, customerEmail.trim());
        setOtpDeliveryInfo(delivery);
        setCheckoutOtp('');
        setShowOtpModal(true);
        setResendTimer(60);
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || '';
        if (msg.includes('Please wait') && msg.includes('seconds')) {
          setCheckoutOtp('');
          setShowOtpModal(true);
          const match = msg.match(/wait (\d+) seconds/);
          if (match) {
            setResendTimer(parseInt(match[1]));
          } else {
            setResendTimer(60);
          }
          toast.info('You recently requested an OTP. Please enter it below.');
        } else {
          setError(msg || 'Failed to send verification code.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return; // Pause order placement, wait for OTP
    }

    await executeOrderPlacement(cleanPhone, finalSlotId, enrichedDeliveryAddress, enrichedInstructions, customerAuth.token);
  };

  const handleVerifyOtpAndPlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutOtp || checkoutOtp.length !== 6) {
      setOtpError('Please enter a valid 6-digit code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    const cleanPhone = customerPhone.trim().replace(/^0+/, '');

    try {
      const token = await customerAuth.verifyOtp(cleanPhone, checkoutOtp);
      setShowOtpModal(false);
      setCheckoutOtp('');
      
      // Re-calculate fields for execution since we're in a new closure/event loop
      let finalSlotId = selectedSlotId;
      if (timeSelectionMode === 'CUSTOM') {
        finalSlotId = resolvedSlotForCustomTime?.id || selectedSlotId || applicableSlots[0]?.id || slots[0]?.id;
      }
      if (!finalSlotId && slots.length > 0) {
        finalSlotId = slots[0]?.id;
      }
      
      const preferredTimeStr = timeSelectionMode === 'CUSTOM' && customDeliveryTime.trim()
        ? (customDeliveryTime.includes('M') ? customDeliveryTime.trim() : format24To12(customDeliveryTime))
        : undefined;
      const enrichedDeliveryAddress = preferredTimeStr
        ? `${deliveryAddress.trim()} [Preferred Delivery Time: ${preferredTimeStr}]`
        : deliveryAddress.trim();
      const enrichedInstructions = preferredTimeStr
        ? `Preferred Delivery Time: ${preferredTimeStr}.${specialInstructions.trim() ? ' ' + specialInstructions.trim() : ''}`
        : (specialInstructions.trim() || undefined);

      await executeOrderPlacement(cleanPhone, finalSlotId, enrichedDeliveryAddress, enrichedInstructions, token);
    } catch (err: any) {
      setOtpError(err.response?.data?.message || err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const executeOrderPlacement = async (
    cleanPhone: string,
    finalSlotId: number | undefined,
    enrichedDeliveryAddress: string,
    enrichedInstructions: string | undefined,
    tokenToUse: string | null,
    confirmPriceChange = false,
    overriddenTotal?: number,
    overriddenDeliveryFee?: number
  ) => {
    setIsSubmitting(true);
    setError(null);

    const backendPaymentMethod = paymentMethod === 'ONLINE' ? 'ONLINE_PAYMENT' : 'COD';
    const feeToSend = overriddenDeliveryFee !== undefined ? overriddenDeliveryFee : deliveryCharge;
    const totalToSend = overriddenTotal !== undefined ? overriddenTotal : finalTotal;

    try {
      const order = await ordersApi.createGuestOrder(shop.id, {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: cleanPhone,
        paymentMethod: backendPaymentMethod,
        deliveryAddress: enrichedDeliveryAddress,
        deliveryDate,
        deliverySlotId: finalSlotId,
        specialInstructions: enrichedInstructions,
        couponCode: appliedCoupon?.code || undefined,
        fulfillmentMethod: effectiveFulfillmentMethod,
        expectedDeliveryFee: feeToSend,
        expectedTotal: totalToSend,
        confirmPriceChange: confirmPriceChange,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          customMessage: i.customMessage,
          variantId: i.variantId,
          dietaryPreference: i.dietaryPreference || (i.isEggless ? 'EGGLESS' : 'REGULAR'),
          cakeMessage: i.customMessage,
          addonIds: i.addonIds && i.addonIds.length > 0 ? i.addonIds : undefined,
        })),
      }, tokenToUse); // Attach JWT!

      if (paymentMethod === 'ONLINE') {
        try {
          const paymentOrderData = await ordersApi.createPaymentOrder(order.orderNumber);

          await paymentsService.openCustomerRazorpayCheckout({
            keyId: paymentOrderData.keyId,
            razorpayOrderId: paymentOrderData.razorpayOrderId,
            orderNumber: order.orderNumber,
            amountPaise: paymentOrderData.amountPaise,
            currency: paymentOrderData.currency,
            shopName: paymentOrderData.shopName || shop.businessName,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            customerPhone: cleanPhone,
            onSuccess: async (rzpResponse) => {
              setIsSubmitting(true);
              try {
                const verifyResult = await ordersApi.verifyPayment(order.orderNumber, {
                  razorpayOrderId: rzpResponse.razorpay_order_id,
                  razorpayPaymentId: rzpResponse.razorpay_payment_id,
                  razorpaySignature: rzpResponse.razorpay_signature,
                });

                if (verifyResult?.status === 'SUCCESS') {
                  clearCart();
                  setConfirmedOrder({
                    ...order,
                    paymentStatus: 'PAID',
                    orderStatus: 'CONFIRMED',
                    transactionId: rzpResponse.razorpay_payment_id,
                  });
                  toast.success(`Payment verified! Order #${order.orderNumber} confirmed.`);
                } else {
                  setError(`Payment verification was not successful: ${verifyResult?.message || 'Verification error'}. Order #${order.orderNumber} remains pending.`);
                }
              } catch (verifyErr: any) {
                setError(verifyErr?.message || `Payment verification failed. Your order #${order.orderNumber} is pending confirmation.`);
              } finally {
                setIsSubmitting(false);
              }
            },
            onFailure: async (errMsg) => {
              try {
                await ordersApi.cancelPaymentOrder(
                  order.orderNumber,
                  errMsg || 'Payment gateway failed',
                  paymentOrderData.checkoutToken || paymentOrderData.razorpayOrderId
                );
              } catch (_) {}
              setError(`Payment was not completed: ${errMsg || 'Transaction failed'}. Your order was not placed.`);
              setIsSubmitting(false);
            },
            onDismiss: async () => {
              try {
                await ordersApi.cancelPaymentOrder(
                  order.orderNumber,
                  'Customer closed payment window',
                  paymentOrderData.checkoutToken || paymentOrderData.razorpayOrderId
                );
              } catch (_) {}
              setError('Payment process was cancelled. Your order was not placed.');
              setIsSubmitting(false);
            },
          });
        } catch (paymentInitErr: any) {
          try {
            await ordersApi.cancelPaymentOrder(
              order.orderNumber,
              paymentInitErr?.message || 'Payment initiation failed',
              order.transactionId
            );
          } catch (_) {}
          setError(paymentInitErr?.message || `Unable to initiate online payment for Order #${order.orderNumber}. Your order was not placed.`);
          setIsSubmitting(false);
        }
      } else {
        clearCart();
        setConfirmedOrder(order);
        toast.success('Order placed successfully with the bakery!');
      }
    } catch (err: any) {
      const isPriceMismatch =
        err?.error === 'PRICE_MISMATCH' ||
        err?.response?.status === 409 ||
        err?.response?.data?.errorCode === 'PRICE_MISMATCH';

      if (isPriceMismatch) {
        const authTotal =
          err?.response?.data?.authoritativeTotal ??
          err?.authoritativeTotal ??
          totalToSend;
        const authFee =
          err?.response?.data?.authoritativeDeliveryFee ??
          err?.authoritativeDeliveryFee ??
          feeToSend;

        setPriceMismatchModal({
          isOpen: true,
          authoritativeTotal: authTotal,
          authoritativeDeliveryFee: authFee,
          expectedTotal: totalToSend,
          expectedDeliveryFee: feeToSend,
          fulfillmentMethod: effectiveFulfillmentMethod,
          reason:
            err?.response?.data?.message ||
            err?.message ||
            'The bakery price or delivery fee has been updated.',
          pendingCleanPhone: cleanPhone,
          pendingSlotId: finalSlotId,
          pendingAddress: enrichedDeliveryAddress,
          pendingInstructions: enrichedInstructions,
          pendingToken: tokenToUse,
        });
        return;
      }

      const isSlotFull = err?.error === 'SLOT_FULL' || err?.message?.includes('SLOT_FULL') || err?.message?.toLowerCase().includes('fully booked');
      if (isSlotFull) {
        setError('This delivery slot is fully booked. Please select another slot.');
        if (shop?.id) {
          deliverySlotsApi.getStorefrontSlots(shop.id, deliveryDate || undefined)
            .then(setSlots)
            .catch(() => {});
        }
        setSelectedSlotId(undefined);
      } else {
        setError(err.message || 'Failed to place order. Please check details and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPriceChangeAndProceed = async () => {
    if (!priceMismatchModal) return;
    const {
      authoritativeTotal,
      authoritativeDeliveryFee,
      pendingCleanPhone,
      pendingSlotId,
      pendingAddress,
      pendingInstructions,
      pendingToken,
    } = priceMismatchModal;

    setPriceMismatchModal(null);
    if (!pendingCleanPhone) return;

    await executeOrderPlacement(
      pendingCleanPhone,
      pendingSlotId,
      pendingAddress || '',
      pendingInstructions,
      pendingToken || null,
      true, // confirmPriceChange = true
      authoritativeTotal,
      authoritativeDeliveryFee
    );
  };

  const handleDownloadInvoice = async (orderNumber: string) => {
    setIsDownloadingInvoice(true);
    try {
      await ordersApi.downloadStorefrontInvoice(orderNumber);
      toast.success('Tax invoice downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download tax invoice PDF');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="max-w-2xl mx-auto py-6 sm:py-10">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-brand-border shadow-soft text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Order Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
              Thank You, {confirmedOrder.customerName || customerName}!
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
              Your order has been directly sent to <strong>{shop.businessName}</strong>&apos;s kitchen.
            </p>
          </div>

          <div className="bg-[#FAF7F2] rounded-2xl p-5 border border-brand-border/70 text-left space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
              <span className="text-xs text-brand-muted font-medium">Order Number</span>
              <span className="font-serif font-bold text-base text-brand-plum">
                #{confirmedOrder.orderNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-brand-muted block text-[11px]">Fulfillment</span>
                <span className="font-semibold text-brand-espresso flex items-center gap-1 mt-0.5">
                  {confirmedOrder.fulfillmentMethod === 'SELF_PICKUP' ? (
                    <>
                      <Store className="w-3.5 h-3.5 text-brand-plum" />
                      <span>Bakery Store Pickup</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5 text-brand-plum" />
                      <span>Doorstep Delivery</span>
                    </>
                  )}
                </span>
              </div>
              <div>
                <span className="text-brand-muted block text-[11px]">Payment Mode</span>
                <span className="font-semibold text-brand-espresso mt-0.5 block">
                  {confirmedOrder.paymentMethod === 'ONLINE_PAYMENT' ? 'Paid Online' : 'Cash on Delivery (COD)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-brand-border/40">
              <div>
                <span className="text-brand-muted block text-[11px]">Schedule Date</span>
                <span className="font-semibold text-brand-espresso mt-0.5 block">
                  {confirmedOrder.deliveryDate}
                  {customDeliveryTime ? ` • 🕒 ${customDeliveryTime}` : ''}
                </span>
              </div>
              <div>
                <span className="text-brand-muted block text-[11px]">Delivery Charge</span>
                <span className="font-semibold text-brand-espresso mt-0.5 block">
                  {confirmedOrder.fulfillmentMethod === 'SELF_PICKUP'
                    ? 'FREE (₹0 - Pickup)'
                    : confirmedOrder.deliveryCharge === 0
                    ? 'FREE (₹0)'
                    : `+₹${confirmedOrder.deliveryCharge}`}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between text-xs font-bold">
              <span className="text-brand-espresso">
                {confirmedOrder.paymentMethod === 'ONLINE_PAYMENT' || confirmedOrder.paymentStatus === 'PAID'
                  ? 'Total Paid:'
                  : 'Total Due (COD):'}
              </span>
              <span className="font-serif font-bold text-lg text-brand-plum">
                ₹{confirmedOrder.totalAmount}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => handleDownloadInvoice(confirmedOrder.orderNumber)}
              isLoading={isDownloadingInvoice}
              className="w-full sm:w-auto text-xs font-semibold gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download Invoice</span>
            </Button>

            <button
              onClick={() => onNavigateTab('track')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-brand-plum hover:bg-brand-plum-hover text-white text-xs font-bold transition-all shadow-xs"
            >
              <span>Track Order Live</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-brand-muted mx-auto border border-brand-border shadow-soft">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-brand-espresso">Your Store Basket is Empty</h2>
        <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
          Explore {shop.businessName}&apos;s handcrafted cakes and confections to start your order.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigateTab('shop')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-plum text-white text-xs font-bold hover:bg-brand-plum-hover transition-all shadow-sm"
          >
            <span>Browse Cake Menu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-8">
      {/* Header with Back to Shop */}
      <div className="flex items-center justify-between pb-4 border-b border-brand-border/60">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (items.length === 1 && items[0].productId) {
                router.push(`/shop/${shop.id}/product/${items[0].productId}`);
              } else if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                onNavigateTab('shop');
              }
            }}
            className="p-2 -ml-2 rounded-full text-brand-muted hover:text-brand-espresso hover:bg-brand-cream transition-colors cursor-pointer"
            title="Back to product"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
              Delivery &amp; Checkout
            </h1>
            <p className="text-xs text-brand-muted mt-0.5">
              Direct artisanal fulfillment by {shop.businessName}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          <span>Direct Bakery Order</span>
        </div>
      </div>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => setError(null)}
        />
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Delivery & Contact Info */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer Details */}
          <div className="bg-white rounded-3xl p-6 border border-brand-border/80 shadow-soft space-y-4">
            <h2 className="text-base font-serif font-bold text-brand-espresso pb-2 border-b border-brand-border/40">
              1. Customer Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              label="Email Address (for invoice & kitchen updates)"
              type="email"
              required
              placeholder="priya@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>

          {/* Delivery Details */}
          <div className="bg-white rounded-3xl p-6 border border-brand-border/80 shadow-soft space-y-4">
            <h2 className="text-base font-serif font-bold text-brand-espresso pb-2 border-b border-brand-border/40">
              2. Fulfillment Method &amp; Schedule
            </h2>

            {/* Fulfillment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-brand-espresso block">
                How would you like to receive your cake?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Home Delivery Card */}
                <div
                  onClick={() => {
                    if (!isDeliveryDisabled) setFulfillmentMethod('HOME_DELIVERY');
                  }}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isDeliveryDisabled
                      ? 'opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed'
                      : fulfillmentMethod === 'HOME_DELIVERY'
                      ? 'border-brand-plum bg-brand-blush/30 shadow-xs ring-1 ring-brand-plum/20 cursor-pointer'
                      : 'border-brand-border/70 hover:border-brand-plum/40 bg-white cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="fulfillmentMethod"
                        checked={fulfillmentMethod === 'HOME_DELIVERY' && !isDeliveryDisabled}
                        disabled={isDeliveryDisabled}
                        onChange={() => setFulfillmentMethod('HOME_DELIVERY')}
                        className="text-brand-plum focus:ring-brand-plum cursor-pointer"
                      />
                      <span className="font-bold text-xs text-brand-espresso flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-brand-plum" />
                        Doorstep Delivery
                      </span>
                    </div>
                    {isDeliveryDisabled ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        Disabled
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-brand-plum">
                        {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-muted mt-1.5 pl-5">
                    {isDeliveryDisabled
                      ? 'This bakery currently offers store pickup only.'
                      : deliveryConfig?.minOrderForFreeDelivery && totalPrice >= deliveryConfig.minOrderForFreeDelivery
                      ? `Free delivery applied (order ≥ ₹${deliveryConfig.minOrderForFreeDelivery})`
                      : 'Delivered directly to your address.'}
                  </p>
                </div>

                {/* Self-Pickup Card */}
                <div
                  onClick={() => setFulfillmentMethod('SELF_PICKUP')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    effectiveFulfillmentMethod === 'SELF_PICKUP'
                      ? 'border-brand-plum bg-brand-blush/30 shadow-xs ring-1 ring-brand-plum/20'
                      : 'border-brand-border/70 hover:border-brand-plum/40 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="fulfillmentMethod"
                        checked={effectiveFulfillmentMethod === 'SELF_PICKUP'}
                        onChange={() => setFulfillmentMethod('SELF_PICKUP')}
                        className="text-brand-plum focus:ring-brand-plum cursor-pointer"
                      />
                      <span className="font-bold text-xs text-brand-espresso flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-brand-plum" />
                        Bakery Store Pickup
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      FREE (₹0)
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-muted mt-1.5 pl-5">
                    Collect directly from bakery counter at {shop.businessName}.
                  </p>
                </div>
              </div>
            </div>

            {/* Address input or Bakery Pickup info card */}
            {effectiveFulfillmentMethod === 'SELF_PICKUP' ? (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-brand-border/80 space-y-2">
                <div className="flex items-center gap-2 text-brand-espresso font-bold text-xs">
                  <MapPin className="w-4 h-4 text-brand-plum" />
                  <span>Pickup Location</span>
                </div>
                <p className="text-xs text-brand-espresso font-semibold">{shop.businessName}</p>
                <p className="text-xs text-brand-muted">
                  {[shop.address || shop.addressLine1, shop.area, shop.city, shop.pincode].filter(Boolean).join(', ')}
                </p>
                {shop.phone && (
                  <p className="text-[11px] text-brand-muted">
                    Bakery Phone: <span className="font-medium text-brand-espresso">{shop.phone}</span>
                  </p>
                )}
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                  ✓ Delivery charge is ₹0 for self-pickup. Your cake will be ready at the counter on your selected date.
                </div>
              </div>
            ) : (
              <>
                {savedAddresses.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-brand-text mb-2">Saved Addresses</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {savedAddresses.map(addr => (
                        <div 
                          key={addr.id} 
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedAddressId === addr.id 
                              ? 'border-brand-primary bg-brand-primary/5 shadow-sm' 
                              : 'border-brand-border hover:border-brand-primary/50'
                          }`}
                        >
                          <div className="flex justify-between mb-1">
                            <span className="font-semibold text-sm flex items-center text-brand-text">
                              {addr.label}
                              {addr.default && <span className="ml-2 text-[10px] bg-brand-cream text-brand-primary px-1.5 py-0.5 rounded uppercase font-bold">Default</span>}
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted line-clamp-2">{addr.deliveryAddress}</p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center">
                      <div className="flex-1 h-px bg-brand-border/60"></div>
                      <span className="px-3 text-xs text-brand-muted font-medium uppercase tracking-wider">Or enter manually</span>
                      <div className="flex-1 h-px bg-brand-border/60"></div>
                    </div>
                  </div>
                )}

                <Input
                  label="Delivery Street Address"
                  required
                  placeholder="e.g. Flat 302, Green Valley Apartments, MG Road"
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    setSelectedAddressId(null);
                  }}
                />
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Delivery Date"
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />

              {/* Delivery Timing Mode & Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-brand-espresso">
                    Delivery Timing Preference
                  </label>
                  <div className="flex items-center p-0.5 bg-brand-cream/80 rounded-lg border border-brand-border/60 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setTimeSelectionMode('SLOT')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        timeSelectionMode === 'SLOT'
                          ? 'bg-white text-[#5C1D2E] font-bold shadow-2xs'
                          : 'text-brand-muted hover:text-brand-espresso'
                      }`}
                    >
                      Bakery Slot
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeSelectionMode('CUSTOM')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        timeSelectionMode === 'CUSTOM'
                          ? 'bg-[#5C1D2E] text-white font-bold shadow-2xs'
                          : 'text-brand-muted hover:text-brand-espresso'
                      }`}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                      <span>Exact Time</span>
                    </button>
                  </div>
                </div>

                {timeSelectionMode === 'SLOT' ? (
                  <Select
                    label=""
                    required
                    options={[
                      { value: '', label: 'Select Delivery Window' },
                      ...applicableSlots.map((s: DeliverySlot) => {
                        const dayLabel = s.dayOfWeek ? s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase() : 'Everyday';
                        const timeRange = `${s.startTime.slice(0, 5)} - ${s.endTime.slice(0, 5)}`;
                        let statusSuffix = '';
                        if (s.available === false) {
                          statusSuffix = ' — [Fully Booked]';
                        } else if (s.remainingCapacity !== undefined) {
                          statusSuffix = s.remainingCapacity <= 2 ? ` — [Only ${s.remainingCapacity} left]` : ` — [${s.remainingCapacity} available]`;
                        }
                        return {
                          value: s.id,
                          label: `${dayLabel} (${timeRange})${statusSuffix}`,
                          disabled: s.available === false,
                        };
                      }),
                    ]}
                    value={selectedSlotId || ''}
                    onChange={(e) => setSelectedSlotId(e.target.value ? Number(e.target.value) : undefined)}
                    helperText={applicableSlots.length === 0 ? 'No delivery slots found for this date' : undefined}
                  />
                ) : (
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-[#FAF7F2] border border-[#5C1D2E]/25">
                    <div className="relative">
                      <input
                        type="time"
                        value={customDeliveryTime.includes('M') ? format12To24(customDeliveryTime) : customDeliveryTime}
                        onChange={(e) => setCustomDeliveryTime(format24To12(e.target.value))}
                        className="w-full h-9 px-3 pl-9 rounded-lg border border-brand-border bg-white text-xs font-semibold text-brand-espresso focus:outline-none focus:border-[#5C1D2E] cursor-pointer"
                      />
                      <Clock className="w-3.5 h-3.5 text-[#5C1D2E] absolute left-2.5 top-2.5 pointer-events-none" />
                    </div>
                    {/* Quick celebration presets */}
                    <div className="flex flex-wrap gap-1">
                      {['12:00 PM', '04:30 PM', '07:00 PM', '09:00 PM'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCustomDeliveryTime(t)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            customDeliveryTime === t
                              ? 'bg-[#5C1D2E] text-white border-[#5C1D2E] font-bold'
                              : 'bg-white text-brand-espresso border-brand-border/70 hover:bg-brand-cream'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Textarea
              label="Special Delivery Instructions (Optional)"
              placeholder="e.g. Ring bell twice or call on arrival"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={2}
            />
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-3xl p-6 border border-brand-border/80 shadow-soft space-y-4">
            <h2 className="text-base font-serif font-bold text-brand-espresso pb-2 border-b border-brand-border/40">
              3. Payment Method
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('COD')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                  paymentMethod === 'COD'
                    ? 'bg-brand-blush/80 border-brand-plum text-brand-espresso shadow-xs'
                    : 'bg-white border-brand-border hover:bg-brand-cream/40 text-brand-espresso'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  paymentMethod === 'COD' ? 'bg-brand-plum text-white' : 'bg-brand-cream text-brand-plum'
                }`}>
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold">Pay on Delivery</p>
                  <p className="text-[11px] text-brand-muted mt-0.5">Cash or UPI upon delivery</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('ONLINE')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                  paymentMethod === 'ONLINE'
                    ? 'bg-brand-blush/80 border-brand-plum text-brand-espresso shadow-xs'
                    : 'bg-white border-brand-border hover:bg-brand-cream/40 text-brand-espresso'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  paymentMethod === 'ONLINE' ? 'bg-brand-plum text-white' : 'bg-brand-cream text-brand-plum'
                }`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold">Pay Online</p>
                  <p className="text-[11px] text-brand-muted mt-0.5">Instant UPI, Cards & Netbanking</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Order Summary & Place Order CTA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-brand-border/80 shadow-soft space-y-5 sticky top-28">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
              <h2 className="text-base font-serif font-bold text-brand-espresso">
                Order Summary
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-blush text-brand-plum">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Items List */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-brand-muted px-1">
                <span>Items in your order</span>
                <span className="text-brand-plum font-medium">Click cake to view details</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-brand-border/40 space-y-2 pr-1 text-xs">
                {items.map((i) => (
                  <div
                    key={i.cartLineId}
                    onClick={() => setViewingItem(i)}
                    className="pt-2.5 first:pt-0 flex justify-between items-center gap-3 group cursor-pointer hover:bg-brand-cream/60 p-2 -mx-2 rounded-2xl transition-all border border-transparent hover:border-brand-border/60"
                    title="Click to view cake details"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-brand-cream shrink-0 border border-brand-border/60 group-hover:ring-2 group-hover:ring-brand-plum/40 transition-all shadow-xs">
                        <Image
                          src={i.imageUrl || FALLBACK_CAKE}
                          alt={i.name}
                          fill
                          sizes="48px"
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK_CAKE;
                          }}
                        />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-brand-espresso truncate group-hover:text-brand-plum transition-colors">
                            {i.name} &times; {i.quantity}
                          </span>
                          <Eye className="w-3.5 h-3.5 text-brand-plum opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-muted">
                          <span>{i.weight ? `${i.weight}` : (i.variantName || 'Standard')}</span>
                          <span>•</span>
                          <span>{i.isEggless ? '🌱 Eggless' : 'Contains Egg'}</span>
                        </div>
                        {i.customMessage && (
                          <span className="block text-[11px] text-brand-plum italic truncate">
                            Plaque: &quot;{i.customMessage}&quot;
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1.5">
                      <span className="font-serif font-bold text-brand-espresso">
                        ₹{i.price * i.quantity}
                      </span>
                      <div 
                        className="flex items-center bg-white border border-brand-border/80 rounded-md overflow-hidden shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (i.cartLineId) {
                              updateQuantity(i.cartLineId, i.quantity - 1);
                            }
                          }}
                          className="px-2 py-0.5 text-brand-muted hover:text-brand-plum hover:bg-brand-cream/50 transition-colors font-bold text-xs"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-brand-espresso border-x border-brand-border/40 min-w-[20px] text-center">
                          {i.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (i.cartLineId) {
                              updateQuantity(i.cartLineId, i.quantity + 1);
                            }
                          }}
                          className="px-2 py-0.5 text-brand-muted hover:text-brand-plum hover:bg-brand-cream/50 transition-colors font-bold text-xs"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coupon Code Section */}
            <div className="pt-2 border-t border-brand-border/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-espresso flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-plum" />
                  Have a Coupon?
                </span>
                {appliedCoupon && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Coupon Applied
                  </span>
                )}
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-800 uppercase tracking-wider text-xs">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          (-₹{appliedCoupon.discountAmount})
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-600">Bakery discount applied to your order</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1.5 rounded-lg text-emerald-700 hover:text-red-600 hover:bg-emerald-100 transition-colors"
                    title="Remove coupon"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 text-xs uppercase font-medium bg-brand-cream/30 rounded-xl border border-brand-border focus:outline-none focus:border-brand-plum focus:ring-1 focus:ring-brand-plum transition-all"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyCoupon()}
                      disabled={isValidatingCoupon || !couponInput.trim()}
                      className="rounded-xl px-4 text-xs font-bold text-brand-plum border-brand-plum hover:bg-brand-plum hover:text-white shrink-0 disabled:opacity-50"
                    >
                      {isValidatingCoupon ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>

                  {couponError && (
                    <p className="text-[11px] text-red-600 flex items-center gap-1 font-medium bg-red-50 p-2 rounded-xl border border-red-100">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{couponError}</span>
                    </p>
                  )}
                  {couponSuccess && (
                    <p className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{couponSuccess}</span>
                    </p>
                  )}

                  {/* Available Bakery Coupons */}
                  {availableCoupons.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                        Available Bakery Coupons:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableCoupons.map((c) => {
                          const isApplicable = !c.minOrderValue || totalPrice >= c.minOrderValue;
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCouponInput(c.code);
                                handleApplyCoupon(c.code);
                              }}
                              disabled={isValidatingCoupon || !isApplicable}
                              className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] border transition-all text-left ${
                                isApplicable
                                  ? 'bg-brand-blush/60 hover:bg-brand-blush border-brand-plum/30 text-brand-espresso cursor-pointer'
                                  : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                              }`}
                              title={c.minOrderValue && !isApplicable ? `Requires min order of ₹${c.minOrderValue}` : 'Click to apply'}
                            >
                              <span className="font-mono font-bold text-brand-plum group-hover:underline">
                                {c.code}
                              </span>
                              <span className="text-[10px] text-brand-muted">
                                ({c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`} off)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Price Calculations */}
            <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-brand-border/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-brand-muted">
                <span>Subtotal:</span>
                <span className="font-medium text-brand-espresso">₹{totalPrice}</span>
              </div>

              <div className="flex items-center justify-between text-brand-muted">
                <span>Fulfillment:</span>
                <span className="font-semibold text-brand-espresso flex items-center gap-1">
                  {effectiveFulfillmentMethod === 'SELF_PICKUP' ? (
                    <>
                      <Store className="w-3.5 h-3.5 text-brand-plum" />
                      <span>Bakery Store Pickup</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5 text-brand-plum" />
                      <span>Doorstep Delivery</span>
                    </>
                  )}
                </span>
              </div>

              {appliedCoupon && (
                <div className="flex items-center justify-between text-emerald-700 font-semibold">
                  <span>Coupon ({appliedCoupon.code}):</span>
                  <span>-₹{appliedCoupon.discountAmount}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-brand-muted">
                <span>Delivery Charge:</span>
                <span className="font-medium text-brand-espresso">
                  {effectiveFulfillmentMethod === 'SELF_PICKUP' ? (
                    <span className="text-emerald-700 font-semibold">FREE (₹0 - Pickup)</span>
                  ) : deliveryCharge === 0 ? (
                    <span className="text-emerald-700 font-semibold">FREE</span>
                  ) : (
                    `₹${deliveryCharge}`
                  )}
                </span>
              </div>

              <div className="pt-2.5 border-t border-brand-border/60 flex items-baseline justify-between font-bold text-sm">
                <span className="text-brand-espresso">Total Payable:</span>
                <span className="font-serif font-bold text-2xl text-brand-plum">
                  ₹{finalTotal}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting}
              className="w-full font-bold h-12 rounded-2xl shadow-sm text-sm bg-[#5C1D2E] hover:bg-[#4a1525]"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span>{paymentMethod === 'ONLINE' ? 'Pay Online with Razorpay' : 'Place Bakery Order (COD)'}</span>
            </Button>

            <p className="text-[11px] text-brand-muted text-center leading-relaxed">
              Your order is prepared fresh on the morning of delivery by {shop.businessName}.
            </p>
          </div>
        </div>
      </form>

      {/* Selected Cake Details Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setViewingItem(null)}
          />
          <div className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl border border-brand-border/80 overflow-hidden z-10 animate-scale-up">
            {/* Modal Header Image */}
            <div className="relative h-48 sm:h-52 bg-brand-cream overflow-hidden">
              <Image
                src={viewingItem.imageUrl || FALLBACK_CAKE}
                alt={viewingItem.name}
                fill
                sizes="(max-width: 640px) 100vw, 448px"
                unoptimized
                className="object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_CAKE;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-brand-espresso flex items-center justify-center backdrop-blur-xs shadow-md transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3.5 left-4 right-4 text-white">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-plum text-white mb-1 shadow-xs">
                  {viewingItem.isEggless ? '🌱 100% Eggless' : 'Contains Egg'}
                </span>
                <h3 className="font-serif font-bold text-lg leading-snug drop-shadow-xs">
                  {viewingItem.name}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-brand-cream-light/60 p-3 rounded-2xl border border-brand-border/50">
                  <span className="text-[10px] text-brand-muted block font-medium uppercase tracking-wider">Weight / Size</span>
                  <span className="font-bold text-brand-espresso text-sm mt-0.5 block">
                    {viewingItem.weight ? `${viewingItem.weight}` : (viewingItem.variantName || 'Standard')}
                  </span>
                </div>
                <div className="bg-brand-cream-light/60 p-3 rounded-2xl border border-brand-border/50">
                  <span className="text-[10px] text-brand-muted block font-medium uppercase tracking-wider">Item Price</span>
                  <span className="font-serif font-bold text-brand-plum text-sm mt-0.5 block">
                    ₹{viewingItem.price} &times; {viewingItem.quantity} = ₹{viewingItem.price * viewingItem.quantity}
                  </span>
                </div>
              </div>

              {viewingItem.customMessage && (
                <div className="bg-brand-blush/60 p-3 rounded-2xl border border-brand-border/60">
                  <span className="text-[10px] font-bold text-brand-plum uppercase tracking-wider block mb-1">
                    Cake Plaque Message
                  </span>
                  <p className="text-xs italic font-serif text-brand-espresso">
                    &quot;{viewingItem.customMessage}&quot;
                  </p>
                </div>
              )}

              {(viewingItem.deliveryDate || viewingItem.deliverySlotName || viewingItem.deliveryTime) && (
                <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-brand-border/60 space-y-1">
                  <span className="text-[10px] font-bold text-brand-espresso flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-brand-plum" />
                    Delivery Schedule for this Cake
                  </span>
                  <p className="text-xs text-brand-espresso">
                    {viewingItem.deliveryDate && (
                      <span className="font-semibold">
                        {new Date(viewingItem.deliveryDate + 'T00:00:00').toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {viewingItem.deliveryDate && (viewingItem.deliveryTime || viewingItem.deliverySlotName) ? ' • ' : ''}
                    {viewingItem.deliveryTime ? (
                      <span className="text-brand-plum font-semibold">
                        Preferred Time: {formatTimeTo12Hour(viewingItem.deliveryTime)}
                      </span>
                    ) : viewingItem.deliverySlotName ? (
                      <span className="text-brand-plum font-semibold">
                        Slot: {viewingItem.deliverySlotName}
                      </span>
                    ) : null}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                {viewingItem.productId && (
                  <Link
                    href={`/shop/${shop.id}/product/${viewingItem.productId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-plum/40 text-brand-plum hover:bg-brand-blush/40 text-xs font-bold transition-all text-center"
                  >
                    <span>Full Cake Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                <Button
                  type="button"
                  onClick={() => setViewingItem(null)}
                  className="flex-1 rounded-xl text-xs font-bold bg-[#5C1D2E] hover:bg-[#4a1525] text-white"
                >
                  Back to Checkout
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      <Modal
        isOpen={showOtpModal}
        onClose={() => {
          setShowOtpModal(false);
          setIsSubmitting(false); // Make sure order button resets
        }}
        title="Verify Your Order"
        maxWidth="sm"
      >
        <form onSubmit={handleVerifyOtpAndPlaceOrder} className="space-y-4">
          {/* Channel Banner */}
          <div className="p-3.5 rounded-xl border border-brand-border bg-[#FAF7F2] text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand-espresso">
                {otpDeliveryInfo?.channel === 'SMS_AND_EMAIL' ? '📱 ✉️ Mobile & Email Verification' :
                 otpDeliveryInfo?.channel === 'EMAIL' ? '✉️ Email Verification Fallback' :
                 otpDeliveryInfo?.channel === 'SMS' ? '📱 Mobile SMS Verification' :
                 '🛠️ Local Development Verification'}
              </span>
            </div>
            <p className="text-brand-muted text-[11px] leading-relaxed">
              {otpDeliveryInfo?.channel === 'SMS_AND_EMAIL'
                ? "We've sent a 6-digit verification code to your mobile and email."
                : otpDeliveryInfo?.channel === 'EMAIL'
                ? `We've sent a 6-digit verification code to your email (${otpDeliveryInfo.emailMasked || customerEmail.trim()}).`
                : otpDeliveryInfo?.channel === 'SMS'
                ? `We've sent a 6-digit verification code to your mobile (${otpDeliveryInfo.phoneMasked || customerPhone}).`
                : (otpDeliveryInfo?.message || `We've sent a 6-digit verification code to ${customerPhone}.`)}
            </p>
          </div>

          {/* Email Fallback Option if SMS is in mock mode or customer wants email */}
          {(!otpDeliveryInfo?.emailMasked && !customerEmail.trim()) && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-2">
              <span className="font-bold text-amber-900 block">Want to receive the code via email?</span>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={emailFallbackInput}
                  onChange={(e) => setEmailFallbackInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isRequestingEmailFallback}
                  onClick={async () => {
                    if (!emailFallbackInput || !emailFallbackInput.includes('@')) {
                      setOtpError('Please enter a valid email address.');
                      return;
                    }
                    setIsRequestingEmailFallback(true);
                    setOtpError(null);
                    try {
                      const cleanPhone = customerPhone.trim().replace(/^0+/, '');
                      const delivery = await customerAuth.requestOtp(cleanPhone, emailFallbackInput.trim());
                      setOtpDeliveryInfo(delivery);
                      setResendTimer(60);
                      toast.success('Verification code requested via email!');
                    } catch (err: any) {
                      setOtpError(err.response?.data?.message || err.message || 'Failed to dispatch email OTP');
                    } finally {
                      setIsRequestingEmailFallback(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#5C1D2E] text-white font-bold text-xs hover:bg-[#4a1525] transition-colors disabled:opacity-50"
                >
                  {isRequestingEmailFallback ? 'Sending...' : 'Send to Email'}
                </button>
              </div>
            </div>
          )}

          {otpError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex flex-col gap-1">
              <span className="font-bold">Verification Failed</span>
              <span>{otpError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-espresso">Enter 6-Digit OTP</label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="••••••"
              value={checkoutOtp}
              onChange={(e) => setCheckoutOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white text-center tracking-widest text-xl font-mono focus:outline-none focus:border-brand-plum focus:ring-1 focus:ring-brand-plum"
            />
          </div>
          
          <div className="flex justify-end items-center mt-1 mb-2">
            {resendTimer > 0 ? (
              <span className="text-[11px] text-brand-muted font-medium">
                Resend OTP in {resendTimer}s
              </span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const cleanPhone = customerPhone.trim().replace(/^0+/, '');
                    const emailToSend = emailFallbackInput.trim() || customerEmail.trim();
                    const delivery = await customerAuth.requestOtp(cleanPhone, emailToSend);
                    setOtpDeliveryInfo(delivery);
                    setResendTimer(60);
                    toast.success('OTP resent successfully!');
                  } catch (err: any) {
                    setOtpError(err.response?.data?.message || err.message || 'Failed to request OTP');
                  }
                }}
                disabled={isVerifyingOtp}
                className="text-[11px] font-bold text-brand-plum hover:text-brand-plum-light transition-colors"
              >
                Resend OTP
              </button>
            )}
          </div>

          <Button
            type="submit"
            disabled={isVerifyingOtp || checkoutOtp.length !== 6}
            className="w-full font-bold h-11"
          >
            {isVerifyingOtp ? 'Verifying & Placing Order...' : 'Verify & Place Order'}
          </Button>

          <p className="text-[10px] text-center text-brand-muted pt-2">
            Wrong contact details?{' '}
            <button
              type="button"
              onClick={() => {
                setShowOtpModal(false);
                setIsSubmitting(false);
              }}
              className="font-bold text-brand-plum hover:underline"
            >
              Go back and edit
            </button>
          </p>
        </form>
      </Modal>

      {/* Price Mismatch Confirmation Modal */}
      {priceMismatchModal && (
        <Modal
          isOpen={priceMismatchModal.isOpen}
          onClose={() => setPriceMismatchModal(null)}
          title="Bakery Pricing Update"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <p className="font-semibold">The bakery&apos;s pricing or delivery charges have changed since your session started.</p>
              <p className="text-[11px] text-amber-700 mt-1">
                Please review the updated authoritative prices from the bakery before confirming your order.
              </p>
            </div>

            <div className="bg-[#FAF7F2] rounded-xl border border-brand-border/70 p-4 text-xs space-y-2">
              <div className="flex justify-between text-brand-muted">
                <span>Fulfillment Mode:</span>
                <span className="font-bold text-brand-espresso">
                  {priceMismatchModal.fulfillmentMethod === 'SELF_PICKUP' ? 'Store Pickup' : 'Home Delivery'}
                </span>
              </div>
              <div className="flex justify-between text-brand-muted">
                <span>Estimated Delivery Fee:</span>
                <span className="line-through text-gray-400">₹{priceMismatchModal.expectedDeliveryFee}</span>
              </div>
              <div className="flex justify-between font-semibold text-brand-espresso">
                <span>Authoritative Delivery Fee:</span>
                <span className="text-brand-plum font-bold">
                  {priceMismatchModal.authoritativeDeliveryFee === 0 ? 'FREE (₹0)' : `₹${priceMismatchModal.authoritativeDeliveryFee}`}
                </span>
              </div>
              <div className="border-t border-brand-border/60 pt-2 flex justify-between font-bold text-sm">
                <span className="text-brand-espresso">Updated Total Payable:</span>
                <span className="text-brand-plum font-serif text-lg">₹{priceMismatchModal.authoritativeTotal}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPriceMismatchModal(null)}
                className="text-xs"
              >
                Review Cart
              </Button>
              <Button
                size="sm"
                className="bg-[#5C1D2E] hover:bg-[#4a1525] text-white text-xs font-bold"
                onClick={handleConfirmPriceChangeAndProceed}
              >
                Accept &amp; Place Order (₹{priceMismatchModal.authoritativeTotal})
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
