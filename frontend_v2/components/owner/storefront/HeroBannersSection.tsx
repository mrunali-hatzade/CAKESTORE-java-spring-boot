import React, { useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ShopBanner } from '@/types/storefrontManagement';
import { ownerStorefrontApi } from '@/lib/api/ownerStorefront';
import { mediaApi } from '@/lib/api/media';

interface HeroBannersSectionProps {
  banners: ShopBanner[];
  onChange: (banners: ShopBanner[]) => void;
}

export const HeroBannersSection: React.FC<HeroBannersSectionProps> = ({
  banners,
  onChange,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bannerToDelete, setBannerToDelete] = useState<number | null>(null);

  // New banner form state
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newButtonText, setNewButtonText] = useState('');
  const [newButtonUrl, setNewButtonUrl] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      const res = await mediaApi.uploadImage(file, 'covers');
      if (res && res.url) {
        setNewImageUrl(res.url);
      }
    } catch (err: any) {
      console.error('Failed to upload banner image', err);
      setErrorMessage(err.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateBanner = async () => {
    if (!newImageUrl.trim()) {
      setErrorMessage('Banner image is required.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const created = await ownerStorefrontApi.createBanner({
        title: newTitle.trim() || undefined,
        subtitle: newSubtitle.trim() || undefined,
        imageUrl: newImageUrl.trim(),
        buttonText: newButtonText.trim() || undefined,
        buttonUrl: newButtonUrl.trim() || undefined,
        displayOrder: banners.length,
        isActive: true,
      });

      onChange([...banners, created]);
      // Reset form
      setNewTitle('');
      setNewSubtitle('');
      setNewImageUrl('');
      setNewButtonText('');
      setNewButtonUrl('');
      setIsCreating(false);
    } catch (err: any) {
      console.error('Failed to create banner', err);
      setErrorMessage(err.message || 'Failed to save banner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (banner: ShopBanner) => {
    try {
      const updated = await ownerStorefrontApi.updateBanner(banner.id, {
        ...banner,
        isActive: !banner.isActive,
      });
      onChange(banners.map((b) => (b.id === banner.id ? updated : b)));
    } catch (err: any) {
      console.error('Failed to toggle banner', err);
      setErrorMessage(err.message || 'Failed to update banner');
    }
  };

  const handleDeleteBanner = async () => {
    if (!bannerToDelete) return;
    try {
      await ownerStorefrontApi.deleteBanner(bannerToDelete);
      onChange(banners.filter((b) => b.id !== bannerToDelete));
      setBannerToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete banner', err);
      setErrorMessage(err.message || 'Failed to delete banner');
      throw err; // throw so ConfirmDialog stops loading and handles it
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const newBanners = [...banners];
    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;

    // update displayOrder locally
    const reordered = newBanners.map((b, i) => ({ ...b, displayOrder: i }));
    onChange(reordered);

    // persist each banner order
    try {
      await Promise.all(
        reordered.map((b) =>
          ownerStorefrontApi.updateBanner(b.id, {
            ...b,
            displayOrder: b.displayOrder,
          })
        )
      );
    } catch (err: any) {
      console.error('Failed to persist banner order', err);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base text-owner-heading">Hero Banners Carousel</h2>
            <p className="text-[11px] text-owner-muted">
              Add multiple slides for announcements, seasonal offers, and hero visual showcases.
            </p>
          </div>
        </div>

        {!isCreating && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Banner</span>
          </Button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {errorMessage}
        </div>
      )}

      {/* Banner Creation Drawer / Form */}
      {isCreating && (
        <div className="p-5 rounded-2xl bg-brand-cream-light/60 border border-brand-border/60 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-owner-heading">New Banner Slide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Title / Headline"
              placeholder="e.g. Artisanal Sourdough & Fresh Bakes"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Input
              label="Subtitle / Sub-caption"
              placeholder="e.g. Baked fresh every morning with love"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Call to Action Button Text"
              placeholder="e.g. Order Now, Explore Menu"
              value={newButtonText}
              onChange={(e) => setNewButtonText(e.target.value)}
            />
            <Input
              label="Button Target Link"
              placeholder="e.g. /shop, #catalog, or external URL"
              value={newButtonUrl}
              onChange={(e) => setNewButtonUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-owner-heading block">Banner Image *</label>
            <div>
              <label className="cursor-pointer border-2 border-dashed border-brand-border rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 hover:border-brand-plum/50 hover:bg-brand-blush/10 transition-all text-center">
                <Upload className="w-5 h-5 text-brand-plum" />
                <span className="text-xs font-semibold text-owner-heading">
                  {isUploading ? 'Uploading banner photo...' : (newImageUrl ? 'Click to replace banner photo' : 'Click to upload banner photo')}
                </span>
                <span className="text-[10px] text-owner-muted">PNG, JPG, WebP recommended (landscape 16:9 or 21:9)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>
            {newImageUrl && (
              <div className="mt-2 relative w-full h-32 rounded-xl overflow-hidden border border-brand-border/60 bg-gray-50">
                <Image
                  src={newImageUrl}
                  alt="Banner Preview"
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                  unoptimized
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => setNewImageUrl('')}
                  className="absolute top-2 right-2 px-2 py-1 text-[11px] font-bold bg-white/90 text-rose-600 rounded-lg shadow-sm hover:bg-white cursor-pointer z-10"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreating(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreateBanner}
              disabled={isSaving || isUploading}
            >
              {isSaving ? 'Saving...' : 'Add Banner'}
            </Button>
          </div>
        </div>
      )}

      {/* Existing Banners List */}
      {banners.length === 0 && !isCreating ? (
        <div className="py-8 text-center text-xs text-owner-muted border border-dashed rounded-2xl border-brand-border">
          No hero banners created yet. Click &quot;Add Banner&quot; above to create carousel slides.
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all ${
                banner.isActive
                  ? 'border-brand-border/80 bg-white'
                  : 'border-brand-border/40 bg-gray-50/70 opacity-60'
              }`}
            >
              {/* Order Controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMove(index, 'up')}
                  className="p-1 text-owner-muted hover:text-owner-heading disabled:opacity-20 transition-all"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === banners.length - 1}
                  onClick={() => handleMove(index, 'down')}
                  className="p-1 text-owner-muted hover:text-owner-heading disabled:opacity-20 transition-all"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Banner Thumbnail */}
              <div className="w-24 h-14 rounded-xl overflow-hidden bg-brand-cream-light shrink-0 border border-brand-border/40 relative">
                <Image
                  src={banner.imageUrl}
                  alt={banner.title || 'Hero Banner'}
                  fill
                  sizes="96px"
                  unoptimized
                  className="object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-owner-heading truncate">
                    {banner.title || 'Untitled Banner'}
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      banner.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {banner.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {banner.subtitle && (
                  <p className="text-[11px] text-owner-muted truncate mt-0.5">
                    {banner.subtitle}
                  </p>
                )}
                {banner.buttonText && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-brand-plum font-bold mt-1">
                    <ExternalLink className="w-3 h-3" />
                    {banner.buttonText} ({banner.buttonUrl || '#'})
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(banner)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-xl border border-brand-border hover:bg-brand-cream-light/60 transition-all"
                >
                  {banner.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setBannerToDelete(banner.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                  title="Delete Banner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={bannerToDelete !== null}
        onClose={() => setBannerToDelete(null)}
        onConfirm={handleDeleteBanner}
        title="Remove Banner"
        description="Are you sure you want to remove this banner? This action cannot be undone."
        confirmLabel="Remove"
        isDestructive={true}
      />
    </Card>
  );
};
