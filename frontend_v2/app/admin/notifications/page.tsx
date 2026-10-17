'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Store,
  CreditCard,
  ShoppingBag,
  MessageSquare,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/common/Toast';
import { adminNotificationsApi } from '@/lib/api/adminNotifications';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';
import {
  AdminNotification,
  AdminNotificationCategory,
  AdminNotificationType,
} from '@/types/adminNotifications';

const CATEGORY_TABS: { label: string; value: AdminNotificationCategory }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Unread', value: 'UNREAD' },
  { label: 'Bakery', value: 'BAKERY' },
  { label: 'Orders', value: 'ORDERS' },
  { label: 'Payments', value: 'PAYMENTS' },
  { label: 'Communication', value: 'COMMUNICATION' },
  { label: 'Subscriptions', value: 'SUBSCRIPTIONS' },
  { label: 'System', value: 'SYSTEM' },
  { label: 'Security', value: 'SECURITY' },
];

function getCategoryFromType(type: AdminNotificationType): AdminNotificationCategory {
  switch (type) {
    case 'NEW_BAKERY':
    case 'BAKERY_AWAITING_APPROVAL':
    case 'VERIFICATION_SUBMITTED':
    case 'BAKERY_SUSPENDED':
      return 'BAKERY';
    case 'NEW_ORDER':
      return 'ORDERS';
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
      return 'PAYMENTS';
    case 'OWNER_FEEDBACK':
    case 'CONTACT_ENQUIRY':
      return 'COMMUNICATION';
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return 'SUBSCRIPTIONS';
    case 'SECURITY_ALERT':
      return 'SECURITY';
    case 'SYSTEM_ALERT':
    default:
      return 'SYSTEM';
  }
}

function getNotificationDestination(n: AdminNotification): string {
  if (n.actionUrl) return n.actionUrl;
  switch (n.type) {
    case 'NEW_BAKERY':
    case 'BAKERY_AWAITING_APPROVAL':
    case 'VERIFICATION_SUBMITTED':
    case 'BAKERY_SUSPENDED':
      return n.referenceId ? `/admin/shops/${n.referenceId}` : '/admin/shops';
    case 'OWNER_FEEDBACK':
      return '/admin/feedback';
    case 'CONTACT_ENQUIRY':
      return '/admin/enquiries';
    case 'NEW_ORDER':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return n.referenceId ? `/admin/shops/${n.referenceId}` : '/admin/shops';
    case 'SECURITY_ALERT':
    case 'SYSTEM_ALERT':
    default:
      return '/admin/notifications';
  }
}

function getNotificationIcon(type: AdminNotificationType) {
  switch (type) {
    case 'NEW_BAKERY':
    case 'BAKERY_AWAITING_APPROVAL':
    case 'VERIFICATION_SUBMITTED':
      return { icon: Store, bg: 'bg-indigo-50', text: 'text-indigo-600' };
    case 'OWNER_FEEDBACK':
    case 'CONTACT_ENQUIRY':
      return { icon: MessageSquare, bg: 'bg-blue-50', text: 'text-blue-600' };
    case 'NEW_ORDER':
      return { icon: ShoppingBag, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return { icon: CreditCard, bg: 'bg-purple-50', text: 'text-purple-600' };
    case 'BAKERY_SUSPENDED':
    case 'SECURITY_ALERT':
      return { icon: ShieldAlert, bg: 'bg-rose-50', text: 'text-rose-600' };
    case 'SYSTEM_ALERT':
    default:
      return { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600' };
  }
}

export default function AdminNotificationCenterPage() {
  const router = useRouter();
  const toast = useToast();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<AdminNotificationCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [selectedCategory, debouncedSearch]);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (selectedCategory === 'UNREAD') {
        params.isRead = false;
      } else if (selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }
      const data = await adminNotificationsApi.getNotifications(params);
      setNotifications(data?.content || []);
      setTotalPages(data?.totalPages || 0);

      if (selectedCategory === 'UNREAD' && !debouncedSearch.trim()) {
        setUnreadCount(data?.totalElements || 0);
      } else {
        const count = await adminNotificationsApi.getUnreadCount();
        setUnreadCount(count);
      }
    } catch {
      setNotifications([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedCategory, debouncedSearch]);

  useRegisterAdminRefresh(
    useCallback(async () => {
      await fetchNotifications();
    }, [fetchNotifications])
  );

  useEffect(() => {
    fetchNotifications();

    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await adminNotificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminNotificationsUpdated'));
      }
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || 'Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAllRead(true);
    try {
      await adminNotificationsApi.markAllAsRead();
      toast.success('All notifications marked as read');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminNotificationsUpdated'));
      }
      // Reset to first page and refetch
      setPage(0);
      await fetchNotifications();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || 'Failed to mark all as read');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif font-bold text-2xl text-slate-900">
              Notification Center
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Platform governance alerts, bakery onboarding updates, and operational events
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              isLoading={isMarkingAllRead}
              disabled={isMarkingAllRead}
              className="text-xs gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All as Read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Category Tabs & Search */}
      <Card className="p-4 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = selectedCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                  {tab.value === 'UNREAD' && unreadCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </Card>

      {/* Notification List */}
      {isLoading ? (
        <LoadingState message="Loading platform notifications..." />
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Notifications Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No notifications match your current search query or filter.'
              : 'All clear! No platform alerts or pending actions in this category.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const conf = getNotificationIcon(n.type);
            const Icon = conf.icon;
            const dest = getNotificationDestination(n);

            return (
              <Card
                key={n.id}
                className={`p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !n.isRead
                    ? 'border-indigo-200 bg-indigo-50/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl ${conf.bg} ${conf.text} flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-sm ${
                          !n.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {n.category || getCategoryFromType(n.type)}
                      </span>
                      {n.priority === 'CRITICAL' && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          Critical
                        </span>
                      )}
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Mark Read
                    </Button>
                  )}
                  <Link href={dest}>
                    <Button size="sm" className="text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
