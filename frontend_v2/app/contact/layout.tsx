import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Contact Support Team',
  description:
    'Need help with a cake order, bakery onboarding, or technical assistance? Contact CakeStore support via email, phone, or message.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Support Team | CakeStore',
    description:
      'Get in touch with the CakeStore customer care and bakery partner support team.',
    url: '/contact',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Support Team | CakeStore',
    description:
      'Get in touch with the CakeStore customer care and bakery partner support team.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
