import React from 'react';
import Link from 'next/link';
import { Cake, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-brand-border/80 mt-auto">
      {/* Upper Quality Guarantee Bar */}
      <div className="border-b border-brand-border/60 bg-brand-cream-light/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-blush flex items-center justify-center text-brand-plum shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-espresso">FSSAI Certified Kitchens</p>
              <p className="text-[11px] text-brand-muted">Food safety & hygiene compliance verified</p>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-plum shrink-0">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-espresso">Baked Fresh to Order</p>
              <p className="text-[11px] text-brand-muted">Small-batch artisanal baking on delivery day</p>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-blush flex items-center justify-center text-brand-plum shrink-0">
              <Heart className="w-5 h-5 fill-rose-500/20 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-espresso">Direct Baker Relationships</p>
              <p className="text-[11px] text-brand-muted">Support independent local cake creators</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-plum text-white flex items-center justify-center shadow-xs">
                <Cake className="w-5 h-5" />
              </div>
              <span className="font-serif text-xl font-bold text-brand-espresso">CakeStore</span>
            </div>
            <p className="text-xs text-brand-muted max-w-sm leading-relaxed">
              The premier marketplace connecting dessert lovers with certified independent home bakers and boutique cake studios across India.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Food Safety Standards</span>
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-xs font-bold text-brand-espresso uppercase tracking-wider mb-3">
              Explore Bakeries
            </h4>
            <ul className="space-y-2 text-xs text-brand-muted">
              <li>
                <Link href="/explore" className="hover:text-brand-plum transition-colors">All Indian Bakeries</Link>
              </li>
              <li>
                <Link href="/explore?businessType=HOME_BAKERY" className="hover:text-brand-plum transition-colors">Artisan Home Bakers</Link>
              </li>
              <li>
                <Link href="/explore?businessType=CAKE_STUDIO" className="hover:text-brand-plum transition-colors">Custom Cake Studios</Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-brand-plum transition-colors">How Ordering Works</Link>
              </li>
            </ul>
          </div>

          {/* For Bakers */}
          <div>
            <h4 className="text-xs font-bold text-brand-espresso uppercase tracking-wider mb-3">
              For Bakery Owners
            </h4>
            <ul className="space-y-2 text-xs text-brand-muted">
              <li>
                <Link href="/for-owners" className="hover:text-brand-plum transition-colors">Why CakeStore?</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-brand-plum transition-colors">Simple Pricing & 0% Fees</Link>
              </li>
              <li>
                <Link href="/onboarding" className="hover:text-brand-plum transition-colors">Register Your Bakery</Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-brand-plum transition-colors">Owner Portal Sign In</Link>
              </li>
            </ul>
          </div>

          {/* Platform & Support */}
          <div>
            <h4 className="text-xs font-bold text-brand-espresso uppercase tracking-wider mb-3">
              Help & Support
            </h4>
            <ul className="space-y-2 text-xs text-brand-muted">
              <li>
                <Link href="/contact" className="hover:text-brand-plum transition-colors">Contact Support Team</Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-brand-plum transition-colors">Customer FAQs</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-brand-plum transition-colors">Subscription FAQ</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-plum transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-brand-plum transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-brand-plum transition-colors">Refund Policy</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-brand-border/60 flex flex-col md:flex-row items-center justify-between text-xs text-brand-muted gap-4">
          <p>© 2026 CakeStore SaaS Platform. All rights reserved. Made for Indian cake lovers.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-brand-plum transition-colors">Terms of Service</Link>
            <span className="text-brand-border" aria-hidden="true">•</span>
            <Link href="/privacy" className="hover:text-brand-plum transition-colors">Privacy Policy</Link>
            <span className="text-brand-border" aria-hidden="true">•</span>
            <Link href="/refund-policy" className="hover:text-brand-plum transition-colors">Refund Policy</Link>
          </div>
          <p className="flex items-center gap-1.5 font-medium">
            <span>Crafted for artisanal celebration bakers with</span>
            <Heart className="w-3.5 h-3.5 text-brand-crimson fill-brand-crimson" />
          </p>
        </div>
      </div>
    </footer>
  );
};

