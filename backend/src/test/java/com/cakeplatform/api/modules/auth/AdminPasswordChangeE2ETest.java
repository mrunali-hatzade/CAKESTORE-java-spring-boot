package com.cakeplatform.api.modules.auth;

import com.cakeplatform.api.modules.auth.dto.ChangePasswordRequest;
import com.cakeplatform.api.modules.auth.dto.LoginRequest;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.RateLimitingFilter;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AdminPasswordChangeE2ETest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private RateLimitingFilter rateLimitingFilter;

    private static final String TEST_ADMIN_EMAIL = "disposable.admin.e2e@cakestore.local";
    private static final String INITIAL_PASSWORD = "InitSecurePass123!#";
    private static final String UPDATED_PASSWORD = "NewUpdatedPass456!#";

    private User testAdminUser;

    @BeforeEach
    void setUp() {
        resetRateLimits();
        cleanUpTestUser();

        testAdminUser = new User();
        testAdminUser.setEmail(TEST_ADMIN_EMAIL);
        testAdminUser.setFullName("E2E Test Administrator");
        testAdminUser.setRole(UserRole.ADMIN);
        testAdminUser.setStatus(UserStatus.ACTIVE);
        testAdminUser.setPasswordHash(passwordEncoder.encode(INITIAL_PASSWORD));
        testAdminUser.setTokenVersion(1);
        testAdminUser.setTokensInvalidatedBefore(LocalDateTime.now().minusDays(1));
        testAdminUser.setDeleted(false);

        testAdminUser = userRepository.save(testAdminUser);
    }

    @AfterEach
    void tearDown() {
        cleanUpTestUser();
        resetRateLimits();
    }

    private void resetRateLimits() {
        if (rateLimitingFilter != null) {
            try {
                Field authField = RateLimitingFilter.class.getDeclaredField("authBuckets");
                authField.setAccessible(true);
                Map<?, ?> authBuckets = (Map<?, ?>) authField.get(rateLimitingFilter);
                if (authBuckets != null) {
                    authBuckets.clear();
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void cleanUpTestUser() {
        try {
            jdbcTemplate.execute("DELETE FROM revoked_tokens WHERE user_id IN (SELECT id FROM users WHERE email = '" + TEST_ADMIN_EMAIL + "')");
            jdbcTemplate.execute("DELETE FROM users WHERE email = '" + TEST_ADMIN_EMAIL + "'");
        } catch (Exception ignored) {
        }
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setEmail(email);
        loginRequest.setUsername(email);
        loginRequest.setIdentifier(email);
        loginRequest.setPassword(password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode responseNode = objectMapper.readTree(result.getResponse().getContentAsString());
        return responseNode.get("token").asText();
    }

    @Test
    @DisplayName("E2E 1: Successful password change, old password rejection, and new password authentication")
    void testEndToEndPasswordChange_SuccessAndOldPasswordRejection() throws Exception {
        // Step 1: Login with initial credentials and obtain valid token
        String adminToken = loginAndGetToken(TEST_ADMIN_EMAIL, INITIAL_PASSWORD);
        assertThat(adminToken).isNotNull().isNotBlank();

        // Step 2: Verify access to protected admin API (/api/admin/settings)
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Step 3: Change password via POST /api/auth/change-password
        ChangePasswordRequest changeReq = new ChangePasswordRequest();
        changeReq.setCurrentPassword(INITIAL_PASSWORD);
        changeReq.setNewPassword(UPDATED_PASSWORD);

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password has been successfully changed."));

        // Step 4: Verify database entity state updated transactionally
        User refreshedUser = userRepository.findById(testAdminUser.getId()).orElseThrow();
        assertThat(passwordEncoder.matches(UPDATED_PASSWORD, refreshedUser.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches(INITIAL_PASSWORD, refreshedUser.getPasswordHash())).isFalse();
        assertThat(refreshedUser.getTokenVersion()).isEqualTo(2);

        // Step 5: Verify old password NO LONGER authenticates
        LoginRequest oldLoginReq = new LoginRequest();
        oldLoginReq.setEmail(TEST_ADMIN_EMAIL);
        oldLoginReq.setPassword(INITIAL_PASSWORD);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oldLoginReq)))
                .andExpect(status().is4xxClientError());

        // Step 6: Verify new password authenticates successfully and grants fresh access
        String newAdminToken = loginAndGetToken(TEST_ADMIN_EMAIL, UPDATED_PASSWORD);
        assertThat(newAdminToken).isNotNull().isNotBlank();

        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + newAdminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("E2E 2: Cross-Device / Multi-Session Revocation - Changing password in Session 1 immediately invalidates Session 2's token")
    void testCrossSessionMultiDeviceRevocation() throws Exception {
        // Step 1: Simulate Browser Session 1 login
        String session1Token = loginAndGetToken(TEST_ADMIN_EMAIL, INITIAL_PASSWORD);

        // Step 2: Simulate Browser Session 2 login (independent device/browser session)
        String session2Token = loginAndGetToken(TEST_ADMIN_EMAIL, INITIAL_PASSWORD);

        assertThat(session1Token).isNotBlank();
        assertThat(session2Token).isNotBlank();

        // Step 3: Both sessions independently access protected admin resources successfully
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + session1Token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + session2Token))
                .andExpect(status().isOk());

        // Step 4: Session 1 performs password change
        ChangePasswordRequest changeReq = new ChangePasswordRequest();
        changeReq.setCurrentPassword(INITIAL_PASSWORD);
        changeReq.setNewPassword(UPDATED_PASSWORD);

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + session1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password has been successfully changed."));

        // Step 5: CRITICAL SECURITY CHECK - Session 2 tries to use its OLD token
        // Server-side check in JwtAuthenticationFilter must reject with HTTP 401
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + session2Token))
                .andExpect(status().isUnauthorized());

        // Step 6: Session 1's old token is ALSO immediately rejected with HTTP 401
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + session1Token))
                .andExpect(status().isUnauthorized());

        // Step 7: Session 2 logs in again with new password and access is restored
        String session2NewToken = loginAndGetToken(TEST_ADMIN_EMAIL, UPDATED_PASSWORD);
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", "Bearer " + session2NewToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("E2E 3: Validation edge cases - wrong password, identical password, short password, missing fields")
    void testValidationEdgeCases() throws Exception {
        String adminToken = loginAndGetToken(TEST_ADMIN_EMAIL, INITIAL_PASSWORD);

        // A. Wrong current password -> 400 Bad Request
        ChangePasswordRequest wrongCurrentReq = new ChangePasswordRequest();
        wrongCurrentReq.setCurrentPassword("IncorrectOldPassword!#");
        wrongCurrentReq.setNewPassword(UPDATED_PASSWORD);

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongCurrentReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Current password is incorrect"));

        // B. New password identical to current password -> 400 Bad Request
        ChangePasswordRequest identicalReq = new ChangePasswordRequest();
        identicalReq.setCurrentPassword(INITIAL_PASSWORD);
        identicalReq.setNewPassword(INITIAL_PASSWORD);

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(identicalReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("New password must be different from current password"));

        // C. New password shorter than 8 characters -> 400 Bad Request
        ChangePasswordRequest shortReq = new ChangePasswordRequest();
        shortReq.setCurrentPassword(INITIAL_PASSWORD);
        shortReq.setNewPassword("short");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shortReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("New password must be at least 8 characters long"));

        // D. Missing fields -> 400 Bad Request
        ChangePasswordRequest blankReq = new ChangePasswordRequest();

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("E2E 4: Authorization safeguards - unauthenticated rejection and non-admin role segregation")
    void testAuthorizationSafeguards() throws Exception {
        // A. Unauthenticated request to change-password -> 401 or 403
        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword(INITIAL_PASSWORD);
        req.setNewPassword(UPDATED_PASSWORD);

        mockMvc.perform(post("/api/auth/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().is4xxClientError());

        // B. Non-admin user (SHOP_OWNER) cannot access protected /api/admin/settings
        String ownerEmail = "disposable.owner." + System.currentTimeMillis() + "@cakestore.local";
        User shopOwner = new User();
        shopOwner.setEmail(ownerEmail);
        shopOwner.setFullName("Test Owner");
        shopOwner.setRole(UserRole.SHOP_OWNER);
        shopOwner.setStatus(UserStatus.ACTIVE);
        shopOwner.setPasswordHash(passwordEncoder.encode(INITIAL_PASSWORD));
        shopOwner.setTokenVersion(1);
        shopOwner.setTokensInvalidatedBefore(LocalDateTime.now().minusDays(1));
        shopOwner.setDeleted(false);
        userRepository.save(shopOwner);

        try {
            String ownerToken = loginAndGetToken(ownerEmail, INITIAL_PASSWORD);

            // Owner attempting to access /api/admin/settings is rejected with 403 Forbidden
            mockMvc.perform(get("/api/admin/settings")
                            .header("Authorization", "Bearer " + ownerToken))
                    .andExpect(status().isForbidden());
        } finally {
            try {
                jdbcTemplate.execute("DELETE FROM revoked_tokens WHERE user_id = " + shopOwner.getId());
                userRepository.delete(shopOwner);
            } catch (Exception ignored) {
            }
        }
    }
}
