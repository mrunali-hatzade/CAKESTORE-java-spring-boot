package com.cakeplatform.api.modules.storefront.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Validates that a deliverySlotId is provided when fulfillmentMethod is HOME_DELIVERY.
 * For SELF_PICKUP, deliverySlotId is optional.
 */
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidDeliverySlotValidator.class)
@Documented
public @interface ValidDeliverySlot {
    String message() default "Delivery slot is required for home delivery";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

