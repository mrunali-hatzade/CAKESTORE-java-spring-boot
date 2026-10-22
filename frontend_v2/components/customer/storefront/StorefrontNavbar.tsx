'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  Search,
  Phone,
  Heart,
  X,
  Menu,
  Home,
  Info,
  Tag,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Truck,
  ShieldCheck,
  MapPin,
  MessageCircle,
  Leaf,
  Star,
  UserCircle,
  RefreshCcw,
  ChevronRight,
} from 'lucide-react';
import { Shop } from '@/types/shop';
import { StorefrontTab } from './StorefrontTabNav';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils/cn';
import { isDummyOrInvalidImageUrl } from '@/lib/utils/image';
import { clearAuthSession } from '@/lib/api/axiosInterceptor';

interface StorefrontNavbarProps {
  shop: Shop;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Current active storefront tab — used to highlight the active item in the hamburger menu and menu bar */
  activeTab?: StorefrontTab;
  /** Called when a menu item is selected — switches tab */
  onNavigateTab?: (tab: StorefrontTab) => void;
  productCount?: number;
  offersCount?: number;
}

interface MobileMenuItem {
  id: StorefrontTab;
  label: string;
  icon: React.ElementType;
}

const MOBILE_MENU_ITEMS: MobileMenuItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'shop', label: 'Shop Cakes', icon: ShoppingBag },
  { id: 'custom-cakes', label: 'Custom Orders', icon: Sparkles },
  { id: 'contact', label: 'Contact Us', icon: MessageSquare },
  { id: 'offers', label: 'Offers & Coupons', icon: Tag },
  { id: 'gallery', label: 'Cake Gallery', icon: ImageIcon },
  { id: 'track', label: 'My Orders', icon: Truck },
  { id: 'profile', label: 'My Profile', icon: UserCircle },
  { id: 'about', label: 'About Us', icon: Info },
];

