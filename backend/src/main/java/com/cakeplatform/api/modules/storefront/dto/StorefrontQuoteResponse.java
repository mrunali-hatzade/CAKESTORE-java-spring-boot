package com.cakeplatform.api.modules.storefront.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontQuoteResponse {

    private BigDecimal subtotal;

    private BigDecimal deliveryFee;

    private BigDecimal discountAmount;

    private BigDecimal finalTotal;

    private String fulfillmentMethod; // HOME_DELIVERY or SELF_PICKUP

    private Boolean deliveryEnabled;

    private BigDecimal freeDeliveryThreshold;

    private Boolean isFreeDelivery;

    private Boolean canDeliver;

    private String rejectionReason;
}
