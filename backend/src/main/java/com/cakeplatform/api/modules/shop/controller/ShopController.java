package com.cakeplatform.api.modules.shop.controller;

import com.cakeplatform.api.modules.shop.dto.ShopResponse;
import com.cakeplatform.api.modules.shop.dto.UpdateShopRequest;
import com.cakeplatform.api.modules.shop.dto.OwnerDashboardStatsResponse;
import com.cakeplatform.api.modules.shop.dto.OwnerGlobalSearchResponse;
import com.cakeplatform.api.modules.shop.service.OwnerDashboardService;
import com.cakeplatform.api.modules.shop.service.ShopService;
import com.cakeplatform.api.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    @PutMapping("/my-shop/status")
    public ResponseEntity<ShopResponse> updateMyShopStatus(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam com.cakeplatform.api.modules.shop.ShopStatus status,
            @RequestParam(required = false) String reason
    ) {
        return ResponseEntity.ok(shopService.updateShopStatusAndReason(userDetails.getId(), status, reason));
    }

    @PutMapping("/my-shop/operational-status")
    public ResponseEntity<ShopResponse> updateOperationalStatus(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody java.util.Map<String, Boolean> payload
    ) {
        Boolean enabled = payload.get("enabled");
        if (enabled == null) {
            throw new IllegalArgumentException("'enabled' boolean field is required in payload");
        }
        return ResponseEntity.ok(shopService.updateOperationalStatus(userDetails.getId(), enabled));
    }


    private final ShopService shopService;
    private final OwnerDashboardService dashboardService;

    @GetMapping("/my-shop")
    public ResponseEntity<ShopResponse> getMyShopProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        return ResponseEntity.ok(shopService.getMyShopProfile(userDetails.getId()));
    }

    @PutMapping("/my-shop")
    public ResponseEntity<ShopResponse> updateMyShopProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody UpdateShopRequest request
    ) {
        return ResponseEntity.ok(shopService.updateMyShopProfile(userDetails.getId(), request));
    }

    @GetMapping("/my-shop/stats")
    public ResponseEntity<OwnerDashboardStatsResponse> getDashboardStats(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        return ResponseEntity.ok(dashboardService.getDashboardStats(userDetails.getId()));
    }

    @GetMapping("/my-shop/search")
    public ResponseEntity<OwnerGlobalSearchResponse> globalSearch(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        return ResponseEntity.ok(dashboardService.globalSearch(userDetails.getId(), query));
    }
}
