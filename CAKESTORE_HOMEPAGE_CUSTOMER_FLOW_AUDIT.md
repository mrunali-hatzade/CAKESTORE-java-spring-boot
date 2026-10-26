# CakeStore — Complete Homepage, Customer Checkout & Order Management Audit

**Audit Type:** Read-Only Comprehensive Audit  
**Date:** October 26, 2026  
**Audited Targets:**
- `frontend_v2` (Next.js 14 App Router, TypeScript, Tailwind CSS)
- `backend` (Spring Boot 3.3.2, Java 17, PostgreSQL, Flyway)
- Running Dev Server: `http://localhost:3000` (PID 5960) & Spring Boot: `http://localhost:8080`
**Screenshots Captured:**
- Desktop Viewport: `desktop_homepage_full_1793002397384.png`
- Filtered State (100% Eggless): `filtered_homepage_1793002455796.png`
- Tablet Viewport (768x1024): `tablet_homepage_1793002493890.png`
- Mobile Viewport (390x844): `mobile_homepage_1793002539827.png`

---

## 1. Executive Summary

This comprehensive audit evaluates the live implementation, visual design, responsiveness, and underlying data integrations of the **CakeStore public homepage (`/`)**, as well as the end-to-end customer flows: **OTP verification & delivery fallback**, **customer order management & cancellation**, and **payment reconciliation with late-payment slot overbooking safety**.

### Overall System Status: **PRODUCTION-READY FOUNDATION WITH SPECIFIC OPERATIONAL DEFECTS**

- **The Public Homepage** is visually rich, fully responsive across desktop, tablet, and mobile, with zero React hydration warnings or JavaScript console errors. Heading hierarchy is semantically sound (H1 to H4), and image optimization is configured with robust fallback handlers.
- **Data Integrations** are authoritative: bakeries, ratings, review counts, and location parameters are queried directly from PostgreSQL through Spring Boot REST endpoints. Inactive, suspended, and deleted bakeries are strictly excluded by database queries.
- **Critical Defect Identified:** Live SMS provider credentials (Twilio) are missing in `application.yml`, causing `SmsService.java` to operate in local mock mode. In any environment where SMS is not delivered, **the customer checkout modal permanently blocks order placement and payment** because no fallback (Email OTP) is provided.
- **Architectural Strength Confirmed:** Late payment on cancelled orders **strictly prevents delivery slot overbooking**. Both `CustomerPaymentController.java` and `WebhookController.java` retain `CANCELLED` status when payment arrives for a cancelled order, record the money in the ledger, and dispatch high-priority alerts to owner, admin, and customer for manual fulfillment or refund.

---

## 2. Part A — Complete Homepage Audit

### 2.1 Exact Section Inventory in Display Order

