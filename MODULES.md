# MODULES.md — Stage 8: Product & Module Architecture

```
STAGE 8 — PRODUCT & MODULE ARCHITECTURE
STATUS: LOCKED
Locked: 24 August 2026 by the owner (BytHub Technology Ltd)
```

**What "locked" means here.** Later stages **may** implement this architecture, **may** discover
conflicts with it, and **may** record traceable owner amendments. They **must not** silently rewrite
the locked module ownership architecture. A conflict is flagged, not absorbed.

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` — all LOCKED.
**Compared against** `CURRENT_SYSTEM_MAP.md` · `CURRENT_BEHAVIOUR_BASELINE.md` ·
`RESTRUCTURE_STATE.md` · `REBUILD_SAFETY.md`.

**Conceptual module architecture only.** No folders, files, packages, classes, routes, endpoints,
tables, keys, deployments, queues or screens. Those belong to Stages 12–15 and Stage 9.

**A module boundary is not a deployment boundary.** The default architectural assumption remains **one
coherent ScholarShelf application with explicit internal domain boundaries**. Nothing in this document
proposes microservices, separate databases, message buses or network calls between modules.

---

## 1. Purpose and architectural principles

Stage 8 answers one question: **which part of ScholarShelf owns this responsibility?** — and requires
exactly one answer each time.

**How a module was derived.** Not from route files. A candidate became a module only if it passed all
of these:

| Test | Question |
|---|---|
| **Cohesion** | Do the things inside change for the same business reasons? |
| **Ownership** | Can we say in one sentence what truth it owns? |
| **Boundary** | Can we say what it must *not* own? |
| **Consumability** | Can others use it without taking over its responsibility? |
| **Optionality** | If optional, can Core run without it? |
| **Security** | Does the boundary preserve Stage 7 authority and scope? |
| **History** | Does it preserve Stage 6 event and history semantics? |
| **Future** | Does it avoid blocking online payment, postal fulfilment or MIS integration — without designing them? |

**Five principles.**

**A1 · One authoritative owner per concept.** Every one of the 57 Stage 6 concepts has exactly one
owning module. Others consume; they do not co-own.

**A2 · Derived truth has a responsible deriver, not a second owner.** Settlement position, custody
holding and access context are computed. The module responsible for computing each is named. That is
not the same as storing it.

**A3 · Truth ownership is directional even when workflows are not.** A workflow may cross six modules.
Ownership still points one way.

**A4 · Optional means removable.** If the CMS is absent, every Core workflow still runs. Core may not
depend on it in any direction.

**A5 · Internal is not "Core with a null tenant".** BytHub platform operations are a distinct band,
not an administrator whose `schoolId` happens to be empty.

---

## 2. Product bands

```
SCHOLARSHELF
│
├── CORE                      the book-supply operation and everything required to run it
│     MOD-001 … MOD-010
│
├── OPTIONAL                  separately positioned; Core never depends on it
│     MOD-011  School Website (CMS)
│
├── INTERNAL (BytHub)         operating ScholarShelf itself — not a customer product
│     MOD-012  Platform Operations
│
└── INFRASTRUCTURE            genuinely cross-cutting concerns with no business truth of their own
      MOD-013 Audit · MOD-014 Scheduled Work · MOD-015 Delivery & Integration Gateways
