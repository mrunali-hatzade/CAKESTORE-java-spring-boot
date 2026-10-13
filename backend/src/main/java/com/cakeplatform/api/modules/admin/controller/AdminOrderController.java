package com.cakeplatform.api.modules.admin.controller;

import com.cakeplatform.api.modules.admin.AdminOrderService;
import com.cakeplatform.api.modules.admin.dto.AdminOrderDetailResponse;
import com.cakeplatform.api.modules.admin.dto.AdminOrderSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/orders")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    @GetMapping
    public ResponseEntity<Page<AdminOrderSummaryResponse>> getCrossShopOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String orderStatus,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) Long shopId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        if (size > 50) {
            size = 50;
        }

        // Support both "status" and "orderStatus" parameter names transparently
        String effectiveStatus = (status != null && !status.isBlank()) ? status : orderStatus;

        Page<AdminOrderSummaryResponse> orders = adminOrderService.getCrossShopOrders(
                page,
                size,
                query,
                effectiveStatus,
                paymentStatus,
                shopId,
                startDate,
                endDate
        );

        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminOrderDetailResponse> getOrderDetails(@PathVariable Long id) {
        AdminOrderDetailResponse orderDetails = adminOrderService.getOrderDetails(id);
        return ResponseEntity.ok(orderDetails);
    }
}
