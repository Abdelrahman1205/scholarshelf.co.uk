# REBUILD_SAFETY.md — Stage 0A

**Repository:** `C:\dev\scholarshelf` · **Remote:** `github.com/Abdelrahman1205/scholarshelf.co.uk`
**Read at:** 23 August 2026 · **HEAD:** `e80aad8` "Show the real reason a sign-in failed"
**Status of this document:** live. Update it whenever the branch model or the verification baseline changes.

---

## 1. The finding that matters most

**The entire August restructuring pass exists only as an uncommitted working tree.**

```
branch:            main (the only local branch; no rebuild branch, no feature branches)
HEAD vs origin:    0 ahead / 0 behind  →  nothing of this work is on GitHub
stashes:           none
working tree:      101 modified · 5 deleted · 9 untracked  (115 paths)
```

Of the 9 untracked files, four are load-bearing outputs of the restructuring pass and exist
**nowhere else**:

| Untracked file | What is lost if the tree is lost |
|---|---|
| `migrations/006_identity_and_money_integrity.sql` | Email-uniqueness index, `basket_payments` unique index, payment-reference unique index, all three status CHECK constraints |
| `script/smoke-boot.ts` | The production-entry-path smoke test (`npm run test:smoke`) — the only guard against the outage class that has reached production three times |
| `script/seed-school-b.ts` | The two-school fixture without which `tests/tenant-isolation.ts` passes vacuously |
| `tests/teacher-distribution.ts` | The H2 regression test (fails against the old lookup) |
| `client/src/lib/errors.ts`, `client/src/components/query-state.tsx` | The shared client error/query-state infrastructure |

Modified-but-uncommitted files include `server/storage.ts` (3,532 lines), `shared/schema.ts`,
`server/middleware/auth.ts`, `.github/workflows/ci.yml` and every money-path route.

**Consequence:** a `git checkout .`, a failed merge, a disk failure, or a well-meaning cleanup
destroys weeks of security work. Nothing in the current setup is reversible, because there is
nothing to revert *to*.

### Action 0A-1 — required before any further work (owner, ~15 minutes)

```
git checkout -b restructure/aug-2026            # capture, do not commit to main
git add -A -- . ':!.env*' ':!.localpg'          # confirm nothing secret is staged
git status                                       # eyeball the list before committing
git commit -m "Restructuring pass: tenant isolation, money path, build gate, client errors"
git push -u origin restructure/aug-2026
```

Commit it as **one labelled checkpoint** even though it is large. A large recoverable commit is
strictly better than an unrecoverable working tree. Splitting it into reviewable commits is a
later, optional improvement — capture first.

`.agents/skills/**` accounts for 38 of the 115 changed paths and is tool configuration, not
product code. Commit it separately or ignore it; it should not obscure the diff.

---

## 2. Branch model to adopt

The repository has no branch model at all — one branch, direct pushes, auto-deploy to production
on every push to `main`.

```
main                     ← known-good, auto-deploys to www.scholarshelf.co.uk
  └── restructure/aug-2026   ← the uncommitted pass, captured (Action 0A-1)
        └── rebuild/<domain>  ← one branch per vertical slice from Stage 22 onward
```

**Also required:** `verify` is not a required status check on `main`. Until branch protection is
enabled, green CI is advisory and a red build still deploys. This is a GitHub settings change, not
a code change, and it is the cheapest safety gain available.

---

## 3. Verification baseline

### What could be established

| Check | Result | Evidence |
|---|---|---|
| Repository secrets untracked | **PASS** | `git ls-files` matches only `.env.example`; `.gitignore` covers `.env*`, `.localpg/`, `tmp-*` |
| Secrets in git *history* | **STILL PRESENT** | 7 commits touch `.env` / `.env.local`. Rotation is mandatory; history rewrite is optional |
| Dead files removed | **DONE** | `_to_delete/` absent, `page.tsx` absent, `utils/supabase/*` deleted, `client/src/pages/admin/parents.tsx` deleted |
| `tsconfig` build fixes | **PRESENT** | `target: ES2022`, `tsBuildInfoFile: ./.tsbuildinfo` (out of `node_modules`) |
| CI integration job | **ENABLED** | `.github/workflows/ci.yml` runs 11 suites against a Postgres 16 service, `needs: verify` |

### What could NOT be established, and why

