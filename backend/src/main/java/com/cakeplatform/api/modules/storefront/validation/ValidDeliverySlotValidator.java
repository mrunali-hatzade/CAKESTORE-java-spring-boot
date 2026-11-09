package com.cakeplatform.api.modules.storefront.validation;

import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidDeliverySlotValidator implements ConstraintValidator<ValidDeliverySlot, GuestOrderRequest> {

    @Override
    public boolean isValid(GuestOrderRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }

        String rawFulfillment = request.getFulfillmentMethod();
        boolean isSelfPickup = rawFulfillment != null && (
                "SELF_PICKUP".equalsIgnoreCase(rawFulfillment)
                || "STORE_PICKUP".equalsIgnoreCase(rawFulfillment)
                || "PICKUP".equalsIgnoreCase(rawFulfillment)
        );

        // For SELF_PICKUP, deliverySlotId is optional (may be null)
        if (isSelfPickup) {
            return true;
        }

        // For HOME_DELIVERY (or default/null fulfillmentMethod), deliverySlotId is strictly required
        if (request.getDeliverySlotId() == null) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                    .addPropertyNode("deliverySlotId")
                    .addConstraintViolation();
            return false;
        }

        return true;
    }
}

