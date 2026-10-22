/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Scale,
  Upload,
  Link as LinkIcon,
  Sparkles,
  Award,
  Egg,
  Percent,
  Layers,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import { productsApi } from '@/lib/api/products';
import { mediaApi } from '@/lib/api/media';
import { categoriesApi } from '@/lib/api/categories';
import {
  Product,
  ProductVariant,
  ProductImage,
  ProductHighlight,
  Category,
  CreateProductRequest,
} from '@/types/product';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/common/Toast';
import { useUnsavedChanges } from '@/context/UnsavedChangesContext';

const FALLBACK_CAKE =
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80';

const PRESET_IMAGES = [
  { label: '🍫 Chocolate', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80' },
  { label: '🍓 Red Velvet', url: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80' },
  { label: '🥭 Mango', url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80' },
  { label: '🍪 Biscoff', url: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80' },
  { label: '🧁 Cupcakes', url: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&w=800&q=80' },
];

const WEIGHT_PRESETS = [
  { label: '500g', defaultMultiplier: 1 },
  { label: '1 kg', defaultMultiplier: 1.85 },
  { label: '1.5 kg', defaultMultiplier: 2.7 },
  { label: '2 kg', defaultMultiplier: 3.5 },
];

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  categories: Category[];
  onSaveSuccess: () => Promise<void>;
  isDuplicate?: boolean;
}

export function ProductModal({
  isOpen,
  onClose,
  editingProduct,
  categories,
  onSaveSuccess,
  isDuplicate = false,
}: ProductModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setDirty } = useUnsavedChanges();
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [localDirty, setLocalDirty] = useState(false);

  // Product Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [isEggless, setIsEggless] = useState(true);
  const [allowEggChoice, setAllowEggChoice] = useState(false);
  const [eggPreferenceDefault, setEggPreferenceDefault] = useState<'EGGLESS' | 'REGULAR'>('EGGLESS');
  const [egglessPriceDiff, setEgglessPriceDiff] = useState('0');
  const [inStock, setInStock] = useState(true);
  const [imageUrl, setImageUrl] = useState(PRESET_IMAGES[0].url);
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');

  // Structured Highlights
  const [highlights, setHighlights] = useState<string[]>([]);
  const [newHighlightInput, setNewHighlightInput] = useState('');

  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Inline Category Creator
  const [inlineCatOpen, setInlineCatOpen] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');
  const [inlineCatLoading, setInlineCatLoading] = useState(false);
  const [inlineCatError, setInlineCatError] = useState<string | null>(null);

  // New variant input fields
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantOriginalPrice, setNewVariantOriginalPrice] = useState('');
  const [newVariantDesc, setNewVariantDesc] = useState('');
  const [newVariantImageUrl, setNewVariantImageUrl] = useState('');

  // Media
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Alternative images
  const [altImages, setAltImages] = useState<string[]>([]);
  const [altImageUrlInput, setAltImageUrlInput] = useState('');
  const [isUploadingAlt, setIsUploadingAlt] = useState(false);
  const altFileInputRef = useRef<HTMLInputElement>(null);
  
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingVariant, setIsUploadingVariant] = useState(false);

  // Snapshot for dirty state tracking
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const currentSnapshot = JSON.stringify({
    name, description, price, originalPrice, selectedCategoryId,
    isEggless, allowEggChoice, eggPreferenceDefault, egglessPriceDiff,
    inStock, imageUrl, ingredients, allergens, highlights, variants, altImages
  });

  useEffect(() => {
    if (isOpen) {
      if (initialSnapshot === null) {
        setInitialSnapshot(currentSnapshot);
      } else {
        const dirty = currentSnapshot !== initialSnapshot;
        setLocalDirty(dirty);
        setDirty('product-modal', dirty);
      }
    } else {
      setInitialSnapshot(null);
      setLocalDirty(false);
      setDirty('product-modal', false);
      setShowCloseWarning(false);
    }
  }, [isOpen, currentSnapshot, initialSnapshot, setDirty]);

  const handleAttemptClose = () => {
    if (localDirty) {
      setShowCloseWarning(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseWarning(false);
    onClose();
  };

  // Reset or populate fields when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        const p = editingProduct;
        setName(isDuplicate ? `${p.name} (Copy)` : p.name);
        setDescription(p.description || '');
        setIngredients(p.ingredients || '');
        setAllergens(p.allergens || '');
        const initialPrice =
          p.variants && p.variants.length > 0 && p.variants[0].price != null
            ? String(p.variants[0].price)
            : String(p.price || '');
        setPrice(initialPrice);
        setOriginalPrice(p.originalPrice != null ? String(p.originalPrice) : '');
        setSelectedCategoryId(p.categoryId ? String(p.categoryId) : '');
        setInlineCatOpen(false);
        setInlineCatName('');
        setInlineCatError(null);
        setIsEggless(p.isEggless);
        setAllowEggChoice(Boolean(p.allowEggChoice));
        setEggPreferenceDefault(p.eggPreferenceDefault === 'REGULAR' ? 'REGULAR' : 'EGGLESS');
        setEgglessPriceDiff(p.egglessPriceDiff != null ? String(p.egglessPriceDiff) : '0');
        setInStock(p.inStock !== false);
        setImageUrl(p.imageUrl || FALLBACK_CAKE);
        setImageTab('url');

        if (p.images && p.images.length > 0) {
          setAltImages(p.images.map((img) => img.imageUrl));
        } else {
          setAltImages([]);
        }
        setAltImageUrlInput('');

        if (p.highlights && p.highlights.length > 0) {
          setHighlights(p.highlights.map((h) => h.highlightText));
        } else {
          setHighlights([]);
        }
        setNewHighlightInput('');

        setVariants(p.variants && p.variants.length > 0 ? [...p.variants] : []);
      } else {
        setName('');
        setDescription('');
        setPrice('450');
        setOriginalPrice('');
        setSelectedCategoryId('');
        setInlineCatOpen(false);
        setInlineCatName('');
        setInlineCatError(null);
        setIsEggless(true);
        setAllowEggChoice(false);
        setEggPreferenceDefault('EGGLESS');
        setEgglessPriceDiff('0');
        setInStock(true);
        setImageUrl(PRESET_IMAGES[0].url);
        setImageTab('url');
        setAltImages([]);
        setAltImageUrlInput('');
        setHighlights(['100% Pure Veg', 'Zero Artificial Flavors', 'Baked Fresh Daily']);
        setNewHighlightInput('');
        setIngredients('');
        setAllergens('');
        setVariants([
          { name: '500g', price: 450, isAvailable: true },
          { name: '1 kg', price: 850, isAvailable: true },
        ]);
      }
    }
  }, [isOpen, editingProduct, isDuplicate]);

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setIsUploading(true);
    try {
      const result = await mediaApi.uploadImage(file, 'products');
      setImageUrl(result.url);
      toast.success('Main photo uploaded!');
    } catch {
      toast.error('Failed to upload image. Please try again.');
      setImageUrl(URL.createObjectURL(file));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadAltImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    if (altImages.length >= 3) {
      toast.info('Maximum 3 alternative images allowed.');
      return;
    }
    setIsUploadingAlt(true);
    try {
      const result = await mediaApi.uploadImage(file, 'products');
      setAltImages([...altImages, result.url]);
      toast.success('Alternative photo uploaded!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload photo');
    } finally {
      setIsUploadingAlt(false);
      if (altFileInputRef.current) altFileInputRef.current.value = '';
    }
  };

  const handleUploadVariantImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVariant(true);
    try {
      const result = await mediaApi.uploadImage(file, 'products');
      setNewVariantImageUrl(result.url);
      toast.success('Variant photo uploaded!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload variant photo');
    } finally {
      setIsUploadingVariant(false);
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
    }
  };

  const handleAddAltImageUrl = () => {
    if (!altImageUrlInput.trim()) return;
    if (altImages.length >= 3) {
      toast.info('Maximum 3 alternative images allowed.');
      return;
    }
    setAltImages([...altImages, altImageUrlInput.trim()]);
    setAltImageUrlInput('');
  };

  const handleRemoveAltImage = (index: number) => {
    setAltImages(altImages.filter((_, idx) => idx !== index));
  };

  const handleAddHighlight = () => {
    const text = newHighlightInput.trim();
    if (!text) return;
    if (highlights.includes(text)) return;
    setHighlights([...highlights, text]);
    setNewHighlightInput('');
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights(highlights.filter((_, idx) => idx !== index));
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0 && variants.length > 0) {
      setVariants((prev) => prev.map((v, i) => (i === 0 ? { ...v, price: num } : v)));
    }
  };

  const handleUpdateVariantPrice = (index: number, val: number) => {
    setVariants((prev) => {
      const updated = prev.map((v, i) => (i === index ? { ...v, price: val } : v));
      if (index === 0) {
        setPrice(String(val));
      }
      return updated;
    });
  };

  const handleAddPresetVariant = (presetName: string, multiplier: number) => {
    const baseP = Number(price) || 450;
    const calcPrice = Math.round(baseP * multiplier);
    if (!variants.some((v) => v.name.toLowerCase() === presetName.toLowerCase())) {
      const newVariants = [...variants, { name: presetName, price: calcPrice, isAvailable: true }];
      setVariants(newVariants);
      if (newVariants.length === 1 || !price) {
        setPrice(String(calcPrice));
      }
    }
  };

  const handleAddCustomVariant = () => {
    if (!newVariantName.trim() || !newVariantPrice) return;
    const pNum = Number(newVariantPrice);
    const newV: ProductVariant = {
      name: newVariantName.trim(),
      price: pNum,
      originalPrice: newVariantOriginalPrice ? Number(newVariantOriginalPrice) : null,
      description: newVariantDesc.trim() || null,
      imageUrl: newVariantImageUrl.trim() || null,
      isAvailable: true,
    };
    const updatedVariants = [...variants, newV];
    setVariants(updatedVariants);
    if (updatedVariants.length === 1 || !price) {
      setPrice(String(pNum));
    }
    setNewVariantName('');
    setNewVariantPrice('');
    setNewVariantOriginalPrice('');
    setNewVariantDesc('');
    setNewVariantImageUrl('');
  };

  const handleRemoveVariant = (index: number) => {
    const updated = variants.filter((_, idx) => idx !== index);
    setVariants(updated);
    if (index === 0 && updated.length > 0) {
      setPrice(String(updated[0].price));
    }
  };

  const handleQuickCreateCategory = async () => {
    const trimmed = inlineCatName.trim();
    if (!trimmed) {
      setInlineCatError('Category name is required.');
      return;
    }
    setInlineCatLoading(true);
    setInlineCatError(null);
    try {
      const created = await categoriesApi.createCategory({ name: trimmed });
      setSelectedCategoryId(String(created.id));
      setInlineCatOpen(false);
      setInlineCatName('');
    } catch (err: any) {
      setInlineCatError(err.message || 'Failed to create category.');
    } finally {
      setInlineCatLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const baseSellingPrice = variants.length > 0 ? Number(variants[0].price) : Number(price);
    const comparePriceNum = originalPrice ? Number(originalPrice) : null;

    if (comparePriceNum !== null && comparePriceNum <= baseSellingPrice) {
      toast.error('Original compare-at price must be greater than the selling price to show a discount.');
      setIsSubmitting(false);
      return;
    }

    const imagePayload: ProductImage[] = altImages.map((imgUrl, idx) => ({
      imageUrl: imgUrl,
      displayOrder: idx + 1,
      altText: name,
    }));

    const highlightPayload: ProductHighlight[] = highlights.map((hText, idx) => ({
      highlightText: hText,
      displayOrder: idx + 1,
    }));

    const productPayload: CreateProductRequest = {
      name,
      description,
      ingredients: ingredients.trim() || null,
      allergens: allergens.trim() || null,
      price: baseSellingPrice,
      originalPrice: comparePriceNum,
      categoryId: selectedCategoryId ? Number(selectedCategoryId) : null,
      isEggless,
      allowEggChoice,
      eggPreferenceDefault,
      egglessPriceDiff: allowEggChoice ? Number(egglessPriceDiff) || 0 : 0,
      inStock,
      availability: inStock,
      imageUrl: imageUrl || FALLBACK_CAKE,
      images: imagePayload,
      highlights: highlightPayload,
      variants,
    };

    try {
      if (editingProduct && !isDuplicate) {
        await productsApi.updateProduct(editingProduct.id, productPayload);
        toast.success('Cake details updated successfully!');
      } else {
        await productsApi.createProduct(productPayload);
        toast.success('New cake added to catalog!');
      }
      setInitialSnapshot(currentSnapshot);
      setLocalDirty(false);
      setDirty('product-modal', false);
      onClose();
      await onSaveSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleAttemptClose}
      maxWidth="5xl"
      title={editingProduct && !isDuplicate ? 'Edit Cake Details' : 'Add New Cake to Storefront'}
    >
      <form onSubmit={handleSaveProduct} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            <Input
              label="Cake Name *"
              required
              placeholder="e.g. Belgian Dark Truffle"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Description / Flavor Notes"
              placeholder="Layered rich dark chocolate sponge with 54% Belgian ganache"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* Category */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-brand-espresso">Category</label>
                {!inlineCatOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setInlineCatOpen(true);
                      setInlineCatError(null);
                    }}
                    className="text-xs font-semibold text-brand-plum hover:text-brand-plum-dark flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> New Category
                  </button>
                )}
              </div>

              {!inlineCatOpen ? (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-brand-border text-brand-espresso text-sm focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-brand-cream-light/80 border border-brand-border space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand-espresso font-serif">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-brand-plum" /> Quick Add Category
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineCatOpen(false);
                        setInlineCatName('');
                        setInlineCatError(null);
                      }}
                      className="text-brand-muted hover:text-brand-espresso"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Birthday Cakes"
                      value={inlineCatName}
                      onChange={(e) => setInlineCatName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-brand-border bg-white text-brand-espresso focus:outline-none focus:ring-1 focus:ring-brand-plum"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      isLoading={inlineCatLoading}
                      onClick={handleQuickCreateCategory}
                      className="text-xs shrink-0"
                    >
                      Add
                    </Button>
                  </div>
                  {inlineCatError && (
                    <p className="text-[11px] text-red-600 font-medium">{inlineCatError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="p-4 rounded-2xl bg-owner-canvas/60 border border-owner-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-owner-heading">
                  <Percent className="w-3.5 h-3.5 text-brand-plum" />
                  <span>Pricing & Discount</span>
                </div>
                {variants.length > 0 && (
                  <span className="text-[10px] text-brand-plum font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Synced with {variants[0].name}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Selling Price (₹) *"
                  type="number"
                  required
                  min="1"
                  placeholder="450"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  helperText={
                    variants.length > 0
                      ? `Auto-synced with ${variants[0].name || 'base variant'}`
                      : 'Base price charged to customer'
                  }
                />

                <Input
                  label="Original Price / Compare-At (₹)"
                  type="number"
                  min="0"
                  placeholder="e.g. 550 (Optional)"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  helperText="Shows strikethrough badge (e.g. 15% OFF)."
                />
              </div>
            </div>

            {/* Egg Preference Section */}
            <div className="p-4 rounded-2xl bg-brand-cream-light/60 border border-brand-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-owner-heading">
                  <Egg className="w-3.5 h-3.5 text-brand-plum" />
                  <span>Egg & Dietary Preference</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-espresso">
                  <input
                    type="checkbox"
                    checked={allowEggChoice}
                    onChange={(e) => setAllowEggChoice(e.target.checked)}
                    className="rounded text-brand-plum focus:ring-brand-plum"
                  />
                  <span>Allow Customer to Choose</span>
                </label>
              </div>

              {!allowEggChoice ? (
                <label className="flex items-center gap-2 text-xs text-owner-heading font-medium cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isEggless}
                    onChange={(e) => setIsEggless(e.target.checked)}
                    className="rounded text-brand-plum focus:ring-brand-plum"
                  />
                  <span>🌱 100% Pure Eggless Cake (Fixed)</span>
                </label>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-owner-heading block">Default Preference</label>
                    <select
                      value={eggPreferenceDefault}
                      onChange={(e) => setEggPreferenceDefault(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-white border-brand-border focus:outline-none focus:ring-1 focus:ring-brand-plum"
                    >
                      <option value="EGGLESS">🌱 Eggless by default</option>
                      <option value="REGULAR">🥚 With Egg by default</option>
                    </select>
                  </div>

                  <Input
                    label="Eggless Price Difference (₹)"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={egglessPriceDiff}
                    onChange={(e) => setEgglessPriceDiff(e.target.value)}
                    helperText="Extra charged when customer chooses eggless."
                  />
                </div>
              )}
            </div>

            {/* Ingredients */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-brand-espresso">
                  Ingredients <span className="text-[10px] text-brand-muted font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-brand-muted">{ingredients.length}/1000</span>
              </div>
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="Enter the ingredients used in this cake (e.g. Dutch cocoa powder, Belgian couverture chocolate)..."
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-brand-border text-brand-espresso text-xs placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all resize-none"
              />
            </div>

            {/* Allergen Information */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-brand-espresso">
                  Allergen Information <span className="text-[10px] text-brand-muted font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-brand-muted">{allergens.length}/500</span>
              </div>
              <textarea
                rows={2}
                maxLength={500}
                placeholder="Example: Contains dairy, gluten, nuts..."
                value={allergens}
                onChange={(e) => setAllergens(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-brand-border text-brand-espresso text-xs placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all resize-none"
              />
            </div>

            {/* Live Availability Status */}
            <div className="pt-2 border-t border-owner-border/70">
              <label className="flex items-center gap-2 text-xs text-owner-heading font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="rounded text-brand-plum focus:ring-brand-plum cursor-pointer"
                />
                <span>In Stock & Live on Storefront</span>
              </label>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* Cake Main Photo Section */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-owner-heading block">Main Product Photo *</label>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-owner-border rounded-2xl p-4 text-center hover:border-brand-plum/50 hover:bg-brand-blush/10 transition-all cursor-pointer"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-owner-muted">
                      <div className="w-4 h-4 border-2 border-brand-plum border-t-transparent rounded-full animate-spin" />
                      <span>Uploading photo...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-owner-muted mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-owner-heading">
                        {imageUrl ? 'Click to replace main cake photo' : 'Click to upload main cake photo'}
                      </p>
                      <p className="text-[10px] text-owner-muted mt-0.5">JPG, PNG, WebP up to 5MB</p>
                    </>
                  )}
                </button>
              </div>

              {imageUrl && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-owner-canvas border border-owner-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-brand-cream border shrink-0">
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-owner-heading block">Main photo ready</span>
                      <span className="text-[10px] text-owner-muted">Shown on catalog & checkout</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Alternative Images */}
            <div className="p-3.5 rounded-2xl bg-owner-canvas/60 border border-owner-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-owner-heading">
                  <ImageIcon className="w-3.5 h-3.5 text-brand-plum" />
                  <span>Alternative Photos ({altImages.length}/3)</span>
                </div>
                <span className="text-[10px] text-owner-muted font-medium">Angles &amp; slices</span>
              </div>
              <p className="text-[11px] text-owner-muted">
                Upload up to 3 photos (maximum 5 MB each).
              </p>

              {altImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {altImages.map((img, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-brand-border h-20 bg-white">
                      <img src={img} alt={`Alt ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveAltImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {altImages.length < 3 && (
                <div className="pt-0.5">
                  <input
                    ref={altFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadAltImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => altFileInputRef.current?.click()}
                    isLoading={isUploadingAlt}
                    className="w-full gap-1.5 text-xs py-2 border-dashed"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Additional Photo ({altImages.length}/3)</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Variants Section */}
            <div className="p-4 rounded-2xl bg-owner-canvas/60 border border-owner-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-owner-heading">
                  <Layers className="w-3.5 h-3.5 text-brand-plum" />
                  <span>Sizes &amp; Flavours Variants</span>
                </div>
                <span className="text-[10px] text-owner-muted">Live price alignment</span>
              </div>

              {/* Quick Add Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-owner-muted font-medium">Quick Add:</span>
                {WEIGHT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleAddPresetVariant(p.label, p.defaultMultiplier)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-owner-border text-brand-espresso hover:border-brand-plum hover:bg-brand-blush/30 transition-colors cursor-pointer"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>

              {/* Existing Variants List */}
              {variants.length > 0 && (
                <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-0.5">
                  {variants.map((v, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-owner-border text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {v.imageUrl && (
                          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-brand-border">
                            <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-owner-heading truncate">{v.name}</span>
                            {idx === 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-brand-blush text-brand-plum">
                                Primary / Base
                              </span>
                            )}
                          </div>
                          {v.description && (
                            <span className="text-[10px] text-owner-muted truncate block">{v.description}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-owner-canvas/80 px-2 py-1 rounded-lg border border-owner-border">
                          <span className="text-[10px] text-owner-muted font-bold">₹</span>
                          <input
                            type="number"
                            value={v.price}
                            onChange={(e) => handleUpdateVariantPrice(idx, Number(e.target.value) || 0)}
                            className="w-14 text-xs font-mono font-bold text-brand-plum bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                            title="Edit variant price (syncs automatically)"
                          />
                        </div>
                        {v.originalPrice && (
                          <span className="line-through text-owner-muted text-[10px]">
                            ₹{v.originalPrice}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="text-owner-muted hover:text-red-600 p-1 transition-colors cursor-pointer"
                          title="Remove variant"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Variant Form */}
              <div className="space-y-2 pt-2 border-t border-brand-border/40">
                <span className="text-[11px] font-bold text-owner-heading block">Add Custom Variant:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Variant (e.g. 1.5 kg)"
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                  />
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={newVariantPrice}
                    onChange={(e) => setNewVariantPrice(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                  />
                  <input
                    type="number"
                    placeholder="Compare (₹)"
                    value={newVariantOriginalPrice}
                    onChange={(e) => setNewVariantOriginalPrice(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={variantFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadVariantImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => variantFileInputRef.current?.click()}
                    isLoading={isUploadingVariant}
                    className="text-xs gap-1 shrink-0 h-8"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{newVariantImageUrl ? 'Photo ✓' : 'Photo'}</span>
                  </Button>
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={newVariantDesc}
                    onChange={(e) => setNewVariantDesc(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-xl border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomVariant}
                    className="text-xs shrink-0 h-8"
                  >
                    + Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Product Highlights Badges */}
            <div className="p-3.5 rounded-2xl bg-owner-canvas/60 border border-owner-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-owner-heading">
                  <Award className="w-3.5 h-3.5 text-brand-plum" />
                  <span>Product Badges</span>
                </div>
                <span className="text-[10px] text-owner-muted">Highlights</span>
              </div>

              {highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {highlights.map((h, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-owner-border text-owner-heading text-[11px] font-medium shadow-2xs"
                    >
                      <span>★ {h}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(idx)}
                        className="text-owner-muted hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. 100% Pure Butter, Zero Preservatives"
                  value={newHighlightInput}
                  onChange={(e) => setNewHighlightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHighlight();
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-xl border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddHighlight} className="h-8 text-xs">
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 flex justify-end gap-3 border-t border-owner-border">
          <Button variant="ghost" type="button" onClick={handleAttemptClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {editingProduct && !isDuplicate ? 'Save Changes' : 'Publish Cake to Catalog'}
          </Button>
        </div>
      </form>

      {/* Unsaved Changes Warning Modal inside Product Modal */}
      <Modal isOpen={showCloseWarning} onClose={() => setShowCloseWarning(false)} title="Unsaved Changes">
        <div className="space-y-6">
          <p className="text-sm text-owner-muted leading-relaxed">
            You have unsaved changes. Are you sure you want to close this? Your changes will be permanently lost.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCloseWarning(false)}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={handleConfirmClose}>
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
