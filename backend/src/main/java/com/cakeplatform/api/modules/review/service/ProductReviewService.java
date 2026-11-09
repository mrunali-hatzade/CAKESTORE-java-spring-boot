package com.cakeplatform.api.modules.review.service;

import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.notification.NotificationService;
import com.cakeplatform.api.modules.notification.NotificationType;
import com.cakeplatform.api.modules.notification.SmsService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import com.cakeplatform.api.modules.order.OrderItemRepository;
import com.cakeplatform.api.modules.order.OrderRepository;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.product.ProductRepository;
import com.cakeplatform.api.modules.review.ProductReview;
import com.cakeplatform.api.modules.review.ProductReviewRepository;
import com.cakeplatform.api.modules.review.ReviewModerationStatus;
import com.cakeplatform.api.modules.review.dto.*;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.interaction.Feedback;
import com.cakeplatform.api.modules.interaction.FeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductReviewService {

    private final ProductReviewRepository productReviewRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ShopRepository shopRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final FeedbackRepository feedbackRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cakeplatform.api.modules.storefront.StorefrontCacheService storefrontCacheService;

    private Shop getActiveShop(Long shopId) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new IllegalArgumentException("Bakery not found"));
        if (shop.getStatus() != ShopStatus.ACTIVE) {
            throw new IllegalStateException("Bakery is currently unavailable");
        }
        return shop;
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        String clean = phone.replaceAll("\\D", "");
        if (clean.startsWith("0")) clean = clean.substring(1);
        if (clean.startsWith("91") && clean.length() == 12) clean = clean.substring(2);
        return clean;
    }

    private String getMaskedDisplayName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Verified Customer";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0];
        return parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }

    @Transactional
    public PublicProductReviewResponse submitReview(Long shopId, Long productId, SubmitProductReviewRequest request) {
        // 1. Resolve & verify Shop
        Shop shop = getActiveShop(shopId);

        // 2. Resolve & verify Product belongs to Shop
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        if (product.getShop() == null || !product.getShop().getId().equals(shop.getId())) {
            throw new IllegalArgumentException("Product does not belong to this bakery");
        }

        // 3. Resolve & verify Order belongs to Shop
        Order order = orderRepository.findByOrderNumber(request.getOrderNumber().trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Order not found with the provided order number"));
        if (order.getShop() == null || !order.getShop().getId().equals(shop.getId())) {
            throw new IllegalArgumentException("Order does not belong to this bakery");
        }

        // 4. Verify Order Status is DELIVERED or COMPLETED
        String status = order.getOrderStatus() != null ? order.getOrderStatus().trim().toUpperCase() : "";
        if (!"DELIVERED".equals(status) && !"COMPLETED".equals(status)) {
            throw new IllegalStateException("Only delivered or completed celebration orders can be reviewed. Current status: " + status);
        }

        // 5. Verify Customer Identity via normalized phone
        String inputPhoneNorm = normalizePhone(request.getCustomerPhone());
        String orderPhoneNorm = normalizePhone(order.getCustomerPhone());
        if (!inputPhoneNorm.isEmpty() && !orderPhoneNorm.isEmpty() && !inputPhoneNorm.equals(orderPhoneNorm)) {
            throw new SecurityException("Provided customer phone number does not match the delivery record for this order");
        }

        // 6. Resolve & verify OrderItem belongs to Order
        OrderItem orderItem = orderItemRepository.findById(request.getOrderItemId())
                .orElseThrow(() -> new IllegalArgumentException("Purchased item not found in order"));
        if (orderItem.getOrder() == null || !orderItem.getOrder().getId().equals(order.getId())) {
            throw new IllegalArgumentException("Purchased item does not belong to the specified order");
        }

        // 7. Verify OrderItem belongs to requested Product
        if (orderItem.getProduct() != null && !orderItem.getProduct().getId().equals(product.getId())) {
            throw new IllegalArgumentException("Purchased item does not match the product being reviewed");
        }

        // 8. Verify OrderItem has NOT already been reviewed
        if (productReviewRepository.existsByOrderItemId(orderItem.getId())) {
            throw new IllegalStateException("A verified review has already been submitted for this purchased cake item");
        }

        // 9. Derive Customer Name from verified Order
        String customerName = order.getCustomerName() != null && !order.getCustomerName().isBlank()
                ? order.getCustomerName().trim()
                : "Verified Customer";

        // 10. Persist Verified Review
        String editToken = java.util.UUID.randomUUID().toString();
        ProductReview review = ProductReview.builder()
                .shop(shop)
                .product(product)
                .order(order)
                .orderItem(orderItem)
                .customerName(customerName)
                .customerPhone(order.getCustomerPhone())
                .rating(request.getRating())
                .reviewText(request.getReviewText() != null ? request.getReviewText().trim() : "")
                .cakeImageUrl(request.getCakeImageUrl() != null && !request.getCakeImageUrl().isBlank() ? request.getCakeImageUrl().trim() : null)
                .cakeVideoUrl(request.getCakeVideoUrl() != null && !request.getCakeVideoUrl().isBlank() ? request.getCakeVideoUrl().trim() : null)
                .isVerifiedPurchase(true)
                .editToken(editToken)
                .build();

        ProductReview saved = productReviewRepository.save(review);

        // 11. Notify Bakery Owner
        try {
            notificationService.createNotification(
                    shop.getOwner(),
                    NotificationType.NEW_FEEDBACK,
                    "New Verified Product Review",
                    "Received a " + saved.getRating() + "-star review for '" + product.getName() + "' on Order #" + order.getOrderNumber(),
                    saved.getId().toString(),
                    true
            );
        } catch (Exception ex) {
            log.warn("Failed to dispatch owner notification for review: {}", ex.getMessage());
        }

        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shopId);
        }

        return PublicProductReviewResponse.builder()
                .id(saved.getId())
                .customerDisplayName(getMaskedDisplayName(saved.getCustomerName()))
                .rating(saved.getRating())
                .reviewText(saved.getReviewText())
                .cakeImageUrl(saved.getCakeImageUrl())
                .cakeVideoUrl(saved.getCakeVideoUrl())
                .isVerifiedPurchase(saved.getIsVerifiedPurchase())
                .ownerReply(saved.getOwnerReply())
                .ownerRepliedAt(saved.getOwnerRepliedAt())
                .createdAt(saved.getCreatedAt())
                .editToken(saved.getEditToken())
                .build();
    }

    @Transactional(readOnly = true)
    public ProductReviewsSummaryResponse getProductReviewsSummary(Long shopId, Long productId) {
        getActiveShop(shopId);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        if (product.getShop() == null || !product.getShop().getId().equals(shopId)) {
            throw new IllegalArgumentException("Product does not belong to this bakery");
        }

        List<ProductReview> reviews = productReviewRepository.findByProductIdAndModerationStatusOrderByCreatedAtDesc(productId, ReviewModerationStatus.PUBLISHED);

        List<PublicProductReviewResponse> publicList = new ArrayList<>();
        for (ProductReview r : reviews) {
            publicList.add(PublicProductReviewResponse.builder()
                    .id(r.getId())
                    .customerDisplayName(getMaskedDisplayName(r.getCustomerName()))
                    .rating(r.getRating())
                    .reviewText(r.getReviewText())
                    .isVerifiedPurchase(r.getIsVerifiedPurchase())
                    .ownerReply(r.getOwnerReply())
                    .ownerRepliedAt(r.getOwnerRepliedAt())
                    .cakeImageUrl(r.getCakeImageUrl())
                    .cakeVideoUrl(r.getCakeVideoUrl())
                    .createdAt(r.getCreatedAt())
                    .source("PRODUCT_REVIEW")
                    .build());
        }

        if (feedbackRepository != null) {
            try {
                String pName = product.getName() != null ? product.getName().trim() : "";
                List<Feedback> feedbacks = feedbackRepository.findProductFeedback(shopId, productId, pName);
                
                for (Feedback f : feedbacks) {
                    String cleanComment = f.getComment() != null ? f.getComment() : "";
                    if (!pName.isEmpty() && cleanComment.toLowerCase().startsWith("[" + pName.toLowerCase() + "]")) {
                        cleanComment = cleanComment.substring(("[" + pName + "]").length()).trim();
                    }
                    publicList.add(PublicProductReviewResponse.builder()
                            .id(f.getId())
                            .customerDisplayName(getMaskedDisplayName(f.getCustomerDisplayName()))
                            .rating(f.getRating() != null ? f.getRating() : 5)
                            .reviewText(cleanComment)
                            .isVerifiedPurchase(f.getOrderReference() != null && !f.getOrderReference().isBlank())
                            .ownerReply(f.getOwnerReply())
                            .ownerRepliedAt(null)
                            .cakeImageUrl(f.getCakeImageUrl())
                            .cakeVideoUrl(f.getCakeVideoUrl())
                            .createdAt(f.getCreatedAt())
                            .source("FEEDBACK")
                            .build());
                }
            } catch (Exception ex) {
                log.warn("Failed to load feedbacks for product summary: {}", ex.getMessage());
            }
        }

        publicList.sort((a, b) -> {
            if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
            if (a.getCreatedAt() == null) return 1;
            if (b.getCreatedAt() == null) return -1;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });

        long totalCount = publicList.size();
        double avg = totalCount > 0
                ? publicList.stream().mapToInt(PublicProductReviewResponse::getRating).average().orElse(0.0)
                : 0.0;
        double roundedAvg = Math.round(avg * 10.0) / 10.0;

        Map<Integer, Long> breakdown = new HashMap<>();
        for (int i = 1; i <= 5; i++) breakdown.put(i, 0L);
        for (PublicProductReviewResponse r : publicList) {
            int rating = r.getRating() != null ? r.getRating() : 5;
            breakdown.put(rating, breakdown.getOrDefault(rating, 0L) + 1);
        }

        return ProductReviewsSummaryResponse.builder()
                .productId(productId)
                .averageRating(roundedAvg)
                .totalReviews(totalCount)
                .ratingBreakdown(breakdown)
                .reviews(publicList)
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrderItemEligibilityResponse> checkOrderEligibility(Long shopId, String orderNumber, String phone) {
        getActiveShop(shopId);

        Order order = orderRepository.findByOrderNumber(orderNumber.trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Order not found with number: " + orderNumber));

        if (order.getShop() == null || !order.getShop().getId().equals(shopId)) {
            throw new IllegalArgumentException("Order does not belong to this bakery");
        }

        String inputPhoneNorm = normalizePhone(phone);
        String orderPhoneNorm = normalizePhone(order.getCustomerPhone());
        if (!inputPhoneNorm.isEmpty() && !orderPhoneNorm.isEmpty() && !inputPhoneNorm.equals(orderPhoneNorm)) {
            throw new SecurityException("Provided customer phone number does not match order record");
        }

        String status = order.getOrderStatus() != null ? order.getOrderStatus().trim().toUpperCase() : "";
        boolean isDelivered = "DELIVERED".equals(status) || "COMPLETED".equals(status);

        List<OrderItemEligibilityResponse> results = new ArrayList<>();
        if (order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                Optional<ProductReview> existing = productReviewRepository.findByOrderItemId(item.getId());
                boolean hasReviewed = existing.isPresent();

                results.add(OrderItemEligibilityResponse.builder()
                        .orderItemId(item.getId())
                        .productId(item.getProduct() != null ? item.getProduct().getId() : null)
                        .productName(item.getProductNameSnapshot())
                        .variantName(item.getVariantName())
                        .isDelivered(isDelivered)
                        .hasReviewed(hasReviewed)
                        .isEligible(isDelivered && !hasReviewed)
                        .existingReviewId(existing.map(ProductReview::getId).orElse(null))
                        .existingRating(existing.map(ProductReview::getRating).orElse(null))
                        .existingReviewText(existing.map(ProductReview::getReviewText).orElse(null))
                        .existingCakeImageUrl(existing.map(ProductReview::getCakeImageUrl).orElse(null))
                        .existingCakeVideoUrl(existing.map(ProductReview::getCakeVideoUrl).orElse(null))
                        .build());
            }
        }

        return results;
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<OwnerProductReviewResponse> getOwnerProductReviews(Long ownerUserId, Integer rating, String search, org.springframework.data.domain.Pageable pageable) {
        Shop shop = shopRepository.findByOwnerId(ownerUserId).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Shop not found for authenticated owner"));

        org.springframework.data.domain.Page<ProductReview> reviewsPage = productReviewRepository.searchProductReviewsByShopId(shop.getId(), rating, search, pageable);

        return reviewsPage.map(r -> OwnerProductReviewResponse.builder()
                        .id(r.getId())
                        .productId(r.getProduct() != null ? r.getProduct().getId() : null)
                        .productName(r.getProduct() != null ? r.getProduct().getName() : (r.getOrderItem() != null ? r.getOrderItem().getProductNameSnapshot() : "Artisanal Cake"))
                        .productImage(r.getProduct() != null ? r.getProduct().getImageUrl() : null)
                        .orderNumber(r.getOrder() != null ? r.getOrder().getOrderNumber() : "N/A")
                        .customerName(r.getCustomerName())
                        .rating(r.getRating())
                        .reviewText(r.getReviewText())
                        .isVerifiedPurchase(r.getIsVerifiedPurchase())
                        .ownerReply(r.getOwnerReply())
                        .ownerRepliedAt(r.getOwnerRepliedAt())
                        .cakeImageUrl(r.getCakeImageUrl())
                        .cakeVideoUrl(r.getCakeVideoUrl())
                        .createdAt(r.getCreatedAt())
                        .build());
    }

    @Transactional
    public OwnerProductReviewResponse replyToProductReview(Long ownerUserId, Long reviewId, OwnerReviewReplyRequest request) {
        Shop shop = shopRepository.findByOwnerId(ownerUserId).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Shop not found for authenticated owner"));

        ProductReview review = productReviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        // Strict multi-tenant verification: review must belong to owner's shop
        if (review.getShop() == null || !review.getShop().getId().equals(shop.getId())) {
            throw new SecurityException("Unauthorized: Review does not belong to your bakery");
        }

        review.setOwnerReply(request.getReply().trim());
        review.setOwnerRepliedAt(LocalDateTime.now());
        ProductReview updated = productReviewRepository.save(review);

        // Customer Notification on Baker Reply (Email and SMS)
        try {
            String customerEmail = updated.getOrder() != null ? updated.getOrder().getCustomerEmail() : null;
            String bakeryName = shop.getBusinessName();
            String productName = updated.getProduct() != null ? updated.getProduct().getName() : "your cake";

            if (emailService != null && customerEmail != null && !customerEmail.isBlank()) {
                String subject = String.format("[%s] The baker replied to your review!", bakeryName);
                String body = String.format(
                        "Hello %s,\n\n" +
                        "%s has replied to your review for %s!\n\n" +
                        "Your Rating: %d / 5 Stars\n" +
                        "Your Review:\n\"%s\"\n\n" +
                        "Bakery Response:\n\"%s\"\n\n" +
                        "Thank you for choosing %s for your celebration!",
                        updated.getCustomerName() != null ? updated.getCustomerName() : "Valued Customer",
                        bakeryName,
                        productName,
                        updated.getRating(),
                        updated.getReviewText() != null ? updated.getReviewText() : "(No text)",
                        updated.getOwnerReply(),
                        bakeryName
                );
                emailService.sendEmail(customerEmail, subject, body);
            }

            String customerPhone = updated.getCustomerPhone();
            if ((customerPhone == null || customerPhone.isBlank()) && updated.getOrder() != null) {
                customerPhone = updated.getOrder().getCustomerPhone();
            }
            if (smsService != null && customerPhone != null && !customerPhone.isBlank()) {
                String replySnippet = updated.getOwnerReply();
                if (replySnippet != null && replySnippet.length() > 80) {
                    replySnippet = replySnippet.substring(0, 77) + "...";
                }
                String smsBody = String.format("%s replied to your review: \"%s\"", bakeryName, replySnippet);
                smsService.sendSms(customerPhone, smsBody);
            }
        } catch (Exception ex) {
            log.warn("Failed to dispatch customer notification on baker reply: {}", ex.getMessage());
        }

        return OwnerProductReviewResponse.builder()
                .id(updated.getId())
                .productId(updated.getProduct() != null ? updated.getProduct().getId() : null)
                .productName(updated.getProduct() != null ? updated.getProduct().getName() : "Artisanal Cake")
                .productImage(updated.getProduct() != null ? updated.getProduct().getImageUrl() : null)
                .orderNumber(updated.getOrder() != null ? updated.getOrder().getOrderNumber() : "N/A")
                .customerName(updated.getCustomerName())
                .rating(updated.getRating())
                .reviewText(updated.getReviewText())
                .isVerifiedPurchase(updated.getIsVerifiedPurchase())
                .ownerReply(updated.getOwnerReply())
                .ownerRepliedAt(updated.getOwnerRepliedAt())
                .cakeImageUrl(updated.getCakeImageUrl())
                .cakeVideoUrl(updated.getCakeVideoUrl())
                .createdAt(updated.getCreatedAt())
                .build();
    }

    private void validateAuthorToken(String storedToken, String providedToken) {
        if (storedToken == null || storedToken.isBlank()) {
            return;
        }
        if (providedToken == null || providedToken.isBlank() || !storedToken.trim().equals(providedToken.trim())) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthorized: You do not have permission to edit or delete this review.");
        }
    }

    @Transactional
    public PublicProductReviewResponse updateReview(Long shopId, Long productId, Long reviewId, SubmitProductReviewRequest request) {
        return updateReview(shopId, productId, reviewId, request, null);
    }

    @Transactional
    public PublicProductReviewResponse updateReview(Long shopId, Long productId, Long reviewId, SubmitProductReviewRequest request, String token) {
        getActiveShop(shopId);

        ProductReview review = productReviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        if (!review.getShop().getId().equals(shopId)) {
            throw new SecurityException("Review does not belong to this bakery");
        }

        boolean tokenValid = (review.getEditToken() != null && !review.getEditToken().isBlank()
                && token != null && !token.isBlank() && review.getEditToken().trim().equals(token.trim()));

        if (!tokenValid) {
            Order order = review.getOrder();
            boolean orderMatches = false;
            if (order != null) {
                boolean orderNumberOk = request.getOrderNumber() != null && !request.getOrderNumber().isBlank()
                        && order.getOrderNumber().equalsIgnoreCase(request.getOrderNumber().trim());
                String inputPhone = normalizePhone(request.getCustomerPhone());
                String orderPhone = normalizePhone(order.getCustomerPhone());
                boolean phoneOk = !inputPhone.isEmpty() && !orderPhone.isEmpty() && inputPhone.equals(orderPhone);
                if (orderNumberOk || phoneOk) {
                    orderMatches = true;
                }
            }

            if (!orderMatches && review.getEditToken() != null && !review.getEditToken().isBlank()) {
                throw new org.springframework.security.access.AccessDeniedException("Unauthorized: You do not have permission to edit this review.");
            }
        }

        review.setRating(request.getRating());
        review.setReviewText(request.getReviewText() != null ? request.getReviewText().trim() : null);
        review.setCakeImageUrl(request.getCakeImageUrl() != null && !request.getCakeImageUrl().isBlank() ? request.getCakeImageUrl().trim() : null);
        review.setCakeVideoUrl(request.getCakeVideoUrl() != null && !request.getCakeVideoUrl().isBlank() ? request.getCakeVideoUrl().trim() : null);

        ProductReview saved = productReviewRepository.save(review);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shopId);
        }

        return PublicProductReviewResponse.builder()
                .id(saved.getId())
                .customerDisplayName(getMaskedDisplayName(saved.getCustomerName()))
                .rating(saved.getRating())
                .reviewText(saved.getReviewText())
                .isVerifiedPurchase(saved.getIsVerifiedPurchase())
                .cakeImageUrl(saved.getCakeImageUrl())
                .cakeVideoUrl(saved.getCakeVideoUrl())
                .ownerReply(saved.getOwnerReply())
                .ownerRepliedAt(saved.getOwnerRepliedAt())
                .createdAt(saved.getCreatedAt())
                .editToken(saved.getEditToken())
                .build();
    }

    @Transactional
    public void deleteReview(Long shopId, Long productId, Long reviewId, String orderNumber, String phone) {
        deleteReview(shopId, productId, reviewId, orderNumber, phone, null);
    }

    @Transactional
    public void deleteReview(Long shopId, Long productId, Long reviewId, String orderNumber, String phone, String token) {
        getActiveShop(shopId);

        ProductReview review = productReviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        if (!review.getShop().getId().equals(shopId)) {
            throw new SecurityException("Review does not belong to this bakery");
        }

        boolean tokenValid = (review.getEditToken() != null && !review.getEditToken().isBlank()
                && token != null && !token.isBlank() && review.getEditToken().trim().equals(token.trim()));

        if (!tokenValid) {
            Order order = review.getOrder();
            boolean orderMatches = false;
            if (order != null) {
                boolean orderNumberOk = orderNumber != null && !orderNumber.isBlank()
                        && order.getOrderNumber().equalsIgnoreCase(orderNumber.trim());
                String inputPhone = normalizePhone(phone);
                String orderPhone = normalizePhone(order.getCustomerPhone());
                boolean phoneOk = !inputPhone.isEmpty() && !orderPhone.isEmpty() && inputPhone.equals(orderPhone);
                if (orderNumberOk || phoneOk) {
                    orderMatches = true;
                }
            }

            if (!orderMatches && review.getEditToken() != null && !review.getEditToken().isBlank()) {
                throw new org.springframework.security.access.AccessDeniedException("Unauthorized: You do not have permission to delete this review.");
            }
        }

        productReviewRepository.delete(review);
        if (storefrontCacheService != null) {
            storefrontCacheService.evictShopDetails(shopId);
        }
    }
}
