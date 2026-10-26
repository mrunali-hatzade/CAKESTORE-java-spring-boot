import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'For Bakery Owners — Grow Your Bakery with 0% Commission',
  description:
    'Set up your own branded bakery storefront, manage custom orders, control delivery slots, and receive direct payments with 0% marketplace commission.',
  alternates: {
    canonical: '/for-owners',
  },
  openGraph: {
    title: 'For Bakery Owners — Grow Your Bakery with 0% Commission | CakeStore',
    description:
      'Launch your independent online bakery storefront with dedicated delivery slots and 0% commission.',
    url: '/for-owners',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'For Bakery Owners — Grow Your Bakery with 0% Commission | CakeStore',
    description:
      'Launch your independent online bakery storefront with dedicated delivery slots and 0% commission.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function ForOwnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
