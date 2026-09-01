# TECH_STACK.md — Stage 11: Technology Decision Record

```
STAGE 11 — TECHNOLOGY DECISION RECORD
STATUS: LOCKED
Locked: 25 August 2026 by the owner (BytHub Technology Ltd)
Verification date: 25 August 2026
```

**What "locked" means here.** Later stages **may** implement these technology decisions, **may**
discover implementation conflicts with them, and **may** record traceable owner amendments. They
**must not** silently replace a locked technology decision. A conflict is flagged, not absorbed.

Each of the following would require a **traceable owner amendment**:

```
React                            → another frontend framework
PostgreSQL                       → another database
custom hardened authentication   → a managed identity provider
UK/EU processing policy          → provider-default / global processing
Node 24 LTS                      → a materially different runtime strategy
I-2                              → asynchronous or eventually-consistent settlement
```

**The last is prohibited outright** unless the earlier locked business architecture — Stage 8's
invariant I-2 — is itself formally amended first.

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` — **all LOCKED**.
**Compared against** `CURRENT_SYSTEM_MAP.md` · `CURRENT_BEHAVIOUR_BASELINE.md` ·
`RESTRUCTURE_STATE.md` · `REBUILD_SAFETY.md`, and the working tree at `C:\dev\scholarshelf` read
directly on **25 August 2026**.

**Technologies only.** No folder structure, service or repository classes, component trees, module
packages, API routes, endpoint contracts, tables, columns, indexes, transaction implementation,
permission algorithms, session data structures, queue topology, system architecture diagram, or
migration sequencing. **Nothing was installed, removed, upgraded or written to `package.json`.**

---

## 1. Purpose and decision principles

Stage 11 answers one question: **which technologies should ScholarShelf deliberately use to implement
the architecture locked in Stages 1–10?**

This is not a greenfield exercise. Roughly 50,200 lines of working TypeScript already exist. Every
decision therefore starts from what is there:

```
CURRENT TECHNOLOGY
        ↓
