package com.cakeplatform.api.modules.review.service;

import com.cakeplatform.api.exception.ResourceNotFoundException;
import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.review.ProductReview;
import com.cakeplatform.api.modules.review.ProductReviewRepository;
import com.cakeplatform.api.modules.review.ReviewModerationStatus;
import com.cakeplatform.api.modules.review.dto.AdminProductReviewResponse;
import com.cakeplatform.api.modules.review.dto.AdminReviewModerationRequest;
import com.cakeplatform.api.modules.storefront.StorefrontCacheService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminProductReviewService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("createdAt", "rating", "id");
    private static final int MAX_PAGE_SIZE = 50;
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final ProductReviewRepository productReviewRepository;
    private final UserRepository userRepository;
    private final ActivityLoggerService activityLogger;

    @Autowired(required = false)
    private StorefrontCacheService storefrontCacheService;

    /**
     * Lists product reviews across all bakeries with pagination, safe sorting, and multi-parameter filtering.
     */
    @Transactional(readOnly = true)
    public Page<AdminProductReviewResponse> getReviews(
            int page,
            int size,
            String sortField,
            String sortDir,
            ReviewModerationStatus status,
            Long shopId,
            Integer rating,
            String query) {

        int effectivePage = Math.max(page, 0);
        int effectiveSize = (size <= 0) ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);

        String effectiveSortField = (sortField != null && ALLOWED_SORT_FIELDS.contains(sortField))
                ? sortField
                : "createdAt";

        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(effectivePage, effectiveSize, Sort.by(direction, effectiveSortField));

        String sanitizedQuery = (query != null && !query.trim().isEmpty()) ? query.trim() : null;

        Page<ProductReview> reviews = productReviewRepository.searchAllReviewsForAdmin(
                status,
                shopId,
                rating,
                sanitizedQuery,
                pageable
        );

        return reviews.map(AdminProductReviewResponse::fromEntity);
    }

    /**
     * Moderates a product review: Hides with mandatory reason or restores to PUBLISHED.
     */
    @Transactional
    public AdminProductReviewResponse updateModerationStatus(
            Long reviewId,
            AdminReviewModerationRequest request,
            Long adminUserId) {

        if (reviewId == null) {
            throw new IllegalArgumentException("Review ID must not be null");
        }
        if (request == null || request.getStatus() == null) {
            throw new IllegalArgumentException("Moderation status is required (PUBLISHED or HIDDEN)");
        }

        ProductReview review = productReviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Product review not found with ID: " + reviewId));

        User adminUser = null;
        if (adminUserId != null) {
            adminUser = userRepository.findById(adminUserId).orElse(null);
        }

        ReviewModerationStatus newStatus = request.getStatus();
        ReviewModerationStatus oldStatus = review.getModerationStatus();

        String trimmedReason = (request.getReason() != null) ? request.getReason().trim() : null;

        if (newStatus == ReviewModerationStatus.HIDDEN) {
            if (trimmedReason == null || trimmedReason.isBlank()) {
                throw new IllegalArgumentException("Moderation reason is mandatory when hiding a review");
            }
            if (trimmedReason.length() > 500) {
                throw new IllegalArgumentException("Moderation reason cannot exceed 500 characters");
            }
        }

        // Avoid unnecessary writes if already in the target status and reason is unchanged
        if (oldStatus == newStatus) {
            if (newStatus == ReviewModerationStatus.PUBLISHED) {
                log.info("Review ID {} is already PUBLISHED. No update necessary.", reviewId);
                return AdminProductReviewResponse.fromEntity(review);
            } else if (newStatus == ReviewModerationStatus.HIDDEN && trimmedReason != null && trimmedReason.equals(review.getModerationReason())) {
                log.info("Review ID {} is already HIDDEN with identical reason. No update necessary.", reviewId);
                return AdminProductReviewResponse.fromEntity(review);
            }
        }

        Long shopId = review.getShop() != null ? review.getShop().getId() : null;

        if (newStatus == ReviewModerationStatus.HIDDEN) {
            review.setModerationStatus(ReviewModerationStatus.HIDDEN);
            review.setModerationReason(trimmedReason);
            review.setModeratedBy(adminUser);
            review.setModeratedAt(LocalDateTime.now());

            ProductReview saved = productReviewRepository.save(review);
            log.info("Product review ID {} hidden by admin ID {}", reviewId, adminUserId);

            // Evict storefront cache to recalculate product rating and summary on storefront
            if (storefrontCacheService != null && shopId != null) {
                storefrontCacheService.evictShopDetails(shopId);
            }

            // Activity audit logging
            if (activityLogger != null && adminUserId != null) {
                activityLogger.logActivity(
                        adminUserId,
                        shopId,
                        "PRODUCT_REVIEW_HIDDEN",
                        "PRODUCT_REVIEW",
                        saved.getId(),
                        String.format("Status: HIDDEN (previous: %s), Reason: %s", oldStatus, trimmedReason)
                );
            }

            return AdminProductReviewResponse.fromEntity(saved);
        } else {
            // Restore to PUBLISHED
            review.setModerationStatus(ReviewModerationStatus.PUBLISHED);
            review.setModerationReason(null);
            review.setModeratedBy(null);
            review.setModeratedAt(null);

            ProductReview saved = productReviewRepository.save(review);
            log.info("Product review ID {} restored to PUBLISHED by admin ID {}", reviewId, adminUserId);

            // Evict storefront cache
            if (storefrontCacheService != null && shopId != null) {
                storefrontCacheService.evictShopDetails(shopId);
            }

            // Activity audit logging
            if (activityLogger != null && adminUserId != null) {
                activityLogger.logActivity(
                        adminUserId,
                        shopId,
                        "PRODUCT_REVIEW_RESTORED",
                        "PRODUCT_REVIEW",
                        saved.getId(),
                        String.format("Status: PUBLISHED (previous: %s)", oldStatus)
                );
            }

            return AdminProductReviewResponse.fromEntity(saved);
        }
    }
}
