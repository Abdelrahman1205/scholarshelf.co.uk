# CODEBASE_ARCHITECTURE.md — Stage 13: Physical Application & Repository Architecture

```
STAGE 13 — PHYSICAL APPLICATION & REPOSITORY ARCHITECTURE
STATUS: LOCKED
Written: 29 August 2026
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
Owner questions: 0. Corrections 1–8 of owner review applied and recorded.
Active new conflict: C-74. C-75 WITHDRAWN as duplicative of C-42.
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` · `TECH_STACK.md` · `SYSTEM_ARCHITECTURE.md` — **Stages 1–12, all LOCKED.**

**Repository evidence, read directly on 29 August 2026** at `C:\dev\scholarshelf` — `client/`,
`server/`, `shared/`, `api/`, `tests/`, `vercel.json`, `package.json`, and the specific files cited
throughout §3 and §38.

---

## 1. Purpose and stage boundary

Stage 13 answers one question:

> **How should the one coherent ScholarShelf application be physically organised in the repository and
> application code so that the locked modules, surfaces, trust boundaries, authority model and
> transactions are enforceable and maintainable?**

Stage 12 established:

```
ONE SCHOLARSHELF APPLICATION
        +
STRONG INTERNAL MODULE BOUNDARIES
        +
MANAGED EXTERNAL DEPENDENCIES
```

Stage 13 turns that into repository structure, physical application boundaries, frontend surface
structure, backend module structure, application orchestration, persistence ownership, routing
organisation, dependency rules, component and token structure, and the physical separation of the
public school website from the authenticated application.

**Stage 13 is the first stage permitted to decide physical code and repository architecture. It still
implements none of it.**

### 1.1 What Stage 13 does not decide

| Not decided here | Owner |
|---|---|
| Endpoint URLs · HTTP verbs · request/response schemas · error JSON shapes | **Stage 14** |
| Tables · columns · indexes · foreign keys · RLS policies · SQL · migration contents · session-record columns | **Stage 15** |
| Permission algorithms · revalidation timing · Argon2 parameters · TOTP mechanics · CSRF · rate limiting · upload scanning · signed-URL duration | **Stage 16** |
| Object-storage provider · email provider details · payment provider · webhook signature mechanism | **Stage 17** |
| Scale thresholds · cache tuning · `staleTime` values · performance budgets | **Stage 18** |
| Audit record schema | **Stage 19** |
| Test strategy and coverage | **Stage 20** |
| Deployment pipeline · region configuration · release gating | **Stage 21** |
| Migration execution order · which duplicate legacy implementation survives | **Stage 22** |

### 1.2 The release boundary is unchanged

**Stage 13 approval ≠ production security clearance ≠ legal sign-off.** The BytHub Legal & Compliance
deployment halt and production go-live block of 23 August 2026 stands in full. Nothing in this
document clears it, and no compliance claim is made here.

### 1.3 Nothing was changed

**No code was written or modified. No file was moved. No folder was created in the repository. No
dependency was installed. No route, schema, migration, authentication path, CI configuration or
deployment configuration was altered. No `tsconfig` was written, no lint rule was configured, no
public site was implemented, no storage migration was performed, no Vercel setting was touched.** Every path named in this document as a *target* does not yet
exist; every path named as *current* was read as evidence.

---

## 2. Codebase architecture principles

**CA-P1 — A boundary that is not visible in the import graph is not a boundary.** Every locked
architectural boundary must correspond to a physical one: a directory, a module entry point, a build
target, or a type that cannot be constructed elsewhere. Discipline written in a comment is not a
boundary — `server/config/database.ts` already carries the comment *"imported by repositories, NOT by
routes"*, and eight route files import database access directly anyway.

**CA-P2 — Transport carries no business truth.** A route handler receives a request, resolves
identity and authority, invokes one named operation, and maps a result to HTTP. It computes nothing,
mutates nothing, and reaches no table.

**CA-P3 — A module owns its own persistence.** Each of MOD-001…MOD-014 owns the data access for its
own facts. No module reads or writes another module's tables. There is no shared persistence layer
that every module passes through.

**CA-P4 — Cross-module business acts are orchestrated explicitly, in a named place.** A file per
business act, named for the act. The orchestrator owns sequencing and transaction scope and nothing
else (Stage 12 §16.1).

**CA-P5 — Public and authenticated entry points are physically distinct build targets.** Not two
routes in one bundle. Under AQ-1 = B the public school website is its own application entry with its
own build output and no resolvable import path into authenticated code.

**CA-P6 — Shared code is shared because it is safe, not because it is convenient.** `shared/` and
`apps/common/` admit only material that is genuinely safe on both sides of a trust boundary. A
"helpers" file is a symptom, not a location.

**CA-P7 — Authority vocabulary is common; authority enforcement is server-side.** The 95 capability
identifiers are one shared list so navigation and authorisation cannot drift. Navigation *presents*
using them. The server *decides* using them. Route existence is never authorisation.

**CA-P8 — Scope is a value, never an absence.** Tenant scope is a required, typed argument. A missing
scope is a compile error, never a query across every tenant.

**CA-P9 — Ownership is proven by type, not remembered by a developer.** A client-supplied identifier
is a *claim*. An operation accepts only a *resolved* resource, which can only be produced by the
owning module's resolver under a scope.

**CA-P10 — Transaction-capable paths are nominally distinct.** The read handle and the transactional
handle are different types. Opening a transaction on the wrong one is a compile error, not a runtime
surprise. This principle exists because the current code cannot express the difference (**C-74**).

**CA-P11 — Test substitutes may replace infrastructure, never business semantics.** Tests use
factories against a real PostgreSQL. There is no second implementation of the product's rules.

**CA-P12 — External providers sit behind gateways.** A business module expresses intent — *this
delivery is eligible*, *this file is accepted*. It never names Resend, S3 or a payment provider.

**CA-P13 — Reporting is a leaf.** MOD-010 may import operational read interfaces. No operational
module may import MOD-010. The import graph makes the wrong direction impossible, not merely
discouraged.

**CA-P14 — The target must be reachable incrementally.** Every boundary introduced here can be
adopted one module, one surface or one route group at a time, with legacy and target structures
coexisting. No arrangement is acceptable that requires ~50,200 lines to move before the application
runs.

**CA-P15 — As few layers as the architecture needs, and no more.** A module gets a second file when it
has a second responsibility, not because a pattern says it should. Directories that would hold one
file are not created.

---

## 3. Current repository map

Read directly, 29 August 2026.

```
scholarshelf/
├── api/index.ts                       one Vercel function; vercel.json maxDuration 30
├── client/
│   └── src/
│       ├── App.tsx                    190 lines — the whole router
│       ├── main.tsx
│       ├── index.css                  260 lines — TWO token systems in one @theme block
│       ├── components/
│       │   ├── layout.tsx             635 lines — role-keyed navigation registry
│       │   ├── query-state.tsx        126 lines — EXISTS, adoption 0 of 42 pages
│       │   ├── public-footer.tsx
│       │   └── ui/                    56 shadcn primitives (+ material-symbol.tsx)
│       ├── hooks/                     use-auth · use-mobile · use-toast
│       ├── lib/
│       │   ├── branding.ts            writes --primary / --ring from school hex
│       │   ├── errors.ts              describeApiError — used by 4 page files
│       │   ├── format.ts              7 formatters
│       │   ├── queryClient.ts         staleTime: Infinity
│       │   ├── role-routes.ts         34 lines — role → default route
│       │   ├── utils.ts
│       │   └── features/{auth,books,payments}/   ALL THREE EMPTY
│       └── pages/
│           ├── admin.tsx              143 lines — 31-entry section switch
│           ├── admin/                 28 files, 10,236 lines (incl. owner.tsx 1,208)
│           ├── teacher.tsx            1,010 · parent.tsx 1,489 · finance.tsx 962
│           ├── school-public.tsx      210 — the public site, as an SPA route
│           └── login · register · accept-invite · forgot/reset-password ·
│               security · privacy · contact · not-found
├── server/
│   ├── app.ts                         323 — express wiring; mounts /uploads publicly
│   ├── index.ts · vite.ts · static.ts
│   ├── storage.ts                     3,532 lines · ~305 methods · all domains
│   ├── storageProvider.ts             object-storage seam; default driver = data-uri
│   ├── branding.ts · email.ts         19 send* functions, imported by 12 files
│   ├── custody.ts · mfa.ts · paymentIntegration.ts
│   ├── config/                        database.ts · consoleDb.ts · env.ts
│   ├── console/                       audit.ts · operations.ts
│   ├── core/                          constants.ts · errors.ts (10 AppError classes)
│   ├── middleware/                    auth.ts 1,108 lines · test-superuser.ts
│   ├── repositories/drizzle/          EMPTY
│   ├── routes/                        19 files; 8 import Drizzle or schema directly
│   └── services/
│       ├── enrollment-import/         8 files — coordinator + collaborators
│       └── payment-verification/      5 files — same shape
├── shared/                            schema.ts 1,166 · academic-year · enrollment-import ·
│                                      test-superuser
├── migrations/  ·  tests/ (11 flat .ts run by tsx)  ·  script/  ·  utils/
└── drizzle.config.ts · vite.config.ts · vercel.json · tsconfig.json
```

### 3.1 What the current tree already gets right

These are **verified good** and Stage 13 builds on them rather than replacing them.

| Evidence | Why it matters |
|---|---|
| `server/services/enrollment-import/` — a coordinator plus six focused collaborators, parsing server-side | **The target module shape already exists in this repository.** Stage 13 generalises a proven local pattern rather than importing a foreign one. |
| `server/services/payment-verification/` — the same shape, five files | Confirms the pattern is repeatable here, not a one-off. |
| `server/config/database.ts` — `getTxDb()` exists and is used at all four real transaction sites | The transaction-capable path is already *chosen* correctly; only its *type* is unsafe (**C-74**). |
| `server/core/errors.ts` — ten typed `AppError` classes | The error vocabulary exists; only the boundary that consumes it is missing. |
| `client/src/components/query-state.tsx` — complete, well-reasoned | The component exists; only adoption is missing (**C-32**). |
| `server/storageProvider.ts` — `StorageProvider` interface with a `data-uri` default driver | The object-storage gateway seam already exists in embryo. |
| `server/routes/*.ts` — 19 domain files, not one `routes.ts` | Transport is already split by domain; it is the *depth* of each handler that is wrong, not the file count. |
| `storage.ts:2218 confirmPayment` — `getTxDb().transaction` with a conditional claim-lock | **I-2 is correct today.** Stage 13 must make this shape structural, not replace it. |
| `layout.tsx` already models an `owner_support` navigation context | Support mode is already a distinct application state, not an afterthought. |

### 3.2 What the current tree gets wrong, physically

| Evidence | Locked requirement broken | Conflict |
|---|---|---|
| `App.tsx` routes by **role** — `/admin`, `/teacher`, `/parent`, `/finance` are four role shells with `AuthGuard allowedRoles={[...]}` | Stage 7 authority chain; Stage 9 work areas | C-40 · C-50 |
| `role-routes.ts` maps `owner`/`platform_admin` → **`/admin/owner`**; `owner.tsx` (1,208 lines) lives in `pages/admin/` | Stage 12 §5: Platform is not Core with a null school | **C-44** |
| `layout.tsx` `roleConfig: Record<role, {navItems}>` — a static per-role list, 635 lines | Capability-aware navigation | C-40 |
| `admin.tsx` — a 31-entry `Record<string, ReactNode>` plus five sequential `resolvedSection` reassignments | Route existence ≠ authorisation | C-40 |
| `school-public.tsx` is a lazy route inside the SPA; `vercel.json` rewrites `/(.*)` → `/index.html` | **AQ-1 = B**: rendered/static public delivery | — |
| `storage.ts` — 3,532 lines, ~305 methods, every domain | Module-owned persistence | **C-42** |
| Eight route files import `drizzle-orm` or `shared/schema` directly | Transport ✗→ persistence | C-42 |
| `schoolFilter(table, schoolId?)` returns `undefined` when absent | Scope is never an absence | **C-64** |
| `getDb()` is cast `as unknown as AppDatabase`, so it is **type-identical** to `getTxDb()` | Transaction-capable paths must be distinguishable | **C-74 — NEW** |
| `client/src/pages/admin/students.tsx:22` — `import * as XLSX from "xlsx"` in the browser | Server-only workbook parsing | C-58 |
| Twelve files import `server/email.ts` directly, eleven of them route files | Delivery behind MOD-015 | — |
| `index.css @theme inline` carries shadcn semantic tokens **and** Material Design 3 container/surface/outline tokens; `material-symbol.tsx` sits beside 61 Lucide files | One token system, one icon system | **C-54** |
| `lib/branding.ts` writes `--primary` and `--ring` from a school hex | Identity-only branding; canonical focus | C-52 · C-53 |
| `queryClient.ts` — `staleTime: Infinity` globally | Business truth must not be indefinitely stale | — |
| `server/repositories/drizzle/` and `lib/features/{auth,books,payments}/` are **empty**, while `database.ts` asserts a repository boundary that does not exist | A boundary asserted but absent is worse than none | **C-42** (evidence; C-75 withdrawn as duplicative — §43) |
| `tests/` — 11 flat scripts run by `tsx`, no framework | Test-support boundary | C-60 (Stage 11) |

---

## 4. Target repository at a glance

```
scholarshelf/
├── apps/                        ← FRONTEND BUILD TARGETS
│   ├── app/                     authenticated ScholarShelf SPA (Core · Studio · Platform)
│   ├── site/                    public school website — rendered/static delivery  [AQ-1 = B]
│   └── common/                  primitives genuinely safe on both sides
├── server/
│   ├── http/                    TRANSPORT ONLY — express bootstrap, route groups, error boundary
│   ├── access/                  session ≠ authority ≠ authorisation ≠ ownership resolution
│   ├── application/             cross-module business acts — orchestration + transaction scope
│   ├── modules/                 MOD-001…MOD-014 — operations + module-owned persistence
│   ├── gateways/                MOD-015 — email · object storage · payments · spreadsheet
│   └── platform/                db handles · observability · health · jobs runtime · config
├── shared/                      safe cross-boundary contracts ONLY
├── migrations/   tests/   script/
└── package.json · tsconfig*.json · vite.*.config.ts · vercel.json
```

**One repository. One npm package. One `node_modules`. One TypeScript configuration family.** There
are **no workspaces, no per-app `package.json`, no internal packages, no publishing**. `apps/` names two
*build targets*, not two projects. This is the deliberate answer to §3's warning about package
explosion: the only reason two frontend roots exist is that AQ-1 = B requires two delivery shapes, and
a directory named `client/` can no longer honestly name both.

---

## 5. Top-level source organisation

**APP-001 · Three source roots: `apps/`, `server/`, `shared/`**

*Problem:* the current `client/ · server/ · shared/` split cannot express AQ-1 = B, because there is
now more than one frontend, with a hard trust boundary between them.

*Locked requirements:* Stage 12 §4.2 (five deployment units), §5 (three bands plus a public edge),
AD-030 / AQ-1 = B.

*Current evidence:* `client/src/pages/school-public.tsx` is a lazy route in the same bundle as
`pages/admin/owner.tsx`; `vercel.json` rewrites every non-API path to `/index.html`.

*Decision:* **`server/` and `shared/` are preserved as names and roles. `client/` becomes `apps/`,
containing `app/`, `site/` and `common/`.**

*Physical structure:* as §4.

*Allowed dependencies:* `apps/app` → `apps/common`, `shared`. `apps/site` → `apps/common`, `shared`.
`server/**` → `shared`. Nothing in `server/**` imports from `apps/**`.

*Forbidden dependencies:* `apps/site` ✗→ `apps/app` (either direction). `apps/common` ✗→ either app.
`apps/**` ✗→ `server/**`.

*Consequences:* two Vite entries and two build outputs; a TypeScript configuration family with
per-scope projects (**APP-047**, §36); the SPA route `/school/:code` becomes legacy pending Stage 22.

*Conflicts affected:* enables the AQ-1 = B structure; no conflict resolved by itself.

*Later implementation owner:* **21** (how the two outputs are served). *Owner decision:* **NO.**

---

**APP-002 · `server/` is organised by responsibility, not by artefact kind**

*Problem:* `server/` currently mixes a 3,532-line god persistence file, transport, middleware,
infrastructure config and two well-shaped service directories at the same level.

*Locked requirements:* Stage 12 §6 (server authority), §15 (module interaction), §16.1 (command
ownership).

*Current evidence:* `server/storage.ts`, `server/middleware/auth.ts` (1,108 lines),
`server/config/database.ts`, `server/services/enrollment-import/` all siblings.

*Decision:* **six responsibility roots — `http` · `access` · `application` · `modules` · `gateways` ·
`platform`** — chosen so that the canonical request path of Stage 12 §7 reads top-to-bottom through
the directory names.

*Physical structure:*

```
server/
├── http/          receives · parses · delegates · maps to HTTP        (no business truth)
├── access/        who is signed in · what they may do right now       (no business truth)
├── application/   one file per cross-module business act              (no business truth)
├── modules/       MOD-001…MOD-014 — ALL business truth lives here
├── gateways/      MOD-015 — everything outside the business boundary
└── platform/      db handles · observability · health · job runtime   (no business truth)
```

*Allowed dependencies:* strictly downward, §35.
*Forbidden dependencies:* `modules` ✗→ `http`; `modules` ✗→ `application`; `modules` ✗→ `gateways`
(they express eligibility, §28); `gateways` ✗→ `modules`; `platform` ✗→ `modules` and ✗→ `gateways`
(it holds mechanics, never business sequencing — **APP-049**).
**`application/` is the one layer permitted to call a gateway**, and only from a named job handler
(**APP-049**, §28–§29).
*Consequences:* `storage.ts`, `middleware/auth.ts`, `routes/`, `config/`, `console/`, `services/` all
acquire target homes (§38).
*Conflicts affected:* C-42 · C-64 · C-66 · C-67 · C-70.
*Later owner:* **22** (movement). *Owner decision:* **NO.**

