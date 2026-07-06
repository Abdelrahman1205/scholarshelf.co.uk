# ScholarShelf — Master Reference

**The single source of truth for this project.** Read this first. It consolidates architecture, data model, roles, workflows, deployment, operational gotchas, security posture, and current state. Owner: BytHub Technology Ltd. Production: https://www.scholarshelf.co.uk

---

## 1. What ScholarShelf is

A **multi-tenant SaaS** that schools use to manage reading-scheme book distribution end to end: school setup → book catalogue → teacher allocation → parent ordering → payment verification → physical collection → analytics. One deployment serves every school ("tenant"), isolated by `schoolId`. BytHub (the vendor) sits above all tenants as platform owner.

It also includes a **headless CMS** so each school gets an editable public website, managed by an IT role, rendered from the database.

Internal/legacy name: "EduBook" (some files/docs still use it). Product name: **ScholarShelf**.

---

## 2. Tech stack (actual, verified)

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 7 SPA, Wouter routing, TanStack Query v5, shadcn/ui + Radix, Tailwind v4 |
| Backend | Express 5 (TypeScript), session auth (`express-session` + `connect-pg-simple`) |
| ORM / DB | Drizzle ORM v0.39 → PostgreSQL on **Neon** (serverless, `@neondatabase/serverless` HTTP driver). Raw `pg` Pool for the DB console. |
| Email | Resend |
| Hosting | **Vercel** — SPA on the CDN, all `/api/*` through one serverless function (`api/index.ts`, 30s max) |
| Env validation | Zod (`server/config/env.ts`) — fails fast at startup |
| Schema deploy | `drizzle-kit push` (no migration files — direct diff-and-apply) |

---

## 3. Repository map (key files)

```
api/index.ts                         Vercel serverless entry
server/
  app.ts                             helmet/CSP, sessions, cookie config, middleware order
  config/env.ts                      Zod env schema (single source of truth)
  config/database.ts                 Drizzle + pg Pool
  middleware/auth.ts                 requireAuth/requireRole, rate limiter, RBAC guards, role groups
  core/constants.ts                  role-group constants
  storage.ts                         ALL data access (~one class, ~2,700 lines)
  email.ts                           Resend senders (sender-name logic — see §9 gotcha)
  paymentIntegration.ts              webhook HMAC verification
  routes/                            18 domain route files (index.ts registers them)
    auth · book · student · parent · payment · allocation · user · message
    notification · owner · dashboard · family · public · db-console · setup
    website (CMS)
shared/schema.ts                     Drizzle tables + Zod schemas + enums (SINGLE SOURCE OF TRUTH)
client/src/
  App.tsx · main.tsx                 router + entry
  components/layout.tsx              role-aware sidebar/nav (roleConfig map)
  lib/role-routes.ts                 role → default landing route
  pages/
    login · register · accept-invite · forgot/reset-password
    school-public.tsx                public /school/:code renderer (+ CMS sections)
    teacher · parent · finance · not-found
    admin.tsx                        admin router + SECTION RESOLUTION LOGIC (important — see §7)
    admin/*.tsx                      one file per admin section (dashboard, books, students,
                                     payments, allocations, users, families, branding, reports,
                                     communications, owner, db-console, website, it-dashboard, …)
tests/security-regression.ts         52 automated security tests
```

**Docs in repo:** `PROJECT_MASTER.md` (this) · `SECURITY_REVIEW.md` (STRIDE) · `DEFENSIVE_SECURITY_DESIGN.md` · `WEBSITE_ARCHITECTURE.md` · `EDUBOOK_FULL_SYSTEM_REPORT.md` · `WORKFLOW_COVERAGE_MATRIX.md` · assorted audit `.md`s.

---

## 4. Roles & permissions (RBAC)

Role resolved **server-side from the session**, never from the request. Groups live in `server/middleware/auth.ts` / `core/constants.ts`.

