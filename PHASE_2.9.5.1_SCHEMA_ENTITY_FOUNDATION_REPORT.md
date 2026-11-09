# CakeStore — Phase 2.9.5.1: Product Review Moderation Schema Migration & Entity Foundation Report

**Execution Date:** November 5, 2026  
**Phase:** 2.9.5.1 — Schema Migration & Entity Foundation  
**Target:** Database Migration V58, `ProductReview` Entity, `ReviewModerationStatus` Enum, `ProductReviewRepository`, and Test Suite  
**Verdict:** **SUCCESS** (All requirements implemented, migration verified on PostgreSQL 18.4, 14/14 automated tests passing with zero failures, 100% backward compatibility preserved)

---

## 1. Executive Summary

In accordance with the findings from `PHASE_2.9.5.0_PRODUCT_REVIEW_MODERATION_AUDIT.md`, Phase 2.9.5.1 establishes the schema, entity, and repository foundation required for Super Admin moderation of modern verified product reviews.

This phase was executed under strict isolation:
- No admin controllers or endpoints were created.
- No frontend pages or moderation buttons were added.
- No production databases or unrelated modules (OTP, payments, subscriptions) were touched.
- All customer verified-order review eligibility and submission flows remain preserved.
- Bakery owner review listing and public reply functionality remain fully operational.
- Legacy `feedback` aggregation and moderation mechanisms remain completely untouched.

---

## 2. Flyway Migration Details — V58

**File Created:**  
`backend/src/main/resources/db/migration/V58__add_product_review_moderation.sql`

### 2.1 Applied DDL & Constraints
```sql
-- Flyway Migration V58: Add product review moderation schema
-- CakeStore SaaS Phase 2.9.5.1 Product Review Moderation

-- 1. Add moderation columns with default 'PUBLISHED' for zero-downtime backward compatibility
ALTER TABLE product_reviews
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS moderated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

-- 2. Ensure all existing reviews have status 'PUBLISHED'
UPDATE product_reviews
SET moderation_status = 'PUBLISHED'
WHERE moderation_status IS NULL;

-- 3. Add CHECK constraint allowing only 'PUBLISHED' and 'HIDDEN'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_reviews_moderation_status'
    ) THEN
        ALTER TABLE product_reviews
            ADD CONSTRAINT chk_product_reviews_moderation_status
            CHECK (moderation_status IN ('PUBLISHED', 'HIDDEN'));
    END IF;
END $$;

-- 4. Create performance indexes for moderation queries
CREATE INDEX IF NOT EXISTS idx_product_reviews_moderation_status
    ON product_reviews(moderation_status);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_moderation
    ON product_reviews(product_id, moderation_status);

CREATE INDEX IF NOT EXISTS idx_product_reviews_moderated_by
    ON product_reviews(moderated_by);
```

### 2.2 Live Database Schema Verification (PostgreSQL 18.4)
The migration was validated and executed against the local PostgreSQL instance:
- Prior Schema Version: **57**
- Post Migration Version: **58** (`add product review moderation`)
- Status: **Success**
- Inspected Table Schema:
  - `moderation_status`: `VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'`
  - `moderation_reason`: `VARCHAR(500)`
  - `moderated_by`: `BIGINT` (Foreign Key referencing `users(id)` with `ON DELETE SET NULL`)
  - `moderated_at`: `TIMESTAMP WITHOUT TIME ZONE`
  - CHECK Constraint: `chk_product_reviews_moderation_status CHECK (moderation_status::text = ANY (ARRAY['PUBLISHED'::character varying, 'HIDDEN'::character varying]::text[]))`
  - Indexes Created:
    - `idx_product_reviews_moderation_status` on `(moderation_status)`
    - `idx_product_reviews_product_moderation` on `(product_id, moderation_status)`
    - `idx_product_reviews_moderated_by` on `(moderated_by)`

---

## 3. Entity & Enum Changes

### 3.1 New Enum: `ReviewModerationStatus`
**File Created:** `backend/src/main/java/com/cakeplatform/api/modules/review/ReviewModerationStatus.java`
- States:
  - `PUBLISHED`: Normal verified review visible on public product pages and included in rating calculations.
  - `HIDDEN`: Moderated review hidden by Super Admin, excluded from public storefront and rating calculations.

