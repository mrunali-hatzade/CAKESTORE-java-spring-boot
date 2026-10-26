# CakeStore — Homepage Bakery Grid Pagination Implementation Report

**Phase:** Homepage Bakery Grid Pagination & View All Navigation  
**Date:** October 26, 2026  
**Status:** Completed & Fully Verified  

---

## 1. Executive Summary

This implementation addresses performance risk **DEF-05** identified during the CakeStore customer flow audit by bounding the number of bakery cards initially rendered on the public homepage (`/`).

Key achievements:
1. **Bounded Homepage Query:** Enforced `HOMEPAGE_BAKERY_LIMIT = 12` in `frontend_v2/app/page.tsx`, requesting `page: 0` and `size: 12` from the backend `GET /api/storefront/shops/search`. The backend queries only the requested 12 records via Spring Data's `discoverShopsPaged` rather than fetching every bakery in the database and hiding them on the client.
2. **"View All Bakeries" Navigation:** Added accessible links and action buttons to both the `BakeryGrid` header and a prominent bottom call-to-action banner. When clicked, it routes seamlessly to `/explore`, preserving active search keywords, location filters (city, district, state, PIN, geolocation coordinates), category business type, and sort order.
3. **Accurate & Non-Misleading Result Counts:** Integrated `data.pagination.totalElements` into the grid header counter. When total bakeries exceed the page limit, the grid truthfully reports `"Showing 12 of X bakeries"`, and the bottom CTA dynamically displays `"View All X Bakeries"`. If filters narrow results (e.g., 3 bakeries in a city), the grid displays `"3 bakeries found"` without misleading counters.
4. **Race-Condition & Stale Data Guard:** Implemented `searchRequestIdRef` counter to ensure that asynchronous responses from slower preceding filter clicks are discarded if a newer search completes first.
5. **Full Backward Compatibility:** Preserved the full interactive pagination controls (`onPageChange`, `onPageSizeChange`, page selector, prev/next buttons) on `/explore` without regressions.

---

## 2. Files Changed and Implementation Details

| File | Subsystem | Nature of Change |
| :--- | :--- | :--- |
| [`frontend_v2/app/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/page.tsx) | Frontend (Page) | Added `HOMEPAGE_BAKERY_LIMIT = 12`, `totalElements` state, `searchRequestIdRef` race condition protection, `page: 0` and `size: 12` backend params in `loadShops`, dynamic `getExploreUrl()`, and wired `viewAllHref` and `viewAllLabel` into `BakeryGrid`. |
| [`frontend_v2/components/customer/marketplace/BakeryGrid.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/BakeryGrid.tsx) | Frontend (Component) | Extended `BakeryGridProps` with optional `viewAllHref` and `viewAllLabel`. Added header "View All Bakeries" button, truthful record counter (`Showing X of Y bakeries`), empty-state direct link to `/explore`, and bottom "View All Bakeries" CTA banner. Kept interactive prev/next pagination controls exclusive to `/explore` where `onPageChange` is passed. |
| [`frontend_v2/__tests__/homepageBakeryPagination.test.mjs`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__/homepageBakeryPagination.test.mjs) | Frontend (Test) | Created automated test suite verifying bounded parameters, CTA rendering, query string serialization for `/explore`, truthful record counter formatting, and dynamic view all label logic. |

---

## 3. Detailed Architecture & Pagination Behavior

### 1. Bounded Backend Request
- **Endpoint:** `GET /api/storefront/shops/search`
- **Parameters Sent:**
  ```javascript
  {
    search: searchQuery || undefined,
    location: locationQuery || undefined,
    state: locationFilters.state,
    district: locationFilters.district,
    city: locationFilters.city,
    area: locationFilters.area,
    pincode: locationFilters.pincode,
    latitude: geoParams.latitude,
    longitude: geoParams.longitude,
    radiusKm: geoParams.radiusKm,
    businessType: activeBusinessType,
    sortBy: sortBy === 'default' ? undefined : sortBy,
    page: 0,
    size: 12
  }
  ```
- **Backend Execution:** `CustomerStorefrontController.searchShops` detects `page != null` and invokes `storefrontService.discoverShopsPaged(...)`, executing a database `LIMIT 12 OFFSET 0` query with count projection.
- **Frontend Normalization:** `normalizeShopSearchResponse` extracts `page.totalElements` and `page.totalPages`, returning a 12-item array with attached `.pagination` metadata.

