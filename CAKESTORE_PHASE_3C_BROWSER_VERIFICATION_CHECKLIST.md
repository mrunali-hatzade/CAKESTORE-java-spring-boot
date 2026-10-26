# CakeStore — Phase 3C: Read-Only Browser Verification Checklist

**Date:** October 24, 2026  
**Auditor:** Antigravity AI Security Pair Programmer  
**Mode:** READ-ONLY COMPREHENSIVE BROWSER VERIFICATION CHECKLIST  
**Target Application:** CakeStore Multi-Tenant SaaS Platform (`frontend_v2` & `backend`)  
**Deliverable File:** `CAKESTORE_PHASE_3C_BROWSER_VERIFICATION_CHECKLIST.md`

---

## 1. Objective & Scope

This checklist establishes a systematic, end-to-end browser verification procedure for CakeStore's authentication, onboarding, role-based routing, session stability, and security monitoring subsystems.

It synthesizes findings from:
- `CAKESTORE_LOGIN_REGISTER_SESSION_VERIFICATION.md` (Authentication and session verification)
- `CAKESTORE_PHASE_3B_1_OWNER_AUTH_GUARD_REPORT.md` (Owner dashboard client-side route guard)
- `CAKESTORE_PHASE_3B_2_ACTUATOR_SECURITY_REPORT.md` (Actuator endpoint restriction and hardening)
- `CAKESTORE_PHASE_3B_3_PASSWORD_RECOVERY_EMAIL_REPORT.md` (Password recovery email delivery and token masking)

> [!IMPORTANT]
> **Strict Safety Notice:** This document is a **read-only checklist** prepared for future manual QA execution. No browser tests are executed during this step. No production services, real emails, or real SMS gateways are invoked.

---

## 2. Local Startup Prerequisites & Environment Commands

To execute this browser checklist in a local testing environment, both backend and frontend services must be running locally.

### 2.1. Backend Service (Spring Boot 3.3.x)
- **Directory:** `backend`
- **Port:** `8080` (`http://localhost:8080`)
- **Required Profile:** `dev` or `local` (to enable demo account seeding, `DevEmailSink`, and development endpoints)
- **Exact Startup Command:**
  ```powershell
  cd "d:\PROJECTS\CAKE SAAs1\backend"
  mvn spring-boot:run -Dspring-boot.run.profiles=dev
  ```
- **Configuration Checkpoints:**
  - Database: Local PostgreSQL instance running with Flyway migrations applied through `V53`.
  - JWT Secret: Provided via `JWT_SECRET` environment variable or auto-initialized development fallback.
  - Demo Data: `app.demo-data.enabled=true` (initializes platform admins).
  - Demo Shops: `app.seed.demo-shops=true` (initializes active demo bakeries).

### 2.2. Frontend Service (Next.js 14 App Router)
- **Directory:** `frontend_v2`
- **Port:** `3001` (`http://localhost:3001`)
- **API Target:** `NEXT_PUBLIC_API_URL=http://localhost:8080`
- **Exact Startup Command:**
  ```powershell
  cd "d:\PROJECTS\CAKE SAAs1\frontend_v2"
  npm run dev
  ```
- **Browser Compatibility:** Google Chrome, Mozilla Firefox, or Microsoft Edge (Chromium). Developer Tools (F12) Console and Network tabs must be open during testing.

---

## 3. Available Test Accounts & Database Fixtures

The following test accounts are automatically provisioned by `AdminUserInitializer.java` when running in the `dev` profile with demo data enabled:

| Account Identifier (Email) | Mobile Number | Password | Role | Associated Shop & Status | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `admin@cakeplatform.com` | `9999999999` | `Password123!` | `ADMIN` | N/A (Platform Admin) | Primary platform administrator |
| `admin@cakestore.com` | `9999999998` | `admin123` | `ADMIN` | N/A (Demo Admin) | Secondary frontend demo admin |
| `owner@sweetdelight.com` | `9876543210` | `password123` | `SHOP_OWNER` | Sweet Delight Bakery (`ACTIVE`) | Verified owner with active subscription |
| `owner@example.com` | `9876543212` | `Password123!` | `SHOP_OWNER` | Jane's Amazing Cakes (`ACTIVE`) | Reference owner matching API test suite |
| `mrunalithatzade20@gmail.com` | `9876543211` | `password123` | `SHOP_OWNER` | Mrunali's Artisanal Bakery (`ACTIVE`) | Personal staging bakery account |

