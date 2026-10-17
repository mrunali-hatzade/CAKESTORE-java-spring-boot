# CakeStore — Admin Dashboard Final Acceptance Audit

**Date:** 2026-10-17  
**Scope:** Super Admin Dashboard Platform Governance (`frontend_v2/app/admin/**` and backend `/api/admin/**`)  
**Audit Status:** Read-Only Audit Complete  
**Automated Tests Status:** 122/122 passing (`frontend_v2`), 0 ESLint warnings/errors, Next.js production build succeeded cleanly across all 38 routes.

---

## Executive Summary

This audit establishes the final acceptance readiness of the **Super Admin Governance Portal** before advancing to the Shop Owner Dashboard. The audit covers all 12 frontend admin routes, layouts, modals, and communication surfaces, cross-referenced against the Spring Boot backend REST endpoints, Spring Security authorization annotations, and automated test suites.

### Key Audit Findings
1. **11 of 12 admin sections are fully built, wired to real backend endpoints, and covered by automated regression tests.**
2. **Global Refresh Coordination:** The core Admin Dashboard and 8 sub-pages/components have complete ref-locked async refresh coordination via `AdminRefreshContext`. However, 3 subpages ([`shops/[id]`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/[id]/page.tsx), [`feedback`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/feedback/page.tsx), and [`enquiries`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx)) currently rely solely on the fallback DOM event `adminGlobalRefresh` and are not registered with `useRegisterAdminRefresh()`, causing the header spinner to complete before their data finishes fetching.
3. **Admin Chat Capability:** A full backend chat service and controller ([`AdminChatController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/chat/AdminChatController.java)) exists with 5 endpoints (`/api/admin/chat/**`), but no frontend UI route or chat interface has been implemented in `frontend_v2`.
4. **Data Integrity & Security:** Administrative access control is strictly enforced with `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` on all backend endpoints, client-side route guards in [`admin/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx), HMAC-SHA256 signed document URLs with 15-minute expirations for private KYC documents, and dirty-state protection on global settings.

---

## 1. Complete Route, Component, and Feature Inventory

The Super Admin portal is comprised of **12 distinct routes/pages**, **5 administrative dialog modals**, and **3 global header components**:

| Route / Surface | Component File | Backend Controller / Endpoints | Primary Administrative Purpose |
| :--- | :--- | :--- | :--- |
| **Overview** (`/admin`) | [`admin/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/page.tsx) | `AdminDashboardController` (`/api/admin/dashboard/stats`, `/stats/activity`, `/stats/analytics/revenue`) | Executive KPI metrics, network GMV vs SaaS revenue charts, audit activity stream, pending KYC alert banner. |
| **Bakery Directory** (`/admin/shops`) | [`admin/shops/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx) | `AdminDashboardController` (`/api/admin/shops`, `/api/admin/shops/counts`, `/api/admin/shops/{id}/status`, `/verification`) | Multi-tenant bakery search, status filter tabs (All, Pending, Active, Suspended, Deleted), bulk actions, suspension & KYC rejection. |
| **Shop Details & KYC** (`/admin/shops/[id]`) | [`admin/shops/[id]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/[id]/page.tsx) | `AdminDashboardController` (`/api/admin/shops/{id}`, `/status`, `/verification`, `/marketplace-restriction`), `DocumentAccessController` (`/api/admin/documents/{id}/view`) | Full tenant audit, KYC document verification (Approve/Reject/Under Review), marketplace restriction toggle, secure HMAC document viewing, activity log. |
| **Orders Ledger** (`/admin/orders`) | [`admin/orders/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/orders/page.tsx) | `AdminOrderController` (`/api/admin/orders`, `/api/admin/orders/{id}`) | Cross-shop order governance, order/payment status filters, date range filters, detail modal with line items, addresses, and customer data masking. |
| **Payments Ledger** (`/admin/payments`) | [`admin/payments/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/payments/page.tsx) | `AdminPaymentController` (`/api/admin/payments`, `/api/admin/payments/{id}`) | Cross-shop financial ledger, 3-tier classification (Subscription, Retail Order, Unknown), gateway transaction IDs, discrepancy diagnostics. |
| **SaaS Plans** (`/admin/plans`) | [`admin/plans/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/plans/page.tsx) | `AdminSubscriptionPlanController` (`/api/admin/plans`, `/api/admin/plans/{id}`, `/reorder`, `/{id}/status`) | Subscription tier pricing, quotas, features, billing cycles (monthly/yearly), active/inactive toggle, drag/order reordering persistence. |
| **Notification Center** (`/admin/notifications`) | [`admin/notifications/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/notifications/page.tsx) | `AdminNotificationController` (`/api/admin/notifications`, `/unread-count`, `/{id}/read`, `/read-all`) | 9-category platform notification inbox, search, mark read, mark all read, deep navigation to referenced entities. |
| **Broadcast Messages** (`/admin/messages`) | [`admin/messages/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx) | `AdminMessageController` (`/api/admin/messages`, `/api/admin/messages/history`) | System-wide broadcasts to all or specific bakery owners, idempotency key reservation, recovery from interrupted dispatch, history table. |
| **Platform Feedback** (`/admin/feedback`) | [`admin/feedback/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/feedback/page.tsx) | `AdminCommunicationController` (`/api/admin/feedback`, `/{id}/read`, `/{id}/reply`, `/communication/summary`) | Owner feedback review, rating stars, read/unread filters, inline reply composer with draft preservation. |
| **Contact Enquiries** (`/admin/enquiries`) | [`admin/enquiries/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx) | `AdminCommunicationController` (`/api/admin/enquiries`, `/{id}/read`, `/{id}/reply`, `/communication/summary`) | Storefront visitor enquiries, read/unread filters, contact info (phone/email), inline reply composer with draft preservation. |
| **Global Settings** (`/admin/settings`) | [`admin/settings/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/settings/page.tsx) | `AdminSettingsController` (`/api/admin/settings`) | Platform identity, Razorpay key ID, secret encryption masks, platform currency, dirty state tracking (`useUnsavedChanges`). |
| **Admin Chat** (Backend Only) | *No frontend page* | `AdminChatController` (`/api/admin/chat/conversations`, `/{ownerId}/messages`, `/{ownerId}/read`, `/unread-count`) | Direct real-time chat with individual shop owners. Backend is complete; frontend UI is unbuilt. |

### Administrative Modals & Global Components
- [`AdminCommandPalette.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminCommandPalette.tsx): Global Ctrl+K / Cmd+K search across bakeries, feedback, enquiries, notifications, and navigation shortcuts.
- [`AdminNotificationBell.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminNotificationBell.tsx): Header notification bell with badge counter, 60s background polling, and real-time STOMP/SockJS WebSocket integration (`/ws-endpoint`).
- [`AdminRefreshContext.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/context/AdminRefreshContext.tsx) & Header Button in [`admin/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx): Synchronous ref-locked `Promise.allSettled` execution with spinning icon, aria attributes, and DOM event fallback.
- [`AdminSuspensionModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/shops/AdminSuspensionModal.tsx): Mandatory non-blank reason prompt before revoking shop operational status.
- [`AdminKycRejectionModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/shops/AdminKycRejectionModal.tsx): Mandatory non-blank explanation sent to owner when KYC documents are rejected.
- [`AdminMarketplaceRestrictionModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/shops/AdminMarketplaceRestrictionModal.tsx): Administrative restriction to hide shop from marketplace discovery while keeping owner dashboard operational.
- [`AdminPlanModal.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/plans/AdminPlanModal.tsx): Create and edit pricing tiers with validation against negative prices and zero duration.

---

## 2. Detailed Section-by-Section Findings

### 2.1 Overview (`/admin`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Fetches `getPlatformStats(startDate, endDate)`, `getAllShops(0, 5)`, `getRecentActivity()`, `communicationApi.getCommunicationSummary()`, and `adminSettingsApi.getSettings()`.
- **Filtering:** Date range selector (`All Time`, `Today`, `Last 7 Days`, `Last 30 Days`, `This Month`) correctly recalibrates stats and revenue charts.
- **Race Condition Guard:** Employs `fetchSeqRef` to discard out-of-order network responses.
- **Refresh Behavior:** Registered with `useRegisterAdminRefresh(() => loadData(true))`; manual refresh fires confirmation toast (`'Dashboard metrics refreshed'`).
- **Tests:** Covered by `adminMetricsPresentation.test.mjs` (10 tests) and `adminGlobalRefreshRemediation.test.mjs`.

### 2.2 Bakery / Shop Management (`/admin/shops`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Uses lightweight `/api/admin/shops/counts` for tab badge counters (All, Pending, Active, Suspended, Deleted) and paginated `/api/admin/shops` (size 20).
- **Search & Filter:** Keystroke debouncing (500ms) synchronized with browser URL parameters (`?search=...&status=...`).
- **Bulk Operations:** Multi-row selection with bulk Approve, Suspend, and KYC Reject actions.
- **Modals:** Single-row and bulk operations enforce mandatory reasons via `AdminSuspensionModal` and `AdminKycRejectionModal`.
- **Storefront Availability Indicator:** Accurately calculates `ACTIVE • STORE LIVE` vs `ACTIVE • STORE OFFLINE` (with discrete reasons: `Sub: EXPIRED`, `Sub: NONE`, `Paused by Owner`, `Marketplace Restricted`).
- **Refresh Behavior:** Registered with `useRegisterAdminRefresh(() => fetchShops(true))`.
- **Tests:** Covered by `bakeryStatusLabelsPhase2.test.mjs` (12 tests) and `adminMarketplaceRestrictionAndDeletedShops.test.mjs` (21 tests).

### 2.3 Shop Details & KYC Verification (`/admin/shops/[id]`)
- **Status:** **IMPLEMENTED BUT NOT RUNTIME-VERIFIED** (Minor refresh gap noted)
- **Data & API:** Fetches deep tenant object from `/api/admin/shops/{id}`.
- **KYC Review Actions:** Approves, Rejects, or Marks Under Review. Rejection requires a mandatory reason.
- **Marketplace Restriction:** Admin can toggle restriction on/off with custom reasoning; owner dashboard remains unlocked.
- **Secure Document Viewing:** Integrates with `DocumentAccessController` via `getAdminDocumentViewUrl(docId)`. Generates an HMAC-SHA256 signed URL (`/api/documents/secure-view/{id}?expires=...&sig=...`). Public access to `/uploads/documents/**` is blocked by `SecurityConfig.denyAll()`.
- **Defect / Gap:** Listens to `window.addEventListener('adminGlobalRefresh', handleRefresh)` but is **not registered with `useRegisterAdminRefresh`**. The header button spinner does not await `loadShop()`.
- **Tests:** Covered by `bakeryDetailsSubscriptionMapping.test.mjs` (3 tests) and backend `AdminDocumentAccessSecurityTest.java`.

### 2.4 Orders Ledger (`/admin/orders`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Calls `/api/admin/orders` with pagination (max 50) and `/api/admin/orders/{id}` for detail modal.
- **Filtering:** Cross-shop query search (debounced 400ms), order status filter (8 states), payment status filter (8 states), and date range with start-before-end validation.
- **Detail Modal:** Displays bakery name, delivery slot, customer address, line items, and masked customer phone/email.
- **Race Condition Guard:** Uses `fetchSeqRef` to discard stale async responses.
- **Refresh Behavior:** Registered with `useRegisterAdminRefresh(() => fetchOrders(true))`.
- **Tests:** Covered by `adminLedgerConcurrency.test.mjs` and `adminGlobalRefreshRemediation.test.mjs`.

### 2.5 Payments Ledger (`/admin/payments`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Calls `/api/admin/payments` with pagination (max 50) and `/api/admin/payments/{id}` for detail modal.
- **3-Tier Transaction Classification:** Accurately separates Subscription fees, Retail Customer Orders, and Unknown/Unlinked transactions.
- **Detail Modal:** Displays gateway transaction ID, razorpay payment/order IDs, fee breakdowns, and discrepancy diagnostic alerts.
- **Race Condition Guard:** Uses `fetchSeqRef` to discard stale async responses.
- **Refresh Behavior:** Registered with `useRegisterAdminRefresh(() => fetchPayments(true))`.
- **Tests:** Covered by `adminLedgerConcurrency.test.mjs` and `adminGlobalRefreshRemediation.test.mjs`.

### 2.6 Plans & Subscriptions (`/admin/plans`)
- **Status:** **IMPLEMENTED BUT NOT RUNTIME-VERIFIED**
- **Data & API:** Calls `/api/admin/plans` for list, `/plans/{id}/status` for activation toggle, and `PUT /api/admin/plans/reorder` for display order updates.
- **Plan Modal (`AdminPlanModal.tsx`):** Supports creating and updating plans with input validation (price >= 0, durationDays > 0, billingCycle in ['monthly', 'yearly']).
- **Plan Ordering:** Supports manual reordering using up/down arrow controls and persists the full array of IDs to `/api/admin/plans/reorder`.
- **Refresh Behavior:** Registered with `useRegisterAdminRefresh(() => loadPlans(true))`.
- **Runtime Verification Requirement:** Reorder persistence and plan creation need browser verification against the running database.

### 2.7 Notification Center & Header Bell (`/admin/notifications`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Calls `/api/admin/notifications` with 9 category filters, search debounce, and pagination.
- **Actions:** Mark as read (`PATCH /{id}/read`) and Mark all as read (`POST /mark-all-read`).
- **Header Bell (`AdminNotificationBell.tsx`):** Shows live unread count badge, polls every 60s, and connects via SockJS/STOMP to `/ws-endpoint` on topic `/topic/admin/notifications`.
- **Routing:** Notification clicks navigate directly to target entities (`/admin/shops/{id}`, `/admin/feedback`, etc.).
- **Refresh Behavior:** Both page and bell are registered with `useRegisterAdminRefresh`.
- **Tests:** Covered by `adminNotificationsErrorHandling.test.mjs` (7 tests).

### 2.8 Broadcast Announcements (`/admin/messages`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Calls `POST /api/admin/messages` and `GET /api/admin/messages/history`.
- **Reliability & Idempotency:** Assigns UUID `idempotencyKey`, handles PostgreSQL row lock contention (`HTTP 429 Retry-After: 2`), handles duplicate submissions (`HTTP 409 Conflict`), and persists uncertain in-flight requests in `sessionStorage` to prevent double-messaging.
- **Refresh Behavior:** Registered with `useRegisterAdminRefresh(() => fetchHistory())`.
- **Tests:** Covered by `adminBroadcastLifecycle.test.mjs` (8 tests).

### 2.9 Platform Feedback (`/admin/feedback`)
- **Status:** **COMPLETE AND VERIFIED** (Minor refresh gap noted)
- **Data & API:** Calls `/api/admin/feedback` with `isRead` and `search` filters.
- **Actions:** Mark as read (`PATCH /feedback/{id}/read`) and Admin reply (`POST /feedback/{id}/reply`).
- **Reply Experience:** Inline reply drawer preserves draft message on network failure and updates UI optimistically upon success.
- **Defect / Gap:** Listens to `window.addEventListener('adminGlobalRefresh', handleRefresh)` but is **not registered with `useRegisterAdminRefresh`**.
- **Tests:** Covered by `platformFeedbackErrorHandling.test.mjs` (5 tests).

### 2.10 Contact Enquiries (`/admin/enquiries`)
- **Status:** **COMPLETE AND VERIFIED** (Minor refresh gap noted)
- **Data & API:** Calls `/api/admin/enquiries` with `isRead` and `search` filters.
- **Actions:** Mark as read (`PATCH /enquiries/{id}/read`) and Admin reply (`POST /enquiries/{id}/reply`).
- **Reply Experience:** Inline reply drawer displays sender name, phone, email, and timestamp, with draft preservation on error.
- **Defect / Gap:** Listens to `window.addEventListener('adminGlobalRefresh', handleRefresh)` but is **not registered with `useRegisterAdminRefresh`**.
- **Tests:** Covered by `contactEnquiriesErrorHandling.test.mjs` (7 tests).

### 2.11 Global Platform Settings (`/admin/settings`)
- **Status:** **COMPLETE AND VERIFIED**
- **Data & API:** Calls `/api/admin/settings` (GET and PUT).
- **Protection:** Integrates `useUnsavedChanges` to track dirty state against baseline settings.
- **Refresh Safety:** If user has uncommitted form edits, global refresh skips fetching and displays an informational toast (`'Settings form has unsaved edits. Refresh skipped to protect your changes.'`).
- **Security:** Secret fields (`razorpayKeySecret`, `razorpayWebhookSecret`) display masked values and are never sent as blank strings on partial edits.
- **Tests:** Covered by `adminGlobalSettingsRemediationPhase1.test.mjs` (11 tests) and `dirtyStateTracking.test.mjs`.

### 2.12 Admin Chat Support
- **Status:** **MISSING** (Frontend UI not implemented)
- **Backend Ready:** [`AdminChatController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/chat/AdminChatController.java) provides:
  - `GET /api/admin/chat/conversations`: Returns all active owner-admin conversations with unread counts.
  - `GET /api/admin/chat/conversations/{ownerId}/messages`: Returns full message history.
  - `POST /api/admin/chat/conversations/{ownerId}/messages`: Dispatches message to owner.
  - `PATCH /api/admin/chat/conversations/{ownerId}/read`: Marks conversation read.
  - `GET /api/admin/chat/unread-count`: Returns unread message count for admin.
- **Frontend Defect:** No `/admin/chat` route, sidebar nav link, or chat drawer exists in `frontend_v2`.

---

## 3. Prioritized Gap List

| # | Priority | Classification | Area / Feature | Finding & Description | Impact |
|:---|:---:|:---:|:---|:---|:---|
| **GAP-01** | **Medium** | **PARTIALLY IMPLEMENTED** | Global Refresh Coordination | [`admin/shops/[id]`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/[id]/page.tsx), [`admin/feedback`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/feedback/page.tsx), and [`admin/enquiries`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx) listen for the DOM event `adminGlobalRefresh` but do not register their async fetches with `useRegisterAdminRefresh()`. | When viewing a shop detail, feedback, or enquiry page, clicking the header Refresh button initiates data loading but the header button spinner immediately stops spinning before data finishes loading. |
| **GAP-02** | **Medium** | **MISSING** | Admin Direct Chat UI | Backend [`AdminChatController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/chat/AdminChatController.java) is fully operational, but `frontend_v2` has no `/admin/chat` page or chat drawer to communicate with bakery owners. | Super admin cannot conduct real-time 1-on-1 chats with shop owners from the web interface, relying solely on Broadcasts or Feedback replies. |
| **GAP-03** | **Low** | **IMPLEMENTED BUT NOT RUNTIME-VERIFIED** | Plans Drag / Reorder Persistence | `PUT /api/admin/plans/reorder` endpoint and frontend reorder state are built and compiled, but reordering with a live database transaction requires browser confirmation. | Edge cases in array order indexing or transaction rollbacks could occur under concurrent administrative sessions. |
| **GAP-04** | **Low** | **IMPLEMENTED BUT NOT RUNTIME-VERIFIED** | WebSocket STOMP Live Notifications | [`AdminNotificationBell.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminNotificationBell.tsx) has fallback polling (60s) and STOMP socket subscription logic. | STOMP handshake over `/ws-endpoint` needs live backend runtime verification to verify SockJS fallback when WebSockets are blocked by proxies. |

---

## 4. Evidence and File References

### Frontend Core Implementations
- **Layout & Shell:** [`frontend_v2/app/admin/layout.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/layout.tsx)
- **Refresh Coordination:** [`frontend_v2/context/AdminRefreshContext.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/context/AdminRefreshContext.tsx)
- **Overview Dashboard:** [`frontend_v2/app/admin/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/page.tsx)
- **Bakery Directory:** [`frontend_v2/app/admin/shops/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/page.tsx)
- **Shop Detail & KYC Review:** [`frontend_v2/app/admin/shops/[id]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/[id]/page.tsx)
- **Orders Ledger:** [`frontend_v2/app/admin/orders/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/orders/page.tsx)
- **Payments Ledger:** [`frontend_v2/app/admin/payments/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/payments/page.tsx)
- **SaaS Plans Management:** [`frontend_v2/app/admin/plans/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/plans/page.tsx)
- **Notification Center:** [`frontend_v2/app/admin/notifications/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/notifications/page.tsx)
- **Broadcast Announcements:** [`frontend_v2/app/admin/messages/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx)
- **Platform Feedback:** [`frontend_v2/app/admin/feedback/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/feedback/page.tsx)
- **Contact Enquiries:** [`frontend_v2/app/admin/enquiries/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx)
- **Global Settings:** [`frontend_v2/app/admin/settings/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/settings/page.tsx)
- **Command Palette:** [`frontend_v2/components/admin/AdminCommandPalette.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminCommandPalette.tsx)
- **Notification Bell:** [`frontend_v2/components/admin/AdminNotificationBell.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/components/admin/AdminNotificationBell.tsx)

### Backend Controllers & Services
- **Dashboard & Shops:** [`AdminDashboardController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminDashboardController.java)
- **Orders Governance:** [`AdminOrderController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminOrderController.java)
- **Payments Governance:** [`AdminPaymentController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/controller/AdminPaymentController.java)
- **Plans Management:** [`AdminSubscriptionPlanController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/AdminSubscriptionPlanController.java)
- **Notifications:** [`AdminNotificationController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/controller/AdminNotificationController.java)
- **Broadcasts:** [`AdminMessageController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java)
- **Feedback & Enquiries:** [`AdminCommunicationController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/communication/controller/AdminCommunicationController.java)
- **Chat Service:** [`AdminChatController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/chat/AdminChatController.java)
- **Global Settings:** [`AdminSettingsController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/controller/AdminSettingsController.java)
- **Secure Documents:** [`DocumentAccessController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/shop/controller/DocumentAccessController.java)
- **Security Chain:** [`SecurityConfig.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java)

---

## 5. Verification Matrix and Test Status

| Audit Check | Method | Result | Evidence |
| :--- | :---: | :---: | :--- |
| **TypeScript / Next.js Build** | Static analysis / compilation | **PASS** | `npm run build` cleanly compiled all 38 production routes in `frontend_v2`. |
| **ESLint Standards** | Static linting | **PASS** | `npm run lint` reported 0 errors and 0 warnings. |
| **Automated Unit & Integration Tests** | Node test runner | **PASS** (122/122) | All 15 test suites passed in 1.47 seconds (`npm test`). |
| **Role-Based Access Control (RBAC)** | Code inspection | **PASS** | `admin/layout.tsx` enforces `ROLE_ADMIN`; backend enforces `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`. |
| **Private Document Storage Security** | Code inspection & unit test | **PASS** | `DocumentSecurityIntegrationTest.java` + HMAC signed URLs prevent arbitrary filesystem access. |
| **Stale Async Network Responses** | Code inspection | **PASS** | `fetchSeqRef` monotonic sequence counters in Overview, Orders, and Payments pages prevent out-of-order state corruption. |
| **Settings Dirty State Protection** | Code inspection & unit test | **PASS** | `dirtyStateTracking.test.mjs` verifies uncommitted edits are protected against unexpected page refresh. |
| **Global Refresh Registration Consistency** | Code inspection | **PARTIAL** | 8 of 11 routes use `useRegisterAdminRefresh`; 3 routes (`shops/[id]`, `feedback`, `enquiries`) only use the DOM listener. |

---

## 6. Recommended Implementation Order

Before transitioning focus to the Shop Owner Dashboard (`/dashboard`), the following small remediation steps are recommended to bring the Super Admin Portal to 100% acceptance:

1. **Phase 1: Close Subpage Refresh Coordination Gaps (GAP-01)**
   - Wire `useRegisterAdminRefresh()` in [`admin/shops/[id]/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/shops/[id]/page.tsx) to register `loadShop()`.
   - Wire `useRegisterAdminRefresh()` in [`admin/feedback/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/feedback/page.tsx) to register `fetchFeedback()`.
   - Wire `useRegisterAdminRefresh()` in [`admin/enquiries/page.tsx`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/enquiries/page.tsx) to register `fetchEnquiries()`.
   - Verify all 11 admin pages properly coordinate with the header Refresh button.

2. **Phase 2: Decide on Admin Chat Interface (GAP-02)**
   - Confirm whether 1-on-1 Admin Chat with Bakery Owners is desired in the Super Admin Portal or should be deferred as a future feature.
   - If desired: add `/admin/chat` route or drawer component connecting to `AdminChatController.java`.
   - If deferred: document that broadcast announcements and feedback replies serve as the active communication channels.

3. **Phase 3: Transition to Shop Owner Dashboard Audit**
   - Begin systematic audit of the Shop Owner Dashboard (`frontend_v2/app/dashboard/**`), starting with authentication, tenant isolation, and the shop owner refresh mechanism.

---

**Report complete. Awaiting user review and direction.**
