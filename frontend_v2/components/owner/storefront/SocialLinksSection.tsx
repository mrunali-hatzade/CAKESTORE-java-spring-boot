import React, { useState } from 'react';
import {
  Share2,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SocialIcon } from '@/components/common/SocialIcon';
import {
  ShopSocialLink,
  ShopSocialLinkRequest,
  SocialPlatformType,
} from '@/types/storefrontManagement';
import { ownerStorefrontApi } from '@/lib/api/ownerStorefront';

interface SocialLinksSectionProps {
  links: ShopSocialLink[];
  onChange: (links: ShopSocialLink[]) => void;
}

const PLATFORM_OPTIONS: { value: SocialPlatformType; label: string; defaultTitle: string; placeholder: string }[] = [
  { value: 'INSTAGRAM', label: 'Instagram', defaultTitle: 'Instagram', placeholder: 'https://instagram.com/yourbakery' },
  { value: 'FACEBOOK', label: 'Facebook', defaultTitle: 'Facebook', placeholder: 'https://facebook.com/yourbakery' },
  { value: 'YOUTUBE', label: 'YouTube', defaultTitle: 'YouTube', placeholder: 'https://youtube.com/@yourbakery' },
  { value: 'WHATSAPP', label: 'WhatsApp Channel / Chat', defaultTitle: 'WhatsApp', placeholder: 'https://wa.me/919876543210' },
  { value: 'PINTEREST', label: 'Pinterest', defaultTitle: 'Pinterest Board', placeholder: 'https://pinterest.com/yourbakery' },
  { value: 'TELEGRAM', label: 'Telegram', defaultTitle: 'Telegram Channel', placeholder: 'https://t.me/yourbakery' },
  { value: 'LINKEDIN', label: 'LinkedIn', defaultTitle: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourbakery' },
  { value: 'TIKTOK', label: 'TikTok', defaultTitle: 'TikTok', placeholder: 'https://tiktok.com/@yourbakery' },
  { value: 'WEBSITE', label: 'Personal Bakery Website', defaultTitle: 'Official Website', placeholder: 'https://mybakery.com' },
  { value: 'CUSTOM', label: 'Custom External Link', defaultTitle: 'Visit Our Link', placeholder: 'https://...' },
];

export const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({
  links,
  onChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<number | null>(null);

  // Form State
  const [platform, setPlatform] = useState<SocialPlatformType>('INSTAGRAM');
  const [title, setTitle] = useState('Instagram');
  const [url, setUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setPlatform('INSTAGRAM');
    setTitle('Instagram');
    setUrl('');
    setIsActive(true);
    setEditingId(null);
    setErrorMessage(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ShopSocialLink) => {
    setEditingId(item.id);
    setPlatform(item.platform);
    setTitle(item.title);
    setUrl(item.url);
    setIsActive(item.isActive);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handlePlatformChange = (newPlatform: string) => {
    setPlatform(newPlatform as SocialPlatformType);
    const matched = PLATFORM_OPTIONS.find((opt) => opt.value === newPlatform);
    if (matched && (!editingId || !title.trim() || PLATFORM_OPTIONS.some((o) => o.defaultTitle === title))) {
      setTitle(matched.defaultTitle);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Display name is required');
      return;
    }
    if (!url.trim()) {
      setErrorMessage('URL is required');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const payload: ShopSocialLinkRequest = {
        platform,
        title: title.trim(),
        url: url.trim(),
        isActive,
        displayOrder: editingId
          ? links.find((l) => l.id === editingId)?.displayOrder || 0
          : links.length,
      };

      if (editingId) {
        const updated = await ownerStorefrontApi.updateSocialLink(editingId, payload);
        onChange(links.map((l) => (l.id === editingId ? updated : l)));
      } else {
        const created = await ownerStorefrontApi.createSocialLink(payload);
        onChange([...links, created]);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save social link');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!linkToDelete) return;
    try {
      setIsSaving(true);
      await ownerStorefrontApi.deleteSocialLink(linkToDelete);
      onChange(links.filter((l) => l.id !== linkToDelete));
      setLinkToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete social link');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: ShopSocialLink) => {
    try {
      const updated = await ownerStorefrontApi.updateSocialLink(item.id, {
        platform: item.platform,
        title: item.title,
        url: item.url,
        isActive: !item.isActive,
        displayOrder: item.displayOrder,
      });
      onChange(links.map((l) => (l.id === item.id ? updated : l)));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle link status');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= links.length) return;

    const reordered = [...links];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Update display orders
    const updated = reordered.map((l, idx) => ({ ...l, displayOrder: idx }));
    onChange(updated);

    // Persist target positions
    try {
      await Promise.all([
        ownerStorefrontApi.updateSocialLink(updated[index].id, {
          platform: updated[index].platform,
          title: updated[index].title,
          url: updated[index].url,
          isActive: updated[index].isActive,
          displayOrder: updated[index].displayOrder,
        }),
        ownerStorefrontApi.updateSocialLink(updated[targetIndex].id, {
          platform: updated[targetIndex].platform,
          title: updated[targetIndex].title,
          url: updated[targetIndex].url,
          isActive: updated[targetIndex].isActive,
          displayOrder: updated[targetIndex].displayOrder,
        }),
      ]);
    } catch (err) {
      console.error('Failed to persist order', err);
    }
  };

  const selectedPlatformMeta = PLATFORM_OPTIONS.find((p) => p.value === platform) || PLATFORM_OPTIONS[PLATFORM_OPTIONS.length - 1];

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-owner-heading">Social Media &amp; External Links</h2>
              <p className="text-[11px] text-owner-muted">
                Connect your Instagram, YouTube, TikTok, Facebook, WhatsApp channel, and personal website.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleOpenCreate}
          className="shrink-0 text-xs font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Social Link</span>
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-10 bg-brand-cream-light/30 rounded-2xl border border-dashed border-brand-border/80 p-6 space-y-2">
          <Globe className="w-8 h-8 text-brand-muted mx-auto" />
          <p className="text-xs font-bold text-brand-espresso">No Social or External Links Configured</p>
          <p className="text-[11px] text-owner-muted max-w-md mx-auto">
            Add your social profiles to build buyer trust and showcase past celebration cake designs directly from your digital storefront.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenCreate}
            className="mt-2 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Add First Link</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {links.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                item.isActive
                  ? 'border-brand-border/70 bg-white hover:border-brand-plum/40 shadow-xs'
                  : 'border-brand-border/40 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-blush/60 text-brand-plum flex items-center justify-center shrink-0">
                  <SocialIcon platform={item.platform} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-owner-heading truncate">
                      {item.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-cream border border-brand-border/60 text-brand-espresso">
                      {item.platform}
                    </span>
                    {!item.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-700">
                        Hidden
                      </span>
                    )}
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-owner-muted hover:text-brand-plum truncate flex items-center gap-1 mt-0.5"
                  >
                    <span className="truncate">{item.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMove(index, 'up')}
                  disabled={index === 0}
                  className="p-1.5 rounded-lg text-owner-muted hover:text-brand-plum hover:bg-brand-cream disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 'down')}
                  disabled={index === links.length - 1}
                  className="p-1.5 rounded-lg text-owner-muted hover:text-brand-plum hover:bg-brand-cream disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    item.isActive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.isActive ? 'Active' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 rounded-lg text-owner-muted hover:text-brand-plum hover:bg-brand-cream transition-colors"
                  title="Edit Link"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLinkToDelete(item.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                  title="Delete Link"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-owner-border max-w-md w-full p-6 shadow-elevated space-y-5">
            <div>
              <h3 className="font-serif font-bold text-lg text-owner-heading">
                {editingId ? 'Edit Social Link' : 'Add Social or External Link'}
              </h3>
              <p className="text-xs text-owner-muted mt-0.5">
                Configure your public platform link with custom display name and URL.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-espresso">
                  Platform / Channel Type
                </label>
                <Select
                  value={platform}
                  onChange={(e) => handlePlatformChange(e.target.value)}
                  options={PLATFORM_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  className="w-full text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-espresso">
                  Display Label on Storefront
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Follow on Instagram"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-espresso">
                  Target Web URL
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={selectedPlatformMeta.placeholder}
                  helperText="Must start with https:// or http://"
                  required
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-brand-plum rounded border-brand-border focus:ring-brand-plum"
                />
                <span className="text-xs font-medium text-owner-heading">
                  Show on public storefront immediately
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="text-xs font-semibold"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update Link' : 'Add Link'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(linkToDelete)}
        title="Delete Social Link"
        description="Are you sure you want to delete this link? It will be removed from your public digital storefront."
        confirmLabel="Delete Link"
        isDestructive={true}
        onConfirm={handleDelete}
        onClose={() => setLinkToDelete(null)}
      />
    </Card>
  );
};
