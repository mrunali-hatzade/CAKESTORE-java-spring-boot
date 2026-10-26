import type { Metadata } from 'next';
import React from 'react';

interface ShopLayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cakestore.in';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function fetchShopData(id: string) {
  try {
    const res = await fetch(`${apiUrl}/api/storefront/shops/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const shop = await fetchShopData(params.id);

  if (!shop || !shop.businessName) {
    return {
      title: 'Bakery Storefront',
      description:
        'Discover verified artisanal cakes and handcrafted celebration desserts on CakeStore.',
      alternates: {
        canonical: `/shop/${params.id}`,
      },
    };
  }

  const locationPart = shop.city ? ` in ${shop.city}` : '';
  const title = `${shop.businessName} — Artisanal Bakery${locationPart}`;
  const description =
    shop.bio ||
    shop.tagline ||
    `Order fresh artisanal celebration cakes, pastries, and custom desserts directly from ${shop.businessName}${locationPart}.`;

  const imageUrl =
    shop.coverImageUrl || shop.logoUrl || '/marketplace-hero-bg.jpg';

  return {
    title,
    description,
    alternates: {
      canonical: `/shop/${params.id}`,
    },
    openGraph: {
      type: 'website',
      title: `${shop.businessName} | CakeStore`,
      description,
      url: `/shop/${params.id}`,
      images: [
        {
          url: imageUrl,
          alt: `${shop.businessName} storefront`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${shop.businessName} | CakeStore`,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ShopLayout({
  children,
  params,
}: ShopLayoutProps) {
  const shop = await fetchShopData(params.id);

  // Generate truthful Schema.org Bakery / LocalBusiness JSON-LD only from verified shop fields
  let jsonLd = null;
  if (shop && shop.businessName) {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Bakery',
      name: shop.businessName,
      description: shop.bio || shop.tagline || undefined,
      url: `${siteUrl}/shop/${shop.id}`,
      image: shop.coverImageUrl || shop.logoUrl || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: shop.address || undefined,
        addressLocality: shop.city || undefined,
        addressRegion: shop.state || undefined,
        postalCode: shop.pincode || undefined,
        addressCountry: 'IN',
      },
      geo:
        shop.latitude && shop.longitude
          ? {
              '@type': 'GeoCoordinates',
              latitude: Number(shop.latitude),
              longitude: Number(shop.longitude),
            }
          : undefined,
      aggregateRating:
        shop.rating && shop.rating > 0 && shop.reviewCount && shop.reviewCount > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: Number(shop.rating),
              reviewCount: Number(shop.reviewCount),
            }
          : undefined,
    };
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
