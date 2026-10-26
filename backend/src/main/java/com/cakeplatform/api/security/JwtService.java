package com.cakeplatform.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
@Slf4j
public class JwtService {

    // Known insecure default secret that must never be used in production
    private static final String DEPRECATED_INSECURE_DEFAULT_SECRET = "45f4f9e809b96ece4dc9605067190fe487d40b41e2f701098420bdfa4739f82b";
    
    // Designated local development key used only when no environment variable is provided in non-production
    private static final String DEV_LOCAL_FALLBACK_SECRET = "ZGV2LWxvY2FsLW5vbi1wcm9kdWN0aW9uLWp3dC1zZWNyZXQta2V5LTMyYnl0ZXM=";
    
    private static final int MIN_KEY_BYTES = 32; // 256 bits for HMAC-SHA256

    @Autowired(required = false)
    private Environment environment;

    @Value("${jwt.secret:}")
    private String secretKey;

    @Value("${jwt.expiration:86400000}")
    private long jwtExpiration;

    private SecretKey cachedSignInKey;

    public JwtService() {}

    public JwtService(Environment environment, String secretKey, long jwtExpiration) {
        this.environment = environment;
        this.secretKey = secretKey;
        this.jwtExpiration = jwtExpiration != 0 ? jwtExpiration : 86400000L;
        initAndValidateSecret();
    }

    @PostConstruct
    public void initAndValidateSecret() {
        boolean isProd = isProductionEnvironment();
        this.secretKey = validateAndResolveSecret(this.secretKey, isProd);
        this.cachedSignInKey = buildKey(this.secretKey);
    }

    public String validateAndResolveSecret(String configuredSecret, boolean isProd) {
        if (isProd) {
            if (!StringUtils.hasText(configuredSecret)) {
                throw new IllegalStateException("CRITICAL: JWT secret must be explicitly configured in production environment (missing or blank).");
            }
            if (isKnownInsecureDefault(configuredSecret)) {
                throw new IllegalStateException("CRITICAL: JWT secret is using an insecure, known default/fallback value. A unique production secret must be configured.");
            }
            byte[] keyBytes = decodeKeyBytes(configuredSecret);
            if (keyBytes.length < MIN_KEY_BYTES) {
                throw new IllegalStateException("CRITICAL: Configured JWT secret is insufficiently strong. HMAC-SHA256 requires at least 256 bits (32 bytes).");
            }
            return configuredSecret.trim();
        } else {
            if (!StringUtils.hasText(configuredSecret)) {
                log.warn("JWT secret is not configured. Initialized with a non-production development key. This fallback is strictly prohibited in production.");
                return DEV_LOCAL_FALLBACK_SECRET;
            }
            if (isKnownInsecureDefault(configuredSecret)) {
                log.warn("JWT secret is using the deprecated default value in a non-production profile. Please configure a unique secret.");
                return configuredSecret.trim();
            }
            byte[] keyBytes = decodeKeyBytes(configuredSecret);
            if (keyBytes.length < MIN_KEY_BYTES) {
                log.warn("Configured non-production JWT secret is shorter than 256 bits. Using local development fallback.");
                return DEV_LOCAL_FALLBACK_SECRET;
            }
            return configuredSecret.trim();
        }
    }

    public boolean isProductionEnvironment() {
        if (environment == null) {
            return false;
        }
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles != null) {
            for (String profile : activeProfiles) {
                if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                    return true;
                }
            }
        }
        return false;
    }

    public boolean isKnownInsecureDefault(String secret) {
        if (secret == null) {
            return false;
        }
        String trimmed = secret.trim();
        return DEPRECATED_INSECURE_DEFAULT_SECRET.equalsIgnoreCase(trimmed)
                || DEV_LOCAL_FALLBACK_SECRET.equals(trimmed);
    }

    private byte[] decodeKeyBytes(String secret) {
        if (secret == null) {
            return new byte[0];
        }
        String trimmed = secret.trim();
        try {
            byte[] decoded = Decoders.BASE64.decode(trimmed);
            if (decoded != null && decoded.length > 0) {
                return decoded;
            }
        } catch (Exception ignored) {
            // Secret is not standard Base64; use UTF-8 representation
        }
        return trimmed.getBytes(StandardCharsets.UTF_8);
    }

    private SecretKey buildKey(String secret) {
        byte[] keyBytes = decodeKeyBytes(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        if (extraClaims == null) {
            extraClaims = new HashMap<>();
        }
        if (userDetails instanceof CustomUserDetails customUserDetails) {
            com.cakeplatform.api.modules.user.User user = customUserDetails.getUser();
            if (user != null && user.getTokenVersion() != null) {
                extraClaims.putIfAbsent("token_version", user.getTokenVersion());
            }
        }
        return buildToken(extraClaims, userDetails, jwtExpiration);
    }

    private String buildToken(Map<String, Object> extraClaims, UserDetails userDetails, long expiration) {
        return Jwts
                .builder()
                .claims(extraClaims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), Jwts.SIG.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        try {
            final String username = extractUsername(token);
            if (userDetails instanceof CustomUserDetails customUserDetails) {
                com.cakeplatform.api.modules.user.User user = customUserDetails.getUser();
                boolean matchesIdentifier = (user != null) && (
                        (user.getEmail() != null && username.equalsIgnoreCase(user.getEmail()))
                        || (user.getMobile() != null && username.equals(user.getMobile()))
                        || username.equals(userDetails.getUsername())
                );
                return matchesIdentifier && !isTokenExpired(token);
            }
            return (username.equals(userDetails.getUsername())) && !isTokenExpired(token);
        } catch (io.jsonwebtoken.ExpiredJwtException eje) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isTokenExpired(String token) {
        try {
            return extractExpiration(token).before(new Date());
        } catch (io.jsonwebtoken.ExpiredJwtException eje) {
            return true;
        }
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public Date extractIssuedAt(String token) {
        return extractClaim(token, Claims::getIssuedAt);
    }

    private Claims extractAllClaims(String token) {
        return Jwts
                .parser()
                .verifyWith(getSignInKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSignInKey() {
        if (this.cachedSignInKey != null) {
            return this.cachedSignInKey;
        }
        return buildKey(this.secretKey != null ? this.secretKey : DEV_LOCAL_FALLBACK_SECRET);
    }
}

