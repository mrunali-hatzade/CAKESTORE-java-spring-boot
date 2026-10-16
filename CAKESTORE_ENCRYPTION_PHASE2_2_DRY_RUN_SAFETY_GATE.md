# CakeStore — Phase 2.2: Dry-Run Command Safety Gate Report

**Document Version:** 1.0  
**Date:** October 2026  
**Auditor:** Antigravity AI Pair Programmer (DeepMind Advanced Agentic Coding)  
**Scope:** Strictly Read-Only Pre-Dry-Run Safety Gate Verification (Flyway, Startup Components, Credential Privileges, CLI Flags, Key Delivery)  
**Safety Protocol:** Zero database connections, zero Azure modifications, zero key generation, zero writes, zero deployments

---

## 1. Executive Summary & Formal Safety Gate Decision

### **SAFETY GATE VERDICT:** **GO FOR CONTROLLED DRY-RUN (SUBJECT TO HARDENED CLI FLAGS)**

| Operation | Gate Status | Governing Conditions |
| :--- | :--- | :--- |
| **Controlled Dry-Run (`--dry-run`)** | **APPROVED (CONDITIONAL)** | Must be executed using the hardened command with Flyway disabled (`--spring.flyway.enabled=false`), web server disabled (`--spring.main.web-application-type=none`), demo data disabled (`--app.demo-data.enabled=false`), and location seeding disabled (`--cakeplatform.locations.seed.enabled=false`). |
| **Production Write Migration (`--confirm`)** | **STRICTLY BLOCKED** | Unauthorized in this phase. |
| **Production Key Generation / Rotation** | **STRICTLY BLOCKED** | Unauthorized in this phase. |
| **Application Deployment** | **STRICTLY BLOCKED** | Unauthorized in this phase. |

This safety gate confirms that while the migration utility's internal `evaluate()` method is strictly read-only in `--dry-run` mode, the surrounding Spring application context contains startup components (specifically **Flyway** and **AdminUserInitializer**) that could execute database migrations or data modifications during boot if not explicitly suppressed on the command line.

---

## 2. Flyway Execution Risk Analysis

### 2.1 Is Flyway Enabled by Default for the Migration Utility?
- **Source Verification:** [`backend/src/main/resources/application.yml#L26-29`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L26-29)
  ```yaml
  spring:
    flyway:
      enabled: true
      baseline-on-migrate: true
      locations: classpath:db/migration
  ```
