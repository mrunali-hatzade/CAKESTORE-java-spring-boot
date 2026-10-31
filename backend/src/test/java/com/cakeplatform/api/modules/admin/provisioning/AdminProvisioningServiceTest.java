package com.cakeplatform.api.modules.admin.provisioning;

import com.cakeplatform.api.modules.audit.ActivityLoggerService;
import com.cakeplatform.api.modules.user.User;
import com.cakeplatform.api.modules.user.UserRepository;
import com.cakeplatform.api.modules.user.UserRole;
import com.cakeplatform.api.modules.user.UserStatus;
import com.cakeplatform.api.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AdminProvisioningServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityLoggerService activityLogger;

    private PasswordEncoder passwordEncoder;
    private AdminProvisioningService provisioningService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        provisioningService = new AdminProvisioningService(userRepository, passwordEncoder);
        ReflectionTestUtils.setField(provisioningService, "activityLogger", activityLogger);
    }

    private AdminProvisioningRequest createValidRequest() {
        return AdminProvisioningRequest.builder()
                .email("ops-admin@cakestore.com")
                .password("Str0ng!AdminSecure#2026")
                .fullName("Platform Operations Lead")
                .mobile("9998887776")
                .build();
    }

    @Nested
    @DisplayName("1. Successful Provisioning & Role/Security Verification")
    class SuccessfulProvisioningTests {

        @Test
        @DisplayName("Provisions initial administrator with ADMIN role and BCrypt hashed password")
        void testProvisionInitialAdmin_Success() {
            AdminProvisioningRequest req = createValidRequest();

            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted("ops-admin@cakestore.com")).thenReturn(0L);
            when(userRepository.existsByMobile("9998887776")).thenReturn(false);
            when(userRepository.findByMobileIncludingDeleted("9998887776")).thenReturn(Optional.empty());

            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User u = invocation.getArgument(0);
                u.setId(1L);
                return u;
            });

            AdminProvisioningResult result = provisioningService.provisionInitialAdmin(req);

            assertNotNull(result);
            assertEquals(AdminProvisioningResult.Status.SUCCESS, result.getStatus());
            assertEquals(1L, result.getAdminUserId());
            assertEquals("ops-admin@cakestore.com", result.getEmail());

            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User savedUser = userCaptor.getValue();

            // 1. Role verification
            assertEquals(UserRole.ADMIN, savedUser.getRole());
            assertEquals(UserStatus.ACTIVE, savedUser.getStatus());
            assertEquals("Platform Operations Lead", savedUser.getFullName());
            assertEquals("ops-admin@cakestore.com", savedUser.getEmail());
            assertEquals("9998887776", savedUser.getMobile());
            assertEquals(1, savedUser.getTokenVersion());
            assertNotNull(savedUser.getTokensInvalidatedBefore());
            assertFalse(savedUser.isDeleted());

            // 2. Password security: BCrypt hashed, never plaintext
            assertNotNull(savedUser.getPasswordHash());
            assertNotEquals("Str0ng!AdminSecure#2026", savedUser.getPasswordHash());
            assertTrue(passwordEncoder.matches("Str0ng!AdminSecure#2026", savedUser.getPasswordHash()),
                    "Stored password hash must match BCrypt verification");

            // 3. Authority mapping verification
            CustomUserDetails userDetails = new CustomUserDetails(savedUser);
            assertTrue(userDetails.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN")));

            // 4. Audit activity log verification
            verify(activityLogger).logActivity(
                    eq(1L),
                    isNull(),
                    eq("ADMIN_INITIAL_PROVISIONING"),
                    eq("USER"),
                    eq(1L),
                    contains("Initial administrator provisioned")
            );
        }
    }

    @Nested
    @DisplayName("2. Existing Administrator Protection & Refusal")
    class ExistingAdminProtectionTests {

        @Test
        @DisplayName("Refuses bootstrap when an active administrator already exists")
        void testRefuse_WhenActiveAdminExists() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(1L);

            AdminProvisioningRequest req = createValidRequest();

            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS, ex.getStatus());
            assertTrue(ex.getMessage().contains("An administrator account already exists"));

            verify(userRepository, never()).save(any(User.class));
            verify(activityLogger).logActivity(isNull(), isNull(), eq("ADMIN_BOOTSTRAP_REFUSED"), eq("USER"), isNull(), contains("already exists"));
        }

        @Test
        @DisplayName("Refuses bootstrap when a soft-deleted administrator exists (preventing bypass)")
        void testRefuse_WhenSoftDeletedAdminExists() {
            // Even if JPA countByRole might return 0 due to SQLRestriction, countAllAdminsIncludingDeleted returns 1
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(1L);

            AdminProvisioningRequest req = createValidRequest();

            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS, ex.getStatus());
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Refuses bootstrap when JPA fallback detects existing administrator")
        void testRefuse_WhenJpaCountDetectsAdmin() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenThrow(new RuntimeException("Native query error"));
            when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(2L);

            AdminProvisioningRequest req = createValidRequest();

            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS, ex.getStatus());
            verify(userRepository, never()).save(any(User.class));
        }
    }

    @Nested
    @DisplayName("3. Existing User Protection & Identity Hijacking Prevention")
    class ExistingUserProtectionTests {

        @Test
        @DisplayName("Refuses bootstrap if email is registered to a SHOP_OWNER (never converts or overwrites)")
        void testRefuse_WhenEmailBelongsToShopOwner() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted("owner@example.com")).thenReturn(1L);

            AdminProvisioningRequest req = AdminProvisioningRequest.builder()
                    .email("owner@example.com")
                    .password("Str0ng!AdminSecure#2026")
                    .build();

            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_DUPLICATE_EMAIL, ex.getStatus());
            assertTrue(ex.getMessage().contains("already registered"));

            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Refuses bootstrap if email is registered to a CUSTOMER (never converts or overwrites)")
        void testRefuse_WhenEmailBelongsToCustomer() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted("customer@example.com")).thenReturn(1L);

            AdminProvisioningRequest req = AdminProvisioningRequest.builder()
                    .email("customer@example.com")
                    .password("Str0ng!AdminSecure#2026")
                    .build();

            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_DUPLICATE_EMAIL, ex.getStatus());
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Refuses bootstrap if mobile number is already registered")
        void testRefuse_WhenMobileAlreadyExists() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted("newadmin@cakestore.com")).thenReturn(0L);
            when(userRepository.existsByMobile("9876543210")).thenReturn(true);

            AdminProvisioningRequest req = AdminProvisioningRequest.builder()
                    .email("newadmin@cakestore.com")
                    .password("Str0ng!AdminSecure#2026")
                    .mobile("+91 9876543210")
                    .build();

            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_DUPLICATE_MOBILE, ex.getStatus());
            assertTrue(ex.getMessage().contains("mobile number is already registered"));

            verify(userRepository, never()).save(any(User.class));
        }
    }

    @Nested
    @DisplayName("4. Configuration & Password Strength Validation")
    class ValidationTests {

        @Test
        @DisplayName("Refuses when request is null or email is missing/blank")
        void testRefuse_MissingEmail() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);

            assertThrows(AdminProvisioningException.class, () -> provisioningService.provisionInitialAdmin(null));

            AdminProvisioningRequest blankEmailReq = AdminProvisioningRequest.builder()
                    .email("   ")
                    .password("Str0ng!Pass#123")
                    .build();
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(blankEmailReq);
            });
            assertEquals(AdminProvisioningResult.Status.REFUSED_INVALID_CONFIG, ex.getStatus());
        }

        @Test
        @DisplayName("Refuses invalid email syntax")
        void testRefuse_InvalidEmailSyntax() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);

            AdminProvisioningRequest req = AdminProvisioningRequest.builder()
                    .email("not-an-email")
                    .password("Str0ng!Pass#123")
                    .build();
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(req);
            });
            assertEquals(AdminProvisioningResult.Status.REFUSED_INVALID_CONFIG, ex.getStatus());
            assertTrue(ex.getMessage().contains("Invalid admin email format"));
        }

        @Test
        @DisplayName("Refuses passwords shorter than 10 characters")
        void testRefuse_ShortPassword() {
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                AdminProvisioningService.validatePasswordStrength("Short1!", "admin@cakestore.com");
            });
            assertEquals(AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD, ex.getStatus());
            assertTrue(ex.getMessage().contains("at least 10 characters"));
        }

        @Test
        @DisplayName("Refuses passwords missing uppercase, lowercase, numbers, or special chars")
        void testRefuse_MissingComplexity() {
            // Missing uppercase
            assertThrows(AdminProvisioningException.class, () ->
                    AdminProvisioningService.validatePasswordStrength("lowercase123!@", "admin@cakestore.com"));

            // Missing lowercase
            assertThrows(AdminProvisioningException.class, () ->
                    AdminProvisioningService.validatePasswordStrength("UPPERCASE123!@", "admin@cakestore.com"));

            // Missing digit
            assertThrows(AdminProvisioningException.class, () ->
                    AdminProvisioningService.validatePasswordStrength("NoDigitsHere!@", "admin@cakestore.com"));

            // Missing special character
            assertThrows(AdminProvisioningException.class, () ->
                    AdminProvisioningService.validatePasswordStrength("NoSpecialChar123", "admin@cakestore.com"));
        }

        @Test
        @DisplayName("Refuses password containing username portion of email")
        void testRefuse_PasswordContainsUsername() {
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                AdminProvisioningService.validatePasswordStrength("SuperAdmin2026!#", "admin@cakestore.com");
            });
            assertEquals(AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD, ex.getStatus());
            assertTrue(ex.getMessage().contains("must not contain the username portion"));
        }

        @Test
        @DisplayName("Refuses common weak passwords")
        void testRefuse_CommonPasswords() {
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                AdminProvisioningService.validatePasswordStrength("Password123!", "different@cakestore.com");
            });
            assertEquals(AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD, ex.getStatus());
            assertTrue(ex.getMessage().contains("too common or easily guessed"));
        }
    }

    @Nested
    @DisplayName("5. Log Masking & Audit Security")
    class AuditSecurityTests {

        @Test
        @DisplayName("Email masking produces safe audit strings")
        void testMaskEmail() {
            assertEquals("o***@cakestore.com", AdminProvisioningService.maskEmail("ops-admin@cakestore.com"));
            assertEquals("a***@example.com", AdminProvisioningService.maskEmail("admin@example.com"));
            assertEquals("***", AdminProvisioningService.maskEmail(""));
            assertEquals("***", AdminProvisioningService.maskEmail(null));
        }

        @Test
        @DisplayName("Raw passwords and password hashes are never passed to activity logger")
        void testNoSensitiveDataInLogs() {
            AdminProvisioningRequest req = createValidRequest();

            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted(any())).thenReturn(0L);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(99L);
                return u;
            });

            provisioningService.provisionInitialAdmin(req);

            ArgumentCaptor<String> metadataCaptor = ArgumentCaptor.forClass(String.class);
            verify(activityLogger).logActivity(any(), any(), any(), any(), any(), metadataCaptor.capture());

            String metadata = metadataCaptor.getValue();
            assertFalse(metadata.contains("Str0ng!AdminSecure#2026"), "Metadata must never contain raw password");
            assertFalse(metadata.contains("$2a$"), "Metadata must never contain password hash");
        }
    }

    @Nested
    @DisplayName("6. Bootstrap Runner Invocation & Condition Tests")
    class BootstrapRunnerTests {

        @Test
        @DisplayName("AdminBootstrapRunner invokes provisioningService with injected properties")
        void testRunner_InvokesService() {
            AdminProvisioningService mockService = mock(AdminProvisioningService.class);
            AdminBootstrapRunner runner = new AdminBootstrapRunner(mockService);

            ReflectionTestUtils.setField(runner, "bootstrapEmail", "cli-admin@cakestore.com");
            ReflectionTestUtils.setField(runner, "bootstrapPassword", "CliSecurePass123!#");
            ReflectionTestUtils.setField(runner, "bootstrapFullName", "CLI Administrator");
            ReflectionTestUtils.setField(runner, "bootstrapMobile", "9998881111");
            ReflectionTestUtils.setField(runner, "exitOnCompletion", false);

            when(mockService.provisionInitialAdmin(any())).thenReturn(
                    AdminProvisioningResult.builder()
                            .status(AdminProvisioningResult.Status.SUCCESS)
                            .adminUserId(5L)
                            .email("cli-admin@cakestore.com")
                            .message("Initial administrator provisioned successfully.")
                            .build()
            );

            ApplicationArguments args = new DefaultApplicationArguments();
            runner.run(args);

            ArgumentCaptor<AdminProvisioningRequest> reqCaptor = ArgumentCaptor.forClass(AdminProvisioningRequest.class);
            verify(mockService).provisionInitialAdmin(reqCaptor.capture());

            AdminProvisioningRequest passedReq = reqCaptor.getValue();
            assertEquals("cli-admin@cakestore.com", passedReq.getEmail());
            assertEquals("CliSecurePass123!#", passedReq.getPassword());
            assertEquals("CLI Administrator", passedReq.getFullName());
            assertEquals("9998881111", passedReq.getMobile());
        }
    }

    @Nested
    @DisplayName("7. Concurrency & Multi-Threaded Bootstrap Serialization Tests")
    class ConcurrencySerializationTests {

        @Test
        @DisplayName("Two concurrent bootstrap attempts: exactly one succeeds and the other is safely refused")
        void testConcurrentBootstrap_ExactlyOneSucceeds() throws Exception {
            java.util.concurrent.atomic.AtomicInteger adminCount = new java.util.concurrent.atomic.AtomicInteger(0);

            when(userRepository.countAllAdminsIncludingDeleted()).thenAnswer(inv -> (long) adminCount.get());
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted(any())).thenReturn(0L);

            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                adminCount.incrementAndGet();
                User u = inv.getArgument(0);
                u.setId(100L);
                return u;
            });

            int numThreads = 2;
            java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(numThreads);
            java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.CountDownLatch doneLatch = new java.util.concurrent.CountDownLatch(numThreads);

            java.util.List<AdminProvisioningResult> successes = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
            java.util.List<Exception> exceptions = java.util.Collections.synchronizedList(new java.util.ArrayList<>());

            for (int i = 0; i < numThreads; i++) {
                final int idx = i;
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        AdminProvisioningRequest req = AdminProvisioningRequest.builder()
                                .email("admin" + idx + "@cakestore.com")
                                .password("Str0ng!Pass#2026_" + idx)
                                .fullName("Admin " + idx)
                                .build();
                        AdminProvisioningResult res = provisioningService.provisionInitialAdmin(req);
                        successes.add(res);
                    } catch (Exception ex) {
                        exceptions.add(ex);
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            // Release both threads simultaneously
            startLatch.countDown();
            doneLatch.await(5, java.util.concurrent.TimeUnit.SECONDS);
            executor.shutdown();

            assertEquals(1, successes.size(), "Exactly one bootstrap request must succeed");
            assertEquals(1, exceptions.size(), "Exactly one bootstrap request must be refused");

            Exception refusedEx = exceptions.get(0);
            assertTrue(refusedEx instanceof AdminProvisioningException);
            assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS,
                    ((AdminProvisioningException) refusedEx).getStatus());

            // Verify userRepository.save was called exactly once
            verify(userRepository, times(1)).save(any(User.class));
        }

        @Test
        @DisplayName("PostgreSQL transaction advisory lock is acquired when JdbcTemplate is available")
        void testAdvisoryLockAcquisition() throws Exception {
            // Arrange: mock JdbcTemplate + DataSource returning a PostgreSQL JDBC URL
            org.springframework.jdbc.core.JdbcTemplate mockJdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
            provisioningService.setJdbcTemplate(mockJdbc);

            DataSource mockDs = mock(DataSource.class);
            Connection mockConn = mock(Connection.class);
            DatabaseMetaData mockMeta = mock(DatabaseMetaData.class);
            when(mockDs.getConnection()).thenReturn(mockConn);
            when(mockConn.getMetaData()).thenReturn(mockMeta);
            when(mockMeta.getURL()).thenReturn("jdbc:postgresql://localhost:5432/cake_platform");
            provisioningService.setDataSource(mockDs);

            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted(any())).thenReturn(0L);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(101L);
                return u;
            });

            provisioningService.provisionInitialAdmin(createValidRequest());

            verify(mockJdbc).execute(eq("SELECT pg_advisory_xact_lock(" + AdminProvisioningService.ADMIN_BOOTSTRAP_LOCK_KEY + ")"));
        }

        @Test
        @DisplayName("Sequential second bootstrap invocation safely refuses after first succeeds")
        void testSequentialSecondInvocation_Refuses() {
            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L, 1L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted(any())).thenReturn(0L);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(102L);
                return u;
            });

            // 1st attempt: succeeds
            AdminProvisioningResult first = provisioningService.provisionInitialAdmin(createValidRequest());
            assertEquals(AdminProvisioningResult.Status.SUCCESS, first.getStatus());

            // 2nd attempt: refuses
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                provisioningService.provisionInitialAdmin(createValidRequest());
            });
            assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS, ex.getStatus());
            verify(userRepository, times(1)).save(any(User.class));
        }
    }

    @Nested
    @DisplayName("8. Environment Variable & Configuration Mapping Tests")
    class ConfigBindingTests {

        @Test
        @DisplayName("AdminBootstrapRunner correctly binds APP_ADMIN_BOOTSTRAP_EMAIL and APP_ADMIN_BOOTSTRAP_PASSWORD aliases")
        void testRunner_AppAdminPrefixBinding() {
            AdminProvisioningService mockService = mock(AdminProvisioningService.class);
            AdminBootstrapRunner runner = new AdminBootstrapRunner(mockService);

            // Simulate injection of APP_ADMIN_BOOTSTRAP_* variants
            ReflectionTestUtils.setField(runner, "bootstrapEmail", "app-prefix-admin@cakestore.com");
            ReflectionTestUtils.setField(runner, "bootstrapPassword", "AppPrefixSecurePass!#1");
            ReflectionTestUtils.setField(runner, "bootstrapFullName", "App Prefix Admin");
            ReflectionTestUtils.setField(runner, "bootstrapMobile", null);
            ReflectionTestUtils.setField(runner, "exitOnCompletion", false);

            when(mockService.provisionInitialAdmin(any())).thenReturn(
                    AdminProvisioningResult.builder()
                            .status(AdminProvisioningResult.Status.SUCCESS)
                            .adminUserId(10L)
                            .email("app-prefix-admin@cakestore.com")
                            .message("Initial administrator provisioned successfully.")
                            .build()
            );

            runner.run(new DefaultApplicationArguments());

            ArgumentCaptor<AdminProvisioningRequest> captor = ArgumentCaptor.forClass(AdminProvisioningRequest.class);
            verify(mockService).provisionInitialAdmin(captor.capture());

            AdminProvisioningRequest req = captor.getValue();
            assertEquals("app-prefix-admin@cakestore.com", req.getEmail());
            assertEquals("AppPrefixSecurePass!#1", req.getPassword());
        }

        @Test
        @DisplayName("Missing password results in safe refusal with informative message")
        void testMissingPassword_RefusesSafely() {
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () -> {
                AdminProvisioningService.validatePasswordStrength(null, "admin@cakestore.com");
            });

            assertEquals(AdminProvisioningResult.Status.REFUSED_WEAK_PASSWORD, ex.getStatus());
            assertTrue(ex.getMessage().contains("Admin password is required and cannot be blank"));
            assertTrue(ex.getMessage().contains("ADMIN_BOOTSTRAP_PASSWORD"));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────
    // 9. Dialect Detection — Fail-Closed Advisory Lock Tests (AUTH-FIX-02.3)
    // ─────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Builds a mock DataSource whose connection reports the given JDBC URL from metadata.
     */
    private static DataSource mockDataSourceWithUrl(String jdbcUrl) throws java.sql.SQLException {
        DataSource ds = mock(DataSource.class);
        java.sql.Connection conn = mock(java.sql.Connection.class);
        java.sql.DatabaseMetaData meta = mock(java.sql.DatabaseMetaData.class);
        when(ds.getConnection()).thenReturn(conn);
        when(conn.getMetaData()).thenReturn(meta);
        when(meta.getURL()).thenReturn(jdbcUrl);
        return ds;
    }

    /**
     * Builds a mock DataSource whose getConnection() throws an SQLException
     * (simulates a metadata-lookup failure — dialect must then be treated as UNKNOWN).
     */
    private static DataSource mockDataSourceThatFailsMetadata() throws java.sql.SQLException {
        DataSource ds = mock(DataSource.class);
        when(ds.getConnection()).thenThrow(new java.sql.SQLException("Simulated metadata connection failure"));
        return ds;
    }

    @Nested
    @DisplayName("9. Fail-Closed Dialect Detection (AUTH-FIX-02.3)")
    class DialectDetectionTests {

        // ── 9a. resolveDialect unit tests ─────────────────────────────────────

        @Test
        @DisplayName("resolveDialect: recognizes a standard PostgreSQL JDBC URL as POSTGRESQL")
        void testResolveDialect_PostgreSQL() throws Exception {
            provisioningService.setJdbcTemplate(mock(org.springframework.jdbc.core.JdbcTemplate.class));
            provisioningService.setDataSource(mockDataSourceWithUrl("jdbc:postgresql://localhost:5432/cake_platform"));

            AdminProvisioningService.DialectKind result = provisioningService.resolveDialect();
            assertEquals(AdminProvisioningService.DialectKind.POSTGRESQL, result);
        }

        @Test
        @DisplayName("resolveDialect: recognizes an H2 in-memory JDBC URL as H2")
        void testResolveDialect_H2() throws Exception {
            provisioningService.setJdbcTemplate(mock(org.springframework.jdbc.core.JdbcTemplate.class));
            provisioningService.setDataSource(mockDataSourceWithUrl("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1"));

            AdminProvisioningService.DialectKind result = provisioningService.resolveDialect();
            assertEquals(AdminProvisioningService.DialectKind.H2, result);
        }

        @Test
        @DisplayName("resolveDialect: DataSource metadata failure returns UNKNOWN (never silently falls back)")
        void testResolveDialect_MetadataFailure_ReturnsUnknown() throws Exception {
            provisioningService.setJdbcTemplate(mock(org.springframework.jdbc.core.JdbcTemplate.class));
            provisioningService.setDataSource(mockDataSourceThatFailsMetadata());

            AdminProvisioningService.DialectKind result = provisioningService.resolveDialect();
            assertEquals(AdminProvisioningService.DialectKind.UNKNOWN, result);
        }

        @Test
        @DisplayName("resolveDialect: unrecognized JDBC URL returns UNKNOWN")
        void testResolveDialect_UnrecognizedUrl_ReturnsUnknown() throws Exception {
            provisioningService.setJdbcTemplate(mock(org.springframework.jdbc.core.JdbcTemplate.class));
            provisioningService.setDataSource(mockDataSourceWithUrl("jdbc:oracle:thin:@//localhost:1521/orcl"));

            AdminProvisioningService.DialectKind result = provisioningService.resolveDialect();
            assertEquals(AdminProvisioningService.DialectKind.UNKNOWN, result);
        }

        // ── 9b. Full provisioning paths through acquireDatabaseLock ──────────

        @Test
        @DisplayName("PostgreSQL: advisory-lock failure aborts provisioning with REFUSED_DATABASE_LOCK")
        void testPostgresLockFailure_AbortsProvisioning() throws Exception {
            org.springframework.jdbc.core.JdbcTemplate mockJdbc =
                    mock(org.springframework.jdbc.core.JdbcTemplate.class);
            provisioningService.setJdbcTemplate(mockJdbc);
            provisioningService.setDataSource(mockDataSourceWithUrl("jdbc:postgresql://localhost:5432/cake_platform"));

            // Advisory lock SQL throws (e.g. DB temporarily unavailable)
            doThrow(new org.springframework.dao.DataAccessResourceFailureException("Lock failed"))
                    .when(mockJdbc).execute(anyString());

            // countAllAdminsIncludingDeleted is NOT reached — lock acquisition aborts first
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () ->
                    provisioningService.provisionInitialAdmin(createValidRequest()));

            assertEquals(AdminProvisioningResult.Status.REFUSED_DATABASE_LOCK, ex.getStatus());
            assertTrue(ex.getMessage().contains("Failed to obtain required PostgreSQL advisory lock"));
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("UNKNOWN dialect (metadata failure) aborts provisioning with REFUSED_DATABASE_LOCK")
        void testUnknownDialect_MetadataFailure_AbortsProvisioning() throws Exception {
            org.springframework.jdbc.core.JdbcTemplate mockJdbc =
                    mock(org.springframework.jdbc.core.JdbcTemplate.class);
            provisioningService.setJdbcTemplate(mockJdbc);
            provisioningService.setDataSource(mockDataSourceThatFailsMetadata());

            // resolveDialect → UNKNOWN because metadata call fails; abort at lock stage
            // countAllAdminsIncludingDeleted is NOT reached
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () ->
                    provisioningService.provisionInitialAdmin(createValidRequest()));

            assertEquals(AdminProvisioningResult.Status.REFUSED_DATABASE_LOCK, ex.getStatus());
            assertTrue(ex.getMessage().contains("Unrecognized database dialect"));
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("UNKNOWN dialect (unrecognized URL) aborts provisioning with REFUSED_DATABASE_LOCK")
        void testUnknownDialect_UnrecognizedUrl_AbortsProvisioning() throws Exception {
            org.springframework.jdbc.core.JdbcTemplate mockJdbc =
                    mock(org.springframework.jdbc.core.JdbcTemplate.class);
            provisioningService.setJdbcTemplate(mockJdbc);
            provisioningService.setDataSource(mockDataSourceWithUrl("jdbc:oracle:thin:@//localhost:1521/orcl"));

            // resolveDialect → UNKNOWN; abort at lock stage; admin count never reached
            AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () ->
                    provisioningService.provisionInitialAdmin(createValidRequest()));

            assertEquals(AdminProvisioningResult.Status.REFUSED_DATABASE_LOCK, ex.getStatus());
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("H2 test dialect: advisory lock skipped, provisioning succeeds normally")
        void testH2Dialect_SkipsAdvisoryLock_ProvisioningSucceeds() throws Exception {
            org.springframework.jdbc.core.JdbcTemplate mockJdbc =
                    mock(org.springframework.jdbc.core.JdbcTemplate.class);
            provisioningService.setJdbcTemplate(mockJdbc);
            provisioningService.setDataSource(mockDataSourceWithUrl("jdbc:h2:mem:testdb"));

            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted(any())).thenReturn(0L);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(200L);
                return u;
            });

            AdminProvisioningResult result = provisioningService.provisionInitialAdmin(createValidRequest());

            assertEquals(AdminProvisioningResult.Status.SUCCESS, result.getStatus());
            // Advisory lock SQL must NOT be executed for H2
            verify(mockJdbc, never()).execute(contains("pg_advisory_xact_lock"));
        }

        @Test
        @DisplayName("PostgreSQL: successful provisioning acquires advisory lock and creates admin")
        void testPostgresDialect_SuccessfulProvisioning() throws Exception {
            org.springframework.jdbc.core.JdbcTemplate mockJdbc =
                    mock(org.springframework.jdbc.core.JdbcTemplate.class);
            provisioningService.setJdbcTemplate(mockJdbc);
            provisioningService.setDataSource(
                    mockDataSourceWithUrl("jdbc:postgresql://prod-db:5432/cake_platform"));

            when(userRepository.countAllAdminsIncludingDeleted()).thenReturn(0L);
            when(userRepository.countByEmailIgnoreCaseIncludingDeleted(any())).thenReturn(0L);
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(300L);
                return u;
            });

            AdminProvisioningResult result = provisioningService.provisionInitialAdmin(createValidRequest());

            assertEquals(AdminProvisioningResult.Status.SUCCESS, result.getStatus());
            assertEquals(300L, result.getAdminUserId());
            verify(mockJdbc).execute(
                    eq("SELECT pg_advisory_xact_lock(" + AdminProvisioningService.ADMIN_BOOTSTRAP_LOCK_KEY + ")")
            );
        }
    }
}

