# ScholarShelf — Defensive Security & Data-Protection Design Review

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

**Purpose:** Secure-by-design guidance for a legitimate educational platform handling children's, parent, and staff data. Defensive only — access control, privacy, safe implementation. No offensive content.
**Stack (actual):** React 19 · Express 5 / TypeScript · PostgreSQL (Neon) · session auth (Postgres-backed) · Resend · Vercel.
**Legend:** ✅ already implemented in ScholarShelf · ➕ recommended addition · 🔒 requires extra protection + logging.

---

## 1. System Security Overview

ScholarShelf's security goals, in priority order:

1. **Protect student and parent data.** This is a children's-data platform; PII protection is the top obligation, both ethically and under UK GDPR / the ICO Children's Code.
2. **Keep schools isolated.** No school may ever see, edit, or infer another school's students, parents, books, classes, payments, or website content. This tenant boundary is the platform's defining security property.
3. **Protect staff accounts.** Admin/finance/IT accounts are the keys to a school's data; compromise of one exposes a whole tenant, so privileged accounts need stronger authentication than the baseline.
4. **Prevent unauthorised role access.** A user's capabilities must be decided server-side from their authenticated role — never from anything the browser sends.
5. **Protect payment records.** Only authorised staff may change payment status; every change must be attributable and reversible in the record.
6. **Protect public publishing.** Content that becomes publicly visible must go through a controlled draft→publish path and can never expose private data.

The guiding principle across all of these is **deny by default, defence in depth, and no trust in the client**.

---

## 2. Sensitive Data Classification

| Data | Sensitivity | Why | Handling |
|---|---|---|---|
| Student names, class, year, student codes | **High (child data)** | Identifies minors | Strict role+tenant access; minimise; never public |
| Parent names, emails, contact | **High (PII)** | Identifies adults, links to children | Access-controlled; lawful basis; retention limit |
| Teacher/staff accounts | **High** | Privileged access to child data | Strong auth; audit; MFA (privileged) ➕ |
| School records | Medium | Organisational, some contractual | Tenant-scoped |
| Payment status / bank-transfer references | **High (financial)** | Money + dispute record | Staff-only writes; full audit ✅ |
| Book / inventory data | Low–Medium | Operational | Tenant-scoped |
| Uploaded files / images | Medium | May carry hidden content/metadata | Validate type; strip metadata; isolate origin ➕ |
| Public website content | Low (public) but **integrity-sensitive** | Represents the school publicly | Draft/publish control ✅; safe URLs ➕ |
| Login / session data, password hashes, tokens | **Critical** | Direct account takeover if leaked | bcrypt-12 ✅; tokens stored hashed ✅; never logged |

Classification drives the rules below: **High/Critical data gets the strictest access, shortest retention, and fullest audit.**

---

## 3. Role-Based Access Control

Convention: `resource:action`. Deny by default — a role has only what is explicitly granted.

**Platform Owner / Super Admin** — cross-tenant operator (BytHub).
- See: all schools, platform metrics, database console. Change: school lifecycle, cross-tenant support. Never: this power should be used sparingly and never for casual data browsing.
- 🔒 Everything is extra-protected: `tenant:admin`, `platform:manage`, DB console. Require MFA, IP allowlist, short sessions, and full audit. Highest blast radius on the platform.

**School Admin** — full authority over one school.
- See/change: books, classes, students, parents, staff, payments, allocations, branding, website. Never: other schools; platform owner functions.
- 🔒 `users:manage`, `payments:confirm`, role changes, school settings — log all.

**IT Personnel** — the school's **public website** manager only (a separate product surface, not an operational admin).
- See/change: `website:draft`, `website:publish` 🔒, `branding:manage`. Never: students, parents, books, classes, payments, users — no operational or PII data at all. ✅ enforced server-side by excluding IT from operational role groups.

