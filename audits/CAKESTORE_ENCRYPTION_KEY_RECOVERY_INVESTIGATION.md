# CakeStore — Production Encryption Key Recovery Investigation (Read-Only)

**Generated:** 2026-10-17  
**Scope:** Read-Only Investigation of Missing Production Encryption Secret & Recovery Analysis  
**Status:** Completed  
**Safety Protocol:** Zero cloud resources modified; zero database connections made; zero secrets generated, rotated, or exposed; zero application code altered.

---

## 1. Executive Summary

A critical question arose during the preparation for the `global_settings` encryption migration: **where is the production encryption key (`APP_ENCRYPTION_SECRET`), how was it provisioned, and what happens if it is missing?**

This read-only investigation analyzed the repository codebase, Git history, configuration files, and deployment artifacts to answer these questions.

### Key Takeaways
1. **Repository Implementation Gap:** Commit [`53effa1`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/StartupValidator.java#L1) introduced a production startup validation check for `APP_ENCRYPTION_SECRET` and created the migration utility, but did not document how the secret was to be generated or provisioned in [`.env.example`](file:///d:/PROJECTS/CAKE%20SAAs1/.env.example) or deployment guides.
2. **Dual Encryption State Era:**
   - **Era 1 (Pre-commit `53effa1` / commit `f14f24c`):** `EncryptionConverter` had hardcoded `@Value("")`. All secrets persisted during this period were deterministically encrypted using a 16-space ASCII fallback key (`"                "`).
   - **Era 2 (Post-commit `53effa1`):** In `prod` profile, `StartupValidator` terminates JVM on boot if `APP_ENCRYPTION_SECRET` is unset. Under default/dev profiles, it falls back to the 16-space key.
3. **Dual Credential Architecture:** In [`RazorpayService.java:34-60`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L34-L60), Razorpay credentials in `global_settings` override static container environment variables (`RAZORPAY_KEY_SECRET`). In the initial Flyway migration [`V50`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V50__create_global_settings_table.sql#L22), the secrets in `global_settings` were seeded as `NULL`.
4. **Key Recovery is Not Fatal:** Even if an intended production key was never stored or is lost, data is either:
   - Untouched (`NULL`), or
   - Decryptable via the known 16-space fallback key, or
   - Replaceable via the Admin UI / static environment variables without data loss.

---

## 2. Code-Level Inspection & Exact Line References

### 2.1 [`EncryptionConverter.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/EncryptionConverter.java)
- **Path:** `backend/src/main/java/com/cakeplatform/api/modules/settings/EncryptionConverter.java`
- **Key Injection (Lines 19–27):**
  ```java
  // We inject a static key from config. Fallback to a hardcoded 16-byte key if missing.
  private static byte[] KEY;

  @Value("${app.encryption.secret:${APP_ENCRYPTION_SECRET:}}")
  public void setSecretKey(String secret) {
      // Ensure key is exactly 16 bytes for AES-128
      String paddedKey = String.format("%-16s", secret).substring(0, 16);
      KEY = paddedKey.getBytes(StandardCharsets.UTF_8);
  }
  ```
  - If `secret` is missing, empty, or null, `paddedKey` is 16 ASCII space characters (`0x20` $\times$ 16).
  - If `secret` has between 1 and 15 characters, it is silently right-padded with spaces.
  - If `secret` has $>16$ characters, it is silently truncated to the first 16 characters.
- **Decryption Failure (Lines 50–59):**
  ```java
  try {
      String actualData = dbData.substring(4);
      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(KEY, ALGORITHM));
      byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(actualData));
      return new String(decrypted, StandardCharsets.UTF_8);
  } catch (Exception e) {
      throw new RuntimeException("Failed to decrypt database column", e);
  }
  ```
  - If decryption fails (e.g. key mismatch or padding error), it throws an uncaught `RuntimeException`. This crashes any read request (`GET /api/admin/settings` or payment signature verification) with an HTTP 500.

### 2.2 [`StartupValidator.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/config/StartupValidator.java)
- **Path:** `backend/src/main/java/com/cakeplatform/api/config/StartupValidator.java`
- **Profile Scope (Lines 11–14):**
  ```java
  @Component
  @Profile("prod")
  @Slf4j
  public class StartupValidator implements ApplicationRunner {
  ```
  - Strictly active **only** when `prod` is included in `spring.profiles.active`.
- **Validation Logic (Lines 55–58, 97–100):**
  ```java
  if (!StringUtils.hasText(encryptionSecret)) {
      log.error("CRITICAL: APP_ENCRYPTION_SECRET is missing or empty.");
      failed = true;
  }
  ...
  if (failed) {
      log.error("Production environment validation FAILED. The application will not start.");
      System.exit(1);
  }
  ```
  - Halts the JVM with exit code `1` before the application begins accepting requests if `encryptionSecret` is empty.

### 2.3 [`GlobalSettingsEncryptionMigrationUtility.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java)
- **Path:** `backend/src/main/java/com/cakeplatform/api/modules/settings/migration/GlobalSettingsEncryptionMigrationUtility.java`
- **Key Retrieval (Lines 67–75):**
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
  - Strictly requires `APP_ENCRYPTION_SECRET` to be an exact 16-byte UTF-8 string (unlike `EncryptionConverter`, the migration utility does not pad or truncate).
- **Migration Logic (Lines 78–80):**
  ```java
  StandaloneConverter oldConverter = new StandaloneConverter("                "); // 16 spaces
  StandaloneConverter newConverter = new StandaloneConverter(newKeyEnv);
  ```
  - Evaluates whether database ciphertext was encrypted with the 16-space fallback key and re-encrypts with `newKeyEnv`.

---

## 3. Configuration & Deployment Artifacts Review

| File | Line Reference | Observation |
|---|---|---|
| [`backend/src/main/resources/application.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml) | Lines 1–94 | Does not define `app.encryption.secret` or mention `APP_ENCRYPTION_SECRET`. |
| [`backend/src/main/resources/application-prod.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml) | Lines 1–73 | Defines datasource, mail, JWT, Azure storage, and Razorpay secrets, but **does not define `app.encryption.secret`**. |
| [`.env.example`](file:///d:/PROJECTS/CAKE%20SAAs1/.env.example) | Lines 1–33 | Contains `DB_*`, `JWT_*`, `RAZORPAY_*`, `CORS_*`, but **omits `APP_ENCRYPTION_SECRET`**. |
| [`backend/.env.example`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/.env.example) | Lines 1–29 | Contains backend environment variables; **omits `APP_ENCRYPTION_SECRET`**. |
| [`backend/Dockerfile`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/Dockerfile) | Lines 1–34 | Clean multistage Dockerfile. No environment variables hardcoded. |
| [`.github/workflows/ci.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/.github/workflows/ci.yml) | Lines 1–102 | Builds and runs tests against a local PostgreSQL container; pushes image to `crcakestoreprod.azurecr.io`. No Azure deployment commands or secret provisioning steps. |
| [`audits/CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md`](file:///d:/PROJECTS/CAKE%20SAAs1/audits/CAKESTORE_FINAL_DEPLOYMENT_READINESS_REPORT.md) | Lines 58–73, 168 | Checklist of required Azure Container Apps secrets: listed `DB_*`, `JWT_SECRET`, `RAZORPAY_*`, `CORS_ALLOWED_ORIGINS`, `AZURE_STORAGE_*`, but omitted `APP_ENCRYPTION_SECRET`. |

---

## 4. Git History Analysis

Git history across the repository confirms the origin and evolution of the encryption mechanism:

1. **Commit `f14f24c` (Oct 3, 2026 — `admin checked`):**
   - `EncryptionConverter.java` was first created.
   - Line 22 was hardcoded as `@Value("")`.
   - `StartupValidator.java` did **not** exist.
   - **Impact:** Any data written to `global_settings` between Oct 3, 2026, and Oct 7, 2026, was unconditionally encrypted with 16 space characters (`"                "`).
2. **Commit `53effa1` (Oct 7, 2026 — `owner dashboard logic and customer check out logic added...`):**
   - Line 22 was updated to `@Value("${app.encryption.secret:${APP_ENCRYPTION_SECRET:}}")`.
   - `StartupValidator.java` was created with `System.exit(1)` when `APP_ENCRYPTION_SECRET` is missing in `prod`.
   - `GlobalSettingsEncryptionMigrationUtility.java` was created to migrate data from 16 spaces to `APP_ENCRYPTION_SECRET`.
   - `GlobalSettingsEncryptionMigrationUtilityTest.java` was created, testing with mock key `"1234567890123456"`.
   - **Impact:** The developer intended for `APP_ENCRYPTION_SECRET` to be supplied as an external environment variable in production, but did not update documentation or configuration templates.

---

## 5. Startup & Key Resolution Behavior by Profile

The following table summarizes how the application behaves on boot across different Spring profiles when `APP_ENCRYPTION_SECRET` is either absent or present:

| Profile Active | `APP_ENCRYPTION_SECRET` Value | `StartupValidator` Executed? | Boot Result | Key Used by `EncryptionConverter` |
|---|---|---|---|---|
| **Default / None** | Unset or Empty | **No** (Validator is `@Profile("prod")`) | **Success (Boot UP)** | **16-Space Fallback** (`"                "`) |
| **Default / None** | Non-Empty (e.g. 16 chars) | **No** | **Success (Boot UP)** | Padded/truncated key |
| **`dev` or `test`** | Unset or Empty | **No** | **Success (Boot UP)** | **16-Space Fallback** (`"                "`) |
| **`prod`** | **Unset or Empty** | **Yes** | **FAIL (`System.exit(1)`)** | N/A (App terminates during ApplicationRunner phase) |
| **`prod`** | **Non-Empty String** | **Yes** (`StringUtils.hasText` = true) | **Success (Boot UP)** | Padded/truncated key |

> [!IMPORTANT]
> If the live Azure Container App is currently in the `Running` state under `SPRING_PROFILES_ACTIVE=prod`, then `StartupValidator` must have passed during its last container start. That means `APP_ENCRYPTION_SECRET` was populated in Azure Container Apps when that container booted.  
> If the container is in a CrashLoopBackOff or if `SPRING_PROFILES_ACTIVE` was never set to `prod`, the 16-space fallback key is in use.

---

## 6. Known Facts vs. Unknowns

### Known Facts (Repository-Verified)
1. **Fact 1:** The repository code never hardcoded an actual production key secret.
2. **Fact 2:** The fallback key is exactly 16 ASCII space characters (`0x20` $\times$ 16).
3. **Fact 3:** Database table `global_settings` was initialized in Flyway migration `V50` with `razorpay_key_secret = NULL` and `razorpay_webhook_secret = NULL`.
4. **Fact 4:** In [`RazorpayService.java:50-60`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L50-L60), if `global_settings` secrets are `NULL` or blank, the system automatically falls back to static container environment variables `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.
5. **Fact 5:** `GlobalSettingsEncryptionMigrationUtility` is designed to migrate existing 16-space ciphertext to a new 16-byte key without losing data.
6. **Fact 6:** No secrets or database URLs are present in the local shell environment.

### Unknowns (Requires Azure Portal / Read-Only Inspection)
1. **Unknown 1:** Does Azure Container Apps have a secret named `app-encryption-secret` (or an alternative name) currently registered?
2. **Unknown 2:** What is the current `ProvisioningState` and `Running` status of the `cakestore-api` container app in Azure?
3. **Unknown 3:** What was logged during the last container startup in `ContainerAppConsoleLogs_CL`?
4. **Unknown 4:** Has an administrator ever saved custom Razorpay credentials via the Admin UI, or do the `global_settings` table columns remain `NULL`?

---

## 7. Azure Configuration Locations for Operator Inspection

An authorized operator should inspect the following Azure resources **manually (read-only)** to verify whether the intended key exists:

```
Azure Portal
│
├── 1. Container Apps -> [cakestore-api]
│   ├── Settings -> Secrets
│   │   └── Check for: 'app-encryption-secret', 'encryption-secret', or similar.
│   │       (Do not click the 'reveal' eye icon unless necessary).
│   │
│   ├── Settings -> Configuration -> Containers -> Environment Variables
│   │   └── Check if 'APP_ENCRYPTION_SECRET' is listed.
│   │       Check whether 'SPRING_PROFILES_ACTIVE' is 'prod'.
│   │
│   ├── Monitoring -> Log stream / Log Analytics (ContainerAppConsoleLogs_CL)
│   │   └── Search query: ContainerAppConsoleLogs_CL | where Log_s contains "StartupValidator"
│   │       Check for "Production environment validation PASSED" vs "CRITICAL".
│   │
│   └── Application -> Revision Management
│       └── Note the active revision name and container image tag.
│
├── 2. Key Vault (if present in subscription / resource group)
│   └── Objects -> Secrets
│       └── Check for any secret containing 'encryption', 'aes', or 'cakestore'.
│
└── 3. Azure Database for PostgreSQL (Flexible Server)
    └── Settings -> Networking
        └── Check firewall / VNet rules to understand dry-run connectivity.
```

> [!NOTE]
> **Do not claim the key is lost merely because the exact secret name `app-encryption-secret` is not found.** The environment variable in ACA may be bound to a secret named differently (e.g. `encryption-key`, `app-secret`, `backend-secrets`).

---

## 8. Potential Risks if the Original Key is Permanently Lost

If an intended production key was set in the past, used to encrypt data, and subsequently lost permanently without backup, the potential risks are evaluated below:

| Component | Consequence if Key is Lost | Severity | Mitigating Factor |
|---|---|---|---|
| **User Passwords** | **None.** Passwords use BCrypt hashing (`PasswordEncoder`), not AES encryption. | None | Completely unaffected. |
| **JWT Tokens** | **None.** JWT uses `JWT_SECRET` (HMAC-SHA256). | None | Completely unaffected. |
| **Customer Orders & Bakeries** | **None.** Orders, products, shops, and reviews do not use `EncryptionConverter`. | None | Completely unaffected. |
| **`global_settings.platform_name` & `currency`** | **None.** Stored as plaintext VARCHAR columns. | None | Completely unaffected. |
| **`global_settings.razorpay_key_secret`** | If encrypted with the lost key, reading it will throw `RuntimeException` in `EncryptionConverter.convertToEntityAttribute()`. | **MEDIUM** | If unrecoverable, an admin or operator can overwrite the row with fresh Razorpay credentials from the Razorpay Dashboard. |
| **Payment Signature Verification** | If `global_settings.razorpay_key_secret` is throwing decryption errors, `RazorpayService.getActiveKeySecret()` crashes with HTTP 500. | **HIGH (if corrupted)** | If the corrupted field is cleared (set to `NULL`), `RazorpayService` seamlessly falls back to static `RAZORPAY_KEY_SECRET`. |

---

## 9. Safe Recovery Decision Tree

```
                                  [START INVESTIGATION]
                                            |
                                            v
                       Check Azure Container App Secrets & Logs
                                            |
                     +----------------------+----------------------+
                     |                                             |
             [Secret Found in ACA]                       [Secret NOT in ACA]
                     |                                             |
                     v                                             v
        Verify StartupValidator Log                    Check Running Container Status
                     |                                             |
          +----------+----------+                        +---------+---------+
          |                     |                        |                   |
      [PASSED]              [CRASH/FAIL]            [Running OK]        [Crashing]
          |                     |                        |                   |
          v                     v                        v                   v
   Key is ACTIVE        Secret configured       App running under       Container is
  in production!         invalidly (e.g.         non-prod profile       failing boot.
  Export key to          empty string).          OR using image         Needs valid
  dry-run shell.        Fix secret in ACA.       with 16-space key.     16-byte key.
          |                                              |                   |
          +---------------------+------------------------+                   |
                                |                                            |
                                v                                            |
                Inspect Database Row (Read-Only)                             |
                                |                                            |
               +----------------+----------------+                           |
               |                                 |                           |
      [Columns are NULL]              [Columns have "ENC:..."]               |
               |                                 |                           |
               v                                 v                           |
       NO DATA TO MIGRATE!           Test Decryption with Keys:              |
      Database is in initial         1. Try ACA key                          |
      state. Safe to adopt           2. Try 16-space fallback key            |
      any new 16-byte key.                       |                           |
                                                 |                           |
                              +------------------+------------------+        |
                              |                                     |        |
                     [Decrypts with Old]                   [Decrypts with ACA]
                              |                                     |
                              v                                     v
                     Run Migration Utility                 ALREADY MIGRATED!
                     to re-encrypt with                    No migration needed.
                     the production key.                   Status: OK.
```

---

## 10. Exact Next Action Recommended Before Any Production Change

### Step 1: Azure Read-Only Inspection (Human Operator)
The authorized operator should execute the following non-intrusive metadata check via Azure CLI or Portal:
```bash
# 1. List all secret names in the Container App (reveals NO values):
az containerapp secret list \
  --name <container-app-name> \
  --resource-group <resource-group-name> \
  --output table

# 2. Check container environment variable mappings:
az containerapp show \
  --name <container-app-name> \
  --resource-group <resource-group-name> \
  --query "properties.template.containers[0].env[?name=='APP_ENCRYPTION_SECRET' || name=='SPRING_PROFILES_ACTIVE']" \
  --output json

# 3. Check recent startup logs for StartupValidator:
az containerapp logs show \
  --name <container-app-name> \
  --resource-group <resource-group-name> \
  --filter "StartupValidator" \
  --tail 50
```

### Step 2: Establish the Database State
Before generating or rotating any keys, execute a read-only query on the database using a dedicated read-only role (`cakestore_dryrun`):
```sql
SELECT id, 
       platform_name, 
       razorpay_key_id, 
       CASE 
         WHEN razorpay_key_secret IS NULL THEN 'NULL'
         WHEN razorpay_key_secret LIKE 'ENC:%' THEN 'ENCRYPTED'
         ELSE 'PLAINTEXT'
       END AS key_secret_state,
       CASE 
         WHEN razorpay_webhook_secret IS NULL THEN 'NULL'
         WHEN razorpay_webhook_secret LIKE 'ENC:%' THEN 'ENCRYPTED'
         ELSE 'PLAINTEXT'
       END AS webhook_secret_state
FROM global_settings 
WHERE id = 1;
```
- **If `key_secret_state` is `'NULL'`:** No encrypted secrets exist in the database. The system is operating entirely on the static `RAZORPAY_KEY_SECRET` environment variable. The operator may generate a brand new 16-byte `APP_ENCRYPTION_SECRET` and configure it in ACA with zero risk of breaking existing data.
- **If `key_secret_state` is `'ENCRYPTED'`:** The operator runs the migration utility in `--dry-run` mode with the candidate keys (the 16-space key and/or the ACA key) to identify which key unlocks the ciphertext.

### Conclusion
**Do not execute writes, do not rotate keys, and do not redeploy the application until the operator completes Step 1 and Step 2 above.**
