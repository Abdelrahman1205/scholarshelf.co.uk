# API_CONTRACT.md — Stage 14: API Design & Contracts

```
STAGE 14 — API DESIGN & CONTRACTS
STATUS: LOCKED
Written: 30 August 2026
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
Owner decisions: APIQ-1 — DECIDED A. Zero open owner questions.
Corrections 1–9 of owner review applied and recorded.
New conflicts: C-76 · C-77 (both verified directly).
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` · `TECH_STACK.md` · `SYSTEM_ARCHITECTURE.md` · `CODEBASE_ARCHITECTURE.md` —
**Stages 1–13, all LOCKED.**

**Repository evidence, read directly on 30 August 2026** — all 242 `app.<verb>("…")` registrations,
every `/api/…` string in `client/src/**`, `client/src/lib/queryClient.ts`,
`server/routes/auth.routes.ts`, `server/app.ts`, `server/static.ts`, `api/index.ts`, `vercel.json`,
`client/src/pages/admin/{books,db-console,owner}.tsx`, and **all 95 capability definitions in
`PERMISSIONS.md`**. Handlers and callers were read, not inferred.

---

## 1. Purpose and boundary

Stage 14 answers:

> **What is the explicit HTTP/API contract through which ScholarShelf's clients, public website,
> integrations and operational tooling communicate with the locked application architecture?**

Stage 13 decided *where* responsibilities live. Stage 14 decides resource shape, route contracts,
methods, request and response contracts, the error contract, pagination and filtering, idempotency,
the public and authenticated surfaces, the upload and import flows, health, and the integration seam.

**Stage 14 designs contracts. It implements none of them.**

### 1.1 Identifier prefixes

| Prefix | Meaning |
|---|---|
| **API-P1…** | API principles |
| **API-001…** | target endpoint contracts — **one identifier = one HTTP method + one exact path** |
| **APID-001…** | API decisions — deliberately *not* `API-*`, so an endpoint and a decision can never be confused |
| **API-R1…** | API risks |
| **APIQ-1** | owner question — **DECIDED A** |

### 1.2 What Stage 14 does not decide

| Not decided here | Owner |
|---|---|
| Tables · columns · indexes · foreign keys · RLS · SQL · physical schema · session-table layout · idempotency persistence | **Stage 15** |
| Password hashing · MFA internals · CSRF · cookie attributes · security headers · rate-limit algorithms · error sanitisation mechanics · scheduler authentication · elevation and cooldowns · object scanning · signed-URL expiry | **Stage 16** |
| Object-storage provider · Resend templates · payment provider · webhook signature algorithm · **provider event-identity mechanics** | **Stage 17** |
| Performance thresholds · cache tuning · `total` affordability · job concurrency | **Stage 18** |
| Audit record schema | **Stage 19** |
| Test strategy | **Stage 20** |
| Deployment topology · **the `/api/*` fallback fix (C-77)** · public-site rendering timing · readiness gating | **Stage 21** |
| Migration execution and order · which legacy endpoint dies when | **Stage 22** |

### 1.3 Nothing was changed

**No route was modified. No code was written. No Zod schema was implemented. No database schema or
migration was created. No RLS was implemented. No authentication was changed. No provider was
selected. No Vercel or CI configuration was touched. No legacy route was migrated.**

### 1.4 The release boundary is unchanged

Stage 14 approval ≠ production security clearance ≠ legal sign-off. The BytHub Legal & Compliance
go-live block of 23 August 2026 stands in full.

---

## 2. Current API inventory

### 2.1 Totals, measured

| Measure | Count |
|---|---:|
| `app.<verb>("path")` registrations across `server/routes/*.ts` and `server/*.ts` | **242** |
| Distinct paths (methods collapsed) | **201** |
| Distinct `/api/…` paths referenced in `client/src/**` | **151** |
| Server paths with **no client caller** | **56** |
| Client paths with **no matching server route** | **6 candidates → 1 genuine** (§42) |
| `e.message`-style occurrences in route files | **193** |

The 242 figure reconciles exactly with Stage 0's count, independently re-derived.

### 2.2 Route families, as they exist

| Family | Paths | Owning module | Disposition |
|---|---:|---|---|
| `/api/auth/*` · `/api/invites/*` | 19 | MOD-002 | **SPLIT** — duplicate login/logout families (§2.3 F-1) |
| `/api/admin/*` | 34 | mixed MOD-001…MOD-009 | **SPLIT** — a role prefix, not a resource |
| `/api/students/*` · `/api/families/*` · `/api/guardians/*` | 29 | MOD-004, MOD-003 | **REPLACE** — resource-first |
| `/api/books/*` · `/api/book-levels/*` · `/api/book-copies/*` · `/api/class-book-levels/*` | 24 | MOD-005, MOD-006 | **KEEP + RESHAPE** |
| `/api/classes/*` · `/api/subjects/*` · `/api/class-teacher-assignments/*` | 11 | MOD-003 | **KEEP + RESHAPE** |
| `/api/allocations/*` · `/api/extra-requests/*` · `/api/teacher/*` | 17 | MOD-008 | **REPLACE** — business actions |
| `/api/parent/*` | 15 | MOD-004 + 007 + 009 | **REPLACE** — `/family/*`, child-scoped |
| `/api/finance/*` · `/api/admin/payments/*` | 16 | MOD-007 | **REPLACE** — settlement commands |
| `/api/owner/*` | 38 | MOD-012 | **SPLIT** — platform · support · investigation · break-glass |
| `/api/website/*` · `/api/media/*` · `/api/it/*` | 12 | MOD-011 | **KEEP + RESHAPE** |
| `/api/public/*` | 5 | MOD-001 + MOD-011 | **REPLACE** — `PublishedSite` (§27) |
| `/api/school/branding/*` · `/api/admin/school/settings` | 9 | MOD-001 | **KEEP + RESHAPE** |
| `/api/notifications/*` · `/api/*/message-*` | 12 | MOD-009 | **KEEP + RESHAPE** |
| `/api/cron/run` · `/api/health` · `/api/webhooks/*` · `/api/seed-users` | 5 | MOD-014 / infra / MOD-015 | mixed (§36, §37) |

### 2.3 Findings that shape the target

**F-1 · Two authentication families exist simultaneously.** `auth.routes.ts` registers
`POST /api/auth/sign-in` (line 63) **and** `POST /api/auth/login` (line 207);
`POST /api/auth/sign-out` (281) **and** `POST /api/auth/logout` (294); `POST /api/auth/accept-invite`
(329) alongside `POST /api/invites/:token/accept`. **The client uses `sign-in`/`sign-out` only**; the
other three have zero callers.

**F-2 · One client call has no server route at all.** `client/src/pages/admin/books.tsx:55` calls
`/api/isbn-lookup/${isbn}` by raw `fetch`. No such route exists among the 242. `GET
/api/books/by-isbn/:isbn` **is** registered and has **zero callers**. **Raised as C-76** (§47).

**F-3 · Two candidate orphans are not orphans — verified by reading the handlers.**
`["/api/owner/db/browse", …]` (`db-console.tsx:84`) and `["/api/owner/schools/detail", …]`
(`owner.tsx:569`) are **query-key namespaces with explicit `queryFn`s** fetching
`/api/owner/db/tables/:table` and `/api/owner/schools/:id`. Neither is a 404.

**F-4 · The default query function builds URLs by joining the key.** `queryClient.ts` — `getQueryFn`
does `fetch(queryKey.join("/"))`. Recorded as **API-R7**.

**F-5 · There is no response envelope.** `{message}` ×17, `{success}` ×8, `{school}` ×8, `{ok}` ×5,
`{thread}` ×4, `{count}` ×4, `{payment}` ×3, `{result}` ×2, plus bare arrays and bare objects.

**F-6 · Status-code usage is skewed.** `400` ×300 · `404` ×108 · `500` ×93 · `403` ×47 · `409` ×46 ·
`201` ×36 · `401` ×19 · `429` ×17 · `204` ×10 · `503` ×3 · explicit `200` ×3. **`422` and `412` are
never used**; `400` carries malformed-request *and* domain-validation *and* business refusal.

**F-7 · Two support-mode families.** `owner/enter-support/:schoolId` + `owner/exit-support` (no
callers) alongside `owner/support-mode/enter` + `/exit` (used).

**F-8 · Two console families.** `/api/owner/console/*` (6 routes — elevate, elevate/end, op/:name,
write, audit, operations — the hardened tier, **no callers**) alongside `/api/owner/db/*` (query,
tables, tables/:table, danger/wipe-school, danger/purge-school — **what the client uses**). **The good
implementation is the unused one.**

**F-9 · `POST /api/seed-users` is registered in the production route table.**

**F-10 · Role prefixes are the primary organising principle** — `/api/admin/*`, `/api/parent/*`,
`/api/teacher/*`, `/api/owner/*`, `/api/finance/*`. The URL encodes *who is asking*. This is C-40 and
C-50 in URL form.

**F-11 · Twelve endpoints already implement business actions correctly** — `payments/:id/confirm`,
`/reject`, `/ready-for-collection`, `/collected`, `allocations/:id/confirm`, `/absent`,
`extra-requests/:id/approve`, `/reject`, `schools/:id/{archive,suspend,restore,request-deletion}`.
**The command style already exists here**; Stage 14 generalises it.

**F-12 · The `/api/*` fallback behaviour differs by deployment mode — verified at owner review.**
`vercel.json` matches `/api/(.*)` → `/api/index` **before** `/(.*)` → `/index.html`, so on Vercel an
unmatched `/api/*` reaches Express. `server/app.ts:307` — `if (!options.serverless)` — means
`serveStatic` is **not** mounted in serverless mode, so Express's default handler answers with a
**404 carrying an HTML body**. On non-serverless deployments (`npm start` → `dist/index.cjs`, and
local development) `serveStatic` **is** mounted and `app.use("/{*path}", …)` returns
**`index.html` with 200** for any unmatched path, `/api/*` included. **Raised as C-77** (§47).

---

## 3. API principles

**API-P1 — Transport never grants authority.** A header, body field, cookie or URL segment carries a
*claim*. Authority is resolved server-side per request from the live active context (Stage 12 §8,
Stage 13 APP-020).

**API-P2 — An identifier is a locator, not a permission.** Possession of an ID never implies the right
to read or change it. Every client identifier is resolved under scope before use (APP-022).

**API-P3 — Tenant scope is derived, not supplied.** For tenant-pinned work the school comes from the
authenticated context. A client-supplied `schoolId` is never the reason access is granted.

**API-P4 — Failure is never encoded as empty success.** A dropped dependency, a permission refusal or
a missing precondition never returns `200 []`, `200 null` or `200 {}`. This is the API half of C-32.

**API-P5 — Commands return the authoritative result.** A command responds with the new authoritative
state, so the client never guesses what happened.

**API-P6 — Request bodies are allowlists.** Unknown fields on a command body are **rejected**. There is
no mass-assignment surface.

**API-P7 — A business act gets its own endpoint.** Where permissions, preconditions, audit meaning or
side effects differ, the URL names the act.

**API-P8 — Public contracts contain deliberately public fields only.** The public surface is composed
from published material; never an operational record with fields removed.

**API-P9 — Collections are paginated according to whether they can grow.**

```
UNBOUNDED OR GROWING COLLECTION          → uses the canonical cursor pagination contract
DELIBERATELY SMALL, STRUCTURALLY BOUNDED → may be unpaginated
CONFIGURATION COLLECTION
```

Paginated by nature: children · families · settlements · money events · allocations · hand-overs ·
messages · notifications · platform schools · jobs · stock movements · audit-facing lists · imports.
May be unpaginated: subjects · academic periods · bundle item compositions · class-bundle assignments ·
website navigation · small configuration enumerations. **Tiny lists are not paginated for ceremony —
and a collection is never left unpaginated merely because it was *expected* to stay small.** The test
is structural boundedness, not present size.

**API-P10 — Money crosses the boundary as a decimal string.** `"12.50"`, never `12.5`.

**API-P11 — Dates and times are unambiguous and unformatted.** `YYYY-MM-DD` for dates, ISO-8601 UTC for
instants. Locale formatting is the UI's job.

**API-P12 — One error contract**, from every surface, never carrying internal detail (C-70).

**API-P13 — Retrying a retry-unsafe operation is made safe by the contract**, by an
`Idempotency-Key` for first-party callers or by a provider's own stable event identity for external
callbacks (APID-020).

**API-P14 — No database vocabulary in API contracts.** `DATABASE ROW ≠ DOMAIN FACT ≠ API RESPONSE`.

**API-P15 — Existence is not disclosed across a boundary.** An identifier the caller cannot see under
their scope is `404`, not `403`.

**API-P16 — Every endpoint has exactly one owner** — one module operation, one application
coordinator, or one infrastructure transport responsibility.

---

## 4. API surfaces and namespace

### 4.1 Ten surfaces, one Express application

```
/api/auth/*            AUTH & ACCOUNT           MOD-002
/api/school/*          SCHOOL OPERATIONS        MOD-001…MOD-010   tenant-pinned      SC-1/SC-2/SC-3
/api/family/*          FAMILY                   MOD-004           relationship        SC-4
/api/studio/*          CMS STUDIO               MOD-011           tenant-pinned       SC-1
/api/site/*            PUBLIC SITE              MOD-001 + MOD-011 unauthenticated     SC-8
/api/platform/*        PLATFORM                 MOD-012           platform            SC-7
/api/platform/support/*   SUPPORT MODE          MOD-012           named engagement    SC-6
/api/internal/*        JOBS & SCHEDULER         MOD-014           scheduler           SC-10
/api/integrations/v1/* PROVIDER CALLBACKS       MOD-015           integration         SC-11
/api/health*           HEALTH & READINESS       infrastructure    —
```

**Contract surfaces inside one application. No separate network service is created.**

---

**APID-001 · The namespace stays `/api/`, unversioned — with one deliberate exception**

*Decision:* **`/api/` with no version segment for all first-party surfaces. `/api/integrations/v1/` for
provider callbacks only.**

*Reason:* a version segment buys the ability to run two contracts at once for consumers you cannot
redeploy. ScholarShelf has none among its first-party surfaces: the SPA, the public site and internal
tooling are built and deployed together from one repository. **Provider callbacks are different** — a
third party configures a URL and keeps using it across our deployments — so that surface is versioned
from the start (§37).

**`/api/site/*` is first-party and therefore unversioned** (APIQ-1 = A, §48). It is **not** versioned
as a speculative hedge; doing so would contradict this decision's own reasoning.

*Consequences:* short readable URLs; no dual-maintenance of route trees.

---

**APID-002 · Breaking change by coexistence and deprecation headers**

First-party breaking changes are handled by **coexistence**, which Stage 22 needs regardless. A legacy
endpoint is marked deprecated, answers with `Deprecation` and `Sunset` response headers, and is
removed only after its replacement has callers and it has none. **Every legacy endpoint names a target
replacement, a migration owner and a removal stage** (§41).

---

**APID-003 · Surfaces are named for the addressed thing, not the asking role**

*Problem:* `/api/admin/*`, `/api/finance/*`, `/api/teacher/*`, `/api/owner/*`, `/api/parent/*` encode
the caller's role. A `school_admin` holding AUTH-FINANCE cannot reach `/api/finance/summary` without
*being* the finance role. C-50 in URLs.

*Decision:* **the four operational role prefixes collapse into `/api/school/*`.** Family stays
separate because its *scope basis* differs (SC-4, relationship-derived). Platform stays separate
because its scope basis differs (SC-7).

```
/api/admin/*  ┐
/api/finance/*├──▶  /api/school/*      one surface · CAPABILITY decides reach
/api/teacher/*┘
/api/parent/* ──▶   /api/family/*      SC-4 relationship-derived
/api/owner/*  ──▶   /api/platform/*    SC-7 platform scope
```

*Consequences:* `GET /api/school/settlements` (API-118) is one endpoint gated by **CAP-045**, whose
visible rows and permitted actions follow capability reach. **No finance login, no finance namespace,
no role in any URL.**
*Conflicts affected:* **C-40 · C-50** — API-layer target resolved, implementation Stage 22.

---

## 5. Authentication and account contracts

**APID-004 · One authentication family. The duplicates are deprecated, not deleted here.**

`/api/auth/sign-in` (API-001), `/api/auth/sign-out` (API-003) and `/api/invites/:token/accept`
(API-009) are the target contracts. `auth/login`, `auth/logout` and `auth/accept-invite` become
**LEGACY — deprecated, replacement named, removal Stage 22.**

Auth endpoints are **API-001…API-017** (§17). **Auth mechanics — cookies, CSRF, hashing, TOTP
internals, lockout, token lifetimes — are Stage 16.**

---

## 6. Context and capability presentation contract

**APID-005 · `SessionState` informs navigation. It is never an authority token.**

```
SessionState {
  person:        { id, displayName }
  activeContext: { id, kind: "school" | "family" | "platform", label }
  school?:       { id, name, code, identity }          present iff tenant-pinned
  capabilities:  CapabilityId[]        FOR PRESENTATION ONLY  (Stage 13 APP-021)
  surfaces:      SurfaceId[]
  supportMode?:  { engagementId, schoolId, schoolName, startedAt }
  availableContexts: [{ id, kind, label }]
}
```

**`SessionState` carries no role field** (APP-020): there is no `role` for a client to cache as
permission. Re-fetched on context change (API-005, **CAP-039**); never a bearer credential. A client
that forges `capabilities` sees menu items whose endpoints refuse it.

*Conflicts affected:* **C-67** — API-layer target resolved, implementation Stage 22.

---

## 7. Tenant, family, platform and support scoping

**APID-006 · Four scoping rules, one per locked scope basis**

| Basis | Surface | Locked scope | How the school is determined | Client may supply a school id? |
|---|---|---|---|---|
| **Tenant-pinned** | `/api/school/*` · `/api/studio/*` | **SC-1** (SC-2/SC-3 for teacher reach) | from the authenticated context, server-side | **NO — never as the reason for access** |
| **Relationship-derived** | `/api/family/*` | **SC-4** | from the **child**, via the guardian relationship | **NO** |
| **Platform** | `/api/platform/*` | **SC-7** | not applicable | n/a |
| **Named-school support** | `/api/platform/support/:engagementId/*` | **SC-6** | from the **named support engagement** | **NO — the engagement names it** |

**The rejected shape, recorded so it cannot return:**

```
POST /api/school/books
{ "schoolId": "whatever-the-client-sent", "title": "…" }        ✗ REJECTED
```

**There is no `X-School-Id` header, and no header of any kind selects a tenant.**

**Family scoping, stated exactly.** `GET /api/family/children` (API-177) returns the caller's children
**across every school** under SC-4, with no school selector anywhere. `/api/family/children/:childId/…`
derives the school **from the child**. A `childId` that resolves to no relationship for this caller is
`404` (API-P15).

---

## 8. Resource conventions

**APID-007 · URLs name product resources and workflows, not Stage 6 entities and not tables**

