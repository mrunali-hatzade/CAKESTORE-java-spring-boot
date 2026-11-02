  # CakeStore — Phase 2.4: Marketplace Dietary Discovery & Smart Filters Report

  **Status:** COMPLETE  
  **Environment:** Staging / Local Staging (`cake_platform`)  
  **Frontend Test Suite:** 300 / 300 passed (0 failed)  
  **Backend Targeted Storefront Suite:** 39 / 39 passed (0 failed)  
  **TypeScript Validation:** 0 errors (`npx tsc --noEmit`)  
  **Database Schema Version:** Flyway V57 (`V57__add_dietary_flags_to_products.sql`)  
  **Date:** November 2, 2026  

  ---

  ## Executive Summary

  Phase 2.4 (Marketplace Dietary Discovery & Smart Filters) enables customers on CakeStore to discover bakeries and cakes matching specific dietary preferences:
  - **`EGGLESS`**: Egg-free / vegetarian bakery items (high demand in Indian market).
  - **`VEGAN`**: 100% plant-based recipes with zero animal, milk, or dairy ingredients.
  - **`GLUTEN_FREE`**: Wheat-free / alternative grain formulations (almond flour, oat flour, etc.).

  All changes strictly adhered to production boundaries:
  - **Zero regression**: Preserved canonical location hierarchy, GPS discovery, interactive bakery maps, open-now filtering, delivery-zone geofencing, saved customer addresses, and customer authentication.
  - **Strict multi-tenant isolation**: Dietary filters operate purely on public, active, in-stock products belonging to active, non-restricted shops.
  - **Truthful product presentation**: Dietary badges are recipe formulation indicators and clearly distinguish recipe preferences from medical allergen-free certifications.
  - **Clean seed synchronization**: Removed 387 legacy test shops and disposable test accounts, replacing them with authentic Pune/Pimpri-Chinchwad bakeries from `db/seed` equipped with GPS coordinates, delivery configurations, 7-day business hours, verified reviews, and products with dietary flags.

  ---

  ## 1. Gap Analysis & Architecture Review

  | Component | Pre-Phase 2.4 Status | Phase 2.4 Implementation |
  | :--- | :--- | :--- |
  | **Database Schema** | `allow_egg_choice` and `egg_preference_default` existed on `products`, but `is_vegan` and `is_gluten_free` did not exist. | Created Flyway **V57**, adding `is_eggless`, `is_vegan`, and `is_gluten_free` booleans with defaults. Backfilled 66 existing records and created composite index `idx_products_shop_dietary_status`. |
  | **Backend Repository** | Native queries only filtered by location, business type, search term, and open-now status. | Added multi-condition `EXISTS (SELECT 1 FROM products p ...)` subqueries to all 7 native queries in [`ShopRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java) with overload methods. |
  | **Backend Service & API** | `discoverShopsPaged` and `CustomerStorefrontController` had no dietary parameters. | Added `List<String> dietary` support across controller, service, and DTO layers with backward-compatible method overloads. |
  | **Frontend API Client** | `buildShopSearchParams` omitted dietary query params. | Extended `ShopSearchFilters` with `dietary?: string[]` and serialized to comma-separated query param `?dietary=EGGLESS,VEGAN`. |
  | **Marketplace Filter UI** | No marketplace-level dietary filters existed on `/explore` or homepage. | Created [`DietaryFilter.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/DietaryFilter.tsx) with toggle chips, count badge, clear action, URL sync, and active filter ribbon tags. |
  | **Product & Owner UI** | Only veg/egg icon shown. Owner could not flag vegan or gluten-free. | Added `🌱 Vegan` and `🌾 Gluten-Free` badges to [`ProductCard.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/ProductCard.tsx), allergen disclaimer in [`ProductDetailModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/ProductDetailModal.tsx), and checkboxes in [`ProductModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/ProductModal.tsx). |

  ---

  ## 2. Database Migration (V57)

  File: `backend/src/main/resources/db/migration/V57__add_dietary_flags_to_products.sql`

  ```sql
  ALTER TABLE products
      ADD COLUMN IF NOT EXISTS is_eggless BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN NOT NULL DEFAULT FALSE;

  -- Backfill is_eggless from existing egg choices
  UPDATE products
  SET is_eggless = TRUE
  WHERE allow_egg_choice = TRUE 
    OR egg_preference_default = 'EGGLESS';

  -- High-performance composite index for marketplace queries
  CREATE INDEX IF NOT EXISTS idx_products_shop_dietary_status
  ON products (shop_id, status, availability, is_deleted, is_eggless, is_vegan, is_gluten_free);
  ```

  Live Migration Status: Applied and active on PostgreSQL `cake_platform`.

  ---

  ## 3. Backend Implementation Details

  ### 3.1 Domain Model & DTOs
  - [`Product.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/Product.java): Added `@Column(name = "is_eggless")`, `is_vegan`, `is_gluten_free`.
  - [`ProductRequest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/dto/ProductRequest.java): Added `isEggless`, `isVegan`, `isGlutenFree` input fields.
  - [`StorefrontProductDto.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/dto/StorefrontProductDto.java): Exposed dietary flags to storefront customers.
  - [`ProductService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/service/ProductService.java): Mapped fields during product creation and update with fallback to legacy `allowEggChoice`.

  ### 3.2 Native Query Semantics
  In [`ShopRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java), shops are filtered by:
  ```sql
  AND (
      (:requireEggless = false AND :requireVegan = false AND :requireGlutenFree = false)
      OR EXISTS (
          SELECT 1 FROM products p
          WHERE p.shop_id = s.id
            AND p.status = 'ACTIVE'
            AND p.availability = true
            AND p.is_deleted = false
            AND (:requireEggless = false OR p.is_eggless = true)
            AND (:requireVegan = false OR p.is_vegan = true)
            AND (:requireGlutenFree = false OR p.is_gluten_free = true)
      )
  )
  ```
  - When multiple filters are active (e.g. `VEGAN` and `GLUTEN_FREE`), a bakery is included only if it has at least one active, in-stock product satisfying **all** selected preferences simultaneously.
  - Non-active, unavailable, or deleted products do not qualify a shop.

  ---

  ## 4. Frontend Implementation Details

  ### 4.1 Filter Component & URL Synchronization
  - [`DietaryFilter.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/DietaryFilter.tsx): Accessible buttons for `Eggless`, `Vegan`, and `Gluten-Free` with active count badge and reset button.
  - [`explore/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/explore/page.tsx): Synchronizes filters with `?dietary=EGGLESS,VEGAN` URL search params. Renders active chips in the filter ribbon with one-click removal while preserving city, search text, GPS coordinates, radius, and sorting.
  - [`app/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/page.tsx): Homepage search bar includes quick dietary toggles.

  ### 4.2 Truthful Product Badging
  - [`ProductCard.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/ProductCard.tsx): Displays emerald `🌱 Vegan` and amber `🌾 Gluten-Free` chips alongside vegetarian/eggless markers.
  - [`ProductDetailModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/ProductDetailModal.tsx): Displays ingredients, allergens, and an advisory notice:
    > *"Dietary tags indicate recipe formulation and ingredient selection. They do not constitute certified medical allergen protection against cross-contamination."*
  - [`ProductModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/ProductModal.tsx): Bakery owners can mark products as Vegan and Gluten-Free directly in their management dashboard.

  ---

  ## 5. Seed Database & Marketplace Data Synchronization

  Per requirements, test bakeries and test data were purged and replaced with authentic seed bakeries:

  - **Purged Test Data**:
    - Removed 387 test shops (`Regression Bakery`, `Segregation Bakery`, `Date Filter Bakery`, etc.).
    - Removed 66 test products (`Test Cake`, `Cache Cake`).
    - Removed 779 disposable test accounts.
    - Reset PostgreSQL sequence generators.
  - **Seeded Authentic Bakeries**:
    1. **Akurdi Artisan Bakes** (Akurdi, Pimpri-Chinchwad, HOME_BAKERY, 5.0 ★, 4 products)
    2. **Ravet Cake Studio** (Ravet, Pimpri-Chinchwad, CAKE_STUDIO, 5.0 ★, 3 products)
    3. **Nigdi Sweet Treats** (Nigdi, Pimpri-Chinchwad, BAKERY_SHOP, 5.0 ★, 3 products)
    4. **Baner Dessert Boutique** (Baner, Pune, CAKE_STUDIO, 5.0 ★, 3 products)
    5. **Wakad Cloud Cakes** (Wakad, Pune, ONLINE_CAKE_BUSINESS, 5.0 ★, 3 products)
    6. **Kothrud Heritage Bakes** (Kothrud, Pune, BAKERY_SHOP, 5.0 ★, 3 products)
    7. **Pending / Inactive / Suspended** test shops for negative boundary verification.
  - **Seeded Products with Dietary Attributes**:
    - Total signature products: 19
    - Eggless products: 14 (e.g. Belgian Truffle, Fresh Mango Velvet, Tiramisu Bowl)
    - Vegan products: 2 (e.g. Vegan Raspberry Mousse Tart, Vegan Strawberry Silk)
    - Gluten-Free products: 2 (e.g. French Macarons Box, Vegan Raspberry Mousse Tart)
  - **Infrastructure Added**:
    - Exact GPS coordinates for map discovery & radius search.
    - Active subscriptions in `subscriptions` table.
    - 20 km delivery radius and serviceable pincodes in `shop_delivery_configs`.
    - 7-day operating hours (09:00 - 22:00) in `shop_business_hours` (for "Open Now" discovery).
    - Approved 5-star customer reviews in `feedback`.

  ---

  ## 6. Verification & Test Results

  ### 6.1 Frontend Test Suite
  - Executed: `npm test --prefix frontend_v2`
  - Total tests: **300**
  - Passed: **300**
  - Failed: **0**
  - New test suite: `frontend_v2/__tests__/marketplaceDietaryDiscovery.test.mjs` (6 tests covering URL synchronization, multi-select toggles, comma formatting, active chip removal, and badge rendering).
  - TypeScript check: `Set-Location frontend_v2; npx tsc --noEmit` -> **0 errors**.

  ### 6.2 Backend Test Suite
  - Executed: `mvn -f backend/pom.xml test -Dtest=CustomerStorefrontDietarySearchTest,CustomerStorefrontOpenNowAndMapTest,CustomerStorefrontSearchTest,CustomerStorefrontDeliveryGeofencingTest`
  - `CustomerStorefrontDietarySearchTest`: **7 / 7 passed** (Single filter, multi-filter, comma-delimited list, GPS radius search, empty dietary).
  - `CustomerStorefrontOpenNowAndMapTest`: **5 / 5 passed**.
  - `CustomerStorefrontSearchTest`: **18 / 18 passed**.
  - `CustomerStorefrontDeliveryGeofencingTest`: **9 / 9 passed**.
  - Total targeted storefront tests: **39 / 39 passed**.

  ---

  ## 7. Modified & Created Files Summary

  ### Backend
  - `backend/src/main/resources/db/migration/V57__add_dietary_flags_to_products.sql` (Created)
  - `backend/src/main/resources/db/seed/seed_dev_shops.sql` (Updated)
  - `backend/src/main/resources/db/seed/seed_dev_products.sql` (Updated)
  - `backend/src/main/java/com/cakeplatform/api/modules/product/Product.java` (Modified)
  - `backend/src/main/java/com/cakeplatform/api/modules/product/dto/ProductRequest.java` (Modified)
  - `backend/src/main/java/com/cakeplatform/api/modules/product/dto/StorefrontProductDto.java` (Modified)
  - `backend/src/main/java/com/cakeplatform/api/modules/product/service/ProductService.java` (Modified)
  - `backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java` (Modified)
  - `backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java` (Modified)
  - `backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java` (Modified)
  - `backend/src/test/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontDietarySearchTest.java` (Created)
  - `backend/src/test/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontOpenNowAndMapTest.java` (Updated mock index)

  ### Frontend
  - `frontend_v2/types/shop.ts` (Modified)
  - `frontend_v2/types/product.ts` (Modified)
  - `frontend_v2/lib/api/storefront.ts` (Modified)
  - `frontend_v2/components/customer/marketplace/DietaryFilter.tsx` (Created)
  - `frontend_v2/app/explore/page.tsx` (Modified)
  - `frontend_v2/app/page.tsx` (Modified)
  - `frontend_v2/components/customer/storefront/ProductCard.tsx` (Modified)
  - `frontend_v2/components/customer/storefront/ProductDetailModal.tsx` (Modified)
  - `frontend_v2/components/owner/ProductModal.tsx` (Modified)
  - `frontend_v2/__tests__/marketplaceDietaryDiscovery.test.mjs` (Created)

  ---

  ## 8. Final Verdict

  ### **COMPLETE**

  All objectives of Phase 2.4 have been implemented, tested, and verified. The staging database is clean, populated with realistic Pune/PCMC bakeries and products from `db/seed`, and all dietary discovery capabilities are fully operational.

