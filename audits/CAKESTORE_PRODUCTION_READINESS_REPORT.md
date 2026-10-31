# CakeStore — Phase A.1: Production Readiness Verification Report

**Document ID:** `CAKESTORE_PRODUCTION_READINESS_REPORT.md`  
**Audit Date:** October 21, 2026  
**Auditor:** Antigravity Autonomous Pair Programmer (DeepMind Advanced Agentic Coding)  
**Target Repository:** `D:\PROJECTS\CAKE SAAs1`  
**Audit Type:** Strict Read-Only Production Readiness Audit (Zero production changes, zero deployments, zero secret disclosure)  
**Current Git State:** Branch `development` (HEAD commit `5ff31434c132f5922305f3c1471a7d54bf6ffcf5`)  

---

## 1. Executive Verdict

### **VERDICT: NOT READY FOR PRODUCTION (BLOCKED BY DEPLOYMENT & CONFIGURATION GAPS)**

While the application business logic, multi-tenant boundaries, and automated test suites are in an exceptional state (**830/830 backend tests passing**, **162/162 frontend tests passing**, **0 ESLint errors**, and **38/38 Next.js routes building cleanly**), the platform **CANNOT safely be deployed to production in its current operational state**.

### Critical Primary Blockers:
1. **Branch & Deployment Desynchronization (High)**: Local and remote `development` branch contains 16 critical commits (including core customer checkout logic, OTP rate limiting, owner refresh coordination, and storefront pagination normalization) that have **NOT been merged into `main`**. The CI/CD pipeline (`.github/workflows/ci.yml`) and production hosting (Vercel / Azure) track `main`. Deploying `main` today will deploy an obsolete, broken build that is 16 commits behind active development.
2. **Missing Production Profile Enforcement in Dockerfile (High)**: `backend/Dockerfile` defines `ENTRYPOINT ["java", "-jar", "app.jar"]` without `-Dspring.profiles.active=prod`. If the container environment is missing `SPRING_PROFILES_ACTIVE=prod`, Spring Boot defaults to the local profile, enabling `app.demo-data.enabled: true` and executing `AdminUserInitializer.java`, which **seeds test accounts and demo credentials into the production database**.
3. **Absence of Payment Reconciliation Scheduled Job (High)**: If a customer completes a Razorpay payment but closes their browser tab before the frontend callback returns, and the Razorpay webhook is dropped or delayed, `OrderExpiryScheduler.java` will **automatically cancel the order after 15 minutes** without querying the Razorpay API to check whether the customer was charged.
4. **Third-Party Service Credentials Missing / Incomplete (High)**:
   - **Twilio SMS**: Credentials are completely absent from environment configurations; `SmsService.java` silently drops SMS notifications and Indian DLT template IDs are not implemented.
   - **Resend Email**: Configured with unverified sender domain (`onboarding@resend.dev`), which Resend strictly limits to the single account owner's inbox.
   - **Razorpay**: Production merchant keys (`rzp_live_...`) are not configured; only test mode credentials exist locally.

---

## 2. Verified Deployment Inventory

*Note: Distinguishes verifiable repository artifacts from external cloud resources.*

| Component | Target Platform | Repository Configuration | Deployed Cloud State | Branch / Commit Alignment | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend Web App** | Vercel | `frontend_v2/Dockerfile`, `frontend_v2/package.json` (Next.js 14.2.5 App Router). | **INACCESSIBLE** from local workspace without Vercel CLI credentials. | `development` is at `5ff3143`, `origin/main` is at `cf5a58c` (**16 commits behind**). | **DESYNCHRONIZED** |
| **Backend API** | Azure Container Apps (ACA) | `backend/Dockerfile`, `.github/workflows/ci.yml` targeting ACR `crcakestoreprod.azurecr.io`. | **INACCESSIBLE** from local workspace without Azure CLI login. | CI workflow triggers only on `main`; ACR push requires manual `workflow_dispatch`. | **DESYNCHRONIZED** |
| **Relational Database** | Azure Database for PostgreSQL | `backend/pom.xml`, 50 Flyway migrations (`V1`–`V50`). | **INACCESSIBLE** from local workspace. Local `.env` points to `localhost:5432`. | Schema is fully migration-driven; Flyway runs automatically on startup. | **READY (CODE-LEVEL)** |
| **Media & Assets Storage**| Azure Blob Storage | `application-prod.yml` references `azure.storage` container placeholders. | **INACCESSIBLE**. Commented out in `backend/.env`. | Local disk fallback currently used in dev; Azure SAS/container unverified. | **UNVERIFIED** |

