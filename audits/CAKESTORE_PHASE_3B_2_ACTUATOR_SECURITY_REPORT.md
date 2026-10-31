# CakeStore — Phase 3B.2: Actuator Security Hardening Report

**Date:** October 24, 2026  
**Auditor / Engineer:** Antigravity AI Security Pair Programmer  
**Phase:** Phase 3B.2 — Actuator Security Hardening  
**Deliverable File:** `CAKESTORE_PHASE_3B_2_ACTUATOR_SECURITY_REPORT.md`  

---

## 1. Executive Summary

In Phase 3B.2, we fixed the publicly accessible Actuator monitoring endpoints identified in `CAKESTORE_LOGIN_REGISTER_SESSION_VERIFICATION.md`.

Prior to this fix, [SecurityConfig.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java) included `"/actuator/**"` in the `.permitAll()` rule alongside public authentication endpoints. While `application.yml` restricted the exposed Web endpoints to `health,info,prometheus`, Spring Security's permissive wildcard allowed unauthenticated access to `/actuator` discovery links, metrics, and `/actuator/prometheus`.

We implemented the exact security hardening:
1. Removed `"/actuator/**"` from the `.permitAll()` allowlist.
2. Preserved public access strictly for essential health and info endpoints:
   - `/api/health`
   - `/actuator/health`
   - `/actuator/health/**` (supporting container readiness and liveness probes)
   - `/actuator/info`
3. Restricted all other Actuator endpoints (`/actuator/**`, including base discovery `/actuator` and `/actuator/prometheus`) strictly to authenticated users with `hasAuthority("ROLE_ADMIN")`.
4. Verified that anonymous callers receive HTTP 401 Unauthorized, authenticated non-admins (`SHOP_OWNER`, `CUSTOMER`) receive HTTP 403 Forbidden, and administrators receive HTTP 200 OK.

---

## 2. Files Changed

### 1. [backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java)
- **Lines Modified:** 66–75.
- **Exact Rule Comparison:**

#### Before (Vulnerable Wildcard):
```java
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/register",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/auth/logout",
                                "/actuator/**"
                        ).permitAll()
                        .requestMatchers("/api/health", "/actuator/health").permitAll()
```

#### After (Hardened Least-Privilege Rules):
```java
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/register",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/auth/logout"
                        ).permitAll()
                        .requestMatchers("/api/health", "/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/**").hasAuthority("ROLE_ADMIN")
```

### 2. [backend/src/test/java/com/cakeplatform/api/security/ActuatorSecurityHardeningTest.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/test/java/com/cakeplatform/api/security/ActuatorSecurityHardeningTest.java)
- **New Test Suite:** Created a comprehensive Spring Security integration test suite covering 11 distinct authorization assertions across anonymous, customer, shop owner, and administrator principals.

---

## 3. Detailed Authorization & Matcher Ordering Explanation

In Spring Security 6 (`authorizeHttpRequests`), matchers are evaluated in top-to-bottom sequence where the first matching rule takes precedence.

1. **Rule 1 — Public Authentication Routes:**
   `/api/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/logout` are evaluated and permitted.
2. **Rule 2 — Public Health & Container Probes:**
   `/api/health`, `/actuator/health`, `/actuator/health/**`, `/actuator/info` are matched and permitted.
   - `application.yml` configures `management.endpoint.health.probes.enabled=true`. In containerized environments (Azure Container Apps / Kubernetes), container orchestrators query `/actuator/health/liveness` and `/actuator/health/readiness`. Including `/actuator/health/**` guarantees probe availability without authentication.
3. **Rule 3 — Protected Actuator Endpoints (`ROLE_ADMIN`):**
   Any other route matching `/actuator/**` (such as `/actuator`, `/actuator/prometheus`, `/actuator/metrics`, `/actuator/env`) immediately requires `hasAuthority("ROLE_ADMIN")`.
   - **Anonymous Caller:** Fails the check. The custom `accessDeniedHandler` / `jwtAuthenticationEntryPoint` returns HTTP 401 Unauthorized.
   - **Authenticated Non-Admin (`SHOP_OWNER` or `CUSTOMER`):** Authenticated principal lacks `ROLE_ADMIN`. The `accessDeniedHandler` returns HTTP 403 Forbidden.
   - **Authenticated Administrator (`ROLE_ADMIN`):** Principal holds `ROLE_ADMIN`. The request is authorized and proceeds to the Actuator endpoint handler (HTTP 200 OK).
4. **Rule 4 — Business Endpoints & Fallthrough:**
   Subsequent storefront rules, upload protections (`.denyAll()`), HMAC document views, and `anyRequest().authenticated()` remain untouched.

