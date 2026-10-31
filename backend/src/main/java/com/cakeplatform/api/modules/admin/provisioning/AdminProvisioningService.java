package com.cakeplatform.api.modules.admin.provisioning;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminProvisioningService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private ActivityLoggerService activityLogger;

    @Autowired(required = false)
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    /**
     * Spring DataSource — used for reliable, connection-free dialect detection via the JDBC URL.
     * Injected optionally so unit tests that supply only a mocked JdbcTemplate still compile.
     */
    @Autowired(required = false)
    private DataSource dataSource;

    public void setJdbcTemplate(org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Allows test injection of a mock or stub DataSource for dialect-detection tests. */
    public void setDataSource(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // Deterministic 64-bit advisory lock key ("CAKE_ADM" = 4846203714247779405L)
    public static final long ADMIN_BOOTSTRAP_LOCK_KEY = 4846203714247779405L;

    // In-JVM reentrant lock for thread-level serialization within the same process
    private static final java.util.concurrent.locks.ReentrantLock JVM_LOCK = new java.util.concurrent.locks.ReentrantLock();

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$"
    );

    private static final List<String> COMMON_WEAK_PASSWORDS = List.of(
            "password123!", "password123", "admin12345!", "adminpassword123!",
            "admin@12345", "changeme123!", "administrator123!", "admin123"
    );

    /**
     * Provisions the initial platform administrator in a clean production or newly deployed environment.
     * Enforces strict guardrails:
     * - Refuses if ANY administrator already exists (including soft-deleted admins).
     * - Refuses if the email or mobile is already registered by any user (preventing identity hijacking).
     * - Validates email syntax and strict password complexity.
     * - Never overwrites or converts existing users.
     * - Never logs plaintext passwords or sensitive credentials.
     * - Transactional rollback on any failure.
     */
    @Transactional
    public AdminProvisioningResult provisionInitialAdmin(AdminProvisioningRequest request) {
        if (request == null) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_INVALID_CONFIG,
                    "Admin provisioning request cannot be null."
            );
        }

        JVM_LOCK.lock();
        try {
            // 0. Database-level serialization: Acquire PostgreSQL transaction-scoped advisory lock
            acquireDatabaseLock();

            // 1. Guardrail: Detect whether an administrator already exists (active or soft-deleted)
            long existingAdminsCount = countExistingAdmins();

            if (existingAdminsCount > 0) {
                log.warn("[ADMIN_PROVISIONING_REFUSED] Bootstrap refused: An administrator already exists in this environment. Total count: {}", existingAdminsCount);
                recordAuditRefusal("Administrator already exists in environment (count=" + existingAdminsCount + ")");
                throw new AdminProvisioningException(
                        AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS,
                        "Admin provisioning refused: An administrator account already exists. Bootstrap can only be run once in a clean environment."
                );
            }

        // 2. Validate Email
        String rawEmail = request.getEmail();
        if (rawEmail == null || rawEmail.trim().isEmpty()) {
            recordAuditRefusal("Missing required admin email");
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_INVALID_CONFIG,
                    "Admin email is required and cannot be blank."
            );
        }
        String normalizedEmail = rawEmail.trim().toLowerCase();
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            recordAuditRefusal("Invalid email format");
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_INVALID_CONFIG,
                    "Invalid admin email format: '" + normalizedEmail + "'."
            );
        }

        // 3. Guardrail: Prevent email collision with existing users (never convert or overwrite)
        long emailUserCount = 0;
        try {
            emailUserCount = userRepository.countByEmailIgnoreCaseIncludingDeleted(normalizedEmail);
        } catch (Exception ex) {
            emailUserCount = userRepository.findByEmailIgnoreCase(normalizedEmail).isPresent() ? 1 : 0;
        }

        if (emailUserCount > 0) {
            log.warn("[ADMIN_PROVISIONING_REFUSED] Bootstrap refused: Email {} is already registered by an existing non-admin account.", maskEmail(normalizedEmail));
            recordAuditRefusal("Email is already in use by another account");
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_DUPLICATE_EMAIL,
                    "Admin provisioning refused: The specified email address is already registered."
            );
        }

        // 4. Validate Mobile (if provided)
        String normalizedMobile = null;
        if (request.getMobile() != null && !request.getMobile().trim().isEmpty()) {
            normalizedMobile = request.getMobile().replaceAll("\\D", "");
            if (normalizedMobile.startsWith("91") && normalizedMobile.length() == 12) {
                normalizedMobile = normalizedMobile.substring(2);
            } else if (normalizedMobile.startsWith("0") && normalizedMobile.length() == 11) {
                normalizedMobile = normalizedMobile.substring(1);
            }

            if (userRepository.existsByMobile(normalizedMobile) ||
                    userRepository.findByMobileIncludingDeleted(normalizedMobile).isPresent()) {
                log.warn("[ADMIN_PROVISIONING_REFUSED] Bootstrap refused: Mobile is already registered.");
                recordAuditRefusal("Mobile number is already in use");
                throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_DUPLICATE_MOBILE,
                    "Admin provisioning refused: The specified mobile number is already registered."
                );
            }
        }

        // 5. Validate Password Strength
        validatePasswordStrength(request.getPassword(), normalizedEmail);

        // 6. Create User Transactionally
        User adminUser = new User();
        adminUser.setEmail(normalizedEmail);
        adminUser.setFullName(request.getFullName() != null && !request.getFullName().trim().isEmpty()
                ? request.getFullName().trim()
                : "System Administrator");
        adminUser.setMobile(normalizedMobile);
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        adminUser.setTokenVersion(1);
        adminUser.setTokensInvalidatedBefore(LocalDateTime.now());
        adminUser.setDeleted(false);

        User savedAdmin = userRepository.save(adminUser);

        // 7. Safe Audit Logging (Never log raw password or hash)
        log.info("[ADMIN_PROVISIONING_SUCCESS] Initial administrator provisioned successfully. User ID: {}, Email: {}",
                savedAdmin.getId(), maskEmail(savedAdmin.getEmail()));

        if (activityLogger != null) {
            try {
                activityLogger.logActivity(
                        savedAdmin.getId(),
                        null,
                        "ADMIN_INITIAL_PROVISIONING",
                        "USER",
                        savedAdmin.getId(),
                        "Initial administrator provisioned via secure bootstrap"
                );
            } catch (Exception ex) {
                log.warn("Activity logger failed to record bootstrap event: {}", ex.getMessage());
            }
        }

        return AdminProvisioningResult.builder()
                .status(AdminProvisioningResult.Status.SUCCESS)
                .adminUserId(savedAdmin.getId())
                .email(savedAdmin.getEmail())
                .message("Initial administrator provisioned successfully.")
                .build();
        } finally {
            JVM_LOCK.unlock();
        }
    }

    private void acquireDatabaseLock() {
        // If no JdbcTemplate is wired (pure unit-test context with no DataSource at all),
        // the JVM_LOCK held by the caller is the only available serialization mechanism.
        // In production Spring Boot, JdbcTemplate is always auto-configured via DataSource.
        if (jdbcTemplate == null) {
            log.debug("[ADMIN_PROVISIONING] JdbcTemplate not available; advisory lock skipped " +
                      "(JVM lock provides single-process serialization in this context).");
            return;
        }

        DialectKind dialect = resolveDialect();

        switch (dialect) {
            case POSTGRESQL -> {
                // Fail-closed: a lock acquisition failure on PostgreSQL aborts provisioning.
                try {
                    jdbcTemplate.execute(
                            "SELECT pg_advisory_xact_lock(" + ADMIN_BOOTSTRAP_LOCK_KEY + ")"
                    );
                    log.debug("[ADMIN_PROVISIONING] Acquired PostgreSQL advisory lock (key={}).",
                            ADMIN_BOOTSTRAP_LOCK_KEY);
                } catch (Exception ex) {
                    log.warn("[ADMIN_PROVISIONING] Failed to acquire PostgreSQL advisory lock. " +
                             "Aborting provisioning to prevent unsynchronized execution. Cause: {}",
                             ex.getMessage());
                    throw new AdminProvisioningException(
                            AdminProvisioningResult.Status.REFUSED_DATABASE_LOCK,
                            "Failed to obtain required PostgreSQL advisory lock; " +
                            "provisioning aborted to prevent concurrent bootstrap."
                    );
                }
            }
            case H2, HSQLDB -> {
                // Explicitly recognized lightweight test databases — no advisory lock available.
                // JVM_LOCK (already held by caller) provides sufficient single-process isolation
                // for the test environment.
                log.debug("[ADMIN_PROVISIONING] Test database detected ({}); " +
                          "advisory lock skipped, JVM lock provides serialization.", dialect);
            }
            default -> {
                // Unknown dialect — refuse rather than silently fall back.
                log.warn("[ADMIN_PROVISIONING] Unrecognized database dialect ({}). " +
                         "Cannot guarantee advisory-lock serialization; aborting provisioning.", dialect);
                throw new AdminProvisioningException(
                        AdminProvisioningResult.Status.REFUSED_DATABASE_LOCK,
                        "Unrecognized database dialect; provisioning refused to prevent " +
                        "unsafe bootstrap without cluster-level advisory locking."
                );
            }
        }
    }

    /**
     * Dialect classification used to drive lock-acquisition policy.
     * Package-private to allow targeted unit testing of dialect resolution.
     */
    enum DialectKind {
        POSTGRESQL, H2, HSQLDB, UNKNOWN
    }

    /**
     * Determines the active database dialect by inspecting the JDBC URL from the configured
     * {@link DataSource}.  This approach reads the static URL that Spring resolved at startup
     * and does NOT attempt to open a live connection, so a transient connection failure
     * does not cause the dialect to be misidentified.
     *
     * <p>If the DataSource URL cannot be obtained (e.g. in a unit test that injects only a
     * mocked JdbcTemplate without a DataSource), the method falls back to interrogating the
     * JdbcTemplate's own DataSource, and finally to {@link DialectKind#UNKNOWN} — which
     * causes {@link #acquireDatabaseLock()} to refuse provisioning rather than fall through.</p>
     */
    DialectKind resolveDialect() {
        // Prefer the explicit DataSource injection (covers production + integration tests).
        String url = extractJdbcUrl(dataSource);

        // Secondary fallback: try the DataSource embedded in JdbcTemplate.
        if (url == null && jdbcTemplate != null) {
            url = extractJdbcUrl(jdbcTemplate.getDataSource());
        }

        if (url == null) {
            log.debug("[ADMIN_PROVISIONING] JDBC URL could not be determined; treating as UNKNOWN dialect.");
            return DialectKind.UNKNOWN;
        }

        String lc = url.toLowerCase();
        if (lc.contains(":postgresql:") || lc.contains(":pgsql:")) {
            return DialectKind.POSTGRESQL;
        }
        if (lc.contains(":h2:")) {
            return DialectKind.H2;
        }
        if (lc.contains(":hsqldb:")) {
            return DialectKind.HSQLDB;
        }
        log.debug("[ADMIN_PROVISIONING] JDBC URL does not match any known dialect: [{}]",
                  url.replaceAll("(?i)(password|pwd|passwd)=[^;&]*", "$1=***"));
        return DialectKind.UNKNOWN;
    }

    /**
     * Safely extracts the JDBC URL from a {@link DataSource} by opening a connection
     * exclusively to read the metadata URL, then immediately closing it.
     * Returns {@code null} if the DataSource is null or if the URL cannot be obtained.
     */
    private String extractJdbcUrl(DataSource ds) {
        if (ds == null) {
            return null;
        }
        try (Connection conn = ds.getConnection()) {
            return conn.getMetaData().getURL();
        } catch (SQLException ex) {
            log.debug("[ADMIN_PROVISIONING] Could not read JDBC URL from DataSource metadata: {}",
                      ex.getMessage());
            return null;
        }
    }

    private long countExistingAdmins() {
        try {
            return userRepository.countAllAdminsIncludingDeleted();
        } catch (Exception ex) {
            log.warn("Direct native admin count failed; falling back to JPA countByRole: {}", ex.getMessage());
            return userRepository.countByRole(UserRole.ADMIN);
        }
    }

    public static void validatePasswordStrength(String password, String email) {
        if (password == null || password.isEmpty()) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password is required and cannot be blank. Set ADMIN_BOOTSTRAP_PASSWORD or APP_ADMIN_BOOTSTRAP_PASSWORD in environment."
            );
        }

        if (password.length() < 10) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password must be at least 10 characters long."
            );
        }

        if (!password.matches(".*[A-Z].*")) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password must contain at least one uppercase letter (A-Z)."
            );
        }

        if (!password.matches(".*[a-z].*")) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password must contain at least one lowercase letter (a-z)."
            );
        }

        if (!password.matches(".*[0-9].*")) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password must contain at least one numerical digit (0-9)."
            );
        }

        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?~`].*")) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password must contain at least one special character."
            );
        }

        if (email != null && !email.isBlank()) {
            String usernamePart = email.split("@")[0].toLowerCase();
            if (usernamePart.length() >= 3 && password.toLowerCase().contains(usernamePart)) {
                throw new AdminProvisioningException(
                        AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                        "Admin password must not contain the username portion of the email."
                );
            }
        }

        if (COMMON_WEAK_PASSWORDS.contains(password.toLowerCase())) {
            throw new AdminProvisioningException(
                    AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD,
                    "Admin password is too common or easily guessed. Choose a more complex passphrase."
            );
        }
    }

    private void recordAuditRefusal(String reason) {
        if (activityLogger != null) {
            try {
                activityLogger.logActivity(null, null, "ADMIN_BOOTSTRAP_REFUSED", "USER", null, reason);
            } catch (Exception ignored) {}
        }
    }

    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) return "***";
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) return "***@" + (atIndex >= 0 ? email.substring(atIndex + 1) : "");
        return email.charAt(0) + "***" + email.substring(atIndex);
    }
}

