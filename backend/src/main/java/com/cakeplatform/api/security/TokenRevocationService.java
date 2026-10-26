package com.cakeplatform.api.security;

import com.cakeplatform.api.modules.auth.entity.RevokedToken;
import com.cakeplatform.api.modules.auth.repository.RevokedTokenRepository;
import com.cakeplatform.api.modules.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenRevocationService {

    private final RevokedTokenRepository revokedTokenRepository;
    private final JwtService jwtService;

    /**
     * Securely hash raw JWT using SHA-256 to ensure raw tokens are never persisted or logged.
     */
    public String hashToken(String rawToken) {
        if (rawToken == null || rawToken.trim().isEmpty()) {
            throw new IllegalArgumentException("Token cannot be null or empty");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(rawToken.trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(64);
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Persist an explicit token logout to revoked_tokens table.
     */
    @Transactional
    public void revokeToken(String rawToken, User user) {
        if (rawToken == null || rawToken.trim().isEmpty()) {
            return;
        }

        try {
            String tokenHash = hashToken(rawToken);
            if (revokedTokenRepository.existsByTokenHash(tokenHash)) {
                return;
            }

            LocalDateTime expiry = null;
            try {
                Date expirationDate = jwtService.extractExpiration(rawToken);
                if (expirationDate != null) {
                    expiry = expirationDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
                }
            } catch (Exception ignored) {
                // Token might already be malformed or expired; fall back to 24h
            }

            if (expiry == null) {
                expiry = LocalDateTime.now().plusHours(24);
            }

            RevokedToken revokedToken = RevokedToken.builder()
                    .tokenHash(tokenHash)
                    .user(user)
                    .expiryDate(expiry)
                    .build();

            revokedTokenRepository.saveAndFlush(revokedToken);
            log.info("Successfully revoked token for user: {}", user != null ? user.getId() : "anonymous");
        } catch (Exception e) {
            log.error("Failed to revoke token: {}", e.getMessage());
        }
    }

    /**
     * Validate whether a token has been revoked, checking:
     * 1. Account-level token version (session version / security stamp)
     * 2. Account-level invalidation timestamp (password reset / password change)
     * 3. Individual token hash in database (explicit logout)
     */
    public boolean isTokenRevoked(String rawToken, Date issuedAt, User user) {
        if (rawToken == null || rawToken.trim().isEmpty()) {
            return true;
        }

        // 1. Check account-level security stamps if user context is available
        if (user != null) {
            // A. Token version check (authoritative security stamp)
            Integer userTokenVersion = user.getTokenVersion();
            Integer jwtTokenVersion = null;
            try {
                jwtTokenVersion = jwtService.extractClaim(rawToken, claims -> claims.get("token_version", Integer.class));
            } catch (Exception ignored) {
            }

            if (userTokenVersion != null) {
                if (jwtTokenVersion != null && jwtTokenVersion < userTokenVersion) {
                    return true;
                }
                if (jwtTokenVersion == null && userTokenVersion > 1) {
                    return true;
                }
            }

            // B. Invalidation timestamp check (applies to legacy tokens without token_version or unversioned tokens)
            if (jwtTokenVersion == null) {
                LocalDateTime invalidatedBefore = user.getTokensInvalidatedBefore();
                if (invalidatedBefore != null && issuedAt != null) {
                    Date invalidatedBeforeDate = Date.from(invalidatedBefore.atZone(ZoneId.systemDefault()).toInstant());
                    if (!issuedAt.after(invalidatedBeforeDate)) {
                        return true;
                    }
                }
            }
        }

        // 2. Check individual token revocation list (database-backed)
        try {
            String tokenHash = hashToken(rawToken);
            if (revokedTokenRepository.existsByTokenHash(tokenHash)) {
                return true;
            }
        } catch (Exception e) {
            log.warn("Error checking token hash revocation: {}", e.getMessage());
        }

        return false;
    }

    /**
     * Periodic cleanup of expired revoked tokens every hour.
     */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void cleanupExpiredTokens() {
        try {
            int deleted = revokedTokenRepository.deleteExpiredTokens(LocalDateTime.now());
            if (deleted > 0) {
                log.info("Cleaned up {} expired revoked tokens from database", deleted);
            }
        } catch (Exception e) {
            log.error("Error cleaning up expired revoked tokens: {}", e.getMessage());
        }
    }
}
