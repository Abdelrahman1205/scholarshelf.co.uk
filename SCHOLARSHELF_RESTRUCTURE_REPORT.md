# ScholarShelf — Restructuring Report

**Date:** 22 August 2026
**Scope:** full audit of `C:\dev\scholarshelf` — 47,000 lines, 41 tables, 241 API routes, 111 client files
**Context:** Al-Noor International School is waiting. Timeline is weeks. Team is you, a programmer, and AI assistance.
**Target product:** the full termly cycle — enrol → order → pay → allocate → distribute to teachers

Every finding below cites `file:line`. The five load-bearing ones were re-verified by hand against the code, not taken on trust.

---

## 1. The short version

**Do not rewrite. The core is better than you think, and the problems are not where they feel like they are.**

Three things are true at once, and holding all three is the whole point of this report:

1. **The termly cycle is largely built and mostly correct.** Of 351 client API calls, exactly **one** is dead. There is **one** TODO in 47,000 lines. Enrolment, ordering and payment verification are real, transactional, idempotent code. The payment-verification service and the spreadsheet importer are genuinely well-engineered and should not be touched.

2. **Three specific hand-offs are broken**, and they sit exactly where your product promise sits. A school can get from enrolment to money-in-the-bank today. It **cannot** reliably get from money-in-the-bank to books-in-children's-hands.

3. **There are live cross-tenant data leaks.** Not theoretical. A school admin can read every child in every school on the platform, and can mint a working parent-access credential for another school's pupil. This is fine *today* only because you have one tenant. It becomes a notifiable data breach the week you sign your second school.

The reason it *feels* like everything is broken is that your feedback loop is broken. CI has been red on unrelated pre-existing errors for weeks, which means the build gate below it has **never executed**. Every deploy has been the first clean-checkout compile. That is why three separate releases died on missing files, and it costs about 20 lines to fix.

**Recommended shape of the next few weeks:**

| | Work | Why |
|---|---|---|
| **Days 1–2** | Fix CI; make it required; add a boot smoke test | Stops shipping broken code. Everything else is faster afterwards. |
| **Week 1** | Close the tenant leaks (findings S1–S3) | Cheap, and they are the ones that end the business. |
| **Week 1–2** | Fix the three broken hand-offs | This is the difference between "a demo" and "a school can run a term" |
| **Week 2** | Money-path integrity: transaction + stock (D1–D3) | Silent data loss under load |
| **Week 2–3** | Cut ~8,000 lines of periphery | Halves the surface you have to keep correct |
| **Week 3+** | The Tier-A UX defects | ~150 lines that remove most of the embarrassment in a live demo |

---

## 2. Why not a rewrite

Under a weeks-long deadline with a waiting customer, a rewrite is the decision that loses the customer. But that is the generic argument; here is the specific one.

The parts of this codebase that are hardest to rebuild are the parts that are already **good**:

- **`server/services/payment-verification/*` (1,325 lines)** — provider abstraction, strong-identifier matching, append-only attempt log with an evidence snapshot of expected-vs-found, three settlement paths that all funnel through one `confirmPayment`. Rebuilding this correctly would take most of your available time on its own.
- **`server/services/enrollment-import/*` (1,591 lines)** — real two-phase analyse/commit, re-parses the original file at commit rather than trusting the browser, fully transactional, sibling-aware, UK-date-correct. It also happens to be exactly the right design for serverless.
- **Money types are right.** `numeric(10,2)` everywhere, no exceptions (`shared/schema.ts:474, 707-708, 733, 833`). No floats, no cents-as-integer inconsistency. For a payments system this is the single most commonly botched decision, and it isn't botched.
- **No SQL injection anywhere.** Every `sql` usage is Drizzle's parameterising tag. No `sql.raw` with user input.
- **The database console is the best-engineered thing in the repo** — Postgres-enforced privilege split, read-only transactions, secret columns physically absent from the views rather than filtered in code.

The weak parts are weak in *shallow* ways: missing `WHERE` clauses, a missing transaction wrapper, a swallowed error, two copies of one function. Those are hours of work each, not weeks.

**The honest counter-argument:** `server/storage.ts` is a 3,199-line class with 152 methods, and `IStorage` has already drifted out of sync with it. That genuinely will slow you down. But it is already sectioned by domain and ~100 of the 152 methods split cleanly along tenant lines. It can be dismantled incrementally, later, while shipping. It is not a reason to start over.

---

## 3. Critical — cross-tenant data leakage

**Verdict: possible today, via at least four independent paths.**

The majority of the codebase scopes correctly, and in places thoughtfully — family enrolment, messaging, payments and the website module are consistently right. The holes cluster in the oldest files (`book.routes.ts`, `student.routes.ts`) and in one structural decision.

### S1 — `null` school scope means "every school" *(critical)*

`server/storage.ts:257` — verified:

```ts
function schoolFilter<T extends { schoolId: any }>(table: T, schoolId?: string | null) {
  if (typeof schoolId === "string") return eq(table.schoolId, schoolId);
  return undefined; // no filter for owner/demo (null schoolId)
}
```

