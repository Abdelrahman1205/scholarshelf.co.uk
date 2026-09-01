# TEST_STRATEGY.md
# Stage 20: Test Strategy, Verification & Evidence

```
STAGE 20 — TEST STRATEGY, VERIFICATION & EVIDENCE
STATUS: LOCKED — 31 August 2026 by the owner (BytHub Technology Ltd)
Written: 31 August 2026 · corrected and locked the same day
Owner decisions: 1A legacy snapshots quarantined/preserved pending policy
                 2A manual WCAG 2.2 AA assessment mandatory before production
Open owner questions: 0
New conflicts: C-104 · C-105
Amendments raised: none by this stage
Amendments relied on: A19-001 (Stage 19, owner, 31 August 2026)
```

**Governed by** Stages 1–19, **all LOCKED**, including their amendment registers: A11-001, A13-001,
A15-001, A15-002, A15-003, A16-001, A16-002, A17-001, **A19-001**.

---

## 1. Purpose and boundary

Stage 20 answers **how the rebuilt system will be shown to be correct** — which properties are tested,
at which level, with which tools, against which data, and what a passing run is actually evidence of.

It exists because the strongest sentence in this entire restructure is currently unsupported:
**the baseline is UNVERIFIED and capped at E2.** Nineteen stages have specified behaviour by reading
code. **Nothing in this project has yet been proven by running it.**

### 1.1 What Stage 20 decides — and does not

| Decides | Does not decide |
|---|---|
| the test levels, and what each level is capable of proving | **the tests themselves** — no test is written here |
| the runner, the browser tool and the accessibility tool, **with first-party evidence** | whether they are installed — **Stage 21** |
| the database a test runs against, and how tests are isolated from each other | database roles and privileges — **Stage 21** |
| the invariant, tenancy, security, migration and journey families, and what each must assert | migration execution — **Stage 22** |
| the CI pipeline's shape, ordering and gates | **editing `.github/workflows/ci.yml`** — Stage 21 |
| what a test may never contain | production data handling — **LEGAL / APPROVED POLICY** |
| what "verified" would have to mean before the baseline leaves E2 | **declaring the baseline verified** |

### 1.2 Nothing was executed

**No test was written. No test was run. No framework was installed. `package.json` was not edited.
`.github/workflows/ci.yml` was not edited. No migration was applied, no database was created, no
production data was touched, nothing was deployed.**

Every finding below is **E2** — read directly from the repository, not observed by execution. **That
includes the findings about the test suite itself**, which is a slightly uncomfortable but honest
position: this stage read the tests rather than running them, for the same reason every prior stage
read the code rather than running it.

### 1.3 The release boundary is unchanged

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** A test strategy is not a clearance. **Stage approval ≠
production security clearance ≠ legal sign-off**, and a green pipeline is none of the three.

---

## 2. Evidence inspected

```
package.json                 all 21 scripts · devDependencies (tsx, typescript — and nothing else
                             resembling a test tool)
.github/workflows/ci.yml     both jobs, in full — including the migration loop's glob
tests/*.ts                   all eleven suites, 3,555 lines
script/smoke-boot.ts         183 lines, read in full including its header rationale
migrations/                  001 … 006, and which of them CI actually applies
client/src/                  searched for *.test.* and *.spec.* — NONE EXIST
TECH_STACK.md                its §2.2 CI facts · its §2.3 findings · the Node 24 decision
DATABASE_SCHEMA.md           C-78's definition · DBD-043 · the A15 register including A15-003
DESIGN_SYSTEM.md             §23's WCAG 2.2 AA baseline, and what it says is "verified"
PERMISSIONS.md               SECAR-007's prohibition on role-string capability checks
SECURITY_AUTH_PRIVACY.md     the control set the security family must cover
AUDIT_ACCOUNTABILITY.md      Stage 19's §12 coupling classes · its §8.10 matrix · its §39
                             named handoffs
DELIVERY_SCALE_OPERATIONS.md Stage 18's §8 latency budgets · its §9 I-2 transaction objective
```

**First-party tooling evidence, fetched 31 August 2026** — recorded here because a tool selection made
from memory is the same failure as a provider selection made from memory:

| Claim | Source | Verified |
|---|---|---|
| **Vitest 4.0 requires Vite >= 6.0.0** | Vitest migration guide | ✔ — the project is on **Vite 7.1** |
| **Vitest 4.0 requires Node.js >= 20.0.0** | Vitest migration guide | ✔ — Stage 11 targets **Node 24 LTS** |
| **Vitest Browser Mode supports a Playwright provider**, recommended for new projects because it runs in parallel | Vitest browser-mode guide | ✔ |
| **Playwright's own accessibility documentation recommends `@axe-core/playwright`** and the `AxeBuilder` API | Playwright accessibility docs | ✔ |
| **Automated accessibility scanning finds only "some common accessibility problems"; "many accessibility problems can only be discovered through manual testing"** | Playwright accessibility docs, quoted | ✔ — **and §35 refuses to overclaim because of it** |
| Latest documented Playwright is **1.62**; Node 16 support removed at 1.54, Node 18 deprecated | Playwright release notes | **PARTIAL** — the docs do not state a Node floor for 1.62 explicitly. **Recorded as a residual, not resolved by inference** |

---

## 3. Current test baseline

**All findings E2 — read, not executed.**

**AY-1 · What exists**

```
tests/                     ELEVEN tsx scripts · 3,555 lines · NO framework
   custody-machine.ts          77   pure, no server, no database   ← the only true unit test
   stock-idempotency.ts        78   live server, HTTP
   staff-parent.ts            138   live server, HTTP
   teacher-distribution.ts    183   live server, HTTP
   payment-idempotency.ts     247   live server, HTTP
   test-superuser.ts          253   live server, HTTP
   tenant-isolation.ts        327   live server, HTTP, TWO seeded schools
   enrollment-import.ts       499   live server, HTTP
   security-regression.ts     500   live server, HTTP
   payment-verification.ts    559   live server, HTTP
   family-enrollment.ts       694   live server, HTTP

script/smoke-boot.ts        183   compiles and boots api/index.ts   ← the best test in the tree

client/                       0   NO component test.  NO browser test.  NO accessibility test.
```

**Every one of the eleven reimplements the same six lines:**

```ts
const results: { name: string; passed: boolean; detail: string }[] = [];
const pass = (name, detail = "") => { results.push({…}); console.log(`  ✓ ${name}`); };
const fail = (name, detail)      => { results.push({…}); console.error(`  ✗ ${name} — ${detail}`); };
…
process.exit(failed.length > 0 ? 1 : 0);
```

**TST-F01 · There is no test framework.** No runner, no assertion library, no test discovery, no
machine-readable output, no parallelism, no per-test isolation, no coverage. **The exit code is the
entire reporting surface**, so a suite that fails on its ninth assertion and its ninetieth is
indistinguishable to CI. Stage 11 recorded the same finding; **this stage confirms it against all
eleven files rather than a sample.**

**TST-F02 · There are no frontend tests of any kind.** `client/src` contains no `*.test.*` and no
`*.spec.*`. **There is no component test, no rendering test, no keyboard-navigation test and no
accessibility check anywhere in the repository**, against a locked design system whose §23 states
**"WCAG 2.2 Level AA … mandatory for every pattern, not a later polish stage."** → **C-104**.

**TST-F03 · CI never applies `001_console_hardening.sql`.** The workflow's loop is:

```yaml
for f in migrations/00[2-9]*.sql; do …
```

**The glob starts at `002`.** Expanded against the repository it yields `002a`, `002b`, `003`, `004`,
`005`, `006` — **and never `001`.** So the `console` schema of views and the read-only role that
migration creates **do not exist in the CI database**, and every console-touching test in CI runs
against a system where the control under discussion is absent. **This is C-19's CI instance and C-73's
consequence — no new identifier is issued for it.**

**TST-F04 · CI's schema comes from `db:push --force`, not from the migrations.**

```yaml
- name: Apply schema to the CI database
  run: npm run db:push -- --force
- name: Apply SQL migrations
  run: for f in migrations/00[2-9]*.sql; …
```

**The migrations run *on top of* a schema `drizzle-kit push` has already created from `shared/schema.ts`.**
So CI proves that the application works against a pushed schema; **it proves nothing whatever about
whether the committed migrations produce that schema**, which is the only question a migration suite
exists to answer. **This is C-78, already ACTIVE — no new identifier is issued for it.**

**TST-F05 · CI pins Node 20, which reached end of security support in April 2026**, while Stage 11
locked **Node 24 LTS, pinned** as the target. **A green run is evidence about a runtime the product is
not going to run on.** Stage 11 already owns the remedy (KEEP + UPGRADE + PIN); **Stage 20 records only
the consequence for test validity, and raises nothing new.**

**TST-F06 · The integration suites share one database, one server process and one seed, and their order
is load-bearing.** `seed:school-b` must run before `test:tenant`, and the workflow says so in a comment.
**Nothing isolates one suite's writes from the next suite's reads**, so a failure late in the run cannot
be attributed without re-running the whole sequence.

**TST-F07 · Tests authenticate over HTTP with hardcoded default credentials.**
`admin` / `admin123`, `admin2` / `admin123`, overridable by environment variable but defaulted in the
source. **They exercise the deployed surface end to end, which is valuable — and it means there is no
level below "the whole server is running" at which anything can be tested.**

**TST-F08 · Coverage is not measured anywhere**, so "which consequential acts are untested" — the
question AUD-F07 deferred — cannot currently be answered by any tool in the repository.

**TST-F09 · No test asserts a database invariant directly.** Every suite except `custody-machine.ts`
asserts **HTTP status and response body**. **A guarantee that lives in a CHECK constraint, a partial
unique index, an RLS policy or a transaction boundary is tested only through the API that might one day
bypass it** — and I-2, DBI-014, the audit coupling classes and every RLS policy are exactly that kind of
guarantee.

**TST-F10 · The security suite asserts the model Stage 7 replaces.** `security-regression.ts` states its
own coverage as *"RBAC — role-gated endpoints reject wrong roles."* **Stage 7's SECAR-007 forbids
satisfying a capability check with a role string.** The suite is a correct test of current behaviour and
**it will actively resist the Stage 7 migration**, because it encodes the legacy model as the expected
one. **That is not a defect in the test; it is a fact about sequencing** (§9).

### 3.1 What is already right, and is kept

| | |
|---|---|
| **`script/smoke-boot.ts`** | **The best test in the repository, and it is not close.** It compiles **`api/index.ts` — the artefact Vercel actually runs** — and boots it under production-shaped environment variables, because `npm run build` bundles a different entry point that production never executes. Its header names **three production outages it would have caught.** **KEPT, in intent and in position: first in the pipeline, before the build** |
| **`tests/tenant-isolation.ts`'s reasoning** | *"404 rather than 403 is preferred: 403 confirms the id exists, which is itself a cross-tenant leak."* **That is exactly right**, and §19 adopts it as TEN-T's assertion rule rather than restating it |
| **the two-tenant requirement** | the workflow's own comment: *"a single-tenant run cannot prove isolation, because with one school there is no boundary to cross and every probe passes vacuously."* **Correct, load-bearing, and promoted to a principle (TST-P8)** |
| **`tests/custody-machine.ts`** | genuinely pure — imports the rules directly, no server, no database, *"deterministic and not affected by rate limits or DB state."* **This is the shape every unit test should have** |
| **cheapest-first ordering** | the workflow orders stock → payments → security → tenant → family, *"so a failure surfaces fast."* **Kept** |
| **the `concurrency` cancel group** | superseded runs on the same ref are cancelled. **Kept** |
| **CI has two jobs with a real PostgreSQL 16 service** | the integration job is not a mock. **The database is real, and §12 makes that a rule rather than a habit** |

**The tests in this repository were written by someone who understood what they were for.** Their
defect is that there is no framework beneath them, no level below the HTTP surface, and nothing at all
in front of the browser — **not that they are careless.** Several of their comments are better
reasoning than most test suites contain.

---

## 4. Test principles — TST-P1 … TST-P20

```
TST-P1    A TEST PROVES A PROPERTY, NOT A LINE.  Coverage is a diagnostic, never a target.

TST-P2    THE THING UNDER TEST IS THE THING THAT SHIPS.  smoke-boot's whole insight:
          testing a bundle production never runs proves nothing about production.

TST-P3    A GUARANTEE ENFORCED BY THE DATABASE IS TESTED AT THE DATABASE.
          An RLS policy, a CHECK, a partial unique index and a transaction boundary
          are not testable through HTTP alone.                       ── TST-F09

TST-P4    REAL POSTGRESQL.  Never SQLite, never an in-memory substitute, never a mock
          repository.  Every invariant this system has is a PostgreSQL feature, and
          none of them survives substitution.

TST-P5    NO TEST DEPENDS ON ANOTHER TEST'S WRITES.  Order dependence is a defect,
          not a configuration.                                        ── TST-F06

TST-P6    DETERMINISM IS NOT NEGOTIABLE.  No wall clock in an assertion, no unseeded
          randomness, no sleep-and-hope, no network to a third party.

TST-P7    A FLAKY TEST IS A BUG REPORT, NOT A NUISANCE.  It is telling you about a
          race, and the race is in the product more often than in the test.

TST-P8    TWO TENANTS, ALWAYS.  A single-tenant run passes every isolation probe
          vacuously.                        ── the CI workflow already says this

TST-P9    A NEGATIVE TEST IS THE POINT.  "A confirms it works" is cheap; "B cannot
          reach it, and gets 404 rather than 403" is the test that matters.

TST-P10   NO PRODUCTION DATA.  Not a dump, not a subset, not "anonymised".  Children's
          records do not enter a CI runner.                                   ── §43

TST-P11   NO REAL PROVIDER IS CALLED.  Not SES, not Sentry, not a payment provider.
          A test that can be broken by a vendor's availability is not a test.

TST-P12   THE TEST NAMES THE LOCKED REQUIREMENT IT DEFENDS.  A test with no
          identifier behind it cannot be reasoned about when it fails in two years.

TST-P13   A TEST THAT CANNOT FAIL IS NOT A TEST.  Every assertion must be shown to
          fail when the property is broken — the mutation check of §38.

TST-P14   TEST THE REFUSAL, NOT ONLY THE PERMISSION.  Every capability has a
          negative case, and it is the one that carries the security value.

TST-P15   THE PIPELINE FAILS CLOSED.  A step that cannot run is a failure, never a
          skip.  A skipped migration is how C-19 happened.

TST-P16   AN ASSERTION ABOUT AN EXTERNAL SERVICE IS AN ASSERTION ABOUT OUR CONTRACT
          WITH IT — verified against a recorded fixture, never against the service.

TST-P17   AUTOMATED ACCESSIBILITY TESTING IS A FLOOR, NOT A CEILING.  Playwright's
          own documentation says so, and §35 quotes it rather than paraphrasing it.

TST-P18   A MIGRATION TEST STARTS FROM AN EMPTY DATABASE.  Anything else tests the
          machine it ran on.                                        ── TST-F04

TST-P19   DESTRUCTIVE OPERATIONS ARE TESTED FOR THEIR REFUSALS FIRST.  A purge test
          proves what it will NOT delete before it proves what it will.

TST-P20   A GREEN PIPELINE IS NOT A CLEARANCE.  It is evidence about the properties
          named in it, and about nothing else.
```

