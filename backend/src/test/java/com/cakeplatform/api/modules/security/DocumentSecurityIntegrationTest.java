package com.cakeplatform.api.modules.security;

import com.cakeplatform.api.config.FileStorageProperties;
import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
public class DocumentSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private BusinessDocumentRepository businessDocumentRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FileStorageProperties fileStorageProperties;

    private User admin;
    private User ownerA;
    private User ownerB;

    private Shop shopA;
    private Shop shopB;

    private BusinessDocument docA;
    private BusinessDocument docB;

    private String adminToken;
    private String ownerAToken;
    private String ownerBToken;

    private Path testDocPath;

    @BeforeEach
    void setUp() throws Exception {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Create Admin
        admin = new User();
        admin.setEmail("admin_" + uniq + "@test.com");
        admin.setPasswordHash("password");
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin = userRepository.save(admin);
        adminToken = jwtService.generateToken(new CustomUserDetails(admin));

        // 2. Create Owner A and Shop A
        ownerA = new User();
        ownerA.setEmail("ownera_" + uniq + "@test.com");
        ownerA.setPasswordHash("password");
        ownerA.setRole(UserRole.SHOP_OWNER);
        ownerA.setStatus(UserStatus.ACTIVE);
        ownerA = userRepository.save(ownerA);
        ownerAToken = jwtService.generateToken(new CustomUserDetails(ownerA));

        shopA = new Shop();
        shopA.setOwner(ownerA);
        shopA.setBusinessName("Bakery Alpha " + uniq);
        shopA.setStatus(ShopStatus.ACTIVE);
        shopA = shopRepository.save(shopA);

        // 3. Create Owner B and Shop B
        ownerB = new User();
        ownerB.setEmail("ownerb_" + uniq + "@test.com");
        ownerB.setPasswordHash("password");
        ownerB.setRole(UserRole.SHOP_OWNER);
        ownerB.setStatus(UserStatus.ACTIVE);
        ownerB = userRepository.save(ownerB);
        ownerBToken = jwtService.generateToken(new CustomUserDetails(ownerB));

        shopB = new Shop();
        shopB.setOwner(ownerB);
        shopB.setBusinessName("Bakery Beta " + uniq);
        shopB.setStatus(ShopStatus.ACTIVE);
        shopB = shopRepository.save(shopB);

        // 4. Create physical test file in uploads/documents
        Path uploadDir = Paths.get(fileStorageProperties.getUploadDir()).toAbsolutePath().normalize();
        Path docsDir = uploadDir.resolve("documents").normalize();
        Files.createDirectories(docsDir);

        String testFileName = "test_fssai_" + uniq + ".jpg";
        testDocPath = docsDir.resolve(testFileName);
        Files.write(testDocPath, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10});

        // 5. Create BusinessDocument for Shop A
        docA = new BusinessDocument();
        docA.setShop(shopA);
        docA.setDocumentType(DocumentType.FSSAI_CERTIFICATE);
        docA.setFileUrl("/uploads/documents/" + testFileName);
        docA.setStatus(VerificationStatus.PROCESSING);
        docA = businessDocumentRepository.save(docA);

        // 6. Create BusinessDocument for Shop B
        docB = new BusinessDocument();
        docB.setShop(shopB);
        docB.setDocumentType(DocumentType.GST_CERTIFICATE);
        docB.setFileUrl("/uploads/documents/b_" + testFileName);
        docB.setStatus(VerificationStatus.PROCESSING);
        docB = businessDocumentRepository.save(docB);
    }

    @AfterEach
    void tearDown() throws Exception {
        if (testDocPath != null && Files.exists(testDocPath)) {
            Files.deleteIfExists(testDocPath);
        }
        try {
            if (docA != null && docA.getId() != null) businessDocumentRepository.deleteById(docA.getId());
        } catch (Exception ignored) {}
        try {
            if (docB != null && docB.getId() != null) businessDocumentRepository.deleteById(docB.getId());
        } catch (Exception ignored) {}
        try {
            if (shopA != null && shopA.getId() != null) shopRepository.deleteById(shopA.getId());
        } catch (Exception ignored) {}
        try {
            if (shopB != null && shopB.getId() != null) shopRepository.deleteById(shopB.getId());
        } catch (Exception ignored) {}
        try {
            if (ownerA != null && ownerA.getId() != null) userRepository.deleteById(ownerA.getId());
        } catch (Exception ignored) {}
        try {
            if (ownerB != null && ownerB.getId() != null) userRepository.deleteById(ownerB.getId());
        } catch (Exception ignored) {}
        try {
            if (admin != null && admin.getId() != null) userRepository.deleteById(admin.getId());
        } catch (Exception ignored) {}
    }

    @Test
    @DisplayName("BM-06-1: Direct unauthenticated static access to /uploads/documents/** is denied (401/403)")
    void testDirectUnauthenticatedAccessToDocumentsIsDenied() throws Exception {
        mockMvc.perform(get("/uploads/documents/any-compliance-file.jpg"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    assertTrue(status == 401 || status == 403, "Unauthenticated access should be rejected with 401 or 403 but was " + status);
                });
    }

    @Test
    @DisplayName("BM-06-1b: Direct authenticated static access to /uploads/documents/** is denied (403)")
    void testDirectAuthenticatedAccessToDocumentsIsForbidden() throws Exception {
        mockMvc.perform(get("/uploads/documents/any-compliance-file.jpg")
                        .header("Authorization", "Bearer " + ownerAToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("BM-06-2: Direct unauthenticated static access to /uploads/verifications/** is denied (401/403)")
    void testDirectUnauthenticatedAccessToVerificationsIsDenied() throws Exception {
        mockMvc.perform(get("/uploads/verifications/any-verification-file.pdf"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    assertTrue(status == 401 || status == 403, "Unauthenticated access should be rejected with 401 or 403 but was " + status);
                });
    }

    @Test
    @DisplayName("BM-06-3: Public media access to /uploads/products/** remains permitted (not 401/403)")
    void testPublicMediaAccessIsPermitted() throws Exception {
        MvcResult result = mockMvc.perform(get("/uploads/products/non-existent-cake.jpg"))
                .andReturn();
        int status = result.getResponse().getStatus();
        // Public media handler is permitted in SecurityConfig; returns 404 because file is not on disk
        assertNotEquals(401, status, "Public media should not require authentication");
        assertNotEquals(403, status, "Public media should not be forbidden");
        assertEquals(404, status, "Public media should resolve to static handler (404 when absent)");
    }

    @Test
    @DisplayName("BM-06-4: Unauthenticated access to admin document view endpoint is rejected (401/403)")
    void testUnauthenticatedAccessToAdminDocumentViewIsRejected() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docA.getId() + "/view?redirect=false"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("BM-06-5: Cross-shop owner cannot generate view URL for another bakery's document (403)")
    void testCrossShopOwnerAccessIsForbidden() throws Exception {
        mockMvc.perform(get("/api/owner/documents/" + docA.getId() + "/view?redirect=false")
                        .header("Authorization", "Bearer " + ownerBToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("BM-06-6: Authorized owner can generate signed view URL for their own document")
    void testAuthorizedOwnerCanGenerateSignedUrl() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/owner/documents/" + docA.getId() + "/view?redirect=false")
                        .header("Authorization", "Bearer " + ownerAToken)
                        .header("Accept", "application/json"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertTrue(json.has("url"));
        String viewUrl = json.get("url").asText();
        assertTrue(viewUrl.contains("/api/documents/secure-view/" + docA.getId()));
        assertTrue(viewUrl.contains("expires="));
        assertTrue(viewUrl.contains("sig="));
    }

    @Test
    @DisplayName("BM-06-7: Authorized admin can view document via signed URL and stream inline content")
    void testAuthorizedAdminCanGenerateAndStreamDocument() throws Exception {
        // 1. Admin requests signed URL with redirect=false
        MvcResult adminViewResult = mockMvc.perform(get("/api/admin/documents/" + docA.getId() + "/view?redirect=false")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("Accept", "application/json"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(adminViewResult.getResponse().getContentAsString());
        String signedUrl = json.get("url").asText();

        // Extract path and query params for mockMvc call
        String relativeUri = signedUrl;
        if (relativeUri.startsWith("http")) {
            relativeUri = relativeUri.substring(relativeUri.indexOf("/api/documents/secure-view/"));
        }

        // 2. Fetch the document using the signed URL without Authorization header (simulates browser window.open)
        mockMvc.perform(get(relativeUri))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(header().string("Content-Disposition", "inline; filename=\"" + testDocPath.getFileName().toString() + "\""))
                .andExpect(header().string("Cache-Control", "private, no-cache, no-store, must-revalidate"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }

    @Test
    @DisplayName("BM-06-8: Expired signature is rejected with 403 Forbidden")
    void testExpiredSignatureIsRejected() throws Exception {
        // Request with an expired timestamp (in the past)
        long expiredTime = System.currentTimeMillis() - 60000; // 1 minute ago
        mockMvc.perform(get("/api/documents/secure-view/" + docA.getId())
                        .param("expires", String.valueOf(expiredTime))
                        .param("sig", "any_signature"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("BM-06-9: Tampered signature is rejected with 403 Forbidden")
    void testTamperedSignatureIsRejected() throws Exception {
        long futureTime = System.currentTimeMillis() + 900000;
        mockMvc.perform(get("/api/documents/secure-view/" + docA.getId())
                        .param("expires", String.valueOf(futureTime))
                        .param("sig", "deadbeef00112233445566778899aabbccddeeff"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("BM-06-10: Tampered document ID is rejected with 403 Forbidden")
    void testTamperedDocumentIdIsRejected() throws Exception {
        // 1. Generate valid signed URL for docA
        MvcResult adminViewResult = mockMvc.perform(get("/api/admin/documents/" + docA.getId() + "/view?redirect=false")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("Accept", "application/json"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(adminViewResult.getResponse().getContentAsString());
        String signedUrl = json.get("url").asText();

        // Extract expires and sig
        String query = signedUrl.substring(signedUrl.indexOf("?") + 1);
        String expires = null;
        String sig = null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=");
            if ("expires".equals(kv[0])) expires = kv[1];
            if ("sig".equals(kv[0])) sig = kv[1];
        }

        assertNotNull(expires);
        assertNotNull(sig);

        // 2. Attempt to use docA's signature to access docB
        mockMvc.perform(get("/api/documents/secure-view/" + docB.getId())
                        .param("expires", expires)
                        .param("sig", sig))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("BM-06-11: Arbitrary path traversal in stored fileUrl is blocked (403)")
    void testArbitraryPathTraversalIsBlocked() throws Exception {
        // Create document with path traversal
        BusinessDocument maliciousDoc = new BusinessDocument();
        maliciousDoc.setShop(shopA);
        maliciousDoc.setDocumentType(DocumentType.FSSAI_CERTIFICATE);
        maliciousDoc.setFileUrl("/uploads/documents/../../etc/passwd.jpg");
        maliciousDoc.setStatus(VerificationStatus.PROCESSING);
        maliciousDoc = businessDocumentRepository.save(maliciousDoc);

        // Generate signed URL
        MvcResult result = mockMvc.perform(get("/api/admin/documents/" + maliciousDoc.getId() + "/view?redirect=false")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("Accept", "application/json"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        String signedUrl = json.get("url").asText();
        String relativeUri = signedUrl.substring(signedUrl.indexOf("/api/documents/secure-view/"));

        // Attempting to stream the path-traversal document should return 403 Forbidden
        mockMvc.perform(get(relativeUri))
                .andExpect(status().isForbidden());
    }
}
