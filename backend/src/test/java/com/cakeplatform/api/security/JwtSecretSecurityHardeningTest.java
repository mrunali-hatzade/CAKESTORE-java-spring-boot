package com.cakeplatform.api.security;

import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class JwtSecretSecurityHardeningTest {

    // Valid Base64-encoded 256-bit (32 bytes) test key
    private static final String VALID_TEST_SECRET = "dGVzdC1vbmx5LWp3dC1zZWNyZXQta2V5LWZvci10ZXN0aW5nLXB1cnBvc2VzLW9ubHktMjU2Yml0cw==";
    
    // Another distinct valid 256-bit test key for signature tampering verification
    private static final String ANOTHER_VALID_TEST_SECRET = "YW5vdGhlci12YWxpZC0yNTYtYml0LXNlY3JldC1mb3ItdGVzdGluZy1wdXJwb3Nlcy0xMjM0NQ==";

    // Deprecated insecure default hex key from original application.yml
    private static final String KNOWN_DEPRECATED_DEFAULT_SECRET = "45f4f9e809b96ece4dc9605067190fe487d40b41e2f701098420bdfa4739f82b";

    private UserDetails createTestUser(String username) {
        return new User(username, "password", Collections.emptyList());
    }

    @Test
    @DisplayName("1. Production fails startup when JWT secret is missing (null)")
    void testProductionFailsWhenSecretIsMissing() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        JwtService jwtService = new JwtService();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            jwtService.validateAndResolveSecret(null, true);
        });

        assertTrue(ex.getMessage().contains("missing or blank"));
    }

    @Test
    @DisplayName("2. Production fails startup when JWT secret is blank")
    void testProductionFailsWhenSecretIsBlank() {
        JwtService jwtService = new JwtService();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            jwtService.validateAndResolveSecret("   ", true);
        });

        assertTrue(ex.getMessage().contains("missing or blank"));
    }

    @Test
    @DisplayName("3. Production rejects known deprecated default secret")
    void testProductionFailsWhenSecretIsKnownDefault() {
        JwtService jwtService = new JwtService();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            jwtService.validateAndResolveSecret(KNOWN_DEPRECATED_DEFAULT_SECRET, true);
        });

        assertTrue(ex.getMessage().contains("insecure, known default/fallback value"));
        // Ensure the actual secret is not leaked into the exception message
        assertFalse(ex.getMessage().contains(KNOWN_DEPRECATED_DEFAULT_SECRET));
    }

    @Test
    @DisplayName("4. Production rejects weak secrets (< 256 bits / 32 bytes)")
    void testProductionFailsWhenSecretIsWeak() {
        JwtService jwtService = new JwtService();

        // Weak Base64 string that decodes to only 4 bytes (32 bits, far below 256 bits)
        String weakBase64 = "dGVzdA=="; // "test"

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            jwtService.validateAndResolveSecret(weakBase64, true);
        });

        assertTrue(ex.getMessage().contains("insufficiently strong"));
        assertFalse(ex.getMessage().contains(weakBase64));

        // Short raw string (< 32 characters)
        IllegalStateException ex2 = assertThrows(IllegalStateException.class, () -> {
            jwtService.validateAndResolveSecret("short-secret-under-32-bytes", true);
        });

        assertTrue(ex2.getMessage().contains("insufficiently strong"));
    }

    @Test
    @DisplayName("5. Valid configured secret allows startup and JWT signing/verification")
    void testValidConfiguredSecretAllowsSigningAndVerification() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        JwtService jwtService = new JwtService(prodEnv, VALID_TEST_SECRET, 86400000L);

        UserDetails userDetails = createTestUser("baker@example.com");
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", "ROLE_SHOP_OWNER");

        String token = jwtService.generateToken(extraClaims, userDetails);
        assertNotNull(token);
        assertFalse(token.isBlank());

        assertEquals("baker@example.com", jwtService.extractUsername(token));
        assertTrue(jwtService.isTokenValid(token, userDetails));

        String role = jwtService.extractClaim(token, claims -> claims.get("role", String.class));
        assertEquals("ROLE_SHOP_OWNER", role);
    }

    @Test
    @DisplayName("6. Invalid signature from different secret is rejected")
    void testInvalidSignatureIsRejected() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        JwtService signer = new JwtService(env, VALID_TEST_SECRET, 86400000L);
        JwtService verifierWithDifferentKey = new JwtService(env, ANOTHER_VALID_TEST_SECRET, 86400000L);

        UserDetails userDetails = createTestUser("admin@cakestore.com");
        String token = signer.generateToken(userDetails);

        // Verifying with a different key must throw SignatureException
        assertThrows(SignatureException.class, () -> {
            verifierWithDifferentKey.extractUsername(token);
        });
    }

    @Test
    @DisplayName("7. Expired tokens are rejected")
    void testExpiredTokenIsRejected() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("test");

        // Set negative expiration (-10 seconds)
        JwtService jwtService = new JwtService(env, VALID_TEST_SECRET, -10000L);

        UserDetails userDetails = createTestUser("expired@example.com");
        String token = jwtService.generateToken(userDetails);

        // isTokenValid should return false for expired token (or throw ExpiredJwtException on extraction)
        assertFalse(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("8. Non-production environment uses safe dev fallback when missing")
    void testNonProductionEnvironmentUsesSafeDevFallbackWhenMissing() {
        MockEnvironment devEnv = new MockEnvironment();
        devEnv.setActiveProfiles("dev");

        JwtService jwtService = new JwtService(devEnv, null, 86400000L);

        UserDetails userDetails = createTestUser("localdev@example.com");
        String token = jwtService.generateToken(userDetails);

        assertNotNull(token);
        assertEquals("localdev@example.com", jwtService.extractUsername(token));
        assertTrue(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("9. Error messages never leak any part of the secret value")
    void testErrorMessagesNeverLeakSecretValue() {
        JwtService jwtService = new JwtService();
        String sensitiveDummySecret = "some-extremely-confidential-string-1234";

        try {
            jwtService.validateAndResolveSecret(sensitiveDummySecret, true);
        } catch (Exception ex) {
            assertFalse(ex.getMessage().contains(sensitiveDummySecret));
            assertFalse(ex.getMessage().contains("confidential"));
        }
    }
}