Below is the verified, exact inventory of every section rendered on `http://localhost:3000/` in its actual display order:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Header & Navigation Bar (Navbar.tsx)                                │
│    - Brand Logo & Network Subtitle ("CakeStore - Artisanal Network")   │
│    - Desktop Links: Home, Explore, How It Works, Owners, Pricing, Info │
│    - Customer Action: "Track Order" button (opens Lookup Modal)        │
│    - Seller Actions: "Owner Login", "Register Bakery" CTA buttons      │
│    - Mobile Menu Hamburger Toggle & Slide-Out Drawer                   │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Hero Section (HeroSection.tsx)                                      │
│    - Subtitle Pill: "Discover Local Home Bakers & Artisanal Studios"   │
│    - H1: "Celebrations Begin with Exceptional Cakes"                   │
│    - Tagline & Description                                             │
│    - SearchBar: Search Keyword + City/Area Input + "Find Bakeries"     │
│    - Quick Popular Cities Bar (fetched dynamically from API)           │
│    - Category Filter Pills: All, Home Bakers, Studios, Eggless, etc.   │
│    - Quality Guarantees: FSSAI Certified, 100% Handcrafted, Direct     │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Advanced Multi-Tier Location Filter (AdvancedLocationFilter.tsx)   │
│    - Cascading Dropdowns: State/UT -> District -> City -> Area -> PIN  │
│    - Geolocation Mode: "Use My GPS" with Radius Selector (5-50 km)     │
│    - Active Scope Badge & "Reset" Location Filter Button               │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Top Rated Bakeries Section (TopRatedSection.tsx)                    │
│    - Section H2 with Star Icon: "Top Rated Bakeries"                   │
│    - 4-Column Responsive Grid of Bakery Cards sorted by rating         │
│    - Displays ratings, review counts, verified badge, visit links      │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Featured Artisanal Bakeries Grid (BakeryGrid.tsx)                   │
│    - Section H2: Dynamic Title (e.g. "Featured Artisanal Bakeries")    │
│    - Subtitle: Dynamic based on location scope                         │
│    - Header Controls: Result Count + Sort By Dropdown (Rating, Dist)   │
│    - Responsive Card Grid (3-column desktop, 2-col tablet, 1-col mob) │
├────────────────────────────────────────────────────────────────────────┤
│ 6. Bespoke Custom Cake Studio Bridge (BespokeCakeBridge.tsx)           │
│    - Designer Cake Studio Callout Banner with soft gradient styling    │
│    - 3 Features: Any Theme/Photo, Direct WhatsApp Quote, Advance Slot  │
│    - 3-Step "How Bespoke Works" Visual Workflow Card                   │
│    - Action CTAs: "Browse Custom Studios", "How Custom Orders Work"    │
├────────────────────────────────────────────────────────────────────────┤
│ 7. Trust Badges & Safety Guarantees (TrustBadges.tsx)                  │
│    - Section H2: "Why Order Through CakeStore?"                        │
│    - 4 Feature Cards: FSSAI Verified, Artisanal Small-Batch, Dedicated │
│      Delivery Slots, Custom Cake Capabilities                          │
├────────────────────────────────────────────────────────────────────────┤
│ 8. Bakery Owner Call-to-Action Banner (OwnerCTA.tsx)                   │
│    - Brand Plum Banner: "Scale Your Bakery with an Independent Store"  │
│    - 4 Benefits: Zero upfront fees, Independent branding, Slots, etc.  │
│    - Action CTAs: "Register Your Bakery" (Onboarding), "Owner Sign In" │
├────────────────────────────────────────────────────────────────────────┤
│ 9. Platform Footer (Footer.tsx)                                        │
│    - Upper Quality Bar (FSSAI, Fresh to Order, Direct Relationships)   │
│    - 4 Column Links: Brand Info, Explore Bakeries, Owners, Support     │
│    - Bottom Bar: Copyright notice, Handmade with love tagline          │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Interactive Elements Checklist & Verification Results

Every visible interactive element on the homepage was audited and verified in the live browser:

| Element Label | Section | Expected Behavior | Actual Behavior Observed | Destination / API | Result |
|---|---|---|---|---|---|
| **CakeStore Logo** | Header | Navigate to Homepage root | Navigates to `/` smoothly | `/` | **PASS** |
| **Home** | Header Nav | Navigate to Homepage root | Navigates to `/` (active indicator displayed) | `/` | **PASS** |
| **Explore Bakeries** | Header Nav | Open Marketplace Explorer | Navigates to `/explore` | `/explore` | **PASS** |
| **How It Works** | Header Nav | Open Customer Guide Page | Navigates to `/how-it-works` | `/how-it-works` | **PASS** |
| **For Owners** | Header Nav | Open Bakery Owner Marketing | Navigates to `/for-owners` | `/for-owners` | **PASS** |
| **Pricing** | Header Nav | Open Subscription Pricing | Navigates to `/pricing` | `/pricing` | **PASS** |
| **Contact Us** | Header Nav | Open Platform Contact Form | Navigates to `/contact` | `/contact` | **PASS** |
| **Track Order** | Header Nav | Open Order Lookup Modal | Modal pops up with phone/order inputs | Client Modal | **PASS** |
| **Owner Login** | Header Nav | Open Owner Login Screen | Navigates to `/login` | `/login` | **PASS** |
| **Register Bakery** | Header Nav | Open Owner Onboarding Wizard | Navigates to `/onboarding` | `/onboarding` | **PASS** |
| **Mobile Hamburger** | Header (Mobile) | Toggle mobile navigation drawer | Drawer opens smoothly with all links | Client Drawer | **PASS** |
| **Search Input** | Hero | Accept search query text | Accepts text, updates `searchQuery` state | Local State | **PASS** |
| **Location Input** | Hero | Accept city / neighborhood text | Accepts text, updates `locationQuery` | Local State | **PASS** |
| **Find Bakeries** | Hero | Execute bakery search query | Triggers `searchShops` API and refreshes grid | `GET /api/storefront/shops/search` | **PASS** |
| **Popular City Chips** | Hero | Select popular Indian city | Updates location filter and re-queries grid | `GET /api/storefront/shops/search?city=...` | **PASS** |
| **Category Pill: All** | Hero | Show all bakery categories | Clears category filter, queries all | Local State | **PASS** |
| **Category Pill: 100% Eggless** | Hero | Filter exclusively for eggless | Pill turns plum, title updates to "EGGLESS Bakeries Across India" | Local State / API | **PASS** |
| **Category: Home Bakers** | Hero | Filter for `HOME_BAKERS` | Updates query and filters card results | `?businessType=HOME_BAKERS` | **PASS** |
| **Category: Custom Studios** | Hero | Filter for `CUSTOM_STUDIOS` | Updates query and filters card results | `?businessType=CUSTOM_STUDIOS` | **PASS** |
| **State / UT Dropdown** | Location Filter | Select Indian State/UT | Cascades: enables District dropdown | `GET /api/location/districts` | **PASS** |
| **District Dropdown** | Location Filter | Select District in State | Cascades: enables City dropdown | `GET /api/location/cities` | **PASS** |
| **City Dropdown** | Location Filter | Select City in District | Cascades: enables Locality dropdown | `GET /api/location/localities` | **PASS** |
| **Use My GPS** | Location Filter | Request browser GPS position | Switches to Mode B with radius slider | Browser Geolocation API | **PASS** |
| **Reset Location** | Location Filter | Clear location filters | Reverts to "All Locations" | Local State | **PASS** |
| **Sort By Dropdown** | BakeryGrid | Sort by Rating, Distance, etc. | Re-queries backend with selected sort order | `GET /api/storefront/shops/search?sortBy=...` | **PASS** |
| **Visit Storefront** | Bakery Card | Navigate to individual bakery | Navigates to `/shop/{id}` | `/shop/{id}` | **PASS** |
| **Directions (Map Pin)** | Bakery Card | Open Google Maps directions | Opens Google Maps with coordinates | `https://www.google.com/maps/dir/...` | **PASS** |
| **Browse Custom Studios** | Bespoke Bridge | Explore bespoke studios | Navigates to `/explore?businessType=CAKE_STUDIO` | `/explore?businessType=CAKE_STUDIO` | **PASS** |
| **How Custom Orders Work** | Bespoke Bridge | Open custom cake workflow guide | Navigates to `/how-it-works` | `/how-it-works` | **PASS** |
| **Register Bakery (CTA)** | Owner CTA | Open bakery registration | Navigates to `/onboarding` | `/onboarding` | **PASS** |
| **Existing Owner Sign In** | Owner CTA | Open bakery login | Navigates to `/login` | `/login` | **PASS** |
| **Footer Explore Links** | Footer | Navigate to directory routes | Navigates to `/explore`, `/how-it-works` | Directory Routes | **PASS** |
| **Footer Owner Links** | Footer | Navigate to owner routes | Navigates to `/for-owners`, `/pricing`, `/onboarding` | Owner Routes | **PASS** |
| **Terms of Service Link** | Footer | Display platform Terms of Service | **MISSING**: No link or page exists in footer | N/A | **FAIL** |
| **Privacy Policy Link** | Footer | Display platform Privacy Policy | **MISSING**: No link or page exists in footer | N/A | **FAIL** |
| **Refund Policy Link** | Footer | Display customer Refund Policy | **MISSING**: No link or page exists in footer | N/A | **FAIL** |

---

### 2.3 Visual Design and Responsiveness

1. **Desktop Viewport (1366px – 1920px):**
   - Renders a balanced 12-column layout with max-width container `max-w-7xl` (1280px).
   - Hero background image (`/marketplace-hero-bakers.jpg`) uses a gentle cream gradient overlay to ensure H1 typography maintains high contrast.
   - Header sticky positioning (`sticky top-0 z-30`) with `backdrop-blur-md` and subtle border transition.
   - Bakery grids display in 3 columns (`BakeryGrid`) and 4 columns (`TopRatedSection`).
   - Zero horizontal overflow (`window.innerWidth === document.documentElement.clientWidth`).

2. **Tablet Viewport (768px – 1024px):**
   - Navigation links collapse cleanly into a single mobile hamburger icon (`lg:hidden`).
   - Hero search bar maintains full width, search and location inputs wrap into a 2-tier input group.
   - Multi-tier location filter adapts into a 2-column grid.
   - Bakery card grids adjust to 2 columns (`sm:grid-cols-2`).
   - Cards maintain uniform aspect ratios (`aspect-[16/9]`) and card heights.