| Role | Scope | Lands on | Sees |
|---|---|---|---|
| `owner` / `platform_admin` | Cross-tenant (BytHub) | `/admin/owner` | Everything + Schools lifecycle + **DB Console** |
| `admin` / `school_admin` | One school | `/admin` | All EduBook operations for their school |
| `finance` | One school | `/finance` | Payments, allocations, reports |
| `it_personnel` | One school | `/admin/website` | **Public website + branding ONLY** — no operational/PII data |
| `teacher` | Class-scoped | `/teacher` | Distribution, class views, extra requests, messages |
| `parent` | Own children | `/parent` | Baskets, own payments, messages |
| `student` | Self | — | Minimal in V1 |
| Public visitor | — | `/school/:code` | Published website content only |

Role groups: `PLATFORM_OWNER_ROLES=[owner,platform_admin]` · `ADMIN_UI_ROLES=[admin,school_admin,owner,platform_admin]` · `FINANCE_ROLES=[…ADMIN_UI,finance]` · `IT_WEBSITE_ROLES=[it_personnel]`.

**Hard invariants:** IT never touches operational/PII data · parents/students never write payment status · teachers never write student records · only owner acts across tenants.

---

## 5. Data model (29 tables, `shared/schema.ts`)

- **Multi-tenant core:** `schools`, `school_branding`, `users`, `user_permissions`, `invites`, `audit_logs`, `message_audit_logs`
- **Academic:** `classes`, `students`, `teacher_profiles`, `books`, `book_levels`, `book_level_items`, `class_book_levels`, `student_book_levels`, `book_inventory_transactions`
- **Family/parent:** `families`, `family_students`, `child_linking_codes`, `parent_children`
- **Ordering/payment:** `child_book_baskets`, `basket_items`, `book_payments`, `basket_payments`, `finance_book_allocations`, `extra_copy_requests`
- **Messaging:** `message_threads`, `messages`
- **Added this session:** `school_website_sections` (CMS), `rate_limits` (distributed rate limiting)

Every tenant table carries `schoolId` (FK → `schools`, cascade on delete). `schoolId` always comes from the session on writes.

---

## 6. Core workflows

**Book distribution:** admin assigns book level to class → finance creates allocation (`pending`) → teacher on distribution day confirms received / marks absent / **out_of_stock** (added this session) → basket generated → parent submits payment reference → finance confirms → ready_for_collection → collected.

**Parent onboarding:** (A) admin invites parent email → Resend link → register, children auto-linked; (B) linking code — admin generates code, parent enters it (preview → confirm); (C) CSV import with `parent_email` column auto-invites.

**Family basket:** parent with ≥2 children with pending baskets sees "Pay for All Children" → one `book_payment` covering multiple baskets via `basket_payments`.

**School website (CMS):** IT edits typed sections (hero/about/announcement/contact/custom) in the Page Sections editor → drafts until published → public `/school/:code` renders published sections with school branding. See `WEBSITE_ARCHITECTURE.md`.

---

## 7. Frontend routing gotcha (critical to understand)

`client/src/pages/admin.tsx` maps a `section` string → a component, then runs **section-resolution logic** that redirects users away from sections they shouldn't see:

- `ownerOnlySections` — sections only the owner may open. **A section not in this set gets an owner redirected back to the owner dashboard.** (This is what silently hid the DB Console until `db-console` was added to the set this session.)
- `itAllowedSections = {website, website-content, branding}` — IT is confined to these.
- `websiteSections = {website, website-content}` — non-owner, non-IT users are bounced off these (website is IT-only).

**Rule of thumb:** when adding a new owner or IT admin section, you must add it to the right allowlist here, or it silently won't render even though the route and sidebar link exist.

Default landing routes live in `client/src/lib/role-routes.ts` and `CONTEXT_DEFAULT_PATHS` in `server/middleware/auth.ts` — keep those two in sync.

---

## 8. Security posture (as built)

Strong baseline, verified in code: bcrypt-12, session regeneration on login, httpOnly + secure(prod) + **sameSite=strict** cookies, helmet + CSP (prod drops `unsafe-eval`), hashed reset/invite tokens, anti-enumeration on reset, generic errors, `safeUser()` strips hashes, session-derived tenant scoping with safe-404 on cross-tenant, payment confirmation role-gated, webhook HMAC (fails closed), audit logging, **distributed (Postgres-backed) rate limiting**, **CMS URL scheme allowlist** (blocks `javascript:` — stored-XSS fix). 52/52 security regression tests pass.

