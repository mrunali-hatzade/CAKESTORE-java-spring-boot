   # CakeStore — Phase AUTH-2.2: Secure Production Admin Provisioning Report

   **Task Identifier:** `AUTH-FIX-02`  
   **Execution Date:** 2026-10-31  
   **Target Environment:** Production Architecture & Local Automated Verification  
   **Status:** COMPLETE (All 16 Provisioning Tests & 54 Full Auth Regression Tests Passing; Zero Production Records Altered)

   ---

   ## 1. Initial Code Audit Findings

   Before implementing the provisioning mechanism, a code audit was conducted across the security, user, and initialization modules:

   1. **Existing Admin Initialization (`AdminUserInitializer.java`):**
      - Annotated with `@Profile("!prod")` and `@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true")`.
      - **Finding:** In production (`prod` profile) or when `app.demo-data.enabled=false`, `AdminUserInitializer` is completely disabled. Consequently, a freshly deployed production instance had **no mechanism whatsoever** to create the initial administrator account.
      - In dev/test environments, it relied on hardcoded fallback credentials (`admin@cakeplatform.com` / `Password123!` and `admin@cakestore.com` / `admin123`) and reset them on each startup.

   2. **User Entity & Persistence Schema (`User.java` & Flyway Migrations):**
      - The `users` table (`V1__init_schema.sql`, `V39__add_user_soft_deletes.sql`, `V53__add_session_invalidation_and_token_revocation.sql`) enforces unique constraints on `email` and soft deletion via `is_deleted`.
      - The entity defines `@SQLRestriction("is_deleted=false")`. Standard JPA repository queries filter out soft-deleted users.
      - **Security Implication:** To prevent an operator from bypassing the "one-time initial administrator" guardrail by soft-deleting an admin, detection of existing administrators must use native queries that inspect all records regardless of `is_deleted`.

   3. **Role & Authority Architecture (`UserRole.java`, `CustomUserDetails.java`):**
      - `UserRole.ADMIN` maps directly to `ROLE_ADMIN` in Spring Security authorities.
      - All `/actuator/**` endpoints (outside public health/info) require `ROLE_ADMIN`.
      - All `/api/admin/**` endpoints are protected by `hasRole('ADMIN')` and method-level security.
      - Normal registration via `AuthService.register()` unconditionally sets `user.setRole(UserRole.SHOP_OWNER)`. Public registration can never grant the `ADMIN` role.

   4. **Audit Logging (`ActivityLoggerService.java`, SLF4J):**
      - `activity_logs` table persists system activities asynchronously.
      - Standard SLF4J structured logging is available and can record masked audit events without leaking plaintext passwords, hashes, or sensitive tokens.

   ---

   ## 2. Files Created and Modified

   | File Path | Nature | Description |
   | :--- | :---: | :--- |
   | `backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningRequest.java` | **Created** | DTO encapsulating initial email, password, full name, and mobile for the bootstrap invocation. |
   | `backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningResult.java` | **Created** | Outcome object containing status enum (`SUCCESS`, `REFUSED_ADMIN_EXISTS`, `REFUSED_DUPLICATE_EMAIL`, `REFUSED_DUPLICATE_MOBILE`, `REFUSED_INVALID_CONFIG`, `REFUSED_WEAK_PASSWORD`), admin ID, email, and audit message. |
   | `backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningException.java` | **Created** | Dedicated runtime exception encapsulating provisioning refusal reason and status code. |
   | `backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningService.java` | **Created** | Core transactional provisioning service enforcing existing administrator protection, email/password validation, BCrypt password hashing, `ADMIN` role assignment, and safe audit logging. |
   | `backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminBootstrapRunner.java` | **Created** | Spring Boot `ApplicationRunner` conditioned strictly on `app.admin.bootstrap.enabled=true`. Reads execution-time environment secrets or CLI arguments and executes the one-shot bootstrap. Supports `exit-on-completion=true`. |
   | `backend/src/main/java/com/cakeplatform/api/modules/user/UserRepository.java` | **Modified** | Added native queries `countAllAdminsIncludingDeleted()` and `countByEmailIgnoreCaseIncludingDeleted(email)` to guarantee soft-deleted administrators and accounts cannot bypass duplicate or existing-admin checks. |
   | `backend/src/main/resources/application.yml` | **Modified** | Added `app.admin.bootstrap` configuration block with `enabled: false` by default and empty credential placeholders for secure environment variable injection. |
   | `backend/src/test/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningServiceTest.java` | **Created** | 16 unit and integration tests covering initial provisioning, password hashing, role assignment, admin refusal, identity collision rejection, password complexity, audit masking, and runner execution. |

   ---

   ## 3. Provisioning Architecture and Execution Procedure

   ### 3.1 Architectural Design
   ```
                        +---------------------------------------+
                        |   Operator / CI/CD Deployment Job    |
                        +---------------------------------------+
                                             |
                     Explicit CLI Arguments or Environment Secrets:
                     - APP_ADMIN_BOOTSTRAP_ENABLED=true
                     - ADMIN_BOOTSTRAP_EMAIL=ops@cakestore.com
                     - ADMIN_BOOTSTRAP_PASSWORD=Str0ng!Pass#2026
                     - APP_ADMIN_BOOTSTRAP_EXIT_ON_COMPLETION=true
                                             |
                                             v
                        +---------------------------------------+
                        |         AdminBootstrapRunner          |
                        |  (@ConditionalOnProperty = "true")   |
                        +---------------------------------------+
                                             |
                                             v
                        +---------------------------------------+
                        |       AdminProvisioningService        |
                        |           (@Transactional)            |
                        +---------------------------------------+
                           /          |              |          \
                        /           |              |           \
            1. Check Existing   2. Validate   3. Validate  4. BCrypt Hash
               Admins (>0?)        Email        Password       & Persist
                     |              |              |               |
                     v              v              v               v
               users (PostgreSQL)  RFC-5322    Complexity      activity_logs
               (Includes Deleted)    Regex     (Min 10 chars,   & SLF4J Masked
                                                symbols, etc.)     Audit Log
   ```

   ### 3.2 Execution Guardrails & Properties
   - **Disabled by Default:** `app.admin.bootstrap.enabled=false`. Ordinary application startup in production or development never creates an admin.
   - **Zero HTTP Exposure:** No `@RestController`, no `@RequestMapping`, and no HTTP endpoint exists for bootstrap. It is purely executable via process invocation.
   - **No Hardcoded Credentials:** If `app.admin.bootstrap.email` or `app.admin.bootstrap.password` is not supplied at execution time, bootstrap halts immediately with `REFUSED_INVALID_CONFIG` or `REFUSED_WEAK_PASSWORD`.

   ### 3.3 Production Operator Execution Procedure

   When initializing a fresh production deployment, the authorized DevOps operator runs the bootstrap as a one-shot task:

   #### Option A: One-Shot Container / Kubernetes Job (Recommended)
   ```yaml
   apiVersion: batch/v1
   kind: Job
   metadata:
   name: cakestore-admin-bootstrap
   spec:
   template:
      spec:
         restartPolicy: Never
         containers:
         - name: admin-bootstrap
         image: ghcr.io/cakestore/backend-api:release-1.0
         env:
         - name: SPRING_PROFILES_ACTIVE
            value: "prod"
         - name: APP_ADMIN_BOOTSTRAP_ENABLED
            value: "true"
         - name: ADMIN_BOOTSTRAP_EMAIL
            valueFrom:
               secretKeyRef:
               name: production-admin-credentials
               key: admin-email
         - name: ADMIN_BOOTSTRAP_PASSWORD
            valueFrom:
               secretKeyRef:
               name: production-admin-credentials
               key: admin-password
         - name: ADMIN_BOOTSTRAP_FULL_NAME
            value: "Lead Operations Administrator"
         - name: APP_ADMIN_BOOTSTRAP_EXIT_ON_COMPLETION
            value: "true"
   ```

   #### Option B: Standalone CLI Execution
   ```bash
   ADMIN_BOOTSTRAP_PASSWORD="<STRONG_VAULT_GENERATED_PASSWORD>" \
   java -jar api.jar \
   --spring.profiles.active=prod \
   --app.admin.bootstrap.enabled=true \
   --app.admin.bootstrap.email=platform-admin@cakestore.com \
   --app.admin.bootstrap.full-name="Platform Administrator" \
   --app.admin.bootstrap.exit-on-completion=true
   ```

   Upon successful creation, the runner logs:
   ```
   [ADMIN_PROVISIONING_SUCCESS] Initial administrator provisioned successfully. User ID: 1, Email: p***@cakestore.com
   [ADMIN_BOOTSTRAP] Execution complete. Exiting JVM as requested (exit-on-completion=true).
   ```
   And terminates cleanly with exit code `0`.

   ---

   ## 4. Security Controls & Safeguards

   1. **Password Complexity Validation:**
      - Minimum length: **10 characters**.
      - Requires at least one uppercase letter `[A-Z]`.
      - Requires at least one lowercase letter `[a-z]`.
      - Requires at least one numerical digit `[0-9]`.
      - Requires at least one special character `[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]`.
      - Prohibits the username portion of the email inside the password.
      - Blacklists common default passwords (`password123!`, `admin12345!`, `admin123`, etc.).

   2. **BCrypt Hashing:**
      - Raw passwords are never persisted. They are encoded with Spring Security's `BCryptPasswordEncoder` bean.
      - Verification tests prove that `passwordHash` is a valid BCrypt string and never equal to the plaintext password.

   3. **Log Sanitization:**
      - Raw passwords and BCrypt hashes are **never formatted into any log statement**.
      - Email addresses in logs are masked using `maskEmail(email)` (e.g., `ops-admin@cakestore.com` &rarr; `o***@cakestore.com`).

   4. **Token Invalidation State Initialized:**
      - Newly created administrator accounts are initialized with `tokenVersion = 1` and `tokensInvalidatedBefore = LocalDateTime.now()`, ensuring any theoretical pre-existing tokens are considered revoked.

   ---

   ## 5. Duplicate and Existing-Admin Protection

   1. **One-Time Provisioning Enforcement:**
      - `AdminProvisioningService` invokes `userRepository.countAllAdminsIncludingDeleted()`.
      - If count is `> 0`:
      - Throws `AdminProvisioningException(REFUSED_ADMIN_EXISTS)`.
      - Logs: `[ADMIN_PROVISIONING_REFUSED] Bootstrap refused: An administrator already exists in this environment.`
      - Records audit refusal event.
      - Aborts before modifying the database.

   2. **Existing Account Integrity Protection:**
      - If the operator specifies an email already registered to an existing `SHOP_OWNER` or `CUSTOMER`, the service detects the record via `countByEmailIgnoreCaseIncludingDeleted(email)`.
      - Refuses execution with `REFUSED_DUPLICATE_EMAIL`.
      - **Never overwrites password.**
      - **Never silently escalates role to ADMIN.**
      - The existing owner or customer account remains completely untouched.

   3. **Mobile Number Collision Prevention:**
      - If an optional mobile number is provided that is already registered, refuses execution with `REFUSED_DUPLICATE_MOBILE`.

   ---

   ## 6. Test Suite and Actual Results

   A test suite was created in `backend/src/test/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningServiceTest.java`.

   ### 6.1 Admin Provisioning Unit & Security Tests
   Command: `mvn -f backend/pom.xml test -Dtest=AdminProvisioningServiceTest`

   | Test Category | Test Name | Target Behavior | Result |
   | :--- | :--- | :--- | :---: |
   | **Successful Provisioning** | `testProvisionInitialAdmin_Success` | Creates user with `ADMIN` role, `ACTIVE` status, BCrypt hash, and audit log. | **PASS** |
   | **Existing Admin Protection** | `testRefuse_WhenActiveAdminExists` | Refuses bootstrap when an active administrator already exists in DB. | **PASS** |
   | **Existing Admin Protection** | `testRefuse_WhenSoftDeletedAdminExists` | Refuses bootstrap when a soft-deleted administrator exists in DB. | **PASS** |
   | **Existing Admin Protection** | `testRefuse_WhenJpaCountDetectsAdmin` | Refuses bootstrap when JPA fallback detects existing administrator. | **PASS** |
   | **Identity Hijacking Prevention** | `testRefuse_WhenEmailBelongsToShopOwner` | Refuses bootstrap and never overwrites or converts an existing `SHOP_OWNER`. | **PASS** |
   | **Identity Hijacking Prevention** | `testRefuse_WhenEmailBelongsToCustomer` | Refuses bootstrap and never overwrites or converts an existing `CUSTOMER`. | **PASS** |
   | **Identity Hijacking Prevention** | `testRefuse_WhenMobileAlreadyExists` | Refuses bootstrap if mobile number is already registered to another user. | **PASS** |
   | **Validation** | `testRefuse_MissingEmail` | Refuses bootstrap when email is null or whitespace. | **PASS** |
   | **Validation** | `testRefuse_InvalidEmailSyntax` | Refuses bootstrap when email does not match standard RFC format. | **PASS** |
   | **Validation** | `testRefuse_ShortPassword` | Refuses passwords shorter than 10 characters. | **PASS** |
   | **Validation** | `testRefuse_MissingComplexity` | Refuses passwords lacking uppercase, lowercase, numbers, or special chars. | **PASS** |
   | **Validation** | `testRefuse_PasswordContainsUsername` | Refuses password containing username portion of email. | **PASS** |
   | **Validation** | `testRefuse_CommonPasswords` | Refuses known common passwords (`Password123!`, etc.). | **PASS** |
   | **Audit Security** | `testMaskEmail` | Validates email masking (`o***@cakestore.com`) for log safety. | **PASS** |
   | **Audit Security** | `testNoSensitiveDataInLogs` | Verifies raw password and hash are never included in audit metadata. | **PASS** |
   | **Bootstrap Runner** | `testRunner_InvokesService` | Verifies `AdminBootstrapRunner` parses arguments and invokes service correctly. | **PASS** |

   **Summary: Tests run: 16, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS (Time: 41.34s).**

   ---

   ### 6.2 Full Authentication & Authorization Regression Test Suite
   Command: `mvn -f backend/pom.xml test -Dtest="AdminProvisioningServiceTest,BusinessTypeMappingAndPrivacyTest,RegistrationIdentityIntegrityTest,CustomerPrivacySecurityTest"`

   | Test Class | Tests Run | Failures | Errors | Result |
   | :--- | :---: | :---: | :---: | :---: |
   | `AdminProvisioningServiceTest` | 16 | 0 | 0 | **PASS** |
   | `BusinessTypeMappingAndPrivacyTest` | 14 | 0 | 0 | **PASS** |
   | `RegistrationIdentityIntegrityTest` | 17 | 0 | 0 | **PASS** |
   | `CustomerPrivacySecurityTest` | 7 | 0 | 0 | **PASS** |
   | **Total Auth Regression** | **54** | **0** | **0** | **ALL PASS** |

   **Build Result: `[INFO] BUILD SUCCESS` (Total time: 24.349s).**

   ---

   ## 7. Build and Compilation Verification

   1. **Backend Compilation:**
      - Command: `mvn -f backend/pom.xml compile`
      - Result: 355 source files compiled cleanly with `[debug parameters release 17]`.
      - Exit code: `0`.
   2. **Database Integrity:**
      - No Flyway migrations were modified or created.
      - Database schema remained unchanged; native queries operate directly on existing columns.
      - Zero production database records were modified or deleted.

   ---

   ## 8. Remaining Risks & Manual Verification Steps

   1. **Operator Credential Management:**
      - Initial credentials should be generated using an enterprise secrets manager (e.g. AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault) and injected as environment variables.
      - Operators should never commit initial passwords to repository configuration files.
   2. **First Login Verification:**
      - After running the bootstrap in production, the operator should verify that the administrator can log in via `/api/auth/login` and access `/admin` and `/api/admin/dashboard/stats`.
      - The operator should immediately verify that subsequent runs of the bootstrap tool refuse with `REFUSED_ADMIN_EXISTS`.
   3. **Automated vs. Production Clarification:**
      - **IMPORTANT:** All results reported herein reflect automated test execution against mock and local integration fixtures. **No production administrator account has been created yet.** Production provisioning must be executed by authorized operators during deployment.

   ---

   ## 9. Conclusion

   Phase AUTH-2.2 (`AUTH-FIX-02`) is **COMPLETE**. The production admin provisioning mechanism is secured, strictly controlled, disabled by default, free of hardcoded credentials, and verified by 16 passing unit and security tests.

