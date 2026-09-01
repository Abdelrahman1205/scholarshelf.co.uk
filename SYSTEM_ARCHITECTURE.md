# SYSTEM_ARCHITECTURE.md — Stage 12: System Architecture

```
STAGE 12 — SYSTEM ARCHITECTURE
STATUS: LOCKED
Written: 25 August 2026
Locked: 29 August 2026 by the owner (BytHub Technology Ltd)
Owner decisions: AQ-1 — DECIDED B. Zero open owner questions.
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` · `TECH_STACK.md` — **all LOCKED**.

**Prototype evidence, read in full on 25 August 2026:**
`scholarshelf_executive_security_brief.pdf` — BYTE HUB TECHNOLOGY CORPORATE LTD, Legal & Regulatory
Compliance Department, 23 August 2026 · *Consolidated Executive Security & Architecture Audit Report*
— 14 domains, ~110 findings.

**System architecture only.** No folders, filenames, service or repository classes, component trees,
route definitions, endpoint URLs or verbs, request/response shapes, tables, columns, indexes, SQL, RLS
policy, foreign-key definitions, session-record schema, Argon2 parameters, MFA implementation, CSRF
implementation, rate-limit implementation, signed-URL durations, upload scanner selection, logging
field schema, deployment scripts, or migration ordering. **No code was written or changed.**

---

## 1. Purpose and evidence hierarchy

Stage 12 answers: **how are the locked modules, authority model and technologies arranged into one
coherent runtime system?**

### 1.1 The evidence hierarchy

```
LOCKED STAGES 1–11
→ authority for what ScholarShelf MUST become

CURRENT REPOSITORY / CURRENT BASELINE
→ evidence for what ScholarShelf IS now

CORPORATE AUDIT
→ evidence of defects and failure modes found in audited prototype revisions

LEGAL / COMPLIANCE BRIEF
→ organisational release constraint and remediation evidence
```

**The audit is evidence, not authority.** It cannot override Stages 1–11. Where it and the current
baseline disagree, §36 reconciles them explicitly — it does **not** silently prefer either.

### 1.2 The revision-sensitivity problem, stated precisely

The audit itself records the problem (**11.4**): *"The checked-out branch is five commits behind
`origin/main`, including changes to authentication, Stripe verification, migrations, console files,
and test-superuser behavior."*

Independently, `REBUILD_SAFETY.md` (Stage 0A, 23 August 2026) found the entire August restructuring
pass existing **only as an uncommitted working tree** — 115 paths, nothing pushed.

**Therefore three different ScholarShelfs existed on 23 August 2026:**

```
origin/main                 what deployed to production
the audited local checkout  five commits behind that
the uncommitted work tree   the restructuring pass, on neither
```

Some audit findings describe code that the restructuring pass had **already fixed but not committed**.
Others describe code that is **still exactly as the audit found it**. The only honest method is to
**re-verify each architecture-material finding against the current tree**, which §36 does.

### 1.3 Organisational release constraint

The Legal & Compliance brief of 23 August 2026 issues a **mandatory deployment halt / production
go-live block** — halt all production deployments and block live onboarding of school, child,
identity or financial data until all Critical and High vulnerabilities are remediated and legally
re-audited. It records **17 Critical, 52 High, 14 domains, 0% compliance clearance**, and requires
written legal re-evaluation plus a clean re-audit signed by both the Cybersecurity Director and the
Legal Department before any release candidate is authorised.

```
ORGANISATIONAL RELEASE CONSTRAINT

Stage 12 architecture approval
      ≠
production security clearance
      ≠
legal sign-off
```

**Stage 12 does not decide that ScholarShelf is production-ready, and does not clear the go-live
block.** It designs the target architecture. Whether remediation is sufficient is decided by security
re-audit and by BytHub's legal review — not by this document, and not by any later stage that merely
implements it.

**No legal conclusions are drawn here and no compliance claim is made.** Where the audit states
regulatory consequences, this document records that the audit states them; it does not adopt them as
findings of law.

---

## 2. Architecture principles

**SA-P1 — One coherent modular application.** Fifteen modules, one deployable application, boundaries
enforced inside it. **Module boundary is not deployment boundary** (Stage 8, locked).

**SA-P2 — The server is the authority boundary.** The browser requests; the server decides. Navigation
hiding is presentation (Stage 9 UX-P4), never enforcement.

**SA-P3 — A session proves continuity, not permission.** A session establishes *who is still signed
in*. It is never the authoritative snapshot of what they may now do.

**SA-P4 — One business fact, one owning module.** Others may read it; only the owner may change it.

**SA-P5 — Cross-module business acts are orchestrated, never reached around.** No module mutates
another's owned truth; no transport layer bypasses either.

**SA-P6 — Tenant isolation is defence in depth.** Never one predicate, never one layer, and never
dependent on every caller remembering.

**SA-P7 — An object identifier is a locator, never an authority.** Existence plus endpoint access is
not permission.

**SA-P8 — PostgreSQL owns transactions and authoritative concurrency.** Conditional writes,
constraints and transactions — not in-memory locks, not client locks, not a lock service.

**SA-P9 — Authoritative truth commits before any external consequence.** Email, notification delivery,
provider calls and analytics happen *after* the fact is true, and cannot change it.

**SA-P10 — Providers transport signals; modules interpret meaning.** A provider callback is untrusted
input, never a business fact.

**SA-P11 — Untrusted bytes are not trusted product data.** A completed upload is an *arrival*, not an
*acceptance*.

**SA-P12 — Durable truth never lives only in ephemeral compute.** Function memory and filesystem are
scratch. Nothing authoritative survives there.

**SA-P13 — Platform context is not null-tenant context.** Platform work is its own scope, never
"everything because no school was specified".

**SA-P14 — Reporting composes; it never owns.** MOD-010 may aggregate and project. It may not decide
lifecycle state.

**SA-P15 — A failure never becomes an empty, a zero, or a healthy.** The locked Stage 10 query-state
contract must remain expressible end to end.

**SA-P16 — The application runtime does not mutate schema.** Migration is a deployment input, not a
side effect of someone loading a page.

**SA-P17 — Source, schema, dependencies and configuration are one release state.** Production is not
trustworthy if they drift independently.

**SA-P18 — Processing boundaries are explicit.** UK/EU processing (TQ-1) is a topology property, not
an afterthought.

**SA-P19 — A declared control must map to a real implemented control.** Documentation, privacy text
and architecture never claim a guarantee the system does not enforce. (Audit **6.9**.)

**SA-P20 — Development and test substitutes never change business-integrity semantics.** Production
has exactly one persistence behaviour.

---

## 3. Architecture at a glance

```
                          ONE SCHOLARSHELF APPLICATION
                     ┌──────────────────────────────────┐
   BROWSER  ───────► │  TRANSPORT                       │
                     │     ↓                            │
                     │  AUTHENTICATION CONTINUITY       │
                     │     ↓                            │
                     │  LIVE AUTHORITY RESOLUTION       │
                     │     ↓                            │
                     │  AUTHORISATION                   │
                     │     ↓                            │
                     │  APPLICATION ORCHESTRATION       │
                     │     ↓                            │
                     │  OWNING MODULES  MOD-001…MOD-015 │
                     └──────────────┬───────────────────┘
                                    ↓
                        POSTGRESQL — authoritative state
                        business truth · durable jobs · audit · sessions
                                    ↓
              ┌─────────────────────┴──────────────────────┐
        OBJECT STORAGE          RESEND            ERROR TRACKING
        bytes only          delivery only       observation only
```

**Fifteen modules are logical boundaries inside one application.** They are not network services, and
nothing in this document makes them one.

---

## 4. Deployment and runtime topology

### 4.1 The topology

```
                    ┌──────────────────────────────────────────┐
                    │  BROWSER                                  │
                    │  SPA · presentation · non-authoritative   │
                    └───┬─────────────────────┬────────────────┘
                        │ /api/*              │ direct upload (signed)
                        ▼                     │
              ┌─────────────────────┐         │
              │  CDN / EDGE          │        │
              │  static SPA assets   │        │
              │  published CMS       │        │
              └─────────┬───────────┘         │
                        ▼                     │
              ┌──────────────────────────┐    │
              │  APPLICATION COMPUTE     │    │
              │  Express · one app       │    │
              │  UK/EU region [TQ-1]     │    │
              └──┬────────┬────────┬─────┘    │
                 │        │        │          │
                 ▼        ▼        ▼          ▼
          ┌──────────┐ ┌──────┐ ┌────────┐ ┌──────────────┐
          │POSTGRESQL│ │RESEND│ │ ERROR  │ │OBJECT STORAGE│
          │ Neon     │ │      │ │TRACKING│ │              │
          │UK/EU     │ │UK/EU │ │ UK/EU  │ │   UK/EU      │
          └────┬─────┘ └──────┘ └────────┘ └──────────────┘
               │  authoritative state · durable jobs · audit · sessions
               │
        ┌──────┴──────┐
        │  SCHEDULER  │  cron → "it is time"
        └─────────────┘  the work itself lives in the database
```

### 4.2 Deployment units

| Unit | What it is | Note |
|---|---|---|
| **SPA bundle** | Static assets on the CDN | No authority, no secrets |
| **Application compute** | One Express application | All authority decisions live here |
| **Public CMS delivery** | Rendered/static public path — **AQ-1 = B** (§5.1) | Published content only |
| **Background execution** | Platform-triggered, over durable PostgreSQL job records | No always-on worker |
| **Managed dependencies** | Neon · object storage · Resend · error tracking | Outside the authority boundary |

### 4.3 The answer

```
ONE SCHOLARSHELF APPLICATION
+
MANAGED EXTERNAL DEPENDENCIES
```

No microservices. No Kubernetes. No service mesh. No Kafka. No event bus. No saga. No distributed
transaction. **None of these appears anywhere in this document, and none is implied by any decision in
it.**

---

## 5. Application bands and the public surface

Stage 9 locked six surfaces. Architecturally they form **three bands** plus one public edge:

| Band | Surfaces | Scope basis | Runtime relationship |
|---|---|---|---|
| **Core** | S-1 Entry · S-2 School Operations · S-3 Family | tenant-pinned (S-2) / relationship-derived (S-3) | The same application, the same authority pipeline |
| **CMS** | S-4 Website Studio | tenant-pinned, website only | Same application; **no operational data reach** |
| **Platform** | S-6 BytHub Platform | platform scope, or one named school | Same application; **not "Core with a null school"** |
| **Public edge** | S-5 Public School Site | **published content only** | §5.1 |

### 5.1 Public CMS rendering

**What the public path must resolve, in order:**

```
public visitor
  → school resolution (by school code / domain)
  → CMS entitlement check           MOD-001 owns the entitlement fact
  → PUBLISHED content only          MOD-011 owns the content
  → Core school identity            MOD-001 owns identity
  → CMS website styling             MOD-011 owns presentation
```

**The public surface must never reach:** children · families · payments · stock · custody · staff
operations · support data · **draft CMS content**.

**This is a hard boundary, not a filter.** The public read path resolves a school and returns published
material; it does not carry an authenticated identity, and no authenticated capability is reachable
from it. An absent or unpublished site **fails safely to empty** and never discloses that the tenant
exists.

**Delivery is now decided. AQ-1 = B — DECIDED by the owner, 29 August 2026.**

```
SCHOLARSHELF — PRIVATE MANAGEMENT APPLICATION        React / Vite SPA, authenticated
      │
      │  WEBSITE STUDIO      no-code control plane, inside the authenticated application
      │  pages · news · events · media · public contact · presentation · PUBLISH
      ▼
PUBLISHED REPRESENTATION                              MOD-011 owns it
      ▼
PUBLIC SCHOOL WEBSITE                                 rendered / static delivery path
      │  home · about · admissions · classes · news · events · gallery · contact
      ▼
PARENTS · VISITORS · SEARCH ENGINES · PUBLIC INTERNET
```

**The authenticated ScholarShelf application remains a React/Vite SPA.** The optional public school
website uses a **rendered/static public delivery path**. These are two delivery shapes of **one
coherent ScholarShelf system** — not a second management application, not a second identity system,
not a second tenant database, not WordPress beside ScholarShelf, and not a microservice split.

**No framework migration.** ScholarShelf is **not** converted to Next.js or any other meta-framework,
and the authenticated application is **not** migrated to SSR. Stage 11's technology decisions stand
unchanged: React 19 · Vite 7 · Wouter · TanStack Query · Tailwind 4 · Radix/shadcn · Express 5 ·
PostgreSQL · Neon · Drizzle. **The physical implementation of the rendered/static public path is
Stage 13; deployment execution is Stage 21.** Stage 12 fixes the architectural relationship only.

**Private versus public — locked:**

| PRIVATE SCHOLARSHELF APPLICATION | PUBLIC SCHOOL WEBSITE |
|---|---|
| Admin · Finance · Teacher · Parent · Website Studio · BytHub Platform | Published school information and website pages |
| Authenticated · operational · authority-bearing | Unauthenticated · public · no operational authority |
| **Not publicly indexable** | **Indexable and shareable** |

### 5.2 Public website data allowlist

**The public website MAY consume, and only these:** published CMS pages · published CMS content ·
published news · published events · published **accepted** media · public contact information · Core
school name · Core school logo · permitted public identity · public CMS navigation · CMS public
website presentation/theme.

**The public website MUST NEVER receive:** children · guardian relationships · families · private
student information · payment information · settlement information · funding information · stock ·
allocations · custody · hand-over information · private staff records · support-mode data · platform
operational data · audit records · authentication or session data · **CMS drafts** · unpublished
media · private operational files.

**This is a structural boundary.** The architecture is **not**:

```
retrieve operational record → remove some fields → expose publicly     ✗ REJECTED
```

The public path consumes **deliberately published material only**. A field is not made public by
being stripped of its neighbours; it is public because it was published.

### 5.3 CMS management flow and explicit publication

```
AUTHORISED CMS USER → WEBSITE STUDIO → CREATE / EDIT → DRAFT → PREVIEW → PUBLISH
                                                                            ↓
                                                      PUBLIC DELIVERY → PUBLIC SCHOOL WEBSITE
```

**No code editing is required of the school.** School staff do not touch HTML, CSS, JavaScript, React,
Git, source code, Vercel or hosting configuration. Website Studio is the no-code control plane; the
public school website is the published output; application code remains BytHub-controlled.

**Publication is explicit.** Editing a draft does **not** change the public website. Normal CMS content
follows `DRAFT → PUBLISH → PUBLIC`, and public delivery reads **published material only**.

### 5.4 Entitlement and the Core identity wall

**MA-2 preserved.** **MOD-001** owns the *fact* that a school has CMS entitlement, and owns school
name, school identity and Core logo/identity facts. **MOD-011** owns website content, drafts,
publication, public website presentation, and CMS media/content functionality.

No entitlement → no Website Studio, no CMS operational capability, and **Core ScholarShelf remains
fully usable**. No subscription tables, pricing, billing mechanics, website plans or licence
infrastructure are invented here.

**CMS consumes permitted Core identity. CMS never becomes the owner of the school's Core identity.**

---

## 6. The server authority boundary

```
BROWSER              SERVER
requests      ──►    decides authority
displays      ◄──    returns only what was authorised
```

**The browser is never the authority for:** role · authority · tenant · scope · settlement · stock ·
custody · eligibility · support access · financial permission.

**Three consequences that are architectural, not stylistic:**

1. **Navigation hiding is presentation.** A screen absent from the menu is a discoverability decision.
   The server refuses it regardless (Stage 9 UX-P4).
2. **Client-side state is never authoritative.** The SPA's cache is a convenience; the server
   re-derives on every request that matters.
3. **Anything the browser sends is untrusted input** — including identifiers, tenant hints, statuses
   and amounts.

---

## 7. Authentication and session architecture

```
CREDENTIAL PROOF          → establishes an authenticated identity
   ↓
SESSION                   → proves authenticated CONTINUITY
   ↓ (per request)
LIVE AUTHORITY RESOLUTION → derives what this person may do NOW
```

**Session state is deliberately minimal and deliberately non-authoritative.** It answers *"is this
still the same signed-in person, and which context did they choose?"* — and nothing else.

Sessions are server-side in PostgreSQL (TD-019, locked), which is what makes revocation possible: a
revoked session is a deleted row, effective on the next request. Stage 16 owns the session record and
the revocation mechanics; Stage 12 fixes only that **revocation must be possible and must be
per-user**.

---

## 8. Live authority revalidation — session ≠ authority

**The audit finding (1.5, 1.6, 1.7, 1.8):** roles, school context, active context, MFA state and
selected permissions are cached in the session and not consistently revalidated; suspension, demotion,
permission revocation and password reset do **not** invalidate sessions; and session records are not
structured for per-user revocation.

**Current baseline, verified 25 August 2026 — this is partly fixed and partly not.**

```
VERIFIED REVALIDATED PER REQUEST
   school existence          → fresh read
   school lifecycle status   → suspended / archived / pending_deletion / deleted
                               → session destroyed, cookie cleared, refusal audited

VERIFIED NOT REVALIDATED PER REQUEST
   the account's own active/disabled state
   the account's role grants        → read from session, set at sign-in
   the account's authorities
   staffing and guardian relationships (derived at sign-in for context availability)
```

So a **suspended school** cannot continue. A **demoted or disabled administrator** currently can, for
the life of their session.

