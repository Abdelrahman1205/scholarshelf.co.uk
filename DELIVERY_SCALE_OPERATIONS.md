# DELIVERY_SCALE_OPERATIONS.md
# Stage 18: Delivery, Scale & Operational Behaviour

```
STAGE 18 — DELIVERY, SCALE & OPERATIONAL BEHAVIOUR
STATUS: LOCKED
Written: 31 August 2026
Locked: 31 August 2026 by the owner (BytHub Technology Ltd)
Owner decisions: OPSQ-1 = A
Open owner questions: 0
New conflicts: C-98 · C-99 — both TARGET STATED · IMPLEMENTATION OPEN
Conflicts closed: 0     Amendments raised against locked stages: none
```

**Owner decision, applied in full:**

```
OPSQ-1 = A   an unscanned object is not viewable by ANYONE, including the school's own
             authenticated staff. No "view anyway" control. No administrator override.
             Break-glass does not mean serve unscanned bytes.
             A scanner outage may interrupt the workflow; that cost is ACCEPTED.
                                                        §23 · OPS-D072 · OPS-R20
```

**Corrections applied on owner review, each recorded in place:** the public site is **RLS-scoped, not
unscoped** (§10.6, OPS-D074) · the cache key carries **publication identity**, so correctness never
depends on a purge (OPS-D073) · read composition **may not invent a Stage 14 endpoint** (OPS-D006) ·
`SKIP LOCKED` is **exclusive claiming, not exactly-once execution** (OPS-D068) · expired leases are
returned by an **explicit reclaim statement** (OPS-D069) · fairness is **implementable SQL** (OPS-D031)
· a **platform provider is not a suspendable DBT-040 integration** (OPS-D073) · the **I-2 audit fact is
Stage 19's to shape** (§9.1) · **import transaction granularity is one logical row** (OPS-D021).

**Governed by** Stages 1–17, **all LOCKED**, including `SECURITY_AUTH_PRIVACY.md` (with A16-001 and
A16-002), `DATABASE_SCHEMA.md` (with A15-001 and A15-002) and `INTEGRATIONS_PROVIDERS.md`.

---

## 1. Purpose and boundary

Stage 18 answers one question:

> **How does one coherent ScholarShelf application behave reliably as schools, families, records, jobs,
> imports, notifications and provider interactions grow — without changing business truth, tenant
> isolation, or the locked architecture?**

It turns architecture, schema, security and provider contracts into **explicit operational behaviour**:
budgets, concurrency, claims, leases, retries, thresholds, degradation and capacity triggers.

**It implements none of it.**

### 1.1 What Stage 18 decides — and does not

| Decides | Does not decide |
|---|---|
| workload classes and the operating envelope | the final audit schema — **Stage 19** |
| latency, query-count and transaction-duration budgets | the formal test strategy — **Stage 20** |
| connection-pressure constraints under **A13-001** | Neon and Vercel production configuration — **Stage 21** |
| client and server cache policy | the deployment pipeline — **Stage 21** |
| job claim, lease, retry, backoff and fairness | migration order — **Stage 22** |
| delivery retry and suppression behaviour | **legal or statutory retention** — see below |
| integration timeouts, thresholds and circuits | lawful basis and controller/processor determinations |
| import, reconciliation and export scale behaviour | the V1 payment provider · object storage · security algorithms |
| operational retention windows **only** | API routes · database conceptual truth |

**A16-002.2 governs retention ownership and this stage obeys it.** Stage 18 sets **operational
engineering windows only** — import staging, job execution metadata, transient idempotency data,
temporary operational traces. **Legally or commercially significant retention — child and family
records, financial and statutory records, custody evidence, erasure exceptions — belongs to qualified
legal / controller-approved policy.** Where a number is legally significant this document records
**POLICY INPUT REQUIRED** and stops. **It invents no statement of the form "UK law requires N years."**

### 1.2 Nothing was executed

**No code was written or modified, no dependency installed, no migration run, no index created, no pool
configured, no cron changed, no provider account created or configured, no bucket created, no SDK
installed, no benchmark or load test executed, no production data touched, nothing deployed.**

Every file named at §2 was **opened and read.**

### 1.3 Evidence is STATIC — this is not measured performance

**No benchmark and no load test was run.** Every finding below is labelled **E2 — read directly, not
executed**, and every budget is an **engineering starting target for Stage 20 to validate**, never a
claim about what the system currently achieves.

**Where this document says a path is slow, it means the code's shape makes it slow as data grows** —
an unbounded read, a serial loop, an unbounded pool. **That is a structural claim, and it is the only
kind of performance claim this stage is entitled to make.**

### 1.4 The release boundary is unchanged

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2**.

---

## 2. Evidence inspected

Read directly on 31 August 2026:

```
server/config/database.ts       getPool() · getDb() · getTxDb() · buildSslConfig
server/config/consoleDb.ts      the console pools — the ONLY bounded pools in the tree
server/app.ts                   the session-store pool · the global write limiter
client/src/lib/queryClient.ts   QueryClient defaults
server/services/payment-verification/
                                provider-payment-repository.ts · payment-matcher.ts
                                payment-verification-service.ts
server/services/enrollment-import/
                                import-service.ts · spreadsheet-parser.ts · resolvers
server/routes/cron.routes.ts    the drain loop and its budget
server/storage.ts               loop-shaped access patterns
server/routes/*.ts              health surface · list endpoints
vercel.json                     maxDuration · crons
```

**Three pools exist in this codebase and only one of them is unbounded — the main one.**

---

## 3. Current operational baseline

**All findings E2. Each names its file and what the shape implies as data grows.**

**OPS-F01 · The main database pool has no bounds at all.**
`server/config/database.ts` — `getPool()` constructs `new Pool({ connectionString, ssl })` and sets
**no `max`, no `idleTimeoutMillis`, no `connectionTimeoutMillis`.** `node-postgres` defaults to
**10 connections per pool**, and on a serverless platform **each concurrent invocation is its own
process with its own pool**. Connection demand is therefore *instances × 10*, bounded by nothing the
application states. **A request that cannot get a connection waits forever**, because there is no
acquisition timeout.

**The discipline exists elsewhere in the same codebase.** `server/config/consoleDb.ts` sets
`max: 2` / `max: 1`, `idleTimeoutMillis` and `connectionTimeoutMillis: 5_000` on both console pools.
**The least-important pools are the bounded ones.**

**OPS-F02 · `staleTime: Infinity` is the global client default.**
`client/src/lib/queryClient.ts` — `staleTime: Infinity` with `refetchOnWindowFocus: false` and
`refetchInterval: false`. **Once fetched, no query ever refetches** unless something explicitly
invalidates it. A settlement confirmed by finance, a stock level changed by a hand-over, a revoked
authority, an ended support engagement — **none of them refreshes on their own in an open tab.**

**OPS-F03 · Reconciliation candidate selection reads the school's entire provider-payment history.**
`provider-payment-repository.ts` — `findCandidatesByKeys` executes
`db.select().from(providerPayments).where(eq(providerPayments.schoolId, schoolId)).orderBy(desc(paidAt))`
with **no reference predicate, no date window and no limit**, then filters in JavaScript against a
`Set`. **The tenant predicate is present and correct**; the candidate narrowing is absent. This grows
with every payment the school has ever taken, for the lifetime of the tenant.

**OPS-F04 · Verification runs one order at a time, serially.**
`payment-verification-service.ts` — `for (const order of …) { const r = await verifyOrder(order.id, …) }`.
Each iteration is at least one round trip. **N orders is N sequential round trips inside one
30-second function.**

**OPS-F05 · The three-endpoint health surface does not exist.**
Stage 14 locked `/health/live`, `/health/ready` and `/health/dependencies`. The tree has
**`/api/health` and `/api/owner/system-health`**. There is no readiness distinction, so **nothing can
express "this instance must not receive authoritative traffic yet."**

**OPS-F06 · The daily drain has no continuation.**
Recorded at Stage 17 as **C-96** and carried here for its operational consequence: work beyond the
budget waits a day, and the response says `ok: true`.

**OPS-F07 · Loop-shaped access is widespread in `server/storage.ts`.**
37 occurrences of `for (const …)` or `await Promise.all(` in one file. **Not all are N+1** — this is a
count of *candidates*, not of defects, and it is stated that way because calling all 37 a defect
without reading each one would be exactly the inference this method forbids. **The two verified N+1
shapes are OPS-F03 and OPS-F04.**

**OPS-F08 · No index exists for the access paths Stage 15's IX rules require.**
Stage 15 stated the four index rules and deliberately declined speculative indexes. **Nothing has been
created**, because no migration has run. This is not a defect; it is the state before MIG-03.

---

## 4. Locked scale assumptions

From locked Stage 12, restated as this stage's envelope. **No target is invented.**

```
SCALE UNIT       one school's operational day
PEAK             September — enrolment + settlement + distribution, together
CONCURRENCY      tens of staff per school · hundreds of families per school
DATA GROWTH      children × academic periods · historical facts grow and are never deleted
HEAVIEST READS   finance reconciliation · the fulfilment board · reporting
HEAVIEST WRITES  settlement confirmation (I-2) · hand-over · import
LONGEST WORK     enrolment import · provider reconciliation · digest and delivery
```

**No claim is made that this system must serve millions of users.** **The design target is linear
scaling with explicit upgrade triggers (§30)** — which is a stronger commitment than a headline number,
because it says what will be done and when, rather than what is hoped.

---

## 5. Operational principles — OPS-P1 … OPS-P16

**OPS-P1 — Business truth outranks speed.** No budget in this document is met by making a fact less
true.

**OPS-P2 — I-2 is never made asynchronous for performance.** Not by a queue, an event, a job, a
callback, eventual consistency or a saga. **If I-2 is slow, its queries, indexes and locking are fixed.**

**OPS-P3 — A cache is never authority.** Not for settlement, stock, custody, permission, support
engagement, break-glass or idempotency.

**OPS-P4 — Database concurrency is bounded, and the bound is stated.** An unstated bound is the
platform's default multiplied by a number nobody chose.

**OPS-P5 — Work becomes a durable job when the business act is genuinely asynchronous** — not when it
is merely slow.

**OPS-P6 — External call latency never holds an authoritative transaction open.** Stage 17 INTAR-004.

**OPS-P7 — Retries are safe before they are frequent.** Idempotency is a precondition of a retry, never
a hope.

**OPS-P8 — One slow school does not starve another.**

**OPS-P9 — One large tenant cannot monopolise the job executor.**

**OPS-P10 — Failure is visible, never reported as success.** BR-125.

**OPS-P11 — History grows; queries are designed for bounded access.** Every read has a predicate that
does not widen with tenant age.

**OPS-P12 — Every threshold is measured and revisable.** A number with no measurement behind it is a
starting point, and it is labelled as one.

**OPS-P13 — No infrastructure is added before a measurable threshold requires it.**

**OPS-P14 — Graceful degradation never weakens security.** A degraded path refuses; it does not relax.

**OPS-P15 — A budget belongs to a workload, not to the system.** "The app is fast" is not a target.

**OPS-P16 — An operational number is engineering's; a retention number that carries legal weight is
not.** A16-002.2.

---

## 6. Workload catalogue — WL-001 … WL-026

