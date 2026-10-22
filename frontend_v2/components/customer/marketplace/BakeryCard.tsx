'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Store, Star, ArrowRight, Clock, ShieldCheck, Navigation } from 'lucide-react';
import { Shop } from '@/types/shop';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/common/StatusBadge';

import { getSafeImageUrl, FALLBACK_BAKERY_COVER } from '@/lib/utils/image';

interface BakeryCardProps {
  shop: Shop;
}

export const BakeryCard: React.FC<BakeryCardProps> = ({ shop }) => {
  const [coverSrc, setCoverSrc] = useState(() =>
    getSafeImageUrl(shop.coverImageUrl || shop.imageUrl, FALLBACK_BAKERY_COVER)
  );

  const directionsUrl = React.useMemo(() => {
    if (shop.latitude && shop.longitude && !isNaN(shop.latitude) && !isNaN(shop.longitude)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
    }
    const fullAddr = [shop.addressLine1 || shop.address, shop.area, shop.city, shop.state, shop.pincode]
      .filter(Boolean)
      .join(', ');
    if (fullAddr.trim()) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddr)}`;
    }
    return null;
  }, [shop.latitude, shop.longitude, shop.addressLine1, shop.address, shop.area, shop.city, shop.state, shop.pincode]);

  return (
    <Card hoverEffect className="h-full flex flex-col overflow-hidden border border-brand-border/80 bg-white group p-0 rounded-3xl transition-all duration-300 hover:shadow-elevated hover:-translate-y-1">
      {/* Bakery Cover Image Container */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-cream">
        <Image
          src={coverSrc}
          alt={shop.businessName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
          onError={() => setCoverSrc(FALLBACK_BAKERY_COVER)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        {/* Top Badges Row */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 flex-wrap">
            {shop.verificationStatus === 'VERIFIED' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs backdrop-blur-xs">
                <ShieldCheck className="w-3 h-3" /> Verified ✓
              </span>
            )}
            {shop.isPureVeg && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-700 text-white shadow-xs backdrop-blur-xs">
                🌱 Pure Veg
              </span>
            )}
          </div>

          {shop.averageRating || shop.rating ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-brand-espresso font-bold text-xs shadow-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>{(shop.averageRating || shop.rating || 0).toFixed(1)}</span>
              {(shop.totalReviews || shop.reviewCount) ? (
                <span className="text-[10px] text-brand-muted font-normal">({shop.totalReviews || shop.reviewCount})</span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-brand-espresso text-[10px] font-semibold shadow-xs">
              <span>New Bakery</span>
            </div>
          )}
        </div>

        <div className="absolute -bottom-4 left-5 w-13 h-13 rounded-2xl bg-white border-2 border-white shadow-elevated overflow-hidden flex items-center justify-center text-brand-plum font-serif font-bold text-lg shrink-0">
          {shop.logoUrl && !shop.logoUrl.includes('example.com') ? (
            <img src={shop.logoUrl} alt={shop.businessName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-blush to-brand-cream text-brand-plum font-serif font-bold">
              {shop.businessName.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Bakery Details */}
      <div className="pt-6 p-5 sm:p-6 flex flex-col flex-1">
        {/* Bakery Title */}
        <h3 className="font-serif font-bold text-lg text-brand-espresso line-clamp-1 group-hover:text-brand-plum transition-colors">
          {shop.businessName}
        </h3>

        {/* Location & Distance */}
        <div className="flex items-center justify-between text-xs text-brand-muted mt-1 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-brand-plum shrink-0" />
            <span className="line-clamp-1">
              {shop.area ? `${shop.area}, ` : ''}{shop.city}, {shop.state}
            </span>
          </div>
          {shop.distanceKm != null && !isNaN(shop.distanceKm) && (
            <span
              title="Calculated straight-line (aerial) distance. Driving distance may vary."
              className="shrink-0 font-semibold text-brand-plum bg-brand-blush/80 px-2 py-0.5 rounded-full text-[11px] border border-brand-plum/20 cursor-help flex items-center gap-1"
            >
              <span>{shop.distanceKm < 1 ? `${Math.round(shop.distanceKm * 1000)} m away` : `${shop.distanceKm.toFixed(1)} km away`}</span>
              <span className="text-[9px] opacity-75 font-normal">(direct)</span>
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-brand-muted mt-2.5 line-clamp-2 flex-1 leading-relaxed">
          {shop.businessDescription || shop.description || 'Artisanal cakes, cupcakes, and bespoke desserts crafted fresh with premium ingredients.'}
        </p>

        {/* Meta Specs */}
        <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-xs">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-cream text-brand-espresso/80 text-[11px] font-medium border border-brand-border/50">
            {shop.businessCategory || shop.businessType?.replace(/_/g, ' ') || 'Artisanal Bakery'}
          </span>
          {shop.deliveryTimeMinutes && (
            <span className="text-[11px] text-brand-muted flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-brand-plum" />
              {shop.deliveryTimeMinutes} mins
            </span>
          )}
        </div>

        {/* Direct CTA */}
        <div className="mt-4 pt-2 flex items-center gap-2">
          <Link href={`/shop/${shop.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full justify-between group rounded-xl hover:bg-brand-plum hover:text-white hover:border-brand-plum transition-all">
              <span className="inline-flex items-center font-bold">
                <Store className="w-3.5 h-3.5 mr-1.5 text-brand-plum group-hover:text-white transition-colors" />
                Visit Storefront
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-brand-plum group-hover:text-white transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Get directions on Google Maps"
              aria-label={`Get directions to ${shop.businessName} on Google Maps`}
              className="inline-flex items-center justify-center p-2 rounded-xl border border-brand-border/80 hover:border-brand-plum/40 text-brand-muted hover:text-brand-plum hover:bg-brand-blush/30 transition-all text-xs font-semibold shrink-0"
            >
              <Navigation className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
};
