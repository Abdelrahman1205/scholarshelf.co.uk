# DATABASE_SCHEMA.md — Stage 15: Physical Database Schema & Integrity

```
STAGE 15 — PHYSICAL DATABASE SCHEMA & INTEGRITY
STATUS: LOCKED
Written: 30 August 2026
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
Owner questions: 0. Corrections 1–14 of owner review applied and recorded.
New conflicts: C-78 · C-79.
Traceable amendment raised against a locked stage: A13-001 (CODEBASE_ARCHITECTURE.md).
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` · `TECH_STACK.md` · `SYSTEM_ARCHITECTURE.md` · `CODEBASE_ARCHITECTURE.md` ·
`API_CONTRACT.md` — **Stages 1–14, all LOCKED.**

**Database evidence, read directly on 30 August 2026** — every `pgTable` declaration in
`shared/schema.ts` (1,166 lines), `drizzle.config.ts`, all seven files in `migrations/`,
`.github/workflows/ci.yml`, `server/config/database.ts`, `server/app.ts`'s session store, and the
column-level shape of every table named below. **Declarations, relationships, indexes, constraints,
defaults and nullability were read — not inferred from table names.**

---

## 1. Purpose and boundary

Stage 15 answers:

> **What exact PostgreSQL/Drizzle physical data model makes the locked ScholarShelf product,
> workflows, authority scopes, API contracts, history and transaction invariants structurally
> representable and enforceable?**

Stage 6 established the conceptual model. Stage 8 established ownership. Stage 12 established system
boundaries and **I-2**. Stage 13 established module-owned persistence. Stage 14 established API
contracts. **Stage 15 turns that into tables, columns, keys, constraints, indexes, history and
database invariants. It implements none of it.**

### 1.1 The DBT counting rule — one rule, applied without exception

**A table receives a `DBT-nnn` identifier if and only if Stage 15 defines its physical shape.**

```
Stage 15 defines the shape        →  gets a DBT identifier · counted
Shape owned by a later stage      →  NO DBT identifier · marked DEFERRED · NOT counted
```

`user_sessions` and `rate_limits` **do** get identifiers: their shapes are fixed — one by
`connect-pg-simple`, which Stage 11 locked, the other by columns Stage 15 specifies — and **Stage 16
owns only their security-sensitive semantics**, not their existence or keys. `audit_events`,
`console_operations` and `message_audit_logs` get **no identifier**, because Stage 15 defines no shape
for them at all.

**The two approaches are not mixed.** Nothing here is both "reserved with an ID" and "deferred
without one."

### 1.2 What Stage 15 does not decide

| Not decided here | Owner |
|---|---|
| Password hashing · session fixation · TOTP · MFA recovery · CSRF · rate-limit **algorithms and dimensions** · **how RLS context is securely established and set** · RLS helper-function privilege · security headers · upload scanning · signed-URL lifetime · import normalisation rules | **Stage 16** |
| Provider brands · Resend templates · payment provider · webhook signature algorithm · object-storage provider | **Stage 17** |
| Cache and performance thresholds · worker concurrency · lease durations · **connection-pressure consequences of A13-001** · retention windows · speculative indexes | **Stage 18** |
| **Final audit-record mechanics and schema** | **Stage 19** |
| Privacy and legal retention periods · erasure legal policy | **Stage 16 + legal review** |
| Full test strategy | **Stage 20** |
| Deployment · **applying and gating migrations** · **verifying PostgreSQL extensions** · pool and runtime configuration | **Stage 21** |
| **Migration application order** · the C-78 and C-79 censuses · data backfill execution | **Stage 22** |

### 1.3 Nothing was executed

**No migration was applied. No SQL was run. No RLS policy was created in a database. No schema file
was edited. No migration file was created. No PostgreSQL extension was installed. `drizzle-kit` was
not run. No production data was changed, backfilled or migrated. No session, authentication, Vercel,
Neon or CI configuration was touched.**

### 1.4 The release boundary is unchanged

Stage 15 approval ≠ production security clearance ≠ legal sign-off. The go-live block of 23 August
2026 stands in full.

---

## 2. Current database baseline

### 2.1 Table count — verified directly

**41 tables**, counted by parsing every `export const X = pgTable("name"` in `shared/schema.ts`.
Stage 0's figure, independently re-derived.

### 2.2 Twelve tables have no tenant column — the hard evidence for C-65

```
audit_logs · basket_items · basket_payments · book_inventory_transactions · book_level_items
class_book_levels · family_students · notification_preferences · rate_limits · schools
user_permissions · user_sessions
```

Three are legitimately global: `schools` **is** the tenant; `rate_limits` and `user_sessions` are
infrastructure. **The other nine hold tenant-relevant data with no derivable tenant ownership except
by joining through a parent** — and three are serious:

| Table | Why it matters |
|---|---|
| **`book_inventory_transactions`** | **The stock-movement history.** Tenant reachable only via `book_id → books.school_id`. |
| **`user_permissions`** | **Authority grants** whose scope is not in the record. |
| **`audit_logs`** | Audit attribution with no tenant — deferred to Stage 19, but recorded because it affects §38. |

### 2.3 Money is already the right type

Every authoritative money column is `numeric(10, 2)`. **No `float`, `real` or `double precision`
appears anywhere.** Verified-good and preserved.

### 2.4 Structures that are already correct and are preserved

| Evidence | Why it is kept |
|---|---|
| `cron_job_runs` `uniqueIndex(job, school_id, run_date)` | The one-run-per-day invariant already exists. Carried as **DBI-020**, with §5's correction for platform-scoped jobs. |
| `custody_events` — from/to status, actor, note, append-only in use | Custody as events, not a status column. |
| `book_inventory_transactions` — `previous_quantity`/`new_quantity`/`transaction_type` | Independently auditable. Preserved and **given a tenant column**. |
| `teacher_profiles` `uniqueIndex(user_id, school_id)` | A person-to-school membership row **already exists**. |
| `provider_payments` unique index on provider identity | Replay protection already modelled. Generalised as **DBI-021**. |
| `guardians` — its own row, `user_id` optional | Stage 6 called this comparatively clean. It stays. |
| `numeric(10,2)` throughout | §2.3 |
| `schools` — five separate lifecycle field groups | Five acts **already** modelled as distinct facts, matching Stage 14 §34.1. |

---

## 3. Current migrations and schema authority

### 3.1 What exists

```
001_console_hardening.sql 179 · 002a_indexes.sql 63 · 002b_foreign_keys.sql 186
003_academic_year.sql 105 · 004_cron_idempotency.sql 29 · 005_payment_verification.sql 90
006_identity_and_money_integrity.sql 147                                        total 799
```

### 3.2 What actually creates schema today — re-verified

**In CI** (`.github/workflows/ci.yml`, integration job):

```yaml
run: npm run db:push -- --force
- name: Apply SQL migrations
  run: for f in migrations/00[2-9]*.sql; do psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$f"; done
```

1. **`drizzle-kit push --force` is the schema authority in CI** — the mechanism TD-017 forbids as
   production authority, running with `--force`.
2. **`001` is excluded by the glob `00[2-9]*.sql`**, and reading it shows why: *"Run ONCE against
   production, as the Neon project owner"* and *"replace both REPLACE_ME passwords."* **It cannot run
   as the application role and contains placeholder credentials.** CI skipping it is correct.

**In production there is no migration step at all.**

### 3.3 The finding

```
CURRENT  =  drizzle-kit push  +  manual psql        — in CI, and by hand in production
TARGET   =  generated · committed · reviewed · ordered migrations      (TD-017)
```

**C-19 and C-61** measured — and it is the database half of **C-72**.

---

## 4. Database principles

**DB-P1 — Every tenant-owned row carries its tenant, in the row.** `school_id NOT NULL`.

**DB-P2 — A NULL `school_id` is never sufficient to imply global or platform scope.** *(Wording made
precise at owner review — Correction 4.)* Any table that can hold both school-scoped and
non-school-scoped rows carries an **explicit `scope_kind` discriminator** with a database `CHECK`
tying the discriminator to `school_id` nullability. **School-owned domain tables remain `school_id
NOT NULL` without exception**, and nothing reads a bare NULL as an authority signal.

**DB-P3 — A cross-tenant reference is impossible, not merely unlikely** (§12).

**DB-P4 — Derived truth is not independently writable.**

**DB-P5 — Historical events are append-only in meaning.** A correction is a new forward row.

**DB-P6 — Current mutable convenience state never replaces authoritative history.**

**DB-P7 — Money is exact.** `numeric(10,2)`.

**DB-P8 — An invariant PostgreSQL can enforce is enforced by PostgreSQL** — and **an invariant it
cannot enforce is described accurately rather than overstated** (§17, Correction 9).

**DB-P9 — A cross-row invariant a `CHECK` cannot express gets a named transactional owner and an
explicit locking rule.**

**DB-P10 — One conceptual fact has one authoritative representation.**

**DB-P11 — A nullable column means genuinely optional.**

**DB-P12 — Every foreign key's delete behaviour is chosen deliberately.**

**DB-P13 — Unique constraints encode locked business uniqueness** — and **a unique constraint over an
optional column uses explicit partial uniqueness rather than relying on NULL comparison** (§5).

**DB-P14 — Indexing begins with correctness.**

**DB-P15 — An API response is never a database row.**

**DB-P16 — A provider identity is never business truth.**

**DB-P17 — Idempotency, jobs and notifications survive a process restart.**

**DB-P18 — Object bytes do not live in PostgreSQL.**

**DB-P19 — A constraint predicate never depends on the wall clock.** *(Added at owner review —
Correction 6.)* A partial index whose predicate contains `now()` is not a valid design: its membership
would change underneath it as time passes. Time-dependent rules are enforced when the row is used.

---

## 5. Naming, identifiers and optional-scope uniqueness

**DBD-001 · `snake_case`, plural tables, singular columns, `*_id` foreign keys, `created_at` /
`updated_at`** — the convention the existing schema already uses. **A table is renamed only where the
target concept genuinely changed.**

**DBD-002 · Identifiers.** New and rebuilt tables use native `uuid`; existing tables keep
`varchar(36)` until their own migration converts them. `schools.code` remains the **public** school
identifier, unchanged. **No sequential public identifier is introduced.**

**DBD-003 · Mixed-scope tables carry an explicit `scope_kind`; no unique key relies on NULL
comparison**

*Problem — Corrections 4 and 5.* An earlier draft made `school_id` nullable on `authority_grants`,
`notifications`, `jobs` and `idempotency_keys` "for platform rows", while DB-P2 forbade reading a NULL
tenant as platform scope — an internal contradiction. Worse, `jobs` then carried
`UNIQUE (job_kind, school_id, scheduled_for)`, and **PostgreSQL treats NULLs as distinct in a unique
index**, so *"one platform-wide job per day"* was **not enforced at all**: two rows with
`school_id IS NULL` would both be accepted.

*Decision.* **Four tables are mixed-scope, and each carries `scope_kind` with a `CHECK`:**

```sql
scope_kind text NOT NULL CHECK (scope_kind IN ('school','platform'))
CHECK ( (scope_kind = 'school'   AND school_id IS NOT NULL)
     OR (scope_kind = 'platform' AND school_id IS NULL) )
```

| Table | Why it is mixed |
|---|---|
| **DBT-010 `authority_grants`** | AUTH-PLATFORM and AUTH-BREAKGLASS are genuinely not school-owned |
| **DBT-053 `notifications`** | a platform operator receives operational notifications |
| **DBT-069 `jobs`** | a per-school drain and a platform-wide maintenance job are both real |
| **DBT-070 `idempotency_keys`** | a platform lifecycle act has no school |

**`authority_grants` additionally checks that the authority and the scope agree:**

```sql
CHECK ( (authority IN ('AUTH-PLATFORM','AUTH-BREAKGLASS') AND scope_kind = 'platform')
     OR (authority NOT IN ('AUTH-PLATFORM','AUTH-BREAKGLASS') AND scope_kind = 'school') )
```

**Every unique key over an optional scope column becomes two explicit partial uniques.**

```sql
-- DBT-069 jobs — DBI-020
CREATE UNIQUE INDEX ON jobs (job_kind, school_id, scheduled_for) WHERE scope_kind = 'school';
CREATE UNIQUE INDEX ON jobs (job_kind, scheduled_for)            WHERE scope_kind = 'platform';

-- DBT-070 idempotency_keys — DBI-016
CREATE UNIQUE INDEX ON idempotency_keys (operation, idempotency_key, person_id, school_id)
       WHERE scope_kind = 'school';
CREATE UNIQUE INDEX ON idempotency_keys (operation, idempotency_key, person_id)
       WHERE scope_kind = 'platform';
```

**Idempotency uniqueness is tied to the operation's actual scope.** A school-scoped operation's key is
unique within `(operation, key, person, school)` — the same person reusing a key for the same
operation in a **different school context** is a different intent and does not collide, while a retry
of the *same* intent does. **Nothing depends on NULL accidentally comparing equal.**

---

## 6. Tenant ownership classes

**DBD-004 · Six ownership classes, and `school_id NULL` is never one of them**

```
GLOBAL PERSON / SYSTEM     no tenant column     persons · credentials · sessions · rate limits
PLATFORM                   no tenant column     tenant onboarding
SCHOOL                     school_id NOT NULL   the overwhelming majority
MIXED SCOPE                scope_kind + CHECK   §5 — four tables, explicitly discriminated
FAMILY / RELATIONSHIP      school_id NOT NULL + relation
CYCLE / PUBLICATION        school_id NOT NULL + period or revision
```

*Current evidence:* `users.school_id` is **nullable today**, and a null there means *platform owner*.
**In the target a platform person is a person with a platform-scoped authority grant and no school
membership.**

Where a current column is nullable and the entity is school-owned — `users`, `students`, `families`,
`book_payments`, `child_book_baskets`, `finance_book_allocations`, `custody_events`, `cron_job_runs`,
`provider_payments` — **the target makes it NOT NULL**, and §42 records the backfill.

---

## 7. Tenant-integrity strategy and the RLS decision

**DBD-005 · OPTION B+ — full RLS on every school-owned operational table, plus tenant-aware composite
foreign keys**

*Naming corrected at owner review (Correction 3).* An earlier draft labelled this *"Option C+"* while
describing RLS on **all** school-owned tables. That is the document's own **Option B**, strengthened
by the composite-FK requirement. **The label is now accurate: OPTION B+ · FULL RLS + TENANT-AWARE FK.**

### 7.1 The two mechanisms solve different halves

```
COMPOSITE TENANT-AWARE FOREIGN KEYS      prevent CREATING a cross-tenant relationship
ROW-LEVEL SECURITY                       prevent READING the wrong tenant's rows
```

**They are not alternatives.** RLS would not have stopped a child in School A being pointed at a class
in School B — the row is created inside one tenant's context and simply references the wrong parent.
Composite FKs would not have stopped a query with a missing `WHERE` clause. **C-65's wording —
*"tenant ownership is not structurally enforced by the database"* — is the FK half.**

### 7.2 The options, assessed against real evidence

| | A: FKs, no RLS | **B+: FKs + RLS on all school-owned tables** | C: FKs + RLS on high-risk tables only |
|---|---|---|---|
| Closes C-65 | **yes** | yes | yes |
| Read-path defence in depth | none | **complete** | partial |
| Policy surface | 0 | ~55 tables | ~12 tables |
| I-2 across four modules | unaffected | one context, one transaction — **works** (§20) | works |
| Family cross-school (SC-4) | unaffected | needs a **RELATIONSHIP class** (§7.5) | needs it too |
| Support (SC-6) | unaffected | needs a **named-engagement class** — not a bypass | same |
| **Public site (SC-8)** | unaffected | needs a **PUBLICATION class** (§7.6) | same |
| Pooled / serverless | unaffected | safe **only** if context is per-transaction (§7.4) | same |
| Risk of running without context | n/a | **fails closed** | open on uncovered tables |
| Mental model | "the app protects it" | "the database protects it" | **"which table is this?"** |

**Option C's decisive weakness is the last row.** Once Stage 16 has paid the cost of establishing a
secure context at all — which A avoids and B and C both require — extending a policy is nearly free.
**Option A's decisive weakness** is that under a live go-live block with 17 Critical findings,
*"tenant isolation is enforced by the application"* is the answer that produced the current state.

### 7.3 The decision

**Composite tenant-aware foreign keys on every relationship between school-owned rows — the primary
mechanism, and the one that closes C-65. Plus RLS on every school-owned operational table, as defence
in depth. The application role does NOT have `BYPASSRLS`.**

### 7.4 The constraint that makes RLS safe under Neon and pooling

```
TENANT CONTEXT IS SET PER TRANSACTION, NEVER PER CONNECTION
        SET LOCAL / set_config(..., true)   inside the transaction
        NOT  SET / set_config(..., false)   on the session
```

A session-level `SET` outlives the request that set it and is inherited by whichever request gets that
connection next — **a tenant-context leak invisible in testing and catastrophic in production.**
`SET LOCAL` is scoped to the transaction and reset on commit or rollback.

**This has a consequence for a locked stage, and it is raised as a traceable amendment rather than
absorbed silently: see A13-001 (§7.7).**

### 7.5 Five policy classes — the PUBLICATION class added at owner review

*Correction 3.* An earlier draft defined four classes and omitted the public path, while Stage 7
already has **SC-8** and Stages 12–14 lock an unauthenticated public school website. **That gap is
closed.**

| Class | Scope | Applies to | Predicate, conceptually |
|---|---|---|---|
| **TENANT** | SC-1 · SC-2 · SC-3 | school-owned operational tables | `school_id = current tenant` |
| **RELATIONSHIP** | **SC-4** | children, families, guardians, relationships, cycles, requirement items, money events, allocations, notifications | the row's child is reachable through an **active guardian relationship** for the current person — **not a single school** |
| **SUPPORT** | **SC-6** | the same school-owned tables | `school_id = the school named by the active support engagement` — an explicit context, **never a bypass** |
| **PUBLICATION / PUBLIC** | **SC-8** | **a deliberately smaller set** — §7.6 | published revision content only, for one resolved school |
| **PLATFORM** | SC-7 | platform tables | no tenant predicate, because there is no tenant |

**The RELATIONSHIP class is why full RLS does not force a `selectedSchool` on families.** A parent with
a child at School A and a child at School B reads both under one context, because the predicate is the
relationship, not the tenant.

### 7.6 The PUBLICATION class — deliberately smaller than tenant access

**The public path is not "a tenant context with a school in it."** It is its own class over its own
table set.

**Tables with a PUBLICATION policy — and these only:**

```
DBT-001 schools                 only the deliberately public identity columns (§7.8)
DBT-003 school_identity         public identity
DBT-006 school_public_domains   host → school resolution
DBT-058 site_settings           to reach published_revision_id, and nothing else
DBT-059 site_revisions          ONLY the revision that published_revision_id names
DBT-060 site_pages   DBT-061 page_sections   DBT-062 site_news   DBT-063 site_events
DBT-064 site_media_links        rows of that published revision
DBT-065 site_presentation       DBT-066 site_contact
DBT-071 object_uploads          ONLY rows in trust_state = 'published'
```

