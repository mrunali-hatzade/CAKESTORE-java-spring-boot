package com.cakeplatform.api.modules.settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GlobalSettingsResponse {
    private Long id;
    private String platformName;
    private String supportEmail;
    private String razorpayKeyId;
    private boolean razorpayKeySecretConfigured;
    private boolean razorpayWebhookSecretConfigured;
    private String platformCurrency;
    private LocalDateTime updatedAt;
}