**Still outstanding (owner action required):** MFA on privileged accounts · least-privilege DB role (app currently connects with high privileges) · automated tenant-isolation tests for every resource · UK GDPR paperwork (DPA per school + DPIA — legal blocker at scale). Full list in `SECURITY_REVIEW.md` §17 and `DEFENSIVE_SECURITY_DESIGN.md` §14.

---

## 9. Deployment & operations (hard-won knowledge)

**Deploy flow:** push to `main` on GitHub (`Abdelrahman1205/scholarshelf.co.uk`) → Vercel auto-builds & deploys to production `www.scholarshelf.co.uk`.

**Critical gotchas learned the hard way:**

1. **`RESEND_FROM_EMAIL` must be a PLAIN address** (`noreply@scholarshelf.co.uk`), NOT `Scholar Shelf <noreply@…>`. The Zod env validator rejects the display-name form and the whole API crashes at startup (every route 500s). The code adds the "Scholar Shelf" display name at send time.
2. **Env vars apply only on redeploy** — editing them in Vercel does nothing until you redeploy.
3. **Edit env vars in the PRODUCTION scope**, not Development. They look nearly identical in the Vercel list; a Dev-scope edit won't affect the live site.
4. **`npm run db:push` after schema changes** — new tables (`school_website_sections`, `rate_limits`) won't exist in prod until you push the schema. Run with the production `DATABASE_URL` in `.env`. Approve additive changes; STOP if it warns about dropping/truncating real data.
5. **One Vercel project only** — there was briefly a duplicate (`scholarshelf-co-uk-wwao`) auto-created from a second repo import, causing double deploys. Keep just `scholarshelf-co-uk` (owns the domain + all env vars).
6. **Preview URLs are frozen builds** — `…-bytehubtechnology.vercel.app` links do NOT update on push. Always test on `www.scholarshelf.co.uk` and hard-refresh (Ctrl+Shift+R) to beat cache.
7. **Git `index.lock`** — if git jams, `del .git\index.lock` then retry.
8. **`.localpg/` and all `.env*` must stay gitignored** — local Postgres data + secrets; never commit.

**Required production env vars:** `DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `PAYMENT_WEBHOOK_SECRET` (≥16), `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (plain address), `APP_BASE_URL`.

**Demo accounts (login page buttons):** BytHub (owner), Admin, Teacher, Parent, Finance — all use school code `DEMO-001` except owner. **Disable/rotate these before real clients onboard.**

---

## 10. Real API contract highlights

- Tenant data: `/api/books`, `/api/students`, `/api/classes`, `/api/allocations`, `/api/admin/payments`, etc. — all session-scoped.
- Parent: `/api/parent/link-code/{preview,confirm}`, `/api/parent/link-child`, `/api/parent/children`, `/api/parent/{baskets,payments}`.
- Website CMS: `GET/POST/PATCH/DELETE /api/website/sections` (IT + admin + owner) · public `GET /api/public/schools/:code/website` (published-only, fail-safe empty).
- Owner DB console: `GET /api/owner/db/tables`, `GET /api/owner/db/tables/:table`, `PATCH`/`DELETE` `/tables/:table/:id`, `POST /api/owner/db/query` (DDL blocked, mutations need `dangerConfirm`), `POST /api/owner/db/danger/wipe-school/:schoolId`.
- Health: `GET /api/health` → `{status, storageMode, timestamp}`.

---

## 11. What was done in the recent work session