### Git State & Remote Tracking Evidence:
- **Local Active Branch:** `development` (HEAD: `5ff31434c132f5922305f3c1471a7d54bf6ffcf5`)
- **Remote `origin/development`:** `5ff31434c132f5922305f3c1471a7d54bf6ffcf5` (Synchronized)
- **Local `main` Branch:** `cf5a58ce44cbeba8d68a51aff563ed42f8e1c850`
- **Remote `origin/main`:** `cf5a58ce44cbeba8d68a51aff563ed42f8e1c850`
- **Delta:** 16 commits on `development` are unmerged into `main`.
- **CI/CD Configuration (`.github/workflows/ci.yml`):**
  - Lines 3–9 explicitly listen on `branches: [ main ]`.
  - Lines 60–65 (`push-image`) only execute on `workflow_dispatch`.
  - **No automated deployment step exists** to update the Azure Container App revision from ACR.

---

## 3. Secret and Integration Status Matrix

*Evaluated without revealing any confidential values, tokens, or passwords.*

| Secret / Integration | Configuration Source | Repository Status | Live Cloud Status | Classification | Impact if Deployed As-Is |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Razorpay Key ID & Secret** | `backend/.env`, `frontend_v2/.env.local` | Test mode keys present (`rzp_test_...`). | **INACCESSIBLE** | **PRESENT BUT UNVERIFIED** (Test Mode Only) | Real customer credit/debit card and UPI transactions will fail or be run against Razorpay test mode. Live keys are missing. |
| **Razorpay Webhook Secret** | `backend/.env` (`RAZORPAY_WEBHOOK_SECRET`) | Configured with test webhook secret. | **INACCESSIBLE** | **PRESENT BUT UNVERIFIED** | Webhooks will fail signature verification if Razorpay dashboard is not paired with this exact secret over HTTPS. |
| **Email Provider (Resend)** | `backend/.env` (`SPRING_MAIL_PASSWORD`, `RESEND_API_KEY`) | Key configured; sender set to `onboarding@resend.dev`. | **INACCESSIBLE** | **PRESENT BUT UNVERIFIED** | Sender domain is **NOT verified**. Resend rejects all outgoing emails to customers and bakery owners, restricting delivery exclusively to the developer's registered address. |
| **Twilio SMS / OTP** | `application.yml`, `backend/.env` | All `TWILIO_*` variables completely missing. | **INACCESSIBLE** | **MISSING** | SMS OTP for guest checkout and owner alerts will silently drop. Indian DLT Template IDs are not implemented in `SmsService.java`. |
| **JWT Signing Secret** | `application.yml`, `backend/.env` | 64-character static hex string present. | **INACCESSIBLE** | **PRESENT BUT UNVERIFIED** | Development uses a committed static fallback secret. In production, Azure environment must supply a cryptographically unique secret. |
| **Azure Blob Storage** | `application-prod.yml`, `backend/.env` | Keys commented out in `.env`; local disk provider active. | **INACCESSIBLE** | **MISSING (LOCAL) / INACCESSIBLE (CLOUD)** | If deployed without Azure Blob keys, uploads will attempt to write to local container filesystem `/var/lib/cakestore/uploads` and be lost on container restart. |
| **Database Connection** | `backend/.env` | Points to local PostgreSQL (`localhost:5432`). | **INACCESSIBLE** | **PRESENT BUT UNVERIFIED (LOCAL ONLY)** | Azure PostgreSQL connection string (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`) must be injected via Azure Container App environment secrets. |

---

## 4. Production-Profile Findings

### 4.1 Dockerfile Entrypoint & Spring Profile Activation
- **File Reference:** [`backend/Dockerfile`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/Dockerfile#L31)
- **Finding:**
  ```dockerfile
  ENTRYPOINT ["java", "-jar", "app.jar"]
  ```
  The container entrypoint does not include `-Dspring.profiles.active=prod`.
- **Vulnerability / Risk:**
  If the Azure Container App environment does not explicitly define the environment variable `SPRING_PROFILES_ACTIVE=prod`, Spring Boot boots with the `default` profile.
  In `application.yml`, the default profile defines:
  ```yaml
  app:
    demo-data:
      enabled: ${APP_DEMO_DATA_ENABLED:true}
  management:
    endpoints:
      web:
        exposure:
          include: health,info,prometheus
    endpoint:
      health:
        show-details: always
  ```
  Because `AdminUserInitializer.java` is guarded by `@Profile("!prod")` and `@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true")`, booting with `default` profile causes `AdminUserInitializer` to execute, **creating demo admin and demo owner accounts with default credentials in the production database**.
- **Evidence:** [`backend/src/main/java/com/cakeplatform/api/security/AdminUserInitializer.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/AdminUserInitializer.java#L28-L29).

### 4.2 Exposure of Sensitive Actuator Metrics
- In `application-prod.yml`, actuator endpoints are properly locked down:
  ```yaml
  management:
    endpoints:
      web:
        exposure:
          include: health
    endpoint:
      health:
        show-details: never
  ```
- However, if the profile fails to activate, full health details and Prometheus metrics become publicly readable on port 8080.

---

## 5. Payment and Notification Risks

### 5.1 Razorpay Payment & Webhook Handling (Code-Level Verification)
- **File References:** [`RazorpayService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/RazorpayService.java#L66-L113) and [`WebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/controller/WebhookController.java#L56-L100).
- **Strengths Verified:**
  1. Signature verification computes HMAC-SHA256 against raw, unmodified request bytes.
  2. Uses `MessageDigest.isEqual` to perform constant-time comparison, preventing timing attacks.
  3. Webhook idempotency is enforced via `WebhookEventRepository.existsByEventId(eventIdHeader)` and atomic `saveAndFlush`.
  4. Payment record updates acquire pessimistic write locks (`findByIdWithLock`).
- **Gaps & Hazards:**
  1. **Legacy Endpoint Disabled:** `/api/webhooks/razorpay-v2` returns HTTP 410 GONE in [`RazorpayWebhookController.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/payment/controller/RazorpayWebhookController.java#L20). Any webhook URL pointed to `razorpay-v2` will fail.
  2. **No Live Gateway Verification:** All tests operate against mocked Razorpay responses; live webhook ingestion over public HTTPS has not been verified.

### 5.2 Payment Reconciliation Deficiency (Critical Operational Risk)
- **File Reference:** [`OrderExpiryScheduler.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/scheduler/OrderExpiryScheduler.java#L19-L28) and [`OrderService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/order/service/OrderService.java#L278-L288).
- **Finding:**
  `OrderExpiryScheduler` runs every 60 seconds and cancels any order in `PAYMENT_PENDING` status older than 15 minutes to release delivery slot capacity.
- **The Hazard:**
  There is **zero reconciliation logic** that queries Razorpay (`razorpayClient.orders.fetch(orderId)`) before cancelling. If a customer paid successfully but:
  - Network latency delayed the webhook beyond 15 minutes, or
  - Razorpay webhooks were temporarily failing, or
  - The customer closed their browser tab before frontend verification completed,
  the system will **unilaterally CANCEL the order and reassign the delivery slot**, while the customer's account has been debited.

### 5.3 SMS & Email Error Handling and Retries
- **SMS ([`SmsService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/SmsService.java#L41-L62)):**
  - Twilio call is wrapped in `@Async` with a try-catch block.
  - **No Retry Mechanism:** Any network glitch or provider error logs a message and aborts.
  - **No DLT Compliance:** Telecom regulations in India (TRAI) mandate registered Principal Entity IDs and Content Template IDs for transactional SMS. `SmsService.java` does not pass these parameters.
- **Email ([`EmailService.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java#L133-L159)):**
  - Resend HTTP calls are asynchronous with a 10-second connect timeout.
  - Exceptions are trapped to prevent database rollbacks.
  - **No Retry Mechanism:** 429 rate-limits or 5xx server errors from Resend are dropped without retries.

---

## 6. Database, Monitoring, Backup, and Rollback Status

### 6.1 Database & Flyway Migrations
- **Status:** **EXCELLENT / PRODUCTION-READY**
- **Evidence:** 50 sequential Flyway migration files (`V1__init_schema.sql` through `V50__create_global_settings_table.sql`).
- All migrations include backward-compatible DDL, idempotency checks (`IF NOT EXISTS`), foreign key referential integrity, and soft-delete filters (`@SQLRestriction("is_deleted = false")`).

### 6.2 Monitoring & Observability
- **Status:** **PARTIALLY CONFIGURED**
- **Evidence:**
  - Spring Boot Actuator configured for `/actuator/health`.
  - In `backend/Dockerfile`, line 28 specifies:
    ```dockerfile
    HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://localhost:8080/actuator/health/liveness || exit 1
    ```
  - **Gap:** In `application-prod.yml`, `management.endpoint.health.probes.enabled: true` is not explicitly declared. In environments where Kubernetes is not auto-detected by Spring, `/actuator/health/liveness` returns 404, causing the container health check to fail.
  - No Application Performance Monitoring (APM) agents (Azure Application Insights, Datadog) are bundled in `pom.xml`.

### 6.3 Database Backups
- **Status:** **UNMANAGED / NO REPOSITORY AUTOMATION**
- **Evidence:**
  - One manual snapshot file exists in `backend/backup/cake_platform_20261015_144030.dump`.
  - There are zero automated backup scripts, cron workflows, or Terraform/Bicep configurations for Azure PostgreSQL automated backups or geo-redundant storage.

### 6.4 Rollback Documentation & Procedures
- **Status:** **MISSING**
- **Evidence:**
  - No deployment rollback runbook exists.
  - Flyway migrations are forward-only (`V*.sql`); zero undo migrations (`U*.sql`) are maintained.
  - No documented recovery plan exists if an Azure Container App revision fails to stabilize.

---

## 7. Prioritized Launch Blockers & Action Plan

### Tier 1: Launch Blockers (Must Remediate Before Production Deployment)

| ID | Category | Item | Required Action |
| :--- | :--- | :--- | :--- |
| **BLK-01** | **Git / Deployment** | Merge `development` into `main` | Open PR and merge all 16 commits from `development` into `main` so that Vercel and Azure Container Apps deploy the verified codebase. |
| **BLK-02** | **Configuration** | Production Profile Enforcement | Update `backend/Dockerfile` line 31 to explicitly specify: `ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]` to permanently block demo data initialization in production containers. |
| **BLK-03** | **Security / Secrets** | Provision Live Secrets in Azure | Populate Azure Container App environment secrets: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (unique 64-char hex), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CORS_ALLOWED_ORIGINS`. |
| **BLK-04** | **Payment Safety** | Pre-Expiry Razorpay Check | In `OrderExpiryScheduler.java` or `OrderService.java`, before cancelling `PAYMENT_PENDING` orders, query the Razorpay API to confirm that no payment was captured. |
| **BLK-05** | **Email Setup** | Resend Domain Verification | Complete domain DNS verification in the Resend dashboard and update `MAIL_FROM_ADDRESS` from `onboarding@resend.dev` to a verified custom domain address (e.g. `orders@cakestore.com`). |
| **BLK-06** | **SMS / Telecom** | Twilio DLT Credentials | Configure valid `TWILIO_*` credentials or provide a prominent UI fallback (e.g., Email OTP) so that customer checkout is not blocked by missing SMS infrastructure. |

### Tier 2: Post-Deployment Operational Hardening (Week 1)
- [ ] Explicitly add `management.endpoint.health.probes.enabled: true` to `application-prod.yml`.
- [ ] Connect `/actuator/health` to an external uptime monitor (e.g., BetterUptime, Azure Monitor).
- [ ] Establish automated Azure PostgreSQL daily backup policies with 30-day retention.
- [ ] Create a documented deployment rollback runbook.

---

## 8. Summary of Limitations

1. **Cloud Access Limitation:** This audit was performed strictly within the local workspace filesystem. Live Azure Container App revisions, live Azure Database for PostgreSQL configurations, and Vercel project environment variables could not be directly inspected without active cloud CLI credentials.
2. **Third-Party Telephony & Bank Clearing:** Live telecom SMS delivery over Indian networks and live bank-to-bank UPI capture were not executed to avoid billing live customer accounts or consuming SMS credits.
3. **Repository Cleanliness:** No application files, database migrations, configuration parameters, or git branches were modified during the execution of this audit.

---
*End of Report. Awaiting user review and authorization before proceeding.*
