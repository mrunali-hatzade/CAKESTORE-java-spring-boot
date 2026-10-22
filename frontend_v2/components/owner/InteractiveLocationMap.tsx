'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapPin,
  Crosshair,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface LocationMapCoordinates {
  latitude?: number;
  longitude?: number;
  isConfirmed: boolean;
  isApproximate: boolean;
  accuracyType?: 'PRECISE_ADDRESS' | 'APPROXIMATE_PINCODE' | 'OWNER_CONFIRMED' | 'GPS_DEVICE' | 'NOT_SET';
}

interface InteractiveLocationMapProps {
  initialLatitude?: number;
  initialLongitude?: number;
  initialConfirmed?: boolean;
  addressContext?: {
    addressLine1?: string;
    city?: string;
    area?: string;
    state?: string;
    pincode?: string;
  };
  onChange: (coords: LocationMapCoordinates) => void;
  disabled?: boolean;
}

export default function InteractiveLocationMap({
  initialLatitude,
  initialLongitude,
  initialConfirmed = false,
  addressContext,
  onChange,
  disabled = false,
}: InteractiveLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [lat, setLat] = useState<number | undefined>(initialLatitude);
  const [lng, setLng] = useState<number | undefined>(initialLongitude);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(
    initialConfirmed || (initialLatitude !== undefined && initialLongitude !== undefined)
  );
  const [isApproximate, setIsApproximate] = useState<boolean>(false);
  const [accuracyType, setAccuracyType] = useState<
    'PRECISE_ADDRESS' | 'APPROXIMATE_PINCODE' | 'OWNER_CONFIRMED' | 'GPS_DEVICE' | 'NOT_SET'
  >(initialLatitude ? 'OWNER_CONFIRMED' : 'NOT_SET');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Fallback center: Pune, India (18.5204, 73.8567) if no coordinates available
  const defaultCenter = [18.5204, 73.8567] as [number, number];

  // Helper to construct custom SVG pin icon
  const createCustomPinIcon = useCallback((L: any, confirmed: boolean, approx: boolean) => {
    const pinColor = confirmed ? '#059669' : approx ? '#D97706' : '#78350F';
    const svgIcon = `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="36" height="36" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <path fill="${pinColor}" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7.13 15.34 7.44 15.77.3.43.83.43 1.13 0C12.87 23.34 20 13.25 20 8c0-4.42-3.58-8-8-8z"/>
          <circle cx="12" cy="8" r="3.5" fill="#FFFFFF"/>
        </svg>
      </div>
    `;
    return L.divIcon({
      className: 'custom-leaflet-pin',
      html: svgIcon,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically load Leaflet stylesheet and library
    const initLeaflet = async () => {
      // Ensure Leaflet CSS is present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const centerPos = lat && lng ? [lat, lng] : defaultCenter;
      const initialZoom = lat && lng ? 15 : 12;

      const map = L.map(mapContainerRef.current, {
        center: centerPos as [number, number],
        zoom: initialZoom,
        zoomControl: true,
      });

      // OpenStreetMap standard tile layer (Free, ODbL license, requires attribution)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Create marker if coordinates exist
      if (lat && lng) {
        const marker = L.marker([lat, lng], {
          draggable: !disabled,
          icon: createCustomPinIcon(L, isConfirmed, isApproximate),
        }).addTo(map);

        marker.on('dragend', () => {
          const position = marker.getLatLng();
          const newLat = parseFloat(position.lat.toFixed(6));
          const newLng = parseFloat(position.lng.toFixed(6));
          setLat(newLat);
          setLng(newLng);
          setIsConfirmed(true);
          setIsApproximate(false);
          setAccuracyType('OWNER_CONFIRMED');
          marker.setIcon(createCustomPinIcon(L, true, false));
          onChange({
            latitude: newLat,
            longitude: newLng,
            isConfirmed: true,
            isApproximate: false,
            accuracyType: 'OWNER_CONFIRMED',
          });
        });

        markerInstanceRef.current = marker;
      }

      // Map click event to place or move marker
      map.on('click', (e: any) => {
        if (disabled) return;
        const clickedLat = parseFloat(e.latlng.lat.toFixed(6));
        const clickedLng = parseFloat(e.latlng.lng.toFixed(6));

        setLat(clickedLat);
        setLng(clickedLng);
        setIsConfirmed(true);
        setIsApproximate(false);
        setAccuracyType('OWNER_CONFIRMED');

        if (markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([clickedLat, clickedLng]);
          markerInstanceRef.current.setIcon(createCustomPinIcon(L, true, false));
        } else {
          const newMarker = L.marker([clickedLat, clickedLng], {
            draggable: !disabled,
            icon: createCustomPinIcon(L, true, false),
          }).addTo(map);

          newMarker.on('dragend', () => {
            const pos = newMarker.getLatLng();
            const dLat = parseFloat(pos.lat.toFixed(6));
            const dLng = parseFloat(pos.lng.toFixed(6));
            setLat(dLat);
            setLng(dLng);
            setIsConfirmed(true);
            setIsApproximate(false);
            setAccuracyType('OWNER_CONFIRMED');
            newMarker.setIcon(createCustomPinIcon(L, true, false));
            onChange({
              latitude: dLat,
              longitude: dLng,
              isConfirmed: true,
              isApproximate: false,
              accuracyType: 'OWNER_CONFIRMED',
            });
          });

          markerInstanceRef.current = newMarker;
        }

        onChange({
          latitude: clickedLat,
          longitude: clickedLng,
          isConfirmed: true,
          isApproximate: false,
          accuracyType: 'OWNER_CONFIRMED',
        });
      });

      setMapLoaded(true);
    };

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position & icon when lat/lng change from external trigger
  const updateMapMarker = useCallback(
    async (newLat: number, newLng: number, confirmed: boolean, approx: boolean, newAccuracy: any) => {
      setLat(newLat);
      setLng(newLng);
      setIsConfirmed(confirmed);
      setIsApproximate(approx);
      setAccuracyType(newAccuracy);

      if (mapInstanceRef.current) {
        const L = (await import('leaflet')).default;
        mapInstanceRef.current.setView([newLat, newLng], 16);

        if (markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([newLat, newLng]);
          markerInstanceRef.current.setIcon(createCustomPinIcon(L, confirmed, approx));
        } else {
          const marker = L.marker([newLat, newLng], {
            draggable: !disabled,
            icon: createCustomPinIcon(L, confirmed, approx),
          }).addTo(mapInstanceRef.current);

          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            const dLat = parseFloat(pos.lat.toFixed(6));
            const dLng = parseFloat(pos.lng.toFixed(6));
            setLat(dLat);
            setLng(dLng);
            setIsConfirmed(true);
            setIsApproximate(false);
            setAccuracyType('OWNER_CONFIRMED');
            marker.setIcon(createCustomPinIcon(L, true, false));
            onChange({
              latitude: dLat,
              longitude: dLng,
              isConfirmed: true,
              isApproximate: false,
              accuracyType: 'OWNER_CONFIRMED',
            });
          });

          markerInstanceRef.current = marker;
        }
      }

      onChange({
        latitude: newLat,
        longitude: newLng,
        isConfirmed: confirmed,
        isApproximate: approx,
        accuracyType: newAccuracy,
      });
    },
    [disabled, createCustomPinIcon, onChange]
  );

  // Address Geocoding / Place Search
  const handleSearchPlace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || [
      addressContext?.addressLine1,
      addressContext?.area,
      addressContext?.city,
      addressContext?.pincode,
    ].filter(Boolean).join(', ');

    if (!query) {
      setSearchNotice('Please enter a location, address, or PIN code to search.');
      return;
    }

    setIsSearching(true);
    setSearchNotice(null);

    try {
      const resp = await fetch(
        `/api/locations/geocode?q=${encodeURIComponent(query)}&addressLine1=${encodeURIComponent(
          addressContext?.addressLine1 || ''
        )}&city=${encodeURIComponent(addressContext?.city || '')}&pincode=${encodeURIComponent(
          addressContext?.pincode || ''
        )}`
      );

      if (resp.ok) {
        const data = await resp.json();
        if (data.found && data.latitude && data.longitude) {
          const isApprox = Boolean(data.approximate);
          const newAccuracy = isApprox ? 'APPROXIMATE_PINCODE' : 'PRECISE_ADDRESS';

          await updateMapMarker(data.latitude, data.longitude, !isApprox, isApprox, newAccuracy);

          if (isApprox) {
            setSearchNotice(
              `⚠️ Placed approximate pin for "${data.displayName || query}". Please drag the pin to your exact kitchen doorway or click the map, then confirm.`
            );
          } else {
            setSearchNotice(`Found: ${data.displayName || query}. Pin placed!`);
          }
        } else {
          setSearchNotice('Could not find this address. You can click anywhere on the map to place your pin manually.');
        }
      } else {
        setSearchNotice('Search service temporarily unavailable. You can click on the map to pin your location manually.');
      }
    } catch (err) {
      setSearchNotice('Search error. You can click on the map to pin your location manually.');
    } finally {
      setIsSearching(false);
    }
  };

  // Device GPS Acquisition
  const handleDetectDeviceGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setSearchNotice('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setSearchNotice(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsDetectingGps(false);
        const deviceLat = parseFloat(pos.coords.latitude.toFixed(6));
        const deviceLng = parseFloat(pos.coords.longitude.toFixed(6));
        await updateMapMarker(deviceLat, deviceLng, true, false, 'GPS_DEVICE');
        setSearchNotice(`Device GPS locked: ${deviceLat}° N, ${deviceLng}° E. Pin confirmed!`);
      },
      (err) => {
        setIsDetectingGps(false);
        let msg = 'Could not acquire GPS position.';
        if (err.code === 1) msg = 'Location permission was denied. Please allow access or search on the map.';
        else if (err.code === 2) msg = 'Position unavailable. Please search or click on the map.';
        else if (err.code === 3) msg = 'GPS request timed out.';
        setSearchNotice(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Confirm pin action
  const handleConfirmLocation = () => {
    if (!lat || !lng) return;
    setIsConfirmed(true);
    setIsApproximate(false);
    setAccuracyType('OWNER_CONFIRMED');

    if (mapInstanceRef.current && markerInstanceRef.current) {
      import('leaflet').then((mod) => {
        const L = mod.default;
        markerInstanceRef.current.setIcon(createCustomPinIcon(L, true, false));
      });
    }

    onChange({
      latitude: lat,
      longitude: lng,
      isConfirmed: true,
      isApproximate: false,
      accuracyType: 'OWNER_CONFIRMED',
    });
    setSearchNotice('Location confirmed! Coordinates will be saved with your profile.');
  };

  // Reset / Clear pin action
  const handleClearLocation = () => {
    setLat(undefined);
    setLng(undefined);
    setIsConfirmed(false);
    setIsApproximate(false);
    setAccuracyType('NOT_SET');

    if (markerInstanceRef.current && mapInstanceRef.current) {
      markerInstanceRef.current.remove();
      markerInstanceRef.current = null;
    }

    onChange({
      latitude: undefined,
      longitude: undefined,
      isConfirmed: false,
      isApproximate: false,
      accuracyType: 'NOT_SET',
    });
    setSearchNotice('Map pin cleared. Location setup remains incomplete.');
  };

  return (
    <div className="space-y-3">
      {/* Search Bar & Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearchPlace} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search address, landmark, or PIN code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled || isSearching}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-brand-border bg-white text-brand-espresso focus:outline-none focus:ring-1 focus:ring-brand-plum"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={disabled || isSearching}
            className="text-xs shrink-0"
          >
            {isSearching ? 'Searching...' : 'Search Place'}
          </Button>
        </form>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDetectDeviceGps}
            disabled={disabled || isDetectingGps}
            className="text-xs shrink-0 gap-1.5 text-brand-plum border-brand-plum/30 hover:bg-brand-plum/5"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
            <span>{isDetectingGps ? 'Detecting...' : 'Use Device GPS'}</span>
          </Button>

          {lat && lng && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearLocation}
              disabled={disabled}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Clear Pin</span>
            </Button>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative border border-brand-border rounded-2xl overflow-hidden shadow-2xs">
        <div ref={mapContainerRef} className="w-full h-64 sm:h-72 z-0 bg-neutral-100" />

        {/* Map Overlay Instructions */}
        <div className="absolute top-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-brand-border/60 text-[11px] text-brand-espresso shadow-xs">
          <span>Click anywhere on the map or drag the pin to your kitchen door.</span>
        </div>

        {/* Provider Attribution Note */}
        <div className="absolute bottom-1 right-2 z-[400] text-[9px] text-neutral-500 bg-white/80 px-1.5 py-0.5 rounded">
          OpenStreetMap (Free & Open Source)
        </div>
      </div>

      {/* Accuracy Status Banner */}
      <div className="p-3 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all">
        {lat && lng ? (
          isConfirmed ? (
            <div className="flex items-start sm:items-center gap-2 text-emerald-800 bg-emerald-50/50 p-2 rounded-lg w-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex-1">
                <span className="font-bold">Verified Exact Pin Confirmed: </span>
                <span className="font-mono">
                  {lat.toFixed(6)}° N, {lng.toFixed(6)}° E
                </span>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Your bakery will be discoverable in customer distance searches with exact straight-line distance.
                </p>
              </div>
            </div>
          ) : isApproximate ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-50 text-amber-900 p-2 rounded-lg w-full border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Approximate PIN-Code Pin: </span>
                  <span className="font-mono">
                    {lat.toFixed(6)}° N, {lng.toFixed(6)}° E
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    This pin represents the postal locality area. Drag the pin to your exact building or click your location on the map, then confirm.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmLocation}
                disabled={disabled}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 self-end sm:self-center"
              >
                Confirm This Location
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-blue-50 text-blue-900 p-2 rounded-lg w-full border border-blue-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Unconfirmed Pin Selected: </span>
                  <span className="font-mono">
                    {lat.toFixed(6)}° N, {lng.toFixed(6)}° E
                  </span>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Click &apos;Confirm Selected Location&apos; to lock these coordinates for your bakery storefront.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmLocation}
                disabled={disabled}
                className="font-bold text-xs shrink-0 self-end sm:self-center"
              >
                Confirm Location Pin
              </Button>
            </div>
          )
        ) : (
          <div className="flex items-start gap-2 text-neutral-600 bg-neutral-50 p-2 rounded-lg w-full border border-neutral-200">
            <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Location Setup Incomplete (Unpinned): </span>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Your street address will be saved, but your bakery will not appear in customer proximity distance searches until an exact pin is confirmed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notice Message */}
      {searchNotice && (
        <p className="text-[11px] text-brand-plum bg-brand-cream-light/60 p-2 rounded-lg border border-brand-border/60">
          {searchNotice}
        </p>
      )}

      {/* External Map Verification Link */}
      {lat && lng && (
        <div className="flex items-center justify-between text-[11px] text-owner-muted px-1">
          <span>Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-plum hover:underline font-medium"
          >
            <span>Verify in Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