3. **Mobile Viewport (390px – 640px):**
   - Header shows Brand Logo, Basket trigger (if cart > 0), and hamburger menu button.
   - Tapping hamburger menu triggers a dedicated full-width drawer with:
     - Prominent "Track Your Cake Order" card
     - 6 primary navigation links with active state indicator
     - Full-width "Register Bakery" and "Owner Login" action buttons
   - Hero H1 scales smoothly down to `text-4xl` (36px).
   - Category pills convert to a horizontal touch scroll with hidden scrollbars.
   - All bakery cards stack into a single vertical column (`grid-cols-1`). Touch targets for buttons are 44px or larger.

---

### 2.4 Data & Integration Audit

1. **Authoritative Backend Data Fetching:**
   - Homepage calls `storefrontApi.searchShops(...)` at `GET /api/storefront/shops/search`.
   - Backend [`CustomerStorefrontService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java#L283-L383) executes native PostgreSQL queries via `ShopRepository.java`.
   - **Inactive & Suspended Shop Exclusion:** The query strictly enforces:
     ```sql
     WHERE s.status = 'ACTIVE' AND s.is_deleted = false
       AND COALESCE(s.is_owner_enabled, true) = true
       AND COALESCE(s.is_marketplace_restricted, false) = false
     ```
     Shops in pending review, vacation mode, or administrative suspension **never appear on the public homepage**.
2. **Dynamic Ratings and Reviews:**
   - Ratings are not hardcoded. The SQL query calculates `ROUND(CAST(AVG(f.rating) AS numeric), 1)` and `COUNT(f.id)` joined dynamically on approved customer feedback (`feedback f WHERE f.is_approved = true`).
3. **Database Test Artifact Contamination Finding:**
   - When running backend automated regression tests (`DelayedPaymentConfirmationRegressionTest`), the test suite created bakeries named `"Regression Bakery"` directly in the local PostgreSQL database with `status = 'ACTIVE'`.
   - Because these test bakeries had null addresses/cities, the homepage cards displayed empty location markers (`📍 , `).
   - *Audit Recommendation:* Automated tests should run against an isolated test profile or execute transactional rollbacks (`@Transactional`) to prevent test fixtures from contaminating the development directory.
4. **Missing Pagination on Homepage Grid:**
   - Unlike the `/explore` page which supports pagination and page-size selection, [`app/page.tsx:202`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/page.tsx#L202) calls `<BakeryGrid>` without pagination parameters.
   - As a result, all shops returned by `loadShops` are rendered in a single unpaginated vertical list.

---

### 2.5 Performance & SEO Audit

1. **Heading Structure:**
   - `<h1>`: 1 (Only "Celebrations Begin with Exceptional Cakes") — **PASS**
   - `<h2>`: Top Rated Bakeries, Featured Bakeries, Bespoke Studio, Trust Badges, Owner CTA — **PASS**
   - `<h3>`: Bakery card business names, Trust badge titles — **PASS**
   - `<h4>`: Footer category headers — **PASS**
   - No skipped heading levels detected.
2. **Metadata & OpenGraph Deficiencies:**
   - [`app/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/layout.tsx#L9-L12) provides basic title and description:
     ```typescript
     title: 'CakeStore — Artisanal Bakery SaaS Platform',
     description: 'Discover handcrafted artisanal cakes from top local bakeries or manage your bakery business seamlessly.',
     ```
   - **Missing SEO Elements:**
     - No canonical URL link (`<link rel="canonical" ... />`).
     - No OpenGraph metadata (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`).
     - No Twitter card metadata (`twitter:card`, `twitter:image`).
     - No Schema.org JSON-LD structured data (`LocalBusiness` / `Bakery` / `Organization`).
3. **Runtime Performance & Console:**
   - Zero React hydration mismatch errors.
   - Zero uncaught JavaScript exceptions or runtime errors.
   - Next.js `<Image />` component optimizes image formats (WebP) with responsive `sizes` attribute.
   - Hero banner uses Next.js `priority` attribute for fast Largest Contentful Paint (LCP).

---

## 3. Part B — Customer OTP Verification & Fallback Audit

### 3.1 Verification Flow & Lifecycle
1. **Trigger:** In [`StorefrontCheckoutTab.tsx:492`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/storefront/tabs/StorefrontCheckoutTab.tsx#L492), when an unauthenticated customer initiates checkout, order placement pauses and triggers `customerAuth.requestOtp(cleanPhone)`.
2. **Endpoints:**
   - `POST /api/customer/storefront/tracking/request-otp` ([`GuestTrackingController.java:24`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/GuestTrackingController.java#L24))
   - `POST /api/customer/storefront/tracking/verify-otp` ([`GuestTrackingController.java:33`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/GuestTrackingController.java#L33))
3. **Service Logic ([`GuestOtpService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/GuestOtpService.java)):**
   - Generates a 6-digit numeric OTP using `SecureRandom`.
   - Hashes the OTP using BCrypt (`PasswordEncoder.encode`) into the `otp_verifications` table.
   - Enforces a **10-minute expiry** (`OTP_EXPIRY_MINUTES = 10`).
   - Enforces a **60-second resend cooldown** (`RESEND_COOLDOWN_SECONDS = 60`).
   - Enforces a **maximum of 3 verification attempts** (`MAX_ATTEMPTS = 3`).
   - Normalizes mobile numbers using [`AuthService.normalizeIndianMobile`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/service/AuthService.java#L129).
   - On verification success, provisions or hydrates a `ROLE_CUSTOMER` user in PostgreSQL and issues a session JWT.
4. **Rate Limiting:**
   - [`RateLimitingFilter.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/RateLimitingFilter.java#L58) restricts OTP requests to **10 requests per minute per IP** via Bucket4j.

### 3.2 Provider Status & Critical Blocker Analysis
- **Twilio SMS:** [`SmsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java#L37) operates in **mock mode** (`Mock SMS (Local Dev)`). Twilio credentials are unset in `application.yml`.
- **Fast2SMS / MSG91:** **NOT IMPLEMENTED**. Mentioned only as recommendations in older reports; zero code exists.
- **WhatsApp OTP:** **NOT IMPLEMENTED**.
- **Email OTP Fallback:** **NOT IMPLEMENTED**.
- **Critical Checkout Defect:** If the customer cannot read server terminal logs (e.g. real mobile device in staging/production), they never receive the OTP. Because `StorefrontCheckoutTab.tsx` requires OTP verification before executing order placement, **the customer is permanently blocked from placing the order**.

---

## 4. Part C — Customer Order Cancellation Audit

### 4.1 Order Cancellation Rules & Capabilities
1. **Customer Self-Service Cancellation:** **MISSING**. Once an order is placed (`NEW`, `CONFIRMED`, `PREPARING`), the customer has **no cancellation button or grace window** on [`orders/[orderNumber]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/orders/%5BorderNumber%5D/page.tsx). They must contact the bakery by phone or WhatsApp.
2. **Pre-Completion Checkout Cancellation:** **IMPLEMENTED**. If a customer closes the Razorpay payment window, the frontend calls `POST /api/storefront/orders/{orderNumber}/cancel-payment` ([`CustomerPaymentController.java:273`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L273)), marking the order `CANCELLED` and `FAILED`.
3. **Bakery Owner Cancellation:** **IMPLEMENTED**. Bakery owners can transition orders to `CANCELLED` via `PATCH /api/owner/orders/{id}/status` ([`OwnerOrderController.java:48`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java#L48)). Cancelling an order automatically resets custom cake requests to `REVIEWED` and dispatches customer notifications.
4. **Delivery Slot Release:** **IMPLEMENTED AND TESTED**. In [`OrderRepository.java:240`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/OrderRepository.java#L240), `countActiveOrdersForSlotAndDate` counts only `CAPACITY_CONSUMING_STATUSES`. Because `CANCELLED` is excluded, cancelling an order **immediately restores delivery slot capacity**.
5. **Cross-Customer Order Isolation:** **IMPLEMENTED AND TESTED**.
   - `GET /api/customer/storefront/tracking/orders` requires a valid customer JWT matching the phone number.
   - `GET /api/storefront/shops/orders/{orderNumber}` requires matching authenticated phone or `trackPhone` query parameter (returns `404 Not Found` on mismatch to prevent enumeration).
   - **Vulnerability:** `POST /api/storefront/orders/{orderNumber}/cancel-payment` currently lacks caller verification, allowing anyone with an in-flight `orderNumber` to cancel it before payment completion.

---

## 5. Part D — Payment Reconciliation & Late Payments Audit

### 5.1 Late Payments on Cancelled Orders: Delivery Slot Overbooking Analysis
- **Core Investigation Question:** *If an order is cancelled and its delivery slot released, can a delayed Razorpay callback or webhook reactivate the order to `CONFIRMED` and cause a double-booked delivery slot?*
- **Audit Determination:** **THE ARCHITECTURE FULLY PREVENTS THIS OVERBOOKING RISK.**
- Explicit guards exist in both [`CustomerPaymentController.java:228`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java#L228) and [`WebhookController.java:188`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java#L188):
  ```java
  boolean wasCancelled = "CANCELLED".equalsIgnoreCase(order.getOrderStatus());
  order.setPaymentStatus("PAID");
  order.setTransactionId(transactionId);
  order.setPaidAt(LocalDateTime.now());

  if (!wasCancelled) {
      if ("NEW".equalsIgnoreCase(order.getOrderStatus()) || "PAYMENT_PENDING".equalsIgnoreCase(order.getOrderStatus())) {
          order.setOrderStatus("CONFIRMED");
      }
  } else {
      // Retain CANCELLED status! Never automatically change to CONFIRMED.
      log.warn("Payment captured for previously CANCELLED order {}. Retaining CANCELLED status to prevent slot overbooking. Flagged for reconciliation.", order.getOrderNumber());
  }
  ```
- **Execution Details on Late Payment Arrival:**
  1. The order status **strictly remains `CANCELLED`**.
  2. The released delivery slot remains safe and available for other customers.
  3. The money is recorded in the accounting ledger (`paymentStatus = "PAID"` and `Payment.status = "COMPLETED"`).
  4. The bakery owner receives an immediate high-priority notification: `"Action Required: Payment Received on Cancelled Order... Delivery slot was not preserved. Please review order in your dashboard to fulfill or refund."`
  5. The platform administrator receives a notification under category `PAYMENTS`.
  6. The customer receives transactional email and SMS stating that payment was captured after session cancellation and that the bakery is reviewing fulfillment or refund options.
  7. The bakery owner's dashboard highlights the order under the `REFUND_DUE` query filter.

### 5.2 Razorpay Signatures, Webhooks & Polling Reconciliation
- **HMAC Signatures:** Verified against raw body payload using HMAC-SHA256. Webhook processing rejects placeholder secrets with HTTP 500.
- **Event Deduplication:** Evaluates `X-Razorpay-Event-Id` header against the `webhook_events` table; duplicate events return `200 OK` idempotently.
- **Automated Gateway Refunds:** **MISSING**. No Razorpay refund API call exists; bakery owners record refunds manually via `PATCH /api/owner/orders/{id}/payment-status`.
- **Background Reconciliation Poller:** **MISSING**. Schedulers only monitor local database timestamps; no background job queries the Razorpay API for dropped callbacks.

---

## 6. Relevant Files, Endpoints, and Executed Tests

### 6.1 Key Files & Endpoints

| Domain | File Path | Method / Component | Endpoint |
|---|---|---|---|
| **Homepage Root** | [`app/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/page.tsx) | `HomePage` | `GET /` |
| **Navbar** | [`Navbar.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/common/Navbar.tsx) | `Navbar` | Header & Drawer UI |
| **Hero & Search** | [`HeroSection.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/HeroSection.tsx) | `HeroSection` | Hero UI |
| **Location Filter**| [`AdvancedLocationFilter.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/AdvancedLocationFilter.tsx) | `AdvancedLocationFilter` | `GET /api/location/*` |
| **Bakery Grid** | [`BakeryGrid.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/customer/marketplace/BakeryGrid.tsx) | `BakeryGrid` | Grid UI |
| **Shop Search API**| [`CustomerStorefrontController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java) | `searchShops()` | `GET /api/storefront/shops/search` |
| **OTP Auth API** | [`GuestTrackingController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/GuestTrackingController.java) | `requestOtp()`, `verifyOtp()` | `POST /api/customer/storefront/tracking/request-otp`<br>`POST /api/customer/storefront/tracking/verify-otp` |
| **Payment Webhook**| [`WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java) | `handleRazorpayWebhook()` | `POST /api/webhooks/razorpay` |
| **Cancel Payment** | [`CustomerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/CustomerPaymentController.java) | `cancelCustomerPayment()` | `POST /api/storefront/orders/{orderNumber}/cancel-payment` |

### 6.2 Executed Automated Tests (All Passed)

All 271 automated tests across backend and frontend were actively executed during this audit session:

- **Backend Test Suites (35 tests, 0 failures):**
  - `GuestTrackingTest` (7 tests): Passed in 0.456s
  - `CustomerAccountHydrationTest` (2 tests): Passed in 4.720s
  - `OtpRateLimitSecurityTest` (2 tests): Passed in 0.233s
  - `DelayedPaymentConfirmationRegressionTest` (10 tests): Passed in 34.2s
  - `CustomerPaymentControllerTest` (14 tests): Passed in 11.78s
- **Frontend Test Suites (236 tests, 21 suites, 0 failures):**
  - Node test suite executed via `npm test`: Passed in 4.84s

---

## 7. Prioritized Defect & Risk Register

| Risk ID | Severity | Category | Defect / Vulnerability Description | Recommended Remediation |
|---|---|---|---|---|
| **DEF-01** | **CRITICAL** | Checkout | **Missing SMS Credentials Blocks Checkout:** Without Twilio SMS delivery or an Email OTP fallback, real customer checkouts cannot receive OTP and are permanently blocked. | Implement Email OTP dispatch fallback via `EmailService.java`. |
| **DEF-02** | **HIGH** | Security | **Unauthenticated Cancel-Payment:** `POST /api/storefront/orders/{orderNumber}/cancel-payment` does not check caller phone, allowing unauthorized checkout cancellation. | Require phone match in request payload or customer JWT. |
| **DEF-03** | **MEDIUM** | Compliance | **Missing Legal & Policy Links:** Footer lacks links to Terms of Service, Privacy Policy, and Refund Policy. | Add `/terms`, `/privacy`, and `/refund-policy` routes and footer links. |
| **DEF-04** | **MEDIUM** | Operations | **Missing Gateway Refund Automation:** Refunds on cancelled orders require manual offline settlement; no 1-click Razorpay refund API exists. | Integrate Razorpay Refund API endpoint for owner/admin. |
| **DEF-05** | **MEDIUM** | Performance | **Unpaginated Homepage Bakery Grid:** `app/page.tsx` renders all discovered bakeries without limit, risking performance degradation as directory grows. | Add `size: 12` default limit with a "View All Bakeries" link to `/explore`. |
| **DEF-06** | **LOW** | SEO | **Missing OpenGraph & Canonical Tags:** `layout.tsx` lacks `og:image`, canonical tags, and JSON-LD structured data. | Add standard OpenGraph and LocalBusiness schema markup. |

---

## 8. Prioritized List of Genuinely Unfinished Features

1. **Email OTP Verification Fallback:** Allow customers to receive verification codes via email when SMS is unavailable.
2. **Payment Cancellation Authorization Check:** Validate caller phone ownership before allowing checkout payment cancellation.
3. **Legal Compliance Pages:** Implement `/terms`, `/privacy`, and `/refund-policy` pages and link them in `Footer.tsx`.
4. **Customer Post-Placement Order Cancellation:** Add an optional self-service cancellation grace period (5–15 mins) on `orders/[orderNumber]/page.tsx` before bakery acceptance.
5. **Automated Razorpay Refund API Integration:** Provide a 1-click refund trigger in the owner order details modal.
6. **Active Razorpay Polling Reconciliation Scheduler:** Poll Razorpay API for abandoned or dropped `PAYMENT_PENDING` orders.

---

## 9. Recommended Next Implementation Task & Acceptance Criteria

### Single Safest Next Task: Email OTP Fallback & Payment Cancellation Authorization Guard

**Rationale:** Resolves the single **CRITICAL** defect blocking real customer checkouts and closes the **HIGH** authorization loophole, without requiring paid SMS provider credits or Indian DLT registration.

### Acceptance Criteria:
1. Update `GuestOtpService.requestOtp` to accept optional `customerEmail` (or query recent customer email) and dispatch the 6-digit OTP code to both `SmsService` and `EmailService`.
2. Update the checkout modal in `StorefrontCheckoutTab.tsx` to display: *"We've sent a 6-digit verification code to your mobile and email."*
3. Update `POST /api/storefront/orders/{orderNumber}/cancel-payment` to verify that the caller's phone (via customer JWT or payload `phone`) matches `order.customerPhone`.
4. Add focused unit tests verifying email OTP dispatch and phone authorization rejection on mismatch.
5. Confirm all 271 existing automated tests continue to pass with zero regressions.
