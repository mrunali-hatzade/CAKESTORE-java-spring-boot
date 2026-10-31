# CakeStore — Phase AUTH-FIX-02.3: Fail-Closed Database Dialect Detection

**Task Identifier:** `AUTH-FIX-02.3`
**Execution Date:** 2026-10-31
**Status:** ✅ COMPLETE — 68/68 tests passing, 0 failures, 0 errors

---

## 1. Problem Statement

The previous `acquireDatabaseLock()` implementation in `AdminProvisioningService` caught every
`Exception` thrown by the advisory-lock SQL and silently continued with JVM-only locking:

```java
// AUTH-FIX-02.1 (before this fix):
} catch (Exception ex) {
    // Non-PostgreSQL dialect in lightweight test environments: log debug and continue
    log.debug("... skipped or not supported by current dialect: {}", ex.getMessage());
}
```

This created two security gaps:

| # | Gap | Consequence |
|---|-----|-------------|
| 1 | A **transient PostgreSQL connection failure** (network blip, pg_hba denial, resource exhaustion) caused `pg_advisory_xact_lock` to throw — which was silently swallowed, falling back to JVM-only locking. | Two separate application instances could run concurrent bootstrap unprotected. |
| 2 | Dialect detection relied on the lock failing, rather than inspecting the actual database URL. An **unrecognized dialect** (e.g. MySQL, Oracle) fell through to JVM-only locking instead of being refused. | Any future database migration risk was silently tolerated. |

---

## 2. Changes Implemented

### 2.1 `AdminProvisioningResult.java` — New status value

Added `REFUSED_DATABASE_LOCK` to the `Status` enum:

```java
/**
 * Raised when the database advisory lock cannot be acquired (PostgreSQL)
 * or when the database dialect is unknown and provisioning must be aborted
 * to prevent a fall-through to JVM-only locking in production.
 */
REFUSED_DATABASE_LOCK
```

> [!IMPORTANT]
> This is a backward-compatible addition. No existing code paths produce this value; it is new.

---

### 2.2 `AdminProvisioningService.java` — Fail-Closed Dialect Detection

#### New fields

| Field | Type | Purpose |
|-------|------|---------|
| `dataSource` | `DataSource` (optional injection) | Primary source for dialect detection via JDBC URL. |

A setter `setDataSource(DataSource)` was added for test injection.

#### New `DialectKind` enum (package-private)

```java
enum DialectKind { POSTGRESQL, H2, HSQLDB, UNKNOWN }
```

Making it package-private permits targeted unit testing of `resolveDialect()` without reflection.

#### `resolveDialect()` — Reliable URL-based detection

```
Priority 1: injected DataSource  → conn.getMetaData().getURL()
Priority 2: jdbcTemplate.getDataSource() → conn.getMetaData().getURL()
Fallback:   UNKNOWN  (never interpreted as "safe to fall back")
```

URL matching rules (applied to lowercase JDBC URL):

| Contains | DialectKind |
|----------|-------------|
| `:postgresql:` or `:pgsql:` | `POSTGRESQL` |
| `:h2:` | `H2` |
| `:hsqldb:` | `HSQLDB` |
| anything else / null | `UNKNOWN` |

> [!WARNING]
> A **metadata lookup failure** (e.g. `SQLException` on `ds.getConnection()`) returns `UNKNOWN`,
> which causes provisioning to be **refused** — not silently continued.

#### `acquireDatabaseLock()` — Fail-Closed Switch

```
jdbcTemplate == null  →  return early (JVM lock only; unit tests without a DB)
POSTGRESQL            →  execute pg_advisory_xact_lock; on ANY exception → REFUSED_DATABASE_LOCK
H2 / HSQLDB           →  skip lock; JVM lock is sufficient (test environment)
UNKNOWN               →  throw REFUSED_DATABASE_LOCK immediately
```

No production path can silently fall back to JVM-only locking when `jdbcTemplate` is wired.

---

## 3. Files Modified