- **Security fixes:** distributed Postgres rate limiter (was in-memory, useless on serverless); CMS safe-URL scheme allowlist (stored-XSS); prod CSP hardening (dropped `unsafe-eval`); `sameSite=strict` cookies; rate limiter now respects storage mode; +5 website security regression tests (52/52 total).
- **Bug fixes:** dashboard/report payment-lifecycle counts (collected payments were vanishing from revenue); "students without invites" counter; duplicate-basket guard (double-click created duplicate pending baskets → double-pay risk); `getAllocations` N+1 removed; extra-copy stock-error now surfaced not swallowed.
- **Features:** out_of_stock / partially_collected distribution statuses; finance + IT roles added to the staff-invite dropdown; **school website CMS** (schema, API, editor UI, public rendering); **IT role** made a real website-manager (own dashboard, nav, landing), walled off from operational data; website removed from admin nav (IT-only).
- **Design:** BytHub **DB Console redesigned** to the Stitch spec (deep-slate, indigo, mono data, status pills, Query Runner, Danger Zone + safety checklist) wired to the real endpoints; **routing fix** so owners can actually reach it (`db-console` added to `ownerOnlySections`).

---

## 12. Known pending / next steps

- **Deploy the latest:** commit + push the DB-console redesign, routing fix, and remaining security work; then `npm run db:push` for the new tables.
- **Security must-dos before real clients:** MFA (owner/admin/finance), least-privilege DB role, tenant-isolation test suite, DPA + DPIA.
- **CMS roadmap (V1.1+):** direct image uploads (reuse branding pipeline), multi-page + navigation, site settings (SEO/social/footer), news feed + gallery blocks, custom domains, SSR for SEO. See `WEBSITE_ARCHITECTURE.md`.
- **Product gaps (non-blocking):** class-scoped teacher visibility (currently school-wide); finance report export; link-code one-click rotation with audit.
- **Housekeeping:** disable demo accounts in prod; confirm Neon backups/PITR + encryption-at-rest; remove stray root `page.tsx` and any duplicate security docs; ensure `.gitignore` covers `.localpg/` and all `.env*`.

---

## 13. Local development

```
npm install
npm run dev          # Vite (5173) + Express API (5000)
npm run db:push      # apply schema to the DB in your .env DATABASE_URL
npm run build        # production build
npm run check        # tsc
```
Only `DATABASE_URL` is required locally; email/payment features degrade gracefully without their keys. To run fully offline against in-memory storage: `FORCE_MEMORY_STORAGE=true` (note: in memory mode the rate limiter and some create operations are no-ops/partial — production always uses Neon).

---

*Keep this file current. When a new critical module, gotcha, or convention appears, add it here rather than spawning another doc.*

---

## 14. COMPLETE PAGE CATALOG (every screen)

### Top-level client routes (`App.tsx`)
`/login` · `/register` · `/accept-invite` · `/accept-invite/:token` · `/forgot-password` · `/reset-password` · `/` (redirect) · `/school/:code` (public school website) · `/admin/:section?` · `/teacher/:section?` · `/parent/:section?` · `/finance/:section?`

### Unauthenticated / public pages
| Page | Route | What it does |
|---|---|---|
| Login | `/login` | Sign in; demo-account buttons; school-code field for tenant staff |
| Register (parent) | `/register` | Parent self-registration |
| Accept invite | `/accept-invite/:token` | Staff/parent set password from emailed invite |
| Forgot password | `/forgot-password` | Request reset email |
| Reset password | `/reset-password` | Set new password from reset token |
| Public school site | `/school/:code` | Branded landing page + published CMS sections + register/login CTAs |

### Platform Owner (BytHub) — `/admin/*`, owner-only
| Page | Route | Features |
|---|---|---|
| Owner Dashboard | `/admin/owner` | Platform KPIs (schools, students, revenue, users), school-health bar, activity feed |
| Schools | `/admin/schools` | All schools; lifecycle: suspend / archive / restore / request-deletion / delete (typed confirmation); support-mode entry |
| School Details | `/admin/school-details` | Per-school detail + branding management |
| Pending Setups | `/admin/pending-setups` | Schools mid-onboarding |
| Admin Invites | `/admin/admin-invites` | Invite / resend / revoke school-admin invites |
| Email Status | `/admin/email-status` | Resend configuration/health |
| Activity Logs | `/admin/activity` | Cross-tenant audit feed |
| Settings | `/admin/owner-settings` | Platform settings |
| **DB Console** | `/admin/db-console` | **(Stitch redesign)** Table Browser (22 whitelisted tables, search, inline edit/delete, pagination) · Query Runner (parameterised SQL, DDL blocked, mutation confirm, copy TSV) · Danger Zone (school wipe, typed confirm, safety checklist) |

