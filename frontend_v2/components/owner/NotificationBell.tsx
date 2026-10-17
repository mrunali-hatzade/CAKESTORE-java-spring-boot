'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, Check, CheckCheck, ShoppingBag, Star,
  MessageSquareQuote, Cake, AlertTriangle, CreditCard,
  RefreshCw, X, ArrowRight
} from 'lucide-react';
import { notificationsApi, NotificationRecord, NotificationType } from '@/lib/api/notifications';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '@/lib/auth/AuthContext';

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

function getNotificationDestination(type: NotificationType): string | null {
  switch (type) {
    case 'NEW_ORDER':
      return '/dashboard/owner/orders';
    case 'NEW_FEEDBACK':
      return '/dashboard/owner/reviews';
    case 'NEW_ENQUIRY':
      return '/dashboard/owner/inquiries';
    case 'CUSTOM_ORDER_REQUEST':
      return '/dashboard/owner/custom-cakes';
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return '/dashboard/owner/subscription';
    case 'ADMIN_MESSAGE':
      return '/dashboard/owner';
    default:
      return null;
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'NEW_ORDER':
      return { icon: ShoppingBag, bg: 'bg-emerald-50', text: 'text-emerald-700' };
    case 'NEW_FEEDBACK':
      return { icon: Star, bg: 'bg-amber-50', text: 'text-amber-600' };
    case 'NEW_ENQUIRY':
      return { icon: MessageSquareQuote, bg: 'bg-purple-50', text: 'text-purple-700' };
    case 'CUSTOM_ORDER_REQUEST':
      return { icon: Cake, bg: 'bg-rose-50', text: 'text-brand-plum' };
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return { icon: CreditCard, bg: 'bg-amber-50', text: 'text-amber-700' };
    case 'ADMIN_MESSAGE':
    default:
      return { icon: Bell, bg: 'bg-brand-blush', text: 'text-brand-plum' };
  }
}

export function resolveOwnerNotificationDestination(userId: any): string | null {
  if (userId === undefined || userId === null) return null;
  const str = String(userId).trim();
  if (str === '' || str === 'undefined' || str === 'null') return null;
  const num = Number(str);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) return null;
  return `/queue/notifications-${num}`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const { user, token } = useAuth();

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch unread count for badge
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Quiet failure for background count check
    }
  }, []);

  // 2. Fetch full notifications when popover opens
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await notificationsApi.getNotifications();
      setNotifications(list || []);
      const unread = (list || []).filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Refresh count periodically every 60s
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const destination = resolveOwnerNotificationDestination(user?.id);
    if (!destination || !token) return;

    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '') + '/ws-endpoint';

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        client.subscribe(destination, (message) => {
          try {
            const newNotif = JSON.parse(message.body);
            setUnreadCount((prev) => prev + 1);
            setNotifications((prev) => [newNotif, ...prev]);
          } catch (err) {
            console.error('Error parsing notification:', err);
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [user?.id, token]);

  // Click outside listener to dismiss popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAsRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await notificationsApi.markAsRead(id);
    } catch {
      // Revert if error
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      // Optimistic UI update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      await notificationsApi.markAllAsRead();
    } catch {
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationRecord) => {
    if (!notif.isRead) {
      try {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        await notificationsApi.markAsRead(notif.id);
      } catch {
        // Continue navigation regardless
      }
    }
    const destination = getNotificationDestination(notif.type);
    if (destination) {
      setIsOpen(false);
      router.push(destination);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Notification Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-owner-muted hover:text-owner-heading rounded-full hover:bg-owner-canvas transition-colors cursor-pointer"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute top-1 right-1 min-w-[1.125rem] h-[1.125rem] px-1 bg-brand-plum text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-2xs leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown (Design 2 Visual Identity) */}
      {isOpen && (
        <div
          data-testid="notification-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[30rem] bg-white rounded-2xl border border-owner-border shadow-xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Popover Header */}
          <div className="px-4 py-3 border-b border-owner-border bg-owner-canvas/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-sm text-owner-heading">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-blush text-brand-plum border border-brand-blush-border">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="text-[11px] font-semibold text-brand-plum hover:text-brand-plum-hover px-2 py-1 rounded-lg hover:bg-brand-blush/60 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-owner-muted hover:text-owner-heading rounded-lg hover:bg-owner-canvas transition-colors sm:hidden"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Popover Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-owner-border/60">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-owner-muted gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-brand-plum" />
                <span className="text-xs font-medium">Checking bakery alerts...</span>
              </div>
            ) : error ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto border border-rose-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-owner-heading">{error}</p>
                  <p className="text-[11px] text-owner-muted">Could not retrieve recent updates.</p>
                </div>
                <button
                  onClick={fetchNotifications}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-owner-canvas border border-owner-border hover:bg-brand-cream text-owner-heading transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-owner-heading">You&apos;re all caught up.</p>
                <p className="text-[11px] text-owner-muted max-w-xs mx-auto">
                  No notifications for your bakery at this time.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const { icon: Icon, bg, text } = getNotificationIcon(n.type);
                const hasDestination = !!getNotificationDestination(n.type);

                return (
                  <div
                    key={n.id}
                    data-testid={`notification-item-${n.id}`}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 flex items-start gap-3 transition-colors text-left ${
                      n.isRead
                        ? 'bg-white hover:bg-owner-canvas/40'
                        : 'bg-brand-blush/20 hover:bg-brand-blush/30 font-medium'
                    } ${hasDestination ? 'cursor-pointer group' : ''}`}
                  >
                    {/* Unread Status Dot */}
                    <div className="pt-1 shrink-0">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          n.isRead ? 'bg-transparent' : 'bg-brand-plum shadow-2xs'
                        }`}
                      />
                    </div>

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl ${bg} ${text} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${n.isRead ? 'font-semibold text-owner-heading' : 'font-bold text-owner-heading'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-owner-muted shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-owner-muted leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-1 self-center">
                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(e, n.id)}
                          className="p-1 text-owner-muted hover:text-brand-plum hover:bg-white rounded-lg transition-colors"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {hasDestination && (
                        <ArrowRight className="w-3.5 h-3.5 text-owner-muted group-hover:text-brand-plum group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Popover Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-owner-border bg-owner-canvas/20 flex items-center justify-between text-[11px] text-owner-muted shrink-0">
              <span>{notifications.length} total {notifications.length === 1 ? 'alert' : 'alerts'}</span>
              <button
                onClick={fetchNotifications}
                className="hover:text-brand-plum font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}