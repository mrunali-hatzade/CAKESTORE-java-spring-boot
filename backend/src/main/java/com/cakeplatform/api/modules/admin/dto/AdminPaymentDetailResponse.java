package com.cakeplatform.api.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminPaymentDetailResponse {

    private Long id;
    private Long shopId;
    private String shopName;
    private String shopPhone;
    private String shopEmail;
    private String transactionType; // SUBSCRIPTION, RETAIL_ORDER, UNKNOWN
    private String financialClassification; // PLATFORM_REVENUE, NETWORK_GMV_ZERO_COMMISSION, UNLINKED_TRANSACTION
    private String associationState; // SUBSCRIPTION_LINKED, ORDER_MATCHED, UNLINKED_GATEWAY_RECORD
    private String planName;
    private String relatedOrderNumber;
    private Long relatedOrderId;
    private BigDecimal amount;
    private String currency;
    private String provider;
    private String providerOrderId;
    private String providerPaymentId;
    private String gatewayStatus; // COMPLETED, PENDING, FAILED
    private String failureReason;
    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private AdminSubscriptionSnapshot subscriptionDetails;
    private AdminOrderSnapshot orderDetails;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminSubscriptionSnapshot {
        private Long subscriptionId;
        private String planName;
        private BigDecimal amount;
        private String status;
        private LocalDateTime startDate;
        private LocalDateTime expiryDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminOrderSnapshot {
        private Long orderId;
        private String orderNumber;
        private String orderStatus;
        private String paymentStatus;
        private String paymentMethod;
        private BigDecimal totalAmount;
        private String customerName;
        private LocalDate deliveryDate;
        private String deliverySlotDetails;
        private LocalDateTime createdAt;
    }
}
