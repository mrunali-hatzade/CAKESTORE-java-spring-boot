'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ArrowRight,
  ArrowLeft,
  Phone,
  KeyRound,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ordersApi } from '@/lib/api/orders';
import { Order } from '@/types/order';
import { useCustomerAuth } from '@/lib/auth/CustomerAuthContext';

interface CustomerOrderLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'PHONE' | 'ORDER_NUMBER';
}

type TabType = 'PHONE' | 'ORDER_NUMBER';
type PhoneFlowStep = 'INPUT_PHONE' | 'INPUT_OTP' | 'ORDER_LIST';

export const CustomerOrderLookupModal: React.FC<CustomerOrderLookupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'PHONE',
}) => {
  const router = useRouter();
  const customerAuth = useCustomerAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Order Number Flow state
  const [orderNumber, setOrderNumber] = useState('');
  const [orderNumberError, setOrderNumberError] = useState<string | null>(null);

  // Phone OTP Flow state
  const [phoneStep, setPhoneStep] = useState<PhoneFlowStep>('INPUT_PHONE');
  const [phoneInput, setPhoneInput] = useState('');
  const [otp, setOtp] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cooldown timer for OTP resend
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fetch orders for a verified token
  const fetchOrdersForToken = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await ordersApi.getMyOrders(token);
      setOrders(resp.content || []);
      setPhoneStep('ORDER_LIST');
    } catch (err: any) {
      // Token may have expired or be invalid
      customerAuth.logout();
      setPhoneStep('INPUT_PHONE');
      setError(err?.response?.data?.message || 'Session expired. Please request a new OTP.');
    } finally {
      setIsLoading(false);
    }
  }, [customerAuth]);

  // Check existing session on modal open
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (customerAuth.phone) {
        setPhoneInput(customerAuth.phone);
      }

      if (customerAuth.isAuthenticated && customerAuth.token) {
        fetchOrdersForToken(customerAuth.token);
      } else {
        setPhoneStep('INPUT_PHONE');
      }
      setError(null);
      setOrderNumberError(null);
    }
  }, [isOpen, initialTab, customerAuth.isAuthenticated, customerAuth.token, customerAuth.phone, fetchOrdersForToken]);

  if (!isOpen) return null;

  // Handler: Direct Order Number submission
  const handleOrderNumberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = orderNumber.trim().toUpperCase();
    if (!cleanNumber) {
      setOrderNumberError('Please enter an order number.');
      return;
    }

    onClose();
    setOrderNumber('');
    setOrderNumberError(null);
    router.push(`/orders/${encodeURIComponent(cleanNumber)}`);
  };

  // Handler: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneInput.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await customerAuth.requestOtp(cleanPhone);
      setPhoneInput(cleanPhone);
      setPhoneStep('INPUT_OTP');
      setOtp('');
      startCooldown(60);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await customerAuth.verifyOtp(phoneInput, cleanOtp);
      await fetchOrdersForToken(token);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to phone input (Change Phone / Log out phone)
  const handleResetPhone = () => {
    customerAuth.logout();
    setOrders([]);
    setOtp('');
    setError(null);
    setPhoneStep('INPUT_PHONE');
  };

  // Navigate to order detail page
  const handleSelectOrder = (orderNum: string) => {
    onClose();
    router.push(`/orders/${encodeURIComponent(orderNum)}`);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'DELIVERED':
        return <Badge variant="success" size="sm">Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="error" size="sm">Cancelled</Badge>;
      case 'PREPARING':
      case 'READY':
        return <Badge variant="warning" size="sm">Baking</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="warning" size="sm">On The Way</Badge>;
      case 'CONFIRMED':
        return <Badge variant="plum" size="sm">Confirmed</Badge>;
      default:
        return <Badge variant="default" size="sm">Received</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title="Track Your Cake Order"
      description="Follow your handcrafted celebration cakes from kitchen preparation to doorstep delivery."
    >
      <div className="space-y-4 pt-1">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-brand-cream-light border border-brand-border/70 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('PHONE');
              setError(null);
            }}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'PHONE'
                ? 'bg-white text-brand-plum shadow-soft scale-[1.01]'
                : 'text-brand-muted hover:text-brand-espresso'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>My Orders (Phone OTP)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ORDER_NUMBER');
              setError(null);
            }}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ORDER_NUMBER'
                ? 'bg-white text-brand-plum shadow-soft scale-[1.01]'
                : 'text-brand-muted hover:text-brand-espresso'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Track by Order ID</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* TAB 1: PHONE NUMBER & OTP FLOW */}
        {activeTab === 'PHONE' && (
          <div className="space-y-4">
            {/* SUB-STEP 1: Enter Phone */}
            {phoneStep === 'INPUT_PHONE' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-brand-cream-light/70 border border-brand-border/60 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-brand-muted leading-relaxed">
                    <span className="font-semibold text-brand-espresso block">Passwordless Order Access</span>
                    Enter your mobile number to view all current and past cake orders across any bakery.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-espresso">
                    Mobile Number <span className="text-brand-crimson">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-muted">
                      🇮🇳 +91
                    </span>
                    <input
                      type="tel"
                      required
                      autoFocus
                      maxLength={10}
                      placeholder="98765 43210"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value.replace(/\D/g, ''));
                        if (error) setError(null);
                      }}
                      className="w-full pl-16 pr-4 py-2.5 rounded-xl border border-brand-border bg-white text-sm font-medium text-brand-espresso placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isLoading}
                    disabled={phoneInput.length < 10}
                    className="gap-1.5 font-bold shadow-soft"
                  >
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* SUB-STEP 2: Enter OTP */}
            {phoneStep === 'INPUT_OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-brand-cream-light/70 border border-brand-border/60 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0 mt-0.5">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-brand-muted leading-relaxed">
                      <span className="font-semibold text-brand-espresso block">Verification Code Sent</span>
                      Enter the 6-digit passcode sent to <span className="font-bold text-brand-espresso">+91 {phoneInput}</span>.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPhone}
                    className="text-[11px] font-bold text-brand-plum hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-espresso text-center">
                    6-Digit Security OTP
                  </label>
                  <div className="relative max-w-xs mx-auto">
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={6}
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, ''));
                        if (error) setError(null);
                      }}
                      className="w-full text-center tracking-[0.4em] py-2.5 rounded-xl border border-brand-border bg-white text-xl font-bold font-mono text-brand-espresso placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  {cooldown > 0 ? (
                    <span className="text-brand-muted">
                      Resend OTP in <span className="font-bold text-brand-espresso">{cooldown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="font-bold text-brand-plum hover:underline inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Resend Code</span>
                    </button>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPhoneStep('INPUT_PHONE')}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isLoading}
                    disabled={otp.length !== 6}
                    className="gap-1.5 font-bold shadow-soft"
                  >
                    <span>Verify & View Orders</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* SUB-STEP 3: Orders List */}
            {phoneStep === 'ORDER_LIST' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-brand-border/60">
                  <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                    <Phone className="w-3.5 h-3.5 text-brand-plum" />
                    <span>Orders for <strong className="text-brand-espresso">+91 {phoneInput}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPhone}
                    className="text-[11px] font-bold text-brand-plum hover:underline"
                  >
                    Switch Phone
                  </button>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-brand-muted font-medium flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin text-brand-plum" />
                    <span>Loading your orders...</span>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-brand-blush/60 text-brand-plum flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-brand-espresso">No Orders Found</p>
                    <p className="text-[11px] text-brand-muted max-w-xs mx-auto">
                      We couldn&apos;t find any orders placed with this mobile number.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetPhone}
                      className="mt-2 text-xs"
                    >
                      Try Another Number
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                    {orders.map((ord) => (
                      <div
                        key={ord.id || ord.orderNumber}
                        onClick={() => handleSelectOrder(ord.orderNumber)}
                        className="p-3.5 rounded-2xl bg-white border border-brand-border/80 hover:border-brand-plum hover:shadow-soft transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-brand-espresso group-hover:text-brand-plum transition-colors">
                              #{ord.orderNumber}
                            </span>
                            {getStatusBadge(ord.status)}
                          </div>
                          {ord.shopName && (
                            <p className="text-xs font-semibold text-brand-espresso truncate">
                              🏪 {ord.shopName}
                            </p>
                          )}
                          <div className="text-[11px] text-brand-muted flex items-center gap-2 flex-wrap">
                            <span>
                              {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {ord.totalAmount != null && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-brand-espresso">
                                  ₹{Number(ord.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </>
                            )}
                          </div>
                          {ord.items && ord.items.length > 0 && (
                            <p className="text-[11px] text-brand-muted line-clamp-1 italic">
                              {ord.items.map((it) => `${it.quantity}x ${it.productNameSnapshot || it.productName || 'Item'}`).join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-brand-plum group-hover:translate-x-0.5 transition-transform shrink-0">
                          <span>View Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER NUMBER LOOKUP FLOW */}
        {activeTab === 'ORDER_NUMBER' && (
          <form onSubmit={handleOrderNumberSubmit} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-brand-cream-light/70 border border-brand-border/60 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-xs text-brand-muted leading-relaxed">
                <span className="font-semibold text-brand-espresso block">Direct Order Number Lookup</span>
                Enter the unique order tracking code sent to your phone or WhatsApp receipt.
              </div>
            </div>

            <div className="space-y-1.5">
              <Input
                label="Order Number"
                placeholder="e.g. ORD-1788-9921"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value.toUpperCase());
                  if (orderNumberError) setOrderNumberError(null);
                }}
                required
                autoFocus
              />
              {orderNumberError && <p className="text-xs text-rose-600 font-medium">{orderNumberError}</p>}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 font-bold shadow-soft">
                <span>Track Order</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
