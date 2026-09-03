# HANDOFF — read this before doing anything

**For:** Codex, on a fresh session with no memory of prior work.
**Written:** 1 September 2026.
**Repository:** `C:\dev\scholarshelf` · branch `codex/rebuild-foundation`.

```
YOU ARE MID-BATCH WITH UNCOMMITTED WORK THAT CONTAINS A LIVE HAZARD.
DO NOT COMMIT, PUSH, OR START A NEW BATCH UNTIL SECTION 3 IS CLOSED.
```

**Governing documents, all in the repository root, all LOCKED or APPROVED:**

| Document | Status |
|---|---|
| `IMPLEMENTATION_MASTER_PLAN.md` | **APPROVED FOR EXECUTION** — MP-B01 … MP-B35, all fields A–T resolved |
| `MIGRATION_TARGET_EXTRACTION_CUTOVER.md` | Stage 22, **LOCKED**, final architecture stage |
| the other Stage 1–21 documents | **LOCKED** |
| `MP_B01_BASELINE_EVIDENCE.md` | the recorded baseline — **historical, do not edit** |
| `MP_B02_PROVISIONING_EVIDENCE.md` | MP-B02, IN PROGRESS — BLOCKED-EXTERNAL |

**Read `IMPLEMENTATION_MASTER_PLAN.md` §2 (IMP-P1 … IMP-P12) before you touch anything.** The
sequence is a safety property, not a preference.

---

## 1. Verified state — re-check it yourself before trusting this

```bash
git log --oneline -4          # 90545ef, bb63927, f8ce7b6, 26967bb
git status --porcelain        # 4 modified files, all uncommitted
ls .git/index.lock            # a stale 0-byte lock is present
grep -c "A22-002" MIGRATION_TARGET_EXTRACTION_CUTOVER.md   # 0 — not yet written
```

| Batch | State |
|---|---|
| **MP-B01** baseline freeze | **COMPLETE.** Tag `pre-target-extraction-2026-09` on `416e4bd`, pushed. This branch descends from it. Baseline recorded four pre-existing defects, BF-001 … BF-004 |
| **MP-B02** provisioning | **IN PROGRESS — BLOCKED-EXTERNAL.** Local CDK foundation, MIG-000 class B and PFL-007 done. **Nine external items outstanding** — see `MP_B02_PROVISIONING_EVIDENCE.md`. Merge gate **NOT** met |
| **MP-B03** migration runner | **NOT STARTED.** Its precondition is MP-B02 merged |
| **MP-B04** test infra + CI | **STARTED EARLY, UNCOMMITTED.** This is the work in your working tree |

**Uncommitted, and it is MP-B04 work:** `script/seed-school-b.ts`, `script/seed-test-account.ts`,
`package.json`, `.github/workflows/ci.yml`. It repairs BF-001, BF-002 and BF-003, and it took the
tenant-isolation suite from 25/26 with the S5 probe unexercised to **29/29 with S5 genuinely
running**. That is real and valuable — S5 is the cross-tenant probe that sits directly under MP-B07's
RLS work. **It is not safe to commit as written.**

---

## 2. Why nothing else can start

```
MP-B02 IS BLOCKED ON THE OWNER, NOT ON YOU.

   AWS production + non-production accounts, isolated
   MFA-protected operator access and CDK bootstrap
   exact GitHub and Vercel issuer / audience / subject claims
   separate staging and production NEON PROJECTS
      -- a Neon region CANNOT be changed after project creation
   six roles provisioned in both live databases
   role ARNs and account IDs as environment-scoped config
   the GitHub OIDC preflight run in both environments
   PFL-021 refusal evidence against the production Vercel role
   CloudTrail confirmed logging in both accounts

NONE OF THIS IS SOMETHING YOU CAN DO.  Do not simulate it, do not mark it
complete, and do not ask for credentials in chat.
```

---

## 3. BLOCKER — close this before any commit

**`npm test` can write a known-password superuser into the live Neon database.**

The chain, all verifiable in the working tree:

1. `package.json` — the `test` script now runs `npm run seed:test-account:integration`
2. `script/seed-test-account.ts:33` — `import "dotenv/config"`; line 66 reads `process.env.DATABASE_URL`
3. this repository's `.env` points at the **remote Neon database** (`MP_B01_BASELINE_EVIDENCE.md` says so)
4. line 107 hardcodes the superuser password **`"universal-test-2026"`**
5. the only guard is `IS_PRODUCTION && INTEGRATION_FIXTURE`, and `IS_PRODUCTION` is
   `NODE_ENV === "production"` — **false on every developer machine**
