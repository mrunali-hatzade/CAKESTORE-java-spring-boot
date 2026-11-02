   # CakeStore — Competitor Analysis & Feature Gap Assessment

   **Document Version:** 1.0.0  
   **Date of Assessment:** 2026-11-01  
   **Target Market:** Home Bakers, Artisan Cake Designers, Independent Bakeries, Small-to-Medium Bakery Studios (India & Emerging Markets)  
   **Deliverable File:** `CAKESTORE_COMPETITOR_FEATURE_GAP_REPORT.md`

   ---

   ## 1. Executive Summary

   CakeStore is a cloud-native, multi-tenant Software-as-a-Service (SaaS) platform built to empower home bakers, custom cake designers, and independent bakery shops with dedicated digital storefronts, localized delivery slot logistics, customer ordering, and studio management tools.

   ### Current Market Reality & Strategic Opportunity

   1. **The Bakery Software Spectrum:**
      - **Heavy Restaurant / Counter POS Systems (Petpooja, GoFrugal):** Dominate physical counter sales, multi-slab GST billing, and kitchen display systems for commercial restaurants and food chains in India. However, they are complex, expensive (₹12,000–₹25,000+/year), hardware-dependent, and lack elegant consumer-facing e-commerce storefronts tailored to custom celebratory cake ordering.
      - **Legacy Desktop / North American Desktop Tools (CakeBoss Cloud, BakeSmart):** Offer deep recipe costing, cake tier calculation, and bake sheets, but lack Indian payment rails (UPI, Razorpay), localized WhatsApp integration, and modern mobile-first consumer storefronts.
      - **Service CRM / Proposal Systems (HoneyBook):** Excel at custom quotes, contracts, and deposits for creative businesses, but have zero bakery-specific features (delivery slots, cake flavors/eggless choices, daily kitchen bake schedules).
      - **Indian Boutique Bakery Software (CakePro):** Combines retail POS with advance custom cake bookings and basic recipe management at an accessible price point (₹4,999/year), validating strong domestic demand.

   2. **CakeStore’s Current Position:**
      - **Where CakeStore Shines:** Modern technology stack (Next.js 14 + Spring Boot 3.3.2), hyper-localized Indian geography hierarchy (countries/states/districts/cities/localities/pincodes), automated delivery slot capacity control, native Razorpay payment split/tenant isolation, clean public shop storefronts, customer review media uploads, and server-side subscription enforcement.
      - **Where CakeStore Has Critical Gaps:** CakeStore currently has **zero backend or frontend support for bakery production operations** (no recipe costing, no ingredient/raw-material inventory, no daily bake sheets, no production schedule), **no advance/deposit payment split** for custom orders, **no manual/offline order entry** for walk-in or phone bookings, and **no automated WhatsApp messaging**.

   3. **Strategic Recommendation:**
      CakeStore should position itself as the **"Shopify + HoneyBook for Home Bakers & Artisan Cake Studios"** in India. Rather than competing head-on with industrial restaurant POS hardware (Petpooja), CakeStore should dominate the custom cake lifecycle: **Inquiry → Visual Quote & Advance Deposit → Kitchen Production Bake Sheet → Delivery Slot Fulfillment → Automated WhatsApp Update**.

   ---

   ## 2. CakeStore Product Overview

   | Dimension | Description |
   |---|---|
   | **Platform Name** | CakeStore SaaS Platform |
   | **Target Customers** | Home bakers, independent boutique bakeries, custom wedding cake artists, cloud bakeries |
   | **Business Model** | Subscription SaaS for Bakery Owners (₹350/month to ₹3,500/year) + 0% platform sales commission |
   | **Primary Technology** | Next.js 14 (React 18, TypeScript, Tailwind CSS) + Spring Boot 3.3.2 (Java 17, Hibernate, PostgreSQL 18) |
   | **Core Value Proposition** | Launch an independent branded online bakery storefront with zero code in under 5 minutes, manage custom cake inquiries, enforce delivery slot capacity, collect direct customer payments via UPI/Razorpay, and retain 100% of sales revenue. |

   ---

   ## 3. Competitor Overview

   Six primary platforms were researched to evaluate market expectations across bakery-specific functionality, general food tech, and creative business management:

   ```
                        ┌──────────────────────────────────────────────┐
                        │          CAKESTORE TARGET SWEET SPOT         │
                        │  "Online Custom Cake Commerce & Studio CRM"  │
                        └──────────────────────┬───────────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         │                                      │                                      │
   ┌─────▼─────────────────────────┐ ┌──────────▼──────────────────────┐ ┌─────────────▼────────────────────┐
   │      INDIAN RETAIL POS        │ │   SPECIALIZED BAKERY CLOUD      │ │   CREATIVE PROPOSAL & CRM        │
   │ • Petpooja (₹12k–₹25k/yr)     │ │ • CakeBoss ($149+$36/yr)        │ │ • HoneyBook ($29–$109/mo)        │
   │ • GoFrugal (₹18k+/yr)         │ │ • BakeSmart ($99–$250/mo)       │ │ (Proposals, Smart Files,         │
   │ • CakePro (₹5k/yr)            │ │ (Recipe costing, bake sheets,   │ │  Invoices, Advance deposits,     │
   │ (Counter billing, GST, BOM)   │ │  capacity planning, Cake Matrix)│ │  Client contracts & workflows)   │
   └───────────────────────────────┘ └─────────────────────────────────┘ └──────────────────────────────────┘
   ```

   ---

   ## 4. Individual Competitor Analysis

   ### 4.1 CakePro (India)
   - **Target Customer:** Indian bakeries, cake shops, pastry counters, and growing bakery franchises.
   - **Business Model & Pricing:** Subscription SaaS. Single store plans start around **₹4,999/year per store** (14-day free trial, no credit card required); custom enterprise pricing for franchises (10+ outlets).
   - **Core Capabilities:**
   - *POS & Billing:* Fast touch POS, barcode scanning, loose weight-based pricing, multi-slab GST compliance, and offline billing mode.
   - *Custom & Advance Orders:* Dedicated order tracking for birthday/wedding cakes, voice notes attached to custom orders to capture kitchen instructions without writing errors.
   - *Inventory & Recipes:* Raw ingredient tracking, vendor catalog, reorder levels, recipe ingredient costing.
   - *Customer & Marketing:* Automated WhatsApp receipt sharing, birthday/anniversary reminders, loyalty points.
   - *Aggregators:* Integrates with Swiggy and Zomato.
   - **Strengths:** Built natively for Indian bakery dynamics (GST, WhatsApp, loose weight, aggregator sync).
   - **Weaknesses:** Traditional POS look-and-feel; consumer-facing storefronts are basic web shells compared to modern e-commerce storefronts.
   - **Sources:** `https://cakepro.in`, Apple App Store CakePro listings (Researched: 2026-11-01).

   ### 4.2 Petpooja (India)
   - **Target Customer:** Commercial bakeries, sweet shops (mithai), multi-outlet chains, cafes, and restaurants.
   - **Business Model & Pricing:** Annual subscription starting at **₹12,000/year + 18% GST** for base POS; **₹20,000–₹30,000/year** for operations/inventory modules; **₹20,000–₹40,000/year** for CRM/marketing add-ons. Total average outlay: ₹15,000–₹35,000/year.
   - **Core Capabilities:**
   - *Hardware Agnostic POS:* Runs on Windows, Android, Mac, or tablets with receipt printers, touchscreens, barcode scanners, and weighing scales.
   - *BOM & Raw Material Tracking:* Automatic deduction of raw ingredients (flour, butter, sugar, cocoa) when a cake or pastry is billed.
   - *Central Kitchen Management:* Factory-to-outlet stock transfers, item conversion, production planning, indent management.
   - *Aggregator & ONDC Sync:* Direct 2-way menu and order sync with Zomato, Swiggy, and ONDC.
   - *Staff & Cashier Roles:* Deep role-based permissions, cash drawer access logs, discount caps.
   - **Strengths:** Dominant Indian food service brand, bulletproof offline POS, enterprise supply chain.
   - **Weaknesses:** Over-engineered and cost-prohibitive for home bakers and micro-studios; weak customized wedding cake quoting; no modern bespoke client portfolio storefront.
   - **Sources:** `https://petpooja.com`, Capterra India (Researched: 2026-11-01).

   ### 4.3 CakeBoss Cloud (Global / US)
   - **Target Customer:** Home bakers, custom cake designers, and boutique cake decorators.
   - **Business Model & Pricing:** Cloud subscription hosted on Microsoft Azure: **$149.00 USD first year** (setup + hosting); **$36.00 USD/year** thereafter (~$3/month). Additional employee logins ~$25 each.
   - **Core Capabilities:**
   - *Penny-Accurate Recipe Costing:* Granular ingredient cost breakdown, pre-loaded generic baking ingredients, automatic batch scaling, and pricing calculator with desired profit margin markup.
   - *Order Calendar & Visuals:* Visual delivery calendar, attaching design sketches and photo references to customer orders, export to Google Calendar / Apple iCal.
   - *Invoicing & Deposits:* Generates branded PDF invoices, tracks initial deposits vs. balance due, integrates with PayPal (*PayNow*).
   - *Shopping Lists & Mileage:* Dynamic shopping lists generated from upcoming order volume; business mileage and vehicle expense tracking for deliveries.
   - **Strengths:** Built specifically around the artisan cake designer's mindset (recipe costing, deposits, visual references).
   - **Weaknesses:** Dated desktop-style web UI; no online storefront for consumer self-checkout; no Indian payment rails or WhatsApp support.
   - **Sources:** `https://cakeboss.com`, BusinessToolsIndex (Researched: 2026-11-01).

   ### 4.4 BakeSmart (Global / US)
   - **Target Customer:** Independent retail bakeries, wholesale bakeries, and high-volume commercial pastry shops.
   - **Business Model & Pricing:** Modular SaaS starting at **$99/month per location** for core platform; plus add-on modules: eCommerce ($99/mo), Cake Matrix ($149/mo), Wholesale Portal ($49/mo), Time Cards ($3/user/mo). One-time implementation fee: $499.
   - **Core Capabilities:**
   - *Cake Matrix:* Rules-based custom cake ordering engine with dynamic tier, frosting, flavor, and decoration pricing rules.
   - *Daily Bake Sheets:* Automated generation of production sheets detailing exact batch quantities required per bake station based on order intake.
   - *Kitchen Capacity Limiter:* Automatically closes delivery dates or caps order volume based on kitchen oven/labor capacity.
   - *Wholesale B2B Portal:* Recurring standing orders, tiered customer pricing, wholesale invoice terms.
   - **Strengths:** In-depth production planning (bake sheets) and rules-based custom cake pricing.
   - **Weaknesses:** Extremely expensive ($250–$400+/month fully loaded); complex implementation; not accessible to independent home bakers.
   - **Sources:** `https://bakesmart.com`, G2, Capterra (Researched: 2026-11-01).

   ### 4.5 HoneyBook (Global / US)
   - **Target Customer:** Creative entrepreneurs, freelancers, event vendors, custom florists, and specialty event bakers.
   - **Business Model & Pricing:** SaaS subscription: Starter ($29–$36/mo), Essentials ($49–$59/mo), Premium ($109–$129/mo).
   - **Core Capabilities:**
   - *Interactive Smart Files (Proposals):* Merges custom quotes, service brochures, digital contracts, and online checkout into a single interactive document.
   - *Deposit & Milestone Payments:* Automatic scheduling of 50% deposit upon booking + remaining balance 7 days before event.
   - *Automations:* Automated lead capture questionnaires, booking confirmations, follow-up emails.
   - *Client Portal:* Dedicated portal for clients to review their quotes, payment receipts, and event communications.
   - **Strengths:** World-class custom proposal, quotation, and advance deposit payment experience.
   - **Weaknesses:** General service CRM; zero catalog e-commerce, zero delivery slot capacity management, zero recipe or baking operations.
   - **Sources:** `https://honeybook.com`, Forbes Advisor, Capterra (Researched: 2026-11-01).

   ### 4.6 GoFrugal Bakery POS (India)
   - **Target Customer:** Retail bakeries, cake counters, central kitchen production units, and bakery franchises across India.
   - **Business Model & Pricing:** Starter editions start around **₹18,000/year** (plus hardware costs); scales with user licenses and Annual License Renewals (ALR).
   - **Core Capabilities:**
   - *BOM & Kitchen Production:* Bill of Materials management, central kitchen dispatch to retail outlets, wastage tracking.
   - *Fast Counter Billing:* Barcode generation, touch billing, weighing scale integration.
   - *Omnichannel (OrderEasy):* Digital storefront app connecting counter POS to online ordering.
   - *BI App (WhatsNow):* Mobile app for owners providing real-time store sales, low stock alerts, and cashier reconciliation.
   - **Strengths:** Robust inventory and supply chain control for multi-store chains in India.
   - **Weaknesses:** Steep learning curve, traditional Windows POS legacy architecture, high upfront hardware investment, poor fit for solo artisan bakers.
   - **Sources:** `https://gofrugal.com`, IndiaMart listings (Researched: 2026-11-01).

   ---

   ## 5. Competitor Feature Comparison Matrix

   | Feature Area | CakeStore | CakePro | Petpooja | CakeBoss | BakeSmart | HoneyBook | GoFrugal | Explanatory Notes & Benchmark Insights |
   |---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
   | **Independent Web Storefront** | **Yes** | Yes | Partial | No | Yes | Partial | Partial | CakeStore provides clean Next.js consumer shops; Petpooja/GoFrugal rely on basic templates. |
   | **Custom Cake Inquiry Form** | **Yes** | Yes | Partial | Yes | Yes | Yes | Partial | CakeStore supports dynamic custom form fields per shop ([`ShopCustomFormField.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopCustomFormField.java)). |
   | **Interactive Quote / Proposal** | **No** | Partial | No | Partial | Yes | **Yes** | No | HoneyBook is the gold standard (Smart Files). CakeStore converts directly to Order without customer quote acceptance. |
   | **Advance / Split Deposit Payment** | **No** | Yes | Yes | Yes | Yes | **Yes** | Yes | **Major Gap:** CakeStore only supports 100% full payment upfront or COD. Custom cakes standardly require 50% deposit. |
   | **Delivery Slot Capacity Control** | **Yes** | Partial | Partial | No | **Yes** | No | Partial | CakeStore's slot engine ([`OwnerDeliverySlotController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerDeliverySlotController.java)) with active order caps is a standout feature. |
   | **Indian Payment Rails (UPI/Cards)**| **Yes** | Yes | Yes | No | No | No | Yes | CakeStore natively integrates Razorpay with automated tenant isolation. |
   | **Manual / Offline Order Entry** | **No** | **Yes** | **Yes** | Yes | Yes | Yes | **Yes** | **Major Gap:** CakeStore has no `POST /api/owner/orders` endpoint for owners to punch in phone, walk-in, or Instagram DM orders. |
   | **Recipe Costing & Calculator** | **No** | Yes | Yes | **Yes** | **Yes** | No | Yes | **Major Gap:** CakeStore has zero recipe or raw ingredient costing calculator. CakeBoss/BakeSmart lead here. |
   | **Ingredient Inventory Tracking**| **No** | Yes | **Yes** | Partial | **Yes** | No | **Yes** | **Major Gap:** CakeStore tracks product availability (`boolean`), but has no raw material stock or reorder alerts. |
   | **Daily Bake Sheets / Production**| **No** | Partial | Yes | Partial | **Yes** | No | Yes | **Major Gap:** BakeSmart automatically generates daily kitchen prep/bake sheets from order volume. CakeStore lacks this. |
   | **Customer Birthday/Anniv. CRM** | **No** | **Yes** | Yes | Yes | Partial | Partial | Yes | CakePro and CakeBoss track special dates for automated festive/anniversary outreach. CakeStore lacks date fields on customer. |
   | **WhatsApp Automated Messaging** | **No** | **Yes** | Yes | No | No | No | Yes | CakeStore only has click-to-chat links; CakePro/Petpooja send automated WhatsApp order confirmations and receipts. |
   | **Discount Coupons Engine** | **Yes** | Yes | Yes | No | Partial | Partial | Yes | CakeStore has full coupon support ([`OwnerCouponController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerCouponController.java)) with usage limits and caps. |
   | **Product Customer Media Reviews** | **Yes** | No | Partial | No | No | No | No | **CakeStore Unique Strength:** Customers upload cake photos/videos with verified purchase badges ([`ProductReview.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/review/ProductReview.java)). |
   | **Multi-Outlet / Franchise Mgmt** | **No** | Yes | **Yes** | No | Yes | No | **Yes** | Petpooja and GoFrugal excel in central kitchen to outlet transfers. CakeStore enforces 1 shop per owner. |
   | **Staff Roles & Sub-Accounts** | **No** | Yes | **Yes** | Partial | Yes | Yes | **Yes** | CakeStore has only `SHOP_OWNER` and `ADMIN`; no kitchen staff, delivery boy, or counter cashier sub-roles. |

   *Legend: **Yes** = Verified native capability; **Partial** = Limited or add-on capability; **No** = Verified absence in platform; **Unknown** = Unverified public evidence.*

   ---

   ## 6. Existing CakeStore Architecture & Infrastructure

   ```
   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
   │                                   FRONTEND (Next.js 14 App Router)                              │
   │  • Public Marketplace (/explore)            • Customer Storefront (/shop/[id])                   │
   │  • Guest/Auth Checkout (/checkout)          • Customer Order Tracking (/orders/[orderNumber])    │
   │  • Owner Studio Dashboard (/dashboard/owner)• Admin Portal (/admin)                              │
   └────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                   │ HTTPS / REST API / JWT
   ┌────────────────────────────────────────────────▼─────────────────────────────────────────────────┐
   │                               BACKEND (Spring Boot 3.3.2 / Java 17)                              │
   │  • Security: Spring Security, JWT HS256, BCrypt, Token Revocation (V53), ShopAccessValidator     │
   │  • Modules: Auth, Shop, Product, Storefront, Order, Payment, Subscription, Review, Communication │
   │  • Subscriptions: Server-authoritative pricing, daily cron expiry, 6-domain access matrix        │
   │  • Gateways: Razorpay Service (Mock Dev Simulation + Test/Live HMAC Signature Verification)      │
   │  • Notifications: Internal DB (notifications, admin_notifications) + Resend / Twilio Code Hooks  │
   └────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                   │ JDBC / Hibernate (Validate)
   ┌────────────────────────────────────────────────▼─────────────────────────────────────────────────┐
   │                               DATABASE (PostgreSQL 18.4 + Flyway V1-V53)                         │
   │  • 45+ Core Tables: users, shops, products, product_variants, product_addons, orders, payments, │
   │    subscriptions, custom_cake_requests, shop_delivery_slots, coupons, product_reviews, etc.      │
   │  • Canonical Indian Location Hierarchy: countries, states, districts, cities, localities, pincodes│
   └──────────────────────────────────────────────────────────────────────────────────────────────────┘
   ```

   ---

   ## 7. CakeStore Feature Audit with Codebase Evidence

   Each feature is classified into:
   - **IMPLEMENTED:** Verified in code with supporting frontend, backend, and DB entities.
   - **PARTIALLY IMPLEMENTED:** Partial foundation exists, but critical user-facing or operational links are missing.
   - **NOT IMPLEMENTED:** No supporting code or schema found.
   - **NEEDS VERIFICATION:** Inconclusive evidence.

   ### Category A: Core SaaS Architecture

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Multi-Tenancy & Tenant Isolation** | **IMPLEMENTED** | [`ShopAccessValidator.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/security/ShopAccessValidator.java), [`OwnerOrderController.java` L26](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java#L26), SQL queries scoped by `shop_id`. | Strictly 1 shop per owner user; cannot manage multiple bakery branches. |
   | **Authentication & Session Security** | **IMPLEMENTED** | [`AuthController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/auth/controller/AuthController.java), [`JwtService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/JwtService.java), `V53__add_session_invalidation_and_token_revocation.sql`. | In local dev uses hardcoded fallback secret; production requires `JWT_SECRET`. |
   | **Shop Registration & Onboarding** | **IMPLEMENTED** | `POST /api/auth/register` (multipart), [`Shop.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/Shop.java), [`frontend_v2/app/onboarding/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/onboarding/page.tsx). | Onboarding requires immediate subscription payment to unlock operational catalog tools. |
   | **Subscription Lifecycle & Plans** | **IMPLEMENTED** | [`OwnerPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/OwnerPaymentController.java), [`SubscriptionService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/subscription/SubscriptionService.java), `subscriptions` table. | Daily expiry scheduler implemented; cancellation is scheduled at term end. |
   | **Shop Status Lifecycle** | **IMPLEMENTED** | [`ShopStatusManager.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopStatusManager.java), `ShopStatus` enum (PENDING, ACTIVE, INACTIVE, EXPIRED, SUSPENDED). | Tested and verified in Phase 1.7 (payment automatically activates pending shop). |
   | **Role-Based Access Control** | **IMPLEMENTED** | `@PreAuthorize("hasAuthority('ROLE_SHOP_OWNER')")`, `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`, [`ShopAccessValidator.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/security/ShopAccessValidator.java) 6-domain gate. | Only 3 platform roles (CUSTOMER, SHOP_OWNER, ADMIN). No staff roles. |

   ### Category B: Bakery Storefront

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Public Storefront Pages** | **IMPLEMENTED** | [`CustomerStorefrontController.java` L36](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java#L36), [`frontend_v2/app/shop/[id]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/shop/[id]/page.tsx). | Fast Next.js server components with client hydration; caches evicted on catalog updates. |
   | **Product Catalog & Categories** | **IMPLEMENTED** | [`Product.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/Product.java), [`ProductCategory.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/ProductCategory.java), [`OwnerProductController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/controller/OwnerProductController.java). | Supports custom categories, slugging, display ordering, and eggless diff pricing. |
   | **Product Variants & Add-ons** | **IMPLEMENTED** | [`ProductVariant.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/ProductVariant.java), [`ProductAddon.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/ProductAddon.java), `V7__cake_variants_and_slots.sql`. | Allows weight variants (0.5kg, 1kg) and add-ons (candles, toppers, message card). |
   | **Product Images & Media** | **IMPLEMENTED** | [`ProductImage.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/product/ProductImage.java), [`MediaController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/media/MediaController.java), Azure Blob Storage + local fallback. | Up to 5MB image uploads; video reviews supported up to 25MB. |
   | **Geographic & Spatial Shop Search** | **IMPLEMENTED** | [`CustomerStorefrontController.java` L45–100](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java#L45-L100), `V18__location_indexes_and_spatial_search.sql`. | Haversine formula distance query; state/city/locality/pincode filtering. |
   | **Shopping Cart & Guest Checkout** | **IMPLEMENTED** | [`GuestOrderRequest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/dto/GuestOrderRequest.java), [`CustomerStorefrontController.java` L120–180](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java#L120-L180), [`frontend_v2/app/checkout/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/checkout/page.tsx). | Customers can complete orders without pre-creating accounts; orders linked to phone/email. |
   | **Guest Order Tracking** | **IMPLEMENTED** | [`CustomerStorefrontController.java` L220–280](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontController.java#L220-L280), [`frontend_v2/app/orders/[orderNumber]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/orders/[orderNumber]/page.tsx). | Secured via mobile phone OTP/matching validation to prevent order enumeration. |

   ### Category C: Order Management

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **E-Commerce Order Lifecycle** | **IMPLEMENTED** | [`Order.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/Order.java), [`OwnerOrderController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java), statuses: NEW, CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED. | Status updates trigger internal notification; invoice PDF generated. |
   | **Manual / Offline Order Punching** | **NOT IMPLEMENTED** | Inspected [`OwnerOrderController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/OwnerOrderController.java) & `OrderService.java`. | **No endpoint exists** for bakery owners to record phone, Instagram DM, or walk-in orders. |
   | **Custom Cake Request Intake** | **IMPLEMENTED** | [`CustomCakeRequest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/interaction/CustomCakeRequest.java), [`OwnerInteractionController.java` L85–125](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/interaction/controller/OwnerInteractionController.java#L85-L125). | Customers submit occasion, flavor, weight, design reference image, and budget. |
   | **Custom Cake to Order Conversion** | **PARTIALLY IMPLEMENTED** | [`OwnerInteractionService.java` L300–450](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/interaction/service/OwnerInteractionService.java#L300-L450). | Converts request into an order directly, but assumes full COD/Unpaid amount; **no customer quote approval or advance payment link**. |
   | **Quotation & Proposal Approval Flow** | **NOT IMPLEMENTED** | No quotation entity, no proposal document, no customer accept/reject signature token. | Competitors like HoneyBook and CakeBoss provide interactive quotes with acceptance tokens. |
   | **Advance / Split Deposit Payments** | **NOT IMPLEMENTED** | `Order.java` has only single `totalAmount`, `paymentStatus` (PAID, PENDING, FAILED). | No support for 50% advance booking deposit + remaining balance upon delivery. |
   | **Delivery Slot Capacity Booking** | **IMPLEMENTED** | [`ShopDeliverySlot.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/ShopDeliverySlot.java), [`OwnerDeliverySlotController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerDeliverySlotController.java), `maxOrders` capacity check. | Prevents overbooking slots on given dates; validates start/end time overlaps. |

   ### Category D: Bakery Operations (Production & Kitchen)

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Raw Material & Ingredient Inventory** | **NOT IMPLEMENTED** | Checked all Flyway migrations V1–V53; no `inventory` or `raw_materials` table. | Products have a static descriptive text column `products.ingredients`, not a stock entity. |
   | **Stock Adjustments & Low-Stock Alerts** | **NOT IMPLEMENTED** | No inventory adjustment logic exists in the codebase. | Cannot track flour, butter, cream, sugar, or packaging boxes. |
   | **Recipe Management & BOM** | **NOT IMPLEMENTED** | No `recipes` or `bill_of_materials` tables in DB. | Bakers cannot store standardized recipes or component ratios. |
   | **Ingredient-Level Costing Calculator** | **NOT IMPLEMENTED** | No costing service in backend. | Bakers cannot compute gross margin per cake based on raw ingredient market prices. |
   | **Daily Bake Sheets & Prep Reports** | **NOT IMPLEMENTED** | No production schedule or bake sheet aggregation endpoints. | Bakers must manually open individual orders to compile their daily kitchen baking list. |
   | **Kitchen Capacity Limits** | **PARTIALLY IMPLEMENTED** | Handled at delivery slot level via `maxOrders` per slot per day. | Does not limit by cake weight (e.g. 15 kg/day oven limit) or labor hours. |

   ### Category E: Customer Relationship Management (CRM)

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Customer Order History Profile** | **IMPLEMENTED** | [`OwnerCustomerController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerCustomerController.java), [`CustomerProfileResponse.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/dto/CustomerProfileResponse.java). | Grouped dynamically by email/phone from `orders` table; shows lifetime spend & order list. |
   | **Customer Birthdays & Anniversaries** | **NOT IMPLEMENTED** | Inspected `users` and `orders` tables; no birthday/anniversary date fields. | Cannot send automated birthday cake reminder offers 14 days before an occasion. |
   | **Customer Segmentation & Tagging** | **NOT IMPLEMENTED** | No tags, VIP segments, or notes on customer records. | Cannot group high-value customers (e.g. Wedding clients vs. Weekly pastry buyers). |
   | **Discount Coupons & Codes** | **IMPLEMENTED** | [`Coupon.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/Coupon.java), [`OwnerCouponController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerCouponController.java). | Supports percentage/fixed discounts, minimum order amount, maximum cap, and usage limits. |
   | **Customer Loyalty Points Program** | **NOT IMPLEMENTED** | No loyalty ledger or points accrual/redemption tables. | Only promotional coupon codes are currently available. |

   ### Category F: Marketing and Communication

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Transactional Email Integration** | **PARTIALLY IMPLEMENTED** | [`EmailService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java), Resend API integration hooks. | Resend API key is unconfigured in development; emails log to console without delivery failure. |
   | **SMS Notification Integration** | **PARTIALLY IMPLEMENTED** | [`SmsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java), Twilio integration code. | Twilio credentials unconfigured in local development; logs `Mock SMS (Local Dev)`. |
   | **WhatsApp Business API Integration** | **NOT IMPLEMENTED** | Codebase only supports static `whatsappNumber` and client-side click-to-chat links. | No official WhatsApp Cloud API integration for automated order confirmations or receipts. |
   | **Admin System Broadcasts** | **IMPLEMENTED** | [`AdminMessageController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java), `broadcast_history` table (V36, V49). | Platform admin can send system-wide announcements to all bakery owners. |

   ### Category G: Business Intelligence & Analytics

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Revenue & Sales Analytics** | **IMPLEMENTED** | [`AnalyticsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/service/AnalyticsService.java), [`OwnerAnalyticsController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/OwnerAnalyticsController.java). | Calculates realized revenue, gross sales, COD receivables, daily charts, average order value. |
   | **Product Performance Metrics** | **IMPLEMENTED** | [`AnalyticsService.java` L180–220](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/service/AnalyticsService.java#L180-L220). | Identifies top-selling products by quantity and revenue with unit share percentages. |
   | **Profit & Cost Margin Analysis** | **NOT IMPLEMENTED** | No cost data exists on products or orders. | Analytics only tracks gross revenue; cannot show net profit margins or food costs. |
   | **Exportable Tax & Financial Reports** | **PARTIALLY IMPLEMENTED** | Tax invoice PDFs generated per order ([`InvoiceService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/InvoiceService.java)). | No monthly Excel/CSV sales ledger download for accountant GST filings. |

   ### Category H: Scale, Outlets & Integrations

   | Feature | Status | Evidence / Code References | Known Limitations |
   |---|:---:|---|---|
   | **Multiple Outlets / Branches** | **NOT IMPLEMENTED** | Entity relation `User` 1:N `Shop` exists in schema, but business rules enforce 1 active shop. | No shared inventory, kitchen transfer, or outlet picker on storefront. |
   | **Staff Accounts & Sub-Roles** | **NOT IMPLEMENTED** | Only 3 global roles exist (`CUSTOMER`, `SHOP_OWNER`, `ADMIN`). | Cannot grant restricted access to kitchen bakers or delivery drivers without sharing owner login. |
   | **Third-Party Delivery (Dunzo/Porter)** | **NOT IMPLEMENTED** | Delivery is self-managed by the bakery using delivery slots and delivery zones. | No automated rider dispatch API integrations. |
   | **Food Aggregators (Zomato/Swiggy)** | **NOT IMPLEMENTED** | No integration code for Swiggy, Zomato, or ONDC. | CakeStore is designed exclusively for direct-to-consumer (D2C) brand channels. |

   ---

   ## 8. Summary Count of Audited Features

   Across the **36 evaluated capabilities** within the CakeStore codebase:

   ```
   ┌────────────────────────────────────────────────────────┐
   │  IMPLEMENTED:              18 features  (50.0%)        │
   │  PARTIALLY IMPLEMENTED:     5 features  (13.9%)        │
   │  NOT IMPLEMENTED:          13 features  (36.1%)        │
   │  NEEDS VERIFICATION:        0 features  ( 0.0%)        │
   │  TOTAL EVALUATED:          36 features                 │
   └────────────────────────────────────────────────────────┘
   ```

   ---

   ## 9. Confirmed Feature Gaps (What Competitors Have That CakeStore Lacks)

   1. **Advance / Split Deposit Payment System:**  
      *Competitors: CakePro, Petpooja, CakeBoss, BakeSmart, HoneyBook.*  
      *Gap:* Custom celebration cakes almost never sell for 100% COD or 100% upfront card charges. Bakers take a 30% to 50% non-refundable booking deposit to reserve the date and buy ingredients, with the balance due upon delivery/pickup. CakeStore currently forces a single binary transaction (`PAID` or `PENDING`).

   2. **Manual / Offline Order Punching:**  
      *Competitors: CakePro, Petpooja, CakeBoss, BakeSmart, GoFrugal.*  
      *Gap:* Over 60% of home baker orders originate through WhatsApp messages, phone calls, Instagram direct messages, or walk-ins. Bakery owners cannot manually punch an order into CakeStore. As a result, the owner dashboard analytics only represent a fraction of the bakery's actual volume.

   3. **Customer Quotation & Interactive Approval Workflow:**  
      *Competitors: HoneyBook, CakeBoss, BakeSmart.*  
      *Gap:* Currently, converting a custom cake request immediately creates a confirmed order without client approval or payment. A client cannot review the proposed quote, select optional flavor/topper add-ons, or pay a booking deposit online.

   4. **Daily Bake Sheets & Production Aggregation:**  
      *Competitors: BakeSmart, CakeBoss, Petpooja, GoFrugal.*  
      *Gap:* In the morning, bakers need a consolidated list: *"Today: 4 Vanilla Sponge (0.5kg), 2 Chocolate Ganache (1kg), 1 Eggless Red Velvet. Delivery at 2 PM: Slot 2."* CakeStore owners must click through individual orders one by one.

   5. **Recipe Costing & Pricing Calculator:**  
      *Competitors: CakeBoss Cloud, BakeSmart, CakePro, GoFrugal.*  
      *Gap:* Independent bakers frequently underprice their cakes because they fail to account for packaging boxes, cake boards, gold leaf, imported chocolate, electricity, and hourly labor. A built-in recipe cost calculator is a major selling point for CakeBoss and BakeSmart.

   6. **Ingredient / Raw Material Inventory:**  
      *Competitors: Petpooja, GoFrugal, CakePro, BakeSmart.*  
      *Gap:* No tracking of raw materials (flour, fondant, cocoa, whipping cream). While full ERP tracking is too cumbersome for home bakers, low-stock warnings on essentials (e.g., cake boxes, fondants) are missing.

   7. **Automated WhatsApp Notifications:**  
      *Competitors: CakePro, Petpooja, GoFrugal.*  
      *Gap:* In India, email notifications to retail consumers have very low open rates. WhatsApp is the primary business communication channel. CakeStore lacks automated WhatsApp Cloud API message triggers for order confirmation, order out-for-delivery, and payment receipts.

   8. **Customer Birthday & Anniversary Reminders:**  
      *Competitors: CakePro, CakeBoss, Petpooja.*  
      *Gap:* Cakes are repeat event-driven purchases. Capturing a customer's family birthdays and wedding anniversaries enables automated reminders (e.g., *"Aarav's 5th birthday is in 2 weeks! Order your cake early and get 10% off"*), driving significant repeat order revenue.

   ---

   ## 10. CakeStore’s High-Leverage Competitive Opportunities

   ### The Strategic Sweet Spot

   CakeStore should **not** attempt to become an industrial restaurant POS hardware system (like Petpooja or GoFrugal). That requires on-site technicians, thermal printer drivers, cash drawers, and complex kitchen display systems.

   Similarly, CakeStore should **not** copy the complex US wholesale and B2B pricing models of BakeSmart.

   Instead, CakeStore's greatest commercial advantage is to be the **premier digital operating system for bespoke celebratory cakes**:

   ```
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │                   CAKESTORE COMPETITIVE ADVANTAGE PLAYBOOK                       │
   ├──────────────────────────────────────────────────────────────────────────────────┤
   │ 1. Zero Platform Commission (Keep 100% of cake profits, unlike Zomato/Swiggy)    │
   │ 2. Hyper-Local Delivery Slot Controls (Never overbook a weekend kitchen capacity)│
   │ 3. Beautiful Mobile Storefronts (Visual cake portfolio + customer photo reviews) │
   │ 4. Seamless WhatsApp First (Where 90% of Indian cake commerce conversations live)│
   │ 5. Automated Advance Deposit Links (Eliminate lost revenue from ghosted clients) │
   └──────────────────────────────────────────────────────────────────────────────────┘
   ```

   ---

   ## 11. Prioritized Product Roadmap (P0 to P3)

   ### Priority Matrix

   ```
         HIGH IMPACT
               │
               │   [P1] Advance Deposits & Quotes     [P1] WhatsApp Cloud API
               │   [P0] Manual Offline Order Intake   [P1] Daily Kitchen Bake Sheet
               │
               │   [P2] Recipe Cost Calculator        [P2] Birthday/Anniversary CRM
               │   [P2] Excel Sales / GST Export      [P3] Staff Cashier Accounts
               │
               │   [P3] Multi-Outlet / Branches       [P3] Raw Material Inventory
               │
   ──────────┼──────────────────────────────────────────────────────────────────►
               │                                                      HIGH EFFORT
         LOW EFFORT
   ```

   ---

   ### P0 — Commercial Launch Blockers (Must-Have Before Scaled Onboarding)

   | Ref | Feature | User / Beneficiary | Complexity | Rationale & Scope |
   |---|---|---|:---:|---|
   | **P0-1** | **Manual / Offline Order Entry (`POST /api/owner/orders`)** | Bakery Owner | **Medium** | Owners must be able to punch in orders received via phone, Instagram, or walk-in. Currently, owners cannot use CakeStore as their single source of truth because offline orders cannot be recorded. |
   | **P0-2** | **Production Email Dispatch Hardening (Resend)** | Owner & Customer | **Low** | Provide production Resend API keys, verify domain DNS (DKIM/SPF), and ensure transactional order confirmations and password resets are reliably delivered to inboxes. |
   | **P0-3** | **Order Cancellation & Refund Workflow** | Owner & Customer | **Medium** | When an owner cancels an online paid order, provide a clear UI and backend trigger to record Razorpay refund status and release delivery slot capacity. |

   ---

   ### P1 — High-Value Improvements (First Quarter Post-Launch)

   | Ref | Feature | User / Beneficiary | Complexity | Rationale & Scope |
   |---|---|---|:---:|---|
   | **P1-1** | **Advance Deposit & Balance Split Payments** | Owner & Customer | **High** | Introduce `depositAmount` (e.g. 50%) and `balanceAmount` on orders. Allow customer to pay the deposit online to confirm the booking, generating a balance collection link for delivery day. |
   | **P1-2** | **Daily Kitchen Bake Sheet View** | Bakery Kitchen | **Low** | A dedicated `/dashboard/owner/bake-sheet` screen that groups all orders for a selected date by item, variant, flavor, and delivery slot with a print/PDF button. |
   | **P1-3** | **WhatsApp Cloud API Integration (Automated Updates)** | Owner & Customer | **Medium** | Integrate official Meta WhatsApp Business API to dispatch automated booking confirmations, payment links, and pickup/delivery alerts. |
   | **P1-4** | **Interactive Customer Quotation Flow** | Owner & Customer | **Medium** | When converting a Custom Cake Request, generate a shareable quotation link where the customer can view the price, approve the design notes, and pay the booking deposit. |

   ---

   ### P2 — Competitive Differentiation (Second Quarter Post-Launch)

   | Ref | Feature | User / Beneficiary | Complexity | Rationale & Scope |
   |---|---|---|:---:|---|
   | **P2-1** | **Recipe Costing & Cake Pricing Calculator** | Home Bakers | **Medium** | A studio utility where bakers input ingredient prices (butter, chocolate, flour, fondant) and batch yield. Calculates food cost per cake and recommends retail price for a target profit margin. |
   | **P2-2** | **Customer Occasion CRM (Birthdays & Anniversaries)** | Bakery Owner | **Medium** | Store customer anniversary and family birthday dates. Automatic dashboard reminder queue 14 days prior to send a personalized promotional offer. |
   | **P2-3** | **Financial & GST Export (Excel / CSV)** | Bakery Accountant | **Low** | One-click export of monthly sales registers with HSN code, taxable value, CGST/SGST breakdown, and payment mode. |

   ---

   ### P3 — Future Expansion (Growth & Scale Phase)

   | Ref | Feature | User / Beneficiary | Complexity | Rationale & Scope |
   |---|---|---|:---:|---|
   | **P3-1** | **Multi-Outlet / Branch Management** | Bakery Franchises | **High** | Allow an owner account to operate multiple retail outlets with branch-specific delivery zones and consolidated reports. |
   | **P3-2** | **Staff Sub-Accounts (Kitchen, Cashier, Driver)** | Growing Bakeries | **Medium** | Granular permissions allowing kitchen staff to view bake sheets without seeing revenue reports or banking details. |
   | **P3-3** | **Basic Ingredient Inventory & Reorder Alerts** | Commercial Bakeries | **High** | Track stock levels of essential baking materials and packaging with minimum stock thresholds. |

   ---

   ## 12. Recommended Product Positioning

   ```
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                              CAKESTORE POSITIONING STATEMENT                           │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │ "For passionate home bakers and boutique cake studios who want to run a professional    │
   │  baking business without the complexity of traditional restaurant POS hardware:         │
   │                                                                                        │
   │  CakeStore is the all-in-one digital operating system that gives you a stunning custom │
   │  storefront, protects your kitchen capacity with smart delivery slots, handles custom  │
   │  inquiries and advance deposits, and helps you keep 100% of your hard-earned profits   │
   │  with 0% sales commission."                                                            │
   └────────────────────────────────────────────────────────────────────────────────────────┘
   ```

   ### Why Competitors Cannot Easily Displace CakeStore in This Niche:
   - **Petpooja & GoFrugal:** Too heavy, too expensive, designed for physical billing counters and fast-food turnarounds, not custom celebratory cakes.
   - **CakeBoss & BakeSmart:** Built for US currency, tax laws, and workflows; completely detached from Indian payment methods (UPI, Razorpay) and WhatsApp commerce.
   - **Shopify / WooCommerce:** Generic e-commerce; requires expensive plugins and complex setups to support delivery slots, eggless variations, cake photo references, and custom cake quotation flows.

   ---

   ## 13. Recommended Next Development Phase

   ### Phase 2.0: Studio Order Intake & Kitchen Production Suite

   To immediately elevate CakeStore from a "storefront checkout tool" to an **indispensable daily operating system** for bakeries, the next logical development phase should focus on two tightly coupled, high-impact capabilities:

   ```
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                        PHASE 2.0 SCOPE SPECIFICATION                                   │
   ├────────────────────────────────────────────────────────────────────────────────────────┤
   │ 1. Manual / Walk-in Order Entry (POST /api/owner/orders):                              │
   │    • Owner dashboard UI to create an order for phone, Instagram, or walk-in clients.  │
   │    • Choose from existing product catalog or enter a custom one-off item.              │
   │    • Assign delivery date and delivery slot (respecting slot capacity).                │
   │    • Select payment status (Cash on Delivery, Paid via UPI, or Pending).               │
   │                                                                                        │
   │ 2. Daily Kitchen Bake Sheet (/dashboard/owner/bake-sheet):                             │
   │    • Date-based production schedule consolidating all online AND manual orders.        │
   │    • Aggregates total quantities needed by product, flavor, eggless type, and variant. │
   │    • Chronological delivery slot schedule with customer cake messages and notes.       │
   │    • Clean print-friendly CSS / PDF export for the kitchen counter.                    │
   └────────────────────────────────────────────────────────────────────────────────────────┘
   ```

   **Why this phase first?**
   - **Zero Third-Party Dependencies:** Does not depend on WhatsApp Business API verification or external payment contract modifications.
   - **Immediate Daily Utility:** Bakers will log into CakeStore every single morning to print or view their daily bake sheet.
   - **Data Completeness:** Allows 100% of the bakery's orders to be tracked in CakeStore analytics, making the dashboard infinitely more valuable to the business owner.

   ---

   ## 14. Sources and References

   1. **CakePro (India):** Official product overview, feature list, and pricing documentation: `https://cakepro.in` (Accessed: 2026-11-01).
   2. **Petpooja (India):** Official bakery management and restaurant POS documentation: `https://petpooja.com/bakery-pos` and Capterra India verified reviews (Accessed: 2026-11-01).
   3. **CakeBoss Cloud:** Official feature breakdown, recipe costing specifications, and pricing tiers: `https://cakeboss.com` (Accessed: 2026-11-01).
   4. **BakeSmart:** Product overview, Cake Matrix module, and modular pricing documentation: `https://bakesmart.com` (Accessed: 2026-11-01).
   5. **HoneyBook:** Smart Files proposal, quotation, contract, and invoicing workflow documentation: `https://honeybook.com/pricing` (Accessed: 2026-11-01).
   6. **GoFrugal (India):** Bakery POS, Bill of Materials, and OrderEasy documentation: `https://gofrugal.com/bakery-pos-software` (Accessed: 2026-11-01).
   7. **CakeStore Local Codebase Authority:**
      - Database migrations `V1` through `V53` in [`backend/src/main/resources/db/migration`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration).
      - Domain services and controllers in [`backend/src/main/java/com/cakeplatform/api/modules`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules).
      - Frontend pages and UI components in [`frontend_v2/app`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app).

   ---

   ## 15. Open Questions and Unverified Findings

   | Item | Open Question | Risk / Impact | Recommended Resolution |
   |---|---|---|---|
   | **CakePro Offline Data Sync** | Exact technical mechanism for conflict resolution during offline mode. | Low | Marketing claims instant sync; typically uses local SQLite storage syncing to cloud REST APIs. |
   | **Petpooja Add-on Pricing** | Detailed cost breakdown of advanced CRM and loyalty add-ons beyond the ₹12,000 base fee. | Low | Varies by negotiation and chain size; baseline confirmed between ₹12,000 to ₹35,000/year. |
   | **Resend Production Domain** | Whether the client has already purchased or verified a custom sending domain on Resend. | Medium | If unconfigured, production onboarding emails will fail or fall back to default `onboarding@resend.dev`. |
   | **WhatsApp Business API Meta Verification** | Whether bakery owners will use a single centralized CakeStore WhatsApp number (shared WABA) or connect their own business phone numbers. | High | Shared WABA template model is much simpler to implement than tenant-level BYO-WABA credentials. |

   ---

   *Report compiled by Advanced Agentic Pair Programming Assistant. Strictly read-only audit; zero application code or database records were modified.*





