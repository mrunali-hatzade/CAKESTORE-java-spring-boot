import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  RotateCcw, ShieldAlert, AlertTriangle, CheckCircle2,
  Clock, CreditCard, RefreshCw, HelpCircle,
  FileText, ArrowRight, Mail, Cake,
} from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — CakeStore Platform',
  description: 'Understand CakeStore policies on order cancellations, failed payments, delayed payment reconciliation, and manual refund procedures.',
  alternates: {
    canonical: '/refund-policy',
  },
  openGraph: {
    title: 'Refund & Cancellation Policy — CakeStore Platform',
    description:
      'Understand CakeStore policies on order cancellations, failed payments, delayed payment reconciliation, and manual refund procedures.',
    url: '/refund-policy',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Refund & Cancellation Policy — CakeStore Platform',
    description:
      'Understand CakeStore policies on order cancellations, failed payments, delayed payment reconciliation, and manual refund procedures.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function RefundPolicyPage() {
  const sections = [
    { id: 'perishable-nature', title: '1. Perishable & Handcrafted Goods' },
    { id: 'in-flight-cancellation', title: '2. In-Flight Checkout Cancellation' },
    { id: 'confirmed-cancellation', title: '3. Cancellation of Confirmed Orders' },
    { id: 'failed-payments', title: '4. Failed Payments & Banking Debits' },
    { id: 'late-payments', title: '5. Late Payments on Cancelled Orders' },
    { id: 'damaged-orders', title: '6. Damaged or Incorrect Deliveries' },
    { id: 'refund-methods', title: '7. Refund Process & Settlement Timelines' },
    { id: 'disputes-contact', title: '8. Dispute Resolution & Contact' },
    { id: 'draft-disclaimer', title: '9. Legal Draft Notice & Bakery Confirmation' },
  ];

  return (
    <div className="min-h-screen bg-brand-cream-light font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header / Hero */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Order & Payment Safety</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif text-brand-espresso tracking-tight">
            Refund & Cancellation Policy
          </h1>
          <p className="text-sm sm:text-base text-brand-muted leading-relaxed">
            Clear, transparent guidelines governing order cancellations, payment edge cases, and refund processing for artisanal bakery orders.
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
              This policy accurately reflects the technical capabilities and payment reconciliation procedures implemented in CakeStore. CakeStore does not promise automatic, instant, or unconditional refunds on perishable food orders. Specific merchant cancellation windows and policy nuances require final confirmation by bakery owners and legal counsel prior to formal launch.
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
          <section id="perishable-nature" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Cake className="w-4 h-4" />
              <span>Section 1</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              1. Perishable & Handcrafted Nature of Baked Goods
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                All celebration cakes, pastries, and artisanal desserts listed on CakeStore are perishable food items baked fresh to order by certified independent home bakers and boutique cake studios.
              </p>
              <p>
                Unlike shelf-stable retail products, once an order is placed and confirmed, the fulfilling bakery reserves perishable ingredients, schedules dedicated oven time, and allocates a specific kitchen delivery slot. As a result, cancellation and refund policies for custom bakery items are subject to specific operational limitations.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="in-flight-cancellation" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <CheckCircle2 className="w-4 h-4" />
              <span>Section 2</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              2. In-Flight Checkout Cancellation
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                If you change your mind during the checkout flow prior to successful payment completion, you can safely dismiss or cancel the checkout session.
              </p>
              <div className="p-4 rounded-xl bg-brand-cream-light/60 border border-brand-border/60 space-y-2 text-xs">
                <p className="font-bold text-brand-espresso">Automated Checkout Protections:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>No charge is processed against your card, UPI ID, or bank account.</li>
                  <li>The held delivery slot capacity is immediately released back to other customers.</li>
                  <li>Any promotional discount coupon applied to the checkout session is automatically restored.</li>
                  <li>The session is cryptographically secured to prevent unauthorized tampering.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="confirmed-cancellation" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Section 3</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              3. Cancellation of Confirmed & Paid Orders
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                Once payment is verified and your order transitions to <strong>CONFIRMED</strong>, automated customer self-service cancellation is disabled on the platform.
              </p>
              <p>
                If you require cancellation of a confirmed order, you must promptly contact the fulfilling bakery owner or contact CakeStore Support at{' '}
                <a href="mailto:support@cakestore.in" className="text-brand-plum font-semibold underline">
                  support@cakestore.in
                </a>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-xs space-y-1.5">
                  <p className="font-bold uppercase tracking-wider">Before Preparation Begins</p>
                  <p>
                    If the bakery has not yet purchased specialized ingredients or initiated baking preparations, the bakery may, at its reasonable discretion, approve the cancellation and authorize a refund.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-950 text-xs space-y-1.5">
                  <p className="font-bold uppercase tracking-wider">After Baking / Decorating Commences</p>
                  <p>
                    Once the baker has begun mixing, baking, tier assembly, or custom icing decorations, orders cannot be cancelled and refunds cannot be issued.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="failed-payments" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <CreditCard className="w-4 h-4" />
              <span>Section 4</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              4. Failed Payments & Bank Debits
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                In the event that an online payment fails, declines, or encounters a network timeout during checkout, no order is placed and the transaction is marked as failed.
              </p>
              <p>
                <strong>Bank Account Debited on Failed Attempt:</strong> If funds were deducted from your bank account or UPI application but the checkout screen indicated a failure, this is an interrupted banking transaction. The payment gateway (Razorpay) and your issuing bank will automatically reconcile and reverse the amount back to your source account.
              </p>
              <p>
                Such automated banking reversals typically reflect within <strong>3 to 7 business days</strong>, depending on your bank&apos;s settlement procedures.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="late-payments" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <RefreshCw className="w-4 h-4 text-brand-plum" />
              <span>Section 5</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              5. Late Payments on Cancelled or Expired Orders
            </h2>
            <div className="p-4 sm:p-5 rounded-xl bg-purple-50/70 border border-purple-200/80 text-purple-950 text-xs sm:text-sm space-y-2.5 leading-relaxed">
              <p className="font-semibold flex items-center gap-2 text-purple-900">
                <RefreshCw className="w-4 h-4 text-purple-700 shrink-0" />
                Backend Late-Payment Safety Safeguard
              </p>
              <p>
                On rare occasions, a customer may authorize a delayed payment (or an asynchronous webhook completes) after an order was already cancelled or expired.
              </p>
              <p>
                To prevent kitchen overbooking and unfulfilled expectations, CakeStore&apos;s backend enforces strict safety reconciliation:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>The order status remains strictly <strong>CANCELLED</strong>.</li>
                <li>The delivery slot is <strong>never automatically reactivated</strong>.</li>
                <li>The payment record is flagged as <strong>RECONCILIATION_REQUIRED</strong>.</li>
                <li>Platform administrators and bakery owners are automatically alerted.</li>
                <li>A manual administrative audit is triggered, and a full refund is initiated back to your original payment method via Razorpay.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="damaged-orders" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <AlertTriangle className="w-4 h-4" />
              <span>Section 6</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              6. Damaged or Incorrect Deliveries
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                Bakery Partners take immense care in packaging artisanal cakes safely. However, if your cake arrives with severe physical damage, spoilage, or an incorrect flavor or weight:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>Inspect on Delivery:</strong> Inspect the cake box and contents immediately upon receipt.
                </li>
                <li>
                  <strong>Report Promptly:</strong> Notify CakeStore Support and the bakery partner within <strong>2 hours</strong> of delivery handover.
                </li>
                <li>
                  <strong>Provide Photographic Evidence:</strong> Submit clear, unedited photographs of the cake, the packaging, and the delivery label to{' '}
                  <a href="mailto:support@cakestore.in" className="text-brand-plum font-semibold underline">
                    support@cakestore.in
                  </a>.
                </li>
              </ol>
              <p>
                Upon investigation, approved remedies may include a full refund, partial refund, or store voucher issued by the fulfilling bakery.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="refund-methods" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <CreditCard className="w-4 h-4" />
              <span>Section 7</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              7. Refund Process & Settlement Timelines
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                <strong>No Automatic or Cash Refunds:</strong> CakeStore does not issue cash refunds or automatic instant payouts. All approved refunds are submitted through our payment gateway (Razorpay) directly back to the original method of payment.
              </p>
              <p>
                <strong>Settlement Timelines:</strong> Once an authorized refund is initiated by platform administrators or the bakery partner:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li><strong>UPI Payments:</strong> Typically settle within 24 to 48 hours.</li>
                <li><strong>Credit & Debit Cards:</strong> Typically reflect within 5 to 7 banking business days, depending on the card issuer.</li>
                <li><strong>Net Banking:</strong> Typically reflects within 3 to 5 banking business days.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="disputes-contact" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <Mail className="w-4 h-4" />
              <span>Section 8</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              8. Dispute Resolution & Contact
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                If you have a question or concern regarding a payment status, cancellation, or refund, please have your <strong>Order Number</strong> (e.g., <code className="px-1.5 py-0.5 rounded bg-brand-cream font-mono text-xs text-brand-espresso">ORD-XXXX</code>) and Razorpay Payment ID ready.
              </p>
              <p>
                Reach our support team at{' '}
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

          {/* Section 9 */}
          <section id="draft-disclaimer" className="space-y-3 scroll-mt-24 pt-6 border-t border-brand-border/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-plum">
              <HelpCircle className="w-4 h-4" />
              <span>Section 9</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-espresso">
              9. Legal Draft Notice & Bakery Confirmation
            </h2>
            <div className="text-sm text-brand-muted space-y-3 leading-relaxed">
              <p>
                This document is a technical and operational policy draft. Cancellation lead times (e.g., 24 hours vs 48 hours advance notice) may vary among individual bakery partners based on their custom baking schedules. Formal commercial policies will be ratified upon merchant onboarding confirmation and legal review.
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
