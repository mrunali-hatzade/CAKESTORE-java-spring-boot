'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { storefrontApi } from '@/lib/api/storefront';
import { Shop } from '@/types/shop';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { HeroSection } from '@/components/customer/marketplace/HeroSection';
import { BakeryGrid } from '@/components/customer/marketplace/BakeryGrid';
import { BespokeCakeBridge } from '@/components/customer/marketplace/BespokeCakeBridge';
import { TrustBadges } from '@/components/customer/marketplace/TrustBadges';
import { OwnerCTA } from '@/components/customer/marketplace/OwnerCTA';
import { TopRatedSection } from '@/components/customer/marketplace/TopRatedSection';
import { CategoryOption } from '@/components/customer/marketplace/CategoryPills';
import { AdvancedLocationFilter, LocationFilterValues } from '@/components/customer/marketplace/AdvancedLocationFilter';

const HOMEPAGE_BAKERY_LIMIT = 12;

export default function HomePage() {
  const router = useRouter();

  const [shops, setShops] = useState<Shop[]>([]);
  const [totalElements, setTotalElements] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [activeBusinessType, setActiveBusinessType] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationQuery, setLocationQuery] = useState<string>('');
  const [locationFilters, setLocationFilters] = useState<Partial<LocationFilterValues>>({});
  const [geoParams, setGeoParams] = useState<{ latitude?: number; longitude?: number; radiusKm?: number }>({});
  const [sortBy, setSortBy] = useState<string>('default');

  const [topRatedShops, setTopRatedShops] = useState<Shop[]>([]);
  const [isTopRatedLoading, setIsTopRatedLoading] = useState(true);
  const [topRatedError, setTopRatedError] = useState<string | null>(null);

  const searchRequestIdRef = useRef(0);

  const loadShops = useCallback(async () => {
    const requestId = ++searchRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await storefrontApi.searchShops({
        search: searchQuery || undefined,
        location: locationQuery || undefined,
        state: locationFilters.state,
        district: locationFilters.district,
        city: locationFilters.city,
        area: locationFilters.area,
        pincode: locationFilters.pincode,
        latitude: geoParams.latitude,
        longitude: geoParams.longitude,
        radiusKm: geoParams.radiusKm,
        businessType: activeBusinessType,
        sortBy: sortBy === 'default' ? undefined : sortBy,
        page: 0,
        size: HOMEPAGE_BAKERY_LIMIT,
      });

      if (requestId !== searchRequestIdRef.current) {
        return; // Stale asynchronous response discarded
      }

      setShops(data || []);
      setTotalElements(data.pagination?.totalElements ?? (data ? data.length : 0));
    } catch (err: any) {
      if (requestId === searchRequestIdRef.current) {
        setError(err.message || 'Failed to discover bakeries.');
        setTotalElements(undefined);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [searchQuery, locationQuery, locationFilters, geoParams, activeBusinessType, sortBy]);

  const loadTopRatedShops = useCallback(async () => {
    setIsTopRatedLoading(true);
    setTopRatedError(null);
    try {
      const data = await storefrontApi.searchShops({
        search: searchQuery || undefined,
        location: locationQuery || undefined,
        state: locationFilters.state,
        district: locationFilters.district,
        city: locationFilters.city,
        area: locationFilters.area,
        pincode: locationFilters.pincode,
        latitude: geoParams.latitude,
        longitude: geoParams.longitude,
        radiusKm: geoParams.radiusKm,
        businessType: activeBusinessType,
        sortBy: 'rating',
        size: 4,
      });
      setTopRatedShops(data || []);
    } catch (err: any) {
      setTopRatedError(err.message || 'Failed to load top rated bakeries.');
    } finally {
      setIsTopRatedLoading(false);
    }
  }, [searchQuery, locationQuery, locationFilters, geoParams, activeBusinessType]);

  useEffect(() => {
    loadShops();
    loadTopRatedShops();
  }, [loadShops, loadTopRatedShops]);

  const handleHeroSearch = (params: {
    search: string;
    location: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  }) => {
    setSearchQuery(params.search);
    setLocationQuery(params.location);
    if (params.latitude && params.longitude) {
      setGeoParams({
        latitude: params.latitude,
        longitude: params.longitude,
        radiusKm: params.radiusKm || 10,
      });
      setLocationFilters({});
    } else {
      setGeoParams({});
      setLocationFilters({});
    }
  };

  const handleSelectCategory = (category: CategoryOption) => {
    setActiveCategory(category.id);
    setActiveBusinessType(category.businessType);
  };

  const handleLocationFilterChange = useCallback((filters: LocationFilterValues) => {
    if (filters.mode === 'NEARBY' && filters.latitude && filters.longitude) {
      setGeoParams({
        latitude: filters.latitude,
        longitude: filters.longitude,
        radiusKm: filters.radiusKm || 10,
      });
      setLocationFilters({});
      setLocationQuery(filters.label);
    } else {
      setGeoParams({});
      setLocationFilters({
        state: filters.state,
        district: filters.district,
        city: filters.city,
        area: filters.area,
        pincode: filters.pincode,
      });
      setLocationQuery(filters.label === 'All Locations' ? '' : filters.label);
    }
  }, []);

  const handleClearFilters = () => {
    setActiveCategory('ALL');
    setActiveBusinessType(undefined);
    setSearchQuery('');
    setLocationQuery('');
    setGeoParams({});
    setLocationFilters({});
    setSortBy('default');
  };

  // Dynamic grid title based on city and category
  const getGridTitle = () => {
    const isNearby = geoParams.latitude != null || locationQuery.toLowerCase().includes('near') || locationQuery.toLowerCase().includes('within');
    const locPrefix = isNearby
      ? 'Near You'
      : locationQuery
      ? `in ${locationQuery}`
      : 'Across India';

    if (activeCategory !== 'ALL') {
      return `${activeCategory.replace(/_/g, ' ')} Bakeries ${locPrefix}`;
    }
    return `Featured Artisanal Bakeries ${locPrefix}`;
  };

  const getExploreUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (locationQuery.trim() && !locationQuery.toLowerCase().startsWith('all')) {
      params.set('location', locationQuery.trim());
    }
    if (locationFilters.state?.trim() && !locationFilters.state.toLowerCase().startsWith('all')) {
      params.set('state', locationFilters.state.trim());
    }
    if (locationFilters.district?.trim() && !locationFilters.district.toLowerCase().startsWith('all')) {
      params.set('district', locationFilters.district.trim());
    }
    if (locationFilters.city?.trim() && !locationFilters.city.toLowerCase().startsWith('all')) {
      params.set('city', locationFilters.city.trim());
    }
    if (locationFilters.area?.trim() && !locationFilters.area.toLowerCase().startsWith('all')) {
      params.set('area', locationFilters.area.trim());
    }
    if (locationFilters.pincode?.trim() && !locationFilters.pincode.toLowerCase().startsWith('all')) {
      params.set('pincode', locationFilters.pincode.trim());
    }
    if (geoParams.latitude != null && !isNaN(geoParams.latitude) && geoParams.longitude != null && !isNaN(geoParams.longitude)) {
      params.set('lat', String(geoParams.latitude));
      params.set('lng', String(geoParams.longitude));
      if (geoParams.radiusKm != null && !isNaN(geoParams.radiusKm)) {
        params.set('radius', String(geoParams.radiusKm));
      }
    }
    if (activeBusinessType && activeBusinessType !== 'ALL' && activeBusinessType.trim()) {
      params.set('businessType', activeBusinessType.trim());
    }
    if (sortBy && sortBy !== 'default' && sortBy.trim()) {
      params.set('sortBy', sortBy.trim());
    }
    const query = params.toString();
    return query ? `/explore?${query}` : '/explore';
  }, [searchQuery, locationQuery, locationFilters, geoParams, activeBusinessType, sortBy]);

  const getViewAllLabel = () => {
    if (typeof totalElements === 'number' && totalElements > shops.length) {
      return `View All ${totalElements} Bakeries`;
    }
    return 'View All Bakeries';
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream-light">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section with Bakery Background */}
        <HeroSection
          onSearch={handleHeroSearch}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          selectedLocation={locationQuery}
          onSelectLocation={(loc) => {
            setLocationQuery(loc);
            setLocationFilters({});
          }}
        />

        {/* Standalone Advanced Location Filter */}
        <div className="px-4 sm:px-6 lg:px-8">
          <AdvancedLocationFilter
            onFilterChange={handleLocationFilterChange}
            shopCount={totalElements ?? shops.length}
          />
        </div>

        {/* Top Rated Bakeries Section */}
        <TopRatedSection
          shops={topRatedShops}
          isLoading={isTopRatedLoading}
          error={topRatedError}
        />

        {/* Featured Bakeries Grid */}
        <BakeryGrid
          shops={shops}
          isLoading={isLoading}
          error={error}
          onRetry={loadShops}
          onClearFilters={handleClearFilters}
          title={getGridTitle()}
          sortBy={sortBy}
          onSortChange={setSortBy}
          totalElements={totalElements}
          viewAllHref={getExploreUrl()}
          viewAllLabel={getViewAllLabel()}
          subtitle={
            locationQuery.toLowerCase().includes('near')
              ? 'Showing verified kitchens delivering freshly baked celebration cakes closest to your location'
              : locationQuery
              ? `Showing verified kitchens delivering freshly baked celebration cakes in ${locationQuery}`
              : 'Direct ordering from verified kitchens with dedicated in-store fulfillment across Indian cities'
          }
        />

        {/* Bespoke Custom Cake Studio Bridge */}
        <BespokeCakeBridge />

        {/* Trust & Food Safety Guarantees */}
        <TrustBadges />

        {/* Call to Action for Bakery Owners */}
        <OwnerCTA />
      </main>

      <Footer />
    </div>
  );
}
