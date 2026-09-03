# ScholarShelf — Full Cybersecurity Review & Secure Design

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

**Prepared:** July 2026 · **Scope:** entire platform as deployed (Vercel + Neon) and as coded in this repository
**Method:** STRIDE threat modelling + OWASP Top 10 mapping + code-level verification
**Grounding:** unlike a generic review, every "IMPLEMENTED" claim below was verified against the actual code; every "GAP" is a real absence, not a hypothetical.

---

## 1. System Understanding

**Architecture (actual):** React 19 SPA + Express 5 API in one repo, deployed as a single Vercel serverless function; PostgreSQL on Neon via drizzle (neon-http) and pg Pool; session auth via express-session + connect-pg-simple; transactional email via Resend; payment tracking by bank-transfer reference with an HMAC-verified inbound webhook. One deployment serves all schools (single-deployment multi-tenant SaaS).

**Users:** platform owner/BytHub staff, school admins, IT personnel (website only), teachers, finance staff, parents, students (future), and unauthenticated public visitors.

**Primary assets:** child/student records (names, classes, codes), parent PII (names, emails, payment references), staff accounts, payment records and statuses, school inventory/financials, session store, audit logs, public website content, platform credentials (DB URL, session secret, Resend key, webhook secret).

**Trust boundaries:**
1. Internet → public API (`/api/public/*`, auth endpoints) — fully untrusted.
2. Authenticated session → role-gated API — semi-trusted, role- and tenant-scoped.
3. Tenant boundary — every school is a separate trust domain inside layer 2.
4. Platform-owner tier (incl. DB Console) → database — highest privilege, smallest audience.
5. App → third parties (Neon, Resend, payment webhook caller).

**Sensitive data inventory:** student names + class assignments + student codes; parent names/emails/usernames; bcrypt password hashes; payment references, amounts, statuses; linking codes (short-lived credentials — treat as secrets); invite/reset tokens (stored hashed); session records; audit logs (contain IPs and user agents); school contact data; branding uploads. **No card data is stored anywhere** — keep it that way (§11).

---

## 2. Threat Model (STRIDE by component)

Legend: **L**ikelihood / **I**mpact ratings Low·Med·High. "✅" = mitigation implemented and verified in code; "⚠" = partial; "❌" = gap.

**Login/authentication** — Spoofing (credential stuffing: L-High/I-High — ✅ PG-backed rate limit 10/15min/IP, bcrypt-12, generic errors, ❌ no lockout, no MFA, no CAPTCHA); session fixation (L-Low/I-High — ✅ `session.regenerate()` on login); enumeration (L-Med/I-Low — ✅ uniform errors + anti-enumeration on forgot-password). Demo accounts with published passwords exist in production (L-High/I-High — ❌ **critical, remove before real clients**).

**RBAC** — Elevation via role tampering (L-Med/I-High — ✅ role from server session only; `enforceRoleUpdateGuards` blocks self-role change, owner-role assignment, and admin-role changes from standard workflows); context-switch abuse (L-Low/I-High — ✅ contexts derived from real user data, owner context unreachable); IT personnel reaching operational data (L-Med/I-High — ✅ `it_personnel` excluded from `ADMIN_UI_ROLES` server-side; client lock is cosmetic only, server is authoritative).

**Tenant isolation** — Cross-school reads/writes (L-Med/I-Critical — ✅ `schoolId` derived exclusively from session, never request body; every school-scoped storage method filters; mutations verify ownership → safe 404); parent cross-scoping (✅ by verified email identity, basket-ownership guard on creation); schoolId=null "see-all" accounts (⚠ demo/owner accounts bypass filters by design — acceptable only for owner tier; **demo accounts must not carry null schoolId in production**).

**Public website renderer/API** — Stored XSS via CMS content (L-Med/I-High — ✅ React auto-escaping, no `dangerouslySetInnerHTML`; ⚠ `linkUrl`/`imageUrl` validated as URL but **`javascript:` scheme currently passes `z.string().url()`** → fix by enforcing `https?://` — patched alongside this review); private data leakage (✅ public endpoint whitelists 7 fields, published-only, fail-safe `[]`); tenant confusion on public routes (✅ lookup by school code, inactive/deleted schools 404).

**Admin dashboard** — CSRF on state changes (L-Low-Med/I-High — ⚠ `SameSite=Lax` cookies block cross-site POSTs in modern browsers; no explicit CSRF tokens — acceptable now, add tokens if you ever relax SameSite or add GET-mutations); DB Console (L-Low/I-Critical — ✅ owner-only + 22-table whitelist + DDL regex block + `dangerConfirm` for mutations + parameterised `pg.query`; residual risk inherent to the feature — see §16 for extra controls).