**Every other table has NO PUBLIC POLICY AT ALL.** Not a restrictive one — none. Under RLS a table
with no applicable policy returns no rows, so a public-path bug that reaches for `children`,
`money_events`, `stock_movements`, `allocations`, `custody_events`, `messages`, `support_engagements`
or a **draft** revision gets nothing, from the database, regardless of what the query says.

```
public request  →  set a generic tenant context  →  therefore query any tenant table    ✗ REJECTED
```

**Draft invisibility is structural, not a filter.** The `site_revisions` public policy admits only the
revision `site_settings.published_revision_id` names; a draft revision is a different row and is not
in the policy's result set. **This is the database expression of `PUBLIC SITE ≠ TENANT APPLICATION`.**

**Stage 16 owns the secure context and policy mechanics.** Stage 15 owns the class and its table set.

### 7.7 A13-001 — the traceable amendment to locked Stage 13

**Stage 13 APP-028 is LOCKED and is not rewritten.** Stage 15's contextual RLS was introduced after
Stage 13 locked, and it narrows where the Neon HTTP read driver may safely be used. **That narrowing
is recorded as an amendment, in CODEBASE_ARCHITECTURE.md, dated and reasoned — not as though APP-028
had always said it.** §7.7 here is the Stage 15 side of the record; the amendment block itself lives
in the Stage 13 document.

```
A13-001 · Contextual RLS requires a transaction-capable scoped-read path

UNSCOPED / NON-RLS READ     may use the simple Neon HTTP ReadDb — genuinely global or public
                            infrastructure reads needing no contextual RLS
SCOPED AUTHENTICATED READ   tenant · family · support · contextual platform · any RLS-protected read
                            → transaction-capable PostgreSQL connection
                            → establish context with SET LOCAL
                            → execute the read
                            → end the read transaction
MUTATING TRANSACTION        withTransaction(tx) — unchanged.  I-2 unchanged.
```

**Neon HTTP is not removed from the locked stack. node-postgres is not removed. No second database is
introduced.** The amendment narrows *where* the HTTP driver is safe. **Stage 18 evaluates the
connection-pressure consequences; Stage 21 owns pool and runtime configuration.**

### 7.8 The root tenant table is not globally readable

*Correction 3, second half.* An earlier draft excluded `schools` from RLS because it has no
`school_id`. **But a tenant-scoped query against `schools` still returns every school's metadata if
nothing restricts it.**

**DBT-001 `schools` carries policies keyed on `id`:**

| Context | May see |
|---|---|
| **TENANT / SUPPORT** | `schools.id = the active school` — one row |
| **PUBLICATION** | only the deliberately public identity and resolution columns, for the resolved school |
| **PLATFORM** | tenant metadata, as SC-7 permits |
| anything else | nothing |

**The tenant root table is not left globally readable by the ordinary application role merely because
it is itself the tenant.**

### 7.9 Database privilege classes

| Class | Purpose | RLS |
|---|---|---|
| **application** | the running product | **subject to RLS** · no `BYPASSRLS` |
| **migration** | applies committed migrations · owns DDL | outside RLS by nature of DDL |
| **bounded investigation** | CAP-089 read-only subjects (Stage 14 API-271/272) | read-only, views schema, credential-excluding — what `001` already implements |

**Credential storage, rotation and secret delivery are Stage 16/21.**

---

## 8. Global identity and school membership

**DBD-006 · `users` decomposes into four tables, because it currently fuses four facts**

*Current evidence:* 16 columns holding a person, an account, a **single nullable tenant** and a
**single role**.

| Target | Ownership | Notes |
|---|---|---|
| **DBT-007 `persons`** | **GLOBAL** | one human, once. `email citext UNIQUE` — migration 006's S3 finding. |
| **DBT-008 `credentials`** | GLOBAL, 1:1 | password hash, MFA, verification state. **Stage 16 owns every field's form** (§30). |
| **DBT-009 `school_memberships`** | `school_id NOT NULL` | `UNIQUE(person_id, school_id)` — **`teacher_profiles` already has this index**. |
| **DBT-010 `authority_grants`** | **MIXED — `scope_kind`** | §5's discriminator and the authority-agreement `CHECK`. |

**DBD-007 · Authority is persisted; capability is derived and never stored**

*Rejected explicitly:* a `person_capabilities` table, a cached capability snapshot column, or any
materialised capability set treated as authoritative. **A stored capability set is a session-cached
authority with a longer life — C-67 in a table.** *Also rejected:* role state duplicated across
`users.role`, `user_permissions.role` and `session.role`, which is the current arrangement. **In the
target there is exactly one place an authority is written: DBT-010.**

**Teacher reach is staffing-derived** — SC-2 and SC-3 come from `class_staffing` ∩ `class_memberships`,
computed, never stored.

---

## 9. School, configuration, identity and CMS entitlement

**DBD-008 · `schools` splits into the tables its own columns already suggest**

**DBT-001 `schools`** — the tenant, and little else. **DBT-002 `school_lifecycle_events`** — the five
current field groups become five append-only event kinds; `schools.status` becomes a projection
maintained in the same transaction. **DBT-003 `school_identity`** and **DBT-004
`school_configuration`** — 1:1, with policy as explicit columns rather than one opaque JSON blob.

**DBD-009 · Core identity and website presentation are separated — C-5 is not recreated**

*Current evidence:* `school_branding` (18 columns) holds **both** the logos used in the app, in emails
and in PDFs **and** `primary_colour`/`secondary_colour`/`accent_colour`/`theme_name`/`font_preference`,
which `client/src/lib/branding.ts` writes into `--primary` and `--ring` — the C-52/C-53 defect.

```
school_branding  ──┬──▶  DBT-003 school_identity      MOD-001 · logos, favicon, public identity
                   └──▶  DBT-065 site_presentation    MOD-011 · public WEBSITE theme only
```

**`site_presentation` feeds only `apps/site`'s `--site-*` namespace.** **The database does not need a
column for a semantic action, focus, danger or state colour, because a school can never set one** — so
those columns simply do not exist. The Stage 10 boundary is expressed by the absence of a column.

**DBD-010 · CMS entitlement is a small MOD-001 relation** — **DBT-005 `school_entitlements`**, with
`UNIQUE(school_id, module) WHERE revoked_at IS NULL` (**DBI-026**). A boolean cannot say **who granted
it and when**, and Stage 14's API-248/249 are audited acts under CAP-084. **No subscription tables, no
pricing, no billing mechanics, no licence infrastructure.**

---

## 10. Academic periods, classes, staffing and membership

**DBD-011 · Academic periods are school-owned — OD-2**

**DBT-012 `academic_periods`** — `CHECK (ends_on > starts_on)` · `UNIQUE(school_id, label)` ·
`UNIQUE(school_id) WHERE is_current` (**DBI-019**) · `EXCLUDE USING gist (school_id WITH =,
daterange(starts_on, ends_on, '[]') WITH &&)` (**DBI-027**, requires `btree_gist` — §41).

**No global UK academic-year table exists.** *Current evidence:* `003_academic_year.sql` added an
`academic_year` **text label** to several tables; the target replaces those labels with `period_id`
references.

**DBT-013 `period_rollover_runs`** — Stage 14's API-115 is idempotent and may return `202` with a job,
and API-116 corrects a named run; **both need a durable run identity.** The preview writes nothing.

**DBD-012 · Staffing is a time-bounded relation, not `classes.teacher_id`**

