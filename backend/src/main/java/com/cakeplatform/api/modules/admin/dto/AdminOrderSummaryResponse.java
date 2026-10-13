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
public class AdminOrderSummaryResponse {

    private Long id;
    private String orderNumber;
    private Long shopId;
    private String shopName;
    private String customerName;
    private String customerPhoneMasked;
    private String customerEmailMasked;
    private BigDecimal totalAmount;
    private BigDecimal subtotal;
    private BigDecimal deliveryCharge;
    private BigDecimal discountAmount;
    private String couponCode;
    private String orderStatus;
    private String paymentStatus;
    private String paymentMethod;
    private String transactionId;
    private Integer itemCount;
    private LocalDate deliveryDate;
    private String deliverySlotDetails;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;

    /**
     * Helper to mask customer mobile phone for list view privacy (e.g. "+91 ******8910").
     */
    public static String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        String clean = phone.trim();
        if (clean.length() <= 4) {
            return "****";
        }
        if (clean.length() <= 7) {
            return clean.substring(0, 2) + "***" + clean.substring(clean.length() - 2);
        }
        int visibleStart = clean.startsWith("+") ? 3 : 2;
        int visibleEnd = 4;
        if (clean.length() <= visibleStart + visibleEnd) {
            return clean.substring(0, 1) + "****" + clean.substring(clean.length() - 2);
        }
        return clean.substring(0, visibleStart) + "******" + clean.substring(clean.length() - visibleEnd);
    }

    /**
     * Helper to mask customer email for list view privacy (e.g. "r***@gmail.com").
     */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String clean = email.trim();
        int atIndex = clean.indexOf('@');
        if (atIndex <= 1) {
            return "***" + clean.substring(Math.max(0, atIndex));
        }
        String name = clean.substring(0, atIndex);
        String domain = clean.substring(atIndex);
        return name.charAt(0) + "***" + domain;
    }
}