---

## 4. Ordered Browser Test Cases

---

### Test Suite 1: Owner Registration & Multi-Step Onboarding

#### Test Case TC-ONBOARD-01: Owner Registration Multi-Step Wizard Flow
- **Feature:** 3-step bakery registration wizard (`/onboarding`)
- **Prerequisites:** Backend and Frontend servers running. Browser in an incognito/private window.
- **Exact Browser Actions:**
  1. Navigate to `http://localhost:3001/onboarding`.
  2. Verify **Step 1 ("Your Account Details")** is displayed.
  3. Enter valid, unused credentials:
     - Full Name: `Test Baker`
     - Email: `newbaker.test@example.com`
     - Mobile: `9812345678`
     - Password: `StrongPassword123!`
     - Confirm Password: `StrongPassword123!`
  4. Observe password strength meter indicates **Strong** (emerald indicator).
  5. Click **Continue to Bakery Details** (or Next Step button).
  6. Verify navigation to **Step 2 ("Bakery Identity")**.
  7. Fill in bakery details:
     - Bakery Name: `Test Artisan Delights`
     - Business Type: Select `HOME_BAKER`
     - Description: `Specialty handcrafted cupcakes and customized tier cakes.`
     - Business Phone: `9812345678`
  8. Click **Continue to Location & License**.
  9. Verify navigation to **Step 3 ("Location & Compliance")**.
  10. Fill in address details:
      - Address Line: `Shop 4, Ground Floor, Baker Street`
      - State: `Maharashtra`
      - District: `Pune`
      - City: `Pune`
      - Pincode: `411001`
  11. Click **Complete Registration & Submit Application**.
- **Expected Result:**
  - Form submits without client errors.
  - Registration payload is posted as `multipart/form-data` to `POST /api/auth/register`.
  - Backend responds with HTTP 200 containing JWT and user profile.
  - Frontend automatically logs in and transitions user to **Step 4 (Subscription selection)** or redirects to owner portal.
- **How to Verify:**
  - Open Network tab: `POST /api/auth/register` returns status `200`.
  - Response body contains `token`, `role: "SHOP_OWNER"`, and `shopId`.
  - Application localStorage contains `cakestore_token` and `cakestore_user`.
- **Dependencies:** Requires local backend and database. No external services required.
- **Cleanup:** Soft-delete created user or record created email for future test runs.

---

### Test Suite 2: Input Validation & Duplicate Handling

#### Test Case TC-VAL-01: Client-Side Input Formatting & Password Validation
- **Feature:** Step 1 input validation rules
- **Prerequisites:** On `http://localhost:3001/onboarding` (Step 1).
- **Exact Browser Actions:**
  1. Enter Full Name: `A` (less than 2 characters).
  2. Enter invalid email: `not-an-email`.
  3. Enter invalid phone: `12345` (less than 10 digits).
  4. Enter weak password: `pass` (less than 8 characters).
  5. Enter mismatched confirm password: `pass123`.
  6. Click **Continue to Bakery Details**.
- **Expected Result:**
  - Wizard does not advance to Step 2.
  - Inline error messages appear under respective fields:
    - Email error: Valid email required.
    - Mobile error: 10-digit Indian mobile required.
    - Password mismatch error: Passwords do not match.
    - Password strength indicates **Weak** (red indicator).
- **How to Verify:** Visual inspection of error banners and input border highlights.
- **Dependencies:** Completely standalone client-side test. No backend calls made.
- **Cleanup:** None.

#### Test Case TC-VAL-02: Duplicate Email & Mobile 409 Conflict Handling
- **Feature:** Server-side duplicate detection and state preservation
- **Prerequisites:** An existing registered account in database (e.g. `owner@sweetdelight.com` / `9876543210`).
- **Exact Browser Actions:**
  1. Navigate to `http://localhost:3001/onboarding`.
  2. In Step 1, enter existing credentials:
     - Email: `owner@sweetdelight.com`
     - Mobile: `9876543210`
     - Full Name: `Duplicate Tester`
     - Password: `Password123!`
     - Confirm Password: `Password123!`
  3. Advance to Step 2 and enter dummy bakery name: `Duplicate Bakery`.
  4. Advance to Step 3 and enter dummy address details.
  5. Click **Complete Registration & Submit Application**.
