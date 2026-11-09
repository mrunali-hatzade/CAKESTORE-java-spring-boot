package com.cakeplatform.api.modules.review.controller;

import com.cakeplatform.api.modules.review.ReviewModerationStatus;
import com.cakeplatform.api.modules.review.dto.AdminProductReviewResponse;
import com.cakeplatform.api.modules.review.dto.AdminReviewModerationRequest;
import com.cakeplatform.api.modules.review.service.AdminProductReviewService;
import com.cakeplatform.api.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/reviews")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminProductReviewController {

    private final AdminProductReviewService adminProductReviewService;

    @GetMapping
    public ResponseEntity<Page<AdminProductReviewResponse>> listReviews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortField,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) ReviewModerationStatus status,
            @RequestParam(required = false) Long shopId,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String query) {

        String effectiveQuery = (query != null && !query.isBlank()) ? query : search;

        log.info("Admin listing product reviews (page={}, size={}, status={}, shopId={}, rating={}, query={})",
                page, size, status, shopId, rating, effectiveQuery);

        Page<AdminProductReviewResponse> response = adminProductReviewService.getReviews(
                page,
                size,
                sortField,
                sortDir,
                status,
                shopId,
                rating,
                effectiveQuery
        );

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/moderation")
    public ResponseEntity<AdminProductReviewResponse> moderateReview(
            @PathVariable Long id,
            @Valid @RequestBody AdminReviewModerationRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        Long adminUserId = userDetails != null ? userDetails.getId() : null;
        log.info("Admin {} moderating product review ID {} to status: {}", adminUserId, id, request.getStatus());

        AdminProductReviewResponse response = adminProductReviewService.updateModerationStatus(
                id,
                request,
                adminUserId
        );

        return ResponseEntity.ok(response);
    }
}
