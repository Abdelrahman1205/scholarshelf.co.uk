# MIGRATION_TARGET_EXTRACTION_CUTOVER.md
# Stage 22: Migration, Target Extraction & Cutover

```
STAGE 22 — MIGRATION, TARGET EXTRACTION & CUTOVER
STATUS: **LOCKED**
Locked: 1 September 2026 by the owner (BytHub Technology Ltd)
Written: 1 September 2026 · corrected and locked the same day

**STAGE 22 IS THE FINAL ARCHITECTURE STAGE.**
NO STAGE 23 ARCHITECTURE DOCUMENT EXISTS, AND NONE WILL BE WRITTEN.
The next document is IMPLEMENTATION_MASTER_PLAN.md — an EXECUTION
CONTROL document derived from Stages 1–22.  It is not architecture.

OWNER DECISIONS          MIGQ-1 = A   scheduled write-freeze window
                         C-107   = A   wipe-school → API-247 (A14-003)
OPEN OWNER QUESTIONS     0
NEW CONFLICTS            1  ── C-107, raised here, RESOLVED as a target
                              specification by the owner via A14-003;
                              IMPLEMENTATION REMAINS OPEN
AMENDMENTS RAISED        4  ── A14-002 typo · A14-003 legacy mapping ·
                              A7-001 audit count · A22-001 this stage's
                              own factual reconciliation
CONFLICTS CLOSED         0

POST-LOCK FACTUAL RECONCILIATION: see the AMENDMENT REGISTER at the end
of this document.  A22-001 corrects six stated facts and records one
owner decision.  It does NOT unlock Stage 22.

LOCKING STAGE 22 DOES **NOT** MEAN
   code changed · migrations ran · tests passed · infrastructure exists
   security controls are implemented · Legal & Compliance cleared
   production · production is ready
   ── it means the ARCHITECTURE is settled and the execution plan may
      now be written
```

**Governed by** Stages 1–21, **all LOCKED**, including their amendment registers: **A4-001**,
**A7-001**, A11-001, A13-001, **A14-001**, **A14-002**, **A14-003**, A15-001, A15-002, A15-003,
A16-001, A16-002, A17-001, **A19-001**, **A20-001**, **A20-002** — and Stage 22's own **A22-001**.

**Where a locked source and this document's paraphrase disagreed, THE LOCKED SOURCE WON.** Six such
disagreements were found at the correction pass and every one was resolved in the locked source's
favour: parent self-registration (§12), the module catalogue (§6), the thirteen data layers (§7), the
DMR-013 table map (§15), the SheetJS distribution decision (§14), and the import commit identifier
(§10.3). **In each case the error was Stage 22's, and no locked stage was amended to accommodate it.**

---

## 1. Purpose and boundary

Stage 22 answers one question:

> **How do we turn the CURRENT working ScholarShelf repository into the LOCKED target ScholarShelf —
> without throwing away proven behaviour, without carrying dead architecture forward, without losing
> data, and without running the old and new systems forever?**

**The guiding principle, in four lines:**

```
PRESERVE PROVEN BEHAVIOUR.
REMOVE ACCIDENTAL ARCHITECTURE.
REBUILD SECURITY-CRITICAL BEHAVIOUR.
KEEP LEGACY CODE IN GIT, NOT IN PRODUCTION.
```

**This is not a full rewrite.** A rewrite would discard eighteen months of behaviour that works, most of
which no test protects and no document fully describes — **the code IS the specification for the parts
nobody wrote down.**

**It is not cleanup-in-place either.** Cleanup-in-place has no whitelist, so it ends when someone gets
tired rather than when the architecture is reached, and the accidental parts survive because nobody
could prove they were unused.

**It is TARGET-ONLY EXTRACTION: the locked architecture is the whitelist, and everything reaches the
target by being explicitly classified into it.**

### 1.1 What Stage 22 decides — and does not

| Decides | Does not decide |
|---|---|
| the classification of every significant current source unit | **any line of application code** |
| the disposition of every current route, screen, dependency and table | which sprint anything lands in |
| the migration chain's order, preconditions and verifications | **the executable checklist** — that is `IMPLEMENTATION_MASTER_PLAN.md` |
| the implementation batch sequence and its dependency logic | provider provisioning — **Stage 21** |
| what proof each removal requires before it may happen | **whether the proof exists** |
| the cutover mechanics for each provider and each data class | when the owner runs any of it |

### 1.2 Nothing was implemented

**No application file was created, edited, moved or deleted. No route, screen or dependency was
removed. No package was installed and `package.json` was not edited. No CI file was edited. No AWS CDK
file was created. No AWS, Vercel, Neon, SES, Sentry or Resend resource or configuration was created or
changed. No database role was created. No migration was written or executed. No data was copied,
quarantined or destroyed. No DNS was changed. No Git tag was created, no branch was created, nothing
was committed or pushed. Nothing was deployed.**

**This document is a plan. Every register in it is a classification, not an action.**

### 1.3 The release boundary is unchanged

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2**.

---

## 2. Evidence inspected

**The whole repository, read directly, 1 September 2026.**

```
ENTRY POINTS       api/index.ts  ── the production entry
                   server/index.ts · server/app.ts
                   client/src/main.tsx · client/src/App.tsx

SERVER             server/routes/          19 files
                   server/storage.ts       3,532 lines · 153 async methods
                   server/config/          env.ts · database.ts · consoleDb.ts
                   server/middleware/      auth.ts and the rest
                   server/console/         audit.ts and the console tier
                   server/custody.ts       the state machine
                   server/                 19,948 lines total

CLIENT             client/src/pages/       42 page files
                   client/src/components/  59 component files
                   client/src/lib/ · hooks/
                   client/src/             23,381 lines total

SHARED             shared/schema.ts        41 pgTable declarations
                   shared/                 1,723 lines

MIGRATIONS         001 … 006               799 lines
SCRIPTS            script/                 1,562 lines · 12 files
TESTS              tests/ + smoke-boot     3,555 lines · 11 suites + 1
CI                 .github/workflows/ci.yml
CONFIG             package.json (79 deps + 19 devDeps) · vercel.json ·
                   drizzle.config.ts · vite.config.ts · tsconfig.json
```

**Counted, not estimated:**

| | Current |
|---|---|
| **server routes** | **243** registered `app.*` / `router.*` handlers across 19 route files plus `routes/index.ts` — **recounted mechanically on 1 September, §9. `server/routes.ts` is a re-export shim and registers nothing** |
| **client route patterns** | **15** in `App.tsx` — four of which are `:section?` catch-alls fanning out to the 42 pages |
| **page files** | **42** |
| **component files** | **59** |
| **database tables** | **41** `pgTable` declarations |
| **`storage.ts` methods** | **153** `async` methods in one 3,532-line class |
| **dependencies** | **79** runtime + **19** dev |
| **import pipelines** | **2** — confirmed at §21 |

**Locked stages 1–21**, including every amendment register.

**A file was not classified by its name.** `admin/shared.tsx` is not shared infrastructure; `owner.tsx`
is not the platform owner console; `it-dashboard.tsx` and `system-health.tsx` are different surfaces
from `admin/dashboard.tsx`. **Each was opened.**

---

## 3. Current baseline state

**BA-1 · What exists, honestly**

```
   ~50,200 LINES.  ONE repository.  ONE npm package.  ONE deployable application.

   "IT WORKS.  SCHOOLS USE IT."
      ── THIS IS AN OWNER / PROJECT-HISTORY CLAIM, and it is recorded as one.
         It is NOT runtime evidence, NOT a passing test suite, and NOT a
         customer-verified statement held by this document.
         EVIDENCE CEILING: E2.  It does not become E3 or E4 by being
         written down again.

   AND THE ARGUMENT FOR EXTRACTION DOES NOT WEAKEN BECAUSE OF THAT.
      The reason to extract rather than rewrite is that ~50,200 lines encode
      behaviour NO DOCUMENT FULLY DESCRIBES and NO TEST FULLY PROTECTS.
      That is true whether the baseline is E2 or E4 — and at E2 it is
      MORE true, because there is even less to fall back on.

   SERVER 19,948   ── 243 registered handlers across 19 files
                      + storage.ts: 153 methods, 3,532 lines, ONE class
   CLIENT 23,381   ── 42 pages, 59 components, 15 route patterns
   SHARED  1,723   ── 41 pgTable declarations in one schema file
                      + console_audit, created by SQL migration only  = 42
   TESTS   3,555   ── 11 hand-rolled suites, no framework        Stage 20
```

**BA-2 · The four shapes that make extraction necessary rather than optional**

| | |
|---|---|
| **one storage class holds 153 methods** | tenancy, money, custody, identity, messaging and CMS all reach the database through the same object. **Stage 8's module boundaries do not exist in the code — but the BEHAVIOUR inside those methods largely does, and much of it is correct** |
| **41 tables where the target has 80** | not because the target is bloated: the current schema **conflates** identities, allocations, branding and payments into rows that carry several concepts each. **Stage 15's 80 tables are mostly the same data, decomposed** |
| **243 registered handlers where the contract has 283** | **recounted at correction — 243, not 242.** The numbers are close and the overlap is not: **only 9 of the 243 sit at their exact target method and path**, three client calls reach no route at all, and several current routes do two jobs. §9 |
| **two import pipelines** | `/api/families/enroll/import/{analyze,commit}` and `/api/students/import/{preview,confirm}` — **different validation, different preview semantics, different transactional guarantees.** This is **C-26**, and §21 resolves it |

**BA-3 · The baseline is UNVERIFIED, and that is the first thing implementation must change**

```
E0  summary claim only          E3  fail-before / pass-after demonstrated
E1  code read and confirmed     E4  runtime / production behaviour verified
E2  a named regression test exists

CEILING TODAY: E2.
   ── the suites could not be executed through the device bridge, so nothing
      is above "a test with the right name exists in a suite CI is configured
      to run"
   ── §5's baseline freeze is what moves it
```

---

## 4. Target-extraction principles — TXP-1 … TXP-16

```
TXP-1    THE LOCKED ARCHITECTURE IS THE WHITELIST.
         Code reaches the target by being classified INTO it, never by
         surviving a deletion pass.

TXP-2    REPLACEMENT BEFORE REMOVAL.  Always.  Without exception.
         BUILD → TEST → PROVE → SWITCH → SOAK → REMOVE.            TXP-2

TXP-3    "IT EXISTS TODAY" IS NOT A REASON TO KEEP IT.
         "IT LOOKS OLD" IS NOT A REASON TO REMOVE IT.
         Both are the same error: classifying by appearance.

TXP-4    A FUNCTION IS NOT REWRITTEN BECAUSE IT MOVES MODULE.
         Moving is not rewriting, and rewriting working arithmetic is how
         a migration introduces a money bug.

TXP-5    SECURITY-CRITICAL MECHANISM IS NOT SALVAGED BECAUSE IT WORKS.
         Working is not the bar.  Stage 16 is the bar.                §25

TXP-6    GIT IS THE ARCHIVE.  PRODUCTION SOURCE IS NOT.
         No dead file is kept "in case we need to look at it."

TXP-7    DEAD CODE IS PROVED DEAD, NOT ASSUMED DEAD.
         "The frontend does not call it" is not evidence.             §40

TXP-8    DATA DOES NOT FOLLOW CODE'S DELETION RULES.
         Code needs a replacement.  Data needs a migration, a
         reconciliation, a policy check and a soak.                   TXD-087

TXP-9    EXPAND → MIGRATE → COMPARE → SWITCH → SOAK → CONTRACT.
         Never DROP-then-hope.                                        §32

TXP-10   ONE AUTHORITY AT A TIME.  A dual-write has a primary and a copy,
         never two equals.                                            §34

TXP-11   EVERY TEMPORARY MECHANISM IS BORN WITH ITS REMOVAL BATCH.
         A bridge without an exit is a permanent architecture.

TXP-12   A BATCH THAT CANNOT BE DESCRIBED IN ONE SENTENCE IS TWO BATCHES.
         "Refactor the backend" is not a batch.                       §35

TXP-13   TESTS ACTIVATE WITH THEIR SLICE, RED FIRST, INSIDE THE BATCH.
         No known-red security test ever merges.        Stage 20 TST-D036

TXP-14   NO IRREVERSIBLE STEP BEFORE ITS BACKUP AND ITS REHEARSAL.     §39

TXP-15   THE MIGRATION IS RECONCILED, NOT ASSUMED.  Row counts, sums,
         hashes and chains — before the source is eligible for removal.

TXP-16   ARCHITECTURE DOES NOT CLOSE AN IMPLEMENTATION CONFLICT.
         Saying what to do is not evidence of having done it.         §37
```

**BX-1 · The extraction model**

```
                        CURRENT CODE  ── ~50,200 lines
                              │
                          INSPECT      ── open it; do not judge by filename
                              │
                         CLASSIFY
                              │
   ┌──────────────────────────┴──────────────────────────────────────┐
   │ KEEP       proven target-compatible behaviour, already in place │
   │ MOVE       good code, wrong architectural location              │
   │ REFACTOR   good behaviour, boundary or contract needs correction│
   │ REPLACE    behaviour needed, implementation unsafe or legacy    │
   │ BRIDGE     temporary migration compatibility ONLY, with an exit │
   │ REMOVE     not in the target, and no remaining caller — PROVED  │
   └──────────────────────────┬──────────────────────────────────────┘
                              │
                    TARGET SCHOLARSHELF
                              │
              only locked architecture remains;
              everything removed is still in Git
```

---

## 5. Git and baseline freeze

**TXD-001 · Implementation begins with a freeze, and the freeze is what makes every later claim
measurable**

```
BEFORE THE FIRST IMPLEMENTATION COMMIT

 1  RESOLVE THE THREE STALE .git LOCK FILES — safely, having confirmed no
    process holds them.  Then `git gc`.
 2  RUN THE OUTSTANDING NATIVE WINDOWS BASELINE COMMANDS
       npm run check · npm run test:smoke · npm run build
       npm run test:custody · npm test
 3  RECORD EXACT PASS / FAIL RESULTS — per suite, verbatim
 4  COMMIT the architecture documents (Stages 1–22 and their amendments)
 5  PUSH  restructure/aug-2026
 6  TAG the baseline
```

**TXD-002 · A failing baseline test is RECORDED, not fixed first**

```
IF A BASELINE COMMAND FAILS
   ── DO NOT "just fix it" before recording it
   ── RECORD:  KNOWN BASELINE FAILURE — <suite> · <error> · <date>

WHY THIS MATTERS MORE THAN IT SOUNDS
   the entire migration will be judged by "did we break something?"
   ── without a recorded baseline, EVERY failure during implementation is
      arguably a migration regression, and every one of them will be argued
   ── with it, the question is answerable in seconds

   A PRE-EXISTING DEFECT AND A MIGRATION REGRESSION LOOK IDENTICAL IN A
   TEST RUNNER.  Only the baseline tells them apart.
```

**TXD-003 · Branch and tag strategy**

```
restructure/aug-2026     ARCHITECTURE BRANCH
                         preserves the locked-stage work.  Not deleted.

<baseline tag>           IMMUTABLE reference to pre-implementation code
                         suggested: pre-target-extraction-2026-09
                         ── or another date-based name following the
                            repository's own convention
                         NOT CREATED NOW.

<implementation branch>  the target architecture implementation
                         NOT CREATED NOW.

HISTORY IS NEVER DELETED.  Once legacy code leaves the target, the tag and
the branch are how anyone reads it again.
```

---
---

## 6. Code survival register — CSR-001 … CSR-059

**Classified by LOGICAL RESPONSIBILITY, not by file — because a file-level answer for `storage.ts`
would hide 153 methods, most of which contain behaviour that must survive.**

**Every entry carries: current location · current responsibility · target module · classification ·
reason · security impact · data impact · the test that protects it · its batch · its removal gate.**
The table below carries the classification and the reason; **the batch column is §35's phase, and the
protecting test is §36's activation.**

### 6.1 `server/storage.ts` — decomposed by responsibility, never as one file

**`storage.ts = REMOVE` would be the single most destructive line in this document.** It holds the
money arithmetic, the tenancy asserts, the custody transitions and the identity resolution — **and four
private scoping asserts that Stage 7's model needs.**

| CSR | Responsibility group | Methods | Target module | Class | Reason |
|---|---|---|---|---|---|
| **CSR-001** | **the four private scoping asserts** (`storage.ts:1404–1521`), applied at 18 call sites | 4 | **MOD-001 / the data layer** | **MOVE + REFACTOR** | **already correct in intent** — Stage 7's SC-1 is exactly this. They move beneath RLS and become the application half of a two-layer boundary, not the only layer |
| **CSR-002** | **`confirmPayment`** — single `transaction()`, conditional `UPDATE … WHERE status NOT IN (…) RETURNING *` as the claim | 1 | **MOD-007 Settlement & Funding** | **REFACTOR** | **the atomic claim pattern is right and is kept.** It expands to I-2's six writes (§23) rather than being rewritten |
| **CSR-003** | Book, book-copy, level and inventory reads/writes | 17 | **MOD-005 Catalogue / Stock** | **MOVE** | arithmetic and level rules are proven; the boundary is wrong |
| **CSR-004** | User, invite and secondary-role methods | ~15 | **MOD-002 Identity & Access** | **REPLACE** | **the role-string model is what Stage 7 replaces** — §16. **There is no "MOD-003 Authority" module** — authority grants are MOD-002's facts under the Stage 7 chain |
| **CSR-005** | **Class, subject and teacher-assignment/staffing methods** | ~13 | **MOD-003 Academic Structure** | **MOVE + REFACTOR** | `getTeacherClassIds` is already the ONE canonical lookup and is KEPT. **Split out of the old combined row: classes, subjects and staffing are MOD-003's facts** |
| **CSR-006** | **Child (student) record methods** | ~12 | **MOD-004 Children & Families** | **MOVE + REFACTOR** | **a child record is MOD-004's fact, not MOD-003's.** MOD-003 places a child; it does not own the child. Class MEMBERSHIP is the seam between them |
| **CSR-007** | Family, guardian, linking-code, parent-children methods | ~14 | **MOD-004 Children & Families** | **MOVE + REFACTOR** | relationship logic is proven; identity decomposition is Stage 15's. **The account-binding half CONSUMES MOD-002 Identity & Access — that does not make MOD-002 a co-owner of the relationship facts** |
| **CSR-008** | Payment, basket, provider-payment, verification methods | ~11 | **MOD-007 Settlement & Funding** | **REFACTOR** | money arithmetic KEPT; the three status domains stay distinct (D6) |
| **CSR-009** | Distribution, allocation, custody methods | ~6 | **MOD-008 Fulfilment & Custody** | **MOVE** | **MOD-006 is Book-Supply Cycle & Requirements — a different module.** Custody and hand-over are MOD-008's facts |
| **CSR-010** | Message and thread methods | ~7 | **MOD-009 Communication** | **MOVE** | `message_audit_logs` already has the right shape — Stage 19 AUD-F01's counter-example. **MOD-010 Reporting & Projections owns no business truth and owns nothing here** |
| **CSR-011** | Website / CMS methods | 4 | **MOD-011 School Website (CMS)** | **MOVE** | |
| **CSR-012** | School and school-settings methods | 7 | **MOD-001 Tenancy & School Configuration** | **REFACTOR** | school identity, school configuration, school policy and **CMS entitlement (MA-2)** are MOD-001's facts. Branding splits per Stage 15 §29 into MOD-001 identity and MOD-011 site theme. **Only the PLATFORM lifecycle/support act on a tenant belongs to MOD-012 Platform Operations — ordinary school configuration does not** |
| **CSR-013** | Audit methods | 2 | **MOD-013 Audit & Attribution** | **REPLACE** | Stage 19's canonical event replaces both — §29 |
| **CSR-014** | the `IStorage` interface itself | — | — | **REMOVE** | **at the very end.** It is the seam every caller uses; it dies when the last caller has moved, not before |

### 6.2 The code that is KEPT because it is correct

**This is the list that makes this an extraction. Each was read and each is target-compatible.**

| CSR | What | Where | Class | Why it survives |
|---|---|---|---|---|
| **CSR-015** | **the custody state machine** | `server/custody.ts` — `CUSTODY_STATES`, `ALLOWED_TRANSITIONS`, `isTransitionAllowed`, `deriveCustodyFromLegacy` | **KEEP** | pure, deterministic, and **already covered by the only true unit test in the repository** |
| **CSR-016** | **`script/smoke-boot.ts`** | 183 lines | **KEEP, UNCHANGED** | it compiles and boots the real production entry. **Stage 20 and Stage 21 both keep it first in the pipeline** |
| **CSR-017** | **the tenant-isolation reasoning and probes** | `tests/tenant-isolation.ts` | **KEEP → PORT** | 404-over-403, two seeded schools. Stage 20 adopts its rule verbatim |
| **CSR-018** | **`clientIp()`** | `auth.ts:131` | **KEEP** | returns `req.ip`; the header-keyed rate-limit defect is already fixed |
| **CSR-019** | **the null-school / inactive-school choke point** | `auth.ts:352–420` | **KEEP + REFACTOR** | one place, boolean return, `TENANT_SCOPED_ROLES` correctly excludes owner/platform_admin **and parent**. Stage 7's SC-1 is this, formalised |
| **CSR-020** | **`getTeacherClassIds`** | `storage.ts:1254` | **KEEP** | the duplicate in `book.routes.ts` is already gone |
| **CSR-021** | **UK formatting layer** | `client/src/lib/format.ts` | **KEEP** | en-GB, GBP, `formatYearGroup` normalising Grade/Y10/Year 3 |
| **CSR-022** | **`components/query-state.tsx`** | | **KEEP + ADOPT EVERYWHERE** | failed query ≠ confident zero; single 401 redirect. **Imported by 2 of 42 pages — the fix is adoption, not replacement** |
| **CSR-023** | **the console's DB-level controls** | `db-console.routes.ts` header + `001` | **KEEP the intent** | view schema, `BEGIN READ ONLY`, extended protocol, credential-excluding views, always ROLLBACK. **Stage 21 §13 splits its provisioning half out** |
| **CSR-024** | **console audit tiering** | `server/console/audit.ts` | **REFACTOR** | tiers `operation\|query\|breakglass` survive as DBT-080's `tier`; the snapshots go to §30 |
| **CSR-025** | **the cron drain and its budget** | `cron.routes.ts` — `DRAIN_BUDGET_MS = 24_000`, break-out, remaining count | **KEEP + MOVE** | it fixed a real defect where school #2 onward never got a digest. **The transport half is §31's** |
| **CSR-026** | **timing-safe secret comparison** | `cron.routes.ts` | **KEEP** | already correct |
| **CSR-027** | **driver selection by URL** | `config/database.ts` — `isPlaintextDatabase`, `buildSslConfig` | **KEEP + REFACTOR** | the Neon-vs-`node-postgres` split is right; **A13-001 constrains which one RLS reads may use**, and Stage 21 DEP-D042 corrects the TLS half |
| **CSR-028** | **separate console connection strings** | `config/consoleDb.ts` | **KEEP** | *"Absent = that console tier is simply unavailable … no silent fallback."* **This is DBROLE-4/5's application half, already understood** |
| **CSR-029** | **session `save()` on the three auth paths** | `auth.routes.ts:192, 270, 160` | **KEEP** | the login session race is already fixed |
| **CSR-030** | **the user-update allowlist** | `user.routes.ts:283–320` | **KEEP** | five editable fields, `schoolId` change refused 403, collisions 409 |
| **CSR-031** | **server-side context-switch validation** | `auth.routes.ts:299` | **KEEP + REFACTOR** | validates against real contexts, audits real and simulated. **The `SECONDARY_ROLE:*` MECHANISM is C-23 and is replaced** — the validation is not |
| **CSR-032** | **success/warning design tokens** | `index.css` — 5.18:1, 5.13:1 on white | **KEEP** | contrast is arithmetic and it passes |
| **CSR-033** | **`migrations/006`'s identity and money integrity** | unique indexes on `lower(btrim(email))`, `basket_payments(basket_id)`, `book_payments(school_id, upper(btrim(ref)))`; CHECKs built from *declared ∪ present* | **KEEP** | **the CHECK-construction technique is exactly right** and §16 reuses it |

### 6.3 What is REPLACED, and it is not a judgement on the author

| CSR | What | Class | Why Stage 16 requires replacement rather than repair |
|---|---|---|---|
| **CSR-034** | **role-string authorisation** throughout the route layer | **REPLACE** | **SECAR-007 forbids satisfying a capability check with a role string.** Repairing it in place would leave the string as the mechanism |
| **CSR-035** | **`SECONDARY_ROLE:*` strings in a shared table** as the context mechanism | **REPLACE** | **C-23.** Stage 7's context is a first-class concept |
| **CSR-036** | **bcryptjs-only password storage** | **REPLACE** | Argon2id, with rehash-on-login — §16. **No user is forced through a reset** |
| **CSR-037** | **the hand-rolled TOTP implementation** | **REPLACE** | a maintained library — Stage 11. Cryptographic primitives are not where this team's edge is |
| **CSR-038** | **MFA enrolment without a password check** | **REPLACE** | **C-90 · SEC-F21.** `/mfa/setup` and `/mfa/enable` perform no password check today |
| **CSR-039** | **MFA secret handling** — plaintext at rest | **REPLACE** | **C-21** |
| **CSR-040** | **recovery-code consumption** under concurrency | **REPLACE** | single-use must survive two simultaneous redemptions — SEC-T04 |
| **CSR-041** | **password-reset atomicity** | **REPLACE** | token consumption + password write + session revocation, one transaction — SEC-T06 |
| **CSR-042** | **raw webhook / provider-callback reconstruction** | **REPLACE** | Stage 17's authenticity model; **a callback never becomes a confirmation** — §23 |
| **CSR-043** | **in-memory session and storage fallbacks** (`memorystore`, `ALLOW_MEMORY_STORAGE`, `FORCE_MEMORY_STORAGE`) | **REPLACE / REMOVE** | correct for development, **forbidden in production** — Stage 21 §20 |
| **CSR-044** | **`ensureBootstrapSchema()`** — request-time DDL | **ALREADY REMOVED** | `server/app.ts:266` is a tombstone comment. **Recorded so nobody reintroduces the pattern** |
| **CSR-045** | **production env fallbacks** — `process.env.X \|\| <default>` for required values | **REPLACE** | Stage 21 DEP-D043 |
| **CSR-046** | **`ALLOW_TEST_SUPERUSER` and its paths** | **REPLACE + GATE** | the kill switch survives as a *tested refusal* (SEC-T18); **it must be unbootable in production** |
| **CSR-047** | **`audit_logs` write path** — `catch { console.error }` | **REPLACE** | **C-102.** Class A audit shares the business transaction's fate |

### 6.4 What is REMOVED — and every one is proved, not assumed

| CSR | What | Class | The proof §40 requires |
|---|---|---|---|
| **CSR-048** | six genuinely unused packages — §14 | **REMOVE** | zero importing files, checked across `client/src`, `server`, `shared`, `api`, `script` and the build config |
| **CSR-049** | the legacy single-step linking path | **REMOVE** | **C-25** — after the two-step preview/confirm is the only caller |
| **CSR-050** | the duplicate import pipeline — §21 | **REMOVE** | **C-26** — after one commit path is target and the other has no caller |
| **CSR-051** | `GET\|POST /api/cron/run` | **REMOVE** | after **API-283** and **API-278** are live and `vercel.json` points at the new path — §31 |
| **CSR-052** | the six status vocabularies that duplicate each other | **CONSOLIDATE then REMOVE** | Stage 6 selected; **D6 keeps the three that are genuinely distinct** |
| **CSR-053** | `dist/index.cjs`'s server bundle path, if it survives the build change | **REMOVE** | only after `api/index.ts` is provably the sole server artefact — CSR-016 protects this |

### 6.5 Cross-cutting units

| CSR | What | Class | Note |
|---|---|---|---|
| **CSR-054** | `shared/schema.ts` — 41 tables in one file | **REFACTOR** | splits per Stage 15's file map (`identity.ts`, `finance.ts`, `infrastructure.ts` …). **The DECLARATIONS mostly survive; their location and decomposition change** |
| **CSR-055** | `shared/academic-year.ts` — 5 exports | **KEEP** | C6's academic-year model, with `migrations/003` |
| **CSR-056** | `server/routes/index.ts` — the registration seam | **REFACTOR** | it becomes the place the target/bridge/removed route classification is enforced — §9 |
| **CSR-057** | `server/middleware/auth.ts` | **REPLACE + KEEP** | `clientIp` and the choke point are KEPT (CSR-018/018); `auditLog()` is REPLACED (CSR-047) |
| **CSR-058** | the 12 `script/` files | **TRIAGE** | `smoke-boot` KEEP; `seed-*` KEEP as fixtures (Stage 20 §13); `fix-slice2`, `apply-slice4`, `mss-*` are one-off historical scripts → **REMOVE after confirming they are not referenced by CI or a runbook** |
| **CSR-059** | the 11 test suites | **PORT, NEVER DELETE** | Stage 20 TST-D007's ordered method; **`security-regression.ts`'s role assertions are PAIRED, not removed** — TST-D008 |

**TXD-004 · The register's counts**

**THE COUNTING RULE, STATED BEFORE THE NUMBERS — because nineteen rows carry a COMPOUND label**

```
ONE CSR ROW = ONE PRIMARY DISPOSITION.
   A row is counted ONCE, under its PRIMARY disposition.
   Its SECONDARY action is retained as METADATA on the row, and is NOT a
   second tally.

   "MOVE + REFACTOR"        primary MOVE,     secondary REFACTOR
   "KEEP + REFACTOR"        primary KEEP,     secondary REFACTOR
   "KEEP + ADOPT EVERYWHERE" primary KEEP,    secondary ADOPT
   "KEEP + MOVE"            primary KEEP,     secondary MOVE
   "KEEP, UNCHANGED" · "KEEP → PORT" · "KEEP the intent"  → KEEP
   "REPLACE + GATE" · "REPLACE + KEEP" · "REPLACE / REMOVE" → REPLACE
   "ALREADY REMOVED" · "CONSOLIDATE then REMOVE"           → REMOVE
   "TRIAGE" · "PORT, NEVER DELETE"                         → TRIAGE/PORT

   THE PRIMARY IS THE FIRST-NAMED ACTION, WHICH IS ALSO THE ONE THAT
   DECIDES WHETHER THE UNIT SURVIVES.
```

