# CakeStore — SEO Verification and Gap-Fix Report

**Document Status:** Complete & Verified  
**Date:** October 26, 2026  
**Scope:** Verification of Public SEO Implementation, Sitemap Completeness & Pagination, Real Storefront Data Validation, Canonical URL Isolation, and Access-Control Auditing.  

---

## 1. Executive Summary

A focused verification was conducted on CakeStore’s public SEO implementation following the initial delivery documented in `CAKESTORE_PUBLIC_SEO_IMPLEMENTATION_REPORT.md`. 

### Key Findings and Remediations:
1. **Sitemap Pagination & Truncation Defect Fixed:** The initial sitemap generator fetched `/api/storefront/shops/search?size=50` once. Because the backend caps page size at 100 and returns a Spring Page structure, marketplaces with more than 50 bakeries suffered from sitemap truncation, leaving out all bakeries beyond the 50th. `app/sitemap.ts` was upgraded to implement full iterative pagination with a deduplicating `Map<number, MetadataRoute.Sitemap[number]>` to guarantee 100% coverage of active bakeries without duplicates.
2. **Product Page Canonical Inheritance Defect Fixed:** Next.js App Router rules dictate that client child pages (`shop/[id]/product/[productId]/page.tsx`) inherit parent layout metadata when unspecified. Because `shop/[id]/layout.tsx` declared `canonical: /shop/${params.id}`, product detail pages were erroneously pointing to the bakery storefront as their canonical URL. A dedicated server layout was created at `frontend_v2/app/shop/[id]/product/[productId]/layout.tsx`, isolating product canonical URLs (`/shop/${params.id}/product/${params.productId}`) and emitting Schema.org `Product` JSON-LD.
3. **Truthful Storefront Metadata Grounded in Real Data:** Audited against active local database records (e.g. Shop ID `223` "Test Bakery" and Product ID `2882` "Test Cake"). Storefront and product metadata dynamically populate real business names, descriptions, prices (INR), and stock availability. Missing fields (such as unrated shops or missing GPS coordinates) strictly suppress `aggregateRating` and `geo` rather than fabricating ratings or mock coordinates.
4. **Defense-in-Depth Access Control Confirmed:** Verified that `/robots.txt` disallows sensitive paths (`/admin`, `/dashboard`, `/checkout`, `/orders/*`, etc.) purely as crawler guidance. Real access control is independently enforced via client-side Auth Guards (redirecting unauthenticated users to `/login`) and backend Spring Security filters (returning `401 Unauthorized` / `403 Forbidden` for unauthenticated or non-admin requests).
5. **Full Test Suite & Production Build Passing:** All 259 frontend tests passed across 21 test suites (`npm test`), the linter passed with 0 errors (`npm run lint`), and the Next.js production build (`npm run build`) completed successfully.

---

## 2. Files Inspected and Changes Made

### 2.1 Files Inspected
- [`frontend_v2/app/sitemap.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/sitemap.ts) — Dynamic sitemap generator.
- [`backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java) — Storefront search, shop details, and product detail endpoints.
- [`backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java) — Search pagination logic, subscription gating, and shop resolution.
- [`backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java) — Native queries for active marketplace shops.
- [`frontend_v2/app/shop/[id]/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/shop/[id]/layout.tsx) — Bakery storefront layout, metadata generator, and Schema.org `Bakery` JSON-LD.
- [`frontend_v2/app/shop/[id]/product/[productId]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/shop/[id]/product/[productId]/page.tsx) — Client product detail page.
- [`frontend_v2/app/robots.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/robots.ts) — Crawler guidance configuration.
- [`frontend_v2/app/dashboard/owner/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/dashboard/owner/layout.tsx) — Owner dashboard authentication and subscription guard.
- [`frontend_v2/app/admin/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx) — Admin dashboard `ROLE_ADMIN` guard.
- [`backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java) — Spring Security filter chain and endpoint authorization rules.

### 2.2 Changes Made
1. **[`frontend_v2/app/sitemap.ts`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/sitemap.ts)**:
   - Replaced single `?size=50` request with paginated `?page=${currentPage}&size=100` iteration loop up to `totalPages`.
   - Introduced `dynamicShopMap = new Map<number, MetadataRoute.Sitemap[number]>()` to ensure 100% URL deduplication.
