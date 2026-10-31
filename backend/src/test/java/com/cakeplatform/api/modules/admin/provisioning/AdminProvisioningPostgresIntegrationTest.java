package com.cakeplatform.api.modules.admin.provisioning;

import com.cakeplatform.api.modules.user.UserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Isolated PostgreSQL Integration Test for Initial Admin Provisioning.
 *
 * Requirements enforced (AUTH-FIX-06.2):
 * 1. Dedicated disposable PostgreSQL container managed exclusively via Testcontainers.
 * 2. Never connects to shared development (cake_platform), staging, or production databases.
 * 3. Never falls back to local PostgreSQL if Docker is unavailable (fails fast with explicit environment diagnostic).
 * 4. Verifies real database-level PostgreSQL advisory lock concurrency without in-memory mocks or proxies.
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
public class AdminProvisioningPostgresIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("test_cake_platform_isolated")
            .withUsername("test_user")
            .withPassword("test_password")
            .withReuse(false);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        // Enforce strict fail-fast requirement: Docker must be available.
        // Fallback to local or persistent PostgreSQL is strictly prohibited.
        boolean dockerAvailable;
        try {
            dockerAvailable = DockerClientFactory.instance().isDockerAvailable();
        } catch (Exception ex) {
            dockerAvailable = false;
        }

        if (!dockerAvailable) {
            throw new IllegalStateException(
                    "ENVIRONMENT REQUIREMENT FAILED: Docker daemon is unavailable. " +
                    "AdminProvisioningPostgresIntegrationTest strictly requires a disposable Testcontainers PostgreSQL container. " +
                    "Fallback to shared or local PostgreSQL (e.g. cake_platform) is prohibited to prevent test pollution."
            );
        }

        if (!postgres.isRunning()) {
            postgres.start();
        }

        // Configure Spring test DataSource exclusively from the disposable container
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");

        // Prevent external environment variables from overriding the container connection
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);

        // Ensure clean initial state: disable demo-data and bootstrap initializers
        registry.add("app.demo-data.enabled", () -> "false");
        registry.add("app.admin.bootstrap.enabled", () -> "false");
    }

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private static final String TEST_ADMIN_A_EMAIL = "disposable.admin.race.a@cakestore.local";
    private static final String TEST_ADMIN_B_EMAIL = "disposable.admin.race.b@cakestore.local";
    private static final String STRONG_PASSWORD = "Str0ng!AdminSecure#2026";

    @BeforeEach
    void verifyDatabaseIsolation() throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            String dbUrl = metaData.getURL();
            String dbUser = metaData.getUserName();
            String dbProduct = metaData.getDatabaseProductName();
            String dbVersion = metaData.getDatabaseProductVersion();

            // Strict safety assertions: guarantee no connection to shared development or local persistent DB
            assertFalse(dbUrl.contains("5432/cake_platform"),
                    "SAFETY VIOLATION: Test DataSource must NEVER connect to the shared cake_platform database!");
            assertTrue(dbUrl.contains("test_cake_platform_isolated"),
                    "Test DataSource must connect exclusively to the isolated Testcontainers database!");

            System.out.println("================================================================================");
            System.out.println("POSTGRESQL TESTCONTAINERS ISOLATION DIAGNOSTICS:");
            System.out.println("Connected JDBC URL     : " + dbUrl);
            System.out.println("Database User          : " + dbUser);
            System.out.println("Database Product Name  : " + dbProduct);
            System.out.println("Database Version       : " + dbVersion);
            System.out.println("================================================================================");
        }
    }

    @AfterAll
    static void tearDownContainer() {
        if (postgres != null && postgres.isRunning()) {
            postgres.stop();
        }
    }

    @Test
    @DisplayName("1. Advisory Lock Blocking: Connection 2 blocks on PostgreSQL engine until Connection 1 commits")
    void testDualConnectionAdvisoryLockBlockingAndRelease() throws Exception {
        long lockKey = AdminProvisioningService.ADMIN_BOOTSTRAP_LOCK_KEY;

        try (Connection conn1 = dataSource.getConnection();
             Connection conn2 = dataSource.getConnection()) {

            conn1.setAutoCommit(false);
            conn2.setAutoCommit(false);

            // Connection 1 acquires the PostgreSQL transaction advisory lock
            try (Statement stmt1 = conn1.createStatement()) {
                stmt1.execute("SELECT pg_advisory_xact_lock(" + lockKey + ")");
            }

            // Connection 2 attempts to acquire the same lock concurrently
            ExecutorService executor = Executors.newSingleThreadExecutor();
            AtomicBoolean conn2Acquired = new AtomicBoolean(false);
            CountDownLatch conn2Attempting = new CountDownLatch(1);

            Future<?> conn2Future = executor.submit(() -> {
                try (Statement stmt2 = conn2.createStatement()) {
                    conn2Attempting.countDown();
                    stmt2.execute("SELECT pg_advisory_xact_lock(" + lockKey + ")");
                    conn2Acquired.set(true);
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            });

            assertTrue(conn2Attempting.await(3, TimeUnit.SECONDS), "Connection 2 should attempt lock");

            // Connection 2 MUST block on the PostgreSQL server while Connection 1 holds the lock
            assertThrows(TimeoutException.class, () -> conn2Future.get(600, TimeUnit.MILLISECONDS),
                    "Connection 2 MUST block on the database server while Connection 1 holds the lock");
            assertFalse(conn2Acquired.get(), "Connection 2 must not have acquired the lock yet");

            // Connection 1 commits transaction, releasing PostgreSQL advisory lock
            conn1.commit();

            // Connection 2 unblocks immediately and completes acquisition
            assertDoesNotThrow(() -> conn2Future.get(3, TimeUnit.SECONDS),
                    "Connection 2 MUST unblock and acquire the lock once Connection 1 commits");
            assertTrue(conn2Acquired.get(), "Connection 2 should now hold the lock");

            conn2.commit();
            executor.shutdownNow();
        }
    }

    @Test
    @DisplayName("2. Rollback Release: Transaction rollback automatically releases PostgreSQL advisory lock")
    void testRollbackReleasesAdvisoryLock() throws Exception {
        long lockKey = AdminProvisioningService.ADMIN_BOOTSTRAP_LOCK_KEY;

        try (Connection conn1 = dataSource.getConnection();
             Connection conn2 = dataSource.getConnection()) {

            conn1.setAutoCommit(false);
            conn2.setAutoCommit(false);

            try (Statement stmt1 = conn1.createStatement()) {
                stmt1.execute("SELECT pg_advisory_xact_lock(" + lockKey + ")");
            }

            ExecutorService executor = Executors.newSingleThreadExecutor();
            AtomicBoolean conn2Acquired = new AtomicBoolean(false);
            CountDownLatch conn2Attempting = new CountDownLatch(1);

            Future<?> conn2Future = executor.submit(() -> {
                try (Statement stmt2 = conn2.createStatement()) {
                    conn2Attempting.countDown();
                    stmt2.execute("SELECT pg_advisory_xact_lock(" + lockKey + ")");
                    conn2Acquired.set(true);
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            });

            assertTrue(conn2Attempting.await(3, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> conn2Future.get(600, TimeUnit.MILLISECONDS));

            // Connection 1 rolls back, releasing the lock immediately
            conn1.rollback();

            // Connection 2 immediately unblocks
            assertDoesNotThrow(() -> conn2Future.get(3, TimeUnit.SECONDS));
            assertTrue(conn2Acquired.get());

            conn2.commit();
            executor.shutdownNow();
        }
    }

    @Test
    @DisplayName("3. Concurrent Provisioning Race: Real PostgreSQL advisory lock coordinates two independent services against clean container")
    void testTwoIndependentProvisioningServicesRace() throws Exception {
        // Step 1: Verify the clean container database initially contains strictly zero administrators
        long initialAdminCount = userRepository.countAllAdminsIncludingDeleted();
        assertEquals(0, initialAdminCount, "Clean container database initially must contain zero administrators");

        // Construct two independent service instances simulating two separate app containers/processes
        // Exercising the REAL UserRepository and REAL PostgreSQL advisory locking without proxies!
        AdminProvisioningService serviceInstance1 = new AdminProvisioningService(userRepository, passwordEncoder);
        serviceInstance1.setDataSource(dataSource);
        serviceInstance1.setJdbcTemplate(jdbcTemplate);

        AdminProvisioningService serviceInstance2 = new AdminProvisioningService(userRepository, passwordEncoder);
        serviceInstance2.setDataSource(dataSource);
        serviceInstance2.setJdbcTemplate(jdbcTemplate);

        int numCompetitors = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numCompetitors);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch finishGate = new CountDownLatch(numCompetitors);

        List<AdminProvisioningResult> successes = Collections.synchronizedList(new ArrayList<>());
        List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

        // Thread 1: Competitor A executing in an independent Spring transaction
        executor.submit(() -> {
            try {
                startGate.await();
                TransactionTemplate txTemplateA = new TransactionTemplate(transactionManager);
                txTemplateA.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

                AdminProvisioningRequest reqA = AdminProvisioningRequest.builder()
                        .email(TEST_ADMIN_A_EMAIL)
                        .password(STRONG_PASSWORD)
                        .fullName("Concurrent Admin Instance 1")
                        .mobile("9111111111")
                        .build();

                AdminProvisioningResult res = txTemplateA.execute(status -> serviceInstance1.provisionInitialAdmin(reqA));
                successes.add(res);
            } catch (Exception ex) {
                errors.add(ex);
            } finally {
                finishGate.countDown();
            }
        });

        // Thread 2: Competitor B executing in an independent Spring transaction
        executor.submit(() -> {
            try {
                startGate.await();
                TransactionTemplate txTemplateB = new TransactionTemplate(transactionManager);
                txTemplateB.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

                AdminProvisioningRequest reqB = AdminProvisioningRequest.builder()
                        .email(TEST_ADMIN_B_EMAIL)
                        .password(STRONG_PASSWORD)
                        .fullName("Concurrent Admin Instance 2")
                        .mobile("9222222222")
                        .build();

                AdminProvisioningResult res = txTemplateB.execute(status -> serviceInstance2.provisionInitialAdmin(reqB));
                successes.add(res);
            } catch (Exception ex) {
                errors.add(ex);
            } finally {
                finishGate.countDown();
            }
        });

        // Release start gate: both threads race simultaneously to acquire lock and provision
        startGate.countDown();
        assertTrue(finishGate.await(10, TimeUnit.SECONDS), "Both competitors must complete within 10s");

        System.out.println("Race Results: Successes = " + successes.size() + ", Errors/Refusals = " + errors.size());

        // Assert strictly ONE admin provisioning succeeded
        assertEquals(1, successes.size(), "Strictly ONE admin must be created");
        assertEquals(1, errors.size(), "The second competing provisioning attempt must fail/refuse");

        // Assert the loser was rejected with REFUSED_ADMIN_EXISTS
        Exception loserException = errors.get(0);
        assertTrue(loserException instanceof AdminProvisioningException, "Loser must receive AdminProvisioningException");
        AdminProvisioningException ape = (AdminProvisioningException) loserException;
        assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS, ape.getStatus(),
                "Loser must observe that an administrator already exists once PostgreSQL lock is acquired");

        // Verify the database contains strictly 1 administrator user after both attempts
        long finalAdminCount = userRepository.countAllAdminsIncludingDeleted();
        assertEquals(1, finalAdminCount, "Clean container database must contain strictly 1 administrator after the race");

        executor.shutdownNow();
    }

    @Test
    @DisplayName("4. Existing Admin Guard: In an environment with existing administrators, bootstrap immediately refuses against PostgreSQL")
    void testExistingAdminsRefusalAgainstRealPostgres() {
        // At this point, exactly 1 admin exists from Test 3
        AdminProvisioningService service = new AdminProvisioningService(userRepository, passwordEncoder);
        service.setDataSource(dataSource);
        service.setJdbcTemplate(jdbcTemplate);

        AdminProvisioningRequest req = AdminProvisioningRequest.builder()
                .email("late.admin@cakestore.local")
                .password(STRONG_PASSWORD)
                .fullName("Late Admin Attempt")
                .mobile("9333333333")
                .build();

        AdminProvisioningException ex = assertThrows(AdminProvisioningException.class, () ->
                service.provisionInitialAdmin(req));

        assertEquals(AdminProvisioningResult.Status.REFUSED_ADMIN_EXISTS, ex.getStatus(),
                "Must refuse bootstrap because administrators already exist in the real PostgreSQL database");
    }
}
