# CakeStore Broadcast Feature — Final Validated Repair Plan

**Document:** `CAKESTORE_BROADCAST_FINAL_REPAIR_PLAN.md`  
**Date:** October 16, 2026  
**Status:** READ-ONLY ARCHITECTURAL VALIDATION — AWAITING EXPLICIT APPROVAL BEFORE IMPLEMENTATION  
**Target Feature:** Admin Broadcast System (`/admin/messages`, `AdminMessageController`, `BroadcastService`, `NotificationService`, `EmailService`, `BroadcastHistory`, `broadcast_history` table)

---

## 1. Architectural Overview & Transaction Model

### 1.1 The Core Problem in Current Architecture
**[Verified Source Evidence]** In [AdminMessageController.java:L21-L26](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java#L21-L26), the controller immediately delegates to `@Async public void sendAndRecordBroadcast(AdminMessageRequest request)` and returns HTTP 200 without reserving a database record first. Duplicate requests (from network latency, retries, or double-clicks) spawn concurrent asynchronous worker threads that race each other. Neither thread knows of the other's existence until they attempt to insert history at the very end of processing, resulting in duplicated in-app notifications and duplicate emails.

### 1.2 The Consistent Transaction Model: Synchronous Reservation + Single Atomic Batch Transaction
**[Architectural Decision & Model Selection]**  
To eliminate contradictions between multi-transaction worker designs and crash recovery semantics, CakeStore strictly adopts the **Single Atomic Batch Transaction Model**. 

Under this model, the broadcast lifecycle consists of exactly two sequential database transaction boundaries (plus an isolated error boundary):

1. **Transaction 1: Synchronous Atomic Reservation (HTTP Request Thread)**
   - The admin client submits `POST /api/admin/messages` with an `idempotencyKey` UUID and request payload.
   - The controller executes Bean Validation (`@Valid`) synchronously.
   - The payload is normalized and cross-field validated (see Section 3.1).
   - The controller calls synchronous reservation (`broadcastService.reserveBroadcast(normalizedRequest)`).
   - This method executes inside a short-lived synchronous database transaction (`Transaction 1`) with an explicit lock timeout (`SET LOCAL lock_timeout = '2s';`).
   - An initial `lease_token = UUID.randomUUID()` and `lease_expires_at = NOW() + INTERVAL '60 seconds'` are generated.
   - An atomic native SQL `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id, lease_token` executes against `broadcast_history`.
   - **If a new row is inserted:** The row is stored with `status = 'RESERVED'`, `lease_token`, `lease_expires_at`, and a canonical `payload_hash`. **`Transaction 1` commits immediately.**
   - **If the key already exists:** `Transaction 1` reads the existing record by `idempotencyKey` and compares the incoming payload hash against the persisted `payload_hash`:
     - *Mismatch:* Returns **HTTP 409 Conflict** synchronously. No async processing is scheduled.
     - *Match:* Re-evaluates status and lease (see Section 1.3).
   - Only if a new row was inserted or a stale lease was reclaimed does the controller schedule the background task:  
     `broadcastService.processBroadcastAsync(broadcastHistoryId, leaseToken)`.
   - The controller immediately returns HTTP 200 OK `"Broadcast dispatched successfully. Processing in background."` to the client.

2. **Transaction 2: Single Atomic Batch Execution (Asynchronous Worker Thread)**
   - The background worker executes inside a single database transaction (`@Transactional public void processBatch(Long id, UUID workerLeaseToken)`).
   - **Step 1 (Startup Guard & Row-Lock Acquisition):**
     ```sql
     UPDATE broadcast_history
     SET status = 'PROCESSING', worker_heartbeat = NOW()
     WHERE id = :id AND status = 'RESERVED' AND lease_token = :workerLeaseToken
     RETURNING id;
     ```
     - *Zero rows returned:* The worker was fenced off (lease was reclaimed). The worker aborts immediately without touching recipients.
     - *One row returned:* The worker acquires an exclusive row-level lock (`X` lock) on `broadcast_history(id)`.
   - **Intermediate Visibility Rule:** Under PostgreSQL `READ COMMITTED` isolation, this `status = 'PROCESSING'` update is **uncommitted and strictly private to Worker 1's database session**. To every other concurrent transaction (client retries, UI history queries, or operator tools), the row **remains committed as `status = 'RESERVED'`**.
   - **Step 2 (Recipient Batch Processing):**
     The worker queries eligible active `SHOP_OWNER` accounts and inserts `Notification` entities into the `notifications` table within the same transaction.
   - **Step 3 (Completion Update):**
     ```sql
     UPDATE broadcast_history
     SET status = 'COMPLETED', recipient_count = :count, worker_heartbeat = NOW()
     WHERE id = :id AND lease_token = :workerLeaseToken AND status = 'PROCESSING'
     RETURNING id;
     ```
   - **Step 4 (Commit `Transaction 2`):**
     At the exact millisecond `Transaction 2` commits:
     - `broadcast_history.status` transitions atomically from `RESERVED` directly to `COMPLETED`.
     - All in-app `Notification` entities become visible simultaneously.
     - The exclusive row lock on `broadcast_history` is released.
   - **Step 5 (Post-Commit Dispatch):**
     Only AFTER `Transaction 2` commits, Spring's `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` executes, pushing WebSocket notifications and triggering best-effort emails.

3. **Transaction 3: Isolated Failure Persistence (`REQUIRES_NEW`)**
   - If an unhandled exception occurs in `Transaction 2`, `Transaction 2` rolls back completely (all recipient notifications discarded, row lock released, row reverts to committed `RESERVED`).
   - The execution coordinator catches the failure and delegates to `Transaction 3` (`Propagation.REQUIRES_NEW`), which transitions the committed `RESERVED` row to `FAILED`.

```
[ Admin Browser: /admin/messages ]
       │
       │ (1) POST /api/admin/messages { idempotencyKey, title, message, ... }
       ▼
[ AdminMessageController (Synchronous HTTP Thread) ]
       │
       │ (2) Bean Validation & Normalization (@Valid) -> 400 Bad Request on failure
       │ (3) broadcastService.reserveBroadcast(normalizedRequest)
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Transaction 1 (Synchronous, Read-Committed, lock_timeout=2s)│
│                                                             │
│ lease_token = UUID.randomUUID()                             │
│ lease_expires_at = NOW() + INTERVAL '60s'                   │
│ INSERT INTO broadcast_history (..., status='RESERVED',      │
│            lease_token=lease_token,                         │
│            lease_expires_at=lease_expires_at)               │
│ ON CONFLICT (idempotency_key) DO NOTHING                    │
│ RETURNING id, lease_token;                                  │
│                                                             │
│ ├── New Row Inserted:                                       │
│ │   Commit Transaction 1 -> Return (id, lease_token)        │
│ │                                                           │
│ └── Key Already Exists:                                     │
│     Compare canonical payload_hash:                         │
│     ├── Hash Differs -> Return HTTP 409 Conflict            │
│     └── Hash Matches:                                       │
│         ├── Row-Lock Timeout (Contention of Unknown Cause)   │
│         │   -> Return HTTP 429 Too Many Requests (Retry-After)│
│         │   (Zero async workers spawned; preserves key)     │
│         ├── status == 'COMPLETED' -> Return HTTP 200 OK     │
│         ├── status == 'FAILED' -> Return HTTP 409 Conflict  │
│         │   ("Terminal failure; please use a new key")      │
│         └── status == 'RESERVED':                           │
│             ├── lease_expires_at > NOW(): Return HTTP 200   │
│             │   ("Broadcast already queued or processing")  │
│             └── lease_expires_at <= NOW():                  │
│                 Atomic Lease Reclaim (Section 1.3.E)        │
└─────────────────────────────────────────────────────────────┘
       │
       │ (4) If New or Reclaimed Reservation:
       │     trigger processBroadcastAsync(id, lease_token)
       │ (5) Return HTTP 200 "Broadcast dispatched successfully..."
       ▼
[ BroadcastService.processBroadcastAsync(id, workerLeaseToken) ]
       │
┌─────────────────────────────────────────────────────────────┐
│ Transaction 2 (Single Atomic Batch Transaction)             │
│                                                             │
│ 1. Worker Startup Guard & Row-Lock Acquisition:             │
│    UPDATE broadcast_history SET status='PROCESSING', ...    │
│    WHERE id=:id AND status='RESERVED'                       │
│      AND lease_token=:workerLeaseToken RETURNING id;        │
│    (Acquires exclusive row lock; status='PROCESSING' is     │
│     UNCOMMITTED and invisible to other sessions)            │
│                                                             │
│ 2. Batch Execution:                                         │
│    Validate active SHOP_OWNERs                              │
│    Loop: notificationRepository.save(n)                     │
│          publishEvent(NotificationCreatedEvent)             │
│                                                             │
│ 3. Guarded Completion Update:                               │
│    UPDATE broadcast_history SET status='COMPLETED', ...     │
│    WHERE id=:id AND status='PROCESSING'                     │
│      AND lease_token=:workerLeaseToken RETURNING id;        │
│                                                             │
│ Commit Transaction 2:                                       │
│ - status transitions directly RESERVED -> COMPLETED         │
│ - all notifications committed atomically                    │
│ - row lock released                                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼ (Only AFTER Transaction 2 Commits)
[ Spring TransactionSynchronization: AFTER_COMMIT ]
       │
       ├──► Push WebSocket to /queue/notifications-{recipientId}
       └──► (If sentEmail=true) EmailService.sendEmail(...) [Async Best-Effort]
```

---

### 1.3 Lease and Transaction Concurrency: Row Locks, Timeouts, and Reclaim Mechanics

#### A. Row-Level Lock Contention and Unknown Contention Handling
**[Architectural Design Recommendation & Concurrency Clarification]**  
When Worker 1 begins batch execution in `Transaction 2`, its startup guard update acquires an exclusive row-level lock (`X` lock / `FOR UPDATE` lock) on that row in `broadcast_history`. This exclusive lock is held continuously until `Transaction 2` either commits (when all notifications are persisted) or rolls back.

If a client retry arrives while Worker 1's `Transaction 2` is still open (uncommitted):
1. The retry HTTP request thread executes `Transaction 1`.
2. The retry attempts an atomic conditional query or update on that row. In PostgreSQL `READ COMMITTED` isolation, any transaction attempting to update or `SELECT ... FOR UPDATE` a row currently locked by another uncommitted transaction will **block indefinitely** by default until the first transaction finishes.
3. **Indefinite Blocking Prevention:** `Transaction 1` MUST NOT block indefinitely.
   - `Transaction 1` explicitly sets a session/transaction lock timeout:
     `SET LOCAL lock_timeout = '2s';`
   - In Spring, the reservation method is annotated with `@Transactional(timeout = 5)`.

4. **Behavior on Lock Timeout (`CannotAcquireLockException`):**
   - If lock acquisition exceeds 2 seconds, PostgreSQL throws `ERROR: canceling statement due to lock timeout` (mapped by Spring to `CannotAcquireLockException`).
   - `Transaction 1` catches this exception.
   - **Crucial Concurrency Fact: The Cause of Contention is Unknown.**
     A lock timeout alone is **NOT proof that a background worker is actively processing**. Contention on the row can be caused by:
     - An active background worker executing bulk notification inserts.
     - A concurrent retry racing on the unique index or reservation logic.
     - Database-level operations (e.g. `VACUUM FULL`, index rebuilds, or row/table lock escalation).
     - An uncommitted manual query or transaction opened by an operator.
     - A hung or deadlocked transaction on the database connection.
   - **Safe Response & Idempotency Preservation:**
     - `Transaction 1` MUST roll back cleanly.
     - **No asynchronous worker is scheduled.** Preserving idempotency is paramount; scheduling another worker merely because lock contention occurred would guarantee dual-worker execution and duplicate notifications.
     - The controller returns a transient retryable error: **HTTP 429 Too Many Requests** (or HTTP 503 Service Unavailable) with header `Retry-After: 2` and response message:
       `"Resource contention detected on broadcast reservation. Lock timed out. Outcome is currently uncertain; please retry shortly."`
   - **Client Retry Behavior:**
     - Under Section 5's uncertain-submission lifecycle, the frontend preserves the locked payload and `idempotencyKey` in `sessionStorage` under `cake_admin_broadcast_active_submission`.
     - The admin UI displays the "Uncertain Submission Alert" banner, allowing an automatic retry after `Retry-After` seconds or a manual "Retry / Check Status" click using the **exact same idempotency key**.
     - When the retry arrives:
       - If Worker 1 has committed `COMPLETED`: The retry reads the committed state and returns **HTTP 200 OK** (`"Broadcast already dispatched and completed."`). Zero workers spawned.
       - If contention was caused by an unrelated query that ended and Worker 1 has not committed: The retry acquires the row lock and evaluates the reservation lease normally.
       - If contention persists: Returns HTTP 429 again, maintaining safety.

#### B. Status Vocabulary & Visible Lifecycle States
**[Architectural Invariant & Domain Model Definition]**  
To prevent semantic ambiguity across the codebase, documentation, and tests, the broadcast lifecycle is governed strictly by four explicit string values persisted in `broadcast_history.status`:

| Status Value | Transactional Visibility | Definition & Invariants |
| :--- | :--- | :--- |
| **`RESERVED`** | **Committed & Globally Visible** | Initial persisted state created in `Transaction 1`. Indicates the idempotency key is reserved and valid. If a worker is running or crashes before commit, the externally visible committed state remains `RESERVED`. Zero notifications exist. |
| **`PROCESSING`** | **Uncommitted & Private to Worker Session** | Set in `Transaction 2` via worker startup guard (`WHERE status = 'RESERVED'`). Acquires an exclusive row lock. Under PostgreSQL `READ COMMITTED` isolation, this state is **strictly uncommitted and invisible to all other database transactions**. If the worker crashes or connection drops, PostgreSQL rolls back `Transaction 2` and the row reverts to committed `RESERVED`. |
| **`COMPLETED`** | **Committed & Globally Visible** | Set at the conclusion of `Transaction 2` immediately prior to commit. Replaces all legacy terms (such as `SENT`). Indicates the batch transaction committed cleanly: all in-app notifications are saved and visible, and post-commit events (`AFTER_COMMIT`) are triggered. Immutable success state. |
| **`FAILED`** | **Committed & Globally Visible** | Terminal error state persisted via `Transaction 3` (`REQUIRES_NEW`) after an unhandled exception or manual operator termination. Indicates terminal failure. Immutable terminal state (retries return HTTP 409 Conflict). |

*Legacy Vocabulary Deprecation:* The term `SENT` is completely deprecated as a status value. Historical rows migrated under `V49` are backfilled with `status = 'COMPLETED'`. The column `sent_at` is preserved strictly as an immutable audit timestamp recording when the broadcast record was initially created.

---

#### C. Behavior When Lock is Acquired Immediately (Worker Committed, Failed, or Dropped)
When the retry thread acquires the row lock or reads committed state without lock contention:
1. **If committed `status == 'COMPLETED'`:**  
   Returns **HTTP 200 OK**: `"Broadcast already dispatched and completed."` (Zero workers spawned).
2. **If committed `status == 'FAILED'` (Terminal Failure Idempotency Policy):**  
   - In accordance with distributed idempotency standards, `FAILED` is an **immutable terminal state**.
   - Reclaiming or silently re-executing a failed key is strictly prohibited to prevent unexpected duplicate dispatch or zombie execution.
   - The backend returns **HTTP 409 Conflict** with message:  
     `"Broadcast attempt previously failed and cannot be re-executed with the same idempotency key. Failure reason: " + failureReason + ". Please compose a new broadcast with a fresh idempotency key."`
   - Zero workers are scheduled.
3. **If committed `status == 'RESERVED'`:**  
   The worker either never started (queued in executor) or died before transitioning:
   - **Active Lease (`lease_expires_at > NOW()`):**  
     The reservation is within its 60-second execution window. Proceed to Section 1.3.D.
   - **Stale Lease (`lease_expires_at <= NOW()`):**  
     The 60-second lease has expired. The original worker crashed or was dropped. Proceed to Atomic Stale Lease Reclamation (Section 1.3.E).

---

#### D. Trace of the Unexpired-Lease Failure Window: Crash Between Reservation Commit and Worker Scheduling
**[Architectural Analysis & Failure Trace]**

1. **The Exact Failure Window:**
   - Step 1: `Transaction 1` successfully inserts and commits the row with `status = 'RESERVED'`, `lease_token = Token_1`, `lease_expires_at = NOW() + INTERVAL '60 seconds'`.
   - Step 2: In the microsecond window immediately *after* `Transaction 1` commits but *before* `broadcastService.processBroadcastAsync(id, Token_1)` is submitted to Spring's `ThreadPoolTaskExecutor`, the JVM process abruptly crashes (fatal OOM, OS SIGKILL, container restart, or host power failure).
   - **State in Database:** `broadcast_history` row exists in committed `status = 'RESERVED'` with `lease_token = Token_1`. The `notifications` table has **0 rows**.
   - **External Side Effects:** **Zero WebSockets emitted, zero emails dispatched.**
   - **The Asynchronous Reality:** No asynchronous worker was ever placed into the executor queue.

2. **Retry During the Unexpired Lease Window (`lease_expires_at > NOW()`):**
   - Suppose a client retry arrives at $t = 15\text{ seconds}$ after initial submission (`lease_expires_at` has 45 seconds remaining).
   - **Why a Retry MUST NOT Preemptively Rotate the Lease or Dispatch a Worker During an Active Window:**
     - The database **cannot distinguish** between:
       a) The JVM crashed and no worker was ever scheduled, versus
       b) Worker 1 was successfully scheduled and is currently waiting in the Spring `@Async` executor queue under heavy server load.
     - If retries during the active lease window were permitted to preemptively rotate `lease_token` and queue a new worker, any rapid retry burst or double-click would preemptively fence off legitimately queued workers. This would flood the thread pool and guarantee that queued workers get fenced off before they even begin executing.
     - Therefore, the active lease duration ($\le 60\text{ seconds}$) functions as a **bounded, exclusive execution window**.
     - The retry acquires the row lock in `Transaction 1`, verifies `lease_expires_at > NOW()`, and returns:  
       **HTTP 200 OK**: `"Broadcast already queued or processing."`
     - **Worker Sched Count:** 0 new workers scheduled.
     - **Frontend State:** Under Section 5, the composer interface remains in `IN_FLIGHT`/`UNCERTAIN` state, keeping the form payload and `idempotencyKey` locked in `sessionStorage`.

