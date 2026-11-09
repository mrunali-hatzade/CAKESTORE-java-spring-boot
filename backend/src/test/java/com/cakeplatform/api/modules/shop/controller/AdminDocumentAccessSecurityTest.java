package com.cakeplatform.api.modules.shop.controller;

import com.cakeplatform.api.modules.shop.*;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import com.cakeplatform.api.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class AdminDocumentAccessSecurityTest {

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
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private final List<Long> createdDocumentIds = new ArrayList<>();
    private final List<Long> createdShopIds = new ArrayList<>();
    private final List<Long> createdUserIds = new ArrayList<>();

    private String adminToken;
    private String ownerAToken;
    private String ownerBToken;
    private String customerToken;

    private BusinessDocument docShopA;
    private BusinessDocument docShopB;
    private BusinessDocument emptyFileDoc;

    @BeforeEach
    void setUp() {
        String uniq = UUID.randomUUID().toString().substring(0, 8);

        // 1. Admin User
        User admin = new User();
        admin.setEmail("admin_doc_" + uniq + "@test.com");
        admin.setPasswordHash("hashed_pw");
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin = userRepository.save(admin);
        createdUserIds.add(admin.getId());
        adminToken = jwtService.generateToken(new CustomUserDetails(admin));

        // 2. Owner A & Shop A
        User ownerA = new User();
        ownerA.setEmail("ownera_doc_" + uniq + "@test.com");
        ownerA.setPasswordHash("hashed_pw");
        ownerA.setRole(UserRole.SHOP_OWNER);
        ownerA.setStatus(UserStatus.ACTIVE);
        ownerA = userRepository.save(ownerA);
        createdUserIds.add(ownerA.getId());
        ownerAToken = jwtService.generateToken(new CustomUserDetails(ownerA));

        Shop shopA = new Shop();
        shopA.setOwner(ownerA);
        shopA.setBusinessName("Bakery Alpha " + uniq);
        shopA.setStatus(ShopStatus.ACTIVE);
        shopA = shopRepository.save(shopA);
        createdShopIds.add(shopA.getId());

        // 3. Owner B & Shop B
        User ownerB = new User();
        ownerB.setEmail("ownerb_doc_" + uniq + "@test.com");
        ownerB.setPasswordHash("hashed_pw");
        ownerB.setRole(UserRole.SHOP_OWNER);
        ownerB.setStatus(UserStatus.ACTIVE);
        ownerB = userRepository.save(ownerB);
        createdUserIds.add(ownerB.getId());
        ownerBToken = jwtService.generateToken(new CustomUserDetails(ownerB));

        Shop shopB = new Shop();
        shopB.setOwner(ownerB);
        shopB.setBusinessName("Bakery Beta " + uniq);
        shopB.setStatus(ShopStatus.ACTIVE);
        shopB = shopRepository.save(shopB);
        createdShopIds.add(shopB.getId());

        // 4. Customer User
        User customer = new User();
        customer.setEmail("customer_doc_" + uniq + "@test.com");
        customer.setPasswordHash("hashed_pw");
        customer.setRole(UserRole.CUSTOMER);
        customer.setStatus(UserStatus.ACTIVE);
        customer = userRepository.save(customer);
        createdUserIds.add(customer.getId());
        customerToken = jwtService.generateToken(new CustomUserDetails(customer));

        // 5. Documents
        docShopA = new BusinessDocument();
        docShopA.setShop(shopA);
        docShopA.setDocumentType(DocumentType.FSSAI_CERTIFICATE);
        docShopA.setFileUrl("https://cakeblobstorage.blob.core.windows.net/private-kyc/fssai_shop_a.pdf");
        docShopA.setStatus(VerificationStatus.PROCESSING);
        docShopA = businessDocumentRepository.save(docShopA);
        createdDocumentIds.add(docShopA.getId());

        docShopB = new BusinessDocument();
        docShopB.setShop(shopB);
        docShopB.setDocumentType(DocumentType.IDENTITY_PROOF);
        docShopB.setFileUrl("https://cakeblobstorage.blob.core.windows.net/private-kyc/pan_shop_b.pdf");
        docShopB.setStatus(VerificationStatus.PROCESSING);
        docShopB = businessDocumentRepository.save(docShopB);
        createdDocumentIds.add(docShopB.getId());

        emptyFileDoc = new BusinessDocument();
        emptyFileDoc.setShop(shopA);
        emptyFileDoc.setDocumentType(DocumentType.GST_CERTIFICATE);
        emptyFileDoc.setFileUrl("");
        emptyFileDoc.setStatus(VerificationStatus.PROCESSING);
        emptyFileDoc = businessDocumentRepository.save(emptyFileDoc);
        createdDocumentIds.add(emptyFileDoc.getId());
    }

    @AfterEach
    void tearDown() {
        List<Throwable> errors = new ArrayList<>();

        // 1. Delete created business documents
        if (!createdDocumentIds.isEmpty()) {
            for (Long docId : createdDocumentIds) {
                try {
                    jdbcTemplate.update("DELETE FROM business_documents WHERE id = ?", docId);
                } catch (Throwable t) {
                    errors.add(t);
                }
            }
            createdDocumentIds.clear();
        }

        // 2. Delete created shops
        if (!createdShopIds.isEmpty()) {
            for (Long shopId : createdShopIds) {
                try {
                    jdbcTemplate.update("DELETE FROM business_documents WHERE shop_id = ?", shopId);
                    jdbcTemplate.update("DELETE FROM shops WHERE id = ?", shopId);
                } catch (Throwable t) {
                    errors.add(t);
                }
            }
            createdShopIds.clear();
        }

        // 3. Delete created users
        if (!createdUserIds.isEmpty()) {
            for (Long uid : createdUserIds) {
                try {
                    jdbcTemplate.update("DELETE FROM users WHERE id = ?", uid);
                } catch (Throwable t) {
                    errors.add(t);
                }
            }
            createdUserIds.clear();
        }

        if (!errors.isEmpty()) {
            org.junit.jupiter.api.Assertions.fail("Teardown failed with " + errors.size() + " errors: " + errors.get(0).getMessage());
        }
    }

    @Test
    @DisplayName("Admin: View document via 302 redirect by default")
    void adminCanViewDocumentWithRedirect() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docShopA.getId() + "/view")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isFound())
                .andExpect(header().exists("Location"))
                .andExpect(header().string("Location", containsString("fssai_shop_a.pdf")));
    }

    @Test
    @DisplayName("Admin: View document via JSON response when redirect=false")
    void adminCanViewDocumentAsJson() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docShopA.getId() + "/view")
                        .param("redirect", "false")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.documentId").value(docShopA.getId()))
                .andExpect(jsonPath("$.url").isNotEmpty())
                .andExpect(jsonPath("$.url", containsString("fssai_shop_a.pdf")))
                .andExpect(jsonPath("$.documentType").value("FSSAI_CERTIFICATE"))
                .andExpect(jsonPath("$.status").value("PROCESSING"));
    }

    @Test
    @DisplayName("Admin: View document via JSON response when Accept: application/json")
    void adminCanViewDocumentWithAcceptJsonHeader() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docShopB.getId() + "/view")
                        .accept(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(docShopB.getId()))
                .andExpect(jsonPath("$.url", containsString("pan_shop_b.pdf")));
    }

    @Test
    @DisplayName("Security: Unauthenticated request to admin document viewing must be rejected")
    void unauthenticatedAdminAccessRejected() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docShopA.getId() + "/view"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Security: Customer role accessing admin document viewing must receive 403 Forbidden")
    void customerRoleCannotAccessAdminDocumentView() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docShopA.getId() + "/view")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security: Shop Owner role accessing admin document viewing must receive 403 Forbidden")
    void ownerRoleCannotAccessAdminDocumentView() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + docShopA.getId() + "/view")
                        .header("Authorization", "Bearer " + ownerAToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Owner: Can view own shop document via JSON")
    void ownerCanViewOwnShopDocument() throws Exception {
        mockMvc.perform(get("/api/owner/documents/" + docShopA.getId() + "/view")
                        .param("redirect", "false")
                        .header("Authorization", "Bearer " + ownerAToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(docShopA.getId()))
                .andExpect(jsonPath("$.url", containsString("fssai_shop_a.pdf")));
    }

    @Test
    @DisplayName("Owner: Can view own shop document via 302 redirect")
    void ownerCanViewOwnShopDocumentWithRedirect() throws Exception {
        mockMvc.perform(get("/api/owner/documents/" + docShopA.getId() + "/view")
                        .header("Authorization", "Bearer " + ownerAToken))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("fssai_shop_a.pdf")));
    }

    @Test
    @DisplayName("Security: Owner cannot access another shop document (Cross-shop isolation violation)")
    void ownerCannotAccessOtherShopDocument() throws Exception {
        mockMvc.perform(get("/api/owner/documents/" + docShopB.getId() + "/view")
                        .header("Authorization", "Bearer " + ownerAToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security: Customer cannot access owner document viewing endpoint")
    void customerCannotAccessOwnerDocumentView() throws Exception {
        mockMvc.perform(get("/api/owner/documents/" + docShopA.getId() + "/view")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin: Non-existent document ID returns 404 Not Found")
    void adminNonExistentDocumentReturns404() throws Exception {
        mockMvc.perform(get("/api/admin/documents/999999/view")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Owner: Non-existent document ID returns 404 Not Found")
    void ownerNonExistentDocumentReturns404() throws Exception {
        mockMvc.perform(get("/api/owner/documents/999999/view")
                        .header("Authorization", "Bearer " + ownerAToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Admin: Document with empty file URL returns 404 Not Found")
    void emptyFileUrlReturns404() throws Exception {
        mockMvc.perform(get("/api/admin/documents/" + emptyFileDoc.getId() + "/view")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }
}
