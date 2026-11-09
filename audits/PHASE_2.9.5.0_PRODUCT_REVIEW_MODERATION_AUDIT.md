# CakeStore — Phase 2.9.5.0: Product Review Moderation Read-Only Implementation Audit

**Date:** November 5, 2026  
**Auditor:** Antigravity  
**Mode:** Strictly Read-Only Investigation  
**Target:** Product Review Subsystem & Super Admin Moderation Architecture  
**Verdict:** **CRITICAL ARCHITECTURAL GAP IDENTIFIED** (Super Admin review moderation is entirely absent across backend APIs, database schema, and frontend UI)

---

## 1. Executive Summary

A comprehensive, read-only audit of the CakeStore product review system was conducted to establish current capabilities, investigate customer eligibility validation, analyze rating calculation logic, examine bakery owner permissions, and design a secure Super Admin review moderation workflow.

### Key Audit Findings
1. **Dual Review Architecture:** CakeStore contains two review mechanisms:
   - **Modern Verified Product Reviews** (`product_reviews` table, `ProductReview.java`, `ProductReviewService.java`): A verified-order review system linked to individual products and order items (introduced in Flyway migrations V11, V30, V31).
   - **Legacy Shop Feedback** (`feedback` table, `Feedback.java`, `OwnerInteractionService.java`): An earlier testimonial/feedback system that possessed basic moderation flags (`is_approved`, `deleted_at`, `deleted_by`).
2. **Total Absence of Super Admin Review Moderation:**
   - The modern `product_reviews` table has **no moderation status** column (`status`, `is_approved`, `is_hidden`, `moderated_at`, `moderated_by`, or `moderation_reason` do not exist).
   - There is **no `AdminProductReviewController`**, no admin review endpoints (`/api/admin/reviews`), and no admin review page in `frontend_v2/app/admin`.
   - **Every submitted review is instantly public:** 100% of reviews saved in `product_reviews` are immediately visible on the customer storefront and factored into product rating calculations without administrator oversight.
3. **Rigid Customer Review Eligibility (Well Implemented):**
   - The backend enforces strict multi-condition verification before accepting a review: Shop must be active, Product must belong to Shop, Order must be in `DELIVERED` or `COMPLETED` status, Customer phone must match the order, OrderItem must belong to the order, and OrderItem must not have been previously reviewed (`order_item_id` unique constraint).
4. **Owner Permissions & Anti-Censorship Design:**
   - Bakery owners can view verified reviews for their own shop and submit a public reply (`OwnerProductReviewController`).
   - By design, bakery owners **cannot delete or hide customer reviews**, preventing bakeries from censoring negative customer feedback. However, because Super Admins also lack moderation controls, abusive or defamatory content cannot be hidden through the platform.

---

## 2. Inventory of Relevant Files

### 2.1 Backend Implementation Files
- **Entities & Schema:**
  - `backend/src/main/java/com/cakeplatform/api/modules/review/ProductReview.java`
  - `backend/src/main/resources/db/migration/V11__product_reviews.sql`
  - `backend/src/main/resources/db/migration/V30__add_media_to_product_reviews.sql`
  - `backend/src/main/resources/db/migration/V31__add_edit_token_to_reviews_and_feedback.sql`
  - *(Legacy)* `backend/src/main/java/com/cakeplatform/api/modules/interaction/Feedback.java`
- **Repositories:**
  - `backend/src/main/java/com/cakeplatform/api/modules/review/ProductReviewRepository.java`
  - *(Legacy)* `backend/src/main/java/com/cakeplatform/api/modules/interaction/FeedbackRepository.java`
- **Services:**
  - `backend/src/main/java/com/cakeplatform/api/modules/review/service/ProductReviewService.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/storefront/CustomerStorefrontService.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/interaction/OwnerInteractionService.java`
- **Controllers:**
  - `backend/src/main/java/com/cakeplatform/api/modules/review/controller/CustomerProductReviewController.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/review/controller/OwnerProductReviewController.java`
  - *(Legacy)* `backend/src/main/java/com/cakeplatform/api/modules/interaction/controller/OwnerInteractionController.java`
