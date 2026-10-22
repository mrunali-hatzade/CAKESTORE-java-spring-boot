package com.cakeplatform.api.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.math.BigDecimal;

@ResponseStatus(HttpStatus.CONFLICT)
public class PriceMismatchException extends RuntimeException {

    private final String errorCode = "PRICE_MISMATCH";
    private final BigDecimal expectedTotal;
    private final BigDecimal authoritativeTotal;
    private final BigDecimal authoritativeDeliveryFee;

    public PriceMismatchException(String message, BigDecimal expectedTotal, BigDecimal authoritativeTotal, BigDecimal authoritativeDeliveryFee) {
        super(message);
        this.expectedTotal = expectedTotal;
        this.authoritativeTotal = authoritativeTotal;
        this.authoritativeDeliveryFee = authoritativeDeliveryFee;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public BigDecimal getExpectedTotal() {
        return expectedTotal;
    }

    public BigDecimal getAuthoritativeTotal() {
        return authoritativeTotal;
    }

    public BigDecimal getAuthoritativeDeliveryFee() {
        return authoritativeDeliveryFee;
    }
}