All ~150 storage methods inherit "null means every tenant". Safe only while non-owners can't reach `null` — and they can. `sessionSchoolId` (`server/middleware/auth.ts:175`) returns `req.session.schoolId ?? null`, and ten list endpoints have no guard against it: `book.routes.ts:354` (`/api/students`), `:235` (`/api/classes`), `:417`, `:474`, `:181`; `setup.routes.ts:40`; `student.routes.ts:35`; `allocation.routes.ts:71`; `payment.routes.ts:293, 326`.

**How a null-school staff account gets created, with no bug involved:** `ADMIN_UI_ROLES` includes `owner`. A platform owner who is *not* in support mode creates an invite (`user.routes.ts:687`) or a user (`:236`) with `schoolId: sid` where `sid` is `null`. Sign-in never asks such an account for a school code, because the check is wrapped in `if (user.schoolId)` (`auth.routes.ts:115`).

**Consequence:** that admin opens the students page and receives every child on the platform — names, dates of birth, gender, class, photo URL.

The authors knew about this case in exactly one place — `dashboard.routes.ts:224` filters for it on the dashboard counters — and nowhere else.

**Fix:** in `requireRole`, 403 any non-platform-owner context whose `sessionSchoolId(req)` is `null`. One change closes all ten endpoints. Then make `schoolFilter` *throw* on null and give owner routes an explicit `allTenants()` escape hatch.

### S2 — Mint a parent credential for any child in any school *(critical)*

`server/routes/student.routes.ts:59` — verified:

```ts
const student = await storage.getStudentById(routeParam(req.params.id), sid);
const studentName = student?.name || "your child";        // foreign student → undefined → shrug and continue
const linkingCode = await storage.createLinkingCode({
  studentId: routeParam(req.params.id),                   // unvalidated, straight from the URL
  code, parentEmail, expiresAt, schoolId: sid,
});
res.status(201).json(linkingCode);                        // the live code is in the response body
```

`storage.createLinkingCode` is a bare insert with no ownership check, and `useLinkingCode` (`storage.ts:1497`) never checks that the redeeming parent relates to that student's school.

**Working exploit, no email required:** obtain another school's student id → POST to this endpoint with your own throwaway parent email → read `code` from the 201 response → redeem at `/api/parent/link-code/confirm` → you now hold a permanent parent link to another school's child, with their books, allocations, payment history and class.

**Fix:** one line. `if (!student) return res.status(404).json({ message: "Student not found" });`

### S3 — Parent identity is an unverified email string *(critical)*

`parent_children.parentIdentifier` is `text`, not a foreign key. `users.email` is neither unique nor verified (`emailVerifiedAt` is written `null` in all five creation paths and read nowhere).

Two working attacks:

- **Admin-side:** `POST /api/users` (`user.routes.ts:190-236`) detects a duplicate email and offers `forceCreate` to make a second account anyway. Create `{role:"parent", email:"<a rival school's parent>", forceCreate:true}`, log in, call `/api/parent/children`.
- **Unauthenticated:** `storage.deleteUser` (`storage.ts:2645`) does not delete `parent_children` rows. Those rows now name an email with no account. Anyone can sign up at the public parent-signup endpoint with that address and inherit the children.

**Fix (two cheap parts):** unique index on `lower(users.email)`; delete `parent_children` rows in `deleteUser`. Properly, later: re-key on `user_id`.

### S4–S7 — the rest of the tenant gaps *(high)*

| ID | Where | What |
|---|---|---|
| S4 | `book.routes.ts:454-490`, `storage.ts:1279-1297` | Book-level items: read, write **and delete** across tenants. Injecting a book into another school's bundle silently changes what their parents are billed. |
| S5 | `student.routes.ts:228, 239, 253` | Student book-level overrides — `sid` is computed and never used. `setStudentBookLevelOverride` does an unconditional delete-then-insert on a foreign child. |
| S6 | `book.routes.ts:493`, `allocation.routes.ts:99`, `book.routes.ts:377` | Body-supplied foreign keys not validated against the caller's school. The correct pattern already exists at `family-enrollment.routes.ts:637`. |
| S7 | `user.routes.ts:262` | `PATCH /api/users/:id` is unfiltered mass-assignment. `schoolId`, `email`, `username`, `status` all pass through — setting `schoolId` moves an account into another tenant. |

### S8 — Authorisation trusts unvalidated free-text strings *(high, no live exploit)*

`server/middleware/auth.ts:586` builds available contexts from `SECONDARY_ROLE:*` rows with no validation against `USER_ROLES`. A row reading `SECONDARY_ROLE:owner` becomes a switchable context that satisfies `requireRole(...PLATFORM_OWNER_ROLES)` — the gate on the entire owner console.

I traced every writer into that table; **no HTTP route grants this today.** The finding is structural: one console SQL statement, one seed script, or one future endpoint that forwards a role string, and a tenant-scoped user becomes a platform owner with nothing flagged as security-relevant.