6. line 115 configures SSL for non-local URLs, so the script fully expects to reach a remote database

Anyone running `npm test` without exporting `DATABASE_URL` first creates `testuser` /
`universal-test-2026` with superuser rights **on live Neon**.

### 3.1 The fix — gate on the TARGET, not on `NODE_ENV`

```
REFUSE --integration-fixture UNLESS EITHER
   DATABASE_URL matches /localhost|127\.0\.0\.1/
      -- the script ALREADY uses exactly this predicate at line 115
   OR an explicit opt-in is set, e.g. INTEGRATION_FIXTURE_ALLOWED=true
      -- CI sets it; no developer machine has it

KEEP the existing NODE_ENV production refusal as WELL.
   It is defence in depth.  It is NOT the control.

THE REFUSAL MUST
   print WHY, naming the offending host (never the credential)
   exit non-zero
   do all of that BEFORE opening a database connection
```

### 3.2 Record what BF-003 actually was

`MP_B01_BASELINE_EVIDENCE.md` classified "`npm test` does not seed the superuser" as defect **BF-003**.
**It was also a safety property.** Removing it without replacing the guard is a net loss. Say so
explicitly in the evidence, and name the new guard as its replacement.

### 3.3 Write the test for the refusal

**An untested refusal is an intention, not a control.** There is currently no test asserting it —
verified: nothing under `tests/` or `infra/test/` references the fixture flag.

Add a committed test that asserts `--integration-fixture` exits non-zero **and logs the reason** when
`DATABASE_URL` is non-local, and again when `NODE_ENV=production`.

This is the locked control from **CSR-046 (REPLACE + GATE)** and **SEC-T** — normally **MP-B10**'s
work. Since the refusal is being written now, its test is written now. **Record it as MP-B10's control
landing early**, not as incidental hardening.

---

## 4. Then record A22-002 — it is still missing

Commit `bb63927` edited **`MIGRATION_TARGET_EXTRACTION_CUTOVER.md`, a LOCKED stage**, and
**`IMPLEMENTATION_MASTER_PLAN.md`, approved for execution**, with no amendment entry. The content was
correct; the procedure was not. `IMP-P0.1` and the Stage 22 locking rule both require: **STOP → raise
a traceable amendment → owner review → continue.**

**Verify first:** read Stage 22's amendment register at the end of the document. **A22-001 is expected
to be the latest.** If it is, append **A22-002**. If it is not, use the next available A22 identifier.
**Do not guess.**

```
A22-002 · PFL-008 cannot activate in B-02 — activation ordering corrected
Class: FACTUAL / SEQUENCING CORRECTION.  No architecture change.

THE DEFECT
  Stage 22 §35 listed PFL-008 among B-02's activated checks, and the
  Master Plan repeated it in MP-B02 fields L and Q.  PFL-008 is "FORCE ROW
  LEVEL SECURITY is on, and DBROLE-2 is not the owner" — Stage 21,
  DEP-D015, the check that stops every RLS test passing vacuously
  (DEP-R001).  FORCE RLS lands with MIG-10 at B-07.  PFL-008 therefore
  CANNOT be green in B-02, and listing it there invited either a vacuous
  pass or a permanently blocked batch.

THE EVIDENCE
  Local PFL-008 census during MP-B02: BLOCKED_MP_B07 — 41 of 41 current
  tables have no RLS.  PFL-007 passed in the same run: 6/6 roles, no
  superuser, no BYPASSRLS.

THE CORRECTION
  Stage 22 §35 B-02 row   PFL-007 · PFL-021 · PFL-008 RED / BLOCKED_MP_B07
  Stage 22 §35 B-07 row   PFL-008 GREEN · TEN-T · RLS, non-bypassing
  Master Plan MP-B02 L/Q  PFL-008 records RED / BLOCKED_MP_B07; not made
                          green early
  Master Plan MP-B07 L/Q  PFL-008 activates GREEN here
  Master Plan IMP-C011    MP-B02 + MP-B03 + MP-B07; PFL-007 · PFL-021 in
                          B-02/03, PFL-008 green in B-07

WHAT DOES NOT CHANGE
  No batch boundary, ordering or count.  No API contract, schema decision,
  capability, scope or module ownership.  No other PFL assignment.  No
  register identifier.  IMP-C002 (C-19) unaffected.  NO CONFLICT IS
  CLOSED and no new conflict is raised — this is a sequencing error in
  Stage 22's own text, not a disagreement between locked stages.

DISCIPLINE
  Append-only.  STAGE 22 REMAINS LOCKED.  State that the in-place edits in
  commit bb63927 were made before this record existed, and that this entry
  is the record they required.
```

