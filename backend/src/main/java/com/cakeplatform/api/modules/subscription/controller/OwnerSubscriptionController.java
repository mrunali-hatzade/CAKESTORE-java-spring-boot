package com.cakeplatform.api.modules.subscription.controller;

import com.cakeplatform.api.modules.subscription.Subscription;
import com.cakeplatform.api.modules.subscription.SubscriptionService;
import com.cakeplatform.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/owner/subscriptions")
@PreAuthorize("hasAuthority('ROLE_SHOP_OWNER')")
@RequiredArgsConstructor
public class OwnerSubscriptionController {

    private final SubscriptionService subscriptionService;

    @GetMapping("/current")
    public ResponseEntity<Subscription> getCurrentSubscription(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        Subscription activeSub = subscriptionService.getActiveSubscription(userDetails.getId());
        if (activeSub == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(activeSub);
    }

    @PostMapping("/cancel")
    public ResponseEntity<Subscription> cancelSubscription(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @jakarta.validation.Valid @RequestBody(required = false) com.cakeplatform.api.modules.subscription.dto.CancelSubscriptionRequest request) {
        String reason = (request != null) ? request.getReason() : null;
        Subscription cancelledSub = subscriptionService.cancelSubscription(userDetails.getId(), reason);
        return ResponseEntity.ok(cancelledSub);
    }
}