3. **Deterministic Recovery After Lease Expiration (`lease_expires_at <= NOW()`):**
   - **Explicit Recovery Trigger:** Expired reservations are recovered **only when a client retry arrives** (via frontend uncertain-submission retry) or when an operator explicitly initiates a manual recovery procedure.
   - **No Automated Background Sweep:** There is **no automated background sweeper, cron job, or scheduled worker** included in this repair scope.
   - **Outcome if No Further Request Arrives:** If the process crashes and neither the client nor an administrator retries with the idempotency key, the row **remains permanently in `status = 'RESERVED'` with `lease_expires_at <= NOW()`**. Exactly zero notifications and zero emails are sent. The record remains an inert, expired reservation.
   - When a client retry *does* arrive after expiration ($t \ge 60\text{s}$):
     - The retry acquires the row lock in `Transaction 1` and runs the atomic lease reclaim update (Section 1.3.E).
     - This single-winner update rotates `lease_token` to `Token_2`, advances `lease_expires_at` by another 60 seconds, and schedules `processBroadcastAsync(id, Token_2)`.
     - The broadcast is safely and deterministically rescued with **zero duplicate risk**.

4. **Fencing Interaction if Worker 1 Was Actually Queued (Not Dead):**
   - Suppose Worker 1 was not dead, but was stalled in an overloaded executor queue for 65 seconds.
   - At $t = 61\text{s}$, a client retry reclaimed the lease and scheduled Worker 2 with `Token_2`.
   - At $t = 65\text{s}$, Worker 1 finally wakes up from the queue holding `Token_1`.
   - Worker 1 executes its startup guard:
     ```sql
     UPDATE broadcast_history
     SET status = 'PROCESSING', worker_heartbeat = NOW()
     WHERE id = :id AND status = 'RESERVED' AND lease_token = Token_1
     RETURNING id;
     ```
   - Because the database now holds `lease_token = Token_2`, Worker 1's update matches **0 rows**.
   - Worker 1 detects fencing, logs a warning, and aborts immediately without touching recipients or sending emails.
   - Worker 2 (holding `Token_2`) executes and completes the broadcast cleanly.
   - **Zero duplicate notifications and zero duplicate emails occur.**