- **DTOs:**
  - `backend/src/main/java/com/cakeplatform/api/modules/review/dto/OrderItemEligibilityResponse.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/review/dto/OwnerProductReviewResponse.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/review/dto/OwnerReviewReplyRequest.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/review/dto/ProductReviewsSummaryResponse.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/review/dto/PublicProductReviewResponse.java`
  - `backend/src/main/java/com/cakeplatform/api/modules/review/dto/SubmitProductReviewRequest.java`

### 2.2 Frontend Implementation Files
- **API Clients:**
  - `frontend_v2/lib/api/reviews.ts`
  - `frontend_v2/lib/api/owner.ts`
  - `frontend_v2/lib/api/admin.ts`
- **Customer Storefront UI:**
  - `frontend_v2/app/shop/[id]/product/[productId]/page.tsx`
  - `frontend_v2/components/customer/storefront/ProductDetailModal.tsx`
  - `frontend_v2/components/customer/storefront/CakeReviewModal.tsx`
  - `frontend_v2/components/customer/storefront/ProductReviewSubmissionModal.tsx`
  - `frontend_v2/components/customer/storefront/ProductCard.tsx`
  - `frontend_v2/components/customer/storefront/tabs/StorefrontHomeTab.tsx`
  - `frontend_v2/components/customer/marketplace/BakeryCard.tsx`
- **Bakery Owner Dashboard:**
  - `frontend_v2/app/dashboard/owner/reviews/page.tsx`
  - `frontend_v2/components/owner/ReviewDetailsModal.tsx`
- **Super Admin Dashboard:**
  - `frontend_v2/app/admin/layout.tsx` (Sidebar navigation — currently lacks a Reviews route)

---

## 3. Database Schema Findings

