# CURRENT_SYSTEM_MAP.md — Stage 0B

*What actually exists, read out of `C:\dev\scholarshelf` at HEAD `e80aad8` + uncommitted working
tree, 23 August 2026. No judgement in this document — that is Stage 3 onward.*

Total application source: **≈50,200 lines** of TypeScript/TSX across `server/`, `client/src/`,
`shared/`, `api/`, `script/`, `tests/`.

---

## 1. Shape of the system

```
Browser (React 19 SPA, Vite 7)
   │  fetch → /api/*
   ▼
Vercel CDN ── rewrite /api/(.*) → /api/index ──► ONE serverless function (30 s max)
                                                    │
                                                    ▼
                                          api/index.ts → server/app.ts
                                          (helmet/CSP, session, routes)
                                                    │
                                                    ▼
                                          server/routes/*  (19 files, 242 endpoints)
                                                    │
                                                    ▼
                                          server/storage.ts  (3,532 lines, ~305 methods)
                                                    │
                                                    ▼
                                          Drizzle → Postgres (Neon HTTP or node-pg)
```

Everything server-side runs in a single function. There is no queue, no worker, no cache, no
search index. The only scheduled work is one Vercel cron at `0 7 * * *` hitting `/api/cron/run`.

---

## 2. Technology stack (verified in `package.json` / config)

| Layer | Technology | Note |
|---|---|---|
| UI | React 19.2, Vite 7.1, Wouter 3.3, TanStack Query 5.60 | SPA, no SSR |
| Components | shadcn/ui over Radix (**56 primitives** in `client/src/components/ui/`) | plus Tailwind v4 |
| Server | Express 5, TypeScript 5.6, `express-session` + `connect-pg-simple` | ESM, `strict: true`, target ES2022 |
| Data | Drizzle ORM 0.39 → Postgres; `@neondatabase/serverless` **or** `pg` Pool, chosen by URL | |
| Auth | bcryptjs (cost 12), server-side TOTP MFA (`server/mfa.ts`, no library) | Passport is a dependency but the flow is hand-rolled |
| Email | Resend 6.12 | |
| Files | Multer + `file-type` | |
| Spreadsheets | `xlsx` 0.18.5 | known CVEs at this version |
| Host | Vercel | build via `script/build.ts` (esbuild) |
| Validation | Zod 3.25 (`server/config/env.ts` fails fast at startup) | |

**Dependencies present but not used by the application:** `@supabase/ssr`, `@supabase/supabase-js`
(their only consumers, `utils/supabase/*`, are deleted), `passport`, `passport-local`,
`memorystore`. `package.json` still declares `"name": "rest-express"` and `"license": "MIT"` on a
commercial product.

**There is no Stripe SDK.** Despite commit `e77728b` "Add automatic Stripe payment verification",
`server/services/payment-verification/` matches payments from an **imported Stripe spreadsheet**
(`stripe-spreadsheet-importer.ts`) — it is reconciliation, not a live card integration.

---

## 3. Backend modules

### 3.1 Route layer — 19 files, 242 endpoints

| File | Endpoints | Owns |
|---|---:|---|
| `book.routes.ts` | 39 | books, copies, levels, level items, class↔level, inventory, barcodes |
| `setup.routes.ts` | 22 | school setup wizard, go-live checklist |
| `owner.routes.ts` | 21 | tenant lifecycle, support mode, platform notifications |
| `family-enrollment.routes.ts` | 21 | families, guardians, enrolment, spreadsheet import, invitations |
| `user.routes.ts` | 18 | staff CRUD, invites, permissions |
| `allocation.routes.ts` | 18 | allocations, distribution, custody transitions |
| `payment.routes.ts` | 15 | payment review, confirm, reconciliation |
| `auth.routes.ts` | 13 | sign-in/up, reset, invite accept, context switch |
| `message.routes.ts` | 11 | threads, messages |
| `db-console.routes.ts` | 11 | owner console (3 tiers) |
| `parent.routes.ts` | 10 | baskets, link codes, payment submission |
| `website.routes.ts` | 9 | CMS sections |
| `student.routes.ts` | 9 | students, profiles |
| `notification.routes.ts` | 8 | notifications, preferences |
| `mfa.routes.ts` | 6 | TOTP enrol/verify/recovery |
| `dashboard.routes.ts` | 5 | role dashboards |
| `public.routes.ts` | 3 | public school site, health |
| `cron.routes.ts` | 2 | daily digest drain |

