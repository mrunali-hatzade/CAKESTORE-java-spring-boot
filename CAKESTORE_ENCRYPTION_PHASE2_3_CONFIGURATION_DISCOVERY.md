# CakeStore — Phase 2.3: Production Configuration Discovery Report

**Generated:** 2026-10-17  
**Scope:** Read-Only Investigation of Production Encryption Key and Database Configuration  
**Status:** Completed (Strict Read-Only Discovery)  
**Safety Harbor:** Zero cloud resources modified; zero database connections established; zero secrets generated or exposed; zero application code changed.

---

## Executive Summary

Phase 2.3 conducted a read-only investigation into how and where the production encryption key (`APP_ENCRYPTION_SECRET`) and database credentials (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`) are managed across the CakeStore repository, deployment configurations, and target Azure infrastructure.

The investigation confirmed:
1. **Target Architecture:** The backend container (`crcakestoreprod.azurecr.io/cakestore-api`) is deployed to **Azure Container Apps (ACA)**, connected to **Azure Database for PostgreSQL (Flexible Server)**.
2. **Encryption Key Resolution:** `EncryptionConverter` and `StartupValidator` resolve `app.encryption.secret` directly from the OS environment variable `APP_ENCRYPTION_SECRET`. In ACA, this is designed to be injected via Container App Secrets.
3. **Repository Omission:** The initial deployment readiness checklist (`CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md`) omitted `APP_ENCRYPTION_SECRET` while specifying other secrets (`JWT_SECRET`, `RAZORPAY_*`, `DB_*`). Consequently, whether `APP_ENCRYPTION_SECRET` was ever populated in Azure Container Apps requires operator verification in the Azure Portal or via Azure CLI.
4. **Zero-Knowledge Verification:** An authorized operator can verify the existence and validity of `APP_ENCRYPTION_SECRET` without revealing or exposing the secret value.

---

## 1. Where the Production Encryption Key is Expected to Be Configured

### 1.1 Code-Level Resolution Path
The CakeStore backend resolves the encryption key through three independent components:

| Component | Code Location | Resolution Mechanism | Behavior if Missing |
|---|---|---|---|
| [`EncryptionConverter`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/EncryptionConverter.java#L22-L27) | `modules/settings/EncryptionConverter.java:22` | `@Value("${app.encryption.secret:${APP_ENCRYPTION_SECRET:}}")` | Insecure fallback: pads empty string with 16 spaces (`"                "`). |
| [`StartupValidator`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/StartupValidator.java#L16-L58) | `config/StartupValidator.java:16` | `@Value("${app.encryption.secret:${APP_ENCRYPTION_SECRET:}}")` | Under `@Profile("prod")`: logs critical error and invokes `System.exit(1)`. |                      
| [`GlobalSettingsEncryptionMigrationUtility`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java#L67-L75) | `modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java:67` | `System.getenv("APP_ENCRYPTION_SECRET")` | Halts with `System.exit(1)` if missing, empty, or not exactly 16 bytes UTF-8. |

### 1.2 Configuration Files (`application.yml` and `application-prod.yml`)
- Neither [`application.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml) nor [`application-prod.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml) declares `app.encryption.secret`.
- Spring Boot falls back to evaluating standard OS environment variable bindings: `APP_ENCRYPTION_SECRET`.
          
### 1.3 Expected Azure Container Apps Infrastructure Mapping
In Azure Container Apps, sensitive application properties must be configured as:
1. **Container App Secret:**
   - Secret Name: `app-encryption-secret`
   - Value: 16-byte random string (or key vault reference)
2. **Container Environment Variable:**
   - Name: `APP_ENCRYPTION_SECRET`
   - Value Source: `Secret reference` pointing to `app-encryption-secret`

---

## 2. Where the Production Database Connection is Expected to Be Configured

### 2.1 Code & Profile Configuration
In [`application-prod.yml:1-12`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml#L1-L12):
```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: ${DB_POOL_MAX_SIZE:20}
      minimum-idle: ${DB_POOL_MIN_IDLE:5}
      idle-timeout: ${DB_POOL_IDLE_TIMEOUT:30000}
      max-lifetime: ${DB_POOL_MAX_LIFETIME:1800000}
      connection-timeout: ${DB_POOL_CONN_TIMEOUT:20000}
```

### 2.2 Expected Azure Infrastructure Mapping
The production database is hosted on **Azure Database for PostgreSQL (Flexible Server)**:
- `DB_URL`: JDBC connection string with enforced SSL:
  `jdbc:postgresql://<server-name>.postgres.database.azure.com:5432/cake_platform?sslmode=require`
- `DB_USERNAME`: Database administrator or service account (e.g., `cakeadmin`).
- `DB_PASSWORD`: Managed as an ACA Secret reference `secretref:db-password`.
- **Network Boundaries:** Azure PostgreSQL Flexible Server firewall rules (allowing Azure Services or restricted to ACA virtual network/subnet).

---

## 3. Confirmed Facts vs. Items Requiring Azure Portal Verification

### 3.1 Facts Confirmed by Repository Evidence

| Item | Evidence | Confirmed Fact |
|---|---|---|
| **Container Registry** | [`.github/workflows/ci.yml:82-95`](file:///d:/PROJECTS/CAKE%20SAAs1/.github/workflows/ci.yml#L82-L95) | Production images are pushed to Azure Container Registry `crcakestoreprod.azurecr.io/cakestore-api`. |
| **Active Profile Variable** | [`audits/CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md:72`](file:///d:/PROJECTS/CAKE%20SAAs1/audits/CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md#L72) | Production deployment requires `SPRING_PROFILES_ACTIVE=prod`. |
| **Startup Gate** | [`StartupValidator.java:12, 55-58`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/StartupValidator.java#L12-L58) | If `SPRING_PROFILES_ACTIVE=prod` is active, the application will terminate immediately upon boot if `APP_ENCRYPTION_SECRET` is missing. |
| **Fallback Mechanism** | [`EncryptionConverter.java:22-26`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/EncryptionConverter.java#L22-L26) | If `StartupValidator` does not run (non-prod profile or earlier commit `f14f24c`), missing secret defaults to 16 spaces. |
| **Documentation Gap** | [`audits/CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md:58-72, 168`](file:///d:/PROJECTS/CAKE%20SAAs1/audits/CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md#L58-L72) | The pre-deployment documentation listed `DB_*`, `JWT_SECRET`, `RAZORPAY_*`, `CORS_ALLOWED_ORIGINS`, and `AZURE_STORAGE_*`, but omitted `APP_ENCRYPTION_SECRET`. |
| **Local Environment State** | Local Shell Environment Check (`CAKESTORE_ENCRYPTION_DRY_RUN_BLOCKED.md`) | Neither `APP_ENCRYPTION_SECRET` nor `DB_URL` exists in the local development workstation environment. |

### 3.2 Items Requiring Authorized Operator Verification in Azure Portal

| Item | Azure Resource | Verification Required | Risk if Unchecked |
|---|---|---|---|
| **1. Secret Existence** | Azure Container App → Secrets | Check whether secret `app-encryption-secret` exists. | If missing, the app was either never started under `prod` or was started with an older container image before `StartupValidator` was introduced. |
| **2. Container Env Binding** | Azure Container App → Configuration → Containers → Env Vars | Confirm `APP_ENCRYPTION_SECRET` is defined and references the secret. | App may be running without the environment variable bound. |
| **3. Container App Status & Logs** | Azure Container App → Log stream / Log Analytics (`ContainerAppConsoleLogs_CL`) | Verify if the current container instance is in `Running` state and check startup logs for: `Production environment validation PASSED.` vs crash loop. | If the container is crashing on boot, live payment webhooks and settings are down. |
| **4. Active Revision & Image Tag** | Azure Container App → Revision management | Check which image tag/commit is currently serving traffic. | If running an image prior to `StartupValidator`, secrets in the DB might have been encrypted using the 16-space fallback. |
| **5. Database Network Policy** | Azure Database for PostgreSQL → Networking | Check firewall rules, Private Endpoints, or VNet integration. | Determines whether the migration utility dry-run can connect from an external bastion or requires running from within the VNet. |
| **6. Database PITR & Backups** | Azure Database for PostgreSQL → Backup + Restore | Confirm automated backups are enabled and PITR window is healthy. | Required prerequisite before any write operations. |

---

## 4. Verifying Existing Key Availability Without Revealing It

An authorized operator can verify whether `APP_ENCRYPTION_SECRET` is configured and valid **without exposing, printing, or logging the plaintext secret value**.

### 4.1 Method A: Azure Portal Secrets Blade (Zero-Exposure)
1. Navigate to the **Azure Portal** -> **Container Apps** -> select the CakeStore backend container app.
2. Under **Settings**, select **Secrets**.
3. Verify that an entry exists for `app-encryption-secret`.
4. The value is masked (`••••••••••••`). **Do not click the view icon.** The presence of the row confirms the secret is registered in Azure Container Apps.

### 4.2 Method B: Azure CLI Metadata Query (Zero Value Disclosure)
Run the following Azure CLI command in an authorized terminal. This query filters strictly on the secret's metadata name and outputs nothing if missing:
```bash
az containerapp secret list \
  --name <container-app-name> \
  --resource-group <resource-group-name> \
  --query "[?name=='app-encryption-secret'].name" \
  --output tsv
```
- **If output is `app-encryption-secret`:** The secret exists. No plaintext is retrieved or transmitted.
- **If output is empty:** The secret is not configured in Container Apps.

### 4.3 Method C: Container App Startup Log Inspection
In Log Analytics or Container App log stream:
Filter logs for `StartupValidator`:
```kusto
ContainerAppConsoleLogs_CL
| where Log_s contains "StartupValidator"
| project TimeGenerated, Log_s
| order by TimeGenerated desc
| take 20
```
- If the log displays:
  `INFO ... com.cakeplatform.api.config.StartupValidator : Production environment validation PASSED.`
  **This confirms that `APP_ENCRYPTION_SECRET` is populated and non-empty in the running production container**, without ever revealing the key string.
- If the log displays:
  `ERROR ... CRITICAL: APP_ENCRYPTION_SECRET is missing or empty.`
  The container failed validation on boot.

### 4.4 Method D: Non-Printing Length Verification (In Secure Shell)
If an operator has exported `APP_ENCRYPTION_SECRET` in an isolated administrative terminal and needs to verify that it meets the exact 16-byte AES-128 requirement without echoing it to the console or bash history:
```bash
# In Linux / Bash:
printf "%s" "$APP_ENCRYPTION_SECRET" | wc -c
# Expected output: 16
```
```powershell
# In Windows PowerShell:
[System.Text.Encoding]::UTF8.GetByteCount($env:APP_ENCRYPTION_SECRET)
# Expected output: 16
```
This returns the exact byte count without echoing the key to stdout or history.

---

## 5. Safest Next Action for the Operator

To maintain zero risk to production data, the operator should proceed with the following ordered sequence:

```
+-------------------------------------------------------------------------------+
| Step 1: Azure Portal / CLI Secret Inspection (Method 4.1 or 4.2)             |
| Check if 'app-encryption-secret' is registered in Azure Container Apps.       |
+---------------------------------------+---------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
            [Secret Exists]                           [Secret Missing]
                   |                                         |
                   v                                         v
+-------------------------------------+   +-------------------------------------+
| Step 2: Check ACA Startup Logs      |   | Step 2B: Investigate Deployment Tag |
| Verify if 'StartupValidator PASSED' |   | App may be running older image with |
| or if fallback key was utilized.    |   | 16-space fallback encryption.       |
+------------------+------------------+   +------------------+------------------+
                   |                                         |
                   +--------------------+--------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 3: Create Dedicated Read-Only DB Credential                             |
| Provision temporary DB role 'cakestore_dryrun' with SELECT ONLY on           |
| 'global_settings'. Enforces database engine-level write immunity.             |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 4: Run Hardened Dry-Run Out-of-Band                                     |
| On a secure bastion/admin machine with read-only DB credentials and           |
| the production APP_ENCRYPTION_SECRET:                                         |
|                                                                               |
|   mvn test-compile exec:java \                                                |
|     -Dexec.mainClass="com.cakeplatform.api.modules.settings.migration.GlobalSettingsEncryptionMigrationUtility" \
|     -Dexec.args="--dry-run" \                                                 |
|     -Dspring.main.web-application-type=none \                                 |
|     -Dspring.flyway.enabled=false \                                           |
|     -Dspring.jpa.hibernate.ddl-auto=none                                     |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 5: Evaluate Dry-Run Output                                               |
| - If current secrets decrypt with fallback key -> plan migration.             |
| - If current secrets decrypt with production key -> already migrated!         |
+-------------------------------------------------------------------------------+
```

### Immediate Action Item
**The operator should log into the Azure Portal or use the Azure CLI to perform Step 1 (verify secret registration in Container Apps) and Step 2 (review `StartupValidator` logs).** No code changes or dry-run execution should occur until this configuration discovery is verified by an authorized human operator.
