package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.product.Product;
import com.cakeplatform.api.modules.storefront.dto.GuestOrderRequest;
import com.cakeplatform.api.modules.storefront.dto.StorefrontShopResponse;
import com.cakeplatform.api.modules.storefront.dto.StorefrontDeliverySlotResponse;
import com.cakeplatform.api.modules.storefront.dto.ValidateCouponRequest;
import com.cakeplatform.api.modules.storefront.dto.ValidateCouponResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/storefront/shops", "/api/customer/storefront"})
public class CustomerStorefrontController {
    private final CustomerStorefrontService storefrontService;
    private final com.cakeplatform.api.modules.order.InvoiceService invoiceService;

    // Backward-compatible constructor for existing unit tests
    public CustomerStorefrontController(CustomerStorefrontService storefrontService) {
        this(storefrontService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CustomerStorefrontController(
            CustomerStorefrontService storefrontService,
            com.cakeplatform.api.modules.order.InvoiceService invoiceService
    ) {
        this.storefrontService = storefrontService;
        this.invoiceService = invoiceService;
    }

    @GetMapping("/locations/popular-cities")
    public ResponseEntity<List<com.cakeplatform.api.modules.storefront.dto.PopularCityDTO>> getPopularCities(
            @RequestParam(required = false, defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(storefrontService.getPopularCities(limit));
    }

    @GetMapping("/{shopId}/categories")
    public ResponseEntity<List<com.cakeplatform.api.modules.product.dto.CategoryResponse>> getShopCategories(@PathVariable Long shopId) {
        return ResponseEntity.ok(storefrontService.getShopCategories(shopId));
    }

    @GetMapping("/{shopId}")
    public ResponseEntity<StorefrontShopResponse> getShopDetails(@PathVariable Long shopId) {
        return ResponseEntity.ok(storefrontService.getShopDetails(shopId));
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchShops(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String pincode,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String businessType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false, defaultValue = "10.0") Double radiusKm,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "20") Integer size
    ) {
        if (latitude != null || longitude != null) {
            if (latitude == null || longitude == null) {
                throw new IllegalArgumentException("Both latitude and longitude are required for nearby search");
            }
            if (Double.isNaN(latitude) || latitude < -90.0 || latitude > 90.0) {
                throw new IllegalArgumentException("Latitude must be between -90 and 90 degrees");
            }
            if (Double.isNaN(longitude) || longitude < -180.0 || longitude > 180.0) {
                throw new IllegalArgumentException("Longitude must be between -180 and 180 degrees");
            }
        }

        if (radiusKm != null && (Double.isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100.0)) {
            throw new IllegalArgumentException("Radius must be a positive number up to 100 km");
        }

        if (page != null && page < 0) {
            throw new IllegalArgumentException("Page index must not be negative");
        }
        if (size != null && size <= 0) {
            throw new IllegalArgumentException("Page size must be greater than zero");
        }

        com.cakeplatform.api.modules.shop.BusinessType parsedType = null;
        if (org.springframework.util.StringUtils.hasText(businessType)) {
            try {
                parsedType = com.cakeplatform.api.modules.shop.BusinessType.fromString(businessType);
            } catch (IllegalArgumentException ignored) {
                if (page != null) {
                    return ResponseEntity.ok(new org.springframework.data.domain.PageImpl<>(java.util.Collections.emptyList()));
                }
                return ResponseEntity.ok(java.util.Collections.emptyList());
            }
        }

        if (page != null) {
            return ResponseEntity.ok(storefrontService.discoverShopsPaged(
                    country, state, district, city, area, pincode, parsedType, search, location,
                    latitude, longitude, radiusKm, sortBy, page, size
            ));
        } else {
            return ResponseEntity.ok(storefrontService.discoverShops(
                    country, state, district, city, area, pincode, parsedType, search, location,
                    latitude, longitude, radiusKm, sortBy, size
            ));
        }
    }

    // Backward-compatible method overload for legacy callers & unit tests
    public ResponseEntity<List<StorefrontShopResponse>> searchShops(
            String state,
            String district,
            String city,
            String area,
            String businessType,
            String search,
            String location
    ) {
        com.cakeplatform.api.modules.shop.BusinessType parsedType = null;
        if (org.springframework.util.StringUtils.hasText(businessType)) {
            try {
                parsedType = com.cakeplatform.api.modules.shop.BusinessType.fromString(businessType);
            } catch (IllegalArgumentException ignored) {
                return ResponseEntity.ok(java.util.Collections.emptyList());
            }
        }
        return ResponseEntity.ok(storefrontService.searchShops(state, district, city, area, parsedType, search, location));
    }


    @GetMapping("/{shopId}/delivery-slots")
    public ResponseEntity<List<StorefrontDeliverySlotResponse>> getShopDeliverySlots(
            @PathVariable Long shopId,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        return ResponseEntity.ok(storefrontService.getShopDeliverySlots(shopId, date));
    }

    @GetMapping("/{shopId}/products")
    public ResponseEntity<List<Product>> getShopProducts(@PathVariable Long shopId) {
        return ResponseEntity.ok(storefrontService.getShopProducts(shopId));
    }

    @GetMapping("/{shopId}/products/top-rated")
    public ResponseEntity<List<Product>> getTopRatedProducts(
            @PathVariable Long shopId,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(storefrontService.getTopRatedProducts(shopId, limit));
    }

    @GetMapping("/{shopId}/products/{productId}")
    public ResponseEntity<Product> getShopProductDetails(
            @PathVariable Long shopId,
            @PathVariable Long productId) {
        return ResponseEntity.ok(storefrontService.getShopProductDetails(shopId, productId));
    }

    @PostMapping("/{shopId}/orders")
    public ResponseEntity<Order> placeGuestOrder(
            @PathVariable Long shopId,
            @Valid @RequestBody GuestOrderRequest request) {
        return ResponseEntity.ok(storefrontService.placeGuestOrder(shopId, request));
    }

    @PostMapping("/{shopId}/quote")
    public ResponseEntity<com.cakeplatform.api.modules.storefront.dto.StorefrontQuoteResponse> calculateOrderQuote(
            @PathVariable Long shopId,
            @Valid @RequestBody com.cakeplatform.api.modules.storefront.dto.StorefrontQuoteRequest request) {
        return ResponseEntity.ok(storefrontService.calculateQuote(shopId, request));
    }

    @PostMapping("/{shopId}/coupons/validate")
    public ResponseEntity<ValidateCouponResponse> validateCoupon(
            @PathVariable Long shopId,
            @Valid @RequestBody ValidateCouponRequest request) {
        return ResponseEntity.ok(storefrontService.validateCouponForStorefront(shopId, request));
    }

    @GetMapping("/{shopId}/coupons")
    public ResponseEntity<List<com.cakeplatform.api.modules.storefront.dto.PublicCouponResponse>> getPublicShopCoupons(@PathVariable Long shopId) {
        return ResponseEntity.ok(storefrontService.getPublicShopCoupons(shopId));
    }

    @GetMapping("/orders/{orderNumber}")
    public ResponseEntity<Order> getGuestOrderDetails(
            @PathVariable String orderNumber,
            @RequestParam(required = false) String trackPhone
    ) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticated = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal());
        
        if (!isAuthenticated && (trackPhone == null || trackPhone.isBlank())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }

        Order order;
        try {
            order = storefrontService.getGuestOrder(orderNumber);
        } catch (RuntimeException e) {
            if ("Order not found or invalid order number".equals(e.getMessage())) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).build();
            }
            throw e;
        }
        
        String normalizedOrderPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(order.getCustomerPhone());

        if (isAuthenticated) {
            Object principal = auth.getPrincipal();
            if (!(principal instanceof com.cakeplatform.api.security.CustomUserDetails)) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
            }
            com.cakeplatform.api.security.CustomUserDetails userDetails = (com.cakeplatform.api.security.CustomUserDetails) principal;
            String userPhone = userDetails.getUser().getMobile();
            
            String normalizedUserPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(userPhone);

            if (normalizedUserPhone == null || !normalizedUserPhone.equals(normalizedOrderPhone)) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
            }
        } else {
            String normalizedTrackPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(trackPhone);
            if (normalizedTrackPhone == null || !normalizedTrackPhone.equals(normalizedOrderPhone)) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).build();
            }
        }

        return ResponseEntity.ok(order);
    }

    @GetMapping("/orders/{orderNumber}/invoice")
    public ResponseEntity<byte[]> downloadInvoice(
            @PathVariable String orderNumber,
            @RequestParam(required = false) String trackPhone
    ) throws Exception {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticated = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal());
        
        if (!isAuthenticated && (trackPhone == null || trackPhone.isBlank())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }

        Order order;
        try {
            order = storefrontService.getGuestOrder(orderNumber);
        } catch (RuntimeException e) {
            if ("Order not found or invalid order number".equals(e.getMessage())) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).build();
            }
            throw e;
        }

        String normalizedOrderPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(order.getCustomerPhone());

        if (isAuthenticated) {
            Object principal = auth.getPrincipal();
            if (!(principal instanceof com.cakeplatform.api.security.CustomUserDetails)) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
            }
            com.cakeplatform.api.security.CustomUserDetails userDetails = (com.cakeplatform.api.security.CustomUserDetails) principal;
            String userPhone = userDetails.getUser().getMobile();
            
            String normalizedUserPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(userPhone);

            if (normalizedUserPhone == null || !normalizedUserPhone.equals(normalizedOrderPhone)) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
            }
        } else {
            String normalizedTrackPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(trackPhone);
            if (normalizedTrackPhone == null || !normalizedTrackPhone.equals(normalizedOrderPhone)) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).build();
            }
        }

        if (invoiceService == null) {
            throw new IllegalStateException("Invoice service is currently unavailable");
        }
        byte[] pdfBytes = invoiceService.generateInvoice(order);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "invoice-" + order.getOrderNumber() + ".pdf");

        return new ResponseEntity<>(pdfBytes, headers, org.springframework.http.HttpStatus.OK);
    }
}
