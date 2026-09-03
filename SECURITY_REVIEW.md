# ScholarShelf — Cybersecurity Review & Secure Design

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

**Prepared by:** Security architecture review
**Scope:** Full-stack review of the ScholarShelf multi-tenant school book-management platform
**Stack (actual):** React 19 SPA · Express 5 / TypeScript · PostgreSQL (Neon) via Drizzle ORM · session auth (connect-pg-simple) · Resend email · Vercel serverless
**Method:** Grounded in the real codebase, not a generic template. Findings marked **[VERIFIED PRESENT]** exist in code today; **[GAP]** is missing; **[FIX NEEDED]** is a concrete defect to remediate.

---

## 1. System Understanding

### Architecture
Single-deployment multi-tenant SaaS. One React SPA and one Express API serve every school ("tenant"). All `/api/*` traffic runs through a single Vercel serverless function; the SPA is served from the edge CDN. PostgreSQL on Neon is the single data store; sessions persist server-side in a Postgres-backed store. Every tenant-scoped row carries a `schoolId` FK, and the storage layer filters by it.

### Users (trust tiers, highest to lowest)
- **Platform owner / platform_admin (BytHub)** — cross-tenant, DB console, school lifecycle. Highest blast radius.
- **School admin** — full control of one school's operational data.
- **Finance** — payments and allocations within one school.
- **IT personnel** — one school's *public website* content + branding only. Deliberately walled off from operational data.
- **Teacher** — distribution and class-scoped views within one school.
- **Parent** — own linked children's baskets, payments, messages.
- **Student** — self-scoped (minimal in V1).
- **Public visitor** — unauthenticated; sees only published website content per school.

### Primary assets
Student PII (names, class, codes), parent PII (name, email), payment records & bank-transfer references, school records, book inventory, credentials (bcrypt hashes), session tokens, audit logs, public website content, and the platform owner tier itself (compromise = all tenants).

### Trust boundaries
1. Browser ↔ API (session cookie).
2. Authenticated tenant ↔ other tenants (the critical internal boundary — enforced only by correct `schoolId` scoping).
3. Public internet ↔ published-only content (the public website API).
4. App ↔ database (a Neon connection string with, currently, full privileges).
5. App ↔ Resend/Vercel (third-party trust).
6. Operational roles ↔ IT/website role (product-level separation).

### Sensitive data classification
| Class | Data | Handling requirement |
|---|---|---|
| Special-category-adjacent (children) | Student names, class, year, codes | UK GDPR child-data care; strict access control, minimisation |
| Personal | Parent/staff names, emails, IPs in audit logs | Lawful basis, retention limits |
| Financial | Payment references, amounts, status | No card data stored; audit every state change |
| Credential | Password hashes, reset/invite tokens | bcrypt (present), token hashing (present) |
| Public | Published website sections, branding | Must never leak drafts or internal fields |

---

## 2. Threat Model (STRIDE)

Likelihood/Impact are L/M/H. Only material threats listed.

### Authentication / login
- **Spoofing — credential stuffing / brute force.** L:M I:H. *Mitigated:* rate limiting on sign-in (10/15min), generic errors (no user enumeration), bcrypt 12. *Residual:* serverless rate limiter now Postgres-backed **[VERIFIED PRESENT]**; still no account lockout after N failures and no CAPTCHA **[GAP]**.
- **Spoofing — session fixation.** L:L I:H. *Mitigated:* `session.regenerate()` on login **[VERIFIED PRESENT]**.
- **Elevation — weak password reset.** L:M I:H. *Mitigated:* hashed single-use tokens, 1h expiry, anti-enumeration **[VERIFIED PRESENT]**.

### RBAC
- **Elevation — role escalation via body/param tampering.** L:M I:H. *Mitigated:* role resolved server-side from session; self-role-change blocked; owner-role assignment blocked from standard workflow **[VERIFIED PRESENT]**.
- **Elevation — IT reaching operational data.** L:L I:H. *Mitigated:* `it_personnel` excluded from `ADMIN_UI_ROLES`; client route allowlist **[VERIFIED PRESENT]**.

