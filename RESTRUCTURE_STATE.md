# RESTRUCTURE_STATE.md — Stage 0C

*Every item claimed by `SCHOLARSHELF_RESTRUCTURE_REPORT.md` (22 Aug), the execution pass of
23 Aug, and the 20 Aug audit, checked against the code on disk today.*

## Evidence scale used

```
E0  summary claim only, not found in code
E1  code implementation read and confirmed
E2  a named regression test exists for it
E3  fail-before / pass-after demonstrated
E4  runtime / production behaviour verified
```

**Ceiling for this pass: E2.** Tests could not be executed through the device bridge
(`node_modules` holds Windows-only esbuild binaries), so nothing here is raised above "a test with
the right name exists in a suite CI is configured to run". See `REBUILD_SAFETY.md` §3, Action 0A-2.

---

## 1. VERIFIED COMPLETE (code read, E1–E2)

| ID | Item | Evidence |
|---|---|---|
| B1 | ES2022 target, `tsBuildInfoFile` out of `node_modules` | `tsconfig.json` — both present |
| B2/B6 | Production-shaped smoke test | `script/smoke-boot.ts` exists; `test:smoke` in `package.json`; wired into CI **before** the build |
| B3 | Build externals policy inverted | `script/build.ts` modified; bundle-size claim (2.9 MB → 397 kB) unverified |
| B4 | Cron drains within a wall-clock budget | `cron.routes.ts:58` `DRAIN_BUDGET_MS = 24_000`; `:274` breaks out; `:281` warns with the remaining count |
| C2 / S1 | Null-school and inactive-school sessions refused at one choke point | `auth.ts:352–420`. Returns `boolean`, not the `Response` — with the comment explaining why. `TENANT_SCOPED_ROLES` (`:54`) correctly **excludes** owner/platform_admin and **excludes parent** |
| C3 | Rate limits no longer key on client-controlled headers | `auth.ts:131` `clientIp()` returns `req.ip`; all six auth call sites use it |
| C4 | Console audit logging | `server/console/audit.ts` (`consoleAudit`, tiered); 18 audit calls in `db-console.routes.ts`, previously zero |
| C5 | Console SQL guards moved out of regex | `db-console.routes.ts` header documents the five DB-level controls: `console_ro` SELECT-only on a view schema, `BEGIN READ ONLY`, extended protocol (kills multi-statement), views excluding `password_hash`/`mfa_secret`/`token_hash`, always ROLLBACK. **The injectable PATCH/DELETE row endpoints are gone** |
| C6 (partial) | Academic-year model | `shared/academic-year.ts` (5 exports) + `migrations/003_academic_year.sql`; `academic_year` on six tables |
| H1 (audit) | Foreign keys and tenant integrity | 76 `references()` in `shared/schema.ts`; `migrations/002b` adds 23 more FKs |
| H2 (audit) | `ensureBootstrapSchema()` removed | `server/app.ts:266` tombstone comment; the four orphan tables now declared in `shared/schema.ts` |
| H4 (audit) | CI actually runs the suites | `.github/workflows/ci.yml` — `integration` job with a Postgres service and all ten DB-backed suites, `tenant-isolation` **required**, not `continue-on-error` |
| H7 (audit) | Indexes | 42 index declarations in schema + 31 in `migrations/002a` |
| S3 | Parent identity | `migrations/006` — `users_email_lower_unique_idx` on `lower(btrim(email))`, `parent_children_identifier_lower_idx` |
| S4/S5/S6 | Scoping moved into storage | 4 private asserts defined (`storage.ts:1404–1521`), applied at 18 call sites incl. `createAllocation` (`:2483`) |
| S7 | User update allowlist | `user.routes.ts:283–320` — five editable fields, `schoolId` change refused 403, username/email collisions 409 |
| S8 | Context switching validated server-side | `auth.routes.ts:299` checks the requested context against the account's real contexts, returns 403 otherwise, audits both real and simulated switches |
| D1/D2/D3 | `confirmPayment` atomic | `storage.ts:2210` — single `transaction()`, conditional `UPDATE … WHERE status NOT IN (…) RETURNING *` as the claim/lock, per-basket guard retained for partial legacy runs |
| D4 | Driver chosen by URL | `getDb()` / `buildSslConfig()` in `server/config/database.ts` (modified); local Postgres no longer routed through the Neon HTTP endpoint |
| D5 | Duplicate order refused | `parent.routes.ts:287` → 409 `code: "duplicate_order"`; `migrations/006` unique indexes on `basket_payments(basket_id)` and `book_payments(school_id, upper(btrim(ref)))` |
| D6 (corrected) | Three status domains kept distinct | `finance_book_allocations` carries `status`, `distribution_status`, `custody_status`; `migrations/006` builds each CHECK from *declared ∪ values already present* |
| H2 (report) | One canonical teacher-class lookup | `storage.getTeacherClassIds` (`storage.ts:1254`) is the **only** implementation; the duplicate in `book.routes.ts` is gone. `tests/teacher-distribution.ts` exists and is a required CI step |
| — | Login session race | `session.save()` on sign-in (`auth.routes.ts:192`), sign-up (`:270`) and the MFA challenge (`:160`) |
| — | Design tokens for non-error states | `index.css` — `--success` (5.18:1 on white), `--warning` (5.13:1), plus `-bg` pill fills, light and dark |
| — | UK formatting layer | `client/src/lib/format.ts` — en-GB, GBP, `formatYearGroup` normalising Grade/Y10/Year 3 |
| — | Dead files removed | `_to_delete/`, `page.tsx`, `utils/supabase/*`, `admin/parents.tsx` all gone |
| — | Secrets untracked | `git ls-files` matches only `.env.example`; `.gitignore` covers `.env*`, `.localpg/`, `tmp-*`, `a.out` |

