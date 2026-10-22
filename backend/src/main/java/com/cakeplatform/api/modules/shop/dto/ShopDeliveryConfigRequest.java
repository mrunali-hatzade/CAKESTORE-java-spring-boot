package com.cakeplatform.api.modules.shop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ShopDeliveryConfigRequest {
    private Boolean deliveryEnabled; // Defaults to true if null
    
    @NotBlank
    private String deliveryChargeType; // 'FREE' or 'FIXED'

    @NotNull
    @DecimalMin("0.00")
    private BigDecimal fixedChargeAmount;

    private BigDecimal minOrderForFreeDelivery;

    private String deliveryNotes;
}