```
CSR-001 … CSR-059     59 classified units — RECOUNTED MECHANICALLY

   KEEP        19
   MOVE         8     ── incl. the storage groups whose behaviour is correct
   REFACTOR     6
   REPLACE     16     ── every one security-critical, §6.3
   BRIDGE       0     ── bridges are ROUTES and DATA, not code units — §10, §11
   REMOVE       8     ── §6.4, each with a stated proof
   TRIAGE/PORT  2     ── the script set and the test set, resolved inside
                         their batches

   19 + 8 + 6 + 16 + 0 + 8 + 2  =  59      ── and 59 rows exist

── 33 of 59 units are KEPT, MOVED or REFACTORED.
   THAT RATIO IS THE ARGUMENT AGAINST A REWRITE.
   ── nineteen of the 59 carry a compound label; not one is counted twice
```

---

## 7. Module extraction

**TXD-005 · Module extraction is code ownership, not network boundaries**

```
THE RESULT REMAINS
   ONE repository · ONE npm package · ONE deployable application
   ONE PostgreSQL write authority

DO NOT CREATE
   microservices · a service mesh · a message broker · a second runtime
   ── Stage 21 §16 forbids it and Stage 12 never asked for it
```

**TXD-006 · The god-surfaces, and what each becomes**

| Current god-surface | Becomes |
|---|---|
| **`storage.ts`** — 153 methods, one class | **THIRTEEN module-owned data layers exist** — locked Stage 13 **APP-025**. They are owned by **MOD-001 · 002 · 003 · 004 · 005 · 006 · 007 · 008 · 009 · 011 · 012 · 013 · 014**. **MOD-010 Reporting & Projections has NO `data.ts`**, because it owns no operational truth; **MOD-015 Delivery & Integration Gateways has NO `data.ts` either** — it is a gateway boundary under `server/gateways/`, outside the business boundary, and owns no business persistence. §6.1 is the decomposition |
| **`shared/schema.ts`** — 41 tables, one file | **the Stage 15 file map** — one file per module's tables |
| **19 route files, 243 registered handlers** | **the target API surface**, organised by Stage 14's namespaces; `routes/index.ts` becomes the enforcement seam (CSR-056). **Recounted at correction: 243, not 242** — §16 |
| **`admin.tsx` + `:section?`** — one page fanning into ~20 | **Stage 9's target screen set**, §12 |

**TXD-006.1 · The thirteen data layers, named — and the two modules that have none**

**Locked Stage 13 APP-025.** The physical destinations are fixed; Stage 22 does not choose them.

```
server/storage.ts  ── 3,532 lines · 153 async methods · one IStorage
        │
        ├── modules/tenancy/data.ts          MOD-001  Tenancy & School Configuration
        ├── modules/identity/data.ts         MOD-002  Identity & Access
        ├── modules/academic/data.ts         MOD-003  Academic Structure
        ├── modules/families/data.ts         MOD-004  Children & Families
        ├── modules/catalogue/data.ts        MOD-005  Catalogue & Inventory
        ├── modules/requirements/data.ts     MOD-006  Book-Supply Cycle & Requirements
        ├── modules/settlement/data.ts       MOD-007  Settlement & Funding
        ├── modules/custody/data.ts          MOD-008  Fulfilment & Custody
        ├── modules/communication/data.ts    MOD-009  Communication
        ├── modules/website/data.ts          MOD-011  School Website (CMS)
        ├── modules/platform-ops/data.ts     MOD-012  Platform Operations
        ├── modules/audit/data.ts            MOD-013  Audit & Attribution
        └── modules/scheduled-work/data.ts   MOD-014  Scheduled Work

   THIRTEEN.  NOT TWELVE.

   MOD-010 Reporting & Projections   ── NO data.ts.  It owns no operational
                                        truth; the absence IS the structure
   MOD-015 Delivery & Integration    ── NOT a module-owned persistence layer.
      Gateways                          It stays under server/gateways/ and
                                        owns NO business persistence

   AND THERE IS NO FOURTEENTH SHARED ONE.
      no successor god object · no IStorage · no databaseService
      no shared repository base class                        APP-025
```

**TXD-006.2 · `storage.ts` is NARROWED, not deleted.** As each slice moves, `storage.ts` delegates to
the new owner, so every legacy caller keeps working. That delegation seam is **CBR-008**, and it has a
removal batch like every other bridge. **CSR-014 `IStorage` dies when the last caller has moved — not
before.**

**TXD-007 · A module boundary is proved by its imports, not asserted by its folder**

```
AFTER EXTRACTION, THE CHECK IS MECHANICAL
   MOD-007 Settlement & Funding must not import MOD-011 School Website
      (CMS)'s data layer
   MOD-013 Audit & Attribution must not be imported by a domain-history
      writer
                                            ── Stage 19 AUD-D001 · AUD-D055
   ── a lint/import-boundary rule, ACTIVATED with the batch that creates
      the boundary                                    Stage 20 §41's model
```

---
---

## 8. API target register

**Stage 14 plus A14-001 is the WHITELIST: API-001 … API-283.**

**TXD-008 · Every one of the 243 current handlers gets exactly one disposition**

| Disposition | Meaning |
|---|---|
| **TARGET** | it corresponds to a locked API-nnn and survives, possibly refactored |
| **LEGACY-BRIDGE** | it must exist temporarily; it is in §9's register with a removal batch |
| **REMOVE** | not in the target and no remaining caller — **proved**, §40 |
| **EXTERNAL / PUBLIC TARGET** | an unauthenticated target surface — the public site, provider callbacks |
| **INTERNAL TARGET** | `/api/internal/*` — MOD-014, SC-10 |

**Current route surface, by file, with the shape of its disposition:**

| Route file | Handlers | Dominant disposition |
|---|---|---|
| `book.routes.ts` | **39** | TARGET — catalogue, levels, copies, inventory |
| `setup.routes.ts` | **22** | TARGET + REMOVE — the setup wizard survives; several steps merge |
| `family-enrollment.routes.ts` | **21** | **TARGET for the surviving import pipeline** — §21 |
| `owner.routes.ts` | **21** | TARGET — platform/support, and where MOD-012 lands |
| `allocation.routes.ts` | **18** | TARGET — fulfilment, and I-2's surface |
| `user.routes.ts` | **18** | **TARGET + REPLACE** — the authority half is CSR-004 |
| `payment.routes.ts` | **15** | TARGET + REPLACE — CSR-042's callback half |
| `auth.routes.ts` | **13** | **TARGET + REPLACE** — §18 |
| `message.routes.ts` | **11** | TARGET |
| `db-console.routes.ts` | **11** | TARGET — CSR-023's controls survive |
| `parent.routes.ts` | **10** | TARGET — the guardian surface |
| `student.routes.ts` | **9** | TARGET + **REMOVE the duplicate import path** — §21 |
| `website.routes.ts` | **9** | TARGET — CMS |
| `notification.routes.ts` | **8** | TARGET + REFACTOR — §25's fact/delivery split |
| `mfa.routes.ts` | **6** | **REPLACE** — CSR-038 … CSR-040 |
| `dashboard.routes.ts` | **5** | TARGET |
| `public.routes.ts` | **3** | EXTERNAL / PUBLIC TARGET |
| `cron.routes.ts` | **2** | **REPLACE** — API-283 + API-278, §31 |
| `routes/index.ts` | 1 | the enforcement seam — CSR-056 |

**TXD-009 · Before a route may be marked REMOVE, nine places are searched — and the frontend is only
one of them**

```
 1  client API callers            2  server internal callers
 3  EMAIL LINKS                   4  cron / scheduled callers
 5  the public site               6  PROVIDER CALLBACKS
 7  tests                         8  scripts and seeds
 9  migration tooling             + any external contract

"THE FRONTEND DOES NOT CALL IT" IS NOT SUFFICIENT EVIDENCE.
   ── an invite link in an email sent three weeks ago is a caller
   ── a provider retrying a webhook is a caller
   ── and neither appears in any grep of `client/src`
```

**TXD-010 · At final target, a registered server route absent from the locked contract FAILS CI.**
Stage 20 TST-D080's three route kinds; §9's register is the only tolerated middle state; **at cutover
the register is empty.**

---

## 9. Current-route reconciliation — all 243 registered handlers

**Recounted mechanically at correction. The PROPOSED draft said 242; the measured number is 243.**

```
MEASURED    grep -rE '(app|router)\.(get|post|put|patch|delete|all)\("' server/
            → 243 registered handlers, 19 route files + routes/index.ts
            ── server/routes.ts is a re-export shim and registers nothing
            ── every handler is registered at an ABSOLUTE path.  There are no
               mount prefixes, so the path in the source IS the live path
            ── GET and POST /api/cron/run are TWO handlers, counted as two

EVERY ONE OF THE 243 IS CLASSIFIED BELOW.  NONE IS UNACCOUNTED FOR.
```

**TXD-011 · The five classes**

| Class | Count | Meaning |
|---|---|---|
| **TARGET** | **6** | already at its exact target method AND path. **The HANDLER is still replaced** — a correct path is not correct authorization |
| **PUBLIC TARGET** | **2** | as above, and unauthenticated by design |
| **INTERNAL TARGET** | **1** | framework infrastructure that survives — the `/api/*` 404 guard |
| **LEGACY-BRIDGE** | **222** | has a named target contract it is not yet serving. **Every one is an LRC entry** |
| **REMOVE** | **12** | has **NO TARGET**. **Every one is an LRC entry with a dead-code proof** |
| **TOTAL** | **243** | |

**TXD-012 · 20 of the 243 targets are STAGE 22 ASSIGNMENTS, and they are marked `S22`**

Stage 14 §17's *Legacy replaced* column and §41's family map name the target for **223** of the
243. For the other **20**, §17 names no legacy against the contract — the current route is a search
variant, an exact alias, or the admin-side twin of a contract §17 recorded from the family side.
**Those are assigned here, by Stage 22, and marked.** They are Stage 22 doing its job; they are not
presented as findings of a locked stage. **No Stage 14 amendment is raised for any of them.**

An amendment or a conflict is raised only where a locked document contradicts **itself or the code** —
**A14-002** (§10.3) and **C-107** (§10.4).

### 9.1 The routes already at a target path — not LRC entries

| Method | Current path = target path | API | Capability | Still to change |
|---|---|---|---|---|
| `GET` | `/api/invites/:token` | **API-008** | PUBLIC | already at the target path |
| `POST` | `/api/auth/context` | **API-005** | CAP-039 | path unchanged; CAP-039 enforcement replaces the role string |
| `POST` | `/api/auth/mfa/recovery-codes` | **API-014** | CAP-038 | already at the target path |
| `POST` | `/api/auth/mfa/setup` | **API-012** | CAP-038 | already at the target path |
| `POST` | `/api/auth/sign-in` | **API-001** | PUBLIC | already at the target path; the HANDLER is replaced (Argon2id, session rotation) |
| `POST` | `/api/auth/sign-out` | **API-003** | authenticated | already at the target path |
| `POST` | `/api/auth/sign-up-parent` | **API-010** | CAP-026 | PARENT SELF-REGISTRATION — CAP-026, UX-005. Path already correct |
| `POST` | `/api/invites/:token/accept` | **API-009** | PUBLIC (token) | already at the target path — LIVE INVITE TOKENS |

**And one framework handler:** `ALL /api/*path` in `dashboard.routes.ts` — the API 404 guard.
**INTERNAL TARGET.** It survives, and it must keep matching after every namespace move, or a retired
legacy path silently starts returning the SPA shell instead of a 404.

### 9.2 Broken callers — the client calls three paths that no route serves

| Client call | Route registered? | Disposition |
|---|---|---|
| `GET /api/isbn-lookup/:isbn` — `admin/books.tsx:55` | **NO** | **C-76.** Target **API-087** `GET /api/school/books/lookup`. The ORPHAN implementation `GET /api/books/by-isbn/:isbn` exists and is called by nobody — **LRC-042**. The fix is a caller correction, not a new endpoint |
| `GET /api/owner/db/browse` — db-console | **NO** | dead call. **No target**; the need is served by **API-271 / API-272** |
| `GET /api/owner/schools/detail` — owner surface | **NO** | dead call. Superseded by **API-236** |

**None of the three is an LRC entry, because none of them is a registered route.** They are caller
defects, and they are fixed in the batch that builds their target.

---


## 10. Legacy route cutover register — LRC-001 … LRC-234

**ROUTE-ONLY. Every entry is an actually registered HTTP handler.**

```
WHAT THIS REGISTER IS      one row per CURRENTLY REGISTERED HTTP HANDLER whose
                           class is LEGACY-BRIDGE or REMOVE

WHAT IT IS NOT             it is NOT authorization migration
                           it is NOT the audit writer
                           it is NOT a database read source
                           it is NOT object storage
                           it is NOT an email provider
   ── those are REAL migration concerns and they are NOT discarded.  They
      move to the CUTOVER BRIDGE REGISTER, §11, as CBR-001 … CBR-015

NO CONCEPTUAL GROUP IS A VALID ROW.
   "role-string-gated handlers, collectively" was a row in the PROPOSED
   draft.  It is 221 handlers wearing one identifier, and it hid the fact
   that the register was not a route register at all.       ── CORRECTED
```

**TXD-013 · The register grew from 9 to 234, and the 9 were never the real number**

The PROPOSED draft carried **LRC-001 … LRC-009**. Four of those nine were not routes. The remaining
five stood in for **234** actual handlers. **The count was not preserved for tidiness; the correct
number is used.**

| Column | Meaning |
|---|---|
| **LRC** | stable identifier once Stage 22 is locked |
| **M · Path · File** | the exact registered method, the exact current path, the file that registers it |
| **C** | **Y** = at least one `client/src/**` call site today · **·** = no client caller found |
| **Target** | the exact **API-nnn**, or **NONE** |
| **S** | **14** = named by Stage 14 §17/§41 · **22** = assigned by Stage 22 |
| **Bld · Sw · Rm** | replacement batch · consumer-switch batch · removal batch |
| **Removal gate** | what must be true before the route is deleted |

**Every row has a removal batch. A row without one is not a row.**