```

**Core is not one module.** The lifecycle is one *spine*, but the things along it change for different
reasons: a catalogue changes when a school buys different books; settlement changes when a funding
route is added; custody changes when a fulfilment route is added. Those are separate reasons to
change, so they are separate modules.

---

## 3. Module catalogue

### CORE

---

**MOD-001 · Tenancy & School Configuration** — CORE

| | |
|---|---|
| **Purpose** | What a school *is* to ScholarShelf, which ScholarShelf modules it has, and how it has configured its permitted variance. |
| **Owns** | The school · the school code · **core school identity and application branding** · school policy · **module entitlement — which optional ScholarShelf modules the school has access to** [LOCKED MA-2] |
| **Does not own** | Anything about children, classes, money or books · website presentation · **any optional module's functionality or data** · platform lifecycle *decisions* (it holds the state; MOD-012 acts on it) · **commercial billing, subscriptions, pricing or licensing** — entitlement is the bare fact, nothing more |
| **Primary concepts** | DM-001, DM-002, DM-003, DM-004, **module entitlement** *(see the §7 traceability note)* |
| **Primary capabilities** | CAP-001, 002, 003 |
| **Rules protected** | BR-033 school code resolves identity · BR-034 one design system, tenant branding · BR-035 core identity is Core · BR-036 family communication carries the school's identity · BR-037/038/041 policy · BR-001–007 the tenant itself |
| **Consumes from** | nothing |
| **Consumed by** | every Core module, MOD-011, MOD-012 |
| **Must never depend on** | MOD-011 (CMS), MOD-010 (Reporting), any operational module |
| **Today** | `schools`, `school_branding`, scattered setup routes. Branding is fused with website styling (**C-5**). No policy concept at all (**C-17**). |

> **This module is the reason a school that never buys the CMS still has branded dashboards, a branded
> family portal and branded transactional email.**

> **[LOCKED MA-2] Knowing an entitlement is not depending on a module.**
> ```
> MOD-001 knows:  "This school has the CMS module."
> MOD-011 owns:   website configuration · page sections · drafts · publishing
>                 media · website presentation · public rendering
> ```
> The dependency rule is unchanged: **MOD-011 may depend on permitted Core information; Core must not
> require MOD-011 to operate.** MOD-001 holds a fact *about the school*, not a reference to the
> module's behaviour, data or implementation.
>
> **Reusable principle:** *which ScholarShelf modules a school is entitled to use is a school /
> product-configuration fact owned by MOD-001.* This may be reused for any future optional module
> unless a later owner decision changes it. **No licensing system, pricing model, subscription,
> billing or feature-flag mechanism is designed here**, and no future modules are invented.

---

**MOD-002 · Identity & Access** — CORE

| | |
|---|---|
| **Purpose** | Who a person is on the platform, what authority they hold, and which context is active. |
| **Owns** | Person account · role grant · staff profile · invitation · session · **derivation of access context and active authorities** |
| **Does not own** | The guardian record (MOD-004) · class staffing (MOD-003) · school policy (MOD-001) — it **reads** all three to derive context |
| **Primary concepts** | DM-007, DM-008, DM-009 *(derived)*, DM-011, DM-012, DM-015 |
| **Primary capabilities** | CAP-030–039 |
| **Rules protected** | BR-010/011 person ≠ account · BR-012 role from session · BR-013 authority against active context · BR-014 a context may be earned · BR-016–024 account authority · BR-026–031 |
| **Consumes from** | MOD-001 (school, policy); **reads relationship facts** from MOD-003 and MOD-004 |
| **Consumed by** | every module, as the guard at its boundary |
| **Must never depend on** | MOD-010, MOD-011 |
| **Today** | `users` (identity + tenancy + role fused) · `user_permissions` carrying three unrelated concerns (**C-23**) · a 1,100-line auth middleware · **authorisation keyed on role, not authority (C-40)** |

> **This is where the Stage 7 authority layer lives conceptually.** Stage 8 gives it a home; Stages
> 12–13 build it. C-40 is not resolved here.

---

**MOD-003 · Academic Structure** — CORE

| | |
|---|---|
| **Purpose** | The shape of the school's year, its teaching groups, and who teaches whom, over time. |
| **Owns** | **Academic period** (school-owned, OD-2) · class · subject · **class staffing** (time-bounded) · **class membership** (time-bounded) |
| **Does not own** | The child as a person (MOD-004) · what a class needs (MOD-006) |
| **Primary concepts** | DM-016, DM-017, DM-018, DM-019, DM-021 |
| **Primary capabilities** | CAP-004, 005, 014, 015, 016, 017, 019 |
| **Rules protected** | BR-040 school-appropriate vocabulary · BR-044–049 period and history · BR-051–054 teacher scope and time bounds |
| **Consumes from** | MOD-001, MOD-004 (the child being placed) |
| **Consumed by** | MOD-002 (staffing → teacher context), MOD-006, MOD-008, MOD-009, MOD-010 |
| **Must never depend on** | MOD-007, MOD-008, MOD-011, MOD-010 |
| **Today** | `classes` with a legacy `teacherId` · `class_teacher_assignments` · `subjects` · **`students.classId` — a mutable pointer, so history is rewritten (C-9)** · no time bounds (**C-14**) |

> **Owns the two scope primitives the whole authorisation model rests on.** `ASSIGNED_CLASSES` and
> the membership half of `ASSIGNED_CHILDREN` are both derived from facts this module owns.

---

**MOD-004 · Children & Families** — CORE

| | |
|---|---|
| **Purpose** | The children the school serves and the adults responsible for them. |
| **Owns** | Child · family · **guardian record** · **guardian–child relationship** · linking code |
| **Does not own** | Class placement (MOD-003) · the parent's *account* (MOD-002) · what the child needs (MOD-006) |
| **Primary concepts** | DM-010, DM-013, DM-014, DM-020, DM-022 |
| **Primary capabilities** | CAP-018, 020, 021, 022–029 |
| **Rules protected** | BR-003 parents scoped by relationship · BR-010 guardian ≠ account · BR-024/025 · BR-094–108 import and linking |
| **Consumes from** | MOD-001, MOD-003 (to place a child) |
| **Consumed by** | MOD-002 (relationship → parent context), MOD-006, MOD-007, MOD-008, MOD-009, MOD-010 |
| **Must never depend on** | MOD-007, MOD-011, MOD-010 |
| **Today** | `students`, `families`, `family_students`, `guardians` — **`guardians` is already the right shape** · guardian–child relationship split across `parent_children` (email-keyed) and `family_students` |

> **Enrolment import is a workflow this module owns**, not a module. Both FQ-01 modes write here, and
> into MOD-003 for placement.

---

**MOD-005 · Catalogue & Inventory** — CORE

| | |
|---|---|
| **Purpose** | What books exist, in what packages, as what physical objects, and how many there are. |
| **Owns** | Book product · bundle · bundle line · **physical copy** (identity and condition) · **stock movement** |
| **Does not own** | **Where a copy is** — that is custody (MOD-008) · what a class or child needs (MOD-006) |
| **Primary concepts** | DM-026, DM-027, DM-028, DM-031, DM-032 |
| **Primary capabilities** | CAP-006, 007, 010, 011, 012, 013 |
| **Rules protected** | BR-060 non-negative price · BR-061 exact money · BR-062 movement is recorded, not applied · BR-063 shortfall is visible |
| **Consumes from** | MOD-001 |
| **Consumed by** | MOD-006, MOD-007 *(stock check)*, MOD-008, MOD-010 |
| **Must never depend on** | MOD-006, MOD-007, MOD-008 |
| **Today** | `books`, `book_levels`, `book_level_items`, `book_copies`, `book_inventory_transactions`. **`book_inventory_transactions` is already event-shaped with before/after — keep it.** `book_copies.status` fuses condition, commitment and location. |

---

**MOD-006 · Book-Supply Cycle & Requirements** — CORE · **the spine**

| | |
|---|---|
| **Purpose** | What each child needs this academic year, as one record per child per period. |
| **Owns** | **Book-supply cycle** · **requirement item** · requirement line · class requirement assignment · child requirement override |
| **Does not own** | How it was paid for (MOD-007) · how the books reached the child (MOD-008) · the class or period themselves (MOD-003) |
| **Primary concepts** | DM-023, DM-024, DM-025, DM-029, DM-030 |
| **Primary capabilities** | CAP-008, 009, 040–044 |
| **Rules protected** | **BR-042 one cycle per child per period, created at enrolment** · BR-043 mid-year activity stays inside · BR-045/046 history immutable in meaning · BR-050 joiners · BR-057–059 requirements · **BR-126 empty ≠ nothing required** · **BR-127–129 requirement items** |
| **Consumes from** | MOD-003 (period, class, membership), MOD-004 (child), MOD-005 (bundles, products, price at capture) |
| **Consumed by** | MOD-007, MOD-008, MOD-009, MOD-010 |
| **Must never depend on** | MOD-007, MOD-008 — **the spine does not depend on how money or books moved** |
| **Today** | **Does not exist.** Approximated by `child_book_baskets` with one `totalAmount` and no owning cycle (**C-37**, **C-9**). |

> **The cycle is a business concept, not a UI convenience.** It must not be scattered back across
> payments, orders, allocations and student status.

---

**MOD-007 · Settlement & Funding** — CORE

| | |
|---|---|
| **Purpose** | What is owed, how it was settled, and who decided not to charge it. |
| **Owns** | **Money event** · **payment application** · **funding adjustment** · payment reference · provider payment record · verification attempt · **replacement charge decision** · **derivation of settlement position** |
| **Does not own** | The requirement item itself (MOD-006) · allocation or stock (MOD-005/008) · the replacement *request* (MOD-008) |
| **Primary concepts** | DM-033, DM-034, DM-035 *(derived)*, DM-036, DM-037, DM-038, DM-046, DM-057 |
| **Primary capabilities** | CAP-045–057, CAP-070 |
| **Rules protected** | **BR-064 six values distinctly** · **BR-065 one position, several routes** · **BR-066 a waiver is never a payment** · BR-067/068 · BR-069 finance authorises · BR-071–076 · **BR-077–081 the atomic confirmation** · BR-118/119 attribution |
| **Consumes from** | MOD-006 (requirement items), MOD-004 (family), MOD-005 (stock availability), MOD-001 |
| **Consumed by** | MOD-008 *(confirmation triggers fulfilment)*, MOD-009, MOD-010 |
| **Must never depend on** | MOD-011, MOD-010 |
| **Today** | `book_payments` fusing money event, position, order lifecycle and collection lifecycle · `basket_payments` (link, no amount) · `provider_payments` · **no cash, instalments, subsidy or waiver at all (C-11)** |

> **One module, six routes.** There is deliberately no Cash Module, Stripe Module, Subsidy Module or
> Waiver Module. They are different paths to one coherent settled position.

---

**MOD-008 · Fulfilment & Custody** — CORE

| | |
|---|---|
| **Purpose** | Getting the physical books to the child, and knowing where they are on the way. |
| **Owns** | **Allocation** · **fulfilment instruction** (route) · **custody event** · **hand-over** · fulfilment exception · replacement request · return processing · dispatch *(future)* · **derivation of custody holding** |
| **Does not own** | Stock counts (MOD-005) · copy identity (MOD-005) · whether a replacement is chargeable (MOD-007) · settlement (MOD-007) |
| **Primary concepts** | DM-039, DM-040, DM-041 *(derived)*, DM-042, DM-043, DM-044, DM-045, DM-048, DM-056 *(future)* |
| **Primary capabilities** | CAP-058–069, CAP-071 |
| **Rules protected** | BR-039 route per child · BR-082 three distinct facts · **BR-083 one event modelled once** · BR-085–093 custody · BR-087 route determines path · **BR-056/131 the guardian block** · BR-109–113 · BR-130 authorised recipient · BR-091 exceptional return only |
| **Consumes from** | MOD-006 (requirement items), MOD-005 (copies, stock), MOD-004 (guardian record → authorised recipient), MOD-003 (staffing → teacher route), MOD-007 (confirmation) |
| **Consumed by** | MOD-009, MOD-010 |
| **Must never depend on** | MOD-011, MOD-010 |
| **Today** | `finance_book_allocations` with **three status columns** · `custody_events` (right shape, undermined by swallowed exceptions, **C-3**) · **no route concept (C-36)** · **no guardian check (C-38)** · no hand-to-teacher step |

> **Three routes, one ending.** Reception collection, classroom delivery and future postal delivery
> converge on **one** hand-over concept. This module exists partly to stop that ending being modelled
> six times again.

---

**MOD-009 · Communication** — CORE

| | |
|---|---|
| **Purpose** | Conversations with families, and the durable fact that someone is owed a message. |
| **Owns** | Message thread · message · **notification** |
| **Does not own** | **Delivery** — that is MOD-015. A failed email must never destroy the notification. |
| **Primary concepts** | DM-049, DM-050, DM-051 |
| **Primary capabilities** | CAP-072–075 |
| **Rules protected** | BR-036 school identity on communication · BR-051 teacher thread scope · BR-096 the send-after-commit principle · BR-120 |
| **Consumes from** | MOD-004, MOD-003 (teacher scope), MOD-006/007/008 (what to tell people about), MOD-001 (identity) |
| **Consumed by** | MOD-015 (delivery), MOD-010 |
| **Must never depend on** | MOD-015 for truth · MOD-011 |
| **Today** | `message_threads`, `messages`, `message_audit_logs`, `notification_preferences` — **no durable notification record**; sending *is* the notification (**C-46**) |

---

**MOD-010 · Reporting & Projections** — CORE · **owns no business truth**

| | |
|---|---|
| **Purpose** | Composing authoritative facts from other modules into operational, financial and historical views. |
| **Owns** | **Nothing.** Zero concepts. That is the point. |
| **Does not own** | Any status, total, position or lifecycle. **It may not invent a financial status.** |
| **Primary capabilities** | CAP-076, 077 |
| **Rules protected** | BR-066 subsidy and waiver are not revenue · BR-125 a failed read is never a settled fact · Stage 7 visibility bands (§9 of `PERMISSIONS.md`) |
| **Consumes from** | every Core module, read-only |
| **Consumed by** | nothing. **A leaf.** |
| **Must never depend on** | — it depends on everything and is depended on by nothing |
| **Today** | Dashboards and reports re-derive payment lifecycle counts independently — and got them wrong: collected payments were vanishing from revenue (**C-45**) |

> **A module with no owned truth still passes the module test**, because it has a clear
> responsibility, a clear prohibition, and a distinct set of Stage 7 capabilities and visibility rules.

---

### OPTIONAL

**MOD-011 · School Website (CMS)** — OPTIONAL

| | |
|---|---|
| **Purpose** | The school's public web presence: content, media, publication and website-specific presentation. |
| **Owns** | Site configuration · website page sections · media assets · the draft→publish lifecycle · website-specific presentation · public rendering |
| **Does not own** | **Core school identity or application branding** — it *consumes* them (US-02) · anything operational · **"does this school have the CMS?" — that is MOD-001** [LOCKED MA-2] |
| **Primary concepts** | DM-005 *(and the sections and media it contains)* |
| **Primary capabilities** | CAP-078–081 |
| **Rules protected** | BR-035 core identity is Core, website styling is the module · URL scheme allowlist (the stored-XSS fix, B-9) |
| **Consumes from** | **MOD-001 only** — school identity, school code, authorised school context. And MOD-002 for the `it_personnel` guard. |
| **Consumed by** | nothing in Core |
| **Must never depend on** | MOD-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-009, MOD-010 — **no child, family, settlement, custody or teacher data, ever** |
| **Today** | CMS, media, branding and `it_personnel` woven through the same application (**C-5**). The `it_personnel` *authority* boundary is already a real server-side wall and is one of the better-built things in the codebase. |

---

### INTERNAL

**MOD-012 · Platform Operations (BytHub)** — INTERNAL

| | |
|---|---|
| **Purpose** | Operating ScholarShelf itself: onboarding tenants, keeping them alive, and supporting them. |
| **Owns** | **Support engagement** · console operation record · platform state and diagnostics · tenant lifecycle *actions* |
| **Does not own** | Any tenant's operational truth. It **acts on** MOD-001's tenant state and, inside an engagement, on a bounded set of Core operations. |
| **Primary concepts** | DM-006, DM-054 |
| **Primary capabilities** | CAP-082–092 |
| **Rules protected** | BR-004 platform roles untenanted · BR-008 support mode only · BR-121 attribution · PA-2 no recovery bypass |
| **Consumes from** | MOD-001 (tenant); **bounded, engagement-scoped** access to Core |
| **Consumed by** | nothing in Core |
| **Must never depend on** | ordinary Core operational modules **outside** a support engagement · MOD-011 |
| **Today** | Owner routes, three-tier console, support mode — **sharing the same application shell and section-allowlist mechanism as Core school administration** (**C-44**) |

> **Not "Core admin with `schoolId = null`".** A5. The band exists so a BytHub operator can never
> become an ordinary school user by accident of scoping.

---

### INFRASTRUCTURE

**MOD-013 · Audit & Attribution** — INFRASTRUCTURE

| | |
|---|---|
| **Purpose** | Making the 58 audit-required capabilities attributable. |
| **Owns** | Audit event |
| **Does not own** | Any business decision. It records; it does not authorise. |
| **Primary concepts** | DM-053 |
| **Must record** | **actor · active context · authority exercised · capability · resource · time · before/after where meaningful · reason where the action is discretionary · tenant and support engagement** — PA-1 makes *active context* and *authority exercised* two separate facts. |
| **Consumed by** | every module emits to it |
| **Must never depend on** | anything. It is a sink. |
| **Today** | Three audit tables with different shapes; `console_audit` is load-bearing (purge eligibility is read from it). **Live credentials are written to logs in four places (C-18).** |

**MOD-014 · Scheduled Work** — INFRASTRUCTURE

| | |
|---|---|
| **Purpose** | Invoking work on a schedule, idempotently, within a bounded budget. |
| **Owns** | Job run |
| **Does not own** | What the work *means*. It invokes MOD-009 and reads MOD-007/MOD-006; it decides nothing. |
| **Primary concepts** | DM-055 · **Primary capabilities** CAP-093 |
| **Rules protected** | BR-118 — one run per job, school and date; a retry must never double-email families about money |
| **Today** | `cron_job_runs` + a 24-second drain budget. Correct in shape; large-tenant behaviour undecided (**C-30**). |

**MOD-015 · Delivery & Integration Gateways** — INFRASTRUCTURE

| | |
|---|---|
| **Purpose** | Getting messages out, and letting external systems get signals in. |
| **Owns** | Delivery attempt |
| **Does not own** | **Notification truth (MOD-009)** · settlement (MOD-007). An integration may submit a *signal*; it may not confirm anything. |
| **Primary concepts** | DM-052 · **Primary capabilities** CAP-094, 095 |
| **Rules protected** | BR-096 delivery failure never destroys the fact · BR-124 no live credential in a delivery record · CAP-094's boundary |
| **Today** | Resend calls made inline; the payment webhook registered inside the messaging routes; **integration tenant scope unverified (C-41)** |

> **Resend must never own notification truth.** A person being owed a message is a product fact
> (MOD-009). An email provider attempting delivery is infrastructure (MOD-015).

---

## 4. Core module map

```
                    MOD-001  Tenancy & School Configuration
                                    │
        ┌───────────────┬───────────┼───────────────┬───────────────┐
        ▼               ▼           ▼               ▼               ▼
   MOD-003         MOD-004     MOD-005         MOD-002         (MOD-011 CMS)
   Academic        Children    Catalogue       Identity          optional,
   Structure       & Families  & Inventory     & Access          identity only
        │               │           │               ▲
        └───────┬───────┘           │               │ reads relationship facts
                ▼                   │               │
           MOD-006  Book-Supply Cycle & Requirements│
                │  ◄────────────────┘               │
        ┌───────┴────────┐                          │
        ▼                ▼                          │
   MOD-007          MOD-008                         │
   Settlement  ───► Fulfilment                      │
   & Funding        & Custody                       │
        │                │                          │
        └────────┬───────┘                          │
                 ▼                                  │
            MOD-009 Communication                   │
                 │                                  │
                 ▼                                  │
            MOD-010 Reporting  (leaf — reads all, owns nothing)