**Teacher** — class-scoped operations.
- See: students (target state: only assigned classes), class book levels, own distribution tasks, parent messages. Change: `allocations:confirm-distribution` (not for their own child ✅), `extra-requests:create`, message replies. Never: student records, payments, other teachers' classes, admin functions.

**Parent** — own children only.
- See: `students:read` (own linked children), baskets, own payments, messages. Change: create baskets (own children ✅), `payments:submit-reference` (submit only — never confirm), message replies, link a child via code. Never: other children, any payment status change, staff/admin data.

**Student** — self-scoped, minimal in V1. See own records; change nothing sensitive.

**Public Visitor** — unauthenticated. See: `website:read-published` for one school only. Change: nothing. Never: any draft, internal field, or operational data.

**Example permissions:** `students:read`, `students:update`, `books:create`, `payments:confirm` 🔒, `payments:submit-reference`, `website:draft`, `website:publish` 🔒, `users:manage` 🔒, `tenant:admin` 🔒.

Cross-cutting invariants: **IT never touches PII; parents/students never write payment status; teachers never write student records or leave their class scope; only Super Admin acts across tenants.**

---

## 4. Tenant Isolation

The most important design property. Rules:

1. **Every school-owned record carries `school_id`** (FK to schools). ✅ Present on all tenant tables.
2. **Tenant scope comes from the session, never the request.** The user's `school_id` is read from their server-side session; requests may not supply or override it. ✅ This is the single most important rule and is correctly applied.
3. **Every backend query enforces the tenant filter.** Reads filter by `school_id`; a cross-tenant read returns empty; a cross-tenant write returns "not found". ✅
4. **Public APIs expose only published content for the correct school**, resolved from the URL's school code, with a fixed field whitelist. ✅
5. **Teachers are limited to their assigned classes** (target state — tighten from current school-wide student visibility). ➕
6. **Parents are limited to their linked children**, verified before any child-scoped action. ✅
7. **No security decision is made in the frontend.** The UI hides what a user shouldn't see for usability, but the server independently enforces every rule — hiding a button is not access control.

**What developers should check on every tenant-scoped endpoint (defensive checklist):**
- Does the handler read `school_id` from the session, not the body/query?
- Does every DB call in the handler include the tenant filter?
- For an `:id` route, is ownership (same tenant, and for parents/teachers the correct link/class) verified before acting?
- Does the response contain only fields safe for this role?

**Testing strategy (defensive):** an automated suite that logs in as School A and confirms School B's resources return empty/not-found across all resource types and verbs, run in CI so a forgotten filter is caught before release. Extend the existing regression suite (which already covers isolation for books/students/classes) to every resource. ➕

For high assurance on children's data, consider **PostgreSQL Row-Level Security** as a second, database-enforced layer so a forgotten application filter still cannot leak across tenants. ➕

---

## 5. Authentication & Session Safety

- **Password storage:** bcrypt cost ≥ 12 ✅; never store or log plaintext. Add a breached-password check and a strength meter. ➕
- **Password reset:** single-use, time-limited (1h) token, stored only as a hash, same generic response whether or not the email exists. ✅
- **Email verification:** verify a parent's email before they can link a child, so an account can't be established on a mistyped or someone else's address. ➕
- **Login rate limiting:** throttle repeated attempts, enforced across serverless instances ✅; add per-account throttling alongside per-IP. ➕
- **Session expiry:** server-side session store ✅; add a rolling idle timeout for staff and a shorter lifetime for the owner tier. ➕
- **Secure cookies:** `httpOnly`, `secure` in production, `sameSite` ✅; regenerate the session on login ✅; move the session cookie to `sameSite=strict`. ➕
- **Admin account protection & optional MFA:** offer TOTP MFA and require it for owner/admin/finance given their access. Add account lockout after repeated failures with an audit entry. ➕ 🔒
- **Account recovery:** through the verified email reset flow only; never a security-question or self-service role restore.
- **Staff invitation flow:** admin invites by email with an assigned role; invite tokens are hashed and expiring; the invitee sets their own password on acceptance; parents self-register rather than being invited. ✅