| LRC | M | Path | File | C | Target | Target path | S | Bld | Sw | Rm | Removal gate | Why it coexists / note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **LRC-001** | `DELETE` | `/api/admin/users/:id` | `user.routes.ts` | Y | **API-038** | `/api/school/staff/:staffId/offboard` | **22** | B-13 | B-13 | B-34 | consumers switched + §40 proof | staff deletion becomes OFFBOARD, not row deletion — PA-1 |
| **LRC-002** | `DELETE` | `/api/admin/users/:userId/roles/:role` | `user.routes.ts` | Y | **API-033** | `/api/school/staff/:staffId/roles/:roleId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-003** | `DELETE` | `/api/book-level-items/:id` | `book.routes.ts` | Y | **API-102** | `/api/school/bundles/:bundleId/items` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | join table stops being a resource |
| **LRC-004** | `DELETE` | `/api/book-levels/:id` | `book.routes.ts` | · | **API-101** | `/api/school/bundles/:bundleId` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-005** | `DELETE` | `/api/books/:id` | `book.routes.ts` | · | **API-086** | `/api/school/books/:bookId` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-006** | `DELETE` | `/api/class-book-levels/:id` | `book.routes.ts` | Y | **API-104** | `/api/school/classes/:classId/bundles` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | join table stops being a resource |
| **LRC-007** | `DELETE` | `/api/class-teacher-assignments/:id` | `book.routes.ts` | Y | **API-050** | `/api/school/staffing/:staffingId/revoke` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | becomes an explicit REVOKE, not a row delete |
| **LRC-008** | `DELETE` | `/api/classes/:id` | `book.routes.ts` | · | **API-046** | `/api/school/classes/:classId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-009** | `DELETE` | `/api/families/:id` | `family-enrollment.routes.ts` | · | **API-072** | `/api/school/families/:familyId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-010** | `DELETE` | `/api/guardians/:id` | `family-enrollment.routes.ts` | Y | **API-076** | `/api/school/families/:familyId/guardians/:guardianId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | root guardian resource becomes nested |
| **LRC-011** | `DELETE` | `/api/media/:id` | `website.routes.ts` | Y | **API-221** | `/api/studio/media/:mediaId` | 14 | B-26 | B-26 | B-33 | object copy reconciled, MIG-11 verified | role prefix / namespace move |
| **LRC-012** | `DELETE` | `/api/owner/schools/:id` | `owner.routes.ts` | Y | **API-247** | `/api/platform/schools/:schoolId/request-deletion` | **22** | B-28 | B-28 | B-34 | consumers switched + §40 proof | a school is never row-deleted in the target; the act is request-deletion then purge |
| **LRC-013** | `DELETE` | `/api/students/:id` | `book.routes.ts` | Y | **API-060** | `/api/school/children/:childId/archive` | 14 | B-14 | B-14 | B-34 | consumers switched + §40 proof | becomes ARCHIVE — a child record is never row-deleted |
| **LRC-014** | `DELETE` | `/api/students/:id/book-level-override` | `student.routes.ts` | · | **API-110** | `/api/school/children/:childId/requirement-override` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | no callers |
| **LRC-015** | `DELETE` | `/api/subjects/:id` | `book.routes.ts` | · | **API-054** | `/api/school/subjects/:subjectId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-016** | `DELETE` | `/api/users/:id` | `user.routes.ts` | · | **API-038** | `/api/school/staff/:staffId/offboard` | **22** | B-13 | B-13 | B-34 | §40 dead-code proof — no route, no caller, no link | EXACT ALIAS — same handler object |
| **LRC-017** | `DELETE` | `/api/website/sections/:id` | `website.routes.ts` | Y | **API-205** | `/api/studio/pages/:pageId` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-018** | `GET` | `/api/admin/book-distribution` | `allocation.routes.ts` | · | **API-146** | `/api/school/handovers` | **22** | B-21 | B-21 | B-33 | consumers switched + §40 proof | the admin-side hand-over list; §17 assigns API-146 no legacy |
| **LRC-019** | `GET` | `/api/admin/book-management-summary` | `dashboard.routes.ts` | · | **API-174** | `/api/school/reports/:reportId` | 14 | B-29 | B-29 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-020** | `GET` | `/api/admin/communications` | `notification.routes.ts` | Y | **API-155** | `/api/school/messages` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-021** | `GET` | `/api/admin/communications/:threadId` | `notification.routes.ts` | Y | **API-157** | `/api/school/messages/:threadId` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-022** | `GET` | `/api/admin/dashboard-summary` | `dashboard.routes.ts` | Y | **API-172** | `/api/school/overview` | 14 | B-29 | B-29 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-023** | `GET` | `/api/admin/parents` | `user.routes.ts` | · | **API-068** | `/api/school/families` | **22** | B-15 | B-15 | B-34 | consumers switched + §40 proof | the parent list is a family/guardian read in the target |
| **LRC-024** | `GET` | `/api/admin/payments` | `payment.routes.ts` | Y | **API-118** | `/api/school/settlements` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-025** | `GET` | `/api/admin/payments/:id/verification` | `payment.routes.ts` | · | **API-119** | `/api/school/settlements/:settlementId` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-026** | `GET` | `/api/admin/recent-activity` | `dashboard.routes.ts` | Y | **API-172** | `/api/school/overview` | 14 | B-29 | B-29 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-027** | `GET` | `/api/admin/reports` | `dashboard.routes.ts` | Y | **API-173** | `/api/school/reports` | 14 | B-29 | B-29 | B-34 | consumers switched + §40 proof | financial half → API-129 |
| **LRC-028** | `GET` | `/api/admin/school/settings` | `setup.routes.ts` | Y | **API-018** | `/api/school/settings` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix |
| **LRC-029** | `GET` | `/api/admin/setup-status` | `setup.routes.ts` | Y | **API-025** | `/api/school/setup` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-030** | `GET` | `/api/admin/students/search` | `user.routes.ts` | Y | **API-055** | `/api/school/children` | **22** | B-14 | B-14 | B-34 | consumers switched + §40 proof | search is a QUERY PARAMETER on the collection (§15), not a separate endpoint |
| **LRC-031** | `GET` | `/api/admin/users` | `user.routes.ts` | Y | **API-027** | `/api/school/staff` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-032** | `GET` | `/api/admin/users/:userId` | `user.routes.ts` | Y | **API-028** | `/api/school/staff/:staffId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-033** | `GET` | `/api/allocations` | `allocation.routes.ts` | Y | **API-137** | `/api/school/allocations` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-034** | `GET` | `/api/allocations/:id/custody` | `allocation.routes.ts` | · | **API-138** | `/api/school/allocations/:allocationId` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-035** | `GET` | `/api/auth/me` | `auth.routes.ts` | Y | **API-004** | `/api/auth/session` | 14 | B-06 | B-06 | B-12 | consumers switched + §40 proof | RENAME to /api/auth/session; 9 client call sites |
| **LRC-036** | `GET` | `/api/auth/mfa/status` | `mfa.routes.ts` | Y | **API-011** | `/api/auth/mfa` | 14 | B-09 | B-09 | B-12 | consumers switched + §40 proof | RENAME to GET /api/auth/mfa |
| **LRC-037** | `GET` | `/api/book-copies/lookup/:code` | `book.routes.ts` | · | **API-088** | `/api/school/books/scan/:code` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | merges with books/scan |
| **LRC-038** | `GET` | `/api/book-levels` | `book.routes.ts` | Y | **API-097** | `/api/school/bundles` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | levels → bundles |
| **LRC-039** | `GET` | `/api/book-levels/:id/items` | `book.routes.ts` | Y | **API-099** | `/api/school/bundles/:bundleId` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-040** | `GET` | `/api/books` | `setup.routes.ts` | Y | **API-082** | `/api/school/books` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | registered in setup.routes.ts, not book.routes.ts |
| **LRC-041** | `GET` | `/api/books/:id/copies` | `book.routes.ts` | Y | **API-089** | `/api/school/books/:bookId/copies` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-042** | `GET` | `/api/books/by-isbn/:isbn` | `book.routes.ts` | · | **API-087** | `/api/school/books/lookup` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | ORPHAN — no caller; C-76 |
| **LRC-043** | `GET` | `/api/books/low-stock` | `book.routes.ts` | · | **API-093** | `/api/school/stock` | 14 | B-17 | B-17 | B-34 | consumers switched + §40 proof | partial — becomes the stock read |
| **LRC-044** | `GET` | `/api/books/scan/:code` | `book.routes.ts` | Y | **API-088** | `/api/school/books/scan/:code` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-045** | `GET` | `/api/class-book-levels` | `book.routes.ts` | Y | **API-103** | `/api/school/classes/:classId/bundles` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-046** | `GET` | `/api/classes` | `book.routes.ts` | Y | **API-042** | `/api/school/classes` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-047** | `GET` | `/api/classes/:id/teacher-assignments` | `book.routes.ts` | Y | **API-047** | `/api/school/classes/:classId/staffing` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-048** | `GET` | `/api/cron/run` | `cron.routes.ts` | · | **API-283** | `/api/internal/jobs/trigger` | 14 | B-04 | B-04 | B-05 | PFL-015 end-to-end in staging | **the GET TRANSPORT half.** Vercel cron issues **GET only**, so the GET entry point maps to the transport adapter — **A14-001**. **No GET method is added to API-278** |
| **LRC-049** | `GET` | `/api/extra-requests` | `allocation.routes.ts` | Y | **API-149** | `/api/school/replacements` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-050** | `GET` | `/api/families` | `family-enrollment.routes.ts` | Y | **API-068** | `/api/school/families` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-051** | `GET` | `/api/families/:id` | `family-enrollment.routes.ts` | · | **API-070** | `/api/school/families/:familyId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-052** | `GET` | `/api/families/enroll/import/fields` | `family-enrollment.routes.ts` | Y | **API-165** | `/api/school/imports/enrolment/fields` | 14 | B-22 | B-22 | B-24 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-053** | `GET` | `/api/families/enroll/import/template` | `family-enrollment.routes.ts` | Y | **API-164** | `/api/school/imports/enrolment/template` | 14 | B-22 | B-22 | B-24 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-054** | `GET` | `/api/families/search` | `family-enrollment.routes.ts` | Y | **API-068** | `/api/school/families` | **22** | B-15 | B-15 | B-34 | consumers switched + §40 proof | search is a QUERY PARAMETER on the collection (§15) |
| **LRC-055** | `GET` | `/api/finance/stripe/status` | `payment.routes.ts` | Y | **API-131** | `/api/school/reconciliation/imports` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-056** | `GET` | `/api/finance/summary` | `payment.routes.ts` | Y | **API-117** | `/api/school/money/overview` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | C-50 — finance is a work area, not a role prefix |
| **LRC-057** | `GET` | `/api/health` | `auth.routes.ts` | · | **API-280** | `/api/health/live` | 14 | B-10 | B-10 | B-12 | consumers switched + §40 proof | splits into live/ready/dependencies — C-69 |
| **LRC-058** | `GET` | `/api/inventory-transactions` | `book.routes.ts` | · | **API-094** | `/api/school/stock/movements` | 14 | B-17 | B-17 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-059** | `GET` | `/api/it/website-summary` | `setup.routes.ts` | Y | **API-199** | `/api/studio/site` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-060** | `GET` | `/api/linking-codes` | `student.routes.ts` | Y | **API-067** | `/api/school/link-codes` | 14 | B-11 | B-11 | B-11 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-061** | `GET` | `/api/media` | `website.routes.ts` | Y | **API-218** | `/api/studio/media` | 14 | B-26 | B-26 | B-33 | object copy reconciled, MIG-11 verified | role prefix / namespace move |
| **LRC-062** | `GET` | `/api/notifications/preferences` | `notification.routes.ts` | Y | **API-162** | `/api/school/notification-preferences` | 14 | B-24 | B-24 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-063** | `GET` | `/api/notifications/summary` | `notification.routes.ts` | Y | **API-160** | `/api/school/notifications` | 14 | B-24 | B-24 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-064** | `GET` | `/api/owner/activity` | `owner.routes.ts` | Y | **API-250** | `/api/platform/activity` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-065** | `GET` | `/api/owner/console/audit` | `db-console.routes.ts` | · | **API-250** | `/api/platform/activity` | **22** | B-28 | B-28 | B-34 | consumers switched + §40 proof | the console trail read; in the target it is the platform activity read over DBT-079/DBT-080 |
| **LRC-066** | `GET` | `/api/owner/console/operations` | `db-console.routes.ts` | · | **API-271** | `/api/platform/investigation/subjects` | 14 | B-28 | B-28 | B-34 | SEC-T15 green; console read tier's two bypasses closed | ORPHAN — the hardened tier, F-8 |
| **LRC-067** | `GET` | `/api/owner/dashboard` | `dashboard.routes.ts` | Y | **API-234** | `/api/platform/overview` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-068** | `GET` | `/api/owner/db/tables` | `db-console.routes.ts` | Y | **API-271** | `/api/platform/investigation/subjects` | 14 | B-28 | B-28 | B-34 | SEC-T15 green; console read tier's two bypasses closed | role prefix / namespace move |
| **LRC-069** | `GET` | `/api/owner/db/tables/:table` | `db-console.routes.ts` | Y | **API-272** | `/api/platform/investigation/subjects/:subject` | 14 | B-28 | B-28 | B-34 | SEC-T15 green; console read tier's two bypasses closed | role prefix / namespace move |
| **LRC-070** | `GET` | `/api/owner/email-status` | `owner.routes.ts` | Y | **API-251** | `/api/platform/deliveries` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-071** | `GET` | `/api/owner/pending-setups` | `owner.routes.ts` | Y | **API-240** | `/api/platform/schools/pending-setups` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-072** | `GET` | `/api/owner/schools` | `owner.routes.ts` | Y | **API-235** | `/api/platform/schools` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-073** | `GET` | `/api/owner/schools/:schoolId` | `owner.routes.ts` | Y | **API-236** | `/api/platform/schools/:schoolId` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-074** | `GET` | `/api/owner/schools/:schoolId/branding` | `setup.routes.ts` | · | **API-269** | `/api/platform/support/:engagementId/identity` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-075** | `GET` | `/api/owner/support-status` | `owner.routes.ts` | · | **API-257** | `/api/platform/support/engagements/active` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-076** | `GET` | `/api/owner/support/communications/:threadId` | `notification.routes.ts` | · | **API-267** | `/api/platform/support/:engagementId/messages/:threadId` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-077** | `GET` | `/api/owner/support/schools/:schoolId/communications` | `notification.routes.ts` | · | **API-266** | `/api/platform/support/:engagementId/deliveries` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-078** | `GET` | `/api/owner/system-health` | `owner.routes.ts` | Y | **API-255** | `/api/platform/system-health` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | also feeds API-282 |
| **LRC-079** | `GET` | `/api/parent/baskets` | `parent.routes.ts` | Y | **API-183** | `/api/family/settlements` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-080** | `GET` | `/api/parent/children` | `parent.routes.ts` | Y | **API-177** | `/api/family/children` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-081** | `GET` | `/api/parent/children/:id/books` | `parent.routes.ts` | · | **API-180** | `/api/family/children/:childId/books` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-082** | `GET` | `/api/parent/message-contacts` | `message.routes.ts` | Y | **API-192** | `/api/family/message-contacts` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-083** | `GET` | `/api/parent/message-threads` | `message.routes.ts` | Y | **API-188** | `/api/family/messages` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-084** | `GET` | `/api/parent/message-threads/:id` | `message.routes.ts` | · | **API-190** | `/api/family/messages/:threadId` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-085** | `GET` | `/api/parent/message-unread` | `message.routes.ts` | · | **API-193** | `/api/family/notifications` | 14 | B-24 | B-24 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-086** | `GET` | `/api/parent/payments` | `parent.routes.ts` | Y | **API-183** | `/api/family/settlements` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-087** | `GET` | `/api/public/schools/:code` | `public.routes.ts` | · | **API-231** | `/api/site/:schoolCode` | 14 | B-27 | B-27 | B-34 | PublishedSite parity on a live school | four public reads collapse into ONE `/api/site/:schoolCode` PublishedSite — AQ-1 = B; the PATH CHANGES |
| **LRC-088** | `GET` | `/api/public/schools/:code/branding` | `setup.routes.ts` | Y | **API-231** | `/api/site/:schoolCode` | 14 | B-27 | B-27 | B-34 | PublishedSite parity on a live school | collapses into API-231 |
| **LRC-089** | `GET` | `/api/public/schools/:code/email-logo` | `setup.routes.ts` | · | **API-231** | `/api/site/:schoolCode` | 14 | B-27 | B-27 | B-34 | PublishedSite parity on a live school | collapses into API-231 |
| **LRC-090** | `GET` | `/api/public/schools/:code/website` | `public.routes.ts` | · | **API-231** | `/api/site/:schoolCode` | 14 | B-27 | B-27 | B-34 | PublishedSite parity on a live school | collapses into API-231 |
| **LRC-091** | `GET` | `/api/school/branding` | `setup.routes.ts` | Y | **API-020** | `/api/school/identity` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | becomes /api/school/identity — MOD-001 half only |
| **LRC-092** | `GET` | `/api/school/payment-info` | `setup.routes.ts` | · | **API-018** | `/api/school/settings` | **22** | B-13 | B-13 | B-34 | consumers switched + §40 proof | school payment settings are a settings read; no separate §17 contract |
| **LRC-093** | `GET` | `/api/students` | `book.routes.ts` | Y | **API-055** | `/api/school/children` | 14 | B-14 | B-14 | B-34 | consumers switched + §40 proof | vocabulary change: students → children (UXQ-2) |
| **LRC-094** | `GET` | `/api/students/:id/book-level-override` | `student.routes.ts` | · | **API-106** | `/api/school/children/:childId/requirements` | **22** | B-18 | B-18 | B-34 | consumers switched + §40 proof | the per-child read of the same fact; §41 lists the family, no callers |
| **LRC-095** | `GET` | `/api/students/:id/profile` | `family-enrollment.routes.ts` | Y | **API-057** | `/api/school/children/:childId` | 14 | B-14 | B-14 | B-34 | consumers switched + §40 proof | also feeds API-059 |
| **LRC-096** | `GET` | `/api/students/book-level-overrides` | `student.routes.ts` | Y | **API-106** | `/api/school/children/:childId/requirements` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-097** | `GET` | `/api/subjects` | `book.routes.ts` | Y | **API-051** | `/api/school/subjects` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-098** | `GET` | `/api/teacher/book-distribution` | `allocation.routes.ts` | Y | **API-141** | `/api/school/handovers/queue` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-099** | `GET` | `/api/teacher/message-threads` | `message.routes.ts` | Y | **API-155** | `/api/school/messages` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-100** | `GET` | `/api/teacher/message-threads/:id` | `message.routes.ts` | Y | **API-157** | `/api/school/messages/:threadId` | **22** | B-23 | B-23 | B-34 | consumers switched + §40 proof | the teacher-side single-thread read; same target contract as the admin read |
| **LRC-101** | `GET` | `/api/teacher/message-unread` | `message.routes.ts` | · | **API-160** | `/api/school/notifications` | **22** | B-24 | B-24 | B-34 | consumers switched + §40 proof | the school-side unread count; mirrors API-193 on the family side |
| **LRC-102** | `GET` | `/api/users` | `user.routes.ts` | Y | **API-027** | `/api/school/staff` | **22** | B-13 | B-13 | B-34 | §40 dead-code proof — no route, no caller, no link | EXACT ALIAS of /api/admin/users — same handler object |
| **LRC-103** | `GET` | `/api/website/sections` | `website.routes.ts` | Y | **API-201** | `/api/studio/pages` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-104** | `PATCH` | `/api/admin/communications/:threadId/status` | `notification.routes.ts` | Y | **API-159** | `/api/school/messages/:threadId/status` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-105** | `PATCH` | `/api/admin/school/settings` | `setup.routes.ts` | Y | **API-019** | `/api/school/settings` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix |
| **LRC-106** | `PATCH` | `/api/admin/users/:id` | `user.routes.ts` | Y | **API-029** | `/api/school/staff/:staffId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-107** | `PATCH` | `/api/book-copies/:id` | `book.routes.ts` | Y | **API-091** | `/api/school/copies/:copyId` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-108** | `PATCH` | `/api/book-levels/:id` | `book.routes.ts` | · | **API-100** | `/api/school/bundles/:bundleId` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-109** | `PATCH` | `/api/books/:id` | `book.routes.ts` | · | **API-085** | `/api/school/books/:bookId` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-110** | `PATCH` | `/api/class-teacher-assignments/:id` | `book.routes.ts` | Y | **API-049** | `/api/school/staffing/:staffingId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-111** | `PATCH` | `/api/classes/:id` | `book.routes.ts` | · | **API-045** | `/api/school/classes/:classId` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-112** | `PATCH` | `/api/families/:id` | `family-enrollment.routes.ts` | · | **API-071** | `/api/school/families/:familyId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-113** | `PATCH` | `/api/guardians/:id` | `family-enrollment.routes.ts` | Y | **API-075** | `/api/school/families/:familyId/guardians/:guardianId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | root guardian resource becomes nested |
| **LRC-114** | `PATCH` | `/api/media/:id` | `website.routes.ts` | Y | **API-220** | `/api/studio/media/:mediaId` | 14 | B-26 | B-26 | B-33 | object copy reconciled, MIG-11 verified | role prefix / namespace move |
| **LRC-115** | `PATCH` | `/api/notifications/preferences` | `notification.routes.ts` | Y | **API-163** | `/api/school/notification-preferences` | 14 | B-24 | B-24 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-116** | `PATCH` | `/api/owner/schools/:id` | `owner.routes.ts` | Y | **API-238** | `/api/platform/schools/:schoolId` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-117** | `PATCH` | `/api/owner/schools/:schoolId/branding` | `setup.routes.ts` | · | **API-270** | `/api/platform/support/:engagementId/identity` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-118** | `PATCH` | `/api/school/branding` | `setup.routes.ts` | Y | **API-021** | `/api/school/identity` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | becomes /api/school/identity |
| **LRC-119** | `PATCH` | `/api/students/:id` | `book.routes.ts` | Y | **API-058** | `/api/school/children/:childId` | 14 | B-14 | B-14 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-120** | `PATCH` | `/api/users/:id` | `user.routes.ts` | · | **API-029** | `/api/school/staff/:staffId` | **22** | B-13 | B-13 | B-34 | §40 dead-code proof — no route, no caller, no link | EXACT ALIAS — same handler object |
| **LRC-121** | `PATCH` | `/api/website/sections/:id` | `website.routes.ts` | Y | **API-204** | `/api/studio/pages/:pageId` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-122** | `POST` | `/api/admin/book-distribution/:id/confirm` | `allocation.routes.ts` | · | **API-144** | `/api/school/collections` | 14 | B-20 | B-20 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-123** | `POST` | `/api/admin/payments/:id/cancel` | `payment.routes.ts` | Y | **API-128** | `/api/school/settlements/:settlementId/refund` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | becomes an explicit REFUND act |
| **LRC-124** | `POST` | `/api/admin/payments/:id/collected` | `payment.routes.ts` | Y | **API-144** | `/api/school/collections` | 14 | B-20 | B-20 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-125** | `POST` | `/api/admin/payments/:id/confirm` | `payment.routes.ts` | Y | **API-120** | `/api/school/settlements/:settlementId/confirm` | 14 | B-20 | B-20 | B-33 | I-2 atomicity + concurrency green | **I-2** — three legacy routes become ONE command |
| **LRC-126** | `POST` | `/api/admin/payments/:id/manual-reject` | `payment.routes.ts` | Y | **API-121** | `/api/school/settlements/:settlementId/reject` | 14 | B-20 | B-20 | B-33 | I-2 atomicity + concurrency green | collapses into API-121 |
| **LRC-127** | `POST` | `/api/admin/payments/:id/manual-verify` | `payment.routes.ts` | Y | **API-120** | `/api/school/settlements/:settlementId/confirm` | 14 | B-20 | B-20 | B-33 | I-2 atomicity + concurrency green | **I-2** — collapses into API-120 |
| **LRC-128** | `POST` | `/api/admin/payments/:id/needs-review` | `payment.routes.ts` | Y | **API-134** | `/api/school/reconciliation/:settlementId/match` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-129** | `POST` | `/api/admin/payments/:id/order-status` | `allocation.routes.ts` | · | **NONE** | — *no target* | 14 | B-20 | B-20 | B-33 | §40 dead-code proof — no route, no caller, no link | **generic status setter — APID-011 forbids it.** Its legitimate uses are named acts (API-144 · API-147) |
| **LRC-130** | `POST` | `/api/admin/payments/:id/ready-for-collection` | `payment.routes.ts` | Y | **API-147** | `/api/school/settlements/:settlementId/ready-for-collection` | 14 | B-20 | B-20 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-131** | `POST` | `/api/admin/payments/:id/reject` | `payment.routes.ts` | Y | **API-121** | `/api/school/settlements/:settlementId/reject` | 14 | B-20 | B-20 | B-33 | I-2 atomicity + concurrency green | role prefix / namespace move |
| **LRC-132** | `POST` | `/api/admin/payments/:id/verify` | `payment.routes.ts` | Y | **API-120** | `/api/school/settlements/:settlementId/confirm` | 14 | B-20 | B-20 | B-33 | I-2 atomicity + concurrency green | **I-2** — collapses into API-120 |
| **LRC-133** | `POST` | `/api/admin/setup-complete` | `setup.routes.ts` | Y | **API-026** | `/api/school/setup/complete` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-134** | `POST` | `/api/admin/setup/branding-skip` | `setup.routes.ts` | Y | **API-025** | `/api/school/setup` | **22** | B-13 | B-13 | B-34 | consumers switched + §40 proof | a setup-checklist state write; §17 names no separate contract — absorbed by the setup state + API-021 |
| **LRC-135** | `POST` | `/api/admin/users/:userId/link-child` | `user.routes.ts` | Y | **API-074** | `/api/school/families/:familyId/guardians` | **22** | B-15 | B-15 | B-34 | consumers switched + §40 proof | creating a guardian relationship is MOD-004; §17 gives no /users/:id/link-child contract |
| **LRC-136** | `POST` | `/api/admin/users/:userId/offboard-staff` | `user.routes.ts` | Y | **API-038** | `/api/school/staff/:staffId/offboard` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-137** | `POST` | `/api/admin/users/:userId/reactivate` | `user.routes.ts` | Y | **API-037** | `/api/school/staff/:staffId/reactivate` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-138** | `POST` | `/api/admin/users/:userId/roles/parent` | `user.routes.ts` | Y | **API-032** | `/api/school/staff/:staffId/roles` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-139** | `POST` | `/api/admin/users/:userId/roles/teacher` | `user.routes.ts` | Y | **API-032** | `/api/school/staff/:staffId/roles` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-140** | `POST` | `/api/admin/users/:userId/suspend` | `user.routes.ts` | Y | **API-036** | `/api/school/staff/:staffId/suspend` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-141** | `POST` | `/api/allocations` | `allocation.routes.ts` | Y | **API-139** | `/api/school/allocations/:allocationId/prepare` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | becomes an explicit PREPARE act |
| **LRC-142** | `POST` | `/api/allocations/:id/absent` | `allocation.routes.ts` | · | **API-145** | `/api/school/allocations/:allocationId/exception` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-143** | `POST` | `/api/allocations/:id/confirm` | `allocation.routes.ts` | Y | **API-143** | `/api/school/handovers` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-144** | `POST` | `/api/allocations/:id/custody` | `allocation.routes.ts` | · | **API-140** | `/api/school/allocations/:allocationId/transfer-to-teacher` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-145** | `POST` | `/api/auth/accept-invite` | `auth.routes.ts` | · | **API-009** | `/api/invites/:token/accept` | 14 | B-06 | B-06 | B-12 | §40 dead-code proof — no route, no caller, no link | DUPLICATE, F-1 — no callers |
| **LRC-146** | `POST` | `/api/auth/forgot-password` | `auth.routes.ts` | Y | **API-006** | `/api/auth/password-reset` | 14 | B-06 | B-06 | B-12 | consumers switched + §40 proof | RENAME to /api/auth/password-reset |
| **LRC-147** | `POST` | `/api/auth/login` | `auth.routes.ts` | · | **API-001** | `/api/auth/sign-in` | 14 | B-06 | B-06 | B-12 | §40 dead-code proof — no route, no caller, no link | DUPLICATE of sign-in, F-1 — no callers |
| **LRC-148** | `POST` | `/api/auth/logout` | `auth.routes.ts` | · | **API-003** | `/api/auth/sign-out` | 14 | B-06 | B-06 | B-12 | §40 dead-code proof — no route, no caller, no link | DUPLICATE, F-1 — no callers |
| **LRC-149** | `POST` | `/api/auth/mfa/disable` | `mfa.routes.ts` | Y | **API-015** | `/api/auth/mfa` | 14 | B-09 | B-09 | B-12 | consumers switched + §40 proof | becomes DELETE /api/auth/mfa — method change |
| **LRC-150** | `POST` | `/api/auth/mfa/enable` | `mfa.routes.ts` | Y | **API-013** | `/api/auth/mfa/verify` | 14 | B-09 | B-09 | B-12 | consumers switched + §40 proof | **PATH COLLISION** — enrolment confirm; target path is /api/auth/mfa/verify, occupied today by the challenge |
| **LRC-151** | `POST` | `/api/auth/mfa/verify` | `mfa.routes.ts` | Y | **API-002** | `/api/auth/sign-in/mfa` | 14 | B-06 | B-06 | B-12 | consumers switched + §40 proof | **PATH COLLISION** — this is the LOGIN CHALLENGE, target /api/auth/sign-in/mfa. The path it occupies is claimed by API-013 |
| **LRC-152** | `POST` | `/api/auth/reset-password` | `auth.routes.ts` | Y | **API-007** | `/api/auth/password-reset/complete` | 14 | B-06 | B-06 | B-12 | consumers switched + §40 proof | RENAME to /api/auth/password-reset/complete |
| **LRC-153** | `POST` | `/api/book-copies/verify` | `book.routes.ts` | Y | **API-092** | `/api/school/copies/verify` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-154** | `POST` | `/api/book-levels` | `book.routes.ts` | Y | **API-098** | `/api/school/bundles` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-155** | `POST` | `/api/book-levels/:id/items` | `book.routes.ts` | Y | **API-102** | `/api/school/bundles/:bundleId/items` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | item list becomes a PUT of the whole set |
| **LRC-156** | `POST` | `/api/books` | `book.routes.ts` | Y | **API-083** | `/api/school/books` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-157** | `POST` | `/api/books/:id/copies` | `book.routes.ts` | Y | **API-090** | `/api/school/books/:bookId/copies` | 14 | B-16 | B-16 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-158** | `POST` | `/api/books/:id/stock` | `book.routes.ts` | · | **API-095** | `/api/school/stock/intake` | 14 | B-17 | B-17 | B-34 | consumers switched + §40 proof | becomes an explicit INTAKE act |
| **LRC-159** | `POST` | `/api/class-book-levels` | `book.routes.ts` | Y | **API-104** | `/api/school/classes/:classId/bundles` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-160** | `POST` | `/api/classes` | `book.routes.ts` | Y | **API-043** | `/api/school/classes` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-161** | `POST` | `/api/classes/:id/teacher-assignments` | `book.routes.ts` | Y | **API-048** | `/api/school/classes/:classId/staffing` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-162** | `POST` | `/api/cron/run` | `cron.routes.ts` | · | **API-278** | `/api/internal/jobs/run` | 14 | B-04 | B-04 | B-05 | PFL-015 end-to-end in staging | **the RUNNER half.** Measured: `app.get` and `app.post` are registered to **ONE shared handler** (`cron.routes.ts:299–300`), so today's route is transport **and** runner fused. Its POST shape already matches the target runner's method — **A22-001 §8** |
| **LRC-163** | `POST` | `/api/extra-requests` | `allocation.routes.ts` | Y | **API-148** | `/api/school/replacements` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-164** | `POST` | `/api/extra-requests/:id/approve` | `allocation.routes.ts` | Y | **API-152** | `/api/school/replacements/:replacementId/review` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-165** | `POST` | `/api/extra-requests/:id/reject` | `allocation.routes.ts` | Y | **API-152** | `/api/school/replacements/:replacementId/review` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-166** | `POST` | `/api/families` | `family-enrollment.routes.ts` | Y | **API-069** | `/api/school/families` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-167** | `POST` | `/api/families/:id/enroll` | `family-enrollment.routes.ts` | · | **API-079** | `/api/school/families/:familyId/enrol` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-168** | `POST` | `/api/families/:id/guardians` | `family-enrollment.routes.ts` | Y | **API-074** | `/api/school/families/:familyId/guardians` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-169** | `POST` | `/api/families/:id/save-draft` | `family-enrollment.routes.ts` | · | **API-081** | `/api/school/families/drafts/:draftId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | becomes PUT on a draft resource |
| **LRC-170** | `POST` | `/api/families/:id/students` | `family-enrollment.routes.ts` | Y | **API-056** | `/api/school/children` | **22** | B-14 | B-14 | B-34 | consumers switched + §40 proof | adding a child to a family; membership follows via API-063 |
| **LRC-171** | `POST` | `/api/families/enroll` | `family-enrollment.routes.ts` | Y | **API-079** | `/api/school/families/:familyId/enrol` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-172** | `POST` | `/api/families/enroll/import/analyze` | `family-enrollment.routes.ts` | Y | **API-166** | `/api/school/imports/enrolment` | 14 | B-22 | B-22 | B-24 | the surviving import proved on both modes | **analyse → API-166**; the preview is then read at **API-169** |
| **LRC-173** | `POST` | `/api/families/enroll/import/commit` | `family-enrollment.routes.ts` | Y | **API-170** | `/api/school/imports/enrolment/:importId/commit` | 14 | B-22 | B-22 | B-24 | the surviving import proved on both modes | **commit → API-170**; the result is read at **API-171** |
| **LRC-174** | `POST` | `/api/families/invitations/send-pending` | `family-enrollment.routes.ts` | · | **API-078** | `/api/school/families/invitations/send-pending` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-175** | `POST` | `/api/families/save-draft` | `family-enrollment.routes.ts` | Y | **API-081** | `/api/school/families/drafts/:draftId` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | becomes PUT on a draft resource |
| **LRC-176** | `POST` | `/api/finance/stripe/import` | `payment.routes.ts` | Y | **API-130** | `/api/school/reconciliation/imports` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-177** | `POST` | `/api/finance/verification/run` | `payment.routes.ts` | Y | **API-133** | `/api/school/reconciliation/candidates` | 14 | B-19 | B-19 | B-33 | consumers switched + §40 proof | becomes a READ of candidates, not a run trigger |
| **LRC-178** | `POST` | `/api/guardians/:id/invite` | `family-enrollment.routes.ts` | Y | **API-077** | `/api/school/families/:familyId/guardians/:guardianId/invite` | 14 | B-15 | B-15 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-179** | `POST` | `/api/invites` | `user.routes.ts` | Y | **API-030** | `/api/school/staff/invites` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-180** | `POST` | `/api/media` | `website.routes.ts` | Y | **API-222** | `/api/studio/media/uploads` | 14 | B-26 | B-26 | B-33 | object copy reconciled, MIG-11 verified | fused upload splits into API-222 + API-223; **base64 leaves the database — MIG-11** |
| **LRC-181** | `POST` | `/api/owner/console/elevate` | `db-console.routes.ts` | · | **API-273** | `/api/platform/break-glass/elevate` | 14 | B-28 | B-28 | B-34 | break-glass elevation audited; AET-030 recorded | ORPHAN — F-8 |
| **LRC-182** | `POST` | `/api/owner/console/elevate/end` | `db-console.routes.ts` | · | **API-274** | `/api/platform/break-glass/end` | 14 | B-28 | B-28 | B-34 | break-glass elevation audited; AET-030 recorded | ORPHAN — F-8 |
| **LRC-183** | `POST` | `/api/owner/console/op/:name` | `db-console.routes.ts` | · | **API-275** | `/api/platform/break-glass/operations/:operationId` | 14 | B-28 | B-28 | B-34 | break-glass elevation audited; AET-030 recorded | ORPHAN — F-8 |
| **LRC-184** | `POST` | `/api/owner/console/write` | `db-console.routes.ts` | · | **API-275** | `/api/platform/break-glass/operations/:operationId` | 14 | B-28 | B-28 | B-34 | break-glass elevation audited; AET-030 recorded | ORPHAN — F-8 |
| **LRC-185** | `POST` | `/api/owner/db/danger/purge-school/:schoolId` | `db-console.routes.ts` | · | **API-277** | `/api/platform/break-glass/schools/:schoolId/purge` | 14 | B-28 | B-28 | B-34 | break-glass elevation audited; AET-030 recorded | irreversible purge — CAP-092 |
| **LRC-186** | `POST` | `/api/owner/db/danger/wipe-school/:schoolId` | `db-console.routes.ts` | Y | **API-247** | `/api/platform/schools/:schoolId/request-deletion` | **22** | B-28 | B-28 | B-34 | consumers switched + §40 proof | **C-107** — measured behaviour is a REVERSIBLE soft-delete, i.e. request-deletion. §41 maps it to API-276 erase-account and §17 maps it to API-277 purge; both disagree with the code |
| **LRC-187** | `POST` | `/api/owner/db/query` | `db-console.routes.ts` | Y | **NONE** | — *no target* | 14 | B-28 | B-28 | B-28 | §40 dead-code proof — no route, no caller, no link | **ARBITRARY SQL IS NOT IN THE TARGET** (Stage 12 §26). The legitimate need is served by API-271/API-272 — that is a replacement of the NEED, not of the endpoint |
| **LRC-188** | `POST` | `/api/owner/enter-support/:schoolId` | `owner.routes.ts` | · | **API-256** | `/api/platform/support/engagements` | 14 | B-28 | B-28 | B-34 | §40 dead-code proof — no route, no caller, no link | DUPLICATE, F-7 — no callers |
| **LRC-189** | `POST` | `/api/owner/exit-support` | `owner.routes.ts` | · | **API-259** | `/api/platform/support/engagements/:engagementId/exit` | 14 | B-28 | B-28 | B-34 | §40 dead-code proof — no route, no caller, no link | DUPLICATE, F-7 — no callers |
| **LRC-190** | `POST` | `/api/owner/invites/:inviteId/resend` | `owner.routes.ts` | Y | **API-242** | `/api/platform/invites/:inviteId/resend` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-191** | `POST` | `/api/owner/invites/:inviteId/revoke` | `owner.routes.ts` | Y | **API-243** | `/api/platform/invites/:inviteId/revoke` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-192** | `POST` | `/api/owner/schools` | `owner.routes.ts` | Y | **API-237** | `/api/platform/schools` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-193** | `POST` | `/api/owner/schools/:id/archive` | `owner.routes.ts` | Y | **API-245** | `/api/platform/schools/:schoolId/archive` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-194** | `POST` | `/api/owner/schools/:id/request-deletion` | `owner.routes.ts` | Y | **API-247** | `/api/platform/schools/:schoolId/request-deletion` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-195** | `POST` | `/api/owner/schools/:id/restore` | `owner.routes.ts` | Y | **API-246** | `/api/platform/schools/:schoolId/restore` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-196** | `POST` | `/api/owner/schools/:id/suspend` | `owner.routes.ts` | Y | **API-244** | `/api/platform/schools/:schoolId/suspend` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-197** | `POST` | `/api/owner/schools/:schoolId/branding/logo` | `setup.routes.ts` | · | **API-270** | `/api/platform/support/:engagementId/identity` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-198** | `POST` | `/api/owner/schools/:schoolId/branding/reset` | `setup.routes.ts` | · | **API-270** | `/api/platform/support/:engagementId/identity` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-199** | `POST` | `/api/owner/schools/:schoolId/invite-admin` | `owner.routes.ts` | Y | **API-239** | `/api/platform/schools/:schoolId/invite-admin` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-200** | `POST` | `/api/owner/support-mode/enter` | `owner.routes.ts` | Y | **API-256** | `/api/platform/support/engagements` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-201** | `POST` | `/api/owner/support-mode/exit` | `owner.routes.ts` | Y | **API-259** | `/api/platform/support/engagements/:engagementId/exit` | 14 | B-28 | B-28 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-202** | `POST` | `/api/parent/children/:id/basket` | `parent.routes.ts` | Y | **API-182** | `/api/family/children/:childId/selection` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | becomes a PUT of the selection |
| **LRC-203** | `POST` | `/api/parent/link-child` | `parent.routes.ts` | Y | **API-198** | `/api/family/link-code/confirm` | 14 | B-11 | B-11 | B-11 | two-step path only; link TTL expired | **the one-step legacy path — C-25 closes only when this is gone** |
| **LRC-204** | `POST` | `/api/parent/link-code/confirm` | `parent.routes.ts` | Y | **API-198** | `/api/family/link-code/confirm` | 14 | B-11 | B-11 | B-11 | two-step path only; link TTL expired | **LINKING CODE — C-25** |
| **LRC-205** | `POST` | `/api/parent/link-code/preview` | `parent.routes.ts` | Y | **API-197** | `/api/family/link-code/preview` | 14 | B-11 | B-11 | B-11 | two-step path only; link TTL expired | **LINKING CODE — not an invite token** |
| **LRC-206** | `POST` | `/api/parent/message-threads` | `message.routes.ts` | Y | **API-189** | `/api/family/messages` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-207** | `POST` | `/api/parent/message-threads/:id/messages` | `message.routes.ts` | Y | **API-191** | `/api/family/messages/:threadId/messages` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-208** | `POST` | `/api/parent/payments` | `parent.routes.ts` | Y | **API-184** | `/api/family/settlements` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-209** | `POST` | `/api/parent/payments/:id/submit-reference` | `parent.routes.ts` | Y | **API-186** | `/api/family/settlements/:settlementId/reference` | 14 | B-25 | B-25 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-210** | `POST` | `/api/public/contact` | `public.routes.ts` | Y | **API-233** | `/api/site/contact` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-211** | `POST` | `/api/school/branding/banner` | `setup.routes.ts` | Y | **API-022** | `/api/school/identity/assets/uploads` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | collapses into API-022 + API-023 |
| **LRC-212** | `POST` | `/api/school/branding/email-logo` | `setup.routes.ts` | Y | **API-022** | `/api/school/identity/assets/uploads` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | collapses into API-022 + API-023 |
| **LRC-213** | `POST` | `/api/school/branding/favicon` | `setup.routes.ts` | Y | **API-022** | `/api/school/identity/assets/uploads` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | collapses into API-022 + API-023 |
| **LRC-214** | `POST` | `/api/school/branding/logo` | `setup.routes.ts` | Y | **API-022** | `/api/school/identity/assets/uploads` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | five upload endpoints collapse into one two-step upload |
| **LRC-215** | `POST` | `/api/school/branding/pdf-logo` | `setup.routes.ts` | Y | **API-022** | `/api/school/identity/assets/uploads` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | collapses into API-022 + API-023 |
| **LRC-216** | `POST` | `/api/school/branding/reset` | `setup.routes.ts` | Y | **API-024** | `/api/school/identity/assets/reset` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-217** | `POST` | `/api/seed-users` | `index.ts` | · | **NONE** | — *no target* | 14 | — | — | B-10 | §40 dead-code proof — no route, no caller, no link | **a development seeder inside the production route tree — F-9.** Guarded by NODE_ENV today; that is not the control the target relies on |
| **LRC-218** | `POST` | `/api/students` | `book.routes.ts` | Y | **API-056** | `/api/school/children` | 14 | B-14 | B-14 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-219** | `POST` | `/api/students/:id/linking-code` | `student.routes.ts` | Y | **API-065** | `/api/school/children/:childId/link-codes` | 14 | B-11 | B-11 | B-11 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-220** | `POST` | `/api/students/:id/linking-code/rotate` | `student.routes.ts` | Y | **API-066** | `/api/school/children/:childId/link-codes/rotate` | 14 | B-11 | B-11 | B-11 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-221** | `POST` | `/api/students/:id/unarchive` | `book.routes.ts` | Y | **API-061** | `/api/school/children/:childId/unarchive` | 14 | B-14 | B-14 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-222** | `POST` | `/api/students/import/confirm` | `student.routes.ts` | Y | **API-170** | `/api/school/imports/enrolment/:importId/commit` | 14 | B-22 | B-22 | B-24 | the surviving import proved on both modes | **confirm → API-170.** The DUPLICATE pipeline |
| **LRC-223** | `POST` | `/api/students/import/preview` | `student.routes.ts` | Y | **API-166** | `/api/school/imports/enrolment` | 14 | B-22 | B-22 | B-24 | the surviving import proved on both modes | **preview → API-166 then API-169.** The DUPLICATE pipeline — §12 selects the survivor |
| **LRC-224** | `POST` | `/api/subjects` | `book.routes.ts` | Y | **API-052** | `/api/school/subjects` | 14 | B-13 | B-13 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-225** | `POST` | `/api/teacher/book-distribution/:id/confirm-received` | `allocation.routes.ts` | Y | **API-143** | `/api/school/handovers` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-226** | `POST` | `/api/teacher/book-distribution/:id/mark-absent` | `allocation.routes.ts` | Y | **API-145** | `/api/school/allocations/:allocationId/exception` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-227** | `POST` | `/api/teacher/book-distribution/:id/mark-out-of-stock` | `allocation.routes.ts` | Y | **API-145** | `/api/school/allocations/:allocationId/exception` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-228** | `POST` | `/api/teacher/book-distribution/:id/report-issue` | `allocation.routes.ts` | Y | **API-148** | `/api/school/replacements` | 14 | B-21 | B-21 | B-33 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-229** | `POST` | `/api/teacher/message-threads/:id/messages` | `message.routes.ts` | Y | **API-158** | `/api/school/messages/:threadId/messages` | 14 | B-23 | B-23 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-230** | `POST` | `/api/users` | `user.routes.ts` | Y | **API-030** | `/api/school/staff/invites` | **22** | B-13 | B-13 | B-34 | §40 dead-code proof — no route, no caller, no link | direct staff creation with a plaintext password is replaced by INVITATION — API-030 |
| **LRC-231** | `POST` | `/api/webhooks/payment-update` | `message.routes.ts` | · | **API-279** | `/api/integrations/v1/:integrationId/events` | 14 | B-24 | B-24 | B-34 | callback is signal-only; replay rejected | **signal only — never business confirmation** |
| **LRC-232** | `POST` | `/api/website/sections` | `website.routes.ts` | Y | **API-202** | `/api/studio/pages` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-233** | `POST` | `/api/website/sections/:id/move` | `website.routes.ts` | Y | **API-207** | `/api/studio/pages/:pageId/move` | 14 | B-27 | B-27 | B-34 | consumers switched + §40 proof | role prefix / namespace move |
| **LRC-234** | `PUT` | `/api/students/:id/book-level-override` | `student.routes.ts` | · | **API-109** | `/api/school/children/:childId/requirement-override` | 14 | B-18 | B-18 | B-34 | consumers switched + §40 proof | no callers |

