package com.cakeplatform.api.modules.shop.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalTime;

@Data
public class ShopBusinessHoursRequest {
    @NotBlank(message = "Day of week is required")
    private String dayOfWeek;

    @NotNull(message = "isOpen flag is required")
    private Boolean isOpen;

    private LocalTime openTime;

    private LocalTime closeTime;
}

