# LIVE_SAFETY_PASS.md
# Production hotfix track — children's data, live system

```
STATUS: URGENT — WORKING DOCUMENT
Written: 1 September 2026
Scope: the LIVE system at www.scholarshelf.co.uk

THIS IS NOT A BATCH.  It is not MP-B0x, it is not part of the 35-batch
rebuild, and it does not advance it.

IT IS A HOTFIX TRACK against the system real schools are using.
Every item is minimal-diff, independently revertible, and needs NO AWS,
NO Neon project and NO Vercel identity.
```

---

## 0. Check this before anything else — ten minutes

> **UPDATE — 2026-09-02.** `POST /api/seed-users` has been **deleted** from the
> codebase, along with the in-memory fallback accounts in `server/storage.ts`
> and the quick-login buttons on the login page. The fixture-loading logic now
> lives in `tests/support/seed-fixtures.ts` and is reachable only from the test
> runner, never from the server.
>
> **This does not close the incident.** If the route ever ran against the
> production database, the accounts below still exist there. Deleting or
> rotating those rows in production is still outstanding.

**`POST /api/seed-users` may be live on the production domain right now.**

```
THE GUARD          server/routes/index.ts:82
                   if (process.env.NODE_ENV !== "production")

THE PROBLEM        NODE_ENV is set NOWHERE in vercel.json or api/index.ts.
                   The only reference in the repository is server/app.ts:18
                   READING it.  Nothing in the repository SETS it.

IF IT IS NOT SET AT RUNTIME, THE ROUTE IS REGISTERED IN PRODUCTION,
UNAUTHENTICATED, AND IT CREATES:

   bythub    ← PLATFORM OWNER, every tenant
   admin     ← school administrator
   finance   ← finance authority
   teacher
   it_admin
   parent

   (the passwords these were created with are no longer written down
    anywhere in this repository)
```

**How to check — safely.** Do **not** probe the endpoint: a successful POST *creates the accounts*.
Instead, in the Vercel dashboard for the production project, confirm `NODE_ENV` is explicitly set to
`production` for the Production environment.

| Result | What it means | What to do |
|---|---|---|
| **`NODE_ENV=production` is set** | the route is not registered. **Still remove it** — the control is one unset variable away from a total compromise | item **1** below, today |
| **It is not set, or you cannot confirm it** | **treat as a live unauthenticated owner-account backdoor with published credentials** | **set it now**, then item 1, then §3's incident steps |

**This is the highest-severity item in this document.** Everything else assumes an attacker needs
something; this one needs a single unauthenticated POST.

---

## 1. The code fixes, in order

Each is small, independent, revertible, and maps to the batch that will later do it properly — so this
is not orphan work.

### 1.1 Remove the seed route — **CRITICAL** · ✅ LANDED 2026-09-02

| | |
|---|---|
| **Where** | `server/routes/index.ts:82–83` and the whole seeded block |
| **Change** | delete the route and its `NODE_ENV` block. **Do not "improve the guard" — remove the route** |
| **Why not just guard it** | a guard that depends on one unset environment variable is not a control. Stage 14 §41 already classifies it **REMOVE — no target** (F-9) |
| **Proof before removal** | §40's eleven checks. Development seeding keeps working through `script/seed-*.ts`, which is where it belongs |
| **Later batch** | **MP-B10** · **LRC-217** |
| **Revert** | one commit |
| **Done** | route deleted; `ensureDemoUsersInMemory()` deleted from `server/storage.ts`; login-page quick-login buttons deleted; `script/seed-demo-users.cjs` deleted; fixtures moved to `tests/support/seed-fixtures.ts` (`npm run test:fixtures`) |

### 1.2 Stop logging password-reset links — **CRITICAL**

| | |
|---|---|
| **Where** | `server/routes/auth.routes.ts:450` and `server/console/operations.ts:127` |
| **What it does today** | `auth.routes.ts` logs the **full reset link** whenever the email fails to send — `if (!sent)`. **That is the failure path, which is exactly when it fires most.** `console/operations.ts` logs it from the owner console's reset operation |
| **Severity** | Stage 16 **SEC-R001, CRITICAL** — *"a reset link in a log is an account-takeover primitive available today"* |
| **Change** | delete both log lines. Log **that** a reset was requested and **that** delivery failed — never the link, never the token |
| **Keep** | the `[Resend] not configured` warning. That one carries no credential |
| **Later batch** | **MP-B10** · **C-18** · SECAR-034 (*logs are a personal-data store*) |
| **This is not only a code fix** | see **§3** |

### 1.3 Require the current password to enrol MFA — **CRITICAL**

| | |
|---|---|
| **Where** | `server/routes/mfa.routes.ts`, `POST /api/auth/mfa/enable` |
| **What it does today** | **requires no password.** A hijacked session can bind an attacker's authenticator, giving persistent control **and locking the real user out of their own account** |
| **Change** | require and verify the current password before enabling. Notify the account holder on enrolment and on recovery-code regeneration |
| **Later batch** | **MP-B09** · **C-90** · SECAR-011 · **SEC-T03** |
| **Note** | write the test **red first** against today's behaviour, then fix. It is the one piece of MP-B09 worth doing properly even here |

### 1.4 Remove arbitrary SQL — **HIGH**