- **Context Inspection:** [`GlobalSettingsEncryptionMigrationUtility.java:L35-38`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java#L35-38)
  ```java
  @SpringBootApplication(scanBasePackages = "com.cakeplatform.api")
  @EntityScan("com.cakeplatform.api")
  @EnableJpaRepositories("com.cakeplatform.api")
  public class GlobalSettingsEncryptionMigrationUtility implements CommandLineRunner
  ```
- **Confirmed Behavior:** Because the utility is annotated with `@SpringBootApplication`, Spring Boot's auto-configuration evaluates `FlywayAutoConfiguration`. Since `spring.flyway.enabled` defaults to `true` in `application.yml`, **Flyway is fully enabled by default in the utility's application context**.

### 2.2 Could Flyway Execute Migrations Before `--dry-run` Early Return?
- **Spring Boot Lifecycle Hierarchy:**
  1. Application context initialization & Bean definitions loaded.
  2. DataSource & HikariCP connection pool initialized.
  3. **`FlywayMigrationInitializer` executes `flyway.migrate()`** against the target database.
  4. JPA / Hibernate EntityManagerFactory initializes and validates schema (`ddl-auto: validate`).
  5. Context refresh completes.
  6. **`CommandLineRunner.run()` is invoked** (where the utility checks `--dry-run`).
- **Confirmed Finding:** If any pending or unapplied Flyway migration script is present on the classpath, **Flyway will execute database DDL/DML migrations during step 3**, long before the utility reaches line 90 to evaluate `--dry-run`.
- **Safety Gate Requirement:** To ensure a truly non-destructive, read-only dry-run, Flyway **MUST be explicitly disabled via CLI argument**:
  `--spring.flyway.enabled=false`.

---

## 3. Startup Components, Schema Validation, and Write Vector Audit

A systematic source-level audit of all startup beans, runners, and initializers in `com.cakeplatform.api` was conducted to identify any potential side effects or database write vectors:

| Component | Type & Trigger | Default Behavior | Potential Side Effect / Write Vector | Mitigation in Hardened Dry-Run Command |
| :--- | :--- | :--- | :--- | :--- |
| **`Flyway`** | `FlywayMigrationInitializer` (Spring Boot Auto-config) | Executes pending migrations on boot. | **HIGH:** Executes DDL/DML migrations before utility code runs. | **`--spring.flyway.enabled=false`** |
| **`AdminUserInitializer`** | `ApplicationRunner` ([`AdminUserInitializer.java:L28-32`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/AdminUserInitializer.java#L28-32)) | Active under `@Profile("!prod")` and `app.demo-data.enabled=true`. | **CRITICAL:** Inserts/updates demo admin users, shops, and subscriptions via `jdbcTemplate.update()` and `userRepository.save()`. | **`--app.demo-data.enabled=false`** and `SPRING_PROFILES_ACTIVE=prod` |
| **`LocationDataLoader`** | `ApplicationRunner` ([`LocationDataLoader.java:L13-21`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/location/service/LocationDataLoader.java#L13-21)) | Active by default (`cakeplatform.locations.seed.enabled:true`). | **MEDIUM:** Executes location dataset reconciliation queries/inserts. | **`--cakeplatform.locations.seed.enabled=false`** |
| **`DebugRunner`** | `CommandLineRunner` ([`DebugRunner.java:L11-18`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/DebugRunner.java#L11-18)) | Active under `@Profile("!prod")`. | **LOW:** Executes `SELECT` queries on `shops`, `users`, `orders` and dumps data to stdout. | `SPRING_PROFILES_ACTIVE=prod` disables this runner completely. |
| **`CloudinaryMigrationRunner`** | `CommandLineRunner` ([`CloudinaryMigrationRunner.java:L23`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/media/CloudinaryMigrationRunner.java#L23)) | Gated by `app.migration.media.enabled=true`. | **NONE (SAFE):** Inactive by default; not triggered unless explicitly enabled. | Default property is absent/false. |
| **`StartupValidator`** | `ApplicationRunner` ([`StartupValidator.java:L12-14`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/StartupValidator.java#L12-14)) | Active under `@Profile("prod")`. | **NONE (SAFE):** In-memory check only; never writes to database. Exits JVM if required production env vars are missing. | Environment variables must be supplied. |
| **Hibernate JPA** | `LocalContainerEntityManagerFactoryBean` | `spring.jpa.hibernate.ddl-auto: validate` | **NONE (SAFE):** Strictly executes metadata catalog checks. Does not generate or execute DDL. | Preserved as `validate`. |

---

## 4. Hardened Project-Compatible Dry-Run Command

To eliminate all accidental web server startup, Flyway migration execution, demo data insertion, and background seeding, the operator must execute the following hardened command:

```bash
# 1. Export mandatory environment variables in current shell
export APP_ENCRYPTION_SECRET="<exact-16-byte-new-key>"
export DB_URL="jdbc:postgresql://<target-host>:5432/cake_platform"
export DB_USERNAME="<target-user>"
export DB_PASSWORD="<target-password>"
export SPRING_PROFILES_ACTIVE="prod"

# 2. Execute the fully hardened dry-run command
mvn -f backend/pom.xml spring-boot:run \
  -Dspring-boot.run.main-class=com.cakeplatform.api.modules.settings.migration.GlobalSettingsEncryptionMigrationUtility \
  -Dspring-boot.run.arguments="--spring.main.web-application-type=none --spring.flyway.enabled=false --app.demo-data.enabled=false --cakeplatform.locations.seed.enabled=false --dry-run"
```

### Detailed Parameter Rationale
| Parameter / Argument | Direct Technical Function |
| :--- | :--- |
| `-Dspring-boot.run.main-class=...GlobalSettingsEncryptionMigrationUtility` | Overrides `<start-class>` in `pom.xml`, invoking `GlobalSettingsEncryptionMigrationUtility.main()`, which sets the required guard `System.setProperty("migration.utility.active", "true")`. |
| `--spring.main.web-application-type=none` | Disables embedded Tomcat web server, preventing port conflicts on 8080 and eliminating HTTP attack surface. |
| `--spring.flyway.enabled=false` | **Critical safety gate.** Suppresses Flyway auto-configuration so no schema migrations can run during context boot. |
| `--app.demo-data.enabled=false` | **Critical safety gate.** Completely suppresses `AdminUserInitializer`, preventing any demo user or shop creation/updates. |
| `--cakeplatform.locations.seed.enabled=false` | Suppresses `LocationDataLoader` reconciliation queries and background loading. |
| `--dry-run` | Instructs the utility to perform in-memory ciphertext evaluation and exit immediately without invoking `saveAll()`. |

---

## 5. Least-Privileged Database Credentials for Dry-Run

### 5.1 Minimum Database Privileges Required
During `--dry-run`, the utility performs only two database actions:
1. Hibernate `ddl-auto: validate`: Queries PostgreSQL system information schemas (`information_schema`, `pg_catalog`) to verify table and column definitions.
2. `repository.findAll()`: Executes a single `SELECT` query on the `global_settings` table.

The dry-run requires **zero** write privileges (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`).

### 5.2 Recommended Read-Only Role Definition
To provide database-enforced protection against unintended writes, the operator is recommended to provision a dedicated read-only role for the dry-run:

```sql
-- 1. Create a dedicated read-only role for dry-run inspection
CREATE ROLE cakestore_dryrun WITH LOGIN PASSWORD '<secure-temporary-password>';

-- 2. Grant connection and schema access
GRANT CONNECT ON DATABASE cake_platform TO cakestore_dryrun;
GRANT USAGE ON SCHEMA public TO cakestore_dryrun;

-- 3. Grant SELECT on global_settings and existing tables for Hibernate validation
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cakestore_dryrun;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cakestore_dryrun;
```

*Defense-in-Depth Guarantee:* If the dry-run is executed using `cakestore_dryrun`, any attempted write operation—regardless of configuration error or command flag omission—will be instantly rejected by PostgreSQL with:
```text
ERROR: permission denied for table global_settings
```

---

## 6. Key Delivery & Environment Variable Verification

### 6.1 Source Code Verification of Key Delivery
- In [`GlobalSettingsEncryptionMigrationUtility.java:L67-75`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java#L67-75):
  ```java
  String newKeyEnv = System.getenv("APP_ENCRYPTION_SECRET");
  if (!StringUtils.hasText(newKeyEnv)) {
      System.err.println("ERROR: APP_ENCRYPTION_SECRET environment variable is missing or empty.");
      System.exit(1);
  }
  if (newKeyEnv.getBytes(java.nio.charset.StandardCharsets.UTF_8).length != 16) {
      System.err.println("ERROR: APP_ENCRYPTION_SECRET must be exactly 16 bytes for AES‑128.");
      System.exit(1);
  }
  ```
- **Process Inheritance:** When `mvn spring-boot:run` executes, the child JVM process inherits the OS environment variables of the calling shell.
- **Verification:** `System.getenv("APP_ENCRYPTION_SECRET")` accurately retrieves the key exported in the operator's shell.
- **Strict Byte Requirement:** If `APP_ENCRYPTION_SECRET` is not exactly 16 bytes UTF-8, the utility halts with an explicit error before connecting to the database or evaluating ciphertext.

---

## 7. Verified Source Behavior vs. Untested Runtime Assumptions

| Operational Aspect | Verified Source Code Behavior | Untested Runtime Assumption (Requires Operator Verification) |
| :--- | :--- | :--- |
| **Dry-Run Write Prevention** | Code audit verifies `dryRun` branch exits before repository save methods. | Database connection pool credentials provided by operator have correct network access to PostgreSQL. |
| **Flyway Suppression** | `--spring.flyway.enabled=false` prevents `flyway.migrate()` execution. | The target database schema currently contains the `global_settings` table (applied via Flyway V50). |
| **Demo Data Suppression** | `--app.demo-data.enabled=false` stops `AdminUserInitializer`. | Production database does not contain pre-existing corrupted data outside `global_settings`. |
| **Web Server Suppression** | `--spring.main.web-application-type=none` prevents Tomcat binding to port 8080. | The operator's execution environment has Maven 3.8+ and Java 17 installed. |
| **Output Redaction** | `printReport()` logs only field names and status enums; never prints secrets or keys. | Operator terminal recording does not log environment variable export statements containing secrets. |

---

## 8. Final Pre-Dry-Run Safety Gate Checklist

Before executing the dry-run, the authorized operator must confirm:

- [ ] **CHECK-1 (Key Export):** `APP_ENCRYPTION_SECRET` is set in the shell as an exact 16-byte UTF-8 string without printing its value to console.
- [ ] **CHECK-2 (Hardened Flags):** The CLI arguments string includes `--spring.main.web-application-type=none --spring.flyway.enabled=false --app.demo-data.enabled=false --cakeplatform.locations.seed.enabled=false --dry-run`.
- [ ] **CHECK-3 (Write Flag Omission):** `--confirm` is explicitly verified to be absent from the command line.
- [ ] **CHECK-4 (Least Privilege):** Prefer a read-only database user (`cakestore_dryrun`) for the dry-run execution where feasible.
- [ ] **CHECK-5 (Zero Deployment):** No production writes, migrations, key updates, or deployments are scheduled until dry-run output is analyzed.
