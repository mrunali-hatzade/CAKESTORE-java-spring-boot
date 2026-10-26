package com.cakeplatform.api.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OtpDeliveryResponse {
    /**
     * Delivery channel used: SMS, EMAIL, SMS_AND_EMAIL, or MOCK_SMS
     */
    private String channel;

    /**
     * User-facing description of where the OTP was sent
     */
    private String deliveryTarget;

    /**
     * Whether SMS delivery provider (Twilio) is configured with real credentials
     */
    private boolean smsConfigured;

    /**
     * Whether Email delivery provider (Resend) is configured with real credentials
     */
    private boolean emailConfigured;

    /**
     * Masked phone number, e.g. +91 98*****210
     */
    private String phoneMasked;

    /**
     * Masked email address, e.g. j***e@example.com
     */
    private String emailMasked;

    /**
     * Descriptive message for customer checkout UI
     */
    private String message;
}