---

**APP-047 · One TypeScript configuration family, several project scopes**

*Problem:* the public/private compile boundary (CA-P5, APP-030) requires that `apps/site` **cannot
resolve** `apps/app` or `server/**`. A single `tsconfig.json` covering the whole tree cannot express
that — every path alias it declares is visible to every file it includes. But adopting workspaces or
per-app packages to get separate scopes would trade one problem for a much worse one.

*Locked requirements:* CA-P1 (a boundary must be visible in the import graph) · CA-P5 · APP-001 ·
APP-030. **Stage 11 is not reopened; TypeScript itself is unchanged.**

*Decision:* **one configuration family rooted in one base file, with a project scope per compile
boundary. Still one repository, one package, one `node_modules` — no workspaces, no per-app
`package.json`, no internal packages, no publishing.**

```
tsconfig.base.json          compiler options ONLY — strict, target, lib, module.
                            Declares NO path aliases, so it grants no reach to anything.
        │
        ├── tsconfig.app.json      include: apps/app · apps/common · shared
        │                          paths:  @app/* @common/* @shared/*
        │
        ├── tsconfig.site.json     include: apps/site · apps/common · shared/contracts · shared/format
        │                          paths:  @site/* @common/* @shared/*
        │                          ── CANNOT SEE apps/app. CANNOT SEE server/**.
        │
        └── tsconfig.server.json   include: server · shared
                                   paths:  @modules/* @access/* @application/*
                                           @gateways/* @platform/* @shared/*
```

`tsconfig.json` at the root references the three project scopes so a single `tsc` invocation still
checks everything. **Path aliases are declared per scope, never in the base**, which is what makes the
boundary real: an `import "@app/…"` inside `apps/site` has no alias to resolve and no file in
`include` to fall back to. It is not a lint warning. It does not compile.

*Physical structure:* four configuration files at the repository root. **The exact filenames are
proposed, not mandated** — any equally simple family with the same three scopes satisfies this
decision.

*Allowed dependencies:* as §35.
*Forbidden:* declaring a path alias in the base configuration; adding `apps/app` to the site scope's
`include` "temporarily"; npm workspaces; a per-app `package.json`.
*Consequences:* §36 mechanism 1 is this decision. `apps/common` is included by both app scopes and may
therefore import neither app — enforced by scope membership, not only by lint.
*Conflicts affected:* none directly; it is the mechanism behind APP-030 and CR-005.
*Later implementation owner:* **22** (writing the files). *Owner decision:* **NO.**

---

## 6. Application bands

Stage 12 §5 locked **Core · CMS · Platform · public edge**. Stage 13 makes each visible.

```
apps/
├── app/                         ONE authenticated SPA, THREE bands
│   ├── main.tsx
│   ├── app.tsx                  router — route table only, no guards inline
│   ├── shell/                   layout · capability-aware navigation composition
│   ├── access/                  useSession · useActiveContext · useCapability
│   └── bands/
│       ├── entry/               S-1  Entry & Account            (9 screens)
│       ├── school/              S-2  School Operations          (61 screens)
│       ├── family/              S-3  Family                     (10 screens)
│       ├── studio/              S-4  Website Studio             (5 screens)
│       └── platform/            S-6  BytHub Platform            (15 screens)
└── site/                        S-5  Public School Site — separate build target
```

**Why bands and not roles.** The current tree routes by role: four shells, four `allowedRoles` lists,
a per-role navigation registry. Stage 9 locked *surfaces and work areas*, and Stage 7 locked authority
as `capability × resource × scope × conditions`. A band is the physical unit of a **surface**; a role
is not a physical unit of anything. This single change is the structural cause of the C-40 and C-50
fixes.

### 6.1 Core — `bands/entry`, `bands/school`, `bands/family`

**APP-003 · `bands/school` is organised by Stage 9 work area, not by role**

*Problem:* `pages/admin/` (28 files) and `pages/finance.tsx` (962 lines) and `pages/teacher.tsx`
(1,010 lines) are three role shells over one surface. A `school_admin` holding AUTH-FINANCE cannot
reach Money without becoming a different role.

*Locked requirements:* Stage 9's nine admin work areas; PA-1 (`school_admin` + AUTH-FINANCE is ONE
context); Stage 12 §9.

*Current evidence:* `role-routes.ts` sends `finance` → `/finance`; `App.tsx` guards `/finance` with
`allowedRoles={["finance"]}`; `layout.tsx` `roleConfig.finance` is a separate navigation list.

*Decision:* **one `bands/school/` containing nine work areas. Money is a work area, not a shell.**

*Physical structure:*

```
apps/app/bands/school/
├── today/            Stage 9 · Today
├── school/                      · School
├── people/                      · People
├── books/                       · Books
├── requirements/                · Requirements
├── distribution/                · Distribution
│   └── handheld/                  teacher hand-over composition (DS-P10 / UX-P10)
├── money/                       · Money      — appears iff AUTH-FINANCE is active
├── insight/                     · Insight
└── administration/              · Administration
```

Each work area holds `routes.ts` (its route entries and required capabilities), `nav.ts` (its
navigation contribution), `queries.ts` (its query keys and invalidation), and its screen components.

*Allowed dependencies:* a work area → `apps/app/shell`, `apps/app/access`, `apps/common`, `shared`.
*Forbidden dependencies:* a work area ✗→ another work area's internals (only its exported components);
`bands/school` ✗→ `bands/platform`.
*Consequences:* Money's visibility is derived from effective capability reach, in one place; no finance
mode, no role switch, no second shell, no second login. The teacher hand-over keeps its own
composition inside `distribution/` rather than inheriting admin desktop tables.
*Conflicts affected:* **C-50 — TARGET ARCHITECTURE RESOLVED, IMPLEMENTATION OPEN** (Money is a work
area under school context, capability-derived; implementation Stage 22) · C-40 · C-51 (Stage 9).
*Later owner:* **22** (which existing finance/teacher implementation moves in). *Owner decision:* **NO.**

---

**APP-004 · `bands/family` is child-scoped, with no global school selection**

*Problem:* a family may span schools. Any frontend built around a single `selectedSchool` is wrong for
S-3 before a line of it is written.

*Locked requirements:* SC-4 relationship-derived scope; Stage 12 §12 (four scope bases); Stage 9 S-3.

*Current evidence:* `pages/parent.tsx` is 1,489 lines in one file; guardian-relationship scoping is
correct on the server today and is a **preserve** item.

*Decision:* **`bands/family` resolves scope through the child, per operation. There is no
school-selection state in the family band at all** — no context provider, no store, no query key
component.

*Physical structure:* `bands/family/{children,books,payments,messages,account}/`, each keyed by child.
*Allowed dependencies:* `apps/app/access` (session and relationship reach only), `apps/common`, `shared`.
*Forbidden dependencies:* ✗→ any school-scoped hook, selector or context from `bands/school`.
*Consequences:* the parent surface can hold children at two schools without a mode switch.
*Conflicts affected:* C-48 (Stage 9, order-shaped family UI) gains a physical home for its fix.
*Later owner:* **22**. *Owner decision:* **NO.**

### 6.2 CMS Studio — `bands/studio`

**APP-005 · Website Studio is a Core-styled band inside the authenticated application**

*Locked requirements:* AQ-1 = B; Stage 12 §5.4 and §24; MA-2 (MOD-001 owns entitlement, MOD-011 owns
content); Stage 10 §3.4 (branding is identity-only).

*Current evidence:* `pages/admin/{website,it-dashboard,media-library}.tsx` sit inside the admin shell;
`admin.tsx` redirects IT personnel into `website` and school admins away from it.

*Decision:* **`bands/studio` is its own band, styled by the canonical ScholarShelf operational design
system.** A school's published website theme has **no write path** into the Studio's own presentation:
public theme values live in a separate variable namespace consumed only by `apps/site` (§11).

*Physical structure:* `bands/studio/{overview,pages,news,events,media,presentation,contact,publish}/`.
*Allowed dependencies:* `apps/app/access`, `apps/common`, `shared`.
*Forbidden dependencies:* ✗→ `bands/school/{money,people,requirements,distribution}`; ✗→ anything that
reaches settlement, stock, custody, families or children. The Studio edits a website; it has no
operational reach — the physical expression of Stage 12 §24.
*Conflicts affected:* preserves the verified-good CMS server boundary.
*Later owner:* **15** (content model) · **22**. *Owner decision:* **NO.**

### 6.3 Platform — `bands/platform`

**APP-006 · Platform is its own band, never the school shell with a null school**

*Problem:* the platform owner's 1,208-line dashboard lives at `client/src/pages/admin/owner.tsx` and
is reached at `/admin/owner`. Platform is physically inside Core today.

*Locked requirements:* Stage 12 §5 and §25; **C-44**.

*Current evidence:* `role-routes.ts` `case "owner": return "/admin/owner"`; `admin.tsx` maintains an
`ownerOnlySections` set inside the school shell and reassigns `resolvedSection` four times to keep the
two personas apart in one component.

*Decision:* **`bands/platform` has its own shell, its own navigation, its own route group and its own
default entry.** It shares `apps/common` primitives and nothing else with `bands/school`.

*Physical structure:*

```
apps/app/bands/platform/
├── shell/               platform navigation — NOT the school navigation
├── tenants/             schools · onboarding · pending setups
├── operations/          activity · email status · system health
├── support/             §6.4 — support-mode entry and exit
└── break-glass/         §6.5 — exceptional operations, outside ordinary navigation
```

*Allowed dependencies:* `apps/common`, `shared`, `apps/app/access`.
*Forbidden dependencies:* **✗→ `bands/school` except through `support/`** (§6.4). No school-customer
assumption — a selected school, a school branding hook, a tenant-scoped query key — may be imported
into `bands/platform` outside `support/`.
*Consequences:* the `ownerOnlySections` reassignment chain in `admin.tsx` disappears; it exists only
because the two bands share one component.
*Conflicts affected:* **C-44 — TARGET ARCHITECTURE RESOLVED, IMPLEMENTATION OPEN** (Platform has its
own application band; implementation Stage 22).
*Later owner:* **22**. *Owner decision:* **NO.**

### 6.4 Support mode

**APP-007 · Support mode is an explicit application transition with a single entry point**

*Locked requirements:* Stage 12 §25; PA-2 (account recovery requires support mode); Stage 7 named-school
scope.

*Current evidence:* `layout.tsx` already carries an `owner_support` navigation context and `admin.tsx`
reads `user.supportMode.active` — the concept exists and is worth preserving.

*Decision:* **`bands/platform/support/` is the only place school-band components may be composed from
the Platform band, and it may compose them only inside an active support engagement.**

*Physical structure:*

```
PLATFORM  →  support/engage        named school · reason · audited
                  ↓
          support/SupportBoundary  provides named-school context to reused school components
                  ↓
             reused bands/school components — unchanged, unaware
                  ↓
          support/exit             audited
```

*Allowed dependencies:* `support/` → `bands/school` **components only**, never `bands/school` queries
or navigation. The scope reaching those components comes from `SupportBoundary`, not from a school
session.
*Forbidden dependencies:* nothing outside `support/` may import `bands/school` from the Platform band.
*Consequences:* school UI is reused rather than duplicated, and reuse cannot bypass support context
because the components receive their scope from the boundary that wraps them.
*Conflicts affected:* preserves context-switch validation and audit (verified good).
*Later owner:* **16** (elevation mechanics) · **19** (audit record). *Owner decision:* **NO.**

### 6.5 Break-glass

**APP-008 · Exceptional owner operations live outside ordinary Platform navigation**

*Decision:* **`bands/platform/break-glass/` is not reachable from the Platform navigation registry.**
Its components are not exported from the band's index, so they are not casually importable into normal
operations. It shares `apps/common` primitives.
*Consequences:* the physical arrangement makes accidental reuse of an elevated operation awkward by
construction.
*Later owner:* **16** (elevation mechanics). *Owner decision:* **NO.**

### 6.6 The privileged database boundary — CAP-089

**APP-009 · Bounded investigation is internal Platform tooling; arbitrary SQL is not target
architecture**

*Locked requirements:* Stage 12 §26 — *the boundary is privilege, not syntax*; CAP-089 stays,
arbitrary application-privileged SQL does not; **C-73** (the console's controls depend on a migration
CI skips).

*Current evidence:* `pages/admin/db-console.tsx` (606 lines) sits in the school-admin pages folder;
`server/console/{audit,operations}.ts` and `server/config/consoleDb.ts` implement the tiering and the
least-privilege pool — genuinely good work that is preserved.

*Decision:* **the investigation capability moves to `bands/platform/operations/investigate/`, served by
`server/modules/platform-ops/investigation/` over the existing least-privilege console pool. Database
administration proper stays outside the application.** The arbitrary-SQL surface is marked LEGACY and
removed in Stage 22, not here.
*Consequences:* the console leaves the school band, which is where C-44 put it by accident.
*Conflicts affected:* C-73 gains an implementation home; **not resolved here** — it is resolved when the
migration is applied and gated (Stage 21).
*Later owner:* **15** (roles) · **16** (privilege) · **21** (migration gating) · **22** (removal).
*Owner decision:* **NO.**

---

## 7. Frontend architecture

```
apps/app/
├── main.tsx                     mounts providers
├── app.tsx                      route table — composed from band route contributions
├── shell/
│   ├── AppShell.tsx             layout frame
│   ├── navigation.ts            COMPOSES nav from band contributions + capability reach
│   └── identity.tsx             school identity band (the only branded region)
├── access/
│   ├── useSession.ts            who is signed in.   NO role field on the returned type.
│   ├── useActiveContext.ts      live authority + scope, from the server, per session
│   └── useCapability.ts         presentation-only capability check
├── bands/{entry,school,family,studio,platform}/
└── (imports apps/common for primitives)
```

**APP-010 · Navigation is composed from capability reach, never enumerated per role**

*Problem:* `layout.tsx` holds `roleConfig: Record<string, {label, navItems}>` — six hand-maintained
per-role lists, 635 lines. Adding an authority means editing a list; forgetting means a surface is
invisible to someone entitled to it.

*Locked requirements:* Stage 7 chain; Stage 9 work areas; CA-P7; **C-40**, **C-50**.

*Decision:* **each work area contributes its own `nav.ts` entry declaring the capability that makes it
reachable. `shell/navigation.ts` composes the visible navigation by intersecting contributions with
the active context's capability reach.** No role appears in navigation code.

```
BAND / WORK AREA nav contributions        ACTIVE CONTEXT (from server)
   { label, href, capability: CAP-nnn }        capabilities: Set<CAP-*>
                    \                            /
                     shell/navigation.ts  ── intersect ──▶  visible navigation
```

*Allowed dependencies:* `shell/navigation.ts` → band `nav.ts` files, `shared/capabilities`.
*Forbidden dependencies:* navigation ✗→ any role string; navigation ✗→ any band's screen components.
*Consequences:* `school_admin` + AUTH-FINANCE sees Money because the capability is in reach — no mode,
no switch, no second shell. **This is presentation only; the server decides (CA-P7).**
*Conflicts affected:* **C-40** (client half) · **C-50 resolved.**
*Later owner:* **16** (how reach is computed). *Owner decision:* **NO.**

---

## 8. Routing and navigation architecture

**APP-011 · Routes are explicit, declared per work area, and separate from authorisation**

*Problem:* `App.tsx` has four role-guarded catch-all routes (`/admin/:section?` and three siblings),
and `admin.tsx` resolves 31 sections through a `Record<string, ReactNode>` plus five reassignments.
Route existence, role gating and section resolution are one tangle.

*Locked requirements:* Stage 9 experience architecture; Stage 11 (Wouter is not the problem);
CA-P7; **C-40**.

*Decision:* **each work area exports explicit route entries. `app.tsx` concatenates them. There is no
`:section?` catch-all and no section switch.** URLs follow experience architecture — **they do not
mirror MOD-001…MOD-015.**

*Target route groups:*

```
apps/app        /                      entry · account · auth              bands/entry
                /school/*              nine work areas                     bands/school
                /family/*              child-scoped                        bands/family
                /studio/*              Website Studio                      bands/studio
                /platform/*            BytHub Platform · support · break-glass
apps/site       /  and school-resolved paths                               §25
```

*Allowed dependencies:* `app.tsx` → band `routes.ts` files only.
*Forbidden dependencies:* `app.tsx` ✗→ any screen component directly; no `allowedRoles` array anywhere.
*Consequences:* a route entry declares the capability that *presents* it. **Route existence is never
authorisation** — every screen's data still passes server authorisation, exactly as `AuthGuard`'s own
comment already acknowledges today.
*Conflicts affected:* C-40 (client half).
*Later owner:* **14** (server API routes — not decided here) · **22**. *Owner decision:* **NO.**

---

## 9. UI and component hierarchy

**APP-012 · Four levels, and only four**

```
1  PRIMITIVES        apps/common/ui/            Button · Dialog · Table · Form controls
                                                 (the 56 shadcn components, moved)
2  PRODUCT PATTERNS  apps/common/patterns/      PageHeader · QueryState · EmptyState ·
                                                 ErrorState · DataTable · FilterBar
3  DOMAIN COMPONENTS bands/<band>/<area>/       SettlementDecision · ChildHandover ·
                                                 ReplacementReview · BookRequirementSummary
4  SCREENS           bands/<band>/<area>/       one file per Stage 9 screen
```

