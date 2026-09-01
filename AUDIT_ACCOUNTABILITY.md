# AUDIT_ACCOUNTABILITY.md
# Stage 19: Audit, Accountability & Evidence

```
STAGE 19 — AUDIT, ACCOUNTABILITY & EVIDENCE
STATUS: LOCKED — 31 August 2026
Written: 31 August 2026 · corrected and locked the same day

AS LOCKED, 31 August 2026
   Open owner questions: 1  ── LEGACY SNAPSHOT DISPOSITION (§7.3), blocking MIG-14 only

CURRENT, AFTER POST-LOCK AMENDMENT A19-001 (§42)
   Open owner questions: 0
   Legacy snapshot interim disposition: 1A — QUARANTINE / PRESERVE PENDING POLICY
   Legacy snapshot FINAL disposition:   POLICY INPUT REQUIRED  ── this is a legal /
                                        approved-policy input, NOT an owner question

New conflicts: C-100 · C-101 · C-102 · C-103
Amendments raised: A15-003 (DATABASE_SCHEMA.md)
                   A7-001 REQUIRED (PERMISSIONS.md) — ONE narrow capability, §27
Amendments received: A19-001 (owner, 31 August 2026) — §42
```

**Governed by** Stages 1–18, **all LOCKED**, including their amendment registers: A11-001, A13-001,
A15-001, A15-002, A16-001, A16-002, A17-001.

---

## 1. Purpose and boundary

Stage 19 answers:

> **What durable evidence does ScholarShelf keep about consequential actions — who performed them,
> under which context and authority, against what subject, with what outcome — while keeping audit
> separate from technical logs, and without turning audit into another copy of personal and business
> data?**

It owns the **final audit mechanics that Stages 12, 15 and 16 deliberately deferred**, and it implements
none of them.

### 1.1 What Stage 19 decides — and does not

| Decides | Does not decide |
|---|---|
| the canonical audit event and its physical schema | the test strategy — **Stage 20** |
| the event taxonomy (**AET-\***) | deployment and probe configuration — **Stage 21** |
| actor, context, authority, subject and tenant models | migration order — **Stage 22** |
| transaction coupling classes | **statutory retention periods** — approved policy / legal |
| immutability mechanism | lawful basis · controller/processor determination |
| audit read access, search and export | which events *may legally* be erased |
| privacy, redaction and the erasure tension | domain history — that is Stages 6 and 15's |
| retention *capability* | security algorithms · API routes |

**A16-002.2 governs retention and this stage obeys it.** Stage 19 decides **what audit can technically
do** about retention and erasure. **It does not state how long any audit record must be kept.** Where a
period is legally significant this document records **POLICY INPUT REQUIRED** and stops.

### 1.2 Nothing was executed

**No code was written or modified, no audit table created, no migration run, no index created, no
capability granted, no export produced, no production data touched, nothing deployed.** Every file at
§2 was **opened and read.**

### 1.3 The release boundary is unchanged

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2**.

---

## 2. Evidence inspected

```
shared/schema.ts            audit_logs (8 columns) · message_audit_logs (7 columns)
server/console/audit.ts     the console audit trail, in full — tiers, snapshots, the 64 KB cap
server/middleware/auth.ts   auditLog() — the general write path and its failure handling
server/routes/*.ts          where auditLog() is and is not called
PERMISSIONS.md              CAP-001 … CAP-095, searched for an audit-view capability
                            §20's headline count, checked against the per-capability register
ROLE_EXPERIENCE.md          UX-099 (platform audit trail, CAP-085, KEEP) · UX-095 · UX-096
                            MOD-013's recorded surface: "COMPOSED + INTERNAL … no audit
                            settings screen" — the evidence that bounds A7-001
DATA_MODEL.md               DM-053 · DM-054 · DM-055
SYSTEM_ARCHITECTURE.md      AD-026 · AD-027
DATABASE_SCHEMA.md          its §30 deferral · its §42 map · the A15 amendment register
                            DBT-002 school_lifecycle_events — APPEND-ONLY, deletion_requested
                            and purged, which is what settles purge eligibility (§20)
SECURITY_AUTH_PRIVACY.md    SEC-D066 · SEC-D067 · §31's prohibited-log list
DELIVERY_SCALE_OPERATIONS.md  §9.1's required audit fact · §29's metrics
```

---

## 3. Current audit baseline

**All findings E2 — read directly, not executed.**

**AX-1 · Three audit stores, three shapes, no common identity**

```
audit_logs                  8 columns   NO school_id · NO FK on user_id · metadata is TEXT
   written by auditLog()    catch { console.error("Audit log failed:", e) }   ← swallowed

message_audit_logs          7 columns   school_id NOT NULL + index + FK on actor_user_id
   the NARROWEST store is the BEST-SHAPED one

console_audit               written by server/console/audit.ts through the APPLICATION pool
   tier · action · school_id · statement · params
   beforeSnapshot · afterSnapshot   ── capped at 64 KB EACH
   rowCount · durationMs · reason · elevationId
```

**AUD-F01 · `audit_logs` has no tenant column.**
`userId · action · target · metadata · ipAddress · userAgent · createdAt`, and **no `school_id`.**
A school's audit cannot be scoped to that school, so **tenant-separated audit reading is not possible
today.** This is **C-65**'s audit instance — one of the twelve untenanted tables — and **no new
identifier is issued for it.**

**AUD-F02 · `audit_logs.userId` carries no foreign key.** It is a bare `varchar(36)`. Nothing binds the
actor to a person row, so an actor identifier can point at nothing and no constraint notices.

**AUD-F03 · `audit_logs.metadata` is `text`, not `jsonb`.** Whatever is written is a string. **It cannot
be filtered, indexed or safely allowlisted**, and §41's bounded search cannot be built over it.

**AUD-F04 · The general audit write is best-effort for acts AD-026 classifies as consequential.**
`auditLog()` ends `catch (e) { console.error("Audit log failed:", e) }`. AD-026 states that
*"consequential acts require their audit to share the business outcome's fate."* **They do not.**
Settlement confirmation, authority grants and school lifecycle changes all audit through this path.
→ **C-102**.

**AUD-F05 · The console audit persists before/after row snapshots.**
`beforeSnapshot` and `afterSnapshot`, each capped at **64 KB**, are JSON of whatever the operation
touched — **which for a typed support operation is rows about children, guardians and payments.** The
cap bounds the size; **nothing bounds the content.** → **C-101**.

**AUD-F06 · The three stores share no event identity, no taxonomy and no correlation.**
`audit_logs.action` and `console_audit.action` are independent free-text strings.
`message_audit_logs.action` is a third. **There is no way to ask "everything that happened to this
child" or "everything this support person did", because there is no common subject, actor or
correlation field.** → **C-100**.

**AUD-F07 · Some consequential acts audit and some do not.** `auditLog()` is called on the
authentication paths and by the console; it is **not** called on several acts Stage 7's register marks
`AUDIT`. **The precise per-capability gap in the CODE is not enumerated here** — that needs a call-site
sweep this stage did not perform, and asserting a count without it would be the inference this method
forbids. **Recorded as a gap with a named method: Stage 20 tests it and Stage 22 enumerates it against
§8's taxonomy.**

**The gap in the TAXONOMY, by contrast, was enumerable and has been enumerated.** Stage 7's register
marks **67** capabilities `AUDIT` — not the 58 its own §20 headline states, which is **C-103**. §8.9
closes every one of the 67 with an event.

### 3.1 What is already right, and is kept

| | |
|---|---|
| **`message_audit_logs`' shape** | `school_id NOT NULL`, indexed, with a real FK on the actor. **This is the shape the canonical event should have had all along** |
| **the console audit exists at all** | its own header states the reasoning: *"the one surface that reaches every tenant's children was also the one surface with no record"* — correct, and the remedy was right |
| **it writes through the application pool** | deliberately, because `console_ro` cannot write and `console_rw` lives only during an elevation. **A correct and non-obvious decision** |
| **the 64 KB snapshot cap** | *"so one `SELECT *` on a big table can't bloat the trail"* — right instinct, wrong control (§26) |
| **elevation is recorded with a reason** | `reason` and `elevationId` are captured on break-glass |

**The console audit is the most thoughtful audit code in the tree.** Its defect is what it stores, not
that it stores.

---

## 4. Audit principles — AUD-P1 … AUD-P22

**AUD-P1 — An audit event is a product fact. A log is disposable telemetry.** AD-026, restated as this
stage's first principle.

**AUD-P2 — One consequential act produces one canonical audit event.** Not three, in three stores, with
three shapes.

**AUD-P3 — Where audit is required, its failure fails the act.** For the class that requires it (§12).

**AUD-P4 — Audit never contains a credential or a secret.** No exception, no configuration, no
"temporarily for debugging".

**AUD-P5 — Audit records who acted, not merely which role existed.** A person, by identifier.

**AUD-P6 — Audit records the actual active context.** Which hat was on, as a stored fact.

**AUD-P7 — Audit records the authority exercised, separately from the context.** **PA-1**: an
administrator may hold AUTH-FINANCE without switching context, so the two no longer answer each other.

**AUD-P8 — Audit records authoritative subject identifiers**, resolved server-side.

**AUD-P9 — Audit never trusts an actor, school or subject identifier supplied by the client.** Stage 16
SEC-D016: the resource is resolved, never claimed.

**AUD-P10 — Audit history is append-only in meaning.** A correction is another event.

**AUD-P11 — An audit event is never silently updated.** Ordinary application code cannot `UPDATE` one.

**AUD-P12 — Audit is tenant-scoped where the act is tenant-scoped**, structurally, not by convention.

**AUD-P13 — Platform, support and break-glass events retain their explicit context**, and are never
represented as a school's own act.

**AUD-P14 — Audit read access is narrower than operational access.** Being able to do a thing does not
imply being able to read who else did it.

**AUD-P15 — Exporting audit is itself an audit event.**

**AUD-P16 — Audit search is bounded, filtered and paginated.** Never arbitrary SQL, never full-text
over free metadata.

**AUD-P17 — Technical error detail does not belong in audit.** It belongs in a log, with a correlation
id linking the two.

**AUD-P18 — A provider's raw payload does not belong in audit.** Stage 17 INT-P8.

**AUD-P19 — Data minimisation applies to audit exactly as it applies everywhere else.** Immutability is
not a licence to store more.

**AUD-P20 — Immutability does not mean ignoring privacy obligations.** The tension is real and is
recorded, not resolved by asserting one side.

**AUD-P21 — Audit retention duration comes from approved policy, never from this document.**

**AUD-P22 — No blockchain, hash ledger or external notarisation is added without a proved threat it
answers.** §25 states exactly what one would and would not solve.

---

## 5. Audit versus log versus metric versus domain history

**The distinction that prevents both under-recording and mass duplication.**

**AX-2 · Four outputs, four owners**

```
DOMAIN HISTORY     stock_movements · custody_events · money_events · handover_events
                   · school_lifecycle_events · provider_events · delivery_attempts
                   ── THE BUSINESS FACT ITSELF, append-only, owned by its module
                   ── Stages 6 and 15 own these. Audit does NOT replace them.

AUDIT EVENT        the HUMAN ACT that caused a consequential change, with actor, context,
                   authority, subject, outcome and reason
                   ── MOD-013. This document owns it.

SECURITY EVENT     an audit event that is ALSO operationally interesting — break-glass,
                   recovery-code use, repeated authentication failure classification
                   ── an audit event PLUS an alert. Not a separate store.

TECHNICAL LOG      request line · error with correlation id · provider timeout · cache miss
/ METRIC           ── Stage 18 §29. Disposable. Never the audit store.
```

**AUD-D001 · Domain history is not replaced by audit, and audit does not duplicate it**

```
a hand-over happens
   custody_events + handover_events   ── the BUSINESS FACT     Stage 15, MOD-008
   ONE audit event                    ── the HUMAN ACT: who recorded it, under which
                                         capability, for which child, with what outcome
```

**The audit event does not copy the custody row.** It references it. **Two records of the same thing in
different shapes is how they come to disagree**, and the domain table is the one that is authoritative.

**AUD-D002 · Sentry is never the audit store.** Stage 17 PRV-007 is a Class B error tracker whose events
are dropped when it is unavailable (INT-C007). **An evidence store that drops evidence under load is not
an evidence store**, and Stage 16's §31 already forbids the personal data an audit event carries from
reaching it.

---

## 6. The canonical audit event

**AUD-D003 · ONE canonical `audit_events` table replaces three independent truths**

```
audit_logs            ──┐      audit_events         MOD-013  the evidence   ONE taxonomy
message_audit_logs    ──┼──►
console_audit         ──┘      console_operations   MOD-012  the operational
                                                             record, linked 1:0..1  (§6.2)
```

**AUD-D004 · The event shape**

| Field | Notes |
|---|---|
| `id` | |
| `occurred_at` · `recorded_at` | **two clocks.** When the act happened; when the record landed. They differ for Class B (§12) |
| **`scope_kind`** | **`school` · `platform` · `identity`** — Stage 15's discriminator pattern (DBD-001), **never a NULL meaning "global"** (§11) |
| `school_id` | **NOT NULL when `scope_kind = 'school'`**; **NULL for `platform` and `identity`**, enforced by CHECK |
| `actor_kind` | `person` · `system` · `integration` (§9) |
| `actor_person_id` | **nullable FK to `persons`** — the authoritative actor key when `actor_kind = 'person'` (§9.1) |
| `actor_pseudonym_ref` | **nullable** opaque pseudonymous reference — §24's mechanism, **never a fake `persons` row** |
| `actor_context_kind` | the **active context** — **nullable**; an authentication event has no active tenant context yet |
| `actor_authority` | **the AUTHORITY EXERCISED — AUD-P7, PA-1** — **nullable**; never invented for a system or integration actor |
| `actor_school_id` | where the actor's membership differs from the subject's school |
| `system_job_id` | required when `actor_kind = 'system'` |
| `integration_ref` | required when `actor_kind = 'integration'` |
| `support_engagement_id` | FK to DBT-067, where one applies |
| `elevation_event_id` | **nullable self-reference to the AET-030 event that granted the elevation** — AUD-D058. There is no elevation table, and none is invented |
| `capability_id` | `CAP-nnn` — **why this was authorised**; **nullable**, and never fabricated for a provider or a job (§9.1) |
| **`action_key`** | `AET-nnn`'s stable key — **never free text** (§8) |
| `subject_type` · `subject_id` · `subject_school_id` | the authoritative subject |
| `subject_identity_state` | `identified` · `pseudonymised` — §24 |
| **`business_act_key`** | **nullable** — the stable business-act identity used for evidence deduplication (§6.3). **NOT `correlation_id`** |
| `reason_policy` | `required` · `optional` · `forbidden` — derived from the AET, and what §7's constraint checks (§6.4) |
| `outcome` | `succeeded` · `refused` · `failed` |
| `reason_code` | bounded vocabulary |
| `reason_text` | **only where the act is discretionary** — Stage 7's requirement 1 |
| `correlation_id` | ties the event to logs and to the request |
| `request_id` | where useful |
| `source` | `web` · `job` · `console` · `integration` |
| `business_reference` | e.g. the requirement item, where one exists |
| **`safe_metadata jsonb`** | **strongly bounded and allowlisted per AET** (§26) |

**AUD-D005 · The prohibited-content list is absolute**

```
NEVER IN AUDIT
  password · password hash · MFA secret · TOTP code · recovery code
  session cookie or identifier · reset token · invite raw token · signed URL
  provider credential · raw webhook payload · a whole request body
  a whole child record · a whole payment record · a whole message body
```

**Stage 16 SEC-D063's prohibited-log list applies to audit unchanged**, plus the four whole-record
prohibitions above, which are specific to the temptation audit creates. **BR-124 and C-18 are the
locked source of the first line.**

### 6.2 Console operations — a separate MOD-012 record, linked to the event

**DM-054 says something that decides this: *"Purge eligibility is read from this record — it is
load-bearing, not just a log."***

**AUD-D006 · The console operation record stays MOD-012's. The audit event stays MOD-013's. They are
linked, not merged.**

**A correction to this document's own draft, which placed `console_operation_details` under MOD-013.**
That would have transferred **DM-054** out of the module locked Stage 8 gives it, silently.

```
LOCKED Stage 8      MOD-012 Platform Operations  OWNS  support engagement · CONSOLE OPERATION RECORD
                                                        · platform state · tenant lifecycle actions
                    MOD-013 Audit & Attribution  OWNS  the audit event

TARGET              DBT-079  audit_events         MOD-013   WHO did it, context, authority,
                                                            capability, subject, outcome
                    DBT-080  console_operations   MOD-012   WHAT privileged platform operation
                                                            happened: typed operation, tier,
                                                            target, elevation, lifecycle facts
                    console_operations.audit_event_id  →  FK to audit_events.id, UNIQUE
```