**TXD-014 · What the register proves, mechanically**

```
ROWS                        234
   LEGACY-BRIDGE            222
   REMOVE (no target)       12

ROWS WITHOUT A REMOVAL BATCH     0
ROWS WITHOUT A TARGET OR AN
   EXPLICIT "NONE"               0
ROWS THAT ARE NOT ROUTES         0

AT FINAL CUTOVER   LRC = EMPTY
   ── no locked compatibility requirement currently survives the cutover,
      and none may be invented to keep a route alive

CI COUNTS THE REGISTER.  A bridge that outlives its removal batch is a
BUILD FAILURE, not a backlog item.                       Stage 20 TST-D080
```

**TXD-015 · Removal is per route, never "remove all legacy APIs"**

```
THE REMOVAL BATCHES ARE SPREAD ACROSS 11 DIFFERENT BATCHES.
   B-05 (2) · B-10 (1) · B-11 (6) · B-12 (11) · B-24 (6) · B-28 (1)
   B-33 (37) · B-34 (170)
   ── plus each row's own §40 proof, which is a SEARCH, not a checkbox

THERE IS NO TASK IN THIS PLAN CALLED "DELETE THE LEGACY ROUTES."
   B-34 is where the register is PROVED EMPTY.  It is not where 234
   routes are deleted in one review.
```

---


### 10.3 A14-002 — a locked internal typo, corrected traceably

**Stage 14 §30's prose says "the commit (API-171)". Its own authoritative endpoint table says
API-170, and the table is correct.**

```
API-170   POST /api/school/imports/enrolment/:importId/commit    ── THE COMMIT
API-171   GET  /api/school/imports/enrolment/:importId/result    ── THE RESULT

THE CATALOGUE IS CORRECT AND IS NOT ALTERED.
THE PROSE CROSS-REFERENCE IS WRONG AND IS CORRECTED.
```

**Amendment identifier.** The Stage 14 amendment register was read before writing. **A14-001 was the
latest amendment**, so this becomes **A14-002**.

| A14-002 | |
|---|---|
| **Class** | **TYPO / CROSS-REFERENCE CORRECTION ONLY** |
| **Change** | in §30's prose, `"the commit (API-171)"` → `"the commit (API-170)"` |
| **Method changes** | **none** |
| **Route changes** | **none** |
| **Capability changes** | **none** — the CAP-028-where-families-are-created rule attaches to the same act, now correctly identified |
| **Scope changes** | **none** |
| **Response changes** | **none** |
| **New endpoints** | **none** |
| **Catalogue changes** | **none. The endpoint catalogue was already right** |

**This is not a conflict.** A conflict is a disagreement about what the target should be. **Stage 14
never disagreed with itself about the target — it mistyped an identifier while describing it.**

### 10.4 C-107 — a locked cross-reference that disagrees with itself AND with the code

**This one IS a conflict, and it is issued as a new identifier only after checking the complete
register: the highest identifier in use across all locked stages is C-106, and C-107 appears nowhere
except as "the next stage starts at C-107". C-107 is free.**

| **C-107** | `POST /api/owner/db/danger/wipe-school/:schoolId` has three incompatible target mappings |
|---|---|
| **Stage 14 §41 says** | `wipe-school` → **API-276** `erase-account` — break-glass, CAP-036 |
| **Stage 14 §17 says** | **API-277**'s legacy column reads `owner/db/danger/purge-school/:id · /wipe-school/:id` — i.e. **both** legacy routes collapse into the irreversible purge |
| **THE CODE SAYS** | `wipe-school` is **"Stage 1: soft-delete. Reversible with school.reactivate."** — its own comment. `purge-school` is **"Stage 2: the irreversible purge"**, gated on the school already being `pending_deletion` and on a `PURGE_COOLDOWN_MS` read from `console_audit` |
| **Therefore** | the measured act is a **REVERSIBLE REQUEST-DELETION**, which the target already has: **API-247** `POST /api/platform/schools/:schoolId/request-deletion`. **`POST /api/owner/schools/:id/request-deletion` also exists today** — so `wipe-school` is a DUPLICATE of it, not a break-glass act |
| **Stage 22's disposition** | **LRC-186 → API-247**, marked as a **Stage 22 assignment**, and **C-107 is raised rather than the disagreement being silently resolved** |
| **State** | **SPECIFICATION CONFLICT — OPEN.** It needs an owner decision or a traceable Stage 14 amendment. **Stage 22 does not amend Stage 14's substance on its own authority** |
| **Owning batch** | **B-28** — the platform/break-glass batch is where the wrong answer would do damage |
| **Why it is not merged into anything** | mapping a reversible soft-delete onto `erase-account` (CAP-036) or onto the irreversible `purge` (CAP-092) would **give a routine lifecycle act a break-glass capability, or an irreversible one**. Both are worse than the conflict |

```
THIS IS NOT CLOSED BY BEING DESCRIBED CORRECTLY HERE.
   C-107 enters implementation OPEN, and it closes when the owner decides
   or Stage 14 is amended — not when B-28 compiles.
```

---

## 11. Cutover bridge register — CBR-001 … CBR-015

**NON-ROUTE temporary mechanisms. Nothing here is an HTTP route, and nothing here was discarded when
§15 became route-only.**

```
FOUR OF THE PROPOSED DRAFT'S NINE "LRC" ROWS WERE NEVER ROUTES:
   the role-string authorization mechanism
   the legacy audit writer
   the old allocation/status read source
   the base64 media read path
   the Resend sender                                       ── five, in fact

THEY ARE REAL.  THEY NEEDED A REGISTER.  THEY DID NOT NEED TO BE
PRETENDING TO BE ROUTES.
```

**TXD-016 · The absolute rule that governs every CBR entry**

```
NO TWO EQUAL AUTHORITIES.  EVER.

   Resend and SES          ── ONE ACTIVE SENDER.  Never dual-send
   old and new tables      ── ONE AUTHORITATIVE WRITE PATH
   role string vs capability ── the TARGET mechanism must be PROVED before
                                the legacy check is retired, and the legacy
                                check is what is authoritative until then
   database bytes vs S3    ── the DATABASE is primary until the read-switch

A BRIDGE HAS A PRIMARY AND A COPY.  IT NEVER HAS TWO TRUTHS.   §32
```

| Column | Meaning |
|---|---|
| **Current authority** | what is authoritative today |
| **Target authority** | what becomes authoritative |
| **Authoritative during** | **which side is truth while the bridge exists** — never "both" |
| **In · Sw · Rm** | introduced batch · switch batch · removal batch |
| **Drift check** | the scheduled reconciliation that detects divergence, and it ALERTS |

| CBR | Mechanism | Current authority | Target authority | Why coexistence is temporarily necessary | Authoritative during | In | Sw | Rm | Drift check | Test | Proof required before removal |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **CBR-001** | **authorization mechanism** | role strings (`users.role`, `user_permissions.role`, `session.role`) | **CAP-001 … CAP-095** under the Stage 7 chain, behind `TARGET_AUTHORITY_PATH` | the capability model cannot land atomically across **221 legacy handlers**; a partial switch with no bridge is an outage or a hole | **the LEGACY role check**, until each handler's capability check is green | **B-08** | per domain batch | **B-12** | a handler reaching the capability path while still reading a role string is a **build failure**, not a warning | **TST-D034** — a role string must not satisfy a capability check | full **SEC-T** green; `TARGET_AUTHORITY_PATH` deleted, not defaulted on |
| **CBR-002** | **password verification** | `bcryptjs` hashes | **Argon2id**, rehash-on-login | existing guardians and staff must be able to sign in on the day of cutover; **their passwords cannot be re-derived** | **both formats verify; only Argon2id is written** — this is format tolerance, not two authorities | **B-06** | **B-06** | **B-12** | count of remaining bcrypt hashes, reported per run | Argon2 rehash suite | zero bcrypt hashes remain **or** the residual accounts are recorded and their reset path is live; `bcryptjs` dependency removed — **DEP-C007** |
| **CBR-003** | **TOTP implementation** | the hand-rolled TOTP in `mfa.routes.ts` | a maintained TOTP library, encrypted secret at rest | an enrolled authenticator must keep working across the change; **the secret is the same secret** | the stored secret; **the algorithm is swapped beneath it** | **B-09** | **B-09** | **B-09** | verification-failure rate, watched through the batch | **SEC-T** MFA suite · replay block | every enrolled user verifies on the new implementation in staging with a real authenticator |
| **CBR-004** | **`storage.ts` delegation seam** | `storage.ts` — 153 methods, one `IStorage` | **thirteen module `data.ts` layers** — APP-025 | 18+ call sites and 19 route files import `storage`; **it is narrowed, not deleted** | **whichever side owns the slice** — a method is moved exactly once and delegates thereafter | **B-06** | per domain batch | **B-34** | an import-boundary lint: a module `data.ts` importing another module's `data.ts` fails the build | module boundary lint · domain suites | the last caller has moved; **CSR-014 `IStorage` dies then, and not before** |
| **CBR-005** | **memory-mode storage** | the second `IStorage` implementation | **one database path** | it exists today and some tooling reaches it | **the database**, always — memory mode is never truth | — | **B-06** | **B-12** | a boot in a non-test environment selecting memory mode **fails to boot** | env-validation suite · smoke | no production or staging code path can select it |
| **CBR-006** | **identity read path** | `users` + `user_permissions` + `teacher_profiles` | **persons · credentials · school_memberships · authority grants** — DMR-002 · DMR-025 · DMR-027 | the decomposition is **DMR-002, the highest-risk transform**; readers move behind it in stages | **the OLD tables**, until MIG-13 | **B-06** | **B-06 … B-12** | **B-33** | person-count parity + **every user resolves to exactly one person**, re-run each batch | identity suite · **TEN-T** | MIG-12 parity green on identity |
| **CBR-007** | **money read/write path** | `book_payments` · `basket_payments` · `provider_payments` fused columns | **DBT-035 … DBT-043** decomposed, behind `TARGET_API_PATH` | **SUM PARITY ON EVERY MONEY COLUMN** must be proved before the read moves, and it is proved against live data | **the OLD tables**, until MIG-13 | **B-19** | **B-20** | **B-33** | scheduled sum-parity per money column; **divergence is an ALERT** | **INV-T01 … INV-T04** · money suite | **MIG-12** green; `TARGET_API_PATH` deleted |
| **CBR-008** | **allocation / custody / distribution read source** | `finance_book_allocations`' three fused status columns | **DBT-044 · 045 · 046 · 047** — DMR-013 | `migrations/006` already keeps the three domains distinct, which is what makes the split tractable; the readers move after the split verifies | **the OLD table**, until MIG-13 | **B-21** | **B-21** | **B-33** | per-domain parity + **custody chain continuity**, not row counts | **INV-T** · **TEN-T** · custody machine | allocation parity · custody continuity · **no fabricated actor or timestamp** — §22.1 |
| **CBR-009** | **stock truth** | `book_inventory_transactions` | **DBT-025 `stock_movements` + DBT-026 projection** | the projection must recompute to the stored value before anything reads it | **the transaction record**, always | **B-17** | **B-17** | **B-33** | **projection recomputes to the stored value**, scheduled | **INV-T05** | recompute matches; **no double movement** — §22.2 |
| **CBR-010** | **object bytes** | `media_assets.data_uri` — base64 in PostgreSQL | **S3 objects + DBT-071 `object_uploads`**, behind `TARGET_OBJECT_STORAGE` | **the bytes must be copied AND verified before any read moves**; hash, size and content-type reconcile per object | **the DATABASE bytes**, until the read-switch | **B-26** | **B-26** | **B-33** | per-object hash/size/content-type reconciliation | §24's object suite · **PFL-010 EICAR** | every object reconciled; **no pending or unscanned object is ever public** |
| **CBR-011** | **email sender** | **Resend** | **SES**, switchable without a deploy via `TARGET_EMAIL_PROVIDER` | SES production access is a **provider gate**, not a code gate, and it may not be granted when the code is ready | **exactly one sender is active at a time — Resend until the switch** | **B-24** | **B-24** | **B-32** | delivery-parity: bounce, complaint and failure rates compared across the switch | delivery-parity suite | **NEVER DUAL-SEND.** Resend code, dependency (**DEP-C010**) and configuration all removed |
| **CBR-012** | **audit writer** | `audit_logs` · `message_audit_logs` · `console_audit` — three stores | **DBT-079 `audit_events` + DBT-080 `console_operations`** — Stage 19 | **audit must never have a gap during the switch**; a paired write covers the window | **the OLD path**, until reconciliation passes | **B-30** | **B-30** | **B-31** | three-way row reconciliation, and **`UNKNOWN/LEGACY` where the source never had the field** | audit coupling · taxonomy coverage · **CK-A7** | reconciliation green; **Class A coupling proved — an audit failure rolls the business transaction back** |
| **CBR-013** | **console operation trail** | `console_audit` rows | **DBT-080 `console_operations`** linked to DBT-079 by a UNIQUE FK | the purge cooldown is enforced by **reading `console_audit`**; that read must keep working until the new trail is authoritative | **`console_audit`**, until CBR-012 switches | **B-30** | **B-30** | **B-31** | operation-count parity; **the cooldown query returns the same answer on both** | console suite · **SEC-T15** | the cooldown enforcement is proved on the new trail before the old one stops being read |
| **CBR-014** | **rate limiting** | in-process / `rate_limits` table as used today | **durable rate limiting** — Stage 16 owns the algorithm | Stage 15 preserved `rate_limits` **unchanged** (DMR-021); the algorithm changes beneath it | the stored counters | **B-09** | **B-09** | **B-12** | limiter behaviour under a concurrent burst, in staging | rate-limit suite | the limiter holds under concurrency and **is not keyed on a client-supplied header** |
| **CBR-015** | **schema application** | `drizzle-kit push` (`db:push`) | **the migration runner + MIG-000 gate** | today's schema reaches the database by push; the runner must exist and be proved before push is withdrawn | the runner, from **B-03** | **B-03** | **B-03** | **B-03** | a deployment path invoking `db:push` **fails the build** | **MIG-T01 · MIG-T02** | `db:push` is out of CI **and** out of the deployment path — **C-78's remedy** |

**TXD-017 · The four flags are CBR mechanisms, and each is born with its removal batch**

| Flag | CBR | Default | Introduced | Removed |
|---|---|---|---|---|
| **`TARGET_AUTHORITY_PATH`** | CBR-001 | **off** | **B-08** | **B-12** |
| **`TARGET_API_PATH`** | CBR-007 · CBR-008 | **off** | **B-19** | **B-33** |
| **`TARGET_EMAIL_PROVIDER`** | CBR-011 | **Resend** | **B-24** | **B-32** |
| **`TARGET_OBJECT_STORAGE`** | CBR-010 | **off** | **B-26** | **B-33** |

**No fifth flag. No feature-flag platform.** A flag chooses an **implementation**; a capability decides
whether a person **may act**. **A flag is never security authority** — TXD-065.

**TXD-018 · The end state, stated as a number**

```
AT FINAL TARGET
   LRC              = 0
   CBR              = 0
   temporary flags  = 0
   dual-write paths = 0
   legacy writes    = 0

   ── unless a SEPARATELY LOCKED compatibility requirement says otherwise,
      and NONE currently does.  One may not be invented here to keep a
      bridge alive
```

---

## 12. Screen cutover register — SCR-C001 … SCR-C042

**Stage 9 is the target screen whitelist. All 42 current page files are classified.**

**TXD-019 · The `:section?` pattern is why a screen count and a route count disagree**

```
App.tsx has 15 route patterns.  FOUR of them are catch-alls:
   /admin/:section?   /teacher/:section?   /parent/:section?   /finance/:section?

── ~30 of the 42 pages are reached through a section switch inside four
   shell pages, not through their own route
── SO: a page can be UNREACHABLE and still compile, and a page can be
   REMOVED from the switch and still exist.  Both have happened.
   §40's dead-code proof must read the SWITCHES, not the route table.
```

| ID | Current page file | Class | Band | Note |
|---|---|---|---|---|
| **SCR-C001** | `login.tsx` | KEEP | entry | unchanged behaviour; **SEC-T suite covers it** |
| **SCR-C002** | `forgot-password.tsx` | KEEP | entry | unchanged |
| **SCR-C003** | `reset-password.tsx` | KEEP | entry | unchanged |
| **SCR-C004** | `accept-invite.tsx` | KEEP | entry | **§15.1** — live INVITE TOKENS must keep working (LRC-145 `auth/accept-invite`; `GET /api/invites/:token` and `POST /api/invites/:token/accept` are already at their target paths, API-008 · API-009). **An invite token is not a linking code** — §15.1 |
| **SCR-C005** | `security.tsx` | KEEP | entry | MFA enrolment and recovery codes — **PA-2** |
| **SCR-C006** | `not-found.tsx` | KEEP | shared | unchanged |
| **SCR-C007** | `privacy.tsx` | KEEP | public | unchanged |
| **SCR-C008** | `contact.tsx` | KEEP | public | unchanged |
| **SCR-C009** | `school-public.tsx` | KEEP | public | **content and behaviour survive; its STRUCTURAL home changes** — `apps/site` per **AQ-1 = B**, and the old SPA route becomes LEGACY (Stage 12). It is not rewritten |
| **SCR-C010** | `admin.tsx` | MOVE | shell | the 31-entry `:section?` switch becomes Stage 9 route entries — **TXD-019** |
| **SCR-C011** | `teacher.tsx` | MOVE | shell | **DS-P10 handheld behaviour preserved** — Stage 12 |
| **SCR-C012** | `parent.tsx` | MOVE | shell | 1,489 lines split; **no global selected school** |
| **SCR-C013** | `finance.tsx` | MOVE | shell | **C-50** — a work area, not a shell |
| **SCR-C014** | `admin/dashboard.tsx` | REBUILD | school | locked workflow changed; **the components inside it mostly do not** — §13 |
| **SCR-C015** | `admin/students.tsx` | REBUILD | school | **C-58** — the browser-side XLSX import is REPLACED (§14), the screen is rebuilt around it |
| **SCR-C016** | `admin/families.tsx` | REBUILD | school | DMR-009's relationship remodel is behind it |
| **SCR-C017** | `admin/allocations.tsx` | REBUILD | school | **DMR-013** — the three status domains split |
| **SCR-C018** | `admin/payments.tsx` | REBUILD | school | **I-2 is enforced server-side; the screen never becomes the invariant** |
| **SCR-C019** | `admin/reconciliation.tsx` | REBUILD | school | money reconciliation — **MIG-12 parity is the gate** |
| **SCR-C020** | `admin/classes.tsx` | REBUILD | school | DMR-006 |
| **SCR-C021** | `admin/books.tsx` | REBUILD | school | DMR-008 |
| **SCR-C022** | `admin/book-levels.tsx` | REBUILD | school | **level rules are proven; they are relocated, not rewritten** — TXP-4 |
| **SCR-C023** | `admin/book-copies.tsx` | REBUILD | school | DMR-008 + DMR-015 |
| **SCR-C024** | `admin/student-profile.tsx` | REBUILD | school | custody history — **DMR-014, chain continuity** |
| **SCR-C025** | `admin/collection-sheet.tsx` | REBUILD | school | distribution day surface — **print behaviour is a preserved requirement** |
| **SCR-C026** | `admin/it-dashboard.tsx` | MERGE | platform | → the platform surfaces **UX-095 / 096 / 099** |
| **SCR-C027** | `admin/system-health.tsx` | MERGE | platform | → the platform surfaces **UX-095 / 096 / 099** |
| **SCR-C028** | `admin/db-console.tsx` | MERGE | platform | → the platform surfaces; **arbitrary SQL becomes LEGACY** (Stage 12) and MOD-012 governs it |
| **SCR-C029** | `admin/owner.tsx` | MERGE | platform | → the platform surfaces. **Stage 12 (C-44) maps this file into the platform band — it is RELOCATED INTO the console, not deleted as lost work** |
| **SCR-C030** | `admin/branding.tsx` | MERGE | studio | → Website Studio |
| **SCR-C031** | `admin/media-library.tsx` | MERGE | studio | → Website Studio; **MIG-11 moves the bytes** (§26) |
| **SCR-C032** | `admin/website.tsx` | MERGE | studio | → Website Studio; **DMR-018 CMS decomposition** |
| **SCR-C033** | `admin/setup.tsx` | MERGE | school | → the setup and invitation flows |
| **SCR-C034** | `admin/invite-staff-wizard.tsx` | MERGE | school | → the setup and invitation flows |
| **SCR-C035** | `register.tsx` | KEEP + REFACTOR | entry | **PARENT SELF-REGISTRATION SURVIVES.** Locked target **UX-005 Parent self-registration**; locked contract **API-010** `POST /api/auth/sign-up-parent` (CAP-026, MOD-002) — **the route already exists at the target path today.** Stage 12 classifies this file **KEEP CONCEPT**. The file may move to `bands/entry/`; **the product capability does not go anywhere** |
| **SCR-C036** | `admin/shared.tsx` | **REMOVE** | — | **a helper file, not a surface** (84 lines). Its helper CONTENT relocates to a real home (Stage 12); only the page shell goes. Proof required: §40 |
| **SCR-C037** | `admin/communications.tsx` | KEEP + REFACTOR | school | MOD-009; **no message body enters audit** — DMR-017 |
| **SCR-C038** | `admin/linking-codes.tsx` | KEEP + REFACTOR | school | **C-25** — the two-step path becomes the only path; **live LINKING CODES keep working** — LRC-203 · LRC-204 · LRC-205, §15.2 |
| **SCR-C039** | `admin/reports.tsx` | KEEP + REFACTOR | school | reporting scope follows the Stage 7 chain |
| **SCR-C040** | `admin/users.tsx` | KEEP + REFACTOR | school | staff surface; **capability checks replace role strings** — TST-D034 |
| **SCR-C041** | `admin/family-enrollment.tsx` | KEEP + REFACTOR | school | **pipeline 1 of 2** — §14 selects the survivor, C-105 / **A4-001** governs granularity |
| **SCR-C042** | `admin/family-enrollment-import.tsx` | KEEP + REFACTOR | school | **pipeline 2 of 2** — §14; **neither is removed before the survivor is proved** |

| Class | Count | Screens |
|---|---|---|
| **KEEP** | **9** | SCR-C001 … C009 — the entry, shared and public screens |
| **MOVE** | **4** | SCR-C010 … C013 — the four shells become Stage 9's role entry points |
| **REBUILD** | **12** | SCR-C014 … C025 — **the locked workflow changed for each; the components inside them mostly do not** (§13) |
| **MERGE** | **9** | SCR-C026 … C034 — four into the platform surfaces, three into Website Studio, two into the setup and invitation flows |
| **REMOVE** | **1** | SCR-C036 `admin/shared.tsx` — **and it is not removed without §40's proof** |
| **BRIDGE** | **0** | **no screen bridges.** A screen is switched by routing, and routing switches atomically per surface |
| **KEEP + REFACTOR** | **7** | SCR-C035 · SCR-C037 … C042 |
| **TOTAL** | **42** | **every one of the 42 measured page files appears exactly once above** |

**TXD-019.1 · A PAGE FILE is not a HUMAN SCREEN, and the two are counted separately**

```
PAGE FILES        42   ── measured: client/src/pages/**/*.tsx
                          this is a FILESYSTEM fact

HUMAN SURFACES    41   ── the 42 minus admin/shared.tsx, which is a helper
                          file living in a pages directory and is not a
                          surface anyone navigates to

   ── the four shells (SCR-C010 … C013) ARE surfaces: they are the role
      entry points, and ~30 of the other pages are reached THROUGH them
   ── a file in pages/ is not automatically a UX surface, and a UX surface
      is not automatically one file (Website Studio is three files merging
      into one surface)

SO: THE REMOVE COUNT IS 1, AND IT IS A HELPER FILE.
   NO HUMAN SURFACE IS REMOVED BY THIS PLAN.
```

**TXD-020.1 · `admin/shared.tsx` may be removed only on four proofs, all of them direct**

| | Required before removal |
|---|---|
| **1 · not a surface** | it is opened and shown to be a helper/page-shell, with no route entry and no `:section?` switch case — **§40 reads the SWITCHES, not the route table** |
| **2 · content relocated** | its useful helper content has a real home first (Stage 12 records that it "gets a real home") — **REPLACEMENT BEFORE REMOVAL** |
| **3 · import graph empty** | no file imports it at removal time, proved by search, not by assumption |
| **4 · §40 proof passes** | the same nine-place link search as TXD-021 |

**If any of the four fails, it stays.** *"If uncertain: KEEP IT, DOCUMENT IT, INVESTIGATE IT."*


**TXD-020 · `register.tsx` — the correction, stated plainly**

**The PROPOSED draft of this document classified `register.tsx` as REMOVE, asserting that the locked
model has no self-registration. THAT WAS FALSE, and it was Stage 22's error — not the locked stages'.**

```
WHAT THE LOCKED STAGES ACTUALLY SAY
   ROLE_EXPERIENCE.md   UX-005  Parent self-registration        ── a target screen
   ROLE_EXPERIENCE.md   register.tsx → UX-005 → KEEP CONCEPT    ── "Correct job"
   API_CONTRACT.md      API-010 POST /api/auth/sign-up-parent
                        CAP-026 · SC-5 · MOD-002                ── a target contract
   MEASURED             the route EXISTS TODAY at exactly that path

THE CORRECT MODEL
   a guardian MAY create their own account
   → they then REDEEM an authorised LINKING CODE
   → the LINKING CODE establishes the child relationship
   → they DO NOT choose an arbitrary school, and creating an account
     grants access to NOTHING until a code is redeemed

WHAT IS STILL TRUE
   a SCHOOL is created by the PLATFORM              CAP-082 create_tenant
   its FIRST ADMIN is INVITED                       CAP-083
   ── none of that has ever been in tension with parent self-registration

NO STAGE 2, 3, 5 OR 9 AMENDMENT IS RAISED.
   The locked stages were right.  This document was wrong, and it is
   corrected here rather than propagated.
```

**TXD-021 · Deep links, email links and support links are checked before any screen is removed** —
same nine-place search as TXD-009. **A screen with no navigation entry may still be the target of a
link in an inbox.**

---

## 13. Component salvage

**TXD-022 · A removed SCREEN does not imply removed COMPONENTS — and 59 components against 12 rebuilt
screens is where most of the salvage is**

```
REBUILDING A SCREEN'S WORKFLOW ≠ REBUILDING ITS PARTS.

SALVAGED, subject to the design-system contract
   forms and their validation displays      tables and their empty states
   dialogs and confirmations                cards
   BOOK VISUALS — spine, cover, level chips  BRAND components
   layout primitives                        barcode / QR components
   query-state.tsx                          ── CSR-022, ADOPTED EVERYWHERE

TRACKED SEPARATELY where material: a component used by a REMOVED screen and
by a KEPT one is KEPT, and the removal proof must say so.
```

**TXD-023 · A component is rebuilt only where the design system's contract changed, never for
aesthetics.** Stage 10 locked one appearance and a WCAG 2.2 AA baseline; **a component that meets it
does not become non-compliant by being in an older file.**

---

## 14. Dependency cutlist — DEP-C001 … DEP-C023, and the exact inventory DEP-I001 … DEP-I099

**79 runtime + 19 dev + 1 optional = 99 DIRECT entries in `package.json`. DEP-C holds the MATERIAL
CHANGE DECISIONS; §14.1's DEP-I inventory lists every package individually, so the claim is
machine-checkable rather than asserted.**

```
"EVERY DEPENDENCY IS ACCOUNTED FOR" WAS NOT CHECKABLE WHILE ONLY TWENTY
WERE NAMED.  IT IS NOW.
   DEP-C   material change decisions       ── several packages may share one
   DEP-I   one row per package.json entry  ── 99 rows, 99 entries, exactly
```