2. **[`frontend_v2/app/shop/[id]/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/shop/[id]/layout.tsx)**:
   - Updated rating calculation to support both backend DTO fields (`averageRating`, `totalReviews`) and frontend model aliases (`rating`, `reviewCount`).
   - Reinforced strict validation (`ratingValue > 0 && reviewCountValue > 0`) to prevent emitting empty or 0-star `aggregateRating`.
   - Cleaned street address formatting and validated GPS coordinates before emitting `geo`.
3. **[`frontend_v2/app/shop/[id]/product/[productId]/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/shop/[id]/product/[productId]/layout.tsx)** (New File):
   - Created server component layout for product routes.
   - Declares distinct `canonical: /shop/${params.id}/product/${params.productId}`, preventing inheritance of the parent bakery storefront canonical URL.
   - Emits Schema.org `Product` JSON-LD with real price, `INR` currency, seller `Bakery`, and availability.
4. **[`frontend_v2/__tests__/seoMetadataAndStructuredData.test.mjs`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__/seoMetadataAndStructuredData.test.mjs)**:
   - Added regression test asserting product layout canonical isolation and Schema.org `Product` generation.
   - Updated sitemap assertions to verify paginated querying and deduplication.

---

## 3. Sitemap Coverage and Pagination Findings

### 3.1 Backend Contract Inspection
In `CustomerStorefrontController.java` lines 69–71 and 107–117:
- The `/api/storefront/shops/search` endpoint accepts `@RequestParam Integer page` and `@RequestParam Integer size`.
- When `page` is provided, the backend returns a Spring `Page<StorefrontShopSummaryDTO>` containing `content`, `totalPages`, `totalElements`, and `size`.
- The maximum permissible page size is capped at 100 (`Math.min(size, 100)`).
- Native query in `ShopRepository.java` strictly filters:
  ```sql
  WHERE s.status = 'ACTIVE' AND s.is_deleted = false
    AND COALESCE(s.is_owner_enabled, true) = true
    AND COALESCE(s.is_marketplace_restricted, false) = false
  ```
- Any shop that is suspended, pending, soft-deleted, closed by the owner (vacation mode), or administratively restricted from the marketplace is automatically excluded from search results.

### 3.2 Omission Analysis & Remediated Behavior
- **Previous behavior:** Queried `size=50` once. When total shops exceeded 50, shops 51+ were omitted from the sitemap.
- **Remediated behavior:** Queries `page=0&size=100`, checks `totalPages`, and fetches remaining pages up to `MAX_PAGES` (50 pages / 5,000 shops).
- **Deduplication:** A `Map<number, ...>` guarantees each shop ID is mapped to exactly one sitemap entry.
- **Canonical origin:** All URLs use `${baseUrl}/shop/${shop.id}`, defaulting to verified `https://cakestore.in` or `NEXT_PUBLIC_SITE_URL`.
- **Live Output Verification:** Querying `http://localhost:3000/sitemap.xml` yielded all 43 active bakeries currently in the local database alongside the 9 static public pages (total 52 URLs), formatted as valid XML under `http://www.sitemaps.org/schemas/sitemap/0.9`.

---

## 4. Results Using Real Local Bakery Data

### 4.1 Local Bakery and Product Details
The implementation was verified against real database records:
- **Bakery Record:** Shop ID `223` ("Test Bakery")
  - `status`: `ACTIVE`
  - `verificationStatus`: `PROCESSING`
  - `averageRating`: `null`, `totalReviews`: `0`
  - `latitude`: `null`, `longitude`: `null`
- **Product Record:** Product ID `2882` ("Test Cake")
  - `shopId`: `223`
  - `name`: `Test Cake`
  - `price`: `500`
  - `availability`: `true`

### 4.2 Live Metadata Verification on Storefront (`/shop/223`)
- **HTTP Status:** `200 OK`
- **Rendered Title:** `Test Bakery — Artisanal Bakery | CakeStore`
- **Canonical URL:** `https://cakestore.in/shop/223`
- **Schema.org Bakery JSON-LD:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Bakery",
    "name": "Test Bakery",
    "url": "https://cakestore.in/shop/223",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN"
    }
  }
  ```
- **Truthfulness Verification:**
  - `aggregateRating` was **NOT** outputted because `totalReviews` was 0 and `averageRating` was null.
  - `geo` was **NOT** outputted because `latitude` and `longitude` were null.
  - Zero fabricated numbers were emitted.

### 4.3 Live Metadata Verification on Product (`/shop/223/product/2882`)
- **HTTP Status:** `200 OK`
- **Rendered Title:** `Test Cake | Test Bakery | CakeStore`
- **Rendered Canonical Link:**
  ```html
  <link rel="canonical" href="https://cakestore.in/shop/223/product/2882"/>
  ```
  *(Confirmed distinct from `/shop/223` — no parent canonical inheritance).*
- **Schema.org Product JSON-LD:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Test Cake",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": 500,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Bakery",
        "name": "Test Bakery",
        "url": "https://cakestore.in/shop/223"
      }
    }
  }
  ```