*Decision rule for level 2 vs level 3:* a component belongs in `apps/common/patterns/` only if it
carries **no domain vocabulary**. `SettlementDecision` is reused in three places and still does **not**
belong in shared — reuse count is not the test; domain-freedom is. This is the explicit answer to §38
of the Stage 13 brief.

*Consequences:* `pages/admin/shared.tsx` (84 lines) and the ad-hoc reuse it represents get a real home;
finance's higher information density is expressed by finance-owned level-3 compositions in
`bands/school/money/`, not by bending a shared table (Stage 10 density contracts preserved).
*Later owner:* **22**. *Owner decision:* **NO.**

---

## 10. Query, state and error architecture

**APP-013 · `QueryState` is the only sanctioned path from a query to rendered content**

*Problem:* `components/query-state.tsx` exists, is well-reasoned, and has **zero adopters** across 42
page files. `queryClient.ts` sets `retry: false` for anything with a status, so one dropped request on
school wifi is final — and a page with no error branch renders its empty state as fact.

*Locked requirements:* Stage 10's four states — **LOADING · ERROR · EMPTY · REAL ZERO**; **C-32**.

*Decision:* **the component moves to `apps/common/patterns/QueryState.tsx` and becomes structural: a
screen may not destructure `data` from a query directly.** Real zero and empty are distinct props, so
"no results" and "nothing exists yet" cannot collapse into each other, and **failure never renders as
zero**.

*Enforcement:* a lint rule forbidding `const { data } = useQuery(...)` inside `apps/app/bands/**`, plus
a CI check. §36.
*Conflicts affected:* **C-32** — architecture resolved here; adoption is Stage 22.
*Later owner:* **22** (screen-by-screen adoption). *Owner decision:* **NO.**

---

**APP-014 · Query keys and invalidation are declared per work area, not inlined**

*Problem:* `staleTime: Infinity` globally. Business truth is cached until the tab closes. The audit
found dangerously stale frontend state; this is its physical cause.

*Decision:* **each work area owns `queries.ts` declaring its query keys and, for every mutation, the
keys it invalidates. Queries declare a freshness class rather than a number.**

```
AUTHORITATIVE   settlement · stock · custody · allocations   must be fresh after any mutation
REFERENCE       catalogue · classes · book levels            may be cached briefly
STATIC          school identity · published website content  may be cached for long periods
```

**A successful mutation makes the relevant authoritative reads fresh.** That is the architectural rule.
**The numeric `staleTime` for each class is Stage 18**, which owns performance tuning. What is decided
here is that *infinite stale business truth is not the architecture*.

*Consequences:* the global `staleTime: Infinity` default is replaced by per-class defaults; TanStack
Query remains the only server-state technology; **no new global state library is introduced**, and
settlement, stock and custody truth is never duplicated into a client store.
*Later owner:* **18** (values). *Owner decision:* **NO.**

---

**APP-015 · Errors cross one boundary, in one place, in each direction**

*Problem:* ~160 handlers return `e.message` to clients. `server/core/errors.ts` already defines ten
typed `AppError` classes; nothing consumes them at the edge.

*Locked requirements:* Stage 12 §28; **C-70**.

*Decision:*

```
server/modules/**      throw a typed AppError            (server/core/errors.ts — KEEP)
        ↓
server/http/error-boundary.ts   THE ONLY place an error becomes a response.
                                Classifies · logs internally with a correlation id ·
                                emits a safe classification. Route handlers never format errors.
        ↓  network
apps/common/errors.ts           classifies the response      (from client/src/lib/errors.ts — KEEP)
        ↓
apps/common/patterns/QueryState presents it                  (Stage 10 contract)
```

*Forbidden:* a `try/catch` in a route handler that builds a response body from a caught error. A route
handler may catch only to add context and rethrow.
*Consequences:* internal detail cannot reach a client through a path that does not exist.
**Stage 14 defines the API error contract; Stage 16 owns sanitisation.** Stage 13 fixes only *where the
responsibility lives*.
*Conflicts affected:* **C-70** — responsibility placed; ~160 call sites are Stage 22.
*Later owner:* **14** · **16** · **22**. *Owner decision:* **NO.**

---

**APP-016 · One formatting home, presentation only**

*Decision:* **`shared/format/` — money, UK dates, date-time, numbers, academic periods.** Placed in
`shared/` rather than `apps/common/` because the server formats the same values into emails, and two
implementations would drift.

*Current evidence:* `client/src/lib/format.ts` already has seven of these — **KEEP**, move, extend.
*Forbidden:* a formatter must not compute business truth. It converts an already-decided value into
text. No totalling, no proration, no status derivation.
*Conflicts affected:* **C-33.**
*Later owner:* **22**. *Owner decision:* **NO.**

---

## 11. Design-token and branding architecture

**APP-017 · One token layer, one icon set, light only**

*Problem:* `index.css` `@theme inline` contains the shadcn semantic tokens **and** a Material Design 3
set (`--color-primary-container`, `--color-surface-container-*`, `--color-outline*`,
`--color-tertiary-fixed`, …). `components/ui/material-symbol.tsx` renders Material Symbols beside 61
files importing Lucide. `@custom-variant dark` and a full `.dark` palette exist and are unreachable.

*Locked requirements:* Stage 10 — one token system (shadcn/Tailwind semantic CSS variables), one icon
system (Lucide), **light only** (DSQ-1 = A), branding **identity-only** (DSQ-2 = A), canonical navy
primary, canonical focus. **C-52 · C-53 · C-54 · C-55.**

*Decision:*

```
apps/common/theme/
├── tokens.css        THE semantic layer. Light only. Canonical ScholarShelf navy primary.
├── brand.css         --brand-* ONLY. A disjoint namespace.
└── branding.ts       applyBranding(values: BrandIdentityValues): void
```

*Physical structure — the structural fix.* `BrandIdentityValues` is a closed type whose keys are
**only** `--brand-*` identity variables. `applyBranding` accepts nothing else, so a school colour
**cannot** be written to `--primary`, `--ring`, `--destructive`, `--warning`, `--success`, or any
state, pending, disabled, support-mode, elevation or query-state token. This is not a rule a reviewer
enforces; it is a function signature.

*Current evidence:* `client/src/lib/branding.ts:93-119` sets `--primary`, `--ring`, `--secondary` and
`--accent` from a school hex with no contrast validation. **That file becomes LEGACY.**

*Icons:* `apps/common/icons.ts` re-exports Lucide and is the only sanctioned icon import.
*Light only:* new components are designed with no dark-mode abstraction. **The `.dark` palette,
`@custom-variant dark`, the MD3 token block and `material-symbol.tsx` are LEGACY and are NOT removed
here** — Stage 10 said not to remove them and Stage 22 owns removal.
*Enforcement:* lint bans `lucide-react` alternatives, bans importing `material-symbol`, bans `dark:`
utility classes in `apps/**` new code, and bans any assignment to a semantic variable outside
`tokens.css`.
*Conflicts affected:* **C-52 · C-53 · C-54 · C-55** — architecture resolved; legacy removal is Stage 22.
*Later owner:* **22**. *Owner decision:* **NO.**

---

## 12. Backend architecture

```
server/
├── http/
│   ├── server.ts              express bootstrap                (from app.ts)
│   ├── middleware/            session cookie · body · CORS · rate limit transport
│   ├── routes/                one file per route group — TRANSPORT ONLY
│   └── error-boundary.ts      THE error edge (APP-015)
├── access/
│   ├── session.ts             authentication continuity        → Principal { userId }
│   ├── authority.ts           live authority + scope           → ActiveContext
│   ├── authorise.ts           capability × resource × scope × conditions
│   └── resolve.ts             ClaimedId → Resolved<T>          (APP-021)
├── application/               one file per cross-module business act
├── modules/                   MOD-001…MOD-014
├── gateways/                  MOD-015
└── platform/
    ├── db/                    getReadDb · withTransaction · console pool
    ├── observability/         logger · correlation · error tracking
    ├── health/                liveness · readiness · dependency probes
    ├── jobs/                  the executor
    └── config/                env (from server/config/env.ts — KEEP)
```

---

## 13. Transport boundary

**APP-018 · A route handler does five things and no sixth**

*Locked requirements:* Stage 12 §7 canonical request path; CA-P2.

*Decision:* every handler is:

```
1  receive the request
2  parse transport input                    (shape only — not business validation)
3  resolve session → live authority → authorisation
4  invoke ONE named operation or use case
5  map the result to HTTP
```

*Forbidden in `server/http/**`:* settlement calculation · stock mutation · business status transitions ·
tenant ownership rules · email delivery · audit construction · **any Drizzle query builder** · **any
import of `shared/schema` table definitions** · cross-module transaction sequencing.

*Current evidence:* eight of nineteen route files import `drizzle-orm` or `shared/schema` today —
`auth`, `book`, `cron`, `family-enrollment`, `mfa`, `notification`, `user`, `website`. Eleven route
files import `server/email.ts` directly.

**Endpoint URLs and verbs are not decided here. That is Stage 14.** §12's `routes/` names route
*groups*, not paths.

*Conflicts affected:* C-42 (transport half) · C-70.
*Later owner:* **14** · **22**. *Owner decision:* **NO.**

---

**APP-019 · Transport cannot reach persistence — enforced, not requested**

*Decision:* three mechanisms, together:

1. **`shared/schema` table definitions may be imported only by `server/modules/*/data.ts`.** Validation
   contracts the client also needs move to `shared/contracts/` (Stage 15 owns the schema file itself).
2. **`server/platform/db` exports no query builder to `http/`.** Its public entry gives handles to
   `modules/` and `application/` only.
3. **A lint boundary rule** (§36) failing any `drizzle-orm` import under `server/http/**`.

*Consequences:* the comment in `server/config/database.ts` — *"imported by repositories, NOT by
routes"* — becomes true for the first time. Today it is contradicted by eight files: evidence of
**C-42**, and the reason the proposed C-75 was withdrawn as duplicative of it (§43).
*Conflicts affected:* C-42.
*Later owner:* **22**. *Owner decision:* **NO.**

---

## 14. Authentication and live-authority physical boundary

**APP-020 · `Principal` has no role. Authority is resolved live, in a different file.**

*Problem:* `req.session.role` is set at sign-in and read as authority thereafter. A revoked authority
survives in an active session.

*Locked requirements:* Stage 12 §8 — **session ≠ authority**; SA-P5; **C-67**.

*Current evidence:* `server/middleware/auth.ts` is 1,108 lines and holds session continuity, role
checks, tenant-activity checks, rate limiting, audit logging, `routeParam`, and multer upload config
in one file. Its `ensureSessionSchoolIsActive` is **verified good** and is preserved exactly.

*Decision:* **split `auth.ts` by responsibility, and make the split load-bearing in the type system:**

```
server/access/session.ts     → Principal { userId: string }
                                ── deliberately has NO role, NO schoolId, NO capabilities.
                                   session.role is not readable as authority because the
                                   type does not carry it.

server/access/authority.ts   → ActiveContext {
                                   principal, context, authorities,
                                   capabilities: ReadonlySet<Capability>,
                                   scope: Scope
                                }
                                ── resolved per request from current state.
                                   Retains ensureSessionSchoolIsActive's fail-closed
                                   behaviour verbatim (PRESERVE).
```

*Allowed dependencies:* `authority.ts` → `modules/identity` (MOD-002), `modules/tenancy` (MOD-001).
*Forbidden dependencies:* `session.ts` ✗→ any module. `http/**` ✗→ `session.ts` internals; handlers
receive `ActiveContext`, never a raw session.
*Consequences:* rate limiting, audit logging and multer configuration leave `auth.ts` for
`platform/`, `modules/audit/` and `gateways/storage/` respectively — the 1,108 lines were four
responsibilities in one file.
**Revalidation timing is Stage 16.** Stage 13 decides only that the boundary exists physically.
*Conflicts affected:* **C-67** — boundary placed; timing and mechanism Stage 16.
*Later owner:* **16** · **22**. *Owner decision:* **NO.**

---

## 15. Authorisation boundary

**APP-021 · One capability vocabulary, one authorisation call site shape**

*Problem:* `requireRole(...)` is role-keyed. Stage 7 locked `capability × resource × scope ×
conditions`.

*Decision:* **`shared/capabilities.ts` declares the 95 CAP-* identifiers as one const union**, imported
by `server/access/authorise.ts` (authority) and by band `nav.ts`/`routes.ts` files (presentation).

```
shared/capabilities.ts          CAP-001 … CAP-095   ONE list
        ├──▶ server/access/authorise.ts     AUTHORITY      — decides
        └──▶ apps/app/**/nav.ts, routes.ts  PRESENTATION   — displays
```

*Forbidden:* any role string in an authorisation decision; any client-side capability check treated as
a permission; duplicating the capability list on either side.
**The permission algorithm — how conditions CD-1…CD-12 evaluate, how scopes SC-1…SC-12 resolve — is
Stage 16.** Stage 13 places the vocabulary and the call-site shape only.
*Conflicts affected:* **C-40** — vocabulary and boundary placed.
*Later owner:* **16** · **22**. *Owner decision:* **NO.**

---

**APP-022 · Resource ownership is proven by type, in the owning module**

*Problem:* `assertStudentInSchool`, `assertBookInSchool`, `assertClassInSchool`,
`assertBookLevelInSchool` exist at 18 call sites — real and good — but they run where a developer
remembered, not at every identifier boundary.

*Locked requirements:* Stage 12 §11 — ownership proven, never inferred; SA-P7; **C-66**.

*Decision:*

```
http/       req.params.id        →  ClaimedId<"student">        a claim, nothing more
                                        ↓
modules/families/                   resolveStudent(scope, claimed) → Resolved<Student>
                                        ↓
application/ or modules/            operations accept Resolved<Student>, never ClaimedId
```

**A use case cannot be called with an unresolved identifier, because its parameter type forbids it.**
The resolver is exported from the owning module's entry point and takes the `Scope` (§19), so ownership
and tenancy are proven together, once, at the boundary.

*Allowed:* `access/resolve.ts` provides the `ClaimedId` type and the generic exchange helper.
*Forbidden:* constructing a `Resolved<T>` anywhere but inside the owning module's resolver.
**The resolution algorithm and its failure semantics are Stage 16; the database backstop is Stage 15.**
*Conflicts affected:* **C-66 — TARGET ARCHITECTURE RESOLVED, IMPLEMENTATION OPEN.**
*Later owner:* **15** · **16** · **22**. *Owner decision:* **NO.**

---

## 16. Application orchestration

**APP-023 · One file per cross-module business act — and it may import almost nothing**

*Locked requirements:* Stage 12 §16.1 — single-module mutation → owning module; cross-module business
act → application orchestration; the orchestrator owns sequencing and transaction scope only.

*Decision:* **`server/application/` holds one file per business act, named for the act, exporting one
function.** It is not a service class, not a registry, not a mediator.

```
server/application/
├── confirm-settlement.ts        I-2  — §21
├── enrol-family.ts
├── import-enrolments/           coordinator + collaborators (the existing proven shape)
├── hand-over-books.ts
├── publish-website.ts           §26
└── …one file per cross-module act
```

**Two kinds of file live here, and the distinction is a filename convention, not a framework.**

```
server/application/
├── <business-act>.ts          AUTHORITATIVE COMMAND COORDINATOR
│                              runs inside a request · owns transaction scope
│                              may import: module index.ts · platform/db · shared
│                              may NOT import a gateway
│
└── jobs/<job-name>.ts         POST-COMMIT JOB HANDLER            (APP-049)
                               runs from the job executor · after commit, never inside
                               may import: module index.ts · gateways · platform/db · shared
```

**The anti-god-object rule, stated as an import rule.** A file in `server/application/` may import
module entry points (`server/modules/*/index.ts`), `server/platform/db`, and `shared/` — plus, **for
files under `application/jobs/` only**, `server/gateways/*`. **It may import nothing else** — not
another use case, not another job handler, not `server/http`, not a module's internals. A use case that
wants another use case's behaviour is two acts, not one.

*Why the split is a directory and not a pattern.* A command coordinator runs inside a request and must
never make an external call; a job handler runs after commit and exists precisely to make one. One
directory name carries that difference. **No base class, no registry, no interface, no framework.**

*Consequences:* the orchestration layer cannot accumulate business truth, because it has nowhere to put
it and no module internals to reach into.
*Conflicts affected:* implements Stage 12 §16.1.
*Later owner:* **22**. *Owner decision:* **NO.**

---

## 17. Module physical ownership — MOD-001…MOD-015

**APP-024 · Every module has one directory and one public entry point**

```
server/modules/<module>/
├── index.ts       THE PUBLIC ENTRY POINT — the only path other code may import
├── operations.ts  the module's business operations   (a directory when it earns one)
├── data.ts        module-owned persistence           (a directory when it earns one)
└── types.ts       the module's internal types
```

**Per CA-P15, that is the whole pattern.** No `controllers/`, `services/`, `repositories/`,
`factories/`, `ports/`, `adapters/`, `handlers/`, `commands/`, `queries/` or `mappers/` directories.
A module gets `operations/` instead of `operations.ts` when it genuinely has several distinct
operation groups — `settlement` and `custody` will; `audit` will not.

