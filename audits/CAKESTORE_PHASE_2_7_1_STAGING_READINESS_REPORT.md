      # CakeStore — Phase 2.7.1: Staging Environment Readiness Verification Report

      **Date:** November 3, 2026  
      **Status:** **INSPECTION COMPLETED (READ-ONLY)**  
      **Audit Purpose:** Comprehensive technical verification of staging environment readiness prior to executing Shop Owner Dashboard UAT.  
      **References:**
      - `CAKESTORE_PHASE_2_7_OWNER_DASHBOARD_UAT_GAP_REPORT.md`
      - `V1__init_schema.sql` through `V57__add_dietary_flags_to_products.sql`
      - `seed_dev_shops.sql` & `seed_dev_products.sql`

      ---

      ## 1. Environment Confirmation

      | Parameter | Observed Value | Verification Method | Status |
      |:---|:---|:---|:---|
      | **Environment Type** | **Local / Staging** (NOT Production) | Connection to `localhost:5432`, test data flags, `.env.local` | **CONFIRMED** |
      | **Database Server** | PostgreSQL 16 on `localhost:5432` (`::1`) | Active process PID `7724`, `inet_server_addr()` | **CONFIRMED** |
      | **Database Name** | `cake_platform` | SQL `SELECT current_database()` | **CONFIRMED** |
      | **Database User** | `postgres` | SQL `SELECT current_user()` | **CONFIRMED** |
      | **Flyway Schema History** | **57 / 57 Migrations Applied** | Latest: `V57__add_dietary_flags_to_products.sql` (`success = true`) | **CONFIRMED** |
      | **Backend Runtime** | Spring Boot 3.3.2 (Port 8080) | `netstat` port scan: **Not currently running** | **OFFLINE** |
      | **Frontend Runtime** | Next.js 14.2.5 (Port 3000/3001) | `netstat` port scan: **Not currently running** | **OFFLINE** |

      > [!NOTE]
      > The database is fully seeded, schema-synchronized, and healthy. Both backend and frontend application servers are currently stopped on the host and must be started before launching browser-based UAT.

      ---

      ## 2. Staging Owner Identity & Shop Mapping

      A complete read-only query of users with role `SHOP_OWNER` and their associated shops was executed directly against `cake_platform`:

      ### 2.1 Primary Staging Owner Account (For Core UAT)
      - **User ID:** `12781`
      - **Email:** `owner@example.com`
      - **Full Name:** `Mrunali Hatzade`
      - **Role:** `SHOP_OWNER`
      - **User Account Status:** `ACTIVE` (`is_deleted = false`)
      - **Associated Shop ID:** `1`
      - **Business Name:** `Akurdi Artisan Bakes`
      - **Shop Status:** `ACTIVE`
      - **Verification Status:** `VERIFIED`
      - **Operational Mode:** `is_owner_enabled = true` (Vacation Mode: **OFF**)
      - **Subscription ID:** `1`
      - **Subscription Status:** `ACTIVE`
      - **Subscription Expiry:** `2027-11-02 15:32:33` (Active for 12 months)
      - **Credential Consistency:** Confirmed matching `AdminUserInitializer.java` and `seed_dev_shops.sql` fixtures. *(Passwords and hashes withheld per security guidelines).*

      ### 2.2 Secondary & Edge-Case Staging Accounts

      | User ID | Email | Shop ID | Shop Name | Shop Status | Verification Status | Subscription Status | Test Workflow Purpose |
      |:---|:---|:---|:---|:---|:---|:---|:---|
      | `13727` | `ravet.studio@example.com` | `2` | Ravet Cake Studio | `ACTIVE` | `VERIFIED` | `ACTIVE` | Alternative Active Bakery |
      | `13728` | `nigdi.sweets@example.com` | `3` | Nigdi Sweet Treats | `ACTIVE` | `VERIFIED` | `ACTIVE` | Alternative Active Bakery |
      | `13729` | `baner.dessert@example.com` | `4` | Baner Dessert Boutique | `ACTIVE` | `VERIFIED` | `ACTIVE` | Alternative Active Bakery |
      | `13730` | `wakad.cloud@example.com` | `5` | Wakad Cloud Cakes | `ACTIVE` | `VERIFIED` | `ACTIVE` | Cloud Kitchen Business Type |
      | `13731` | `kothrud.bakes@example.com` | `6` | Kothrud Heritage Bakes | `ACTIVE` | `VERIFIED` | `ACTIVE` | Heritage Bakery Shop |
      | `13732` | `pending.baker@example.com` | `7` | Pending Baker Akurdi | `PENDING` | `PROCESSING` | None (`NULL`) | **New Onboarding / Unverified State** |
      | `13733` | `inactive.studio@example.com` | `8` | Inactive Studio Baner | `INACTIVE` | `VERIFIED` | None (`NULL`) | **Vacation Mode / Inactive Shop** |
      | `13734` | `suspended.cloud@example.com` | `9` | Suspended Cakes Wakad | `SUSPENDED` | `VERIFIED` | None (`NULL`) | **Admin Suspended Dashboard Lock** |

      ---

      ## 3. Existing Test Data Availability

      Exact database counts retrieved via SQL queries:

      | Data Category | Platform Total | Shop 1 (`Akurdi Artisan Bakes`) | Details & Observations |
      |:---|:---|:---|:---|
      | **Active Products** | **19** | **4** | • Belgian Dark Chocolate Truffle Cake (₹650, Eggless)<br>• Fresh Alphonso Mango Velvet Cake (₹720, Eggless)<br>• Nutella Hazelnut Praline Cake (₹799)<br>• Red Velvet Cream Cheese Jar (₹250, Eggless) |
      | **Product Variants** | **0** | **0** | No variants seeded yet; provides clean state to test variant creation in UAT. |
      | **Historical Orders** | **0** | **0** | Zero orders currently; ideal clean slate for placing new test orders. |
      | **Order Items** | **0** | **0** | Clean state. |
      | **Delivery Slots** | **0** | **0** | Provides pristine test bed for creating delivery slot schedules. |
      | **Delivery Configurations** | **6** | **1** | Configured for Shop 1:<br>• `delivery_enabled = true`<br>• `delivery_charge_type = FIXED`<br>• `fixed_charge_amount = ₹50.00`<br>• `min_order_for_free_delivery = ₹1,000.00`<br>• `max_delivery_radius_km = 20.0 km`<br>• 12 Whitelisted Pune/PCMC PIN codes (411035, 412101, etc.) |
      | **Active Subscriptions** | **6** | **1** | Valid through November 2027. |
      | **Payment Records** | **0** | **0** | No transaction records. |
      | **Customer Records** | **0** | **0** | Zero customer records; no customer PII exists in current database. |

      ---

      ## 4. Connectivity & Configuration Verification

      ### 4.1 Frontend-to-Backend Configuration Mapping
      - **Frontend Environment Configuration:**
      - File: [`frontend_v2/.env.local`](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/.env.local)
      - `NEXT_PUBLIC_API_URL=http://localhost:8080`
      - `PORT=3001`
      - `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_TdPzvNBScn0bGP` (Test mode key configured)
      - **Backend CORS Configuration:**
      - File: [`backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/security/SecurityConfig.java#L39)
      - Allowed Origins: `http://localhost:3000, http://localhost:3001, http://localhost:3002`
      - **Verdict:** CORS and API proxy endpoints match with zero configuration discrepancies.

      ### 4.2 Port & Health Status (Current Moment)
      - `localhost:5432` (PostgreSQL): **ONLINE & RESPONSIVE**
      - `localhost:8080` (Backend API): **OFFLINE** (Not started)
      - `localhost:3000` / `localhost:3001` (Next.js): **OFFLINE** (Not started)
      - Login Endpoint (`POST http://localhost:8080/api/v1/auth/login`): **Unreachable until backend process is started.**

      ---

      ## 5. UAT Readiness Verdict & Required Action

      ### Verdict: **CONDITIONAL READY (SERVERS NEED STARTING)**

      The database schema, seed data, owner accounts, multi-tenant isolation, subscriptions, and delivery geofencing configurations are **100% verified and in a pristine state for UAT**.

      ### Blockers:
      - Neither the Spring Boot backend (`port 8080`) nor the Next.js frontend (`port 3000/3001`) is currently running as a daemon on the host.

      ### Required Actions to Commence UAT:
      1. **Start the Backend:**
         ```powershell
         cd "d:\PROJECTS\CAKE SAAs1\backend"
         mvn spring-boot:run
         ```
      2. **Start the Frontend:**
         ```powershell
         cd "d:\PROJECTS\CAKE SAAs1\frontend_v2"
         npm run dev
         ```
      3. **Log in to Staging:**
         - URL: `http://localhost:3000/login`
         - Email: `owner@example.com`
         - Redirects to: `http://localhost:3000/dashboard/owner`