---

## 4. Tests Added & Execution Results

### 4.1. Targeted Suite: `ActuatorSecurityHardeningTest`
- **Command:**
  ```powershell
  mvn test '-Dtest=ActuatorSecurityHardeningTest'
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\backend`
- **Execution Results:**
  ```
  [INFO] Running com.cakeplatform.api.security.ActuatorSecurityHardeningTest
  [INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 34.99 s
  [INFO] BUILD SUCCESS (Total time: 57.51 s)
  ```
- **Test Scenarios Verified:**
  1. `testAnonymousAccessToHealthPermitted`: Anonymous `GET /actuator/health` -> **200 OK**
  2. `testAnonymousAccessToReadinessProbePermitted`: Anonymous `GET /actuator/health/readiness` -> **200 OK**
  3. `testAnonymousAccessToLivenessProbePermitted`: Anonymous `GET /actuator/health/liveness` -> **200 OK**
  4. `testAnonymousAccessToInfoPermitted`: Anonymous `GET /actuator/info` -> **200 OK**
  5. `testAnonymousAccessToBaseActuatorRejected`: Anonymous `GET /actuator` -> **401 Unauthorized**
  6. `testAnonymousAccessToPrometheusRejected`: Anonymous `GET /actuator/prometheus` -> **401 Unauthorized**
  7. `testShopOwnerAccessToBaseActuatorForbidden`: Bearer token `SHOP_OWNER` `GET /actuator` -> **403 Forbidden**
  8. `testShopOwnerAccessToPrometheusForbidden`: Bearer token `SHOP_OWNER` `GET /actuator/prometheus` -> **403 Forbidden**
  9. `testCustomerAccessToPrometheusForbidden`: Bearer token `CUSTOMER` `GET /actuator/prometheus` -> **403 Forbidden**
  10. `testAdminAccessToBaseActuatorAuthorized`: Bearer token `ADMIN` `GET /actuator` -> **200 OK**
  11. `testAdminMockUserAccessToBaseActuatorAuthorized`: Mock user with `ROLE_ADMIN` `GET /actuator` -> **200 OK**

### 4.2. Consolidated Security Regression Suite
- **Command:**
  ```powershell
  mvn test '-Dtest=ActuatorSecurityHardeningTest,JwtSecretSecurityHardeningTest,JwtSessionInvalidationAndStabilityTest'
  ```
- **Working Directory:** `d:\PROJECTS\CAKE SAAs1\backend`
- **Execution Results:**
  ```
  [INFO] Running com.cakeplatform.api.security.ActuatorSecurityHardeningTest
  [INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 32.46 s
  [INFO] Running com.cakeplatform.api.security.JwtSecretSecurityHardeningTest
  [INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.050 s
  [INFO] Running com.cakeplatform.api.security.JwtSessionInvalidationAndStabilityTest
  [INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.77 s
  [INFO] 
  [INFO] Results:
  [INFO] Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
  [INFO] BUILD SUCCESS (Total time: 59.83 s)
  ```
  *All 27 security tests passed with 0 failures, 0 errors, and 0 skips.*

---

## 5. Remaining Considerations

1. **Email Service Unification (Task P3-01):**
   - As documented in Phase 3A, `AuthService.forgotPassword` still relies on `EmailServiceImpl` (Spring SMTP `JavaMailSender`), whereas `application.yml` only configures Resend HTTP API properties. This remains to be updated in a dedicated email unification task.
2. **Prometheus Meter Registry Library:**
   - In `application.yml`, `management.endpoints.web.exposure.include` lists `prometheus`. `spring-boot-starter-actuator` is included in `pom.xml`, but `micrometer-registry-prometheus` is not declared as a Maven dependency. If Prometheus metrics scraping is required in production, the dependency should be added in a future dependency update. From a security standpoint, the endpoint is strictly protected by `ROLE_ADMIN` regardless.

---

## 6. Strict Boundary Compliance Confirmation

- **No Frontend Modifications:** Zero frontend files were changed.
- **No Database / Migration Modifications:** PostgreSQL database and Flyway migrations were untouched.
- **No Configuration / Secret Modifications:** `application.yml`, `application-test.properties`, and environment secrets were untouched.
- **No External Integrations:** No third-party email, SMS, or cloud APIs were invoked.
- **No Deployments or Git Operations:** No commits, pushes, merges, or deployments were performed. All local and uncommitted changes remain intact.

---
*End of Report — Phase 3B.2 Complete. Stopped and awaiting user review.*
