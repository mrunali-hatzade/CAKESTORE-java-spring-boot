'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles,
  ArrowRight,
  Star,
  Cake,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle2,
  Plus,
  X,
  Upload,
  Loader2,
  Play,
  ShoppingBag,
  ThumbsUp,
  ChefHat,
  Flame,
  Award,
  ShieldCheck,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Shop } from '@/types/shop';
import { Product, Category } from '@/types/product';
import { StorefrontTab } from '../StorefrontTabNav';
import { ProductCard } from '../ProductCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { storefrontApi } from '@/lib/api/storefront';
import { apiClient } from '@/lib/api/client';
import { reviewStorage } from '@/lib/utils/reviewStorage';
import { useToast } from '@/components/common/Toast';

interface StorefrontHomeTabProps {
  shop: Shop;
  products: Product[];
  categories: Category[];
  onNavigateTab: (tab: StorefrontTab) => void;
  onSelectProduct: (product: Product) => void;
  onOpenCustomQuote: () => void;
}

const CUSTOM_CAKE_VALUE = '__custom__';

/** Validate that a URL string is non-empty and not obviously invalid */
function isValidMediaUrl(url?: string | null): url is string {
  return typeof url === 'string' && url.trim().length > 4 && url.startsWith('http');
}

/** Accurate fractional star renderer for ratings (e.g. 4.5 => 4 full + 1 half star) */
const renderRatingStars = (rating: number, starSize = 'w-5 h-5') => {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillAmount = Math.max(0, Math.min(1, rating - (starIndex - 1)));
        if (fillAmount >= 0.75) {
          return <Star key={starIndex} className={`${starSize} fill-amber-400 text-amber-500 shrink-0`} />;
        } else if (fillAmount >= 0.25) {
          return (
            <div key={starIndex} className={`relative inline-block ${starSize} shrink-0`}>
              <Star className={`${starSize} text-brand-border/60 fill-transparent`} />
              <div className="absolute inset-0 overflow-hidden w-[50%]">
                <Star className={`${starSize} fill-amber-400 text-amber-500`} />
              </div>
            </div>
          );
        } else {
          return <Star key={starIndex} className={`${starSize} text-brand-border/60 fill-transparent shrink-0`} />;
        }
      })}
    </div>
  );
};