- **Expected Result:**
  - Backend responds with HTTP 409 Conflict.
  - Frontend wizard automatically returns the user to **Step 1**.
  - Inline error banner displays: `This email is already registered. Please login or use another email.` and/or `This phone number is already registered.`
  - All previously entered form inputs across Steps 1, 2, and 3 remain preserved in memory.
- **How to Verify:**
  - Network tab shows `409 Conflict` on `POST /api/auth/register`.
  - Wizard active step indicator shows Step 1.
  - Form inputs are populated, not blanked out.
- **Dependencies:** Requires local backend with demo accounts seeded.
- **Cleanup:** None.

---

### Test Suite 3: Map Pin Selection & Address Handling

#### Test Case TC-MAP-01: Interactive Map Pin Drop & Coordinates Capture
- **Feature:** Interactive Leaflet map widget on Step 3 of onboarding
- **Prerequisites:** On `http://localhost:3001/onboarding` (Step 3).
- **Exact Browser Actions:**
  1. Scroll down to the **"Pin Your Bakery on the Map"** container.
  2. Verify the interactive Leaflet map renders with controls.
  3. Click on a specific location on the map.
  4. Verify marker icon moves to the clicked location.
  5. Verify latitude and longitude inputs populate with coordinates (e.g. `18.520430, 73.856744`).
  6. Check the **"Confirm this location pin"** checkbox.
- **Expected Result:**
  - Coordinates are locked in component state (`latitude`, `longitude`).
  - `isLocationConfirmed` is set to `true`.
  - When submitting registration, payload includes `latitude` and `longitude` fields.
- **How to Verify:**
  - Inspect form submission request payload in Network tab to confirm numeric `latitude` and `longitude` values are sent.
- **Dependencies:** Requires internet access for OpenStreetMap tiles. In offline testing, coordinates can be verified via direct input or mock click.
- **Cleanup:** None.

#### Test Case TC-MAP-02: Browser Geolocation Detection
- **Feature:** "Detect My Current Location" button
- **Prerequisites:** Browser geolocation permissions set to "Ask" or "Allow".
- **Exact Browser Actions:**
  1. In Step 3, click **"Use Current Location"** (Crosshair button).
  2. Accept the browser permission prompt when prompted.
- **Expected Result:**
  - Map center pans to user's detected coordinates.
  - A success badge appears: `Coordinates locked: <lat>, <lng>`.
- **How to Verify:** Coordinates match browser geolocation readings.
- **Dependencies:** Requires browser geolocation support and user permission approval.
- **Cleanup:** None.

---

### Test Suite 4: FSSAI Document Upload & Validation

#### Test Case TC-DOC-01: FSSAI License File Upload & Validation
- **Feature:** Document upload in Step 3 of onboarding
- **Prerequisites:** A prepared test PDF file `test_fssai.pdf` (< 5MB) and an invalid large file `oversized.pdf` (> 10MB).
- **Exact Browser Actions:**
  1. On Step 3 of onboarding, locate the **"FSSAI Registration / License Document"** upload zone.
  2. Enter FSSAI number: `11521034000123` (14-digit format).
  3. Attempt to upload `oversized.pdf`:
     - Drag and drop or browse for `oversized.pdf`.
     - Observe client validation warning: `File size exceeds 5MB limit`.
  4. Upload valid `test_fssai.pdf`:
     - File name `test_fssai.pdf` appears with file size badge.
     - A green checkmark confirms file attachment.
  5. Submit registration.
- **Expected Result:**
  - `verificationFile` is sent in multipart request.
  - Backend saves document to local private storage directory (`uploads/documents/`).
  - Document is saved with `DENIED` public access rule.
- **How to Verify:**
  - Network tab inspection shows `verificationFile` part in multipart form submission.
  - Backend filesystem check confirms file saved under `uploads/` directory without public URL.
- **Dependencies:** Requires a dummy test PDF file on local tester machine.
- **Cleanup:** Delete test file from `uploads/` directory after testing if desired.

---

### Test Suite 5: Login via Email & Mobile Number