| WL | Workload | Sync/Async | Authority-critical | Reads | Writes | External | Txn | Growth dimension |
|---|---|---|---|---|---|---|---|---|
| **WL-001** | sign-in | sync | **YES** | 2–3 | 2 | breach check (D) | yes | — |
| **WL-002** | session / active context | sync | **YES** | 3–7 | 0 | — | per §10 | authorities per person |
| **WL-003** | school dashboard | sync | no | many | 0 | — | scoped | school size |
| **WL-004** | child / family list | sync | no | 1 + page | 0 | — | scoped | children × periods |
| **WL-005** | book catalogue | sync | no | 1 + page | 0 | — | scoped | titles |
| **WL-006** | stock list | sync | no | 1 + page | 0 | — | scoped | titles |
| **WL-007** | settlement list | sync | no | 1 + page | 0 | — | scoped | cycles × children |
| **WL-008** | **settlement confirmation — I-2** | **sync** | **YES** | ~4 | see §9.1 | **none** | **ONE** | items per cycle |
| **WL-009** | teacher handover queue | sync | no | 1 + page | 0 | — | scoped | class size |
| **WL-010** | handover command | sync | **YES** | 2 | 2 | — | yes | — |
| **WL-011** | replacement workflow | sync | **YES** | 2–3 | 1–2 | — | yes | — |
| **WL-012** | enrolment import — preview | **async above threshold** | no | many | **0 product truth** | — | staging only | rows |
| **WL-013** | enrolment import — commit | **async above threshold** | **YES** | many | many | — | **chunked** | rows |
| **WL-014** | reconciliation import | async | no | many | many | — | chunked | statement rows |
| **WL-015** | reconciliation matching | async | no | **OPS-F03** | few | — | per candidate | **tenant lifetime history** |
| **WL-016** | report / export | **async above threshold** | no | many | 0 | object store | read-only | dataset |
| **WL-017** | notification creation | sync | **YES** | 0 | 1 | **none** | **inside the caller's** | events |
| **WL-018** | email delivery | **async** | no | 1 | 1–2 | **Resend** | no | notifications |
| **WL-019** | daily digest | async | no | many | many | Resend | per school | schools × recipients |
| **WL-020** | CMS edit | sync | no | few | few | — | scoped | revisions |
| **WL-021** | CMS publish | sync | **YES** | few | **1 pointer** | cache invalidation **after commit** | **ONE** | — |
| **WL-022** | public website read | sync | no | 1–2 | 0 | — | **SCOPED — public publication context, RLS, pooled connection** | traffic |
| **WL-023** | object upload | sync + async | no | 1 | 2 | **S3 signed URL** | no | uploads |
| **WL-024** | scan completion | async | **YES (gate)** | 1 | 1 | **GuardDuty event** | yes | uploads |
| **WL-025** | support mode | sync | **YES** | 3–5 | 1 | — | yes | — |
| **WL-026** | scheduled job drain | async | varies | many | many | varies | per job | eligible jobs |

**Measurement method for every row is Stage 20's**, and this catalogue is what Stage 20 measures
against. **A workload with no row here has no budget and no owner.**

---

## 7. Operating envelope

**OPS-D001 · The envelope is stated per school, and the platform figure is a multiple of it**

```
ONE SCHOOL, ORDINARY DAY      tens of staff · hundreds of families
                              a few hundred interactive requests per hour
ONE SCHOOL, SEPTEMBER PEAK    enrolment import + settlement + distribution CONCURRENTLY
                              the import is the long pole; the settlement is the hot one
PLATFORM                      the sum, but NOT synchronised — schools peak in the same
                              WEEK, not the same MINUTE, and the design does not assume
                              they are politely staggered either
```

**OPS-D002 · The September peak is the design case, and it is a WRITE peak**

Enrolment import, settlement confirmation and distribution all land in the same fortnight. **The
heaviest operations are writes and they are transactional**, which makes **connection pressure (§10) —
not CPU — the binding constraint.** That is why §10 is the largest section in this document.

---

## 8. Interactive latency budgets

**Engineering starting targets for Stage 20 to validate. Not SLAs, not customer promises, and NOT
claims about current behaviour.**

| Class | Target (p95) | Rationale |
|---|---|---|
| **INTERACTIVE READ** — a list or a screen | **≤ 800 ms** server time | a UK primary school on school Wi-Fi, plus a possible cold start |
| **INTERACTIVE COMMAND** — an ordinary write | **≤ 1,000 ms** | includes one scoped transaction |
| **I-2 COMMAND** — settlement confirmation | **≤ 1,500 ms**, with the **transaction itself ≤ 250 ms** | §9 — the transaction budget is the one that matters |
| **BACKGROUND ACCEPTANCE** — 202 for a job | **≤ 500 ms** | accepting work must never wait for it |
| **BACKGROUND COMPLETION** | **no latency target — a progress fact instead** | a target nobody measures is decoration |
| **PUBLIC WEBSITE** | **≤ 400 ms** server time | it is a small published page and it is cacheable (§25) |

**These are deliberately unglamorous.** Chasing a 100 ms figure on a serverless platform with a cold
start and a UK school's connection is a vanity number. **The honest constraint is the cold start and
the connection acquisition, and §10 addresses the one this stage controls.**

**Every figure above is E2. None is claimed to be met today.**

---

## 9. I-2 performance — the absolute rule

**OPS-D003 · I-2 stays one operation, one transaction, one commit. Its latency is fixed by its
queries, never by splitting it.**

### 9.1 What I-2 actually writes — four classes, not a table count

**A correction to this document's own draft, which said "5 tables" and drew an `audit INSERT` as though
the final audit table already existed.** Neither was right. **The invariant is about an atomic outcome,
not a number of tables**, and the audit table's physical shape is **Stage 19's, not Stage 15's**.

```
                    ONE TRANSACTION · ONE COMMIT                 Stage 15 DBD-030

  AUTHORITATIVE BUSINESS WRITES
    settlement_reviews   INSERT    DBI-014 refuses a second confirmation
    allocations          INSERT    DBI-015
    stock_movements      INSERT    CK-11 · CK-12          append-only domain history

  PROJECTION WRITE
    stock_levels         UPDATE    conditional — WHERE on_hand >= qty
                                   ── the CONTENTION POINT (§9.2)

  REQUIRED NOTIFICATION FACT
    notifications        INSERT    MOD-009 truth, required consequence

  REQUIRED AUDIT FACT
    ── MOD-013 · same transaction where Stage 19 classifies the operation
       CONSEQUENTIAL AND REQUIRED.
       PHYSICAL TABLE, COLUMNS, INDEXES AND PAYLOAD ARE STAGE 19's.
       NO DBT identifier is assigned here, and this is NOT counted among
       Stage 15's physical I-2 tables.

     one SET LOCAL context · one connection · NO network call
```

**Stage 12 AD-026 already requires it** — consequential audit shares the business outcome's fate — so
the *requirement* is locked and only the *shape* is deferred. **Stage 18 states the coupling; Stage 19
states the table.**

### 9.2 The transaction-duration objective

**OPS-D004 · ≤ 250 ms p95, and ≤ 1 s absolute**

**Why the transaction budget matters more than the request budget.** The transaction holds a
connection **and** row locks on `stock_levels`. Two confirmations for the same book contend on that
conditional `UPDATE`. **Transaction duration is therefore the system's contention multiplier**, and it
is the number to defend.

**What is analysed when I-2 is slow — in this order:**

| # | Suspect | Fix |
|---|---|---|
| 1 | the claim-lock read | index on `(school_id, requirement_item_id)` |
| 2 | money and application reads | **IX-1** — every index leads with `school_id` |
| 3 | the allocation insert | **DBI-015**'s partial unique is the index |
| 4 | **the `stock_levels` conditional UPDATE** | **the contention point.** One row per `(school_id, book_id)` — keep the transaction short so the lock is held briefly |
| 5 | the stock movement insert | append-only, cheap |
| 6 | the notification insert | append-only, cheap |
| 7 | the audit insert | append-only, cheap |

**OPS-P2 restated as a prohibition:** if every one of the seven is optimised and the budget is still
missed, **the answer is a better index or a narrower lock — never a queue.** Splitting I-2 changes what
the product guarantees, and no latency number is worth that.

**A network call inside I-2 is forbidden** (Stage 17 INTAR-004), which is why the "external" column for
WL-008 reads **none**.
---

## 10. Database connection pressure under A13-001

**This is the required deliverable of this stage, and the binding constraint on everything else.**

### 10.1 What A13-001 does to the read path

```
BEFORE A13-001          a scoped read could go over the Neon HTTP driver — no connection held

AFTER  A13-001          RLS needs a tenant context             Stage 15 DBD-005
                        the context is SET LOCAL               Stage 15 §7.4 — never session SET
                        SET LOCAL requires a TRANSACTION
                        a transaction requires a POOLED CONNECTION
                        ⇒ EVERY SCOPED READ NOW TAKES A CONNECTION FROM THE POOL
```

**A13-001 was the correct decision and it is not reopened.** Its operational consequence is that the
connection pool moved from being used by writes to being used by **essentially every authenticated
request**, and **nothing in the current code accounts for that.**

### 10.2 The arithmetic

```
ONE SCREEN            k parallel TanStack queries, each an independent scoped read
ONE READ              = one transaction = one pooled connection, briefly
ONE INSTANCE          new Pool({ … })  with NO max  → node-postgres default = 10
SERVERLESS            each concurrent invocation is its OWN process with its OWN pool

DEMAND  =  concurrent instances  ×  pool max
        =  unbounded             ×  10 (a default nobody chose)
```

**Neon has a connection ceiling.** Exceeding it does not degrade gracefully — **new connections are
refused**, and because `getPool()` sets no `connectionTimeoutMillis`, **a request waiting for a
connection waits indefinitely** until the platform's own timeout kills it. The user sees a hang, then a
generic failure. → **C-99**.

**Public-origin reads are inside this budget, not outside it.** Per §10.6, a public published read is
an RLS-scoped transaction on a pooled connection. **Only a CDN or cache hit avoids the pool** — so the
connection budget must be sized for *cache misses on the public surface* as well as authenticated
traffic, and §25's cache is a connection control (OPS-D050).

### 10.3 The connection budget model

**OPS-D005 · Every request declares a connection budget, and the default budget is ONE**

| Rule | |
|---|---|
| **B1** | **A request holds at most ONE database connection at a time**, unless it is explicitly justified in this document. |
| **B2** | **A request never opens two scoped transactions in parallel.** Parallel independent reads inside one request multiply connection demand by the parallelism. |
| **B3** | **A connection is held for the shortest possible span** — acquire, `SET LOCAL`, read, commit, release. Never across a network call (OPS-P6), never across a template render. |
| **B4** | **An acquisition timeout exists and is short.** A request that cannot get a connection **fails fast with an honest error**, and never waits indefinitely. |
| **B5** | **A statement timeout and a transaction timeout exist**, so one pathological query cannot hold a connection for the whole function budget. |
| **B6** | **The pool has an explicit `max`**, chosen so that *plausible concurrent instances × max* sits inside Neon's ceiling with headroom. |
| **B7** | **Read composition is preferred over read multiplication.** A screen that would open six scoped transactions instead makes one composed read. |

**Stage 21 sets the actual numbers against Neon's plan; Stage 18 sets the constraints they must
satisfy.** The current `consoleDb.ts` shows the shape is already understood in this codebase —
`max`, `idleTimeoutMillis` and `connectionTimeoutMillis: 5_000` — **it is simply absent from the pool
that matters.**

### 10.4 Read composition — the lever that actually works

**OPS-D006 · A screen should preferably consume ONE scoped application read composition — and Stage 18
may not invent an endpoint to get one**

**A correction to this document's draft, which presented a new `dashboard` endpoint as though a
performance stage could add it.** The performance principle is right; **the API ownership was wrong.**
**Stage 14 owns endpoints and response contracts.**

```
TODAY (shape)   a screen mounts N independent queries ─► N scoped transactions ─► N connections

TARGET          the screen consumes ONE scoped application read composition, where doing so
                reduces redundant connection and round-trip pressure

THAT COMPOSITION MAY USE
   an already-locked Stage 14 endpoint
   an existing application read model
   server-side composition BEHIND an existing contract

IF IT REQUIRES A GENUINELY NEW ENDPOINT OR A CHANGED RESPONSE CONTRACT
   ⇒ Stage 18 raises a TRACEABLE STAGE 14 AMENDMENT (A14-nnn)
   ⇒ it does NOT add the route
```