| Module | Directory | Operations | Persistence | Owns UI? | May depend on | Must never reach |
|---|---|---|---|---|---|---|
| **MOD-001** Tenancy & School Configuration | `modules/tenancy` | school lifecycle · configuration · **CMS entitlement fact** · Core identity | school, configuration, entitlement rows | no | — | any other module |
| **MOD-002** Identity & Access | `modules/identity` | people · credentials · authorities · sessions-as-facts | user, authority, credential rows | no | MOD-001 | settlement · custody · website |
| **MOD-003** Academic Structure | `modules/academic` | years · classes · groupings | class, year rows | no | MOD-001 | settlement · custody |
| **MOD-004** Children & Families | `modules/families` | children · families · guardian relationships · **SC-4 resolution** | child, family, guardian rows | no | MOD-001, MOD-003 | settlement · stock · website |
| **MOD-005** Catalogue & Inventory | `modules/catalogue` | books · levels · **stock movements** | book, level, stock-movement rows | no | MOD-001 | settlement · custody · families |
| **MOD-006** Book-Supply Cycle & Requirements | `modules/requirements` | requirement determination per child | requirement rows | no | MOD-001, 003, 004, 005 | settlement · custody |
| **MOD-007** Settlement & Funding | `modules/settlement` | settlement decisions · funding | payment, settlement rows | no | MOD-001, 004, 006 | stock · custody · website |
| **MOD-008** Fulfilment & Custody | `modules/custody` | **allocation (MA-1)** · hand-over · custody state | allocation, custody rows | no | MOD-001, 004, 005 | settlement decisions |
| **MOD-009** Communication | `modules/communication` | notifications as durable truth · messages | notification, message rows | no | MOD-001, 002, 004 | **any provider SDK** |
| **MOD-010** Reporting & Projections | `modules/reporting` | composition of operational reads | none of its own | no | read interfaces of 001–009 | **mutating anything** |
| **MOD-011** School Website CMS | `modules/website` | pages · news · events · media · presentation · **draft → publish** | website content, media rows | via `bands/studio` | MOD-001 (identity + entitlement, read) | children · families · settlement · stock · custody · staff · audit |
| **MOD-012** Platform Operations | `modules/platform-ops` | tenant operations · support engagement · investigation | platform rows | via `bands/platform` | MOD-001, 002, 013 | tenant business modules **except through the support boundary** |
| **MOD-013** Audit & Attribution | `modules/audit` | business audit truth | audit rows | no | — | **being used as a logger** |
| **MOD-014** Scheduled Work | `modules/scheduled-work` | durable job records · claim · drain budget | job rows | no | MOD-001 | business consequences (they belong to owning modules) |
| **MOD-015** Delivery & Integration Gateways | **`server/gateways/`** | provider adapters behind interfaces | none | no | `shared/` only | **any business module** |

**Why MOD-015 is not under `modules/`.** Stage 12 §38 places the integration boundary **outside the
business boundary**: a provider signal is interpreted before it can mean anything, and a gateway holds
no business truth. Putting it in `modules/` would state the opposite. Fourteen modules live under
`modules/`; MOD-015 lives under `gateways/`, and the directory names carry the architecture.

**Where domain UI lives.** Modules do not own UI. Stage 9 locked *surfaces*, and §42 of the brief is
explicit that URLs follow experience architecture rather than module ownership. Domain components live
in the band and work area whose screen uses them (§9, level 3). MOD-011 and MOD-012 are noted above as
having a *corresponding band*, not as owning it.

*Conflicts affected:* **C-42** · **C-45** (MOD-010's row is the physical statement) · MA-1 and MA-2
preserved.
*Later owner:* **15** (what rows exist) · **22** (movement). *Owner decision:* **NO.**

---

## 18. Persistence architecture

**APP-025 · `storage.ts` decomposes into thirteen module-owned data layers — and does not become
`databaseService.ts`**

*Problem:* 3,532 lines, ~305 methods, one `IStorage` interface spanning every domain, plus a
memory-mode second implementation.

*Locked requirements:* CA-P3; Stage 12 §15.4; **C-42**.

*Decision:* **each module's `data.ts` owns the persistence for its own facts. There is no successor
god object, no `IStorage`, no `databaseService`, and no shared repository base class.**

**Fourteen business modules; thirteen data layers.** `server/modules/` holds MOD-001…MOD-014.
**MOD-010 Reporting has no `data.ts` at all**, because it owns no operational truth (CA-P13, APP-029) —
that absence is the structural expression of its leaf status, not an omission. **MOD-015 is not counted
here**: it lives under `server/gateways/`, outside the business boundary, and owns no persistence
(§17). So `storage.ts` decomposes into **thirteen** module-owned data layers.

```
server/storage.ts  (3,532 lines, ~305 methods)
        │
        ├── modules/tenancy/data.ts        schools · configuration · entitlement
        ├── modules/identity/data.ts       users · authorities · credentials
        ├── modules/academic/data.ts       classes · years
        ├── modules/families/data.ts       children · families · guardians
        ├── modules/catalogue/data.ts      books · levels · stock movements
        ├── modules/requirements/data.ts   requirements
        ├── modules/settlement/data.ts     payments · settlement          ← confirmPayment
        ├── modules/custody/data.ts        allocations · custody
        ├── modules/communication/data.ts  notifications · messages
        ├── modules/website/data.ts        website content · media
        ├── modules/platform-ops/data.ts   platform records
        ├── modules/audit/data.ts          audit records
        └── modules/scheduled-work/data.ts durable jobs
                                            (MOD-010 has none — CA-P13)
```

*Forbidden:* a module's `data.ts` importing another module's `data.ts`. Cross-module reads go through
the other module's `index.ts` read interface, which is a business interface, not a table.
*Migration seam:* `storage.ts` is **narrowed, not deleted** — as each slice moves, `storage.ts`
delegates to the new owner, so every legacy caller keeps working. §37.
*Conflicts affected:* **C-42** — target defined. Movement is Stage 22.
*Later owner:* **15** (table organisation) · **22** (movement, and which of the two import
implementations survives). *Owner decision:* **NO.**

---

## 19. Tenant-scoped data-access architecture

**APP-026 · Scope is a required value of a closed union type. Absence is a compile error.**

*Problem:*

```ts
// server/storage.ts:314 — current
function schoolFilter<T extends { schoolId: any }>(table: T, schoolId?: string | null) {
  if (typeof schoolId === "string") return eq(table.schoolId, schoolId);
  return undefined;                      // all tenants
}
```

An omitted argument silently removes the `WHERE` clause across ~150 methods. The file's own comment
says so, and says the invariant is held one layer up.

*Locked requirements:* Stage 12 §10.3 — **tenant scope is never an optional argument**; CA-P8;
**C-64**.

*Decision:*

```ts
// server/platform/db/scope.ts   (illustrative shape — not an implementation)
type TenantScope   = { kind: "tenant";   schoolId: string }            // schoolId REQUIRED
type PlatformScope = { kind: "platform"; reason: PlatformReadReason }  // must be justified
type Scope         = TenantScope | PlatformScope
```

**Every function in every module's `data.ts` takes `Scope` as its first parameter, and it is not
optional.** There is no overload without it and no default. A tenant query cannot be written without a
school identifier because there is nowhere to omit it.

**Platform scope must be constructed deliberately.** `PlatformScope` is constructible only inside
`server/modules/platform-ops/` and `server/access/` (for the support boundary), enforced by module
entry points and the lint boundary. Absence is never a scope; **breadth is a decision someone makes
and names.**

*Consequences:* `schoolFilter` disappears rather than being fixed. Every one of the ~150 inheriting
methods gains its scope from its signature.
**Stage 15 adds the database backstop (tenant integrity, C-65) and Stage 16 the security backstop.**
Stage 13 removes the fail-open path from the application layer.
*Conflicts affected:* **C-64 — TARGET ARCHITECTURE RESOLVED (application layer), IMPLEMENTATION OPEN.**
*Later owner:* **15** · **16** · **22**. *Owner decision:* **NO.**

---

## 20. Resource ownership boundary

Covered by **APP-022** (§15). The physical home is each owning module's resolver, exported from its
`index.ts`; the shared `ClaimedId` / `Resolved<T>` types live in `server/access/resolve.ts`.

---

## 21. I-2 physical transaction architecture

**APP-027 · One coordinator, one transaction, three module-owned operations**

*Locked requirements:* **I-2** — one process, one PostgreSQL transaction, one commit, all succeed or
all roll back. No queue, event bus, saga, distributed transaction, async allocation, async stock
deduction or eventual consistency. Stage 12 §17; §16.1.

*Current evidence — verified good.* `server/storage.ts:2218 confirmPayment` runs inside
`getTxDb().transaction`, claims the order with a single guarded `UPDATE` out of the payable states so
exactly one concurrent caller wins, and performs allocation and stock movement in the same
transaction. The audit's payment race (4.1 / 4.2 / 4.4, Critical) is **already remediated** here.
**Stage 13 preserves this behaviour exactly and changes only where the pieces live.**

```
http/routes/settlement.ts                      transport only
        ↓
access/                                        ActiveContext · CAP · Resolved<Payment>
        ↓
application/confirm-settlement.ts              THE COORDINATOR
        │   owns: use-case sequencing · transaction scope
        │   owns: NO business truth
        ↓
platform/db/withTransaction(async (tx) => {    ONE transaction — the coordinator owns its scope
        │
        ├── modules/settlement  confirmSettlement(scope, tx, payment)   MOD-007 owns settlement truth
        ├── modules/custody     allocate(scope, tx, …)                  MOD-008 owns allocation truth
        ├── modules/catalogue   recordStockMovement(scope, tx, …)       MOD-005 owns stock truth
        └── modules/communication recordNotification(scope, tx, …)      MOD-009 owns notification truth
        │                                        ── where the notification is a REQUIRED business
        │                                           consequence of this authoritative act
})                                             ONE COMMIT — or one rollback of ALL of it
        ↓
                                               delivery becomes ELIGIBLE
        ↓   (after commit, always)
application/<job handler>  →  gateways/email   the provider call — NEVER inside the transaction
```

**Correction 4 — notification truth cannot fall between commit and delivery.** Stage 12 §§17.3 and 22
lock the order `business event → durable notification truth → COMMIT → delivery eligible → delivery
attempt`. Where a MOD-009 notification is a **required business consequence** of the authoritative
act, its notification *fact* is recorded **inside the same transaction**, so a crash between commit
and delivery cannot lose the record of what was owed. **This does not mean every conceivable
notification is written inside every business transaction** — only that a required one is coupled to
the outcome it belongs to. **The external delivery call is always outside the transaction, always
after commit.**

*Forbidden:* the coordinator writing any of these facts itself; any of the modules calling another;
**any delivery, provider, webhook or external call inside the transaction.**
*Consequences:* the three impossible states of Stage 12 §17 stay impossible, and a fourth —
*settled-with-no-record-of-what-was-owed* — becomes impossible with them.
*Conflicts affected:* preserves the verified-good remediation (SAR-012).
*Later owner:* **22** (movement). *Owner decision:* **NO.**

---

**APP-048 · Who owns a transaction depends on the command; `Tx` always comes from one runner**

*Problem — Correction 3.* An earlier draft of APP-027 said a mutating operation "cannot be called
outside a transaction that a coordinator opened". That overstates Stage 12 §16.1: it implies every
single-module command must be routed through `server/application/` merely because it writes. That is
not the locked model, and it would push trivial commands — renaming a class, changing a configuration
value — through a cross-module orchestrator for no reason.

*Locked requirements:* Stage 12 §16.1 — single-module mutation → owning module; cross-module business
act → application orchestration; read path never mutates.

*Decision:* **`Tx` exists only inside the canonical transaction runner. *Who calls that runner*
depends on the command.**

```
SINGLE-MODULE COMMAND            rename a class · change a school configuration value ·
                                 record a simple module-owned fact
      → the OWNING MODULE owns the command, its validation and its mutation
      → it may call platform/db.withTransaction itself where a transaction is required
      → it does NOT need an application orchestrator merely because it writes data

CROSS-MODULE BUSINESS ACT        CONFIRM SETTLEMENT · enrol family · publish website
      → the APPLICATION ORCHESTRATOR calls withTransaction
      → it sequences the owning modules inside that one transaction
      → each module still owns its own fact

LOW-LEVEL MUTATION FUNCTION      confirmSettlement(scope, tx, …) · allocate(scope, tx, …)
      → takes `tx: Tx` as a required argument
      → therefore cannot run outside SOME transaction — but not necessarily a coordinator's
```

**The structural rule, stated exactly.** A `Tx` is constructible **only** inside
`platform/db.withTransaction`. A transaction-bound mutation function therefore cannot run outside a
transaction. **It is not true, and this document does not claim, that only an application coordinator
may open one.**

**I-2 specifically is unchanged**: `application/confirm-settlement.ts` owns that transaction scope,
because confirming settlement is a cross-module act by definition (MOD-007 + MOD-008 + MOD-005 +
required MOD-009 truth).

*Forbidden:* a module opening a transaction that spans another module's facts — that is a cross-module
act and belongs to `application/`; a route handler calling `withTransaction`; constructing a `Tx` by
any other route.
*Consequences:* **APP-028's `ReadDb` / `Tx` distinction is not weakened in any way** — it is what makes
this rule enforceable at all.
*Conflicts affected:* implements Stage 12 §16.1 precisely.
*Later owner:* **22**. *Owner decision:* **NO.**

---

## 22. Database connection boundary

**APP-028 · The read handle and the transactional handle are different types**

*Problem — and this is new.* `server/config/database.ts` declares
`export type AppDatabase = NodePgDatabase<typeof schema>`, and `getDb()` returns a **Neon HTTP** handle
cast into it:

```ts
_db = drizzle(neon(env.DATABASE_URL), { schema }) as unknown as AppDatabase;   // line 113
```

`getTxDb()` returns `NodePgDatabase<typeof schema>` — **the same type**. Therefore
`getDb().transaction(...)` compiles. Under the Neon HTTP driver it does not provide the interactive
transaction semantics I-2 requires, and **nothing — not the compiler, not a test, not a review
checklist — distinguishes the two handles at a call site.** The file's comment is the only guard.

All four current transaction sites use `getTxDb()` correctly. The defect is that correctness here is
attentiveness, not structure. **Raised as C-74.**

*Locked requirements:* Stage 12 §18.1 and AD-012 — Neon HTTP single-statement mode is not a valid I-2
path; CA-P10.

*Decision:* **`server/platform/db/` exports two nominally distinct handles.**

```
platform/db/
├── read.ts        getReadDb(): ReadDb
│                    ReadDb is branded and its type exposes NO .transaction member.
│                    May be Neon HTTP on Vercel — that is exactly what it is for.
├── transaction.ts withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
│                    Tx is branded. ALWAYS the node-postgres pool.
│                    THE ONLY place .transaction() is called in the codebase.
├── pool.ts        the single pg Pool — sessions and transactions share it
└── console.ts     the least-privilege console pool (from config/consoleDb.ts — KEEP)
```

**`getReadDb().transaction(...)` becomes a compile error.** A `Tx` cannot be constructed outside
`withTransaction`. The driver choice by URL (Neon host → neon-http, otherwise → node-postgres) is
**preserved exactly** — it is what makes the app viable on Vercel cold starts and what made local
Postgres and CI usable — and the SSL configuration, including `DATABASE_SSL_STRICT`, is preserved
unchanged.

*Consequences:* one pool, created once, in one file — addressing the current multiple-pool-creation
pattern. `PostgreSQL is not replaced. Neon is not replaced. Drizzle is not replaced.` No deployment
configuration is designed here.
*Conflicts affected:* **C-74 — new; addressed structurally by this decision.**
*Later owner:* **21** (region and connection configuration) · **22**. *Owner decision:* **NO.**

---

## 23. Reporting and read composition

**APP-029 · MOD-010 is a leaf, expressed as an import rule**

*Locked requirements:* Stage 12 §19; **C-45**; CA-P13.

*Decision:* `server/modules/reporting/` has **no `data.ts`**. It composes read interfaces exported from
operational modules' `index.ts` files. **No operational module may import `modules/reporting`** — the
lint boundary makes the wrong direction a build failure, and the absent `data.ts` makes reporting
structurally incapable of owning a fact.
*Consequences:* an operational decision can never be taken on a reporting projection.
*Conflicts affected:* **C-45 — TARGET ARCHITECTURE RESOLVED, IMPLEMENTATION OPEN.**
*Later owner:* **18** (read performance). *Owner decision:* **NO.**

---

## 24. CMS Studio physical architecture

Covered by **APP-005** (§6.2). Server side:

```
server/modules/website/          MOD-011 — content · drafts · publication · presentation · media
  index.ts     authoring operations (authenticated) AND the published read interface (§25)
  data.ts      website content and media rows
```

**The Studio uses the canonical operational design system (§11).** A school's public website theme
lives in a variable namespace consumed only by `apps/site`; there is no code path by which published
presentation restyles the Studio.

---

## 25. Public website physical architecture — AQ-1 = B

**APP-030 · The public school website is a separate application entry point and build target**

*Locked requirements:* **AQ-1 = B / AD-030** — rendered/static public delivery, authenticated app stays
a SPA, no framework migration. Stage 12 §5.1–§5.4: the §5.2 allowlist, structural not filtered;
publication explicit; MOD-001/MOD-011 ownership.

*Current evidence:* `client/src/pages/school-public.tsx` (210 lines) is a lazy SPA route fetching
`/api/public/schools/:code` and `…/website`; `vercel.json` rewrites `/(.*)` → `/index.html`, so every
public URL is served as the SPA shell. Nothing about this is indexable, and the public visitor is
served the same bundle boundary as the authenticated application.

*Options evaluated.*

| Option | Assessment |
|---|---|
| **1 · separate public frontend entry/build** | Necessary but not sufficient alone: a second SPA bundle is still client-rendered, so it does not deliver the indexability AQ-1 = B was chosen for. |
| **2 · publish-time/static generation on the existing stack** | Achieves Stage 12 §5.1's stated rationale literally — the public edge carries no authenticated runtime. Requires generation and invalidation at publish. |
| **3 · minimal server-rendered public path on the existing Express app** | Achieves indexability, but the public edge then runs the same application process that holds all authority — which is the property B was chosen to avoid. |
| **4 · simpler arrangement** | None found in the repository evidence. |

*Decision:* **Option 1 as the physical structure, carrying a rendered output — that is, `apps/site` is
its own entry point and build target which renders published content, and which physically cannot
import authenticated code.** The **rendering timing** — prerender at publish, or render on request
behind a cache invalidated at publish — is a **deployment characteristic that this structure supports
either way, and it belongs to Stage 21.** What Stage 13 fixes is the boundary, because the boundary is
what makes Option 3's weakness unavailable: `apps/site` has no resolvable path to `server/modules`
at all (APP-031), and its TypeScript project scope cannot see `apps/app` or `server/**` (APP-047).

*Physical structure — and the boundary has no exception (Correction 5).*

An earlier draft said `apps/site` had no server reach *"beyond one read interface"*. That phrasing
created an exception that contradicted the import rule it sat beside. **There is no exception.**
`apps/site` has **zero import path to `server/**`.** The renderer knows a *contract*; it never knows an
implementation.

```
PUBLIC DELIVERY HOST / ADAPTER          ← the only thing that touches server code
        ↓  calls the MOD-001 / MOD-011 public read boundary
        ↓  receives a PublishedSite
        ↓  passes the PublishedSite as a VALUE
apps/site renderer                      ← knows the CONTRACT, not the implementation
        ↓
rendered / static output
```

```
apps/site/
├── entry.tsx                   the public render entry — NOT apps/app/main.tsx
│                               signature: (site: PublishedSite) => rendered output
├── resolve/                    which school website is this?          §30
├── sections/                   home · about · admissions · classes ·
│                               news · events · gallery · contact
├── presentation/               applies the school's PUBLIC theme (--site-* namespace)
└── imports: apps/common · shared/contracts · shared/format          — and NOTHING else

shared/contracts/published-site.ts
└── type PublishedSite            THE CONTRACT — what apps/site knows

server/modules/website/index.ts
└── getPublishedSite(…): PublishedSite    THE IMPLEMENTATION — what apps/site never sees
```

**`apps/site` does not import `server/modules/website`. It does not import `getPublishedSite`. It
imports the `PublishedSite` type from `shared/contracts` and receives a value.** The host that obtains
that value may later be a publish-time generator or a request-time rendering host — **Stage 21 still
owns that timing**, and **Stage 14 owns the exact HTTP or internal form** if one is used. Stage 13 owns
only the physical separation, and the separation is enforced by APP-047's project scopes: `apps/site`
has no alias and no `include` reaching `server/**`, so the import does not resolve.

*Allowed dependencies:* `apps/site` → `apps/common`, `shared/contracts` (the `PublishedSite` **type**),
`shared/format`.
*Forbidden dependencies:* `apps/site` ✗→ `apps/app` · ✗→ any auth hook · ✗→ **`server/**`, with no
exception, including `server/modules/website`.** **Enforced by APP-047's project scope (§36 mechanism
1), so the import does not merely lint-fail — it does not resolve.**

