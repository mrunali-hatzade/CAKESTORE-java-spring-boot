'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Plus,
  Minus,
  Cake,
  ShoppingBag,
  AlertTriangle,
  Clock,
  Check,
  Star,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Truck,
  Leaf,
  Layers,
  Heart,
  MessageCircle,
  ExternalLink,
  Share2,
  Pencil,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { Product } from '@/types/product';
import { Shop } from '@/types/shop';
import { useCart } from '@/context/CartContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/common/Toast';
import { reviewsApi, ProductReviewsSummary } from '@/lib/api/reviews';
import { storefrontApi } from '@/lib/api/storefront';
import { apiClient } from '@/lib/api/client';
import { reviewStorage } from '@/lib/utils/reviewStorage';
import { CakeReviewModal } from './CakeReviewModal';
import { getSafeImageUrl, isDummyOrInvalidImageUrl, FALLBACK_CAKE_IMAGE } from '@/lib/utils/image';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  shop: Shop;
  onOpenCustomQuote?: () => void;
}

const FALLBACK_CAKE = FALLBACK_CAKE_IMAGE;

const renderRatingStars = (rating: number, starSize = 'w-3.5 h-3.5') => {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillAmount = Math.max(0, Math.min(1, rating - (starIndex - 1)));
        if (fillAmount >= 0.75) {
          return <Star key={starIndex} className={`${starSize} fill-amber-400 text-amber-400 shrink-0`} />;
        } else if (fillAmount >= 0.25) {
          return (
            <div key={starIndex} className={`relative inline-block ${starSize} shrink-0`}>
              <Star className={`${starSize} text-gray-200 fill-gray-200`} />
              <div className="absolute inset-0 overflow-hidden w-[50%]">
                <Star className={`${starSize} fill-amber-400 text-amber-400`} />
              </div>
            </div>
          );
        } else {
          return <Star key={starIndex} className={`${starSize} text-gray-200 fill-gray-200 shrink-0`} />;
        }
      })}
    </div>
  );
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  shop,
  onOpenCustomQuote,
}) => {
  const { addItem, clearCart, currentShopName } = useCart();
  const toast = useToast();

  const [quantity, setQuantity] = useState(1);
  const [customMessage, setCustomMessage] = useState('');
  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isEgglessPreference, setIsEgglessPreference] = useState<boolean>(
    product?.isEggless ?? (product?.eggPreferenceDefault === 'EGGLESS')
  );

  // Accordion state
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    about: true,
    ingredients: false,
    delivery: false,
    reviews: false,
  });

  // Reviews state
  const [reviewsSummary, setReviewsSummary] = useState<ProductReviewsSummary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);

  const fetchReviews = () => {
    if (shop.id && product?.id) {
      setLoadingReviews(true);
      reviewsApi
        .getProductReviews(shop.id, product.id)
        .then((res) => setReviewsSummary(res))
        .catch(() => setReviewsSummary(null))
        .finally(() => setLoadingReviews(false));
    }
  };

  const myProductReview = reviewsSummary?.reviews?.find((r) =>
    reviewStorage.isCustomerReview(r.id, r.customerDisplayName, r.source)
  );

  const handleOpenEditReview = (r: any) => {
    const token = r.editToken || reviewStorage.getStoredReviewToken(r.id, r.source);
    setEditingReview({
      id: r.id,
      customerDisplayName: r.customerDisplayName,
      rating: r.rating,
      reviewText: r.reviewText,
      cakeImageUrl: r.cakeImageUrl,
      cakeVideoUrl: r.cakeVideoUrl,
      orderReference: r.orderReference,
      source: r.source || 'FEEDBACK',
      editToken: token,
    });
    setIsReviewModalOpen(true);
  };

  const handleDeleteReview = async (r: any) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    try {
      const token = r.editToken || reviewStorage.getStoredReviewToken(r.id, r.source);
      const customerName = r.customerDisplayName || reviewStorage.getStoredCustomerName();
      if (r.source === 'PRODUCT_REVIEW' && product?.id) {
        const phone = reviewStorage.getStoredCustomerPhone();
        const orderNumber = r.orderReference || '';
        try {
          await reviewsApi.deleteProductReview(shop.id, product.id, r.id, orderNumber, phone, token);
        } catch {
          await storefrontApi.deleteFeedback(shop.id, r.id, token, customerName);
        }
      } else {
        await storefrontApi.deleteFeedback(shop.id, r.id, token, customerName);
      }
      reviewStorage.removeStoredReview(r.id, r.source);
      toast.success('Your review has been removed.');
      fetchReviews();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    }
  };

  // Reset or initialize when product changes
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setCustomMessage('');
      setShowConflictPrompt(false);
      setSelectedAddonIds([]);
      setSelectedImageIndex(0);
      setIsEgglessPreference(product.isEggless ?? (product.eggPreferenceDefault === 'EGGLESS'));
      setOpenAccordions({
        about: true,
        ingredients: false,
        delivery: false,
        reviews: false,
      });

      if (product.variants && product.variants.length > 0) {
        setSelectedVariantId(product.variants[0].id);
      } else {
        setSelectedVariantId(undefined);
      }

      // Fetch reviews
      if (shop.id && product.id) {
        setLoadingReviews(true);
        reviewsApi
          .getProductReviews(shop.id, product.id)
          .then((res) => setReviewsSummary(res))
          .catch(() => setReviewsSummary(null))
          .finally(() => setLoadingReviews(false));
      }
    }
  }, [product, shop.id]);

  if (!product) return null;

  // Dynamic image gallery from real product images (filtered of dummy/mock domains)
  const validImages = [
    product.imageUrl,
    ...(product.images || []).map((img) => img.imageUrl),
  ].filter((url): url is string => Boolean(url) && !isDummyOrInvalidImageUrl(url));
  const galleryThumbnails = validImages.length > 0 ? validImages : [FALLBACK_CAKE];

  const hasVariants = Boolean(product.variants && product.variants.length > 0);
  const selectedVariant = hasVariants
    ? product.variants?.find((v) => v.id === selectedVariantId) || product.variants?.[0]
    : null;

  const egglessDiff = Boolean(product.allowEggChoice && isEgglessPreference && product.egglessPriceDiff)
    ? Number(product.egglessPriceDiff)
    : 0;

  const baseUnitPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price);

  const addonsTotal = (product.addons || [])
    .filter((a) => a.id && selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + Number(a.price), 0);

  const unitPrice = baseUnitPrice + addonsTotal + egglessDiff;
  const isVariantAvailable = selectedVariant ? selectedVariant.isAvailable !== false : true;
  const isAvailable = product.availability !== false && product.inStock !== false && isVariantAvailable;
  const ratingsEnabled = shop.storefrontSettings?.ratingsEnabled !== false;

  const effectiveOriginalPrice = selectedVariant?.originalPrice
    ? Number(selectedVariant.originalPrice)
    : (product.originalPrice ? Number(product.originalPrice) : null);

  const discountPercent = effectiveOriginalPrice && effectiveOriginalPrice > unitPrice
    ? Math.round(((effectiveOriginalPrice - unitPrice) / effectiveOriginalPrice) * 100)
    : 0;

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getFullItemName = () => {
    let name = product.name;
    if (selectedVariant) {
      name += ` (${selectedVariant.name})`;
    }
    const selectedAddons = (product.addons || []).filter((a) => a.id && selectedAddonIds.includes(a.id));
    if (selectedAddons.length > 0) {
      name += ` + ${selectedAddons.map((a) => a.name).join(', ')}`;
    }
    return name;
  };

  const handleAddToCart = () => {
    const result = addItem({
      productId: product.id,
      name: getFullItemName(),
      price: unitPrice,
      quantity,
      imageUrl: selectedVariant?.imageUrl || galleryThumbnails[selectedImageIndex] || product.imageUrl || FALLBACK_CAKE,
      isEggless: isEgglessPreference,
      customMessage: customMessage.trim() || undefined,
      shopId: shop.id,
      shopName: shop.businessName,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      weight: selectedVariant ? selectedVariant.name : undefined,
      dietaryPreference: isEgglessPreference ? 'EGGLESS' : 'REGULAR',
      addonIds: selectedAddonIds,
    });

    if (result.conflict) {
      setShowConflictPrompt(true);
      return;
    }

    toast.success(`Added "${product.name}" to basket!`);
    onClose();
  };

  const handleReplaceCart = () => {
    clearCart();
    addItem({
      productId: product.id,
      name: getFullItemName(),
      price: unitPrice,
      quantity,
      imageUrl: selectedVariant?.imageUrl || galleryThumbnails[selectedImageIndex] || product.imageUrl || FALLBACK_CAKE,
      isEggless: isEgglessPreference,
      customMessage: customMessage.trim() || undefined,
      shopId: shop.id,
      shopName: shop.businessName,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      weight: selectedVariant ? selectedVariant.name : undefined,
      dietaryPreference: isEgglessPreference ? 'EGGLESS' : 'REGULAR',
      addonIds: selectedAddonIds,
    });
    setShowConflictPrompt(false);
    toast.success(`Cart updated for "${shop.businessName}"!`);
    onClose();
  };

  const totalReviews = reviewsSummary?.totalReviews ?? 0;
  const averageRating = reviewsSummary?.averageRating ?? 0;

  const handleShare = async () => {
    const url = `${window.location.origin}/shop/${shop.id}/product/${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} at ${shop.businessName}!`,
          url,
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(url);
    toast.success('Product link copied to clipboard!');
  };

  const cleanPhone = (shop.businessPhone || shop.phone || '').replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  const handleWhatsAppOrder = () => {
    if (!cleanPhone) {
      toast.error('Bakery has not configured a WhatsApp contact number.');
      return;
    }
    const specs = [
      product.name,
      selectedVariant ? selectedVariant.name : null,
      product.isEggless ? '100% Pure Veg (Eggless)' : 'Contains Egg',
    ].filter(Boolean);
    let msg = `Hi ${shop.businessName}, I would like to order *${specs.join(' • ')}* (Qty: ${quantity}, Price: ₹${unitPrice * quantity}).`;
    if (customMessage.trim()) {
      msg += `\n*Cake Message:* "${customMessage.trim()}"`;
    }
    msg += `\nPlease confirm preparation and delivery availability. Thank you!`;

    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="xl" title={product.name}>
      {showConflictPrompt ? (
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold">Replace items in cart?</p>
              <p className="text-amber-700 mt-0.5">
                Your cart currently contains items from <strong>{currentShopName}</strong>. Each order is fulfilled directly by a single artisan kitchen.
              </p>
            </div>
          </div>
          <p className="text-xs text-brand-muted">
            Would you like to clear your current cart and start ordering from <strong>{shop.businessName}</strong>?
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConflictPrompt(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReplaceCart}>
              Clear & Add from this Bakery
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Sub-bar with Category & Standalone Link */}
          <div className="flex items-center justify-between pb-3 border-b border-brand-border/60 -mt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#C5A880]">
              {product.categoryName || product.category?.replace(/_/g, ' ') || 'Artisanal Creation'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand-plum transition-colors cursor-pointer"
                title="Share product"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <Link
                href={`/shop/${shop.id}/product/${product.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-brand-plum hover:text-brand-plum-hover font-semibold transition-colors group"
              >
                <span>View Standalone Page</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Multi-Thumbnail Gallery & Highlights Section */}
          <div className="space-y-3">
            {/* Main High-Resolution Photo */}
            <div className="relative h-60 sm:h-72 w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#FAF7F2] border border-brand-border/60">
              <Image
                src={getSafeImageUrl(
                  selectedVariant?.imageUrl && selectedImageIndex === 0
                    ? selectedVariant.imageUrl
                    : galleryThumbnails[selectedImageIndex],
                  FALLBACK_CAKE
                )}
                alt={product.name}
                fill
                priority
                className="object-cover object-center transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Floating Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md shadow-xs text-xs font-bold text-brand-espresso border border-brand-border/40">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isEgglessPreference ? 'bg-emerald-600 ring-2 ring-emerald-600/20' : 'bg-amber-600'
                    }`}
                  />
                  <span>
                    {product.allowEggChoice
                      ? (isEgglessPreference ? 'Eggless Option' : 'Contains Egg')
                      : (product.isEggless ?? (product.eggPreferenceDefault === 'EGGLESS'))
                        ? (shop?.isPureVeg ? '100% Pure Veg (Eggless)' : 'Eggless')
                        : 'Contains Egg'}
                  </span>
                </span>
                {product.allowEggChoice && (
                  <span className="text-[10px] font-semibold text-brand-muted bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-brand-border/30">
                    Choice Allowed
                  </span>
                )}

                {(product.categoryName || product.category) && (
                  <span className="hidden sm:inline-flex text-[11px] font-bold uppercase tracking-wider bg-black/40 text-white backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                    {product.categoryName || product.category?.replace(/_/g, ' ').toLowerCase()}
                  </span>
                )}
              </div>

              {/* Bottom Price Overlay */}
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-serif font-bold drop-shadow-md">
                      ₹{unitPrice}
                    </span>
                    {effectiveOriginalPrice && discountPercent >= 1 ? (
                      <>
                        <span className="text-xs text-white/70 line-through">
                          ₹{effectiveOriginalPrice}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {discountPercent}% OFF
                        </span>
                      </>
                    ) : null}
                  </div>
                  <span className="text-xs text-white/80 ml-1.5 font-light">
                    {hasVariants ? (selectedVariant?.name || 'per cake') : 'per cake'}
                  </span>
                </div>

                {ratingsEnabled && averageRating > 0 ? (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>{averageRating.toFixed(1)}</span>
                    <span className="text-white/70 font-normal">({totalReviews})</span>
                  </div>
                ) : (
                  <div className="text-[11px] font-medium bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-white/90">
                    Freshly Baked
                  </div>
                )}
              </div>
            </div>

            {/* Interactive 3-Thumbnail Selector */}
            <div className="flex items-center gap-2.5">
              {galleryThumbnails.map((thumb, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    selectedImageIndex === idx
                      ? 'border-[#5C1D2E] shadow-sm scale-102 ring-2 ring-[#5C1D2E]/20'
                      : 'border-brand-border/80 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image src={getSafeImageUrl(thumb, FALLBACK_CAKE)} alt={`Angle ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
              <div className="text-xs text-brand-muted pl-2 hidden sm:block">
                <p className="font-semibold text-brand-espresso">Artisan Gallery</p>
                <p className="text-[11px]">Click angle thumbnails to inspect cake details & frosting texture.</p>
              </div>
            </div>
          </div>

          {/* Configuration Form Controls */}
          <div className="space-y-4 bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-brand-border/60">

            {/* Variants Selector (Only when real variants exist in database) */}
            {hasVariants && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#2C1A1D] block">
                  Select Size & Flavor Variant
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {product.variants?.map((v) => {
                    const isSelected = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id ?? v.name}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-[#5C1D2E] text-white border-[#5C1D2E] shadow-xs'
                            : 'bg-white text-brand-espresso border-brand-border hover:bg-brand-cream/50'
                        }`}
                      >
                        <span className="block text-xs font-bold">{v.name}</span>
                        <span
                          className={`block text-[11px] font-semibold mt-0.5 ${
                            isSelected ? 'text-white/90' : 'text-brand-plum'
                          }`}
                        >
                          ₹{v.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

                        {/* Egg Choice Selector (when allowed by product) */}
            {product.allowEggChoice ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#2C1A1D] block">
                  Egg Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEgglessPreference(true)}
                    className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                      isEgglessPreference
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-brand-espresso border-brand-border hover:bg-emerald-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">🌱 Eggless</span>
                    {product.egglessPriceDiff && Number(product.egglessPriceDiff) > 0 ? (
                      <span className="text-[10px] opacity-90">+₹{product.egglessPriceDiff}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEgglessPreference(false)}
                    className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                      !isEgglessPreference
                        ? 'bg-[#5C1D2E] text-white border-[#5C1D2E] shadow-xs'
                        : 'bg-white text-brand-espresso border-brand-border hover:bg-brand-cream/50'
                    }`}
                  >
                    <span className="block text-xs font-bold">Contains Egg</span>
                    <span className="text-[10px] opacity-80">Regular Recipe</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Product Highlights Badges */}
            {product.highlights && product.highlights.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.highlights.map((h, i) => (
                  <span
                    key={h.id || i}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-plum bg-brand-blush/60 border border-brand-plum/20 px-2.5 py-1 rounded-full"
                  >
                    <Sparkles className="w-3 h-3 text-[#C5A880]" />
                    <span>{h.highlightText}</span>
                  </span>
                ))}
              </div>
            )}
            {/* Custom Message Plaque */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#2C1A1D]">
                  Custom Message on Cake Plaque (Optional)
                </label>
                <span className="text-[10px] text-brand-muted">
                  {customMessage.length}/45 chars
                </span>
              </div>
              <input
                type="text"
                maxLength={45}
                placeholder="e.g. Happy Birthday Emily!"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-brand-border bg-white text-xs sm:text-sm text-brand-espresso focus:outline-none focus:border-brand-plum focus:ring-1 focus:ring-brand-plum shadow-2xs"
              />
              <p className="text-[10px] text-brand-muted mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#C5A880]" />
                <span>Piped in rich couverture chocolate lettering on sugar fondant plaque</span>
              </p>
            </div>

            {/* Quantity Stepper & Quick Add */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-brand-border/60">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="text-xs font-semibold text-brand-espresso">Quantity:</span>
                <div className="flex items-center gap-3 border border-brand-border rounded-full px-3 py-1 bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-1 rounded-full text-brand-espresso hover:bg-brand-cream transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-serif font-bold text-sm text-brand-espresso w-6 text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-1 rounded-full text-brand-espresso hover:bg-brand-cream transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {cleanPhone && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleWhatsAppOrder}
                    className="gap-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-bold h-10 px-3.5 shadow-2xs cursor-pointer"
                    title="Inquire or order on WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 fill-current" />
                    <span>WhatsApp Order</span>
                  </Button>
                )}

                <Button
                  onClick={handleAddToCart}
                  size="md"
                  disabled={!isAvailable}
                  className="gap-2 bg-[#5C1D2E] hover:bg-[#4a1525] font-bold flex-1 sm:flex-none shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{!isAvailable ? 'Sold Out' : `Add to Basket • ₹${unitPrice * quantity}`}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 4 Expandable Information Accordions */}
          <div className="space-y-2.5 pt-1">
            {/* 1. About this cake */}
            {/* 1. About Artisan Creation */}
            {product.description && (
              <div className="border border-brand-border/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleAccordion('about')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between font-serif font-bold text-sm text-[#2C1A1D] hover:bg-brand-cream/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#5C1D2E]" />
                    <span>About This Artisan Creation</span>
                  </div>
                  {openAccordions.about ? <ChevronUp className="w-4 h-4 text-brand-muted" /> : <ChevronDown className="w-4 h-4 text-brand-muted" />}
                </button>
                {openAccordions.about && (
                  <div className="px-4 pb-4 pt-1 text-xs text-brand-muted leading-relaxed border-t border-brand-border/40 space-y-2">
                    <p className="whitespace-pre-line">{product.description}</p>
                    {product.preparationTimeHours && (
                      <div className="bg-[#FAF7F2] p-2 rounded-xl text-[11px] mt-2">
                        <span className="font-bold text-brand-espresso block">Notice Needed</span>
                        <span>{product.preparationTimeHours} hours bake time</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Ingredients & Dietary Safety (Only if ingredients or allergens are provided) */}
            {(product.ingredients || product.allergens) && (
              <div className="border border-brand-border/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleAccordion('ingredients')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between font-serif font-bold text-sm text-[#2C1A1D] hover:bg-brand-cream/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-600" />
                    <span>Ingredients &amp; Dietary Safety</span>
                  </div>
                  {openAccordions.ingredients ? <ChevronUp className="w-4 h-4 text-brand-muted" /> : <ChevronDown className="w-4 h-4 text-brand-muted" />}
                </button>
                {openAccordions.ingredients && (
                  <div className="px-4 pb-4 pt-1 text-xs text-brand-muted leading-relaxed border-t border-brand-border/40 space-y-2.5">
                    {product.ingredients && product.ingredients.trim() && (
                      <div>
                        <strong className="text-brand-espresso font-semibold block text-[11px] uppercase tracking-wider">Ingredients Used:</strong>
                        <p className="mt-0.5 whitespace-pre-line">
                          {product.ingredients.trim()}
                        </p>
                      </div>
                    )}
                    {product.allergens && product.allergens.trim() && (
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60">
                        <strong className="text-amber-900 font-semibold block text-[11px]">Allergen Notice:</strong>
                        <p className="text-amber-900/90 mt-0.5 text-[11px] whitespace-pre-line">
                          {product.allergens.trim()}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isEgglessPreference
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {product.allowEggChoice
                          ? (isEgglessPreference ? '🌱 Eggless Option Selected' : 'Contains Egg Selected')
                          : (product.isEggless ?? (product.eggPreferenceDefault === 'EGGLESS'))
                            ? (shop?.isPureVeg ? '🌱 100% Pure Veg (Eggless)' : '🌱 Eggless')
                            : 'Contains Egg'}
                      </span>
                      {product.allowEggChoice && (
                        <span className="text-[10px] text-brand-muted bg-brand-cream/40 px-2 py-0.5 rounded-full border border-brand-border/40">
                          Choice Allowed (Default: {product.eggPreferenceDefault || 'EGGLESS'})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Delivery & Storage */}
            <div className="border border-brand-border/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => toggleAccordion('delivery')}
                className="w-full px-4 py-3 text-left flex items-center justify-between font-serif font-bold text-sm text-[#2C1A1D] hover:bg-brand-cream/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Delivery &amp; Storage Guidelines</span>
                </div>
                {openAccordions.delivery ? <ChevronUp className="w-4 h-4 text-brand-muted" /> : <ChevronDown className="w-4 h-4 text-brand-muted" />}
              </button>
              {openAccordions.delivery && (
                <div className="px-4 pb-4 pt-1 text-xs text-brand-muted leading-relaxed border-t border-brand-border/40 space-y-2">
                  <p>
                    <strong>Storage:</strong> Store in an airtight refrigerator between 4°C - 8°C. Best enjoyed within 48 hours of delivery.
                  </p>
                  <p>
                    <strong>Serving Suggestion:</strong> Bring to room temperature 15 minutes prior to cutting for the silkiest texture.
                  </p>
                  <p>
                    <strong>Transport:</strong> Packaged in reinforced bakery boxes with food-safe cake boards to ensure safe transit across {shop.city || 'the city'}.
                  </p>
                </div>
              )}
            </div>

            {/* 4. Verified Customer Reviews */}
            {ratingsEnabled && (
              <div id="modal-reviews-section" className="border border-brand-border/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleAccordion('reviews')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between font-serif font-bold text-sm text-[#2C1A1D] hover:bg-brand-cream/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>Verified Customer Reviews ({totalReviews})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {myProductReview ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditReview(myProductReview);
                        }}
                        className="text-[11px] font-bold text-brand-plum bg-brand-blush hover:bg-brand-blush/80 px-2 py-0.5 rounded-lg border border-brand-plum/20 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </span>
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingReview(null);
                          setIsReviewModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-brand-plum hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Review</span>
                      </span>
                    )}
                    {openAccordions.reviews ? <ChevronUp className="w-4 h-4 text-brand-muted" /> : <ChevronDown className="w-4 h-4 text-brand-muted" />}
                  </div>
                </button>
                {openAccordions.reviews && (
                  <div className="px-4 pb-4 pt-2 border-t border-brand-border/40 space-y-4">
                    {/* Rating Breakdown Header */}
                    <div className="bg-[#FAF7F2] rounded-xl p-3.5 border border-brand-border/60 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-serif font-bold text-brand-espresso">
                          {totalReviews > 0 && averageRating > 0 ? averageRating.toFixed(1) : 'New'}
                        </div>
                        <div className="space-y-0.5">
                          {totalReviews > 0 && averageRating > 0 ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                {renderRatingStars(averageRating, 'w-4 h-4')}
                                <span className="text-xs font-semibold text-brand-muted">/ 5.0</span>
                              </div>
                              <p className="text-[11px] text-brand-muted">
                                {totalReviews} verified celebration {totalReviews === 1 ? 'rating' : 'ratings'}
                              </p>
                            </>
                          ) : (
                            <p className="text-[11px] text-brand-muted">No customer ratings yet</p>
                          )}
                        </div>
                      </div>
                      {myProductReview ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEditReview(myProductReview)}
                          className="text-xs font-bold text-brand-plum bg-brand-blush hover:bg-brand-blush/80 px-2.5 py-1 rounded-lg border border-brand-plum/20 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit My Review</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReview(null);
                            setIsReviewModalOpen(true);
                          }}
                          className="text-xs font-bold text-brand-plum hover:underline cursor-pointer"
                        >
                          Post Review
                        </button>
                      )}
                    </div>

                    {/* Reviews List */}
                    {loadingReviews ? (
                      <div className="py-4 text-center text-xs text-brand-muted">Loading reviews...</div>
                    ) : !reviewsSummary || reviewsSummary.reviews.length === 0 ? (
                      <div className="py-4 text-center space-y-1">
                        <p className="text-xs font-bold text-brand-espresso">No reviews yet for this cake</p>
                        <p className="text-[11px] text-brand-muted">Order this cake to share your feedback post-delivery.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reviewsSummary.reviews.map((rev) => {
                          const isMine = reviewStorage.isCustomerReview(rev.id, rev.customerDisplayName, rev.source);
                          return (
                            <div
                              key={`${rev.source || 'rev'}-${rev.id}`}
                              className={`p-3 rounded-xl border space-y-1.5 text-xs transition-all ${
                                isMine
                                  ? 'bg-[#FAF7F2] border-brand-plum/40 ring-1 ring-brand-plum/20'
                                  : 'bg-white border-brand-border/60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-brand-espresso">{rev.customerDisplayName}</span>
                                  {isMine && (
                                    <span className="text-[10px] font-bold text-brand-plum bg-brand-blush px-2 py-0.5 rounded-full border border-brand-plum/30">
                                      Your Review
                                    </span>
                                  )}
                                  {rev.isVerifiedPurchase && (
                                    <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                                      Verified
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`w-3 h-3 ${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              {rev.reviewText && <p className="text-brand-muted italic">&ldquo;{rev.reviewText}&rdquo;</p>}
                              {rev.cakeImageUrl && (
                                <div className="relative mt-1.5 w-20 h-20 rounded-xl overflow-hidden border border-brand-border/60 bg-black/5">
                                  <Image
                                    src={rev.cakeImageUrl}
                                    alt="Customer cake photo"
                                    fill
                                    sizes="80px"
                                    unoptimized
                                    className="object-cover cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => window.open(rev.cakeImageUrl, '_blank')}
                                  />
                                </div>
                              )}
                              {rev.cakeVideoUrl && (
                                <div className="mt-1.5 max-w-[240px] rounded-xl overflow-hidden border border-brand-border/60 bg-black">
                                  <video
                                    src={rev.cakeVideoUrl}
                                    controls
                                    playsInline
                                    className="w-full max-h-36 object-cover rounded-xl"
                                  />
                                </div>
                              )}
                              {rev.ownerReply && (
                                <div className="p-2 rounded-lg bg-brand-blush/40 text-[11px] text-brand-plum font-medium">
                                  <strong>Chef&apos;s note:</strong> {rev.ownerReply}
                                </div>
                              )}
                              {isMine && (
                                <div className="pt-2 border-t border-brand-border/30 flex items-center justify-between text-[11px]">
                                  <span className="text-brand-muted">You posted this review</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditReview(rev)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 font-semibold rounded-md text-brand-plum bg-brand-blush hover:bg-brand-blush/80 cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReview(rev)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 font-semibold rounded-md text-rose-600 bg-rose-50 hover:bg-rose-100 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {product && (
        <CakeReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setEditingReview(null);
          }}
          shopId={shop.id}
          productId={product.id}
          productName={product.name}
          shopName={shop.businessName}
          initialReview={editingReview}
          onDelete={fetchReviews}
          onReviewSubmitted={fetchReviews}
        />
      )}
    </Modal>
  );
};