**Stage 18 raises no A14 amendment**, because it has not identified a specific screen whose composition
is impossible within the locked contract — **that analysis needs Stage 20's measurements to say which
screens actually justify it.** Recording the mechanism now means the optimisation cannot later be
performed by quietly adding routes in a performance pass.

**Two limits on the principle:**

```
NOT for independently mutable panels the user refreshes separately — they stay separate on purpose
NOT a mega-endpoint bundling unrelated concerns merely to hit a connection count
     ── that trades a connection problem for a cache-invalidation problem (§13)
```

### 10.5 Behaviour when no connection is available

```
acquire fails  ⇒  503 with the standard error contract and a correlation id   Stage 14 · Stage 16
               ⇒  NEVER a hang
               ⇒  NEVER a fallback to the HTTP driver for a SCOPED read
                     — that would run with NO TENANT CONTEXT                  A13-001 · SECAR-008
               ⇒  NEVER a fallback to memory storage                          C-71 · SEC-D085
               ⇒  the failure is COUNTED and ALERTED  (§29)
```

**OPS-P14 in its sharpest form: the degraded path refuses. It does not relax RLS to keep serving.**

### 10.6 PUBLIC is not UNSCOPED — a correction

**This document's draft said the public website is "unscoped — HTTP driver OK" and that host → school
resolution runs on HTTP. Both were wrong, and they contradicted locked Stage 15.**

**Stage 15 places the public site behind the PUBLICATION policy class.** `schools`,
`school_public_domains`, `site_settings`, `site_revisions` and every published page, news item, event
and media link are **RLS-protected**, read through a public publication context. **A13-001 then applies
without exception: any RLS-protected read needs a transaction-capable connection and a
transaction-local security context.**

```
PUBLIC WEBSITE REQUEST
   resolve the safe public context from the host
   BEGIN                                     ── a short scoped read transaction
     SET LOCAL <public publication context>  ── Stage 16's mechanism
     read the published material              ── RLS PUBLICATION policy decides
   COMMIT / release                          ── the connection goes back
```

**The Neon HTTP driver may NOT be used for a published read.** A13-001 permits it only for a read that
is genuinely **non-RLS and non-contextual**, and a published-site read is neither.

| Read | Driver |
|---|---|
| **public website render (WL-022)** | **pooled connection, in a scoped publication transaction** |
| **host → school resolution** | **pooled connection** — `school_public_domains` is RLS-protected |
| `/health/live` | **no database access at all** (§26) |
| a genuinely non-RLS, non-contextual read | HTTP driver permitted |
| every authenticated scoped read · every write | pooled connection, in a transaction |

**No non-RLS public bypass is created for performance.** Under **OPS-P14**, a degraded or faster path
never relaxes an isolation control — and a public bypass would be exactly that, on the surface with the
highest volume and the least authentication.

**The withdrawn claim, stated plainly:** the draft's assertion that *"the highest-volume public surface
needs no connection from the pool"* **is withdrawn for render-on-request database misses.**
**CDN and cache hits still avoid the origin and therefore avoid the database entirely** (§25) — which
is now the *only* thing that keeps public traffic off the pool, and makes §25's cache a
**connection-budget control**, not merely a latency optimisation.

**If Stage 21 later proposes a precomputed or static public representation that does not query
RLS-protected tables per request, that is a distinct delivery implementation** and it must preserve the
Stage 15 publication boundary — the artifact is generated *from* a scoped publication read, it does not
replace one with an unscoped query.

---

## 11. Query-shape analysis

**OPS-D007 · Every hot path gets a current shape, a target shape and a boundedness statement**

### 11.1 Reconciliation candidate selection — WL-015

```
CURRENT   SELECT * FROM provider_payments
          WHERE school_id = $1
          ORDER BY paid_at DESC                 ← no reference predicate
                                                ← no date window
                                                ← no LIMIT
          then filter in JavaScript against a Set

TARGET    SELECT … FROM provider_payments
          WHERE school_id = $1
            AND paid_at >= $window_start        ← bounded by a statement window
            AND ( normalised_reference IN (…)   ← the reference is the selective predicate
                  OR customer_email = $email )
          ORDER BY paid_at DESC
          LIMIT $candidate_cap
```

**Boundedness:** the current query grows with **tenant lifetime**; the target grows with the
**statement window**, which does not grow. **The tenant predicate is already correct and is kept** —
what is added is the narrowing that makes it a lookup rather than a scan.

**Index required:** `(school_id, normalised_reference)` and `(school_id, paid_at DESC)`.
**Neither exists in Stage 15's locked schema.** Stage 15 deliberately declined speculative indexes and
left index work to Stage 20 with measurements. **Stage 18 therefore does not add them** — it records
them as **the two indexes Stage 20 is expected to justify**, and if Stage 20's measurement confirms
them, **a traceable A15-nnn amendment adds them.** **No index is silently created here.**

### 11.2 Serial verification — WL-015

```
CURRENT   for (const order of orders) { await verifyOrder(order.id, …) }      N round trips, serial

TARGET    batch-load every order's candidates in ONE query (WHERE order_id IN (…))
          match in memory
          write outcomes in ONE bounded transaction per chunk
```

**Bounded by the chunk size, which §17 sets.**

### 11.3 The general rules

| Prefer | Over |
|---|---|
| set-based SQL | one query per row |
| a batched `IN` or a subquery | a loop of point reads |
| a join or a composed read | sequential dependent reads |
| bounded pagination | "fetch all, filter in JS" |

**OPS-D008 · A new index beyond Stage 15's locked schema requires a traceable A15-nnn amendment,
justified by Stage 20's measurement — never a silent addition.**

---

## 12. Pagination

Stage 14 locked cursor pagination for every growing collection, and Stage 15's **DBD-039** requires a
**total sort order ending in a unique tiebreaker** with **IX-4** indexing that exact tuple.

**OPS-D009 · Operational pagination limits**

| | Value | Why |
|---|---|---|
| default page size | **50** | a school list on a laptop |
| maximum page size | **200**, enforced server-side | `limit=100000` must not defeat the contract |
| a request above the maximum | **clamped, and the response says so** — never silently truncated, never a 400 that breaks a client | OPS-P10 |
| sort key | always ends in the primary key | DBD-039 |
| **total counts** | **not returned by default** on a growing collection | a `COUNT(*)` over a growing table is the expensive part of a cheap query |
| when a count is genuinely needed | an **approximate** count, labelled as approximate, or a separate deliberate request | |
| structurally small config lists | **not paginated** | forcing pagination on a list of eight academic periods is ceremony |

**OPS-D010 · "About N" is an honest answer; a precise count nobody can afford is not.** Where a screen
shows a total, it shows an approximation and says so, or it shows the page's own range.

---

## 13. Client cache policy

**OPS-D011 · `staleTime: Infinity` is withdrawn as a global default. Cache classes replace it.**

**The current default is `staleTime: Infinity`, `refetchOnWindowFocus: false`, `refetchInterval: false`
— so nothing ever refetches unless explicitly invalidated.** For a product where a colleague's action
changes what you are looking at, that is wrong for operational truth. → **C-98**.

### 13.1 The cache safety matrix

| Class | Examples | Stale time | Refetch on focus | Invalidated by |
|---|---|---|---|---|
| **IDENTITY / CONFIG** | school identity, branding, academic periods | **1 hour** | no | the mutation that changed it |
| **STATIC REFERENCE** | book catalogue metadata, section kinds | **1 hour** | no | its own mutation |
| **OPERATIONAL LIST** | child list, class list, requirement list | **60 s** | **yes** | related mutations |
| **FINANCE / SETTLEMENT** | settlement position, money events, reconciliation | **0 — always revalidate** | **yes** | **every** settlement, payment or adjustment mutation |
| **HANDOVER / STOCK** | fulfilment board, stock levels | **0 — always revalidate** | **yes** | every handover, allocation, stock mutation |
| **AUTHORITY / SESSION** | `/api/auth/me`, available contexts, support state | **0 — never cached as authority** | **yes** | context switch · support mode · **`authority_version`** |
| **PUBLIC PUBLISHED CMS** | the public site | **cacheable — §25** | n/a | publication |

**OPS-D012 · The client cache never authorises anything**

**The server resolves authority per request (Stage 16 SEC-D013).** A stale client cache can therefore
show a button that the server refuses — **which is the correct failure**, and Stage 12's SA-P2 says so:
navigation hiding is presentation, never enforcement. **The cache classes above exist to stop the user
being *misinformed*, not to stop them being *over-privileged*.** They are a correctness-of-display
concern, and saying that plainly is what keeps them from being mistaken for a security control.

**OPS-D013 · Mandatory invalidation triggers**

```
context switch            ⇒  clear EVERYTHING scoped        the tenant may have changed
enter / exit support mode ⇒  clear EVERYTHING scoped        SC-6
authority_version changes ⇒  clear authority + operational  SEC-D013
sign-out                  ⇒  queryClient.clear()            already done today
a mutation                ⇒  invalidate its own class and every class it can affect
```

**A settlement confirmation invalidates finance AND stock AND handover**, because I-2 writes to all
three. **A mutation's invalidation set is derived from what its transaction touches** — which Stage 15
already documents per command, so the list is not guesswork.

**OPS-D014 · No Redis is introduced because the browser cache was corrected.** Fixing a client default
is a client change. **The two are unrelated and conflating them is how a cache service gets adopted by
accident.**

---

## 14. Server cache decision

**OPS-D015 · NO SERVER CACHE IN V1**

**No Redis, no Memcached, no distributed cache, no in-process cache of tenant data.**

| Reason | |
|---|---|
| scale | the envelope (§7) is hundreds of families per school, not millions of requests |
| serverless | an in-process cache on a platform that creates and destroys processes is a cache with a hit rate nobody can predict |
| **correctness** | the highest-read data is the data that must never be stale — settlement, stock, authority |
| **cost of being wrong** | a cache bug in this product shows a family the wrong payment position |

**The one thing that IS cached is the public published site (§25)** — which is immutable between
publications, has no tenant-operational content, and invalidates on exactly one event.

**Never cached as authority, in any layer:** permissions · active guardian relationships · teacher
staffing for a command · settlement position · stock · custody · support engagement · break-glass
elevation · idempotency records · job claim state.

**OPS-D016 · Reconsideration thresholds — stated so this is a decision, not a preference**

```
REVISIT the no-server-cache decision when ANY of:
   a single read path is measured above its §8 budget AND is already index-optimised
   the SAME unchanged read is served more than ~100× per minute platform-wide
   connection pressure (§10) is dominated by reads that are provably identical
FIRST TRY, IN THIS ORDER:   query correction → index → pagination → read composition
   Redis is the LAST option, not the first.                                    OPS-P13
```

---

## 15. Reporting and export

**MOD-010 is read-only and stays read-only.** A report may read, aggregate and project; **it may never
write a result back as a new business authority** (Stage 13 APP-029).

**OPS-D017 · The synchronous/asynchronous boundary is a measured cost, not a row count**

| | Path |
|---|---|
| an interactive report that fits its §8 budget | **synchronous composition** |
| a report that does not, or an export of a whole dataset | **202 + a durable job (DBT-069) + a downloadable result object** |
| the result | written to object storage (**PRV-004**), fetched by a **signed, short-lived URL** (SEC-D049) |
| the result's retention | **operational — §28** |

**OPS-D018 · No analytics warehouse in V1.** PostgreSQL serves the reporting envelope. **The trigger to
revisit is in §30**, and it is a measurement, not a feeling.

---

## 16. Enrolment imports

The locked pipeline is preserved exactly: **upload → parse → map → validate → preview → explicit
commit.**

**OPS-D019 · Preview NEVER writes product truth**

Staging rows only — **DBT-072 `import_sessions`, DBT-073 `import_rows`, DBT-074
`import_proposed_classes`.** This is Stage 15's design and Stage 18 does not soften it.

**OPS-D020 · Import operational bounds**