**Teacher dashboard** — Teacher acting on own child (✅ explicit self-child confirmation block); teacher accessing other classes (⚠ teachers see school-wide students, class assignment is informational — tighten if schools demand it, requirement SR-9).

**Parent/student linking** — Code brute force (L-Med/I-High — ✅ 10/15min distributed rate limit added; codes single-use, expiring, email-bound); code interception (⚠ codes sent by email in plaintext — inherent to the channel; expiry + email-binding mitigate).

**Payments** — Fake confirmation (L-Med/I-High — ✅ status transitions restricted to admin/finance roles; parents can only submit references; duplicate references rejected per school); webhook forgery (L-Low/I-High — ✅ HMAC-SHA256 verification, **fails closed** when secret missing); race/double-submit (✅ duplicate-basket guard added; reference dedupe).

**File uploads** — Malicious file as image (L-Med/I-Med — ✅ MIME whitelist + 5MB cap + memory storage, nothing written to disk; ⚠ **SVG allowed** for branding — SVG can carry scripts; serve with `Content-Type` intact but add `Content-Security-Policy: sandbox` on file responses or convert/strip, requirement SR-14); decompression/oversize (✅ size cap).

**Database** — SQLi (L-Low/I-Critical — ✅ 100% drizzle query-builder + parameterised pg; no string-concatenated SQL found); connection MitM (⚠ `rejectUnauthorized:false` fallback when `DATABASE_SSL_CA` unset — set the Neon CA cert in production, SR-16).

**API endpoints** — IDOR (L-Med/I-High — ✅ UUIDs + ownership checks on every mutation verified in the tenant audit; safe-404 pattern); mass assignment (⚠ most creates spread `...body` then override schoolId — Zod schemas constrain fields on auth routes; extend strict Zod to all POST/PATCH bodies, SR-11).

**Email** — Reset/invite token theft (✅ tokens stored bcrypt-hashed, 1h/7-day expiry, single-use); content injection (✅ templated HTML, no user-controlled HTML interpolation into emails beyond names — keep escaping names).

**Audit logs** — Tampering (⚠ logs are app-inserted rows; owner DB Console could edit them — restrict `audit_logs` from console mutation whitelist, SR-18); missing coverage (✅ broad: auth events, payments, lifecycle, website edits, role guards).

---

## 3. Vulnerability Analysis (OWASP-mapped, code-verified)

| Risk | Verdict on ScholarShelf |
|---|---|
| Broken access control | **Strong.** requireAuth/requireRole on every non-public route; 47-test regression suite passes; IT/finance/teacher/parent verified blocked from admin endpoints in production smoke tests. |
| Weak authentication | **Adequate, not finished.** bcrypt-12, length rules, rate limits. Gaps: no MFA, no lockout, no complexity scoring, demo creds live. |
| Session hijacking | **Good.** httpOnly + Secure(prod) + SameSite=Lax, server-side PG store, regeneration on login, destroy on logout/status change. Gap: 30-day maxAge is long for admin/finance — role-based lifetimes exist in code (`app.ts` stamps per-role maxAge) — verify finance/admin ≤ 8h. |
| SQL injection | **Not present.** ORM/parameterised everywhere incl. DB Console. |
| XSS | **Low risk.** React escaping; CMS is plain-text fields; fix `javascript:` URL scheme (patched); do not ever add rich-text/HTML fields without a sanitiser (DOMPurify server-side). |
| CSRF | **Mitigated by SameSite=Lax** + JSON-only bodies. Add CSRF tokens if cookie policy changes. |
| IDOR | **Mitigated** — ownership + tenant checks, safe 404s. |
| Multi-tenant leakage | **Primary engineered control of the codebase** — see §4. |
| Insecure uploads | **Mostly safe** (memory, whitelist, cap). SVG caveat above. |
| API abuse / rate limits | **Distributed PG-backed limiter** on all auth + linking-code endpoints. Gap: no global per-IP throttle on the rest of the API (add basic 429 middleware later). |
| Information disclosure | Generic errors, no stack traces to clients, `safeUser()` strips hashes, invite links suppressed in prod responses. Gap: `/api/health` exposes storageMode — harmless, keep minimal. |
| Password reset | Hashed single-use tokens, 1h expiry, anti-enumeration, rate limited. Solid. |
| Logging/monitoring | Logging good; **monitoring/alerting absent** (no alerts on failed-login bursts or permission-denied spikes) — §12. |
| Unsafe public publishing | Draft-first + publish toggle + whitelisted public fields + fail-safe empty. Solid for text content. |

---

## 4. Multi-Tenant Security

