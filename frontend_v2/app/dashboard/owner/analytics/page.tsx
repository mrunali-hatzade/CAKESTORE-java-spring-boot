'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  TrendingUp,
  ShoppingBag,
  Award,
  PieChart,
  BarChart3,
  Calendar,
  Sparkles,
  AlertCircle,
  Tag,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Percent,
  Cake,
  Banknote,
} from 'lucide-react';
import Link from 'next/link';
import { ownerApi } from '@/lib/api/owner';
import { DashboardAnalytics, DailySalesDataPoint } from '@/types/owner';
import { useOwner } from '@/context/OwnerContext';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';

type AnalyticsRange = '7d' | '30d' | 'this_month';

export default function OwnerAnalyticsPage() {
  const { registerRefreshHandler } = useOwner();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ensure page always starts at top scroll position
  useEffect(() => {
    const mainElem = document.querySelector('main');
    if (mainElem) {
      mainElem.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [range]);

  const loadData = useCallback(
    async (selectedRange: AnalyticsRange = range, isManual = false) => {
      if (!isManual) setLoading(true);
      setError(null);

      try {
        const data = await ownerApi.getAnalytics(selectedRange);
        setAnalytics(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load bakery performance analytics');
      } finally {
        setLoading(false);
      }
    },
    [range]
  );

  useEffect(() => {
    loadData(range);
  }, [range, loadData]);

  useEffect(() => {
    const unregister = registerRefreshHandler(async () => {
      await loadData(range, true);
    });
    return unregister;
  }, [registerRefreshHandler, loadData, range]);

  if (loading) return <LoadingState message="Calculating bakery velocity & demand performance..." />;

  // Metrics from API
  const totalGrossSales = analytics?.totalGrossSales ?? analytics?.totalRevenue ?? 0;
  const totalOrders = analytics?.totalOrders ?? 0;
  const completedOrders = analytics?.completedOrders ?? 0;
  const inProgressOrders = analytics?.inProgressOrders ?? 0;
  const cancelledOrders = analytics?.cancelledOrders ?? 0;
  const cancellationRate = analytics?.cancellationRate ?? 0;
  const aov = analytics?.averageOrderValue ?? (totalOrders > 0 ? Math.round(totalGrossSales / totalOrders) : 0);

  // Dedicated COD Cash Flow & Doorstep Settlement Metrics
  const pendingCodAmount = analytics?.pendingCodAmount ?? analytics?.codSettlement?.pendingAmount ?? 0;
  const pendingCodOrders = analytics?.pendingCodOrders ?? analytics?.codSettlement?.pendingOrders ?? 0;
  const collectedCodAmount = analytics?.collectedCodAmount ?? analytics?.codSettlement?.collectedAmount ?? 0;
  const collectedCodOrders = analytics?.collectedCodOrders ?? analytics?.codSettlement?.collectedOrders ?? 0;
  const onlineCollectedAmount = analytics?.onlineCollectedAmount ?? analytics?.codSettlement?.onlineCollectedAmount ?? 0;
  const onlineOrders = analytics?.onlineOrders ?? analytics?.codSettlement?.onlineOrders ?? 0;
  const collectedRevenue = analytics?.collectedRevenue ?? analytics?.realizedRevenue ?? (collectedCodAmount + onlineCollectedAmount);

  const periodRevenue = analytics?.periodRevenue ?? 0;
  const periodOrders = analytics?.periodOrders ?? 0;
  const periodDailyAverage = analytics?.periodDailyAverage ?? 0;
  const peakDay = analytics?.peakDay;
  const peakAmount = analytics?.peakAmount ?? 0;

  // Chronological Daily Data
  const dailyData: DailySalesDataPoint[] = analytics?.dailyData || [];
  const maxDayRevenue = Math.max(...dailyData.map((d) => d.revenue), 100);

  // Payment Breakdown
  const paymentBreakdown = analytics?.paymentBreakdown || [];

  // Top Products
  const topProducts = analytics?.topProductsDetails || [];
  const totalTopUnits = topProducts.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="space-y-5 max-w-7xl pb-8">
      {/* Header Banner & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-owner-border shadow-soft">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-blush text-brand-plum text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Storefront Sales & Fulfillment Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-owner-heading tracking-tight">
            Bakery Analytics
          </h1>
          <p className="text-xs text-owner-muted">
            Track daily gross sales velocity, customer order demand, and your most popular artisanal cakes
          </p>
        </div>

        {/* Range Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-brand-cream/60 p-1.5 rounded-2xl border border-owner-border/60 self-start sm:self-auto shrink-0">
          {(
            [
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: 'this_month', label: 'This Month' },
            ] as const
          ).map((tab) => {
            const isSelected = range === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setRange(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-brand-plum text-white shadow-sm'
                    : 'text-owner-muted hover:text-brand-plum hover:bg-brand-cream'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Gross Sales Demand */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-owner-muted">Total Gross Demand</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-serif text-owner-heading mt-2">
              ₹{Number(totalGrossSales).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="pt-2 border-t border-owner-border/50 mt-3 text-[11px] flex items-center justify-between">
            <span className="text-amber-800 font-semibold">₹{Number(pendingCodAmount).toLocaleString('en-IN')} COD pending</span>
            <span className="text-owner-muted">₹{Number(periodRevenue).toLocaleString('en-IN')} window</span>
          </div>
        </Card>

        {/* Total Customer Orders */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-owner-muted">Customer Orders</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-serif text-owner-heading mt-2">{totalOrders} orders</p>
          </div>
          <div className="pt-2 border-t border-owner-border/50 mt-3 text-[11px] text-owner-muted flex items-center justify-between">
            <span className="text-emerald-700 font-semibold">{completedOrders} fulfilled</span>
            <span className="text-brand-plum font-semibold">{inProgressOrders} active</span>
          </div>
        </Card>

        {/* Average Order Value (AOV) */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-owner-muted">Avg. Order Value</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-serif text-owner-heading mt-2">
              ₹{Math.round(Number(aov)).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="pt-2 border-t border-owner-border/50 mt-3 text-[11px] text-purple-600 font-semibold">
            Per celebration basket
          </div>
        </Card>

        {/* Peak Ordering Day */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-owner-muted">Peak Ordering Day</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-serif text-owner-heading mt-2 truncate">
              {peakDay ? peakDay : 'No Orders Yet'}
            </p>
          </div>
          <div className="pt-2 border-t border-owner-border/50 mt-3 text-[11px] text-amber-700 font-semibold">
            {peakAmount > 0 ? `₹${Number(peakAmount).toLocaleString('en-IN')} peak day` : 'Zero orders in period'}
          </div>
        </Card>

        {/* Realized / Collected Revenue */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-owner-muted">Collected Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-serif text-teal-800 mt-2">
              ₹{Number(collectedRevenue).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="pt-2 border-t border-owner-border/50 mt-3 text-[10px] text-owner-muted flex items-center justify-between">
            <span className="font-semibold text-emerald-700">₹{Number(collectedCodAmount).toLocaleString('en-IN')} COD</span>
            <span className="font-semibold text-brand-plum">+ ₹{Number(onlineCollectedAmount).toLocaleString('en-IN')} Online</span>
          </div>
        </Card>
      </div>

      {/* Main Grid: Chronological Sales Velocity & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left 8 Cols: Chronological Sales Velocity Bar Chart */}
        <Card className="lg:col-span-8 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-base text-owner-heading flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-plum" />
                  Chronological Sales Velocity
                </h3>
                <p className="text-xs text-owner-muted mt-0.5">
                  Daily customer order volume & gross sales leading up to today
                </p>
              </div>
              <span className="text-xs font-semibold text-brand-plum bg-brand-blush px-3 py-1 rounded-full border border-brand-blush-border">
                {range === '7d' ? '7-Day Demand' : range === '30d' ? '30-Day Demand' : 'Month to Date'}
              </span>
            </div>

            {/* Bars Container */}
            <div className="h-64 flex items-end justify-between gap-1.5 sm:gap-3 pt-6 pb-2 border-b border-owner-border overflow-x-auto scrollbar-none">
              {dailyData.map((d) => {
                const amount = Number(d.revenue || 0);
                const heightPercent = maxDayRevenue > 0 ? Math.max(Math.round((amount / maxDayRevenue) * 100), 8) : 8;
                const isPeak = amount > 0 && amount === peakAmount;

                return (
                  <div key={d.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-1.5 group h-full justify-end relative">
                    {/* Value Pill Above Bar */}
                    {amount > 0 ? (
                      <div className="text-center mb-0.5 animate-fadeIn">
                        <span className="text-[10px] font-bold text-owner-heading bg-brand-cream/80 px-1.5 py-0.5 rounded border border-owner-border block whitespace-nowrap shadow-2xs">
                          ₹{amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
                        </span>
                        <span className="text-[9px] font-semibold text-brand-plum block">
                          {d.orderCount} ord
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-owner-muted/40 font-medium">0</span>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[44px] rounded-t-xl transition-all duration-500 group-hover:brightness-110 shadow-2xs ${
                        d.isToday
                          ? 'bg-gradient-to-t from-brand-plum to-purple-600 border-t-2 border-purple-400'
                          : isPeak
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-500'
                          : amount > 0
                          ? 'bg-gradient-to-t from-brand-plum/80 to-brand-plum/60'
                          : 'bg-gradient-to-t from-slate-200 to-slate-100'
                      }`}
                    />

                    {/* Day / Date Label */}
                    <div className="text-center mt-1">
                      <span
                        className={`text-[10px] font-bold block truncate ${
                          d.isToday
                            ? 'text-brand-plum bg-brand-blush px-1.5 py-0.5 rounded-full'
                            : 'text-owner-muted'
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs text-owner-muted mt-4 pt-2">
            <div>
              <span className="text-[11px] block">Period Total:</span>
              <strong className="text-owner-heading text-sm font-serif">₹{Number(periodRevenue).toLocaleString('en-IN')}</strong>
              <span className="text-[10px] text-owner-muted block">({periodOrders} orders in window)</span>
            </div>
            <div className="text-center">
              <span className="text-[11px] block">Daily Average:</span>
              <strong className="text-owner-heading text-sm font-serif">₹{Math.round(Number(periodDailyAverage)).toLocaleString('en-IN')} / day</strong>
              <span className="text-[10px] text-owner-muted block">Based on {dailyData.length} days</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] block">Peak Day:</span>
              <strong className="text-brand-plum text-sm font-serif">
                {peakAmount > 0 ? `₹${Number(peakAmount).toLocaleString('en-IN')}` : '₹0'}
              </strong>
              <span className="text-[10px] text-owner-muted block">{peakDay || 'None'}</span>
            </div>
          </div>
        </Card>

        {/* Right 4 Cols: COD Cash Flow Settlement & Fulfillment Health */}
        <div className="lg:col-span-4 space-y-5 sm:space-y-6 flex flex-col justify-between">
          {/* Dedicated COD Cash Flow Tracker Card */}
          <Card className="p-5 sm:p-6 border border-owner-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-owner-heading flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  COD Cash Flow Tracker
                </h3>
                <p className="text-xs text-owner-muted mt-0.5">Cash on Delivery doorstep reconciliation</p>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {pendingCodOrders} Pending
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Pending COD Box */}
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Pending Doorstep Cash
                  </span>
                  <span className="text-xs font-bold text-amber-950">
                    ₹{Number(pendingCodAmount).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[10px] text-amber-800/90 leading-tight">
                  {pendingCodOrders} order{pendingCodOrders === 1 ? '' : 's'} awaiting collection. <strong className="font-semibold text-amber-950">Excluded from Collected Revenue</strong> until marked Paid.
                </p>
              </div>

              {/* Collected COD Box */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Collected & Verified COD
                  </span>
                  <span className="text-xs font-bold text-emerald-950">
                    ₹{Number(collectedCodAmount).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800/90 leading-tight">
                  {collectedCodOrders} order{collectedCodOrders === 1 ? '' : 's'} verified in hand. <strong className="font-semibold text-emerald-950">Added to Collected Revenue.</strong>
                </p>
              </div>

              {/* Online Prepaid Box */}
              <div className="p-3 rounded-2xl bg-brand-cream/50 border border-owner-border/70">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-brand-plum flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-brand-plum" />
                    Prepaid Online / UPI
                  </span>
                  <span className="text-xs font-bold text-brand-plum">
                    ₹{Number(onlineCollectedAmount).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[10px] text-owner-muted leading-tight">
                  {onlineOrders} order{onlineOrders === 1 ? '' : 's'} settled upfront. <strong className="font-semibold text-brand-plum">Added to Collected Revenue.</strong>
                </p>
              </div>
            </div>

            {/* Quick Link to Orders */}
            <div className="mt-3.5 pt-3 border-t border-owner-border/60">
              <Link
                href="/dashboard/owner/orders"
                className="text-xs font-semibold text-brand-plum hover:text-purple-900 flex items-center justify-between group transition-colors"
              >
                <span>Manage & verify COD in Orders</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Quick Stats: Fulfillment Summary */}
          <Card className="p-5 sm:p-6 bg-brand-cream/30 border border-owner-border/70">
            <h4 className="text-xs font-bold text-brand-plum uppercase tracking-wider mb-3">
              Order Fulfillment Pipeline
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-owner-muted flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Completed / Handed Over:
                </span>
                <strong className="text-owner-heading font-bold">{completedOrders} orders</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-owner-muted flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Active / In Preparation:
                </span>
                <strong className="text-brand-plum font-bold">{inProgressOrders} orders</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-owner-muted flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  Cancelled:
                </span>
                <strong className="text-owner-heading font-medium">{cancelledOrders} orders</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Grid: Top Bestselling Cakes & Coupon ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left 7 Cols: Top Bestselling Cakes with Photos */}
        <Card className="lg:col-span-7 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-serif font-bold text-base text-owner-heading flex items-center gap-2">
                <PieChart className="w-4 h-4 text-brand-plum" />
                Top Bestselling Artisanal Cakes
              </h3>
              <p className="text-xs text-owner-muted mt-0.5">Most in-demand celebration cakes by volume</p>
            </div>
            <Award className="w-5 h-5 text-amber-500" />
          </div>

          {topProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-owner-muted italic">
              No sales distribution recorded for specific cakes yet.
            </div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3.5 p-3 rounded-2xl bg-brand-cream/30 border border-owner-border/50">
                  {/* Photo or Fallback Cake Icon */}
                  <div className="w-12 h-12 rounded-xl bg-white border border-owner-border overflow-hidden shrink-0 flex items-center justify-center relative">
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        fill
                        sizes="48px"
                        unoptimized
                        className="object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Cake className="w-6 h-6 text-brand-plum/60" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 rounded-full bg-brand-blush text-brand-plum flex items-center justify-center text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-owner-heading truncate">{p.name}</h4>
                      </div>
                      <span className="text-xs font-bold text-owner-heading shrink-0">
                        ₹{Number(p.revenue).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-owner-border/40">
                      <div
                        style={{ width: `${p.sharePercentage}%` }}
                        className="h-full bg-gradient-to-r from-brand-plum to-purple-600 rounded-full"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-owner-muted mt-1">
                      <span>{p.quantity} cake{p.quantity === 1 ? '' : 's'} sold</span>
                      <span>{p.sharePercentage}% volume share</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right 5 Cols: Coupon & Promotional ROI Section */}
        <Card className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-base text-owner-heading flex items-center gap-2">
                  <Tag className="w-4 h-4 text-brand-plum" />
                  Promotions & Coupon ROI
                </h3>
                <p className="text-xs text-owner-muted mt-0.5">Marketing conversion impact from discount vouchers</p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {analytics?.activeCoupons ?? 0} Live
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-brand-cream/40 border border-owner-border/70">
                <span className="text-[11px] text-owner-muted font-medium block">All-Time Coupons</span>
                <p className="text-xl font-bold font-serif text-owner-heading mt-1">
                  {analytics?.totalCoupons ?? 0}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-brand-cream/40 border border-owner-border/70">
                <span className="text-[11px] text-owner-muted font-medium block">Active Promotions</span>
                <p className="text-xl font-bold font-serif text-emerald-700 mt-1">
                  {analytics?.activeCoupons ?? 0}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-brand-cream/40 border border-owner-border/70">
                <span className="text-[11px] text-owner-muted font-medium block">Orders with Coupons</span>
                <p className="text-xl font-bold font-serif text-brand-plum mt-1">
                  {analytics?.totalCouponOrders ?? 0}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-brand-cream/40 border border-owner-border/70">
                <span className="text-[11px] text-owner-muted font-medium block">Discounts Granted</span>
                <p className="text-xl font-bold font-serif text-owner-heading mt-1">
                  ₹{Number(analytics?.totalDiscountGranted ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <span className="font-semibold">Coupon Checkout Utilization:</span>
            <span className="font-bold">{analytics?.couponUtilizationRate ?? 0}%</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
