# ScholarShelf — Full Technical Audit

*Prepared for the ScholarShelf (internal name "EduBook") multi-tenant SaaS. Production: https://www.scholarshelf.co.uk*

---

## 1. Executive summary

ScholarShelf is a multi-tenant SaaS that lets schools run their reading-scheme book programme end to end: cataloguing books into bundles, enrolling families and students, collecting reference-based payments from parents, distributing books through teachers, and managing each school's public website. It is a genuinely substantial application — **32 database tables, ~209 API endpoints, 8 user roles, and ~36 distinct frontend screens** — and it is deployed and live on Vercel with a Neon Postgres backend.

Overall the system is **well past MVP and structurally sound**: it has real multi-tenant isolation, session auth with optional TOTP MFA, a Postgres-backed rate limiter built for serverless, per-school branding that flows into emails, a headless CMS for school websites, scheduled digests, and a recently hardened family-first enrollment workflow with atomic transactions and integration tests.

The main risks are not crashes or security holes — they are **model-coexistence debt**: a newer "family-first" data model runs alongside an older student/parent model, and the two must be reconciled before the older paths are retired. There is also meaningful **frontend bundle bloat** and **thin automated test coverage outside the family workflow**. None of these block production use; they are the difference between "working" and "airtight."

**Overall grade: B+ / production-ready with known, tracked debt.**

---

## 2. Architecture & technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 (SPA), Wouter (routing), TanStack Query v5, shadcn/ui + Radix, Tailwind v4 |
| Backend | Express 5 (single serverless function on Vercel) |
| ORM / DB | Drizzle ORM → PostgreSQL (Neon serverless). Neon **HTTP** driver for normal reads/writes; **pg Pool** (node-postgres) for interactive transactions and the session store |
| Auth | Session cookies (`connect-pg-simple` store), bcrypt password hashing, optional TOTP MFA |
| Email | Resend (with per-school branded templates) |
| Scheduling | Vercel Cron → secured internal endpoint |
| Hosting | Vercel (serverless), static client to `dist/public`, API rewrites `/api/* → /api/index` |

The server is organised by **domain route modules** (`server/routes/*.ts`) registered through a single `registerRoutes` composition root, with a shared middleware/auth module providing tenant resolution, RBAC guards, rate limiting, audit logging, and branding helpers. This is a clean, maintainable structure — the monolith was already refactored out of a single `routes.ts` into 20 focused files.

**Notable architectural strength:** `schoolId` is always derived from the authenticated session (never trusted from the request body), which is the correct foundation for multi-tenant isolation. Platform owners cross schools only via an explicit "support mode" that sets the session school — so the same guard covers them.

---

## 3. Data model (32 tables)

Grouped by domain:

**Tenancy & identity** — `schools`, `users`, `invites`, `audit_logs`, `rate_limits`, `notification_preferences`

**Family-first core** — `families`, `guardians`, `family_students`, `students`, `child_linking_codes`, `parent_children`

**Catalogue & bundles** — `books`, `book_levels`, `book_level_items`, `class_book_levels`, `student_book_levels`, `book_inventory_transactions`

**Ordering & payment** — `child_book_baskets`, `basket_items`, `book_payments`, `basket_payments`, `finance_book_allocations`, `extra_copy_requests`

**Classes & messaging** — `classes`, `message_threads` (+ messages/audit)

**Website & media (CMS)** — `school_website_sections`, `media_assets`

**Auth hardening (recent)** — MFA columns on `users` (`mfaEnabled`, `mfaSecret`, `mfaRecoveryCodes`, `mfaEnrolledAt`)

**Observations:**
- The **family↔student relationship is dual-tracked**: `students.family_id` (a real FK with `ON DELETE SET NULL`) *and* the `family_students` join table. New writes populate both; a self-healing backfill reconciles legacy rows. This is deliberate for backward compatibility but is the largest piece of model debt (§12).
- **Guardians** are a first-class table now, but "parent" portal accounts remain `users` linked through `child_linking_codes`. The new guardian-invite flow bridges them (a guardian with an email can be invited → gets a family link code). Full reconciliation (guardian ↔ parent-user identity) is still partial.
- Payments are **reference-based bank transfer**, not card — the model reflects this correctly (`book_payments.status`: awaiting_reference → reference_submitted → confirmed/rejected → ready_for_collection → collected). No PCI surface.
- Photos and branding assets are stored as **base64 data URIs** in the DB rather than object storage — simple and self-contained, but a row-size and payload consideration at scale (§12).

---

## 4. API surface (~209 endpoints, 20 modules)