---

## 5. The shape of this system's test pyramid

**TST-D001 · The classical pyramid is the wrong shape here, and saying so is more useful than drawing
it anyway**

The usual advice — many unit tests, fewer integration tests, a handful of end-to-end tests — assumes
**the interesting logic is in functions.** In this system it is not.

```
WHERE THIS SYSTEM'S CORRECTNESS ACTUALLY LIVES

  a CHECK constraint                CK-A1 … CK-A9 · the reason predicate
  a partial unique index            DBI-014 settlement · DBI-024 one engagement
  an RLS policy                     every tenant boundary
  A TRANSACTION BOUNDARY            I-2 — five write classes, one commit
  a capability check                CAP-001 … CAP-095, against context AND authority
  a state machine                   custody
  a rendered, focusable, contrasting DOM node   WCAG 2.2 AA

  OF THESE, EXACTLY ONE — THE STATE MACHINE — IS A PURE FUNCTION.
```

**A unit test cannot prove a transaction rolls back.** It cannot prove an RLS policy denies a read, or
that a partial unique index rejects the second insert, or that a focus ring is 3:1 against its
background. **So this system's shape is a diamond, not a pyramid:**

```
        ▲    E2E-T            few.  journeys, not features.                       §36
      ◄███►  INTEGRATION      THE WIDEST BAND.  real database, real transactions,
      ◄███►                   real constraints, real RLS.  INV-T · TEN-T ·
      ◄███►                   SEC-T · MIG-T                              §16–§33
        ▼    UNIT             genuinely pure logic only — and there is little of it §6
             COMPONENT        rendering, keyboard, focus, contrast              §34–35
```

**Naming this honestly matters**, because a team told to "write more unit tests" against this codebase
will write mocks of the storage layer — **and a mocked repository asserts that the mock behaves as
written, which is a tautology, while the RLS policy it stands in for goes untested forever.**

---

## 6. Test levels, and what each level can prove

| Level | Runs against | Can prove | **Cannot prove** |
|---|---|---|---|
| **Unit** | imported functions, no I/O | state-machine rules, pure calculations, validation schemas, formatters | anything involving persistence, authority, tenancy or a transaction |
| **Database** | a real PostgreSQL, direct SQL, **as a named role** | CHECK constraints · unique indexes · **RLS policies** · FK behaviour · trigger refusals | that the application uses them |
| **Integration** | the application's command and query layer, against a real database, **in-process** | **transaction boundaries** · I-2 · audit coupling · capability enforcement · the resolve-then-authorise chain | that the HTTP layer wires it up |
| **API / contract** | the HTTP surface, in-process, no browser | status codes · response shapes · error contracts · headers · rate limits | that the UI uses them correctly |
| **Component** | a rendered component in a real browser | rendering · keyboard operability · focus order · **contrast** · ARIA | that the whole journey works |
| **End-to-end** | the built application in a real browser | that a person can complete a journey | **anything precise about why it failed** |
| **Smoke / boot** | **the compiled `api/index.ts`** | that the artefact production runs actually starts | any behaviour beyond `/api/health` |

**TST-D002 · Every property is tested at the lowest level that can actually prove it, and at exactly one
level**

**Testing the same property at four levels does not make it four times safer** — it makes four tests
fail for one cause, and it makes the suite slow enough that people stop running it. **The exception is
deliberate and small: an invariant with a locked identifier may additionally appear in an E2E journey**,
because a journey failing is how a person finds out, and §36's list is short enough to afford it.

---

## 7. Framework selection — the runner

**TST-D003 · Vitest, on first-party evidence, and for one structural reason**

```
VERIFIED FROM THE VITEST MIGRATION GUIDE, 31 August 2026
   "Vitest 4.0 requires Vite >= 6.0.0"       ── the project is on Vite 7.1        ✔
   "Vitest 4.0 requires Node.js >= 20.0.0"   ── Stage 11 targets Node 24 LTS      ✔
```

**The structural reason is that this project already has a Vite toolchain, and Vitest uses it.** The
same transform pipeline, the same `resolve.alias`, the same TypeScript handling, the same ESM
semantics. **The alternative is a second toolchain that must be kept in agreement with the first**, and
"the tests compile differently from the application" is a class of confusion this restructure exists to
remove.

| Candidate | Verdict |
|---|---|
| **Vitest** | **SELECTED.** Shares the Vite 7.1 pipeline · ESM-native · Node 24 satisfied · browser mode covers §34 with the same config |
| Jest | **REJECTED.** A second toolchain with its own transform story; ESM support is workable but is not free, and the project has no reason to pay for it |
| **the current hand-rolled scripts** | **REJECTED as a framework, PRESERVED as tests.** §9 |
| node:test | **REJECTED.** Adequate for the server, but leaves §34 and §35 with no answer at all |

**Not installed by this stage.** Stage 21 installs it, pinned, after confirming the resolved version
against the lockfile.

**TST-D004 · The eleven existing suites are not rewritten in order to adopt it.** §9.

---

## 8. Framework selection — the browser and the accessibility tool

**TST-D005 · Playwright, once, serving both component tests and end-to-end tests**

Verified from the Vitest browser-mode guide: **Browser Mode supports a Playwright provider**, and
Playwright is *"recommended for new projects"* there because it *"supports parallel execution."*

```
ONE BROWSER TOOLCHAIN, TWO CONSUMERS
   Vitest Browser Mode + Playwright provider  ──►  COMPONENT tests        §34
   Playwright directly                        ──►  E2E journeys           §36
                                              ──►  ACCESSIBILITY scans    §35
   one browser download · one CI cache · one set of selectors · one debugging story
```

**TST-D006 · `@axe-core/playwright`, on Playwright's own recommendation — and its stated limit is
recorded, not softened**

Playwright's accessibility documentation recommends the package and the `AxeBuilder` API. **It also
says this, and §35 quotes it because it changes what may be claimed:**

> *"Automated accessibility tests can detect some common accessibility problems such as missing or
> invalid properties. But many accessibility problems can only be discovered through manual testing."*

**So an axe scan passing is not evidence of WCAG 2.2 AA conformance**, and Stage 20 does not let a
green pipeline stand in for the design system's contract. §35 says what it does and does not buy.

**One residual, recorded rather than inferred.** Playwright's release notes document up to **1.62** and
state that Node 16 support was removed at 1.54 and Node 18 deprecated; **they do not state a Node floor
for 1.62.** Against a Node 24 target this is very unlikely to bite — **and "very unlikely" is not
"verified", so Stage 21 confirms the resolved version's engine requirement at install time rather than
this stage asserting it.**

---

## 9. What happens to the eleven existing suites

**TST-D007 · They are PRESERVED, ADOPTED and MIGRATED — never deleted for being old**

**The ABSOLUTE SAFETY RULE applies to tests exactly as it applies to code.** These eleven suites are
the only executable knowledge anyone has about how this system behaves. **Deleting them to write
"proper" tests would destroy the baseline before the replacement exists.**

```
DISCOVER   read — done, all eleven, §3
UNDERSTAND what property each one actually defends
PRESERVE   keep running them, unchanged, while the replacement is built
COMPARE    map each assertion to a locked identifier — §44's table
SELECT     which level it belongs at
CONSOLIDATE fold duplicates into one owner
MIGRATE    port assertion by assertion, not file by file
VERIFY     the ported test fails when the property is broken — TST-P13
DEPRECATE  mark the original superseded
REMOVE     only when the port is green and the owner approves
```

| Suite | Disposition |
|---|---|
| `smoke-boot.ts` | **KEEP AS IS.** Not ported, not rewritten. It is a build-artefact check, not a unit test, and Vitest would add nothing to it |
| `custody-machine.ts` | **PORT FIRST** — it is already pure, so it is the cheapest proof the runner works |
| `tenant-isolation.ts` | **PORT TO TEN-T**, and **extend downward**: its HTTP probes stay, and the same boundaries gain database-level tests it cannot express |
| `stock-idempotency.ts` · `payment-idempotency.ts` | **PORT TO INV-T** — they are invariant tests wearing HTTP clothes |
| `payment-verification.ts` · `family-enrollment.ts` · `enrollment-import.ts` · `teacher-distribution.ts` · `staff-parent.ts` | **PORT TO INTEGRATION**, against the command layer rather than the server where the assertion allows it |
| `test-superuser.ts` | **PORT TO SEC-T** — a kill switch is a security control |
| `security-regression.ts` | **PORT WITH A FLAG ON IT** — see below |

**TST-D008 · `security-regression.ts` is ported last, and its role-based assertions are marked
SUPERSEDED-ON-MIGRATION rather than deleted**

**It asserts that role-gated endpoints reject the wrong role. Stage 7 replaces role gating with
capability checks, and SECAR-007 forbids satisfying a capability check with a role string.** So on the
day the Stage 7 model lands, **these assertions will fail — correctly.**

```
THE WRONG RESPONSE   delete the assertions so the suite goes green
THE RIGHT RESPONSE   each role assertion is paired NOW with the capability assertion
                     that must replace it, and the pair flips together
                     ── the role assertion proves TODAY is not broken
                     ── the capability assertion proves TOMORROW is right
```

**A test suite going green because someone removed the failing assertion is the single most dangerous
event that can happen to a rebuild**, and it is likeliest at exactly this moment. **Naming it now is
cheaper than catching it later.**

---

## 10. Test data strategy

**TST-D009 · Test data is constructed by named builders, never by a shared fixture file everyone edits**

```
FORBIDDEN   a global seed that every test reads and one test mutates      ── TST-F06
            "school A always has 400 children" as an ambient assumption
            a fixture whose meaning is a row id memorised by the author

REQUIRED    aSchool()  aChild()  aGuardian()  aBundle()  aSettlement()
            each returns the MINIMUM valid object, with overrides
            each test states the data it depends on, in the test
```

**A test that reads `child_id = 42` is a test nobody can safely change.** A test that reads
`aChild({ inClass: yearThree })` states its own precondition, and the next person can tell whether the
precondition still matters.

**TST-D010 · Personal data in fixtures is obviously synthetic, and looks it**

`Ada Lovelace` and `guardian+test@example.invalid`, never a plausible-looking real name and never a
real-looking email domain. **`.invalid` is reserved by RFC 2606 precisely so that nothing can ever
deliver to it** — which matters more here than usual, because §29's notification tests exist to prove
mail is *not* sent.

---

## 11. Fixtures and seeding

**TST-D011 · Three tiers, and the boundaries between them are strict**

| Tier | Contents | Lifetime |
|---|---|---|
| **STRUCTURAL** | the schema, the roles, the RLS policies — **created by the migrations, never by a seed script** | per database |
| **REFERENCE** | genuinely static rows the product cannot function without | per database, read-only to tests |
| **CASE** | everything a specific test needs | **created and rolled back inside that test** |

**TST-D012 · `script/seed-school-b.ts` becomes a fixture builder, not a pipeline step**

The workflow currently runs it as a step, and `test:tenant` depends on that step having happened —
which is TST-F06's order dependence in its most load-bearing form. **The second tenant is not a
pipeline concern; it is a precondition of the tenancy tests, and it belongs inside them**, so that
running one tenancy test in isolation is possible.

**TST-D013 · Seeding through the API is not seeding.** The workflow's
`curl -X POST /api/seed-users` builds test state by exercising the code under test. **If sign-up is
broken, the seed fails, and every downstream failure is a symptom of one cause reported eleven times.**
Case data is created directly, in a transaction, by the builders.

---

## 12. The database a test runs against

**TST-D014 · A real PostgreSQL of the same major version as production, and nothing else — TST-P4**

**This is not a preference.** Enumerate what is under test and the alternative disappears:

| Under test | Survives SQLite? | Survives a mock? |
|---|---|---|
| RLS policies | **no — the feature does not exist** | **no** |
| `CREATE INDEX … WHERE` partial uniques (DBI-014, DBI-024, DBI-034) | **no** | **no** |
| CHECK constraints with multi-column predicates (CK-A1 … CK-A9) | partially, differently | **no** |
| `SELECT … FOR UPDATE SKIP LOCKED` (Stage 18's leases) | **no** | **no** |
| transaction isolation and rollback (I-2, audit Class A) | differently | **no** |
| `jsonb` allowlist behaviour | **no** | **no** |

**A mocked storage layer would assert that the mock behaves as its author wrote it.** That is a
tautology dressed as a test, and it is how a system arrives at 90% coverage and a cross-tenant leak.

**TST-D015 · The CI database's schema comes from the migrations, applied in order, from `001` — and
`db:push` never touches it**

**This reverses TST-F04, and it is the single highest-value change in this document.**

```
TODAY      db:push --force  ──►  schema
           then migrations 002…006 on top          ← so the migrations are never the source
           and 001 never at all                    ← C-19

TARGET     EMPTY DATABASE
           ──►  migrations, IN ORDER, FROM 001, ALL OF THEM
           ──►  THAT is the schema
           ──►  db:push is not run in CI, at all, ever
           ──►  a separate check asserts the migrated schema MATCHES shared/schema.ts   §32
```

**C-78 records that CI pushes schema without review; C-19 records that `001` cannot run on a fresh
database and is skipped.** Stage 20 does not close either — **but it states plainly that until `001` is
made runnable on an empty database, the migration suite cannot exist**, which converts C-19 from a
documentation problem into a scheduling one. **§32 and §49.2 hand that to Stage 22.**

---

## 13. Isolation between tests

**TST-D016 · Transaction rollback by default; a template database where rollback is impossible**

```
DEFAULT          BEGIN ─► the test ─► ROLLBACK
                 fast · perfectly isolated · no cleanup code to forget
                 covers unit, database and most integration tests

WHERE ROLLBACK   a test OF a transaction boundary — I-2, audit Class A rollback (§17, §18)
CANNOT WORK      a test spanning two connections — RLS under a second role, lease contention
                 a test of a migration                                              §32

THEN             a per-worker database, created from a TEMPLATE built once by the
                 migrations, dropped after the worker finishes
                 ── CREATE DATABASE … TEMPLATE is a file copy, not a re-migration
```

**TST-D017 · Parallelism is per-worker-database, never per-test-truncation**

`TRUNCATE` between tests is slower than it looks and **destroys the reference tier along with the case
tier**, which is how a suite acquires an invisible dependency on the order in which it re-seeds.

---

## 14. Determinism, the clock and randomness

**TST-D018 · The clock is injected, and no assertion reads the wall clock — TST-P6**

**This is not a testing convenience; it is already a locked property of the system.** Stage 15's
**DB-P19** forbids a predicate that reads the wall clock, and Stage 19 checked every CHECK and index
against it. **A test that computes an expected timestamp from `new Date()` re-introduces at test time
exactly the non-determinism the schema was designed to exclude.**

```
FORBIDDEN   expect(row.expires_at).toEqual(new Date(Date.now() + 7*86400_000))
            ── passes at 14:59:59.400 and fails at 14:59:59.600

REQUIRED    the clock is a dependency, the test sets it, the assertion is exact
            ── and the 7-day cooldown (§30) becomes testable instead of approximable
```

**TST-D019 · Randomness is seeded, and identifiers are not asserted for their value**

A test asserts *that* an identifier is a UUID and *that* two calls produced different ones — **never
that it equals a particular string.** The one exception is a **stable key**: `AET-035`'s
`settlement.confirmed` is asserted exactly, because §8's whole point is that it never changes.

**TST-D020 · No `sleep`. Ever.**

```
FORBIDDEN   await sleep(500); expect(job.status).toBe("done")
REQUIRED    drive the scheduler directly and assert its return
            ── Stage 18's jobs are invoked through API-278, which is callable in-process
```

**A sleep is a bet on a machine's speed**, and CI runners are slower and more variable than laptops.
Every flaky suite in the industry started with one `sleep` that worked on its author's machine.

---
---

## 15. The two-tenant rule

**TST-D021 · Every tenancy assertion runs with at least two schools, and the second one is not empty**

The workflow already states the reasoning, and it is worth preserving verbatim because it is the
clearest sentence about testing anywhere in the repository:

> *"Tenant isolation needs TWO seeded schools — a single-tenant run cannot prove isolation, because
> with one school there is no boundary to cross and every probe passes vacuously."*

**One refinement Stage 20 adds: the second school must hold data of the same shape as the first.**

```
INSUFFICIENT   school B exists                     a probe for B's child returns 404 because
                                                   THERE IS NO CHILD, not because scoping worked

REQUIRED       school B has a child, a family, a bundle, a settlement and an allocation
               ── every probe must have a REAL row on the other side that the
                  boundary is refusing to hand over
```

**A 404 for a row that does not exist is indistinguishable from a 404 for a row that is being
protected** — and only one of those is the property under test.

---

## 16. Invariant tests — INV-T01 … INV-T14

**These defend properties that locked stages state as invariants. Each names its source.**

| INV-T | Property | Defends | Level |
|---|---|---|---|
| **INV-T01** | **I-2 commits as one transaction**: settlement review, allocation, stock movement, stock-level projection, the required notification fact and the required audit fact all become visible together, or none does | Stage 18 §9 · Stage 19 AX-4 | integration |
| **INV-T02** | **I-2 rolls back completely** when any one of the six writes fails — asserted per write, six times | I-2 | integration |
| **INV-T03** | **A settlement cannot be confirmed twice**, and the second attempt is refused by **DBI-014**, not by application logic | Stage 15 DBI-014 | database |
| **INV-T04** | **Audit deduplication does not stop a business act** — DBI-034 rejects duplicate *evidence* while the business path's own idempotency is what refuses the act | Stage 19 AUD-D056 | database |
| **INV-T05** | **The stock projection matches the movement history** — `stock_levels` recomputed from `stock_movements` equals the stored projection, after a concurrent pair of writes | Stage 15 · Stage 18 | integration |
| **INV-T06** | **Custody transitions follow the state machine** — every legal transition allowed, every illegal jump refused | the ported `custody-machine.ts` | unit |
| **INV-T07** | **Custody history is append-only** — no path updates or deletes a `custody_events` row | Stage 15 | database |
| **INV-T08** | **`school_lifecycle_events` is append-only, and purge eligibility is read from it** — never from an audit event | Stage 19 AUD-D029 · DM-054 | database |
| **INV-T09** | **A hand-over cannot precede the custody transfer that enables it** | Stage 6 · Stage 19 AET-043/095 | integration |
| **INV-T10** | **A replacement charge decision cannot exist without a review** | Stage 6 · CAP-069 → CAP-070 | integration |
| **INV-T11** | **Domain history is never written by the audit path**, and audit is never written by the domain path — the two writers are distinct | Stage 19 AUD-D001 · AUD-D055 | integration |
| **INV-T12** | **One support engagement per platform actor, across all tenants** — DBI-024's global partial unique refuses the second | Stage 15 DBI-024 | database |
| **INV-T13** | **A money event's amount is never mutated** — corrections append | Stage 6 | database |
| **INV-T14** | **An allocation cannot outlive its supply cycle's close** without an explicit exception record | Stage 6 | integration |

**TST-D022 · An invariant test asserts the database's refusal, not the application's**

```
WEAK      call the API twice, assert the second returns 409
          ── proves the route checks.  Proves NOTHING about a second route,
             a migration script, a console operation or a future bug.

STRONG    insert the second row directly, assert PostgreSQL raises
          ── proves the invariant holds against EVERY writer, present and future
BOTH      the strong test is required; the weak one is kept as the contract test  §26
```

---

## 17. I-2 and transactional coupling

**AY-2 · The I-2 test, in full**

```
GIVEN   a school, a child, a requirement item, stock, and a pending settlement review
WHEN    finance confirms the settlement under AUTH-FINANCE with CAP-049

THEN    ALL SIX ARE VISIBLE TOGETHER
          settlement_reviews   the decision
          allocations          the allocation
          stock_movements      the movement
          stock_levels         the projection, by conditional UPDATE
          notifications        the required notification fact          MOD-009
          audit_events         the required audit fact  AET-035 · CLASS A   MOD-013

AND     NO provider was called · NO email left · NO Sentry event was sent
        ── asserted by a network guard that FAILS THE TEST on any outbound socket
```

**TST-D023 · The negative half is the half that matters, and it is asserted six times**

For each of the six writes, the test forces that one write to fail and asserts **the other five are
absent**. Six tests, one per write, because *"the transaction rolls back"* asserted once proves only
that the first failure path works.

**TST-D024 · The audit rollback test is asserted explicitly, because it is the one people will
"optimise" away**

```
GIVEN   audit persistence is made to fail — a constraint violation on audit_events
WHEN    a settlement confirmation is attempted
THEN    THE SETTLEMENT DOES NOT COMMIT                              AD-026 · AUD-D021
AND     no allocation exists, no stock moved, no notification exists

AND, IN THE SAME FAMILY, THE ASYMMETRY:
        Sentry unavailable        ⇒  I-2 COMMITS
        the log sink unavailable  ⇒  I-2 COMMITS
        the email provider down   ⇒  I-2 COMMITS                     OPS-D038
```

**Stage 19 §39 asked for exactly this test by name.** It is the one that stops a future engineer
"fixing an availability issue" by moving the audit insert outside the transaction — **which would look
like an improvement, pass every other test in this document, and silently end AD-026.**

**TST-D025 · The outbound-network guard is a test-harness control, not a hope**

Any attempt to open a socket to a non-localhost address during an integration test **fails that test**.
TST-P11 is not enforceable by asking people to remember it.

---

## 18. Audit coupling tests

**Stage 19 locked 102 events with a per-event class in its own §8.10 matrix. That matrix is
machine-readable intent, and this section is where it becomes machine-checked.**

| Test | Asserts |
|---|---|
| **coupling parity** | **for every Class A event: the business act and its audit event share a transaction** — driven from Stage 19's matrix, not from a hand-written list |
| **Class B durability** | for every Class B event: the event is committed in its own transaction, `occurred_at ≠ recorded_at` is permitted, and a failure raises the §30 alert |
| **no impossible Class A** | **no event whose act is asynchronous is marked Class A** — the matrix is re-derived and compared, so a future edit cannot quietly promote one |
| **taxonomy coverage** | **every one of the 67 `AUDIT`-marked capabilities has at least one AET** — Stage 19's coverage claim, re-checked in CI against `PERMISSIONS.md` rather than trusted |
| **allowlist enforcement** | a `safe_metadata` key not on its AET's allowlist is **rejected at write time**, and for a Class A event that rejection rolls the business act back |
| **prohibited content** | no audit row ever contains a password, hash, MFA secret, TOTP code, recovery code, session identifier, reset token, invite token, signed URL or provider credential — AUD-D005, asserted by scanning every written row in the whole suite |
| **actor honesty** | **CK-A7 refuses a system or integration event that carries a context, an authority or a capability** — no invented person, no invented CAP |
| **scope honesty** | CK-A2 refuses a `school` event with a NULL `school_id`, and refuses a `platform` or `identity` event that has one |
| **reason enforcement, both directions** | a `required` event with no reason is refused; a `forbidden` event carrying one is refused — AUD-D057 |
| **identity-scope unreachability** | **an identity-scoped event is not readable from any tenant context** — AUD-R13, and it is a database-level test under a tenant role |
| **intent without outcome** | a privileged operation killed mid-run leaves a detectable orphaned intent — AUD-D063 |
| **immutability** | the application role cannot `UPDATE` or `DELETE` an audit event; the refusal trigger fires even if the privilege is restored — AUD-D040, **both mechanisms tested separately, because their whole point is that they fail differently** |

**TST-D026 · The coverage test reads `PERMISSIONS.md` and the AET matrix as data**

**This is the test that would have caught the 33-capability gap Stage 19 found by hand**, and it is
cheap: parse both registers, assert the mapping is total. **A specification that can be checked
mechanically and is not is a specification that will drift.**

---

## 19. Tenancy tests — TEN-T01 … TEN-T12

**TST-D027 · The assertion rule is adopted from the existing suite, unchanged**

> *"School A's session, asking for a resource belonging to school B, must get 404 (or 403) — never 200,
> and never a body carrying B's data. 404 rather than 403 is preferred: 403 confirms the id exists,
> which is itself a cross-tenant leak."*

**That is correct and Stage 20 does not restate it in its own words.**

| TEN-T | Probe |
|---|---|
| **TEN-T01** | **every school-scoped route**, driven from the API register — A's session, B's identifier, expect 404 · **generated from API-001 … API-282, so a new route is covered the day it is added** |
| **TEN-T02** | the response **body** never contains B's data, even on a 200 that was expected for a different reason |
| **TEN-T03** | a **list** endpoint under A's session returns no row belonging to B — including on page two |
| **TEN-T04** | **RLS denies at the database**, under a tenant role, with the application bypassed entirely — §20 |
| **TEN-T05** | a person with membership in **two** schools sees exactly one school's data per active context, and switching context switches the data |
| **TEN-T06** | **identity-scoped audit is invisible to both** of that person's schools — AUD-D061 · AUD-R13 |
| **TEN-T07** | a **platform** actor without an open engagement reaches no tenant data |
| **TEN-T08** | a support action inside A **is visible to A** — SECAR-018 · AUD-D016 |
| **TEN-T09** | a support action inside A **is not visible to B** |
| **TEN-T10** | a **guardian** with children at two schools sees each child's data under that child's school, and never the two mixed |
| **TEN-T11** | a **teacher** sees only their own classes — SC-3 |
| **TEN-T12** | **a suspended school's data is unreachable**, and a platform suspension is distinguishable from a school-level one — Stage 18 OPS-D070 |

**TST-D028 · TEN-T01 is generated, not written**

Eleven hand-written probes covered eleven routes; the API contract has **282**. **A hand-maintained
isolation suite falls behind the first week someone adds a route**, and the route they add is as likely
as any other to be the leaking one. **The register is the input; the tests are the output.**

---

## 20. RLS tests

**TST-D029 · RLS is tested as the database, by a role, with the application absent**

```
CONNECT AS         the tenant application role — NEVER a superuser, NEVER the owner
                   ── an owner bypasses RLS, so a test run as owner passes vacuously
                      and proves the exact opposite of what it appears to
SET                the tenant context the policy reads
ASSERT             SELECT returns this school's rows and no others
                   UPDATE and DELETE cannot reach another school's rows
                   INSERT cannot create a row attributed to another school
```

**TST-D030 · The bypass test is mandatory, and it is the one people forget**

```
FOR EVERY TENANT TABLE
   1. with the context SET      ── the school's own rows are returned          expected
   2. with the context UNSET    ── ZERO rows, never all rows                   ← THE TEST
   3. as a role WITHOUT bypass  ── the policy is enforced                      ← THE TEST
   4. with the context set to ANOTHER school  ── zero rows of the first        ← THE TEST
```

**Step 2 is where `NULL means everything` bugs live.** Stage 15 corrected exactly that defect in
`cron_job_runs`, and Stage 19 refused to repeat it in `audit_events` — **so the test that would have
caught it originally is worth having permanently.**

**TST-D031 · Every table Stage 15 marks tenant-scoped is enumerated from the catalogue, and a table
with no policy fails the suite**

**A missing RLS policy is silent.** Nothing errors; the table simply returns everything. **So absence is
what the test looks for**, driven from DBT-001 … DBT-080 rather than from a list someone maintains.

---

## 21. Capability and authority tests

**TST-D032 · Every capability is tested twice — granted and refused — and the refusal is the valuable
half**

```
FOR CAP-001 … CAP-095
   WITH the capability      ── the act succeeds                       TST-P14
   WITHOUT it               ── the act is REFUSED, and the refusal reveals nothing
```

**TST-D033 · Context and authority are asserted as two separate facts, because PA-1 makes them two**

```
PA-1's case, made executable:
   a person holding school_admin AND AUTH-FINANCE, in the school_admin context
   confirms a settlement under CAP-049

   ASSERT the audit event records BOTH
      actor_context_kind = school_admin
      actor_authority    = AUTH-FINANCE
   ── a single "role" field cannot express this, so a test that asserts one field
      would pass against an implementation that has silently lost the distinction
```

**TST-D034 · A role string must not satisfy a capability check — SECAR-007, asserted directly**

```
GIVEN   a session whose role string would have passed the legacy check
AND     the capability is NOT granted
WHEN    the act is attempted
THEN    IT IS REFUSED
```

**This is the test that makes the Stage 7 migration verifiable rather than aspirational**, and it is
the one §9's TST-D008 pairs with each superseded role assertion.

**TST-D035 · PA-2 is asserted: account recovery requires a support engagement**, and an attempt without
one is refused.

---

## 22. Security tests — SEC-T01 … SEC-T18

**Driven from Stage 16's locked control set. Each names the control it defends.**

| SEC-T | Asserts |
|---|---|
| **SEC-T01** | an unauthenticated request reaches no authenticated route — the whole register, generated |
| **SEC-T02** | **MFA is required when AUTH-SCHOOL or AUTH-FINANCE is exercised** — SECQ-2 = A, **authority-keyed, not role-keyed** |
| **SEC-T03** | **MFA enrolment and disabling require the current password** — SEC-F21 · **C-90**, which is currently NOT true in the code, so this test is expected to fail until it is fixed. **It is written failing on purpose** |
| **SEC-T04** | a recovery code is single-use **under concurrency** — two simultaneous redemptions, exactly one succeeds |
| **SEC-T05** | the pending MFA secret is not readable before enrolment completes, and is destroyed on abandonment |
| **SEC-T06** | **password reset is atomic**: token consumption, password write and session revocation commit together or not at all |
| **SEC-T07** | a reset token is single-use, expires, and is not accepted after a password change by another route |
| **SEC-T08** | **AUTH-FAMILY sessions expire per SECQ-1 = B — 7 days idle, 7 days absolute** |
| **SEC-T09** | session identifiers rotate on privilege change |
| **SEC-T10** | rate limits engage per account and per address, and **the limiter's own storage is durable** — DBT-076 |
| **SEC-T11** | **no secret ever appears in a log, an audit row, an error body or a stack trace** — BR-124 · C-18 · AUD-D005, asserted by scanning every artefact the suite produces |
| **SEC-T12** | the security headers ship, **including the second CSP source and HSTS preload** — A16-001 |
| **SEC-T13** | input validation refuses malformed input at the boundary, and the refusal does not echo the input |
| **SEC-T14** | parameterisation holds — an injection probe against every string parameter changes no row |
| **SEC-T15** | **the console's read tier cannot write**, under its own role, with a data-modifying CTE and with a second statement after a semicolon — **the two bypasses `001`'s header names explicitly** |
| **SEC-T16** | break-glass requires fresh authentication, records the *fact* and never the code — AUD-D031 |
| **SEC-T17** | an elevation expires, and an operation after expiry is refused |
| **SEC-T18** | **the test-superuser kill switch cannot be enabled in a production-shaped environment** — the ported `test-superuser.ts` |

**TST-D036 · SEC-T03 and SEC-T15 are DEFINED / NOT YET ACTIVATED — they are not permanently-red
tests on a protected branch**

**A correction to this document's own draft, which said these two "are written failing on purpose" and
"are the only two tests permitted to be red on adoption." That normalises exactly the wrong thing.**

The test-first instinct behind it is right. **The branch policy attached to it was not.** A protected
branch whose owners have learned to expect a red square is a protected branch with no signal left, and
"the security test is supposed to be failing" is a sentence that survives long after the reason for it
has been forgotten.

```
THE CORRECTED RULE — RED LIVES INSIDE THE IMPLEMENTATION BATCH, NEVER ON MAIN

   write / activate the regression test
        ↓
   DEMONSTRATE RED against the known defect        ← the proof the test can fail
        ↓
   implement the correction
        ↓
   DEMONSTRATE GREEN
        ↓
   ONLY THEN merge the batch

PROTECTED TARGET BRANCH:  every mandatory ACTIVE test is GREEN.
NEVER, for a known security test:  expected-failure · todo-skip · allow_failure ·
                                   continue-on-error
```

**Before its batch lands, each of these is `DEFINED`, not `ACTIVE / EXPECTED RED`** — §39's activation
model is what makes that a real distinction rather than a euphemism for "off".

| Test | State now | Becomes ACTIVE and GREEN in |
|---|---|---|
| **SEC-T03** — MFA enrolment and disabling require the current password | **DEFINED** | **the MFA implementation batch that closes C-90.** The batch demonstrates red against today's code, then green |
| **SEC-T15** — the console read tier cannot write | **DEFINED** · **BLOCKED-EXTERNAL** on the console role and schema existing | **the batch in which Stage 21's console provisioning and Stage 22's migration work land.** Until then there is no `console_ro` role in CI to test against — TST-F03, C-19 |

**The requirement exists either way, and that is the point.** A `DEFINED` test is written down, owned,
named against its conflict, and blocks its batch from being called complete. **What it does not do is
sit on main as a red square that everyone has agreed to ignore.**

---

## 23. Authentication, session and credential tests

**TST-D037 · The identity family runs against the real session store, because that is where its bugs
are**

`DBT-075 user_sessions` has its shape fixed by the library Stage 11 selected. **A test that mocks the
store proves the mock expires sessions.** Idle and absolute expiry, revocation-everywhere, and
concurrent sign-ins are all properties of the store's rows.

**TST-D038 · Argon2id migration is tested as a migration, not as a replacement**

```
GIVEN   an account whose password is a bcryptjs hash          the current state
WHEN    that person signs in correctly
THEN    the sign-in SUCCEEDS
AND     the stored hash is now Argon2id
AND     the next sign-in succeeds against the new hash
AND     THE OLD HASH IS NOT RECOVERABLE FROM ANYWHERE
```

**A rehash-on-login path that fails closed locks every existing user out of a live product**, which is
why it is tested from the *old* state rather than from a fresh Argon2id account.

---

## 24. Rate limiting, validation and injection

**TST-D039 · A rate-limit test asserts the limit, the window and the recovery — never just the 429**

```
ASSERT   the Nth request is refused
AND      the (N-1)th was not
AND      a DIFFERENT account is unaffected     ← the test that catches a global limiter
AND      a DIFFERENT address is unaffected
AND      the window ELAPSES and access returns  ← with an INJECTED clock, never a sleep
```

**TST-D040 · Validation is tested at the schema, and the boundary is tested for its refusal shape**

Zod schemas are pure and belong at unit level. **What belongs at the boundary is that a refusal is a
400 with a stable error contract and no echo of the submitted value** — because an error body that
reflects input is how a validation layer becomes an exfiltration surface.

---

## 25. Prohibited content and secret leakage

**TST-D041 · Leakage is tested by scanning everything the suite produced, not by checking the places
someone thought of**

```
AFTER THE WHOLE SUITE RUNS, SCAN
   every log line the application emitted
   every audit_events row written
   every error response body returned
   every notification payload constructed
   every export artefact produced

FOR   the fixture passwords · the fixture tokens · the fixture MFA secrets
      the fixture recovery codes · any signed URL · any provider credential

ANY HIT FAILS THE RUN.
```

**Because the fixtures' secret values are known to the harness, this is exact** — no heuristic, no
entropy guess, no regex for "things that look like a key". **It is the strongest form of BR-124 that
automation can express**, and it catches the leak that happens in the path nobody wrote a test for.

---

## 26. API contract tests

**TST-D042 · The API register is the source; the tests are generated from it**

API-001 … API-282 are locked. For every route: **the method and path exist**, the authenticated and
unauthenticated behaviours match the register, the error contract is the locked one, and **a route not
in the register fails the suite.**

**TST-D043 · An undocumented route is a failure, not a warning.** A route the register does not contain
is a route no stage has reviewed for tenancy, capability or audit — **and the register is the only
reason anyone believes those reviews happened.**

**TST-D044 · The contract test does not re-test behaviour.** It asserts *shape*. Behaviour is §16–§21's,
at the level that can actually prove it — TST-D002.

### 26.1 The legacy route cutover register — how TST-D043 survives Stage 22

**TST-D043's final rule is not weakened: at final cutover, a registered server route not represented
in the locked API contract FAILS CI.** But between now and then, Stage 22 will have target routes and
legacy routes alive at the same time, and a rule that cannot describe that state will be switched off
the first week it is inconvenient — **which is how a permanent allowlist is born.**

**TST-D080 · The contract test recognises three kinds of route, and "it exists today" is not one of
them**

| Kind | Meaning | CI |
|---|---|---|
| **TARGET ROUTE** | present in the locked API register, API-001 … API-282 | **required** |
| **LEGACY-BRIDGE ROUTE** | not in the register, present in the **LEGACY ROUTE CUTOVER REGISTER** with every field below filled | **tolerated, and counted** |
| **REMOVED ROUTE** | in neither | **FAILS CI** |

```
A ROUTE IS NOT ALLOWED MERELY BECAUSE IT EXISTS TODAY.
Every legacy-bridge entry carries, or it is not an entry:

   legacy route identifier and path
   the API-nnn identifier that REPLACES it
   why it is still present
   the removal batch
   the target removal gate

AT FINAL CUTOVER:  the legacy allowlist is EMPTY
                   unless a LOCKED compatibility requirement explicitly remains.
```

**The register is owned by Stage 22** — it is a cutover artefact, and Stage 22 owns cutover. **Stage 20
owns only the rule that CI reads it, counts it, and fails when an entry has no removal batch.** An
allowlist entry with no exit is indistinguishable from a permanent exception, so the schema of the
entry is the control.

---

## 27. Integration and provider tests

**TST-D045 · No provider is ever called. The contract is tested against recorded fixtures — TST-P11 ·
TST-P16**

```
FORBIDDEN   a test that calls SES, Sentry, a payment provider or any external host
            ── it fails when the vendor has an incident, teaching everyone to
               re-run red builds until they go green, which is how a real failure
               gets ignored

REQUIRED    RECORDED first-party fixtures — a real captured response, stored,
            with its date and its source URL
            ── what is tested is OUR handling of THEIR contract
```

**TST-D046 · Signature verification is tested with a valid signature, an invalid one, a replayed one
and a missing one** — and the last three are all refused, producing **AET-057**.

**TST-D047 · A raw provider payload never reaches audit or logs** — Stage 17 INT-P8 · AUD-D034,
asserted by §25's scan.

**TST-D048 · Each school's own provider account is honoured** — INTQ-1 = A. **A callback carrying
school A's provider reference must never settle against school B**, and that is a tenancy test as much
as an integration one.

---

## 28. Notification and email tests

**TST-D049 · The primary assertion is that mail is NOT sent**

```
ASSERT   no message left the process                    ── the network guard, §17
AND      the notification FACT exists in DBT-053        ── which is what I-2 requires
AND      the delivery ATTEMPT is a separate record      ── DBT-054
AND      a suppressed address produces no attempt       ── DBT-078, A15-002
AND      a bounce does NOT mark an identity unverified  ── Stage 17's locked distinction
```

**The notification fact and the delivery are two things, and Stage 18 made that separation load-bearing
for I-2.** A test that asserts "an email was sent" would collapse them and would fail on the day the
provider changes — **which is the wrong reason for a settlement test to go red.**

**TST-D050 · The school's display identity is asserted, not ScholarShelf's** — INTQ-2 = C.

---

## 29. Job, scheduler and lease tests

**TST-D051 · Jobs are invoked directly through API-278 — never awaited on a timer**

Stage 14 locked `POST /api/internal/jobs/run` as the scheduler target, and **it is callable in-process**,
which is what makes TST-D020's no-sleep rule affordable rather than aspirational.

| Test | Asserts |
|---|---|
| **lease acquisition** | two workers, `FOR UPDATE SKIP LOCKED`, **exactly one takes the job** |
| **expired-lease reclaim** | a lease past expiry is reclaimable, and the original holder's late write is refused |
| **fairness** | one large tenant does not starve the others — Stage 18's fairness ordering, asserted over a shaped queue |
| **idempotency** | a job run twice produces one effect — DBT-070 |
| **failure and retry** | a failed job records its failure, retries within its bounds, and stops |
| **the audit fact** | a job's own audit event is `actor_kind = 'system'` with a `system_job_id` and **no person, no authority, no capability beyond CAP-093** — AET-100 · CK-A7 |
| **the endpoint is internal** | API-278 is unreachable without its own authentication, from outside |

---

## 30. Import tests

**TST-D052 · The import family tests the staging boundary, not just the happy path**

**TST-D081 · Two different guarantees, and this document's draft collapsed them into one wrong test**

The draft asserted *"a file with one invalid row commits nothing, and the report names the row."*
**Re-read against final locked Stage 18, that is not the target behaviour**, and testing it would have
frozen the opposite of what OPS-D021 decided.

```
A · THE PREVIEW / VALIDATION GATE          ── a WORKFLOW rule
      BR-098: an import previews before it commits.
      Where an unresolved validation error remains, COMMIT IS NOT AVAILABLE.
      ── nothing has been written, so nothing is rolled back.
      WF-021: the administrator fixes the source, or EXCLUDES rows, then commits
              the rest.  Exclusion is not failure.

B · COMMIT TRANSACTION GRANULARITY         ── a DATABASE rule, decided by Stage 18

      LOCKED OPS-D021, quoted:
        "each LOGICAL ROW is one transaction … a chunk of 100 is a BATCHING UNIT
         for progress and memory, NOT a rollback unit"

      WITHIN one logical row  ── child · family · guardian relationship ·
                                 class membership · requirement items
                                 ALL COMMIT OR NONE
      ACROSS rows            ── row 1 may commit, row 2 may commit, row 3 may fail
                                 with DURABLE PROGRESS and an admin-visible result
```

**Stage 18 rejected the all-or-nothing chunk in terms, and said why:** *"a single bad row on line 63
would discard 99 good ones, and the admin would re-upload the whole file to fix one typo."*

| Test | Asserts |
|---|---|
| **one audit event, not one per row** | a 300-row import produces **AET-047 once**, carrying `import_session_id` and row counts — AUD-D027 |
| **staging retention** | staged rows (DBT-072 … DBT-074) are deleted on schedule — Stage 18 OPS-D058 · SECAR-039 — **and audit did not copy them out to survive it** |
| **the validation gate (A)** | with an unresolved validation error present, **commit is not available / not accepted** — and **no row was written**, so there is nothing to roll back |
| **row exclusion (A)** | an administrator may **exclude** problem rows and commit the rest — WF-021. **Exclusion is a workflow outcome, not a failure** |
| **within-row atomicity (B)** | for ONE logical row, the child, family link, guardian relationship, class membership and requirement items **all commit or none do** |
| **across-row progress (B)** | a mid-commit failure on row 3 leaves **rows 1 and 2 committed**, row 3 and after not, **and the session shows exactly which** — OPS-D021 |
| **durable progress (B)** | commit progress is recorded on the import session **after each row**, so a crash does not lose the committed prefix |
| **resume without duplication** | resuming or re-running a commit for the same session **duplicates no committed row** — OPS-D022, driven by the staging row's own committed state, never by a held counter |
| **no half-committed row** | after a crash mid-file, **no logical row exists partially** |
| **email after commit** | invitations are sent **after** the commit and a mail failure loses no import — BR-096 |
| **duplicate detection** | a re-uploaded file does not create a second cohort |
| **the proposed-class path** | proposed classes are not created until accepted — DBT-074 |
| **tenancy** | an import into A cannot create a row in B — including via an identifier in the file |

**TST-D082 · The test that is NOT written, and why it matters that it is not**

```
NOT TESTED   "one invalid row causes a database rollback of every previously
              committed logical row"

WHY NOT      LOCKED STAGE 18 SAYS THE OPPOSITE.
             Writing it would encode a behaviour a locked stage rejected in terms,
             and would then be cited as the reason not to build what was decided.
```

**This is TST-R12 happening in this document, caught before lock.** A test written against the wrong
model does not merely fail to help — **it becomes the argument against the correct implementation**,
because someone must then delete a passing test to ship the right thing.

---

## 31. CMS and public site tests

| Test | Asserts |
|---|---|
| **publication is atomic** | the revision pointer moves in one transaction with its audit event — AUD-D028 · AET-051 |
| **the public site is unauthenticated** | CAP-081, and it reaches no authenticated data |
| **public RLS** | the public read path returns only published content for the resolved domain, **enforced at the database** |
| **entitlement gating** | a school without the CMS entitlement has no CMS surface — MA-2 |
| **domain resolution** | an unrecognised host resolves to nothing, never to a default tenant |
| **unscanned objects** | an object pending scan is **viewable by nobody** — OPSQ-1 = A, asserted for every reader class including the uploader |

---

## 32. Migration tests — MIG-T01 … MIG-T10

**TST-D053 · MIG-000 is RE-SCOPED, not "made runnable" — a correction, because the draft contradicted
locked Stage 15**

**`MIG-000` is this document's label for today's literal `001_console_hardening.sql`.** It is **not** a
new step in Stage 15's locked `MIG-01 … MIG-14` sequence and does not join it.

**The draft handed Stage 22 the instruction "MAKE 001 RUNNABLE ON AN EMPTY DATABASE." That contradicts
a locked stage.** Stage 15's **MIG-01** says something different and deliberate:

> *"install the migration runner; **record `001_console_hardening.sql` as manually applied**; remove
> `db:push --force` from CI"*

and Stage 15's conflict table is explicit about why: **C-19** is resolved by *"MIG-01 records it as
manually applied **rather than leaving it in a loop that cannot run it**."*

**Why it cannot simply become an application migration** — read from the file itself:

```
REPLACE_ME PASSWORDS        its own header says to substitute two random strings
                            before running.  A migration chain cannot contain
                            credential placeholders, and must never contain credentials.
PROJECT-OWNER PRIVILEGE     it creates a schema and a role; the application's
                            migration identity is not, and must not be, that identity
OPERATOR PROVISIONING       CREATE ROLE and GRANT are environment provisioning,
                            not schema evolution
```

**The corrected ownership, and it is four stages wide:**

| Stage | Owns |
|---|---|
| **STAGE 15** | **preserves MIG-000's security INTENT** — the console reaches a view schema under a read-only role, and nothing else. Locked, unchanged |
| **STAGE 20** | **defines what must be TESTED** — SEC-T15's two bypasses, MIG-T01's chain, MIG-T09's policy census. **This document, and nothing more** |
| **STAGE 21** | **privileged environment provisioning** — roles, credentials, the console read-only account, secret delivery, provider and runtime setup |
| **STAGE 22** | **the migration chain, its execution sequence, legacy transformation and cutover** |

**Do not make a SQL file containing passwords the production provisioning mechanism**, and do not
promote it into the application migration chain merely so that a test can start.

**TST-D083 · MIG-T01 tests the TARGET application migration chain, not today's files**

```
MIG-T01 PROVES        EMPTY DATABASE
                      → the reviewed, ordered TARGET application migrations
                      → the target schema

MIG-T01 DOES NOT      require MIG-000 to execute as an ordinary migration
REQUIRE

WHERE PRIVILEGED      Stage 21's provisioning preflight supplies the required role
PROVISIONING IS A     and environment structure SEPARATELY, before the chain runs
PREREQUISITE          ── it is a precondition of the test environment, not a step
                         inside the migration chain
```

**MIG-T01 is therefore `DEFINED` — waiting on Stage 22 producing the chain**, not `BLOCKED` on a
defect. **The distinction is real: a chain that does not exist yet is a schedule; a file that cannot
run is a defect.**

| MIG-T | Asserts | State |
|---|---|---|
| **MIG-T01** | **the target application migration chain applies, in order, to an EMPTY database, and produces the target schema** | **DEFINED** — Stage 22 produces the chain; Stage 21's preflight supplies the privileged prerequisites |
| **MIG-T02** | the migrated schema **matches the target Drizzle declarations and the expected PostgreSQL catalogue state** — tables, columns, types, constraints, indexes, policies. This is what **replaces `db:push` as CI's schema authority** (TST-D015) | **DEFINED** — follows MIG-T01 |
| **MIG-T03** | **only a migration explicitly designed and documented as safely re-runnable** is tested for re-run safety, and that one is | **DEFINED** — and **idempotency is NOT required of every migration**, which would be a fiction for a data transformation |
| **MIG-T04** | **applying the migrations to a copy of the CURRENT schema preserves every row** — the actual upgrade path, tested with a synthetic dataset of production *shape*, never production data (TST-P10) | no |
| **MIG-T05** | **MIG-07 migrates all three audit stores** — `audit_logs`, `message_audit_logs`, `console_audit` — with **row counts reconciled before and after** | no |
| **MIG-T06** | **no audit row is lost or altered** in MIG-07; every source row maps to exactly one `audit_events` row | no |
| **MIG-T07** | **destructive legacy-console removal is refused until the snapshot bytes are demonstrably preserved** — the five conditions below, asserted as a precondition check rather than as documentation | no |
| **MIG-T08** | the new constraints reject what they exist to reject — **CK-A1 … CK-A9, DBI-034, DBI-035**, each probed directly | no |
| **MIG-T09** | **RLS is enabled on every table that should have it, after migration** — a table gaining rows without a policy fails | no |
| **MIG-T10** | **rollback**: for every migration, either a tested down-path exists, or the migration is declared irreversible **and the declaration is the test** | no |

**TST-D084 · MIG-T07 now tests PRESERVATION, because the owner answered the interim disposition**

**Stage 19's A19-001 changed what this test is for.** The draft tested *"disposition unanswered →
refuse"*, and the disposition is no longer unanswered: **1A · QUARANTINE / PRESERVE PENDING POLICY.**

```
MIG-T07 · destructive legacy-console removal is REFUSED until ALL of:

   1  every legacy row carrying a beforeSnapshot or afterSnapshot has been INVENTORIED
   2  the quarantine / preservation migration has COMPLETED
   3  source-to-quarantine RECONCILIATION passes — counts and hashes
   4  ordinary application access CANNOT READ the quarantine
   5  NO SNAPSHOT BYTES ARE LOST

THE FINAL LEGAL DISPOSITION MAY REMAIN UNRESOLVED.
   ── that does NOT prevent migration off the active legacy table, once the
      bytes are safely quarantined
   ── it DOES prevent destruction of the quarantined bytes
```

**And the destruction gate is separate, and is not a CI test at all:**

```
FINAL SNAPSHOT DESTRUCTION          APPROVED POLICY REQUIRED
   ── a release / policy gate, recorded at §50's register
   ── not satisfiable by any pipeline, and MIG-T07 does not claim to satisfy it
```

**MIG-T07 asserting preservation rather than refusal is the difference between a gate that blocks
progress and a gate that protects data.** The first gets removed; the second gets respected.

**TST-D054 · "Irreversible" is a legitimate answer, and an untested claim of reversibility is not**

Most schema changes here are additive and reversible. **A data-destroying migration is not, and
pretending otherwise is worse than saying so** — because a down-migration that has never been run is a
recovery plan nobody has tested, offered at the worst possible moment.

---
---

## 33. Data preservation and rollback

**TST-D055 · Every destructive operation is tested for its refusals before its effects — TST-P19**

| Operation | The refusals tested FIRST |
|---|---|
| **tenant purge** (CAP-092) | refuses without an open elevation · refuses before the cooldown **read from DBT-002** · refuses without a reason · **touches no other school's rows** |
| **child archive** (CAP-020) | archives, **never deletes**; the child's history remains reachable |
| **staff offboarding** (CAP-035) | preserves the family relationship — the capability's own name is the requirement |
| **retention deletion** (AET-066) | deletes only the declared class, only past the window, and **records what it deleted** |
| **privacy erasure** | **pseudonymises the audit trail, never deletes it** — AUD-D064; the act, its time, its capability and its outcome all survive |
| **MIG-14 drops** | refuses until the legacy snapshot bytes are inventoried, quarantined, reconciled and unreachable — **A19-001 · MIG-T07** |
| **final snapshot destruction** | **not authorised by any migration or pipeline** — APPROVED POLICY REQUIRED, A19-001 |

**TST-D056 · The purge test asserts the blast radius, not just the outcome**

```
GIVEN   school A eligible for purge, and school B with data of every shape
WHEN    A is purged
THEN    A's rows are gone
AND     EVERY ONE OF B's ROWS IS BYTE-FOR-BYTE UNCHANGED     ← the actual test
AND     the DBT-002 lifecycle row records 'purged'
AND     AET-024 exists, with its reason, committed with that lifecycle transaction
```

**A purge that deletes slightly too much is the worst bug this system could have**, and the only test
that finds it is one that counts what survived.

---

## 34. Frontend component tests

**TST-D057 · Component tests run in a real browser via Vitest Browser Mode, not in a simulated DOM**

The properties worth testing here are **focus, contrast, keyboard order and actual layout** — and
**a simulated DOM computes none of them.** `jsdom` will happily report that an invisible element is
focusable and that a 1.2:1 focus ring is fine, which makes it precisely the wrong tool for the one
contract §35 has to defend.

**TST-D058 · The component suite covers the design system's primitives first, and the pages second**

```
FIRST    the DESIGN SYSTEM primitives — every one, once
         a control is reachable by keyboard
         its focus indicator is visible and MEETS 3:1                 DSQ · 1.4.11
         its target size meets the contract — and 44 × 44 on the TEACHER surface
         it carries an accessible name
         its state is not signalled by colour alone                   1.4.1
         it reflows to 320px CSS width without loss                   1.4.10

THEN     the composed surfaces, for behaviour rather than for tokens
```

**Testing every page for contrast would be slow and would test the same token forty times.** Testing
every *primitive* once, and then asserting pages use primitives, gets the same guarantee for a fraction
of the run — **and it fails in a place that names the actual defect.**

**TST-D059 · Rendering is asserted through the accessible tree, never through class names**

A test that queries `.btn-primary` breaks when someone renames a class and passes when someone ships a
`<div>` that no screen reader can find. **A test that queries by role and accessible name asserts the
thing the design system actually promises.**

---

## 35. Accessibility tests — and exactly what they are worth

**TST-D060 · Automated scanning is adopted, and its limit is quoted rather than paraphrased**

`@axe-core/playwright`, on Playwright's own recommendation (§8). And, from the same first-party page:

> *"Automated accessibility tests can detect some common accessibility problems such as missing or
> invalid properties. But many accessibility problems can only be discovered through manual testing."*

```
WHAT A GREEN AXE SCAN IS EVIDENCE OF
   no missing accessible names          no invalid ARIA
   no obvious contrast failures         no unlabelled form controls
   no duplicate ids · no landmark errors

WHAT IT IS NOT EVIDENCE OF
   that the focus ORDER is sensible
   that the error message is understandable
   that the keyboard path through the teacher's distribution list is USABLE
   that a screen-reader user can complete a hand-over
   ── AND THEREFORE: NOT EVIDENCE OF WCAG 2.2 AA CONFORMANCE
```

**TST-D061 · Stage 20 does not permit a green pipeline to be reported as WCAG 2.2 AA conformance**

Stage 10 §23 states the baseline as *"mandatory for every pattern, not a later polish stage."*
**Automated scanning cannot discharge that**, on the tool vendor's own statement. **The honest position
is that the design system's contract requires a manual assessment that has never been performed** —
which is **C-104**.

### 35.1 Owner decision 2A — the manual assessment is a mandatory pre-production gate

**The owner decided on 31 August 2026: a manual WCAG 2.2 AA assessment is MANDATORY BEFORE PRODUCTION
GO-LIVE.** §49.1 no longer records an unowned obligation; it records a gate.

```
AUTOMATED ACCESSIBILITY FLOOR                MANUAL ASSESSMENT
Vitest Browser · Playwright · axe                    │
        │                                            │
        └──────────────────┬─────────────────────────┘
                           ↓
                        findings
                           ↓
                     remediation
                           ↓
                        re-test
                           ↓
          ACCEPTED ACCESSIBILITY ASSESSMENT EVIDENCE
                           ↓
                  production eligibility
```

**TST-D085 · The two gates are different gates, and conflating them is the failure this decision
exists to prevent**

| | AUTOMATED | MANUAL |
|---|---|---|
| **Where it runs** | ordinary CI and the pre-release suite | **not in CI at all** |
| **What it is** | a build check | **release evidence** |
| **Cadence** | every push | per release, against the release scope |
| **Blocks** | the merge | **the production promotion** |
| **Proves** | the five automatable properties of TST-D062 | the things automation provably cannot — the last three rows of TST-D062 |

**TST-D086 · Assessor independence is preferred, and the reason is not ceremony**

**Where practical, a qualified independent accessibility specialist performs it, rather than the people
who implemented the UI.** The people who built a screen know where to click; **that fluency is exactly
what hides a broken keyboard path**, and it is not a criticism of them that they cannot un-know it.

**TST-D087 · The assessment covers representative critical journeys across every surface, not a
sample of pages**

```
SURFACES — all eight, with representative CRITICAL JOURNEYS in each
   authentication / entry            school administration
   finance                           teacher handheld distribution
   family / guardian                 Website Studio / CMS
   BytHub Platform / support         public school website
```

**And it must cover what automation cannot prove** — the list is the point of the manual gate, so it is
recorded rather than left to the assessor's discretion:

```
meaningful keyboard order                 focus progression AND RESTORATION
screen-reader announcements               understandable validation / error behaviour
semantic reading order                    zoom / reflow
complex table use                         modal / dialog behaviour
the handheld TEACHER workflow             critical journey completion WITHOUT A MOUSE
equivalent alternatives to gesture and drag interaction
```

**The teacher's handheld distribution path is named twice on purpose.** It is the surface with the
44 × 44 target contract, the one used standing up in a corridor, and the one no desktop scan will ever
represent.

**TST-D088 · What the release evidence record must contain — and what it must not be called**

| Field | |
|---|---|
| assessment date | |
| scope / surfaces assessed | which journeys, on which build |
| assessor / organisation, or the qualified responsible person | **and no more personal data than that** |
| standard / baseline | WCAG 2.2 Level AA, plus Stage 10's named additions |
| findings | |
| severity | |
| remediation status | |
| re-test result | |
| accepted residuals, if any | **explicitly accepted, by whom** |
| release decision reference | |

```
CALL IT       ACCESSIBILITY ASSESSMENT EVIDENCE
NEVER CALL IT "WCAG CERTIFICATE"
              ── unless an external assessor actually issues something that means that.
              A record we wrote about ourselves is evidence, not certification, and
              the difference is exactly the kind of thing a procurement process asks about.
```

**Do not store unnecessary personal data about the assessor.** A name or an organisation and a
professional qualification is the record; anything beyond that is a personal-data holding with no
purpose.

**TST-D089 · A custom accessibility-management system is not built.** A release-evidence file or
checklist carrying the fields above is sufficient, and Stage 21 owns where it lives.

### 35.2 Passing both gates is still not clearance

**Even when automation is green AND the manual WCAG 2.2 AA assessment passes, the existing BytHub Legal
& Compliance production block remains independently binding until its own requirements are resolved.**

```
ENGINEERING VERIFICATION        ≠        LEGAL CLEARANCE

   accessibility automation green
   + manual assessment accepted
   ────────────────────────────────►  ONE gate satisfied, out of the set at §50

   17 Critical · 52 High · 14 domains · 0% clearance   ── UNCHANGED BY EITHER
```

**Owner decision 2A raises the accessibility bar. It does not lower any other one**, and nothing in
this document permits an accessibility pass to be presented as progress against the legal block.

**TST-D062 · What automation CAN own, it owns completely**

| Assertion | Automatable? |
|---|---|
| **contrast of every design-system token pair** | **YES — and it is arithmetic, so it is exact.** A token whose computed ratio falls below its stated requirement fails the build |
| focus indicator visible and ≥ 3:1 | **YES**, measured on the rendered element |
| target size ≥ 24 × 24, and ≥ 44 × 44 on the teacher surface | **YES** |
| every interactive element reachable by keyboard | **YES** |
| reflow to 320px without loss of content or function | **YES** |
| no colour-only signalling | **partially** — presence of a second cue is checkable; its comprehensibility is not |
| **focus order is logical** | **NO** |
| **an error message is understandable** | **NO** |
| **the journey is completable by a screen-reader user** | **NO** |

**The first five are a genuine floor and they are worth having.** The last three are why §49.1 records
a manual assessment as a real, unmet obligation rather than a nicety.

---

## 36. End-to-end tests — E2E-T01 … E2E-T08

**TST-D063 · Eight journeys, and the list is deliberately hard to extend**

**E2E tests are the slowest, flakiest and least diagnostic level.** Their value is not coverage — it is
that they fail when *a person could not have done the thing*, which no lower level can tell you.

| E2E-T | Journey |
|---|---|
| **E2E-T01** | a guardian signs in, sees their child's requirement, and reaches the payment step |
| **E2E-T02** | **finance confirms a settlement** — the I-2 journey, end to end, in a browser |
| **E2E-T03** | a teacher records a hand-over from the distribution list |
| **E2E-T04** | an administrator imports an enrolment file and accepts the result |
| **E2E-T05** | an administrator invites a guardian and the guardian redeems the link — **the one audited act with no prior authority**, AET-078 |
| **E2E-T06** | a platform person opens support mode on a school, performs a typed operation, and closes it — **and the school can see it happened**, SECAR-018 |
| **E2E-T07** | MFA enrolment and a sign-in through the challenge |
| **E2E-T08** | the public site renders for a school's own domain, unauthenticated |

**TST-D064 · Adding a ninth requires removing one, or an explicit decision that eight was wrong**

**Every E2E suite in history grew until nobody trusted it.** The constraint is the control.

---

## 37. Performance boundary

**TST-D065 · Stage 20 tests the ONE performance property that is a correctness property, and refuses
the rest**

Stage 18 sets latency budgets — **≤ 250 ms p95** for interactive work — and Stage 18 owns them.
**A CI runner is the wrong instrument for a latency budget**: it is shared, throttled and variable, so a
p95 measured there is noise wearing a number's clothes.

```
NOT TESTED IN CI    p95 latency · throughput · load · soak · connection-pool sizing
                    ── Stage 18 owns these, measured against real infrastructure

TESTED IN CI        I-2 IS ONE TRANSACTION, and that transaction does not grow
                    ── asserted by COUNTING, not by timing:
                       exactly one BEGIN, one COMMIT
                       no external socket opened inside it
                       the statement count does not exceed its stated bound
                    ── and an N+1 introduced inside I-2 fails the build
```

**A statement count is deterministic; a millisecond is not.** This gets the property that actually
matters — **that I-2 stays one bounded transaction** — without importing a source of flakiness into
every run.

---

## 38. Coverage policy

**TST-D066 · Coverage is measured, reported, and is never a merge gate — TST-P1**

```
MEASURED    yes — TST-F08 says it is not, and that is a gap worth closing
GATED       NO percentage threshold, on any package, ever
```

**A coverage gate is satisfiable by testing the easy code**, and the easy code in this system is not
where the risk is. **90% coverage with no RLS test is a worse position than 40% with one**, because the
first number persuades people they are safe.

**TST-D067 · The gate is on named properties, not on a number**

```
THE MERGE GATE IS
   every INV-T passes
   every TEN-T passes
   every SEC-T passes, EXCEPT the two named red in TST-D036
   every MIG-T that is not blocked on C-19 passes
   the taxonomy-coverage test passes                          §18
   the API-register contract test passes                      §26
   the token-contrast test passes                             §35
   NO NEW ROUTE, TABLE OR CAPABILITY EXISTS WITHOUT ITS TEST
```

**The last line is the one that keeps this true over time.** The generated suites (TEN-T01, SEC-T01,
§26) fail on an unregistered route by construction — **so the gate enforces itself rather than relying
on a reviewer noticing.**

**TST-D068 · Coverage IS used for one thing: answering AUD-F07**

Stage 19 deferred *"which consequential acts are unaudited"* to a call-site sweep it did not perform.
**A coverage report over the command layer, cross-referenced with the AET matrix, is that sweep** — and
it is the reason to measure coverage at all.

---

## 39. Test requirement activation states

**Stage 20 describes the FINAL TARGET test architecture while the repository is still legacy. Every
target gate therefore needs an activation model, or the gap between the two gets managed by switching
things off.**

**TST-D090 · Four states, and one of them is deliberately absent**

```
DEFINED             specified by Stage 20; the implementation slice does not exist yet
                    ── written down, owned, named against its conflict
                    ── NOT part of the mandatory executable suite
                    ── blocks its own batch from being called complete

ACTIVE              the relevant target slice exists
                    ── MANDATORY.  Must pass.
                    ── no skip, no allow-failure, no continue-on-error, ever

SUPERSEDED          ONLY after a replacement test proves the same or a stronger
                    property, and the replacement's evidence is recorded
                    ── never "we deleted it and the suite went green"

BLOCKED-EXTERNAL    a Stage 21 provider gate, a legal gate or a manual gate genuinely
                    prevents execution
                    ── MUST NAME THE BLOCKER and its release impact
                    ── a blocker with no name is a skip with better manners

THERE IS NO         "SKIPPED BECAUSE FAILING".
FIFTH STATE.        A failing test is a defect or a wrong test.  Both have owners.
```

**TST-D091 · Every target family carries a state, and the state is data, not a comment**

The families whose target slices do not exist yet are precisely the ones most at risk of being quietly
dropped, so each is enumerated rather than left implicit:

| Family / requirement | State today | Activates with |
|---|---|---|
| target **API register** enforcement (§26) | **DEFINED** | the target route surface, plus §26.1's cutover register |
| target **capability** model (§21) | **DEFINED** | the Stage 7 capability implementation batch |
| target **RLS** (§20) | **DEFINED** | MIG-10's policies |
| target **audit** (§18) | **DEFINED** | A15-003's tables, created at MIG-03 |
| target **migrations** (§32) | **DEFINED** | Stage 22's chain |
| **Argon2id** rehash-on-login (§23) | **DEFINED** | the credential batch |
| **MFA** password requirement — SEC-T03 | **DEFINED** | the MFA batch that closes **C-90** |
| console read-tier controls — SEC-T15 | **DEFINED** · **BLOCKED-EXTERNAL** | Stage 21 console provisioning + Stage 22 migration — **C-19** |
| **SES** contract tests (§27) | **DEFINED** · **BLOCKED-EXTERNAL** — provider not provisioned | Stage 21 preflight, then the cutover batch |
| **S3 / GuardDuty** object tests (§31) | **DEFINED** · **BLOCKED-EXTERNAL** — **PRV-005 is SELECT-CONDITIONAL, not proven** | Stage 21's hard verification gate |
| new **CMS publication** architecture (§31) | **DEFINED** | the publication batch |
| **manual accessibility** (§35.1) | **BLOCKED-EXTERNAL** — by design; it is a human gate | the release, not a build |

**TST-D092 · At final target cutover, every required target test is ACTIVE**

```
DEFINED         ──►  ACTIVE      when its slice lands, IN THE SAME BATCH
BLOCKED-EXTERNAL ──► ACTIVE      when the named blocker is removed, and the
                                 blocker's removal is what unblocks it
ANYTHING STILL DEFINED AT CUTOVER  is an incomplete cutover, and is reported as one.
```

**The states exist to make deferral visible, not to make it comfortable.** A `DEFINED` test that has
been `DEFINED` for four batches is a schedule problem the register surfaces on its own.

---

## 40. Flakiness policy

**TST-D069 · A flaky test is quarantined with a deadline and an owner, and is never simply retried**

```
FORBIDDEN   retry: 3        ── it converts a 1-in-4 race into a 1-in-64 silence
            skip            ── with no expiry, this is deletion with extra steps

REQUIRED    QUARANTINE      the test still runs, and its failure does not block
                            IT IS AN OPEN BUG, with an owner and a date
                            it leaves quarantine fixed, or the DEADLINE fails the build
```

**TST-P7's reasoning, made concrete: a flaky test usually found a real race.** The lease tests, the
recovery-code concurrency test and I-2 are all *about* concurrency — **a flake there is the suite doing
its job, and retrying it is switching off the alarm.**

**TST-D070 · The quarantine list is empty at adoption, and every entry has a date.** A quarantine list
with no dates is a graveyard.

---

## 41. The CI pipeline

**TST-D071 · Four stages, failing closed, cheapest first**

```
① STATIC          tsc --noEmit  ·  lint  ·  the token-contrast check       seconds
                  ── the contrast check is arithmetic; it needs no browser

② SMOKE           script/smoke-boot.ts, UNCHANGED                          seconds
                  compiles and boots api/index.ts — the artefact Vercel runs
                  ── KEPT FIRST, exactly where it is today, for the reason
                     its own header gives

③ BUILD           the production build                                     ~a minute

④ VERIFY          a real PostgreSQL 16
                  ── SCHEMA FROM THE MIGRATIONS, IN ORDER, FROM 001        TST-D015
                  ── db:push is NOT RUN                                    reverses TST-F04
                  ── MIG-T01 … MIG-T10
                  then, in parallel, per-worker databases:
                       unit  ·  INV-T  ·  TEN-T  ·  SEC-T  ·  contract  ·  jobs  ·  import
                  then component (browser)  ·  axe scans
                  then E2E-T01 … E2E-T08, last, because they are slowest
```

**TST-D072 · Node is pinned to the locked target, not to 20**

Stage 11 locked **Node 24 LTS, pinned**. **CI testing on Node 20 — EOL since April 2026 — produces
evidence about a runtime nothing will run on** (TST-F05). The pin belongs in `.nvmrc`, `engines` and
the workflow, from one source.

**TST-D093 · The protected branch has no mechanism for tolerating a red mandatory test**

```
FORBIDDEN IN THE PIPELINE CONFIGURATION
   continue-on-error on any ACTIVE test job
   allow_failure
   a generic ALLOW_FAILURE_TESTS=true switch
   a per-test permanent skip registry for a known SECURITY defect
   an "expected failures" list of any kind

WHAT REPLACES THEM
   a test is DEFINED  ──►  it is not in the mandatory suite yet, and the register
                           at §39 says so, with the batch that activates it
   a test is ACTIVE   ──►  it must be green
```

**A skip registry is a permanent exception list that nobody re-reads.** The activation register is a
schedule that names its own end. **They look similar and they age completely differently.**

**TST-D073 · A step that cannot run fails the pipeline — TST-P15**

**A skipped migration is precisely how C-19 became invisible for as long as it did.** There is no
`continue-on-error` in this pipeline, and a glob that matches fewer files than expected is a failure,
not a quiet success. **`migrations/00[2-9]*.sql` matched six files and nobody noticed the seventh was
missing** — a count assertion would have.

**TST-D074 · The workflow is not edited by this stage.** Stage 21 edits it.

---

## 42. The local developer workflow

**TST-D075 · What a person runs before pushing must be fast enough that they actually run it**

```
npm run test:unit          seconds        no database
npm run test:invariants    < a minute     one database, transaction rollback
npm run test               everything except E2E
npm run test:e2e           explicitly, and in CI
```

**TST-D076 · The same commands run locally and in CI, with no CI-only path**

**A test that only runs in CI is a test nobody can debug**, and a CI-only environment variable is where
"works on my machine" is manufactured. The database is the difference between environments, and
containers make that difference nothing.

**TST-D077 · The eleven existing scripts keep working, unchanged, throughout the migration** —
TST-D007. Nothing forces a developer to adopt the new runner before it is complete.

---

## 43. What must never appear in a test

```
NEVER   production data — no dump, no subset, no "anonymised" extract      TST-P10
NEVER   a real credential, a real API key, a real webhook secret
NEVER   a call to a real external service                                  TST-P11
NEVER   a sleep                                                            TST-D020
NEVER   a retry to make a race pass                                        TST-D069
NEVER   an assertion on a class name, an id or a DOM position              TST-D059
NEVER   a shared mutable fixture between tests                             TST-D009
NEVER   a superuser or owner connection in an RLS test                     TST-D029
NEVER   `db:push` as a test's schema source                                TST-D015
NEVER   a test whose failure is fixed by deleting its assertion            TST-D008
```

---

## 44. Production safety

**TST-D078 · No test suite has any path to production, and this is structural rather than procedural**

```
THE DATABASE URL A TEST USES IS CONSTRUCTED BY THE HARNESS, never read from
the ambient environment.  A test cannot connect to production because it is
never given the string.

AND     the harness refuses to run against a database it did not create
AND     the outbound-network guard blocks every non-localhost socket   TST-D025
AND     the test-superuser kill switch is asserted unavailable in a
        production-shaped environment                                  SEC-T18
```

**TST-D079 · A production dataset is never restored into a test environment — TST-P10**

**This is a children's records system.** A restored production database in a CI runner is a disclosure
with a log file, and no "anonymisation" applied after the fact makes the copy that already happened
un-happen. **MIG-T04 tests the upgrade path against synthetic data of production *shape*** — the same
volumes, the same distributions, the same awkward rows — **which is what the test actually needs, and
none of what it must not have.**

---

## 45. Current → target map

| Current | Target | Note |
|---|---|---|
| `script/smoke-boot.ts` | **unchanged, stage ②** | the best test present; nothing improves it |
| `tests/custody-machine.ts` | **unit** — INV-T06 | already pure; ported first as the runner's proof |
| `tests/tenant-isolation.ts` | **TEN-T**, plus new database-level tests | its HTTP probes are kept; §20's RLS layer is added beneath them |
| `tests/stock-idempotency.ts` · `payment-idempotency.ts` | **INV-T** | invariant tests currently expressed over HTTP |
| `tests/security-regression.ts` | **SEC-T**, with role assertions **paired** and marked SUPERSEDED-ON-MIGRATION | TST-D008 — **never deleted to go green** |
| `tests/test-superuser.ts` | **SEC-T18** | |
| `tests/family-enrollment.ts` · `staff-parent.ts` · `teacher-distribution.ts` · `payment-verification.ts` | **integration** | ported against the command layer where the assertion allows |
| `tests/enrollment-import.ts` | **§30's import family** | |
| **no frontend test at all** | **§34 component · §35 axe** | **the largest single gap** — C-104 |
| **no migration test at all** | **MIG-T01 … MIG-T10** | MIG-T01–T03 **blocked on C-19** |
| **no RLS test at all** | **§20** | there is also no RLS yet; the tests land with the policies |
| `db:push --force` as CI's schema | **the target migration chain, order-asserted** | **TST-D015** — reverses TST-F04 · C-78 |
| `migrations/00[2-9]*.sql` | **the target chain, order-asserted and count-asserted** | TST-D073 · C-19 |
| **`001_console_hardening.sql` (MIG-000)** | **RE-SCOPED, not promoted into the chain** — Stage 15 records it manually applied; Stage 21 provisions the role; Stage 22 owns the chain | **TST-D053 · TST-D083** |
| **legacy console snapshots** | **quarantined and preserved** — A19-001 · MIG-T07 | never destroyed to satisfy a schema |
| **no route cutover model** | **target / legacy-bridge / removed**, with a removal batch per entry | TST-D080 |
| **no activation model** | **DEFINED · ACTIVE · SUPERSEDED · BLOCKED-EXTERNAL** | TST-D090 — and no fifth state |
| `node-version: "20"` | **Node 24 LTS, pinned from one source** | TST-D072 · Stage 11 |
| eleven hand-rolled harnesses | **one runner** | TST-D003 — **by migration, never by deletion** |

---

## 46. Findings — TST-F01 … TST-F10

**All E2 — read, not executed.**

| TST-F | Finding | Becomes |
|---|---|---|
| **F01** | no test framework — eleven hand-rolled harnesses, exit code as the only report | TST-D003 · TST-D007 |
| **F02** | **no frontend test of any kind**, against a locked WCAG 2.2 AA contract | **C-104** |
| **F03** | **CI never applies `001`** — the glob starts at `002` | **C-19**'s CI instance — **no new identifier** |
| **F04** | **CI's schema comes from `db:push --force`**, so the migrations are never the source | **C-78** — **no new identifier** |
| **F05** | CI pins Node 20 (EOL April 2026) against a locked Node 24 target | Stage 11 owns the remedy — **no new identifier** |
| **F06** | suites share one database, one server and one seed; order is load-bearing | TST-D016 · TST-D012 |
| **F07** | tests authenticate over HTTP with defaulted credentials; **no level exists below "the server is running"** | TST-D001 · §6 |
| **F08** | coverage is not measured anywhere | TST-D066 · TST-D068 |
| **F09** | **no test asserts a database invariant directly** | TST-P3 · TST-D022 |
| **F10** | the security suite asserts the role model Stage 7 replaces | TST-D008 — **paired, not deleted** |

---

## 47. Decisions — TST-D001 … TST-D095

| TST-D | Subject | § |
|---|---|---|
| **001–002** | **the shape is a diamond, not a pyramid; every property is tested at the lowest level that can prove it, and at one level** | 5–6 |
| **003–006** | **Vitest on verified first-party version evidence; Playwright once for component and E2E; `@axe-core/playwright` with its stated limit recorded** | 7–8 |
| **007–008** | **the eleven suites are preserved, adopted and migrated — never deleted; the role assertions are PAIRED with their capability replacements, not removed** | 9 |
| 009–010 | builders, not shared fixtures; obviously synthetic personal data | 10 |
| 011–013 | three fixture tiers; the second tenant is a fixture, not a pipeline step; **seeding through the API is not seeding** | 11 |
| **014–015** | **real PostgreSQL, always; the CI schema comes from the migrations from `001`, and `db:push` is never run in CI** | 12 |
| 016–017 | transaction rollback by default, template databases where it cannot work | 13 |
| **018–020** | **the clock is injected; randomness is seeded; no sleep, ever** | 14 |
| 021 | two tenants, and the second one holds real rows | 15 |
| **022** | **an invariant test asserts the DATABASE's refusal, not the application's** | 16 |
| **023–025** | **the I-2 negative is asserted six times; the audit-rollback asymmetry is explicit; the network guard is enforced, not requested** | 17 |
| **026** | **the taxonomy-coverage test reads both registers as data** — the check that would have caught the 33-capability gap | 18 |
| 027–028 | the existing 404-over-403 rule is adopted verbatim; **TEN-T01 is generated from the API register** | 19 |
| **029–031** | **RLS is tested as the database, by a non-bypassing role; the unset-context test is mandatory; a table with no policy fails** | 20 |
| **032–035** | **every capability tested granted AND refused; context and authority as two facts; a role string must not satisfy a capability check; PA-2** | 21 |
| **036** | **SEC-T03 and SEC-T15 are DEFINED / NOT YET ACTIVATED** — red belongs inside the implementation batch, never on a protected branch | 22 |
| 037–038 | the real session store; **Argon2id tested from the bcrypt state, not from a fresh account** | 23 |
| 039–040 | rate limits assert the window and the recovery; a refusal never echoes input | 24 |
| **041** | **leakage is found by scanning everything the suite produced for the fixtures' known secrets** | 25 |
| 042–044 · **080** | the API register generates the contract tests; **an unregistered route fails**; shape, not behaviour; **three route kinds and a legacy cutover register whose entries must name their removal batch** | 26, 26.1 |
| 045–048 | **no provider is ever called**; recorded fixtures; signature and replay refusals; each school's own account | 27 |
| 049–050 | **the primary notification assertion is that mail was NOT sent**; the school's display identity | 28 |
| 051 | jobs are invoked through API-278; leases, fairness, idempotency and the system actor's honesty | 29 |
| 052 · **081–082** | one import event, not one per row; **the validation gate and commit granularity are two different guarantees**; **one logical row is one transaction, per locked OPS-D021**; and the all-or-nothing test is deliberately NOT written | 30 |
| **053 · 083–084** | **MIG-000 is RE-SCOPED, not made runnable** — a correction against locked Stage 15; **MIG-T01 tests the TARGET chain and is DEFINED, not blocked**; MIG-T02 checks the catalogue; **MIG-T03 tests only migrations documented as re-runnable**; **MIG-T07 tests snapshot PRESERVATION** | 32 |
| 054 | "irreversible" is a legitimate, testable answer | 32 |
| **055–056** | **destructive operations are tested for refusals first; the purge test counts what SURVIVED** | 33 |
| 057–059 | a real browser, not a simulated DOM; primitives first; assert through the accessible tree | 34 |
| **060–062** | **automated scanning is a floor; a green pipeline is NOT WCAG 2.2 AA conformance; what automation can own, it owns exactly** | 35 |
| **085–089** | **owner decision 2A: the manual assessment is a mandatory pre-production gate**; automated and manual are two different gates; independent assessor preferred; eight surfaces and the automation-proof list; **ACCESSIBILITY ASSESSMENT EVIDENCE, never "certificate"**; no bespoke system built | 35.1 |
| 063–064 | eight journeys, and the ninth costs one | 36 |
| **065** | **I-2's boundedness is asserted by COUNTING statements, not by timing** | 37 |
| **066–068** | **coverage is measured, never gated; the gate is named properties; coverage answers AUD-F07** | 38 |
| **090–092** | **four activation states and no fifth**; every target family carries one; **anything still DEFINED at cutover is an incomplete cutover** | 39 |
| 069–070 | quarantine with a deadline and an owner; never retry, never skip | 40 |
| 071–074 · **093** | four stages, failing closed, smoke first; Node pinned to 24; a step that cannot run is a failure; **no allow-failure, no skip registry, no expected-failures list** | 41 |
| 075–077 | fast local commands; no CI-only path; the old scripts keep working throughout | 42 |
| **078–079** | **a test cannot reach production because it is never given the string; no production data, ever** | 44 |
| **094–095** | **the release-gate register separates automated gates from evidence gates**; **no gate is marked PASS by this document** | 50.1 |

---

## 48. Risks — TST-R01 … TST-R15

| TST-R | Risk | Severity | Mitigation |
|---|---|---|---|
| **TST-R01** | **The migration is abandoned half-done**, leaving two harnesses and two habits | **HIGH** | TST-D007's ordered method; the old scripts keep running throughout, so there is never a moment where stopping loses coverage |
| **TST-R02** | **A failing assertion is deleted to make the suite green** — likeliest at the Stage 7 capability migration | **HIGH** | TST-D008's pairing; §43's explicit prohibition; the paired assertions flip together or not at all |
| **TST-R03** | **MIG-T01–T03 stay DEFINED indefinitely**, so the migration suite never exists | **HIGH** | §39's register makes a long-lived DEFINED state visible; the responsibilities are split explicitly across Stages 21 and 22 at TST-D053 rather than parked on **C-19** |
| **TST-R04** | **A green pipeline is read as clearance** | **HIGH** | TST-P20 · TST-D061 · §1.3 · **§35.2** — passing both accessibility gates leaves the legal block untouched, and the document says so where the pass happens |
| **TST-R05** | **Accessibility is reported as done because axe passes** | **HIGH** | TST-D060's quoted limit; **TST-D085's two-gate separation**; **§35.2** — and owner decision 2A makes the manual gate mandatory rather than aspirational |
| **TST-R06** | The suite becomes slow enough that people stop running it locally | **MEDIUM** | TST-D002's one-level rule · §42's tiered commands · parallel worker databases |
| **TST-R07** | **Flakes are retried away**, hiding a real concurrency defect | **MEDIUM** | TST-D069 — quarantine with a deadline, never `retry:` |
| **TST-R08** | Generated suites (TEN-T01, contract) become slow or noisy and get disabled | **MEDIUM** | they are the gate's self-enforcing half (TST-D067); disabling one is a visible decision, not a config tweak |
| **TST-R09** | **Someone restores a production dump to "test properly"** | **HIGH** | TST-D078's structural block — the harness constructs its own URL and refuses a database it did not create |
| **TST-R10** | A mocked storage layer creeps in for speed | **MEDIUM** | TST-D014's table of what does not survive substitution; the RLS and constraint tests cannot be written against a mock, so they would visibly disappear |
| **TST-R11** | **SEC-T03 and SEC-T15 are deferred indefinitely under a DEFINED label** | **MEDIUM** | TST-D036 names the batch each activates in; §39's register carries the state; **and TST-D093 removes the configuration that would let either sit red on main instead** |
| **TST-R12** | **Test suites are written against the CURRENT model and freeze it**, exactly as TST-F10 shows has already happened once | **MEDIUM** | TST-P12 — every test names the locked identifier it defends, so a test defending nothing is visible |
| **TST-R13** | **The manual accessibility gate becomes a rubber stamp** — a form filled in by the team that shipped the UI | **MEDIUM** | TST-D086's independence preference; TST-D087's named surfaces and automation-proof list, so the scope is not the assessor's to shrink; TST-D088's accepted-residuals field, which forces an acceptance to be signed rather than implied |
| **TST-R14** | **A legacy-bridge route becomes permanent** | **MEDIUM** | TST-D080 — an entry without a removal batch is not a valid entry, and the allowlist is counted, not merely consulted |
| **TST-R15** | **An import test written to the wrong granularity blocks the correct implementation** | **MEDIUM — ALREADY OCCURRED ONCE** | TST-D081 corrected it before lock; TST-D082 records the test that must NOT be written and why; **C-105** raises the underlying locked-stage contradiction rather than letting the next author rediscover it |

---

## 49. Conflicts

### 49.1 Existing conflicts, and what testing contributes

**Nothing is closed here. Stage 20 writes no code, so it resolves nothing.**

| Conflict | Contribution |
|---|---|
| **C-19 · OPEN** | `001` cannot run on a fresh database and CI skips it. **TST-F03 confirms the glob.** Its target resolution is **MIG-000's responsibilities split between Stage 21 provisioning and Stage 22 application-migration work** (TST-D053) — **not** "make the file runnable", which contradicted locked Stage 15. **It does not close at Stage 20**, and SEC-T15 stays `DEFINED · BLOCKED-EXTERNAL` on it |
| **C-78 · OPEN** | CI applies an unrunnable migration file and pushes schema without review. **TST-F04 confirms `db:push --force` is CI's actual schema source; TST-D015 reverses it in the target.** Nothing has been changed, so it stays open |
| **C-72 / C-73** | the console's controls depend on an unapplied migration. **SEC-T15 tests the two bypasses `001`'s own header names — a data-modifying CTE and a second statement after a semicolon** |
| **C-90 · OPEN** | MFA enrolment does not require the current password. **SEC-T03 is `DEFINED`, and activates GREEN inside the MFA implementation batch that closes it** — TST-D036 |
| **C-23** | `SECONDARY_ROLE:*` strings as the context mechanism. **TST-D034 asserts a role string cannot satisfy a capability check** |
| **C-18 / BR-124** | prohibited log content. **§25's known-secret scan is the strongest automated form of it** |
| **C-102** | consequential audit is best-effort. **TST-D024's rollback test is what makes AD-026 verifiable** |
| **C-100 · C-101 · C-102 · C-103 — all OPEN** | no implementation evidence exists for any of them, so none moves. **MIG-T05 and MIG-T06 reconcile the audit migration; MIG-T07 now tests snapshot PRESERVATION** under A19-001; **§18's coverage test uses Stage 7's register, not its headline** |
| **A19-001** | Stage 19's post-lock owner amendment — legacy snapshots quarantined and preserved. **MIG-T07 and §33 are written against it**; final destruction is a policy gate, not a pipeline check |
| **C-103** | Stage 7's headline count. **§18's coverage test uses the register, not the headline** |
| **C-55** | unused dark code. **§34 tests one appearance, because Stage 10 supports one** |

### 49.2 New conflicts

**Verified: the last issued identifier is C-103 (Stage 19). The next is C-104. Stage 20 issues two —
C-104 and C-105; the next stage starts at C-106.**

**C-104 · A locked, mandatory accessibility contract has no verification mechanism of any kind —
ACTIVE**

*Evidence:* `client/src` contains **no `*.test.*` and no `*.spec.*`** — no component test, no browser
test, no accessibility check. `package.json` has no browser or accessibility tooling in
`devDependencies`. The CI workflow runs no frontend check beyond `tsc` and the production build.

*Locked requirement contradicted:* **DESIGN_SYSTEM.md §23** — *"Baseline: WCAG 2.2 Level AA across the
canonical design system … **This is mandatory for every pattern, not a later polish stage.**"* Stage 10
also states its guarantees are *"specified for, and verified against, the light appearance."* **The
token contrast ratios genuinely are verified — they are arithmetic, and §35 keeps that.** What is not
verified, by anything, is that the **shipped interface** conforms.

*Impact:* **the accessibility contract is currently an assertion, not a finding.** For a product used
in schools this is not only a quality gap: **an accessibility obligation that nobody has ever measured
cannot be evidenced to a customer, a procurement process or a regulator.** And on the tool vendor's own
statement, **automation alone cannot discharge it** — *"many accessibility problems can only be
discovered through manual testing."*

*What Stage 20 can and cannot do:* it can specify the automatable floor (§35's five checkable
properties, TST-D062) and it does. **It cannot perform, schedule or substitute for the manual
assessment**, and it does not pretend a green axe run is one.

*Owner decision, 31 August 2026 — 2A:* **the manual WCAG 2.2 AA assessment is MANDATORY BEFORE
PRODUCTION GO-LIVE.** §35.1 records the gate, its eight surfaces, the automation-proof list it must
cover, the independence preference and the release-evidence fields.

*State:* **TARGET POLICY RESOLVED / IMPLEMENTATION AND EVIDENCE OPEN. NOT CLOSED.**

```
C-104 CLOSES ONLY WHEN ALL SIX HOLD
   1  the target UI exists
   2  automated accessibility checks pass
   3  the manual assessment has occurred
   4  findings are remediated, or formally accepted as residuals
   5  the required re-test passes
   6  release evidence records the result

TODAY:  ZERO of the six.  The target UI does not exist yet.
```

*Resolution:* **§34 and §35 specify the automatable floor; §35.1 specifies the manual gate; §50's
handoff carries it as a release gate. The policy question is answered; the evidence does not exist.
Not closed.**

**C-105 · Locked Stage 5 and locked Stage 18 disagree about import transaction granularity — ACTIVE**

*Evidence, both from locked stages:*

> **BR-095 · An import commits completely or not at all** — *"All data changes in one import MUST occur
> in a single transaction."* Classified **EXISTING · STRUCTURAL**, enforced at `commitImport`.

> **OPS-D021 · Transaction granularity, stated exactly** — *"each LOGICAL ROW is one transaction … a
> chunk of 100 is a BATCHING UNIT for progress and memory, **NOT a rollback unit**"*, with the
> admin-visible consequence stated: *"a commit that fails part-way leaves the rows before the failure
> committed and the rest not."*

*Locked requirement contradicted:* **the two cannot both describe the target.** One import in one
transaction is not the same as one transaction per logical row, and the difference is precisely what an
administrator sees after row 63 fails.

*What this is NOT:* **it is not C-26.** C-26 records that the two *current* import pipelines disagree
with each other about validation, preview semantics and transactional guarantees. **C-105 is a
disagreement about the TARGET, between two locked stages.** Different artefacts, different owners.

*Which governs the target, and why:* **OPS-D021.** It is the later locked stage; it decided the point
**explicitly**, naming and rejecting the all-or-nothing chunk in terms; and **BR-095 is classified
`EXISTING`** — it documents current behaviour, and its own annotation points at Stage 12 for the target.
**Stage 4's WF-021 already anticipated the tension**, recording as an open point *"whether a partial
commit is permitted at all"* and warning that BR-095 *"is about atomicity of the committed set, not
about whether excluded rows may be dropped."*

*Impact:* **Stage 20's own draft encoded BR-095 and would have shipped a test asserting the behaviour
Stage 18 rejected** (TST-D082). Any later stage reading BR-095 alone builds the wrong thing.

*Resolution:* **a traceable Stage 5 amendment is REQUIRED to reconcile BR-095 with OPS-D021. Stage 20
does not make it** — it neither owns BUSINESS_RULES.md nor may silently retire a locked rule. §30 is
written to OPS-D021 and says so. **Not closed.**

**Nothing else is raised.** **TST-F03, F04 and F05 all looked like new conflicts and are not** —
`001`'s exclusion is **C-19**, `db:push` as CI's schema source is **C-78**, and the Node 20 pin is a
finding Stage 11 already owns with a decided remedy. **Checking before issuing is the whole point of a
stable identifier scheme**, and three of five candidates failing that check is the scheme working.

**No conflict closes here.** Stage 20 writes no code, provisions nothing and migrates nothing, so
**C-19, C-78, C-90, C-100, C-101, C-102 and C-103 are all OPEN and unchanged**; **C-104 has its policy
answered and its evidence outstanding**; **C-105 is newly raised and open.**

---

## 50. Owner decisions, handoffs, criteria and boundary

### 50.1 Owner decisions — answered, and the gates they create

**ZERO open owner questions.** The one this document raised has been answered, and the answer creates a
gate rather than closing a conflict.

```
OWNER DECISION 2A — 31 August 2026
   MANUAL WCAG 2.2 AA ASSESSMENT IS MANDATORY BEFORE PRODUCTION GO-LIVE.
   ── section 35.1 records the gate: eight surfaces, the automation-proof list,
      the independence preference, the release-evidence fields.
   ── C-104 is TARGET POLICY RESOLVED / IMPLEMENTATION AND EVIDENCE OPEN.
      IT DOES NOT CLOSE HERE.

OWNER DECISION 1A — 31 August 2026, recorded as Stage 19 A19-001
   LEGACY CONSOLE SNAPSHOTS: QUARANTINE AND PRESERVE PENDING APPROVED POLICY.
   ── MIG-T07 tests preservation; section 33 carries the destruction gate.
   ── the FINAL legal disposition remains POLICY INPUT REQUIRED, which is a
      POLICY INPUT and NOT an owner question.
```

**No other owner question is manufactured.** The runner, the browser tool, the isolation strategy, the
coverage policy, the pipeline shape and the fixture design are all **engineering, decided above with
their reasoning attached.**

**TST-D094 · The release-gate register separates automated gates from evidence gates from policy
gates, because they fail differently and are satisfied by different things**

| Gate | Kind | Satisfied by | Blocks |
|---|---|---|---|
| every ACTIVE INV-T · TEN-T · SEC-T · MIG-T · contract · coverage test | **automated** | a green pipeline | **the merge** |
| the automated accessibility floor — TST-D062's five properties | **automated** | a green pipeline | **the merge** |
| **MANUAL WCAG 2.2 AA ASSESSMENT** — 2A | **evidence** | **TST-D088's record** | **production promotion** |
| **legacy snapshot quarantine preservation** — 1A · A19-001 | **evidence** | MIG-T07's five conditions, reconciled | **MIG-14** |
| **final snapshot destruction** | **policy** | **APPROVED LEGAL / PRIVACY DISPOSITION** | **destruction only** — nothing else |
| independent penetration test — Stage 16 | **evidence** | its own report | production promotion |
| **BytHub Legal & Compliance go-live block** | **legal** | **its own process** | **everything** |

**An automated gate can be made green by a commit. An evidence gate cannot, and a policy gate cannot be
made green by engineering at all** — which is why they are listed apart rather than as one checklist
someone eventually reads as uniform.

**TST-D095 · No gate is marked PASS by this document.** Stage 20 designs the gates. **A design that
marked its own gates passed would be the single most misleading artefact in this restructure**, and the
temptation to do it is highest exactly when a stage is being locked.

### 50.2 Handoffs

```
STAGE 21   install and pin: Vitest, Playwright, @axe-core/playwright
           ── CONFIRM Playwright's resolved engine requirement at install time;
              §8's residual is not resolved by inference
           edit .github/workflows/ci.yml — TST-D071's four stages
           PIN NODE 24 from one source: .nvmrc, engines, the workflow
           REMOVE db:push from CI entirely                            TST-D015
           PRIVILEGED PROVISIONING — MIG-000's provisioning half: the console
              schema, the console read-only role, credential delivery.
              NOT a migration, and NOT a committed SQL file with passwords in it
                                                                      TST-D053
           the test roles: a NON-BYPASSING tenant role for §20's RLS tests
           the audit role: INSERT/SELECT only                         AUD-D040
           CI expresses §39's activation states WITHOUT any allow-failure,
              skip registry or expected-failures list                 TST-D093
           where the manual accessibility evidence record lives       TST-D089

STAGE 22   THE TARGET APPLICATION MIGRATION CHAIN — which MIG-T01 then tests
           ── MIG-000 is NOT promoted into it                         TST-D053
           MIG-07's audit migration, with MIG-T05/T06's row reconciliation
           THE LEGACY SNAPSHOT QUARANTINE MIGRATION — A19-001's six steps,
              which MIG-T07 then tests                                MIG-T07
           THE LEGACY ROUTE CUTOVER REGISTER — every entry naming its
              replacement API-nnn and its removal batch               TST-D080

STAGE 7    A7-001 · C-103 · the export capability question            Stage 19

STAGE 5    C-105 — a traceable amendment reconciling BR-095 with locked
           OPS-D021.  Stage 20 does not make it, and does not silently
           retire a locked business rule.

OWNER      ANSWERED — 2A manual accessibility gate · 1A snapshot quarantine
           REMAINING — procuring and scheduling the assessor: operational
           project work, not an architectural question

LEGAL      unchanged — audit retention, erasure, C-79
           the FINAL legacy snapshot disposition                      A19-001
```

### 50.3 Success criteria — answered

| Question | Answer |
|---|---|
| Is there a test level that can prove a database invariant? | **YES** — §6's database level, TST-P3 |
| Is the runner chosen on verified evidence? | **YES** — §7, Vitest's own version requirements, quoted |
| Are the existing suites deleted? | **NO** — TST-D007, preserved and migrated |
| Is the security suite's obsolete model deleted to go green? | **NO** — TST-D008, paired |
| Does CI's schema come from the migrations? | **IN THE TARGET, YES** — TST-D015. **Today, no** — TST-F04 · C-78 |
| Is MIG-000 blindly made runnable as a normal migration? | **NO** — TST-D053; the draft that said so contradicted locked Stage 15, and is corrected |
| Does MIG-T01 test the TARGET application migration chain? | **YES** — TST-D083, `DEFINED` pending Stage 22 producing the chain |
| Is every migration required to be idempotent? | **NO** — MIG-T03 tests only those documented as safely re-runnable |
| Does C-19 close at Stage 20? | **NO** — its resolution splits across Stage 21 provisioning and Stage 22 migration work |
| Is any test allowed to call a real provider? | **NO** — TST-P11, enforced by the network guard |
| Can a test reach production? | **NO** — TST-D078, structurally |
| Is production data used anywhere? | **NO** — TST-P10 · TST-D079 |
| Is I-2's rollback tested? | **YES** — six times, TST-D023, plus the audit asymmetry, TST-D024 |
| Is the audit taxonomy's coverage checked mechanically? | **YES** — TST-D026, against PERMISSIONS.md |
| Is RLS tested as the database, by a non-bypassing role? | **YES** — TST-D029, and the unset-context case is mandatory |
| Is every capability tested for its refusal? | **YES** — TST-D032 |
| Are there frontend tests? | **IN THE TARGET, YES** — §34, §35. **Today, none at all** — C-104 |
| Does a green pipeline mean WCAG 2.2 AA conformance? | **NO, and this stage refuses to let it be reported as one** — TST-D061 |
| Is the manual WCAG 2.2 AA assessment a pre-production gate? | **YES** — owner decision 2A, §35.1 |
| Is C-104 closed by that decision? | **NO** — policy resolved, evidence open; zero of its six closing conditions hold |
| Does passing both accessibility gates clear production? | **NO** — §35.2; the legal block is independently binding |
| Are the legacy console snapshots destroyed? | **NO** — A19-001; quarantined and preserved, and MIG-T07 tests preservation |
| Can any pipeline authorise destroying the quarantined bytes? | **NO** — APPROVED POLICY REQUIRED, and no test claims otherwise |
| Is any mandatory test permitted to sit red on a protected branch? | **NO** — TST-D036 · TST-D093; red belongs inside the implementation batch |
| Do test activation states exist? | **YES** — DEFINED · ACTIVE · SUPERSEDED · BLOCKED-EXTERNAL, and no fifth state |
| Does the legacy route cutover weaken the final API whitelist? | **NO** — TST-D080; at final cutover the allowlist is empty |
| Do the import tests match locked Stage 18's granularity? | **YES** — TST-D081; and TST-D082 records the test deliberately not written |
| Does any conflict close in this document? | **NO** |
| Is coverage a merge gate? | **NO** — TST-D066 |
| Are flakes retried away? | **NO** — TST-D069 |
| Is a green pipeline a clearance? | **NO** — TST-P20 · §1.3 |
| Were any tests written? | **NO** |
| Was anything installed? | **NO** |
| Was CI edited? | **NO** |

### 50.4 What Stage 20 deliberately does not decide

```
installing anything · pinning versions in package.json      STAGE 21
editing .github/workflows/ci.yml                            STAGE 21
database roles and privileges                               STAGE 21
MIG-000's privileged provisioning half                      STAGE 21
the target migration chain and its execution                STAGE 22
the legacy snapshot quarantine mechanism                    STAGE 22 — A19-001
the legacy route cutover register                           STAGE 22
reconciling BR-095 with OPS-D021                            STAGE 5 — C-105
latency budgets, load and soak testing                      STAGE 18 — already locked
procuring and scheduling the accessibility assessor         OPERATIONAL — 2A is decided
the FINAL legacy snapshot disposition                       APPROVED POLICY / LEGAL
statutory retention · which events may be erased            APPROVED POLICY / LEGAL
```

**No test was written, no test was run, no framework was installed, no dependency was added, no
workflow was edited, no migration was applied, no database was created, no role was provisioned, no
provider was configured, no production data was touched, nothing was deployed, and no code has
changed.**

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2** —
**and this stage is the design of the thing that would change that, not the thing itself.**

---

## 51. Amendment register — Stage 20

**Append-only. The locked text above is not rewritten; these amendments govern.**

**Verified before assigning: Stage 20 had no prior amendment. A20-001 is the first.**

### A20-001 · C-105's amendment belongs to Stage 4, not Stage 5 — and it has landed

```
A20-001 · C-105 ownership correction, and its resolution
RAISED BY   Stage 21's finalisation pass, 1 September 2026
TYPE        CORRECTION of a factual error in this document, plus a status update
STATUS      RECORDED
```

**THE ERROR.** §49.2 and §50.2 hand C-105's amendment to **"STAGE 5"**. That is wrong.
**BR-095 lives in `BUSINESS_RULES.md`, which is STAGE 4** — its own header reads *"BUSINESS_RULES.md —
Stage 4: Business Rules"*. **Stage 20 named the wrong stage, and the locked text is left as written so
the error is visible rather than quietly repaired.**

**THE CORRECTION.**

```
C-105's amendment owner   STAGE 4  ── BUSINESS_RULES.md
NOT                       STAGE 5
```

**THE RESOLUTION.** The owner decided on **1 September 2026** and the amendment has been recorded as
**A4-001** in `BUSINESS_RULES.md` — the first entry in that document's amendment register.

```
C-105  ──►  TARGET SPECIFICATION RESOLVED

   Stage 18 OPS-D021 governs the target: one LOGICAL ROW is one transaction.
   BR-095's identifier and text stand as the accurate record of CURRENT behaviour.
   §30's import tests, written to OPS-D021, are correct and unchanged.
   TST-D082 — the test deliberately NOT written — is correct and unchanged.

   IT IS NOT IMPLEMENTATION-RESOLVED.  The current import still commits
   all-or-nothing and still exists as two pipelines — that is C-26, which is
   a CURRENT-STATE conflict and remains OPEN and separate.
```

### A20-002 · C-104's release gate now has a home

**Owner decision 2A gave the manual accessibility assessment a mandatory pre-production gate.
Stage 21 §44 gives it a slot in the release mechanism, and Stage 21 REL-G014 makes it blocking.**
**C-104's state is unchanged: TARGET POLICY RESOLVED / IMPLEMENTATION AND EVIDENCE OPEN.**

---

```
STAGE 20 — TEST STRATEGY, VERIFICATION & EVIDENCE
STATUS: LOCKED — 31 August 2026, by the owner (BytHub Technology Ltd)
POST-LOCK AMENDMENTS: A20-001 · A20-002  (§51)

OWNER DECISIONS APPLIED
   1A  legacy console snapshots QUARANTINED AND PRESERVED pending policy
       ── recorded as Stage 19 A19-001; MIG-T07 and section 33 written against it
   2A  manual WCAG 2.2 AA assessment MANDATORY before production go-live
       ── section 35.1; C-104 target policy resolved, evidence open

Open owner questions: 0

IDENTIFIER COUNTS AT LOCK
   TST-P  20      TST-D  95      TST-F  10      TST-R  15
   INV-T  14      TEN-T  12      SEC-T  18      MIG-T  10      E2E-T  8
   Sections 50 · diagrams AY-1, AY-2

CONFLICT STATES AT LOCK — NONE CLOSED
   C-104  TARGET POLICY RESOLVED / IMPLEMENTATION AND EVIDENCE OPEN
   C-105  TARGET SPECIFICATION RESOLVED by A4-001 (1 Sept 2026).
          Implementation differences remain C-26, OPEN and separate.
   C-19   OPEN     C-78  OPEN     C-90  OPEN
   C-100 · C-101 · C-102 · C-103    ALL OPEN
   Stage 20 issued C-104 and C-105.  The next stage starts at C-106.

STAGE 21 HANDOFF  provisioning · roles · secrets · CI activation states ·
                  MIG-000's provisioning half · the accessibility evidence record
STAGE 22 HANDOFF  the target migration chain · the snapshot quarantine migration ·
                  the legacy route cutover register
STAGE 4  HANDOFF  C-105's traceable amendment — CORRECTED by A20-001,
                  and RECORDED as A4-001 on 1 September 2026

NOT CLAIMED BY THIS LOCK
   no test is implemented          no test is passing
   no tool is installed            no CI file is edited
   no provider is configured       no migration has run
   the baseline is NOT verified    ── still UNVERIFIED, capped at E2
   WCAG conformance is NOT claimed
   legal clearance is NOT claimed
   production readiness is NOT claimed
```