| | |
|---|---|
| **Where** | `server/routes/db-console.routes.ts:187`, `POST /api/owner/db/query` |
| **Why** | owner-only, but it is a total-compromise primitive over every tenant's children's records, with no bounded operation set. **Stage 12 §26 excludes it from the target entirely** |
| **Change** | remove the route. The console's legitimate reads — schema, table browse — stay |
| **Client** | `db-console.tsx` calls it; remove the caller in the same commit |
| **Later batch** | **MP-B28** · **LRC-187** |

### 1.5 Move workbook parsing off the browser — **HIGH, larger**

| | |
|---|---|
| **Where** | `client/src/pages/admin/students.tsx:22` — `import * as XLSX from "xlsx"` |
| **Why** | `xlsx@0.18.5` has **two unpatched CVEs**, and it parses untrusted spreadsheets **on the path that creates children's records** |
| **Change** | parse server-side. **Do not change parser** — locked **TD-038** keeps SheetJS, vendored, 0.20.3+, server-side only |
| **Later batch** | **MP-B22** · **C-58** · TR-001 |
| **Honest scoping** | this is **days, not hours**. If the deadline is tight, do 1.1–1.4 first and schedule this one deliberately |

---

## 2. What this pass does NOT do

```
IT DOES NOT MAKE THE SYSTEM SAFE.
IT REMOVES THE SHARPEST EDGES FROM A SYSTEM THAT STILL HAS:

   NO ROW-LEVEL SECURITY          0 of 41 tables.  Tenant isolation is
                                  APPLICATION-LAYER ONLY, and one missed
                                  scope check crosses a school boundary
   bcrypt, not Argon2id
   a hand-rolled TOTP implementation
   three separate audit stores, none canonical
   base64 file bytes inside PostgreSQL
   no upload scanning
   242 role-string authorization checks

IT DOES NOT CLEAR ANY PART OF THE GO-LIVE BLOCK.
   17 Critical · 52 High · 14 domains · 0% clearance — UNCHANGED.

IT DOES NOT SUBSTITUTE FOR THE REBUILD.
   RLS is MP-B07.  It cannot be hotfixed, and pretending otherwise would
   be the genuinely dangerous move.
```

**Tenant isolation, stated precisely.** The application-layer controls are real — the four scoping
asserts at 18 call sites (CSR-001) and the null-school choke point (CSR-018) — and the tenant suite now
runs **29/29 with the S5 cross-tenant probe exercised**. That is meaningfully better than a week ago.
**It is still not a database-enforced boundary**, and it should be described to anyone who asks as
exactly what it is.

---

## 3. The incident items — these are not code

**§1.2 fixes the code. It does not fix what is already in the logs.**

| | |
|---|---|
| **Any reset link already logged is a LIVE CREDENTIAL** until its token expires | invalidate every outstanding password-reset token now. Users who need one can request another through the fixed path |
| **The logs themselves** | determine who has had access to production logs, and over what period. Handle them as a **personal-data store** — SECAR-034 |
| **If §0 finds `NODE_ENV` unset** | audit the `users` table for the seeded usernames — `bythub`, `admin`, `teacher`, `teacher2`, `parent`, `it_admin`, `finance`. **If any exists and was not created by you, treat it as a compromise**, not a curiosity |
| **Whether this is reportable** | **not an engineering judgement.** UK GDPR breach assessment belongs with BytHub Legal & Compliance. Give them the facts and the timeline; do not decide it in the repository |

---

## 4. Sequencing against the rebuild

```
THIS TRACK RUNS ON THE PRODUCTION LINE, NOT ON codex/rebuild-foundation.

   branch from what is DEPLOYED, not from the rebuild branch
   one commit per item, each independently revertible
   deploy 1.1 and 1.2 as soon as they are reviewed — do not batch them
      behind 1.3 and 1.4

WHEN THE REBUILD REACHES THE OWNING BATCH, THE FIX IS ALREADY THERE.
   1.1 -> MP-B10      1.2 -> MP-B10      1.3 -> MP-B09
   1.4 -> MP-B28      1.5 -> MP-B22

   Record each one in the batch's evidence as ALREADY LANDED, with the
   commit.  It is not orphan work and it must not be done twice.
```

**The rebuild sequencing does not change.** MP-B02 stays blocked on the nine provisioning items;
MP-B03 stays behind it. **This pass does not start MP-B03 and must not be described as progress
through the plan.** It is a parallel track with a different purpose: making the thing schools are
using now less dangerous while the rebuild waits on accounts that do not exist yet.

---

## 5. Still outstanding from the rebuild branch

Neither is affected by this pass, and both still need doing:

- the uncommitted `codex/rebuild-foundation` work still lets `npm test` write a **known-password
  superuser into live Neon** — `MP_HANDOFF_CODEX_RESTART.md` §3
- **A22-002** is still unrecorded — §4 of the same handoff

---

## 6. Order of work

| | | |
|---|---|---|
| **now** | **§0** — confirm `NODE_ENV=production` on the Vercel production environment | ten minutes |
| ~~today~~ | ~~**1.1** remove the seed route~~ ✅ done 2026-09-02 · **1.2** stop logging reset links | hours |
| **today** | **§3** — invalidate outstanding reset tokens; audit for seeded accounts | hours |
| **this week** | **1.3** MFA enrolment · **1.4** arbitrary SQL | days |
| **scheduled** | **1.5** server-side parsing | deliberately, not rushed |
| **in parallel** | the rebuild stays blocked on **your** AWS accounts and Neon projects | unchanged |

```
IF ONLY ONE THING HAPPENS TODAY, MAKE IT §0.
```
