import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface AdminMarketplaceRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isMutating: boolean;
  shopName?: string;
}

export function AdminMarketplaceRestrictionModal({
  isOpen,
  onClose,
  onConfirm,
  isMutating,
  shopName,
}: AdminMarketplaceRestrictionModalProps) {
  const [restrictionReason, setRestrictionReason] = useState('');
  const [restrictionError, setRestrictionError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isMutating) {
      setRestrictionReason('');
      setRestrictionError(null);
      onClose();
    }
  };

  const handleConfirm = async () => {
    const trimmed = restrictionReason.trim();
    if (!trimmed) {
      setRestrictionError('Marketplace restriction reason is mandatory and cannot be blank.');
      return;
    }
    if (trimmed.length > 500) {
      setRestrictionError('Restriction reason must be 500 characters or fewer.');
      return;
    }

    await onConfirm(trimmed);
  };

  useEffect(() => {
    if (!isOpen) {
      setRestrictionReason('');
      setRestrictionError(null);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Apply Marketplace Restriction"
      description={`Restrict ${shopName ? `"${shopName}"` : 'this bakery'} from customer discovery and storefront ordering.`}
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">Administrative Marketplace Restriction Scope:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 leading-relaxed">
              <li>
                Hides the bakery from platform marketplace search, city discovery, and direct customer storefront visits.
              </li>
              <li>
                <strong>Does NOT lock the owner dashboard:</strong> The bakery owner can still log in, review in-progress orders, manage subscription billing, and address compliance inquiries.
              </li>
              <li>
                This is an administrative restriction (e.g. food quality audit, KYC clarification, or regional policy) and does not permanently delete the shop.
              </li>
            </ul>
          </div>
        </div>

        <Textarea
          id="marketplace-restriction-reason"
          label="Restriction Reason"
          required
          rows={3}
          placeholder="e.g., Pending updated FSSAI hygiene certificate renewal; temporarily restricted from marketplace discovery."
          value={restrictionReason}
          onChange={(e) => {
            if (e.target.value.length <= 500) {
              setRestrictionReason(e.target.value);
              if (restrictionError) setRestrictionError(null);
            }
          }}
          error={restrictionError || undefined}
          helperText={`${restrictionReason.length}/500 characters. Mandatory reason for administrative accountability.`}
          disabled={isMutating}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMutating}
            onClick={handleClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            isLoading={isMutating}
            onClick={handleConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            Confirm Restriction
          </Button>
        </div>
      </div>
    </Modal>
  );
}