---

## 2. PARTIALLY COMPLETE — good foundation, incomplete adoption

| Item | What exists | What is missing | Measured |
|---|---|---|---|
| **Client query-state** | `components/query-state.tsx`; failed query ≠ confident zero; single 401 redirect | Imported by **2 of 42 page files** (`finance.tsx`, `parent.tsx`) | `grep -rl query-state client/src` |
| **Shared error description** | `lib/errors.ts` `describeApiError` | Used in **6 files** | `grep -rl describeApiError` |
| **UK formatting** | `lib/format.ts` | **14 files** adopt it; **20** raw `toLocaleDateString`/`toLocaleString` and **20** raw `toFixed(2)` money renders remain | greps |
| **MFA enforcement (H5)** | Mandatory for platform-owner roles, server-side (`auth.ts:456`) | **Not enforced for `admin`, `school_admin` or `finance`** — the roles that touch money and pupil PII. `mfa_secret` storage and TOTP replay unaddressed | code read |
| **Academic year (C6)** | Stamped on six tables; vocabulary module | No rollover/promotion feature; `students.classId` is still a single mutable pointer; `classes.teacherId` still duplicates `class_teacher_assignments` | schema read |
| **CSP (H9)** | helmet policy in `server/app.ts` | `vercel.json` sets a **second, weaker** CSP (`script-src 'self' 'unsafe-inline'`). Two competing policies; the edge header is the one browsers see first | `vercel.json` |
| **Repository secrets (C1)** | Untracked and ignored today | **7 commits still contain `.env` / `.env.local`.** `SESSION_SECRET` in history forges any session, owner included. Rotation not evidenced | `git log -- .env` |

---

## 3. IMPLEMENTED BUT INSUFFICIENTLY TESTED

| Item | Why |
|---|---|
| Everything in §1 | No suite ran in this session. `tests/tenant-isolation.ts`, `teacher-distribution.ts`, `payment-idempotency.ts`, `family-enrollment.ts` are all **modified or untracked** — the versions CI would run are not the versions that have ever been run in CI |
| `migrations/006` | Untracked, never applied in CI (CI applies `00[2-9]*.sql`, which *would* include it once committed). The CHECK-constraint generator (`declared ∪ observed`) has no test |
| Console tier 2/3 | The five DB-level controls are architecturally sound but depend on `console_ro` and the view schema created by `001_console_hardening.sql` — **the migration known not to run on a fresh database**. Whether production actually has that role is unverified |
| Cron drain budget | 24 s budget with a resumable remainder; no test asserts a large school resumes on the next day |

---

## 4. IMPLEMENTED WITH WEAK EVIDENCE

| Item | Note |
|---|---|
| **D3 double-confirm race** | The report itself records that the race **did not reproduce** — 8 concurrent confirms produced one allocation and one stock deduction against the *original* code; the per-basket guard held. The transaction is retained because it makes the outcome structural rather than timing-dependent, but D3 should not be cited as a fixed defect |
| Build size 2.9 MB → 397 kB | Not measured this session |
| "12/12 suites green, ~340 assertions" | Summary claim (E0) until Action 0A-2 returns |

---

## 5. OPEN