| Module | Endpoints | Responsibility |
|---|---|---|
| `book.routes` | 26 | Books, bundles, class assignments, student CRUD, ISBN lookup, barcode scan, stock |
| `setup.routes` | 22 | School onboarding checklist & operational setup |
| `owner.routes` | 21 | Platform-owner: schools, invites, support mode, email status, **system health** |
| `user.routes` | 17 | User management, roles, invites |
| `allocation.routes` | 16 | Book distribution, teacher receipt confirmation, extra-copy requests |
| `auth.routes` | 13 | Sign-in/out, sign-up, password reset, MFA login gate |
| `family-enrollment.routes` | 12 | **Family-first**: search, CRUD, guardians, students-under-family, enroll, draft, guardian invite, student profile |
| `message.routes` | 11 | Parent–teacher messaging + admin oversight |
| `parent.routes` | 9 | Parent portal: link child, baskets, payments, messages |
| `student.routes` | 9 | Linking codes, CSV import, book-level overrides |
| `website.routes` | 9 | School website CMS sections + media library |
| `family.routes` | 8 | **Legacy** family endpoints (`/api/admin/families/*`) — coexists with the new module |
| `payment.routes` | 8 | Payment confirm/reject/collection lifecycle |
| `mfa.routes` | 6 | TOTP setup/enable/verify/disable/recovery |
| `notification.routes` | 6 | In-app notifications + email preferences |
| `db-console.routes` | 6 | Owner-only DB browser / query runner |
| `dashboard.routes` | 5 | Role dashboards & reports aggregation |
| `cron.routes` | 2 | Scheduled digests + reminders (secret-gated) |
| `public.routes` | 2 | Public school landing + branding |

Every non-public endpoint is guarded by `requireAuth` / `requireRole(...)` and scoped to the session school.

---

## 5. Frontend (roles & screens)

**Top-level pages (12):** login (with MFA challenge), register, accept-invite, forgot/reset-password, security (2FA + email prefs), school-public, plus the four role shells (admin, teacher, parent, finance) and not-found.

**Admin sections (24):** dashboard, students, student-profile, families, family-enrollment, parents, linking-codes, classes, books, book-levels (Bundles), allocations, payments, communications, reports, users, branding, setup, website, media-library, it-dashboard, system-health, db-console, owner, shared.

The admin area was fully redesigned to the **Stitch design system** (light surface, navy primary, Inter + JetBrains Mono, `rounded-2xl` cards, mono uppercase table headers, master-detail layouts). Teacher, finance, and parent areas share the same visual language. Navigation is grouped (Overview / School Data / Books & Stock / Orders / Communication / Insights / Admin) and consolidated around a **family-first** information architecture: *Families* (household management) + *New Enrollment* + *Students* (directory), with the old standalone Parents tab folded in.

---

## 6. Security posture

**Strong:**
- **Tenant isolation** — `sessionSchoolId(req)` is the single source of school scope on every query; the request body's `schoolId` is never trusted. Cross-school access is possible only through owner support mode, which sets the session school.
- **Session security** — httpOnly cookies, `sameSite: "strict"`, role-based session lifetimes (privileged roles 8h, parents 30d), session regeneration on login (anti-fixation).
- **MFA (TOTP)** — RFC 6238, unit-tested against the official vectors; single-use recovery codes stored only as SHA-256 hashes; secrets never leave the server; login gate issues a partial-auth marker that grants no access until the code is verified.
- **Rate limiting** — Postgres-backed so it works across serverless instances; applied to sign-in, MFA verify, family enroll (30/min) and search (90/min).
- **CSP** drops `unsafe-eval` in production; **stored-XSS defences** on CMS link/image URLs (scheme allowlist) and on student photos (only `data:image/*` or http(s) accepted — `data:text/html`/`javascript:` rejected).
- **Audit logging** across auth, family/guardian/student lifecycle, payments, support mode, and duplicate-warning overrides.
- **Prohibited-action discipline** — payment confirmation is staff-only; secrets aren't committed (`.env*`, `.localpg/` gitignored).

**Watch items:**
- **SSL cert verification** to Neon is disabled unless `DATABASE_SSL_CA` is set (a startup warning already flags this) — set the CA in production for full MitM protection.
- **Rate limiting is not yet universal** — enroll/search are covered, but many admin mutation endpoints rely only on RBAC. Consider a blanket limiter on state-changing routes.
- **Guardian invite** reuses the tested link-code path, but the guardian→parent-user identity link only completes when the parent redeems the code; there's no reconciliation if they sign up with a different email.