export const StorefrontHomeTab: React.FC<StorefrontHomeTabProps> = ({
  shop,
  products,
  categories,
  onNavigateTab,
  onSelectProduct,
  onOpenCustomQuote,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topRatedProducts, setTopRatedProducts] = useState<Product[]>([]);
  const [loadingTopRated, setLoadingTopRated] = useState<boolean>(true);

  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(true);

  // Review Carousel forward/backward scroll state & handlers
  const reviewsTrackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);
  const [isAutoMoving, setIsAutoMoving] = useState<boolean>(true);
  const autoScrollResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pauseAutoMoveTemporarily = useCallback((ms = 6000) => {
    setIsAutoMoving(false);
    if (autoScrollResumeTimerRef.current) {
      clearTimeout(autoScrollResumeTimerRef.current);
    }
    autoScrollResumeTimerRef.current = setTimeout(() => {
      setIsAutoMoving(true);
    }, ms);
  }, []);

  const updateScrollButtons = useCallback(() => {
    if (reviewsTrackRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = reviewsTrackRef.current;
      setCanScrollLeft(scrollLeft > 15);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 15);
    }
  }, []);

  useEffect(() => {
    const el = reviewsTrackRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [feedbackList, updateScrollButtons]);

  // Continuous / Periodic auto-movement for reviews carousel
  useEffect(() => {
    if (!isAutoMoving || feedbackList.length <= 1) return;

    const interval = setInterval(() => {
      const el = reviewsTrackRef.current;
      if (!el) return;

      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (maxScrollLeft <= 10) return;

      // When reaching or near end, wrap seamlessly back to start
      if (el.scrollLeft >= maxScrollLeft - 20) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const step = Math.min(360, Math.floor(el.clientWidth * 0.75) || 320);
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isAutoMoving, feedbackList.length]);

  const scrollReviews = (direction: 'left' | 'right') => {
    pauseAutoMoveTemporarily(7000);
    if (reviewsTrackRef.current) {
      const scrollAmount = Math.max(340, Math.floor(reviewsTrackRef.current.clientWidth * 0.75));
      reviewsTrackRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Review / Feedback Modal state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [reviewerName, setReviewerName] = useState<string>('');
  const [reviewerRating, setReviewerRating] = useState<number>(5);
  const [reviewerComment, setReviewerComment] = useState<string>('');
  const [reviewerRecommendation, setReviewerRecommendation] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customCakeName, setCustomCakeName] = useState<string>('');

  // Media upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isFileVideo, setIsFileVideo] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null);
  const [existingCakeImageUrl, setExistingCakeImageUrl] = useState<string | null>(null);
  const [existingCakeVideoUrl, setExistingCakeVideoUrl] = useState<string | null>(null);
  const [isDeletingFeedback, setIsDeletingFeedback] = useState<boolean>(false);

  // Settings toggles
  const topRatedEnabled = shop.storefrontSettings?.topRatedEnabled !== false;
  const customCakesEnabled = shop.storefrontSettings?.customCakesEnabled !== false;
  const aboutStoryEnabled = shop.storefrontSettings?.aboutStoryEnabled !== false;
  const reviewsEnabled = shop.storefrontSettings?.reviewsEnabled !== false;

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (topRatedEnabled) {
        try {
          const data = await storefrontApi.getTopRatedProducts(shop.id, 8);
          if (isMounted) {
            setTopRatedProducts(data && data.length > 0 ? data : products.slice(0, 4));
          }
        } catch {
          if (isMounted) setTopRatedProducts(products.slice(0, 4));
        } finally {
          if (isMounted) setLoadingTopRated(false);
        }
      } else {
        if (isMounted) setLoadingTopRated(false);
      }

      if (reviewsEnabled) {
        try {
          const feedbackData = await storefrontApi.getShopFeedback(shop.id);
          if (isMounted) {
            setFeedbackList(feedbackData || []);
          }
        } catch {
          if (isMounted) setFeedbackList([]);
        } finally {
          if (isMounted) setLoadingFeedback(false);
        }
      } else {
        if (isMounted) setLoadingFeedback(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [shop.id, topRatedEnabled, reviewsEnabled, products]);

  const myFeedback = feedbackList.find((item) =>
    reviewStorage.isCustomerReview(item.id, item.customerDisplayName, 'FEEDBACK')
  );

  const totalFeedbackCount = feedbackList.length;
  const overallAvgRating = totalFeedbackCount > 0
    ? Math.round((feedbackList.reduce((sum, item) => sum + (Number(item.rating) || 5), 0) / totalFeedbackCount) * 10) / 10
    : (shop.averageRating ?? 5.0);

  const starCounts: Record<number, number> = {
    5: feedbackList.filter((f) => Number(f.rating) === 5).length,
    4: feedbackList.filter((f) => Number(f.rating) === 4).length,
    3: feedbackList.filter((f) => Number(f.rating) === 3).length,
    2: feedbackList.filter((f) => Number(f.rating) === 2).length,
    1: feedbackList.filter((f) => Number(f.rating) === 1).length,
  };

  const positivePercent = totalFeedbackCount > 0
    ? Math.round(((starCounts[5] + starCounts[4]) / totalFeedbackCount) * 100)
    : 100;

  // Cleanup preview object URL on unmount / file change
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up previous preview
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);

    setSelectedFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
    setIsFileVideo(file.type.startsWith('video/'));
    setUploadError(null);

    // Reset input so the same file can be reselected after removal
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl && selectedFile) URL.revokeObjectURL(filePreviewUrl);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setIsFileVideo(false);
    setUploadError(null);
    setExistingCakeImageUrl(null);
    setExistingCakeVideoUrl(null);
  };

  const resetForm = () => {
    setEditingFeedbackId(null);
    setExistingCakeImageUrl(null);
    setExistingCakeVideoUrl(null);
    setReviewerName(reviewStorage.getStoredCustomerName() || '');
    setReviewerRating(5);
    setReviewerComment('');
    setReviewerRecommendation('');
    setSelectedProductId('');
    setCustomCakeName('');
    handleRemoveFile();
  };

  const handleCloseModal = () => {
    setIsFeedbackModalOpen(false);
    resetForm();
  };

  const handleEditFeedback = (item: any) => {
    setEditingFeedbackId(item.id);
    setReviewerName(item.customerDisplayName || '');
    setReviewerRating(item.rating || 5);
    setReviewerComment(item.comment || '');
    setReviewerRecommendation(item.recommendationText || '');
    if (item.productId) {
      setSelectedProductId(String(item.productId));
      setCustomCakeName('');
    } else if (item.productName) {
      setSelectedProductId(CUSTOM_CAKE_VALUE);
      setCustomCakeName(item.productName);
    } else {
      setSelectedProductId('');
      setCustomCakeName('');
    }
    setExistingCakeImageUrl(item.cakeImageUrl || null);
    setExistingCakeVideoUrl(item.cakeVideoUrl || null);
    setSelectedFile(null);
    setFilePreviewUrl(item.cakeVideoUrl || item.cakeImageUrl || null);
    setIsFileVideo(Boolean(item.cakeVideoUrl));
    setUploadError(null);
    setIsFeedbackModalOpen(true);
  };

  const handleDeleteFeedback = async (item: any) => {
    if (!item?.id) return;
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    setIsDeletingFeedback(true);
    try {
      const token = item.editToken || reviewStorage.getStoredReviewToken(item.id, 'FEEDBACK');
      const customerName = item.customerDisplayName || reviewerName || reviewStorage.getStoredCustomerName();
      await storefrontApi.deleteFeedback(shop.id, item.id, token, customerName);
      reviewStorage.removeStoredReview(item.id, 'FEEDBACK');
      toast.success('Your review has been removed.');
      const updated = await storefrontApi.getShopFeedback(shop.id);
      setFeedbackList(updated || []);
      if (isFeedbackModalOpen) {
        handleCloseModal();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    } finally {
      setIsDeletingFeedback(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reviewerName.trim()) {
      toast.error('Please enter your display name.');
      return;
    }
    if (!reviewerComment.trim()) {
      toast.error('Please share how your experience was.');
      return;
    }

    // Resolve product selection
    const isCustomCake = selectedProductId === CUSTOM_CAKE_VALUE;
    const resolvedProductId = (!isCustomCake && selectedProductId)
      ? parseInt(selectedProductId, 10)
      : null;
    const resolvedProductName = isCustomCake && customCakeName.trim()
      ? customCakeName.trim()
      : undefined;

    let cakeImageUrl: string | undefined;
    let cakeVideoUrl: string | undefined;

    // Step 1: Upload media if selected
    if (selectedFile) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const uploadResult = await storefrontApi.uploadReviewMedia(selectedFile);
        if (isFileVideo) {
          cakeVideoUrl = uploadResult.url;
        } else {
          cakeImageUrl = uploadResult.url;
        }
      } catch (err: any) {
        const msg = err.message || 'Media upload failed. Please try again.';
        setUploadError(msg);
        setIsUploading(false);
        toast.error(msg);
        return; // Do NOT proceed to submit
      } finally {
        setIsUploading(false);
      }
    }

    // Step 2: Submit feedback or Update feedback
    setIsSubmittingFeedback(true);
    try {
      let savedId = editingFeedbackId;
      const finalImageUrl = cakeImageUrl !== undefined ? cakeImageUrl : (existingCakeImageUrl || undefined);
      const finalVideoUrl = cakeVideoUrl !== undefined ? cakeVideoUrl : (existingCakeVideoUrl || undefined);
      const existingToken = editingFeedbackId ? reviewStorage.getStoredReviewToken(editingFeedbackId, 'FEEDBACK') : undefined;
      let capturedEditToken = existingToken;

      if (editingFeedbackId) {
        const updRes = await storefrontApi.updateFeedback(shop.id, editingFeedbackId, {
          customerDisplayName: reviewerName.trim(),
          rating: reviewerRating,
          comment: reviewerComment.trim(),
          recommendationText: reviewerRecommendation.trim() || undefined,
          cakeImageUrl: finalImageUrl,
          cakeVideoUrl: finalVideoUrl,
        }, existingToken);
        if (updRes?.editToken) {
          capturedEditToken = updRes.editToken;
        }
        toast.success('Your celebration review has been updated!');
      } else {
        const res = await storefrontApi.submitFeedback(shop.id, {
          customerDisplayName: reviewerName.trim(),
          rating: reviewerRating,
          comment: reviewerComment.trim(),
          recommendationText: reviewerRecommendation.trim() || undefined,
          productId: resolvedProductId,
          productName: resolvedProductName,
          cakeImageUrl: finalImageUrl,
          cakeVideoUrl: finalVideoUrl,
        });
        savedId = res?.id;
        if (res?.editToken) {
          capturedEditToken = res.editToken;
        }
        toast.success('Thank you! Your review has been submitted for approval.');
      }

      if (savedId) {
        reviewStorage.saveStoredReview({
          id: savedId,
          source: 'FEEDBACK',
          shopId: shop.id,
          productId: resolvedProductId,
          productName: resolvedProductName,
          customerDisplayName: reviewerName.trim(),
          rating: reviewerRating,
          reviewText: reviewerComment.trim(),
          cakeImageUrl: finalImageUrl,
          cakeVideoUrl: finalVideoUrl,
          editToken: capturedEditToken,
          createdAt: new Date().toISOString(),
        });
      }

      reviewStorage.setStoredCustomerName(reviewerName.trim());

      handleCloseModal();
      // Refresh feedback list
      const updated = await storefrontApi.getShopFeedback(shop.id);
      setFeedbackList(updated || []);
    } catch (err: any) {
      const msg = err.message || 'Failed to submit review. Please try again.';
      toast.error(msg);
      if (selectedFile) {
        toast.error('Note: Your photo/video was uploaded but the review submission failed. Please retry.');
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const cleanPhone = (shop.phone || shop.businessPhone || '').replace(/\D/g, '');
  const displayProducts = topRatedProducts.length > 0 ? topRatedProducts : products.slice(0, 4);
  const isProcessing = isUploading || isSubmittingFeedback;

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

  const aboutImageUrl =
    shop.aboutImageUrl || shop.coverImageUrl || shop.imageUrl || shop.bannerUrl || shop.logoUrl ||
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="space-y-12 sm:space-y-16 pb-12">
      {/* 1. Top Rated / Featured Signature Creations */}
      {topRatedEnabled && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-brand-border/60">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Top Rated Cakes</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
                Our Cake Collection
              </h2>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                Handcrafted with pure butter, couverture chocolate, and authentic fillings
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('shop')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum hover:text-brand-plum-hover transition-colors group self-start sm:self-auto cursor-pointer"
            >
              <span>Browse Full Menu ({products.length})</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {displayProducts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-brand-border/80 p-6">
              <Cake className="w-8 h-8 text-brand-muted mx-auto mb-2" />
              <p className="text-sm font-semibold text-brand-espresso">Our kitchen is preparing the fresh menu</p>
              <p className="text-xs text-brand-muted mt-1">Please check back shortly or request a custom order.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5 lg:gap-6">
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  shop={shop}
                  onSelect={onSelectProduct}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. Bespoke Custom Cake Consultation Banner */}
      {customCakesEnabled && (
        <section className="rounded-3xl bg-gradient-to-br from-brand-plum via-[#5c1d30] to-brand-espresso text-white p-8 sm:p-12 shadow-elevated relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bespoke Celebration Studio</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold leading-tight">
              Have a Dream Cake Design in Mind?
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              From multi-tier wedding cakes to personalized character birthday cakes, share your reference photo and event date with {shop.businessName}&apos;s master bakers.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => onNavigateTab('custom-cakes')}
                variant="secondary"
                className="font-bold shadow-sm"
              >
                <Sparkles className="w-4 h-4 mr-2 text-brand-plum" />
                <span>Design Your Custom Cake</span>
              </Button>
              <Button
                onClick={() => onNavigateTab('gallery')}
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <span>View Past Creations</span>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Behind the Oven / Story Teaser */}
      {aboutStoryEnabled && (
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-brand-border/80 shadow-soft">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            {/* Visual Bakery Thumbnail */}
            <div className="lg:col-span-4 relative group">
              <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-2xl overflow-hidden border border-brand-border/80 shadow-sm bg-brand-cream">
                <img
                  src={aboutImageUrl}
                  alt={`${shop.businessName} kitchen`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm flex items-center gap-1.5 text-[11px] font-bold text-brand-plum">
                  <ChefHat className="w-3.5 h-3.5 text-brand-plum" />
                  <span>Artisan Kitchen</span>
                </div>

                <div className="absolute bottom-2.5 left-3 right-3 text-white">
                  <p className="text-xs font-bold font-serif leading-tight line-clamp-1">{shop.businessName}</p>
                  <p className="text-[10px] text-white/80 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span>{shop.area ? `${shop.area}, ` : ''}{shop.city || shop.state}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5" />
                <span>Our Story</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
                About {shop.businessName}
              </h3>
              <p className="text-xs sm:text-sm text-brand-muted leading-relaxed line-clamp-4 whitespace-pre-line">
                {shop.aboutStory ||
                  shop.businessDescription ||
                  shop.description ||
                  'Welcome to our digital boutique storefront. Every celebration cake is handcrafted specifically for your event using high-grade cocoa, fresh dairy cream, and pure ingredients.'}
              </p>

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

              <div className="pt-2">
                <button
                  onClick={() => onNavigateTab('about')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum hover:text-brand-plum-hover transition-colors group cursor-pointer"
                >
                  <span>Read Full Story &amp; Kitchen Standards</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-3 bg-brand-cream-light/70 rounded-2xl p-5 border border-brand-border/60 space-y-3">
              <h4 className="text-xs font-bold text-brand-espresso uppercase tracking-wider">
                Quick Kitchen Info
              </h4>
              <div className="space-y-2 text-xs text-brand-muted">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <span className="font-medium text-brand-espresso line-clamp-3">
                    {fullAddress}
                  </span>
                </div>
                {(shop.phone || shop.businessPhone) && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-brand-plum shrink-0" />
                    <a href={`tel:${shop.phone || shop.businessPhone}`} className="hover:text-brand-plum transition-colors font-medium">
                      {shop.phone || shop.businessPhone}
                    </a>
                  </div>
                )}
                {cleanPhone && (
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=Hi%20${encodeURIComponent(shop.businessName)},%20I%20have%20an%20enquiry.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Real Customer Feedback Highlights */}
      {reviewsEnabled && (
        <section id="customer-experiences-section" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-brand-border/60">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-plum uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verified Bakery Reputation</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
                Customer Experiences &amp; Ratings
              </h3>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                Real feedback from verified celebration orders deciding bakery rankings
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Slide forward / backward buttons */}
              {feedbackList.length > 1 && (
                <div className="flex items-center gap-1.5 mr-1">
                  <button
                    type="button"
                    onClick={() => scrollReviews('left')}
                    disabled={!canScrollLeft}
                    className={`p-2 rounded-xl border border-brand-border/80 transition-all ${
                      canScrollLeft
                        ? 'bg-white hover:bg-brand-cream text-brand-espresso shadow-2xs cursor-pointer hover:border-brand-plum/40'
                        : 'bg-brand-cream/40 text-brand-muted/40 cursor-not-allowed border-brand-border/40'
                    }`}
                    title="Slide backward to earlier reviews"
                    aria-label="Slide backward"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollReviews('right')}
                    disabled={!canScrollRight}
                    className={`p-2 rounded-xl border border-brand-border/80 transition-all ${
                      canScrollRight
                        ? 'bg-white hover:bg-brand-cream text-brand-espresso shadow-2xs cursor-pointer hover:border-brand-plum/40'
                        : 'bg-brand-cream/40 text-brand-muted/40 cursor-not-allowed border-brand-border/40'
                    }`}
                    title="Slide forward to more reviews"
                    aria-label="Slide forward"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFeedbackModalOpen(true)}
                className="text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Share Experience</span>
              </Button>
            </div>
          </div>

          {/* Average Rating Scorecard (Like Zomato, Google Maps, Swiggy) */}
          <div className="bg-gradient-to-br from-white via-[#FAF7F2] to-brand-cream/30 rounded-3xl p-6 sm:p-8 border border-brand-border/80 shadow-soft">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
              {/* Column 1: Big Numeric Score & Stars */}
              <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left justify-center border-b md:border-b-0 md:border-r border-brand-border/60 pb-6 md:pb-0 md:pr-6 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-serif font-black text-brand-espresso tracking-tight">
                    {overallAvgRating.toFixed(1)}
                  </span>
                  <span className="text-xl sm:text-2xl font-serif text-brand-muted font-bold">/ 5.0</span>
                </div>

                {/* 5 Star Icons with accurate fractional/half-star rendering */}
                {renderRatingStars(overallAvgRating, 'w-5 h-5')}

                <p className="text-xs font-medium text-brand-espresso">
                  Based on <strong>{totalFeedbackCount}</strong> verified celebration review{totalFeedbackCount === 1 ? '' : 's'}
                </p>

                {/* Top Ranking Badge */}
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold shadow-2xs">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Top-Rated Bakery in {shop.city || 'Area'}</span>
                  </span>
                </div>
              </div>

              {/* Column 2: 5-to-1 Star Distribution Progress Bars */}
              <div className="md:col-span-5 space-y-2 border-b md:border-b-0 md:border-r border-brand-border/60 pb-6 md:pb-0 md:pr-6">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = starCounts[stars] || 0;
                  const percent = totalFeedbackCount > 0 ? Math.round((count / totalFeedbackCount) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-3 text-xs">
                      <span className="w-9 font-bold text-brand-espresso flex items-center gap-1 shrink-0">
                        <span>{stars}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 inline" />
                      </span>
                      {/* Bar Track */}
                      <div className="flex-1 h-2.5 bg-brand-cream-light rounded-full overflow-hidden border border-brand-border/40">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {/* Percent & Count */}
                      <span className="w-16 text-right text-[11px] text-brand-muted shrink-0 tabular-nums">
                        {percent}% ({count})
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Column 3: Trust & Ranking Highlights */}
              <div className="md:col-span-3 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-brand-espresso block">{positivePercent}% Positive Ratings</span>
                    <span className="text-[11px] text-brand-muted">Loved by celebration hosts</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-brand-blush text-brand-plum flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-brand-espresso block">Decides Top Bakery Ranking</span>
                    <span className="text-[11px] text-brand-muted">Reviews determine position on top list</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-brand-espresso block">100% Verified Bakers</span>
                    <span className="text-[11px] text-brand-muted">Replies &amp; kitchen hygiene verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer's Own Review Banner */}
          {myFeedback && (
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-brand-plum/30 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center font-bold text-sm shrink-0">
                  ★
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-brand-espresso">You shared a celebration review with {shop.businessName}</p>
                    <span className="text-[10px] font-bold text-brand-plum bg-brand-blush px-2 py-0.5 rounded-full border border-brand-plum/30">Your Review</span>
                  </div>
                  <p className="text-[11px] text-brand-muted line-clamp-1 mt-0.5">&ldquo;{myFeedback.comment}&rdquo;</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditFeedback(myFeedback)}
                  className="text-xs font-semibold gap-1.5 h-8 border-brand-plum/30 text-brand-plum hover:bg-brand-blush cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit My Review</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteFeedback(myFeedback)}
                  className="text-xs font-semibold gap-1.5 h-8 text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          )}

          {loadingFeedback ? (
            <div className="py-6 text-center text-xs text-brand-muted">Loading feedback...</div>
          ) : feedbackList.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-brand-border/80 text-center space-y-2 shadow-soft">
              <Star className="w-7 h-7 text-amber-400 mx-auto fill-amber-400/30" />
              <h4 className="text-sm font-bold font-serif text-brand-espresso">Be the First to Review</h4>
              <p className="text-xs text-brand-muted max-w-md mx-auto">
                Have you enjoyed a cake from {shop.businessName}? Share your review to help others celebrate their special moments.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsFeedbackModalOpen(true)}
                  className="text-xs font-semibold"
                >
                  Share Your Experience
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab('track')}
                  className="text-xs font-semibold"
                >
                  Track Order
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="relative py-2 -mx-4 sm:-mx-8 lg:-mx-12 px-4 sm:px-8 lg:px-12 group"
              onMouseEnter={() => setIsAutoMoving(false)}
              onMouseLeave={() => setIsAutoMoving(true)}
              onTouchStart={() => pauseAutoMoveTemporarily(8000)}
              onTouchEnd={() => pauseAutoMoveTemporarily(4000)}
            >
              {/* Left and Right Subtle Fade Gradients */}
              <div className="absolute left-0 top-0 bottom-0 w-6 sm:w-12 bg-gradient-to-r from-brand-cream-light via-brand-cream-light/70 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-6 sm:w-12 bg-gradient-to-l from-brand-cream-light via-brand-cream-light/70 to-transparent z-10 pointer-events-none" />

              {/* Floating Slide Backward Button */}
              {feedbackList.length > 1 && (
                <button
                  type="button"
                  onClick={() => scrollReviews('left')}
                  disabled={!canScrollLeft}
                  className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border shadow-lg flex items-center justify-center transition-all ${
                    canScrollLeft
                      ? 'bg-white/95 hover:bg-brand-plum text-brand-espresso hover:text-white border-brand-border/80 hover:border-brand-plum cursor-pointer opacity-90 hover:opacity-100 hover:scale-105'
                      : 'bg-white/50 text-brand-muted/30 border-brand-border/30 cursor-not-allowed opacity-0 pointer-events-none'
                  }`}
                  aria-label="Slide backward"
                  title="Slide backward to earlier reviews"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Floating Slide Forward Button */}
              {feedbackList.length > 1 && (
                <button
                  type="button"
                  onClick={() => scrollReviews('right')}
                  disabled={!canScrollRight}
                  className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border shadow-lg flex items-center justify-center transition-all ${
                    canScrollRight
                      ? 'bg-white/95 hover:bg-brand-plum text-brand-espresso hover:text-white border-brand-border/80 hover:border-brand-plum cursor-pointer opacity-90 hover:opacity-100 hover:scale-105'
                      : 'bg-white/50 text-brand-muted/30 border-brand-border/30 cursor-not-allowed opacity-0 pointer-events-none'
                  }`}
                  aria-label="Slide forward"
                  title="Slide forward to more reviews"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Responsive, User-Controlled Smooth Carousel Track */}
              <div
                ref={reviewsTrackRef}
                className="flex gap-4 overflow-x-auto scroll-smooth py-3 px-2 sm:px-4 no-scrollbar scrollbar-none snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {feedbackList.map((item, idx) => {
                  const isMine = reviewStorage.isCustomerReview(item.id, item.customerDisplayName, 'FEEDBACK');
                  return (
                    <Card
                      key={`${item.id}-${idx}`}
                      className={`w-[300px] sm:w-[350px] shrink-0 p-5 space-y-3 flex flex-col justify-between border shadow-soft hover:shadow-md transition-shadow select-none snap-start ${
                        isMine
                          ? 'border-brand-plum/40 bg-[#FAF7F2] ring-1 ring-brand-plum/20'
                          : 'bg-white border-brand-border/80'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Rating + Date row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < (item.rating || 5)
                                    ? 'text-amber-500 fill-amber-500'
                                    : 'text-brand-border fill-transparent'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isMine && (
                              <span className="text-[10px] font-bold text-brand-plum bg-brand-blush px-2 py-0.5 rounded-full border border-brand-plum/30">
                                Your Review
                              </span>
                            )}
                            <span className="text-[10px] text-brand-muted">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        </div>

                        {/* Product name badge */}
                        {item.productName && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-plum bg-brand-blush px-2 py-0.5 rounded-full border border-brand-blush-border">
                            <ShoppingBag className="w-2.5 h-2.5" />
                            <span>{item.productName}</span>
                          </div>
                        )}

                        {/* Review comment */}
                        <p className="text-xs text-brand-espresso leading-relaxed italic line-clamp-3">
                          &ldquo;{item.comment || 'Delicious and fresh!'}&rdquo;
                        </p>

                        {/* Recommendation text */}
                        {item.recommendationText && (
                          <div className="flex items-start gap-1.5 pt-1">
                            <ThumbsUp className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-brand-muted leading-relaxed line-clamp-2">
                              {item.recommendationText}
                            </p>
                          </div>
                        )}

                        {/* Cake photo */}
                        {isValidMediaUrl(item.cakeImageUrl) && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-brand-border/60 aspect-video bg-brand-cream">
                            <img
                              src={item.cakeImageUrl}
                              alt="Customer cake photo"
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                              loading="lazy"
                              onClick={() => window.open(item.cakeImageUrl, '_blank')}
                            />
                          </div>
                        )}

                        {/* Cake video */}
                        {isValidMediaUrl(item.cakeVideoUrl) && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-brand-border/60 aspect-video bg-black">
                            <video
                              src={item.cakeVideoUrl}
                              controls
                              preload="metadata"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}

                        {/* Baker / Owner Reply */}
                        {item.ownerReply && (
                          <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-brand-plum">
                              <ChefHat className="w-3.5 h-3.5 text-brand-plum shrink-0" />
                              <span>Reply from {shop.businessName || 'Bakery'}:</span>
                            </div>
                            <p className="text-xs text-brand-espresso/90 italic leading-relaxed pl-3 border-l-2 border-brand-plum/30">
                              &ldquo;{item.ownerReply}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-brand-border/40 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-brand-espresso">
                          {item.customerDisplayName || 'Verified Customer'}
                          {isMine && <span className="text-[10px] text-brand-plum font-bold ml-1">(You)</span>}
                        </span>
                        {isMine ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditFeedback(item);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-lg text-brand-plum bg-brand-blush hover:bg-brand-blush/80 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFeedback(item);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Share Experience Modal */}
      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={handleCloseModal}
        maxWidth="lg"
        title={editingFeedbackId ? 'Edit Your Review' : `Review ${shop.businessName}`}
        description={
          editingFeedbackId
            ? `Update your celebration rating and review for ${shop.businessName}`
            : 'Share your honest experience to help future cake lovers celebrate better.'
        }
      >
        <form onSubmit={handleSubmitFeedback} className="space-y-5 pt-1">
          {/* Owner Reply Notice when editing */}
          {editingFeedbackId && feedbackList.find((f) => f.id === editingFeedbackId)?.ownerReply && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-brand-plum">
                <ChefHat className="w-4 h-4 text-brand-plum shrink-0" />
                <span>{shop.businessName} previously replied to your review:</span>
              </div>
              <p className="italic text-brand-espresso/90 pl-5 border-l-2 border-brand-plum/30 leading-relaxed">
                &ldquo;{feedbackList.find((f) => f.id === editingFeedbackId)?.ownerReply}&rdquo;
              </p>
            </div>
          )}

          {/* 1. Star Rating */}
          <div>
            <label className="block text-xs font-semibold text-brand-espresso mb-1.5">
              Your Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewerRating(star)}
                  className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= reviewerRating
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-brand-border fill-transparent'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-semibold text-brand-espresso ml-2">
                {reviewerRating} of 5 Stars
              </span>
            </div>
          </div>

          {/* 2. Product / Cake selection */}
          <div>
            <label className="block text-xs font-semibold text-brand-espresso mb-1.5">
              Which cake did you order? <span className="text-brand-muted font-normal">(optional)</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                if (e.target.value !== CUSTOM_CAKE_VALUE) setCustomCakeName('');
              }}
              className="w-full text-sm border border-brand-border rounded-xl px-3 py-2 bg-white text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all"
            >
              <option value="">— Select a cake (optional) —</option>
              {products.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
              <option value={CUSTOM_CAKE_VALUE}>Custom Cake / Other</option>
            </select>
          </div>

          {/* Custom cake name input */}
          {selectedProductId === CUSTOM_CAKE_VALUE && (
            <Input
              label="Cake Name"
              placeholder="e.g. Mango Truffle Custom Cake"
              value={customCakeName}
              onChange={(e) => setCustomCakeName(e.target.value)}
            />
          )}

          {/* 3. Experience comment */}
          <Textarea
            label="How was your experience? *"
            required
            rows={3}
            placeholder="Share how fresh the cake was, the taste, decoration quality, and delivery experience..."
            value={reviewerComment}
            onChange={(e) => setReviewerComment(e.target.value)}
          />

          {/* 4. Recommendation */}
          <Textarea
            label="What would you recommend to someone choosing this cake?"
            rows={3}
            placeholder="Describe the taste, flavor profile, portion size, best occasion, presentation quality, or delivery experience — any tip that would help others decide!"
            value={reviewerRecommendation}
            onChange={(e) => setReviewerRecommendation(e.target.value)}
          />

          {/* 5. Media upload */}
          <div>
            <label className="block text-xs font-semibold text-brand-espresso mb-1.5">
              Cake Photo / Video <span className="text-brand-muted font-normal">(optional — images up to 5MB, videos up to 25MB)</span>
            </label>

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-brand-border rounded-2xl p-5 flex flex-col items-center gap-2 text-brand-muted hover:border-brand-plum/50 hover:text-brand-plum hover:bg-brand-blush/20 transition-all cursor-pointer"
              >
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">Click to upload photo or video</span>
                <span className="text-[10px]">JPEG, PNG, WEBP or MP4, WebM</span>
              </button>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-brand-border bg-brand-cream-light">
                {/* Preview */}
                {isFileVideo ? (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={filePreviewUrl!}
                      controls
                      preload="metadata"
                      className="max-h-48 max-w-full"
                    />
                  </div>
                ) : (
                  <div className="aspect-video flex items-center justify-center overflow-hidden">
                    <img
                      src={filePreviewUrl!}
                      alt="Selected media preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* File info bar */}
                <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-brand-border/60">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isFileVideo
                      ? <Play className="w-3.5 h-3.5 text-brand-plum shrink-0" />
                      : <Upload className="w-3.5 h-3.5 text-brand-plum shrink-0" />
                    }
                    <span className="text-[11px] text-brand-espresso truncate max-w-[160px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-brand-muted shrink-0">
                      ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-brand-muted hover:text-red-500 transition-colors p-1 cursor-pointer"
                    aria-label="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Upload error */}
            {uploadError && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <X className="w-3.5 h-3.5 shrink-0" />
                {uploadError}
              </p>
            )}

            {/* Upload progress indicator */}
            {isUploading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-brand-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-plum" />
                <span>Uploading media...</span>
              </div>
            )}
          </div>

          {/* 6. Display name */}
          <Input
            label="Your Name / Display Name *"
            required
            placeholder="e.g. Pooja Kulkarni"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
          />

          <div className="flex items-center justify-between gap-3 pt-2">
            {editingFeedbackId ? (
              <button
                type="button"
                onClick={() => handleDeleteFeedback({ id: editingFeedbackId })}
                disabled={isProcessing || isDeletingFeedback}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingFeedback ? 'Deleting...' : 'Delete Review'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCloseModal}
                disabled={isProcessing || isDeletingFeedback}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isProcessing || isDeletingFeedback}
                isLoading={isProcessing}
                className="bg-[#5C1D2E] hover:bg-[#4a1525] text-white"
              >
                {isUploading ? 'Uploading...' : isSubmittingFeedback ? 'Saving...' : editingFeedbackId ? 'Update Review' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
