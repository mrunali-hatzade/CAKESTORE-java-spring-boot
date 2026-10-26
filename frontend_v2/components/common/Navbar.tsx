'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cake, Menu, X, ShoppingBag, PackageCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/Button';
import { CustomerOrderLookupModal } from '@/components/customer/common/CustomerOrderLookupModal';
import { CartDrawer } from '@/components/customer/storefront/CartDrawer';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { totalItems, totalPrice, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orderLookupOpen, setOrderLookupOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Explore Bakeries', href: '/explore' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'For Owners', href: '/for-owners' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Contact Us', href: '/contact' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-brand-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-plum text-white flex items-center justify-center shadow-soft">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-brand-espresso block leading-none">
                CakeStore
              </span>
              <span className="text-[10px] tracking-wider uppercase text-brand-muted font-medium">
                Artisanal Bakery Network
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive
                      ? 'text-brand-plum font-semibold'
                      : 'text-brand-espresso/75 hover:text-brand-plum hover:bg-brand-blush/40'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-brand-plum rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Customer & Seller Actions */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {/* Live Order Tracking Lookup */}
            <button
              onClick={() => setOrderLookupOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-espresso/80 hover:text-brand-plum px-2.5 py-1.5 rounded-xl hover:bg-brand-blush/60 transition-colors"
              title="Track live cake order status"
            >
              <PackageCheck className="w-4 h-4 text-brand-plum" />
              <span className="hidden xl:inline">Track Order</span>
            </button>

            {/* Live Store Basket Trigger (visible when items are in cart) */}
            {totalItems > 0 && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-plum text-white text-xs font-semibold hover:bg-brand-plum-hover transition-all shadow-xs active:scale-95"
                title="View your store basket"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Basket</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">
                  {totalItems}
                </span>
              </button>
            )}

            <div className="h-4 w-px bg-brand-border/80 mx-1" />

            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-brand-espresso hover:text-brand-plum font-semibold text-xs">
                Owner Login
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="primary" size="sm" className="shadow-xs font-bold text-xs">
                Register Bakery
              </Button>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            {totalItems > 0 && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="p-2 rounded-xl bg-brand-plum text-white relative shadow-xs"
                aria-label="Open basket"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-brand-espresso text-[9px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-brand-espresso hover:bg-brand-cream-light rounded-xl transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-brand-border/60 bg-white px-4 pt-3 pb-6 space-y-1 shadow-elevated">
            {/* Mobile Track Order Button */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setOrderLookupOpen(true);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-brand-blush/60 text-brand-plum text-xs font-bold mb-2"
            >
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4" />
                <span>Track Your Cake Order</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Enter ID →</span>
            </button>

            {navLinks.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-blush text-brand-plum font-semibold'
                      : 'text-brand-espresso hover:bg-brand-cream-light'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-3 border-t border-brand-border/60 flex flex-col gap-2 mt-2">
              <Link href="/onboarding" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" className="w-full font-bold" size="sm">
                  Register Bakery
                </Button>
              </Link>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full font-semibold" size="sm">
                  Owner Login
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Customer Order Tracking Lookup Modal */}
      <CustomerOrderLookupModal
        isOpen={orderLookupOpen}
        onClose={() => setOrderLookupOpen(false)}
      />

      {/* Slide-out Cart/Basket Drawer */}
      <CartDrawer />
    </>
  );
};