#### Test Case TC-AUTH-01: Login via Case-Insensitive Email
- **Feature:** Email login authentication (`/login`)
- **Prerequisites:** Seeded account `owner@sweetdelight.com` / `password123`.
- **Exact Browser Actions:**
  1. Navigate to `http://localhost:3001/login`.
  2. In the identifier field, enter mixed-case email: `OwNeR@sWeEtDeLiGhT.cOm`.
  3. In password field, enter `password123`.
  4. Click password reveal (eye icon) to verify password characters display, then toggle back to hidden.
  5. Click **Sign In**.
- **Expected Result:**
  - Form displays loading state spinner.
  - Authentication succeeds (`POST /api/auth/login` returns 200).
  - User is routed directly to `/dashboard/owner`.
- **How to Verify:**
  - Browser URL changes to `http://localhost:3001/dashboard/owner`.
  - Application header displays user name and bakery badge.
- **Dependencies:** Requires local backend with demo accounts.
- **Cleanup:** None.

#### Test Case TC-AUTH-02: Login via 10-Digit Indian Mobile Number
- **Feature:** Mobile login resolution
- **Prerequisites:** Seeded account with mobile `9876543210` / `password123`.
- **Exact Browser Actions:**
  1. Navigate to `http://localhost:3001/login`.
  2. Enter 10-digit mobile number: `9876543210`.
  3. Enter password: `password123`.
  4. Click **Sign In**.
  5. Repeat test in a new tab using formatted mobile number: `+91 9876543210`.
- **Expected Result:**
  - Both 10-digit and `+91` prefixed mobile numbers authenticate successfully.
  - Backend canonicalizes mobile number and maps to user record.
  - User lands on `/dashboard/owner`.
- **How to Verify:** Successful redirection to `/dashboard/owner` in both attempts.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

#### Test Case TC-AUTH-03: Invalid Password Credentials Handling
- **Feature:** Authentication failure isolation
- **Prerequisites:** On `http://localhost:3001/login`.
- **Exact Browser Actions:**
  1. Enter email: `owner@sweetdelight.com`.
  2. Enter incorrect password: `WrongPassword999!`.
  3. Click **Sign In**.
- **Expected Result:**
  - `POST /api/auth/login` returns HTTP 401 Unauthorized.
  - Inline error banner displays: `Invalid credentials. Please verify your mobile number/email and password.`
  - Page does not reload, and session is not created.
- **How to Verify:** Network tab shows status `401`. Error banner visible on page.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

---

### Test Suite 6: Role-Based Routing for SHOP_OWNER & ADMIN

#### Test Case TC-RBAC-01: Admin Login & Automatic Portal Redirection
- **Feature:** Role-based routing on login
- **Prerequisites:** Seeded platform admin `admin@cakestore.com` / `admin123`.
- **Exact Browser Actions:**
  1. Navigate to `http://localhost:3001/login`.
  2. Enter `admin@cakestore.com` and password `admin123`.
  3. Click **Sign In**.
- **Expected Result:**
  - Login responds with `role: "ROLE_ADMIN"`.
  - Frontend intercepts role and navigates directly to `/admin` (not `/dashboard/owner`).
  - Admin dashboard shell renders with administrative navigation sidebar.
- **How to Verify:** URL is `http://localhost:3001/admin`. Admin navigation items (Platform Overview, Shops, Subscriptions, Audit) are visible.
- **Dependencies:** Requires local backend with admin seeded.
- **Cleanup:** None.

#### Test Case TC-RBAC-02: Unauthorized Cross-Role Portal Access Blocking
- **Feature:** Client route guard enforcement (`OwnerAuthGuard` & `AdminGuard`)
- **Prerequisites:** Logged in as `owner@sweetdelight.com` (role: `SHOP_OWNER`).
- **Exact Browser Actions:**
  1. With active owner session, manually enter URL in address bar: `http://localhost:3001/admin`.
  2. Press Enter.
  3. Observe immediate redirection.
  4. In a separate tab, log in as `admin@cakestore.com` (role: `ADMIN`).
  5. Manually enter URL in address bar: `http://localhost:3001/dashboard/owner`.
  6. Press Enter.
- **Expected Result:**
  - When owner visits `/admin`: Admin layout guard immediately redirects to `/login?redirect=%2Fadmin`.
  - When admin visits `/dashboard/owner`: `OwnerAuthGuard` immediately redirects to `/login?redirect=%2Fdashboard%2Fowner`.
  - Neither user can view the other role's dashboard shell or trigger sensitive APIs.
