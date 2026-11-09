package com.cakeplatform.api.modules.review.dto;

import com.cakeplatform.api.modules.review.ProductReview;
import com.cakeplatform.api.modules.review.ReviewModerationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminProductReviewResponse {

    private Long id;
    private Long shopId;
    private String shopName;
    private Long productId;
    private String productName;
    private String customerName;
    private Integer rating;
    private String reviewText;
    private String cakeImageUrl;
    private String cakeVideoUrl;
    private ReviewModerationStatus moderationStatus;
    private String moderationReason;
    private Long moderatedById;
    private String moderatedByName;
    private String moderatedByEmail;
    private LocalDateTime moderatedAt;
    private LocalDateTime createdAt;
    private String ownerReply;
    private LocalDateTime ownerRepliedAt;

    public static AdminProductReviewResponse fromEntity(ProductReview review) {
        if (review == null) {
            return null;
        }

        AdminProductReviewResponseBuilder builder = AdminProductReviewResponse.builder()
                .id(review.getId())
                .customerName(review.getCustomerName())
                .rating(review.getRating())
                .reviewText(review.getReviewText())
                .cakeImageUrl(review.getCakeImageUrl())
                .cakeVideoUrl(review.getCakeVideoUrl())
                .moderationStatus(review.getModerationStatus())
                .moderationReason(review.getModerationReason())
                .moderatedAt(review.getModeratedAt())
                .createdAt(review.getCreatedAt())
                .ownerReply(review.getOwnerReply())
                .ownerRepliedAt(review.getOwnerRepliedAt());

        if (review.getShop() != null) {
            builder.shopId(review.getShop().getId())
                   .shopName(review.getShop().getBusinessName());
        }

        if (review.getProduct() != null) {
            builder.productId(review.getProduct().getId())
                   .productName(review.getProduct().getName());
        }

        if (review.getModeratedBy() != null) {
            builder.moderatedById(review.getModeratedBy().getId())
                   .moderatedByName(review.getModeratedBy().getFullName())
                   .moderatedByEmail(review.getModeratedBy().getEmail());
        }

        return builder.build();
    }
}
