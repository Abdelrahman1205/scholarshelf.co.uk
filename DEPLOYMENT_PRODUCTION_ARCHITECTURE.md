# DEPLOYMENT_PRODUCTION_ARCHITECTURE.md
# Stage 21: Deployment & Production Architecture

```
STAGE 21 — DEPLOYMENT & PRODUCTION ARCHITECTURE
STATUS: LOCKED — 1 September 2026 by the owner (BytHub Technology Ltd)
Written: 31 August 2026 · corrected and locked 1 September 2026
Owner decisions: DEPQ-1 = A  Vercel Pro · lhr1 · Neon Scale · eu-west-2
                 DEPQ-2 = A  app.scholarshelf.co.uk · staging.scholarshelf.co.uk
Open owner questions: 0
New conflicts: C-106 — TARGET RESOLUTION ESTABLISHED / IMPLEMENTATION OPEN
Amendments RECORDED: A14-001 + API-283 (API_CONTRACT.md) — the cron transport, §27
Amendments relied on: A19-001 (Stage 19) · A4-001 (Stage 4, C-105) ·
                      A20-001 · A20-002 (Stage 20)
```

**Governed by** Stages 1–20, **all LOCKED**, including their amendment registers: **A4-001**, A11-001,
A13-001, **A14-001**, A15-001, A15-002, A15-003, A16-001, A16-002, A17-001, **A19-001**, **A20-001**,
**A20-002**.

---

## 1. Purpose and boundary

Stage 21 answers: **what exact environments, accounts, runtime configuration, provider resources,
database privileges, secret boundaries, CI/CD gates, backup and restore controls, observability and
production-readiness controls must exist so the locked ScholarShelf architecture can be deployed safely
and reproducibly.**

It is **deployment design, provisioning design, environment design, CI/CD design and production-control
design.** It is **not** application implementation, migration execution, legacy removal, data backfill,
provider account creation, or deployment.

### 1.1 What Stage 21 decides — and does not

| Decides | Does not decide |
|---|---|
| the environment model and what isolates each from the next | **the target migration sequence** — Stage 22 |
| database privilege classes, and which identity the runtime holds | which migrations run, in what order — Stage 22 |
| **MIG-000's provisioning split**, on paper | legacy removal, backfill, cutover order — Stage 22 |
| connection pool, timeout and RLS-transaction deployment values | the application code that uses them |
| the migration **runner and gate** — *how* deployment gates migrations | *what* migrations run |
| the secret architecture and the env-validation boundary | rotating any secret |
| AWS, SES, S3, GuardDuty and Sentry **target resource models** | **creating any of them** |
| backup, restore-rehearsal, incident and rollback mechanisms | performing a restore or an incident response |
| the release-gate register and the promotion model | marking any gate PASS |

### 1.2 Nothing was created, configured or deployed

**No AWS resource, SES identity, S3 bucket, GuardDuty detector, Sentry organisation, Neon project,
database role or Vercel setting was created or changed. No secret was created, read or rotated. No
migration ran. No workflow file was edited. No package was installed. `package.json`, `vercel.json`,
`.github/workflows/ci.yml` and every application file are untouched. Nothing was deployed.**

Findings below are **E2** — read from the repository and from official provider documentation, not
observed in a running production environment. **Where a fact could only be established by looking at a
provider console this document does not have, it says so** rather than inferring it.

### 1.3 The release boundary is unchanged

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** A deployment architecture is not a deployment, a green gate
list is not a passed gate list, and **engineering verification is not legal clearance.**

---

## 2. Evidence inspected

**Repository — read directly, 31 August 2026**

```
package.json                21 scripts · devDependencies · NO engines field
vercel.json                 buildCommand · outputDirectory · functions.maxDuration
                            crons[] · rewrites · the full headers block
api/index.ts                THE PRODUCTION ENTRY — 14 lines, createApp({serverless:true})
server/app.ts               session configuration · trust proxy · route registration
server/config/env.ts        the Zod schema — 15 validated variables
server/config/database.ts   buildSslConfig() · getDb() · getTxDb() · THE POOL CONSTRUCTION
server/config/consoleDb.ts  the console tier connections
server/routes/cron.routes.ts   the trigger handler, its auth, and DRAIN_BUDGET_MS
server/routes/auth.routes.ts   /api/health — the only health route that exists
drizzle.config.ts           out ./migrations · schema shared/schema.ts · dialect postgresql
.github/workflows/ci.yml    both jobs, in full
migrations/                 001 … 006 · which the CI glob applies
script/smoke-boot.ts        the production-entry boot check, and its BOOT_ENV
ALL process.env.* reads     a full census across server/, api/ and script/
```

**Locked stages 1–20**, including A19-001 and Stage 20's registers.

**Official provider documentation — fetched 31 August 2026.** Recorded with source and residual,
because a provisioning constraint taken from memory is the same failure as a provider selected from
memory.

| # | Fact proven | Source | Residual |
|---|---|---|---|
| **E-1** | **Vercel triggers cron with an HTTP GET.** *"To trigger a cron job, Vercel makes an HTTP GET request to your project's production deployment URL, using the `path` provided."* Requests carry user agent `vercel-cron/1.0` and an `x-vercel-cron-schedule` header | Vercel cron-jobs docs | none — **and it is why C-106 exists** |
| **E-2** | **Vercel cron timezone is always UTC**; alternative expressions (`MON`, `JAN`) unsupported; day-of-month and day-of-week are mutually exclusive | same | none |
| **E-3** | **Vercel functions run in a single region by default, `iad1`** (US East), changeable in project settings | Vercel functions limits | **the project's actual configured region is not in the repository** — console evidence required |
| **E-4** | **Vercel request/response body maximum is 4.5 MB**, error 413 `FUNCTION_PAYLOAD_TOO_LARGE` | same | none |
| **E-5** | **Max duration**: Hobby 300 s; Pro/Enterprise 300 s default, 800 s maximum, 1800 s extended (beta) | same | **the account's plan is not in the repository** |
| **E-6** | **1,024 file descriptors shared across concurrent executions**, including runtime usage | same | none — **and it bounds §13's pool** |
| **E-7** | **Node.js 24 LTS is generally available for Vercel builds and functions** | Vercel changelog, linked from the Node.js runtime page | the runtime page defers to a versions sub-page not separately fetched |
| **E-8** | **Neon supports AWS `eu-west-2` (London)**, alongside Frankfurt | Neon regions docs | none |
| **E-9** | **A Neon project's region CANNOT be changed after creation.** *"You cannot change the region for an existing project."* Switching requires a new project and a data migration | same | none — **and it makes §9 a Stage 22 input, not a setting** |
| **E-10** | **The SES sandbox is per-Region.** Production access must be requested **separately for each region**. Sandbox = verified recipients only, 200 messages/24 h, 1 message/second, suppression-list management disabled | AWS SES production-access docs | none |
| **E-11** | **GuardDuty is available in `eu-west-2`** — `guardduty.eu-west-2.amazonaws.com` | AWS general reference, GuardDuty endpoints | none |
| **E-12** | **"GuardDuty Malware Protection for Amazon S3 is available in all AWS Regions where GuardDuty is available, excluding China Regions and GovCloud (US) Regions."** | AWS launch announcement, June 2024 | **this is a launch-era blanket statement, not a maintained per-region feature table** — §21 |
| **E-13** | **Sentry offers a US region (Iowa) and an EU region (Frankfurt), and the choice is irreversible**: *"once selected, your data storage location can't be changed. The only way to switch it is by creating a new organization."* | Sentry data-storage-location docs | none — **and it makes §24 a pre-provision gate** |

**Not inferred from a `.env.example`, a comment, a provider name or a package.** Where the repository
cannot prove a production setting, this document classifies it **CURRENT UNVERIFIED** and says which
console would settle it.

---

## 3. Current deployment baseline

**Four classifications, kept apart deliberately:**

```
CURRENT CONFIGURED   provable from a committed file
CURRENT DECLARED     the code says it wants this; nothing proves the environment supplies it
TARGET               a locked stage decided it
UNVERIFIED EXTERNAL  only a provider console can settle it — and this document has none
```

**AZ-1 · What the repository actually configures**

```
BUILD          vercel.json buildCommand "npm run build" → script/build.ts
OUTPUT         outputDirectory "dist/public"          ── the CLIENT bundle
SERVER         api/index.ts, compiled by Vercel independently at deploy time
               ── NOT dist/index.cjs, which `npm run build` produces and
                  which production never runs.  smoke-boot exists for this.
FUNCTION       maxDuration 30
REGION         ABSENT → platform default                      E-3 · C-63
CRON           one entry: GET /api/cron/run @ "0 7 * * *" UTC  E-1 · E-2
HEADERS        a full block INCLUDING a second CSP             A16-001 owns this
NODE           no `engines`, no `.nvmrc`; CI pins 20            Stage 11 owns this
MIGRATIONS     drizzle.config.ts out=./migrations, and `db:push` as the script
```

**DEP-F01 · The Vercel function region is not configured, so compute runs in the platform default.**
`vercel.json` has no `regions` key and no function-level region. Vercel's own limits page states
functions *"run in a single region by default (`iad1`)"* — **US East, Virginia.** For a UK schools
product whose locked target is UK/EU processing, **the compute processing children's records is, on
current evidence, in the United States.** **This is C-63's compute instance — Stage 11 already recorded
that *"the current compute region is still the platform default"*, and Stage 18 records C-63 as
`processing region`. NO NEW IDENTIFIER IS ISSUED.**

**DEP-F02 · The connection pool is constructed with no bounds of any kind.**

```ts
_pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: buildSslConfig(),
});
```

