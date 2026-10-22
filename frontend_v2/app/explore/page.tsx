'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { X, SlidersHorizontal, MapPin } from 'lucide-react';
import { storefrontApi } from '@/lib/api/storefront';
import { Shop } from '@/types/shop';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { SearchBar } from '@/components/common/SearchBar';
import { BakeryGrid } from '@/components/customer/marketplace/BakeryGrid';
import { CategoryPills, CategoryOption } from '@/components/customer/marketplace/CategoryPills';
import { AdvancedLocationFilter, LocationFilterValues } from '@/components/customer/marketplace/AdvancedLocationFilter';
import { TopRatedSection } from '@/components/customer/marketplace/TopRatedSection';

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialLocation = searchParams.get('location') || '';
  const initialCity = searchParams.get('city') || '';
  const initialState = searchParams.get('state') || '';
  const initialDistrict = searchParams.get('district') || '';
  const initialArea = searchParams.get('area') || '';
  const initialPincode = searchParams.get('pincode') || '';
  const initialLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined;
  const initialLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined;
  const initialRadius = searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : 10;
  const initialType = searchParams.get('businessType') || undefined;

  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>(initialType || 'ALL');
  const [activeBusinessType, setActiveBusinessType] = useState<string | undefined>(initialType);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [locationQuery, setLocationQuery] = useState<string>(initialLocation || initialCity);
  const [locationFilters, setLocationFilters] = useState<Partial<LocationFilterValues>>({
    state: initialState || undefined,
    district: initialDistrict || undefined,
    city: initialCity || undefined,
    area: initialArea || undefined,
    pincode: initialPincode || undefined,
  });
  const [geoParams, setGeoParams] = useState<{ latitude?: number; longitude?: number; radiusKm?: number }>(
    initialLat && initialLng
      ? { latitude: initialLat, longitude: initialLng, radiusKm: initialRadius }
      : {}
  );
  const [sortBy, setSortBy] = useState<string>('default');

  const [topRatedShops, setTopRatedShops] = useState<Shop[]>([]);
  const [isTopRatedLoading, setIsTopRatedLoading] = useState(true);
  const [topRatedError, setTopRatedError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
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
      });
      setShops(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bakeries');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, locationQuery, locationFilters, geoParams, activeBusinessType, sortBy]);

  const fetchTopRatedShops = useCallback(async () => {
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
      setTopRatedError(err.message || 'Failed to load top rated bakeries');
    } finally {
      setIsTopRatedLoading(false);
    }
  }, [searchQuery, locationQuery, locationFilters, geoParams, activeBusinessType]);

  useEffect(() => {
    fetchShops();
    fetchTopRatedShops();
  }, [fetchShops, fetchTopRatedShops]);

  const handleSearch = useCallback((params: {
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
  }, []);

  const handleSelectCategory = useCallback((category: CategoryOption) => {
    setActiveCategory(category.id);
    setActiveBusinessType(category.businessType);
  }, []);

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

  const handleClearFilters = useCallback(() => {
    setActiveCategory('ALL');
    setActiveBusinessType(undefined);
    setSearchQuery('');
    setLocationQuery('');
    setGeoParams({});
    setLocationFilters({});
    setSortBy('default');
  }, []);

  const POPULAR_CITIES = ['Pune', 'Mumbai', 'Bengaluru'] as const;

  const handleSelectCityChip = (city: string) => {
    const isCurrentlyActive =
      locationFilters.city?.toLowerCase() === city.toLowerCase() ||
      (Boolean(locationQuery) && locationQuery.trim().toLowerCase() === city.toLowerCase());

    if (isCurrentlyActive) {
      // Toggle off / deselect
      setLocationQuery('');
      setLocationFilters((prev) => ({ ...prev, city: undefined }));
    } else {
      setGeoParams({});
      setLocationQuery(city);
      setLocationFilters({
        city,
      });
    }
  };

  const getTitle = () => {
    const isNearby = geoParams.latitude != null || locationQuery.toLowerCase().includes('near') || locationQuery.toLowerCase().includes('within');
    const locPrefix = isNearby
      ? 'Near You'
      : locationQuery
      ? `in ${locationQuery}`
      : 'Across India';
    if (activeCategory !== 'ALL') {
      return `${activeCategory.replace(/_/g, ' ')} Bakeries ${locPrefix}`;
    }
    return `All Verified Bakeries ${locPrefix}`;
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
      {/* Explorer Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-brand-espresso">
          Explore Artisanal Bakeries
        </h1>
        <p className="text-xs sm:text-sm text-brand-muted mt-2">
          Find independent pastry boutiques, home bakers, and custom cake studios in top Indian cities.
        </p>
      </div>

      {/* Dual Filter Search Bar */}
      <div className="max-w-2xl mx-auto mb-3">
        <SearchBar
          initialSearch={searchQuery}
          initialLocation={locationQuery}
          onSearch={handleSearch}
        />
      </div>

      {/* Popular City Shortcuts */}
      <div className="max-w-2xl mx-auto mb-5 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap text-xs">
        <span className="text-brand-muted font-medium flex items-center gap-1 pr-1">
          <MapPin className="w-3.5 h-3.5 text-brand-plum" />
          <span>Popular:</span>
        </span>
        {POPULAR_CITIES.map((city) => {
          const isActive =
            locationFilters.city?.toLowerCase() === city.toLowerCase() ||
            (Boolean(locationQuery) && locationQuery.trim().toLowerCase() === city.toLowerCase());
          return (
            <button
              key={city}
              type="button"
              onClick={() => handleSelectCityChip(city)}
              aria-pressed={isActive}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                isActive
                  ? 'bg-brand-plum text-white border-brand-plum shadow-xs'
                  : 'bg-white text-brand-espresso border-neutral-200 hover:border-brand-plum/40 hover:bg-brand-cream-light'
              }`}
            >
              {city}
            </button>
          );
        })}
      </div>

      {/* Advanced Location Filter */}
      <AdvancedLocationFilter 
        onFilterChange={handleLocationFilterChange}
        shopCount={shops.length}
      />

      {/* Category Pills */}
      <div className="flex justify-center mb-6">
        <CategoryPills
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
        />
      </div>

      {/* Active Filter Ribbon */}
      {(searchQuery || locationQuery || activeCategory !== 'ALL') && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 animate-in fade-in duration-200">
          <span className="text-xs font-semibold text-brand-muted">Active Filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-brand-border text-xs text-brand-espresso shadow-2xs">
              <span>Keyword: &quot;{searchQuery}&quot;</span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-brand-muted hover:text-brand-espresso"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {locationQuery && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-brand-border text-xs text-brand-espresso shadow-2xs">
              <span>Location: {locationQuery}</span>
              <button
                onClick={() => {
                  setLocationQuery('');
                  setLocationFilters({});
                  setGeoParams({});
                }}
                className="text-brand-muted hover:text-brand-espresso"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {geoParams.latitude != null && (
            <div className="inline-flex items-center gap-1 bg-white border border-brand-border rounded-full px-2.5 py-0.5 text-xs text-brand-espresso shadow-2xs">
              <span className="text-[11px] text-brand-muted font-medium pr-1">Radius:</span>
              {[5, 10, 20, 50].map((r) => {
                const isSelected = (geoParams.radiusKm || 10) === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setGeoParams((prev) => ({ ...prev, radiusKm: r }))}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand-plum text-white shadow-xs'
                        : 'text-brand-muted hover:text-brand-espresso hover:bg-brand-cream/80'
                    }`}
                  >
                    {r} km
                  </button>
                );
              })}
            </div>
          )}
          {activeCategory !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-blush border border-brand-blush-border text-xs text-brand-plum font-medium shadow-2xs">
              <span>Category: {activeCategory.replace(/_/g, ' ')}</span>
              <button
                onClick={() => {
                  setActiveCategory('ALL');
                  setActiveBusinessType(undefined);
                }}
                className="text-brand-plum hover:text-brand-espresso"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={handleClearFilters}
            className="text-xs text-brand-plum font-bold hover:underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Top Rated Bakeries in Customer's Area */}
      <TopRatedSection
        shops={topRatedShops}
        isLoading={isTopRatedLoading}
        error={topRatedError}
        title={
          geoParams.latitude != null || locationQuery.toLowerCase().includes('near')
            ? 'Top Rated Bakeries Near You'
            : locationQuery
            ? `Top Rated Bakeries in ${locationQuery}`
            : 'Top Rated Bakeries Across India'
        }
        subtitle={
          locationQuery
            ? `Highest rated cake studios delivering in ${locationQuery} based on verified customer reviews`
            : 'Highest rated artisanal kitchens and home bakers across India'
        }
      />

      {/* Grid */}
      <BakeryGrid
        shops={shops}
        isLoading={isLoading}
        error={error}
        onRetry={fetchShops}
        onClearFilters={handleClearFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
        title={getTitle()}
        subtitle={
          locationQuery
            ? `Showing verified kitchens delivering freshly baked celebration cakes in ${locationQuery}`
            : 'Connect directly with certified creators for custom quotes and order delivery across India'
        }
      />
    </main>
  );
}

export default function ExplorePage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream-light">
      <Navbar />
      <Suspense fallback={<div className="p-16 text-center font-serif text-brand-espresso">Loading Bakeries...</div>}>
        <ExploreContent />
      </Suspense>
      <Footer />
    </div>
  );
}