### 3.2 Entity Updates: `ProductReview.java`
**File Updated:** `backend/src/main/java/com/cakeplatform/api/modules/review/ProductReview.java`
- Added fields:
  ```java
  @Enumerated(EnumType.STRING)
  @Column(name = "moderation_status", nullable = false, length = 20)
  @Builder.Default
  private ReviewModerationStatus moderationStatus = ReviewModerationStatus.PUBLISHED;

  @Column(name = "moderation_reason", length = 500)
  private String moderationReason;

  @JsonIgnore
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "moderated_by")
  private User moderatedBy;

  @Column(name = "moderated_at")
  private LocalDateTime moderatedAt;
  ```
- Added `@PrePersist` hook ensuring `moderationStatus` defaults to `ReviewModerationStatus.PUBLISHED` and `isVerifiedPurchase` defaults to `true` even during raw instantiation.
- Added `@JsonIgnore` to `moderatedBy` to prevent accidental serialization and exposure to public storefront endpoints.

---

## 4. Repository Changes

**File Updated:** `backend/src/main/java/com/cakeplatform/api/modules/review/ProductReviewRepository.java`

All legacy methods were retained unchanged to protect existing callers. The following query methods were added:

### 4.1 Public Storefront Queries (PUBLISHED Only)
- `List<ProductReview> findByProductIdAndModerationStatusOrderByCreatedAtDesc(Long productId, ReviewModerationStatus moderationStatus)`
- `List<ProductReview> findByShopIdAndModerationStatusOrderByCreatedAtDesc(Long shopId, ReviewModerationStatus moderationStatus)`
- `@Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = :status") Double calculateAverageRatingByProductIdAndModerationStatus(@Param("productId") Long productId, @Param("status") ReviewModerationStatus status)`
- `@Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = com.cakeplatform.api.modules.review.ReviewModerationStatus.PUBLISHED") Double calculateAverageRatingByProductIdPublished(@Param("productId") Long productId)`
- `long countByProductIdAndModerationStatus(Long productId, ReviewModerationStatus moderationStatus)`
- `long countByShopIdAndModerationStatus(Long shopId, ReviewModerationStatus moderationStatus)`
- `@Query("SELECT r.rating, COUNT(r) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = :status GROUP BY r.rating") List<Object[]> getRatingBreakdownByProductIdAndModerationStatus(@Param("productId") Long productId, @Param("status") ReviewModerationStatus status)`

### 4.2 Super Admin Moderation Queries
- `Page<ProductReview> findAllByOrderByCreatedAtDesc(Pageable pageable)`
- `Page<ProductReview> findByModerationStatusOrderByCreatedAtDesc(ReviewModerationStatus moderationStatus, Pageable pageable)`
- `List<ProductReview> findByModerationStatusOrderByCreatedAtDesc(ReviewModerationStatus moderationStatus)`
- `@Query(...) Page<ProductReview> searchAllReviewsForAdmin(@Param("status") ReviewModerationStatus status, @Param("shopId") Long shopId, @Param("rating") Integer rating, @Param("query") String query, Pageable pageable)`

---

## 5. Affected Call Sites & Service Alignment

1. **`ProductReviewService.java` (`getProductReviewsSummary`)**:
   - Updated line 187:
     ```java
     // Before:
     List<ProductReview> reviews = productReviewRepository.findByProductIdOrderByCreatedAtDesc(productId);
     // After:
     List<ProductReview> reviews = productReviewRepository.findByProductIdAndModerationStatusOrderByCreatedAtDesc(productId, ReviewModerationStatus.PUBLISHED);
     ```
   - **Protection Effect:** Any review marked `HIDDEN` is immediately omitted from the customer-facing review list and from the product's average rating calculation.
2. **Owner Review Listing (`searchProductReviewsByShopId`)**:
   - Preserved as-is. Bakery owners continue to view all verified reviews for their bakery and retain the ability to submit public replies.
3. **Legacy Feedback (`FeedbackRepository`)**:
   - Left 100% untouched. Legacy shop-level feedback queries and approvals function without alteration.

