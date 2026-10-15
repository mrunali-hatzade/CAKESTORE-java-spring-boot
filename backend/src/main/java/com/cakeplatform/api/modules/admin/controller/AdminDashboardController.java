package com.cakeplatform.api.modules.admin.controller;

import com.cakeplatform.api.modules.admin.AdminDashboardService;
import com.cakeplatform.api.modules.admin.dto.AdminShopDetailsResponse;
import com.cakeplatform.api.modules.admin.dto.AdminShopSummaryResponse;
import com.cakeplatform.api.modules.admin.dto.DashboardStatsResponse;
import com.cakeplatform.api.modules.shop.Shop;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.cakeplatform.api.security.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class AdminDashboardController {

    @GetMapping("/dashboard/stats/activity")
    public ResponseEntity<java.util.List<com.cakeplatform.api.modules.audit.ActivityLog>> getRecentActivity() {
        return ResponseEntity.ok(adminDashboardService.getRecentGlobalActivity());
    }


    @GetMapping("/dashboard/stats/analytics/revenue")
    public ResponseEntity<com.cakeplatform.api.modules.admin.dto.AnalyticsChartResponse> getRevenueAnalytics() {
        return ResponseEntity.ok(adminDashboardService.getRevenueAnalytics());
    }


    private final AdminDashboardService adminDashboardService;

    @GetMapping("/dashboard/stats")
    public ResponseEntity<DashboardStatsResponse> getPlatformStats(
            @RequestParam(required = false) java.time.LocalDate startDate,
            @RequestParam(required = false) java.time.LocalDate endDate) {
        return ResponseEntity.ok(adminDashboardService.getPlatformStats(startDate, endDate));
    }

    @GetMapping("/shops")
    public ResponseEntity<org.springframework.data.domain.Page<AdminShopSummaryResponse>> getAllShops(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {
        if (size > 50) {
            size = 50;
        }
        return ResponseEntity.ok(adminDashboardService.getAllShops(org.springframework.data.domain.PageRequest.of(page, size), search, status));
    }

    /**
     * Lightweight endpoint that returns ONLY the shop status counts for tab badges.
     * Much cheaper than getPlatformStats() which aggregates revenue, orders, etc.
     */
    @GetMapping("/shops/counts")
    public ResponseEntity<Map<String, Long>> getShopCounts() {
        return ResponseEntity.ok(adminDashboardService.getShopStatusCounts());
    }

    @GetMapping("/shops/{shopId}")
    public ResponseEntity<AdminShopDetailsResponse> getShopDetails(@PathVariable Long shopId) {
        return ResponseEntity.ok(adminDashboardService.getShopDetails(shopId));
    }

    @PatchMapping("/shops/{shopId}/status")
    public ResponseEntity<Shop> updateShopStatus(
            @PathVariable Long shopId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> payload) {
        
        String newStatus = payload != null ? payload.get("status") : null;
        if (newStatus == null || newStatus.trim().isEmpty()) {
            throw new IllegalArgumentException("'status' field is required in payload");
        }
        String reason = payload.get("reason");
        if ("SUSPENDED".equalsIgnoreCase(newStatus.trim())) {
            if (reason == null || reason.trim().isEmpty()) {
                throw new IllegalArgumentException("Suspension reason is mandatory and cannot be blank");
            }
        }
        Long actorUserId = (userDetails != null) ? userDetails.getId() : null;
        Shop updated = adminDashboardService.updateShopStatus(shopId, newStatus.trim().toUpperCase(), reason != null ? reason.trim() : null, actorUserId);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/shops/{shopId}/marketplace-restriction")
    public ResponseEntity<Shop> updateMarketplaceRestriction(
            @PathVariable Long shopId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, Object> payload) {
        
        Object restrictedObj = payload.get("restricted");
        if (restrictedObj == null) {
            throw new IllegalArgumentException("'restricted' boolean field is required in payload");
        }
        boolean restricted = Boolean.parseBoolean(restrictedObj.toString());
        String reason = payload.get("reason") != null ? payload.get("reason").toString() : null;
        Long actorUserId = (userDetails != null) ? userDetails.getId() : null;

        Shop updated = adminDashboardService.updateMarketplaceRestriction(shopId, restricted, reason, actorUserId);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/shops/{shopId}/verification")
    public ResponseEntity<Shop> reviewShopVerification(
            @PathVariable Long shopId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> payload) {
        
        String action = payload.get("action");
        String reason = payload.get("reason");
        Long actorUserId = (userDetails != null) ? userDetails.getId() : null;
        Shop updated = adminDashboardService.reviewShopVerification(shopId, action, reason, actorUserId);
        return ResponseEntity.ok(updated);
    }
}