| DEP-C | Package(s) | Class | Evidence / reason |
|---|---|---|---|
| **DEP-C001** | `@supabase/ssr` · `@supabase/supabase-js` | **REMOVE** | **zero importing files** across `client/src`, `server`, `shared`, `api`, `script` and the build config |
| **DEP-C002** | `passport` · `passport-local` | **REMOVE** | **zero importing files.** Authentication does not use them |
| **DEP-C003** | `framer-motion` | **REMOVE** | **zero importing files** |
| **DEP-C004** | `date-fns` | **REMOVE** | **zero importing files** — `lib/format.ts` (CSR-021) is the formatting layer |
| **DEP-C005** | `next-themes` | **REMOVE** | **one importing file**, and **Stage 10 supports ONE appearance** — C-55. The import goes with it |
| **DEP-C006** | `memorystore` | **REMOVE** | **one importing file** — `server/app.ts`'s dev session fallback. **Stage 21 forbids an in-memory production fallback**; CSR-043 |
| **DEP-C007** | `bcryptjs` | **REPLACE → Argon2id** | Stage 11. **Kept until every hash has been rehashed on login** — §18, then removed at **B-12** |
| **DEP-C008** | the hand-rolled TOTP code | **REPLACE → a maintained library** | Stage 11 · CSR-037 |
| **DEP-C009** | `xlsx@0.18.5` (npm) | **REPLACE THE DISTRIBUTION, KEEP THE LIBRARY** | **CURRENT:** `xlsx@0.18.5` from npm — the terminal npm release, predating the CVE-2023-30533 and CVE-2024-22363 fixes — **and imported CLIENT-SIDE** in `admin/students.tsx`, so it is in the browser bundle. **TARGET, locked Stage 11 TD-038:** **the official VENDORED SheetJS distribution, 0.20.3 or later, SERVER-SIDE ONLY**, size-capped, no formula evaluation. **REMOVE:** client-side workbook parsing. **KEEP:** the server-side spreadsheet capability. **Stage 22 does NOT reselect spreadsheet technology** — see TXD-035.1. **C-58** |
| **DEP-C010** | `resend` | **REMOVE after SES cutover** | A11-001 CURRENT/LEGACY. **Removed at B-32**, not before — **CBR-011** |
| **DEP-C011** | AWS SDK (S3, SES, STS) | **ADD** | Stage 17/21's target providers |
| **DEP-C012** | `aws-cdk-lib` + `constructs` | **ADD — dev only** | Stage 21 DEP-D136 selected CDK/TypeScript. **Infrastructure, never a runtime import** |
| **DEP-C013** | `@sentry/node` · `@sentry/react` | **ADD** | Stage 17's EU org — Stage 21 §26 |
| **DEP-C014** | `vitest` · `@vitest/browser` | **ADD — dev** | Stage 20 TST-D003 |
| **DEP-C015** | `playwright` / `@playwright/test` | **ADD — dev** | Stage 20 TST-D005 |
| **DEP-C016** | `@axe-core/playwright` | **ADD — dev** | Stage 20 TST-D006 |
| **DEP-C017** | `argon2` (or the selected binding) | **ADD** | DEP-C007's replacement |
| **DEP-C018** | `pg` · `@neondatabase/serverless` · `drizzle-orm` · `drizzle-zod` | **KEEP** | Stage 11 locked. **Both drivers stay** — A13-001 constrains which one RLS reads use |
| **DEP-C019** | `express` · `express-session` · `connect-pg-simple` · `helmet` · `zod` · `wouter` · `@tanstack/react-query` · Radix · Tailwind stack | **KEEP** | Stage 11's locked target stack |
| **DEP-C020** | `ws` · `@types/ws` | **KEEP** | no direct import; **it is the WebSocket transport peer for `@neondatabase/serverless`**. A naive grep suggests otherwise — this is exactly the trap TXD-024 names |
| **DEP-C021** | `@jridgewell/trace-mapping` · `tailwindcss-animate` · `@hookform/resolvers` · `zod-validation-error` | **REMOVE / INVESTIGATE** | **measured at correction: zero importing files each.** `tailwindcss-animate` is superseded by `tw-animate-css`, which **is** imported (`client/src/index.css:2`). The two form/validation helpers are marked **INVESTIGATE → REMOVE ON PROOF**, because a resolver bridge may legitimately be adopted by the target forms — **the decision is evidence-led at B-34, not asserted here** |
| **DEP-C022** | `file-type` | **KEEP — for the TARGET** | **zero importing files today.** It is kept because **§26's object pipeline requires content-type sniffing on upload**. Kept-for-target is stated plainly rather than dressed up as kept-because-used |
| **DEP-C023** | `@types/node` | **UPGRADE** | currently `^20.x` against a **Node 24 target**. **A types package one major behind the runtime is a silent source of wrong assumptions**, and Stage 21's single Node authority governs the version |

**TXD-024 · A package is not removed because a grep found no static import**

```
BEFORE ANY REMOVE, CHECK ALSO
   dynamic import()          build configuration (vite, esbuild, drizzle-kit)
   CLI / script use          provider tooling and postinstall
   PEER DEPENDENCY of a kept package        ── DEP-C020 is the live example
   type-only imports

`ws` HAS NO DIRECT IMPORT AND MUST NOT BE REMOVED.
   ── removing it breaks the Neon serverless driver at runtime, not at build,
      which means it breaks in production and not in CI
```

**TXD-025 · Final `package.json` contains only target dependencies. The count is not the goal; the
absence of an unjustified entry is** — and §14.1 is what makes that statement checkable rather than
rhetorical.

---

### 14.1 Exact dependency inventory — DEP-I001 … DEP-I099

**Every direct dependency and direct devDependency in `package.json` appears below exactly once.
The count reconciles to the file, or the claim is not made.**

```
MEASURED FROM package.json

   dependencies         79
   devDependencies      19
   optionalDependencies  1        bufferutil
   ── DIRECT ENTRIES    99        and DEP-I001 … DEP-I099 is 99 rows

   peerDependencies      0        (the object is empty)

DIRECT vs TRANSITIVE — the distinction that matters here
   `ws` is a DIRECT dependency that NO APPLICATION FILE IMPORTS.
   It is a REQUIRED PEER of the Neon driver's WebSocket path.
   "static application code does not import it" is NOT evidence that it
   is unused, and it MUST NOT be removed on that basis.       DEP-C015

   The same test applies to every REMOVE below: the proof is an
   IMPORT-GRAPH AND RUNTIME-REQUIREMENT proof, not a grep for the name.
```

**Dispositions, counted:** **KEEP** 85 · **REMOVE** 10 · **REPLACE** 2 · **UPGRADE** 2.

**Several packages share one material DEP-C decision** — that is expected, and the DEP-C column names
it. **The exact-package inventory still lists each package on its own row.**

| ID | Package | Kind | Current | Disposition | Why | Batch | DEP-C |
|---|---|---|---|---|---|---|---|
| **DEP-I001** | `@hookform/resolvers` | runtime | `^3.10.0` | **KEEP** | form validation bridge to Zod; used by the target forms | — | — |
| **DEP-I002** | `@jridgewell/trace-mapping` | runtime | `^0.3.25` | **REMOVE** | **no application import.** A transitive source-map helper hoisted into `dependencies`; prove-then-remove | B-34 | — |
| **DEP-I003** | `@neondatabase/serverless` | runtime | `^0.10.4` | **KEEP** | the Neon HTTP/WS driver — Stage 11 · Stage 21 `lhr1`/`eu-west-2` | — | DEP-C004 |
| **DEP-I004** | `@radix-ui/react-accordion` | runtime | `^1.2.12` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I005** | `@radix-ui/react-alert-dialog` | runtime | `^1.1.15` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I006** | `@radix-ui/react-aspect-ratio` | runtime | `^1.1.8` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I007** | `@radix-ui/react-avatar` | runtime | `^1.1.11` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I008** | `@radix-ui/react-checkbox` | runtime | `^1.3.3` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I009** | `@radix-ui/react-collapsible` | runtime | `^1.1.12` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I010** | `@radix-ui/react-context-menu` | runtime | `^2.2.16` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I011** | `@radix-ui/react-dialog` | runtime | `^1.1.15` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I012** | `@radix-ui/react-dropdown-menu` | runtime | `^2.1.16` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I013** | `@radix-ui/react-hover-card` | runtime | `^1.1.15` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I014** | `@radix-ui/react-label` | runtime | `^2.1.8` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I015** | `@radix-ui/react-menubar` | runtime | `^1.1.16` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I016** | `@radix-ui/react-navigation-menu` | runtime | `^1.2.14` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I017** | `@radix-ui/react-popover` | runtime | `^1.1.15` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I018** | `@radix-ui/react-progress` | runtime | `^1.1.8` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I019** | `@radix-ui/react-radio-group` | runtime | `^1.3.8` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I020** | `@radix-ui/react-scroll-area` | runtime | `^1.2.10` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I021** | `@radix-ui/react-select` | runtime | `^2.2.6` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I022** | `@radix-ui/react-separator` | runtime | `^1.1.8` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I023** | `@radix-ui/react-slider` | runtime | `^1.3.6` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I024** | `@radix-ui/react-slot` | runtime | `^1.2.4` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I025** | `@radix-ui/react-switch` | runtime | `^1.2.6` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I026** | `@radix-ui/react-tabs` | runtime | `^1.1.13` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I027** | `@radix-ui/react-toast` | runtime | `^1.2.7` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I028** | `@radix-ui/react-toggle` | runtime | `^1.1.10` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I029** | `@radix-ui/react-toggle-group` | runtime | `^1.1.11` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I030** | `@radix-ui/react-tooltip` | runtime | `^1.2.8` | **KEEP** | shadcn/ui primitive — Stage 10 DS is built on these; **CSR-050** | — | DEP-C013 |
| **DEP-I031** | `@supabase/ssr` | runtime | `^0.10.3` | **REMOVE** | **not the target auth or data path.** Stage 11 selected Neon + Drizzle + server sessions; prove no import, then remove | B-34 | DEP-C012 |
| **DEP-I032** | `@supabase/supabase-js` | runtime | `^2.106.2` | **REMOVE** | as above — **DEP-C012**. Removing an unused auth SDK is a security improvement, not tidying | B-34 | DEP-C012 |
| **DEP-I033** | `@tanstack/react-query` | runtime | `^5.60.5` | **KEEP** | the locked client data layer — Stage 11; **query-state adoption is CSR-022** | — | — |
| **DEP-I034** | `@types/connect-pg-simple` | runtime | `^7.0.3` | **KEEP → **move to devDependencies**** | a types package in `dependencies` ships nothing but bloats the runtime install | B-34 | — |
| **DEP-I035** | `@types/jsbarcode` | runtime | `^3.11.4` | **KEEP → **move to devDependencies**** | as above | B-34 | — |
| **DEP-I036** | `@types/multer` | runtime | `^2.1.0` | **KEEP → **move to devDependencies**** | as above | B-34 | — |
| **DEP-I037** | `bcryptjs` | runtime | `^2.4.3` | **REPLACE → **Argon2id**** | **CBR-002.** Kept until every hash is rehashed on login, then removed | B-12 | DEP-C007 |
| **DEP-I038** | `class-variance-authority` | runtime | `^0.7.1` | **KEEP** | shadcn/ui variant system | — | — |
| **DEP-I039** | `clsx` | runtime | `^2.1.1` | **KEEP** | class composition | — | — |
| **DEP-I040** | `cmdk` | runtime | `^1.1.1` | **KEEP** | command palette primitive | — | — |
| **DEP-I041** | `connect-pg-simple` | runtime | `^10.0.0` | **KEEP** | the PostgreSQL session store — **DBT-075 `user_sessions`’ shape is fixed by it** (Stage 15 §31) | — | — |
| **DEP-I042** | `date-fns` | runtime | `^3.6.0` | **KEEP** | date handling; **en-GB formatting is CSR-021, not this** | — | — |
| **DEP-I043** | `dotenv` | runtime | `^17.4.2` | **KEEP** | local env loading; **Stage 21 §18’s Zod schema is the validator, not this** | — | — |
| **DEP-I044** | `drizzle-orm` | runtime | `^0.39.3` | **UPGRADE** | Stage 11 target; the ORM the target schema is written in | B-05 | DEP-C002 |
| **DEP-I045** | `drizzle-zod` | runtime | `^0.7.0` | **KEEP** | schema→Zod bridge used by the target validation | — | — |
| **DEP-I046** | `embla-carousel-react` | runtime | `^8.6.0` | **KEEP** | shadcn carousel primitive | — | — |
| **DEP-I047** | `express` | runtime | `^5.0.1` | **KEEP** | Express 5 — Stage 11 target | — | DEP-C001 |
| **DEP-I048** | `express-session` | runtime | `^1.19.0` | **KEEP** | session middleware; **rotation and revocation are Stage 16’s, on top of it** | — | — |
| **DEP-I049** | `file-type` | runtime | `^22.0.1` | **KEEP** | content-type sniffing on upload — **required by §26’s object pipeline** | — | — |
| **DEP-I050** | `framer-motion` | runtime | `^12.23.24` | **KEEP** | motion; Stage 10 DS | — | — |
| **DEP-I051** | `helmet` | runtime | `^8.2.0` | **KEEP** | security headers — **CSP is Stage 16’s configuration of it** | — | — |
| **DEP-I052** | `html5-qrcode` | runtime | `^2.3.8` | **KEEP** | barcode/QR scanning — **the teacher handheld surface, DS-P10** | — | — |
| **DEP-I053** | `input-otp` | runtime | `^1.4.2` | **KEEP** | the MFA/OTP input primitive | — | — |
| **DEP-I054** | `jsbarcode` | runtime | `^3.12.3` | **KEEP** | barcode rendering — book copies | — | — |
| **DEP-I055** | `lucide-react` | runtime | `^0.545.0` | **KEEP** | the locked icon set | — | — |
| **DEP-I056** | `memorystore` | runtime | `^1.6.7` | **REMOVE** | the in-memory session store. **CBR-005** — memory mode is never truth; a non-test environment selecting it must fail to boot | B-12 | — |
| **DEP-I057** | `multer` | runtime | `^2.1.1` | **KEEP** | multipart upload handling — **feeds API-022/API-222’s two-step upload** | — | — |
| **DEP-I058** | `next-themes` | runtime | `^0.4.6` | **KEEP** | theme switching | — | — |
| **DEP-I059** | `passport` | runtime | `^0.7.0` | **REMOVE** | **not the target auth mechanism.** Stage 16 specifies the session/credential path directly; prove no import, then remove | B-12 | DEP-C014 |
| **DEP-I060** | `passport-local` | runtime | `^1.0.0` | **REMOVE** | as above — **DEP-C014** | B-12 | DEP-C014 |
| **DEP-I061** | `pg` | runtime | `^8.21.0` | **KEEP** | the node-postgres driver — **the pooled path Stage 21 DEP-D151 sizes by measuring `SHOW max_connections;`** | — | DEP-C004 |
| **DEP-I062** | `qrcode.react` | runtime | `^4.2.0` | **KEEP** | QR rendering — MFA enrolment | — | — |
| **DEP-I063** | `react` | runtime | `^19.2.0` | **KEEP** | React 19.2 — Stage 11 | — | DEP-C003 |
| **DEP-I064** | `react-day-picker` | runtime | `^9.11.1` | **KEEP** | date picker primitive | — | — |
| **DEP-I065** | `react-dom` | runtime | `^19.2.0` | **KEEP** | React 19.2 — Stage 11 | — | DEP-C003 |
| **DEP-I066** | `react-hook-form` | runtime | `^7.66.0` | **KEEP** | the locked form layer | — | — |
| **DEP-I067** | `react-resizable-panels` | runtime | `^2.1.9` | **KEEP** | shadcn panel primitive | — | — |
| **DEP-I068** | `recharts` | runtime | `^2.15.4` | **KEEP** | charts — reporting surfaces, B-29 | — | — |
| **DEP-I069** | `resend` | runtime | `^6.12.4` | **REMOVE after SES cutover** | **CBR-011.** Removed at B-32, not before; **never dual-send** | B-32 | DEP-C010 |
| **DEP-I070** | `sonner` | runtime | `^2.0.7` | **KEEP** | toast | — | — |
| **DEP-I071** | `tailwind-merge` | runtime | `^3.3.1` | **KEEP** | class merging | — | — |
| **DEP-I072** | `tailwindcss-animate` | runtime | `^1.0.7` | **KEEP** | Tailwind animation preset | — | — |
| **DEP-I073** | `tw-animate-css` | runtime | `^1.4.0` | **KEEP** | Tailwind v4 animation utilities | — | — |
| **DEP-I074** | `vaul` | runtime | `^1.1.2` | **KEEP** | drawer primitive | — | — |
| **DEP-I075** | `wouter` | runtime | `^3.3.5` | **KEEP** | the locked router — Stage 11 | — | DEP-C005 |
| **DEP-I076** | `ws` | runtime | `^8.18.0` | **KEEP** | **a REQUIRED PEER of the Neon driver for the WebSocket path.** It is not imported by application code, and that is not evidence that it is unused. **DO NOT REMOVE** | — | DEP-C015 |
| **DEP-I077** | `xlsx` | runtime | `^0.18.5` | **REPLACE THE DISTRIBUTION** | **TD-038** — vendored official SheetJS 0.20.3+, server-side only. The npm package is removed once the vendored distribution is in place | B-22 | DEP-C009 |
| **DEP-I078** | `zod` | runtime | `^3.25.76` | **KEEP** | validation and the env schema — Stage 21 §18 | — | DEP-C006 |
| **DEP-I079** | `zod-validation-error` | runtime | `^3.4.0` | **KEEP** | error presentation for Zod | — | — |
| **DEP-I080** | `@tailwindcss/vite` | dev | `^4.1.14` | **KEEP** | Tailwind v4 Vite plugin | — | — |
| **DEP-I081** | `@types/bcryptjs` | dev | `^2.4.6` | **REMOVE** | follows `bcryptjs` — **DEP-C007** | B-12 | DEP-C007 |
| **DEP-I082** | `@types/express` | dev | `^5.0.0` | **KEEP** | Express 5 types | — | — |
| **DEP-I083** | `@types/express-session` | dev | `^1.18.2` | **KEEP** | session types | — | — |
| **DEP-I084** | `@types/node` | dev | `^20.19.0` | **UPGRADE** | **must match the Node 24 target** — Stage 21’s single Node authority | B-04 | DEP-C017 |
| **DEP-I085** | `@types/passport` | dev | `^1.0.16` | **REMOVE** | follows `passport` — **DEP-C014**. It IS still in package.json today | B-12 | DEP-C014 |
| **DEP-I086** | `@types/passport-local` | dev | `^1.0.38` | **REMOVE** | follows `passport-local` — **DEP-C014**. It IS still in package.json today | B-12 | DEP-C014 |
| **DEP-I087** | `@types/react` | dev | `^19.2.0` | **KEEP** | React 19 types | — | — |
| **DEP-I088** | `@types/react-dom` | dev | `^19.2.0` | **KEEP** | React 19 types | — | — |
| **DEP-I089** | `@types/ws` | dev | `^8.5.13` | **KEEP** | types for the required `ws` peer | — | DEP-C015 |
| **DEP-I090** | `@vitejs/plugin-react` | dev | `^5.0.4` | **KEEP** | React plugin | — | — |
| **DEP-I091** | `autoprefixer` | dev | `^10.4.21` | **KEEP** | CSS pipeline | — | — |
| **DEP-I092** | `drizzle-kit` | dev | `^0.31.4` | **KEEP — **but `db:push` leaves CI and the deployment path**** | **CBR-015 · C-78.** The tool stays for local schema authoring; the migration RUNNER becomes the only way schema reaches a database | B-03 | DEP-C016 |
| **DEP-I093** | `esbuild` | dev | `^0.25.0` | **KEEP** | the server bundle step | — | — |
| **DEP-I094** | `postcss` | dev | `^8.5.6` | **KEEP** | CSS pipeline | — | — |
| **DEP-I095** | `tailwindcss` | dev | `^4.1.14` | **KEEP** | Tailwind v4.1 — Stage 10/11 | — | — |
| **DEP-I096** | `tsx` | dev | `^4.20.5` | **KEEP** | the dev/test runner today; **Vitest is ADDED at B-04, it does not replace tsx for scripts** | — | — |
| **DEP-I097** | `typescript` | dev | `5.6.3` | **KEEP** | pinned 5.6.3 — Stage 11 | — | — |
| **DEP-I098** | `vite` | dev | `^7.1.9` | **KEEP** | Vite 7.1 — Stage 11 | — | — |
| **DEP-I099** | `bufferutil` | optional | `^4.0.8` | **KEEP** | **optionalDependency.** A native accelerator for `ws`; optional by design | — | — |

**TXD-036.1 · What this inventory is allowed to claim, and what it is not**

```
CLAIMED, AND RECONCILED
   every DIRECT dependency and devDependency in package.json has a row
   99 rows · 99 package.json entries · zero duplicates · zero omissions

NOT CLAIMED
   that every TRANSITIVE dependency has a disposition.  It does not, and
   pretending otherwise would be a false completeness claim
   ── transitive risk is handled by npm audit in CI (B-04) and, for the
      VENDORED SheetJS which npm audit cannot see, by TR-010's named
      owner and review cadence (B-22)

NO PACKAGE IS REMOVED BECAUSE A GREP FOUND NO IMPORT.
   Removal requires: no import · no runtime requirement · no peer
   requirement · CI green without it.                      §40's proof
```

---

## 15. Database migration map — DMR-001 … DMR-027

**42 current physical tables → Stage 15's 80.** The 41 `pgTable` declarations in `shared/schema.ts`
**plus `console_audit`**, which exists only because `migrations/001_console_hardening.sql` created it
and never entered the schema file. **Every current table has a disposition, and no current data
silently disappears.**

**27 map entries cover 42 tables** because several entries move a related group in one transform —
the entry is the unit of WORK, the table is the unit of PROOF. **Stage 15 §45's numbered 41-row table
map is the authority; nothing here contradicts it.**

**TXD-026 · The shape of the mapping is not 41 → 41**

```
THE TARGET IS NOT "the same tables, tidied".

   DECOMPOSITION   `users` carries person, credential, membership and
                   authority in one row  ──►  DBT-007 persons ·
                   DBT-008 credentials · DBT-009 school_memberships ·
                   DBT-010 authority_grants
   SPLIT           `finance_book_allocations` carries three status domains
                   ──►  allocations · custody · distribution, kept distinct
   BRANDING SPLIT  school settings + branding  ──►  DBT-003 school_identity ·
                   DBT-004 school_configuration · DBT-005 entitlements
   EXTRACTION      base64 bytes in `media_assets.data_uri`  ──►  object
                   storage + DBT-071 object_uploads
   NEW             46 tables with no current source — audit, jobs, imports,
                   supply cycles, requirements, support engagements …
```

| DMR | Current table | Target | Transform | Verification |
|---|---|---|---|---|
| **DMR-001** | `schools` | **DBT-001** + DBT-002 lifecycle | retain; lifecycle events created from status history where derivable, **`UNKNOWN` where not** | row parity |
| **DMR-002** | `users` | **DBT-007 · 008 · 009 · 010** | **DECOMPOSE** — the highest-risk transform in the migration | person count parity; **every user resolves to exactly one person**; credential parity |
| **DMR-003** | `invites` | **DBT-011** | retain + tenant column | parity; **live INVITE TOKENS must keep working** — **API-008 · API-009**, §15.1. **This is NOT the linking-code path** |
| **DMR-004** | `audit_logs` | **DBT-079** | **MIG-07** — §29 | row parity; **`UNKNOWN/LEGACY` where the source never had the field** |
| **DMR-005** | `message_audit_logs` | **DBT-079** | MIG-07 — **the easiest of the three**, it already has `school_id` and an actor FK | parity |
| **DMR-006** | `classes` · `subjects` · `class_teacher_assignments` | **DBT-014 · 015 · 016 · 017** | retain + decompose staffing | parity per table |
| **DMR-007** | `students` | **DBT-018 children** | retain + tenant integrity | **count parity, and it is a child-record count** |
| **DMR-008** | `books` · `book_copies` · `book_levels` · `book_level_items` · `class_book_levels` · `student_book_levels` | **DBT-023 · 024 · 027 · 028 · 029 · 033** | **bundle/level model consolidation** | parity; level membership reconciled |
| **DMR-009** | `families` · `family_students` · `guardians` · `parent_children` | **DBT-019 · 020 · 021** | **DECOMPOSE + DEDUPE** — two relationship tables become one model | **relationship parity is the check that matters**; no child loses a guardian |
| **DMR-010** | `child_linking_codes` | **DBT-022** | retain; `UNIQUE (code_hash)` becomes global and unconditional | **live LINKING CODES must keep working** — **API-197 · API-198**, LRC-203 · 204 · 205, §15.2. **A linking code is a different credential class from an invite token, with its own lifetime** |
| **DMR-011** | `child_book_baskets` · `basket_items` | **DBT-030 · 031 · 032 · 034** | **supply cycles and requirements** — a genuine remodel | line-count parity; **money lines reconcile to source** |
| **DMR-012** | `book_payments` · `basket_payments` · `provider_payments` · `payment_verification_attempts` | **DBT-035 · 036 · 038 · 041 · 042 · 043** | **DECOMPOSE money events from applications from provider records** | **SUM PARITY ON EVERY MONEY COLUMN** — MIG-12 |
| **DMR-013** | `finance_book_allocations` | **DBT-044 · DBT-045 · DBT-046 · DBT-047** — the locked Stage 15 §45 mapping, exactly | **SPLIT the three status domains** — `migrations/006` already keeps them distinct, which is why this is possible. **Only what the source PROVES is derived** — §24.1 | allocation parity · **custody chain continuity** · handover parity **where source evidence exists** · exception parity **where source evidence exists** · **no fabricated actor · no fabricated timestamp · no orphan target event** |
| **DMR-014** | `custody_events` | **DBT-045** | retain — **append-only, and it stays that way** | **chain continuity, not just count** |
| **DMR-015** | `book_inventory_transactions` | **DBT-025 stock_movements** + DBT-026 projection | retain + build the projection | **projection recomputes to the stored value** |
| **DMR-016** | `extra_copy_requests` | **DBT-049 · 050 · 051** | decompose request/review/charge | parity |
| **DMR-017** | `message_threads` · `messages` | **DBT-055 · 056** | retain | parity; **no message body enters audit** |
| **DMR-018** | `school_website_sections` | **DBT-058 … 066** | **CMS decomposition** | parity per section type |
| **DMR-019** | `media_assets` | **DBT-071 object_uploads** + **S3 objects** | **MIG-11 — bytes leave the database** | **hash, size and content-type reconciled per object** — §26 |
| **DMR-020** | `notification_preferences` | **DBT-057** | retain | parity |
| **DMR-021** | `rate_limits` | **DBT-076** | **retain unchanged** — Stage 15 preserved it | none needed |
| **DMR-022** | `console_audit` | **DBT-079 + DBT-080 + the quarantine** | **§29 and §30** — attribution, operations, and the snapshot bytes | three-way reconciliation |
| **DMR-023** | `school_branding` | **DBT-003** + **DBT-065** | **the 18-column fusion SPLITS** — Core identity vs public site theme (Stage 15 §45 row 2) | both halves reconcile to the source row |
| **DMR-024** | `cron_job_runs` | **DBT-069** | retain; **the NULL-distinctness defect is corrected by two partial uniques** (Stage 15 §27, DBI-020) | parity; **the one-run-per-day invariant must still hold after the index change** |
| **DMR-025** | `user_permissions` | **DBT-010** | **DECOMPOSE** — becomes authority grants under the Stage 7 chain | **every current grant resolves to an authority and a scope; none is dropped as unmappable without being recorded** |
| **DMR-026** | `user_sessions` | **DBT-075** | **retain unchanged** — its shape is fixed by the session store, not by us (Stage 15 §33) | none needed; **live sessions are a cutover concern, §37, not a migration transform** |
| **DMR-027** | `teacher_profiles` | **DBT-009** `school_memberships` | fold — its `uniqueIndex(user_id, school_id)` is what DBI-003 generalises | **membership parity: no staff member loses a school** |

**TXD-027 · Every DMR entry answers the same five questions before it may run**

```
1  WHERE does the data come from
2  WHAT is the transform
3  HOW is it VERIFIED — counts, sums, hashes, chain continuity
4  WHEN does the OLD PATH STOP WRITING
5  WHEN may the OLD STRUCTURE BE DROPPED   ── never before MIG-14
```

---
---

### 15.1 Invite tokens — DMR-003

**An invite token and a child linking code are DIFFERENT CREDENTIAL CLASSES. The PROPOSED draft
pointed `invites` preservation at the linking-code route. That was wrong, and it is corrected here.**

| | |
|---|---|
| **current** | `invites` |
| **target** | **DBT-011** |
| **target contracts** | **API-008** `GET /api/invites/:token` · **API-009** `POST /api/invites/:token/accept` — **both already exist today at their exact target paths** (§9.1) |
| **who issues one** | a school admin (**CAP-030** staff · **CAP-029** guardian) or the platform (**CAP-083** first admin) |
| **what it grants** | an account, into a named school, at a named authority |

**TXD-030.1 · A live invite is a person's only way in, and it is not silently invalidated**

```
MIGRATION REQUIREMENT — one of two, and the first is PREFERRED

   A · CONTINUE FUNCTIONING until its legitimate expiry
       ── the token, its hash, its expiry and its target authority all
          survive DMR-003 unchanged, and the accept path keeps resolving

   B · SAFELY REPLACED / REISSUED through an explicitly designed and
       COMMUNICATED process
       ── a new token is issued, the guardian or staff member is told,
          and the old one is invalidated ONLY after the new one is sent

PREFER A WHERE TECHNICALLY POSSIBLE.
DO NOT SILENTLY INVALIDATE A LIVE INVITE.

PROOF — its own, separate from the linking-code proof
   an invite issued BEFORE the cutover is accepted AFTER it, in staging,
   end to end, and the resulting account has the right authority in the
   right school                                          B-11 · B-06
```

### 15.2 Child linking codes — DMR-010

| | |
|---|---|
| **current** | `child_linking_codes` |
| **target** | **DBT-022**; `UNIQUE (code_hash)` becomes global and unconditional (Stage 15 §11) |
| **target contracts** | **API-197** `POST /api/family/link-code/preview` · **API-198** `POST /api/family/link-code/confirm` |
| **who issues one** | a school (**CAP-024** issue · **CAP-025** rotate) |
| **what it grants** | **a relationship to ONE named child** — never an account, never a school |

**TXD-030.2 · The legacy one-step path is LRC-203, and C-25 closes when it is gone**

```
LEGACY   POST /api/parent/link-child          ── ONE STEP, LRC-203
TARGET   POST /api/family/link-code/preview   ── API-197, the REQUIRED
         POST /api/family/link-code/confirm      canonical companion to 198

   ── API-197 is not optional decoration.  It is what makes the confirm
      an informed act rather than a blind redemption
   ── LRC-204 and LRC-205 are today's two-step pair; they move by namespace
   ── C-25 REMAINS IMPLEMENTATION-OPEN until LRC-203 is actually removed
      at B-11.  Describing the fix correctly does not close it
```

**TXD-030.3 · The two token classes DO NOT share a TTL or a removal window**

```
FORBIDDEN
   "invite tokens and linking codes both expire in N days, so one window
    covers both"

   ── NO LOCKED OR MEASURED EVIDENCE SAYS THEIR LIFETIMES ARE IDENTICAL
   ── they are issued by different capabilities, they grant different
      things, and they are redeemed on different surfaces

EACH CLASS GETS
   its own measured current lifetime
   its own removal window for the legacy path
   its own end-to-end continuity proof

WHERE A LIFETIME IS A POLICY QUESTION RATHER THAN A MEASURED FACT:
   POLICY INPUT REQUIRED.  It is not guessed here.
```

---

## 16. The target migration chain

**Stage 15's MIG-01 … MIG-14 is the architectural source. This is its conversion into ordered
implementation batches — not into executed migrations.**

**TXD-028 · The chain, with its batch, its properties and its verification**