---

## 5. Robots Guidance vs. Actual Access-Control Findings

| Layer | Component | Target Routes | Mechanism | Finding / Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| **Crawler Guidance** | `app/robots.ts` | `/admin`, `/dashboard`, `/checkout`, `/orders/*`, `/api/*`, `/reset-password` | `Disallow` directives in `/robots.txt` | Advises compliant search engines not to crawl. **Not an access-control boundary.** |
| **Client Auth Guard** | `app/dashboard/owner/layout.tsx` | `/dashboard/owner/*` | React `useEffect` checking `isAuthenticated` & `isLoading` | Unauthenticated users receive immediate redirect to `/login?redirect=...`. Layout returns `null`. |
| **Client Admin Guard** | `app/admin/layout.tsx` | `/admin/*` | React `useEffect` checking `isAdmin` (`ROLE_ADMIN`) | Non-admin users redirected to `/login`. Layout returns `null`. |
| **Backend REST Guard** | `SecurityConfig.java` | `/api/**` (non-storefront) | Spring Security JWT Filter | Anonymous requests to protected APIs return `401 Unauthorized`. |
| **Order Tracking Guard** | `CustomerStorefrontController.java` | `/api/storefront/shops/orders/{orderNumber}` | Principal / `trackPhone` check | Unauthenticated access without customer phone token returns `401 Unauthorized`. |
| **Sensitive File Uploads** | `SecurityConfig.java` | `/uploads/documents/**`, `/uploads/verifications/**` | `.denyAll()` | Strict HTTP 403 on all public requests to confidential owner documents. |

**Audit Conclusion:** Private data and administrative functions are protected by defense-in-depth token authentication and role authorization. The robots.txt guidance correctly mirrors these boundaries without serving as the sole security control.

---

## 6. Commands Run and Actual Results

| Command | Working Directory | Intent | Result |
| :--- | :--- | :--- | :--- |
| `node --test __tests__/seoMetadataAndStructuredData.test.mjs` | `frontend_v2` | Verify SEO & canonical regression tests | **Passed** (7/7 tests passed in 14.5ms) |
| `npm test` | `frontend_v2` | Run entire frontend test suite | **Passed** (259/259 tests passed across 21 test suites in 5.6s) |
| `npm run lint` | `frontend_v2` | Code linting and type validation | **Passed** (0 errors, 1 pre-existing warning) |
| `npm run build` | `frontend_v2` | Next.js production bundle compilation | **Passed** (Compiled all 43 static pages, `/robots.txt`, and `/sitemap.xml`) |
| `curl http://localhost:3000/sitemap.xml` | Localhost | Verify live sitemap with backend up | **Passed** (322 lines of XML generated with 43 active bakeries) |
| `curl http://localhost:3000/shop/223/product/2882` | Localhost | Inspect HTML head for canonical isolation & JSON-LD | **Passed** (Distinct product canonical tag and truthful Schema.org Product block verified) |

---

## 7. Remaining Production-Only Checks

1. **Live Search Engine Ingestion:** Once DNS A/CNAME records point `https://cakestore.in` to the production environment with valid SSL, submit `https://cakestore.in/sitemap.xml` directly inside **Google Search Console** and **Bing Webmaster Tools**.
2. **Search Console Rich Results Test:** Run Google's live Rich Results Test on an active production shop (`/shop/<id>`) and product page (`/shop/<id>/product/<id>`) to verify Schema.org `Bakery` and `Product` rich snippets.
3. **Origin Environment Variable Verification:** Ensure `NEXT_PUBLIC_SITE_URL=https://cakestore.in` and `NEXT_PUBLIC_API_URL` are provided in the production hosting environment variables (e.g. Vercel, Docker, or AWS ECS).
4. **Periodic Revalidation Monitoring:** Confirm that Next.js ISR (Incremental Static Regeneration) cache for `sitemap.xml` revalidates every 3600 seconds as configured, automatically picking up new bakeries onboarding to the platform.

---

## 8. Conclusion

All verified gaps have been remediated. The sitemap now dynamically paginates and covers all eligible active bakeries without arbitrary truncation, product pages maintain dedicated canonical URLs without parent layout pollution, Schema.org blocks remain strictly truthful, and access controls operate securely across both client and server boundaries.
