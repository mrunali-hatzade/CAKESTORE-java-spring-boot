import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText, ShieldAlert, Scale, Store, ShoppingBag,
  CreditCard, AlertTriangle, CheckCircle2, HelpCircle,
  ArrowRight, Clock, Sparkles, Mail,
} from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Terms of Service — CakeStore Platform',
  description: 'Terms and conditions governing the use of the CakeStore artisanal bakery SaaS platform for customers and bakery partners.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service — CakeStore Platform',
    description:
      'Terms and conditions governing the use of the CakeStore artisanal bakery SaaS platform.',
    url: '/terms',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — CakeStore Platform',
    description:
      'Terms and conditions governing the use of the CakeStore artisanal bakery SaaS platform.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function TermsOfServicePage() {
  const sections = [
    { id: 'platform-scope', title: '1. Platform Scope & Intermediary Role' },
    { id: 'accounts', title: '2. User Accounts & Verification' },
    { id: 'baker-responsibilities', title: '3. Bakery Partner Responsibilities' },
    { id: 'customer-orders', title: '4. Ordering, Customizations & Delivery' },
    { id: 'allergens', title: '5. Allergens & Dietary Information' },
    { id: 'payments', title: '6. Pricing, Platform Fees & Payments' },
    { id: 'cancellations', title: '7. Cancellations & Policy Reference' },
    { id: 'service-limitations', title: '8. Service Availability & Limitations' },
    { id: 'intellectual-property', title: '9. Intellectual Property & Photos' },
    { id: 'liability', title: '10. Limitation of Liability' },
    { id: 'governing-law', title: '11. Governing Law & Dispute Resolution' },
    { id: 'draft-notice', title: '12. Legal Draft Notice & Inquiries' },
  ];

  return (
    <div className="min-h-screen bg-brand-cream-light font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header / Hero */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
            <Scale className="w-3.5 h-3.5" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif text-brand-espresso tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm sm:text-base text-brand-muted leading-relaxed">
            Please read these terms carefully before accessing or using the CakeStore marketplace and storefront platform.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-brand-muted pt-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-plum" />
              Effective Date: October 2026
            </span>
            <span>•</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
              Operational Draft for Legal Review
            </span>
          </div>
        </div>

        {/* Legal Counsel Draft Notice */}
        <div className="mb-8 rounded-2xl bg-amber-50/80 border border-amber-200/90 p-4 sm:p-5 text-amber-900 text-xs sm:text-sm leading-relaxed flex items-start gap-3.5 shadow-subtle">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">Important Notice — Draft Document</p>
            <p className="text-amber-900/90">
              This document reflects the operational and technical rules of the CakeStore platform. It is published for platform preview and customer transparency. This text is subject to formal review and endorsement by qualified legal counsel prior to formal statutory enforcement. CakeStore does not represent that this draft alone constitutes certified statutory compliance.
            </p>
          </div>
        </div>

        {/* Quick Jump Index */}
        <Card className="p-5 sm:p-6 mb-8 bg-white/90">
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand-espresso mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-plum" />
            <span>Table of Contents</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="text-brand-muted hover:text-brand-plum hover:underline transition-colors py-1 flex items-center gap-1.5"
              >
                <span className="text-brand-plum/70 font-semibold">•</span>
                <span>{sec.title}</span>
              </a>
            ))}
          </div>
        </Card>

        {/* Main Content Card */}
        <Card className="p-6 sm:p-10 space-y-10 bg-white">
          {/* Section 1 */}
          <section id="platform-scope" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Store className="w-4 h-4" />
              <span>Section 1</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              1. Platform Scope & Intermediary Role
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                CakeStore operates a software-as-a-service (SaaS) and digital marketplace platform designed to connect consumers (&ldquo;Customers&rdquo;) with certified independent home bakers and boutique cake studios (&ldquo;Bakery Partners&rdquo; or &ldquo;Merchants&rdquo;) across India.
              </p>
              <p>
                <strong>Intermediary Status:</strong> CakeStore provides discovery tools, online storefront hosting, digital order routing, payment checkout integration via Razorpay, and communication notifications. CakeStore is <em>not</em> a bakery, restaurant, food preparation facility, or logistics provider. All baked goods, confectionery products, packaging, and deliveries or pickups are prepared and provided directly by independent Bakery Partners.
              </p>
              <p>
                When a Customer places an order through a CakeStore-hosted storefront or marketplace page, the contractual agreement for the purchase, preparation, and delivery of food products is directly between the Customer and the fulfilling Bakery Partner.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="accounts" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Sparkles className="w-4 h-4" />
              <span>Section 2</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              2. User Accounts & Verification
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                <strong>Customer Access & Guest Checkout:</strong> Customers may place orders as registered users or through guest checkout. To ensure order integrity and delivery notification, customer verification is performed using a 6-digit one-time password (OTP) sent to the customer&apos;s mobile number or email.
              </p>
              <p>
                <strong>Bakery Owner Accounts:</strong> Bakery owners must register with accurate, up-to-date business details, including bakery name, operating address, business classification (Home Baker or Custom Cake Studio), and valid contact credentials.
              </p>
              <p>
                <strong>Account Security:</strong> You are responsible for safeguarding your login credentials, session access tokens, and verification codes. You agree to notify CakeStore immediately of any unauthorized access to your account.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="baker-responsibilities" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Store className="w-4 h-4" />
              <span>Section 3</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              3. Bakery Partner Responsibilities
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>Each Bakery Partner operating on CakeStore represents and covenants that:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  It maintains all applicable statutory licenses, sanitary clearances, and food hygiene registrations (such as FSSAI registration or license in India) required for operating a food business.
                </li>
                <li>
                  All menu items, pricing, flavor options, eggless designations, and preparation lead times listed on its digital storefront are truthful and accurately maintained.
                </li>
                <li>
                  Orders accepted through the platform will be baked fresh to order and fulfilled within the agreed delivery date and delivery time slot.
                </li>
                <li>
                  It is solely responsible for kitchen hygiene, ingredient quality, proper food packaging, temperature control, and physical delivery or collection handover.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="customer-orders" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <ShoppingBag className="w-4 h-4" />
              <span>Section 4</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              4. Ordering, Customizations & Delivery
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                <strong>Order Specifications:</strong> Customers select cake flavor, weight, eggless preferences, customized icing inscriptions, and optional reference photos. Handcrafted cakes are artisanal products; minor variations in design, color shading, and decorative piping are inherent in custom baking.
              </p>
              <p>
                <strong>Delivery Coordinates & Timelines:</strong> Customers must supply a complete, accurate physical delivery address, working recipient mobile number, and specific delivery instructions. CakeStore and the Bakery Partner are not responsible for non-delivery or delivery delays resulting from incorrect address information or an unreachable recipient during the selected delivery slot.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="allergens" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Section 5</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              5. Allergens & Dietary Information
            </h2>
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs sm:text-sm space-y-2 leading-relaxed">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                Critical Food Allergy Notice
              </p>
              <p>
                Cakes and confectionery items prepared by independent kitchens may contain or come into contact with common allergens, including dairy, eggs, nuts, peanuts, wheat/gluten, and soy.
              </p>
              <p>
                While customers may select &ldquo;Eggless&rdquo; preferences, CakeStore cannot guarantee an allergen-free preparation environment. Customers with severe food allergies must contact the fulfilling bakery directly prior to placing an order. CakeStore disclaims all liability for allergic reactions arising from consumption of items prepared by Bakery Partners.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="payments" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <CreditCard className="w-4 h-4" />
              <span>Section 6</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              6. Pricing, Platform Fees & Payments
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                <strong>Currency & Pricing:</strong> All prices displayed on the platform are in Indian Rupees (INR). Item prices are established directly by Bakery Partners. Delivery charges and applicable taxes are itemized during checkout before payment.
              </p>
              <p>
                <strong>Payment Processing:</strong> Online payments are facilitated securely through authorized payment gateway partners, primarily Razorpay. CakeStore does not collect or store raw credit/debit card numbers, CVVs, or UPI PINs on its servers.
              </p>
              <p>
                <strong>Merchant Platform Plans:</strong> Bakery owner subscriptions to CakeStore SaaS tiers are billed periodically (monthly or yearly) in accordance with the selected plan.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="cancellations" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Clock className="w-4 h-4" />
              <span>Section 7</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              7. Cancellations & Policy Reference
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                <strong>In-Flight Checkout Cancellation:</strong> Unpaid orders may be cancelled at checkout prior to payment authorization. The platform releases the reserved delivery slot and restores applied promotional coupons.
              </p>
              <p>
                <strong>Confirmed Orders & Perishable Nature:</strong> Because celebration cakes are perishable, custom-baked food items, automated self-service cancellation is disabled once payment is confirmed. All cancellation and refund inquiries are governed strictly by our dedicated{' '}
                <Link href="/refund-policy" className="text-brand-plum font-semibold underline hover:text-brand-plum-hover">
                  Refund & Cancellation Policy
                </Link>.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section id="service-limitations" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <HelpCircle className="w-4 h-4" />
              <span>Section 8</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              8. Service Availability & Limitations
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                CakeStore strives to ensure platform accessibility and reliable system uptime. However, services are provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. CakeStore does not warrant that software operations will be uninterrupted, error-free, or completely free of latency.
              </p>
              <p>
                Scheduled maintenance, telecom carrier delays, third-party SMS or email delivery latency, or payment gateway outages are beyond CakeStore&apos;s direct operational control.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="intellectual-property" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Sparkles className="w-4 h-4" />
              <span>Section 9</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              9. Intellectual Property & User Content
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                The CakeStore software platform, logos, UI designs, code, and documentation are proprietary assets protected by copyright and applicable intellectual property laws.
              </p>
              <p>
                Bakery owners and customers retain ownership of images, brand assets, and reference photos uploaded to the platform. By uploading content, you grant CakeStore a non-exclusive license to store, process, and display such content solely for the purpose of operating the marketplace, rendering storefronts, and fulfilling orders.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section id="liability" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <ShieldAlert className="w-4 h-4" />
              <span>Section 10</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              10. Limitation of Liability
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                To the fullest extent permitted by applicable Indian law, CakeStore, its founders, and affiliates shall not be liable for any indirect, punitive, incidental, special, or consequential damages, loss of business, food spoilage, allergic distress, or delivery disputes arising out of the performance of independent Bakery Partners.
              </p>
              <p>
                CakeStore&apos;s aggregate liability for any direct claim arising out of software platform services shall be capped at the platform software fee retained by CakeStore for the specific transaction in dispute.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section id="governing-law" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Scale className="w-4 h-4" />
              <span>Section 11</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              11. Governing Law & Dispute Resolution
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                These Terms of Service and any dispute or claim arising out of or related to your use of CakeStore shall be governed by and construed in accordance with the laws of the Republic of India.
              </p>
              <p>
                In the event of any grievance or dispute, the parties agree to first attempt informal resolution by submitting details to{' '}
                <a href="mailto:support@cakestore.in" className="text-brand-plum font-semibold underline">
                  support@cakestore.in
                </a>. If informal resolution fails, any legal action shall be subject to the exclusive jurisdiction of the competent courts of India.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section id="draft-notice" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Mail className="w-4 h-4" />
              <span>Section 12</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              12. Legal Draft Notice & Inquiries
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                This document is an operational policy draft prepared for platform preview. Exact corporate entity registration numbers, formal physical corporate office addresses, and statutory compliance designations will be updated upon formal commercial incorporation.
              </p>
              <p>
                For questions regarding these Terms of Service, contact our support team at{' '}
                <a href="mailto:support@cakestore.in" className="text-brand-plum font-semibold underline">
                  support@cakestore.in
                </a>{' '}
                or visit our{' '}
                <Link href="/contact" className="text-brand-plum font-semibold underline">
                  Contact Support Page
                </Link>.
              </p>
            </div>
          </section>
        </Card>

        {/* Bottom Related Policy Links */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/privacy"
            className="p-5 rounded-2xl bg-white border border-brand-border/80 hover:border-brand-plum/40 hover:shadow-soft transition-all group flex items-center justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-brand-muted">Read Next</p>
              <p className="text-base font-bold font-serif text-brand-espresso group-hover:text-brand-plum transition-colors">
                Privacy Policy
              </p>
              <p className="text-xs text-brand-muted mt-0.5">How we collect, use, and protect your data</p>
            </div>
            <ArrowRight className="w-5 h-5 text-brand-muted group-hover:text-brand-plum group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/refund-policy"
            className="p-5 rounded-2xl bg-white border border-brand-border/80 hover:border-brand-plum/40 hover:shadow-soft transition-all group flex items-center justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-brand-muted">Read Next</p>
              <p className="text-base font-bold font-serif text-brand-espresso group-hover:text-brand-plum transition-colors">
                Refund & Cancellation Policy
              </p>
              <p className="text-xs text-brand-muted mt-0.5">Order cancellations, failed payments & refunds</p>
            </div>
            <ArrowRight className="w-5 h-5 text-brand-muted group-hover:text-brand-plum group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