**Deliberately not resources:** `book_copies` as a standalone tree (addressed under a book or by scan
code), `class_book_levels` and `book_level_items` as top-level joins (addressed as a bundle's or
class's composition), `inventory_transactions` (read under stock; never written directly), and
`guardians` as a root (addressed under a family). Each exists as a top-level route today; each is a
table showing through the API.

**APID-008 · Identifiers.** Internal resources use **opaque UUIDs**, unchanged. The **school code is
public** and is the public site's addressing key. An opaque id never implies permission (API-P2).

---

## 9. Read contract conventions

**APID-009 · Single reads return the resource; collections return one envelope**

```
GET  /api/school/children/:childId   →  200  Child
GET  /api/school/children            →  200  { items: Child[], nextCursor: string|null, total?: number }
```

A single resource needs no wrapper and types cleanly through TanStack Query without a `.data` hop. A
collection has genuine metadata, so its envelope is required rather than decorative. **One exception
with a reason, not a blanket wrapper.** `total` appears only where a screen displays a count and the
query can afford it — **affordability is Stage 18.**

**APID-010 · Screen read compositions are permitted, and own no truth.**

| ID | Path | Screen | Capability |
|---|---|---|---|
| API-172 | `GET /api/school/overview` | Today | CAP-076 |
| API-117 | `GET /api/school/money/overview` | Money Today | **CAP-045** |
| API-059 | `GET /api/school/children/:childId/overview` | child detail | CAP-021 |
| API-141 | `GET /api/school/handovers/queue` | teacher hand-over queue | **CAP-062** |
| API-179 | `GET /api/family/children/:childId/overview` | family child detail | CAP-057 |
| API-260 | `GET /api/platform/support/:engagementId/overview` | support tenant overview | **CAP-088** |

Built by MOD-010 over operational read interfaces (Stage 13 APP-029). They own no truth, mutate
nothing, and **are not a BFF service.**

---

## 10. Command contract conventions

**APID-011 · A business act gets a named endpoint; `PATCH` edits attributes**

```
PATCH /api/school/children/:childId   { preferredName: "Sam" }       ✓ an attribute      CAP-018
POST  /api/school/settlements/:id/confirm                            ✓ a business act    CAP-049
PATCH /api/school/settlements/:id     { status: "confirmed" }        ✗ REJECTED
```

`POST /api/admin/payments/:id/order-status` — a generic status setter beside eight specific
commands — is **REMOVED** from the target (§41).

---

## 11. Validation and unknown fields

**APID-012 · Command bodies are closed; responses are additive**

| Rule | Contract |
|---|---|
| Unknown field on a command body | **`400 VALIDATION_FAILED`**, naming the field. Never silently ignored. |
| Path parameters | identity and locators only |
| Query parameters | reads only — filtering, sorting, pagination. **Never on a command.** |
| Body | the command's declared inputs, allowlisted |
| **Server-owned — never accepted from any client** | `id` on create · `schoolId` · `createdAt`/`updatedAt` · any `*Status` a business act owns · `confirmedAt`/`confirmedBy`/`reviewedBy` · `actorId` · any audit attribution field · `publishedAt` · custody state · stock level · applied amount |
| Responses | clients tolerate **additive** fields |

**Zod remains the implementation technology (Stage 11). No Zod schema is written here.**
Security-specific validation is **Stage 16**.

---

## 12. Canonical success and error contracts

**APID-013 · One error envelope, for every surface**

```
{
  "error": {
    "code":      "SETTLEMENT_ALREADY_CONFIRMED",   stable · machine-readable · never localised
    "message":   "This order has already been confirmed.",   human-safe
    "reference": "r_9f2c41a8",                     opaque support reference (§38)
    "fields":    { "email": "Enter a valid email address." },   optional · validation only
    "retryable": false                             optional · where knowable
  }
}
```

**Never carries** — and no code path exists that could put them there: stack traces · SQL or query
fragments · table, column or constraint names · provider secrets or raw provider responses · another
tenant's identifiers · filesystem paths · environment values · internal hostnames.

**Stage 16 owns the sanitisation mechanics that guarantee it**; Stage 13 APP-015 owns the single place
it is produced. *Conflicts affected:* **C-70** — contract defined; the 193 call sites are Stage 22.

---

## 13. Status-code policy

**APID-014 · Fourteen codes, each with a defined contract — and no decorative additions**

| Code | Meaning here | Notes |
|---|---|---|
| **200** | successful read, or a command returning its authoritative result | |
| **201** | resource created | `Location` header set |
| **202** | durable work accepted, not complete | **only** with a job resource to poll (§39) |
| **204** | command succeeded, nothing to return | sign-out, deletes |
| **400** | **malformed or unparseable request**; unknown field | the *shape* is wrong |
| **401** | not authenticated | |
| **403** | authenticated, resolved, **capability refused** | §13.1 |
| **404** | **not visible under the caller's scope** | §13.1 |
| **409** | **business or state conflict** | already confirmed · state-transition conflict · idempotency-key/body mismatch · business concurrency not expressible as an HTTP precondition |
| **412** | **`If-Match` precondition failed** | the ETag supplied does not match current (APID-021) |
| **422** | shape valid, **domain rule** refuses | insufficient stock · settlement not payable · own-child hand-over (CD-5) |
| **429** | throttled | `Retry-After` set |
| **500** | internal failure | envelope only |
| **503** | dependency unavailable · readiness failure | §36 |

**`422` and `412` are both introduced deliberately.** Today `400` is used 300 times carrying three
meanings and neither `412` nor `422` appears anywhere. Splitting them lets a client distinguish *fix
your request* (400) from *your copy is stale* (412) from *the business says no* (422) without parsing
prose.

**409 versus 412 — the rule.** `412` is used **only** for a failed `If-Match` precondition, which is
standard HTTP semantics. `409` remains for business and state conflicts that HTTP precondition
semantics do not express: already-confirmed, an invalid state transition, an idempotency key reused
with a different body. **I-2 uses `409`, not `412`, because I-2 does not use `If-Match`** — its
concurrency guarantee is PostgreSQL's conditional claim-lock inside one transaction, which is
stronger, and adding an ETag in front of it would put a weaker check before a stronger one.

### 13.1 404 versus 403 — one consistent rule

```
identifier does not resolve UNDER THE CALLER'S SCOPE   →  404      existence not disclosed
identifier resolves, capability is refused             →  403      the thing is known to them
```

A child at another school is `404` to a school admin — never `403`, which would confirm the record
exists. A child at *their* school they may not open is `403`. **Public site unavailability is always
`404`** (§28). Stage 16 may tighten specific cases; it may not loosen this.

---

## 14. Money, date and identifier contracts

**APID-015 · Money is a decimal string with an explicit currency**

```
"amount": { "value": "127.50", "currency": "GBP" }
```

`127.50` as a JSON number is an IEEE-754 double the moment it is parsed. A string is exact, sorts
predictably, and round-trips unchanged. **GBP is the locked UK assumption (D-01).** No thousands
separators, no symbol, no locale. **Database representation is Stage 15.**

**APID-016 · Dates and times**

| Kind | Format | Example |
|---|---|---|
| Calendar date | `YYYY-MM-DD` | `"2026-09-03"` |
| Instant | ISO-8601, UTC, `Z` | `"2026-08-30T14:22:05Z"` |
| Academic period | stable id + label | `{ id: "…", label: "2026/27" }` |

---

## 15. Pagination, filtering and search

**APID-017 · One pagination contract: cursor, with an optional total**

```
GET /api/school/children?limit=50&cursor=…&sort=name:asc&status=active
    → { items: [...], nextCursor: "…" | null, total?: 812 }
```

Cursor rather than offset because the heavy collections grow and are written to while being read;
offset paging skips and repeats rows under concurrent insert. `total` covers admin tables that display
"1–50 of 812". Applied per **API-P9** — growing collections only.

**APID-018 · Filters run inside authorised scope, always**

```
resolve context → derive scope → filter WITHIN scope → paginate → return     ✓
fetch everything → return → let the client filter                            ✗ REJECTED
```

Canonical filter names: `status` · `classId` · `periodId` · `childId` · `from`/`to` · `q` ·
`settlementState` · `handoverState` · `unreadOnly`.

**APID-019 · Search is scoped before it queries; there is no global search**

PostgreSQL-native (Stage 11), per-resource. **No cross-tenant search endpoint and no global search
that filters after retrieval** — that shape is C-64 wearing a different hat. A search inherits exactly
the scope of the equivalent list read.

---

## 16. Idempotency and concurrency

**APID-020 · Retry safety has two forms, because two kinds of caller exist**

```
FIRST-PARTY CALLER, retry could cause real harm
      → Idempotency-Key: <client-generated, unique per intent>
      → first call: 200 + the authoritative result
      → retry, same key: 200 + THE SAME result, no second effect
      → same key, DIFFERENT body: 409 IDEMPOTENCY_KEY_CONFLICT

EXTERNAL PROVIDER CALLBACK
      → the provider's own STABLE UNIQUE EVENT IDENTIFIER
      → or another integration idempotency identifier defined at Stage 17
      → the MOD-015 integration boundary converts that external identity into
        ScholarShelf's internal replay and idempotency protection
```

**A provider is never required to send a `Idempotency-Key` header it does not support.** Correcting an
earlier draft that stated this too broadly: ScholarShelf's custom header is a first-party contract, and
imposing it on a third party would make the integration seam depend on a provider implementing our
convention. **Stage 17 owns provider-specific mechanics; Stage 15 owns persistence uniqueness; Stage
16 owns verification and security.**

**`Idempotency-Key` required on:** settlement confirmation (API-120) · settlement rejection ·
money-event recording and application · discount, waiver, correction and refund · import commit
(API-170) · website publish (API-229) · hand-over (API-143) · collection (API-144) · replacement charge
decision (API-153) · upload finalisation (API-223 · API-023) · stock intake and correction · rollover (API-115)
· platform lifecycle acts · manual job retry · break-glass operations.

**Not required on** ordinary attribute edits, which are naturally idempotent, or on reads.

**Persistence enforcement is Stage 15.** The existing conditional claim-lock in `confirmPayment` —
verified good — makes the *business* guarantee; the header makes *transport* retry safe on top of it.

**APID-021 · `If-Match` where a human can silently overwrite another human — and `412` when it fails**

```
GET   /api/studio/pages/:pageId      → 200 + ETag: "v42"
PATCH /api/studio/pages/:pageId      If-Match: "v42"  → 200
                                     If-Match: "v41"  → 412 PRECONDITION_FAILED
```

**Applied to:** website content, pages, news, events, presentation, contact and site settings (two
Studio users editing) · school settings and identity · academic periods · bundle composition and
class-bundle assignment · replacement review and charge decision · platform school metadata.

**Not applied to** settlement confirmation, allocation or stock — **I-2 relies on PostgreSQL's
authoritative concurrency inside one transaction** (Stage 12 §17). Optimistic concurrency is added
where a human can overwrite another human's work without noticing, **not everywhere for consistency.**

---

## 17. Target endpoint catalogue — API-001…API-282

**APID-022 · One API identifier means one HTTP method and one exact contract path**

*Correction 1, applied at owner review.* The PROPOSED draft claimed **158 endpoint contracts** while
many identifiers bundled several methods under one row (`GET · POST /resource`,
`GET · PATCH · DELETE /:id`), and API-150 named a wildcard namespace rather than a contract. **That
count was imprecise and is not preserved.**

```
ONE API-nnn  =  ONE HTTP METHOD  +  ONE EXACT CONTRACT PATH
```

`GET /api/school/classes`, `POST /api/school/classes`, `GET /api/school/classes/:classId`,
`PATCH …/:classId` and `DELETE …/:classId` are **five identifiers**, not one. A resource family may
still be grouped visually in a table; each method and path keeps its own stable identifier.

**Stage 14 was not locked, so the identifiers were renumbered once, cleanly.** Every cross-reference,
the I-2 identifier, the legacy map, the reconciliation, the diagrams and the summary were updated
together. **APID-\*, API-P\* and API-R\* were not renumbered.**

**After expansion: 282 target endpoint contracts, API-001…API-282, contiguous. Zero wildcard paths.**

### 17.1 How to read the catalogue

Every row records: **API ID · exact HTTP method · exact path · required capability · scope and
conditions · idempotency or precondition requirement · owning operation · legacy replaced.** Request
and success contracts follow §9–§12 by class of endpoint; the per-endpoint contracts that differ
materially are given in full in §21 (I-2), §22, §23, §26–§30, §35–§37.

**Capability column, per Correction 3.** Every authenticated endpoint names its exact locked
capability from `PERMISSIONS.md` — `CAP-001…CAP-095` — never a descriptive phrase. `PUBLIC` means
unauthenticated by design. Where two capabilities may independently permit an endpoint, both are
named with `OR`; where an act genuinely requires two, `AND`.

The trace this enables:

```
API-nnn  →  CAP-nnn  →  AUTH-*  →  SC-*  →  CD-*  →  owning module or orchestrator
```

**Capability coverage, measured.** **92 of the 95 locked capabilities map to at least one endpoint.**
The three that do not are each explainable from `PERMISSIONS.md` itself, and **none is a conflict**:

| Capability | Why no endpoint |
|---|---|
| **CAP-040** `open_cycle` | *"usually system-initiated at enrolment"* — exercised inside `application/enrol-family` (API-081) and the import commit (API-170), which is where a cycle is opened. It is not a user-invocable act. |
| **CAP-066** `dispatch_postal` | marked **FUTURE** in `PERMISSIONS.md`. DM-056 Dispatch is future-only; no endpoint is created for it. |
| **CAP-095** `deliver_notification` | the email provider's capability at **SC-12 (no scope)**. Exercised by the MOD-015 gateway on an outbound call, never over an inbound HTTP contract. |

**No new capability was invented, and no capability was redefined.** Stage 9 classified five as
non-surfaced (CAP-036, CAP-066, CAP-093, CAP-094, CAP-095); at the API layer **CAP-036** gains a
break-glass endpoint (API-276), **CAP-093** the scheduler trigger (API-278) and **CAP-094** the
integration callback (API-279), while **CAP-040** joins the non-surfaced set. That is a refinement of
where a capability is exercised, not a change to what it means.

### AUTH & ACCOUNT

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-001** | `POST` | `/api/auth/sign-in` | PUBLIC | — | — | MOD-002 | auth/login (dup) |
| **API-002** | `POST` | `/api/auth/sign-in/mfa` | PUBLIC (challenge) | — | — | MOD-002 | auth/mfa/verify |
| **API-003** | `POST` | `/api/auth/sign-out` | authenticated | SC-5 | idem | MOD-002 | auth/logout (dup) |
| **API-004** | `GET` | `/api/auth/session` | authenticated | SC-5 | — | MOD-002 | GET /api/auth/me |
| **API-005** | `POST` | `/api/auth/context` | CAP-039 | SC-5 | — | MOD-002 | POST /api/auth/context |
| **API-006** | `POST` | `/api/auth/password-reset` | PUBLIC | — | idem | MOD-002 | auth/forgot-password |
| **API-007** | `POST` | `/api/auth/password-reset/complete` | PUBLIC (token) | — | — | MOD-002 | auth/reset-password |
| **API-008** | `GET` | `/api/invites/:token` | PUBLIC | — | — | MOD-002 | GET /api/invites/:token |
| **API-009** | `POST` | `/api/invites/:token/accept` | PUBLIC (token) | — | — | MOD-002 | invites/:token/accept · auth/accept-invite (dup) |
| **API-010** | `POST` | `/api/auth/sign-up-parent` | CAP-026 | SC-5 | — | MOD-002 | auth/sign-up-parent |
| **API-011** | `GET` | `/api/auth/mfa` | CAP-038 | SC-5 | — | MOD-002 | auth/mfa/status |
| **API-012** | `POST` | `/api/auth/mfa/setup` | CAP-038 | SC-5 | — | MOD-002 | auth/mfa/setup |
| **API-013** | `POST` | `/api/auth/mfa/verify` | CAP-038 | SC-5 | — | MOD-002 | auth/mfa/enable |
| **API-014** | `POST` | `/api/auth/mfa/recovery-codes` | CAP-038 | SC-5 | — | MOD-002 | auth/mfa/recovery-codes |
| **API-015** | `DELETE` | `/api/auth/mfa` | CAP-038 | SC-5 | idem | MOD-002 | auth/mfa/disable |
| **API-016** | `GET` | `/api/auth/profile` | CAP-038 | SC-5 | — | MOD-002 | — |
| **API-017** | `PATCH` | `/api/auth/profile` | CAP-038 | SC-5 | — | MOD-002 | — |

### SCHOOL OPERATIONS

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-018** | `GET` | `/api/school/settings` | CAP-003 | SC-1 · CD-1 | — | MOD-001 | admin/school/settings |
| **API-019** | `PATCH` | `/api/school/settings` | CAP-002 | SC-1 · CD-1, CD-9 | If-Match | MOD-001 | PATCH admin/school/settings |
| **API-020** | `GET` | `/api/school/identity` | CAP-003 | SC-1 · CD-1 | — | MOD-001 | school/branding |
| **API-021** | `PATCH` | `/api/school/identity` | CAP-001 | SC-1 · CD-1 | If-Match | MOD-001 | PATCH school/branding |
| **API-022** | `POST` | `/api/school/identity/assets/uploads` | CAP-001 | SC-1 · CD-1 | — | MOD-001 | school/branding/{logo,banner,favicon,pdf-logo,email-logo} |
| **API-023** | `POST` | `/api/school/identity/assets/uploads/:uploadId/finalise` | CAP-001 | SC-1 · CD-1 | Idempotency-Key | MOD-001 | — (new: acceptance step) |
| **API-024** | `POST` | `/api/school/identity/assets/reset` | CAP-001 | SC-1 · CD-1 | idem | MOD-001 | school/branding/reset |
| **API-025** | `GET` | `/api/school/setup` | CAP-003 | SC-1 · CD-1 | — | MOD-001 | admin/setup-status |
| **API-026** | `POST` | `/api/school/setup/complete` | CAP-002 | SC-1 · CD-1 | idem | MOD-001 | admin/setup-complete |
| **API-027** | `GET` | `/api/school/staff` | CAP-037 | SC-1 · CD-1 | — | MOD-002 | admin/users |
| **API-028** | `GET` | `/api/school/staff/:staffId` | CAP-037 | SC-1 · CD-1 | — | MOD-002 | admin/users/:userId |
| **API-029** | `PATCH` | `/api/school/staff/:staffId` | CAP-031 | SC-1 · CD-1, CD-9 | — | MOD-002 | PATCH admin/users/:id |
| **API-030** | `POST` | `/api/school/staff/invites` | CAP-030 | SC-1 · CD-1 | — | MOD-002 | POST /api/invites |
| **API-031** | `GET` | `/api/school/staff/invites` | CAP-037 | SC-1 · CD-1 | — | MOD-002 | — |
| **API-032** | `POST` | `/api/school/staff/:staffId/roles` | CAP-031 | SC-1 · CD-1, CD-9 | idem | MOD-002 | admin/users/:id/roles/{teacher,parent} |
| **API-033** | `DELETE` | `/api/school/staff/:staffId/roles/:roleId` | CAP-031 | SC-1 · CD-1, CD-9 | idem | MOD-002 | DELETE admin/users/:id/roles/:role |
| **API-034** | `POST` | `/api/school/staff/:staffId/finance-authority` | CAP-032 | SC-1 · CD-1, CD-9, CD-10 | idem | MOD-002 | — (PA-1: no separate finance account) |
| **API-035** | `DELETE` | `/api/school/staff/:staffId/finance-authority` | CAP-032 | SC-1 · CD-1, CD-9, CD-10 | idem | MOD-002 | — |
| **API-036** | `POST` | `/api/school/staff/:staffId/suspend` | CAP-033 | SC-1 · CD-1, CD-9 | idem | MOD-002 | admin/users/:id/suspend |
| **API-037** | `POST` | `/api/school/staff/:staffId/reactivate` | CAP-034 | SC-1 · CD-1 | idem | MOD-002 | admin/users/:id/reactivate |
| **API-038** | `POST` | `/api/school/staff/:staffId/offboard` | CAP-035 | SC-1 · CD-1 | idem | MOD-002 | admin/users/:id/offboard-staff |
| **API-039** | `GET` | `/api/school/periods` | CAP-041 OR CAP-003 | SC-1 · CD-1 | — | MOD-003 | — |
| **API-040** | `POST` | `/api/school/periods` | CAP-004 | SC-1 · CD-1 | — | MOD-003 | — |
| **API-041** | `PATCH` | `/api/school/periods/:periodId` | CAP-004 | SC-1 · CD-1 | If-Match | MOD-003 | — |
| **API-042** | `GET` | `/api/school/classes` | CAP-014 OR CAP-021 | SC-1 · CD-1 | — | MOD-003 | GET /api/classes |
| **API-043** | `POST` | `/api/school/classes` | CAP-014 | SC-1 · CD-1 | — | MOD-003 | POST /api/classes |
| **API-044** | `GET` | `/api/school/classes/:classId` | CAP-014 OR CAP-021 | SC-1 · CD-1 | — | MOD-003 | — |
| **API-045** | `PATCH` | `/api/school/classes/:classId` | CAP-014 | SC-1 · CD-1 | — | MOD-003 | PATCH /api/classes/:id |
| **API-046** | `DELETE` | `/api/school/classes/:classId` | CAP-014 | SC-1 · CD-1 | — | MOD-003 | DELETE /api/classes/:id |
| **API-047** | `GET` | `/api/school/classes/:classId/staffing` | CAP-016 OR CAP-037 | SC-1 · CD-1 | — | MOD-003 | classes/:id/teacher-assignments |
| **API-048** | `POST` | `/api/school/classes/:classId/staffing` | CAP-016 | SC-1 · CD-1 | — | MOD-003 | POST classes/:id/teacher-assignments |
| **API-049** | `PATCH` | `/api/school/staffing/:staffingId` | CAP-016 | SC-1 · CD-1 | — | MOD-003 | PATCH class-teacher-assignments/:id |
| **API-050** | `POST` | `/api/school/staffing/:staffingId/revoke` | CAP-017 | SC-1 · CD-1 | idem | MOD-003 | DELETE class-teacher-assignments/:id |
| **API-051** | `GET` | `/api/school/subjects` | CAP-015 OR CAP-021 | SC-1 · CD-1 | — | MOD-003 | GET /api/subjects |
| **API-052** | `POST` | `/api/school/subjects` | CAP-015 | SC-1 · CD-1 | — | MOD-003 | POST /api/subjects |
| **API-053** | `PATCH` | `/api/school/subjects/:subjectId` | CAP-015 | SC-1 · CD-1 | — | MOD-003 | — |
| **API-054** | `DELETE` | `/api/school/subjects/:subjectId` | CAP-015 | SC-1 · CD-1 | — | MOD-003 | DELETE /api/subjects/:id |
| **API-055** | `GET` | `/api/school/children` | CAP-021 | SC-1 · CD-1 | — | MOD-004 | GET /api/students |
| **API-056** | `POST` | `/api/school/children` | CAP-018 | SC-1 · CD-1 | — | MOD-004 | POST /api/students |
| **API-057** | `GET` | `/api/school/children/:childId` | CAP-021 | SC-1 · CD-1 | — | MOD-004 | GET students/:id/profile |
| **API-058** | `PATCH` | `/api/school/children/:childId` | CAP-018 | SC-1 · CD-1 | — | MOD-004 | PATCH /api/students/:id |
| **API-059** | `GET` | `/api/school/children/:childId/overview` | CAP-021 | SC-1 · CD-1 | — | MOD-010 | students/:id/profile (partial) |
| **API-060** | `POST` | `/api/school/children/:childId/archive` | CAP-020 | SC-1 · CD-1 | idem | MOD-004 | DELETE /api/students/:id |
| **API-061** | `POST` | `/api/school/children/:childId/unarchive` | CAP-020 | SC-1 · CD-1 | idem | MOD-004 | students/:id/unarchive |
| **API-062** | `GET` | `/api/school/children/:childId/memberships` | CAP-021 | SC-1 · CD-1 | — | MOD-003 | — (students.classId today) |
| **API-063** | `POST` | `/api/school/children/:childId/memberships` | CAP-019 | SC-1 · CD-1, CD-8 | — | MOD-003 | — |
| **API-064** | `POST` | `/api/school/memberships/:membershipId/end` | CAP-019 | SC-1 · CD-1, CD-8 | idem | MOD-003 | — |
| **API-065** | `POST` | `/api/school/children/:childId/link-codes` | CAP-024 | SC-1 · CD-1 | — | MOD-004 | students/:id/linking-code |
| **API-066** | `POST` | `/api/school/children/:childId/link-codes/rotate` | CAP-025 | SC-1 · CD-1 | — | MOD-004 | students/:id/linking-code/rotate |
| **API-067** | `GET` | `/api/school/link-codes` | CAP-024 | SC-1 · CD-1 | — | MOD-004 | GET /api/linking-codes |
| **API-068** | `GET` | `/api/school/families` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | GET /api/families |
| **API-069** | `POST` | `/api/school/families` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | POST /api/families |
| **API-070** | `GET` | `/api/school/families/:familyId` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | GET /api/families/:id |
| **API-071** | `PATCH` | `/api/school/families/:familyId` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | PATCH /api/families/:id |
| **API-072** | `DELETE` | `/api/school/families/:familyId` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | DELETE /api/families/:id |
| **API-073** | `GET` | `/api/school/families/:familyId/guardians` | CAP-023 | SC-1 · CD-1 | — | MOD-004 | — |
| **API-074** | `POST` | `/api/school/families/:familyId/guardians` | CAP-023 | SC-1 · CD-1 | — | MOD-004 | families/:id/guardians |
| **API-075** | `PATCH` | `/api/school/families/:familyId/guardians/:guardianId` | CAP-023 | SC-1 · CD-1 | — | MOD-004 | PATCH /api/guardians/:id |
| **API-076** | `DELETE` | `/api/school/families/:familyId/guardians/:guardianId` | CAP-023 | SC-1 · CD-1 | — | MOD-004 | DELETE /api/guardians/:id |
| **API-077** | `POST` | `/api/school/families/:familyId/guardians/:guardianId/invite` | CAP-029 | SC-1 · CD-1 | idem | MOD-004 | guardians/:id/invite |
| **API-078** | `POST` | `/api/school/families/invitations/send-pending` | CAP-029 | SC-1 · CD-1 | Idempotency-Key | MOD-004 | families/invitations/send-pending |
| **API-079** | `POST` | `/api/school/families/:familyId/enrol` | CAP-018 AND CAP-022 | SC-1 · CD-1 | Idempotency-Key | application/enrol-family | families/:id/enroll · families/enroll |
| **API-080** | `GET` | `/api/school/families/drafts/:draftId` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | families/save-draft |
| **API-081** | `PUT` | `/api/school/families/drafts/:draftId` | CAP-022 | SC-1 · CD-1 | — | MOD-004 | families/:id/save-draft |
| **API-082** | `GET` | `/api/school/books` | CAP-006 | SC-1 · CD-1 | — | MOD-005 | GET /api/books |
| **API-083** | `POST` | `/api/school/books` | CAP-006 | SC-1 · CD-1 | — | MOD-005 | POST /api/books |
| **API-084** | `GET` | `/api/school/books/:bookId` | CAP-006 | SC-1 · CD-1 | — | MOD-005 | — |
| **API-085** | `PATCH` | `/api/school/books/:bookId` | CAP-006 | SC-1 · CD-1 | — | MOD-005 | PATCH /api/books/:id |
| **API-086** | `DELETE` | `/api/school/books/:bookId` | CAP-006 | SC-1 · CD-1 | — | MOD-005 | DELETE /api/books/:id |
| **API-087** | `GET` | `/api/school/books/lookup` | CAP-006 | SC-1 · CD-1 | — | MOD-005 | **C-76** — replaces the missing /api/isbn-lookup/:isbn; supersedes books/by-isbn/:isbn |
| **API-088** | `GET` | `/api/school/books/scan/:code` | CAP-006 OR CAP-010 | SC-1 · CD-1 | — | MOD-005 | books/scan/:code · book-copies/lookup/:code |
| **API-089** | `GET` | `/api/school/books/:bookId/copies` | CAP-010 | SC-1 · CD-1 | — | MOD-005 | books/:id/copies |
| **API-090** | `POST` | `/api/school/books/:bookId/copies` | CAP-010 | SC-1 · CD-1 | — | MOD-005 | POST books/:id/copies |
| **API-091** | `PATCH` | `/api/school/copies/:copyId` | CAP-010 | SC-1 · CD-1 | — | MOD-005 | PATCH book-copies/:id |
| **API-092** | `POST` | `/api/school/copies/verify` | CAP-010 | SC-1 · CD-1 | — | MOD-005 | book-copies/verify |
| **API-093** | `GET` | `/api/school/stock` | CAP-013 | SC-1 · CD-1 | — | MOD-005 | books/low-stock (partial) |
| **API-094** | `GET` | `/api/school/stock/movements` | CAP-013 | SC-1 · CD-1 | — | MOD-005 | inventory-transactions |
| **API-095** | `POST` | `/api/school/stock/intake` | CAP-011 | SC-1 · CD-1 | Idempotency-Key | MOD-005 | books/:id/stock |
| **API-096** | `POST` | `/api/school/stock/corrections` | CAP-012 | SC-1 · CD-1 | Idempotency-Key | MOD-005 | — |
| **API-097** | `GET` | `/api/school/bundles` | CAP-007 | SC-1 · CD-1 | — | MOD-006 | GET /api/book-levels |
| **API-098** | `POST` | `/api/school/bundles` | CAP-007 | SC-1 · CD-1 | — | MOD-006 | POST /api/book-levels |
| **API-099** | `GET` | `/api/school/bundles/:bundleId` | CAP-007 | SC-1 · CD-1 | — | MOD-006 | book-levels/:id/items |
| **API-100** | `PATCH` | `/api/school/bundles/:bundleId` | CAP-007 | SC-1 · CD-1 | If-Match | MOD-006 | PATCH book-levels/:id |
| **API-101** | `DELETE` | `/api/school/bundles/:bundleId` | CAP-007 | SC-1 · CD-1 | — | MOD-006 | DELETE book-levels/:id |
| **API-102** | `PUT` | `/api/school/bundles/:bundleId/items` | CAP-007 | SC-1 · CD-1 | If-Match | MOD-006 | book-levels/:id/items · book-level-items/:id |
| **API-103** | `GET` | `/api/school/classes/:classId/bundles` | CAP-008 | SC-1 · CD-1 | — | MOD-006 | class-book-levels |
| **API-104** | `PUT` | `/api/school/classes/:classId/bundles` | CAP-008 | SC-1 · CD-1, CD-8 | If-Match | MOD-006 | class-book-levels · DELETE class-book-levels/:id |
| **API-105** | `GET` | `/api/school/requirements` | CAP-041 | SC-1 · CD-1 | — | MOD-006 | — |
| **API-106** | `GET` | `/api/school/children/:childId/requirements` | CAP-041 | SC-1 · CD-1 | — | MOD-006 | students/book-level-overrides |
| **API-107** | `POST` | `/api/school/children/:childId/requirements` | CAP-042 | SC-1 · CD-1, CD-8 | — | MOD-006 | — |
| **API-108** | `POST` | `/api/school/requirements/:itemId/correct` | CAP-043 | SC-1 · CD-1 | Idempotency-Key | MOD-006 | — |
| **API-109** | `PUT` | `/api/school/children/:childId/requirement-override` | CAP-009 | SC-1 · CD-1 | — | MOD-006 | PUT students/:id/book-level-override |
| **API-110** | `DELETE` | `/api/school/children/:childId/requirement-override` | CAP-009 | SC-1 · CD-1 | — | MOD-006 | DELETE students/:id/book-level-override |
| **API-111** | `GET` | `/api/school/cycles` | CAP-041 | SC-1 · CD-1 | — | MOD-006 | — |
| **API-112** | `GET` | `/api/school/cycles/:cycleId` | CAP-041 | SC-1 · CD-1 | — | MOD-006 | — |
| **API-113** | `POST` | `/api/school/cycles/:cycleId/close` | CAP-044 | SC-1 · CD-1 | idem | MOD-006 | — |
| **API-114** | `POST` | `/api/school/rollover/preview` | CAP-005 | SC-1 · CD-1 | read-only | MOD-006 | — |
| **API-115** | `POST` | `/api/school/rollover` | CAP-005 | SC-1 · CD-1 | Idempotency-Key | application/run-rollover | — |
| **API-116** | `POST` | `/api/school/rollover/:runId/correction` | CAP-005 | SC-1 · CD-1 | Idempotency-Key | MOD-006 | — |
| **API-117** | `GET` | `/api/school/money/overview` | CAP-045 | SC-1 · CD-1, CD-4 | — | MOD-010 | finance/summary |
| **API-118** | `GET` | `/api/school/settlements` | CAP-045 | SC-1 · CD-1, CD-4 | — | MOD-007 | admin/payments |
| **API-119** | `GET` | `/api/school/settlements/:settlementId` | CAP-045 | SC-1 · CD-1, CD-4 | — | MOD-007 | admin/payments/:id/verification |
| **API-120** | `POST` | `/api/school/settlements/:settlementId/confirm` | CAP-049 | SC-1 · CD-1, CD-4 | **Idempotency-Key** | **application/confirm-settlement** — I-2 | admin/payments/:id/confirm · /verify · /manual-verify |
| **API-121** | `POST` | `/api/school/settlements/:settlementId/reject` | CAP-050 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | admin/payments/:id/reject · /manual-reject |
| **API-122** | `POST` | `/api/school/money-events` | CAP-047 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | — |
| **API-123** | `GET` | `/api/school/money-events` | CAP-045 | SC-1 · CD-1, CD-4 | — | MOD-007 | — |
| **API-124** | `POST` | `/api/school/money-events/:eventId/apply` | CAP-048 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | — (OD-1: amount lives on the link) |
| **API-125** | `POST` | `/api/school/requirements/:itemId/discount` | CAP-051 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | — |
| **API-126** | `POST` | `/api/school/requirements/:itemId/waiver` | CAP-052 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | — |
| **API-127** | `POST` | `/api/school/settlements/:settlementId/correct` | CAP-053 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | — |
| **API-128** | `POST` | `/api/school/settlements/:settlementId/refund` | CAP-054 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | admin/payments/:id/cancel |
| **API-129** | `GET` | `/api/school/reports/financial` | CAP-077 | SC-1 · CD-1, CD-4 | — | MOD-010 | admin/reports (partial) |
| **API-130** | `POST` | `/api/school/reconciliation/imports` | CAP-055 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | finance/stripe/import |
| **API-131** | `GET` | `/api/school/reconciliation/imports` | CAP-055 | SC-1 · CD-1, CD-4 | — | MOD-007 | finance/stripe/status |
| **API-132** | `GET` | `/api/school/reconciliation/imports/:importId` | CAP-055 | SC-1 · CD-1, CD-4 | — | MOD-007 | — |
| **API-133** | `GET` | `/api/school/reconciliation/candidates` | CAP-056 | SC-1 · CD-1, CD-4 | — | MOD-007 | finance/verification/run |
| **API-134** | `POST` | `/api/school/reconciliation/:settlementId/match` | CAP-056 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | admin/payments/:id/needs-review |
| **API-135** | `GET` | `/api/school/reconciliation/exceptions` | CAP-056 | SC-1 · CD-1, CD-4 | — | MOD-007 | admin/reconciliation |
| **API-136** | `POST` | `/api/school/reconciliation/exceptions/:exceptionId/resolve` | CAP-056 | SC-1 · CD-1, CD-4 | Idempotency-Key | MOD-007 | — |
| **API-137** | `GET` | `/api/school/allocations` | CAP-060 | SC-1 · CD-1 | — | MOD-008 | GET /api/allocations |
| **API-138** | `GET` | `/api/school/allocations/:allocationId` | CAP-060 | SC-1 · CD-1 | — | MOD-008 | allocations/:id/custody |
| **API-139** | `POST` | `/api/school/allocations/:allocationId/prepare` | CAP-060 | SC-1 · CD-1 | Idempotency-Key | MOD-008 | POST /api/allocations |
| **API-140** | `POST` | `/api/school/allocations/:allocationId/transfer-to-teacher` | CAP-061 | SC-1 · CD-1 | Idempotency-Key | MOD-008 | allocations/:id/custody |
| **API-141** | `GET` | `/api/school/handovers/queue` | CAP-062 | SC-2 · CD-2 | — | MOD-010 | teacher/book-distribution |
| **API-142** | `GET` | `/api/school/handovers/queue/:allocationId` | CAP-062 | SC-2 · CD-2 | — | MOD-008 | — |
| **API-143** | `POST` | `/api/school/handovers` | CAP-063 | **SC-3** · CD-2, **CD-5** | **Idempotency-Key** | MOD-008 | teacher/book-distribution/:id/confirm-received · allocations/:id/confirm |
| **API-144** | `POST` | `/api/school/collections` | CAP-064 | SC-1 · CD-1 | Idempotency-Key | MOD-008 | admin/book-distribution/:id/confirm · admin/payments/:id/collected |
| **API-145** | `POST` | `/api/school/allocations/:allocationId/exception` | CAP-065 | SC-3 · CD-2 | Idempotency-Key | MOD-008 | teacher/…/mark-absent · /mark-out-of-stock · allocations/:id/absent |
| **API-146** | `GET` | `/api/school/handovers` | CAP-060 | SC-1 · CD-1 | — | MOD-008 | — |
| **API-147** | `POST` | `/api/school/settlements/:settlementId/ready-for-collection` | CAP-060 | SC-1 · CD-1 | idem | MOD-008 | admin/payments/:id/ready-for-collection |
| **API-148** | `POST` | `/api/school/replacements` | CAP-067 | SC-3 · CD-2 | Idempotency-Key | MOD-008 | teacher/…/report-issue · POST /api/extra-requests |
| **API-149** | `GET` | `/api/school/replacements` | CAP-069 | SC-1 · CD-1 | — | MOD-008 | GET /api/extra-requests |
| **API-150** | `GET` | `/api/school/replacements/:replacementId` | CAP-069 | SC-1 · CD-1 | — | MOD-008 | — |
| **API-151** | `POST` | `/api/school/replacements/:replacementId/pre-handover-issue` | CAP-068 | SC-1 · CD-1, **CD-11 (PRE)** | Idempotency-Key | MOD-008 | — |
| **API-152** | `POST` | `/api/school/replacements/:replacementId/review` | CAP-069 | SC-1 · CD-1 | If-Match | MOD-008 | extra-requests/:id/approve · /reject |
| **API-153** | `POST` | `/api/school/replacements/:replacementId/charge-decision` | CAP-070 | SC-1 · CD-1, CD-4, **CD-11 (POST)** | If-Match + Idempotency-Key | MOD-007 | — |
| **API-154** | `POST` | `/api/school/returns` | CAP-071 | SC-1 · CD-1 | Idempotency-Key | MOD-008 | — |
| **API-155** | `GET` | `/api/school/messages` | CAP-072 | SC-1 · CD-1 | — | MOD-009 | admin/communications · teacher/message-threads |
| **API-156** | `POST` | `/api/school/messages` | CAP-072 | SC-1 · CD-1 | — | MOD-009 | — |
| **API-157** | `GET` | `/api/school/messages/:threadId` | CAP-072 | SC-1 · CD-1 | — | MOD-009 | admin/communications/:threadId |
| **API-158** | `POST` | `/api/school/messages/:threadId/messages` | CAP-072 | SC-1 · CD-1 | — | MOD-009 | teacher/message-threads/:id/messages |
| **API-159** | `PATCH` | `/api/school/messages/:threadId/status` | CAP-072 | SC-1 · CD-1 | — | MOD-009 | admin/communications/:threadId/status |
| **API-160** | `GET` | `/api/school/notifications` | CAP-074 | SC-5 | — | MOD-009 | notifications/summary |
| **API-161** | `POST` | `/api/school/notifications/:notificationId/read` | CAP-074 | SC-5 | idem | MOD-009 | — |
| **API-162** | `GET` | `/api/school/notification-preferences` | CAP-075 | SC-5 | — | MOD-009 | notifications/preferences |
| **API-163** | `PATCH` | `/api/school/notification-preferences` | CAP-075 | SC-5 | — | MOD-009 | PATCH notifications/preferences |
| **API-164** | `GET` | `/api/school/imports/enrolment/template` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | MOD-004 | families/enroll/import/template |
| **API-165** | `GET` | `/api/school/imports/enrolment/fields` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | MOD-004 | families/enroll/import/fields |
| **API-166** | `POST` | `/api/school/imports/enrolment` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | application/import-enrolments | families/enroll/import/analyze · students/import/preview |
| **API-167** | `GET` | `/api/school/imports/enrolment/:importId` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | application/import-enrolments | — |
| **API-168** | `PUT` | `/api/school/imports/enrolment/:importId/mapping` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | application/import-enrolments | — |
| **API-169** | `GET` | `/api/school/imports/enrolment/:importId/preview` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | application/import-enrolments | — |
| **API-170** | `POST` | `/api/school/imports/enrolment/:importId/commit` | **CAP-028** (families) / CAP-027 (children only) | SC-1 · CD-1 | **Idempotency-Key** | application/import-enrolments | families/enroll/import/commit · students/import/confirm |
| **API-171** | `GET` | `/api/school/imports/enrolment/:importId/result` | CAP-027 OR CAP-028 | SC-1 · CD-1 | — | application/import-enrolments | — |
| **API-172** | `GET` | `/api/school/overview` | CAP-076 | SC-1 · CD-1 | — | MOD-010 | admin/dashboard-summary · admin/recent-activity |
| **API-173** | `GET` | `/api/school/reports` | CAP-076 | SC-1 · CD-1 | — | MOD-010 | admin/reports |
| **API-174** | `GET` | `/api/school/reports/:reportId` | CAP-076 | SC-1 · CD-1 | — | MOD-010 | admin/book-management-summary |
| **API-175** | `GET` | `/api/school/jobs/:jobId` | CAP-076 | SC-1 · CD-1 | — | MOD-014 | — |
| **API-176** | `GET` | `/api/school/exports/:exportId` | CAP-076 OR CAP-077 | SC-1 · CD-1 | — | MOD-010 | — |

### FAMILY

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-177** | `GET` | `/api/family/children` | CAP-057 | **SC-4** · CD-3 | — | MOD-004 | parent/children |
| **API-178** | `GET` | `/api/family/children/:childId` | CAP-057 | SC-4 · CD-3 | — | MOD-004 | — |
| **API-179** | `GET` | `/api/family/children/:childId/overview` | CAP-057 | SC-4 · CD-3 | — | MOD-010 | — |
| **API-180** | `GET` | `/api/family/children/:childId/books` | CAP-057 | SC-4 · CD-3 | — | MOD-006 | parent/children/:id/books |
| **API-181** | `GET` | `/api/family/children/:childId/requirements` | CAP-057 | SC-4 · CD-3 | — | MOD-006 | — |
| **API-182** | `PUT` | `/api/family/children/:childId/selection` | CAP-046 | SC-4 · CD-3 | — | MOD-006 | parent/children/:id/basket |
| **API-183** | `GET` | `/api/family/settlements` | CAP-057 | SC-4 · CD-3 | — | MOD-007 | parent/baskets · parent/payments |
| **API-184** | `POST` | `/api/family/settlements` | CAP-046 | SC-4 · CD-3 | Idempotency-Key | MOD-007 | POST parent/payments |
| **API-185** | `GET` | `/api/family/settlements/:settlementId` | CAP-057 | SC-4 · CD-3 | — | MOD-007 | — |
| **API-186** | `POST` | `/api/family/settlements/:settlementId/reference` | CAP-046 | SC-4 · CD-3 | Idempotency-Key | MOD-007 | parent/payments/:id/submit-reference |
| **API-187** | `PUT` | `/api/family/settlements/:settlementId/fulfilment-route` | CAP-058 OR CAP-059 | SC-4 · CD-3 | — | MOD-008 | — |
| **API-188** | `GET` | `/api/family/messages` | CAP-073 | SC-4 · CD-3 | — | MOD-009 | parent/message-threads |
| **API-189** | `POST` | `/api/family/messages` | CAP-073 | SC-4 · CD-3 | — | MOD-009 | POST parent/message-threads |
| **API-190** | `GET` | `/api/family/messages/:threadId` | CAP-073 | SC-4 · CD-3 | — | MOD-009 | parent/message-threads/:id |
| **API-191** | `POST` | `/api/family/messages/:threadId/messages` | CAP-073 | SC-4 · CD-3 | — | MOD-009 | parent/message-threads/:id/messages |
| **API-192** | `GET` | `/api/family/message-contacts` | CAP-073 | SC-4 · CD-3 | — | MOD-009 | parent/message-contacts |
| **API-193** | `GET` | `/api/family/notifications` | CAP-074 | SC-5 | — | MOD-009 | parent/message-unread |
| **API-194** | `POST` | `/api/family/notifications/:notificationId/read` | CAP-074 | SC-5 | idem | MOD-009 | — |
| **API-195** | `GET` | `/api/family/notification-preferences` | CAP-075 | SC-5 | — | MOD-009 | — |
| **API-196** | `PATCH` | `/api/family/notification-preferences` | CAP-075 | SC-5 | — | MOD-009 | — |
| **API-197** | `POST` | `/api/family/link-code/preview` | CAP-026 | SC-5 | — | MOD-004 | parent/link-code/preview |
| **API-198** | `POST` | `/api/family/link-code/confirm` | CAP-026 | SC-5 | Idempotency-Key | MOD-004 | parent/link-code/confirm · parent/link-child |

### CMS STUDIO

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-199** | `GET` | `/api/studio/site` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | it/website-summary |
| **API-200** | `PATCH` | `/api/studio/site` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | — |
| **API-201** | `GET` | `/api/studio/pages` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | website/sections |
| **API-202** | `POST` | `/api/studio/pages` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | POST website/sections |
| **API-203** | `GET` | `/api/studio/pages/:pageId` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-204** | `PATCH` | `/api/studio/pages/:pageId` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | PATCH website/sections/:id |
| **API-205** | `DELETE` | `/api/studio/pages/:pageId` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | DELETE website/sections/:id |
| **API-206** | `PUT` | `/api/studio/pages/:pageId/sections` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | — |
| **API-207** | `POST` | `/api/studio/pages/:pageId/move` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | website/sections/:id/move |
| **API-208** | `GET` | `/api/studio/news` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-209** | `POST` | `/api/studio/news` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-210** | `GET` | `/api/studio/news/:newsId` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-211** | `PATCH` | `/api/studio/news/:newsId` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | — |
| **API-212** | `DELETE` | `/api/studio/news/:newsId` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-213** | `GET` | `/api/studio/events` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-214** | `POST` | `/api/studio/events` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-215** | `GET` | `/api/studio/events/:eventId` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-216** | `PATCH` | `/api/studio/events/:eventId` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | — |
| **API-217** | `DELETE` | `/api/studio/events/:eventId` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-218** | `GET` | `/api/studio/media` | CAP-080 | SC-1 · CD-1 | — | MOD-011 | GET /api/media |
| **API-219** | `GET` | `/api/studio/media/:mediaId` | CAP-080 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-220** | `PATCH` | `/api/studio/media/:mediaId` | CAP-080 | SC-1 · CD-1 | — | MOD-011 | PATCH /api/media/:id |
| **API-221** | `DELETE` | `/api/studio/media/:mediaId` | CAP-080 | SC-1 · CD-1 | — | MOD-011 | DELETE /api/media/:id |
| **API-222** | `POST` | `/api/studio/media/uploads` | CAP-080 | SC-1 · CD-1 | — | gateways/storage | POST /api/media (fused) |
| **API-223** | `POST` | `/api/studio/media/uploads/:uploadId/finalise` | CAP-080 | SC-1 · CD-1 | **Idempotency-Key** | MOD-011 | — (new: acceptance) |
| **API-224** | `GET` | `/api/studio/presentation` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | admin/branding (CMS half) |
| **API-225** | `PATCH` | `/api/studio/presentation` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | — |
| **API-226** | `GET` | `/api/studio/contact` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — |
| **API-227** | `PATCH` | `/api/studio/contact` | CAP-078 | SC-1 · CD-1 | If-Match | MOD-011 | — |
| **API-228** | `GET` | `/api/studio/preview` | CAP-078 | SC-1 · CD-1 | — | MOD-011 | — **authenticated, draft-sourced** |
| **API-229** | `POST` | `/api/studio/publish` | **CAP-079** | SC-1 · CD-1 | **Idempotency-Key** + If-Match | application/publish-website | — |
| **API-230** | `POST` | `/api/studio/unpublish` | CAP-079 | SC-1 · CD-1 | Idempotency-Key | application/publish-website | — |

### PUBLIC SITE

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-231** | `GET` | `/api/site/:schoolCode` | **CAP-081** (unauthenticated) | **SC-8** | — | MOD-011 + MOD-001 | public/schools/:code · /branding · /website · /email-logo |
| **API-232** | `GET` | `/api/site/resolve` | CAP-081 (unauthenticated) | SC-8 | — | MOD-001 | — |
| **API-233** | `POST` | `/api/site/contact` | PUBLIC | SC-8 | rate-limited | MOD-009 | public/contact |

### PLATFORM

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-234** | `GET` | `/api/platform/overview` | CAP-085 | **SC-7** | — | MOD-012 | owner/dashboard |
| **API-235** | `GET` | `/api/platform/schools` | CAP-085 | SC-7 | — | MOD-012 | owner/schools |
| **API-236** | `GET` | `/api/platform/schools/:schoolId` | CAP-085 | SC-7 | — | MOD-012 | owner/schools/:schoolId |
| **API-237** | `POST` | `/api/platform/schools` | CAP-082 | SC-7 | Idempotency-Key | MOD-012 | POST owner/schools |
| **API-238** | `PATCH` | `/api/platform/schools/:schoolId` | CAP-084 | SC-7 | If-Match | MOD-012 | PATCH owner/schools/:id |
| **API-239** | `POST` | `/api/platform/schools/:schoolId/invite-admin` | CAP-083 | SC-7 | Idempotency-Key | MOD-012 | owner/schools/:id/invite-admin |
| **API-240** | `GET` | `/api/platform/schools/pending-setups` | CAP-085 | SC-7 | — | MOD-012 | owner/pending-setups |
| **API-241** | `GET` | `/api/platform/invites` | CAP-085 | SC-7 | — | MOD-012 | — |
| **API-242** | `POST` | `/api/platform/invites/:inviteId/resend` | CAP-083 | SC-7 | Idempotency-Key | MOD-012 | owner/invites/:id/resend |
| **API-243** | `POST` | `/api/platform/invites/:inviteId/revoke` | CAP-083 | SC-7 | idem | MOD-012 | owner/invites/:id/revoke |
| **API-244** | `POST` | `/api/platform/schools/:schoolId/suspend` | CAP-084 | SC-7 | Idempotency-Key | MOD-012 | owner/schools/:id/suspend |
| **API-245** | `POST` | `/api/platform/schools/:schoolId/archive` | CAP-084 | SC-7 | Idempotency-Key | MOD-012 | owner/schools/:id/archive |
| **API-246** | `POST` | `/api/platform/schools/:schoolId/restore` | CAP-084 | SC-7 | Idempotency-Key | MOD-012 | owner/schools/:id/restore |
| **API-247** | `POST` | `/api/platform/schools/:schoolId/request-deletion` | CAP-084 | SC-7 | Idempotency-Key | MOD-012 | owner/schools/:id/request-deletion |
| **API-248** | `POST` | `/api/platform/schools/:schoolId/cms-entitlement` | CAP-084 | SC-7 | idem | MOD-001 | — (MA-2: MOD-001 owns the fact) |
| **API-249** | `DELETE` | `/api/platform/schools/:schoolId/cms-entitlement` | CAP-084 | SC-7 | idem | MOD-001 | — |
| **API-250** | `GET` | `/api/platform/activity` | CAP-085 | SC-7 | — | MOD-012 | owner/activity |
| **API-251** | `GET` | `/api/platform/deliveries` | CAP-085 | SC-7 | — | MOD-009 | owner/email-status |
| **API-252** | `GET` | `/api/platform/jobs` | CAP-085 | SC-7 | — | MOD-014 | — |
| **API-253** | `GET` | `/api/platform/jobs/:jobId` | CAP-085 | SC-7 | — | MOD-014 | — |
| **API-254** | `POST` | `/api/platform/jobs/:jobId/retry` | CAP-084 | SC-7 | **Idempotency-Key** | MOD-014 | — |
| **API-255** | `GET` | `/api/platform/system-health` | CAP-085 | SC-7 | — | MOD-012 | owner/system-health |

### SUPPORT MODE

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-256** | `POST` | `/api/platform/support/engagements` | **CAP-086** | SC-7 → opens **SC-6** | Idempotency-Key | MOD-012 | owner/support-mode/enter · owner/enter-support/:id (dup) |
| **API-257** | `GET` | `/api/platform/support/engagements/active` | CAP-085 | SC-7 | — | MOD-012 | owner/support-status |
| **API-258** | `GET` | `/api/platform/support/engagements/:engagementId` | CAP-085 | SC-6 · CD-6 | — | MOD-012 | — |
| **API-259** | `POST` | `/api/platform/support/engagements/:engagementId/exit` | **CAP-087** | SC-6 | idem | MOD-012 | owner/support-mode/exit · owner/exit-support (dup) |
| **API-260** | `GET` | `/api/platform/support/:engagementId/overview` | CAP-088 | **SC-6** · CD-6 | — | MOD-010 | — |
| **API-261** | `GET` | `/api/platform/support/:engagementId/settings` | CAP-088 | SC-6 · CD-6 | — | MOD-001 | — |
| **API-262** | `GET` | `/api/platform/support/:engagementId/setup` | CAP-088 | SC-6 · CD-6 | — | MOD-001 | — |
| **API-263** | `POST` | `/api/platform/support/:engagementId/setup/correct` | CAP-088 | SC-6 · CD-6 | Idempotency-Key | MOD-001 | — |
| **API-264** | `GET` | `/api/platform/support/:engagementId/classes` | CAP-088 | SC-6 · CD-6 | — | MOD-003 | — |
| **API-265** | `GET` | `/api/platform/support/:engagementId/imports/:importId` | CAP-088 | SC-6 · CD-6 | — | application/import-enrolments | — |
| **API-266** | `GET` | `/api/platform/support/:engagementId/deliveries` | CAP-088 | SC-6 · CD-6 | — | MOD-009 | owner/support/schools/:id/communications |
| **API-267** | `GET` | `/api/platform/support/:engagementId/messages/:threadId` | CAP-088 | SC-6 · CD-6 | — | MOD-009 | owner/support/communications/:threadId |
| **API-268** | `POST` | `/api/platform/support/:engagementId/account-recovery` | CAP-088 | SC-6 · CD-6 | Idempotency-Key | MOD-002 | — **PA-2** |
| **API-269** | `GET` | `/api/platform/support/:engagementId/identity` | CAP-088 | SC-6 · CD-6 | — | MOD-001 | owner/schools/:id/branding |
| **API-270** | `PATCH` | `/api/platform/support/:engagementId/identity` | CAP-088 | SC-6 · CD-6 | If-Match | MOD-001 | PATCH owner/schools/:id/branding · /logo · /reset |

### BOUNDED INVESTIGATION

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-271** | `GET` | `/api/platform/investigation/subjects` | **CAP-089** | SC-6 · CD-6 | — | MOD-012 | owner/db/tables · owner/console/operations |
| **API-272** | `GET` | `/api/platform/investigation/subjects/:subject` | **CAP-089** | SC-6 · CD-6 | read-only | MOD-012 | owner/db/tables/:table · **replaces owner/db/query** |

### BREAK-GLASS

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-273** | `POST` | `/api/platform/break-glass/elevate` | **CAP-090** | SC-6 · CD-6, **CD-7** | Idempotency-Key | MOD-012 | owner/console/elevate |
| **API-274** | `POST` | `/api/platform/break-glass/end` | CAP-090 | SC-6 · CD-6, CD-7 | idem | MOD-012 | owner/console/elevate/end |
| **API-275** | `POST` | `/api/platform/break-glass/operations/:operationId` | **CAP-091** | SC-6 · CD-6, CD-7 | **Idempotency-Key** | MOD-012 | owner/console/op/:name · owner/console/write |
| **API-276** | `POST` | `/api/platform/break-glass/schools/:schoolId/erase-account` | **CAP-036** | SC-6 · CD-6, CD-7 | Idempotency-Key | MOD-002 | — §17 PERMISSIONS |
| **API-277** | `POST` | `/api/platform/break-glass/schools/:schoolId/purge` | **CAP-092** | **SC-7** · CD-7, **CD-12** | **Idempotency-Key** | MOD-012 | owner/db/danger/purge-school/:id · /wipe-school/:id |

### INTERNAL SCHEDULER

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-278** | `POST` | `/api/internal/jobs/run` | **CAP-093** (Scheduler) | **SC-10** | Idempotency-Key | platform/jobs runner | GET|POST /api/cron/run |

### INTEGRATION CALLBACK

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-279** | `POST` | `/api/integrations/v1/:integrationId/events` | **CAP-094** (Integration) | **SC-11** | **provider event id** | gateways/payments → MOD-007 | webhooks/payment-update |

### HEALTH

| ID | Method | Path | Capability | Scope · Conditions | Idempotency / precondition | Owning operation | Legacy replaced |
|---|---|---|---|---|---|---|---|
| **API-280** | `GET` | `/api/health/live` | PUBLIC | — | — | platform/health | GET /api/health |
| **API-281** | `GET` | `/api/health/ready` | PUBLIC | — | — | platform/health | GET /api/health |
| **API-282** | `GET` | `/api/health/dependencies` | CAP-085 | SC-7 | — | platform/health | owner/system-health (partial) |
---

## 18. Family API

Relationship-derived, **SC-4 · CD-3**. **No school selector exists in this surface at any level.**
Endpoints **API-177…API-198** (§17).

**The rejected shape:** `schoolId` supplied by a parent as the reason they may see a child. **The
guardian relationship is authoritative, always.** A `childId` that resolves to no active relationship
for this caller is `404` (API-P15), which is why a parent cannot enumerate children by guessing ids.

**Naming — UXQ-2 preserved.** No basket, cart or order vocabulary. API-182 is a *selection*
(**CAP-046**); API-184 creates a *settlement*.

---

## 19. Teacher API

Teacher work lives in `/api/school/*` (APID-003). Its distinctness is **scope**, not namespace:
`active staffing ∩ active child class membership`, which is exactly **SC-2** (teacher custody reach)
and **SC-3** (hand-over reach) in `PERMISSIONS.md`.

| ID | Endpoint | Capability | Scope |
|---|---|---|---|
| API-141 | `GET /api/school/handovers/queue` | **CAP-062** `hold_teacher_custody` | SC-2 · CD-2 |
| API-142 | `GET /api/school/handovers/queue/:allocationId` | CAP-062 | SC-2 · CD-2 |
| API-143 | `POST /api/school/handovers` | **CAP-063** `record_hand_over` | **SC-3** · CD-2, **CD-5** |
| API-145 | `POST /api/school/allocations/:allocationId/exception` | **CAP-065** | SC-3 · CD-2 |
| API-148 | `POST /api/school/replacements` | **CAP-067** `request_replacement` | SC-3 · CD-2 |

**CD-5 is the own-child block**, and it is a *condition on the capability*, not a client check. **No
school-wide generic child endpoint serves teacher workflow** — a teacher reads children through the
hand-over queue and their own classes, so scope is enforced by which endpoint exists rather than by a
filter they could omit. `PERMISSIONS.md` records the administrator fallback (**CAP-064**, API-144) so
the block never leaves a child without their books.

---

## 20. Finance API

**There is no finance API surface, and that is the decision.** PA-1 locks `school_admin +
AUTH-FINANCE` as one context. Money endpoints live in `/api/school/*` gated by **finance
capabilities** — CAP-045, CAP-047, CAP-048, CAP-049, CAP-050, CAP-051, CAP-052, CAP-053, CAP-054,
CAP-055, CAP-056, CAP-070, CAP-077 — every one of which carries **CD-4** in `PERMISSIONS.md`.

**No separate finance authentication API exists.** A school admin holding AUTH-FINANCE calls these
endpoints in the same session, the same cookie, the same context. That is C-50 resolved at the API
layer. **CAP-032** (API-034 / API-035) is the act that grants finance authority to an existing
administrator — it is a grant, not a second account.

---

## 21. I-2 — the settlement confirmation API

**APID-023 · One authoritative command. The client can never orchestrate the three steps.**

| ID | Method · Path | Capability | Scope | Idempotency | Owner |
|---|---|---|---|---|---|
| **API-120** | `POST /api/school/settlements/:settlementId/confirm` | **CAP-049** `confirm_settlement` | SC-1 · CD-1, CD-4 | **`Idempotency-Key` required** | `application/confirm-settlement.ts` |

```
Request                                     Idempotency-Key: <required>
{ "reviewNote": "…"?, "expectedAmount": { "value": "127.50", "currency": "GBP" }? }

200  Settlement confirmed
{ settlement, allocations[], stockMovements[], notification }
     ── the authoritative result of ALL of it (API-P5), from ONE commit
```

| Outcome | Status | `code` |
|---|---|---|
| confirmed | `200` | — |
| retry, same `Idempotency-Key`, same body | `200` | — · the identical result, no second effect |
| same key, different body | `409` | `IDEMPOTENCY_KEY_CONFLICT` |
| already confirmed by someone else | `409` | `SETTLEMENT_ALREADY_CONFIRMED` |
| insufficient stock | `422` | `INSUFFICIENT_STOCK` · which items, how short |
| not in a payable state | `422` | `SETTLEMENT_NOT_PAYABLE` |
| amount does not match | `409` | `SETTLEMENT_AMOUNT_MISMATCH` |
| capability refused | `403` | `FORBIDDEN` |
| not visible under scope | `404` | `NOT_FOUND` |

**No `412`** — API-120 does not use `If-Match`, and one is not added for consistency (APID-014).

**Explicitly not in the contract, and never to be added:**

```
POST /api/school/settlements/:id/settle        ✗
POST /api/school/allocations                   ✗ as a client step after settling
POST /api/school/stock/decrement               ✗ as a client step after allocating
```

**There is one command.** The client cannot decompose it, observe an intermediate state, or leave the
system in one. Every non-2xx means **the transaction rolled back**. No queue, event bus, saga,
distributed transaction, async allocation, async stock movement or eventual consistency appears here.

**The required MOD-009 notification fact is written inside the same transaction** (Stage 13 APP-027 as
corrected); the provider call happens after commit through a job handler (APP-049). **A delivery
failure cannot erase the record of what was owed.**

---

## 22. Fulfilment and hand-over API

**APID-024 · One hand-over command; the browser never sets custody, allocation or stock state**

```
API-143  POST /api/school/handovers        CAP-063 · SC-3 · CD-2, CD-5 · Idempotency-Key
Request  { allocationId, verifiedChildId, context: "class" | "office", note?: string }
200      { allocation, custody, stockMovements }
```

**Server revalidates every one of these — the client asserts none:** teacher scope (SC-2 ∩ SC-3) ·
**own-child block (CD-5)** · current custody state · settlement state · allocation exists and is for
this child · recipient condition.

```
PATCH /api/school/allocations/:id { custodyStatus: "handed_over" }        ✗ REJECTED
PATCH /api/school/stock/:id       { quantity: 41 }                        ✗ REJECTED
```

Reception collection is **API-144** under **CAP-064** `record_reception_collection` (AUTH-SCHOOL,
SC-1) — the administration-office function locked at Stage 9 UXQ-3, not a separate front-office role.

---

## 23. Replacement API

**APID-025 · Four business acts, four capabilities, four endpoints — never one `approve`**

| ID | Endpoint | Act | Capability | Conditions |
|---|---|---|---|---|
| API-148 | `POST /api/school/replacements` | teacher raises a request | **CAP-067** | SC-3 · CD-2 |
| API-151 | `POST …/:replacementId/pre-handover-issue` | pre-hand-over replacement | **CAP-068** | **CD-11 (PRE)** |
| API-152 | `POST …/:replacementId/review` | admin operational decision | **CAP-069** | SC-1 · CD-1 · `If-Match` |
| API-153 | `POST …/:replacementId/charge-decision` | **finance** charge or absorb | **CAP-070** | CD-4, **CD-11 (POST)** · `If-Match` + `Idempotency-Key` |

```
POST /api/school/replacements/:id/approve      ✗ REJECTED
```

**Rejected because it hides four capabilities, four authorities and four audit meanings behind one
word.** CD-11's PRE/POST split is exactly why CAP-068 and CAP-070 are different endpoints: whether the
child has already received the book changes who decides and what it costs.

---

## 24. Rollover API

**APID-026 · Prepare, then execute. History is never rewritten.** All three under **CAP-005**
`run_rollover`.

| ID | Endpoint | Notes |
|---|---|---|
| API-114 | `POST /api/school/rollover/preview` | computes and returns the proposed effect — **changes nothing** |
| API-115 | `POST /api/school/rollover` | executes · `Idempotency-Key` · may return `202` (§39) |
| API-116 | `POST /api/school/rollover/:runId/correction` | a named correction, forward-only |

Rollover affects **future** cycle and period state. Past cycles, settlements, allocations, custody and
stock movements are **immutable** — a correction is a new forward fact. **No generic bulk status
mutation endpoint exists.**

---

## 25. CMS Studio API

Authenticated, tenant-pinned, website-only. **MOD-001 owns entitlement (MA-2); MOD-011 owns content.**
Endpoints **API-199…API-230**, gated by **CAP-078** `manage_site_content`, **CAP-079**
`publish_site_content` and **CAP-080** `manage_media` — all AUTH-CMS · SC-1 · CD-1.

**No Studio endpoint returns operational data.** Not a child, family, settlement, stock, custody,
staff record or support datum. If a Studio screen appears to need one, the screen is wrong — not the
boundary (Stage 12 §24).

**Entitlement:** without CMS entitlement (MOD-001, granted by API-248 / API-249 under CAP-084), every
`/api/studio/*` endpoint is `404` — the same answer as a school with no website — so entitlement
cannot be probed through the Studio surface.

---

## 26. Draft → preview → publish → public

**APID-027 · Four contracts, one direction, no shortcut**

```
DRAFT      PATCH /api/studio/pages/:pageId      CAP-078 · If-Match
                 ─── editing a draft changes NOTHING public ───

PREVIEW    GET   /api/studio/preview   API-228   CAP-078 · AUTHENTICATED
                 composes the SAME PublishedSite SHAPE from DRAFT content.
                 Never reachable unauthenticated.

PUBLISH    POST  /api/studio/publish   API-229   CAP-079 · Idempotency-Key + If-Match
                 MOD-011 promotes · MOD-001 confirms entitlement · MOD-013 records
                 attribution — one transaction

PUBLIC     GET   /api/site/:schoolCode API-231   CAP-081 · SC-8 · unauthenticated
```

**Preview returns a `PublishedSite` built from drafts — same *shape*, different *source*.** That is
what makes preview trustworthy. A double-click on publish publishes once.

---

## 27. The public `PublishedSite` contract

**APID-028 · One contract, a closed field set, no operational field expressible in it**

```
PublishedSite {
  school:       { name, code, logo, publicIdentity }              MOD-001
  presentation: { theme }                                         MOD-011  --site-* only
  navigation:   [{ label, path }]                                 MOD-011
  contact:      { address?, email?, phone?, hours? }              MOD-011  PUBLIC contact only
  pages:        [{ slug, title, sections: PublishedSection[] }]   MOD-011  PUBLISHED only
  news:         [{ slug, title, publishedAt, body, image? }]      MOD-011  PUBLISHED only
  events:       [{ slug, title, startsAt, endsAt?, body }]        MOD-011  PUBLISHED only
  media:        [{ id, url, alt, kind }]                          MOD-011  ACCEPTED + PUBLISHED only
}
```

**The type has no field, and no nested field, that could carry:** children · guardian relationships ·
families · private student information · payment · settlement · funding · stock · allocations ·
custody · hand-over · private staff records · support-mode data · platform operational data · audit
records · authentication or session data · **CMS drafts** · unpublished media · private operational
files.

```
retrieve operational record → remove some fields → expose publicly       ✗ REJECTED
```

**A leak would require adding a field to a public contract in a reviewed change**, not forgetting a
`delete`.

**APID-029 · Both an HTTP endpoint and an internal rendering contract — so Stage 21 stays free**

**API-231 `GET /api/site/:schoolCode`** — **CAP-081** `view_published_site`, **SC-8**, unauthenticated,
cacheable, `ETag`. **And** `PublishedSite` is a type in `shared/contracts/` that the renderer consumes
as a **value** (Stage 13 APP-030 as corrected): `apps/site` imports the **type**, never the
implementation, and never `server/**`.

**Prerender-at-publish and render-on-request-behind-a-cache both consume the identical contract**;
choosing between them changes no field here, and remains **Stage 21's**.

**What API-231 is not (APIQ-1 = A, §48).** It is unauthenticated because **the content is public**. It
is **not** a supported third-party developer API: not externally documented, not promised semantic
stability for third parties, not rate-limited as an external product API, and not an integration
surface for arbitrary consumers. It is consumed by ScholarShelf's own public delivery host. Ordinary
public-web protections — caching, abuse control, the usual internet-facing hardening — apply because
the endpoint is unauthenticated and reachable, **not** because it is an external product.

---

## 28. Public school resolution

**APID-030 · One resolution contract, three possible signals, one indistinguishable failure**

| ID | Endpoint | Capability |
|---|---|---|
| API-231 | `GET /api/site/:schoolCode` | CAP-081 · SC-8 |
| API-232 | `GET /api/site/resolve?host=` | CAP-081 · SC-8 |

Signals the contract accepts without restructuring: **school code · host · subdomain**. **No DNS
mechanism, certificate handling, domain product or provider is designed here.**

**One failure answer, deliberately.** Each of the following returns **`404` with an identical body**:

```
school does not exist                        →  404
school exists but has no CMS entitlement     →  404      ← not distinguishable
school exists but has never published        →  404      ← not distinguishable
school exists but is suspended or archived   →  404      ← not distinguishable
```

A public probe cannot enumerate tenants, discover which schools are customers, or learn who bought the
website module.

---

## 29. Media and upload API

**APID-031 · Permission → direct upload → finalisation. Bytes arriving is not acceptance.**

```
1  POST /api/studio/media/uploads               API-222  CAP-080
       → 201 { uploadId, uploadTarget, constraints }   permission only; no bytes through the app
2  browser uploads DIRECTLY to object storage
       ── the file now exists and is NOTHING. Not addressable. Not public.
3  POST /api/studio/media/uploads/:uploadId/finalise   API-223  CAP-080  Idempotency-Key
       → 201 MediaAsset { id, state: "accepted", url, alt, kind }
       ACCEPTANCE is a separate server decision.
```

The same flow for MOD-001 branding assets: **API-022** permission, **API-023** finalisation, both under
**CAP-001** `manage_school_identity`.

**APID-032 · Four file trust states, only one publicly reachable**

```
pending      uploaded, not finalised   → not addressable · never public · not in PublishedSite
accepted     finalised, private        → addressable to authorised callers only
published    accepted AND published    → the ONLY state that appears in PublishedSite
rejected     finalised and refused     → addressable only in the Studio's own error surface
```

The current `app.use("/uploads", express.static(...))` mount — serving whatever is on disk with no
authorisation — is **not in the target contract** (C-68); removal is Stage 22. **Provider, signed-URL
duration and scanner are Stage 16/17.**

---

## 30. Enrolment import API

**APID-033 · Import is a step inside New Enrollment, not a separate product**

*Locked UX:* New Enrollment → **Upload Spreadsheet** → upload → parse server-side → map and validate →
preview errors → **create missing classes as the workflow requires** → explicit commit.

Endpoints **API-164…API-171**, gated by **CAP-027** `import_students_only` **OR CAP-028**
`import_students_and_families` — and **the commit (API-171) requires CAP-028 where families are
created**, because creating a family is a different act from adding a child.

| ID | Endpoint |
|---|---|
| API-164 | `GET /api/school/imports/enrolment/template` |
| API-165 | `GET /api/school/imports/enrolment/fields` |
| API-166 | `POST /api/school/imports/enrolment` → `201 {importId}` or **`202`** for a large file |
| API-167 | `GET /api/school/imports/enrolment/:importId` |
| API-168 | `PUT /api/school/imports/enrolment/:importId/mapping` |
| API-169 | `GET /api/school/imports/enrolment/:importId/preview` — validated rows · per-row errors · **classes that would be created** |
| API-170 | `POST /api/school/imports/enrolment/:importId/commit` — **explicit** · `Idempotency-Key` |
| API-171 | `GET /api/school/imports/enrolment/:importId/result` |

**Nothing is written until the commit.** The preview names every class the commit would create, so the
operator sees it before it happens. **The workbook is parsed server-side, always** (C-58, APP-035).
**Which of the two current import implementations survives is Stage 22.**

---

## 31. Reconciliation and payment-import API

**APID-034 · Near-term settlement is imported provider reconciliation, not live checkout**

Endpoints **API-130…API-136**, under **CAP-055** `import_provider_records` and **CAP-056**
`match_provider_record`, both AUTH-FINANCE · CD-4. **No provider is selected here** (Stage 17).

An automatic match makes a settlement **eligible for confirmation**. It does **not** confirm it —
confirmation is always API-120, always one command, always one transaction.

---

## 32. The integration callback seam

**APID-035 · A provider signal is interpreted before it can mean anything**

| ID | Endpoint | Capability | Scope | Idempotency |
|---|---|---|---|---|
| **API-279** | `POST /api/integrations/v1/:integrationId/events` | **CAP-094** `submit_settlement_signal` | **SC-11** | **the provider's stable event identifier** (APID-020) |

```
provider signal arrives
      ↓ MOD-015 gateway: authenticity · replay · idempotency (via the provider's own event identity)
      ↓ interpreted signal — "a reference matching X cleared", not "settled = true"
      ↓ MOD-007 DECIDES
   202 Accepted        ← never a business outcome computed inline
```

`PERMISSIONS.md` is explicit that this credential may submit a **signal** and may **not** confirm
settlement, create or modify children, families or requirements, or reach a second school — *"a valid
signature is authentication; it is not authority over a tenant."*

---

## 33. Notification and message API

**APID-036 · MOD-009 owns notification truth; MOD-015 owns delivery attempts**

School messaging **CAP-072** `message_family`; family messaging **CAP-073** `message_school`;
notifications **CAP-074** `view_notifications` and **CAP-075** `manage_notification_preferences`, both
at **SC-5** (any context).

**API-251 `GET /api/platform/deliveries`** (CAP-085, SC-7) exposes *that* a delivery was attempted and
*whether* it succeeded — never a provider payload, error body, template id or API response. **A
delivery failure never removes or alters a notification**: the notification is durable truth written
inside the authoritative transaction, and delivery is a separate, later, retryable fact.

---

## 34. Platform API

**APID-037 · Platform is tenant metadata and lifecycle — never cross-tenant operational data**

Endpoints **API-234…API-255**, under **CAP-082** `create_tenant`, **CAP-083** `invite_first_admin`,
**CAP-084** `manage_tenant_lifecycle` and **CAP-085** `view_platform_state` — all AUTH-PLATFORM · SC-7.

**No Platform endpoint returns another tenant's children, settlements, stock, custody or messages.**
Being internal is not authority. Cross-tenant operational access exists only through a **named support
engagement** (§35).

### 34.1 School lifecycle — four different acts, never one status setter

```
suspend           service withheld; data intact; reversible          CAP-084
archive           read-only retention; not in ordinary lists          CAP-084
request deletion  starts a governed process; NOT deletion             CAP-084
erasure / purge   the irreversible acts — BREAK-GLASS only            CAP-036 / CAP-092
```

**Not four values of one field.** `PATCH /api/platform/schools/:id { status: "deleted" }` is
**REJECTED**. `CAP-092` `purge_tenant` carries **AUTH-BREAKGLASS · CD-7 · CD-12** in `PERMISSIONS.md`
— a different authority from ordinary platform administration, which is exactly why it is a
break-glass endpoint (API-277) and not a lifecycle one.

---

## 35. Support mode, break-glass and bounded investigation

**APID-038 · Support Mode is a set of explicitly projected typed operations — never a wildcard proxy**

*Correction 2, applied at owner review.* The PROPOSED draft listed
`/api/platform/support/:engagementId/school/*` as a target endpoint. **That is removed.** A wildcard is
acceptable as document shorthand and **must not be a route contract**, because it would make possession
of an active engagement forward every school operation automatically.

**The locked capability already says so.** **CAP-088 is `run_typed_support_operation`** — AUTH-PLATFORM
· **SC-6** · **CD-6** · AUDIT. *Typed.* Support Mode is not "the school API with a different scope"; it
is a **named, enumerated set of operations**, each projected deliberately.

```
NAMED ENGAGEMENT  +  SPECIFIC CAPABILITY  +  SPECIFIC RESOURCE  +  SC-6  +  CD-6
```

**The default is NOT EXPOSED THROUGH SUPPORT.** It is not *every school endpoint exposed unless
blocked*.

### 35.1 Support operation projection matrix

Only the operations in this matrix are callable under Support Mode.

| Ordinary school endpoint | Support-mode endpoint | Capability | SC-6 | Elevation | Owning operation |
|---|---|---|---|---|---|
| `GET /api/school/overview` | **API-260** `GET /api/platform/support/:e/overview` | CAP-088 | ✓ | no | MOD-010 |
| `GET /api/school/settings` | **API-261** `GET …/:e/settings` | CAP-088 | ✓ | no | MOD-001 |
| `GET /api/school/setup` | **API-262** `GET …/:e/setup` | CAP-088 | ✓ | no | MOD-001 |
| `POST /api/school/setup/complete` | **API-263** `POST …/:e/setup/correct` | CAP-088 | ✓ | no | MOD-001 |
| `GET /api/school/classes` | **API-264** `GET …/:e/classes` | CAP-088 | ✓ | no | MOD-003 |
| `GET …/imports/enrolment/:importId` | **API-265** `GET …/:e/imports/:importId` | CAP-088 | ✓ | no | `application/import-enrolments` |
| `GET /api/platform/deliveries` (scoped) | **API-266** `GET …/:e/deliveries` | CAP-088 | ✓ | no | MOD-009 |
| `GET /api/school/messages/:threadId` | **API-267** `GET …/:e/messages/:threadId` | CAP-088 | ✓ | no | MOD-009 |
| — (**PA-2**) | **API-268** `POST …/:e/account-recovery` | CAP-088 | ✓ | **PA-2: support mode required** | MOD-002 |
| `GET /api/school/identity` | **API-269** `GET …/:e/identity` | CAP-088 | ✓ | no | MOD-001 |
| `PATCH /api/school/identity` | **API-270** `PATCH …/:e/identity` | CAP-088 | ✓ | no · `If-Match` | MOD-001 |

**Prohibited entirely under Support Mode — no projection exists, and none is to be added:**

| Prohibited | Why |
|---|---|
| **Any finance capability** — CAP-045, 047, 048, **049**, 050, 051, 052, 053, 054, 055, 056, 070, 077 | Support has no AUTH-FINANCE. A platform operator must never confirm a school's settlement or move its money. |
| **Any guardian capability** — CAP-046, 057, 058, 059, 073 | AUTH-FAMILY is relationship-derived. It cannot be assumed by a support engagement. |
| **Any teacher capability** — CAP-062, 063, 065, 067 | AUTH-TEACH derives from staffing. Support is not staffing. **CD-5 own-child and SC-3 hand-over reach are not projectable.** |
| **Bulk or cross-tenant operational reads** — children, families, settlements, stock, custody lists | An engagement names **one** school and grants **typed** operations, not a data export. |
| **Destructive acts** — CAP-020, 033, 035, 036, 084, 092 | Lifecycle and erasure remain platform or break-glass acts, never support projections. |
| **Arbitrary SQL** | Not in the target architecture at all (§35.3). |

**The support contract projects an existing application operation under a different scope.** It does
not duplicate business logic: API-261 calls the same MOD-001 read as API-018, with SC-6 and the named
engagement instead of SC-1. **Stage 16 owns the exact authority and elevation mechanics.**

### 35.2 Engagement lifecycle

| ID | Endpoint | Capability |
|---|---|---|
| API-256 | `POST /api/platform/support/engagements` | **CAP-086** `enter_support_mode` — SC-7 → opens **SC-6** |
| API-257 | `GET /api/platform/support/engagements/active` | CAP-085 |
| API-258 | `GET /api/platform/support/engagements/:engagementId` | CAP-085 · SC-6 · CD-6 |
| API-259 | `POST /api/platform/support/engagements/:engagementId/exit` | **CAP-087** `exit_support_mode` |

An engagement identifies **school · reason · actor · active state · started at**, and every scoped
request carries it **in the path**.

```
X-School-Id: <any school>     →  ✗ DOES NOT EXIST. No such header, no such shortcut.
```

### 35.3 Bounded investigation and break-glass

**APID-039 · CAP-089 survives; arbitrary SQL does not**

| ID | Endpoint | Capability |
|---|---|---|
| API-271 | `GET /api/platform/investigation/subjects` | **CAP-089** `run_readonly_query` · SC-6 · CD-6 |
| API-272 | `GET /api/platform/investigation/subjects/:subject` | **CAP-089** · read-only · paginated · credential-excluding |

**`POST /api/owner/db/query` — arbitrary SQL — is not in the target contract.** API-271/272 expose
**named, bounded, read-only investigation subjects**. No arbitrary writes, no schema administration, no
credential access. **C-73 is not resolved here** — it is a deployment-gating defect owned by Stage 21.

**APID-040 · Break-glass is a separate, clearly exceptional surface** — `/api/platform/break-glass/*`,
never under ordinary Platform CRUD, never in Platform navigation (Stage 13 APP-008).

| ID | Endpoint | Capability | Conditions |
|---|---|---|---|
| API-273 | `POST /api/platform/break-glass/elevate` | **CAP-090** `elevate_break_glass` | AUTH-BREAKGLASS · CD-6, **CD-7** |
| API-274 | `POST /api/platform/break-glass/end` | CAP-090 | CD-6, CD-7 |
| API-275 | `POST /api/platform/break-glass/operations/:operationId` | **CAP-091** `perform_break_glass_write` | CD-6, CD-7 |
| API-276 | `POST /api/platform/break-glass/schools/:schoolId/erase-account` | **CAP-036** `erase_account` | *"Not an ordinary administrative capability"* — §17 PERMISSIONS |
| API-277 | `POST /api/platform/break-glass/schools/:schoolId/purge` | **CAP-092** `purge_tenant` | SC-7 · CD-7, **CD-12** |

**Stage 16 owns elevation, MFA re-challenge, time windows and cooldowns; Stage 19 owns the audit
record.** Stage 14 defines only that this is a distinct transport surface.

---

## 36. Health, readiness and the scheduler

**APID-041 · Three health contracts; readiness can actually fail**

*Current evidence:* `auth.routes.ts:51` returns `{ status: mode === "database" ? "ok" : "degraded" }` —
it reports **configuration**, not readiness, and never touches the database (**C-69**).

| ID | Endpoint | Auth | Returns |
|---|---|---|---|
| **API-280** | `GET /api/health/live` | PUBLIC | `200 {status:"ok"}` — the process is running. Nothing more. |
| **API-281** | `GET /api/health/ready` | PUBLIC | `200 {status:"ready"}` or **`503 {status:"not_ready", checks:[{name, ok}]}`** |
| **API-282** | `GET /api/health/dependencies` | **CAP-085** · SC-7 | per-dependency detail, authenticated |

**Separate endpoints, not one endpoint with modes** — a load balancer and a deployment gate ask
different questions, and a public liveness probe must not obtain dependency detail by adding a query
parameter.

**Readiness must be able to fail**, and does, when the required database is unavailable or the schema
is incompatible with the running code. `checks` names *what* failed (`"database"`), never *why* in
technical terms. Public output carries no database URL, table name, schema internal, credential or
tenant state. **Stage 21 consumes readiness for deployment gating.**

**APID-042 · Cron is a trigger, and returns almost nothing**

| ID | Endpoint | Capability | Scope | Returns |
|---|---|---|---|---|
| **API-278** | `POST /api/internal/jobs/run` | **CAP-093** `run_scheduled_job` | **SC-10** | `200 { invocationId, claimed, completed, remaining }` |

`PERMISSIONS.md` scopes the Scheduler to *"one job, one school, one run date"* and forbids *"run twice
for one date"* — which is why this endpoint carries an idempotency requirement and returns an
**invocation outcome**, not business data. **No digest composition, notification logic or per-school
iteration lives in the endpoint** (Stage 13 APP-038). **PostgreSQL owns durable job truth — the API is
not the queue.**

---

## 37. Correlation and support reference

**APID-043 · One correlation identifier, one opaque reference, no technical leakage**

```
request arrives
   → server generates a correlation id
   → response header:  X-Correlation-Id: <id>          on EVERY response, success or failure
   → on failure:       error.reference: "r_9f2c41a8"   opaque · quotable
   → internal logs and error tracking carry the correlation id   (Stage 13 APP-040)
```

The user-facing reference is **opaque** — not a stack hash, request path, timestamp or tenant
identifier. **Log field schema is Stage 21; audit records are Stage 19.**

---

## 38. Asynchronous operations

**APID-044 · `202` only when there is a job resource to poll — and polling is not truth**

```
POST /api/school/imports/enrolment/:importId/commit
   → 202 Accepted · Location: /api/school/jobs/:jobId · { jobId, state: "queued" }

GET /api/school/jobs/:jobId    API-175
   → 200 { jobId, state: "queued"|"running"|"succeeded"|"failed", progress?, resultRef?, error? }
```

**`202` is used only where the work is genuinely durable and long** — large enrolment imports, large
reconciliation imports, rollover execution. Everything else completes synchronously, because a `202`
with no durable job behind it is a lie about where the truth lives.

**No realtime infrastructure is introduced.** No WebSockets, no SSE, no long polling — Stage 11 chose
none and no locked requirement needs it. **The job status resource is a view of MOD-014's durable
truth, never the truth itself** (API-R8).

---

## 39. Export and download

**APID-045 · Small exports inline; large exports become an artefact behind the storage boundary**

A private export is **never** a public URL. It goes through the same object-storage access architecture
as media (§29) and is retrieved by an authorised request (**API-176**, CAP-076 **OR** CAP-077).
**Signed-URL duration is Stage 17; the size threshold is Stage 18.**

---

## 40. Shared API contracts

**APID-046 · What belongs in `shared/contracts/`, and what never does**

| Belongs | | **Never** | |
|---|---|---|---|
| `PublishedSite` and members | §27 | Drizzle tables or row types | API-P14 |
| `ApiError` | §12 | password hashes · MFA secrets · recovery codes | |
| `Page<T>` | §15 | session storage objects | |
| `Money`, `IsoDate`, `IsoInstant` | §14 | internal provider payloads or error bodies | |
| `CapabilityId` (CAP-001…CAP-095) | APP-021 | audit record internals | Stage 19 |
| per-surface request/response contracts | | anything a public contract could gain by extension | §27 |
| `SessionState` | §6 | | |

**APID-047 · `DATABASE ROW ≠ DOMAIN FACT ≠ API RESPONSE` — locked**

```
DATABASE ROW      what Stage 15 stores.        Never leaves a module's data layer.
DOMAIN FACT       what a module reasons about. Never leaves the server.
API RESPONSE      what a client is told.       Deliberately shaped, deliberately narrow.
```

**A Drizzle row is never returned because TypeScript makes it convenient.** This matters most for
**users** (credential and MFA fields), **children**, **payments** (provider references and internal
state), **school configuration**, **audit**, **sessions** and **CMS media** (storage keys, pending
state). Each currently has at least one endpoint returning a shape derived directly from persistence.

---

## 41. Legacy → target endpoint map

**Every legacy endpoint has a named replacement, a migration owner and a removal stage. None is
removed by this document.** The per-endpoint mapping is the *Legacy replaced* column of §17; the
families and the deliberate removals are below.

| Legacy | Target | Class | Removal |
|---|---|---|---|
| `POST /api/auth/login` | **API-001** `sign-in` | **DUPLICATE — no callers (F-1)** | 22 |
| `POST /api/auth/logout` | **API-003** `sign-out` | **DUPLICATE — no callers** | 22 |
| `POST /api/auth/accept-invite` | **API-009** | **DUPLICATE — no callers** | 22 |
| `GET /api/auth/me` | **API-004** `/auth/session` | RENAME | 22 |
| `POST /api/seed-users` | none | **REMOVE — dev endpoint in production routes (F-9)** | 22 |
| `GET /api/isbn-lookup/:isbn` *(client call, no route)* | **API-087** `/school/books/lookup?isbn=` | **BROKEN — C-76** | 22 |
| `GET /api/books/by-isbn/:isbn` | **API-087** | ORPHAN implementation of the above | 22 |
| `/api/admin/*` (34) | `/api/school/*` | REPLACE — role prefix (F-10) | 22 |
| `/api/parent/*` (15) | `/api/family/*` | REPLACE — role prefix | 22 |
| `/api/teacher/*` (7) | `/api/school/*` under SC-2/SC-3 | REPLACE — role prefix | 22 |
| `/api/finance/*` (4) | `/api/school/money/*`, `/api/school/reconciliation/*` | REPLACE — **C-50** | 22 |
| `/api/owner/*` (38) | `/api/platform/*` · `/support/*` · `/investigation/*` · `/break-glass/*` | REPLACE — **C-44** | 22 |
| `POST /api/owner/enter-support/:id` · `POST /api/owner/exit-support` | **API-256** · **API-259** | **DUPLICATE — no callers (F-7)** | 22 |
| `POST /api/owner/support-mode/enter` · `/exit` | **API-256** · **API-259** | REPLACE | 22 |
| `/api/owner/console/*` (6) | **API-271 · API-272 · API-273 · API-274 · API-275** | **ORPHAN — the hardened tier, unused (F-8)** | 22 |
| `POST /api/owner/db/query` | none | **REMOVE — arbitrary SQL not in target (Stage 12 §26)** | 22 |
| `GET /api/owner/db/tables` · `/tables/:table` | **API-271** · **API-272** | REPLACE | 22 |
| `POST /api/owner/db/danger/wipe-school/:id` | **API-276** erase-account | REPLACE — break-glass, **CAP-036** | 22 |
| `POST /api/owner/db/danger/purge-school/:id` | **API-277** | REPLACE — break-glass, **CAP-092** | 22 |
| `POST /api/admin/payments/:id/confirm` · `/verify` · `/manual-verify` | **API-120** | REPLACE — I-2, one command | 22 |
| `POST /api/admin/payments/:id/order-status` | named acts | **REMOVE — generic status setter (APID-011)** | 22 |
| `/api/students/import/preview` · `/confirm` | **API-164**…**API-171** | REPLACE — duplicate import path | 22 |
| `/api/families/enroll/import/analyze` · `/commit` | **API-164**…**API-171** | REPLACE — the correct-shaped one | 22 |
| `PUT · GET · DELETE /api/students/:id/book-level-override` | **API-109** · **API-110** | RENAME · no callers | 22 |
| `GET /api/public/schools/:code` + `/branding` + `/website` + `/email-logo` | **API-231** `PublishedSite` | REPLACE — **AQ-1 = B** | 22 |
| `GET|POST /api/cron/run` | **API-278** | REPLACE — trigger only | 22 |
| `GET /api/health` | **API-280 · API-281 · API-282** | REPLACE — **C-69** | 22 |
| `POST /api/webhooks/payment-update` | **API-279** | REPLACE — versioned seam | 22 |
| `/api/class-book-levels/*` · `/api/book-level-items/*` | **API-102** · **API-104** | REPLACE — join tables as resources | 22 |
| `/api/guardians/*` (root) | **API-073**…**API-077** nested | REPLACE | 22 |
| `/api/inventory-transactions` | **API-094** | RENAME | 22 |
| `/api/students/:id` family | **API-055**…**API-062** `/school/children/*` | RENAME — locked vocabulary (UXQ-2) | 22 |

---

## 42. Caller ↔ route reconciliation — the 404 audit

**Measured, not asserted.** Every `app.<verb>("…")` in the server, every `/api/…` string in
`client/src/**`, normalised and differenced both ways — **and every candidate was opened and read
before being called a defect.**

### 42.1 Client calls with no server route

| Client call | Verdict |
|---|---|
| `/api/isbn-lookup/${isbn}` — `books.tsx:55`, raw `fetch` | **GENUINE. → C-76.** No such route among the 242; `GET /api/books/by-isbn/:isbn` implements it and has no caller. |
| `["/api/owner/db/browse", …]` — `db-console.tsx:84` | **NOT a 404.** Query-key namespace; explicit `queryFn` fetches `/api/owner/db/tables/:table`. Verified in the handler. |
| `["/api/owner/schools/detail", …]` — `owner.tsx:569` | **NOT a 404.** Query-key namespace; explicit `queryFn` fetches `/api/owner/schools/:id`. Verified. |
| `/api/books/scan` · `/api/public/schools` · `/api/admin/communications:x` | **NOT 404s.** Template-literal truncation artefacts of the extraction. |

**One genuine broken call in 151 client paths.** The other five were candidates that reading
disproved — recorded because the difference between *measured* and *asserted* is the point of this
section.

### 42.2 Server routes with no client caller — 56

| Category | Count | Disposition |
|---|---:|---|
| **Intentionally uncalled by a browser** — `/api/health`, `/api/cron/run`, `/api/webhooks/payment-update` | 3 | **legitimate.** Consumers are the platform, the scheduler and a provider. |
| **Duplicate families** — `auth/login`, `auth/logout`, `auth/accept-invite`, `owner/enter-support/:id`, `owner/exit-support` | 5 | dead duplicates (F-1, F-7) |
| **The hardened console tier** — `/api/owner/console/*` | 6 | **orphaned good implementation** (F-8) |
| **Support-scoped reads** — `owner/support-status`, `owner/support/communications/:id`, `owner/support/schools/:id/communications` | 3 | targets: API-257 · API-267 · API-266 |
| **Owner branding-on-behalf** — `owner/schools/:id/branding` + `/logo` + `/reset` | 3 | targets: API-269, API-270 |
| **Orphan implementations** — `books/by-isbn/:isbn`, `books/low-stock`, `books/:id/stock`, `book-copies/lookup/:code`, `inventory-transactions`, `students/:id/book-level-override` ×3, `admin/parents`, `admin/book-management-summary`, `admin/book-distribution` ×2, `admin/payments/:id/verification`, `allocations/:id/absent`, `allocations/:id/custody`, `families/:id/*` ×3, `parent/children/:id/books`, `parent/message-threads/:id`, `*/message-unread` ×2, `subjects/:id`, `users/:id`, `invites/:token*` | ~33 | each mapped in §17's legacy column |
| **`POST /api/seed-users`** | 1 | **REMOVE** — a dev endpoint in the production route table |
| **Public routes** | 4 | reached by `school-public.tsx`; extraction artefact |

**Intentional public not-found behaviour is recorded separately and is not a defect:** §28's `404`
for an unavailable public site is a *designed* answer, deliberately indistinguishable across four
causes. Counting it as a 404 to eliminate would be exactly the wrong reading.

**The reconciliation is weakened today by C-77** — because an unmatched `/api/*` does not always
announce itself honestly, a route gap can survive unnoticed. That is the second, more serious half of
what §2.3 F-12 found, and it is why C-77 exists separately from C-76.

**Nothing is removed by this document.** Stage 22 owns removal.

---

## 43. API decisions — index

**APID-001 … APID-047**, contiguous.

| ID | Decision | § | ID | Decision | § |
|---|---|---|---|---|---|
| APID-001 | `/api/` unversioned; `/api/integrations/v1/` versioned | 4 | APID-025 | Replacement: four acts, four capabilities | 23 |
| APID-002 | Breaking change by coexistence + deprecation headers | 4 | APID-026 | Rollover: preview then execute | 24 |
| APID-003 | Surfaces named for the thing, not the role | 4 | APID-027 | Draft → preview → publish → public | 26 |
| APID-004 | One authentication family | 5 | APID-028 | `PublishedSite` closed field set | 27 |
| APID-005 | `SessionState` informs navigation only | 6 | APID-029 | Endpoint **and** internal contract | 27 |
| APID-006 | Four scoping rules, one per scope basis | 7 | APID-030 | One resolution contract, one failure answer | 28 |
| APID-007 | Resources are workflows, not tables | 8 | APID-031 | Permission → direct upload → finalisation | 29 |
| APID-008 | Opaque internal ids; public school code | 8 | APID-032 | Four file trust states | 29 |
| APID-009 | Resource for single, envelope for collection | 9 | APID-033 | Import is a step in New Enrollment | 30 |
| APID-010 | Screen read compositions own no truth | 9 | APID-034 | Reconciliation import, not live checkout | 31 |
| APID-011 | Business acts get named endpoints | 10 | APID-035 | Provider signals are interpreted | 32 |
| APID-012 | Closed command bodies; additive responses | 11 | APID-036 | Notification truth vs delivery | 33 |
| APID-013 | One error envelope | 12 | APID-037 | Platform: metadata and lifecycle only | 34 |
| APID-014 | Status policy; `412` and `422` introduced | 13 | APID-038 | **Support Mode is a projection matrix, not a wildcard** | 35 |
| APID-015 | Money as a decimal string + currency | 14 | APID-039 | Bounded investigation; no arbitrary SQL | 35 |
| APID-016 | Dates and instants unformatted | 14 | APID-040 | Break-glass is a separate surface | 35 |
| APID-017 | One cursor pagination contract | 15 | APID-041 | Three health contracts | 36 |
| APID-018 | Filters run inside scope | 15 | APID-042 | Cron returns an invocation outcome | 36 |
| APID-019 | Scoped search; no global search | 15 | APID-043 | Correlation id and opaque reference | 37 |
| APID-020 | **Two idempotency forms: first-party key, provider event id** | 16 | APID-044 | `202` only with a job resource | 38 |
| APID-021 | `If-Match` where warranted; **`412` on mismatch** | 16 | APID-045 | Export inline or as an artefact | 39 |
| APID-022 | **One API ID = one method + one path** | 17 | APID-046 | What `shared/contracts/` holds | 40 |
| APID-023 | I-2: one authoritative command | 21 | APID-047 | Row ≠ fact ≠ response | 40 |
| APID-024 | One hand-over command | 22 | | | |

---

## 44. API risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **API-R1** | Endpoint proliferation — one endpoint per storage method | MEDIUM | MEDIUM | APID-007 · APID-010 · the test is a coherent read, command or collection operation, not implementation trivia |
| **API-R2** | Client/server contract drift once both are hand-written | **HIGH** | HIGH | APID-046 — contracts in `shared/contracts/`, imported by both sides; a change breaks the build, not production |
| **API-R3** | Generic `PATCH` reintroduces mass assignment | MEDIUM | **VERY HIGH** | APID-011 · APID-012's server-owned field list |
| **API-R4** | `PublishedSite` quietly gains a private field | LOW | **VERY HIGH** | APID-028 closed field set; APP-047 stops the renderer reaching a module that could supply one |
| **API-R5** | Role-specific route duplication returns under delivery pressure | **HIGH** | MEDIUM | APID-003 — a new role prefix is a visible architectural regression |
| **API-R6** | Idempotent retry ambiguity — same key, different body | MEDIUM | HIGH | APID-020 — `409 IDEMPOTENCY_KEY_CONFLICT`. **Persistence is Stage 15** |
| **API-R7** | The default query function builds URLs by joining the key (**F-4**) | **HIGH today** | MEDIUM | Query keys declared per work area (Stage 13 APP-014); a key is not a URL builder |
| **API-R8** | Job polling becomes the operational source of truth | MEDIUM | HIGH | APID-044 — the job resource is a **view** of MOD-014's durable truth |
| **API-R9** | 404/403 policy drifts and starts leaking existence | MEDIUM | HIGH | §13.1 is one rule; §28 is its strictest application |
| **API-R10** | Legacy and target APIs coexist forever | **HIGH** | MEDIUM | §41 — every legacy endpoint names replacement, owner and removal stage |
| **API-R11** | Response types get tied to Drizzle rows for convenience | **HIGH** | HIGH | APID-047 · API-P14 · APID-046 forbids row types in `shared/contracts` |
| **API-R12** | `400`, `409`, `412` and `422` blur again | MEDIUM | LOW | APID-014: shape / business conflict / failed precondition / domain refusal. Four sentences, applied consistently |
| **API-R13** | Composition endpoints grow into a BFF that owns truth | MEDIUM | HIGH | APID-010 — built by MOD-010, which has no `data.ts` (Stage 13 APP-029) |
| **API-R14** | The deprecated auth family is re-adopted because it still answers | LOW | MEDIUM | §41 marks all three; `Deprecation` headers make use visible before removal |
| **API-R15** | The Support projection matrix is extended casually until it is a wildcard again | **MEDIUM** | **VERY HIGH** | APID-038 — the default is NOT EXPOSED; §35.1's prohibition table names the capability classes that may never be projected. Adding a row is an architectural change, not a feature |
| **API-R16** | A provider is assumed to support `Idempotency-Key` and replay protection silently degrades | MEDIUM | HIGH | APID-020 — external callbacks use the **provider's own** event identity; Stage 17 defines it per integration before the seam is used |

Sixteen risks. **API-specific and non-duplicative** of Stage 12's AR-* or Stage 13's CR-*. API-R15 and
API-R16 were added at owner review, as the direct consequences of Corrections 2 and 5.

---

## 45. Existing conflicts addressed

**Every row is TARGET CONTRACT RESOLVED, IMPLEMENTATION OPEN** (Stage 13 Correction 8's terminology).
A document containing a contract does not repair a running system.

| Conflict | What Stage 14 contributes | Implementation |
|---|---|---|
| **C-32** query state | API-P4 · APID-009 · APID-014 — failure never returns `200 []`, `200 null` or `200 {}` | 22 |
| **C-40** role-keyed authorisation | APID-003 (no role in any path) · **every endpoint names its exact CAP** · APID-005 | 16 · 22 |
| **C-44** Platform/Core mixing | APID-037 · §41 — `/api/owner/*` → four distinct surfaces | 22 |
| **C-50** admin + AUTH-FINANCE | APID-003 · §20 — **no finance surface exists**; CD-4 capabilities gate money endpoints in the school surface | 22 |
| **C-57** direct upload | APID-031 · APID-032 | 16 · 17 · 22 |
| **C-58** browser workbook parsing | APID-033 — every import endpoint parses server-side | 22 |
| **C-64** optional tenant scope | APID-006 — scope derived server-side; **no `X-School-Id` header**; support scope is a path segment | 15 · 16 · 22 |
| **C-66** resource ownership | API-P2 · §13.1 — an id is a locator; unresolvable-under-scope is `404` | 16 · 22 |
| **C-67** session-cached authority | APID-005 — `SessionState` has no role and is not a bearer credential | 16 · 22 |
| **C-68** public `/uploads` | APID-032 — a pending object is never publicly addressable | 22 |
| **C-69** health not proven | APID-041 — **API-281 can fail**, on database availability and schema compatibility | 21 |
| **C-70** raw internal errors | APID-013 — one envelope; explicit forbidden-content list; **193 call sites measured** | 16 · 22 |
| **C-71** dual persistence semantics | APID-041 — readiness reports the real dependency, not a configured `storageMode` | 22 |
| **C-73** console controls | APID-039 — arbitrary SQL is not in the target contract | **not resolved** — Stage 21 |

---

## 46. Conflicts carried forward

**C-1 … C-31 · C-34 … C-39 · C-41 · C-42 · C-43 · C-45 · C-46 · C-48 · C-49 · C-51 … C-56 · C-59 …
C-63 · C-65 · C-72 · C-73 · C-74** remain **OPEN and unchanged.**

- **C-42** (storage monolith) and **C-74** (indistinguishable database handles) are **server-internal**;
  no API contract touches either.
- **C-65** (no database tenant integrity) — APID-006 is the transport-layer rule only. **Stage 15 owns
  the backstop.**
- **C-72** and **C-73** are deployment-gating defects owned by **Stage 21**.
- **C-47** remains **WITHDRAWN / NOT APPLICABLE** (Stage 9); **C-75** remains **WITHDRAWN as
  duplicative of C-42** (Stage 13). **Neither identifier is reused.**

---

## 47. New conflicts

*Correction 7, applied at owner review.* The PROPOSED draft combined two defects under C-76. **Both
were directly re-verified on 30 August 2026 and both hold — so they are split.** They have different
causes, different fixes and different owning stages: **fixing ISBN lookup does not fix the API
fallback, and fixing the API fallback does not fix ISBN lookup.**

### C-76 — **OPEN** · The live ISBN feature and the server endpoint disagree

**Current evidence.** `client/src/pages/admin/books.tsx:55`:

```ts
const res = await fetch(`/api/isbn-lookup/${encodeURIComponent(isbn)}`, { credentials: "include" });
if (res.ok) { …auto-fill… } else { …"Not found — please fill in manually."… }
```

No route matching `/api/isbn-lookup` exists among the 242 registrations. The server instead exposes
`GET /api/books/by-isbn/:isbn`, which has **zero callers**.

**Impact — corrected at owner review.** The PROPOSED draft claimed this returns *HTML with a 200 so
`res.ok` passes and it fails parsing JSON*. **That was wrong for the production path, and I am
correcting my own claim rather than leaving it.** Re-verification shows: on Vercel the rewrite
`/api/(.*)` → `/api/index` matches **before** the SPA rewrite, and `server/app.ts:307` does not mount
`serveStatic` in serverless mode, so the request reaches Express and returns a genuine **404**.
`res.ok` is therefore **false**, and `lookupIsbn` takes its else branch.

**The feature does not crash — it fails silently and permanently.** Every ISBN lookup reports *"ISBN
scanned — Not found, please fill in manually,"* whatever the ISBN. A user cannot tell a broken feature
from a book that genuinely is not in the lookup source. That is worse for diagnosis than a crash, and
it is why this has survived.

**Not already represented.** Verified against C-1…C-75: C-42 concerns storage and transport coupling;
C-40 and C-50 concern role-keyed routing. **No existing conflict records a client caller with no
route.**

**Target:** **API-087** `GET /api/school/books/lookup?isbn=` — the canonical books lookup contract.
**Later owner: Stage 22** (client and server migration).

### C-77 — **OPEN** · Unmatched `/api/*` requests can return the SPA shell instead of an honest API error

**Current evidence, verified directly on 30 August 2026.**

```
server/app.ts:307     if (!options.serverless) { if (IS_PRODUCTION) serveStatic(app); … }
server/static.ts:21   app.use("/{*path}", (_req, res) => res.sendFile(".../index.html"));
api/index.ts          createApp({ serverless: true })
vercel.json           "/api/(.*)" → "/api/index"   BEFORE   "/(.*)" → "/index.html"
```

Two behaviours, and the difference is the deployment mode:

| Mode | Unmatched `/api/*` returns |
|---|---|
| **Serverless (Vercel — production today)** | Express's default handler: **404 with an HTML body** — honest status, wrong content type, **not the §12 error envelope** |
| **Non-serverless (`npm start` → `dist/index.cjs`; local development)** | `serveStatic`'s `app.use("/{*path}", …)` → **`index.html` with `200`** for any unmatched path, `/api/*` included |

**Impact.** In non-serverless modes a missing API route is indistinguishable from success at the
transport level: `res.ok` is true, and the caller fails later trying to parse HTML as JSON. In **every**
mode an unmatched `/api/*` answers with an HTML body rather than the canonical error envelope, so a
client's error classification (§12) has nothing to classify. Genuine route gaps do not announce
themselves, and **every future 404 audit is weakened by it** — including §42's.

**Not already represented.** Verified against C-1…C-76. C-76 is one broken caller; this is a property
of the request pipeline that would hide the next hundred. C-70 concerns error *content* from handlers
that ran; this concerns requests that reached no handler at all.

**Target architectural property:**

```
ANY unmatched /api/*  →  the API error boundary  →  a genuine non-2xx API response
                                                     in the §12 envelope
                      →  NEVER the SPA HTML shell, in ANY deployment mode
```

**Later owner:** **Stage 21** — the Vercel rewrite and the static-fallback ordering; and **Stage 14 /
Stage 22** — the API catch-all contract, which §12's error boundary (Stage 13 APP-015) is the natural
home for.

**C-76 and C-77 are the only new conflicts Stage 14 raises.** The next new identifier is **C-78**.

---

## 48. Owner decisions — DECIDED

```
OPEN STAGE 14 OWNER QUESTIONS: 0
```

### APIQ-1 — **DECIDED A**, 30 August 2026, by the owner (BytHub Technology Ltd)

**Decision.** `PublishedSite` is currently an **internal first-party contract for ScholarShelf's own
public website delivery**. It is **not** a supported third-party developer API. The endpoint may remain
unauthenticated because the content is public — but **unauthenticated and public does not mean
externally supported as a developer contract**. No API version segment is added for a hypothetical
future external consumer. A future supported external API requires a traceable amendment.

**The distinction that matters:**

```
PUBLIC CONTENT              ≠              PUBLIC DEVELOPER API
```

```
SCHOLARSHELF WEBSITE STUDIO → MOD-011 publication → PublishedSite
        → SCHOLARSHELF PUBLIC DELIVERY HOST → PUBLIC SCHOOL WEBSITE      ✓

PublishedSite → documented third-party developer platform                ✗ not currently
```

**What is locked by A:**

1. `PublishedSite` remains a **first-party** ScholarShelf contract.
2. `/api/site/*` remains part of the ordinary first-party `/api/` namespace.
3. It is **not** versioned as `/api/site/v1/*` — no speculative hedge.
4. It is **not** externally documented as a supported developer API.
5. **No compatibility is promised to third-party consumers.**
6. No developer API keys, API clients, developer accounts, public developer documentation or external
   API subscriptions are introduced.
7. Ordinary public-web protections still apply, because the endpoint is unauthenticated and
   internet-facing.
8. The field set remains deliberately public and **structurally** separated from operational data
   (APID-028).
9. A future supported third-party public API remains possible.
10. Offering it requires a **traceable Stage 14 amendment** and a deliberately versioned external
    contract **at that time**. The future external path is not preselected now.

**Recommendation text corrected at owner review.** The PROPOSED draft recommended A but then suggested
versioning `/api/site/v1/*` immediately "to keep B cheap." **That hedge is removed.** It contradicted
APID-001's own reasoning — first-party surfaces are unversioned; only contracts a third party pins are
versioned. Under A, `/api/site/*` is first-party, therefore unversioned. If a supported external API
is introduced later, **that external surface is versioned then.** This changes nothing about
`PublishedSite` itself.

**A school asking today** — *"Can my unrelated existing website consume ScholarShelf news through a
supported API?"* — gets: **not a supported product capability.** That can change later through an
owner amendment.

**AQ-1 = B and APIQ-1 = A are not in tension.** AQ-1 answers *how the school's website is delivered*
— rendered/static, a real public website. APIQ-1 answers *whom ScholarShelf promises API compatibility
to* — currently, itself. **Public website: yes. Public third-party developer API: not currently.**

**There are zero open Stage 14 owner questions.**

---

## 49. What Stage 14 deliberately does not decide

| Not decided | Owner |
|---|---|
| Tables · columns · indexes · foreign keys · RLS · SQL · physical schema · session-table layout · **idempotency-key and provider-event-id persistence** · `PublishedSite` storage representation · ETag/version column | **Stage 15** |
| Password hashing · MFA internals · CSRF · cookie attributes · security headers · rate-limit algorithms · error sanitisation mechanics · scheduler authentication · **support-mode elevation mechanics** · break-glass cooldowns · object scanning · signed-URL expiry · the exact 404/403 refinement for security-sensitive cases | **Stage 16** |
| Object-storage provider · email provider and templates · payment provider · webhook signature algorithm · **per-integration event-identity mechanics** · workbook library · domain and DNS mechanisms | **Stage 17** |
| `total` affordability · `staleTime` values · export size thresholds · job concurrency · index design | **Stage 18** |
| Audit record schema and fields | **Stage 19** |
| Test strategy and contract testing | **Stage 20** |
| Deployment · caching · public-site rendering timing · **the `/api/*` fallback fix (C-77)** · readiness gating · region | **Stage 21** |
| Migration order · which duplicate import implementation survives · when each legacy endpoint is removed | **Stage 22** |

---

## 50. Success criteria — answered

```
Does the client ever supply schoolId as authority?      → NO.   APID-006. No X-School-Id header exists.
Does resource ID imply permission?                      → NO.   API-P2 · §13.1.
Can family API span schools safely?                     → YES.  SC-4 · no school selector at any level.
Does admin + AUTH-FINANCE use the same context?         → YES.  §20 — there is no finance surface.
Does I-2 expose one command?                            → YES.  API-120, CAP-049.
Can client call settlement/allocation/stock as 3 steps? → NO.   §21 — the decomposed shapes are rejected.
Do command bodies permit arbitrary fields?              → NO.   APID-012 — unknown field is 400.
Can API errors contain raw exception messages?          → NO.   APID-013 — explicit forbidden list.
Can failed reads become 200 []?                         → NO.   API-P4.
Is money represented without float ambiguity?           → YES.  APID-015 — "127.50" + currency.
Are dates unambiguous?                                  → YES.  APID-016.
Is pagination consistent?                               → YES.  APID-017, applied per API-P9.
Are searches scoped before querying?                    → YES.  APID-018 · APID-019. No global search.
Does public PublishedSite contain operational fields?   → NO.   APID-028 — closed field set.
Can public site access drafts?                          → NO.   APID-027 — preview is authenticated.
Is preview authenticated?                               → YES.  API-228, CAP-078.
Is publish explicit?                                    → YES.  API-229, CAP-079 — a command.
Does byte upload equal product acceptance?              → NO.   APID-031.
Is upload finalisation explicit?                        → YES.  API-223 · API-023.
Is import preview separate from commit?                 → YES.  API-169 vs API-170.
Can spreadsheet parser run in browser?                  → NO.   APID-033.
Does payment provider directly set settlement?          → NO.   APID-035 — CAP-094 submits a SIGNAL.
Can notification delivery failure erase notification?   → NO.   APID-036.
Can Platform access arbitrary school operational data?  → NO.   APID-037 · §35.1's prohibition table.
Does Support Mode require named engagement?             → YES.  APID-038 — CAP-086, and it is in the path.
Is Support Mode a wildcard proxy?                       → NO.   §35.1 — an explicit projection matrix;
                                                                 the default is NOT EXPOSED.
Does health distinguish readiness from process life?    → YES.  API-280 vs API-281.
Does cron own business work?                            → NO.   APID-042 — CAP-093, an invocation outcome.
Does every authenticated endpoint name an exact CAP?    → YES.  §17 — 92 of 95 capabilities mapped;
                                                                 the 3 unmapped are explained, not hidden.
Is one API ID one method and one path?                  → YES.  APID-022 — 282, zero wildcards.
Does If-Match failure return 412?                       → YES.  APID-014 · APID-021.
Does I-2 use 412?                                       → NO.   It does not use If-Match.
Must a provider send our Idempotency-Key header?        → NO.   APID-020 — its own event identity.
Is /api/site/* a supported third-party developer API?   → NO.   APIQ-1 = A.
Is /api/site/* versioned?                               → NO.   First-party, therefore unversioned.
Are legacy clients allowed incremental migration?       → YES.  APID-002 · §41.
Were database tables designed?                          → NO.
Were security mechanics designed?                       → NO.
Was a provider selected?                                → NO.
Was deployment configured?                              → NO.
```

---

## 51. Diagrams

**1 · Overall API surfaces**

```
                    ONE EXPRESS APPLICATION
/api/auth/*             MOD-002    unauthenticated → session
/api/school/*           MOD-001-10 tenant-pinned  SC-1/2/3  ← admin·teacher·finance by CAPABILITY
/api/family/*           MOD-004    SC-4 relationship-derived, spans schools
/api/studio/*           MOD-011    SC-1 tenant-pinned, website only        CAP-078/079/080
/api/site/*             MOD-001+11 SC-8 UNAUTHENTICATED · PublishedSite    CAP-081 · first-party only
/api/platform/*         MOD-012    SC-7                                    CAP-082…085
  └ /support/:e/*       MOD-012    SC-6 · CD-6  TYPED operations only      CAP-086/087/088
  └ /investigation/*    MOD-012    SC-6 · CD-6  read-only                  CAP-089
  └ /break-glass/*      MOD-012    SC-6/7 · CD-7  exceptional              CAP-036/090/091/092
/api/internal/*         MOD-014    SC-10                                   CAP-093
/api/integrations/v1/*  MOD-015    SC-11  external · VERSIONED             CAP-094
/api/health{live,ready,dependencies}
```

**2 · Auth / session / context request path**

```
cookie → access/session   → Principal { userId }         ← NO role, by type
                          → access/authority (LIVE)      → ActiveContext
                          → access/authorise             → CAP × resource × SC × CD
                          → http handler                 → one operation
GET /api/auth/session (API-004) → SessionState { capabilities[] }   ← PRESENTATION ONLY
```

**3 · Tenant-scoped request**

```
POST /api/school/children  (API-056, CAP-018)   body: { name, classId }   ← NO schoolId
      ↓ session → ActiveContext → TenantScope{schoolId}                    ← derived server-side
      ↓ modules/families.create(scope, tx, …)
   201 Child
```

**4 · Family relationship-scoped request**

```
GET /api/family/children/:childId/books   (API-180, CAP-057, SC-4 · CD-3)   ← NO schoolId anywhere
      ↓ guardian relationship resolves the child        no relationship → 404
      ↓ school derived FROM THE CHILD
   200 { … }        a parent with children at two schools uses this unchanged
```

**5 · I-2 command endpoint**

```
POST /api/school/settlements/:id/confirm   API-120 · CAP-049 · Idempotency-Key
      ↓ authorise (SC-1 · CD-1, CD-4) · resolve settlement under scope
      ↓ application/confirm-settlement.ts
      ↓ withTransaction( MOD-007 + MOD-008 + MOD-005 + required MOD-009 truth ) → ONE COMMIT
   200 { settlement, allocations, stockMovements, notification }
   409 ALREADY_CONFIRMED   422 INSUFFICIENT_STOCK   422 NOT_PAYABLE
        ── every non-2xx means the transaction ROLLED BACK.  No 412: no If-Match here.
```

**6 · Read composition**

```
GET /api/school/overview  (API-172, CAP-076)
      ↓ MOD-010 composes read interfaces of MOD-001…MOD-009, within scope
   200 { … }        one round trip · owns NO truth · not a BFF service
```

**7 · Error flow**

```
module throws AppError → http/error-boundary → correlation id logged internally
                                             → { error: { code, message, reference, fields? } }
                                             → apps/common/errors classifies
                                             → QueryState presents
   400 shape · 401 · 403 capability · 404 scope · 409 business · 412 If-Match · 422 domain · 429 · 5xx
   never crosses: stack · SQL · table/column/constraint · provider payload · other-tenant id · path
```

**8 · Public website data flow**

```
public visitor → SCHOLARSHELF PUBLIC DELIVERY HOST        ← first-party only (APIQ-1 = A)
                     ↓  GET /api/site/:schoolCode  (API-231, CAP-081, SC-8)
                 MOD-001 identity + MOD-011 published content
                     ↓  PublishedSite  — as a VALUE
                 apps/site renderer     ← knows the CONTRACT, imports NO server code
   unresolvable · unentitled · unpublished · suspended  →  ONE identical 404
```

**9 · Draft → preview → publish → public**

```
PATCH /api/studio/pages/:id  CAP-078 · If-Match     draft only — public does not change
GET   /api/studio/preview    API-228 · CAP-078      authenticated · PublishedSite SHAPE from DRAFT
POST  /api/studio/publish    API-229 · CAP-079      explicit · idempotent · one transaction
GET   /api/site/:schoolCode  API-231 · CAP-081      published material only
```

**10 · Upload permission → direct upload → finalise**

```
POST /api/studio/media/uploads              API-222 · CAP-080  → 201 { uploadId, uploadTarget }
browser ──────────── bytes ────────────────▶ object storage    (not through the application)
        ← PENDING: not addressable, not public, not in PublishedSite
POST …/uploads/:id/finalise                 API-223 · Idempotency-Key → 201 { state: "accepted" }
        ← ACCEPTANCE is a separate server decision.  Arrival ≠ acceptance.
```

**11 · Import preview → commit**

```
POST /api/school/imports/enrolment           API-166  201 { importId }  or 202 + job
GET  …/:importId                             API-167  parse state · detected columns
PUT  …/:importId/mapping                     API-168  column → field
GET  …/:importId/preview                     API-169  validated rows · errors · classes to be created
POST …/:importId/commit                      API-170  CAP-028 · Idempotency-Key
                                                      ← NOTHING is written before this line
GET  …/:importId/result                      API-171  committed · skipped · failed
```

**12 · Notification truth → delivery status**

```
authoritative act ─┬─ MOD-009 notification fact   INSIDE the transaction (required consequences)
                   └─ COMMIT
                          ↓ eligible
platform/jobs runner → application/jobs/deliver-notifications → gateways/email → provider
                          ↓
                   MOD-009 records the delivery result
GET /api/school/notifications  CAP-074    GET /api/platform/deliveries  API-251 · CAP-085
        a delivery failure NEVER erases the notification
```

**13 · Durable job / 202 polling**

```
POST <long operation>  → 202 Accepted · Location: /api/school/jobs/:jobId
GET  /api/school/jobs/:jobId   API-175  → queued | running | succeeded | failed (+ progress)
   a VIEW of MOD-014's durable truth — never the truth itself
   NO WebSockets · NO SSE · NO realtime infrastructure
```

**14 · Support Mode API flow — a projection, not a proxy**

```
POST /api/platform/support/engagements   API-256 · CAP-086 · SC-7 → opens SC-6
     ↓ audited · { schoolId, reason } → 201 { engagementId }
GET  /api/platform/support/:e/settings   API-261 · CAP-088 · SC-6 · CD-6   ← ONE PROJECTED OPERATION
     ↓ …only the eleven operations in §35.1's matrix exist…
POST /api/platform/support/engagements/:e/exit   API-259 · CAP-087 · audited

   /api/platform/support/:e/school/*   ✗ NO WILDCARD ROUTE EXISTS
   X-School-Id: <any school>           ✗ NO SUCH HEADER
   finance · guardian · teacher CAPs    ✗ NOT PROJECTABLE
```

**15 · Provider callback seam**

```
provider → POST /api/integrations/v1/:integrationId/events   API-279 · CAP-094 · SC-11
              ↓ MOD-015: authenticity · replay · idempotency VIA THE PROVIDER'S OWN EVENT ID
              ↓ interpreted signal — "reference X cleared", not "settled = true"
              ↓ MOD-007 DECIDES
           202 Accepted        ← never a business outcome computed inline
```

**16 · Legacy → target API migration**

```
/api/admin/*   /api/parent/*   /api/teacher/*   /api/finance/*   /api/owner/*
      │              │               │                │               │
      ▼              ▼               ▼                ▼               ▼
/api/school/*   /api/family/*   /api/school/*   /api/school/money/*  /api/platform/*
                                (SC-2/SC-3)                          /support · /investigation
                                                                     /break-glass

both answer during migration · legacy sends Deprecation + Sunset headers
removal per endpoint when the replacement has callers and the legacy has none — STAGE 22 owns order
```

---

## 52. Traceability

| Locked source | How Stage 14 carries it |
|---|---|
| **MOD-001…MOD-015** | every endpoint in §17 names its owning module or orchestrator; MOD-010 appears only on read compositions and reports (leaf); MOD-015 only on API-279 and the delivery gateway |
| **CAP-001…CAP-095** | **§17 maps every authenticated endpoint to its exact capability** — 92 of 95 mapped; CAP-040, CAP-066 and CAP-095 explained (§17.1). The algorithm is Stage 16 |
| **AUTH-SCHOOL · AUTH-FINANCE · AUTH-TEACH · AUTH-FAMILY · AUTH-CMS · AUTH-PLATFORM · AUTH-BREAKGLASS** | reachable through each endpoint's capability; **AUTH-FINANCE gates money endpoints inside the school surface — PA-1 preserved, no finance API** |
| **SC-1…SC-12** | APID-006's four bases; SC-2/SC-3 on teacher endpoints; **SC-6** on every support projection; SC-8 public; SC-10 scheduler; SC-11 integration; SC-12 delivery (no inbound contract) |
| **CD-1…CD-12** | carried on each endpoint row — CD-4 finance, **CD-5 own-child block**, CD-6 support, CD-7 break-glass, CD-8 period, CD-9/CD-10 grants, **CD-11 PRE/POST replacement**, CD-12 purge |
| **Stage 5 workflows** | §21 settlement · §22 hand-over · §23 replacement · §24 rollover · §30 import · §26 publish · §35 support |
| **Stage 9 screens** | APID-010's six compositions map to named Stage 9 screens; §19 preserves handheld-first hand-over (DS-P10); §18 preserves UXQ-2 language; §22 preserves UXQ-3 (reception is CAP-064, an admin-office act) |
| **Stage 10** | API-P4 → the four query states; APID-013 → the error presentation contract |
| **Stage 11** | Express 5 · Zod · PostgreSQL-native search · **no realtime infrastructure** — unchanged |
| **Stage 12** | AD-030/AQ-1 = B → §27–§28 · §17 I-2 → APID-023 · §20 upload → APID-031 · §22 notification → APID-036 · §26 console → APID-039 · §28 errors → APID-013 · §38 callbacks → APID-035 |
| **Stage 13** | APP-011 → APID-003 · APP-018 → API-P16 · APP-021 → APID-005 · APP-026 → APID-006 · APP-027/048 → APID-023 · APP-030/031 → APID-028 · APP-034 → APID-031 · APP-035 → APID-033 · APP-040 → APID-043 · APP-041 → APID-041 · APP-049 → APID-036 |
| **Corporate audit** | 1.9 → APID-006 · 1.10 → API-P2 + §13.1 · 4.x payment race → APID-023 · 7.x uploads → APID-031/032 · 9.x errors → APID-013 · 11.x health → APID-041 |

---

## 53. Locking discipline

```
STAGE 14 — API DESIGN & CONTRACTS
STATUS: LOCKED
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
Open owner questions: 0 · APIQ-1 DECIDED A
New conflicts: C-76 · C-77
```

The owner approves Stage 14 **subject to Corrections 1–9**, applied above and recorded in place rather
than made silently. Later stages **may** implement and refine mechanics, **may** discover
implementation conflicts, and **may** record traceable owner amendments. They **may not silently
change:**

| Locked here | Requires a traceable amendment |
|---|---|
| Capability-based, not role-based, API organisation | APID-003 · §17 |
| Tenant / family / platform / support scope bases | APID-006 |
| **One-method-one-path contract identity** | APID-022 |
| Server-derived tenant scope | APID-006 — no `X-School-Id`, ever |
| **The I-2 one-command contract** | APID-023 · API-120 |
| Closed command bodies | APID-012 |
| Public/private contract separation | APID-028 |
| **APIQ-1 = A** — first-party only, unversioned, no external developer promise | §48 |
| `PublishedSite`'s closed public field set | APID-028 |
| One canonical error envelope | APID-013 |
| Money as an exact decimal wire value | APID-015 |
| Canonical date and time forms | APID-016 |
| The pagination rule | API-P9 · APID-017 |
| Explicit business-action commands | APID-011 |
| Upload permission → direct upload → finalisation | APID-031 |
| Import preview → explicit commit | APID-033 |
| Provider signal ≠ settlement truth | APID-035 |
| **Support engagement as explicit scope, projected not proxied** | APID-038 · §35.1 |
| Arbitrary SQL absent from the target API | APID-039 |
| Readiness distinct from liveness | APID-041 |
| `202` only with durable work | APID-044 |
| Incremental legacy API coexistence | APID-002 · §41 |

**Stage 14 approval ≠ production security clearance ≠ legal sign-off.** The BytHub Legal & Compliance
deployment halt and production go-live block of 23 August 2026 **stands in full.** No compliance claim
is made here, and no conflict is fixed in code.

---

## 54. Summary

1. **16 API principles**, API-P1…API-P16 — API-P9 corrected to distinguish growing from bounded
   collections.
2. **282 target endpoint contracts**, API-001…API-282, contiguous, **one method + one path each, zero
   wildcards**. The PROPOSED draft's "158" was imprecise and is not preserved.
3. **47 API decisions**, APID-001…APID-047, contiguous.
4. **16 API risks**, API-R1…API-R16 — API-R15 and API-R16 added as consequences of Corrections 2 and 5.
5. **92 of 95 locked capabilities** map to at least one endpoint; CAP-040, CAP-066 and CAP-095 are
   explained from `PERMISSIONS.md`, not hidden.
6. **242 current endpoints inventoried**, 201 distinct paths, 151 client paths, reconciled both ways.
7. **Two new conflicts, C-76 and C-77**, split because they have different causes, fixes and owners —
   **and C-76's impact description was corrected against fresh evidence.**
8. **Zero owner questions. APIQ-1 = A.** `/api/site/*` is first-party, unversioned, and not a supported
   third-party developer API.
9. **Support Mode is a projection matrix of eleven typed operations**, not a wildcard proxy — the
   default is NOT EXPOSED, and finance, guardian and teacher capabilities are prohibited outright.
10. **No database schema, no security mechanics, no provider, no deployment, no code.** The go-live
    block of 23 August 2026 stands.

```
STAGE 14 — API DESIGN & CONTRACTS
STATUS: LOCKED — 30 August 2026
Open owner questions: 0 · APIQ-1 = A · New conflicts: C-76 · C-77
Stage 15 is authorised.
```

---

## Amendment register — Stage 14

**Append-only. Later stages may implement this contract and may record traceable owner amendments
here. They must not silently rewrite it. If a later finding conflicts with anything above: FLAG THE
CONFLICT.**

**Verified before assigning: Stage 14 had no amendment register and no prior amendment — A14-001 is
the first. The register reaches API-282 — API-283 is the next free identifier.**

### A14-001 · The scheduler transport adapter — C-106

```
A14-001 · Scheduler transport adapter
RAISED BY   Stage 21 as C-106, 31 August 2026
DECIDED BY  THE OWNER — BytHub Technology Ltd, 1 September 2026
AFFECTS     the API register — ONE ADDITION.  API-278 is UNCHANGED.
TYPE        ADDITION.  Nothing removed, renamed or renumbered.
STATUS      RECORDED.
```

**THE PROBLEM, from first-party evidence.**

```
STAGE 14, LOCKED   API-278  POST /api/internal/jobs/run   CAP-093 · SC-10
STAGE 18, LOCKED   Vercel Cron is the trigger transport for durable jobs
VERCEL, VERIFIED   "To trigger a cron job, Vercel makes an HTTP GET request to
                    your project's production deployment URL, using the `path`
                    provided in your project's vercel.json file."
                    ── Vercel cron-jobs documentation, fetched 31 August 2026

VERCEL CANNOT ISSUE A POST.  Neither locked stage is wrong; together they do
not compose, and the scheduler cannot start the scheduled work.
```

**THE ADDITION — API-283**

| | |
|---|---|
| **API-283** | `GET /api/internal/jobs/trigger` |
| **Capability** | **CAP-093** `run_scheduled_job` — the same capability, because it is the same authority |
| **Scope** | **SC-10** — `/api/internal/*` is MOD-014, scheduler, SC-10 |
| **Module** | **MOD-014** |
| **Purpose** | **TRANSPORT ADAPTER ONLY** |
| **Rate / budget class** | **explicit and bounded** — one scheduled caller, a small ceiling per window; **not the interactive class**, and not unbounded |
| **Response** | bounded execution information — invocation identity and counts, **no business data** |
| **Replaces** | `GET\|POST /api/cron/run` — **the current route is not the permanent target** |

**WHAT THE ADAPTER DOES, AND THE LIST IS EXHAUSTIVE**

```
1  AUTHENTICATE the scheduler transport
      CRON_SECRET, compared with the Stage 16 TIMING-SAFE mechanism
      ── the current code already does this correctly and it survives
2  CORROBORATE, optionally
      x-vercel-cron-schedule present and expected · user-agent vercel-cron/1.0
3  CREATE / PROPAGATE a correlation id
4  INVOKE THE SAME APPLICATION JOB-RUNNER SERVICE AS API-278
5  RETURN bounded execution information

IT CONTAINS NO BUSINESS RULE.
IT SELECTS NO TENANT.
IT TAKES NO PARAMETER THAT CHANGES WHAT RUNS.
IT PERFORMS NO LOOPBACK HTTP POST TO ITSELF.
   ── an adapter that re-enters the application over HTTP would add a network
      hop, a second authentication surface and a new failure mode, to reach a
      function it can call directly
```

**SECURITY — the header is not the control**

```
THE VERCEL CRON HEADER AND USER-AGENT ARE NOT AUTHENTICATION.
   ── both are caller-supplied and trivially forged
   ── they NARROW THE SURFACE.  They do not grant access.

CRON_SECRET REMAINS AUTHORITATIVE.

NO browser cookie          ── this endpoint is not a browser surface
NO CSRF contract           ── there is no browser session to protect
NO public business data    ── counts and an invocation id, nothing else
FAILS CLOSED               ── a missing or non-matching secret is 401, and the
                              secret's ABSENCE must fail the environment
                              validation rather than silently 401 forever
```

**WHAT IS UNCHANGED — and this is the point of the amendment**

```
API-278   POST /api/internal/jobs/run   CAP-093 · SC-10
          ── method UNCHANGED
          ── path UNCHANGED
          ── capability UNCHANGED
          ── scope UNCHANGED
          ── contract UNCHANGED
          ── it remains the INTERNAL APPLICATION CONTRACT

API-283 CALLS THE SAME SERVICE.  It does not replace API-278, does not weaken
it, and does not add a GET method to it.
```

**Effect on this document's counts**

| | Locked | After A14-001 |
|---|---|---|
| API identifiers | **282** — API-001 … API-282 | **283** — API-001 … **API-283** |
| Internal / scheduler routes | 1 — API-278 | **2** — API-278 + API-283 |
| Owner questions | 0 | 0 |
| Conflicts | C-76 · C-77 | unchanged — **none closed by this amendment** |

**C-106 · TARGET RESOLUTION ESTABLISHED / IMPLEMENTATION OPEN.**

```
RESOLVED     the target composition now exists: a GET transport reaches the
             locked POST contract through a business-logic-free adapter

NOT CLOSED   no route has been built, and no route has been removed
             ── Stage 22 sequences: build API-283, switch the vercel.json path,
                verify end to end in staging, THEN remove /api/cron/run
             ── C-106 closes when that sequence has run and the old route is gone
```

**§41's route-replacement table gains one row by this amendment:**

| Current | Target | Disposition | Stage |
|---|---|---|---|
| `GET\|POST /api/cron/run` | **API-283** `GET /api/internal/jobs/trigger` | **REPLACE — transport adapter** | 22 |

**The earlier mapping of `/api/cron/run` to API-278 is superseded for the TRANSPORT half only.** The
current route did two jobs — it was both the transport entry point and the runner. **A14-001 separates
them: API-283 is the transport, API-278 is the runner, and the current route is replaced by the pair.**

---

### A14-002 · §30 prose cross-reference — the commit is API-170

**Class: TYPO / CROSS-REFERENCE CORRECTION ONLY.**

**Raised by Stage 22 at its final correction pass, 1 September 2026. Verified before assigning:
A14-001 was the latest amendment in this register, so this is A14-002.**

```
WHAT IS WRONG

   §30's PROSE reads:
      "the commit (API-171) requires CAP-028 where families are created"

   §30's OWN AUTHORITATIVE ENDPOINT TABLE reads:
      API-170   POST /api/school/imports/enrolment/:importId/commit
      API-171   GET  /api/school/imports/enrolment/:importId/result

   THE TABLE IS CORRECT.  THE PROSE MISTYPED THE IDENTIFIER.
```

**The correction, in full:**

| | |
|---|---|
| **Change** | in §30's prose, `"the commit (API-171)"` → `"the commit (API-170)"` |
| **Everything else in that sentence** | **unchanged** — the CAP-027 **OR** CAP-028 gate on API-164…API-171, and the rule that **CAP-028 is required where families are created**, both stand. They now attach to the correctly named act |
| **Endpoint catalogue** | **NOT ALTERED.** §17's rows for API-170 and API-171 were already right |
| **Method changes** | **none** |
| **Route changes** | **none** |
| **Capability changes** | **none** |
| **Scope changes** | **none** |
| **Response changes** | **none** |
| **New endpoints** | **none** |
| **Effect on counts** | **none** — API-001 … API-283 is unchanged |
| **Effect on conflicts** | **none. No conflict is opened or closed by this amendment** |
| **Owner questions** | 0 |

**Why this is an amendment and not a conflict.** A conflict is a disagreement about **what the target
should be**. Stage 14 never disagreed with itself about the import commit — **it mistyped an
identifier while describing an endpoint its own table defines correctly.** Correcting the prose to
match the catalogue removes an ambiguity; it does not choose between two positions.

**Stage 22 cites the corrected identifier**, and its §21 states the full current → target import
mapping against API-164 … API-171 explicitly, so no later reader has to infer it.

---

### A14-003 · Legacy `wipe-school` mapping correction — C-107

**Class: TARGET CROSS-REFERENCE / LEGACY-MAPPING CORRECTION.**

**Raised on the owner's decision of 1 September 2026. Verified before assigning: the register held
A14-001 and A14-002, so this is A14-003.**

```
OWNER DECISION      C-107 = OPTION A

LEGACY   POST /api/owner/db/danger/wipe-school/:schoolId
TARGET   API-247  POST /api/platform/schools/:schoolId/request-deletion

MEANING  a REVERSIBLE, GOVERNED SCHOOL LIFECYCLE ACTION
```

**The evidence the decision rests on, from the repository:**

```
wipe-school     "Stage 1: soft-delete.  Reversible with school.reactivate."
purge-school    "Stage 2: the irreversible purge."
                 -- gated on status = pending_deletion, and on a
                    PURGE_COOLDOWN_MS read from console_audit

THE ORDINARY TARGET LIFECYCLE ALREADY CONTAINS THE REVERSIBLE ACT:
   API-247  request-deletion  ·  CAP-084  ·  SC-7  ·  MOD-012
```

**What this amendment changes — legacy mappings only:**

| | |
|---|---|
| **§17, API-247's *Legacy replaced* column** | now reads **`owner/schools/:id/request-deletion · owner/db/danger/wipe-school/:id`** |
| **§17, API-277's *Legacy replaced* column** | **`/wipe-school/:id` is REMOVED from it.** It retains **`owner/db/danger/purge-school/:id`** as its irreversible-purge predecessor |
| **§41's row** | `POST /api/owner/db/danger/wipe-school/:id` → **API-247 `request-deletion`**, class **REPLACE — reversible lifecycle**, removal stage 22. **It no longer maps to API-276** |

**What this amendment does NOT change:**

| | |
|---|---|
| **API-247** | method `POST` · path `/api/platform/schools/:schoolId/request-deletion` · **CAP-084** · **SC-7** · MOD-012 — **all unchanged** |
| **API-276** | `POST /api/platform/break-glass/schools/:schoolId/erase-account` · **CAP-036** — **unchanged, and it remains the separate break-glass erase-account act** |
| **API-277** | `POST /api/platform/break-glass/schools/:schoolId/purge` · **CAP-092** — **unchanged, and it remains the irreversible purge** |
| **New API identifiers** | **none.** No identifier is created, renumbered or retired |
| **Counts** | **none.** API-001 … API-283 is unchanged |
| **Capabilities, scopes, owners, responses** | **none** |

**MP-A14-003.1 · The three acts stay three acts, and they are not collapsed again**

```
REQUEST-DELETION   API-247  CAP-084  SC-7   REVERSIBLE.  A school is
                                            marked for deletion and can be
                                            reactivated
ERASE-ACCOUNT      API-276  CAP-036         BREAK-GLASS.  A different act,
                                            on a different subject
PURGE              API-277  CAP-092         IRREVERSIBLE.  Only after the
                                            soft-delete and its cooldown

MAPPING A REVERSIBLE LIFECYCLE ACT ONTO EITHER OF THE OTHER TWO WOULD GIVE
IT A BREAK-GLASS OR AN IRREVERSIBLE CAPABILITY.  THAT IS THE ERROR THIS
AMENDMENT CLOSES.
```

**C-107 state after this amendment:**

```
TARGET SPECIFICATION RESOLVED   ── the target act, contract and capability
                                   are now unambiguous

IMPLEMENTATION OPEN             ── the legacy route STILL EXISTS
                                ── MP-B28 builds and switches the target
                                   behaviour and removes the legacy route
                                   after its proof
                                ── C-107 IS NOT IMPLEMENTATION-CLOSED BY
                                   THIS AMENDMENT
```