| | Value | Note |
|---|---|---|
| security ceiling | **Stage 16's file limits are a HARD ceiling** | Stage 18 may choose smaller, **never larger** |
| operational row ceiling for a synchronous parse | **≤ 500 rows** | above this, a durable job |
| chunk size for commit | **100 rows per transaction** | bounded lock duration, bounded memory |
| parse memory | **streamed or bounded; never the whole workbook expanded** | Stage 17 INT-D019 |
| row errors | **collected, all of them** | an import that stops at the first error makes an admin fix 200 errors 200 times |
| class creation | **batched, after `normalised_name` resolution** | DBT-074 exists to stop duplicate-class forking |

**OPS-D021 · Transaction granularity, stated exactly — a bounded series of ROW transactions with
durable progress**

**A correction to the draft's ambiguous "100 rows per transaction."** That could mean an all-or-nothing
chunk or a batch of independent rows, and the admin-visible consequence differs completely. **The
choice is made and its consequence is stated.**

```
CHOSEN     each LOGICAL ROW is one transaction
             a child + family link + class membership + requirement items  ── ATOMIC together
           a chunk of 100 is a BATCHING UNIT for progress and memory, NOT a rollback unit
           commit progress is recorded durably on the import session after each row

REJECTED   one 100-row all-or-nothing transaction
             because a single bad row on line 63 would discard 99 good ones, and the
             admin would re-upload the whole file to fix one typo
```

**Admin-visible consequence, said plainly:** a commit that fails part-way leaves **the rows before the
failure committed and the rest not**, and the session shows exactly which. **The admin fixes the failed
rows and resumes; they do not start again.** That is the behaviour a 200-row spreadsheet with three
typos actually needs.

**After a crash or a retry: no row is half-committed and no row is duplicated.** Half-commit is
impossible because a logical row is one transaction. Duplication is impossible because **resumption is
driven by the staging row's own committed state** (OPS-D022), not by a counter the process was holding.

**OPS-D022 · Commit is deterministic and idempotent.** Re-running a commit for the same session
produces the same result and no duplicates — enforced by the staging row's own identity, not by hoping
the admin does not press twice.

---

## 17. Reconciliation

**The known hotspot (OPS-F03, OPS-F04), and the design that bounds it.**

**OPS-D023 · Candidate narrowing is tenant-first, then reference, then window**

```
1  TENANT       school_id = $1                    already correct today — kept
2  REFERENCE    normalised_reference IN (…)       THE selective predicate
3  WINDOW       paid_at within the statement's own date range, plus a margin
4  AMOUNT       narrows candidates; never DECIDES
5  CAP          LIMIT — beyond the cap it is a human's job, not a matcher's
```

**OPS-D024 · Enrichment is batched, never per-row** — one query for every candidate in the chunk
(§11.2).

**OPS-D025 · Ambiguity goes to a person; it is never resolved by confidence**

**A fuzzy matcher that silently chooses is worse than no matcher.** Where the narrowing yields more
than one plausible candidate, or none, **the row becomes a finance investigation (MAIL-016)** and a
person decides. **This is not a limitation to be engineered away** — it is the product's design, and
Stage 14 made confirmation a human act under CAP-049 for the same reason.

**OPS-D026 · Reconciliation stays provider-neutral.** It consumes a statement, not a vendor API
(Stage 17 INT-D011). **INTQ-3's outcome does not touch it.**

---

## 18. Durable job execution

**Stage 15's DBT-069 `jobs` is the authority. No external queue product is introduced.**

**OPS-D027 · The claim is an atomic PostgreSQL operation using `FOR UPDATE SKIP LOCKED`**

```sql
WITH claimed AS (
  SELECT id FROM jobs
   WHERE state = 'eligible' AND scheduled_for <= now()
     AND (lease_expires_at IS NULL OR lease_expires_at < now())
   ORDER BY priority, scheduled_for
   LIMIT $batch
   FOR UPDATE SKIP LOCKED                    -- two workers never claim the same job
)
UPDATE jobs SET state='running', lease_expires_at = now() + $lease, attempt = attempt + 1,
                claimed_by = $worker
 WHERE id IN (SELECT id FROM claimed)
RETURNING *;
```

**`SKIP LOCKED` gives EXCLUSIVE CONCURRENT CLAIMING. It does NOT give exactly-once EXECUTION.**
**A correction to this document's draft, which said it "provides exactly-once claiming" and implied
more than it delivers.**

```
worker claims an email job          exclusive — no other worker holds it
provider accepts the email          the side effect has HAPPENED
worker crashes before marking done  the row is still 'running'
the lease expires                   the row returns to eligible
another worker executes it AGAIN    ── the email is sent TWICE
```

```
JOB CLAIM             EXCLUSIVE
JOB EXECUTION         AT-LEAST-ONCE under crash and recovery
BUSINESS CONSEQUENCE  MUST be idempotent or deduplicated wherever a duplicate would harm
```

**No distributed exactly-once semantics are claimed anywhere in this document.** What `SKIP LOCKED`
removes is the need for a queue *product* to arbitrate claims — **not the need for idempotent
handlers**, which no queue product would have removed either.

**OPS-D068 · Every job handler declares its duplicate-consequence protection**

| Handler | Protection |
|---|---|
| email delivery | the **notification id + attempt** is the unit; a resend is visible on DBT-054 and the provider's idempotency support is used where offered |
| digest | **DBI-020**'s `(job_kind, school_id, scheduled_for)` partial unique — a second run for the same day cannot be created |
| retention deletion | naturally idempotent — deleting an already-deleted row is a no-op |
| export generation | keyed by the request; a duplicate overwrites the same object |
| reconciliation chunk | keyed by the staging rows already marked processed |
| **anything writing business truth** | **an operation-specific uniqueness constraint**, per Stage 15 DBD-031 — never "we assume it runs once" |

**A handler with no declared protection and no explicit non-retry rule is not shipped.** **OPS-P7:
retries are safe before they are frequent.**

**OPS-D028 · Job execution parameters**

| | Value | Note |
|---|---|---|
| claim batch | **10 jobs** per invocation | bounded work per function |
| lease | **2 × the job kind's expected duration**, minimum 60 s | |
| heartbeat | **not required at V1** — the lease is the recovery mechanism | a heartbeat adds writes to buy precision nothing needs yet |
| max attempts | **5** | |
| backoff | **exponential with jitter** — 1 min, 4, 15, 60, 240 | jitter matters: without it, every failure from one outage retries in lockstep |
| terminal failure | state `failed`, **visible**, manually retryable | never silently dropped |
| stuck-job recovery | **an explicit reclaim step — OPS-D069** | **no in-memory ownership anywhere** |
| duplicate prevention | **DBI-020**'s two scope-explicit partial uniques | Stage 15 |

**OPS-D069 · An expired lease does not requeue itself — a reclaim statement does it**

**A correction to this document's draft**, whose claim query filtered `state = 'eligible'` while the
prose said a running job's expired lease "returns it to eligible." **That transition does not happen by
itself**, and leaving it implicit is how stuck jobs stay stuck.

```sql
-- STEP 1 · reclaim, at the start of every drain, in the SAME transaction as the claim
UPDATE jobs
   SET state = 'eligible', claimed_by = NULL, lease_expires_at = NULL
 WHERE state = 'running'
   AND lease_expires_at < now()
   AND attempt < max_attempts;

-- rows at max_attempts are NOT reclaimed — they become terminal (OPS-D029)

-- STEP 2 · claim, as OPS-D027, with FOR UPDATE SKIP LOCKED
```

| Requirement | How it is met |
|---|---|
| two workers cannot both recover the same row | the reclaim `UPDATE` takes row locks; the second worker's predicate no longer matches |
| a max-attempt job becomes terminal, not recyclable | `AND attempt < max_attempts`, and a separate sweep sets those to `failed` |
| recovery is durable | it is a database statement, not a process |
| **no in-memory watchdog is authoritative** | there is no watchdog |

**OPS-D029 · A poison job cannot loop forever.** Five attempts with growing backoff, then terminal and
visible. **A job that fails five times is a defect report, not a retry candidate.**

**OPS-D030 · In-memory job ownership is forbidden.** The lease is in the row. A process that dies holds
nothing.

---

## 19. Job fairness

**OPS-D031 · Fairness is a bounded per-tenant rank inside the claim — expressed as implementable SQL**

**A correction to the draft's "round-robin across schools — one `ORDER BY` clause", which was too vague
to build.** A plain `ORDER BY` cannot cap per-tenant share. A window function can:

```sql
WITH ranked AS (
  SELECT id, priority, scheduled_for,
         ROW_NUMBER() OVER (
           PARTITION BY scope_kind, school_id        -- platform rows partition on scope_kind
           ORDER BY priority, scheduled_for, id      -- priority is preserved WITHIN a tenant
         ) AS rn
    FROM jobs
   WHERE state = 'eligible' AND scheduled_for <= now()
),
fair AS (
  SELECT id FROM ranked
   WHERE rn <= $per_tenant_cap                       -- no tenant fills the batch
   ORDER BY priority, scheduled_for, id              -- global order across the fair set
   LIMIT $batch
   FOR UPDATE SKIP LOCKED                            -- claim stays concurrency-safe
)
UPDATE jobs SET state='running', … WHERE id IN (SELECT id FROM fair) RETURNING *;
```

| Requirement | How it is met |
|---|---|
| no tenant fills the whole batch | `rn <= $per_tenant_cap` |
| platform jobs have an explicit class | `PARTITION BY scope_kind, school_id` — Stage 15's discriminator |
| **`school_id NULL` is not a fake tenant** | platform rows partition on `scope_kind = 'platform'`, never on a NULL school |
| priority is not broken | it orders within the partition **and** across the fair set |
| claim stays concurrency-safe | `FOR UPDATE SKIP LOCKED` is retained |

**This is one query.** No scheduler service, no external queue, no priority-aging heuristic.

| Tool | Used | Why |
|---|---|---|
| bounded batch per school | **YES** | the simplest thing that works |
| round-robin across schools | **YES** | one `ORDER BY` clause |
| per-tenant concurrency cap | **YES** — a small integer | stops one import monopolising workers |
| job priority classes | **YES — three only**: `interactive` (a user is waiting) · `standard` · `bulk` (digest, export) | |
| weighted fair queueing, dynamic priorities, aging | **NO** | **OPS-P13** — a scheduler nobody can reason about is a worse failure mode than a slow queue |

**OPS-D032 · A bounded PostgreSQL claim is sufficient, and building more is a decision requiring
evidence.** The threshold that would justify it is in §30.

---

## 20. Cron and continuation behaviour

**The target endpoint is Stage 14's API-278 `POST /api/internal/jobs/run` (CAP-093, SC-10).** Stage 17
INT-D025 established that; Stage 18 does not redefine it.

**OPS-D033 · The trigger makes work eligible. The drain does the work. They are separate.**

```
TRIGGER   →  enqueue: create the eligible job rows for today          FAST, bounded
DRAIN     →  claim a batch (§18) → execute → release or fail          BOUNDED by budget
             remaining eligible work stays IMMEDIATELY ELIGIBLE
             the response reports what remains and does NOT say ok:true   OPS-P10 · INTAR-011
```

**OPS-D034 · Drain budget and the safety margin**

| | Value |
|---|---|
| function ceiling | **`maxDuration: 30`** — `vercel.json`, current |
| drain wall-clock budget | **20 s** — two-thirds |
| **safety margin** | **10 s reserved**, so a claimed job can finish and the response can be written |
| stop claiming when | elapsed > budget **OR** the next job's expected duration would exceed the remaining margin |
| unfinished claimed jobs | **lease expires → back to eligible** (OPS-D028) |

**Stopping *before* starting work that cannot finish is already the current code's instinct**, and it
is correct — the existing comment about not leaving half a mailing list done is right. **What is added
is that the remainder becomes immediately eligible instead of waiting for tomorrow.**

**OPS-D035 · Stage 18 designs the application behaviour; Stage 21 chooses the cadence**

