import React from 'react';
import { Truck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ShopDeliveryConfig } from '@/types/storefrontManagement';

interface DeliverySettingsSectionProps {
  config: ShopDeliveryConfig;
  onChange: (config: ShopDeliveryConfig) => void;
}

export const DeliverySettingsSection: React.FC<DeliverySettingsSectionProps> = ({
  config,
  onChange,
}) => {
  const isFree = config.deliveryChargeType === 'FREE';
  const deliveryEnabled = config.deliveryEnabled ?? true;

  const handleDeliveryEnabledToggle = (enabled: boolean) => {
    onChange({
      ...config,
      deliveryEnabled: enabled,
    });
  };

  const handleTypeChange = (type: 'FREE' | 'FIXED') => {
    onChange({
      ...config,
      deliveryChargeType: type,
    });
  };

  const handleFixedAmountChange = (val: string) => {
    const num = Math.max(0, Number(val) || 0);
    onChange({
      ...config,
      fixedChargeAmount: num,
    });
  };

  const handleMinThresholdChange = (val: string) => {
    const num = val === '' ? null : Math.max(0, Number(val) || 0);
    onChange({
      ...config,
      minOrderForFreeDelivery: num,
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-brand-border/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base text-owner-heading">Delivery Fee Settings</h2>
            <p className="text-[11px] text-owner-muted">
              Configure home delivery availability and fee calculation for checkout.
            </p>
          </div>
        </div>

        {/* Home Delivery Master Switch */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-owner-heading">
            {deliveryEnabled ? 'Delivery Enabled' : 'Delivery Disabled'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={deliveryEnabled}
            onClick={() => handleDeliveryEnabledToggle(!deliveryEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-plum focus:ring-offset-2 ${
              deliveryEnabled ? 'bg-brand-plum' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                deliveryEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {!deliveryEnabled && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <p className="font-semibold">Doorstep delivery is currently turned off.</p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            Customers will only be offered <strong>Self-Pickup</strong> at your bakery store counter.
          </p>
        </div>
      )}

      <div className={`space-y-3 pt-1 ${!deliveryEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Mode Radio Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
              isFree
                ? 'border-brand-plum bg-brand-blush/30'
                : 'border-brand-border/60 bg-white hover:border-brand-border'
            }`}
          >
            <input
              type="radio"
              name="deliveryType"
              checked={isFree}
              onChange={() => handleTypeChange('FREE')}
              className="mt-1 text-brand-plum focus:ring-brand-plum"
            />
            <div>
              <span className="text-sm font-bold text-owner-heading block">Free Delivery</span>
              <span className="text-xs text-owner-muted">All orders receive complimentary free delivery.</span>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
              !isFree
                ? 'border-brand-plum bg-brand-blush/30'
                : 'border-brand-border/60 bg-white hover:border-brand-border'
            }`}
          >
            <input
              type="radio"
              name="deliveryType"
              checked={!isFree}
              onChange={() => handleTypeChange('FIXED')}
              className="mt-1 text-brand-plum focus:ring-brand-plum"
            />
            <div>
              <span className="text-sm font-bold text-owner-heading block">Fixed Delivery Charge</span>
              <span className="text-xs text-owner-muted">Charge a flat fee, with optional free delivery above a threshold.</span>
            </div>
          </label>
        </div>

        {/* Fixed charge configuration inputs */}
        {!isFree && (
          <div className="p-4 rounded-2xl bg-brand-cream-light/60 border border-brand-border/60 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <Input
              label="Flat Delivery Charge"
              type="number"
              min="0"
              required
              placeholder="50"
              value={config.fixedChargeAmount || ''}
              onChange={(e) => handleFixedAmountChange(e.target.value)}
              helperText="Applied to all delivery orders."
            />

            <Input
              label="Free Delivery Threshold"
              type="number"
              min="0"
              placeholder="e.g. 1000 (Optional)"
              value={config.minOrderForFreeDelivery ?? ''}
              onChange={(e) => handleMinThresholdChange(e.target.value)}
              helperText="Orders at or above this value get free delivery."
            />
          </div>
        )}

        {/* Delivery & Packaging Notes */}
        <div className="space-y-1.5 pt-3 border-t border-brand-border/40">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-owner-heading block">
              Delivery &amp; Packaging Notes <span className="text-[11px] text-owner-muted font-normal">(Optional)</span>
            </label>
            <span className="text-[10px] text-owner-muted">
              {(config.deliveryNotes || '').length}/600
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={600}
            placeholder="e.g. Carefully packaged in shock-proof, double-walled cake boxes with secure bottom baseboards. Best enjoyed within 48 hours of delivery."
            value={config.deliveryNotes || ''}
            onChange={(e) =>
              onChange({
                ...config,
                deliveryNotes: e.target.value,
              })
            }
            className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-brand-border text-owner-heading text-xs placeholder:text-owner-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all resize-none"
          />
          <p className="text-[10px] text-owner-muted">
            Displayed to customers under the Delivery Information section on your product pages.
          </p>
        </div>
      </div>
    </Card>
  );
};
