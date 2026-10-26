# CakeStore — Legal & Policy Pages Implementation Report

**Phase:** Legal & Policy Pages Implementation  
**Date:** October 26, 2026  
**Status:** Completed & Verified  

---

## 1. Executive Summary

This phase implemented the public legal and policy pages for the CakeStore SaaS platform and integrated them into the website footer.

The three implemented routes are:
1. **`/terms` — Terms of Service:** Clarifies the platform's role as a multi-tenant SaaS intermediary connecting customers with independent artisanal bakeries. Defines customer and merchant responsibilities, order placement workflows, Razorpay payment processing, allergen disclaimers, and service limitations.
2. **`/privacy` — Privacy Policy:** Transparently discloses personal data collected (contact, delivery, order specifications, reference photos, merchant kitchen coordinates, and security IP logging). Details verified third-party integrations (Razorpay, Resend, Twilio, Leaflet/OSM), BCrypt OTP hashing, 10-minute expiry, and data retention practices.
3. **`/refund-policy` — Refund & Cancellation Policy:** Accurately reflects the custom, perishable nature of celebration cakes. Explains in-flight checkout cancellation, confirmed order restrictions, bank reversals on failed transactions, backend late-payment safety safeguards (`RECONCILIATION_REQUIRED`), and manual refund procedures via Razorpay without promising automatic instant refunds.

All three pages were built with CakeStore's brand design tokens (cream-light, plum, espresso, blush), responsive typography, jump navigation, clear metadata, and prominent notices indicating that the text constitutes an operational draft requiring formal legal review prior to public launch.

---

## 2. Files Created and Modified

| File | Subsystem | Nature of Change |
| :--- | :--- | :--- |
| [`frontend_v2/components/common/Footer.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/common/Footer.tsx) | Frontend (Component) | Added working links to `/terms`, `/privacy`, and `/refund-policy` in the **Help & Support** column and the responsive bottom copyright bar. |
| [`frontend_v2/app/terms/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/terms/page.tsx) | Frontend (Route) | Created responsive Terms of Service page with SEO metadata, jump-link table of contents, operational draft notice, and 12 structured sections. |
| [`frontend_v2/app/privacy/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/privacy/page.tsx) | Frontend (Route) | Created responsive Privacy Policy page with SEO metadata, data categorization cards, third-party service descriptions, security protections, and 9 structured sections. |
| [`frontend_v2/app/refund-policy/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/refund-policy/page.tsx) | Frontend (Route) | Created responsive Refund & Cancellation Policy page with SEO metadata, late-payment safety highlights, cancellation rules for in-flight vs confirmed orders, and 9 structured sections. |
| [`frontend_v2/__tests__/legalPagesAndFooterLinks.test.mjs`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/__tests__/legalPagesAndFooterLinks.test.mjs) | Frontend (Test) | Created automated test suite verifying footer links, metadata exports, core policy sections, and prevention of dead placeholder links. |

---

## 3. Routes and Footer Links Implemented

### 1. Terms of Service (`/terms`)
- **Metadata Title:** `Terms of Service — CakeStore Platform`
- **Metadata Description:** `Terms and conditions governing the use of the CakeStore artisanal bakery SaaS platform for customers and bakery partners.`
- **Content Highlights:**
  - **Intermediary Role:** CakeStore is an intermediary software technology platform and not a food preparation facility or logistics carrier.
  - **Direct Contract:** Sales contracts are formed directly between the customer and the independent bakery.
  - **Bakery Partner Obligations:** Food hygiene, FSSAI regulatory compliance, accurate menu listings, and adherence to delivery dates/slots.
  - **Customer Responsibilities:** Accurate recipient contact details, physical delivery address, and timely receipt during scheduled slots.
  - **Allergen Disclaimers:** Critical notice that independent kitchens prepare items with potential allergens (nuts, gluten, dairy, eggs, soy) and eggless options do not guarantee a certified allergen-free environment.
  - **Payments:** Handled via Razorpay in INR. No raw credit/debit card numbers or UPI PINs stored by CakeStore.
  - **No Dead Links:** Uses real internal links to `/refund-policy`, `/privacy`, and `/contact`.

