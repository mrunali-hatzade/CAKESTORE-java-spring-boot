package com.cakeplatform.api.modules.auth;

import com.cakeplatform.api.modules.auth.service.AuthService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.JwtService;
import com.cakeplatform.api.security.TokenRevocationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ChangePasswordSecurityTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TokenRevocationService tokenRevocationService;

    @Mock
    private JwtService jwtService;

    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    private User adminUser;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        authService = new AuthService(
                userRepository,
                null,
                null,
                passwordEncoder,
                jwtService,
                null,
                null,
                null,
                null,
                null
        );
        ReflectionTestUtils.setField(authService, "tokenRevocationService", tokenRevocationService);

        adminUser = new User();
        adminUser.setId(1L);
        adminUser.setEmail("admin@cakestore.com");
        adminUser.setFullName("Platform Administrator");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setPasswordHash(passwordEncoder.encode("CurrentAdminPass123!"));
        adminUser.setTokenVersion(1);
        adminUser.setTokensInvalidatedBefore(LocalDateTime.now().minusDays(1));
    }

    @Nested
    @DisplayName("1. Password Change Validation & Security Rules")
    class PasswordChangeValidationTests {

        @Test
        @DisplayName("Successfully changes password: hashes with BCrypt, increments tokenVersion, and updates invalidation timestamp")
        void testChangePassword_Success() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            LocalDateTime beforeChange = LocalDateTime.now().minusSeconds(1);

            authService.changePassword(1L, "CurrentAdminPass123!", "NewAdminSecurePass456#");

            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User updated = userCaptor.getValue();

            // 1. Password must be hashed and verified with BCrypt
            assertTrue(passwordEncoder.matches("NewAdminSecurePass456#", updated.getPasswordHash()));
            assertFalse(passwordEncoder.matches("CurrentAdminPass123!", updated.getPasswordHash()));

            // 2. Token version must be incremented from 1 to 2
            assertEquals(2, updated.getTokenVersion());

            // 3. Invalidation timestamp must be updated to now
            assertNotNull(updated.getTokensInvalidatedBefore());
            assertTrue(updated.getTokensInvalidatedBefore().isAfter(beforeChange));
        }

        @Test
        @DisplayName("Rejects password change when current password does not match")
        void testChangePassword_IncorrectCurrentPassword() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    authService.changePassword(1L, "WrongCurrentPassword!", "NewAdminSecurePass456#"));

            assertEquals("Current password is incorrect", ex.getMessage());
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Rejects new password shorter than 8 characters")
        void testChangePassword_ShortNewPassword() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    authService.changePassword(1L, "CurrentAdminPass123!", "short"));

            assertEquals("New password must be at least 8 characters long", ex.getMessage());
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Rejects new password when it is identical to the current password")
        void testChangePassword_NewPasswordSameAsCurrent() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    authService.changePassword(1L, "CurrentAdminPass123!", "CurrentAdminPass123!"));

            assertEquals("New password must be different from current password", ex.getMessage());
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Rejects password change for nonexistent user")
        void testChangePassword_UserNotFound() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    authService.changePassword(999L, "CurrentAdminPass123!", "NewAdminSecurePass456#"));

            assertEquals("User not found", ex.getMessage());
            verify(userRepository, never()).save(any(User.class));
        }
    }

    @Nested
    @DisplayName("2. Session Invalidation Mechanics")
    class SessionInvalidationTests {

        @Test
        @DisplayName("Token with older token_version is rejected after password change increments tokenVersion")
        void testPreviousTokenInvalidated_ByTokenVersionIncrement() {
            // Emulate real token revocation logic from TokenRevocationService
            TokenRevocationService realRevocationService = new TokenRevocationService(null, jwtService);

            // User has tokenVersion = 2 after password change
            User userAfterPasswordChange = new User();
            userAfterPasswordChange.setId(1L);
            userAfterPasswordChange.setTokenVersion(2);
            userAfterPasswordChange.setTokensInvalidatedBefore(LocalDateTime.now());

            String oldJwt = "mock.jwt.with.version1";
            Date issuedAt = new Date(System.currentTimeMillis() - 60000);

            // JWT had token_version = 1
            when(jwtService.extractClaim(eq(oldJwt), any())).thenReturn(1);

            boolean isRevoked = realRevocationService.isTokenRevoked(oldJwt, issuedAt, userAfterPasswordChange);

            assertTrue(isRevoked, "Token with older tokenVersion (1 < 2) must be considered revoked");
        }
    }
}
