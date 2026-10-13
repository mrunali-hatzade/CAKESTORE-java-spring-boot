'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Mail,
  Store,
  Users,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowRight,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Building2,
  RefreshCw,
  Activity,
  Calendar,
  Info,
} from 'lucide-react';
import { getPlatformStats, getAllShops, getRecentActivity } from '@/lib/api/admin';
import { DashboardStats, AdminShopSummary } from '@/types/admin';
import { communicationApi } from '@/lib/api/communication';
import { CommunicationSummary } from '@/types/communication';
import { adminSettingsApi, GlobalSettings } from '@/lib/api/adminSettings';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import AnalyticsCharts from '@/components/admin/AnalyticsCharts';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/common/Toast';
import { LoadingState } from '@/components/ui/LoadingState';

interface ActivityLogItem {
  id?: number;
  actorUserId?: number;
  shopId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number;
  metadata?: string;
  timestamp?: string;
}

const formatActionLabel = (action?: string): string => {
  if (!action) return 'Platform Event';
  const actionMap: Record<string, string> = {
    KYC_VERIFIED: 'KYC Approved',
    KYC_REJECTED: 'KYC Rejected',
    STATUS_CHANGE: 'Status Updated',
    SUBSCRIPTION_ACTIVATED: 'Subscription Activated',
    SUBSCRIPTION_EXPIRED: 'Subscription Expired',
    PAYMENT_COMPLETED: 'Payment Completed',
    ACCOUNT_DELETED: 'Account Deleted',
  };
  if (actionMap[action]) {
    return actionMap[action];
  }
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getEntityBadgeStyle = (entityType?: string): string => {
  const type = (entityType || '').toUpperCase();
  switch (type) {
    case 'SHOP':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'SUBSCRIPTION':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PAYMENT':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'USER':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const formatTimestamp = (rawTimestamp?: string): { relative: string; exact: string } | null => {
  if (!rawTimestamp) return null;
  const date = new Date(rawTimestamp);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let relative = '';
  if (diffInSeconds < 0 || diffInSeconds < 60) {
    relative = 'just now';
  } else if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    relative = `${mins}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    relative = `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    relative = `${days}d ago`;
  } else {
    relative = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  const exact = date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return { relative, exact };
};

const isValidShopId = (id: any): id is number => {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentShops, setRecentShops] = useState<AdminShopSummary[]>([]);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [activityError, setActivityError] = useState(false);
  const [commSummary, setCommSummary] = useState<CommunicationSummary | null>(null);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [dateRange, setDateRange] = useState<string>('All Time');
  const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({ start: undefined, end: undefined });
  const toast = useToast();

  const loadData = useCallback(async (isManual = false) => {
    if (isInitialLoading) {
      // Full mount loader
    } else {
      setIsFiltering(true);
    }

    try {
      const [statsData, shopsData, activityData, commData, settingsData] = await Promise.all([
        getPlatformStats(dateFilter.start, dateFilter.end),
        getAllShops(0, 5), // Only need top 5 for the dashboard
        getRecentActivity().catch((actErr) => {
          console.warn('Activity stream unavailable:', actErr);
          return null;
        }),
        communicationApi.getCommunicationSummary().catch((commErr) => {
          console.warn('Communication summary unavailable:', commErr);
          return null;
        }),
        adminSettingsApi.getSettings().catch((settErr) => {
          console.warn('Admin settings unavailable:', settErr);
          return null;
        }),
      ]);
      setStats(statsData);
      setRecentShops(shopsData.content || []);
      if (activityData !== null) {
        setActivities(activityData);
        setActivityError(false);
      } else {
        setActivityError(true);
      }
      setCommSummary(commData);
      setSettings(settingsData);
    } catch (err: any) {
      console.warn('Failed to load admin stats:', err);
      toast.error(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setIsInitialLoading(false);
      setIsFiltering(false);
    }
  }, [toast, dateFilter.start, dateFilter.end, isInitialLoading]);

  const gatewayAlert = useMemo(() => {
    if (!settings) return null;

    const hasKeyId = Boolean(settings.razorpayKeyId && settings.razorpayKeyId.trim() !== '');
    const hasKeySecret = Boolean(settings.razorpayKeySecretConfigured);
    const hasWebhookSecret = Boolean(settings.razorpayWebhookSecretConfigured);

    const isApiMissing = !hasKeyId || !hasKeySecret;
    const isWebhookMissing = !hasWebhookSecret;

    if (!isApiMissing && !isWebhookMissing) {
      return null;
    }

    if (isApiMissing && isWebhookMissing) {
      return {
        title: 'Payment Gateway Configuration Incomplete',
        description: 'Razorpay API credentials and Webhook Secret are not configured. Customer checkouts and automated payment reconciliation cannot process.',
        actionLabel: 'Configure Gateway',
      };
    }

    if (isApiMissing) {
      return {
        title: 'Payment Gateway API Keys Incomplete',
        description: 'Razorpay API Key or Secret is not configured. Online customer checkouts and subscription billing cannot process.',
        actionLabel: 'Configure Credentials',
      };
    }

    return {
      title: 'Payment Webhook Secret Incomplete',
      description: 'Razorpay Webhook Secret is not configured. Real-time payment verification and automated order updates may be delayed.',
      actionLabel: 'Configure Webhook',
    };
  }, [settings]);

  useEffect(() => {
    loadData();

    const handleRefresh = () => {
      loadData(true);
    };

    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [loadData]);

  if (isInitialLoading) {
    return <LoadingState message="Loading platform intelligence..." />;
  }

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const range = e.target.value;
    setDateRange(range);
    
    const today = new Date();
    
    let start: string | undefined = undefined;
    let end: string | undefined = undefined;

    if (range === 'Last 7 Days') {
      const d = new Date(today);
      d.setDate(today.getDate() - 7);
      start = formatLocalDate(d);
      end = formatLocalDate(today);
    } else if (range === 'Last 30 Days') {
      const d = new Date(today);
      d.setDate(today.getDate() - 30);
      start = formatLocalDate(d);
      end = formatLocalDate(today);
    } else if (range === 'This Month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      start = formatLocalDate(d);
      end = formatLocalDate(today);
    } else if (range === 'This Year') {
      const d = new Date(today.getFullYear(), 0, 1);
      start = formatLocalDate(d);
      end = formatLocalDate(today);
    }

    setDateFilter({ start, end });
  };

  const formatCurrency = (val?: number) => {
    return `₹${(val || 0).toLocaleString('en-IN')}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ACTIVE • STORE LIVE
        </span>
      );
    }
    if (s === 'PENDING' || s === 'PENDING_APPROVAL') return <Badge variant="warning" size="sm">Pending Approval</Badge>;
    if (s === 'SUSPENDED') return <Badge variant="error" size="sm">Suspended</Badge>;
    return <Badge variant="default" size="sm">{status}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Admin Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Dashboard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-tenant health, GMV volume, and bakery compliance status
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {isFiltering && (
            <span className="text-xs text-indigo-600 flex items-center gap-1.5 animate-pulse font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Updating...</span>
            </span>
          )}
          <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-2xs hover:border-slate-300 focus-within:ring-2 focus-within:ring-brand-plum/20 focus-within:border-brand-plum transition-all">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={dateRange}
              onChange={handleDateRangeChange}
              disabled={isFiltering}
              aria-label="Filter analytics by date period"
              className="text-xs sm:text-sm font-medium text-slate-700 bg-transparent border-0 focus:outline-hidden focus:ring-0 cursor-pointer disabled:opacity-60 pr-2"
            >
              <option value="All Time">All Time</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Unified Action Center (Side-by-Side Responsive Grid) */}
      {(gatewayAlert || (stats?.pendingBakeries ?? 0) > 0) && (
        <div className={`grid grid-cols-1 ${gatewayAlert && (stats?.pendingBakeries ?? 0) > 0 ? 'md:grid-cols-2' : ''} gap-4`}>
          {/* Payment Gateway Configuration Alert Banner */}
          {gatewayAlert && (
            <div className="bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-orange-50/30 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-soft hover:shadow-card transition-shadow">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-amber-950">
                      {gatewayAlert.title}
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Config Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                    {gatewayAlert.description}
                  </p>
                </div>
              </div>
              <div className="self-end pt-1">
                <Link href="/admin/settings" className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg inline-block">
                  <Button variant="primary" size="sm" className="whitespace-nowrap text-xs bg-amber-600 hover:bg-amber-700 border-amber-700 text-white shadow-xs">
                    {gatewayAlert.actionLabel}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Pending Approval Action Alert Banner */}
          {(stats?.pendingBakeries ?? 0) > 0 && (
            <div className="bg-gradient-to-br from-orange-50/90 via-amber-50/50 to-orange-100/30 border border-orange-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-soft hover:shadow-card transition-shadow">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      {stats?.pendingBakeries} {stats?.pendingBakeries === 1 ? 'Bakery' : 'Bakeries'} Awaiting Verification
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    New bakery registrations require administrative verification and compliance review.
                  </p>
                </div>
              </div>
              <div className="self-end pt-1">
                <Link href="/admin/shops?status=PENDING" className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg inline-block">
                  <Button variant="primary" size="sm" className="whitespace-nowrap text-xs bg-orange-600 hover:bg-orange-700 border-orange-700 text-white shadow-xs">
                    Review Applications
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balanced 4-Card Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Registered Users */}
        <Card className="p-6 border-slate-200/80 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Registered Users
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-serif text-slate-900 mt-2.5 tabular-nums">
              {stats?.totalUsers ?? ((stats?.totalAdmins ?? 0) + (stats?.totalShopOwners ?? 0) + (stats?.totalCustomers ?? 0))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 text-xs">
            <span className="text-indigo-600 font-medium">
              {stats?.totalAdmins ?? 0} Admins
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-medium">
              {stats?.totalShopOwners ?? 0} Owners
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-600 font-medium">
              {stats?.totalCustomers ?? 0} Customers
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 font-medium">
              {stats?.deletedAccounts ?? 0} deleted
            </span>
          </div>
        </Card>

        {/* Card 2: Registered Bakeries */}
        <Card className="p-6 border-slate-200/80 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Registered Bakeries
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-serif text-slate-900 mt-2.5 tabular-nums">
              {stats?.totalRegisteredBakeries ?? 0}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 text-xs">
            <span className="text-emerald-700 font-medium">{stats?.activeBakeries ?? 0} active</span>
            <span className="text-slate-300">•</span>
            <Link
              href="/admin/shops?status=PENDING"
              className="text-amber-700 font-medium hover:underline hover:text-amber-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xs transition-colors inline-flex items-center"
              title="Filter bakeries pending approval"
            >
              {stats?.pendingBakeries ?? 0} pending
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-rose-700 font-medium">{stats?.suspendedBakeries ?? 0} suspended</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">{stats?.inactiveBakeries ?? 0} inactive</span>
            <span className="text-slate-300">•</span>
            <Link
              href="/admin/shops?status=DELETED"
              className="text-slate-400 font-medium hover:underline hover:text-slate-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 rounded-xs transition-colors inline-flex items-center"
              title="Filter deleted bakeries"
            >
              {stats?.deletedBakeries ?? 0} deleted
            </Link>
          </div>
        </Card>

        {/* Card 3: Bakery Plans & Subscriptions */}
        <Card className="p-6 border-slate-200/80 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Bakery Plans & Subscriptions
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Total Subscription Records
                  </span>
                  <div className="relative group inline-flex items-center">
                    <button
                      type="button"
                      aria-label="Subscription count explanation"
                      className="text-slate-400 hover:text-slate-600 focus:text-slate-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-plum/40 rounded-full cursor-help transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <div
                      role="tooltip"
                      className="absolute bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-1.5 hidden group-hover:block group-focus-within:block w-56 sm:w-64 p-2.5 bg-slate-900/95 text-white text-[11px] leading-relaxed rounded-lg shadow-xl backdrop-blur-xs z-50 pointer-events-none transition-opacity"
                    >
                      Total Subscription Records counts all subscription entries, including historical records. The status figures below count distinct bakeries and may not add up to the total.
                      <div className="absolute top-full left-4 sm:left-1/2 sm:-translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-serif text-slate-900 mt-2.5 tabular-nums">
              {stats?.totalSubscriptions ?? 0}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 text-xs">
            <span className="text-emerald-700 font-medium">
              {stats?.activeSubscribedBakeries ?? 0} active
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-600 font-medium">
              {stats?.expiredSubscribedBakeries ?? 0} expired
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600 font-medium">
              {stats?.pendingPaymentBakeries ?? 0} pending
            </span>
            {(stats?.gracePeriodSubscribedBakeries ?? 0) > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                  {stats?.gracePeriodSubscribedBakeries} grace
                </span>
              </>
            )}
            {(stats?.expiringSoonSubscribedBakeries ?? 0) > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800">
                  {stats?.expiringSoonSubscribedBakeries} expiring
                </span>
              </>
            )}
            {(stats?.suspendedSubscribedBakeries ?? 0) > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-rose-700 font-medium">
                  {stats?.suspendedSubscribedBakeries} suspended
                </span>
              </>
            )}
            {(stats?.cancelledSubscribedBakeries ?? 0) > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">
                  {stats?.cancelledSubscribedBakeries} cancelled
                </span>
              </>
            )}
          </div>
        </Card>

        {/* Card 4: Subscription Revenue (Financials) */}
        <Card className="p-6 border-slate-200/80 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Subscription Revenue
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  SaaS Subscription Fees
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            
            <p className="text-2xl sm:text-3xl font-bold font-serif text-emerald-700 mt-2.5 tabular-nums">
              {formatCurrency(stats?.periodPlatformRevenue ?? stats?.monthlyPlatformRevenue)}
            </p>
            <p className="text-[11px] text-emerald-600/80 font-medium mt-0.5">
              {dateRange === 'All Time'
                ? 'Lifetime billed subscription revenue'
                : `${formatCurrency(stats?.totalPlatformRevenue)} lifetime billed`}
            </p>
          </div>

          {/* Embedded Bakery Sales Callout (Clearly segregated from platform revenue) */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/90 rounded-xl px-3 py-2">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                Bakery Sales
              </span>
              <span className="text-[10px] text-slate-400">
                0% platform fee
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold font-serif text-slate-800 tabular-nums block">
                {formatCurrency(stats?.periodGmv ?? stats?.monthlyGmv)}
              </span>
              <span className="text-[10px] text-slate-400">
                {dateRange === 'All Time' ? 'Processed' : `${formatCurrency(stats?.totalGmv)} lifetime`}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <AnalyticsCharts />

      {/* Platform Operations: Quick Actions & Communications */}
      <div className="space-y-5">
        {/* Quick Administration Modules Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <Link href="/admin/shops" className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl">
            <Card className="p-5 border-slate-200/90 hover:border-indigo-300 hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between h-full">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Manage Bakeries
                  </h4>
                  <p className="text-xs text-slate-500">Approve, reject, or audit bakeries</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
            </Card>
          </Link>

          <Link href="/admin/plans" className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500 rounded-2xl">
            <Card className="p-5 border-slate-200/90 hover:border-purple-300 hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between h-full">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                    Manage Plans & Pricing
                  </h4>
                  <p className="text-xs text-slate-500">Configure tiers, pricing & quotas</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all shrink-0" />
            </Card>
          </Link>

          <Link href="/admin/messages" className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl">
            <Card className="p-5 border-slate-200/90 hover:border-blue-300 hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between h-full">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Announcements
                  </h4>
                  <p className="text-xs text-slate-500">Dispatch alerts & announcements</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
            </Card>
          </Link>
        </div>

        {/* Operational Communication Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <Card className="p-4 sm:p-5 border-slate-200/90 bg-gradient-to-br from-white via-white to-indigo-50/20 shadow-soft hover:shadow-card transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900">Feedback & Reviews</h4>
                    {commSummary === null ? (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Unavailable
                      </span>
                    ) : commSummary.unreadFeedbackCount > 0 ? (
                      <Badge variant="warning" size="sm" className="text-[10px] px-2 py-0.5 font-semibold">
                        {commSummary.unreadFeedbackCount} Unread
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        All resolved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Suggestions & reviews from bakery owners
                  </p>
                </div>
              </div>
              <Link href="/admin/feedback" className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg shrink-0">
                <Button variant="outline" size="sm" className="text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-2.5">
                  <span>View</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 border-slate-200/90 bg-gradient-to-br from-white via-white to-blue-50/20 shadow-soft hover:shadow-card transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900">Customer Enquiries</h4>
                    {commSummary === null ? (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Unavailable
                      </span>
                    ) : commSummary.unreadEnquiriesCount > 0 ? (
                      <Badge variant="warning" size="sm" className="text-[10px] px-2 py-0.5 font-semibold">
                        {commSummary.unreadEnquiriesCount} Unread
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        All resolved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Visitor messages from public contact forms
                  </p>
                </div>
              </div>
              <Link href="/admin/enquiries" className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg shrink-0">
                <Button variant="outline" size="sm" className="text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 px-2.5">
                  <span>View</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Full-Width Section: Recently Registered Bakeries Table */}
      <Card className="p-6 border-slate-200/80 shadow-soft w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-serif font-bold text-lg text-slate-900">
              Recently Registered Bakeries
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest tenants requesting access to the CakeStore marketplace
            </p>
          </div>
          <Link href="/admin/shops" className="self-start sm:self-auto focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 hover:bg-slate-50">
              <span>View All Bakeries</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-xl">Bakery</th>
                <th className="py-3 px-4">Owner / Contact</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentShops.map((shop) => (
                <tr key={shop.shopId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {shop.businessName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{shop.businessName}</p>
                        <p className="text-[11px] text-slate-400">ID #{shop.shopId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-slate-800">{shop.ownerName || '—'}</p>
                    <p className="text-[11px] text-slate-400" title={shop.ownerEmail || undefined}>{shop.ownerEmail || '—'}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {shop.registeredAt
                      ? new Date(shop.registeredAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(shop.shopStatus)}
                      {shop.subscriptionStatus === 'ACTIVE' && (
                         <Badge variant="default" size="sm" className="bg-indigo-50 text-indigo-700 border-indigo-200 whitespace-nowrap">Sub: Active</Badge>
                      )}
                      {shop.subscriptionStatus === 'EXPIRED' && (
                         <Badge variant="error" size="sm" className="bg-rose-50 text-rose-700 border-rose-200 whitespace-nowrap">Sub: Expired</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/shop/${shop.shopId}`} target="_blank" rel="noopener noreferrer" className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
                        <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-indigo-600 gap-1 px-2.5">
                          <Store className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Storefront</span>
                        </Button>
                      </Link>
                      <Link href={`/admin/shops/${shop.shopId}`} className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
                        <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold text-xs px-2.5">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Full-Width Section: Recent Platform Activity (Below Bakery Table) */}
      <Card className="p-6 border-slate-200/80 shadow-soft w-full">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Recent Platform Activity
          </span>
          {activities.length > 0 && !activityError && (
            <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
              {activities.length} {activities.length === 1 ? 'event' : 'events'}
            </span>
          )}
        </h3>

        {activityError ? (
          <div className="py-8 text-center text-slate-400">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">Activity stream unavailable</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Could not retrieve recent event records</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">No recent platform events recorded</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Audit events will appear here as activity occurs</p>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 divide-y divide-slate-100">
            {activities.map((log, index) => {
              const timeInfo = formatTimestamp(log.timestamp);
              return (
                <div
                  key={log.id ? `act-${log.id}` : `act-${index}`}
                  className="pt-3 first:pt-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-800">
                          {formatActionLabel(log.action)}
                        </p>
                        {log.entityType && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getEntityBadgeStyle(
                              log.entityType
                            )}`}
                          >
                            {log.entityType}
                          </span>
                        )}
                      </div>
                      {log.metadata && (
                        <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                          {log.metadata}
                        </p>
                      )}
                      {isValidShopId(log.shopId) && (
                        <Link
                          href={`/admin/shops/${log.shopId}`}
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xs inline-flex items-center gap-1 transition-colors mt-1"
                        >
                          <span>View Shop #{log.shopId}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                    {timeInfo && (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-medium text-slate-500 block" title={timeInfo.exact}>
                          {timeInfo.relative}
                        </span>
                        <span className="text-[9px] text-slate-400 block" title={timeInfo.exact}>
                          {timeInfo.exact.split(',')[1]?.trim() || timeInfo.exact}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