*Consequences:* two Vite configs, two build outputs, and `vercel.json`'s blanket
`/(.*)` → `/index.html` rewrite must change — **but not here; that is Stage 21.** The SPA route
`/school/:code` becomes LEGACY and is removed in Stage 22, after the new path is live. **No Next.js. No
meta-framework. No SSR for the authenticated application.**
*Conflicts affected:* none resolved; implements AD-030.
*Later owner:* **21** (rendering timing, caching, domains) · **22** (retiring the SPA route).
*Owner decision:* **NO** — see §44.

---

**APP-031 · The public read interface returns published material; it does not strip operational
records**

*Locked requirements:* Stage 12 §5.2 — *structural, not filtered*.

*Decision:* `getPublishedSite()` composes **only** the §5.2 allowlist: published pages, published
content, published news, published events, published **accepted** media, public contact information,
Core school name, Core school logo, permitted public identity, public navigation, public presentation.

**The rejected architecture, stated so it cannot be re-introduced:**

```
retrieve operational record → remove some fields → expose publicly       ✗ REJECTED
```

The `PublishedSite` type is defined in `shared/contracts/` and contains **no field that could carry**
children, guardian relationships, families, private student information, payment, settlement, funding,
stock, allocations, custody, hand-over, private staff records, support-mode data, platform operational
data, audit records, authentication or session data, CMS drafts, unpublished media, or private
operational files. A leak would require adding a field to a public contract in a reviewed change —
not forgetting a `delete` statement.

**Fail-safe empty.** An absent, unentitled or unpublished site returns empty and never discloses that
the tenant exists (Stage 12 §5.1, preserved).
*Later owner:* **15** (what is stored) · **16** (verification). *Owner decision:* **NO.**

---

**APP-032 · No per-school code. No developer deployment for content.**

*Locked requirements:* AQ-1 = B — the school touches no HTML, CSS, JavaScript, React, Git, source code,
Vercel or hosting configuration.

*Decision:* **one `apps/site` application, driven entirely by MOD-011 data and MOD-001 identity.** There
are **no per-school forks, no per-school branches, no per-school build artefacts in source control, and
no developer step in the path from PUBLISH to public.** Application code remains BytHub-controlled;
CMS data and configuration drive every school's site.
*Conflicts affected:* none. *Later owner:* **21**. *Owner decision:* **NO.**

---

## 26. Publication flow

**APP-033 · Four physical responsibilities, one owning module**

*Locked requirements:* Stage 12 §5.3 — publication is explicit; MOD-011 owns it.

```
AUTHORING          apps/app/bands/studio/**            create · edit · save draft
                   server/modules/website (authoring operations)

PREVIEW            apps/app/bands/studio/preview/      composes the SAME published-shape
                                                        projection from the DRAFT — authenticated,
                                                        never publicly reachable

PUBLISH            server/application/publish-website.ts
                                                        a cross-module act: MOD-011 promotes the
                                                        draft; MOD-001 confirms entitlement;
                                                        MOD-013 records attribution.
                                                        One transaction (§21's mechanism).

PUBLIC DELIVERY    apps/site/**  ←  modules/website getPublishedSite()
                                                        published material only
```

**Editing a draft does not change the public website.** The public read interface has no access to
draft state — not by a flag, but because draft rows are not in what it composes.
*Forbidden:* preview reachable without authentication; publish performed from a route handler; the
public path reading any draft.
**No database tables and no API URLs are defined here.**
*Later owner:* **14** (the publish endpoint) · **15** (draft/published representation) · **21**
(invalidation). *Owner decision:* **NO.**

---

## 27. Object-storage and import boundaries

**APP-034 · Storage infrastructure sits behind a gateway; CMS business logic never sees it**

*Locked requirements:* Stage 12 §20 — permission → direct upload → finalisation; arrival ≠ acceptance;
**C-57**, **C-68**.

*Current evidence:* `server/storageProvider.ts` **already defines** `StorageProvider` with
`put`/`delete`/`getUrl` and ships a `data-uri` default driver that preserves today's behaviour exactly.
Four multer configurations exist (`middleware/auth.ts` branding, `routes/website.ts` media,
`routes/family-enrollment.ts` sheets, `routes/payment.ts` Stripe), all `memoryStorage`.

*Decision:* **`server/gateways/storage/` — `storageProvider.ts` moves here unchanged (KEEP + BOUNDARY).
Upload permission and finalisation become module operations; the transfer itself does not pass through
the application.**

```
modules/website     "this asset is permitted"      →  gateways/storage: signed permission
                    (no bytes, no provider name)
browser             uploads directly to storage        (not through the Express function)
modules/website     "this asset is accepted"       →  finalisation; only now is it referenceable
```

*Forbidden:* an S3-compatible client call in a React component; a provider SDK imported by any module;
`server/app.ts`'s `express.static("/uploads")` in the target architecture (**C-68** — removal is Stage
22, after object storage exists).
**The provider, signed-URL duration and scanner are Stage 17 and Stage 16.**
*Conflicts affected:* **C-57** boundary placed · **C-68** target removal confirmed.
*Later owner:* **16** · **17** · **22**. *Owner decision:* **NO.**

---

**APP-035 · Workbook parsing is server-side, in a gateway, and cannot be bundled into a browser**

*Problem:* `client/src/pages/admin/students.tsx:22` — `import * as XLSX from "xlsx"`. Stage 11 recorded
that the npm registry's SheetJS is frozen at a vulnerable 0.18.5.

*Current evidence:* two import implementations coexist. The older `students.tsx` path parses in the
browser. The newer `server/services/enrollment-import/spreadsheet-parser.ts` parses server-side from a
multer memory buffer — **the correct one already exists.**

*Locked requirements:* Stage 12 §21; **C-58**.

*Decision:*

```
apps/app/bands/school/people/import/     upload + column mapping + preview UI. NO parser.
        ↓  file
server/http/routes/import.ts             transport: receives the upload
        ↓
server/gateways/spreadsheet/             THE ONLY place a workbook library is imported
        ↓  rows
server/application/import-enrolments/    validate · preview · commit  (the existing shape, moved)
        ↓
modules/{families,academic,identity}     each owns its own facts
```

*Forbidden:* `xlsx` (or any workbook library) imported anywhere under `apps/**` — a lint boundary rule
failing the build, so it cannot be reintroduced. **Parser output never mutates domain state directly**;
it produces validated rows that a use case commits.
*Conflicts affected:* **C-58** boundary placed. **Which of the two import implementations survives is
Stage 22**, per §60 of the brief.
*Later owner:* **17** (library) · **22** (selection). *Owner decision:* **NO.**

---

## 28. Notification and integration gateways

**APP-036 · Modules express eligibility; gateways deliver**

*Problem:* twelve files import `server/email.ts` directly — eleven of them route files — and it exports
nineteen `send*` functions. Delivery is fused to business paths.

*Locked requirements:* Stage 12 §22 — durable notification truth first, eligible delivery second;
MOD-015; **C-70**-adjacent failure isolation.

*Decision:*

```
modules/**                     write a MOD-009 notification         durable truth — inside the
                                                                    transaction where required (APP-027)
                                   ↓  COMMIT
modules/communication          the notification is delivery-eligible
                                   ↓
platform/jobs/runner.ts        TECHNICAL EXECUTOR — claims work, honours the budget.
                               Business-agnostic. Computes no business truth.
                                   ↓
application/jobs/deliver-notifications.ts    NAMED JOB HANDLER      (APP-049)
                               reads the required module-owned truth
                                   ↓
gateways/email                 EmailGateway → Resend                external provider only
                                   ↓
modules/communication          records the delivery result          the OWNING module writes it
```

*Forbidden:* `Resend` named anywhere outside `server/gateways/email/`; any module or route importing an
email function; delivery attempted inside a transaction; **the gateway mutating notification, settlement
or custody truth** — it returns a result and the owning module records it; **the executor deciding what
a delivery means.**
*Consequences:* a delivery failure can never destroy the record of what was owed — the notification is
already durable when delivery is attempted.
**Templates, provider details and retry policy are Stage 17.**
*Later owner:* **17** · **22**. *Owner decision:* **NO.**

---

**APP-037 · Payment provider integration sits behind a gateway, and interpretation is a module's job**

*Current evidence:* `server/paymentIntegration.ts` verifies an HMAC and fails closed — preserved.
`server/services/payment-verification/` (5 files) already has the right shape.

*Decision:* `server/gateways/payments/` holds authenticity, replay and idempotency checks; **MOD-007
decides whether anything is now true.** Stage 12 §38: a valid signature proves origin, not meaning.
**Provider, signature mechanism and webhook contract are Stage 17 and Stage 14.**
*Later owner:* **14** · **17**. *Owner decision:* **NO.**

---

## 29. Jobs and scheduler

**APP-038 · Cron invokes work. Cron does not own it.**

*Current evidence:* `vercel.json` declares one cron at `0 7 * * *` → `/api/cron/run`;
`server/routes/cron.routes.ts` holds job selection, per-school iteration, the wall-clock drain budget
(**verified good, preserve and extend**), digest composition, unpaid-reminder logic and direct
`getDb()` queries — four responsibilities in a transport file.

*Locked requirements:* Stage 12 §23 — durable, tenant-scoped work; no queue or broker technology.

*Decision:*

```
SCHEDULER TRANSPORT      server/http/routes/cron.ts
                         authenticate the platform trigger · call the runner · return. Nothing else.
                             ↓
DURABLE JOB TRUTH        server/modules/scheduled-work/      MOD-014
                         job records · claim · per-school scoping · drain budget (PRESERVED)
                             ↓
TECHNICAL EXECUTOR       server/platform/jobs/runner.ts
                         claims a job · dispatches to its handler by name · honours the wall-clock
                         budget · records mechanical outcome.
                         BUSINESS-AGNOSTIC — it knows job names, not what any job means.
                             ↓
NAMED JOB HANDLER        server/application/jobs/<job-name>.ts        (APP-049)
                         business sequencing for THIS job: read module-owned truth →
                         call a gateway if the job has an external consequence →
                         record the result through the OWNING module.
                             ↓
BUSINESS CONSEQUENCES    the owning modules — never the runner, never the gateway, never the route
```

*Forbidden:* business logic in `routes/cron.ts`; **the executor calculating business truth or calling a
gateway**; the runner owning a business fact; a gateway mutating business truth; a gateway importing a
business module; **any queue, broker or message bus.**
*Consequences:* the existing wall-clock budget survives as MOD-014 behaviour rather than as route code.
*Later owner:* **18** (concurrency) · **21** (trigger configuration) · **22**. *Owner decision:* **NO.**

---

**APP-049 · Named job handlers are the one legitimate caller of a gateway**

*Problem — Correction 6.* An earlier draft forbade `modules ✗→ gateways`, `http ✗→ gateways` and
`application ✗→ gateways`, and confined `platform` to `shared` only. Taken together that left **no
legitimate caller for any external gateway at all**, while APP-036 required jobs to invoke delivery.
The dependency model had no seam for the external consequence of a business act.

*Locked requirements:* Stage 12 §22 (durable truth then eligible delivery) · §23 (durable jobs) · §38
(the integration boundary is outside the business boundary) · CA-P12.

*Decision:* **`server/application/jobs/` — one file per job, named for the job. It is the only place
in the codebase that may call a gateway.**

```
BUSINESS MODULE            owns business truth                    never names a provider
GATEWAY (MOD-015)          talks to an external provider          holds no business truth
NAMED JOB HANDLER          coordinates the external consequence   owns neither
TECHNICAL EXECUTOR         claims · dispatches · budgets          business-agnostic
```

*Physical structure:*

```
application/jobs/
├── deliver-notifications.ts     MOD-009 eligible truth  →  gateways/email  →  MOD-009 result
├── reconcile-provider-payments.ts   gateways/payments → interpreted signal → MOD-007 decides
├── finalise-uploads.ts          gateways/storage → MOD-011 acceptance
└── …one file per job
```

*Allowed dependencies:* `application/jobs/*` → module entry points · `server/gateways/*` ·
`platform/db` · `shared`.
*Forbidden dependencies:* `platform/jobs` ✗→ `modules` and ✗→ `gateways` — it dispatches **by name**,
which is a mechanical lookup, not an import of business logic. `gateways/*` ✗→ `modules` — a gateway
returns a result and the **owning module records it**; a gateway never mutates settlement, notification
or custody truth. A job handler ✗→ another job handler, ✗→ a command coordinator, ✗→ `server/http`.

*Consequences:* the chain has exactly one caller at each hop and no layer holds two responsibilities.
Adding a future integration adds a gateway and a job handler — it does not require a business module to
learn a provider's name, and it does not require the executor to learn what a job means.
**Deliberately no ceremony:** no handler base class, no registry object, no interface hierarchy, no
dependency-injection container. A job handler is a file exporting one function.
*Conflicts affected:* closes the dependency gap that APP-036 and APP-038 otherwise left open.
*Later owner:* **17** (providers) · **22**. *Owner decision:* **NO.**

---

## 30. Public school resolution

**APP-039 · One application boundary resolves which public school website was requested**

*Locked requirements:* Stage 12 §5.1 — resolve school → entitlement → published content, fail-safe
empty.

*Decision:* **`apps/site/resolve/` is the single application responsibility for turning an incoming
public request into a school identity**, and `modules/tenancy` (MOD-001) is the single authority that
answers it. Entry forms that this boundary is designed to accept without restructuring:

```
ScholarShelf-hosted path      /school/<code>-shaped
subdomain                     <school>.<scholarshelf domain>
custom school domain          the school's own domain
```

**No domain product, DNS mechanism, certificate handling or provider is invented here** — Stage 17 owns
providers and Stage 21 owns deployment. Stage 13 decides only that resolution is one boundary in one
place, so adding an entry form later is a change in `resolve/` and nothing else.
*Fail-safe:* an unresolvable, unentitled or unpublished request yields empty and discloses nothing.
*Later owner:* **17** · **21**. *Owner decision:* **NO.**

---

## 31. Audit versus logging

**APP-040 · Two homes, two purposes, neither substitutable for the other**

*Current evidence:* 55 `console.*` calls under `server/`, no logging library, no correlation identifier;
`server/console/audit.ts` and `auditLog` in `middleware/auth.ts` mix the two concerns.

*Locked requirements:* Stage 12 §27; **C-62**.

*Decision:*

```
server/platform/observability/     TECHNICAL — logger · correlation id · error tracking
                                   Operational telemetry. Not durable business truth.

server/modules/audit/              MOD-013 — BUSINESS AUDIT
                                   Who did what, to what, under which authority.
                                   A fact with an owner and a retention obligation.
```

*Forbidden:* MOD-013 writing its records to the logger; the logger treated as the audit source; a
business module constructing an audit record inline instead of through MOD-013.
**Log field schema is Stage 21; audit record schema is Stage 19.**
*Conflicts affected:* **C-62** boundary placed.
*Later owner:* **19** · **21** · **22**. *Owner decision:* **NO.**