KEEP?  ·  UPGRADE?  ·  REPLACE?  ·  ADD?  ·  REMOVE?  ·  DELIBERATELY DO WITHOUT?
```

### The seven principles

**TP-1 — Replacement needs a ScholarShelf reason.** One of: a security problem · unmaintained or
end-of-life · a locked requirement that cannot be met · an unacceptable operational limit · material
simplification · a measurable cost or reliability benefit. *"Newer", "more popular"* and *"modern best
practice"* are not reasons.

**TP-2 — No rewrite by accumulation.** Replacing the frontend, backend, ORM, database and host at
once is a rewrite wearing an architecture document's clothes. The target shape is: **keep good
technology · remove accidental complexity · add missing infrastructure · replace only what has a
strong case.**

**TP-3 — I-2 is a veto.** Any proposal that makes settlement + allocation + stock movement harder to
perform as one synchronous database transaction is rejected unless the benefit is overwhelming (§33).

**TP-4 — Module boundary is not deployment boundary.** Stage 8 locked this. No technology here is
chosen on the assumption that a module becomes a service.

**TP-5 — ScholarShelf owns meaning; vendors own plumbing.** Authorisation semantics, business rules
and audit meaning are ScholarShelf's. Database engines, mail transport and object storage are not.

**TP-6 — Absence is a valid decision.** "No separate technology needed" is a real answer, and is used
where the evidence supports it.

**TP-7 — Verified, not remembered.** Versions, maintenance status and advisories were checked against
official sources on the verification date, not recalled. Where a figure could not be verified, it says
so.

---

## 2. Current verified stack

Read from the repository on 25 August 2026. **Where this differs from earlier documents, this section
is the corrected record** and the earlier locked documents are not edited.

### 2.1 Declared dependencies

| Layer | Verified |
|---|---|
| **Frontend** | React 19.2 · React-DOM 19.2 · Vite 7.1 · Wouter 3.3 · TanStack Query 5.60 · Tailwind CSS 4.1 (`@tailwindcss/vite`) · 30 Radix primitives · lucide-react 0.545 · react-hook-form 7.66 + `@hookform/resolvers` · recharts 2.15 · sonner · vaul · cmdk · embla · input-otp · react-day-picker · react-resizable-panels · html5-qrcode · jsbarcode · qrcode.react · next-themes · framer-motion · tw-animate-css · tailwindcss-animate · class-variance-authority · clsx · tailwind-merge |
| **Backend** | Node (unpinned) · Express 5.0 · express-session 1.19 · connect-pg-simple 10 · helmet 8.2 · multer 2.1 · file-type 22 · bcryptjs 2.4.3 · dotenv 17.4 · ws 8.18 · memorystore 1.6 |
| **Data** | PostgreSQL via `@neondatabase/serverless` 0.10 **and** `pg` 8.21 · drizzle-orm 0.39 · drizzle-zod 0.7 · drizzle-kit 0.31 |
| **Validation** | zod 3.25 · zod-validation-error 3.4 |
| **Email** | resend 6.12 |
| **Spreadsheet** | **xlsx 0.18.5** |
| **Tooling** | TypeScript 5.6.3 (pinned exactly) · tsx 4.20 · esbuild 0.25 · postcss · autoprefixer |
| **Unused-looking** | `@supabase/ssr` · `@supabase/supabase-js` · `passport` · `passport-local` · `framer-motion` · `date-fns` |

### 2.2 Configuration verified

| Item | Verified value |
|---|---|
| `package.json` name / licence | **`"rest-express"` / `"MIT"`** on a commercial product |
| `engines` field | **absent** · no `.nvmrc` |
| Lockfile | `package-lock.json` (npm) |
| TypeScript | `strict: true` · ES2022 · ESNext modules · `moduleResolution: bundler` · `noEmit` |
| Vercel | `maxDuration: 30` on `api/index.ts` · one cron `0 7 * * *` · SPA rewrites · full security-header block **including a CSP that competes with helmet's** |
| Vercel region | **not configured** → platform default |
| Migrations | **seven** `.sql` files present **and** `db:push` (`drizzle-kit push`) is the schema script |
| CI Node version | **`node-version: "20"`** |
| Tests | eleven `tsx` scripts in `tests/`, plus `script/smoke-boot.ts` |

### 2.3 Findings that change decisions

| Finding | Evidence |
|---|---|
| **All binary assets are base64 in Postgres** | `media_assets.data_uri` is `text` holding `data:<mime>;base64,…`; `school_branding` stores logo, favicon, banner, email logo and PDF logo the same way. **There is no object storage anywhere.** |
| **Upload caps exceed the platform's body limit** | Branding 5 MB, media 8 MB — against Vercel's **4.5 MB** request-body limit |
| **`xlsx@0.18.5` is the terminal npm release** | SheetJS moved distribution to its own CDN; the npm registry is stuck at 0.18.5, which predates the fixes for CVE-2023-30533 and CVE-2024-22363 |
| **`xlsx` is imported client-side** | `client/src/pages/admin/students.tsx` pulls the parser into the browser bundle |
| **No test framework exists** | Eleven hand-rolled `tsx` scripts using `console.log` and a local `expect` helper. No runner, no assertion library, no machine-readable output, no coverage |
| **No structured logging** | 55 `console.*` calls in `server/`; no logging library; no correlation identifier |
| **CI pins Node 20** | Which passed end of security support in April 2026 |
| **Two schema mechanisms** | `drizzle-kit push` **and** seven committed migrations, with CI deliberately skipping `001` |
| **Genuinely unused** | `@supabase/ssr`, `@supabase/supabase-js`, `passport`, `passport-local`, `framer-motion`, `date-fns` — **zero** importing files |
| **`memorystore` is used** | Imported by `server/app.ts` as a development session fallback — *not* unused, contrary to earlier records |
| **`ws` has no direct import** | Present as the WebSocket transport peer for `@neondatabase/serverless` |

> **Correction to earlier records.** Stage 0 listed `memorystore` among apparently unused
> dependencies. Verified on 25 August 2026: it **is** imported by `server/app.ts`. `framer-motion` and
> `date-fns` were **not** previously listed and **are** unused. The earlier locked documents are
> preserved unedited; the correction is recorded here.

### 2.4 Verified external limits and status

| Fact | Source | Verified |
|---|---|---|
| Vercel Functions: max duration Hobby 300s; Pro/Enterprise 300s default, **800s max, 1800s extended (beta)** | Vercel docs, *Functions Limits* | 25 Aug 2026 |
| Vercel Functions: **request/response body 4.5 MB**; memory 2 GB default / 4 GB Pro; **1,024 file descriptors shared**; single default region | Vercel docs, *Functions Limits* | 25 Aug 2026 |
| Vercel Workflows exists for work needing unlimited execution time | Vercel docs, *Functions Limits* | 25 Aug 2026 |
| **CVE-2023-30533** (prototype pollution) affects **all SheetJS ≤ 0.19.2**; fixed in **0.19.3** | SheetJS advisory | 25 Aug 2026 |
| **CVE-2024-22363** (ReDoS) — fixed in the 0.20.x line | SheetJS advisory | 25 Aug 2026 |
| SheetJS current release **0.20.3**, distributed from `cdn.sheetjs.com`; **the npm registry is out of date at 0.18.5** and SheetJS recommends vendoring | SheetJS docs, *Frameworks and Bundlers* | 25 Aug 2026 |
| **ExcelJS 4.4.0, published October 2023 · "Inactive" · no commits in two years · 1 critical + 2 high + 1 medium open vulnerabilities** | Snyk package page | 25 Aug 2026 |
| Node.js release status: **Node 26 — Current** · **Node 24 — LTS** · **Node 22 — LTS** · **Node 20 — EOL** | Official Node.js release table | 25 Aug 2026 |
| OWASP: **Argon2id is the recommendation** (≥19 MiB, t=2, p=1); **bcrypt is for legacy systems only**, work factor ≥10; bcrypt input capped at **72 bytes** | OWASP Password Storage Cheat Sheet | 25 Aug 2026 |

---

## 3. Decision matrix

| Area | Current | Decision | Target | Migration cost | Operational complexity |
|---|---|---|---|---|---|
| Frontend | React 19 | **KEEP** | React 19 | — | LOW |
| Language | TypeScript 5.6.3 | **KEEP + UPGRADE** | TypeScript current 5.x, range not pin | LOW | LOW |
| Build | Vite 7 | **KEEP** | Vite 7 | — | LOW |
| Router | Wouter 3 | **KEEP** | Wouter 3 | — | LOW |
| Server state | TanStack Query 5 | **KEEP** | TanStack Query 5 | — | LOW |
| Styling | Tailwind 4 | **KEEP** | Tailwind 4 | — | LOW |
| Components | Radix + shadcn | **KEEP** | Radix + shadcn | — | LOW |
| Icons | lucide **+** Material Symbols | **KEEP one, REMOVE one** | lucide-react | LOW | LOW |
| Tokens | shadcn **+** Material 3 | **KEEP one, REMOVE one** | shadcn/Tailwind CSS variables | MEDIUM | LOW |
| Charting | recharts | **KEEP** | recharts | — | LOW |
| Runtime | Node, unpinned; CI on 20 | **KEEP + UPGRADE + PIN** | Node 24 LTS, pinned | LOW | LOW |
| Server | Express 5 | **KEEP** | Express 5 | — | LOW |
| Database | PostgreSQL | **KEEP** | PostgreSQL | — | LOW |
| DB provider | Neon | **KEEP** | Neon — **UK/EU region required** [LOCKED TQ-1] | — | LOW |
| DB driver | Neon serverless **+** `pg` | **KEEP both** | URL-selected, unchanged | — | LOW |
| ORM | Drizzle 0.39 | **KEEP + UPGRADE** | Drizzle current | LOW | LOW |
| DB migrations | `drizzle-kit push` **and** 7 files | **REPLACE the process** | Generated, committed, reviewed migrations; **`push` never in production** | MEDIUM | LOW |
| Auth | custom session | **KEEP** | **custom, hardened** [LOCKED TQ-2] | — | MEDIUM |
| Session store | Postgres via connect-pg-simple | **KEEP** | Postgres-backed sessions | — | LOW |
| Password hashing | bcryptjs 2.4.3, cost 12 | **REPLACE** | **Argon2id**, with rehash-on-login | MEDIUM | LOW |
| MFA / TOTP | hand-rolled | **REPLACE** | maintained TOTP library | LOW | LOW |
| Object storage | **none** — base64 in Postgres | **ADD** | S3-compatible, signed direct upload, **UK/EU-capable** [TQ-1] | HIGH | LOW–MEDIUM |
| Upload handling | multer 2.1 (memory) | **KEEP**, scope reduced | multer for small server-side uploads only | LOW | LOW |
| Email | Resend | **KEEP** | Resend | — | LOW |
| Jobs | none | **ADD (minimal)** | durable job records in Postgres + platform execution | MEDIUM | LOW |
| Scheduler | Vercel Cron | **KEEP** | Vercel Cron | — | LOW |
| Cache | none | **NO SEPARATE TECHNOLOGY** | — | — | — |
| Search | none | **NO SEPARATE TECHNOLOGY** | PostgreSQL-native | — | — |
| Hosting | Vercel | **KEEP** | Vercel — raise the 30s cap; **UK/EU region required** [TQ-1] | LOW | LOW |
| Logging | `console.*` | **ADD** | structured JSON logger + correlation id | LOW | LOW |
| Error monitoring | **none** | **ADD** | one platform, front and back, **UK/EU-capable** [TQ-1] | LOW | LOW–MEDIUM |
| Unit testing | hand-rolled scripts | **ADD** | Vitest | MEDIUM | LOW |
| Integration testing | hand-rolled scripts | **ADD** | Vitest + real Postgres in CI | MEDIUM | MEDIUM |
| E2E testing | none | **ADD** | Playwright | MEDIUM | MEDIUM |
| Accessibility testing | none | **ADD** | axe-core via Playwright | LOW | LOW |
| Spreadsheet | **xlsx 0.18.5 (vulnerable)** | **KEEP + UPGRADE, change source** | **SheetJS 0.20.3+ from the SheetJS CDN, vendored** | MEDIUM | LOW |
| Validation | Zod 3.25 | **KEEP + UPGRADE** | Zod current | LOW | LOW |
| Realtime | none | **NO SEPARATE TECHNOLOGY** | — | — | — |
| Analytics | none | **DEFER** | — | — | — |
| Payments | none live | **DEFER** | provider chosen at Stage 17 | — | — |
| Unused deps | 6 packages | **REMOVE** | — | LOW | — |

---

## 4. Frontend

**TD-001 · Frontend framework**
*Requirement:* 103 locked screens across six surfaces · handheld-first teacher path · authority- and
entitlement-driven navigation · a strict query-state contract · WCAG 2.2 AA.
*Current:* React 19.2. *Evidence:* 42 page files, 56 shadcn primitives, the whole client written to it.
**Decision: KEEP.** *Why:* nothing in Stages 1–10 asks for anything React cannot do, and no TP-1
reason exists. React 19 is current and supported.
*Alternatives:* Vue, Svelte, SolidJS — all capable; none offers a ScholarShelf benefit that survives
a full client rewrite. *Migration cost:* — *Operational:* LOW.
*Conflicts affected:* none. *Later stages:* 13. *Owner decision:* NO.

**TD-002 · Language and typing**
*Current:* TypeScript **pinned exactly at 5.6.3**, `strict: true`, ES2022.
**Decision: KEEP + UPGRADE.** Move to the current 5.x line and stop pinning an exact patch — an exact
pin on a compiler blocks security and correctness fixes for no benefit. `strict: true` is retained and
is a genuine asset.
*Migration cost:* LOW (type errors surfaced by a newer compiler are found at build time).
*Later stages:* 13. *Owner decision:* NO.

**TD-003 · Build tool** — *Current:* Vite 7.1 + `@vitejs/plugin-react`. **Decision: KEEP.** Current,
maintained, fast, and already integrated with Tailwind 4 through `@tailwindcss/vite`. *Owner:* NO.

**TD-004 · Client routing**
*Requirement:* client-side routing for 103 screens across six surfaces, with the internal band
eventually separable (C-44).
*Current:* Wouter 3.3 — but note that `client/src/components/layout.tsx` navigates with raw
`window.history.pushState`, and `admin.tsx` resolves a section string against three allowlists.
**Decision: KEEP.** *Why:* Wouter is small, maintained and sufficient. The real routing problems in
this codebase are **architectural, not library-shaped** — the section-registry-plus-allowlist
mechanism (C-44) would be equally wrong under React Router. Swapping routers would change the import
and leave the defect.
*Alternatives:* React Router (larger, more capable, no capability ScholarShelf needs); TanStack Router
(excellent typing, but a full routing rewrite of 42 pages for type-safety alone fails TP-1).
*Later stages:* **13 owns the routing structure**, including whether the internal band gets its own
router. *Owner decision:* NO.

**TD-005 · Server-state management**
*Current:* TanStack Query 5.60, with `retry: false` configured.
**Decision: KEEP.** *Why:* it is exactly the right shape for the locked query-state contract — it
distinguishes loading, error, fetching and data natively, which is what §15 of `DESIGN_SYSTEM.md`
needs. **Note:** `retry: false` plus zero `QueryState` adoption is the mechanism behind C-32; the
library is not the problem.
*Later stages:* 13 owns adoption. *Owner decision:* NO.

**TD-006 · Styling** — *Current:* Tailwind CSS 4.1. **Decision: KEEP.** CSS-variable theming is
precisely what the locked branding boundary needs: identity tokens and semantic tokens can be
separated at the token layer, which is how C-52/C-53 get fixed. *Owner:* NO.

### 4.1 SSR — explicitly not required

The authenticated application is behind a login, is not indexed, and gains nothing from server
rendering. **No framework change for SSR.**

The **public school website (S-5)** is the only surface where rendering strategy is a real question —
it is public, may want indexing, and is optional per school. Stage 11 records the requirement and
**defers the mechanism to Stage 12**, which owns system topology. It does **not** justify moving the
whole application to a meta-framework.

---

## 5. UI / component technology

**TD-007 · Component primitives** — *Current:* 30 Radix packages under shadcn/ui. **Decision: KEEP.**
Radix is the strongest accessible-primitive foundation available for React, and Stage 10's dialog,
drawer, focus-trap and announcement requirements are exactly what it provides. shadcn's copy-in model
also means ScholarShelf owns its component source, which suits a design system that is itself locked.
*Owner:* NO.

**TD-008 · Icon system — the technology half of C-54**
*Current:* `lucide-react` in 39 of 42 page files; a `material-symbols-outlined` CSS class defined in
`index.css` with essentially no use.
**Decision: KEEP `lucide-react`, REMOVE Material Symbols.** *Why:* one system product-wide is a locked
Stage 10 rule; lucide is already the de-facto system, is an npm dependency rather than a remote font,
carries no extra network request, and tree-shakes.
*Migration cost:* LOW. *Later stages:* **13** applies it; **22** removes. *Owner:* NO.

**TD-009 · Design token system — the technology half of C-54**
*Current:* shadcn HSL semantic tokens **and** a block of Material 3 hex tokens
(`--color-primary-container`, `--color-surface-container-*`, `--color-outline`,
`--color-error-container`, …) in the same `@theme` block.
**Decision: KEEP the shadcn/Tailwind CSS-variable system, REMOVE the Material 3 block.** *Why:* the
CSS-variable system is what `DESIGN_SYSTEM.md` §4 is written against, what the verified contrast
annotations live on, and what allows identity tokens and semantic tokens to be separated (the C-52 and
C-53 fix). Two vocabularies license drift, which is TP-1's "material simplification" reason.
*Migration cost:* MEDIUM — every Material-token use must be traced first.
*Later stages:* **13** determines the physical token architecture; **22** removes. *Owner:* NO.

**TD-010 · Charting** — *Current:* recharts 2.15, used only by `components/ui/chart.tsx`.
**Decision: KEEP.** Stage 10 permits trends only where a direction changes what someone does today, so
the charting surface is small. No reason to change; no reason to expand.
*Note:* if Stage 13 finds `ui/chart.tsx` has no consumers, recharts becomes a **REMOVE** candidate at
Stage 22. Recorded, not decided. *Owner:* NO.

---

## 6. Backend / runtime

**TD-011 · Node runtime**
*Requirement:* a supported runtime for a live UK SaaS holding children's and financial data.
*Current:* **unpinned** — no `engines`, no `.nvmrc`; `@types/node ^20`; **CI pins `node-version: "20"`**.
**Verified:** Node 20 passed end of security support in **April 2026**. Node 22 is in maintenance
(security to April 2027). Node 24 is supported to April 2028.
**Decision: KEEP Node + UPGRADE + PIN.** Target **Node 24 LTS**, declared in `engines`, in `.nvmrc`,
in CI and in the platform runtime setting, with `@types/node` matched.
*Why:* running production on a runtime past security support is not a preference. Pinning also removes
a class of "works locally, fails on deploy" failures.
*Migration cost:* LOW. *Security:* this is the decision's entire justification.
*Conflicts affected:* **C-59** (new). *Later stages:* 13, 21. *Owner:* NO.

**TD-012 · HTTP framework**
*Current:* Express 5.0 with helmet 8.2 and express-session.
**Decision: KEEP.** *Why:* Express 5 is the current major line, has first-class async error handling,
the largest middleware ecosystem in Node, works unchanged under Vercel's Node runtime, and is already
the substrate for the single tenant-isolation choke point (`ensureSessionSchoolIsActive`) that Stage 7
depends on. Replacing it would mean rewriting that choke point — the highest-risk code in the product
— for no locked requirement.
*Alternatives:* Fastify (faster serialisation, better schema story — but ScholarShelf is not
throughput-bound, and the migration touches every route and every middleware); Hono (excellent on
edge runtimes, but the product needs full Node APIs); NestJS (imposes an opinionated module system
that would pre-empt Stage 13's decisions).
*Migration cost:* — *Operational:* LOW. *I-2:* unaffected — Express keeps request handling in one
process, which is what I-2 needs. *Owner:* NO.

---

## 7. Database engine

**TD-013 · Database engine**
*Requirement:* strong relational integrity · tenant isolation · money · stock · custody · immutable
history · auditability · **multi-statement ACID transactions (I-2)** · relational reporting.
*Current:* PostgreSQL. *Evidence:* 41 tables, 76 foreign keys, 42 indexes, a conditional
`UPDATE … WHERE status NOT IN (…) RETURNING *` claim-lock at the heart of settlement confirmation.
**Decision: KEEP.** *Why:* every one of the requirements above is a relational-database requirement,
and I-2 alone settles it — three modules' writes must succeed or fail together in one transaction.
*Alternatives:* **MongoDB / document stores — rejected.** Multi-document transactions exist but the
data is inherently relational, and "flexibility" is the opposite of what a locked model with 57
entities and immutable history wants. **MySQL — rejected**: no benefit, full migration. **SQLite —
rejected**: not a multi-tenant production posture.
*Migration cost:* — *Owner:* NO.

---

## 8. Database provider

**TD-014 · Database provider**
*Current:* Neon, reached through `@neondatabase/serverless` (HTTP/WebSocket) **or** node-`pg`, selected
by URL shape.
**Decision: KEEP.** *Why:* Neon's serverless driver exists precisely for the connection pattern
Vercel Functions create, and Vercel's **1,024 shared file descriptors** makes naive per-invocation
TCP pooling a real hazard. Neon also provides branching, which is directly useful for the reviewed-
migration process in TD-017.
*Verified caveat:* the driver choice matters for I-2. Neon's **HTTP** mode does not carry
multi-statement interactive transactions; its **WebSocket/pooled** mode and node-`pg` do. **The
settlement confirmation path must run on a transaction-capable connection.** That is a Stage 12/13
implementation obligation and is recorded here as a constraint on the technology, not as a design.
*Alternatives:* Supabase (would re-introduce a dependency this stage is removing, and bundles auth
ScholarShelf must not delegate — §11); AWS RDS / Aurora (more control, materially more operational
burden, worse serverless connection story); Vercel Postgres (tighter coupling — see **TQ-1**);
self-hosted (rejected: highest burden, no benefit).
**Region requirement [LOCKED TQ-1].**

```
Neon deployment
→ UK/EU region required
```

The **current production region has not been verified from the repository** and must be verified
during the later deployment and security work. **If it does not satisfy the policy, a planned region
migration is required.** **No database is migrated at Stage 11.**

*Vendor coupling:* MEDIUM — the wire protocol is Postgres, so an exit is a `pg_dump`/restore plus a
driver change, not a rewrite. *Later stages:* **16** verification · **21** any migration.
*Owner decision:* **DECIDED — TQ-1 = A.**

**TD-015 · Postgres driver** — **Decision: KEEP both**, selected by URL as today, with the explicit
constraint above. *Owner:* NO.

---

## 9. ORM

**TD-016 · ORM / query layer**
*Requirement:* TypeScript-native types · Postgres coverage · real transactions · relational queries ·
the ability for Stage 13 to enforce Stage 8's module ownership boundaries.
*Current:* drizzle-orm 0.39 + drizzle-zod, with ~305 methods in one 3,532-line `storage.ts`.
**Decision: KEEP + UPGRADE** to the current Drizzle line.
*Why:* Drizzle is a thin, SQL-shaped, fully typed layer — which is what a product with a conditional
claim-lock and a hard atomicity invariant wants. Its transaction API is explicit rather than magical,
which suits I-2.
**The important distinction:**

```
Drizzle ORM              ≠     one giant shared/schema.ts
the query technology            the organisation of the schema (C-43)