- **How to Verify:** Address bar immediately changes to `/login?redirect=...`. No dashboard content is rendered.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

---

### Test Suite 7: Owner Dashboard Navigation, Page Refresh & Session Stability

#### Test Case TC-DASH-01: Full Page Refresh Without Session Loss
- **Feature:** Session hydration from localStorage during page reload
- **Prerequisites:** Logged in as `owner@sweetdelight.com` on `http://localhost:3001/dashboard/owner`.
- **Exact Browser Actions:**
  1. On owner dashboard, verify stats and bakery name are visible.
  2. Press `Ctrl + F5` (hard refresh) or `F5`.
  3. Observe the initial loading state.
- **Expected Result:**
  - Brief loading spinner renders while `AuthContext` hydrates session.
  - User is **NOT** redirected to `/login`.
  - Dashboard reloads smoothly with active session intact.
  - Shop data, pending order counts, and subscription status display without error.
- **How to Verify:** Dashboard remains fully accessible on URL `/dashboard/owner` after reload.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

#### Test Case TC-DASH-02: Internal Navigation Stability
- **Feature:** Route changes within owner dashboard
- **Prerequisites:** Logged in as `owner@sweetdelight.com`.
- **Exact Browser Actions:**
  1. Click **Products** in sidebar (`/dashboard/owner/products`).
  2. Click **Orders** in sidebar (`/dashboard/owner/orders`).
  3. Click **Settings** in sidebar (`/dashboard/owner/settings`).
  4. Click **Subscription** in sidebar (`/dashboard/owner/subscription`).
- **Expected Result:**
  - Each page transitions smoothly without flashing the login screen.
  - No 401 Unauthorized errors appear in console.
- **How to Verify:** Inspect DevTools Console for zero authentication errors.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

---

### Test Suite 8: Logout & Server-Side JWT Revocation

#### Test Case TC-LOGOUT-01: Explicit Logout & Local Cache Eviction
- **Feature:** Explicit logout action
- **Prerequisites:** Logged in as `owner@sweetdelight.com` on `http://localhost:3001/dashboard/owner`.
- **Exact Browser Actions:**
  1. Open DevTools (F12) -> Application tab -> Local Storage -> `http://localhost:3001`.
  2. Confirm `cakestore_token` and `cakestore_user` exist.
  3. Locate the **Sign Out** / **Logout** button at bottom of sidebar and click it.
- **Expected Result:**
  - `POST /api/auth/logout` is dispatched with Authorization Bearer header.
  - Response status is HTTP 200 with `{"message": "Successfully logged out."}`.
  - Browser localStorage keys `cakestore_token` and `cakestore_user` are completely removed.
  - User is redirected to `/login`.
- **How to Verify:**
  - URL changes to `/login`.
  - Local Storage contains no `cakestore_token`.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

#### Test Case TC-LOGOUT-02: Server-Side Revocation Enforcement on Copied JWT
- **Feature:** Server-side token blacklisting (`revoked_tokens`)
- **Prerequisites:** Logged in as `owner@sweetdelight.com`.
- **Exact Browser Actions:**
  1. Before clicking Logout, open DevTools Console and copy the active token:
     ```javascript
     console.log(localStorage.getItem('cakestore_token'));
     ```
  2. Click **Logout**.
  3. After redirection to `/login`, attempt to call a protected endpoint using the copied token via DevTools Console `fetch`:
     ```javascript
     fetch('http://localhost:8080/api/owner/shops/me', {
       headers: { 'Authorization': 'Bearer ' + '<PASTE_COPIED_TOKEN_HERE>' }
     }).then(r => console.log('Response Status:', r.status));
     ```
- **Expected Result:**
  - The fetch response prints `Response Status: 401`.
  - Backend `JwtAuthenticationFilter` matches the token hash in `revoked_tokens` table and rejects it immediately.
- **How to Verify:** Console logs status `401 Unauthorized`.
- **Dependencies:** Requires local backend with database.
- **Cleanup:** None.

---

### Test Suite 9: Password Recovery Using Development Email Sink

