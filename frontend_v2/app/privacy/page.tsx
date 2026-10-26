import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck, Lock, Eye, Server, MapPin,
  CreditCard, KeyRound, Clock, ArrowRight,
  HelpCircle, FileText, Mail, ShieldAlert,
  CheckCircle2, Store,
} from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Privacy Policy — CakeStore Platform',
  description: 'Understand what personal data CakeStore collects, how it is used for order fulfillment and authentication, and our data protection practices.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy — CakeStore Platform',
    description:
      'Understand what personal data CakeStore collects, how it is used for order fulfillment and authentication, and our data protection practices.',
    url: '/privacy',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — CakeStore Platform',
    description:
      'Understand what personal data CakeStore collects, how it is used for order fulfillment and authentication, and our data protection practices.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function PrivacyPolicyPage() {
  const sections = [
    { id: 'privacy-scope', title: '1. Privacy Overview & Scope' },
    { id: 'data-collected', title: '2. Information We Collect' },
    { id: 'data-use', title: '3. How We Use Personal Data' },
    { id: 'third-parties', title: '4. Third-Party Integrations' },
    { id: 'security', title: '5. Data Security & Storage' },
    { id: 'retention', title: '6. Retention & Account Management' },
    { id: 'cookies', title: '7. Cookies & Local Storage' },
    { id: 'user-rights', title: '8. Your Rights & Choices' },
    { id: 'draft-status', title: '9. Legal Draft Notice & Inquiries' },
  ];

  return (
    <div className="min-h-screen bg-brand-cream-light font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header / Hero */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Data Protection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif text-brand-espresso tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-brand-muted leading-relaxed">
            We value your trust. This Privacy Policy details what information we collect, how it is used to deliver your orders, and how we safeguard your personal data.
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
              This Privacy Policy reflects actual application data flows, verified backend models, and third-party integrations across the CakeStore platform. It is published for platform preview and transparency. Formal statutory privacy disclosures, data protection officer designations, and corporate entity registrations will be verified by qualified legal counsel prior to formal commercial launch.
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
          <section id="privacy-scope" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Eye className="w-4 h-4" />
              <span>Section 1</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              1. Privacy Overview & Scope
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                This Privacy Policy explains how CakeStore (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, processes, and protects personal information gathered through our customer storefronts, marketplace discovery directories, and bakery management interfaces.
              </p>
              <p>
                This policy applies to all visitors, registered customers, guest checkout users, and independent bakery partners accessing our platform across India.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="data-collected" className="space-y-4 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Server className="w-4 h-4" />
              <span>Section 2</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              2. Information We Collect
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>We collect only the information necessary to fulfill orders, authenticate users, and ensure platform security:</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-brand-cream-light/60 border border-brand-border/60 space-y-2">
                  <p className="font-bold text-brand-espresso text-xs uppercase tracking-wider">A. Customer Data</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    <li><strong>Contact:</strong> Full name, 10-digit mobile phone number, and email address.</li>
                    <li><strong>Delivery Address:</strong> Street address, landmark, city, district, state, and postal PIN code.</li>
                    <li><strong>Order Details:</strong> Chosen cake item, flavor, weight, eggless preference, custom tier message, and delivery slot.</li>
                    <li><strong>Design Uploads:</strong> Reference photos voluntarily uploaded for custom designs.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-brand-cream-light/60 border border-brand-border/60 space-y-2">
                  <p className="font-bold text-brand-espresso text-xs uppercase tracking-wider">B. Bakery Partner Data</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    <li><strong>Owner Profile:</strong> Full name, business email, and mobile phone number.</li>
                    <li><strong>Storefront Information:</strong> Bakery name, business type (Home Baker vs Cake Studio), bio, and logos.</li>
                    <li><strong>Kitchen Coordinates:</strong> Physical kitchen address and latitude/longitude coordinates (used for delivery radius filtering).</li>
                    <li><strong>Compliance:</strong> FSSAI registration details where submitted.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-xs sm:text-sm space-y-2 leading-relaxed">
                <p className="font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
                  Payment Information Handling
                </p>
                <p>
                  All payment transactions are processed directly by our secure payment gateway partner, <strong>Razorpay</strong>. CakeStore stores transaction reference tokens, payment status, and order totals. CakeStore <strong>never collects, processes, or stores</strong> sensitive credit/debit card numbers, CVVs, net banking credentials, or UPI PINs on its infrastructure.
                </p>
              </div>

              <div className="pt-2">
                <p className="font-semibold text-brand-espresso text-xs uppercase tracking-wider mb-1">
                  C. Security & Operational Logs
                </p>
                <p className="text-xs">
                  We log client IP addresses, browser user-agent strings, and request timestamps strictly for abuse mitigation, fraud detection, and enforcing rate limits (such as our 10 requests/minute OTP limit and 20 requests/minute contact form rate limit).
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="data-use" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <CheckCircle2 className="w-4 h-4" />
              <span>Section 3</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              3. How We Use Personal Data
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>We process your personal information for the following specific purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Order Execution & Routing:</strong> Relaying customer delivery details and order specifications to the fulfilling Bakery Partner.
                </li>
                <li>
                  <strong>Authentication & Session Security:</strong> Generating and validating 6-digit one-time passwords (OTP) to verify phone numbers for guest tracking and checkout access.
                </li>
                <li>
                  <strong>Transactional Communications:</strong> Dispatching real-time order receipts, status milestones (confirmed, baking, out for delivery), payment receipts, and OTP verification codes via email and SMS.
                </li>
                <li>
                  <strong>Location-Based Discovery:</strong> Utilizing customer-selected city, district, or geographic coordinates to display bakeries that service their delivery zone.
                </li>
                <li>
                  <strong>Platform Integrity & Abuse Prevention:</strong> Enforcing rate-limiting rules, preventing unauthorized cancellation of in-flight orders, and logging security events.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="third-parties" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <ShieldCheck className="w-4 h-4" />
              <span>Section 4</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              4. Third-Party Integrations & Data Sharing
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                We do not sell, rent, or trade your personal data with third-party advertisers or data brokers. Data is shared exclusively with service providers required for core platform functionality:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-white border border-brand-border/70 flex items-start gap-3">
                  <Store className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-brand-espresso">Fulfilling Bakery Partner:</span> Customer recipient name, mobile number, delivery address, custom message, and reference photo are provided directly to the bakery preparing your cake.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-brand-border/70 flex items-start gap-3">
                  <CreditCard className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-brand-espresso">Razorpay Payment Gateway:</span> Facilitates secure UPI, card, and net banking transactions under PCI-DSS compliance.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-brand-border/70 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-brand-espresso">Resend Email Service:</span> Transactional email infrastructure utilized for delivering order confirmations, receipts, and email OTP verification.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-brand-border/70 flex items-start gap-3">
                  <KeyRound className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-brand-espresso">Twilio SMS Service:</span> Mobile SMS infrastructure utilized for dispatching OTP verification codes and mobile alerts (where configured).
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-brand-border/70 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-brand-espresso">OpenStreetMap & Leaflet:</span> Map tile rendering for interactive location selection and bakery discovery.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="security" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Lock className="w-4 h-4" />
              <span>Section 5</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              5. Data Security & Storage Safeguards
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                We implement industry-standard technical safeguards to protect your personal information against unauthorized access, loss, or disclosure:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Cryptographic Hashing:</strong> One-time password (OTP) verification secrets are cryptographically hashed using BCrypt. Raw OTP codes are never logged or returned in public API payloads.
                </li>
                <li>
                  <strong>Short-Lived Expiration:</strong> Verification OTPs expire after 10 minutes and are strictly invalidated after 3 failed attempts or single-use verification.
                </li>
                <li>
                  <strong>Server-Side Authorization:</strong> Order management and cancellation endpoints enforce server-side identity verification, preventing cross-tenant access and unauthorized cancellation.
                </li>
                <li>
                  <strong>Encrypted Transmission:</strong> All web traffic and API calls are transmitted using TLS/HTTPS encryption.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="retention" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Clock className="w-4 h-4" />
              <span>Section 6</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              6. Retention & Account Management
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                We retain order histories, accounting records, and transaction logs for as long as necessary to fulfill contractual obligations, comply with tax and statutory accounting mandates, and resolve potential disputes.
              </p>
              <p>
                Transient authentication tokens and expired OTP records are periodically purged. If you wish to close your customer account or request data review, you may submit a request to{' '}
                <a href="mailto:support@cakestore.in" className="text-brand-plum font-semibold underline">
                  support@cakestore.in
                </a>.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="cookies" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Server className="w-4 h-4" />
              <span>Section 7</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              7. Cookies & Local Browser Storage
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                CakeStore utilizes minimal browser cookies and local storage strictly for essential platform functionality:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Shopping Cart Persistence:</strong> Remembering the bakery items in your active shopping bag across browser navigation.
                </li>
                <li>
                  <strong>Authentication State:</strong> Storing secure session access tokens to keep you logged into the owner portal or customer dashboard.
                </li>
                <li>
                  <strong>User Preferences:</strong> Storing favorite bakeries and selected location filters for streamlined browsing.
                </li>
              </ul>
              <p>We do not deploy third-party cross-site advertising trackers or sell browsing data.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section id="user-rights" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <HelpCircle className="w-4 h-4" />
              <span>Section 8</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              8. Your Rights & Choices
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                As a user, you have the right to access, correct, or request the deletion of your personal data held by CakeStore. You may also opt out of promotional communications at any time. Essential transactional notifications related to active orders (e.g., OTP codes, order status alerts) cannot be disabled as they are required for service fulfillment.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="draft-status" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Mail className="w-4 h-4" />
              <span>Section 9</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              9. Legal Draft Notice & Inquiries
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                This document is a technical privacy draft published for transparency. Formal legal entity names, corporate registration numbers, and statutory data officer designations will be finalized upon corporate incorporation.
              </p>
              <p>
                For questions regarding this Privacy Policy or to exercise your data rights, please contact us at{' '}
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
            href="/terms"
            className="p-5 rounded-2xl bg-white border border-brand-border/80 hover:border-brand-plum/40 hover:shadow-soft transition-all group flex items-center justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-brand-muted">Read Next</p>
              <p className="text-base font-bold font-serif text-brand-espresso group-hover:text-brand-plum transition-colors">
                Terms of Service
              </p>
              <p className="text-xs text-brand-muted mt-0.5">Platform terms and merchant responsibilities</p>
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