### 8.1 The architectural rule

```
SESSION
→ proves authenticated continuity

SESSION
≠ authoritative current permission snapshot
```

**It must be architecturally impossible to reason:** *"the session said admin yesterday, therefore
admin forever."*

### 8.2 What must be revalidatable, because it can lapse

```
account active state            role grants
school active state             authorities (incl. AUTH-FINANCE)
staffing (CD-2)                 guardian relationships (CD-3)
support engagement (CD-6)       MFA / elevation state (CD-7)
```

Every one is a **live fact with an owner**, and every one is already modelled that way in Stage 6 and
Stage 7. The architecture requires that authorisation reads them as live facts — not that it reads
them at a particular frequency, by a particular mechanism, or with a particular cache.

**Stage 16 owns the mechanics** — revalidation frequency, caching windows, revocation propagation and
the session record. Stage 12 owns only the prohibition: **a cached authority claim may never be the
sole basis for a sensitive decision.**

### 8.3 Revocation must be possible per user

Audit 1.8 is architecturally material: without a reliable way to enumerate a user's sessions, an
administrator who suspends an account **cannot actually end its access**. The architecture therefore
requires that sessions be **attributable to a user and terminable as a set**. Representation is Stage
15; mechanics are Stage 16.

---

## 9. Authorisation architecture

A conceptual **authorisation layer** sits between authentication and every use case. It evaluates the
locked Stage 7 model and returns one answer.

```
PERSON
  → ACTIVE CONTEXT           which surface and navigation
  → ACTIVE AUTHORITIES       AUTH-SCHOOL · AUTH-FINANCE · AUTH-TEACH
                             AUTH-FAMILY · AUTH-CMS · AUTH-PLATFORM · AUTH-BREAKGLASS
  → CAPABILITY               CAP-001 … CAP-095
  → RESOURCE                 the specific thing being acted on
  → SCOPE                    SC-1 … SC-12
  → CONDITIONS               CD-1 … CD-12
        ↓
    ALLOW / DENY
```

**It must evaluate current authoritative facts** where the condition depends on one (§8).

**It must not decide primarily on:**

```
✘ a role string           ✘ a route or endpoint name
✘ UI visibility           ✘ an optional schoolId that may be absent
```

**Capability-keyed, not role-keyed.** This is the architectural target for **C-40**: today
`requireRole(...)` compares the active context against a list of role strings. The target evaluates a
capability against a resource under a scope and conditions. Stage 13 and Stage 16 own how.

**Authentication proves identity. ScholarShelf owns authorisation** — locked at TQ-2, and unchanged
here.

---

## 10. Tenant isolation — defence in depth

### 10.1 The finding that matters most

**Audit 1.9** — tenant scoping is optional in core storage methods. **Verified STILL PRESENT in the
current tree**, in the signature itself:

```
schoolFilter(table, schoolId?)
    schoolId is a string   → WHERE school_id = $1
    schoolId is absent     → returns undefined
                           → NO WHERE CLAUSE
                           → every tenant
```

**This is fail-open by design of the signature.** Isolation depends on ~305 storage methods each being
called correctly, forever, by every future route. One omission, one null context, one owner-support
transition, and the query spans the platform.

**The choke point mitigates but does not remove it.** `ensureSessionSchoolIsActive` now refuses a
tenant-scoped session with no school — a genuinely good fix, verified present, and one this
architecture **preserves**. But it guards *sessions*, not *call sites*: a platform-owner path, a
background job, or a route that passes `undefined` still reaches the fail-open branch.

### 10.2 The target — four independent boundaries

```
AUTHENTICATED CONTEXT
        ↓                    1. the choke point: no tenant-scoped session without a school
RESOURCE / TENANT OWNERSHIP PROOF
        ↓                    2. this resource belongs to this tenant — proven, not assumed
MODULE-SCOPED DATA ACCESS
        ↓                    3. tenant scope is structural in the data-access surface,
                                not an optional argument
DATABASE TENANT INTEGRITY
                             4. the database rejects what the application should never have asked
```

**Tenant isolation ≠ one WHERE clause.** Each boundary must fail closed independently, and no single
one is the whole defence.

### 10.3 The rule that replaces the fail-open signature

```
TENANT SCOPE IS NOT AN OPTIONAL ARGUMENT.

Data access is either explicitly tenant-scoped, or explicitly and
deliberately platform-scoped. There is no third shape, and absence
never means "all tenants".
```

Platform-scoped access exists (SC-7, tenant metadata) — but it is **named, deliberate and separate**,
never the accidental result of a missing parameter. This is **SA-P13** expressed as a data-access rule.

### 10.4 Database-level tenant integrity

The audit recommends PostgreSQL RLS (**3.1**), and reports that **23 of 26** tenant tables lacked a
foreign key to `schools` (**3.2**), **19 of 26** permit a null `school_id` (**3.3**), and cross-tenant
relational integrity is not enforced by composite keys (**3.4**).

Stage 0 verified that the restructuring pass added **76 foreign keys and 42 indexes**, so 3.2 is
**partially remediated**. The nullable-tenant and composite-integrity findings are **not**.

**Stage 12's statement — and it deliberately stops short of a mechanism:**

> **Tenant isolation must not depend solely on application callers remembering tenant predicates.**
> Stage 15 and Stage 16 must select and implement database-level tenant-integrity protections
> sufficient to make cross-tenant records structurally difficult or impossible.

**Candidates to be evaluated together, not chosen here:** row-level security · non-null tenant
ownership where the concept genuinely belongs to one tenant · tenant-aware composite foreign keys ·
module-scoped data access. **No policy is written and no mechanism is pre-selected** — the locked
architecture does not uniquely require one, and choosing blind would pre-empt Stage 15.

---

## 11. Resource ownership — BOLA / IDOR prevention

**Audit 1.10** — routes operate on request-supplied student, payment, class, basket, allocation and
user identifiers without consistently proving the target belongs to the authenticated tenant and
relationship.

**Never:**

```
user can reach endpoint  +  object ID exists  →  access
```

**Always:**

```
CAPABILITY + RESOURCE + RESOURCE OWNERSHIP + SCOPE + CONDITIONS  →  decision
```

**SA-P7: an object identifier is a locator, never an authority.** Ownership is *proven* against the
active context before the operation, not inferred from the fact that a row came back.

This applies with equal force to the three relationship-derived scopes, because in each the
"ownership" is a live relational fact:

```
SC-3  teacher  → active staffing ∩ active class membership
SC-4  family   → an active guardian relationship to THIS child
SC-6  support  → the ONE school named in an active engagement
```

---

## 12. Family, teacher, school and platform contexts

**Four scope bases, never collapsed:**

| Context | Scope basis | Architectural consequence |
|---|---|---|
| **School** | Tenant-pinned (SC-1) | Every operation carries and validates one school |
| **Family** | **Relationship-derived (SC-4)** | **No tenant pin.** Crosses schools freely |
| **Platform** | Platform scope (SC-7) | Tenant metadata and platform state — **never operational or child data** |
| **Support** | One named school (SC-6) | A bounded engagement, not a global key |

### 12.1 Family cross-school architecture

```
ONE FAMILY ACCOUNT
  → CHILD A / SCHOOL A
  → CHILD B / SCHOOL B
```

**No global tenant selector.** Each operation derives and validates its target school **through the
child and the active guardian relationship**. A family account has no "current school" to get wrong,
because it never has one.

### 12.2 Teacher scope

```
ACTIVE STAFFING (SC-2)  ∩  ACTIVE CLASS MEMBERSHIP (SC-3)
```

Resolved identically on every teacher path. **No school-wide teacher data access exists in the target
architecture.** Stage 9's handheld-first presentation changes nothing about server enforcement.

### 12.3 Administrator + AUTH-FINANCE

```
school_admin context  +  AUTH-FINANCE  →  finance work available, same context
```

**No finance mode. No second authentication. No context switch.** PA-1, locked. Architecturally this
means the authorisation layer evaluates **authorities within the active context** — it does not switch
contexts to reach a capability.

### 12.4 Platform is never a null tenant

```
✘  schoolId = null  →  global access
✔  platform scope   →  tenant metadata and platform state, named and bounded
```

**SA-P13.** This is the same defect as §10.1 seen from the other side, and it is why the choke point's
refusal of null-school tenant sessions is preserved as an invariant.

---

## 13. Module interaction

```
MODULE A  may request facts or capabilities from MODULE B
MODULE A  may NOT directly mutate MODULE B's owned truth
```

Cross-module business acts run through **explicit application orchestration** (§15) — never by one
module writing into another's tables, and never by a route reaching around both.

### 13.1 Three dependency kinds, kept distinct

```
OWNERSHIP DEPENDENCY     B owns a concept A's concept refers to
READ DEPENDENCY          A needs a fact B owns, and only reads it
ORCHESTRATION DEPENDENCY neither owns the act; the application sequences both
```

Stage 8 resolved the apparent MOD-002 ↔ MOD-003/004 cycle by exactly this distinction — a data
dependency is not a guard applied at a boundary. That resolution is preserved.

### 13.2 Module dependency map

```
                     MOD-013 AUDIT ◄──────── (attribution from everything)
                     MOD-014 SCHEDULED WORK ─┐
                     MOD-015 DELIVERY/INTEGRATION ─┐  infrastructure
                                                    │
  MOD-001 TENANCY & CONFIG ◄──── entitlement ──── MOD-011 CMS (optional)
      ▲
      │ school active, policy
      │
  MOD-002 IDENTITY ──► MOD-003 ACADEMIC ──► MOD-004 CHILDREN & FAMILIES
      │  (guard at a boundary)  ▲                    ▲
      │                         │ class membership   │ child, guardian
      │                    MOD-006 CYCLE & REQUIREMENTS
      │                         ▲            ▲
      │            settlement ──┘            └── MOD-005 CATALOGUE & INVENTORY
      │        MOD-007 SETTLEMENT ◄──── I-2 ────► MOD-008 FULFILMENT & CUSTODY
      │                    │                            │
      │                    └────────► MOD-009 COMMUNICATION
      │                                     │
      └─────────────────────────────────────┴──► MOD-010 REPORTING  ── LEAF
                                                  reads everything, owns nothing

  MOD-012 PLATFORM OPERATIONS ── separate band, reaches Core only through
                                 a named support engagement (SC-6)
```

**No cycles.** MOD-010 is a leaf with no outbound ownership. MOD-015 faces outward only.

---

## 14. Business-truth ownership

| Module | Owns |
|---|---|
| **MOD-001** | Tenant existence and lifecycle · school policy · school identity · **CMS entitlement** |
| **MOD-002** | Accounts · role and authority grants · invitations · sessions-as-identity |
| **MOD-003** | Classes · subjects · class staffing · class membership |
| **MOD-004** | Children · families · guardians · guardian relationships · linking codes |
| **MOD-005** | Catalogue · bundles · physical copies · **stock and stock movement** |
| **MOD-006** | Book-supply cycle · requirement items and lines · overrides |
| **MOD-007** | **Settlement** · money events · payment applications · funding adjustments · charge decisions |
| **MOD-008** | **Allocation · custody · hand-over · fulfilment route · exceptions · returns** |
| **MOD-009** | **Notification truth** · message threads |
| **MOD-010** | **Nothing.** Composes and projects only |
| **MOD-011** | Website configuration · sections · drafts · publication · media · presentation |
| **MOD-012** | Support engagements · platform state · console operation records |
| **MOD-013** | **Audit events** |
| **MOD-014** | Job runs |
| **MOD-015** | **Delivery attempts** and integration results |

**One business fact, one owner.** Two modules never both decide the same thing.

---

## 15. Application orchestration

**Audit 10.2 and 10.4** — business rules, data access, email, authorisation interpretation and state
transitions are mixed directly inside route handlers, and new service layers exist beside legacy paths
that still bypass them.

### 15.1 The layers

```
TRANSPORT                 parse the transport concern; nothing else
    ↓
AUTHORISATION             §9 — allow or deny
    ↓
APPLICATION ORCHESTRATION coordinate · own the transaction scope · sequence module operations
    ↓
OWNING MODULE OPERATIONS  each module's own truth, changed only by its owner
    ↓
PERSISTENCE / EXTERNAL EFFECTS
```

**The orchestration layer coordinates. It does not own domain truth.** It is where I-2 lives (§17),
because I-2 spans three modules and belongs to none of them.

### 15.2 Routes do not own business logic

```
ROUTE / TRANSPORT
  → parse the transport concern
  → invoke an authorised use case
  → map the outcome to HTTP

NOT
  → calculate settlement · change stock · send email
  → build audit records · query arbitrary tables
```

### 15.3 Client input is not a domain command

**Audit 1.11** — broad request-body objects reach storage and business operations without per-route
field allowlists.

```
CLIENT INPUT        ≠        DOMAIN COMMAND
untrusted transport          explicitly accepted business inputs
```

A transport payload is **translated** into explicitly accepted inputs before it reaches an owning
module. Server-controlled properties — tenant ownership, lifecycle state, status, role fields, pricing,
stock — are **never** settable from a request body. Stage 14 defines the contracts; Stage 16 owns
validation mechanics. **No schema is defined here.**

### 15.4 Data access follows module ownership

**Audit 10.3** — some route modules import Drizzle tables and run ORM queries directly. **Verified
STILL PRESENT: five route files import `drizzle-orm` directly.**

```
TRANSPORT   ─X─►   arbitrary persistence
```

Cross-module use cases **orchestrate module-owned operations**; they do not reach past them. This is
the Stage 12 architectural target for **C-42**; Stage 13 owns the physical structure.

---

## 16. Read versus command

```
READ                              COMMAND
authorise                         authorise
   ↓                                 ↓
scoped read / composition         revalidate current authoritative facts
   ↓                                 ↓
return facts                      TRANSACTION
                                     ↓
                                  authoritative state / event
                                     ↓
                                  COMMIT
                                     ↓
                                  asynchronous consequences become ELIGIBLE
```

**This is a discipline, not an infrastructure.** **No CQRS technology, no read models, no event
sourcing, no separate read database** is introduced. The distinction exists so that commands always
revalidate and always commit before anything external happens (SA-P9).

### 16.1 Who owns a command — precise statement

*Corrected wording, owner review, 29 August 2026. An earlier short-form phrasing — "commands are owned
by exactly one module" — was too broad: it is true of a business fact, but not of a business act that
spans modules. **SA-P4 is unchanged.** This states the command model precisely.*

```
SINGLE-MODULE MUTATION
    → the OWNING MODULE owns the business mutation

CROSS-MODULE BUSINESS ACT
    → the APPLICATION ORCHESTRATION LAYER coordinates the act
    → every underlying business fact remains mutated ONLY by its owning module

READ PATH
    → never mutates
```

**Worked example — confirm settlement (I-2), a cross-module use case.** Application orchestration
coordinates MOD-007 settlement, MOD-008 allocation and MOD-005 stock movement. **Each module owns its
own business fact.** The orchestration layer owns **sequencing and transaction scope** — and nothing
else. It holds no business truth of its own, and it never mutates another module's fact directly.

This is the exact reading of SA-P4 (*one business fact, one owning module*) applied to acts rather
than facts. It changes no locked decision; it removes an ambiguity in how the model was summarised.

---

## 17. I-2 — the atomic transaction

**Locked by Stage 8, confirmed by MA-1, re-confirmed at Stage 11, and not weakened here.**

```
CONFIRM SETTLEMENT

  MOD-007  settlement decision
     +
  MOD-008  allocation
     +
  MOD-005  stock movement

  ONE APPLICATION PROCESS
  ONE POSTGRESQL TRANSACTION
  ONE COMMIT

  ALL SUCCEED        or        ALL ROLLBACK
```

### 17.1 Explicitly forbidden in the settlement path

```
✘ a queue between any two of the three writes
✘ an asynchronous continuation completing stock later
✘ a provider callback completing allocation
✘ a saga, a compensating transaction, an event bus
✘ a distributed transaction across services
✘ eventual consistency of any kind
```

Changing this requires a **traceable owner amendment to Stage 8's invariant itself** — Stage 11's
locking discipline already records that, and Stage 12 does not soften it.

### 17.2 The three impossible states

```
✘ settled but not allocated
✘ allocated but stock not moved
✘ stock moved but not settled
```

None of these is reachable, because none of the three writes can commit without the others.

### 17.3 What may follow — after the commit

```
COMMIT
  ↓
notification truth (MOD-009)  ── may be written INSIDE the same transaction
  ↓                              because it is a business fact, not a side effect
DELIVERY becomes eligible (MOD-015) ── AFTER commit, never inside it
```

**Email is never inside the transaction.** A provider call inside a transaction holds a database
transaction open across a network round trip and makes failure ambiguous.

### 17.4 Audit reconciliation for the payment race

**Audit 4.1, 4.2, 4.4** report a reproducible payment-confirmation race with duplicate allocations and
double stock deduction, and non-atomic transitions across payment, order, allocation, stock,
verification and audit.

**Current baseline (Stage 0, verified):** the confirmation path is a single transaction using a
**conditional `UPDATE … WHERE status NOT IN (…) RETURNING *` claim-lock** — exactly the shape that
makes a concurrent second confirmation return zero rows and do nothing.

**Classification: REMEDIATED — PRESERVE AS AN ARCHITECTURAL INVARIANT** (SAR-012). **No new conflict is
raised**, because the current baseline does not exhibit the defect.