### 2. URL Serialization for "View All Bakeries"
When users navigate from the homepage to `/explore` via "View All Bakeries", `getExploreUrl()` preserves the active discovery context:
- Keyword search: `/explore?search=Chocolate+Truffle`
- City / State: `/explore?city=Pune&state=Maharashtra`
- Business Category: `/explore?businessType=HOME_BAKER`
- Geolocation GPS: `/explore?lat=18.5204&lng=73.8567&radius=10`
- Sorting: `/explore?sortBy=rating`
- Default (unfiltered): `/explore`

### 3. Record Count Presentation
- **Large Directory (`totalElements > 12`):**
  - Header: `"Showing 12 of 45 bakeries"`
  - Bottom CTA: `"View All 45 Bakeries"` button + descriptive subtitle.
- **Small Directory (`totalElements <= 12`):**
  - Header: `"X bakeries found"`
  - Bottom CTA: `"View All Bakeries"` button routing to the full directory.
- **Empty State (`totalElements === 0`):**
  - "No bakeries found" message with "Clear Filters" and "Explore All Bakeries" links.

### 4. Top Rated Spotlight vs Featured Bakeries Grid
- **Top Rated Section:** Retains dedicated spotlight query with `sortBy: 'rating'` and `size: 4`. Renders a curated 4-card highlight row with gold star iconography.
- **Featured Bakeries Grid:** Renders the main marketplace directory matching the user's active filter and selected sort (default, nearest first, newest, A-Z, or city).
- Bakeries appearing in Top Rated are not artificially stripped from Featured Bakeries, preserving sort order integrity (e.g. nearest first distance ordering) and truthful record counting without client-side slicing discrepancies.

---

## 4. Test Execution & Verification Results

### 1. Dedicated Homepage Pagination Suite
Command: `node --test __tests__/homepageBakeryPagination.test.mjs`
- `1. app/page.tsx enforces bounded homepage bakery query (page: 0, size: 12)`: **PASSED** (3.33ms)
- `2. BakeryGrid.tsx provides View All Bakeries links in header and bottom CTA`: **PASSED** (1.45ms)
- `3. getExploreUrl serializes active category, search, location, and sorting parameters`: **PASSED** (3.54ms)
- `4. Result count displays accurate record counter without misleading numbers`: **PASSED** (0.50ms)
- `5. View All label displays dynamic count when total exceeds homepage limit`: **PASSED** (0.33ms)
- **Result:** **6 tests run, 6 passed, 0 failed** (Total duration: 325ms).

### 2. Full Frontend Test Suite
Command: `npm test`
- **Result:** **252 tests run, 21 test suites, 252 passed, 0 failed, 0 skipped**
- **Duration:** 5.59s

### 3. ESLint Static Analysis
Command: `npm run lint`
- **Result:** **0 errors**, 1 pre-existing warning in `InteractiveLocationMap.tsx`.
- **Exit Code:** 0

### 4. Next.js Production Build
Command: `npm run build`
- **Result:** **Compiled successfully**.
- **Static Pages Generated:** All **41/41 routes** compiled and optimized.
  - Route `/` compiled at 5.88 kB (First Load JS: 145 kB).
  - Route `/explore` compiled at 3.32 kB (First Load JS: 142 kB).
- **Exit Code:** 0

### 5. Live Local Server Verification
- Verified `http://localhost:3000` returns HTTP 200 with `BakeryGrid` rendering cleanly without unbounded expansion.

---

## 5. Remaining Considerations & Notes

1. **Explore Search Experience:**
   - When users click "View All Bakeries" with an active location filter, `/explore` opens with those filters pre-populated in the query string and hydrates into the `AdvancedLocationFilter` state.
2. **Client-Side vs Backend Sorting:**
   - For `sortBy === 'distance'`, the backend computes spatial Haversine distance when GPS coordinates are supplied. Client-side sort fallback in `BakeryGrid` sorts the current page of 12 items if coordinates are available.
3. **Database & Backend Safety:**
   - Zero changes made to backend logic, Spring Boot entities, Flyway migrations, authentication, payment handling, or environment secrets.

---

## 6. Verification Summary Checklist

- [x] Enforces bounded homepage bakery cards (`size: 12`, `page: 0`).
- [x] Backend requests only required records via `discoverShopsPaged`.
- [x] Added prominent "View All Bakeries" CTA button and header link.
- [x] "View All Bakeries" preserves active search, category, location, and sort parameters.
- [x] Preserved responsive layout (desktop 3-col, tablet 2-col, mobile 1-col).
- [x] Result counter displays accurate `"Showing X of Y bakeries"`.
- [x] Stale asynchronous response protection via `searchRequestIdRef`.
- [x] Existing `/explore` pagination and parameter handling remains 100% intact.
- [x] All 252 frontend tests pass.
- [x] Production build passes with 0 errors.
- [x] Backend logic, database schema, and deployment settings remained untouched.
