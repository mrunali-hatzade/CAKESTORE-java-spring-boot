'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Check,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Download,
  FileText,
  Receipt,
  ArrowDown,
} from 'lucide-react';
import { ownerApi } from '@/lib/api/owner';
import { paymentsService } from '@/lib/services/payments';
import { useAuth } from '@/lib/auth/AuthContext';
import { SubscriptionRecord, OwnerPaymentRecord } from '@/types/owner';
import { useOwner } from '@/context/OwnerContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { plansApi, SubscriptionPlan } from '@/lib/api/plans';
import { useToast } from '@/components/common/Toast';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

export default function OwnerSubscriptionPage() {
  const { user } = useAuth();
  const { registerRefreshHandler, shop, refreshShop, refreshDashboard } = useOwner();
  const toast = useToast();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [payments, setPayments] = useState<OwnerPaymentRecord[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentPage, setPaymentPage] = useState(0);
  const [paymentTotalPages, setPaymentTotalPages] = useState(0);
  const [paymentTotalElements, setPaymentTotalElements] = useState(0);
  const PAYMENT_PAGE_SIZE = 10;
  const [renewing, setRenewing] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Cancellation modal states
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchPayments = useCallback(async (pageToFetch?: number) => {
    const targetPage = typeof pageToFetch === 'number' ? pageToFetch : paymentPage;
    setLoadingPayments(true);
    try {
      const res = await ownerApi.getPayments(targetPage, PAYMENT_PAGE_SIZE);
      const content = res?.content || [];
      const totalPages = res?.totalPages || 0;
      const totalElements = res?.totalElements || 0;

      setPayments(content);
      setPaymentTotalPages(totalPages);
      setPaymentTotalElements(totalElements);

      // Handle empty final page safely if data changes between requests
      if (targetPage > 0 && content.length === 0 && totalPages > 0) {
        const fallbackPage = Math.max(0, totalPages - 1);
        setPaymentPage(fallbackPage);
      }
    } catch (err: any) {
      console.error('Failed to load payment history', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [paymentPage]);

  const fetchSubscription = useCallback(async (isManual = false) => {
    if (!isManual) setLoading(true);
    setErrorNotice(null);

    try {
      const [data, plansData] = await Promise.all([
        ownerApi.getCurrentSubscription(),
        plansApi.getActivePlans(),
      ]);
      setSubscription(data);
      setPlans(plansData || []);

      // Auto-select based on current subscription or first active plan
      if (data?.plan?.id) {
        setSelectedPlanId(data.plan.id);
      } else if (plansData && plansData.length > 0) {
        setSelectedPlanId(plansData[0].planId);
      }

      setPaymentPage(0);
      await fetchPayments(0);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }, [fetchPayments]);

  useEffect(() => {
    fetchPayments(paymentPage);
  }, [paymentPage, fetchPayments]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const unregister = registerRefreshHandler(async () => {
      await fetchSubscription(true);
    });
    return unregister;
  }, [registerRefreshHandler, fetchSubscription]);

  const handleRenewPayment = async (planId?: number) => {
    const targetPlanId = planId || selectedPlanId;
    if (!targetPlanId) {
      setErrorNotice('Please select a subscription plan.');
      return;
    }

    setRenewing(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const orderData = await ownerApi.initiateSubscriptionPayment(targetPlanId);
      const keyId = orderData.keyId;

      const isLoaded = await paymentsService.loadRazorpayScript();
      if (!isLoaded && keyId && !keyId.includes('placeholder')) {
        setErrorNotice('Unable to load payment gateway. Please check your internet connection.');
        setRenewing(false);
        return;
      }

      if (keyId && !keyId.includes('placeholder')) {
        const rzpOptions = {
          key: keyId,
          amount: orderData.amountPaise,
          currency: orderData.currency || 'INR',
          name: 'CakeStore',
          description: `Subscription Renewal for ${orderData.shopName || 'Bakery'}`,
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: user?.fullName || '',
            email: user?.email || '',
            contact: shop?.phone || user?.email || '',
          },
          theme: {
            color: '#5C2434',
          },
          handler: async (response: any) => {
            try {
              if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
                throw new Error('Incomplete payment details.');
              }
              await ownerApi.verifySubscriptionPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                planId: targetPlanId,
              });
              setSuccessNotice('Payment processed successfully. Subscription updated.');
              await Promise.allSettled([
                fetchSubscription(true),
                refreshShop ? refreshShop() : Promise.resolve(),
                refreshDashboard ? refreshDashboard() : Promise.resolve(),
              ]);
            } catch (err: any) {
              setErrorNotice(err?.message || 'Payment verification failed. Please try again.');
            } finally {
              setRenewing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setErrorNotice('Payment was not completed. Please try again.');
              setRenewing(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.open();
      } else {
        // Sandbox simulation when test placeholder keys are active
        const simulatedPaymentId = `pay_test_${Date.now()}`;
        await ownerApi.verifySubscriptionPayment({
          razorpayOrderId: orderData.razorpayOrderId,
          razorpayPaymentId: simulatedPaymentId,
          razorpaySignature: 'simulated_test_sig',
          planId: targetPlanId,
        });
        setSuccessNotice('Mock payment processed successfully. Subscription updated.');
        await Promise.allSettled([
          fetchSubscription(true),
          refreshShop ? refreshShop() : Promise.resolve(),
          refreshDashboard ? refreshDashboard() : Promise.resolve(),
        ]);
        setRenewing(false);
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Payment initiation failed. Please try again.');
      setRenewing(false);
    }
  };

  const handleDownloadInvoice = async (paymentId: number) => {
    setDownloadingInvoiceId(paymentId);
    try {
      await ownerApi.downloadPaymentInvoice(paymentId);
      toast.success('Invoice downloaded!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download invoice. Please try again.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);

    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length > 500) {
      setCancelError('Cancellation reason must be 500 characters or fewer.');
      setCancelling(false);
      return;
    }

    try {
      const updated = await ownerApi.cancelSubscription(trimmedReason ? trimmedReason : undefined);
      setSubscription(updated);
      setIsCancelModalOpen(false);
      setCancelReason('');
      setSuccessNotice('Your subscription has been scheduled for cancellation. Access remains active until the end of your billing cycle.');
      toast.success('Subscription cancellation recorded.');
      
      // Refresh background context
      if (refreshShop) refreshShop().catch(() => {});
      if (refreshDashboard) refreshDashboard().catch(() => {});
    } catch (err: any) {
      const msg = err?.message || 'Failed to cancel subscription. Please try again.';
      setCancelError(msg);
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  const scrollToPlans = () => {
    const el = document.getElementById('available-plans');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // State calculations adhering strictly to domain rules
  const isAdminWithoutShop = (user?.role === 'ROLE_ADMIN' || (user?.role as string) === 'ADMIN') && !shop;

  const hasActiveSubscription = Boolean(
    subscription?.plan &&
    (subscription?.status === 'ACTIVE' ||
      subscription?.status === 'GRACE_PERIOD' ||
      subscription?.status === 'EXPIRING_SOON')
  );

  const isPending =
    shop?.status === 'PENDING' ||
    subscription?.status === 'PENDING';

  const isExpired =
    shop?.status === 'EXPIRED' ||
    subscription?.status === 'EXPIRED' ||
    subscription?.status === 'SUSPENDED' ||
    (Boolean(subscription?.expiryDate) &&
      !isPending &&
      new Date(subscription!.expiryDate!).getTime() < Date.now());

  const isNoPlan = !hasActiveSubscription && !isPending && !isExpired;

  const daysRemaining = subscription?.expiryDate
    ? Math.max(
        0,
        Math.ceil((new Date(subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;

  const filteredPlans = plans.filter((p) => p.billingCycle === billingCycle);

  const currentPlanId = subscription?.plan?.id;

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingState message="Loading subscription & billing details..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-owner-border shadow-soft">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-blush text-brand-plum text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Storefront SaaS Platform License</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-owner-heading tracking-tight">
            Subscription & Plans
          </h1>
          <p className="text-xs text-owner-muted">
            Manage your CakeStore merchant license, renewal dates, and commercial studio features
          </p>
        </div>
      </div>

      {/* Admin Context Banner */}
      {isAdminWithoutShop && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Platform Administrator Preview</p>
              <p className="text-indigo-800 text-[11px] mt-0.5">
                You are previewing the Owner Subscription portal with an administrator account (<span className="font-mono">Shop ID: N/A</span>). Bakery merchant subscriptions, Razorpay transactions, and invoices are linked to verified bakery owner accounts.
              </p>
            </div>
          </div>
          <Link href="/dashboard/admin/subscriptions">
            <Button size="sm" variant="outline" className="shrink-0 bg-white border-indigo-200 hover:bg-indigo-100/50 text-indigo-700">
              Admin Plan Manager
            </Button>
          </Link>
        </div>
      )}

      {/* Payment Required Warning */}
      {isPending && !isAdminWithoutShop && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Activate Your Bakery Platform License</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Complete your subscription to activate your bakery, unlock your digital storefront, and start managing orders.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleRenewPayment()}
            isLoading={renewing}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
          >
            Activate Now
          </Button>
        </div>
      )}

      {/* Expired License Warning */}
      {isExpired && !isAdminWithoutShop && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Platform Subscription Expired</p>
              <p className="text-rose-800 text-[11px] mt-0.5">
                Your bakery license has expired. Renew your plan to reactivate your storefront and resume receiving customer orders.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleRenewPayment()}
            isLoading={renewing}
            className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white"
          >
            Renew Now
          </Button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Persistent Notice When Subscription is Cancelled */}
      {subscription?.cancelledAt && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Subscription Scheduled for Cancellation</p>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                Your cancellation request was recorded on{' '}
                {new Date(subscription.cancelledAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {subscription.cancellationReason ? ` ("${subscription.cancellationReason}")` : ''}.{' '}
                Your storefront, custom domain, and paid entitlements remain fully active until your billing cycle ends on{' '}
                <span className="font-semibold">
                  {subscription.expiryDate
                    ? new Date(subscription.expiryDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'your current expiry date'}
                </span>
                . Cancellation prevents future renewal; it does not issue an immediate refund.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleRenewPayment()}
            isLoading={renewing}
            className="shrink-0 bg-brand-plum hover:bg-brand-plum/90 text-white"
          >
            Renew / Extend Now
          </Button>
        </div>
      )}

      {/* Current Active Plan Status Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-plum/30 shadow-card relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  hasActiveSubscription
                    ? subscription?.cancelledAt
                      ? 'warning'
                      : subscription?.status === 'EXPIRING_SOON'
                      ? 'warning'
                      : 'success'
                    : isPending
                    ? 'warning'
                    : isExpired
                    ? 'error'
                    : 'warning'
                }
                size="md"
              >
                {hasActiveSubscription
                  ? subscription?.cancelledAt
                    ? 'Pending Cancellation'
                    : subscription?.status === 'EXPIRING_SOON'
                    ? 'Expiring Soon'
                    : 'Active Plan'
                  : isPending
                  ? 'Payment Required'
                  : isExpired
                  ? 'License Expired'
                  : 'No Active Plan'}
              </Badge>

              {hasActiveSubscription && daysRemaining !== null && (
                <span className="text-xs text-owner-muted flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-brand-plum" />
                  <span>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining in billing cycle</span>
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold font-serif text-owner-heading">
              {hasActiveSubscription
                ? subscription?.plan?.name || 'Pro Baker Studio Suite'
                : isPending
                ? 'License Activation Required'
                : isExpired
                ? 'License Renewal Required'
                : 'No Active Subscription'}
            </h2>
            <p className="text-xs text-owner-muted max-w-xl leading-relaxed">
              {hasActiveSubscription
                ? subscription?.cancelledAt
                  ? 'Your subscription is scheduled to expire at the end of the term. Your storefront remains open to customers and all features remain accessible until expiry.'
                  : subscription?.plan?.description ||
                    'Includes full access to custom storefront, unlimited catalog, order invoicing, direct UPI customer payouts, and zero platform sales commission.'
                : isPending
                ? 'Complete your initial subscription payment to unlock your online bakery storefront and begin receiving cake bookings.'
                : isExpired
                ? 'Your bakery subscription has lapsed. Please renew your plan to restore customer ordering and studio tools.'
                : 'Your bakery does not currently have an active platform license. Choose one of our studio plans below to activate your custom storefront, enable online ordering, and access order management.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {hasActiveSubscription ? (
              <>
                <div className="text-right sm:pr-4 sm:border-r border-owner-border">
                  <p className="text-2xl font-extrabold font-serif text-brand-espresso">
                    ₹{Number(subscription?.plan?.price || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-[11px] text-owner-muted">
                    per {subscription?.plan?.durationDays === 365 ? 'year' : 'month'} / 0% commission
                  </p>
                </div>

                <Button
                  onClick={() => handleRenewPayment()}
                  isLoading={renewing}
                  size="lg"
                  className="gap-2 shadow-soft"
                >
                  <Zap className="w-4 h-4" />
                  <span>Extend License</span>
                </Button>

                {!subscription?.cancelledAt && (
                  <Button
                    onClick={() => {
                      setCancelError(null);
                      setCancelReason('');
                      setIsCancelModalOpen(true);
                    }}
                    variant="outline"
                    size="lg"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </>
            ) : isPending || isExpired ? (
              <>
                {subscription?.plan?.price ? (
                  <div className="text-right sm:pr-4 sm:border-r border-owner-border">
                    <p className="text-2xl font-extrabold font-serif text-brand-espresso">
                      ₹{Number(subscription.plan.price).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] text-owner-muted">
                      per {subscription.plan.durationDays === 365 ? 'year' : 'month'} / 0% commission
                    </p>
                  </div>
                ) : null}

                <Button
                  onClick={() => handleRenewPayment()}
                  isLoading={renewing}
                  size="lg"
                  className="gap-2 shadow-soft"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isPending ? 'Activate Bakery' : 'Renew Subscription'}</span>
                </Button>
              </>
            ) : (
              <Button
                onClick={scrollToPlans}
                size="lg"
                className="gap-2 shadow-soft"
              >
                <ArrowDown className="w-4 h-4" />
                <span>Select a Plan Below</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div id="available-plans" className="flex items-center justify-between pt-4 scroll-mt-6">
        <div>
          <h2 className="font-serif font-bold text-lg text-owner-heading">Available Studio Plans</h2>
          <p className="text-xs text-owner-muted">Choose the scale that matches your kitchen volume</p>
        </div>

        <div className="inline-flex p-1 rounded-2xl bg-white border border-owner-border shadow-soft">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-brand-plum text-white shadow-soft'
                : 'text-owner-muted hover:text-owner-heading'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'yearly'
                ? 'bg-brand-plum text-white shadow-soft'
                : 'text-owner-muted hover:text-owner-heading'
            }`}
          >
            <span>Yearly</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-3xl border border-owner-border text-center text-xs text-owner-muted">
            No {billingCycle} subscription plans currently available.
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const isCurrentPlan = currentPlanId === plan.planId;
            let parsedFeatures: string[] = [];
            try {
              const raw = JSON.parse(plan.features);
              parsedFeatures = Array.isArray(raw) ? raw : [String(raw)];
            } catch {
              if (plan.features) {
                parsedFeatures = plan.features.split(',').map((s) => s.trim()).filter(Boolean);
              } else {
                parsedFeatures = [plan.description];
              }
            }

            return (
              <Card
                key={plan.planId}
                className={`p-6 flex flex-col justify-between transition-all ${
                  isCurrentPlan
                    ? 'border-2 border-brand-plum shadow-card ring-2 ring-brand-plum/10'
                    : 'hover:border-owner-border/80'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-plum">
                      {plan.name}
                    </span>
                    {isCurrentPlan && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold font-serif text-owner-heading">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold font-serif text-brand-espresso">
                        ₹{plan.price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-owner-muted">
                        /{plan.billingCycle}
                      </span>
                    </div>
                    <p className="text-[11px] text-owner-muted mt-1">{plan.description}</p>
                  </div>

                  <div className="space-y-2.5 pt-4 border-t border-owner-border/60">
                    {parsedFeatures.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-owner-heading">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-owner-border/60">
                  <Button
                    onClick={() => handleRenewPayment(plan.planId)}
                    isLoading={renewing}
                    className="w-full"
                    size="sm"
                    variant={isCurrentPlan ? 'primary' : 'outline'}
                  >
                    {isCurrentPlan
                      ? isPending
                        ? 'Activate Bakery'
                        : isExpired
                        ? 'Renew Subscription'
                        : 'Extend License'
                      : isNoPlan
                      ? 'Subscribe to This Plan'
                      : 'Switch to This Plan'}
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Billing & Payment History Section */}
      <div className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-owner-heading">Billing & Payment History</h2>
              <p className="text-xs text-owner-muted">
                Official platform license invoices, tax receipts, and payment transactions
              </p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          {loadingPayments ? (
            <div className="p-8 text-center text-xs text-owner-muted">
              Loading payment history...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-owner-canvas mx-auto flex items-center justify-center text-owner-muted">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-owner-heading">No payment records yet</p>
              <p className="text-xs text-owner-muted max-w-sm mx-auto">
                Once your license is renewed or upgraded, transaction details and GST tax invoices will be available here.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-owner-border bg-owner-canvas/40 text-owner-muted uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4">Invoice / ID</th>
                    <th className="py-3.5 px-4">Plan / Description</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-owner-border">
                  {payments.map((p) => {
                    const statusUpper = (p.status || '').toUpperCase();
                    const isCompleted = statusUpper === 'COMPLETED';
                    const isFailed = statusUpper === 'FAILED';
                    const dateStr = p.paidAt || p.createdAt;
                    const formattedDate = dateStr
                      ? new Date(dateStr).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';

                    return (
                      <tr key={p.id} className="hover:bg-owner-canvas/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-medium text-brand-espresso">
                            {p.providerPaymentId || `#PAY-${p.id}`}
                          </div>
                          {p.providerOrderId && (
                            <div className="text-[10px] text-owner-muted font-mono">{p.providerOrderId}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-owner-heading">
                            {p.subscriptionPlanName || 'Pro Baker Studio'}
                          </div>
                          <div className="text-[10px] text-owner-muted">Platform Commercial License</div>
                        </td>
                        <td className="py-3.5 px-4 text-owner-muted">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-owner-heading">
                            ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-owner-muted">{p.currency || 'INR'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isCompleted ? (
                            <Badge variant="success" size="sm">Completed</Badge>
                          ) : isFailed ? (
                            <Badge variant="error" size="sm">Failed</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">Pending</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {p.invoiceAvailable ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={downloadingInvoiceId === p.id}
                              onClick={() => handleDownloadInvoice(p.id)}
                              className="gap-1.5 text-brand-plum hover:bg-brand-blush/40"
                            >
                              <Download className={`w-3.5 h-3.5 ${downloadingInvoiceId === p.id ? 'animate-bounce' : ''}`} />
                              <span>{downloadingInvoiceId === p.id ? 'Downloading...' : 'PDF Invoice'}</span>
                            </Button>
                          ) : (
                            <span className="text-owner-muted text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {paymentTotalElements > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3.5 border-t border-owner-border bg-owner-canvas/30 text-xs gap-3">
                <p className="text-owner-muted text-xs">
                  Showing <strong className="text-owner-heading">{paymentTotalElements === 0 ? 0 : paymentPage * PAYMENT_PAGE_SIZE + 1}</strong> to{' '}
                  <strong className="text-owner-heading">{Math.min((paymentPage + 1) * PAYMENT_PAGE_SIZE, paymentTotalElements)}</strong> of{' '}
                  <strong className="text-owner-heading">{paymentTotalElements}</strong> records
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-owner-muted text-xs">
                    Page <strong className="text-owner-heading">{paymentPage + 1}</strong> of <strong className="text-owner-heading">{Math.max(paymentTotalPages, 1)}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paymentPage === 0 || loadingPayments}
                      onClick={() => setPaymentPage((p) => Math.max(0, p - 1))}
                      className="text-xs h-8 px-3"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paymentPage >= paymentTotalPages - 1 || loadingPayments}
                      onClick={() => setPaymentPage((p) => Math.min(Math.max(paymentTotalPages - 1, 0), p + 1))}
                      className="text-xs h-8 px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </Card>
      </div>

      {/* Subscription Cancellation Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (!cancelling) {
            setIsCancelModalOpen(false);
            setCancelError(null);
          }
        }}
        title="Cancel Subscription Renewal"
        description="Schedule your subscription for cancellation at the end of the current term."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <p className="font-semibold text-amber-950">What happens when you cancel:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>
                Your storefront, custom ordering, and owner tools remain <span className="font-semibold">fully active</span> until your current expiry date: <span className="font-semibold">{subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'End of billing cycle'}</span>.
              </li>
              <li>
                This records your intention <span className="font-semibold">not to renew</span>. It does not terminate access immediately.
              </li>
              <li>
                <span className="font-semibold">No immediate or electronic refund</span> is issued for the current paid period.
              </li>
              <li>
                You can extend or renew your plan at any time before or after expiry.
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cancel-reason" className="block text-xs font-semibold text-owner-heading">
              Reason for Cancellation <span className="font-normal text-owner-muted">(Optional, max 500 characters)</span>
            </label>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="Help us improve: tell us why you are choosing not to renew..."
              value={cancelReason}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setCancelReason(e.target.value);
                  if (cancelError) setCancelError(null);
                }
              }}
              error={cancelError || undefined}
              helperText={`${cancelReason.length}/500 characters`}
              disabled={cancelling}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-owner-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => {
                setIsCancelModalOpen(false);
                setCancelError(null);
              }}
            >
              Keep Subscription
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={cancelling}
              onClick={handleCancelSubscription}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
