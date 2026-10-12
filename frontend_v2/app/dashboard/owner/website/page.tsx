'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Globe, ExternalLink, Save, CheckCircle2, AlertCircle, Sparkles, Store
} from 'lucide-react';
import { ownerApi } from '@/lib/api/owner';
import { ownerStorefrontApi } from '@/lib/api/ownerStorefront';
import { ShopSettings } from '@/types/owner';
import {
  ShopBanner,
  ShopBusinessHour,
  ShopDeliveryConfig,
  ShopStorefrontSettings,
  ShopCustomFormField,
  ShopSocialLink,
} from '@/types/storefrontManagement';
import { useOwner } from '@/context/OwnerContext';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { useUnsavedChanges } from '@/context/UnsavedChangesContext';

// Modular Storefront Sections
import { BrandingSection } from '@/components/owner/storefront/BrandingSection';
import { HeroBannersSection } from '@/components/owner/storefront/HeroBannersSection';
import { AboutBakerySection } from '@/components/owner/storefront/AboutBakerySection';
import { FulfillmentSection } from '@/components/owner/storefront/FulfillmentSection';
import { DeliverySettingsSection } from '@/components/owner/storefront/DeliverySettingsSection';
import { ContactInfoSection } from '@/components/owner/storefront/ContactInfoSection';
import { SocialLinksSection } from '@/components/owner/storefront/SocialLinksSection';
import { BusinessHoursSection } from '@/components/owner/storefront/BusinessHoursSection';
import { StorefrontVisibilitySection } from '@/components/owner/storefront/StorefrontVisibilitySection';
import { CustomCakeFormBuilder } from '@/components/owner/storefront/CustomCakeFormBuilder';


