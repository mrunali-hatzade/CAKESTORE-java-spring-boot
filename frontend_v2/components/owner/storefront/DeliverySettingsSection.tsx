import React, { useState } from 'react';
import { Truck, MapPin, AlertCircle, Compass } from 'lucide-react';
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
  const [pincodeError, setPincodeError] = useState<string | null>(null);

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

  const handleRadiusChange = (val: string) => {
    const num = val === '' ? null : Math.max(0.1, Math.min(100, Number(val) || 0));
    onChange({
      ...config,
      maxDeliveryRadiusKm: num,
    });
  };

  const handlePincodesChange = (val: string) => {
    onChange({
      ...config,
      serviceablePincodes: val,
    });

    // Validate tokens in real time
    if (!val || !val.trim()) {
      setPincodeError(null);
      return;
    }
    const tokens = val.split(/[,;\s\n]+/).map((t) => t.trim()).filter(Boolean);
    const invalidToken = tokens.find((t) => !/^[1-9][0-9]{5}$/.test(t));
    if (invalidToken) {
      setPincodeError(`"${invalidToken}" is not a valid 6-digit Indian PIN code.`);
    } else {
      setPincodeError(null);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-brand-border/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base text-owner-heading">Delivery Fee &amp; Zones</h2>
            <p className="text-[11px] text-owner-muted">
              Configure home delivery availability, operational service radius, and fee calculation.
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

      <div className={`space-y-4 pt-1 ${!deliveryEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Service Area Geofencing Section */}
        <div className="p-4 rounded-2xl bg-brand-blush/20 border border-brand-plum/20 space-y-3">
          <div className="flex items-center gap-2 text-brand-plum">
            <Compass className="w-4 h-4" />
            <h3 className="font-bold text-xs uppercase tracking-wider">Delivery Zone Geofencing</h3>
          </div>
          <p className="text-[11px] text-owner-muted">
            Restrict doorstep delivery to customers within your operational range. Customers outside this area can still choose Store Pickup.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <Input
                label="Maximum Delivery Radius (km)"
                type="number"
                min="0.1"
                max="100"
                step="0.5"
                placeholder="e.g. 10 (Leave blank for unrestricted)"
                value={config.maxDeliveryRadiusKm ?? ''}
                onChange={(e) => handleRadiusChange(e.target.value)}
                helperText="Maximum aerial distance covered from your bakery. Orders beyond this radius cannot choose home delivery."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-owner-heading block">
                Serviceable PIN Codes <span className="text-[11px] text-owner-muted font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 411035, 411033, 411019"
                value={config.serviceablePincodes || ''}
                onChange={(e) => handlePincodesChange(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-white rounded-xl border text-owner-heading text-xs placeholder:text-owner-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 transition-all ${
                  pincodeError ? 'border-red-500 focus:border-red-500' : 'border-brand-border focus:border-brand-plum'
                }`}
              />
              {pincodeError ? (
                <p className="text-[10px] text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{pincodeError}</span>
                </p>
              ) : (
                <p className="text-[10px] text-owner-muted">
                  Comma-separated list of 6-digit PIN codes. Leave empty to deliver to all PIN codes within your radius.
                </p>
              )}
            </div>
          </div>
        </div>

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
              <span className="text-xs text-owner-muted">All eligible orders receive complimentary free delivery.</span>
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
              helperText="Applied to all eligible delivery orders."
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
