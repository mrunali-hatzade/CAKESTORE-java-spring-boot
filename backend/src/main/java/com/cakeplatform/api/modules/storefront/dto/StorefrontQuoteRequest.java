package com.cakeplatform.api.modules.storefront.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorefrontQuoteRequest {

    @NotEmpty(message = "Items list cannot be empty")
    private List<StorefrontOrderItem> items;

    @Builder.Default
    private String fulfillmentMethod = "HOME_DELIVERY"; // HOME_DELIVERY or SELF_PICKUP

    private String couponCode;

    private String deliveryAddress;
}
