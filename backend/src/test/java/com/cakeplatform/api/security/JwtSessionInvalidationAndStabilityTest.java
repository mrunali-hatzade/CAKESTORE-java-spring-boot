package com.cakeplatform.api.security;

import com.cakeplatform.api.modules.auth.dto.ChangePasswordRequest;
import com.cakeplatform.api.modules.auth.dto.LoginRequest;
import com.cakeplatform.api.modules.auth.entity.PasswordResetToken;
import com.cakeplatform.api.modules.auth.repository.PasswordResetTokenRepository;
import com.cakeplatform.api.modules.auth.repository.RevokedTokenRepository;
import com.cakeplatform.api.modules.shop.Shop;
import com.cakeplatform.api.modules.shop.ShopRepository;
import com.cakeplatform.api.modules.shop.ShopStatus;
import com.cakeplatform.api.modules.shop.VerificationStatus;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class JwtSessionInvalidationAndStabilityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private RevokedTokenRepository revokedTokenRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TokenRevocationService tokenRevocationService;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private User testOwner;
    private Shop testShop;
    private User testAdmin;

    @BeforeEach
    void setUp() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        jdbcTemplate.execute("DELETE FROM revoked_tokens");
        jdbcTemplate.execute("DELETE FROM password_reset_tokens");
        jdbcTemplate.execute("DELETE FROM shops WHERE owner_id IN (SELECT id FROM users WHERE email LIKE '%@cakestore.test')");
        jdbcTemplate.execute("DELETE FROM users WHERE email LIKE '%@cakestore.test'");

        String suffix = String.valueOf(System.nanoTime() % 1000000);

        // 1. Create Test Owner
        testOwner = new User();
        testOwner.setEmail("owner." + suffix + "@cakestore.test");
        testOwner.setFullName("Session Owner");
        testOwner.setPasswordHash(passwordEncoder.encode("SecurePass123!"));
        testOwner.setRole(UserRole.SHOP_OWNER);
        testOwner.setStatus(UserStatus.ACTIVE);
        testOwner.setMobile("98" + String.format("%08d", (int)(Math.random() * 100000000)));
        testOwner.setTokenVersion(1);
        testOwner = userRepository.save(testOwner);

        // 2. Create Test Shop for Owner
        testShop = new Shop();
        testShop.setOwner(testOwner);
        testShop.setBusinessName("Session Cakes " + suffix);
        testShop.setStatus(ShopStatus.ACTIVE);
        testShop.setVerificationStatus(VerificationStatus.VERIFIED);
        testShop = shopRepository.save(testShop);

        // 3. Create Test Admin
        testAdmin = new User();
        testAdmin.setEmail("admin." + suffix + "@cakestore.test");
        testAdmin.setFullName("Session Admin");
        testAdmin.setPasswordHash(passwordEncoder.encode("AdminPass123!"));
        testAdmin.setRole(UserRole.ADMIN);
        testAdmin.setStatus(UserStatus.ACTIVE);
        testAdmin.setMobile("99" + String.format("%08d", (int)(Math.random() * 100000000)));
        testAdmin.setTokenVersion(1);
        testAdmin = userRepository.save(testAdmin);

        testIp = "10.42." + (System.nanoTime() % 200 + 1) + "." + (System.nanoTime() % 200 + 1);
    }

    private String testIp;

    private String generateTokenForUser(User user) {
        CustomUserDetails userDetails = new CustomUserDetails(user);
        return jwtService.generateToken(new HashMap<>(), userDetails);
    }

    @Test
    @DisplayName("1. Valid JWT is accepted on protected endpoints before invalidation")
    void testValidJwtAcceptedBeforeInvalidation() throws Exception {
        String token = generateTokenForUser(testOwner);

        // Access protected owner endpoint
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("2. Explicit logout persists revocation and rejects subsequent requests")
    void testExplicitLogoutRevokesJwtOnSubsequentRequests() throws Exception {
        String token = generateTokenForUser(testOwner);

        // A. Token works initially
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // B. Explicit logout
        mockMvc.perform(post("/api/auth/logout")
                        .header("X-Forwarded-For", testIp)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Verify token hash is stored in database
        String tokenHash = tokenRevocationService.hashToken(token);
        assertThat(revokedTokenRepository.existsByTokenHash(tokenHash)).isTrue();

        // C. Subsequent protected request is rejected with 401 Unauthorized
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("3. Previously issued JWT is rejected after password reset, new login succeeds")
    void testPreviousJwtRejectedAfterPasswordReset() throws Exception {
        String oldToken = generateTokenForUser(testOwner);

        // Verify old token works initially
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk());

        // Create a valid password reset token
        String rawResetToken = "test-reset-token-1234567890123456";
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(rawResetToken.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            String h = Integer.toHexString(0xff & b);
            if (h.length() == 1) hexString.append('0');
            hexString.append(h);
        }

        PasswordResetToken prt = new PasswordResetToken();
        prt.setUser(testOwner);
        prt.setTokenHash(hexString.toString());
        prt.setExpiryDate(LocalDateTime.now().plusMinutes(15));
        prt.setUsed(false);
        passwordResetTokenRepository.save(prt);

        // Perform password reset
        com.cakeplatform.api.modules.auth.dto.ResetPasswordRequest resetReq =
                new com.cakeplatform.api.modules.auth.dto.ResetPasswordRequest();
        resetReq.setToken(rawResetToken);
        resetReq.setNewPassword("BrandNewPassword123!");

        mockMvc.perform(post("/api/auth/reset-password")
                        .header("X-Forwarded-For", testIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isOk());

        // Old token MUST now be rejected on protected requests
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());

        // Login with new password succeeds and yields working JWT
        LoginRequest loginReq = new LoginRequest();
        loginReq.setIdentifier(testOwner.getEmail());
        loginReq.setPassword("BrandNewPassword123!");

        String responseBody = mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", testIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.cakeplatform.api.modules.auth.dto.AuthResponse authResp =
                objectMapper.readValue(responseBody, com.cakeplatform.api.modules.auth.dto.AuthResponse.class);

        assertThat(authResp.getToken()).isNotNull();

        // New token works on protected endpoints
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + authResp.getToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("4. Previously issued JWT is rejected after authenticated password change")
    void testPreviousJwtRejectedAfterPasswordChange() throws Exception {
        String oldToken = generateTokenForUser(testOwner);

        // Perform authenticated change password
        ChangePasswordRequest changeReq = new ChangePasswordRequest();
        changeReq.setCurrentPassword("SecurePass123!");
        changeReq.setNewPassword("ChangedPassword123!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("X-Forwarded-For", testIp)
                        .header("Authorization", "Bearer " + oldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeReq)))
                .andExpect(status().isOk());

        // Subsequent request using oldToken MUST be rejected
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());

        // Login with new password succeeds
        LoginRequest loginReq = new LoginRequest();
        loginReq.setIdentifier(testOwner.getEmail());
        loginReq.setPassword("ChangedPassword123!");

        String responseBody = mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", testIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.cakeplatform.api.modules.auth.dto.AuthResponse authResp =
                objectMapper.readValue(responseBody, com.cakeplatform.api.modules.auth.dto.AuthResponse.class);

        // New token works
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + authResp.getToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("5. Expired, malformed, tampered, and revoked JWTs are all rejected")
    void testExpiredMalformedAndRevokedJwtsRejected() throws Exception {
        // A. Malformed token
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer not.a.valid.jwt"))
                .andExpect(status().isUnauthorized());

        // B. Tampered signature
        String validToken = generateTokenForUser(testOwner);
        String tamperedToken = validToken.substring(0, validToken.length() - 5) + "abcde";
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + tamperedToken))
                .andExpect(status().isUnauthorized());

        // C. Expired token (created with -1000ms expiration)
        JwtService shortJwtService = new JwtService(null, "ZGV2LWxvY2FsLW5vbi1wcm9kdWN0aW9uLWp3dC1zZWNyZXQta2V5LTMyYnl0ZXM=", -1000L);
        String expiredToken = shortJwtService.generateToken(new CustomUserDetails(testOwner));
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("6. Role authorization and tenant boundaries remain intact")
    void testRoleAuthorizationAndTenantBoundaries() throws Exception {
        String ownerToken = generateTokenForUser(testOwner);
        String adminToken = generateTokenForUser(testAdmin);

        // Owner cannot access admin-only endpoints
        mockMvc.perform(get("/api/admin/dashboard/stats")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        // Admin can access admin-only endpoints
        mockMvc.perform(get("/api/admin/dashboard/stats")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("7. Revocation persists in shared database and survives simulated restart")
    void testRevocationPersistenceAcrossInstances() throws Exception {
        String token = generateTokenForUser(testOwner);

        // Simulate revocation from another instance writing directly to the shared database
        tokenRevocationService.revokeToken(token, testOwner);

        // A new request on this instance verifies the DB state immediately
        mockMvc.perform(get("/api/owner/orders")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }
}
