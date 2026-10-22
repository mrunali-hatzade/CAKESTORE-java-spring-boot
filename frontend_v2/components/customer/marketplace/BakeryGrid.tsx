'use client';

import React, { useState } from 'react';
import { Store, SlidersHorizontal, RotateCcw, Compass, AlertCircle } from 'lucide-react';
import { Shop } from '@/types/shop';
import { BakeryCard } from './BakeryCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface BakeryGridProps {
  shops: Shop[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onClearFilters?: () => void;
  title?: string;
  subtitle?: string;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const BakeryCardSkeleton = () => (
  <Card className="h-full flex flex-col overflow-hidden border border-brand-border/70 bg-white p-0 rounded-3xl animate-pulse shadow-sm">
    {/* Image Skeleton */}
    <div className="aspect-[16/9] w-full bg-brand-cream/80 relative">
      <div className="absolute top-3 left-3 w-20 h-5 bg-white/70 rounded-full" />
      <div className="absolute top-3 right-3 w-14 h-5 bg-white/70 rounded-full" />
      <div className="absolute -bottom-4 left-5 w-13 h-13 rounded-2xl bg-white border-2 border-white shadow-sm" />
    </div>
    {/* Body Skeleton */}
    <div className="pt-6 p-5 sm:p-6 flex flex-col flex-1 space-y-3">
      <div className="h-5 bg-brand-cream/80 rounded-lg w-3/4" />
      <div className="h-3.5 bg-brand-cream/60 rounded-md w-1/2" />
      <div className="h-10 bg-brand-cream/40 rounded-xl w-full mt-2" />
      <div className="mt-4 pt-3 border-t border-brand-border/50 flex justify-between">
        <div className="h-4 bg-brand-cream/70 rounded-full w-24" />
        <div className="h-4 bg-brand-cream/70 rounded-full w-16" />
      </div>
      <div className="h-9 bg-brand-cream/70 rounded-xl w-full mt-3" />
    </div>
  </Card>
);

export const BakeryGrid: React.FC<BakeryGridProps> = ({
  shops,
  isLoading,
  error,
  onRetry,
  onClearFilters,
  title = 'Featured Bakeries',
  subtitle = 'Discover verified artisanal cake bakers in your area',
  sortBy = 'default',
  onSortChange,
}) => {
  const sortedShops = [...shops].sort((a, b) => {
    if (sortBy === 'distance') {
      const distA = a.distanceKm != null ? a.distanceKm : Infinity;
      const distB = b.distanceKm != null ? b.distanceKm : Infinity;
      return distA - distB;
    }
    if (sortBy === 'name') return (a.businessName || '').localeCompare(b.businessName || '');
    if (sortBy === 'city') return (a.city || '').localeCompare(b.city || '');
    return 0; // rating, newest, and default are pre-sorted by the backend
  });

  return (
    <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Grid Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-brand-border/60 gap-4 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">{subtitle}</p>
        </div>

        {/* Controls & Result Counter */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {isLoading ? (
            <span className="text-xs font-medium text-brand-muted">
              Searching kitchens...
            </span>
          ) : shops.length > 0 ? (
            <span className="text-xs font-semibold text-brand-espresso/80">
              {shops.length} {shops.length === 1 ? 'bakery' : 'bakeries'} found
            </span>
          ) : null}

          {shops.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-brand-espresso border border-brand-border rounded-xl px-2.5 py-1.5 bg-white shadow-2xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-plum shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => onSortChange?.(e.target.value)}
                className="bg-transparent focus:outline-none text-xs text-brand-espresso cursor-pointer"
              >
                <option value="default">Default Order</option>
                <option value="distance">Nearest First</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest Bakeries</option>
                <option value="name">Name (A-Z)</option>
                <option value="city">City</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <BakeryCardSkeleton key={idx} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-brand-border shadow-soft max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="font-serif font-bold text-xl text-brand-espresso">
            We couldn&apos;t load bakeries right now
          </h3>
          <p className="text-xs text-brand-muted mt-2 max-w-sm mx-auto leading-relaxed">
            {error || 'The server may be temporarily busy or unreachable. Please try again.'}
          </p>
          <div className="mt-6">
            <Button onClick={onRetry} size="sm">
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && shops.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-brand-border shadow-soft max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-brand-blush text-brand-plum flex items-center justify-center mx-auto mb-4">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="font-serif font-bold text-xl text-brand-espresso">
            No bakeries found
          </h3>
          <p className="text-xs text-brand-muted mt-2 max-w-sm mx-auto leading-relaxed">
            We couldn&apos;t find any verified kitchens matching your search, location, or selected category.
          </p>
          {onClearFilters && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={onClearFilters} variant="outline" size="sm" className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Filters
              </Button>
              <Button onClick={onClearFilters} size="sm" className="gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                Explore All Bakeries
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Real Bakery Cards */}
      {!isLoading && !error && shops.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedShops.map((shop) => (
            <BakeryCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </section>
  );
};
