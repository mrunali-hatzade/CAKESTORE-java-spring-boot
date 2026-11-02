package com.cakeplatform.api.modules.storefront.dto;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Sanitized Data Transfer Object for Customer Order Tracking.
 *
 * Excludes internal entity links (Shop, User), sensitive payment gateway IDs
 * (Razorpay order ID), and internal business secrets.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontOrderTrackingResponse {
    private Long id;
    private String orderNumber;
    private Long shopId;
    private String shopName;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String deliveryAddress;
    private String fulfillmentMethod;
    private LocalDate deliveryDate;
    private String deliverySlotDetails;
    private BigDecimal subtotal;
    private BigDecimal deliveryCharge;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private String status;
    private String orderStatus;
    private String paymentStatus;
    private String paymentMethod;
    private String transactionId;
    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String couponCode;
    private String specialInstructions;
    private List<StorefrontOrderItemResponse> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StorefrontOrderItemResponse {
        private Long id;
        private Long productId;
        private String productName;
        private String productNameSnapshot;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
        private String variantName;
        private String dietaryPreference;
        private String cakeMessage;
        private String customMessage;
        private String photoReferenceUrl;
        private String addonsSummary;
        private String productImageUrl;
    }

    public static StorefrontOrderTrackingResponse from(Order order) {
        if (order == null) return null;
        List<StorefrontOrderItemResponse> itemDtos = null;
        if (order.getItems() != null) {
            itemDtos = order.getItems().stream().map(it -> StorefrontOrderItemResponse.builder()
                    .id(it.getId())
                    .productId(it.getProduct() != null ? it.getProduct().getId() : null)
                    .productName(it.getProduct() != null ? it.getProduct().getName() : it.getProductNameSnapshot())
                    .productNameSnapshot(it.getProductNameSnapshot())
                    .quantity(it.getQuantity())
                    .unitPrice(it.getUnitPrice())
                    .totalPrice(it.getTotalPrice())
                    .variantName(it.getVariantName())
                    .dietaryPreference(it.getDietaryPreference())
                    .cakeMessage(it.getCakeMessage())
                    .photoReferenceUrl(it.getPhotoReferenceUrl())
                    .addonsSummary(it.getAddonsSummary())
                    .productImageUrl(it.getProductImageUrl())
                    .build()
            ).collect(Collectors.toList());
        }

        return StorefrontOrderTrackingResponse.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .shopId(order.fetchShopId())
                .shopName(order.fetchShopName())
                .customerName(order.getCustomerName())
                .customerEmail(order.getCustomerEmail())
                .customerPhone(order.getCustomerPhone())
                .deliveryAddress(order.getDeliveryAddress())
                .fulfillmentMethod(order.getFulfillmentMethod())
                .deliveryDate(order.getDeliveryDate())
                .deliverySlotDetails(order.fetchDeliverySlotDetails())
                .subtotal(order.getSubtotal())
                .deliveryCharge(order.getDeliveryCharge())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .status(order.getOrderStatus())
                .orderStatus(order.getOrderStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .transactionId(order.getTransactionId())
                .paidAt(order.getPaidAt())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .couponCode(order.getCouponCode())
                .specialInstructions(order.getSpecialInstructions())
                .items(itemDtos)
                .build();
    }
}
