# CURRENT_BEHAVIOUR_BASELINE.md — Stage 0D

*The parity contract. Everything recorded here is behaviour that exists in the code today and must
survive any redesign. A replacement is not complete until every line marked **MUST SURVIVE** is
demonstrably true of the replacement.*

Read from `C:\dev\scholarshelf` at HEAD `e80aad8` + working tree, 23 August 2026.
Where a claim depends on a test, the test is named; per `RESTRUCTURE_STATE.md` no test was
executed in this session.

---

## B-1 · Authentication and session

**Works today**
Sign-in resolves the role server-side from the stored user, regenerates the session, and — where
the account has MFA enabled — returns `{ mfaRequired: true }` before establishing an authenticated
session. Password hashing is bcrypt cost 12. Reset and invite tokens are stored hashed. The
forgot-password response is identical whether or not the account exists.

**Relied on by** every role.

**MUST SURVIVE**

- `req.session.save()` is awaited before the success response on sign-in
  (`auth.routes.ts:192`), sign-up (`:270`) and the MFA challenge (`:160`). *Removing this
  reintroduces a race where the 200 is on the wire before the session row is committed and the
  client's first authenticated request 401s.*
- Session regeneration on privilege change.
- Anti-enumeration on password reset — same message, same timing branch, both paths.
- `safeUser()` strips `passwordHash` from every response.
- MFA is **mandatory server-side for platform-owner roles** (`auth.ts:456`), and the enrolment
  endpoints sit behind `requireAuth` not `requireRole` so no one can be locked out by the rule.
- `POST /api/auth/context` validates the requested context against the account's genuinely
  available contexts and 403s otherwise; both real switches and test-account simulation are audited
  under distinct event names.

**Edge cases** Legacy role strings are normalised by `LEGACY_ROLE_MAP` / `resolveRole()` at every
entry point — three historical role vocabularies still exist in stored data.

---

## B-2 · Tenant isolation

**Works today** One choke point plus storage-level assertions.

**MUST SURVIVE** — this is the single most valuable asset in the codebase.

- `ensureSessionSchoolIsActive()` (`auth.ts:352`) returns **`boolean`**, never a `Response`.
  Callers do `if (!allowed) return;` and a `Response` object is truthy — returning one let users of
  suspended, archived and deleted schools fall through `requireAuth` **and** `requireRole` into the
  route body. The two comments in that function explaining this must stay with the code.
- A tenant-scoped role with `schoolId === null` is refused 403 and audited
  (`session_blocked_missing_school_scope`). Without it, `schoolFilter()` emits no `WHERE` clause and
  `/api/students` returns every child on the platform.
- `TENANT_SCOPED_ROLES` excludes `owner`/`platform_admin` (null means all tenants **by design**)
  **and excludes `parent`** — parents register with `schoolId: null` and are scoped through
  `parent_children`. *Blocking parents here takes out the entire parent portal.*
- The four private storage asserts — `assertBookLevelInSchool`, `assertStudentInSchool`,
  `assertBookInSchool`, `assertClassInSchool` — validate **body-supplied foreign keys** on
  `createStudent`, `updateStudent`, `assignClassBookLevel`, `createAllocation`, `addBookLevelItem`.
  They live in storage precisely so a route cannot forget them.
- Cross-tenant reads return a safe 404, not a 403 (no existence leak).
- `it_personnel` is a **server-side** boundary, not hidden navigation.

**Tests** `tests/tenant-isolation.ts` with named probes for S1, S2, S4, S5, S7, and the
`script/seed-school-b.ts` two-school fixture. *Without a second seeded tenant this suite passes
vacuously.*

---

## B-3 · Payment confirmation (the money path)

**Works today** `storage.confirmPayment` (`storage.ts:2210`) runs as one transaction.

**MUST SURVIVE**

- **Atomicity of** payment status change **+** allocation creation **+** stock deduction. Splitting
  these into independently-ordered updates reintroduces permanent partial failure.
- The claim/lock pattern: a single conditional
  `UPDATE … WHERE status NOT IN ('confirmed','ready_for_collection','collected') RETURNING *`.
  Exactly one concurrent caller gets a row; the loser returns the current row unchanged rather than
  repeating the side effects.
- **No `catch {}` around the stock deduction.** Insufficient stock rolls the whole confirmation back
  and the finance officer sees *"Not enough stock: &lt;title&gt;. Restock before confirming — nothing
  has been changed."*
- The per-basket guard is retained **in addition to** the transaction, because baskets may already
  have been allocated by a partial run of the old non-transactional code.
- Money is `numeric(10,2)` in the database. It must not become a float anywhere it is totalled.

**Duplicate protection — application and database must agree**

- `createPayment` refuses a basket that already has a payment: **409, `code: "duplicate_order"`**
  (`parent.routes.ts:287`).
- `migrations/006`: unique on `basket_payments(basket_id)`, unique on
  `book_payments(school_id, upper(btrim(reference)))`.
- `isPaymentReferenceDuplicate` normalises **the same way the index does**. If one side changes,
  both change.

