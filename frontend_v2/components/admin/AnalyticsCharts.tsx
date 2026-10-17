'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { getRevenueAnalytics } from '@/lib/api/admin';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

interface RevenueDataPoint {
  month: string;
  fullMonth?: string;
  amount: number;
}

interface AnalyticsData {
  saasRevenue: RevenueDataPoint[];
  networkGmv: RevenueDataPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  metricLabel: string;
  valueColor: string;
}

const formatIndianCurrency = (val: number = 0): string => {
  return `₹${val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  metricLabel,
  valueColor,
}) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const amount = Number(payload[0]?.value ?? dataPoint?.amount ?? 0);
  const displayMonth = dataPoint?.fullMonth || label || 'Month';

  return (
    <div className="bg-white/95 backdrop-blur-xs px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-200/90 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{displayMonth}</p>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{metricLabel}:</span>
        <span className="font-bold text-slate-900" style={{ color: valueColor }}>
          {formatIndianCurrency(amount)}
        </span>
      </div>
    </div>
  );
};

export default function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRevenueAnalytics();
      setData(res);
    } catch (err: any) {
      console.warn('Failed to fetch analytics:', err);
      setError(err?.message || 'Unable to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Register with shared AdminRefreshContext so header Refresh button awaits chart data
  useRegisterAdminRefresh(fetchAnalytics);

  useEffect(() => {
    fetchAnalytics();

    const handleRefresh = () => {
      fetchAnalytics();
    };

    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [fetchAnalytics]);

  const saasTotal = useMemo(() => {
    if (!data?.saasRevenue) return 0;
    return data.saasRevenue.reduce((sum, pt) => sum + (Number(pt.amount) || 0), 0);
  }, [data?.saasRevenue]);

  const gmvTotal = useMemo(() => {
    if (!data?.networkGmv) return 0;
    return data.networkGmv.reduce((sum, pt) => sum + (Number(pt.amount) || 0), 0);
  }, [data?.networkGmv]);

  if (loading) {
    return (
      <div className="space-y-4 my-8">
        <div className="h-10 w-72 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 border-slate-200/80 shadow-soft flex items-center justify-center min-h-[360px]">
            <LoadingState message="Loading SaaS Revenue..." />
          </Card>
          <Card className="p-6 border-slate-200/80 shadow-soft flex items-center justify-center min-h-[360px]">
            <LoadingState message="Loading Network GMV..." />
          </Card>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4 my-8">
        <Card className="p-8 border-slate-200/80 shadow-soft flex flex-col items-center justify-center min-h-[300px] text-center">
          <AlertCircle className="w-9 h-9 text-amber-500 mb-2.5" />
          <h4 className="text-base font-bold text-slate-800">Revenue Analytics Unavailable</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Could not retrieve 6-month financial trend series. You can retry the request without reloading the entire dashboard.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            className="mt-4 gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading Analytics</span>
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 my-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900">
            Revenue & Sales Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            6-month trajectory of recurring SaaS subscriptions vs. distributed bakery retail order volume
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-[11px] font-semibold text-slate-700 self-start sm:self-auto shrink-0 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>0% Platform Commission Model</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Subscription Revenue Trend */}
        <Card className="p-6 border-slate-200/80 shadow-soft hover:shadow-card transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="font-serif font-bold text-lg text-slate-900">Subscription Revenue Trend</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Realized platform subscription payments from bakeries
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                6-Month Total
              </span>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">
                {formatIndianCurrency(saasTotal)}
              </span>
            </div>
          </div>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.saasRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip content={<CustomChartTooltip metricLabel="Subscription Revenue" valueColor="#059669" />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Card 2: Bakery Sales Trend */}
        <Card className="p-6 border-slate-200/80 shadow-soft hover:shadow-card transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h3 className="font-serif font-bold text-lg text-slate-900">Bakery Sales Trend</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gross retail order volume processed (0% platform cut)
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                6-Month Total
              </span>
              <span className="text-sm font-bold text-indigo-700 tabular-nums">
                {formatIndianCurrency(gmvTotal)}
              </span>
            </div>
          </div>
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.networkGmv} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomChartTooltip metricLabel="Bakery Sales" valueColor="#4f46e5" />} />
                <Bar dataKey="amount" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