### 3.1 PostgreSQL Table: `product_reviews`
Inspected directly from database `cake_platform`:

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|:---:|---|---|
| `id` | `BIGINT` | **NOT NULL** | PRIMARY KEY, `nextval(...)` | Review unique ID |
| `shop_id` | `BIGINT` | **NOT NULL** | FK `shops(id)` ON DELETE CASCADE | Associated bakery |
| `product_id` | `BIGINT` | **NOT NULL** | FK `products(id)` ON DELETE CASCADE | Associated cake product |
| `order_id` | `BIGINT` | **NOT NULL** | FK `orders(id)` ON DELETE CASCADE | Verified celebration order |
| `order_item_id` | `BIGINT` | **NOT NULL** | FK `order_items(id)` ON DELETE CASCADE, **UNIQUE** | 1 review per item purchased |
| `customer_name` | `VARCHAR(255)` | **NOT NULL** | None | Full customer name |
| `customer_phone` | `VARCHAR(255)` | NULL | None | Customer phone |
| `rating` | `INTEGER` | **NOT NULL** | `CHECK (rating >= 1 AND rating <= 5)` | 1 to 5 star rating |
| `review_text` | `TEXT` | NULL | None | Review text body |
| `is_verified_purchase` | `BOOLEAN` | **NOT NULL** | `DEFAULT true` | Verified purchase indicator |
| `owner_reply` | `TEXT` | NULL | None | Bakery owner response text |
| `owner_replied_at` | `TIMESTAMP` | NULL | None | Owner response timestamp |
| `cake_image_url` | `VARCHAR(1000)` | NULL | None | Customer photo upload |
| `cake_video_url` | `VARCHAR(1000)` | NULL | None | Customer video upload |
| `edit_token` | `VARCHAR(100)` | NULL | Indexed | Customer edit/delete authorization token |
| `created_at` | `TIMESTAMP` | **NOT NULL** | `DEFAULT CURRENT_TIMESTAMP` | Submission timestamp |
| `updated_at` | `TIMESTAMP` | **NOT NULL** | `DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

### 3.2 Indexes
- `product_reviews_pkey` (PRIMARY KEY on `id`)
- `idx_product_reviews_product_id` on `product_id`
- `idx_product_reviews_shop_id` on `shop_id`
- `idx_product_reviews_order_id` on `order_id`
- `idx_product_reviews_edit_token` on `edit_token`
- `product_reviews_order_item_id_key` (UNIQUE on `order_item_id`)

### 3.3 Critical Schema Gap
There are **zero moderation columns** on `product_reviews`. Specifically, it lacks:
- No `status` or `is_hidden` or `is_approved` column.
- No `moderated_at` timestamp.
- No `moderated_by` user ID.
- No `moderation_reason` text.

---

## 4. Existing Review API Inventory

| HTTP Method | URL Path | Authorization | Controller / Service | Purpose |
|---|---|---|---|---|
| **GET** | `/api/storefront/shops/{shopId}/products/{productId}/reviews` | Public (Unauthenticated) | `CustomerProductReviewController` | Returns product reviews summary, average rating, star breakdown, and review list |
| **POST** | `/api/storefront/shops/{shopId}/products/{productId}/reviews` | Public (Verified Order) | `CustomerProductReviewController` | Submits a verified review for a purchased order item |
| **GET** | `/api/storefront/shops/{shopId}/reviews/eligibility` | Public (Verified Order) | `CustomerProductReviewController` | Checks which order items in an order are eligible for review |
| **PUT** | `/api/storefront/shops/{shopId}/products/{productId}/reviews/{reviewId}` | Public (Edit Token/Order) | `CustomerProductReviewController` | Allows author to update their review |
| **DELETE** | `/api/storefront/shops/{shopId}/products/{productId}/reviews/{reviewId}` | Public (Edit Token/Order) | `CustomerProductReviewController` | Allows author to delete their review |
| **GET** | `/api/owner/product-reviews` | `ROLE_SHOP_OWNER` | `OwnerProductReviewController` | Paginated search of verified reviews for the authenticated owner's bakery |
| **POST** | `/api/owner/product-reviews/{reviewId}/reply` | `ROLE_SHOP_OWNER` | `OwnerProductReviewController` | Submits/updates owner reply to a customer review and notifies customer |
| *(Admin)* | *None* | *None* | *None* | **NO ADMIN REVIEW ENDPOINTS EXIST** |

---

## 5. Customer Review Eligibility & Verification Analysis

The review submission pipeline in `ProductReviewService.java` (`submitReview`, lines 72–120) enforces an airtight set of validations:

1. **Active Bakery Guard (Line 74):** Throws `IllegalStateException("Bakery is currently unavailable")` if shop status is not `ACTIVE`.
2. **Product Shop Ownership (Lines 77–81):** Throws `IllegalArgumentException("Product does not belong to this bakery")` if `product.shop.id != shopId`.
3. **Order Shop Ownership (Lines 84–88):** Resolves order by order number and verifies `order.shop.id == shopId`.
4. **Order Delivery Status Check (Lines 91–94):** Order status must strictly be `DELIVERED` or `COMPLETED`. In-flight or pending orders (`PREPARING`, `OUT_FOR_DELIVERY`, `PENDING`) are rejected with `IllegalStateException("Only delivered or completed celebration orders can be reviewed. Current status: " + status)`.
5. **Customer Phone Verification (Lines 96–101):** Validates normalized customer phone against `order.customerPhone`. Mismatches throw `SecurityException("Provided customer phone number does not match the delivery record for this order")`.
6. **OrderItem Validation (Lines 103–113):** Verifies that `orderItemId` exists, belongs to the specified order, and corresponds to the product being reviewed.
7. **Duplicate Review Prevention (Lines 116–118 & DB constraint):**
   - Application check: `productReviewRepository.existsByOrderItemId(orderItem.getId())` throws `IllegalStateException("A verified review has already been submitted for this purchased cake item")`.
   - Database check: `UNIQUE CONSTRAINT (order_item_id)` guarantees concurrent requests cannot submit duplicate reviews for the same cake.
8. **Customer Impersonation Protection:** One customer cannot review another customer's order without possessing both the exact uppercase order number and the matching phone number.

---

## 6. Rating Aggregation and Public Visibility Analysis

### 6.1 Product-Level Rating Calculation
In `ProductReviewService.java` (`getProductReviewsSummary`, lines 177–262):
```java
List<ProductReview> reviews = productReviewRepository.findByProductIdOrderByCreatedAtDesc(productId);
// ... combines with legacy feedback if present ...
double avg = totalCount > 0
        ? publicList.stream().mapToInt(PublicProductReviewResponse::getRating).average().orElse(0.0)
        : 0.0;