```

**The spine reads downward.** MOD-006 depends on structure, people and catalogue. MOD-007 and MOD-008
depend on the spine. **MOD-006 depends on neither of them** — what a child needs does not depend on
how it was paid for or how it arrived.

---

## 5. Optional CMS boundary — the C-5 resolution

**Conceptually resolved. Not fixed in code.** Physical separation is Stages 12–13.

```
CORE (MOD-001)
 └── SCHOOL IDENTITY  ── logo · colours · visual identity · portal identity
          │                dashboard identity · transactional-email identity
          │  consumed by (one direction only)
          ▼
OPTIONAL CMS (MOD-011)
 ├── WEBSITE PRESENTATION      theme choices, page styling
 ├── PAGE CONTENT              typed sections, drafts
 ├── MEDIA                     website assets
 └── PUBLICATION               draft → published, public rendering
```

| Question | Answer |
|---|---|
| What stays in Core? | School identity · application branding · school code / tenant identity · operational and transactional communication identity |
| What is exclusively CMS? | Website sections · draft/publish lifecycle · media assets · public pages · website-specific styling · CMS management |
| What may CMS consume from Core? | School identity · school code · the authorised school context (MOD-002 guard) |
| What must CMS never consume? | **Child operational data · settlement · custody · family financial information · teacher operations** |

This agrees with Stage 7's lock — **AUTH-CMS carries no operational authority** — and Stage 8 makes the
module boundary say the same thing: no arrow runs from MOD-011 to any operational module.

---

## 6. Internal BytHub boundary — the C-10 resolution

**Conceptually resolved.** Stage 9 decides which internal screens survive.

**MOD-012 is internal infrastructure for operating the product, not a customer tier.** What legitimately
belongs to it:

tenant identity · tenant lifecycle status · setup state · system health · **support engagements** ·
job outcomes · platform diagnostics · operational metadata.

**What must not:** customer-facing multi-school analytics · all children's or payment data across
tenants as a normal dashboard · anything that reads like school-group management.

The boundary is Stage 7's `PLATFORM_GLOBAL` scope: **platform metadata and state, never ordinary
operational or child data.** Tenant operational reach exists only inside a support engagement, and —
per PA-2 — **account recovery is a tenant operation with no exception.**

```
outside support   →  platform metadata only
inside support    →  one named school, bounded authority, every action attributable
owner             →  exceptional break-glass where permitted
```

---

## 7. Module ownership of data concepts — all 57

| Module | Concepts owned |
|---|---|
| **MOD-001** Tenancy & School Config | DM-001 School · DM-002 School code · DM-003 School identity · DM-004 School policy |
| **MOD-002** Identity & Access | DM-007 Person account · DM-008 Role grant · **DM-009 Access context** *(derives)* · DM-011 Staff profile · DM-012 Invitation · DM-015 Session |
| **MOD-003** Academic Structure | DM-016 Academic period · DM-017 Class · DM-018 Subject · DM-019 Class staffing · DM-021 Class membership |
| **MOD-004** Children & Families | DM-010 Guardian record · DM-013 Linking code · DM-014 Guardian–child relationship · DM-020 Child · DM-022 Family |
| **MOD-005** Catalogue & Inventory | DM-026 Book product · DM-027 Bundle · DM-028 Bundle line · DM-031 Physical copy · DM-032 Stock movement |
| **MOD-006** Cycle & Requirements | DM-023 Book-supply cycle · DM-024 Requirement item · DM-025 Requirement line · DM-029 Class requirement assignment · DM-030 Child requirement override |
| **MOD-007** Settlement & Funding | DM-033 Money event · DM-034 Funding adjustment · **DM-035 Settlement position** *(derives)* · DM-036 Payment reference · DM-037 Provider payment record · DM-038 Verification attempt · DM-046 Charge decision · DM-057 Payment application |
| **MOD-008** Fulfilment & Custody | DM-039 Fulfilment instruction · DM-040 Allocation · **DM-041 Custody holding** *(derives)* · DM-042 Custody event · DM-043 Hand-over · DM-044 Fulfilment exception · DM-045 Replacement request · DM-048 Return processing · DM-056 Dispatch *(future)* |
| **MOD-009** Communication | DM-049 Message thread · DM-050 Message · DM-051 Notification |
| **MOD-010** Reporting | *(none — by design)* |
| **MOD-011** CMS | DM-005 Site configuration |
| **MOD-012** Platform Operations | DM-006 Support engagement · DM-054 Console operation record |
| **MOD-013** Audit | DM-053 Audit event |
| **MOD-014** Scheduled Work | DM-055 Job run |
| **MOD-015** Delivery & Integration | DM-052 Delivery attempt |

**56 concepts placed. One remains, deliberately:**

**DM-047 · Correction event — a pattern, not a module's property.**
A correction is always a correction *of something*, and the module that owns the fact owns its
corrections: MOD-007 owns settlement corrections, MOD-005 owns stock corrections, MOD-008 owns custody
and hand-over corrections, MOD-006 owns requirement corrections, MOD-003 owns membership corrections.
**MOD-013 owns their attribution.** Giving corrections to one module would make that module a
co-owner of every other module's truth — exactly what A1 forbids.

**Three derived concepts and who derives them** (A2): access context → **MOD-002** · settlement
position → **MOD-007** · custody holding → **MOD-008**. Responsible for deriving is not the same as
storing; Stage 15 decides storage.

**Confirmed at lock:** **DM-040 Allocation is owned by MOD-008 Fulfilment & Custody** [LOCKED MA-1].
MOD-007 owns the settlement decision, MOD-005 owns stock movement, MOD-008 owns allocation. Their
participation in one confirmation is governed by **I-2**, not by shared ownership.

### Traceability note — module entitlement

MA-2 gives **MOD-001** the fact *"this school has the CMS module."* **Stage 6 has no dedicated concept
for it** — the 57 concepts are complete and Stage 6 is locked, and this fact is not the same kind of
thing as DM-004 School policy: policy is a *choice the school makes*, entitlement is a *fact about
what the school has*.

Recorded, not invented: **Stage 15 decides whether entitlement extends DM-001 School, sits beside
DM-004 School policy, or becomes a concept of its own.** Ownership is settled regardless — it is
MOD-001's, and it is not MOD-011's.

---

## 8. Feature-to-module mapping — all 84

| Features | Module | Note |
|---|---|---|
| F-001–F-009 | **MOD-012** | Tenant lifecycle, support mode, onboarding, platform dashboard, three console tiers, destructive ops, console audit *(F-009 emits to MOD-013)* |
| F-010–F-015 | **MOD-002** | Sign-in, registration, invitation acceptance, reset, MFA, rate limiting |
| F-016, F-017, F-018, F-019 | **MOD-002** | Role model, multi-context, invite wizard, secondary grants |
| F-020, F-021, F-022 | **MOD-002** | Suspend/reactivate, offboard preserving family, erasure *(policy process — Stage 16)* |
| **F-023** | **MOD-003** | Time-bounded class assignment |
| **F-024** | **MOD-001** | Per-school policy and configuration |
| F-025, F-026 | **MOD-001** | School identity · school code |
| F-027, F-028, F-029 | **MOD-003** | Classes, subjects, teacher assignment |
| F-030 | **MOD-004** | Student records |
| F-031 | **MOD-006** | Student book-level override |
| **F-032** | **MOD-003** *(owns)* | Rollover — cross-module with MOD-004, MOD-006 |
| F-033, F-034, F-035 | **MOD-004** | Families and guardians · linking codes · parent access lifecycle |
| F-036, F-037, F-038 | **MOD-004** *(owns)* | Both import modes and the invitation safety net; participates MOD-003 |
| F-039, F-040, F-043, F-044 | **MOD-005** | Catalogue, ISBN scanning, stock, physical copies |
| F-041, F-042 | **MOD-005** / **MOD-006** | Bundles own → MOD-005; **assignment to a class → MOD-006** |
| F-045, **F-083** | **MOD-006** | Basket → requirement item · the cycle |
| F-046, F-047, F-048, **F-049**, F-050, F-051 | **MOD-007** | Payment claim, family settlement, confirmation, alternative routes, online payment *(future)*, reconciliation |
| F-052, F-053, **F-053a**, F-054, F-055, F-056, F-057 | **MOD-008** | Allocation, custody, fulfilment route, hand-to-teacher, distribution, extra copies, collection sheet |
| **F-082** | **MOD-008** *(owns)* | Exceptional return; financial correction participates from MOD-007 |
| **F-084** | **MOD-008** | Postal fulfilment — **FUTURE architectural slot only** |
| F-058, F-059, F-060 | **MOD-009** | Messaging and notifications |
| F-061 | **MOD-009** *(truth)* + **MOD-015** *(delivery)* | Transactional email — **deliberately split** |
| F-062 | **MOD-014** | Daily digest |
| F-063, F-064, F-065 | **MOD-010** | Dashboards, reports, student profile view |
| F-066–F-070 | **MOD-011** | CMS, media, public site, IT dashboard, contact form |
| F-071 | **MOD-001** *(owns)* | Setup wizard and go-live — cross-module orchestration |
| F-072 | **MOD-013** | Audit logging |
| F-073 | **MOD-011** / **MOD-001** | Public policy pages → CMS-adjacent; consent at account creation → MOD-002 |
| F-074 | **MOD-014** | Health and smoke check |
| F-075, F-076 | **CROSS-CUTTING** | Query-state and formatting — **presentation contracts**, Stage 10 owns them; no domain module |
| F-077, F-078 | **MOD-012** | Test account · demo seeding *(F-078 **LEGACY** — Stage 16/22)* |
| **F-079** | **LEGACY** | Student login — no target module. Stage 22 removal |
| **F-080** | **LEGACY** | Lending cycle — no target module; residue decided in Stages 4–6, removal Stage 22 |
| **F-081** | **OUT OF SCOPE** | Customer-facing MAT management — no module, now or planned |

**All 84 accounted for.** Nothing was dropped for being awkward: three are explicitly LEGACY or
OUT OF SCOPE with no target module, two are cross-cutting presentation contracts, one is a future
architectural slot.

---

## 9. Capability-to-module mapping — all 95

| Capabilities | Module |
|---|---|
| CAP-001, 002, 003 | MOD-001 |
| CAP-004, 005 | MOD-003 *(CAP-005 rollover: cross-module, MOD-003 owns the outcome)* |
| CAP-006, 007, 010, 011, 012, 013 | MOD-005 |
| CAP-008, 009 | MOD-006 |
| CAP-014, 015, 016, 017, 019 | MOD-003 |
| CAP-018, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029 | MOD-004 |
| CAP-030, 031, 033, 034, 035, 036, 037, 038, 039 | MOD-002 |
| CAP-032 grant_finance_authority | **MOD-002** *(the grant)*, gated by **MOD-001** *(the policy)* |
| CAP-040, 041, 042, 043, 044 | MOD-006 |
| CAP-045–057 | MOD-007 |
| CAP-058–069, CAP-071 | MOD-008 |
| **CAP-070 decide_replacement_charge** | **MOD-007** — deliberately *not* MOD-008 |
| CAP-072, 073, 074, 075 | MOD-009 |
| CAP-076, 077 | MOD-010 |
| CAP-078, 079, 080, 081 | MOD-011 |
| CAP-082–092 | MOD-012 |
| CAP-093 | MOD-014 |
| CAP-094, 095 | MOD-015 |

**All 95 accounted for.** Two are worth naming because they are the module-level expression of a
locked decision: **CAP-032** splits the *policy* (MOD-001) from the *grant* (MOD-002), which is C-13's
architecture; **CAP-070** sits in Settlement while CAP-067/069 sit in Fulfilment, which is C-39's.

---

## 10. Workflow-to-module mapping

*Conceptual hand-offs of responsibility. Not messages, events or calls.*

| Workflow family | Starts in | Crosses | Owns the outcome |
|---|---|---|---|
| School onboarding, lifecycle, support (WF-001–005) | MOD-012 | MOD-001, MOD-002 | MOD-012 |
| Staff invite → accept → offboard (WF-006–010) | MOD-002 | MOD-004 *(family link)*, MOD-001 *(policy)* | MOD-002 |
| Staffing and expiry (WF-011–013) | MOD-003 | MOD-002 *(context follows)* | MOD-003 |
| Guardian, linking, parent lapse (WF-014–018) | MOD-004 | MOD-002, MOD-009 | MOD-004 |
| Enrolment import (WF-019–023) | MOD-004 | MOD-003, MOD-006 *(cycles open)*, MOD-009 → MOD-015 | MOD-004 |
| **Cycle, joiners, class move, rollover (WF-024–029)** | MOD-003 / MOD-004 | MOD-006 | **MOD-006** for the cycle, **MOD-003** for rollover |
| Requirements (WF-030–034) | MOD-006 | MOD-005, MOD-003 | MOD-006 |
| **Settlement, all routes (WF-035–042)** | MOD-004 *(claim)* / MOD-007 | MOD-006, MOD-005, MOD-015 | **MOD-007** |
| **Confirmation → allocation → stock (WF-043–046)** | **MOD-007** | MOD-008, MOD-005, MOD-006 | **MOD-007 owns the decision; the outcome is atomic across three modules** — §11 |
| **Fulfilment (WF-047–055, WF-068)** | MOD-004 *(route choice)* | MOD-008, MOD-005, MOD-003, MOD-004 | **MOD-008** |
| **Replacement (WF-034, 069–071)** | MOD-008 *(request)* | MOD-007 *(charge)*, MOD-006 *(new item)*, MOD-009 *(notify)* | **split by design — see below** |
| Exceptional return (WF-056–058) | MOD-008 | MOD-005, MOD-007 | MOD-008 physical, MOD-007 financial |
| Communication and digest (WF-059–061) | MOD-009 / MOD-014 | MOD-015 | MOD-009 |
| CMS (WF-062–064) | MOD-011 | MOD-001 only | MOD-011 |
| Platform ops (WF-065–067) | MOD-012 | MOD-013 | MOD-012 |

**Genuinely cross-module workflows — five:**

1. **Confirmation → allocation → stock deduction** (WF-043) — MOD-007 → MOD-008 → MOD-005. §11.
2. **Annual rollover** (WF-028) — MOD-003 → MOD-004 → MOD-006, plus MOD-007 for outstanding positions
   that must stay on the old cycle.
3. **Enrolment import** (WF-019/020) — MOD-004 → MOD-003 → MOD-006 → MOD-009 → MOD-015, in one
   transaction with delivery deliberately outside it.
4. **Post-hand-over replacement** (WF-069–071) — MOD-008 → MOD-007 → MOD-006 → MOD-009. **Four
   modules, four decisions, deliberately not collapsed.**
5. **Fulfilment route resolution → preparation → hand-over** (WF-047–052) — MOD-004 → MOD-008 →
   MOD-005, with MOD-003 and MOD-004 supplying the two conditions that can block it.

---

## 11. Cross-module invariants

**The rules that must survive every boundary this document draws.**

### I-1 · Tenant isolation
Every module without exception resolves its resources within one school. The boundary between modules
must not become a place where scope is dropped. **The current single choke point is the right shape and
must not be replaced by fifteen module-local checks.**

### I-2 · The atomic confirmation — the invariant most at risk from this stage

```
settlement confirmation  +  allocation  +  stock deduction  =  ONE atomic business outcome
```

| | |
|---|---|
| **Who owns the decision** | **MOD-007.** Confirming that a position is settled is a finance act. |
| **Who participates** | **MOD-008** (allocation comes into being — **MOD-008 owns it**, MA-1) · **MOD-005** (stock moves) · **MOD-006** (the requirement item's derived position changes) |
| **What crosses the boundary** | The confirmation decision, and the requirement item it applies to |
| **The invariant** | All of it succeeds or none of it does. **Insufficient stock rolls back the whole confirmation**, with the title named. Two concurrent confirmations produce exactly one set of side effects. |
| **What later stages must preserve** | **A module boundary is not a transaction boundary.** Stages 12–13 must keep this in one transaction inside one application. Introducing asynchrony, eventual consistency, a queue or a network hop between MOD-007, MOD-008 and MOD-005 for this operation would break the product's core invariant (BR-077–081, parity B-3). |

> This is the single strongest reason Stage 8 does **not** propose microservices. Three modules, one
> transaction, one process — deliberately.

**[LOCKED MA-1] The owner's decision confirms this architecture rather than softening it.**

```
MOD-007  owns the settlement decision
MOD-005  owns stock movement
MOD-008  owns allocation
                    ↓
      all three changes succeed or fail together