Related, and worth fixing in the same pass: `all_access` outranks the exclusion list built to constrain it. `shared/test-superuser.ts:68` deliberately withholds `owner`/`platform_admin` from the test account, but the bypass at `auth.ts:397` satisfies *every* `requireRole` including the owner ones — and because the context is then `"all_access"`, `isPlatformOwnerRole()` is false, so the mandatory-owner-MFA check two lines down is skipped too.

### The kill switch does hold

I tried to break the production guard on the test superuser and could not. `isTestModeEnabled()` is re-evaluated on every call, `syncSessionActiveContext` clears stale session flags on every request, and nothing in a request body can set the permission. With `NODE_ENV=production` and `ALLOW_TEST_SUPERUSER` unset, a leftover `TEST_SUPERUSER` row grants exactly nothing. **Confirmed safe.**

Two caveats to write down: the switch is `NODE_ENV`-shaped, and that same variable also controls the seed endpoint, secure cookies, `trust proxy`, HSTS and the CSP — one misconfigured environment fails all six at once. And `ALLOW_TEST_SUPERUSER=true` on a staging deployment sharing a database with production would be catastrophic. Consider gating it on a non-production `DATABASE_URL` host as well.

### Also worth knowing

- **`Math.random()` generates rotated linking codes** (`storage.ts:1479`) — and rotation is specifically the path used *after a code has leaked*. The correct `crypto.randomBytes` implementation sits two files away at `auth.ts:79` with a comment explaining why. One-line fix.
- **Secrets in logs.** Password-reset links, invite links, parent linking codes with the child's name, and contact-form message bodies are all `console.log`ed whenever email delivery fails (`auth.routes.ts:429`, `user.routes.ts:788`, `student.routes.ts:74, 109`, `public.routes.ts:45`). On Vercel these land in a log store readable by a wider group than the database.
- **`POST /api/seed-users`** creates a platform owner with password `bythub123` (`routes/index.ts:82`). Dev-gated, but on the same single `NODE_ENV` point of failure. Delete it; move seeding to `script/`.
- **UK GDPR gap:** there is no path to erase one child's record. `DELETE /api/students/:id` is a soft archive. Hard deletion exists only for an entire school. An Article 17 request today requires manual SQL. Also: no read-auditing — "which member of staff viewed this pupil's file?" is currently unanswerable.

### Priority note

**If Al-Noor is your only tenant today, S1–S7 are latent rather than live.** Nobody can leak data across a boundary that has only one side. That is a legitimate reason to fix the three broken hand-offs *first* if the demo is next week.

It stops being true the day you onboard school two. S1, S2 and S3 must be closed before a second tenant's data enters the system, and S2 in particular is a one-line fix that there is no reason to defer.

---

## 4. The three broken hand-offs

This is what stands between today and a school running a full term.

### H1 — The importer sends no parent invitations

Manual enrolment creates a family linking code and emails it (`family-enrollment.routes.ts:915`). `commitImport` has **no `createLinkingCode` call at all**.

The spreadsheet importer is the only realistic way to onboard a real school. Import 300 families and **not one parent can log in.** The only remedy is a per-guardian invite button (`admin/families.tsx:242`) — one click each, 300 times.

There is a bitter irony here: the *legacy* naive CSV importer (`student.routes.ts:121-210`, which splits on commas and creates family-less students) **does** send codes. The good importer doesn't. Exactly backwards.

**Fix:** add `createLinkingCode` + `sendParentCodeEmail` to `commitImport`, plus a bulk "invite all uninvited guardians" action. This is the single highest-value change in the report.

### H2 — Subject-assigned teachers see an empty distribution list

There are **two** functions called `getTeacherAssignedClasses`, and they disagree:

- `book.routes.ts:187` — **includes** `class_teacher_assignments`. Serves `/api/classes` and `/api/students`.
- `auth.ts:937` — **does not**. Serves `/api/allocations` and every custody guard in `allocation.routes.ts`.

A third path, `storage.ts:2381` `getDistributionsByTeacher`, queries only `classes.teacherId` and early-returns `[]`.

`class_teacher_assignments` was added for schools where several teachers share a class by subject. It has full CRUD and a UI. But the lookup that reads it is used in exactly one place — to grant the teacher *context*. So a subject-assigned teacher logs in, gets a teacher dashboard, sees their classes… and an empty distribution list.

**Assigning teachers the new way silently breaks the last stage of the term.**

**Fix:** collapse the two functions into one; make `getDistributionsByTeacher` use `getAssignedClassIdsForTeacher`. Until then, **document that teachers must be set via `classes.teacherId`** — this is the one finding that needs an immediate workaround note even if the code fix waits.

### H3 — "Hand books to teacher" does not exist as a screen

`server/custody.ts`, the `custody_events` table, two endpoints and a backfill exist. **Zero references to "custody" anywhere in `client/src`.**

Worse, the state machine is provably inert. Allocations default to `custodyStatus: "reserved"`. `allocation.routes.ts:289` fires a transition to `"issued"`. But `ALLOWED_TRANSITIONS.reserved = ["prepared","returned","lost"]` — so the call throws, and `tryCustody`'s empty `catch {}` swallows it. `tests/custody-machine.ts:36` **asserts that `reserved → issued` is rejected**: the test locks in the design, and the app calls exactly that transition on the happy path.

