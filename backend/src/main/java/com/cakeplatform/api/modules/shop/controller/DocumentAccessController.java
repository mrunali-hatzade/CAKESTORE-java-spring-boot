package com.cakeplatform.api.modules.shop.controller;

import com.cakeplatform.api.modules.media.StorageService;
import com.cakeplatform.api.modules.shop.BusinessDocument;
import com.cakeplatform.api.modules.shop.BusinessDocumentRepository;
import com.cakeplatform.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentAccessController {

    private final BusinessDocumentRepository businessDocumentRepository;
    private final StorageService storageService;

    @GetMapping("/admin/documents/{id}/view")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> viewDocumentAdmin(
            @PathVariable Long id,
            @RequestHeader(value = "Accept", required = false) String acceptHeader,
            @RequestParam(value = "redirect", required = false, defaultValue = "true") boolean redirect) {
        return handleDocumentView(id, null, true, acceptHeader, redirect);
    }

    @GetMapping("/owner/documents/{id}/view")
    @PreAuthorize("hasAuthority('ROLE_SHOP_OWNER')")
    public ResponseEntity<?> viewDocumentOwner(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestHeader(value = "Accept", required = false) String acceptHeader,
            @RequestParam(value = "redirect", required = false, defaultValue = "true") boolean redirect) {
        return handleDocumentView(id, userDetails != null ? userDetails.getId() : null, false, acceptHeader, redirect);
    }

    private ResponseEntity<?> handleDocumentView(Long docId, Long ownerId, boolean isAdmin, String acceptHeader, boolean redirect) {
        BusinessDocument doc = businessDocumentRepository.findById(docId).orElse(null);
        if (doc == null) {
            return ResponseEntity.notFound().build();
        }

        // Tenant isolation check: non-admins can only view their own shop's documents
        if (!isAdmin && (doc.getShop() == null || doc.getShop().getOwner() == null || !doc.getShop().getOwner().getId().equals(ownerId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (doc.getFileUrl() == null || doc.getFileUrl().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Document file URL is not set"));
        }

        String signedUrl = storageService.generateSignedUrl(doc.getFileUrl());
        if (signedUrl == null || signedUrl.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Unable to generate signed URL for document"));
        }

        boolean wantsJson = !redirect || (acceptHeader != null && acceptHeader.contains("application/json"));
        if (wantsJson) {
            return ResponseEntity.ok(Map.of(
                    "documentId", docId,
                    "url", signedUrl,
                    "documentType", doc.getDocumentType() != null ? doc.getDocumentType().name() : "UNKNOWN",
                    "status", doc.getStatus() != null ? doc.getStatus().name() : "PENDING"
            ));
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(signedUrl))
                .build();
    }
}
