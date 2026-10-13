import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Sparkles, 
  ShoppingBag, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Send 
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { CustomCakeRequest } from '@/types/owner';
import { ownerApi } from '@/lib/api/owner';

interface CustomCakeDetailsModalProps {
  isOpen: boolean;
  cake: CustomCakeRequest | null;
  onClose: () => void;
  onConvertClick: (cake: CustomCakeRequest) => void;
  onSuccessRefresh: () => void;
  onPreviewImage: (url: string) => void;
  formatFullDateTime: (dateString?: string) => string;
}

export const CustomCakeDetailsModal: React.FC<CustomCakeDetailsModalProps> = ({
  isOpen,
  cake,
  onClose,
  onConvertClick,
  onSuccessRefresh,
  onPreviewImage,
  formatFullDateTime,
}) => {
  const [responseStatus, setResponseStatus] = useState<string>('QUOTED');
  const [responseText, setResponseText] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (cake) {
      setResponseStatus(
        cake.status === 'PENDING' || cake.status === 'NEW' ? 'QUOTED' : cake.status || 'QUOTED'
      );
      setResponseText(cake.ownerResponse || '');
      setActionSuccess(null);
      setActionError(null);
    }
  }, [cake]);

  const handleSubmitCakeResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cake) return;
    setSubmitting(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      await ownerApi.respondToCustomCakeRequest(cake.id, responseStatus, responseText);
      setActionSuccess('Quote & status saved! Notification email dispatched to customer.');
      setTimeout(() => {
        onClose();
        onSuccessRefresh();
      }, 1200);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cake) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Custom Cake Request #${cake.id}`}
    >
      <form onSubmit={handleSubmitCakeResponse} className="space-y-4">
        {/* Direct Conversion Callout inside Review Modal */}
        {!(cake.convertedOrderNumber || cake.convertedOrderId) ? (
          <div className="p-3.5 rounded-2xl bg-brand-blush/60 border border-brand-blush-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-brand-plum flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready to finalize this order?</span>
              </p>
              <p className="text-[11px] text-brand-espresso/80 mt-0.5">
                Convert this consultation brief directly into an active kitchen order.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onClose();
                onConvertClick(cake);
              }}
              className="bg-brand-plum text-white text-xs font-semibold shrink-0 flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Convert to Order</span>
            </Button>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  Already Converted to Order #{cake.convertedOrderNumber || cake.convertedOrderId}
                </p>
                <p className="text-[11px] text-emerald-700">Currently active in your Orders & Fulfillment dashboard.</p>
              </div>
            </div>
            <Link href={`/dashboard/owner/orders?orderId=${cake.convertedOrderId}`}>
              <Button type="button" size="sm" variant="outline" className="text-xs text-emerald-800 bg-white border-emerald-300 flex items-center gap-1">
                <span>Open Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {/* Customer Details Box */}
        <div className="p-3.5 rounded-2xl bg-owner-canvas border border-owner-border text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-owner-heading text-sm">{cake.customerName}</span>
            <span className="text-owner-muted">{cake.customerEmail}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-owner-muted text-[11px] pt-1 border-t border-owner-border/60">
            {cake.createdAt && (
              <span className="flex items-center gap-1 text-brand-plum font-semibold">
                <Clock className="w-3 h-3" />
                <span>Requested: {formatFullDateTime(cake.createdAt)}</span>
              </span>
            )}
            {cake.customerMobile && <span>Phone: {cake.customerMobile}</span>}
            {cake.requiredDate && <span>Event: {cake.requiredDate}</span>}
            {cake.budget && <span>Budget: ₹{cake.budget}</span>}
          </div>
        </div>

        {/* Design Brief */}
        {cake.designDescription && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-owner-heading block">Customer Brief & Requirements</label>
            <p className="text-xs text-owner-muted p-3 rounded-xl bg-white border border-owner-border leading-relaxed">
              {cake.designDescription}
            </p>
          </div>
        )}

        {/* Dynamic Custom Form Field Values */}
        {cake.fieldValues && cake.fieldValues.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-owner-heading block">Custom Specifications</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cake.fieldValues.map((fv, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-owner-canvas border border-owner-border text-xs">
                  <p className="text-[10px] text-owner-muted uppercase font-bold tracking-wider">{fv.fieldLabel || fv.fieldKey}</p>
                  {fv.fieldValue && fv.fieldValue.startsWith('http') ? (
                    <div
                      className="relative mt-1.5 w-16 h-16 rounded-lg overflow-hidden border border-owner-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onPreviewImage(fv.fieldValue)}
                    >
                      <Image
                        src={fv.fieldValue}
                        alt="Attachment"
                        fill
                        sizes="64px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <p className="font-semibold text-owner-heading mt-0.5 whitespace-pre-wrap">{fv.fieldValue || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reference Image Preview */}
        {cake.referenceImageUrl && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-owner-heading block">Reference Design</label>
            <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-owner-border bg-brand-cream">
              <Image
                src={cake.referenceImageUrl}
                alt="Reference design"
                fill
                sizes="(max-width: 640px) 100vw, 500px"
                unoptimized
                className="object-cover"
              />
            </div>
          </div>
        )}

        {/* Status Dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-owner-heading block">Update Status</label>
          <select
            value={responseStatus}
            onChange={(e) => setResponseStatus(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-owner-border text-xs text-owner-heading bg-white focus:outline-none focus:ring-2 focus:ring-brand-plum/20"
          >
            <option value="QUOTED">Quoted (Price Quote Sent to Customer)</option>
            <option value="REVIEWED">Reviewed (In Discussion)</option>
            <option value="ACCEPTED">Accepted (Order Confirmed)</option>
            <option value="REJECTED">Declined (Unavailable / Fully Booked)</option>
          </select>
        </div>

        {/* Response Notes / Price Quote */}
        <Textarea
          label="Baker Response / Price Quote"
          rows={3}
          placeholder="e.g. We would love to bake this! The quote for 2.5kg Belgian Chocolate with handmade fondant toppers is ₹3,800..."
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          required
        />

        {actionSuccess && (
          <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            {actionSuccess}
          </p>
        )}

        {actionError && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {actionError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={submitting}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit Response & Quote
          </Button>
        </div>
      </form>
    </Modal>
  );
};