**This design is deliberately not built around the current once-daily cron.** If the platform invokes
the drain once a day, the drain still drains what it can and the rest stays eligible; if it invokes it
more often, the same code drains faster. **The application does not encode a schedule** — which is what
makes **C-96** genuinely fixed rather than re-parameterised.
---

## 21. Notification delivery

**MOD-009 owns notification truth. MOD-015 attempts delivery. Stage 18 sets the delivery numbers and
touches the truth not at all.**

**OPS-D036 · Delivery retry policy**

| | Value |
|---|---|
| first attempt | **immediately after the notification's transaction commits** — never inside it |
| retryable | timeout · 5xx · rate-limited · transient network |
| **non-retryable** | invalid address · rejected content · **hard bounce** · complaint |
| backoff | 1 min, 5, 30, 2 h, 6 h — **with jitter** |
| max attempts | **5** |
| terminal | `delivery_failed` recorded on **DBT-054**, visible to the school |

**OPS-D037 · A retry never creates a second notification**

```
notification (DBT-053)   ONE row — the durable truth, written inside the business transaction
delivery_attempts        MANY rows — one per attempt, append-only          DBT-054
```

**The retry loop operates on `delivery_attempts` and never inserts into `notifications`.** This is
Stage 11's MOD-009/MOD-015 split doing the work it was created for, and it is why a provider outage
cannot multiply a family's messages.

**OPS-D038 · A provider outage never rolls back a committed business fact**

I-2 commits; the notification row is inside that commit; delivery is outside it. **Resend being down
means an email is late, not that a settlement is unconfirmed.**

**OPS-D039 · Suppression behaviour, using A15-002's `email_suppressions`**

```
hard bounce / complaint  ⇒  DBT-054 records the attempt outcome and failure_class
                         ⇒  DBT-078 email_suppressions gets a live row       DBI-033
                         ⇒  further delivery to that address is SKIPPED, recorded as suppressed
                         ⇒  the school and the person see a delivery problem they can act on
                         ⇒  credentials.email_verified_at is UNTOUCHED       Stage 17 INT-D015
```

**Suppression is released explicitly** — by the person correcting their address, or by an administrator
with the reason recorded (`released_by_person_id`, `released_reason`). **It never expires quietly**,
because an address that silently un-suppresses starts failing again without anyone noticing.

**OPS-D040 · A suppressed recipient still gets a notification row.** The truth that they were owed a
message is independent of whether a channel could carry it. **MOD-009 is unaffected by MOD-015's
problems** — which is the whole point of the split, and it means an in-app notification still appears.

---

## 22. Provider retries and circuit behaviour

**Stage 17 fixed which outcomes are retryable per contract (INT-D041). Stage 18 sets the numbers, and
they differ per provider because the failure semantics differ.**

**OPS-D041 · Per-provider operational budgets**

| Contract | Attempt timeout | Retries | Backoff | Overall deadline | Suspension |
|---|---|---|---|---|---|
| **INT-C001** email send | **5 s** | 2 in-request, then the job retries (§21) | job-level | 10 s in-request | 20 consecutive failures |
| **INT-C002** email event in | n/a — inbound | n/a | n/a | **ack within 2 s** | n/a |
| **INT-C003** object upload | signed URL — the browser owns the transfer | client | client | pending-upload window (§23) | 10 consecutive signing failures |
| **INT-C005** scan verdict | **event-driven**, not polled | provider | provider | **scan window 15 min**, then `ERROR` | 10 consecutive |
| **INT-C006** breach lookup | **2 s** | **1** | 250 ms | **3 s, then SKIP** | **never suspends — it fails open** |
| **INT-C007** error event | **2 s** | 0 | — | 2 s, then drop | never blocks a request |
| **INT-C008** uptime check | inbound | n/a | n/a | n/a | n/a |
| **INT-C009** future payment | **8 s** | 1, **with the provider's idempotency key** | 2 s | 10 s | 5 consecutive |

**The breach check's row is the one worth reading twice.** A 2-second timeout, one retry, then skip —
because a parent setting a password must not be blocked by a third party. **It is the only provider in
the table that never suspends**, and that is deliberate: suspension implies future calls stop, and a
skipped check that stops being attempted would silently become no check at all.

**OPS-D042 · Circuit behaviour — and a SCHOOL INTEGRATION is not a PLATFORM PROVIDER**

**A correction to this document's draft, which said "the integration is suspended" for every provider.**
Stage 17 INT-D003 locked that **DBT-040 is school-scoped (`school_id NOT NULL`)** and that platform
providers are **validated configuration, not rows.** A generic "integration suspended" statement
silently assumed a row that does not exist for email, storage, scanning or error tracking.

**A · SCHOOL-SCOPED INTEGRATION** — the future per-school payment provider (PRV-011, INTQ-1 = A)

```
repeated failures  ⇒  DBT-040.state = 'suspended'          a REAL school-owned row
                   ⇒  that school's administrator is told
                   ⇒  cooldown 15 min → ONE probe → doubling to a 4-hour ceiling
                   ⇒  manual resume always available, always audited
```

**B · PLATFORM-WIDE PROVIDER** — email transport, S3, the scanner, Sentry

```
repeated failures  ⇒  bounded retry (OPS-D041)
                   ⇒  a DEGRADED CONDITION on the health surface     §26
                   ⇒  a monitoring alert                              §29
                   ⇒  the affected capability blocks or degrades HONESTLY   §27
                   ⇒  automatic probe attempts resume as safe
                   ⇒  NO persistent `integration.state` — there is no integration row
```

**Where the durable state actually lives for a platform provider:** in the **job records** that carry
the retrying work (DBT-069), in the **provider attempt history** (DBT-054 for delivery), and in
**monitoring**. **That is sufficient for V1**, and it is why no new table is proposed.

**OPS-D070 · No hidden infrastructure state table is invented**

**If a durable circuit-state record for a platform provider is ever genuinely required beyond jobs,
monitoring and attempt history, it requires a traceable Stage 15 amendment (A15-nnn).** Stage 18
proposes none, because it has not found a requirement that the three existing mechanisms cannot carry.
**A performance stage quietly adding an infrastructure table is exactly the pattern the amendment
discipline exists to stop.**

**OPS-D043 · Callback receipt stays fast: authenticate → deduplicate → record the signal → respond.**
Stage 17 INTAR-027. **No business processing before the acknowledgement**, which is what keeps the
2-second ack budget for INT-C002 achievable.

**OPS-D071 · Persisting a provider event and interpreting it are two different acts**

```
SYNCHRONOUS, INSIDE THE REQUEST
   authenticate over raw bytes → deduplicate (DBI-021) → bind to tenant
   → write the provider_event row (DBT-041)  → 200
   ── the SIGNAL is now durable

ASYNCHRONOUS, AFTER the event is safely recorded
   a durable job MAY be enqueued to interpret it
   that job MAY:  classify · notify finance · prepare an investigation record
   that job MAY NOT:  confirm a settlement · allocate stock · move stock
                      · enter I-2 automatically  ── SECAR-031 · INT-D009
```

**The job is enqueued only after the event row commits.** Enqueuing first would create a job referencing
a signal that might not exist. **And the provider signal remains non-authoritative at every step** —
asynchrony changes when it is read, never what it is allowed to decide.

---

## 23. Object and scanner operations

Using Stage 17's selections — **PRV-004 AWS S3 `eu-west-2`** and **PRV-005 GuardDuty Malware Protection
for S3**.

**OPS-D044 · Object lifecycle timings**

| | Value |
|---|---|
| signed upload URL validity | **Stage 16's security policy** — not set here |
| pending-upload window | **30 minutes** from URL issue to object finalisation |
| an upload that never completes | the pending record expires; **orphan sweep** removes the object |
| **scan window** | **15 minutes** from object creation to a verdict |
| no verdict within the window | **`ERROR` — the object stays unavailable** |
| scan retry | **`FAILED` only**, twice, then terminal `ERROR` |
| orphan sweep | a durable job, **daily**, removing unreferenced objects past the pending window |
| published media cache | **§25** |

**OPS-D045 · A missing verdict is never a clean verdict**

```
NO_THREATS_FOUND  →  verified → may be published
THREATS_FOUND     →  quarantined                          Stage 16 SEC-D046
UNSUPPORTED       →  ERROR ─┐
ACCESS_DENIED     →  ERROR ─┼─  the object is NEVER served, published or referenced
FAILED            →  ERROR ─┘   INTAR-025
timeout / no event →  ERROR ─┘
```

**`UNSUPPORTED` is returned for password-protected archives and oversized objects, and it is the value
a careless implementation reads as "not infected".** Stage 17 flagged it; Stage 18 gives it a timeout
so that *absence* of an event is also an `ERROR` rather than an indefinite pending state.

**OPS-D072 · OPSQ-1 = A — an unscanned object is not viewable by anyone, including the school's own
staff**

```
UPLOADED / PENDING     stored privately · NOT downloadable · NOT viewable · scanner runs
NO_THREATS_FOUND       VERIFIED  → authorised private access permitted
                                 → publication may later become possible
THREATS_FOUND          QUARANTINED
UNSUPPORTED  ·  ACCESS_DENIED  ·  FAILED  ·  NO VERDICT / TIMEOUT
                       ERROR    → NOT viewable · NOT published
```

**A scanner outage may interrupt an upload workflow, and that availability cost is accepted.**

```
NO "view anyway" button, in any role, in any emergency
NO administrator override of a malware trust state
BREAK-GLASS DOES NOT MEAN SERVE UNSCANNED BYTES        Stage 16 §18
```

**Why the owner's answer is the right one, restated so nobody re-litigates it under pressure:** the
threat the `verified` gate exists to stop is malware reaching **a school's own staff**, not only malware
reaching the public. **An internal-viewing exemption would narrow the gate to publication and weaken a
promise Stage 16 already locked.** An outage during enrolment week is a real cost; it is smaller than
the one being avoided.

**OPS-D046 · A quarantined object is retained, not deleted.** It is evidence. Deletion is a deliberate
platform act, and its retention is **POLICY INPUT REQUIRED** (§28) because a quarantined upload may
matter to an investigation.

---

## 24. CMS publish

**OPS-D047 · Publish is one short transaction plus post-commit work**

```
INSIDE THE TRANSACTION        validate the revision is complete and its media are `published`
                              advance site_settings.published_revision_id   ONE UPDATE
                              freeze the revision                           Stage 15 DBD-037
                              write the audit record
                              ── target: ≤ 200 ms ──
AFTER THE COMMIT              invalidate / rebuild the public representation  (§25)
                              — a durable job, retryable, NEVER inside the transaction
```

**OPS-D048 · Publish never copies operational tenant data and never makes an external call inside its
transaction.** OPS-P6. **A cache invalidation that fails does not roll back a publication** — the
pointer has moved and the site is correct; the cache is merely stale until the retry succeeds.

**OPS-D049 · The public site never serves half of two revisions**

**Because publication is a single pointer move, there is no window in which some pages are new and
others old.** A reader gets revision N or revision N+1, never a mixture. **This is a property of Stage
15's design, not something Stage 18 has to engineer** — and it is why the revision model was chosen
over editing rows in place.

---

## 25. Public website delivery behaviour

Stage 12 and 13 deliberately left rendering timing open. **Stage 18 evaluates the operational model and
keeps Stage 21 free to implement the serving topology.**

| | **A — prerender at publication** | **B — render on request, cache invalidated by publication** |
|---|---|---|
| read latency | best — a static object | good, after the first request |
| cold start | **none** | affects the first request after invalidation |
| change frequency fit | schools publish **rarely** — days or weeks apart | fine either way |
| SEO | best | good |
| invalidation | write the output at publish | invalidate a key at publish |
| provider cost | storage + CDN | compute per miss + CDN |
| **failure mode** | a failed prerender means the **old** site stays up | a failed render is a **user-visible error** |
| complexity | a build step per publication | a cache key and an invalidation |
| **drafts leaking** | impossible — only published output exists | possible **if the cache key ignores the revision pointer** |

