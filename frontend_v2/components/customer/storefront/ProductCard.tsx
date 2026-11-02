'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Heart, Star, ShoppingBag, SlidersHorizontal, Check, Share2 } from 'lucide-react';
import { Product } from '@/types/product';
import { Shop } from '@/types/shop';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/common/Toast';
import { getSafeImageUrl, FALLBACK_CAKE_IMAGE } from '@/lib/utils/image';

import { useFavorites } from '@/context/FavoritesContext';

interface ProductCardProps {
  product: Product;
  shop?: Shop;
  onSelect: (product: Product) => void;
}

const FALLBACK_CAKE = FALLBACK_CAKE_IMAGE;

// Helper to generate flavor descriptor chips from product information
function getFlavorChips(product: Product): string[] {
  const chips: string[] = [];
  const text = `${product.name} ${product.description || ''} ${product.category || ''}`.toLowerCase();

  if (text.includes('chocolate') || text.includes('truffle') || text.includes('fudge')) {
    chips.push('Belgian Cocoa');
  }
  if (text.includes('red velvet') || text.includes('velvet')) {
    chips.push('Cream Cheese');
  }
  if (text.includes('fruit') || text.includes('mango') || text.includes('berry') || text.includes('strawberry')) {
    chips.push('Fresh Fruits');
  }
  if (text.includes('vanilla') || text.includes('butterscotch') || text.includes('caramel')) {
    chips.push('Rich Caramel');
  }
  if (text.includes('biscoff') || text.includes('lotus') || text.includes('cookie')) {
    chips.push('Lotus Biscoff');
  }
  if (text.includes('cheese') || text.includes('cheesecake')) {
    chips.push('Philadelphia Style');
  }

  // Fallbacks if no specific flavor keywords matched
  if (chips.length === 0) {
    if (product.isEggless) chips.push('100% Eggless');
    chips.push('Artisan Baked');
  } else if (chips.length === 1) {
    chips.push('Moist Sponge');
  }

  return chips.slice(0, 2);
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, shop, onSelect }) => {
  const [imgSrc, setImgSrc] = useState(() => getSafeImageUrl(product.imageUrl, FALLBACK_CAKE));
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    setImgSrc(getSafeImageUrl(product.imageUrl, FALLBACK_CAKE));
  }, [product.imageUrl]);

  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(product.id);

  const { addItem } = useCart();
  const toast = useToast();

  const flavorChips = getFlavorChips(product);
  const isAvailable = product.availability !== false && product.inStock !== false;

  const hasVariants = Boolean(product.variants && product.variants.length > 0);
  const defaultVariant = hasVariants ? product.variants![0] : null;
  const displayPrice = defaultVariant ? Number(defaultVariant.price) : Number(product.price);
  const displayOriginalPrice = defaultVariant?.originalPrice
    ? Number(defaultVariant.originalPrice)
    : (product.originalPrice ? Number(product.originalPrice) : null);
  const discountPercent = displayOriginalPrice && displayOriginalPrice > displayPrice
    ? Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)
    : 0;

  const ratingsEnabled = shop?.storefrontSettings?.ratingsEnabled !== false;
  const hasRating = ratingsEnabled && Boolean(product.rating && product.rating > 0);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAvailable) {
      toast.error('This product is currently out of stock.');
      return;
    }

    const result = addItem({
      productId: product.id,
      name: defaultVariant ? `${product.name} (${defaultVariant.name})` : product.name,
      price: displayPrice,
      quantity: 1,
      imageUrl: defaultVariant?.imageUrl || product.imageUrl || FALLBACK_CAKE,
      isEggless: product.isEggless,
      shopId: shop?.id || product.shopId,
      shopName: shop?.businessName || 'Bakery Boutique',
      variantId: defaultVariant?.id,
      variantName: defaultVariant?.name,
    });

    if (result.conflict) {
      toast.error('Cart contains items from another bakery. Clear cart first to order from here.');
      return;
    }

    setIsAdded(true);
    toast.success(`Added "${product.name}" to basket!`);
    setTimeout(() => setIsAdded(false), 1800);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product, shop?.id || product.shopId, shop?.businessName || 'Bakery Boutique');
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/shop/${shop?.id || product.shopId}/product/${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} at ${shop?.businessName || 'Bakery Boutique'}!`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(url);
    toast.success('Product link copied to clipboard!');
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className="group cursor-pointer flex flex-col justify-between overflow-hidden bg-white border border-brand-border/70 hover:border-[#C5A880]/60 rounded-xl sm:rounded-2xl shadow-soft hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 relative"
    >
        <div className="p-3 sm:p-4 pb-0">
          {/* Padded Image Container */}
          <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-[#FAF7F2] rounded-xl border border-brand-border/40">
          <Image
            src={imgSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-out ${
              !isAvailable ? 'grayscale opacity-60' : ''
            }`}
            onError={() => setImgSrc(FALLBACK_CAKE)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Top-Left: Dietary Badges Container */}
          <div className="absolute top-3 left-3 flex flex-col gap-1 items-start z-10">
            {(() => {
              const hasEggChoice = Boolean(product.allowEggChoice);
              const isVeg = hasEggChoice
                ? (product.eggPreferenceDefault === 'EGGLESS')
                : (product.isEggless ?? (product.eggPreferenceDefault === 'EGGLESS'));
              const badgeLabel = hasEggChoice
                ? 'EGGLESS OPTION'
                : (isVeg ? (shop?.isPureVeg ? '100% VEG' : 'VEG') : 'NON-VEG');
              const isGreen = hasEggChoice || isVeg;

              return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md shadow-xs text-[10px] font-bold border border-brand-border/40">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isGreen ? 'bg-emerald-600 ring-2 ring-emerald-600/20' : 'bg-amber-600 ring-2 ring-amber-600/20'
                    }`}
                  />
                  <span className={isGreen ? 'text-emerald-800' : 'text-amber-900'}>
                    {badgeLabel}
                  </span>
                </div>
              );
            })()}

            {product.isVegan && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50/95 border border-green-200 text-green-800 text-[10px] font-bold shadow-2xs backdrop-blur-xs">
                🌱 Vegan
              </span>
            )}

            {product.isGlutenFree && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50/95 border border-amber-200 text-amber-800 text-[10px] font-bold shadow-2xs backdrop-blur-xs">
                🌾 Gluten-Free
              </span>
            )}
          </div>

          {/* Out of Stock Overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <span className="bg-red-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow-md">
                Sold Out
              </span>
            </div>
          )}

          {/* Top-Right: Quick Actions (Share & Wishlist) */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share product"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/90 backdrop-blur-md shadow-xs hover:text-brand-plum hover:bg-white hover:scale-110 border border-brand-border/40 transition-all cursor-pointer text-brand-muted"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label="Save to favorites"
              className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-xs transition-all cursor-pointer ${
                isFav
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 scale-105'
                  : 'bg-white/90 text-brand-muted hover:text-rose-500 hover:bg-white hover:scale-110 border border-brand-border/40'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-3 sm:p-3.5 space-y-1.5">
          {/* Category & Rating Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C5A880] truncate">
              {product.categoryName || product.category?.replace(/_/g, ' ') || 'Artisanal Cake'}
            </span>

            {hasRating ? (
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-espresso bg-amber-50/80 px-2 py-0.5 rounded-full border border-amber-200/60 shrink-0">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{product.rating!.toFixed(1)}</span>
                {(product.reviewCount || product.totalReviews) ? (
                  <span className="text-[10px] text-brand-muted font-normal">
                    ({product.reviewCount || product.totalReviews})
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-[10px] font-medium text-brand-muted bg-brand-cream px-2 py-0.5 rounded-full">
                Fresh Baked
              </span>
            )}
          </div>

          {/* Product Title */}
          <h3 className="font-serif font-bold text-sm sm:text-base text-[#2C1A1D] line-clamp-1 group-hover:text-brand-plum transition-colors">
            {product.name}
          </h3>

          {/* Flavor Descriptor Chips */}
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {flavorChips.map((chip, idx) => (
              <span
                key={idx}
                className="text-[10px] font-medium text-brand-muted bg-[#FAF7F2] border border-brand-border/60 px-2 py-0.5 rounded-md"
              >
                {chip}
              </span>
            ))}
            {product.weightGrams ? (
              <span className="text-[10px] font-medium text-brand-muted bg-[#FAF7F2] border border-brand-border/60 px-2 py-0.5 rounded-md">
                {product.weightGrams >= 1000 ? `${product.weightGrams / 1000}kg` : `${product.weightGrams}g`}
              </span>
            ) : null}
          </div>

          {/* Prominent Price & Discount */}
          <div className="pt-0.5 flex items-baseline gap-1.5 flex-wrap">
            <span className="font-serif font-bold text-lg sm:text-xl text-[#2C1A1D]">
              ₹{displayPrice}
            </span>
            {displayOriginalPrice && discountPercent >= 1 ? (
              <>
                <span className="text-xs text-brand-muted line-through">
                  ₹{displayOriginalPrice}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {discountPercent}% OFF
                </span>
              </>
            ) : null}
            <span className="text-[11px] text-brand-muted font-normal">
              {defaultVariant ? `(${defaultVariant.name})` : product.weightGrams ? `/ ${product.weightGrams >= 1000 ? `${product.weightGrams / 1000}kg` : `${product.weightGrams}g`}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Dual CTA Actions */}
      <div className="p-3 sm:p-3.5 pt-0 grid grid-cols-2 gap-2 mt-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(product);
          }}
          className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border border-brand-border/80 hover:border-brand-plum hover:bg-brand-blush/40 text-brand-espresso text-xs font-semibold transition-all active:scale-95"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-brand-plum" />
          <span>Customize</span>
        </button>

        <button
          type="button"
          disabled={!isAvailable}
          onClick={handleQuickAdd}
          className={`w-full inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs active:scale-95 ${
            !isAvailable
              ? 'bg-brand-muted/50 cursor-not-allowed text-white/80'
              : isAdded
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-[#5C1D2E] hover:bg-[#4a1525]'
          }`}
        >
          {!isAvailable ? (
            <span>Sold Out</span>
          ) : isAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Added!</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
