# CakeStore — PostgreSQL & Flyway Production Readiness Audit

**Document Version:** 1.0  
**Audit Date:** October 2026  
**Audit Scope:** PostgreSQL Configuration, Flyway Migrations (V1–V49), JPA Entity Mappings, Database Deployment Safety  
**Audit Type:** Strict Read-Only Audit (Source-Level Inspection & Architecture Analysis)  
**Executive Verdict:** **PARTIAL — READINESS GAPS IDENTIFIED**

---

## 1. Executive Summary & Verdict

### Executive Verdict: **PARTIAL**

A rigorous, read-only architectural audit was conducted across CakeStore's backend configuration (`application.yml`, `application-prod.yml`), all 49 Flyway migration scripts (`V1` through `V49`), and all JPA entity classes.

1. **Schema & Migration Pipeline Health:**  
   The migration sequence from `V1` to `V49` is well-ordered without version gaps, duplicates, or out-of-order timestamps. All 49 scripts adhere strictly to Flyway versioning conventions (`V<N>__<description>.sql`). Core domains (users, shops, products, subscriptions, orders, payments, admin notifications, broadcast history) have mature DDL definitions.
2. **Critical Fresh-Database Blocker Identified:**  
   The JPA entity [`GlobalSettings.java`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/GlobalSettings.java) (`@Table(name = "global_settings")`) is managed by Hibernate, which enforces `ddl-auto: validate`. However, **no Flyway migration exists to create the `global_settings` table**. On any fresh PostgreSQL deployment (or staging environment spun up from scratch), backend startup will immediately fail with `SchemaManagementException: Missing table: global_settings`.
3. **Database Configuration:**  
   Production configuration enforces zero hardcoded secrets and delegates database credentials strictly to environment variables (`${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}`). Connection pooling is managed via HikariCP with sensible defaults (max pool size 20 in prod). Hibernate `ddl-auto: validate` prevents accidental runtime schema alteration.
4. **Production Verification Limitation:**  
   Direct read-only network access to Azure PostgreSQL / production DB was unavailable in the local environment. Production Flyway history (`flyway_schema_history`) and live schema state remain unverified.

---

## 2. Database Configuration Audit