**But the architecture must make regression structurally difficult**, which is what §15's orchestration
layer and §18's connection rule are for: the transaction boundary belongs to a named orchestration
step, not to whichever route handler happens to run.

---

## 18. Database connection and concurrency architecture

### 18.1 The transaction-capable path

Stage 11 locked the constraint; Stage 12 makes it a topology rule.

```
ORDINARY SIMPLE READ / SINGLE WRITE
   → any supported database path

MULTI-STATEMENT ATOMIC BUSINESS ACT   (I-2, and every command in §16)
   → A TRANSACTION-CAPABLE POSTGRESQL CONNECTION IS REQUIRED
```

**Neon HTTP single-statement mode is not a valid I-2 transaction path.** Audit **3.13** independently
records that access is split across incompatible drivers with differing transaction behaviour — which
is the same fact seen as a defect.

**Architectural requirement:** it must not be *possible* for an atomic business act to run on a
connection that cannot hold a transaction. **How that is guaranteed is Stage 13.** No connection helper
is designed here.

### 18.2 Connection pressure

Audit **3.14** records multiple pools per instance; Stage 11 verified the platform's **1,024 shared
file descriptors**. The architecture requires that connection acquisition be a **deliberate,
bounded property of the application**, not an emergent one. Stage 13 owns the mechanism.

### 18.3 PostgreSQL is the concurrency authority

```
PREFER                              REJECT
conditional write                   in-memory lock
unique constraint                   browser-side guard
transaction                         distributed lock service
row / record claim                  advisory coordination outside the database
```

**Two canonical examples:**

```
two concurrent settlement confirmations
  → one conditional claim succeeds
  → the other affects zero rows and produces NO second effect

two executors reach the same due job
  → one claims it atomically
  → the other finds nothing to claim
```

**SA-P8.** In a serverless runtime with no shared memory, this is not a preference — an in-memory lock
is simply not a lock.

---

## 19. Reporting, search and read composition

### 19.1 Reporting is a leaf

```
MOD-010 MAY          aggregate · project · compare · count
MOD-010 MAY NOT      decide authoritative state
```

**Never:**

```
✘ Reporting says settled  →  therefore fulfil
✔ Fulfilment asks MOD-007 →  MOD-007 answers
```

This is **C-45**'s architectural target: dashboards and reports independently re-derived payment
lifecycle counts and collected payments vanished from revenue. The fix is not a better query — it is
that Reporting **asks the owner** rather than recomputing.

### 19.2 Read composition

Stage 9 screens compose several modules (UX-019 composes seven). A **read-composition layer** is
permitted:

```
AUTHORISED SCREEN QUERY
  → collect facts from each owning module, within scope
  → shape one response
```

**It does not become new truth**, it publishes no status of its own, and it is subject to the same
authorisation and scope as any other read. **No GraphQL, no BFF service, no separate API tier** is
introduced.

### 19.3 Search

```
SEARCH REQUEST
  → AUTHORISATION / SCOPE resolution
  → scoped PostgreSQL query
  → results
```

**Never** global retrieval followed by application- or client-side filtering — that is a tenant leak
with a filter in front of it. Scope is applied *in the query*, not after it. No index is designed here
(Stage 15).

---

## 20. Object storage and the upload trust boundary

**Audit 7.1–7.6, 7.9** — client MIME trust · SVG active-content risk · unscanned PDFs · base64 storage
in PostgreSQL · full inline payloads in list responses · no tenant quota · a publicly mounted
`/uploads` path.

**Verified in the current tree:** binary assets **are** stored as base64 data URIs in Postgres, and
`/uploads` **is** still mounted as a public static path.

### 20.1 Byte arrival is not acceptance

```
UNTRUSTED BYTES ARRIVE
        ↓
UNACCEPTED / PENDING OBJECT        not referenced by any product record
        ↓                          not publicly reachable
VALIDATION / SECURITY CHECKS       signature, type, size, content handling
        ↓
APPLICATION FINALISATION           the application decides to accept
        ↓
TRUSTED PRODUCT REFERENCE          now, and only now, a product fact
```

**SA-P11.** A successful upload means bytes arrived. It does not mean they are product content.
**Stage 16 decides the exact scanning and sanitisation.**

### 20.2 Direct object upload

```
BROWSER
  → asks the application for upload authority
APPLICATION
  → authenticates · authorises · scopes to the tenant
  → issues a temporary, bounded storage permission
BROWSER
  → uploads DIRECTLY to object storage
APPLICATION
  → finalises: validates, accepts, and creates the product reference
```

**Large media never travels through the application's request body.** This removes the verified 4.5 MB
platform limit from the path entirely — and removes **C-57**, where the application's own 5 MB and
8 MB caps exceed what the platform will carry.

### 20.3 Public versus private objects

| Class | Reachability |
|---|---|
| **Published CMS media** | Publicly / CDN-deliverable **after acceptance and publication** |
| **Private operational files** | Authorised access only |
| **School identity assets** | According to their use — application chrome, communications, documents |
| **Pending / unvalidated uploads** | **Never automatically public** |
| **Draft CMS media** | Not public until published |

**Bucket layout and signed-URL durations are not chosen here** (Stage 16/17).

### 20.4 The legacy public `/uploads` path

```
CURRENT   a runtime directory mounted publicly, with no authorisation in front of it
          → LEGACY / REVIEW REQUIRED

TARGET    durable product files are served through the deliberately designed
          object-storage acceptance / publication / access architecture —
          never because a directory happens to be publicly mounted
```

Audit 7.9's threat is precise: *any* file written there by future or overlooked code becomes public.
Removal is Stage 22. **Recorded as C-68.**

---

## 21. Spreadsheet and import architecture

```
UNTRUSTED XLSX
      ↓
SIZE / INPUT BOUNDARY        ← limits apply HERE, at the trust boundary
      ↓
SERVER-SIDE PARSE            ← never in the browser
      ↓
VALIDATION                   ← parser success is not business validity
      ↓
PREVIEW / ERRORS             ← the human sees what will happen
      ↓
EXPLICIT COMMIT              ← a deliberate act, not a consequence of uploading
      ↓
BUSINESS CHANGES
```

**Two rules the audit makes non-negotiable:**

**Audit 7.7 — compressed expansion.** Row and column limits are applied *after* the parser has fully
expanded the workbook, so a small compressed file can exhaust memory first. **Input-resource limits
must exist before or at the parsing boundary, not only after expansion.** Mechanics are Stage 16.

**Audit 7.8 — the parser itself.** Stage 11 locked vendored SheetJS 0.20.3+, server-side only. Stage 12
adds the architectural consequence: **the parser runs inside the trusted application boundary on
untrusted input**, so it is a trust boundary in its own right and is treated as one.

**Verified current defect:** `xlsx` is imported by a **client** page, shipping a parser with known
advisories into the browser bundle. Stage 11 already decided its removal from the client; Stage 12
records that browser-side parsing of untrusted workbooks is **not part of the target architecture**.

---

## 22. Notification and delivery

**Audit 8.2, 8.3** — no transactional outbox; database mutations and email dispatch are independent;
and sends have no durable unique-send constraint.

```
BUSINESS EVENT
      ↓
MOD-009 creates DURABLE NOTIFICATION TRUTH   ← a product fact
      ↓
COMMIT                                        ← the fact is now true
      ↓
DELIVERY WORK BECOMES ELIGIBLE                ← after commit, never before
      ↓
MOD-015 / Resend attempt
      ↓
DELIVERY RESULT                               ← a transport fact, recorded separately
```

### 22.1 The two rules

```
1.  A DELIVERY FAILURE CANNOT ERASE THE NOTIFICATION FACT.

    Under WF-071 that fact may be "this family now owes money".
    Losing it because an email bounced is losing business truth.

2.  ONE BUSINESS NOTIFICATION  →  MANY DELIVERY ATTEMPTS

    RETRY  ≠  NEW BUSINESS NOTIFICATION
```

This is **C-46**'s architectural target. Uniqueness keys and retry policy are **Stage 15 and Stage 17**.

### 22.2 Notification truth may be written inside the business transaction

Because a notification is a **product fact owned by MOD-009**, it may be created inside the same
transaction as the event that caused it — which is what makes "notified for a rolled-back operation"
(audit 8.2) impossible. **Delivery** is never inside it.

---

## 23. Durable jobs and scheduling

### 23.1 The three separate things

```
CRON        answers  "when should this start?"
JOB RECORD  answers  "what durable work exists?"
EXECUTOR    answers  "who is performing it, and did it finish?"
```

### 23.2 The flow

```
BUSINESS OPERATION  or  SCHEDULER
      ↓
DURABLE WORK BECOMES ELIGIBLE        a record in PostgreSQL
      ↓
EXECUTOR CLAIMS IT ATOMICALLY        conditional write; one winner (§18.3)
      ↓
BOUNDED EXECUTION                    within the platform's execution limits
      ↓
RESULT RECORDED                      success, failure, or partial with what remains
      ↓
RETRY IF NECESSARY                   from the durable record, not from memory
```

**No in-memory job state. No external broker.** (TD-026, locked.)

### 23.3 Cron firing twice must be harmless

```
CRON fires twice for the same due work
  → the first execution claims it
  → the second finds nothing to claim
  → NO duplicate effect
```

**Audit 8.5** reports `cron_job_runs` declared in schema and migrations but never read or written by
the active handler. **Verified in the current tree: the cron handler now carries a wall-clock drain
budget and references run identity** — partially remediated (SAR-021).

### 23.4 The digest — C-30's architectural target

**Audit 8.4** — the daily job processes schools, users, queries and external email calls **serially**
inside one bounded invocation, so a larger deployment times out after emailing only part of the user
base. **Verified: the current handler has a 24-second drain budget and logs when it runs out with
schools remaining** — which converts a silent partial run into a visible one, but does not make the
remainder durable.

```
TARGET

DIGEST DUE
   ↓
DURABLE WORKLOAD                  what is owed, recorded
   ↓
TENANT-SCOPED EXECUTION           one school's work is one unit
   ↓
DURABLE NOTIFICATION FACTS        MOD-009, per recipient
   ↓
INDEPENDENT DELIVERY ATTEMPTS     MOD-015, retryable per notification
```

**A school not reached is a school still owed**, recoverable on the next invocation. Scale thresholds
are **Stage 18**.

---

## 24. CMS studio and public architecture

```
CMS STUDIO (S-4)  owns   drafts · publication · CMS content · website presentation
PUBLIC SITE (S-5) gets   PUBLISHED CMS CONTENT  +  CORE SCHOOL IDENTITY
                         and nothing else
```

### 24.1 Entitlement

```
MOD-001  owns the fact that a school is entitled to the CMS   [MA-2, locked]
MOD-011  owns CMS functionality and data

NO ENTITLEMENT
  → no CMS Studio surface
  → no CMS operational capability
  → nothing in Core changes
```

**No billing, licensing, pricing or feature-flag mechanism is designed** — MA-2 locked that entitlement
is the bare fact.

### 24.2 The identity wall

```
CORE owns      school name · logo · application identity
CMS consumes   those facts
CMS does NOT   become the authority for school identity
```

### 24.3 The operational wall

The CMS band reaches **no** operational data: children · families · settlement · stock · custody ·
staff · support. This is a **structural** boundary — AUTH-CMS carries no operational authority, so
those capabilities are not reachable, not merely hidden.

---

## 25. Platform, support and break-glass

**Four distinct things that must never be treated as equivalent:**

```
NORMAL PLATFORM OPERATION      tenant metadata, lifecycle, onboarding, health   (SC-7)
SUPPORT MODE                   one named school, bounded, attributed            (SC-6)
BREAK-GLASS APPLICATION OP     exceptional, elevated, time-boxed, alerted
DATABASE ADMINISTRATION        outside the application entirely (§26)
```

### 25.1 Support mode

```
PLATFORM CONTEXT
      ↓
NAMED SUPPORT ENGAGEMENT           one school · a stated reason · a start time
      ↓
SCHOOL-SCOPED SUPPORT AUTHORITY    SC-6 — that school, nothing else
      ↓
AUTHORISED SUPPORT OPERATION       every act still evaluated by §9
      ↓
ATTRIBUTABLE OUTCOME               MOD-013 records who, what, and under which engagement
      ↓
EXIT                               the scope lapses
```

**No invisible universal bypass exists.** There is no path from platform authority to a school's
operational data that does not pass through a named engagement — and **PA-2** locks that account
recovery is inside an engagement too.

### 25.2 Break-glass

Owner-only (AUTH-BREAKGLASS), elevated authentication (CD-7), time-boxed, reasoned, alerted and
attributed. **Never reachable as a routine platform action.** Stage 16 owns the elevation mechanics.

---

## 26. The privileged database-administration boundary

**Audit 5.1–5.6** — a web-accessible arbitrary SQL console using the general application database
role; a direct row-update endpoint deriving SQL identifiers from request-body keys; a school wipe
exposed over HTTP behind a boolean; and a non-transactional hard deletion. The Legal brief's **Phase A**
requires blocking or removing the console endpoint and direct database updates from the HTTP surface
within 72 hours.

### 26.1 Current baseline — substantially reworked, with one caveat

**Verified in the current tree:** the console is now three-tiered, with a separate least-privilege
read connection, `BEGIN READ ONLY`, extended-protocol parameter binding that prevents multi-statement
injection, database **views that exclude `password_hash`, `mfa_secret` and `token_hash`**, an
always-`ROLLBACK` read tier, a break-glass tier requiring TOTP, a reason, a 15-minute window and
alerts — and the **PATCH and DELETE row endpoints have been removed** as an unfixable injection.

**The caveat is architecturally decisive.** All of it depends on `migrations/001_console_hardening.sql`
creating the constrained roles and views — **and CI deliberately skips `001`**. If that migration is
not applied in production, the hardened path cannot connect, and the environment schema simply reports
the console as unavailable. **The controls exist in code; whether they exist in the running system is
not established.** Recorded as **C-73** and **SAR-016**.

### 26.2 The architectural rule

```
✘  owner authenticated  →  arbitrary production SQL through the ordinary web application
```

**Does arbitrary SQL belong in the target application at all?** The locked stages answer this, so it is
not an owner question: Stage 7 locks **CAP-089 `run_readonly_query`** (AUTH-PLATFORM, SC-6, CD-6) and
Stage 9 gives it **UX-098**. The product genuinely needs bounded read-only investigation inside a
support engagement.

**What is locked, therefore:**

```
BOUNDED READ-ONLY INVESTIGATION     is a product capability — CAP-089, scoped by SC-6 and CD-6
ARBITRARY SQL WITH APPLICATION      is NOT in the target architecture
  DATABASE PRIVILEGE
```

The distinction is **privilege**, not syntax. A read-only capability enforced by database grants,
read-only transactions and credential-excluding views is a different thing from a text box that
inherits the application's write privileges. **Regex filtering of SQL is not a control** — the current
code's own commentary demonstrates why, and Stage 12 adopts that conclusion.

**Database administration proper — schema changes, role management, recovery — is outside the
application.** Not a hardened endpoint: **outside**. Stage 16 and Stage 21 own operational access.

### 26.3 Destructive tenant operations

```
EXPLICIT EXCEPTIONAL OPERATION       never a row action, never a routine control
+ STRONG AUTHORITY / ELEVATION       AUTH-BREAKGLASS, CD-7, CD-12 cooldown
+ PRECONDITIONS PROVEN               no unresolved financial or distribution state
+ TRANSACTIONAL / CONTROLLED         audit 5.6: a long sequence of independent deletes
                                     leaves a tenant half-erased with no rollback
+ AUDIT                              MOD-013, attributable
+ FAILURE RECOVERY STRATEGY          what happens if it fails part-way is designed, not discovered
```

**Audit 6.2, 6.3, 6.4** additionally report that the deletion blockers call the wrong argument — a
school id interpreted as a parent id, and as a class id — so active payments and pending distributions
can be missed entirely. Architecturally: **preconditions must be proven by the owning modules**
(MOD-007 for financial state, MOD-008 for distribution state), not inferred by a caller passing an
identifier into a differently-shaped query. **The exact workflow is Stage 16/21/22.**

---

## 27. Audit versus technical logging

```
TECHNICAL LOG                      AUDIT EVENT  (DM-053, MOD-013)
operational                        a product fact
structured                         durable
redactable                         attributable
disposable                         retained
for engineers                      for the school, the owner, and a regulator
```

**These are never the same record and never the same system.**

### 27.1 Correlation

```
REQUEST
  → correlation identifier
      → technical logs
      → error tracker
      → the opaque support reference the user may be shown  (DESIGN_SYSTEM §16.3)
```

Without this, the locked Stage 10 error contract is undeliverable — a user could quote a reference and
there would be nothing to look it up in (**C-62**). **No identifier format is defined here.**

### 27.2 Audit coupling

**Audit 10.7** — audit records lack immutability, tamper evidence, consistent tenant identifiers and
guaranteed transactional coupling.

**Which acts require the audit event to share the business outcome's fate:**

```
SAME-TRANSACTION COUPLING REQUIRED

  settlement confirmation and rejection      allocation and custody transfer
  hand-over                                  funding, discount, waiver, refund
  replacement charge decision                corrections of any kind
  role and authority grants                  support engagement entry and exit
  break-glass elevation and writes           tenant lifecycle changes
```

