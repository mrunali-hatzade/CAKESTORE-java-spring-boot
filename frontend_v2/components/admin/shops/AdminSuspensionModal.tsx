import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Ban } from 'lucide-react';

interface AdminSuspensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isMutating: boolean;
  title?: string;
  description?: string;
  selectedBakeryNames?: string[];
}

export function AdminSuspensionModal({
  isOpen,
  onClose,
  onConfirm,
  isMutating,
  title = "Suspend Bakery Storefront",
  description = "Immediately revoke public storefront access and suspend operational permissions.",
  selectedBakeryNames,
}: AdminSuspensionModalProps) {
  const [suspensionReason, setSuspensionReason] = useState('');
  const [suspensionError, setSuspensionError] = useState<string | null>(null);

  const handleClose = () => {
    setSuspensionReason('');
    setSuspensionError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!suspensionReason || !suspensionReason.trim()) {
      setSuspensionError('Suspension reason is mandatory and cannot be blank.');
      return;
    }
    
    await onConfirm(suspensionReason);
  };

  React.useEffect(() => {
    if (!isOpen) {
      setSuspensionReason('');
      setSuspensionError(null);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={description}
    >
      <div className="space-y-4">
        {selectedBakeryNames && selectedBakeryNames.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <span className="font-bold text-slate-900 block">
              Selected Bakeries ({selectedBakeryNames.length}):
            </span>
            <p className="text-slate-600 font-medium">
              {selectedBakeryNames.slice(0, 3).join(', ')}
              {selectedBakeryNames.length > 3 && (
                <span className="font-semibold text-slate-900">
                  {' '}and {selectedBakeryNames.length - 3} more
                </span>
              )}
            </p>
            <p className="text-[11px] text-rose-600 font-medium pt-0.5">
              This suspension action will apply to every selected bakery above.
            </p>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Impact Notice:</strong> Suspending this shop will immediately hide its products from the marketplace, prevent customer checkout, and block the owner from kitchen operations.
          </p>
        </div>

        <Textarea
          label="Suspension Reason"
          required
          rows={4}
          placeholder="e.g. Non-compliance with hygiene regulations or repeated order cancellations..."
          value={suspensionReason}
          onChange={(e) => {
            setSuspensionReason(e.target.value);
            if (suspensionError) setSuspensionError(null);
          }}
          error={suspensionError || undefined}
          helperText="A mandatory, non-blank reason is required for administrative accountability."
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isMutating}
            onClick={handleClose}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            size="sm"
            disabled={!suspensionReason.trim() || isMutating}
            isLoading={isMutating}
            onClick={handleConfirm}
          >
            <Ban className="w-4 h-4 mr-1.5" />
            <span>Confirm Suspension</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
