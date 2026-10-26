import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Simple Pricing Plans for Bakery Owners',
  description:
    'Transparent, flat monthly and annual subscription plans for independent bakers with zero per-order commission fees.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Simple Pricing Plans for Bakery Owners | CakeStore',
    description:
      'Transparent flat subscription pricing for independent bakers with 0% marketplace commission.',
    url: '/pricing',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Simple Pricing Plans for Bakery Owners | CakeStore',
    description:
      'Transparent flat subscription pricing for independent bakers with 0% marketplace commission.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
