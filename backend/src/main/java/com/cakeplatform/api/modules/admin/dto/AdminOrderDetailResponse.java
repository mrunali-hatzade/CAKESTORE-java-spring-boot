package com.cakeplatform.api.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminOrderDetailResponse {

    private Long id;
    private String orderNumber;
    private Long shopId;
    private String shopName;
    private String shopPhone;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String deliveryAddress;
    private String specialInstructions;
    private BigDecimal subtotal;
    private BigDecimal deliveryCharge;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private String couponCode;
    private String orderStatus;
    private String paymentStatus;
    private String paymentMethod;
    private String transactionId;
    private String razorpayOrderId;
    private LocalDate deliveryDate;
    private String deliverySlotDetails;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
    private List<AdminOrderItemDto> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminOrderItemDto {
        private Long id;
        private Long productId;
        private String productNameSnapshot;
        private String variantName;
        private BigDecimal unitPrice;
        private Integer quantity;
        private BigDecimal totalPrice;
        private String dietaryPreference;
        private String cakeMessage;
        private String addonsSummary;
        private String productImageUrl;
    }
}