export const StorefrontNavbar: React.FC<StorefrontNavbarProps> = ({
  shop,
  searchQuery = '',
  onSearchChange,
  activeTab = 'home',
  onNavigateTab,
  productCount = 0,
  offersCount = 0,
}) => {
  const { totalItems, setIsCartOpen } = useCart();
  const { totalFavorites, setIsFavoritesOpen } = useFavorites();
  const [internalQuery, setInternalQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkNavScroll = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const hasMore = el.scrollWidth - el.clientWidth - el.scrollLeft > 4;
    setCanScrollRight(hasMore);
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    checkNavScroll();
    el.addEventListener('scroll', checkNavScroll, { passive: true });
    window.addEventListener('resize', checkNavScroll);
    return () => {
      el.removeEventListener('scroll', checkNavScroll);
      window.removeEventListener('resize', checkNavScroll);
    };
  }, [checkNavScroll]);

  const currentQuery = onSearchChange !== undefined ? searchQuery : internalQuery;
  const handleQueryChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalQuery(val);
    }
  };

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const handleMenuItemClick = (tab: StorefrontTab) => {
    setIsMobileMenuOpen(false);
    if (onNavigateTab) onNavigateTab(tab);
  };

  const customCakesEnabled = shop.storefrontSettings?.customCakesEnabled !== false;
  const visibleMenuItems = MOBILE_MENU_ITEMS.filter(
    (item) => !(item.id === 'custom-cakes' && !customCakesEnabled)
  );

  const allMenuTabs: { id: StorefrontTab; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'shop', label: 'Shop Cakes', icon: ShoppingBag, badge: productCount > 0 ? productCount : undefined },
    { id: 'about', label: 'About Us', icon: Info },
    { id: 'offers', label: 'Offers & Coupons', icon: Tag, badge: offersCount > 0 ? offersCount : undefined },
    { id: 'custom-cakes', label: 'Custom Cakes', icon: Sparkles },
    { id: 'gallery', label: 'Cake Gallery', icon: ImageIcon },
    { id: 'contact', label: 'Contact Us', icon: MessageSquare },
    { id: 'track', label: 'My Orders', icon: Truck },
    { id: 'profile', label: 'My Profile', icon: UserCircle },
  ];

  const menuTabs = allMenuTabs.filter((tab) => {
    if (tab.id === 'custom-cakes' && !customCakesEnabled) return false;
    return true;
  });

  const addressParts = [shop.area, shop.city, shop.state].filter(Boolean);
  const displayAddress =
    addressParts.length > 0 ? addressParts.join(', ') : `${shop.city || 'Pune'}, ${shop.state || 'Maharashtra'}`;

  const rawPhone = shop.whatsappNumber || shop.phone || shop.businessPhone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const fssaiNumber = shop.fssaiRegistration || (shop as any).fssaiLicenseNumber;
  const whatsappEnabled = shop.storefrontSettings?.whatsappEnabled !== false;
  const effectiveRating = shop.averageRating ?? shop.rating;
  const effectiveTotalReviews = shop.totalReviews ?? shop.reviewCount ?? 0;

  return (
    <div ref={menuRef} className="sticky top-0 z-30">
      <header className="bg-[#FAF7F2]/95 backdrop-blur-md border-b border-brand-border/60">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[78px] flex items-center justify-between gap-4 sm:gap-6">
          {/* Bakery Brand Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/explore"
              className="p-2 -ml-2 rounded-full text-brand-muted hover:text-brand-espresso hover:bg-brand-cream/60 transition-colors cursor-pointer shrink-0"
              title="Back to marketplace"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-blush text-brand-plum flex items-center justify-center font-serif font-bold text-lg shadow-sm border border-brand-plum/10 overflow-hidden shrink-0">
                {!isDummyOrInvalidImageUrl(shop.logoUrl) ? (
                  <img
                    src={shop.logoUrl}
                    alt={shop.businessName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  shop.businessName.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                  <h1 className="font-serif font-bold text-base sm:text-lg lg:text-xl text-[#2C1A1D] leading-tight truncate">
                    {shop.businessName}
                  </h1>

                  {/* Overall Bakery Rating Badge (like Zomato/Swiggy/Google Maps) */}
                  {effectiveRating && effectiveRating > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateTab) onNavigateTab('home');
                        setTimeout(() => {
                          document.getElementById('customer-experiences-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs transition-colors shrink-0 cursor-pointer"
                      title="View all verified customer reviews & ratings"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{effectiveRating.toFixed(1)}</span>
                      {effectiveTotalReviews > 0 && (
                        <span className="text-amber-800/80 font-normal">({effectiveTotalReviews})</span>
                      )}
                    </button>
                  ) : null}

                  {shop.verificationStatus === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Verified ✓</span>
                    </span>
                  )}
                  {shop.isPureVeg && (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 shrink-0">
                      <Leaf className="w-3 h-3 text-green-600" />
                      <span>100% Pure Veg</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-brand-muted mt-0.5">
                  <span className="flex items-center gap-1 shrink-0 text-brand-espresso font-medium">
                    <MapPin className="w-3 h-3 text-[#5C1D2E] shrink-0" />
                    <span>{displayAddress}</span>
                  </span>
                  <span className="text-[#C5A880] font-medium hidden sm:inline shrink-0">
                    • {shop.businessCategory || (shop.businessType ? shop.businessType.replace(/_/g, ' ') : 'Artisanal Bakery Studio')}
                  </span>
                  {fssaiNumber && (
                    <span className="text-emerald-700 font-semibold hidden md:inline shrink-0">
                      • FSSAI: {fssaiNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Centered Pill Search Bar — desktop only */}
          <div className="flex-1 max-w-xs lg:max-w-sm mx-2 hidden md:block">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-brand-muted group-focus-within:text-brand-plum transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-9 py-1.5 bg-white border border-brand-border rounded-full text-xs placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all shadow-sm"
                placeholder="Search cakes, flavours, categories..."
                value={currentQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
              />
              {currentQuery && (
                <button
                  type="button"
                  onClick={() => handleQueryChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-espresso cursor-pointer p-1"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* In-Store Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* WhatsApp Bakery Button */}
            {whatsappEnabled && cleanPhone && (
              <a
                href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=Hi%20${encodeURIComponent(shop.businessName)},%20I%20have%20an%20enquiry.`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-xs font-bold hover:bg-[#1ebd5a] transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Bakery</span>
              </a>
            )}
            {shop.storefrontSettings?.phoneEnabled !== false && (shop.phone || shop.businessPhone) && (
              <a
                href={`tel:${shop.phone || shop.businessPhone}`}
                className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted hover:text-[#5C1D2E] transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>{shop.phone || shop.businessPhone}</span>
              </a>
            )}

            {/* Saved Cakes Wishlist Button */}
            <button
              type="button"
              onClick={() => setIsFavoritesOpen(true)}
              className="relative p-2.5 rounded-full bg-white border border-brand-border text-brand-espresso hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm group cursor-pointer"
              aria-label="Open saved cakes wishlist"
              title="Saved Cakes Wishlist"
            >
              <Heart
                className={`w-5 h-5 group-hover:scale-110 transition-transform ${
                  totalFavorites > 0 ? 'text-rose-500 fill-rose-500/30' : 'text-brand-espresso'
                }`}
              />
              {totalFavorites > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-[#FAF7F2] shadow-sm">
                  {totalFavorites}
                </span>
              )}
            </button>

            {/* Floating Cart Counter */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-full bg-white border border-brand-border text-brand-espresso hover:text-[#5C1D2E] hover:border-[#5C1D2E]/30 transition-all shadow-sm group cursor-pointer"
              aria-label="Open cart"
              title="Store Basket"
            >
              <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-[#5C1D2E] text-white text-[10px] font-bold rounded-full border-2 border-[#FAF7F2] shadow-sm">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Reset Session Button (Desktop) */}
            <button
              type="button"
              onClick={() => {
                clearAuthSession();
                window.location.reload();
              }}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-brand-border text-brand-espresso hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm cursor-pointer"
              aria-label="Reset session and log out"
              title="Reset Session"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="text-xs font-bold hidden xl:inline">Reset Session</span>
            </button>

            {/* Mobile Hamburger Button — only on small screens */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="md:hidden p-2.5 rounded-full bg-white border border-brand-border text-brand-espresso hover:text-brand-plum hover:border-brand-plum/30 transition-all shadow-sm cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-brand-muted" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-9 py-2 bg-white border border-brand-border rounded-full text-sm placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-plum shadow-sm"
              placeholder="Search cakes..."
              value={currentQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
            {currentQuery && (
              <button
                type="button"
                onClick={() => handleQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-espresso cursor-pointer p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Mini-Website Menu Nav Tabs (Directly merged below main navbar) */}
        {onNavigateTab && (
          <div className="border-t border-brand-border/60 bg-white/70 backdrop-blur-xs">
            <div className="relative w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12">
              <nav
                ref={navScrollRef}
                className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2 no-scrollbar scroll-smooth"
                aria-label="Bakery Mini-Website Tabs"
              >
                {menuTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onNavigateTab(tab.id)}
                      className={cn(
                        'inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 select-none cursor-pointer',
                        isActive
                          ? 'bg-[#5C1D2E] text-white shadow-xs'
                          : 'bg-brand-cream-light/80 text-brand-espresso hover:bg-brand-blush hover:text-[#5C1D2E] border border-brand-border/50'
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-[#5C1D2E]')} />
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span
                          className={cn(
                            'ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                            isActive ? 'bg-white/20 text-white' : 'bg-brand-cream text-brand-espresso'
                          )}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Mobile/Tablet Horizontal Scroll Indicator */}
              {canScrollRight && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 sm:right-8 lg:right-12 top-0 bottom-0 w-10 sm:w-12 bg-gradient-to-l from-white via-white/80 to-transparent flex items-center justify-end pr-1 text-[#5C1D2E]/70 transition-opacity duration-300"
                >
                  <ChevronRight className="w-4 h-4 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Navigation Overlay Menu */}
      {onNavigateTab && isMobileMenuOpen && (
        <>
          {/* Backdrop — fades background, doesn't fully block */}
          <div
            className="fixed inset-0 z-40 bg-brand-espresso/40 backdrop-blur-sm md:hidden"
            aria-hidden="true"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Slide-down menu panel */}
          <div
            className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white shadow-elevated border-l border-brand-border/60 flex flex-col md:hidden overflow-y-auto"
            role="dialog"
            aria-label="Navigation menu"
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-blush text-brand-plum flex items-center justify-center font-serif font-bold text-sm overflow-hidden shrink-0">
                  {!isDummyOrInvalidImageUrl(shop.logoUrl) ? (
                    <img src={shop.logoUrl} alt={shop.businessName} className="w-full h-full object-cover" />
                  ) : (
                    shop.businessName.charAt(0)
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-espresso font-serif line-clamp-1">{shop.businessName}</p>
                  <p className="text-[10px] text-brand-muted">{shop.city}, {shop.state}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-full text-brand-muted hover:text-brand-espresso hover:bg-brand-cream transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Mobile storefront navigation">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuItemClick(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left',
                      isActive
                        ? 'bg-brand-plum text-white shadow-sm'
                        : 'text-brand-espresso hover:bg-brand-blush/60 hover:text-brand-plum'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isActive ? 'text-white' : 'text-brand-plum'
                      )}
                    />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Back to marketplace link */}
            <div className="px-5 py-4 border-t border-brand-border/60 shrink-0">
              <Link
                href="/explore"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 text-xs font-medium text-brand-muted hover:text-brand-plum transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Marketplace</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  clearAuthSession();
                  window.location.reload();
                }}
                className="flex items-center gap-2 mt-4 text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors w-full cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Reset Session (Start Over)</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