`server/routes.ts` is a 10-line re-export shim kept so `server/app.ts` need not change. Registration
order in `server/routes/index.ts` is deliberate (public → console → auth → domain).

### 3.2 Service layer — the only two extracted domains

```
server/services/enrollment-import/      8 files  — spreadsheet parser, row validator,
                                                   date/class/family/student resolvers,
                                                   import-service (726 lines), template
server/services/payment-verification/   5 files  — provider-payment repository, matcher,
                                                   verification service (554 lines),
                                                   Stripe spreadsheet importer
```

Every other domain's logic lives either in its route file or in `storage.ts`.

### 3.3 Cross-cutting

| File | Lines | Role |
|---|---:|---|
| `server/storage.ts` | 3,532 | **all** data access, one class, ~305 methods, 57 use `schoolFilter()` |
| `server/middleware/auth.ts` | 1,108 | RBAC, role groups, rate limiting, tenant choke point, context switching |
| `server/email.ts` | 767 | Resend senders and templates |
| `server/custody.ts` | — | custody state machine (`ALLOWED_TRANSITIONS`) |
| `server/console/` | 2 files | typed console operations + console audit |
| `server/config/` | 3 files | Zod env schema, Drizzle/pg, read-only console pool |
| `server/core/` | 2 files | role constants, error types |
| `server/paymentIntegration.ts` | — | webhook HMAC, fails closed |
| `server/storageProvider.ts` | 62 | storage-mode selection |
| `server/branding.ts` | 184 | server-side branding resolution |

---

## 4. Data model — 41 tables in `shared/schema.ts` (1,166 lines)

| Group | Tables |
|---|---|
| Tenancy | `schools`, `school_branding`, `rate_limits`, `cron_job_runs`, `audit_logs` |
| Identity | `users`, `user_permissions`, `user_sessions`, `invites` |
| Academic | `classes`, `subjects`, `class_teacher_assignments`, `students`, `teacher_profiles` |
| Catalogue | `books`, `book_copies`, `book_levels`, `book_level_items`, `class_book_levels`, `student_book_levels`, `book_inventory_transactions` |
| Family | `families`, `family_students`, `guardians`, `child_linking_codes`, `parent_children` |
| Ordering | `child_book_baskets`, `basket_items`, `extra_copy_requests` |
| Money | `book_payments`, `basket_payments`, `provider_payments`, `payment_verification_attempts`, `finance_book_allocations` |
| Custody | `custody_events` |
| Messaging | `message_threads`, `messages`, `message_audit_logs` |
| Site | `school_website_sections`, `media_assets`, `notification_preferences` |

**76 `references()` (foreign keys)** and **42 index/uniqueIndex declarations** are now in the
schema file. `school_branding`, `user_permissions`, `user_sessions` and `teacher_profiles` — which
previously existed only in a runtime bootstrap — are now declared here. `shared/schema.ts` is a
single source of truth again.

`academicYear` is stamped on six tables (`classes`, `students`, `finance_book_allocations`,
`book_payments`, and two others), with the vocabulary in `shared/academic-year.ts`
(`academicYearFor`, `currentAcademicYear`, `normaliseAcademicYear`, `academicYearSortKey`,
`recentAcademicYears`).

**Three distinct status vocabularies on `finance_book_allocations`** — `status` (allocation
lifecycle), `distribution_status` (teacher hand-over), `custody_status`. They mean different
things and must not be merged.

---

## 5. Roles, permissions and tenant isolation

| Role | Scope | Lands on |
|---|---|---|
| `owner` / `platform_admin` | cross-tenant | `/admin/owner` |
| `admin` / `school_admin` | one school | `/admin` |
| `finance` | one school | `/finance` |
| `it_personnel` | one school, website + branding only | `/admin/website` |
| `teacher` | class-scoped | `/teacher` |
| `parent` | own children, **via `parent_children`, not `schoolId`** | `/parent` |
| `student` | self | minimal |

Enforcement layers, in order:

1. `requireAuth` / `requireRole(...)` — role resolved from the session, never the request.
2. `ensureSessionSchoolIsActive()` (`auth.ts:352`) — one choke point. Refuses a tenant-scoped role
   with a null school; refuses suspended / archived / pending_deletion / deleted schools; returns
   `boolean`, with an explicit comment about why it must not return the `Response`.