**They answer different questions, which is why neither absorbs the other.** *What operation ran, on
what, at which tier* is an **operational** fact MOD-012 needs in order to run the platform. *Who ran
it, under which authority, and was it authorised* is **evidence** MOD-013 holds. **DBT-080 is not a
second audit store** — it holds no actor, no authority and no capability; those live once, on the
linked audit event.

**No Stage 8 amendment is required, because ownership is restored rather than changed.**

**What is dropped from the current console record:** `statement`, `params`, `beforeSnapshot`,
`afterSnapshot`. §26 explains what replaces them, and §7.1 explains what happens to the existing ones.

### 6.3 Four identifiers, four meanings — none of them interchangeable

**A correction to this document's draft, which described `correlation_id` as enforcing "one canonical
event per consequential act." It does not, and cannot.**

```
correlation_id     ONE REQUEST — observability and trace linkage.
                   A RETRY IS A NEW REQUEST WITH A NEW CORRELATION ID
                   while representing THE SAME business act.
                   Also nullable — and PostgreSQL treats NULLs as distinct,
                   so a unique index over it enforces nothing on the rows that
                   matter most.

request_id         request identity, where the transport needs one

business_act_key   THE STABLE SERVER-GENERATED IDENTITY OF THE ACT ITSELF,
                   owned by the business command, not by audit
                   e.g. the settlement review's own identifier · the publication
                   act · the authority-grant mutation's identity

idempotency_key    command retry semantics at the transport edge   Stage 15 DBD-031
```

**AUD-D056 · Audit deduplication prevents duplicate EVIDENCE. It never decides whether a business act
may happen twice.**

```
BUSINESS IDEMPOTENCY   stays in the owning module
                       settlement  ── DBI-014's partial unique already does it
                       CMS publish ── the revision pointer
                       authority   ── the grant mutation's own identity

AUDIT DEDUPLICATION    DBI-034, over business_act_key where one exists
                       so a re-emitted event does not create a second piece of
                       evidence for one act
```

**Making audit the mechanism that decides whether money may be confirmed twice would put a business
invariant in the evidence layer** — precisely the inversion AUD-D020 refuses for I-2.

### 6.4 The reason rule is enforced in both directions

**A correction to the draft's `CHECK (reason_text IS NULL OR action_key IN (…))`, which only prevented
reasons on some events. It did not enforce Stage 7's actual requirement — that a discretionary action
CARRIES a reason.**

Three semantics exist, so one predicate cannot express them:

```
REQUIRED    reason_text IS NOT NULL, non-empty, bounded length
            funding_adjustment.authorised · replacement.charge_decided
            settlement.rejected / corrected · stock.corrected · handover.corrected
            break-glass elevation · support engagement · purge

OPTIONAL    reason_text may be present or absent
            school.suspended · integration.suspended_or_resumed

FORBIDDEN   reason_text IS NULL
            every automatic and system-generated event
```

**AUD-D057 · `reason_policy` is a stored bounded column derived from the AET, and the constraint checks
against it**

```sql
CHECK (
  (reason_policy = 'required'  AND reason_text IS NOT NULL AND length(btrim(reason_text)) > 0)
  OR (reason_policy = 'optional')
  OR (reason_policy = 'forbidden' AND reason_text IS NULL)
)
```

**A bounded classification column plus one readable predicate beats a growing `IN (…)` list of action
keys**, which would need a migration every time an AET is added and would drift from §8's table. **The
application sets `reason_policy` from the AET definition; the database enforces the three semantics.**
**The mechanism now matches the guarantee claimed**, which the draft's single predicate did not.
---

## 7. A15-003 — the physical schema amendment

**Verified before assigning: Stage 15's amendment register holds A15-001 and A15-002; the next is
A15-003. Its table catalogue reaches DBT-078 and its uniqueness register DBI-033; the next are DBT-079
and DBI-034.**

```
A15-003 · The canonical audit event and the console operation record
RAISED BY  Stage 19, 31 August 2026
AFFECTS    DATABASE_SCHEMA.md — its §30 deferral · §41 catalogue · §33 uniqueness
           register · §42 map.  (Stage 15's section numbers, not this document's.)
TYPE       ADDITION — two tables. Nothing removed, renamed or renumbered.
STATUS     PROPOSED with this stage
```

**Stage 15 deferred this deliberately and named the owner.** Its §30 records `audit_events` as
**DEFERRED — Stage 19 owns the record mechanics *and* the schema**, with no DBT identifier, explicitly
so that fixing columns early would not pre-empt this stage. **This amendment is that deferral being
honoured, not overturned.**