**No `max`. No `idleTimeoutMillis`. No `connectionTimeoutMillis`. No `statement_timeout`. No
`query_timeout`. No `application_name`.** On a platform that *"auto-scales up to 30,000"* concurrent
function instances (E-6's page), **each instance holds its own pool with the library default**, and
nothing in the repository bounds the total against any database's connection ceiling. **A single slow
query has no timeout and holds its connection until the function is killed at `maxDuration`.**

**DEP-F03 · `env.ts` calls itself "single source of truth for all environment variables", and eleven
variables bypass it.**

```
VALIDATED (15)   NODE_ENV · DATABASE_URL · DATABASE_SSL_CA · SESSION_SECRET · PORT
                 APP_BASE_URL · RESEND_API_KEY · RESEND_FROM_EMAIL
                 EXTERNAL_PAYMENT_API_URL · EXTERNAL_PAYMENT_API_KEY
                 PAYMENT_WEBHOOK_SECRET · CONSOLE_RO_DATABASE_URL
                 CONSOLE_RW_DATABASE_URL · ALLOW_MEMORY_STORAGE · FORCE_MEMORY_STORAGE

READ DIRECTLY, NOT VALIDATED (11)
   ALLOW_TEST_SUPERUSER    ← A KILL SWITCH
   CRON_SECRET             ← THE SCHEDULER'S ONLY AUTHENTICATION
   ORPHAN_ADMIN            ← A CREDENTIAL
   ORPHAN_PASSWORD         ← A CREDENTIAL
   PUBLIC_APP_URL          ← A SECOND CANONICAL ORIGIN
   DATABASE_SSL_STRICT     ← THE TLS ENFORCEMENT SWITCH
   EMAIL_API_KEY · EMAIL_FROM · CONTACT_INBOX_EMAIL · REPL_ID · STORAGE_DRIVER
```

**Stage 16 already found three of these** (`DATABASE_SSL_STRICT`, `CONTACT_INBOX_EMAIL`, `REPL_ID`).
**Stage 21 completes the census to eleven and adds the deployment consequence: the five marked above
are security-relevant, and none of them can make production fail to boot when absent or malformed.**

**DEP-F04 · There are two canonical-origin variables, and only one is validated.** `APP_BASE_URL` is in
the schema; **`PUBLIC_APP_URL` is read directly.** A password-reset or invitation link built from the
wrong one, or from neither, is a link that either does not work or points somewhere it should not.
**Stage 16 requires one configured canonical origin and forbids deriving it from `Host`.**

**DEP-F05 · The scheduler fails closed on authentication, and fails SILENT on absence.**
`cron.routes.ts` reads `process.env.CRON_SECRET` and returns 401 when it is missing or does not match —
**which is correct, and is also indistinguishable from "the cron is working" to anyone not reading
logs.** With `CRON_SECRET` unset in production, **every scheduled run 401s, no digest is sent, no
unpaid reminder goes out, and nothing alerts**, because the variable is outside the validated boundary
that would have refused to boot.

**DEP-F06 · Production TLS certificate verification is disabled by default, and warns instead of
failing.** `buildSslConfig()` returns `{ rejectUnauthorized: false }` in production unless
`DATABASE_SSL_CA` is set, and hard-fails only when `DATABASE_SSL_STRICT=true`. The code's own comment is
honest about why — *"to avoid a surprise outage on a LIVE app we don't hard-fail by default"* — **which
was a defensible call for a running product and is not the target posture.**

**DEP-F07 · Vercel cron issues GET; the locked target endpoint is POST.** `vercel.json` schedules
`/api/cron/run`, and Stage 14 locked **API-278 `POST /api/internal/jobs/run`**, recording the current
route as `GET|POST /api/cron/run` → **REPLACE — trigger only**. **Vercel cannot issue POST (E-1).** →
**C-106**.

**DEP-F08 · There is one health route, and the target needs two.** `GET /api/health` in
`auth.routes.ts` is the whole surface. **There is no `/api/health/live` and no `/api/health/ready`**, so
nothing can distinguish "the process is alive" from "this instance may safely receive authoritative
traffic".

**DEP-F09 · `maxDuration` is 30 seconds against a platform maximum far higher.** Vercel's Pro tier
allows 300 s by default and 800 s maximum (E-5). Stage 18's workload classes and `DRAIN_BUDGET_MS =
24_000` were designed against 30. **This is not a defect — it is a deployment value nobody has revisited
against the platform's actual limits, and §7 revisits it.**

**DEP-F10 · The build produces an artefact production does not run.** `npm run build` bundles
`server/index.ts` into `dist/index.cjs`; `outputDirectory` is `dist/public`; **production runs
`api/index.ts`, compiled independently by Vercel.** `script/smoke-boot.ts` exists precisely because this
gap caused three production outages. **This is CORRECT and is preserved — it is recorded here so that
§7 makes the deployed artefact explicit rather than implicit.**

### 3.1 What is already right, and is kept

| | |
|---|---|
| **`api/index.ts` memoises the app** | one `createApp` promise per instance, reused across invocations — the correct serverless shape |
| **`script/smoke-boot.ts`** | compiles and boots **the real production entry** under production-shaped env. **Kept, unchanged, first in the pipeline** |
| **separate console connection strings** | `CONSOLE_RO_DATABASE_URL` / `CONSOLE_RW_DATABASE_URL`, with the comment stating the correct failure mode: *"Absent = that console tier is simply unavailable … no silent fallback onto the application's own high-privilege connection."* **This is exactly the privilege separation §10 formalises, already understood** |
| **driver chosen by URL** | `isPlaintextDatabase()` and the Neon-vs-`node-postgres` split, with the reasoning documented. **Kept — and A13-001 constrains which one RLS reads may use** |
| **`trust proxy` for secure cookies behind the edge** | required on Vercel, and present |
| **`sameSite: "strict"`, `httpOnly: true`, `secure: IS_PRODUCTION`** | the cookie posture is already close to target; §29 completes it |
| **timing-safe cron secret comparison** | `timingSafeEquals`, not `===` |
| **a real PostgreSQL service in CI** | the integration job is not a mock |

**The deployment code in this repository was written by someone who had been burned by production and
learned the right lesson each time.** Its gaps are the ones you get from shipping under pressure — no
bounds on the pool, a widening env boundary, one health route — **not from carelessness.**

---

## 4. Deployment principles and owner decisions — DEP-P1 … DEP-P20

```
DEP-P1    THE ARTEFACT THAT SHIPS IS THE ARTEFACT THAT WAS TESTED.
          smoke-boot's insight, promoted to a principle.               DEP-F10

DEP-P2    EVERY ENVIRONMENT IS ISOLATED BY RESOURCE, NOT BY DISCIPLINE.
          "we are careful not to point CI at production" is not isolation.

DEP-P3    THE APPLICATION RUNTIME HOLDS THE LEAST PRIVILEGE THAT WORKS.
          No superuser.  No BYPASSRLS.  Not the table owner.  Not the
          migration identity.

DEP-P4    A MIGRATION IDENTITY IS NOT A RUNTIME IDENTITY, EVER.

DEP-P5    PROVISIONING IS NOT MIGRATION.  Roles, credentials and provider
          resources are operator work; schema evolution is a migration.
          MIG-000 is the case that proves it.                          §11

DEP-P6    NOTHING UNBOUNDED REACHES PRODUCTION.  Not a pool, not a query,
          not a transaction, not a request body.                       DEP-F02

DEP-P7    PRODUCTION FAILS TO BOOT ON MISSING OR UNSAFE REQUIRED CONFIG.
          A warning nobody reads is not a control.               DEP-F03 · F06

DEP-P8    NO SECRET IN GIT.  Not a placeholder, not "REPLACE_ME", not a
          default that works.

DEP-P9    A PREVIEW IS UNTRUSTED.  It gets no production data, no production
          secret and no production provider.

DEP-P10   AN IRREVERSIBLE PROVIDER CHOICE IS A GATE BEFORE IT IS A TASK.
          Sentry's region and Neon's region cannot be changed later. E-9 · E-13

DEP-P19   A CAPACITY LIMIT IS MEASURED, NOT INFERRED FROM A PLAN NAME.
          The connection ceiling comes from `SHOW max_connections;` on the
          actual database, never from a tier.                        DEP-D025

DEP-P20   AN UNGUESSABLE IDENTIFIER IS DEFENCE IN DEPTH, NEVER AUTHORISATION.
          A policy error is a security failure even if the key was random.
                                                                     DEP-D050

DEP-P11   A BACKUP THAT HAS NOT BEEN RESTORED IS NOT A BACKUP.           §31

DEP-P12   NO PRODUCTION PUPIL DATA LEAVES PRODUCTION.  Not to CI, not to
          staging, not to a laptop, not "anonymised".

DEP-P13   DEPLOYMENT ROLLBACK AND DATABASE ROLLBACK ARE DIFFERENT THINGS,
          AND SAYING OTHERWISE IS HOW DATA IS LOST.                      §33

DEP-P14   THE MIGRATION GATE FAILS CLOSED.  A failed migration means the new
          version does not become authoritative.

DEP-P15   ONE TARGET NODE MAJOR, ASSERTED FROM ONE SOURCE.               §8

DEP-P16   OBSERVABILITY CARRIES NO PERSONAL DATA.  Not in an error, not in a
          breadcrumb, not in an alert label.

DEP-P17   EVERY RELEASE PRODUCES EVIDENCE, AND THE EVIDENCE NAMES ITS
          COMMIT.                                                        §37

DEP-P18   ENGINEERING CANNOT CLEAR ITSELF FOR PRODUCTION.  Legal, privacy,
          accessibility and penetration-test gates are not engineering
          gates and cannot be satisfied by a pipeline.
```

---

### 4.1 Owner decisions — DEPQ-1 = A and DEPQ-2 = A

**Decided by the owner, BytHub Technology Ltd, 1 September 2026. Both were commercial or contractual
questions; neither was an engineering choice this stage could make for itself.**

**DEP-D142 · DEPQ-1 = A · The provider plan and region target**

```
VERCEL      PRO
            staging     ── its own Vercel PROJECT
            production  ── its own Vercel PROJECT
            production application functions  ──  lhr1   LONDON, UK

NEON        SCALE
            staging     ── its own PROJECT · eu-west-2 London
            production  ── its own PROJECT · eu-west-2 London
```

**This records the INTENDED TARGET. It does not claim the existing accounts are already on those
plans, in those regions, or split into those projects.** Actual account state stays
**PROVISIONING VERIFICATION REQUIRED** — §49's PFL register is unchanged in that respect, and
**DEP-D143 says exactly what "unverified" still means after an owner decision.**

**DEP-D143 · An owner plan decision is an intent, and it does not verify an account**

```
WHAT THE DECISION SETTLES     which plan and region we are BUILDING FOR
WHAT IT DOES NOT SETTLE       what the accounts are on TODAY

DO NOT WRITE   "the current database is already Scale."
DO NOT WRITE   "production is already in eu-west-2."
DO NOT WRITE   "the Vercel team is already Pro."

PFL-003  Vercel plan                    PROVISIONING VERIFICATION REQUIRED
PFL-004  Neon production region         PROVISIONING VERIFICATION REQUIRED
PFL-005  actual connection capacity     PROVISIONING VERIFICATION REQUIRED
PFL-006  Neon backup / PITR capability  PROVISIONING VERIFICATION REQUIRED
```

**DEP-D144 · One application region, deliberately — and multi-region is an amendment, not a setting**

```
FORBIDDEN FOR V1
   iad1 as the production application region
   multiple Vercel execution regions
   automatic US failover

CHOSEN
   ONE application region: lhr1 (London)
   ONE database region:    eu-west-2 (London)
   ── same UK geography class, low latency between compute and data
```

**The reason is not latency alone; it is that there is one PostgreSQL write authority.** A second
execution region does not make the system more available — **it makes some requests further from the
only database that can accept a write**, and it multiplies the connection budget (§13) against a
ceiling that did not grow. **A future high-availability or multi-region change requires its own
architecture amendment**, because it changes the write model, not the deployment.

**DEP-D145 · A billing plan is not a project, and the document does not confuse them**

```
VERCEL PRO is a TEAM / ACCOUNT PLAN.
The BytHub team may hold BOTH the staging project and the production project
under that one Pro plan.

── separate PROJECTS is an isolation decision            §6
── ONE Pro PLAN is a commercial fact
── they are not the same statement, and neither implies the other
```

**DEP-D146 · DEPQ-2 = A · The canonical origins**

```
PRODUCTION_APP_ORIGIN     https://app.scholarshelf.co.uk
STAGING_APP_ORIGIN        https://staging.scholarshelf.co.uk

── EXACT HTTPS ORIGINS.  Scheme and host, both load-bearing.
```

**The production authenticated application uses `app.scholarshelf.co.uk` for all seven of these, and
derives none of them from a request:**

```
password reset links            invite acceptance links
canonical generated links       ORIGIN VALIDATION
CORS allowlist                  CSRF origin
security-sensitive redirects

NEVER DERIVED FROM   Host  ·  X-Forwarded-Host  ·  the request URL
   ── DEP-D082: `trust proxy` exists so a secure cookie is issued behind the
      edge.  It is not permission to let a caller name the origin.
```

**DEP-D147 · The root and www hosts are not authentication authorities**

```
https://scholarshelf.co.uk        NOT an auth-authority origin
https://www.scholarshelf.co.uk    NOT an auth-authority origin

PERMITTED TARGET BEHAVIOUR
   redirect to the app                              ── the simple option
   OR later serve corporate / marketing content     ── a product decision

FORBIDDEN
   making either a SECOND authentication authority
   ── two hosts that can both mint or receive a session is two attack surfaces
      and one confusion, and __Host- cookie scoping (§29) already forbids it

STAGE 22 decides the safest transition from whatever is live today.
   ── `www.scholarshelf.co.uk` is where the product lives NOW, so the change is
      a user-visible cutover, not a DNS edit
```

**DEP-D148 · Environment origins never cross**

```
STAGING-GENERATED invite / reset / support link
   ──►  https://staging.scholarshelf.co.uk        ONLY.  Never production.

PRODUCTION-GENERATED link
   ──►  https://app.scholarshelf.co.uk            ONLY.  Never staging.
```

**A staging reset link that lands on production is an account takeover with a friendly explanation
attached** — a tester clicks it, sets a password, and the account they changed belongs to a real
family. §18's environment validation is what makes the mistake unbootable rather than merely
discouraged.

**DEP-D149 · Vercel preview URLs are never canonical, for anything**

```
*.vercel.app preview deployments
   NOT a canonical origin
   NOT trusted for any credential-bearing link
   NOT a production cookie origin
   NOT a production CORS origin
   NOT a cron target                                §27 · §35
```

**DEP-D150 · Public school websites are unaffected by this decision.** They remain separate public
origins under the already-locked CMS and public-site architecture (§28's classes 2–4), they carry no
session (§29), and **nothing in DEPQ-2 changes their contract.**

---

## 5. Environment model

**DEP-D001 · Four environments, and the boundary between each pair is a resource boundary**

| | LOCAL | CI | STAGING | PRODUCTION |
|---|---|---|---|---|
| **Purpose** | development | automated verification | production-shaped rehearsal | real schools |
| **Database** | developer-controlled local PostgreSQL | **ephemeral, created and destroyed per run** | **its own Neon project** | **its own Neon project** |
| **Data class** | synthetic | synthetic, disposable | **synthetic / UAT-safe only** | **real pupil data** |
| **Providers** | none or local fakes | **none — the network guard blocks them** | **dedicated staging resources** | production resources |
| **Secrets** | developer's own | **CI-only, never production** | staging-only | production-only |
| **Reachable from** | the developer | the runner | the team | **deployment operators only** |
| **Destruction** | at will | **every run** | on demand, freely | **never casually** |

**DEP-D002 · Staging never shares production's database, and CI never shares either**

```
FORBIDDEN, STRUCTURALLY
   staging  ──►  production database        a rehearsal that can corrupt the thing
                                            it is rehearsing for is not a rehearsal
   CI       ──►  staging or production DB   a test suite's whole job is to break things
   preview  ──►  production anything        §35
   CI       ──►  production provider secret an untrusted PR must never hold one
```

**Neon's constraint makes this cheap to state and expensive to get wrong: a project's region cannot be
changed after creation (E-9).** So "we will separate staging later" means "we will migrate a database
later", and it is worth not needing to.

**DEP-D003 · Preview deployments are an environment, and the document treats them as one.** Vercel
creates one per push whether or not anyone plans for it. **An environment nobody designed is an
environment with production secrets in it by accident** — §35.

---
---

## 6. Environment isolation register — ENV-001 … ENV-004

**Every field is a target. Where the repository cannot prove the current value, the row says
`UNVERIFIED — console evidence required` rather than guessing.**

| | **ENV-001 LOCAL** | **ENV-002 CI** | **ENV-003 STAGING** | **ENV-004 PRODUCTION** |
|---|---|---|---|---|
| **Purpose** | development | automated verification | production-shaped rehearsal | real schools |
| **Vercel** | none — `npm run dev` | none | **its own project** (or a protected branch of one), with its own env scope | **the production project**, `main` only via §38 |
| **Database** | local PostgreSQL | **ephemeral PostgreSQL 16, created per run, destroyed after** | **its own Neon project, `eu-west-2`** | **its own Neon project — region UNVERIFIED, §9** |
| **AWS scope** | none | none | **staging bucket prefix + staging IAM role**; ideally a separate account | **production buckets + production IAM role** |
| **SES identity** | none | none | **staging sender on a staging subdomain**; sandbox is acceptable here | **production sender; production access GRANTED in `eu-west-2`** — E-10 |
| **S3** | none | none | `scholarshelf-staging-*` | `scholarshelf-prod-*` |
| **Scanner** | none | none | **enabled — this is where §21's verification happens** | enabled |
| **Sentry** | disabled | disabled | **`staging` environment in the EU org** | **`production` environment in the EU org** |
| **Domain** | `localhost:5000` | `localhost` | a staging hostname, **`noindex`** | the canonical production origin — §56's DEPQ-2 |
| **Cron** | manual invocation | **invoked directly in-process, never on a timer** | **enabled**, so the transport itself is rehearsed | enabled |
| **Secrets** | developer's own | **CI-only** | staging-only | **production-only** |
| **Data class** | synthetic | synthetic, disposable | **synthetic / UAT-safe ONLY** | **real pupil data** |
| **Who may access** | the developer | the runner | the team | **deployment operators — §36** |
| **Deployment source** | the working tree | the PR | **an eligible merged commit** | **a promoted release candidate — §38** |
| **Reset policy** | at will | **every run** | **freely, and it should be reset often** | **never casually; §31's restore rehearsal is the only routine copy** |

**DEP-D004 · The separation objective, stated as a test rather than an aspiration**

```
A CI BUG, A STAGING MISTAKE OR A COMPROMISED PREVIEW MUST NOT BE ABLE TO
READ, WRITE OR DESTROY PRODUCTION DATA.

   ── not "should not"
   ── not "we would notice"
   ── the credential must not exist in that environment
```

**Where a separate AWS account per environment is disproportionate, resource-level separation with
IAM policies scoped by bucket prefix and by role is acceptable — provided the staging role cannot name
a production bucket.** §19 records that decision and its trade-off honestly.

---

## 7. Vercel deployment model

**DEP-D005 · The deployed artefact is named explicitly, because implicitly it has already gone wrong
three times**

```
WHAT VERCEL RUNS      api/index.ts, compiled by Vercel at deploy time
                      → createApp({ serverless: true }) → the Express app
WHAT `npm run build`  dist/index.cjs, from server/index.ts
PRODUCES              ── NOT UPLOADED.  outputDirectory is dist/public.
WHAT IS UPLOADED      dist/public — the client bundle

THE GAP THAT CAUSED THREE OUTAGES:  a committed file importing an uncommitted
one built fine locally and died on Vercel, because the artefact that shipped
had never been compiled from a clean checkout.

THE CONTROL:  script/smoke-boot.ts, FIRST in the pipeline, BEFORE the build.
              KEPT UNCHANGED.                              DEP-P1 · Stage 20 §41
```

**DEP-D006 · Target Vercel configuration**

| Setting | Current | Target | Why |
|---|---|---|---|
| **plan** | UNVERIFIED | **Pro** — DEPQ-1 = A; **the account's actual plan is PFL-003** | E-5's limits follow the plan |
| **production project** | one | **its own project** — DEPQ-1 = A | |
| **staging** | none | **its OWN Vercel project**, with its own env scope — DEPQ-1 = A. **Both may sit under the one Pro team plan** — DEP-D145 | ENV-003 |
| **preview** | default, on every push | **restricted** — §35 | DEP-P9 |
| **function region** | **absent → `iad1`** (E-3) | **`lhr1` — London, UK. Exactly one region** | **C-63** · DEP-F01 · DEPQ-1 = A |
| **Node runtime** | unset | **24 LTS, pinned** — E-7 | §8 |
| **`maxDuration`** | 30 | **revisit against Stage 18's budgets; the platform allows far more (E-5)** | DEP-D007 |
| **build command** | `npm run build` | unchanged | |
| **output directory** | `dist/public` | unchanged | |
| **cron** | `GET /api/cron/run` | **§27's adapter** | **C-106** |
| **custom domains** | UNVERIFIED | §28 | |
| **deployment protection** | UNVERIFIED | **staging and preview are not publicly reachable** | §35 |

**DEP-D007 · `maxDuration` is a deployment value derived from Stage 18's budgets, not a default**

```
STAGE 18 OWNS THE BUDGET   interactive p95 ≤ 250 ms · I-2 transaction ≤ 250 ms p95
                           DRAIN_BUDGET_MS = 24_000 for the cron drain
PLATFORM ALLOWS            Hobby 300 s · Pro 300 s default, 800 s max        E-5
CURRENT SETTING            30 s

TARGET
   interactive functions   ── LOW.  A request that needs 30 s is a defect, and a
                              generous ceiling hides it.
   the job runner          ── HIGHER, matched to DRAIN_BUDGET_MS plus headroom,
                              so a drain ends because its budget expired and not
                              because the platform killed it mid-write
```

**Two ceilings, not one, because they fail differently.** An interactive timeout should be tight enough
to surface a slow query; a batch drain's ceiling must exceed its own budget, **or the drain is killed
between a commit and its progress record.** The exact seconds are set once the plan (E-5) is known —
**§56 records the plan tier as an owner input, not an engineering guess.**

**DEP-D008 · `outputDirectory` and the server entry stay as they are.** This is unusual and correct:
the client is a static bundle, the server is a function, and they are built by different mechanisms.
**Nothing in this stage "tidies" it, because the tidy version is the one that broke production.**

---

## 8. Node and runtime — one authority

**DEP-D009 · One target major, asserted from one source, machine-checked**

**Stage 11 locked Node 24 LTS, pinned. Vercel supports it (E-7). Vitest 4 requires ≥ 20 (Stage 20 §7).
Node 20 reached end of security support in April 2026.** Everything agrees except the repository.

```
CURRENT       package.json   no `engines`
              repo           no `.nvmrc`
              CI             node-version: "20"        ← EOL
              Vercel         unset → platform default
              developers     whatever they have

TARGET        ONE CANONICAL MACHINE-READABLE AUTHORITY

              package.json  "engines": { "node": ">=24 <25" }
                            ── or the equivalent exact-major expression the final
                               tooling supports.  THIS IS THE ONLY AUTHORITY.

              CI            DERIVES the version from package.json.  Never a literal.
              Vercel        configured, and VERIFIED against that target.
              developers    a preflight compares the running major against
                            package.json and says so when it differs

              .nvmrc        NOT a second authority.
                            ── if it is kept at all, it is GENERATED from
                               package.json and VERIFIED against it, never
                               hand-maintained
```

**DEP-D010 · One authority, three readers — a correction to this document's own draft**

**The draft said "written once and read four times" and then wrote `24` into BOTH `package.json` and
`.nvmrc`. That is two authorities, and two authorities drift.** The drift is invisible until a
runtime-specific bug appears in exactly one environment, at which point nobody can say which number
was right.

```
CANONICAL     package.json  engines.node
DERIVED       CI · Vercel · developer preflight · (.nvmrc, if generated)
ASSERTED      a CI step fails when any reader disagrees with the canonical value

DO NOT REQUIRE a second manually maintained Node-major literal, anywhere.
```

---

## 9. Neon and PostgreSQL environments

**DEP-D011 · Three databases, no sharing — and the region is decided before creation, not after**

**Neon's constraint is the whole design here: *"You cannot change the region for an existing project"*
(E-9).** A region is not a setting; **it is a property of the project's existence.**

| | Database | Plan target | Region target |
|---|---|---|---|
| **CI** | ephemeral PostgreSQL 16 in the runner | n/a | n/a |
| **STAGING** | **its own Neon PROJECT** | **Scale** — DEPQ-1 = A | **`eu-west-2` (London)** — available, E-8 |
| **PRODUCTION** | **its own Neon PROJECT** | **Scale** — DEPQ-1 = A | **`eu-west-2` (London)** |

**The owner chose Scale for both, and the reason staging matches production is parity:** a rehearsal on
a different provider class rehearses a different system. **Backup and point-in-time-recovery capability,
connection behaviour and feature availability are all plan properties**, and a staging environment that
does not share them cannot prove the production one. **Scale's pricing is usage-based, so parity here
is not the same cost decision it would be on a fixed tier** — but the plan's actual entitlements are
still **PFL-006**, verified against the console rather than assumed from a name.

**DEP-D012 · The current production region is UNVERIFIED, and this document will not guess it**

```
WHAT THE REPOSITORY PROVES     DATABASE_URL is an environment variable
                               the driver is chosen by hostname
WHAT IT DOES NOT PROVE         which Neon region the production project is in
WHAT WOULD SETTLE IT           the Neon console — which this document does not have

CLASSIFICATION                 CURRENT UNVERIFIED
```

**DEP-D013 · If the current production project is not in a UK/EU region, that is a STAGE 22 MIGRATION
INPUT and a DEPLOYMENT BLOCKER — and Stage 21 does not move it**

```
IF region ≠ target
   ── a Neon region change is a PROJECT MIGRATION (E-9), not a setting change
   ── it means: create the target project, migrate every row, cut over, verify
   ── it is therefore Stage 22's, sequenced with the rest of the migration work
   ── AND IT IS A GO-LIVE BLOCKER for C-63, which is already open

STAGE 21 RECORDS THE REQUIREMENT AND THE CONSTRAINT.  IT MOVES NOTHING.
```

**This compounds with DEP-F01.** C-63 is *"processing region"*, and processing has two halves: **where
the data rests (Neon) and where it is processed (the Vercel function region, currently `iad1`).**
**Both must be settled, and settling one is not settling the other.**

---

## 10. Database role model

**This is the critical Stage 21 deliverable, and the repository already has the right instinct in
`consoleDb.ts`.**

**DEP-D014 · Six privilege classes, and the application is not the most privileged of them**

| Role | May | May NOT | Used by |
|---|---|---|---|
| **DBROLE-1 · MIGRATION / DDL OWNER** | `CREATE` · `ALTER` · `DROP` · own objects · create policies and roles as the migration requires | **never serve application traffic** | **the migration runner only, during the gate at §14** |
| **DBROLE-2 · APPLICATION** | `SELECT` `INSERT` `UPDATE` `DELETE` on the tables it needs; `SET LOCAL` for the RLS context; open transactions | **NO superuser · NO `BYPASSRLS` · NOT the owner of any RLS-protected table · NO DDL · NO role management** | **the Vercel runtime** |
| **DBROLE-3 · TEST APPLICATION** | exactly DBROLE-2's grants, in CI | **NO `BYPASSRLS`** — Stage 20 TST-D029 | the test harness |
| **DBROLE-4 · CONSOLE READ** | `SELECT` on the **console view schema only** | **NO writes · NO base tables · NO credential columns** | `CONSOLE_RO_DATABASE_URL` |
| **DBROLE-5 · CONSOLE ELEVATION** | the bounded write set Stage 16 locked, **only during an elevation** | **NO standing grant** | `CONSOLE_RW_DATABASE_URL` |
| **DBROLE-6 · BACKUP / RESTORE OPERATOR** | initiate a restore into an **isolated** target | **NO write to production; NO restore INTO production without §32's runbook** | §31 |

**DEP-D015 · The application must not own the tables it reads under RLS, and this is the subtle one**

```
POSTGRESQL FACT   a table's OWNER is exempt from that table's RLS policies
                  unless FORCE ROW LEVEL SECURITY is set

CONSEQUENCE       if DBROLE-2 owns the tables, EVERY RLS POLICY IS DECORATIVE
                  and every tenancy test passes vacuously

TARGET            DBROLE-1 owns the tables.  DBROLE-2 is granted on them.
                  AND `ALTER TABLE … FORCE ROW LEVEL SECURITY` is applied,
                  so even an ownership mistake does not silently disable
                  the boundary.
```

**Two mechanisms, because they fail differently** — the same reasoning Stage 19 applied to audit
immutability. **Ownership separation is bypassed by an ownership change; `FORCE` is bypassed by a
migration that drops it. Together, neither accident is silent.**

**DEP-D016 · The runtime never holds DBROLE-1's credential.** `DATABASE_URL` in the Vercel runtime is
DBROLE-2's connection string. **The migration credential exists only in the migration gate's execution
context (§14) and is not present in any function environment** — because a runtime that can `DROP TABLE`
turns any injection or any bug into a data-loss event.

**DEP-D017 · Absence disables a tier; it never falls back to a higher one.** `consoleDb.ts` already
does this and its comment states the reason. **Stage 21 promotes it to a rule for every role: a missing
credential means that capability is unavailable, never that a more privileged connection is
substituted.**

---

## 11. MIG-000 provisioning split

**Stage 20 TST-D053 re-scoped MIG-000. Stage 21 performs the split on paper, statement class by
statement class, from the file itself.**

**DEP-D018 · Four classes, and only one of them is a migration**

| Class | What it is | Where it goes |
|---|---|---|
| **A · APPLICATION-SCHEMA MIGRATION** | `CREATE SCHEMA console` and the view definitions that mirror public tables — **structure the application depends on** | **Stage 22's reviewed migration chain**, as ordinary reviewed DDL |
| **B · PRIVILEGED DATABASE PROVISIONING** | `CREATE ROLE` · `GRANT` · `REVOKE` · role attributes · default privileges — **operator work requiring project-owner privilege** | **STAGE 21's provisioning procedure**, run by an operator against each environment |
| **C · SECRET / CREDENTIAL MATERIAL** | the two `REPLACE_ME` passwords the file's own header tells you to substitute | **NEVER COMMITTED.** Generated at provisioning time, delivered by §17's secret mechanism, never present in Git in any form |
| **D · LEGACY / REJECT** | anything superseded by the target schema | **removed only in Stage 22**, never before |

```
                    ┌──────────────────────────────────────────┐
                    │  001_console_hardening.sql  (MIG-000)    │
                    │  ── today: one file, one run, by hand    │
                    └───────────────────┬──────────────────────┘
                                        │  classify, do not execute
        ┌───────────────┬───────────────┼───────────────┬──────────────┐
        ▼               ▼               ▼               ▼              ▼
    A · SCHEMA      B · ROLES &     C · SECRETS     D · LEGACY    (nothing else)
    console schema  GRANTS          two passwords   superseded
    + views         CREATE ROLE     ── generated    statements
        │           REVOKE/GRANT       per env
        │               │               │               │
        ▼               ▼               ▼               ▼
    STAGE 22        STAGE 21        §17 SECRETS     STAGE 22
    migration       provisioning    ── never Git    removal
    chain           runbook
        │               │
        └──────┬────────┘
               ▼
    MIG-T01 can then run:  provisioning is a PRECONDITION of the test
    environment; the chain is what the test exercises.   Stage 20 TST-D083
```

**DEP-D019 · A SQL file containing passwords is never the provisioning mechanism**

**The file's own header says: *"BEFORE RUNNING: replace both REPLACE_ME passwords with long random
strings."*** That instruction is correct for a one-off manual run and **disqualifies the file as an
automated mechanism**, because the only ways to automate it are to commit a secret or to template one
in — and the second is how the first eventually happens.

```
TARGET PROVISIONING PROCEDURE
   role names             declared, reviewed, in Git
   role passwords         GENERATED at provisioning time, per environment
   the procedure          a runbook or an IaC definition (§48) that READS the
                          secret from the secret store and never writes it back
   the credential         delivered to the runtime by §17, never through a file
   idempotency            re-runnable: the roles exist or are created; grants
                          are asserted, not blindly re-issued
```

**DEP-D020 · C-19 does not close here.** Stage 21 designs the provisioning half; **Stage 22 builds the
schema half into the chain; the conflict closes when both have landed and SEC-T15 is ACTIVE and
green.** Stage 20 already recorded this split, and Stage 21 does not claim more than executing its own
half's design.

---

## 12. RLS deployment

**A13-001 (locked) requires scoped RLS reads to run on a transaction-capable connection: `BEGIN` →
`SET LOCAL` → query → transaction end. Stage 21 makes that safe in deployment rather than restating
it.**

**DEP-D021 · The RLS read path's deployment requirements, all six**

```
1  CONNECTION      node-postgres over the POOL — getTxDb(), never the Neon HTTP
                   driver.  A13-001: Neon HTTP is for genuinely non-RLS,
                   non-contextual reads ONLY.
2  ROLE            DBROLE-2.  NOT the owner.  NO BYPASSRLS.  FORCE RLS on.
3  ACQUIRE         from the bounded pool (§13), with a connection timeout — a
                   request that cannot get a connection FAILS, it does not wait
                   for the function's 30 s ceiling.
4  SET LOCAL       inside the transaction.  `SET LOCAL` dies with the
                   transaction; a plain `SET` would leak the tenant context
                   onto the NEXT request that reuses the connection.
5  TIMEOUTS        statement_timeout AND idle_in_transaction_session_timeout —
                   an open transaction holding a tenant context is worse than a
                   slow query, because it holds a connection AND a context.
6  RELEASE         on every path, including the error path.
```

**DEP-D022 · There is no fallback from a transaction-capable connection to Neon HTTP for an RLS read,
ever**

```
IF the pool is exhausted or the transaction cannot be opened
   ── THE REQUEST FAILS.

IT DOES NOT     silently fall back to the HTTP driver
                ── which cannot hold a transaction, so SET LOCAL has no scope,
                   so the policy has no context, so the read returns either
                   nothing or everything, and NEITHER IS DETECTABLE AT THE
                   CALL SITE.
```

**"Degrade gracefully" is the wrong instinct here.** A tenancy boundary that degrades is a tenancy
boundary that leaks, and **pool pressure is exactly the condition under which nobody is reading logs
carefully.** §13 sizes the pool so this is rare; **DEP-D022 makes it safe when it is not.**

**DEP-D023 · `idle_in_transaction_session_timeout` is set, and it is not optional.** An abandoned
transaction on a serverless platform is not cleaned up by a process exiting — **the function instance
may be frozen mid-transaction and thawed later**, and the database is the only thing that can end it.

---

## 13. Connection pool and timeouts

**DEP-D024 · Every value is bounded, and each is derived rather than chosen by feel**

**DEP-D151 · The connection ceiling is a property of the PROVISIONED COMPUTE, not of the plan name —
a correction**

**The draft said the ceiling is "determined by the COMMERCIAL PLAN." That is incomplete, and acting on
it would produce a wrong number with a confident source.**

```
WHAT ACTUALLY SETS THE DIRECT POSTGRESQL CONNECTION CEILING
   the PROVISIONED COMPUTE SIZE of the branch/endpoint being connected to
   ── the plan governs what compute sizes are AVAILABLE and how they scale
   ── it does not, by itself, state a number

THEREFORE THE DEPLOYMENT VERIFICATION IS A MEASUREMENT, NOT A LOOKUP:

      SHOW max_connections;

   run against the ACTUAL staging database, and the ACTUAL production database,
   at the compute size they will actually run.                        DEP-P19
```

**The three constraints that set the numbers:**

```
DATABASE           max_connections, MEASURED on the real endpoint      DEP-D151
                   ── minus a RESERVE for migrations, the console tiers
                      and human operators
VERCEL             auto-scales to 30,000 concurrent instances (E-6's page)
                   1,024 FILE DESCRIPTORS shared across concurrent executions,
                   including runtime usage                              E-6
STAGE 18           interactive p95 ≤ 250 ms · I-2 transaction ≤ 250 ms p95
```

**The formula, stated so the number can be recomputed when the plan is known:**

```
  pool.max  ×  peak concurrent function instances   ≤   Neon's connection ceiling
                                                        ── minus a reserve for
                                                           migrations, the console
                                                           tiers and operators

THEREFORE   pool.max is SMALL — single digits — because the multiplier is not.
            A serverless instance is not a long-lived server, and sizing its pool
            like one is how a connection ceiling is exhausted by success.
```

| Setting | Target | Reasoning |
|---|---|---|
| **`max`** | **small, single-digit** — computed from the formula once the plan is known | one instance serves few concurrent requests; the platform scales instances, not pools |
| **`connectionTimeoutMillis`** | **short** — a request that cannot get a connection **fails fast** | waiting until `maxDuration` converts pool pressure into a 30 s hang and a held function |
| **`idleTimeoutMillis`** | **short** | a frozen serverless instance must not hold a connection it will never use again |
| **`statement_timeout`** | **within Stage 18's budget, with headroom** | DEP-P6 — an unbounded query is an unbounded connection hold |
| **`idle_in_transaction_session_timeout`** | **set, and tighter than `statement_timeout`** | DEP-D023 |
| **`application_name`** | **set per environment and role** | so `pg_stat_activity` can answer "which environment is holding these connections" during an incident |

**DEP-D025 · The formula is the engineering deliverable; the capacity is a measurement**

```
DO NOT GUESS THE CONNECTION LIMIT, AND DO NOT READ IT OFF A PLAN NAME.
   ── a wrong number produces either exhaustion under load, or a pool too
      small to serve, and both present as intermittent unexplained failures

THE OWNER DECIDES THE PLAN.        DEPQ-1 = A · Neon Scale
ENGINEERING DECIDES pool.max.      From:
      ACTUAL PROVISIONED CONNECTION CAPACITY   ── SHOW max_connections;
    + Stage 18's budget
    + serverless concurrency
    + RESERVED migration / operator capacity

RECORDED AS:  PFL-005 — PROVISIONING VERIFICATION REQUIRED
```

**DEP-D026 · Neon's pooled endpoint is a preflight, and its transaction semantics are the thing under
test — not its existence**

```
NEON OFFERS A POOLED ENDPOINT.  That is not the question.

THE QUESTION IS WHETHER ITS TRANSACTION-POOLING SEMANTICS PRESERVE:

      BEGIN
      SET LOCAL <tenant context>
      the scoped query
      COMMIT

   ── all four, on ONE session, for the life of the transaction.
      A13-001 REQUIRES IT.  §12 depends on it.  RLS is enforced by it.

DO NOT ASSUME COMPATIBILITY BECAUSE THE ENDPOINT EXISTS.
   ── transaction-pooling modes commonly multiplex sessions between statements,
      and a SET LOCAL that does not survive to the query is a tenant context
      that silently is not there
   ── that failure does not error.  It returns the wrong rows, or none.

PFL-020 · PROVISIONING VERIFICATION REQUIRED
   prove it on the real endpoint: set a context, read, assert the scoping,
   then assert a SECOND connection does not see the first's context
```

**DEP-D027 · The file-descriptor ceiling is a real constraint, not trivia.** 1,024 descriptors are
shared across concurrent executions **and include the runtime's own usage** (E-6). Database
connections, HTTPS calls to providers and open files all draw on it. **A generous pool plus a provider
SDK's keep-alives is a way to exhaust it that presents as unrelated random failures.**

---
---

## 14. Migration runner and deployment gate

**Stage 21 owns HOW deployment gates migrations. Stage 22 owns WHAT sequence runs.**

**DEP-D028 · The release mechanism, and it fails closed at every arrow**

```
   BUILD ARTEFACT          the commit, the lockfile, the Node major        §47
        ↓
   PREFLIGHT               provider reachability · env validation · role
                           identity check — "am I DBROLE-1?"               §49
        ↓
   MIGRATION ELIGIBILITY   is there anything to apply?  is the recorded
                           applied-set consistent with the committed set?
        ↓
   ADVISORY LOCK           pg_advisory_lock — ONE runner, ever              DEP-D030
        ↓
   MIGRATION ROLE          DBROLE-1 assumed HERE and released after
        ↓
   TARGET MIGRATIONS       committed files only, in order, recorded
        ↓
   SCHEMA VERIFICATION     the catalogue matches the target declarations
                           ── Stage 20 MIG-T02, run against the real database
        ↓
   TRAFFIC ELIGIBILITY     only now may the new version become authoritative
        ↓
   POST-DEPLOY SMOKE       the production entry answers /api/health/ready    §25

ANY ARROW FAILS  ──►  THE NEW VERSION DOES NOT BECOME AUTHORITATIVE.
                      The previous version keeps serving.                DEP-P14
```

**DEP-D029 · One runner, committed migrations only, and `db:push` is not in the deployment path**

```
FORBIDDEN IN ANY ENVIRONMENT'S DEPLOYMENT PATH
   drizzle-kit push          ── DBD-043 · C-78 · Stage 20 TST-D015
   --force anything
   an ad-hoc psql session as part of a release
   a migration applied by hand and remembered later

REQUIRED
   ONE runner, invoked by the gate, applying COMMITTED files IN ORDER,
   recording the applied set IN THE DATABASE
```

**`db:push` remains available as a local development convenience** and is removed from CI and from every
deployment path. **Stage 15 MIG-01 already requires its removal from CI; Stage 21 extends that to the
release mechanism, which is where it would otherwise quietly survive.**

**DEP-D030 · Concurrency is prevented by the database, not by the pipeline's politeness**

```
TWO DEPLOYMENTS CAN OVERLAP.  A retried job, a rapid second merge, a manual
re-run — all produce two runners against one database.

MECHANISM   a PostgreSQL ADVISORY LOCK held for the duration of the run
            ── the second runner BLOCKS or EXITS; it never proceeds in parallel
            ── it is held in the database, so it works across runners, regions
               and CI providers, which a workflow-level concurrency group
               does not
```

**A `concurrency` group in a workflow file protects one workflow from itself. It does not protect the
database from a human with a re-run button.**

**DEP-D031 · Migration failure policy — forward repair by default, rollback only where designed**

| Situation | Action |
|---|---|
| a migration fails mid-run | **the transaction rolls back where the migration is transactional**; the applied-set is not advanced; **the deployment stops and the old version keeps serving** |
| a migration is not transactional | it is **declared** so (Stage 20 MIG-T10), and its failure procedure is written **before** it runs |
| the schema verification fails after a successful apply | **the deployment stops.** A schema that does not match the declarations is not a schema anyone should deploy against |
| a migration succeeded but is wrong | **forward repair** — a new migration. **Not a hand-edit, not a restore, unless §32's runbook is invoked** |

**DEP-D032 · The applied version is recorded in the database and reported by the application**, so
"which schema is production on" is answerable without a console — and so §37's release evidence can
name it.

---

## 15. CI/CD pipeline architecture

**Stage 20's logical gates, turned into a deployment design. No workflow YAML is written here.**

**DEP-D033 · Three gate sets, and they are not the same gates**

```
① PR GATES                                        every pull request
     dependency integrity     ── lockfile unchanged by install         §46
     static                   ── tsc · lint · the token-contrast check
     SMOKE BOOT               ── api/index.ts compiles and boots       DEP-P1
     unit
     database + integration   ── ACTIVE tests only, ephemeral DB
     API contract · security  ── TEN-T · SEC-T
     build
     component + axe          ── the automated accessibility floor
     ── NO production secret is available to any of these             §35

② PRE-RELEASE / STAGING GATES                     an eligible merged commit
     the FULL migration chain against an empty DB  ── MIG-T01 … MIG-T10
     migration-from-baseline rehearsal             ── MIG-T04, synthetic data
     browser E2E                                   ── E2E-T01 … E2E-T08
     PROVIDER SMOKE                                ── §49's preflights, staging
     accessibility automation
     performance where the release scope requires it

③ PRODUCTION RELEASE GATES                        promotion, not a push
     every ACTIVE automated test green
     provider preflights green                     §49
     migration verification                        DEP-D028
     MANUAL ACCESSIBILITY EVIDENCE                 owner decision 2A · §44
     independent penetration test                  Stage 16 · §45
     LEGAL / COMPLIANCE RELEASE APPROVAL           §50's REL-G018
     an approved rollback and recovery plan        §33
```

**DEP-D034 · A provider smoke test runs in STAGING, never in a PR.** It needs a real credential, and
**a fork's pull request must never be able to make the pipeline hand it one** (§35).

---

## 16. Test activation in CI

**Stage 20 defined four states. Stage 21 designs how CI represents them without giving anyone a place
to hide a red test.**

**DEP-D035 · Activation is a property of the suite's composition, not a switch on a failing test**

| State | How CI represents it | What is forbidden |
|---|---|---|
| **DEFINED** | **the test is not in the mandatory suite's selection** — it exists in the repository, tagged, and is listed by a register step that prints it | a skip annotation on a test that runs |
| **ACTIVE** | **selected, mandatory, must pass** | `continue-on-error` · `allow_failure` · any retry-to-green |
| **SUPERSEDED** | removed from selection **only with the replacement's identifier recorded in the same commit** | deleting a test and the suite going green |
| **BLOCKED-EXTERNAL** | **listed by the register step with its named blocker and release impact** | an unnamed blocker |

```
FORBIDDEN, AS CONFIGURATION
   ALLOW_FAILURE_TESTS=true          ── a global escape hatch
   a permanent per-test skip registry for a SECURITY defect
   an "expected failures" file
   continue-on-error on any job containing an ACTIVE test

THE REGISTER STEP IS THE CONTROL
   it PRINTS every DEFINED and BLOCKED-EXTERNAL requirement, with its blocker
   and its activating batch, on every run
   ── deferral stays visible instead of becoming ambient
```

**DEP-D036 · At final target cutover, the register step prints an empty DEFINED list, or the cutover is
not complete.** That is the machine-checkable form of Stage 20 TST-D092.

---

## 17. Secrets architecture — SECENV-001 … SECENV-018

**DEP-D037 · Every secret has an environment scope, a reader, a rotation path and a revocation path —
and none of them is in Git**

| # | Secret / config | Scope | Read by | Rotation | Restart? | Preview/staging shared? |
|---|---|---|---|---|---|---|
| **SECENV-001** | `SESSION_SECRET` | per environment | the runtime | **rotate with an overlap list** — a single-value rotation logs everyone out | no, with overlap | **NO** |
| **SECENV-002** | `DATABASE_URL` — **DBROLE-2** | per environment | the runtime | rotate role password, deploy, revoke old | yes | **NO** |
| **SECENV-003** | **migration credential — DBROLE-1** | **the migration gate ONLY** | **the gate, never a function** | operator-initiated | n/a | **NO — DEP-D016** |
| **SECENV-004** | `CONSOLE_RO_DATABASE_URL` — DBROLE-4 | prod + staging | the runtime, console read tier | as SECENV-002 | yes | **NO** |
| **SECENV-005** | `CONSOLE_RW_DATABASE_URL` — DBROLE-5 | prod + staging | the runtime, only during an elevation | as SECENV-002 | yes | **NO** |
| **SECENV-006** | `CRON_SECRET` | per environment | the runtime and the cron transport | rotate, deploy, update the trigger | yes | **NO** |
| **SECENV-007** | **AWS ROLE ARN — OIDC/STS, not a key** | per environment | the runtime | **no rotation: there is no stored secret.** The trust policy is reviewed, not rotated — DEP-D154/155 | no | **NO — the trust policy names the environment** |
| **SECENV-008** | SES configuration — identity, configuration set | per environment | the runtime | config, not a secret | yes | no |
| **SECENV-009** | S3 configuration — bucket names, prefixes | per environment | the runtime | config, not a secret | yes | no |
| **SECENV-010** | scanner configuration | per environment | infrastructure | config | n/a | no |
| **SECENV-011** | `SENTRY_DSN` (server + browser) | per environment | the runtime and the client build | rotate in Sentry | yes | **NO** |
| **SECENV-012** | Sentry auth token — source-map upload | **CI only** | **the build, on a trusted branch** | rotate in Sentry | n/a | **NO** |
| **SECENV-013** | compromised-password provider config, if any | per environment | the runtime | provider-neutral — A16-002 | yes | **NO** |
| **SECENV-014** | **canonical app origin** — `https://app.scholarshelf.co.uk` (prod) · `https://staging.scholarshelf.co.uk` (staging) | per environment | the runtime | config | yes | **NO — DEPQ-2 = A · DEP-D148** |
| **SECENV-015** | email sender identity | per environment | the runtime | config | yes | **NO** |
| **SECENV-016** | provider webhook secrets | per environment | the runtime | rotate with overlap where the provider supports it | yes | **NO** |
| **SECENV-017** | **per-school payment credential REFERENCES** | production | the runtime | **§17.1** | n/a | **NO** |
| **SECENV-018** | **DB TLS trust configuration — OPTIONAL custom CA** | per environment | the runtime | on CA rotation, **if a custom CA is used at all** | yes | no — a CA certificate is public |

**DEP-D038 · No secret is ever logged, and none appears in an error, a breadcrumb or an alert label.**
DEP-P16 · Stage 16 SEC-D063 · Stage 19 AUD-D005. **The value is never the thing that identifies it —
`SECENV-006` is how a runbook refers to the cron secret.**

### 17.1 Per-school payment credentials are not ordinary configuration

**INTQ-1 = A: each school owns its own payment account.** That means the system holds **many** sets of
school-owned credentials, not one.

```
NEVER   a school's payment credential in an environment variable
        ── environment variables are per-deployment, not per-tenant, and there
           are as many schools as there are schools

TARGET  a CREDENTIAL REFERENCE stored per school (DBT-040 `integrations`),
        resolving to material held by a managed secret mechanism
        ── AET-055 audits the ROTATION OF THE REFERENCE, never the secret
        ── the exact mechanism is a Stage 22 implementation choice; the
           REQUIREMENT that it is not ordinary config is settled here
```

**DEP-D039 · A secret store is chosen for the property that matters: it can be read by the runtime and
not by a developer with repository access.** Vercel's encrypted environment variables satisfy that for
per-environment secrets; **they do not satisfy SECENV-017, which is per-tenant and dynamic.** Naming
that distinction now stops one being solved with the other's mechanism.

---

## 18. Environment validation

**DEP-D040 · One boundary, and eleven variables come back inside it**

**DEP-F03's census is the work item.** `env.ts` becomes the only place `process.env` is read, and the
eleven currently outside are added with the right severity — **not merely listed.**

**DEP-D041 · Production refuses to boot on any of these**

```
FAILS TO BOOT IN PRODUCTION
   SESSION_SECRET missing, or weaker than the locked minimum
   CANONICAL ORIGIN missing                         DEP-F04 · §56's DEPQ-2
   TEST-SUPERUSER SWITCH ENABLED                    ── the kill switch must be
                                                       impossible in production
   CRON_SECRET missing while cron is enabled        DEP-F05
   DATABASE_URL missing or malformed
   a provider region that is not the target region
   sender identity missing while email is enabled
   TLS verification not enforced                    DEP-F06 · DEP-D042
   AN ORIGIN THAT IS NOT THIS ENVIRONMENT'S CANONICAL ORIGIN   DEP-D148
   any UNSAFE COMBINATION — memory storage in production, a development
   default in a production value, a staging origin with a production database
```

**DEP-D042 · TLS verification is the requirement. A custom CA bundle is NOT — a correction**

**The draft made "boot fails without `DATABASE_SSL_CA`" the target. That conflates the requirement
(verified TLS) with one possible implementation of it (a pinned custom CA), and it would force a secret
into every environment that may not need one.**

```
THE ACTUAL TARGET REQUIREMENT
   encryption                REQUIRED
   CERTIFICATE VALIDATION    REQUIRED
   HOSTNAME VALIDATION       REQUIRED where the selected client supports it
   rejectUnauthorized:false  FORBIDDEN in production
   warn-and-continue         FORBIDDEN — DEP-P7

WHAT IS NOT THE REQUIREMENT
   the PRESENCE of a custom CA bundle

   ── Neon supports strict certificate and hostname verification against
      TRUSTED PUBLIC CA ROOTS.  Where the system trust store is sufficient,
      DATABASE_SSL_CA IS SIMPLY ABSENT, and that is a passing configuration.
   ── a custom CA is required ONLY if the final Neon + node-postgres
      configuration genuinely needs one.

SECENV-018 IS THEREFORE:  TRUST CONFIGURATION / OPTIONAL CUSTOM CA
                          ── not a mandatory secret
```

**DEP-D157 · The exact client semantics are verified against a real staging connection, not reasoned
about**

```
node-postgres' TLS options and Neon's certificate presentation interact in
ways that are settled by CONNECTING, not by reading two documents.

STAGE 22 VERIFIES, on real staging:
   a connection with verification ENFORCED succeeds
   a connection with a deliberately wrong hostname FAILS
   whether a custom CA is needed at all

DO NOT GUESS.  DO NOT SHIP A CONFIGURATION NOBODY HAS CONNECTED WITH.
```

**The inversion is still a cutover step, not a switch.** Today's code warns rather than failing, and
its comment is honest about why — *"to avoid a surprise outage on a LIVE app."* **The target enforces;
the transition is sequenced in Stage 22 with the verification above performed first.** Stage 21 sets
the target and changes nothing today.

**DEP-D043 · No `process.env.X || insecureFallback` for any required production value.** A default that
works is a default that ships. **The development defaults that exist today are correct for development
and must be unreachable when `NODE_ENV=production`** — which the validated boundary can enforce and
scattered reads cannot.

**DEP-D044 · An optional subsystem may start disabled only where the locked architecture permits
degraded operation, and readiness must say so.** Email disabled is a legitimate development state and
**not** a legitimate production state; the console tiers being absent **is** legitimate (DEP-D017).
**Readiness (§25) reports the difference; it does not average it.**

---

## 19. AWS account and region architecture

**DEP-D045 · One region, `eu-west-2` (London), for every AWS resource this product uses**

Stage 17 selected S3 and SES in `eu-west-2`. E-11 confirms GuardDuty is available there. **Consistency
is itself a control: a resource in a second region is an unnoticed data path out of the target
jurisdiction.**

**DEP-D046 · Two AWS accounts — production and non-production. This is the engineering target, not a
recommendation**

```
AWS PRODUCTION ACCOUNT       production resources ONLY
AWS NON-PRODUCTION ACCOUNT   staging + provider rehearsal
CI                           NO AWS PROVIDER DEPENDENCY in ordinary CI
                             ── so no third account is created for it
```

**The reason is a single sentence, and it is the one that makes the boundary real:** *a staging
identity should not be capable of NAMING a production resource.* **Within one account, that is a policy
review that must stay correct forever; across accounts, the ARN is simply not addressable.**

| | Two accounts | One account, scoped IAM |
|---|---|---|
| a staging role naming a production bucket | **not possible** | **possible if a policy is wrong** |
| a policy mistake's blast radius | contained to its account | crosses environments |
| what enforces it | **the account boundary** | continuous policy review |

**No third CI account is created unless implementation evidence shows it is needed.** CI has no AWS
provider dependency (§15), so an account for it would be a boundary around nothing.

**No AWS account is created by this stage.**

**DEP-D154 · The Vercel runtime reaches AWS by OIDC, not by a stored key — SELECTED**

**The draft left "a role, or a long-lived access key" as alternatives. That is an engineering decision
this stage owns, and it is made here.**

```
SELECTED
   VERCEL OIDC  ──►  AWS STS AssumeRoleWithWebIdentity  ──►  SHORT-LIVED CREDENTIALS

   NO PERMANENT AWS ACCESS KEY IS REQUIRED IN THE PRODUCTION APPLICATION
   ENVIRONMENT.

WHAT THE ENVIRONMENT HOLDS INSTEAD
   the AWS ROLE ARN            ── an identifier, not a secret
   the AWS REGION              ── eu-west-2
   resource identifiers        ── bucket names, configuration set
   ── AND NO LONG-LIVED SECRET ACCESS KEY
```

**Why this is the selection and not merely the tidier option: a long-lived key has no expiry, so it has
no natural revocation event.** It leaks through a log line, an error report, a screenshot or a departing
laptop, and nothing about the system notices. **A short-lived STS credential expires whether or not
anyone realises it escaped.**

**DEP-D155 · The trust policy is the boundary, and it is scoped to three things**

```
THE OIDC TRUST POLICY MUST CONSTRAIN:

   the VERCEL TEAM        ── not "any Vercel customer"
   the PROJECT            ── not "any project in the team"
   the ENVIRONMENT        ── production · preview · staging are DIFFERENT subjects

SO THAT:
   PREVIEW  CANNOT assume the production role
   STAGING  CANNOT assume the production role
   ── enforced by the trust policy's subject condition, not by convention

A TRUST POLICY THAT NAMES ONLY THE TEAM IS A TRUST POLICY THAT TRUSTS EVERY
PREVIEW DEPLOYMENT OF EVERY BRANCH, INCLUDING A FORK'S.        §35 · DEP-D099
```

**DEP-D156 · The other three access paths, each with its own identity**

| Who | How |
|---|---|
| **the Vercel runtime** | **OIDC → STS**, per environment, per DEP-D155 |
| **a local operator or developer** | **their own human AWS identity**, MFA-required — §36. Never the runtime's role, never a shared key |
| **ordinary PR CI** | **NO AWS PROVIDER ACCESS AT ALL** — §15's PR gates need none, and a fork's PR must not be able to obtain one |
| **provider staging smoke** | **trusted staging workflow only**, assuming the staging role — never on `pull_request` from a fork |

**DEP-D047 · Target resource model**

```
S3            scholarshelf-prod-private        operational objects
              scholarshelf-prod-public         published CMS objects only
              scholarshelf-prod-quarantine     §43 · A19-001
              scholarshelf-staging-*           the same shapes, staging
              ── ALL Block Public Access ON except the deliberate public path §20

IAM           one role per environment per purpose:
                 runtime role       ── read/write its own private prefix,
                                       write the public prefix on publish
                 scanner role       ── as the scanner requires
                 operator role      ── human, MFA-required, §36
              NO LONG-LIVED USER KEYS AT ALL in the runtime      DEP-D154

SES           one verified sending domain per environment            §22
ENCRYPTION    SSE at rest on every bucket; TLS in transit everywhere
LOGGING       access logs where they earn their retention cost, and not
              otherwise — an access log naming object keys is a personal-data
              store with a retention question                      §24
```

---

## 20. S3 architecture

**DEP-D048 · Five object classes, and the class determines reachability**

| Class | Public? | Reachable how |
|---|---|---|
| **PRIVATE OPERATIONAL** | **never** | authorised gateway, or a **short-lived signed URL** after an authority check — Stage 16 SEC-D049 |
| **PENDING / UNSCANNED** | **never** | **viewable by NOBODY — OPSQ-1 = A**, including the uploader |
| **QUARANTINED (malware)** | **never** | operator only, under §32 |
| **PUBLIC PUBLISHED CMS** | **yes, deliberately** | the public path / CDN — **verified and published objects only** |
| **LEGACY SNAPSHOT QUARANTINE** | **never** | **§43 · A19-001** — legal/policy access only |

### 20.1 Block Public Access — a correction, because the draft asserted something AWS will not do

**The draft said account-level Block Public Access is ON *and* the public CMS bucket is a policy
exception to it. Those cannot both be true.**

```
AWS APPLIES THE MOST RESTRICTIVE APPLICABLE BLOCK PUBLIC ACCESS CONFIGURATION.

An account-level block on public POLICIES does not have a per-bucket override.
A bucket cannot "opt out" of it.
   ── so a document that claims both is describing a configuration that
      cannot exist, and the public site would simply not serve
```

**DEP-D049 · The four private classes block public access completely, at bucket level**

```
PRIVATE OPERATIONAL          ALL FOUR BPA CONTROLS ON
PENDING / UNSCANNED          ALL FOUR BPA CONTROLS ON
MALWARE QUARANTINE           ALL FOUR BPA CONTROLS ON
LEGACY SNAPSHOT QUARANTINE   ALL FOUR BPA CONTROLS ON

   BlockPublicAcls · IgnorePublicAcls · BlockPublicPolicy · RestrictPublicBuckets

PLUS   Object Ownership = BUCKET OWNER ENFORCED   ── ACLs disabled entirely
       no public ACL · no public bucket policy · no anonymous access
```

**DEP-D152 · The public CMS bucket is deliberately different, and its contents are the control**

**It is a separate bucket whose contents are INTENTIONALLY public. It does not "override" a block; the
account-level settings are configured so that the ACL-blocking controls stay on globally, and only the
policy-blocking controls necessary to permit this one bucket's anonymous-GET policy are relaxed.**

```
THE PUBLIC BUCKET MAY CONTAIN ONLY
   VERIFIED  +  PUBLISHED  +  PUBLIC-CMS copies

IT MUST NEVER CONTAIN
   a draft                       private operational objects
   pending or unscanned objects  quarantined objects
   legacy snapshots              child · family · finance · custody data

── the bucket's SAFETY IS ITS CONTENTS POLICY, not a permission subtlety.
   Publishing copies INTO it is an explicit act; nothing is public by
   default, and nothing private shares the bucket to be exposed by mistake.
```

**DEP-D153 · If every bucket must instead stay private behind another delivery mechanism, that is a
Stage 17 amendment — and it is not made here**

```
AN ALTERNATIVE DESIGN EXISTS: keep ALL buckets private and serve the public
site through a separate AWS delivery component.

THAT INTRODUCES ANOTHER PROVIDER / DELIVERY COMPONENT.
   ── Stage 17 selected the provider architecture.  Adding one is an
      AMENDMENT TO STAGE 17, raised traceably, not a detail settled in a
      deployment document.

STAGE 21 DOES NOT SILENTLY INTRODUCE CLOUDFRONT.

THE SIMPLEST V1 TARGET REMAINS:
   a separate, intentionally-public S3 bucket holding public-only published
   copies.
```

**DEP-D050 · An unguessable object key is DEFENCE IN DEPTH. It is not authorisation — a correction**

**The draft said an unpredictable key means "enumeration is not a read path even if a policy is
wrong." That sentence quietly promotes a mitigation into a control, and it is the reasoning behind
every leaked-bucket incident that was discovered by someone guessing less than expected.**

```
WHAT ACTUALLY PROTECTS A PRIVATE OBJECT
   the bucket policy                     IAM
   Block Public Access                   the application's authority check
   the signed-read mechanism             Stage 16 SEC-D049

WHAT AN UNGUESSABLE KEY IS
   DEFENCE IN DEPTH — it raises the cost of an attack that has already
   defeated one of the controls above

A POLICY ERROR IS A SECURITY FAILURE EVEN IF EVERY KEY WAS RANDOM.
   ── it is reported, remediated and reviewed as one
   ── "the keys were unguessable" is not a mitigating finding; it is an
      observation about how long it took someone to notice

NO BUCKET LISTING, in any class.  That is a control.

**DEP-D051 · A custom school domain is never a path to a private object.** The public site's domains
resolve to the published CMS path only (§28, §20). **A domain a school controls must not be able to
address the operational bucket, and the separation is by bucket, not by prefix.**

---

## 21. GuardDuty — the hard gate

**DEP-D052 · The evidence is materially stronger than Stage 17 had, and it is still not proof**

```
STAGE 17 HAD          feature-level availability in eu-west-2 UNOBTAINABLE across
                      three documentation routes  ──►  PRV-005 SELECT-CONDITIONAL

STAGE 21 ESTABLISHES
   E-11  GuardDuty IS available in eu-west-2      ── official endpoint table
   E-12  "GuardDuty Malware Protection for Amazon S3 is available in ALL AWS
          Regions where GuardDuty is available, excluding China Regions and
          GovCloud (US) Regions."                 ── official AWS announcement

   eu-west-2 is neither China nor GovCloud, and GuardDuty is available there.
```

**Why this is not yet "PROVEN", stated plainly:**

```
E-12 is a LAUNCH-ERA BLANKET STATEMENT (June 2024), not a maintained
per-region feature table.
   ── AWS ships features under the same umbrella with DIFFERENT availability:
      Malware Protection for S3 reached GovCloud separately, and Malware
      Protection for AWS Backup is a distinct feature with its own dates.
   ── a blanket statement written at launch is evidence about launch.

THEREFORE:  PRV-005 moves from
   SELECT-CONDITIONAL  ──►  SELECT · PROVISIONING VERIFICATION REQUIRED
```

**DEP-D053 · The gate becomes a test rather than a search, and it is a hard one**

```
PFL-009 · GUARDDUTY MALWARE PROTECTION FOR S3, eu-west-2

   IN STAGING, BEFORE ANY PRODUCTION OBJECT MIGRATION:
      1  enable Malware Protection for S3 on the staging private bucket
      2  upload a benign object          ── expect a clean scan result
      3  upload the EICAR test file      ── expect a malware verdict
      4  assert the PENDING state is unreadable by every reader class
                                            ── OPSQ-1 = A
      5  assert the verdict reaches the application's object state

   IF ANY STEP CANNOT BE PERFORMED IN eu-west-2:
      ── the finding is recorded, PRV-005 returns to SELECT-CONDITIONAL,
         and STAGE 22'S OBJECT MIGRATION IS BLOCKED
```

**DEP-D054 · No production upload migration may depend on unverified scanning.** Stage 22 moves
`media_assets.dataUri` bytes to object storage at MIG-11. **If the scanner is unproven, those bytes
either stay where they are or land in a bucket where nothing is readable until scanning works.** **They
do not land in a bucket that serves unscanned objects because the scanner "should" be available.**

---

## 22. SES architecture

**DEP-D055 · The sandbox is the gate everyone forgets, and it is per-region**

```
E-10, VERBATIM IN EFFECT
   the SES sandbox is UNIQUE PER REGION
   production access must be requested SEPARATELY for each region

IN THE SANDBOX
   verified recipients only        200 messages / 24 hours
   1 message / second              suppression-list management DISABLED

FOR A SCHOOL WITH 400 FAMILIES, 200 MESSAGES PER DAY IS NOT A RATE LIMIT.
IT IS A BROKEN PRODUCT.
```

**DEP-D056 · SES production access in `eu-west-2` is a named preflight with a lead time**, not a
deployment step. AWS support typically responds within 24 hours and may ask for more information —
**which means it is requested early, and its grant is release evidence (§49, PFL-006).**

**DEP-D057 · Target SES configuration, preserving INTQ-2 = C**

```
DISPLAY IDENTITY     "<School Name> via ScholarShelf"     ── the parent sees the school
SENDING DOMAIN       SCHOLARSHELF-CONTROLLED               ── not the school's
NO PER-SCHOOL DNS FOR V1                                   ── locked, unchanged

VERIFIED IDENTITY    a ScholarShelf sending domain, verified per environment
SPF                  published for the sending domain
DKIM                 Easy DKIM, all CNAMEs published, verified
DMARC                a policy target, with a monitoring phase BEFORE enforcement
                     ── a p=reject published before alignment is confirmed
                        silently destroys deliverability
REPLY-TO             VALIDATED — a school-supplied reply address is an input,
                     and an unvalidated one is an open relay for the school's
                     reputation and ours
CONFIGURATION SET    per environment, with an event destination
EVENTS               bounce · complaint · delivery · reject — to an authenticated
                     endpoint whose authenticity is VERIFIED, Stage 17
BOUNCE ≠ UNVERIFIED  Stage 17's locked distinction: a bounce suppresses an
                     ADDRESS; it does not mark an IDENTITY unverified
QUOTA MONITORING     sending quota, send rate, bounce rate and complaint rate
                     ── a complaint rate crossing AWS's threshold is an account
                        risk, not a metric
STAGING              its own subdomain and its own identity, so a staging email
                     can never look like a production one
```

**DEP-D058 · Do not configure SES here. Do not remove Resend here.** A11-001 records Resend as
CURRENT/LEGACY, to be replaced before production. §23 designs the boundary; **Stage 22 performs the
cutover.**

---

## 23. Resend → SES cutover requirements

**DEP-D059 · At no point does email sending stop, and at no point is one notification delivered twice**

```
FORBIDDEN   dual-send from both providers "to be safe"
            ── ONE notification, ONE intended delivery effect.  A parent
               receiving two identical invitations is a support incident and
               a trust problem, not a redundancy strategy.

REQUIRED    ONE ACTIVE SENDER AT A TIME, selected by server-controlled
            configuration, with a rollback route that does not require a deploy
```

**DEP-D060 · Stage 22's cutover inputs, all seven, each verifiable before the switch**

```
1  SES STAGING VERIFICATION    identity verified · DKIM aligned · a real send
                               received in staging
2  TEMPLATE PARITY             every template renders identically through both
                               paths — compared as output, not as source
3  DELIVERY EVENT PARITY       SES events populate DBT-054 delivery_attempts
                               exactly as the Resend path does
4  BOUNCE / COMPLAINT PARITY   a bounce reaches DBT-078 email_suppressions
                               (A15-002) and DOES NOT mark an identity unverified
5  SENDER IDENTITY PARITY      "<School> via ScholarShelf" renders correctly in
                               the major clients — INTQ-2 = C
6  ENVIRONMENT SECRETS         SECENV-007/008/015 present in each environment
                               before the switch, not during it
7  ROLLBACK ROUTE              flip back without a deploy, and without losing
                               the notification FACTS already recorded
```

**DEP-D061 · The notification fact and the delivery are already separate, and that is what makes this
cutover safe.** DBT-053 records that a notification is owed — inside I-2's transaction; DBT-054 records
delivery attempts. **Changing provider changes DBT-054's producer and nothing about I-2.** Stage 18
made that separation load-bearing, and **it is why a provider cutover is not a business-truth event.**

---

## 24. Sentry

**DEP-D062 · The EU region is an irreversible pre-provision gate, and it is stated before anyone opens
the signup page**

```
E-13, VERBATIM:  "once selected, your data storage location can't be changed.
                  The only way to switch it is by creating a new organization."

THEREFORE   THE REGION IS CHOSEN BEFORE THE ORGANISATION EXISTS.
            EU — Frankfurt.
            ── getting this wrong is not a settings change; it is a new
               organisation, new DSNs, new project history, and a period during
               which UK pupils' error data sat in Iowa
```

**DEP-D063 · Target Sentry architecture**

```
ORG          ONE, in the EU region                                 DEP-D062
PROJECTS     scholarshelf-server · scholarshelf-browser
ENVIRONMENTS production · staging      ── never mixed in one stream
RELEASES     the commit SHA — the same identifier §37 records
SOURCE MAPS  uploaded at build time by SECENV-012, on a TRUSTED branch only
             ── and NOT served publicly

SCRUBBING    server-side scrubbing ON, plus a before-send filter in our code
             ── two layers, because the vendor's default list does not know
                what a linking code is
SAMPLING     errors: all.  traces: a low rate, raised deliberately.
RETENTION    the plan's, recorded — §24
ACCESS       §36, and not "everyone with the link"
ALERTS       to a destination carrying NO personal data in the label
```

**DEP-D064 · The before-send filter is ours, and the prohibited list is Stage 16's and Stage 19's,
unchanged**

```
NEVER TO SENTRY
   password · hash · MFA secret · TOTP · recovery code
   session id or cookie · reset token · invite token · signed URL
   provider credential · raw webhook payload · whole request body
   A CHILD'S RECORD · A PAYMENT REFERENCE · A MESSAGE BODY
   SPREADSHEET / IMPORT ROW CONTENT
                                     BR-124 · C-18 · SEC-D063 · AUD-D005
```

**Import row content is named explicitly because it is the densest personal-data concentration in the
system (SECARR-039's reasoning) and because an import parser is exactly the code most likely to throw
with the row in scope.**

**DEP-D065 · Sentry is never load-bearing.** Stage 19 AUD-D019 and AUD-D021: **no external call inside a
Class A transaction, and a Sentry outage never rolls back a settlement.** Deployment must not introduce
a startup dependency on it either — **an application that will not boot without its error reporter has
made its error reporter a single point of failure.**

---

## 25. Health and readiness

**DEP-D066 · Two probes, because "alive" and "safe to serve" are different questions — DEP-F08**

```
GET /api/health/live      the process is running and can answer
                          ── NO database call.  A liveness probe that touches
                             the database restarts a healthy instance during a
                             database blip, which is the opposite of the point.

GET /api/health/ready     this instance may receive AUTHORITATIVE traffic
                          ── database reachable on a TRANSACTION-CAPABLE
                             connection (DEP-D021's path, not the HTTP driver)
                          ── the applied migration version matches expectation
                          ── required configuration present and valid
                          ── required subsystems available, per DEP-D044

AUTHORISED DIAGNOSTICS    a detailed dependency view, behind authority,
                          NEVER on the public probe
```

**DEP-D067 · A public probe reveals nothing.** No database URL, no region, no provider name, no
dependency error text, no version detail beyond what is already public. **`{"status":"ok"}` and a status
code.** An unauthenticated readiness probe that names its failing dependency is a reconnaissance
endpoint.

**DEP-D068 · `/api/health` is preserved during cutover.** `smoke-boot.ts` requests it, and CI's
`wait-on` polls it. **Breaking it to introduce the split would break the one test that has been
protecting production** — it stays until §42's coexistence rules retire it deliberately.

---

## 26. Monitoring and alerting

**DEP-D069 · Stage 18 owns the thresholds; Stage 21 configures where they fire and who answers**

| | Staging | Production |
|---|---|---|
| **availability check** | the readiness probe, low frequency | **the readiness probe, from outside the platform** |
| **error rate** | visible, not paging | **Stage 18's thresholds** |
| **latency** | visible | **Stage 18's p95 budgets** |
| **cron liveness** | visible | **"the daily run did not happen" is an ALERT** — DEP-F05 |
| **migration state** | visible | applied version ≠ expected → alert |
| **provider health** | visible | SES bounce/complaint rate · scanner backlog · S3 errors |
| **destination** | a team channel | **an on-call path with an owner** |

**DEP-D070 · The alert that matters most is the one for silence.** DEP-F05's failure mode — cron 401s
forever and nothing happens — **is invisible to every error-rate alert ever configured**, because
nothing errors. **A job that has not run by its expected time is the alert.**

**DEP-D071 · No personal data in any alert label, title or grouping key.** Not a child's name, not a
school's name where the label leaves the system, not an email address. **An alert reaching a phone is a
personal-data disclosure to whoever picks up that phone.**

---
---

## 27. Cron and durable jobs — C-106

**DEP-D072 · The locked scheduler endpoint is unreachable by the locked scheduler transport, and that
is a conflict rather than a preference**

```
STAGE 14, LOCKED     API-278  POST /api/internal/jobs/run   CAP-093 · SC-10
                     current route recorded as: GET|POST /api/cron/run
                                                REPLACE — trigger only, Stage 22

VERCEL, VERIFIED     "To trigger a cron job, Vercel makes an HTTP GET request
                     to your project's production deployment URL"          E-1

VERCEL CANNOT ISSUE A POST.   ──►   C-106
```

**Neither stage is wrong on its own. Together they do not compose**, and nothing in the locked set says
how a GET transport reaches a POST endpoint. **Stage 21 does not silently change API-278.**

**DEP-D073 · The smallest safe adapter: a trigger that carries no business meaning**

```
   Vercel Cron  ──GET──►  the PLATFORM TRIGGER ROUTE
                          ── authenticates the caller
                          ── carries NO business logic, NO parameters that
                             change what runs, NO tenant selection
                          ── invokes the SAME internal runner as API-278
                                    │
                                    ▼
                          API-278's HANDLER — unchanged contract, unchanged
                          capability (CAP-093), unchanged scope (SC-10)
                                    │
                                    ▼
                          DBT-069 jobs · claim · SKIP LOCKED · fairness · Stage 18
```

**Authentication of the trigger, layered:**

```
1  CRON_SECRET            timing-safe comparison — the current code already does
                          this correctly, and it becomes SECENV-006, validated
2  x-vercel-cron-schedule  present, and matching an expected schedule      E-1
3  user-agent vercel-cron/1.0                                              E-1

── 2 and 3 are CORROBORATION, NEVER AUTHORISATION.  A header is caller-supplied
   and trivially forged.  The secret is the control; the headers narrow the
   surface.

NO browser cookie          ── this is not a browser surface
NO CSRF contract           ── there is no browser session to protect
NO public business data    ── counts and an invocation id, nothing else
FAILS CLOSED               ── a missing or wrong secret is 401, AND the
                              secret's ABSENCE fails environment validation
                              rather than silently 401-ing forever   DEP-F05
```

**DEP-D074 · A14-001 is RECORDED, and the adapter is API-283**

```
A14-001 · RECORDED in API_CONTRACT.md, 1 September 2026
   Verified before assigning: Stage 14 had no amendment register and no prior
   amendment — A14-001 is the first.  The register reached API-282 —
   API-283 was the next free identifier.

   API-283   GET /api/internal/jobs/trigger
             CAP-093 · SC-10 · MOD-014
             TRANSPORT ADAPTER ONLY
             rate/budget class: EXPLICIT and BOUNDED — one scheduled caller,
                                a small ceiling per window, NOT the
                                interactive class

   API-278'S CONTRACT IS UNCHANGED — method, path, capability, scope, shape.
   The adapter CALLS the same application service.  It does not replace
   API-278, weaken it, or add a GET method to it.
```

**DEP-D158 · The target path is a new internal route, not the one that exists today**

```
DO NOT KEEP  /api/cron/run  as the permanent target merely because it exists.

   ── it sits outside /api/internal/*, which Stage 14 assigns to MOD-014 and
      SC-10, so keeping it would leave the scheduler surface split across two
      namespaces with two different scope stories
   ── it currently accepts GET OR POST and does BOTH jobs — transport and
      runner.  A14-001 separates them.

TARGET     API-283  GET /api/internal/jobs/trigger    ── the transport
           API-278  POST /api/internal/jobs/run       ── the runner
CURRENT    GET|POST /api/cron/run                     ── REPLACED BY THE PAIR
                                                         Stage 22 sequences it
```

**DEP-D159 · The adapter's contents are exhaustive, and "no loopback" is the one people get wrong**

```
1  AUTHENTICATE      CRON_SECRET, Stage 16's TIMING-SAFE comparison
2  CORROBORATE       x-vercel-cron-schedule · user-agent vercel-cron/1.0
3  CORRELATE         create / propagate a correlation id
4  INVOKE            THE SAME APPLICATION JOB-RUNNER SERVICE AS API-278
5  RETURN            bounded execution information — counts and an
                     invocation id.  NO PUBLIC BUSINESS DATA.

NO BUSINESS RULE.  NO TENANT SELECTION.  NO PARAMETER THAT CHANGES WHAT RUNS.

AND NO LOOPBACK HTTP POST TO ITSELF.
   ── an adapter that re-enters the application over HTTP adds a network hop,
      a SECOND authentication surface and a new failure mode, to reach a
      function it can call directly.  It also makes the runner externally
      reachable in a way the contract does not intend.
```

**DEP-D075 · The rest of the cron deployment**

| | Target |
|---|---|
| **transport** | Vercel Cron, **GET**, to the trigger route |
| **schedule** | **UTC always** (E-2); no `MON`/`JAN` forms; day-of-month and day-of-week mutually exclusive |
| **environment restriction** | **production and staging only.** A preview deployment must never run scheduled work — §35 |
| **continuation** | the drain is budgeted (`DRAIN_BUDGET_MS`) and **resumable**; where one daily tick cannot drain everything, **a more frequent trigger with an idempotent claim is the mechanism** — Stage 18's fairness and `SKIP LOCKED` already make that safe |
| **concurrency** | the job claim, not the schedule — **two overlapping triggers must be harmless**, and Stage 18's lease design makes them so |
| **`maxDuration`** | the job-runner ceiling of DEP-D007, exceeding the drain budget |
| **monitoring** | **"the run did not happen" is an alert** — DEP-D070 |

**DEP-D076 · Once-daily was already shown to be insufficient, and the fix is transport frequency, not
application redesign.** `cron.routes.ts`'s own comment records that the old behaviour assumed successive
ticks a once-a-day schedule never produced, so *"from school #2 onward nobody got a digest or an unpaid
reminder, ever, and the response still said 200 OK."* **The drain fixed the application half. The
schedule is the deployment half, and it belongs here.**

---

## 28. Domains, DNS and TLS

**DEP-D077 · Five domain classes, and the boundary between class 1 and classes 3–4 is a security
boundary**

| Class | Owner | TLS | Notes |
|---|---|---|---|
| **1 · ScholarShelf app** | **ScholarShelf** | platform-managed | **the ONLY origin that receives an authenticated cookie** — §29 |
| **2 · hosted school path** | ScholarShelf | platform-managed | a path under a ScholarShelf domain |
| **3 · ScholarShelf school subdomain** | ScholarShelf | platform-managed, wildcard | `<school>.<scholarshelf-domain>` |
| **4 · custom school domain** | **the school** | platform-managed after verification | **school-owned; ScholarShelf is not a registrar** |
| **5 · email sending domain** | **ScholarShelf** | n/a | SPF/DKIM/DMARC — §22. **No school DNS for V1**, INTQ-2 = C |

**DEP-D078 · Domain verification precedes activation, and failure is visible**

```
A CUSTOM DOMAIN IS ACTIVE ONLY AFTER
   the school has published the required DNS record
   verification has succeeded
   TLS has been issued

BEFORE THAT   the domain resolves to NOTHING WE SERVE.
              ── it does not fall back to a default tenant, and it does not
                 serve another school's site.  An unrecognised host is not a
                 routing puzzle to be solved generously.

RENEWAL       automated; FAILURE IS AN ALERT, because a school's public site
              going untrusted is their incident and reaches us as theirs
```

**DEP-D079 · ScholarShelf does not become a registrar.** Schools own their domains and their DNS.
**Our obligation is a clear record to publish, honest verification, and an unambiguous failure state.**

---

## 29. Cookies and origins

**DEP-D080 · The authenticated cookie is scoped to class 1 and cannot reach a school-controlled
domain**

```
TARGET COOKIE
   name        __Host-  prefix
   Secure      required by the prefix
   Path=/      required by the prefix
   NO Domain   REQUIRED BY THE PREFIX — and this is the whole point:
               a __Host- cookie CANNOT be scoped to a parent domain, so it
               cannot be sent to a subdomain or to any other host
   HttpOnly    already true
   SameSite    Stage 16 owns the value; already "strict"

THE THREAT THIS CLOSES
   a school controls its own custom domain (class 4).  If the authenticated
   cookie were scoped to a shared parent, or issued without the __Host-
   constraint, a school-controlled host could receive it.
   ── the public site and the authenticated app are STRUCTURALLY SEPARATE
      ORIGINS, and the cookie's own attributes are what enforce it
```

**DEP-D081 · Public school-website hosts and the authenticated app are different origins by design.**
The public site is unauthenticated (CAP-081). **It needs no session, so it must not be able to receive
one.**

**DEP-D082 · `trust proxy` stays, and it does not make `Host` authoritative.** It is required so
`secure` cookies are issued behind Vercel's edge. **It is not permission to derive the canonical origin
from a request header** — §56's DEPQ-2.

---

## 30. Backups

**DEP-D083 · What is backed up, by what capability, recoverable by whom — and "Neon backs it up" is not
an answer**

| What | Mechanism | Verified by |
|---|---|---|
| **the database** | **Neon's own capability, recorded per plan** — point-in-time recovery where the plan provides it | **§31's rehearsal** |
| **object storage** | **versioning on private and quarantine buckets**, so an overwrite or delete is recoverable | a restore of one object |
| **the legacy snapshot quarantine** | **backed up, and its backup inherits the quarantine's access restrictions** — §43 | §31 |
| **configuration** | **in Git** where it can be (`vercel.json`, migrations, the provisioning runbook); **exported and stored** where it cannot (§48) | a rebuild-from-scratch rehearsal |
| **secrets** | **in the secret store, with a documented recovery path** — DEP-P8 means there is no Git copy to fall back on | a recovery drill |
| **the audit trail** | **it is in the database** — no separate mechanism, and Stage 19's immutability means a restore is the only recovery | §31 |

**DEP-D084 · The plan's actual backup capability is recorded, not assumed.**

```
DO NOT WRITE          "Neon backs it up."
RECORD INSTEAD        WHAT the plan provides · the retention window it provides
                      · WHO can initiate a restore · WHERE a restore lands
                      · HOW LONG a restore takes

CLASSIFICATION        PLAN INPUT REQUIRED — §56, the same input as DEP-D025
```

**DEP-D085 · RPO and RTO are engineering targets, and no legally required retention is invented.**

```
RPO / RTO             engineering targets, set against Stage 18's service
                      objectives once the plan's capability is known
LEGAL RETENTION       NOT INVENTED HERE.  A16-002.2 and Stage 19 AUD-P22
                      already assign retention to approved policy, and a
                      BACKUP retention period is a retention period.
```

---

## 31. Restore testing

**DEP-D086 · A backup that has not been restored is not a backup — DEP-P11**

```
PERIODIC RESTORE REHEARSAL, into an ISOLATED NON-PRODUCTION ENVIRONMENT

VERIFY   the database opens
         the applied migration version is what was expected
         ROW RECONCILIATION on the tables that carry business truth
         RLS IS STILL ENFORCED in the restored copy      ── DEP-D015's FORCE
         AUTHENTICATION IS SAFE — the restored copy cannot be signed into
           with production credentials by anyone who happens to have them
         object references resolve, or their absence is understood
         CRITICAL BUSINESS FACTS reconcile: money sums, custody chains,
           allocation counts                              ── MIG-12's checks
```

**DEP-D087 · The restore target is isolated, and it is never ordinary developer CI**

```
NEVER   a production restore into CI
NEVER   a production restore onto a laptop
NEVER   a production restore into staging's ordinary environment,
        where the team has ordinary access

WHERE REAL BACKUP DATA IS GENUINELY REQUIRED (a real restore rehearsal is)
   ── a RESTRICTED OPERATIONAL ENVIRONMENT: named operators only, access
      logged, network-isolated, destroyed after the rehearsal
   ── LEGAL / PRIVACY HANDLING APPROVED BEFORE THE FIRST REHEARSAL
   ── this is real children's data, and a rehearsal is a processing activity
```

**DEP-D088 · Most rehearsals need no production data at all.** Restoring a **synthetic** backup of
production *shape* proves the mechanism, the runbook and the reconciliation queries. **Only the
periodic proof that the production backup itself is restorable needs the real thing** — and that one is
rare, controlled and approved.

---

## 32. Incident and disaster recovery

**DEP-D089 · Twelve runbooks, each with the same six fields — Stage 21 defines the mechanism and
performs no incident response**

| Incident | Containment | Traffic | Credentials | Repair | Integrity check | Comms |
|---|---|---|---|---|---|---|
| **bad application deployment** | stop promotion | **roll back to the previous known-good deployment** | none | forward fix | none needed if the schema is unchanged | internal |
| **bad migration** | **stop the gate** | old version keeps serving — DEP-P14 | none | **forward repair**; restore only under this runbook | **MIG-12's parity checks** | internal, then owner |
| **database unavailable** | none possible | readiness fails; instances stop taking traffic | none | provider | on recovery | owner |
| **database corruption suspected** | **freeze writes** | **read-only or offline — do not keep writing into suspect state** | none | **restore to a point in time, into an isolated target first** | **full reconciliation before cutover** | **owner + legal** |
| **S3 outage** | none | uploads fail cleanly; **no unscanned object is served** | none | provider | object inventory | internal |
| **SES outage** | none | **notification FACTS still commit** — I-2 unaffected; delivery retries | none | provider | delivery-attempt reconciliation | internal |
| **scanner outage** | **pending objects stay unreadable** — OPSQ-1 = A | uploads may continue if pending is safe | none | provider | scan backlog drain | internal |
| **Sentry outage** | none — **never load-bearing** | unaffected | none | provider | none | internal |
| **secret compromise** | **revoke first, investigate second** | may require a restart | **rotate SECENV-nnn per §17** | redeploy | audit review — what was reachable | **owner + legal** |
| **AWS credential compromise** | **revoke the key or role session** | may affect uploads and email | rotate | redeploy | **object access log review** | **owner + legal** |
| **Vercel account compromise** | **revoke sessions and tokens; MFA everywhere** | **deployments frozen** | **rotate every deployment secret** — they were all readable | redeploy from a verified commit | **verify the running deployment matches a known commit** | **owner + legal** |
| **Neon credential compromise** | **rotate role passwords** | brief interruption | **all six roles** | redeploy | **audit trail review for unattributed access** | **owner + legal** |

**DEP-D090 · Rotate before you investigate.** In every compromise row the first action is revocation.
**An investigation conducted while the credential is still valid is an investigation conducted during
an ongoing incident.**

**DEP-D091 · Every incident touching personal data has a legal and communications owner who is not the
engineer fixing it.** Breach assessment is a legal determination — **Stage 21 provides the technical
evidence and does not make it.**

---

## 33. Deployment rollback

**DEP-D092 · Three different rollbacks, and conflating them is how data is lost — DEP-P13**

```
APPLICATION ROLLBACK      restore the previous known-good deployment.
                          FAST, SAFE, ROUTINE — while the schema is compatible.

DATABASE ROLLBACK         MAY BE IMPOSSIBLE.  A migration that transformed or
                          dropped data has no "undo".
                          ── Stage 20 MIG-T10: either a tested down-path exists,
                             or the migration is DECLARED irreversible

PROVIDER CONFIG ROLLBACK  restore a previous provider configuration.
                          ── some are irreversible: Sentry's region (E-13),
                             Neon's region (E-9).  Those are not rollbacks;
                             they are new resources.
```

**DEP-D093 · "Just roll back the deployment" is a lie once the schema has advanced incompatibly, and
the mechanism must make that impossible to say by accident**

```
THE APPLICATION RECORDS THE SCHEMA VERSION IT REQUIRES.        DEP-D032

ON ROLLBACK   the gate compares the candidate's required version against the
              database's applied version
              ── COMPATIBLE      ── roll back freely
              ── INCOMPATIBLE    ── REFUSE, and say so.  The operator needs a
                                    forward repair or §32's corruption runbook,
                                    not a rollback that will fail at the first
                                    query against a column that no longer exists
```

**DEP-D094 · The deployment infrastructure supports expand → migrate → contract, and Stage 22 designs
the sequence**

```
WINDOW A   OLD APP  +  NEW SCHEMA     ── additive migrations only.  Every
                                         MIG-02 … MIG-11 step is additive by
                                         Stage 15's design, which is what makes
                                         this window exist at all.
WINDOW B   NEW APP  +  OLD SCHEMA     ── the reverse window, needed to roll the
                                         application back safely

WHAT STAGE 21 PROVIDES   the version check, the gate ordering, the ability to
                         deploy the application and the schema INDEPENDENTLY
WHAT STAGE 22 DESIGNS    which step goes in which window, and the contract step
```

**Stage 15's "every step is additive until MIG-13, and MIG-14 is the only irreversible one" is exactly
what makes this affordable.** The compatibility window is wide for thirteen steps and closes once.

---

## 34. Cutover flags

**DEP-D095 · A small, named, expiring set — and no feature-flag platform is built**

**Evaluated against what Stage 22 actually needs:**

| Flag | Needed? | Why |
|---|---|---|
| **new auth / authority path** | **YES** | the Stage 7 capability model cannot land atomically across every route; a server-controlled switch is what makes the batch reversible |
| **new schema read path** | **YES** | MIG-13 *"switch the application to the new tables"* is a switch. Stage 15 already describes it as one |
| **SES cutover** | **YES** | DEP-D059 requires exactly one active sender, switchable without a deploy |
| **object-storage cutover** | **YES** | MIG-11 moves bytes; reads must switch after the copy is verified, not during it |
| **target API activation** | **NO** | routing is a deployment concern, and §26.1's legacy cutover register (Stage 20) already governs which routes exist |

**Four flags. Not five, and not a platform.**

**DEP-D096 · The rules that keep them temporary**

```
TEMPORARY            each has a REMOVAL BATCH recorded when it is created
SERVER-CONTROLLED    configuration, not a request parameter
ENVIRONMENT VALIDATED an unknown value FAILS TO BOOT — DEP-D041, not a
                     silent default
AUDITABLE            where flipping one is consequential, it is an audit event
                     ── Stage 19's taxonomy, not a log line
NEVER SECURITY AUTHORITY   a flag never decides whether a person MAY do
                     something.  Capabilities do that.  A flag decides which
                     IMPLEMENTATION runs.
NEVER USER-CONTROLLABLE    not a query parameter, not a header, not a cookie
```

**DEP-D097 · A flag with no removal batch is a permanent branch in production**, and two of them make
four code paths nobody tests. **The removal batch is part of creating the flag, not a follow-up.**

---

## 35. Preview environment security

**DEP-D098 · A preview gets nothing that matters — DEP-P9**

```
PREVIEW MAY NOT HAVE
   the production database          the staging database
   any production provider credential
   the production Sentry DSN        the production canonical origin
   SES production sending           the production S3 buckets
   CRON — a preview must never run scheduled work

PREVIEW MAY HAVE
   a disposable database, or none
   provider integrations DISABLED, failing cleanly rather than sending
   a preview-scoped Sentry environment, or none
```

**DEP-D099 · A fork's pull request receives no secret at all, and this is a platform setting, not a
convention**

```
AN UNTRUSTED PR CAN RUN ARBITRARY CODE IN THE PIPELINE.
   ── if that pipeline holds a secret, the PR holds the secret.
   ── this is not a hypothetical; it is the standard supply-chain attack
      against CI.

THEREFORE
   secret-requiring jobs — provider smoke, source-map upload (SECENV-012),
   staging deployment — run ONLY on a trusted branch or after an explicit
   maintainer approval.
   ── never automatically on `pull_request` from a fork
```

**DEP-D100 · Previews are not publicly reachable.** Deployment protection is on, so a preview of an
unreleased feature against synthetic data is not indexable, linkable or discoverable. **It is a
build artefact, not a website.**

---

## 36. Production access model

**DEP-D101 · Four roles, least privilege, MFA, and no shared super-account**

| Role | Vercel | Neon | AWS | Sentry | GitHub |
|---|---|---|---|---|---|
| **ordinary developer** | read; preview deployments | **no production access** | **none** | read on non-production | write to branches; **no deployment secrets** |
| **deployment operator** | **promote to production** | **connect for operations; not a standing write session** | operator role, **MFA** | admin on projects | **manage deployment secrets** |
| **production incident operator** | **rollback, freeze** | **restore initiation** — DBROLE-6 | **incident scope, MFA** | admin | as needed during an incident |
| **owner / legal / admin** | **billing, org membership** | project ownership | **account root, MFA, rarely used** | org owner | org owner |

**DEP-D102 · Roles, never shared passwords. MFA on every provider administration surface that offers
it.** A shared account cannot be offboarded, cannot be attributed in an incident, and cannot be
revoked without disrupting everyone.

**DEP-D103 · Offboarding, recovery and review are designed now because they are painful later**

```
OFFBOARDING     a checklist per provider, executed the SAME DAY
                ── and every secret that person could read is treated as
                   compromised if they held broad access
RECOVERY        break-glass account access — who, how, recorded
                ── an org whose only owner is unreachable is one bus away from
                   being unable to rotate a leaked key
ACCESS REVIEW   periodic, recorded, with removals actually performed
```

**DEP-D104 · No account is created by this stage.** §36 is a model.

---
---

## 37. Deployment evidence

**DEP-D105 · Every production release produces a record, and the record names its commit — DEP-P17**

| Field | |
|---|---|
| **commit SHA** | the single identifier everything else hangs from |
| **build identifier** | the deployment's own id |
| **Node major** | asserted, not assumed — §8 |
| **lockfile hash** | §47 |
| **migration version applied** | before and after — DEP-D032 |
| **provider preflight results** | §49's PFL register |
| **test evidence bundle** | which ACTIVE suites, which results |
| **manual accessibility evidence reference** | §44 — a reference, not a copy |
| **security review / pen-test reference** | §45 |
| **deployment actor** | a person or an automation identity, never "the team" |
| **deployment time** | |
| **rollback target** | **the specific previous deployment, identified before the release, not looked up during an incident** |
| **open conflicts at release** | the C-* set still open |
| **legal go-live approval reference** | §50's REL-G018 |

**DEP-D106 · Deployment evidence and product audit are related and distinct**

```
PRODUCT AUDIT (MOD-013, DBT-079)   who did what INSIDE the product, to a school's
                                   data, under which authority.  A school can be
                                   shown it.

DEPLOYMENT EVIDENCE                who released what software, when, from which
                                   commit.  An engineering record.

THEY OVERLAP IN EXACTLY ONE PLACE:
   where a deployment action is ITSELF a consequential platform act on tenant
   data — a migration that transforms a school's rows, a cutover flag flipped
   for a tenant — it earns an AET and lives in the audit trail too.
   ── Stage 19's taxonomy decides that, not this stage.

OTHERWISE, DEPLOYMENT EVIDENCE DOES NOT ENTER THE CUSTOMER AUDIT TRAIL.
   ── filling a school's audit view with our deployment history would bury the
      support actions SECAR-018 exists to make visible
```

---

## 38. Release promotion model

**DEP-D107 · Promotion, not a push**

```
COMMIT → PR → CI GATES → MERGE
                            ↓
                   STAGING DEPLOYMENT
                            ↓
                 STAGING VERIFICATION      §15's set ②
                            ↓
                  RELEASE CANDIDATE        an identified, immutable commit
                            ↓
              PRODUCTION ELIGIBILITY       §15's set ③, INCLUDING the
                                           evidence and legal gates
                            ↓
                PRODUCTION DEPLOYMENT      §14's migration gate first
                            ↓
              POST-DEPLOY VERIFICATION     readiness + smoke
```

**DEP-D108 · Two things that must never happen**

```
NEVER   a developer's laptop  ──►  production
        ── production deploys from a verified commit through the pipeline, and
           `vercel --prod` from a workstation is not that

NEVER   an untested main commit  ──►  production automatically
        ── until every locked gate can be satisfied
```

**DEP-D109 · If production auto-deploy stays enabled, the protection moves to what reaches the
production branch**

```
AUTO-DEPLOY ON A PRODUCTION BRANCH IS ACCEPTABLE **IF** ONLY AN ELIGIBLE
COMMIT CAN REACH THAT BRANCH.

   protected branch · no direct pushes · no force-push
   required status checks = §15's set ① and ②
   promotion is a controlled merge from an eligible candidate, not a
     convenience merge
   ── the branch becomes the gate, and the gate is enforced by the forge
```

**Turning auto-deploy off and deploying by hand is not obviously safer** — it substitutes a human step
for a mechanical one at the exact moment people are in a hurry. **What matters is that the thing which
triggers a deployment cannot be reached by an ineligible commit.**

---

## 39. Data-protection evidence pack

**DEP-D110 · Technical evidence supplied to Legal and privacy — and it is not a compliance claim**

| # | Content |
|---|---|
| 1 | **provider list** — Vercel · Neon · AWS (S3, SES, GuardDuty) · Sentry, with the role each plays |
| 2 | **regions** — target `eu-west-2` for AWS; `eu-west-2` for Neon; **EU (Frankfurt) for Sentry**; **the Vercel function region, which is currently the platform default (DEP-F01)** |
| 3 | **data categories sent to each** — and, for Sentry, the scrubbing that keeps the category empty |
| 4 | **sub-processors** — including Stage 17's residuals: AWS names **250ok Inc.** and **Email Data Source, Inc.** (Brazil · UK · USA) as SES deliverability-metrics sub-processors |
| 5 | **DPA links and evidence** per provider |
| 6 | **environment diagrams** — §59's AZ-2, AZ-4, AZ-7, AZ-8, AZ-9 |
| 7 | **backup location and retention capability** — §30 |
| 8 | **logging and error-monitoring data** — fields, redaction, retention, access — §24 |
| 9 | **the email data path** — what leaves, to whom, in which region |
| 10 | **the storage data path** — including the scanner's handling |
| 11 | **the access model** — §36 |
| 12 | **security controls** — Stage 16's implemented set at the time of the pack |
| 13 | **deletion mechanisms** — Stage 19's pseudonymisation, retention deletion, purge |
| 14 | **quarantine and archive classes** — including **A19-001's legacy snapshot quarantine**, §43 |
| 15 | **international-transfer questions requiring a legal decision** — **stated as questions** |

```
DO NOT WRITE       "GDPR compliant."  "UK GDPR compliant."  "Fully compliant."
WRITE              TECHNICAL EVIDENCE FOR LEGAL / PRIVACY ASSESSMENT

── Stage 21 describes what the system does with data.  Whether that is lawful
   is a legal determination, and every prior stage has held that line.
```

---

## 40. Staging and UAT

**DEP-D111 · Staging is production-shaped enough that a rehearsal means something**

```
STAGING MUST BE ABLE TO VALIDATE
   authentication and MFA          RLS under the real role model
   durable jobs and the cron transport   ── including §27's adapter
   SES sending and event handling  S3 upload, scanning and serving
   Sentry capture and scrubbing    the full migration chain
   the public website, including a custom-domain rehearsal if the release
     scope includes one
```

**DEP-D112 · Synthetic data, of production shape.** Same volumes, same distributions, same awkward rows
— **and no real child.** Stage 20 MIG-T04 already requires exactly this for the migration rehearsal.

**DEP-D113 · UAT with real school representatives uses synthetic or pilot-safe data**

```
DEFAULT     a school representative in UAT works with SYNTHETIC data
            ── they can evaluate the product without any real pupil record
               leaving production

IF A PILOT SCHOOL'S OWN REAL DATA IS GENUINELY REQUIRED
   ── an APPROVED AGREEMENT with that school, covering purpose, environment,
      access, retention and deletion
   ── and it is THEIR data, in an environment they have agreed to

NEVER       an uncontrolled copy of production pupil data, for any environment,
            for any reason, at any time                              DEP-P12
```

---

## 41. Pilot architecture

**DEP-D114 · One controlled pilot school, on the same product, with no separate infrastructure**

```
THE PILOT IS THE PRODUCT.
   ── no beta tier, no separate deployment, no parallel stack, no
      pilot-only pricing infrastructure
   ── ScholarShelf remains ONE multi-tenant application

WHAT THE PILOT SHAPE NEEDS
   cutover-flag eligibility scoped to that tenant where §34's flags allow
   heightened monitoring for that tenant's workloads
   a named support path with a human on it
   A ROLLBACK STORY THAT DOES NOT REQUIRE THE SCHOOL TO RE-ENTER ANYTHING
   a clear incident path, with the owner named
```

**DEP-D115 · Stage 21 does not choose the customer.** That is a commercial decision, and it is not
manufactured into a technical one.

---

## 42. Legacy coexistence during cutover

**DEP-D116 · Temporary, and every mechanism carries its own removal**

```
COEXISTENCE IS PERMITTED ONLY WHERE STAGE 22 NEEDS IT
   dual-read              during a schema switch
   dual-write             during a data move
   a compatibility view   while readers migrate
   a route bridge         Stage 20's legacy route cutover register (its §26.1)'s LEGACY ROUTE CUTOVER REGISTER
   provider cutover       Resend → SES, §23

EVERY ONE CARRIES, OR IT IS NOT PERMITTED
   an owner · a purpose · a REMOVAL STAGE OR BATCH · monitoring · a test ·
   a FINAL DELETION GATE

NO PERMANENT COMPATIBILITY ARCHITECTURE.
   ── the old and the new product do not run as independent systems
      indefinitely, and nothing here is designed on the assumption that
      they might
```

**DEP-D117 · A dual-write is the most dangerous of these and gets the strictest rule.** One side is
authoritative at any moment; **the other is a copy whose divergence is monitored, not assumed absent.**
**Two authoritative writers is not coexistence — it is two products disagreeing about a child's
record.**

---

## 43. Legacy snapshot quarantine — deployment requirements

**From A19-001. Stage 22 selects the mechanism; Stage 21 states what the environment must guarantee
about whatever it selects.**

**DEP-D118 · Ten requirements, mechanism-agnostic**

```
 1  NOT ORDINARY APPLICATION ACCESSIBLE   no route, no query, no projection
                                          reaches it
 2  NOT ORDINARY CONSOLE READABLE         not the read tier, not a support
                                          screen, not A7-001's capability
 3  ENCRYPTED AT REST                     and in transit
 4  A RESTRICTED OPERATOR ROLE            distinct from DBROLE-2 and from
                                          DBROLE-4; not held by the runtime
 5  ACCESS LOGGING                        every read is recorded, with who and
                                          why — a quarantine nobody watches is
                                          a store nobody governs
 6  NO PUBLIC NETWORK EXPOSURE            beyond the provider path strictly
                                          required to hold it
 7  NOT INDEXED INTO AUDIT SEARCH         §28 of Stage 19 does not reach it
 8  NOT EXPORTABLE THROUGH THE SCHOOL
    AUDIT UI                              §29 of Stage 19 cannot contain it
 9  BACKED UP                             and the backup inherits every
                                          restriction above — §30
10  AN APPROVED DESTRUCTION PATH LATER    exists, is documented, and is NOT
                                          reachable by a migration or a pipeline
```

**DEP-D119 · If object storage is the selected mechanism, it is a separate bucket, not a prefix**

```
LEGACY SNAPSHOT QUARANTINE  ──  its own bucket, its own policy, its own role
                                Block Public Access, versioning, encryption
   ── NOT a prefix inside the operational bucket.  A prefix is one policy
      mistake away from the operational bucket's reachability, and this data
      is precisely the data whose reachability the owner constrained.
```

**DEP-D120 · Stage 21 does not decide retain / redact / delete.** A19-001 keeps that with approved legal
and privacy policy. **§43 makes the quarantine deployable and makes its eventual destruction possible —
it does not authorise the destruction.**

---

## 44. Manual accessibility release gate

**From owner decision 2A. Stage 20's §35.1 defines the assessment; Stage 21 gives it a slot in the
release mechanism.**

**DEP-D121 · `MANUAL_ACCESSIBILITY_ASSESSMENT` is a release-gate slot with three states**

```
PENDING            no assessment for this release scope             ── BLOCKS
FAILED / BLOCKED   assessed; blocking findings unresolved           ── BLOCKS
PASSED / ACCEPTED  assessed; findings remediated or formally
                   accepted as residuals, re-test passed            ── clears
```

**DEP-D122 · No production promotion while the gate is PENDING or FAILED.** It sits in §50's register
alongside the automated gates and **is not satisfiable by any pipeline** — DEP-P18.

**DEP-D123 · A release-evidence file is enough; no accessibility-management system is built.** The
record carries Stage 20 TST-D088's fields, lives with the release evidence (§37), and is referenced —
**not copied** — from the release record. **It is called ACCESSIBILITY ASSESSMENT EVIDENCE, never a
"WCAG certificate", unless an external assessor issues something that means that.**

**DEP-D124 · The gate is scoped to the release.** An assessment of last quarter's build is not evidence
about this one where the surfaces assessed have changed — **the record names the build and the surfaces,
which is why TST-D088 has those fields.**

---

## 45. Penetration test gate

**Stage 16 locked independent penetration testing before go-live. Stage 21 designs when and against
what.**

**DEP-D125 · The test runs against staging, and staging must be worth testing**

```
PRECONDITIONS
   staging is production-shaped                                   §40
   the TARGET security model is implemented — not the legacy one
     ── a pen test against the pre-Stage-7 role model tests a system that
        is being replaced, and its findings expire on the cutover date
   test accounts and data are SYNTHETIC                           DEP-P12
   the environment is isolated, so an exploited finding cannot reach
     production
   the scope is written down: surfaces, roles, exclusions
```

**DEP-D126 · Findings are triaged, fixed, and RE-TESTED — and the re-test is the evidence**

```
findings → triage against Stage 16's severity model → remediation
        → RE-TEST → the final result referenced in the release record   §37

A REPORT WITH OPEN CRITICAL FINDINGS IS NOT A PASSED GATE.
An unre-tested fix is not a fix; it is an intention.
```

**DEP-D127 · No test is scheduled, procured or performed by this stage.**

---

## 46. Dependency and supply-chain security

**DEP-D128 · The lockfile is the contract, and a deployment never modifies it**

```
REQUIRED   package-lock.json committed
           CLEAN INSTALL in CI and in the build — `npm ci`, never `npm install`
           ── `npm install` may REWRITE the lockfile, so the deployed tree is
              not the reviewed tree
           a build that would change the lockfile FAILS

FORBIDDEN  deploying from a modified, uncommitted lockfile
           deploying unreviewed generated dependency drift
```

**DEP-D129 · Audit and vulnerability handling, proportionate to the team**

| | |
|---|---|
| **dependency audit** | **in the PR gate**, with a documented threshold for what blocks |
| **critical vulnerability** | **blocks the release** unless an explicit, recorded, time-boxed acceptance exists |
| **known exception** | **`xlsx@0.18.5` is already recorded (C-58)** — the terminal npm release, predating two CVE fixes. **Its handling is Stage 17/22's; §46 does not re-decide it and does not let the audit step silently normalise it** |
| **pinning** | exact versions for the toolchain; the lockfile for everything |
| **automated update PRs** | **acceptable and useful — provided they pass the same gates.** They are not automatically merged |

**DEP-D130 · No enterprise supply-chain platform is introduced.** A lockfile, `npm ci`, an audit step
and a recorded exception list are proportionate to this team and this product. **A tool nobody has time
to triage produces a dashboard, not security.**

---

## 47. Build reproducibility

**DEP-D131 · A release is attributable to five things, and all five are recorded**

```
COMMIT SHA  ·  LOCKFILE HASH  ·  NODE MAJOR  ·  ENVIRONMENT CONFIG VERSION
·  MIGRATION VERSION
```

**DEP-D132 · The build sequence that produces a releasable artefact**

```
CLEAN CHECKOUT   ── not an incremental working tree
CLEAN INSTALL    ── npm ci from the committed lockfile
BUILD            ── the client bundle
SMOKE THE PRODUCTION ENTRY  ── compile and boot api/index.ts       DEP-P1
ARTEFACT IDENTITY ── recorded, and carried into §37's evidence
```

**DEP-D133 · "It worked on a developer laptop" is not release evidence.** The clean checkout exists
because the three outages `smoke-boot.ts` documents were all *"the first clean-checkout compile of the
artefact that actually ships."*

---

## 48. Configuration drift and IaC

**DEP-D134 · The census of configuration that lives outside Git**

| Where | What | Exportable? |
|---|---|---|
| **Vercel** | project settings, **function region**, Node runtime, env vars, domains, deployment protection, cron | partially — via API/CLI |
| **Neon** | project, region, roles, connection settings, backup configuration | partially |
| **AWS** | IAM roles and policies, S3 buckets and policies, SES identities, GuardDuty configuration | **yes — this is the part IaC is genuinely good at** |
| **Sentry** | org, projects, scrubbing rules, alerts | partially |
| **DNS** | records, including school-owned ones | **school-owned records are not ours to manage** |

**DEP-D135 · Infrastructure-as-code, evaluated on criteria rather than popularity**

| Option | Complexity | Repeatable | Secret separation | Reviewable | Rollback | Multi-env |
|---|---|---|---|---|---|---|
| **manual + exported config in Git** | **lowest** | weak | fine | **the export is reviewable, the change is not** | manual | error-prone |
| **AWS CDK / CloudFormation** | medium | **strong** | good | **yes, in PR** | **stack rollback** | **strong** |
| **Terraform / OpenTofu** | medium-high | **strong** | good | yes | plan/apply | **strong** — and covers Vercel and Sentry too |

**DEP-D136 · SELECTED: AWS CDK in TypeScript, for AWS resources only**

**The draft left CDK versus Terraform undecided. That is an engineering decision Stage 21 owns, and it
is made here.**

```
SELECTED   AWS CDK · TypeScript

SCOPE      S3 buckets and their policies
           IAM roles, policies AND THE OIDC TRUST POLICY        DEP-D155
           SES configuration — identities, configuration sets
           GuardDuty configuration
           any other directly required AWS deployment resource

WHY
   the IaC scope is AWS-ONLY, so a multi-provider tool buys nothing here
   ScholarShelf is TypeScript — one language, one toolchain, one review skill
   CloudFormation-backed deployment, with stack rollback
   a reviewable resource diff before apply
   multi-environment composition is a first-class CDK concept, which is
     exactly what two AWS accounts (DEP-D046) needs

DO NOT ADD Terraform or OpenTofu as a SECOND infrastructure tool.
   ── two IaC tools is two state models, two review skills and an
      unanswerable question about which one owns a given resource
```

**Vercel, Neon and Sentry stay on documented provisioning runbooks plus exported-configuration
verification** (DEP-D138), **unless a later measured need justifies expanding IaC.** Their settings are
few, changed rarely, and — for the two that matter most — irreversible anyway (E-9, E-13), which a
state file does not help with.

**Stage 22 may implement the CDK. Stage 21 creates no CDK file and installs nothing.**

**DEP-D160 · IaC for AWS only, and a reviewed runbook plus exported configuration for everything
else**

```
IaC SCOPE — SMALL AND EXACTLY WHERE IT PAYS
   S3 buckets and their policies       ── the blast radius of a mistake is the
                                          reason: a public-access setting typed
                                          by hand at 6pm is how object stores leak
   IAM roles and policies              ── the same reason, more so
   SES configuration                   ── identities, configuration sets
   GuardDuty configuration             ── §21's enablement

NOT IaC, DELIBERATELY
   Vercel        ── few settings, changed rarely; a runbook plus an exported
                    snapshot in Git is proportionate.  A Terraform provider for
                    a handful of project settings adds a toolchain and a state
                    file to maintain.
   Neon          ── the region is set once and cannot change (E-9); roles are
                    §11's provisioning runbook
   Sentry        ── set up once, and its most important property is
                    irreversible anyway (E-13)
   DNS           ── partly school-owned

TECHNOLOGY IF ADOPTED   either CDK or Terraform/OpenTofu is defensible for that
                        scope.  CDK if the team is happier in TypeScript, which
                        this one demonstrably is; Terraform if a single tool
                        across providers later becomes the goal.
                        ── STAGE 21 SELECTS THE SCOPE.  Stage 22 may implement
                           it in a controlled batch.
```

**DEP-D137 · No infrastructure file is created here.**

**DEP-D138 · Drift is detected, not merely discouraged.** A periodic comparison of exported provider
configuration against the committed copy, **reported when it differs** — because the configuration that
matters most (a bucket policy, a function region) is exactly the configuration nobody remembers
changing.

---
---

## 49. Provider preflights — PFL-001 … PFL-021

**Four classifications, and only the first is satisfied by reading a document.**

```
DV   DOCUMENTATION VERIFIED            an official source proves it — §2's E-table
PV   PROVISIONING VERIFICATION REQUIRED  only a real resource can settle it
ME   MANUAL EVIDENCE REQUIRED          a human produces the evidence
LP   LEGAL / POLICY REQUIRED           not an engineering gate at all
```

| PFL | Preflight | Class | Evidence / residual |
|---|---|---|---|
| **PFL-001** | **Vercel Node 24 runtime** | **DV** | E-7 — GA for builds and functions. §8's four-way assertion is the check |
| **PFL-002** | **Vercel production function region is `lhr1`, and it is the ONLY execution region** | **PV** | **DEP-F01 · C-63 · DEPQ-1 = A.** The default is `iad1` (E-3); the project's actual setting is not in the repository |
| **PFL-003** | **the Vercel team plan is Pro**, and its duration/concurrency limits follow | **PV** | E-5 gives the tiers. **DEPQ-1 = A records the INTENT; the account's actual plan is unverified** — DEP-D143 |
| **PFL-004** | **both Neon projects exist, separately, in `eu-west-2`** | **PV** | **E-9: region cannot be changed.** If production is elsewhere, DEP-D013 makes it a Stage 22 migration and a go-live blocker |
| **PFL-005** | **ACTUAL connection capacity — `SHOW max_connections;` on the real staging and production endpoints** | **PV** | **DEP-D151 · DEP-P19 — a MEASUREMENT, not a plan lookup.** §13 delivers the formula; this supplies the number |
| **PFL-006** | **Neon backup / PITR capability, as actually entitled** | **PV** | DEP-D084 — recorded, not assumed. **"Scale" is the intent, not the evidence** |
| **PFL-007** | **the six database roles exist, with the right grants and no `BYPASSRLS`** | **PV** | §10 · §11's provisioning half |
| **PFL-008** | **`FORCE ROW LEVEL SECURITY` is on, and DBROLE-2 is not the owner** | **PV** | **DEP-D015 — the check that stops every RLS test passing vacuously** |
| **PFL-009** | **S3 `eu-west-2` buckets, Block Public Access, versioning, encryption** | **PV** | §20 |
| **PFL-010** | **GuardDuty Malware Protection for S3 in `eu-west-2`** | **PV** | **THE HARD GATE — DEP-D053.** E-11 + E-12 make it very likely; **the EICAR test proves it** |
| **PFL-011** | **SES `eu-west-2` identity verified — SPF, DKIM, DMARC** | **PV** | §22 |
| **PFL-012** | **SES PRODUCTION ACCESS GRANTED in `eu-west-2`** | **PV** | **E-10 — per-region, and the sandbox is 200 messages/24 h. Request early** |
| **PFL-013** | **Sentry organisation created in the EU region** | **PV** | **E-13 — IRREVERSIBLE. This is checked BEFORE the org exists, not after** |
| **PFL-014** | **custom domain verification and TLS issuance** | **PV** | §28 |
| **PFL-015** | **the cron transport reaches the job runner** — §27's adapter, end to end in staging | **PV** | **C-106 · A14-001** |
| **PFL-016** | **backup restore rehearsal passes** | **PV** | §31 — and **a backup is not verified without it** |
| **PFL-017** | **manual WCAG 2.2 AA assessment** | **ME** | owner decision 2A · §44 |
| **PFL-018** | **independent penetration test, with re-test** | **ME** | Stage 16 · §45 |
| **PFL-019** | **legal / privacy release approval** | **LP** | §39's pack is the input; **the decision is not ours** |
| **PFL-020** | **Neon's pooled endpoint preserves `BEGIN` → `SET LOCAL` → query → `COMMIT` on one session** | **PV** | **DEP-D026 — A13-001 requires it, and a failure here does not error; it returns the wrong rows.** Prove it, or use the direct endpoint |
| **PFL-021** | **the Vercel→AWS OIDC trust policy REFUSES preview and staging subjects for the production role** | **PV** | **DEP-D155** — assert the refusal, not only the success |

**DEP-D139 · Fourteen of twenty-one are `PV`, and that is the honest shape of a deployment stage.**
Documentation proves what a provider offers; **only a provisioned resource proves what this account
has.** A stage that classified more of these as verified would be describing a system it had not built.

---

## 50. Release gates — REL-G001 … REL-G018

**One canonical register. Every gate has an owner, an evidence source, and a stage. NONE IS MARKED
PASS.**

| REL-G | Gate | Owner | Evidence | Blocking | Stage | Status source |
|---|---|---|---|---|---|---|
| **REL-G001** | architecture locked, Stages 1–22 | owner | the locked documents | **YES** | 1–22 | the stage headers |
| **REL-G002** | target implementation complete for the release scope | engineering | the batch register | **YES** | 22 | Stage 22 |
| **REL-G003** | **migration chain rehearsed from empty** | engineering | **MIG-T01 … MIG-T03** | **YES** | 20/22 | CI |
| **REL-G004** | **migration-from-baseline rehearsal** on synthetic production-shape data | engineering | **MIG-T04 … MIG-T06** | **YES** | 20/22 | staging |
| **REL-G005** | **every ACTIVE target test green** | engineering | the pipeline | **YES** | 20 | CI |
| **REL-G006** | **RLS verified under a non-bypassing role** | engineering | **TEN-T · PFL-008** | **YES** | 20/21 | CI + staging |
| **REL-G007** | **I-2 verified, including the audit rollback** | engineering | **INV-T01 … INV-T04** | **YES** | 20 | CI |
| **REL-G008** | Stage 16's controls implemented; security regression green | engineering | **SEC-T** | **YES** | 16/20 | CI |
| **REL-G009** | **provider preflights green** | deployment operator | **§49's PFL register** | **YES** | 21 | staging |
| **REL-G010** | **GuardDuty scanning proven in `eu-west-2`** | deployment operator | **PFL-010's EICAR test** | **YES — and it blocks the object migration specifically** | 21/22 | staging |
| **REL-G011** | **backups configured** | deployment operator | PFL-006 | **YES** | 21 | provider |
| **REL-G012** | **restore rehearsal passed** | deployment operator | **PFL-016** | **YES** | 21 | rehearsal record |
| **REL-G013** | **automated accessibility green** | engineering | axe + TST-D062's five | **YES** | 20 | CI |
| **REL-G014** | **MANUAL WCAG 2.2 AA ASSESSMENT** | **owner** | **§44's evidence record** | **YES** | 20/21 | **release evidence — 2A** |
| **REL-G015** | **independent penetration test complete, findings re-tested** | owner | §45 | **YES** | 16/21 | report reference |
| **REL-G016** | **UAT accepted** | owner | UAT record | **YES** | 21 | §40 |
| **REL-G017** | **pilot completed**, if the production plan requires one | owner | pilot record | **conditional** | 21 | §41 |
| **REL-G018** | **LEGAL / PRIVACY / COMPLIANCE APPROVAL — the go-live block lifted** | **owner + legal** | **the legal process's own record** | **YES — ABSOLUTELY** | — | **not an engineering artefact** |

**DEP-D140 · No gate is marked PASS in Stage 21. The document designs the gates.**

**DEP-D141 · One green CI run satisfies REL-G005 and REL-G013. It satisfies none of the other sixteen.**

```
17 Critical · 52 High · 14 domains · 0% clearance
   ── REL-G018 is not a checkbox at the end of a list.  It is the reason the
      list exists, and a pipeline cannot reach it.                    DEP-P18
```

---

## 51. Findings — DEP-F01 … DEP-F18

**All E2. Deduplicated against existing C-* — three candidates that looked new were not.**

| DEP-F | Finding | Becomes |
|---|---|---|
| **F01** | **Vercel function region unset → `iad1` (US East)** | **C-63**'s compute instance — **no new identifier** |
| **F02** | **the pool has no `max`, no timeouts, no `statement_timeout`** | **DEP-D024 · PFL-005** |
| **F03** | **eleven env variables bypass the validated boundary**, five security-relevant | **DEP-D040** — extends Stage 16's three-variable finding |
| **F04** | **two canonical-origin variables**, one validated | **DEP-D040 · §56's DEPQ-2** |
| **F05** | **cron fails SILENT when `CRON_SECRET` is absent** — 401s forever, nothing alerts | **DEP-D041 · DEP-D070** |
| **F06** | **production TLS verification disabled by default**, warns instead of failing | **DEP-D042** — with a cutover sequence, not a switch |
| **F07** | **Vercel cron is GET; API-278 is POST** | **C-106 · A14-001** |
| **F08** | **one health route; no live/ready split** | **DEP-D066** |
| **F09** | `maxDuration: 30` never revisited against the platform's real limits | **DEP-D007** |
| **F10** | **the built artefact is not the deployed artefact** | **already correct** — `smoke-boot.ts`; made explicit at **DEP-D005** |
| **F11** | **no `engines`, no `.nvmrc`; CI Node 20 (EOL)** | Stage 11 owns the remedy — **no new identifier** |
| **F12** | **`vercel.json` carries a second CSP competing with helmet's** | **A16-001 already owns this** — **no new identifier** |
| **F13** | **`ORPHAN_ADMIN` / `ORPHAN_PASSWORD` are credentials read from unvalidated env** | **DEP-D040 · SECENV** — and their production reachability is a Stage 22 question |
| **F14** | **this document's own draft asserted an impossible S3 configuration** — account-level Block Public Access ON *and* a per-bucket public-policy exception | **corrected at DEP-D049 · DEP-D152** — AWS applies the most restrictive applicable BPA configuration |
| **F15** | **the draft promoted an unguessable object key to a control** | **corrected at DEP-D050** — defence in depth, never authorisation |
| **F16** | **the draft named TWO Node authorities** — `package.json` and `.nvmrc` | **corrected at DEP-D010** — `engines.node` is canonical; everything else derives |
| **F17** | **the draft made a custom CA bundle the TLS requirement** | **corrected at DEP-D042** — verification is the requirement; the CA is one possible means |
| **F18** | **the draft inferred the connection ceiling from a plan tier** | **corrected at DEP-D151** — it is a property of the provisioned compute, measured by `SHOW max_connections;` |

---

## 52. Decisions — DEP-D001 … DEP-D160

| DEP-D | Subject | § |
|---|---|---|
| **001–004** | four environments; **staging never shares production's database, CI never shares either**; previews are an environment whether or not anyone designed them | 5–6 |
| **005–008** | **the deployed artefact is named explicitly**; the target Vercel configuration; **two duration ceilings, not one**; the unusual build layout is kept because the tidy version broke production | 7 |
| 009–010 | **one Node major, written once and read four times, machine-asserted** | 8 |
| **011–013** | three databases; **`eu-west-2` decided before creation because Neon cannot change it**; **a wrong current region is a Stage 22 migration and a go-live blocker** | 9 |
| **014–017** | **six privilege classes**; **the application must not OWN what it reads under RLS, plus `FORCE`**; the runtime never holds the migration credential; **absence disables a tier, never escalates** | 10 |
| **018–020** | **MIG-000's four statement classes**; **a SQL file with passwords is never the provisioning mechanism**; C-19 does not close here | 11 |
| **021–023** | the RLS read path's six deployment requirements; **NO fallback to Neon HTTP for a scoped read, ever**; `idle_in_transaction_session_timeout` is mandatory | 12 |
| **024–027** | **every value bounded**; **the FORMULA is delivered, the ceiling is PLAN INPUT REQUIRED**; the pooled endpoint is verified, not assumed; the file-descriptor ceiling is real | 13 |
| **028–032** | **the gate fails closed at every arrow**; one runner, committed files, **no `db:push` in any deployment path**; **an ADVISORY LOCK, not a workflow concurrency group**; forward repair by default; the applied version is recorded and reported | 14 |
| 033–034 | three gate sets; **provider smoke runs in staging, never in a PR** | 15 |
| **035–036** | activation is suite composition, not a switch on a failing test; **the register step prints deferral on every run** | 16 |
| **037–039** | **eighteen secrets, each with scope, reader, rotation and revocation**; **per-school payment credentials are not ordinary configuration**; the store is chosen for the property that matters | 17 |
| **040–044** | **eleven variables come back inside the boundary**; **production fails to boot on nine conditions**; **TLS enforcement inverts, as a Stage 22 cutover step**; no insecure fallback; readiness reports degraded operation rather than averaging it | 18 |
| **045–047** | one region for everything; **separate accounts for production vs non-production, recommended with the trade-off stated**; the target resource model | 19 |
| **048–051** | **five object classes**; Block Public Access with one deliberate exception; **no listing, no predictable key**; **a school's domain is never a path to a private object** | 20 |
| **052–054** | **the GuardDuty evidence is stronger and still not proof**; **the gate becomes an EICAR test in staging**; **no production object migration depends on unverified scanning** | 21 |
| **055–058** | **the SES sandbox is per-region and 200/day is a broken product**; production access is a preflight with a lead time; the full sending configuration; **do not configure SES, do not remove Resend** | 22 |
| **059–061** | **one active sender, never dual-send**; seven cutover inputs; **the notification fact and the delivery are already separate, which is what makes this safe** | 23 |
| **062–065** | **the EU region is chosen before the organisation exists**; the target architecture; **two scrubbing layers**; **Sentry is never load-bearing, including at boot** | 24 |
| **066–068** | **two probes, and liveness touches no database**; a public probe reveals nothing; **`/api/health` is preserved during cutover** | 25 |
| **069–071** | Stage 18 owns thresholds, Stage 21 owns destinations; **the alert that matters most is the one for SILENCE**; no personal data in an alert label | 26 |
| **072–076** | **C-106**: the locked endpoint is unreachable by the locked transport; **the smallest safe adapter**; **A14-001 REQUIRED, identifier not minted**; the cron deployment; **once-daily was already proven insufficient** | 27 |
| 077–079 | five domain classes; verification precedes activation and failure is visible; **not a registrar** | 28 |
| **080–082** | **`__Host-` scoping is what stops a school-controlled domain receiving the session**; public and authenticated are separate origins; `trust proxy` is not origin authority | 29 |
| **083–085** | what is backed up and by what capability; **"Neon backs it up" is not an answer**; **no legally required retention is invented** | 30 |
| **086–088** | **a backup that has not been restored is not a backup**; the restore target is isolated and approved; **most rehearsals need no production data at all** | 31 |
| **089–091** | twelve runbooks; **rotate BEFORE you investigate**; **breach assessment is a legal determination, not an engineering one** | 32 |
| **092–094** | **three different rollbacks**; **the gate REFUSES an incompatible rollback rather than letting someone say "just roll back"**; expand → migrate → contract is supported | 33 |
| **095–097** | **four cutover flags, not five, and not a platform**; the rules that keep them temporary; **a flag with no removal batch is a permanent branch** | 34 |
| **098–100** | a preview gets nothing that matters; **a fork's PR receives no secret — a platform setting, not a convention**; previews are not publicly reachable | 35 |
| **101–104** | four access roles, MFA, **no shared super-account**; offboarding, recovery and review designed now; no account created | 36 |
| **105–106** | the release record's fourteen fields; **deployment evidence and product audit are related and distinct, and overlap in exactly one place** | 37 |
| **107–109** | promotion, not a push; **never a laptop, never an untested commit**; **if auto-deploy stays on, the branch becomes the gate** | 38 |
| **110** | the fifteen-item evidence pack — **"technical evidence for legal assessment", never "GDPR compliant"** | 39 |
| **111–113** | staging is production-shaped; synthetic data of production shape; **UAT uses synthetic or pilot-safe data, and never an uncontrolled copy** | 40 |
| **114–115** | **the pilot is the product** — no separate infrastructure; Stage 21 does not choose the customer | 41 |
| **116–117** | coexistence is temporary and carries its own removal; **dual-write gets the strictest rule** | 42 |
| **118–120** | **ten quarantine requirements, mechanism-agnostic**; **a separate bucket, not a prefix**; **Stage 21 does not decide the final disposition** | 43 |
| **121–124** | the accessibility gate's three states; **no promotion while PENDING or FAILED**; a file is enough; **the gate is scoped to the release** | 44 |
| **125–127** | the pen test runs against staging, and **against the TARGET security model, not the legacy one**; **an unre-tested fix is an intention**; nothing scheduled here | 45 |
| **128–130** | **`npm ci`, never `npm install`**; proportionate audit handling with C-58 named; **no enterprise platform** | 46 |
| **131–133** | five attributes per release; the build sequence; **"it worked on a laptop" is not evidence** | 47 |
| **134–138** | the drift census; **IaC evaluated on criteria**; **IaC for AWS ONLY, runbook plus export elsewhere**; nothing created; **drift is detected, not discouraged** | 48 |
| **139** | **twelve of nineteen preflights need a provisioned resource — the honest shape of a deployment stage** | 49 |
| **140–141** | **no gate is marked PASS**; **one green CI run satisfies two of eighteen** | 50 |
| **142–145** | **DEPQ-1 = A** — Vercel Pro, separate staging and production projects, `lhr1`; Neon Scale, separate projects, `eu-west-2`; **an owner plan decision is an INTENT and verifies no account**; **one application region deliberately, because there is one write authority**; **a billing plan is not a project** | 4.1 |
| **146–150** | **DEPQ-2 = A** — `app.scholarshelf.co.uk` and `staging.scholarshelf.co.uk` as exact origins, never derived from a header; **root and www are NOT auth authorities**; **environment origins never cross**; **preview URLs are canonical for nothing**; public school sites unaffected | 4.1 |
| **151** | **the connection ceiling is a property of the PROVISIONED COMPUTE — `SHOW max_connections;`, not a plan name** | 13 |
| **152–153** | **the public CMS bucket's safety is its CONTENTS POLICY, not a permission override**; **an all-private design needs a Stage 17 amendment — no CloudFront is introduced here** | 20.1 |
| **154–156** | **SELECTED: Vercel OIDC → AWS STS, no long-lived runtime key**; **the trust policy names team, project AND environment**; three other access paths, each with its own identity | 19 |
| **157** | **the exact node-postgres + Neon TLS semantics are verified by connecting, not by reasoning** | 18 |
| **158–159** | **the target cron path is a new internal route, not today's**; **the adapter's contents are exhaustive, and it performs NO loopback POST to itself** | 27 |
| **160** | **SELECTED: AWS CDK in TypeScript, AWS scope only — no second IaC tool** | 48 |

---

## 53. Risks — DEP-R001 … DEP-R023

| DEP-R | Risk | Severity | Mitigation |
|---|---|---|---|
| **DEP-R001** | **The application role owns its tables or holds `BYPASSRLS`, and every tenancy control is decorative** | **CRITICAL** | **DEP-D015** — ownership separation **plus** `FORCE ROW LEVEL SECURITY`; **PFL-008** verifies it against a real database; Stage 20 TST-D029 tests it under a non-bypassing role |
| **DEP-R002** | **The migration credential reaches the runtime**, turning any injection into a data-loss event | **CRITICAL** | **DEP-D016** — DBROLE-1 exists only in the gate's execution context; **SECENV-003 is scoped to the gate** |
| **DEP-R003** | **A preview or CI job holds a production secret** | **CRITICAL** | **DEP-D099** — secret-requiring jobs never run on a fork's PR; §6's per-environment scoping |
| **DEP-R004** | **Compute or data rests outside the target jurisdiction** | **CRITICAL** | **DEP-F01 · DEP-D012 · C-63** — both halves named; **PFL-002 and PFL-004**; and **E-9 means the database half is a migration, not a setting** |
| **DEP-R005** | **Pool exhaustion under load, with no timeout to fail fast** | **HIGH** | **DEP-D024's bounded values · DEP-D025's formula**; **DEP-D022 refuses the unsafe fallback rather than degrading into a leak** |
| **DEP-R006** | **Node version drift** — CI on one major, Vercel on another, local on a third | **MEDIUM** | **DEP-D010** — one source, four readers, machine-asserted |
| **DEP-R007** | **SES is still in the sandbox at go-live**, so 200 messages a day reach families | **HIGH** | **DEP-D056 · PFL-012** — per-region production access, requested early, and it is release evidence |
| **DEP-R008** | **GuardDuty Malware Protection is unavailable in `eu-west-2`** and objects are served unscanned | **HIGH** | **DEP-D053's EICAR gate**; **DEP-D054** — the object migration is blocked rather than the scanning assumed |
| **DEP-R009** | **The Sentry organisation is created in the US region, irreversibly** | **HIGH** | **DEP-D062 · PFL-013** — checked **before** the organisation exists, because afterwards there is no check to run |
| **DEP-R010** | **Cron does not run and nothing notices** | **HIGH** | **DEP-F05 · DEP-D041** (boot fails without the secret) **· DEP-D070** (silence is the alert) |
| **DEP-R011** | **The cron transport cannot reach the locked job endpoint at cutover** | **HIGH** | **C-106 · DEP-D073's adapter · A14-001 · PFL-015** rehearsed in staging |
| **DEP-R012** | **A secret is copied between environments** for convenience | **HIGH** | §17's per-environment scoping; **§32 treats a cross-environment secret as compromised** |
| **DEP-R013** | **A backup is never restored, and is discovered to be unusable during an incident** | **HIGH** | **DEP-P11 · DEP-D086 · PFL-016 · REL-G012** — the rehearsal is a blocking gate |
| **DEP-R014** | **A bad migration outruns the application rollback**, and "roll it back" is not available | **HIGH** | **DEP-D093** — the gate REFUSES an incompatible rollback; **DEP-D094**'s compatibility windows; Stage 15's additive-until-MIG-13 design |
| **DEP-R015** | **A custom domain misroutes**, serving one school's site on another's host | **HIGH** | **DEP-D078** — verification precedes activation, and an unrecognised host serves nothing; **DEP-D080** keeps the cookie out of it |
| **DEP-R016** | **A legacy route survives cutover** and becomes permanent | **MEDIUM** | Stage 20 TST-D080's register; **§42's removal-batch requirement** |
| **DEP-R017** | **The legacy snapshot quarantine becomes reachable** through an operational path | **HIGH** | **§43's ten requirements · DEP-D119's separate bucket** — a prefix is one policy mistake from the operational bucket |
| **DEP-R018** | **Engineering releases against a lifted-looking gate list while the legal block stands** | **CRITICAL** | **DEP-P18 · DEP-D140 · DEP-D141 · REL-G018** — **no gate is marked PASS here, and one green run satisfies two of eighteen** |
| **DEP-R019** | **An owner plan decision is read as an account fact**, and provisioning is skipped | **HIGH** | **DEP-D143** states it in terms; **PFL-003 … PFL-006 stay PROVISIONING VERIFICATION REQUIRED after the decision** |
| **DEP-R020** | **Neon's pooled endpoint silently breaks `SET LOCAL`**, so RLS reads return the wrong rows without erroring | **CRITICAL** | **DEP-D026 · PFL-020** — proven on the real endpoint, or the direct endpoint is used |
| **DEP-R021** | **A preview or staging deployment assumes the production AWS role** | **CRITICAL** | **DEP-D155's trust-policy subject conditions · PFL-021**, which asserts the REFUSAL rather than the success |
| **DEP-R022** | **A staging invite or reset link lands on production**, and a tester changes a real family's account | **HIGH** | **DEP-D148 · DEP-D041** — an origin that is not this environment's canonical origin fails the boot |
| **DEP-R023** | **`www.scholarshelf.co.uk` keeps working as an auth origin after the cutover**, leaving two authorities | **HIGH** | **DEP-D147** — root and www are not auth authorities; `__Host-` scoping (§29) makes a second one structurally impossible; **Stage 22 sequences the user-visible transition** |

---

## 54. Existing conflicts

**Nothing is closed. Stage 21 provisions nothing and deploys nothing, so it resolves nothing.**

| Conflict | Contribution |
|---|---|
| **C-63 · OPEN** | **processing region.** **Both halves now have an EXACT target** — DEPQ-1 = A: compute `lhr1`, database `eu-west-2`. **Neither is verified against an account** (PFL-002, PFL-004), **E-9 makes the database half a project migration if it is wrong**, and DEP-D013 hands that to Stage 22 as a blocker. **A target is not a configuration; the conflict stays open until the resources exist** |
| **C-19 · OPEN** | **MIG-000.** §11 performs the four-class split on paper; **Stage 21 owns class B, Stage 22 owns class A**; it closes when both land and SEC-T15 is ACTIVE and green |
| **C-104 · POLICY RESOLVED / EVIDENCE OPEN** | **§44's three-state gate; REL-G014 blocking.** Unchanged by this lock |
| **C-78 · OPEN** | **`db:push` and an unrunnable migration in CI.** **DEP-D029 removes `db:push` from every deployment path**, extending Stage 15's MIG-01 requirement from CI to the release mechanism |
| **C-90 · OPEN** | MFA enrolment. Unchanged here — it is an application defect, and its gate is Stage 20's SEC-T03 |
| **C-104 · POLICY RESOLVED / EVIDENCE OPEN** | **§44 gives the manual assessment a release-gate slot with three states**; **REL-G014 makes it blocking** |
| **C-105 · TARGET SPECIFICATION RESOLVED** | import granularity. **A4-001 was recorded in BUSINESS_RULES.md on 1 September 2026** — Stage 18 OPS-D021 governs the target; BR-095's text stands as the record of CURRENT behaviour. **Stage 20's handoff named "Stage 5"; BUSINESS_RULES.md is STAGE 4, corrected by A20-001.** **Implementation differences remain C-26, OPEN and separate — the two are NOT merged** |
| **C-100 … C-103 · ALL OPEN** | audit. **§43 makes A19-001's quarantine deployable; §37 keeps deployment evidence out of the customer audit trail** |
| **C-58** | `xlsx@0.18.5`. **DEP-D129 names it so the dependency audit does not silently normalise it** |
| **C-21 · C-72 · C-73** | console controls and the MFA secret. **§10's DBROLE-4/5 and §11's class B are the provisioning half of the remedy** |
| **A11-001** | Resend CURRENT/LEGACY. **§23 designs the cutover boundary; §22 does not configure SES; Stage 22 performs it** |
| **A19-001** | **§43's ten deployment requirements for the quarantine** |

---

## 55. New conflicts

**Verified: the last issued identifier is C-105 (Stage 20). The next is C-106. Stage 21 issues one; the
next stage starts at C-107.**

**No conflict is CLOSED by this lock.** C-105 and C-106 both reach a resolved TARGET; neither has an
implementation. **C-19, C-26, C-63, C-78, C-90, C-100 … C-104 are all OPEN and unchanged.**

**C-106 · The locked scheduler transport cannot reach the locked scheduler endpoint — ACTIVE**

*Evidence:*

> **Stage 14, LOCKED — API-278**: `POST /api/internal/jobs/run`, CAP-093, SC-10. The register records
> the current route as `GET|POST /api/cron/run` → **"REPLACE — trigger only"**, Stage 22.

> **Vercel, verified 31 August 2026 (E-1)**: *"To trigger a cron job, Vercel makes an HTTP **GET**
> request to your project's production deployment URL, using the `path` provided in your project's
> `vercel.json` file."*

> **Stage 18, LOCKED**: Vercel Cron is the trigger transport for PostgreSQL durable jobs, and *"the
> target endpoint is Stage 14's API-278 `POST /api/internal/jobs/run`."*

*Locked requirement contradicted:* **none of the three is wrong on its own; together they do not
compose.** The transport can only issue GET. The endpoint accepts POST. **At cutover, the scheduler
cannot start the scheduled work**, and every digest, unpaid reminder and retention job silently stops —
**which DEP-F05 shows is a failure mode this system already produces without alerting.**

*What this is NOT:* it is not C-19, C-78 or C-63, and it is not the existing route's replacement (Stage
14 already scheduled that). **It is a composition gap between two locked stages that were each correct
about their own half.**

*Resolution — the smallest change, and it does not touch API-278:* **DEP-D073's platform trigger
route** — a GET endpoint carrying no business logic, authenticated by `CRON_SECRET` with the cron
headers as corroboration, invoking the same internal runner. **API-278's method, path, capability,
scope and contract are unchanged.**

*Amendment RECORDED:* **A14-001**, in `API_CONTRACT.md`, 1 September 2026 — the first entry in that
document's amendment register. **API-283 `GET /api/internal/jobs/trigger`**, CAP-093, SC-10, MOD-014,
with an explicit bounded rate class. **API-278's contract is unchanged.**

*State:* **TARGET RESOLUTION ESTABLISHED / IMPLEMENTATION OPEN.**

```
RESOLVED     the target composition exists — a GET transport reaches the locked
             POST contract through a business-logic-free adapter

NOT CLOSED   no route has been built, and no route has been removed
             ── Stage 22 sequences it: build API-283 → switch vercel.json's
                path → verify end to end in staging (PFL-015) → THEN remove
                /api/cron/run
             ── C-106 closes when that sequence has run
```

**Not closed.**

**Nothing else is raised.** **DEP-F01, F11 and F12 all looked like new conflicts and are not** — the
function region is **C-63**'s compute half, the Node 20 pin is a Stage 11 finding with a decided
remedy, and the second CSP is already owned by **A16-001**. **Three of four candidates failing the
duplicate check is the identifier scheme working**, and it is the same ratio Stage 20 found.

---

## 56. Owner questions — answered

**ZERO open owner questions. Both were answered on 1 September 2026.**

```
DEPQ-1 = A   VERCEL   Pro · separate staging and production projects ·
                      production application functions in lhr1 (London)
             NEON     Scale · separate staging project · separate production
                      project · both eu-west-2 (London)
             ── §4.1 · DEP-D142 … DEP-D145

DEPQ-2 = A   PRODUCTION_APP_ORIGIN   https://app.scholarshelf.co.uk
             STAGING_APP_ORIGIN      https://staging.scholarshelf.co.uk
             root / www              NOT auth authorities
             preview URLs            canonical for nothing
             ── §4.1 · DEP-D146 … DEP-D150
```

**What the answers did NOT do — and this is the discipline that matters most here:**

```
AN OWNER PLAN DECISION IS AN INTENT.  IT VERIFIES NO ACCOUNT.       DEP-D143

   PFL-003  the Vercel team plan            PROVISIONING VERIFICATION REQUIRED
   PFL-004  both Neon projects, eu-west-2   PROVISIONING VERIFICATION REQUIRED
   PFL-005  actual max_connections          PROVISIONING VERIFICATION REQUIRED
   PFL-006  actual backup / PITR            PROVISIONING VERIFICATION REQUIRED
   PFL-002  lhr1 configured, and only lhr1  PROVISIONING VERIFICATION REQUIRED

── the owner chose the plan.  ENGINEERING still decides pool.max, and it
   decides it from a MEASUREMENT (DEP-D151), not from the plan's name.
```

**Deliberately NOT asked, because they are engineering and are decided above:** pool max · statement
timeout · IAM policy shape · the OIDC trust-policy conditions · SES event destination · Sentry project
structure · CI job order · IaC technology · role names · probe paths · bucket names · flag mechanism.

**One question was considered and NOT raised.** Separate AWS accounts per environment looked
commercial. **It is not — it is an isolation decision with a clear engineering answer, and DEP-D046
makes it: production and non-production, two accounts.** The owner can override a recorded decision
more easily than answer a manufactured question.

---

## 57. Stage 22 handoff

**Stage 22 owns the target extraction and the cutover. Stage 21 supplies the ground it runs on and
starts none of it.**

```
WHAT STAGE 21 SUPPLIES
   ENVIRONMENTS          ENV-001 … ENV-004, with their isolation register    §6
   PROVIDER RESOURCES    the target AWS, SES, S3, GuardDuty and Sentry models
                                                                    §19–§24
   ROLES                 DBROLE-1 … DBROLE-6, and MIG-000's class B  §10 · §11
   SECRETS               SECENV-001 … SECENV-018, with rotation and
                         revocation paths                                   §17
   CI/CD GATES           three gate sets, and the activation model    §15 · §16
   MIGRATION RUNNER      the gate, the advisory lock, the schema verification,
                         the failure policy                                 §14
   PROMOTION MODEL       commit → … → post-deploy verification              §38
   BACKUP / RESTORE      mechanisms and the rehearsal requirement     §30 · §31
   PREFLIGHTS            PFL-001 … PFL-019                                  §49
   RELEASE GATES         REL-G001 … REL-G018                                §50

WHAT STAGE 22 OWNS — AND STAGE 21 HAS NOT BEGUN
   TARGET EXTRACTION              IMPLEMENTATION MASTER PLAN
   MIGRATION EXECUTION PLAN       LEGACY ROUTE CUTLIST
   LEGACY SCREEN CUTLIST          DEPENDENCY CUTLIST
   CODE MOVE REGISTER             DATABASE BACKFILL PLAN
   CUTOVER ORDER                  PROVIDER CUTOVER (Resend → SES)
   COMPATIBILITY SHIMS            LEGACY REMOVAL
   ROLLBACK / RECOVERY SEQUENCE   BATCH IMPLEMENTATION SEQUENCE

SPECIFIC INPUTS STAGE 22 RECEIVES FROM THIS STAGE
   MIG-000 class A                 → the reviewed migration chain       §11
   the legacy snapshot quarantine  → A19-001's six steps, §43's ten
                                     requirements
   a Neon region migration         → IF PFL-004 fails                   §9
   the TLS enforcement inversion   → a cutover step, not a switch  DEP-D042
   §27's cron adapter              → and A14-001, minted by Stage 14
   the four cutover flags          → with their removal batches         §34
```

---

## 58. Success criteria — answered

| Question | Answer |
|---|---|
| Are dev / CI / staging / production isolated? | **YES, in the target** — §5, §6 |
| Can CI reach production? | **NO** — DEP-D002; the credential does not exist there |
| Can a preview use production secrets? | **NO** — DEP-D098, DEP-D099 |
| Is Node 24 pinned consistently? | **YES, in the target** — **ONE canonical authority (`package.json` engines.node)**, everything else derives and is asserted — DEP-D010 |
| Is there a second Node authority? | **NO** — `.nvmrc` is generated and verified, or absent |
| Is the Vercel region exact? | **YES — `lhr1`, and it is the only execution region** — DEPQ-1 = A · DEP-D144 |
| Is multi-region execution enabled for V1? | **NO** — it needs its own amendment, because there is one write authority |
| Are the Neon plans and regions decided? | **YES — Scale, separate projects, `eu-west-2`** — DEPQ-1 = A |
| Does an owner plan decision verify the account? | **NO** — DEP-D143; PFL-003 … PFL-006 stay unverified |
| Is the connection ceiling read off a plan name? | **NO** — `SHOW max_connections;` on the real endpoint, DEP-D151 · DEP-P19 |
| Is Neon's pooled endpoint assumed compatible? | **NO** — PFL-020 proves the `SET LOCAL` semantics or the direct endpoint is used |
| Are the canonical origins exact? | **YES — `https://app.scholarshelf.co.uk` and `https://staging.scholarshelf.co.uk`** |
| Are root and www authentication authorities? | **NO** — DEP-D147 |
| Can a preview URL be canonical, or carry a credential link? | **NO** — DEP-D149 |
| Can a staging link reach production? | **NO** — DEP-D148, and the boot fails on a wrong origin |
| Does the application runtime use migration-owner credentials? | **NO** — DEP-D016 |
| Can the application role `BYPASSRLS`? | **NO** — DEP-D014, and **DEP-D015 also stops it owning the tables** |
| Is MIG-000 blindly applied as a normal migration? | **NO** — §11's four-class split |
| Is `db:push` the production or CI schema authority? | **NO** — DEP-D029 |
| Is there one migration deployment gate? | **YES** — §14, with an advisory lock |
| Are migrations executed in Stage 21? | **NO** |
| Is the exact Stage 22 migration order designed here? | **NO** |
| Is the pool bounded? | **YES, in the target** — DEP-D024, with the formula at DEP-D025 |
| Can scoped RLS reads fall back to unsafe Neon HTTP? | **NO** — DEP-D022; the request fails instead |
| Is SES target `eu-west-2`? | **YES** — and **production access there is a per-region preflight**, E-10 · PFL-012 |
| Is Resend removed now? | **NO** — §23 designs the boundary; Stage 22 cuts over |
| Is S3 target `eu-west-2`? | **YES** — §19, §20 |
| Can unscanned objects be served? | **NO** — OPSQ-1 = A, DEP-D048 |
| Is GuardDuty in `eu-west-2` proven? | **NOT PROVEN — and the evidence is materially stronger.** E-11 + E-12 support it; **DEP-D053's EICAR test in staging is the hard gate**, and PRV-005 moves to SELECT · PROVISIONING VERIFICATION REQUIRED |
| Does the document claim an impossible S3 configuration? | **NO — corrected.** Account-level BPA does not have per-bucket overrides; the public bucket is a separate bucket whose **contents policy** is the control — DEP-D049 · DEP-D152 |
| Do the four private classes block public access completely? | **YES** — all four BPA controls, bucket-owner-enforced, no ACLs |
| Is an unguessable object key treated as authorisation? | **NO** — DEP-D050 · DEP-P20; a policy error is a security failure regardless |
| Is CloudFront introduced here? | **NO** — an all-private design needs a Stage 17 amendment, DEP-D153 |
| Does the Vercel runtime hold a long-lived AWS key? | **NO — OIDC → STS, short-lived** — DEP-D154 |
| Can preview or staging assume the production AWS role? | **NO** — the trust policy names team, project AND environment; **PFL-021 asserts the refusal** |
| Are AWS environments separated by account? | **YES — production and non-production** — DEP-D046 |
| Is an IaC technology selected? | **YES — AWS CDK, TypeScript, AWS scope only** — DEP-D136. No second IaC tool |
| Is a custom database CA bundle mandatory? | **NO — verification is the requirement; the CA is one means** — DEP-D042. SECENV-018 is a trust configuration |
| Is the cron adapter's API identifier minted? | **YES — API-283, by A14-001**, recorded in `API_CONTRACT.md` |
| Does the adapter contain business logic or a loopback POST? | **NO** — DEP-D159 |
| Is `/api/cron/run` the permanent target? | **NO** — DEP-D158; it is replaced by the API-283 / API-278 pair |
| Is the Sentry EU region explicit before account creation? | **YES** — DEP-D062, **because E-13 makes it irreversible** |
| Are provider secrets in Git? | **NO** — DEP-P8, and **MIG-000's class C is why §11 exists** |
| Can public custom domains receive auth cookies? | **NO** — DEP-D080's `__Host-` scoping |
| Are backups defined? | **YES** — §30, with the capability recorded rather than assumed |
| Is restore testing defined? | **YES** — §31 |
| Does a backup count as verified without a restore? | **NO** — DEP-P11 · REL-G012 |
| Can engineering tests alone clear production? | **NO** — **one green run satisfies 2 of 18 gates**, DEP-D141 |
| Is a manual WCAG assessment a release gate? | **YES** — REL-G014, owner decision 2A |
| Is an independent penetration test a release gate? | **YES** — REL-G015 |
| Does Stage 21 claim UK GDPR compliance? | **NO** — DEP-D110; technical evidence for legal assessment |
| Does Stage 21 begin legacy deletion? | **NO** |
| Does Stage 21 implement target code? | **NO** |
| Does Stage 21 create provider resources? | **NO** |
| Does Stage 21 deploy? | **NO** |
| Is Stage 22 begun? | **NO** |
---

## 59. Diagrams

**AZ-2 · Environment isolation — local, CI, staging, production**

```
  ENV-001 LOCAL          ENV-002 CI             ENV-003 STAGING      ENV-004 PRODUCTION
  ─────────────          ──────────             ─────────────        ──────────────────
  developer machine      ephemeral runner       Vercel project       Vercel project
  local PostgreSQL       ephemeral PG 16        Neon (eu-west-2)     Neon (region PFL-004)
  no providers           NO PROVIDERS           staging AWS/SES/S3   prod AWS/SES/S3
  dev secrets            CI-ONLY secrets        staging secrets      PROD secrets
  synthetic data         disposable data        SYNTHETIC / UAT-safe REAL PUPIL DATA
        │                      │                       │                    │
        └──────────────────────┴───────────────────────┴────────────────────┘
                                        ║
                     NO CREDENTIAL CROSSES ANY OF THESE LINES.
        A CI bug, a staging mistake or a compromised preview CANNOT reach ENV-004,
        because the credential does not exist in that environment.        DEP-D004
```

**AZ-3 · Git → CI → staging → production**

```
 commit ─► PR ─► ① STATIC · SMOKE · UNIT · DB/INTEGRATION · CONTRACT · BUILD · axe
                    │  no production secret is available here            DEP-D099
                    ▼
                 MERGE (protected branch, required checks)              DEP-D109
                    ▼
            STAGING DEPLOYMENT ─► ② MIGRATIONS · E2E · PROVIDER SMOKE · a11y
                    ▼
            RELEASE CANDIDATE  (an identified, immutable commit)
                    ▼
            ③ PRODUCTION ELIGIBILITY — REL-G001 … REL-G018
                    │   automated gates  +  EVIDENCE gates  +  LEGAL gate
                    ▼
            MIGRATION GATE (§14) ─► DEPLOY ─► POST-DEPLOY VERIFICATION
```

**AZ-4 · Vercel → application → Neon, and where RLS lives**

```
   request
      │
      ▼
  VERCEL FUNCTION  (region: UK/EU target — DEP-F01 · PFL-002)
      │  api/index.ts → createApp({serverless:true})           DEP-D005
      ▼
  BOUNDED POOL  max small · connectionTimeout · idleTimeout     DEP-D024
      │           statement_timeout · idle_in_transaction_timeout
      ▼
  DBROLE-2  APPLICATION      no superuser · NO BYPASSRLS · NOT the owner
      │
      ▼
  BEGIN ─► SET LOCAL <tenant context> ─► query ─► COMMIT/ROLLBACK   A13-001
      │
      ▼
  NEON PostgreSQL   RLS policies + FORCE ROW LEVEL SECURITY        DEP-D015

  ╳  NO FALLBACK TO THE NEON HTTP DRIVER FOR A SCOPED READ.
     If a transaction cannot be opened, THE REQUEST FAILS.          DEP-D022
```

**AZ-5 · Migration role versus application role**

```
   ┌──────────────────────────┐          ┌──────────────────────────┐
   │  DBROLE-1  MIGRATION     │          │  DBROLE-2  APPLICATION   │
   │  CREATE · ALTER · DROP   │          │  SELECT/INSERT/UPDATE/   │
   │  OWNS the tables         │          │  DELETE · SET LOCAL      │
   └────────────┬─────────────┘          └────────────┬─────────────┘
                │                                     │
   used ONLY by │                        used ONLY by │
   THE MIGRATION GATE (§14)                THE VERCEL RUNTIME
                │                                     │
   SECENV-003 ──┘                                     └── SECENV-002
   NEVER present in any function environment           DEP-D016

   Because DBROLE-1 owns the tables and DBROLE-2 does not,
   DBROLE-2 cannot bypass RLS by ownership.  FORCE RLS is the second lock.
```

**AZ-6 · MIG-000 provisioning split**

```
        001_console_hardening.sql   ── one file today, run by hand
                     │
      ┌──────────┬───┴────┬─────────────┐
      ▼          ▼        ▼             ▼
   A SCHEMA   B ROLES   C SECRETS    D LEGACY
   console    CREATE    two          superseded
   schema     ROLE      REPLACE_ME   statements
   + views    GRANT     passwords
      │          │        │             │
      ▼          ▼        ▼             ▼
  STAGE 22   STAGE 21   §17 STORE    STAGE 22
  migration  operator   generated    removal
  chain      runbook    per env
                        NEVER IN GIT             DEP-D018 · DEP-D019
```

**AZ-7 · S3 object classes and the scanner path**

```
   upload ─► PENDING / UNSCANNED  ── viewable by NOBODY        OPSQ-1 = A
                    │
                    ▼
          GuardDuty Malware Protection for S3  (eu-west-2)
                    │                            PFL-010 · DEP-D053
        ┌───────────┴───────────┐
        ▼                       ▼
     CLEAN                  MALWARE
        │                       │
        ▼                       ▼
  PRIVATE OPERATIONAL      QUARANTINED  ── operator only
  signed short-lived URL
  after an authority check
        │
        └─► on CMS publish ─► PUBLIC PUBLISHED  ── the ONE deliberate public path

   SEPARATE BUCKET, NEVER A PREFIX:  LEGACY SNAPSHOT QUARANTINE   §43 · A19-001
```

**AZ-8 · SES email path**

```
  I-2 transaction ─► notifications (DBT-053)   THE FACT — commits with the business act
                          │                     ── a provider outage never rolls this back
                          ▼
                    job runner (§27)
                          ▼
                    SES eu-west-2   verified identity · SPF · DKIM · DMARC
                    "<School Name> via ScholarShelf"          INTQ-2 = C
                          ▼
                    delivery_attempts (DBT-054)   THE ATTEMPT
                          ▼
             bounce / complaint ─► email_suppressions (DBT-078)   A15-002
                                   ── suppresses an ADDRESS
                                   ── does NOT mark an identity unverified
```

**AZ-9 · Sentry telemetry path**

```
  server error ─► before-send filter (OURS)  ─┐
  browser error ─► before-send filter (OURS) ─┤  strips: credentials · tokens ·
                                              │  child records · payment refs ·
                                              │  message bodies · import rows
                                              ▼
                                    Sentry server-side scrubbing
                                              ▼
                              SENTRY ORG — EU REGION (Frankfurt)
                              ── IRREVERSIBLE CHOICE  E-13 · PFL-013
                              projects: server | browser
                              environments: production | staging

  SENTRY IS NEVER LOAD-BEARING — not inside a transaction, not at boot.  DEP-D065
```

**AZ-10 · Cron → job runner → PostgreSQL, and where C-106 sits**

```
  Vercel Cron ──GET──►  PLATFORM TRIGGER ROUTE          ← C-106's resolution
   (E-1: GET only)      auth: CRON_SECRET (timing-safe)   A14-001 REQUIRED
   UTC always (E-2)     corroboration: vercel-cron/1.0 UA
                                       x-vercel-cron-schedule
                              │  no business logic, no parameters
                              ▼
                     API-278  POST /api/internal/jobs/run
                     CAP-093 · SC-10 · CONTRACT UNCHANGED
                              ▼
                     DBT-069 jobs · claim · FOR UPDATE SKIP LOCKED
                     fairness ordering · DRAIN_BUDGET_MS · resumable
                              ▼
                     "the run did not happen" IS AN ALERT      DEP-D070
```

**AZ-11 · Public domains versus the authenticated cookie**

```
  CLASS 1  app.scholarshelf domain      ──►  __Host- cookie ISSUED HERE, ONLY
                                             Secure · Path=/ · NO Domain attribute
                                             ── the prefix makes parent/subdomain
                                                scoping IMPOSSIBLE      DEP-D080
  ─────────────────────────────────────────────────────────────────────────────
  CLASS 3  <school>.scholarshelf        ──►  PUBLIC SITE ONLY, no session
  CLASS 4  a SCHOOL-CONTROLLED domain   ──►  PUBLIC SITE ONLY, no session
                                             ── a host the school controls can
                                                never receive the authenticated
                                                cookie, structurally
  CLASS 5  the SES sending domain       ──►  email only, ScholarShelf-controlled
```

**AZ-12 · Backup → isolated restore rehearsal**

```
  PRODUCTION ─► Neon backup / PITR (capability recorded, not assumed)  DEP-D084
                        │
                        ▼
        ISOLATED RESTORE ENVIRONMENT      named operators · access logged ·
        ── NOT CI  ── NOT a laptop        network-isolated · destroyed after
        ── NOT ordinary staging           LEGAL/PRIVACY APPROVED    DEP-D087
                        │
                        ▼
        VERIFY   opens · migration version · ROW RECONCILIATION ·
                 RLS STILL ENFORCED · auth safe · object refs ·
                 money sums · custody chains                       DEP-D086

  MOST rehearsals use SYNTHETIC data and prove the mechanism.        DEP-D088
  A backup that has not been restored is not a backup.               DEP-P11
```

**AZ-13 · Deployment rollback and forward repair**

```
                     candidate requires SCHEMA VERSION n
                     database is at SCHEMA VERSION m
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
        n COMPATIBLE WITH m              n INCOMPATIBLE WITH m
                │                               │
                ▼                               ▼
        APPLICATION ROLLBACK            THE GATE REFUSES        DEP-D093
        previous known-good             ── "just roll back" is not available
        fast · safe · routine           ── forward repair, or §32's
                                           corruption runbook

   EXPAND → MIGRATE → CONTRACT makes the compatible window wide:
   Stage 15's steps are ADDITIVE until MIG-13; MIG-14 is the one
   irreversible step, separated by a soak and owner approval.        DEP-D094
```

**AZ-14 · The release-gate funnel**

```
   every commit        ───►  ① automated PR gates            REL-G005 · G013
                                    │
   eligible commit     ───►  ② staging gates                 REL-G003 · G004 · G009
                                    │
   release candidate   ───►  ③ EVIDENCE gates
                                 manual WCAG assessment      REL-G014   ← 2A
                                 penetration test + re-test  REL-G015
                                 backup + RESTORE rehearsal  REL-G011 · G012
                                 GuardDuty proven            REL-G010
                                 UAT · pilot                 REL-G016 · G017
                                    │
                            ④ LEGAL / COMPLIANCE APPROVAL    REL-G018
                                 17 Critical · 52 High · 0% clearance
                                    │
                                    ▼
                              PRODUCTION

   ONE GREEN CI RUN SATISFIES 2 OF 18.   NO GATE IS MARKED PASS HERE.
                                                        DEP-D140 · DEP-D141
```

**AZ-15 · The Stage 21 → Stage 22 boundary**

```
  ┌─────────────────── STAGE 21 · THIS DOCUMENT ───────────────────┐
  │  environments · provider resource models · database ROLES      │
  │  MIG-000 class B provisioning · secrets · env validation       │
  │  the MIGRATION GATE (how) · CI/CD gates · promotion model      │
  │  backup + restore mechanisms · preflights · release gates      │
  └───────────────────────────┬────────────────────────────────────┘
                              │  hands over: ground to run on
                              ▼
  ┌─────────────────── STAGE 22 · NOT BEGUN ───────────────────────┐
  │  the TARGET MIGRATION CHAIN (what) · MIG-000 class A           │
  │  legacy snapshot QUARANTINE MIGRATION      A19-001 · MIG-T07   │
  │  LEGACY ROUTE CUTOVER REGISTER             Stage 20 TST-D080   │
  │  code move register · backfill · cutover order                 │
  │  Resend → SES provider cutover · compatibility shims           │
  │  legacy removal · batch implementation sequence                │
  └────────────────────────────────────────────────────────────────┘

  ALSO HANDED OUT:  A14-001 → STAGE 14      C-105's amendment → STAGE 5
                    a Neon region migration → STAGE 22, IF PFL-004 fails
```

---
---

## 60. What Stage 21 deliberately does not do

```
create any AWS resource · SES identity · S3 bucket · GuardDuty detector
create a Sentry organisation                       ── DEP-D062 gates it first
create or alter a Neon project or database role
change any Vercel setting                          ── including the function region
edit .github/workflows/ci.yml                      ── §15 is a design
install any package · modify package.json          ── including `engines`
write any test                                     ── Stage 20 designed them
run any migration · create any table · grant any privilege
rotate, create or read any secret
move any data · change any provider configuration
delete any legacy route, screen or dependency      ── STAGE 22
perform target extraction                          ── STAGE 22
deploy anything · touch production
mark any release gate PASS                         ── DEP-D140
```

**No AWS resource, SES identity, S3 bucket, GuardDuty detector, Sentry organisation, Neon project,
database role, secret, Vercel setting, workflow file, package, test, migration or production record was
created, changed, read, rotated, moved or deleted.**

**No provider was configured. No provisioning was performed. No infrastructure was changed. No test was
written. No migration was executed. Nothing was deployed. No code has changed.**

**The only files written by this finalisation are architecture documents: this one, and the amendment
registers of `API_CONTRACT.md` (A14-001, API-283), `BUSINESS_RULES.md` (A4-001) and `TEST_STRATEGY.md`
(A20-001, A20-002).**

**The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14
domains, 0% clearance — stands in full.** The baseline remains **UNVERIFIED**, capped at **E2**.

```
STAGE 21 — DEPLOYMENT & PRODUCTION ARCHITECTURE
STATUS: LOCKED — 1 September 2026 by the owner (BytHub Technology Ltd)

OWNER DECISIONS APPLIED
   DEPQ-1 = A   Vercel Pro · separate staging and production projects ·
                production application functions in lhr1 (London)
                Neon Scale · separate staging and production projects ·
                both eu-west-2 (London)
   DEPQ-2 = A   https://app.scholarshelf.co.uk      production app origin
                https://staging.scholarshelf.co.uk  staging app origin
                root / www NOT auth authorities · previews canonical for nothing

Open owner questions: 0

IDENTIFIER COUNTS AT LOCK
   DEP-P 20 · DEP-D 160 · DEP-F 18 · DEP-R 23
   ENV 4 · DBROLE 6 · SECENV 18 · PFL 21 · REL-G 18
   Sections 60 · diagrams AZ-1 … AZ-15

AMENDMENTS RECORDED ELSEWHERE BY THIS FINALISATION
   A14-001 + API-283   API_CONTRACT.md    the scheduler transport adapter
   A4-001              BUSINESS_RULES.md  BR-095 reconciled with OPS-D021
   A20-001 · A20-002   TEST_STRATEGY.md   the Stage 5 → Stage 4 correction

CONFLICT STATES AT LOCK — NONE CLOSED
   C-106  TARGET RESOLUTION ESTABLISHED / IMPLEMENTATION OPEN
   C-105  TARGET SPECIFICATION RESOLVED — implementation remains C-26
   C-104  TARGET POLICY RESOLVED / IMPLEMENTATION AND EVIDENCE OPEN
   C-19 · C-26 · C-63 · C-78 · C-90 · C-100 … C-103   ALL OPEN
   The next stage starts at C-107.

PRESERVED IN FULL BY THIS LOCK
   actual provider resources UNVERIFIED until provisioned   PFL-002 … PFL-006
   the pooled-endpoint transaction-semantics gate           PFL-020
   the OIDC trust-policy refusal gate                       PFL-021
   the GuardDuty staging EICAR verification gate            PFL-010
   the SES eu-west-2 production-access gate                 PFL-012
   the Neon actual region / project check                   PFL-004
   the manual WCAG 2.2 AA assessment gate                   REL-G014
   the independent penetration-test gate                    REL-G015
   the LEGAL & COMPLIANCE GO-LIVE BLOCK                     REL-G018

WHAT THIS LOCK DOES NOT MEAN
   infrastructure exists        the application is secure
   tests pass                   providers are configured
   the baseline is verified     production is ready
   ── the baseline remains UNVERIFIED, capped at E2
   ── 17 Critical · 52 High · 14 domains · 0% clearance — UNCHANGED
```