### Tenant isolation (the highest-value target)
- **Information disclosure — cross-tenant read.** L:M I:H. *Mitigated:* `schoolId` from session, storage-layer filtering, safe-404 on cross-tenant mutation **[VERIFIED PRESENT]**. *Residual:* correctness depends on every new query remembering the filter — needs automated tests as a guardrail **[GAP]**.
- **Tampering — cross-tenant write.** L:L I:H. *Mitigated:* ownership checks before mutation **[VERIFIED PRESENT]**.

### Public website renderer/API
- **Tampering — stored XSS via CMS content.** L:M I:H. **[FIX NEEDED]** `linkUrl` is validated with Zod `.url()`, which *accepts* `javascript:alert(1)`. Rendered into an `<a href>` on the public page → stored XSS executable by any visitor, authored by a compromised/malicious IT account. Must allowlist `http/https/mailto/tel` schemes. Body text is rendered as plain text (React auto-escapes) so that path is safe today.
- **Information disclosure — drafts/internal fields leaking.** L:L I:H. *Mitigated:* public endpoint returns `isPublished=true` only, whitelisted fields, fail-safe `[]` **[VERIFIED PRESENT]**.
- **DoS — unauthenticated public endpoint hammered.** L:M I:M. *Residual:* no caching / no rate limit on public reads **[GAP]**.

### Admin dashboard & DB console
- **Elevation — DB console SQL abuse.** L:L I:H. *Mitigated:* owner-only, table whitelist, DDL regex block, mutation confirmation, parameterised queries **[VERIFIED PRESENT]**. *Residual:* this is the single most dangerous feature; a stolen owner session = full platform read/write. Warrants MFA on owner accounts **[GAP]** and IP allowlisting.

### Teacher dashboard
- **Information disclosure — teacher sees non-class students.** L:M I:M. *Residual:* teachers currently see all students in their school, not only assigned classes (documented limitation). Acceptable within one tenant but tighten for least privilege **[GAP]**.
- **Tampering — teacher confirms own child's distribution.** L:L I:M. *Mitigated:* self-child confirmation blocked **[VERIFIED PRESENT]**.

### Parent/student linking
- **Spoofing — linking-code brute force to claim a child.** L:M I:H. *Mitigated:* codes are single-use, expiring, email-bound, and now rate-limited **[VERIFIED PRESENT]**.
- **IDOR — parent creating basket for unlinked student.** L:L I:H. *Mitigated:* basket creation verifies parent-child link **[VERIFIED PRESENT]**.

### Payment confirmation
- **Tampering — parent/student self-confirming payment.** L:M I:H. *Mitigated:* confirm/reject gated to admin/finance; parents can only submit a reference **[VERIFIED PRESENT]**.
- **Spoofing — forged webhook confirmation.** L:L I:H. *Mitigated:* HMAC signature, fails closed when secret unset **[VERIFIED PRESENT]**.
- **Repudiation — disputed payment change.** L:M I:M. *Mitigated:* audit log on state changes **[VERIFIED PRESENT]**; ensure old→new value captured **[PARTIAL]**.

### File uploads
- **Tampering — malicious upload.** L:M I:M. *Mitigated:* multer memory storage, MIME whitelist, size cap **[VERIFIED PRESENT]**. *Residual:* MIME can be spoofed; add magic-byte sniffing and never serve uploads from an executable path **[GAP]**.

### Database
- **Elevation — over-privileged DB user.** L:L I:H. **[GAP]** app connects with what is effectively an owner-level Neon role. A SQLi or app compromise inherits DROP/ALTER. Use a least-privilege application role.

### API endpoints
- **Various — missing auth/validation on a route.** L:M I:H. *Mitigated:* consistent `requireAuth`/`requireRole`, Zod validation, JSON 404 catch-all **[VERIFIED PRESENT]**. *Residual:* per-route coverage is convention, not enforced — needs test coverage **[GAP]**.