**OPS-D050 · RECOMMEND B — render on request with a publication-keyed cache — with A recorded as the
fallback**

**§10.6 changes the weight of this choice and the change is stated.** A public render that misses the
cache is now an **RLS-scoped read on a pooled connection**, so the cache is a **connection-budget
control**, not only a latency one. That strengthens rather than weakens the recommendation: option B
with a publication-keyed cache serves the overwhelming majority of public traffic from cache, and
**option A's prerender would also have to be generated from a scoped publication read.**

**Why B, given A looks better on latency.** The deciding factor is not speed, it is **coupling**. A
prerender step makes publication depend on a build succeeding, which puts an external process inside a
school's editorial workflow — and when it fails, the school has pressed Publish and nothing happened.
**B keeps publication as the single pointer move Stage 15 designed** (OPS-D049) and treats delivery as
a cache concern that can fail and retry without touching correctness.

**OPS-D073 · The cache contract: correctness must NOT depend on a purge succeeding**

```
CACHE KEY  =  public host  +  route  +  published_revision_id
                                        └── the PUBLICATION IDENTITY is IN the key
```

**This is the whole correctness argument, and it is a key-design argument, not an invalidation one:**

| Requirement | How the key satisfies it |
|---|---|
| a revision-N response can never be returned as N+1 | **N and N+1 are different keys.** A stale N entry is unreachable once the pointer moves, whether or not anything was purged |
| **the cache provider fails to invalidate** | **harmless.** The next lookup uses the new key, misses, and reads the new publication. The old entry ages out on its own |
| a draft is never cached on the public namespace | **a draft has no `published_revision_id`**, so it cannot form a public cache key at all |
| the authoritative pointer changes transactionally | Stage 15 DBD-037 — one `UPDATE`, and it is the source of the key |

**Purging is an optimisation for storage, never a correctness mechanism.** The draft's phrasing —
"invalidation is automatic" — was right in effect but stated it as though invalidation were the
mechanism. **The mechanism is that publication identity is part of the key**, so nothing needs to be
invalidated for the right answer to be served.

**An equivalent shape is permitted:** an immutable publication artifact identifier, provided it changes
transactionally with the pointer and no draft can ever produce one.

**OPS-D051 · Public reads never reach operational data.** Stage 15's PUBLICATION policy class exposes
exactly the published revision's rows and nothing else. **The isolation is the RLS policy, not the
absence of a connection** — §10.6 corrected that. A public read holds a pooled connection under a public
publication context, and **the policy is what prevents it reaching a child's record.**

**OPS-D052 · The authenticated SPA is NOT migrated to SSR.** Stage 12's AQ-1 = B stands. This section
is about the public site only.

**If this choice materially constrains Stage 21:** it does not. **Both options remain implementable**
— B is a cache configuration, A is a build step, and the invalidation event is the same in either case.
**Recorded so Stage 21 knows it is free.**

---

## 26. Health and readiness semantics

Stage 14 locked three endpoints. **OPS-F05: only `/api/health` and `/api/owner/system-health` exist.**

**OPS-D053 · What each endpoint means operationally**

| Endpoint | Question | Fails when | Exposure |
|---|---|---|---|
| **`/health/live`** | *is this process able to answer at all?* | the process is wedged | **public — a status code and nothing else** |
| **`/health/ready`** | *may this instance safely serve authoritative traffic?* | see below | **public — a status code and nothing else** |
| **`/health/dependencies`** | *what is the state of each dependency?* | never — it reports | **authorised Platform diagnostic ONLY** |

**OPS-D054 · What makes an instance NOT ready**

```
NOT READY  (readiness fails — the instance must not take authoritative traffic)
   database unreachable
   required schema version incompatible with this build
   critical configuration missing or invalid       Stage 16 SEC-D061/D062
   the session store unreachable

STILL READY  (degraded, and it SAYS so internally — §27)
   email provider down                  notifications are written; delivery queues
   error tracker down                   events dropped; never blocks a request
   malware scanner down                 uploads accepted, held pre-`verified`
   object storage down                  uploads refused; existing objects still serve
   breach corpus down                   the check skips
```

**The distinction is authority.** An instance that cannot reach PostgreSQL cannot tell the truth about
anything, so it must not serve. An instance that cannot send email can still confirm a settlement
correctly. **Readiness is about correctness, not completeness.**

**OPS-D055 · No dependency detail is ever public.** Stage 17 INT-D040 and Stage 16 §31: an external
uptime monitor sees `/health/live`'s status code. **Naming which dependency is down tells an attacker
what to attack.**

**Stage 21 configures the probes. Stage 18 defines what they mean.**

---

## 27. Graceful degradation matrix

**OPS-D056 · Every dependency state has a stated product behaviour, and none of them fakes success**

| Dependency down | Sign in | Browse | Confirm settlement (I-2) | Hand over | Upload | Publish | Notify |
|---|---|---|---|---|---|---|---|
| **PostgreSQL** | ✗ 503 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Email (Resend)** | ✓ | ✓ | **✓ — the notification row is written** | ✓ | ✓ | ✓ | **queued, visible** |
| **Object storage (S3)** | ✓ | ✓ | ✓ | ✓ | **✗ honest error; existing objects still serve** | **✓ — text publishes; new media does not** | ✓ |
| **Scanner (GuardDuty)** | ✓ | ✓ | ✓ | ✓ | **✓ accepted, HELD before `verified`** | **✓ — unscanned media is not publishable** | ✓ |
| **Breach corpus (HIBP)** | **✓ — check skipped** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Error tracking (Sentry)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Uptime monitor** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Future payment provider** | ✓ | ✓ | **✓ — reconciliation is a file, not an API** | ✓ | ✓ | ✓ | ✓ |
| **Custom-domain provider** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — **the public site may be unreachable; the app is not** | ✓ |

**The row that matters most is I-2's: it is ✓ in every state except PostgreSQL.** That is the payoff of
Stage 15's DBD-030 and Stage 17's INT-D030 — **the product's central business act depends on nothing
external.**

**OPS-D057 · What the user is told, in each degraded state**

```
QUEUED     "This will be sent shortly."          — a true statement about a real queue
BLOCKED    "Uploads are unavailable right now."  — with what still works
HELD       "Uploaded. It will be available once checked."  — the scan gate, in plain words
NEVER      a spinner that never resolves
NEVER      a success message for work that did not happen        OPS-P10 · BR-125
NEVER      an empty list where a read failed                     BR-125 · C-32
```

---

## 28. Operational retention

**A16-002.2 governs this section. Stage 18 sets engineering windows only.**

**OPS-D058 · Operational windows — Stage 18's to set**

| Record | Window | Why |
|---|---|---|
| **import staging** — `import_rows`, `import_proposed_classes` | **7 days after commit or abandonment** | Stage 16 SECAR-039: the densest personal-data concentration in the system, and useless once committed |
| the uploaded import source object | **deleted on successful commit** | it has been superseded by staged rows |
| **idempotency records** | **48 hours** | comfortably longer than any client retry |
| **completed job execution metadata** | **30 days** | enough to investigate last month's failure |
| **failed job records** | **90 days** | they are the ones someone looks at |
| provider retry metadata on `delivery_attempts` | **inherits the notification's clock** | it is a child fact |
| **orphan uploads** | **swept daily past the 30-minute pending window** | §23 |
| technical application logs | **30 days** | Stage 16 SECAR-034 — logs are a personal-data store |
| performance measurements | **90 days**, aggregated | no personal data (§29) |
| cache entries | **the cache class's stale time** (§13) | not retention |

**OPS-D059 · Records where Stage 18 sets NOTHING**

```
child records · guardian relationships · money events · payment applications
financial evidence · custody and hand-over events · school records
audit events · legal and support evidence · quarantined objects

⇒  POLICY INPUT REQUIRED   or   INHERIT APPROVED RETENTION POLICY
```

**Stage 18 does not state that any law requires any number for any of these.** A16-002.2 assigns them
to qualified legal / controller-approved policy, Stage 19 owns audit mechanics subject to it, and
**C-79 — erasure against financial retention — remains open and escalated.**

**OPS-D060 · Retention deletion runs as a durable job (DBT-069), is audited, and is never a manual
script.** Stage 15 SECAR-043. **A retention rule executed by someone remembering is not a rule.**

---

## 29. Observability

**Metrics and alerts. Not audit records — Stage 19 owns those.**

**OPS-D061 · The metric set**

| Metric | Alert when |
|---|---|
| request latency p50 / p95 / p99, by workload class | p95 over §8's budget for 15 min |
| 5xx rate | > 1% over 5 min |
| **connection acquisition wait** | **any wait over 1 s** — this is §10's canary |
| **connection acquisition failures** | **any** — it means the budget was exceeded |
| database query duration p95 | over budget, by query class |
| **transaction duration p95** | **over 250 ms for I-2** (§9) |
| **I-2 conflict rate** — 409 from DBI-014 | a rise; it means concurrent confirmation attempts |
| job queue age — oldest eligible job | > 30 min for `interactive`, > 6 h for `standard` |
| job failure rate; jobs at terminal `failed` | any terminal failure |
| delivery backlog; oldest undelivered notification | > 2 h |
| email hard-bounce rate | > 5% of sends over a day |
| provider suspensions | **any** |
| upload scan backlog; objects pending past the window | any past 15 min |
| import duration and error rate | duration over the job budget |
| reconciliation duration and candidate-set size | **candidate set above its cap** — the OPS-F03 canary |
| public-site error rate and cache hit rate | errors > 0.5%; hit rate below expectation |

**OPS-D062 · No personal data in a metric label, ever**

```
FORBIDDEN as a metric dimension:   school NAME · child id · email · payment reference
                                   person name · file name · any free text
PERMITTED:                          workload class · job kind · provider · outcome class
                                    HTTP status · an OPAQUE school id, only where a
                                      per-tenant view is genuinely needed, and aggregated
                                      everywhere else
```

**Cardinality is a cost and an exposure at the same time.** A metric labelled by school name both
explodes the series count and puts a customer list in a monitoring vendor. **Aggregate by default;
label by opaque id only where a per-tenant answer is the point.**

**OPS-D063 · Sentry (PRV-007) is not enabled until scrubbing is proven** — Stage 17 INT-D035,
INTAR-026. **This is an operational precondition, not a formality.**

---

## 30. Capacity triggers

**OPS-D064 · Explicit thresholds separating "do nothing yet" from "revisit the architecture"**

| Signal | DO NOTHING YET | REVISIT | **Try FIRST, in this order** |
|---|---|---|---|
| **connection saturation** | occasional waits under 1 s | **any acquisition failure**, or sustained waits | **read composition (§10.4) → pool `max` → statement timeouts → connection budget per request.** Only then: a pooler |
| **query p95 over budget** | one path, once | the same path for 7 days after indexing | **query correction → index (with an A15-nnn amendment) → pagination → batching** |
| **job backlog age** | minutes | `interactive` over 30 min repeatedly | **claim batch size → invocation frequency (Stage 21) → per-school fairness caps.** Only then: a queue product |
| **large-import timeouts** | rare, above the row ceiling | routine at ordinary sizes | **chunk size → async threshold → streaming parse** |
| **public-site cache miss rate** | normal after publication | sustained high miss with low publication rate | **cache key correctness → TTL → prerender (option A, §25)** |
| **provider callback volume** | any | sustained above the ack budget | **defer processing behind the ack** — which the design already does |
| **database storage / history growth** | linear with tenants | growth that outpaces tenant count | **retention (§28) → partitioning of event tables → archival** |
| **reporting cost** | within §8 | routinely async and still slow | **query correction → materialised projection.** Only then: a warehouse |

**OPS-D065 · The escalation order is itself the policy**

```
query correction  →  index  →  pagination  →  batching  →  read composition
                  →  connection tuning  →  job batching
                                  ↓  ONLY THEN, and only with measurement
                     Redis · a queue product · a search cluster · a new service
```