double roundedAvg = Math.round(avg * 10.0) / 10.0;
```
- **Vulnerability:** `findByProductIdOrderByCreatedAtDesc` selects **all** reviews for the product without any status filtering.
- **Impact:** An abusive, spam, or defamatory 1-star review immediately pulls down the product's public average rating upon submission, and there is no mechanism to hide it.

### 6.2 Shop-Level Rating Calculation
In `CustomerStorefrontService.java` (lines 736–739):
```java
if (feedbackRepository != null) {
    Double avgRating = feedbackRepository.calculateAverageRatingByShopId(shop.getId());
    Long totalReviews = feedbackRepository.countApprovedByShopId(shop.getId());
    response.setAverageRating(avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : null);
    response.setTotalReviews(totalReviews != null ? totalReviews : 0L);
}
```
- **Discrepancy:** The shop-level rating displayed in the Marketplace and Storefront banner uses `feedbackRepository.calculateAverageRatingByShopId(shop.getId())` (legacy feedback table), whereas the product detail modal uses `productReviewRepository` (product reviews table).
- **Moderation Status:** In `feedbackRepository`, reviews are filtered by `isApproved = true AND deletedAt IS NULL`. However, `product_reviews` has no such filter.

---

## 7. Bakery Owner Access & Tenant Isolation

### 7.1 Review Listing
- `GET /api/owner/product-reviews` resolves the authenticated owner's bakery via `shopRepository.findByOwnerId(ownerUserId)`.
- Calls `productReviewRepository.searchProductReviewsByShopId(shop.getId(), rating, search, pageable)`.
- **Tenant Isolation:** Fully enforced. An owner can only query reviews where `shop_id = ownerShopId`.

### 7.2 Review Moderation / Deletion
- Bakery owners **cannot delete or hide product reviews**.
- There is no delete endpoint in `OwnerProductReviewController`.
- In `frontend_v2/app/dashboard/owner/reviews/page.tsx` (lines 828–834), the delete action is strictly disabled for `PRODUCT_REVIEW` entries:
  ```tsx
  {review.backendSource === 'FEEDBACK' && (
    <button onClick={() => setDeleteConfirmReview(review)} ...>
  )}
  ```
- **Design Rationale:** This prevents rogue bakery owners from deleting genuine negative customer reviews.
- **Architectural Consequence:** Because owners cannot moderate reviews, **Super Admin moderation is essential** to handle abusive or illegal content.

---

## 8. Super Admin Integration Opportunities

The CakeStore Super Admin architecture has well-established, production-tested patterns that can be extended for review moderation:

1. **Controller Pattern:** Super Admin controllers (`AdminDashboardController`, `AdminSubscriptionPlanController`, `AdminOrderController`) use `@RequestMapping("/api/admin/...")` with `@PreAuthorize("hasAuthority('ROLE_ADMIN')")`.
2. **Activity Logging:** `ActivityLoggerService.logActivity(actorUserId, shopId, action, entityType, entityId, metadata)` is universally integrated for admin actions (e.g., `KYC_VERIFIED`, `SHOP_SUSPENDED`, `ADMIN_NOTIFICATIONS_BULK_READ`).
3. **Audit History & Notifications:** `AdminNotificationService.dispatchAdminNotification(...)` alerts admins on platform events.
4. **Admin UI Navigation:** `frontend_v2/app/admin/layout.tsx` defines sidebar navigation items with clean icons and badge counts. A new "Review Moderation" item can be cleanly introduced under a "Moderation" section.
5. **Data Tables & Modals:** The admin dashboard uses reusable components (`Card`, `Badge`, `Button`, `ConfirmDialog`, `LoadingState`, `EmptyState`) that match the styling needed for review moderation.

---

## 9. Automated Test Coverage

| Test Scope | Existing Test Class | Coverage Status | Notes |
|---|---|:---:|---|
| **Review Submission on Delivered Order** | `ProductReviewVerificationTest.java` | **Covered** | Unit test verifying verified purchase badge |
| **Non-Delivered Order Rejection** | `ProductReviewVerificationTest.java` | **Covered** | Unit test verifying `PREPARING` status throws exception |
| **Phone Number Mismatch Rejection** | `ProductReviewVerificationTest.java` | **Covered** | Unit test verifying `SecurityException` |
| **Duplicate Review Prevention** | `ProductReviewVerificationTest.java` | **Covered** | Unit test verifying duplicate item rejection |
| **Owner Reply Tenant Verification** | `ProductReviewVerificationTest.java` | **Covered** | Unit test verifying owner reply persistence |
| **Super Admin Review Listing** | *None* | **Missing** | No admin review controller or tests exist |
| **Super Admin Review Hide/Unhide** | *None* | **Missing** | No moderation endpoints or tests exist |
| **Public Storefront Moderation Filtering** | *None* | **Missing** | Public queries do not filter by moderation status |
| **Frontend Review Moderation UI** | *None* | **Missing** | No frontend tests exist for reviews |

---

## 10. Gap Analysis

| # | Capability | Existing Implementation | Missing / Risk | Priority |
|---|---|---|---|:---:|
| **1** | **Moderation Status Column** | `product_reviews` has no status field | Moderated reviews cannot be flagged or hidden in DB | **CRITICAL** |
| **2** | **Super Admin Moderation API** | No admin endpoints exist for reviews | Super Admin cannot list, filter, hide, or restore reviews | **CRITICAL** |
| **3** | **Public Visibility Filtering** | `findByProductIdOrderByCreatedAtDesc` fetches all reviews | Hidden/abusive reviews still affect average ratings & display | **CRITICAL** |
| **4** | **Super Admin Moderation UI** | No `/admin/reviews` page in `frontend_v2` | Admins have no UI to manage customer reviews | **HIGH** |
| **5** | **Audit Logging for Review Actions** | No activity logging for review changes | No audit trail of which admin hid/restored a review | **HIGH** |
| **6** | **Owner Notification on Moderation** | No notifications dispatched when a review is hidden | Bakery owner is unaware when a review is moderated | **MEDIUM** |
| **7** | **Customer Review Eligibility** | Implemented with phone, order, and status checks | None (Well implemented) | **ALREADY IMPLEMENTED** |
| **8** | **Owner Multi-Tenant Isolation** | Scoped to owner's shop ID | None (Well implemented) | **ALREADY IMPLEMENTED** |

---

## 11. Recommended Minimal Implementation Design

To introduce secure review moderation with the lowest blast radius, backward compatibility, and zero data loss:

### 11.1 Schema Enhancement (Flyway V58 Migration)
Add moderation columns to `product_reviews`:
```sql
ALTER TABLE product_reviews 
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS moderated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_product_reviews_moderation_status ON product_reviews(moderation_status);
```
- **Values for `moderation_status`:**
  - `PUBLISHED`: Normal active review (visible publicly, counts in rating).
  - `HIDDEN`: Moderated review hidden by Admin (hidden from customer storefront, excluded from rating).
  - `FLAGGED`: Optional state if reported by owner or flagged for review.
- **Backward Compatibility:** All existing and future reviews default to `PUBLISHED`, ensuring zero downtime or disruption to existing reviews.

### 11.2 Public Query Filtering
Update `ProductReviewRepository` queries to filter by `moderationStatus`:
```java
List<ProductReview> findByProductIdAndModerationStatusOrderByCreatedAtDesc(Long productId, String moderationStatus);

@Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = 'PUBLISHED'")
Double calculateAverageRatingByProductId(@Param("productId") Long productId);

@Query("SELECT COUNT(r) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = 'PUBLISHED'")
long countPublishedByProductId(@Param("productId") Long productId);
```
When an admin hides a review, it automatically ceases to affect the product's public rating and vanishes from the storefront.

### 11.3 Super Admin Backend API: `AdminProductReviewController`
Expose standard admin endpoints under `/api/admin/reviews`:
- `GET /api/admin/reviews`: Paginated listing with filters (`status`, `rating`, `shopId`, `search`).
- `PATCH /api/admin/reviews/{id}/moderation`: Payload `{"status": "HIDDEN", "reason": "Defamatory content"}`.
- Records an audit log entry in `activity_logs`:
  `activityLogger.logActivity(adminId, shopId, "PRODUCT_REVIEW_MODERATED", "PRODUCT_REVIEW", reviewId, "Status: HIDDEN, Reason: Defamatory content")`.

### 11.4 Super Admin Frontend: `/admin/reviews`
Create `frontend_v2/app/admin/reviews/page.tsx`:
- Data table displaying: Product Name, Bakery Name, Customer Name, Rating, Review Text, Status Badge (`PUBLISHED` vs `HIDDEN`), Created At.
- Actions: "Hide Review" (with reason modal) and "Restore Review".
- Add "Reviews" link to `frontend_v2/app/admin/layout.tsx`.

---

## 12. Proposed Implementation Phases

1. **Phase 2.9.5.1 — Schema Migration & Repository Contracts:**  
   Create Flyway V58 migration script adding `moderation_status`, `moderation_reason`, `moderated_by`, and `moderated_at`. Update `ProductReview.java` and `ProductReviewRepository.java` to filter public queries by `moderation_status = 'PUBLISHED'`.
2. **Phase 2.9.5.2 — Backend Service & Admin Controller:**  
   Implement `AdminProductReviewController.java` with role-based security (`ROLE_ADMIN`), moderation methods, and activity logging. Update `ProductReviewService.java` to handle moderation transitions and cache eviction.
3. **Phase 2.9.5.3 — Super Admin Frontend Page:**  
   Build `frontend_v2/app/admin/reviews/page.tsx` with filtering, pagination, search, status toggles, and reason modals. Add sidebar navigation in `AdminLayout.tsx`.
4. **Phase 2.9.5.4 — Automated Tests & Security Verification:**  
   Add comprehensive integration tests verifying:
   - Super Admin can list and moderate reviews.
   - Non-admin (customer/owner) receives 403 Forbidden on admin review endpoints.
   - Hiding a review removes it from the customer storefront and recalculates product average rating.
   - Restoring a review brings it back into public display and rating.
   - Regression suite (backend + frontend) passes with zero regressions.

---

## 13. Migration & Backward-Compatibility Risks

| Risk | Mitigation |
|---|---|
| **Existing reviews hidden on migration** | Add `DEFAULT 'PUBLISHED' NOT NULL` in Flyway V58; all existing reviews remain active and visible. |
| **Cache stale rating after moderation** | Invoke `storefrontCacheService.evictShopDetails(shopId)` upon review status update. |
| **Owner reply to hidden review** | When a review is `HIDDEN`, retain owner reply in database but suppress both review and reply from public storefront. Allow owner to view moderation status in dashboard. |
| **Foreign-key deletion cascade** | `moderated_by` uses `ON DELETE SET NULL` so deleting an admin user does not cascade-delete product reviews. |

---

## 14. Conclusion & Next Steps

This read-only audit establishes that while customer review verification and bakery owner reply features are solidly implemented, **Super Admin Review Moderation is currently missing entirely**.

The proposed minimal design introduces moderation with zero breaking changes, full backward compatibility, and clean architectural alignment with existing CakeStore patterns.

**Status:** Phase 2.9.5.0 Audit Complete.  
**Action:** Awaiting User Approval to proceed to Phase 2.9.5.1 (Schema Migration & Entity Implementation).

