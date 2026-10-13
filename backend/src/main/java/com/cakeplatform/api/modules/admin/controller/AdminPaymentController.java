package com.cakeplatform.api.modules.admin.controller;

import com.cakeplatform.api.modules.admin.AdminPaymentService;
import com.cakeplatform.api.modules.admin.dto.AdminPaymentDetailResponse;
import com.cakeplatform.api.modules.admin.dto.AdminPaymentSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/payments")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class AdminPaymentController {

    private final AdminPaymentService adminPaymentService;

    @GetMapping
    public ResponseEntity<Page<AdminPaymentSummaryResponse>> getCrossShopPayments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String transactionType,
            @RequestParam(required = false) Long shopId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        if (size > 50) {
            size = 50;
        }

        // Support both "type" and "transactionType" parameter names transparently
        String effectiveType = (type != null && !type.isBlank()) ? type : transactionType;

        Page<AdminPaymentSummaryResponse> payments = adminPaymentService.getCrossShopPayments(
                page,
                size,
                query,
                status,
                effectiveType,
                shopId,
                startDate,
                endDate
        );

        return ResponseEntity.ok(payments);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminPaymentDetailResponse> getPaymentDetails(@PathVariable Long id) {
        AdminPaymentDetailResponse paymentDetails = adminPaymentService.getPaymentDetails(id);
        return ResponseEntity.ok(paymentDetails);
    }
}
