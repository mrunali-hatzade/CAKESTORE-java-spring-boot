   # CakeStore — Phase 2.4 Final Staging Smoke Test & Data Integrity Audit Report

   **Audit Type:** Strictly Read-Only Final Staging & Data Integrity Verification  
   **Date:** November 2, 2026  
   **Final Verdict:** **PASS WITH CONDITIONS**  

   ---

   ## 1. Environment Identification

   | Attribute | Verified Value | Compliance / Safety Status |
   | :--- | :--- | :--- |
   | **Active Profile** | `default` / `staging` (`application.yml`) | **Verified non-production**. `application-prod.yml` is inactive. |
   | **Database Host & Port** | `127.0.0.1:5432` (`localhost`) | **Local / Staging PostgreSQL instance**. |
   | **Database Name** | `cake_platform` | **Confirmed local staging database**. |
   | **Active Flyway Version** | **V57** | Installed: `2026-11-02 13:49:55.811701`, Success: `true`. |
   | **Flyway Migration Script** | `V57__add_dietary_flags_to_products.sql` | `add dietary flags to products` applied cleanly. |
   | **Live Listening Services** | Port 8080 (Backend): Idle; Port 3000 (Frontend): Idle | Neither service was running; no processes modified or restarted. |

   ---

   ## 2. Seed Data Integrity Audit

   ### 2.1 Demo Bakeries Verification (Expected: 6 Active)
   A comprehensive query of `shops` verified exactly 6 active demo bakeries and 3 negative boundary test bakeries:

   | ID | Business Name | Area | City | Pincode | Coordinates (Lat, Lng) | Business Type | Status | Flags |
   | :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
   | **1** | **Akurdi Artisan Bakes** | Akurdi | Pimpri-Chinchwad | 411035 | 18.6495, 73.7707 | `HOME_BAKERY` | `ACTIVE` | Enabled: `t`, Restricted: `f`, Deleted: `f` |
   | **2** | **Ravet Cake Studio** | Ravet | Pimpri-Chinchwad | 412101 | 18.6477, 73.7439 | `CAKE_STUDIO` | `ACTIVE` | Enabled: `t`, Restricted: `f`, Deleted: `f` |
   | **3** | **Nigdi Sweet Treats** | Nigdi | Pimpri-Chinchwad | 411044 | 18.6548, 73.7667 | `BAKERY_SHOP` | `ACTIVE` | Enabled: `t`, Restricted: `f`, Deleted: `f` |
   | **4** | **Baner Dessert Boutique** | Baner | Pune | 411045 | 18.5590, 73.7868 | `CAKE_STUDIO` | `ACTIVE` | Enabled: `t`, Restricted: `f`, Deleted: `f` |
   | **5** | **Wakad Cloud Cakes** | Wakad | Pune | 411057 | 18.5987, 73.7684 | `ONLINE_CAKE_BUSINESS` | `ACTIVE` | Enabled: `t`, Restricted: `f`, Deleted: `f` |
   | **6** | **Kothrud Heritage Bakes** | Kothrud | Pune | 411038 | 18.5074, 73.8077 | `BAKERY_SHOP` | `ACTIVE` | Enabled: `t`, Restricted: `f`, Deleted: `f` |
   | **7** | *Pending Baker Akurdi* | Akurdi | Pimpri-Chinchwad | 411035 | 18.6490, 73.7710 | `HOME_BAKERY` | `PENDING` | Boundary check: Excluded from search |
   | **8** | *Inactive Studio Baner* | Baner | Pune | 411045 | 18.5595, 73.7870 | `CAKE_STUDIO` | `INACTIVE` | Boundary check: Excluded from search |
   | **9** | *Suspended Cakes Wakad* | Wakad | Pune | 411057 | 18.5990, 73.7680 | `ONLINE_CAKE_BUSINESS` | `SUSPENDED` | Boundary check: Excluded from search |

   ### 2.2 Signature Products Verification (Expected: 19 Products)
   - **Total Products in Database:** Exactly **19**.
   - **Active & Available:** 19 / 19 (`availability = true`, `status = 'ACTIVE'`).
   - **Deletion Status:** 0 / 19 deleted (`is_deleted = false`).
   - **Dietary Flag Distribution:**
   - `is_eggless = true`: **14** products (73.7%)
   - `is_vegan = true`: **2** products (10.5%)
   - `is_gluten_free = true`: **2** products (10.5%)

   ### 2.3 Reviews & Social Proof Distinction
   - **Total Feedback Records:** Exactly **12** records (2 per active shop).
   - **Distinguishing Seeded vs Genuine Reviews:**
   - All 12 reviews share static seed timestamps (`2026-11-02 15:32:33`), have `order_reference = NULL`, rating = `5`, and standard demo authors (`Pooja Kulkarni` and `Rahul Mehta`).
   - Genuine customer reviews will have an active `order_reference`, distinct creation timestamps, variable ratings (1–5), and optional customer emails.

   ### 2.4 Removal of Test Data & Privacy Audit
   - **387 Test Shops:** Fully removed. `SELECT COUNT(*) FROM shops` = **9** (6 active + 3 test boundary shops).
   - **66 Test Products:** Fully removed. `SELECT COUNT(*) FROM products` = **19** signature seed products.
   - **779 Disposable Accounts:** Fully removed. `SELECT COUNT(*) FROM users` = **11** (2 admins + 9 shop owners).
   - **Privacy & Credential Safety:** No plaintext passwords, JWTs, or customer PII are logged or exposed. All accounts hold BCrypt hashes (`$2a$10$...`).

   ---

   ## 3. Eggless Backfill Audit

   ### 3.1 Migration V57 Analysis
   Inspection of `V57__add_dietary_flags_to_products.sql` reveals:
   ```sql
   UPDATE products
   SET is_eggless = TRUE
   WHERE (allow_egg_choice = TRUE OR egg_preference_default = 'EGGLESS')
   AND is_eggless = FALSE;
   ```
   And in [`ProductService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/service/ProductService.java#L114-L117):
   ```java
   boolean eggless = Boolean.TRUE.equals(request.getIsEggless())
         || Boolean.TRUE.equals(request.getAllowEggChoice())
         || "EGGLESS".equalsIgnoreCase(request.getEggPreferenceDefault());
   ```

   ### 3.2 Finding & Risk Assessment
   - **Semantic / Architectural Gap:** If an owner configures a product where the default recipe is regular (`eggPreferenceDefault = 'REGULAR'`) but provides a customizable eggless option (`allowEggChoice = true`), the code and migration automatically force `is_eggless = true`.
   - **Marketplace Impact:** A customer searching for 100% Eggless cakes could be presented with an egg-based cake whose primary default formulation contains eggs.
   - **Current Database Status:**
   - Affected products in current database: **0**
   - Products with conflicting dietary data: **0** (All 14 eggless products currently have `egg_preference_default = 'EGGLESS'`, and all 5 regular products have `allow_egg_choice = false` and `egg_preference_default = 'REGULAR'`).
   - **Recommended Minimal Correction (Without executing):**
   - In `ProductService.java`, decouple optional egg choice from the base recipe flag:
      ```java
      boolean eggless = Boolean.TRUE.equals(request.getIsEggless())
               || (request.getIsEggless() == null && "EGGLESS".equalsIgnoreCase(request.getEggPreferenceDefault()));
      ```
   - Treat `allow_egg_choice = true` as an order customization capability rather than a recipe formulation flag.

   ---

   ## 4. Dietary Filter API Verification

   Read-only native SQL queries mirroring [`ShopRepository.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopRepository.java) were executed against PostgreSQL `cake_platform`:

   | Query Scenario | Expected Shops | Actual Database Result | Pass/Fail |
   | :--- | :--- | :--- | :---: |
   | **All Active Shops (No Filter)** | 6 shops | All 6 active shops returned (IDs 1–6) | **PASS** |
   | **`EGGLESS` Filter** | Shops with active eggless cakes | All 6 shops returned (each has $\ge 1$ eggless cake) | **PASS** |
   | **`VEGAN` Filter** | Shops with active vegan cakes | Exactly 2 shops: `Baner Dessert Boutique` & `Wakad Cloud Cakes` | **PASS** |
   | **`GLUTEN_FREE` Filter** | Shops with active gluten-free cakes | Exactly 2 shops: `Ravet Cake Studio` & `Baner Dessert Boutique` | **PASS** |
   | **Combined `VEGAN` + `GLUTEN_FREE` (AND)** | Shops with cakes that are BOTH | Exactly 1 shop: `Baner Dessert Boutique` (Mousse Tart) | **PASS** |
   | **Negative Boundary Exclusion** | Exclude PENDING, INACTIVE, SUSPENDED | Shop 7, 8, 9 completely excluded from all discovery queries | **PASS** |
   | **Location Compatibility (City = 'Pune' + VEGAN)** | Pune shops with vegan cakes | Exactly 2 shops: `Baner Dessert Boutique` & `Wakad Cloud Cakes` | **PASS** |
   | **GPS Radius (15 km from Akurdi + EGGLESS)** | Within 15 km with eggless | Exactly 5 shops returned (Kothrud at 16.2 km excluded) | **PASS** |

   ---

   ## 5. Frontend Smoke Test Inspection

   As background services are currently idle (conforming to safety rules), inspection of frontend code and tests was performed:

   1. **Dietary Filters on `/explore`:**
      - [`DietaryFilter.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/DietaryFilter.tsx) provides accessible buttons for `EGGLESS`, `VEGAN`, and `GLUTEN_FREE`.
      - Multi-select toggle updates array state and emits change callback.
   2. **URL Synchronization & Browser Refresh:**
      - [`explore/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/explore/page.tsx) reads `?dietary=...` on initial load and synchronizes state on back/forward browser navigation.
      - Pushes updated query parameters (`?dietary=EGGLESS,VEGAN`) while resetting pagination to page 0.
   3. **Active Filter Ribbon & Clear All:**
      - Active dietary choices render green chips with individual remove `(X)` buttons in the active filter ribbon.
      - "Clear All" in the filter panel or ribbon completely deletes the `dietary` search param.
   4. **Product Dietary Badges & Advisory:**
      - [`ProductCard.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/ProductCard.tsx) displays `🌱 Vegan` and `🌾 Gluten-Free` badges alongside veg/egg options.
      - [`ProductDetailModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/ProductDetailModal.tsx) displays ingredients, allergens, and an explicit disclaimer stating recipe preferences do not guarantee medical cross-contamination protection.
   5. **Owner Controls:**
      - [`ProductModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/owner/ProductModal.tsx) includes checkboxes for Vegan and Gluten-Free recipe attributes.

   ---

   ## 6. Regression Evidence

   | Test Suite / Execution | Type | Tests | Passed | Failed | Status |
   | :--- | :--- | :---: | :---: | :---: | :---: |
   | `marketplaceDietaryDiscovery.test.mjs` | **Newly Executed (Read-Only)** | 6 | 6 | 0 | **PASS** |
   | `CustomerStorefrontDietarySearchTest` | **Newly Executed (Read-Only)** | 7 | 7 | 0 | **PASS** |
   | Full Frontend Suite (`node --test`) | Previously Reported (Phase 2.4) | 300 | 300 | 0 | **PASS** |
   | `CustomerStorefrontDeliveryGeofencingTest` | Previously Reported (Phase 2.4) | 9 | 9 | 0 | **PASS** |
   | `CustomerStorefrontOpenNowAndMapTest` | Previously Reported (Phase 2.4) | 5 | 5 | 0 | **PASS** |
   | `CustomerStorefrontSearchTest` | Previously Reported (Phase 2.4) | 18 | 18 | 0 | **PASS** |
   | TypeScript Typecheck (`tsc --noEmit`) | Previously Reported (Phase 2.4) | Full AST | Valid | 0 errors | **PASS** |
   | E2E Mutation Tests | **Not Executed** (Preserve clean database state) | N/A | N/A | N/A | **SKIPPED** |

   ---

   ## 7. Issues, Risks & Minimal Recommendations

   1. **Eggless Customization Inconsistency (Minor Architectural Condition):**
      - *Condition:* `ProductService.java` treats `allowEggChoice = true` as forcing `isEggless = true`.
      - *Risk:* If an owner introduces an egg-based cake with an optional eggless toggle, the cake will be categorized as eggless in marketplace search.
      - *Recommendation:* Refactor `ProductService.java` to derive `isEggless` strictly from `request.getIsEggless()` or `request.getEggPreferenceDefault() == 'EGGLESS'`.

   2. **Seeded Review Identification (Operational Note):**
      - *Finding:* All 12 seeded feedback entries have `order_reference = NULL`.
      - *Risk:* Analytics queries calculating conversion from orders to reviews will note missing foreign links.
      - *Recommendation:* Maintain `order_reference = NULL` as the signature flag for synthetic demo reviews.

   ---

   ## 8. Final Audit Verdict

   ### **PASS WITH CONDITIONS**

   **Rationale:**  
   The environment is verified local/staging at Flyway schema V57. All 387 test shops, 66 test products, and 779 disposable accounts were cleanly purged. The database is populated with exactly 6 authentic demo bakeries and 19 signature products. Native API dietary queries and AND semantics function as specified. The single condition is the decoupling of `allowEggChoice = true` from `is_eggless = true` in `ProductService.java` prior to commercial production onboarding.