---

## 32. Health and readiness

**APP-041 · Health has an infrastructure home and three levels**

*Current evidence:* `server/routes/auth.routes.ts:51` returns
`{ status: mode === "database" ? "ok" : "degraded" }` — it reports configuration, not readiness, and
never touches the database (**C-69**).

*Decision:* **`server/platform/health/` owns liveness, readiness and dependency probes.
`server/http/routes/health.ts` is transport only.** Health logic appears in no other route.
**Stage 14 owns the endpoint contract; Stage 21 owns deployment gating.**
*Conflicts affected:* **C-69** home placed; the probes themselves are Stage 14/21.
*Later owner:* **14** · **21**. *Owner decision:* **NO.**

---

## 33. Test support and persistence substitution

**APP-042 · Test substitutes replace infrastructure, never business semantics**

*Problem:* `ALLOW_MEMORY_STORAGE` and a memory implementation inside `storage.ts` give the product a
second set of semantics. `tests/` holds eleven flat scripts run by `tsx`, no framework, and the
database-backed suites have historically only run against Neon.

*Locked requirements:* Stage 12 §31.2 — one persistence semantics; **C-71**; CA-P11.

*Decision:*

```
tests/
├── support/
│   ├── factories/      build REAL rows in a REAL PostgreSQL, through module operations
│   ├── fixtures/       named scenarios composed from factories
│   └── db.ts           schema-per-run isolation over the same connection boundary as production
└── (suites)
```

**There is no second storage implementation in the target.** The memory mode is **LEGACY — removed in
Stage 22**, not here. A factory may substitute a *gateway* (email, storage, payments) because a gateway
is infrastructure; **no substitute may re-implement a business rule.**

*Note:* `server/config/database.ts`'s `isPlaintextDatabase` fix — which made local Postgres and
therefore CI viable — is **preserved**, and is what makes real-Postgres factories possible at all.
**Full test strategy is Stage 20.**
*Conflicts affected:* **C-71** target defined.
*Later owner:* **20** · **22**. *Owner decision:* **NO.**

---

## 34. Shared-code rules

**APP-043 · `shared/` and `apps/common/` are admission-controlled, not default destinations**

```
shared/                     SERVER + BOTH APPS
├── capabilities.ts         the 95 CAP-* identifiers                    (APP-021)
├── contracts/              safe cross-boundary types — PublishedSite, DTOs with no private fields
├── format/                 presentation formatters                     (APP-016)
├── validation/             generic primitives genuinely shared
├── constants.ts            universal constants
└── academic-year.ts        KEEP — a shared calendar primitive

apps/common/                BOTH APPS, PRESENTATION ONLY
├── ui/                     the 56 shadcn primitives
├── patterns/               PageHeader · QueryState · EmptyState · ErrorState · DataTable
├── theme/                  tokens.css · brand.css · branding.ts       (APP-017)
├── icons.ts                Lucide only
└── errors.ts               client-side error classification
```

**Explicitly forbidden in either:** settlement business rules · custody logic · finance workflows ·
tenant-scoped persistence · Drizzle table definitions · a mixed-domain schema-and-business file ·
anything named `helpers` · **whole operational feature modules shared with `apps/site` for
convenience.**

**`shared/schema.ts` (1,166 lines).** Stage 15 owns its organisation. Stage 13's rule is only:
**table definitions may be imported solely by `server/modules/*/data.ts`.** Validation contracts the
client needs — today `websiteSectionInputSchema` and its siblings — move to `shared/contracts/`, so a
client import cannot drag table definitions with it. That is the physical answer to **C-43** without
redesigning any schema.

*Consequences:* `shared/test-superuser.ts` is imported by `App.tsx` today; the **production-disabled
test-superuser protection is verified good and preserved**, and its shared constants stay in
`shared/constants.ts`.
*Later owner:* **15** · **22**. *Owner decision:* **NO.**

---

## 35. Import and dependency rules

**APP-044 · The dependency direction, stated once**

```
apps/site  ──▶ apps/common ──▶ shared            (and NOTHING else)
apps/app   ──▶ apps/common ──▶ shared

server/http        ──▶ access ──▶ application ──▶ modules ──▶ platform/db
                                       │              │
                                       └──────────────┴──▶ shared

server/application/jobs/*  ──▶ gateways        ◀── THE ONLY legitimate gateway caller
server/gateways            ──▶ shared                                      (only)
server/platform            ──▶ shared                                      (only)

        platform/jobs dispatches BY NAME to application/jobs — a mechanical dispatch,
        not an import of business logic. The executor stays business-agnostic.
```

**The forbidden matrix — every entry has current evidence or a locked requirement behind it:**

| Forbidden | Because | Evidence / lock |
|---|---|---|
| `apps/site` ✗→ authenticated operational modules, auth hooks, `apps/app` | AQ-1 = B public boundary | Stage 12 §5.2 |
| `apps/**` ✗→ `xlsx` or any workbook library | server-only parsing | C-58 · `students.tsx:22` |
| `apps/**` ✗→ `server/**` | trust boundary | CA-P5 |
| `server/http` ✗→ `drizzle-orm`, `shared/schema` tables | transport ✗→ persistence | C-42 · 8 route files |
| `server/http` ✗→ `gateways/**` | modules express eligibility | C-70-adjacent · 11 route files import email |
| `modules/*` ✗→ `gateways/**` | a module states intent; it never names a provider | CA-P12 · 12 files import `email.ts` |
| `application/<command>.ts` ✗→ `gateways/**` | an authoritative command makes no external call | APP-027 · APP-049 |
| `platform/jobs` ✗→ `modules/**` and ✗→ `gateways/**` | the executor is business-agnostic | APP-049 |
| `gateways/**` ✗→ `modules/**` | a gateway returns a result; the owning module records it | APP-049 |
| `modules/website` ✗→ settlement · stock · custody · families · children | CMS has no operational reach | Stage 12 §24 |
| `modules/*` ✗→ another module's `data.ts` | module-owned persistence | CA-P3 |
| operational modules ✗→ `modules/reporting` | reporting is a leaf | C-45 |
| `bands/platform` ✗→ `bands/school` except via `support/` | Platform ≠ Core with null school | C-44 |
| any business module ✗→ a provider SDK | gateways | CA-P12 |
| any business module ✗→ `platform/observability` as an audit sink | audit ≠ logging | C-62 |
| anything ✗→ `getReadDb().transaction` | it will not be a transaction | **C-74** |
| `PlatformScope` constructed outside `platform-ops` / support boundary | breadth is a named decision | C-64 |
| `Resolved<T>` constructed outside the owning module's resolver | ownership is proven, not asserted | C-66 |
| `application/*` ✗→ another `application/*` | no god orchestrator | CA-P4 |

---

## 36. Architecture enforcement

**APP-045 · Four mechanisms, strongest first**

| # | Mechanism | Enforces | Strength |
|---|---|---|---|
| 1 | **The TypeScript configuration family (APP-047)** — `tsconfig.app.json` / `tsconfig.site.json` / `tsconfig.server.json` over a base that declares no aliases | the public/private boundary — an authenticated import **does not resolve** | strongest: not a rule, an impossibility |
| 2 | **Branded types** — `Tx`, `ReadDb`, `Scope`, `Resolved<T>`, `ClaimedId<T>`, `BrandIdentityValues` | C-74 · C-64 · C-66 · C-52/53 | compile-time, unavoidable |
| 3 | **Module public entry points** — only `server/modules/*/index.ts` is importable; `data.ts` is unreachable from outside | CA-P3 · C-42 | structural |
| 4 | **ESLint `no-restricted-imports` zones + a CI boundary check** | the §35 matrix | catches what types cannot express |

**Stage 13 specifies what enforcement is needed. It installs and configures nothing** — no tool is
added, no config file is written, no dependency is installed. Selection and setup belong to
implementation.

**Adoption is graded.** Lint boundaries ship in **warn** mode and are flipped to **error** one boundary
at a time as each is cleared, so enforcement can arrive before the migration finishes rather than
after (§37, CA-P14).

---

## 37. Incremental migration compatibility

**APP-046 · Five seams, so nothing has to move at once**

*Locked requirements:* CA-P14. **Stage 22 owns migration order and implementation selection — this
section defines only that incremental migration is possible.**

**Seam 1 — `storage.ts` narrows by delegation.** As each module's `data.ts` takes ownership of a slice,
the corresponding `storage.ts` methods delegate to it. Every legacy caller keeps working, unchanged, at
every point. `storage.ts` shrinks toward zero and is deleted only when it is empty.

**Seam 2 — module entry points arrive before internals move.** `server/modules/<m>/index.ts` can
re-export existing functions from their current homes on day one. Callers migrate to the entry point
first; the implementation moves behind it later, invisibly.

**Seam 3 — path aliases let both frontend trees resolve.** `@app/*` can point into `client/src/**`
during transition, so screens move file by file rather than en masse.

**Seam 4 — `apps/site` is purely additive.** It can be built, served and verified while
`/school/:code` still works. The SPA route is retired only after the new path is live — never before.

**Seam 5 — enforcement is graded** (§36): warn, then error, per boundary.

**What is explicitly *not* required:** that all ~50,200 lines move before the application runs; that a
module move atomically; that the frontend and backend migrate together; that legacy and target
structures be separated before either works.

*Later owner:* **22**. *Owner decision:* **NO.**

---

## 38. Current → target physical map

| Current | Class | Target | Note |
|---|---|---|---|
| `server/storage.ts` (3,532) | **SPLIT** | 13 module `data.ts` layers | delegation seam; no successor god object |
| `shared/schema.ts` (1,166) | **KEEP + BOUNDARY** | importable only by module `data.ts`; contracts to `shared/contracts/` | Stage 15 owns organisation |
| `server/routes/*.ts` (19) | **REFACTOR** | `server/http/routes/` — transport only | 8 files lose Drizzle; 11 lose email |
| `server/app.ts` (323) | **SPLIT** | `http/server.ts` + `platform/config` | `/uploads` mount → LEGACY |
| `server/middleware/auth.ts` (1,108) | **SPLIT** | `access/{session,authority,authorise,resolve}` + `platform` + `gateways/storage` | fail-closed guard PRESERVED verbatim |
| `requireRole(...)` | **REPLACE STRUCTURE** | `access/authorise.ts`, capability-keyed | C-40 |
| `server/config/database.ts` | **SPLIT + BOUNDARY** | `platform/db/{read,transaction,pool,console}.ts` | branded handles — C-74; header comment corrected (C-42) |
| `server/config/consoleDb.ts` | **KEEP + BOUNDARY** | `platform/db/console.ts` | least-privilege pool PRESERVED |
| `server/config/env.ts` | **KEEP** | `platform/config/env.ts` | Zod validation preserved |
| `server/core/errors.ts` | **KEEP** | `server/core/errors.ts` | 10 AppError classes; now consumed at one edge |
| `server/console/{audit,operations}.ts` | **MOVE + SPLIT** | `modules/platform-ops/investigation/` + `modules/audit/` | tiering PRESERVED |
| `server/services/enrollment-import/` | **MOVE** | `application/import-enrolments/` | shape already correct |
| `server/services/payment-verification/` | **MOVE** | `gateways/payments/` + `modules/settlement/` | shape already correct |
| `server/email.ts` (19 senders) | **MOVE + BOUNDARY** | `gateways/email/` | 12 direct importers removed |
| `server/storageProvider.ts` | **KEEP + BOUNDARY** | `gateways/storage/` | seam already correct |
| `server/paymentIntegration.ts` | **MOVE** | `gateways/payments/` | HMAC fail-closed PRESERVED |
| `server/custody.ts` · `mfa.ts` · `branding.ts` | **MOVE** | `modules/custody` · `modules/identity` · `modules/tenancy` | |
| `server/routes/cron.routes.ts` | **SPLIT** | `http/routes/cron.ts` + `modules/scheduled-work` + `platform/jobs` | drain budget PRESERVED |
| `server/storage.ts` memory mode | **LEGACY — REMOVE STAGE 22** | none | C-71 |
| `client/src/App.tsx` | **REPLACE STRUCTURE** | `apps/app/app.tsx` — composed route entries | no `allowedRoles`, no `:section?` |
| `client/src/components/layout.tsx` (635) | **REPLACE STRUCTURE** | `apps/app/shell/` — composed navigation | C-40 · C-50 |
| `client/src/lib/role-routes.ts` | **REPLACE STRUCTURE** | capability-derived landing | C-40 |
| `client/src/pages/admin.tsx` (143) | **REPLACE STRUCTURE** | per-work-area route entries | 31-entry switch removed |
| `client/src/pages/admin/*` (28 files) | **SPLIT** | nine `bands/school/` work areas | Stage 9 alignment |
| `client/src/pages/admin/owner.tsx` (1,208) | **MOVE** | `bands/platform/` | **C-44** |
| `client/src/pages/admin/db-console.tsx` (606) | **MOVE** | `bands/platform/operations/investigate/` | arbitrary SQL → LEGACY |
| `client/src/pages/admin/{website,it-dashboard,media-library}.tsx` | **MOVE** | `bands/studio/` | |
| `client/src/pages/finance.tsx` (962) | **MOVE** | `bands/school/money/` | **C-50** — a work area, not a shell |
| `client/src/pages/teacher.tsx` (1,010) | **MOVE + SPLIT** | `bands/school/distribution/handheld/` | DS-P10 preserved |
| `client/src/pages/parent.tsx` (1,489) | **MOVE + SPLIT** | `bands/family/` | no global selected school |
| `client/src/pages/school-public.tsx` (210) | **REPLACE STRUCTURE** | `apps/site/` | **AQ-1 = B**; old route LEGACY |
| `client/src/pages/{login,register,accept-invite,forgot,reset,security}.tsx` | **MOVE** | `bands/entry/` | |
| `client/src/components/ui/` (56) | **MOVE** | `apps/common/ui/` | |
| `client/src/components/ui/material-symbol.tsx` | **LEGACY — REMOVE STAGE 22** | none | **C-54** |
| `client/src/components/query-state.tsx` | **MOVE + ADOPT** | `apps/common/patterns/QueryState.tsx` | **C-32** — 0 of 42 today |
| `client/src/lib/format.ts` | **MOVE** | `shared/format/` | **C-33** |
| `client/src/lib/errors.ts` | **MOVE** | `apps/common/errors.ts` | 4 of 42 today |
| `client/src/lib/branding.ts` | **REPLACE STRUCTURE** | `apps/common/theme/branding.ts` — `--brand-*` only | **C-52 · C-53** |
| `client/src/lib/queryClient.ts` | **REFACTOR** | freshness classes replace `staleTime: Infinity` | Stage 18 sets values |
| `client/src/index.css` — shadcn tokens | **KEEP** | `apps/common/theme/tokens.css` | light only |
| `client/src/index.css` — MD3 token block | **LEGACY — REMOVE STAGE 22** | none | **C-54** |
| `client/src/index.css` — `.dark` + `@custom-variant dark` | **LEGACY — REMOVE STAGE 22** | none | **C-55**; Stage 10 said keep for now |
| `client/src/lib/features/{auth,books,payments}/` (empty) | **REMOVE STRUCTURE** | none | C-42 cleanup |
| `server/repositories/drizzle/` (empty) | **REMOVE STRUCTURE** | superseded by module `data.ts` | C-42 cleanup |
| `client/src/pages/admin/students.tsx` XLSX import | **REPLACE STRUCTURE** | `gateways/spreadsheet/` | **C-58**; Stage 22 selects the survivor |
| `tests/*.ts` (11 flat) | **KEEP + BOUNDARY** | `tests/` + `tests/support/` factories | Stage 20 owns strategy |
| `api/index.ts` · `vercel.json` | **DEFER** | — | **Stage 21** |
| `migrations/` · `drizzle.config.ts` | **DEFER** | — | **Stage 15 / 21** |
| `script/` · `utils/` | **DEFER** | — | Stage 22 |

**Forty-nine rows. No file was moved.**

---

## 39. Application architecture decisions — index

**APP-001 … APP-049**, contiguous. Full entries appear in the sections above. APP-047, APP-048 and
APP-049 were added at owner review (Corrections 2, 3 and 6) and are numbered after the existing set —
**no existing identifier was renumbered.**

