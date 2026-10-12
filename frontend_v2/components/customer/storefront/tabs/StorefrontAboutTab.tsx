'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import {
  Award,
  ShieldCheck,
  Heart,
  Clock,
  MapPin,
  Sparkles,
  Phone,
  MessageCircle,
  CheckCircle2,
  ChefHat,
  Flame,
  Truck,
} from 'lucide-react';
import { Shop } from '@/types/shop';
import { StorefrontTab } from '../StorefrontTabNav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SocialIcon } from '@/components/common/SocialIcon';

interface StorefrontAboutTabProps {
  shop: Shop;
  onNavigateTab: (tab: StorefrontTab) => void;
}

export const StorefrontAboutTab: React.FC<StorefrontAboutTabProps> = ({
  shop,
  onNavigateTab,
}) => {
  const [imgError, setImgError] = useState(false);

  const isPrivacyEnabled = !!shop.storefrontSettings?.hideStreetAddress;
  const addressParts = isPrivacyEnabled
    ? [shop.area, shop.city, shop.district, shop.state].filter(Boolean)
    : [
        shop.addressLine1 || shop.address,
        shop.area,
        shop.city,
        shop.district,
        shop.state,
      ].filter(Boolean);

  const fullAddress =
    addressParts.length > 0
      ? `${addressParts.join(', ')}${shop.pincode ? ` - ${shop.pincode}` : ''}`
      : `${shop.city || ''}${shop.state ? `, ${shop.state}` : ''}`;

  const activeSocialLinks = (shop.socialLinks || []).filter(
    (l) => l.isActive !== false && l.url && l.url.trim().length > 0
  );

  const fallbackAboutImage =
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80';
  const aboutImageUrl =
    (!imgError && (shop.aboutImageUrl || shop.coverImageUrl || shop.imageUrl || shop.bannerUrl || shop.logoUrl)) ||
    fallbackAboutImage;

  const aboutStoryEnabled = shop.storefrontSettings?.aboutStoryEnabled !== false;
  const showImage = shop.storefrontSettings?.aboutImageEnabled !== false && shop.showAboutImage !== false;
  const fulfillmentEnabled = shop.storefrontSettings?.fulfillmentEnabled !== false;
  const customCakesEnabled = shop.storefrontSettings?.customCakesEnabled !== false;

  const leadTimeDays = shop.storefrontSettings?.leadTimeDays ?? 0;
  const leadTimeMessage = shop.storefrontSettings?.leadTimeMessage;

  const storyText =
    shop.aboutStory ||
    shop.businessDescription ||
    shop.description ||
    'Welcome to our digital boutique storefront. Every celebration cake is handcrafted specifically for your event using high-grade cocoa, fresh dairy cream, and pure ingredients.';
  const hasStoryContent = true;

  // Build authentic highlights only from owner-provided fields
  const highlights: { icon: any; title: string; desc: string; iconBg: string; iconColor: string }[] = [];

  if (shop.yearsInBusiness && shop.yearsInBusiness > 0) {
    highlights.push({
      icon: Award,
      title: `${shop.yearsInBusiness}+ Years Experience`,
      desc: 'Established bakery serving handcrafted celebrations.',
      iconBg: 'bg-brand-blush',
      iconColor: 'text-brand-plum',
    });
  }

  if (shop.fssaiRegistration) {
    highlights.push({
      icon: ShieldCheck,
      title: 'FSSAI Certified',
      desc: `Registration No: ${shop.fssaiRegistration}`,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    });
  }

  if (shop.isPureVeg) {
    highlights.push({
      icon: Heart,
      title: '100% Pure Veg',
      desc: 'All products are prepared eggless and vegetarian.',
      iconBg: 'bg-green-50',
      iconColor: 'text-green-700',
    });
  }

  if (shop.deliveryConfig) {
    highlights.push({
      icon: Truck,
      title: shop.deliveryConfig.deliveryChargeType === 'FREE' ? 'Free Delivery' : 'Doorstep Delivery',
      desc:
        shop.deliveryConfig.deliveryChargeType === 'FREE'
          ? 'Free delivery across designated delivery areas.'
          : `Flat ₹${shop.deliveryConfig.fixedChargeAmount} delivery fee per order.`,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    });
  }

  return (
    <div className="space-y-10 pb-16 max-w-5xl mx-auto">
      {/* 1. Header Intro */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Our Story &amp; Craft</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-brand-espresso">
          About <span className="text-brand-plum italic">{shop.businessName}</span>
        </h1>
        {(shop.businessCategory || shop.businessType || shop.city) && (
          <p className="text-xs sm:text-sm text-brand-muted max-w-2xl mx-auto leading-relaxed">
            {shop.businessCategory ||
              (shop.businessType ? shop.businessType.replace(/_/g, ' ') : 'Bakery')}
            {shop.city ? ` based in ${shop.city}${shop.state ? `, ${shop.state}` : ''}` : ''}
          </p>
        )}
      </div>

      {/* 2. Story Section (Only when enabled and owner provided story/details) */}
      {aboutStoryEnabled && hasStoryContent && (
        <Card className="p-6 sm:p-10 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Visual Bakery Image */}
            {showImage && (
              <div className="lg:col-span-5 relative group">
                <div className="relative aspect-[4/3] sm:aspect-[1/1] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-brand-border/80 shadow-soft bg-brand-cream">
                  <img
                    src={aboutImageUrl}
                    alt={`${shop.businessName} bakery`}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm flex items-center gap-1.5 text-[11px] font-bold text-brand-plum">
                    <ChefHat className="w-3.5 h-3.5 text-brand-plum" />
                    <span>Artisan Kitchen</span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-xs font-bold font-serif leading-tight line-clamp-1">{shop.businessName}</p>
                    <p className="text-[10px] text-white/80 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{shop.area ? `${shop.area}, ` : ''}{shop.city}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Story Content */}
            <div className={showImage ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5" />
                <span>Our Story</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
                About {shop.businessName}
              </h2>
              {storyText && (
                <p className="text-sm sm:text-base text-brand-espresso/85 leading-relaxed whitespace-pre-line">
                  {storyText}
                </p>
              )}

              {(shop.isPureVeg || (shop.yearsInBusiness && shop.yearsInBusiness > 0) || shop.fssaiRegistration) && (
                <div className="pt-2 flex flex-wrap gap-2 text-xs">
                  {shop.isPureVeg && (
                    <span className="px-3 py-1 rounded-full bg-green-50 text-green-800 font-semibold border border-green-200 flex items-center gap-1">
                      🌱 100% Pure Veg (Eggless)
                    </span>
                  )}
                  {shop.yearsInBusiness && shop.yearsInBusiness > 0 && (
                    <span className="px-3 py-1 rounded-full bg-brand-blush text-brand-plum font-semibold border border-brand-blush-border flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> {shop.yearsInBusiness}+ Years Experience
                    </span>
                  )}
                  {shop.fssaiRegistration && (
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> FSSAI: {shop.fssaiRegistration}
                    </span>
                  )}
                </div>
              )}
              {activeSocialLinks.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-brand-espresso mb-2">Connect with us:</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSocialLinks.map((link) => (
                      <a
                        key={link.id || link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-cream border border-brand-border text-brand-espresso hover:text-brand-plum hover:border-brand-plum/40 transition-colors text-xs font-medium"
                      >
                        <SocialIcon platform={link.platform} className="w-3.5 h-3.5" />
                        <span>{link.title || link.displayName || link.platform}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Highlights — Only Real Owner-Configured Data */}
          {highlights.length > 0 && (
            <div className="mt-8 pt-8 border-t border-brand-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {highlights.map((h, idx) => {
                const IconComp = h.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-brand-cream-light/60 border border-brand-border/40 space-y-1.5 flex flex-col items-center text-center"
                  >
                    <div className={`w-10 h-10 rounded-2xl ${h.iconBg} flex items-center justify-center ${h.iconColor} mb-1`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs font-bold text-brand-espresso">{h.title}</h3>
                    <p className="text-[11px] text-brand-muted">{h.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* 3. Location, Coverage & Fulfillment Policy */}
      {fulfillmentEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-serif text-brand-espresso">
                  {isPrivacyEnabled ? 'Kitchen Locality & Service Area' : 'Kitchen Location & Service Radius'}
                </h3>
                <p className="text-xs text-brand-muted">Doorstep delivery</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-brand-cream-light/70 border border-brand-border/60 text-xs space-y-2">
              <p className="font-semibold text-brand-espresso">{fullAddress}</p>
              {(shop.area || shop.city) && (
                <p className="text-brand-muted">
                  Coverage Area: {shop.area ? `${shop.area}, ` : ''}{shop.city}{shop.state ? `, ${shop.state}` : ''}
                </p>
              )}
            </div>

            {/* Packaging and Delivery Notes (Only shown if owner entered it) */}
            {shop.deliveryConfig?.deliveryNotes && (
              <p className="text-xs text-brand-muted leading-relaxed">
                {shop.deliveryConfig.deliveryNotes}
              </p>
            )}
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-serif text-brand-espresso">
                  Fulfillment &amp; Booking Lead Time
                </h3>
                <p className="text-xs text-brand-muted">Order schedule</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-brand-espresso">
              {(leadTimeDays > 0 || leadTimeMessage) && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Lead Time:</strong>{' '}
                    {leadTimeDays > 0 ? `${leadTimeDays} ${leadTimeDays === 1 ? 'day' : 'days'} notice.` : ''}
                    {leadTimeMessage ? ` ${leadTimeMessage}` : ''}
                  </span>
                </div>
              )}

              {/* Delivery Fee details from deliveryConfig */}
              {shop.deliveryConfig && (
                <div className="flex items-start gap-2">
                  <Truck className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <span>
                    <strong>Delivery Charges:</strong>{' '}
                    {shop.deliveryConfig.deliveryChargeType === 'FREE' ? (
                      <span className="text-emerald-700 font-bold">Free Doorstep Delivery on all orders!</span>
                    ) : (
                      <span>
                        ₹{shop.deliveryConfig.fixedChargeAmount ?? 0} flat delivery fee
                        {shop.deliveryConfig.minOrderForFreeDelivery
                          ? ` (Free for orders above ₹${shop.deliveryConfig.minOrderForFreeDelivery})`
                          : ''}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* 4. Action Bar */}
      <div className="p-8 rounded-3xl bg-brand-cream border border-brand-border/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h3 className="text-lg font-serif font-bold text-brand-espresso">
            Ready to order from {shop.businessName}?
          </h3>
          <p className="text-xs text-brand-muted mt-0.5">
            Browse our cake menu or get in touch for custom celebrations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => onNavigateTab('shop')} className="font-bold">
            Browse Cake Menu
          </Button>
          {customCakesEnabled && (
            <Button
              variant="outline"
              onClick={() => onNavigateTab('custom-cakes')}
              className="font-semibold"
            >
              Custom Cake Inquiry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
