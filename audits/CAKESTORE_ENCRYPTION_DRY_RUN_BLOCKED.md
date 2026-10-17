# CakeStore — Controlled Encryption Dry-Run Blocked Report

**Document Version:** 1.0  
**Date:** October 2026  
**Auditor:** Antigravity AI Pair Programmer (DeepMind Advanced Agentic Coding)  
**Execution Phase:** Phase B — Hard Safety Gate Evaluation  
**Status:** **EXECUTION SAFELY BLOCKED — HARD SAFETY GATE HALTED**  
**Safety Protocol:** Zero database writes, zero key generation, zero production connections, zero secret disclosures, zero deployments

---

## 1. Executive Summary & Safety Gate Verdict

In accordance with the mandatory safety protocol defined in the Phase 2, Phase 2.1, and Phase 2.2 audit reports, a rigorous preflight inspection and Hard Safety Gate evaluation was performed prior to executing the controlled encryption dry-run.

### **Gate Verdict:** **EXECUTION SAFELY BLOCKED**

The dry-run execution has been **intentionally halted** by the Phase B Hard Safety Gate. Execution cannot and must not proceed automatically because essential operator-controlled security prerequisites are absent from the local execution environment:
1. **Missing Encryption Key:** `APP_ENCRYPTION_SECRET` is not defined in the operating system environment.
2. **Missing Database Target:** `DB_URL` is not defined in the environment; no target database has been explicitly identified or authorized for this session.
3. **Missing Read-Only Credentials:** A dedicated read-only database role (`cakestore_dryrun`) has not yet been provisioned or supplied.

In strict adherence to the non-negotiable safety rules:
- **No keys were generated, guessed, or mocked.**
- **No secrets were requested to be pasted into chat.**
- **No default or insecure fallback connections were attempted.**
- **No production systems or Azure resources were touched.**

This document details the exact preflight findings, itemizes the blocked conditions, and provides a clear runbook for the authorized operator to satisfy these prerequisites safely.

---

## 2. Phase A — Preflight Checks & Source Verification