| New table | Owner | Tenancy |
|---|---|---|
| **DBT-079 `audit_events`** | **MOD-013 Audit & Attribution** | **MIXED scope** — `scope_kind` discriminator over `school` · `platform` · `identity`, §11 |
| **DBT-080 `console_operations`** | **MOD-012 Platform Operations** | tenancy **derived** from its parent event (Stage 15's derived-ownership class) · **1:0..1** with `audit_events` |

**DBT-080 is MOD-012's, not MOD-013's — §6.2 explains why, and it is the correction that keeps DM-054
where Stage 8 put it.** It carries the operational facts of a privileged platform operation: the typed
operation, its tier, its target, elevation state and the lifecycle facts MOD-012 needs to run the
platform. **It carries no actor, no context, no authority and no capability** — those live exactly once,
on the linked audit event.

### 7.1 The new constraints, counted

**Uniqueness — two new entries, not one**

| New | Constraint | Enforces |
|---|---|---|
| **DBI-034** | `UNIQUE (business_act_key, action_key) WHERE business_act_key IS NOT NULL AND outcome = 'succeeded'` | **one piece of evidence per business act** — a re-emitted event does not create a second record of the same act |
| **DBI-035** | `UNIQUE (audit_event_id)` on `console_operations` | **the 1:0..1 link is structural** — an audit event has at most one console operation record, and an orphan operation record cannot exist |

**DBI-034 is deduplication of EVIDENCE and nothing else — AUD-D056.** It does **not** decide whether a
settlement may be confirmed twice; **DBI-014's partial unique already does that, in the module that owns
the money.** The draft's `correlation_id` version is withdrawn for the reasons at §6.3: a retry is a new
request with a new correlation id, and PostgreSQL treats NULLs as distinct, so the index would have
enforced nothing on precisely the rows that matter.

**CHECK constraints — eleven**

| # | Table | Constraint | Enforces |
|---|---|---|---|
| **CK-A1** | DBT-079 | `CHECK (scope_kind IN ('school','platform','identity'))` | the discriminator is a closed vocabulary |
| **CK-A2** | DBT-079 | `CHECK ((scope_kind = 'school') = (school_id IS NOT NULL))` | **a school event has a school; a platform or identity event has none** — Stage 15 CK-01's pattern |
| **CK-A3** | DBT-079 | `CHECK (actor_kind IN ('person','system','integration'))` | closed actor vocabulary |
| **CK-A4** | DBT-079 | `CHECK ((actor_kind = 'person') = (actor_person_id IS NOT NULL OR actor_pseudonym_ref IS NOT NULL))` | **a person event identifies its person — by FK, or by pseudonym after §24 has run.** Never by a fabricated `persons` row |
| **CK-A5** | DBT-079 | `CHECK ((actor_kind = 'system') = (system_job_id IS NOT NULL))` | a job event names its job |
| **CK-A6** | DBT-079 | `CHECK ((actor_kind = 'integration') = (integration_ref IS NOT NULL))` | a callback event names its integration |
| **CK-A7** | DBT-079 | `CHECK (actor_kind = 'person' OR (actor_context_kind IS NULL AND actor_authority IS NULL AND capability_id IS NULL))` | **a job and a provider hold no context, no authority and no capability, and the schema will not let one be invented for them** |
| **CK-A8** | DBT-079 | the three-way `reason_policy` predicate — **AUD-D057, §6.4** | **a discretionary act carries a reason, and an automatic one cannot** |
| **CK-A9** | DBT-079 | `CHECK (outcome IN ('succeeded','refused','failed'))` · `CHECK (subject_identity_state IN ('identified','pseudonymised'))` | closed vocabularies |
| **CK-B1** | DBT-080 | `CHECK (tier IN ('operation','query','breakglass'))` | the current console's own three tiers, preserved |
| **CK-B2** | DBT-080 | `CHECK ((tier = 'breakglass') = (elevation_event_id IS NOT NULL))` | **an elevated operation names the elevation that authorised it** |

**CK-A7 is the correction the owner's instruction demanded in the schema rather than in prose.** A NOT
NULL on `actor_person_id`, `actor_authority` or `capability_id` would have forced every scheduled job
and every provider callback to be attributed to an invented person holding an invented authority under
an invented capability. **A fabricated attribution is worse than an honest absence, because it is
indistinguishable from a real one at read time.**

**Foreign keys — seven**

| # | From | To | On delete |
|---|---|---|---|
| **FK-A1** | `audit_events.school_id` | DBT-001 `schools` | **RESTRICT** — evidence outlives convenience; purge is the only path, §25 |
| **FK-A2** | `audit_events.actor_person_id` | DBT-007 `persons` | **RESTRICT** — §24 pseudonymises, it never cascades |
| **FK-A3** | `audit_events.actor_school_id` | DBT-001 `schools` | RESTRICT |
| **FK-A4** | `audit_events.subject_school_id` | DBT-001 `schools` | RESTRICT |
| **FK-A5** | `audit_events.support_engagement_id` | DBT-067 `support_engagements` | RESTRICT |
| **FK-A6** | `audit_events.elevation_event_id` | **DBT-079 `audit_events` — a self-reference** | RESTRICT |
| **FK-A7** | `console_operations.audit_event_id` | DBT-079 `audit_events` | **RESTRICT** — an operation record cannot outlive its evidence |

**AUD-D058 · Elevation is a reference to the granting event, not a new table.** The draft carried an
`elevation_id` with **no table in the locked schema to point at** — Stage 15's catalogue has no
elevation table, because break-glass elevation lives today inside `console_audit`'s `breakglass` tier.
**Rather than invent DBT-081 to satisfy a column, the elevated operation points at AET-030, the event
that granted the elevation.** The grant is already an audit fact with an actor, an authority, a reason
and an expiry; **a second table would have duplicated it and created a second place for the two to
disagree.**

**Supporting indexes — eight**

```
DBT-079   (school_id, occurred_at DESC)  WHERE scope_kind = 'school'      the school's own trail
          (occurred_at DESC)             WHERE scope_kind = 'platform'    the platform trail
          (subject_type, subject_id, occurred_at DESC)                    "what happened to this child"
          (actor_person_id, occurred_at DESC)                             "what did this person do"
          (action_key, occurred_at DESC)                                  taxonomy queries and §30 alerts
          (support_engagement_id)        WHERE NOT NULL                   SECAR-018's engagement view
          (correlation_id)               WHERE NOT NULL                   log correlation

DBT-080   (operation_kind, occurred_at DESC)                              MOD-012's operational view
```

**DB-P19 checked: no index predicate and no CHECK predicate reads the wall clock.**

**Effect on Stage 15's registers**

| Register | Before A15-003 | After |
|---|---|---|
| DBT tables | **78** — DBT-001 … DBT-078 | **80** — DBT-001 … **DBT-080** |
| Uniqueness | **33** — DBI-001 … DBI-033 | **35** — DBI-001 … **DBI-035** |
| MOD-013 tables | **0** | **1** — DBT-079 |
| MOD-012 tables | **2** — DBT-067 … DBT-068 | **3** — plus DBT-080 |
| Migration | MIG-01 … MIG-14 | unchanged — **both tables are created by MIG-03**, by migration, never by application DDL |

### 7.2 What the current tables become

| Current | Disposition |
|---|---|
| `audit_logs` | **data preserved and migrated** into `audit_events` under **MIG-07**; the table is dropped only at **MIG-14**, after the soak and owner approval |
| `message_audit_logs` | **same** — its `school_id` and actor FK migrate cleanly, which is why it is the easiest of the three |
| `console_audit` | **same** — its operational columns become `console_operations`, its attribution columns become the audit event, **and its snapshot columns are governed by §7.3** |

**Nothing is dropped before MIG-14, and no audit data is discarded at any point** — Stage 15's ABSOLUTE
SAFETY RULE applies to the audit trail more obviously than to anything else.

### 7.3 Legacy console snapshots — POLICY INPUT REQUIRED

**AUD-D059 · The existing `beforeSnapshot` / `afterSnapshot` values are not this stage's to destroy.**

```
LEGACY SNAPSHOT DISPOSITION                              POLICY INPUT REQUIRED
   the target schema does not carry snapshot columns     §26 explains why
   THAT IS A DECISION ABOUT THE FUTURE SHAPE — IT IS NOT A DECISION
   ABOUT DATA THAT ALREADY EXISTS
   MIG-14 MUST NOT DESTROY THEM MERELY BECAUSE THE NEW SCHEMA NO LONGER
   WANTS THEM
```

The current `server/console/audit.ts` writes `beforeSnapshot` and `afterSnapshot` capped at
`MAX_SNAPSHOT_BYTES = 64 * 1024`. **Those rows exist now, in production, and may contain personal
data — which is exactly why they cannot be quietly deleted and exactly why they cannot be quietly
kept.** Both are decisions with consequences that this stage is not authorised to take:

| Option | What it means | Who decides |
|---|---|---|
| **Retain as-is** | preserved in an archived table, access-controlled, with a stated retention period | **owner + LEGAL REVIEW REQUIRED** |
| **Retain redacted** | preserved with a documented redaction pass applied first | **owner + LEGAL REVIEW REQUIRED** |
| **Delete at MIG-14** | destroyed with the parent table | **owner only, and explicitly** |

**Stage 19 records the requirement and refuses to pick.** Retention periods are not invented here
(AUD-P22), and whether these snapshots are records that must be preserved is a legal classification, not
a technical one. **MIG-14's precondition list gains this item: `LEGACY SNAPSHOT DISPOSITION` must be
answered in writing before `console_audit` is dropped.**

> **POST-LOCK AMENDMENT A19-001 — the owner answered the INTERIM disposition on 31 August 2026.**
> **LEGACY SNAPSHOT DISPOSITION = 1A · QUARANTINE / PRESERVE PENDING POLICY.** The three options
> above are **not** superseded — they remain the FINAL legal question. What 1A settles is the interim
> handling, and it does so by choosing none of the three: **the bytes are preserved, quarantined and
> made unreachable, and the retain / redact / delete decision stays open.** The locked text above
> stands as written; **§42 carries the amendment, and it governs.**

---

## 8. Event taxonomy — AET-001 … AET-102

**Stable keys. Never free text.** Every event carries an `action_key` from this list; **an act with no
AET is not audited, and adding one is a decision recorded here.**

**102 events. The draft had 66, and 66 was not enough — that is a correction, not a conflict.**

Building the per-event matrix at §8.9 forced a coverage check that the draft's prose had asserted
rather than performed. **Stage 7 marks 67 capabilities `AUDIT`. The 66-event draft left 33 of them with
no event at all** — no record of a child being created or archived, of a guardian link code being
issued or redeemed, of a payment being applied, of a refund being issued, of custody transferring to a
teacher, of a rollover running, or of a scheduled job doing any of it. **A taxonomy that cannot record
a third of the acts a locked stage requires to be recorded is not a taxonomy; the fix is AET-067 …
AET-102 at §8.9, appended, with nothing renumbered.**

**A discrepancy inside locked Stage 7, flagged rather than corrected here — C-103.** Stage 7 §20 states
*"58 of 95 capabilities require audit."* Its per-capability register marks **67**. The register is the
operative artefact and is what §8.9 covers; **the headline number is what disagrees with it.** Stage 19
does not silently rewrite a locked stage's count — see §35.

### 8.1 Identity and security — AET-001 … AET-010

| AET | Event | Note |
|---|---|---|
| **AET-001** | `auth.sign_in.succeeded` | **policy-gated** — §14 explains why this is not simply "every login" |
| **AET-002** | `auth.sign_in.failed.classified` | only where the classification is security-relevant (§14) |
| **AET-003** | `auth.account.locked` | |
| **AET-004** | `credential.password.changed` | |
| **AET-005** | `credential.password.reset_completed` | |
| **AET-006** | `credential.email.changed` | |
| **AET-007** | `mfa.enrolled` | |
| **AET-008** | `mfa.disabled` | |
| **AET-009** | `mfa.recovery_code.used` | **one is an event; five failed logins is a metric** (§14) |
| **AET-010** | `session.revoked` | includes sign-out-everywhere and administrative revocation |

### 8.2 Authority — AET-011 … AET-018

| AET | Event | Note |
|---|---|---|
| **AET-011** | `membership.granted` | |
| **AET-012** | `membership.revoked` | |
| **AET-013** | `authority.granted` | |
| **AET-014** | `authority.revoked` | |
| **AET-015** | `authority.finance.changed` | separated because PA-1 makes it distinctly consequential — CAP-032 is deliberately not CAP-031 |
| **AET-016** | `authority.cms.changed` | |
| **AET-017** | `context.switched` | **CAP-039 is marked AUDIT by locked Stage 7, so this is written on every switch** — §14 corrected |
| **AET-018** | `account.status.changed` | disabled / enabled |

### 8.3 Platform lifecycle — AET-019 … AET-025

| AET | Event | Note |
|---|---|---|
| **AET-019** | `school.created` | |
| **AET-020** | `school.suspended` | |
| **AET-021** | `school.archived` | |
| **AET-022** | `school.restored` | |
| **AET-023** | `school.deletion_requested` | **records the request; it does not own the cooldown** |
| **AET-024** | `school.purge_executed` | CAP-092 · **eligibility is read from DBT-002 `school_lifecycle_events`, never from the audit event** — §3 and AUD-D029 |
| **AET-025** | `tenant.onboarding.state_changed` | |

**The draft said eligibility is "read from AET-023's record." It is not, and it must not be.** DBT-002
already holds `deletion_requested` and `purged` as an APPEND-ONLY lifecycle fact, and DM-054 makes
lifecycle a load-bearing record rather than a log. **Two concepts claiming to own purge eligibility is
one too many** — AUD-D029 settles it on DBT-002.

### 8.4 Support — AET-026 … AET-028 · Break-glass — AET-029 … AET-032

| AET | Event | Note |
|---|---|---|
| **AET-026** | `support.engagement.opened` | |
| **AET-027** | `support.engagement.closed` | |
| **AET-028** | `support.action.performed` | **every typed operation inside a tenant** — CAP-088 |
| **AET-029** | `breakglass.elevation.requested` | |
| **AET-030** | `breakglass.elevation.granted` | **FK-A6 points at this event from every operation it authorises** |
| **AET-031** | `breakglass.operation.performed` | coupling depends on whether the operation is transactional — §12 |
| **AET-032** | `breakglass.elevation.ended` | expiry or explicit end |

### 8.5 Finance — AET-033 … AET-039

| AET | Event | Note |
|---|---|---|
| **AET-033** | `money_event.recorded` | |
| **AET-034** | `funding_adjustment.authorised` | discretionary → **reason required** · CAP-051 and CAP-052 |
| **AET-035** | `settlement.confirmed` | **this is I-2** (§13) |
| **AET-036** | `settlement.rejected` | reason required |
| **AET-037** | `settlement.corrected` | reason required |
| **AET-038** | `reconciliation.decision.recorded` | |
| **AET-039** | `replacement.charge_decided` | discretionary → reason required |

### 8.6 Fulfilment — AET-040 … AET-046

| AET | Event | Note |
|---|---|---|
| **AET-040** | `allocation.created` | within I-2 |
| **AET-041** | `allocation.cancelled` | |
| **AET-042** | `stock.corrected` | reason required |
| **AET-043** | `handover.recorded` | CAP-063 / CAP-064 |
| **AET-044** | `handover.corrected` | reason required |
| **AET-045** | `replacement.reviewed` | |
| **AET-046** | `return.recorded` | |

### 8.7 Import — AET-047 … AET-049 · CMS — AET-050 … AET-053

| AET | Event | Note |
|---|---|---|
| **AET-047** | `import.enrolment.committed` | `import_session_id`, never `session_id` — §31 |
| **AET-048** | `import.reconciliation.committed` | |
| **AET-049** | `import.corrected` | reason required |
| **AET-050** | `cms.entitlement.changed` | MA-2 |
| **AET-051** | `cms.revision.published` | §19 |
| **AET-052** | `cms.publication.corrected` | reason required |
| **AET-053** | `cms.public_domain.changed` | |

### 8.8 Integration — AET-054 … AET-057 · Privacy — AET-058, continued at §24

| AET | Event | Note |
|---|---|---|
| **AET-054** | `integration.configured` | a school's own provider account (INTQ-1 = A) |
| **AET-055** | `integration.credential_reference.rotated` | the *reference*, never the secret |
| **AET-056** | `integration.suspended_or_resumed` | **school-scoped only** — Stage 18 OPS-D070 |
| **AET-057** | `provider_event.rejected` | **authenticity or replay failure only** — §23 |
| **AET-058** | `privacy.request.received` | the DSAR family continues at §24 |

### 8.9 Coverage completion — AET-067 … AET-102

**Appended, never renumbered.** Each entry exists because a locked Stage 7 capability is marked `AUDIT`
and the draft taxonomy had no event for it. **The right-hand column is the reason the event exists, and
it is checkable against PERMISSIONS.md rather than asserted.**

| AET | Event | Closes |
|---|---|---|
| **AET-067** | `school.identity.changed` | CAP-001 |
| **AET-068** | `school.policy.changed` | CAP-002 |
| **AET-069** | `academic_period.changed` | CAP-004 |
| **AET-070** | `period_rollover.run` | CAP-005 |
| **AET-071** | `child.record.changed` | CAP-018 |
| **AET-072** | `child.archived` | CAP-020 |
| **AET-073** | `class_membership.changed` | CAP-019 |
| **AET-074** | `family.record.changed` | CAP-022 |
| **AET-075** | `guardian.record.changed` | CAP-023 |
| **AET-076** | `guardian_link_code.issued` | CAP-024 |
| **AET-077** | `guardian_link_code.rotated` | CAP-025 |
| **AET-078** | `guardian_link_code.redeemed` | CAP-026 — **the one audited act with no prior authority** (SC-5) |
| **AET-079** | `child_requirement_override.set` | CAP-009 |
| **AET-080** | `class_staffing.granted` | CAP-016 |
| **AET-081** | `class_staffing.revoked` | CAP-017 |
| **AET-082** | `staff.invited` | CAP-030 |
| **AET-083** | `invitations.sent` | CAP-029 |
| **AET-084** | `platform.first_admin.invited` | CAP-083 |
| **AET-085** | `stock.intake_recorded` | CAP-011 |
| **AET-086** | `cycle.opened` | CAP-040 |
| **AET-087** | `cycle.closed` | CAP-044 |
| **AET-088** | `requirement_item.created` | CAP-042 |
| **AET-089** | `requirement.corrected` | CAP-043 |
| **AET-090** | `payment.applied` | CAP-048 |
| **AET-091** | `refund.issued` | CAP-054 |
| **AET-092** | `fulfilment_route.chosen` | CAP-058 |
| **AET-093** | `fulfilment_route.changed` | CAP-059 |
| **AET-094** | `fulfilment.prepared` | CAP-060 |
| **AET-095** | `custody.transferred_to_teacher` | CAP-061 |
| **AET-096** | `fulfilment_exception.recorded` | CAP-065 |
| **AET-097** | `postal_dispatch.recorded` | CAP-066 — **FUTURE**, defined so the route cannot ship unaudited |
| **AET-098** | `replacement.requested` | CAP-067 |
| **AET-099** | `replacement.pre_handover_provided` | CAP-068 |
| **AET-100** | `job.run.recorded` | CAP-093 — **the scheduler's own capability, which genuinely exists** |
| **AET-101** | `settlement_signal.received` | CAP-094 — **the integration's own capability, which genuinely exists** |
| **AET-102** | `console.readonly_query.run` | CAP-089 — separated from AET-028 because a read is not a write |

**CAP-093, CAP-094 and CAP-095 are real capabilities in locked Stage 7, held by the scheduler, the
integration and the email provider.** Citing them for system and integration actors is **not** the
invention CK-A7 forbids; **inventing a `CAP-xxx` that does not exist, or attributing a job to a person,
is.** Where an act genuinely has no capability — a sign-in, a lockout, an account recovery before
authentication — the column is `—` and the schema stores NULL.

### 8.10 The matrix — every event, classified

**This table is normative.** Where §6.4's `reason_policy` lists and §12's coupling narrative describe
the rules, **this is the per-event application of them**, and the two must agree. It also completes the
`safe_metadata` allowlist §26 requires and the alert set §30 consumes.

| AET | Stable key | Primary subject | Scope | Actor kind | Capability | Authority | Reason | Class |
|---|---|---|---|---|---|---|---|---|
| **AET-001** | `auth.sign_in.succeeded` | person | identity | person | — | — | forbidden | **B** |
| **AET-002** | `auth.sign_in.failed.classified` | person | identity | person · system | — | — | forbidden | **B** |
| **AET-003** | `auth.account.locked` | person | identity | system | — | — | forbidden | **B** |
| **AET-004** | `credential.password.changed` | person | identity | person | CAP-038 | — | forbidden | **A** |
| **AET-005** | `credential.password.reset_completed` | person | identity | person | — | — | forbidden | **A** |
| **AET-006** | `credential.email.changed` | person | identity | person | CAP-038 | — | forbidden | **A** |
| **AET-007** | `mfa.enrolled` | person | identity | person | CAP-038 | — | forbidden | **A** |
| **AET-008** | `mfa.disabled` | person | identity | person | CAP-038 | — | optional | **A** |
| **AET-009** | `mfa.recovery_code.used` | person | identity | person | — | — | forbidden | **A** |
| **AET-010** | `session.revoked` | person | identity | person · system | CAP-038 | — | optional | **B †** |
| **AET-011** | `membership.granted` | person | school | person | CAP-031 | AUTH-SCHOOL | optional | **A** |
| **AET-012** | `membership.revoked` | person | school | person | CAP-033 · CAP-035 | AUTH-SCHOOL | optional | **A** |
| **AET-013** | `authority.granted` | person | school · platform | person | CAP-031 | AUTH-SCHOOL · AUTH-PLATFORM | optional | **A** |
| **AET-014** | `authority.revoked` | person | school · platform | person | CAP-031 | AUTH-SCHOOL · AUTH-PLATFORM | optional | **A** |
| **AET-015** | `authority.finance.changed` | person | school | person | CAP-032 | AUTH-SCHOOL | **required** | **A** |
| **AET-016** | `authority.cms.changed` | person | school | person | CAP-031 | AUTH-SCHOOL | optional | **A** |
| **AET-017** | `context.switched` | person | identity | person | CAP-039 | — | forbidden | **B** |
| **AET-018** | `account.status.changed` | person | school | person | CAP-033 · CAP-034 | AUTH-SCHOOL | optional | **A** |
| **AET-019** | `school.created` | school | platform | person | CAP-082 | AUTH-PLATFORM | optional | **A** |
| **AET-020** | `school.suspended` | school | platform | person | CAP-084 | AUTH-PLATFORM | optional | **A** |
| **AET-021** | `school.archived` | school | platform | person | CAP-084 | AUTH-PLATFORM | optional | **A** |
| **AET-022** | `school.restored` | school | platform | person | CAP-084 | AUTH-PLATFORM | optional | **A** |
| **AET-023** | `school.deletion_requested` | school | platform | person | CAP-084 | AUTH-PLATFORM | **required** | **A** |
| **AET-024** | `school.purge_executed` | school | platform | person | CAP-092 | AUTH-BREAKGLASS | **required** | **A ‡** |
| **AET-025** | `tenant.onboarding.state_changed` | school | platform | person · system | CAP-082 · CAP-083 | AUTH-PLATFORM | forbidden | **B** |
| **AET-026** | `support.engagement.opened` | school | school | person | CAP-086 | AUTH-PLATFORM | **required** | **A** |
| **AET-027** | `support.engagement.closed` | school | school | person · system | CAP-087 | AUTH-PLATFORM | optional | **B** |
| **AET-028** | `support.action.performed` | varies | school | person | CAP-088 | AUTH-PLATFORM | optional | **A** |
| **AET-029** | `breakglass.elevation.requested` | person | school | person | CAP-090 | AUTH-BREAKGLASS | **required** | **B** |
| **AET-030** | `breakglass.elevation.granted` | person | school | person | CAP-090 | AUTH-BREAKGLASS | **required** | **A** |
| **AET-031** | `breakglass.operation.performed` | varies | school | person | CAP-091 | AUTH-BREAKGLASS | **required** | **A / B §** |
| **AET-032** | `breakglass.elevation.ended` | person | school | person · system | CAP-090 | AUTH-BREAKGLASS | forbidden | **B** |
| **AET-033** | `money_event.recorded` | child | school | person | CAP-047 | AUTH-FINANCE | optional | **A** |
| **AET-034** | `funding_adjustment.authorised` | child | school | person | CAP-051 · CAP-052 | AUTH-FINANCE | **required** | **A** |
| **AET-035** | `settlement.confirmed` | child | school | person | CAP-049 | AUTH-FINANCE | optional | **A** |
| **AET-036** | `settlement.rejected` | child | school | person | CAP-050 | AUTH-FINANCE | **required** | **A** |
| **AET-037** | `settlement.corrected` | child | school | person | CAP-053 | AUTH-FINANCE | **required** | **A** |
| **AET-038** | `reconciliation.decision.recorded` | child | school | person | CAP-056 | AUTH-FINANCE | optional | **A** |
| **AET-039** | `replacement.charge_decided` | child | school | person | CAP-070 | AUTH-FINANCE | **required** | **A** |
| **AET-040** | `allocation.created` | child | school | person · system | CAP-049 · CAP-060 | AUTH-FINANCE · AUTH-SCHOOL | forbidden | **A** |
| **AET-041** | `allocation.cancelled` | child | school | person | CAP-060 | AUTH-SCHOOL | optional | **A** |
| **AET-042** | `stock.corrected` | book | school | person | CAP-012 | AUTH-SCHOOL | **required** | **A** |
| **AET-043** | `handover.recorded` | child | school | person | CAP-063 · CAP-064 | AUTH-TEACH · AUTH-SCHOOL | forbidden | **A** |
| **AET-044** | `handover.corrected` | child | school | person | CAP-063 · CAP-064 | AUTH-TEACH · AUTH-SCHOOL | **required** | **A** |
| **AET-045** | `replacement.reviewed` | child | school | person | CAP-069 | AUTH-SCHOOL | optional | **A** |
| **AET-046** | `return.recorded` | book | school | person | CAP-071 | AUTH-SCHOOL | forbidden | **A** |
| **AET-047** | `import.enrolment.committed` | import session | school | person | CAP-027 · CAP-028 | AUTH-SCHOOL | forbidden | **A** |
| **AET-048** | `import.reconciliation.committed` | import session | school | person | CAP-055 | AUTH-FINANCE | forbidden | **A** |
| **AET-049** | `import.corrected` | import session | school | person | CAP-027 · CAP-028 · CAP-055 | AUTH-SCHOOL · AUTH-FINANCE | **required** | **A** |
| **AET-050** | `cms.entitlement.changed` | school | platform | person | CAP-084 | AUTH-PLATFORM | optional | **A** |
| **AET-051** | `cms.revision.published` | site revision | school | person | CAP-079 | AUTH-CMS | optional | **A** |
| **AET-052** | `cms.publication.corrected` | site revision | school | person | CAP-079 | AUTH-CMS | **required** | **A** |
| **AET-053** | `cms.public_domain.changed` | school | school | person | CAP-084 | AUTH-PLATFORM | optional | **A** |
| **AET-054** | `integration.configured` | integration | school | person | CAP-055 | AUTH-FINANCE | optional | **A** |
| **AET-055** | `integration.credential_reference.rotated` | integration | school | person | CAP-055 | AUTH-FINANCE | optional | **B ¶** |
| **AET-056** | `integration.suspended_or_resumed` | integration | school | person · system | CAP-055 | AUTH-FINANCE | optional | **B** |
| **AET-057** | `provider_event.rejected` | provider event | school | integration | CAP-094 | — | forbidden | **B** |
| **AET-058** | `privacy.request.received` | person | school · identity | person | — | AUTH-SCHOOL | optional | **B** |
| **AET-059** | `privacy.request.accepted` | person | school · identity | person | — | AUTH-SCHOOL | optional | **A** |
| **AET-060** | `privacy.export.produced` | person | school · identity | system | — | — | forbidden | **B ¶** |
| **AET-061** | `privacy.export.accessed` | person | school · identity | person | — | AUTH-FAMILY · AUTH-SCHOOL | forbidden | **B** |
| **AET-062** | `audit.exported` | varies | school · platform | person | **OPEN — §29** | AUTH-SCHOOL · AUTH-PLATFORM | **required** | **A** |
| **AET-063** | `privacy.erasure.initiated` | person | school · identity | person | — | AUTH-SCHOOL | **required** | **A** |
| **AET-064** | `privacy.erasure.completed` | person | school · identity | system | — | — | forbidden | **B ¶** |
| **AET-065** | `privacy.retention_exception.recorded` | person | school · identity | person | — | AUTH-SCHOOL | **required** | **A** |
| **AET-066** | `retention.deletion.executed` | varies | school · platform | system | CAP-093 | — | forbidden | **B** |
| **AET-067** | `school.identity.changed` | school | school | person | CAP-001 | AUTH-SCHOOL | optional | **A** |
| **AET-068** | `school.policy.changed` | school | school | person | CAP-002 | AUTH-SCHOOL | optional | **A** |
| **AET-069** | `academic_period.changed` | academic period | school | person | CAP-004 | AUTH-SCHOOL | optional | **A** |
| **AET-070** | `period_rollover.run` | academic period | school | person | CAP-005 | AUTH-SCHOOL | optional | **A** |
| **AET-071** | `child.record.changed` | child | school | person | CAP-018 | AUTH-SCHOOL | optional | **A** |
| **AET-072** | `child.archived` | child | school | person | CAP-020 | AUTH-SCHOOL | optional | **A** |
| **AET-073** | `class_membership.changed` | child | school | person | CAP-019 | AUTH-SCHOOL | optional | **A** |
| **AET-074** | `family.record.changed` | family | school | person | CAP-022 | AUTH-SCHOOL | optional | **A** |
| **AET-075** | `guardian.record.changed` | guardian | school | person | CAP-023 | AUTH-SCHOOL | optional | **A** |
| **AET-076** | `guardian_link_code.issued` | child | school | person | CAP-024 | AUTH-SCHOOL | optional | **A** |
| **AET-077** | `guardian_link_code.rotated` | child | school | person | CAP-025 | AUTH-SCHOOL | optional | **A** |
| **AET-078** | `guardian_link_code.redeemed` | child | school | person | CAP-026 | —  *(no prior authority · SC-5)* | forbidden | **A** |
| **AET-079** | `child_requirement_override.set` | child | school | person | CAP-009 | AUTH-SCHOOL | optional | **A** |
| **AET-080** | `class_staffing.granted` | person | school | person | CAP-016 | AUTH-SCHOOL | optional | **A** |
| **AET-081** | `class_staffing.revoked` | person | school | person | CAP-017 | AUTH-SCHOOL | optional | **A** |
| **AET-082** | `staff.invited` | person | school | person | CAP-030 | AUTH-SCHOOL | optional | **A** |
| **AET-083** | `invitations.sent` | varies | school | person | CAP-029 | AUTH-SCHOOL | forbidden | **A** |
| **AET-084** | `platform.first_admin.invited` | person | platform | person | CAP-083 | AUTH-PLATFORM | optional | **A** |
| **AET-085** | `stock.intake_recorded` | book | school | person | CAP-011 | AUTH-SCHOOL | forbidden | **A** |
| **AET-086** | `cycle.opened` | supply cycle | school | person · system | CAP-040 | AUTH-SCHOOL | forbidden | **A** |
| **AET-087** | `cycle.closed` | supply cycle | school | person | CAP-044 | AUTH-SCHOOL | optional | **A** |
| **AET-088** | `requirement_item.created` | child | school | person | CAP-042 | AUTH-SCHOOL | forbidden | **A** |
| **AET-089** | `requirement.corrected` | child | school | person | CAP-043 | AUTH-SCHOOL | **required** | **A** |
| **AET-090** | `payment.applied` | child | school | person | CAP-048 | AUTH-FINANCE | optional | **A** |
| **AET-091** | `refund.issued` | child | school | person | CAP-054 | AUTH-FINANCE | **required** | **A** |
| **AET-092** | `fulfilment_route.chosen` | child | school | person | CAP-058 | AUTH-FAMILY | forbidden | **A** |
| **AET-093** | `fulfilment_route.changed` | child | school | person | CAP-059 | AUTH-FAMILY · AUTH-SCHOOL | optional | **A** |
| **AET-094** | `fulfilment.prepared` | child | school | person | CAP-060 | AUTH-SCHOOL | forbidden | **A** |
| **AET-095** | `custody.transferred_to_teacher` | person | school | person | CAP-061 | AUTH-SCHOOL | optional | **A** |
| **AET-096** | `fulfilment_exception.recorded` | child | school | person | CAP-065 | AUTH-TEACH · AUTH-SCHOOL | optional | **A** |
| **AET-097** | `postal_dispatch.recorded` | child | school | person | CAP-066 | AUTH-SCHOOL | optional | **A** |
| **AET-098** | `replacement.requested` | child | school | person | CAP-067 | AUTH-TEACH | optional | **A** |
| **AET-099** | `replacement.pre_handover_provided` | child | school | person | CAP-068 | AUTH-SCHOOL | optional | **A** |
| **AET-100** | `job.run.recorded` | job | school · platform | system | CAP-093 | — | forbidden | **B** |
| **AET-101** | `settlement_signal.received` | child | school | integration | CAP-094 | — | forbidden | **B** |
| **AET-102** | `console.readonly_query.run` | varies | school | person | CAP-089 | AUTH-PLATFORM | optional | **A** |

**Footnotes**

- **†** **AET-010 is the single deliberate Class B exception among identity acts.** Session revocation
  is a *protective* act: making it roll back on an audit failure would leave a session alive that
  someone asked to kill. **The failure of a protective act's evidence must not restore the risk the act
  was removing.** The Class B failure alert (§30) covers the gap.
- **‡** **AET-024 is Class A bound to the terminal lifecycle transaction on DBT-002.** A purge runs in
  batches and the batches are operational progress, not evidence; **the moment the lifecycle row becomes
  `purged` is one transaction, and the audit event commits with it.**
- **§** **AET-031 is Class A where the privileged operation is transactional, and paired otherwise** —
  AUD-D063.
- **¶** **Class B because the act completes asynchronously, outside any transaction of ours**: an
  export object becoming available, a provider confirming a credential rotation, an erasure job
  finishing. **AUD-D062 forbids marking these Class A**, because a transaction that is not there cannot
  be joined.

| AET | `safe_metadata` allowlist | Domain-history record | Security alert |
|---|---|---|---|
| **AET-001** | source · session_ref | DBT-075 | no |
| **AET-002** | classification | DBT-076 | YES |
| **AET-003** | lock_reason_code | DBT-008 | YES |
| **AET-004** | change_route | DBT-008 | YES |
| **AET-005** | token_purpose | DBT-077 | YES |
| **AET-006** | —  *(no address stored — AUD-D005)* | DBT-007 | YES |
| **AET-007** | factor_kind | DBT-008 | no |
| **AET-008** | factor_kind · disable_route | DBT-008 | YES |
| **AET-009** | remaining_count | DBT-008 | YES |
| **AET-010** | revocation_scope · session_count | DBT-075 | no |
| **AET-011** | role_key | DBT-009 | no |
| **AET-012** | role_key · offboard_mode | DBT-009 | no |
| **AET-013** | authority_key | DBT-010 | no |
| **AET-014** | authority_key | DBT-010 | no |
| **AET-015** | direction | DBT-010 | YES |
| **AET-016** | direction | DBT-010 | no |
| **AET-017** | from_context · to_context | — *(no domain table)* | no |
| **AET-018** | new_status | DBT-009 | no |
| **AET-019** | school_ref | DBT-001 · DBT-002 | no |
| **AET-020** | school_ref | DBT-002 | YES |
| **AET-021** | school_ref | DBT-002 | no |
| **AET-022** | school_ref | DBT-002 | no |
| **AET-023** | school_ref | DBT-002 | YES |
| **AET-024** | school_ref · scope_summary | DBT-002 | YES |
| **AET-025** | from_state · to_state | DBT-068 | no |
| **AET-026** | engagement_ref | DBT-067 | YES |
| **AET-027** | engagement_ref · end_reason | DBT-067 | no |
| **AET-028** | operation_kind · target_ref | DBT-080 | YES |
| **AET-029** | requested_scope | DBT-080 | YES |
| **AET-030** | granted_scope · expires_at | DBT-080 | YES |
| **AET-031** | operation_kind · target_ref · affected_count | DBT-080 | YES |
| **AET-032** | end_reason | DBT-080 | no |
| **AET-033** | money_event_ref · kind | DBT-035 | no |
| **AET-034** | adjustment_ref · kind | DBT-037 | no |
| **AET-035** | settlement_review_ref | DBT-039 | no |
| **AET-036** | settlement_review_ref | DBT-039 | no |
| **AET-037** | settlement_review_ref | DBT-039 | YES |
| **AET-038** | match_ref | DBT-043 | no |
| **AET-039** | decision_ref · outcome_kind | DBT-051 | no |
| **AET-040** | allocation_ref | DBT-044 | no |
| **AET-041** | allocation_ref | DBT-044 | no |
| **AET-042** | book_ref · delta | DBT-025 | no |
| **AET-043** | handover_ref · route | DBT-047 | no |
| **AET-044** | handover_ref | DBT-047 | no |
| **AET-045** | review_ref · outcome_kind | DBT-050 | no |
| **AET-046** | return_ref | DBT-052 | no |
| **AET-047** | import_session_id · row_counts | DBT-072 | no |
| **AET-048** | import_session_id · row_counts | DBT-042 | no |
| **AET-049** | import_session_id | DBT-072 · DBT-042 | no |
| **AET-050** | entitlement_key | DBT-005 | no |
| **AET-051** | revision_ref | DBT-059 | no |
| **AET-052** | revision_ref | DBT-059 | no |
| **AET-053** | domain_ref · verification_state | DBT-006 | YES |
| **AET-054** | integration_ref · provider_key | DBT-040 | YES |
| **AET-055** | integration_ref  *(never the secret)* | DBT-040 | YES |
| **AET-056** | integration_ref · direction | DBT-040 | YES |
| **AET-057** | provider_event_ref · rejection_code | DBT-041 | YES |
| **AET-058** | request_ref · request_kind | — *(§24)* | no |
| **AET-059** | request_ref | — *(§24)* | no |
| **AET-060** | request_ref · object_ref | DBT-071 | no |
| **AET-061** | request_ref · object_ref | DBT-071 | YES |
| **AET-062** | export_ref · filter_summary · row_count | — *(§29)* | YES |
| **AET-063** | request_ref | — *(§24)* | YES |
| **AET-064** | request_ref · affected_class_summary | — *(§24)* | YES |
| **AET-065** | request_ref · exception_ref | — *(§25)* | YES |
| **AET-066** | class_key · row_count | DBT-069 | no |
| **AET-067** | field_keys | DBT-003 | no |
| **AET-068** | policy_keys | DBT-004 | no |
| **AET-069** | period_ref · change_kind | DBT-012 | no |
| **AET-070** | rollover_run_ref · counts | DBT-013 | no |
| **AET-071** | child_ref · field_keys | DBT-018 | no |
| **AET-072** | child_ref | DBT-018 | no |
| **AET-073** | child_ref · class_ref · direction | DBT-017 | no |
| **AET-074** | family_ref · field_keys | DBT-019 | no |
| **AET-075** | guardian_ref · field_keys | DBT-020 · DBT-021 | no |
| **AET-076** | child_ref  *(never the code — AUD-D005)* | DBT-022 | no |
| **AET-077** | child_ref  *(never the code)* | DBT-022 | YES |
| **AET-078** | child_ref · guardian_ref | DBT-022 · DBT-021 | YES |
| **AET-079** | child_ref · requirement_ref | DBT-033 | no |
| **AET-080** | class_ref | DBT-016 | no |
| **AET-081** | class_ref | DBT-016 | no |
| **AET-082** | invite_ref · role_key  *(never the raw token)* | DBT-011 | no |
| **AET-083** | invite_batch_ref · count | DBT-011 | no |
| **AET-084** | invite_ref · school_ref | DBT-011 · DBT-068 | no |
| **AET-085** | book_ref · quantity | DBT-025 | no |
| **AET-086** | cycle_ref | DBT-030 | no |
| **AET-087** | cycle_ref | DBT-030 | no |
| **AET-088** | requirement_ref · cycle_ref | DBT-031 | no |
| **AET-089** | requirement_ref | DBT-031 · DBT-032 | no |
| **AET-090** | application_ref · money_event_ref | DBT-036 | no |
| **AET-091** | money_event_ref | DBT-035 | YES |
| **AET-092** | child_ref · route | DBT-034 | no |
| **AET-093** | child_ref · from_route · to_route | DBT-034 | no |
| **AET-094** | instruction_ref | DBT-048 | no |
| **AET-095** | custody_event_ref · class_ref | DBT-045 | no |
| **AET-096** | exception_ref · exception_kind | DBT-046 | no |
| **AET-097** | instruction_ref | DBT-048 | no |
| **AET-098** | request_ref | DBT-049 | no |
| **AET-099** | request_ref · copy_ref | DBT-049 · DBT-024 | no |
| **AET-100** | job_ref · handler_key · outcome_counts | DBT-069 | no |
| **AET-101** | provider_event_ref | DBT-041 | no |
| **AET-102** | query_key · row_count | DBT-080 | YES |

**Reads and the allowlist.** The `safe_metadata` column above **is** the allowlist §26 enforces: a key
not listed for an AET is rejected, not silently stored. **Every entry is an identifier, a code, a count
or a direction — never a copied row, never an address, never a message body, never a token.** Where the
honest allowlist is empty it says so rather than inventing a field.

**AUD-D007 · Reads are not audited by default**

```
AUDITED READS — the small, deliberate set
   support.action.performed          a platform person reading INSIDE a tenant      AET-028
   console.readonly_query.run        CAP-089                                        AET-102
   audit.exported                    §29                                            AET-062
   privacy.export.produced/accessed  §24                                            AET-060/061

NOT AUDITED
   every GET · every page view · every list · every dashboard load
```

**Auditing ordinary reads would create a personal-data duplicate larger than the product.** A school
with 400 children generates thousands of reads a day, each naming a child; **the audit trail would
become the largest store of children's data in the system, and unusable as evidence because the signal
would be gone.** The audited set is the one where *the fact that someone looked* is itself the
consequential act.

---

## 9. Actor and context model

**AUD-D008 · Three actor kinds, and none of them pretends to be another**

```
actor_kind = 'person'        actor_person_id  FK → persons        the authoritative key
                             actor_pseudonym_ref                  after §24 has run
                             actor_context_kind   the ACTIVE CONTEXT
                             actor_authority      the AUTHORITY EXERCISED   ← PA-1

actor_kind = 'system'        a scheduled job — system_job_id, handler key in safe_metadata
                             NO person is invented                CAP-093 where one applies

actor_kind = 'integration'   a provider callback — integration_ref and provider_event
                             reference. A PROVIDER IS NOT A HUMAN ACTOR.   CAP-094
```

### 9.1 Nullability is a design decision, not an omission

**AUD-D060 · The actor, authority and capability columns are nullable, and CK-A4 … CK-A7 make the
absences honest**

```
NOT NULL WOULD HAVE FORCED               WHAT THE SCHEMA DOES INSTEAD
  a person for a scheduled job             actor_kind = 'system' · system_job_id · person NULL
  an authority for a provider callback     actor_authority NULL, enforced by CK-A7
  a CAP-xxx for an unauthenticated act     capability_id NULL — a sign-in has no capability
  a context for an authentication event    actor_context_kind NULL — there is no tenant yet
```

**A row that says a job was run by a person under an authority is not a stronger record than one that
says a job ran. It is a false one**, and at read time nothing distinguishes it from a true one. **The
constraints are paired so that the absence is structural: a person event must identify its person, and
a non-person event must not carry the person-only columns at all.**

**AUD-D009 · Email, role string and display name are never the actor key**

`audit_logs.userId` today is an unconstrained `varchar` (AUD-F02). The canonical event uses an **FK to
`persons`**, which is stable across an email change, a role change and a name change — **all three of
which the alternatives are not.**

**AUD-D010 · An actor display snapshot is permitted, narrowly, and is not authoritative**

The console's own comment makes the case: *"A UUID in an audit log is not an answer to 'who did this?'"*
That is a fair readability point, and **the answer is a join at read time under the reader's own
authority** (Stage 16 SEC-D064). Where a snapshot is genuinely required — because the person may later
be pseudonymised under §24 and the event must stay legible — **a display name at time of event may be
stored, and only that.** Never an email, never a role, never contact details.

**AUD-D011 · Context and authority are two fields because PA-1 makes them two facts**

```
actor:               Person A
active context:      school_admin
authority exercised: AUTH-FINANCE        ← without this, "the administrator confirmed a
capability:          CAP-049               payment" cannot be checked against whether they
                                           held finance authority at that moment
```

**This is Stage 7's locked requirement 2, and it is why one field would not do.**

---

## 10. Subject model

**AUD-D012 · The subject is resolved server-side and is never taken from the request**

`subject_type` · `subject_id` · `subject_school_id`, populated from the **`Resolved<T>`** the command
already holds (Stage 13 APP-022, Stage 16 SEC-D016). **An audit record built from a claimed identifier
records what the caller asserted, not what happened.**

**AUD-D013 · One event, one primary subject — with a bounded related-subject list**

A hand-over concerns a child, an allocation and a book. **The primary subject is the child**, because
that is what a person searches for; the allocation and book are **references in `safe_metadata` under
the AET's allowlist** at §8.10, as identifiers, never as copied rows.

---

## 11. Tenant model and RLS

**AUD-D014 · Audit is scoped structurally, using Stage 15's discriminator — never a NULL**

```
scope_kind = 'school'     school_id NOT NULL   a school's own audit
scope_kind = 'platform'   school_id NULL       platform lifecycle, onboarding, tenant creation
scope_kind = 'identity'   school_id NULL       an act on an ACCOUNT, not on a tenant:
                                               sign-in, password, MFA, context switch
```

**`school_id IS NULL` NEVER MEANS SCOPE, IN EITHER DIRECTION.** It does not mean "global audit" and it
does not mean "platform". **`scope_kind` says what the row is; `school_id` only says which school, when
there is one.** CK-A1 and CK-A2 enforce the pair. Stage 15 corrected exactly this
NULL-means-everything defect in `cron_job_runs`, and repeating it here would leak a platform event into
every school's view — or, worse, leak one person's account-security history into a tenant's.

**The draft had two scope kinds and no home for identity acts.** A password change is not a school
event: **a guardian with children at two schools has one account, and that account's history belongs to
neither school.** Forcing it to `school` would have required picking one arbitrarily; forcing it to
`platform` would have hidden the person's own history from the person. **`identity` is the honest third
value, and §11.1 is what makes it safe.**

### 11.1 Identity scope is least-privilege, not a shared pool

**AUD-D061 · An identity-scoped event is visible to its own subject and to nobody else by default**

| Reader | Sees identity-scoped events | On what basis |
|---|---|---|
| **the person themselves** | **their own, in full** | it is their account |
| **a school** | **nothing, by default** | **a school is not a party to an account it does not own** |
| **a school, during a support-relevant window** | **a bounded projection**, keyed to that school's own membership | §27 · SECAR-018 |
| **the platform** | **only under an open engagement or a security investigation**, and the read is itself AET-102 | SC-6 · CD-6 |

**A guardian with children at two schools must not have their complete account-security history exposed
to either school.** That is the requirement, and the mechanism is that identity events carry **no
`school_id` at all** — so a tenant policy has nothing to match on, and the bounded projection is an
explicit, capability-gated join rather than a row-level grant.

**AUD-D015 · Three read policy classes**

| Class | Reads |
|---|---|
| **SCHOOL AUDIT** | `scope_kind = 'school' AND school_id = <tenant context>` — nothing else |
| **PLATFORM AUDIT** | `scope_kind = 'platform'`, under AUTH-PLATFORM · CAP-085 · UX-099 |
| **IDENTITY AUDIT** | `scope_kind = 'identity' AND actor_person_id = <the reader>` — §11.1 |

**The draft's fourth class, FAMILY-RELATED, is withdrawn.** It described a policy that reached audit
rows "through the school and the subject relationship" for a reader who, in the same sentence, **does
not get an audit console at all.** A row-level policy with no reader is not a control — **it is a
standing grant waiting for someone to build a screen against it.** ROLE_EXPERIENCE has no family audit
surface, and §27 keeps it that way; the guardian's account history is reached through IDENTITY AUDIT,
which is about their account and not about any school's data.

**AUD-D016 · A support action is visible to the school it acted on.** Stage 16 SECAR-018 requires it:
*"support that a tenant cannot see is indistinguishable from a breach, from the tenant's point of
view."* **The event is dual-scoped by design** — `scope_kind = 'school'` with the school it touched,
**plus** the platform actor and engagement recorded on the same row.

**AUD-D017 · An anonymous public request is not an audit actor.** A public page view produces no audit
event (AUD-D007). **CAP-081 `view_published_site` is unauthenticated by design**, and recording an actor
for it would mean inventing one.

---

## 12. Transaction coupling

**AX-3 · Three classes, and what failure does in each**

```
CLASS A · MUST COMMIT WITH THE BUSINESS ACT
   the audit INSERT is inside the business transaction
   IF THE AUDIT INSERT FAILS, THE BUSINESS TRANSACTION FAILS
   ── never "business committed, audit best-effort"                    AD-026

CLASS B · DURABLE IMMEDIATELY AFTER AN ACT THAT IS NOT ONE TRANSACTION
   a sign-in · a session revocation · an export object completing ·
   a provider confirming a rotation
   the event is written in its own committed transaction, immediately, with
   occurred_at ≠ recorded_at
   a failure here is ITSELF an alert (§30)

CLASS C · NOT AN AUDIT EVENT AT ALL
   health checks · ordinary reads · provider timeouts · cache misses
   ── Stage 18 §29's metrics and logs
```

### 12.1 The class is decided by what is technically possible, and Class A is the default

**AUD-D062 · The Class A test, and the direction the draft had backwards**

```
IS THE ACT ONE TRANSACTION IN OUR OWN POSTGRESQL?
   YES  ──►  CLASS A.  The audit INSERT joins that transaction.
   NO   ──►  CLASS B.  It cannot join a transaction that does not exist.
```

**The draft asserted that "making every event Class A would make the product fragile — an audit hiccup
would stop a teacher marking a hand-over." That reasoning is withdrawn, because it is wrong.** The
audit insert is an ordinary `INSERT` into the same database, in the same transaction, over the same
connection as the hand-over row. **There is no independent hiccup to have.** If PostgreSQL is
available, both writes succeed; if it is not, the hand-over was never going to be recorded either. The
fragility being imagined belongs to an *external* sink — Sentry, a log service, a queue — and
**AUD-D019 already forbids all of those inside a transaction.**

**So the closed, short, justified list is the Class B list, not the Class A one.** 81 of the 102
events are Class A. **21 are not, and each one has a stated reason:**

| AET | Event | Class |
|---|---|---|
| **AET-001** | `auth.sign_in.succeeded` | **B** |
| **AET-002** | `auth.sign_in.failed.classified` | **B** |
| **AET-003** | `auth.account.locked` | **B** |
| **AET-010** | `session.revoked` | **B †** |
| **AET-017** | `context.switched` | **B** |
| **AET-024** | `school.purge_executed` | **A ‡** |
| **AET-025** | `tenant.onboarding.state_changed` | **B** |
| **AET-027** | `support.engagement.closed` | **B** |
| **AET-029** | `breakglass.elevation.requested` | **B** |
| **AET-031** | `breakglass.operation.performed` | **A / B §** |
| **AET-032** | `breakglass.elevation.ended` | **B** |
| **AET-055** | `integration.credential_reference.rotated` | **B ¶** |
| **AET-056** | `integration.suspended_or_resumed` | **B** |
| **AET-057** | `provider_event.rejected` | **B** |
| **AET-058** | `privacy.request.received` | **B** |
| **AET-060** | `privacy.export.produced` | **B ¶** |
| **AET-061** | `privacy.export.accessed` | **B** |
| **AET-064** | `privacy.erasure.completed` | **B ¶** |
| **AET-066** | `retention.deletion.executed` | **B** |
| **AET-100** | `job.run.recorded` | **B** |
| **AET-101** | `settlement_signal.received` | **B** |

**AUD-D063 · A non-transactional privileged operation is recorded as a pair, never as a single
best-effort event**

Some break-glass operations are genuinely not transactional — a maintenance statement that cannot run
inside a transaction block, an operation whose effect is visible before any commit. **Making the
outcome event Class A would be a promise the database cannot keep; making it merely Class B would leave
no record at all if the process died mid-operation.**

```
BEFORE   AET-031 intent      Class A, its own committed transaction
                             WHO · WHICH ELEVATION · WHAT IS ABOUT TO RUN · REASON
                             the operation does not start until this commits

AFTER    AET-031 outcome     Class B, immediately, linked by business_act_key
                             WHAT HAPPENED · affected counts · outcome

MISSING OUTCOME              an intent with no outcome is ITSELF the alert (§30)
                             ── it is the signature of a privileged operation that
                                did not finish, which is exactly what you want to see
```

**AUD-D019 · No external call is ever inside a Class A transaction.** No Sentry, no log sink, no email,
no provider. Stage 18 OPS-P6 and Stage 17 INTAR-004. **A monitoring provider must never be able to roll
back a settlement.**

---

## 13. I-2 audit

**AX-4 · I-2, completed**

```
                    ONE TRANSACTION · ONE COMMIT
  AUTHORITATIVE BUSINESS WRITES     settlement_reviews · allocations · stock_movements
  PROJECTION WRITE                  stock_levels          conditional UPDATE
  REQUIRED NOTIFICATION FACT        notifications         MOD-009
  REQUIRED AUDIT FACT               audit_events          MOD-013 · AET-035 · CLASS A
                                                          ← DBT-079, defined at §7
  NO provider call · NO log sink · NO Sentry · NO email
```

**AUD-D020 · Stage 18's deferred audit fact is now defined, and the invariant is unchanged**

Stage 18 §9.1 wrote *"REQUIRED AUDIT FACT — MOD-013, same transaction, physical shape is Stage 19's."*
**This is that shape: DBT-079, AET-035, Class A.**

**MOD-013 owning the evidence does not make it an owner of settlement.** MOD-007 decides; MOD-013
records that the decision was made, by whom, under which authority. **The distinction matters because a
module that owned both would be able to change the record of its own act.**

**And the inverse holds, which is why DBI-034 is not an idempotency key.** MOD-013 records that a
settlement was confirmed; **it does not decide whether a settlement may be confirmed twice.** That
invariant stays in MOD-007, on DBI-014 — §6.3.

**AUD-D021 · If audit persistence is unavailable, the settlement fails**

```
Sentry unavailable          ⇒  I-2 commits                    audit is not Sentry
log sink unavailable        ⇒  I-2 commits                    a log is disposable
email provider unavailable  ⇒  I-2 commits                    Stage 18 OPS-D038
AUDIT INSERT FAILS          ⇒  I-2 ROLLS BACK                 AD-026 · Class A
```

**That is the intended asymmetry.** A settlement whose evidence could not be written is a settlement
nobody can later account for — and for a financial act against a child's record, **not recording it is
worse than not doing it.**
---

## 14. Security events, and where they differ from audit

**AX-5 · One occurrence, possibly two outputs — never one store doing both**

| Occurrence | Audit event | Security alert | Metric | Log |
|---|---|---|---|---|
| five failed logins for one account | **no** | **yes** | **yes** | yes |
| account locked by the limiter | **AET-003** | **yes** | yes | yes |
| one recovery code used | **AET-009** | **yes** | yes | yes |
| MFA disabled | **AET-008 · Class A** | **yes** | yes | yes |
| break-glass elevation granted | **AET-030 · Class A** | **yes** | yes | yes |
| an RLS policy denial | **no** | **YES — a layer above the database failed** (Stage 16 SECAR-046) | yes | yes |
| a Sentry exception | **no** | maybe | yes | yes |
| provider callback signature failure | **AET-057** | **yes** | yes | yes |
| finance confirmed a settlement | **AET-035 · Class A** | no | yes | yes |
| a cache miss · a health check | **no** | no | yes | maybe |

**AUD-D022 · An individual failed login is a metric, not an audit event**

Auditing every failed attempt would fill the trail with noise generated by attackers rather than by
people, **and the signal — that an account was locked, or that a recovery code was consumed — would be
buried in it.** Stage 18 §29 already counts failures per account and per IP. **The audit event is the
consequence, not the attempt.**

**AUD-D023 · A context switch is audited on EVERY switch — a correction to this document's draft**

The draft said *"a context switch is audited only where it is consequential… a teacher moving between
two of their own classes is not."* **That is not Stage 19's call to make.** Locked Stage 7 marks
**CAP-039 `switch_context` — any context · SC-5 · AUDIT**, without qualification, and BR-015 requires
switches to be audited with simulated switches distinguishable from real ones.

```
AET-017 context.switched     scope_kind = 'identity'     Class B
                             from_context · to_context · simulated flag
                             EVERY switch, because a locked stage says every switch
```

**The volume objection does not survive contact with the numbers.** A context switch is a deliberate
human act, not a page load; a person performs a handful a day. **AUD-D007's read-auditing argument does
not transfer to it**, and a policy gate here would have quietly narrowed a locked requirement — the
thing this restructure exists to stop.

---

## 15. Authority changes

**AUD-D024 · An authority change records the grantor, the grantee, the authority and the scope — and is
Class A**

`actor_person_id` is the grantor; `subject_type = 'person'` is the grantee; the authority granted or
revoked and its school are in the AET's allowlisted metadata. **BR-016 (nobody changes their own
authority) and BR-017 (platform authority is not grantable from the application) are enforced by
capability, and the audit event is what makes a violation attempt visible after the fact.**

