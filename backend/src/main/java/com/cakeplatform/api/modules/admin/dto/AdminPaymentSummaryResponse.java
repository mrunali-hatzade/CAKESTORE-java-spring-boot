package com.cakeplatform.api.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminPaymentSummaryResponse {

    private Long id;
    private Long shopId;
    private String shopName;
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
}