### School Admin — `/admin/*`
Dashboard `/admin` (setup progress, KPIs, quick actions, alerts, recent activity) · Books `/admin/books` (CRUD, ISBN lookup, barcode scan, stock adjust, low-stock) · Book Levels `/admin/levels` (create levels, assign books, assign to classes, per-student override) · Classes `/admin/classes` · Students `/admin/students` (CRUD, archive/unarchive, CSV/XLSX import preview+confirm) · Parents `/admin/parents` (linked parents, payment readiness) · Families `/admin/families` (group siblings, family link codes) · Parent Invites `/admin/codes` (linking codes, generate, rotate, resend) · Payments `/admin/payments` (confirm / reject / needs-review / ready-for-collection / collected / cancel, CSV export, class filter) · Allocations `/admin/allocations` (create, confirm receipt incl. own-child, distribution overview) · Extra Requests `/admin/requests` (approve/reject teacher extra-copy requests) · Communications `/admin/communications` (parent↔staff thread oversight, close threads) · Reports `/admin/reports` (inventory, payments incl. lifecycle counts, distribution, class breakdown, users, book-levels) · Users `/admin/users` (invite staff — teacher/school_admin/finance/IT, manage, secondary roles, suspend/reactivate, link parent to child) · Branding `/admin/branding` (logo/banner/favicon/email-logo/pdf-logo, colours, font, live preview) · Setup `/admin/setup` (6-step onboarding wizard).

### IT Personnel — `/admin/*` (website-only)
Website Control `/admin/website` (IT Control Center) · Page Sections `/admin/website-content` (CMS editor: add/edit/reorder/publish typed sections) · Branding `/admin/branding` (permission-gated).

### Teacher — `/teacher/*`
Dashboard `/teacher` (assigned classes overview) · Book Distribution `/teacher/distribution` (per-student: confirm received / mark absent / **mark out-of-stock** / report issue; not own child; "partially collected" badge) · Extra Requests `/teacher/requests` (submit extra-copy requests) · Messages `/teacher/messages` (parent messaging).

### Finance — `/finance/*`
Dashboard `/finance` (revenue, outstanding, pending review, status breakdown) · Payment Review `/finance/payments` (confirm/reject/flag) · Reports `/finance/reports` (confirmed revenue, monthly, collection performance).

### Parent — `/parent/*`
Dashboard `/parent` (children, pending baskets, payment status) · Link Child `/parent/link` (enter link code, preview→confirm, QR) · Book Baskets `/parent/baskets` (per-child baskets, "Pay for All Children" family basket, processed orders) · Payments `/parent/payments` (submit reference, history/status) · Messages `/parent/messages`.

## 15. COMPLETE API ENDPOINT INDEX (~185 endpoints)

**Auth** (`auth.routes`): POST sign-in, sign-out, sign-up-parent, accept-invite, forgot-password, reset-password, context (role switch), login/logout (legacy); GET me. GET invites/:token, POST invites/:token/accept.

**Public** (`public.routes`): GET public/schools/:code, /:code/branding, /:code/email-logo, /:code/website.

**Books/inventory** (`book.routes`): GET/POST books, PATCH/DELETE books/:id, GET books/by-isbn/:isbn, books/low-stock, books/scan/:code, POST books/:id/stock, GET inventory-transactions. Book levels: GET/POST book-levels, PATCH/DELETE :id, GET/POST :id/items, DELETE book-level-items/:id, GET/POST class-book-levels, DELETE :id. Classes: GET/POST classes, PATCH/DELETE :id.

**Students** (`student.routes`): GET/POST students, PATCH/DELETE :id, POST :id/unarchive, GET/PUT/DELETE :id/book-level-override, GET book-level-overrides, POST students/import/preview + /confirm, POST students/:id/linking-code + /rotate, GET linking-codes.