---

## 16. Finance

**AUD-D025 · Finance events record the amount, the currency and the reason where discretionary**

```
AET-034 funding_adjustment.authorised     amount · kind · REASON REQUIRED
AET-039 replacement.charge_decided        decision · amount or absorb · REASON REQUIRED
AET-035 settlement.confirmed              the requirement item · the money applied · Class A
```

**Stage 7's requirement 1 — a discretionary action carries a reason — is enforced by §7's CHECK**, so a
waiver with no reason cannot be recorded rather than merely being discouraged.

---

## 17. Fulfilment

**AUD-D026 · Fulfilment audit records the act; custody remains the evidence chain**

`custody_events` and `handover_events` **are** the chain (Stage 15 §22.3). The audit event records
**who recorded the hand-over, under which capability, and whether CD-5's own-child block was engaged**
— a fact the custody row does not carry and which a dispute would need.

---

## 18. Imports

**AUD-D027 · An import commits one audit event, not one per row**

A 300-row enrolment import produces **AET-047 once**, with row counts and **`import_session_id`** in
allowlisted metadata. **The key is `import_session_id`, never `session_id`** — a correction to the
draft's naming: `session_id` in this system means an authentication session (DBT-075), and reusing it
for an import batch would make two unrelated things look like one field in every query, every export
and every log line. **The per-row detail lives in the import staging tables (DBT-072 … DBT-074),
whose retention Stage 18 OPS-D058 sets at seven days** — and audit does not copy them out to survive
that window, because doing so would defeat the deliberately short life of the densest personal-data
store in the system (Stage 16 SECAR-039).