The rules that make isolation hold, all currently implemented, all non-negotiable for future code:

1. **Tenant ID from session only.** `sessionSchoolId(req)` is the sole source; any handler reading schoolId from body/query/params for scoping is a P1 bug.
2. **Storage-layer filtering.** Every school-scoped read takes `schoolId`; every mutation re-fetches the row WITH the tenant filter before writing (cross-tenant attempts → 404, indistinguishable from nonexistent).
3. **Create-injection.** Creates receive `schoolId` spread by the route from session, overriding anything client-sent.
4. **Public scoping by school code** with active-status check.
5. **Parents scoped by verified email identity**, not schoolId (they can span schools) — with explicit ownership checks (basket guard, linking-code email binding).
6. **Null-schoolId = platform tier only.** Enforce: no non-owner account may have null schoolId in production (SQL check in §13 tests).

**Testing strategy (extend `tests/security-regression.ts`):** seed two schools A/B; login as A-admin; for every list endpoint assert zero B rows; for every mutation endpoint attempt B-owned IDs and assert 404; assert B's public site never contains A content; repeat for teacher/finance/parent of A; add a CI job that greps route files for `req.body.schoolId|req.query.schoolId` and fails the build if found outside the owner namespace.

---

## 5. RBAC Design

Permission naming convention: `resource:action`. The current role→group model maps cleanly onto it:

| Role | Can | Cannot | Extra-protected actions |
|---|---|---|---|
| **Super Admin (owner/platform_admin)** | everything cross-tenant: `schools:*`, `db-console:use`, support-mode entry, `platform:reports` | be created/edited via standard user workflows (blocked in code) | school wipe (type-name + double confirm ✅), DB mutations (dangerConfirm ✅), support-mode entry (audited ✅). Add MFA (§6). |
| **School Admin** | `books:*`, `students:*`, `classes:*`, `levels:*`, `families:*`, `codes:*`, `payments:read/confirm/reject/collect`, `allocations:*`, `users:invite/read/suspend`, `reports:read`, `branding:*`, `website:*` (supervisory) | anything cross-tenant; role escalation (guards ✅); owner endpoints (403 ✅) | payment confirm/reject (audited ✅), user suspend, invite creation |
| **IT Personnel** | `website:read/create/update/delete/publish`, `branding:*` per permission flags | **all** operational data — books, students, parents, payments, classes, users, reports (excluded from ADMIN_UI_ROLES ✅) | `website:publish` (makes content public — audited ✅) |
| **Teacher** | `distribution:read/confirm/absent/out-of-stock/issue` for own school, `extra-requests:create/read-own`, `messages:*` with parents | payments, user management, catalogue writes, own-child confirmation (blocked ✅) | own-child distribution (server-enforced block ✅) |
| **Parent** | `children:link` (rate-limited codes), `baskets:read/create-own`, `payments:submit-reference/read-own`, `messages:*` | any other family's data, any payment status change, any staff endpoint | linking attempts (rate limited ✅), payment reference submission (dedupe ✅) |
| **Student** (future) | `own-books:read` | everything else | — |
| **Public visitor** | `public-site:read`, `parent:register`, `auth:login/reset` | everything else | registration + forgot-password (rate limited ✅) |

Rule for new endpoints: pick the *narrowest* existing group; never add roles to `ADMIN_UI_ROLES` to "make something work".

---

## 6. Authentication & Session Design

- **Passwords:** keep min 8/max 200 + bcrypt-12; add zxcvbn score ≥3 for staff/admin roles (client hint + server enforcement). No forced rotation (NIST); force reset on suspected compromise.
- **MFA:** add TOTP for owner, school_admin, finance (in that order). Owner accounts first — one compromised owner = every school breached. Parents: optional, later.
- **Sessions:** per-role maxAge — owner/admin/finance ≤ 8h, teacher 24h, parent 30d is acceptable. Keep httpOnly/Secure/SameSite=Lax, PG store, regenerate-on-login, destroy on status change (all present).
- **Reset flow (keep as is):** hashed single-use token, 1h, anti-enumeration, rate-limited, generic responses.
- **Lockout:** add per-ACCOUNT counter (distinct from per-IP): 10 failures → 15-min lock, audit `account_locked`, unlock via reset flow. Prevents targeted stuffing that rotates IPs.
- **Email verification:** parents self-register — currently unverified emails can register. Add verify-before-link (registration works, but linking codes require verified email) to stop parents mistyping/squatting other people's addresses.
- **Admin protection:** demo accounts OFF in production; owner accounts invite-only (✅); log + alert on new admin sessions from new IPs (§12).

## 7. API Security

Present: session