#### Test Case TC-RECOVER-01: Forgot Password Request & Anti-Enumeration
- **Feature:** Password recovery request (`/forgot-password`)
- **Prerequisites:** Backend running with `dev` profile. Incognito browser window.
- **Exact Browser Actions:**
  1. Navigate to `http://localhost:3001/forgot-password`.
  2. Enter valid registered email: `owner@sweetdelight.com`.
  3. Click **Send Reset Link**.
  4. Note the displayed message.
  5. In a new tab, navigate to `http://localhost:3001/forgot-password`.
  6. Enter non-existent email: `doesnotexist9999@example.com`.
  7. Click **Send Reset Link**.
  8. Note the displayed message.
- **Expected Result:**
  - Both existing and non-existing email submissions respond with HTTP 200.
  - Both display the identical anti-enumeration message:  
    `If an account exists for this email, you'll receive a password reset link shortly.`
  - No user existence information is leaked to the UI or network response.
- **How to Verify:** Network responses are identical across both requests.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

#### Test Case TC-RECOVER-02: Reset Link Extraction via Dev Email Sink
- **Feature:** DevEmailSink token retrieval in local development
- **Prerequisites:** TC-RECOVER-01 executed for `owner@sweetdelight.com`.
- **Exact Browser Actions:**
  1. To inspect the captured email without external email services, query the local dev sink endpoint (using curl or authenticated browser session):
     ```powershell
     # Using PowerShell / curl against local dev sink:
     curl.exe -s "http://localhost:8080/api/dev/emails?to=owner@sweetdelight.com"
     ```
  2. Alternatively, inspect the backend terminal log output. Note that Phase 3B.3 sanitized the terminal log to `#token=[REDACTED]` for security, so the raw token is safely retrieved from the DevEmailSink in memory.
  3. Extract the reset link containing the raw token:
     `http://localhost:3001/reset-password#token=<RAW_TOKEN>`
- **Expected Result:**
  - DevEmailSink returns the email body containing the complete reset link with `#token=...`.
- **How to Verify:** JSON array returned by dev endpoint contains the reset link with token hash fragment.
- **Dependencies:** Requires backend running with `dev` or `local` profile.
- **Cleanup:** None.

---

### Test Suite 10: Password Reset, Expiry, Single-Use & Session Invalidation

#### Test Case TC-RESET-01: End-to-End Password Reset
- **Feature:** Reset password page (`/reset-password#token=...`)
- **Prerequisites:** Valid reset link extracted from TC-RECOVER-02.
- **Exact Browser Actions:**
  1. Paste the reset link into browser address bar:  
     `http://localhost:3001/reset-password#token=<RAW_TOKEN>`
  2. Verify the Reset Password form renders with New Password and Confirm Password inputs.
  3. Enter New Password: `NewStrongPassword123!`
  4. Enter Confirm Password: `NewStrongPassword123!`
  5. Click **Reset Password**.
- **Expected Result:**
  - `POST /api/auth/reset-password` responds with HTTP 200.
  - Success message displays: `Password has been successfully reset.`
  - Button offers link: **Return to Login**.
- **How to Verify:**
  - Navigate to `/login`.
  - Log in with old password `password123`: Fails with `401 Invalid credentials`.
  - Log in with new password `NewStrongPassword123!`: Succeeds and redirects to `/dashboard/owner`.
- **Dependencies:** Requires local backend.
- **Cleanup:** Restore original test password `password123` via same flow or database reset.

#### Test Case TC-RESET-02: Single-Use Token Enforcement
- **Feature:** Consumed token rejection
- **Prerequisites:** The reset token consumed in TC-RESET-01.
- **Exact Browser Actions:**
  1. In browser, navigate again to the same reset link:  
     `http://localhost:3001/reset-password#token=<ALREADY_USED_TOKEN>`
  2. Enter a new password: `AnotherPassword123!`
  3. Click **Reset Password**.
- **Expected Result:**
  - Backend responds with HTTP 400 Bad Request.
  - Error banner displays: `Failed to reset password. The link may have expired.`
  - The already-consumed token cannot be reused under any circumstances.
- **How to Verify:** Network tab shows `400 Bad Request`.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