---

## 19. CMS

**AUD-D028 · Publication is Class A**

`AET-051 cms.revision.published` commits with the pointer move (Stage 15 DBD-037, Stage 18 OPS-D047).
**The public site changing is a consequential act with an external audience**, and it is one `UPDATE`,
so sharing its transaction costs nothing.

---

## 20. Platform lifecycle

**AUD-D029 · Purge eligibility is read from DBT-002 `school_lifecycle_events`, and from nothing else**

**A correction to this document's draft, which had the audit event owning eligibility.** It does not,
and it must not — **the locked schema already has an authoritative lifecycle fact for exactly this.**

```
DBT-002  school_lifecycle_events    school_id NOT NULL · APPEND-ONLY
         suspend · archive · restore · DELETION_REQUESTED · deleted · PURGED
         ── this is the record DM-054 is talking about, and it is MOD-012's
```

DM-054 — *"Purge eligibility is read from this record — it is load-bearing, not just a log"* — is a
statement **about the lifecycle record**, and the draft misread it as licence to make the audit event
load-bearing instead. **The three candidates were considered and two are rejected:**

| Candidate | Verdict |
|---|---|
| **DBT-002 `school_lifecycle_events`** | **SELECTED.** It already exists, already holds `deletion_requested` and `purged`, is already append-only, and is already MOD-012's |
| the audit event (AET-023) | **REJECTED.** It would make MOD-013's evidence a business precondition — the exact inversion AUD-D020 refuses for I-2 |
| DBT-080 `console_operations` | **REJECTED.** A third authority for one concept, invented by this stage, duplicating DBT-002 |

```
ONE CONCEPT, ONE OWNER
   DBT-002 lifecycle row  ──►  the cooldown clock and the eligibility test    MOD-012 · authoritative
   AET-023 audit event    ──►  WHO requested it, under which authority, why   MOD-013 · evidence
   AET-024 audit event    ──►  WHO executed the purge, and that it happened   MOD-013 · evidence
```

**The purge command reads DBT-002. It never reads `audit_events` to decide whether it may run.** If
the two ever disagree, the lifecycle row is right about eligibility and the audit trail is right about
accountability — **and because neither is derived from the other, a disagreement is itself detectable
rather than silently reconciled.**

**AET-024 is Class A bound to the terminal lifecycle transaction** — the batch work is operational
progress, but the moment DBT-002 records `purged` is one transaction, and the evidence commits with it
(§8.10 footnote ‡).

---

## 21. Support

**AX-6 · A support action, fully recorded**

```
AET-028 support.action.performed
   actor_kind             person
   actor_person_id        the PLATFORM person — never the school's
   actor_authority        AUTH-PLATFORM
   support_engagement_id  DBT-067 · DBI-024 — one engagement at a time, across all tenants
   scope_kind             'school'  + school_id   ← the tenant it acted on
   capability_id          CAP-088 typed operation · or CAP-089 read-only query
   subject_*              what was reached
   outcome · reason       the engagement's reason travels with every action
```

**AUD-D030 · A support engagement never makes the actor a member of the tenant.** `actor_person_id`
remains the platform person and `actor_authority` remains AUTH-PLATFORM. **A support action must never
be readable later as "the school's administrator did this."**

---

## 22. Break-glass

**AX-7 · Break-glass**