| MIG | Step | Batch | Transactional | Re-runnable | Verification |
|---|---|---|---|---|---|
| **MIG-01** | install the migration runner; **record `001` as manually applied**; remove `db:push --force` from CI | **B-03** | yes | yes | the runner reports an applied set; `db:push` absent from CI and from the deployment path |
| **MIG-02** | declare extensions — `citext`, `btree_gist` | B-03 | yes | **yes** | extensions present |
| **MIG-03** | **create the 80 new tables, EMPTY, alongside the existing 41** | **B-05** | yes | no | catalogue matches the target declarations — **MIG-T02** |
| **MIG-04** | add `school_id` to the twelve untenanted tables, **nullable** | B-05 | yes | no | columns present, all NULL |
| **MIG-05** | **backfill `school_id` from existing relationships; verify ZERO NULLs** | B-05 | per batch | **resumable** | **zero NULLs, and the count equals the source** |
| **MIG-06** | set those columns `NOT NULL`; add composite foreign keys | B-05 | yes | no | constraint present; no orphan |
| **MIG-07** | **copy data into the new tables** — identity decomposition, branding split, allocation decomposition | **B-06 … B-30**, per domain | per table | **resumable** | **§15's per-DMR verification** |
| **MIG-08** | create the uniqueness register's indexes | with each domain's batch | yes | no | **a failure here is a REAL DATA CONFLICT, resolved by the owner — never by deleting rows** |
| **MIG-09** | create CHECK constraints `NOT VALID`, then `VALIDATE` | with each domain | yes | no | validated, no violation |
| **MIG-10** | **enable RLS, create policies, grant the privilege classes** | **B-07** | yes | no | **§19's tests, under a non-bypassing role** |
| **MIG-11** | **move `media_assets.data_uri` bytes to object storage; write `object_uploads`** | **B-26** | no — batched | **resumable** | **§26's hash/size/type reconciliation** |
| **MIG-12** | **VERIFY** — row-count parity per table, **sum parity on every money column**, custody-chain continuity, zero orphans, **RLS proven with a scoped connection** | **B-33** | n/a | yes | **if any check fails, the sequence STOPS** |
| **MIG-13** | **switch the application to the new tables**; old tables stay in place, readable | **B-33** | n/a | **reversible — revert the application** | the target reads serve; the old tables are untouched |
| **MIG-14** | **after a stated soak and owner approval: drop the deprecated tables and columns** | **B-34** | n/a | **NO — the one irreversible step** | **§39's full gate** |

**TXD-029 · MIG-07 is not one migration and must never be written as one**

```
MIG-07 IS THE DATA COPY FOR TWELVE DOMAINS.
   Writing it as a single file would make identity, money, custody, CMS and
   messaging share one failure, one rollback and one review.
   ── it is SPLIT PER DOMAIN, and each part lands in that domain's batch
   ── each part is INDEPENDENTLY resumable and independently verified
```

**TXD-030 · Every migration file declares four things, and "irreversible" is a legitimate declaration**

```
TRANSACTIONAL?      yes / no — and if no, the failure procedure is written
                    BEFORE it runs
RE-RUNNABLE?        only where designed for it.  IDEMPOTENCY IS NOT REQUIRED
                    OF EVERY MIGRATION — Stage 20 MIG-T03
PRECONDITION        what must be true before
POSTCONDITION       what is true after, and how it is checked
+ ROLLBACK or FORWARD REPAIR, and the release compatibility window

NO `db:push --force`.  NOT IN CI, NOT IN A DEPLOYMENT, NOT AS A SHORTCUT.
                                              C-78 · Stage 21 DEP-D029
```

---

## 17. MIG-000

**TXD-031 · Stage 21's four-class split, applied**

| Class | Content | Where it goes | Batch |
|---|---|---|---|
| **A · APPLICATION SCHEMA** | `CREATE SCHEMA console` and the mirroring views | **the reviewed migration chain**, as ordinary DDL | **B-03** |
| **B · PRIVILEGED PROVISIONING** | `CREATE ROLE`, `GRANT`, `REVOKE`, role attributes, default privileges | **Stage 21's operator provisioning procedure**, per environment | **B-02** — a Stage 21 procedure, executed as a batch precondition |
| **C · CREDENTIAL MATERIAL** | the two `REPLACE_ME` passwords | **the secret mechanism. NEVER a SQL source file** | B-02, generated at provisioning |
| **D · LEGACY** | anything superseded | **removed at B-34** | B-34 |

```
NEVER RESURRECT `REPLACE_ME` INSIDE AN AUTOMATED MIGRATION.
   ── the only ways to automate a file containing a credential placeholder
      are to commit a secret or to template one in, and the second is how
      the first eventually happens                     Stage 21 DEP-D019
```

**TXD-032 · C-19 closes when both halves have landed and SEC-T15 is ACTIVE and green** — not when
either half alone is done.

---

## 18. Identity and authority migration

**TXD-033 · From `users` to Stage 7's chain, without a single forced password reset**

```
CURRENT   users ── person + credential + membership + role strings + a
                   SECONDARY_ROLE:* mechanism, in one row

TARGET    PERSON → ACTIVE CONTEXT → ACTIVE AUTHORITIES → CAPABILITY
                 → RESOURCE → SCOPE → CONDITIONS
          DBT-007 persons · DBT-008 credentials · DBT-009 memberships ·
          DBT-010 authority_grants · DBT-077 credential_tokens
```

**TXD-034 · The Argon2id transition is a rehash-on-login, and the alternative is unacceptable**

```
FOR EACH EXISTING ACCOUNT
   1  the stored hash is bcryptjs                    ── today's state
   2  the person signs in with the CORRECT password
   3  verification succeeds against bcryptjs
   4  THE PASSWORD IS REHASHED TO ARGON2ID, in the same transaction
   5  the next sign-in verifies against Argon2id
   6  the old hash is not recoverable from anywhere

DO NOT force every existing user through a password reset because the hash
algorithm changed.
   ── it is a mass credential-reset email to every guardian and teacher at
      every school, indistinguishable from a phishing campaign, in response
      to an internal engineering change
   ── Stage 20 SEC-T's Argon2 test is written FROM THE BCRYPT STATE for
      exactly this reason
```

**TXD-035 · What else the identity batch must carry**

| | |
|---|---|
| **session invalidation** | **on privilege change**, and at the authority cutover. Sessions live in `DBT-075` and survive a deploy — so the switch must invalidate deliberately, not hope |
| **`persons.authority_version`** | A15-001's column — **it is what makes an authority change take effect on a live session** |
| **MFA migration** | secrets move to the target handling (**C-21**); enrolment gains the password check (**C-90 · CSR-038**); the hand-rolled TOTP is replaced (CSR-037) |
| **recovery codes** | re-issued into the target model, **single-use under concurrency** (SEC-T04) |
| **invite and reset tokens** | **live tokens must keep working** across the switch — DBT-077 is created at MIG-03 and both paths accept during the window |
| **`SECONDARY_ROLE:*`** | **C-23** — replaced by real contexts. The validation at `auth.routes.ts:299` is KEPT; the string mechanism is not |

**TXD-036 · No current credential value appears in any document, register or log produced by this
migration.** Hashes, secrets and tokens are migrated by reference and by transform. **They are never
exported, printed or reconciled by value.**

---

## 19. Tenancy and RLS cutover

**TXD-037 · The two windows that must not exist, and the sequence that prevents both**

```
FORBIDDEN WINDOW A   application code EXPECTS RLS, but the policies are ABSENT
                     ── every read returns everything, and nothing errors

FORBIDDEN WINDOW B   policies are ACTIVE, but the runtime does not yet SET the
                     context
                     ── every read returns NOTHING, and the product looks broken

THE SEQUENCE THAT AVOIDS BOTH

  1  TENANT COLUMNS + FKs        MIG-04 … MIG-06.  Additive.  No behaviour change.
  2  THE RUNTIME LEARNS TO SET THE CONTEXT
     ── BEGIN → SET LOCAL → query → COMMIT on every scoped read
     ── WITH NO POLICIES YET, so this changes nothing observable
     ── and the APPLICATION-LEVEL asserts (CSR-001) still enforce scoping
  3  ROLE SEPARATION             DBROLE-1 owns; DBROLE-2 is granted.  Stage 21 §10.
  4  ENABLE RLS + POLICIES + FORCE RLS       MIG-10
     ── the context is ALREADY being set, so the policies bite on a runtime
        that is already speaking to them
  5  VERIFY under a NON-BYPASSING role       §36's TEN-T · RLS suites
  6  the application asserts REMAIN — two layers, not one
```

**TXD-038 · The application-level asserts are not removed when RLS lands**

```
CSR-001's four asserts and Stage 15's RLS are TWO MECHANISMS, and they fail
differently:
   an assert is bypassed by a new call site that forgets it
   a policy is bypassed by an ownership mistake or a dropped FORCE

KEEPING BOTH IS THE SAME REASONING STAGE 19 USED FOR AUDIT IMMUTABILITY
AND STAGE 21 USED FOR TABLE OWNERSHIP.
```

**TXD-039 · Stage 20's TEN-T and RLS suites activate WITH MIG-10's batch, red first.**

---

## 20. School, academic, family and child

**TXD-040 · The lowest-risk domain, and therefore the one that proves the machinery**

```
WHY THIS DOMAIN GOES FIRST AMONG THE DOMAINS
   ── it has the most current behaviour that is simply CORRECT
   ── its migrations are retain-and-decompose, not remodel
   ── it exercises: MIG-07's per-domain copy · the module boundary ·
      the capability model · RLS · the audit event
   ── if the machinery is wrong, it is wrong HERE, where the blast radius
      is smallest and the reconciliation is simplest
```

| | |
|---|---|
| **schools** | DMR-001 — plus DBT-002 lifecycle, with **`UNKNOWN` where history cannot be derived** |
| **academic periods** | `shared/academic-year.ts` (CSR-055) + `migrations/003` — **already target-shaped** |
| **classes, subjects, staffing** | DMR-006. `getTeacherClassIds` (CSR-020) is the canonical lookup and stays |
| **children** | DMR-007 — **count parity is a child-record count, and it is checked before and after** |
| **families and guardians** | **DMR-009 — the one that needs care.** Two relationship tables become one model; **the check is that no child loses a guardian and no guardian loses a child** |
| **linking codes** | DMR-010 — **live codes keep working**; the two-step path becomes the only path (**C-25**, LRC-004) |

---

## 21. Enrolment import migration

**TXD-041 · Two pipelines, confirmed by evidence, and one survives**

```
PIPELINE 1   family-enrollment.routes.ts     21 handlers
             /api/families/enroll/import/fields · /template
             /api/families/enroll/import/ANALYZE   →  /COMMIT

PIPELINE 2   student.routes.ts
             /api/students/import/PREVIEW          →  /CONFIRM

── DIFFERENT validation.  DIFFERENT preview semantics.  DIFFERENT
   transactional guarantees.  THAT IS C-26.
```

**TXD-041.1 · The exact target contracts. No "surviving preview" without an API identifier.**

**Locked Stage 14 §30 — API-164 … API-171.** Both current pipelines map into the same eight contracts.

| Target | Method · Path | What it is |
|---|---|---|
| **API-164** | `GET /api/school/imports/enrolment/template` | the template download |
| **API-165** | `GET /api/school/imports/enrolment/fields` | the field catalogue |
| **API-166** | `POST /api/school/imports/enrolment` | **CREATE / ANALYSE** — `201 {importId}`, or **`202`** for a large file |
| **API-167** | `GET /api/school/imports/enrolment/:importId` | import state |
| **API-168** | `PUT /api/school/imports/enrolment/:importId/mapping` | column mapping |
| **API-169** | `GET /api/school/imports/enrolment/:importId/preview` | **PREVIEW** — validated rows · per-row errors · **the classes that would be created** |
| **API-170** | `POST /api/school/imports/enrolment/:importId/commit` | **COMMIT** — explicit · `Idempotency-Key` |
| **API-171** | `GET /api/school/imports/enrolment/:importId/result` | the result |

**The current → target mapping, exactly:**

| Current | LRC | Target |
|---|---|---|
| `GET /api/families/enroll/import/template` | LRC-053 | **API-164** |
| `GET /api/families/enroll/import/fields` | LRC-052 | **API-165** |
| `POST /api/families/enroll/import/analyze` | LRC-172 | **API-166** — and the preview is then **read at API-169** |
| `POST /api/families/enroll/import/commit` | LRC-173 | **API-170** |
| `POST /api/students/import/preview` | LRC-223 | **API-166**, then **API-169**. **Preview is not a create; the create is what produces the importId the preview is read from** |
| `POST /api/students/import/confirm` | LRC-222 | **API-170** |

```
THE COMMIT IS API-170.        POST …/:importId/commit
THE RESULT IS API-171.        GET  …/:importId/result

── Stage 14's §30 PROSE says "the commit (API-171)".  ITS OWN AUTHORITATIVE
   ENDPOINT TABLE says API-170, and the table is correct.
   That is a locked internal TYPO, corrected traceably as A14-002 — §10.3.
   THE ENDPOINT CATALOGUE IS NOT ALTERED.
```

**TXD-042 · Pipeline 1 is the surviving base, and pipeline 2's useful logic is salvaged into it**

| | |
|---|---|
| **why pipeline 1** | it already handles **families and guardians**, which is the harder half — and the locked target (CAP-027 students-only, CAP-028 students-and-families) requires **both modes through one engine** with identical identity, duplicate, transaction and invitation rules (BR-094) |
| **what pipeline 2 contributes** | its **validation functions** and its **preview presentation**, where they are better. `students-only` becomes a MODE of the surviving engine, not a second engine |
| **what disappears** | **the second commit path** — `POST /api/students/import/confirm`, LRC-222. LRC-222 and LRC-223 bridge it; **B-24 removes both**, after B-22 has proved the surviving engine on **both modes** |
| **what must not happen** | **no second permanent import engine.** One engine, two modes |

**TXD-042.1 · Stage 22 selects which IMPLEMENTATION survives. NO PARSER IS RESELECTED HERE.**

```
LOCKED, STAGE 11, TD-038 — AND IT IS NOT REOPENED HERE

   KEEP SHEETJS
   UPGRADE TO 0.20.3 OR LATER
   VENDOR THE OFFICIAL DISTRIBUTION       ── not the terminal npm release
   SERVER-SIDE ONLY

   plus TD-038's guards: size caps · NO FORMULA EVALUATION

WHAT STAGE 22 DECIDES        which current import implementation
                             contributes its logic          ── TXD-042

WHAT STAGE 22 DOES NOT DECIDE
   the parser.  ExcelJS, node-xlsx, a service, or any other library MAY
   NOT be introduced here.  That would need a STAGE 11 AMENDMENT, and
   none is raised

THE PROPOSED DRAFT SAID DEP-C009 "selects a maintained parser".
   That reopened a locked decision by wording.  CORRECTED — DEP-C009 now
   states the vendored-distribution target, and nothing else

WHAT IS REMOVED     client-side workbook parsing        ── C-58, TR-001
WHAT IS KEPT        the server-side spreadsheet capability
```

**TR-010 is carried, not solved by vendoring:** a vendored SheetJS will not appear in `npm audit`.
Stage 11's mitigation — **an explicit pinned version, a recorded review cadence and a named owner** —
is a **B-22 deliverable**, not a note.

**TXD-043 · The target commit behaviour is A4-001's, and the tests are written to it**

```
A · PREVIEW / VALIDATION — a WORKFLOW rule
      preview writes NO product truth
      unresolved invalid rows ⇒ normal commit NOT AVAILABLE
      ── unless the administrator uses the locked EXPLICIT ROW-EXCLUSION
         workflow, in which case the remainder commits            WF-021

B · COMMIT — a DATABASE rule                        OPS-D021 · A4-001
      EACH LOGICAL ROW IS ONE TRANSACTION
         child + family/guardian relation + class membership +
         requirements + required dependent facts
         ── ALL COMMIT OR NONE, for that row
      ACROSS rows: row 1 commits · row 2 commits · row 3 fails
         ── and rows 1 and 2 REMAIN COMMITTED
      DURABLE PROGRESS on the import session, after each row
      RESUME does not duplicate a committed row                   OPS-D022
      A CHUNK is a batching unit, NOT a rollback unit

AND: invitations are sent AFTER the commit; a mail failure loses no import
                                                                  BR-096
```

**TXD-044 · Workbook parsing moves server-side in this batch, and that is not a tidy-up**

```
`xlsx@0.18.5` IS IMPORTED CLIENT-SIDE in admin/students.tsx.
   ── it is the terminal npm release, predating two CVE fixes         C-58
   ── SO A KNOWN-VULNERABLE PARSER IS IN THE BROWSER BUNDLE, parsing a
      file the user just chose
   ── moving parsing server-side is REQUIRED by Stage 18's streamed,
      bounded parse anyway (OPS-D020), and it removes the browser exposure
      as a consequence rather than as a separate task
```

---

## 22. Catalogue, stock and cycles

**TXD-045 · Mostly MOVE, and the arithmetic is not retyped**

| | |
|---|---|
| **books, copies, levels** | DMR-008 — CSR-003's 17 methods move to MOD-005. **Level rules and bundle composition are proven; they are relocated, not rewritten** (TXP-4) |
| **stock** | DMR-015 — `book_inventory_transactions` becomes `stock_movements` **plus a projection**, and the projection must recompute to the stored value |
| **supply cycles and requirements** | DMR-011 — **a genuine remodel.** `child_book_baskets` + `basket_items` become cycles, requirement items and lines. **Money lines reconcile to source** |
| **the stock projection** | it is a **conditional UPDATE inside I-2** (§23), not a trigger and not a recompute-on-read |

---

## 23. Finance and I-2 — the highest-risk batch

**TXD-046 · I-2 does not migrate piecemeal, and this is the strongest instruction in the document**

```
THE TARGET MUST PROVE, IN ONE POSTGRESQL TRANSACTION, ONE COMMIT:

   settlement_reviews      the decision
   allocations             the allocation
   stock_movements         the movement
   stock_levels            the projection — conditional UPDATE
   notifications           the required notification FACT      MOD-009
   audit_events            the required audit FACT             MOD-013
                           AET-035 · CLASS A

   NO provider call · NO email · NO Sentry · NO log sink inside it
```

**TXD-047 · What must be ACTIVE and GREEN before the old finance path may be removed**

```
INV-T01 … INV-T04      I-2 commits together · rolls back completely,
                       asserted SIX TIMES, one per write
                       · DBI-014 refuses the second confirmation
                       · DBI-034 does NOT stop a business act
TEN-T · RLS            the finance surface under a non-bypassing role
AUDIT ROLLBACK         audit insert fails ⇒ THE SETTLEMENT DOES NOT COMMIT
                       AND Sentry / log / email failures ⇒ IT DOES commit
CONCURRENCY            two simultaneous confirmations; exactly one succeeds

ONLY THEN is the old path eligible for removal.                     TXP-2
```

**TXD-048 · A provider callback never becomes a confirmation**

```
A CALLBACK IS EVIDENCE THAT A PROVIDER SAYS SOMETHING HAPPENED.
A CONFIRMATION IS A HUMAN EXERCISING AUTH-FINANCE UNDER CAP-049.

   provider_events (DBT-041)   ── the callback's bounded record
   reconciliation              ── matching, CAP-056
   settlement_reviews          ── THE DECISION, by a person

CSR-042 replaces the current reconstruction path.  The separation is not
new — it is Stage 6's — and the migration must not quietly collapse it
while moving the code.
```

**TXD-049 · CSR-002's atomic claim pattern is the seed, not a casualty.** `confirmPayment`'s
conditional `UPDATE … WHERE status NOT IN (…) RETURNING *` is the correct claim; **I-2 expands around
it.**

---

## 24. Fulfilment and custody

**TXD-050 · The state machine is kept; the boundaries move**

| | |
|---|---|
| **`server/custody.ts`** | **CSR-015 — KEEP.** Pure, deterministic, unit-tested. The one place where a rewrite would be pure risk |
| **allocations / custody / distribution** | **DMR-013 — the three status domains SPLIT**, and `migrations/006` already keeps them distinct, which is what makes the split tractable |
| **hand-over and reception** | CAP-063 / CAP-064; **DBT-047 handover_events** |
| **replacements** | DMR-016 — request / review / charge decision decomposed |
| **domain history vs audit** | **`stock_movements`, `custody_events`, `money_events` and `handover_events` are DOMAIN HISTORY. They are NOT merged into audit** — AUD-D055 |

**TXD-051 · The own-child teacher block is tested before the old hand-over path is removed.** A
teacher must not record a hand-over to their own child without the locked exception path — **and that
test activates with this batch, not after it.**

---

### 24.1 DMR-013 — what the source PROVES, and what it does not

**The target has six fulfilment-side facts. The current source has one table with three fused status
columns. Those are not the same amount of information, and the migration must say so.**

| Target | What it is | Can DMR-013 derive it from `finance_book_allocations`? |
|---|---|---|
| **DBT-044** `allocations` | the allocation itself | **YES** — it is the row |
| **DBT-045** `custody_events` | the custody chain | **ONLY where `custody_events` already exists** — and that is **DMR-014**, migrated independently, which remains **the authoritative historical evidence wherever it is present** |
| **DBT-046** `fulfilment_exceptions` | absent · out-of-stock · issue | **PARTIALLY** — the legacy status proves that an exception state was reached; **it does not prove the cause, the actor or the time** |
| **DBT-047** `handover_events` | who handed over, to whom, when | **RARELY** — a status of "distributed" proves a state, **not a hand-over event with an actor and a timestamp** |
| **DBT-048** `fulfilment_instructions` | the route chosen | **NO** — the legacy model has no route |
| **DBT-025** `stock_movements` | the stock effect | **NO, NOT FROM HERE** — §24.2 |

**TXD-050.1 · A migration must not invent history. This is not a style preference.**

```
NEVER FABRICATED, FOR ANY REASON, INCLUDING "NOT NULL"

   a hand-over ACTOR            a CUSTODY HOLDER
   an occurred_at TIMESTAMP     a CUSTODY TRANSITION
   an exception CAUSE           a FULFILMENT ROUTE
   a STOCK MOVEMENT

   ── "person = SYSTEM" to satisfy a NOT NULL actor column is a FABRICATION
   ── now() at migration time as occurred_at is a FABRICATION
   ── inferring "the teacher of the class" as the hand-over actor is a
      FABRICATION.  A class has had more than one teacher

WHAT IS PERMITTED
   DERIVE ONLY WHAT THE SOURCE PROVES.
   Where the target requires information that NEVER EXISTED, record an
   explicit LEGACY / UNKNOWN / MIGRATED PROVENANCE marker
   ── AND ONLY IF THE LOCKED SCHEMA SUPPORTS SUCH A REPRESENTATION

IF THE LOCKED TARGET SCHEMA CANNOT HONESTLY REPRESENT THE HISTORICAL FACT
WITHOUT FAKE VALUES:
      STOP.
      RAISE A TRACEABLE STAGE 15 AMENDMENT.
      DO NOT INSERT A FABRICATED VALUE TO GET PAST A CONSTRAINT.

   ── this is a HARD STOP inside B-21, not a judgement call for whoever is
      writing the migration that day
```

**TXD-050.2 · `custody_events` wins wherever it exists.** DMR-014 is migrated **independently** and is
**append-only, and it stays that way**. Where a legacy status and a real `custody_events` row disagree,
**the event record is the evidence and the status is the derivative** — that is exactly what
`deriveCustodyFromLegacy` (CSR-015) already encodes, and it is KEPT.

### 24.2 Stock — the rule that prevents a double deduction

```
BEFORE ANY DBT-025 stock_movement IS GENERATED FROM A LEGACY STATUS:

   1  RECONCILE finance_book_allocations' legacy statuses
      AGAINST book_inventory_transactions

   2  THE AUTHORITATIVE HISTORICAL TRANSACTION RECORD WINS WHEREVER
      EVIDENCE EXISTS
      ── book_inventory_transactions IS the stock history.  A status
         column is not a second stock history

   3  A movement is generated from a status ONLY where NO transaction
      covers it, and each such movement is marked LEGACY-DERIVED

   4  NEVER DOUBLE-DEDUCT.
      ── sum parity, per book, per school, before and after
      ── and the DBT-026 projection must recompute to the stored value

A DOUBLE DEDUCTION IS NOT A ROUNDING ERROR.  It is a school being told it
has fewer books than it has, on distribution day.
```

### 24.3 The DMR-013 · 014 · 015 verification set

| Check | Applies to | Passes when |
|---|---|---|
| **allocation parity** | DMR-013 | row counts and per-domain status counts reconcile |
| **custody chain continuity** | DMR-014 | **every chain is continuous** — not merely the same length |
| **handover parity** | DMR-013 | **counts match WHERE SOURCE EVIDENCE EXISTS**; absence is recorded, not filled |
| **exception parity** | DMR-013 | as above — cause is `UNKNOWN` where the source never had one |
| **stock sum parity** | DMR-015 | per book, per school, before = after |
| **no double movement** | DMR-015 | §24.2's reconciliation returns zero duplicates |
| **no fabricated actor** | all three | a query for actor values not present in the source returns **zero rows** |
| **no fabricated timestamp** | all three | a query for `occurred_at` equal to the migration run window returns **zero rows** |
| **no orphan target event** | all three | every target event resolves to a source fact or a `LEGACY` provenance marker |

**All nine run before B-33's read-switch, and all nine run again at MIG-12.**

---

## 25. Notifications and email

**TXD-052 · The fact and the delivery are separated first; the provider is changed second**

```
STEP 1   SEPARATE                                    ── before any provider work
   notifications (DBT-053)     THE FACT — written inside I-2's transaction
   delivery_attempts (DBT-054) THE ATTEMPT — outside it, retried, observed
   ── the current code sends as the notification.  Splitting is a
      REFACTOR, and it is what makes step 2 safe

STEP 2   CUT OVER THE PROVIDER                              Resend → SES
   ONE ACTIVE SENDER AT A TIME.  NEVER DUAL-SEND.
   ── a parent receiving two identical invitations is a support incident
      and a trust problem, not redundancy
```

**TXD-053 · The seven cutover inputs, each verifiable before the switch** — Stage 21 DEP-D060:
staging verification · template parity · delivery-event parity · bounce/complaint parity (**a bounce
suppresses an ADDRESS; it does not mark an identity unverified**) · sender-identity parity
(`"<School> via ScholarShelf"`, INTQ-2 = C) · environment secrets present · **a rollback route that
needs no deploy**.

**TXD-054 · Resend is removed at B-32, and not before.** DEP-C010 · **CBR-011**. **The rollback to Resend
exists until SES's removal gate passes** — then the code, the dependency and the configuration all go
together.

---

## 26. Object storage and scanning

**TXD-055 · Eleven ordered steps, and no unscanned object becomes reachable at any point**

```
 1  TARGET METADATA EXISTS            DBT-071 object_uploads, at MIG-03
 2  S3 STAGING VERIFIED               buckets, BPA, versioning, encryption
                                                              PFL-009
 3  GUARDDUTY EICAR GATE PASSES       clean object scans clean; EICAR is
                                      flagged; PENDING is unreadable by
                                      EVERY reader class     PFL-010 · REL-G010
 4  UPLOAD TARGET PATH BUILT          write to S3 + object_uploads
 5  NEW UPLOADS WRITE S3              old reads still serve base64
 6  EXISTING MEDIA COPIED             MIG-11, batched and resumable
 7  RECONCILE                         HASH · SIZE · CONTENT-TYPE, per object
 8  SCAN STATE OBTAINED               where the class requires it
 9  READS SWITCHED                    CBR-010's switch batch
10  PUBLIC PUBLISHED COPIES CREATED   into the separate public bucket,
                                      published-only               Stage 21's §22.1
11  SOURCE BYTES REMOVED              ONLY after 7 and 9 verify — at B-34

IF STEP 3 FAILS: PRV-005 returns to SELECT-CONDITIONAL AND THIS ENTIRE
MIGRATION IS BLOCKED.                        Stage 21 DEP-D054 · REL-G010
```

**TXD-056 · `media_assets.data_uri` is dropped at MIG-14, not at step 11's copy.** The bytes are
copied, verified, read-switched and soaked; **the column dies with the deprecated schema, under the
same gate as everything else.**

---

## 27. CMS and the public website

**TXD-057 · Publication is atomic, and the public path is the only public thing**

| | |
|---|---|
| **the CMS remodel** | DMR-018 — `school_website_sections` becomes DBT-058 … DBT-066 |
| **publication** | **the revision pointer moves in ONE transaction with its audit event** — AET-051, Class A |
| **entitlement** | a school without the CMS entitlement has no CMS surface — MA-2 |
| **domain resolution** | an unrecognised host **resolves to nothing we serve**; it never falls back to a default tenant — Stage 21 DEP-D078 |
| **public objects** | only **verified + published + public-CMS** copies reach the public bucket — Stage 21's §22.1 |
| **screens** | `admin/branding` + `admin/media-library` + `admin/website` **MERGE** into Website Studio — SCR-C's merge class |

---

## 28. Platform, support and break-glass

**TXD-058 · The console's controls survive; its provisioning and its snapshots do not travel with it**

| | |
|---|---|
| **the five DB-level controls** | CSR-023 — **KEEP the intent**: view schema, `BEGIN READ ONLY`, extended protocol, credential-excluding views, always ROLLBACK |
| **provisioning** | **MIG-000 class B — Stage 21's procedure, at B-02.** Not a migration |
| **support engagements** | DBT-067, DBI-024 — **one engagement per platform actor, across all tenants** |
| **break-glass** | elevation is **AET-030, and there is no elevation table** — Stage 19 AUD-D058. `elevation_event_id` self-references the granting event |
| **the screens** | `it-dashboard` + `system-health` + `db-console` **MERGE** into UX-095 / UX-096 / UX-099 — SCR-C026 … C028 |
| **`admin/owner.tsx`** | **SCR-C029 · MERGE into the platform surfaces.** **Stage 12 (C-44) maps this 1,208-line file into the platform band — it is relocated into the console, not deleted as lost work**, and §40 proves the old route dead before the file goes |

---

## 29. Audit migration

**TXD-059 · Three stores into one event table, plus one operations table — and nothing is invented**

```
audit_logs           ──┐
message_audit_logs   ──┼──►  DBT-079 audit_events        MOD-013 · the evidence
console_audit        ──┘     DBT-080 console_operations  MOD-012 · the operation
   (attribution)             linked 1:0..1 by audit_event_id, UNIQUE  DBI-035
```

**TXD-060 · What the migration must verify, and what it must refuse to fabricate**

| Verified | |
|---|---|
| **actor** | mapped from the source's actor where one exists |
| **scope and school** | **`message_audit_logs` already has `school_id`** — it is the easy one. `audit_logs` has none, so scope is derived where derivable |
| **subject** | where the source recorded one |
| **event taxonomy** | free-text `action` mapped to an **AET stable key** |
| **timestamps** | preserved exactly |