---

## 6. API Protection

Defensive middleware pipeline, applied in order, deny-by-default:

`helmet` (security headers ✅) → body parsing → session → **authentication** (`requireAuth` ✅) → **authorisation** (`requireRole` ✅) → **tenant check** (reject any request whose payload `school_id` differs from the session's ➕) → **input validation** (Zod on body, query, params; reject unknown fields ✅ for bodies) → handler → **output filtering** (per-resource serializer that emits only role-safe fields ✅ for public/user data).

Additional defensive practices:
- **Safe error messages:** generic message to the client, detailed structured log server-side; never return stack traces or SQL. ✅
- **Rate limits:** on authentication, reset, linking, and public read endpoints. ✅ (auth/linking) ➕ (public reads)
- **Logging important actions:** see §10.
- **Preventing private-field exposure:** whitelist output fields by default so a newly added internal column can never leak by omission. The public website serializer already does this. ✅

---

## 7. Database Protection

- **Parameterised queries only** — via the typed ORM and `$n` placeholders; no string-built SQL. ✅
- **Least-privilege database user** — the application should connect with a role limited to `SELECT/INSERT/UPDATE/DELETE` on its tables, without schema-altering or superuser rights, so any single point of failure has a bounded effect. ➕
- **Tenant-aware design** — `school_id` on every tenant table ✅; RLS as an optional second layer. ➕
- **Audit tables** — record important actions (see §10). ✅ present; add write-once export for the highest-value events. ➕
- **Backups** — confirm point-in-time recovery is enabled and test a restore; document recovery objectives. ➕
- **Encryption at rest** — the managed database provides it; confirm and document. ➕
- **Safe deletion & retention** — define retention per data class and purge on schedule; ensure deleting a school cascades to its child records. ✅ (cascade) ➕ (retention automation)
- **Avoiding accidental cross-school exposure** — the tenant filter plus the isolation test suite are the practical guardrails; RLS is the belt-and-braces option.

---

## 8. Public Website Content Safety

- **Draft vs published** — content is a draft until explicitly published; the public API returns published content only. ✅
- **Approval workflow** — add an optional `pending_review` state so a school admin can approve what IT drafts before it goes live. ➕
- **Preventing private data becoming public** — the public serializer emits a fixed whitelist and never internal fields; add a test asserting drafts and internal columns never appear in the public response. ✅ / ➕
- **Safe image uploads** — validate by declared type and by actual file signature, cap size, strip metadata, and serve from an isolated (non-executable) origin. ➕
- **Safe rich-text content** — body text is currently rendered as escaped plain text (safe). If rich text is introduced later, sanitise it server-side against a strict allowlist of tags/attributes — never rely on client-side sanitisation. Restrict link and image URLs to safe schemes (`http`, `https`, `mailto`, `tel`) so stored links can't carry active content. ➕
- **Public API restrictions** — unauthenticated, published-only, per-school, rate-limited, fail-safe (returns empty rather than erroring). ✅ / ➕ (rate limit + cache)
- **Content publishing logs** — record every publish/unpublish with actor and timestamp. ✅
- **Caching** — if a CDN cache is added, key it strictly per school code so one school's content can never be served under another's URL. ➕

---

## 9. Payment Tracking Safety

- **Authorised staff only** confirm/reject/cancel payments; enforced server-side by role, not by hiding UI. ✅
- **Parents/students cannot change payment status** — parents may only submit a reference; the status transition is staff-only. ✅
- **Every status change is logged** with actor, timestamp, and the payment involved. ✅
- **Keep old and new values** in the audit entry for each change, so disputes are fully reconstructable — confirm the old value is captured on every transition. ➕
- **No card details** — the system records bank-transfer references, not card numbers, which keeps it out of card-industry compliance scope. If card payments are ever added, use a compliant hosted provider so card data never touches your servers. ✅ (design) 🔒 (rule to keep)
- **Clear payment references** — human-readable, unique per school, with duplicate detection. ✅

---

## 10. Logging & Monitoring

**Log (defensive, attributable):** login success and failure (with reason), permission-denied events, role changes, student-record changes, payment status changes (with old→new), website publish/unpublish, file uploads, invite create/accept, password reset request/complete, and school lifecycle actions. Each entry: actor ID, timestamp, target, and IP where relevant. ✅ (most present)

**Never log:** passwords or hashes, raw reset/invite tokens, full session tokens/cookies, card data, or unnecessary personal data in message bodies.

**Monitor (add):** alert on unusual patterns — sustained login failures, bursts of permission-denied events, payment confirmations at odd hours, owner-tier logins, and database-console activity. Ship logs to a retained store outside ephemeral serverless logs so they exist as a compliance record. ➕

---

## 11. UK GDPR & School Data Protection (privacy-by-design)

- **Data minimisation** — collect only what book distribution requires (name, class, parent email); avoid dates of birth, addresses, or health data unless a documented lawful basis exists. The current schema is appropriately minimal — keep it so.
- **Roles** — the **school is the data controller; BytHub is the processor.** Put a **Data Processing Agreement** in place with each school. ➕
- **Access control** — role + tenant scoping already embodies least privilege.
- **Data retention** — define per class (e.g. student records purged a set period after a pupil leaves; audit logs retained 1–2 years; payment records per financial-record law). Automate purges. ➕
- **Right to correction/deletion** — provide an admin workflow to export and erase a data subject's records on request, cascading and logged. ➕
- **Child/student data** — no profiling, no marketing use, data-protection-by-default; treat under the ICO Children's Code.
- **Breach response** — UK GDPR requires notifying the ICO within **72 hours** of a qualifying breach and informing affected school-controllers; keep a runbook (see §14). ➕
- **Audit trails** — present, and needed to demonstrate accountability.
- **Staff training & privacy notice** — brief school staff on handling pupil data; publish a clear privacy notice describing what's processed, why, the lawful basis, and retention. ➕
- **DPIA** — conduct a Data Protection Impact Assessment before scaling; effectively expected for large-scale children's-data processing. ➕

---

## 12. Safe Developer Requirements

1. The backend must resolve the acting user's role and `school_id` only from the server-side session.
2. The backend must verify the user's role before every protected action.
3. The backend must enforce school/tenant scope on every request involving school data; cross-tenant reads return empty and cross-tenant writes return not-found.
4. The backend must reject any request whose payload contains a `school_id` different from the session's.
5. Teachers must only access students assigned to their classes (and never other schools').
6. Parents must only access children linked to their account.
7. IT personnel must not read or write any operational or PII data (students, parents, books, classes, payments, users).
8. Payment confirmation, rejection, and cancellation must be restricted to authorised staff; parents may only submit a reference.
9. All payment status changes must be recorded in an audit log with user ID, timestamp, old value, and new value.
10. Public APIs must return only published content, scoped to the correct school, with a fixed field whitelist that excludes internal fields.
11. CMS link and image URLs must be restricted to safe schemes (`http`, `https`, `mailto`, `tel`).
12. Passwords must be stored with bcrypt cost ≥ 12; reset and invite tokens must be stored only as hashes.
13. Session cookies must be `httpOnly`, `secure` in production, and `sameSite`, and the session must be regenerated on login.
14. The application database user must be limited to data operations on application tables, without schema-altering or superuser privileges.
15. Authentication, password-reset, linking, and public content endpoints must be rate-limited across all server instances.
16. Uploaded files must be validated by declared type and file signature, size-limited, metadata-stripped, and served from a non-executable origin.
17. Privileged roles (owner, school admin, finance) must support MFA.
18. Security and audit logs must be retained outside ephemeral serverless logs.
19. The system must provide an authenticated workflow to export and erase a data subject's personal data, cascading and logged.
20. No security decision may be made solely in the frontend.

---

## 13. Risk Register (defensive)

| ID | Risk | Affected area | Likelihood | Impact | Severity | Safe mitigation |
|---|---|---|---|---|---|---|
| D1 | Unsafe URL scheme in published CMS content | Website module | M | H | **High** | Restrict link/image URLs to safe schemes |
| D2 | Application DB user has more than data privileges | Database | L | H | **High** | Least-privilege DB role (+ optional RLS) |
| D3 | Privileged staff account compromise (no MFA) | Auth / admin | M | H | **High** | MFA + lockout for owner/admin/finance |
| D4 | Tenant filter forgotten on a future query | API / DB | M | H | **High** | Automated tenant-isolation tests in CI |
| D5 | Missing DPA/DPIA for children's data | Compliance | H | M | **High** | DPA per school + DPIA before scale |
| D6 | No account lockout on repeated failures | Auth | M | M | **Medium** | Lockout with audit after N failures |
| D7 | Parent email unverified at registration | Auth / linking | M | M | **Medium** | Verify email before child linking |
| D8 | Public read endpoints unthrottled/uncached | Public API | M | M | **Medium** | Rate limit + per-school caching |
| D9 | State-changing routes lack anti-CSRF token | API | L | H | **Medium** | Anti-CSRF tokens or `sameSite=strict` |
| D10 | Upload type spoofing | File uploads | L | M | **Medium** | Signature validation + isolated origin |
| D11 | Audit logs mutable / not exported | Logging | L | M | **Medium** | Off-platform, write-once export |
| D12 | No monitoring/alerting pipeline | Monitoring | M | M | **Medium** | Ship logs + alert on key signals |
| D13 | Teacher can view all school students | RBAC | M | L | **Low** | Class-scoped visibility |
| D14 | Retention/erasure not automated | Privacy | M | M | **Medium** | Retention jobs + erasure workflow |

---

## 14. Prioritised Security Action Plan

### Must-have before launch
1. **D1** Restrict CMS link/image URLs to safe schemes. *Small, safe code change.*
2. **D2** Provision a least-privilege application database role.
3. **D3** MFA + lockout for owner/admin/finance; extra protection (short session, IP allowlist) for the owner/database-console tier.
4. **D4** Automated tenant-isolation and ownership tests in CI (extend the existing regression suite to every resource).
5. **D5** Data Processing Agreement per school + Data Protection Impact Assessment. *Compliance blocker for UK children's data.*
6. Confirm database encryption-at-rest and backups, and test a restore.

### Important after MVP
7. **D7** Parent email verification; **D6** account lockout.
8. **D9** Anti-CSRF tokens (or `sameSite=strict`) on state-changing routes.
9. **D8** Rate-limit and cache public website endpoints.
10. **D10** File-signature upload validation + isolated upload origin.
11. **D11/D12** Off-platform log retention with alerting on the §10 signals.
12. Confirm old→new value capture on every payment audit entry.
13. Optional website publish-approval workflow; public field-leak test.

### Long-term improvements
14. PostgreSQL Row-Level Security as database-enforced tenant isolation.
15. Write-once/exported audit store for payment, role, and publish events.
16. Retention automation + self-service export/erasure for GDPR requests (**D14**).
17. Class-scoped teacher visibility (**D13**); breached-password checks; strength metering.
18. Independent security assessment before onboarding a large multi-school cohort, repeated periodically.

---

**Summary.** ScholarShelf already embodies many secure-by-design fundamentals — session hardening, session-derived tenant scoping, layered RBAC, staff-only payment control, hashed tokens, bcrypt-12, security headers, and audit logging. The defensive priorities that remain are the ones that matter most for a children's-data platform at scale: **MFA on privileged accounts, a least-privilege database role, automated tenant-isolation tests to prevent regression, restricting CMS URLs to safe schemes, and completing the UK GDPR paperwork (DPA/DPIA).** Addressing the must-have list puts the platform on a sound, defensible footing to serve real schools.