| Configuration Item | File & Line | Evaluation / Finding | Risk Level |
| :--- | :--- | :--- | :--- |
| **Connection URL** | [`application.yml:L6`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L6)<br>[`application-prod.yml:L3`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml#L3) | Dev has fallback to local PostgreSQL (`localhost:5432/cake_platform`). Prod strictly requires `${DB_URL}` without fallback. | **PASS** |
| **Credentials** | [`application.yml:L7-8`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L7-8)<br>[`application-prod.yml:L4-5`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml#L4-5) | Prod uses `${DB_USERNAME}` and `${DB_PASSWORD}` without default values. No sensitive credentials hardcoded. | **PASS** |
| **Hikari Connection Pool** | [`application.yml:L10-15`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L10-15)<br>[`application-prod.yml:L6-11`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml#L6-11) | Dev pool max: 10, min-idle: 2. Prod pool max: 20, min-idle: 5. Connection timeout: 20,000ms. Max lifetime: 30 minutes. | **PASS** |
| **Hibernate DDL Auto** | [`application.yml:L19`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L19) | Set to `validate`. Hibernate validates entities against the database schema on boot and does not execute DDL. Inherited by `application-prod.yml`. | **PASS** |
| **Flyway Migration Config** | [`application.yml:L26-29`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L26-29) | `flyway.enabled: true`, `baseline-on-migrate: true`, `locations: classpath:db/migration`. Flyway runs automatically on startup. | **PASS** |
| **Accidental Profile Leakage** | [`application-prod.yml`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application-prod.yml) | If `${SPRING_PROFILES_ACTIVE}` is unset, Spring falls back to `default` (which points to `localhost`). Will not connect to unintended remote database. | **PASS** |

---

## 3. Flyway Migration Inventory & Sequence (V1 to V49)

All 49 migration files in [`backend/src/main/resources/db/migration/`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/) were audited:

| Version Range | Primary Purpose & Domain | Key Tables / Columns Touched | Syntax / Risk Evaluation |
| :--- | :--- | :--- | :--- |
| **V1** | Initial Core Schema | `users`, `shops`, `products`, `subscriptions`, `payments`, `orders`, `order_items`, `activity_logs` | Standard DDL, foreign keys, indexes. |
| **V2 – V5** | Location, Subscriptions, Notifications, Orders | `user_locations`, `subscription_plans`, `notifications`, `shop_payout_details` | Coherent incremental additions. |
| **V6 – V10** | Feedback, Variants, Coupons, Categories, Admin Comms | `platform_feedback`, `contact_enquiries`, `cake_variants`, `coupons`, `admin_notifications` | Supports admin communication suite. |
| **V11 – V15** | Reviews, Ingredients, Bakery Gallery, Delivery | `product_reviews`, `allergens`, `storefront_settings`, `shop_delivery_configs` | Storefront enhancements. |
| **V16 – V20** | Data Cleanup, Owner Identity, Spatial Indexes | Unique constraint on owner phone, canonical Indian location hierarchy | Includes cleanup queries and GIS/trigram indexes. |
| **V21 – V25** | Seed Plans, Plan IDs, Webhook Idempotency, Performance | `subscription_plans` seeded, `payments.plan_id`, `webhook_events`, guest order tracking | `webhook_events` ensures payment webhook deduplication. |
| **V26 – V30** | Order Pagination, Media Feedback, Chat Tables | Pagination indexes, `chat_rooms`, `chat_messages` | Real-time chat & review media. |
| **V31 – V35** | Feedback Edit Tokens, Customer Mobile, Storefront CC | `enquiries.customer_mobile`, `subscription_plans.display_order` | Safe schema extensions. |
| **V36 – V40** | Broadcast History, Soft Deletes, Admin Enquiries | `broadcast_history`, soft-delete flags, `contact_enquiries.admin_reply` | Communication & administrative audits. |
| **V41 – V46** | Passwordless Customers, Historical Orders, Addresses | `customer_saved_addresses`, `orders.razorpay_order_id`, social links | Customer and payment tracking. |
| **V47** | Marketplace Restrictions & Operational Status | `shops.is_owner_enabled`, `shops.is_marketplace_restricted`, subscription cancellation fields | Safe conditional DDL (`ADD COLUMN IF NOT EXISTS`). |
| **V48** | Admin Reply to Platform Feedback | `platform_feedback.admin_reply`, `replied_at` | Idempotent `IF NOT EXISTS` syntax. |
| **V49** | Broadcast History Idempotency & Concurrency | `broadcast_history.idempotency_key`, `status`, `payload_hash`, `lease_token`, `lease_expires_at` | Backfills legacy rows deterministically; adds `UNIQUE` constraint. |

---

## 4. Entity-to-Schema Consistency Findings

| Entity / Domain | DB Table Name | Migration Status | Entity Mapping Match | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **`GlobalSettings`** | `global_settings` | **MISSING IN ALL MIGRATIONS** | [`GlobalSettings.java:L10`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/settings/GlobalSettings.java#L10) maps `id`, `platform_name`, `support_email`, `razorpay_key_id`, `razorpay_key_secret`, `razorpay_webhook_secret`, `platform_currency`, `updated_at`. No migration creates this table. | **CRITICAL** |
| **`User`** | `users` | `V1`, `V2`, `V17`, `V39` | Matches entity fields including soft-delete and phone verification. | **PASS** |
| **`Shop`** | `shops` | `V1`, `V16`, `V37`, `V38`, `V46`, `V47` | Matches all fields including `is_owner_enabled`, `is_marketplace_restricted`, `inactive_reason`. | **PASS** |
| **`Product`** | `products` | `V1`, `V7`, `V9`, `V12`, `V38` | Matches categories, variants, and soft deletes. | **PASS** |
| **`Subscription`** | `subscriptions` | `V1`, `V3`, `V47` | Matches `is_active`, `cancelled_at`, `cancellation_reason`. | **PASS** |
| **`Payment`** | `payments` | `V1`, `V3`, `V22`, `V44` | Matches `plan_id`, `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. | **PASS** |
| **`Order` / `OrderItem`** | `orders`, `order_items` | `V1`, `V5`, `V25`, `V41`, `V42`, `V45` | Matches `razorpay_order_id`, `special_instructions`, `guest_id`. | **PASS** |
| **`PlatformFeedback`** | `platform_feedback` | `V6`, `V27`, `V31`, `V48` | Matches `admin_reply`, `replied_at`, `cake_media`, `rating`. | **PASS** |
| **`ContactEnquiry`** | `contact_enquiries` | `V6`, `V32`, `V40` | Matches `admin_reply`, `customer_mobile`, `status`. | **PASS** |
| **`AdminNotification`** | `admin_notifications` | `V10` | Matches `title`, `message`, `type`, `read`, `action_url`, `created_at`. | **PASS** |
| **`WebhookEvent`** | `webhook_events` | `V23` | Matches `event_id`, `event_type`, `payload`, `processed_at`. | **PASS** |
| **`BroadcastHistory`** | `broadcast_history` | `V36`, `V49` | Matches `idempotency_key`, `status`, `payload_hash`, `lease_token`, `lease_expires_at`, `failure_reason`. | **PASS** |

---

## 5. Detailed Risk Assessment

### 5.1 Fresh-Database Risks
- **Risk 1: Startup Crash on Missing `global_settings` Table (`CRITICAL`)**  
  Because Hibernate is configured with `ddl-auto: validate` in [`application.yml:L19`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L19), spinning up a brand-new staging or test database will run Flyway V1 through V49 and then execute Hibernate validation. Hibernate will halt application startup with:
  ```text
  org.hibernate.tool.schema.spi.SchemaManagementException: Schema-validation: missing table [global_settings]
  ```
  *Suspected origin:* In local development or earlier iterations, the table may have been created manually or when `ddl-auto: update` was temporarily active.

### 5.2 Existing-Database Upgrade Risks
- **Risk 2: Production Flyway Schema Drift (`HIGH`)**  
  In production, if `global_settings` was created manually via a direct SQL client without a recorded Flyway migration, adding a migration without `CREATE TABLE IF NOT EXISTS` could fail on production with `relation "global_settings" already exists`.
- **Risk 3: `baseline-on-migrate: true` Safety Margin (`MEDIUM`)**  
  [`application.yml:L28`](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/application.yml#L28) has `baseline-on-migrate: true`. For an existing non-empty database that never ran Flyway, Flyway baselines at V1. However, if any previously run migration scripts were modified in git after being applied, Flyway would throw a checksum mismatch error (`FlywayValidateException`).
  *Current status:* All historical migrations V1–V47 are standard and immutable; V48 and V49 are recent additions.

---

## 6. Recommended Minimal Remediation Plan

Before deploying any new builds to production or initializing fresh staging environments:

1. **Step 1: Create Migration `V50__create_global_settings_table.sql` (`CRITICAL`)**  
   Create an idempotent migration script at `backend/src/main/resources/db/migration/V50__create_global_settings_table.sql`:
   ```sql
   -- Flyway Migration V50: Create global_settings table for platform settings and gateway secrets
   CREATE TABLE IF NOT EXISTS global_settings (
       id BIGINT PRIMARY KEY DEFAULT 1,
       platform_name VARCHAR(255) DEFAULT 'CakeStore',
       support_email VARCHAR(255) DEFAULT 'support@cakestore.com',
       razorpay_key_id VARCHAR(255),
       razorpay_key_secret VARCHAR(500),
       razorpay_webhook_secret VARCHAR(500),
       platform_currency VARCHAR(10) DEFAULT 'INR',
       updated_at TIMESTAMP
   );

   -- Insert default singleton row if not present
   INSERT INTO global_settings (id, platform_name, support_email, platform_currency, updated_at)
   VALUES (1, 'CakeStore', 'support@cakestore.com', 'INR', CURRENT_TIMESTAMP)
   ON CONFLICT (id) DO NOTHING;
   ```
2. **Step 2: Non-Destructive Live Database Verification (`HIGH`)**  
   Prior to deployment, run read-only inspection queries against the target PostgreSQL database to verify existing tables and Flyway history:
   ```sql
   -- Check if global_settings already exists in target DB
   SELECT table_name FROM information_schema.tables WHERE table_name = 'global_settings';

   -- Check highest applied Flyway migration version
   SELECT installed_rank, version, description, type, script, installed_on, success
   FROM flyway_schema_history
   ORDER BY installed_rank DESC
   LIMIT 5;
   ```
3. **Step 3: Automated Schema Validation Smoke Test (`MEDIUM`)**  
   Execute backend test with an in-memory/test PostgreSQL container or local DB to ensure Hibernate `validate` passes 100% cleanly against the complete Flyway migration suite.

---

## 7. Audit Conclusion

The Flyway migration setup for CakeStore is structured and adheres to database engineering standards. However, because of the missing migration for the `global_settings` table, a fresh deployment cannot pass Hibernate's schema validation. Remediation requires adding `V50__create_global_settings_table.sql` using idempotent `IF NOT EXISTS` syntax to ensure 100% compatibility across both fresh and pre-existing databases.