**DBT-014 `classes`** — `UNIQUE(school_id, period_id, name)` plus a unique on the normalised form
(**DBI-004**, and §28's defence against duplicate-class forking). **DBT-016 `class_staffing`** —
`subject_id` nullable because subject-specific staffing is genuinely optional. **No
`classes.teacher_id` exists in the target.**

**DBD-013 · One active class membership per child per period — OD-3, enforced by the database**

**DBT-017 `class_memberships`**:

```sql
CREATE UNIQUE INDEX ON class_memberships (child_id, period_id) WHERE ended_at IS NULL;   -- DBI-005
```

*Why a partial unique index and not an exclusion constraint:* an exclusion over a time range would be
right if overlapping *historical* memberships were forbidden. **They are not** — September→Class A and
March→Class B must both survive. The locked invariant is *one **active** membership*, which is exactly
a partial unique on the open rows: cheaper, simpler, and **it needs no extension**.

```
September   Class A   started 2026-09-03  ended 2027-03-11  reason: moved_class   ← history, intact
March       Class B   started 2027-03-11  ended NULL                              ← the one active row
```

---

## 11. Children, families, guardians and link codes

**DBD-014 · Four distinct facts, and the relationship is authoritative**

**DBT-018 `children`** — `date_of_birth date` (current `students.date_of_birth` is **text**), **no
`class_id`**. **DBT-019 `families`** · **DBT-020 `guardians`** (`person_id` nullable — a guardian may
exist before an account) · **DBT-021 `guardian_child_relationships`** with
`UNIQUE(guardian_id, child_id) WHERE ended_at IS NULL` (**DBI-007**).

**Rejected as relationship identity:** email address, shared surname, shared family row, shared school.
*Current evidence:* `book_payments.parent_identifier` and `child_book_baskets.parent_identifier` are
**`text`** columns holding an email. Migration 006's finding S3 records the consequence: *"Two accounts
on one address means the second inherits the first one's children."*

**DBD-015 · Link-code uniqueness is global and unconditional**

*Correction 6.* An earlier draft specified
`UNIQUE (code_hash) WHERE consumed_at IS NULL AND expires_at > now()`. **That is not a valid design.**
A partial index predicate containing `now()` makes index membership depend on the wall clock — rows
would silently enter and leave the index as time passes, and the constraint would mean nothing
stable. **DB-P19 now forbids the pattern generally.**

**DBT-022 `child_link_codes`:**

```sql
UNIQUE (code_hash)          -- DBI-029 · global, unconditional
```

A link code is a random credential; **there is no business reason to reuse its value after expiry or
consumption.** `consumed_at` and `expires_at` are checked **when the code is used**, not by an index.
An expired code remains unique historical evidence.

**Stage 16 owns entropy, token form, hashing/HMAC, expiry length and single-use consumption
mechanics.** Stage 15 owns physical uniqueness only.

---

## 12. Tenant-aware foreign keys

**DBD-016 · Composite `(school_id, id)` keys make cross-tenant references impossible**

*The failure the current schema permits:* `students.class_id → classes.id` is an ordinary FK. **School
A's child may reference School B's class, and the database is satisfied.**

```sql
ALTER TABLE classes  ADD CONSTRAINT classes_school_id_key  UNIQUE (school_id, id);
ALTER TABLE children ADD CONSTRAINT children_school_id_key UNIQUE (school_id, id);

ALTER TABLE class_memberships
  ADD FOREIGN KEY (school_id, child_id) REFERENCES children (school_id, id),
  ADD FOREIGN KEY (school_id, class_id) REFERENCES classes  (school_id, id);
```

```
child.school_id = membership.school_id = class.school_id       enforced by PostgreSQL
```

**`UNIQUE (school_id, id)` on the parent is what makes the composite FK legal** — a foreign key must
target a unique constraint. It looks redundant beside the primary key and it is the mechanism.

**Applied to every relationship between two school-owned rows.** Where a child table has **no**
`school_id` today — `book_level_items`, `class_book_levels`, `basket_items`, `basket_payments`,
`book_inventory_transactions`, `family_students`, `notification_preferences` — **the target adds one**:
without the column there is nothing to prove. **This is what closes C-65.**

---

## 13. Book-supply cycle and requirements

**DBD-017 · One cycle per child per period; an empty cycle means nothing has been required yet**

**DBT-030 `supply_cycles`** — `UNIQUE (school_id, child_id, period_id)` (**DBI-006**), with composite
FKs to children and periods. **A cycle with zero requirement items means *nothing has yet been
required* — not *nothing is owed*.** **No column on the cycle records a settlement state.**

**DBD-018 · A requirement item is an episode; adding one never reopens an old one**

**DBT-031 `requirement_items`** — `origin` (`class_bundle` · `child_override` · `manual` ·
`replacement` · `mid_year_addition`), `origin_ref_id`, `corrected_by_item_id` nullable. **No `status`,
no `paid`, no `settled`, no `payment_status`.**

**DBD-019 · A requirement line snapshots the price at requirement time**

**DBT-032 `requirement_lines`** — `quantity`, `unit_price numeric(10,2)`, `payable_amount
numeric(10,2)`, with `CHECK (quantity > 0)`, `CHECK (unit_price >= 0)`, `CHECK (payable_amount >= 0)`.
**`unit_price` is captured at the moment of requirement and never recomputed from `books.price`.** The
line captures price and quantity, **not** the book's title, ISBN or author — those stay in `books` and
are read live.

**DBT-033 `child_requirement_overrides`** is a *source*; **DBT-031** is what was actually required.
Class assignment, child override and requirement item are three tables, and derivation stays traceable
through `origin` and `origin_ref_id`.

---

## 14. Catalogue, bundles and copies

**DBD-020 · School-owned catalogue; ISBN uniqueness is per school**

**DBT-023 `books`** — `UNIQUE (school_id, isbn) WHERE isbn IS NOT NULL` (**DBI-008**). *Verified:*
`books.isbn` has **no unique constraint today**, and each school owns its own catalogue rows. **The
same ISBN legitimately appears in many schools' catalogues** — a platform-global unique would break the
second school to add a common textbook.

**DBT-027 `bundles`** · **DBT-028 `bundle_lines`** (`UNIQUE(school_id, bundle_id, book_id)`,
**DBI-009**) · **DBT-029 `class_bundle_assignments`** (`UNIQUE(school_id, class_id, period_id,
bundle_id)`, **DBI-010**).

**DBD-021 · Copy identity, condition, holding and movement are four different things**

*Current evidence:* `book_copies` carries one mutable `status`, and `finance_book_allocations` carries
**three** status columns. **DBT-024 `book_copies`** holds identity and condition only; movement is
**DBT-025**, holding is **DBT-045**, and what is owed is **DBT-044**.

**Quantity-tracked versus serialised stock, reconciled rather than invented.** Both modes are already
present and are not in conflict: quantity is the school's position in a title, a copy is an
individually identified object used where custody must name one. **A school that does not serialise
simply has no `book_copies` rows**, and `allocations.copy_id` is therefore **nullable**.

---

## 15. Stock movements and the level projection

**DBD-022 · Stock history is append-only**

**DBT-025 `stock_movements`** — `school_id NOT NULL` **(the column the current table lacks)**,
`movement_type`, `quantity`, `previous_quantity`, `new_quantity`, `reason`, `actor_person_id`.

```sql
CHECK (quantity <> 0)
CHECK (new_quantity = previous_quantity + quantity)     -- the row is self-consistent
CHECK (new_quantity >= 0)                               -- DBI-011
```

**`previous_quantity` and `new_quantity` are kept** — they exist today, they make the history
independently auditable without replaying every prior row, and the `CHECK` turns them from duplication
into a self-validating record.

**DBD-023 · `stock_levels` is a transactionally-maintained projection — and the guarantee is stated
accurately**

*Correction 9, second half.* **PostgreSQL does not independently prove that
`stock_levels.on_hand = SUM(stock_movements.quantity)`.** No declarative constraint expresses it. What
is true, stated exactly:

```
MECHANISM        DBT-026 stock_levels.on_hand is written ONLY in the same transaction that
                 inserts a DBT-025 stock_movements row, by MOD-005, via a conditional
                 UPDATE ... WHERE on_hand >= $qty which takes the row lock.
DB-ENFORCED      CHECK (on_hand >= 0) on the projection itself, and stock_movements'
                 self-consistency and non-negativity checks on each row.
NOT DB-PROVEN    equality between the projection and the sum of the history.
RECONCILIATION   the projection is REBUILDABLE from stock_movements at any time, and a
                 scheduled reconciliation job may verify it.  (Stage 18 owns the cadence.)
CLASSIFICATION   TRANSACTIONALLY ENFORCED PROJECTION + DATABASE CHECK ON THE PROJECTION
                 — not a pure declarative database constraint.
```

*Why a projection rather than always summing:* I-2 must detect insufficient stock **before
committing**, and summing a growing history inside the critical transaction would put an unbounded
scan there. **`books.stock_quantity` — the current single mutable column — is not the target
authority.**

---

## 16. Money events, applications and funding

**DBD-024 · Money received is an event; it is never a lifecycle**

*Current evidence:* `book_payments` fuses 21 columns — the money, **two** lifecycle columns (`status`
**and** `order_status`), review, provider, fulfilment, and `parent_identifier` as text.

**DBT-035 `money_events`** — `guardian_id` **(not an email string)**, `amount numeric(10,2)`, `method`,
`reference`, `received_at`, `recorded_by_person_id`, `provider_event_id` nullable,
`reverses_money_event_id` nullable, and the `amount_applied` projection (§17).

```sql
CHECK (amount > 0)          -- a reversal is a separate row, not a negative amount
UNIQUE (school_id, reference) WHERE reference IS NOT NULL
```

**Direction is carried by the event and its lineage, not by a negative number.** A confirmed money fact
is **never edited in place.**

**DBD-025 · Payment application — OD-1**

**DBT-036 `payment_applications`** — `money_event_id`, `requirement_item_id`, `amount_applied`,
`applied_by_person_id`, `reverses_application_id` nullable.

```sql
CHECK (amount_applied > 0)
UNIQUE (money_event_id, requirement_item_id) WHERE reverses_application_id IS NULL
FOREIGN KEY (school_id, money_event_id)      REFERENCES money_events (school_id, id)
FOREIGN KEY (school_id, requirement_item_id) REFERENCES requirement_items (school_id, id)
```

**OD-1 is satisfied structurally:** one money event may have many application rows; one requirement
item may receive many. **`amount_applied` lives on the link.**

**DBD-026 · Funding adjustments are not money**

**DBT-037 `funding_adjustments`** — `adjustment_type` (`discount` · `subsidy` · `waiver` ·
`school_funded`), `amount`, `reason`, `authorised_by_person_id` (CAP-051 or CAP-052),
`reverses_adjustment_id`. **A waiver is never a £0 payment and never a flag on a payment row.** It is a
different table, so no query reading `money_events` can count it as revenue.

---

## 17. The over-application invariant — stated at its true strength

**DBD-027 · DBI-013 is a transactionally enforced cross-row invariant with a database check on the
projection — not a pure declarative constraint**

*Correction 9.* An earlier draft claimed the `amount_applied` counter plus
`CHECK (amount_applied <= amount)` makes over-application *"impossible at the database level."*
**That is too strong, and it is corrected rather than defended.**

```
WHAT THE CHECK PROVES        the counter itself never exceeds the money event's amount.
WHAT IT DOES NOT PROVE       that SUM(payment_applications.amount_applied) equals the counter.
                             A writer that inserts an application WITHOUT updating the counter
                             would satisfy every declarative constraint and still be wrong.
```

**The mechanism, stated exactly.** MOD-007, in one transaction:

```
1  UPDATE money_events SET amount_applied = amount_applied + $1 WHERE id = $2
        ── takes the row lock; serialises concurrent appliers
2  the CHECK (amount_applied >= 0 AND amount_applied <= amount) fires here
        ── an over-application aborts the transaction at this statement
3  INSERT INTO payment_applications (...)
4  COMMIT — both, or neither
```

**Classification: TRANSACTIONALLY ENFORCED CROSS-ROW INVARIANT + DATABASE CHECK ON THE PROJECTION.**

*The alternative, recorded with its trade-offs.* A **constraint trigger** on `payment_applications`
re-summing on insert would make the equality itself database-proven and would catch a writer that
bypassed step 1. It costs a cross-row read inside every application write, and it puts a business rule
into an opaque trigger body — which §41 rejects as a general pattern. **The trigger is not adopted**,
because the single-writer discipline is enforced by module ownership (Stage 13 CA-P3: only MOD-007's
`data.ts` writes these tables) and because DB-P8's honesty requirement is satisfied by describing the
guarantee accurately rather than by adding machinery to make a stronger sentence true.

**Transactional owner: MOD-007. Locking rule: the money-event row is updated — and therefore locked —
before the application row is inserted, in the same transaction.**

---

## 18. Payment references, provider records and reconciliation

**DBT-038 `payment_references`** — `UNIQUE(school_id, reference)` (**DBI-012**) — migration 006's D5
duplicate-payment finding, made structural.

**DBT-040 `integrations`** — provider-neutral. *Current evidence:* `provider_payments.provider`
defaults to `'stripe'`. **No provider is named in the target schema.**

**DBT-041 `provider_events`** — `UNIQUE (integration_id, external_event_id)` (**DBI-021**). This
generalises an index that already exists and is exactly Stage 14 APID-020's corrected external
idempotency rule: **a provider is never required to send ScholarShelf's `Idempotency-Key` header.**

**DBT-042 `reconciliation_imports`** · **DBT-043 `reconciliation_matches`**. **A provider row never
owns a settlement state**; a match makes a settlement *eligible for confirmation*.

---

## 19. Settlement position — derived, no table

**DBD-028 · There is no settlement-position table and no `paid` column, anywhere**

```
settlement position for a requirement item
  = SUM(requirement_lines.payable_amount)
  − SUM(payment_applications.amount_applied)   where not reversed
  − SUM(funding_adjustments.amount)            where not reversed
```

**Rejected and named so they cannot reappear:** `requirement_items.paid` · `.settled` ·
`.payment_status` · a `settlement_positions` table · `supply_cycles.status` as a settlement state.

*Current evidence for the danger:* `book_payments` has **two** independent lifecycle columns, and
migration 006's finding D6 records that *"the code writes three statuses that PAYMENT_STATUSES does
not declare."* **Two writable authorities disagreed, and the database allowed it.**

**Financially settled ≠ physically handed over.** They are computed from different tables entirely.

---

## 20. I-2 database support and the settlement subject

**DBD-029 · The settlement subject is the REQUIREMENT ITEM — there is no `settlement_subject` entity**

*Correction 8.* An earlier draft gave `settlement_reviews` a `settlement_subject_id` that referenced
nothing. **A physical schema cannot contain an identifier with no target, and it is fixed rather than
explained.**

*Reconciled against the locked stages:* **WF-043 says finance confirms an item.** Stage 6 derives
settlement position **for a requirement item**, and may compose it for a whole cycle. **Therefore the
I-2 confirmation subject is the requirement item.**

**DBT-039 `settlement_reviews`** — `school_id NOT NULL`, **`requirement_item_id`**, `decision`
(`confirmed` · `rejected`), `decided_by_person_id`, `decided_at`, `note`, `idempotency_key_id`
nullable.

```sql
FOREIGN KEY (school_id, requirement_item_id) REFERENCES requirement_items (school_id, id)
CREATE UNIQUE INDEX ON settlement_reviews (school_id, requirement_item_id)
       WHERE decision = 'confirmed';                                        -- DBI-014
```

**Stage 14's `/settlements/:settlementId` remains the API noun.** `settlementId` **is the requirement
item's identifier** — the identifier of the requirement-item settlement subject. **No `settlements`
table is created to make an API noun convenient**, and **a whole-cycle settlement overview remains a
derived read composition** (Stage 14 APID-010).

**DBD-030 · Every row I-2 touches is reachable in one transaction, on one connection**

```
withTransaction(tx)                                  Stage 13 APP-027 / APP-048
  ├── MOD-007  DBT-035 money_events · DBT-036 payment_applications · DBT-039 settlement_reviews
  ├── MOD-008  DBT-044 allocations · DBT-045 custody_events
  ├── MOD-005  DBT-025 stock_movements · DBT-026 stock_levels
  └── MOD-009  DBT-053 notifications                 required consequence, same commit
ONE COMMIT
```

**Two concurrent confirmations cannot both succeed** — the second violates DBI-014's partial unique
index and its transaction rolls back whole, which is Stage 14 API-120's `409
SETTLEMENT_ALREADY_CONFIRMED`. **The guarantee moves from a conditional `UPDATE` that must be written
correctly every time to an index that cannot be written incorrectly.**

| Purpose | Mechanism |
|---|---|
| exactly one confirmation | **DBI-014** partial unique index |
| stock cannot go negative | **DBI-011** `CHECK (new_quantity >= 0)` |
| stock decrement serialises | conditional `UPDATE stock_levels … WHERE on_hand >= $qty` |
| money cannot over-apply | **DBI-013** — §17's mechanism, at its true strength |
| one allocation per requirement line | **DBI-015** |
| tenant coherence across four modules | composite FKs (§12) |
| retry safety | **DBI-016** (§21) |

**RLS interaction:** all four modules' tables are school-owned and covered by the TENANT class; the
context is set once with `SET LOCAL` at the start of the transaction; **all four writes occur in that
one context on that one connection.** No RLS model requiring a second connection or a mid-transaction
context switch is chosen. **I-2 outranks convenience** — and A13-001 (§7.7) exists precisely so that
scoped *reads* do not force a weaker arrangement on it.

---

## 21. Idempotency persistence

**DBD-031 · A generic idempotency record plus operation-specific uniqueness**

**DBT-070 `idempotency_keys`** — `scope_kind` (§5), `school_id`, `person_id`, `operation`,
`idempotency_key`, `request_fingerprint`, `state`, `response_snapshot jsonb` bounded, timestamps. Its
two scope-explicit partial uniques are **DBI-016** (§5).

```
same key + same fingerprint      → replay response_snapshot                 200
same key + different fingerprint → 409
different key + business done    → the OPERATION-SPECIFIC constraint refuses  409
                                   (e.g. DBI-014's partial unique)
```

**Both mechanisms are needed.** The generic table makes a *retry* safe; the operation-specific
constraint makes the *business* safe against a second attempt arriving with a fresh key.

**`request_fingerprint` is a hash, not the body.** **Stage 16 owns secure canonicalisation.** Growth is
bounded by retention; **Stage 18 sets the window.**
---

## 22. Allocation, custody, fulfilment instruction and handover

MOD-008 owns MA-1: **the allocation (DM-040) is owned here**, written inside I-2's transaction by the
command MOD-007 initiates (Stage 13 APP-048). This section fixes the physical shape of what the
current `finance_book_allocations` table conflates.

### 22.1 The defect being corrected

`finance_book_allocations` carries **three status columns** in one row — read directly from
`shared/schema.ts`. A single row therefore attempts to state four different facts at once: what is
owed, whether stock left the store, whether a child received it, and whether something went wrong.
Each of those facts has a different owner, a different capability and a different point in time.

**DBD-032 · One allocation row states what is OWED and nothing else**

| The fact | Where it lives now | Where it lives after |
|---|---|---|
| what is owed to a child | `finance_book_allocations` + status | **DBT-044 `allocations`** — no status columns |
| stock left the store | a status column | **DBT-025 `stock_movements`** (§15) |
| the child received it | a status column | **DBT-047 `handover_events`** |
| something went wrong | a status column | **DBT-046 `fulfilment_exceptions`** |
| the route to the child | not modelled | **DBT-048 `fulfilment_instructions`** |
| the full custody history | not modelled | **DBT-045 `custody_events`** |

`allocations` therefore has **no status column at all**. Its state is derived from the event tables
that reference it — the same discipline as §19's settlement position. **A status column is a cache of
events; Stage 15 keeps the events and derives the cache, never the reverse.**

### 22.2 The allocation row

**DBT-044 `allocations`** — `id`, `school_id NOT NULL`, `requirement_line_id`, `child_id`,
`book_id`, `quantity`, `created_at`, `cancelled_at`, `cancelled_by_person_id`, `cancellation_reason`.

**DBI-015 · `UNIQUE (school_id, requirement_line_id) WHERE cancelled_at IS NULL`** — one live
allocation per requirement line. Cancellation is a column on the row rather than a delete, because a
cancelled allocation is evidence that stock was once committed. The composite FK to
`requirement_lines` carries `school_id` (§12).

### 22.3 Custody is append-only

**DBT-045 `custody_events`** (DM-042) is **preserved from the current table** — it is one of the
structures §2.4 identified as already correct. `id`, `school_id`, `allocation_id`, `event_kind`,
`from_holder_kind`, `from_holder_id`, `to_holder_kind`, `to_holder_id`, `occurred_at`,
`recorded_by_person_id`, `note`.

**DB-P9 applies without exception: no `UPDATE`, no `DELETE`.** A mistaken custody event is corrected
by a compensating event that names the event it corrects (`corrects_event_id`), never by editing
history. This is what makes the custody chain admissible as evidence in a dispute.

### 22.4 Handover is the one reached-the-child fact

**DBT-047 `handover_events`** (DM-043) — the single fact that a child received their books. Written by
CAP-063 `record_hand_over` (teacher, SC-3, CD-2, **CD-5 own-child block**) or CAP-064
`record_reception_collection` (office). `id`, `school_id`, `allocation_id`, `route`,
`recorded_by_person_id`, `recorded_for_child_id`, `occurred_at`, `is_correction`,
`corrects_event_id`, `signature_object_id`.

**DBI-017 · `UNIQUE (school_id, allocation_id) WHERE is_correction = false`** — an allocation is
handed over once. A correction row is permitted and is excluded from the index, so the correction
mechanism does not require the original to be destroyed.

**CD-5 is a capability condition, not a database constraint.** The database records
`recorded_by_person_id` and `recorded_for_child_id` faithfully; **Stage 7's condition, enforced in the
application, is what prevents a teacher recording a handover for their own child.** Stage 15 does not
attempt to express a guardian-relationship rule as a `CHECK`, because the predicate would need to
consult three other tables and would violate DB-P19's spirit (a constraint that silently changes
meaning when the relationship data changes). **This is recorded honestly rather than claimed as a
database guarantee.**

### 22.5 The fulfilment instruction — at requirement-item grain

**DBD-033 · The route is chosen per REQUIREMENT ITEM, not per cycle and not per allocation**

**DBT-048 `fulfilment_instructions`** (DM-039) — `id`, `school_id NOT NULL`, `requirement_item_id`,
`route`, `chosen_by_person_id`, `chosen_at`, `superseded_at`, `superseded_by_instruction_id`, `note`.

**DBI-030 · `UNIQUE (school_id, requirement_item_id) WHERE superseded_at IS NULL`** — **there is one
active instruction per requirement item.** Changing the route inserts a new row and stamps the old
one; it never overwrites. The history of who routed what, and when, survives.

**Why requirement-item grain and not cycle grain:** the cycle is the school's supply exercise, but the
thing that is actually routed to a child is the requirement item. Two children in the same cycle can
legitimately be reached by different routes — one collects at reception because they were absent on
distribution day, another receives theirs in the classroom.

**Why requirement-item grain and not allocation grain:** the route is chosen *before* stock is
committed, and it must survive an allocation being cancelled and re-made. Attaching the route to the
allocation would lose the school's decision every time the allocation was redone.

**A replacement requirement item may therefore have `route = reception` even where the original
requirement item used `route = classroom`.** This is not an inconsistency to be prevented — it is the
normal and expected case, and the schema must be able to represent it. **A cycle-level route column
could not.**

### 22.6 Exceptions are events, not a status

**DBT-046 `fulfilment_exceptions`** (DM-044) — `id`, `school_id`, `allocation_id`, `exception_kind`
(absence · out of stock · damage · dispute · other), `raised_by_person_id`, `raised_at`,
`resolved_at`, `resolved_by_person_id`, `resolution_note`.

**Many exceptions may exist for one allocation**, and an allocation may be handed over after an
exception was raised and resolved. The current single status column can represent neither. There is no
uniqueness constraint here by design.

### 22.7 Returns

**DBT-052 `returns`** — `id`, `school_id`, `allocation_id`, `book_copy_id`, `condition`,
`returned_at`, `received_by_person_id`, `note`. A return **writes a custody event and a stock movement
in the same transaction as the return row** (Stage 13 APP-048 — the command owns the transaction). It
is never a status flip.

---

## 23. Replacement — three tables because there are three decisions

The current prototype has one replacement concept. Stage 6 and Stage 7 establish that three distinct
people make three distinct decisions, under three distinct capabilities, at three distinct times.

**DBD-034 · A request, an operational review and a financial decision are separate rows**

| Row | Who | Capability | Question answered |
|---|---|---|---|
| **DBT-049 `replacement_requests`** | teacher | CAP-067 | *a book is lost or damaged* |
| **DBT-050 `replacement_reviews`** | school admin | CAP-069 | *does the child get another copy* |
| **DBT-051 `replacement_charge_decisions`** | finance | CAP-070 | *does the family pay for it* |

Collapsing these into one row would force one capability to imply the others, which contradicts the
Stage 7 chain — and would make it impossible to record that a replacement was **issued but not
charged**, which is a routine school outcome.

### 23.1 The request and the review

**DBT-049 `replacement_requests`** — `id`, `school_id`, `child_id`, `requirement_item_id`, `book_id`,
`reason_kind`, `raised_by_person_id`, `raised_at`, `evidence_object_id`, `note`.

**DBT-050 `replacement_reviews`** — `id`, `school_id`, `replacement_request_id`, `outcome`
(`approved` · `refused` · `deferred`), `decided_by_person_id`, `decided_at`, `replacement_requirement_item_id`,
`revision`, `note`. An approved review is what creates the **replacement requirement item**, which then
gets its own fulfilment instruction (§22.5) and its own allocation.

### 23.2 The charge decision — supersession, not overwrite

**DBT-051 `replacement_charge_decisions`** — `id`, `school_id NOT NULL`, `replacement_request_id`,
`decision` (`charge` · `absorb` · `partial`), `amount numeric(10,2)`, `money_event_id`,
`decided_by_person_id`, `decided_at`, **`superseded_at`**, **`superseded_by_decision_id`**, `reason`.

**DBI-018 · `UNIQUE (school_id, replacement_request_id) WHERE superseded_at IS NULL`** — one live
charge decision per request.

**Why supersession columns and not a revision counter:** a charge decision can have **produced a money
event**. If finance reverses the decision, the original decision and the money event it produced must
both remain visible, because the money event is itself append-only (§16) and may already have been
applied to a requirement item. **A revision counter would state that the decision changed; supersession
columns state what the decision was, what replaced it, and when — which is what a finance dispute
actually needs.**

`superseded_by_decision_id` is a self-referencing FK carrying `school_id` (§12), producing an explicit
chain rather than an implicit ordering by timestamp. **Two decisions written in the same second remain
unambiguously ordered.**

---

## 24. Communication and notification truth

MOD-009 holds the **required consequence** side of I-2: the notification row is written inside the same
transaction (§20, DBD-030). Everything that *sends* is outside.

**DBD-035 · The notification is the truth; the delivery attempt is the history**

**DBT-053 `notifications`** (DM-051) — `id`, **`scope_kind`** (§5 discriminator), `school_id`,
`recipient_person_id`, `notification_kind`, `subject_kind`, `subject_id`, `payload jsonb` (bounded,
**no credentials, no signed URLs, no raw provider bodies**), `created_at`, `read_at`.

`scope_kind` is required because a platform-scope notification (a tenant lifecycle event) legitimately
has no `school_id`, and §5's discriminator plus its `CHECK` is how Stage 15 states that without
letting a school-scope row lose its tenant. **DBI-022** is the corresponding scoped uniqueness where a
notification kind must not duplicate for one subject.

**DBT-054 `delivery_attempts`** (DM-052) — `id`, `notification_id`, `channel`, `attempted_at`,
`outcome`, `provider_reference`, `failure_class`. Tenancy reaches this table **via the notification**
(§6's derived-ownership class), not by a duplicated column, because the notification's scope is already
authoritative and duplicating it would create a second place to be wrong.

**Never stored here:** the message body as sent, any recipient credential, any signed URL, any provider
payload. `failure_class` is a bounded classification, not a provider error string.

### 24.1 Threads, messages and preferences

**DBT-055 `message_threads`** — `id`, `school_id NOT NULL`, `thread_kind`, `subject_kind`,
`subject_id`, `opened_by_person_id`, `opened_at`, `closed_at`.

**DBT-056 `messages`** — `id`, `school_id NOT NULL`, `thread_id`, `author_person_id`, `body`,
`sent_at`, `redacted_at`. `school_id` is carried on `messages` as well as on the thread, and the
composite FK (§12) ties them — a message cannot reference a thread in a different school.

**DBT-057 `notification_preferences`** — `id`, `school_id NOT NULL` (**added; the current model has no
tenant column here**), `person_id`, `notification_kind`, `channel`, `enabled`. A person who is a
guardian at two schools has two preference sets, which is correct: a preference is a relationship
between a person and a school, not a global property of the person.

**Preferences never gate the notification row.** The notification is written inside I-2 regardless;
preferences govern **delivery attempts only**. Otherwise a preference change could silently destroy the
durable record that I-2 requires.

---

## 25. Scheduled work

**DBT-069 `jobs`** (DM-055) — MOD-014's only table. `id`, **`scope_kind`**, `school_id`, `job_kind`,
`scheduled_for`, `state`, `attempt_count`, `locked_at`, `locked_by`, `last_error_class`,
`created_at`, `completed_at`.

**DBI-020 · two scope-explicit partial unique indexes** (§5) —

```
UNIQUE (job_kind, school_id, scheduled_for) WHERE scope_kind = 'school'
UNIQUE (job_kind, scheduled_for)            WHERE scope_kind = 'platform'
```

**This is the corrected form.** The current `cron_job_runs` uses `uniqueIndex(job, school_id,
run_date)` on a nullable `school_id`, and **PostgreSQL treats NULLs as distinct** — so that index does
not prevent two platform-wide runs of the same job on the same date from both being inserted. It
enforces nothing at exactly the point it was written to enforce something. **The two partial indexes,
keyed off the explicit discriminator, enforce both cases.**

`last_error_class` is a bounded classification, not a stack trace or a provider message. **Stage 19
owns what is recorded about a failure beyond that classification; Stage 18 owns retention.**

**A job row is never the authority for a business fact.** It records that work was scheduled and how it
ended. The business effect lives in the module's own tables, written by the module's own command inside
its own transaction (Stage 13 APP-049 — `application/jobs/` is the only gateway caller).

---

## 26. Object storage metadata

**DBD-036 · No file bytes are stored in PostgreSQL**

The current `media_assets.dataUri` holds **base64 file content in a database column**. This is
preserved as data until migration (§44) but is not the target shape.

**DBT-071 `object_uploads`** — `id`, `school_id NOT NULL`, `storage_key`, `declared_filename`,
`declared_content_type`, `detected_content_type`, `byte_size`, `checksum`, **`trust_state`**,
`uploaded_by_person_id`, `uploaded_at`, `scanned_at`, `published_at`.

**DBI-028 · `UNIQUE (storage_key)`** — global and unconditional. A storage key identifies one object in
one object store; two schools cannot claim the same key.

**Four trust states, in order:** `received` → `verified` → `published` → `quarantined`. Nothing in the
public site may reference an object that is not in `published` (§27, and the PUBLICATION policy class
of §7.6). **Stage 16 owns what `verified` requires** — content-type verification, scanning policy,
signed-URL issuance — and Stage 15 fixes only that the state exists, is bounded, and is a precondition
the schema can express.

`detected_content_type` is deliberately separate from `declared_content_type`: **the uploader's claim
and the system's finding are two different facts and must not overwrite one another.**

---

## 27. CMS revisions and the publication boundary

MOD-011's target shape is a revision model, because the current
`school_website_sections.isPublished` is a **boolean on the live row** — which means editing a
published section edits the public site immediately, with no draft state and no way to revert.

**DBD-037 · Publishing moves a pointer; it never mutates content**

**DBT-058 `site_settings`** — `school_id NOT NULL` (1:1), **`current_revision_id`**,
**`published_revision_id`**, `revision`, `updated_at`, `updated_by_person_id`.

**DBT-059 `site_revisions`** — `id`, `school_id`, `created_from_revision_id`, `created_at`,
`created_by_person_id`, `published_at`, `published_by_person_id`, `frozen`.

```
edit            → writes into current_revision_id's rows
publish         → published_revision_id := current_revision_id   ONE UPDATE
                  that revision is FROZEN from that moment
revert          → published_revision_id := an earlier revision   ONE UPDATE
```

**A published revision is frozen: its pages, sections, news, events and media links are never updated
or deleted.** Continuing to edit creates a new revision by copy. Revert is therefore always possible
and always exact — it is a pointer move, not a reconstruction.

**DBT-060 `site_pages`** · **DBT-061 `page_sections`** · **DBT-062 `site_news`** · **DBT-063
`site_events`** · **DBT-064 `site_media_links`** all carry `school_id` **and** `revision_id`, with
composite FKs (§12) so a page cannot belong to another school's revision.

**DBI-023 · `UNIQUE (school_id, revision_id, slug)`** on pages, and the equivalent on news and events.
The slug is unique **within a revision**, not globally — two revisions legitimately contain the same
slug, which is the whole point of a revision model.

**Sections are structured, not arbitrary HTML.** `page_sections` holds a bounded `section_kind` plus
typed fields; it does not hold a free HTML blob. This is what allows the public renderer to be safe by
construction rather than by sanitisation, and it is why Stage 12's AQ-1 = B decision is
implementable.

**DBT-065 `site_presentation`** holds **the public website theme only** — the `--site-*` tokens
extracted from `school_branding`'s colour columns. **DBT-003 `school_identity`** holds Core identity.
The current `school_branding` table fuses both in 18 columns; **the split is the physical expression of
Stage 12's Core identity wall.** Nothing in `site_presentation` can alter the authenticated
application's appearance.

**DBT-066 `site_contact`** holds **public contact information only** — never a guardian's or a staff
member's personal email. The PUBLICATION policy class (§7.6) reads exactly these tables, and only where
`revision_id = published_revision_id`.

---

## 28. Import staging

**DBD-038 · Parser output is staged relationally and is never authoritative**

**DBT-072 `import_sessions`** — `id`, `school_id`, `import_kind`, `source_filename`,
`uploaded_object_id`, `state`, `created_by_person_id`, `created_at`, `committed_at`.

**DBT-073 `import_rows`** — `id`, `school_id`, `import_session_id`, `row_number`, `raw jsonb`,
`parsed_first_name`, `parsed_last_name`, `parsed_class_name`, `normalised_class_name`,
`match_kind`, `matched_child_id`, `validation_state`, `validation_messages jsonb`.

Rows are **relational and queryable**, not a blob. The admin reviews and corrects them before commit;
that review is impossible against an opaque payload.

**DBT-074 `import_proposed_classes`** — `id`, `school_id`, `import_session_id`, `proposed_name`,
**`normalised_name`**, `matched_class_id`, `will_create`. **This table exists to stop duplicate-class
forking**: without it, "3 Blue", "3B" and "Year 3 Blue" in one spreadsheet silently become three
classes. Normalisation happens at staging time, is shown to the admin, and the admin's choice is
recorded before anything is created.

**Commit is one transaction.** A partially committed import is not a state the schema permits.

---

## 29. Platform operations and support

**DBT-067 `support_engagements`** — `id`, `school_id NOT NULL`, `actor_person_id`, `reason`,
`started_at`, `ended_at`, `ended_reason`.

**DBI-024 · `UNIQUE (actor_person_id) WHERE ended_at IS NULL`** — **a support actor is in at most one
engagement at a time, across all tenants.** This is deliberately a global partial unique and not a
per-school one: the risk being prevented is a platform person holding simultaneous access to two
schools, which a per-school index would permit.

Support engagements are what SC-6 scopes and what PA-2 requires for account recovery. **The 11 typed
support projections (Stage 14 API-260…API-270, CAP-088) read through this engagement; there is no
wildcard.** CAP-089 `run_readonly_query` is separately bounded by the read-only privilege class
(§7.9).

**DBT-068 `tenant_onboarding`** — platform-scope, **no tenant column**, because it records the state of
bringing a school into existence, which necessarily precedes the school row's usable life.

---

## 30. Deferred boundaries — what Stage 15 does not shape

Three tables are named in the target model but receive **no DBT identifier**, per §1.1's counting rule.
They appear in no count and in no ERD as Stage-15-shaped structures.

| Table | Module | Owner of its shape | Why |
|---|---|---|---|
| `audit_events` | MOD-013 | **Stage 19** | Stage 19 owns the record mechanics *and* the schema. Fixing columns here would pre-empt it. |
| `console_operations` | MOD-012 | **Stage 16 / 19** — DM-054 | the typed support operation record; its fields follow from Stage 16's security model |
| `message_audit_logs` | MOD-013 | **Stage 19** | folded into Stage 19's scope rather than shaped twice |

**This is not a gap.** Stage 15 states that these tables exist, which module owns them, and which stage
fixes their columns. **A deferred table with a named owner is a resolved boundary; an unmentioned table
would be a gap.**

### 30.1 Two infrastructure tables whose shape Stage 15 does fix

**DBT-075 `user_sessions`** — `sid`, `sess`, `expire`. **Its shape is fixed by the library Stage 11
locked** (`connect-pg-simple`), not by Stage 15's preference, and it therefore receives a DBT
identifier because Stage 15 *is* stating its physical shape — the statement is "these three columns,
as the store requires". **Stage 16 owns what goes inside `sess`**, session lifetime, rotation and
cookie policy. Stage 15 does not add `school_id` here: a session belongs to a person, and the active
context inside it is Stage 16's business.

**DBT-076 `rate_limits`** — durable rate-limit counters, receiving a DBT identifier on the same basis:
Stage 15 fixes that the counters are **durable rows in PostgreSQL rather than process memory**, because
the deployment target is serverless (Stage 11) and process memory does not survive between
invocations. **Stage 16 owns the algorithm, the dimensions, the windows and the thresholds.**

**These two are stated consistently: shape here, semantics in Stage 16.** They are counted; the three
in the table above are not.

---

## 31. History classes — how the schema remembers

Five distinct mechanisms are used, each chosen for a stated reason. **A table uses exactly one.**

| Class | Mechanism | Used by | Chosen because |
|---|---|---|---|
| **APPEND-ONLY EVENTS** | insert only; corrections are compensating rows | `custody_events` · `stock_movements` · `money_events` · `school_lifecycle_events` · `provider_events` · `delivery_attempts` | the history *is* the truth; a projection can be rebuilt from it |
| **SUPERSESSION** | `superseded_at` + `superseded_by_*_id` + partial unique | `replacement_charge_decisions` · `fulfilment_instructions` | the superseded row produced consequences that must stay visible |
| **REVISION POINTER** | a frozen revision plus a pointer | `site_settings` → `site_revisions` | publishing and reverting must be exact, not reconstructed |
| **REVISION COUNTER** | an integer bumped on write, used for 412 | `school_configuration` · `replacement_reviews` · `site_settings` | concurrent edit detection, not history |
| **SOFT LIFECYCLE COLUMN** | `cancelled_at` · `revoked_at` · `ended_at` | `allocations` · `school_entitlements` · `support_engagements` | the row's *existence* remains evidence after it stops being live |

**The revision counter is not a history mechanism** and is never presented as one — it exists to make
Stage 14's `412` precondition checks correct. Where Stage 14 requires 412, Stage 15 provides the
counter; where a caller needs the past, one of the other four classes provides it.

**Nothing in this schema is hard-deleted by ordinary operation.** The only deletions are §38's erasure
map and CAP-092 `purge_tenant`, both of which are deliberate, capability-gated and out of the
application's normal path.

---

## 32. Foreign key register

Every foreign key is listed with its tenancy form and its delete behaviour. **Composite FKs carrying
`school_id`** (§12) are marked ⊕.

| # | From | To | Form | On delete |
|---|---|---|---|---|
| FK-01 | `school_lifecycle_events.school_id` | `schools` | simple | RESTRICT |
| FK-02 | `school_identity.school_id` | `schools` | simple | RESTRICT |
| FK-03 | `school_configuration.school_id` | `schools` | simple | RESTRICT |
| FK-04 | `school_entitlements.school_id` | `schools` | simple | RESTRICT |
| FK-05 | `school_public_domains.school_id` | `schools` | simple | RESTRICT |
| FK-06 | `credentials.person_id` | `persons` | simple | CASCADE |
| FK-07 | `school_memberships.person_id` | `persons` | simple | RESTRICT |
| FK-08 | `school_memberships.school_id` | `schools` | simple | RESTRICT |
| FK-09 | `authority_grants.person_id` | `persons` | simple | RESTRICT |
| FK-10 | `authority_grants.school_id` | `schools` | simple, nullable per `scope_kind` | RESTRICT |
| FK-11 | `invites.school_id` | `schools` | simple | RESTRICT |
| FK-12 | `academic_periods.school_id` | `schools` | simple | RESTRICT |
| FK-13 | `period_rollover_runs` | `academic_periods` | ⊕ | RESTRICT |
| FK-14 | `classes` | `academic_periods` | ⊕ | RESTRICT |
| FK-15 | `class_staffing` | `classes` | ⊕ | RESTRICT |
| FK-16 | `class_staffing` | `school_memberships` | ⊕ | RESTRICT |
| FK-17 | `class_memberships` | `classes` | ⊕ | RESTRICT |
| FK-18 | `class_memberships` | `children` | ⊕ | RESTRICT |
| FK-19 | `children.school_id` | `schools` | simple | RESTRICT |
| FK-20 | `families.school_id` | `schools` | simple | RESTRICT |
| FK-21 | `guardians.person_id` | `persons` | simple | RESTRICT |
| FK-22 | `guardian_child_relationships` | `guardians` · `children` | ⊕ | RESTRICT |
| FK-23 | `child_link_codes` | `children` | ⊕ | RESTRICT |
| FK-24 | `books.school_id` | `schools` | simple | RESTRICT |
| FK-25 | `book_copies` | `books` | ⊕ | RESTRICT |
| FK-26 | `stock_movements` | `books` | ⊕ | RESTRICT |
| FK-27 | `stock_levels` | `books` | ⊕ | RESTRICT |
| FK-28 | `bundle_lines` | `bundles` · `books` | ⊕ | RESTRICT |
| FK-29 | `class_bundle_assignments` | `bundles` · `classes` | ⊕ | RESTRICT |
| FK-30 | `supply_cycles` | `academic_periods` | ⊕ | RESTRICT |
| FK-31 | `requirement_items` | `supply_cycles` · `children` | ⊕ | RESTRICT |
| FK-32 | `requirement_lines` | `requirement_items` · `books` | ⊕ | RESTRICT |
| FK-33 | `child_requirement_overrides` | `requirement_items` | ⊕ | RESTRICT |
| FK-34 | `child_selections` | `requirement_lines` | ⊕ | RESTRICT |
| FK-35 | `money_events` | `schools` | simple | RESTRICT |
| FK-36 | `payment_applications` | `money_events` · `requirement_items` | ⊕ | RESTRICT |
| FK-37 | `funding_adjustments` | `requirement_items` | ⊕ | RESTRICT |
| FK-38 | `payment_references` | `requirement_items` | ⊕ | RESTRICT |
| FK-39 | `settlement_reviews` | `requirement_items` | ⊕ | RESTRICT |
| FK-40 | `provider_events` | `integrations` | ⊕ | RESTRICT |
| FK-41 | `reconciliation_matches` | `reconciliation_imports` · `money_events` | ⊕ | RESTRICT |
| FK-42 | `allocations` | `requirement_lines` · `children` · `books` | ⊕ | RESTRICT |
| FK-43 | `custody_events` | `allocations` | ⊕ | RESTRICT |
| FK-44 | `fulfilment_exceptions` | `allocations` | ⊕ | RESTRICT |
| FK-45 | `handover_events` | `allocations` | ⊕ | RESTRICT |
| FK-46 | `handover_events.corrects_event_id` | `handover_events` | ⊕ self | RESTRICT |
| FK-47 | `fulfilment_instructions` | `requirement_items` | ⊕ | RESTRICT |
| FK-48 | `fulfilment_instructions.superseded_by_instruction_id` | `fulfilment_instructions` | ⊕ self | RESTRICT |
| FK-49 | `replacement_requests` | `children` · `requirement_items` | ⊕ | RESTRICT |
| FK-50 | `replacement_reviews` | `replacement_requests` | ⊕ | RESTRICT |
| FK-51 | `replacement_charge_decisions` | `replacement_requests` · `money_events` | ⊕ | RESTRICT |
| FK-52 | `replacement_charge_decisions.superseded_by_decision_id` | `replacement_charge_decisions` | ⊕ self | RESTRICT |
| FK-53 | `returns` | `allocations` · `book_copies` | ⊕ | RESTRICT |
| FK-54 | `notifications.school_id` | `schools` | simple, nullable per `scope_kind` | RESTRICT |
| FK-55 | `delivery_attempts.notification_id` | `notifications` | simple — tenancy derived | CASCADE |
| FK-56 | `messages` | `message_threads` | ⊕ | RESTRICT |
| FK-57 | `notification_preferences` | `persons` · `schools` | simple | RESTRICT |
| FK-58 | `site_settings.published_revision_id` | `site_revisions` | ⊕ | RESTRICT |
| FK-59 | `site_settings.current_revision_id` | `site_revisions` | ⊕ | RESTRICT |
| FK-60 | `site_pages` | `site_revisions` | ⊕ | CASCADE within an unpublished revision |
| FK-61 | `page_sections` | `site_pages` | ⊕ | CASCADE within an unpublished revision |
| FK-62 | `site_news` · `site_events` | `site_revisions` | ⊕ | CASCADE within an unpublished revision |
| FK-63 | `site_media_links` | `site_revisions` · `object_uploads` | ⊕ | RESTRICT |
| FK-64 | `site_presentation` · `site_contact` | `schools` | simple | RESTRICT |
| FK-65 | `support_engagements` | `schools` · `persons` | simple | RESTRICT |
| FK-66 | `jobs.school_id` | `schools` | simple, nullable per `scope_kind` | RESTRICT |
| FK-67 | `idempotency_keys.school_id` | `schools` | simple, nullable per `scope_kind` | RESTRICT |
| FK-68 | `object_uploads` | `schools` | simple | RESTRICT |
| FK-69 | `import_rows` | `import_sessions` | ⊕ | CASCADE |
| FK-70 | `import_proposed_classes` | `import_sessions` | ⊕ | CASCADE |

**`RESTRICT` is the default and it is deliberate.** `CASCADE` appears in exactly four places, each one a
case where the child row has no meaning whatsoever without its parent: a credential without its person,
a delivery attempt without its notification, staged import rows without their session, and content
inside an **unpublished** revision. **No cascade path can reach a published revision, a money event, a
custody event or an allocation.** The ABSOLUTE SAFETY RULE is enforced structurally, not by discipline.
---

## 33. Uniqueness register — DBI-001 … DBI-030

Every uniqueness guarantee in the target schema, with the exact predicate and the rule it enforces.
**A guarantee that is not in this register does not exist.**

| DBI | Table | Constraint | Enforces |
|---|---|---|---|
| **DBI-001** | `schools` | `UNIQUE (code)` | one code, one tenant |
| **DBI-002** | `persons` | `UNIQUE (email)` on `citext` | **one human, once** — the identity decomposition of §8 |
| **DBI-003** | `school_memberships` | `UNIQUE (person_id, school_id)` | a person joins a school once; replaces `teacher_profiles`' partial view of this |
| **DBI-004** | `classes` | `UNIQUE (school_id, period_id, normalised_name)` | **stops duplicate-class forking** — pairs with DBT-074 |
| **DBI-005** | `class_memberships` | `UNIQUE (child_id, period_id) WHERE ended_at IS NULL` | **OD-3** — one active class membership per child per period |
| **DBI-006** | `supply_cycles` | `UNIQUE (school_id, child_id, period_id)` | **DM-023** — one cycle per child per period |
| **DBI-007** | `guardian_child_relationships` | `UNIQUE (guardian_id, child_id) WHERE ended_at IS NULL` | the authoritative **SC-4** fact is single-valued |
| **DBI-008** | `books` | `UNIQUE (school_id, isbn) WHERE isbn IS NOT NULL` | ISBN is unique where present; books without one are legitimate |
| **DBI-009** | `bundle_lines` | `UNIQUE (school_id, bundle_id, book_id)` | a book appears once in a bundle |
| **DBI-010** | `class_bundle_assignments` | `UNIQUE (school_id, class_id, period_id, bundle_id)` | a bundle is assigned to a class once per period |
| **DBI-011** | `stock_movements` | *(constraint, not index — see §34 CK-11/CK-12)* | the running balance cannot go negative |
| **DBI-012** | `payment_references` | `UNIQUE (school_id, reference)` | a family's payment reference resolves to one item |
| **DBI-013** | `money_events` | *(see §17 — cross-row invariant + `CHECK` on the projection)* | **money cannot be over-applied** |
| **DBI-014** | `settlement_reviews` | `UNIQUE (school_id, requirement_item_id) WHERE outcome = 'confirmed'` | **I-2** — exactly one confirmation, enforced by index |
| **DBI-015** | `allocations` | `UNIQUE (school_id, requirement_line_id) WHERE cancelled_at IS NULL` | one live allocation per requirement line |
| **DBI-016** | `idempotency_keys` | two scope-explicit partial uniques (§5) | retry safety without NULL-distinctness |
| **DBI-017** | `handover_events` | `UNIQUE (school_id, allocation_id) WHERE is_correction = false` | a child is reached once; corrections remain possible |
| **DBI-018** | `replacement_charge_decisions` | `UNIQUE (school_id, replacement_request_id) WHERE superseded_at IS NULL` | one live charge decision |
| **DBI-019** | `academic_periods` | `UNIQUE (school_id, name)` | **OD-2** — the period is school-owned and named once |
| **DBI-020** | `jobs` | two scope-explicit partial uniques (§25) | **corrects the NULL-distinctness defect in `cron_job_runs`** |
| **DBI-021** | `provider_events` | `UNIQUE (integration_id, external_event_id)` | a provider signal is recorded once, however often it is delivered |
| **DBI-022** | `notifications` | `UNIQUE (scope_kind, school_id, notification_kind, subject_kind, subject_id) WHERE deduplicated` | one durable notification per subject event |
| **DBI-023** | `site_pages` · `site_news` · `site_events` | `UNIQUE (school_id, revision_id, slug)` | slugs are unique **within a revision**, not globally |
| **DBI-024** | `support_engagements` | `UNIQUE (actor_person_id) WHERE ended_at IS NULL` | **one engagement at a time, across all tenants** |
| **DBI-025** | `school_public_domains` | `UNIQUE (hostname)` | global — a hostname resolves to exactly one school |
| **DBI-026** | `school_entitlements` | `UNIQUE (school_id, module) WHERE revoked_at IS NULL` | **MA-2** — one live entitlement fact per module |
| **DBI-027** | `academic_periods` | `EXCLUDE USING gist (school_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)` | **periods within a school cannot overlap** |
| **DBI-028** | `object_uploads` | `UNIQUE (storage_key)` | global — one key, one object |
| **DBI-029** | `child_link_codes` | `UNIQUE (code_hash)` | **global and unconditional** — a link code is a credential (§11) |
| **DBI-030** | `fulfilment_instructions` | `UNIQUE (school_id, requirement_item_id) WHERE superseded_at IS NULL` | one active route per requirement item (§22.5) |

**DBI-027 requires the `btree_gist` extension** (§39). It is the only exclusion constraint in the
schema, and it exists because overlapping academic periods silently corrupt every downstream
period-scoped query — which no application check reliably prevents once two admins are editing.

**DB-P19 check:** no predicate above references `now()`, `current_date` or any wall-clock function.
DBI-029's predicate was made unconditional for exactly this reason (§11): an expiry-aware partial
unique would let an expired code's hash be reissued, which is a credential-reuse hazard, and would make
the index's meaning change without any write occurring.

---

## 34. Check constraint register

| # | Table | Constraint | Purpose |
|---|---|---|---|
| CK-01 | `authority_grants` | `CHECK ((scope_kind = 'school') = (school_id IS NOT NULL))` | the §5 discriminator is honest |
| CK-02 | `notifications` | same shape | as above |
| CK-03 | `jobs` | same shape | as above |
| CK-04 | `idempotency_keys` | same shape | as above |
| CK-05 | `academic_periods` | `CHECK (ends_on > starts_on)` | a period has positive length |
| CK-06 | `requirement_lines` | `CHECK (quantity > 0)` | a requirement line is for at least one book |
| CK-07 | `requirement_lines` | `CHECK (unit_price >= 0)` | a price snapshot is never negative |
| CK-08 | `money_events` | `CHECK (amount > 0)` | **money received is positive; a refund is its own event kind, not a negative amount** |
| CK-09 | `money_events` | `CHECK (amount_applied >= 0 AND amount_applied <= amount)` | §17 — the projection bound |
| CK-10 | `payment_applications` | `CHECK (amount_applied > 0)` | a zero application is not an application |
| CK-11 | `stock_movements` | `CHECK (new_quantity = previous_quantity + quantity_delta)` | the running balance is arithmetically sound |
| CK-12 | `stock_movements` | `CHECK (new_quantity >= 0)` | **stock cannot go negative** |
| CK-13 | `stock_levels` | `CHECK (on_hand >= 0)` | the projection agrees with CK-12 |
| CK-14 | `funding_adjustments` | `CHECK (amount > 0)` | direction is carried by kind, not by sign |
| CK-15 | `replacement_charge_decisions` | `CHECK ((decision = 'absorb') = (amount IS NULL))` | absorbing costs the family nothing, and says so |
| CK-16 | `handover_events` | `CHECK ((is_correction = false) = (corrects_event_id IS NULL))` | a correction names what it corrects |
| CK-17 | `fulfilment_instructions` | `CHECK ((superseded_at IS NULL) = (superseded_by_instruction_id IS NULL))` | supersession is complete or absent |
| CK-18 | `replacement_charge_decisions` | same shape as CK-17 | as above |
| CK-19 | `object_uploads` | `CHECK (byte_size > 0)` | an empty object is not an upload |
| CK-20 | `site_settings` | `CHECK (published_revision_id IS NULL OR published_revision_id <> current_revision_id OR frozen_is_consistent)` | a published revision is frozen |
| CK-21 | every bounded-vocabulary column | `CHECK (col IN (…))` | §37's decision: **`CHECK` over PostgreSQL `ENUM`** |

**CK-08 and CK-14 together state a principle:** *no amount column in this schema is ever negative.*
Direction is always carried by an explicit kind column. A negative amount is a value that reads
correctly in a `SUM` and lies in every other context, and it is exactly how reconciliation errors
become invisible.

**DB-P19 check:** no `CHECK` predicate above references the wall clock.

---

## 35. Index strategy

Indexes are stated as an intent, not as a tuned list — **Stage 15 does not have production query
statistics, and inventing them would be dishonest.** Four rules govern what exists at migration time.

| # | Rule |
|---|---|
| IX-1 | **Every `school_id` leads a composite index on every school-owned table.** Under RLS, the tenant predicate is applied to every query; an index that does not lead with `school_id` cannot serve it. |
| IX-2 | **Every foreign key has an index on its referencing side.** PostgreSQL does not create one automatically, and its absence turns every parent-row lock into a sequential scan of the child table. |
| IX-3 | **Every event table is indexed `(school_id, subject_id, occurred_at)`** — the shape every history read and every projection rebuild uses. |
| IX-4 | **Every cursor-paginated list is indexed on its exact sort key** (§36), including the tiebreaker column. A cursor whose sort key is unindexed degrades predictably and silently. |

**Deliberately absent:** speculative covering indexes, partial indexes for hypothetical filters, and
any index justified only by "it might help". **Stage 20 owns performance work with real measurements.**
Indexes added on evidence are cheap; indexes added on speculation are permanent write cost that nobody
later dares remove.

---

## 36. Cursor pagination — the schema side

Stage 14's pagination principle requires stable cursors. That obligation lands here as a schema
requirement, not an application convention.

**DBD-039 · Every paginated list has a total sort order ending in a unique tiebreaker**

```
ORDER BY <business key> DESC, id DESC        -- id is the tiebreaker
cursor = the encoded tuple of exactly those columns
```

**A sort key that is not total is a broken cursor**, because two rows sharing a timestamp can be
returned twice or skipped entirely depending on the plan. Every list endpoint's sort key therefore ends
in the table's primary key, and **IX-4** requires an index over that exact tuple.

**Offset pagination is not used** for any list that can change under the reader — which, in this
system, is all of them.

---

## 37. JSONB, bounded vocabularies and triggers

### 37.1 JSONB is bounded and never authoritative

`jsonb` appears in exactly five places: `notifications.payload`, `idempotency_keys.response_snapshot`,
`import_rows.raw`, `import_rows.validation_messages`, and `provider_events.payload`.

**In every case the JSONB is a record of something that arrived or was produced, never the authority
for a business fact.** No constraint depends on its contents, no query filters on it in a hot path, and
nothing in it is trusted. **A business fact that matters is a column.**

### 37.2 Bounded vocabularies use `CHECK`, not PostgreSQL `ENUM`

**DBD-040 · Bounded vocabularies are `text` columns with a `CHECK (col IN (…))` constraint**

The rationale is migration mechanics, not taste:

| | PostgreSQL `ENUM` | `text` + `CHECK` |
|---|---|---|
| add a value | `ALTER TYPE … ADD VALUE` — **cannot run inside a transaction block in the same transaction that uses it**, and is not reversible | drop and re-add the constraint inside one transaction |
| remove a value | **not supported** — requires a full type rebuild and a rewrite of every dependent column | drop and re-add the constraint |
| rename a value | possible, but rewrites nothing, leaving old values live | explicit `UPDATE` + constraint change, in one reviewable transaction |
| reversibility | poor | **every change is a reversible migration** |
| ORM support | Drizzle supports both | supported |

**The decisive point is reversibility.** MIG (§44) requires every migration to be reversible, and a
value added to a PostgreSQL `ENUM` cannot be removed. Adopting `ENUM` would mean accepting a category
of migration that can only go forwards, in a system whose ABSOLUTE SAFETY RULE is that nothing is
destroyed and everything is recoverable. **The type-level guarantee `ENUM` offers is real; it is not
worth an irreversible migration path.**

This is recorded as a trade-off, not as a claim that `ENUM` is bad: `CHECK` constraints must be kept in
step across tables by review, where `ENUM` would centralise the vocabulary. **The register in §34
(CK-21) is what makes that review possible.**

### 37.3 Triggers

**DBD-041 · The target schema uses no triggers**

Every invariant in this document is enforced by a constraint, an index, or an explicit transaction
whose ownership Stage 13 fixed (APP-048). §17 records the one place a constraint trigger *could* have
been used — to prove `money_events.amount_applied` equals the sum of its applications — and records
that it was **considered and not adopted**, with its trade-offs stated.

**Why no triggers:** a trigger moves business behaviour into a place the application's transaction
boundary cannot see, cannot test against, and cannot reason about when a command spans four modules
(§20). I-2's guarantee depends on one transaction whose entire effect is legible in one place. **A
trigger would make the atomic invariant depend on behaviour that no reader of the command can see.**

---

## 38. Erasure map

DSAR erasure and CAP-092 `purge_tenant` are the only paths that delete rows. **Stage 18 owns retention
and Stage 16 owns the lawful basis and the process; Stage 15 owns only the question "where does
personal data physically live, and what happens to each place".**

| Location | Personal data | On person erasure | On tenant purge |
|---|---|---|---|
| `persons` | name, email | **anonymise in place** — the row survives so referencing evidence stays valid | out of scope — persons are global |
| `credentials` | hash, MFA secrets | **delete the row** | out of scope |
| `guardians` · `children` | names, contact | anonymise in place | **delete** |
| `guardian_child_relationships` | the relationship | retain, anonymised | **delete** |
| `messages` | free text | **redact body, retain the row** (`redacted_at`) | **delete** |
| `notifications` | payload | redact payload | **delete** |
| `delivery_attempts` | provider reference | retain | **delete** |
| `custody_events` · `handover_events` | who recorded, for whom | **retain — this is the evidence chain**, person identifiers anonymised at the person row | **delete** |
| `money_events` · `payment_applications` | amounts, references | **retain — statutory financial record** | **delete only on purge, after Stage 18's retention window** |
| `object_uploads` | filenames, bytes in the object store | delete the object, retain the metadata row marked erased | **delete both** |
| `import_rows` | raw spreadsheet contents | **delete the session** | **delete** |
| `user_sessions` | session contents | delete the person's rows | delete |
| `audit_events` (deferred) | actor identifiers | **Stage 19 decides** | **Stage 19 decides** |

**Anonymise-in-place is the default for a person, and deletion is the default for a tenant purge.**
These differ because erasing one person must not destroy a school's financial and custody records,
whereas purging a tenant is a deliberate, capability-gated removal of that school's entire dataset.
**Neither path is reachable from ordinary application code.**

**A conflict is recorded honestly:** erasure of a guardian and retention of financial evidence pull in
opposite directions. §48 carries this as **C-79**, and its resolution belongs to Stage 16 and the
BytHub Legal & Compliance review — **Stage 15 does not resolve it, and does not pretend to.**

---

## 39. Extension register

Every PostgreSQL extension the target schema requires, why, and what is lost without it. **Neon
supports all three.**

| Extension | Required by | Why | If unavailable |
|---|---|---|---|
| **`citext`** | **DBI-002** `persons.email` | email uniqueness must be case-insensitive; a `lower()` functional unique index is the alternative | fall back to `UNIQUE (lower(email))` — equivalent guarantee, less readable |
| **`btree_gist`** | **DBI-027** `academic_periods` | the exclusion constraint mixes an equality column (`school_id`) with a range operator; GiST alone cannot index `school_id` for `=` | **the overlap guarantee is lost** and becomes an application check — a genuine downgrade, recorded not hidden |
| **`pgcrypto`** | identifier generation | server-side UUID generation for defaults | `gen_random_uuid()` is built in from PostgreSQL 13; the extension is then not required |

**No extension is assumed silently.** Each is declared in the migration that first needs it (§44), so a
new environment fails at migration time with a clear cause rather than at runtime with a confusing one.

**Deliberately not required:** `pg_trgm`, `unaccent`, `postgis`, `pg_cron`, `uuid-ossp`. Search
behaviour is Stage 20's; scheduled work is MOD-014's `jobs` table and the application's scheduler
(CAP-093), **not a database-resident scheduler** — which would place business execution outside the
transaction boundaries Stage 13 fixed.

---

## 40. Data-model coverage — all 57 concepts

Every Stage 6 concept is accounted for: it becomes a table, is deliberately derived, is deferred to a
named stage, or is future-only. **No concept is unaccounted for.**

| DM | Concept | Physical outcome |
|---|---|---|
| DM-001 | School | **DBT-001** |
| DM-002 | School code | **DBT-001** `code` · DBI-001 |
| DM-003 | School identity | **DBT-003** — Core identity, walled from the site theme |
| DM-004 | School policy | **DBT-004** |
| DM-005 | Site configuration | **DBT-058** + **DBT-065** + **DBT-066** |
| DM-006 | Support engagement | **DBT-067** |
| DM-007 | Person account | **DBT-007** + **DBT-008** — decomposed (§8) |
| DM-008 | Role grant | **DBT-009** + **DBT-010** |
| DM-009 | Access context | **DERIVED — not stored.** Computed per request from the Stage 7 chain |
| DM-010 | Guardian record | **DBT-020** |
| DM-011 | Staff profile | **DBT-009** — replaces `teacher_profiles` |
| DM-012 | Invitation | **DBT-011** |
| DM-013 | Linking code | **DBT-022** · DBI-029 |
| DM-014 | Guardian–child relationship | **DBT-021** · DBI-007 — the SC-4 authority |
| DM-015 | Session | **DBT-075** — shape here, contents Stage 16 |
| DM-016 | Academic period | **DBT-012** · DBI-019 · DBI-027 |
| DM-017 | Class | **DBT-014** · DBI-004 |
| DM-018 | Subject | **DBT-015** |
| DM-019 | Class staffing | **DBT-016** |
| DM-020 | Child | **DBT-018** |
| DM-021 | Class membership | **DBT-017** · DBI-005 — OD-3 |
| DM-022 | Family | **DBT-019** |
| DM-023 | Book-supply cycle | **DBT-030** · DBI-006 |
| DM-024 | Requirement item | **DBT-031** — **no status, no paid, no settled column** |
| DM-025 | Requirement line | **DBT-032** — price snapshot |
| DM-026 | Book product | **DBT-023** |
| DM-027 | Bundle | **DBT-027** |
| DM-028 | Bundle line | **DBT-028** |
| DM-029 | Class requirement assignment | **DBT-029** |
| DM-030 | Child requirement override | **DBT-033** |
| DM-031 | Physical copy | **DBT-024** |
| DM-032 | Stock movement | **DBT-025** — append-only |
| DM-033 | Money event | **DBT-035** — append-only |
| DM-034 | Funding adjustment | **DBT-037** — not money, never revenue |
| DM-035 | Settlement position | **DERIVED — MUST NOT be stored** (§19) |
| DM-036 | Payment reference | **DBT-038** · DBI-012 |
| DM-037 | Provider payment record | **DBT-041** · DBI-021 |
| DM-038 | Verification attempt | **Stage 16** — part of the credential model |
| DM-039 | Fulfilment instruction | **DBT-048** · DBI-030 — requirement-item grain |
| DM-040 | Allocation | **DBT-044** · DBI-015 — no status columns |
| DM-041 | Custody holding | **DERIVED — MUST NOT be stored.** Computed from DBT-045 |
| DM-042 | Custody event | **DBT-045** — append-only |
| DM-043 | Hand-over | **DBT-047** · DBI-017 |
| DM-044 | Fulfilment exception | **DBT-046** — events, not a status |
| DM-045 | Replacement request | **DBT-049** + **DBT-050** |
| DM-046 | Charge decision | **DBT-051** · DBI-018 — supersession |
| DM-047 | Correction event | **the `is_correction` / `corrects_event_id` pattern** on each event table (§31) |
| DM-048 | Return processing | **DBT-052** |
| DM-049 | Message thread | **DBT-055** |
| DM-050 | Message | **DBT-056** |
| DM-051 | Notification | **DBT-053** — written inside I-2 |
| DM-052 | Delivery attempt | **DBT-054** |
| DM-053 | Audit event | **DEFERRED — Stage 19 owns the schema** (§30) |
| DM-054 | Console operation record | **DEFERRED — Stage 16/19** (§30) |
| DM-055 | Job run | **DBT-069** · DBI-020 |
| DM-056 | Dispatch | **FUTURE ONLY — no table.** Stage 15 creates nothing for it |
| DM-057 | Payment application | **DBT-036** — OD-1, the amount lives on the link |

**Four concepts are deliberately not tables** (DM-009, DM-035, DM-041, DM-056), **two are deferred**
(DM-053, DM-054), **one belongs to Stage 16** (DM-038). The remaining **50 concepts map to the 76
tables**, with several concepts sharing a table and several requiring more than one — which is the
expected result of decomposing a model whose current implementation conflates them.
---

## 41. The table catalogue — DBT-001 … DBT-076

**76 tables.** Every table Stage 15 shapes, with exactly one DBT identifier, grouped by owning module.
The counting rule is §1.1's and is applied without exception: **a table receives a DBT identifier if
and only if Stage 15 defines its physical shape.** The three tables whose shape a later stage owns
(§30) appear in no row below and in no count.

| Module | Tables | Range |
|---|---|---|
| MOD-001 Tenancy & School Configuration | 6 | DBT-001 … DBT-006 |
| MOD-002 Identity & Access | 5 | DBT-007 … DBT-011 |
| MOD-003 Academic Structure | 6 | DBT-012 … DBT-017 |
| MOD-004 Children & Families | 5 | DBT-018 … DBT-022 |
| MOD-005 Catalogue & Stock | 4 | DBT-023 … DBT-026 |
| MOD-006 Requirements & Bundles | 8 | DBT-027 … DBT-034 |
| MOD-007 Settlement & Funding | 10 | DBT-035 … DBT-043, DBT-051 |
| MOD-008 Fulfilment & Custody | 8 | DBT-044 … DBT-050, DBT-052 |
| MOD-009 Communication | 5 | DBT-053 … DBT-057 |
| MOD-011 School Website CMS | 9 | DBT-058 … DBT-066 |
| MOD-012 Platform Operations | 2 | DBT-067 … DBT-068 |
| MOD-014 Scheduled Work | 1 | DBT-069 |
| Infrastructure | 7 | DBT-070 … DBT-076 |
| **Total** | **76** | **contiguous, no gaps, no reuse** |

**MOD-010 has no tables**, which is consistent with Stage 13 APP-025 (13 data layers across 14
modules). **MOD-013 has no Stage-15-shaped tables** — its two tables are deferred to Stage 19 (§30).

**DBT-051 sits in MOD-007's count and in MOD-008's identifier range.** This is deliberate and is not an
error: the charge decision is owned by finance (CAP-070) but lives physically beside the replacement
tables it references. **The identifier ranges are allocation order; the module column is ownership.**
Where the two disagree, **ownership governs**, and this is the only place they do.


### MOD-001 · Tenancy & School Configuration  —  DBT-001 … DBT-006  (6)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-001** | `schools` | the tenant: id, code, name, status | n/a — is the tenant | UNIQUE(code) · DBI-001 · RLS root policy §7.8 |
| **DBT-002** | `school_lifecycle_events` | suspend · archive · restore · deletion_requested · deleted · purged | school_id NOT NULL | APPEND-ONLY · replaces 5 field groups on schools |
| **DBT-003** | `school_identity` | Core identity: logos, favicon, public display identity | school_id NOT NULL | 1:1 · from school_branding |
| **DBT-004** | `school_configuration` | school policy choices, explicit columns | school_id NOT NULL | 1:1 · revision counter |
| **DBT-005** | `school_entitlements` | the CMS entitlement fact — MA-2 | school_id NOT NULL | UNIQUE(school_id,module) WHERE revoked_at IS NULL · DBI-026 |
| **DBT-006** | `school_public_domains` | host → school resolution for the public site | school_id NOT NULL | UNIQUE(hostname) · DBI-025 · PUBLICATION policy |

### MOD-002 · Identity & Access  —  DBT-007 … DBT-011  (5)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-007** | `persons` | one human, once | GLOBAL — no tenant column | UNIQUE(email) citext · DBI-002 |
| **DBT-008** | `credentials` | password hash · MFA · verification state | GLOBAL — 1:1 with person | **Stage 16 owns every field's form** |
| **DBT-009** | `school_memberships` | a person's membership of a school | school_id NOT NULL | UNIQUE(person_id,school_id) · DBI-003 · from teacher_profiles |
| **DBT-010** | `authority_grants` | AUTH-* grants | MIXED — scope_kind discriminator | §8 · CHECK ties scope_kind to school_id |
| **DBT-011** | `invites` | staff and admin invitation | school_id NOT NULL | Stage 16 owns token form |

### MOD-003 · Academic Structure  —  DBT-012 … DBT-017  (6)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-012** | `academic_periods` | school-owned academic period — OD-2 | school_id NOT NULL | DBI-019 · DBI-027 EXCLUDE · revision counter |
| **DBT-013** | `period_rollover_runs` | a durable rollover run — Stage 14 API-115/116 | school_id NOT NULL | UNIQUE(school_id,from,to) WHERE completed |
| **DBT-014** | `classes` | a class in a period | school_id NOT NULL | UNIQUE(school_id,period_id,name) + normalised · DBI-004 |
| **DBT-015** | `subjects` | a subject | school_id NOT NULL | UNIQUE(school_id,name) |
| **DBT-016** | `class_staffing` | time-bounded teacher staffing | school_id NOT NULL | subject_id nullable — genuinely optional |
| **DBT-017** | `class_memberships` | child in class in period — OD-3 | school_id NOT NULL | UNIQUE(child_id,period_id) WHERE ended_at IS NULL · DBI-005 |

### MOD-004 · Children & Families  —  DBT-018 … DBT-022  (5)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-018** | `children` | the child record | school_id NOT NULL | no class_id · date_of_birth is a DATE |
| **DBT-019** | `families` | the household | school_id NOT NULL | UNIQUE(school_id,family_code) |
| **DBT-020** | `guardians` | a guardian at a school | school_id NOT NULL | person_id nullable — may precede an account |
| **DBT-021** | `guardian_child_relationships` | the authoritative SC-4 fact | school_id NOT NULL | UNIQUE(guardian_id,child_id) WHERE ended_at IS NULL · DBI-007 |
| **DBT-022** | `child_link_codes` | link-code credential | school_id NOT NULL | UNIQUE(code_hash) GLOBAL · DBI-029 · §11 |

### MOD-005 · Catalogue & Inventory  —  DBT-023 … DBT-026  (4)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-023** | `books` | catalogue entry | school_id NOT NULL | UNIQUE(school_id,isbn) WHERE isbn IS NOT NULL · DBI-008 |
| **DBT-024** | `book_copies` | identity and condition ONLY | school_id NOT NULL | UNIQUE(school_id,copy_code) |
| **DBT-025** | `stock_movements` | append-only movement history | school_id NOT NULL — **ADDED** | CHECK new = prev + qty · CHECK new >= 0 · DBI-011 |
| **DBT-026** | `stock_levels` | current on-hand — TRANSACTIONAL PROJECTION | school_id NOT NULL | written only alongside a movement · rebuildable |

### MOD-006 · Book-Supply Cycle & Requirements  —  DBT-027 … DBT-034  (8)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-027** | `bundles` | a bundle of books | school_id NOT NULL | from book_levels · revision counter |
| **DBT-028** | `bundle_lines` | a book in a bundle | school_id NOT NULL — **ADDED** | UNIQUE(school_id,bundle_id,book_id) · DBI-009 |
| **DBT-029** | `class_bundle_assignments` | what a class is due | school_id NOT NULL — **ADDED** | UNIQUE(school_id,class_id,period_id,bundle_id) · DBI-010 |
| **DBT-030** | `supply_cycles` | DM-023 — one per child per period | school_id NOT NULL | UNIQUE(school_id,child_id,period_id) · DBI-006 |
| **DBT-031** | `requirement_items` | DM-024 — a requirement episode | school_id NOT NULL | **no status, no paid, no settled** |
| **DBT-032** | `requirement_lines` | DM-025 — price snapshot at requirement time | school_id NOT NULL | CHECK qty > 0 · unit_price >= 0 |
| **DBT-033** | `child_requirement_overrides` | a child-specific deviation | school_id NOT NULL | from student_book_levels |
| **DBT-034** | `child_selections` | what a family selected — no cart vocabulary | school_id NOT NULL | from child_book_baskets + basket_items |

### MOD-007 · Settlement & Funding  —  DBT-035 … DBT-051  (10)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-035** | `money_events` | DM-033 — money actually received | school_id NOT NULL | CHECK amount > 0 · amount_applied projection · DBI-013 |
| **DBT-036** | `payment_applications` | DM-057 — OD-1, amount lives on the link | school_id NOT NULL | CHECK amount_applied > 0 |
| **DBT-037** | `funding_adjustments` | DM-034 — subsidy · discount · waiver · school-funded | school_id NOT NULL | NOT money · never revenue |
| **DBT-038** | `payment_references` | the family's instruction before money arrives | school_id NOT NULL | UNIQUE(school_id,reference) · DBI-012 |
| **DBT-039** | `settlement_reviews` | the confirm/reject decision — **I-2** | school_id NOT NULL | **requirement_item_id FK** · UNIQUE WHERE confirmed · DBI-014 |
| **DBT-040** | `integrations` | a configured integration — provider-neutral | school_id NOT NULL | no provider is named |
| **DBT-041** | `provider_events` | an imported or received provider signal | school_id NOT NULL | UNIQUE(integration_id,external_event_id) · DBI-021 |
| **DBT-042** | `reconciliation_imports` | a provider statement import session | school_id NOT NULL | from provider_payments import fields |
| **DBT-043** | `reconciliation_matches` | candidate and resolved match | school_id NOT NULL | from payment_verification_attempts |
| **DBT-051** | `replacement_charge_decisions` | the finance charge/absorb decision — CAP-070 | school_id NOT NULL | superseded_at + superseded_by_decision_id · DBI-018 · §10 |

### MOD-008 · Fulfilment & Custody  —  DBT-044 … DBT-052  (8)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-044** | `allocations` | DM-040 — what is owed to which child | school_id NOT NULL | **no status columns** · UNIQUE WHERE not cancelled · DBI-015 |
| **DBT-045** | `custody_events` | DM-042 — append-only custody history | school_id NOT NULL | PRESERVED from the current table |
| **DBT-046** | `fulfilment_exceptions` | DM-044 — absence · out of stock · issue | school_id NOT NULL | EVENTS, many per allocation |
| **DBT-047** | `handover_events` | DM-043 — the ONE reached-child fact | school_id NOT NULL | UNIQUE(school_id,allocation_id) WHERE not a correction · DBI-017 |
| **DBT-048** | `fulfilment_instructions` | DM-039 — route, **per REQUIREMENT ITEM** | school_id NOT NULL | UNIQUE(school_id,requirement_item_id) WHERE superseded_at IS NULL · DBI-030 · §7 |
| **DBT-049** | `replacement_requests` | the teacher raised it — CAP-067 | school_id NOT NULL | — |
| **DBT-050** | `replacement_reviews` | the admin operational decision — CAP-069 | school_id NOT NULL | revision counter |
| **DBT-052** | `returns` | a return — a custody and stock event | school_id NOT NULL | writes custody + stock rows in one transaction |

### MOD-009 · Communication  —  DBT-053 … DBT-057  (5)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-053** | `notifications` | DM-051 — durable notification truth | MIXED — scope_kind discriminator | insertable inside I-2 · DBI-022 |
| **DBT-054** | `delivery_attempts` | DM-052 — a delivery attempt and its outcome | via notification | never a credential, signed URL or raw payload |
| **DBT-055** | `message_threads` | a thread | school_id NOT NULL | — |
| **DBT-056** | `messages` | a message | school_id NOT NULL | — |
| **DBT-057** | `notification_preferences` | per person per school | school_id NOT NULL — **ADDED** | — |

### MOD-011 · School Website CMS  —  DBT-058 … DBT-066  (9)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-058** | `site_settings` | current_revision_id + published_revision_id | school_id NOT NULL | **PUBLISH = move the pointer** · revision counter |
| **DBT-059** | `site_revisions` | one editable or published revision | school_id NOT NULL | a published revision is FROZEN |
| **DBT-060** | `site_pages` | a page in a revision | school_id NOT NULL | UNIQUE(school_id,revision_id,slug) · DBI-023 |
| **DBT-061** | `page_sections` | a structured block in a page | school_id NOT NULL | structured, not arbitrary HTML |
| **DBT-062** | `site_news` | a news item in a revision | school_id NOT NULL | UNIQUE(school_id,revision_id,slug) |
| **DBT-063** | `site_events` | an event in a revision | school_id NOT NULL | UNIQUE(school_id,revision_id,slug) |
| **DBT-064** | `site_media_links` | a published media reference in a revision | school_id NOT NULL | → object_uploads in 'published' state |
| **DBT-065** | `site_presentation` | the PUBLIC website theme — --site-* only | school_id NOT NULL | from school_branding's colour columns |
| **DBT-066** | `site_contact` | public contact information | school_id NOT NULL | **public fields only** — never a guardian or staff email |

### MOD-012 · Platform Operations  —  DBT-067 … DBT-068  (2)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-067** | `support_engagements` | a named support engagement — SC-6 | school_id NOT NULL | UNIQUE(actor_person_id) WHERE ended_at IS NULL · DBI-024 |
| **DBT-068** | `tenant_onboarding` | platform onboarding state | PLATFORM — no tenant column | — |

### MOD-014 · Scheduled Work  —  DBT-069 … DBT-069  (1)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-069** | `jobs` | DM-055 — durable job records | MIXED — scope_kind discriminator | two partial uniques · DBI-020 · §5 |

### Infrastructure — shape owned by Stage 15, semantics by later stages  —  DBT-070 … DBT-076  (7)

| DBT | SQL table | Purpose | Tenant ownership | Notes |
|---|---|---|---|---|
| **DBT-070** | `idempotency_keys` | transport retry safety — Stage 14 APID-020 | MIXED — scope_kind discriminator | UNIQUE per operation scope · DBI-016 · §5 |
| **DBT-071** | `object_uploads` | object metadata and trust state | school_id NOT NULL | **no bytes in PostgreSQL** · four trust states |
| **DBT-072** | `import_sessions` | an import session | school_id NOT NULL | — |
| **DBT-073** | `import_rows` | one proposed row — relational, queryable | school_id NOT NULL | parser output is NEVER authoritative |
| **DBT-074** | `import_proposed_classes` | classes the commit would create | school_id NOT NULL | normalised name · prevents duplicate-class forking |
| **DBT-075** | `user_sessions` | connect-pg-simple store — sid · sess · expire | none — infrastructure | **shape fixed by Stage 11's library; Stage 16 owns `sess` contents** |
| **DBT-076** | `rate_limits` | durable rate-limit counters | none — infrastructure | **Stage 16 owns the algorithm and dimensions** |---

## 42. The 41 current tables — where every one of them goes

**Nothing in this column says "delete".** Every current table has a stated destination, and the
destination is reached by the MIG sequence of §44 — **migrate, verify, then deprecate; remove only when
safe.**

| # | Current table | Destination | Disposition |
|---|---|---|---|
| 1 | `schools` | **DBT-001** + **DBT-002** | five lifecycle field groups move to `school_lifecycle_events` |
| 2 | `school_branding` | **DBT-003** + **DBT-065** | **the 18-column fusion is split** — Core identity vs public site theme |
| 3 | `cron_job_runs` | **DBT-069** | the NULL-distinctness defect is corrected by two partial uniques (§25) |
| 4 | `rate_limits` | **DBT-076** | preserved; Stage 16 owns the algorithm |
| 5 | `school_website_sections` | **DBT-060** + **DBT-061** | the `isPublished` boolean becomes the revision model (§27) |
| 6 | `media_assets` | **DBT-071** + **DBT-064** | **`dataUri` base64 leaves the database** (§26) |
| 7 | `notification_preferences` | **DBT-057** | **gains `school_id`** — one of the twelve untenanted tables |
| 8 | `user_permissions` | **DBT-010** | becomes authority grants under the Stage 7 chain |
| 9 | `users` | **DBT-007** + **DBT-008** + **DBT-009** | **decomposed**: the nullable `school_id` and single `role` are what §8 corrects |
| 10 | `invites` | **DBT-011** | preserved |
| 11 | `audit_logs` | `audit_events` — **DEFERRED, Stage 19** | data preserved; shape is Stage 19's |
| 12 | `user_sessions` | **DBT-075** | preserved unchanged; shape fixed by the store |
| 13 | `classes` | **DBT-014** | gains the normalised-name unique (DBI-004) |
| 14 | `subjects` | **DBT-015** | preserved |
| 15 | `class_teacher_assignments` | **DBT-016** | preserved |
| 16 | `students` | **DBT-018** | renamed to `children`, matching Stage 6's language |
| 17 | `books` | **DBT-023** | preserved |
| 18 | `book_copies` | **DBT-024** | preserved |
| 19 | `book_levels` | **DBT-027** | becomes `bundles` |
| 20 | `book_level_items` | **DBT-028** | becomes `bundle_lines`; **gains `school_id`** |
| 21 | `class_book_levels` | **DBT-029** | becomes `class_bundle_assignments`; **gains `school_id`** |
| 22 | `student_book_levels` | **DBT-033** | becomes `child_requirement_overrides` |
| 23 | `families` | **DBT-019** | preserved |
| 24 | `family_students` | **DBT-019** relation | folded into the family/child relation |
| 25 | `guardians` | **DBT-020** | preserved |
| 26 | `child_linking_codes` | **DBT-022** | **`UNIQUE (code_hash)` becomes global and unconditional** (§11) |
| 27 | `parent_children` | **DBT-021** | becomes the authoritative SC-4 fact |
| 28 | `teacher_profiles` | **DBT-009** | its `uniqueIndex(user_id, school_id)` is what `school_memberships` generalises |
| 29 | `child_book_baskets` | **DBT-030** + **DBT-031** | becomes the supply cycle and its requirement items |
| 30 | `basket_items` | **DBT-032** + **DBT-034** | requirement lines and child selections |
| 31 | `book_payments` | **DBT-035** + **DBT-036** + **DBT-038** | **its two lifecycle columns (`status`, `order_status`) and `parent_identifier text` are exactly what §16 decomposes** |
| 32 | `basket_payments` | **DBT-036** | becomes the payment application link — OD-1 |
| 33 | `provider_payments` | **DBT-040** + **DBT-041** | integration and provider events |
| 34 | `payment_verification_attempts` | **Stage 16** — DM-038 | shape follows the security model |
| 35 | `finance_book_allocations` | **DBT-044** + **DBT-045** + **DBT-046** + **DBT-047** | **its three status columns become four tables** (§22.1) |
| 36 | `custody_events` | **DBT-045** | **preserved — already correct** |
| 37 | `book_inventory_transactions` | **DBT-025** | **gains `school_id`** — it currently has none |
| 38 | `extra_copy_requests` | **DBT-049** + **DBT-050** + **DBT-051** | one concept becomes three decisions (§23) |
| 39 | `message_threads` | **DBT-055** | preserved |
| 40 | `messages` | **DBT-056** | preserved |
| 41 | `message_audit_logs` | **DEFERRED, Stage 19** | data preserved; shape is Stage 19's |

**Twelve tables gain a tenant column**, which is the physical answer to **C-65**. **Six current tables
are preserved essentially unchanged.** **No table's data is discarded at any point in the sequence.**

---

## 43. Schema file organisation

**DBD-042 · The schema is split by module, and the split is enforced by the file layout**

`shared/schema.ts` is currently **1,166 lines** holding all 41 tables. In the target it becomes a
directory whose files match the module boundaries Stage 13 fixed:

```
shared/schema/
  index.ts              re-exports everything; the only import path application code uses
  tenancy.ts            MOD-001   DBT-001 … DBT-006
  identity.ts           MOD-002   DBT-007 … DBT-011
  academic.ts           MOD-003   DBT-012 … DBT-017
  people.ts             MOD-004   DBT-018 … DBT-022
  catalogue.ts          MOD-005   DBT-023 … DBT-026
  requirements.ts       MOD-006   DBT-027 … DBT-034
  settlement.ts         MOD-007   DBT-035 … DBT-043, DBT-051
  fulfilment.ts         MOD-008   DBT-044 … DBT-050, DBT-052
  communication.ts      MOD-009   DBT-053 … DBT-057
  cms.ts                MOD-011   DBT-058 … DBT-066
  platform.ts           MOD-012   DBT-067 … DBT-068
  scheduling.ts         MOD-014   DBT-069
  infrastructure.ts     DBT-070 … DBT-076
```

**A cross-module foreign key is legal in the schema and is not a module violation** — the modules
Stage 13 defined are about *who may write*, not about which rows may reference which. `fulfilment.ts`
importing `requirements.ts`'s table object is a compile-time reference, not a call into another
module's data layer, and APP-025's rule stands unchanged.

**`index.ts` is the only import path**, so the split can be reorganised later without touching a single
consumer.

---

## 44. Migration sequence — MIG-01 … MIG-14

### 44.1 The defect this replaces

CI currently runs **`npm run db:push -- --force`** and *then* applies `for f in migrations/00[2-9]*.sql`.
`migrations/001_console_hardening.sql` carries the header *"Run ONCE against production, as the Neon
project owner"* and *"replace both REPLACE_ME passwords"* — **a file that is not runnable by CI at all,
sitting in the directory CI iterates.**

**`db:push --force` is not a migration mechanism.** It computes a diff against the live database and
applies it without review, without a down path, and without a record of what it did. Against production
data it can drop a column because a type changed.

**DBD-043 · `db:push` is never run against any database holding real data**

Development may use it against a scratch database. **Staging and production accept versioned, reviewed,
reversible migration files only**, applied in order, with the applied set recorded in the database.

### 44.2 The sequence

**Every step is additive until MIG-13. Nothing is dropped before MIG-14, and MIG-14 runs only after
MIG-12's verification passes.**

| MIG | Step | Reversible | Destroys anything |
|---|---|---|---|
| **MIG-01** | install the migration runner; record `001_console_hardening.sql` as manually applied; remove `db:push --force` from CI | yes | no |
| **MIG-02** | declare extensions — `citext`, `btree_gist` (§39) | yes | no |
| **MIG-03** | create the 76 new tables, **empty**, alongside the existing 41 | yes | no |
| **MIG-04** | add every `school_id` column to the twelve untenanted tables, **nullable** | yes | no |
| **MIG-05** | backfill `school_id` from each table's existing relationships; verify zero NULLs | yes | no |
| **MIG-06** | set those columns `NOT NULL`; add composite foreign keys (§12) | yes | no |
| **MIG-07** | copy data into the new tables — identity decomposition (§8), the branding split (§27), the allocation decomposition (§22) | yes | **no — copy, not move** |
| **MIG-08** | create the uniqueness register's indexes (§33); **any failure here is a real data conflict and is resolved by the owner, never by deleting rows** | yes | no |
| **MIG-09** | create check constraints (§34) with `NOT VALID`, then `VALIDATE` | yes | no |
| **MIG-10** | enable RLS and create policies (§7); grant the privilege classes (§7.9) | yes | no |
| **MIG-11** | move `media_assets.dataUri` bytes to object storage; write `object_uploads` rows (§26) | yes | **no — bytes copied out first, column dropped only at MIG-14** |
| **MIG-12** | **VERIFY** — row-count parity per table, sum parity on every money column, custody-chain continuity, zero orphans, RLS proven with a scoped connection | n/a | no |
| **MIG-13** | switch the application to the new tables; the old tables stay in place, readable | yes — revert the application | no |
| **MIG-14** | **only after a stated soak period and owner approval**: drop the deprecated tables and columns | **no — this is the one irreversible step** | yes, deliberately |

**MIG-14 is the only step that removes anything, it is separated from MIG-13 by a soak period, and it
requires explicit owner approval.** This is the ABSOLUTE SAFETY RULE expressed as a migration plan:
*migrate, verify, deprecate, remove only when safe.*

**MIG-12's verification is not optional and not a formality.** If sum parity on a money column fails,
the sequence stops. **A verification that can be skipped is not a verification.**

### 44.3 What is explicitly not in this sequence

No step deletes a row to make a constraint pass. No step rewrites history. No step runs against
production outside a reviewed migration. **No "giant cleanup commit" exists anywhere in this plan.**

---

## 45. Entity-relationship diagrams

**ERD-1 · Tenancy and identity**

```
              persons ──1:1── credentials              GLOBAL, no tenant column
                 │
                 │ school_memberships (DBI-003)
                 ▼
schools ──┬── school_identity        Core identity  ◄── the identity wall
          ├── school_configuration
          ├── school_entitlements    MA-2
          ├── school_public_domains  DBI-025 · PUBLICATION
          ├── school_lifecycle_events   append-only
          └── site_presentation      public theme only
                 ▲
                 └── authority_grants   scope_kind discriminator (§5)
```

**ERD-2 · Academic structure**

```
schools ── academic_periods ── classes ── class_memberships ── children
             DBI-019             DBI-004      DBI-005 (OD-3)
             DBI-027 EXCLUDE                  ⊕ composite FKs throughout
                   │
                   └── supply_cycles (DBI-006) ── requirement_items ── requirement_lines
```

**ERD-3 · The money side**

```
money_events ──payment_applications──► requirement_items
   append-only      OD-1: many:many          no status column
   CK-08 amount>0   amount on the link
   CK-09 projection
                          ▲
funding_adjustments ──────┤        not money, never revenue
settlement_reviews ───────┘        DBI-014 · exactly one confirmation
payment_references ───────┘        DBI-012
```

**ERD-4 · The fulfilment side**

```
requirement_lines ── allocations ──┬── custody_events        append-only
   (DBI-015)          no status    ├── handover_events       DBI-017
                                   ├── fulfilment_exceptions many per allocation
                                   └── returns

requirement_items ── fulfilment_instructions   DBI-030 · one active · §22.5
```

**ERD-5 · I-2, the atomic invariant**

```
                    ONE TRANSACTION · ONE COMMIT
   ┌──────────────────────────────────────────────────────────┐
   │ settlement_reviews  INSERT   DBI-014 refuses the second   │
   │ allocations         INSERT   DBI-015                      │
   │ stock_movements     INSERT   CK-11 · CK-12                │
   │ stock_levels        UPDATE   conditional, serialises      │
   │ notifications       INSERT   required consequence         │
   └──────────────────────────────────────────────────────────┘
        one SET LOCAL context · one connection · four modules
```

**ERD-6 · The CMS revision model**

```
site_settings ──current_revision_id──► site_revisions (editable)
      │                                     │
      └──published_revision_id──────► site_revisions (FROZEN)
                                            │
              site_pages · page_sections · site_news · site_events · site_media_links
              all ⊕ (school_id, revision_id) · DBI-023 slug unique WITHIN a revision

PUBLISH  =  published_revision_id := current_revision_id      one UPDATE
REVERT   =  published_revision_id := an earlier revision      one UPDATE
```

**ERD-7 · Tenant isolation, both mechanisms**

```
      RLS policy                     composite foreign key
   "you may only SEE                "a row may only REFERENCE
    your school's rows"              a row in the same school"
           │                                    │
           └──────── both, on every ────────────┘
                school-owned operational table
                      OPTION B+ (§7.3)
```

---

## 46. Decision index — DBD-001 … DBD-043

| DBD | Decision | § |
|---|---|---|
| 001–003 | naming, identifiers, the `scope_kind` discriminator and the two-partial-unique pattern | §5 |
| 004 | six tenant ownership classes | §6 |
| **005** | **OPTION B+ — RLS on every school-owned operational table plus tenant-aware composite FKs** | §7 |
| 006–007 | five policy classes; the PUBLICATION class | §7.5–§7.6 |
| 008 | the `schools` root policy — the tenant table is not globally readable | §7.8 |
| 009 | three database privilege classes | §7.9 |
| 010–011 | identity decomposition — `persons` · `credentials` · `school_memberships` | §8 |
| 012–013 | school identity split from site presentation; the entitlement fact | §9 |
| 014 | period · class · staffing · membership, and OD-3 | §10 |
| **015** | **the link code is a credential — `UNIQUE (code_hash)` global and unconditional** | §11 |
| 016–017 | tenant-aware composite foreign keys | §12 |
| 018–019 | cycles and requirements — **no status, no paid, no settled column** | §13 |
| 020–022 | catalogue, bundles, copies | §14 |
| **023** | **stock level is a transactionally enforced projection** | §15 |
| 024–026 | money events, applications, funding adjustments | §16 |
| **027** | **the over-application invariant, stated at its true strength** | §17 |
| 028 | provider records and reconciliation | §18 |
| **029** | **the settlement subject is the requirement item — no `settlements` table** | §19–§20 |
| **030** | **every row I-2 touches is reachable in one transaction on one connection** | §20 |
| 031 | idempotency — generic record plus operation-specific uniqueness | §21 |
| **032** | **one allocation row states what is OWED and nothing else** | §22 |
| **033** | **the fulfilment route is chosen per requirement item** | §22.5 |
| 034 | three replacement decisions, three tables | §23 |
| 035 | the notification is the truth; the delivery attempt is the history | §24 |
| 036 | no file bytes in PostgreSQL | §26 |
| **037** | **publishing moves a pointer; it never mutates content** | §27 |
| 038 | parser output is staged relationally and is never authoritative | §28 |
| 039 | every paginated list has a total sort order | §36 |
| **040** | **bounded vocabularies use `CHECK`, not PostgreSQL `ENUM`** | §37.2 |
| **041** | **the target schema uses no triggers** | §37.3 |
| 042 | the schema is split by module | §43 |
| **043** | **`db:push` is never run against any database holding real data** | §44 |

---

## 47. Risks — DBR-001 … DBR-016

| DBR | Risk | Severity | Mitigation |
|---|---|---|---|
| **DBR-001** | **RLS depends on `SET LOCAL` being set on every scoped connection.** A missed call means a query runs with no tenant context. | **CRITICAL** | §7.4's constraint; A13-001; the scoped connection is obtained only through one gateway (Stage 13) |
| **DBR-002** | Neon's HTTP driver cannot hold a transaction, so it cannot carry `SET LOCAL`. | **CRITICAL** | **A13-001** (§7.7) — scoped reads use a transaction-capable connection; unscoped reads may use HTTP |
| **DBR-003** | Connection pooling can hand a session-level `SET` to the next request. | **CRITICAL** | `SET LOCAL` only, inside a transaction; **never `SET`** |
| **DBR-004** | MIG-05's backfill may not resolve a `school_id` for every existing row. | **HIGH** | MIG-05 verifies zero NULLs before MIG-06; unresolved rows are escalated to the owner, **never deleted** |
| **DBR-005** | MIG-08's unique indexes may fail on real duplicate data. | **HIGH** | a failure is a genuine data conflict for owner resolution; **no row is deleted to make an index build** |
| **DBR-006** | `media_assets.dataUri` may be large enough that MIG-11 is slow or memory-bound. | **MEDIUM** | MIG-11 is batched and restartable; the column is not dropped until MIG-14 |
| **DBR-007** | The 41→76 decomposition is the largest single change in the rebuild. | **HIGH** | MIG-13's application switch is revertible because the old tables remain until MIG-14 |
| **DBR-008** | `money_events.amount_applied` can drift from the sum of applications if a write path bypasses the command. | **HIGH** | §17's honest classification; a reconciliation query is specified; the constraint-trigger option is documented and available |
| **DBR-009** | Erasure and financial retention conflict. | **HIGH** | **C-79**; Stage 16 and Legal own the resolution |
| **DBR-010** | RLS adds a predicate to every query and can change plans. | **MEDIUM** | **IX-1** — every index leads with `school_id`; Stage 20 measures |
| **DBR-011** | `CHECK`-based vocabularies can drift between tables. | **MEDIUM** | **CK-21** and the §34 register make drift reviewable |
| **DBR-012** | `btree_gist` may be unavailable in some environment. | **MEDIUM** | §39 states the downgrade explicitly rather than assuming availability |
| **DBR-013** | The baseline remains **UNVERIFIED** — the owner's native test runs are still outstanding. | **HIGH** | evidence remains capped at **E2**; MIG-12 does not substitute for it |
| **DBR-014** | A future stage may add a table without a DBT identifier or reuse one. | **MEDIUM** | §1.1's counting rule and §41's contiguity check |
| **DBR-015** | `db:push --force` remains in CI until MIG-01. | **HIGH** | MIG-01 is the first step for exactly this reason |
| **DBR-016** | Deferred tables (§30) could be shaped twice — once here by accident, once by Stage 19. | **MEDIUM** | they hold no DBT identifier and appear in no ERD; the boundary is stated, not implied |

---

## 48. Conflicts raised by Stage 15

**Conflict identifiers are stable. They are never renumbered, never reused and never deleted.**

**C-78 · CI applies an unrunnable migration file and pushes schema without review — ACTIVE**

*Evidence:* `.github/workflows/ci.yml` runs `npm run db:push -- --force` followed by
`for f in migrations/00[2-9]*.sql`. `migrations/001_console_hardening.sql` states *"Run ONCE against
production, as the Neon project owner"* and contains two `REPLACE_ME` passwords.

*Impact:* the schema of any environment CI touches is whatever the diff engine decided, with no
recorded history and no down path. The one file that documents a real production change is
simultaneously excluded from the loop and left in the directory the loop reads.

*Resolution:* **MIG-01**. This conflict closes when a migration runner is installed and `db:push
--force` leaves CI. It does not require an owner decision — there is no second valid behaviour.

**C-79 · Erasure obligations and financial-record retention pull in opposite directions — ACTIVE,
ESCALATED**

*Evidence:* §38's erasure map. A guardian's erasure request reaches `guardians`,
`guardian_child_relationships` and `messages`; the same person is referenced from `money_events` and
`payment_applications`, which are append-only statutory financial records.

*Impact:* the schema can express either outcome. It cannot choose between them, and choosing wrongly is
a legal exposure in both directions.

*Resolution:* **not Stage 15's.** Anonymise-in-place is recorded as the schema's *default capability*,
not as a decision. **Stage 16 owns the process and Stage 18 owns retention; the BytHub Legal &
Compliance review owns the lawful basis.** This conflict is deliberately left open and is not counted
as resolved.

### 48.1 Conflicts from earlier stages that Stage 15 makes physical

| Conflict | What it records | Stage 15's contribution |
|---|---|---|
| **C-65** | tenant ownership is not structurally enforced by the database | **DBD-005 Option B+**, **MIG-04 … MIG-06**, and the §42 map — every one of the twelve untenanted tables is named and given a column |
| **C-61** | two competing schema-change mechanisms | **DBD-043** and **MIG-01** |
| **C-19** | `001_console_hardening.sql` cannot run on a fresh database and is skipped by CI | **MIG-01** records it as manually applied rather than leaving it in a loop that cannot run it |
| **C-56** | no durable file storage; binary assets live as base64 in the database | **DBD-036**, **DBT-071**, **MIG-11** |
| **C-72** | deployment applies no migrations and gates on no verification | Stage 15 supplies the reviewed, ordered migration set and **MIG-12**'s verification. **The conflict itself remains OPEN and owned by Stage 21** — Stage 15 provides the input, not the deployment gate |
| **C-74** | the read handle and the transactional handle are the same type | **A13-001** states where each may be used; the type-level remedy remains Stage 13/22's |

**None of these conflicts is closed by Stage 15.** Each remains OPEN with its existing owner; the rows
above state what this stage contributes towards them, which is a different thing.

---

## 49. Amendment to locked Stage 13 — A13-001

Recorded in full at **§7.7** and reproduced here for the amendment register.

**A13-001 narrows where Stage 13 APP-028's `getReadDb()` Neon-HTTP path is used.** It does not remove
it, does not remove node-postgres, and does not alter I-2.

- **Unscoped and non-RLS reads** — public site rendering, health checks, platform-scope reads — **may
  use the Neon HTTP driver.**
- **Scoped authenticated reads must use a transaction-capable connection**, because they require
  `SET LOCAL` inside a transaction (§7.4) and the HTTP driver cannot hold one.

**This is a traceable owner amendment, not a silent rewrite.** Stage 13's locked text stands; A13-001
states the narrowing, its cause, and its scope. **The amendment block is written into
`CODEBASE_ARCHITECTURE.md` under Stage 13's locking-discipline section, referencing this stage.**

---

## 50. Cross-stage conflict check

| Earlier locked statement | Stage 15 position | Conflict |
|---|---|---|
| Stage 11 — Drizzle ORM 0.39, Neon HTTP **or** node-pg by URL | both retained | none — **A13-001** narrows usage, removes nothing |
| Stage 12 — I-2 is one transaction, one commit | **DBD-030** provides the physical guarantee | none |
| Stage 12 — AQ-1 = B, public site rendered/static | **§27** revision model + PUBLICATION policy class | none |
| Stage 12 — the Core identity wall | **§9** and **§27** — DBT-003 vs DBT-065 | none |
| Stage 13 — APP-025, 13 data layers, MOD-010 has none | **§41** — MOD-010 has no tables | none |
| Stage 13 — APP-027/APP-048, the command owns the transaction | **§20**, **§37.3** — no triggers | none |
| Stage 13 — APP-028 `getReadDb()` | **A13-001** | **amended, traceably** |
| Stage 13 — APP-049, `application/jobs/` is the only gateway caller | **§25** — a job row is never a business authority | none |
| Stage 14 — APIQ-1 = A, `PublishedSite` is first-party | **§27** — the published revision is what it reads | none |
| Stage 14 — API-120 is I-2's endpoint | **DBI-014** is its enforcement | none |
| Stage 14 — 412 preconditions | **§31**'s revision counters | none |
| Stage 14 — 11 typed support projections, CAP-088 | **§29** + the read-only privilege class | none |
| Stage 14 — pagination principle | **DBD-039** and **IX-4** | none |
| Stage 7 — CD-5 own-child block | **§22.4** — application-enforced, **explicitly not claimed** as a database guarantee | none — recorded honestly |
| Stage 6 — OD-1, OD-2, OD-3 | **DBT-036** · **DBT-012** · **DBI-005** | none |

**One amendment, no unresolved cross-stage conflicts.**

---

## 51. Owner decisions required

**None.**

Every point where two behaviours were possible was resolved from locked evidence rather than referred
upward:

- The **settlement subject** was resolved from WF-043 and Stage 6, not asked (§19).
- **Option B+** was resolved from the twelve untenanted tables plus the composite-FK requirement, not
  asked (§7.3).
- **`CHECK` over `ENUM`** was resolved from MIG's reversibility requirement, not asked (§37.2).
- The **fulfilment-instruction grain** was resolved from the replacement flow, not asked (§22.5).

**C-79 is escalated, not asked.** It is a legal and process question whose owner is Stage 16 and the
Legal & Compliance review; presenting it as a schema choice would misrepresent it.

---

## 52. Success criteria

| # | Criterion | Met |
|---|---|---|
| 1 | every current table has a stated destination; none is deleted | ✔ §42 |
| 2 | the twelve untenanted tables each gain a tenant column | ✔ §42, MIG-04…06 |
| 3 | tenant isolation has two independent mechanisms | ✔ DBD-005 |
| 4 | I-2 is physically supported in one transaction | ✔ DBD-030 |
| 5 | exactly one settlement confirmation is enforced by the database | ✔ DBI-014 |
| 6 | no derived value is independently writable | ✔ §15, §17, §19 |
| 7 | every uniqueness guarantee is registered with its predicate | ✔ §33 |
| 8 | no constraint predicate depends on the wall clock | ✔ DB-P19, §33, §34 |
| 9 | every DM concept is accounted for | ✔ §40 |
| 10 | the migration sequence is additive until one approved final step | ✔ §44 |
| 11 | extensions are declared, with the downgrade stated | ✔ §39 |
| 12 | deferred tables have a named owning stage | ✔ §30 |
| 13 | DBT identifiers are contiguous, unique and rule-governed | ✔ §1.1, §41 |
| 14 | cross-stage conflicts are flagged, not silently resolved | ✔ §49, §50 |
| 15 | no owner question is manufactured | ✔ §51 |

---

## 53. Traceability

| Family | Range | Count |
|---|---|---|
| **DB-P** principles | DB-P1 … DB-P19 | 19 |
| **DBD** decisions | DBD-001 … DBD-043 | 43 |
| **DBT** tables | DBT-001 … DBT-076 | **76** |
| **DBI** uniqueness | DBI-001 … DBI-030 | 30 |
| **CK** checks | CK-01 … CK-21 | 21 |
| **FK** foreign keys | FK-01 … FK-70 | 70 |
| **IX** index rules | IX-1 … IX-4 | 4 |
| **MIG** migration steps | MIG-01 … MIG-14 | 14 |
| **DBR** risks | DBR-001 … DBR-016 | 16 |
| **Conflicts** | C-78, C-79 | 2 new |
| **Amendments** | A13-001 | 1 |
| **Owner questions** | — | **0** |

**Deferred without identifiers:** `audit_events`, `console_operations`, `message_audit_logs` — three,
excluded from the DBT count by §1.1's rule.

---

## 54. Locking discipline

Once this stage is LOCKED:

1. **Later stages may implement it.** Stage 16 owns credential fields, session contents, rate-limit
   dimensions and the RLS policy text's security review. Stage 18 owns retention. Stage 19 owns the
   three deferred tables. Stage 20 owns index tuning with measurements.
2. **Later stages may record traceable owner amendments** in the form of **A15-nnn**, stating the
   locked text, the narrowing or correction, and the cause. **They may not silently rewrite.**
3. **Conflict identifiers are stable** — C-78 and C-79 keep their numbers permanently, whatever happens
   to them.
4. **DBT identifiers are never renumbered, never reused and never deleted.** A table that disappears
   from the design leaves its identifier retired, not recycled.
5. **A later finding that contradicts this stage is FLAGGED, not absorbed.**

**This stage's approval is not production security clearance and is not legal sign-off.** The BytHub
Legal & Compliance go-live block of 23 August 2026 — **17 Critical, 52 High, across 14 domains, 0%
clearance** — stands unchanged. The baseline remains **UNVERIFIED**; evidence is capped at **E2** until
the owner's native test runs complete.

---

## Summary

Stage 15 takes a 41-table schema in which twelve tables carry no tenant column, one table fuses two
identity concerns in eighteen columns, one table carries three status columns for four different
facts, one carries two lifecycle columns for one payment, a unique index silently enforces nothing
because of NULL distinctness, file bytes live in a database column, and CI pushes schema with
`--force` — and states the physical target: **76 tables, two independent isolation mechanisms, thirty
registered uniqueness guarantees, no derived value independently writable, I-2 provable in one
transaction, and a fourteen-step migration in which nothing is dropped until a single approved final
step.**

**Two conflicts are raised (C-78, C-79), one traceable amendment is made to locked Stage 13 (A13-001),
and no owner question is asked, because none genuinely remained.**

---

## 55. Amendment register — amendments recorded after this stage was locked

**This section is append-only.** Each entry states the locked text it extends or narrows, what changed,
why, and which stage raised it. **No locked text above is edited, no identifier is renumbered, and no
row is removed.** An amendment that cannot be expressed as an addition to, or a narrowing of, locked
text is a conflict, not an amendment, and is raised as a `C-` identifier instead.

### A15-001 — `credential_tokens`, and the column a per-request authority check needs

```
RAISED BY:  Stage 16 (SECURITY_AUTH_PRIVACY.md §49)
DATE:       30 August 2026
AFFECTS:    §1.1 counting rule · §41 catalogue · §33 uniqueness register · DBT-007
TYPE:       ADDITION — one table, two uniqueness guarantees, one column.
            Nothing removed, nothing renamed, nothing renumbered.
STATUS:     RECORDED
```

**What Stage 15 stated, and why it was right.** §1.1 fixed the counting rule — *a table receives a DBT
identifier if and only if Stage 15 defines its physical shape* — and applied it to reach **76 tables**.
That rule is unchanged and the 76 are unchanged. **This amendment adds a 77th because a later stage made
a decision that requires a table nobody yet had a reason to design.**

**What Stage 16 decided.** Four separate decisions each need a single-use credential record:

| Stage 16 decision | Needs |
|---|---|
| **SEC-D024** a password reset is its own record, not an invitation with a magic `role` string | a reset token with its own lifecycle and retention |
| **SEC-D082** a recovery code is a ROW, so single-use is a database guarantee rather than a JavaScript filter | one row per code, with a consumption stamp |
| **SEC-D083** a pending MFA enrolment secret expires on its own in 10 minutes and never enters the session store | an encrypted, short-lived record |
| **SEC-D086** email verification is a separate recorded fact | a verification token |

**One shape serves all four**, for the same reason §19 refused to create a `settlements` table for an
API noun: **the shape follows the invariant, not the caller.** Four near-identical tables would be four
places to get single-use wrong.

### The addition

**DBT-077 `credential_tokens`** — MOD-002 · **GLOBAL, no `school_id`**

`id` · `person_id` · **`purpose`** (`password_reset` · `email_verification` · `mfa_recovery` ·
`mfa_enrolment`) · `token_hash` · `secret_ciphertext` (used only by `mfa_enrolment`) · `key_id` ·
`issued_at` · `expires_at` · **`consumed_at`** · `consumed_by_session_id` · `issued_by_person_id` ·
`invalidated_at` · `invalidated_reason`.

**Tenancy is the GLOBAL class of §6**, the same as **DBT-007 `persons`** and **DBT-008 `credentials`**.
A credential belongs to a person, and a person is global (§8). A tenant column here would reintroduce
exactly the fusion §8's identity decomposition removed.

| New | Constraint | Enforces |
|---|---|---|
| **DBI-031** | `UNIQUE (token_hash)` | **global and unconditional** — the same construction as **DBI-029** for link codes, and for the same reason: a token is a credential, and an expired token's hash must never become reissuable |
| **DBI-032** | `UNIQUE (person_id, purpose) WHERE consumed_at IS NULL AND invalidated_at IS NULL` | at most one live token per person per purpose — a second reset request invalidates the first rather than leaving two live links |

**DB-P19 was checked explicitly and holds.** DBI-032's predicate reads two stored columns and **does not
consult the wall clock**. An expired-but-unconsumed row keeps the slot until something explicitly
invalidates it — which is deliberate, because a predicate whose meaning changes as time passes, with no
write occurring, is precisely what DB-P19 forbids. Expiry is enforced in the **consumption statement**,
where `now()` is legitimate:

```sql
UPDATE credential_tokens
   SET consumed_at = now(), consumed_by_session_id = $1
 WHERE token_hash = $2 AND purpose = $3
   AND consumed_at IS NULL AND invalidated_at IS NULL AND expires_at > now()
-- rowCount = 0 ⇒ already used, invalidated or expired ⇒ the transaction ABORTS
```

**One column on an existing Stage-15-shaped table:**

| Table | Column | Required by |
|---|---|---|
| **DBT-007 `persons`** | `authority_version integer NOT NULL DEFAULT 0` | Stage 16 **SEC-D013** — a cached authority answer is keyed by this integer, so a revocation takes effect on the next request rather than after a timeout |

**No amendment is needed for three things that might look like they need one**, because Stage 15 assigned
them to Stage 16 in its own text: **DBT-008 `credentials`' fields** (*"Stage 16 owns every field's
form"*), **DBT-075 `user_sessions.sess` contents**, and **DBT-076 `rate_limits`' algorithm and
dimensions**. Stage 16 exercising a grant Stage 15 made is not an amendment, and is not recorded as one.

### Effect on this document's counts

| | Locked | After A15-001 |
|---|---|---|
| DBT tables | **76** — DBT-001 … DBT-076 | **77** — DBT-001 … **DBT-077** |
| DBI uniqueness | **30** — DBI-001 … DBI-030 | **32** — DBI-001 … **DBI-032** |
| MOD-002 tables | 5 | **6** |
| Deferred without identifiers | 3 | 3 — unchanged |
| Migration | MIG-01 … MIG-14 | unchanged — **DBT-077 is created by MIG-03** with the other new tables |

**§41's catalogue and §33's register above are not edited.** They record what Stage 15 locked; this
entry records what was added and by whom. **A reader reconciling the two gets both the original count
and its provenance, which is the point of an append-only register.**

**DBT-077 is created by MIG-03**, by migration — **never by application DDL** (Stage 16 SEC-D040,
**C-86**) and never by `db:push` (**DBD-043**, **C-78**).

### Why this is an amendment and not a conflict

**Nothing Stage 15 states is contradicted.** The counting rule is correct and was correctly applied to
what was known when it was written. A later stage then created the need for a 77th table. The honest
record of that is an addition whose cause is traceable to the stage that caused it — **not a silent 77th
row appearing inside a locked catalogue, and not a conflict identifier for a document that got nothing
wrong.**

```
STAGE 15 — PHYSICAL DATABASE SCHEMA & INTEGRITY
STATUS: LOCKED — 30 August 2026
Amendments recorded: A15-001 (raised by Stage 16)
Tables: 76 as locked, 77 including A15-001 · Uniqueness: 30 as locked, 32 including A15-001
Open owner questions: 0 · Conflicts: C-78 · C-79
```

### A15-002 — `email_suppressions`, and the fact a bounce may not overwrite

```
RAISED BY:  Stage 17 (INTEGRATIONS_PROVIDERS.md §36)
DATE:       31 August 2026
AFFECTS:    §41 catalogue · §33 uniqueness register
TYPE:       ADDITION — one table, one uniqueness guarantee. Nothing removed or renumbered.
STATUS:     RECORDED
```

**Why an addition is needed.** Stage 17 established that a provider's hard bounce or complaint is a
**deliverability** fact, and that it must never be written into
`credentials.email_verified_at`, which is an **identity** fact — a person proved control of an address
on a date, and a mailbox failing today does not un-prove that. Letting a provider's report revoke a
verified identity would breach Stage 16 SECAR-017 (a failed send never changes a business outcome).

**Both existing candidates were inspected first and both fail:**

| Candidate | Why not |
|---|---|
| **DBT-057 `notification_preferences`** | records **what a person chose**. A suppression is not a choice; storing it here makes a bounce indistinguishable from a preference, and a person who repairs their mailbox would find their own settings rewritten |
| **DBT-054 `delivery_attempts`** | records **each attempt**, correctly and append-only. It holds no current-state fact, so "currently undeliverable" would be recomputed from history on every send |
| **DBT-008 `credentials`** | Stage 16 closed its field list (SEC-D003), and its subject is proving identity — not delivery, which MOD-009 and MOD-015 own |

**DBT-078 `email_suppressions`** — MOD-009 · **GLOBAL, no `school_id`**

`id` · `email` (citext) · `suppression_kind` (`hard_bounce` · `complaint` · `manual`) ·
`first_suppressed_at` · `last_event_at` · `last_failure_class` · `released_at` ·
`released_by_person_id` · `released_reason`.

**Global rather than per-school, because a dead mailbox is dead everywhere.** A guardian at two schools
has one address; suppressing it for one school and not the other would keep sending mail already known
to fail.

| New | Constraint | Enforces |
|---|---|---|
| **DBI-033** | `UNIQUE (email) WHERE released_at IS NULL` | one live suppression per address; release is explicit and attributed |

**DB-P19 checked and holds:** the predicate reads one stored column and does not consult the wall clock.

**What this table must never do.** It never writes, clears or influences
`credentials.email_verified_at`. **That separation is the reason the table exists rather than a flag on
an existing row**, and it is the point of the amendment.

**Created by MIG-03** with the other new tables — never by application DDL (Stage 16 SEC-D040,
**C-86**) and never by `db:push` (**DBD-043**, **C-78**).

### Effect on this document's counts, including A15-001

| | Locked | After A15-001 | After A15-002 |
|---|---|---|---|
| DBT tables | **76** | 77 | **78** — DBT-001 … **DBT-078** |
| DBI uniqueness | **30** | 32 | **33** — DBI-001 … **DBI-033** |
| MOD-002 tables | 5 | 6 | 6 |
| MOD-009 tables | 5 | 5 | **6** |
| Migration | MIG-01 … MIG-14 | unchanged | unchanged — **DBT-078 is created by MIG-03** |

**§41's catalogue and §33's register above are not edited.** They record what Stage 15 locked; this
register records what was added, by whom, and why.

### A15-003 — the canonical audit event, and the console operation record

```
A15-003 · Audit and console operations
RAISED BY  Stage 19 — AUDIT_ACCOUNTABILITY.md, 31 August 2026 · LOCKED
TYPE       ADDITION — two tables. Nothing removed, renamed or renumbered.
```

**§30 of this document deferred `audit_events` deliberately**, recording it as *"DEFERRED — Stage 19
owns the record mechanics **and** the schema"* with no DBT identifier, so that fixing columns early
would not pre-empt that stage. **This amendment is that deferral being honoured.**

| New table | Owner | Tenancy |
|---|---|---|
| **DBT-079 `audit_events`** | **MOD-013 Audit & Attribution** | **MIXED scope** — a `scope_kind` discriminator over `school` · `platform` · `identity` |
| **DBT-080 `console_operations`** | **MOD-012 Platform Operations** | tenancy **derived** from its parent event · **1:0..1** with `audit_events` |

**DBT-080 is MOD-012's, not MOD-013's.** It holds the operational facts of a privileged platform
operation — typed operation, tier, target, elevation link — and **no actor, no context, no authority
and no capability**, which live once on the linked audit event. This keeps **DM-054** in the module
Stage 8 locked it into. **Stage 19 §6.2 carries the reasoning.**

**Two new uniqueness entries**

| New | Constraint | Enforces |
|---|---|---|
| **DBI-034** | `UNIQUE (business_act_key, action_key) WHERE business_act_key IS NOT NULL AND outcome = 'succeeded'` | **one piece of evidence per business act.** It is **not** a business idempotency key — **DBI-014** remains the settlement one |
| **DBI-035** | `UNIQUE (audit_event_id)` on `console_operations` | the 1:0..1 link is structural; an orphan operation record cannot exist |

**Also carried by A15-003, and specified in full at Stage 19 §7.1:** **eleven CHECK constraints**
(CK-A1 … CK-A9, CK-B1 … CK-B2), **seven foreign keys** (FK-A1 … FK-A7, all `ON DELETE RESTRICT`,
including a self-reference from an elevated operation to the event that granted its elevation), and
**eight supporting indexes**. **DB-P19 holds: no CHECK or index predicate reads the wall clock.**

**`scope_kind = 'identity'` is a third value this document had not anticipated.** An act on an account
— a sign-in, a password change, a context switch — belongs to no tenant, and **a guardian with children
at two schools has one account whose history belongs to neither.** CK-A2 makes the pair honest:
`(scope_kind = 'school') = (school_id IS NOT NULL)`.

**Nothing is dropped.** `audit_logs`, `message_audit_logs` and `console_audit` are **migrated at MIG-07
and dropped only at MIG-14**, after the soak and owner approval — and **MIG-14 gains a precondition**:
the existing console `beforeSnapshot` / `afterSnapshot` values are **LEGACY SNAPSHOT DISPOSITION →
POLICY INPUT REQUIRED** (Stage 19 §7.3), and **must not be destroyed merely because the target schema
no longer carries snapshot columns.**

**Created by MIG-03** with the other new tables — never by application DDL (Stage 16 SEC-D040,
**C-86**) and never by `db:push` (**DBD-043**, **C-78**).

### Effect on this document's counts, including A15-001 and A15-002

| | Locked | After A15-001 | After A15-002 | After A15-003 |
|---|---|---|---|---|
| DBT tables | **76** | 77 | 78 | **80** — DBT-001 … **DBT-080** |
| DBI uniqueness | **30** | 32 | 33 | **35** — DBI-001 … **DBI-035** |
| MOD-002 tables | 5 | 6 | 6 | 6 |
| MOD-009 tables | 5 | 5 | 6 | 6 |
| **MOD-012 tables** | **2** | 2 | 2 | **3** — plus DBT-080 |
| **MOD-013 tables** | **0** | 0 | 0 | **1** — DBT-079 |
| Migration | MIG-01 … MIG-14 | unchanged | unchanged | unchanged — **both created by MIG-03**; **MIG-14 is blocked on the snapshot disposition** |

**§41's catalogue and §33's register above are not edited.** They record what Stage 15 locked; this
register records what was added, by whom, and why.

```
STAGE 15 — PHYSICAL DATABASE SCHEMA & INTEGRITY
STATUS: LOCKED — 30 August 2026
Amendments recorded: A15-001 (Stage 16) · A15-002 (Stage 17) · A15-003 (Stage 19)
Tables: 76 as locked, 80 including amendments · Uniqueness: 30 as locked, 35 including amendments
Open owner questions: 0 · Conflicts: C-78 · C-79
```