Drizzle ORM              ≠     one 3,532-line storage.ts
                                the absence of module boundaries (C-42)
```

**C-42 and C-43 are architecture problems, not ORM problems.** Drizzle imposes no single-file schema
and no god-object; both are choices this codebase made. Replacing the ORM would carry both defects
into the replacement.
*Alternatives:* Prisma (excellent DX and migration tooling, but a heavier runtime, a separate schema
language, and a transaction model further from raw SQL — and it would not fix C-42/C-43); Kysely
(very close in philosophy; no benefit worth a full data-layer rewrite); raw SQL (loses the typing that
`strict: true` currently earns).
*Migration cost:* LOW to upgrade. *Later stages:* **13** owns module-scoped data access; **15** owns
the schema's organisation. *Owner:* NO.

---

## 10. Database migration tooling

**TD-017 · Migration tooling and process** — *a real change.*
*Current, verified:* **both** mechanisms are present. `db:push` runs `drizzle-kit push` (diff and
apply, no history), **and** seven hand-written `.sql` migrations exist, of which CI deliberately
applies only `002`–`006` and **skips `001`**.
**Decision: REPLACE the process** — **generated, committed, reviewed migration files as the single
source of schema change; `drizzle-kit push` never runs against production.**
*Why:* `push` diffs a live database against a schema file and applies the difference. It has no
review step, no history, no ordering guarantee and no reliable down path. On a multi-tenant production
system holding money, stock and immutable history, that is an unacceptable operational limit (TP-1).
Two mechanisms is worse than either: nothing can state what the production schema is derived from.
*Target technology:* `drizzle-kit generate` producing versioned files, committed and code-reviewed,
applied by an explicit deployment step, with Neon branching used to rehearse against a copy.
`push` is retained **for local development only**.
*Migration cost:* MEDIUM — a baseline must be reconciled against the live schema before the first
generated migration, and `001`'s deliberate exclusion must be explained or resolved (**C-19**).
*Conflicts affected:* **C-19**, **C-61** (new). *Later stages:* **15** designs the schema; **21/22**
own execution. **No migration is written here.** *Owner:* NO.

---

## 11. Authentication

**TD-018 · Authentication technology** — *the largest judgement in this stage.*

*Current:* `express-session` + `connect-pg-simple` + `bcryptjs`, with hand-written sign-in, invitation
acceptance, reset, context switching and server-side TOTP. `passport` and `passport-local` are
installed and **unused**.

*What any candidate must support — all locked:*

```
PERSON → ACTIVE CONTEXT → ACTIVE AUTHORITIES → CAPABILITY → RESOURCE → SCOPE → CONDITIONS
```

several contexts per human · authorities separate from contexts · `school_admin` + AUTH-FINANCE with
**no context switch** (PA-1) · relationship-derived parent scope crossing schools · staffing-derived
teacher scope · named-school Support Mode (SC-6) · owner break-glass with time-boxed elevation · MFA
mandatory for platform authority · account recovery **inside** a support engagement (PA-2) · audit
attribution of the authority exercised, separately from the context.

**Decision: KEEP custom authentication — and harden it.** [LOCKED TQ-2 = A]

*Why:* the model above is not "one user, one role, one tenant". It is a person with several
simultaneously-valid contexts, authorities granted independently of contexts, and two scope systems
derived from live relational facts (staffing and guardianship) that change daily. Identity providers
model *who you are*; ScholarShelf's hard part is *what you may do here, now, to this resource* — and
Stage 7 locked that ScholarShelf owns it (TP-5).

**The boundary, stated plainly:**

```
AUTHENTICATION TECHNOLOGY   may prove identity
SCHOLARSHELF                owns authorisation — always

Do not hand the Stage 7 permission model to an identity provider.
```

*Alternatives considered:*

| Option | Assessment |
|---|---|
| **Auth.js / NextAuth** | Session and provider plumbing only; assumes a Next.js-shaped app. Would not carry contexts or authorities. Low benefit for real migration cost |
| **Lucia** | Philosophically the closest — a library, not a service, leaving authorisation to the app. Worth evaluating for session and credential primitives, but its scope overlaps what already works |
| **Clerk / WorkOS / Auth0** | Genuine benefits: MFA, recovery, breach detection, enterprise SSO. But each has an opinionated org/role model that would sit *beside* Stage 7's rather than serve it — two authority systems, which is exactly the failure mode C-40 already describes. Also sends identity data to a third party (§29) |
| **Supabase Auth** | Would reintroduce the dependency this stage removes, and couples auth to a provider decision made in TD-014 |

**The locked target:**

```
CUSTOM SCHOLARSHELF AUTHENTICATION
+ MAINTAINED CRYPTOGRAPHIC PRIMITIVES
+ SERVER-SIDE SESSIONS
+ STAGE 16 SECURITY HARDENING
```

**What TQ-2 does NOT mean.** It does **not** mean "keep hand-rolling cryptography". The *flows* stay
ScholarShelf's; the *primitives* move to maintained libraries. **TD-020 (bcryptjs → Argon2id)** and
**TD-021 (hand-written TOTP → a maintained library)** are unchanged and remain target technologies.

**Stage 16 determines** exact Argon2id parameters · password migration mechanics · reset-token
handling · MFA replay prevention · recovery-code storage · session-fixation protection · enumeration
resistance · account recovery · support and elevation authentication. **Stage 11 fixes only the
technology direction.**

**No managed identity provider is adopted in this rebuild** — and that is a decision about *this*
rebuild, not a permanent position. The legitimate trigger to reopen build-versus-buy is recorded:

```
ENTERPRISE SSO
or a materially changed sales / customer requirement
→ a legitimate reason to reopen build-vs-buy authentication
```

Because Stage 11 is now locked, **any such change requires a traceable owner amendment.**

*Disadvantages, stated honestly:* ScholarShelf carries the maintenance burden of its own auth — session
fixation, timing, enumeration, reset-token handling, MFA replay and recovery-code storage all remain
its responsibility. **That burden is real and TQ-2 does not remove it** — it is accepted, mitigated
and tracked as **TR-006**, which stays OPEN as a managed risk.

*Conflicts affected:* **C-40 — unchanged and NOT resolved by this decision.** TQ-2 only ensures
ScholarShelf does not add a *second*, external role and authority model beside Stage 7's. The target
authority architecture and mechanics remain with **Stages 12, 13 and 16**.
*Later stages:* **16**. *Owner decision:* **DECIDED — TQ-2 = A.**

---

## 12. Sessions

**TD-019 · Session store**
*Requirement:* server-side revocation · multi-device sessions · context and authority changes taking
effect immediately · support-engagement state · MFA and elevation expiry · serverless-compatible.
*Current:* `express-session` + `connect-pg-simple` → Postgres.
**Decision: KEEP.** *Why:* server-side sessions in the same database as the authority facts are the
right technology for this model. Revocation is a delete. A staffing change or a removed role takes
effect on the next request without waiting for a token to expire — which is what CD-2, CD-3 and the
"context lapses mid-session" behaviour in `ROLE_EXPERIENCE.md` §30 actually require.
*Alternatives:* **stateless JWTs — rejected.** A JWT carrying context and authorities cannot be
revoked before expiry, so a revoked staffing, an ended guardianship or an exited support engagement
would remain valid. That directly contradicts locked behaviour. **Redis sessions — rejected**: adds a
service to solve a problem Postgres does not have here (§18).
**Confirmed at lock [TQ-2].** `express-session` + `connect-pg-simple` + PostgreSQL-backed server-side
sessions are **KEEP**. **No stateless JWT authority token is introduced**, because the locked product
requires changes to staffing, guardian relationships, role grants, authority grants and support
engagements to affect access promptly — which a bearer token cannot deliver.

*Note:* `memorystore` is the development fallback. It is correctly never a production store; Stage 13
should make that impossible rather than conventional.
*Later stages:* **16** owns the session record. *Owner:* **DECIDED — TQ-2 = A.**

---

## 13. Password / MFA technology

**TD-020 · Password hashing**
*Current:* `bcryptjs@2.4.3`, cost 12. **Verified:** OWASP now recommends **Argon2id** (≥19 MiB, t=2,
p=1) and states bcrypt should be used **only in legacy systems where Argon2 and scrypt are not
available**, at work factor ≥10. `bcryptjs` is also a **pure-JavaScript** implementation — slower than
a native one, meaning the same wall-clock cost buys fewer real rounds — and 2.4.3 is an old line.
**Decision: REPLACE with Argon2id**, with **rehash-on-successful-login** so existing bcrypt hashes
migrate transparently and no password reset is forced on any user.
*Why:* current authoritative guidance, on the credential that protects children's and financial data.
*Constraint to carry forward:* bcrypt's **72-byte** input limit must be enforced for as long as any
bcrypt hash remains, and pre-hashing must not be introduced casually — OWASP flags it as dangerous.
*Migration cost:* MEDIUM. *Later stages:* **16** owns parameters and the rehash mechanism.
*Owner:* NO.

**TD-021 · TOTP / MFA**
*Current:* `server/mfa.ts` — hand-rolled TOTP with no library.
**Decision: REPLACE with a maintained TOTP library.** *Why:* TOTP has well-known implementation
hazards — time-window drift, replay within a window, constant-time comparison, secret encoding — and
hand-rolled crypto is the one place TP-5 is unambiguous. MFA is **mandatory** for platform authority,
so this is on the path that protects every tenant.
*Migration cost:* LOW — existing secrets remain valid, since TOTP is a standard.
*Later stages:* **16**. *Owner:* NO.

**TD-022 · Recovery codes and token generation**
**Decision: KEEP the platform primitive** — Node's `crypto.randomBytes` / `randomUUID` are the correct
technology and no library is needed. **Recovery codes must be stored hashed**, like passwords.
*Later stages:* **16** owns storage and single-use semantics. *Owner:* NO.

---

## 14. File / object storage

**TD-023 · Object storage — the largest gap this stage found.**

*Requirement:* school logos, favicons, banners, email logos, PDF logos, CMS media, and import files —
served publicly for the CMS site and privately for operational documents.

*Current, verified:* **there is no file storage.** Every asset is base64-encoded into a Postgres text
column — `media_assets.data_uri`, and `school_branding`'s five `*Url` columns. `multer` buffers
uploads in memory and hands the buffer to the database.

*Why this is a real problem, not a preference:*

| | |
|---|---|
| **Size** | Base64 inflates by ~33%. An 8 MB media file becomes ~10.7 MB of text in a row |
| **Read cost** | Branding is read on essentially every page load, pulling the logo bytes with it |
| **Database cost** | Neon bills storage and egress; this puts binary bytes in both |
| **No CDN** | Public website images cannot be served from a CDN because they are rows |
| **C-24** | Base64 logos stripped by mail clients — the *cause* is this storage decision |
| **Platform limit** | Uploads are capped in code at 5 MB (branding) and 8 MB (media), but **Vercel's request-body limit is 4.5 MB** — the largest permitted uploads **cannot physically arrive** |

**Decision: ADD an S3-compatible object storage technology**, with **signed direct upload** from the
browser (which also removes the 4.5 MB body-limit problem entirely) and signed read URLs for private
objects. The database stores a reference, never the bytes.

*Candidates, all S3-compatible so the exit cost stays low:*

| Candidate | Note |
|---|---|
| **Cloudflare R2** | No egress fees, S3 API, strong CDN story, EU jurisdiction option |
| **AWS S3** | The reference implementation; `eu-west-2` (London) available; most operational levers |
| **Vercel Blob** | Tightest integration with the existing platform; least portable — see **TQ-1** |
| **Backblaze B2** | Cheapest storage; weaker regional and integration story |

**What TQ-1 fixes, and what it does not.** [LOCKED TQ-1]

```
LOCKED HERE                          NOT LOCKED HERE
S3-compatible object storage         which specific provider
signed direct upload                 → Stage 17
UK/EU processing capability required
```

**TQ-1 constrains provider eligibility; it does not select a provider.** Several of the candidates
above can satisfy a UK/EU posture, and more than one remaining compliant option is not a reason to
raise another owner question. **No provider is chosen here** — that ownership stays with Stage 17, as
already assigned.
*Migration cost:* **HIGH** — existing base64 assets must be extracted, uploaded and re-referenced
without losing any school's branding. *Operational:* LOW–MEDIUM.
*Security:* private objects must never be publicly addressable; signed URLs must be short-lived and
tenant-scoped. **Stage 16** owns that.
*Conflicts affected:* **C-24**, **C-56** (new), **C-57** (new).
*Later stages:* **12** topology · **16** access control · **17** integration · **22** data migration.
*Owner decision:* **DECIDED — TQ-1 = A** (residency policy). **Provider selection remains Stage 17.**

**TD-024 · Upload handling** — *Current:* multer 2.1, memory storage, with `file-type` magic-byte
validation (a genuinely good existing control).
**Decision: KEEP, with reduced scope.** Once direct-to-storage upload exists, multer handles only
small server-side uploads such as import spreadsheets. Magic-byte validation is retained and must
apply wherever bytes are accepted. *Owner:* NO.

---

## 15. Email

**TD-025 · Email provider**
*Requirement:* invitations · account and password mail · notifications · new-payable notices (WF-071)
· school-branded communication · delivery status · retry.
*Current:* Resend 6.12, with 767 lines of senders and templates in `server/email.ts`.
**Decision: KEEP.** *Why:* Resend is current, maintained, has a clean API, and gives delivery events —
which is what MOD-015 needs.

**The Stage 8 boundary is a technology constraint, not just an architecture one:**

```
MOD-009  owns NOTIFICATION TRUTH   — the durable fact that a person is owed a message
MOD-015  owns DELIVERY ATTEMPTS    — what the provider did with it