For these, **an outcome without its attribution is not an acceptable state.** For routine reads and
non-consequential actions, best-effort audit is sufficient. **Stage 19 owns the mechanics and the
record.**

---

## 28. Error and query-state architecture

**Audit 1.13** — approximately 160 route-level handlers return `e.message` directly to clients.

```
INTERNAL ERROR
      ↓
STRUCTURED TECHNICAL HANDLING       full detail, internal only
      ↓
SAFE EXTERNAL ERROR CATEGORY        what happened, in the product's terms
      ↓
CORRELATION / SUPPORT REFERENCE     where appropriate
```

**Never returned by default:** database or table names · constraint details · provider responses ·
stack traces · file paths · internal identifiers of other tenants · anything revealing that a record
exists.

### 28.1 Query state must remain expressible

The locked Stage 10 contract requires four distinguishable states, end to end:

```
LOADING     ERROR     EMPTY     REAL ZERO
```

**Architectural requirement:** a failed server read must reach the client **as a failure**. It must be
impossible for the transport or composition layers to turn it into:

```
✘ []      ✘ 0      ✘ £0      ✘ "healthy"      ✘ "nothing required"
```

This is **SA-P15**, and it is the architectural half of **C-32**. A partially-failed composed read
(§19.2) reports **which part failed** rather than returning a smaller successful-looking whole.
**Stage 14 encodes the contracts; Stage 16 owns sanitisation.**

---

## 29. Failure boundaries

### 29.1 Dependency failure

| Dependency unavailable | Behaviour |
|---|---|
| **PostgreSQL** | The authoritative operation **fails**. Never a success, never an empty, never a zero |
| **Object storage** | File and media features fail. **Finance, custody and settlement continue** — they do not depend on bytes |
| **Resend** | **Notification truth survives.** Delivery is retried from the durable record |
| **Error tracking** | The product transaction **continues**. Observation is never on the critical path |
| **Cron invocation** | Durable due work **remains** and is picked up on the next invocation |
| **Public CMS delivery** | Authenticated operational Core is **unaffected** where technically possible |
| **Health checker** | **No effect on product truth** |

**The general rule:** a dependency that observes or transports must never be able to fail a business
operation, and a dependency that holds authoritative state must never be able to fake success.

### 29.2 Security failure boundaries

| Event | Required behaviour |
|---|---|
| **Account revoked mid-session** | The next sensitive access **must not** trust stale session authority (§8) |
| **School suspended** | Tenant business operations stop, even with a valid existing session |
| **Support engagement ended** | SC-6 scope **lapses**; support operations are no longer authorised |
| **MFA / elevation expired** | The privileged capability **lapses**; CD-7 is no longer satisfied |
| **Staffing ended** | SC-2 ∩ SC-3 collapses; the teacher's reach ends the same day (CD-2) |
| **Guardian relationship ended** | SC-4 lapses automatically; no administrative act required (CD-3) |
| **Password reset** | Other sessions for that account **must be terminable** (audit 1.7, §8.3) |

**Exact mechanics are Stage 16.** Stage 12 fixes only that each of these must be *possible* and must
*fail closed*.

### 29.3 Request-integrity and throttling — classified

**Audit 1.12 and 1.14** report rate-limiting weaknesses and no broad anti-CSRF boundary.

```
SECURITY CONTROL REQUIREMENTS  →  Stage 16
```

Architecturally, two statements stand:

1. **Cookie-authenticated state-changing requests require an application-wide request-integrity
   strategy.** Per-route ad-hoc defences are not an architecture.
2. **Authentication, recovery and high-risk endpoints require throttling that does not depend on
   spoofable client-supplied identity**, and that is shared across concurrent serverless instances —
   an in-memory limiter in a serverless runtime is not a limiter.

**No tokens, algorithms or identifiers are designed here.**

---

## 30. Privacy and lifecycle architectural distinctions

**Audit 6.1** — "permanent delete" is only a soft status change, while users and operators believe
data has been erased. **Audit 6.5** — hard deletion cannot prove complete tenant erasure.

```
LIFECYCLE STATUS          ≠          DATA ERASURE
a record's state                     the data is gone
```

```
ORDINARY RECORD CORRECTION   ≠   DATA SUBJECT ERASURE   ≠   TENANT PURGE
DM-047, a recorded event         a controlled privacy       CAP-092, exceptional
                                 process (CAP-036)          and irreversible
```

**Three architectural requirements:**

1. **The interface and the architecture must use the same words the system means.** A status change is
   not deletion, and must never be presented as one — **SA-P19**.
2. **Erasure must be able to prove its own completeness.** Audit 6.5 records that family, guardian,
   session and audit records cannot all be reliably reached by `school_id`. If tenant ownership is not
   structurally derivable (§10.4), erasure cannot be verified — the same missing property, seen from
   the privacy side.
3. **Immutable history and erasure are in genuine tension.** PP-006 locks that history is not
   rewritten; erasure removes personal data. **This tension is real and is not resolved here** — it
   requires Stage 16 and qualified legal review. Stage 12 records it rather than pretending either
   requirement wins.

