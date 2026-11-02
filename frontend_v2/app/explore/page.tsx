'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { X, SlidersHorizontal, MapPin, Clock, Map as MapIcon, LayoutGrid } from 'lucide-react';
import { storefrontApi } from '@/lib/api/storefront';
import { Shop } from '@/types/shop';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { SearchBar } from '@/components/common/SearchBar';
import { BakeryGrid } from '@/components/customer/marketplace/BakeryGrid';
import { CategoryPills, CategoryOption } from '@/components/customer/marketplace/CategoryPills';
import { AdvancedLocationFilter, LocationFilterValues } from '@/components/customer/marketplace/AdvancedLocationFilter';
import { TopRatedSection } from '@/components/customer/marketplace/TopRatedSection';
import { DietaryFilter } from '@/components/customer/marketplace/DietaryFilter';

const BakeryMap = dynamic(
  () => import('@/components/customer/marketplace/BakeryMap').then((mod) => mod.BakeryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] w-full bg-brand-cream/40 rounded-3xl animate-pulse flex flex-col items-center justify-center text-xs text-brand-muted border border-brand-border/60">
        <MapPin className="w-8 h-8 text-brand-plum/40 animate-bounce mb-2" />
        <span>Loading interactive map...</span>
      </div>
    ),
  }
);

function parseValidPageSize(sizeParam: string | null, defaultSize = 12): number {
  if (!sizeParam) return defaultSize;
  const trimmed = sizeParam.trim();
  // Strictly positive integer digits without decimals or signs
  if (!/^\d+$/.test(trimmed)) return defaultSize;
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 100) return defaultSize;
  return parsed;
}

function normalizeBusinessType(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase().replaceAll('-', '_');
  if (upper === 'HOME_BAKER') return 'HOME_BAKERY';
  if (upper === 'PASTRY_SHOP') return 'BAKERY_SHOP';
  if (upper === 'CUSTOM_CAKE_STUDIO') return 'CAKE_STUDIO';
  if (upper === 'COMMERCIAL_BAKERY') return 'ONLINE_CAKE_BUSINESS';
  return upper;
}