export default function OwnerWebsitePage() {
  const { shop, registerRefreshHandler } = useOwner();
  const { setDirty } = useUnsavedChanges();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Branding & Shop Settings
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [aboutStory, setAboutStory] = useState('');
  const [aboutImageUrl, setAboutImageUrl] = useState('');
  const [showAboutImage, setShowAboutImage] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [mapLocationUrl, setMapLocationUrl] = useState('');

  // 2. Banners
  const [banners, setBanners] = useState<ShopBanner[]>([]);

  // 3. Business Hours
  const [businessHours, setBusinessHours] = useState<ShopBusinessHour[]>([]);

  // 4. Delivery Config
  const [deliveryConfig, setDeliveryConfig] = useState<ShopDeliveryConfig>({
    deliveryChargeType: 'FIXED',
    fixedChargeAmount: 50,
    minOrderForFreeDelivery: 1000,
  });

  // 5. Storefront Settings
  const [storefrontSettings, setStorefrontSettings] = useState<ShopStorefrontSettings>({
    heroBannerEnabled: true,
    topRatedEnabled: true,
    reviewsEnabled: true,
    bakeryInfoEnabled: true,
    categoriesEnabled: true,
    filtersEnabled: true,
    ratingsEnabled: true,
    aboutStoryEnabled: true,
    aboutImageEnabled: true,
    fulfillmentEnabled: true,
    leadTimeDays: 2,
    leadTimeMessage: 'Orders require 2 days advance booking.',
    customCakesEnabled: true,
    whatsappEnabled: true,
    phoneEnabled: true,
    emailEnabled: true,
    addressEnabled: true,
    mapEnabled: true,
    businessHoursEnabled: true,
  });

  // 6. Custom Cake Form Fields
  const [customFields, setCustomFields] = useState<ShopCustomFormField[]>([]);

  // 7. Social Media & External Links
  const [socialLinks, setSocialLinks] = useState<ShopSocialLink[]>([]);

  // Snapshot for dirty state tracking (tracks only data persisted by the batch-save endpoint)
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const currentSnapshot = JSON.stringify({
    logoUrl, coverImageUrl, businessName, aboutStory, aboutImageUrl, showAboutImage,
    whatsappNumber, phone, email, address, mapLocationUrl,
    deliveryConfig, storefrontSettings
  });

  useEffect(() => {
    if (isLoading) return;
    if (initialSnapshot === null) {
      setInitialSnapshot(currentSnapshot);
    } else {
      setDirty('website-management', currentSnapshot !== initialSnapshot);
    }
  }, [currentSnapshot, isLoading, initialSnapshot, setDirty]);

  // Clean up on unmount
  useEffect(() => {
    return () => setDirty('website-management', false);
  }, [setDirty]);

  const fetchAllData = useCallback(async (isManual = false) => {
    if (!isManual) setIsLoading(true);
    setErrorMsg(null);

    try {
      const [shopData, bannersData, hoursData, deliveryData, settingsData, fieldsData, linksData] =
        await Promise.all([
          ownerApi.getShopSettings(),
          ownerStorefrontApi.getBanners().catch(() => []),
          ownerStorefrontApi.getBusinessHours().catch(() => []),
          ownerStorefrontApi.getDeliveryConfig().catch(() => null),
          ownerStorefrontApi.getStorefrontSettings().catch(() => null),
          ownerStorefrontApi.getCustomFormFields().catch(() => []),
          ownerStorefrontApi.getSocialLinks().catch(() => []),
        ]);

      if (shopData) {
        setLogoUrl(shopData.logoUrl || '');
        setCoverImageUrl(shopData.coverImageUrl || '');
        setBusinessName(shopData.businessName || '');
        setAboutStory(shopData.aboutStory || shopData.description || '');
        setAboutImageUrl(shopData.aboutImageUrl || '');
        setShowAboutImage(shopData.showAboutImage !== false);
        setWhatsappNumber(shopData.whatsappNumber || '');
        setPhone(shopData.phone || '');
        setEmail(shopData.email || '');
        setAddress(shopData.address || '');
        setMapLocationUrl(shopData.mapLocationUrl || '');
      }

      setBanners(bannersData || []);
      setBusinessHours(hoursData || []);

      if (deliveryData) {
        setDeliveryConfig({
          ...deliveryData,
          fixedChargeAmount: Number(deliveryData.fixedChargeAmount) || 0,
          minOrderForFreeDelivery:
            deliveryData.minOrderForFreeDelivery != null
              ? Number(deliveryData.minOrderForFreeDelivery)
              : null,
        });
      }

      if (settingsData) {
        setStorefrontSettings(settingsData);
      }

      setCustomFields(fieldsData || []);
      setSocialLinks(linksData || []);

    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load storefront configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    const unregister = registerRefreshHandler(async () => {
      await fetchAllData(true);
    });
    return unregister;
  }, [registerRefreshHandler, fetchAllData]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate delivery config
    if (deliveryConfig.deliveryChargeType === 'FIXED') {
      if (deliveryConfig.fixedChargeAmount < 0) {
        setErrorMsg('Delivery charge cannot be negative');
        setIsSaving(false);
        return;
      }
      if (
        deliveryConfig.minOrderForFreeDelivery != null &&
        deliveryConfig.minOrderForFreeDelivery < 0
      ) {
        setErrorMsg('Free delivery threshold cannot be negative');
        setIsSaving(false);
        return;
      }
    }

    try {
      await ownerStorefrontApi.updateWebsiteConfiguration({
        shopProfile: {
          businessName,
          logoUrl,
          coverImageUrl,
          aboutStory,
          aboutImageUrl,
          showAboutImage,
          whatsappNumber,
          phone,
          email,
          address,
          mapLocationUrl,
        },
        deliveryConfig: {
          deliveryChargeType: deliveryConfig.deliveryChargeType,
          fixedChargeAmount: deliveryConfig.fixedChargeAmount,
          minOrderForFreeDelivery: deliveryConfig.minOrderForFreeDelivery,
          deliveryNotes: deliveryConfig.deliveryNotes,
        },
        storefrontSettings,
      });

      setInitialSnapshot(currentSnapshot);
      setDirty('website-management', false);

      setSuccessMsg('All storefront configurations saved and published successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading storefront configuration..." />;

  const liveStoreUrl = shop?.id ? `/shop/${shop.id}` : undefined;

  return (
    <form onSubmit={handleSaveAll} className="space-y-6 max-w-5xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-owner-border shadow-soft">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-blush text-brand-plum text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Storefront Website Studio</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-owner-heading tracking-tight">
            Storefront Website Management
          </h1>
          <p className="text-xs text-owner-muted">
            Configure your customer-facing digital storefront, banners, story, delivery fees, and order forms.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {liveStoreUrl && (
            <Link
              href={liveStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-plum hover:bg-brand-plum-hover text-white text-xs font-bold shadow-soft transition-all"
            >
              <Store className="w-3.5 h-3.5" />
              <span>View Storefront</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </Link>
          )}

          <Button type="submit" isLoading={isSaving} size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            <span>Save All</span>
          </Button>
        </div>
      </div>

      {/* Status Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Bakery Logo Branding */}
      <BrandingSection
        logoUrl={logoUrl}
        onLogoChange={setLogoUrl}
        coverImageUrl={coverImageUrl}
        onCoverImageChange={setCoverImageUrl}
        businessName={businessName}
      />

      {/* 2. Hero Banners Manager */}
      <HeroBannersSection
        banners={banners}
        onChange={setBanners}
      />

      {/* 3. About Bakery & Story */}
      <AboutBakerySection
        aboutStory={aboutStory}
        onAboutStoryChange={setAboutStory}
        aboutImageUrl={aboutImageUrl}
        onAboutImageUrlChange={setAboutImageUrl}
        showAboutImage={showAboutImage}
        onShowAboutImageChange={setShowAboutImage}
      />

      {/* 4. Fulfillment & Advance Booking Lead Time */}
      <FulfillmentSection
        settings={storefrontSettings}
        onChange={setStorefrontSettings}
      />

      {/* 5. Authoritative Delivery Fee Configuration */}
      <DeliverySettingsSection
        config={deliveryConfig}
        onChange={setDeliveryConfig}
      />

      {/* 6. Contact Details & Maps */}
      <ContactInfoSection
        whatsappNumber={whatsappNumber}
        onWhatsappNumberChange={setWhatsappNumber}
        phone={phone}
        onPhoneChange={setPhone}
        email={email}
        onEmailChange={setEmail}
        address={address}
        onAddressChange={setAddress}
        mapLocationUrl={mapLocationUrl}
        onMapLocationUrlChange={setMapLocationUrl}
        hideStreetAddress={storefrontSettings.hideStreetAddress}
        onHideStreetAddressChange={(val) =>
          setStorefrontSettings((prev) => ({ ...prev, hideStreetAddress: val }))
        }
      />

      {/* 7. Social Media & External Links */}
      <SocialLinksSection
        links={socialLinks}
        onChange={setSocialLinks}
      />

      {/* 8. Weekly Business Schedule */}
      <BusinessHoursSection
        hours={businessHours}
        onHoursChange={setBusinessHours}
      />

      {/* 8. Storefront Section Visibility */}
      <StorefrontVisibilitySection
        settings={storefrontSettings}
        onChange={setStorefrontSettings}
      />

      {/* 9. Custom Cake Form Builder */}
      <CustomCakeFormBuilder
        settings={storefrontSettings}
        onSettingsChange={setStorefrontSettings}
        fields={customFields}
        onFieldsChange={setCustomFields}
      />

      {/* Sticky Bottom Save Bar */}
      <div className="sticky bottom-6 p-4 rounded-2xl bg-brand-espresso/90 backdrop-blur-md text-white shadow-xl flex items-center justify-between gap-4 border border-white/10 z-20">
        <div>
          <span className="text-xs font-bold block">Ready to publish your storefront updates?</span>
          <span className="text-[11px] text-gray-300">Changes are immediately reflected on your customer storefront.</span>
        </div>
        <Button type="submit" isLoading={isSaving} size="md" className="bg-brand-blush text-brand-plum hover:bg-brand-cream border-0">
          <Save className="w-4 h-4 mr-1.5" />
          <span>Publish All Changes</span>
        </Button>
      </div>
    </form>
  );
}
