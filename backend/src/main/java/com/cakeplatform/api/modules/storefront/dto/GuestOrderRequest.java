package com.cakeplatform.api.modules.storefront.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class GuestOrderRequest {
    @NotBlank(message = "Customer name is required")
    private String customerName;

    @NotBlank(message = "Customer email is required")
    @Email(message = "Invalid email format")
    private String customerEmail;

    @NotBlank(message = "Customer phone is required")
    @Pattern(regexp = "^\\+?[1-9]\\d{1,14}$", message = "Invalid mobile number format")
    private String customerPhone;

    @NotBlank(message = "Payment method is required")
    @Pattern(regexp = "^(COD|ONLINE_PAYMENT)$", message = "Payment method must be COD or ONLINE_PAYMENT")
    private String paymentMethod;
    
    private String fulfillmentMethod; // HOME_DELIVERY or SELF_PICKUP (defaults to HOME_DELIVERY)

    private String deliveryAddress;

    private String specialInstructions;

    @NotEmpty(message = "Order must contain at least one item")
    private List<StorefrontOrderItem> items;

    @NotNull(message = "Delivery date is required")
    private java.time.LocalDate deliveryDate;

    @NotNull(message = "Delivery slot is required")
    private Long deliverySlotId;

    private String couponCode;

    private java.math.BigDecimal expectedDeliveryFee;

    private java.math.BigDecimal expectedTotal;

    private Boolean confirmPriceChange;
}
