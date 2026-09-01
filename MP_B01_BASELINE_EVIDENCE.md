# MP-B01 Baseline Evidence

**Batch:** MP-B01 / IMP-B01 - Baseline freeze

**Owner authorisation:** 1 September 2026 - owner instructed implementation to begin after reading the locked project documents

**Evidence captured:** 1 September 2026, Europe/London

**Repository:** `C:\dev\scholarshelf`

**Branch:** `restructure/aug-2026`

**HEAD:** `37b1fa8470a3d271572205254fc90013fcb45192`

**Environment:** native Windows x64 (`Microsoft Windows 10.0.26200`)

**Node:** `v22.17.1`

**npm:** `10.9.2`

## Scope and safety

This batch records the pre-implementation state. It changes no application code, route, schema, dependency, CI workflow, provider, production database, or deployment configuration.

The repository's `.env` points to a remote Neon database. Database-backed tests were therefore **not** run against that URL. An isolated local PostgreSQL 18 cluster already present at `.localpg/data` was started on port 5433, and a new database named `scholarshelf_baseline_20260901` was created for this evidence. The CI-equivalent setup was applied: `npm run db:push -- --force`, followed by migrations `002a` through `006`. Migration `001_console_hardening.sql` was not applied, matching the current CI path and the documented fresh-database conflict.

## Git lock inspection

No `git` process was running. Two zero-byte stale lock files were found and removed:

- `.git/index.lock` - last modified 23 August 2026
- `.git/objects/maintenance.lock` - last modified 8 June 2026

A repeat scan found no remaining `.git/**/*.lock` files.

`git gc` was **waived by the owner on 1 September 2026** after the pruning risk was stated. The stale locks were already removed, Git operations were functioning normally, and garbage collection offered no implementation benefit that justified risking recoverable dangling objects. No workaround was attempted.

## Required command results

| Command | Result | Evidence summary |
|---|---|---|
| `npm run check` | **PASS** | `tsc` exited 0 in 26.35 s with no diagnostics |
| `npm run test:smoke` | **PASS** | `api/index.ts` compiled, booted under production-shaped environment, and returned HTTP 200 from `/api/health` |
| `npm run build` | **PASS WITH WARNING** | Vite transformed 2,020 modules; client and server built; `dist/index.cjs` 397.0 kB; admin chunk 806.42 kB triggered the existing >500 kB warning |
| `npm run test:custody` | **PASS** | 36/36 |
| `npm test` | **FAIL - PRE-EXISTING TEST ORCHESTRATION / FIXTURE DEFECT** | The first run stopped because the command does not seed school B. After running the documented second-tenant seed, the second run reached tenant isolation and stopped at S5 because its fixture had no school-A book level. Tenant result: 25/26. |

## Suite-level evidence

The aggregate `npm test` command is fail-fast, so suites after tenant isolation were run individually against the same isolated database to establish their baseline.

| Suite | Result | Assertions / observations |
|---|---|---|
| Smoke boot | **PASS** | compile, boot, `/api/health` 200 |
| Custody state machine | **PASS** | 36/36 |
| Stock idempotency | **PASS** | 5/5 |
| Payment idempotency and concurrency | **PASS** | 16/16 |
| Security regression | **PASS** | 53/53 |
| Tenant isolation | **FAIL - PRE-EXISTING FIXTURE DEFECT** | 25/26; S5 could not run because the fixture did not provide both a school-B student and a school-A book level. Four other comparisons were explicitly skipped by the suite for insufficient fixture data. |
| Family enrolment | **PASS** | 40/40 |
| Staff-parent identity | **PASS** | 8/8 |
| Teacher distribution | **PASS** | 5/5 |
| Enrolment import | **PASS** | 61/61 |
| Payment verification | **PASS** | 49/49 |
| Test-superuser kill switch | **PASS AFTER MANUAL FIXTURE SETUP** | 38/38 after `seed:test-account` and supplying its generated one-time password; the aggregate command does neither. |

**Observed total:** 336 passing assertions, 1 failing assertion/probe. This is not represented as a green `npm test` result: the aggregate command exits 1 at tenant isolation.

## Pre-existing baseline failures

### BF-001 - `npm test` omits the second-tenant seed

`tests/tenant-isolation.ts` requires `DEMO-002`, but the local `test` script runs `test:tenant` without first running `seed:school-b`. CI contains the missing seed step. The unmodified aggregate command therefore stops before tenant assertions when started from the ordinary demo seed.

### BF-002 - tenant S5 fixture is incomplete

After the documented second-tenant seed, `tests/tenant-isolation.ts` reports:

```text
S5 probe - need a student in B and a book level in A
25/26 passed
```

This is recorded as a baseline fixture failure. It was not repaired inside MP-B01.

### BF-003 - test-superuser fixture is not orchestrated by `npm test`

`tests/test-superuser.ts` requires a separately seeded account. `npm test` does not run `seed:test-account`. The seed script generates a one-time random password while the test defaults to a different static password unless `TEST_ACCOUNT_PASSWORD` is supplied. The suite passes 38/38 when those documented prerequisites are provided.

### BF-004 - production client chunk warning

The production build succeeds, but the generated admin chunk is 806.42 kB raw (215.50 kB gzip), above Vite's 500 kB warning threshold. This is a baseline performance warning, not a build failure.

## Batch status

**MP-B01 is IN PROGRESS, not complete.** Local baseline evidence is recorded. The remaining locked steps are:

1. review and commit the architecture documents plus this evidence document;
2. push `restructure/aug-2026`;
3. create the immutable baseline tag;
4. create the implementation branch from that tag.

No later MP-B batch is eligible until these steps are complete.

## Rollback / forward repair

- Application rollback: not applicable; no application file changed.
- Database rollback: the only database created is the disposable local `scholarshelf_baseline_20260901`; no remote or production database was touched.
- Documentation rollback: remove this evidence document before commit, or revert its documentation-only commit after commit.
- Forward repair: repair BF-001 through BF-003 in the test-infrastructure batch defined by the locked plan; do not fold them into the baseline batch.