The code admits it. `collection-sheet.tsx:16`: *"there's no auto-link payment→copy, so the paper roster is the safety net at hand-over."*

**Decision required — this is yours, not the programmer's:**

- **Option A (recommended for weeks):** delete custody entirely (~290 lines) and ship the printed collection sheet as the hand-over mechanism. Schools already work this way. Nothing breaks — it is inert today.
- **Option B:** build the two missing screens and fix the transitions. Realistically 3–5 days including the status-string mismatch in `deriveCustodyFromLegacy`.

Do not do neither. Right now you maintain a state machine that runs on nothing.

---

## 5. Money-path data integrity

`storage.confirmPayment` (`storage.ts:1937-2000`) is where orders become allocations. It has three defects that compound.

### D1 — No transaction, and the idempotency guard makes partial failure permanent *(critical)*

It sets `status = "confirmed"` **first** (`:1953`), then loops baskets creating allocations (`:1963-1998`). The guard at `:1948`:

```ts
const ALREADY_PROCESSED = ["confirmed", "ready_for_collection", "collected"];
if (ALREADY_PROCESSED.includes(existing.status)) return existing;
```

**Scenario:** a finance officer confirms an order with three baskets. Basket 1's allocations are written. The Vercel function hits its 30-second ceiling during basket 2. The order row already says `confirmed`. The officer clicks again — the guard sees `confirmed` and returns immediately. **Baskets 2 and 3 never get allocations.** The parent has paid, the money is recorded, two children never appear on any teacher's list, and nothing logs an error. No query anywhere in the codebase would surface it.

**Fix:** wrap in `getTxDb().transaction()`, move the status update to **last**, and replace the read-then-check guard with a conditional update used as a lock:

```sql
UPDATE book_payments SET status='confirmed', ...
 WHERE id=$1 AND status NOT IN ('confirmed','ready_for_collection','collected')
 RETURNING *
```

Zero rows means another caller won.

### D2 — Allocation can exceed stock, deliberately *(critical)*

`storage.ts:1991` — verified:

```ts
try {
  await this.adjustStock(item.bookId, item.quantity, "allocation", `...`);
} catch (e) {
  // Stock adjustment failure should not block allocation
}
```

`adjustStock` is *correct* — it refuses to drop below zero via a guarded UPDATE and throws. `confirmPayment` catches that and creates the allocation anyway.

**Scenario:** 30 copies in stock, 40 orders confirmed. Result: 40 allocation rows, stock at 0, and ten children holding an allocation for a book that does not exist. Teachers discover it on distribution day, in front of the class.

**Fix:** delete the `try/catch`. Let it throw inside D1's transaction so the confirmation rolls back and the officer sees "insufficient stock".

### D3 — Double-confirm race *(critical)*

`SELECT` at `:1941` → check at `:1948` → write at `:1953` is check-then-act with no lock. A finance officer clicking while the auto-verifier processes the same order: both read `reference_submitted`, both pass, both create full allocation sets, stock deducted twice.

Note the asymmetry in your own tests: `tests/stock-idempotency.ts:39` fires ten *concurrent* calls and asserts — good. `tests/payment-idempotency.ts:5` only calls each transition twice *sequentially*. The race is untested.

**Fix:** same conditional-update lock as D1.

### D4 — Storage is structurally locked out of transactions *(prerequisite for D1–D3)*

There are three database clients: `config/database.ts:49` (`getDb()`, Neon HTTP, no transactions), `:81` (`getTxDb()`, pg Pool, transactional), and a **third private one** at `storage.ts:33-40`. All 152 storage methods use the private one. Only two files in the entire repo use `getTxDb()`.

This is *why* D1–D3 exist — no storage method *can* be made atomic without changing which client it uses.

**Fix (~20 lines, do it first):** delete `storage.ts:33-40`, import from `config/database.js`, and give money-path methods an optional `db` handle defaulting to `getDb()`.

### D5 — An order can be paid twice *(medium)*

`basket_payments` has no unique constraint on `basketId`, and `createPayment` never checks whether a basket already has one. Two POSTs with the same `basketIds` create two full-price payment rows. Separately, the parent-typed reference number has no unique constraint, and its duplicate check contains an empty `if` block with the comment *"drizzle doesn't have neq in simple form"*.

**Fix:** two unique indexes — `basket_payments(basket_id)` and `book_payments(school_id, payment_reference_number)`.

### D6 — Status columns have no constraints, and have already drifted *(high)*

Every status column is bare `text`. `PAYMENT_STATUSES` declares five values; the code writes `"ready_for_collection"`, `"collected"` and `"cancelled"`, none of which are in the list. `DISTRIBUTION_STATUSES` declares four; `storage.ts:2476` writes `"out_of_stock"`.

A typo in a new call site produces a row Postgres accepts and every filter silently misses.

**Fix:** four `CHECK (status IN (...))` constraints after reconciling the constants with what is actually written. Cheap, and makes further drift impossible.

### D7 — No reproducible way to create a database *(high)*

