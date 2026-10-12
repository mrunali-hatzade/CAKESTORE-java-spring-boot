import React from 'react';
import { Phone, MessageCircle, Mail, MapPin, Navigation } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface ContactInfoSectionProps {
  whatsappNumber: string;
  onWhatsappNumberChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  mapLocationUrl: string;
  onMapLocationUrlChange: (v: string) => void;
  hideStreetAddress?: boolean;
  onHideStreetAddressChange?: (v: boolean) => void;
}

export const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  whatsappNumber,
  onWhatsappNumberChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  address,
  onAddressChange,
  mapLocationUrl,
  onMapLocationUrlChange,
  hideStreetAddress,
  onHideStreetAddressChange,
}) => {

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="font-serif font-bold text-base text-owner-heading">Contact & Location Details</h2>
        <p className="text-[11px] text-owner-muted">
          Your direct communication channels for customer cake queries, pickup directions, and order updates.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-espresso flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp Number</span>
          </label>
          <Input
            placeholder="+91 98765 43210"
            value={whatsappNumber}
            onChange={(e) => onWhatsappNumberChange(e.target.value)}
            helperText="Direct WhatsApp chat link will appear on storefront."
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-espresso flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-brand-plum" />
            <span>Calling Phone Number</span>
          </label>
          <Input
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-espresso flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-brand-plum" />
            <span>Customer Support Email</span>
          </label>
          <Input
            type="email"
            placeholder="orders@bakery.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-brand-espresso flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span>Google Maps / Directions Link</span>
          </label>
          <Input
            placeholder="https://maps.google.com/?q=..."
            value={mapLocationUrl}
            onChange={(e) => onMapLocationUrlChange(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-semibold text-brand-espresso flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-plum" />
            <span>Bakery Kitchen / Pickup Address</span>
          </label>
          <Input
            placeholder="e.g. Shop 4, Ground Floor, Sector 27, Pradhikaran, Akurdi, Pune - 411044"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 pt-2 border-t border-brand-border/40">
          <label className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
            hideStreetAddress
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-brand-border/60 bg-brand-cream-light/30 hover:border-brand-border'
          }`}>
            <input
              type="checkbox"
              checked={Boolean(hideStreetAddress)}
              onChange={(e) => onHideStreetAddressChange && onHideStreetAddressChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-brand-plum rounded border-brand-border focus:ring-brand-plum"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-owner-heading">
                  Hide Street Address on Public Storefront (Home-Baker Privacy)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Recommended for Home Bakers
                </span>
              </div>
              <p className="text-[11px] text-owner-muted leading-relaxed">
                When enabled, your exact residential street/flat number and Google Maps coordinate pin are kept strictly private. Public pages and invoices will only display your locality, city, and pincode so customers can verify serviceability without discovering your home residence.
              </p>
            </div>
          </label>
        </div>
      </div>
    </Card>
  );
};