The email provider does NOT own notification truth.
```

Today, sending *is* the notification (**C-46**), so a provider failure destroys the fact. That is fixed
by adding a durable notification record (Stage 15), **not** by changing provider.
**TQ-1 applies here too.** Resend receives recipient addresses and message content — which includes
children's names and payable amounts. Its regional and processing posture is therefore **in scope for
the later provider and privacy review**, exactly like the database and object storage.
**Resend remains KEEP** unless that verification finds a concrete incompatibility. **The decision is
not reopened here.**

*Constraint to carry:* branding must reach mail as a **hosted image URL**, not base64 (**C-24**) —
which TD-023 enables.
*Later stages:* **15** notification record · **16/17** provider verification · **17** templates and
integration. *Owner:* **DECIDED — TQ-1 = A**; provider unchanged.

---

## 16. Background jobs

**TD-026 · Durable background work**

*What the locked workflows actually need asynchronously:* daily digest (WF-061) · notification delivery
with retry (MOD-015, C-46) · staffing-expiry and access-lapse effects (WF-013, WF-018) · provider
reconciliation imports (WF-042) · large enrolment imports (WF-019–022) · future integrations.

*What must never be asynchronous:* **I-2.** See §33.

*Current:* no queue, no worker; one Vercel cron hitting `/api/cron/run`, with a `cron_job_runs` table
already providing idempotency.

**Decision: ADD the minimum — durable job records in PostgreSQL, executed by the existing platform.**

*Why this and not a queue:*

- The **durability** requirement is real: C-46 means a delivery failure currently destroys the fact
  that a message was owed. A record that survives failure is mandatory.
- The **queue** requirement is not evidenced. Throughput is one school-day's worth of work per tenant.
  A `jobs` table with claim-and-retry semantics — the same conditional-`UPDATE` pattern the settlement
  path already uses — gives durability, retry, visibility and idempotency **inside the database that
  already holds the truth**, with no new service, no new failure mode, and no new bill.
- It also keeps job state inside transactions with business writes, which a separate broker cannot.

*Rejected:* Redis/BullMQ, SQS, Kafka, Temporal — each adds a service, a cost line and a failure mode
to solve a problem the database already solves at this scale. **Revisit when measured throughput or
latency shows the database approach failing**, not before.
*Recorded for Stage 12:* Vercel's verified **800s** maximum (1800s extended, beta) and **Vercel
Workflows** for unbounded work mean the current 30s cap is self-imposed, not a platform ceiling — see
TD-030.
*Conflicts affected:* **C-30**, **C-46**. *Later stages:* **12** topology · **15** the record ·
**18** scale. *Owner:* NO.

---

## 17. Scheduling

**TD-027 · Scheduler** — *Current:* one Vercel cron, `0 7 * * *`, with `cron_job_runs` idempotency.
**Decision: KEEP.**

```
SCHEDULER   answers  "when should this start?"     → Vercel Cron
JOB SYSTEM  answers  "how is it executed, retried,
                      and completed?"              → durable job records (TD-026)