`drizzle.config.ts:9` points `out` at `migrations/`, but that directory holds hand-written SQL with **no `meta/_journal.json`** — so `drizzle-kit migrate` cannot run it. `package.json` offers only `db:push`, which ignores `migrations/` entirely and diffs against a live database. **There is no migration-tracking table anywhere.**

Objects that exist only in SQL and can never be produced by `push`: the `console` schema, its views, the `console_ro`/`console_rw` roles, and the `console_audit` immutability trigger.

`PROJECT_MASTER.md:305` records that `db:push` currently *fails* — it wants to add a unique constraint on `families.family_code`, prompts to truncate the table, and aborts on an orphan `guardians.family_id`.

**So the real source of truth is the production database, and it has been hand-patched.** Whether any given environment has the `002b` cascades — which GDPR erasure silently depends on — is unanswerable from the repo.

You saw a live consequence of this yesterday: two databases on one Neon endpoint (`neondb` with the data, `scholarshelf-co-uk` empty), and no way to tell from the repo which was correct.

**Fix:** point `drizzle-kit generate` at a scratch database, commit the baseline plus journal, add a `db:migrate` script, move `001` to a documented one-time bootstrap. A day's work, and nothing else is verifiable until it exists.

---

## 6. Why deploys keep breaking

Three releases died on a committed file importing an uncommitted one. **It is not `.gitignore`** — I reconstructed a scratch repo with your exact `.gitignore` and ran `git check-ignore` against all five historically-missing paths. None is ignored. Chasing that hypothesis is how a team burns a week and ships the same bug a fourth time.

### B1 — CI is permanently red at step 3 of 5 *(critical)*

`.github/workflows/ci.yml:37-44` orders the steps Type-check → Production build → Unit tests. I ran the first one against the committed tree:

```
client/src/pages/admin/collection-sheet.tsx(81,88): error TS2554: Expected 1-2 arguments, but got 0.
server/routes/cron.routes.ts(178,26): error TS2802: Set<string> can only be iterated with --target es2015 or higher
server/routes/cron.routes.ts(216,95): error TS2345: 'string | null' not assignable to 'string | undefined'
```

**So the build step below it has never run.** And `integration: needs: verify` (`ci.yml:48`) means **zero tests have ever run in CI either.**

Red is the resting state of this repo. A red ✗ from a genuinely missing file looks identical to the red ✗ that has been there for weeks. Everyone has correctly learned to ignore it.

The check that catches missing-file imports already exists, is already ordered first, and is already broken. `tsc` emits `TS2307: Cannot find module` for exactly this failure mode.

**Fix — four edits, about an hour:**

1. `tsconfig.json` has **no `target`**, so it defaults to ES5 and any `[...new Set()]` is a type error. Add `"target": "ES2022"` — removes `TS2802` outright.
2. `collection-sheet.tsx:81` calls `formatDateTime()` with no argument. At runtime this prints **"printed —"** on every collection sheet a school hands out. Pass `new Date()`.
3. `cron.routes.ts:216` — `summary.error ?? undefined`.
4. Then **make `verify` a required status check on `main`.** Without branch protection, green CI is advisory.

Also move `tsBuildInfoFile` out of `node_modules` — the cache currently replays stale diagnostics, so running `tsc` by hand can disagree with CI in both directions.

### B2 — Local builds and deployed builds are different programs *(critical)*

- `vercel.json:3` → `npm run build` → `script/build.ts:54` bundles `server/index.ts` → `dist/index.cjs`.
- `vercel.json:4` sets `outputDirectory: "dist/public"` — **`dist/index.cjs` is outside it and is never uploaded.**
- `vercel.json:5-9` declares one function, `api/index.ts`, which Vercel compiles independently at deploy time.

`npm run build` spends 1.3 seconds producing a 2.9 MB server bundle that production never executes. **Deploy is the first clean-checkout compile in the entire pipeline.** That is the structural reason an uncommitted file surfaces as a production failure rather than a local one.

### B3 — The build allowlist fails silently *(high)*

`script/build.ts:5-31` lists dependencies to bundle; everything else is marked external. esbuild never resolves an external import — so a forgotten entry produces **a green build with no warning** and a crash at `require()` on first request.

It is already wrong in both directions. Ten entries are not dependencies at all (`axios`, `cors`, `stripe`, `openai`, `nodemailer`…). Five packages the server actually imports are missing, including three **devDependencies linked into the production bundle** (`vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`).

Worse: `server/vite.ts:7` imports `nanoid`, which is **not in `package.json`** — it resolves only as a hoisted transitive of vite. Any hoisting change, or `npm ci --omit=dev`, turns this into a build failure.

**Fix — invert the policy so the default is safe:**

```ts
// Runtime deps stay external (they're installed in prod). Everything else —
// including anything you forgot to declare — gets bundled, so a missing
// package fails the BUILD instead of the first request.
const externals = Object.keys(pkg.dependencies || {});
```

### B4 — The daily cron serves one school per day *(high — this one costs money)*

`vercel.json:13` — `"schedule": "0 7 * * *"`, one tick per day. `cron.routes.ts:252` — verified:

