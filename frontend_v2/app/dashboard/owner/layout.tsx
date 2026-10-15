'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Cake, ShoppingBag, Calendar, BarChart3,
  Tag, Users, MessageSquareQuote, Star, Settings, CreditCard,
  LogOut, Store, ExternalLink, Menu, Globe, X, RefreshCw, Images,
  AlertCircle, Clock, ArrowLeft, Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { OwnerProvider, useOwner } from '@/context/OwnerContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getSubscriptionHeaderInfo } from '@/lib/utils/subscription';
import NotificationBell from '@/components/owner/NotificationBell';
import OwnerFeedbackModal from '@/components/owner/OwnerFeedbackModal';
import { OwnerCommandPalette } from '@/components/owner/OwnerCommandPalette';
import { MessageCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { UnsavedChangesProvider } from '@/context/UnsavedChangesContext';
function OwnerLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { shop, subscription, refreshDashboard, isRefreshing, refreshStatus, refreshError, pendingOrdersCount, pendingCustomCakesCount, pendingInquiriesCount, pendingReviewsCount, setOperationalStatus } = useOwner();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isTogglingOperational, setIsTogglingOperational] = useState(false);
  const [operationalError, setOperationalError] = useState<string | null>(null);

  // Compute whether dashboard access should be locked by full-page modal
  // Permitted pages (billing & settings) are never locked.
  // SUSPENDED always locks dashboard.
  // PENDING always locks dashboard (requires initial subscription).
  // EXPIRED locks dashboard (requires subscription renewal).
  // INACTIVE: If owner-disabled while subscription is active, dashboard is NOT locked (vacation mode).
  // INACTIVE with no active subscription or expired subscription locks dashboard.
  // isMarketplaceRestricted alone NEVER locks dashboard.
  const isDashboardLocked = React.useMemo(() => {
    if (!shop) return false;
    // Routes always exempt for all states (except suspended which can still view settings)
    const isAlwaysExempt = pathname.includes('/subscription') || pathname.includes('/settings');
    if (isAlwaysExempt) return false;

    // SUSPENDED always locks dashboard across all operational routes including orders
    if (shop.status === 'SUSPENDED') return true;

    // PENDING always locks dashboard (requires initial onboarding subscription)
    if (shop.status === 'PENDING') return true;

    // EXPIRED: Under approved lifecycle domain rules (Domain 3 & Domain 6), expired owners
    // retain access to in-progress order fulfillment and order history (/orders).
    // All other operational routes (overview, products, gallery, delivery slots, analytics, etc.) remain locked.
    if (shop.status === 'EXPIRED') {
      if (pathname.includes('/orders')) {
        return false;
      }
      return true;
    }

    if (shop.status === 'INACTIVE') {
      const isSubActive = subscription?.status === 'ACTIVE' && Boolean(subscription?.expiryDate && new Date(subscription.expiryDate).getTime() > Date.now());
      // If subscription is expired or missing, allow orders access for fulfillment/history, lock other areas
      if (!isSubActive) {
        if (pathname.includes('/orders')) {
          return false;
        }
        return true;
      }
      // If subscription is active and shop is inactive due to owner toggle, do not lock
      return false;
    }

    return false;
  }, [shop, subscription, pathname]);

  // Global Ctrl+K / Cmd+K and '/' shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (document.activeElement?.tagName || '').toUpperCase()
        )
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const subHeaderInfo = React.useMemo(() => {
    return getSubscriptionHeaderInfo(subscription, shop?.status, undefined, user?.role, Boolean(shop?.id));
  }, [subscription, shop?.status, user?.role, shop?.id]);

  const handleBackNavigation = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard/owner');
    }
  };

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  const navItems = [
    { label: 'Overview', href: '/dashboard/owner', icon: LayoutDashboard },
    { label: 'Products', href: '/dashboard/owner/products', icon: Cake },
    { label: 'Cake Gallery', href: '/dashboard/owner/gallery', icon: Images },
    { label: 'Orders', href: '/dashboard/owner/orders', icon: ShoppingBag, count: pendingOrdersCount },
    { label: 'Custom Cakes', href: '/dashboard/owner/custom-cakes', icon: Sparkles, count: pendingCustomCakesCount },
    { label: 'Delivery Slots', href: '/dashboard/owner/delivery-slots', icon: Calendar },
    { label: 'Storefront Website', href: '/dashboard/owner/website', icon: Globe },
    { label: 'Analytics', href: '/dashboard/owner/analytics', icon: BarChart3 },
    { label: 'Coupons', href: '/dashboard/owner/coupons', icon: Tag },
    { label: 'Customers', href: '/dashboard/owner/customers', icon: Users },
    { label: 'Store Inquiries', href: '/dashboard/owner/inquiries', icon: MessageSquareQuote, count: pendingInquiriesCount },
    { label: 'Reviews', href: '/dashboard/owner/reviews', icon: Star, count: pendingReviewsCount },
    { label: 'Store Settings', href: '/dashboard/owner/settings', icon: Settings },
    { label: 'Subscription', href: '/dashboard/owner/subscription', icon: CreditCard },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-owner-canvas">
        <div className="w-8 h-8 border-2 border-brand-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/dashboard/owner'
            ? pathname === '/dashboard/owner'
            : pathname.startsWith(item.href);
        const hasBadge = Boolean(item.count && item.count > 0);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all ${
              isActive
                ? 'bg-owner-sidebar-active text-white shadow-sm'
                : 'text-owner-sidebar-text hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            {hasBadge && (
              <span
                className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
                  isActive
                    ? 'bg-white text-brand-burgundy shadow-sm'
                    : 'bg-brand-burgundy text-white shadow-sm'
                }`}
              >
                {item.count! > 99 ? '99+' : item.count}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  const SidebarShell = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
        <Link href="/dashboard/owner" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-9 h-9 rounded-xl bg-brand-plum text-white flex items-center justify-center shadow-soft shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className="font-serif text-lg font-bold text-white block leading-tight line-clamp-2"
              title={shop?.businessName || 'My Bakery'}
            >
              {shop?.businessName || 'My Bakery'}
            </span>
            {shop?.verificationStatus === 'VERIFIED' ? (
              <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-sm border border-emerald-400/30 bg-emerald-400/10 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>Verified</span>
              </div>
            ) : (
              <span className="text-[10px] text-owner-sidebar-text uppercase tracking-widest font-medium block mt-0.5">
                Owner Portal
              </span>
            )}
          </div>
        </Link>
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-owner-sidebar-text hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="p-4 flex-1 min-h-0 space-y-1 overflow-y-auto">
        <NavLinks />
      </nav>
      <div className="p-4 border-t border-white/10 shrink-0 mt-auto">
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-blush" />
          <span>Give Feedback</span>
        </button>
        <div className="mb-3 px-2">
          <p className="text-xs text-white font-medium truncate">
            {user?.fullName || 'Bakery Owner'}
          </p>
          <p className="text-[10px] text-owner-sidebar-text truncate">
            {user?.email}
          </p>
          <p className="text-[10px] text-brand-blush mt-0.5">
            Shop ID: {shop?.id || user?.shopId || 'N/A'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-owner-canvas overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-screen shrink-0 bg-owner-sidebar text-owner-sidebar-text flex-col border-r border-owner-sidebar/80">
        <SidebarShell />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 h-full max-h-screen bg-owner-sidebar text-owner-sidebar-text flex flex-col shadow-2xl">
            <SidebarShell isMobile={true} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white border-b border-owner-border px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-owner-muted hover:text-owner-heading rounded-xl hover:bg-owner-canvas transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {pathname !== '/dashboard/owner' && (
              <button
                type="button"
                onClick={handleBackNavigation}
                className="p-1.5 -ml-1 rounded-xl text-owner-muted hover:text-owner-heading hover:bg-owner-canvas border border-transparent hover:border-owner-border transition-all cursor-pointer shrink-0"
                title="Go back to previous page"
                aria-label="Go back to previous page"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* Subscription Status + Days Remaining Indicator */}
            {subHeaderInfo && (
              <Link
                href="/dashboard/owner/subscription"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full border border-owner-border/70 bg-owner-canvas hover:bg-brand-cream text-xs transition-all shrink-0 cursor-pointer shadow-2xs hover:border-brand-plum/30"
                title={`Subscription: ${subHeaderInfo.badgeLabel} (${subHeaderInfo.daysRemainingText}) - Click to view subscription`}
              >
                <Badge
                  variant={subHeaderInfo.badgeVariant}
                  size="sm"
                  className="font-bold tracking-wider text-[10px] uppercase px-1.5 sm:px-2 py-0.5"
                >
                  {subHeaderInfo.badgeLabel}
                </Badge>
                <span className="text-[11px] sm:text-xs text-owner-muted font-medium hidden sm:inline">
                  {subHeaderInfo.daysRemainingText}
                </span>
              </Link>
            )}
          </div>

          {/* Center: Global Command Palette Search Trigger */}
          <div className="flex-1 max-w-md mx-2 sm:mx-4 min-w-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-owner-canvas hover:bg-brand-cream/60 border border-owner-border text-xs text-owner-muted hover:text-owner-heading transition-all shadow-2xs cursor-pointer group"
              title="Search orders, cakes, customers, inquiries (Ctrl+K)"
              aria-label="Open global search"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 text-brand-plum shrink-0 group-hover:scale-110 transition-transform" />
                <span className="truncate hidden sm:inline">Search orders, cakes, customers...</span>
                <span className="truncate sm:hidden">Search...</span>
              </div>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white border border-owner-border rounded text-owner-muted shadow-2xs shrink-0">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live Operational Notification Bell & Popover */}
            <NotificationBell />

            {/* Streamlined Top Header Refresh Button */}
            <button
              onClick={refreshDashboard}
              disabled={isRefreshing}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-owner-border bg-owner-canvas hover:bg-brand-cream text-xs font-semibold text-owner-heading transition-all disabled:opacity-60 cursor-pointer shadow-2xs flex items-center gap-1.5"
              aria-label="Refresh dashboard data"
              title={isRefreshing ? 'Refreshing...' : refreshStatus === 'updated' ? 'Data Updated' : 'Refresh dashboard data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-brand-plum ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xl:inline">
                {isRefreshing ? 'Refreshing...' : refreshStatus === 'updated' ? 'Updated' : 'Refresh'}
              </span>
            </button>

            {/* Operational Open/Paused Toggle (Increment 5.1) */}
            {shop && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl border border-owner-border bg-owner-canvas shadow-2xs">
                <span className="hidden md:inline text-[11px] font-semibold text-owner-muted uppercase tracking-wider pl-1">
                  Bakery:
                </span>
                <button
                  type="button"
                  disabled={isTogglingOperational || isRefreshing}
                  onClick={async () => {
                    const currentEnabled = shop.isOwnerEnabled !== false;
                    const nextEnabled = !currentEnabled;
                    setIsTogglingOperational(true);
                    setOperationalError(null);
                    try {
                      await setOperationalStatus(nextEnabled);
                    } catch (err: any) {
                      setOperationalError(err?.message || `Failed to ${nextEnabled ? 'reopen' : 'pause'} bakery.`);
                    } finally {
                      setIsTogglingOperational(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    shop.isOwnerEnabled !== false
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  } disabled:opacity-60`}
                  title={
                    shop.isOwnerEnabled !== false
                      ? 'Storefront is live and taking orders. Click to pause (Vacation Mode).'
                      : 'Storefront is paused. Click to re-open bakery.'
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isTogglingOperational
                        ? 'bg-white animate-spin'
                        : shop.isOwnerEnabled !== false
                        ? 'bg-emerald-200 animate-pulse'
                        : 'bg-amber-200'
                    }`}
                  />
                  <span>
                    {isTogglingOperational
                      ? 'Updating...'
                      : shop.isOwnerEnabled !== false
                      ? 'Open'
                      : 'Paused'}
                  </span>
                </button>
              </div>
            )}

            {/* WhatsApp Share Button */}
            <button
              onClick={() => {
                const shopAny = shop as any;
                const storeUrl = shopAny?.slug ? `/${shopAny.slug}` : `/shop/${shop?.id || user?.shopId || ''}`;
                const fullUrl = `${window.location.origin}${storeUrl}`;
                const text = `Hi! Check out my live menu and book your cake here: ${fullUrl}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:bg-[#128C7E] transition-colors shadow-2xs cursor-pointer"
              title="Share storefront on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Share Shop</span>
            </button>

            {/* Single View Store Button */}
            <Link href={`/shop/${shop?.id || user?.shopId || ''}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 shadow-2xs px-2.5 sm:px-3">
                <Store className="w-3.5 h-3.5 text-brand-plum" />
                <span className="hidden sm:inline">View Store</span>
                <ExternalLink className="w-3 h-3 text-owner-muted" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Operational Error Toast/Banner */}
        {operationalError && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Operational Status Error:</strong> {operationalError}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOperationalError(null)}
                className="text-rose-700 hover:text-rose-900 font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Administrative Marketplace Restriction Banner */}
        {shop?.isMarketplaceRestricted && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 sm:px-6 py-2.5 shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[11px] text-amber-900 mr-2 bg-amber-200/80 px-1.5 py-0.5 rounded">
                    Marketplace Restricted
                  </span>
                  <span>
                    Your storefront is temporarily hidden from marketplace search and direct customer ordering.
                    {shop.marketplaceRestrictionReason ? (
                      <span className="ml-1 font-semibold">Reason: &ldquo;{shop.marketplaceRestrictionReason}&rdquo;.</span>
                    ) : null}
                    {' '}You retain full dashboard access to update menus, manage kitchen orders, and resolve compliance requirements.
                  </span>
                </div>
              </div>
              <Link href="/dashboard/owner/settings" className="shrink-0 self-end sm:self-auto">
                <Button size="sm" variant="outline" className="bg-white border-amber-300 text-amber-900 hover:bg-amber-50 text-xs h-7 px-3">
                  Check Settings
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Owner-Paused (Vacation Mode) Banner */}
        {shop?.isOwnerEnabled === false && (
          <div className="bg-slate-100 border-b border-slate-300 px-4 sm:px-6 py-2.5 shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 mr-2 bg-slate-200 px-1.5 py-0.5 rounded">
                    Bakery Paused
                  </span>
                  <span>
                    Your storefront is currently paused (Vacation Mode) and hidden from customers. New orders are temporarily stopped. You can continue updating your catalog and preparing existing orders.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                disabled={isTogglingOperational}
                onClick={async () => {
                  setIsTogglingOperational(true);
                  setOperationalError(null);
                  try {
                    await setOperationalStatus(true);
                  } catch (err: any) {
                    setOperationalError(err?.message || 'Failed to re-open bakery.');
                  } finally {
                    setIsTogglingOperational(false);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3 shrink-0 self-end sm:self-auto cursor-pointer"
              >
                {isTogglingOperational ? 'Reopening...' : 'Re-open Bakery'}
              </Button>
            </div>
          </div>
        )}

        {/* Phase 1 Bakery Lifecycle Status Alert Banners */}
        {shop?.status === 'PENDING' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong className="font-semibold">Complete Your Subscription:</strong> Your bakery registration is complete. Complete your subscription to activate your bakery.
                </span>
              </div>
              <Link href="/dashboard/owner/subscription" className="shrink-0">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-3 shadow-xs">
                  Subscribe Now
                </Button>
              </Link>
            </div>
          </div>
        )}

        {shop?.status === 'EXPIRED' && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2.5 shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong className="font-semibold">Subscription Expired:</strong> Your CakeStore subscription has expired. Renew your subscription to continue managing your bakery.
                </span>
              </div>
              <Link href="/dashboard/owner/subscription" className="shrink-0">
                <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7 px-3 shadow-xs">
                  Renew Subscription
                </Button>
              </Link>
            </div>
          </div>
        )}

        {shop?.status === 'ACTIVE' && shop?.verificationStatus === 'PROCESSING' && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 sm:px-6 py-2 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs text-blue-900">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong className="font-semibold">Your Bakery is Active:</strong> Your verification is currently under review by CakeStore. Your storefront is live and you can accept orders.
                </span>
              </div>
            </div>
          </div>
        )}

        {shop?.status === 'ACTIVE' && shop?.verificationStatus === 'REJECTED' && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong className="font-semibold">Verification Update:</strong> Your bakery verification documents require attention. Please update your store settings or contact support.
                </span>
              </div>
            </div>
          </div>
        )}

        {shop?.status === 'SUSPENDED' && (
          <div className="bg-rose-100 border-b border-rose-300 px-4 sm:px-6 py-2.5 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center gap-2.5 text-xs text-rose-900 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>Your bakery account has been suspended by administration. Please contact platform support.</span>
            </div>
          </div>
        )}

        {refreshError && (
          <div className="px-4 sm:px-6 pt-3 shrink-0">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
              <span>{refreshError}</span>
            </div>
          </div>
        )}

        <main className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full relative">
            {isDashboardLocked && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 shadow-2xl p-8 text-center min-h-[60vh] mt-4">
                <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-bold font-serif text-slate-900 mb-3">Dashboard Restricted</h2>
                <p className="text-slate-600 max-w-lg mb-8 text-sm leading-relaxed">
                  {shop?.status === 'SUSPENDED' 
                    ? "Your bakery account has been suspended by administration. Please contact platform support to resolve this issue."
                    : "Your subscription is inactive or has expired. Please process your payment to restore full access and manage your active storefront."}
                </p>
                <Link href="/dashboard/owner/subscription">
                  <Button size="lg" className="bg-brand-plum hover:bg-brand-plum-dark text-white shadow-lg font-medium px-8 h-12">
                    Proceed to Billing & Subscription
                  </Button>
                </Link>
              </div>
            )}
            
            <div className={isDashboardLocked ? 'opacity-20 pointer-events-none blur-[4px] select-none transition-all duration-500' : ''}>
              {children}
            </div>
          </div>
        </main>
      </div>
      <OwnerFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
      <OwnerCommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        shopId={shop?.id}
      />
    </div>
  );
}

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <OwnerProvider>
      <UnsavedChangesProvider>
        <OwnerLayoutContent>{children}</OwnerLayoutContent>
      </UnsavedChangesProvider>
    </OwnerProvider>
  );
}