**This ordering is the main protection this document provides against premature architecture growth.**
Every item on the left is cheap, reversible and local. Every item on the right is a new operational
surface, a new failure mode, a new sub-processor and a permanent cost. **OPS-P13 exists so that adding
one is a decision with evidence rather than a reflex under pressure.**

---

## 31. No realtime by default

**Stage 11 locked no realtime infrastructure. Stage 18 does not introduce any.**

**OPS-D066 · Active-workflow freshness is achieved by invalidation and bounded polling**

| Surface | Mechanism |
|---|---|
| teacher handover board, while in use | **invalidate on own mutation + poll at 30 s while the tab is focused and active** |
| finance settlement list, while in use | **same** |
| everything else | the cache classes of §13 |
| optimistic presentation | **permitted only where the server's refusal is harmless and visible** — never for settlement or hand-over, where a reversal would show a family the wrong outcome |

**Bounded polling on two screens, only while focused and active, is a handful of requests per minute
per active user.** Against the §7 envelope that is negligible, and it needs no WebSocket, no
subscription infrastructure and no second connection per user — **which would be a new connection
pressure on top of §10's, for a product where two people rarely edit the same board at once.**

**OPS-D067 · If a future stage believes realtime is required, it must prove the workflow cannot meet
its target with invalidation or bounded polling**, and amend Stage 11 traceably. **Visual novelty is
not a reason.**
---

## 32. Current → target operations map

| # | Current (E2) | Target | Decision |
|---|---|---|---|
| 1 | `getPool()` — no `max`, no timeouts | explicit `max`, acquisition timeout, statement and transaction timeouts | **OPS-D005** · C-99 |
| 2 | every scoped read takes a pooled connection, unaccounted | a **connection budget of one per request**, composed reads | OPS-D005 · OPS-D006 |
| 3 | `staleTime: Infinity` globally | **seven cache classes**, finance and stock always revalidated | **OPS-D011** · C-98 |
| 4 | reconciliation reads the tenant's whole history | tenant → reference → window → cap | **OPS-D023** · OPS-F03 |
| 5 | serial `await verifyOrder` per order | batch-load, match in memory, chunked writes | OPS-D024 · OPS-F04 |
| 6 | one health endpoint | **live / ready / dependencies** with distinct meanings | OPS-D053 · OPS-F05 |
| 7 | daily drain, no continuation, `ok: true` | enqueue ≠ drain; remainder immediately eligible; honest response | **OPS-D033** · C-96 |
| 8 | no job table in use | **DBT-069** with `FOR UPDATE SKIP LOCKED`, leases, backoff, fairness | OPS-D027 · OPS-D031 |
| 9 | no suppression concept | **DBT-078** (A15-002), never touching `email_verified_at` | OPS-D039 |
| 10 | no operational retention | engineering windows only; legal ones deferred | OPS-D058 · OPS-D059 |
| 11 | no metrics | the §29 set, no personal data in labels | OPS-D061 · OPS-D062 |
| 12 | no capacity policy | thresholds plus a fixed escalation order | **OPS-D064** · OPS-D065 |
| 13 | public site read as unscoped / HTTP driver | **RLS-scoped publication read on a pooled connection** | **OPS-D074** · §10.6 |
| 14 | unscanned-upload viewing unresolved | **viewable by nobody**, including the school's own staff | **OPS-D072** · OPSQ-1 = A |
| 15 | job claim described as exactly-once | **exclusive claim; at-least-once execution; handlers declare protection** | **OPS-D068** |
| 16 | expired leases "return to eligible" by implication | **an explicit reclaim statement** | **OPS-D069** |
| 17 | fairness as "one ORDER BY" | **a `ROW_NUMBER()` partition with a per-tenant cap** | **OPS-D031** |
| 18 | platform providers described as suspendable integrations | **degraded condition + alert; no DBT-040 row, no new table** | **OPS-D070** |

---

## 33. Findings — OPS-F01 … OPS-F08

All recorded at §3, all **E2 — static evidence, not measured performance**.

| OPS-F | Finding | Evidence | Becomes |
|---|---|---|---|
| **OPS-F01** | the main pool is unbounded and has no acquisition timeout | `config/database.ts` `getPool()` | **C-99** |
| **OPS-F02** | `staleTime: Infinity` is the global client default | `lib/queryClient.ts` | **C-98** |
| **OPS-F03** | reconciliation reads the tenant's entire payment history, filters in JS | `provider-payment-repository.ts` | OPS-D023 · OPS-R09 |
| **OPS-F04** | verification is a serial `await` loop, one order at a time | `payment-verification-service.ts` | OPS-D024 |
| **OPS-F05** | the three-endpoint health surface does not exist | `server/routes/*.ts` | OPS-D053 |
| **OPS-F06** | the daily drain has no continuation | `cron.routes.ts` | **C-96** — Stage 17 |
| **OPS-F07** | 37 loop-shaped access sites in `storage.ts` — **candidates, not defects** | `storage.ts` | Stage 20 measures |
| **OPS-F08** | no indexes exist yet for Stage 15's IX rules | no migration has run | not a defect — the state before MIG-03 |

**OPS-F07 is stated as a count of candidates on purpose.** Calling all 37 defects without reading each
one would be exactly the inference this stage's evidence rule forbids. **Two were read and are
defects; the rest are unexamined.**

---

## 34. Decisions — OPS-D001 … OPS-D074

| OPS-D | Decision | § |
|---|---|---|
| OPS-D001 … OPS-D002 | the envelope is per school; **September is a WRITE peak, so connections bind** | 7 |
| OPS-D003 … OPS-D004 | **I-2 stays one transaction; the objective is the TRANSACTION's duration, ≤ 250 ms p95** | 9 |
| **OPS-D005 … OPS-D006** | **a connection budget of ONE per request; read composition over read multiplication** | 10 |
| OPS-D007 … OPS-D008 | hot paths get current/target shapes; **a new index needs an A15-nnn amendment** | 11 |
| OPS-D009 … OPS-D010 | page 50 / max 200, clamped and said so; **no default total counts** | 12 |
| **OPS-D011 … OPS-D014** | **`staleTime: Infinity` withdrawn; seven cache classes; the cache never authorises; no Redis** | 13 |
| **OPS-D015 … OPS-D016** | **NO SERVER CACHE IN V1**, with stated reconsideration thresholds | 14 |
| OPS-D017 … OPS-D018 | sync/async by measured cost; **no warehouse in V1** | 15 |
| OPS-D019 … OPS-D022 | preview never writes truth; 500-row sync ceiling; 100-row chunks; **a logical row is never split** | 16 |
| OPS-D023 … OPS-D026 | tenant → reference → window → cap; batched enrichment; **ambiguity goes to a person** | 17 |
| **OPS-D027 … OPS-D030** | **`FOR UPDATE SKIP LOCKED` claim; leases not heartbeats; 5 attempts with jittered backoff; no in-memory ownership** | 18 |
| OPS-D031 … OPS-D032 | per-school round-robin with a bounded claim; **three priority classes and nothing cleverer** | 19 |
| **OPS-D033 … OPS-D035** | **enqueue ≠ drain; a 10 s safety margin; the application encodes no schedule** | 20 |
| OPS-D036 … OPS-D040 | delivery retry; **a retry never creates a second notification**; suppression never touches verification | 21 |
| OPS-D041 … OPS-D043 | per-provider budgets; doubling cooldown with a ceiling; **the breach check never suspends** | 22 |
| OPS-D044 … OPS-D046 | 30-min pending, 15-min scan window; **a missing verdict is an ERROR**; quarantine is retained | 23 |
| OPS-D047 … OPS-D049 | publish ≤ 200 ms inside the transaction; invalidation after commit; **never half of two revisions** | 24 |
| **OPS-D050 … OPS-D052** | **render-on-request with the revision id IN the cache key**; public reads never reach operational data; no SSR migration | 25 |
| OPS-D053 … OPS-D055 | readiness is about **authority**, not completeness; no dependency detail is public | 26 |
| OPS-D056 … OPS-D057 | the degradation matrix; **queued, blocked and held are said in plain words** | 27 |
| OPS-D058 … OPS-D060 | operational windows only; **POLICY INPUT REQUIRED** for the rest; deletion is a job | 28 |
| OPS-D061 … OPS-D063 | the metric set; **no personal data in a label**; Sentry not enabled before scrubbing | 29 |
| **OPS-D064 … OPS-D065** | **capacity triggers, and the escalation order is itself the policy** | 30 |
| OPS-D066 … OPS-D067 | invalidation and bounded polling; realtime needs proof and an amendment | 31 |
| **OPS-D068** | **every job handler declares duplicate-consequence protection — claiming is exclusive, execution is at-least-once** | 18 |
| **OPS-D069** | **an explicit reclaim statement returns expired running jobs to eligible** | 18 |
| **OPS-D070** | **no hidden infrastructure state table — a platform provider has no DBT-040 row** | 22 |
| **OPS-D071** | **persisting a provider event and interpreting it are separate; the job may never enter I-2** | 22 |
| **OPS-D072** | **OPSQ-1 = A — an unscanned object is viewable by nobody, including the school's own staff** | 23 |
| **OPS-D073** | **the public cache key carries publication identity; correctness never depends on a purge** | 25 |
| **OPS-D074** | **PUBLIC is not UNSCOPED — a published read is RLS-scoped on a pooled connection** | 10.6 |

---

## 35. Risks — OPS-R01 … OPS-R20

| OPS-R | Risk | Severity | Mitigation |
|---|---|---|---|
| **OPS-R01** | **Connection exhaustion after A13-001** — every scoped read now takes a pooled connection, from an unbounded pool | **CRITICAL** | OPS-D005 · OPS-D006 · **C-99** |
| **OPS-R02** | **September spike** — import, settlement and distribution concurrently, all write-heavy | **HIGH** | OPS-D002 · the whole of §10 · §30's triggers |
| **OPS-R03** | Job starvation — one large school fills every claim batch | **HIGH** | OPS-D031 |
| **OPS-R04** | A poison job retries forever | **MEDIUM** | OPS-D070 — 5 attempts, then terminal and visible |
| **OPS-R05** | Email backlog after a provider outage | **MEDIUM** | OPS-D036 · notification truth is unaffected |
| **OPS-R06** | Provider outage misread as a business failure | **MEDIUM** | OPS-D038 · §27's matrix |
| **OPS-R07** | Scanner backlog holds uploads indefinitely | **MEDIUM** | OPS-D044's 15-minute window → `ERROR`, not pending forever |
| **OPS-R08** | Large-import memory pressure in a 30 s function | **HIGH** | OPS-D020 — streamed parse, row ceiling, chunked commit |
| **OPS-R09** | **N+1 and whole-history scans grow silently with tenant age** | **HIGH** | OPS-D023 · OPS-D024 · the candidate-set-size metric is the canary |
| **OPS-R10** | Count queries become the expensive part of cheap pages | **MEDIUM** | OPS-D010 |
| **OPS-R11** | **Cache staleness shows a family the wrong payment position** | **HIGH** | OPS-D011's classes — finance and stock always revalidate |
| **OPS-R12** | Public-site render stampede after publication | **MEDIUM** | the revision id is in the cache key; a single publication invalidates once |
| **OPS-R13** | History tables grow without bound — custody, money, delivery attempts | **MEDIUM** | append-only by design; **§28 defers the legal windows**; partitioning is a §30 trigger |
| **OPS-R14** | Tenant fairness degrades as school sizes diverge | **MEDIUM** | OPS-D031 · per-tenant concurrency cap |
| **OPS-R15** | Serverless time limits truncate long work | **HIGH** | OPS-D034's safety margin · durable jobs · continuation |
| **OPS-R16** | Observability cardinality explodes, or leaks a customer list | **MEDIUM** | **OPS-D062** — aggregate by default, opaque ids only where needed |
| **OPS-R17** | **Public-site cache misses now consume pooled connections** — the draft assumed they did not | **HIGH** | §10.6 · **OPS-D073** — the cache is a connection control; misses are in the budget |
| **OPS-R18** | A job's side effect repeats after a crash — claiming is exclusive, execution is at-least-once | **HIGH** | **OPS-D068** — every handler declares duplicate protection |
| **OPS-R19** | Expired running jobs are never reclaimed and stay stuck | **HIGH** | **OPS-D069** — an explicit reclaim statement in the claim transaction |
| **OPS-R20** | A scanner outage blocks a school's own workflow during enrolment week | **MEDIUM — ACCEPTED** | **OPSQ-1 = A**, OPS-D072. The availability cost is taken deliberately |

