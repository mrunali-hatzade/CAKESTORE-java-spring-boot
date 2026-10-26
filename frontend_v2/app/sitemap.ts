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

  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${apiUrl}/api/storefront/shops/search?size=50`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const shops = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
        ? data.content
        : [];

      dynamicRoutes = shops
        .filter((s: any) => s && s.id)
        .map((shop: any) => ({
          url: `${baseUrl}/shop/${shop.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }));
    }
  } catch {
    // If backend is unreachable during static build, static routes preserve sitemap validity
  }

  return [...staticRoutes, ...dynamicRoutes];
}