```
WHERE THE SOURCE NEVER CONTAINED THE FIELD:

      UNKNOWN / LEGACY

── NOT a guess.  NOT a default.  NOT the migration's own timestamp
   standing in for an occurrence time.
── an audit trail whose historical rows contain invented facts is worse
   than one with honest gaps, because nothing marks which is which
```

**TXD-061 · Snapshots do not enter `audit_events`.** `beforeSnapshot` / `afterSnapshot` are **§30's**,
and Stage 19 A19-001 governs them. **The attribution columns of `console_audit` migrate; the snapshot
columns do not.**

**TXD-062 · The audit write path switches with a paired bridge (CBR-012), because audit must not have a
gap.** The old path and the new both write during **B-30**; the old is removed at **B-31** once
reconciliation shows no event was lost.

---

## 30. Legacy snapshot quarantine

**TXD-063 · A19-001's six steps, designed — and the mechanism must satisfy all ten Stage 21
requirements or it is not the mechanism**

```
1  INVENTORY      every legacy console row carrying a beforeSnapshot or
                  afterSnapshot value.  Count it before touching it.
2  COPY           the snapshot payloads into a deliberately restricted
                  quarantine / archive structure
3  PROVENANCE     source row identity, the operation, the timestamp —
                  enough that the copy MEANS something later
4  RECONCILE      counts AND per-object hashes, source to target
5  REMOVE REACH   ordinary application access becomes impossible
6  PROVE FIRST    the quarantine exists and reconciles BEFORE console_audit
                  becomes drop-eligible

CANDIDATE MECHANISM   a SEPARATE, LOCKED S3 QUARANTINE BUCKET
   ── acceptable ONLY if it satisfies every one of Stage 21 §46's ten
      requirements: not app-accessible · not console-readable · encrypted ·
      a restricted operator role · ACCESS LOGGED · no public exposure ·
      not in audit search · not in any export · BACKED UP with the same
      restrictions · and an approved destruction path that exists later
   ── A SEPARATE BUCKET, NOT A PREFIX                   Stage 21 DEP-D119
```

**TXD-064 · Final destruction is NOT authorised by this document, by MIG-14, or by any pipeline**

```
FINAL SNAPSHOT DESTRUCTION        APPROVED LEGAL / PRIVACY POLICY REQUIRED

── A19-001 chose QUARANTINE AND PRESERVE PENDING POLICY.
── MIG-14 may drop the SOURCE TABLE once preservation is proven.
── IT MAY NOT DESTROY THE QUARANTINED BYTES.
── no retention period is invented here.                        AUD-P22
```

---
---

## 31. Provider cutovers

**TXD-065 · Five cutovers, each with the same rule: replacement proven, consumers switched, rollback
window completed, only then removal**

| Cutover | From | To | Removal gate |
|---|---|---|---|
| **compute region** | `iad1` (platform default) | **`lhr1` London** — DEPQ-1 = A | PFL-002 confirms `lhr1` is set **and is the only execution region** |
| **database region** | **UNVERIFIED** | **`eu-west-2`** — DEPQ-1 = A | **§32 — conditional** |
| **email** | Resend | **SES `eu-west-2`** | §25's seven inputs, then DEP-C010's removal at **B-32** |
| **objects** | database base64 | **S3 `eu-west-2`** | §26's eleven steps, source bytes dropped at MIG-14 |
| **telemetry** | none / current | **Sentry EU org** | **the region is chosen BEFORE the org exists** — E-13, PFL-013 |

**TXD-066 · The `lhr1` cutover is a redeploy, and it is the cheapest item in this document**

```
   set the production project's function region to lhr1
   redeploy
   verify PFL-002
   ── no data moves.  No schema changes.  It is a configuration change and
      a deploy, and it closes the COMPUTE half of C-63.

   AND IT IS NOT SUFFICIENT ON ITS OWN.  C-63 has two halves, and §32 is
   the other one.
```

**TXD-067 · The `www` → `app` origin transition is user-visible and belongs to Stage 22**

```
TODAY   the product is at www.scholarshelf.co.uk
TARGET  the authenticated app is at app.scholarshelf.co.uk    DEPQ-2 = A
        root and www are NOT auth authorities                  DEP-D147

THE TRANSITION MUST NOT
   ── leave two hosts able to mint or receive a session
   ── break a bookmark, a saved password or a link in an inbox

SEQUENCE
   1  app.scholarshelf.co.uk is provisioned, TLS issued, and serves
   2  the canonical origin config switches to it — generated links change
      FIRST, so new links are correct before old ones stop working
   3  www redirects to app                     ── one authority, one host
   4  __Host- cookie scoping makes a second authority impossible   §31
   5  SOAK — bookmarks, saved credentials, email links in the wild
   ── the old links keep working through the redirect; nothing is broken
      by the switch itself
```

---

## 32. The conditional Neon region migration

**TXD-068 · Do NOT assume the region is wrong. Design the path, and run it only if PFL-004 says so**

```
PFL-004 ASKS   is the production Neon project already in eu-west-2?

IF YES    ── no migration.  This section does not execute.
             C-63's database half closes on verification alone.

IF NO     ── E-9: "You cannot change the region for an existing project."
             A REGION CHANGE IS A PROJECT MIGRATION, and it becomes a
             DEPLOYMENT BLOCKER and a Stage 22 batch.
```

**TXD-069 · The conditional path, if it is needed**

```
 1  CREATE the target project in eu-west-2                  Stage 21 §9
 2  APPLY the migration chain to it                         §16
 3  PROVISION the six roles, MIG-000 class B                §17
 4  COPY the data                                           bulk, verified
 5  DELTA / CUTOVER STRATEGY  ── this is where MIGQ-1 bites (§41)
       Option A  a short read-only window: quiesce writes, copy the delta,
                 switch, verify, resume
       Option B  logical replication or dual-write to close the gap live
 6  VERIFY      MIG-12's full parity suite against the NEW project
 7  SWITCH the connection strings                           SECENV-002
 8  ROLLBACK CONSTRAINT: once writes land in the new project, rolling back
    means migrating BACK.  The rollback window is BEFORE step 7, not after.
 9  RETIRE the old project — only after a soak, and never on cutover day
```

**TXD-070 · A region migration and the ordinary target migration are not run in the same step.** Doing
both at once means a failure cannot be attributed to either. **If §32 executes, it executes against a
schema that has already been proven elsewhere.**

---

## 33. Compatibility mechanisms and cutover flags

**TXD-071 · Four flags. Not five, and not a platform.**

| Flag | Purpose | Default | Introduced | Removed |
|---|---|---|---|---|
| **`TARGET_AUTHORITY_PATH`** | the Stage 7 capability model cannot land atomically across 243 handlers | **off** | **B-08** | **B-12** |
| **`TARGET_API_PATH`** | the decomposed read/write path — MIG-13 is a switch | **off** | **B-19** | **B-33** |
| **`TARGET_EMAIL_PROVIDER`** | Resend ↔ SES, switchable **without a deploy** | **Resend** | **B-24** | **B-32** |
| **`TARGET_OBJECT_STORAGE`** | reads move only after the copy verifies | **off** | **B-26** | **B-33** |

**TXD-072 · The six rules that keep them temporary**

```
SERVER-CONTROLLED       configuration, never a request parameter
ENVIRONMENT VALIDATED   an unknown value FAILS TO BOOT        Stage 21 §20
AUDITABLE               flipping one for a tenant is a consequential act,
                        and Stage 19's taxonomy decides its AET
NEVER SECURITY AUTHORITY   a flag chooses an IMPLEMENTATION.  A capability
                        decides whether a person MAY act.  A flag must never
                        be the thing that grants access
NEVER USER-CONTROLLABLE not a query parameter, not a header, not a cookie
BORN WITH ITS REMOVAL BATCH — the table above has no empty cell

AT FINAL TARGET: temporary cutover flags = 0.
   ── unless a real PRODUCT feature flag was separately locked, and none was
```

**TXD-073 · No generic feature-flag platform is built.** Four server-read configuration values with a
validated vocabulary. **A platform would outlive the migration, which is precisely what §40 forbids.**

---

## 34. Dual-read and dual-write policy

**TXD-074 · Avoid both. Where dual-write is unavoidable, one side is authoritative and the other is a
copy**

```
FORBIDDEN, ABSOLUTELY
   dual-write between two EQUAL authorities for
      SETTLEMENT TRUTH · STOCK TRUTH · CUSTODY TRUTH
   ── two authorities disagreeing about a child's record is not a
      migration state; it is two products

PERMITTED, NARROWLY
   ONE PRIMARY  +  ONE MIGRATION COPY
   ── the copy is written for verification and for read-switch readiness
   ── it is never read as truth while it is a copy
```

**TXD-075 · Every dual-write carries three things or it does not start**

```
COMPARISON        a scheduled reconciliation of primary vs copy
DRIFT ALERT       divergence is an ALERT, not a metric nobody reads
EXPIRY / REMOVAL BATCH   named when the dual-write is introduced

WHERE DUAL-WRITE IS USED IN THIS PLAN
   MIG-07's per-domain copy windows          ── primary: the OLD tables
   §26's object storage, steps 5–9           ── primary: the DATABASE bytes
   §29's audit, during B-30                  ── primary: the OLD path
   ── in every case the OLD side is primary until the read-switch, and the
      switch is what changes which one is truth
```

---

## 35. Implementation batch register — IMP-B01 … IMP-B35 (referenced throughout as **B-01 … B-35**)

**Thirty-five batches. Every one names its goal in a sentence, and none of them says "refactor the
backend."**

**TXD-085.1 · Why the register grew from 29 to 35, and it was not a preference**

```
REBUILDING THE ROUTE REGISTER (§10) EXPOSED THE GAP MECHANICALLY:
   234 legacy routes, each needing a build batch and a removal batch
   ── and SIX target domains had NO BATCH AT ALL

   fulfilment / custody / hand-over    API-137 … API-154   ── DMR-013 · DMR-014
   messaging                           API-155 … API-159 · 188 … 192
   family portal surfaces              API-177 … API-198
   CMS / Website Studio + public site  API-199 … API-233   ── DMR-018
   platform / support / break-glass    API-234 … API-277
   reporting and projections           API-172 … API-176 · API-129

   ── the 29-batch register could not have satisfied "every LRC has a
      removal gate", and the gap was invisible while §10 held nine rows
      standing in for 234

STAGE 22 WAS PROPOSED WHEN THIS WAS FOUND.  The register is RECOMPUTED,
not patched.  B-01 … B-20 keep their numbers and their meaning.
```

| Batch | Goal | Locked stages | DB | Tests activated | Removal gate |
|---|---|---|---|---|---|
| **B-01** | **Baseline freeze** — locks resolved, native suites run, results recorded, branch pushed, tag created | — | none | none — **the baseline IS the evidence** | — |
| **B-02** | **Environment provisioning** — two AWS accounts, OIDC trust, six DB roles, MIG-000 class B, secret store | 21 | roles only | PFL-007 · PFL-008 · PFL-021 | — |
| **B-03** | **Migration runner + the gate**; `db:push` out of CI and the deployment path; MIG-01, MIG-02, MIG-000 class A | 15 · 21 | MIG-01/02 | MIG-T01 · MIG-T02 | **C-78's remedy lands · CBR-015 removed** |
| **B-04** | **Test infrastructure + CI shape** — Vitest, Playwright, axe pinned; four-stage pipeline; Node one-authority assertion; **API-283 built, `vercel.json` switched** | 20 · 21 | none | unit · smoke · the activation register | LRC-048 / LRC-162's replacement |
| **B-05** | **Target schema, empty** — MIG-03 … MIG-06, tenant columns backfilled, zero NULLs proved | 15 | MIG-03…06 | MIG-T02 · MIG-T08 | — |
| **B-06** | **Identity model** — persons, credentials, memberships; Argon2id rehash-on-login. **DMR-002, the highest-risk transform** | 7 · 16 | MIG-07 identity | SEC-T Argon2 · identity suite | **CBR-002 · CBR-004 · CBR-006 introduced** |
| **B-07** | **RLS and roles** — MIG-10, FORCE RLS, ownership separation, the SET LOCAL read path | 15 · 16 · 21 | MIG-10 | **TEN-T · RLS, non-bypassing** | **forbidden windows A and B avoided** — §19 |
| **B-08** | **Capability enforcement** — CAP-001 … CAP-095 replace role strings, behind `TARGET_AUTHORITY_PATH` | 7 | — | **TST-D034** — a role string must not satisfy a capability check | **CBR-001 introduced** |
| **B-09** | **MFA, sessions, recovery, tokens** — C-90, C-21, SEC-T03 red→green inside this batch. **The MFA PATH COLLISION is sequenced here** — §9.1 | 16 | MIG-07 credentials | SEC-T02 … SEC-T09 | **CBR-003 · CBR-014 removed** |
| **B-10** | **Env boundary + readiness** — eleven variables inside the schema, `/live` and `/ready`, TLS enforcement sequenced | 21 | none | env-validation suite | — |
| **B-11** | **Linking codes and invitations** — two-step only. **Invite tokens and linking codes are SEPARATE token classes** — §15.1 | 5 · 7 | MIG-07 | linking suite · invite-continuity suite | **6 LRC rows removed** — incl. LRC-203 `parent/link-child`, **C-25's last old path** |
| **B-12** | **Authority cutover complete** — `TARGET_AUTHORITY_PATH` deleted, bcryptjs removed | 7 · 16 | — | full SEC-T | **CBR-001 · CBR-002 · CBR-005 removed · DEP-C007 removed · 11 LRC rows removed** |
| **B-13** | **School, academic periods, classes, staffing** | 4 · 6 · 8 | MIG-07 school | domain suite | — |
| **B-14** | **Children** | 6 | MIG-07 children | **child count parity** | — |
| **B-15** | **Families and guardians** — DMR-009's relationship remodel | 6 | MIG-07 family | **relationship parity — no child loses a guardian** | — |
| **B-16** | **Catalogue, books, levels, copies** | 6 | MIG-07 catalogue | catalogue suite | — |
| **B-17** | **Stock movements + projection** | 6 · 18 | MIG-07 stock | **INV-T05 — projection recomputes** | — |
| **B-18** | **Supply cycles and requirements** — DMR-011's remodel | 6 | MIG-07 cycles | cycle suite | — |
| **B-19** | **Money events, applications, provider records** — the decomposition, behind `TARGET_API_PATH` | 6 · 7 | MIG-07 finance | **SUM PARITY per money column** | **CBR-007 introduced** |
| **B-20** | **I-2** — the six writes, ONE PostgreSQL transaction | 18 · 19 | — | **INV-T01 … INV-T04 · audit rollback · concurrency** | **the old finance path becomes eligible** |
| **B-21** | **Fulfilment, custody and hand-over** — DMR-013's three-domain split, DMR-014's chain, replacements and returns. **`server/custody.ts` is KEPT (CSR-015)**; the own-child teacher block is tested here | 6 · 8 · 18 | MIG-07 custody | **custody-machine · handover · own-child block** | **CBR-008 introduced** |
| **B-22** | **Import engine — one engine, two modes**; **vendored SheetJS 0.20.3+, server-side only (TD-038)**; A4-001's granularity | 4 · 11 · 18 | MIG-07 import | **§21's suite, incl. across-row progress and resume** | the surviving import proved on both modes |
| **B-23** | **Messaging** — school↔family threads, MOD-009; **no message body ever enters audit** (AUD-D055) | 6 · 8 · 19 | MIG-07 messaging | messaging suite · **audit-exclusion assertion** | — |
| **B-24** | **Notifications split + SES cutover** — **the FACT and the DELIVERY ATTEMPT are separated first; the provider is changed second.** One active sender | 17 · 18 | MIG-07 notifications | delivery-parity suite | **CBR-011 introduced · the 6 import LRC rows removed** |
| **B-25** | **Family portal surfaces** — API-177 … API-198 under `/api/family/*`; guardian scope only, **no global selected school** | 6 · 7 · 9 | — | **TEN-T guardian scope** · family suite | — |
| **B-26** | **Object storage** — §26's eleven steps, MIG-11, behind `TARGET_OBJECT_STORAGE` | 17 · 21 | MIG-11 | **§26's reconciliation + PFL-010's EICAR** | **CBR-010 introduced** |
| **B-27** | **CMS / Website Studio + the public site** — DMR-018's decomposition, the revision model, `/api/site/*` PublishedSite (**AQ-1 = B**) | 8 · 11 | MIG-07 CMS | CMS suite · **public/private publication boundary** | — |
| **B-28** | **Platform, support and break-glass** — API-234 … API-277; support engagements, bounded investigation, **elevation is AET-030 and there is no elevation table** | 7 · 12 · 19 | MIG-07 platform | **SEC-T15** · support-scope suite | **arbitrary SQL removed — LRC-187** |
| **B-29** | **Reporting and projections** — MOD-010, API-172 … API-176 and API-129. **MOD-010 owns NO persistence: no `data.ts`, no table, no business truth** | 8 · 10 | — | projection-recompute suite | — |
| **B-30** | **Audit** — DBT-079/080, the taxonomy, Class A/B coupling; paired write during the window | 19 | MIG-07 audit | **audit coupling · taxonomy coverage · CK-A7** | **CBR-012 · CBR-013 introduced** |
| **B-31** | **Audit cutover complete** — old path removed after three-way reconciliation | 19 | — | audit suite | **CBR-012 · CBR-013 removed** |
| **B-32** | **Email cutover complete** — Resend code, dependency and configuration removed | 17 | — | delivery suite | **CBR-011 removed · DEP-C010 removed** |
| **B-33** | **MIG-12 + MIG-13** — full verification, then the application switches to the new tables | 15 | MIG-12/13 | **the entire ACTIVE suite** | **CBR-006 · 007 · 008 · 009 · 010 removed · all four flags removed · 37 LRC rows removed** |
| **B-34** | **Legacy removal** — screens, routes, dependencies, MIG-000 class D; **the snapshot quarantine completes** | all | — | **legacy-zero gates** — §40 | §40 |
| **B-35** | **MIG-14** — the one irreversible step | 15 | MIG-14 | §39's gate | **§39** |

**TXD-076 · The batch register's shape, and why B-01 is not ceremony**

```
35 BATCHES
   B-01 … B-05    FOUNDATION      baseline · provisioning · runner · tests · schema
   B-06 … B-12    IDENTITY        the security rebuild, and it goes early
   B-13 … B-18    DOMAIN          school · children · families · catalogue · stock
   B-19 … B-22    MONEY + FLOW    money · I-2 · custody · import.  I-2 is B-20
                                  and it is the riskiest batch in the plan
   B-23 … B-29    SURFACES        messaging · notifications+SES · family portal
                                  objects · CMS+site · platform · reporting
   B-30 … B-32    AUDIT + EMAIL   audit, its cutover, and the sender's removal
   B-33 … B-35    CUTOVER         switch · legacy removal · MIG-14

B-01 IS NOT CEREMONY.  Without a recorded baseline, every later failure is
arguably a regression, and the argument cannot be settled.        TXD-002
```

---

## 36. Test activation per batch

**TXD-077 · Stage 20's four states, applied to every batch, with no fifth**

```
FOR EACH BATCH
   1  the DEFINED tests relevant to THIS SLICE are selected
   2  DEMONSTRATE RED against the current defect, where one exists
   3  IMPLEMENT
   4  the tests become ACTIVE
   5  GREEN
   6  ONLY THEN merge the batch

NO KNOWN-RED SECURITY TEST MERGES.                  Stage 20 TST-D036 · D093
NO continue-on-error · NO allow_failure · NO skip registry · NO
"expected failures" list.

AT FINAL TARGET: DEFINED target requirements = 0.
   ── the register step prints an empty list, or the cutover is incomplete
```

**TXD-078 · The two named red-first tests, and where each turns green**

| Test | Defect | Red demonstrated in | Green in |
|---|---|---|---|
| **SEC-T03** | MFA enrolment requires no password — **C-90** | **B-09** | **B-09** |
| **SEC-T15** | the console read tier's two bypasses — **C-19** | **B-02** (roles provisioned) + **B-03** (schema half) | **B-03** |

---

## 37. Conflict closure matrix

**TXD-079 · Four kinds of conflict, and only one of them closes by writing code**

```
SPECIFICATION      two locked statements disagree
                   ── closes with a traceable AMENDMENT
CONFIGURATION /    a provider or environment fact must be established
PROVIDER GATE      ── closes with PROVISIONING VERIFICATION
IMPLEMENTATION     the code does not do what the target says
                   ── closes with a BATCH, its tests ACTIVE and green
LEGAL / POLICY     not an engineering matter at all
                   ── closes when the approved decision exists
```

| Conflict | Kind | Closes at | State today |
|---|---|---|---|
| **C-18 / BR-124** | implementation | **B-30** | OPEN — §27's known-secret scan is the check |
| **C-19** | implementation + configuration | **B-03**, with B-02's provisioning | OPEN |
| **C-21** | implementation | **B-09** | OPEN |
| **C-23** | implementation | **B-12** | OPEN |
| **C-25** | implementation | **B-11** | OPEN |
| **C-26** | implementation | **B-24**, when the second pipeline is removed | OPEN — **and it is NOT C-105** |
| **C-55** | implementation | **B-34**, with `next-themes` — DEP-C005 · DEP-I058 | OPEN |
| **C-58** | implementation | **B-22**, **distribution replaced (TD-038) and parsing moved server-side** | OPEN |
| **C-63** | **configuration** | **compute: B-04's redeploy. Database: PFL-004, or §32's migration** | OPEN — **both halves** |
| **C-72 / C-73** | implementation + configuration | **B-02 + B-03** | OPEN |
| **C-78** | implementation | **B-03** | OPEN |
| **C-79** | **LEGAL** | **not an engineering gate** | OPEN |
| **C-90** | implementation | **B-09** | OPEN |
| **C-100 · C-101** | implementation | **B-30 / B-31**, with §30's quarantine | OPEN |
| **C-102** | implementation | **B-20 + B-30** — Class A audit rollback | OPEN |
| **C-103** | **specification** | **RESOLVED by A7-001** — the Stage 7 headline is corrected to **67 of 95**, matching its own register and Stage 19's enumeration | **TARGET SPECIFICATION RESOLVED.** No implementation batch is required, and none is invented |
| **C-104** | **policy resolved / evidence open** | the manual assessment, per release | POLICY RESOLVED |
| **C-105** | **specification** | **CLOSED as a specification conflict by A4-001** | **TARGET SPECIFICATION RESOLVED** |
| **C-106** | specification resolved / implementation open | **B-04 builds API-283; B-05 removes LRC-048 · LRC-162** | **TARGET RESOLUTION ESTABLISHED · IMPLEMENTATION OPEN** |
| **C-107** | **specification — raised here, RESOLVED by the owner** | **A14-003** records **C-107 = A**: `wipe-school` → **API-247** `request-deletion`, CAP-084 · SC-7. **MP-B28** builds, switches and removes the legacy route | **TARGET SPECIFICATION RESOLVED · IMPLEMENTATION OPEN.** The old route still exists |

**TXD-080 · Architecture does not close an implementation conflict**

```
"THE ARCHITECTURE SAYS WHAT TO DO" IS NOT EVIDENCE OF HAVING DONE IT.

── every implementation conflict above closes when its batch has landed,
   its tests are ACTIVE, and they are green
── C-105 and C-106 reached a resolved TARGET.  Neither has an implementation.
── C-107 is NEW and OPEN.  It was raised, not resolved, by these corrections
── NOT ONE CONFLICT CLOSES IN THIS DOCUMENT.

AND THESE CORRECTIONS DO NOT CLOSE ANYTHING EITHER.
   Correcting Stage 22's description of C-25's fix does not remove
   /api/parent/link-child.  Correcting DEP-C009 to TD-038 does not move
   the parser off the browser.  Correcting the import mapping to API-170
   does not build the import engine.
   A SPECIFICATION ERROR IN THIS DOCUMENT WAS FIXED.  THE IMPLEMENTATION
   STATE OF EVERY CONFLICT IS EXACTLY WHAT IT WAS.
```

---

## 38. Backup and rollback

**TXD-081 · The three rollbacks, and the sentence that must never be said**

```
APPLICATION ROLLBACK      previous known-good deployment.  Routine —
                          WHILE the schema is compatible.
DATABASE ROLLBACK         MAY BE IMPOSSIBLE.  A transform has no undo.
PROVIDER CONFIG ROLLBACK  some are irreversible — Sentry's region, Neon's
                          region.  Those are new resources, not rollbacks.

NEVER SAY "JUST ROLL BACK THE DEPLOYMENT" ONCE THE SCHEMA HAS ADVANCED
INCOMPATIBLY.
   ── Stage 21 DEP-D093: the gate REFUSES an incompatible rollback rather
      than letting anyone try
```

**TXD-082 · Stage 15's additive-until-MIG-13 design is what makes rollback affordable for 33 of 35
batches**

```
B-01 … B-33    the schema is ADDITIVE.  The old tables are present and
               readable.  MIG-13 is REVERSIBLE — revert the application.
B-34           removal.  Reversible only from Git and the backup.
B-35 · MIG-14  IRREVERSIBLE.  §39's gate.

── 33 of 35 batches are revertible by reverting the application.
```

---

## 39. The destructive migration gate — MIG-14

**TXD-083 · Eleven conditions. All of them. Before anything is dropped.**

```
 1  LEGACY TABLE CONSUMERS = 0            proved per §40, not assumed
 2  LEGACY WRITES = 0                     no path writes the old schema
 3  BACKFILL RECONCILED                   MIG-12 passed: row parity, SUM
                                          parity on every money column,
                                          custody-chain continuity, zero
                                          orphans, RLS proven scoped
 4  SOAK COMPLETE                         a stated period after MIG-13
 5  SNAPSHOT QUARANTINE COMPLETE          §30's six steps, reconciled
 6  SNAPSHOT BYTES PRESERVED              and provably readable from the
                                          quarantine
 7  RETENTION / POLICY GATES SATISFIED    A16-002.2 · AUD-P22
 8  BACKUP EXISTS                         and is current
 9  RESTORE REHEARSAL PASSED              PFL-016 · REL-G012 — a backup
                                          that has not been restored is
                                          not a backup
10  ROLLBACK / FORWARD-REPAIR ACCEPTED    written before, not during
11  OWNER RELEASE APPROVAL                explicit, recorded

ANY ONE FAILS ⇒ MIG-14 DOES NOT RUN.
```

**TXD-084 · MIG-14 does NOT authorise destroying the quarantined snapshot bytes**

```
MIG-14 MAY DROP    the deprecated tables and columns, INCLUDING console_audit
                   ── once condition 5 and 6 prove the bytes are elsewhere

MIG-14 MAY NOT     destroy the QUARANTINED bytes.
                   ── APPROVED LEGAL / PRIVACY DISPOSITION REQUIRED
                   ── A19-001, and no pipeline can satisfy it
```

---

## 40. Final legacy-zero gate

**TXD-085 · Seven registers, all empty, or the cutover is not complete**

```
LEGACY ROUTE REGISTER (LRC)          →  EMPTY        234 → 0
CUTOVER BRIDGE REGISTER (CBR)        →  EMPTY         15 → 0
LEGACY SCREEN REGISTER (SCR-C)       →  EMPTY of BRIDGE entries
UNJUSTIFIED DEPENDENCY REGISTER      →  EMPTY
TEMPORARY CUTOVER FLAGS              →  ZERO           4 → 0
LEGACY WRITE PATHS                   →  ZERO
DEFINED-but-never-ACTIVE TARGET TESTS →  ZERO         Stage 20 §39

AND: no path writes the old AND the new authoritative schema simultaneously.

AND: a registered server route absent from API-001 … API-283 FAILS CI.
                                                  Stage 20 TST-D080
```

**TXD-086 · Dead-code proof — the eleven checks, recorded, before any REMOVE**

```
 1 static import          2 DYNAMIC import()        3 route registration
 4 client caller          5 EMAIL LINK              6 cron / scheduled caller
 7 PROVIDER CALLBACK      8 test dependency         9 script dependency
10 migration dependency  11 public entry / support flow

+ FOR SCREENS: the :section? SWITCHES, not just the route table   TXD-019

THE PROOF IS RECORDED WITH THE REMOVAL COMMIT.
Git history is the archive.  Production source is not.            TXP-6
```

**TXD-087 · Data never follows code's deletion rules**

```
LEGACY CODE   removable after REPLACEMENT PROOF
LEGACY DATA   requires MIGRATION → RECONCILIATION → RETENTION/POLICY CHECK
              → SOAK → DESTRUCTION APPROVAL

DO NOT INFER   "the table is unused"  ⇒  "the data is safe to drop."
   ── the first is a statement about code.  The second is a statement about
      children's records, and it needs a different kind of evidence.
```

---
---

## 41. Owner questions

**One, and it is a genuine choice about customer impact rather than an engineering preference.**

**MIGQ-1 · Does the production cutover use a scheduled maintenance window?**

# **OWNER DECISION: MIGQ-1 = A — A SHORT SCHEDULED CUTOVER / WRITE-FREEZE WINDOW.**

**Decided by the owner (BytHub Technology Ltd), 1 September 2026. Recorded verbatim, not inferred.**

```
THE OWNER'S REASON, AS GIVEN

   ScholarShelf holds
      children's records
      settlement / money facts
      stock facts
      custody and hand-over history

   DURING THE AUTHORITY-MOVING PART OF THE FINAL CUTOVER:
      WRITES MUST BE QUIESCED.

   DO NOT introduce live dual-write or zero-downtime migration complexity
   unless a LATER LOCKED CUSTOMER OBLIGATION genuinely requires it.
   NO SUCH LOCKED OBLIGATION CURRENTLY EXISTS.
```

**TXD-089 · The exception, and it is a real one**

```
IF, AT THE ACTUAL CUTOVER DATE, THERE IS NO LIVE TENANT DATA:

   MIGQ-1 BECOMES **NOT APPLICABLE**
   and NO CUSTOMER MAINTENANCE WINDOW IS REQUIRED.

   ── the architecture decision does not change: IF live data exists,
      the SCHEDULED WRITE-FREEZE MODEL is used
   ── whether live tenant data exists is a FACT TO BE ESTABLISHED AT
      B-33, from the production database, not assumed in either direction
      by this document
```

**TXD-090 · The wording matters: WRITE-FREEZE, not "read-only mode"**