| ID | Item | Evidence found today |
|---|---|---|
| **Sensitive fallback logging** | Still logs live credentials when email delivery fails, **not dev-gated**: `auth.routes.ts:450` full password-reset link; `owner.routes.ts:641` full school-setup invite link; `console/operations.ts:127` reset link; `parent.routes.ts:350` parent email + payment reference + order reference | code read |
| **D7 / fresh-database baseline** | `001_console_hardening.sql` cannot run on an empty database; CI works around it by skipping `001`. There is no reproducible empty-database → production-schema path | `ci.yml` glob `00[2-9]*` |
| **H3 custody state machine** | `custody.ts` declares `reserved → prepared → handed_to_teacher → issued → collected` with `ALLOWED_TRANSITIONS`, but `allocation.routes.ts:45` `tryCustody()` still swallows every failure in a bare `catch { }`, and the app fires `issued` directly from states that may not permit it. **The machine is advisory, not enforced.** Also `ensureCustodyBackfill` uses a module-level `Set` — per-instance memory in a serverless function, so it re-runs on every cold start | code read |
| **"Hand books to teacher" screen (H3, report)** | No such screen in `client/src/pages/` | file listing |
| **B5/B7 config + request-id logging** | Deferred by the execution pass; no request-id middleware found | |
| **Financial report CSV export** | Deferred | |
| **Unused deps** | `@supabase/*`, `passport*`, `memorystore` still declared; `xlsx@0.18.5` CVEs; `"name": "rest-express"`, `"license": "MIT"` on a commercial product | `package.json` |
| **Branch protection** | `verify` is not a required status check; green CI is advisory | GitHub setting |
| **`§7` cut list (~8,000 lines)** | Deliberately not executed, by owner instruction. Correct under this framework — it becomes Stage 22 input, not a cleanup task |

---

## 6. INCORRECT EARLIER CLAIMS (documentation overclaimed)

| Claim | Reality |
|---|---|
| `PROJECT_MASTER.md` §5: "29 tables" | **41** |
| `PROJECT_MASTER.md` §2: "no migration files — direct diff-and-apply" | **Seven** SQL migrations plus `drizzle-kit push`; two mechanisms in use |
| `PROJECT_MASTER.md` §3: "18 domain route files" | **19** |
| `PROJECT_MASTER.md` §8: "52/52 security regression tests pass" | The suite reports 53 in the later pass; and see §3 above on what "pass" is evidenced by |
| `PROJECT_MASTER.md` §11: "DB Console redesigned … wired to the real endpoints" | The console was subsequently **rebuilt three-tier**, and the PATCH/DELETE row endpoints that redesign wired up were removed as injectable |
| Master doc: "every tenant table carries `schoolId` FK" | The 20 Aug audit found 3 of 25; now substantially corrected, but the master doc asserted it while it was false |
| Restructure report D6: "the `distributions` table" | **No such table.** The real one is `finance_book_allocations` with three distinct status columns |
| Restructure report D3: "double-confirm race (critical)" | Did not reproduce |
| Commit `e77728b` "automatic Stripe payment verification" | No Stripe SDK; it is spreadsheet-based reconciliation |

**Rule this establishes:** in this project, a document's age is a better predictor of accuracy than
its authority. `PROJECT_MASTER.md` claims to be the single source of truth and is measurably behind
the code. Stage 22 must schedule documentation consolidation as a real domain.

---

## 7. NO LONGER RELEVANT

- Audit **M1** ("console table list 27% wrong") — the untyped table list is gone with the rewrite.
- Audit **C5** row-edit SQL injection — the endpoints no longer exist.
- Report **B4** "hourly cron on Hobby" — superseded by the wall-clock drain budget.
- `_to_delete/dead-files/` housekeeping — the folder has been removed.

---

## 8. What Stage 0C changes about how we proceed

1. The restructuring pass is **real and substantial**, and it is **not finished**. Roughly: the
   server-side security boundary is done; the client-side consistency work is ~15% adopted.
2. **Do not treat green tests as proof.** Nothing in this repository has been observed running.
   The first Stage 22 task is to establish a true Level-3/4 baseline.
3. **Preserve the choke-point architecture.** The single most valuable thing the pass produced is
   that tenant scoping lives in `ensureSessionSchoolIsActive` + storage asserts rather than in 150
   route bodies. Any future architecture must keep one boundary, not scatter it again.
4. **Two items are product decisions, not code**: the custody state machine (H3) and whether the
   platform-owner tier is sold into multi-academy trusts. They belong in Stage 1/4, not in a fix.