---

## 5. Then the evidence records

### 5.1 A new `MP_B04_TEST_INFRASTRUCTURE_EVIDENCE.md`

Record it as **MP-B04 started early**, not as batch-less "baseline repairs":

- which MP-B04 field-F items are now partially done, and which are not
- **MP-B02 and MP-B03 remain incomplete and unmerged**
- `IMP-P1` (one batch at a time) is being **consciously relaxed** for isolated non-application work
  while MP-B02 is externally blocked — say that plainly, with the reason
- the `node:test`-via-`tsx` runner used by `infra:test` is a **temporary dev-only exception**;
  Stage 20 **TST-D003 selects Vitest**, added at MP-B04 (DEP-C014). Either fold it in, or state why
  it stands
- the `npm audit` findings get **no new batch**. The sequence is 35, one-to-one with IMP-B01…B35.
  Map each finding to its existing home: dispositions are **DEP-I001 … DEP-I099**; `xlsx` is
  **C-58 / TD-038 → MP-B22**; removals land at **MP-B12** and **MP-B34**

### 5.2 An **addendum** to `MP_B01_BASELINE_EVIDENCE.md` — do not edit the original

```
THE NUMBERS CHANGED SHAPE.  DO NOT COMPARE THEM.

   baseline    tenant isolation 25/26, S5 UNEXERCISED, 4 comparisons skipped
   now         tenant isolation 29/29, S5 exercised

   THE SUITE GREW FROM 26 ASSERTIONS TO 29.
   "340/340" is not the same measurement as the baseline's "336 passing,
   1 failing".  It is not a regression comparison, and it must not be
   presented as one.

The original file stays as the HISTORICAL FLOOR.  The addendum records the
new state, the assertion-count change, and the fact that THE HARNESS
ITSELF WAS MODIFIED.
```

### 5.3 A note in the MP-B03 scope

CI still runs `npm run db:push -- --force` (`.github/workflows/ci.yml:125`), and this change adds more
DB-backed suites depending on it — immediately before **MP-B03**, whose job is removing it (**C-78**).
**Note the growth in MP-B03's scope. Do not fix it here.**

---

## 6. Then commit

Remove the stale `.git/index.lock` (0 bytes) first — it will block the commit.

One commit for the harness repair plus its refusal test, one for the amendment and evidence. End each
message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CoYikxqXMAG6qeJ7UeeGiB
```

**Do not push without the owner's explicit authorization phrase.**

---

## 7. Then STOP

```
AFTER SECTIONS 3–6 ARE DONE, THE NEXT MOVE IS THE OWNER'S.

   MP-B02 is BLOCKED-EXTERNAL on nine provisioning items.
   MP-B03's precondition is MP-B02 merged.
   Everything from MP-B05 onward depends on both.

DO NOT
   start MP-B03 or any later batch
   mark MP-B02 complete
   provision, simulate or stub any AWS, Neon, Vercel, SES, S3, GuardDuty
      or Sentry resource
   touch the remote Neon database for any reason
   modify application code — server/ client/ shared/ api/ migrations/
   remove any route, screen or dependency
   run a migration, create a DB role, or change DNS
   push, tag, or deploy
   close any conflict

IF YOU BELIEVE A LOCKED DECISION IS IMPOSSIBLE:
   STOP -> record why -> raise a traceable amendment -> owner review
   -> only then continue.        Never work around it silently.
```

**Baseline remains UNVERIFIED / E2** except for the specific commands MP-B01 actually ran and
recorded. **The BytHub Legal & Compliance go-live block of 23 August 2026 — 17 Critical, 52 High,
across 14 domains, 0% clearance — stands in full.**

---

## 8. If you only remember one thing

```
THE PLAN'S VALUE IS THE ORDERING.

   REPLACEMENT BEFORE REMOVAL
   NO OLD PATH REMOVED UNTIL ITS CALLERS ARE PROVED SWITCHED
   DATABASE DESTRUCTION IS A DIFFERENT GATE FROM CODE DELETION
   NO SECURITY CONFLICT CLOSES WITHOUT EVIDENCE
   A FAILED OR BLOCKED BATCH STOPS THE SEQUENCE
   "FIX LATER" IS NEVER A SUCCESS CONDITION

An untested control is an intention.
A green build is not evidence.
```
