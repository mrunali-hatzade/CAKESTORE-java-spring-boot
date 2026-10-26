import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { CustomerAuthProvider } from '@/lib/auth/CustomerAuthContext';
import { ToastProvider } from '@/components/common/Toast';
import { CartProvider } from '@/context/CartContext';
import { FavoritesProvider } from '@/context/FavoritesContext';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cakestore.in';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CakeStore — Artisanal Bakery Marketplace & SaaS Platform',
    template: '%s | CakeStore',
  },
  description:
    'Discover handcrafted artisanal celebration cakes from certified local home bakers and boutique cake studios across India, or manage your bakery business with 0% commission.',
  applicationName: 'CakeStore',
  authors: [{ name: 'CakeStore Team' }],
  generator: 'Next.js',
  keywords: [
    'artisanal cakes',
    'custom cakes India',
    'home bakers marketplace',
    'fresh celebration cakes',
    'eggless cakes',
    'wedding cakes Pune Mumbai',
    'boutique cake studios',
    'bakery software platform',
  ],
  creator: 'CakeStore',
  publisher: 'CakeStore Platform',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'CakeStore',
    title: 'CakeStore — Artisanal Bakery Marketplace & SaaS Platform',
    description:
      'Discover handcrafted celebration cakes from certified independent home bakers and boutique cake studios across India.',
    images: [
      {
        url: '/marketplace-hero-bg.jpg',
        width: 1200,
        height: 630,
        alt: 'CakeStore Artisanal Bakery Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CakeStore — Artisanal Bakery Marketplace & SaaS Platform',
    description:
      'Discover handcrafted celebration cakes from certified independent home bakers and boutique cake studios across India.',
    images: ['/marketplace-hero-bg.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'CakeStore',
      url: siteUrl,
      logo: `${siteUrl}/favicon.svg`,
      description:
        'SaaS marketplace connecting dessert lovers with certified independent home bakers and boutique cake studios across India.',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-9823100000',
        contactType: 'customer support',
        email: 'support@cakestore.in',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'CakeStore',
      description:
        'Handcrafted artisanal cakes from certified local home bakers and boutique cake studios across India.',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/explore?search={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-brand-cream-light font-sans text-brand-espresso antialiased">
        <AuthProvider>
          <CustomerAuthProvider>
            <ToastProvider>
              <CartProvider>
                <FavoritesProvider>{children}</FavoritesProvider>
              </CartProvider>
            </ToastProvider>
          </CustomerAuthProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