---

## 7. Feature coverage by role

- **Platform owner (BytHub):** global dashboard, school tenant lifecycle, admin invites, email delivery status, **system health telemetry**, DB console (browser + query runner), support mode.
- **School admin:** family-first enrollment, student directory, classes, book catalogue + bundles, stock/barcodes, payment lifecycle, allocations, communications oversight, reports, user management, branding, onboarding checklist.
- **IT personnel:** school public website CMS (page sections), **media library**, branding.
- **Teacher:** class distribution (confirm receipt), extra-copy requests, messages.
- **Finance:** payment review dashboard, verification, financial reports.
- **Parent:** link child (single or family code), book baskets, reference-based payment, messages, 2FA.

---

## 8. Email & notifications

~13 branded transactional emails via Resend, each rendered through a shared per-school-branded wrapper:
- **Account/auth:** password reset, staff invite, school-setup invite, parent welcome, parent linking code.
- **Order lifecycle:** payment instructions, payment submitted/verified/rejected, books ready for collection, collection receipt.
- **Staff/teacher:** class book-list-updated (on bundle assignment); daily admin digest and unpaid-order reminders (scheduled).

All sends are fire-and-forget (never block the user action) and no-op safely if `RESEND_API_KEY` is unset. Users can opt out of scheduled digests/reminders via `notification_preferences` (exposed on the Security page).

---

## 9. Scheduled jobs

A single Vercel Cron (`0 7 * * *`) hits `/api/cron/run`, secured by `CRON_SECRET` (fail-closed if unset). It runs two per-school jobs: the **admin daily digest** (new orders, awaiting-review, ready-to-collect, outstanding payments, low stock) and **unpaid-order reminders** (one reminder around day 3, windowed so it never repeats). Both respect per-user preferences.

---

## 10. Deployment & infrastructure

- **Vercel serverless** — Express behind a single function, `maxDuration: 30`, SPA fallback rewrite.
- **Neon Postgres** — HTTP driver for standard queries, pg Pool for transactions + session store.
- **Build** — `tsx script/build.ts` (Vite client + esbuild server bundle to `dist/index.cjs`).
- **Migrations** — `drizzle-kit push` (additive/nullable columns, so migrations are low-risk).
- Client typecheck passes clean; production build succeeds (with expected chunk-size and `import.meta`/cjs warnings).

---

## 11. Testing

Two integration suites (`tests/`), runnable via `npm test`:
- **family-enrollment.ts** — 18+ scenarios: auth guard, 1/multi-student enroll, add-to-existing-family, multiple guardians, PATCH/DELETE, save-draft, draft→enroll promotion, duplicate family/student detection, validation, PATCH family, search, tenant isolation, delete, plus hardening cases (foreign-classId rejection, future-DOB rejection, photo sanitization, guardian invite).
- **security-regression.ts** — 6 cases covering the earlier CSP/session/rate-limiter hardening.

TOTP and the family validators (photo/DOB/email) also have standalone logic tests that pass. **Gap:** everything outside the family workflow (payments, allocations, catalogue, messaging, CMS) has no automated coverage yet.

---

## 12. Code quality & technical debt

**Strengths:** clean domain-module structure, consistent tenant-isolation pattern, additive/reversible migrations, atomic enrollment transaction, self-healing data backfill, honest audit logging.

**Debt, worst first:**

1. **Dual family model coexistence (highest).** `family.routes` (`/api/admin/families/*`, join-table only) and `family-enrollment.routes` (`/api/families/*`, family-first) both exist. The frontend uses the new one; the legacy one lingers. Until every reader (parent portal, allocations, reports) is confirmed on `students.family_id`, the two must stay in sync (the backfill handles this today). **Action:** audit all readers, then retire the legacy endpoints and the old data paths.

2. **Frontend bundle size.** The client bundles to a single ~1.6 MB JS chunk (462 KB gzip). It works, but code-splitting by role/route would markedly improve first-load, especially for parents on mobile.

3. **Base64 assets in Postgres.** Branding logos, student photos, and media-library files live as data URIs in rows. Simple, but inflates row/query size and payloads. Object storage (e.g. Vercel Blob / S3) is the scale path.

4. **Thin test coverage** outside enrollment (see §11).

5. **Rate limiting not universal** (see §6).

6. **`storage.ts` is very large** — a monolithic repository. Splitting by domain would ease maintenance.

7. **Two soft/hard delete conventions** coexist (204 vs `{success:true}`); minor inconsistency worth standardising.

---

## 13. Known risks & issues (honest register)

