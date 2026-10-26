import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Explore Artisanal Bakeries Across India',
  description:
    'Search and discover top-rated independent home bakers and boutique cake studios near you. Filter by city, district, eggless options, and delivery radius.',
  alternates: {
    canonical: '/explore',
  },
  openGraph: {
    title: 'Explore Artisanal Bakeries Across India | CakeStore',
    description:
      'Search and discover top-rated independent home bakers and boutique cake studios near you.',
    url: '/explore',
    images: ['/marketplace-hero-bg.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Artisanal Bakeries Across India | CakeStore',
    description:
      'Search and discover top-rated independent home bakers and boutique cake studios near you.',
    images: ['/marketplace-hero-bg.jpg'],
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