```

**No partial success may ever become visible.** These must remain impossible:

```
settlement confirmed  but no allocation
stock deducted        but settlement rolled back
allocation created    but settlement failed
```

**Explicitly not introduced by this invariant:** microservices · sagas · queues · distributed
transactions · event-bus architecture. Multiple conceptual modules may participate inside **one process
and one database transaction**. Transaction and orchestration design carries to **Stage 13** and
**Stage 15**.

### I-3 · Historical immutability
Closed periods and closed cycles are never rewritten. A class move ends one membership and starts
another (MOD-003); it does not edit the first. Corrections are additions (DM-047), owned by whichever
module owns the fact.

### I-4 · Teacher scope
**Any module that exposes teacher-relevant information respects `active staffing ∩ active class
membership`.** That intersection is derived from facts owned by MOD-003 (both halves) — but MOD-006,
MOD-008, MOD-009 and MOD-010 all expose things a teacher can see, and each must honour it. A module
that "just shows a list" is not exempt.

### I-5 · Guardian relationship scope
Family reach comes from an active guardian relationship (MOD-004), never from a role string, and never
from the existence of an account. This crosses MOD-006, MOD-007, MOD-008 and MOD-009.

### I-6 · One hand-over concept
Reception collection, classroom delivery and future postal delivery converge on **one** hand-over
(MOD-008). No other module may define "the child received the books", and MOD-010 in particular may
not derive its own version.

### I-7 · Notification durability
A person being owed a message (MOD-009) survives a failed delivery attempt (MOD-015). The dependency
runs one way: MOD-015 reads from MOD-009 and reports outcomes back; it never holds the truth.

### I-8 · Support mode
MOD-012 reaches Core operational modules only inside an explicit engagement for one named school —
**including account-level operations** (PA-2).

### I-9 · Audit attribution
Every cross-module sensitive operation remains attributable, carrying **active context and authority
exercised as separate facts** (PA-1). A hand-off between modules must not lose the actor.

### I-10 · Settlement coherence
Money event, payment application, funding adjustment and derived position stay in MOD-007. No module
may hold a second copy of a settled position, and **MOD-010 may not compute its own.**

---

## 12. Dependency direction

| Module | May depend on | May be consumed by | Must never depend on |
|---|---|---|---|
| **MOD-001** Tenancy | — | all | everything — **including MOD-011: holding the CMS *entitlement* is not depending on the CMS** |
| **MOD-002** Identity & Access | MOD-001; **reads** MOD-003, MOD-004 | all (as guard) | MOD-010, MOD-011, MOD-012 |
| **MOD-003** Academic Structure | MOD-001, MOD-004 | MOD-002, 006, 008, 009, 010 | MOD-006, 007, 008, 010, 011 |
| **MOD-004** Children & Families | MOD-001, MOD-003 | MOD-002, 006, 007, 008, 009, 010 | MOD-006, 007, 008, 010, 011 |
| **MOD-005** Catalogue & Inventory | MOD-001 | MOD-006, 007, 008, 010 | MOD-006, 007, 008 |
| **MOD-006** Cycle & Requirements | MOD-001, 003, 004, 005 | MOD-007, 008, 009, 010 | **MOD-007, MOD-008** |
| **MOD-007** Settlement & Funding | MOD-001, 004, 005, 006 | MOD-008, 009, 010 | MOD-010, 011 |
| **MOD-008** Fulfilment & Custody | MOD-001, 003, 004, 005, 006, 007 | MOD-009, 010 | MOD-010, 011 |
| **MOD-009** Communication | MOD-001, 003, 004, 006, 007, 008 | MOD-010, MOD-015 | MOD-015 *(for truth)*, MOD-011 |
| **MOD-010** Reporting | all Core, read-only | **nothing** | — |
| **MOD-011** CMS | **MOD-001, MOD-002 only** | nothing in Core | **MOD-004–010** |
| **MOD-012** Platform Ops | MOD-001; engagement-scoped Core | nothing in Core | Core outside an engagement |
| **MOD-013** Audit | nothing | all emit to it | everything |
| **MOD-014** Scheduled Work | MOD-009; reads MOD-006, 007 | — | owning any decision |
| **MOD-015** Delivery & Integration | MOD-009 *(reads)*; submits to MOD-007 | — | owning notification or settlement truth |

### The one place circularity appeared, and how it is resolved

MOD-002 must derive access context from **class staffing** (MOD-003) and **guardian relationships**
(MOD-004) — while MOD-003 and MOD-004 are themselves guarded by MOD-002. That reads as a cycle.

**It is not, because the two directions are different kinds of relationship:**

```
MOD-002  ──reads relationship facts──►  MOD-003, MOD-004     (a data dependency)
MOD-002  ──guards the entry point of──►  every module         (a policy applied at the boundary)
```

Guarding is not ownership and not consumption: a module does not *call* MOD-002 to do its work; its
entry point is subject to MOD-002's decision. MOD-003 and MOD-004 own their facts with no knowledge of
authorisation.

**No `shared` dumping ground was created to solve it,** and no third module was invented.

---

## 13. Shared and cross-cutting concepts

Strictly limited. A concept qualifies only if **no single business module can reasonably own it**.

| Concept | Why no module can own it |
|---|---|
| **Money value** | An exact decimal amount. MOD-007 owns money *events*, but a price on a book (MOD-005) and a value on a requirement line (MOD-006) are the same kind of thing. Owned by none, used by several. |
| **Point in time** | Every module records when. A clock is not a business responsibility. |
| **Identifier reference** | Modules refer to each other's entities by identity. The *convention* is shared; the entities are not. |

**Explicitly NOT shared kernel** — each has a real owner, and putting it in a shared space would be
exactly the mistake §22 warns about: school/tenant identity (**MOD-001**) · academic period
(**MOD-003**) · person identity (**MOD-002**) · audit attribution (**MOD-013**).

**Two presentation contracts sit outside the module architecture entirely** — the query-state rule
(a failed read never renders as a settled fact, BR-125) and the en-GB/GBP formatting layer. They are
not domain modules; **Stage 10 owns them.**

---

## 14. Optionality and module absence

**The rule:** *an optional module may depend on stable Core contracts; Core must never require it.*

**When MOD-011 (CMS) is absent, all of this still works:** school sign-in · school identity and
branding · dashboards · the parent portal · transactional email · catalogue · requirements · settlement
· fulfilment · custody · reporting · every school operation · every platform operation.

**What is lost:** the public website at `/school/:code`, the page-section editor, the media library,
and the `it_personnel` context has nothing to administer.

**Nothing in Core reads from MOD-011, so nothing in Core needs a fallback.** That is the test: absence
should not require Core to *handle* anything.

**[LOCKED MA-2] Who owns "this school has the CMS": MOD-001.** It is a fact about the school's product
configuration, not a fact the module holds about itself. MOD-011 is never asked whether the school owns
MOD-011.

This does **not** reverse A4. Core holding an entitlement fact is not Core depending on the module:
Core reads nothing from MOD-011, calls nothing in MOD-011, and needs nothing from MOD-011 to run. *How*
the entitlement is represented — a field, a set, a record — is **Stage 15**, and no licensing, billing,
subscription or feature-flag mechanism is designed anywhere in this document.

**MOD-012 (Platform Operations) is not optional and not customer-facing.** MOD-014 and MOD-015 are
infrastructure: without them scheduled work and delivery stop, but no business truth is lost —
precisely because they own none.

---

## 15. Current implementation comparison

| Area | Classification | Detail |
|---|---|---|
| Tenant isolation choke point | **ALREADY ALIGNED** | One boundary, storage-level asserts. I-1's right shape already exists. |
| `it_personnel` authority wall | **ALREADY ALIGNED** | A real server-side boundary. MOD-011's authority edge is already correct. |
| `guardians` record | **ALREADY ALIGNED** | Already separate from the account, with `ON DELETE SET NULL`. MOD-004's shape. |
| `book_inventory_transactions` | **ALREADY ALIGNED** | Event-shaped with before/after. MOD-005's shape. |
| `custody_events` | **PARTIALLY ALIGNED** | Right shape; undermined by swallowed transitions (C-3) |
| Enrolment import service | **PARTIALLY ALIGNED** | The only substantially extracted domain besides payment verification. Sits in MOD-004. |
| Payment verification service | **PARTIALLY ALIGNED** | Extracted; belongs to MOD-007; misnamed (C-28) |
| `storage.ts` (~3,500 lines) | **MISSING BOUNDARY** | A single data-access surface spanning **all fifteen modules**. → **C-42** |
| `shared/schema.ts` (41 tables) | **MISSING BOUNDARY** | One schema with no module ownership. → **C-43** |
| Auth middleware (~1,100 lines) | **CROSS-MODULE COUPLING** | MOD-002's responsibility, plus tenant, staffing and relationship logic, plus role groups duplicated in a second file (C-22) |
| CMS / branding / media / IT | **CROSS-MODULE COUPLING** | C-5 — Core identity and website presentation are one surface |
| Owner/platform surface | **CROSS-MODULE COUPLING** | Shares the admin shell and section-allowlist mechanism with Core school administration → **C-44** |
| Business logic in routes | **WRONG OWNER** | Most domain decisions live in route handlers; almost no module owns its own rules |
| `book_payments` | **WRONG OWNER** | Holds money event, settlement position, order lifecycle and collection lifecycle — MOD-007 and MOD-008 concerns fused |
| `finance_book_allocations` | **WRONG OWNER** | Three status columns spanning MOD-006, MOD-007 and MOD-008 |
| `students.classId` | **WRONG OWNER** | MOD-003's membership stored as an attribute of MOD-004's child (C-9) |
| Dashboards re-deriving financial counts | **WRONG OWNER** | MOD-010 has previously owned business truth, and got it wrong → **C-45** |
| Two import pipelines | **DUPLICATED** | Both in MOD-004; consolidation is Stage 22, not newest-wins (C-26) |
| Two teacher-assignment models | **DUPLICATED** | Both in MOD-003, already behind one lookup |
| Alias endpoint pairs | **DUPLICATED** | C-20 |
| Notification vs delivery | **MISSING BOUNDARY** | Sending *is* the notification → **C-46** |
| `student` role | **LEGACY** | No module |
| Lending/return residue | **LEGACY** | No module; residue decided Stages 4–6 |
| Postal fulfilment | **FUTURE** | Architectural slot in MOD-008 only |

**No files were moved and no migration sequence is proposed. Stage 22 owns that.**

---

## 16. C-5 resolution

**Conceptually resolved** — §5. Core (MOD-001) owns school identity and application branding; the
optional CMS (MOD-011) consumes that identity and owns only website presentation, content, media and
publication. No dependency runs from Core to CMS, and no operational concept is reachable from
MOD-011.

**Not resolved in code.** Branding remains a single fused surface. **Physical separation carries to
Stages 12–13; representation to Stage 15.**

---

## 17. C-10 resolution

**Conceptually resolved** — §6. MOD-012 is internal BytHub infrastructure with `PLATFORM_GLOBAL`
scope: tenant identity and lifecycle, setup state, health, support engagements, job outcomes,
diagnostics, operational metadata. It is **not** customer multi-school management, and it must not
present cross-tenant operational or child data as a normal dashboard.

**Not resolved in code**, and Stage 8 has sharpened *why*: the internal surface currently shares the
customer application's shell and section-allowlist mechanism (**C-44**). **Which internal screens
survive is Stage 9; the surface separation is Stage 13.**

---

## 18. Conflicts carried forward

| # | Conflict | Now clearly owned by | Later stage |
|---|---|---|---|
| **C-1** | Level vocabulary pinned to UK year groups | MOD-003 | 10, 15 |
| **C-2** | Portal advertises card checkout that does not exist | MOD-007 / Stage 9 | 9, 12 |
| **C-3** | Custody machine records rather than enforces | MOD-008 | 12 |
| **C-4** | Lending residue reads as normal lifecycle | MOD-008 | 15, 22 |
| **C-5** | CMS / branding fused | MOD-001 ↔ MOD-011 | **12, 13, 15** |
| **C-6** | Inconsistent teacher scope | MOD-003 *(source)*, all exposers | 12, 13 |
| **C-7** | `student` residue | none — legacy | 22 |
| **C-9** | Class membership as a mutable pointer | MOD-003 | 15 |
| **C-10** | Owner tier shaped like a customer product | MOD-012 | **9, 13** |
| **C-11** | No cash, instalments, subsidy or waiver | MOD-007 | 15 |
| **C-12** | Hard delete vs disable | MOD-002 | 16 |
| **C-13** | Admin implicitly finance | MOD-001 *(policy)* + MOD-002 *(grant)* | 12, 13 |
| **C-14** | Staffing not time-bounded | MOD-003 | 15 |
| **C-15** | Parent access never lapses | MOD-004 | 15, 16 |
| **C-17** | No school policy surface | MOD-001 | 15 |
| **C-18** | Live credentials in logs | MOD-013 / MOD-015 | 16, 19 |
| **C-19** | Console migration cannot run on a fresh database | MOD-012 | 15, 21 |
| **C-20** | Alias endpoint pairs | various | 14, 22 |
| **C-22** | Role groups declared twice | MOD-002 | 13 |
| **C-23** | `user_permissions` carrying three concerns | MOD-002 | 15 |
| **C-24** | Base64 logos stripped by mail clients | MOD-001 / MOD-015 | 17 |
| **C-25** | Legacy single-step linking path | MOD-004 | 22 |
| **C-26** | Two import pipelines | MOD-004 | 13, 22 |
| **C-27** | Books list in the wrong place | MOD-005 | 13, 14 |
| **C-28** | "Stripe" naming for a spreadsheet import | MOD-007 | 14, 17 |
| **C-29** | Payment webhook inside messaging | MOD-015 | 13 |
| **C-30** | Large-tenant digest behaviour undecided | MOD-014 | 12, 18 |
| **C-31** | Four dashboard design generations | MOD-010 / Stage 9 | 9, 10 |
| **C-32** | Query-state adopted by 2 of 42 pages | cross-cutting | 9, 10, 13 |
| **C-33** | Formatting layer partially adopted | cross-cutting | 9, 10 |
| **C-35** | Collection modelled twice | MOD-008 | 15 |
| **C-36** | No fulfilment-route concept | MOD-008 | 15 |
| **C-37** | No requirement-item concept | MOD-006 | 15 |
| **C-38** | No guardian-conflict check | MOD-008 | 12, 13 |
| **C-39** | No replacement charge decision | MOD-007 *(charge)* + MOD-008 *(request)* | 15 |
| **C-40** | Authorisation role-keyed, not authority-keyed | MOD-002 | **12, 13** |
| **C-41** | Integration credential tenant scope unverified | MOD-015 | 16 |

**Stage 8 resolves none of these in implementation.** What it adds is an **owner** for each, so no
conflict is now homeless.

---

## 19. New conflicts

| # | Conflict | Why it matters | Target boundary | Later stage(s) |
|---|---|---|---|---|
| **C-42** | **`storage.ts` spans every module.** One ~3,500-line data-access surface serves all fifteen proposed modules. | There is currently **no module boundary anywhere in the data layer**. Every ownership rule in §7 is unenforceable while one object can read and write everything. | Each module owns access to its own concepts | **12, 13, 15** |
| **C-43** | **One schema for fifteen modules.** `shared/schema.ts` declares all 41 tables with no ownership. | Module ownership of data has no representation, so nothing prevents a future change re-fusing concepts this stage separated. | Schema organised by owning module | **15** |
| **C-44** | **The internal band shares the customer application's shell.** Owner and platform surfaces use the same admin shell and section-allowlist mechanism as school administration. | A5 — internal is not "Core admin with a null tenant". While they share a surface, the distinction is presentational, and C-10 cannot be structurally resolved. | MOD-012 architecturally distinguishable from Core | **9, 13** |
| **C-45** | **Reporting has owned business truth.** Dashboards and reports independently re-derived payment lifecycle counts — and collected payments vanished from revenue. | Direct violation of I-10 and MOD-010's defining prohibition. Evidence that the boundary is not merely theoretical. | MOD-010 composes, never computes business status | **12, 15** |
| **C-46** | **Notification truth and delivery are the same act.** No durable notification record exists; sending *is* the notification. | Violates I-7. A delivery failure currently destroys the fact that a person was owed a message — which under WF-071 includes telling a family they now owe money. | MOD-009 owns notification; MOD-015 owns delivery | **15, 18** |

---

## 20. Owner decisions — all **DECIDED**

**MA-1 — DECIDED A.**
**Allocation (DM-040) is owned by MOD-008 Fulfilment & Custody.** It does **not** move into MOD-007.

```
MOD-007 Settlement & Funding   → owns the settlement decision
                                  decides that the requirement is legitimately settled
