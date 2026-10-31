import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cakestore.in';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for-owners`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/refund-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const dynamicShopMap = new Map<number, MetadataRoute.Sitemap[number]>();
  const PAGE_SIZE = 100;
  const MAX_PAGES = 50; // Safety cap allowing up to 5,000 shops

  try {
    let currentPage = 0;
    let totalPages = 1;

    while (currentPage < totalPages && currentPage < MAX_PAGES) {
      const res = await fetch(
        `${apiUrl}/api/storefront/shops/search?page=${currentPage}&size=${PAGE_SIZE}`,
        {
          next: { revalidate: 3600 },
        }
      );

      if (!res.ok) break;

      const data = await res.json();
      const shops: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
        ? data.content
        : [];

      for (const shop of shops) {
        if (shop && shop.id && !dynamicShopMap.has(shop.id)) {
          dynamicShopMap.set(shop.id, {
            url: `${baseUrl}/shop/${shop.id}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        }
      }

      if (typeof data?.totalPages === 'number') {
        totalPages = data.totalPages;
      } else {
        break; // Unpaginated plain array response
      }

      currentPage++;
    }
  } catch {
    // If backend is unreachable during static build, static routes preserve sitemap validity
  }

  return [...staticRoutes, ...Array.from(dynamicShopMap.values())];
}