```ts
// One school per invocation keeps every run comfortably inside the 30s ceiling
const target = pending[0];
```

The header comment says *"the schedule drains the queue across successive ticks"* — but there are no successive ticks, and `pending` is recomputed each day from the same list.

**From school #2 onward: no daily digest, and parents get no unpaid-payment reminders, ever.** No error, no alert, and a cheerful `200 OK` reporting `remaining: 4`.

**Fix:** change the schedule to `"0 * * * *"`. Idempotency is already guaranteed by a unique index on `(job, school_id, run_date)`, so hourly ticks are safe and drain N schools in N hours. Also: if `CRON_SECRET` is unset every invocation 401s forever, and that variable is **absent from `.env.example`**.

### B5 — Configuration is a minefield *(high)*

`server/config/env.ts:4` calls itself *"the single source of truth for all environment variables"*. It is imported by **two files**. Everything else reads `process.env` directly — about 20 sites across `app.ts`, `storage.ts`, `email.ts`, `auth.ts`, `paymentIntegration.ts`.

**`.env.example` is missing 12 variables the code reads, and mislabels a required one as optional.** The traps:

- `PAYMENT_WEBHOOK_SECRET` is listed under *"optional"* but **hard-throws at boot in production**, before any route is reached — a 100% 500 rate naming a variable nobody was told was required.
- `RESEND_FROM_EMAIL` — `env.ts` requires a bare address; `email.ts` accepts `Name <addr>`. Setting the display-name form in Vercel **fails boot**.
- `SESSION_SECRET` has two different dev defaults in two files; sessions signed under one are invalid under the other.
- `CONTACT_INBOX_EMAIL` defaults to a hardcoded personal address.
- `DATABASE_URL` absent ⇒ silently falls back to in-memory sessions; every cold start logs everyone out.

### B6 — Tests are real, runnable, and unreachable

Ten hand-rolled suites (~3,070 lines), run by `tsx`, correct exit codes. `tests/custody-machine.ts` passes 36/36 standalone. Three suites have **no CI step at all** — including `test:verification`, the 559-line payment suite. And the whole integration job is dead behind the broken `verify`. **Tests actually running in CI today: zero.**

Coverage is domain-deep and infrastructure-blind: auth, tenancy, custody, payment idempotency, UK dates, Stripe reconciliation. Nothing covers build, boot, config or deploy — which is precisely where all three outages lived.

**The highest-value missing test** is a clean-checkout build-and-boot: compile `api/index.ts` (the artifact that actually ships) and *boot* it under production-shaped env with one real request to `/api/health`. About 15 lines, runs in under 10 seconds, and catches all three historical failures plus the `PAYMENT_WEBHOOK_SECRET` class.

### B7 — You cannot answer "my payment didn't go through"

The *domain* trail is excellent — `payment_verification_attempts` is append-only with an evidence snapshot of expected-vs-found, and answers most parent complaints on its own.

The *request* trail is unusable. `app.ts:180` logs method, path, status and duration — no request id, no user id, no school id. The 5xx handler mints an `errorId` and returns it to the parent, then only `console.error`s it. Vercel retains runtime logs about an hour on Hobby. **A parent who quotes their error reference the next morning cannot be helped.** And any non-5xx failure — a rejected import, a bad reference — leaves zero server-side trace.

**Fix (~15 lines):** mint `req.id` in the first middleware, include it plus user and school in the log line, emit as JSON, and make the 5xx handler's `errorId` **the same value**.

---

## 7. What to cut

Roughly **8,300–8,800 lines of ~25,000 — about a third — can go without touching the termly cycle.** Under a weeks-long deadline this is not tidying; it is halving the surface you have to keep correct and secure.

| Feature | Lines | What breaks |
|---|---|---|
| **Owner + DB console** | ~3,890 | You must keep `POST /api/owner/schools` and support-mode entry. The other ~3,400 — SQL browser, elevation, purge, activity feed, system health — is ops tooling for one school. **Biggest single win.** |
| **Website builder / CMS** | ~1,200 | Nothing on the core path. Removes the `it_personnel` role's entire reason to exist. Clean cut. |
| **Parent↔teacher messaging** | ~960 | Nothing on the core path. |
| **Branding / theming** | ~750 | Emails fall back to default colours — already handled. Also removes base64 logos stored in Postgres. |
| **MFA** | ~597 | Nothing. Nobody at a primary school will enrol a TOTP app. *(Keep if you keep the owner console — it gates break-glass.)* |
| **Book copies / barcodes** | ~440 | Nothing — already disconnected from allocation and sales. This is a **second stock model**; deleting it removes real ambiguity. |
| **Custody state machine** | ~290 | Nothing today — it is inert. Only cut if you also decide against the teacher hand-off (H3). |
| **Legacy CSV importer** | ~170 | Nothing, once the good importer sends invites. Removes a footgun that creates family-less students. |
| **Dead `parents.tsx`** | 182 | Nothing. Already unreachable. |
| **41 unused shadcn components** | ~3,500 | Nothing — not shipped anyway. Maintenance noise only. |

**Do not cut** the payment-verification service or the enrolment importer. They are the two best-engineered things here and both sit directly on the critical path.

