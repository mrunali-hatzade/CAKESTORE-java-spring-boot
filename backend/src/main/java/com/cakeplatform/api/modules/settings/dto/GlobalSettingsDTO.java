package com.cakeplatform.api.modules.settings.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class GlobalSettingsDTO {
    @Pattern(regexp = "^(?!\\s*$).+", message = "Platform name cannot be blank")
    @Size(max = 255, message = "Platform name must not exceed 255 characters")
    private String platformName;

    @Email(regexp = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", message = "Support email must be a valid email address")
    @Size(max = 255, message = "Support email must not exceed 255 characters")
    private String supportEmail;

    private String razorpayKeyId;
    private String razorpayKeySecret;
    private String razorpayWebhookSecret;

    @Size(max = 10, message = "Platform currency must not exceed 10 characters")
    private String platformCurrency;
}