| ID | Decision | § |
|---|---|---|
| APP-001 | Three source roots: `apps/`, `server/`, `shared/` | 5 |
| APP-002 | `server/` organised by responsibility | 5 |
| APP-003 | `bands/school` by work area, not role | 6.1 |
| APP-004 | `bands/family` child-scoped, no global school | 6.1 |
| APP-005 | Studio is a Core-styled band | 6.2 |
| APP-006 | Platform is its own band | 6.3 |
| APP-007 | Support mode: one entry point | 6.4 |
| APP-008 | Break-glass outside ordinary navigation | 6.5 |
| APP-009 | Bounded investigation as Platform tooling | 6.6 |
| APP-010 | Navigation composed from capability reach | 7 |
| APP-011 | Explicit routes, separate from authorisation | 8 |
| APP-012 | Four component levels | 9 |
| APP-013 | `QueryState` is the only path to rendered data | 10 |
| APP-014 | Query keys and invalidation per work area | 10 |
| APP-015 | One error boundary each direction | 10 |
| APP-016 | One formatting home | 10 |
| APP-017 | One token layer, one icon set, light only | 11 |
| APP-018 | A handler does five things | 13 |
| APP-019 | Transport cannot reach persistence | 13 |
| APP-020 | `Principal` has no role | 14 |
| APP-021 | One capability vocabulary | 15 |
| APP-022 | Ownership proven by type | 15 |
| APP-023 | One file per business act | 16 |
| APP-024 | One directory, one entry point per module | 17 |
| APP-025 | `storage.ts` → 13 module data layers (14 modules; MOD-010 has none) | 18 |
| APP-026 | Scope is a required closed-union value | 19 |
| APP-027 | I-2: one coordinator, one transaction | 21 |
| APP-028 | Read and transactional handles differ by type | 22 |
| APP-029 | Reporting is a leaf | 23 |
| APP-030 | Public site is a separate entry and build target | 25 |
| APP-031 | Published composition, not field-stripping | 25 |
| APP-032 | No per-school code, no developer deploy | 25 |
| APP-033 | Four publication responsibilities | 26 |
| APP-034 | Storage behind a gateway | 27 |
| APP-035 | Workbook parsing server-side only | 27 |
| APP-036 | Modules express eligibility; gateways deliver | 28 |
| APP-037 | Payments behind a gateway | 28 |
| APP-038 | Cron invokes; MOD-014 owns | 29 |
| APP-039 | One public school resolution boundary | 30 |
| APP-040 | Audit and logging: two homes | 31 |
| APP-041 | Health infrastructure home | 32 |
| APP-042 | Substitutes replace infrastructure only | 33 |
| APP-043 | Shared code is admission-controlled | 34 |
| APP-044 | The dependency direction | 35 |
| APP-045 | Four enforcement mechanisms | 36 |
| APP-046 | Five migration seams | 37 |
| APP-047 | One TypeScript configuration family, several project scopes | 5 |
| APP-048 | Who owns a transaction depends on the command | 21 |
| APP-049 | Named job handlers are the only gateway caller | 29 |

---

## 40. Codebase architecture risks

| ID | Risk | Likelihood | Impact | Mitigation in this document |
|---|---|---|---|---|
| **CR-001** | Over-fragmentation — hundreds of ceremonial files, one per directory | MEDIUM | MEDIUM | CA-P15 · APP-024's four-file module pattern · no `controllers/services/repositories` ceremony |
| **CR-002** | `server/application/` becomes a new god layer | MEDIUM | HIGH | APP-023's import rule: module entry points + `withTransaction` + `shared`, nothing else; no use case may import another |
| **CR-003** | Module entry points re-export so much they become `storage.ts` again | MEDIUM | HIGH | An entry point exports operations and read interfaces, never `data.ts`; §36 mechanism 3 |
| **CR-004** | Circular module imports once modules call modules | MEDIUM | MEDIUM | §17's dependency column is acyclic by construction; CI boundary check (§36) |
| **CR-005** | The public bundle imports private code through `apps/common` | MEDIUM | **VERY HIGH** | APP-047 project scopes (§36 mechanism 1) — the import does not resolve; `apps/common` is in both scopes and may import neither app |
| **CR-006** | A transaction runs on the wrong adapter | **HIGH today** | **VERY HIGH** | APP-028 branded handles — a compile error, not a review item; APP-048 keeps `Tx` constructible only inside the runner. This risk is **C-74** until then |
| **CR-007** | `shared/` becomes a dumping ground again | HIGH | MEDIUM | APP-043's explicit admission list and forbidden list; no `helpers` file may exist |
| **CR-008** | Capability definitions duplicated between client and server | MEDIUM | HIGH | APP-021 — one `shared/capabilities.ts`, imported by both; duplication is forbidden by §35 |
| **CR-009** | Migration bridges become permanent — `storage.ts` never empties | **HIGH** | MEDIUM | APP-046 seam 1 makes narrowing measurable (method count); Stage 22 owns the schedule and must track it |
| **CR-010** | Test doubles diverge again once factories are convenient to fake | MEDIUM | HIGH | APP-042 — substitutes may replace gateways only; no business rule may be re-implemented |
| **CR-011** | `bands/platform` acquires school-customer assumptions | MEDIUM | HIGH | APP-006's forbidden list; `support/` is the only composition point |
| **CR-012** | Studio and public site share unsafe code for convenience | MEDIUM | **VERY HIGH** | §35 — `apps/site` may import only `apps/common` and `shared/contracts`; Studio is in `apps/app` |
| **CR-013** | Nine work areas fragment into per-screen folders | MEDIUM | LOW | APP-003 fixes the grouping at work-area level, matching Stage 9 |
| **CR-014** | Two frontend build targets drift — a fix lands in one | MEDIUM | MEDIUM | Genuinely shared material lives in `apps/common`; the surface areas are deliberately small |
| **CR-015** | Branding regains semantic-token reach through a "temporary" escape hatch | MEDIUM | HIGH | APP-017 — `applyBranding`'s parameter type admits only `--brand-*`; there is no escape hatch to add without changing a public type |
| **CR-016** | Lint boundaries stay in warn mode forever | **HIGH** | MEDIUM | §36's graded adoption must name an owner per boundary; Stage 22 tracks the flips |
| **CR-017** | The scope union is widened with an "optional" third case under delivery pressure | MEDIUM | **VERY HIGH** | APP-026 — `Scope` is closed; `PlatformScope` requires a named reason and is constructible in two places only |

| **CR-018** | `application/jobs/` becomes a second god layer, or a job handler starts owning business truth | MEDIUM | HIGH | APP-049 — one file per job, one exported function, no handler may import another; business truth is recorded through the owning module |

Eighteen risks. **These are physical/codebase risks and do not duplicate Stage 12's AR-001…AR-015**,
which are runtime and system risks; CR-006 is the codebase expression of the transaction-path risk that
Stage 12 recorded only as a requirement.

---

## 41. Existing conflicts addressed

**Terminology, normalised at owner review (Correction 8).** Every row below is **TARGET ARCHITECTURE
RESOLVED, IMPLEMENTATION OPEN**. Stage 13 has placed the physical boundary or structure that makes the
fix possible. **No implementation has been done, and no conflict is fixed in code.** A document
containing a target does not repair a running system.

| Conflict | What Stage 13 places | Resolved by |
|---|---|---|
| **C-32** query-state adoption | APP-013 — `QueryState` structural, lint-enforced | Stage 22 adoption |
| **C-33** scattered formatting | APP-016 — `shared/format/` | Stage 22 |
| **C-40** role-keyed authorisation | APP-021 vocabulary · APP-010 nav · APP-011 routes · APP-020 `Principal` | Stage 16 algorithm |
| **C-42** storage monolith | APP-025 decomposition · APP-019 transport prohibition · APP-024 entry points | Stage 22 |
| **C-43** shared schema | APP-043 — tables importable only by module `data.ts`; contracts split out | Stage 15 |
| **C-44** Platform/Core shell mixing | APP-006 — own band, shell, navigation, routes · TARGET RESOLVED, IMPLEMENTATION OPEN | Stage 22 |
| **C-45** reporting direction | APP-029 — no `data.ts`, no reverse import · TARGET RESOLVED, IMPLEMENTATION OPEN | Stage 22 |
| **C-50** admin + AUTH-FINANCE | APP-003 — Money is a work area · APP-010 capability nav · TARGET RESOLVED, IMPLEMENTATION OPEN | Stage 22 |
| **C-52** branding overwrites focus | APP-017 — `applyBranding` cannot address `--ring` | Stage 22 removal of legacy |
| **C-53** branding becomes primary | APP-017 — disjoint `--brand-*` namespace | Stage 22 |
| **C-54** two token and icon systems | APP-017 — one layer, one icon set; MD3 + Material Symbols LEGACY | Stage 22 removal |
| **C-55** dark theme unreachable | APP-017 — light-only target; `.dark` LEGACY, **not removed here** | Stage 22 |
| **C-57** direct upload path | APP-034 — permission → direct upload → finalisation, behind a gateway | Stage 17 provider |
| **C-58** client workbook parsing | APP-035 — `gateways/spreadsheet/`; `xlsx` banned in `apps/**` | Stage 22 selection |
| **C-62** logging and correlation | APP-040 — `platform/observability` separate from MOD-013 | Stage 21 |
| **C-64** optional tenant scope | APP-026 — `Scope` required, closed union; `schoolFilter` disappears | Stage 15/16 backstops |
| **C-66** resource ownership | APP-022 — `ClaimedId` → `Resolved<T>` in the owning module | Stage 16 algorithm |
| **C-67** session-cached authority | APP-020 — `Principal` carries no role; `authority.ts` resolves live | Stage 16 timing |
| **C-68** public `/uploads` | APP-034 — removed from target architecture | Stage 22 removal |
| **C-69** health not proven | APP-041 — `platform/health/` with three levels | Stage 14/21 |
| **C-70** raw internal errors | APP-015 — one error edge in each direction | Stage 14/16 |
| **C-71** dual persistence semantics | APP-042 — real-Postgres factories; memory mode LEGACY | Stage 22 removal |

---

## 42. Conflicts carried forward, unchanged by Stage 13

**C-1 … C-31 · C-34 … C-39 · C-41 · C-46 · C-48 · C-49 · C-51 · C-56 · C-59 · C-60 · C-61 · C-63 ·
C-65 · C-72 · C-73** remain **OPEN and unchanged**. Stage 13 neither resolves nor amends them.

Three deserve a note, because Stage 13 touches their surroundings without touching them:

- **C-65** (no database tenant integrity) — APP-026 fixes the *application* layer only. The database
  backstop remains **Stage 15**, and C-65 is not narrowed by this document.
- **C-72** (deployment applies no migrations, gates on nothing) and **C-73** (console controls depend on
  a migration CI skips) — APP-009 gives the console a target home; **neither conflict is affected**,
  because both are deployment-gating defects owned by **Stage 21**.
- **C-47** remains **WITHDRAWN / NOT APPLICABLE**, identifier preserved, as locked at Stage 9.

**C-47 is not reused. No identifier has been renumbered.**

---

## 43. New conflicts

Two were raised in the PROPOSED draft. **One survives owner review.**

- **C-74 — ACTIVE / OPEN** until implementation. A distinct defect present in the tree today, not
  *"files have not yet been rearranged"*.
- **C-75 — WITHDRAWN AS DUPLICATIVE OF C-42**, identifier preserved, never reused.

### C-74 — **OPEN** · The read handle and the transactional handle are the same type, so I-2 can be run on a driver that cannot honour it

**Current architecture.** `server/config/database.ts` declares one type for both drivers:

```ts
export type AppDatabase = NodePgDatabase<typeof schema>;              // line 96
_db = drizzle(neon(env.DATABASE_URL), { schema }) as unknown as AppDatabase;   // line 113
export function getTxDb(): NodePgDatabase<typeof schema> { … }        // line 144
```

`getDb()` and `getTxDb()` therefore have **the same type**. `getDb().transaction(...)` compiles
cleanly. On a Neon host `getDb()` is the HTTP single-statement driver, which does not provide the
interactive transaction semantics I-2 requires.

**Why it is a defect and not a preference.** All four current transaction sites —
`storage.ts:2054`, `storage.ts:2218` (**I-2 itself**), `family-enrollment.routes.ts:1009`,
`enrollment-import/import-service.ts:459` — use `getTxDb()` correctly. The correctness is real. But it
rests entirely on developers reading a comment, and the comment is the only thing standing between the
product's atomic invariant and a driver that cannot deliver it. Stage 12 §18.1 and AD-012 lock the
*requirement*; nothing in the code expresses it.

**Not already represented.** C-71 concerns memory versus PostgreSQL semantics. Stage 12's §18.1
records the requirement, and AR-* records runtime risk; **no existing conflict records that the two
handles are indistinguishable at a call site.** Verified against C-1…C-73.

**Impact.** A future settlement path, a refactor, or an autocomplete choice can silently move I-2 onto
a non-transactional handle with no compile error, no test failure and no review signal. The failure
mode is a partially applied settlement — precisely the three states Stage 12 §17 makes impossible.

**Addressed by:** APP-028 (branded `ReadDb` / `Tx`). **Owner: Stage 22** to implement; **Stage 21** for
connection configuration.

---

### C-75 — **WITHDRAWN AS DUPLICATIVE OF C-42** · Identifier preserved, never reused

**Raised in the Stage 13 PROPOSED draft; withdrawn at owner review, 30 August 2026, before lock.**

**What was observed, and it is all still true as evidence.** `server/config/database.ts`'s header
states:

> *"Drizzle ORM + pg Pool setup — imported by repositories, NOT by routes. Follows the Dependency
> Inversion Principle: routes depend on the repository interface, not on this concrete infrastructure
> module."*

In the tree as read on 29 August 2026: `server/repositories/drizzle/` is **empty**;
`client/src/lib/features/{auth,books,payments}/` are **all empty**; and **eight route files** import
`drizzle-orm` or `shared/schema` directly — `auth`, `book`, `cron`, `family-enrollment`, `mfa`,
`notification`, `user`, `website` — with `family-enrollment.routes.ts` alone calling `getDb()` at more
than twenty sites.

**Why it is withdrawn.** Re-verified directly against C-42 at owner review. C-42 already records the
storage/data-access monolith, the transport/persistence coupling, and direct route persistence access.
Against C-42, the proposed C-75 has:

| | C-42 | proposed C-75 |
|---|---|---|
| underlying defect | transport reaches persistence; no module-owned data layer | identical |
| target architecture | APP-019 · APP-024 · APP-025 | identical |
| remediation | make the boundary real; decompose `storage.ts` | identical |
| implementation owner | Stage 22 | identical |

Same defect, same target, same remediation, same owner. **A stale comment and empty scaffolding are
useful evidence of C-42, not a second architectural conflict.** The conflict register exists to track
distinct defects, and inflating it with a restatement of one makes it less useful, not more.

*Direct re-verification found no independent consequence.* The misleading assertion is remedied by
exactly the work that remedies C-42 — once transport cannot reach persistence, the comment becomes
true; once module `data.ts` layers exist, the empty `repositories/drizzle/` is superseded. There is no
outcome that C-42's remediation leaves standing.

**Carried forward as C-42 evidence and Stage 22 cleanup:** deleting `server/repositories/drizzle/` and
`client/src/lib/features/{auth,books,payments}/`, and correcting `database.ts`'s header comment so the
repository stops misrepresenting its own structure (§38 retains both rows).

**The identifier C-75 is preserved historically and is never reused.** The next new conflict
identifier is **C-76**.

**After this withdrawal, Stage 13 raises exactly one active new conflict: C-74.**

---

## 44. Owner decisions required

```
OPEN STAGE 13 OWNER QUESTIONS: 0
```

**No CQ-* question is raised, and this is a deliberate finding rather than an omission.**

The instruction reserves owner questions for materially different **physical application architecture**
choices requiring an owner-level commercial or operational judgement, and forbids asking merely because
implementation alternatives exist. Every remaining choice in this document was resolvable from locked
requirements and repository evidence:

- **The public website's physical shape** was the strongest candidate. AQ-1 = B already settled the
  product question. What remained — a separate entry and build target versus server-rendering inside
  the existing Express application — is settled by Stage 12 §5.1's own recorded rationale for choosing
  B: that the public edge should carry *no authenticated application code at all*. Only the separate
  target delivers that. This is an architectural derivation, not an owner judgement (**APP-030**).
- **Repository shape** — `apps/` versus keeping `client/` — follows from AQ-1 = B requiring two
  frontends. Not an owner question.
- **Module layout depth** is governed by CA-P15 and by the two correct service directories already in
  the repository. Not an owner question.

**One decision is flagged forward rather than asked here.** Within APP-030's structure, the public
site's **rendering timing** — prerender at publish, or render on request behind a cache invalidated at
publish — has a genuine operational consequence a school would feel: how quickly an urgent notice
appears after PUBLISH. **That is a Stage 21 deployment decision**, it does not change any Stage 13
boundary, and both are supported by the structure decided here. It is recorded so Stage 21 cannot
inherit it silently.

---

## 45. What Stage 13 deliberately does not decide

| Not decided | Owner |
|---|---|
| Endpoint URLs · verbs · request/response schemas · error JSON shapes · health endpoint contract | **Stage 14** |
| Tables · columns · indexes · foreign keys · RLS · SQL · migration contents · `shared/schema.ts` organisation · draft/published representation | **Stage 15** |
| Permission algorithm · scope and condition evaluation · revalidation timing · ownership-resolution semantics · Argon2 parameters · TOTP · CSRF · rate limiting · upload scanning · signed-URL duration | **Stage 16** |
| Object-storage provider · email provider and templates · payment provider · webhook signature mechanism · workbook library version · domain and DNS mechanisms | **Stage 17** |
| `staleTime` values · scale thresholds · job concurrency · read performance | **Stage 18** |
| Audit record schema | **Stage 19** |
| Test strategy, coverage and framework selection | **Stage 20** |
| Deployment pipeline · `vercel.json` · region configuration · release gating · **public-site rendering timing** · cache invalidation | **Stage 21** |
| Migration order · which duplicate legacy implementation survives · when each legacy item is removed · when each lint boundary flips to error | **Stage 22** |

---

## 46. Success criteria — answered