`npm run check`, `npm test` and `npm run build` **cannot be executed through this session's device
bridge.** The bridge runs a Linux VM over the Windows folder; `node_modules` contains
Windows-only native binaries, so `tsx` fails immediately:

```
Error: You installed esbuild for another platform than the one you're currently using.
    at generateBinPath (node_modules/tsx/node_modules/esbuild/lib/main.js:1739)
```

A pure-JS `tsc --noEmit` was started and had not completed after ~18 minutes of wall clock —
type-checking ~50,000 lines across a network-mounted filesystem is not a usable feedback loop.

**Therefore the current type-check / test / build state is UNVERIFIED in this session.** The
23 August report claims "type-check clean, 12/12 suites green (~340 assertions)"; that claim is
plausible and consistent with the code read, but per the framework's evidence hierarchy it sits at
*summary claim*, not *runtime verification*.

### Action 0A-2 — run natively on Windows and paste the output back

```powershell
cd C:\dev\scholarshelf
npm run check          # expect: clean
npm run test:smoke     # expect: /api/health 200
npm run build          # expect: server bundle ~397 kB
npm run test:custody   # pure unit, no DB
npm test               # full suite; needs a local Postgres in DATABASE_URL
```

Until 0A-2 returns, treat every "green" statement in the project documentation as unconfirmed.

---

## 4. Migration state

Seven SQL migrations exist alongside `drizzle-kit push`. **Two schema-deployment mechanisms are in
use at once**, which is itself the risk:

| File | Purpose |
|---|---|
| `001_console_hardening.sql` | Read-only console role, view schema. **Known not to run on a fresh database** ("cannot drop columns from view") |
| `002a_indexes.sql` | 31 indexes |
| `002b_foreign_keys.sql` | 23 foreign keys |
| `003_academic_year.sql` | Academic-year stamping |
| `004_cron_idempotency.sql` | Unique `(job, school_id, run_date)` |
| `005_payment_verification.sql` | Provider-payment tables |
| `006_identity_and_money_integrity.sql` | **Untracked.** Email/basket/payment-reference unique indexes, three status CHECK constraints |

CI applies `migrations/00[2-9]*.sql` — deliberately skipping `001`, because `001` cannot run on a
fresh database. **There is no reproducible path from an empty database to the production schema.**
Recorded here as open architectural debt for Stage 15; not to be fixed opportunistically.

`ensureBootstrapSchema()` — the ~30 DDL statements that used to run against production on every
cold start — has been removed (`server/app.ts:266` carries the tombstone comment). That is a real
improvement and must not be reintroduced.

---

## 5. Deployment behaviour and rollback

| | |
|---|---|
| Trigger | push to `main` → Vercel auto-build → `www.scholarshelf.co.uk` |
| Function | one serverless function, `api/index.ts`, `maxDuration: 30` |
| Cron | `0 7 * * *` → `/api/cron/run`, with a 24-second internal drain budget |
| Schema deploy | manual `npm run db:push` with production `DATABASE_URL` |
| Rollback (code) | Vercel "Promote to production" on a previous deployment — instant, available today |
| Rollback (schema) | **none.** `db:push` is a diff-and-apply with no down migration and no pre-flight snapshot |

**The asymmetry is the risk:** code rolls back in seconds; a schema change does not roll back at
all. Any Stage 15 migration must therefore be additive-first and separately reversible, and must
be preceded by a confirmed Neon PITR restore point.

### Action 0A-3 — before any schema change

1. Confirm Neon PITR is enabled and **perform one test restore**. Nobody has yet verified that
   backups exist in a restorable form.
2. Rotate `DATABASE_URL` / Neon password, `SESSION_SECRET`, `RESEND_API_KEY` — the git history
   still contains them, and `SESSION_SECRET` forges any session including owner.
   Pull Neon and Resend access logs *before* rotating.
3. Confirm the `DEMO-001` accounts are dead in production, not merely hidden from the login page.

---

## 6. Rules in force for the rest of this project

1. Nothing is deleted from `main` until the replacement is verified and the old path is recorded in
   `DEPRECATION_REGISTER.md`.
2. Every substantial change lands on a `rebuild/<domain>` branch and is compared against the
   current application before merge.
3. No schema change without an explicit migration + validation + rollback plan (Stage 15 format).
4. Any claim of "done" carries an evidence level (Stage 20 scale). "The tests pass" is Level 1, not
   Level 4.
5. Verification runs on Windows, natively. The device bridge is for reading, not for building.
