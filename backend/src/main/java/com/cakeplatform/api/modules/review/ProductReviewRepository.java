package com.cakeplatform.api.modules.review;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductReviewRepository extends JpaRepository<ProductReview, Long> {

    // --- Legacy / Unfiltered Queries (Retained for backward compatibility) ---
    List<ProductReview> findByProductIdOrderByCreatedAtDesc(Long productId);

    List<ProductReview> findByShopIdOrderByCreatedAtDesc(Long shopId);

    Optional<ProductReview> findByOrderItemId(Long orderItemId);

    boolean existsByOrderItemId(Long orderItemId);

    @Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId")
    Double calculateAverageRatingByProductId(@Param("productId") Long productId);

    long countByProductId(Long productId);

    long countByShopId(Long shopId);

    @Query("SELECT r.rating, COUNT(r) FROM ProductReview r WHERE r.product.id = :productId GROUP BY r.rating")
    List<Object[]> getRatingBreakdownByProductId(@Param("productId") Long productId);

    List<ProductReview> findByOrderId(Long orderId);

    // --- Bakery Owner Search Query ---
    @Query("SELECT r FROM ProductReview r WHERE r.shop.id = :shopId " +
           "AND (:rating IS NULL OR r.rating = :rating) " +
           "AND (:query IS NULL OR :query = '' " +
           "  OR LOWER(r.customerName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.reviewText) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.product.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.shop.businessName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.order.orderNumber) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY r.createdAt DESC")
    Page<ProductReview> searchProductReviewsByShopId(
            @Param("shopId") Long shopId, 
            @Param("rating") Integer rating, 
            @Param("query") String query, 
            Pageable pageable);

    // --- Public Storefront Moderated Queries (PUBLISHED Only) ---
    List<ProductReview> findByProductIdAndModerationStatusOrderByCreatedAtDesc(
            Long productId, 
            ReviewModerationStatus moderationStatus);

    List<ProductReview> findByShopIdAndModerationStatusOrderByCreatedAtDesc(
            Long shopId, 
            ReviewModerationStatus moderationStatus);

    @Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = :status")
    Double calculateAverageRatingByProductIdAndModerationStatus(
            @Param("productId") Long productId, 
            @Param("status") ReviewModerationStatus status);

    @Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = com.cakeplatform.api.modules.review.ReviewModerationStatus.PUBLISHED")
    Double calculateAverageRatingByProductIdPublished(@Param("productId") Long productId);

    long countByProductIdAndModerationStatus(Long productId, ReviewModerationStatus moderationStatus);

    long countByShopIdAndModerationStatus(Long shopId, ReviewModerationStatus moderationStatus);

    @Query("SELECT r.rating, COUNT(r) FROM ProductReview r WHERE r.product.id = :productId AND r.moderationStatus = :status GROUP BY r.rating")
    List<Object[]> getRatingBreakdownByProductIdAndModerationStatus(
            @Param("productId") Long productId, 
            @Param("status") ReviewModerationStatus status);

    // --- Super Admin Moderation Queries ---
    Page<ProductReview> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ProductReview> findByModerationStatusOrderByCreatedAtDesc(
            ReviewModerationStatus moderationStatus, 
            Pageable pageable);

    List<ProductReview> findByModerationStatusOrderByCreatedAtDesc(
            ReviewModerationStatus moderationStatus);

    @Query("SELECT r FROM ProductReview r WHERE " +
           "(:status IS NULL OR r.moderationStatus = :status) " +
           "AND (:shopId IS NULL OR r.shop.id = :shopId) " +
           "AND (:rating IS NULL OR r.rating = :rating) " +
           "AND (:query IS NULL OR :query = '' " +
           "  OR LOWER(r.customerName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.reviewText) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.product.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.shop.businessName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "  OR LOWER(r.order.orderNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<ProductReview> searchAllReviewsForAdmin(
            @Param("status") ReviewModerationStatus status, 
            @Param("shopId") Long shopId, 
            @Param("rating") Integer rating, 
            @Param("query") String query, 
            Pageable pageable);
}
