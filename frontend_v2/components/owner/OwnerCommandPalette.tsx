'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShoppingBag,
  Cake,
  Users,
  MessageSquareQuote,
  Sparkles,
  Calendar,
  Tag,
  Star,
  Settings,
  CreditCard,
  Globe,
  Images,
  ArrowRight,
  X,
  Clock,
  ExternalLink,
  IndianRupee,
  Loader2,
  Phone,
  Mail,
} from 'lucide-react';
import { ownerApi } from '@/lib/api/owner';
import {
  GlobalSearchResults,
  GlobalSearchOrderResult,
  GlobalSearchProductResult,
  GlobalSearchCustomerResult,
  GlobalSearchCustomCakeResult,
  GlobalSearchEnquiryResult,
} from '@/types/owner';

interface OwnerCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  shopId?: number | string;
}

interface NavShortcut {
  id: string;
  type: 'navigation';
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

type PaletteItem =
  | NavShortcut
  | { type: 'order'; data: GlobalSearchOrderResult }
  | { type: 'product'; data: GlobalSearchProductResult }
  | { type: 'customer'; data: GlobalSearchCustomerResult }
  | { type: 'customCake'; data: GlobalSearchCustomCakeResult }
  | { type: 'enquiry'; data: GlobalSearchEnquiryResult };

const STATIC_NAV_SHORTCUTS: NavShortcut[] = [
  {
    id: 'nav-orders',
    type: 'navigation',
    label: 'Orders',
    description: 'Track incoming celebration orders & kitchen status',
    href: '/dashboard/owner/orders',
    icon: ShoppingBag,
  },
  {
    id: 'nav-products',
    type: 'navigation',
    label: 'Products & Flavors',
    description: 'Manage artisanal cake catalog, prices & stock',
    href: '/dashboard/owner/products',
    icon: Cake,
  },
  {
    id: 'nav-custom-cakes',
    type: 'navigation',
    label: 'Custom Cake Requests',
    description: 'Review bespoke cake inquiries & photo references',
    href: '/dashboard/owner/custom-cakes',
    icon: Sparkles,
  },
  {
    id: 'nav-customers',
    type: 'navigation',
    label: 'Customers CRM',
    description: 'View celebrant profiles, contacts & order history',
    href: '/dashboard/owner/customers',
    icon: Users,
  },
  {
    id: 'nav-inquiries',
    type: 'navigation',
    label: 'Store Inquiries',
    description: 'Answer customer messages & cake questions',
    href: '/dashboard/owner/inquiries',
    icon: MessageSquareQuote,
  },
  {
    id: 'nav-reviews',
    type: 'navigation',
    label: 'Verified Reviews',
    description: 'Read customer cake ratings & post baker replies',
    href: '/dashboard/owner/reviews',
    icon: Star,
  },
  {
    id: 'nav-delivery-slots',
    type: 'navigation',
    label: 'Delivery Slots',
    description: 'Configure delivery windows & daily kitchen caps',
    href: '/dashboard/owner/delivery-slots',
    icon: Calendar,
  },
  {
    id: 'nav-coupons',
    type: 'navigation',
    label: 'Coupons & Offers',
    description: 'Create festive discount codes & promotional vouchers',
    href: '/dashboard/owner/coupons',
    icon: Tag,
  },
  {
    id: 'nav-gallery',
    type: 'navigation',
    label: 'Cake Gallery',
    description: 'Showcase finished cake photography on storefront',
    href: '/dashboard/owner/gallery',
    icon: Images,
  },
  {
    id: 'nav-website',
    type: 'navigation',
    label: 'Storefront Website',
    description: 'Manage bakery branding, cover banner & theme',
    href: '/dashboard/owner/website',
    icon: Globe,
  },
  {
    id: 'nav-settings',
    type: 'navigation',
    label: 'Store Settings',
    description: 'Update bakery timings, address, FSSAI & payouts',
    href: '/dashboard/owner/settings',
    icon: Settings,
  },
  {
    id: 'nav-subscription',
    type: 'navigation',
    label: 'Subscription & Billing',
    description: 'View active plan license & payment invoices',
    href: '/dashboard/owner/subscription',
    icon: CreditCard,
  },
];

export const OwnerCommandPalette: React.FC<OwnerCommandPaletteProps> = ({
  isOpen,
  onClose,
  shopId,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when opened & reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Debounced API search
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await ownerApi.globalSearch(trimmed);
      setResults(data);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Failed to perform global search:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 2) {
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(val);
      }, 250);
    } else {
      setResults(null);
      setIsLoading(false);
      setSelectedIndex(0);
    }
  };

  // Filter matching navigation shortcuts
  const matchingNavShortcuts = useMemo(() => {
    if (!query.trim()) return STATIC_NAV_SHORTCUTS;
    const q = query.toLowerCase();
    return STATIC_NAV_SHORTCUTS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [query]);

  // Flattened items list for linear keyboard navigation
  const flatItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    if (results) {
      if (results.orders && results.orders.length > 0) {
        results.orders.forEach((o) => items.push({ type: 'order', data: o }));
      }
      if (results.products && results.products.length > 0) {
        results.products.forEach((p) => items.push({ type: 'product', data: p }));
      }
      if (results.customers && results.customers.length > 0) {
        results.customers.forEach((c) => items.push({ type: 'customer', data: c }));
      }
      if (results.customCakes && results.customCakes.length > 0) {
        results.customCakes.forEach((c) => items.push({ type: 'customCake', data: c }));
      }
      if (results.enquiries && results.enquiries.length > 0) {
        results.enquiries.forEach((e) => items.push({ type: 'enquiry', data: e }));
      }
    }

    // Always include matching navigation shortcuts
    matchingNavShortcuts.forEach((nav) => items.push(nav));

    return items;
  }, [results, matchingNavShortcuts]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  // Execute selected item
  const handleSelectItem = useCallback(
    (item: PaletteItem) => {
      onClose();
      switch (item.type) {
        case 'navigation':
          router.push(item.href);
          break;
        case 'order':
          router.push(
            `/dashboard/owner/orders?orderId=${item.data.id}&search=${encodeURIComponent(
              item.data.orderNumber
            )}`
          );
          break;
        case 'product':
          router.push(
            `/dashboard/owner/products?productId=${item.data.id}&search=${encodeURIComponent(
              item.data.name
            )}`
          );
          break;
        case 'customer':
          router.push(
            `/dashboard/owner/customers?search=${encodeURIComponent(
              item.data.email || item.data.mobile || item.data.name
            )}&autoOpen=true`
          );
          break;
        case 'customCake':
          router.push(
            `/dashboard/owner/custom-cakes?requestId=${item.data.id}`
          );
          break;
        case 'enquiry':
          router.push(
            `/dashboard/owner/inquiries?inquiryId=${item.data.id}&search=${encodeURIComponent(
              item.data.customerName
            )}`
          );
          break;
      }
    },
    [router, onClose]
  );

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelectItem(flatItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const container = resultsContainerRef.current;
    if (!container) return;
    const activeElement = container.querySelector('[data-selected="true"]');
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const hasAnyServerResults =
    results &&
    ((results.orders && results.orders.length > 0) ||
      (results.products && results.products.length > 0) ||
      (results.customers && results.customers.length > 0) ||
      (results.customCakes && results.customCakes.length > 0) ||
      (results.enquiries && results.enquiries.length > 0));

  let currentItemCounter = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-owner-border overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="relative flex items-center px-4 sm:px-6 py-4 border-b border-owner-border gap-3 shrink-0 bg-white">
          <Search className="w-5 h-5 text-brand-plum shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search orders, cakes, customers, inquiries, or pages..."
            className="flex-1 bg-transparent text-sm sm:text-base text-owner-heading placeholder:text-owner-muted focus:outline-hidden font-medium min-w-0"
          />

          {isLoading ? (
            <Loader2 className="w-4 h-4 text-brand-plum animate-spin shrink-0" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults(null);
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-owner-muted hover:text-owner-heading hover:bg-owner-canvas transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}

          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold text-owner-muted bg-owner-canvas border border-owner-border rounded-lg shadow-2xs shrink-0">
            ESC
          </kbd>
        </div>

        {/* Scrollable Results Container */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 divide-y divide-owner-border/40"
        >
          {/* 1. ORDERS SECTION */}
          {results?.orders && results.orders.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-owner-muted">
                <span>Orders ({results.orders.length})</span>
                <span className="text-[10px] font-normal normal-case">Direct lookup</span>
              </div>
              {results.orders.map((order) => {
                const itemIndex = currentItemCounter++;
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={`order-${order.id}`}
                    data-selected={isSelected}
                    onClick={() => handleSelectItem({ type: 'order', data: order })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-blush/60 text-brand-plum shadow-2xs'
                        : 'hover:bg-owner-canvas text-owner-heading'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-owner-heading">
                            {order.orderNumber}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-owner-canvas border border-owner-border text-owner-muted">
                            {order.orderStatus}
                          </span>
                        </div>
                        <p className="text-xs text-owner-muted truncate">
                          {order.customerName || 'Guest'}
                          {order.customerPhone ? ` • ${order.customerPhone}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-owner-heading font-serif">
                        ₹{Number(order.totalAmount || 0).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. CAKES & CATALOG SECTION */}
          {results?.products && results.products.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-owner-muted">
                <span>Cakes & Catalog ({results.products.length})</span>
                <span className="text-[10px] font-normal normal-case">Edit catalog</span>
              </div>
              {results.products.map((product) => {
                const itemIndex = currentItemCounter++;
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={`prod-${product.id}`}
                    data-selected={isSelected}
                    onClick={() => handleSelectItem({ type: 'product', data: product })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-blush/60 text-brand-plum shadow-2xs'
                        : 'hover:bg-owner-canvas text-owner-heading'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-8 h-8 rounded-xl bg-rose-50 text-brand-plum flex items-center justify-center shrink-0 overflow-hidden">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="32px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <Cake className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-xs text-owner-heading truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-owner-muted truncate">
                          {product.categoryName || 'Catalog Cake'}
                          {product.availability === false ? ' • (Out of stock)' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-owner-heading font-serif">
                        ₹{Number(product.price || 0).toLocaleString()}
                      </p>
                      <span
                        className={`text-[10px] font-medium ${
                          product.availability ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {product.availability ? 'Active' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. CUSTOMERS SECTION */}
          {results?.customers && results.customers.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-owner-muted">
                <span>Celebrants & Customers ({results.customers.length})</span>
                <span className="text-[10px] font-normal normal-case">Customer CRM</span>
              </div>
              {results.customers.map((cust, idx) => {
                const itemIndex = currentItemCounter++;
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={`cust-${cust.email || cust.mobile || idx}`}
                    data-selected={isSelected}
                    onClick={() => handleSelectItem({ type: 'customer', data: cust })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-blush/60 text-brand-plum shadow-2xs'
                        : 'hover:bg-owner-canvas text-owner-heading'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-xs text-owner-heading truncate">
                          {cust.name}
                        </p>
                        <p className="text-[11px] text-owner-muted truncate flex items-center gap-2">
                          {cust.mobile && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              {cust.mobile}
                            </span>
                          )}
                          {cust.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" />
                              {cust.email}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-owner-heading font-serif">
                        ₹{Number(cust.totalSpent || 0).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-owner-muted">
                        {cust.totalOrders} {cust.totalOrders === 1 ? 'order' : 'orders'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. CUSTOM CAKE REQUESTS */}
          {results?.customCakes && results.customCakes.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-owner-muted">
                <span>Custom Cake Requests ({results.customCakes.length})</span>
                <span className="text-[10px] font-normal normal-case">Bespoke orders</span>
              </div>
              {results.customCakes.map((cakeReq) => {
                const itemIndex = currentItemCounter++;
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={`custom-${cakeReq.id}`}
                    data-selected={isSelected}
                    onClick={() => handleSelectItem({ type: 'customCake', data: cakeReq })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-blush/60 text-brand-plum shadow-2xs'
                        : 'hover:bg-owner-canvas text-owner-heading'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-xs text-owner-heading truncate">
                          {cakeReq.customerName}
                          {cakeReq.occasion ? ` • ${cakeReq.occasion}` : ''}
                        </p>
                        <p className="text-[11px] text-owner-muted truncate">
                          {cakeReq.flavour || 'Custom flavor'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {cakeReq.budget ? (
                        <p className="text-xs font-bold text-owner-heading font-serif">
                          ₹{Number(cakeReq.budget).toLocaleString()}
                        </p>
                      ) : null}
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        {cakeReq.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 5. INQUIRIES SECTION */}
          {results?.enquiries && results.enquiries.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-owner-muted">
                <span>Store Inquiries ({results.enquiries.length})</span>
                <span className="text-[10px] font-normal normal-case">Direct messages</span>
              </div>
              {results.enquiries.map((enq) => {
                const itemIndex = currentItemCounter++;
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={`enq-${enq.id}`}
                    data-selected={isSelected}
                    onClick={() => handleSelectItem({ type: 'enquiry', data: enq })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-blush/60 text-brand-plum shadow-2xs'
                        : 'hover:bg-owner-canvas text-owner-heading'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <MessageSquareQuote className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-xs text-owner-heading truncate">
                          {enq.customerName}
                          <span className="text-owner-muted font-normal">
                            {' '}
                            ({enq.enquiryType || 'General'})
                          </span>
                        </p>
                        <p className="text-[11px] text-owner-muted truncate italic">
                          &ldquo;{enq.messageSnippet}&rdquo;
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold text-brand-plum bg-brand-blush/40 px-2 py-0.5 rounded-full">
                        {enq.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 6. NO RESULTS FOUND BANNER (when searching but nothing matches) */}
          {query.trim().length >= 2 && !isLoading && !hasAnyServerResults && matchingNavShortcuts.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <Search className="w-8 h-8 text-owner-muted mx-auto opacity-50" />
              <p className="text-sm font-semibold text-owner-heading">
                No matches found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-owner-muted max-w-sm mx-auto">
                Try searching by order number (#ORD), cake flavor, customer name, mobile number, or page title.
              </p>
            </div>
          )}

          {/* 7. QUICK NAVIGATION SHORTCUTS */}
          {matchingNavShortcuts.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-owner-muted">
                <span>
                  {query.trim().length >= 2 ? 'Matching Pages & Tools' : 'Quick Navigation & Shortcuts'}
                </span>
                <span className="text-[10px] font-normal normal-case">Jump to section</span>
              </div>
              {matchingNavShortcuts.map((nav) => {
                const itemIndex = currentItemCounter++;
                const isSelected = itemIndex === selectedIndex;
                const Icon = nav.icon;
                return (
                  <div
                    key={nav.id}
                    data-selected={isSelected}
                    onClick={() => handleSelectItem(nav)}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-blush/60 text-brand-plum shadow-2xs'
                        : 'hover:bg-owner-canvas text-owner-heading'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-owner-canvas border border-owner-border/80 text-brand-plum flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-xs text-owner-heading truncate">
                          {nav.label}
                        </p>
                        <p className="text-[11px] text-owner-muted truncate">
                          {nav.description}
                        </p>
                      </div>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-owner-muted shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Command Palette Keyboard Hints Footer */}
        <div className="px-4 sm:px-6 py-2.5 border-t border-owner-border bg-owner-canvas/80 text-[11px] text-owner-muted flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-white border border-owner-border rounded shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-white border border-owner-border rounded shadow-2xs">
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[9px] bg-white border border-owner-border rounded shadow-2xs">
                ↵
              </kbd>
              <span>to select</span>
            </span>
          </div>

          <span className="hidden sm:inline text-[10px]">
            Tip: Press <kbd className="font-mono text-[9px]">Ctrl+K</kbd> anywhere to open
          </span>
        </div>
      </div>
    </div>
  );
};