### Email
- **Spoofing/phishing via injected links.** L:L I:M. *Mitigated:* links built from server config, tokens hashed **[VERIFIED PRESENT]**. Ensure user-supplied text can't inject into email HTML **[VERIFY]**.

### Audit logs
- **Repudiation / tampering.** L:L I:M. *Mitigated:* server-written, includes user/IP/timestamp **[VERIFIED PRESENT]**. *Residual:* logs are mutable rows in the same DB; consider append-only/export for high-value events **[GAP]**.

---

## 3. Vulnerability Analysis (OWASP-aligned)

- **Broken access control** — Primary risk class here. Largely well-handled (session-derived role + tenant, ownership checks). Weak spots: teacher over-broad student visibility; reliance on convention for new routes. **Action:** permission unit tests + tenant-isolation tests.
- **Weak authentication** — bcrypt 12, generic errors, reset hardening all present. Missing: MFA, account lockout, password-complexity beyond length-8. **Action:** MFA for owner/admin/finance; lockout after 5 fails.
- **Session hijacking** — httpOnly + secure(prod) + sameSite=lax + server-side store + regeneration on login **[VERIFIED PRESENT]**. Consider `sameSite=strict` for the session cookie and idle-timeout.
- **SQL injection** — Drizzle parameterises; DB console uses `$1` params. Low risk. Keep the "no string-concatenated SQL" rule enforced in review.
- **XSS** — React escapes by default; no `dangerouslySetInnerHTML` in app code (only in the vendored chart UI component). **One real hole:** CMS `linkUrl` scheme (see §2). CSP is present but weakened by `'unsafe-inline'` + `'unsafe-eval'` in production **[FIX NEEDED]**.
- **CSRF** — session cookie is `sameSite=lax`, which blocks cross-site POST for the common cases; there is no separate CSRF token. Lax is acceptable for a cookie-auth SPA but add anti-CSRF tokens (or `sameSite=strict`) for state-changing admin/payment actions as defence-in-depth **[GAP]**.
- **IDOR** — mutations do ownership/tenant checks; safe-404 pattern used. Keep applying to every new `:id` route.
- **Multi-tenant leakage** — see §4. Architecturally sound, test-coverage gap.
- **Insecure file upload** — MIME allowlist + size cap present; add content sniffing.
- **API abuse / rate-limit failure** — auth + linking endpoints rate-limited and now distributed. Public website/read endpoints unlimited **[GAP]**.
- **Information disclosure** — health endpoint clean, generic errors, `safeUser()` strips hashes **[VERIFIED PRESENT]**.
- **Weak password reset** — hardened **[VERIFIED PRESENT]**.
- **Missing logging/monitoring** — audit logging present; no alerting/monitoring pipeline **[GAP]**.
- **Unsafe public publishing** — draft/publish split present; scheme-sanitisation gap noted.

---

## 4. Multi-Tenant Security

The isolation model is sound and already implemented; the risk is *regression*, not *design*.

- **Tenant ID enforcement:** `schoolId` is read from `req.session`, never from request input. This is the single most important rule and it is correctly applied. Any endpoint that takes `schoolId` from the body/query is a critical bug.
- **Query filtering:** storage methods accept and apply `schoolId`; owner/platform accounts pass `null` to see all (by design). Junction tables scope through their parent.
- **Role checks:** layered with tenant checks — role says *what*, tenant says *whose*.
- **Public API scoping:** resolves tenant from the URL `:code`, returns published+whitelisted only.
- **Prevention:** cross-tenant read → empty/filtered; cross-tenant write → safe 404.
- **Testing strategy [GAP — build this]:** an automated suite that, for every tenant-scoped resource, logs in as School A and asserts 403/404/empty for every School B resource ID, across GET/POST/PATCH/DELETE. Run in CI. This converts "we remembered the filter" from hope into a gate. Extend the existing `tests/security-regression.ts` (already covers basic tenant isolation for books/students/classes) to every resource including website sections, families, allocations, messages.

