import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'How It Works — Ordering Handcrafted Cakes',
  description:
    'Learn how CakeStore connects you with certified local home bakers. Customize flavors, schedule dedicated delivery slots, and enjoy fresh-baked celebration cakes.',
  alternates: {
    canonical: '/how-it-works',
  },
  openGraph: {
    title: 'How It Works — Ordering Handcrafted Cakes | CakeStore',
    description:
      'Learn how CakeStore connects you with certified local home bakers for fresh custom cakes.',
    url: '/how-it-works',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works — Ordering Handcrafted Cakes | CakeStore',
    description:
      'Learn how CakeStore connects you with certified local home bakers for fresh custom cakes.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