```
SAFE WORDING              MAINTENANCE / WRITE-FREEZE WINDOW

DO NOT CLAIM "READ-ONLY MODE" unless implementation actually PROVIDES and
TESTS a reliable GLOBAL WRITE GATE.

   IF a tested read-only mode exists at cutover   →  it MAY be used, and
                                                     reads stay available
   IF it does not                                 →  the application is
                                                     TEMPORARILY UNAVAILABLE
                                                     rather than PRETENDING
                                                     to be read-only

A HALF-ENFORCED READ-ONLY MODE IS WORSE THAN AN HONEST OUTAGE.
   ── it invites a write that the migration will not see, on the one day
      the delta is supposed to be closed
```

**TXD-091 · The thirteen-step cutover sequence**

```
 1  ANNOUNCE MAINTENANCE                    to schools, ahead of the window
 2  STOP NEW MUTATING USER ACTIONS
 3  STOP OR SAFELY DRAIN SCHEDULED MUTATING WORK      MOD-014 · API-278
 4  HANDLE PROVIDER CALLBACKS per the locked callback/replay design
       ── API-279.  A CALLBACK IS A SIGNAL.  IT NEVER BECOMES BUSINESS
          CONFIRMATION, and least of all during a write-freeze
 5  ALLOW IN-FLIGHT DATABASE TRANSACTIONS TO COMPLETE
 6  PROVE NO TARGET-CHANGING TRANSACTION REMAINS IN FLIGHT
       ── a query, not a wait-and-hope
 7  TAKE / VERIFY THE REQUIRED PRE-CUTOVER BACKUP     §38 · PFL-016
 8  COPY THE FINAL DELTA
 9  RUN MIGRATION RECONCILIATION                      MIG-12's full set
10  SWITCH THE SINGLE AUTHORITY                       MIG-13
11  RUN CRITICAL SMOKE / READ / INVARIANT CHECKS
12  REOPEN WRITES
13  OBSERVE THROUGH THE DEFINED SOAK PERIOD

STEPS 2–6 ARE THE FREEZE.  STEP 10 IS THE ONLY MOMENT AUTHORITY MOVES.
```

**TXD-092 · What MIGQ-1 = A removes from the plan**

```
NOT BUILT, BECAUSE THE DECISION SAYS NOT TO BUILD IT

   live dual-write between two EQUAL authorities
   delta replication under live traffic
   a read-switch under load
   a drift monitor for the cutover window itself

   ── §34's narrow, primary-plus-copy dual-writes REMAIN.  Those are
      per-domain migration copies with the OLD side authoritative, and
      they are not zero-downtime cutover machinery
   ── if a locked customer obligation later requires zero downtime, that
      is a NEW LOCKED REQUIREMENT and a traceable amendment, not a
      decision engineering may take on its own
```

**OPEN STAGE 22 OWNER QUESTIONS AFTER THIS DECISION: 0.**

**No other owner question is raised.** Batch order, flag mechanism, register schemas, migration
properties, salvage classifications, route dispositions, dependency dispositions and removal proofs
are all engineering, decided above.

---

## 42. Implementation Master Plan handoff

**TXD-088 · Stage 22 is architecture. The executable checklist is the post-stage.**

```
STAGE 22 PRODUCES THE REGISTERS.
IMPLEMENTATION_MASTER_PLAN.md TURNS THEM INTO A CHECKLIST CLAUDE FOLLOWS
BATCH BY BATCH.

INPUTS IT RECEIVES
   IMP-B01 … IMP-B35     the batch sequence, with goals and gates      §35
   CSR-001 … CSR-059     the code survival classification              §6
   LRC-001 … LRC-234     the legacy ROUTE bridges and their removals   §10
   CBR-001 … CBR-015     the non-route cutover bridges                §11
   SCR-C001 … SCR-C042   the screen dispositions                       §12
   DEP-C001 … DEP-C023   the dependency change decisions               §14
   DEP-I001 … DEP-I099   every package.json entry, one row each        §14.1
   DMR-001 … DMR-027     the database migration map                    §15
   the migration chain    MIG-01 … MIG-14, batched                     §16
   the conflict matrix    C-* → IMP-B*                                 §37
   the test activation    per batch, red-first                         §36
   the four flags         with their removal batches                   §33
   the gates              §39's eleven, §40's seven registers

WHAT THAT DOCUMENT ADDS, AND STAGE 22 DOES NOT
   the per-batch task list · the order within a batch · the exact files
   touched · the commit boundaries · the review checklist per merge

STAGE 22 ITSELF EDITS NO APPLICATION CODE.
```

---

## 43. Absolute claims — each one proved, or narrowed

**TXD-092.1 · An absolute claim that is not mechanically checkable is a liability, not a strength**

Every `every` · `all` · `none` · `zero` · `exactly` · `complete` in this document was searched for and
examined. **The load-bearing ones are listed below with the check that proves them. Where a proof was
not available, the claim was NARROWED rather than kept because it sounded complete.**

| Claim | Proof | Result |
|---|---|---|
| **every current route has a disposition** | 243 map entries ↔ 243 registered handlers; set-difference computed **both ways**, both empty | **PROVED** |
| **every legacy route has a removal gate** | 234 LRC rows; **zero blank removal-batch cells**; removal spread across 8 batches | **PROVED** |
| **every current page file has a disposition** | 42 SCR-C rows ↔ 42 measured `client/src/pages/**/*.tsx` | **PROVED** |
| **every target human screen survives** | **NARROWED.** The provable claim is: **no HUMAN SURFACE is removed by this plan.** One page file is a REMOVE candidate — `admin/shared.tsx` — and it is a helper, not a surface, and it goes only on four proofs. **Page files and human surfaces are counted separately** — TXD-019 | **NARROWED** |
| **every direct dependency has a disposition** | 99 DEP-I rows ↔ 99 direct `package.json` entries (79 + 19 + 1) | **PROVED** |
| **every dependency has a disposition** | **NARROWED to DIRECT.** Transitive dependencies are **not** individually dispositioned. `npm audit` in CI covers them; the vendored SheetJS, which `npm audit` cannot see, is covered by TR-010's named owner and review cadence | **NARROWED** |
| **every current physical table has a migration disposition** | 42 tables (41 `pgTable` + `console_audit`) named across DMR-001 … DMR-027, checked **by table name** | **PROVED** |
| **every migration has pre/post verification** | each DMR row carries a Verification cell; §16's five questions gate each MIG | **PROVED** |
| **every bridge has a removal batch** | 15 CBR rows, 15 populated removal batches; 4 flags, 4 removal batches | **PROVED** |
| **every temporary flag has a removal batch** | the §33 table has no empty cell | **PROVED** |
| **every conflict has a batch or an external gate** | §37 — and **C-79 and C-104 are external by nature** (legal, and a manual assessment). Naming a batch for those would be a false claim of engineering control | **PROVED, with two deliberately external** |
| **"it works, schools use it"** | **NARROWED to an OWNER / PROJECT-HISTORY CLAIM.** Evidence ceiling **E2**. §3 | **NARROWED** |
| **"every dependency accounted for"** *(the PROPOSED draft's wording, with twenty named)* | **WITHDRAWN AND REPLACED** by DEP-I001 … DEP-I099. The old wording was not checkable | **REPLACED** |
| **"nine bridges, and nine removal batches"** *(the PROPOSED draft)* | **WITHDRAWN.** It was 234 routes and 15 non-route mechanisms wearing nine identifiers | **REPLACED** |
| **"all 242 routes"** *(the PROPOSED draft)* | **WITHDRAWN.** The measured number is **243** | **REPLACED** |

**TXD-092.2 · Four claims this document deliberately does NOT make**

```
NOT CLAIMED   that every transitive dependency has a disposition
NOT CLAIMED   that the baseline is verified                       ── E2
NOT CLAIMED   that any conflict is closed                         ── §37
NOT CLAIMED   that the target route set has been built
              ── 9 of 243 handlers sit at a target path today, and their
                 HANDLERS are still replaced
```

---

## 44. Success criteria — answered

| Question | Answer |
|---|---|
| Is this a full rewrite? | **NO** — **33 of 59** classified units are KEPT, MOVED or REFACTORED, counted one primary disposition per row |
| Is current working behaviour thrown away? | **NO** — **19 KEEP-primary units**, eighteen of them in §6.2 and one in §6.5 |
| Is code preserved merely because it exists today? | **NO** — TXP-3; **16 REPLACE-primary units**, thirteen of them in §6.3 |
| Is the locked architecture the whitelist? | **YES** — TXP-1 |
| Does every current route have a disposition? | **YES** — **all 243 registered handlers**, each in exactly one of five classes, §9 |
| Does every legacy route have a removal gate? | **YES** — **234 LRC entries, 234 removal batches**, spread across eight batches, §10 |
| Does every current screen have a disposition? | **YES** — all 42, §12 |
| Does every **DIRECT** dependency have a disposition? | **YES** — **99 package.json entries, 99 DEP-I rows**, §14.1. **Transitive dependencies are NOT individually dispositioned, and that is stated rather than glossed** |
| Does useful code inside `storage.ts` get salvaged? | **YES** — §6.1 decomposes it by responsibility; `storage.ts = REMOVE` is refused explicitly |
| Are security-critical legacy mechanisms blindly carried over? | **NO** — **16 REPLACE-primary entries**, and **every one is security-critical or a security-adjacent mechanism** (§6.1's CSR-004 role model and CSR-013 audit writer, §6.3's thirteen, §6.5's CSR-057 auth middleware) |
| Is every current physical table mapped? | **YES** — **all 42** (41 `pgTable` + `console_audit`), across 27 DMR entries, §15 |
| Can a legacy table be dropped because no code appears to use it? | **NO** — TXD-087; code rules and data rules are different |
| Does data receive migration and reconciliation before deletion? | **YES** — §15's five questions, MIG-12, §39's gate |
| Does I-2 remain one transaction? | **YES** — six writes, ONE PostgreSQL commit, §23 |
| Does a provider callback ever become a confirmation? | **NO** — TXD-048 |
| Does import use logical-row atomicity? | **YES** — A4-001 · OPS-D021, §21 |
| Is row resume idempotent? | **YES** — OPS-D022, driven by the staging row's committed state |
| Are Resend and SES dual-sending? | **NO** — one active sender, TXD-052 |
| Can unscanned S3 data become readable? | **NO** — OPSQ-1 = A, and step 3's EICAR gate blocks the whole migration |
| Are legacy snapshots destroyed? | **NO** — A19-001; quarantined, preserved, and MIG-14 cannot destroy them |
| Can a legacy API remain indefinitely without a removal batch? | **NO** — an LRC entry without one is not an entry |
| Does every non-route bridge have a removal batch? | **YES** — **15 CBR entries, 15 removal batches**, §11 |
| Does parent self-registration survive? | **YES** — **UX-005 · API-010 · CAP-026**, SCR-C035 KEEP + REFACTOR, §12. **The PROPOSED draft said otherwise and was wrong** |
| Is any historical actor, timestamp, custody transition or stock movement fabricated? | **NO** — §24.1's hard stop: raise a Stage 15 amendment rather than insert a fake value |
| Is spreadsheet technology reselected here? | **NO** — TD-038 stands: vendored SheetJS 0.20.3+, server-side only, §21 |
| Are invite tokens and linking codes treated as one credential class? | **NO** — §15.1 and §15.2, separate lifetimes, separate proofs |
| Do final target routes equal the locked contract? | **YES** — API-001 … API-283, and anything else fails CI |
| Are temporary cutover flags removed? | **YES, in the target** — four flags, four removal batches |
| Is Git the archive for removed source? | **YES** — TXP-6 |
| Does Stage 22 execute a migration? | **NO** |
| Does Stage 22 remove a file? | **NO** |
| Does Stage 22 install a dependency? | **NO** |
| Does Stage 22 change infrastructure? | **NO** |
| Does Stage 22 deploy? | **NO** |
| Does Stage 22 declare tests passing? | **NO** |
| Does Stage 22 clear Legal / Compliance? | **NO** |
| Does any conflict close in this document? | **NO** |

---

## 45. Diagrams

**BX-2 · Current → classification → target**

```
   ~50,200 lines ─► INSPECT ─► CLASSIFY ─┬─ KEEP     13 ─┐
                                          ├─ MOVE      7 ─┤
                                          ├─ REFACTOR 11 ─┼─► TARGET
                                          ├─ REPLACE  14 ─┤
                                          ├─ BRIDGE    0 ─┤ (routes/data only)
                                          └─ REMOVE    6 ─┘ → GIT ARCHIVE
```

**BX-3 · Replacement before removal**

```
   BUILD ─► TEST ─► PROVE ─► SWITCH ─► SOAK ─► REMOVE
                                                  │
   NEVER:  REMOVE ─► then rebuild the replacement ┘
```

**BX-4 · Route bridge lifecycle**

```
   TARGET built ─► consumers switched ─► bridge idle ─► PROOF (§40's 11)
                                                            ─► REMOVED
   LRC entry:  replacement batch · consumer batch · removal batch · test
   ── no removal batch ⇒ not a valid entry ⇒ CI failure
```

**BX-5 · Screen replacement lifecycle**

```
   target screen built ─► routing/section switch points at it ─► deep links,
   EMAIL links and support links checked ─► old page removed
   ── the switch is atomic per surface, so screens need no bridge
```

**BX-6 · Expand → migrate → switch → contract**

```
   EXPAND    add target structures        MIG-03…06   additive, reversible
   MIGRATE   backfill / transform         MIG-07/11   resumable
   COMPARE   source vs target             MIG-12      counts · SUMS · chains
   SWITCH    one authority                MIG-13      REVERSIBLE
   SOAK      observe                                  stated period
   CONTRACT  remove legacy                MIG-14      IRREVERSIBLE · §39
```

**BX-7 · RLS cutover — avoiding both forbidden windows**

```
   tenant columns ─► RUNTIME SETS CONTEXT (no policies yet — nothing changes)
                  ─► role separation + FORCE RLS ─► POLICIES ENABLED
                  ─► verified under a NON-BYPASSING role
   application asserts REMAIN.  Two layers, not one.
```

**BX-8 · I-2 migration**

```
   B-19 decompose money ─► B-20 assemble the SIX writes into ONE transaction
        ─► INV-T01…04 + audit rollback + concurrency ACTIVE and GREEN
        ─► only then the old finance path becomes eligible for removal
```

**BX-9 · Import migration**

```
   pipeline 1 (families) ── BASE
   pipeline 2 (students) ── validation + preview logic SALVAGED
                            commit path REMOVED
   ─► ONE ENGINE, TWO MODES ─► A4-001 granularity ─► parser server-side
```

**BX-10 · Resend → SES**

```
   split FACT from DELIVERY ─► SES staging verified ─► 7 parity checks
        ─► flag flips ONE active sender ─► soak ─► Resend removed (B-32)
   NEVER both sending.
```

**BX-11 · base64 → S3 → scan**

```
   metadata ─► buckets ─► EICAR GATE ─► new uploads to S3 ─► copy existing
            ─► hash/size/type reconcile ─► scan state ─► READS SWITCH
            ─► public copies ─► source bytes dropped at MIG-14
   PENDING is readable by NOBODY at every point.
```

**BX-12 · Audit + snapshot quarantine**

```
   audit_logs ──┐
   message_audit_logs ──┼─► DBT-079 audit_events      (attribution)
   console_audit ───────┘─► DBT-080 console_operations (operational)
                        └─► SNAPSHOTS ─► QUARANTINE (separate locked bucket)
                                          preserved · reconciled · unreachable
   UNKNOWN/LEGACY where the source never had the field.  Nothing invented.
   FINAL DESTRUCTION: policy, not pipeline.
```

**BX-13 · Provider and region cutover**

```
   iad1 ─► lhr1                    redeploy · PFL-002
   Neon region ─► eu-west-2        CONDITIONAL on PFL-004 · §32
   Resend ─► SES                   B-24 → B-32
   base64 ─► S3                    B-26 → B-33
   none ─► Sentry EU               region chosen BEFORE the org exists
   www ─► app.scholarshelf.co.uk   links first, then redirect
```

**BX-14 · Batch dependency graph**

```
   B-01 baseline
     └─ B-02 provisioning ─ B-03 runner ─ B-04 tests/CI/API-283 ─ B-05 schema
                                                                     │
        ┌────────────────────────────────────────────────────────────┘
        ├─ B-06 identity ─ B-07 RLS ─ B-08 capability ─ B-09 MFA
        │                    │                            └─ B-11 ─ B-12
        │                    │
        ├────────────────────┴─ B-13 school ─ B-14 children ─ B-15 families
        │                          └─ B-16 catalogue ─ B-17 stock ─ B-18 cycles
        │                                                              │
        ├─ B-19 money ─ B-20 I-2 ◄────────────────────────────────────┘
        ├─ B-22 import ◄─ (needs B-15 and B-18)
        ├─ B-24 email ─ B-32
        ├─ B-26 objects
        ├─ B-30 audit ─ B-31
        └─ B-33 MIG-12/13 ─ B-34 legacy removal ─ B-35 MIG-14

   B-07 (RLS) GATES every domain batch.  B-20 (I-2) GATES the finance removal.
   B-33 GATES B-34, which GATES B-35.
```

**BX-15 · The final legacy-zero gate**

```
   LRC empty · SCR-C bridges empty · dependency register justified ·
   flags = 0 · legacy write paths = 0 · route set = API-001…283
              │
              ▼
   §39's ELEVEN conditions ── incl. restore rehearsal, snapshot quarantine
   preserved, owner approval
              │
              ▼
   MIG-14 ── and it still may not destroy the quarantined bytes
```

---

## 46. What Stage 22 deliberately does not implement

```
write, move or delete ANY application file
remove any route · screen · dependency
install anything · edit package.json · edit CI
create AWS CDK files · create any AWS resource
change Vercel · Neon · SES · Resend · Sentry · DNS
create database roles · run migrations · copy or quarantine data
tag Git · create the implementation branch · commit · push
deploy anything · touch production
execute ANY step of IMPLEMENTATION_MASTER_PLAN.md   ── §42
declare any test passing · close any conflict
```

**No application file was created, edited, moved or deleted. No route, screen or dependency was
removed. No package was installed and `package.json` was not edited. No CI file was edited. No AWS CDK
file was created. No AWS, Vercel, Neon, SES, Sentry or Resend resource or configuration was created or
changed. No database role was created. No migration was written or executed. No data was copied,
quarantined or destroyed. No DNS was changed. No Git tag or branch was created, nothing was committed
or pushed. Nothing was deployed. No code has changed.**

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2** — **and
§5's freeze is the first thing that changes it.**

```
STAGE 22 — MIGRATION, TARGET EXTRACTION & CUTOVER
STATUS: **LOCKED** — 1 September 2026, by the owner (BytHub Technology Ltd)
NOTHING IS IMPLEMENTED.

**THIS IS THE FINAL ARCHITECTURE STAGE.  THERE IS NO STAGE 23.**

Owner decisions:      MIGQ-1 = A   scheduled write-freeze window
Open owner questions: 0
New conflicts:        1   ── C-107, OPEN
Amendments raised:    1   ── A14-002, typo / cross-reference only
Conflicts closed:     0

REGISTERS — FINAL, RECOMPUTED  (see A22-001 for the post-lock recount)
   TXP    16 principles        TXD  92 decisions
   CSR    59 code units       LRC  234 legacy ROUTES   (route-only)
   CBR    15 cutover bridges  SCR-C  42 screens
   DEP-C  23 change decisions DEP-I  99 package entries
   DMR    27 map entries      IMP-B  35 batches
   MIG    01 … 14 batched     BX     15 diagrams

   243 registered handlers · 42 current physical tables ·
   42 page files / 41 human surfaces · 99 direct dependencies

CONFLICT STATES — NONE CLOSED BY THIS DOCUMENT
   C-103  TARGET SPECIFICATION RESOLVED  (A7-001)  58 → 67
   C-105  TARGET SPECIFICATION RESOLVED  (A4-001) · implementation open
   C-106  TARGET RESOLUTION ESTABLISHED  (A14-001 · API-283) · impl. open
   C-104  TARGET POLICY RESOLVED / EVIDENCE OPEN
   C-107  TARGET SPECIFICATION RESOLVED  (A14-003, owner decision = A)
          wipe-school → API-247.  IMPLEMENTATION OPEN — MP-B28
   C-18 · C-19 · C-21 · C-23 · C-25 · C-26 · C-55 · C-58 · C-63 ·
   C-72 · C-73 · C-76 · C-78 · C-79 · C-90 · C-100 · C-101 · C-102  OPEN

   Highest identifier now in use: C-107.
   The Implementation Master Plan starts at C-108 if it ever needs one —
   and it should not, because it implements rather than specifies.

NEXT: IMPLEMENTATION_MASTER_PLAN.md
      STATUS: PROPOSED — awaiting owner review.
      It converts these registers into executable checklists.
      IT IMPLEMENTS NOTHING, AND MP-B01 HAS NOT BEEN STARTED.
```

---

## Amendment register — Stage 22

**Verified before assigning: Stage 22 had no amendment register and no prior amendment. A22-001 is the
first.** **Stage 22 remains LOCKED — 1 September 2026.** This register is **append-only**; the locked
body above is corrected only where a stated FACT was wrong, and every such correction is itemised here.

---

### A22-001 · C-107's owner resolution, and the post-lock factual reconciliation

**Class: OWNER RESOLUTION + FACTUAL / MECHANICAL RECONCILIATION. No architecture changes.**

**Raised 1 September 2026, after the Stage 22 lock, on the owner's instruction.**

#### 1 · C-107 is resolved by owner decision

| | |
|---|---|
| **Owner decision** | **C-107 = OPTION A** |
| **Legacy** | `POST /api/owner/db/danger/wipe-school/:schoolId` |
| **Target** | **API-247** `POST /api/platform/schools/:schoolId/request-deletion` — CAP-084 · SC-7 · MOD-012 |
| **Recorded in the locked Stage 14 contract as** | **A14-003**, a legacy-mapping correction. `wipe-school` is **removed** as a legacy predecessor of API-276 and of API-277 |
| **API-276** | unchanged — `erase-account`, **CAP-036**, break-glass, a separate act |
| **API-277** | unchanged — the **irreversible purge**, **CAP-092**, retaining `purge-school/:id` as its predecessor |
| **New API identifiers** | **none** |
| **C-107 state** | **TARGET SPECIFICATION RESOLVED · IMPLEMENTATION OPEN** — the legacy route still exists, and **MP-B28** builds, switches and then removes it after proof |

**§10.4's conflict entry stands as the record of what the disagreement was.** It said the conflict was
raised and not resolved; **it is now resolved by the owner, and this amendment is that resolution.**

#### 2 · C-103 is resolved by a Stage 7 factual amendment

| | |
|---|---|
| **The disagreement** | Stage 7 §20's headline said **58 of 95**; its own per-capability register marks **67**; Stage 19 enumerated **67** mechanically and built AET-001 … AET-102 on it |
| **Verified at correction** | 95 capability definition lines, CAP-001 … CAP-095 contiguous. **66 carry `**AUDIT**` on the definition line; CAP-040 `open_cycle` carries it on the immediate continuation line** because its definition line ends with a parenthetical. **66 + 1 = 67** |
| **Recorded as** | **A7-001** — Stage 7's first amendment. **Headline only: 58 → 67** |
| **Unchanged** | no capability added or removed · no AUDIT flag changed · no authority, scope or condition changed · Stage 19's taxonomy untouched |
| **C-103 state** | **TARGET SPECIFICATION RESOLVED.** **No implementation batch is required to change a count, and none is invented** |

#### 3 · Route count — every CURRENT statement now reads 243

| Where | Was | Now |
|---|---|---|
| **§2 Evidence inspected** | "242 registered handlers" | **243**, with the note that `server/routes.ts` is a re-export shim |
| **§8 TXD-008** | "every one of the 242 current handlers" | **243** |
| **§33 flag table** | "across 242 handlers" | **243** |
| **§3, §7, §9, §43** | already 243 | unchanged |

**The classification is unchanged and still totals 243:** TARGET 6 · PUBLIC TARGET 2 · INTERNAL
TARGET 1 · LEGACY-BRIDGE 222 · REMOVE 12.

**Three statements that mention 242 REMAIN, and each is explicitly historical** — §3's "recounted at
correction — 243, not 242", §9's "the PROPOSED draft said 242; the measured number is 243", and §43's
withdrawn-claim row. **`API-242` is an endpoint identifier and is not a count.**

**Stage 14's 30-August measurement is NOT altered.** It recorded what was measured then. **Stage 22's
1-September repository recount governs Stage 22.**

#### 4 · CSR — 59 identifiers, 59 counted, with the counting rule stated

**TXD-004 said "58 classified units" while the register held CSR-001 … CSR-059. That is
arithmetically impossible, and the fix was a RECOUNT, not an edit of the number.**

```
COUNTING RULE, NOW STATED IN TXD-004
   ONE CSR ROW = ONE PRIMARY DISPOSITION, counted once.
   A compound label's SECONDARY action is METADATA on the row, not a
   second tally.  NINETEEN of the 59 rows carry a compound label.

RECOUNTED MECHANICALLY
   KEEP 19 · MOVE 8 · REFACTOR 6 · REPLACE 16 · BRIDGE 0 · REMOVE 8 ·
   TRIAGE/PORT 2   =   59

   -- the PROPOSED figures (13/7/11/14/0/6/7 = 58) were a hand tally, and
      they were wrong in both the parts and the total
   -- 33 of 59 units are KEPT, MOVED or REFACTORED (was "31 of 58")
```

**Two derived claims were corrected with it:** "§6.3 replaces fourteen units that work" → **16
REPLACE-primary units, thirteen of them in §6.3**; "§6.2 lists nineteen units kept" → **19
KEEP-primary units, eighteen in §6.2 and one in §6.5**.

#### 5 · The thirteen data layers — wording

**TXD-006 said "Fourteen business modules hold `data.ts`" while also stating that MOD-010 and MOD-015
have none. Both cannot be true.**

```
CORRECTED TO
   THIRTEEN MODULE-OWNED DATA LAYERS EXIST.
   Owned by: MOD-001 · 002 · 003 · 004 · 005 · 006 · 007 · 008 · 009 ·
             011 · 012 · 013 · 014

   MOD-010 Reporting & Projections   NO data.ts — it owns no operational truth
   MOD-015 Delivery & Integration    NO data.ts — a gateway boundary under
           Gateways                  server/gateways/, no business persistence

NO ARCHITECTURE CHANGE.  FACTUAL WORDING ONLY.  APP-025 is unchanged.
```

#### 6 · Cron — the legacy route's two halves map to two different targets

**Measured at correction, `server/routes/cron.routes.ts:298–300`:**

```
// POST is the mutating verb; GET is kept because Vercel Cron issues GET.
app.get("/api/cron/run", handler);
app.post("/api/cron/run", handler);

── ONE SHARED HANDLER.  Today's route is TRANSPORT AND RUNNER FUSED,
   and that fusion is exactly what A14-001 separates
```

| Legacy | Target | Why |
|---|---|---|
| **LRC-048** `GET /api/cron/run` | **API-283** `GET /api/internal/jobs/trigger` | **Vercel cron issues GET only** — a verified first-party fact. The GET entry point is a TRANSPORT, and API-283 is the transport adapter |
| **LRC-162** `POST /api/cron/run` | **API-278** `POST /api/internal/jobs/run` | its POST shape already matches the target runner's method and role. **CAP-093 · SC-10 · MOD-014** |

```
FORBIDDEN, AND STATED SO THAT IT CANNOT DRIFT

   DO NOT map Vercel's GET transport directly to API-278
   DO NOT add a GET method to API-278
   DO NOT perform LOOPBACK HTTP from API-283 to API-278

   BOTH TARGET TRANSPORTS CALL THE SAME UNDERLYING APPLICATION SERVICE.
   ── the adapter is a transport, not a client of its own API
   ── and the Vercel cron header / user-agent is NOT authentication
```

**C-106 is NOT closed by this.** It closes only when API-283 is built, API-278 is built or correctly
retained, Vercel calls API-283, scheduler authentication works, jobs run **once**, and both legacy
`/api/cron/run` handlers are gone.

#### 7 · What this amendment does NOT do

```
IT DOES NOT UNLOCK STAGE 22.
IT DOES NOT REWRITE THE LOCKED BODY HISTORICALLY.
IT DOES NOT CHANGE:
   any register's IDENTIFIERS      any batch boundary or ordering
   any API contract                any schema decision
   any module ownership            any migration property
   any conflict's IMPLEMENTATION state
   any owner decision other than recording C-107 = A

IT CORRECTS SIX STATED FACTS AND RECORDS ONE OWNER DECISION.
```

#### 8 · Register counts after A22-001 — final

```
TXP    16 principles        TXD    92 decisions
CSR    59 code units        LRC   234 legacy ROUTES (route-only)
CBR    15 cutover bridges   SCR-C  42 screens
DEP-C  23 change decisions  DEP-I  99 package entries
DMR    27 map entries       IMP-B  35 batches
MIG    01 … 14 batched      BX     15 diagrams

243 registered handlers · 42 current physical tables ·
42 page files / 41 human surfaces · 99 direct dependencies ·
95 capabilities, 67 audit-required

CONFLICT STATES
   C-103  TARGET SPECIFICATION RESOLVED   (A7-001)
   C-105  TARGET SPECIFICATION RESOLVED   (A4-001)   · implementation open
   C-106  TARGET RESOLUTION ESTABLISHED   (A14-001)  · implementation open
   C-107  TARGET SPECIFICATION RESOLVED   (A14-003)  · implementation open
   C-104  TARGET POLICY RESOLVED / EVIDENCE OPEN — per release
   C-18 · C-19 · C-21 · C-23 · C-25 · C-26 · C-55 · C-58 · C-63 ·
   C-72 · C-73 · C-76 · C-78 · C-79 · C-90 · C-100 · C-101 · C-102  OPEN

   CONFLICTS CLOSED BY THIS AMENDMENT: 0.
   Highest identifier in use: C-107.  No new conflict is raised.
```

**Governing amendments after A22-001:** A4-001 · A7-001 · A11-001 · A13-001 · A14-001 · A14-002 ·
**A14-003** · A15-001 · A15-002 · A15-003 · A16-001 · A16-002 · A17-001 · A19-001 · A20-001 ·
A20-002 · **A22-001**.

**STAGE 22 REMAINS LOCKED. NO CODE HAS CHANGED.**
