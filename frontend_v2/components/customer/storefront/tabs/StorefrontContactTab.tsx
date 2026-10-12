'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { Shop } from '@/types/shop';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { storefrontApi } from '@/lib/api/storefront';
import { SocialIcon } from '@/components/common/SocialIcon';

interface StorefrontContactTabProps {
  shop: Shop;
}

export const StorefrontContactTab: React.FC<StorefrontContactTabProps> = ({ shop }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [enquiryType, setEnquiryType] = useState('GENERAL_INQUIRY');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const settings = shop.storefrontSettings;
  const isPrivacyEnabled = !!settings?.hideStreetAddress;
  const whatsappEnabled = settings ? settings.whatsappEnabled !== false : true;
  const phoneEnabled = settings ? settings.phoneEnabled !== false : true;
  const emailEnabled = settings ? settings.emailEnabled !== false : true;
  const addressEnabled = settings ? settings.addressEnabled !== false : true;
  const mapEnabled = settings ? settings.mapEnabled !== false : true;
  const businessHoursEnabled = settings ? settings.businessHoursEnabled !== false : true;

  const rawPhone = shop.whatsappNumber || shop.phone || shop.businessPhone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const displayPhone = shop.phone || shop.businessPhone || '';
  const displayEmail = shop.businessEmail || shop.email || '';

  const addressParts = isPrivacyEnabled
    ? [shop.area, shop.city, shop.district, shop.state].filter(Boolean)
    : [
        shop.addressLine1 || shop.address,
        shop.area,
        shop.city,
        shop.district,
        shop.state,
      ].filter(Boolean);

  const fullAddress =
    addressParts.length > 0
      ? `${addressParts.join(', ')}${shop.pincode ? ` - ${shop.pincode}` : ''}`
      : `${shop.city || ''}${shop.city && shop.state ? ', ' : ''}${shop.state || ''}`;

  const activeSocialLinks = (shop.socialLinks || []).filter(
    (l) => l.isActive !== false && l.url && l.url.trim().length > 0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await storefrontApi.submitEnquiry(shop.id, {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerMobile: customerMobile.trim() || undefined,
        enquiryType,
        message: message.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit enquiry. Please try again or contact via WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const dayNameMap: Record<string, string> = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
  };

  const sortedBusinessHours = shop.businessHours && shop.businessHours.length > 0
    ? [...shop.businessHours].sort((a, b) => {
        const aIdx = daysOrder.indexOf(a.dayOfWeek?.toUpperCase());
        const bIdx = daysOrder.indexOf(b.dayOfWeek?.toUpperCase());
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      })
    : [];

  return (
    <div className="space-y-10 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>We are here to assist</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-brand-espresso">
          Get in Touch with <span className="text-brand-plum italic">{shop.businessName}</span>
        </h1>
        <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto leading-relaxed">
          Have a question about custom cakes, flavor customizations, dietary options, or delivery schedule? Reach out directly.
        </p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {whatsappEnabled && cleanPhone && (
          <Card className="p-6 flex flex-col justify-between space-y-4 hover:border-brand-plum/40 transition-colors">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#25D366]/15 flex items-center justify-center text-[#25D366]">
                <MessageCircle className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-espresso">WhatsApp Direct</h2>
                <p className="text-xs text-brand-muted mt-0.5">Instant chat with the chef &amp; team</p>
              </div>
            </div>
            <a
              href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=Hi%20${encodeURIComponent(shop.businessName)},%20I%20have%20an%20enquiry.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:bg-[#20bd5a] transition-all shadow-xs"
            >
              <span>Chat on WhatsApp</span>
            </a>
          </Card>
        )}

        {phoneEnabled && displayPhone && (
          <Card className="p-6 flex flex-col justify-between space-y-4 hover:border-brand-plum/40 transition-colors">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-brand-blush flex items-center justify-center text-brand-plum">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-espresso">Phone Consultation</h2>
                <p className="text-xs text-brand-muted mt-0.5">Direct bakery helpline</p>
              </div>
            </div>
            <a
              href={`tel:${displayPhone}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-plum text-white text-xs font-bold hover:bg-brand-plum-hover transition-all shadow-xs"
            >
              <span>Call {displayPhone}</span>
            </a>
          </Card>
        )}

        {emailEnabled && displayEmail && (
          <Card className="p-6 flex flex-col justify-between space-y-4 hover:border-brand-plum/40 transition-colors">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-espresso">Email Desk</h2>
                <p className="text-xs text-brand-muted mt-0.5 line-clamp-1">{displayEmail}</p>
              </div>
            </div>
            <a
              href={`mailto:${displayEmail}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-cream border border-brand-border text-brand-espresso text-xs font-semibold hover:bg-brand-border/40 transition-all"
            >
              <span>Send Email</span>
            </a>
          </Card>
        )}

        {addressEnabled && fullAddress && (
          <Card className="p-6 flex flex-col justify-between space-y-4 hover:border-brand-plum/40 transition-colors sm:col-span-2 lg:col-span-1">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-espresso">
                  {isPrivacyEnabled ? 'Kitchen Locality / Pickup Area' : 'Kitchen Address'}
                </h2>
                <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">{fullAddress}</p>
              </div>
            </div>
            {mapEnabled ? (
              <a
                href={
                  isPrivacyEnabled
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [shop.area, shop.city, shop.state].filter(Boolean).join(', ')
                      )}`
                    : (shop.mapLocationUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          shop.businessName + ' ' + fullAddress
                        )}`)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-cream border border-brand-border text-brand-espresso text-xs font-semibold hover:bg-brand-border/40 transition-all"
              >
                <span>Open in Google Maps</span>
              </a>
            ) : (
              <span className="text-xs text-brand-muted">Pickup &amp; Delivery Location</span>
            )}
          </Card>
        )}
      </div>

      {/* Social Media & External Links */}
      {activeSocialLinks.length > 0 && (
        <Card className="p-6 border border-brand-border/80 shadow-soft max-w-2xl mx-auto text-center space-y-4">
          <div>
            <h2 className="text-sm font-serif font-bold text-brand-espresso">
              Connect With Us Online
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Follow our official social profiles, videos, and portfolio channels.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {activeSocialLinks.map((link) => (
              <a
                key={link.id || link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-cream border border-brand-border text-brand-espresso hover:text-brand-plum hover:border-brand-plum/40 hover:bg-brand-blush/30 transition-all text-xs font-semibold shadow-xs"
              >
                <SocialIcon platform={link.platform} className="w-4 h-4 text-brand-plum shrink-0" />
                <span>{link.title || link.displayName || link.platform}</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Business Operating Hours Section */}
      {businessHoursEnabled && sortedBusinessHours.length > 0 && (
        <Card className="p-6 sm:p-8 border border-brand-border/80 shadow-soft max-w-2xl mx-auto">
          <div className="flex items-center gap-3 pb-4 border-b border-brand-border/60">
            <div className="w-10 h-10 rounded-xl bg-brand-blush flex items-center justify-center text-brand-plum">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-brand-espresso">Weekly Business Hours</h2>
              <p className="text-xs text-brand-muted mt-0.5">Kitchen preparation &amp; dispatch schedule</p>
            </div>
          </div>
          <div className="divide-y divide-brand-border/40 text-xs mt-3">
            {sortedBusinessHours.map((bh, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-brand-espresso">
                  {dayNameMap[bh.dayOfWeek?.toUpperCase()] || bh.dayOfWeek}
                </span>
                {bh.isOpen ? (
                  <span className="font-semibold text-brand-plum">
                    {bh.openTime} &ndash; {bh.closeTime}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-[11px]">
                    Closed
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Direct In-Store Enquiry Form */}
      <Card className="p-6 sm:p-10 border border-brand-border/80 shadow-soft max-w-2xl mx-auto">
        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-serif font-bold text-brand-espresso">Message Sent Successfully!</h2>
            <p className="text-xs text-brand-muted max-w-sm mx-auto">
              Thank you for reaching out. The team at {shop.businessName} will respond to your enquiry shortly.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuccess(false);
                  setMessage('');
                  setCustomerMobile('');
                }}
              >
                Send Another Message
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center pb-2 border-b border-brand-border/60">
              <h2 className="text-lg font-serif font-bold text-brand-espresso">
                Send a Message to the Kitchen
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                We typically respond within 2 to 4 hours
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Your Name"
                required
                placeholder="Rohit Verma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                label="Email Address"
                type="email"
                required
                placeholder="rohit@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <Input
              label="Phone / WhatsApp Number (Optional)"
              type="tel"
              placeholder="+91 98765 43210"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              helperText="Share your mobile number if you'd like the baker to follow up via WhatsApp or call"
            />

            <Select
              label="Enquiry Subject"
              value={enquiryType}
              onChange={(e) => setEnquiryType(e.target.value)}
              options={[
                { value: 'GENERAL_INQUIRY', label: 'General Question' },
                { value: 'BULK_ORDER', label: 'Bulk & Corporate Catering' },
                { value: 'DIETARY_QUESTION', label: 'Dietary & Allergy Inquiries' },
                { value: 'DELIVERY_QUERY', label: 'Delivery Timings & Slots' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />

            <Textarea
              label="Your Message"
              rows={4}
              required
              placeholder="Tell us how we can help with your cake order..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full font-bold shadow-sm"
            >
              <Send className="w-4 h-4 mr-2" />
              <span>{isSubmitting ? 'Sending Message...' : 'Send Message'}</span>
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