5. **Architectural Limitation & Smallest Safe Design Choice:**
   > **Explicit Limitation:** Within CakeStore's architecture, in-memory queue state cannot be observed by PostgreSQL across a process crash. The bounded 60-second lease window is the smallest provably safe mechanism within the existing schema that guarantees zero duplicate dispatches while providing deterministic recovery upon retry.

---

#### E. Atomic Stale Lease Reclamation (Applicable Strictly to Committed `RESERVED` Rows)
To prevent race conditions where multiple concurrent retries arrive simultaneously after an outage and race to reclaim a stale lease:
```sql
UPDATE broadcast_history
SET lease_token = :newLeaseToken,
    lease_expires_at = NOW() + INTERVAL '60 seconds'
WHERE id = :id
  AND status = 'RESERVED'
  AND lease_expires_at <= NOW()
RETURNING id, lease_token;
```
- **Single Winner Guarantee:** PostgreSQL's row lock serializes the updates. Exactly **one** update matches `lease_expires_at <= NOW()`, advances `lease_expires_at` by 60 seconds, and rotates `lease_token`.
- **Winning Thread (1 row returned):** Schedules `processBroadcastAsync(id, newLeaseToken)` and returns HTTP 200 OK `"Broadcast re-queued for background processing."`.
- **Losing Thread (0 rows returned):** Matches 0 rows because `lease_expires_at` was already pushed into the future. Returns HTTP 200 OK `"Broadcast already queued or processing."` without scheduling duplicate workers.
- **Duplicate Processing Prevention:** A reclaimed lease was strictly in committed `RESERVED` state. In `RESERVED` state, zero notifications were written and zero emails were sent. Therefore, re-queuing creates zero duplicate side effects.

---

## 2. Failure Semantics, Manual Recovery, and Delivery Realities

