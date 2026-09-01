# IMPLEMENTATION_MASTER_PLAN.md
# ScholarShelf — Execution Control Document

```
IMPLEMENTATION MASTER PLAN
STATUS: **APPROVED FOR EXECUTION**
Approved: 1 September 2026 by the owner (BytHub Technology Ltd)
Written: 1 September 2026 · corrected and approved the same day

THIS IS NOT AN ARCHITECTURE STAGE.
There is no Stage 23.  Stage 22 was the final architecture stage and it
is LOCKED.  This document is the EXECUTION CONTROL DOCUMENT derived from
Stages 1–22.

IT IMPLEMENTS NOTHING.
No application code was written.  No package was installed.  No test was
executed.  No migration was run.  No infrastructure was changed.  No data
was copied.  No Git lock was touched.  No commit, push, tag or branch.
Nothing was deployed.

OWNER DECISIONS RECORDED HERE
   MIGQ-1 = A    scheduled write-freeze window
   C-107  = A    wipe-school -> API-247 request-deletion  (A14-003)
OPEN OWNER QUESTIONS: 0

THE PLANNING PHASE IS COMPLETE.
   Stages 1-22:                  LOCKED
   Implementation Master Plan:   APPROVED FOR EXECUTION

MP-B01 — BASELINE FREEZE — STARTED 1 SEPTEMBER 2026.
Execution evidence: MP_B01_BASELINE_EVIDENCE.md.
MP-B01 HAS NOT BEEN STARTED.

THIS APPROVAL DOES NOT MEAN
   MP-B01 has started . baseline commands ran . tests pass
   Git locks were touched . a commit was made . a branch or tag exists
   code changed . packages changed . migrations ran
   providers were configured . infrastructure exists . data moved
   production is ready . Legal & Compliance approved go-live
```

**Governed by** Stages 1–22, **all LOCKED**, including **every** amendment register — **seventeen
amendments**, and none is omitted because it was raised after this document's first draft:

```
A4-001    Stage 4    import granularity                       C-105
A7-001    Stage 7    audit-required count 58 -> 67            C-103
A11-001   Stage 11   provider CURRENT/LEGACY
A13-001   Stage 13   which driver RLS reads use
A14-001   Stage 14   the scheduler transport adapter, API-283 C-106
A14-002   Stage 14   the import commit is API-170             typo
A14-003   Stage 14   wipe-school -> API-247                    C-107
A15-001   Stage 15   schema
A15-002   Stage 15   schema
A15-003   Stage 15   DBT-079 / DBT-080, tables 76 -> 80
A16-001   Stage 16   security
A16-002   Stage 16   retention / policy
A17-001   Stage 17   providers
A19-001   Stage 19   legacy snapshot quarantine               decision 1A
A20-001   Stage 20   the Stage 5 -> Stage 4 correction
A20-002   Stage 20   test strategy
A22-001   Stage 22   C-107's resolution + the post-lock factual reconciliation
```

**Owner decisions in force:** AQ-1 = B · APIQ-1 = A · SECQ-1 = B · SECQ-2 = A · INTQ-1 = A ·
INTQ-2 = C · INTQ-3 = A · OPSQ-1 = A · **1A** · **2A** · **DEPQ-1 = A** · **DEPQ-2 = A** ·
**MIGQ-1 = A** · **C-107 = A**.

---

## 1. What this document is, and the one question it answers

> **Exactly how does Claude turn the locked ScholarShelf architecture into working code, one
> reviewable batch at a time, while proving that each batch preserved the existing behaviour it was
> supposed to preserve?**

**It converts registers into checklists. That is the whole job.**

```
IN            OUT
IMP-B01…B35   MP-B01 … MP-B35, one section each, ONE-TO-ONE, all A–T
              resolved.  THERE IS NO MP-B00
CSR-001…059   a FILE PLAN per batch, with removal proofs attached
              -- 59 units: KEEP 19 · MOVE 8 · REFACTOR 6 · REPLACE 16 ·
                 BRIDGE 0 · REMOVE 8 · TRIAGE/PORT 2   (A22-001 §4)
LRC-001…234   the route cutover execution matrix                    §9
CBR-001…015   the non-route bridge matrix                          §10
SCR-C001…042  the screen work inside each batch
DEP-C001…023  dependency changes, per batch
DEP-I001…099  the exact package accounting
DMR-001…027   the database execution matrix                        §11
MIG-01…14     sequenced, gated
C-*           the conflict closure matrix                           §7
TST/INV/TEN/SEC/MIG/E2E   the test activation matrix                §8
release gates the manual gates it CARRIES but does not satisfy      §17
```

**MP-P0 · What this document MAY do**

```
ADD TASK GRANULARITY INSIDE A LOCKED BATCH.
   ── name the files, the order within the batch, the commit boundaries,
      the review checklist, the evidence to record
```

**MP-P0.1 · What this document MAY NOT do**

```
REDESIGN THE ARCHITECTURE        CHANGE MODULE OWNERSHIP
CHANGE ANY API CONTRACT          CHANGE ANY SCHEMA DECISION
INVENT NEW PRODUCT BEHAVIOUR     SILENTLY REORDER A SAFETY DEPENDENCY

IF EXECUTION EVIDENCE LATER PROVES A LOCKED DECISION IMPOSSIBLE:
   STOP
   → raise a TRACEABLE ARCHITECTURE AMENDMENT
   → obtain OWNER REVIEW
   → THEN continue

DO NOT WORK AROUND LOCKED ARCHITECTURE SILENTLY.
   ── a workaround that is never written down becomes the architecture,
      and nobody decided it
```

---

## 2. The twelve principles — IMP-P1 … IMP-P12

| | |
|---|---|
| **IMP-P1** | **ONE BATCH AT A TIME.** Not two in flight, not a "small extra fix" riding along |
| **IMP-P2** | **RED → IMPLEMENT → GREEN → REVIEW → MERGE.** In that order, every time |
| **IMP-P3** | **REPLACEMENT BEFORE REMOVAL.** Nothing is deleted before the thing that replaces it exists and is proved |
| **IMP-P4** | **NO OLD PATH IS REMOVED UNTIL ITS CALLERS ARE PROVED SWITCHED.** Proved by search, not by belief |
| **IMP-P5** | **DATABASE DESTRUCTION IS A DIFFERENT GATE FROM CODE DELETION.** Code lives in Git. Data does not |
| **IMP-P6** | **NO SECURITY CONFLICT CLOSES WITHOUT EVIDENCE.** A green build is not evidence |
| **IMP-P7** | **NO TENANT BOUNDARY CHANGE MERGES WITHOUT REAL-POSTGRES TESTS.** Not mocked, not in-memory |
| **IMP-P8** | **NO I-2 CHANGE MERGES WITHOUT ATOMICITY + CONCURRENCY TESTS.** Both, not either |
| **IMP-P9** | **NO PROVIDER CUTOVER OCCURS IN A NORMAL CODE-REFACTOR BATCH.** Providers get their own batches and their own rollback boundaries |
| **IMP-P10** | **EVERY BATCH HAS A ROLLBACK / FORWARD-REPAIR PLAN BEFORE IT STARTS.** Written before, not during |
| **IMP-P11** | **A FAILED BATCH STOPS THE SEQUENCE.** It does not become a parallel branch |
| **IMP-P12** | **THE MASTER PLAN NEVER USES "FIX LATER" AS A SUCCESS CONDITION.** There is no batch whose exit criterion is a promise |

**MP-P1 · The three sentences that are forbidden in a merge review**

```
"the test is flaky, merge it"
"we will tighten the capability check in a later batch"
"the old route has no callers, probably"

── each of them has a defined replacement:
     demonstrate the flake or fix it        IMP-P2
     the batch is not done                  IMP-P12
     run the eleven-check proof             Stage 22 §40
```

---

## 3. MP-B01's baseline-freeze checklist

**There is no MP-B00. Stage 22's IMP-B01 is Master Plan MP-B01, and this is its content.** The batch
card is in §5; the exact future actions are here, referenced from **MP-B01 · field F and field M**.

**MP-P2 · Every result in this section is `NOT RUN`. None is fabricated.**

