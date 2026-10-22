package com.cakeplatform.api.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        return new ResponseEntity<>(errors, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(com.cakeplatform.api.exception.DuplicateResourceException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateResourceException(com.cakeplatform.api.exception.DuplicateResourceException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", ex.getMessage());
        if (!ex.getFieldErrors().isEmpty()) {
            error.putAll(ex.getFieldErrors());
            error.put("fieldErrors", ex.getFieldErrors());
        }
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolationException(org.springframework.dao.DataIntegrityViolationException ex) {
        Map<String, Object> error = new HashMap<>();
        Map<String, String> fieldErrors = new HashMap<>();
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (ex.getCause() != null && ex.getCause().getMessage() != null) {
            msg += " " + ex.getCause().getMessage().toLowerCase();
        }

        if (msg.contains("idx_users_mobile") || msg.contains("uk_users_mobile") || msg.contains("users_mobile_key") || msg.contains("Detail: Key (mobile)")) {
            String mobileMsg = "This phone number is already registered. Please use another number.";
            fieldErrors.put("mobile", mobileMsg);
            error.put("mobile", mobileMsg);
            error.put("error", mobileMsg);
        } else if (msg.contains("idx_users_email") || msg.contains("uk_users_email") || msg.contains("users_email_key") || msg.contains("Detail: Key (email)")) {
            String emailMsg = "This email is already registered. Please login or use another email.";
            fieldErrors.put("email", emailMsg);
            error.put("email", emailMsg);
            error.put("error", emailMsg);
        } else if (msg.contains("uk_shops_owner_id") || msg.contains("owner_id")) {
            String ownerMsg = "An owner account can only own one bakery store.";
            error.put("error", ownerMsg);
        } else {
            error.put("error", "A database conflict occurred due to duplicate information.");
        }

        if (!fieldErrors.isEmpty()) {
            error.put("fieldErrors", fieldErrors);
        }
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(com.cakeplatform.api.exception.DeliverySlotFullException.class)
    public ResponseEntity<Map<String, Object>> handleDeliverySlotFullException(com.cakeplatform.api.exception.DeliverySlotFullException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", ex.getErrorCode());
        error.put("message", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(com.cakeplatform.api.exception.PriceMismatchException.class)
    public ResponseEntity<Map<String, Object>> handlePriceMismatchException(com.cakeplatform.api.exception.PriceMismatchException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", ex.getErrorCode());
        error.put("message", ex.getMessage());
        error.put("expectedTotal", ex.getExpectedTotal());
        error.put("authoritativeTotal", ex.getAuthoritativeTotal());
        error.put("authoritativeDeliveryFee", ex.getAuthoritativeDeliveryFee());
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(com.cakeplatform.api.exception.ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleResourceNotFoundException(com.cakeplatform.api.exception.ResourceNotFoundException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(com.cakeplatform.api.exception.CategoryNotEmptyException.class)
    public ResponseEntity<Map<String, Object>> handleCategoryNotEmptyException(com.cakeplatform.api.exception.CategoryNotEmptyException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "CATEGORY_NOT_EMPTY");
        error.put("message", ex.getMessage());
        error.put("productCount", ex.getProductCount());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

        @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDeniedException(org.springframework.security.access.AccessDeniedException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
        }
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(com.cakeplatform.api.exception.SubscriptionExpiredException.class)
    public ResponseEntity<Map<String, String>> handleSubscriptionExpiredException(com.cakeplatform.api.exception.SubscriptionExpiredException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSizeExceededException(org.springframework.web.multipart.MaxUploadSizeExceededException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "File size exceeds maximum allowed limit (5MB)");
        return new ResponseEntity<>(error, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler(com.cakeplatform.api.modules.location.exception.InvalidLocationException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidLocationException(com.cakeplatform.api.modules.location.exception.InvalidLocationException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "INVALID_LOCATION_HIERARCHY");
        error.put("message", ex.getMessage());
        if (!ex.getFieldErrors().isEmpty()) {
            error.put("fieldErrors", ex.getFieldErrors());
        }
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(com.cakeplatform.api.modules.location.exception.LocationServiceUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleLocationServiceUnavailableException(com.cakeplatform.api.modules.location.exception.LocationServiceUnavailableException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", HttpStatus.SERVICE_UNAVAILABLE.value());
        error.put("error", "LOCATION_SERVICE_INITIALIZING");
        error.put("message", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.SERVICE_UNAVAILABLE);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNoResourceFoundException(org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "Resource not found");
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, String>> handleMissingServletRequestParameterException(org.springframework.web.bind.MissingServletRequestParameterException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "Required request parameter '" + ex.getParameterName() + "' is not present");
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception ex) {
        org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class).error("Unhandled internal server exception: ", ex);
        Map<String, String> error = new HashMap<>();
        error.put("error", "An unexpected internal server error occurred. Please contact support.");
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