### 2. Privacy Policy (`/privacy`)
- **Metadata Title:** `Privacy Policy — CakeStore Platform`
- **Metadata Description:** `Understand what personal data CakeStore collects, how it is used for order fulfillment and authentication, and our data protection practices.`
- **Content Highlights:**
  - **Customer Personal Data:** Mobile number (primary identifier for OTP and order status), full name, email, delivery address, custom cake message, and uploaded design references.
  - **Bakery Owner Data:** Owner name, business email, mobile phone, bakery name, business classification, kitchen physical address, latitude/longitude (used for delivery radius discovery), and FSSAI registration details.
  - **Security Logging:** Client IP addresses logged strictly for rate-limiting enforcement (10 req/min OTP, 20 req/min contact forms) and abuse prevention.
  - **Verified Third Parties:** Discloses Razorpay (payments), Resend (transactional email and email OTP fallback), Twilio (SMS and OTP verification), and OpenStreetMap/Leaflet (mapping).
  - **Cryptographic Safeguards:** BCrypt hashing for OTP verification secrets, 10-minute expiration, 3-attempt lockout, and TLS/HTTPS transport security.
  - **Cookies:** Minimal essential local storage for cart persistence and session authentication tokens; no third-party ad tracking.

### 3. Refund & Cancellation Policy (`/refund-policy`)
- **Metadata Title:** `Refund & Cancellation Policy — CakeStore Platform`
- **Metadata Description:** `Understand CakeStore policies on order cancellations, failed payments, delayed payment reconciliation, and manual refund procedures.`
- **Content Highlights:**
  - **Perishable Food Realities:** Handcrafted celebration cakes are custom-baked to order with perishable ingredients; policies reflect kitchen preparation realities.
  - **In-Flight Cancellation:** Customers can safely cancel unpaid checkout sessions (`POST /api/storefront/orders/{orderNumber}/cancel-payment`), releasing delivery slots and restoring coupons without incurring charges.
  - **Confirmed Orders:** Self-service cancellation is disabled once payment is confirmed. Cancellations require contacting the bakery and are subject to preparation status (before baking commences vs after decorating begins).
  - **Banking Debits on Failed Checkout:** Explains standard banking reconciliation rails via Razorpay (typically 3–7 business days).
  - **Late Payments on Cancelled/Expired Orders:** Explains the backend safety mechanism where late captures keep the order `CANCELLED`, do NOT overbook delivery slots, set payment status to `RECONCILIATION_REQUIRED`, and alert admins for manual refund processing.
  - **Defective / Damaged Orders:** Mandatory 2-hour reporting window with clear photographic evidence.
  - **Manual Refund Settlement:** Explains that refunds are processed manually via Razorpay to the original payment method without false promises of instant automatic chargebacks.

### 4. Footer Updates (`Footer.tsx`)
- **Help & Support Column:** Added links to `/terms`, `/privacy`, and `/refund-policy` alongside Contact Team, Customer FAQs, and Subscription FAQ.
- **Bottom Sub-Footer Bar:** Added horizontal links:
  `Terms of Service • Privacy Policy • Refund Policy` with wrap support on mobile devices.

---

## 4. Tests and Verification Results

### 1. Dedicated Legal Pages & Footer Links Test Suite
Command: `node --test __tests__/legalPagesAndFooterLinks.test.mjs`
- **1. Footer.tsx includes accessible links to Terms, Privacy, and Refund Policy:** PASSED
- **2. Terms of Service page file exists with correct metadata, structure, and disclaimers:** PASSED
- **3. Privacy Policy page file exists with data collection, third-party services, and security practices:** PASSED
- **4. Refund Policy page file exists with cancellation rules, late-payment protections, and refund workflows:** PASSED
- **Result:** **5 tests run, 5 passed, 0 failed** (Duration: 33.65ms).

### 2. Full Frontend Test Suite
Command: `npm test`
- **Suites:** 21 test suites in `frontend_v2/__tests__`
- **Total Tests:** **246 tests run, 246 passed, 0 failed, 0 skipped**
- **Duration:** 7.02s