| # | Risk | Severity | Status |
|---|---|---|---|
| 1 | Legacy vs new family model divergence | Medium | Mitigated by backfill + sync; retire legacy next |
| 2 | Guardian↔parent-user identity not fully reconciled | Medium | Invite flow bridges it on code redemption |
| 3 | Neon SSL verification off without `DATABASE_SSL_CA` | Medium | Warned at startup; set CA in prod |
| 4 | No object storage — base64 assets in DB | Low–Med | Fine at current scale |
| 5 | Bundle size / no code-splitting | Low–Med | Perf only |
| 6 | Test coverage gaps outside enrollment | Medium | Family + security suites exist |
| 7 | Rate limiting not on all mutations | Low | Key auth/enroll paths covered |
| 8 | Email only works if `RESEND_API_KEY` + verified domain set | Low | No-ops safely otherwise |

No critical (data-loss or auth-bypass) issues were identified.

---

## 14. Prioritised recommendations

**Now (correctness & trust):**
1. Finish the **family-model coexistence audit** and retire `/api/admin/families/*` once all readers use `students.family_id`.
2. Set `DATABASE_SSL_CA` in production.
3. Extend automated tests to **payments and allocations** (the money paths).

**Next (scale & performance):**
4. **Code-split the client** by role/route to cut first-load.
5. Move logos/photos/media to **object storage**, keeping DB rows lean.
6. Add a **blanket rate limiter** on state-changing endpoints.

**Later (polish & hardening):**
7. Complete the **guardian ↔ parent-portal identity** reconciliation.
8. Split `storage.ts` into per-domain repositories.
9. Standardise delete responses and API conventions.
10. Consider CI that runs `tsc` + both test suites on every push.

---

## 15. Current workflows (end to end)

Each workflow lists the **actor**, the **steps** with the real endpoints they call, the **outcome**, and any **emails** fired.

### 15.1 Platform onboarding — new school (Owner)
1. Owner creates a tenant → `POST /api/owner/schools`.
2. Owner invites the first school admin → `POST /api/owner/schools/:schoolId/invite-admin` (→ *school-setup invite email*).
3. Admin accepts via `/accept-invite/:token`, sets their password, and lands in the admin shell.
4. Owner can suspend / archive / restore / request-deletion of a school (`/suspend`, `/archive`, `/restore`, `/request-deletion`).
**Outcome:** a live tenant with an owning admin. **Isolation:** all of the above are `PLATFORM_OWNER_ROLES`-gated.

### 15.2 School operational setup (Admin)
1. Admin works the onboarding checklist (School profile → Classes → Books → Bundles → assign bundles to classes → Students → Parent invites → Payment app name → review).
2. Payment-app name is set in school settings (parents see it in payment instructions).
3. Admin finalises → `POST /api/admin/setup-complete` (or `setup/branding-skip` to defer branding).
**Guard:** payments cannot be confirmed until operational setup is complete.

### 15.3 Family enrollment — family-first (Admin)
1. Admin opens **New Enrollment** (`/admin/family-enroll`).
2. *Find or Create Family*: search existing → `GET /api/families/search?q=`, or fill new household fields.
3. Add one or more **guardians** (name, relationship, email/phone, primary flag).
4. Add one or more **students** (name, DOB, gender, grade, class, reading level, photo).
5. **Save Draft** → `POST /api/families/save-draft` (returns familyId; page remembers it), or **Enroll Family (X)** → `POST /api/families/enroll`.
6. Server runs *atomically in a transaction*: create/link family → guardians (one primary) → students (+ `family_students` join), with duplicate-family/student detection (409 → override), classId tenant check, and DOB/email validation.
**Outcome:** one household record with guardians + students; friendly `familyCode` (never a raw UUID) shown in the UI.

### 15.4 Guardian → parent portal access (Admin → Parent)
1. On a family profile, admin clicks **Invite** on a guardian → `POST /api/guardians/:id/invite`.
2. Server generates a *family link code* for the guardian's email and emails it (*parent linking-code email*); guardian's `portalAccessStatus` → `invited`.
3. Parent redeems the code (see 15.5) → account linked to **all** the family's students.

### 15.5 Parent links children & views books (Parent)
1. Parent signs up (`/register`, → *welcome email*) or signs in.
2. Enters a code → `POST /api/parent/link-code/preview` then `/confirm` (family code links all siblings; single code links one child).
3. Views children and their book lists → `GET /api/parent/children`, `/children/:id/books`.