---

## 5. RBAC Design

Permission-name convention: `resource:action`. Recommended matrix (✓ allowed, ✗ denied, 🔒 extra-protected):

| Permission | Super Admin | School Admin | IT | Teacher | Parent | Student | Public |
|---|---|---|---|---|---|---|---|
| `platform:manage` (schools, DB console) | 🔒 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `books:read` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `books:create/update/delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `students:read` | ✓ | ✓ | ✗ | ✓ (class-scoped) | own children | self | ✗ |
| `students:write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `payments:read` | ✓ | ✓ | ✗ | ✗ | own | ✗ | ✗ |
| `payments:submit-reference` | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `payments:confirm/reject` | ✓ | ✓ (+finance) | ✗ | ✗ | ✗ | ✗ | ✗ 🔒 |
| `allocations:confirm-distribution` | ✓ | ✓ | ✗ | ✓ (not own child) | ✗ | ✗ | ✗ |
| `users:invite` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ 🔒 |
| `users:change-role` | 🔒 | 🔒 (limited) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `website:read-draft` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `website:write` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `website:publish` | ✓ | ✓ | ✓ 🔒 | ✗ | ✗ | ✗ | ✗ |
| `branding:manage` | ✓ | ✓ | ✓ (flagged) | ✗ | ✗ | ✗ | ✗ |
| `website:read-published` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Extra-protected (🔒) actions** — require confirmation + audit, and should require MFA once implemented: platform management, DB console, payment confirmation, role changes, school lifecycle (suspend/delete), and `website:publish` (public-facing). Everything super admin does is cross-tenant and therefore 🔒 by default.

Each role's cannot-list is the complement above; the key invariants: **IT never touches operational/PII data; parents/students never write payment status; teachers never write student records or cross their class scope.**

---

## 6. Authentication & Session Design