---

## 8. Client-side defects that would damage a live demo

The client architecture is sound — **zero optimistic updates anywhere**, so there is no code path where a parent sees a payment that didn't happen. Server authorisation is genuinely independent; the client guard is a convenience, not the protection. Mobile and tablet are viable today.

The damage is concentrated in two places.

**A stale error contract.** `lib/queryClient.ts:15` replaces `err.message` with the server's JSON message and puts the status on `err.status`. Four call sites still parse the *old* `"<status>: <body>"` string format — `register.tsx:47`, `accept-invite.tsx:102`, `reset-password.tsx:57`, `owner.tsx:861`.

The worst is registration. `shared/schema.ts:1103` enforces `/^[a-zA-Z0-9_.-]+$/` on usernames, but the form only sets `minLength={3}`. A parent named O'Brien, or anyone who types their email address or a space, is rejected — and the per-field explanation arrives on `err.body.errors` and is **thrown away**. They see "Registration failed. Please try again." and can retry forever with no path to discovering the rule.

*(This is the same bug I fixed in `login.tsx` yesterday, in four more places.)*

**Failed queries render as confident zeros.** Only 5 of 111 files handle query errors, four of them owner-facing. **Zero** error branches in parent, teacher, finance or school-admin pages. Combined with `retry: false`, one transient failure on school wifi is final:

- `finance.tsx:106` — a failed summary renders **"Total Revenue £0.00 · Outstanding £0.00"** as fact. A bursar could reasonably conclude nobody has paid.
- `parent.tsx:159` — a failed request tells a parent *"No baskets awaiting payment. You're all caught up."*

The 401 case is worse: the query throws, the page falls back to `[]`, and the user is **not** redirected — with `staleTime: 5 * 60 * 1000` on `/api/auth/me`, they sit inside a fully-rendered app showing zeros for up to five minutes after their session dies.

### The demo list, in the order a headteacher notices

| # | Defect | Fix |
|---|---|---|
| 1 | 404 page reads **"Did you forget to add the page to the router?"** (`not-found.tsx:15`) — and has no link back anywhere | ~10 lines |
| 2 | A parent cannot register and cannot find out why (`register.tsx:47`) | ~15 lines |
| 3 | Failed request tells the finance officer the school has taken £0.00 | part of the `<QueryState>` work |
| 4 | Failed request tells a parent they owe nothing | same |
| 5 | A stray tap outside the dialog **erases the payment reference** the parent just copied by hand (`parent.tsx:1377`) | ~2 lines |
| 6 | Teacher's "Mark Absent" silently no-ops on failure — its three siblings all have `onError`, this one doesn't (`teacher.tsx:191`) | 3 lines |
| 7 | Admin sidebar scrolls back to top **every 15 seconds** — `SidebarContent` is defined inside `Layout`, so the notification poll remounts the whole subtree (`layout.tsx:274`) | ~5 lines |
| 8 | One misclick on an unlabelled icon changes what an entire class is billed for, no confirm, no undo (`admin/book-levels.tsx:291`) | ~45 lines |
| 9 | Negative book prices reach the database — no `min` on the input, and `insertBookSchema` exists but is never used (`book.routes.ts:35`) | ~6 lines |
| 10 | "Financial Reports" has no export. The first question a bursar asks is "can I get this into a spreadsheet?" | half a day |

**Items 1, 2, 5, 6 and 7 total under 40 lines and remove five of the ten.**

Also note: a teacher who mis-taps "received" on the wrong child has **no reverse endpoint** — `allocation.routes.ts:270-338` offers confirm, absent, out-of-stock and report-issue, and nothing to undo them. On a tablet, on distribution day, that will happen.

---

## 9. The plan

### Days 1–2 — stop the bleeding *(half a day of actual work)*

1. `"target": "ES2022"` in `tsconfig.json`; fix the two type errors; move `tsBuildInfoFile` out of `node_modules`.
2. Make `verify` a **required status check** on `main`.
3. Add `script/smoke-boot.ts` — compile and *boot* `api/index.ts` under production env, hit `/api/health`.
4. Add a pre-push hook rejecting untracked files under `client/ server/ shared/ api/ script/`, and extend `.gitignore` with `tmp-*`, `a.out`.
5. Cron schedule `0 7 * * *` → `0 * * * *`; set `CRON_SECRET`.

*After this, a broken deploy is caught before it reaches Vercel. Everything below gets faster.*

### Week 1 — the leaks and the blocker

6. **S2** — one line, the linking-code 404. Do it first; there is no reason to defer it.
7. **S1** — 403 on null tenant scope in `requireRole`; make `schoolFilter` throw.
8. **S3** — unique index on `lower(users.email)`; delete `parent_children` in `deleteUser`; remove `forceCreate`.
9. **H1** — the importer sends linking codes. *This is the single highest-value change in the report.*
10. **S4–S7** — scope the remaining handlers; allowlist the columns in `PATCH /api/users/:id`.

### Week 2 — money-path integrity and the term

