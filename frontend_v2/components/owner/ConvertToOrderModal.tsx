import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  CheckCircle2, 
  ArrowRight, 
  ShoppingBag, 
  AlertCircle, 
  Truck, 
  Store, 
  MapPin, 
  Banknote, 
  Check, 
  CreditCard 
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CustomCakeRequest, ConvertToOrderResult } from '@/types/owner';
import { DeliverySlot } from '@/types/deliverySlot';
import { ownerApi } from '@/lib/api/owner';
import { deliverySlotsApi } from '@/lib/api/deliverySlots';
import { useToast } from '@/components/common/Toast';
import { useOwner } from '@/context/OwnerContext';

interface ConvertToOrderModalProps {
  isOpen: boolean;
  cake: CustomCakeRequest | null;
  onClose: () => void;
  onSuccessRefresh: () => void;
  onPreviewImage: (url: string) => void;
}

export const ConvertToOrderModal: React.FC<ConvertToOrderModalProps> = ({
  isOpen,
  cake,
  onClose,
  onSuccessRefresh,
  onPreviewImage,
}) => {
  const toast = useToast();
  const { refreshSidebarCounts } = useOwner();

  const [ownerDeliverySlots, setOwnerDeliverySlots] = useState<DeliverySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<ConvertToOrderResult | null>(null);

  const [convertForm, setConvertForm] = useState({
    agreedPrice: '',
    deliveryCharge: '0',
    deliveryDate: '',
    fulfillmentType: 'DOORSTEP_DELIVERY' as 'DOORSTEP_DELIVERY' | 'STORE_PICKUP',
    deliveryAddress: '',
    deliverySlotId: '',
    paymentMethod: 'COD',
    notes: '',
  });

  useEffect(() => {
    if (cake && isOpen) {
      setConvertSuccess(null);
      setConvertError(null);

      const initialPrice = cake.budget ? String(cake.budget) : '';
      const initialDate = cake.requiredDate || '';
      const isPickup = !!(cake.deliveryPreference && cake.deliveryPreference.toLowerCase().includes('pickup'));

      let extractedQuote = '';
      if (cake.ownerResponse) {
        const match = cake.ownerResponse.match(/₹\s*([0-9,]+)/);
        if (match) {
          extractedQuote = match[1].replace(/,/g, '');
        }
      }

      setConvertForm({
        agreedPrice: extractedQuote || initialPrice || '',
        deliveryCharge: isPickup ? '0' : '0',
        deliveryDate: initialDate,
        fulfillmentType: isPickup ? 'STORE_PICKUP' : 'DOORSTEP_DELIVERY',
        deliveryAddress: !isPickup ? (cake.deliveryPreference || '') : '',
        deliverySlotId: '',
        paymentMethod: 'COD',
        notes: cake.designDescription || '',
      });

      if (ownerDeliverySlots.length === 0) {
        setSlotsLoading(true);
        deliverySlotsApi.getOwnerSlots()
          .then((slots) => setOwnerDeliverySlots(slots || []))
          .catch(() => {})
          .finally(() => setSlotsLoading(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cake, isOpen]);

  const handleExecuteConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cake) return;

    const priceNum = parseFloat(convertForm.agreedPrice || '0');
    if (isNaN(priceNum) || priceNum < 0) {
      setConvertError('Please specify a valid agreed price for this custom cake.');
      return;
    }

    const deliveryChargeNum = parseFloat(convertForm.deliveryCharge || '0');

    setIsConverting(true);
    setConvertError(null);

    try {
      const result = await ownerApi.convertToOrder(cake.id, {
        agreedPrice: priceNum,
        deliveryCharge: isNaN(deliveryChargeNum) ? 0 : deliveryChargeNum,
        deliveryDate: convertForm.deliveryDate || undefined,
        fulfillmentType: convertForm.fulfillmentType,
        deliveryAddress: convertForm.fulfillmentType === 'DOORSTEP_DELIVERY' ? convertForm.deliveryAddress : undefined,
        deliverySlotId: convertForm.deliverySlotId ? Number(convertForm.deliverySlotId) : undefined,
        paymentMethod: convertForm.paymentMethod,
        paymentStatus: convertForm.paymentMethod === 'COD' ? 'PENDING' : 'PAID',
        notes: convertForm.notes,
      });

      setConvertSuccess(result);
      toast.success(`Custom cake converted to official Order #${result.orderNumber}!`);
      onSuccessRefresh();
      refreshSidebarCounts?.();
    } catch (err: any) {
      setConvertError(err?.message || 'Failed to convert custom cake request to order.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleClose = () => {
    if (!isConverting) {
      setConvertSuccess(null);
      onClose();
    }
  };

  const formatSlotTime = (time?: string) => {
    if (!time) return '';
    try {
      const parts = time.split(':');
      let hour = parseInt(parts[0], 10);
      const min = parts[1] || '00';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour.toString().padStart(2, '0')}:${min} ${ampm}`;
    } catch {
      return time;
    }
  };

  if (!cake) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={convertSuccess ? "Order Confirmed & Created" : `Convert Custom Cake Request #${cake.id} to Order`}
    >
      <div>
        {convertSuccess ? (
          /* Success Confirmation View */
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold font-serif text-owner-heading">
                Order #${convertSuccess.orderNumber} Created!
              </h3>
              <p className="text-xs text-owner-muted max-w-sm mx-auto">
                This custom request has been accepted and moved directly to your kitchen queue with status <strong className="text-emerald-700">CONFIRMED</strong>.
              </p>
            </div>

            {/* Details Summary Card */}
            <div className="p-4 rounded-2xl bg-owner-canvas border border-owner-border text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between items-center py-1 border-b border-owner-border/60">
                <span className="text-owner-muted">Customer</span>
                <span className="font-semibold text-owner-heading">{cake.customerName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-owner-border/60">
                <span className="text-owner-muted">Cake Concept</span>
                <span className="font-semibold text-owner-heading">{cake.occasion || 'Custom Bespoke Cake'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-owner-border/60">
                <span className="text-owner-muted">Event / Delivery Date</span>
                <span className="font-semibold text-owner-heading">{convertForm.deliveryDate || 'As agreed'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-owner-muted">Total Order Amount</span>
                <span className="text-sm font-bold text-brand-plum">₹{convertSuccess.totalAmount?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs text-left flex items-start gap-2">
              <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Official order confirmation email and SMS updates have been dispatched to <strong>{cake.customerEmail}</strong>.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <Link
                href={`/dashboard/owner/orders?orderId=${convertSuccess.orderId}`}
                className="w-full sm:w-auto"
              >
                <Button className="w-full bg-brand-plum hover:bg-brand-plum/90 text-white text-xs font-semibold flex items-center justify-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span>View in Orders Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full sm:w-auto text-xs"
                onClick={handleClose}
              >
                Done / Return
              </Button>
            </div>
          </div>
        ) : (
          /* Conversion Form */
          <form onSubmit={handleExecuteConvert} className="space-y-4">
            {/* Brief Summary Card */}
            <div className="p-3.5 rounded-2xl bg-brand-blush/40 border border-brand-blush-border text-xs flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-owner-heading text-sm">{cake.customerName}</span>
                  <span className="text-brand-plum font-semibold">({cake.occasion || 'Custom Celebration'})</span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-owner-muted">
                  {cake.flavour && <span>Flavour: <strong>{cake.flavour}</strong></span>}
                  {cake.servings && <span>• Servings: <strong>{cake.servings}</strong></span>}
                  {cake.requiredDate && <span>• Date: <strong>{cake.requiredDate}</strong></span>}
                  {cake.budget && <span>• Client Budget: <strong>₹{cake.budget}</strong></span>}
                </div>
              </div>

              {cake.referenceImageUrl && (
                <div
                  onClick={() => onPreviewImage(cake.referenceImageUrl || '')}
                  className="relative w-14 h-14 rounded-xl overflow-hidden border border-brand-blush-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <Image
                    src={cake.referenceImageUrl}
                    alt="Reference"
                    fill
                    sizes="56px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {convertError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{convertError}</span>
              </div>
            )}

            {/* 1. Pricing Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Agreed Cake Price (₹)"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 3500"
                value={convertForm.agreedPrice}
                onChange={(e) => setConvertForm({ ...convertForm, agreedPrice: e.target.value })}
                required
                helperText="Agreed bespoke cake price"
              />

              <Input
                label="Delivery Charge (₹)"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={convertForm.deliveryCharge}
                onChange={(e) => setConvertForm({ ...convertForm, deliveryCharge: e.target.value })}
                helperText="0 for free delivery or pickup"
              />
            </div>

            {/* 2. Fulfillment Type & Delivery Schedule */}
            <div className="space-y-3 p-3.5 rounded-2xl bg-owner-canvas border border-owner-border">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-owner-heading block">Fulfillment Preference</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConvertForm({ ...convertForm, fulfillmentType: 'DOORSTEP_DELIVERY' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      convertForm.fulfillmentType === 'DOORSTEP_DELIVERY'
                        ? 'bg-brand-plum text-white border-brand-plum shadow-sm'
                        : 'bg-white text-owner-muted border-owner-border hover:bg-brand-cream/50'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Doorstep Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConvertForm({ ...convertForm, fulfillmentType: 'STORE_PICKUP', deliveryCharge: '0' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      convertForm.fulfillmentType === 'STORE_PICKUP'
                        ? 'bg-brand-plum text-white border-brand-plum shadow-sm'
                        : 'bg-white text-owner-muted border-owner-border hover:bg-brand-cream/50'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Bakery Store Pickup</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Input
                  label="Event / Delivery Date"
                  type="date"
                  value={convertForm.deliveryDate}
                  onChange={(e) => setConvertForm({ ...convertForm, deliveryDate: e.target.value })}
                  required
                />

                {/* Delivery Slot Selection */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-brand-espresso">
                    Bakery Slot (Optional)
                  </label>
                  <select
                    value={convertForm.deliverySlotId}
                    onChange={(e) => setConvertForm({ ...convertForm, deliverySlotId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-brand-border text-brand-espresso text-sm focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum"
                  >
                    <option value="">Any Time / Flexible Slot</option>
                    {ownerDeliverySlots
                      .filter((s) => s.isActive)
                      .map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.dayOfWeek}: {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                        </option>
                      ))}
                  </select>
                  {slotsLoading && <p className="text-[10px] text-owner-muted">Loading available slots...</p>}
                </div>
              </div>

              {convertForm.fulfillmentType === 'DOORSTEP_DELIVERY' ? (
                <Input
                  label="Delivery Address"
                  placeholder="Street address, apartment, locality..."
                  value={convertForm.deliveryAddress}
                  onChange={(e) => setConvertForm({ ...convertForm, deliveryAddress: e.target.value })}
                  required
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-white border border-owner-border/70 text-xs text-owner-muted flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-brand-plum shrink-0" />
                  <span>Client will collect cake directly from your registered bakery store counter.</span>
                </div>
              )}
            </div>

            {/* 3. Payment Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-owner-heading block">Payment Status & Method</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConvertForm({ ...convertForm, paymentMethod: 'COD' })}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    convertForm.paymentMethod === 'COD'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-owner-muted border-owner-border hover:bg-brand-cream/50'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>COD (Unpaid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConvertForm({ ...convertForm, paymentMethod: 'ADVANCE_PAID' })}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    convertForm.paymentMethod === 'ADVANCE_PAID'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-owner-muted border-owner-border hover:bg-brand-cream/50'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Advance / Paid</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConvertForm({ ...convertForm, paymentMethod: 'ONLINE_PAYMENT' })}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    convertForm.paymentMethod === 'ONLINE_PAYMENT'
                      ? 'bg-brand-plum text-white border-brand-plum'
                      : 'bg-white text-owner-muted border-owner-border hover:bg-brand-cream/50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Online / UPI</span>
                </button>
              </div>
            </div>

            {/* 4. Kitchen / Baker Instructions (KOT) */}
            <Textarea
              label="Kitchen Order Ticket (KOT) Notes"
              rows={2}
              placeholder="Special instructions for the baker or decorator (e.g., Happy 21st Birthday lettering, fondant roses, double chocolate ganache)..."
              value={convertForm.notes}
              onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
            />

            {/* Financial Summary & Confirmation */}
            <div className="p-3.5 rounded-2xl bg-brand-cream/80 border border-owner-border flex items-center justify-between">
              <div>
                <p className="text-[11px] text-owner-muted uppercase font-bold tracking-wider">Total Order Amount</p>
                <p className="text-xl font-bold font-serif text-brand-plum">
                  ₹
                  {(
                    (parseFloat(convertForm.agreedPrice || '0') || 0) +
                    (parseFloat(convertForm.deliveryCharge || '0') || 0)
                  ).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sets Status: CONFIRMED</span>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isConverting}
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isConverting}
                className="bg-brand-plum hover:bg-brand-plum/90 text-white font-semibold"
              >
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                Confirm & Convert to Order
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