- **Password policy:** min 8 (present); add complexity via a strength check (zxcvbn) and block breached passwords (HaveIBeenPwned range API). Max 200 (present).
- **MFA [priority GAP]:** TOTP for super admin, school admin, finance. Owner accounts should *require* it before launch given DB-console blast radius.
- **Session expiry:** 30-day max-age present; add a rolling idle timeout (e.g. 8h inactivity) for staff roles, shorter for owner.
- **Secure cookies:** httpOnly + secure(prod) + sameSite present; move session cookie to `sameSite=strict`.
- **Reset flow:** hashed single-use 1h tokens + anti-enumeration present. Keep.
- **Login rate limiting:** present + distributed. Add per-account (not just per-IP) throttling.
- **Account lockout [GAP]:** lock after 5 consecutive failures for 15 min, with audit + optional email alert.
- **Email verification [GAP]:** parents self-register with no email confirmation; add a verify-email step before a parent can link a child (prevents typo/hijack of another person's email as identity).
- **Admin protection:** MFA + IP allowlist for owner tier + shorter sessions + mandatory audit review.

---

## 7. API Security

- **Auth middleware:** `requireAuth` present on all non-public routes.
- **Authorization middleware:** `requireRole(...roles)` present; keep it first-line on every route.
- **Tenant validation:** `sessionSchoolId` present; formalise as middleware that *rejects* any request whose body/query contains a `schoolId` that differs from session (defence against future mistakes).
- **Input validation:** Zod on bodies present; extend to query/params.
- **Output filtering:** `safeUser()` + field whitelisting on public API present; apply a serializer per resource so internal fields never leak by default.
- **Rate limiting:** present on auth/linking; add to public website reads and expensive report endpoints.
- **Error handling:** generic client messages, server-side stack logging present. Keep — never return stack traces.
- **CORS:** app is same-origin (SPA served by same deployment); no permissive CORS configured, which is correct. If a mobile/native client is added, add an explicit origin allowlist — never `*` with credentials.
- **API versioning [GAP]:** introduce `/api/v1/…` before external consumers exist, so breaking changes don't break tenants.
- **Audit logging:** present on sensitive mutations.

---

## 8. Database Security

- **Least-privilege user [priority GAP]:** create a Neon role for the app limited to `SELECT/INSERT/UPDATE/DELETE` on application tables — no `DROP/ALTER/CREATE`, no superuser. The DB console's DDL block is app-layer only; enforce it at the DB layer too.
- **Parameterised queries:** present (Drizzle + `$n`). Enforce in review.
- **Tenant-aware schema:** `schoolId` on every tenant table (present). Consider Postgres Row-Level Security as a second, DB-enforced layer so a forgotten filter can't leak — high-assurance option for a child-data platform.
- **Encryption at rest:** Neon encrypts at rest by default — confirm and document. Application-layer field encryption is unnecessary for current data classes but revisit if adding sensitive fields.
- **Backups:** confirm Neon PITR is enabled; test a restore; document RPO/RTO.
- **Audit tables:** present (`audit_logs`, `message_audit_logs`); consider write-once export for payment/role/publish events.
- **Retention/deletion:** define per data class (see §9); implement scheduled purges; ensure school deletion cascades (present via FK).
- **Cross-tenant query protection:** RLS as above; the isolation test suite as the practical guardrail.

---

## 9. Data Protection & Privacy (UK GDPR)

Because ScholarShelf processes **children's** and parents' personal data, treat this as high-sensitivity under the UK GDPR and the ICO Children's Code.

- **Data minimisation:** collect only what distribution needs (name, class, parent email). Avoid DOB, addresses, or health data unless a lawful basis is documented. Current schema is appropriately minimal — keep it that way.
- **Lawful basis:** the school is the *data controller*, BytHub the *data processor*. You need a **Data Processing Agreement** with each school. Lawful basis for processing is typically the school's public task / legitimate interest — document it; it is the school's responsibility to establish, yours to honour.
- **Child data protection:** strict access control (present), no profiling, no marketing use of student data, data-protection-by-default.
- **Access control:** already role + tenant scoped.
- **Retention:** define (e.g. purge inactive student records X years after leaving; audit logs 1–2 years; payment records per financial-record law ~6 years). Implement automated retention.
- **Right to deletion/correction:** provide an admin workflow to export and erase a data subject's records on request; ensure erasure cascades and is logged.
- **Breach response:** UK GDPR requires notifying the ICO within **72 hours** of a qualifying breach. Have a runbook (see §12) and know each school-controller must be informed.
- **Audit trails:** present; needed to demonstrate accountability.
- **Privacy-by-design:** the tenant-isolation and minimisation posture already embodies this; formalise with a DPIA (Data Protection Impact Assessment) — effectively mandatory for large-scale children's data processing.

---

## 10. Secure Public Website Module

- **Public content editing risk:** a malicious/compromised IT account can publish to a public URL. Mitigate with the scheme allowlist fix, an audit trail (present), and — recommended — a *publish approval* step where school_admin approves what IT drafts for high-visibility changes.
- **XSS in CMS content [FIX NEEDED]:** enforce URL scheme allowlist on `linkUrl`/`imageUrl` (`http/https`, plus `mailto/tel` for links). Body renders as escaped text today; if you ever add rich text, sanitise server-side with a strict allowlist (e.g. `sanitize-html`) — never trust client sanitisation.
- **Image/file upload risk:** allowlist MIME + magic bytes + size; store on a separate origin/bucket; never execute; strip EXIF.
- **Draft vs published:** present and correct — public API returns published only.
- **Approval workflow:** add `pending_review` state between draft and published for schools that want editorial control.
- **Private data leakage:** the public serializer must whitelist fields (present). Add a test asserting the public endpoint never returns `updatedBy`, `schoolId`, drafts, or any operational field.
- **Public API hardening:** add caching (`Cache-Control: public, max-age=60`) + rate limit; keep fail-safe empty response.
- **Caching risk:** ensure per-school cache keys (by `:code`) so one school's content can never be served under another's URL — critical if you add a CDN cache.

---

## 11. Payment Security

- **Fake confirmations:** confirm/reject is admin/finance-only; parents submit references only **[VERIFIED PRESENT]**. Keep this invariant sacrosanct.
- **Admin-only confirmation:** enforced by `requireRole`.
- **Audit logs:** present on state changes; **ensure every change records `{userId, timestamp, oldStatus, newStatus, paymentId}`** — verify old-value capture is complete **[PARTIAL → close it]**.
- **Parent references:** free-text reference is fine; duplicate-reference detection present.
- **Preventing parent/student status change:** enforced server-side (role gate), not just hidden in UI **[VERIFIED PRESENT]**.
- **No card data:** the system stores bank-transfer *references*, not card numbers — correct and keeps you out of PCI-DSS scope. If you ever take cards, use Stripe/hosted fields so card data never touches your servers; never store PAN/CVV. Keep this rule explicit in code review.
- **Webhook:** HMAC-verified, fails closed **[VERIFIED PRESENT]**.

---

## 12. Logging, Monitoring, Incident Response

**Log (present, extend):** auth success/failure (with reason), permission-denied (403), payment status changes (with old→new), user create/delete/role-change, invite create/accept, password reset request/complete, website publish/unpublish, school lifecycle actions, rate-limit trips, DB-console queries.

**Never log:** passwords, password hashes, raw reset/invite tokens, full session cookies, card data, or full request bodies containing PII.

**Monitor [GAP — build]:** alert on spikes in login failures, bursts of 403s (probing), any cross-tenant 404 pattern, payment-confirmation outside business hours, owner-account logins, and DB-console mutations. Ship logs off Vercel to a retained store (the ephemeral function logs are not a compliance record).

**Incident response runbook:** (1) detect & triage severity; (2) contain — revoke sessions, rotate secrets, disable affected accounts; (3) assess scope from audit logs; (4) if personal data breached, notify ICO within 72h and inform affected school-controllers; (5) eradicate & recover from known-good backup; (6) post-incident review. Keep secrets rotation (SESSION_SECRET, DB URL, webhook secret, Resend key) as a one-command drill.

---

## 13. Security Testing Plan

- **Automated (CI, build these):** extend `tests/security-regression.ts` (already 47 tests: auth enforcement, RBAC, tenant isolation, session integrity, no-leak) to cover *every* resource for tenant isolation, plus IDOR probes on every `:id` route, plus the public-website field-leak assertion, plus the `javascript:` link rejection.
- **Unit tests for permissions:** table-driven test asserting each role × endpoint → allow/deny per §5 matrix.
- **Tenant isolation tests:** School A session vs every School B resource ID → 403/404/empty, all verbs.
- **API tests:** schema-validation rejection, oversized payloads, missing-auth, wrong-role.
- **Auth tests:** brute-force triggers limit; reset token single-use & expiry; session invalidated on logout; regeneration on login.
- **File upload tests:** wrong MIME, spoofed magic bytes, oversize, double-extension, SVG-with-script.
- **DAST:** run OWASP ZAP baseline against a staging tenant; Burp Suite for authenticated crawling as each role — focus on access-control and IDOR (ZAP won't find those; manual/authenticated testing will).
- **Pen-test checklist:** auth bypass, privilege escalation, cross-tenant access, IDOR, stored XSS via CMS, CSRF on state-changing routes, rate-limit bypass, webhook forgery, DB-console abuse with a non-owner session, session fixation, password-reset abuse.
- **Cadence:** automated suite every CI run; manual access-control review each release; external pen-test before onboarding the first paying multi-school cohort.

---

## 14. Security Requirements (developer-ready)

1. The system must resolve the acting user's role and `schoolId` **only** from the server-side session, never from request body, query, or headers.
2. The system must reject any request whose payload contains a `schoolId` differing from the session's `schoolId`.
3. The system must enforce a `schoolId` filter on every database read and write touching tenant data; cross-tenant reads return empty, cross-tenant writes return 404.
4. The system must prevent teachers from writing student records and from accessing students outside their school (and, target state, outside their assigned classes).
5. The system must allow only `admin`, `school_admin`, and `finance` roles to confirm, reject, or cancel a payment; parents may only submit a reference.
6. The system must log every payment status change with `{userId, timestamp, oldStatus, newStatus, paymentId}`.
7. The system must log every user role change, invite, website publish, and school lifecycle action with actor, target, and timestamp.
8. The system must prevent `it_personnel` from reading or writing any operational or PII resource (books, students, classes, payments, users).
9. The public website API must return only `isPublished = true` sections, scoped to the requested school code, with a fixed field whitelist that excludes internal fields.
10. The system must reject CMS `linkUrl`/`imageUrl` values whose scheme is not `http`, `https`, `mailto`, or `tel`.
11. The system must rate-limit authentication, password-reset, linking-code, and public website endpoints, enforced across serverless instances.
12. The system must hash passwords with bcrypt cost ≥ 12 and store reset/invite tokens only as hashes.
13. The system must set session cookies `httpOnly`, `secure` (production), and `sameSite` ≥ `lax`, and regenerate the session on login.
14. The system must never store card PAN/CVV; card payments, if added, must use a PCI-compliant hosted provider.
15. The system must run with a database role limited to DML on application tables (no DDL, no superuser).
16. The system must require MFA for super admin, school admin, and finance roles.
17. The system must lock an account after 5 consecutive failed logins for a defined period, with an audit entry.
18. File uploads must be validated by MIME allowlist *and* magic-byte inspection, size-capped, and served from a non-executable origin.
19. The system must provide an authenticated workflow to export and erase a data subject's personal data on request, cascading and logged.
20. The system must ship audit/security logs to a retained store outside ephemeral serverless logs.

---

## 15. Risk Register

| ID | Threat | Component | Likelihood | Impact | Severity | Mitigation |
|---|---|---|---|---|---|---|
| R1 | Stored XSS via `javascript:` link | Website CMS / public renderer | M | H | **High** | Scheme allowlist on link/image URLs (§10) — *fixable now* |
| R2 | Over-privileged DB user amplifies any compromise | Database | L | H | **High** | Least-privilege Neon role; optional RLS (§8) |
| R3 | Owner session theft → full-platform DB console | Admin/DB console | L | H | **High** | MFA + IP allowlist + short session for owner (§6) |
| R4 | Tenant-isolation regression on a new query | API/DB | M | H | **High** | Automated per-resource isolation tests in CI (§4) |
| R5 | No account lockout → sustained brute force | Auth | M | M | **Medium** | Lockout after 5 fails (§6) |
| R6 | No MFA on privileged roles | Auth | M | H | **High** | TOTP for owner/admin/finance (§6) |
| R7 | Public read endpoints unthrottled | Public API | M | M | **Medium** | Rate limit + cache (§10) |
| R8 | CSRF on state-changing admin/payment routes | API | L | H | **Medium** | Anti-CSRF tokens or `sameSite=strict` (§3) |
| R9 | CSP weakened by `unsafe-inline`/`unsafe-eval` in prod | Frontend | M | M | **Medium** | Tighten prod CSP; drop `unsafe-eval` (§3) |
| R10 | Upload MIME spoofing | File uploads | L | M | **Medium** | Magic-byte sniffing, isolated origin (§10) |
| R11 | Parent email unverified → identity/typo hijack | Auth/linking | M | M | **Medium** | Email verification before linking (§6) |
| R12 | Audit logs mutable in same DB | Logging | L | M | **Medium** | Append-only export for high-value events (§8/§12) |
| R13 | No off-platform monitoring/alerting | Monitoring | M | M | **Medium** | Ship logs + alerts (§12) |
| R14 | Missing DPA/DPIA for children's data | Compliance | H | M | **High** | DPA per school + DPIA before scale (§9) |
| R15 | Teacher sees all school students | RBAC | M | L | **Low** | Class-scoped student visibility (§5) |

---

## 16. Secure Implementation Recommendations (React / Express / PostgreSQL / sessions)

- **Middleware order:** `helmet` → body parser → session → `requireAuth` → `requireRole` → `requireTenant` (new: rejects mismatched `schoolId`) → handler. Fail fast, deny by default.
- **Secure sessions:** keep server-side Postgres store; `sameSite=strict` for session; rolling idle timeout; regenerate on login (present); destroy on logout (present).
- **RBAC checks:** centralise the permission matrix (§5) in one module; never scatter role strings across handlers; test it as data.
- **Tenant scoping:** one helper that both filters queries and asserts no inbound `schoolId` overrides session; consider Postgres RLS keyed on a `SET app.current_school` per request for defence-in-depth.
- **Validation:** Zod at the edge for body/query/params; reject unknown fields (`.strict()`); coerce numerics safely.
- **Error handling:** central error middleware; generic client message + server-side structured log; never leak stack/SQL.
- **File uploads:** multer memory → magic-byte check → re-encode images → store on separate bucket/origin → return URL; strip EXIF.
- **Database queries:** Drizzle typed queries only; no string interpolation; least-privilege role; parameterise the DB console (present).
- **Environment variables:** Zod-validated at startup (present); secrets only in Vercel env (never in repo); rotate on a schedule; the `RESEND_FROM_EMAIL` plain-address rule stays enforced.
- **Deployment security:** enable Vercel deployment protection on preview URLs; restrict who can change env vars; require review on `main`; keep one project per environment (you just consolidated the duplicate — good); monitor the runtime logs.

---

## 17. Prioritised Action Plan

### Critical — before onboarding real schools
1. **R1** Fix CMS URL scheme allowlist (stored XSS). *Small code change.*
2. **R2** Provision a least-privilege database role for the app.
3. **R6/R3** MFA for owner/admin/finance; IP allowlist + short session for the owner/DB-console tier.
4. **R4** Automated tenant-isolation + IDOR test suite in CI (extend the existing 47-test suite).
5. **R14** Sign a DPA with each school; run a DPIA. *Legal blocker for UK children's data at scale.*
6. Confirm Neon encryption-at-rest + backups/PITR and test a restore.

### Important — shortly after MVP
7. **R5** Account lockout; **R11** parent email verification.
8. **R8** Anti-CSRF tokens (or `sameSite=strict`) on state-changing routes.
9. **R9** Tighten production CSP (drop `unsafe-eval`; work toward removing `unsafe-inline`).
10. **R7** Rate-limit + cache public website endpoints.
11. **R10** Magic-byte upload validation; isolated upload origin.
12. **R13** Ship logs off-platform with alerting on the §12 signals.
13. Complete payment old→new audit capture (**R** payment repudiation).
14. Website publish-approval workflow; public field-leak test.

### Long-term hardening
15. Postgres Row-Level Security as DB-enforced tenant isolation.
16. Append-only/exported audit store for payment, role, and publish events.
17. Retention automation + self-service data export/erasure for GDPR requests.
18. External penetration test before multi-school scale; recurring annually.
19. API versioning (`/api/v1`) ahead of any external/mobile client.
20. Class-scoped teacher visibility; password breach-list checks; zxcvbn strength.

---

**Bottom line:** ScholarShelf's security foundation is genuinely above-average for its stage — session hardening, tenant isolation, RBAC, payment role-gating, webhook verification, hashed tokens, and audit logging are already real and correct in code. The gaps are the ones that matter most for a **children's-data platform at scale**: MFA on privileged accounts, a least-privilege DB role, automated tenant-isolation tests to prevent regression, one concrete stored-XSS fix in the new CMS, and the UK GDPR paperwork (DPA/DPIA). Close the six Critical items and you are in a defensible position to onboard real schools.