11. **D4** — unify the database clients (~20 lines, prerequisite).
12. **D1 + D2 + D3** — `confirmPayment` transactional with a conditional-update lock; stop swallowing the stock error.
13. **D5** — two unique indexes.
14. **H2** — collapse the two `getTeacherAssignedClasses`. *Until this ships, document that teachers must be set via `classes.teacherId`.*
15. **H3** — decide: delete custody, or build the two screens.
16. **D7** — baseline migration plus journal, so schema changes become shippable.

### Week 3 — surface reduction and polish

17. Cut the website builder, messaging, book copies, legacy importer, dead `parents.tsx` (~2,950 lines).
18. Tier-A UX fixes 1, 2, 5, 6, 7 (~40 lines).
19. Request-id logging; make `errorId` the request id.
20. `.env.example` completeness; move raw `process.env` reads into `env.ts`.
21. Financial report CSV export.

### Splitting the work three ways

- **The programmer** takes §5 (money-path integrity) and §3 (tenant scoping). These need care, are well-specified above, and are the ones where a mistake is expensive.
- **AI-assisted work** suits §7 (the cuts — mechanical and verifiable), the client file-splits, and the `useApiMutation` hook that removes ~450 lines of duplicated boilerplate. High volume, low judgement, easy to review.
- **You** take the H3 decision, the cut list, and CI — the parts that need product judgement or an account you own.

---

## 10. Two things that need a decision, not a fix

**Custody (H3).** Delete it or build it. Maintaining an inert state machine that the happy path calls illegally is the worst of both.

**The empty `scholarshelf-co-uk` database.** Your Neon project has two databases: `neondb` (the data) and `scholarshelf-co-uk` (empty, created by the Vercel–Neon integration). Anyone wiring up local env from the integration's variables — the obvious thing to do — gets a database that connects cleanly and contains nothing. It cost us a full diagnostic round yesterday. Delete it, or make one variable obviously canonical.

---

## Appendix — finding register

| ID | Sev | Finding | Location |
|---|---|---|---|
| S1 | Critical | Null school scope reads all tenants | `storage.ts:257`, `auth.ts:175` |
| S2 | Critical | Linking-code IDOR across schools | `student.routes.ts:59` |
| S3 | Critical | Parent identity is unverified email | `schema.ts` `parent_children`, `user.routes.ts:190` |
| S4 | High | Book-level items unscoped R/W/D | `book.routes.ts:454` |
| S5 | High | Student overrides unscoped | `student.routes.ts:228` |
| S6 | High | Body-supplied FKs unvalidated | `book.routes.ts:493` |
| S7 | High | Mass-assignment on user update | `user.routes.ts:262` |
| S8 | High | Contexts from unvalidated strings | `auth.ts:586`, `auth.ts:397` |
| S9 | Medium | `Math.random()` for rotated codes | `storage.ts:1479` |
| S10 | Medium | Secrets and PII in logs | `auth.routes.ts:429` et al |
| S11 | Medium | No single-child erasure path | `book.routes.ts:392` |
| H1 | Critical | Importer sends no parent invites | `import-service.ts:390` |
| H2 | Critical | Subject teachers see no distributions | `auth.ts:937`, `storage.ts:2381` |
| H3 | High | No teacher hand-off screen | `custody.ts`, no client refs |
| D1 | Critical | `confirmPayment` not transactional | `storage.ts:1937` |
| D2 | Critical | Allocation exceeds stock | `storage.ts:1991` |
| D3 | Critical | Double-confirm race | `storage.ts:1941` |
| D4 | High | Storage locked out of transactions | `storage.ts:33` |
| D5 | Medium | Order payable twice | `storage.ts:1834` |
| D6 | High | Status columns unconstrained, drifted | `schema.ts:736` |
| D7 | High | No reproducible schema | `drizzle.config.ts:9` |
| B1 | Critical | CI red ⇒ build gate never runs | `ci.yml:37` |
| B2 | Critical | Local build ≠ deployed build | `vercel.json:4` |
| B3 | High | Build allowlist fails silently | `build.ts:5` |
| B4 | High | Cron serves one school per day | `vercel.json:13` |
| B5 | High | Config drift, 12 undocumented vars | `config/env.ts:4` |
| B6 | Medium | Zero tests run in CI | `ci.yml:48` |
| B7 | Medium | Cannot trace a parent complaint | `app.ts:180` |
| C1 | High | Stale error contract, 4 sites | `register.tsx:47` |
| C2 | High | Failed queries render as zeros | `finance.tsx:106` |
| C3 | Medium | Destructive actions, no confirm | `book-levels.tsx:291` |
| C4 | Medium | Dialog dismiss wipes payment ref | `parent.tsx:1377` |
| C5 | Medium | Sidebar remounts every 15s | `layout.tsx:274` |
| C6 | Medium | Negative prices accepted | `book.routes.ts:35` |
| C7 | Low | Developer text on 404 page | `not-found.tsx:15` |

---

*Findings were produced by five parallel audits of the codebase. S1, S2, D2, B1 and B4 were re-verified by hand against the source before publication. Everything else carries a `file:line` reference for independent checking — treat those as leads to confirm, not gospel.*