### 2.1 Repository, Utility, and Toolchain Verification
- **Java Version:** Verified as `Java 17.0.17 LTS (Oracle Corporation, build 17.0.17+8-LTS-360)`. Matches project target (`<java.version>17</java.version>`).
- **Maven Version:** Verified as `Apache Maven 3.9.16`. Compatible with Spring Boot 3.3.2 build requirements.
- **Utility Entry Point:** Confirmed in [`GlobalSettingsEncryptionMigrationUtility.java:L46-49`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java#L46-49). Must be invoked explicitly via `-Dspring-boot.run.main-class=com.cakeplatform.api.modules.settings.migration.GlobalSettingsEncryptionMigrationUtility` to set `migration.utility.active=true` before Spring application context boots.

### 2.2 Hardened Command-Line Flags
Source inspection confirms the following exact flags are required to suppress background startup side effects:
- `--spring.main.web-application-type=none`: Disables embedded Tomcat web server.
- `--spring.flyway.enabled=false`: Disables Flyway migrations so no DDL/DML can run on boot.
- `--app.demo-data.enabled=false`: Disables `AdminUserInitializer`, preventing any demo user/shop database mutations.
- `--cakeplatform.locations.seed.enabled=false`: Disables `LocationDataLoader` reconciliation queries and background loading.
- `--dry-run`: Activates the utility's read-only inspection branch.

### 2.3 Key Delivery Mechanism
- In [`GlobalSettingsEncryptionMigrationUtility.java:L67-75`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java#L67-75), the utility retrieves the key exclusively via `System.getenv("APP_ENCRYPTION_SECRET")`.
- It strictly enforces `newKeyEnv.getBytes(StandardCharsets.UTF_8).length == 16`. If missing or not exactly 16 bytes, it terminates immediately with `System.exit(1)`.

### 2.4 Backup & PITR Evidence
- Consistent with [`CAKESTORE_ENCRYPTION_PHASE2_PRODUCTION_READINESS.md`](file:///d:/PROJECTS/CAKE%20SAAs1/CAKESTORE_ENCRYPTION_PHASE2_PRODUCTION_READINESS.md), automated backup retention and PITR windows for Azure PostgreSQL remain **unverified in repository artifacts**. Independent physical/logical backups have not been confirmed by the operator.

---

## 3. Phase B — Hard Safety Gate Condition Checklist

| Condition | Verification Requirement | Current Status | Detailed Finding |
| :--- | :--- | :--- | :--- |
| **1. Target Database Explicitly Identified** | Connection target must be confirmed (production vs staging vs local). | **FAILED / MISSING** | `DB_URL` environment variable is not defined in the shell environment. |
| **2. Intended Key Available & Validated** | `APP_ENCRYPTION_SECRET` must be set in OS environment and be exactly 16 bytes. | **FAILED / MISSING** | `APP_ENCRYPTION_SECRET` is not defined in the shell environment. (Never generate or guess keys). |
| **3. Database Connection Verified** | JDBC string verified to point to target environment with SSL enabled. | **FAILED / MISSING** | Cannot verify target environment because no connection string is present. |
| **4. Read-Only Account Available** | Dedicated least-privileged user with only `SELECT` privileges. | **FAILED / MISSING** | Read-only credentials have not been configured or supplied. |
| **5. Hardened Command Reviewed** | All suppression flags reviewed against source code. | **PASSED** | Reviewed and verified in [`CAKESTORE_ENCRYPTION_PHASE2_2_DRY_RUN_SAFETY_GATE.md`](file:///d:/PROJECTS/CAKE%20SAAs1/CAKESTORE_ENCRYPTION_PHASE2_2_DRY_RUN_SAFETY_GATE.md). |
| **6. Write Flag Omitted** | `--dry-run` present, `--confirm` absent. | **PASSED** | Verified in command design. |
| **7. Startup Side Effects Suppressed** | Flyway, web server, demo data, and location seeding disabled. | **PASSED** | Hardened CLI parameters established. |

**Gate Result:** 4 out of 7 mandatory conditions are unsatisfied. Execution is strictly blocked.

---

## 4. Operator Resolution Runbook

To enable execution of the controlled dry-run, the authorized human operator must perform the following setup steps out-of-band in their secure terminal:

### Step 1: Provision Least-Privileged Read-Only Role (Recommended)
On the target PostgreSQL database, create a dedicated read-only user for the dry-run:
```sql
-- Connect as postgres administrator
CREATE ROLE cakestore_dryrun WITH LOGIN PASSWORD '<secure-read-only-password>';
GRANT CONNECT ON DATABASE cake_platform TO cakestore_dryrun;
GRANT USAGE ON SCHEMA public TO cakestore_dryrun;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cakestore_dryrun;
```

### Step 2: Export Required Environment Variables Out-of-Band
In the operator's execution shell, set the environment variables without echoing or logging sensitive values:
```bash
# 1. Export the production 16-byte AES key (must be exactly 16 bytes UTF-8)
export APP_ENCRYPTION_SECRET="<exact-16-byte-production-key>"

# 2. Export database connection details pointing to target environment
export DB_URL="jdbc:postgresql://<target-host>:5432/cake_platform?sslmode=require"
export DB_USERNAME="cakestore_dryrun"
export DB_PASSWORD="<secure-read-only-password>"

# 3. Set production profile
export SPRING_PROFILES_ACTIVE="prod"
```

### Step 3: Execute the Hardened Controlled Dry-Run
Run the approved, hardened Maven command from the repository root:
```bash
mvn -f backend/pom.xml spring-boot:run \
  -Dspring-boot.run.main-class=com.cakeplatform.api.modules.settings.migration.GlobalSettingsEncryptionMigrationUtility \
  -Dspring-boot.run.arguments="--spring.main.web-application-type=none --spring.flyway.enabled=false --app.demo-data.enabled=false --cakeplatform.locations.seed.enabled=false --dry-run"
```

### Step 4: Verify Dry-Run Output
Review the console output for the summary block:
```text
--- Migration Report (dry-run) ---
razorpay_key_secret: <STATUS>
razorpay_webhook_secret: <STATUS>
Dry-run complete – no database modifications performed.
```
Capture the status enums (`ENC_NEEDS_MIGRATION`, `ENC_ALREADY_MIGRATED`, `PLAINTEXT`, `NULL`, `BLANK`, or `MIGRATION_FAILED`) and document them in the post-execution results report.

---

## 5. Absolute Safety Confirmation

- **No writes attempted:** Zero database connections or write operations were initiated.
- **No keys created:** No synthetic, dev, or mock encryption keys were generated or configured.
- **No secrets exposed:** No sensitive data, connection strings, or credentials were logged or included in reports.
- **No infrastructure touched:** Azure resources, deployment pipelines, and database records remain entirely untouched.
- **Integrity preserved:** The codebase remains completely compliant with mandatory safety constraints.
