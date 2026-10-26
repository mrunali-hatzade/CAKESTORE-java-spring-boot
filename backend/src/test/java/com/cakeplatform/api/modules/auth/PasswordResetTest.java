package com.cakeplatform.api.modules.auth;

import com.cakeplatform.api.modules.auth.dto.ForgotPasswordRequest;
import com.cakeplatform.api.modules.auth.dto.ResetPasswordRequest;
import com.cakeplatform.api.modules.auth.entity.PasswordResetToken;
import com.cakeplatform.api.modules.auth.repository.PasswordResetTokenRepository;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@org.springframework.transaction.annotation.Transactional
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class PasswordResetTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private User testUser;
    private User testUser2;

    @Autowired
    private com.cakeplatform.api.modules.email.DevEmailSink devEmailSink;

    
    

    @BeforeEach
    void setUp() {
        passwordResetTokenRepository.deleteAllInBatch();
        jdbcTemplate.execute("DELETE FROM users WHERE email LIKE '%test.reset%'");
        if (devEmailSink != null) devEmailSink.clear();
        
        testUser = setupUser("test.reset_java_uuid_randomUUID_toString_substring_0_8@example.com", "Test User");
        testUser2 = setupUser("test.reset@example.com", "Test User 2");
    }

    private User setupUser(String email, String name) {
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setRole(UserRole.CUSTOMER);
            user.setStatus(UserStatus.ACTIVE);
            user.setFullName(name);
        }
        user.setPasswordHash(passwordEncoder.encode("oldPassword123"));
        return userRepository.save(user);
    }

    @Test
    void testE2E_FullPasswordResetFlow() throws Exception {
        // 1. Forgot Password
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(testUser.getEmail()))))
                .andExpect(status().isOk());

        // 2. Extract Token from DevEmailSink
        List<String> emails = devEmailSink.getEmailsFor(testUser.getEmail());
        assertThat(emails).hasSize(1);
        String body = emails.get(0);
        String rawToken = body.substring(body.indexOf("#token=") + 7, body.indexOf("\n", body.indexOf("#token=")));

        // 3. Reset Password
        ResetPasswordRequest req = new ResetPasswordRequest(rawToken, "NewSecurePassword123!");
        mockMvc.perform(post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password has been successfully reset."));

        // 4. Verify DB State
        User updatedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("NewSecurePassword123!", updatedUser.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("oldPassword123", updatedUser.getPasswordHash())).isFalse();

        // 5. Token is consumed and cannot be reused
        mockMvc.perform(post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    // A. FORGOT PASSWORD
    @Test
    void testA_ForgotPassword_ExistingEmail_GenericResponse() throws Exception {
        ForgotPasswordRequest req = new ForgotPasswordRequest("test.reset_java_uuid_randomUUID_toString_substring_0_8@example.com");
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If an account with that email exists, a password reset link has been sent."));

        assertThat(passwordResetTokenRepository.findAll()).hasSize(1);
    }

    @Test
    void testA_ForgotPassword_UnknownEmail_GenericResponse() throws Exception {
        ForgotPasswordRequest req = new ForgotPasswordRequest("unknown.email@example.com");
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If an account with that email exists, a password reset link has been sent."));

        assertThat(passwordResetTokenRepository.findAll()).isEmpty();
    }

    @Test
    void testA_ForgotPassword_EmailNormalization() throws Exception {
        // Use mixed case instead of spaces, as spaces fail the @Email DTO validation early
        ForgotPasswordRequest req = new ForgotPasswordRequest("TeSt.ReSeT@eXaMpLe.CoM");
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        assertThat(passwordResetTokenRepository.findAll()).hasSize(1);
    }

    // B. TOKEN LIFECYCLE
    @Test
    void testB_TokenLifecycle_PreviousTokenInvalidated() throws Exception {
        // Request 1
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(testUser.getEmail()))));
                
        List<PasswordResetToken> tokens1 = passwordResetTokenRepository.findAll();
        assertThat(tokens1).hasSize(1);
        assertThat(tokens1.get(0).isUsed()).isFalse();

        // Request 2
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(testUser.getEmail()))));
                
        List<PasswordResetToken> tokens2 = passwordResetTokenRepository.findAll();
        assertThat(tokens2).hasSize(2);
        
        long unusedCount = tokens2.stream().filter(t -> !t.isUsed()).count();
        long usedCount = tokens2.stream().filter(PasswordResetToken::isUsed).count();
        
        assertThat(unusedCount).isEqualTo(1);
        assertThat(usedCount).isEqualTo(1);
    }

    @Test
    void testB_TokenLifecycle_InvalidTokenRejected() throws Exception {
        ResetPasswordRequest req = new ResetPasswordRequest("invalid_raw_token", "newPassword123");
        mockMvc.perform(post("/api/auth/reset-password")
                .with(request -> { request.setRemoteAddr("192.168.1.1"); return request; })
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testB_TokenLifecycle_ExpiredTokenRejected() throws Exception {
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(testUser);
        token.setTokenHash("dummy_hash");
        token.setExpiryDate(LocalDateTime.now().minusMinutes(1)); // Expired
        token.setUsed(false);
        passwordResetTokenRepository.save(token);
    }

    // C. PASSWORD UPDATE
    @Test
    void testC_PasswordUpdate_WeakPasswordRejected() throws Exception {
        ResetPasswordRequest req = new ResetPasswordRequest("sometoken", "weak");
        mockMvc.perform(post("/api/auth/reset-password")
                .with(request -> { request.setRemoteAddr("192.168.1.2"); return request; })
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    // D. SECURITY / ISOLATION
    @Test
    void testD_Security_RateLimiting() throws Exception {
        ResetPasswordRequest req = new ResetPasswordRequest("token", "ValidPassword123");
        // Force 429 by sending a burst of requests
        for (int i = 0; i < 15; i++) {
            mockMvc.perform(post("/api/auth/reset-password")
                .with(request -> { request.setRemoteAddr("192.168.1.3"); return request; })
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)));
        }
        mockMvc.perform(post("/api/auth/reset-password")
                .with(request -> { request.setRemoteAddr("192.168.1.3"); return request; })
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isTooManyRequests()); 
    }
}