---

## 36. Existing conflicts addressed

**None is closed.**

| Conflict | Stage 18's contribution |
|---|---|
| **C-32** · a failed read renders as empty | OPS-D057 — never an empty list where a read failed |
| **C-46** · sending is the notification | OPS-D037 · OPS-D040 — truth and delivery fully separated operationally |
| **C-63** · processing region | §10 assumes UK/EU compute-to-database proximity; **Stage 17 INT-D036 showed a Neon region change means a project migration** |
| **C-71** · two persistence semantics | OPS-D005's §10.5 — **no memory fallback in any degraded path** |
| **C-74** · read and transactional handles | §10.6 — the driver split is now an operational budget, not only a type distinction |
| **C-96** · partial drain never resumed | **OPS-D033 · OPS-D034 · OPS-D035** — this is C-96's operational target |
| **C-79** · erasure vs financial retention | **§28 does not touch it** — POLICY INPUT REQUIRED |
| **C-60** · no test framework | every budget here is labelled a starting target **for Stage 20 to validate** |

---

## 37. Conflicts carried unchanged

**C-18 · C-19 · C-21 · C-29 · C-41 · C-42 · C-52 · C-53 · C-56 · C-58 · C-61 · C-64 … C-73 · C-78 ·
C-80 … C-97** remain **OPEN and unchanged.** Stage 18 neither resolves nor amends them.

**C-21 remains TARGET POLICY RESOLVED · IMPLEMENTATION OPEN.**
**INTQ-3 remains open and is not a Stage 18 question.**

---

## 38. New conflicts

**Verified against the full register: the last issued identifier is C-97 (Stage 17). The next is C-98.**

**C-98 · Operational truth is cached indefinitely in the client — ACTIVE**

*Evidence:* `client/src/lib/queryClient.ts` — `staleTime: Infinity` as a global default, with
`refetchOnWindowFocus: false` and `refetchInterval: false`.

*Locked requirement contradicted:* **BR-125** — a failed or unrefreshed read must not render as a
settled fact — and Stage 12 **SA-P3**, which separates continuity from current truth. A settlement
confirmed by finance, a stock level changed by a hand-over, or an authority revoked by an administrator
**never refreshes in an open tab.** In a product where colleagues act on the same records within
minutes, an indefinitely stale finance screen is presented to the user as current.

*Not a security defect:* the server resolves authority per request (SEC-D013), so a stale cache cannot
over-privilege anyone. **It misinforms; it does not authorise.** Both halves are stated so the severity
is not overstated.

*Resolution:* **OPS-D011** — seven cache classes, finance and stock always revalidated,
**OPS-D013**'s mandatory invalidation triggers. **Not closed here.**

**C-99 · The main database pool is unbounded, and A13-001 routed every scoped read through it — ACTIVE**

*Evidence:* `server/config/database.ts` — `getPool()` constructs `new Pool({ connectionString, ssl })`
with **no `max`, no `idleTimeoutMillis` and no `connectionTimeoutMillis`.** `server/config/consoleDb.ts`
sets all three on both console pools.

*Locked requirement contradicted:* **A13-001** (recorded against Stage 13) requires every RLS-scoped
read to run inside a transaction on a pooled connection. **That amendment moved the pool from serving
writes to serving essentially every authenticated request, and no bound was added.** On serverless,
demand is *concurrent instances × node-postgres' default of 10* — a limit nobody chose — and with no
acquisition timeout **a request that cannot get a connection waits indefinitely** rather than failing
honestly, which contradicts Stage 14's error contract and **OPS-P10**.

*Sharpened by Stage 17:* **INT-D036** established that a Neon project's region cannot be changed, so
capacity and region are both provisioning-time decisions with migration behind them.

*Resolution:* **OPS-D005**'s seven budget rules and **OPS-D006**'s read composition. Stage 21 sets the
values. **Not closed here.**

**Nothing else is raised.** The unbounded reconciliation read (OPS-F03), the serial loop (OPS-F04) and
the missing health endpoints (OPS-F05) are **findings and risks, not conflicts** — they are
optimisation opportunities and unbuilt targets, and §56 of the owner's instruction is explicit that
those belong in OPS-F and OPS-R.

---

## 39. Owner decisions required

**OPSQ-1 · Does a school's own upload of pupil-identifying media stay available while the scanner is
degraded?**

**Why this is a genuine owner question and not an engineering one.** §27's matrix says an upload is
**accepted and held** before `verified` when the scanner is down. That is the safe default and Stage 16
requires it for anything reaching `published`. **The question is what a school sees during a scanner
outage in the middle of September**, and the two answers create a materially different customer
promise.

| | **A — hold everything until scanned (recommended)** | **B — allow the school's own staff to view their own unscanned upload, publication still blocked** |
|---|---|---|
| security posture | strictest — **no unscanned bytes are ever served** | unscanned bytes are served to authenticated staff of the owning school only |
| what a school sees in an outage | "Uploaded. Available once checked." — and they cannot proceed | they can continue their own work; the public site is still protected |
| September consequence | an outage during enrolment week blocks a workflow | the workflow continues |
| **what it blocks** | nothing else — it is the current design | it blocks nothing technically; it changes what Stage 16's `verified` gate means for internal viewing |

**Recommendation: A.** Stage 16's gate exists because malware reaching a school's own staff is the
threat, not only malware reaching the public. **B narrows the gate to publication only**, which is a
weaker promise than the one already locked — and weakening a security promise for availability is the
owner's call, not this document's.

**This is the only owner question Stage 18 raises.** Pool sizes, retry delays, job leases, batch sizes,
page sizes, latency targets and cache TTLs are **engineering decisions and are made above**, per the
owner's §55.

---

## 40. Handoffs

```
STAGE 19   audit records for: job terminal failure · provider suspension · retention deletion
           · suppression release · manual job retry
           AUDIT RETENTION MECHANICS, subject to approved policy      A16-002.2

STAGE 20   VALIDATE every budget in §8, §9 and §29 — none is measured today
           justify the two reconciliation indexes (§11.1); if confirmed, raise A15-nnn
           read the 35 unexamined loop sites in storage.ts            OPS-F07
           the formal performance-test suite

STAGE 21   pool max · acquisition, statement and transaction timeouts   OPS-D005
           Neon region and plan — INT-D036's migration question is UNANSWERED
           cron cadence and the GET→POST transport question             OPS-D035
           health probe configuration                                   OPS-D053
           Sentry EU org creation — the region is IRREVERSIBLE          INT-D039
           S3 bucket, GuardDuty enablement, scrubbing before Sentry is on

STAGE 22+  implementation; MIG-03 creates DBT-069, DBT-077, DBT-078

LEGAL      every retention number at OPS-D059 · C-79
OWNER      OPSQ-1
```

---

## 41. Success criteria — answered explicitly

| Question | Answer |
|---|---|
| Does I-2 remain synchronous and atomic? | **YES** — OPS-P2, OPS-D003 |
| Can a cache become settlement / stock / custody authority? | **NO** — OPS-P3, OPS-D012, OPS-D015 |
| Is global `staleTime: Infinity` retained for operational truth? | **NO** — OPS-D011, C-98 |
| Is RLS weakened for connection performance? | **NO** — §10.5 |
| Is A13-001 connection pressure explicitly designed? | **YES** — §10, the largest section here |
| Can one request fan out into many independent DB connections without a budget? | **NO** — OPS-D005 B1/B2 |
| Can one school starve every other school's jobs? | **target says NO** — OPS-D031 |
| Can a duplicate scheduler invocation duplicate business consequence? | **NO** — `SKIP LOCKED` + DBI-020 |
| Can a failed email erase notification truth? | **NO** — OPS-D037, OPS-D038 |
| Can an email retry create a second notification? | **NO** — OPS-D037 |
| Does a hard bounce erase identity verification? | **NO** — OPS-D039, A15-002 |
| Can a scanner timeout mean clean? | **NO** — OPS-D045 |
| Can a provider outage roll back a committed business fact? | **NO** — OPS-D038 |
| Can a provider callback enter I-2? | **NO** — SECAR-031, INT-D009 |
| Are reconciliation scans bounded? | **target says YES** — OPS-D023 |
| Are imports bounded and chunked? | **YES** — OPS-D020 |
| Can preview write product truth? | **NO** — OPS-D019 |
| Are growing lists cursor-paginated? | **YES** — Stage 14, DBD-039 |
| Are operational page limits bounded? | **YES** — OPS-D009 |
| Does public website caching expose drafts? | **NO** — the revision id is in the cache key, OPS-D050 |
| Can a stale support / authority cache grant permission? | **NO** — OPS-D012 |
| Was Redis introduced? | **NO** — OPS-D015 |
| Was a new queue service introduced? | **NO** — OPS-D027 |
| Was a search cluster introduced? | **NO** |
| Was realtime infrastructure introduced? | **NO** — OPS-D066 |
| Were legal retention periods invented? | **NO** — OPS-D059, A16-002.2 |
| Was audit schema designed? | **NO** — Stage 19 |
| Was test strategy designed? | **NO** — Stage 20 |
| Was deployment configured? | **NO** — Stage 21 |
| Was code changed? | **NO** — §1.2 |

---

## 42. What Stage 18 deliberately does not decide

```
the final audit schema and its mechanics                          STAGE 19
the formal test and performance-test strategy                     STAGE 20
Neon and Vercel production configuration · pool VALUES · region   STAGE 21
the deployment pipeline · probe configuration · cron cadence      STAGE 21
migration order                                                   STAGE 22
legal and statutory retention · lawful basis                      LEGAL / APPROVED POLICY
controller and processor determinations                           LEGAL
the V1 payment provider                                           DEFERRED — Stage 17 PRV-011
the object-storage provider · the scanner                         DECIDED — Stage 17 PRV-004/005
security algorithms                                               STAGE 16
API routes and shapes                                             STAGE 14
database conceptual truth                                         STAGES 6 and 15
whether TQ-1 extends to email                                     INTQ-3 — OWNER
```

**Stage 18 is a locked design. Nothing in it has been implemented, measured, provisioned or
deployed.**

**Once locked, later stages may measure, configure and implement. They may NOT silently change:**
I-2's synchronous atomicity · RLS for performance · malware fail-closed behaviour · **no unscanned
internal viewing** · no general server cache in V1 · the public-only publication cache · PostgreSQL
durable jobs · bounded database connections · fair job execution · at-least-once-aware idempotent
handlers · bounded retries · visible degradation · **no Redis, queue or realtime without a measured
amendment** · the operational-versus-legal retention boundary. Every budget is an engineering starting target for **Stage 20** to validate, every value
Stage 21 will configure is named as theirs, and **the baseline remains UNVERIFIED, capped at E2.**

**The BytHub Legal & Compliance deployment halt and production go-live block of 23 August 2026 —
17 Critical, 52 High, across 14 domains, 0% clearance — stands in full.**

```
STAGE 18 — DELIVERY, SCALE & OPERATIONAL BEHAVIOUR
STATUS: LOCKED — 31 August 2026
OPSQ-1 = A · Open owner questions: 0
New conflicts C-98 · C-99 — both IMPLEMENTATION OPEN · Conflicts closed: 0
Stage 19 is authorised. The go-live block of 23 August 2026 stands.
```
