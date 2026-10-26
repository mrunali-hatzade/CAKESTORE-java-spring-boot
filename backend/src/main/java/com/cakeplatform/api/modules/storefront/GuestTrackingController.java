package com.cakeplatform.api.modules.storefront;

import com.cakeplatform.api.modules.auth.service.GuestOtpService;
import com.cakeplatform.api.modules.order.Order;
import com.cakeplatform.api.modules.order.OrderRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/storefront/tracking")
@RequiredArgsConstructor
public class GuestTrackingController {

    private final GuestOtpService otpService;
    private final OrderRepository orderRepository;
    private final com.cakeplatform.api.modules.user.UserRepository userRepository;

    @PostMapping("/request-otp")
    public ResponseEntity<com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse> requestOtp(@RequestBody PhoneRequest request) {
        if (request.getPhone() == null || request.getPhone().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        com.cakeplatform.api.modules.auth.dto.OtpDeliveryResponse response =
                otpService.requestOtp(request.getPhone(), request.getEmail());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<TokenResponse> verifyOtp(@RequestBody VerifyOtpRequest request) {
        if (request.getPhone() == null || request.getOtp() == null) {
            return ResponseEntity.badRequest().build();
        }
        String token = otpService.verifyOtp(request.getPhone(), request.getOtp());
        return ResponseEntity.ok(new TokenResponse(token));
    }

    @GetMapping("/orders")
    public ResponseEntity<Page<Order>> getMyOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean isCustomer = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"));
        if (!isCustomer) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String phone = null;
        if (auth.getPrincipal() instanceof com.cakeplatform.api.security.CustomUserDetails cud && cud.getUser() != null) {
            phone = cud.getUser().getMobile();
        }
        if (phone == null || phone.isBlank()) {
            String identifier = auth.getName();
            com.cakeplatform.api.modules.user.User user = userRepository.findByEmailIgnoreCase(identifier)
                    .orElseGet(() -> userRepository.findByMobile(identifier).orElse(null));
            if (user != null && user.getMobile() != null) {
                phone = user.getMobile();
            } else {
                phone = identifier;
            }
        }

        String normalizedPhone = com.cakeplatform.api.modules.auth.service.AuthService.normalizeIndianMobile(phone);
        if (normalizedPhone != null) {
            phone = normalizedPhone;
        }

        Page<Order> orders = orderRepository.findVisibleOrdersByCustomerPhone(phone, PageRequest.of(page, size));
        return ResponseEntity.ok(orders);
    }

    @Data
    public static class PhoneRequest {
        private String phone;
        private String email;
    }

    @Data
    public static class VerifyOtpRequest {
        private String phone;
        private String otp;
    }

    @Data
    public static class TokenResponse {
        private final String token;
    }
}
