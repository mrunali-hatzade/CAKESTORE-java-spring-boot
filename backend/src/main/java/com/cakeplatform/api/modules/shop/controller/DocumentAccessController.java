package com.cakeplatform.api.modules.shop.controller;

import com.cakeplatform.api.config.FileStorageProperties;
import com.cakeplatform.api.modules.media.StorageService;
import com.cakeplatform.api.modules.shop.BusinessDocument;
import com.cakeplatform.api.modules.shop.BusinessDocumentRepository;
import com.cakeplatform.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentAccessController {

    private static final long SIGNED_URL_VALIDITY_MS = 15 * 60 * 1000L; // 15 minutes

    private final BusinessDocumentRepository businessDocumentRepository;
    private final StorageService storageService;
    private final FileStorageProperties fileStorageProperties;

    @Value("${jwt.secret}")
    private String jwtSecret;

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

    @GetMapping("/documents/secure-view/{id}")
    public ResponseEntity<?> serveSecureDocument(
            @PathVariable("id") Long docId,
            @RequestParam("expires") long expires,
            @RequestParam("sig") String sig) {

        // 1. Check expiration
        if (System.currentTimeMillis() > expires) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // 2. Validate cryptographic signature (constant-time)
        if (!verifyHmacSignature(docId, expires, sig)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // 3. Confirm document record
        BusinessDocument doc = businessDocumentRepository.findById(docId).orElse(null);
        if (doc == null || doc.getFileUrl() == null || doc.getFileUrl().trim().isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // 4. Validate storage path and prevent arbitrary filesystem paths
        String fileUrl = doc.getFileUrl();
        String subDirectory;
        String marker;
        if (fileUrl.contains("/uploads/documents/")) {
            marker = "/uploads/documents/";
            subDirectory = "documents";
        } else if (fileUrl.contains("/uploads/verifications/")) {
            marker = "/uploads/verifications/";
            subDirectory = "verifications";
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        int idx = fileUrl.indexOf(marker) + marker.length();
        String fileName = fileUrl.substring(idx);
        if (fileName.contains("?")) {
            fileName = fileName.substring(0, fileName.indexOf("?"));
        }

        // Strict path traversal and safe character check
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")
                || !fileName.matches("^[a-zA-Z0-9._-]+$")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String lowerFileName = fileName.toLowerCase();
        if (!lowerFileName.endsWith(".pdf") && !lowerFileName.endsWith(".jpg")
                && !lowerFileName.endsWith(".jpeg") && !lowerFileName.endsWith(".png")
                && !lowerFileName.endsWith(".webp")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        try {
            Path uploadDir = Paths.get(fileStorageProperties.getUploadDir()).toAbsolutePath().normalize();
            Path subDirPath = uploadDir.resolve(subDirectory).normalize();
            Path targetFile = subDirPath.resolve(fileName).normalize();

            // Guard against directory traversal escaping the uploads directory
            if (!targetFile.startsWith(uploadDir)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            Resource resource = new UrlResource(targetFile.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            MediaType mediaType;
            if (lowerFileName.endsWith(".pdf")) {
                mediaType = MediaType.APPLICATION_PDF;
            } else if (lowerFileName.endsWith(".png")) {
                mediaType = MediaType.IMAGE_PNG;
            } else if (lowerFileName.endsWith(".webp")) {
                mediaType = MediaType.parseMediaType("image/webp");
            } else {
                mediaType = MediaType.IMAGE_JPEG;
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .header(HttpHeaders.CACHE_CONTROL, "private, no-cache, no-store, must-revalidate")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .header("X-Content-Type-Options", "nosniff")
                    .body(resource);
        } catch (Exception ex) {
            return ResponseEntity.notFound().build();
        }
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

        String targetUrl;
        if (isLocalPrivateDocument(doc.getFileUrl())) {
            long expires = System.currentTimeMillis() + SIGNED_URL_VALIDITY_MS;
            String signature = generateHmacSignature(docId, expires);
            try {
                targetUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                        .path("/api/documents/secure-view/")
                        .path(String.valueOf(docId))
                        .queryParam("expires", expires)
                        .queryParam("sig", signature)
                        .toUriString();
            } catch (Exception ex) {
                targetUrl = "/api/documents/secure-view/" + docId + "?expires=" + expires + "&sig=" + signature;
            }
        } else {
            targetUrl = storageService.generateSignedUrl(doc.getFileUrl());
        }

        if (targetUrl == null || targetUrl.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Unable to generate signed URL for document"));
        }

        boolean wantsJson = !redirect || (acceptHeader != null && acceptHeader.contains("application/json"));
        if (wantsJson) {
            return ResponseEntity.ok(Map.of(
                    "documentId", docId,
                    "url", targetUrl,
                    "documentType", doc.getDocumentType() != null ? doc.getDocumentType().name() : "UNKNOWN",
                    "status", doc.getStatus() != null ? doc.getStatus().name() : "PENDING"
            ));
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(targetUrl))
                .build();
    }

    private boolean isLocalPrivateDocument(String fileUrl) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            return false;
        }
        if (fileUrl.contains("res.cloudinary.com") || fileUrl.contains(".blob.core.windows.net")) {
            return false;
        }
        return fileUrl.contains("/uploads/documents/") || fileUrl.contains("/uploads/verifications/");
    }

    private String generateHmacSignature(Long docId, long expires) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            String payload = docId + ":" + expires;
            byte[] hash = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate HMAC signature", e);
        }
    }

    private boolean verifyHmacSignature(Long docId, long expires, String signature) {
        if (signature == null || signature.trim().isEmpty()) {
            return false;
        }
        String expected = generateHmacSignature(docId, expires);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.trim().getBytes(StandardCharsets.UTF_8)
        );
    }
}