MOD-005 Catalogue & Inventory  → owns stock and stock movement
MOD-008 Fulfilment & Custody   → owns allocation
                                  records which physical copies are committed to the child
                                  owns the physical journey that follows
```

The physical chain stays coherent: **ALLOCATION → PREPARATION → CUSTODY → HAND-OVER.** Settlement does
not become the owner of a physical-world fact merely because allocation occurs during confirmation.

Their participation in confirmation remains governed by **I-2**: one atomic business outcome across
three modules. **MA-1 makes I-2 permanent** — see §11.
*Applied in* §3 (MOD-007, MOD-008), §7, §11.
*Decision resolved.* **Implementation carries to Stage 13** (orchestration) **and Stage 15**
(representation and transaction boundaries).

**MA-2 — DECIDED A.**
**MOD-001 Tenancy & School Configuration owns the fact that a school is entitled to, or has enabled,
the optional CMS module.** MOD-011 owns CMS business functionality and data.

```
SCHOOL
├── ScholarShelf Core
└── Optional module entitlements
      └── CMS enabled / available          ← MOD-001
```

**Core knowing the entitlement does not create a dependency on the CMS.** MOD-011 may depend on
permitted Core information; Core must not require MOD-011 to operate. A school without the CMS still
has fully working authentication, school identity, application branding, academic structure, children
and families, catalogue, book-supply cycles, settlement, fulfilment, communication, reporting and
transactional email.

**Reusable principle established:** which ScholarShelf modules a school is entitled to use is a
school / product-configuration fact owned by MOD-001. Reusable for future optional modules unless a
later owner decision changes it. **No commercial licensing, pricing, subscription, billing or
feature-flag system is designed here, and no future modules are invented.**
*Applied in* §3 (MOD-001, MOD-011), §7 traceability note, §14.
*Decision resolved.* **Representation carries to Stage 15**; navigation and role experience to
**Stage 9**; module composition to **Stage 13**.

**No open Stage 8 owner decisions remain.**

> **A conceptual decision being resolved is not the same as the implementation being resolved.**
> MA-1 and MA-2 are product and module decisions. Neither is reflected in the current code, and neither
> resolves any conflict in §18 or §19.

---

## 21. What Stage 8 deliberately does not decide

No folders, files, packages or imports · no services, repositories or controllers · no routes,
endpoints or HTTP contracts · no tables, keys, indexes or ORM structure · no deployments, processes,
queues or event buses · no state-machine implementation · no screens or navigation · **no migration
order and no selection between competing implementations**.

**Stage 8 = conceptual modules. Stage 13 = physical application architecture. Stage 14 = API. Stage 15
= physical database. Stage 22 = migration.**

---

# SUMMARY

1. **Total modules: 15.**
2. **Core: 10** — MOD-001 Tenancy & School Configuration · MOD-002 Identity & Access · MOD-003 Academic
   Structure · MOD-004 Children & Families · MOD-005 Catalogue & Inventory · MOD-006 Book-Supply Cycle
   & Requirements · MOD-007 Settlement & Funding · MOD-008 Fulfilment & Custody · MOD-009
   Communication · MOD-010 Reporting & Projections.
3. **Optional: 1** — MOD-011 School Website (CMS).
4. **Internal: 1** — MOD-012 Platform Operations.
5. **Infrastructure: 3** — MOD-013 Audit & Attribution · MOD-014 Scheduled Work · MOD-015 Delivery &
   Integration Gateways.
6. **Dependency graph:** §4 and §12. One apparent circularity (MOD-002 ↔ MOD-003/004), resolved by
   distinguishing a **data dependency** from a **guard applied at a boundary** — with no shared
   dumping ground and no invented third module.
7. **Concept ownership:** §7. **56 of 57** concepts have exactly one owning module; **DM-047
   correction event** is deliberately a pattern each owning module applies to its own facts, with
   attribution in MOD-013. Three derived concepts have a named deriver, not a second owner.
8. **All 84 Stage 3 features accounted for** — §8. Three are LEGACY/OUT OF SCOPE with no target module,
   two are cross-cutting presentation contracts owned by Stage 10, one is a future architectural slot.
9. **All 95 Stage 7 capabilities accounted for** — §9.
10. **Genuinely cross-module workflows: five** — the atomic confirmation, annual rollover, enrolment
    import, post-hand-over replacement, and fulfilment route → preparation → hand-over.
11. **C-5 resolved conceptually** — §5, §16. Core owns identity; CMS consumes it and owns website
    presentation only. Physical separation → Stages 12–13, 15.
12. **C-10 resolved conceptually** — §6, §17. MOD-012 is internal platform infrastructure at
    `PLATFORM_GLOBAL` scope, not customer multi-school management. Screens → Stage 9; surface
    separation → Stage 13.
13. **Conflicts carried forward: 37** — §18. Every one now has a named owning module; none is resolved
    in implementation by this stage.
14. **New conflicts: 5** — **C-42** `storage.ts` spans every module · **C-43** one schema for fifteen
    modules · **C-44** the internal band shares the customer shell · **C-45** Reporting has owned
    business truth · **C-46** notification truth and delivery are the same act.
15. **Owner questions: none open.** **MA-1 DECIDED (A)** — **DM-040 Allocation is owned by MOD-008
    Fulfilment & Custody**; MOD-007 owns the settlement decision, MOD-005 owns stock movement, and
    their participation in confirmation is governed by I-2. **MA-2 DECIDED (A)** — **MOD-001 owns the
    fact that a school has the CMS**; MOD-011 owns CMS functionality and data, and Core knowing an
    entitlement creates no dependency.
16. **Later-stage ownership:** Stage 9 — internal screens, navigation, dashboard consolidation ·
    Stage 10 — presentation contracts (query-state, formatting) · Stages 12–13 — the authority layer,
    module enforcement, data-layer boundaries, orchestration of the atomic confirmation, CMS and
    platform surface separation · Stage 14 — API shape and alias retirement · Stage 15 — schema by
    owning module, cycle and requirement items, settlement routes, staffing bounds, fulfilment route,
    notification durability · Stage 16 — erasure, retention, integration scope, support boundary ·
    Stage 17 — email and provider integrations · Stage 18 — delivery and digest scale · Stage 19 —
    audit record design · Stage 21 — migration baseline · Stage 22 — legacy removal and selection
    between competing implementations.
17. **Status: LOCKED — 24 August 2026.** Later stages may implement this architecture, may discover
    conflicts with it, and may record traceable owner amendments — but must not silently rewrite the
    locked module ownership architecture.
18. **STOPPING BEFORE STAGE 9.**