function parseValidPageIndex(pageParam: string | null): number {
  if (!pageParam) return 0;
  const trimmed = pageParam.trim();
  if (!/^\d+$/.test(trimmed)) return 0;
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function ExploreContent() {
  const router = useRouter();
  const pathname = usePathname();
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
  const initialType = normalizeBusinessType(searchParams.get('businessType'));

  const initialPage = parseValidPageIndex(searchParams.get('page'));
  const initialSize = parseValidPageSize(searchParams.get('size'));

  const initialOpenNow = searchParams.get('openNow') === 'true';
  const initialDietary = searchParams.get('dietary')
    ? searchParams.get('dietary')!.split(',').filter(Boolean)
    : [];

  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map & View Mode State
  const [viewMode, setViewMode] = useState<'grid' | 'split'>('grid');
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [hoveredShopId, setHoveredShopId] = useState<number | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialSize);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);

  const [openNow, setOpenNow] = useState<boolean>(initialOpenNow);
  const [selectedDietary, setSelectedDietary] = useState<string[]>(initialDietary);
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

  const searchRequestIdRef = useRef(0);

  // Synchronize URL with pagination state for bookmarking and history navigation
  const updatePaginationUrl = useCallback(
    (newPage: number, newSize?: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage > 0) {
        params.set('page', String(newPage));
      } else {
        params.delete('page');
      }
      const effectiveSize = newSize ?? pageSize;
      if (effectiveSize !== 12) {
        params.set('size', String(effectiveSize));
      } else {
        params.delete('size');
      }
      if (selectedDietary.length > 0) {
        params.set('dietary', selectedDietary.join(','));
      } else {
        params.delete('dietary');
      }
      const query = params.toString();
      const targetUrl = query ? `${pathname}?${query}` : pathname;
      router.push(targetUrl, { scroll: false });
    },
    [searchParams, pathname, router, pageSize, selectedDietary]
  );

  // Sync state when browser back/forward buttons change search params
  useEffect(() => {
    const validPage = parseValidPageIndex(searchParams.get('page'));
    setCurrentPage((prev) => (prev !== validPage ? validPage : prev));

    const validSize = parseValidPageSize(searchParams.get('size'));
    setPageSize((prev) => (prev !== validSize ? validSize : prev));

    const validOpenNow = searchParams.get('openNow') === 'true';
    setOpenNow((prev) => (prev !== validOpenNow ? validOpenNow : prev));

    const dietaryParam = searchParams.get('dietary');
    const validDietary = dietaryParam ? dietaryParam.split(',').filter(Boolean) : [];
    setSelectedDietary((prev) => {
      const prevKey = prev.slice().sort().join(',');
      const nextKey = validDietary.slice().sort().join(',');
      return prevKey !== nextKey ? validDietary : prev;
    });
  }, [searchParams]);

  const handleDietaryChange = useCallback(
    (newDietary: string[]) => {
      setSelectedDietary(newDietary);
      setCurrentPage(0);
      const params = new URLSearchParams(searchParams.toString());
      if (newDietary.length > 0) {
        params.set('dietary', newDietary.join(','));
      } else {
        params.delete('dietary');
      }
      params.delete('page');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const handleToggleOpenNow = useCallback(() => {
    const next = !openNow;
    setOpenNow(next);
    setCurrentPage(0);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('openNow', 'true');
    } else {
      params.delete('openNow');
    }
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [openNow, searchParams, pathname, router]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setCurrentPage(newPage);
      updatePaginationUrl(newPage, pageSize);
    },
    [pageSize, updatePaginationUrl]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(0);
      updatePaginationUrl(0, newSize);
    },
    [updatePaginationUrl]
  );

  const handleSortChange = useCallback(
    (newSort: string) => {
      setSortBy(newSort);
      setCurrentPage(0);
      updatePaginationUrl(0, pageSize);
    },
    [pageSize, updatePaginationUrl]
  );

  const fetchShops = useCallback(async () => {
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
        openNow: openNow ? true : undefined,
        dietary: selectedDietary.length > 0 ? selectedDietary : undefined,
        page: currentPage,
        size: pageSize,
      });

      if (requestId !== searchRequestIdRef.current) {
        return; // Stale asynchronous response discarded
      }

      const pagination = data.pagination;
      if (pagination) {
        setTotalPages(pagination.totalPages ?? (pagination.totalElements > 0 ? 1 : 0));
        setTotalElements(pagination.totalElements ?? data.length);

        // Out-of-range recovery: if current page exceeds total pages, jump to last available page
        if (pagination.totalElements > 0 && currentPage >= pagination.totalPages) {
          const validPage = Math.max(0, pagination.totalPages - 1);
          setCurrentPage(validPage);
          updatePaginationUrl(validPage, pageSize);
          return;
        }
      } else {
        // Fallback for unpaginated or legacy response
        setTotalPages(data.length > 0 ? 1 : 0);
        setTotalElements(data.length);
      }

      setShops(data || []);
    } catch (err: any) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setError(err.message || 'Failed to load bakeries');
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    searchQuery,
    locationQuery,
    locationFilters,
    geoParams,
    activeBusinessType,
    sortBy,
    openNow,
    selectedDietary,
    currentPage,
    pageSize,
    updatePaginationUrl,
  ]);

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
        dietary: selectedDietary.length > 0 ? selectedDietary : undefined,
        size: 4,
      });
      setTopRatedShops(data || []);
    } catch (err: any) {
      setTopRatedError(err.message || 'Failed to load top rated bakeries');
    } finally {
      setIsTopRatedLoading(false);
    }
  }, [searchQuery, locationQuery, locationFilters, geoParams, activeBusinessType, selectedDietary]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  useEffect(() => {
    fetchTopRatedShops();
  }, [fetchTopRatedShops]);

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
    setCurrentPage(0);
    updatePaginationUrl(0, pageSize);
  }, [pageSize, updatePaginationUrl]);

  const handleSelectCategory = useCallback((category: CategoryOption) => {
    setActiveCategory(category.id);
    setActiveBusinessType(category.businessType);
    setCurrentPage(0);
    updatePaginationUrl(0, pageSize);
  }, [pageSize, updatePaginationUrl]);

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
    setCurrentPage(0);
    updatePaginationUrl(0, pageSize);
  }, [pageSize, updatePaginationUrl]);

  const handleClearFilters = useCallback(() => {
    setActiveCategory('ALL');
    setActiveBusinessType(undefined);
    setSearchQuery('');
    setLocationQuery('');
    setGeoParams({});
    setLocationFilters({});
    setSortBy('default');
    setOpenNow(false);
    setSelectedDietary([]);
    setSelectedShopId(null);
    setCurrentPage(0);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('dietary');
    params.delete('search');
    params.delete('location');
    params.delete('city');
    params.delete('state');
    params.delete('district');
    params.delete('area');
    params.delete('pincode');
    params.delete('lat');
    params.delete('lng');
    params.delete('radius');
    params.delete('businessType');
    params.delete('openNow');
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

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
    setCurrentPage(0);
    updatePaginationUrl(0, pageSize);
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
        shopCount={totalElements || shops.length}
      />

      {/* Category Pills */}
      <div className="flex justify-center mb-4">
        <CategoryPills
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
        />
      </div>

      {/* Dietary Filters */}
      <div className="flex justify-center mb-6">
        <DietaryFilter
          selected={selectedDietary}
          onChange={handleDietaryChange}
        />
      </div>

      {/* Active Filter Ribbon */}
      {(searchQuery || locationQuery || activeCategory !== 'ALL' || openNow || selectedDietary.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 animate-in fade-in duration-200">
          <span className="text-xs font-semibold text-brand-muted">Active Filters:</span>
          {openNow && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open Now</span>
              <button
                onClick={handleToggleOpenNow}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                aria-label="Remove Open Now filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedDietary.map((pref) => {
            const label = pref.toLowerCase().replace(/_/g, ' ');
            const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
            return (
              <span
                key={pref}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium shadow-2xs"
              >
                <span>{capitalized}</span>
                <button
                  onClick={() => handleDietaryChange(selectedDietary.filter((d) => d !== pref))}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  aria-label={`Remove ${pref} filter`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-brand-border text-xs text-brand-espresso shadow-2xs">
              <span>Keyword: &quot;{searchQuery}&quot;</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(0);
                  updatePaginationUrl(0, pageSize);
                }}
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
                  setCurrentPage(0);
                  updatePaginationUrl(0, pageSize);
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
                    onClick={() => {
                      setGeoParams((prev) => ({ ...prev, radiusKm: r }));
                      setCurrentPage(0);
                      updatePaginationUrl(0, pageSize);
                    }}
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
                  setCurrentPage(0);
                  updatePaginationUrl(0, pageSize);
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

      {/* View & Availability Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white/70 backdrop-blur-xs p-3 sm:px-4 sm:py-3 rounded-2xl border border-brand-border/60 shadow-2xs">
        {/* Left: Open Now Quick Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleOpenNow}
            aria-pressed={openNow}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              openNow
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-brand-espresso border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${openNow ? 'text-white' : 'text-emerald-600'}`} />
            <span>Open Now</span>
            {openNow && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          </button>
          <span className="text-xs text-brand-muted hidden sm:inline">
            {openNow ? 'Showing currently open bakeries' : 'Filter by operating hours'}
          </span>
        </div>

        {/* Right: View Mode Toggle (Grid vs Split Map/Grid) */}
        <div className="flex items-center gap-1.5 bg-brand-cream/60 p-1 rounded-xl border border-brand-border/50">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-brand-plum font-bold shadow-2xs'
                : 'text-brand-muted hover:text-brand-espresso'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            aria-pressed={viewMode === 'split'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'split'
                ? 'bg-white text-brand-plum font-bold shadow-2xs'
                : 'text-brand-muted hover:text-brand-espresso'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map & List</span>
          </button>
        </div>
      </div>

      {/* Main Results View */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <BakeryGrid
              shops={shops}
              isLoading={isLoading}
              error={error}
              onRetry={fetchShops}
              onClearFilters={handleClearFilters}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              title={getTitle()}
              subtitle={
                locationQuery
                  ? `Showing verified kitchens delivering freshly baked celebration cakes in ${locationQuery}`
                  : 'Connect directly with certified creators for custom quotes and order delivery across India'
              }
              currentPage={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              columns={2}
              selectedShopId={selectedShopId}
              onSelectShop={(shop) => setSelectedShopId(shop ? shop.id : null)}
              hoveredShopId={hoveredShopId}
              onHoverShop={setHoveredShopId}
            />
          </div>
          <div className="lg:col-span-5 sticky top-24">
            <div className="bg-white rounded-3xl p-3 border border-brand-border/70 shadow-soft">
              <BakeryMap
                shops={shops}
                selectedShopId={selectedShopId}
                onSelectShop={(shop) => setSelectedShopId(shop ? shop.id : null)}
                hoveredShopId={hoveredShopId}
                className="h-[600px] w-full rounded-2xl"
              />
            </div>
          </div>
        </div>
      ) : (
        <BakeryGrid
          shops={shops}
          isLoading={isLoading}
          error={error}
          onRetry={fetchShops}
          onClearFilters={handleClearFilters}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          title={getTitle()}
          subtitle={
            locationQuery
              ? `Showing verified kitchens delivering freshly baked celebration cakes in ${locationQuery}`
              : 'Connect directly with certified creators for custom quotes and order delivery across India'
          }
          currentPage={currentPage}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          columns={3}
          selectedShopId={selectedShopId}
          onSelectShop={(shop) => setSelectedShopId(shop ? shop.id : null)}
          hoveredShopId={hoveredShopId}
          onHoverShop={setHoveredShopId}
        />
      )}
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