#### Test Case TC-RESET-03: Multi-Session Invalidation After Password Reset
- **Feature:** Cross-device session termination via `token_version` bump
- **Prerequisites:** Two different browsers (e.g. Chrome and Edge) or one normal window and one incognito window.
- **Exact Browser Actions:**
  1. In **Browser A**, log in as `owner@sweetdelight.com` and open `/dashboard/owner`.
  2. In **Browser B**, perform a password reset for `owner@sweetdelight.com` using TC-RECOVER-01 and TC-RESET-01.
  3. Return to **Browser A** (where the old session was still active).
  4. Click on **Orders** or refresh the page in **Browser A**.
- **Expected Result:**
  - Browser A's subsequent API request fails with HTTP 401 Unauthorized because its JWT has a stale `token_version`.
  - `client.ts` intercepts the 401 and automatically redirects Browser A to `/login?session_expired=true`.
  - The compromised or old session on Browser A is completely terminated.
- **How to Verify:** Browser A is forced to login page. Cannot access dashboard.
- **Dependencies:** Requires local backend and two browser contexts.
- **Cleanup:** None.

---

### Test Suite 11: Public Health & Restricted Actuator Endpoints

#### Test Case TC-ACTUATOR-01: Public Health & Info Endpoints Access
- **Feature:** Public service monitoring
- **Prerequisites:** Backend running on `http://localhost:8080`.
- **Exact Browser Actions:**
  1. Open a new browser tab and navigate directly to:
     - `http://localhost:8080/api/health`
     - `http://localhost:8080/actuator/health`
     - `http://localhost:8080/actuator/info`
- **Expected Result:**
  - All three endpoints return HTTP 200 OK without requiring authentication headers.
  - Response JSON indicates status: `{"status": "UP"}`.
- **How to Verify:** Inspect JSON response in browser window. HTTP status is 200.
- **Dependencies:** Requires local backend.
- **Cleanup:** None.

#### Test Case TC-ACTUATOR-02: Restricted Actuator Endpoints Protection
- **Feature:** Phase 3B.2 Actuator lockdown
- **Prerequisites:** Browser without authentication, and an incognito tab.
- **Exact Browser Actions:**
  1. In an unauthenticated browser tab, navigate directly to:
     - `http://localhost:8080/actuator/prometheus`
     - `http://localhost:8080/actuator/beans`
     - `http://localhost:8080/actuator/env`
  2. In DevTools Console of an authenticated `SHOP_OWNER` session, attempt to fetch:
     ```javascript
     fetch('http://localhost:8080/actuator/prometheus', {
       headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cakestore_token') }
     }).then(r => console.log('Owner Access Status:', r.status));
     ```
  3. In DevTools Console of an authenticated `ADMIN` session, attempt to fetch:
     ```javascript
     fetch('http://localhost:8080/actuator/prometheus', {
       headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cakestore_token') }
     }).then(r => console.log('Admin Access Status:', r.status));
     ```
- **Expected Result:**
  - Unauthenticated visitor: Returns **401 Unauthorized**.
  - Authenticated `SHOP_OWNER`: Returns **403 Forbidden**.
  - Authenticated `ADMIN`: Returns **200 OK** with Prometheus metric streams.
- **How to Verify:** Console logs and network response codes confirm 401 for anonymous, 403 for owner, and 200 for admin.
- **Dependencies:** Requires local backend with demo accounts.
- **Cleanup:** None.

---

## 5. Evidence Collection Guidelines

When performing manual verification against this checklist, the tester must capture the following evidence for each test case:

1. **Screenshot Evidence:**
   - Full-page or viewport screenshot showing URL bar, UI state, and visible banners.
   - For validation tests: Screenshot showing inline error badges and highlighted inputs.
   - For multi-step onboarding: Screenshots of Step 1, Step 2, Step 3, and completion.
2. **Network Logs (HAR or DevTools Network Screenshot):**
   - HTTP method, URL endpoint, status code, and response payload headers.
   - Critical for 409 Conflict, 401 Unauthorized, and 403 Forbidden verifications.
3. **Console Log Cleanliness:**
   - Screenshot of DevTools Console showing absence of unexpected unhandled exceptions or React hydration errors.
4. **Local Storage Inspection:**
   - Screenshot of Application -> Local Storage verifying key presence during active sessions and absence after logout.

---

## 6. Verified Automated Tests vs. Unverified Browser Checks

The matrix below contrasts the existing test coverage executed during Phase 3B against the interactive browser flows documented in this checklist:

| Verification Scope | Automated Backend / Node Test Status | Browser Verification Status | Notes |
| :--- | :---: | :---: | :--- |
| **Owner Registration (Step 1-3)** | **VERIFIED** (`RegistrationIdentityIntegrityTest`) | **Pending Manual QA** | Automated test verifies DB entity creation; browser test verifies UI transitions & CSS |
| **FSSAI Document Upload** | **VERIFIED** (MockMultipartFile test) | **Pending Manual QA** | Browser test verifies drag-and-drop & 5MB client-side rejection UI |
| **Leaflet Map Pin Drop** | **NOT AUTOMATED** (UI Leaflet widget) | **Pending Manual QA** | Interactive map pin positioning requires human visual verification |
| **Duplicate 409 Field Errors** | **VERIFIED** (`RegistrationIdentityIntegrityTest`) | **Pending Manual QA** | Automated test validates 409 payload; browser test validates step 1 bounce-back & inline badge |
| **Login via Email & Mobile** | **VERIFIED** (`RegistrationIdentityIntegrityTest`) | **Pending Manual QA** | Verified via API; browser test validates autofill & password reveal toggle |
| **Owner Dashboard Guard** | **VERIFIED** (`ownerDashboardAuthGuard.test.mjs`) | **Pending Manual QA** | Unit tests verify redirect logic; browser test verifies smooth transition without flicker |
| **Server Logout Revocation** | **VERIFIED** (`JwtSessionInvalidationAndStabilityTest`) | **Pending Manual QA** | Automated test confirms token hash in DB; browser test verifies localStorage eviction |
| **Password Recovery Flow** | **VERIFIED** (`PasswordRecoveryEmailFlowTest`) | **Pending Manual QA** | Automated test verifies Resend delegation; browser test verifies end-to-end user experience |
| **Anti-Enumeration Response** | **VERIFIED** (`PasswordResetTest`) | **Pending Manual QA** | Identical response verified at HTTP layer; browser check confirms UI rendering |
| **Multi-Tab Session Drop** | **VERIFIED** (`JwtSessionInvalidationAndStabilityTest`) | **Pending Manual QA** | Verified via test tokens; browser check confirms dual-tab behavior in real browser |
| **Actuator Access Matrix** | **VERIFIED** (`ActuatorSecurityHardeningTest`) | **Pending Manual QA** | 11 automated security tests pass; browser check confirms direct browser navigation behavior |

---

## 7. Known Limitations & Blocked Scenarios

1. **Live External Email Delivery (Resend API):**
   - In local development without a configured production `RESEND_API_KEY`, emails are routed through `DevEmailSink` and logged in development format.
   - Browser verification of password reset uses `DevEmailSink` (`GET /api/dev/emails?to=...`) or local server logs. Testing real inbox delivery requires a verified domain in Resend and valid production credentials.
2. **Live SMS Verification (OTP):**
   - SMS payloads are logged locally (`app.sms.log-payloads: true`). No live SMS messages are transmitted to real carrier networks in development.
3. **External Map Tiles in Offline Mode:**
   - The interactive Leaflet map fetches tiles from OpenStreetMap (`tile.openstreetmap.org`). If testing without internet access, tile images will fail to load, although coordinate pin selection remains functional.
4. **Razorpay Live Payments in Onboarding (Step 4):**
   - Step 4 subscription payment relies on Razorpay test keys (`rzp_test_...`). Live banking transactions must never be executed during test runs.

---

## 8. Final Browser Readiness Assessment

| Evaluation Dimension | Verdict | Justification |
| :--- | :---: | :--- |
| **Backend Test Stability** | **READY** | All 44 auth, JWT, Actuator, and email tests pass with zero errors. |
| **Frontend Build Quality** | **READY** | All 38 Next.js routes compile cleanly; 217 frontend tests pass. |
| **Security Hardening** | **READY** | Actuator restricted to `ROLE_ADMIN`; JWT secrets validated; token hashes masked in logs. |
| **Route Protection** | **READY** | `OwnerAuthGuard` in place on owner dashboard; `AdminGuard` in place on admin portal. |
| **Overall Manual QA Readiness** | **READY FOR EXECUTION** | The test suite is fully specified, safe, reproducible, and ready for human or automated browser execution. |

---
*End of Checklist — CakeStore Phase 3C Complete. No code or configuration modified.*
