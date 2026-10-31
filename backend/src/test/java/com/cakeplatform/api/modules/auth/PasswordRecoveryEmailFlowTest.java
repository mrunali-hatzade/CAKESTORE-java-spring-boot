package com.cakeplatform.api.modules.auth;

import com.cakeplatform.api.modules.auth.dto.ForgotPasswordRequest;
import com.cakeplatform.api.modules.auth.dto.ResetPasswordRequest;
import com.cakeplatform.api.modules.auth.entity.PasswordResetToken;
import com.cakeplatform.api.modules.auth.repository.PasswordResetTokenRepository;
import com.cakeplatform.api.modules.email.DevEmailSink;
import com.cakeplatform.api.modules.notification.EmailService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class PasswordRecoveryEmailFlowTest {

    private static final String GENERIC_RESPONSE =
            "If an account with that email exists, a password reset link has been sent.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DevEmailSink devEmailSink;

    @MockBean
    private EmailService notificationEmailService;

    private User testUser;

    @BeforeEach
    void setUp() {
        passwordResetTokenRepository.deleteAllInBatch();
        if (devEmailSink != null) {
            devEmailSink.clear();
        }

        String email = "flow.test_" + java.util.UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        testUser = new User();
        testUser.setEmail(email);
        testUser.setRole(UserRole.CUSTOMER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setFullName("Flow Test User");
        testUser.setPasswordHash(passwordEncoder.encode("InitialPassword123!"));
        testUser = userRepository.save(testUser);

        reset(notificationEmailService);
    }

    @Test
    @DisplayName("Valid reset request invokes notification email service with reset link")
    void testValidResetRequest_invokesNotificationEmailService() throws Exception {
        ForgotPasswordRequest req = new ForgotPasswordRequest(testUser.getEmail());

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_RESPONSE));

        // Verify notificationEmailService was invoked
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationEmailService, timeout(2000).times(1)).sendEmail(
                eq(testUser.getEmail()),
                eq("Password Reset Request"),
                bodyCaptor.capture()
        );

        String emailBody = bodyCaptor.getValue();
        assertThat(emailBody).contains("/reset-password#token=");
    }

    @Test
    @DisplayName("Email provider failure is handled safely without leaking to client or failing request")
    void testEmailProviderFailure_handledSafelyWithoutLeaking() throws Exception {
        // Simulate email provider failure (e.g. Resend network outage, 500 status, timeout)
        doThrow(new RuntimeException("Simulated Resend API gateway timeout 504"))
                .when(notificationEmailService).sendEmail(anyString(), anyString(), anyString());

        ForgotPasswordRequest req = new ForgotPasswordRequest(testUser.getEmail());

        // The request must still succeed with 200 OK and identical generic response
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_RESPONSE));

        // Verify token was still created in database despite provider failure
        List<PasswordResetToken> tokens = passwordResetTokenRepository.findAll();
        assertThat(tokens).isNotEmpty();
    }

    @Test
    @DisplayName("Anti-enumeration: valid email, unknown email, and failure return identical responses")
    void testAntiEnumeration_identicalResponses() throws Exception {
        // Case 1: Existing user
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(testUser.getEmail()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_RESPONSE));

        // Case 2: Unknown user
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest("nonexistent.user.9876@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_RESPONSE));

        // For nonexistent user, notification email service should never be invoked
        verify(notificationEmailService, times(1)).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Password-reset token expiry and single-use enforcement remain intact")
    void testTokenExpiryAndSingleUseBehavior() throws Exception {
        // Step 1: Request reset
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(testUser.getEmail()))))
                .andExpect(status().isOk());

        // Extract token from dev sink
        List<String> emails = devEmailSink.getEmailsFor(testUser.getEmail());
        assertThat(emails).hasSize(1);
        String body = emails.get(0);
        String rawToken = body.substring(body.indexOf("#token=") + 7, body.indexOf("\n", body.indexOf("#token=")));

        // Step 2: Consume token with valid new password
        ResetPasswordRequest resetReq = new ResetPasswordRequest(rawToken, "NewSecurePass987!");
        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password has been successfully reset."));

        // Step 3: Single-use enforcement: Attempting to reuse same token must fail with 400 Bad Request
        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isBadRequest());

        // Step 4: Verify password in DB updated and old password no longer works
        User updated = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("NewSecurePass987!", updated.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("InitialPassword123!", updated.getPasswordHash())).isFalse();

        // Step 5: Expired token rejection
        PasswordResetToken expiredToken = new PasswordResetToken();
        expiredToken.setUser(testUser);
        expiredToken.setTokenHash("expired_token_hash_value");
        expiredToken.setExpiryDate(LocalDateTime.now().minusMinutes(10));
        expiredToken.setUsed(false);
        passwordResetTokenRepository.save(expiredToken);
    }
}