**Parent** (`parent.routes`): POST link-code/preview, link-code/confirm, link-child; GET children, children/:id/books, baskets; POST children/:id/basket; GET/POST payments, POST payments/:id/submit-reference; message-contacts, message-threads (GET/POST), :id, :id/messages, message-unread.

**Payment/finance** (`payment.routes`): GET admin/payments, POST admin/payments/:id/{confirm,reject,needs-review,ready-for-collection,collected,cancel,order-status}; GET finance/summary.

**Allocations/distribution** (`allocation.routes`): GET/POST allocations, POST :id/{confirm,absent}; GET admin/book-distribution, POST admin/book-distribution/:id/confirm; GET teacher/book-distribution, POST teacher/book-distribution/:id/{confirm-received,mark-absent,mark-out-of-stock,report-issue}; GET/POST extra-requests, POST :id/{approve,reject}.

**Users** (`user.routes`): GET/POST users, PATCH/DELETE :id; GET admin/users, :userId, GET admin/parents, admin/students/search; PATCH admin/users/:id, DELETE :id, POST :userId/{suspend,reactivate,link-child}, roles/{teacher,parent}, DELETE roles/:role; POST invites.

**Families** (`family.routes`): GET admin/families, :id, POST admin/families, :id/link-code, PATCH :id, DELETE :id, PUT/DELETE :id/students/:studentId.

**Messaging/notifications** (`message`/`notification.routes`): GET admin/communications, :threadId, PATCH :threadId/status; GET teacher/message-threads, :id, message-unread, POST :id/messages; GET notifications/summary; POST webhooks/payment-update (HMAC).

**Setup/branding** (`setup.routes`): GET admin/setup-status, POST admin/setup-complete, setup/branding-skip; GET/PATCH admin/school/settings, GET school/payment-info; GET/PATCH school/branding, POST school/branding/{logo,banner,favicon,email-logo,pdf-logo,reset}; GET it/website-summary.

**Website CMS** (`website.routes`): GET/POST website/sections, PATCH/DELETE :id, POST :id/move.

**Owner** (`owner.routes`): GET owner/dashboard, activity, pending-setups, schools, :schoolId, :schoolId/branding, email-status, support-status, support/communications/:threadId, support/schools/:schoolId/communications; POST owner/schools, :id/{suspend,archive,restore,request-deletion}, DELETE :id, PATCH :id, POST :schoolId/{invite-admin,branding/logo,branding/reset}, PATCH :schoolId/branding, POST owner/invites/:inviteId/{resend,revoke}, enter-support/:schoolId, exit-support, support-mode/{enter,exit}.

**DB Console** (`db-console.routes`, owner-only): GET owner/db/tables, tables/:table, PATCH/DELETE tables/:table/:id, POST owner/db/query, danger/wipe-school/:schoolId.

**Misc:** GET health, POST seed-users (demo), POST auth/context (multi-role switch).

## 16. Feature checklist (by capability)

Auth: session login, 8-role RBAC, multi-role context switching, staff invites (4 roles), parent self-register, email verification-via-invite, password reset, rate limiting (distributed), account status (active/invited/disabled/locked), audit logging. · Catalogue: books CRUD, ISBN lookup, barcode scan, stock + inventory transactions, low-stock alerts, book levels, per-student overrides, class-book-level assignment. · Students/family: CRUD, archive, CSV/XLSX import, families, linking codes (generate/rotate/preview/confirm), parent-child links. · Ordering: baskets, basket items, family basket ("pay for all"), payment references, duplicate-ref detection. · Payments: full lifecycle (awaiting-ref→submitted→confirmed→ready-for-collection→collected, +reject/needs-review/cancel), CSV export, webhook (HMAC). · Distribution: allocations, teacher confirm/absent/out-of-stock/issue, admin confirm, extra-copy requests. · Messaging: parent↔staff threads, unread badges, admin oversight, audit. · Owner: platform metrics, school lifecycle, support mode, admin invites, DB console (browser/SQL/danger). · Website CMS: typed sections, draft/publish, reorder, public render, branding. · Branding: 5 asset types + colours/font, per-school, live preview, public page.
