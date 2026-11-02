'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Store, SlidersHorizontal, RotateCcw, Compass, AlertCircle, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
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
  currentPage?: number;
  totalPages?: number;
  totalElements?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  viewAllHref?: string;
  viewAllLabel?: string;
  columns?: 2 | 3 | 'auto';
  selectedShopId?: number | null;
  onSelectShop?: (shop: Shop | null) => void;
  hoveredShopId?: number | null;
  onHoverShop?: (shopId: number | null) => void;
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
  currentPage = 0,
  totalPages = 1,
  totalElements,
  pageSize = 12,
  onPageChange,
  onPageSizeChange,
  viewAllHref,
  viewAllLabel,
  columns = 3,
  selectedShopId,
  onSelectShop,
  hoveredShopId,
  onHoverShop,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const gridClass = columns === 2
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-5'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

  const total = typeof totalElements === 'number' ? totalElements : shops.length;
  const startRecord = total === 0 || shops.length === 0 ? 0 : currentPage * pageSize + 1;
  const endRecord = total === 0 || shops.length === 0 ? 0 : Math.min(currentPage * pageSize + shops.length, total);

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || (totalPages > 0 && newPage >= totalPages)) {
      return;
    }
    onPageChange?.(newPage);
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
    <section ref={sectionRef} id="bakery-grid" className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-burgundy inline-block" />
            <span className="text-xs font-semibold tracking-wider uppercase text-brand-muted">
              Artisanal Network
            </span>
          </div>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-brand-espresso">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-xl">
            {subtitle}
          </p>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex items-center gap-3">
          {onSortChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-muted hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="text-xs font-semibold text-brand-espresso bg-white border border-brand-border rounded-xl px-3 py-2 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-plum/20 cursor-pointer"
              >
                <option value="default">Featured</option>
                <option value="rating">Highest Rated</option>
                <option value="distance">Nearest to Me</option>
                <option value="newest">Recently Joined</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>
          )}

          {viewAllHref && !isLoading && shops.length > 0 && (
            <Link
              href={viewAllHref}
              id="header-view-all-bakeries"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum hover:text-brand-burgundy transition-colors px-3 py-2 rounded-xl hover:bg-brand-blush/40"
            >
              <span>{viewAllLabel || 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Skeletons while Loading */}
      {isLoading && (
        <div className={gridClass}>
          {Array.from({ length: 6 }).map((_, i) => (
            <BakeryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-rose-100 shadow-soft max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
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
              <Link
                href={viewAllHref || '/explore'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-plum text-white text-xs font-semibold shadow-soft hover:bg-brand-plum-hover transition-all"
              >
                <Compass className="w-3.5 h-3.5" />
                Explore All Bakeries
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Real Bakery Cards */}
      {!isLoading && !error && shops.length > 0 && (
        <div className={gridClass}>
          {sortedShops.map((shop) => (
            <BakeryCard
              key={shop.id}
              shop={shop}
              isSelected={shop.id === selectedShopId}
              onSelect={() => onSelectShop?.(shop)}
              onMouseEnter={() => onHoverShop?.(shop.id)}
              onMouseLeave={() => onHoverShop?.(null)}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls on /explore */}
      {onPageChange && !isLoading && !error && shops.length > 0 && (totalPages > 1 || (onPageSizeChange && total > 12)) && (
        <div className="mt-12 pt-6 border-t border-brand-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Record range */}
          <div className="text-xs text-brand-muted order-2 sm:order-1">
            Showing <span className="font-bold text-brand-espresso">{startRecord}</span>-
            <span className="font-bold text-brand-espresso">{endRecord}</span> of{' '}
            <span className="font-bold text-brand-espresso">{total}</span> bakeries
          </div>

          {/* Page Buttons and Page-Size Selector */}
          <div className="flex items-center gap-3 order-1 sm:order-2">
            {onPageSizeChange && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[11px] text-brand-muted">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
                  className="text-xs font-semibold text-brand-espresso bg-white border border-brand-border rounded-lg px-2 py-1 shadow-xs focus:outline-none focus:ring-1 focus:ring-brand-plum cursor-pointer"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="px-2.5 py-1 text-xs rounded-xl border-brand-border disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                Previous
              </Button>
              <span className="text-xs font-bold text-brand-espresso px-2">
                Page {currentPage + 1} of {Math.max(1, totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="px-2.5 py-1 text-xs rounded-xl border-brand-border disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View All Bakeries Navigation Banner on Homepage */}
      {viewAllHref && !isLoading && !error && shops.length > 0 && (
        <div className="mt-12 pt-8 border-t border-brand-border/60 text-center flex flex-col items-center justify-center space-y-3">
          <Link
            href={viewAllHref}
            id="bottom-view-all-bakeries"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-brand-plum text-white font-semibold text-sm shadow-soft hover:bg-brand-plum-hover transition-all duration-200 group"
          >
            <span>{viewAllLabel || 'View All Bakeries'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          {totalElements && totalElements > shops.length ? (
            <p className="text-xs text-brand-muted">
              Showing {shops.length} of {totalElements} bakeries matching your criteria. Discover all available bakeries on the explore page.
            </p>
          ) : (
            <p className="text-xs text-brand-muted">
              Discover all verified artisanal cake bakers and boutique studios across India.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
