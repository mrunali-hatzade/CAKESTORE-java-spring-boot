import React from 'react';
import { Eye } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ShopStorefrontSettings } from '@/types/storefrontManagement';

interface StorefrontVisibilitySectionProps {
  settings: ShopStorefrontSettings;
  onChange: (settings: ShopStorefrontSettings) => void;
}

interface VisibilityToggleOption {
  key: keyof ShopStorefrontSettings;
  label: string;
  description: string;
  page: 'Home' | 'Shop' | 'About' | 'Contact';
}

const TOGGLE_OPTIONS: VisibilityToggleOption[] = [
  // Home Page
  { key: 'heroBannerEnabled', label: 'Hero Banners Carousel', description: 'Show promotional slides on the home page.', page: 'Home' },
  { key: 'topRatedEnabled', label: 'Top Rated Cakes Showcase', description: 'Show the highest rated products on the storefront.', page: 'Home' },
  { key: 'reviewsEnabled', label: 'Customer Reviews Section', description: 'Display published buyer testimonials on the home page.', page: 'Home' },

  // Shop Catalog Page
  { key: 'categoriesEnabled', label: 'Category Tabs', description: 'Show category tabs (All, Cakes, Cupcakes, etc.) in catalog.', page: 'Shop' },
  { key: 'filtersEnabled', label: 'Search & Filters Bar', description: 'Allow customers to search, sort, and filter by egg preference.', page: 'Shop' },
  { key: 'ratingsEnabled', label: 'Star Ratings & Counts', description: 'Display star ratings on product cards and detail pages.', page: 'Shop' },

  // About Bakery Page
  { key: 'aboutStoryEnabled', label: 'Bakery Story & Bio', description: 'Show your bakery origin story and bio on the About page.', page: 'About' },
  { key: 'aboutImageEnabled', label: 'Bakery Story Image', description: 'Display your kitchen / bakery photo on the About page.', page: 'About' },
  { key: 'fulfillmentEnabled', label: 'Fulfillment & Notice Box', description: 'Show lead time notice banner on About and Home pages.', page: 'About' },

  // Contact Page & Footer
  { key: 'whatsappEnabled', label: 'WhatsApp Order Button', description: 'Allow customers to chat and inquire on WhatsApp.', page: 'Contact' },
  { key: 'phoneEnabled', label: 'Phone Number', description: 'Display your call phone number on contact sections.', page: 'Contact' },
  { key: 'emailEnabled', label: 'Support Email', description: 'Display your official email address.', page: 'Contact' },
  { key: 'addressEnabled', label: 'Physical Bakery Address', description: 'Show pickup/store address on contact section.', page: 'Contact' },
  { key: 'mapEnabled', label: 'Google Maps Link', description: 'Display Get Directions button opening Google Maps.', page: 'Contact' },
  { key: 'businessHoursEnabled', label: 'Business Hours Schedule', description: 'Display the 7-day schedule on the contact page.', page: 'Contact' },
  { key: 'hideStreetAddress', label: 'Hide Street Address (Home-Baker Privacy)', description: 'Display only City/Locality while keeping street address private.', page: 'Contact' },
];


export const StorefrontVisibilitySection: React.FC<StorefrontVisibilitySectionProps> = ({
  settings,
  onChange,
}) => {
  const handleToggle = (key: keyof ShopStorefrontSettings) => {
    onChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  const pages: Array<'Home' | 'Shop' | 'About' | 'Contact'> = ['Home', 'Shop', 'About', 'Contact'];

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-serif font-bold text-base text-owner-heading">What Customers See</h2>
          <p className="text-[11px] text-owner-muted">
            Toggle visibility of sections across your public storefront pages.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {pages.map((pageName) => {
          const pageOptions = TOGGLE_OPTIONS.filter((opt) => opt.page === pageName);
          return (
            <div key={pageName} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-owner-muted border-b border-brand-border/40 pb-1.5">
                {pageName} Page Sections
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pageOptions.map((opt) => {
                  const isChecked = Boolean(settings[opt.key]);
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-brand-border/80 bg-brand-cream-light/40'
                          : 'border-brand-border/40 bg-white opacity-60 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(opt.key)}
                        className="mt-1 w-4 h-4 text-brand-plum rounded border-brand-border focus:ring-brand-plum"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-owner-heading block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-owner-muted leading-relaxed">
                          {opt.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
