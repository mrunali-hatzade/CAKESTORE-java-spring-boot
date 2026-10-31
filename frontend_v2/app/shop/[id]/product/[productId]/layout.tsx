import type { Metadata } from 'next';
import React from 'react';

interface ProductLayoutProps {
  children: React.ReactNode;
  params: { id: string; productId: string };
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cakestore.in';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function fetchProductData(shopId: string, productId: string) {
  try {
    const res = await fetch(`${apiUrl}/api/storefront/shops/${shopId}/products/${productId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchShopData(shopId: string) {
  try {
    const res = await fetch(`${apiUrl}/api/storefront/shops/${shopId}`, {
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
  params: { id: string; productId: string };
}): Promise<Metadata> {
  const [product, shop] = await Promise.all([
    fetchProductData(params.id, params.productId),
    fetchShopData(params.id),
  ]);

  const bakeryName = shop?.businessName || 'Artisanal Bakery';
  const productName = product?.name || 'Artisanal Cake';
  const title = `${productName} | ${bakeryName}`;
  const description =
    product?.description && product.description.trim().length > 0
      ? product.description.trim()
      : `Order fresh handcrafted ${productName} from ${bakeryName} on CakeStore.`;

  const imageUrl = product?.imageUrl || shop?.coverImageUrl || '/marketplace-hero-bg.jpg';
  const canonicalUrl = `/shop/${params.id}/product/${params.productId}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'website',
      title: `${productName} | ${bakeryName}`,
      description,
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          alt: `${productName} from ${bakeryName}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${productName} | ${bakeryName}`,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProductLayout({
  children,
  params,
}: ProductLayoutProps) {
  const [product, shop] = await Promise.all([
    fetchProductData(params.id, params.productId),
    fetchShopData(params.id),
  ]);

  let jsonLd = null;
  if (product && product.name) {
    const bakeryName = shop?.businessName || 'Artisanal Bakery';
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || undefined,
      image: product.imageUrl || undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: typeof product.price === 'number' ? product.price : undefined,
        availability:
          product.isAvailable === false
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
        seller: {
          '@type': 'Bakery',
          name: bakeryName,
          url: `${siteUrl}/shop/${params.id}`,
        },
      },
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
