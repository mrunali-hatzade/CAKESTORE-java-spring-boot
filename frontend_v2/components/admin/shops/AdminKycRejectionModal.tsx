import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, XCircle } from 'lucide-react';

interface AdminKycRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isMutating: boolean;
  title?: string;
  description?: string;
}

export function AdminKycRejectionModal({
  isOpen,
  onClose,
  onConfirm,
  isMutating,
  title = "Reject Verification Documents",
  description = "Notify the bakery owner why their verification requires correction."
}: AdminKycRejectionModalProps) {
  const [kycRejectionReason, setKycRejectionReason] = useState('');
  const [kycRejectionError, setKycRejectionError] = useState<string | null>(null);

  const handleClose = () => {
    setKycRejectionReason('');
    setKycRejectionError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!kycRejectionReason || !kycRejectionReason.trim()) {
      setKycRejectionError('Rejection reason is mandatory and cannot be blank.');
      return;
    }

    await onConfirm(kycRejectionReason);
  };

  React.useEffect(() => {
    if (!isOpen) {
      setKycRejectionReason('');
      setKycRejectionError(null);
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
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Owner Feedback:</strong> The reason you provide will be sent directly to the bakery owner via in-app notifications and displayed in their compliance settings.
          </p>
        </div>

        <Textarea
          label="Rejection Reason & Next Steps"
          required
          rows={4}
          placeholder="e.g. Uploaded FSSAI certificate is expired or illegible. Please provide valid license matching registered address..."
          value={kycRejectionReason}
          onChange={(e) => {
            setKycRejectionReason(e.target.value);
            if (kycRejectionError) setKycRejectionError(null);
          }}
          error={kycRejectionError || undefined}
          helperText="A clear, actionable explanation helps the baker resolve the issue quickly."
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
            disabled={!kycRejectionReason.trim() || isMutating}
            isLoading={isMutating}
            onClick={handleConfirm}
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            <span>Reject Verification</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