```
AET-030 elevation.granted    actor · REASON (≥20 chars, Stage 16) · granted_at · expires_at
                             the FRESH-AUTH FACT — that a current TOTP was presented and
                             verified.  NEVER THE CODE ITSELF.
                             ── THIS EVENT IS THE ELEVATION RECORD.  There is no elevation
                                table, and AUD-D058 explains why none is invented.
AET-031 operation.performed  every elevated write, each carrying elevation_event_id → AET-030
                             ── FK-A6, a self-reference · CK-B2 makes it mandatory at the
                                breakglass tier
AET-032 elevation.ended      expiry or explicit end, with the reason
```

**AUD-D031 · The fresh-authentication fact is recorded; the credential is not.** `mfa_verified_at` as a
boolean-and-timestamp, never the six digits. **AUD-P4, and Stage 16's C-21 makes the point sharply: the
secret behind that code is currently in plaintext, and audit must not become a second place it
appears.**

**AUD-D032 · An elevation with no operations is still recorded.** Someone elevating and doing nothing is
information — Stage 16 SECAR-020: *"an elevation nobody notices is not a control."*

---

## 23. Integration and provider audit

**AUD-D033 · Configuration acts are audited; successful deliveries are not**

```
AUDITED    integration.configured                    AET-054 · Class A
           credential_reference.rotated              AET-055 · Class A — the REFERENCE
           integration.suspended_or_resumed          AET-056 · school-scoped only
           provider_event.rejected                   AET-057 · authenticity or REPLAY failure

NOT AUDITED
           every successful delivery attempt         ── DBT-054 is the history
           every accepted provider callback          ── DBT-041 is the history
           provider timeouts                          ── Stage 18 metrics
```

**A successful callback is domain history (DBT-041), not an audit event** (AUD-D001). **A rejected one
is a security event**, because a signature failure or a detected replay is somebody probing.

**AUD-D034 · A raw provider payload never enters audit.** Stage 17 INT-P8 and AUD-P18. The
`provider_event` row holds the bounded record; the audit event holds the *rejection* and its
classification.

**AUD-D035 · `integration.suspended_or_resumed` is school-scoped only.** Stage 18 OPS-D070 established
that a platform provider has no DBT-040 row and no `integration.state`. **Auditing a suspension that
does not exist would be recording a fiction**; platform provider degradation is a health condition and
an alert (Stage 18 §22).

---

## 24. Privacy, DSAR and the erasure tension

**AUD-D036 · The privacy event set**

| AET | Event | Class | Why |
|---|---|---|---|
| **AET-059** | `privacy.request.accepted` | **A** | a human decision, one transaction |
| **AET-060** | `privacy.export.produced` | **B ¶** | **the export object completes asynchronously — there is no transaction to join** |
| **AET-061** | `privacy.export.accessed` | **B** | the download is itself recorded, outside any write transaction |
| **AET-062** | `audit.exported` | **A** | the export *request* and its authority check are one transaction — AUD-P15 |
| **AET-063** | `privacy.erasure.initiated` | **A** | a human decision, one transaction |
| **AET-064** | `privacy.erasure.completed` | **B ¶** | **an erasure job spanning many tables is not one transaction** |
| **AET-065** | `privacy.retention_exception.recorded` | **A** | a legally required preservation, recorded as a decision |
| **AET-066** | `retention.deletion.executed` | **B** | operational deletion by a scheduled job (Stage 18 OPS-D060) |

**Four of the draft's Class A marks here were not technically possible, and §8.10's matrix is what
caught it.** An export object becoming available in provider storage, and an erasure job walking many
tables, **cannot commit with a transaction that does not exist** — AUD-D062. Marking them Class A
would have been a promise the database could not keep, which is worse than an honest Class B whose
failure is itself an alert.

**AUD-D037 · The tension is real and is stated, not resolved by asserting one side**

```
IMMUTABILITY      an audit event is evidence; rewriting it destroys its value       AUD-P10
ERASURE           a person may have a right to have personal data removed
                  ── AD-027 already records these as "in genuine tension, unresolved"
```

**Stage 19 decides the technical capability. It does not decide who wins.**

| Capability | Provided |
|---|---|
| **subject reachability** | every event's subject and actor are identifiers, so **every event concerning a person can be found** — the precondition for any erasure answer |
| **selective pseudonymisation** | `actor_person_id` and `subject_id` can be replaced by a stable pseudonym **where approved policy permits**, preserving the shape of the trail |
| **display-snapshot removal** | the optional actor display name (AUD-D010) is removable independently |
| **event preservation** | the act, its time, its capability and its outcome survive pseudonymisation — **the evidence that something happened is not destroyed by removing who** |
| **controlled exceptional deletion** | a separate privileged path (§25), audited by AET-065, never reachable from application code |

### 24.1 How pseudonymisation is physically done

**AUD-D064 · The pseudonym is an opaque reference in its own column — never a fabricated `persons` row**

```
BEFORE    actor_kind = 'person'   actor_person_id = <FK to persons>   actor_pseudonym_ref = NULL
                                  subject_identity_state = 'identified'

AFTER     actor_kind = 'person'   actor_person_id = NULL              actor_pseudonym_ref = <opaque>
                                  subject_identity_state = 'pseudonymised'

          CK-A4 holds throughout:  a person event identifies its person by ONE of the two.
```

**The rejected alternative is the one that looks easiest.** Creating a placeholder `persons` row to
hold the pseudonym — a "deleted user" record — would put a fiction into the authoritative person table
that **every join, every count, every export and every RLS policy in the system would then treat as a
person.** Stage 15 owns `persons`, and Stage 19 does not get to add inhabitants to it for its own
convenience.

| Property | Consequence |
|---|---|
| **the pseudonym is stable per person** | *"the same actor did these eleven things"* survives erasure |
| **it is opaque** | it is not derived from the name, the email or the id, so it cannot be reversed by guessing |
| **the mapping is not in `audit_events`** | **whether a re-identification mapping is retained at all is POLICY, not architecture** — if policy says the link must be irrecoverable, no mapping is kept and the pseudonym is terminal |
| **FK-A2 is RESTRICT, never CASCADE** | a `persons` delete cannot silently take evidence with it; pseudonymisation is a deliberate act, not a side effect |
| **`actor_pseudonym_ref` carries no FK** | it points at nothing this schema owns, **by design** — a table to point at would be the re-identification mapping, and this stage does not create one |

**AUD-D038 · Pseudonymisation is the mechanism precisely because it separates the two questions.**
*Did a settlement get confirmed on 3 September, under AUTH-FINANCE, for requirement item X?* remains
answerable. *Which named person did it?* becomes answerable only through a mapping that policy may
require to be broken. **That is the most that can be offered without choosing between the obligations,
and choosing is not this stage's to do.**

**AUD-D039 · Retention: POLICY INPUT REQUIRED**

```
audit event retention period                        POLICY INPUT REQUIRED
which audit events may lawfully be erased           LEGAL — AD-027 · C-79
which must be preserved despite an erasure request  LEGAL
```

**This document states no number of years for any audit record**, and A16-002.2 assigns that to
qualified legal / controller-approved policy. **C-79 — erasure against financial retention — remains
open and unresolved, and now has an audit dimension: the evidence of a financial act may outlive the
financial record's own retention.**

---

## 25. Immutability

**AUD-D040 · Immutability is a database privilege, plus a refusal trigger — and nothing more exotic**

```
APPLICATION ROLE      INSERT + SELECT on audit_events           ── as authorised
                      NO UPDATE · NO DELETE                     ── revoked at the role level
TRIGGER               a BEFORE UPDATE OR DELETE trigger that RAISES
                      ── defence in depth: a privilege change does not silently
                         re-enable mutation
CORRECTION            append another event                       AUD-P10
PRIVILEGED PATH       migration and legally-required erasure, under a separate role,
                      audited by AET-065, never reachable from application code
```

**Two mechanisms, because they fail differently.** A revoked privilege is bypassed by a privilege
change; a trigger is bypassed by a superuser dropping it. **Neither alone is sufficient, both together
make ordinary application mutation impossible**, which is the stated goal (AUD-P11).

**AUD-D041 · No blockchain, hash chain or external ledger — and here is exactly what one would and
would not solve**

| Threat | Does a hash chain solve it? |
|---|---|
| application code updating an event | **no — already solved** by AUD-D040, more simply |
| a developer with production access editing a row | **partially** — the chain breaks, so tampering becomes *detectable*, not *impossible* |
| **a database administrator rewriting the chain** | **NO.** Whoever can rewrite rows can recompute the hashes. **This is the honest limit** |
| a compromised backup restored over the trail | no |

**A hash chain answers "was this tampered with?" only against an actor who cannot also recompute it —
which, for a self-hosted chain, is nobody with database administration rights.** Making it meaningful
requires an *external* anchor, which is a new sub-processor, a new failure mode and a new cost.

**No evidence-backed requirement for that exists.** **AUD-P22: it is not built.** If one later emerges
— an insider-threat finding, or a regulator asking for it — it is a traceable amendment with the threat
named, **not a default.**

---

## 26. Data minimisation

**AUD-D042 · Before/after values are decided per event, and never copied wholesale**

| Class | Rule | Example |
|---|---|---|
| **NO VALUES** | the action identity is enough | `session.revoked` · `support.engagement.opened` |
| **KEY BUSINESS CHANGE** | **allowlisted changed fields only** | `authority.granted` → the authority and its scope |
| **MONEY** | amount, currency, reason where necessary | `funding_adjustment.authorised` |
| **STATUS / LIFECYCLE** | from → to | `school.suspended` |
| **PERSONAL DATA** | **minimise aggressively** — identifiers, not records | `handover.recorded` → child id, never the child's record |
| **SECRETS** | **never** | AUD-D005 |

**A full-row snapshot of a child record in an audit event is rejected outright.**

**AUD-D043 · The console snapshots are replaced by a bounded change description**

**The current `beforeSnapshot` / `afterSnapshot` (AUD-F05, C-101) have no place in the target shape.**
The 64 KB cap bounds size, not content — and for a typed support operation the content is rows about
children.

**That is a decision about the future shape only.** The snapshot values that already exist in
production are governed by **§7.3 — LEGACY SNAPSHOT DISPOSITION → POLICY INPUT REQUIRED**, and
**MIG-14 must not destroy them merely because the new schema no longer wants them.**

```
REPLACED BY   the operation name (typed, from the catalogue)
              the table and the affected row identifiers
              row_count
              an ALLOWLISTED changed-field list per operation — field NAMES and, where
                the operation's own definition permits, bounded values
              NEVER an arbitrary JSON dump of whatever was touched
```

**The allowlist lives with the typed operation's definition**, which is exactly why Stage 14 made
support operations *typed* (CAP-088) — **a typed operation knows which fields it changes, so its audit
detail can be specified before it ships.** A general SQL console cannot, which is a further argument
for the tiering Stage 16 preserved.

**AUD-D044 · `safe_metadata` is allowlisted per AET, and the allowlist is part of the AET definition**

An unbounded `jsonb` on an append-only table is **a personal-data store with no schema and no
minimisation review** — and immutability makes it permanent. **A key not on its AET's allowlist is
rejected at write time**, not filtered at read time.

**AUD-D045 · Message audit records identifiers and acts, never content**

Reviewing `message_audit_logs`: **it already stores no message body** — `thread_id`, `actor_user_id`,
`action`, `reason`. **That is correct and it is preserved.** The canonical model does not add content.

```
PROVING "a message was sent"           thread id · actor · time · action     SUFFICIENT
PROVING "a message was deleted"        the same, plus a reason               SUFFICIENT
PROVING "thread membership changed"    the same                               SUFFICIENT
```

**If safeguarding policy ever requires preserving message content, that is a separate legal and product
retention decision with its own lawful basis** — **it is not smuggled in through audit architecture**,
and this document does not provide for it.

---

## 27. Audit read access

**AUD-D046 · Mapped from the locked CAP catalogue — and the catalogue does not contain what is needed**

**CAP-001 … CAP-095 were searched. There is no `view_audit` capability of any kind.** The nearest are
**CAP-085 `view_platform_state`** (AUTH-PLATFORM · SC-7) and **CAP-089 `run_readonly_query`** (the
console read tier).

| Audit view | Capability | Status |
|---|---|---|
| platform audit | **CAP-085 `view_platform_state`** | ✔ **exists and is already surfaced** — ROLE_EXPERIENCE **UX-099 Platform audit trail · `admin/activity` · KEEP** |
| console / support audit | **CAP-089 `run_readonly_query`** through the read tier | ✔ exists · UX-095 / UX-096 |
| **a school seeing support activity inside its own tenant** | — | **NO CAPABILITY EXISTS — and Stage 16 SECAR-018 requires the view** |
| a school's general audit console | — | no capability, **and no screen in ROLE_EXPERIENCE** |
| a finance-scoped audit console | — | no capability, **and no screen in ROLE_EXPERIENCE** |
| audit **export** (AET-062) | — | **OPEN — §29.1** |

**The last three rows are not the same kind of gap as the third, which is why A7-001 covers only one of
them.**

**AUD-D047 · A7-001 is ONE capability, and it exists because a LOCKED stage requires the view — not
because DBT-079 now exists** *(corrected in place — the identifier is stable)*

**A correction to this document's draft, which proposed two broad new capabilities — `view_school_audit`
and `view_finance_audit` — on the strength of the audit table existing.** That is the wrong direction of
travel. **A new customer-facing audit feature is a product decision, and "we built a table" is not
evidence that anyone asked for it.**

The evidence test applied to each candidate:

| Candidate | Locked evidence requiring it | Verdict |
|---|---|---|
| **a school seeing support activity in its own tenant** | **Stage 16 SECAR-018 — locked**: *"support that a tenant cannot see is indistinguishable from a breach, from the tenant's point of view."* AUD-D016 already makes the events dual-scoped; **without a capability the requirement cannot be met at all** | **A7-001** |
| a general school audit console | **none.** ROLE_EXPERIENCE has no such screen; MOD-013 is recorded there as **"COMPOSED + INTERNAL … No 'audit settings' screen"** | **DEFERRED — not proposed** |
| a finance audit console | **none.** No screen, no locked requirement, no owner request | **DEFERRED — not proposed** |

```
A7-001 · REQUIRED — a Stage 7 amendment, raised here, minted there
   view_school_support_activity     AUTH-SCHOOL · SC-1 · CD-1 · AUDIT
   SCOPE   support-attributed events inside the reader's own school:
           events where support_engagement_id IS NOT NULL AND school_id = <tenant context>
   NOT     the school's general audit trail
   NOT     other schools, ever
   NOT     identity-scoped events — §11.1 keeps an account's own history out of a tenant
   WHY     Stage 16 SECAR-018, locked

   CAP IDENTIFIER: NOT MINTED HERE.  Stage 7 owns the vocabulary; the next free
   number is CAP-096, and Stage 7 assigns it.
```

**Narrower than the draft on purpose.** A capability that returns only support-attributed events cannot
become a general audit console by accident, and if the owner later wants one, that is a product
decision with its own evidence — **which is a much easier conversation to have than un-shipping a broad
read capability that turned out to be a data-protection surface.**

**It is explicitly NOT solved by "an admin role may see all audit."** Stage 7's whole model is that a
capability is the unit of authority, and **SECAR-007 forbids satisfying a capability check with a role
string.** Adding an audit view by widening a role would undo that in the one place it matters most.

**AUD-D048 · Teachers, guardians and children get no audit console**

```
GUARDIAN    no audit view. Their own settlement position is CAP-057, a product surface.
TEACHER     no audit view. Their class fulfilment facts are CAP-041 · SC-3.
CHILD       has no account at all                        Stage 16 SEC-D070
```

**AUD-P14: audit read access is narrower than operational access.** A teacher who may record a
hand-over does not thereby gain the right to read who else recorded one.

---

## 28. Query and index strategy

**AUD-D049 · The canonical filter set, and nothing outside it**

```
time range (occurred_at)  ·  event kind (action_key)  ·  actor  ·  subject
school (where authorised) ·  correlation_id  ·  capability  ·  outcome
```

**Cursor-paginated** (Stage 14, Stage 15 DBD-039), with a total sort order ending in the primary key.

```
NOT PROVIDED   arbitrary SQL           ── the console's read tier is separate, CAP-089
               full database search
               free-text search over safe_metadata
```

**Free-text search over audit metadata would be a search engine over children's identifiers**, and
Stage 16 SECAR-044's reasoning applies: the capability's existence is the exposure.

**AUD-D050 · Indexes are specified with the amendment, not added speculatively**

**A15-003 carries them, because they are part of the table's definition rather than tuning.** The
authoritative list is **§7.1's eight supporting indexes**, and this section does not restate a second
version of it — **two lists of indexes is how two lists of indexes come to disagree.** Every one leads
with the predicate its canonical filter uses; the school-scoped one leads with `school_id` per Stage 15's
IX-1; and the platform and school trails are **separate partial indexes** so that `scope_kind` is a
predicate rather than a leading column.

---

## 29. Audit export

**AX-8 · Export**