**Tests** `payment-idempotency.ts`, `stock-idempotency.ts`, `payment-verification.ts`.

**Known non-defect** The "double-confirm race" did not reproduce against the original code; the
per-basket guard held. The transaction is kept because it makes the outcome structural.

---

## B-4 · Allocation, distribution and custody — three separate ideas

**Works today** `finance_book_allocations` carries three status columns.

**MUST SURVIVE** — these are not synonyms and must not be merged:

| Column | Means |
|---|---|
| `status` | allocation lifecycle (finance's view of the order) |
| `distribution_status` | the teacher hand-over event, incl. `out_of_stock`, `partially_collected`, absent |
| `custody_status` | where the physical book is |

`migrations/006` derives each CHECK constraint from **declared ∪ values already in the table**, so
it cannot reject a row production writes today; undeclared values are raised as NOTICEs for later
tightening. **Keep that property in any future constraint work** — a CHECK built from the declared
list alone will fail on live data.

**Teacher scoping** `storage.getTeacherClassIds` (`storage.ts:1254`) is the **one** teacher→class
resolution, reading both the legacy `classes.teacher_id` model and
`class_teacher_assignments`. A subject-assigned teacher previously signed in, saw their class, and
got an empty distribution list with a 404 on every action.
*Do not recreate a second lookup.* Test: `tests/teacher-distribution.ts` (fails against the old
code).

**Open, not a defect to patch** `tryCustody()` (`allocation.routes.ts:45`) swallows illegal
transitions in a bare `catch { }`, so `ALLOWED_TRANSITIONS` is advisory. This needs a product
decision → business rule → state machine → implementation, in that order. Do not make the tests
pass by editing constants.

---

## B-5 · Family enrolment and the spreadsheet importer

**Works today** `server/services/enrollment-import/` — 8 modules; parse → validate → resolve
(class, family, student, date) → commit.

**MUST SURVIVE**

- **One transaction for the whole commit** (`import-service.ts:459`), including one family linking
  code per touched family. The school snapshot is re-read *inside* the transaction so decisions are
  made against committed state.
- **Emails are sent after commit, never inside it.** A send is slow and cannot be un-sent; a mail
  outage must not lose an import of 300 families. The rationale comment at `import-service.ts:52`
  is part of the contract.
- **Re-running an import does not re-issue a live code** — the code already in a parent's inbox
  keeps working.
- `POST /api/families/invitations/send-pending` (`family-enrollment.routes.ts:467`) is the
  idempotent, rate-limited safety net for guardians whose email arrived late or bounced.

**Behaviour a test currently pins** A completed enrolment auto-issues a linking code and sets
`portalAccessStatus: "invited"` (not `"none"`). A test previously asserted the opposite; the test
was corrected, not the code.

**Tests** `enrollment-import.ts`, `family-enrollment.ts`.

---

## B-6 · Parent portal

**Works today** Register → link children (invite link, or linking code with preview→confirm, or
CSV auto-invite) → see baskets → submit a bank-transfer payment reference → wait for finance.

**MUST SURVIVE**

- **Linking-code defences:** email-bound, single-use, expiring, userId-keyed rate limit, audited.
  `useLinkingCode` throws distinct messages for used / expired / wrong-email, and the wrong-email
  case surfaces as **403**, not 400.
- **Preview and confirm normalise the code identically** — `code.trim().toUpperCase()` on preview,
  `normaliseLinkingCode(code)` in `useLinkingCode`. A mismatch here previously showed the parent
  their child's name and then rejected Confirm as "Invalid linking code".
- The preview returns **no PII beyond the child's name**.
- Guardian↔portal-user binding after redemption is **best-effort and non-fatal** — redemption has
  already succeeded and must not be rolled back by it.
- Parents with ≥2 children with pending baskets get one `book_payment` covering multiple baskets
  via `basket_payments`.
- Payment reference is normalised `trim().toUpperCase()` before storage.
- Username rule `/^[a-zA-Z0-9_.-]+$/` is stated **before** typing and enforced client-side in the
  server's own words. A parent named O'Brien previously got "Registration failed. Please try again."
  and could retry forever.
- Dialog dismissal does not erase a hand-copied payment reference.

**Honest gap to carry into Stage 1** The portal presents card checkout; `paymentIntegration.ts` is
a stub. The real mechanism is bank transfer plus manual reconciliation. UK schools run on BACS —
the mockup is wrong, not the mechanism.

---

## B-7 · Client data-state behaviour

**MUST SURVIVE** (`components/query-state.tsx`, `lib/errors.ts`)

- A **failed** query never renders as a confident zero or an empty state. Finance must not report
  "£0.00 taken" on a dropped request; a parent must not be told "You're all caught up" when the
  check failed.
- A 401 anywhere redirects to login **once**, rather than leaving the user inside a fully-rendered
  app showing zeros.
- `describeApiError` prefers the server's per-field message, then its message, then a status
  fallback. Four call sites previously parsed a `"<status>: <body>"` format the server no longer
  emitted, so every error branch was dead.
- "Mark Absent" has an `onError`. Class↔bundle removal confirms **by name**. Negative book prices
  are refused at both ends (`insertBookSchema` existed and was not being used by the route).
- `SidebarContent` is defined **outside** `Layout` — defining it inside remounted the sidebar every
  15 seconds.

**Adoption is incomplete:** 2 of 42 pages import `query-state`. Extending it is a parity *gain*;
removing it from `finance.tsx` or `parent.tsx` is a regression.

---

## B-8 · Owner / platform tier and the DB console

**MUST SURVIVE**

- Only owner/platform_admin act across tenants; support mode is explicit and audited.
- Console is three-tiered: typed operations (no SQL) → read-only queries → break-glass writes
  behind TOTP + reason + 15-minute elevation + alerts.
- **Enforcement is in Postgres, not in regex:** `console_ro` with SELECT-only grants on a schema of
  views, `default_transaction_read_only` + explicit `BEGIN READ ONLY`, every query via the extended
  protocol (kills multi-statement), views that exclude `password_hash` / `mfa_secret` /
  `token_hash`, and always `ROLLBACK` on the read tier.
- **Every console action writes to `console_audit`.** The previous console logged nothing while
  routine logins were audited — that made GDPR Art. 33 breach notification impossible.
- The PATCH/DELETE row endpoints are gone and must not come back; they interpolated JSON object
  keys into SQL with no column allowlist.
- A school must sit in `pending_deletion` for the cooldown period before purge.

---

## B-9 · School website CMS and branding

**MUST SURVIVE**

- `it_personnel` can reach website, website-content, media and branding — **and nothing else**,
  enforced server-side as well as in navigation.
- Sections are typed (hero / about / announcement / contact / custom), draft until published.
- Public `GET /api/public/schools/:code/website` returns **published only** and fails safe to empty.
- **URL scheme allowlist** blocks `javascript:` — this was a stored-XSS fix.

---

## B-10 · Scheduled work

**MUST SURVIVE**

- `/api/cron/run` is protected by a **constant-time** secret comparison.
- Idempotency is guaranteed by a unique index on `(job, school_id, run_date)` — a retry must never
  double-email parents about money.
- The handler drains schools within a **24-second wall-clock budget** (`DRAIN_BUDGET_MS`) and warns
  with the number of schools left. It does not assume one invocation finishes every tenant.

**Open** No test asserts that a large school resumes on the next invocation. The architecture for
large tenants (batching / checkpoints / cursor) is a Stage 12 decision, not a loop extension.

---

## B-11 · Presentation contract

**MUST SURVIVE**

- `client/src/lib/format.ts` is the only place money, dates and year groups are formatted:
  en-GB, GBP, `£1,234.50`, `12 Mar 2026`, 24-hour times, and `formatYearGroup` normalising
  `4` / `Y4` / `Grade 4` / `R` to `Reception` and `Year 1–13`.
  *Before it existed there were five money helpers and thirty locale-less date calls, so a UK school
  on a US-configured laptop read 03/04/2026 as 4 March on a reconciliation screen.*
- `--success` and `--warning` tokens (with `-bg` pill fills) exist alongside `--destructive`, at
  ≥5:1 contrast on white. Present / Received / In Stock previously all rendered identically.
- The 404 page has a link somewhere.

---

## B-12 · Build, deployment and environment

**MUST SURVIVE**

- `script/smoke-boot.ts` compiles **`api/index.ts` — the artefact Vercel actually runs** — boots it
  under production-shaped env and hits `/api/health`. It runs in seconds and needs no database.
  It is ordered **before** the build in CI because it is faster and its failure message is more
  specific. Replace only with something demonstrably stronger.
- `script/build.ts` externals policy: runtime deps external, everything else bundled, so a missing
  package fails the **build** rather than the first request.
- `getDb()` selects the driver by URL and `buildSslConfig()` returns `false` for
  localhost / `sslmode=disable`. The Neon HTTP driver rewrites the hostname, so a plain Postgres URL
  became `https://api.0.0.1/sql` and every query failed — which is why no database-backed suite had
  ever run outside Neon. **Do not regress local Postgres.**
- `server/config/env.ts` validates env with Zod and fails fast at startup.
  `RESEND_FROM_EMAIL` must be a **plain address**; the display name is added at send time.
- `ensureBootstrapSchema()` stays deleted. It ran ~30 DDL statements against production on every
  cold start, swallowed errors, took ACCESS EXCLUSIVE locks, and was a second source of schema truth.

---

## Behaviour that is *documented* but does not exist

Recorded so Stage 3 does not mistake it for something to preserve.

| Claimed | Reality |
|---|---|
| Card checkout in the parent portal | `paymentIntegration.ts` is a stub; flow is bank transfer + manual reconciliation |
| "Automatic Stripe payment verification" | Spreadsheet-based reconciliation; no Stripe SDK |
| "Hand books to teacher" screen | No such screen exists |
| Financial report CSV export | Deferred |
| Class-scoped teacher visibility everywhere | Allocations are class-filtered; other teacher views are broader |
| Custody state machine enforced | Advisory only — `tryCustody` swallows illegal transitions |