| # | Step | Exact command / action | Result |
|---|---|---|---|
| **1** | inspect stale `.git` locks | `Get-ChildItem C:\dev\scholarshelf\.git -Filter *.lock -Recurse` — then, for each, prove **no process owns it** (`Get-Process git`; compare the lock's mtime against any running operation) | **PASS — two zero-byte stale locks, no Git process** |
| **2** | remove **only proved-stale** locks | delete a lock **only** after step 1 proves no process holds it. **A lock held by a running process is not stale, and deleting it corrupts the repository** | **PASS — only the two proved-stale locks removed** |
| **3** | repository maintenance, if safe | `git gc` — **only after step 2, and only if step 1 found no live operation** | **OWNER-WAIVED — pruning risk outweighed maintenance benefit** |
| **4a** | typecheck | `npm run check` *(`tsc`)* | **PASS** |
| **4b** | smoke | `npm run test:smoke` *(`tsx script/smoke-boot.ts`)* | **PASS** |
| **4c** | build | `npm run build` *(`tsx script/build.ts`)* | **PASS WITH EXISTING CHUNK-SIZE WARNING** |
| **4d** | custody unit test | `npm run test:custody` *(`tsx tests/custody-machine.ts`)* | **PASS — 36/36** |
| **4e** | the full current suite | `npm test` — smoke · custody · stock · payments · security · tenant · family · staff · teacher · import · verification · superuser | **FAIL — PRE-EXISTING tenant fixture/orchestration defect; 336 observed passing assertions, one failed probe** |
| **5** | record exact output | **verbatim**, per command: stdout, stderr, exit code, timestamp, Node version, OS. **Native Windows — not WSL, not a container** | **RECORDED — `MP_B01_BASELINE_EVIDENCE.md` and Codex task output** |
| **6** | classify every failure | each failure marked **PRE-EXISTING**, against its command. **A pre-existing failure is a baseline FACT, not a defect introduced by the rebuild** | **RECORDED — BF-001 … BF-004** |
| **7** | commit the architecture documents | the Stage 1–22 documents and this plan, as documents. **No application file is touched by this commit** | **NOT RUN** |
| **8** | push the restructure branch | `git push -u origin restructure/aug-2026` | **NOT RUN** |
| **9** | create the immutable baseline tag | an annotated tag on the pushed commit, its message carrying the step-5 evidence summary | **NOT RUN** |
| **10** | create the implementation branch | branched from the tag | **NOT RUN** |

**MP-P3 · Why MP-B01 is not ceremony, stated because it will be tempting to skip**

```
WITHOUT A RECORDED BASELINE, EVERY LATER FAILURE IS ARGUABLY A REGRESSION
AND THE ARGUMENT CANNOT BE SETTLED.

   the baseline is currently UNVERIFIED, capped at E2
   -- E2 means "code read and confirmed".  It does NOT mean the suite passes
   -- step 4 is the FIRST AND ONLY execution step in this entire plan that
      can move the evidence past that ceiling
   -- and it must run NATIVELY ON WINDOWS, because that is the owner's
      environment; a container result would prove something else

UNTIL STEP 5 IS RECORDED, THIS PLAN HAS NO FLOOR.
```

**MP-P4 · Nothing in MP-B01 changes application behaviour.** It reads, records, commits documents,
pushes, tags and branches. **If step 4 reveals failures, they are recorded and the sequence
continues** — MP-B01's deliverable is the **evidence**, not a green suite.

**MP-P4.1 · Do NOT say, before or during MP-B01:**

```
"the tests pass"
"the current application has been runtime verified"

   -- BASELINE REMAINS UNVERIFIED / E2 UNTIL STEP 5 IS RECORDED
```

---

## 4. The batch template — A … T, identical for every MP-B

**Every batch section below uses this template. A batch that cannot fill a field says so; it does not
omit the field.**

| | Field | What it holds |
|---|---|---|
| **A** | **PURPOSE** | one sentence |
| **B** | **LOCKED AUTHORITIES** | exact Stage and decision identifiers |
| **C** | **PRECONDITIONS** | what must already be green or proven |
| **D** | **CURRENT EVIDENCE** | files, symbols, routes, tables known today |
| **E** | **TARGET RESULT** | what exists when the batch succeeds |
| **F** | **FILE PLAN** | exact current files expected to be read · created · modified · moved · removed. **Every removal entry carries its proof gate** |
| **G** | **DATABASE WORK** | migration IDs · tables · constraints · RLS · backfills · transactional and re-runnable status |
| **H** | **API WORK** | API-nnn built · LRC bridged · consumer switch · removal gate |
| **I** | **UI WORK** | UX / SCR-C · **query-state adoption** · accessibility requirements |
| **J** | **DEPENDENCIES** | add · upgrade · remove · keep, by exact package |
| **K** | **SECURITY** | SECAR / SEC-F / SEC-T · the threat controlled |
| **L** | **TEST ACTIVATION** | which tests leave DEFINED · red demonstration where appropriate · green requirement |
| **M** | **MANUAL VERIFICATION** | only what automation cannot prove |
| **N** | **CONFLICT EFFECT** | which C-* moves state, and the exact evidence needed |
| **O** | **OBSERVABILITY** | logs, correlation, metrics needed to diagnose this batch |
| **P** | **ROLLBACK / FORWARD REPAIR** | written **before merge**, not during an incident |
| **Q** | **MERGE GATE** | a binary checklist |
| **R** | **POST-MERGE SOAK** | where required |
| **S** | **REMOVAL ELIGIBILITY** | what old path becomes removable, and what still does not |
| **T** | **EVIDENCE RECORD** | commands · result · date · commit · reviewer · environment |

**MP-P5 · Field T is the ONLY field filled at execution time.** Every T in §5 reads **`NOT RUN`**, and
so does the RESULT of every named manual action. **A pre-filled evidence record would be a
fabrication.** Every other field — **A through S, including F, P and Q** — is resolved before this
document is approved.

**MP-P5.1 · Where a field is governed by a central matrix, the batch card names the matrix EXACTLY**

```
PERMITTED     "H · API WORK ... LRC built here: LRC-018 ... LRC-047 (17), §9"
              -- an exact, immutable reference to a named register and the
                 section that holds it

NOT PERMITTED "see the matrices later"
              "filled during execution"
              "Claude decides when implementing"

THE CENTRAL MATRICES ARE:
   §7   conflict closure          IMP-C001 ... IMP-C022
   §8   test activation           by family, environment and blocking status
   §9   route cutover execution   LRC-001 ... LRC-234, and B-34's 13 waves
   §10  non-route bridges         CBR-001 ... CBR-015
   §11  database execution        DMR-001 ... DMR-027, MIG-01 ... MIG-14
   §6   screens and dependencies  SCR-C001 ... SCR-C042, DEP-C001 ... DEP-C023
   Stage 22 §10 holds each LRC's own method, path, file, caller, target,
   build/switch/removal batch and removal gate -- per row
```

---
## 5. MP-B01 … MP-B35 — the batch sequence, fully planned

**One MP-B per IMP-B, mapped one-to-one against Stage 22 §35's LOCKED register.**

```
MP-Bnn  <->  IMP-Bnn        for every nn from 01 to 35.  No exceptions,
                            no merges, no splits, no reordering, and
                            NO MP-B00

THERE IS NO "BACKEND REFACTOR" BATCH.
THERE IS NO "FRONTEND CLEANUP" BATCH.
THERE IS NO "SECURITY FIXES" BATCH.
   -- each would be unreviewable, which is why the register has 35 entries
```

**MP-P6 · Every field A–T below is RESOLVED. Only RESULTS remain unrun.**

```
RESOLVED BEFORE APPROVAL       A B C D E F G H I J K L M N O P Q R S
                               -- purpose, authority, preconditions,
                                  evidence, target, FILE PLAN, database,
                                  API, UI, dependencies, security, tests,
                                  manual actions, conflict effect,
                                  observability, ROLLBACK, MERGE GATE,
                                  soak, removal eligibility

UNRUN BEFORE EXECUTION         T  -- the evidence record
                               and the RESULT of each named manual action

   "SEE MATRICES LATER" IS NOT A PLAN.
   "FILL DURING EXECUTION" IS NOT A PLAN.
   "CLAUDE DECIDES WHEN IMPLEMENTING" IS NOT A PLAN.

EXECUTION FILLS RESULTS.  EXECUTION DOES NOT INVENT THE PLAN.
```

**MP-P6.1 · What a batch does when the repository contradicts its file plan**

```
IF IMPLEMENTATION EVIDENCE REQUIRES TOUCHING AN UNLISTED SIGNIFICANT FILE:

   STOP THE BATCH
   -> RECORD WHY, against the batch
   -> UPDATE THE MASTER PLAN and have the change reviewed
   -> OR, if a MODULE BOUNDARY or a LOCKED DECISION changed,
      RAISE A TRACEABLE ARCHITECTURE AMENDMENT and obtain owner review

   -- the file plan is a PLAN, not a prophecy.  It may be wrong.
   -- what it may NOT do is be silently exceeded
   -- "significant" means: a new module, a new route file, a locked
      contract, a schema file, a security control, or CI
```

### MP-B01

| | |
|---|---|
| **A · PURPOSE** | Record the baseline so that every later failure can be argued about with evidence rather than memory. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B01** · TXD-002 · §5's freeze |
| **C · PRECONDITIONS** | **Master Plan APPROVED** · the architecture documents available · the repository located at `C:\dev\scholarshelf` · **no implementation batch already in progress** |
| **D · CURRENT EVIDENCE** | execution found two stale zero-byte `*.lock` files and no running Git process · `package.json`'s 12 test scripts · branch `restructure/aug-2026` · 11 hand-rolled suites, no framework |
| **E · TARGET RESULT** | A recorded, immutable baseline: exact command output for five commands, every failure classified PRE-EXISTING, the architecture documents committed, the branch pushed, an annotated tag, and an implementation branch cut from it. |
| **F · FILE PLAN — read** | `package.json` · `script/build.ts` · `script/smoke-boot.ts` · `tests/**` · `.git/**` lock inspection |
| **F · FILE PLAN — create** | the baseline evidence record (a document, committed) · the annotated tag · the implementation branch |
| **F · FILE PLAN — modify** | **none — no application file is modified in this batch** |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **only genuinely stale `.git` lock files, and only after proving no process holds one** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none.** No migration, no schema read, no connection required |
| **H · API WORK** | **none built, none removed**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **none installed, none removed, `package.json` NOT edited** |
| **K · SECURITY** | none introduced. **The `.git` lock removal is the only destructive act, and it is gated on proving no process owns the lock** |
| **L · TEST ACTIVATION** | **none activated.** The five commands are RUN AND RECORDED; **they are not required to pass** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **all of it** — the five commands run natively on Windows by the owner or on the owner's machine; each failure read and classified PRE-EXISTING · **RUN 1 SEPTEMBER 2026 — see MP_B01_BASELINE_EVIDENCE.md** |
| **N · CONFLICT EFFECT** | **none moves.** The baseline moves from **E2 toward E3** only for the commands that actually run — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | the evidence record itself: stdout, stderr, exit code, timestamp, Node version, OS, per command |
| **P · ROLLBACK / FORWARD REPAIR** | **nothing to roll back** — no application state changes. If a lock removal proves wrong, the repository is re-cloned from `origin` and the tag re-cut |
| **Q · MERGE GATE** | five command outputs recorded verbatim · every failure classified · documents committed · branch pushed · tag created · implementation branch created |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | **nothing becomes removable** |
| **T · EVIDENCE RECORD** | **IN PROGRESS — native command evidence recorded in `MP_B01_BASELINE_EVIDENCE.md`; documentation commit, push, tag and implementation branch pending** |

### MP-B02

| | |
|---|---|
| **A · PURPOSE** | Provision the two isolated AWS accounts, the OIDC trust, the six database roles and the secret store. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B02** · Stage 21 (DEP-D136 CDK, ENV-001…004, DBROLE-1…6, SECENV-001…018) · DEPQ-1 = A |
| **C · PRECONDITIONS** | MP-B01 merged and its evidence recorded |
| **D · CURRENT EVIDENCE** | no AWS account isolation today · one database role · secrets in platform environment variables |
| **E · TARGET RESULT** | Two AWS accounts (staging, production), GitHub Actions → AWS via **OIDC with no long-lived keys**, six database roles with ownership separated from the application role, the secret store, and MIG-000 class B applied. |
| **F · FILE PLAN — read** | Stage 21 §§ on roles, OIDC and the secret store |
| **F · FILE PLAN — create** | **dev-only** CDK stacks under an `infra/` tree · the six role definitions as MIG-000 class B procedure |
| **F · FILE PLAN — modify** | CI workflow **only to add the OIDC trust** — no build or test change here |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-000 class B** — the role and ownership provisioning procedure. **It is NOT an application-schema migration, and `001_console_hardening.sql` does not become one** |
| **H · API WORK** | **none**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **ADD dev-only:** `aws-cdk-lib` · `constructs` — DEP-C012. **No second infrastructure tool: no Terraform, no OpenTofu** |
| **K · SECURITY** | **OIDC replaces long-lived access keys** · account isolation · ownership separation is what makes FORCE RLS meaningful in B-07 |
| **L · TEST ACTIVATION** | **PFL-007 · PFL-008 · PFL-021** activate. **SEC-T15's RED demonstration begins here** (the roles must exist before the bypass can be shown) — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | AWS account creation and the OIDC trust relationship are console/provisioning acts · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C002 (C-19)** red demonstration begins · **IMP-C011 (C-72/C-73)** provisioning half — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | CloudTrail on both accounts from day one · the role grant listing, captured |
| **P · ROLLBACK / FORWARD REPAIR** | **delete the provisioned resources.** Nothing in the application depends on them yet, which is why this batch is second |
| **Q · MERGE GATE** | two accounts exist and are isolated · OIDC assumes a role with no static key · six roles exist with ownership separated · secrets present · PFL-007/008/021 green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B03

| | |
|---|---|
| **A · PURPOSE** | Make a migration runner the only way schema reaches a database, and take `db:push` out of CI and the deployment path. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B03** · Stage 15 · Stage 21 · **C-78** |
| **C · PRECONDITIONS** | MP-B02 merged; the six roles exist |
| **D · CURRENT EVIDENCE** | `drizzle-kit push` is how schema reaches the database today · `migrations/001…006` exist as raw SQL · **`console_audit` exists only because `001` created it** |
| **E · TARGET RESULT** | A migration runner with a recorded ordering; MIG-01 and MIG-02 applied; MIG-000 class A defined; **a deployment path invoking `db:push` fails the build**. |
| **F · FILE PLAN — read** | `migrations/*.sql` · `drizzle.config.ts` · the deployment configuration |
| **F · FILE PLAN — create** | the migration runner · the MIG-000 class-A record · a CI assertion that fails on `db:push` in a deploy path |
| **F · FILE PLAN — modify** | CI workflow · `package.json` **scripts only** (not dependencies) |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | `db:push` from CI and from the deployment path — **the tool itself stays for local authoring** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-01 · MIG-02**, transactional and re-runnable |
| **H · API WORK** | **none**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **KEEP `drizzle-kit`** — DEP-C not changed; only its INVOCATION moves |
| **K · SECURITY** | **SEC-T15 turns GREEN here** — the console read tier's two bypasses close once the schema half lands on separated roles |
| **L · TEST ACTIVATION** | **MIG-T01 · MIG-T02** activate · **SEC-T15 GREEN after its RED in B-02** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | confirm by inspection that no deployment path can invoke `db:push` · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C013 (C-78) may CLOSE** · **IMP-C002 (C-19) may CLOSE** — only after the red demonstration — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | the runner logs every migration id, its checksum and its duration |
| **P · ROLLBACK / FORWARD REPAIR** | MIG-01/02 are additive and reversible; the runner can be reverted with the branch |
| **Q · MERGE GATE** | MIG-T01 · MIG-T02 green · SEC-T15 red-then-green recorded · a `db:push` in a deploy path fails the build · **CBR-015 removed in this same batch** |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | **CBR-015 removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B04

| | |
|---|---|
| **A · PURPOSE** | Stand up the test infrastructure and the four-stage pipeline, and build the scheduler transport so `vercel.json` can stop pointing at a legacy route. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B04** · Stage 20 (TST-D003/D005/D006) · Stage 21 · **A14-001** · **A22-001 §6** |
| **C · PRECONDITIONS** | MP-B03 merged; the runner is the only schema path |
| **D · CURRENT EVIDENCE** | `vercel.json` cron entry points at `/api/cron/run` · `cron.routes.ts:299–300` registers GET and POST to **one shared handler** · no test framework · Node major asserted in one place only |
| **E · TARGET RESULT** | Vitest, Playwright and axe pinned; a four-stage pipeline; the Node single-authority assertion; **API-283 built as a transport adapter and API-278 built as the runner**; `vercel.json` switched to API-283. |
| **F · FILE PLAN — read** | `vercel.json` · `server/routes/cron.routes.ts` · `package.json` · CI workflow |
| **F · FILE PLAN — create** | `api/internal/jobs/trigger` (**API-283, GET**) · `api/internal/jobs/run` (**API-278, POST**) · the shared job service both call · test config · four CI stages |
| **F · FILE PLAN — modify** | `vercel.json` (the cron path) · CI workflow · `package.json` **scripts** |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **nothing in this batch.** Both `/api/cron/run` handlers stay live until B-05 — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **DMR-024** `cron_job_runs` → DBT-069; **the one-run-per-day invariant must still hold after the two partial uniques replace the NULL-distinct index** |
| **H · API WORK** | **BUILD API-283 (GET transport) and API-278 (POST runner).** **LRC-048 → API-283. LRC-162 → API-278.** **No GET is added to API-278. No loopback HTTP from API-283 to API-278 — both call the same application service.** The Vercel cron header and user-agent are **NOT** authentication<br>**LRC built here:** LRC-048 … LRC-162 (2) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **ADD dev:** `vitest` · `@vitest/browser` · `playwright`/`@playwright/test` · `@axe-core/playwright` (DEP-C014/015/016). **UPGRADE `@types/node` to the Node 24 target** (DEP-C023) |
| **K · SECURITY** | **CAP-093 · SC-10** on both scheduler surfaces. An unpredictable path segment is **defence in depth, NOT authorization** |
| **L · TEST ACTIVATION** | unit · smoke · the activation register itself · **PFL-015 end-to-end in staging** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | switch the Vercel cron configuration and observe one real firing in staging · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C021 (C-106) advances — it does NOT close.** It closes at B-05 when both legacy handlers are gone — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | every job run emits a correlation id; the run-once assertion is observable per `runDate` |
| **P · ROLLBACK / FORWARD REPAIR** | point `vercel.json` back at `/api/cron/run` — **it is still live, which is why removal is a separate batch** |
| **Q · MERGE GATE** | API-283 and API-278 reachable and tested · `vercel.json` switched · **PFL-015 green in staging** · a job fires exactly once · the four pipeline stages run |
| **R · POST-MERGE SOAK** | one full scheduler cycle in staging before B-05 |
| **S · REMOVAL ELIGIBILITY** | **LRC-048 and LRC-162 become ELIGIBLE — they are removed in B-05, not here** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B05

| | |
|---|---|
| **A · PURPOSE** | Create the target schema, empty, with tenant columns backfilled and zero NULLs proved. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B05** · Stage 15 (MIG-03…MIG-06, DBI-*) |
| **C · PRECONDITIONS** | MP-B04 merged; the runner proven; the scheduler soak complete |
| **D · CURRENT EVIDENCE** | 41 `pgTable` declarations in one 1,166-line file · `console_audit` outside it · twelve untenanted tables |
| **E · TARGET RESULT** | The Stage 15 target tables exist and are empty; `school_id` present and backfilled on the twelve untenanted tables; zero NULLs proved. |
| **F · FILE PLAN — read** | `shared/schema.ts` · `migrations/*.sql` |
| **F · FILE PLAN — create** | `shared/schema/` split by module per Stage 15's file map · MIG-03 … MIG-06 |
| **F · FILE PLAN — modify** | `shared/schema.ts` becomes a re-export during the split |
| **F · FILE PLAN — move** | **schema declarations move into `shared/schema/*.ts`** — CSR-054 |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-03 · MIG-04 · MIG-05 · MIG-06**, transactional and re-runnable; **MIG-04 adds `school_id` NULLABLE first**, then backfills, then asserts zero NULLs |
| **H · API WORK** | **none built, none removed**<br>**LRC built here:** — · **LRC removed here:** LRC-048 … LRC-162 (2) — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **the tenant column must be non-null BEFORE B-07 enables RLS — this is FORBIDDEN WINDOW A** |
| **L · TEST ACTIVATION** | **MIG-T02 · MIG-T08** activate — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none beyond reviewing the zero-NULL assertion output · **NOT RUN** |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | per-table row counts before and after, recorded |
| **P · ROLLBACK / FORWARD REPAIR** | the tables are empty and additive; drop them and revert |
| **Q · MERGE GATE** | MIG-03…06 applied · **zero NULLs on every backfilled tenant column** · MIG-T02 · MIG-T08 green · **LRC-048 and LRC-162 removed with their §40 proofs** |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | **LRC-048 · LRC-162 removed** — after B-04's staging proof |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B06

| | |
|---|---|
| **A · PURPOSE** | Build the person/credential/membership identity model and rehash passwords to Argon2id on login. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B06** · Stage 7 · Stage 16 · **DMR-002, the highest-risk transform** |
| **C · PRECONDITIONS** | MP-B05 merged; the target schema exists and is empty |
| **D · CURRENT EVIDENCE** | `users` with a nullable `school_id` and a single `role` · `user_permissions` · `teacher_profiles` · bcryptjs hashes · `storage.ts`'s ~15 user/invite/role methods (CSR-004) |
| **E · TARGET RESULT** | Persons, credentials and school memberships exist and are populated; every user resolves to exactly one person; new and re-verified passwords are Argon2id. |
| **F · FILE PLAN — read** | `server/storage.ts` (CSR-004) · `server/middleware/auth.ts` (CSR-057) · `server/routes/auth.routes.ts` |
| **F · FILE PLAN — create** | `server/modules/identity/data.ts` · the Argon2id credential path |
| **F · FILE PLAN — modify** | `storage.ts` narrows and delegates (**CBR-004**) · auth routes |
| **F · FILE PLAN — move** | the identity persistence methods out of `storage.ts` |
| **F · FILE PLAN — remove** | **nothing** — bcryptjs stays until B-12 — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 identity** · **DMR-002 · DMR-025 · DMR-027** |
| **H · API WORK** | **BUILD API-001 … API-010, API-016, API-017.** **REMOVE the four no-caller duplicates** — `auth/login`, `auth/logout`, `auth/accept-invite`, and the `/api/users` aliases are removed in B-12, not here<br>**LRC built here:** LRC-035 … LRC-152 (7) · **LRC removed here:** — — §9 |
| **I · UI WORK** | `login.tsx` · `accept-invite.tsx` behaviour preserved; **query-state adoption** |
| **J · DEPENDENCIES** | **ADD `argon2`** (DEP-C017). **`bcryptjs` stays** — DEP-C007 removed at B-12 |
| **K · SECURITY** | **Argon2id parameters recorded, not defaulted silently** · rehash-on-login · **CBR-002 is format tolerance, not two authorities** |
| **L · TEST ACTIVATION** | Argon2 suite · rehash suite · identity suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | a bcrypt user signs in on staging and their hash is observed upgraded in that request · **NOT RUN** |
| **N · CONFLICT EFFECT** | none closes. **CBR-002 · CBR-004 · CBR-006 introduced** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | count of remaining bcrypt hashes, reported per run |
| **P · ROLLBACK / FORWARD REPAIR** | the old `users` table is still authoritative and still read; revert the application |
| **Q · MERGE GATE** | **person-count parity · every user resolves to exactly ONE person · credential parity** · Argon2 suite green |
| **R · POST-MERGE SOAK** | one week of sign-ins watched for rehash progress |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B07

| | |
|---|---|
| **A · PURPOSE** | Turn on FORCE row-level security with separated ownership and a SET LOCAL read path. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B07** · Stage 15 · Stage 16 · Stage 21 · **C-65** |
| **C · PRECONDITIONS** | **MP-B05's zero-NULL proof** and **MP-B02's six roles** — both, or FORBIDDEN WINDOW A opens |
| **D · CURRENT EVIDENCE** | four private scoping asserts in `storage.ts:1404–1521` at 18 call sites (CSR-001) · the null-school choke point (`auth.ts:352–420`, CSR-018) · no RLS today |
| **E · TARGET RESULT** | FORCE RLS on the tenant tables, policies in place, the application role non-bypassing, and the runtime context set per request. |
| **F · FILE PLAN — read** | `storage.ts:1404–1521` · `server/middleware/auth.ts:352–420` |
| **F · FILE PLAN — create** | **MIG-10** policies · the SET LOCAL context middleware |
| **F · FILE PLAN — modify** | the data layers to run under the scoped role |
| **F · FILE PLAN — move** | the four asserts beneath RLS as the application half of a two-layer boundary |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-10** — FORCE RLS, policies, ownership separation |
| **H · API WORK** | **none built**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **the two forbidden windows must both stay shut**: RLS before backfill (A), and the scoped read path before policies exist (B) |
| **L · TEST ACTIVATION** | **TEN-T01 … TEN-T12, run as a NON-BYPASSING role against real PostgreSQL** — IMP-P7 — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | query the test role's attributes to prove it is not the table owner and does not bypass RLS · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C002 (C-19)** completes its configuration half — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | a request without a tenant context must **fail**, and the failure is logged as such |
| **P · ROLLBACK / FORWARD REPAIR** | **policies can be dropped, but a request path that assumed them cannot.** Revert application and policies together, in that order |
| **Q · MERGE GATE** | **school A cannot read or mutate school B, proved as a non-owner role** · teacher, guardian, support and platform scopes proved · **neither forbidden window was open** · TEN-T green |
| **R · POST-MERGE SOAK** | one week with the scoped path in staging under seeded two-school data |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B08

| | |
|---|---|
| **A · PURPOSE** | Replace role strings with CAP-001 … CAP-095 behind `TARGET_AUTHORITY_PATH`. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B08** · Stage 7 · **C-40** |
| **C · PRECONDITIONS** | MP-B07 merged; RLS active and proved |
| **D · CURRENT EVIDENCE** | `requireRole(...ADMIN_UI_ROLES)` on most handlers · `users.role`, `user_permissions.role`, `session.role` — three role sources |
| **E · TARGET RESULT** | Every handler's authorization decision runs through a capability check; the legacy role check remains authoritative until each handler's capability check is green. |
| **F · FILE PLAN — read** | all 19 route files · `server/middleware/auth.ts` |
| **F · FILE PLAN — create** | the capability middleware and the CAP registry |
| **F · FILE PLAN — modify** | handlers, per domain, progressively |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **none in this batch** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none** |
| **H · API WORK** | **no new contract** — the same routes gain a different check<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **CBR-001 introduced. The LEGACY role check stays authoritative until the target check is proved per handler** |
| **L · TEST ACTIVATION** | **TST-D034 — a role string must not satisfy a capability check** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | **CBR-001 introduced.** IMP-C004 (C-23) begins — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **a handler reaching the capability path while still reading a role string is a BUILD FAILURE, not a warning** |
| **P · ROLLBACK / FORWARD REPAIR** | `TARGET_AUTHORITY_PATH` off returns every handler to the legacy check |
| **Q · MERGE GATE** | TST-D034 green · the flag defaults **off** · no handler has *neither* check |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B09

| | |
|---|---|
| **A · PURPOSE** | Replace the hand-rolled TOTP, encrypt the MFA secret, block replay, make recovery codes single-use, and make the password reset one transaction. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B09** · Stage 16 · **C-90 · C-21** |
| **C · PRECONDITIONS** | MP-B08 merged |
| **D · CURRENT EVIDENCE** | hand-rolled TOTP in `mfa.routes.ts` (CSR-037) · `POST /api/auth/mfa/verify` is the LOGIN CHALLENGE while the target uses that path for ENROLMENT CONFIRM · `rate_limits` table |
| **E · TARGET RESULT** | A maintained TOTP library on the same stored secrets, encrypted at rest, replay-blocked; single-use recovery codes; a transactional reset; session rotation and revocation; durable rate limiting. |
| **F · FILE PLAN — read** | `server/routes/mfa.routes.ts` · `auth.routes.ts` · `server/rate-limit` |
| **F · FILE PLAN — create** | the MFA/session/recovery modules |
| **F · FILE PLAN — modify** | `mfa.routes.ts` · `auth.routes.ts` · session handling |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **the linking-code and MFA legacy paths are removed in B-11 and B-12, not here** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 credentials** · **DMR-021 `rate_limits` retained unchanged** · **DMR-026 `user_sessions` retained unchanged** |
| **H · API WORK** | **BUILD API-011 … API-015 and API-002.** **THE PATH COLLISION IS SEQUENCED HERE:** today's `POST /api/auth/mfa/verify` is the login challenge and moves to **API-002 `/api/auth/sign-in/mfa`**; today's `/api/auth/mfa/enable` becomes **API-013 `/api/auth/mfa/verify`**. **The challenge must vacate the path before the enrolment confirm takes it**<br>**LRC built here:** LRC-036 … LRC-150 (3) · **LRC removed here:** — — §9 |
| **I · UI WORK** | `security.tsx` — MFA enrolment and recovery codes |
| **J · DEPENDENCIES** | **ADD the maintained TOTP library**; the hand-rolled code is removed with it (DEP-C008) |
| **K · SECURITY** | **SEC-T03 RED FIRST** — MFA enrolment requires the password · replay block · encrypted secret · single-use recovery codes · transactional reset · session rotation · durable rate limiting **not keyed on a client-supplied header** |
| **L · TEST ACTIVATION** | **SEC-T02 … SEC-T09** · **SEC-T03 red then green in this batch** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | a real authenticator enrolled before the change verifies after it, in staging · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C003 (C-21)** and **IMP-C015 (C-90)** may CLOSE — only after SEC-T03's red demonstration — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | verification-failure rate watched across the TOTP swap |
| **P · ROLLBACK / FORWARD REPAIR** | the stored secret is unchanged, so the previous implementation can be restored |
| **Q · MERGE GATE** | SEC-T03 red-then-green recorded · SEC-T02…T09 green · **the path collision resolved in the right order** · CBR-003 and CBR-014 removed |
| **R · POST-MERGE SOAK** | one week of MFA verifications watched |
| **S · REMOVAL ELIGIBILITY** | **CBR-003 · CBR-014 removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B10

| | |
|---|---|
| **A · PURPOSE** | Put the environment boundary inside a schema, add `/live` and `/ready`, and sequence TLS enforcement. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B10** · Stage 21 §18 · **C-69** |
| **C · PRECONDITIONS** | MP-B09 merged |
| **D · CURRENT EVIDENCE** | `GET /api/health` is one endpoint doing three jobs · env read ad hoc · `ALLOW_TEST_SUPERUSER` paths (CSR-046) · `POST /api/seed-users` in the production route tree |
| **E · TARGET RESULT** | A Zod env schema that fails to boot on an unknown or missing value; `/live`, `/ready` and `/dependencies` split; CSP and structured logging with redaction; the test-superuser path refuses in production and says so. |
| **F · FILE PLAN — read** | `server/app.ts` · `server/index.ts` · `server/routes/auth.routes.ts:51` |
| **F · FILE PLAN — create** | the env schema · API-280 · API-281 · API-282 · the redaction layer |
| **F · FILE PLAN — modify** | `server/app.ts` · logging · helmet/CSP configuration |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **`POST /api/seed-users` — LRC-217**, on its §40 proof — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none** |
| **H · API WORK** | **BUILD API-280 · API-281 · API-282.** **REMOVE LRC-217**<br>**LRC built here:** LRC-057 · **LRC removed here:** LRC-217 — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **ADD `@sentry/node` · `@sentry/react`** (DEP-C013) — **the EU region is chosen BEFORE the org exists, and that choice is irreversible** |
| **K · SECURITY** | env validation · CSRF · **canonical origin — tenant and auth decisions NEVER derive from `Host`/`X-Forwarded-Host`/the request URL** · CSP · **structured logging with redaction: no secret, token, message body or credential in a log line** · test-superuser refusal |
| **L · TEST ACTIVATION** | env-validation suite · header suite · CSRF suite · log-redaction suite · superuser suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | Sentry EU org provisioned (**irreversible region choice**) · PFL-013 · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C001 (C-18)** gains its scan · **CBR-005 removable at B-12** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **this batch IS the observability batch** — correlation ids, structured logs, Sentry |
| **P · ROLLBACK / FORWARD REPAIR** | revert the application; the env schema is code, not state |
| **Q · MERGE GATE** | an unknown env value fails to boot in every environment · `/live` and `/ready` correct · CSP present and the app works under it · redaction suite green · **LRC-217 removed with its proof** |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | **LRC-217 removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B11

| | |
|---|---|
| **A · PURPOSE** | Make the two-step linking path the only path, and prove live invite tokens still work. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B11** · Stage 5 · Stage 7 · **C-25** · §15.1 · §15.2 |
| **C · PRECONDITIONS** | MP-B10 merged |
| **D · CURRENT EVIDENCE** | `POST /api/parent/link-child` — the one-step legacy path · `link-code/preview` and `/confirm` already exist · `child_linking_codes` · `invites` |
| **E · TARGET RESULT** | API-197 and API-198 are the only linking path; API-008/API-009 continue to accept live invite tokens; both legacy credential classes' windows are respected separately. |
| **F · FILE PLAN — read** | `server/routes/parent.routes.ts` · `student.routes.ts` · `user.routes.ts` · the invite email templates |
| **F · FILE PLAN — create** | `server/modules/families/link-codes` under the target contracts |
| **F · FILE PLAN — modify** | the family portal linking screens · `admin/linking-codes.tsx` |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **LRC-203 `POST /api/parent/link-child` and five more** — after their deprecation windows — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **DMR-003 invites** · **DMR-010 linking codes** — `UNIQUE (code_hash)` becomes global and unconditional |
| **H · API WORK** | **BUILD API-065 · API-066 · API-067 · API-197 · API-198.** **REMOVE 6 LRC rows**, including LRC-203<br>**LRC built here:** LRC-060 … LRC-220 (6) · **LRC removed here:** LRC-060 … LRC-220 (6) — §9 |
| **I · UI WORK** | `admin/linking-codes.tsx` · the family portal linking flow |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | a linking code grants **a relationship to ONE named child** — never an account, never a school |
| **L · TEST ACTIVATION** | linking suite · **invite-continuity suite** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **an invite issued BEFORE the cutover is accepted AFTER it, in staging, end to end** · **a linking code issued before is redeemed after** · **two separate windows, not one** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C005 (C-25) may CLOSE — only when LRC-203 returns 404** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | redemption attempts on the removed path are logged as 404s so a missed caller is visible |
| **P · ROLLBACK / FORWARD REPAIR** | the legacy path is restorable from Git until its window closes; **after the window, reissue rather than restore** |
| **Q · MERGE GATE** | linking suite green · **invite continuity proved end to end** · the deprecation windows elapsed **separately** · LRC-203 returns 404 |
| **R · POST-MERGE SOAK** | one linking-code lifetime |
| **S · REMOVAL ELIGIBILITY** | **6 LRC rows removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B12

| | |
|---|---|
| **A · PURPOSE** | Complete the authority cutover: delete the flag, remove bcryptjs, and remove eleven legacy auth and staff routes. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B12** · Stage 7 · Stage 16 · **C-23** |
| **C · PRECONDITIONS** | MP-B11 merged; every handler's capability check green under the flag |
| **D · CURRENT EVIDENCE** | `TARGET_AUTHORITY_PATH` in place since B-08 · bcryptjs hashes decreasing since B-06 · `/api/users*` aliases · `passport`/`passport-local` unimported |
| **E · TARGET RESULT** | No role string satisfies any authorization decision; the flag is deleted from the codebase; bcryptjs, passport and memorystore are gone. |
| **F · FILE PLAN — read** | every route file · `package.json` |
| **F · FILE PLAN — create** | none |
| **F · FILE PLAN — modify** | handlers — the legacy branch is deleted, not disabled |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **`TARGET_AUTHORITY_PATH` and its legacy branches · `bcryptjs` · `@types/bcryptjs` · `passport` · `passport-local` · their `@types` · `memorystore` · 11 LRC rows** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none** |
| **H · API WORK** | **REMOVE 11 LRC rows** — the auth duplicates, the `/api/users*` aliases, `POST /api/users`, MFA legacy paths<br>**LRC built here:** — · **LRC removed here:** LRC-035 … LRC-152 (11) — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **REMOVE:** DEP-C007 · DEP-C002 · DEP-C006 — each on the four-part proof |
| **K · SECURITY** | **full SEC-T green with the flag DELETED, not defaulted on** |
| **L · TEST ACTIVATION** | **full SEC-T** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | confirm the residual bcrypt accounts are recorded and their reset path is live · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C004 (C-23) may CLOSE** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | an authorization denial names the capability it required, not the role it expected |
| **P · ROLLBACK / FORWARD REPAIR** | **this is the point after which the legacy authorization path no longer exists.** Rollback is a revert of the batch, and it must happen before the soak ends |
| **Q · MERGE GATE** | full SEC-T green · the flag string absent from the codebase · zero bcrypt hashes **or** the residual list recorded with a live reset path · **CBR-001 · CBR-002 · CBR-005 removed** · 11 LRC rows removed with proofs |
| **R · POST-MERGE SOAK** | two weeks — **this is the highest-consequence security switch in the plan** |
| **S · REMOVAL ELIGIBILITY** | **CBR-001 · CBR-002 · CBR-005 · DEP-C002 · DEP-C006 · DEP-C007 · 11 LRC rows** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B13

| | |
|---|---|
| **A · PURPOSE** | Build the school, academic-period, class, subject and staffing surfaces and contracts. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B13** · Stage 4 · Stage 6 · Stage 8 |
| **C · PRECONDITIONS** | MP-B12 merged; the authority model is the only authority model |
| **D · CURRENT EVIDENCE** | `storage.ts`'s class/subject/staffing methods (CSR-005) and school-settings methods (CSR-012) · `school_branding`'s 18 fused columns · `teacher_profiles` |
| **E · TARGET RESULT** | MOD-001 and MOD-003 own their facts through their own `data.ts`; the school-settings, identity, setup, staff, period, class, subject and staffing contracts exist. |
| **F · FILE PLAN — read** | `storage.ts` (CSR-005, CSR-012) · `book.routes.ts` · `setup.routes.ts` · `user.routes.ts` |
| **F · FILE PLAN — create** | `modules/tenancy/data.ts` · `modules/academic/data.ts` · the API-018…API-054 handlers |
| **F · FILE PLAN — modify** | `storage.ts` narrows further (CBR-004) |
| **F · FILE PLAN — move** | the tenancy and academic persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | **none in this batch** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 school** · **DMR-001 · DMR-006 · DMR-023 · DMR-027** |
| **H · API WORK** | **BUILD API-018 … API-054** (less the period contracts with no legacy). **REMOVE none — 43 LRC rows in this family are removed at B-34**<br>**LRC built here:** LRC-001 … LRC-230 (40) · **LRC removed here:** — — §9 |
| **I · UI WORK** | the four shells become Stage 9 role entry points (SCR-C010…C013) · `admin/classes.tsx` · `admin/users.tsx` · `admin/setup.tsx` · `admin/invite-staff-wizard.tsx` |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | staff suspension, reactivation and offboarding are **named acts under CAP-033/034/035** — a staff row is never deleted |
| **L · TEST ACTIVATION** | domain suite · **TEN-T for the school scope** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | the `school_branding` split is logged per row so both halves can be reconciled |
| **P · ROLLBACK / FORWARD REPAIR** | the old tables remain authoritative; revert the application |
| **Q · MERGE GATE** | row parity per table · **membership parity: no staff member loses a school** · both branding halves reconcile to the source row · domain suite green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B14

| | |
|---|---|
| **A · PURPOSE** | Migrate child records to MOD-004 and build the children contracts. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B14** · Stage 6 · **UXQ-2 vocabulary** |
| **C · PRECONDITIONS** | MP-B13 merged |
| **D · CURRENT EVIDENCE** | `students` table · `storage.ts`'s ~12 child methods (CSR-006) · `admin/students.tsx` with a browser-side XLSX import |
| **E · TARGET RESULT** | `children` is the target vocabulary and the target table; archive replaces delete; the child contracts exist. |
| **F · FILE PLAN — read** | `storage.ts` (CSR-006) · `book.routes.ts` · `family-enrollment.routes.ts` |
| **F · FILE PLAN — create** | `modules/families/data.ts` (child half) · API-055 … API-064 |
| **F · FILE PLAN — modify** | `admin/students.tsx` (rebuild) · `admin/student-profile.tsx` |
| **F · FILE PLAN — move** | child persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 children** · **DMR-007** |
| **H · API WORK** | **BUILD API-055 … API-064**<br>**LRC built here:** LRC-013 … LRC-221 (8) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C015 REBUILD** — and the XLSX import moves out of the browser at B-22, not here |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **a child record is never row-deleted** — API-060 archives |
| **L · TEST ACTIVATION** | **child count parity, and it is a CHILD-RECORD count** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | child counts before and after, per school |
| **P · ROLLBACK / FORWARD REPAIR** | the old table remains authoritative |
| **Q · MERGE GATE** | **count parity** · tenant integrity · domain suite green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B15

| | |
|---|---|
| **A · PURPOSE** | Remodel families, guardians and their relationships. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B15** · Stage 6 · **DMR-009** |
| **C · PRECONDITIONS** | MP-B14 merged |
| **D · CURRENT EVIDENCE** | `families` · `family_students` · `guardians` · `parent_children` — **TWO relationship tables** · CSR-007's ~14 methods |
| **E · TARGET RESULT** | One relationship model; guardians nested under families in the API; drafts as a resource. |
| **F · FILE PLAN — read** | `family-enrollment.routes.ts` · `storage.ts` (CSR-007) |
| **F · FILE PLAN — create** | `modules/families/data.ts` (family half) · API-068 … API-081 |
| **F · FILE PLAN — modify** | `admin/families.tsx` · `admin/family-enrollment.tsx` |
| **F · FILE PLAN — move** | family persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 family** · **DMR-009 — DECOMPOSE + DEDUPE** |
| **H · API WORK** | **BUILD API-068 … API-081**<br>**LRC built here:** LRC-009 … LRC-178 (17) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C016 REBUILD** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | a guardian's scope is their children, across schools, **with no cross-school aggregate** |
| **L · TEST ACTIVATION** | **relationship parity — NO CHILD LOSES A GUARDIAN, no guardian loses a child** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | spot-check a family with children at two schools, in staging · **NOT RUN** |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | relationship counts per family, before and after |
| **P · ROLLBACK / FORWARD REPAIR** | both source tables remain |
| **Q · MERGE GATE** | **relationship parity, both directions** · dedupe produces no orphan · domain suite green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B16

| | |
|---|---|
| **A · PURPOSE** | Move the catalogue — books, copies, levels-to-bundles — and fix the broken ISBN caller. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B16** · Stage 6 · **C-76** |
| **C · PRECONDITIONS** | MP-B15 merged |
| **D · CURRENT EVIDENCE** | CSR-003's 17 catalogue methods · `GET /api/books/by-isbn/:isbn` with **no caller** · `admin/books.tsx:55` calling `/api/isbn-lookup/:isbn`, **which no route serves** |
| **E · TARGET RESULT** | MOD-005 owns the catalogue; API-087 is the one lookup and `admin/books.tsx` calls it. |
| **F · FILE PLAN — read** | `book.routes.ts` · `storage.ts` (CSR-003) · `client/src/pages/admin/books.tsx` |
| **F · FILE PLAN — create** | `modules/catalogue/data.ts` · API-082 … API-092 |
| **F · FILE PLAN — modify** | **`admin/books.tsx:55` — the broken caller is corrected to API-087** |
| **F · FILE PLAN — move** | catalogue persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 catalogue** · **DMR-008** |
| **H · API WORK** | **BUILD API-082 … API-092**<br>**LRC built here:** LRC-005 … LRC-157 (11) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C021 · SCR-C023 REBUILD** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | none specific |
| **L · TEST ACTIVATION** | catalogue suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | **IMP-C012 (C-76) may CLOSE** — the caller is corrected and no client file requests `/api/isbn-lookup/` — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | lookup failures logged with the ISBN class, not the ISBN |
| **P · ROLLBACK / FORWARD REPAIR** | the old tables remain |
| **Q · MERGE GATE** | parity · level membership reconciled · **no client file calls `/api/isbn-lookup/`** · catalogue suite green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B17

| | |
|---|---|
| **A · PURPOSE** | Split stock into movements plus a projection, and prove the projection recomputes. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B17** · Stage 6 · Stage 18 · **§24.2** |
| **C · PRECONDITIONS** | MP-B16 merged |
| **D · CURRENT EVIDENCE** | `book_inventory_transactions` **with no `school_id`** · stock arithmetic inside `storage.ts` (CSR-003) |
| **E · TARGET RESULT** | DBT-025 `stock_movements` plus the DBT-026 projection; the projection recomputes to the stored value. |
| **F · FILE PLAN — read** | `book.routes.ts` · `storage.ts` stock methods |
| **F · FILE PLAN — create** | the movement writer and the projection |
| **F · FILE PLAN — modify** | stock reads |
| **F · FILE PLAN — move** | stock persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 stock** · **DMR-015** — `book_inventory_transactions` gains `school_id` and becomes movements plus a projection |
| **H · API WORK** | **BUILD API-093 … API-096**<br>**LRC built here:** LRC-043 … LRC-158 (3) · **LRC removed here:** — — §9 |
| **I · UI WORK** | `admin/book-copies.tsx` stock views |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | none specific |
| **L · TEST ACTIVATION** | **INV-T05 — the projection recomputes to the stored value**, against real PostgreSQL — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | **CBR-009 introduced** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **a projection that does not recompute is an ALERT, not a metric** |
| **P · ROLLBACK / FORWARD REPAIR** | the transaction record is untouched and remains the truth |
| **Q · MERGE GATE** | **INV-T05 green · sum parity per book per school · NO DOUBLE MOVEMENT** |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B18

| | |
|---|---|
| **A · PURPOSE** | Remodel supply cycles and requirements — MOD-006, the spine. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B18** · Stage 6 · **DMR-011** |
| **C · PRECONDITIONS** | MP-B17 merged |
| **D · CURRENT EVIDENCE** | `child_book_baskets` · `basket_items` · `book_levels` → bundles · `student_book_levels` overrides |
| **E · TARGET RESULT** | Cycles, requirement items, requirement lines and child selections exist; bundles replace levels. |
| **F · FILE PLAN — read** | `book.routes.ts` levels · `parent.routes.ts` baskets · `storage.ts` |
| **F · FILE PLAN — create** | `modules/requirements/data.ts` · API-097 … API-116 |
| **F · FILE PLAN — modify** | `admin/book-levels.tsx` |
| **F · FILE PLAN — move** | requirement persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 cycles** · **DMR-011** |
| **H · API WORK** | **BUILD API-097 … API-116**<br>**LRC built here:** LRC-003 … LRC-234 (14) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C022 REBUILD** — **bundle composition rules are PROVEN and are relocated, not rewritten** (TXP-4) |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **CAP-040 `open_cycle` is system-initiated** — it has no user-invocable endpoint, by design |
| **L · TEST ACTIVATION** | cycle suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | line counts per cycle, reconciled to source |
| **P · ROLLBACK / FORWARD REPAIR** | the old tables remain |
| **Q · MERGE GATE** | line-count parity · **money lines reconcile to source** · cycle suite green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B19

| | |
|---|---|
| **A · PURPOSE** | Decompose money events from applications from provider records, behind `TARGET_API_PATH`. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B19** · Stage 6 · Stage 7 · **DMR-012 · OD-1** |
| **C · PRECONDITIONS** | MP-B18 merged |
| **D · CURRENT EVIDENCE** | `book_payments` with **two lifecycle columns and a `parent_identifier text`** · `basket_payments` · `provider_payments` · `payment_verification_attempts` · CSR-008's ~11 methods |
| **E · TARGET RESULT** | DBT-035…DBT-043 exist and are populated; the read path is switchable; sum parity holds on every money column. |
| **F · FILE PLAN — read** | `payment.routes.ts` · `storage.ts` (CSR-008) |
| **F · FILE PLAN — create** | `modules/settlement/data.ts` · API-117 … API-136 (less I-2's commands, which are B-20) |
| **F · FILE PLAN — modify** | `admin/payments.tsx` · `admin/reconciliation.tsx` · `finance.tsx` |
| **F · FILE PLAN — move** | settlement persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 finance** · **DMR-012** |
| **H · API WORK** | **BUILD API-117 … API-119, API-122 … API-136**<br>**LRC built here:** LRC-024 … LRC-177 (8) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C018 · SCR-C019 REBUILD** · `finance.tsx` becomes a work area, not a shell (**C-50**) |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **a provider record is not a settlement.** Reconciliation proposes; a human confirms under CAP-049 |
| **L · TEST ACTIVATION** | money suite · **sum parity per money column** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | reconcile one real import against the legacy figures, in staging · **NOT RUN** |
| **N · CONFLICT EFFECT** | **CBR-007 introduced.** `TARGET_API_PATH` introduced, default off — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **scheduled sum-parity per money column; divergence is an ALERT** |
| **P · ROLLBACK / FORWARD REPAIR** | `TARGET_API_PATH` off; the old tables are still authoritative |
| **Q · MERGE GATE** | **SUM PARITY ON EVERY MONEY COLUMN** · money suite green · the flag defaults off |
| **R · POST-MERGE SOAK** | one week of parity runs |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B20

| | |
|---|---|
| **A · PURPOSE** | Make settlement confirmation one PostgreSQL transaction containing all six writes. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B20** · Stage 18 · Stage 19 · **I-2** · **C-102** |
| **C · PRECONDITIONS** | MP-B19 merged; sum parity green; the audit Class A coupling design available |
| **D · CURRENT EVIDENCE** | **`confirmPayment` — CSR-002 — already uses a single `transaction()` and a conditional `UPDATE … WHERE status NOT IN (…) RETURNING *` as its claim.** That pattern is correct and is KEPT |
| **E · TARGET RESULT** | One confirmation writes settlement, allocation, stock movement, projection, notification fact and Class A audit fact in one transaction, one commit. |
| **F · FILE PLAN — read** | `storage.ts:confirmPayment` (CSR-002) · `payment.routes.ts` · `allocation.routes.ts` |
| **F · FILE PLAN — create** | the I-2 command handler — **API-120 · API-121 · API-144 · API-147** |
| **F · FILE PLAN — modify** | `confirmPayment` expands inside its existing transaction |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **no new migration** — the writes land in tables created at B-05 and populated from B-19 |
| **H · API WORK** | **BUILD API-120 · API-121 · API-128 · API-144 · API-147**<br>**LRC built here:** LRC-122 … LRC-132 (9) · **LRC removed here:** — — §9 |
| **I · UI WORK** | `admin/payments.tsx` confirm flow |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **an audit failure rolls the business transaction back** — the coupling is the control, not the logging |
| **L · TEST ACTIVATION** | **INV-T01 · INV-T02 · INV-T03 · INV-T04**, against real PostgreSQL, under genuine concurrency — IMP-P8 — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none automation cannot prove · — |
| **N · CONFLICT EFFECT** | **IMP-C017 (C-102) may CLOSE** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | one correlation id spans all six writes; a partial set is impossible and would be an alert if seen |
| **P · ROLLBACK / FORWARD REPAIR** | `TARGET_API_PATH` off returns confirmation to the legacy path |
| **Q · MERGE GATE** | **all seven §12 proofs green** — atomicity · insufficient stock · concurrent duplicate · audit failure · notification-fact failure · email failure does NOT roll back · callback does NOT confirm |
| **R · POST-MERGE SOAK** | two weeks of live confirmations watched |
| **S · REMOVAL ELIGIBILITY** | **the old finance path becomes ELIGIBLE — removal is B-33** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B21

| | |
|---|---|
| **A · PURPOSE** | Split allocations, custody, exceptions and hand-overs, without inventing history. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B21** · Stage 6 · Stage 8 · Stage 18 · **DMR-013 · DMR-014 · §24.1** |
| **C · PRECONDITIONS** | MP-B20 merged; I-2 proved |
| **D · CURRENT EVIDENCE** | `finance_book_allocations` with **three fused status columns** · `custody_events`, append-only and already correct · **`server/custody.ts` — the one true unit-tested module (CSR-015)** |
| **E · TARGET RESULT** | DBT-044/045/046/047 exist; the custody chain is continuous; **no fabricated actor, timestamp, transition, cause or route**. |
| **F · FILE PLAN — read** | `server/custody.ts` (CSR-015, **KEEP**) · `allocation.routes.ts` · `storage.ts` (CSR-009) |
| **F · FILE PLAN — create** | `modules/custody/data.ts` · API-137 … API-154 |
| **F · FILE PLAN — modify** | `admin/allocations.tsx` · `admin/collection-sheet.tsx` · `teacher.tsx` |
| **F · FILE PLAN — move** | custody persistence out of `storage.ts`; **`custody.ts` itself moves unchanged** |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 custody** · **DMR-013 · DMR-014 · DMR-016** |
| **H · API WORK** | **BUILD API-137 … API-154**<br>**LRC built here:** LRC-018 … LRC-228 (16) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C017 · SCR-C024 · SCR-C025 REBUILD** · `teacher.tsx` handheld behaviour preserved (DS-P10) |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **the own-child teacher block is tested in THIS batch, before the old hand-over path is removed** |
| **L · TEST ACTIVATION** | **custody-machine · handover · own-child block · the nine §24.3 checks** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | review the LEGACY-DERIVED marker output — **any row that would need a fabricated actor or timestamp STOPS THE BATCH and raises a Stage 15 amendment** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **CBR-008 introduced** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | counts of LEGACY/UNKNOWN provenance markers, per class, reported |
| **P · ROLLBACK / FORWARD REPAIR** | the old table remains authoritative until B-33 |
| **Q · MERGE GATE** | **allocation parity · custody chain CONTINUITY · handover and exception parity where source evidence exists · NO fabricated actor · NO fabricated timestamp · NO orphan target event** |
| **R · POST-MERGE SOAK** | one week |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B22

| | |
|---|---|
| **A · PURPOSE** | Build one import engine with two modes, parsing server-side with the vendored SheetJS. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B22** · Stage 4 (**A4-001**) · Stage 11 (**TD-038**) · Stage 18 · **C-26 · C-58** |
| **C · PRECONDITIONS** | MP-B21 merged |
| **D · CURRENT EVIDENCE** | **two pipelines** — `families/enroll/import/{analyze,commit}` and `students/import/{preview,confirm}` · `admin/students.tsx:22` imports `xlsx` **in the browser** · `xlsx@0.18.5` from npm |
| **E · TARGET RESULT** | One engine, two modes (CAP-027 children-only, CAP-028 children+families); the workbook parsed server-side by vendored SheetJS 0.20.3+; logical-row atomicity with durable progress and non-duplicating resume. |
| **F · FILE PLAN — read** | `family-enrollment.routes.ts` (pipeline 1) · `student.routes.ts` (pipeline 2) · `client/src/pages/admin/students.tsx` |
| **F · FILE PLAN — create** | the import engine · API-164 … API-171 · the vendored SheetJS under a recorded path |
| **F · FILE PLAN — modify** | `admin/students.tsx` · `admin/family-enrollment-import.tsx` |
| **F · FILE PLAN — move** | parsing from browser to server |
| **F · FILE PLAN — remove** | **none — the legacy commit paths are removed at B-24** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 import** · the import-session staging tables |
| **H · API WORK** | **BUILD API-164 … API-171.** **The commit is API-170 and the result is API-171 — A14-002**<br>**LRC built here:** LRC-052 … LRC-223 (6) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C041 · SCR-C042 KEEP + REFACTOR** — one surface, two modes |
| **J · DEPENDENCIES** | **REPLACE THE DISTRIBUTION:** the npm `xlsx` entry goes once the **vendored official SheetJS 0.20.3+** is in place, **server-side only, size-capped, no formula evaluation** (DEP-C009 · TD-038). **No parser is reselected** |
| **K · SECURITY** | **a workbook is untrusted input on the path that creates children's records** — TR-001. **TR-010: the vendored copy will not appear in `npm audit`, so its pinned version, source URL, review cadence and named owner are a DELIVERABLE of this batch** |
| **L · TEST ACTIVATION** | **§21's suite: preview writes no product truth · one logical row = one transaction · rows 1–2 stay committed when row 3 fails · durable progress · resume does not duplicate · emails after commit.** **No whole-file rollback test — the locked stages never specified that behaviour** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | run a real school's spreadsheet through both modes in staging and compare to the legacy result · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C008 (C-58) may CLOSE** · **IMP-C020 (C-105) implementation closes** · IMP-C006 (C-26) advances but closes at B-24 — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | per-row progress on the import session; a resume logs where it resumed from |
| **P · ROLLBACK / FORWARD REPAIR** | both legacy pipelines are still live; point the UI back |
| **Q · MERGE GATE** | **no `xlsx` import in any `client/**` file** · the browser bundle contains no workbook parser · both modes proved · the vendored version and owner recorded |
| **R · POST-MERGE SOAK** | one enrolment cycle in staging |
| **S · REMOVAL ELIGIBILITY** | **the legacy pipelines become ELIGIBLE — removed at B-24** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B23

| | |
|---|---|
| **A · PURPOSE** | Move messaging to MOD-009, with message bodies excluded from audit. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B23** · Stage 6 · Stage 8 · Stage 19 (**AUD-D055**) |
| **C · PRECONDITIONS** | MP-B22 merged |
| **D · CURRENT EVIDENCE** | `message_threads` · `messages` · **`message_audit_logs`, which already has the right shape** — Stage 19 AUD-F01's counter-example · CSR-010's ~7 methods |
| **E · TARGET RESULT** | MOD-009 owns threads and messages; the school and family messaging contracts exist; no message body enters audit. |
| **F · FILE PLAN — read** | `message.routes.ts` · `notification.routes.ts` · `storage.ts` (CSR-010) |
| **F · FILE PLAN — create** | `modules/communication/data.ts` · API-155 … API-159 · API-188 … API-192 |
| **F · FILE PLAN — modify** | `admin/communications.tsx` |
| **F · FILE PLAN — move** | messaging persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 messaging** · **DMR-017** |
| **H · API WORK** | **BUILD API-155 … API-159 · API-188 … API-192**<br>**LRC built here:** LRC-020 … LRC-229 (11) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C037 KEEP + REFACTOR** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **no message body ever enters an audit record** — AUD-D055 |
| **L · TEST ACTIVATION** | messaging suite · **an explicit audit-exclusion assertion** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | thread and message counts reconciled |
| **P · ROLLBACK / FORWARD REPAIR** | the old tables remain |
| **Q · MERGE GATE** | parity · **the audit-exclusion assertion is green** · messaging suite green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B24

| | |
|---|---|
| **A · PURPOSE** | Separate the notification FACT from the delivery ATTEMPT, then cut the sender over to SES. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B24** · Stage 17 · Stage 18 · **INTQ-2 = C** · **IMP-P9** |
| **C · PRECONDITIONS** | MP-B23 merged; **SES production access granted — a PROVIDER GATE, not a code gate** |
| **D · CURRENT EVIDENCE** | **the current code sends as the notification** — there is no separate fact · Resend is the sender · `notification_preferences` untenanted |
| **E · TARGET RESULT** | DBT-053 the fact (written inside I-2's transaction) and DBT-054 the attempt (outside it, retried, observed); one active sender, switchable without a deploy. |
| **F · FILE PLAN — read** | the notification and email send paths · `notification.routes.ts` |
| **F · FILE PLAN — create** | the fact writer · the delivery-attempt worker · the SES adapter · API-160 … API-163 · API-193 … API-196 · **API-279** the versioned callback seam |
| **F · FILE PLAN — modify** | every send site becomes a fact write plus an attempt |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **the six import LRC rows — LRC-052 · 053 · 172 · 173 · 222 · 223** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 notifications** · **DMR-020** |
| **H · API WORK** | **BUILD API-160 … API-163 · API-193 … API-196 · API-279.** **REMOVE the 6 import LRC rows**<br>**LRC built here:** LRC-062 … LRC-231 (6) · **LRC removed here:** LRC-052 … LRC-223 (6) — §9 |
| **I · UI WORK** | notification preferences surfaces |
| **J · DEPENDENCIES** | **ADD the AWS SES client** (DEP-C011) |
| **K · SECURITY** | **webhook signature verification on the RAW BYTES, before parsing · replay defence · and a callback NEVER confirms settlement** |
| **L · TEST ACTIVATION** | delivery-parity suite · webhook suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **the seven cutover inputs** — staging send · template parity · delivery-event parity · **bounce/complaint parity (a bounce suppresses an ADDRESS; it does not mark an identity unverified)** · sender identity `"<School> via ScholarShelf"` · secrets present · **a rollback route needing no deploy** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C006 (C-26) may CLOSE** — the second commit path is gone. **CBR-011 introduced** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | delivery, bounce and complaint rates compared across the switch |
| **P · ROLLBACK / FORWARD REPAIR** | **flip `TARGET_EMAIL_PROVIDER` back to Resend — no deploy required** |
| **Q · MERGE GATE** | fact and attempt separated **before** any provider work · seven inputs verified · **exactly one active sender — NEVER DUAL-SEND** · the 6 import rows removed with proofs |
| **R · POST-MERGE SOAK** | two weeks of delivery rates |
| **S · REMOVAL ELIGIBILITY** | **6 LRC rows removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B25

| | |
|---|---|
| **A · PURPOSE** | Build the family portal surfaces under `/api/family/*`, guardian-scoped only. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B25** · Stage 6 · Stage 7 · Stage 9 |
| **C · PRECONDITIONS** | MP-B24 merged |
| **D · CURRENT EVIDENCE** | `parent.tsx` — **1,489 lines in one file** · a global selected school in the parent portal · `/api/parent/*` (15 routes) |
| **E · TARGET RESULT** | `/api/family/*` contracts serving guardian scope; `parent.tsx` split; **no global selected school**. |
| **F · FILE PLAN — read** | `client/src/pages/parent.tsx` · `parent.routes.ts` |
| **F · FILE PLAN — create** | API-177 … API-187 · the split family surfaces |
| **F · FILE PLAN — modify** | `parent.tsx` splits into `bands/family/` |
| **F · FILE PLAN — move** | **MOVE + SPLIT — SCR-C012** |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none new** |
| **H · API WORK** | **BUILD API-177 … API-187**<br>**LRC built here:** LRC-079 … LRC-209 (7) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C012 MOVE + SPLIT** · **query-state adoption** · **axe green, and these are among the eight surfaces in scope for the manual WCAG assessment** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **a guardian with children at two schools sees each child in its own school and NO cross-school aggregate** |
| **L · TEST ACTIVATION** | **TEN-T guardian scope** · family suite · **E2E-T01 … E2E-T08 begin** · axe — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **the manual WCAG 2.2 AA assessment covers the family surfaces** — decision 2A · **NOT RUN** |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | a family request without a guardian context fails and is logged |
| **P · ROLLBACK / FORWARD REPAIR** | revert the application; `/api/parent/*` is still live |
| **Q · MERGE GATE** | TEN-T guardian scope green · **no global selected school anywhere in the family band** · axe green |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B26

| | |
|---|---|
| **A · PURPOSE** | Move object bytes out of the database into S3, with scanning proved before anything is readable. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B26** · Stage 17 · Stage 21 · **OPSQ-1 = A** · **DMR-019** |
| **C · PRECONDITIONS** | MP-B25 merged; the buckets provisioned; **GuardDuty PROVISIONING VERIFICATION** |
| **D · CURRENT EVIDENCE** | `media_assets.data_uri` — **base64 bytes inside PostgreSQL** · `POST /api/media` is a fused upload · `file-type` present but unimported |
| **E · TARGET RESULT** | S3 objects plus DBT-071 `object_uploads`; a two-step upload; per-object hash, size and content-type reconciled; **nothing pending or unscanned is readable by anyone**. |
| **F · FILE PLAN — read** | `website.routes.ts` media handlers · `setup.routes.ts` branding uploads |
| **F · FILE PLAN — create** | the S3 adapter · the scan-state machine · API-218 … API-223 · API-022 · API-023 |
| **F · FILE PLAN — modify** | branding and media-library reads |
| **F · FILE PLAN — move** | **the BYTES move — MIG-11** |
| **F · FILE PLAN — remove** | **none — the source bytes drop only at MIG-14** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-11** · **DMR-019** |
| **H · API WORK** | **BUILD API-022 · API-023 · API-218 … API-223**<br>**LRC built here:** LRC-011 … LRC-180 (4) · **LRC removed here:** — — §9 |
| **I · UI WORK** | `admin/media-library.tsx` · `admin/branding.tsx` (**SCR-C030 · SCR-C031 MERGE** into Website Studio at B-27) |
| **J · DEPENDENCIES** | **`file-type` becomes IMPORTED here** (DEP-C022) · the AWS S3 client (DEP-C011) |
| **K · SECURITY** | **the PUBLIC bucket's CONTENTS POLICY is the control — an account-level all-public-access block CANNOT be overridden per bucket, and no CloudFront is introduced here** · **PENDING is readable by NOBODY** |
| **L · TEST ACTIVATION** | **§26's reconciliation suite · PFL-010's EICAR test in staging** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **the EICAR gate — an EICAR object is detected in staging BEFORE any real object moves. It blocks the WHOLE migration, not just the public half** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **CBR-010 introduced** · IMP-C011 provisioning half advances — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | per-object reconciliation report: hash, size, content-type, scan state |
| **P · ROLLBACK / FORWARD REPAIR** | **reads revert to the database bytes, which are still there until MIG-14** |
| **Q · MERGE GATE** | **EICAR detected in staging** · every object reconciled · **no pending or unscanned object is readable** · `TARGET_OBJECT_STORAGE` defaults off |
| **R · POST-MERGE SOAK** | one week with reads still on the database |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B27

| | |
|---|---|
| **A · PURPOSE** | Decompose the CMS and serve the public site through one PublishedSite contract. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B27** · Stage 8 · Stage 11 · **AQ-1 = B** · **MA-2** · **DMR-018** |
| **C · PRECONDITIONS** | MP-B26 merged |
| **D · CURRENT EVIDENCE** | `school_website_sections` with an `isPublished` boolean · **four separate public reads** · `school-public.tsx` as a lazy SPA route in the same bundle as `owner.tsx` |
| **E · TARGET RESULT** | DBT-058…066; a revision model replacing the boolean; `/api/site/:schoolCode` as the one public contract; the public site structurally separated per AQ-1 = B. |
| **F · FILE PLAN — read** | `website.routes.ts` · `public.routes.ts` · `client/src/pages/school-public.tsx` |
| **F · FILE PLAN — create** | `modules/website/data.ts` · API-199 … API-233 |
| **F · FILE PLAN — modify** | Website Studio surfaces |
| **F · FILE PLAN — move** | **`school-public.tsx` relocates to `apps/site` — content and behaviour survive** |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 CMS** · **DMR-018** |
| **H · API WORK** | **BUILD API-199 … API-233**<br>**LRC built here:** LRC-017 … LRC-233 (11) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C030 · C031 · C032 MERGE into Website Studio** · **SCR-C009 relocates** · axe green |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **only published content is publicly readable** · **CMS entitlement is MOD-001's fact, not MOD-011's** (MA-2) |
| **L · TEST ACTIVATION** | CMS suite · **the public/private publication boundary** · E2E-T · axe — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | a live school's published site renders identically through API-231 · **NOT RUN** |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | publish and unpublish events are audited acts |
| **P · ROLLBACK / FORWARD REPAIR** | the four legacy public reads are still live |
| **Q · MERGE GATE** | parity per section type · **draft content is not publicly readable** · PublishedSite parity on a live school |
| **R · POST-MERGE SOAK** | one week |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B28

| | |
|---|---|
| **A · PURPOSE** | Build the platform, support and break-glass surfaces — and route `wipe-school` to request-deletion, not to a break-glass act. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B28** · Stage 7 · Stage 12 · Stage 19 · **C-44** · **C-107 = A (A14-003)** |
| **C · PRECONDITIONS** | MP-B27 merged |
| **D · CURRENT EVIDENCE** | `owner.routes.ts` (21 routes) · `db-console.routes.ts` incl. **`POST /api/owner/db/query` — arbitrary SQL** · **`wipe-school` = "Stage 1: soft-delete. Reversible."** · `purge-school` = "Stage 2: the irreversible purge" · `owner.tsx` (1,208 lines) |
| **E · TARGET RESULT** | `/api/platform/*`, `/support/*`, `/investigation/*` and `/break-glass/*` exist; arbitrary SQL is gone; **`wipe-school`'s callers move to API-247 request-deletion**. |
| **F · FILE PLAN — read** | `owner.routes.ts` · `db-console.routes.ts` · `client/src/pages/admin/owner.tsx` · `db-console.tsx` · `system-health.tsx` · `it-dashboard.tsx` |
| **F · FILE PLAN — create** | `modules/platform-ops/data.ts` · API-234 … API-277 |
| **F · FILE PLAN — modify** | the platform surfaces merge (SCR-C026…C029) |
| **F · FILE PLAN — move** | **`owner.tsx` relocates into the platform band — Stage 12, C-44 — it is RELOCATED, not deleted as lost work** |
| **F · FILE PLAN — remove** | **`POST /api/owner/db/query` — LRC-187**, on its §40 proof — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 platform** · **DMR-022's console half** |
| **H · API WORK** | **BUILD API-234 … API-277.** **LRC-186 `wipe-school` → API-247** — **C-107 = A**. **REMOVE LRC-187 arbitrary SQL**<br>**LRC built here:** LRC-012 … LRC-201 (39) · **LRC removed here:** LRC-187 — §9 |
| **I · UI WORK** | **SCR-C026 · C027 · C028 · C029 MERGE** into UX-095/096/099 |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **elevation is AET-030 and there is NO elevation table** — `elevation_event_id` self-references the granting event · **support engagement scope is bounded and audited** · **PA-2: account recovery requires support mode** |
| **L · TEST ACTIVATION** | **SEC-T15** · support-scope suite · break-glass audit coupling — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **verify by review that `wipe-school`'s replacement is NOT wired to API-276/CAP-036 erase-account or API-277/CAP-092 purge** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C022 (C-107) may CLOSE** — only when the old `wipe-school` route is gone and the evidence exists. **IMP-C012's C-44 half advances** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | every support engagement and every elevation is an audited fact with a correlation id |
| **P · ROLLBACK / FORWARD REPAIR** | the legacy owner routes remain live until B-34 |
| **Q · MERGE GATE** | **API-247 behaviour proved: lifecycle-state transition · idempotency · CAP-084 · SC-7** · the legacy `wipe-school` caller switched · **arbitrary SQL removed with its proof** · SEC-T15 green |
| **R · POST-MERGE SOAK** | one week |
| **S · REMOVAL ELIGIBILITY** | **LRC-187 removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B29

| | |
|---|---|
| **A · PURPOSE** | Build reporting and projections — MOD-010, which owns no persistence. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B29** · Stage 8 · Stage 10 · **CA-P13 · APP-029** |
| **C · PRECONDITIONS** | MP-B28 merged |
| **D · CURRENT EVIDENCE** | `admin/reports.tsx` · `admin/dashboard.tsx` · `dashboard.routes.ts`'s summary endpoints |
| **E · TARGET RESULT** | API-129 and API-172 … API-176; every figure derived from an owning module's facts. |
| **F · FILE PLAN — read** | `dashboard.routes.ts` · `admin/reports.tsx` · `admin/dashboard.tsx` |
| **F · FILE PLAN — create** | the reporting read models — **and NO `modules/reporting/data.ts`** |
| **F · FILE PLAN — modify** | `admin/dashboard.tsx` · `admin/reports.tsx` |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none — MOD-010 creates no table and owns no operational truth** |
| **H · API WORK** | **BUILD API-129 · API-172 … API-176**<br>**LRC built here:** LRC-019 … LRC-027 (4) · **LRC removed here:** — — §9 |
| **I · UI WORK** | **SCR-C014 · SCR-C039 REBUILD/REFACTOR** · axe green |
| **J · DEPENDENCIES** | **`recharts` is used here** (DEP-I068) |
| **K · SECURITY** | a report never widens scope — it reads through the same Stage 7 chain |
| **L · TEST ACTIVATION** | projection-recompute suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | none · — |
| **N · CONFLICT EFFECT** | none moves — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | a report that disagrees with its source module's own read is an alert |
| **P · ROLLBACK / FORWARD REPAIR** | revert the application |
| **Q · MERGE GATE** | **MOD-010 has no `data.ts` and no table** — asserted by the module-boundary lint · figures reconcile to their owning modules |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B30

| | |
|---|---|
| **A · PURPOSE** | Build the canonical audit event and console-operation records, with a paired write across the window. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B30** · Stage 19 · **A19-001** · **C-18 · C-100 · C-101** |
| **C · PRECONDITIONS** | MP-B29 merged |
| **D · CURRENT EVIDENCE** | **three audit stores** — `audit_logs`, `message_audit_logs`, `console_audit` · `auditLog()` in `middleware/auth.ts` (CSR-047) · the purge cooldown reads `console_audit` |
| **E · TARGET RESULT** | DBT-079 `audit_events` and DBT-080 `console_operations`, linked by a UNIQUE FK; the taxonomy AET-001…AET-102; Class A coupling live. |
| **F · FILE PLAN — read** | the 18+ audit call sites · `server/console/audit.ts` (CSR-024) |
| **F · FILE PLAN — create** | `modules/audit/data.ts` · the event writer · the taxonomy mapping |
| **F · FILE PLAN — modify** | every audit call site |
| **F · FILE PLAN — move** | audit persistence out of `storage.ts` |
| **F · FILE PLAN — remove** | none — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-07 audit** · **DMR-004 · DMR-005 · DMR-022** |
| **H · API WORK** | **none built** — audit is written, not exposed as a new customer feature<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none new** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **Class A: an audit-write failure ROLLS THE BUSINESS TRANSACTION BACK** · **CK-A7 forbids an invented actor, authority or capability** · **`UNKNOWN/LEGACY` where the source never had the field** · **no known secret in an audit payload** |
| **L · TEST ACTIVATION** | **audit coupling · taxonomy coverage against the 67-capability register (A7-001) · CK-A7 · the known-secret scan** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | review the `UNKNOWN/LEGACY` provenance counts · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C001 (C-18) may CLOSE** · **IMP-C016 (C-100/C-101)** advances · **CBR-012 · CBR-013 introduced** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **a gap in the audit trail across the switch is the failure this batch exists to prevent** — three-way row reconciliation, scheduled |
| **P · ROLLBACK / FORWARD REPAIR** | the old path is primary and still writing |
| **Q · MERGE GATE** | three-way reconciliation green · **taxonomy coverage complete against 67 audit-required capabilities** · Class A coupling proved · **the purge-cooldown query returns the same answer on both trails** |
| **R · POST-MERGE SOAK** | two weeks of paired writes |
| **S · REMOVAL ELIGIBILITY** | none |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B31

| | |
|---|---|
| **A · PURPOSE** | Retire the legacy audit path after reconciliation. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B31** · Stage 19 |
| **C · PRECONDITIONS** | MP-B30's soak complete and its reconciliation green |
| **D · CURRENT EVIDENCE** | the paired write has been running since B-30 |
| **E · TARGET RESULT** | One audit path; the legacy writers gone; the snapshot quarantine in place. |
| **F · FILE PLAN — read** | the paired-write reconciliation output |
| **F · FILE PLAN — create** | none |
| **F · FILE PLAN — modify** | the audit call sites lose their legacy half |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **the legacy audit writers** — code only. **The legacy TABLES are not dropped here** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **no drop** — DMR-004/005/022's source tables survive until MIG-14 |
| **H · API WORK** | **none**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **the quarantine's restricted read is exercised by an authorised operator before the old path stops** |
| **L · TEST ACTIVATION** | audit suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | an authorised operator reads a quarantined snapshot successfully · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C016 (C-100/C-101) may CLOSE** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | zero writes to the legacy stores, asserted |
| **P · ROLLBACK / FORWARD REPAIR** | **restoring the legacy writer is possible; the events written in between are not re-derivable** — which is why the soak is two weeks |
| **Q · MERGE GATE** | **zero legacy audit writes** · reconciliation green · the quarantine readable · **CBR-012 · CBR-013 removed** |
| **R · POST-MERGE SOAK** | one week of zero-legacy-write assertions |
| **S · REMOVAL ELIGIBILITY** | **CBR-012 · CBR-013 removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B32

| | |
|---|---|
| **A · PURPOSE** | Remove Resend entirely, after SES has been the only sender through its soak. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B32** · Stage 17 · **A11-001** |
| **C · PRECONDITIONS** | MP-B31 merged; MP-B24's two-week delivery soak complete on SES |
| **D · CURRENT EVIDENCE** | `TARGET_EMAIL_PROVIDER` has been on SES since B-24's switch |
| **E · TARGET RESULT** | One sender in the code, the dependency, and the configuration. |
| **F · FILE PLAN — read** | every send site |
| **F · FILE PLAN — create** | none |
| **F · FILE PLAN — modify** | the send path loses its Resend branch |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **the Resend adapter · `resend` (DEP-C010 · DEP-I070) · the Resend configuration and secrets** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **none** |
| **H · API WORK** | **none**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **REMOVE `resend`** |
| **K · SECURITY** | **removing an unused provider credential is a security improvement** — the secret is deleted, not left dormant |
| **L · TEST ACTIVATION** | delivery suite — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | confirm the Resend API key is removed from every environment · **NOT RUN** |
| **N · CONFLICT EFFECT** | none closes — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | delivery rates unchanged across the removal |
| **P · ROLLBACK / FORWARD REPAIR** | **this is the point after which reverting to Resend is a re-integration, not a flip.** The soak is what makes that acceptable |
| **Q · MERGE GATE** | **no Resend code, dependency, configuration or secret remains** · delivery suite green · **CBR-011 removed** |
| **R · POST-MERGE SOAK** | none |
| **S · REMOVAL ELIGIBILITY** | **CBR-011 · DEP-C010 removed** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B33

| | |
|---|---|
| **A · PURPOSE** | Verify everything, then move authority to the new tables. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B33** · Stage 15 · **MIG-12 · MIG-13** · **MIGQ-1 = A** |
| **C · PRECONDITIONS** | MP-B32 merged; every domain batch's parity green; **the backup restore rehearsal PASSED** |
| **D · CURRENT EVIDENCE** | the old tables have been authoritative throughout; four flags are live; 37 legacy read routes remain |
| **E · TARGET RESULT** | MIG-12's full verification passes; MIG-13 switches the single authority under a scheduled write-freeze window; the four flags are deleted. |
| **F · FILE PLAN — read** | every reconciliation output |
| **F · FILE PLAN — create** | the cutover runbook instance |
| **F · FILE PLAN — modify** | the read paths switch |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **37 LRC rows** — the legacy money, custody, stock and object read routes — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-12** verification · **MIG-13** the switch. **Additive until here; MIG-13 is REVERSIBLE by reverting the application** |
| **H · API WORK** | **REMOVE 37 LRC rows**<br>**LRC built here:** — · **LRC removed here:** LRC-011 … LRC-228 (37) — §9 |
| **I · UI WORK** | **none new** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **RLS must hold on the new tables before the switch, not after** |
| **L · TEST ACTIVATION** | **the entire ACTIVE suite** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **MIGQ-1 = A's thirteen-step write-freeze sequence**, including **step 6: PROVE no target-changing transaction remains in flight — a query, not a wait** · **and step 11's critical smoke/read/invariant checks before writes reopen** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C010 (C-63 database half)** may close if the region is verified · CBR-006/007/008/009/010 all removable — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **the soak period after MIG-13 is defined before the window opens, not after** |
| **P · ROLLBACK / FORWARD REPAIR** | **MIG-13 is reversible by reverting the application while the old tables still exist.** After B-34 it is not |
| **Q · MERGE GATE** | **MIG-12 green: row parity · SUM parity on every money column · custody-chain continuity · zero orphans · RLS proven scoped** · the entire ACTIVE suite green · **all four flags deleted** · **CBR-006 · 007 · 008 · 009 · 010 removed** |
| **R · POST-MERGE SOAK** | **a stated period after MIG-13, watched — it is a precondition of B-35, not a formality** |
| **S · REMOVAL ELIGIBILITY** | **37 LRC rows · five CBR entries · four flags** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B34

| | |
|---|---|
| **A · PURPOSE** | Remove the legacy code — routes, screens, dependencies — each on its own recorded proof. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B34** · **§40's eleven-check proof** · **TXP-6 · TXP-7** |
| **C · PRECONDITIONS** | MP-B33 merged and its soak complete |
| **D · CURRENT EVIDENCE** | 170 legacy routes remain · one page file is a REMOVE candidate · several dependencies are unimported |
| **E · TARGET RESULT** | The LRC register is PROVED EMPTY; the unjustified-dependency register is empty; MIG-000 class D applied; the snapshot quarantine completes. |
| **F · FILE PLAN — read** | the whole repository, per wave |
| **F · FILE PLAN — create** | none |
| **F · FILE PLAN — modify** | `package.json` — **the dependency removals and the three `@types/*` moves to devDependencies** |
| **F · FILE PLAN — move** | **`@types/connect-pg-simple` · `@types/jsbarcode` · `@types/multer` → devDependencies** |
| **F · FILE PLAN — remove** | **170 routes in 13 ordered waves, one per route file** · **`admin/shared.tsx` on its four proofs** · **DEP-C001 · C003 · C004 · C005 · C021** · **CBR-004's `storage.ts` seam and CSR-014 `IStorage`** — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-000 class D** — the deprecation record. **NO TABLE IS DROPPED HERE** |
| **H · API WORK** | **REMOVE 170 LRC rows, in 13 waves, each its own commit and its own review**<br>**LRC built here:** — · **LRC removed here:** LRC-001 … LRC-234 (170) — §9 |
| **I · UI WORK** | **SCR-C036 `admin/shared.tsx`** — only on all four proofs |
| **J · DEPENDENCIES** | **REMOVE the unjustified direct dependencies, each on the four-part proof** |
| **K · SECURITY** | **removing a dead route removes an attack surface; removing a live one is an outage.** Which is why every wave carries the eleven-check proof |
| **L · TEST ACTIVATION** | **the legacy-zero gates — §40's seven registers** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **checks 5, 7 and 11 of the eleven — email links, provider callbacks, and public/support entry points — are MANUAL, per wave** · **NOT RUN** |
| **N · CONFLICT EFFECT** | **IMP-C007 (C-55) may CLOSE** with `next-themes` · **IMP-C022 (C-107) may CLOSE** when `wipe-school` is gone — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | **404 rates on every removed path, watched per wave** — a spike is a missed caller |
| **P · ROLLBACK / FORWARD REPAIR** | **Git is the archive** (TXP-6). A wave is revertible as one commit; **a wave that fails its proof STOPS the batch and the remaining waves do not run** |
| **Q · MERGE GATE** | **seven registers empty: LRC 234→0 · CBR 15→0 · SCR-C bridges 0 · unjustified dependencies 0 · flags 0 · legacy write paths 0 · DEFINED target tests 0** · **a registered route absent from API-001…API-283 fails CI** |
| **R · POST-MERGE SOAK** | one week per wave group before the next begins |
| **S · REMOVAL ELIGIBILITY** | **this batch IS the removal — and it removes NO DATA** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

### MP-B35

| | |
|---|---|
| **A · PURPOSE** | Run the one irreversible migration, and only after eleven conditions all hold. |
| **B · LOCKED AUTHORITIES** | Stage 22 **IMP-B35** · **MIG-14** · **§39's eleven conditions** · **A19-001** |
| **C · PRECONDITIONS** | **all eleven of §39's conditions**, and MP-B34's soak complete |
| **D · CURRENT EVIDENCE** | the deprecated tables and columns still exist; the quarantined snapshot bytes are in their separate bucket |
| **E · TARGET RESULT** | The deprecated tables and columns are dropped. **The quarantined bytes are not.** |
| **F · FILE PLAN — read** | the eleven condition checks |
| **F · FILE PLAN — create** | none |
| **F · FILE PLAN — modify** | none |
| **F · FILE PLAN — move** | none |
| **F · FILE PLAN — remove** | **the deprecated TABLES and COLUMNS, including `console_audit`** — and nothing else — **every removal entry's replacement, consumer switch, dead-code proof, test and removal batch are in §9's matrix and Stage 22 §10's per-row columns** |
| **G · DATABASE WORK** | **MIG-14 — IRREVERSIBLE** |
| **H · API WORK** | **none**<br>**LRC built here:** — · **LRC removed here:** — — §9 |
| **I · UI WORK** | **none** |
| **J · DEPENDENCIES** | **none** |
| **K · SECURITY** | **MIG-14 MAY NOT destroy the quarantined snapshot bytes. An APPROVED LEGAL / PRIVACY DISPOSITION is required, and no pipeline can satisfy it** — A19-001 |
| **L · TEST ACTIVATION** | **§39's gate** — §8's matrix gives each family its environment and its blocking status |
| **M · MANUAL VERIFICATION** | **OWNER RELEASE APPROVAL, explicit and recorded** · **the restore rehearsal must have PASSED — a backup that has not been restored is not a backup** · **NOT RUN** |
| **N · CONFLICT EFFECT** | none closes. **C-79 remains LEGAL and external** — §7's matrix holds each conflict's required proof |
| **O · OBSERVABILITY** | the eleven conditions are recorded as evidence with the migration |
| **P · ROLLBACK / FORWARD REPAIR** | **THERE IS NONE. This is the one irreversible step, and that is why it is last and why it has eleven conditions** |
| **Q · MERGE GATE** | **all eleven §39 conditions** — legacy consumers 0 · legacy writes 0 · MIG-12 reconciled · soak complete · quarantine complete · **bytes preserved and provably readable** · retention/policy gates satisfied · backup current · **restore rehearsal passed** · rollback accepted · **owner release approval** |
| **R · POST-MERGE SOAK** | **production release remains blocked by §17's twelve manual gates regardless** |
| **S · REMOVAL ELIGIBILITY** | **the source bytes for DMR-019 drop here — and the quarantined snapshot bytes DO NOT** |
| **T · EVIDENCE RECORD** | **NOT RUN** |

**MP-P7 · Where the route work lands, counted**

```
BUILD BATCHES        legacy routes whose TARGET is built there
   B-04      2
   B-06      7
   B-09      3
   B-10      1
   B-11      6
   B-13     40
   B-14      8
   B-15     17
   B-16     11
   B-17      3
   B-18     14
   B-19      8
   B-20      9
   B-21     16
   B-22      6
   B-23     11
   B-24      6
   B-25      7
   B-26      4
   B-27     11
   B-28     39
   B-29      4
   —         1

REMOVAL BATCHES      legacy routes removed there
   B-05      2
   B-10      1
   B-11      6
   B-12     11
   B-24      6
   B-28      1
   B-33     37
   B-34    170

   TOTAL  234  -- and no batch removes a route whose target it did not
                 first prove built and switched

THE LARGEST SINGLE REMOVAL BATCH IS B-34 WITH 170 ROUTES.
   -- and it is NOT one review.  Section 9.4 splits it into 13 ordered
      WAVES, one per route file, each its own commit, its own review and
      its own eleven-check proof, stopping on the first failure
```

---
## 6. Screen and dependency work per batch

**Every SCR-C and every DEP-C is mapped to the batch that performs it. A register entry with no batch
would be a promise, not a plan.**

### 6.1 SCR-C001 … SCR-C042 → batch

| SCR-C | Page file | Class | Batch | UI requirement carried into that batch |
|---|---|---|---|---|
| SCR-C001 | `login.tsx` | KEEP | **MP-B06 / MP-B09** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C002 | `forgot-password.tsx` | KEEP | **MP-B06 / MP-B09** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C003 | `reset-password.tsx` | KEEP | **MP-B06 / MP-B09** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C004 | `accept-invite.tsx` | KEEP | **MP-B06 / MP-B09** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C005 | `security.tsx` | KEEP | **MP-B06 / MP-B09** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C006 | `not-found.tsx` | KEEP | **MP-B04** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C007 | `privacy.tsx` | KEEP | **MP-B27** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C008 | `contact.tsx` | KEEP | **MP-B27** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C009 | `school-public.tsx` | KEEP | **MP-B27** | unchanged behaviour; **query-state adoption where it is missing** (CSR-022) |
| SCR-C010 | `admin.tsx` | MOVE | **MP-B13** | shell becomes a Stage 9 role entry point; the `:section?` switch is removed |
| SCR-C011 | `teacher.tsx` | MOVE | **MP-B13** | shell becomes a Stage 9 role entry point; the `:section?` switch is removed |
| SCR-C012 | `parent.tsx` | MOVE | **MP-B13** | shell becomes a Stage 9 role entry point; the `:section?` switch is removed |
| SCR-C013 | `finance.tsx` | MOVE | **MP-B13** | shell becomes a Stage 9 role entry point; the `:section?` switch is removed |
| SCR-C014 | `admin/dashboard.tsx` | REBUILD | **MP-B29** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C015 | `admin/students.tsx` | REBUILD | **MP-B14** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C016 | `admin/families.tsx` | REBUILD | **MP-B15** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C017 | `admin/allocations.tsx` | REBUILD | **MP-B21** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C018 | `admin/payments.tsx` | REBUILD | **MP-B19** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C019 | `admin/reconciliation.tsx` | REBUILD | **MP-B19** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C020 | `admin/classes.tsx` | REBUILD | **MP-B13** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C021 | `admin/books.tsx` | REBUILD | **MP-B16** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C022 | `admin/book-levels.tsx` | REBUILD | **MP-B18** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C023 | `admin/book-copies.tsx` | REBUILD | **MP-B16** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C024 | `admin/student-profile.tsx` | REBUILD | **MP-B21** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C025 | `admin/collection-sheet.tsx` | REBUILD | **MP-B21** | **the locked workflow changed; the components inside it mostly did not** — component salvage first, rebuild second |
| SCR-C026 | `admin/it-dashboard.tsx` | MERGE | **MP-B28** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C027 | `admin/system-health.tsx` | MERGE | **MP-B28** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C028 | `admin/db-console.tsx` | MERGE | **MP-B28** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C029 | `admin/owner.tsx` | MERGE | **MP-B28** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C030 | `admin/branding.tsx` | MERGE | **MP-B27** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C031 | `admin/media-library.tsx` | MERGE | **MP-B27** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C032 | `admin/website.tsx` | MERGE | **MP-B27** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C033 | `admin/setup.tsx` | MERGE | **MP-B13** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C034 | `admin/invite-staff-wizard.tsx` | MERGE | **MP-B13** | merged surface; **no capability is gained or lost by the merge** |
| SCR-C035 | `register.tsx` | KEEP + REFACTOR | **MP-B06 / MP-B09** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |
| SCR-C036 | `admin/shared.tsx` | **REMOVE** | **MP-B34** | **four proofs first** — not a surface · content relocated · import graph empty · §40 proof |
| SCR-C037 | `admin/communications.tsx` | KEEP + REFACTOR | **MP-B23** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |
| SCR-C038 | `admin/linking-codes.tsx` | KEEP + REFACTOR | **MP-B11** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |
| SCR-C039 | `admin/reports.tsx` | KEEP + REFACTOR | **MP-B29** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |
| SCR-C040 | `admin/users.tsx` | KEEP + REFACTOR | **MP-B13** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |
| SCR-C041 | `admin/family-enrollment.tsx` | KEEP + REFACTOR | **MP-B22** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |
| SCR-C042 | `admin/family-enrollment-import.tsx` | KEEP + REFACTOR | **MP-B22** | behaviour preserved, boundaries corrected; **axe green + the manual assessment for release** |

**MP-P8.1 · Every screen batch carries the same three UI requirements**

```
1  QUERY-STATE ADOPTION      a failed query is NOT a confident zero, and
                             there is ONE 401 redirect      CSR-022
                             -- imported by 2 of 42 pages today.  The fix
                                is ADOPTION, not replacement
2  UK FORMATTING             en-GB, GBP, formatYearGroup      CSR-021 KEPT
3  ACCESSIBILITY             axe green in CI, AND the surface is in scope
                             for the MANUAL WCAG 2.2 AA assessment if it
                             is one of the eight named surfaces   2A
```

### 6.2 DEP-C001 … DEP-C023 → batch

| DEP-C | Action | Batch | Gate |
|---|---|---|---|
| **DEP-C001** `@supabase/*` | REMOVE | **MP-B34** | zero importing files, re-proved at removal |
| **DEP-C002** `passport` · `passport-local` · their `@types` | REMOVE | **MP-B12** | the target auth path is live and SEC-T is green |
| **DEP-C003** `framer-motion` | REMOVE | **MP-B34** | zero importing files |
| **DEP-C004** `date-fns` | REMOVE | **MP-B34** | zero importing files; `lib/format.ts` is the formatting layer |
| **DEP-C005** `next-themes` | REMOVE | **MP-B34** | the one importing file goes with it — **IMP-C007 / C-55** |
| **DEP-C006** `memorystore` | REMOVE | **MP-B12** | **a non-test boot selecting memory mode fails to boot** — CBR-005 |
| **DEP-C007** `bcryptjs` + `@types` | REPLACE → Argon2id | **MP-B12** | **CBR-002's rehash count reported**; residual accounts recorded with a live reset path |
| **DEP-C008** hand-rolled TOTP | REPLACE → a maintained library | **MP-B09** | an authenticator enrolled before the change still verifies |
| **DEP-C009** `xlsx@0.18.5` | **REPLACE THE DISTRIBUTION** — vendored SheetJS 0.20.3+, server-side only | **MP-B22** | no `xlsx` in any `client/**` file; **version, source and named owner recorded — TR-010** |
| **DEP-C010** `resend` | REMOVE after the SES cutover | **MP-B32** | **CBR-011 removed; never dual-send** |
| **DEP-C011** AWS SDK (S3, SES, STS) | ADD | **MP-B02 / MP-B24 / MP-B26** | used by the batch that adds it |
| **DEP-C012** `aws-cdk-lib` + `constructs` | ADD — **dev only** | **MP-B02** | **infrastructure, never a runtime import**; no second infrastructure tool |
| **DEP-C013** `@sentry/node` · `@sentry/react` | ADD | **MP-B10** | the EU region is chosen first, and it is irreversible |
| **DEP-C014** `vitest` · `@vitest/browser` | ADD — dev | **MP-B04** | the unit stage runs |
| **DEP-C015** `playwright` / `@playwright/test` | ADD — dev | **MP-B04** | the E2E stage runs |
| **DEP-C016** `@axe-core/playwright` | ADD — dev | **MP-B04** | the accessibility stage runs |
| **DEP-C017** `argon2` (or the selected binding) | ADD | **MP-B06** | DEP-C007's replacement is live before DEP-C007 is removed — **IMP-P3** |
| **DEP-C018** `pg` · `@neondatabase/serverless` · `drizzle-orm` · `drizzle-zod` | KEEP | — | **both drivers stay; A13-001 constrains which one RLS reads use** |
| **DEP-C019** the Stage 11 target stack | KEEP | — | — |
| **DEP-C020** `ws` · `@types/ws` | **KEEP** | — | **DO NOT REMOVE.** A required peer of the Neon driver's WebSocket path — **it breaks at runtime in production, not in CI** |
| **DEP-C021** `@jridgewell/trace-mapping` · `tailwindcss-animate` · `@hookform/resolvers` · `zod-validation-error` | **REMOVE / INVESTIGATE** | **MP-B34** | the four-part proof, per package — **and the two form helpers may legitimately be ADOPTED instead** |
| **DEP-C022** `file-type` | **KEEP — for the target** | **MP-B26** | it becomes imported by the object pipeline, or its keep is revisited |
| **DEP-C023** `@types/node` | UPGRADE | **MP-B04** | matches the Node 24 single authority |

**MP-P8.2 · Removal requires four things, per package, every time**

```
NO IMPORT . NO RUNTIME REQUIREMENT . NO PEER REQUIREMENT . CI GREEN WITHOUT IT

A GREP THAT FINDS NOTHING IS THE FIRST OF FOUR, NOT THE PROOF.
   -- `ws` is the standing counter-example, and DEP-I097 says so
```

**MP-P8.3 · The three `@types/*` packages sitting in `dependencies`** — `@types/connect-pg-simple`,
`@types/jsbarcode`, `@types/multer` — **move to `devDependencies` at MP-B34.** They ship nothing and
inflate the runtime install. **This is a package.json hygiene change, and it is still a change with a
batch and a gate.**

---

## 7. Conflict closure matrix — IMP-C001 … IMP-C022

**Every still-open C-* has a row. A conflict is never pre-closed, and "the architecture describes the
fix" is never the evidence.**

| IMP-C | Conflict | Type | Owning batch | Required AUTOMATED proof | Required MANUAL proof | External dependency | State ENTERING implementation | State that MAY follow success |
|---|---|---|---|---|---|---|---|---|
| **IMP-C001** | **C-18 / BR-124** | IMPLEMENTATION | **MP-B30** | the known-secret scan finds no secret in an audit payload | — | — | OPEN | CLOSED, once the scan is ACTIVE and green |
| **IMP-C002** | **C-19** | IMPLEMENTATION + PROVISIONING | **MP-B03**, with MP-B02's roles | **SEC-T15 demonstrated RED at B-02/B-03, then green** | reviewer confirms the two bypasses are gone by reading the role grants, not the code | the six DB roles must actually exist | OPEN | CLOSED, only after the red demonstration |
| **IMP-C003** | **C-21** | IMPLEMENTATION | **MP-B09** | SEC-T02 … SEC-T09 green | — | — | OPEN | CLOSED |
| **IMP-C004** | **C-23** | IMPLEMENTATION | **MP-B12** | full SEC-T green with `TARGET_AUTHORITY_PATH` **deleted from the codebase** | — | — | OPEN | CLOSED |
| **IMP-C005** | **C-25** | IMPLEMENTATION | **MP-B11** | linking suite green; **LRC-203 returns 404** | the linking-code deprecation window has elapsed — §9.3 | — | OPEN | CLOSED, when the one-step path is GONE, not when the two-step path works |
| **IMP-C006** | **C-26** | IMPLEMENTATION | **MP-B24** | §21's import suite green on **both modes**; LRC-222 and LRC-223 return 404 | — | — | OPEN | CLOSED |
| **IMP-C007** | **C-55** | IMPLEMENTATION | **MP-B34** | `next-themes` absent from `package.json`; build green | one appearance confirmed visually | — | OPEN | CLOSED |
| **IMP-C008** | **C-58** | IMPLEMENTATION | **MP-B22** | no `xlsx` import in any `client/**` file; the browser bundle contains no workbook parser | the vendored SheetJS version, its source URL and its named owner are recorded — **TR-010** | — | OPEN | CLOSED |
| **IMP-C009** | **C-63 — compute half** | **PROVISIONING** | **MP-B04's redeploy** | PFL-002 confirms `lhr1` **is the only execution region** | — | **a Vercel project setting** | OPEN | CLOSED for the compute half ONLY |
| **IMP-C010** | **C-63 — database half** | **PROVISIONING** | **PFL-004, or Stage 22 §32's conditional migration** | the region reported by the live database is `eu-west-2` | — | **Neon. A region cannot be changed after project creation** | OPEN | CLOSED only when the live database is in region |
| **IMP-C011** | **C-72 / C-73** | IMPLEMENTATION + PROVISIONING | **MP-B02 + MP-B03** | PFL-007 · PFL-008 · PFL-021 | — | AWS accounts and OIDC trust | OPEN | CLOSED |
| **IMP-C012** | **C-76** | IMPLEMENTATION | **MP-B16** | `admin/books.tsx` calls **API-087**; a request to `/api/isbn-lookup/:isbn` is not made by any client file | — | — | OPEN | CLOSED |
| **IMP-C013** | **C-78** | IMPLEMENTATION | **MP-B03** | a deployment path invoking `db:push` **fails the build**; MIG-T01 · MIG-T02 green | — | — | OPEN | CLOSED |
| **IMP-C014** | **C-79** | **LEGAL / POLICY** | **NONE — and that is correct** | **none exists, and none may be invented** | **the approved legal decision** | **BytHub Legal & Compliance** | OPEN | **only the approved decision closes it. A migration does not.** |
| **IMP-C015** | **C-90** | IMPLEMENTATION | **MP-B09** | **SEC-T03 demonstrated RED first**, then green | — | — | OPEN | CLOSED, only after the red demonstration |
| **IMP-C016** | **C-100 · C-101** | IMPLEMENTATION | **MP-B30 / MP-B31**, with the quarantine | three-way reconciliation green; quarantine reconciled | the quarantine's restricted read is exercised by an authorised operator | — | OPEN | CLOSED |
| **IMP-C017** | **C-102** | IMPLEMENTATION | **MP-B20 + MP-B30** | **an induced audit-write failure rolls the whole business transaction back** — Class A coupling | — | — | OPEN | CLOSED |
| **IMP-C018** | **C-103** | **SPECIFICATION — RESOLVED** | **NONE, and none is invented** | — | **DONE: A7-001** corrects Stage 7 §20's headline from **58 of 95** to **67 of 95**, matching its own per-capability register | — | **TARGET SPECIFICATION RESOLVED** | **already resolved.** Stage 19's taxonomy and Stage 20's coverage check point at the authoritative **67-capability register**; **no application implementation is required to change a count, and no fake batch is created to do it** |
| **IMP-C019** | **C-104** | **POLICY RESOLVED / EVIDENCE OPEN** | **NONE — per release** | axe checks green on the eight surfaces | **the MANUAL WCAG 2.2 AA assessment, per release** — decision **2A** | an assessor | POLICY RESOLVED | **evidence is per-release and never permanently closed** |
| **IMP-C020** | **C-105** | **SPECIFICATION RESOLVED (A4-001) / IMPLEMENTATION OPEN** | **MP-B22** | the import commits **one logical row per transaction**, with durable progress and non-duplicating resume | — | — | **TARGET SPECIFICATION RESOLVED** | implementation CLOSED at B-22; **the specification was already resolved and does not re-close** |
| **IMP-C021** | **C-106** | **TARGET RESOLVED (A14-001) / IMPLEMENTATION OPEN** | **MP-B04 builds API-283; MP-B05 removes LRC-048 · LRC-162** | PFL-015 end-to-end in staging | — | **the Vercel cron configuration** | **TARGET RESOLUTION ESTABLISHED** | CLOSED when the old route is gone |
| **IMP-C022** | **C-107** | **SPECIFICATION RESOLVED / IMPLEMENTATION OPEN** | **MP-B28** | **API-247's behaviour · the lifecycle-state transition · idempotency · CAP-084 · SC-7 · the legacy `wipe-school` caller switched · the old `wipe-school` route no longer registered** | **verify by review that the replacement is NOT wired to API-276/CAP-036 erase-account, nor to API-277/CAP-092 purge** | — | **TARGET SPECIFICATION RESOLVED** — owner decision **C-107 = A**, recorded as **A14-003** | **CLOSED only when the old conflicting path has actually been removed AND the evidence exists.** A resolved specification is not a removed route |

**MP-P9 · The four things that never close a conflict**

```
A GREEN BUILD                    a compiler is not a security control
A CODE REVIEW SAYING "LOOKS RIGHT"
AN ARCHITECTURE DOCUMENT DESCRIBING THE FIX
A MIGRATION THAT RAN

   -- IMP-C014 (C-79) has NO owning implementation batch, deliberately.
      It is LEGAL, and giving it a batch would be a false claim of
      engineering control
   -- IMP-C018 (C-103) has none either, and for the opposite reason: it is
      ALREADY RESOLVED by A7-001.  Creating a batch whose job is to edit a
      Markdown count would be a fake implementation task
   -- IMP-C022 (C-107) NOW HAS ONE -- MP-B28 -- because the owner resolved
      the specification.  Its IMPLEMENTATION was always open
   -- IMP-C019 (C-104) NEVER permanently closes.  Its evidence is
      per-release, by decision 2A
```

**MP-P10 · A provider gate does not close because code compiles. A legal gate does not close because a
migration exists.** IMP-C009, IMP-C010, IMP-C011 and IMP-C021 all depend on **provisioning that this
plan does not perform**; IMP-C014 depends on a decision this plan cannot make.

---

## 8. Test activation matrix

**MP-P11 · Stage 20's four states, and there is no fifth**

```
DEFINED -> (demonstrate RED where a defect exists) -> ACTIVE -> GREEN

FORBIDDEN, EVERYWHERE
   continue-on-error . allow_failure . skip registry
   an "expected failures" list on a protected branch
   "main is red because these failures are expected"

NO KNOWN-RED SECURITY TEST MERGES.              Stage 20 TST-D036 . D093

AT FINAL IMPLEMENTATION CUTOVER:
   DEFINED target tests = 0
   -- the register step prints an empty list, or the cutover is incomplete
```

| Family | Activated across | First activation | Merge-blocking | Release-blocking | Environment |
|---|---|---|---|---|---|
| **TST-D001 … D095** | every batch | **MP-B04** | **YES** | YES | CI |
| **INV-T01 … T14** | MP-B17 · **MP-B20** · MP-B21 | **MP-B17** | **YES** | YES | **real PostgreSQL** — IMP-P8 |
| **TEN-T01 … T12** | MP-B07 · MP-B14 · MP-B15 · MP-B25 | **MP-B07** | **YES** | YES | **real PostgreSQL, non-owner role** — IMP-P7 |
| **SEC-T01 … T18** | MP-B06 … MP-B12 · MP-B26 · MP-B28 | **MP-B02/B-03 (SEC-T15 red)** | **YES — no known-red security test merges** | YES | real PostgreSQL + staging |
| **MIG-T01 … T10** | MP-B03 · MP-B05 · MP-B33 · MP-B35 | **MP-B03** | **YES** | YES | real PostgreSQL |
| **E2E-T01 … T08** | MP-B25 · MP-B27 · MP-B33 | **MP-B25** | YES | YES | staging, Playwright |
| **accessibility — axe** | MP-B25 · MP-B27 · MP-B29 | **MP-B25** | YES | YES | CI, Playwright + axe |
| **accessibility — MANUAL WCAG 2.2 AA** | **per release** | **before the first production release** | **NO** | **YES — decision 2A, MANDATORY BEFORE PRODUCTION GO-LIVE** | a human assessor, eight surfaces |

**MP-P12 · The two named red-first tests, and where each turns green**

| Test | Defect | Red demonstrated in | Green in | Why red first is not optional |
|---|---|---|---|---|
| **SEC-T03** | MFA enrolment requires no password — **C-90** | **MP-B09** | **MP-B09** | a test that has never failed against the defect proves nothing about the fix |
| **SEC-T15** | the console read tier's two bypasses — **C-19** | **MP-B02** (roles provisioned) + **MP-B03** (schema half) | **MP-B03** | the same, and the bypass is a tenancy hole |

**MP-P13 · Activation is recorded, not assumed**

```
EACH BATCH'S FIELD L NAMES:
   the tests that leave DEFINED in THIS batch
   the red demonstration, where one applies
   the green requirement

AND FIELD T RECORDS: the exact command, the result, the date, the commit,
the reviewer and the environment.
   -- an ACTIVE test with no recorded green run is DEFINED, not ACTIVE
```

---

## 10. Non-route bridge matrix — consuming CBR-001 … CBR-015

**Stage 22 §11 holds each bridge's authorities and batches. This section holds the execution shape.**

**MP-P14 · Every CBR passes the same seven steps**

```
1  AUTHORITATIVE SIDE NAMED     before the bridge exists.  Never "both"
2  COPY SIDE INTRODUCED         written, not read as truth
3  ACTIVATION                   the bridge is live; behaviour unchanged
4  DRIFT CHECK RUNNING          scheduled, and DIVERGENCE IS AN ALERT
5  SWITCH                       the copy becomes the authority.  THIS is
                                the moment the truth moves, and it is one
                                deliberate act, not a drift
6  SOAK                         a stated period, watched
7  REMOVAL                      the old side and the bridge both go
```

| CBR | Authoritative until the switch | Switch batch | Removal batch | Drift check | The failure it prevents |
|---|---|---|---|---|---|
| **CBR-001** authorization | **the legacy role check** | per domain batch | **MP-B12** | a handler on the capability path still reading a role string **fails the build** | a partial switch leaving a handler with no check at all |
| **CBR-002** password verification | both formats verify; **only Argon2id is written** | **MP-B06** | **MP-B12** | count of remaining bcrypt hashes, per run | locking every existing user out on cutover day |
| **CBR-003** TOTP | **the stored secret** | **MP-B09** | **MP-B09** | verification-failure rate | invalidating every enrolled authenticator |
| **CBR-004** `storage.ts` seam | **whichever side owns the slice** | per domain batch | **MP-B34** | module-boundary lint | a second god object appearing as the "new" one |
| **CBR-005** memory-mode storage | **the database, always** | **MP-B06** | **MP-B12** | a non-test boot selecting memory mode **fails to boot** | silent data loss in an environment nobody checked |
| **CBR-006** identity reads | **the OLD tables** | MP-B06 … B-12 | **MP-B33** | person-count parity, each batch | a user resolving to two persons, or none |
| **CBR-007** money reads/writes | **the OLD tables** | **MP-B20** | **MP-B33** | **sum parity per money column** — divergence ALERTS | two authorities disagreeing about what a family owes |
| **CBR-008** allocation / custody reads | **the OLD table** | **MP-B21** | **MP-B33** | per-domain parity + **chain continuity** | a custody chain with a hole in it |
| **CBR-009** stock truth | **the transaction record, always** | **MP-B17** | **MP-B33** | **the projection recomputes to the stored value** | a double deduction on distribution day |
| **CBR-010** object bytes | **the DATABASE bytes** | **MP-B26** | **MP-B33** | per-object hash, size and content-type | a read switching to an object that was never copied |
| **CBR-011** email sender | **Resend** | **MP-B24** | **MP-B32** | delivery, bounce and complaint parity | **a parent receiving two identical invitations** |
| **CBR-012** audit writer | **the OLD path** | **MP-B30** | **MP-B31** | three-way row reconciliation | a gap in the audit trail across the switch |
| **CBR-013** console operation trail | **`console_audit`** | **MP-B30** | **MP-B31** | **the purge-cooldown query returns the same answer on both** | a purge cooldown that silently stops being enforced |
| **CBR-014** rate limiting | the stored counters | **MP-B09** | **MP-B12** | limiter behaviour under a concurrent burst | a limiter that holds in test and not under load |
| **CBR-015** schema application | **the runner, from B-03** | **MP-B03** | **MP-B03** | a deployment path invoking `db:push` **fails the build** | an unreviewed schema change reaching production |

**MP-P15 · The absolute rule, restated because it is the one that gets eroded**

```
NO TWO EQUAL AUTHORITIES.  EVER.

   ONE ACTIVE EMAIL SENDER          never dual-send
   ONE AUTHORITATIVE WRITE PATH     never old-and-new
   THE LEGACY CHECK IS AUTHORITATIVE UNTIL THE TARGET ONE IS PROVED

AT FINAL TARGET:  CBR COUNT = 0.
```

---
## 9. Route cutover execution matrix — consuming LRC-001 … LRC-234

**Stage 22 §10 holds the per-route data: exact method, exact path, file, caller, target API-nnn or
NONE, build batch, consumer-switch batch, removal batch, removal gate. It is not restated here.**
**This section holds the EXECUTION MECHANICS: the order, the proof, the commit boundaries.**

### 9.1 The four steps every single LRC passes through

```
STEP 1   BUILD THE TARGET          in the LRC's BUILD batch
         -- the target contract exists, is tested, and is reachable
         -- THE LEGACY ROUTE IS UNTOUCHED.  Both work

STEP 2   SWITCH THE CONSUMERS      in the LRC's SWITCH batch
         -- client/src call sites . server-internal callers . EMAIL LINKS .
            cron/vercel.json . PROVIDER CALLBACK targets . tests . scripts
         -- the legacy route still answers.  Nothing has been removed

STEP 3   PROVE IT DEAD             before the removal commit
         -- the eleven-check proof, Stage 22 §40.  RECORDED WITH THE COMMIT

STEP 4   REMOVE                    in the LRC's REMOVAL batch
         -- one commit, one route or one tightly-related family, proof
            attached

A ROUTE THAT FAILS STEP 3 GOES BACK TO STEP 2.  IT IS NOT REMOVED ANYWAY.
```

### 9.2 The eleven-check proof, as an executable checklist

| # | Check | How it is run |
|---|---|---|
| 1 | static import / reference | repository search for the exact path string, and for any template-literal prefix of it |
| 2 | **dynamic** `import()` / computed path | search for the path's parent segment inside a template literal — **`/api/admin/users/${id}/suspend` does not match a search for the literal path**, and that is how a live caller gets missed |
| 3 | route registration | the handler is gone from `server/routes/**` **and** `routes/index.ts` no longer registers it |
| 4 | client caller | `client/src/**`, normalised for `${…}` parameters |
| 5 | **EMAIL LINK** | any template that has ever embedded the path — **an invite link sitting in an inbox is a caller** |
| 6 | cron / scheduled caller | `vercel.json` and any scheduled job configuration |
| 7 | **PROVIDER CALLBACK** | any URL registered with a provider — **a webhook target is a caller you cannot grep for** |
| 8 | test dependency | `tests/**` |
| 9 | script dependency | `script/**` |
| 10 | migration dependency | `migrations/**` |
| 11 | public entry / support flow | documented support procedures and any public entry point |

**Checks 5, 7 and 11 cannot be satisfied by a repository search. They are MANUAL, and they are
recorded as manual in field M of the batch that performs the removal.**

### 9.3 Deprecation periods — where a search cannot reach the caller

| Route family | Why a search is not enough | Required before removal |
|---|---|---|
| **invite tokens** — LRC-145; and API-008 / API-009's paths, which are already at target | a live invite sits in someone's inbox | **the invite's own measured lifetime expires, OR the invite is reissued and communicated first** — Stage 22 §15.1 |
| **child linking codes** — LRC-203 · LRC-204 · LRC-205 | a code may be on paper, in a letter home | **the linking code's own measured lifetime — A SEPARATE WINDOW FROM INVITES**, §15.2 |
| **the cron transport** — LRC-048 (GET) · LRC-162 (POST) | the caller is the Vercel platform, configured outside the repository | **`vercel.json` switched to API-283 and PFL-015 verified end-to-end in staging BEFORE removal** — §9.6 |
| **the payment callback** — the `webhooks/payment-update` row | the caller is a payment provider's configuration | **the provider's target updated and a signed test event received on API-279 before removal** |
| **public site reads** — the four `public/schools/*` rows | a school's own website may deep-link them | **the PublishedSite contract serving that school, verified, before the old reads go** |

**Every other LRC's callers are inside this repository, and checks 1–4 and 8–10 reach them.**

### 9.4 MP-B34's removal waves — the answer to "remove all legacy APIs as one task"

**B-34 removes 170 routes. That is a BATCH boundary, not a REVIEW boundary.**

```
MP-B34 IS EXECUTED AS ORDERED WAVES, ONE PER CURRENT ROUTE FILE.
   -- each wave is its OWN COMMIT and its OWN REVIEW
   -- each wave carries the eleven-check proof for EVERY route in it
   -- a wave that fails its proof STOPS, and the remaining waves do not run
      IMP-P11: a failed batch stops the sequence, and a failed wave stops
      the batch

THIS IS TASK GRANULARITY INSIDE A LOCKED BATCH.  It does not change
IMP-B34's boundary, its authorities, or its position in the sequence.
```

| Wave | Route file | Routes | Reviewed as |
|---|---|---|---|
| **W01** | `book.routes.ts` | **39** | one commit — LRC-003 … LRC-224 |
| **W02** | `setup.routes.ts` | **22** | one commit — LRC-028 … LRC-216 |
| **W03** | `owner.routes.ts` | **21** | one commit — LRC-012 … LRC-201 |
| **W04** | `user.routes.ts` | **18** | one commit — LRC-001 … LRC-230 |
| **W05** | `family-enrollment.routes.ts` | **17** | one commit — LRC-009 … LRC-178 |
| **W06** | `message.routes.ts` | **11** | one commit — LRC-082 … LRC-231 |
| **W07** | `db-console.routes.ts` | **10** | one commit — LRC-065 … LRC-186 |
| **W08** | `notification.routes.ts` | **8** | one commit — LRC-020 … LRC-115 |
| **W09** | `parent.routes.ts` | **7** | one commit — LRC-079 … LRC-209 |
| **W10** | `dashboard.routes.ts` | **5** | one commit — LRC-019 … LRC-067 |
| **W11** | `website.routes.ts` | **5** | one commit — LRC-017 … LRC-233 |
| **W12** | `student.routes.ts` | **4** | one commit — LRC-014 … LRC-234 |
| **W13** | `public.routes.ts` | **3** | one commit — LRC-087 … LRC-210 |
| | **TOTAL** | **170** | **13 commits, 13 reviews** |

### 9.5 The 64 routes removed before B-34, and why each group goes early

| Removal batch | Routes | Why it does not wait |
|---|---|---|
| **B-05** | **2** — LRC-048 … LRC-162 | **the cron transport.** `vercel.json` points at it, and leaving two live scheduler entry points is a second way to fire a job. |
| **B-10** | **1** — LRC-217 … LRC-217 | **`POST /api/seed-users`** — a development seeder inside the production route tree (F-9). It is guarded by `NODE_ENV` today, and **that is not the control the target relies on**. |
| **B-11** | **6** — LRC-060 … LRC-220 | **the linking-code paths.** C-25 closes only when the one-step path is gone, and the two-step path must be the only path. |
| **B-12** | **11** — LRC-035 … LRC-152 | **the authority cutover completes here.** Duplicate and alias auth/staff routes must not outlive the capability switch — each is a second door with a different lock. |
| **B-24** | **6** — LRC-052 … LRC-223 | **the duplicate import pipeline.** Two commit paths for children records is exactly the defect C-26 names. |
| **B-28** | **1** — LRC-187 … LRC-187 | **arbitrary SQL.** `POST /api/owner/db/query` has no target and no successor; it goes once API-271 and API-272 exist. |
| **B-33** | **37** — LRC-011 … LRC-228 | **the read-switch.** MIG-13 moves authority to the new tables, and the legacy money, custody, stock and object read routes cannot survive it. |


### 9.6 The cron mapping, stated exactly — because the halves go to different targets

**Measured, `server/routes/cron.routes.ts:298–300`:**

```
// POST is the mutating verb; GET is kept because Vercel Cron issues GET.
app.get("/api/cron/run", handler);
app.post("/api/cron/run", handler);

── ONE SHARED HANDLER.  The current route is TRANSPORT AND RUNNER FUSED,
   and separating them is exactly what A14-001 exists to do
```

| Legacy | Target | Method | Why |
|---|---|---|---|
| **LRC-048** `GET /api/cron/run` | **API-283** `/api/internal/jobs/trigger` | **GET** | **Vercel cron issues GET only** — a verified first-party fact. The GET entry point is a TRANSPORT, and API-283 is the authenticated transport adapter |
| **LRC-162** `POST /api/cron/run` | **API-278** `/api/internal/jobs/run` | **POST** | its POST shape already matches the target runner's method and role — **CAP-093 · SC-10 · MOD-014** |

```
FORBIDDEN, AND STATED SO IT CANNOT DRIFT DURING MP-B04

   DO NOT map Vercel's GET transport directly to API-278
   DO NOT add a GET method to API-278
   DO NOT perform LOOPBACK HTTP from API-283 to API-278

   BOTH TARGET TRANSPORTS CALL THE SAME UNDERLYING APPLICATION SERVICE.
   -- the adapter is a transport, not a client of its own API
   -- the Vercel cron header and user-agent are NOT authentication
   -- an unpredictable path segment is DEFENCE IN DEPTH, not authorization
```

**MP-B04** builds both target scheduler surfaces and switches `vercel.json` to **API-283**.
**MP-B05** removes both legacy handlers — **and only after** the target transport is tested, the target
runner is tested, the Vercel path is switched, and **the staging scheduler preflight (PFL-015) passes**.

**C-106 IS NOT CLOSED BY THE MAPPING BEING CORRECT.** It closes only when: API-283 is built · API-278
is built or correctly retained · Vercel calls API-283 · scheduler authentication works · **jobs run
once** · and both `/api/cron/run` handlers are gone.

---

**MP-P8 · No wave and no early removal touches a route whose target was not built and switched in an
earlier batch.** The build and switch batches all precede every removal batch, and Stage 22 §10's
per-row `Bld · Sw · Rm` columns are what make that checkable rather than asserted.

---

## 11. Database execution matrix — consuming DMR-001 … DMR-027 and MIG-01 … MIG-14

**MP-P16 · Every DMR and every MIG passes the same eight-step gate**

```
1  PRECONDITION QUERY      the source is in the state the transform assumes
2  BACKUP CURRENT + VERIFIED
3  MIGRATION RUNS          transactional and re-runnable, or explicitly not
4  VERIFICATION QUERY      the transform did what it said
5  RECONCILIATION          source vs target, by the DMR's own check
6  SOURCE-WRITE STOP POINT the batch after which nothing writes the source
7  SOURCE-READ STOP POINT  the batch after which nothing reads the source
8  CONTRACT / DROP ELIGIBILITY   NOT the same as step 7, and never earlier

STEP 8 IS NEVER REACHED BY STEPS 1-7 ALONE.  It also requires §14's gate.
```

| DMR | Implemented in | Migration | Reconciliation that must pass | Source-write stop | Source-read stop | Drop eligible |
|---|---|---|---|---|---|---|
| **DMR-001** schools | MP-B13 | MIG-07 school | row parity; **`UNKNOWN` where lifecycle history cannot be derived** | B-13 | **B-33** | B-35 |
| **DMR-002** users — **the highest-risk transform** | **MP-B06** | MIG-07 identity | **person-count parity · every user resolves to exactly ONE person · credential parity** | B-06 | **B-33** | B-35 |
| **DMR-003** invites | MP-B11 | MIG-07 | parity; **a live invite issued before the cutover still accepts after it** — §15.1 | B-11 | **B-33** | B-35 |
| **DMR-004 · 005** audit_logs · message_audit_logs | **MP-B30** | MIG-07 audit | row parity; **`UNKNOWN/LEGACY` where the source never had the field** | B-30 | **B-31** | B-35 |
| **DMR-006** academic | MP-B13 | MIG-07 school | parity per table | B-13 | B-33 | B-35 |
| **DMR-007** children | **MP-B14** | MIG-07 children | **count parity — and it is a CHILD-RECORD count** | B-14 | B-33 | B-35 |
| **DMR-008** catalogue | MP-B16 | MIG-07 catalogue | parity; level membership reconciled | B-16 | B-33 | B-35 |
| **DMR-009** families and guardians | **MP-B15** | MIG-07 family | **relationship parity: NO CHILD LOSES A GUARDIAN, no guardian loses a child** | B-15 | B-33 | B-35 |
| **DMR-010** linking codes | MP-B11 | MIG-07 | **a live code still redeems** — §15.2, separate window from invites | B-11 | B-33 | B-35 |
| **DMR-011** cycles and requirements | MP-B18 | MIG-07 cycles | line-count parity; **money lines reconcile to source** | B-18 | B-33 | B-35 |
| **DMR-012** money | **MP-B19** | MIG-07 finance | **SUM PARITY ON EVERY MONEY COLUMN** | B-19 | **B-33** | B-35 |
| **DMR-013** allocations | **MP-B21** | MIG-07 custody | allocation parity · handover parity **where source evidence exists** · exception parity **where source evidence exists** · **no fabricated actor · no fabricated timestamp · no orphan target event** | B-21 | B-33 | B-35 |
| **DMR-014** custody_events | **MP-B21** | MIG-07 custody | **CHAIN CONTINUITY, not count.** Migrated INDEPENDENTLY, append-only, and **it wins wherever it exists** | B-21 | B-33 | **B-35 — and the chain is preserved, not dropped** |
| **DMR-015** stock | **MP-B17** | MIG-07 stock | **the projection recomputes to the stored value · sum parity per book per school · NO DOUBLE MOVEMENT** | B-17 | B-33 | B-35 |
| **DMR-016** replacements | MP-B21 | MIG-07 | parity | B-21 | B-33 | B-35 |
| **DMR-017** messages | MP-B23 | MIG-07 messaging | parity; **no message body enters audit** | B-23 | B-33 | B-35 |
| **DMR-018** CMS | MP-B27 | MIG-07 CMS | parity per section type | B-27 | B-33 | B-35 |
| **DMR-019** media | **MP-B26** | **MIG-11** | **hash, size and content-type reconciled PER OBJECT** | B-26 | **B-33** | **B-35 — the source bytes drop only at MIG-14** |
| **DMR-020** notification preferences | MP-B24 | MIG-07 notifications | parity | B-24 | B-33 | B-35 |
| **DMR-021** rate_limits | MP-B09 | — | **retained unchanged** | — | — | **not dropped** |
| **DMR-022** console_audit | **MP-B30** | MIG-07 audit | **three-way: attribution, operations, and the QUARANTINED snapshot bytes** | B-30 | B-31 | **B-35 for the TABLE. The quarantined BYTES are never dropped by MIG-14** |
| **DMR-023** school_branding | MP-B13 | MIG-07 school | both halves reconcile to the source row | B-13 | B-33 | B-35 |
| **DMR-024** cron_job_runs | MP-B04 | MIG-07 | **the one-run-per-day invariant still holds after the index change** | B-04 | B-33 | B-35 |
| **DMR-025** user_permissions | **MP-B06** | MIG-07 identity | **every current grant resolves to an authority and a scope; any that does not is RECORDED, not dropped** | B-06 | B-33 | B-35 |
| **DMR-026** user_sessions | MP-B09 | — | **retained unchanged** — its shape is fixed by the session store. **Live sessions are a CUTOVER concern, not a transform** | — | — | **not dropped** |
| **DMR-027** teacher_profiles | MP-B13 | MIG-07 identity | **membership parity: no staff member loses a school** | B-13 | B-33 | B-35 |

**MP-P17 · The eight named high-emphasis transforms, and what makes each dangerous**

| | The danger, stated plainly |
|---|---|
| **DMR-002 identity** | one user becoming two persons, or none. **Everything downstream keys on person identity** |
| **DMR-009 guardians** | a child losing a guardian is a safeguarding failure, not a data-quality issue |
| **DMR-012 money** | a family being told they owe the wrong amount, or a settlement disappearing |
| **DMR-013 allocations** | **fabricating a hand-over that never happened** — Stage 22 §24.1 is the control, and MP-B21's field M is where it bites |
| **DMR-014 custody** | a chain with a hole in it, which cannot be reconstructed later |
| **DMR-015 stock** | **a double deduction**, discovered on distribution day |
| **DMR-019 objects** | a read switching to bytes that were never copied |
| **DMR-022 audit** | losing the trail that would prove what happened during the migration itself |

**MP-P18 · No data is deleted because the code no longer imports the table**

```
CODE DELETION RULE     no static import . no dynamic import . no route .
                       no caller . no email link . no callback . no test .
                       no script . no migration . no support flow
                       -> DELETE, with the proof recorded    IMP-P5

DATA DELETION RULE     MIGRATED . RECONCILED . BACKED UP . RESTORE
                       REHEARSED . SOAKED . POLICY SATISFIED . OWNER
                       APPROVED
                       -> and ONLY THEN eligible               §14

"THE CODE NO LONGER USES IT" SATISFIES THE FIRST AND NONE OF THE SECOND.
```

---

## 12. The I-2 special control plan

**MP-P19 · MP-B20 does not merge until all seven proofs are green. This is a dedicated gate.**

```
BEFORE THE FINANCE CUTOVER, PROVE THAT ONE CONFIRMATION WRITES:

   1  the SETTLEMENT CONFIRMATION
   2  the ALLOCATION
   3  the STOCK MOVEMENT
   4  the STOCK-LEVEL PROJECTION
   5  the required MOD-009 NOTIFICATION FACT
   6  the required Class A MOD-013 AUDIT FACT

   IN ONE POSTGRESQL TRANSACTION.  ONE COMMIT.

   NOT a queue.  NOT a saga.  NOT an event bus.  NOT eventual consistency.
   NOT "usually atomic".
```

| # | Proof | Passes when | Test |
|---|---|---|---|
| **1** | **atomicity** | all six writes land, or none does | **INV-T01** |
| **2** | **insufficient stock** | the confirmation is refused and **everything rolls back** — no allocation, no notification, no audit fact | **INV-T02** |
| **3** | **duplicate / concurrent confirmation** | **EXACTLY ONE side-effect set**, under genuine concurrency against a real PostgreSQL | **INV-T03** — and the conditional-claim pattern CSR-002 already uses is what makes it possible |
| **4** | **audit failure** | an induced Class A audit-write failure **rolls the whole business transaction back** — **C-102 / IMP-C017** | **INV-T04** |
| **5** | **notification-fact failure** | an induced failure writing the notification FACT **rolls the whole I-2 transaction back** | **INV-T04** |
| **6** | **email delivery failure** | **does NOT roll back I-2.** The delivery ATTEMPT lives outside the transaction and is retried | delivery suite |
| **7** | **provider callback** | **does NOT confirm settlement.** A callback is a SIGNAL; confirmation is a human act under CAP-049 | webhook suite |

**MP-P20 · The sentence that must never appear in an I-2 review**

```
"THE TEST IS HARD TO WRITE UNDER CONCURRENCY, SO WE ASSERTED THE HAPPY PATH."

   -- proofs 3 and 4 are the ones that catch the failures that matter, and
      they are the ones that are inconvenient
   -- NO BATCH MAY WEAKEN PROOFS 1-7 TO OBTAIN A GREEN TEST.  If a proof
      cannot be written, the batch is not ready
```

**MP-P21 · Where the six writes physically live after the split.** `confirmPayment` (CSR-002) is
**REFACTORED, not rewritten** — its single `transaction()` and its conditional
`UPDATE … WHERE status NOT IN (…) RETURNING *` claim are the correct pattern and are **kept**. The six
writes expand inside that same transaction. **The atomic claim is the thing being preserved.**

---

## 13. RLS / tenancy control plan

**MP-P22 · The seven steps, in this order, and the two windows that must not open**

```
1  TENANT COLUMNS EXIST AND ARE BACKFILLED        MP-B05, zero NULLs proved
2  RUNTIME CONTEXT SUPPORT                        the SET LOCAL read path
3  ROLES AND OWNERSHIP SEPARATION                  MP-B02 provisions, B-07 uses
4  FORCE ROW LEVEL SECURITY                       MP-B07
5  POLICIES                                       MP-B07
6  NON-BYPASS TESTING                             MP-B07, before the switch
7  APPLICATION SWITCH                             MP-B07

THE TWO FORBIDDEN WINDOWS
   WINDOW A   RLS enabled while a tenant column is still nullable or
              unbackfilled -> rows nobody can see, or everybody can
   WINDOW B   the application switched to the scoped read path before the
              policies exist -> no boundary at all, briefly

   -- Stage 22 §19 sequences B-05 and B-07 precisely to avoid both, and
      MP-B07's merge gate asserts neither window was open
```

**MP-P23 · The six scopes that must be proved, and the role they are proved under**

| Proof | Passes when | Test |
|---|---|---|
| **school A cannot READ school B** | a scoped connection returns **404, not 403** — the tenant-isolation rule CSR-017 already encodes | **TEN-T** |
| **school A cannot MUTATE school B** | the write is refused at the database, not only in the application | **TEN-T** |
| **teacher scope** | a teacher sees their own classes — `getTeacherClassIds` (CSR-020) is the one canonical lookup | **TEN-T** |
| **guardian scope** | a guardian with children at **two schools** sees each child in its own school, and **no cross-school aggregate** | **TEN-T** · MP-B25 |
| **support engagement scope** | a platform actor inside an engagement reaches a bounded set, and the engagement is an audited fact | **SEC-T** · MP-B28 |
| **platform scope** | platform reads are platform-scoped, **not "a null school_id"** — a NULL school_id by itself NEVER means scope | **TEN-T** |
| **public publication scope** | only published content is publicly readable | **E2E-T** · MP-B27 |

**MP-P24 · RLS is never tested using the owner role**

```
THE OWNER / TABLE-OWNER ROLE BYPASSES RLS BY DEFAULT.
A TEST RUN AS THAT ROLE PROVES NOTHING AND PASSES EVERYTHING.

   -- TEN-T runs as a NON-BYPASSING application role
   -- FORCE ROW LEVEL SECURITY is set, and ownership is separated, so the
      application role cannot be the table owner
   -- MP-B07's merge gate asserts the test role is non-bypassing, by
      querying its attributes -- not by trusting the connection string
```

---
## 14. Auth and security control plan

**Every control below has a test, a merge gate and a conflict effect. A control with no test is not a
control; it is an intention.**

| # | Control | Batch | Test | Merge gate | Conflict effect |
|---|---|---|---|---|---|
| 1 | **Argon2id** password hashing | **MP-B06** | Argon2 suite | new hashes are Argon2id; **parameters recorded, not defaulted silently** | — |
| 2 | **bcrypt migration-on-login** | **MP-B06** | rehash suite | a bcrypt user signs in and their hash is upgraded **in that request** | CBR-002 removable at B-12 |
| 3 | **maintained TOTP library** | **MP-B09** | MFA suite | an authenticator enrolled before the change still verifies | CBR-003 |
| 4 | **encrypted MFA secret at rest** | **MP-B09** | secret-at-rest assertion | the secret is not readable from a plain table read | — |
| 5 | **TOTP replay block** | **MP-B09** | replay test | **the same code cannot be used twice**, within the window | — |
| 6 | **single-use recovery codes** | **MP-B09** | recovery suite | a used code is dead; the remaining count is correct | — |
| 7 | **MFA enrolment requires the password** | **MP-B09** | **SEC-T03 — RED FIRST** | red demonstrated against today's defect, then green | **IMP-C015 / C-90** |
| 8 | **password reset is one transaction** | **MP-B09** | reset suite | token consumed, credential written, sessions revoked — **all or none** | — |
| 9 | **session revocation** | **MP-B09** | session suite | revoking ends every live session for that person | — |
| 10 | **session rotation on privilege change** | **MP-B09** | session suite | the identifier changes at sign-in and at context change | — |
| 11 | **CSRF** | **MP-B10** | CSRF suite | a cross-origin state-changing request is refused | — |
| 12 | **canonical origin** | **MP-B10** | origin suite | **tenant and auth decisions never derive from `Host` / `X-Forwarded-Host` / the request URL** — DEPQ-2 = A | — |
| 13 | **durable rate limiting** | **MP-B09** | rate-limit suite | holds under a concurrent burst; **not keyed on a client-supplied header** (CSR-018 already fixed that) | CBR-014 |
| 14 | **env validation** | **MP-B10** | env suite | **an unknown or missing value FAILS TO BOOT**, in every environment | — |
| 15 | **test-superuser refused in production** | **MP-B10** | superuser suite | the production path refuses it and **says so in a log line**, rather than silently ignoring it | — |
| 16 | **webhook raw-byte signature verification** | **MP-B24** | webhook suite | verification runs on **the raw bytes**, before any parsing | — |
| 17 | **webhook replay defence** | **MP-B24** | webhook suite | a replayed signed event is refused; **and it never confirmed anything anyway** — §12 proof 7 | — |
| 18 | **upload scanning** | **MP-B26** | **PFL-010 EICAR in staging** | **a PENDING or unscanned object is readable by NOBODY** — OPSQ-1 = A | IMP-C011 partial |
| 19 | **CSP** | **MP-B10** | header suite | the policy is present and the application works under it | — |
| 20 | **structured logging with redaction** | **MP-B10** | log-redaction suite | **no secret, no token, no message body, no credential in a log line** | IMP-C001 / C-18 |
| 21 | **capability enforcement** | **MP-B08** | **TST-D034** | **a role string must not satisfy a capability check** | IMP-C004 |
| 22 | **RLS non-bypassing** | **MP-B07** | **TEN-T** | proved as a non-owner role — §13 | IMP-C002 |
| 23 | **console read tier bypasses closed** | **MP-B03** | **SEC-T15 — RED FIRST** | red demonstrated, then green | **IMP-C002 / C-19** |

**MP-P25 · The security batches go EARLY, and that is a deliberate ordering choice**

```
MP-B06 ... MP-B12 IS THE SECURITY REBUILD, AND IT IS SEVENTH THROUGH
TWELFTH OF THIRTY-FIVE.

   -- every later batch runs on top of a correct authority model
   -- a domain batch built on role strings would have to be revisited
   -- and the two red-first tests are demonstrated before any domain work
      touches the data they protect
```

---

## 15. Import control plan

**MP-P26 · One engine, two modes. Not two engines, and not one engine with a flag that means "the old
behaviour".**

```
THE FINAL ENGINE
   ONE ENGINE
   TWO MODES        children only              CAP-027
                    children + families/guardians   CAP-028

   -- pipeline 1 (family-enrollment) is the surviving base: it already
      handles the harder half
   -- pipeline 2 (student) contributes its VALIDATION FUNCTIONS and its
      PREVIEW PRESENTATION where they are better
   -- "students-only" is a MODE, not a second code path
```

| | Requirement | Proof |
|---|---|---|
| **technology** | **vendored SheetJS 0.20.3+, SERVER-SIDE ONLY** — TD-038 | no `xlsx` import in any `client/**` file; the browser bundle contains no workbook parser — **IMP-C008 / C-58** |
| **no browser parsing** | the workbook is parsed on the server, always | as above |
| **contracts** | **API-164 · 165 · 166 · 167 · 168 · 169 · 170 · 171** | each reachable and tested; **the commit is API-170 and the result is API-171** — A14-002 |
| **validation / preview first** | **preview writes NO product truth** | a preview run leaves the database unchanged |
| **normal commit availability** | unresolved invalid rows ⇒ **normal commit NOT AVAILABLE** — unless the locked **EXPLICIT ROW-EXCLUSION** workflow is used (WF-021) | both paths tested |
| **transaction model** | **ONE LOGICAL ROW = ONE TRANSACTIONAL BUSINESS UNIT** — child + family/guardian relation + class membership + requirements + required dependent facts. **All commit or none, FOR THAT ROW** — A4-001 · OPS-D021 | row-level atomicity test |
| **across rows** | row 1 commits · row 2 commits · **row 3 fails, and rows 1 and 2 REMAIN COMMITTED** | across-row test |
| **NOT tested** | **no whole-file rollback test.** Stage 18 does not say a single invalid row rolls back every previously committed logical row, and **a test may not assert behaviour the locked stages never specified** | the absence is deliberate and recorded |
| **durable progress** | progress is recorded on the import session **after each row** | resume test |
| **resume** | **RESUME DOES NOT DUPLICATE A COMMITTED ROW** — OPS-D022, driven by the staging row's committed state | resume test, run mid-import |
| **emails** | **sent AFTER the product-data commit**, never inside the transaction | ordering test |

**MP-P27 · The two legacy commit paths are removed together, at MP-B24, and not before MP-B22 has
proved both modes.** LRC-222 and LRC-223 are the student pipeline's preview and confirm; their removal
is **IMP-C006 / C-26's** closing evidence.

---

## 16. Provider cutover plan

**MP-P28 · IMP-P9 — no provider cutover rides along in a code-refactor batch. Each gets its own
batch, its own preflight, its own rollback boundary and its own soak.**

| Cutover | Batch | Provisioning preflight | Staging proof | Switch | Rollback boundary | Soak | Old-provider removal |
|---|---|---|---|---|---|---|---|
| **Resend → SES** | **MP-B24** | SES identity verified; **production access granted — a PROVIDER GATE, not a code gate**; sandbox is **per-region** | seven inputs verified: staging send · template parity · delivery-event parity · **bounce/complaint parity (a bounce suppresses an ADDRESS, it does not mark an identity unverified)** · sender identity `"<School> via ScholarShelf"` (INTQ-2 = C) · secrets present · **a rollback route needing no deploy** | `TARGET_EMAIL_PROVIDER` flips **one active sender** | **flip back — no deploy required** | a stated period, delivery rates watched | **MP-B32**: Resend code, `resend` dependency (DEP-C010 / DEP-I070) and configuration |
| **base64 → S3** | **MP-B26** | buckets created; **the PUBLIC bucket's CONTENTS POLICY is the control — the account-level all-public-access block cannot be overridden per bucket, and no CloudFront is introduced here** | **the EICAR gate: an EICAR object is detected in staging before any real object moves** | `TARGET_OBJECT_STORAGE` moves reads **only after the copy verifies per object** | reads revert to the database bytes, which are still there until MIG-14 | a stated period | **MP-B35 / MIG-14** drops the source bytes — **never earlier** |
| **GuardDuty scan** | **MP-B26** | **SELECT · PROVISIONING VERIFICATION REQUIRED** — E-12 is a launch-era blanket statement, not a maintained feature table | **PFL-010's EICAR staging test is the HARD GATE** | scanning is on before any object is public | scanning off ⇒ **nothing is public** | — | — |
| **Sentry EU** | **MP-B10** | **the region is chosen BEFORE the org exists, and the choice is IRREVERSIBLE** — E-13 | PFL-013 | DSN configured | a new org, not a rollback | — | — |
| **Vercel `lhr1`** | **MP-B04** | Pro plan; **separate staging and production projects** | staging project on `lhr1` | set the production function region, redeploy | redeploy to the previous region | — | **IMP-C009** closes the compute half only |
| **Neon `eu-west-2`** | **conditional — Stage 22 §32** | **A REGION CANNOT BE CHANGED AFTER PROJECT CREATION.** If the live project is not in region, this is a **project migration**, not a setting | PFL-004 reports the live region | §32's conditional migration | — | — | **IMP-C010** |

**MP-P29 · Two rules that hold across every provider cutover**

```
NEVER DUAL-SEND EMAIL.
   -- a parent receiving two identical invitations is a support incident
      and a trust problem, not redundancy

NEVER EXPOSE A PENDING OR UNSCANNED OBJECT.
   -- PENDING is readable by NOBODY, at every point in the pipeline
   -- and the EICAR gate blocks the WHOLE object migration, not just the
      public half                                            OPSQ-1 = A
```

**MP-P30 · Provisioning is not performed by this plan.** Every preflight above is a **task for its
batch**, and each depends on an account, a plan or an approval that **this document does not create
and cannot assume**.

---
## 17. Manual release gates — carried, not satisfied

**MP-P31 · This document CARRIES these gates. It does not satisfy any of them, and no batch may
record one as passed.**

| Gate | Who satisfies it | What it is NOT | Blocking |
|---|---|---|---|
| **Manual WCAG 2.2 AA assessment** — decision **2A** | a human assessor, across the **eight named surfaces** | **NOT a "WCAG certificate".** The record is an assessment record. **Automated axe checks are necessary and not sufficient** | **MANDATORY BEFORE PRODUCTION GO-LIVE**, per release |
| **Penetration test** | an external tester | not a code review, not a scanner run | release |
| **Data-protection readiness pack** | BytHub, with legal input | not an architecture document | release |
| **Legal & Compliance clearance** | **BytHub Legal & Compliance** | **not engineering's to grant.** The go-live block of **23 August 2026 — 17 Critical, 52 High, 14 domains, 0% clearance — stands in full** | release |
| **Backup restore rehearsal** | operations | **a backup that has not been restored is not a backup** — PFL-016 · REL-G012 | **MIG-14, and release** |
| **Production provider verification** | operations | not a staging result | release |
| **SES production access** | AWS | **a provider decision.** The sandbox is **per-region**, 200 messages / 24h | the email cutover |
| **GuardDuty EICAR staging proof** | operations | not a documentation claim — **E-12 is a launch-era statement, not a maintained feature table** | the object cutover |
| **Sentry EU provisioning** | operations | **the region choice is IRREVERSIBLE** | release |
| **Neon region verification** | operations | **a region cannot be changed after project creation** | **IMP-C010** |
| **Pool-capacity verification** | engineering, by **measuring `SHOW max_connections;`** | **NOT a plan property.** The owner decides the plan; engineering decides `pool.max` | release |
| **Cutover owner approval** | **the owner** | not implied by a green pipeline | **MIG-14** |

**MP-P32 · No accessibility record uses the word "certificate", and no unnecessary personal data about
the assessor is stored.** Decision **2A**, verbatim.

**MP-P33 · No architecture document, and not this plan, is compliance proof.**

---

## 18. Definition of done

**MP-P34 · The implementation is NOT complete when TypeScript passes**

```
"npm run check IS GREEN" IS THE START OF A BATCH'S EVIDENCE, NOT THE END
OF THE PROJECT.
```

**The final TECHNICAL target — every line must be true:**

| | Complete when |
|---|---|
| **target APIs** | API-001 … API-283 implemented |
| **legacy APIs** | **removed AFTER PROOF** — LRC register = **0** |
| **target screens** | implemented per Stage 9 |
| **legacy screens** | removed after proof — **and no human surface was removed** |
| **module boundaries** | enforced by an import-boundary rule, not by folder names |
| **target schema** | active; **thirteen data layers**, no successor god object |
| **RLS** | active, FORCE, non-bypassing, proved as a non-owner role |
| **security tests** | ACTIVE and green — **none known-red** |
| **I-2** | proved: **six writes, one transaction**, all seven §12 proofs |
| **import** | proved: one engine, two modes, logical-row atomicity, non-duplicating resume |
| **providers** | cut over, each with its own soak completed |
| **audit** | active; Class A coupling proved |
| **snapshot bytes** | **quarantined and preserved** — A19-001 |
| **legacy writes** | **0** |
| **temporary flags** | **0** |
| **CBR** | **0** |
| **LRC** | **0** |
| **unjustified direct dependencies** | **0** — against DEP-I001 … DEP-I099 |
| **DEFINED target tests** | **0** |
| **MIG-12** | passed |
| **soak** | completed |
| **MIG-14** | **eligible where policy permits** — and eligibility is not execution |

**MP-P35 · And even then, production release remains BLOCKED**

```
EVERY EXTERNAL AND MANUAL RELEASE GATE IN §17 MUST PASS.

   -- the BytHub Legal & Compliance go-live block STANDS
   -- the manual WCAG 2.2 AA assessment is MANDATORY BEFORE PRODUCTION
      GO-LIVE
   -- the owner's cutover approval is explicit and recorded

STAGE APPROVAL != PRODUCTION SECURITY CLEARANCE != LEGAL SIGN-OFF.
```

---

## 19. Approval, and what approval does not mean

```
IMPLEMENTATION MASTER PLAN
STATUS: **APPROVED FOR EXECUTION**
Approved: 1 September 2026 by the owner (BytHub Technology Ltd)

OWNER DECISIONS      MIGQ-1 = A · C-107 = A
OPEN OWNER QUESTIONS 0

THE PLANNING PHASE IS COMPLETE.
   Stages 1-22:                LOCKED
   Implementation Master Plan: APPROVED FOR EXECUTION
   The next step is MP-B01 — BASELINE FREEZE.

THIS APPROVAL DOES NOT MEAN
   MP-B01 has started            baseline commands ran
   tests pass                    Git locks were touched
   a commit was made             a branch or tag was created
   code changed                  packages changed
   migrations ran                providers were configured
   infrastructure exists         data moved
   production is ready           Legal & Compliance approved go-live
```

```
AND THIS DOCUMENT STILL IMPLEMENTS NOTHING.

no application file written, edited, moved or deleted
no route, screen or dependency removed
no package installed or removed . package.json not edited
no CI file edited . no environment variable changed
no AWS CDK code . no AWS resource . no SES . no S3 . no GuardDuty
no Sentry . no Vercel change . no Neon change . no Resend change . no DNS
no database role created . no migration written or run
no test executed . no baseline command run . no Git lock resolved
no commit . no push . no tag . no implementation branch
no data copied, quarantined or deleted . no deployment

MP-B01 STARTED 1 SEPTEMBER 2026.  Evidence is recorded in `MP_B01_BASELINE_EVIDENCE.md`.
```

**No conflict is CLOSED by this document.** C-103 and C-107 reached **TARGET SPECIFICATION RESOLVED**
through A7-001 and A14-003; **C-107's implementation remains OPEN and belongs to MP-B28**, and C-103
needs no implementation at all. **The baseline remains UNVERIFIED, capped at E2. The BytHub Legal &
Compliance go-live block of 23 August 2026 — 17 Critical, 52 High, across 14 domains, 0% clearance —
stands in full.**

```
IMPLEMENTATION MASTER PLAN
STATUS: APPROVED FOR EXECUTION — 1 September 2026, by the owner
        (BytHub Technology Ltd)

DERIVED FROM   Stages 1-22, all LOCKED, and all SEVENTEEN amendments
PRINCIPLES     IMP-P1 ... IMP-P12
BATCHES        MP-B01 ... MP-B35, one-to-one with IMP-B01 ... IMP-B35
               THERE IS NO MP-B00
PLANNING       every field A-S resolved for every batch before approval.
               Only T, and named manual RESULTS, remain NOT RUN
CONFLICTS      IMP-C001 ... IMP-C022, none pre-closed
MATRICES       route cutover . non-route bridges . database execution .
               test activation . conflict closure . screens+dependencies
CONTROL PLANS  I-2 . RLS/tenancy . auth & security . import . providers
GATES CARRIED  twelve manual release gates, NONE satisfied here

INPUTS, RECONCILED AGAINST THE AMENDED LOCKED DOCUMENTS
   CSR 59 · LRC 234 · CBR 15 · SCR-C 42 · DEP-C 23 · DEP-I 99 ·
   DMR 27 · IMP-B 35 · API 283 · IMP-C 22 · 243 handlers ·
   42 physical tables · 95 capabilities, 67 audit-required

NO APPLICATION BEHAVIOUR WAS IMPLEMENTED.
MP-B01 — BASELINE FREEZE — IS IN PROGRESS.
```
