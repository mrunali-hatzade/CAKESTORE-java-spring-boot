import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_DIR = process.cwd().endsWith('frontend_v2')
  ? process.cwd()
  : path.resolve(process.cwd(), 'frontend_v2');

test('CakeStore: Public Website SEO Metadata & Structured Data Suite', async (t) => {
  // Test 1: Root layout metadataBase, OpenGraph, Twitter, and Schema.org JSON-LD
  await t.test('1. app/layout.tsx contains metadataBase, title template, OpenGraph, and Schema.org Organization', () => {
    const layoutPath = path.join(FRONTEND_DIR, 'app', 'layout.tsx');
    assert.ok(fs.existsSync(layoutPath), 'app/layout.tsx must exist');

    const content = fs.readFileSync(layoutPath, 'utf8');

    // Canonical production origin fallback
    assert.ok(content.includes("https://cakestore.in"), 'Must default to verified origin https://cakestore.in');
    assert.ok(content.includes('metadataBase: new URL('), 'Must configure metadataBase');

    // Title template
    assert.ok(content.includes("template: '%s | CakeStore'"), 'Must configure title template %s | CakeStore');
    assert.ok(content.includes("default: 'CakeStore — Artisanal Bakery Marketplace & SaaS Platform'"), 'Must configure default title');

    // OpenGraph & Twitter
    assert.ok(content.includes("type: 'website'"), 'Must specify OpenGraph website type');
    assert.ok(content.includes("url: '/marketplace-hero-bg.jpg'"), 'Must reference existing hero image asset');
    assert.ok(content.includes("card: 'summary_large_image'"), 'Must specify summary_large_image Twitter card');

    // Robots configuration
    assert.ok(content.includes('robots: {'), 'Must configure robots in root layout');
    assert.ok(content.includes('index: true'), 'Must enable indexing for public pages');

    // Schema.org Structured Data
    assert.ok(content.includes('@context\': \'https://schema.org\''), 'Must include Schema.org context');
    assert.ok(content.includes('@type\': \'Organization\''), 'Must include Organization schema');
    assert.ok(content.includes('@type\': \'WebSite\''), 'Must include WebSite schema');
    assert.ok(content.includes('support@cakestore.in'), 'Must reference truthful contact email');
    assert.ok(content.includes('/explore?search={search_term_string}'), 'Must specify SearchAction target');
  });

  // Test 2: app/robots.ts output and exclusion of private/admin routes
  await t.test('2. app/robots.ts permits public crawl and strictly disallows private/authenticated routes', () => {
    const robotsPath = path.join(FRONTEND_DIR, 'app', 'robots.ts');
    assert.ok(fs.existsSync(robotsPath), 'app/robots.ts must exist');

    const content = fs.readFileSync(robotsPath, 'utf8');

    // Default canonical origin fallback
    assert.ok(content.includes('https://cakestore.in'), 'Must reference default origin https://cakestore.in');
    assert.ok(content.includes("allow: '/'"), 'Must allow root public path');

    // Strict exclusion of private routes
    assert.ok(content.includes("'/admin'"), 'Must disallow /admin');
    assert.ok(content.includes("'/admin/*'"), 'Must disallow /admin/*');
    assert.ok(content.includes("'/dashboard'"), 'Must disallow /dashboard');
    assert.ok(content.includes("'/dashboard/*'"), 'Must disallow /dashboard/*');
    assert.ok(content.includes("'/api/*'"), 'Must disallow /api/*');
    assert.ok(content.includes("'/checkout'"), 'Must disallow /checkout');
    assert.ok(content.includes("'/orders/*'"), 'Must disallow /orders/*');
    assert.ok(content.includes("'/reset-password'"), 'Must disallow /reset-password');
    assert.ok(content.includes("'/forgot-password'"), 'Must disallow /forgot-password');

    // Declaration of sitemap
    assert.ok(content.includes('sitemap: `${baseUrl}/sitemap.xml`'), 'Must declare sitemap location');
  });

  // Test 3: app/sitemap.ts includes all public static routes and excludes private routes
  await t.test('3. app/sitemap.ts enumerates all public static routes with priorities and excludes private routes', () => {
    const sitemapPath = path.join(FRONTEND_DIR, 'app', 'sitemap.ts');
    assert.ok(fs.existsSync(sitemapPath), 'app/sitemap.ts must exist');

    const content = fs.readFileSync(sitemapPath, 'utf8');

    // Verify all public routes present in staticRoutes definition
    assert.ok(content.includes('url: `${baseUrl}`'), 'Sitemap must contain homepage');
    assert.ok(content.includes('url: `${baseUrl}/explore`'), 'Sitemap must contain /explore');
    assert.ok(content.includes('url: `${baseUrl}/how-it-works`'), 'Sitemap must contain /how-it-works');
    assert.ok(content.includes('url: `${baseUrl}/for-owners`'), 'Sitemap must contain /for-owners');
    assert.ok(content.includes('url: `${baseUrl}/pricing`'), 'Sitemap must contain /pricing');
    assert.ok(content.includes('url: `${baseUrl}/contact`'), 'Sitemap must contain /contact');
    assert.ok(content.includes('url: `${baseUrl}/terms`'), 'Sitemap must contain /terms');
    assert.ok(content.includes('url: `${baseUrl}/privacy`'), 'Sitemap must contain /privacy');
    assert.ok(content.includes('url: `${baseUrl}/refund-policy`'), 'Sitemap must contain /refund-policy');

    // Verify dynamic shop generation
    assert.ok(content.includes('/api/storefront/shops/search?size=50'), 'Sitemap must query public storefront API');
    assert.ok(content.includes('url: `${baseUrl}/shop/${shop.id}`'), 'Sitemap must include dynamic bakery shop URLs');

    // Verify private routes are NOT in sitemap
    assert.ok(!content.includes('url: `${baseUrl}/admin`'), 'Sitemap must not contain /admin');
    assert.ok(!content.includes('url: `${baseUrl}/dashboard`'), 'Sitemap must not contain /dashboard');
    assert.ok(!content.includes('url: `${baseUrl}/checkout`'), 'Sitemap must not contain /checkout');
    assert.ok(!content.includes('url: `${baseUrl}/orders`'), 'Sitemap must not contain private orders');
  });

  // Test 4: Verify static public routes layouts define canonical URLs and metadata
  await t.test('4. Public route layouts define canonical URLs and metadata', () => {
    const publicLayouts = [
      { file: 'app/explore/layout.tsx', canonical: '/explore', titleSnippet: 'Explore Artisanal' },
      { file: 'app/how-it-works/layout.tsx', canonical: '/how-it-works', titleSnippet: 'How It Works' },
      { file: 'app/for-owners/layout.tsx', canonical: '/for-owners', titleSnippet: 'For Bakery Owners' },
      { file: 'app/pricing/layout.tsx', canonical: '/pricing', titleSnippet: 'Pricing Plans' },
      { file: 'app/contact/layout.tsx', canonical: '/contact', titleSnippet: 'Contact Support' },
    ];

    for (const item of publicLayouts) {
      const fullPath = path.join(FRONTEND_DIR, item.file);
      assert.ok(fs.existsSync(fullPath), `${item.file} must exist`);

      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.includes(`canonical: '${item.canonical}'`), `${item.file} must define canonical ${item.canonical}`);
      assert.ok(content.includes(item.titleSnippet), `${item.file} must include title snippet "${item.titleSnippet}"`);
      assert.ok(content.includes('openGraph:'), `${item.file} must define openGraph metadata`);
    }

    // Verify legal pages define canonical URLs
    const legalPages = [
      { file: 'app/terms/page.tsx', canonical: '/terms' },
      { file: 'app/privacy/page.tsx', canonical: '/privacy' },
      { file: 'app/refund-policy/page.tsx', canonical: '/refund-policy' },
    ];

    for (const item of legalPages) {
      const fullPath = path.join(FRONTEND_DIR, item.file);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.includes(`canonical: '${item.canonical}'`), `${item.file} must define canonical ${item.canonical}`);
    }
  });

  // Test 5: Dynamic Storefront layout generateMetadata and Schema.org Bakery JSON-LD
  await t.test('5. app/shop/[id]/layout.tsx generates truthful metadata and Schema.org Bakery schema', async () => {
    const shopLayoutPath = path.join(FRONTEND_DIR, 'app', 'shop', '[id]', 'layout.tsx');
    assert.ok(fs.existsSync(shopLayoutPath), 'app/shop/[id]/layout.tsx must exist');

    const content = fs.readFileSync(shopLayoutPath, 'utf8');

    // Verify generateMetadata is exported
    assert.ok(content.includes('export async function generateMetadata'), 'Must export generateMetadata');
    assert.ok(content.includes('canonical: `/shop/${params.id}`'), 'Must define dynamic canonical /shop/${params.id}');

    // Verify Schema.org Bakery
    assert.ok(content.includes("'@type': 'Bakery'"), 'Must specify Bakery schema type');
    assert.ok(content.includes("'@type': 'PostalAddress'"), 'Must specify PostalAddress schema');

    // Verify aggregateRating is conditional on real verified ratings (no fabricated numbers)
    assert.ok(
      content.includes('shop.rating && shop.rating > 0 && shop.reviewCount && shop.reviewCount > 0'),
      'aggregateRating must only be rendered if real rating and reviewCount exist'
    );

    // Verify geo coordinates are conditional on verified coordinates
    assert.ok(
      content.includes('shop.latitude && shop.longitude'),
      'GeoCoordinates must only be rendered if latitude and longitude exist'
    );
  });
});
