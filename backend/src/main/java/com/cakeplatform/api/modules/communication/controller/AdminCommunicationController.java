package com.cakeplatform.api.modules.communication.controller;

import com.cakeplatform.api.modules.communication.ContactEnquiry;
import com.cakeplatform.api.modules.communication.ContactEnquiryService;
import com.cakeplatform.api.modules.communication.PlatformFeedback;
import com.cakeplatform.api.modules.communication.PlatformFeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import com.cakeplatform.api.security.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.cakeplatform.api.modules.communication.dto.AdminReplyRequest;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminCommunicationController {

    private final PlatformFeedbackService feedbackService;
    private final ContactEnquiryService enquiryService;

    @GetMapping("/feedback")
    public ResponseEntity<org.springframework.data.domain.Page<PlatformFeedback>> getPlatformFeedback(
            @RequestParam(required = false) Boolean isRead,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("Admin fetching platform feedback (isRead={}, search={}, page={}, size={})", isRead, search, page, size);
        return ResponseEntity.ok(feedbackService.getFeedback(isRead, search, org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by("createdAt").descending())));
    }

    @PatchMapping("/feedback/{id}/read")
    public ResponseEntity<Map<String, Object>> markFeedbackRead(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long adminUserId = userDetails != null ? userDetails.getId() : null;
        log.info("Admin {} marking platform feedback ID {} as read", adminUserId, id);
        feedbackService.markAsRead(id, adminUserId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Feedback marked as read"));
    }

    @GetMapping("/enquiries")
    public ResponseEntity<org.springframework.data.domain.Page<ContactEnquiry>> getContactEnquiries(
            @RequestParam(required = false) Boolean isRead,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("Admin fetching contact enquiries (isRead={}, search={}, page={}, size={})", isRead, search, page, size);
        return ResponseEntity.ok(enquiryService.getEnquiries(isRead, search, org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by("createdAt").descending())));
    }

    @PatchMapping("/enquiries/{id}/read")
    public ResponseEntity<Map<String, Object>> markEnquiryRead(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long adminUserId = userDetails != null ? userDetails.getId() : null;
        log.info("Admin {} marking contact enquiry ID {} as read", adminUserId, id);
        enquiryService.markAsRead(id, adminUserId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Enquiry marked as read"));
    }

    @PostMapping("/feedback/{id}/reply")
    public ResponseEntity<Map<String, Object>> replyToFeedback(
            @PathVariable Long id,
            @RequestBody AdminReplyRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long adminUserId = userDetails != null ? userDetails.getId() : null;
        log.info("Admin {} replying to platform feedback ID {}", adminUserId, id);
        feedbackService.replyToFeedback(id, request.getMessage(), adminUserId);
        return ResponseEntity.ok(Map.of("message", "Reply sent successfully", "id", id));
    }

    @PostMapping("/enquiries/{id}/reply")
    public ResponseEntity<Map<String, Object>> replyToEnquiry(
            @PathVariable Long id,
            @RequestBody AdminReplyRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long adminUserId = userDetails != null ? userDetails.getId() : null;
        log.info("Admin {} replying to contact enquiry ID {}", adminUserId, id);
        enquiryService.replyToEnquiry(id, request.getMessage(), adminUserId);
        return ResponseEntity.ok(Map.of("message", "Reply sent successfully", "id", id));
    }

    @GetMapping("/communication/summary")
    public ResponseEntity<PlatformFeedbackService.CommunicationSummaryResponse> getCommunicationSummary() {
        log.info("Admin fetching communication summary counts");
        return ResponseEntity.ok(feedbackService.getSummary());
    }
}