```
request  →  capability check   ── platform: CAP-085
                               ── school:   OPEN, §29.1 — NOT A7-001's
         →  202 + a durable job                              Stage 18 OPS-D017
         →  the result written to a PRIVATE object            PRV-004
         →  a SHORT-LIVED SIGNED URL, after an authority check   Stage 16 SEC-D049
         →  AET-062 audit.exported  ── Class A                AUD-P15
         →  AET-061 on access       ── the download is recorded too
```

**AUD-D051 · No public URL. No email attachment containing an audit export.** Stage 16 SEC-D026: a
signed URL is a bearer credential and is never logged, never emailed as a retained artefact.

**AUD-D052 · The export is scoped to what the requester may read.** A school administrator's export
contains that school's events. **There is no "export everything" that is not a platform capability**,
and that one is itself audited.

### 29.1 School-side audit export needs its own capability — OPEN

**AUD-D065 · Reading and exporting are not the same authority, and A7-001 deliberately does not cover
both**

```
READ    a bounded, paginated, capability-gated view inside the product
        the reader sees what they may see, while they are looking at it

EXPORT  a FILE.  It leaves the product, leaves the session, leaves every control
        the product has, and lands somewhere with its own lifetime
        ── Stage 16 SEC-D049 · AUD-D051 · AUD-R11 "audit export leakage: HIGH"
```

**Treating export as a mode of read is how a HIGH risk gets granted by implication.** Stage 7 already
separates capabilities on exactly this kind of line — CAP-032 is separate from CAP-031 because *the act
that makes an administrator also finance* deserves its own decision.

```
OPEN — A STAGE 7 QUESTION, NOT ANSWERED HERE
   Does school-side audit export exist at all?  ── PRODUCT DECISION, no locked evidence requires it
   If it does, it needs its own capability      ── NOT satisfied by A7-001
   AET-062 is defined either way, so that IF an export is ever built it cannot ship unaudited
```

**Until that is answered, there is no school-side audit export.** AET-062's capability column reads
`OPEN` in §8.10's matrix rather than borrowing A7-001's — **a borrowed capability is an ungoverned one.**

---

## 30. Failure behaviour

| Failure | Consequence |
|---|---|
| **Class A audit INSERT fails** | **the business transaction ROLLS BACK** — AD-026, AUD-D021 |
| Class B audit write fails | **the failure is itself an alert** (Stage 18 §29); the act stands, and the gap is visible |
| audit export job fails | business truth unaffected; the export job is `failed` and retryable |
| the security-alert channel fails | **the durable audit fact remains** — the alert is a notification, not the record |
| Sentry unavailable | **audit is unaffected** — AUD-D002 |
| the audit read path is slow | reads degrade; **writes are unaffected** |
| **a privileged operation's intent event has no matching outcome** | **the missing outcome IS the alert** — AUD-D063. It is the signature of an elevated operation that did not finish |
| **a `safe_metadata` key is not on its AET's allowlist** | **the write is REJECTED** (AUD-D044) — for a Class A event that means the business transaction rolls back, which is the correct outcome for code trying to store something nobody reviewed |

**AUD-D053 · No availability loop is created.** **No external provider is required for a database
transaction to commit.** Sentry, the alerting channel and the email provider are all outside every
Class A transaction (AUD-D019). **An audit design that made a monitoring vendor load-bearing for
settlement would have inverted the entire point.**

---

## 31. Retention policy boundary

**AUD-D054 · What Stage 19 sets, and what it refuses to**

| | |
|---|---|
| **Stage 19 sets** | the *capability* to find, pseudonymise, preserve and exceptionally delete; the audit trail's own storage shape and index strategy |
| **Stage 18 sets** | nothing here — its OPS-D058 windows are operational records, and audit is not one |
| **APPROVED POLICY / LEGAL sets** | **the retention period** · which events may lawfully be erased · which must be preserved despite an erasure request · the lawful basis for keeping any of it |

**POLICY INPUT REQUIRED** for every audit retention period. **A16-002.2 is controlling and this stage
does not exceed it.**

---

## 32. Current → target map

| Current | Target | Note |
|---|---|---|
| `audit_logs` | **DBT-079 `audit_events`** | data migrated at MIG-07; dropped at MIG-14 |
| `message_audit_logs` | **DBT-079** | **the easiest migration — it already has `school_id` and an actor FK** |
| `console_audit` — attribution columns | **DBT-079 `audit_events`** · MOD-013 | who, context, authority, capability, outcome |
| `console_audit` — operational columns | **DBT-080 `console_operations`** · **MOD-012** | typed operation, tier, target, elevation link — **DM-054 stays where Stage 8 put it** (§6.2) |
| `console_audit` — `statement`, `params` | **not carried forward** | AUD-D043 |
| `console_audit` — `beforeSnapshot`, `afterSnapshot` | **DISPOSITION UNDECIDED — §7.3** | **POLICY INPUT REQUIRED · MIG-14 must not destroy them by default** |
| **DBT-002 `school_lifecycle_events`** | **unchanged — it is not audit** | **it owns purge eligibility, and AUD-D029 leaves it there** |
| support-mode logging | **AET-026 … AET-028** | |
| auth logging | **AET-001 … AET-010**, with the read-audit rule of AUD-D007 | |
| payment audit | **AET-033 … AET-039** | |
| **`stock_movements` · `custody_events` · `money_events` · `handover_events`** | **DOMAIN HISTORY — NOT audit** | **they stay exactly as Stage 15 defines them.** Audit records the human act beside them |
| CMS change logging | **AET-050 … AET-053** | |
| technical `console.*` output | **TECHNICAL LOG** | Stage 18 §29 |
| `provider_events` · `delivery_attempts` | **DOMAIN HISTORY** | only rejections are audited (AET-057) |

**AUD-D055 · Domain history is never replaced by audit.** The instruction's own warning, restated
because it is the easiest mistake to make when designing an audit system: **`stock_movements` are not
audit rows, and turning them into audit rows would destroy the projection Stage 15 built on them.**

---

## 33. Findings — AUD-F01 … AUD-F07

Recorded at §3. **All E2.**

| AUD-F | Finding | Becomes |
|---|---|---|
| **F01** | `audit_logs` has no tenant column | **C-65**'s audit instance — **no new identifier** |
| **F02** | `audit_logs.userId` has no foreign key | AUD-D009 |
| **F03** | `metadata` is `text`, not `jsonb` | AUD-D044 |
| **F04** | consequential audit is best-effort | **C-102** |
| **F05** | console audit stores before/after row snapshots | **C-101** |
| **F06** | three stores, no shared identity or taxonomy | **C-100** |
| **F07** | some consequential acts are unaudited — **extent not enumerated** | a named method for Stage 22, not a count asserted here |

---

## 34. Decisions — AUD-D001 … AUD-D065

| AUD-D | Subject | § |
|---|---|---|
| 001–002 | domain history is not audit; Sentry is never the audit store | 5 |
| **003–006** | **one canonical `audit_events`; the event shape; the prohibited list; the console operation record stays MOD-012's and is LINKED, not merged** | 6 |
| **056–057** | **audit dedup is dedup of EVIDENCE, never business idempotency; `reason_policy` is a stored column checked in both directions** | 6.3–6.4 |
| **058–059** | **elevation is a self-reference to the granting event, not an invented table; LEGACY SNAPSHOT DISPOSITION → POLICY INPUT REQUIRED** | 7.1, 7.3 |
| 007 | **reads are not audited by default** — a small deliberate set | 8 |
| 008–011 | three actor kinds; the person FK is the key; a narrow display snapshot; **context and authority are two fields (PA-1)** | 9 |
| 012–013 | the subject is resolved, never claimed; one primary subject | 10 |
| **060** | **actor, authority and capability are nullable, and CK-A4 … CK-A7 make every absence honest — no invented person, no invented CAP** | 9.1 |
| **014–017 · 061** | **three `scope_kind` values, never a NULL meaning global; three policy classes (FAMILY-RELATED withdrawn); identity scope is least-privilege; support is visible to its school; no anonymous actor** | 11 |
| **018–019 · 062–063** | **Class A is the DEFAULT and the closed list is the Class B one; the class is decided by what is technically possible; a non-transactional privileged operation is a PAIR; no external call inside a Class A transaction** | 12 |
| **020–021** | **I-2's audit fact is DBT-079/AET-035, Class A; audit failure rolls I-2 back, Sentry failure does not** | 13 |
| 022–023 | a failed login is a metric; a context switch is audited where consequential | 14 |
| 024–027 | authority, finance, fulfilment and import events; **an import is one event, not one per row** | 15–18 |
| 028–029 | publication is Class A; **purge eligibility is readable because the fields are typed** | 19–20 |
| 030–032 | support never becomes the tenant's own act; the fresh-auth **fact**, never the code; an empty elevation is still recorded | 21–22 |
| 033–035 | configuration is audited, deliveries are not; no raw payloads; **no fictional platform-provider suspension** | 23 |
| **036–039 · 064** | **the privacy event set with four Class A marks corrected to B; the tension stated; pseudonymisation as the mechanism; the pseudonym is an opaque column, NEVER a fabricated `persons` row; POLICY INPUT REQUIRED** | 24, 24.1 |
| **040–041** | **privilege plus refusal trigger; no hash chain, with the honest limit stated** | 25 |
| **042–045** | **per-event value rules; the console snapshots replaced by an allowlisted change description; `safe_metadata` allowlisted per AET; message content never copied** | 26 |
| **046–048** | **no `view_audit` capability exists — A7-001 REQUIRED, and it is ONE narrow capability backed by locked SECAR-018, not a new audit product; the general school and finance consoles are DEFERRED; no audit console for teachers, guardians or children** | 27 |
| 049–050 | the canonical filter set; indexes ship with the amendment | 28 |
| 051–052 · **065** | no public URL, no emailed export; the export is scoped and itself audited; **export needs its own capability and it is OPEN — A7-001 does not cover it** | 29, 29.1 |
| 053 | no availability loop — no provider is load-bearing for a commit | 30 |
| 054 | the retention boundary | 31 |
| 055 | **domain history is never replaced by audit** | 32 |

---

## 35. Risks — AUD-R01 … AUD-R12

| AUD-R | Risk | Severity | Mitigation |
|---|---|---|---|
| **AUD-R01** | **Audit becomes the largest personal-data store in the system** | **HIGH** | AUD-D007 (no read auditing) · AUD-D042 · AUD-D044's allowlist |
| **AUD-R02** | PII duplication between audit and domain history | **HIGH** | AUD-D001 · AUD-D055 — audit references, never copies |
| **AUD-R03** | Over-auditing reads makes the trail unusable as evidence | **MEDIUM** | AUD-D007 |
| **AUD-R04** | **Class A audit failure blocks legitimate business acts** | **MEDIUM — ACCEPTED** | **downgraded from HIGH with the reasoning corrected.** The audit INSERT shares the business transaction's own connection and database, so it has no independent failure mode to speak of (AUD-D062); the residual is a constraint violation from a coding defect, which Stage 20 tests for |
| **AUD-R05** | **Cross-tenant audit leak** | **CRITICAL** | AUD-D014's discriminator · AUD-D015's policy classes · Stage 15 RLS |
| **AUD-R06** | Platform and support visibility is broader than schools expect | **MEDIUM** | AUD-D016 — support actions are visible to the engaged school |
| **AUD-R07** | **`safe_metadata` creep — an unbounded JSON column on an immutable table** | **HIGH** | AUD-D044 — allowlisted per AET, **rejected at write** |
| **AUD-R08** | Legal retention uncertainty leaves the trail growing indefinitely | **HIGH** | **POLICY INPUT REQUIRED** — AUD-D039 · **C-79** |
| **AUD-R09** | Pseudonymisation breaks evidential usefulness | **MEDIUM** | AUD-D038 — the act survives; only the identity is broken |
| **AUD-R10** | **A database administrator can tamper undetectably** | **MEDIUM — RESIDUAL, STATED** | AUD-D041 is explicit that no self-hosted mechanism closes this |
| **AUD-R11** | Audit export leakage | **HIGH** | AUD-D051 · signed short-lived URLs · AET-061/062 |
| **AUD-R12** | Large audit queries degrade the database | **MEDIUM** | AUD-D049's bounded filters · AUD-D050's indexes · Stage 18 §10's connection budget |
| **AUD-R13** | **An identity-scoped event leaks one person's account-security history into a school** | **HIGH** | **AUD-D061** — identity events carry no `school_id` at all, so a tenant policy has nothing to match on; the school-side view is an explicit capability-gated projection, never a row grant |
| **AUD-R14** | **The legacy console snapshots are destroyed at MIG-14 as a side effect of the new schema not wanting them** | **HIGH** | **AUD-D059 · §7.3** — MIG-14 gains an explicit precondition, and the disposition is POLICY INPUT REQUIRED |
| **AUD-R15** | **A Class B event's own write fails and the act leaves no record** | **MEDIUM — RESIDUAL** | the failure is itself an alert (§30); for privileged operations the intent/outcome pair (AUD-D063) makes the gap visible rather than silent. **21 of 102 events carry this residual, and each is listed at §8.10** |
| **AUD-R16** | **Audit export becomes a general school capability by implication** | **MEDIUM** | **AUD-D065** — export is a separate, unresolved capability question; A7-001 does not grant it |

---

## 36. Existing conflicts addressed — none closed

| Conflict | Contribution |
|---|---|
| **C-18 / BR-124** | AUD-D005's prohibited list, applied to audit specifically |
| **C-62** | structured logging with a correlation id is what links audit to logs (§6) |
| **C-65** | **AUD-F01** is its audit instance; DBT-079 has `scope_kind` + `school_id` |
| **C-73** | the console's controls still depend on an unapplied migration — **unchanged** |
| **C-79** | **AUD-D039** gives it an audit dimension: evidence may outlive the record it evidences |
| **C-21** | **AUD-D031** — audit must not become a second place the MFA secret appears |
| **AD-027's tension** | **§24** states it as capability, not as a resolution |
| **C-72** | the console's controls still depend on an unapplied migration — **unchanged, and §7.3 adds a MIG-14 precondition on top of it** |

---

## 37. New conflicts

**Verified: the last issued identifier is C-99 (Stage 18). The next is C-100. Stage 19 issues C-100,
C-101, C-102 and C-103; the next stage starts at C-104.**

**C-100 · Three independent audit stores with no shared identity or taxonomy — ACTIVE**
*Evidence:* `audit_logs` (8 columns, no tenant), `message_audit_logs` (7 columns, tenanted), and
`console_audit`, each with an independent free-text `action` and no common actor, subject or
correlation field.
*Locked requirement contradicted:* **AD-026** — *"an audit event is a product fact owned by MOD-013"*,
singular. **DM-053 records the same observation** without issuing an identifier.
*Impact:* **"everything that happened to this child" and "everything this support person did" are
unanswerable**, because no query can span the three.
*Resolution:* **AUD-D003**, **A15-003**. **Not closed.**

**C-101 · The console audit stores before/after row snapshots that can contain personal data — ACTIVE**
*Evidence:* `server/console/audit.ts` — `beforeSnapshot` and `afterSnapshot`, each capped at 64 KB,
JSON of whatever the operation touched.
*Locked requirement contradicted:* Stage 16's data minimisation (**SEC-D072**) and **AUD-P19**. The cap
bounds size; **nothing bounds content**, and the content of a typed support operation is rows about
children, guardians and payments — **stored in an append-only trail whose retention nobody has set.**
*Resolution:* **AUD-D043** — a typed operation name plus an allowlisted changed-field list. **Not
closed.**

**C-102 · Consequential audit is best-effort — ACTIVE**
*Evidence:* `auditLog()` ends `catch (e) { console.error("Audit log failed:", e) }`, and the acts
routed through it include settlement, authority changes and school lifecycle.
*Locked requirement contradicted:* **AD-026** — *"Consequential acts require their audit to share the
business outcome's fate."* **They do not share it; the audit is discarded and the act proceeds.**
*Impact:* an act can succeed with no record, and **nothing distinguishes "it did not happen" from
"it happened and was not recorded"** — which is the exact question a DPO or a regulator asks.
*Resolution:* **AUD-D018**'s Class A list, **AUD-D021**. **Not closed.**

**C-103 · Locked Stage 7's audit-required capability count disagrees with its own register — ACTIVE**
*Evidence:* PERMISSIONS.md §20 states **"58 of 95 capabilities require audit."** The per-capability
register in the same document marks **67** capabilities `AUDIT` — CAP-001, 002, 004, 005, 009, 011,
012, 016 … 035, 039, 040, 042 … 044, 047 … 056, 058 … 061, 063 … 071, 079, 082 … 084, 086 … 094.
*Locked requirement contradicted:* the two statements are in **the same locked stage** and cannot both
be right.
*Impact:* **Stage 19's draft taxonomy was built against the headline and left 33 audit-required
capabilities with no event at all** (§8). Any later stage sizing audit work from the headline
undercounts it by a sixth, and **Stage 20's coverage tests need the true number, not the stated one.**
*Which is authoritative:* **the per-capability register**, because it is what each capability's own
definition carries and the only one §8.9 can be checked against mechanically. **Stage 19 does not
rewrite the headline** — correcting a locked stage's own text is Stage 7's to do.
*Resolution:* **raised for Stage 7 as a count correction alongside A7-001. Not closed.**