### 15.6 Catalogue → bundles → class assignment (Admin)
1. Add books (manual or ISBN lookup / barcode) → `book.routes`.
2. Create a **bundle** (book level) and add books to it → `POST /api/book-levels`, `/items`.
3. Assign a bundle to a class → `POST /api/class-book-levels` (→ *teacher "book list updated" email* to the class teacher).
4. Optional per-student override of the class bundle → `student_book_levels`.

### 15.7 Ordering & payment (Parent → Finance/Admin)
1. Parent builds a basket for a child → `POST /api/parent/children/:id/basket`.
2. Parent creates the order → `POST /api/parent/payments` (status `awaiting_reference`) (→ *payment-instructions email*: amount, reference, school payment-app name).
3. Parent pays externally, then submits the bank reference → `POST /api/parent/payments/:id/submit-reference` (status `reference_submitted`) (→ *payment-submitted email*).
4. Staff review in Payments/Finance → `POST /api/admin/payments/:id/confirm` (→ *payment-verified email*) or `/reject` (→ *payment-rejected email*); `/needs-review` parks ambiguous ones.
**Guard:** confirmation is staff-only and blocked until school setup is complete.

### 15.8 Collection lifecycle (Admin/Finance)
1. Confirmed order → allocations created for the child's books.
2. Staff mark **ready for collection** → `POST /api/admin/payments/:id/ready-for-collection` (→ *books-ready-for-collection email*).
3. On handover, staff mark **collected** → `/collected` (→ *collection receipt email*). `/cancel` is available for exceptions.

### 15.9 Book distribution (Teacher)
1. Teacher opens Book Distribution for their class, confirms a student **received** their books → `POST /api/allocations/:id/confirm`, or marks **absent** → `/absent`.
2. Teacher requests extra copies → `POST /api/extra-requests`; admin approves/rejects → `/approve` `/reject`.

### 15.10 Communications (Parent ↔ Teacher, Admin oversight)
1. Parent and teacher exchange messages in threads (`message.routes`).
2. Admin oversees all threads (Communications), can close/reopen/archive; actions are audit-logged.

### 15.11 School website CMS (IT)
1. IT edits public page sections → `GET/POST/PATCH/DELETE /api/website/sections` (safe-URL scheme allowlist enforced).
2. IT uploads/manages assets in the **Media Library** → `GET/POST/PATCH/DELETE /api/media`.
3. Public visitors see the rendered site at `/school/:code`.

### 15.12 Branding (Admin / IT)
1. Set theme colours, upload logo/banner/favicon/email-logo/PDF-logo (`/api/school/branding/*`).
2. Branding flows into the app shell **and** every transactional email (per-school logo + colours).

### 15.13 Authentication & 2FA (All users)
- **Login:** `POST /api/auth/sign-in`; if MFA is on, returns `{ mfaRequired: true }` → parent/staff completes at `POST /api/auth/mfa/verify` (TOTP or recovery code).
- **Enrol 2FA:** Security page → `POST /api/auth/mfa/setup` (QR) → `/enable` (returns recovery codes once) → `/disable` (password-gated).
- **Password reset:** `POST /api/auth/forgot-password` (→ *reset email*) → `/reset-password`.

### 15.14 Scheduled jobs (System)
- Daily at 07:00 UTC, Vercel Cron → `GET /api/cron/run` (secret-gated): per-school **admin daily digest** (orders, outstanding, low stock) and **unpaid-order reminders** (~day 3, once), both respecting `notification_preferences`.

### 15.15 Reporting (Admin / Finance)
- Admin reports aggregate inventory, payments, allocations, extra-copy requests, class distribution, users, and bundles (`/api/admin/reports`). Finance has a focused payment/revenue report.

### 15.16 Owner operations (Owner)
- **Support mode:** `POST /api/owner/support-mode/enter` sets the session school so the owner can act *inside* a tenant with full isolation still enforced; `/exit` leaves it.
- **System Health:** live DB latency/connectivity, rate-limiter store, email config, runtime metrics.
- **DB Console:** table browser + query runner (owner-only).

### 15.17 Student directory & profile drill-in (Staff)
- **Students** tab = the roster: search, filter by class, CSV import, barcodes. Opening a student shows the full profile (class, family with "Open family" bridge, book list/bundle, allocation/distribution status) via `GET /api/students/:id/profile`. "New Enrollment" routes into the family-first flow so no student is created without a household.

---

*This audit reflects the codebase as reviewed: 32 tables, ~209 endpoints, 20 route modules, ~36 screens, 8 roles. It is grounded in direct inspection of the schema, routes, middleware, and tests rather than assumptions.*