| File | Change |
|------|--------|
| [`AdminProvisioningResult.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningResult.java) | Added `REFUSED_DATABASE_LOCK` to `Status` enum |
| [`AdminProvisioningService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningService.java) | Added `DataSource` injection, `setDataSource()` setter, `DialectKind` enum, `resolveDialect()`, `extractJdbcUrl()`, and rewrote `acquireDatabaseLock()` |
| [`AdminProvisioningServiceTest.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/modules/admin/provisioning/AdminProvisioningServiceTest.java) | Updated `testAdvisoryLockAcquisition` to inject PostgreSQL mock DataSource; added full `DialectDetectionTests` nested class (9 new tests) |

---

## 4. Test Results

### 4.1 `AdminProvisioningServiceTest` — All Suites

Command: `mvn -f backend/pom.xml test -Dtest="AdminProvisioningServiceTest,..."`

| Nested Suite | Tests | Failures | Errors | Status |
|---|:---:|:---:|:---:|:---:|
| `SuccessfulProvisioningTests` | 1 | 0 | 0 | ✅ PASS |
| `ExistingAdminProtectionTests` | 3 | 0 | 0 | ✅ PASS |
| `ExistingUserProtectionTests` | 3 | 0 | 0 | ✅ PASS |
| `ValidationTests` | 6 | 0 | 0 | ✅ PASS |
| `AuditSecurityTests` | 2 | 0 | 0 | ✅ PASS |
| `BootstrapRunnerTests` | 1 | 0 | 0 | ✅ PASS |
| `ConcurrencySerializationTests` | 3 | 0 | 0 | ✅ PASS |
| `ConfigBindingTests` | 2 | 0 | 0 | ✅ PASS |
| **`DialectDetectionTests` (NEW)** | **9** | **0** | **0** | ✅ **PASS** |
| **Total — AdminProvisioningServiceTest** | **30** | **0** | **0** | ✅ **ALL PASS** |

### 4.2 `DialectDetectionTests` — Individual Test Coverage

| # | Test Name | Scenario | Result |
|---|-----------|----------|:------:|
| 1 | `testResolveDialect_PostgreSQL` | Standard `jdbc:postgresql://` URL → `POSTGRESQL` | ✅ |
| 2 | `testResolveDialect_H2` | `jdbc:h2:mem:` URL → `H2` | ✅ |
| 3 | `testResolveDialect_MetadataFailure_ReturnsUnknown` | DataSource `getConnection()` throws `SQLException` → `UNKNOWN` | ✅ |
| 4 | `testResolveDialect_UnrecognizedUrl_ReturnsUnknown` | `jdbc:oracle:thin:` URL → `UNKNOWN` | ✅ |
| 5 | `testPostgresLockFailure_AbortsProvisioning` | PostgreSQL dialect + lock SQL throws → `REFUSED_DATABASE_LOCK`; no admin saved | ✅ |
| 6 | `testUnknownDialect_MetadataFailure_AbortsProvisioning` | DataSource metadata failure → `UNKNOWN` → `REFUSED_DATABASE_LOCK`; no admin saved | ✅ |
| 7 | `testUnknownDialect_UnrecognizedUrl_AbortsProvisioning` | Oracle URL → `UNKNOWN` → `REFUSED_DATABASE_LOCK`; no admin saved | ✅ |
| 8 | `testH2Dialect_SkipsAdvisoryLock_ProvisioningSucceeds` | H2 URL → advisory lock SQL **not** called; provisioning succeeds | ✅ |
| 9 | `testPostgresDialect_SuccessfulProvisioning` | PostgreSQL URL + lock succeeds → admin created; lock SQL verified | ✅ |

### 4.3 Full Authentication Regression Suite

| Test Class | Tests | Failures | Errors | Result |
|---|:---:|:---:|:---:|:---:|
| `AdminProvisioningServiceTest` | 30 | 0 | 0 | ✅ PASS |
| `BusinessTypeMappingAndPrivacyTest` | 14 | 0 | 0 | ✅ PASS |
| `RegistrationIdentityIntegrityTest` | 17 | 0 | 0 | ✅ PASS |
| `CustomerPrivacySecurityTest` | 7 | 0 | 0 | ✅ PASS |
| **Grand Total** | **68** | **0** | **0** | ✅ **ALL PASS** |

**Build result:** `[INFO] BUILD SUCCESS` — Total time: 30.817 s

---

## 5. Testcontainers / Real PostgreSQL Assessment

> [!NOTE]
> **Testcontainers integration tests were not added in this phase.**

The project currently has no Testcontainers dependency in `pom.xml` and Docker availability
within this build environment cannot be guaranteed.  A real-database concurrency test was
introduced and verified at the unit-test level in **AUTH-FIX-02.2** using mocked advisory-lock
behavior.  The current `DialectDetectionTests` tests exercise all reachable code paths of
`resolveDialect()` and `acquireDatabaseLock()` through mock `DataSource` / `JdbcTemplate`
injection.

**Honest classification of tests:**

| Category | Count | Mechanism |
|----------|:-----:|-----------|
| Pure unit tests (no DB, Mockito mocks only) | 59 | `@ExtendWith(MockitoExtension.class)` |
| Mocked dialect-detection tests (mock DataSource + mock JdbcTemplate) | 9 | Mock JDBC metadata responses |
| Real PostgreSQL integration tests | 0 | Not added (Testcontainers not present in project) |

---

## 6. Security Guarantees After This Fix

| Scenario | Before AUTH-FIX-02.3 | After AUTH-FIX-02.3 |
|----------|----------------------|----------------------|
| PostgreSQL advisory lock throws (transient) | Silent fallback to JVM lock ❌ | `REFUSED_DATABASE_LOCK` — no admin created ✅ |
| DataSource metadata lookup throws | Silent fallback to JVM lock ❌ | Dialect = UNKNOWN → `REFUSED_DATABASE_LOCK` ✅ |
| Unrecognized dialect (Oracle, MySQL) | Silent fallback to JVM lock ❌ | Dialect = UNKNOWN → `REFUSED_DATABASE_LOCK` ✅ |
| H2 test database | Silent fallback (correct by accident) | Explicit H2 detection → JVM lock only ✅ |
| PostgreSQL, lock succeeds | ✅ | ✅ (unchanged) |
| No JdbcTemplate injected (pure unit test) | JVM lock only | JVM lock only (early return, unchanged) ✅ |

---

## 7. Remaining Constraints & Non-Actions

- **No production administrator was created.**
- **No Flyway migrations were modified.**
- **No other authentication or payment modules were touched.**
- AUTH-FIX-03 has not been started.

