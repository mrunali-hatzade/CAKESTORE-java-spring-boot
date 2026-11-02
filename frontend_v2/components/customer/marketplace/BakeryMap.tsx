'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Star, Clock, Store, ExternalLink, ShieldCheck, X, Maximize2 } from 'lucide-react';
import { Shop } from '@/types/shop';
import { Button } from '@/components/ui/Button';
import { getSafeImageUrl, FALLBACK_BAKERY_COVER } from '@/lib/utils/image';

interface BakeryMapProps {
  shops: Shop[];
  selectedShopId?: number | null;
  onSelectShop?: (shop: Shop | null) => void;
  hoveredShopId?: number | null;
  className?: string;
}

export const BakeryMap: React.FC<BakeryMapProps> = ({
  shops,
  selectedShopId,
  onSelectShop,
  hoveredShopId,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: number]: any }>({});
  const leafletModuleRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);

  // Filter shops with valid geographic coordinates
  const mappableShops = useMemo(() => {
    return shops.filter(
      (s) =>
        s.latitude != null &&
        s.longitude != null &&
        !isNaN(s.latitude) &&
        !isNaN(s.longitude) &&
        s.latitude >= -90 &&
        s.latitude <= 90 &&
        s.longitude >= -180 &&
        s.longitude <= 180
    );
  }, [shops]);

  const shopsWithoutCoordsCount = shops.length - mappableShops.length;

  // Custom SVG Pin Icon generator
  const createPinIcon = useCallback(
    (L: any, isSelected: boolean, isHovered: boolean, isOpenNow?: boolean) => {
      const isHighlighted = isSelected || isHovered;
      const baseColor = isHighlighted ? '#D97706' : '#78350F'; // Gold if highlighted, Brand Plum if normal
      const size = isHighlighted ? 42 : 34;
      const anchorY = isHighlighted ? 42 : 34;
      const anchorX = size / 2;

      const openIndicatorHtml =
        isOpenNow !== undefined
          ? `<div style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background-color: ${
              isOpenNow ? '#10B981' : '#9CA3AF'
            }; border: 2px solid #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`
          : '';

      const svgHtml = `
        <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s ease;">
          <svg viewBox="0 0 24 24" width="${size}" height="${size}" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
            <path fill="${baseColor}" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7.13 15.34 7.44 15.77.3.43.83.43 1.13 0C12.87 23.34 20 13.25 20 8c0-4.42-3.58-8-8-8z"/>
            <circle cx="12" cy="8" r="3.6" fill="#FFFFFF"/>
          </svg>
          <div style="position: absolute; top: ${size * 0.18}px; left: ${size * 0.35}px; pointer-events: none;">
            <svg width="${size * 0.3}" height="${size * 0.3}" viewBox="0 0 24 24" fill="none" stroke="${baseColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            </svg>
          </div>
          ${openIndicatorHtml}
        </div>
      `;

      return L.divIcon({
        className: 'custom-bakery-pin',
        html: svgHtml,
        iconSize: [size, size],
        iconAnchor: [anchorX, anchorY],
        popupAnchor: [0, -anchorY],
      });
    },
    []
  );

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    let isMounted = true;

    const initMap = async () => {
      // Ensure Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;
      leafletModuleRef.current = L;

      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const defaultCenter: [number, number] = [18.5204, 73.8567]; // Pune, India default
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
      });

      // Free OpenStreetMap Tile Layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync markers when mappable shops or map readiness changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletModuleRef.current) return;
    const map = mapInstanceRef.current;
    const L = leafletModuleRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker: any) => marker.remove());
    markersRef.current = {};

    if (mappableShops.length === 0) return;

    const bounds = L.latLngBounds([]);

    mappableShops.forEach((shop) => {
      const lat = shop.latitude!;
      const lng = shop.longitude!;
      const isSelected = shop.id === selectedShopId;
      const isHovered = shop.id === hoveredShopId;

      const marker = L.marker([lat, lng], {
        icon: createPinIcon(L, isSelected, isHovered, shop.isOpenNow),
        zIndexOffset: isSelected ? 1000 : isHovered ? 500 : 0,
      }).addTo(map);

      marker.on('click', () => {
        setActiveShop(shop);
        onSelectShop?.(shop);
      });

      markersRef.current[shop.id] = marker;
      bounds.extend([lat, lng]);
    });

    // Auto-fit bounds with padding
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [mapReady, mappableShops, createPinIcon, onSelectShop]);

  // Sync selected / hovered shop highlights without re-adding all markers
  useEffect(() => {
    if (!mapReady || !leafletModuleRef.current) return;
    const L = leafletModuleRef.current;

    mappableShops.forEach((shop) => {
      const marker = markersRef.current[shop.id];
      if (marker) {
        const isSelected = shop.id === selectedShopId;
        const isHovered = shop.id === hoveredShopId;
        marker.setIcon(createPinIcon(L, isSelected, isHovered, shop.isOpenNow));
        marker.setZIndexOffset(isSelected ? 1000 : isHovered ? 500 : 0);
      }
    });

    // Update activeShop state if selectedShopId changes
    if (selectedShopId != null) {
      const found = mappableShops.find((s) => s.id === selectedShopId);
      if (found) {
        setActiveShop(found);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([found.latitude!, found.longitude!], { animate: true });
        }
      }
    }
  }, [selectedShopId, hoveredShopId, mapReady, mappableShops, createPinIcon]);

  const handleRecenter = () => {
    if (!mapReady || !mapInstanceRef.current || !leafletModuleRef.current) return;
    const map = mapInstanceRef.current;
    const L = leafletModuleRef.current;
    const bounds = L.latLngBounds([]);
    mappableShops.forEach((s) => bounds.extend([s.latitude!, s.longitude!]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  return (
    <div className={`relative w-full h-full flex flex-col rounded-3xl overflow-hidden border border-brand-border/70 shadow-sm bg-stone-100 ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px] z-0" />

      {/* Top Overlay Bar: Info and Recenter */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-10">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-brand-border/60 shadow-xs text-xs font-semibold text-brand-espresso flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-brand-plum" />
          <span>
            {mappableShops.length} {mappableShops.length === 1 ? 'Bakery' : 'Bakeries'} on map
          </span>
          {shopsWithoutCoordsCount > 0 && (
            <span className="text-[11px] text-brand-muted font-normal">
              ({shopsWithoutCoordsCount} unpinned)
            </span>
          )}
        </div>

        {mappableShops.length > 0 && (
          <button
            type="button"
            onClick={handleRecenter}
            className="pointer-events-auto bg-white/95 hover:bg-white backdrop-blur-md px-2.5 py-1.5 rounded-full border border-brand-border/60 shadow-xs text-xs font-medium text-brand-espresso hover:text-brand-plum flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Fit all bakeries in view"
          >
            <Maximize2 className="w-3 h-3 text-brand-muted" />
            <span className="hidden sm:inline">Fit All</span>
          </button>
        )}
      </div>

      {/* Empty State when no shops have coordinates */}
      {mappableShops.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-stone-50/90 backdrop-blur-xs z-10 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-brand-blush/60 text-brand-plum flex items-center justify-center mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <h4 className="font-serif font-bold text-base text-brand-espresso">No Map Locations Pinned</h4>
          <p className="text-xs text-brand-muted max-w-xs mt-1">
            The bakeries in this search do not have geographic coordinates saved yet. Please use the list view to browse.
          </p>
        </div>
      )}

      {/* Compact Bakery Info Preview Card Overlay */}
      {activeShop && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-sm bg-white rounded-2xl border border-brand-border shadow-elevated p-3.5 z-20 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Bakery Logo / Thumbnail */}
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-cream border border-brand-border/60 shrink-0 relative">
                <img
                  src={getSafeImageUrl(activeShop.logoUrl || activeShop.coverImageUrl, FALLBACK_BAKERY_COVER)}
                  alt={activeShop.businessName}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-serif font-bold text-sm text-brand-espresso truncate">
                    {activeShop.businessName}
                  </h4>
                  {activeShop.verificationStatus === 'VERIFIED' && (
                    <span title="Verified Bakery" className="inline-flex">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-brand-muted truncate mt-0.5">
                  {[activeShop.area, activeShop.city].filter(Boolean).join(', ') || 'Local Bakery'}
                </p>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {/* Rating */}
                  {(activeShop.averageRating || activeShop.rating) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-espresso">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      {(activeShop.averageRating || activeShop.rating || 0).toFixed(1)}
                    </span>
                  ) : null}

                  {/* Open Status Badge */}
                  {activeShop.isOpenNow !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activeShop.isOpenNow
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {activeShop.openStatusText || (activeShop.isOpenNow ? 'Open Now' : 'Closed')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => {
                setActiveShop(null);
                onSelectShop?.(null);
              }}
              className="p-1 rounded-full text-brand-muted hover:text-brand-espresso hover:bg-stone-100 transition-colors"
              title="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Row */}
          <div className="mt-3 pt-2.5 border-t border-brand-border/60 flex items-center justify-between gap-2">
            {activeShop.latitude && activeShop.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeShop.latitude},${activeShop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-brand-muted hover:text-brand-plum flex items-center gap-1 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                Directions
              </a>
            )}

            <Link
              href={`/shop/${activeShop.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-plum hover:bg-brand-burgundy text-white text-xs font-semibold shadow-xs transition-colors ml-auto"
            >
              <Store className="w-3 h-3" />
              Visit Bakery
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