**Nothing else is raised.** AUD-F02, F03 and F07 are **findings**, not conflicts — a missing foreign
key and a `text` column are shape defects the amendment fixes, and F07's extent is deliberately not
asserted. **And this document's own draft mistakes — the two-scope model, the `correlation_id`
uniqueness, the one-directional reason CHECK, the 66-event taxonomy, DBT-080's ownership, the
FAMILY-RELATED policy class, the four impossible Class A marks — are CORRECTIONS recorded in place, not
conflicts.** A conflict is a contradiction with a **locked** requirement; **a PROPOSED stage disagreeing
with an earlier version of itself is just this stage doing its job.**

---

## 38. Owner decisions required

**One, and it is not a preference — it is a disposition that only the owner can authorise.**

```
LEGACY SNAPSHOT DISPOSITION — §7.3                       POLICY INPUT REQUIRED
   The existing console beforeSnapshot / afterSnapshot values.
   RETAIN AS-IS · RETAIN REDACTED · DELETE AT MIG-14
   Stage 19 will not pick, because two of the three are legal classifications and
   the third destroys production data.
   MIG-14 IS BLOCKED ON THIS ANSWER.  Nothing else in this stage is.
```

> **ANSWERED POST-LOCK — A19-001, §42.** The owner decided **1A · QUARANTINE / PRESERVE PENDING
> POLICY** on 31 August 2026. **Stage 19's open owner questions are now 0.** The locked text above is
> left as written because it records what was true at lock; **§42 governs.** The FINAL legal
> disposition remains **POLICY INPUT REQUIRED**, which is a policy input and **not** an owner question.

**No other owner question is manufactured.**

Every other question this stage met was resolved from locked evidence:

- **Who may read school support activity** — **not an owner question.** Stage 7 owns the capability
  vocabulary and does not contain one; **A7-001 is a required amendment (AUD-D047)** because a locked
  stage (SECAR-018) requires the view, not because anyone prefers it.
- **Whether schools get a general audit console** — **not decided, and not proposed.** No locked
  evidence requires one and ROLE_EXPERIENCE has no screen for it; **it stays deferred until there is a
  product reason, which is a better conversation to have later than a read capability to withdraw.**
- **Whether school-side audit export exists** — **OPEN (AUD-D065)**, and deliberately left open rather
  than granted by implication through A7-001.
- **How long audit is kept** — **not an owner question.** **POLICY INPUT REQUIRED / LEGAL**, per
  A16-002.2. Owner intuition is the wrong instrument.
- **Whether to hash-chain** — engineering, and the answer is no with a stated threat analysis
  (AUD-D041).
- **Which indexes, which JSON keys, whether audit hides passwords, whether an event needs a UUID** —
  engineering, decided above.

---

## 39. Handoffs

```
STAGE 20   test the Class A rollback: force an audit failure, assert the business act does NOT commit
           test cross-tenant audit isolation at the database level
           test that safe_metadata rejects a non-allowlisted key at WRITE time
           test that CK-A7 refuses an invented actor: a system event carrying an authority
           test that identity-scoped events are unreachable from a tenant context (AUD-R13)
           test the intent/outcome pairing: kill a privileged operation mid-run, assert the
             orphaned intent is detectable
           COVERAGE: assert every one of the 67 audit-marked capabilities has an AET (§8.9)
           enumerate the unaudited consequential acts (AUD-F07) against §8's taxonomy
STAGE 21   the audit role's privileges — INSERT/SELECT only, no UPDATE, no DELETE (AUD-D040)
           the privileged erasure path's separate role
STAGE 22   A15-003's migration; MIG-07 migrates all three stores
           MIG-14 drops them after the soak — AND IS BLOCKED ON §7.3'S ANSWER
STAGE 7    A7-001 — view_school_support_activity, the ONE capability this stage cannot mint
           C-103 — the "58 of 95" headline against the register's 67
           AUD-D065 — whether school-side audit export exists, and its capability if it does
LEGAL      audit retention · which events may be erased · C-79's audit dimension
           §7.3 — whether the legacy console snapshots are records that must be preserved
```

---

## 40. Success criteria — answered

| Question | Answer |
|---|---|
| Is audit separate from technical logs? | **YES** — AUD-P1, §5 |
| Is audit separate from domain history? | **YES** — AUD-D001, AUD-D055 |
| Is there one canonical audit-event model? | **YES** — AUD-D003, DBT-079 |
| Can audit contain passwords, MFA secrets or tokens? | **NO** — AUD-D005 |
| Does tenant audit have structural tenant ownership? | **YES** — AUD-D014 |
| Can a school read another school's audit? | **NO** — AUD-D015 |
| Can a school read a person's account-security history? | **NO** — AUD-D061, identity scope |
| Does every audit-required capability have an event? | **YES — all 67** — §8.9, checked against the register rather than asserted |
| Is any actor, authority or capability invented to satisfy NOT NULL? | **NO** — AUD-D060, CK-A7 |
| Does audit decide whether a business act may happen twice? | **NO** — AUD-D056, DBI-034 is evidence dedup |
| Is any event marked Class A that cannot technically be one? | **NO** — AUD-D062, and four draft marks were corrected |
| Does one concept own purge eligibility? | **YES — DBT-002** — AUD-D029 |
| Is DM-054's record still MOD-012's? | **YES** — AUD-D006, DBT-080 |
| Are the existing console snapshots destroyed by this stage? | **NO** — §7.3, POLICY INPUT REQUIRED |
| Is a fabricated `persons` row used to hold a pseudonym? | **NO** — AUD-D064 |
| Does support audit retain the platform actor? | **YES** — AUD-D030 |
| Does break-glass retain elevation and reason evidence? | **YES** — AX-7, AUD-D031 |
| Does a required I-2 audit fact share the transaction? | **YES** — AUD-D020 |
| Can a Sentry failure roll back I-2? | **NO** — AUD-D021 |
| Can a required audit insert failure roll back I-2? | **YES** — AUD-D021 |
| Are corrections append-only? | **YES** — AUD-P10 |
| Can ordinary application code UPDATE an audit event? | **NO** — AUD-D040 |
| Are all GET / page views audited? | **NO** — AUD-D007 |
| Are message bodies copied into audit? | **NO** — AUD-D045 |
| Are provider payloads copied into audit? | **NO** — AUD-D034 |
| Are audit exports protected? | **YES** — AUD-D051 |
| Is exporting audit itself audited? | **YES** — AET-062 |
| Are legal retention periods invented? | **NO** — AUD-D039, A16-002.2 |
| Is the privacy/erasure tension explicitly recorded? | **YES** — §24, AD-027 |
| Is a blockchain or hash ledger introduced without need? | **NO** — AUD-D041, with the limit stated |
| Was code changed? | **NO** |
| Was the audit schema implemented? | **NO** |

---

## 41. What Stage 19 deliberately does not decide

```
the test strategy                                        STAGE 20
database roles, privileges and probe configuration       STAGE 21
migration execution and order                            STAGE 22
view_school_support_activity's CAP identifier            STAGE 7 — A7-001 REQUIRED
whether a general school audit console exists            DEFERRED — no evidence requires one
whether school-side audit export exists                  OPEN — AUD-D065
Stage 7's own "58 of 95" headline                        STAGE 7 — C-103
the legacy console snapshots' INTERIM handling            ANSWERED — A19-001 · §42
the legacy console snapshots' FINAL disposition           APPROVED POLICY / LEGAL — §42
statutory retention · which events may be erased         APPROVED POLICY / LEGAL
lawful basis · controller-processor determination        LEGAL
domain history                                           STAGES 6 and 15 — unchanged
security algorithms · API routes                         STAGES 16 and 14
```

**Stage 19 is a design proposal. No audit table exists, no migration has run, no capability has been
minted, no export has been produced, no snapshot has been deleted, no code has changed.**

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2**.

```
STAGE 19 — AUDIT, ACCOUNTABILITY & EVIDENCE
STATUS: LOCKED — 31 August 2026
POST-LOCK AMENDMENT: A19-001 — legacy console snapshot interim disposition (§42)
Open owner questions: 0
Legacy snapshot final legal disposition: POLICY INPUT REQUIRED
```

---

## 42. Amendment register — Stage 19

**Append-only. Later stages may implement this stage and may record traceable owner amendments here.
They must not silently rewrite it. If a later finding conflicts with anything above: FLAG THE
CONFLICT.**

### A19-001 · Legacy console snapshot interim disposition

```
A19-001 · Legacy console snapshot interim disposition
RAISED BY   THE OWNER — BytHub Technology Ltd, 31 August 2026
TYPE        OWNER DECISION on the one question left open at lock
AFFECTS     §7.3 · §26 (AUD-D043) · §32's map · MIG-14's preconditions
STATUS      RECORDED.  The locked text is unchanged; this amendment governs.
VERIFIED    Stage 19's amendment register was empty; A19-001 is the next identifier.
```

**ORIGINAL LOCK STATE.** Stage 19 locked with **one owner question open**: the disposition of the
existing `beforeSnapshot` / `afterSnapshot` values written by `server/console/audit.ts`. §7.3 recorded
three options — retain as-is, retain redacted, delete at MIG-14 — and **refused to choose**, because
two of the three are legal classifications and the third destroys production data. **MIG-14 was
blocked on the answer.**

**OWNER DECISION — 1A · QUARANTINE AND PRESERVE PENDING APPROVED POLICY.**

```
LEGACY SNAPSHOT DISPOSITION = 1A

   PRESERVE the snapshot bytes                    ── they are not destroyed
   QUARANTINE them                                ── they leave ordinary reach
   FINAL retain / redact / delete                 ── LEGAL / APPROVED PRIVACY POLICY

THIS IS NOT "RETAIN FOREVER".
It is: DO NOT DESTROY POTENTIALLY RELEVANT EXISTING DATA BEFORE AN APPROVED
       POLICY DETERMINES ITS FINAL DISPOSITION.
```

**CURRENT TARGET, stated as constraints rather than as a mechanism** — the mechanism is Stage 22's to
design and Stage 21's to make deployable:

| # | Constraint |
|---|---|
| **1** | **Legacy snapshots are NOT part of DBT-079 `audit_events`.** The canonical audit event's shape is unchanged by this amendment; no snapshot payload is migrated into it |
| **2** | **Ordinary application code cannot read them.** Not through a route, not through a query, not through a projection |
| **3** | **Ordinary support and audit screens cannot read them.** Not UX-095, not UX-096, not UX-099, and not through A7-001's `view_school_support_activity` |
| **4** | **They are outside the canonical audit search and export surface** — §28's filters do not reach them, and §29's export cannot contain them |
| **5** | **Access is limited to a separately authorised migration / legal / security-investigation path**, which is not reachable from application code |
| **6** | **They must never appear in Sentry, in logs, in audit `safe_metadata`, or in any ordinary export** — AUD-D005 and Stage 16 SEC-D063 apply to the quarantine as they apply to audit |
| **7** | **No new snapshots are written once the target audit path takes over.** The quarantine is a closed set, not a growing one |

**FINAL LEGAL DISPOSITION — still POLICY INPUT REQUIRED.** A19-001 does not set a retention period, does
not classify the data, and does not authorise destruction. **AUD-P22 is unchanged: this document
invents no retention period.**

### A19-001.1 · What "do not delete at MIG-14" means, exactly

**MIG-14 must not destroy the snapshot BYTES. It is not thereby blocked forever.**

```
MIG-14 MAY EVENTUALLY DROP THE console_audit TABLE
   ── but ONLY after the bytes it carries are demonstrably somewhere else
```

**Stage 22 may design a quarantine / archive migration.** Stage 19 states what it must achieve, and
does not design it:

```
1  INVENTORY      identify EVERY legacy console row carrying a beforeSnapshot or
                  afterSnapshot value
2  COPY           copy the snapshot payloads into a deliberately restricted
                  quarantine / archive structure
3  PROVENANCE     preserve source identity and the provenance needed to make the
                  copy meaningful later — which row, which operation, when
4  RECONCILE      verify row counts, hashes and source-to-quarantine parity
5  REMOVE REACH   remove them from ordinary application access
6  PROVE FIRST    prove the quarantine copy exists and reconciles BEFORE the source
                  table becomes eligible for removal

ONLY THEN is console_audit itself eligible for removal.
IF NO APPROVED QUARANTINE MECHANISM EXISTS:  MIG-14 REMAINS BLOCKED.
```

**And the destruction of the quarantined bytes is a separate gate that MIG-14 does not carry.**

```
MIG-14                    may drop the SOURCE TABLE once preservation is proven
FINAL DESTRUCTION of the
QUARANTINED SNAPSHOT DATA APPROVED LEGAL / PRIVACY DISPOSITION REQUIRED
                          ── NOT automatically authorised by MIG-14
                          ── NOT authorised by this amendment
```

**Two things this amendment deliberately does not do.** It does **not** invent a retention period —
that remains policy input. And it does **not** make the archive permanently readable by administrators
or by the platform console; **a quarantine that ordinary privileged users can browse is not a
quarantine, it is a relocation.**

### A19-001.2 · Effect on the registers

| | As locked | After A19-001 |
|---|---|---|
| Open owner questions | **1** | **0** |
| Legacy snapshot interim disposition | undecided | **1A — quarantine / preserve** |
| Legacy snapshot final legal disposition | POLICY INPUT REQUIRED | **POLICY INPUT REQUIRED — unchanged** |
| MIG-14 | blocked on an unanswered question | **blocked until quarantine preservation is designed, executed and reconciled** |
| DBT-079 `audit_events` | unchanged | **unchanged — no snapshot payload enters it** |
| AUD-D005's prohibited list | unchanged | **unchanged, and now explicitly binding on the quarantine** |
| Conflict identifiers | C-100 … C-103 | **unchanged — none closed, none added** |

**No identifier is renumbered, no locked decision is rewritten, and no conflict is closed by this
amendment.**

---

## 43. Corrections applied before lock

**Recorded because a locked document should say what changed in it, and because several of these were
this stage's own mistakes rather than the codebase's.** None of them is a conflict — a conflict is a
contradiction with a **locked** requirement, and a PROPOSED draft disagreeing with its corrected self
is not one.

| # | The draft said | The locked text says | Why |
|---|---|---|---|
| 1 | `console_operation_details`, owned by MOD-013 | **DBT-080 `console_operations`, owned by MOD-012**, linked by a UNIQUE FK | it silently moved **DM-054** out of the module Stage 8 locked it into |
| 2 | purge eligibility is read from AET-023 | **read from DBT-002 `school_lifecycle_events`** | one concept, one owner — and the locked lifecycle record already held it |
| 3 | two `scope_kind` values | **three — `school` · `platform` · `identity`** | an account act belongs to no tenant, and a NULL never means scope |
| 4 | a FAMILY-RELATED RLS policy class | **withdrawn** | a row-level grant with no reader is a standing grant waiting for a screen |
| 5 | `UNIQUE (correlation_id, …)` as DBI-034 | **`UNIQUE (business_act_key, action_key)`**, and it dedups **evidence** only | a retry is a new request with a new correlation id; NULLs are distinct |
| 6 | a one-directional reason CHECK | **the three-way `reason_policy` predicate** | it never enforced that a discretionary act *carries* a reason |
| 7 | NOT NULL actor, authority and capability | **nullable, with CK-A4 … CK-A7** | the alternative was inventing a person and an authority for every job |
| 8 | an `elevation_id` pointing at no table | **`elevation_event_id` → AET-030, a self-reference** | rather than invent DBT-081 to satisfy a column |
| 9 | a "short closed Class A list" | **Class A is the default; the Class B list is the closed one** | the fragility argument confused a same-transaction INSERT with an external sink |
| 10 | four privacy events marked Class A | **corrected to Class B** | an asynchronous external completion has no transaction to join |
| 11 | 66 events "built to cover" 67 audit-marked capabilities | **102 events; all 67 covered, checked mechanically** | 33 capabilities had no event at all |
| 12 | `view_school_audit` + `view_finance_audit` | **one capability, `view_school_support_activity`** | a locked stage requires the support view; nothing requires the rest |
| 13 | the console snapshots are "dropped" | **§7.3 — POLICY INPUT REQUIRED, MIG-14 blocked** | the future shape is not a decision about data that already exists |
| 14 | a context switch is audited "where consequential" | **on every switch** | locked Stage 7 marks CAP-039 AUDIT without qualification |
| 15 | `session_id` for an import batch | **`import_session_id`** | `session_id` already means an authentication session |

**Two of these — 1 and 2 — were caught by the owner's review. The rest were caught by building §8.10's
matrix and then checking it against the locked registers rather than against the prose that preceded
it.** That is the argument for the matrix existing at all.
