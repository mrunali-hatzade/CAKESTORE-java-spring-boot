'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ArrowRight,
  ExternalLink,
  Sparkles,
  Inbox,
} from 'lucide-react';
import {
  adminNotificationsApi,
} from '@/lib/api/adminNotifications';
import {
  AdminNotification,
  AdminNotificationType,
} from '@/types/adminNotifications';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffSec) || diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
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

export function getWebSocketEndpoint(): string {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');
  return `${baseUrl}/ws-endpoint`;
}

export function resolveAdminNotificationDestination(userId: any): string | null {
  if (userId === undefined || userId === null) return null;
  const str = String(userId).trim();
  if (str === '' || str === 'undefined' || str === 'null') return null;
  const num = Number(str);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) return null;
  return `/queue/admin-notifications-${num}`;
}

export default function AdminNotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, token } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const [response, count] = await Promise.all([
        adminNotificationsApi.getNotifications({ isRead: false }),
        adminNotificationsApi.getUnreadCount(),
      ]);
      setNotifications(response?.content || []);
      setUnreadCount(count);
    } catch {
      // Backend not yet wired; clean empty state
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);

    const handleGlobalRefresh = () => {
      fetchNotifications();
    };
    const handleNotificationsUpdated = () => {
      fetchNotifications();
    };

    window.addEventListener('adminGlobalRefresh', handleGlobalRefresh);
    window.addEventListener('adminNotificationsUpdated', handleNotificationsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('adminGlobalRefresh', handleGlobalRefresh);
      window.removeEventListener('adminNotificationsUpdated', handleNotificationsUpdated);
    };
  }, [fetchNotifications]);

  // Register with AdminRefreshContext so header Refresh button awaits notification updates
  useRegisterAdminRefresh(
    useCallback(async () => {
      await fetchNotifications();
    }, [fetchNotifications])
  );

  useEffect(() => {
    const destination = resolveAdminNotificationDestination(user?.id);
    if (!destination || !token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(getWebSocketEndpoint()),
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        client.subscribe(destination, (message) => {
          try {
            const newNotif = JSON.parse(message.body);
            setUnreadCount((prev) => prev + 1);
            setNotifications((prev) => [newNotif, ...prev]);
          } catch (err) {
            console.error('Error parsing admin notification:', err);
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [user?.id, token]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await adminNotificationsApi.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminNotificationsUpdated'));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleItemClick = async (n: AdminNotification) => {
    if (!n.isRead) {
      try {
        await adminNotificationsApi.markAsRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('adminNotificationsUpdated'));
        }
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    setIsOpen(false);
    const dest = getNotificationDestination(n);
    router.push(dest);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Admin Notifications"
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">No New Notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Platform events requiring attention will appear here
                </p>
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => {
                const conf = getNotificationIcon(n.type);
                const Icon = conf.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 hover:bg-slate-50/80 ${
                      !n.isRead ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${conf.bg} ${conf.text} flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs truncate ${
                            !n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                          }`}
                        >
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{n.message}</p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 text-center">
            <Link
              href="/admin/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1"
            >
              <span>View All Notifications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