### 3. ESLint Static Analysis
Command: `npm run lint`
- **Result:** **0 errors**, 1 pre-existing warning (`InteractiveLocationMap.tsx`).
- **Exit Code:** 0

### 4. Next.js Production Build
Command: `npm run build`
- **Result:** **Compiled successfully**.
- **Static Pages Generated:** All **41/41 pages** generated cleanly:
  - `○ /terms` (1.85 kB, First Load JS: 126 kB)
  - `○ /privacy` (1.85 kB, First Load JS: 126 kB)
  - `○ /refund-policy` (1.85 kB, First Load JS: 126 kB)
- **Exit Code:** 0

### 5. Live Local Server Verification
Checked via HTTP request on `http://localhost:3000`:
- `GET http://localhost:3000/terms`: **HTTP 200 OK**, renders `Terms of Service — CakeStore Platform`.
- `GET http://localhost:3000/privacy`: **HTTP 200 OK**, renders `Privacy Policy — CakeStore Platform`.
- `GET http://localhost:3000/refund-policy`: **HTTP 200 OK**, renders `Refund & Cancellation Policy — CakeStore Platform`.
- `GET http://localhost:3000`: **HTTP 200 OK**, footer renders links to all three legal pages in both navigation column and bottom bar.

---

## 5. Policy Decisions Requiring Owner / Legal Confirmation

In accordance with legal content safeguards, the generated policies are explicitly marked as **Operational Drafts for Legal Review** and avoid fabricating unverifiable facts. The following specific items require confirmation by the platform owner and a qualified legal professional before commercial launch:

| Policy Item | Current Draft Behavior | Confirmation Needed from Owner / Legal |
| :--- | :--- | :--- |
| **Formal Legal Entity & Address** | Cites general platform operations and `support@cakestore.in`; no corporate CIN or registered address is fabricated. | Provide formal corporate entity name (e.g., LLP / Private Limited), Corporate Identification Number (CIN), registered office address, and jurisdiction city. |
| **Bakery Cancellation Cut-Off Windows** | Describes general rule (discretionary before baking starts, non-refundable after decorating begins). | Confirm whether the platform will enforce a standardized cutoff (e.g., 24 hours or 48 hours prior to delivery date) or allow each bakery to set custom notice windows. |
| **Damaged Delivery Claim Window** | Specifies 2 hours post-delivery for reporting damaged or incorrect baked goods. | Confirm whether 2 hours is acceptable or if a 4-hour / same-day window is preferred for celebration events. |
| **Platform Commission & Subscription Claims** | Terms and marketing cite flat subscription plans with 0% marketplace commission. | Verify that platform plan pricing and payment gateway transaction fee pass-through (e.g., standard ~2% payment gateway fee vs absorbed) are formally documented. |
| **Grievance / DPO Officer** | Directs privacy and legal inquiries to `support@cakestore.in`. | Under Indian Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, appoint and publish a named Grievance Officer with an email and physical contact address. |
| **FSSAI Compliance Verification Scope** | States that independent bakeries are responsible for their own FSSAI compliance and licensing. | Legal counsel should review whether CakeStore has an intermediary safe harbor obligation to collect, verify, or display merchant FSSAI license numbers on storefronts. |

---

## 6. Verification Summary Checklist

- [x] Terms of Service implemented at `/terms` with responsive layout and semantic markup.
- [x] Privacy Policy implemented at `/privacy` with verified data collection and service disclosures.
- [x] Refund Policy implemented at `/refund-policy` with accurate late-payment and cancellation rules.
- [x] Footer updated with working links to all three pages in both navigation and bottom bar.
- [x] No placeholder links (`#`, `javascript:void`) or broken navigation.
- [x] Draft notice callout cards added to all three pages.
- [x] Dedicated test suite created and passing (5/5 tests).
- [x] Full frontend test suite passing (246/246 tests).
- [x] ESLint passing with 0 errors.
- [x] Next.js production build succeeded with all 41 routes prerendered.
- [x] Backend logic, database migrations, and production secrets were left completely untouched.