```
Is this still one application?                              → YES.  One repo, one package, one
                                                                    authority boundary.
Are modules separate services?                              → NO.   No network call between modules.
Can a route directly query Drizzle?                         → target says NO.  APP-019, three mechanisms.
Does storage.ts remain the god persistence layer?           → target says NO.  APP-025, narrowed by
                                                                    delegation, then deleted.
Do modules own their persistence?                           → YES.  APP-024 · APP-025.
Who coordinates I-2?                                        → application/confirm-settlement.ts
Who owns the underlying facts?                              → MOD-007 settlement · MOD-008 allocation ·
                                                                    MOD-005 stock. Each its own.
Can I-2 use Neon HTTP single-statement mode?                → NO.   APP-028 makes it a compile error.
Is tenant scope optional in target persistence?             → NO.   APP-026.
Can missing tenant mean all tenants?                        → NO.   Absence is a compile error.
Does session.role remain authority?                         → NO.   APP-020 — Principal has no role.
Does navigation determine permission?                       → NO.   APP-010 — presentation only.
Can school_admin + AUTH-FINANCE reach Money in one context? → YES.  APP-003 — a work area, not a shell.
Does Platform use the school-admin shell with null school?  → NO.   APP-006.
Is Website Studio still inside authenticated ScholarShelf?  → YES.  APP-005.
Do schools need to touch code to manage websites?           → NO.   APP-032.
Is the public website physically distinct from the SPA?     → YES.  APP-030 — own entry, own build,
                                                                    own TypeScript project scope.
Does the public website consume operational modules?        → NO.   APP-031 — one published read
                                                                    interface; the import cannot resolve.
Is the public website rendered/static as locked by AQ-1?    → YES.  APP-030.
Was a new frontend framework introduced?                    → NO.   React 19 + Vite 7 + Express 5.
                                                                    No Next.js. No meta-framework.
Does CMS theme restyle the operational application?         → NO.   APP-005 · APP-017 — disjoint
                                                                    namespaces.
Can school branding override semantic action/focus tokens?  → NO.   APP-017 — the function's parameter
                                                                    type admits only --brand-*.
Is the operational app light-only?                          → YES.  APP-017. Legacy dark code stays
                                                                    until Stage 22.
Can Reporting own settlement?                               → NO.   APP-029 — no data.ts, no reverse
                                                                    import.
Can Resend be called from random routes?                    → target says NO.  APP-036.
Can Cron own durable job truth?                             → NO.   APP-038 — MOD-014 owns it.
Does technical logging equal audit?                         → NO.   APP-040 — two homes.
Can tests use divergent production semantics?               → target says NO.  APP-042.
Can Stage 13 be migrated incrementally later?               → YES.  APP-046 — five seams.
Were API endpoints designed?                                → NO.
Were database tables designed?                              → NO.
Was deployment configured?                                  → NO.
```

---

## 47. Diagrams

**1 · Target repository topology**

```
scholarshelf/
├── apps/  app/ · site/ · common/
├── server/  http/ · access/ · application/ · modules/ · gateways/ · platform/
├── shared/  capabilities · contracts/ · format/ · validation/ · constants
├── migrations/ · tests/ · script/
└── package.json · tsconfig.base|app|site|server.json · vite.*.config.ts · vercel.json
        ONE repository · ONE package · ONE config family · NO workspaces
```

**2 · Authenticated frontend physical structure**

```
apps/app/  main.tsx → app.tsx (route table)
   ├── shell/     AppShell · navigation (composed) · identity
   ├── access/    useSession · useActiveContext · useCapability
   └── bands/
        entry/    school/{today school people books requirements
                          distribution/handheld money insight administration}
        family/   studio/   platform/{tenants operations support break-glass}
```

**3 · Public website physical structure**

```
apps/site/  entry.tsx
   ├── resolve/        which school?          → MOD-001
   ├── sections/       home about admissions classes news events gallery contact
   └── presentation/   --site-* namespace
        imports: apps/common · shared/contracts · shared/format      ONLY
        cannot resolve: apps/app · server/** · any auth hook
```

**4 · Backend physical structure**

```
server/
  http/        server · middleware · routes (transport) · error-boundary
  access/      session · authority · authorise · resolve
  application/ one file per cross-module business act
  modules/     MOD-001…MOD-014  (index.ts · operations · data · types)
  gateways/    MOD-015  email · storage · payments · spreadsheet
  platform/    db · observability · health · jobs · config
```

**5 · Module ownership map**

```
tenancy(001) ─┬─ identity(002) ── audit(013)
              ├─ academic(003) ── families(004) ── requirements(006)
              ├─ catalogue(005) ─────────┤              │
              │                          ├── custody(008)
              │                          └── settlement(007)
              ├─ communication(009)   website(011)   platform-ops(012)
              ├─ scheduled-work(014)
              └─ reporting(010)  ◀── reads only, depended on by NOTHING
gateways(015) ── outside the business boundary entirely
```

**6 · Request and import dependency direction**

```
http ──▶ access ──▶ application ──▶ modules ──▶ platform/db
  ✗        ✗            ✗              ✗
  └── no Drizzle · no schema tables · no gateway · no module internals
modules ──▶ shared            gateways ──▶ shared            platform ──▶ shared
```

**7 · Cross-module orchestration**

```
                    application/<business-act>.ts
                    owns: sequencing + transaction scope
                    owns: NO business truth
                    may import: module index.ts · withTransaction · shared
                                          │
        ┌─────────────────┬───────────────┼───────────────┐
   modules/A          modules/B      modules/C       modules/D
   owns fact A        owns fact B     owns fact C     owns fact D
```

**8 · I-2 physical transaction flow**

```
http/routes/settlement  →  access (context · capability · Resolved<Payment>)
                        →  application/confirm-settlement.ts
                        →  platform/db.withTransaction( tx => {
                              modules/settlement.confirmSettlement(scope, tx, …)   MOD-007
                              modules/custody.allocate(scope, tx, …)               MOD-008
                              modules/catalogue.recordStockMovement(scope, tx, …)  MOD-005
                           })                                    ONE COMMIT
                        →  modules/communication  (durable truth)
                        →  gateways/email         (eligible — AFTER commit, never inside)
```

**9 · Tenant-scoped persistence path**

```
access/authority ──▶ Scope = TenantScope{schoolId} | PlatformScope{reason}
                              │  required first parameter, every data function
                              ▼
modules/<m>/data.ts(scope, …)        ── no overload without it, no default
                              ▼
platform/db.getReadDb() | tx
        absence is a COMPILE ERROR, never a missing WHERE clause
```

**10 · Session / live-authority separation**

```
cookie ──▶ access/session.ts   ──▶ Principal { userId }        ← no role, by type
                                        │
                                        ▼
           access/authority.ts  ──▶ ActiveContext { context · authorities ·
                                        capabilities · scope }     resolved LIVE
                                        │
                                        ▼
           access/authorise.ts  ──▶ capability × resource × scope × conditions
```

**11 · Application bands**

```
apps/app  ┌── CORE      bands/entry · bands/school · bands/family
          ├── CMS       bands/studio
          └── PLATFORM  bands/platform  (support/ is the only bridge to CORE)
apps/site ─── PUBLIC EDGE   published content only · own build · own tsconfig scope (APP-047)
```

**12 · CMS draft → publish → public**

```
bands/studio  ──▶ modules/website (authoring)  ──▶  DRAFT
                          │
                          ├──▶ bands/studio/preview     authenticated, never public
                          │
                          └──▶ application/publish-website.ts   MOD-011 + MOD-001 + MOD-013
                                          │  one transaction
                                          ▼
                                     PUBLISHED
                                          ▼
                     modules/website.getPublishedSite()  ──▶  apps/site
```

**13 · UI and component hierarchy**

```
apps/common/ui/         primitives          Button · Dialog · Table · Form
apps/common/patterns/   product patterns    PageHeader · QueryState · EmptyState · DataTable
bands/**/               domain components   SettlementDecision · ChildHandover
bands/**/               screens             one per Stage 9 screen
   test for level 2: no domain vocabulary. Reuse count is NOT the test.
```

**14 · Query-state and error path**

```
modules  ──throw AppError──▶  http/error-boundary   THE only error→response point
                                     │  logs internally w/ correlation id
                                     ▼  safe classification
                        apps/common/errors.ts  ──▶  QueryState
                                                     LOADING · ERROR · EMPTY · REAL ZERO
                                        failure NEVER renders as zero
```

**15 · Job and scheduler physical path**

```
platform cron trigger ──▶ http/routes/cron.ts        authenticate · invoke · return
                                  ▼
                        platform/jobs/runner.ts       claim · execute within budget
                                  ▼
                        modules/scheduled-work        MOD-014 owns durable job truth
                                  ▼
                        owning modules                own the business consequences
                        NO queue · NO broker · NO event bus
```

**16 · External gateway boundary**

```
        BUSINESS BOUNDARY
modules/**  ── "delivery eligible" · "asset accepted" · "signal interpreted"
────────────────────────────────────────────────────────────────────────────
gateways/   email(Resend) · storage(S3-compatible) · payments · spreadsheet
        no module names a provider · no gateway holds business truth
```

**17 · Incremental migration coexistence**

```
storage.ts ──delegates──▶ modules/<m>/data.ts        legacy callers unchanged throughout
modules/<m>/index.ts ──re-exports──▶ existing code   entry points before internals move
@app/* ──aliases──▶ client/src/**                    screens move file by file
apps/site  built and served ALONGSIDE /school/:code  retire only after the new path is live
lint boundaries:  warn ──per boundary──▶ error       enforcement before completion
```

---

## 48. Traceability

| Locked source | How Stage 13 carries it |
|---|---|
| **MOD-001…MOD-015** | §17 — one physical home, dependency and prohibition each. MOD-015 under `gateways/`, outside the business boundary, per Stage 12 §38 |
| **Stage 7** authorities · SC-1…SC-12 · CD-1…CD-12 · 95 capabilities | APP-021 one vocabulary · APP-026 scope as a value · APP-022 ownership by type · algorithms deferred to Stage 16 |
| **PA-1** (`school_admin` + AUTH-FINANCE is one context) | APP-003 — Money is a work area; **C-50 target architecture resolved, implementation open** |
| **PA-2** (recovery requires support mode) | APP-007 — one support entry point |
| **MA-1** (allocation owned by MOD-008) · **MA-2** (MOD-001 owns CMS entitlement) | §17 ownership table · APP-005 · §6.2 |
| **Stage 9** — 6 surfaces, 103 screens, 9 work areas | §6 bands · APP-003 work areas · APP-012 level 4 |
| **UXQ-1** teacher handheld-first (DS-P10 / UX-P10) | APP-003 — `distribution/handheld/`; no hover-only architecture; touch-suitable controls |
| **UXQ-2** school/book language | preserved; no Stage 6 concept renamed anywhere in this document |
| **Stage 10** — DS-P1…DS-P12, DS-001…DS-035, DSQ-1 = A, DSQ-2 = A | APP-017 tokens · APP-012 hierarchy · APP-013 four query states · finance density preserved (§9) |
| **Stage 11** — TD-001…TD-045 | §1.3 and §4 — **the stack is reorganised, never rewritten**; no dependency added or removed |
| **Stage 12** — AD-001…AD-030 | AD-030/AQ-1 = B → APP-030…APP-032 · AD-012 → APP-028 · §16.1 → APP-023 · §17 → APP-027 · §10.3 → APP-026 · §11 → APP-022 · §8 → APP-020 · §20 → APP-034 · §22 → APP-036 · §23 → APP-038 · §26 → APP-009 · §27 → APP-040 · §28 → APP-015 |
| **AQ-1 = B** | APP-030 · APP-031 · APP-032 · APP-033 · APP-039 · §25 |
| **Corporate audit** — code-structure findings | 10.1–10.4 modularity → APP-002/APP-024 · 1.9 → APP-026 · 1.10 → APP-022 · 3.13 → APP-028 · 12.x logging → APP-040 · route/persistence coupling → APP-019 |

---

## 49. Summary

1. **15 codebase architecture principles**, CA-P1…CA-P15.
2. **49 application architecture decisions**, APP-001…APP-049, contiguous — APP-047, APP-048 and
   APP-049 added at owner review; nothing renumbered.
3. **18 codebase architecture risks**, CR-001…CR-018 — CR-018 added for the job-handler layer that
   Correction 6 introduced.
4. **One active new conflict, C-74.** C-75 was raised in the PROPOSED draft and **withdrawn at owner
   review as duplicative of C-42** — identifier preserved, never reused; its evidence is carried as
   C-42 evidence and Stage 22 cleanup. The next new identifier is **C-76**.
5. **Zero owner questions**, with one Stage 21 decision flagged forward rather than asked.
6. **Still one application.** One repository, one package, no workspaces, no services, no internal
   network calls, no queue, no broker, no event bus.
7. **AQ-1 = B made physical**: `apps/site` is its own entry point, build target and TypeScript project
   scope, consuming one published read interface. React 19 + Vite 7 + Express 5 unchanged.
8. **I-2 made structural**: a mutating module operation requires a `Tx`, and a `Tx` exists only inside
   `withTransaction` — while APP-048 keeps *who opens it* dependent on whether the command is
   single-module or cross-module, exactly as Stage 12 §16.1 locks. Required MOD-009 notification truth
   is written inside the same transaction; the provider call is always after commit.
9. **Nothing was implemented.** No code written or modified, no file moved, no folder created in the
   repository, no dependency installed, no route, schema, migration, authentication path, CI or
   deployment configuration altered.
10. **No production, security or legal clearance is granted.** The go-live block of 23 August 2026
    stands.

---

## 50. Locking discipline

```
STAGE 13 — PHYSICAL APPLICATION & REPOSITORY ARCHITECTURE
STATUS: LOCKED
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
Open owner questions: 0
```

The owner approves the Stage 13 target **subject to Corrections 1–8**, which are applied above and
recorded in place rather than made silently. Later stages **may** implement this architecture,
**may** discover implementation conflicts, and **may** record traceable owner amendments. They **may
not silently change** any of the following:

| Locked here | Requires a traceable amendment to change |
|---|---|
| Modular-monolith repository architecture | one repository, one package, no workspaces, no services |
| Core / CMS / Platform / public bands | §6 |
| **AQ-1 = B public/private build boundary** | APP-030 · APP-047 |
| The no-code website model | APP-032 — no per-school code, no developer deploy for content |
| `transport → authority → application/module` structure | APP-002 · APP-018 |
| Module-owned persistence | APP-024 · APP-025 |
| Tenant scope as a required value | APP-026 — absence is never a scope |
| Resource-ownership resolution | APP-022 — `ClaimedId` → `Resolved<T>` |
| The capability vocabulary | APP-021 — one shared list |
| The public/private compile boundary | APP-047 — project scopes, not lint alone |
| Reporting as a leaf | APP-029 — no `data.ts`, no reverse import |
| Notification truth versus delivery separation | APP-027 · APP-036 · APP-049 |
| The MOD-015 gateway boundary | APP-049 — job handlers are the only caller |
| The I-2 transaction path | APP-027 · APP-048 |
| `ReadDb` versus transaction-capable `Tx` | APP-028 — **not weakened by APP-048** |
| No successor god storage object | APP-025 |
| The incremental migration requirement | APP-046 — no big-bang is acceptable |

**Stage 13 approval ≠ production security clearance ≠ legal sign-off.** The BytHub Legal & Compliance
deployment halt and production go-live block of 23 August 2026 stands in full. No compliance claim is
made here, and no conflict is marked fixed in code.

```
STAGE 13 — PHYSICAL APPLICATION & REPOSITORY ARCHITECTURE
STATUS: LOCKED — 30 August 2026
Open owner questions: 0 · Active new conflict: C-74 · C-75 WITHDRAWN
Stage 14 is authorised.
```

---

## 51. Amendment register — amendments recorded after this stage was locked

**This section is append-only.** Each entry states the locked text it narrows, what changed, why, and
which stage raised it. **No locked text above is edited.** An amendment that cannot be expressed as a
narrowing of locked text is a conflict, not an amendment, and is raised as a `C-` identifier instead.

### A13-001 — Where `getReadDb()`'s Neon HTTP path may be used

```
RAISED BY:  Stage 15 (DATABASE_SCHEMA.md §7.7)
DATE:       30 August 2026
AFFECTS:    APP-028 · platform/db/read.ts
TYPE:       NARROWING — nothing is removed, no driver is dropped, I-2 is unchanged
STATUS:     RECORDED
```

**The locked text.** APP-028 establishes two nominally distinct handles and states of `ReadDb`:
*"May be Neon HTTP on Vercel — that is exactly what it is for."* That remains true, and remains the
reason the read handle exists.

**What Stage 15 discovered.** Stage 15's tenant-integrity decision (DBD-005, Option B+) puts
PostgreSQL row-level security on every school-owned operational table. An RLS policy reads its tenant
from a session setting, and the only pooling-safe way to establish that setting is `SET LOCAL` **inside
a transaction** (Stage 15 §7.4 — never a session-level `SET`, which a pooler can hand to the next
request). **The Neon HTTP driver cannot hold a transaction**, so it cannot carry `SET LOCAL`, so a
query issued through it **arrives with no tenant context**.

**The narrowing.** `ReadDb` is not withdrawn and the HTTP driver is not dropped. Its use is narrowed by
what the query needs:

| Read | Handle | Why |
|---|---|---|
| **unscoped or non-RLS** — public site rendering, health checks, platform-scope reads | **`ReadDb` — Neon HTTP is correct** | no tenant context is required, so none is missing |
| **scoped authenticated reads** — anything an RLS policy governs | **a transaction-capable connection** | `SET LOCAL` must be established, and only a transaction can hold it |

**What is not changed.** Both drivers remain in the stack exactly as Stage 11 locked them. `Tx` remains
branded and remains constructible only inside `withTransaction` (APP-048). **I-2's path is untouched** —
it was already required to use the node-postgres pool, and Stage 15's DBD-030 depends on that. C-74's
type-level remedy is unaffected: this amendment narrows *usage*, and C-74 concerns the *types*.

**Why an amendment and not a rewrite.** The locked sentence is not wrong; it is incomplete with respect
to a decision that did not exist when Stage 13 was written. Editing it in place would erase the record
that the constraint arrived from the database layer. **The locked text stands and this entry narrows
it, with its cause traceable to the stage that found it.**

```
STAGE 13 — PHYSICAL APPLICATION & REPOSITORY ARCHITECTURE
STATUS: LOCKED — 30 August 2026
Amendments recorded: A13-001 (raised by Stage 15)
Open owner questions: 0 · Active new conflict: C-74 · C-75 WITHDRAWN
```
