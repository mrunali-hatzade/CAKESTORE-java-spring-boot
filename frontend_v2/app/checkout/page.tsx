'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Cake } from 'lucide-react';
import { useCart } from '@/context/CartContext';

/**
 * Legacy Checkout Redirection Handler
 *
 * CakeStore utilizes bakery-specific storefront checkout (/shop/[id]?tab=checkout)
 * to ensure hyper-local delivery validation, pricing, and multi-tenant inventory rules.
 * This route gracefully directs customers to their active bakery's storefront checkout,
 * or back to marketplace discovery (/explore) if the basket is empty.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { currentShopId, isHydrated } = useCart();

  useEffect(() => {
    if (!isHydrated) return;

    if (currentShopId) {
      router.replace(`/shop/${currentShopId}?tab=checkout`);
    } else {
      router.replace('/explore');
    }
  }, [isHydrated, currentShopId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream-light p-6">
      <div className="w-12 h-12 rounded-2xl bg-brand-plum text-white flex items-center justify-center shadow-soft animate-bounce mb-4">
        <Cake className="w-6 h-6" />
      </div>
      <p className="text-sm font-semibold text-brand-espresso">
        Redirecting to bakery checkout...
      </p>
      <p className="text-xs text-brand-muted mt-1">
        Taking you to your selected artisan bakery storefront.
      </p>
    </div>
  );
}