### 2.1 Complete Inspection of Existing `BroadcastHistory.sent_at` Usages
**[Verified Source Evidence]** Every reference to `sent_at` / `sentAt` across the entire codebase was audited:
1. **Migration Schema:** [V36__add_broadcast_history.sql:L9](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V36__add_broadcast_history.sql#L9):  
   `sent_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()`
2. **JPA Entity Definition:** [BroadcastHistory.java:L42-L44](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java#L42-L44):  
   ```java
   @CreationTimestamp
   @Column(name = "sent_at", nullable = false, updatable = false)
   private LocalDateTime sentAt;
   ```
   Notice that `sent_at` is annotated with `@CreationTimestamp` and explicitly declared `updatable = false`. In Hibernate JPA, any entity update that modifies `sentAt` is silently ignored or rejected!
3. **Repository Ordering:** [BroadcastHistoryRepository.java:L10](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistoryRepository.java#L10):  
   `List<BroadcastHistory> findAllByOrderBySentAtDesc();`  
   All broadcast history returned to the admin UI is ordered strictly by `sent_at DESC`.
4. **Service Usage:** [BroadcastService.java:L69](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java#L69):  
   Calls `broadcastHistoryRepository.findAllByOrderBySentAtDesc()` to populate history.
5. **Frontend TypeScript DTO:** [frontend_v2/types/admin.ts:L160](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/types/admin.ts#L160):  
   `sentAt: string;` in `SentBroadcastRecord`.
6. **Frontend UI Rendering:** [frontend_v2/app/admin/messages/page.tsx:L320-L326](file:///d:/PROJECTS/CAKE%20SAAs1/frontend_v2/app/admin/messages/page.tsx#L320-L326):  
   ```tsx
   {new Date(bcast.sentAt).toLocaleDateString('en-IN', {
     day: 'numeric',
     month: 'short',
     year: 'numeric',
     hour: '2-digit',
     minute: '2-digit',
   })}
   ```
   The UI renders `sentAt` directly as the user-visible creation/dispatch date and time in the history feed.

#### Concrete Timestamp Semantic Rule:
- `sent_at` MUST NOT be repurposed for lease expiration or worker heartbeats.
- Repurposing `sent_at` would violate `@Column(updatable = false)`, corrupt user-facing history timestamps, and alter the chronological sorting of the history feed whenever a retry or lease reclaim occurs.
- **Resolution:** Migration `V49` introduces dedicated operational timestamp columns:
  - `lease_expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL` (governs reservation expiry and reclaim eligibility).
  - `worker_heartbeat TIMESTAMP WITHOUT TIME ZONE` (tracks background worker activity).
- `sent_at` remains completely untouched as the immutable submission timestamp.

---

### 2.2 Tracing Database State and Side Effects Across All Failure Modes

Under the Single Atomic Batch Transaction Model, intermediate states are never partially committed. Here is the rigorous trace across every failure mode:

| Failure Mode | PostgreSQL Connection & Transaction Behavior | Committed Database State | In-App Notifications Committed | Post-Commit Effects (WebSockets / Emails) | Recovery Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Crash Between Reservation Commit & Worker Scheduling** | `Transaction 1` already committed. Process crashes before task executor submission. | `broadcast_history` committed in `status = 'RESERVED'`, `lease_token = Token_1`, `lease_expires_at = NOW() + 60s`. | **0 rows**. | **0 emitted**. | At $t < 60s$, retries return HTTP 200 (queued). At $t \ge 60s$, retry atomically reclaims lease with `Token_2` and schedules worker. |
| **Process Crash During Batch Execution** (JVM OOM, Container Kill, Host Reboot) | TCP connection severed. PostgreSQL immediately aborts and **rolls back `Transaction 2` entirely**. | `broadcast_history` remains committed in `status = 'RESERVED'`. Row lock is released immediately. | **0 rows** (All uncommitted notification inserts are discarded). | **0 emitted** (`AFTER_COMMIT` listener never fires). | Once `lease_expires_at` (60s) elapses, the reservation can be safely reclaimed or retried with **zero duplicate risk**. |
| **Database Connection Loss / Network Partition** | Socket timeout breaks connection. PostgreSQL automatically rolls back `Transaction 2`. | `broadcast_history` remains committed in `status = 'RESERVED'`. | **0 rows** (Rolled back). | **0 emitted**. | Safe lease reclaim after lease expires. |
| **Transaction Rollback** (Constraint violation, runtime exception) | Spring Transaction Manager rolls back `Transaction 2`. Coordinator catches error and executes `Transaction 3` (`REQUIRES_NEW`). | `broadcast_history` transitions from `RESERVED` to `status = 'FAILED'` with `failure_reason`. | **0 rows** (Rolled back). | **0 emitted**. | Terminal failure recorded cleanly; key cannot be re-executed. |
| **Worker Hang** (Severe GC freeze, thread deadlock, hung HTTP socket) | Worker's connection remains open. `Transaction 2` remains uncommitted. **Worker continuously holds exclusive row lock on `broadcast_history(id)`.** | `broadcast_history` remains committed as `RESERVED` in PostgreSQL MVCC. `PROCESSING` is uncommitted. | Uncommitted in Worker's session; invisible to all other sessions. | **0 emitted**. | Operator terminates hung backend connection (`pg_terminate_backend`) -> PostgreSQL rolls back `Transaction 2` -> Operator marks `FAILED`. |

---

### 2.3 Manual Recovery and Stale-Worker Fencing: Reality Analysis & Safe Operational Procedure

#### A. Analysis of Operator SQL vs. Row-Level Locks
A critical concurrency trap exists in simplistic manual recovery designs:
- If a worker hangs inside `Transaction 2` while holding the row lock on `broadcast_history`, an operator attempting to run:
  ```sql
  UPDATE broadcast_history SET status = 'FAILED' WHERE id = :id;
  ```
  **CANNOT EXECUTE.** In PostgreSQL, the operator's SQL statement **blocks indefinitely** on Worker 1's exclusive row lock!
- Furthermore, because `status = 'PROCESSING'` was updated inside `Transaction 2` and is uncommitted, to the operator's session the row's committed status in the database is actually `RESERVED`, not `PROCESSING`. A query with `WHERE status = 'PROCESSING'` would match 0 rows even if the lock were released!
- **Do not claim a worker is fenced merely because the operator's SQL contains a status predicate:** If the worker holds an open transaction, the operator's update cannot even reach the predicate!

#### B. The Smallest Safe Operational Recovery Procedure
Because an application-level SQL query cannot bypass an open database transaction holding a row lock, safe manual recovery requires a strict two-step operational sequence:

1. **Step 1: Sever the Hung Database Connection (Break the Lock)**
   The operator queries `pg_stat_activity` to locate the hung connection holding the lock on `broadcast_history`:
   ```sql
   SELECT pid, state, query, age(clock_timestamp(), query_start)
   FROM pg_stat_activity
   WHERE query LIKE '%broadcast_history%' AND state != 'idle';
   ```
   The operator terminates the hung backend connection using PostgreSQL's administrative function:
   ```sql
   SELECT pg_terminate_backend(:pid);
   ```
   *(Alternatively, the operator restarts the application container).*

2. **Step 2: PostgreSQL Enforces Automatic Atomic Rollback**
   The moment `pg_terminate_backend` executes:
   - PostgreSQL immediately terminates the backend process and **aborts `Transaction 2`**.
   - All partially staged `Notification` rows are wiped out.
   - The uncommitted `PROCESSING` status update is discarded.
   - The row lock on `broadcast_history` is released.
   - The row reverts cleanly to its last committed state: `status = 'RESERVED'`.

3. **Step 3: Operator Marks the Record as `FAILED`**
   Now that the connection is severed and the row lock is released, the operator runs a guarded update against the committed `RESERVED` record:
   ```sql
   UPDATE broadcast_history
   SET status = 'FAILED',
       failure_reason = 'Manually terminated by operator: hung worker connection terminated via pg_terminate_backend'
   WHERE id = :id
     AND status = 'RESERVED'
     AND lease_expires_at <= NOW()
   RETURNING id;
   ```

4. **Fencing Guarantee Against Resumed Stale Worker:**
   Because Worker 1's underlying JDBC connection was terminated by PostgreSQL (`PSQLException: FATAL: terminating connection due to administrator command`), Worker 1's thread cannot commit `Transaction 2`. Any subsequent call on that connection throws a fatal socket exception. Worker 1 is **physically incapable of committing notifications or triggering `@TransactionalEventListener(phase = AFTER_COMMIT)`**.

---

### 2.4 Fenced Failure Persistence (`REQUIRES_NEW`) & Race Protection
**[Architectural Design Recommendation]**  
When an unexpected exception occurs inside `Transaction 2`, Spring marks `Transaction 2` for rollback. All notification inserts within `Transaction 2` roll back cleanly.

To record the failure in the database, the failure update must execute in an independent transaction (`Propagation.REQUIRES_NEW`):

```sql
UPDATE broadcast_history
SET status = 'FAILED',
    failure_reason = :error,
    worker_heartbeat = NOW()
WHERE id = :id
  AND lease_token = :workerLeaseToken
  AND status = 'RESERVED'
RETURNING id;
```

#### Race Protection: Stale Failure-Persistence vs. Lease Reclaim
A dangerous race condition occurs if Worker 1's `Transaction 2` rolls back, a client retry arrives after lease expiration and reclaims the reservation (rotating the lease token to `Token_2`), and only *afterwards* Worker 1's catch block executes `Transaction 3`:
- Worker 1's update passes `lease_token = Token_1`.
- Because Worker 2 already rotated the database row to `lease_token = Token_2`, Worker 1's update matches **0 rows**.
- The recovery service logs:  
  `WARN: Fenced worker Token_1 attempted to mark broadcast {} as FAILED, but lease token no longer matched. 0 rows updated.`
- **Result:** Worker 1 cannot overwrite Worker 2's active reservation. Worker 2's reservation remains safely in `status = 'RESERVED'` with `Token_2`. Worker 1 is barred from dispatching any external effects.

#### Behavior if Failure Persistence Itself Fails:
If failure persistence itself throws an exception (e.g. database connection dropped, database instance failure):
1. `BroadcastExecutionCoordinator` catches the failure in a `try ... catch (Throwable t)` block.
2. The coordinator logs a `CRITICAL` alert with complete diagnostic context:
   ```java
   log.error("CRITICAL: Failed to persist FAILED status for broadcast ID {}. Diagnostic context: leaseToken={}, initialError='{}', persistenceError='{}'",
           broadcastId, leaseToken, ex.getMessage(), t.getMessage(), t);
   ```
3. The coordinator **suppresses the secondary persistence exception** so that the original root cause `ex` is preserved in the application logs and metrics.
4. The database row remains committed as `RESERVED`. Once `lease_expires_at` elapses, the reservation can be safely reclaimed or manually cleaned up once database connectivity is restored.

---

### 2.5 Email Delivery Guarantees: Four Distinct Operational Tiers & The After-Commit Crash Window

#### A. Four Distinct Delivery Tiers
CakeStore's broadcast notification architecture operates across four distinct operational tiers with different delivery guarantees:

| Tier | Operational Phase | Mechanism | Delivery Guarantee | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Persisted In-App Notifications** | `notificationRepository.save(notification)` in `Transaction 2` | **Strong ACID Guarantee** (Committed to PostgreSQL `notifications` table) | If DB error occurs, entire transaction rolls back; zero notifications saved. |
| **Tier 2** | **After-Commit Event Execution** | Spring `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` in [NotificationService.java:L42](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/NotificationService.java#L42) | **Conditional Post-Commit Execution** | Fires ONLY if `Transaction 2` commits successfully. Never fires on rollback. |
| **Tier 3** | **Email Dispatch Attempts** | Asynchronous HTTP requests to Resend API via [EmailService.java:L100-L131](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/EmailService.java#L100-L131) | **Best-Effort Dispatch Attempt** | `try ... catch` traps all network/HTTP errors. Never rolls back DB. In dev/test, logs to console. |
| **Tier 4** | **Confirmed Provider Inbox Delivery** | External SMTP / Resend delivery receipt webhooks | **Not Supported / No Guarantee** | CakeStore has **zero webhook infrastructure** to track email bounce, spam, or inbox delivery. |

#### B. The After-Commit Crash Window & Outbox Limitations
**[System Boundary & Explicit Architectural Limitation]**  
A fundamental distinction exists between:
- A listener that executes **only after** a successful commit (which Spring's `AFTER_COMMIT` phase provides), and
- A listener **guaranteed to execute after every** successful commit (which Spring `AFTER_COMMIT` **CANNOT** guarantee).

**The Dual-Write Crash Window:**
- If the JVM crashes (OOM, SIGKILL, power loss, host failure) in the physical time window *after* PostgreSQL has committed `Transaction 2` but *before* Spring executes the `AFTER_COMMIT` listener method:
  1. In the database: `broadcast_history` is committed with `status = 'COMPLETED'`, and all recipient rows in `notifications` are permanently committed.
  2. In the external world: Neither the WebSocket push nor the Resend email HTTP requests were ever initiated.
  3. Because CakeStore lacks a persistent Transactional Outbox table or message broker, these external events are lost upon restart and will not automatically replay.
- **Out of Scope Statement:** Implementing a persistent outbox queue with polling/CDC workers is an extensive architectural upgrade that is strictly out of scope for this repair plan. CakeStore explicitly accepts this standard monolithic limitation and documents that in-app notifications are guaranteed by ACID commit, whereas external email dispatch is best-effort.

---

## 3. Canonical Payload Validation & Deterministic Serializer

### 3.1 Cross-Field Validation & Normalization
**[Architectural Design Recommendation]**  
In the current codebase, `AdminMessageRequest` only defines `title`, `message`, `specificOwnerId`, and `sendEmail`. `targetType` is derived or passed ad-hoc. This introduces inconsistencies if `targetType` and `specificOwnerId` contradict each other.

#### Cross-Field Validation Rules:
1. **Rule 1 (`targetType == "ALL"`):**
   - `specificOwnerId` MUST be null.
   - If a client provides `targetType = "ALL"` with `specificOwnerId = 123`, the request is **rejected synchronously with HTTP 400 Bad Request**:
     `"specificOwnerId must be null when targetType is ALL"`
2. **Rule 2 (`targetType == "SPECIFIC"`):**
   - `specificOwnerId` MUST NOT be null and MUST be positive (`Long > 0`).
   - If a client provides `targetType = "SPECIFIC"` with `specificOwnerId = null` or `<= 0`, the request is **rejected synchronously with HTTP 400 Bad Request**:
     `"specificOwnerId must be provided and positive when targetType is SPECIFIC"`
3. **Rule 3 (Unrecognized `targetType`):**
   - If `targetType` is not `"ALL"` or `"SPECIFIC"` (case-insensitive), the request is rejected synchronously with **HTTP 400 Bad Request**.

#### Normalization Pipeline:
Before computing payload hashes or checking idempotency, the incoming request is normalized into a canonical `NormalizedBroadcastPayload`:
- `title = title.trim()` (length 1 to 255)
- `message = message.trim().replace("\r\n", "\n").replace("\r", "\n")` (length 1 to 1024)
- `targetType = targetType.trim().toUpperCase()` (`"ALL"` or `"SPECIFIC"`)
- `specificOwnerId = (targetType.equals("SPECIFIC")) ? specificOwnerId : null`
- `sendEmail = request.isSendEmail()`

**Strict Consistency Guarantee:** Both `CanonicalPayloadHasher` (used for duplicate hash verification) and `BroadcastService` (used for recipient querying and history persistence) MUST consume this **exact same normalized payload object**.

---

### 3.2 Fixed-Schema Deterministic Canonical JSON Serializer
**[Architectural Clarification]**  
We describe the serializer accurately: this is a **Fixed-Schema Deterministic Canonical JSON Serializer** (RFC 8785-inspired deterministic serialization using low-level Jackson `JsonGenerator`), NOT a generic RFC 8785 engine.

Because the broadcast payload is a fixed, flat schema consisting of exactly 5 scalar fields (`message`, `sendEmail`, `specificOwnerId`, `targetType`, `title`), we achieve 100% deterministic, collision-free hashing without adding external dependencies:

```java
public class CanonicalPayloadHasher {

    public static String computeHash(NormalizedBroadcastPayload payload) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            JsonFactory factory = new JsonFactory();
            try (JsonGenerator gen = factory.createGenerator(baos, JsonEncoding.UTF8)) {
                gen.writeStartObject();
                // Strictly ordered field 1: message (normalized LF, trimmed)
                gen.writeStringField("message", payload.getMessage());
                // Strictly ordered field 2: sendEmail (boolean literal)
                gen.writeBooleanField("sendEmail", payload.isSendEmail());
                // Strictly ordered field 3: specificOwnerId (integer or null literal)
                if (payload.getSpecificOwnerId() != null) {
                    gen.writeNumberField("specificOwnerId", payload.getSpecificOwnerId());
                } else {
                    gen.writeNullField("specificOwnerId");
                }
                // Strictly ordered field 4: targetType ("ALL" or "SPECIFIC")
                gen.writeStringField("targetType", payload.getTargetType());
                // Strictly ordered field 5: title (trimmed)
                gen.writeStringField("title", payload.getTitle());
                gen.writeEndObject();
            }
            return DigestUtils.sha256Hex(baos.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute canonical payload hash", e);
        }
    }
}
```

---

### 3.3 Synthetic Historical Sentinels vs. Runtime Canonical Hashes
**[Verification of Data Isolation & Migration Safety]**
1. **Synthetic Historical Sentinels:** The MD5 backfill expressions in `V49`:
   ```sql
   payload_hash = md5('cakeplatform:broadcast_history:payload:a:' || id::text || ':' || COALESCE(title, '')) ||
                  md5('cakeplatform:broadcast_history:payload:b:' || id::text || ':' || COALESCE(substr(message, 1, 100), ''))
   ```
   and `idempotency_key = md5('cakeplatform:broadcast_history:' || id::text)::uuid`
   are **synthetic historical sentinels**. They are NOT hashes of canonical JSON. They exist solely to satisfy the `NOT NULL` schema constraint and guarantee deterministic primary-key uniqueness for legacy rows created under V36 before idempotency was introduced.
2. **Isolation from Runtime Request Paths:**
   - Clients creating new broadcasts always generate fresh v4 UUIDs via `crypto.randomUUID()`. A client will never submit a synthetic historical UUID.
   - Even in the infinitesimally improbable event that a client generates a UUID matching a historical row, `CanonicalPayloadHasher` computes a SHA-256 hash of the canonical JSON payload, which will never match the synthetic 64-character concatenated MD5 sentinel. The request will immediately reject with **HTTP 409 Conflict**.
   - **Zero reliance on historical hashes:** No runtime request path in the backend relies on synthetic historical hashes for canonical comparisons; canonical payload comparison applies exclusively to runtime requests created under V49.

---

## 4. Migration & Insert-Path Safety (`V49`)

### 4.1 Actual Nullability Audit & Insert Path Verification
**[Verified Source Evidence]**
1. **Existing Schema Nullability:** In [V36__add_broadcast_history.sql](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/resources/db/migration/V36__add_broadcast_history.sql), `title` is `VARCHAR(255) NOT NULL` and `message` is `TEXT NOT NULL`.
2. **Complete Insert Path Search:** Grep searches across all backend modules confirm that `BroadcastService.sendAndRecordBroadcast` is the **only insert path** for `broadcast_history` in the entire application.
3. **New Two-Phase Insert Satisfaction:** Under the new architecture, the legacy insert is replaced by `BroadcastHistoryRepositoryCustomImpl.insertIfAbsent`, which satisfies every `NOT NULL` column:
   - `title`: normalized string (NOT NULL)
   - `message`: normalized string (NOT NULL)
   - `target_type`: normalized string (`"ALL"` or `"SPECIFIC"`, NOT NULL)
   - `target_owner_id`: nullable Long
   - `recipient_count`: `0` initially (NOT NULL)
   - `sent_email`: boolean (NOT NULL)
   - `sent_at`: `NOW()` (NOT NULL)
   - `idempotency_key`: UUID (NOT NULL)
   - `status`: `'RESERVED'` (NOT NULL)
   - `payload_hash`: 64-char hex string (NOT NULL)
   - `lease_token`: UUID (NOT NULL)
   - `lease_expires_at`: `NOW() + INTERVAL '60 seconds'` (NOT NULL)
   - `worker_heartbeat`: `NULL`

---

### 4.2 Safe Preflight & Staged Migration Specification (`V49__add_broadcast_history_idempotency.sql`)
**[Architectural Design Recommendation]**  
To guarantee zero-risk migration execution, `V49` includes an explicit preflight verification block that checks existing data integrity, performs an extension-free deterministic backfill using core `md5()`, and verifies uniqueness before adding constraints.

```sql
-- =========================================================================
-- V49: Add Idempotency Key, Status, Payload Hash, and Dedicated Lease Columns
-- =========================================================================

-- Stage 1: Preflight Data Integrity Check
DO $$
DECLARE
    v_total_rows INTEGER;
    v_null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_rows FROM broadcast_history;
    
    -- Verify no unexpected NULLs in legacy NOT NULL columns
    SELECT COUNT(*) INTO v_null_count FROM broadcast_history
    WHERE title IS NULL OR message IS NULL;
    
    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'V49 Preflight Aborted: Found % rows with NULL title or message in broadcast_history.', v_null_count;
    END IF;
    
    RAISE NOTICE 'V49 Preflight Passed: % historical broadcast rows detected for backfill.', v_total_rows;
END $$;

-- Stage 2: Add new columns as nullable
ALTER TABLE broadcast_history
    ADD COLUMN idempotency_key UUID,
    ADD COLUMN status VARCHAR(20),
    ADD COLUMN payload_hash VARCHAR(64),
    ADD COLUMN lease_token UUID,
    ADD COLUMN lease_expires_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN worker_heartbeat TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN failure_reason TEXT;

-- Stage 3: Extension-free deterministic backfill of existing historical records
-- 1. Deterministic UUID generated from immutable primary key 'id'
-- 2. Status set to 'COMPLETED'
-- 3. Dedicated lease_expires_at set to sent_at + 60s
-- 4. 64-character payload hash generated using core md5() with COALESCE safeguards
UPDATE broadcast_history
SET idempotency_key = md5('cakeplatform:broadcast_history:' || id::text)::uuid,
    status = 'COMPLETED',
    lease_token = md5('cakeplatform:broadcast_history:lease:' || id::text)::uuid,
    lease_expires_at = sent_at + INTERVAL '60 seconds',
    payload_hash = md5('cakeplatform:broadcast_history:payload:a:' || id::text || ':' || COALESCE(title, '')) ||
                   md5('cakeplatform:broadcast_history:payload:b:' || id::text || ':' || COALESCE(substr(message, 1, 100), ''))
WHERE idempotency_key IS NULL OR status IS NULL OR payload_hash IS NULL;

-- Stage 4: Preflight Duplicate Check Before Adding Unique Constraint
DO $$
DECLARE
    v_duplicate_keys INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicate_keys FROM (
        SELECT idempotency_key FROM broadcast_history
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
    ) dups;

    IF v_duplicate_keys > 0 THEN
        RAISE EXCEPTION 'V49 Preflight Aborted: % duplicate idempotency keys detected after backfill.', v_duplicate_keys;
    END IF;
END $$;

-- Stage 5: Enforce NOT NULL constraints and application defaults
ALTER TABLE broadcast_history
    ALTER COLUMN idempotency_key SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'RESERVED',
    ALTER COLUMN payload_hash SET NOT NULL,
    ALTER COLUMN lease_token SET NOT NULL,
    ALTER COLUMN lease_expires_at SET NOT NULL;

-- Stage 6: Enforce Uniqueness and Performance Indexing
ALTER TABLE broadcast_history
    ADD CONSTRAINT uq_broadcast_history_idempotency_key UNIQUE (idempotency_key);

CREATE INDEX idx_broadcast_history_status ON broadcast_history(status);
CREATE INDEX idx_broadcast_history_lease ON broadcast_history(status, lease_expires_at);
```

#### Strict Migration Policy:
- This SQL script is purely a proposed migration specification.
- **It MUST NOT be executed, and database state MUST NOT be altered during this planning phase.**

---

## 5. Frontend Uncertain-Submission Lifecycle

### 5.1 The Danger of Eager Key Regeneration
In earlier drafts, if form fields were edited while a previous submission was in an uncertain state (e.g. network timeout or delayed response), the client automatically generated a new idempotency key. This allowed an administrator to accidentally dispatch duplicate broadcasts if the server eventually processed the original request.

### 5.2 The Robust Uncertain-Submission State Machine
**[Architectural Design Recommendation]**  
The composer interface enforces an explicit lifecycle state machine:

```
    [ Admin Composes Draft ]
               │
               ▼ (Admin clicks "Send Broadcast")
    ┌──────────────────────────────────────────────┐
    │ State: IN_FLIGHT / UNCERTAIN                 │
    │                                              │
    │ 1. Save active submission to sessionStorage  │
    │ 2. Form fields are completely LOCKED         │
    │ 3. Submit POST /api/admin/messages           │
    └──────────────┬───────────────────────────────┘
                   │
         ┌─────────┴───────────────────────────────────────┐
         ▼                                                 ▼
   (Network Error /                                  (HTTP Response
    Gateway Timeout /                                  Received)
    429 Contention)                                        │
         │                                                 ├──────────────────────┐
         ▼                                                 ▼                      ▼
    ┌────────────────────────┐                        [HTTP 200 OK]        [HTTP 400 / 409]
    │ Display Uncertain      │                             │                      │
    │ Submission Alert       │                             │                      │
    └────┬──────────────┬────┘                             ▼                      ▼
         │              │                             Clear Storage          Clear Storage
         │              │                             Reset Form             Unlock Form
         ▼              ▼                             Toast Success          Show Error Alert
   [Retry Button]  [Abandon Button]
   (Same Key &     (Warning Modal ->
    Same Payload)   Explicit Confirm
                    -> Reset & Unlock)
```

#### Detailed State Behaviors:
1. **Initiating Submission (`IN_FLIGHT`):**
   - When the admin clicks "Send Broadcast", generate a single UUID `idempotencyKey = crypto.randomUUID()`.
   - Snapshot the exact form payload into `sessionStorage` under `cake_admin_broadcast_active_submission`:
     ```ts
     interface ActiveBroadcastSubmission {
       idempotencyKey: string;
       payload: {
         title: string;
         message: string;
         targetType: 'ALL' | 'SPECIFIC';
         specificOwnerId: number | null;
         sendEmail: boolean;
       };
       submittedAt: number;
       status: 'IN_FLIGHT' | 'UNCERTAIN';
     }
     ```
   - **Form Fields are Locked:** All inputs (`title`, `message`, `targetType`, `specificOwnerId`, `sendEmail`) and the submit button are **disabled/read-only**. The admin cannot edit fields while submission is in-flight.

2. **Network Timeout, Connection Drop, or 429 Lock Contention (`UNCERTAIN`):**
   - If `fetch` throws a `TypeError` (network failure), the request times out after 15 seconds, or the backend returns HTTP 429 Too Many Requests (row lock contention):
   - The active submission remains preserved in `sessionStorage` with `status = 'UNCERTAIN'`.
   - The composer displays a prominent **"Uncertain Submission Alert"** banner with two explicit buttons:
     - **Button A: "Retry / Check Status":**  
       Resubmits the exact same locked payload with the exact same `idempotencyKey`. If the server already processed it, the server returns 200 OK without re-running.
     - **Button B: "Abandon Broadcast":**  
       **Strict Architectural Invariant: Frontend-Only Local Draft Discard.**
       - "Abandon Broadcast" is **strictly a client-side action** that clears the local draft snapshot from `sessionStorage` and resets composer state.
       - It **does NOT call any server endpoint**, does NOT cancel any in-flight background worker, does NOT update any database status, and makes NO claim that an accepted server request was cancelled or rolled back.
       - **User-Facing Consequence & Warning:** If the server previously received the request and committed `Transaction 1`, background execution may still proceed to completion (`COMPLETED`), persisting in-app notifications and sending emails. Submitting a new broadcast after local abandonment will generate a **completely new idempotency key** and create a **separate broadcast record** in `broadcast_history`; it must **never** be assumed to replace or retry the abandoned submission.
       - Triggers an explicit high-visibility confirmation modal:
         > **Warning: Server May Still Process In-Flight Broadcast**  
         > *Abandoning this submission only discards your local draft and unlocks the composer. It does NOT cancel server processing or revoke any broadcast already accepted.*  
         > *If the server received your request, notifications and emails may still be dispatched. Composing a new broadcast will create a SEPARATE broadcast and will NOT retry this one.*  
         > *[Keep Draft & Retry] [Discard Local Draft & Unlock Composer]*
       - If the admin confirms abandonment: `cake_admin_broadcast_active_submission` is cleared from `sessionStorage`, form inputs are unlocked, composer state is reset, and any subsequent composition will generate a fresh UUID.
       - **Separation from Backend `FAILED` Status:** Local abandonment has zero connection to `status = 'FAILED'`. `FAILED` remains an immutable terminal database status persisted solely by backend failure handling (`Transaction 3` via `REQUIRES_NEW`) or by a database administrator via the operational recovery procedure (Section 2.3).


3. **Page Refresh (F5) / Browser Restart During Uncertain State:**
   - On component mount (`useEffect`), `AdminMessagesPage` checks `sessionStorage` for `cake_admin_broadcast_active_submission`.
   - If found: Form fields are restored with the submitted values in **locked/disabled state**.
   - The "Uncertain Submission Alert" banner is immediately displayed, offering "Retry / Check Status" or "Abandon Broadcast".
   - The administrator is physically prevented from accidentally double-sending by refreshing the page.

4. **Terminal Success (HTTP 200 OK):**
   - Remove `cake_admin_broadcast_active_submission` from `sessionStorage`.
   - Reset form fields to empty.
   - Unlock composer (`isSending = false`, `isComposing = false`).
   - Display success toast: `"Broadcast dispatched successfully. Processing in background."`
   - Refresh history feed.

5. **Terminal Failure / Conflict Response (HTTP 409 Conflict):**
   - Occurs on payload mismatch or when retrying a broadcast whose status reached `FAILED`.
   - Remove `cake_admin_broadcast_active_submission` from `sessionStorage`.
   - Display alert dialog/toast detailing the conflict or failure reason.
   - Unlock form inputs so the admin can adjust the message or submit a fresh broadcast with a new key.

6. **Terminal Validation Rejection (HTTP 400 Bad Request):**
   - The server rejected the request before reservation.
   - Remove `cake_admin_broadcast_active_submission` from `sessionStorage`.
   - Unlock form inputs so the admin can correct the validation error.

---

## 6. Minimal Proposed File-by-File Change List

| Layer | File Path | Proposed Minimal Changes |
| :--- | :--- | :--- |
| **Migration** | `backend/src/main/resources/db/migration/V49__add_broadcast_history_idempotency.sql` | Add `idempotency_key UUID`, `status VARCHAR(20)`, `payload_hash VARCHAR(64)`, `lease_token UUID`, `lease_expires_at TIMESTAMP`, `worker_heartbeat TIMESTAMP`, `failure_reason TEXT`. Preflight checks, pure MD5 backfill, unique constraint. |
| **Backend Entity** | `backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java` | Add fields `idempotencyKey`, `status`, `payloadHash`, `leaseToken`, `leaseExpiresAt`, `workerHeartbeat`, `failureReason`. Preserve `sentAt` with `updatable = false`. |
| **Backend DTO** | `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageRequest.java` | Add `UUID idempotencyKey`, `String targetType`. Add `@NotBlank`, `@Size(max = 255)` on title, `@Size(max = 1024)` on message. Add cross-field validation. |
| **Backend Repo** | `backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistoryRepository.java` | Add `Optional<BroadcastHistory> findByIdempotencyKey(UUID key);`. Extend custom repository fragment. |
| **Backend Repo Frag** | `backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistoryRepositoryCustom.java` & `...Impl.java` | Implement `insertIfAbsent(...)` and `reclaimStaleLease(...)` using `JdbcTemplate` with `SET LOCAL lock_timeout = '2s'`. |
| **Backend User Repo** | `backend/src/main/java/com/cakeplatform/api/modules/user/UserRepository.java` | Add query method `List<User> findByRoleAndStatus(UserRole role, UserStatus status);`. |
| **Backend Controller** | `backend/src/main/java/com/cakeplatform/api/modules/notification/AdminMessageController.java` | Add `@Valid`. Synchronously call `broadcastService.reserveBroadcast(request)`. Handle 409 conflict, duplicate 200, lease reclaim, lock timeout (HTTP 429), terminal failure (HTTP 409), and trigger async worker. |
| **Backend Service** | `backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastService.java` | Implement synchronous `reserveBroadcast(request)`. Implement `@Async @Transactional processBroadcastAsync(Long id, UUID leaseToken)` with worker fencing and `REQUIRES_NEW` failure persistence. |
| **Frontend Types** | `frontend_v2/types/admin.ts` | Add `idempotencyKey?: string; targetType?: string;` to `AdminMessagePayload`. Add `status: string; sentEmail: boolean;` to `SentBroadcastRecord`. |
| **Frontend Page** | `frontend_v2/app/admin/messages/page.tsx` | Implement uncertain submission lifecycle (locked form, `sessionStorage` persistence, "Retry" and "Abandon" modal, terminal failure handling). Update history badge to "Attempted ({count})" with `Clock` icon and email indicator. |

---

## 7. Specific Regression, Concurrency, and Recovery Test Suite

### 7.1 Execution Status & Test Plan Boundary
- **Current Execution Status:** **PLANNED ONLY (0 tests executed).** In accordance with the strict read-only review boundary, no tests have been implemented, modified, or executed. Automated test coverage for the broadcast feature in the current codebase remains verified at **0%**.
- **Scope:** All 22 tests below represent the mandatory post-approval automated verification suite.
- **Frameworks:** JUnit 5, Mockito, and Spring MockMvc for backend; Jest and React Testing Library for frontend. Zero live emails, zero live WebSockets, and zero external network calls are made.

### 7.2 Detailed Test Matrix

| Test ID | Category | Scenario / Conditions | Expected HTTP Result | Expected Database State | Worker Sched Count | Notification Count | External Side Effects |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | Backend Integration | New valid bulk broadcast (`targetType=ALL`, new UUID) | HTTP 200 OK | Row inserted in `status='COMPLETED'`, `recipient_count = N`. | Exactly 1 worker | $N$ rows in `notifications` | $N$ WebSockets emitted; Resend emails attempted. |
| **TEST-02** | Concurrency Integration | Simultaneous identical requests (Thread 1 & Thread 2 race on insert) | Thread 1: HTTP 200 (new)<br>Thread 2: HTTP 200 (duplicate) | Exactly 1 row inserted in `status='COMPLETED'`. | Exactly 1 worker | $N$ rows in `notifications` | Zero duplicate WebSockets or emails. |
| **TEST-03** | Concurrency Integration | **Simultaneous Retries After Lease Expiry:** Stale `RESERVED` row (> 60s); two client retries (Thread A & Thread B) race to reclaim lease | Thread A: HTTP 200 OK (re-queued)<br>Thread B: HTTP 200 OK (already queued) | `lease_token` rotated to `Token_2`; `lease_expires_at` advanced by 60s; committed status remains `RESERVED` until batch commits as `COMPLETED`. | Exactly 1 worker scheduled (`Token_2`) | 0 initially; $N$ once batch commits | Events emitted by winning worker only. Zero duplicates. |
| **TEST-03B** | Concurrency Integration | **Simultaneous Retries During Unexpired Lease Window:** `RESERVED` row with active lease ($t = 15\text{s}$); two client retries arrive simultaneously | Thread A: HTTP 200 OK<br>Thread B: HTTP 200 OK (`"Broadcast already queued or processing."`) | Row untouched: `status='RESERVED'`, `lease_token=Token_1`, `lease_expires_at` unchanged. | 0 workers scheduled by either retry | 0 rows added | Zero duplicate workers scheduled. Zero external side effects. Both clients keep draft locked in `sessionStorage`. |
| **TEST-04** | Concurrency Integration | **Stale Worker Waking After Lease Reclaim:** Worker 1 delayed 65s in queue; retry reclaims lease at 61s (`Token_2`); Worker 1 wakes at 65s (`Token_1`) | Retry returns HTTP 200 OK | `broadcast_history` retains `Token_2`. Worker 1 startup guard matches 0 rows. | 1 active worker (Worker 2). Worker 1 aborts. | $N$ rows by Worker 2 only | Events emitted by Worker 2 only. Zero duplicates. |
| **TEST-05** | Concurrency Integration | **Failure-Persistence Race with Stale-Lease Reclaim:** Worker 1 rolls back; Worker 2 reclaims lease (rotating to `Token_2`); Worker 1 runs `REQUIRES_NEW` with `Token_1` | Worker 2 schedules async execution | Worker 1's `REQUIRES_NEW` update (`WHERE lease_token = Token_1`) matches **0 rows**. Worker 2's reservation (`Token_2`) remains intact in `RESERVED`. | 1 active worker (Worker 2). Worker 1 aborts. | Processed by Worker 2 only | Events emitted by Worker 2 only. Worker 1 barred from dispatches. |
| **TEST-06** | Validation Integration | Inconsistent Target: `targetType=ALL` with `specificOwnerId=123` | HTTP 400 Bad Request | Zero rows inserted. | 0 workers | 0 rows | Zero side effects. |
| **TEST-07** | Validation Integration | Inconsistent Target: `targetType=SPECIFIC` with `specificOwnerId=null` | HTTP 400 Bad Request | Zero rows inserted. | 0 workers | 0 rows | Zero side effects. |
| **TEST-08** | Validation Integration | Inconsistent Target: `targetType=SPECIFIC` with `specificOwnerId=-5` | HTTP 400 Bad Request | Zero rows inserted. | 0 workers | 0 rows | Zero side effects. |
| **TEST-09** | Backend Integration | Key reuse with modified payload body | HTTP 409 Conflict | Original record untouched in DB. | 0 workers | 0 rows | Zero side effects. |
| **TEST-09B** | Backend Integration | **Retry on FAILED Broadcast:** Same UUID and payload retried after status is `FAILED` | HTTP 409 Conflict | Record remains committed in `status='FAILED'`. Zero writes. | 0 workers | 0 rows | Zero side effects. Frontend clears draft and unlocks. |
| **TEST-10** | Database Migration | **V49 Preflight & Backfill:** Run `V49` on PostgreSQL schema with historical rows | Migration succeeds | All historical rows have deterministic UUID, `status='COMPLETED'`, `lease_expires_at = sent_at + 60s`, unique index active. | N/A | Existing rows intact | Zero side effects. |
| **TEST-11** | Frontend RTL | **Uncertain Submission Lifecycle:** Network drop during submit | Network TypeError | Form fields locked. Draft snapshot in `sessionStorage`. Banner displayed with "Retry" and "Abandon". | 0 (client side) | 0 | Zero duplicate dispatches. |
| **TEST-12** | Frontend RTL | **Abandon Submission Warning:** Admin clicks "Abandon" | Modal confirmation | Clicking confirm clears `sessionStorage`, resets composer, and unlocks form with fresh key. | 0 | 0 | Zero duplicate dispatches. |
| **TEST-13** | Frontend RTL | **History Badge Accuracy:** History item with `recipientCount=12, sentEmail=true` | DOM assertion | Renders `"Attempted (12)"` with `Clock` icon and `Mail` icon. Does not render `"Delivered"`. | N/A | N/A | N/A. |
| **TEST-RECOV-01** | Concurrency Recovery | **Lock Timeout with Unknown Contention Cause:** Concurrent transaction holds exclusive row lock; reservation hits `lock_timeout = 2s` | HTTP 429 Too Many Requests (`Retry-After: 2`) | Row untouched in committed `RESERVED`; 0 notifications. | 0 workers scheduled | 0 rows | Zero side effects. Frontend keeps submission locked in `sessionStorage` for retry. |
| **TEST-RECOV-02** | Concurrency Recovery | **Worker Crash During Batch Execution:** Worker in `Transaction 2` executes startup guard, inserts 3 notifications, then connection is severed (simulated process crash) | Connection abort | Connection drop causes PostgreSQL to abort and roll back `Transaction 2` completely. `broadcast_history` remains committed in `status='RESERVED'`. | 1 worker attempted | 0 rows (rolled back) | `AFTER_COMMIT` listener never fires (0 emails, 0 WebSockets). After `lease_expires_at` (60s), lease is safely reclaimable with zero duplicates. |
| **TEST-RECOV-03** | Concurrency Recovery | **Hung Worker and Operator Intervention:** Worker 1 hangs in `Transaction 2` holding row lock; operator terminates backend connection via `pg_terminate_backend` | Operator query | Operator SQL blocked while lock held. Operator terminates backend connection via `pg_terminate_backend`. PostgreSQL rolls back `Transaction 2`. Operator then executes update to `status='FAILED'`. | 1 worker terminated | 0 rows (rolled back) | Severed worker cannot commit any notifications or trigger `AFTER_COMMIT` email dispatches. |
| **TEST-RECOV-04** | Concurrency Recovery | **Failure Persistence Database Outage:** Worker fails; catch block calls `markFailedRequiresNew`, but database connection is dead | Secondary exception caught | Record remains in committed `RESERVED`. | 1 worker | 0 rows | Coordinator logs `CRITICAL` alert with diagnostic context; original error not masked; stalled lease allows safe operator inspection once DB restores. |
| **TEST-RECOV-05** | Concurrency Recovery | **Crash After Reservation Commit but Before Worker Scheduling:** `Transaction 1` commits `RESERVED`; JVM process dies before submitting task to executor | Process dies | `broadcast_history` committed in `status='RESERVED'`, `lease_token = Token_1`, `lease_expires_at = NOW() + 60s`. `notifications` table has 0 rows. | 0 workers queued | 0 rows | Zero side effects. Zero emails, zero WebSockets. |
| **TEST-RECOV-06** | Concurrency Recovery | **Retry During Unexpired Lease Window:** Client retries at $t = 15\text{s}$ after crash while `lease_expires_at > NOW()` | HTTP 200 OK (`"Broadcast already queued or processing."`) | Row remains in `status='RESERVED'`, `lease_token = Token_1`, `lease_expires_at` unchanged. | 0 workers scheduled | 0 rows | Zero duplicate workers scheduled. Client retains locked draft in `sessionStorage`. |
| **TEST-RECOV-07** | Concurrency Recovery | **Worker Queued in Executor (Healthy Lag):** Worker 1 queued in thread pool; client retries at $t = 5\text{s}$; Worker 1 begins at $t = 6\text{s}$ | HTTP 200 OK (`"Broadcast already queued..."`) | Worker 1 startup guard succeeds (`Token_1`); completes batch cleanly. Status committed as `COMPLETED`. | Exactly 1 worker total | $N$ rows | Events dispatched once Worker 1 commits. Zero duplicate workers. |

---

## 8. Classification of Facts, Assumptions, and Remaining Unresolved Risks

### 8.1 Verified Source Evidence
1. The project runs Spring Boot **3.3.2** with Spring Data JPA 3.3.2 ([backend/pom.xml](file:///d:/PROJECTS/CAKE%20SAAs1/backend/pom.xml)).
2. The database image is `postgres:16-alpine` in [docker-compose.yml](file:///d:/PROJECTS/CAKE%20SAAs1/docker-compose.yml#L34).
3. The database has **no UUID extensions installed** across its 48 Flyway migrations.
4. `Notification.message` is constrained to `VARCHAR(1024)` ([Notification.java](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/Notification.java#L36)).
5. `BroadcastHistory.sent_at` is annotated with `@CreationTimestamp` and `@Column(updatable = false)` ([BroadcastHistory.java:L43](file:///d:/PROJECTS/CAKE%20SAAs1/backend/src/main/java/com/cakeplatform/api/modules/notification/BroadcastHistory.java#L43)) and is used directly for UI display and history sorting.
6. `title` and `message` in `broadcast_history` are schema `NOT NULL` since `V36`.
7. `BroadcastService.sendAndRecordBroadcast` is the **only insert path** for `broadcast_history` in the application.
8. Automated test coverage for the broadcast feature is currently **0%**.

### 8.2 Architectural Design Recommendations
1. **Adopting the Single Atomic Batch Transaction Model:**  
   Eliminates partially committed states. A broadcast either commits completely (`COMPLETED` + all notifications + post-commit events) or rolls back completely (`RESERVED` + 0 notifications + 0 post-commit events).
2. **Terminal Failure Idempotency Policy:**  
   A failed idempotency key is immutable and terminal; retries return HTTP 409 Conflict, requiring the client to submit a fresh key and eliminating duplicate or zombie execution.
3. **Dedicated Lease Timestamp (`lease_expires_at`):**  
   Preserves the audit and sorting semantics of `sent_at` while providing dedicated 60-second lease windows.
4. **Lock Timeout Protection (`SET LOCAL lock_timeout = '2s'`):**  
   Prevents HTTP threads from hanging indefinitely during concurrent retries on active worker runs.
5. **Fenced `REQUIRES_NEW` Failure Persistence:**  
   Guarantees that a delayed worker cannot overwrite a newer worker's reservation as `FAILED`.
6. **Fixed-Schema Deterministic Canonical JSON Serializer:**  
   Provides collision-free hashing without third-party library dependencies.
7. **Frontend Locked Draft with Explicit Abandon Confirmation Modal:**  
   Eliminates accidental duplicate broadcast dispatch during network timeouts or page refreshes.

### 8.3 Remaining Unresolved Risks (Stated Honestly)
1. **Unexpired-Lease Recovery Latency Window:**  
   If the JVM crashes in the microsecond window after `Transaction 1` commits but before the asynchronous worker is submitted to the executor, the broadcast cannot be reclaimed by a client retry until the 60-second lease window expires (`lease_expires_at <= NOW()`). This 60-second delay is an intentional, unavoidable architectural trade-off required to prevent concurrent retries from prematurely invalidating legitimate workers queued in the thread pool under normal server load.
2. **The After-Commit Crash Window:**  
   Without a persistent Transactional Outbox queue, an abrupt JVM crash occurring between the PostgreSQL database commit of `Transaction 2` and the execution of Spring's `AFTER_COMMIT` event listener will cause external emails and WebSocket pushes to be lost without automatic replay.
3. **Operator Procedure Requires Database-Level Connection Termination:**  
   Because an in-flight worker holds an exclusive row lock inside an open database transaction, manual recovery of a hung worker cannot be achieved by application-level SQL alone; it requires terminating the database backend (`pg_terminate_backend`) or restarting the application container to trigger transaction rollback.
4. **Unverified Production Database Engine & Extension Permissions:**  
   The production PostgreSQL version and cloud superuser permissions cannot be queried in read-only mode. *Mitigation:* Migration `V49` is written using pure core `md5()` and standard SQL types, guaranteeing compatibility across all PostgreSQL versions without extensions.
5. **Production Historical Row Count & Backfill Duration:**  
   The exact number of historical rows in the production `broadcast_history` table is unknown. If exceptionally large (> 100,000 rows), executing `V49` could hold an exclusive table lock during column addition and index creation. *Recommendation:* Execute `V49` during an off-peak maintenance window.
6. **External Email Provider (Resend) Outages:**  
   If the Resend API is unresponsive, background worker threads could be delayed up to the HTTP client timeout (10 seconds per recipient). While `EmailService` safely traps exceptions and in-app notifications remain committed, a large batch of email recipients during an external API outage could backlog the Spring `@Async` task executor thread pool. *Recommendation:* Future architectural iterations should implement a persistent outbox queue for transactional emails.

---

## 9. Implementation Assessment: Stop and Await Approval

- **Planning Phase:** COMPLETE.
- **Source Verification:** Every code line, entity field, concurrency fence, lock timeout, and migration dependency is verified against the actual working tree.
- **Action Required:** STOP and await explicit user approval before making any code, test, configuration, or database modifications.