3. `sessionSchoolId(req)` → `schoolFilter()` in storage (57 call sites).
4. Private storage asserts — `assertBookLevelInSchool`, `assertStudentInSchool`,
   `assertBookInSchool`, `assertClassInSchool` — applied at 18 call sites so body-supplied foreign
   keys cannot cross a tenant.
5. `LEGACY_ROLE_MAP` + `resolveRole()` normalises the historical role vocabulary at every entry.
6. Context switching (`POST /api/auth/context`) validates the requested context against the
   account's genuinely available contexts and audits the switch.
7. MFA is **mandatory for platform-owner roles only** (`auth.ts:456`), enforced server-side.

---

## 6. Frontend

```
client/src/
  App.tsx, main.tsx
  components/layout.tsx (635)   role-aware nav; roleConfig for owner/admin/it_personnel/
                                teacher/finance/parent
  components/query-state.tsx    NEW — distinguishes "empty" from "failed"
  components/public-footer.tsx
  components/ui/                56 shadcn primitives
  hooks/                        use-auth, use-mobile, use-toast
  lib/                          branding · errors (NEW) · format (NEW) · queryClient ·
                                role-routes · utils
  pages/                        13 top-level + 27 admin sections
  index.css                     260 lines — the design tokens
```

**Admin routing gotcha (still live).** `client/src/pages/admin.tsx` resolves a `section` string to a
component and then redirects based on three allowlists:

- `ownerOnlySections` — a section **not** in this set bounces an owner back to the owner dashboard.
- `itAllowedSections = {website, website-content, media, branding}`
- `websiteSections = {website, website-content}` — non-owner, non-IT users are bounced off.

Adding an owner or IT section without adding it to the right set means the page silently never
renders even though the route and the sidebar link exist.

### Design generations present

1. **Shipped UI** — shadcn/Radix + Tailwind v4, tokens in `client/src/index.css`. `--success`,
   `--warning` and their `-bg` pills now exist alongside `--destructive`; `--radius: 0.75rem` with a
   four-step scale; light and dark palettes.
2. **Stitch HTML mockups** — ~40 standalone `*_code.html` screens in the Claude project, in two to
   three generations (`_code.html`, `_code (2).html`, `_code (3).html`) with matching PNGs. The DB
   Console is the one screen built to that spec.
3. **`EduBook_Designer_Handoff.pdf`** and three generations of `scholarshelf_DESIGN.md`.
4. **Formatting layer** — `client/src/lib/format.ts` pins money, dates and year groups to en-GB /
   GBP. **Adopted by 14 files**; 20 raw `toLocaleDateString`/`toLocaleString` calls and 20 raw
   `toFixed(2)` money renders remain outside it.

---

## 7. Tests, CI, deployment

**11 suites** in `tests/`: `custody-machine`, `enrollment-import`, `family-enrollment`,
`payment-idempotency`, `payment-verification`, `security-regression`, `staff-parent`,
`stock-idempotency`, `teacher-distribution`, `tenant-isolation`, `test-superuser`.
Plus `script/smoke-boot.ts` (production entry path + `/api/health`).

`.github/workflows/ci.yml` has two jobs:

- **verify** — `tsc --noEmit` → `test:smoke` → `build` → `test:custody`
- **integration** (`needs: verify`) — Postgres 16 service, `db:push --force`, applies
  `migrations/00[2-9]*.sql` (**`001` deliberately skipped**), boots the API, seeds, then runs all
  ten DB-backed suites including a **second seeded tenant** for `test:tenant`.

Deployment: push `main` → Vercel → `www.scholarshelf.co.uk`. `vercel.json` sets the 30 s function
limit, the cron, SPA rewrites and a full security-header block — **including a
`Content-Security-Policy` header that competes with the one helmet sets in `server/app.ts`**.

---

## 8. Documentation surface

**29 Markdown documents at the repository root, 9,463 lines**, plus 8 in the Claude project.
Several describe the same subject from different dates (`SECURITY_REVIEW.md` /
`SCHOLARSHELF_SECURITY_REVIEW.md` / `DEFENSIVE_SECURITY_DESIGN.md` /
`EDUBOOK_AUTH_SECURITY_AUDIT.md` / `EDUBOOK_TENANT_ISOLATION_AUDIT.md`). `PROJECT_MASTER.md`
(320 lines) is the intended single source of truth and is **already out of date** — it lists 29
tables where 41 exist, describes 18 route files where 19 exist, and states "no migration files"
where seven now exist.

This is itself a finding: the documentation layer has the same duplicate-generations problem as the
UI, and Stage 22 should treat it as a domain to consolidate.