---

## 6. Verification & Automated Test Suite

A comprehensive test suite was written in `ProductReviewModerationSchemaAndRepositoryTest.java` running against the live PostgreSQL test database with proper test-isolation cleanup.

### 6.1 Test Execution Results
Command executed:
```powershell
mvn test '-Dtest=ProductReviewVerificationTest,ProductReviewModerationSchemaAndRepositoryTest' -f backend/pom.xml
```

**Results:**
```
[INFO] Running com.cakeplatform.api.modules.review.ProductReviewModerationSchemaAndRepositoryTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 34.69 s -- in com.cakeplatform.api.modules.review.ProductReviewModerationSchemaAndRepositoryTest
[INFO] Running com.cakeplatform.api.modules.review.ProductReviewVerificationTest
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.713 s -- in com.cakeplatform.api.modules.review.ProductReviewVerificationTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### 6.2 Test Coverage Summary
| Test # | Test Method | Verification Target | Status |
|---|---|---|:---:|
| 1 | `testNewReview_DefaultsToPublished` | Verifies new reviews default to `PUBLISHED` with null moderation metadata | **PASSED** |
| 2 | `testCheckConstraint_RejectsInvalidStatus` | Verifies DB CHECK constraint rejects invalid values (`PENDING_APPROVAL`) | **PASSED** |
| 3 | `testCheckConstraint_AllowsPublishedAndHidden` | Verifies DB allows both `PUBLISHED` and `HIDDEN` transitions | **PASSED** |
| 4 | `testPublishedQueries_ExcludeHiddenReviews` | Verifies `PUBLISHED` queries omit `HIDDEN` reviews and calculate ratings correctly | **PASSED** |
| 5 | `testHiddenReviews_RemainStored` | Verifies `HIDDEN` reviews remain stored with reasons and moderator IDs | **PASSED** |
| 6 | `testPublicStorefrontSummary_ExcludesHiddenReviews` | Verifies public storefront summary excludes hidden reviews and recalculates avg rating | **PASSED** |
| 7 | `testAdminModerationQueries_FilterAndSearch` | Verifies admin query filtering by status, search term, and pagination | **PASSED** |
| 8 | `testModeratedBy_ForeignKeyOnDeleteSetNull` | Verifies foreign key `ON DELETE SET NULL` when moderator user is removed | **PASSED** |
| 9 | `testLegacyFeedback_RemainsUnchanged` | Verifies legacy `feedback` count and rating calculations remain unaffected | **PASSED** |
| 10–14 | `ProductReviewVerificationTest` (5 tests) | Verifies customer eligibility, delivered check, phone mismatch, owner reply | **PASSED** |

### 6.3 Database State Verification (Before vs. After Migration)
- Record count in `product_reviews` before migration: **0**
- Record count in `product_reviews` after migration & test run: **0** (All test records cleaned up)
- Record count in legacy `feedback` table before migration: **12**
- Record count in legacy `feedback` table after migration & test run: **12** (No records altered or deleted)

---

## 7. Backward Compatibility & Risk Assessment

1. **Zero Downtime Migration:** All existing and incoming rows default to `PUBLISHED` in the database schema and JPA entity layer.
2. **Cascade Isolation:** The foreign key `moderated_by` references `users(id)` with `ON DELETE SET NULL`. Deletion or deactivation of an admin account will never cascade-delete customer reviews.
3. **Data Protection:** No review is permanently destroyed when moderated; hidden reviews remain securely stored in PostgreSQL for audit compliance and unhiding/restoration.
4. **No Customer Exposure:** Moderation fields (`moderationStatus`, `moderationReason`, `moderatedBy`, `moderatedAt`) are strictly excluded from public storefront DTOs.
5. **No Unresolved Risks:** All 58 Flyway migrations are valid, Flyway schema history is consistent, and the entire review test suite passes cleanly.

---

## 8. Status & Next Step

- **Phase 2.9.5.1 Status:** **COMPLETE & VERIFIED**
- **Action:** Awaiting user review and sign-off before commencing **Phase 2.9.5.2** (Backend Service & Admin Controller).