**Retention schedules, DSAR mechanics and legal determinations are out of scope** (Stage 16 and
BytHub's own legal review). Audit 6.6–6.11 are recorded, not resolved.

### 30.1 Backup and recovery

**Audit 6.11** — no evidence of tested restore, PITR validation, retention, RPO or RTO.

```
AUTHORITATIVE DATA  →  recoverable through a managed backup and recovery capability
```

Stage 12 requires the property. **RPO, RTO and procedures are Stage 18 and Stage 21.**

---

## 31. State-location rules

| Location | Holds | Authoritative? |
|---|---|---|
| **Browser** | Presentation state, non-authoritative cache | **No** |
| **Session store (PostgreSQL)** | Authentication continuity, chosen context | **For continuity only** — never for permission |
| **PostgreSQL** | Business state · durable jobs · audit · notification truth | **Yes** |
| **Object storage** | Binary object bytes | **For bytes only** — the reference lives in PostgreSQL |
| **Email provider** | Delivery transport state | **No** |
| **Error tracking / logs** | Technical observation | **No** |
| **Function memory / filesystem** | Scratch within one invocation | **Never** |

### 31.1 No local durable state

```
FUNCTION MEMORY       →  EPHEMERAL
FUNCTION FILESYSTEM   →  EPHEMERAL

NEVER AUTHORITATIVE. NEVER A LOCK. NEVER A QUEUE. NEVER A CACHE OF TRUTH.
```

Compute is serverless and horizontally replaced without notice. **SA-P12.**

### 31.2 One persistence semantics

**Audit 10.11** — in-memory and database storage modes have different persistence and integrity
properties; tests can pass against behaviour that does not match production, and an accidental
memory-mode deployment loses data.

**Verified: the memory-mode fallback and its environment switches are still present.**

```
PRODUCTION AUTHORITATIVE BEHAVIOUR  →  EXACTLY ONE PERSISTENCE SEMANTICS
```

Development and test substitutes may exist, but **must not silently change business-integrity rules** —
**SA-P20**. Fixture and test architecture is Stage 13 and Stage 20. Recorded as **C-71**.

### 31.3 Money representation

**Audit 3.6, 10.9** — no non-negative constraints on monetary columns, and totals computed through
`parseFloat` and ordinary JavaScript arithmetic.

**Verified: monetary columns are `numeric(10,2)`** — the representation is correct. Application-side
float arithmetic on those values is the remaining exposure.

```
FINANCIAL TRUTH  →  represented and calculated through decimal-safe
                    domain and database semantics, never floating-point convenience
```

**Stage 15 owns representation and constraints. Stage 13 may own application decimal handling.** No
library or column type is chosen here.

---

## 32. UK/EU processing boundaries

**TQ-1 is locked:** providers processing ScholarShelf product data require UK/EU processing capability.
Stage 12 makes it a topology property.

```
USER
 → UK/EU CONFIGURED COMPUTE
   → UK/EU-CAPABLE DATA PROCESSORS
```

**Compute and database regional proximity is preferred where practical** — it is also a latency
property, not only a policy one.

### 32.1 Data-processing boundary map

| Source | Destination | Purpose | Broad data class | Authoritative? | UK/EU policy applies? | Failure consequence |
|---|---|---|---|---|---|---|
| Browser | Application compute | All product interaction | Everything the user sends | No | **Yes** | Product unavailable |
| Application | PostgreSQL / Neon | Authoritative state | **All product data** — children, families, money, custody, audit | **Yes** | **Yes** | Authoritative operations fail |
| Browser | Object storage *(direct upload)* | Large media | Uploaded bytes; school media | No | **Yes** | Upload fails; Core unaffected |
| Application | Object storage | Accept, read, delete objects | Bytes plus their tenant association | For bytes | **Yes** | Media features degrade |
| Application | Resend | Delivery | Recipient addresses, message content — **may include children's names and payable amounts** | No | **Yes** | Notification truth survives; retry |
| Browser + application | Error tracking | Diagnosis | Stack traces, request context — **highest leak risk** | No | **Yes** | Observation lost; product unaffected |
| Application | External logging *(if ever adopted)* | Operations | Technical and request context | No | **Yes** | Observation lost |
| External provider | Application *(callbacks)* | Integration signals | Provider-asserted facts | **No — untrusted** | Assessed per data transmitted | Signal missed; retried or reconciled |

**No compliance claim is made and no legal conclusion is drawn.** Data-processing agreements,
sub-processor disclosure, transfer mechanisms and retention require **BytHub's legal and privacy
review** (TQ-1's own wording, locked).

---

## 33. Release and schema compatibility

**Audit 11.1, 11.2, 11.8, 11.9** — failing CI did not block deployment; `main` is unprotected; neither
CI nor the platform applies migrations; and remote code catches missing-table errors and silently
falls back to a manual workflow.

### 33.1 The architectural assumption

```
APPLICATION VERSION  +  REQUIRED SCHEMA VERSION  →  COMPATIBLE
```

**The system must not treat:**

```
a required table is missing
```

**as:**

```
this feature is merely unavailable
```

for **required Core functionality**. A missing required schema object is an **incompatible deployment**,
not an optional feature absence. (Optional-module absence — a school without CMS entitlement — is a
different thing entirely, and remains legitimate.)

### 33.2 The application runtime does not mutate schema

**Audit 3.12** — numerous `CREATE` and `ALTER` statements during startup, with some errors suppressed.

**Verified REMEDIATED in the current tree:** the startup bootstrap was removed, with its own commentary
recording the three failure modes — cold-start round trips, `ACCESS EXCLUSIVE` lock contention between
concurrent cold starts, and silently failed columns surfacing later as unexplainable query errors.

```
APPLICATION START  ≠  SCHEMA MIGRATION ENGINE
```

Schema migrations are **deployment-controlled inputs** (TD-017, locked). The runtime **may verify
readiness**; it must not **repair** production schema. **SA-P16**, and preserved as an invariant
(SAR-018).

### 33.3 Release state is one verified thing

```
SOURCE REVISION
+ DEPENDENCY LOCK
+ DATABASE SCHEMA
+ CONFIGURATION
+ TEST RESULT
        →  RELEASE CANDIDATE
```

**Production state cannot be considered trustworthy if these drift independently** — which is audit
14.3's finding stated as an architectural principle (**SA-P17**). Stage 21 defines the pipeline;
Stage 12 establishes only the requirement.

### 33.4 Health

```
PROCESS HEALTH      the application is running
DEPENDENCY HEALTH   the database and required dependencies are reachable
READINESS           the required schema is present and this instance can serve traffic
```

**Audit 10.10, verified STILL PRESENT:** the current health endpoint reports status from a configured
storage-mode value and performs **no database or schema check**, so an instance reports healthy while
the database is unavailable or migrations are missing.

**Health must not expose sensitive architecture** — versions, connection strings, table names or
internal topology. **No response shape is designed here.** Recorded as **C-69**.

---

## 34. Scaling assumptions

Recorded so Stage 18 can test them rather than inherit them:

```
SCALE UNIT          one school's operational day
PEAK                September — enrolment, settlement and distribution together
CONCURRENCY         tens of staff per tenant; hundreds of families per tenant
DATA GROWTH         linear in children × periods; history is never deleted
HEAVIEST READS      finance reconciliation · fulfilment board · reporting
HEAVIEST WRITES     settlement confirmation · hand-over · import
LONGEST WORK        enrolment import · provider reconciliation · daily digest
```

**None of these requires a queue, a cache, a search cluster or a second service** at the scale the
locked product describes. **Stage 18 owns thresholds, measurement and what changes when they are
crossed.** Audit 4.7, 4.8 and 4.9 (whole-dataset candidate scans and N+1 patterns in provider matching
and payment enrichment) are recorded as **performance architecture** for Stage 18 — they are real, and
they are not tenant-isolation or atomicity defects.

---

## 35. Current → target architecture

| Current | Classification | Target |
|---|---|---|
| Tenant-isolation choke point (`ensureSessionSchoolIsActive`) | **PRESERVE** | One boundary, kept — plus three more (§10.2) |
| Guard returning `false`, not the `Response` | **PRESERVE** | The fix for audit 1.4; an invariant |
| Atomic confirmation with conditional claim-lock | **PRESERVE** | I-2, made structural (§17) |
| Guardian-relationship scoping | **PRESERVE** | SC-4, relationship-derived |
| CMS server boundary and IT walling | **PRESERVE** | §24 |
| Stock movement history | **PRESERVE** | MOD-005 event ownership |
| Context-switch validation and audit | **PRESERVE** | §9, §27 |
| Production-disabled test superuser | **PRESERVE** | Must remain impossible in production |
| Startup DDL removed | **PRESERVE** | **SA-P16** |
| Console tiering, least-privilege pool, credential-excluding views | **PRESERVE** | §26 — *subject to C-73* |
| Cron wall-clock drain budget | **PRESERVE, EXTEND** | Durable per-school work (§23.4) |
| `schoolFilter(table, schoolId?)` fail-open | **REMOVE BYPASS** | Tenant scope is never optional (§10.3) |
| `storage.ts`, 3,532 lines, all domains | **SPLIT LOGICALLY** | Module-owned data access (§15.4) |
| Business logic in route handlers | **REFACTOR** | Transport → authorisation → orchestration → modules |
| Routes importing Drizzle directly | **REMOVE BYPASS** | §15.4 |
| Role-keyed `requireRole(...)` | **REFACTOR** | Capability-keyed authorisation (§9) |
| Session-cached role and authority | **ADD BOUNDARY** | Live authority revalidation (§8) |
| Platform and customer shells sharing one mechanism | **SPLIT LOGICALLY** | Three bands (§5) — physical split is Stage 13 |
| Notification fused with email dispatch | **REPLACE FLOW** | Durable truth → eligible delivery (§22) |
| Base64 binary assets in PostgreSQL | **REPLACE FLOW** | Object storage with acceptance (§20) |
| Public `/uploads` static mount | **REMOVE FROM TARGET ARCHITECTURE** | §20.4 |
| Serial cron monolith | **REPLACE FLOW** | Durable, tenant-scoped work (§23.4) |
| Two schema mechanisms (`push` + partial migrations) | **REPLACE FLOW** | One reviewed migration path (TD-017) |
| Health from configured storage mode | **REPLACE FLOW** | Three health levels (§33.4) |
| ~160 handlers returning `e.message` | **REFACTOR** | §28 |
| Memory-storage fallback with divergent semantics | **REMOVE FROM TARGET ARCHITECTURE** | One persistence semantics (§31.2) |
| Client-side XLSX parsing | **REMOVE FROM TARGET ARCHITECTURE** | Server-side only (§21) |
| Non-transactional school wipe | **REPLACE FLOW** | §26.3 |
| Overlapping `status` / `distributionStatus` | **DEFER** | Stage 6 reduced the concepts; Stage 15 owns representation |

**Twenty-nine rows. Verified by direct inspection of this table, 29 August 2026.**

| Classification | Count |
|---|---:|
| PRESERVE | 10 |
| PRESERVE, EXTEND | 1 |
| REMOVE BYPASS | 2 |
| REMOVE FROM TARGET ARCHITECTURE | 3 |
| REFACTOR | 3 |
| ADD BOUNDARY | 1 |
| SPLIT LOGICALLY | 2 |
| REPLACE FLOW | 6 |
| DEFER | 1 |
| **TOTAL** | **29** |

*Correction recorded at lock.* The Stage 12 delivery report of 25 August 2026 stated **30** rows. Direct
re-inspection at owner review confirms **29**. This is an editorial count correction only — **no row
was added, removed, reworded or reclassified**, and no thirtieth row was invented to make an earlier
count true.

**No code was modified.**

---

## 36. Corporate-audit reconciliation

Every entry re-verified against the working tree on **25 August 2026**. Findings that do not materially
affect topology, trust boundaries, isolation, authority, transactions, state location, file handling,
asynchronous work, integrations, privileged operations or runtime compatibility are **not** reproduced
here — they remain the audit's, and Stages 13–21 own them.

**§72's rule is applied strictly: an audit finding becomes a new conflict only where current-baseline
evidence shows it still exists.**

---

**SAR-001 · Tenant scoping is optional in core storage methods**
*Audit:* 1.9 (Critical) · also 14.1. *Failure mode:* an omitted parameter, null context or
owner-support transition turns a tenant query into a platform-wide one.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* `schoolFilter(table, schoolId?)` returns `undefined` when the identifier is absent, which
emits no `WHERE` clause. Verified directly.
*Locked requirement affected:* PP-004 · BR-001–009 · SC-1 · every tenant-scoped capability.
*Stage 12 consequence:* §10.3 — tenant scope is never an optional argument; §10.2's four boundaries.
*Later owner:* **13** (data-access shape) · **15/16** (database integrity).
*Creates a current conflict:* **YES — C-64.**

---

**SAR-002 · BOLA / IDOR through object identifiers**
*Audit:* 1.10 (Critical). *Failure mode:* an authenticated user who learns another object's identifier
reads or modifies another school's or family's records.
*Current-baseline status:* **PARTIAL.**
*Evidence:* storage-level asserts (`assertStudentInSchool`, `assertBookInSchool`,
`assertClassInSchool`, `assertBookLevelInSchool`) exist at 18 call sites — real, and genuinely good —
but they are applied where a developer remembered, not structurally at every identifier boundary.
*Locked requirement affected:* SC-1 · SC-3 · SC-4 · every resource-scoped capability.
*Stage 12 consequence:* §11 — ownership is proven, never inferred; SA-P7.
*Later owner:* **13** · **16**.
*Creates a current conflict:* **YES — C-66.**

---

**SAR-003 · Authorisation relies on stale session state**
*Audit:* 1.5, 1.6, 1.7 (High). *Failure mode:* a suspended user, demoted administrator or revoked
permission holder retains access through an existing session; a password reset does not end other
sessions.
*Current-baseline status:* **PARTIAL.**
*Evidence:* the **school's** lifecycle **is** revalidated on every request (fresh read, four inactive
statuses, session destroyed, refusal audited). The **account's** own state and role grants are **not** —
`req.session.role` is set at sign-in and read thereafter.
*Locked requirement affected:* CD-1 (met) · CD-2, CD-3, CD-4, CD-6, CD-7 (not structurally met).
*Stage 12 consequence:* §8 — session proves continuity, not permission; §29.2's security failure
boundaries.
*Later owner:* **16** (mechanics) · **15** (session representation).
*Creates a current conflict:* **YES — C-67.**

---

**SAR-004 · Session records not structured for per-user revocation**
*Audit:* 1.8 (High). *Failure mode:* an administrator suspends an account and cannot actually end its
sessions.
*Current-baseline status:* **REVISION-DEPENDENT / CANNOT YET PROVE.**
*Evidence:* sessions are stored in PostgreSQL via `connect-pg-simple`; whether a reliable indexed
user relationship exists was **not established from the repository** in this session.
*Stage 12 consequence:* §8.3 — sessions must be attributable to a user and terminable as a set.
*Later owner:* **15** (representation) · **16** (revocation). *Verification owed at Stage 15.*
*Creates a current conflict:* **NO** — folded into C-67's target; not separately asserted.

---

**SAR-005 · Inactive-school guard fails open**
*Audit:* 1.4 (Critical). *Failure mode:* `ensureSessionSchoolIsActive()` returns an Express `Response`
after denying; callers read the truthy object as success and continue into the protected handler.
*Current-baseline status:* **REMEDIATED — PRESERVE AS AN INVARIANT.**
*Evidence:* the current function returns `false`, with a `SECURITY` comment naming this exact defect
and explaining why a `Response` object must never be returned.
*Stage 12 consequence:* §35 preserves it. Any future refactor of the choke point must keep a
guard whose failure value cannot be mistaken for success.
*Later owner:* **16** · **20** (a regression test belongs here).
*Creates a current conflict:* **NO.**

---

**SAR-006 · Null-school staff sessions serve every tenant**
*Audit:* implied by 1.9 and 3.3 · Legal brief domain 1, *"Inactive school check fails open."*
*Current-baseline status:* **REMEDIATED — PRESERVE AS AN INVARIANT.**
*Evidence:* a tenant-scoped session with no school is now refused and the refusal audited, with
commentary explaining that such an account is *"not unscoped, it is scoped to EVERYTHING"*.
*Stage 12 consequence:* **SA-P13** · §12.4 — platform is never a null tenant.
*Later owner:* **16**.
*Creates a current conflict:* **NO.**

---

**SAR-007 · No database row-level security**
*Audit:* 3.1 (Critical). *Failure mode:* one query missing its tenant predicate reads or writes across
every school.
*Current-baseline status:* **STILL PRESENT** (no RLS found).
*Note, recorded rather than resolved:* the project's own earlier audit (`audit_2026-08-20_findings.md`)
**deliberately deprioritised RLS**, judging that foreign keys plus isolation tests bought most of the
benefit for far less. The corporate audit and the Legal brief's Phase B disagree and require it.
**Stage 12 does not adjudicate between them** — it states the property that must hold (§10.4) and
leaves the mechanism to Stage 15/16, which is the stage that can evaluate cost against coverage.
*Stage 12 consequence:* §10.4 — isolation must not depend solely on callers remembering predicates.
*Later owner:* **15** · **16**.
*Creates a current conflict:* **YES — C-65** (stated as the absent property, not as "RLS is missing").

---

**SAR-008 · Tenant columns nullable; cross-tenant relational integrity unenforced**
*Audit:* 3.3, 3.4 (Critical) — 19 of 26 tables permit a null `school_id`; relationships do not use
tenant-aware composite keys, so a tenant-A allocation can reference a tenant-B student.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* no composite tenant-aware keys observed; nullable tenant columns remain.
*Stage 12 consequence:* §10.4 · §30's erasure-completeness consequence.
*Later owner:* **15**.
*Creates a current conflict:* folded into **C-65** — same missing property, same owner.

---

**SAR-009 · Most tenant tables lack school foreign keys**
*Audit:* 3.2 (Critical) — 23 of 26.
*Current-baseline status:* **PARTIALLY REMEDIATED.**
*Evidence:* Stage 0 verified **76 foreign keys and 42 index declarations** now present in
`shared/schema.ts` — added by the restructuring pass the audit's checkout did not contain.
*Stage 12 consequence:* §10.4 counts this as one boundary, not the whole defence.
*Later owner:* **15**.
*Creates a current conflict:* **NO** — improvement verified; the remaining gap is C-65's.

---

**SAR-010 · Database accepts invalid statuses, negative money, impossible stock**
*Audit:* 3.5, 3.6, 3.7 (High/Critical).
*Current-baseline status:* **PARTIALLY REMEDIATED.**
*Evidence:* `migrations/006_identity_and_money_integrity.sql` adds three status `CHECK` constraints and
uniqueness indexes; monetary columns are `numeric(10,2)`. Non-negative constraints on money and stock
were **not** confirmed.
*Stage 12 consequence:* §31.3 — decimal-safe financial semantics; §10.4 — the database as a real
boundary.
*Later owner:* **15**.
*Creates a current conflict:* **NO** — Stage 15 owns the remaining constraints as design work.

---

**SAR-011 · Schema changes are not version-governed**
*Audit:* 3.11 (Critical) · 11.8 (Critical) — no reliable migration journal; migrations not applied by
CI or deployment.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* `db:push` and seven hand-written migrations coexist; CI applies `002`–`006` and
**deliberately skips `001`**; no deployment migration step exists.
*Stage 12 consequence:* §33 — application and required schema version must be compatible; **SA-P17**.
*Later owner:* **15** (baseline) · **21** (pipeline).
*Creates a current conflict:* **YES — C-72.** (**C-61** already records the two mechanisms; C-72 records
that **deployment applies neither**, which is a distinct defect.)

---

**SAR-012 · Payment confirmation race and non-atomic transitions**
*Audit:* 4.1, 4.2, 4.4 (Critical) — separate autocommit statements, no row locking, duplicate
allocations, double stock deduction.
*Current-baseline status:* **REMEDIATED — PRESERVE AS AN ARCHITECTURAL INVARIANT.**
*Evidence:* the confirmation path is one transaction with a conditional
`UPDATE … WHERE status NOT IN (…) RETURNING *` claim-lock; a concurrent second confirmation claims zero
rows and performs no second effect.
*Locked requirement affected:* **I-2** · PP-001 · PP-002.
*Stage 12 consequence:* §17 makes it structural — the transaction boundary belongs to a named
orchestration step, not to a route handler, so regression requires deliberately moving it.
*Later owner:* **13** (orchestration) · **15** (uniqueness constraints) · **20** (a concurrency test).
*Creates a current conflict:* **NO.** A fake current conflict here would be exactly the error §19 and
§72 warn against.

---

**SAR-013 · One provider payment can settle multiple orders; webhook replay**
*Audit:* 4.5, 4.15, 4.16 (Critical) — no unique reservation of the matched provider payment;
signatures computed over reserialised JSON; no replay or event-id protection.
*Current-baseline status:* **PARTIALLY REMEDIATED / REVISION-DEPENDENT.**
*Evidence:* `migrations/006` adds a payment-reference unique index and a `basket_payments` unique index;
`server/paymentIntegration.ts` verifies an HMAC and fails closed. Whether the signature is computed
over the **raw received bytes**, and whether replay protection exists, was **not established** in this
session.
*Stage 12 consequence:* §38's callback boundary — a provider signal is untrusted input requiring
authenticity, replay and idempotency checks before interpretation; **SA-P10**.
*Later owner:* **16** (verification mechanics) · **17** (integration). *Verification owed at Stage 17.*
*Creates a current conflict:* **NO** — revision-dependent, and there is no live payment provider
(TD-042 defers selection).

---

**SAR-014 · Cross-school baskets can be combined**
*Audit:* 4.11 (Critical) — payment school derived from the first basket only.
*Current-baseline status:* **REVISION-DEPENDENT / CANNOT YET PROVE.**
*Evidence:* the current tree has a duplicate-basket guard and a `basket_payments` unique index; whether
every selected basket is proven to share one school was **not confirmed**.
*Stage 12 consequence:* §11 — every referenced object's tenant ownership is proven, not derived from
one member of a set. This is BOLA at the collection level.
*Later owner:* **13** · **15** (composite tenant integrity) · **20** (test). *Verification owed at
Stage 15.*
*Creates a current conflict:* **NO** — folded into C-65 and C-66's targets.

---

**SAR-015 · Stock adjustment errors are swallowed**
*Audit:* 4.3 (High) — a payment appears confirmed while inventory is unchanged.
*Current-baseline status:* **PARTIALLY REMEDIATED.**
*Evidence:* Stage 0 records that the extra-copy stock error is now surfaced rather than swallowed, and
the confirmation path is transactional (SAR-012), which makes a swallowed stock failure structurally
impossible **inside I-2**. Other stock paths were not exhaustively checked.
*Stage 12 consequence:* §17.2's three impossible states; §29.1 — a dependency failure never fakes
success.
*Later owner:* **13** · **20**.
*Creates a current conflict:* **NO.**

---

**SAR-016 · Web-accessible arbitrary SQL console with application database privilege**
*Audit:* 5.1, 5.2, 5.3, 5.4 (Critical) · Legal brief **Phase A.3** requires blocking or removing it
within 72 hours.
*Current-baseline status:* **SUBSTANTIALLY REMEDIATED IN CODE — ENFORCEMENT UNPROVEN.**
*Evidence, verified directly:* three tiers; a separate least-privilege read pool; `BEGIN READ ONLY`
plus `default_transaction_read_only`; extended-protocol parameter binding defeating multi-statement
injection; database **views excluding `password_hash`, `mfa_secret`, `token_hash`**; always `ROLLBACK`
on the read tier; break-glass requiring TOTP, a reason, 15 minutes and alerts; console audit on
everything; **and the PATCH/DELETE row endpoints removed** (audit 5.4's injection, gone).
**The caveat:** every control depends on `migrations/001_console_hardening.sql` creating those roles
and views — **and CI deliberately skips `001`.** If it is unapplied in production, the hardened path
cannot connect.
*Stage 12 consequence:* §26 — bounded read-only investigation is a locked capability (CAP-089);
arbitrary SQL with application privilege is not in the target architecture. The distinction is
**privilege**, not syntax.
*Later owner:* **15/21** (apply and prove the migration) · **16** (operational access).
*Creates a current conflict:* **YES — C-73**, for the enforcement gap specifically, **not** for the
console design, which is materially better than the audit found.

---

**SAR-017 · Non-transactional school wipe exposed over HTTP**
*Audit:* 5.5, 5.6 (Critical) · 6.2, 6.3, 6.4 (High) — a boolean-confirmed HTTP wipe; a long sequence of
independent deletes with no rollback; and deletion blockers calling the wrong argument, so active
payments and pending distributions can be missed.
*Current-baseline status:* **PARTIALLY REMEDIATED / REVISION-DEPENDENT.**
*Evidence:* the console's danger tier now requires TOTP, a reason, a time window and alerting.
Whether `deleteSchoolAndRelatedData()` is transactional, and whether the blocker-argument defects
persist, was **not established** in this session.
*Stage 12 consequence:* §26.3 — preconditions proven **by the owning modules**, controlled execution,
audit, and a designed failure-recovery strategy; §30's erasure-completeness requirement.
*Later owner:* **16** · **21** · **22**. *Verification owed at Stage 16.*
*Creates a current conflict:* **NO** — revision-dependent; §26.3 states the target regardless.

---

**SAR-018 · Runtime DDL during application startup**
*Audit:* 3.12 (High) — `CREATE`/`ALTER` on every cold start, with some errors suppressed.
*Current-baseline status:* **REMEDIATED — PRESERVE AS AN INVARIANT.**
*Evidence:* the bootstrap was removed, with commentary recording all three failure modes the audit
identified — cold-start latency, `ACCESS EXCLUSIVE` lock contention between concurrent cold starts,
and silently failed columns surfacing later as unexplainable query errors.
*Stage 12 consequence:* **SA-P16** · §33.2 — the runtime may verify readiness, never repair schema.
*Later owner:* **21**.
*Creates a current conflict:* **NO.**

---

**SAR-019 · "Permanent deletion" is only a soft status change**
*Audit:* 6.1 (High) · 6.5 (High) — operators believe data is erased while records remain; erasure
cannot prove completeness.
*Current-baseline status:* **STILL PRESENT** as an architectural distinction, and it is a *product*
gap as much as a code one.
*Stage 12 consequence:* §30 — lifecycle status ≠ erasure; correction ≠ erasure ≠ purge; **SA-P19**;
and the honest recording that immutable history (PP-006) and erasure are in genuine tension.
*Later owner:* **16** · external legal review.
*Creates a current conflict:* **NO** — Stage 16 owns the process, and Stage 12 has stated the
distinction the architecture must carry.

---

**SAR-020 · Files stored as base64 inside PostgreSQL; public `/uploads` mount**
*Audit:* 7.4, 7.5, 7.6 (High) · 7.9 (Medium).
*Current-baseline status:* **STILL PRESENT — both.**
*Evidence:* `media_assets.data_uri` holds `data:<mime>;base64,…`; `school_branding` stores five asset
kinds the same way; `server/app.ts` mounts `/uploads` as a public static path with no authorisation.
*Stage 12 consequence:* §20 — arrival is not acceptance; direct upload; public/private object classes;
the `/uploads` path is **removed from the target architecture**.
*Later owner:* **16** (access control) · **17** (provider) · **22** (asset migration and removal).
*Creates a current conflict:* **YES — C-68** for the public mount. **C-56** already records base64
storage; not duplicated.

---

**SAR-021 · Cron is serial, time-bounded, and declared idempotency is unused**
*Audit:* 8.4, 8.5 (High) · 13.5 (High) — a timeout part-way through emails only some schools, with no
durable retry state and no alerting.
*Current-baseline status:* **PARTIALLY REMEDIATED.**
*Evidence:* the current handler carries a **24-second wall-clock drain budget**, breaks cleanly when it
expires, and **logs how many schools remain** — a silent partial run became a visible one. But the
remainder is not durable work; the next invocation restarts rather than resumes.
*Stage 12 consequence:* §23.4 — durable, tenant-scoped workload; a school not reached is a school still
owed; independent delivery attempts per notification.
*Later owner:* **15** (job and notification records) · **18** (thresholds).
*Creates a current conflict:* **NO** — **C-30** already owns large-tenant digest behaviour, and §23.4 is
its architectural target.

---

**SAR-022 · Email delivery has no transactional outbox and no idempotency**
*Audit:* 8.2, 8.3 (High) — notifications for rolled-back operations, or no notification for committed
ones, with no replay record; retries resend.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* no durable notification record exists — this is **C-46**, already on the register.
*Stage 12 consequence:* §22 — truth before delivery; one notification, many attempts; retry ≠ new
notification.
*Later owner:* **15** (the record) · **17** (delivery and uniqueness).
*Creates a current conflict:* **NO** — C-46 covers it.

---

**SAR-023 · Business logic and data access leak into route handlers**
*Audit:* 10.1, 10.2, 10.3, 10.4 (High) — a 3,000-line storage monolith; routes performing validation,
authorisation interpretation, orchestration, email, calculation, state transitions and audit
construction; some routes importing Drizzle directly; and new service layers bypassed by legacy paths.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* `server/storage.ts` is **3,532 lines** with ~305 methods; **five route files import
`drizzle-orm` directly**.
*Stage 12 consequence:* §15 — transport → authorisation → orchestration → owning modules; §15.4 —
transport never reaches persistence directly.
*Later owner:* **13**.
*Creates a current conflict:* **NO** — **C-42** covers the storage monolith and is the architectural
target here.

---

**SAR-024 · Raw backend errors are exposed to clients**
*Audit:* 1.13 (High) — ~160 route-level handlers return `e.message`.
*Current-baseline status:* **STILL PRESENT** (partially improved on the client side by
`describeApiError`, which is used by four page files).
*Stage 12 consequence:* §28 — structured internal handling, safe external category, correlation
reference; never internal detail by default.
*Later owner:* **14** (contract shapes) · **16** (sanitisation).
*Creates a current conflict:* **YES — C-70.**

---

**SAR-025 · Health endpoint does not validate dependencies**
*Audit:* 10.10 (High) — an instance reports healthy while the database is unavailable or migrations are
missing.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* `/api/health` returns a status derived from a configured storage-mode value; **no database
or schema check is performed.**
*Stage 12 consequence:* §33.4 — process health, dependency health, readiness; and §33.1's rule that
missing required schema is an incompatible deployment, not an absent feature.
*Later owner:* **14** (shape) · **21** (deployment gating).
*Creates a current conflict:* **YES — C-69.**

---

**SAR-026 · Memory-storage mode creates behavioural divergence**
*Audit:* 10.11 (High) — tests can pass against behaviour that does not match production; an accidental
memory-mode deployment loses data.
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* `memorystore` is imported by `server/app.ts`; `ALLOW_MEMORY_STORAGE` and
`FORCE_MEMORY_STORAGE` are declared in the validated environment schema; the health endpoint's own
status derives from the storage mode.
*Stage 12 consequence:* §31.2 — production has exactly one persistence semantics; **SA-P20**.
*Later owner:* **13** (fixtures) · **20** (test architecture) · **21** (configuration).
*Creates a current conflict:* **YES — C-71.**

---

**SAR-027 · Failing CI does not block deployment; `main` is unprotected**
*Audit:* 11.1, 11.2, 11.3 (Critical) · Legal brief **Phase A.4**.
*Current-baseline status:* **STILL PRESENT** (organisational, not code).
*Evidence:* `REBUILD_SAFETY.md` independently records that `verify` is **not a required status check**
on `main`, so *"green CI is advisory and a red build still deploys"*, and that the repository has one
branch with direct pushes and auto-deploy.
*Stage 12 consequence:* §33.3 — **SA-P17**; source, schema, dependencies, configuration and test
result are one release state or production is not trustworthy.
*Later owner:* **21**. This is a repository-settings and pipeline change, not an architecture change.
*Creates a current conflict:* folded into **C-72** — deployment does not gate on verification.

---

**SAR-028 · Database integration tests are absent from CI**
*Audit:* 11.5 (Critical) · 11.6, 11.7 (High).
*Current-baseline status:* **PARTIALLY REMEDIATED.**
*Evidence:* the current `ci.yml` **does** define an integration job with a Postgres 16 service, applying
`002`–`006` and running the DB-backed suites including a second seeded tenant — a substantial
improvement on what the audit found. But `RESTRUCTURE_STATE.md` caps evidence at **E2** because nothing
has been observed running, and Stage 11 recorded that there is **no test framework** behind the suites.
*Stage 12 consequence:* the architecture's invariants — §10, §11, §17 — are only real if continuously
verified. **C-60** owns the framework gap.
*Later owner:* **20** · **21**.
*Creates a current conflict:* **NO** — C-60 covers it.

---

**SAR-029 · Logging is unstructured; requests lack correlation; no monitoring or alerting**
*Audit:* 13.1, 13.2, 13.3, 13.4 (High).
*Current-baseline status:* **STILL PRESENT.**
*Evidence:* 55 `console.*` calls in `server/`; no logging library; no correlation identifier; no error
tracker.
*Stage 12 consequence:* §27 — technical log ≠ audit event; §27.1 — correlation is what makes the locked
Stage 10 support reference deliverable.
*Later owner:* **16** (redaction) · **19** (audit) · **21** (destinations and alerting).
*Creates a current conflict:* **NO** — **C-62** covers structured logging and correlation.

---

**SAR-030 · Authentication secrets and PII logged on delivery failure**
*Audit:* 2.10 (High) · 8.7 (High) — password-reset URLs, invitation tokens, parent-linking codes,
payment references, recipient information and full contact-form contents written to logs.
*Current-baseline status:* **REVISION-DEPENDENT / CANNOT YET PROVE** — not exhaustively re-verified in
this session.
*Evidence:* **C-18** already records live credentials reaching logs, from an earlier stage's own
finding.
*Stage 12 consequence:* §27 — redaction is a configured property of the logging architecture, not a
discipline; a support reference exists precisely so that detail need not travel to the user or the log.
*Later owner:* **16** (redaction policy). *Verification owed at Stage 16.*
*Creates a current conflict:* **NO** — C-18 covers it.

---

**SAR-031 · Test superuser can become a production backdoor**
*Audit:* 1.2, 1.3 (Critical) · Legal brief **Phase A.2** — remove `ALLOW_TEST_SUPERUSER` from
production builds and strip the logic from access-control checks.
*Current-baseline status:* **PARTIALLY REMEDIATED — PRESERVE AND STRENGTHEN.**
*Evidence:* Stage 0 verified the mechanism is **production-disabled**, and `requireRole`'s own
commentary records that the session must already be a test account for the bypass to apply. The
capability nonetheless **still exists in the code path**, which is what Phase A.2 objects to.
*Stage 12 consequence:* **SA-P2** — no code path may grant authority the authorisation layer did not.
An access-control bypass that is disabled by configuration is a control that depends on configuration.
*Later owner:* **16** (whether it survives at all) · **22** (removal if not).
*Creates a current conflict:* **NO** — production-disabled is verified; Stage 16 decides whether
configuration-gated is sufficient.

---

**SAR-032 · Frontend security and state findings**
*Audit:* 9.1 (Critical, stored DOM XSS via `document.write` in printable book output) · 9.2 (CSP
`unsafe-inline`) · 9.9 (React Query effectively infinite staleness) · 9.4 (`maximum-scale=1` blocking
zoom) · 9.5–9.8 (dialog semantics, status roles, skip link, reduced motion).
*Current-baseline status:* **MIXED — LATER-STAGE ISSUE for most.**
*Evidence:* the CSP was hardened (`unsafe-eval` dropped) but `unsafe-inline` remains, and **two
competing CSP headers are set** — one by the platform configuration and one by helmet, which Stage 0
independently flagged. `retry: false` and the staleness configuration are verified present.
*Stage 12 consequence:* only two are architectural — **9.1** is an injection at a trust boundary
(§28's rule that stored values are untrusted wherever they are rendered), and **9.9** is why §16's
command path revalidates rather than trusting client state. The rest are **Stage 10 (presentation,
already locked)**, **Stage 13** and **Stage 16**.
*Later owner:* **13** · **16** · **21** (the duplicate CSP header).
*Creates a current conflict:* **NO** — presentation and implementation, already owned.

---

**SAR-033 · Dependency vulnerabilities**
*Audit:* 12.1–12.6 (High/Medium) — 18 vulnerabilities; Drizzle identifier-escaping advisory; Multer
DoS; `ws`; `path-to-regexp`, `qs`, `body-parser`; broad version drift.
*Current-baseline status:* **LATER-STAGE ISSUE — already owned.**
*Evidence:* **Stage 11** verified the spreadsheet parser independently (C-58) and locked upgrade
decisions across the stack (TD-002, TD-011, TD-016, TD-039), plus removal of eight unused packages.
*Stage 12 consequence:* one architectural point only — the **Drizzle identifier-escaping advisory**
matters most exactly where identifiers are built dynamically, which §26 removes from the application
(the PATCH row endpoint that did so is already gone).
*Later owner:* **11** (decided) · **22** (execution).
*Creates a current conflict:* **NO.**

---

### 36.1 Reconciliation summary

| Classification | Count | SAR |
|---|---:|---|
| **STILL PRESENT** | **13** | 001 · 007 · 008 · 011 · 019 · 020 · 022 · 023 · 024 · 025 · 026 · 027 · 029 *(008 folded into 007's conflict)* |
| **PARTIALLY REMEDIATED** | **10** | 002 · 003 · 009 · 010 · 013 · 015 · 017 · 021 · 028 · 031 |
| **REMEDIATED — PRESERVE AS INVARIANT** | **5** | 005 · 006 · 012 · 016 *(in code; enforcement unproven — C-73)* · 018 |
| **REVISION-DEPENDENT / CANNOT YET PROVE** | **3** | 004 · 014 · 030 |
| **LATER-STAGE ISSUE** | **2** | 032 · 033 |
| **Total** | **33** | SAR-001 … SAR-033, each counted exactly once |

*Counts are of SAR entries, several of which cover multiple audit findings. Where an entry spans two
classifications, it is counted under its dominant one — the one stated first in that entry's
`Current-baseline status:` line — and the split is stated in the entry. SAR-013 and SAR-017 are
`PARTIALLY REMEDIATED / REVISION-DEPENDENT` and are counted under PARTIALLY REMEDIATED; SAR-016 is
`SUBSTANTIALLY REMEDIATED IN CODE — ENFORCEMENT UNPROVEN` and is counted under REMEDIATED, with the
unproven enforcement recorded separately as C-73; SAR-031 is `PARTIALLY REMEDIATED — PRESERVE AND
STRENGTHEN` and is counted under PARTIALLY REMEDIATED; SAR-032 is `MIXED — LATER-STAGE ISSUE for
most` and is counted under LATER-STAGE ISSUE.*

**Correction recorded at delivery (25 August 2026, before lock).** An earlier draft of this table
stated 9 · 8 · 5 · 4 · 2 and omitted SAR-022 and SAR-027 from its identifier lists; the stated counts
also did not match the identifiers listed beside them. The counts above were recomputed directly from
the `Current-baseline status:` line of every one of the thirty-three entries in §36 and now reconcile
to 33. **No SAR entry's own classification was changed** — only this summary was corrected to match
the entries it summarises. This correction is recorded here rather than made silently.

---

## 37. Architectural decisions

**AD-001 · One coherent modular application**
*Problem:* fifteen locked modules must run somewhere.
*Locked:* Stage 8 — module boundary is not deployment boundary. *Audit:* 10.1–10.4 (modularity).
*Current:* one Express application with no internal boundaries.
*Decision:* **one application, boundaries enforced internally.**
*Reason:* the locked product has one atomic invariant spanning three modules (I-2), one database, one
tenant model and one team. Services would add network failure between writes that must not fail
independently.
*Rejected:* microservices per module · a separate finance service · a separate platform service — each
would put a network boundary inside I-2 or inside tenant isolation.
*Consequences:* §13, §15. *Conflicts:* C-42's target. *Owner:* **13**. *Owner decision:* NO.

**AD-002 · The server is the sole authority boundary**
*Locked:* PP-004, PP-005, Stage 7, Stage 9 UX-P4. *Audit:* 1.5, 1.9, 1.10, 9.9.
*Decision:* **all authority decisions are server-side and re-derived per request.**
*Reason:* every client-side signal is attacker-controllable; the audit's three worst domains all reduce
to trusting something the client supplied or something cached from earlier.
*Consequences:* §6, §8, §9. *Owner:* **16**. *Owner decision:* NO.

**AD-003 · Session proves continuity; authority is live**
*Problem:* revoked authority survives an existing session. *Audit:* 1.5, 1.6, 1.7.
*Current:* school lifecycle revalidated; account state and role grants not.
*Decision:* **a cached authority claim may never be the sole basis for a sensitive decision.**
*Reason:* Stage 7's conditions (CD-1…CD-12) are, by construction, facts that change during a session's
life — staffing ends, relationships lapse, engagements close, elevation expires.
*Rejected:* stateless tokens carrying authority (Stage 11 rejected these for the same reason) ·
long-lived permission snapshots.
*Consequences:* §8, §29.2. *Conflicts:* **C-67**. *Owner:* **16**. *Owner decision:* NO.

**AD-004 · Tenant scope is never an optional argument**
*Problem:* `schoolFilter(table, schoolId?)` is fail-open. *Audit:* 1.9, 3.1, 14.1.
*Decision:* **data access is either explicitly tenant-scoped or explicitly platform-scoped. Absence
never means all tenants.**
*Reason:* a default that is safe only when every caller remembers is not a control. The choke point
guards sessions, not call sites.
*Rejected:* "audit every call site" — that is the current state, and it is what failed.
*Consequences:* §10.2, §10.3. *Conflicts:* **C-64**. *Owner:* **13**, **15**, **16**.
*Owner decision:* NO.

**AD-005 · Tenant isolation is defence in depth, with a database boundary**
*Audit:* 3.1–3.4, 14.1. *Project's own earlier audit deprioritised RLS* (SAR-007).
*Decision:* **four independent boundaries; the database must be one of them. The mechanism is not
pre-selected.**
*Reason:* Stage 12 can state the property with confidence and cannot choose between RLS, composite
keys and non-null ownership without the schema Stage 15 has not yet designed. Choosing blind would
pre-empt the stage that can weigh cost against coverage.
*Rejected:* locking RLS here (pre-empts Stage 15) · leaving the database out (repeats the defect).
*Consequences:* §10.4. *Conflicts:* **C-65**. *Owner:* **15**, **16**. *Owner decision:* NO.

**AD-006 · Resource ownership is proven, never inferred**
*Audit:* 1.10, 4.11. *Decision:* **capability + resource + ownership + scope + conditions**; an
identifier is a locator. *Consequences:* §11. *Conflicts:* **C-66**. *Owner:* **13**, **16**.
*Owner decision:* NO.

**AD-007 · Authorisation is capability-keyed, not role-keyed**
*Locked:* Stage 7's full chain; PA-1's separation of context from authority.
*Current:* `requireRole(...)` compares the active context to role strings.
*Decision:* **evaluate a capability against a resource under a scope and conditions.**
*Reason:* role strings cannot express `school_admin + AUTH-FINANCE` without a switch, cannot express
SC-3's intersection, and cannot express CD-5's own-child block.
*Consequences:* §9. *Conflicts:* **C-40**'s target. *Owner:* **13**, **16**. *Owner decision:* NO.

**AD-008 · Application orchestration owns transaction scope**
*Audit:* 10.2, 10.4. *Decision:* **a layer between authorisation and owning modules coordinates,
sequences and owns the transaction — and owns no domain truth.**
*Reason:* I-2 spans three modules and belongs to none. Without this layer it lands in a route handler,
which is where the audit found it.
*Consequences:* §15, §17. *Conflicts:* C-42's target. *Owner:* **13**. *Owner decision:* NO.

**AD-009 · Transport never reaches persistence**
*Audit:* 10.3 — five route files verified importing Drizzle directly.
*Decision:* **data access follows module ownership; cross-module use cases orchestrate.**
*Consequences:* §15.4. *Owner:* **13**. *Owner decision:* NO.

**AD-010 · Client input is not a domain command**
*Audit:* 1.11. *Decision:* **transport payloads are translated into explicitly accepted business
inputs; server-controlled properties are never settable from a request body.**
*Consequences:* §15.3. *Owner:* **14**, **16**. *Owner decision:* NO.

**AD-011 · I-2 remains one synchronous transaction — permanently**
*Locked:* Stage 8 I-2, MA-1, Stage 11 §33. *Audit:* 4.1, 4.2, 4.4 — and **remediated** in the current
tree (SAR-012).
*Decision:* **one process, one transaction, one commit; all succeed or all roll back.**
*Reason:* the three impossible partial states are the product's core integrity promise.
*Rejected — explicitly:* queue between writes · async continuation · provider callback completing
stock · saga · compensating transaction · distributed transaction · eventual consistency.
*Consequences:* §17, §18. *Owner:* **13**, **15**. *Owner decision:* **NO — and changing it requires a
traceable amendment to Stage 8 itself.**

**AD-012 · Atomic business acts require a transaction-capable connection**
*Locked:* TD-014/TD-015's constraint. *Audit:* 3.13, 3.14.
*Decision:* **it must not be possible for an atomic business act to run on a connection that cannot
hold a transaction.**
*Consequences:* §18.1. *Owner:* **13**. *Owner decision:* NO.

**AD-013 · PostgreSQL is the concurrency authority**
*Audit:* 4.1, 4.2, 4.6, 4.14, 2.3, 2.6, 2.8 — every one is a check-then-act race.
*Decision:* **conditional writes, unique constraints, transactions and record claims.** Never
in-memory, browser or external locks.
*Reason:* in a serverless runtime with no shared memory, an in-memory lock is not a lock. Seven audit
findings share this single root cause.
*Consequences:* §18.3, §23.2. *Owner:* **15**, **16**. *Owner decision:* NO.

**AD-014 · Truth commits before external consequence**
*Audit:* 8.2. *Decision:* **notification truth may be written inside the business transaction;
delivery is always after commit.** A provider failure cannot change authoritative truth, and a
rolled-back operation cannot notify.
*Consequences:* §17.3, §22, §29.1. *Conflicts:* C-46's target. *Owner:* **15**, **17**.
*Owner decision:* NO.

**AD-015 · One notification, many delivery attempts**
*Audit:* 8.3. *Decision:* **retry ≠ new business notification.** *Consequences:* §22.1.
*Owner:* **15**, **17**. *Owner decision:* NO.

**AD-016 · Durable jobs in PostgreSQL; cron only says "when"**
*Locked:* TD-026, TD-027. *Audit:* 8.4, 8.5, 13.5.
*Decision:* **eligibility is a durable record; execution is an atomic claim; a repeated cron firing
produces no duplicate effect.**
*Rejected:* an external broker (a service to solve a problem the database does not have here) ·
in-memory job state (impossible in serverless).
*Consequences:* §23. *Conflicts:* C-30's target. *Owner:* **15**, **18**. *Owner decision:* NO.

**AD-017 · Byte arrival is not acceptance; large media bypasses the request body**
*Audit:* 7.1–7.6, 7.9. *Decision:* **pending → validated → finalised → trusted reference**, with signed
direct upload for large media.
*Reason:* it removes the platform body limit from the path (**C-57**) *and* creates the place where
validation belongs. The two problems have one answer.
*Consequences:* §20. *Conflicts:* C-56, C-57, **C-68**. *Owner:* **16**, **17**, **22**.
*Owner decision:* NO.

**AD-018 · The public `/uploads` mount leaves the target architecture**
*Audit:* 7.9. *Decision:* **removed.** Durable product files are served through the designed
acceptance, publication and access architecture — never because a directory is publicly mounted.
*Consequences:* §20.4. *Conflicts:* **C-68**. *Owner:* **22**. *Owner decision:* NO.

**AD-019 · Import limits apply at the parsing boundary**
*Audit:* 7.7, 7.8. *Decision:* **input-resource limits exist before or at the parse; parser success is
never business validity; untrusted workbooks are parsed server-side only.**
*Consequences:* §21. *Conflicts:* C-58's architectural half. *Owner:* **16**. *Owner decision:* NO.

**AD-020 · Bounded read-only investigation stays; arbitrary SQL does not**
*Locked:* CAP-089, UX-098. *Audit:* 5.1–5.4 · Legal Phase A.3. *Current:* substantially hardened, but
dependent on a migration CI skips.
*Decision:* **the distinction is privilege, not syntax.** A capability enforced by database grants,
read-only transactions and credential-excluding views is in the architecture; a text box with
application write privilege is not. **Database administration proper is outside the application.**
*Rejected:* removing CAP-089 (the locked stages require it) · regex filtering of SQL (the code's own
commentary shows why it cannot work).
*Consequences:* §26. *Conflicts:* **C-73**. *Owner:* **15/21** (prove the migration) · **16**.
*Owner decision:* NO.

**AD-021 · Reporting composes; it never owns**
*Locked:* I-10, MOD-010. *Audit:* 10.8 — duplicated workflow state across columns.
*Decision:* **operational modules ask the owner; Reporting never decides lifecycle state.**
*Consequences:* §19.1. *Conflicts:* C-45's target. *Owner:* **13**, **15**. *Owner decision:* NO.

**AD-022 · Scope is applied in the query, never after it**
*Decision:* **no global retrieval followed by application- or client-side filtering.**
*Reason:* a filter in front of a platform-wide read is a tenant leak that happens to render correctly.
*Consequences:* §19.3. *Owner:* **13**, **15**. *Owner decision:* NO.

**AD-023 · Failures never become empties, zeros or healthies**
*Locked:* PP-009, DESIGN_SYSTEM §15. *Audit:* 1.13, 10.10.
*Decision:* **a failed read reaches the client as a failure**, and a partially-failed composed read
reports which part failed.
*Consequences:* §28, §33.4. *Conflicts:* C-32's architectural half, **C-69**, **C-70**.
*Owner:* **14**, **16**. *Owner decision:* NO.

**AD-024 · One persistence semantics in production**
*Audit:* 10.11. *Decision:* **development and test substitutes never change business-integrity rules;
memory-mode is not part of the target production architecture.**
*Consequences:* §31.2. *Conflicts:* **C-71**. *Owner:* **13**, **20**, **21**. *Owner decision:* NO.

**AD-025 · The runtime does not mutate schema; release state is one thing**
*Audit:* 3.11, 3.12, 11.1, 11.2, 11.8, 11.9, 14.3. *Current:* startup DDL **removed** (SAR-018);
deployment still applies no migrations.
*Decision:* **migration is a deployment input; a missing required schema object is an incompatible
deployment, not an absent feature; source, schema, dependencies, configuration and test result are one
release state.**
*Consequences:* §33. *Conflicts:* **C-72**, and C-61's target. *Owner:* **15**, **21**.
*Owner decision:* NO.

**AD-026 · Technical logging and audit are separate systems**
*Audit:* 10.7, 13.1, 13.2. *Decision:* **a log is disposable; an audit event is a product fact owned by
MOD-013.** Consequential acts require their audit to share the business outcome's fate.
*Consequences:* §27. *Conflicts:* C-62's target. *Owner:* **16**, **19**. *Owner decision:* NO.

**AD-027 · Lifecycle status is not erasure**
*Audit:* 6.1, 6.5, 6.9. *Decision:* **three distinct concepts, named distinctly**; erasure must be able
to prove completeness; **SA-P19** — a declared control maps to a real one.
*Recorded honestly:* immutable history (PP-006) and erasure are in genuine tension, unresolved here.
*Consequences:* §30. *Owner:* **16** · external legal review. *Owner decision:* NO.

**AD-028 · UK/EU processing is a topology property**
*Locked:* TQ-1. *Decision:* **every processor of product data is placed inside the policy**, and the
boundary map (§32.1) is part of the architecture rather than a procurement note.
*Consequences:* §32. *Conflicts:* C-63's target. *Owner:* **16**, **21** · external legal review.
*Owner decision:* NO.

**AD-029 · Provider callbacks are untrusted input**
*Audit:* 4.15, 4.16, 4.17. *Decision:*

```
provider callback
  → integration boundary          MOD-015
  → authenticity · replay · idempotency checks
  → internal interpretation
  → owning module                 MOD-007 decides settlement — never the provider
```

**Never** `provider → settled = true`. *Rejected:* trusting a signature alone (4.16 shows replay is a
separate problem) · computing signatures over reserialised bodies (4.15).
*Consequences:* §38, §39. *Owner:* **16**, **17**. *Owner decision:* NO.

**AD-030 · Public CMS uses a rendered/static delivery path**
*Locked:* Stage 9 S-5; Stage 11 left rendering to Stage 12.
*Decision:* **the authenticated ScholarShelf application remains a React/Vite SPA. The optional public
school website uses a rendered/static public delivery path. The public path receives only published
CMS content and permitted Core school identity. Website Studio remains inside the authenticated
ScholarShelf application.**
*Reason:* the public school website is a genuine public website product rather than another
authenticated ScholarShelf screen. It needs proper public delivery and indexability — search
reachability, shareable links, page metadata, social previews, fast public loading — while preserving
a structurally minimal public trust boundary. Option B lets the public edge carry no authenticated
application code at all, which turns §5.1's boundary from a discipline into a structural property.
*Not decided here:* the physical renderer, entry points and build structure — **Stage 13**; deployment
execution — **Stage 21**. No framework migration: React 19 + Vite 7 + Express 5 stand.
*Consequences:* §5.1–§5.4. *Owner:* **13**, **21**.
*Owner decision:* **DECIDED — AQ-1 = B**, 29 August 2026.

---

## 38. External provider callbacks

```
EXTERNAL SIGNAL ARRIVES
      ↓
INTEGRATION BOUNDARY              MOD-015 — outside the business boundary
      ↓
AUTHENTICITY · REPLAY · IDEMPOTENCY
      ↓
INTERNAL INTERPRETATION           what this signal means in ScholarShelf's terms
      ↓
OWNING MODULE                     which decides whether anything is now true
```

**SA-P10.** A valid signature proves the message came from the provider. It does not make the message a
business fact, and it does not make it *new* — audit 4.16 records that replay is a separate control
from authenticity.

**No webhook signature scheme, timestamp tolerance or event-store design is defined here** (Stage 16/17).

---

## 39. Future payment provider

```
FUTURE

payment provider
  → MOD-015                 verified external fact
  → MOD-007                 settlement interpretation
  → settlement decision     ScholarShelf's, always
```

**Never** `provider → settled = true` directly.

**No provider is selected** — TD-042 defers that to Stage 17, and Stage 12 does not pre-empt it. Audit
4.17 (an incomplete integration with no call site, no timeout, no retry, no response validation, no
idempotency, no reconciliation) is precisely why activating an integration is a designed piece of work,
not a switch.

---

## 40. Existing conflicts addressed

| # | Stage 12's architectural target | Still open |
|---|---|---|
| **C-3** | §17, §18.3 — custody transitions inside transactional, claim-based operations | **Yes** — Stage 12/13 |
| **C-30** | §23.4 — durable, tenant-scoped digest workload | **Yes** — Stage 15/18 |
| **C-40** | §9 — capability-keyed authorisation | **Yes** — Stage 13/16 |
| **C-41** | §38 — integration credentials bound at a named boundary | **Yes** — Stage 16 |
| **C-42** | §15, §15.4 — orchestration layer; transport never reaches persistence | **Yes** — Stage 13 |
| **C-44** | §5 — three bands with distinct scope bases | **Yes** — Stage 13 owns the physical split |
| **C-45** | §19.1 — Reporting asks the owner; it never recomputes | **Yes** — Stage 13/15 |
| **C-46** | §22 — durable notification truth, then eligible delivery | **Yes** — Stage 15/17 |
| **C-50** | §9, §12.3 — authorities evaluated within the active context | **Yes** — Stage 13 |
| **C-56** | §20 — object storage with an acceptance boundary | **Yes** — Stage 16/17/22 |
| **C-57** | §20.2 — direct upload removes the body limit from the path | **Yes** — Stage 13 |
| **C-58** | §21 — the parser is a trust boundary; server-side only | **Yes** — Stage 16/22 |
| **C-61** | §33 — one reviewed migration path as a deployment input | **Yes** — Stage 15/21 |
| **C-62** | §27.1 — correlation across logs, tracker and support reference | **Yes** — Stage 16/21 |
| **C-63** | §32 — processing boundaries as topology | **Yes** — Stage 16/21 |

**An architectural target is not an implementation.** Every row remains open in the repository.

---

## 41. Conflicts carried forward, unchanged by Stage 12

**C-1 · C-2 · C-4 · C-5 · C-6 · C-7 · C-9 · C-11 · C-12 · C-13 · C-14 · C-15 · C-17 · C-18 · C-19 ·
C-20 · C-22 · C-23 · C-24 · C-25 · C-26 · C-27 · C-28 · C-29 · C-31 · C-32 · C-33 · C-35 · C-36 ·
C-37 · C-38 · C-39 · C-43 · C-47 (WITHDRAWN) · C-48 · C-49 · C-51 · C-52 · C-53 · C-54 · C-55 ·
C-59 · C-60** — all as their owning stages left them.

**C-32** receives an architectural half (§28) but its presentation contract is Stage 10's and its
adoption is Stage 13's. **C-19** is sharpened by **C-73** — the skipped migration `001` now has a
demonstrated security consequence, not merely a deployment one.

---

## 42. New conflicts

Verified across the full document set on 25 August 2026: **C-63 is the highest identifier in use.**
New conflicts begin at **C-64**. **§72's rule applied: each is a defect verified in the current
baseline, not an audit finding copied forward.**

---

### C-64 — **OPEN** · Tenant scope is an optional argument, and absence means every tenant

**Current architecture.** `schoolFilter(table, schoolId?)` returns `undefined` when the identifier is
absent, producing a query with no tenant predicate.

**Conflict.** PP-004 locks that the tenant boundary is *"guaranteed structurally, not by convention"*.
A helper whose safe behaviour depends on every one of ~305 call sites passing a parameter correctly,
forever, is convention with a function signature around it. The choke point refuses tenant-scoped
sessions with no school — genuinely good, and preserved — but it guards sessions, not call sites.

**Why it matters.** This is the single largest structural gap between the locked architecture and the
current one. Audit 1.9 rates it Critical and audit 14.1 makes it the root of children's data being
exposed to cross-tenant failure. One missed argument is a platform-wide read.

**Target.** §10.3 — data access is either explicitly tenant-scoped or explicitly platform-scoped.
There is no third shape, and absence never means all tenants.

**Later owner.** **13** (data-access shape) · **15/16** (database integrity as the backstop).

---

### C-65 — **OPEN** · Tenant ownership is not structurally enforced by the database

**Current architecture.** No row-level security. Tenant columns are widely nullable. Relationships do
not use tenant-aware composite keys, so a record in one tenant can reference a record in another while
satisfying ordinary foreign-key rules.

**Conflict.** With C-64, isolation currently has **one** real boundary — the application remembering.
PP-004's "structurally" is not satisfied by a layer that can be bypassed by omission.

**Why it matters.** It is also why erasure cannot prove completeness (§30): if tenant ownership is not
structurally derivable, neither is "everything belonging to this tenant".

**Target.** §10.4 — the database must be one of the boundaries. **The mechanism is deliberately not
pre-selected**: RLS, non-null tenant ownership and composite tenant-aware keys are evaluated together
at Stage 15, which is the first stage with a schema to evaluate them against.

**Recorded, not adjudicated.** The corporate audit and the Legal brief's Phase B require RLS. The
project's own earlier audit deliberately deprioritised it, judging foreign keys plus isolation tests a
better return. Stage 12 states the property both agree on and leaves the choice to the stage that can
weigh it.

**Later owner.** **15** · **16**.

---

### C-66 — **OPEN** · Resource ownership is checked where remembered, not where required

**Current architecture.** Storage-level asserts (`assertStudentInSchool`, `assertBookInSchool`,
`assertClassInSchool`, `assertBookLevelInSchool`) exist at 18 call sites — real defence, and preserved.
But ownership proof is applied by developer discipline, not structurally at every point a
request-supplied identifier enters a query.

**Conflict.** SA-P7 and Stage 7's model require ownership to be part of the authorisation decision.
Today, existence plus endpoint access can suffice wherever an assert was not added.

**Why it matters.** Audit 1.10 rates it Critical: an authenticated parent, teacher or administrator who
learns another object's identifier may read or modify records outside their scope. SC-3 and SC-4 make
this worse, because "ownership" there is a live relational fact, not a column comparison.

**Target.** §11 — capability + resource + ownership + scope + conditions, evaluated together.

**Later owner.** **13** · **16**.

---

### C-67 — **OPEN** · Session-cached authority survives revocation

**Current architecture.** The **school's** lifecycle is revalidated on every request — verified, and
preserved as an invariant. The **account's** own active state, role grants and authorities are read
from the session, set at sign-in.

**Conflict.** Stage 7's conditions are live facts by construction. CD-2 staffing, CD-3 relationships,
CD-4 finance authority, CD-6 support engagement and CD-7 elevation can all lapse mid-session, and
Stage 9 §30 locks that a lapsed context must be refused with an explanation. A demoted or suspended
administrator currently retains their previous authority for the life of their session.

**Why it matters.** An administrator who suspends an account, revokes a role or resets a password
believes access has ended. Audit 1.6 and 1.7 record that it has not.

**Target.** §8 — a cached authority claim may never be the sole basis for a sensitive decision; §8.3 —
sessions must be attributable to a user and terminable as a set.

**Later owner.** **16** (revalidation and revocation mechanics) · **15** (session representation).

---

### C-68 — **OPEN** · A publicly mounted directory serves files without authorisation

**Current architecture.** `server/app.ts` mounts `/uploads` as a public static path with a one-day
cache and no authorisation in front of it.

**Conflict.** §20.3 requires that object reachability be a **decision** — public only after acceptance
and publication, private otherwise. A publicly mounted directory makes reachability a property of where
a file happened to be written.

**Why it matters.** Audit 7.9 states the threat precisely: any file written there by future or
overlooked code becomes directly public. The current upload flows do not use it, which is exactly what
makes it easy to leave in place and easy to start using again.

**Target.** §20.4 — **removed from the target architecture.** Durable product files are served through
the designed acceptance, publication and access path.

**Later owner.** **22**.

---

### C-69 — **OPEN** · Health reports readiness it has not checked

**Current architecture.** `/api/health` returns a status derived from a configured storage-mode value.
It performs no database connectivity check and no schema-readiness check.

**Conflict.** §33.1 locks that a missing required schema object is an **incompatible deployment**, not
an absent feature — and §33.4 requires process health, dependency health and readiness to be
distinguishable. A health check that cannot fail when the database is unreachable is not a health
check; it is a liveness assertion about the process.

**Why it matters.** Audit 10.10: monitoring and deployment systems classify an instance as healthy
while the database is unavailable or required migrations are missing. It is also **SA-P15** at the
infrastructure layer — a failure rendering as "healthy".

**Target.** §33.4, with the constraint that health must not expose sensitive architecture.

**Later owner.** **14** (shape) · **21** (deployment gating).

---

### C-70 — **OPEN** · Internal error detail is returned to clients

**Current architecture.** Approximately 160 route-level exception handlers return `e.message` directly
in HTTP responses.

**Conflict.** DESIGN_SYSTEM §16.2 locks what an error may and may not say: never stack traces, SQL,
internal identifiers of other tenants, file paths, library names, or anything that tells an
unauthorised person a record exists. §16.3 locks that the user gets a short opaque reference instead.

**Why it matters.** Audit 1.13 rates it High: database names, table names, constraint details and
provider responses reach whoever triggered the error. It is also the reason the locked error contract
cannot currently be delivered — there is no safe category to return and no reference to return with it.

**Target.** §28 — structured internal handling, a safe external category, a correlation reference.

**Later owner.** **14** (contract shapes) · **16** (sanitisation).

---

### C-71 — **OPEN** · Two persistence semantics can run the same product

**Current architecture.** A memory-storage fallback exists alongside PostgreSQL, selected by
`ALLOW_MEMORY_STORAGE` and `FORCE_MEMORY_STORAGE`, with `memorystore` imported by the application and
the health endpoint's own status derived from the mode.

**Conflict.** SA-P20 and the locked integrity model require exactly one production persistence
behaviour. Two modes with different persistence and integrity properties mean a test can pass against
behaviour production does not have — and I-2, uniqueness constraints and tenant integrity are precisely
the properties a memory store does not provide.

**Why it matters.** Audit 10.11: an accidental memory-mode deployment loses data on restart, and green
tests can be evidence of nothing.

**Target.** §31.2 — development and test substitutes never change business-integrity rules; memory
mode is not part of the target production architecture.

**Later owner.** **13** (fixtures) · **20** (test architecture) · **21** (configuration).

---

### C-72 — **OPEN** · Deployment applies no migrations and gates on no verification

**Current architecture.** Neither the platform configuration nor CI invokes the repository's
migrations. `verify` is **not a required status check** on `main`, so a red build still deploys, and
the branch permits direct pushes with auto-deploy to production.

**Conflict.** SA-P17 requires source, schema, dependencies, configuration and test result to be one
release state. Today each moves independently, and audit 14.3's consequence follows directly: nobody
can determine which code, schema, tests and security controls are actually active in production.

**Why it matters.** It is the mechanism behind **C-73** — a security control that exists in code but
may not exist in the running system — and behind audit 11.9, where missing tables are caught and
treated as an absent feature.

**Distinct from C-61**, which records that two schema-change *mechanisms* coexist. C-72 records that
**deployment applies neither and verifies nothing.**

**Target.** §33.1 and §33.3.

**Later owner.** **15** (baseline) · **21** (pipeline and branch protection). *Much of this is
repository settings, not code.*

---

### C-73 — **OPEN** · The console's security controls depend on a migration CI deliberately skips

**Current architecture.** The BytHub console's protections — a least-privilege `console_ro` role,
read-only transaction defaults, and views that exclude `password_hash`, `mfa_secret` and `token_hash` —
are created by `migrations/001_console_hardening.sql`. **CI applies `002`–`006` and deliberately skips
`001`**, and no deployment step applies migrations at all (**C-72**).

**Conflict.** SA-P19: a declared control must map to a real implemented control. The repository contains
a genuinely well-designed console hardening — and **no evidence establishes that it is in force in the
running system.** The environment schema's design means an unconfigured console simply reports as
unavailable, which is a correct failure mode but also means absence is silent.

**Why it matters.** Audit 5.3 found precisely this shape once already: *"the repository appears to
contain console isolation controls while production continues using the unhardened path."* The code has
moved on substantially since; the deployment gap that made 5.3 true has not.

**This is the sharpest form of C-19.** That conflict records that migration `001` cannot run on a fresh
database. C-73 records the **security consequence**: the most privileged surface in the product may be
running without the controls designed for it.

**Target.** §26 · §33.1 — the required schema is part of the release, and a control that is not applied
is not a control.

**Later owner.** **15** (resolve `001` and the baseline) · **21** (apply and prove it) · **16**
(operational verification).

---

## 43. Architecture risk register

| ID | Risk | Likelihood | Impact | Mitigation | Decision | Later owner |
|---|---|---|---|---|---|---|
| **AR-001** | Tenant enforcement remains caller-dependent after refactor — the fail-open shape is reproduced in a new data layer | **MEDIUM** | **VERY HIGH** | AD-004's rule is structural, not advisory; database boundary (AD-005) as backstop; isolation tests in CI | AD-004, AD-005 | 13, 15, 20 |
| **AR-002** | Stale authority survives because revalidation is added but cached for performance | **MEDIUM** | **HIGH** | AD-003 — a cached claim is never the *sole* basis; Stage 16 sets the window deliberately, with revocation propagation | AD-003 | 16 |
| **AR-003** | A cross-module act is written outside the orchestration layer and bypasses the transaction | **MEDIUM** | **VERY HIGH** | AD-008 — transaction scope belongs to a named orchestration step; AD-012 — the connection cannot hold a transaction otherwise | AD-008, AD-011 | 13, 20 |
| **AR-004** | Transport reaches persistence directly again as a convenience | **MEDIUM** | **HIGH** | AD-009; verified today in five route files, so the pull is real | AD-009 | 13 |
| **AR-005** | Direct object upload bypasses finalisation, so bytes become product content without acceptance | **MEDIUM** | **HIGH** | AD-017 — a pending object is unreferenced and unreachable until finalised | AD-017 | 16, 17 |
| **AR-006** | A privileged console is rebuilt and recreates a global database bypass | **LOW** | **VERY HIGH** | AD-020 — privilege, not syntax; database administration is outside the application | AD-020 | 16, 21 |
| **AR-007** | An asynchronous consequence quietly becomes authoritative truth | **MEDIUM** | **HIGH** | AD-014 — truth commits first; SA-P9; MOD-007 alone decides settlement | AD-014, AD-029 | 15, 17 |
| **AR-008** | Platform context is used as a null-tenant shortcut for convenience | **MEDIUM** | **VERY HIGH** | SA-P13; §12.4; the choke point's refusal preserved as an invariant (SAR-006) | AD-004 | 13, 16 |
| **AR-009** | Deployment and schema diverge again after the pipeline is built | **MEDIUM** | **HIGH** | AD-025 — one release state; readiness check (C-69) makes divergence visible rather than silent | AD-025 | 15, 21 |
| **AR-010** | Duplicate job execution produces duplicate business effects | **LOW** | **HIGH** | AD-013, AD-016 — atomic claim; cron firing twice is harmless by construction | AD-016 | 15, 18 |
| **AR-011** | A provider callback is replayed and repeats a confirmation | **MEDIUM** | **HIGH** | AD-029 — authenticity, replay and idempotency are three separate checks | AD-029 | 16, 17 |
| **AR-012** | The public CMS surface acquires an operational reach through a shared code path | **LOW** | **VERY HIGH** | §5.1, §24.3 — structural, not filtered: AUTH-CMS carries no operational authority | AD-030 | 13 |
| **AR-013** | Regional processor drift — a provider is added later outside the UK/EU policy | **MEDIUM** | **MEDIUM** | AD-028 — the boundary map is part of the architecture and is reviewed when a processor is added | AD-028 | 16, 17, 21 |
| **AR-014** | The architecture is treated as security clearance | **MEDIUM** | **HIGH** | §1.3 — architecture approval ≠ security clearance ≠ legal sign-off; the go-live block is not cleared by this document | — | 16, 21, legal |
| **AR-015** | Remediation is declared complete against an audit performed on a different revision | **MEDIUM** | **HIGH** | §36 — every finding re-verified against the current tree and classified; revision-dependent entries carry an explicit verification owner | — | 16, 20 |

---

## 44. Corporate-audit domain traceability

| Audit domain | Stage 12 | Later stages |
|---|---|---|
| **1. Auth, privilege & secrets** | §§6–9, 25, 26 | 16 (mechanics) · 21 (credential rotation) |
| **2. MFA, recovery & identity** | §8, §29.2 | 16 · 15 (uniqueness) |
| **3. Database, tenant isolation & integrity** | §§10, 11, 18, 31.3 | 15 · 16 |
| **4. Financial, payments & inventory** | §§17, 18, 38, 39 | 15 · 17 · 18 (N+1 performance) |
| **5. Admin console & destructive operations** | §26 | 16 · 21 · 22 |
| **6. Data lifecycle, deletion & privacy** | §§30, 32 | 16 · legal review |
| **7. File upload, import & stored content** | §§20, 21 | 16 · 17 · 22 |
| **8. Email, notifications & communications** | §§22, 23 | 15 · 17 |
| **9. Frontend security, state & accessibility** | §§28, 16 *(9.1, 9.9 only)* | 10 (locked) · 13 · 16 · 21 |
| **10. Backend architecture & modularity** | §§13–17, 19, 31, 33 | 13 · 15 |
| **11. Testing, CI/CD & deployment governance** | §33 | 20 · 21 |
| **12. Dependency & supply chain** | — | 11 (decided) · 22 |
| **13. Observability, reliability & incident response** | §§27, 29 | 16 · 19 · 21 |
| **14. Overall business risk** | §§1.3, 10, 17, 33; AR-014 | 16 · 21 · legal review |

**Stage 12 does not resolve every audit finding**, and does not claim to. It places each
architecture-material one where the architecture can answer it, and assigns the rest.

---

## 45. Owner decisions — all DECIDED

```
OPEN STAGE 12 OWNER QUESTIONS: 0
```

**AQ-1 · How is the public school website delivered? — DECIDED B**, 29 August 2026, by the owner
(BytHub Technology Ltd).

**The decision, in full:**

- **ScholarShelf Website Studio remains the no-code authenticated management surface**, inside the
  authenticated ScholarShelf application. School staff manage pages, news, events, media, public
  contact information and website presentation without touching HTML, CSS, JavaScript, React, Git,
  source code, Vercel or hosting configuration.
- **The optional school website uses a rendered/static public delivery path.**
- **The authenticated ScholarShelf application remains a React/Vite SPA.** No SSR migration, no
  Next.js, no meta-framework. Stage 11's stack is untouched.
- **The public site consumes only published CMS content and permitted Core school identity** — the
  §5.2 allowlist, structurally, not by field-stripping operational records.
- **MOD-001** owns CMS entitlement and Core school identity; **MOD-011** owns website content, drafts,
  publication and public presentation. CMS never becomes the owner of Core identity.
- **Physical application structure is Stage 13. Deployment execution is Stage 21.**

*Why the locked stages could not decide it.* Stage 9 locked *what* S-5 contains; Stage 10 locked its
presentation contract; Stage 11 locked React, Vite and Express and explicitly deferred the public
site's rendering to Stage 12. Both options satisfied every locked requirement, and the difference was
a product and commercial judgement about whether a school's website needs to be found. The owner has
now made that judgement.

*The reasoning recorded at the time of the recommendation is preserved.* Option A — client-rendered
inside the existing SPA — offered one delivery path, one build, one deployment, and nothing new to
operate, at the cost of weak search indexing and link previews and slower first paint. Option B —
a rendered/static public path with the authenticated application staying an SPA — offered proper
indexability and previews, faster public first paint, and a public edge that can carry **no
authenticated application code at all**, at the cost of a second delivery path to build and keep
consistent, and publication having to invalidate what is cached or pre-rendered. **B was recommended
and B was chosen.**

**There are zero open Stage 12 owner questions.**

---

## 46. What Stage 12 deliberately does not decide

| Not decided | Owner |
|---|---|
| Folders · filenames · service and repository classes · component trees · routing structure · physical band separation · connection helpers · fixture architecture | **Stage 13** |
| HTTP endpoints · verbs · request and response shapes · error contract shapes · health response shape | **Stage 14** |
| Tables · columns · indexes · RLS policy · foreign-key definitions · session record · job record · notification record · money representation · constraints · migration content and ordering | **Stage 15** |
| Authentication and session mechanics · revalidation frequency · revocation propagation · Argon2 parameters · MFA and recovery mechanics · CSRF mechanism · rate-limit mechanism · signed-URL durations · upload scanning and sanitisation · log redaction policy · erasure process · elevation mechanics · operational database access | **Stage 16** |
| Object-storage provider · email templates · payment provider · webhook signature scheme · integration design | **Stage 17** |
| Scale thresholds · RPO and RTO · alerting · N+1 and performance remediation | **Stage 18** |
| Audit record · immutability and tamper evidence · retention | **Stage 19** |
| Test strategy · coverage · which invariants are tested how | **Stage 20** |
| Deployment pipeline · branch protection · migration execution · region configuration · log destinations · credential rotation | **Stage 21** |
| **Which implementation survives · legacy removal · asset migration · migration order** | **Stage 22** |
| Legal and compliance determinations · DPA · DPIA · retention law · transfer mechanisms · whether the go-live block may be lifted | **BytHub legal and security review** |

---

## 47. Success criteria — answered

```
Is ScholarShelf microservices?                          → NO
Is it still a monolithic god-object design?             → NO
Target?                                                 → one coherent modular application

Is session data itself permission authority?            → NO
Can revoked authority survive because session JSON
  still contains it?                                    → NO in the target. YES today — C-67.

Can an optional schoolId omission create global access? → Target says NO. It CAN today — C-64.
Is tenant isolation one WHERE clause?                   → NO. Four boundaries, §10.2.
Do object IDs prove access?                             → NO. A locator is not an authority.

Can route handlers bypass domain ownership?             → Target says NO.
Can routes execute arbitrary Drizzle writes?            → Target says NO. Five files do today.
Can owner login imply arbitrary SQL access?             → NO. Privilege, not syntax — §26.

Does successful object upload mean trusted content?     → NO. Arrival is not acceptance.
Can notification truth disappear because Resend fails?  → NO.
Can Cron failure erase work?                            → NO. The work is durable.
Can startup silently alter production schema?           → NO. Already removed — preserved as invariant.
Can missing required schema look like healthy optional
  absence?                                              → Target says NO. It can today — C-69.

Does the browser decide business authority?             → NO.
Does Reporting decide settlement?                       → NO. It asks MOD-007.

Does I-2 remain one transaction?                        → YES.
Can Neon HTTP single-statement mode execute I-2?        → NO.
Can a queue enter I-2?                                  → NO.

Can the public CMS see operational data?                → NO. Structurally, not by filtering.

Does Stage 12 declare ScholarShelf legally compliant
  or production-ready?                                  → NO. The go-live block is NOT cleared.
Have audit findings been reconciled, not copied?        → YES. 33 SAR entries, each re-verified.
Have folders, endpoints or tables been designed?        → NO.
```

---

## 48. Summary

1. **20 architecture principles**, SA-P1…SA-P20.
2. **30 architectural decisions**, AD-001…AD-030 — AD-030 now settled by AQ-1 = B.
3. **33 audit reconciliation entries**, SAR-001…SAR-033 — every one re-verified against the working
   tree on 25 August 2026, not copied from the report.
4. **15 architecture risks**, AR-001…AR-015.
5. **One coherent modular application** plus managed external dependencies. No microservices, no
   queue, no event bus, no saga, no distributed transaction, no service mesh, no Kubernetes.
6. **I-2 remains one process, one transaction, one commit** — and the audit's payment race is
   **verified already remediated**, so it is preserved as an invariant rather than raised as a fresh
   conflict.
7. **Ten new conflicts, C-64…C-73**, each a defect verified in the current baseline.
8. **Five audited defects verified already fixed** and preserved as invariants — the fail-open guard,
   null-school refusal, atomic confirmation, console hardening (in code), and removed startup DDL.
9. **Zero open owner questions. AQ-1 — DECIDED B**: the authenticated application stays a React/Vite
   SPA; the optional public school website uses a rendered/static delivery path; Website Studio stays
   inside authenticated ScholarShelf as the school's no-code control plane.
10. **Stage 12 grants no production, security or legal clearance.** The Legal & Compliance go-live
    block of 23 August 2026 stands, and only security re-audit and BytHub's legal review can address
    it.

---

## 49. Locking discipline

```
STAGE 12 — SYSTEM ARCHITECTURE
STATUS: LOCKED
Locked: 29 August 2026 by the owner (BytHub Technology Ltd)
Open owner questions: 0
```

Later stages **may** implement Stage 12, **may** discover implementation conflicts, and **may** record
traceable owner amendments. They **may not silently rewrite locked architecture**. Where a later
finding conflicts with this document, the conflict is **flagged**, not absorbed.

**Changes that require a traceable owner amendment — never a silent rewrite:**

| Locked here | Would require amendment if changed to |
|---|---|
| One modular application | Microservices |
| Server authority | Client authority |
| Session ≠ authority | Session-only authority |
| Tenant defence in depth | A caller convention |
| **I-2** — synchronous, atomic | Asynchronous or eventual settlement |
| Private ScholarShelf SPA **+** public rendered/static site | One undifferentiated public/private SPA |
| Website Studio inside authenticated ScholarShelf | An external, separate CMS administration product |
| Public CMS boundary | Operational data becoming publicly reachable |

**Stage 12 architecture approval ≠ production security clearance ≠ legal sign-off.** Locking this
document does **not** clear the corporate go-live block, does **not** make ScholarShelf
production-ready, does **not** certify GDPR or any other compliance, and is **not** legal approval.
The BytHub Legal & Compliance deployment halt and production go-live block of 23 August 2026 —
17 Critical, 52 High, 14 domains, 0% compliance clearance — **stands in full**. The company security
and legal re-audit requirement remains outstanding.

```
STAGE 12 — SYSTEM ARCHITECTURE
STATUS: LOCKED — 29 August 2026
AQ-1 — DECIDED B · OPEN OWNER QUESTIONS: 0
Stage 13 is authorised. The go-live block of 23 August 2026 stands.
```