```

*Why:* MOD-014's needs are daily and periodic, not sub-minute. Vercel Cron is already integrated,
already idempotent here, and costs nothing extra. A scheduler is the smallest possible piece of this
system; adding a service for it would be pure overhead.
*Limitation to record:* Vercel Cron guarantees invocation, not completion — which is exactly why
TD-026 exists. *Later stages:* **12**, **18**. *Owner:* NO.

---

## 18. Caching

**TD-028 · Cache** — *Current:* none.
**Decision: NO SEPARATE CACHE TECHNOLOGY NEEDED.**
*Why:* the workload is a few hundred staff and families per tenant, on school-day rhythms, against a
database whose entire job is to answer these questions. There is no evidenced hot path. Adding Redis
would add a service, a bill, an operational surface and a consistency hazard for no measured problem.

**And a hard rule regardless of any future decision:**

```
NOTHING CACHED MAY EVER BE AUTHORITY FOR
settlement position · stock · custody
```

Those are derived or event-sourced facts (DM-035, DM-041) whose correctness the product depends on. A
cached stock figure that permits a confirmation is a stock error with a receipt.
*What is legitimate instead:* TanStack Query's client cache (already present), HTTP caching for
**public, published** CMS content via the CDN, and short-lived in-process memoisation of genuinely
static configuration.
*Revisit when:* measured latency, not architecture aesthetics. *Owner:* NO.

---

## 19. Search

**TD-029 · Search** — *Current:* none. *Requirement:* Stage 9's UX-062 school search, plus finance
finding a reference or family, the office finding a child ready for collection, and BytHub finding a
tenant.
**Decision: NO SEPARATE SEARCH TECHNOLOGY — PostgreSQL-native, with dedicated search deferred.**
*Why:* all four are **scoped, single-tenant lookups over thousands of rows**, not corpus search over
millions. Postgres trigram and full-text indexing handles this comfortably. A dedicated engine would
add a second copy of children's data, an ingestion pipeline, a consistency problem and a bill — and,
critically, **a second place tenant isolation could fail**, which is the product's most important
invariant.
*Rejected for now:* Elasticsearch, Algolia (third-party copy of children's data), Meilisearch,
Typesense.
*Revisit when:* a measured, evidenced scale or capability need appears.
*Later stages:* **15** owns the indexes. No index is designed here. *Owner:* NO.

---

## 20. Hosting

**TD-030 · Hosting and compute**
*Current:* Vercel — Vite SPA on the CDN, `/api/*` rewritten to **one** serverless function capped at
**`maxDuration: 30`**, one cron, no region configured.

**Verified platform limits (25 August 2026):** max duration Hobby 300s; **Pro/Enterprise 300s default,
800s maximum, 1800s extended (beta)** · request/response body **4.5 MB** · memory 2 GB default, 4 GB
Pro · **1,024 file descriptors shared across concurrent executions** · single default region unless
configured · **Vercel Workflows** available for work needing unbounded time.

**Decision: KEEP Vercel — and raise the self-imposed 30-second cap.**

*Why:* the objection usually raised against serverless here — *"long-running imports and jobs cannot
run"* — is **not true of this platform**. The 30s limit is ScholarShelf's own configuration, an order
of magnitude below what is available. With 800s available, every workload in §34's "potentially
problematic" list fits, and Workflows exists for anything that does not.

*What the platform genuinely constrains, and how each is handled:*

| Constraint | Handling |
|---|---|
| **4.5 MB request body** | **TD-023's signed direct upload** removes the problem rather than working around it |
| **1,024 shared file descriptors** | Neon's serverless driver (TD-014) is designed for exactly this |
| **No always-on process** | TD-026's durable job records survive between invocations by living in the database |
| **Single default region** | **The current default-region behaviour is no longer acceptable** [LOCKED TQ-1]. Target: an explicitly configured UK/EU processing region. **Not configured here** — Stage 12 owns topology, Stage 21 owns the change |

*Alternatives:* a container platform (Fly.io, Railway, Render — always-on processes and simpler
long-running work, at the cost of servers to patch, scale and monitor, and a full deployment
migration); a hybrid of CDN frontend plus separate backend (a legitimate Stage 12 topology question,
**not** a Stage 11 technology change). None clears TP-1 given the verified limits.
*Vendor coupling:* MEDIUM. Express runs anywhere; the coupling is deployment configuration, cron and
rewrites — days of work, not a rewrite. That is the honest measure of the lock-in.
*Conflicts affected:* **C-57**, **C-63** (new). *Later stages:* **12** topology · **18** scale ·
**21** deployment and region configuration. *Owner decision:* **DECIDED — TQ-1 = A.**

---

## 21. Logging

**TD-031 · Structured logging**
*Requirement — locked by `DESIGN_SYSTEM.md` §16.2–16.3:* an error may show *"a short opaque reference
the user can quote"*, meaningless outside ScholarShelf's own logs. That contract requires a
correlation identifier that appears **both** in the user's message **and** in the log record.
*Current:* **55 `console.*` calls in `server/`. No logging library. No correlation identifier.**
**Decision: ADD a structured JSON logger** with per-request correlation.
*Why:* without it the locked Stage 10 error contract **cannot be delivered** — there is nothing for a
support reference to refer to. This is a locked-requirement failure, not a nice-to-have (**C-62**).
*Target:* a mature Node structured logger (Pino is the obvious candidate — fast, JSON-native, with
first-class redaction), emitting to the platform's log stream.

**Two rules the technology must enforce:**

```
1.  TECHNICAL LOG  ≠  DM-053 AUDIT EVENT
    Logs are for engineers and are disposable.
    Audit is a business fact, owned by MOD-013, and is not a log line.
    Stage 19 owns audit mechanics.

2.  Redaction is configured, not remembered.
    No passwords, tokens, session identifiers, recovery codes, payment
    references or personal data in logs — enforced by the logger's own
    redaction, because C-18 already records live credentials reaching logs.
```

**TQ-1 applies if logs leave ScholarShelf infrastructure.** Emitting to the platform's own log stream
keeps this inside providers already covered. **If an external logging service is ever adopted, it
becomes subject to the same UK/EU processing policy** and to the same review as every other processor.

*Conflicts affected:* **C-18**, **C-62** (new). *Later stages:* **16** redaction policy · **19** audit
· **21** log destination. *Owner:* **DECIDED — TQ-1 = A** applies to any external log destination.

**TD-032 · Error tracking and monitoring**
*Current:* **none.** *Requirement:* server errors · client errors · failed scheduled runs · failed
deliveries · deployment health.
**Decision: ADD one error-tracking platform covering both front and back end.**
*Why:* "look in the platform logs when somebody complains" is not a production posture for a system
handling money and children's records — and Stage 10's own error contract assumes an engineer can find
the incident behind a reference. A single platform is preferred to several small tools: fewer
integrations, one place to look, and correlation between a browser error and its server request.
*Candidates:* Sentry (mature, best-in-class source-map and release tracking, EU data region available,
generous free tier); the platform's own observability (least integration, thinnest capability);
GlitchTip (self-hostable, Sentry-compatible, more operational burden).
**Deliberately not adopted:** a full OpenTelemetry stack. The product does not have a distributed
system to trace — Stage 8 locked that modules are not services — and hyperscale telemetry for a
single-application system is complexity without benefit. Revisit if Stage 12 produces genuinely
separate services.
**Provider eligibility [LOCKED TQ-1].** The chosen platform must satisfy:

```
UK/EU processing posture     ·  data scrubbing / redaction
suitable retention controls  ·  appropriate processor terms
```

The candidates above are **evaluated, not selected** — the existing evidence does not establish one
uniquely, so provider selection stays where it already sits.

*Privacy constraint:* error payloads must not carry children's data, payment references or session
material. Scrubbing is a configuration requirement, not an afterthought (§29).
*Later stages:* **16** owns scrubbing and privacy mechanics · **18/21** own operational adoption and
alerting thresholds. *Owner:* **DECIDED — TQ-1 = A**; provider not selected here.

**TD-033 · Availability monitoring** — **Decision: ADD**, minimally: an external check against the
existing `/api/health` endpoint. *Why:* the cheapest possible answer to "is the product up", and the
current answer is "a school tells us". *Owner:* NO.

---

## 22. Testing technologies

*Current, verified:* eleven `tsx` scripts in `tests/` using `console.log` and a hand-written `expect`
helper, plus `script/smoke-boot.ts`. **There is no test framework** — no runner, no assertion library,
no machine-readable results, no coverage, no parallelism, no fixtures, no isolation.

This matters more here than in most products, because these are the invariants the entire locked
architecture rests on:

```
tenant isolation · guardian scope · teacher scope (SC-2 ∩ SC-3)
school_admin + AUTH-FINANCE · I-2 settlement atomicity · stock movement
custody · own-child block (CD-5) · support mode · break-glass
rollover · replacement · query-state correctness
```

**TD-034 · Test runner and unit testing** — **Decision: ADD Vitest.**
*Why:* it is Vite-native (the project already builds with Vite, so one configuration and one transform
pipeline), TypeScript-native, fast, and gives what is missing — real assertions, machine-readable
output, coverage, isolation and watch mode. The existing eleven suites port to it rather than being
rewritten.
*Alternatives:* Jest (mature, but a second toolchain beside Vite for no gain); `node:test` (no
dependency, but thinner ergonomics and weaker coverage tooling).
*Migration cost:* MEDIUM. *Owner:* NO.

**TD-035 · Integration testing** — **Decision: ADD — Vitest against a real PostgreSQL in CI.**
*Why:* tenant isolation, the I-2 transaction and the conditional claim-lock are **database behaviours**.
Mocking the database would test the mock. CI already runs a Postgres 16 service and seeds a second
tenant — that instinct is right and should become the standard, not the exception.
*Owner:* NO.

**TD-036 · End-to-end testing** — **Decision: ADD Playwright.**
*Why:* the highest-risk human paths are multi-step and cross-surface — teacher hand-over, settlement
confirmation, rollover, support-mode entry and exit. Playwright also covers real browsers, mobile
viewports (needed for the locked handheld-first contract) and accessibility scanning in the same tool.
*Alternatives:* Cypress (good, but weaker multi-origin and mobile-emulation story).
*Owner:* NO.

**TD-037 · Accessibility testing** — **Decision: ADD `axe-core`, driven through Playwright.**
*Why:* WCAG 2.2 AA is a **locked** baseline, and an automated baseline catches contrast, labelling,
role and focus-order regressions cheaply on every change. It is explicitly a **floor**, not a
substitute for manual keyboard and screen-reader testing — automated tools detect a minority of real
barriers.
*Later stages:* **20** owns the test strategy; Stage 11 chooses only the tools. *Owner:* NO.

---

## 23. Spreadsheet / import technology

**TD-038 · Spreadsheet technology — mandatory decision.**

*Requirement:* read `.xlsx` for enrolment import (WF-019–022) and provider reconciliation (WF-042);
write `.xlsx` for templates and exports. These are load-bearing school workflows.

*Current:* **`xlsx@0.18.5`**, imported in three server files **and one client page**
(`admin/students.tsx`).

**Verified, 25 August 2026:**

| Fact | |
|---|---|
| **CVE-2023-30533** — prototype pollution | Affects **all SheetJS ≤ 0.19.2**. Fixed in **0.19.3** |
| **CVE-2024-22363** — regular-expression denial of service | Fixed in the **0.20.x** line |
| npm registry | **Stuck at 0.18.5.** SheetJS moved distribution to `cdn.sheetjs.com`; the registry version is described by SheetJS as out of date |
| Current release | **0.20.3**, from the SheetJS CDN, with vendoring recommended by SheetJS |
| **ExcelJS** — the usual replacement | **4.4.0, published October 2023 · "Inactive" · no commits in two years · 1 critical + 2 high + 1 medium open vulnerabilities** |

**`npm update` cannot fix this.** 0.18.5 is the terminal registry release; the patched line is not on
npm at all.

**Decision: KEEP SheetJS + UPGRADE, and change the distribution source** — take **0.20.3 or later from
the SheetJS CDN** and **vendor it**, as SheetJS itself recommends.

*Why not ExcelJS:* it is materially worse. Replacing a library with two unpatched CVEs with one that
is inactive and carries a critical plus two highs is a downgrade wearing the word "replacement".
*Why not node-xlsx / wrappers:* they wrap SheetJS, inheriting whichever version they pin.
*Why not stay on 0.18.5:* two unpatched CVEs in a parser that ingests **files supplied by users**, on
a workflow that creates children's records. This is TP-1's security reason, unambiguously.

**Constraints that accompany the decision** — defence in depth, because a spreadsheet parser is an
untrusted-input boundary whatever version it is:

```
1. Parse untrusted workbooks SERVER-SIDE only.
   Remove xlsx from the client bundle (admin/students.tsx) — a parser
   with known CVEs should not ship to a browser, and export generation
   does not require it there.
2. Enforce size limits BEFORE parsing.
3. Never evaluate formulas from an uploaded workbook.
4. Treat every cell as untrusted text; guard CSV-injection prefixes on export.
5. Pin the vendored version explicitly and review it deliberately —
   a non-registry dependency will not appear in routine audit tooling.
```

*Disadvantage, stated honestly:* a CDN tarball dependency is unusual, will not be surfaced by
`npm audit`, and needs a deliberate review habit. Vendoring is what makes that manageable, and it is
the vendor's own recommendation.
*Migration cost:* MEDIUM. *Conflicts affected:* **C-58** (new).
*Later stages:* **16** input-handling security · **22** the actual change. **No code is changed here.**
*Owner:* NO.

---

## 24. Validation

**TD-039 · Validation** — *Current:* Zod 3.25 + drizzle-zod + zod-validation-error, already validating
environment variables at startup and failing fast.
**Decision: KEEP + UPGRADE** to the current Zod line.
*Why:* Zod is the right technology at the boundaries this product has — environment, request input,
and shared client/server schemas — and `drizzle-zod` already derives schemas from the Drizzle model,
which keeps one definition rather than two.

**A boundary worth stating, because it is often conflated:**

```
ZOD                 validates what ARRIVES     — an application boundary
DATABASE CONSTRAINT enforces what IS TRUE      — the last line of defence

Both are required. Neither substitutes for the other.
Stage 15 owns constraints. Stage 14 owns request contracts.
```

*Owner:* NO.

---

## 25. Realtime

**TD-040 · Realtime transport** — *Current:* none.
**Decision: NO SEPARATE REALTIME TECHNOLOGY.**
*Why:* no locked workflow requires it. Every one of the 71 workflows is a person doing something and
seeing the result:

```
request → mutate → invalidate → refetch
```

which TanStack Query already does. Teacher hand-over is one person recording one act. Finance review
is one person deciding. Even the concurrent-confirmation case (WF-045) is resolved by the database's
conditional claim-lock, not by pushing state to browsers.
*Rejected:* WebSockets, Socket.IO, SSE, realtime subscriptions — all to make dashboards update
instantly, which no locked requirement asks for and which would add a persistent-connection technology
to a serverless deployment that is a poor fit for it.
*Revisit if:* a future locked workflow genuinely requires push. **State the workflow, then the
technology.** *Owner:* NO.

---

## 26. Analytics

**TD-041 · Product analytics** — *Current:* none.
**Decision: DEFER.**

**Four different things, kept apart:**

```
PRODUCT ANALYTICS     how people use the product      → DEFERRED
BUSINESS REPORTING    MOD-010, inside the product     → already owned, Stages 8–10
TECHNICAL MONITORING  is it working                   → TD-032
AUDIT                 DM-053, a business fact         → MOD-013, Stage 19
```

*Why defer:* the rebuild has no analytics question it needs answered, and any analytics technology
introduced now would be instrumented against screens that are about to change.
**A constraint if it is ever added:** an analytics provider must never receive children's data,
payment data, family relationships or anything identifying a child. Event names and coarse role
context only. *Owner:* NO.

---

## 27. Payments

**TD-042 · Live payment provider** — **Decision: DEFER provider selection.**
*Why:* D-02 locks online payment as a **future** legitimate route; Stage 9 removed the fake checkout
(**C-2**) and Stage 10 gave the honest settlement list a slot for it. There is nothing to integrate
yet, and choosing a provider now would be choosing before the requirement is specified.

**Explicitly: do not choose Stripe because the code says "Stripe".** Verified — `server/services/
payment-verification/` imports a **spreadsheet** (`stripe-spreadsheet-importer.ts`) and matches
references. There is **no Stripe SDK** in `package.json`. It is reconciliation, not a gateway
(**C-28**).
*Later stages:* **17** owns integration and provider selection. *Owner:* NO — unless the owner has
already committed commercially, in which case it should be recorded as a Stage 17 input.

---

## 28. Dependency cleanup

**TD-043 · Package manager and lockfile** — *Current:* npm with `package-lock.json`.
**Decision: KEEP.** No TP-1 reason; pnpm's disk and speed advantages do not justify changing CI,
deployment and every developer's setup. *Owner:* NO.

**TD-044 · Unused dependencies — verified by import search, 25 August 2026**

| Package | Importing files | Decision |
|---|---|---|
| `@supabase/ssr` | **0** | **REMOVE** |
| `@supabase/supabase-js` | **0** | **REMOVE** |
| `passport` | **0** | **REMOVE** |
| `passport-local` | **0** | **REMOVE** |
| `@types/passport`, `@types/passport-local` | **0** | **REMOVE** |
| `framer-motion` | **0** | **REMOVE** — *not previously recorded* |
| `date-fns` | **0** | **REMOVE** — *not previously recorded* |
| `memorystore` | **1** (`server/app.ts`) | **KEEP** — *previously recorded as unused; it is not* |
| `ws` | 0 direct | **KEEP** — WebSocket transport peer for `@neondatabase/serverless` |
| `next-themes` | 1 (the toaster) | **REMOVE with the dark palette** — light-only is locked (DSQ-1); **Stage 22** |
| `recharts` | 1 (`ui/chart.tsx`) | **KEEP**, pending a Stage 13 check for consumers |
| `tailwindcss-animate` + `tw-animate-css` | both present | **VERIFY** — two animation utilities; Stage 13 keeps one |

**Also to correct at cleanup:** `package.json` declares `"name": "rest-express"` and `"license":
"MIT"` on a commercial product. Neither is a dependency, both are wrong, and both should be fixed when
the file is next touched.

**Nothing is removed at Stage 11.** Removal is **Stage 22**, so it happens once, deliberately, with
the test suite from TD-034–037 in place to catch a mistake. *Owner:* NO.

**TD-045 · Secrets and environment configuration** — *Current:* `dotenv` locally, Zod-validated at
startup, platform environment variables in production, with separate least-privilege console
connection strings.
**Decision: KEEP.** *Why:* the fail-fast Zod schema and the separate console credentials are both
genuinely good existing practice. No secrets manager is warranted at this scale.
*Constraint:* **C-18** records live credentials reaching logs — TD-031's redaction is the fix.
*Later stages:* **16**. *Owner:* NO.

---

## 29. Security, privacy and provider considerations

**This is not the Stage 16 security design.** It is the question of whether each technology is
*suitable at all* for a UK product processing children's and financial data.

### 29.1 The locked processing policy [LOCKED TQ-1 = A]

```
PROVIDER PROCESSES SCHOLARSHELF PRODUCT DATA
→ UK/EU PROCESSING CAPABILITY REQUIRED
```

ScholarShelf product data must be processed in **UK or EU regions** by the infrastructure and service
providers selected for the product, **unless a future explicit owner or legal exception is recorded.**

**What this policy is:** a product, procurement and technical posture, chosen deliberately because the
customers are UK schools and the data includes children's, family and financial records.

**What this policy is not:** it is **not** a claim that UK GDPR makes all processing outside the UK or
EU unlawful. It does not say that. Legal interpretation of international transfers, adequacy,
safeguards, data-processing agreements and processor contracts remains for **BytHub's legal and
privacy review**. Stage 11 is choosing a technology and provider posture, not giving legal advice.

**Where a provider cannot meet the policy**, it is not an acceptable target provider without a future
traceable owner or legal exception.

The table below keeps the **data-by-provider distinctions** deliberately — the policy applies to every
provider that receives product or personal data, but the providers do not all receive the same
category of data, and this document does not claim they do.

| Provider | Data sent | Considerations |
|---|---|---|
| **Neon** (TD-014) | **All product data** | The most significant processor. Region must be explicit (**C-63**, **TQ-1**). Encryption at rest and in transit, backup and point-in-time recovery must be confirmed for the chosen plan |
| **Vercel** (TD-030) | All request traffic; compute | **Default region is not UK/EU unless configured.** Logs may transit request metadata |
| **Object storage** (TD-023) | Logos, media, imports | Region selectable in all candidates. Private objects must never be publicly addressable |
| **Resend** (TD-025) | Recipient addresses, message content | Message content includes children's names and payable amounts. Retention and region need confirming |
| **Error tracking** (TD-032) | Stack traces, request context | **Highest leak risk.** Scrubbing must be configured before it is enabled |
| **SheetJS** (TD-038) | **None** — a local library | The risk is the parser, not a transfer |

**Stated honestly:** these are technology-suitability observations, **not legal advice and not a
compliance assessment.** Data-processing agreements, sub-processor disclosure, retention schedules,
lawful basis and the school-as-controller / ScholarShelf-as-processor relationship all require
**qualified legal and security review** — flagged here, owned by **Stage 16** and by BytHub's own
counsel. No claim is made about compliance status.

---

## 30. Cost and operational complexity

| Technology | Operational complexity | Expected early-stage cost |
|---|---|---|
| React · Vite · Tailwind · Radix · TanStack Query · Wouter | LOW | none |
| Node · Express · TypeScript · Zod | LOW | none |
| PostgreSQL on Neon | LOW | LOW, usage-scaled |
| Drizzle + generated migrations | LOW | none |
| Custom auth + Postgres sessions | **MEDIUM** — ScholarShelf maintains it | none |
| Argon2id + TOTP library | LOW | none |
| **Object storage (new)** | LOW–MEDIUM | **LOW** — and it *reduces* database cost by moving bytes out |
| Resend | LOW | LOW |
| **Job records in Postgres (new)** | LOW | none — no new service |
| Vercel Cron | LOW | none |
| Vercel hosting | LOW | LOW–MEDIUM, scales with traffic |
| **Structured logging (new)** | LOW | none |
| **Error tracking (new)** | LOW–MEDIUM | LOW — free tiers are adequate initially |
| **Vitest · Playwright · axe-core (new)** | LOW | none; CI minutes only |
| SheetJS vendored | LOW — but needs a deliberate review habit | none |

**No exact monthly figures are given.** Usage is unknown, published pricing changes, and an invented
number would be worse than none. Where pricing becomes material to a decision it should be verified
against the provider's current published rates at that time.

**Net position:** the additions are **object storage, structured logging, error tracking and a test
toolchain**. Three of the four are free or near-free at this scale, and the fourth reduces database
cost. No always-on server, no broker, no cache, no search cluster. That is the intended outcome of
TP-2.

---

## 31. Technology risk register

| ID | Technology | Risk | Likelihood | Impact | Mitigation | Decision | Later stage |
|---|---|---|---|---|---|---|---|
| **TR-001** | `xlsx@0.18.5` | Two unpatched CVEs in a parser fed by user-supplied files, on the workflow that creates children's records | **HIGH** — the code path runs on every import | **HIGH** | TD-038: vendored 0.20.3+, server-side only, size caps, no formula evaluation | TD-038 | 16, 22 |
| **TR-002** | No durable file storage | Binary assets as base64 rows: database bloat, egress cost, no CDN, mail clients stripping logos, and uploads that cannot arrive | **HIGH** — already occurring | **MEDIUM** | TD-023: object storage with signed direct upload | TD-023 | 12, 16, 22 |
| **TR-003** | `drizzle-kit push` in production | An unreviewed schema diff applied to live tenant data, with no history and no reliable reversal | **MEDIUM** | **VERY HIGH** — money, stock and immutable history | TD-017: generated, reviewed, committed migrations; `push` local only | TD-017 | 15, 21 |
| **TR-004** | Node 20 in CI and types | Building and testing against a runtime past end of security support | **HIGH** — current state | **MEDIUM** | TD-011: pin Node 24 LTS everywhere | TD-011 | 13, 21 |
| **TR-005** | No test framework | The locked invariants — tenant isolation, I-2, scope rules — have no machine-verifiable regression guard, and the restructuring pass is already **UNVERIFIED** | **HIGH** | **VERY HIGH** | TD-034–037: Vitest, real Postgres in CI, Playwright, axe | TD-034–037 | 20 |
| **TR-006** | Custom authentication | ScholarShelf maintains session, reset, MFA and recovery security itself, indefinitely | **MEDIUM** | **HIGH** | **OPEN — accepted and managed, not resolved.** Maintained primitives (Argon2id, TOTP library) + Stage 16 security design and review + strong test coverage (TD-034–037) + production monitoring (TD-032). **Owner acceptance at TQ-2 does not remove the security burden** | TD-018 | 16 |
| **TR-007** | No error tracking | Failures are invisible until a school reports them; the locked support-reference contract has nothing behind it | **HIGH** — current state | **MEDIUM** | TD-031, TD-032 | TD-031/032 | 18, 21 |
| **TR-008** | Vercel 4.5 MB body limit vs 5 MB / 8 MB caps | The largest permitted uploads cannot reach the application | **HIGH** — deterministic | **LOW–MEDIUM** | TD-023: direct-to-storage upload | TD-023 | 12, 13 |
| **TR-009** | Processing region not configured | A UK schools product may be processing children's data outside the UK/EU without an explicit decision | **MEDIUM** | **HIGH** if unaddressed | **Policy now locked (TQ-1 = A): UK/EU processing required.** Verify current regions, configure targets, migrate if required, verify external processors; legal review remains BytHub's | TD-014, TD-023, TD-030, TD-032 | 16, 21 |
| **TR-010** | Vendored non-registry dependency | A vendored SheetJS will not appear in `npm audit`; a future advisory could go unnoticed | **MEDIUM** | **MEDIUM** | Explicit pinned version, recorded review cadence, named owner | TD-038 | 21 |
| **TR-011** | Two competing schema mechanisms | Nothing can state what the production schema is derived from; CI already skips migration `001` | **HIGH** — current state | **HIGH** | TD-017, and resolve `001` (**C-19**) | TD-017 | 15, 21 |
| **TR-012** | Vendor coupling to one platform | Hosting, cron, and possibly storage and jobs concentrated with one vendor | **LOW** | **MEDIUM** | Express and Postgres are portable; keep storage S3-compatible; **TQ-1** | TD-030 | 12, 18 |

---

## 32. Conflicts resolved conceptually by Stage 11

| # | Stage 11's contribution | Still unresolved |
|---|---|---|
| **C-54** | **TD-008 and TD-009** decide the technology families: **lucide-react** and the **shadcn/Tailwind CSS-variable tokens** survive; Material Symbols and the Material 3 token block do not | **Yes** — physical architecture is **Stage 13**, removal is **Stage 22** |
| **C-19** | **TD-017** removes the mechanism that allowed a migration to be undeployable in the first place | **Yes** — `001` itself must still be resolved, **Stage 15/21** |
| **C-30** | **TD-026** gives digest work a durable record with retry, which is what "large-tenant digest behaviour" needed to be decidable | **Yes** — behaviour is **Stage 12/18** |
| **C-46** | **TD-026 and TD-025** separate the durable notification record from the delivery attempt at the technology level | **Yes** — the record is **Stage 15** |
| **C-18** | **TD-031** makes redaction a configured property of the logger rather than a discipline | **Yes** — policy is **Stage 16** |
| **C-24** | **TD-023** makes hosted image URLs in mail possible, which base64 storage prevented | **Yes** — templates are **Stage 17** |

**A technology decision is not an implementation.** Every row above remains open in the repository.

---

## 33. I-2 — the technology test

**Every decision in this document was tested against this, and none weakens it.**

```
CONFIRM SETTLEMENT

  MOD-007  settlement decision
  +
  MOD-008  allocation
  +
  MOD-005  stock movement

  ONE DATABASE TRANSACTION · ONE PROCESS
  ALL SUCCEED   OR   ALL FAIL
```

| Decision | Effect on I-2 |
|---|---|
| **TD-013 PostgreSQL** | **Enables it.** Multi-statement ACID transactions are the reason it is kept |
| **TD-016 Drizzle** | **Enables it.** An explicit, SQL-shaped transaction API with no hidden batching |
| **TD-012 Express** | **Neutral.** One request, one process, one handler |
| **TD-014/015 Neon + drivers** | **Constraint recorded:** the confirmation path must run on a **transaction-capable connection**, not HTTP-mode single statements. Stage 12/13 obligation |
| **TD-026 Jobs** | **Explicitly excluded.** I-2 never enters a job. Background work is for genuinely asynchronous things |
| **TD-028 Cache** | **Explicitly excluded.** Nothing cached may be authority for settlement, stock or custody |
| **TD-030 Vercel** | **Neutral.** A confirmation is a short request well inside any limit |
| **TD-040 No realtime** | **Neutral.** WF-045's concurrency is resolved by the database's claim-lock |

**Explicitly not introduced, anywhere in this stage:** microservices · sagas · queues between the three
writes · distributed transactions · event-bus eventual consistency · Kubernetes · service mesh · Kafka.

**No decision in this document requires a module to become a service** (TP-4).

---

## 34. The serverless question, answered on evidence

| Workload | Verdict |
|---|---|
| Sign-in · navigation · list and detail reads · form submissions | **Good fit.** Short, stateless, well inside limits |
| **Settlement confirmation (I-2)** | **Good fit.** One short transaction — and short is exactly what a serverless function does well |
| Enrolment imports (WF-019–022) | **Fits**, once the self-imposed 30s cap is raised toward the platform's 800s |
| Provider reconciliation (WF-042) | **Fits**, same |
| Daily digest (WF-061) | **Fits** — invoked by cron, executed against durable job records |
| Notification delivery with retry | **Fits** — durability comes from the record, not from an always-on process |
| **File uploads > 4.5 MB** | **Does not fit through the function.** Solved by TD-023's direct-to-storage upload, not by moving hosts |
| Media processing, if ever needed | **Would need review.** Not a current requirement |
| Very long exports, if ever needed | **Would need Workflows or a different execution model.** Not a current requirement |

**Conclusion:** the platform is not the constraint that the 30-second configuration made it look like.
**Stage 12 owns how the pieces are arranged.**

---

## 35. New conflicts

Existing identifiers run through **C-55**, with **C-47 withdrawn**. Verified across the document set on
25 August 2026: **C-55 is the highest in use.** New conflicts begin at **C-56**.

---

### C-56 — **OPEN** · There is no durable file storage; binary assets live as base64 in the database

**Current technology.** `media_assets.data_uri` is a `text` column holding `data:<mime>;base64,…`.
`school_branding` stores logo, favicon, banner, email logo and PDF logo the same way. `multer` buffers
the upload in memory and the bytes go straight into a row.

**Conflict.** The locked product has an optional CMS with a media library (MOD-011), school identity
assets used across the application and in communications (MOD-001), and import files — none of which
the technology stack has anywhere to put. The database is doing a job it is the wrong tool for.

**Why it matters.** Base64 inflates by a third; branding bytes are read on nearly every page load;
Neon bills storage and egress for both; public website images cannot be served from a CDN because they
are rows; and this is the **cause** of **C-24**, since mail clients strip base64 images.

**Target technology decision.** **TD-023** — S3-compatible object storage with signed direct upload
and signed reads; the database holds a reference, never the bytes.

**Later owning stage.** **12** topology · **16** access control · **17** integration · **22** migrating
existing assets.

---

### C-57 — **OPEN** · Upload limits exceed the platform's request-body limit

**Current technology.** Branding uploads are capped at **5 MB** (`BRANDING_UPLOAD_MAX_BYTES`); media
uploads at **8 MB** (`MEDIA_MAX_BYTES`). **Vercel's request/response body limit is 4.5 MB**, verified
25 August 2026.

**Conflict.** The application advertises limits the platform will not carry. A 6 MB media file is
rejected by the platform with a 413 before any application code runs, so the user sees a platform
error rather than the product's own — which the locked Stage 10 error contract has no way to explain.

**Why it matters.** It is deterministic, not intermittent: the largest permitted uploads can never
succeed. It also means the application's own validation is not the effective limit, which makes the
real limit invisible to everyone.

**Target technology decision.** **TD-023** — direct-to-storage upload removes the body limit from the
path entirely; whatever cap remains is then the product's own and is honest.

**Later owning stage.** **12**, **13**.

---

### C-58 — **OPEN** · The spreadsheet parser is on a terminal, vulnerable release

**Current technology.** `xlsx@0.18.5`, imported in three server files and one client page.

**Conflict.** Verified 25 August 2026: **CVE-2023-30533** (prototype pollution) affects all SheetJS
≤ 0.19.2 and is fixed in 0.19.3; **CVE-2024-22363** (ReDoS) is fixed in the 0.20.x line. **0.18.5 is
the last release on the npm registry** — SheetJS moved distribution to its own CDN — so the version in
use cannot be upgraded by any registry operation. The parser ingests **user-supplied workbooks** on the
workflow that creates children's records, and is additionally shipped into the browser bundle.

**Why it matters.** This is the clearest security-driven technology decision in the stage, and it
cannot be resolved by routine dependency maintenance. `npm audit` and Dependabot will keep reporting a
problem no registry action can fix.

**Target technology decision.** **TD-038** — SheetJS **0.20.3+** from the SheetJS CDN, **vendored**,
server-side only, with size caps before parsing and no formula evaluation. **ExcelJS was evaluated and
rejected**: inactive since 2023, no commits in two years, 1 critical + 2 high + 1 medium open.

**Later owning stage.** **16** input-handling security · **22** the change itself.

---

### C-59 — **OPEN** · The build and test runtime is past end of security support

**Current technology.** No `engines`, no `.nvmrc`; `@types/node ^20`; **CI pins `node-version: "20"`**.

**Conflict.** Node 20 reached end of security support in **April 2026** (verified). A live SaaS holding
children's and financial data is being built and tested against an unsupported runtime, and — because
nothing is pinned — the production runtime is whatever the platform defaults to, which nobody has
decided.

**Why it matters.** Unsupported runtimes stop receiving security fixes. The unpinned production
runtime is a second problem: it can change under the product without a deploy.

**Target technology decision.** **TD-011** — Node 24 LTS, pinned in `engines`, `.nvmrc`, CI and the
platform runtime setting, with `@types/node` matched.

**Later owning stage.** **13**, **21**.

---

### C-60 — **OPEN** · There is no test framework behind the locked invariants

**Current technology.** Eleven `tsx` scripts using `console.log` and a hand-written `expect` helper.
No runner, no assertion library, no machine-readable output, no coverage, no isolation.

**Conflict.** The locked architecture rests on invariants that are only meaningful if they are
continuously verified — tenant isolation, SC-2 ∩ SC-3 teacher scope, the CD-5 own-child block, PA-1's
authority separation, support-mode scoping, and **I-2's atomicity**. `RESTRUCTURE_STATE.md` already
caps evidence at **E2** because the suites could not be executed. A hand-rolled script that prints
ticks cannot gate a merge, cannot report to CI, and cannot tell anyone what is untested.

**Why it matters.** Every subsequent stage — and especially Stage 22's migration — depends on being
able to change code and know whether an invariant broke. Without that, the safest available action is
always "change nothing", which is not compatible with a rebuild.

**Target technology decision.** **TD-034–037** — Vitest, integration tests against a real PostgreSQL in
CI, Playwright for critical human paths, axe-core for the accessibility floor.

**Later owning stage.** **20** owns the test strategy; Stage 11 chooses only the tools.

---

### C-61 — **OPEN** · Two competing schema-change mechanisms

**Current technology.** `db:push` runs `drizzle-kit push` (diff and apply, no history) **and** seven
hand-written `.sql` migrations exist, of which CI applies `002`–`006` and **deliberately skips `001`**.

**Conflict.** Nothing can state what the production schema is derived from. `push` has no review step,
no ordering guarantee and no reliable reversal; the migration files are a partial, hand-maintained
parallel history with a known hole. On a system holding money, stock and immutable history, an
unreviewed automatic diff is an unacceptable operational limit.

**Why it matters.** Stage 15 is about to design a schema. It needs exactly one mechanism to design
against, and a baseline it can trust.

**Target technology decision.** **TD-017** — generated, committed, reviewed migrations as the single
source of schema change; `push` for local development only; Neon branching to rehearse.

**Related.** **C-19** — the reason `001` is skipped — must be resolved as part of establishing the
baseline.

**Later owning stage.** **15**, **21**.

---

### C-62 — **OPEN** · No structured logging, so the locked error contract cannot be delivered

**Current technology.** 55 `console.*` calls in `server/`. No logging library, no correlation
identifier, no redaction.

**Conflict.** `DESIGN_SYSTEM.md` §16.3 is locked: a failure may carry **"a short opaque reference the
user can quote"**, meaningless outside ScholarShelf's own logs. That requires a correlation identifier
present in both the user's message and the log record. Neither exists. As things stand the contract
is undeliverable — a user could quote a reference and there would be nothing to look it up in.

**Why it matters.** It is a locked requirement that current technology cannot meet, which is the
definition of a conflict rather than a preference. It also compounds **C-18**: without a logger that
redacts by configuration, credentials keep reaching logs by accident.

**Target technology decision.** **TD-031** — a structured JSON logger with per-request correlation and
configured redaction, keeping the technical log strictly separate from the **DM-053** audit event.

**Later owning stage.** **16** redaction policy · **19** audit · **21** log destination.

---

### C-63 — **TARGET RESOLVED / IMPLEMENTATION OPEN** · Processing region is not configured

**Current technology.** `vercel.json` sets no `regions`, so compute runs in the platform's default
region. The Neon region has not been verified from the repository and is not recorded anywhere in the
document set.

**Conflict.** **D-01 locks ScholarShelf to the UK market**, and the product processes children's
personal data, family relationships and payment information. Where that processing physically happens
has not been decided — it has been defaulted.

**Why it matters.** For UK schools, the location of processing is a question their own data-protection
obligations make them ask, and "we never chose" is not an answer a school will accept from a
processor. It also affects latency between compute and database, which is a straightforward
performance matter as well.

**Target technology decision — RESOLVED by TQ-1 = A.**

```
C-63 TARGET
→ explicit UK/EU processing configuration
```

The policy is locked (§29.1): every provider that processes ScholarShelf product data must offer, and
be configured for, UK/EU processing.

**Status: IMPLEMENTATION OPEN. Not implementation-resolved.** No infrastructure has changed. The
current compute region is still the platform default and the current Neon region is still unverified.

**What later stages must do:**

```
1. verify the existing compute and database regions
2. configure the target UK/EU regions
3. migrate data or compute if the current regions do not satisfy the policy
4. verify every external processor — object storage, error tracking,
   email, and any external logging destination
```

**Explicitly flagged for qualified review.** This document makes **no claim** about compliance status
and offers **no legal advice**. Data-processing agreements, sub-processor disclosure, retention and the
controller/processor relationship require BytHub's own legal and security review.

**Later owning stage.** **16** verification and processor review · **21** configuration and migration ·
plus external legal review.

---

## 36. Owner decisions — all **DECIDED**

```
TQ-1 — DECIDED A

ScholarShelf adopts a deliberate UK/EU processing policy
for product data handled by its selected infrastructure
and service providers.

This is a product/procurement/technical policy.
Legal transfer mechanisms and compliance determinations
remain subject to BytHub's legal/privacy review.


TQ-2 — DECIDED A

ScholarShelf keeps its custom authentication for this rebuild,
hardened with maintained cryptographic/MFA libraries.

ScholarShelf continues to own authorisation entirely.
No managed identity provider is introduced in this rebuild.

The decision may be revisited by traceable amendment if
enterprise SSO or another materially different customer
requirement emerges.
```

**Zero Stage 11 owner questions remain open.**

---

### TQ-1 — DECIDED A · UK/EU processing for ScholarShelf product data

**The decision.** ScholarShelf product data must be processed in **UK or EU regions** by the
infrastructure and service providers selected for the product, unless a future explicit owner or legal
exception is recorded.

**The reasoning:**

```
UK SCHOOLS
+ CHILDREN'S / FAMILY / FINANCIAL DATA
+ COMMERCIAL PROCUREMENT EXPECTATIONS

→ deliberately choose UK/EU processing
```

**Stated precisely, so it is not misquoted later.** This is a **product, procurement and technical
policy**. It is **not** a claim that UK GDPR makes all processing outside the UK or EU unlawful — that
is not the decision and this document does not say it. Legal interpretation of international
transfers, adequacy, safeguards, DPAs and processor contracts remains for **BytHub's legal and privacy
review**.

**The rule, applied to every provider that receives product or personal data:**

```
PROVIDER PROCESSES SCHOLARSHELF PRODUCT DATA
→ UK/EU PROCESSING CAPABILITY REQUIRED
```

| Provider | Effect |
|---|---|
| **Neon** (TD-014) | **KEEP**, with a **UK/EU region required**. Current production region unverified — verify later; migrate if it does not satisfy the policy |
| **Vercel** (TD-030) | **KEEP**, but **default-region behaviour is no longer acceptable**. Target: explicitly configured UK/EU processing region |
| **Object storage** (TD-023) | Technology class unchanged — S3-compatible, signed direct upload — now **plus UK/EU capability**. **Provider eligibility is constrained; no provider is selected.** Selection remains **Stage 17** |
| **Error tracking** (TD-032) | One platform, front and back, now **plus UK/EU capability, scrubbing, retention controls and processor terms**. **No provider selected** — evidence does not establish one uniquely |
| **Resend** (TD-025) | **KEEP.** Receives recipient details, message content, children's names and payable amounts, so it is **in scope for the later provider and privacy review**. Reopened only if that verification finds a concrete incompatibility |
| **External logging**, if ever adopted | Becomes subject to the same policy and the same review |
| **Future integrations** | Assessed on the data actually transmitted |

**The data-by-provider distinctions in §29 are preserved.** The policy applies to every provider; the
providers do not all receive the same category of data, and this document does not claim they do.

*Applied in* §2.4 · §3 (matrix rows) · **§29.1** (the policy) · TD-014 · TD-023 · TD-025 · TD-030 ·
TD-031 · TD-032 · **TR-009** · **C-63**.

*Consequence for C-63.* **TARGET RESOLVED / IMPLEMENTATION OPEN.** The target is now explicit UK/EU
processing configuration. **No infrastructure has changed**, no region is configured, and no database
is migrated. Later stages must verify existing regions, configure targets, migrate if required, and
verify external processors.

*Not done here:* no region configured, no Neon migration, no provider chosen, no legal determination.

---

### TQ-2 — DECIDED A · Custom authentication, hardened

**The decision.** ScholarShelf retains its own authentication flows for this rebuild.

```
CUSTOM SCHOLARSHELF AUTHENTICATION
+ MAINTAINED CRYPTOGRAPHIC PRIMITIVES
+ SERVER-SIDE SESSIONS
+ STAGE 16 SECURITY HARDENING
```

**The boundary, preserved exactly:**

```
AUTHENTICATION
→ proves who the person is

SCHOLARSHELF AUTHORISATION
→ decides what the person may do
→ in which context
→ under which authorities
→ to which resource
→ within which scope
→ under which conditions
```

**Stage 7 remains authoritative:**

```
PERSON → ACTIVE CONTEXT → ACTIVE AUTHORITIES → CAPABILITY → RESOURCE → SCOPE → CONDITIONS
```

**No identity provider owns that model, and no second role, organisation or authority system is
introduced.**

**What this decision does not mean.** It does **not** mean "keep hand-rolling cryptography". The flows
stay ScholarShelf's; the primitives move to maintained libraries. Unchanged and confirmed:

```
bcryptjs                      → REPLACE with Argon2id            (TD-020)
hand-written TOTP             → REPLACE with a maintained library (TD-021)
express-session + connect-pg-simple + PostgreSQL server-side sessions → KEEP (TD-019)
```

**No stateless JWT authority token is introduced.** The locked product requires changes to staffing,
guardian relationships, role grants, authority grants and support engagements to affect access
promptly, which a bearer token cannot deliver.

**Stage 16 determines** exact Argon2id parameters · password migration mechanics · reset-token
handling · MFA replay prevention · recovery-code storage · session-fixation protection · enumeration
resistance · account recovery · support and elevation authentication. **Stage 11 fixes only the
technology direction.**

**Future position — recorded, not closed.** A managed identity provider is **not selected for this
rebuild**. That is not the same as "never". The legitimate trigger to reopen build-versus-buy:

```
ENTERPRISE SSO
or a materially changed sales / customer requirement
```

Because Stage 11 is now locked, **any such change requires a traceable owner amendment.**

*Applied in* §3 (matrix row) · TD-018 · TD-019 · TD-020 · TD-021 · **TR-006** · §38.

*Consequence for TR-006.* **OPEN — accepted and managed, not resolved.** Owner acceptance does not
remove the security burden. BytHub retains ongoing responsibility for session fixation, timing,
enumeration, reset-token handling, MFA replay and recovery-code storage. The mitigation is now
explicit: maintained primitives · Stage 16 security design and review · strong test coverage
(TD-034–037) · production monitoring (TD-032).

*Consequence for C-40.* **Not resolved, and not claimed to be.** TQ-2 only ensures ScholarShelf does
not add a *second*, external role and authority model beside Stage 7's. The target authority
architecture and mechanics remain with **Stages 12, 13 and 16**.

*Not done here:* no identity provider chosen, no Argon2id implemented, no TOTP code changed, no
authentication migration performed.

---

## 37. What Stage 11 deliberately does not decide

| Not decided | Owner |
|---|---|
| System architecture · how the pieces are arranged · whether the public CMS site is rendered differently from the application | **Stage 12** |
| Frontend and backend folder structure · service and repository classes · component trees · module packages · routing structure · physical token and component architecture (**C-54**) | **Stage 13** |
| API routes · endpoint contracts · request and response shapes | **Stage 14** |
| Tables · columns · indexes · the schema's organisation (**C-43**) · the durable notification record · the job record · migration content | **Stage 15** |
| Permission algorithms · session data structure · authentication mechanics · Argon2id parameters · TOTP handling · signed-URL policy · log redaction policy · upload security | **Stage 16** |
| Email templates · payment provider selection · external integration design | **Stage 17** |
| Alerting thresholds · scale behaviour · large-tenant digest behaviour (**C-30**) | **Stage 18** |
| Audit mechanics behind **DM-053** | **Stage 19** |
| The test strategy — what is tested, to what depth, and the coverage bar | **Stage 20** |
| Deployment pipeline · log destination · migration execution | **Stage 21** |
| **Which implementation survives · dependency removal · asset migration · the SheetJS change · migration order** | **Stage 22** |
| Legal and compliance determinations on data residency and processing | **BytHub legal / security review** |

---

## 38. Success criteria — answered

```
Are we keeping React?
  → YES. React 19, unchanged. No locked requirement it fails, no TP-1 reason.

Are we keeping Express?
  → YES. Express 5 is current, works under the platform's Node runtime, and
    hosts the single tenant-isolation choke point Stage 7 depends on.

Are we keeping PostgreSQL?
  → YES. I-2 alone settles it: three modules' writes in one transaction.

Are we keeping Neon?
  → YES — with a UK/EU region REQUIRED (locked, TQ-1 = A), and with the constraint that
    the settlement path must run on a transaction-capable connection.

Are we keeping Drizzle?
  → YES, upgraded. C-42 and C-43 are architecture problems, not ORM problems.

How will production DB migrations be managed?
  → Generated, committed, code-reviewed migration files, applied by an explicit
    deployment step, rehearsed on a Neon branch. `drizzle-kit push` NEVER runs
    against production. Local development only.

Are we keeping custom authentication?
  → YES for this rebuild, hardened. LOCKED, TQ-2 = A. ScholarShelf keeps
    authorisation regardless; that is locked, not a question.

Where will files actually be stored?
  → S3-compatible object storage with signed direct upload. NOT base64 in
    Postgres, which is where they are today. Must be UK/EU-capable (TQ-1);
    provider selection remains Stage 17.

Is Resend retained?
  → YES. And the email provider still does not own notification truth.

Do we need a durable job system?
  → YES — durable job RECORDS in PostgreSQL with claim-and-retry.
    NOT a queue, and never for I-2.

Do we need Redis?
  → NO. No evidenced hot path. And nothing cached may ever be authority for
    settlement, stock or custody.

Do we need a separate search engine?
  → NO. PostgreSQL-native. A dedicated engine would be a second copy of
    children's data and a second place tenant isolation could fail.

Is Vercel still appropriate?
  → YES — and the 30-second cap is ScholarShelf's own, not the platform's.
    Verified: 800s available, 1800s extended, Workflows beyond that.

What handles structured logs?
  → A structured JSON logger with per-request correlation and configured
    redaction. Nothing does today, which is why C-62 exists.

What handles production errors/monitoring?
  → One error-tracking platform covering front and back end, plus an external
    health check. Nothing does today.

What is the testing toolchain?
  → Vitest (unit + integration against real PostgreSQL in CI), Playwright (E2E),
    axe-core via Playwright (accessibility floor). There is no framework today.

What replaces or fixes xlsx 0.18.5?
  → SheetJS 0.20.3+ from the SheetJS CDN, vendored, server-side only.
    npm CANNOT fix it — 0.18.5 is the terminal registry release.
    ExcelJS was evaluated and REJECTED: inactive, 1 critical + 2 high open.

Which unused dependencies should disappear?
  → @supabase/ssr, @supabase/supabase-js, passport, passport-local,
    @types/passport, @types/passport-local, framer-motion, date-fns.
    Verified zero importing files each. Removal is Stage 22.
    memorystore is NOT unused — earlier records were wrong.

Does any decision weaken I-2?
  → NO. §33 tests every decision against it.

Have we designed system architecture yet?
  → NO.
```

---

## 39. Summary

1. **45 technology decisions**, TD-001…TD-045, contiguous and verified.
2. **The stack is kept, not replaced.** React, TypeScript, Vite, Wouter, TanStack Query, Tailwind,
   Radix, Express, PostgreSQL, Neon, Drizzle, Resend, Zod, Vercel Cron and Vercel all stay.
3. **Four things are added** — object storage, structured logging, error tracking, a test toolchain.
4. **Three things are replaced** — the migration process, password hashing (**Argon2id**), and
   hand-rolled TOTP (**a maintained library**). Both crypto replacements are **confirmed at lock**;
   TQ-2 keeps the *flows*, not the hand-rolled primitives.
5. **One thing is upgraded through a changed distribution source** — SheetJS, because npm cannot fix
   it.
6. **Four areas deliberately get no technology at all** — cache, search, realtime, analytics.
7. **Eight dependencies are marked for removal**; one previously recorded as unused (`memorystore`) is
   not, and two not previously recorded (`framer-motion`, `date-fns`) are. Stage 0 is not edited; the
   correction is recorded here.
8. **Eight new conflicts, C-56…C-63**, contiguous, every one a case where current technology
   contradicts a locked requirement.
9. **Twelve technology risks, TR-001…TR-012**, contiguous, each with a mitigation and an owning stage.
   **TR-006 stays OPEN as an accepted, managed risk** — owner acceptance does not remove a security
   burden.
10. **UK/EU processing is the locked provider policy** [TQ-1 = A] — a product, procurement and
    technical posture, **not** a claim that non-UK/EU processing is inherently unlawful. Legal
    determinations remain BytHub's.
11. **Custom authentication is retained and hardened** [TQ-2 = A]; **ScholarShelf continues to own
    authorisation entirely**; no managed identity provider is introduced in this rebuild, and the
    trigger to reopen that is recorded.
12. **Node 24 LTS is the locked runtime target.** Verified at lock: Node 26 is **Current**, Node 24 and
    22 are **LTS**, Node 20 is **EOL**. Node 24 is chosen deliberately over Node 26 Current.
13. **C-63 is TARGET RESOLVED / IMPLEMENTATION OPEN.** **C-40 is not resolved** and is not claimed to
    be.
14. **I-2 is preserved by every decision** and explicitly excluded from jobs, caching, search, object
    storage, email and error tracking.
15. **No microservices, no queue, no event bus, no saga, no distributed transaction** anywhere in the
    settlement path.
16. **Zero owner questions remain open.**
17. **Nothing was installed, removed, upgraded, migrated or written to `package.json`.** No region was
    configured, no database migrated, no provider selected, no authentication changed.

```
STAGE 11 — TECHNOLOGY DECISION RECORD
STATUS: LOCKED
Locked: 25 August 2026 by the owner (BytHub Technology Ltd)
Verification date: 25 August 2026

STOP BEFORE STAGE 12
```

---

## Amendment register — amendments recorded after this stage was locked

**This section is append-only.** Each entry states the locked text it amends, the new evidence, what
changed, and which stage raised it. **No locked text above is edited and no decision is retroactively
rewritten.**

### A11-001 — Transactional email provider replacement required by TQ-1

```
RAISED BY:  Stage 17 owner review (INTEGRATIONS_PROVIDERS.md §42.2)
DATE:       31 August 2026
AFFECTS:    TD-025 · the §3 technology table's Email row
TYPE:       AMENDED TARGET — the historical selection is preserved, not rewritten
STATUS:     RECORDED
```

**The original locked position, preserved.** TD-025 decided **Resend — KEEP**, on the reasoning that it
*"is current, maintained, has a clean API, and gives delivery events"*, and added: *"**TQ-1 applies here
too.** Resend receives recipient addresses and message content — which includes children's names and
payable amounts. Its regional and processing posture is therefore in scope for the later provider and
privacy review… **Resend remains KEEP unless that verification finds a concrete incompatibility.**"*

**Two things about that text matter now.** It **already applied TQ-1 to email** in prose — even though
the §3 table's Email row carries no `[TQ-1]` marker where the Neon, object-storage, hosting and
error-monitoring rows do. And it **named the exact condition** under which the decision reopens.

**The new evidence.** Stage 17's provider verification, against Resend's own documentation dated
27 August 2026:

```
"Region selection controls where your emails are routed and sent from.
 It does not control where customer data is stored."
"All account data, including email metadata, logs, and API records,
 is stored in the United States."
                                    — resend.com/docs/dashboard/domains/regions

22 named sub-processors, ALL located in the USA
                                    — resend.com/legal/subprocessors

the DPA requires the customer to acknowledge US transfer as necessary
                                    — resend.com/legal/dpa
```

**The condition TD-025 set has been met: the verification found a concrete incompatibility.** Resend can
send from Ireland; it stores the metadata, logs and API records of every message in the United States,
and offers no configuration that changes that.

**The owner's determination (INTQ-3 = A) confirms the reading TD-025's own prose already carried:
TQ-1's UK/EU processing policy includes transactional email.**

**The amended target:**

| | |
|---|---|
| **Resend** | **CURRENT / LEGACY provider only.** It remains in the tree until migration and continues to send |
| **Before production** | it **must be replaced** by a provider whose *verified* technical and data-location posture satisfies the locked UK/EU procurement policy |
| **The replacement selected** | **Amazon SES, `eu-west-2` (London)** — Stage 17 **PRV-012**, verified 31 August 2026 |
| **The §3 table's Email row** | reads, from this amendment forward, **`Email · Resend · REPLACE · a UK/EU-resident provider [TQ-1]`** |

**What does not change.** The MOD-009 / MOD-015 split (notification truth versus delivery attempt) is
untouched — TD-025 established it and Stage 17 INT-D043 confirms that only the transport moves. The
email templates are provider-neutral. **INTQ-2 = C's experience — school display identity over
ScholarShelf's own sending infrastructure, no per-school DNS — is unchanged.**

**This is a policy and procurement determination. It is NOT a statement that US processing of
transactional email is unlawful under UK GDPR.** Qualified legal review remains required for the
transfer analysis, and **no legal conclusion is drawn here.**

**C-97 stands: TARGET RESOLVED · IMPLEMENTATION OPEN.** Resend is still the provider in the running
system. **A target decision is not a remediation.**

```
STAGE 11 — TECHNOLOGY STACK
STATUS: LOCKED
Amendments recorded: A11-001 (raised by Stage 17 owner review, 31 August 2026)
Email target: a UK/EU-resident provider [TQ-1] — Amazon SES eu-west-2 selected at Stage 17 PRV-012
```
