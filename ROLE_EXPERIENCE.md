# ROLE_EXPERIENCE.md — Stage 9: Role Experience, Screens & Navigation

```
STAGE 9 — ROLE EXPERIENCE, SCREENS & NAVIGATION
STATUS: LOCKED
Locked: 24 August 2026 by the owner (BytHub Technology Ltd)
```

**What "locked" means here.** Later stages **may** implement this experience architecture, **may**
discover conflicts with it, and **may** record traceable owner amendments. They **must not** silently
rewrite the locked role-experience architecture. A conflict is flagged, not absorbed.

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` — **all LOCKED**.
**Compared against** `CURRENT_SYSTEM_MAP.md` · `CURRENT_BEHAVIOUR_BASELINE.md` ·
`RESTRUCTURE_STATE.md` · `REBUILD_SAFETY.md` — **evidence only**.

**Experience architecture only.** No colours, typography, spacing, component layouts, Tailwind
classes, shadcn components, pixel dimensions, breakpoints, React trees, filenames, folders, frontend
routes, URLs, endpoints, request/response contracts, services, middleware, schema or SQL. Stage 10
owns presentation and UX contracts. Stage 13 owns physical application architecture. Stage 14 owns
the API. Stage 15 owns the database. Stage 22 owns implementation selection.

**Stage 8 is not reopened.** Its fifteen modules, ten invariants, MA-1 and MA-2 are taken as given.

---

## 1. Purpose and UX architecture principles

Stage 9 turns eight locked stages into one chain:

```
PERSON
  → ACTIVE CONTEXT
    → SURFACE
      → NAVIGATION
        → SCREEN / WORKSPACE
          → BUSINESS TASK
            → RESULT
```

### The nine principles this stage works to

**UX-P1 — Navigation reflects human work, not module ownership.**
Modules are ownership boundaries (Stage 8). School staff do not think in "Tenancy" and "Identity";
they think **School · People · Books · Requirements · Distribution · Money · Insight**. A screen may
compose several modules. It never becomes the owner of their truths.

**UX-P2 — A screen exists because a person has a job.**
Not because a table exists, a module exists, or a capability exists. Capabilities that serve no human
job are classified as background, internal, future or *no direct screen needed* — explicitly, in §24.

**UX-P3 — Every visible action traces to a Stage 7 capability.**
If it is on a screen, it has a CAP number, an authority, a scope and its conditions. If it has none,
it is not an action — it is decoration, and it is removed.

**UX-P4 — Navigation is discoverability, never enforcement.**

```
NOT IN NAVIGATION   ≠   NOT AUTHORISED
VISIBLE IN NAVIGATION ≠   AUTHORISED
```

The server remains the security boundary (PP-004). Stage 9 decides only what a person can *find*.
Where this document says "the Money area appears only when the context carries AUTH-FINANCE", that
is a statement about discoverability; CD-4 is what actually decides.

**UX-P5 — The screen composes truth; it never creates it.**
This is I-10 and MOD-010's defining prohibition, expressed as a UX rule. A dashboard that counts
payments itself rather than asking Settlement is how **C-45** happened: collected money vanished from
revenue because Reporting re-derived a lifecycle it does not own.

**UX-P6 — A failed request never looks like a settled fact.**
PP-009. `LOADING`, `ERROR`, `EMPTY` and `REAL ZERO` are four different things. "£0.00 outstanding"
and "No students" must never be what a failure looks like.

**UX-P7 — History is a first-class surface.**
PP-006 protects records from being rewritten. Stage 9 adds the other half: a human must be able to
*look at* a closed period without the current year reinterpreting it.

**UX-P8 — Information density follows the job.**
A teacher standing in a classroom and a finance officer reconciling a bank statement do not need the
same screen shape, and giving them the same one fails both.

**UX-P9 — Optionality is real.**
When the CMS is not entitled (MA-2), its navigation does not appear and nothing in Core changes.
No stub, no "upgrade" panel, no empty section.

**UX-P10 — The teacher experience is handheld-first.** [LOCKED UXQ-1]
Not "responsive", not "works on a phone too" — **designed for the handheld case first**, with larger
screens remaining fully usable. It applies to all six teacher navigation areas: Today · Hand over ·
Holding · Exceptions · Replacements · Messages. Stage 9 establishes the commitment; **Stage 10 owns
the responsive and presentation contract that implements it** (§34).

**UX-P11 — The product speaks school language, not architecture and not commerce.** [LOCKED UXQ-2]
The domain model (`Book-supply cycle → Requirement item → Requirement lines`) is architecture and
stays in Stage 6. The interface says *books for this year · required books · additional books · books
still needed · books already provided*, in wording appropriate to each surface. It does **not** expose
`Requirement Item`, and it does **not** force *basket · cart · order* onto a book-supply lifecycle
where those words mislead. **Stage 6 names are unchanged — this is a user-facing terminology decision
only.**

---

## 2. Product surfaces

Stage 8 locked that the internal band is **not** "Core with a null school". The experience must show
that. Six surfaces:

| # | Surface | Who | Scope basis | Module band |
|---|---|---|---|---|
| **S-1** | **Entry & Account** | anyone; every context | SELF (SC-5), or none | MOD-002, MOD-009 |
| **S-2** | **School Operations** | `school_admin` · `finance` · `teacher` | **tenant-pinned** (SC-1) narrowed by authority (SC-2/SC-3) | Core MOD-001…MOD-010 |
| **S-3** | **Family** | `parent` | **relationship-derived** (SC-4) — crosses schools | Core, family-facing |
| **S-4** | **Website Studio** | `it_personnel` | tenant-pinned, **website only** | MOD-011 (optional) |
| **S-5** | **Public School Site** | public visitor | **published only** (SC-8) | MOD-011 (optional) |
| **S-6** | **BytHub Platform** | `platform_admin` · `owner` | **platform** (SC-7), or one named school (SC-6) | MOD-012 (internal) |

### Why these six and not one shell

- **S-2 and S-3 are separated by their scope basis, not by role.** S-2 is pinned to one school and
  cannot leave it. S-3 has no school pin at all — a family with children at two schools is normal
  (US-03, SC-4). Merging them would force the family experience through a tenant pin that its own
  authority model does not have.
- **S-4 is separated from S-2 because AUTH-CMS carries no operational authority.** An IT person is
  not a junior administrator. They must never encounter children, families, settlement, stock or
  custody — so those must not be in their surface at all, not merely hidden from their menu.
- **S-5 has no authority.** It is the only surface reachable with no session, and it must have no
  path into any other.
- **S-6 is the C-10 resolution.** Platform operations is a different product for a different
  company. Today it is `admin.tsx` with a section allowlist (**C-44**). Stage 9 separates the
  *experience*; Stage 13 owns the physical separation.
- **S-1 exists because sign-in, invitation acceptance and account recovery belong to no context** —
  they are what happens before a context exists.

### The surface a person meets is decided by their active context, not their account

One human may reach S-2 as a teacher on Monday and S-3 as a parent on Tuesday. The **surface changes
with the context**, and the change is deliberate and visible (§30).

---

## 3. Context and authority presentation

### 3.1 The locked model, restated for UX

```
PERSON → ACTIVE CONTEXT → ACTIVE AUTHORITIES → CAPABILITY → RESOURCE → SCOPE → CONDITIONS
```

The **context** decides the surface and the navigation.
The **authorities** decide what within that surface is offered.
They are not the same thing, and **PA-1 locked that they are separately audited facts.**

### 3.2 The rule Stage 9 must not break

```
school_admin  +  AUTH-SCHOOL              →  operational school navigation, no finance work
school_admin  +  AUTH-SCHOOL + AUTH-FINANCE →  the same navigation, plus the Money area
finance       +  AUTH-FINANCE             →  a finance-shaped workspace of its own
```

The middle row is **one context**. There is no "switch to Finance". §6 specifies exactly how it is
presented.

### 3.3 What the person is always told

| Fact | Where it lives conceptually | Why |
|---|---|---|
| Which context is active | Persistent, on every authenticated screen | A multi-context human must never guess |
| Which school the context is pinned to | Persistent in S-2 and S-4 | Tenant confusion is the most dangerous kind |
| That an act is a **finance** act | At the point of action, in S-2 | PA-1: the authority exercised is its own audit fact |
| That the session is a **support engagement** | Persistent and unmistakable in S-6 | §24 |
| That elevated authority is in force | Persistent, and time-visible, for the owner | §25 |

Stage 10 owns badges, colour and placement. Stage 9 owns only *that these facts are always present*.

### 3.4 Contexts, and the surface each lands on

| Context | Surface | Landing | Authority basis |
|---|---|---|---|
| `school_admin` | S-2 | UX-010 School operations home | AUTH-SCHOOL (+ AUTH-FINANCE by policy) |
| `finance` | S-2 | UX-063 Finance home | AUTH-FINANCE |
| `teacher` | S-2 | UX-064 Teacher home | AUTH-TEACH, **per active staffing** |
| `parent` | S-3 | UX-071 Family home | AUTH-FAMILY, **per active relationship** |
| `it_personnel` | S-4 | UX-081 Website studio home | AUTH-CMS |
| `platform_admin` | S-6 | UX-089 Platform operations home | AUTH-PLATFORM |
| `owner` | S-6 | UX-089 Platform operations home | AUTH-PLATFORM + AUTH-BREAKGLASS |
| public visitor | S-5 | UX-086 Public school site | none (SC-8) |

**There is no `student` context, no student navigation, no student landing and no student login.**
D-09 is locked; children are domain entities (DM-020), not users.

---

## 4. Navigation architecture

### 4.1 Nine work areas, not fifteen module names

The school administrator's navigation is derived from what school staff actually do across a year:

```
Today            what needs me now
School           the school itself and its academic shape
People           children, families, guardians, getting them into the system
Books            what the school sells and what it holds
Requirements     what each child needs this year
Distribution     getting the books to the child
Money            settlement — visible only with AUTH-FINANCE
Insight          reports and previous years
Administration   staff, staffing, messages, search
```

Compare with the rejected shape:

```
REJECTED                          ADOPTED
Tenancy                     →     School
Identity                    →     Administration
Academic Structure          →     School  (classes, subjects, periods)
Children & Families         →     People
Catalogue & Inventory       →     Books
Cycle & Requirements        →     Requirements
Settlement & Funding        →     Money
Fulfilment & Custody        →     Distribution
Communication               →     Administration  (and inline, per record)
Reporting                   →     Insight
```

Ten modules did not become ten menu items, and no work area maps one-to-one to a module. That is the
point of UX-P1.

### 4.2 Per-context navigation

**`school_admin` — primary**

| Area | Secondary | Notes |
|---|---|---|
| **Today** | — | UX-010 |
| **School** | Setup & go-live · Identity · Policy · Academic periods · Rollover · Classes · Subjects | Setup & go-live appears prominently until complete, then recedes to a summary |
| **People** | Children · Families & guardians · Parent access · Import | |
| **Books** | Catalogue · Bundles · Stock · Physical copies | |
| **Requirements** | Cycle board · Overrides · Corrections | |
| **Distribution** | Fulfilment board · Prepare · Hand to teacher · Collection desk · Exceptions · Replacements · Returns | |
| **Money** | Settlement · Claims · Money in · Adjustments · Replacement charges · Reconciliation · Financial reports | **Present only when the active context carries AUTH-FINANCE** (§6) |
| **Insight** | Operational reports · Previous years | |
| **Administration** | Staff · Class staffing · Communications | |
| *(persistent)* | Search · Notifications · Context · Account | Not an area — always reachable |

**`finance` — primary**

```
Money today · Claims · Money in · Adjustments · Replacement charges
Reconciliation · Corrections · Reports · Find
```

Finance's read-only reach into stock (CAP-013) and school policy (CAP-003) is surfaced **inside the
screens that need it** — never as a "Books" or "School" menu, which would make finance look like a
cut-down administrator (§7).

**`teacher` — primary**

```
Today · Hand over · Holding · Exceptions · Replacements · Messages
```

Six items, no groups, no submenus — and **all six are handheld-first** [LOCKED UXQ-1]. §8 and §9
explain why.

**`parent` — primary**

The parent's primary navigation **is the list of their children**, not a functional menu:

```
My children
  ├── Amina · Saint Jude Academy        [action needed]
  └── Yusuf · Green Lane Primary
Messages
Add a child
```

Each child carries its own school. There is no selected tenant and no school switcher, because there
is no tenant pin in AUTH-FAMILY (§10).

**`it_personnel` — primary**

```
Website · Pages & sections · Media · Presentation
```

**Branding is not here.** Today it is (`itAllowedSections` includes `branding`), and that is the
experience half of **C-5**: school identity is MOD-001, website presentation is MOD-011. §16 and §21.

**`platform_admin` — primary**

```
Operations · Tenants · Onboarding · Delivery & jobs · System health · Support · Console · Audit
```

**`owner`** — the same, **plus a separately-presented Exceptional operations area** (§25). It is not
another menu item alongside "Tenants".

### 4.3 What navigation must never do

- Never be the reason an action is safe (UX-P4).
- Never show a control the context cannot exercise, disabled, as a hint that it exists.
- Never present a CMS entry when the school is not entitled (UX-P9, MA-2).
- Never present the internal band's items inside a school's navigation (C-10, C-44).

---

## 5. School administrator experience

The administrator runs the school's book operation across a year. Their experience is shaped by the
**annual rhythm**, not by the data model.

```
SPRING           set the school up · catalogue · bundles · classes for next year
LATE SUMMER      rollover · children in · families linked · requirements set
SEPTEMBER        settlement · preparation · custody · hand-over            ← the peak
IN-YEAR          joiners · leavers · additions · replacements · corrections
CLOSE            reports · previous years
```

**Today (UX-010)** is built around *what needs me now*, not around totals. See §20.

**School (UX-011…UX-017)** — the school itself: the go-live checklist, identity, policy, academic
periods, rollover, classes, subjects. This is where a school is configured once and revisited rarely.

**People (UX-018…UX-024)** — children, families, guardians, parent access and import. The
**child operational record (UX-019)** is the administrator's composed view of one child (§13).

**Books (UX-025…UX-032)** — catalogue, bundles, class requirement assignment, stock intake and
correction, physical copies, stock position. Note that **assigning a bundle to a class (UX-029) sits
in Books, not in Requirements** — the administrator is deciding what a class is sold, and the child's
requirement is generated from it (WF-030 → WF-031).

**Requirements (UX-033…UX-036)** — the cycle board, child overrides, mid-year additions and
corrections. §12.

**Distribution (UX-037…UX-044)** — the fulfilment board, preparation, hand to teacher, collection
desk, administrator hand-over, exceptions, replacement review and returns. §12 and §16.

**Money (UX-045…UX-054)** — present only with AUTH-FINANCE. §6 and §7.

**Insight (UX-055…UX-056)** — operational reports and previous years. §22.

**Administration (UX-057…UX-062)** — staff directory, invitations, the staff record, class staffing,
the communications hub, and school-wide search.

---

## 6. Administrator + finance authority

This is the hardest presentational problem Stage 9 has, and it has an exact answer.

### 6.1 What the experience does

```
school_admin, AUTH-SCHOOL only          school_admin, AUTH-SCHOOL + AUTH-FINANCE
──────────────────────────────          ────────────────────────────────────────
Today                                    Today
School                                   School
People                                   People
Books                                    Books
Requirements                             Requirements
Distribution                             Distribution
                                         Money            ← appears
Insight                                  Insight
Administration                           Administration
```

**One context. One sign-in. No switch.** The Money area is present because the active context
carries AUTH-FINANCE (CD-4), which the school granted deliberately via CAP-032.

### 6.2 The four rules

**R-1 · No second identity.** No second account, no second sign-in, no "finance mode".

**R-2 · No context switch.** Switching contexts (CAP-039) remains for genuinely different contexts —
teacher, parent. It is **not** used for authority the current context already holds. This is PA-1.

**R-3 · Ordinary administrators see nothing of it.** No disabled Money area, no greyed controls, no
"request finance access" affordance. An administrator without AUTH-FINANCE simply does not encounter
it. (And per UX-P4, that is discoverability — CD-4 is the enforcement.)

**R-4 · A finance act announces itself as a finance act.** Where an action is a *sensitive finance
decision* — confirming settlement, rejecting a claim, authorising a discount or a waiver, deciding a
replacement charge, issuing a refund, correcting a settlement — the point of action states that it is
being performed **under finance authority** and will be attributed as such.

### 6.3 Which actions carry the finance framing

| Carries it | Does not carry it |
|---|---|
| CAP-049 confirm settlement · CAP-050 reject · CAP-051 discount/subsidy · CAP-052 waiver/school funding · CAP-053 correct settlement · CAP-054 refund · CAP-070 replacement charge · CAP-047 record money · CAP-048 apply payment | **Reading** a child's payable position on UX-019 — the administrator already holds that under AUTH-SCHOOL |

The distinction matters: framing every *view* as finance would turn the whole administrator surface
into a finance dashboard, which §6 of the brief explicitly forbids. **Acts are framed. Reads are not.**

### 6.4 What Stage 9 does not decide here

Badge shape, colour, wording, whether it is a banner or an inline statement, and whether a
confirmation step is a dialog — **Stage 10**. Stage 9 decides only that the distinction exists, where
it appears, and which capabilities carry it.

---

## 7. Finance experience

**Finance is a distinct job, not a reduced administrator.** Its home is money that needs a decision.

### 7.1 Finance home — UX-063

Answers, in order: *what needs my decision · what money has arrived that I have not placed · what is
outstanding · what is ambiguous.* §20.

### 7.2 The finance work, and where it lives

| Work | Screen | Capabilities |
|---|---|---|
| Unsettled positions across the school | UX-045 | CAP-045 |
| Submitted payment claims awaiting review | UX-046 | CAP-045, CAP-049, CAP-050 |
| Money received — bank, cash | UX-047 | CAP-047 |
| Deciding what a receipt pays for | UX-048 | CAP-048 |
| Instalment arrangements | UX-049 | CAP-047, CAP-048 |
| Discount · subsidy · waiver · school funding | UX-050 | CAP-051, CAP-052 |
| Replacement charge decisions | UX-051 | CAP-070 |
| Provider import and reference matching | UX-052 | CAP-055, CAP-056 |
| Refunds and settlement corrections | UX-053 | CAP-053, CAP-054 |
| Financial reporting | UX-054 | CAP-077 |

**CAP-047 and CAP-048 are deliberately separate screens.** Receiving money and deciding what it pays
for are different acts (DM-033 vs DM-057, OD-1). Fusing them would recreate the ambiguity Stage 6
removed.

### 7.3 The three data bands, as an experience rule

| Band | In the finance surface | Configurable |
|---|---|---|
| **Operational minimum** — child's name · class · family association · what is required · payable value · settled and outstanding · funding and subsidy applied · payment references and history | **Always present.** Reconciliation is impossible without it | **No** |
| **Optional** — date of birth · contact details · fuller family detail · sibling context beyond the paying group | Present **only where school policy grants it** (CD-10) | **Yes** — UX-013 |
| **Never on finance authority alone** — photographs · safeguarding or pastoral notes · anything held for teaching · **another school's anything** | **Absent from the surface entirely** | **No, in either direction** |

A person holding both AUTH-SCHOOL and AUTH-FINANCE sees the union — but through AUTH-SCHOOL, on the
administrator's screens, because the school decided that (CAP-032).

### 7.4 What finance is not given

No class management, no catalogue editing, no staffing, no imports, no CMS, no school configuration.
Finance reads stock position (CAP-013) where it bears on a confirmation, and reads school policy
(CAP-003) so it knows which band it is operating in — both **inside** the screens that need them.

**And finance is not given reception hand-over.** [LOCKED UXQ-3] Reception collection (CAP-064) is
AUTH-SCHOOL work. Finance officers commonly sit in the same room as the school office — that is
physical co-location, and it changes nothing:

```
standalone finance
  → finance context, AUTH-FINANCE
  → finance work
  → NOT reception hand-over, however close the desk is

school_admin + AUTH-FINANCE
  → one context (PA-1)
  → school operations INCLUDING reception collection   ← via AUTH-SCHOOL
  → finance work                                       ← via AUTH-FINANCE
```

**Sharing an office is not sharing an authority.** `AUTH-SCHOOL ≠ AUTH-FINANCE`, and Stage 7's
separation is untouched.

---

## 8. Teacher experience

### 8.1 Scope — universal and non-negotiable

```
TEACHER SCOPE  =  ACTIVE STAFFING (SC-2)  ∩  ACTIVE CLASS MEMBERSHIP (SC-3)
```

Every teacher screen resolves its content from that intersection, computed the same way, every time.
This is the target-experience half of **C-6** (§29).

### 8.2 The teacher's moment — handheld-first [LOCKED UXQ-1]

The teacher is standing up, holding books, with a queue of children. The experience is **designed for
that moment first** and remains fully usable on larger screens — not the reverse.

```
TEACHER
  → physically in the classroom
  → handling books
  → working through children one at a time
  → recording hand-over and exceptions as they happen
  → on a phone or tablet
```

**What handheld-first commits the teacher surface to:**

| Commitment | Meaning at Stage 9 |
|---|---|
| Handheld use is primary | The phone/tablet case is the design target, not the fallback |
| Quick interaction | The common act — hand these books to this child — is reachable in the fewest steps |
| Low interaction overhead | No dependence on interactions a hand cannot perform while holding books |
| Clear task progression | The teacher always knows where they are in the class and what is left |
| Minimal unnecessary information | One job per screen; nothing school-wide, nothing financial |
| Works while moving | The workflow survives being put down and picked up mid-class |

It **must remain usable on larger screens.** This is a priority, not an exclusion.

**Stage 9 decides only that teacher workflows are designed handheld-first.** Breakpoints, pixel sizes,
tap-target dimensions, component layouts, CSS and responsive implementation are **Stage 10** (§34).

| Screen | The job |
|---|---|
| UX-064 Teacher home | *Which class am I working with, and how much is left?* |
| UX-065 Class hand-over list | *Who still needs their books?* |
| UX-066 Hand-over to a child | *Give these books to this child and record it.* |
| UX-067 Books I'm holding | *What is in my custody right now?* |
| UX-068 Report an exception | *Absent · short · refused · wrong item.* |
| UX-069 Request a replacement | *Damaged or lost — with a mandatory reason.* |
| UX-070 Teacher ↔ family messages | *Message this child's family about this.* |

### 8.3 What the teacher never sees

Another class · unrelated children · school-wide finance · a settlement figure beyond *is this child
cleared to receive* · school configuration · staff administration · stock beyond what they hold ·
the catalogue · any other school.

**On settlement:** the teacher sees a **readiness fact**, not a financial one — this child's books are
allocated and prepared, or they are not. Amount, route, references and funding are outside AUTH-TEACH.

### 8.4 The teacher's own child — CD-5

CD-5 is a **hard, unconditional** block (BR-056): a teacher may not hand over to a child they are a
guardian of. The experience must represent this without an override button.

```
UX-065 Class hand-over list
  ├── Amina Bello      ready
  ├── Joseph Adeyemi   ready
  └── Sara Okonkwo     ready — HANDLED BY THE SCHOOL OFFICE
                              (you are recorded as a guardian of this child)
```

- The child **remains visible in the teacher's list** — they are in the class, and hiding them would
  make the teacher believe the child had been missed.
- The hand-over action is **absent, not disabled-with-an-override**. There is nothing to click.
- The child appears automatically in **UX-041 Administrator hand-over**, so the block never leaves a
  child without their books (BR-131, CAP-063 via AUTH-SCHOOL).
- The teacher can still **message the family** (CAP-072, SC-3) and **report an exception**.

No new authority is invented. The block is a condition on a capability, exactly as Stage 7 locked it.

---

## 9. Teacher handheld-first — DECIDED

```
UXQ-1 — DECIDED A
The teacher experience is officially designed handheld-first.
This is a product-experience decision, not an implication.
```

### 9.1 What changed at lock

`PP-007` was already locked as a principle: *"The classroom is the least forgiving surface. Hand-over
happens on a phone, standing up, with 30 children waiting. If a workflow cannot survive that it is not
finished."*

What was **not** decided was the product commitment. `PRODUCT.md` listed *"the teacher surface is
meant to be mobile-first (PP-007)"* under `[IMPLIED] — still not formally decided`, and Stage 0 found
24px tap targets and hover-only controls in the shipped UI.

**That gap is now closed by owner decision.** Handheld-first is a locked Stage 9 product-experience
commitment. **Nowhere in this document is it described as implied, aspirational or undecided.**

> **Traceability note.** `PRODUCT.md` is LOCKED, and this document does not edit it. Its `[IMPLIED]`
> list still reads as it did when Stage 1 was locked, and it is not backdated. The decision is
> recorded **here**, at Stage 9, as UXQ-1 — the stage that owns experience architecture and the stage
> at which the owner made it. Any later stage reading `PRODUCT.md`'s implied list must read this
> section alongside it.

### 9.2 The evidence it rests on

WF-051 (hand to the student), WF-053 (student absent) and WF-054 (partial availability) are all
performed while physically handling books, away from a desk, one child at a time. WF-050 puts custody
in the teacher's hands before any of it starts. Nothing in the teacher's locked capability set
(CAP-062, CAP-063, CAP-065, CAP-067, CAP-072, and CAP-021/CAP-041 in their narrow bands) is a
desk-shaped task.

### 9.3 What it binds, and what it does not

**Binds** — all six teacher navigation areas and all seven teacher screens: UX-064 Today · UX-065 Hand
over · UX-066 Hand-over to a child · UX-067 Holding · UX-068 Exceptions · UX-069 Replacements ·
UX-070 Messages. Handheld usability is a **completion criterion** for each, not an enhancement.

**Does not bind** — any other context. The administrator, finance, family, CMS, public and platform
surfaces are unaffected by this decision.

**Not decided here** — breakpoints · pixel sizes · component layouts · button and tap-target sizes ·
CSS · responsive implementation. **Stage 10 receives a locked handheld-first teacher experience and
owns the responsive and presentation contract that delivers it** (§34).

---

## 10. Parent / family experience

### 10.1 The navigation model — child-first, never tenant-first

Parent scope is **relationship-derived (SC-4), not `schoolId`-based**, and it crosses schools freely.
The family navigation is therefore **the list of children**, each carrying its own school:

```
MY CHILDREN
  ├── Amina  ·  Year 3  ·  Saint Jude Academy       ← action needed
  └── Yusuf  ·  Year 6  ·  Green Lane Primary       ← ready to collect
```

**There is no school selector and no "current school".** A single-selected-tenant portal would break
the legitimate cross-school family that US-03 locked, and would misrepresent an authority model that
has no tenant pin in it.

### 10.2 The family's screens

| Screen | The job |
|---|---|
| UX-071 Family home | *What does each child need, and is anything waiting on me?* |
| UX-072 Child's year | The child's whole cycle: requirements, settlement, fulfilment, history |
| UX-073 Requirement detail | What this particular requirement contains and what it costs |
| UX-074 Settle a requirement | Choose an available settlement route (§11) |
| UX-075 Submit a payment reference | The bank-transfer claim (WF-035) |
| UX-076 Payment & funding history | Everything paid, applied, subsidised, waived, refunded |
| UX-077 Fulfilment route | Reception collection or classroom delivery, per child (§15) |
| UX-078 Collection & readiness | Is it ready, where, and who may collect it |
| UX-079 Link another child | Redeem a linking code (CAP-026) |
| UX-080 Messages with the school | CAP-073 |

### 10.3 Boundaries

A family sees **their own children only** — never another family, another child, or another family's
funding position. They never set a settlement status (BR-071); they *claim*, and finance *confirms*.
They cannot reach any staff operation, and attending a school gives them no reach into that school's
data.

### 10.4 When access lapses — C-15 / WF-018

When the last active guardian relationship ends, AUTH-FAMILY becomes inactive automatically. The
experience must not present this as an error or a deletion:

```
UX-071 Family home, with no active relationships
  → "There are no children linked to this account at the moment."
  → the account, history and past records are retained
  → "Add a child" remains available — a new code restores access without recreating anything
```

**This is a REAL EMPTY, not a failure and not a zero** — precisely the distinction §28 protects.

---

## 11. Settlement and reconciliation experience

### 11.1 The C-2 resolution — represent what the product can actually do

The locked product (D-02) preserves bank transfer and intends real online payment later. The current
portal's promise runs ahead of the implementation. The target experience states the truth:

```
PAY FOR AMINA'S SEPTEMBER BOOKS · £48.50        ← school/book language, UXQ-2
                                                   never "Checkout" or "Order #1"

  ● Bank transfer                                   available now
    Pay using the school's payment details, then submit your reference.
    The school confirms it — usually within two working days.

  ● Pay at the school office (cash)                 available now
    The school records it when you pay. Nothing to do here.

  ● Pay in instalments                              where the school offers it
    Ask the school to arrange a schedule.

  ● Help with the cost                              where the school offers it
    Contact the school — discounts, subsidies and school funding are
    arranged by the school and appear here once applied.

  ○ Pay by card online                              not available
    ScholarShelf does not take card payments yet.
```

Four rules make this honest and future-capable:

1. **Nothing is offered that does not work.** No "Pay Now" that leads nowhere.
2. **A route that does not exist yet is either absent or plainly marked unavailable** — never styled
   as an option that happens to fail.
3. **Routes the school has not enabled are absent, not broken.**
4. **The list is the product's real capability set at that moment.** When online payment is built
   (WF-041, F-050), it becomes an available route in the same list. No re-architecture, no new screen.

**Not designed here:** any payment provider integration, any checkout flow, any card handling. D-02's
future is a slot in a list, and nothing more.

### 11.2 The family never sets status

The family **submits a claim** (CAP-046). Finance **confirms or rejects** (CAP-049/CAP-050). The
family's screens say so:

```
Reference submitted — waiting for the school to confirm
```

never *"Paid"*, and never a figure that implies the school agrees.

### 11.3 Reconciliation — the finance side

UX-046 is a **queue of decisions**, not a list of payments: each row is a claim with the child, the
requirement, the claimed reference, the payable value, and what finance needs to accept or reject it.
UX-052 handles imported provider records and reference matching (CAP-055, CAP-056), and its
**ambiguous and unmatched** outcomes are work, not noise — they belong on the finance home (§21).

**Naming:** the current "Stripe Payment Data" screen imports a spreadsheet and matches references. It
is not a Stripe integration (**C-28**). The target screen is named for what it does — *provider
records and reconciliation*.

### 11.4 Confirmation is one act — I-2

Confirming settlement, allocating copies and deducting stock are **one atomic business outcome**
across MOD-007, MOD-008 and MOD-005 (I-2, MA-1). The experience must present it as one act:

```
CONFIRM SETTLEMENT — Amina Bello · September requirement · £48.50
  This will confirm the settlement, allocate the copies and reduce stock.
  [Confirm]
```

There is no separate "now allocate" step and no separate "now deduct stock" step. A failure reports
that **nothing happened** — never a partial success (WF-044, WF-045). Stage 13 owns the orchestration;
Stage 9 owns only that the human sees one act.

---

## 12. Fulfilment and custody experience

### 12.1 The chain, and who touches it

```
SETTLEMENT CONFIRMED
   → ALLOCATION            MOD-008, at confirmation (I-2, MA-1)
   → ROUTE RESOLVED        family, or school on their behalf   UX-077 / UX-037
   → PREPARATION           school office                       UX-038
   → ┬ RECEPTION ROUTE  → admin office collection               UX-040
     └ CLASSROOM ROUTE  → transfer to teacher                   UX-039
                        → teacher custody                       UX-067
                        → hand-over                             UX-066
   → HAND-OVER RECORDED    the books reached the person who takes them away
```

**Reception collection and teacher hand-over are two different jobs done in two different places** —
the administration office and the classroom. They are not two definitions of the same ending; they
*converge* on the same concept (DM-043 hand-over), which is what Stage 5 §10 established when it found
RE-8 modelled six times.

### 12.2 The four missing surfaces this stage creates

**UX-037 Fulfilment board** — *what must be prepared, for whom, by which route.* Today nothing shows
the school what work is waiting. Grouped by route, then by class, then by child; unresolved routes
are surfaced as their own work (§15).

**UX-038 Prepare a child's books** — the office picks and prepares; a pre-hand-over substitution
(Branch A, CAP-068, WF-034) happens here, where the child has not received anything yet and no charge
question arises.

**UX-039 Hand books to teacher** — **the C-3 resolution.** `handed_to_teacher` exists in the code with
no screen driving it (F-054). Target:

```
HAND BOOKS TO TEACHER
  Class:    Year 3 Blue
  Teacher:  [ Mrs Adeyemi — active staffing ▾ ]
  Prepared: 24 children · 61 copies
  [ Transfer custody ]

  → custody moves to the named teacher (CAP-061, DM-042)
  → the teacher now sees them in UX-067 "Books I'm holding"
```

Only teachers with **active staffing on that class** are offerable. Custody moves to a *named person*,
and their holding view (UX-067) is the immediate proof it happened.

**UX-040 Reception collection** — **an administration-office function** [LOCKED UXQ-3].

```
ADMIN OFFICE
  → Ready for collection
  → Find child
  → Verify authorised recipient
  → Record hand-over            CAP-064
```

This is a **`school_admin` experience**, performed from the school's administration office by a person
holding AUTH-SCHOOL. There is no separate reception product surface, no receptionist navigation and no
front-office context — collection is one screen inside the administrator's **Distribution** area.

Being an office function does **not** widen what the screen shows: the normal Stage 7 capability and
scope rules apply, and UX-040 shows what a collection needs — the child, what is ready, and who is
authorised to take it — and nothing more.

### 12.3 Custody is visible to the person who holds it

UX-067 exists because custody with no visible holder is not custody. The teacher sees what they hold;
the office sees what it has transferred and to whom. Custody holding is **derived, never stored**
(DM-041) — the screen composes it from events, and does not invent a status.

### 12.4 Exceptions

UX-068 (teacher) and UX-042 (admin) record fulfilment exceptions (CAP-065, DM-044): absent, short,
refused, wrong item. An exception is an **event that happened**, not a status that replaces the
requirement — Stage 6's central insight, applied to the screen.

---

## 13. Child and cycle experience

### 13.1 Decision — four purpose-shaped views, one shared identity, no universal child screen

There is **no single child workspace with authority-filtered sections**. There are four views of a
child, each shaped by a job:

| View | Screen | Shows | Deliberately absent |
|---|---|---|---|
| **Administrative** | UX-019 | Identity · class & membership history · family & guardians · cycle & requirements · settlement position · fulfilment & custody · messages · attribution | Nothing within AUTH-SCHOOL — this is the fullest view |
| **Financial** | within UX-045 / UX-046 | The operational minimum band, plus the optional band where policy grants it | Photographs · pastoral notes · teaching information · another school's anything |
| **Teaching** | within UX-065 / UX-066 | Name · class · what they are due to receive · readiness · exceptions | Money · route detail beyond what it means for hand-over · family finance · configuration |
| **Family** | UX-072 | Their own child's whole year: requirements, settlement, funding, fulfilment, history | Any other child · any other family · school operations |

### 13.2 Why not one screen with filters

Three reasons, each from a locked stage:

1. **The bands are not subsets of one another.** Finance's optional band is a *policy* decision;
   teaching's exclusions are *fixed*. A filtered single screen would model both as visibility toggles
   on the same object, which is how a security invariant quietly becomes a preference (§19).
2. **The jobs are different, so the densities are different** (UX-P8). The teacher's child view is
   two lines and one action; the administrator's is a page.
3. **Composition risk.** One screen with a section per module is precisely the shape that produced
   **C-45** — the place where a view starts computing a lifecycle it does not own.

### 13.3 What the administrative view composes — and does not own

```
UX-019 Child operational record
  MOD-004  child · family · guardians          ← MOD-004's truth
  MOD-003  class · membership history          ← MOD-003's truth
  MOD-006  cycle · requirement items           ← MOD-006's truth
  MOD-007  settlement position (derived)       ← MOD-007's truth
  MOD-008  allocation · custody · hand-over    ← MOD-008's truth
  MOD-009  message threads                     ← MOD-009's truth
  MOD-013  who did what, when                  ← MOD-013's truth
```

The screen renders seven modules' facts side by side. It computes none of them, and it does not
publish a single "child status" of its own. **A composed view is not an owner** (§37 of the brief,
I-10 of Stage 8).

### 13.4 The cycle, expressed for humans [LOCKED UXQ-2]

DM-023 is the product's spine, and "book-supply cycle" is an **internal** term. The user-facing
expression is **the books for this child's year**:

```
AMINA BELLO · YEAR 3

  BOOKS FOR 2026/27

  September books        £48.50    Paid / settled      received 5 September
    5 books · bank transfer · confirmed 2 September

  Additional January book £12.00   Payment needed      due 15 January
    replacement of a damaged reader

  Previous years  ▸
```

**not**

```
Requirement Item #1        ← architecture leaking into the interface
Requirement Item #2

Order #1                   ← commerce language the product does not earn
Order #2
```

**The two requirements are shown separately and settle separately.** Adding the January requirement
does **not** make September look unpaid, and no single status is computed for the year. This is the
§12 requirement of the brief and the direct experience consequence of DM-024 (requirement item) —
whose absence in the code is **C-37**.

---

## 14. Product terminology — DECIDED

```
UXQ-2 — DECIDED A
Use normal school/book language in the product surfaces.
Do not expose "Requirement Item".
Do not force basket / cart / order onto the book-supply lifecycle.
```

### 14.1 The two layers, kept apart

```
DOMAIN / ARCHITECTURE  — Stage 6, LOCKED, unchanged
    Book-Supply Cycle
      → Requirement Item
        → Requirement Lines

USER-FACING LANGUAGE   — Stage 9, this decision
    Books for this year · Required books · Book requirements
    Additional books · Books still needed · Books already provided
```

**Stage 6 domain concepts are not renamed.** `DATA_MODEL.md` remains exactly as locked. This is a
user-facing terminology decision only, and it changes no entity, no ownership and no screen's shape.

### 14.2 What is now settled

| Rejected | Why | Adopted |
|---|---|---|
| `Requirement Item #1`, DM numbers, "cycle" as a label | Architecture leaking into the interface | *September books* · *Additional January book* |
| `Basket` · `Cart` · `Order` · `Checkout` | Imports a shopping model the product does not offer — a family cannot choose, decline or vary what the school has required | *Books for 2026/27* · *Books still needed* |

### 14.3 Wording varies by surface; the model does not

The exact words are chosen for the reader — a parent, a school administrator, a teacher, a finance
officer — while the underlying object is the same in every case. **Stage 10 may later standardise the
exact labels and language consistently across surfaces.** Stage 9 fixes the register, not the string.

### 14.4 What this does for C-48

C-48 records that the family experience is order-shaped where the product is cycle-shaped. UXQ-2
**strengthens the target correction** by removing the vocabulary that keeps the order shape alive:

```
TARGET                              NOT
CHILD                               SHOP
 → books for this year               → cart
   → required / additional books      → order
     → individual settlement state
     → fulfilment state
```

**C-48 is not resolved by this.** The current interface is still order-shaped; see §31.

---

## 15. Fulfilment route experience

Stage 5 deferred this question to Stage 9 explicitly. Here is the answer.

### 15.1 Where the route is chosen and changed

| Question | Answer |
|---|---|
| Where does the family choose it? | **UX-077**, per child — and offered at the end of UX-074 so it is not forgotten |
| Where does an administrator record it on the family's behalf? | **UX-037**, on the unresolved-routes group, and on **UX-019** |
| Where is it visible operationally? | **UX-037** (grouped by route) · **UX-038** · **UX-040** · **UX-065** |
| Where does the family change it? | **UX-077**, while the change is still permitted |
| Where does an administrator change it? | **UX-037** / **UX-019** (CAP-059 also sits with AUTH-SCHOOL) |

### 15.2 It is per child, not per family and not per class

Two children in the same class may take different routes; two children in one family may take
different routes. The screens group **by route within a class**, never assuming a class is uniform.

### 15.3 The route must be resolved before preparation

UX-037 shows unresolved routes as **work**, not as a blank:

```
FULFILMENT BOARD · Year 3 Blue
  Reception collection      8 children     ready to prepare
  Classroom delivery       14 children     ready to prepare
  Route not yet chosen      2 children     ← needs resolving before preparation
```

### 15.4 After transfer, a change is an operation — not a silent edit

Once custody has moved (UX-039) or a collection is staged (UX-040), changing the route is no longer an
edit of a preference. The experience presents it as a **recorded operational change** (WF-055,
CAP-059) that names what must physically happen — the books must come back from the teacher, or come
off the collection shelf — and it is attributed. It is never a dropdown that silently rewrites the
instruction under someone who is holding the books.

### 15.5 Postal — future only

F-084 / WF-068 / CAP-066 are **FUTURE**. The route list is built so a third route can join it, and
**no postal screen is designed in this rebuild.**

---

## 16. Replacement experience — the C-39 split

Four capabilities, three people, four surfaces. **There is no single "Approve Replacement" screen.**

```
TEACHER                UX-069  Request a replacement        CAP-067
                               mandatory reason             (SC-3, CD-2)
                                   ↓
ADMINISTRATOR          UX-043  Replacement review queue     CAP-069
                               operational decision:        (AUTH-SCHOOL)
                               is a replacement provided?
                                   ↓
              ┌── PRE-HAND-OVER (Branch A, CD-11 PRE) ─────────────────┐
              │   UX-038  substitute during preparation   CAP-068      │
              │   no charge question — the child never received it     │
              └───────────────────────────────────────────────────────┘
                                   ↓
              ┌── POST-HAND-OVER (Branch B, CD-11 POST) ──────────────┐
              │ FINANCE   UX-051  Charge decision queue    CAP-070    │
              │           chargeable · absorbed by the school         │
              │                       ↓ if chargeable                 │
              │           UX-035  new requirement item      CAP-042   │
              │                       ↓                               │
              │ FAMILY    UX-007 notification + UX-072 the new        │
              │           requirement appears in the child's year     │
              └──────────────────────────────────────────────────────┘
```

### Why the split is presentational as well as structural

Each screen belongs to the person whose responsibility it is:

- The **teacher** states what happened. They do not decide whether a replacement is given, and they
  never see or decide a charge.
- The **administrator** decides the operational question. They do not decide the money.
- **Finance** decides the money. They do not decide whether the child gets a book.
- The **family** learns about a new payable requirement through MOD-009 (WF-071), as a notification
  with a durable record — **not** as a figure that silently appears in a total.

Today the teacher's "Extra Copy Requests" screen fuses the request and the operational resolution
into one surface with no finance step at all — see **C-51** (§31).

---

## 17. Rollover experience

### 17.1 The one thing this screen must not look like

```
WRONG:  "Move everybody up a year"   → this is the destructive model
RIGHT:  "Here is next year. Here is what will be true in it.
         Everything about this year stays exactly as it is."
```

Rollover is **explicit, administrator-initiated, never triggered by a date, and history-preserving**
(D-07, PP-006, CAP-005, WF-028).

### 17.2 UX-015 Rollover workspace — what the administrator must understand before acting

```
ROLLOVER · 2026/27 → 2027/28

  CURRENT PERIOD  2026/27          NEXT PERIOD  2027/28
  Classes            18            Classes           18  (2 new, 2 not continuing)
  Children          412            Advancing        367
                                   Moving differently 12  ← review
                                   Leavers           33
                                   Joiners            —   (added after rollover)

  WHAT WILL HAPPEN
    · Each continuing child gains a new class membership in 2027/28
    · A new book-supply cycle opens for each continuing child
    · New classes are created; classes not continuing are closed, not deleted

  WHAT WILL NOT HAPPEN — this is guaranteed
    · No 2026/27 class membership is changed
    · No 2026/27 requirement, settlement, allocation, custody event
      or hand-over is altered in any way
    · No historical attribution is rewritten
    · Nothing about 2026/27 is deleted

  [ Review the 12 children moving differently ]   [ Run rollover ]
```

**Three experience rules:**

1. **The consequences are stated before the act**, including — explicitly — what will *not* change.
   The reassurance is the feature: it is what distinguishes this from the old overwrite.
2. **Exceptions are reviewed, not batch-defaulted.** Children moving differently, leavers and children
   with unfinished business are surfaced as a review step.
3. **Nothing is deleted.** Classes that do not continue are closed. Their records remain readable in
   **UX-056 Previous years** (§22).

Batch algorithms, transaction boundaries and data changes are **Stage 13 and Stage 15**.

---

## 18. School policy experience

### 18.1 UX-013 exists because four locked decisions assume it and nothing implements it (F-024, C-17)

**The four settings, and nothing else:**

| Setting | What it changes | Locked by |
|---|---|---|
| Does `school_admin` also hold AUTH-FINANCE? | Whether the Money area exists for administrators (§6) | US-05, CAP-032 |
| Finance's optional child-data band | The middle band only (§7.3) | US-07 |
| Permitted presentation customisation | Within the canonical design system | US-02 |
| *(Reserved)* | Only if real evidence demands it | OQ-2 |

### 18.2 What must never appear on this screen

```
NOT SETTINGS — these are invariants, and a toggle would make them negotiable:

  ✘ tenant isolation                    ✘ student login
  ✘ teacher class scope                 ✘ BytHub standing tenant access
  ✘ the own-child hand-over block       ✘ platform authority
  ✘ finance's operational minimum       ✘ finance's never-band
  ✘ historical immutability             ✘ a family setting a settlement status
```

> **The test:** a setting exists to serve a real difference between schools. It must never exist to
> make a security rule negotiable.

### 18.3 The screen states its own limits

UX-013 does not present an empty "advanced" area or a hint that more is configurable. Where a school
asks about something on the forbidden list, the honest answer is that it is not a setting — and the
screen should read as though that were obvious.

### 18.4 Where policy is *felt*

Policy is set in one place and felt in several: the Money area's presence (§6), the finance child-data
band (§7.3), and permitted presentation (Stage 10). Each of those screens reads policy; **none of them
owns it** — MOD-001 does.

---

## 19. Staff / access experience

### 19.1 The four things the interface must keep apart

```
ACCOUNT              a person who can sign in                    DM-007  PLATFORM
STAFF PROFILE        a person the school employs                 DM-011  SCHOOL
GUARDIAN RECORD      a person responsible for a child            DM-010  SCHOOL
CLASS STAFFING       a person teaching a class, for a period     DM-019  SCHOOL
```

**These are four different things about possibly the same human.** US-02's locked rule —
`GUARDIAN RECORD ≠ LOGIN ACCOUNT`, `TEACHER PROFILE ≠ USER LOGIN` — is a data rule that only becomes
real if the interface stops implying otherwise.

### 19.2 The staff record — UX-059

One person, four separable decisions:

```
MRS ADEYEMI

  ACCOUNT      active · MFA enrolled · last signed in 3 days ago
               [ Suspend account ]  [ Reactivate ]

  ROLES        school_admin ✓   teacher ✓                     CAP-031
               [ Grant a role ]  [ Remove a role ]

  FINANCE AUTHORITY    not held                                CAP-032
               A separate decision. Granting it lets this person confirm
               settlements, authorise discounts and waivers, decide
               replacement charges and issue refunds.
               [ Grant finance authority ]

  CLASS STAFFING       Year 3 Blue · from 01/09/2026 · no end date   CAP-016
                       [ Add ]  [ Set an end date ]  [ Revoke ]

  ALSO AT THIS SCHOOL  Guardian of Sara Okonkwo (Year 3 Blue)
                       This is a family relationship and is not affected
                       by anything on this page.
```

**CAP-032 is deliberately its own act**, with its consequences stated. It is the decision that makes
an administrator also finance (C-13), and it must never be a checkbox in a list of roles.

### 19.3 Leaving — the ordinary action is not deletion

```
THE ORDINARY LEAVER PATH

  Offboard staff                    CAP-035 · WF-010
    · staff role ends
    · class staffing ends
    · the account remains
    · the guardian relationship is untouched — they are still a parent
    · all historical attribution remains

  Suspend                           CAP-033 · WF-009
    · reversible; use for absence or investigation

  Erase an account                  CAP-036
    · NOT AN ORDINARY ADMINISTRATIVE ACTION
    · not offered as a leaver option anywhere in this navigation
    · a controlled privacy process — Stage 16 owns who executes it and how
```

Hard deletion (F-022, **C-12**) must not be reachable as the obvious way to handle a leaver. It is
absent from the staff record's actions, and the offboard path states plainly what it preserves.

### 19.4 Time-bounded staffing — F-023, C-14

Cover and TA assignments need an end date (US-10, WF-012, WF-013). UX-060 makes the end date a
first-class field, shows assignments that are ending, and shows expiry as a normal, expected event.
When staffing lapses, the teacher's reach lapses with it (CD-2) — and the teacher's own screens should
make that legible rather than looking broken.

### 19.5 Parent access lifecycle — F-035, C-15

UX-022 shows the administrator the guardian-access position: invited, linked, code outstanding, code
rotated, relationship ended. Access ending is **automatic** when the last relationship ends — the
administrator observes it; they do not perform it.

---

## 20. Dashboard purposes

**Not every context needs a dashboard.** Each one below exists because there is a question worth
answering at sign-in, and each is defined by *its question*, not by its cards.

| Context | Screen | The question | Composed from | Must never |
|---|---|---|---|---|
| `school_admin` | UX-010 | **What needs me today?** | Unresolved routes · books awaiting preparation · exceptions · replacement reviews · incomplete children or families · outstanding requirements · stock that will not cover confirmed demand · go-live steps | Compute a settlement or custody status of its own (**C-45**, I-10) |
| `finance` | UX-063 | **What money needs a decision?** | Claims awaiting review · money received not yet applied · ambiguous or unmatched provider records · replacement charge decisions · outstanding positions | Show a revenue figure it derived itself |
| `teacher` | UX-064 | **Which class, and how much is left?** — **handheld-first** [UXQ-1]: answerable at a glance, standing up, holding books | Assigned classes (SC-2) · children awaiting hand-over (SC-3) · what I hold · my open exceptions | Show anything school-wide, or any money |
| `parent` | UX-071 | **What does each child need, and is anything waiting on me?** | Per child: outstanding requirements · claims awaiting confirmation · readiness · new messages | Show a single blended family total that hides which child needs what |
| `platform_admin` | UX-089 | **Which tenants need operational attention?** | Tenants by lifecycle state · onboarding not completed · failed jobs and deliveries · open support engagements · health | Show cross-tenant children, payments or revenue (**C-10**) |
| `it_personnel` | UX-081 | **What is the state of the website?** | Drafts unpublished · sections · recent publications · media | Show any operational school data |
| `owner` | UX-089 | Same as `platform_admin` | Same | Present exceptional operations as routine cards (§25) |

**No dashboard is a landing pad of totals.** Every dashboard item is either *information* or *action
required*, and §21 keeps those apart.

---

## 21. Work queues and notifications

### 21.1 Queues, because a dashboard is not a to-do list

| Queue | Screen | Owner of the work |
|---|---|---|
| Payment claims awaiting review | UX-046 | finance |
| Money received, not yet applied | UX-048 | finance |
| Ambiguous / unmatched provider records | UX-052 | finance |
| Replacement charge decisions | UX-051 | finance |
| Replacement operational reviews | UX-043 | administrator |
| Unresolved fulfilment routes | UX-037 | administrator |
| Books awaiting preparation | UX-037 | administrator |
| Collections ready | UX-040 | school administration office (`school_admin`) |
| Fulfilment exceptions | UX-042 | administrator |
| Children awaiting hand-over | UX-065 | teacher |
| Import rows needing attention | UX-024 | administrator |
| Pending guardian invitations | UX-022 | administrator |
| Support engagements open | UX-095 | platform |

### 21.2 Information vs action required

```
INFORMATION          something happened; you may want to know
ACTION REQUIRED      something is waiting for a decision only you can make
```

A queue with nothing in it is a **real zero** and should say so plainly. A queue that could not load
is **not** an empty queue (§28).

### 21.3 Notification truth belongs to MOD-009

UX-007 is the notification centre, and it reads **durable notification records** (DM-051). It is not a
list of emails that were sent. This is the experience consequence of **C-46**: today, sending *is* the
notification, so a delivery failure destroys the fact that a person was owed a message — which under
WF-071 includes telling a family they now owe money.

Delivery outcomes (DM-052) are **infrastructure**, and are visible at UX-093 in the internal surface —
not in a school's notification list. Reporting never generates a notification.

---

## 22. Historical views

### 22.1 History has no surface today — and that is a gap, not an oversight

Every current screen is "as at now". PP-006 stops the past being *rewritten*; nothing lets a human
*look at* it. See **C-49** (§31).

### 22.2 UX-056 Previous years

```
PREVIOUS YEARS · Saint Jude Academy

  2025/26   CLOSED      18 classes · 398 children · 396 cycles closed
  2026/27   CURRENT

  Viewing 2025/26 — this period is closed. Records are read-only.
  Corrections to a closed period are recorded as corrections (WF-029),
  never as edits.

  Classes ▸   Children ▸   Requirements ▸   Settlement ▸
  Allocations ▸   Hand-overs ▸   Corrections ▸
```

**Four rules:**

1. **Reading a closed period never reinterprets it.** Amounts, class names, year groups and statuses
   render as they were, not as this year's vocabulary would express them.
2. **A child who has moved class this year still appears in last year's class.** Class membership is
   period-scoped (DM-021, OD-3) — this is the whole reason **C-9** matters.
3. **Corrections are visible as corrections** (DM-047), with attribution, alongside what they
   corrected. Not as a silently different value.
4. **History is reachable from the record, not only from the archive.** UX-019 and UX-072 both carry a
   "previous years" path, so a person looking at a child does not have to go elsewhere to see the
   child's past.

### 22.3 Who sees history

| Context | Historical reach |
|---|---|
| `school_admin` | Full, within the school (SC-1) |
| `finance` | Settlement and funding history, within its bands (§7.3) |
| `teacher` | **Only their own past classes**, and only where staffing covered them |
| `parent` | Their own children's past years (SC-4) — including years at a school the child has left |
| `platform_admin` | None. Tenant metadata is not school history (SC-7) |

---

## 23. UX screen catalogue

**103 target screens and workspaces** across six surfaces. Frontend routes and URLs are **not**
specified — Stage 14 and later implementation own them.

Each entry records: *Surface · Contexts · Purpose · Capabilities · Workflows · Modules · Deliberately
absent · Scope · Important states · Current equivalent · Classification.* Screens sharing a pattern are
grouped to keep this readable; every screen carries its own identity, capabilities and scope.

### S-1 · Entry & Account (9)

**UX-001 · Sign in**
Surface S-1 · unauthenticated · *Purpose:* establish a session and resolve available contexts ·
*Actions:* sign in · recover access · *Deliberately absent:* any indication of which schools an email
belongs to · *States:* loading · invalid credentials · account disabled · **school suspended (the
account is fine; the tenant is not)** · *Current:* `login.tsx` · **KEEP CONCEPT**

**UX-002 · Multi-factor challenge**
Surface S-1 · *Purpose:* complete MFA where required · MFA is **mandatory for platform authority** and
available to others · *Current:* `login.tsx` + `mfa` flow, F-014 PARTIAL · **KEEP CONCEPT**

**UX-003 · Password reset**
Surface S-1 · *Purpose:* one flow — request · sent · set · confirmed · *States:* the "sent"
confirmation must not disclose whether the address exists · *Current:* `forgot-password.tsx`,
`reset-password.tsx` (+4 mockups) · **MERGE** into one flow

**UX-004 · Accept an invitation**
Surface S-1 · *Purpose:* a staff member or guardian turns an invitation into an account (CAP-030
issued; WF-007, WF-015) · *States:* expired · already accepted · revoked · **school suspended** ·
*Current:* `accept-invite.tsx` · **KEEP CONCEPT**

**UX-005 · Parent self-registration**
Surface S-1 · *Purpose:* create a family account and redeem a first linking code (WF-016, WF-017,
CAP-026) · *Deliberately absent:* choosing a school — the **code** determines the relationship ·
*Current:* `register.tsx` · **KEEP CONCEPT**

**UX-006 · My account & security**
Surface S-1 · any context · SC-5 · *Capabilities:* CAP-038 · *Purpose:* name, contact, password, MFA
enrolment and recovery codes · *Deliberately absent:* anything about roles or authorities — a person
cannot grant themselves anything · *Current:* scattered · **MISSING as a single surface**

**UX-007 · Notifications**
Surface S-1 · any context · SC-5 · *Capabilities:* CAP-074, CAP-075 · *Purpose:* the durable
notification record (DM-051) and preferences · *Deliberately absent:* delivery diagnostics — those are
MOD-015 and internal · *Current:* notification preferences exist; **the durable record does not
(C-46)** · **PARTIAL**

**UX-008 · Choose context**
Surface S-1 · multi-context accounts only · *Capabilities:* CAP-039 · *Purpose:* move between
genuinely different contexts · *Deliberately absent:* **any finance switch** (PA-1, §6) · *Current:*
context switching exists (F-017) · **KEEP CONCEPT**

**UX-009 · Not available**
Surface S-1 · *Purpose:* one honest response to *not found · not authorised · context lapsed · school
suspended*, each distinguishable · *Current:* `not-found.tsx` · **REPURPOSE**

### S-2 · School Operations — administrator (53)

**UX-010 · School operations home** — *the Today screen.* Contexts `school_admin` · SC-1 · Composes
MOD-003…MOD-010 · Owns nothing (§20) · *Current:* `admin/dashboard.tsx` + 4 mockup generations
(**C-31**) · **KEEP CONCEPT, canonical purpose redefined**

**School (7)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-011 | Setup & go-live checklist | CAP-001…005 in guided order | WF-002 | `admin/setup.tsx` | **KEEP** |
| UX-012 | School identity | CAP-001 | WF-002 | `admin/branding.tsx` | **SPLIT** — identity here, website presentation to UX-085 (**C-5**) |
| UX-013 | School policy | CAP-002, CAP-003 | — | none | **MISSING** (F-024, C-17) |
| UX-014 | Academic periods | CAP-004 | WF-028 | none | **MISSING** |
| UX-015 | Rollover workspace | CAP-005 | WF-028 | none | **MISSING** (F-032, §17) |
| UX-016 | Classes | CAP-014, CAP-019 | WF-026 | `admin/classes.tsx` | **KEEP** |
| UX-017 | Subjects | CAP-015 | — | within `classes.tsx` | **SPLIT** |

**People (7)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-018 | Children register | CAP-018, CAP-019 | WF-024, WF-025 | `admin/students.tsx` | **KEEP** |
| UX-019 | Child operational record | CAP-021, CAP-018, CAP-019, CAP-020, CAP-059 | WF-024…027 | `admin/student-profile.tsx` | **REPURPOSE** — composes, never owns (§13) |
| UX-020 | Families & guardians | CAP-022 | WF-014 | `admin/families.tsx` | **KEEP** |
| UX-021 | Family record | CAP-022, CAP-023 | WF-014 | within `families.tsx` | **SPLIT** |
| UX-022 | Parent access & linking codes | CAP-024, CAP-025, CAP-029 | WF-015, WF-018, WF-023 | `admin/linking-codes.tsx` | **KEEP + EXTEND** (F-035) |
| UX-023 | Import children & families | CAP-027, CAP-028 | WF-019…022 | `family-enrollment-import.tsx` + `family-enrollment.tsx` | **MERGE** (**C-26** — two pipelines) |
| UX-024 | Import review & exceptions | CAP-027, CAP-028 | WF-021, WF-022 | partial | **PARTIAL** |

**Books (8)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-025 | Catalogue | CAP-006 | — | `admin/books.tsx` | **KEEP** |
| UX-026 | Book record & stock history | CAP-006, CAP-013 | WF-046 | mockup only | **PARTIAL** |
| UX-027 | Bundles | CAP-007 | — | `admin/book-levels.tsx` | **KEEP** |
| UX-028 | Bundle composition | CAP-007 | — | within `book-levels.tsx` | **SPLIT** |
| UX-029 | Class requirement assignment | CAP-008 | WF-030 | within `book-levels.tsx` | **SPLIT** |
| UX-030 | Stock intake & correction | CAP-011, CAP-012 | WF-046 | `admin/books.tsx` + barcode mockups | **MERGE** |
| UX-031 | Physical copies & labels | CAP-010 | — | `admin/book-copies.tsx` | **KEEP** |
| UX-032 | Stock position | CAP-013 | WF-044 | `admin/reports.tsx` (partial) | **SPLIT** |

**Requirements (4)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-033 | Cycle board | CAP-040, CAP-041, CAP-044 | WF-024, WF-031 | none | **MISSING** (F-083) |
| UX-034 | Child requirement & override | CAP-009, CAP-041 | WF-031, WF-032 | `student_book_levels` has no surface | **MISSING** |
| UX-035 | Add a requirement mid-year | CAP-042 | WF-033, WF-070 | none | **MISSING** (**C-37**) |
| UX-036 | Requirement correction | CAP-043 | WF-029 | none | **MISSING** |

**Distribution (8)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-037 | Fulfilment board | CAP-059, CAP-060 | WF-047, WF-048, WF-055 | `admin/allocations.tsx` (partial) | **REPURPOSE** |
| UX-038 | Prepare a child's books | CAP-060, CAP-068 | WF-048, WF-034 | none | **MISSING** |
| UX-039 | Hand books to teacher | CAP-061 | WF-050 | none | **MISSING** — the **C-3** surface (F-054) |
| UX-040 | Reception collection | CAP-064 | WF-049 | `admin/collection-sheet.tsx` | **REPURPOSE** — an admin-office function, `school_admin` [UXQ-3] |
| UX-041 | Administrator hand-over | CAP-063 (AUTH-SCHOOL) | WF-052 | none | **MISSING** — the CD-5 fallback (BR-131) |
| UX-042 | Fulfilment exceptions | CAP-065 | WF-053, WF-054 | none | **MISSING** |
| UX-043 | Replacement review queue | CAP-069 | WF-034, WF-069 | `admin/requests` (fused) | **SPLIT** (**C-51**) |
| UX-044 | Returns & corrections | CAP-071 | WF-056, WF-057 | none | **MISSING** (F-082) |

**Money (10) — present only with AUTH-FINANCE (CD-4)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-045 | Settlement position | CAP-045 | — | `admin/payments.tsx` (partial) | **REPURPOSE** |
| UX-046 | Payment claim review | CAP-045, CAP-049, CAP-050 | WF-035, WF-043, WF-044, WF-045 | `finance.tsx` payment review | **KEEP CONCEPT** |
| UX-047 | Record money received | CAP-047 | WF-036, WF-037 | none | **MISSING** (F-049) |
| UX-048 | Apply payment | CAP-048 | WF-040 | none | **MISSING** (DM-057, OD-1) |
| UX-049 | Instalment plan | CAP-047, CAP-048 | WF-037 | none | **MISSING** (**C-11**) |
| UX-050 | Discount, subsidy, waiver & school funding | CAP-051, CAP-052 | WF-038, WF-039 | none | **MISSING** (**C-11**) |
| UX-051 | Replacement charge decision | CAP-070 | WF-070 | none | **MISSING** — the **C-39** surface |
| UX-052 | Provider records & reconciliation | CAP-055, CAP-056 | WF-042 | `admin/reconciliation.tsx` + `finance.tsx` "Stripe Payment Data" | **MERGE + RENAME** (**C-28**) |
| UX-053 | Refunds & settlement corrections | CAP-053, CAP-054 | WF-056, WF-058 | none | **MISSING** |
| UX-054 | Financial reports | CAP-077 | — | `finance.tsx` reports + `admin/reports.tsx` + 2 mockups | **MERGE** (**C-45**) |

**Insight (2)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-055 | Operational reports | CAP-076 | — | `admin/reports.tsx` | **KEEP CONCEPT** — composes only (I-10) |
| UX-056 | Previous years | CAP-021, CAP-041, CAP-045, CAP-076 (read, period-scoped) | WF-029 | none | **MISSING** (§22, **C-49**) |

**Administration (6)**

| ID | Screen | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|
| UX-057 | Staff directory | CAP-037 | — | `admin/users.tsx` | **KEEP** |
| UX-058 | Invite staff | CAP-030 | WF-006 | `admin/invite-staff-wizard.tsx` | **KEEP** |
| UX-059 | Staff record | CAP-031, CAP-032, CAP-033, CAP-034, CAP-035 | WF-008, WF-009, WF-010 | within `users.tsx` | **SPLIT + REPURPOSE** (§19) |
| UX-060 | Class staffing | CAP-016, CAP-017 | WF-011, WF-012, WF-013 | duplicated in `users.tsx` + `classes.tsx` (F-029) | **MERGE** (**C-14**) |
| UX-061 | Communications hub | CAP-072 | WF-059 | `admin/communications.tsx` | **KEEP** |
| UX-062 | School search | reads only, within SC-1 | — | none | **MISSING** (§26) |

### S-2 · School Operations — finance (1)

**UX-063 · Finance home** — Contexts `finance` (and the finance landing for an administrator who
holds AUTH-FINANCE and chooses it) · SC-1 + CD-4 · *Purpose:* §20's finance question · *Deliberately
absent:* class management · catalogue editing · staffing · imports · CMS · school configuration ·
*Current:* `finance.tsx` dashboard + 2 mockups · **KEEP CONCEPT, purpose redefined**

Finance's other nine screens are UX-045…UX-054 above — **the same screens the administrator with
AUTH-FINANCE uses.** They are not duplicated per context; the context decides the navigation and the
landing, the authority decides the reach.

### S-2 · School Operations — teacher (7)

> **All seven are handheld-first** [LOCKED UXQ-1]. Handheld usability is a **completion criterion**
> for each, not an enhancement; each must still remain usable on larger screens. Breakpoints, tap
> targets and layouts are **Stage 10** (§9.3, §34).

| ID | Screen | Purpose | Capabilities | Workflows | Scope | Current | Class |
|---|---|---|---|---|---|---|---|
| UX-064 | Teacher home | Which class, how much is left | CAP-041, CAP-062 (read) | — | SC-2 ∩ SC-3 | `teacher.tsx` dashboard | **KEEP CONCEPT** |
| UX-065 | Class hand-over list | Who still needs their books | CAP-021, CAP-041 | WF-051 | SC-3 | `teacher.tsx` distribution | **REPURPOSE** |
| UX-066 | Hand-over to a child | Give the books, record it | **CAP-063** | WF-051 | SC-3 + **CD-5** | within `teacher.tsx` | **SPLIT** |
| UX-067 | Books I'm holding | What is in my custody | CAP-062 | WF-050 | SC-2 | none | **MISSING** |
| UX-068 | Report an exception | Absent · short · refused | CAP-065 | WF-053, WF-054 | SC-3 | none | **MISSING** |
| UX-069 | Request a replacement | Damaged or lost, with a reason | CAP-067 | WF-069 | SC-3 | `teacher.tsx` extra requests | **SPLIT** (**C-51**) |
| UX-070 | Teacher ↔ family messages | Message this child's family | CAP-072 | WF-060 | SC-3 | `teacher.tsx` messages | **KEEP** |

Every one of these seven resolves **SC-2 ∩ SC-3**, computed identically. That is the target-experience
half of **C-6**.

### S-3 · Family (10)

> **Naming note** [LOCKED UXQ-2]. The `UX-nnn` names below are **this document's identifiers**, not
> interface labels. In the product the family reads school/book language — *Books for 2026/27 ·
> September books · Additional January book · Books still needed* — and never `Requirement Item`,
> `Basket`, `Cart` or `Order`. The **Stage 6 domain names are unchanged** (§14). Stage 10 fixes the
> exact strings.

| ID | Screen | Purpose | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|---|
| UX-071 | Family home | Per child: what is needed, what is waiting on me | CAP-057 | WF-018 | `parent.tsx` dashboard | **REPURPOSE** — child-first (§10) |
| UX-072 | Child's year — *"Books for 2026/27"* | The whole year, requirement by requirement | CAP-021 (own), CAP-041, CAP-057 | WF-033, WF-071 | `parent.tsx` baskets | **REPURPOSE** (**C-48**) |
| UX-073 | Requirement detail — *"September books"* | What these books are and what they cost | CAP-041, CAP-057 | — | within baskets | **SPLIT** |
| UX-074 | Settle a requirement | Choose an available route | CAP-046, CAP-058 | WF-035…041 | `parent.tsx` payments | **REPURPOSE** (**C-2**, §11) |
| UX-075 | Submit a payment reference | The bank-transfer claim | CAP-046 | WF-035 | `parent.tsx` reference dialog | **KEEP CONCEPT** |
| UX-076 | Payment & funding history | Paid · applied · subsidised · waived · refunded | CAP-057 | WF-038, WF-039, WF-058 | partial | **PARTIAL** |
| UX-077 | Fulfilment route | Collection or classroom, per child | CAP-058, CAP-059 | WF-047, WF-055 | none | **MISSING** (F-053a, **C-36**) |
| UX-078 | Collection & readiness | Is it ready, where, who may collect | CAP-057 | WF-049 | none | **MISSING** |
| UX-079 | Link another child | Redeem a code | CAP-026 | WF-017 | `parent.tsx` link | **KEEP** |
| UX-080 | Messages with the school | One thread per subject | CAP-073 | WF-059, WF-060 | `parent.tsx` messages | **KEEP** |

**Absent from S-3 by design:** another family's anything · any staff operation · any school-wide
figure · any settlement status the family could set (BR-071) · any card checkout that does not exist.

### S-4 · Website Studio (5) — optional, MOD-011

| ID | Screen | Purpose | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|---|
| UX-081 | Studio home | State of the site: drafts, sections, recent publications | CAP-078 | — | `admin/it-dashboard.tsx` + 2 mockups | **KEEP CONCEPT** |
| UX-082 | Page sections editor | Edit content and drafts | CAP-078 | WF-062 | `admin/website.tsx` | **KEEP** |
| UX-083 | Publish review | See what will change, then publish | CAP-079 | WF-062 | within `website.tsx` | **SPLIT** |
| UX-084 | Media library | Upload and manage media | CAP-080 | WF-063 | `admin/media-library.tsx` | **KEEP** |
| UX-085 | Website presentation | Website-specific styling **only** | CAP-078 | — | `admin/branding.tsx` (shared with UX-012) | **SPLIT** (**C-5**) |

**Absent from S-4 entirely:** children · families · guardians · settlement · stock · custody ·
requirements · staff · reports · any school operational data. Not hidden — **not in the surface**.

The studio *displays* the school's identity (name, logo, colours) because a website needs it. It does
not own or edit it — MOD-001 does, at UX-012 (MA-2's reusable principle, applied to presentation).

### S-5 · Public (3)

| ID | Screen | Purpose | Capabilities | Scope | Current | Class |
|---|---|---|---|---|---|---|
| UX-086 | Public school site | Published content for a visitor | CAP-081 | **SC-8** | `school-public.tsx` | **KEEP** |
| UX-087 | Public contact form | Contact the school | — (public write, rate-limited) | SC-8 | within `school-public.tsx` | **KEEP CONCEPT** |
| UX-088 | ScholarShelf information & legal | Privacy · security · contact | — | none | `privacy.tsx`, `security.tsx`, `contact.tsx` | **KEEP** |

**Four rules for S-5:** published material only · **fails safely to empty** — an unpublished or absent
site renders as nothing, never as an error page exposing that the tenant exists · no operational
information of any kind · **no path into any other surface** beyond an ordinary sign-in link.

### S-6 · BytHub Platform (15) — internal, MOD-012

| ID | Screen | Purpose | Capabilities | Workflows | Current | Class |
|---|---|---|---|---|---|---|
| UX-089 | Platform operations home | Which tenants need attention | CAP-085 | — | `admin/owner.tsx` "global dashboard" | **REPURPOSE** — the **C-10** resolution |
| UX-090 | Tenant directory | Every tenant and its state | CAP-082, CAP-085 | WF-001 | `admin/schools` | **KEEP CONCEPT** |
| UX-091 | Tenant record & lifecycle | Suspend · reactivate · archive · request deletion | CAP-084 | WF-003, WF-005 | `admin/school-details` | **KEEP CONCEPT** |
| UX-092 | Onboarding & first-admin invitations | Create a tenant, invite its first administrator | CAP-082, CAP-083 | WF-001, WF-002 | `pending-setups` + `admin-invites` | **MERGE** |
| UX-093 | Delivery & job outcomes | Did the scheduled work and the messages get through | CAP-085 | WF-061 | `email-status` | **KEEP CONCEPT + EXTEND** |
| UX-094 | System health & diagnostics | Is the platform well | CAP-085 | — | `admin/system-health.tsx` | **KEEP** |
| UX-095 | Support engagement launcher | Name one school, state a reason, enter | CAP-086 | WF-004 | within `owner.tsx` | **SPLIT** (§24) |
| UX-096 | Support workspace | Bounded work in one named school | CAP-087 + SC-6 | WF-004 | support mode via `admin.tsx` | **REPURPOSE** (**C-44**) |
| UX-097 | Console — typed operations | Named, bounded operations | CAP-088 | WF-065 | `admin/db-console.tsx` Tier 1 | **KEEP** |
| UX-098 | Console — read-only query | Investigate without changing | CAP-089 | WF-066 | `db-console.tsx` Tier 2 | **KEEP** |
| UX-099 | Platform audit trail | Who did what, across the platform | CAP-085 | — | `admin/activity` | **KEEP** |
| UX-100 | Break-glass elevation | Owner only · reasoned · time-boxed · alerted | **CAP-090** | WF-067 | `db-console.tsx` Tier 3 | **SPLIT** (§25) |
| UX-101 | Break-glass write | The write itself, under elevation | **CAP-091** | WF-067 | Tier 3 | **SPLIT** |
| UX-102 | Tenant purge | Irreversible, after cooldown | **CAP-092** | WF-005 | within owner tools | **SPLIT** |
| UX-103 | Platform authority register | **Read-only.** Who holds platform authority, and what they did | CAP-085 | — | none | **MISSING** — and see §25.3 |

**Absent from S-6 entirely:** cross-tenant child data · cross-tenant payment or revenue analytics ·
MAT / school-group reporting · anything that would make a school's business data a BytHub dashboard.
That is **C-10**, and F-081 is locked OUT OF SCOPE.

---

## 24. Screen → capability traceability

All **95 capabilities** accounted for: **90 with a direct human surface**, **5 explicitly classified**.

| CAP | Screen(s) | Context / authority |
|---|---|---|
| 001 manage_school_identity | UX-012 | AUTH-SCHOOL |
| 002 manage_school_policy | UX-013 | AUTH-SCHOOL, CD-9 |
| 003 view_school_policy | UX-013 (read); inline in UX-045…054 | AUTH-SCHOOL / AUTH-FINANCE |
| 004 manage_academic_periods | UX-014 | AUTH-SCHOOL |
| 005 run_rollover | UX-015 | AUTH-SCHOOL |
| 006 manage_catalogue | UX-025, UX-026 | AUTH-SCHOOL |
| 007 manage_bundles | UX-027, UX-028 | AUTH-SCHOOL |
| 008 assign_bundle_to_class | UX-029 | AUTH-SCHOOL, CD-8 |
| 009 manage_child_requirement_override | UX-034 | AUTH-SCHOOL |
| 010 manage_physical_copies | UX-031 | AUTH-SCHOOL |
| 011 record_stock_intake | UX-030 | AUTH-SCHOOL |
| 012 correct_stock | UX-030 | AUTH-SCHOOL |
| 013 view_stock_position | UX-032; inline in UX-046 | AUTH-SCHOOL / AUTH-FINANCE |
| 014 manage_classes | UX-016 | AUTH-SCHOOL |
| 015 manage_subjects | UX-017 | AUTH-SCHOOL |
| 016 manage_class_staffing | UX-060 | AUTH-SCHOOL |
| 017 revoke_class_staffing | UX-060 | AUTH-SCHOOL |
| 018 manage_children | UX-018, UX-019 | AUTH-SCHOOL |
| 019 manage_class_membership | UX-016, UX-019 | AUTH-SCHOOL, CD-8 |
| 020 archive_child | UX-019 | AUTH-SCHOOL |
| 021 view_child_record | UX-019 (school) · UX-065/066 (**SC-3**) · UX-045/046 (finance bands) · UX-072 (family) | four distinct bands |
| 022 manage_families | UX-020, UX-021 | AUTH-SCHOOL |
| 023 manage_guardians | UX-021 | AUTH-SCHOOL |
| 024 issue_linking_code | UX-022 | AUTH-SCHOOL |
| 025 rotate_linking_code | UX-022 | AUTH-SCHOOL |
| 026 redeem_linking_code | UX-079, UX-005 | no prior authority, SC-5 |
| 027 import_students_only | UX-023, UX-024 | AUTH-SCHOOL |
| 028 import_students_and_families | UX-023, UX-024 | AUTH-SCHOOL |
| 029 send_pending_invitations | UX-022, UX-024 | AUTH-SCHOOL |
| 030 invite_staff | UX-058 | AUTH-SCHOOL |
| 031 grant_role | UX-059 | AUTH-SCHOOL, CD-9 |
| 032 grant_finance_authority | UX-059 — **its own act** | AUTH-SCHOOL, CD-9, CD-10 |
| 033 disable_staff_account | UX-059 | AUTH-SCHOOL, CD-9 |
| 034 reactivate_staff_account | UX-059 | AUTH-SCHOOL |
| 035 offboard_staff_preserving_family | UX-059 | AUTH-SCHOOL |
| 036 erase_account | **NO ORDINARY SCREEN** — controlled privacy process, **Stage 16** | — |
| 037 view_staff_directory | UX-057 | AUTH-SCHOOL |
| 038 manage_own_profile | UX-006 | any context, SC-5 |
| 039 switch_context | UX-008 | any context, SC-5 |
| 040 open_cycle | UX-033; usually system-initiated at UX-019 | AUTH-SCHOOL |
| 041 view_cycle | UX-033, UX-034 · UX-064/065 (fulfilment facts only) · UX-072 | three bands |
| 042 create_requirement_item | UX-035 | AUTH-SCHOOL, CD-8 |
| 043 correct_requirement | UX-036 | AUTH-SCHOOL |
| 044 close_cycle | UX-033 | AUTH-SCHOOL |
| 045 view_financial_position | UX-045, UX-046, UX-063 | AUTH-FINANCE, CD-4 |
| 046 submit_payment_claim | UX-074, UX-075 | AUTH-FAMILY, SC-4 |
| 047 record_money_event | UX-047, UX-049 | AUTH-FINANCE |
| 048 apply_payment | UX-048, UX-049 | AUTH-FINANCE |
| 049 confirm_settlement | UX-046 — **one act, I-2** | AUTH-FINANCE |
| 050 reject_settlement | UX-046 | AUTH-FINANCE |
| 051 authorise_discount_or_subsidy | UX-050 | AUTH-FINANCE |
| 052 authorise_waiver_or_school_funding | UX-050 | AUTH-FINANCE |
| 053 correct_settlement | UX-053 | AUTH-FINANCE |
| 054 issue_refund | UX-053 | AUTH-FINANCE |
| 055 import_provider_records | UX-052 | AUTH-FINANCE |
| 056 match_provider_record | UX-052 | AUTH-FINANCE |
| 057 view_own_settlement_position | UX-071, UX-072, UX-076 | AUTH-FAMILY, SC-4 |
| 058 choose_fulfilment_route | UX-077; offered at UX-074 | AUTH-FAMILY |
| 059 change_fulfilment_route | UX-077 (family) · UX-037, UX-019 (school) | AUTH-FAMILY / AUTH-SCHOOL |
| 060 prepare_fulfilment | UX-038, UX-037 | AUTH-SCHOOL |
| 061 transfer_custody_to_teacher | **UX-039** | AUTH-SCHOOL |
| 062 hold_teacher_custody | **UX-067** | AUTH-TEACH, SC-2 |
| 063 record_hand_over | **UX-066** (teacher, **CD-5**) · **UX-041** (administrator fallback) | AUTH-TEACH / AUTH-SCHOOL |
| 064 record_reception_collection | **UX-040** | AUTH-SCHOOL |
| 065 record_fulfilment_exception | UX-068 (teacher) · UX-042 (school) | AUTH-TEACH / AUTH-SCHOOL |
| 066 dispatch_postal | **FUTURE** — no screen this rebuild; the route list is built to accept it | — |
| 067 request_replacement | UX-069 | AUTH-TEACH, SC-3 |
| 068 provide_pre_handover_replacement | UX-038, UX-043 | AUTH-SCHOOL, CD-11 PRE |
| 069 review_replacement_request | UX-043 | AUTH-SCHOOL |
| 070 decide_replacement_charge | **UX-051** | AUTH-FINANCE, CD-11 POST |
| 071 receive_returned_copy | UX-044 | AUTH-SCHOOL |
| 072 message_family | UX-061 (school) · UX-070 (teacher, **SC-3**) | AUTH-SCHOOL / AUTH-TEACH |
| 073 message_school | UX-080 | AUTH-FAMILY |
| 074 view_notifications | UX-007 | any context |
| 075 manage_notification_preferences | UX-007 | any context |
| 076 view_operational_reports | UX-055, UX-056 | AUTH-SCHOOL |
| 077 view_financial_reports | UX-054 | AUTH-FINANCE |
| 078 manage_site_content | UX-082, UX-081, UX-085 | AUTH-CMS |
| 079 publish_site_content | UX-083 | AUTH-CMS |
| 080 manage_media | UX-084 | AUTH-CMS |
| 081 view_published_site | UX-086 | unauthenticated, SC-8 |
| 082 create_tenant | UX-090, UX-092 | AUTH-PLATFORM |
| 083 invite_first_admin | UX-092 | AUTH-PLATFORM |
| 084 manage_tenant_lifecycle | UX-091 | AUTH-PLATFORM |
| 085 view_platform_state | UX-089, UX-093, UX-094, UX-099, UX-103 | AUTH-PLATFORM |
| 086 enter_support_mode | UX-095 | AUTH-PLATFORM |
| 087 exit_support_mode | UX-096 | AUTH-PLATFORM |
| 088 run_typed_support_operation | UX-097 | AUTH-PLATFORM, SC-6 |
| 089 run_readonly_query | UX-098 | AUTH-PLATFORM, SC-6 |
| 090 elevate_break_glass | **UX-100** | **AUTH-BREAKGLASS** |
| 091 perform_break_glass_write | **UX-101** | **AUTH-BREAKGLASS** |
| 092 purge_tenant | **UX-102** | **AUTH-BREAKGLASS**, CD-12 |
| 093 run_scheduled_job | **BACKGROUND** — no human trigger; outcomes at UX-093 | Scheduler, SC-10 |
| 094 submit_settlement_signal | **INTEGRATION** — no human screen; outcomes at UX-052 | Integration, SC-11 |
| 095 deliver_notification | **BACKGROUND** — outcomes at UX-093 | Email provider, SC-12 |

**The five without a direct action surface, and why:** CAP-036 (a controlled privacy process, not a
dashboard button — **C-12**, Stage 16) · CAP-066 (FUTURE) · CAP-093, CAP-094, CAP-095 (background and
integration actors — they have *observable outcomes*, not screens).

---

## 25. Workflow → screen traceability

All **71 workflows** have a named human entry point, or are explicitly classified.

| WF | Entry point | WF | Entry point |
|---|---|---|---|
| 001 Onboard a school | UX-092 | 037 Instalments | UX-049 |
| 002 First-admin to go-live | UX-004 → UX-011 | 038 Subsidy or discount | UX-050 |
| 003 Suspend / reactivate school | UX-091 | 039 School-funded or waived | UX-050 |
| 004 Enter / leave support | UX-095, UX-096 | 040 Mixed settlement | UX-048 |
| 005 Archive · delete · purge | UX-091 → UX-102 | 041 Online payment | **FUTURE** slot in UX-074 |
| 006 Invite staff | UX-058 | 042 Provider reconciliation | UX-052 |
| 007 Accept staff invitation | UX-004 | 043 Confirm → allocate → deduct | **UX-046 (one act)** |
| 008 Grant / remove secondary role | UX-059 | 044 Insufficient stock | UX-046 state + UX-032 |
| 009 Suspend a staff member | UX-059 | 045 Concurrent confirmation | UX-046 state |
| 010 Offboard preserving parent | UX-059 | 046 Stock correction | UX-030 |
| 011 Assign teacher to class | UX-060 | 047 Resolve fulfilment route | UX-077 · UX-037 |
| 012 Temporary assignment | UX-060 | 048 Prepare a child's books | UX-038 |
| 013 Assignment expiry | UX-060 · UX-064 | 049 Reception collection | UX-040 |
| 014 Guardian with no account | UX-021 | 050 Transfer to teacher custody | **UX-039** |
| 015 Invite a guardian | UX-022 | 051 Hand to the student | **UX-066** |
| 016 Parent self-registration | UX-005 | 052 Guardian conflict — admin | **UX-041** |
| 017 Redeem a linking code | UX-079 | 053 Student absent | UX-068 |
| 018 Parent access inactive | UX-071 · UX-022 | 054 Partial / out of stock | UX-068 |
| 019 Student-only import | UX-023 | 055 Change the route | UX-077 · UX-037 |
| 020 Student + family import | UX-023 | 056 Wrong · duplicate · cancelled | UX-044 · UX-053 |
| 021 Invalid or partial rows | UX-024 | 057 Return, inspection, outcome | UX-044 |
| 022 Re-run an import | UX-023 · UX-024 | 058 Refund | UX-053 |
| 023 Send pending invitations | UX-022 | 059 Admin ↔ family thread | UX-061 · UX-080 |
| 024 Enrol child, open cycle | UX-019 | 060 Teacher ↔ family thread | UX-070 · UX-080 |
| 025 Mid-year joiner | UX-018 · UX-019 | 061 Daily digest | UX-007 · UX-093 |
| 026 Class move within a year | UX-019 | 062 Edit and publish a section | UX-082 → UX-083 |
| 027 Leaver | UX-019 | 063 Manage media | UX-084 |
| 028 Annual rollover | **UX-015** | 064 Visitor views a school site | UX-086 |
| 029 Correct a historical record | UX-036 · UX-056 | 065 Typed console operation | UX-097 |
| 030 Assign a bundle to a class | UX-029 | 066 Read-only query | UX-098 |
| 031 Initial requirement item | UX-033 · UX-034 | 067 Break-glass write | UX-100 → UX-101 |
| 032 Child-specific override | UX-034 | 068 Postal delivery | **FUTURE** — no screen |
| 033 Add requirement after settlement | **UX-035** → UX-072 | 069 Replacement post-hand-over | UX-069 → UX-043 → UX-051 |
| 034 Replacement pre-hand-over | UX-038 · UX-043 | 070 Finance charge decision | **UX-051** |
| 035 Bank transfer + reference | UX-074/075 → UX-046 | 071 Notify of a new payable | UX-007 → UX-072 |
| 036 Cash recorded by finance | UX-047 | | |

**Nothing is left "to be implemented later because nobody decided where a human starts it."** The two
FUTURE workflows (WF-041, WF-068) are marked as future by the locked stages, not deferred by Stage 9.

---

## 26. Module → surface traceability

| Module | Classification | Where |
|---|---|---|
| **MOD-001** Tenancy & School Configuration | **DIRECT** + composed | UX-011…UX-014; entitlement (MA-2) composed into navigation and into S-4's presence |
| **MOD-002** Identity & Access | **DIRECT** | S-1 entirely; UX-057…UX-059 |
| **MOD-003** Academic Structure | **DIRECT** | UX-016, UX-017, UX-060; scope basis for every teacher screen |
| **MOD-004** Children & Families | **DIRECT** | UX-018…UX-024; composed into UX-019, UX-071 |
| **MOD-005** Catalogue & Inventory | **DIRECT** | UX-025…UX-032; composed into UX-046 (stock at confirmation) |
| **MOD-006** Book-Supply Cycle & Requirements | **DIRECT** | UX-033…UX-036; composed into UX-019, UX-072, UX-073 |
| **MOD-007** Settlement & Funding | **DIRECT** | UX-045…UX-054; family half at UX-074…UX-076 |
| **MOD-008** Fulfilment & Custody | **DIRECT** | UX-037…UX-044, UX-064…UX-069, UX-077, UX-078 |
| **MOD-009** Communication | **DIRECT** | UX-007, UX-061, UX-070, UX-080 |
| **MOD-010** Reporting & Projections | **COMPOSED ONLY** | UX-010, UX-054, UX-055, UX-063, UX-064, UX-071, UX-089. **Owns no concept and publishes no status** (I-10) |
| **MOD-011** School Website | **OPTIONAL** | S-4 and S-5. Absent entirely when not entitled |
| **MOD-012** Platform Operations | **INTERNAL ONLY** | S-6. Never in a school's surface |
| **MOD-013** Audit & Attribution | **COMPOSED + INTERNAL** | Attribution rendered inline on records (UX-019, UX-046, UX-056, UX-059); UX-099 platform-wide. **No "audit settings" screen** |
| **MOD-014** Scheduled Work | **BACKGROUND** | Outcomes at UX-093. **No school-facing job configuration screen** |
| **MOD-015** Delivery & Integration Gateways | **BACKGROUND + INTERNAL** | Outcomes at UX-093 and UX-052. **Explicitly not an "Email Provider Settings" screen** |

**No configuration screen was invented merely because a module exists.** Three of the fifteen modules
have no direct human surface at all, and that is correct.

---

## 27. Current screen comparison

### 27.1 The 42 shipped page files

| Current page | Target | Classification | Reason |
|---|---|---|---|
| `login.tsx` | UX-001, UX-002 | **KEEP CONCEPT** | Correct job |
| `register.tsx` | UX-005 | **KEEP CONCEPT** | Correct job |
| `accept-invite.tsx` | UX-004 | **KEEP CONCEPT** | Serves staff and guardian invitations |
| `forgot-password.tsx` · `reset-password.tsx` | UX-003 | **MERGE** | One flow, four steps |
| `not-found.tsx` | UX-009 | **REPURPOSE** | Must distinguish four different reasons |
| `privacy.tsx` · `security.tsx` · `contact.tsx` | UX-088 | **KEEP** | Product-level, not tenant-level |
| `school-public.tsx` | UX-086, UX-087 | **KEEP** | Correct job |
| `admin.tsx` | — | **LEGACY MECHANISM** | The section registry + three allowlists is how internal, IT and school surfaces are currently kept apart. **C-44**; Stage 13 |
| `admin/dashboard.tsx` | UX-010 | **KEEP CONCEPT** | Purpose redefined (§20, **C-31**) |
| `admin/setup.tsx` | UX-011 | **KEEP** | |
| `admin/branding.tsx` | UX-012 **+** UX-085 | **SPLIT** | Identity is MOD-001; website presentation is MOD-011 (**C-5**) |
| `admin/classes.tsx` | UX-016 **+** UX-017 | **SPLIT** | Subjects are their own concept (DM-018) |
| `admin/students.tsx` | UX-018 | **KEEP** | |
| `admin/student-profile.tsx` | UX-019 | **REPURPOSE** | Must compose seven modules without owning any (§13) |
| `admin/families.tsx` | UX-020 **+** UX-021 | **SPLIT** | |
| `admin/family-enrollment.tsx` · `family-enrollment-import.tsx` | UX-023, UX-024 | **MERGE** | Two import pipelines (**C-26**) |
| `admin/linking-codes.tsx` | UX-022 | **KEEP + EXTEND** | Must carry the access lifecycle (F-035) |
| `admin/books.tsx` | UX-025, UX-030 | **SPLIT** | Catalogue and stock intake are different jobs |
| `admin/book-levels.tsx` | UX-027, UX-028, UX-029 | **SPLIT** | Bundle, composition and class assignment are three jobs |
| `admin/book-copies.tsx` | UX-031 | **KEEP** | |
| `admin/allocations.tsx` | UX-037 | **REPURPOSE** | Becomes the fulfilment board, route-aware |
| `admin/collection-sheet.tsx` | UX-040 | **REPURPOSE** | Becomes an admin-office screen that records a collection, not a sheet that lists one |
| `admin/payments.tsx` | UX-045, UX-046 | **REPURPOSE** | Position and claim queue are different screens |
| `admin/reconciliation.tsx` | UX-052 | **MERGE** | With `finance.tsx` "Stripe Payment Data" |
| `admin/reports.tsx` | UX-055, UX-032 | **SPLIT** | Stock position is not a report |
| `admin/communications.tsx` | UX-061 | **KEEP** | |
| `admin/users.tsx` | UX-057, UX-059, UX-060 | **SPLIT** | Account, roles, finance authority and staffing are four decisions |
| `admin/invite-staff-wizard.tsx` | UX-058 | **KEEP** | |
| `admin/shared.tsx` | — | **INTERNAL** | Shared section plumbing; Stage 13 |
| `admin/website.tsx` | UX-082, UX-083 | **SPLIT** | **CMS-ONLY** |
| `admin/media-library.tsx` | UX-084 | **KEEP** | **CMS-ONLY** |
| `admin/it-dashboard.tsx` | UX-081 | **KEEP CONCEPT** | **CMS-ONLY** |
| `admin/owner.tsx` | UX-089, UX-090, UX-091, UX-095 | **SPLIT + REPURPOSE** | **INTERNAL-ONLY**; the **C-10** resolution |
| `admin/db-console.tsx` | UX-097, UX-098, UX-100, UX-101 | **SPLIT** | **INTERNAL-ONLY**; tiers become distinct surfaces (§25) |
| `admin/system-health.tsx` | UX-094 | **KEEP** | **INTERNAL-ONLY** |
| `finance.tsx` | UX-063, UX-046, UX-052, UX-054 | **SPLIT** | Four jobs in one file |
| `teacher.tsx` | UX-064, UX-065, UX-066, UX-069, UX-070 | **SPLIT** | Five jobs in one file; UX-067 and UX-068 are missing entirely |
| `parent.tsx` | UX-071…UX-076, UX-079, UX-080 | **SPLIT + REPURPOSE** | Basket-shaped; must become cycle-shaped (**C-48**) |

### 27.2 The Stitch mockup generations — C-31 evidence

**~40 standalone `*_code.html` screens exist in two to three generations**, plus PNGs, plus three
generations of `scholarshelf_DESIGN.md` and a designer handoff PDF.

**Stage 9 does not choose between them.** It classifies them by *business purpose*:

| Mockup family | Purpose it serves | Target | Classification |
|---|---|---|---|
| `admin_dashboard_scholarshelf` · `admin_dashboard_grouped_navigation` · `admin_dashboard_command_center` · `admin_dashboard_master_command_center` (+ `(2)` variants) | Four attempts at the administrator's home | UX-010 | **CONCEPTUALLY USEFUL** — `grouped_navigation` is the only one that engages §4's work-area question; the "command center" family is a totals wall (**MISLEADING** against §20) |
| `platform_owner_global_dashboard` | A customer-shaped global dashboard | UX-089 | **MISLEADING** — the visual form of **C-10** |
| `platform_owner_school_tenant_management` · `_system_health_infrastructure` · `_db_console` · `_db_console_query_runner` · `_support_mode_saint_jude_academy` | Internal platform operations | UX-090, UX-094, UX-097, UX-098, UX-096 | **CONCEPTUALLY USEFUL** — closest to the target internal band |
| `teacher_distribution_year_3_blue` (+`(2)`) | The teacher's distribution moment | UX-065, UX-066 | **PARTIAL** — has the class list, has no custody, no exceptions, no CD-5 case |
| `parent_portal_my_children_s_books` (+`(2)`) | The family view | UX-071, UX-072 | **PARTIAL** — child-first shape is right; basket framing is wrong (**C-48**) |
| `finance_payment_review` (+`(2)`) | Claim review | UX-046 | **CONCEPTUALLY USEFUL** |
| `admin_payments_financial_hub` · `admin_financial_revenue_reports` (+`(2)`) | Money overview | UX-045, UX-054 | **PARTIAL** — no cash, instalments, subsidy or waiver (**C-11**) |
| `admin_class_allocations_distribution_hub` (+`(2)`) | Distribution overview | UX-037 | **PARTIAL** — no route, no preparation, no transfer to teacher |
| `admin_student_management_comprehensive` (×3) · `_csv_import` (+`(2)`) | Children and import | UX-018, UX-023, UX-024 | **DUPLICATE** — three generations of one screen |
| `admin_book_levels_inventory` · `admin_bundle_*` · `admin_book_inventory_*` · `admin_book_details_stock_history` | Catalogue, bundles, stock | UX-025…UX-032 | **CONCEPTUALLY USEFUL** |
| `admin_staff_user_management` (+`(2)`) · `admin_staff_family_management` (+`(2)`) | Staff and families | UX-057…UX-060, UX-020 | **PARTIAL** — no finance-authority grant, no time-bounded staffing |
| `admin_parent_onboarding_invite_hub` (×3) · `admin_families_parent_onboarding` (+`(2)`) · `admin_invite_parent_flow` | Parent onboarding | UX-022 | **DUPLICATE** |
| `it_personnel_*` (cms editor · pages sections · media · branding portal) (+`(2)`) · `it_dashboard_website_branding_management` (+`(2)`) | CMS | UX-081…UX-085 | **CMS-ONLY**; the branding portals are **MISLEADING** against **C-5** |
| `admin_school_branding_identity` (+`(2)`) | School identity | UX-012 | **CONCEPTUALLY USEFUL** |
| `admin_reports_analytics_dashboard` (+`(2)`) | Reports | UX-055 | **PARTIAL** — must compose, never compute (**C-45**) |
| `admin_communications_messaging_hub` (+`(2)`) · `_parent_chat_thread` | Messaging | UX-061 | **CONCEPTUALLY USEFUL** |
| `admin_setup_wizard_step_6` (+`(2)`) · `admin_setup_progress_go_live_checklist` | Setup | UX-011 | **CONCEPTUALLY USEFUL** |
| `login_mfa_challenge` · `mfa_setup_*` · `forgot_password_*` (4) | Entry | UX-001…UX-003, UX-006 | **CONCEPTUALLY USEFUL** |
| `public_website_saint_jude_academy` | Public site | UX-086 | **CMS-ONLY** |
| `admin_student_profile_distribution_history` | Child record | UX-019 | **PARTIAL** — history without a period boundary (**C-49**) |

**Nothing is deleted, moved or chosen here.** Every one of these files remains where it is. Which
concrete implementation wins is **Stage 22**, and it will decide with this classification as evidence
— not on the basis that a file has a `(2)` or a `(3)` in its name.

---

## 28. Missing screens

Screens the locked workflows require that **do not exist in any form today**. All are `MISSING` in
§23; this is the consolidated list.

| # | Screen | Required by | Consequence of its absence today |
|---|---|---|---|
| 1 | **UX-015 Rollover workspace** | D-07, CAP-005, WF-028, F-032 | Promotion overwrites the class pointer. **A school's second year is worse than its first.** |
| 2 | **UX-013 School policy** | US-02, US-05, US-07, F-024, C-17 | Four locked decisions assume a surface that does not exist |
| 3 | **UX-014 Academic periods** | DM-016, WF-028 | The period has no manageable existence |
| 4 | **UX-033 Cycle board** · **UX-034 requirement & override** | DM-023, F-083 | The product's central object has no surface |
| 5 | **UX-035 Add a requirement mid-year** | WF-033, C-37 | A January requirement cannot be added without confusing September |
| 6 | **UX-036 Requirement correction** | WF-029 | Corrections become edits |
| 7 | **UX-047 Record money received** · **UX-049 Instalments** · **UX-050 Discount, subsidy, waiver, school funding** | D-10, US-06, F-049, C-11 | **The system's implicit answer to hardship is "no books".** |
| 8 | **UX-048 Apply payment** | DM-057, OD-1, WF-040 | Receiving money and placing it are conflated |
| 9 | **UX-051 Replacement charge decision** | C-39, WF-070, CAP-070 | Finance has no say in a charge only finance may decide |
| 10 | **UX-053 Refunds & settlement corrections** | WF-056, WF-058 | Money cannot be given back or corrected |
| 11 | **UX-077 Fulfilment route** | F-053a, C-36, FQ-03 | Both routes ship, both are forced on every school |
| 12 | **UX-078 Collection & readiness** | WF-049 | The family cannot learn their books are ready |
| 13 | **UX-037/038 Fulfilment board & preparation** | WF-047, WF-048 | Nobody can see what must be prepared |
| 14 | **UX-039 Hand books to teacher** | D-03, F-054, **C-3** | A declared custody state nothing drives |
| 15 | **UX-041 Administrator hand-over** | BR-056, BR-131, WF-052 | The CD-5 block would leave a child without books |
| 16 | **UX-042 Fulfilment exceptions** | WF-053, WF-054 | Absence and shortfall have nowhere to go |
| 17 | **UX-044 Returns & corrections** | F-082, WF-057, FQ-02 | Three unrelated return mechanisms, joined to nothing |
| 18 | **UX-060 time-bounded staffing** *(within an existing screen)* | US-10, F-023, C-14 | Cover and TA access with no way to expire it |
| 19 | **UX-022 parent access lifecycle** *(extension)* | US-03, F-035, C-15 | No concept of "no active children" |
| 20 | **UX-067 Books I'm holding** · **UX-068 Report an exception** | CAP-062, CAP-065 | Custody has no visible holder |
| 21 | **UX-056 Previous years** | PP-006, §22, **C-49** | History cannot be looked at |
| 22 | **UX-062 School search** | §32 of the brief | Finding a child means knowing which list they are in |
| 23 | **UX-006 My account & security** | CAP-038 | Scattered across flows |
| 24 | **UX-007 Notifications (durable)** | DM-051, **C-46** | A delivery failure destroys the fact a person was owed a message |
| 25 | **UX-095/096 Support engagement & workspace** | WF-004, PA-2 | Support mode is a flag on the school admin surface |
| 26 | **UX-100/101/102 Break-glass & purge as distinct surfaces** | §25, CAP-090…092 | Exceptional acts sit inside a console tier |
| 27 | **UX-103 Platform authority register** | §19 of PERMISSIONS | Nobody can see who holds platform authority |

**None of these are implemented here.** They are named, scoped and traced so no locked workflow is
left without a place for a human to start it.

---

## 29. Query states — the C-32 carry into Stage 10

### 29.1 The four states, kept distinct

```
LOADING      we do not know yet
ERROR        we asked and could not find out
EMPTY        we asked, and there is genuinely nothing
REAL ZERO    we asked, and the answer is zero — which is itself information
```

`EMPTY` and `REAL ZERO` differ: *"no children have been added yet"* is a setup state; *"£0.00
outstanding"* is a settled financial fact. Both are different from *"we could not reach the data"*.

### 29.2 Screens where the distinction is dangerous, and therefore mandatory

| Screen | The dangerous confusion |
|---|---|
| UX-045, UX-046, UX-063, UX-054, UX-076 | A failure rendering as **£0 outstanding** or **nothing to review** |
| UX-032 | A failure rendering as **stock available**, letting a confirmation proceed |
| UX-018, UX-065 | A failure rendering as **No students** or an empty class |
| UX-037, UX-038, UX-040, UX-067 | A failure rendering as **nothing to prepare / nothing to hand over / you hold nothing** |
| UX-072, UX-071 | A failure rendering as **your child needs nothing** |
| UX-089, UX-090 | A failure rendering as **all tenants healthy** |

**On these screens a failure must never render a number, a currency value, or a reassuring absence.**

### 29.3 The handover to Stage 10

Today `query-state.tsx` exists and is adopted by **2 of 42** page files, and `describeApiError` by 6
(**C-32**, F-075). Stage 9's contribution is the list above — *where* the distinction is required and
*why*. **Stage 10 owns the presentation contract** (what each state looks like and says). **Stage 13
owns physical adoption** across every screen. Stage 9 defines no shared component.

The same applies to the UK formatting layer (**C-33**, F-076): adopted by 14 files, with 20 raw date
renders and 20 raw money renders outside it. Money and dates are read by parents and finance officers;
Stage 10 owns the contract, Stage 13 owns adoption.

---

## 30. Multi-context users

### 30.1 One human, several contexts

```
Mrs Adeyemi
  school_admin   at Saint Jude Academy        AUTH-SCHOOL (+ AUTH-FINANCE by policy)
  teacher        Year 3 Blue                  AUTH-TEACH, per active staffing
  parent         Sara (Year 3 Blue, this school) and Yusuf (another school)
```

All three are real, simultaneous, and derived from different things: an explicit role grant, real
class staffing, and real guardian relationships.

### 30.2 The rules

| Question | Answer |
|---|---|
| How do they know which context is active? | It is stated persistently on every authenticated screen (§3.3), together with the school it is pinned to |
| Where does switching live? | UX-008, reachable from every surface — never buried in a settings page |
| What happens after switching? | They land on **that context's landing** (§3.4). Never on a generic home, never on the previous screen re-scoped |
| What if a context lapses mid-session? | The context disappears from the switcher; attempting it lands on **UX-009**, which says *why* — staffing ended, relationship ended, role removed, school suspended — and offers the contexts that remain |
| Does parent scope follow the school? | **No.** It is relationship-derived (SC-4) and crosses schools. Their school_admin context at Saint Jude gives them nothing about Yusuf at another school |
| Does teacher scope follow the role? | **No.** It is staffing-derived (SC-2 ∩ SC-3). Losing the staffing loses the reach the same day |
| Is `school_admin` + AUTH-FINANCE a switch? | **No.** PA-1. It is one context with two authorities (§6) |

### 30.3 The one that matters most

Mrs Adeyemi is a `school_admin`, a `teacher` of Year 3 Blue, **and** Sara's guardian. Three separate
locked rules apply at once, and the experience must hold all three without contradiction:

- As **teacher**, she cannot hand over to Sara — CD-5, hard (§8.4). Sara appears in her list marked as
  the school office's job.
- As **school_admin**, CAP-063 via AUTH-SCHOOL exists so a child is never stranded (BR-131) — **but
  that fallback is exercised by an administrator, and she is the guardian.** The honest reading is
  that another administrator performs it; where a school has only one, this is a real operational
  constraint the school must staff around, not a rule the software should soften.
- As **parent**, she sees Sara's year in S-3 exactly as any other family would — and nothing about her
  staff contexts changes what she sees there.

This is an **operational** constraint, not a software gap. CD-5 is deliberately hard and
unconditional (BR-056), and BR-131's fallback deliberately requires a *different* administrator. A
school where the only administrator is also the child's guardian must staff around it — the correct
answer is another authorised administrator, not a softer rule and not a new authority.

**No new authority is introduced to solve this** [LOCKED UXQ-3]. The earlier draft proposed a
front-office authority partly on this basis; the owner's clarification removed the premise, and the
proposal is withdrawn (§31, C-47).

**Session storage, tokens and mechanism are not designed here** — Stage 13 and Stage 16.

---

## 31. New conflicts

Verified: the highest conflict number in the repository and document set is **C-46**. New conflicts
begin at **C-47**. Identifiers are **stable** — C-47's withdrawal does not renumber C-48…C-51.

**Register status at lock:** C-47 **WITHDRAWN / NOT APPLICABLE** · C-48, C-49, C-50, C-51 **OPEN**.

---

### C-47 — **WITHDRAWN / NOT APPLICABLE** *(closed: invalid assumption)*

**What Stage 9 originally proposed.** *"There is no front-office authority, so the collection desk
hands its operator the whole school."* The draft inferred that a **separate receptionist / front-office
employee** operates the reception collection screen, and that giving that person AUTH-SCHOOL — children,
families, catalogue, staffing, configuration, and finance where policy grants it — was a
least-privilege violation (PP-005). It recommended a narrow front-office authority as a traceable
Stage 7 amendment, raised as UXQ-3.

**Owner clarification.**

```
RECEPTION COLLECTION
=
ADMIN OFFICE FUNCTION
```

Reception collection is performed from the **school administration office**. There is no separate
receptionist role, front-office role, reception authority or front-desk authority in ScholarShelf, and
none is required. Finance may be co-located in the same office; **physical co-location does not merge
authorities.**

**Why the conflict does not survive.** The premise — a distinct front-office operator — was
Stage 9's inference, not the target operating model. With the correct model, the person performing
reception collection **is** a school administrator, and AUTH-SCHOOL is therefore the **correct**
authority for CAP-064, not an over-grant. There is no least-privilege violation to fix.

**Consequences:**

| | |
|---|---|
| New authority | **None.** `AUTH-FRONT-OFFICE` does not exist and is not required |
| New role | **None** |
| Stage 7 amendment | **None required.** `PERMISSIONS.md` is untouched and remains LOCKED as written |
| New product surface | **None.** No reception surface, no receptionist navigation, no front-office context |
| Implementation work | **None** arising from this conflict |
| UX-040 | Unchanged in existence and purpose; now correctly described as a `school_admin` admin-office function (§12.2) |
| UX-041 | Unchanged. The CD-5 fallback remains an administrator act (BR-131) |
| Identifier | **C-47 is retained, not deleted.** It is closed, and the reason it was raised is preserved above |

**Not to be carried forward as work.** No later stage should build a front-office authority on the
strength of C-47. It is recorded so that the reasoning — and its correction — remain traceable.

---

### C-48 — **OPEN** · The family experience is order-shaped, where the product is cycle-shaped

*Conflict:* `parent.tsx` is organised as *Baskets* and *Payments* — separate orders, each with its own
status. The locked model is one **book-supply cycle per child per period** containing several
**requirement items** that settle independently.
*Why it matters:* under the current shape a January requirement is a new unrelated order. The family
cannot see one child's year, and the September/January distinction has nowhere to live. This is the
**experience** half of **C-37** (which is the data half) and it is not covered by it.
*Affected:* UX-071, UX-072, UX-073, UX-074, UX-076.

*Target experience* — §13.4, now reinforced by **UXQ-2**:

```
TARGET                                  NOT
CHILD                                   SHOP
 → BOOKS FOR THIS YEAR                   → CART
   → required / additional books         → ORDER
     → individual settlement state
     → fulfilment state
```

UXQ-2 removes the vocabulary that keeps the order shape alive, and makes the cycle-shaped target
explicit in the product's own language.

*Status:* **OPEN — not implementation-resolved.** The shipped family experience is still order-shaped.
UXQ-2 strengthened the target; it did not change the current UI.
*Later owning stage:* **10** (language and presentation), **15** (representation), **22** (migration).

### C-49 — **OPEN** · History has no surface

*Conflict:* every screen in the product is "as at now". PP-006 and BR-114 stop the past being
rewritten; nothing lets a human look at it. There is no period selector, no closed-period view, and
no way to read last year's classes, requirements, settlements, allocations or hand-overs as they were.
*Why it matters:* schools are audited and asked about previous years. "The record still exists in the
database" is not the same as a person being able to see it, and D-07's promise is only half kept while
the other half is unreachable.
*Affected:* UX-056 (new) · UX-019 · UX-072 · UX-055 · every period-scoped record.
*Target experience:* §22.
*Later owning stage:* **10** (presentation of a closed period), **15** (period-scoped reads), **22**.

### C-50 — **OPEN** · Finance work is reachable only by being the `finance` role

> **Not to be confused with UXQ-3.** UXQ-3 was about *reception collection* and whether a front-office
> authority should exist; it did not. C-50 is about *finance work inside the administrator context*.
> They are separate issues, and the withdrawal of C-47 has no bearing on C-50.

*Conflict:* the current navigation gives finance items to the `finance` role alone. An administrator
who also holds finance authority has no route to any finance work in the administrator surface — the
implementation offers a different role's navigation, not a different authority's actions.
*Why it matters:* this is the presentational half of **C-13**. US-05 and CAP-032 exist precisely so a
school can grant an administrator finance authority; today that grant would have no visible effect,
and the only workarounds — a second account, or a role switch — are the two things PA-1 forbids.
*Affected:* UX-045…UX-054 · the school_admin navigation · UX-059's finance-authority grant.
*Target experience:* §6 — the Money area appears in the administrator's own navigation, and finance
acts announce themselves. **PA-1 requires this**: `school_admin` + AUTH-FINANCE must reach finance
functionality *inside* the `school_admin` context, with no switch. Stage 9 resolves that conceptually;
the implementation does not.
*Status:* **OPEN — current-experience and implementation conflict.**
*Later owning stage:* **13** (authority-keyed rather than role-keyed navigation and authorisation —
this is the same root as **C-40**), **10** (how a finance act is marked).

### C-51 — **OPEN** · One screen fuses the teacher's request with the administrator's resolution

*Conflict:* `teacher.tsx` "Extra Copy Requests" presents *Pending Review* and *Resolved* to the
teacher, and the same request is resolved by an administrator in `admin/requests` — with no finance
step at all.
*Why it matters:* **C-39** records that the finance charge decision is missing. It does not record
that the two decisions which *do* exist are presented as one flow, which is what makes it natural to
add "Approve" as a single button and lose the three-party split (§16) permanently.
*Affected:* UX-069 (teacher) · UX-043 (administrator) · UX-051 (finance).
*Target experience:* §16 — four surfaces, three parties, two branches.
*Later owning stage:* **13**, **15**, **22**. Conceptually resolved here; **not** resolved in
implementation.

---

## 32. Owner decisions — all **DECIDED**

```
UXQ-1 — DECIDED A
Teacher experience is handheld-first.

UXQ-2 — DECIDED A
Use normal school/book language in product surfaces rather than exposing
requirement-item terminology or forcing basket/order language.

UXQ-3 — DECIDED BY OWNER CLARIFICATION
Reception collection is an administration-office function.
No separate receptionist/front-office authority or role exists.
Finance may be co-located but AUTH-FINANCE alone does not confer reception
hand-over authority.
C-47 is therefore withdrawn / not applicable.
```

**Zero Stage 9 owner questions remain open.**

---

### UXQ-1 — DECIDED A · Teacher experience is handheld-first

**The decision.** The teacher experience is officially designed handheld-first. This is a
product-experience decision, not an implication.

**The owner's reasoning — the real working environment:**

```
TEACHER
→ physically in classroom
→ handling books
→ working through children
→ recording hand-over / exceptions
→ likely using phone or tablet
```

**What it prioritises:** handheld use · quick interaction · low interaction overhead · clear task
progression · minimal unnecessary information · distribution while physically moving and handling
books. **It must still remain usable on larger screens.**

**Applies to:** Today · Hand over · Holding · Exceptions · Replacements · Messages — that is
UX-064…UX-070, and the six teacher navigation areas.

*Applied in* §1 (**UX-P10**, new principle) · §4.2 (teacher navigation) · §8.2 (rewritten as
handheld-first) · §9 (rewritten from "mobile priority — undecided" to "handheld-first — DECIDED") ·
§20 (teacher dashboard) · §23 (teacher screen block) · §34 (Stage 10 hand-off).

*Not decided:* breakpoints · pixel sizes · component layouts · button sizes · CSS · responsive
implementation. **Stage 10 owns the presentation and responsive contract, and now receives a locked
handheld-first teacher experience to implement.**

*Traceability:* `PRODUCT.md` remains LOCKED and unedited. Its `[IMPLIED]` list is not backdated; the
decision is recorded here, at the stage that owns experience architecture. See §9.1.

---

### UXQ-2 — DECIDED A · Normal school/book language

**The decision.** Use school and book language appropriate to each surface. Do **not** expose the
internal architectural term `Requirement Item` as ordinary family or school UI terminology, and do
**not** force generic e-commerce terminology — *basket · cart · order* — onto the book-supply
lifecycle where it misleads.

**Conceptual examples:** *Books for this year · Required books · Book requirements · Additional books ·
Books still needed · Books already provided.* Exact wording may vary by context.

**The underlying model is unchanged:**

```
Book-Supply Cycle
  → Requirement Item
    → Requirement Lines
```

Those are architectural / domain concepts. **The UI does not need to expose those internal names.**

A parent conceptually sees:

```
Books for 2026/27

September books
Paid / settled

Additional January book
Payment needed
```

rather than `Requirement Item #1 / #2` or `Order #1 / #2`.

*Applied in* §1 (**UX-P11**, new principle) · §13.4 (the child's year, rewritten) · §14 (rewritten as
DECIDED) · §11.1 (settlement wording) · §23 (family screen block) · §31 (**C-48** target).

*Explicitly not done:* **Stage 6 domain concepts are not renamed, and `DATA_MODEL.md` is not
rewritten.** This is a user-facing terminology decision only. **Stage 10 may later standardise exact
labels and language consistently.**

*Supports* **C-48**: the family experience must become cycle-shaped, not e-commerce/order-shaped.

---

### UXQ-3 — DECIDED BY OWNER CLARIFICATION · Reception collection is an admin-office function

**The Stage 9 draft's assumption was incorrect.** It assumed a distinct receptionist / front-office
employee might operate the reception collection screen. That is not the target ScholarShelf operating
model.

**The decision.** Reception collection occurs at the school's **administration office**. There is no
separate ScholarShelf receptionist role, front-office role, reception authority or front-desk
authority. Finance may operate alongside or within the same office; **physical co-location does not
merge authorities.**

```
school_admin
→ school administration authority
→ may perform reception collection

school_admin + AUTH-FINANCE
→ school administration functions
→ reception collection
→ finance functions
→ no context switch

standalone finance
→ AUTH-FINANCE
→ finance work
→ does NOT automatically receive reception hand-over authority
```

**No Stage 7 amendment.** The draft's recommendation to introduce a narrow front-office authority is
**withdrawn**. The owner's clarification removes its premise. No new authority is required, no new
role is required, and `PERMISSIONS.md` is untouched. **`AUTH-FRONT-OFFICE` does not exist.**

The existing reception collection capability (CAP-064) remains appropriately exercised through school
administration authority.

*Applied in* §7.4 (finance gains no reception authority by co-location) · §12.1–§12.2 (UX-040
rewritten as an admin-office function) · §23 (UX-040 row) · §30.3 (single-administrator case is an
operational constraint, not a missing authority) · §31 (**C-47 WITHDRAWN**) · §35 (success criteria).

*Not to be confused with* **C-50**, which concerns finance work inside the administrator context and
remains open (§31).

---

## 33. Conflicts carried forward

### 33.1 Resolved conceptually by Stage 9

| # | Conceptual resolution | Still unresolved in implementation |
|---|---|---|
| **C-2** | §11.1 — the settlement screen offers only routes that work; unavailable routes are absent or plainly marked; the list is built to accept online payment later | **Yes** — Stage 12/15 own the routes themselves |
| **C-3** | §12.2 — **UX-039 Hand books to teacher** exists, transfers custody to a named teacher, and UX-067 is the proof | **Yes** — the custody machine still records rather than enforces. Stage 12 |
| **C-6** | §8.1 — every one of the seven teacher screens resolves **SC-2 ∩ SC-3**, computed identically | **Yes** — Stage 12, 13 |
| **C-10** | §2, §23 S-6, §20 — platform operations is its own surface answering *which tenants need attention*; no cross-tenant child, payment or revenue data anywhere | **Yes at the structural level — C-44.** Stage 13 |
| **C-31** | §20 defines a canonical purpose per dashboard; §27.2 classifies every mockup generation by business purpose, not by recency | **Yes** — Stage 10 presentation, **Stage 22 implementation selection** |
| **C-39** | §16 — four surfaces (UX-069, UX-043, UX-051, UX-035 → UX-007/UX-072), three parties, two branches, and no combined "Approve" | **Yes** — Stage 15 |
| **C-44** | §2 — the internal band is a separate surface with its own navigation, landing and vocabulary | **Yes — structurally unresolved. Stage 13 owns the physical separation.** |

**A conceptual resolution is not an implementation resolution.** Every row above remains an open
conflict in the repository.

### 33.2 Closed at lock

| # | Status | Why |
|---|---|---|
| **C-47** | **WITHDRAWN / NOT APPLICABLE** | Invalid assumption — Stage 9 inferred a separate front-office operator for reception collection. The owner clarified that reception collection is an administration-office function, so AUTH-SCHOOL is the correct authority and there is nothing to fix. **No Stage 7 amendment. No new authority. No implementation work.** Identifier retained; reasoning preserved (§31) |

**C-48, C-49, C-50 and C-51 keep their identifiers and remain OPEN.** C-47's withdrawal renumbers
nothing.

### 33.3 Carried into Stage 10

| # | What Stage 10 receives |
|---|---|
| **UXQ-1** | **A locked handheld-first teacher experience to implement.** The responsive and presentation contract must deliver it for UX-064…UX-070. Breakpoints, tap targets and layouts are Stage 10's to decide; *whether* the teacher surface is handheld-first is not |
| **UXQ-2** | A locked terminology register — school/book language, no `Requirement Item`, no basket/cart/order. Stage 10 may standardise the exact labels and language consistently across surfaces |
| **C-32** | §29's list of screens where LOADING / ERROR / EMPTY / REAL ZERO must be distinguishable, and why each is dangerous. Stage 10 owns the presentation contract; Stage 13 owns adoption across all pages |
| **C-33** | The UK formatting layer is adopted by 14 files, with 20 raw date renders and 20 raw money renders outside it. Money and dates are read by families and finance officers |
| **C-1** | Level vocabulary pinned to UK year groups — a presentation and schema question |
| **C-31** | Presentation consistency across the surviving dashboard purposes |
| **C-48** | The cycle-shaped family language that replaces the order-shaped one |

### 33.4 Untouched by Stage 9

**C-4 · C-5 · C-7 · C-9 · C-11 · C-12 · C-13 · C-14 · C-15 · C-17 · C-18 · C-19 · C-20 · C-22 · C-23 ·
C-24 · C-25 · C-26 · C-27 · C-28 · C-29 · C-30 · C-35 · C-36 · C-37 · C-38 · C-40 · C-41 · C-42 ·
C-43 · C-45 · C-46** — all remain exactly as Stage 8 left them, with the owners Stage 8 assigned.

Stage 9 **names the screens where several of them will be felt** — C-5 at UX-012/UX-085, C-11 at
UX-047/049/050, C-12 at UX-059, C-14 at UX-060, C-15 at UX-022, C-17 at UX-013, C-26 at UX-023, C-28
at UX-052, C-36 at UX-077, C-37 at UX-072, C-38 at UX-066/041, C-45 at UX-010/054/055, C-46 at UX-007
— but **names are not fixes**, and none of these is resolved here.

---

## 34. What Stage 9 deliberately does not decide

| Not decided | Owner |
|---|---|
| Colours · typography · spacing · density · component layouts · badges · iconography | **Stage 10** |
| The presentation contract for LOADING / ERROR / EMPTY / REAL ZERO | **Stage 10** |
| Exact responsive breakpoints and behaviour — **including how the locked handheld-first teacher experience is delivered** (breakpoints · pixel sizes · tap-target and button sizes · component layouts · CSS) | **Stage 10** |
| The UK formatting contract | **Stage 10** |
| The exact user-facing labels and strings implementing the locked terminology register (UXQ-2) | **Stage 10** |
| Which concrete existing implementation or mockup becomes the built screen | **Stage 22** |
| Component trees · shared components · filenames · folders · frontend routes and URLs | **Stage 13** |
| Physical separation of the internal band from the customer application (**C-44**) | **Stage 13** |
| Authority-keyed rather than role-keyed authorisation (**C-40**, **C-50**) | **Stage 13** |
| Endpoints · request and response contracts · HTTP shape | **Stage 14** |
| Tables · columns · keys · indexes · the representation of module entitlement, fulfilment route, requirement item and durable notification | **Stage 15** |
| Session storage · elevation mechanism · account erasure process (CAP-036) | **Stage 16** |
| The transaction boundary that makes I-2 atomic | **Stage 13, 15** |
| Migration order and sequencing | **Stage 22** |

---

## 35. Success criteria — answered

```
What does a school admin land on?
  → UX-010, the Today screen: what needs me now, composed, never computed.

What changes if that admin also has AUTH-FINANCE?
  → The Money area appears in their own navigation. Same context, same sign-in,
    no switch. Finance ACTS announce themselves as finance acts; finance READS do not.

What does a standalone finance officer see?
  → UX-063 and the ten Money screens — a reconciliation job, not a reduced
    administrator. No classes, no catalogue, no staffing, no imports, no CMS.

Can a teacher see another class?
  → No. Every teacher screen resolves SC-2 ∩ SC-3.

Where does a teacher distribute books?
  → UX-065 (the class list) and UX-066 (one child at a time).

Where are books transferred to teacher custody?
  → UX-039 Hand books to teacher. It does not exist today — this is the C-3 surface.

Where does reception record collection?
  → UX-040, at the school ADMINISTRATION OFFICE, by a school_admin:
    ready for collection → find child → verify authorised recipient →
    record hand-over. No receptionist role, no front-office authority.
    A standalone finance officer sitting in the same office does NOT
    gain reception hand-over authority.

Is the teacher experience handheld-first?
  → Yes. Locked, UXQ-1. All six teacher areas, still usable on larger screens.

Does the interface say "Requirement Item" or "Basket"?
  → Neither. School/book language: "Books for 2026/27", "September books",
    "Additional January book". The Stage 6 domain names are unchanged.

Where does the family choose fulfilment route?
  → UX-077, per child, offered at the end of UX-074. An administrator can record
    it at UX-037 or UX-019.

Where does finance decide whether a replacement is chargeable?
  → UX-051. Only finance. Never combined with the administrator's review at UX-043.

Where is rollover performed?
  → UX-015, explicitly, by an administrator, never by a date — and it states what
    will NOT change before it acts.

What does a parent with children at two schools see?
  → Both children, in one list, each carrying its own school. No school selector,
    because AUTH-FAMILY has no tenant pin.

What happens when CMS is not purchased?
  → No CMS navigation, no CMS surface, no stub. Core is unchanged.

What does platform_admin see normally?
  → Tenants, onboarding, lifecycle, job and delivery outcomes, health, support.
    No cross-tenant child, payment or revenue data.

How do they support School A?
  → UX-095: name School A, state a reason, enter an explicit engagement; work in
    UX-096, bounded to SC-6; exit. Account recovery requires it too (PA-2).

Does owner see dangerous operations as ordinary admin actions?
  → No. Break-glass elevation, break-glass write and tenant purge are a separately
    presented area, each its own surface, reasoned, time-boxed and attributed.

Can a failed query look like £0 or "nothing outstanding"?
  → No. §29 names every screen where that would be dangerous.

Does any screen invent business status?
  → No. Every screen composes its owning module's facts. MOD-010 owns no concept.
```

---

## 36. Summary

1. **Six product surfaces** — Entry & Account · School Operations · Family · Website Studio · Public
   School Site · BytHub Platform. The internal band is not Core with a null school.
2. **103 target screens and workspaces**, UX-001 … UX-103. Unchanged at lock.
3. **Nine work areas**, not fifteen module names, in the administrator's navigation.
4. **`school_admin` + AUTH-FINANCE is one context.** The Money area appears; no switch, no second
   account; finance *acts* announce themselves, finance *reads* do not. **PA-1 unchanged.**
5. **Finance is a distinct job** with three locked data bands — fixed minimum, policy-configurable
   middle, never-band — and **gains no reception hand-over authority by sitting in the same office**
   [UXQ-3].
6. **The teacher experience is handheld-first** [LOCKED UXQ-1] across all six teacher areas, still
   usable on larger screens. **Every teacher screen resolves SC-2 ∩ SC-3**, and the teacher's own
   child is handled by absence of the action plus an administrator fallback — no override button.
7. **The family navigation is the list of children**, each with its own school. No tenant pin.
8. **The settlement screen tells the truth** about what the product can do today, and is built to
   accept online payment later.
9. **The child's year is shown requirement by requirement**, in **school/book language** [LOCKED
   UXQ-2] — *Books for 2026/27 · September books · Additional January book*. Never `Requirement Item`,
   never `Order`. January never makes September look unpaid.
10. **Stage 6 domain names are unchanged.** UXQ-2 is user-facing terminology only; `DATA_MODEL.md`
    remains LOCKED as written.
11. **Four new fulfilment surfaces** — board, preparation, hand to teacher, and **reception
    collection as an administration-office function**.
12. **The replacement flow is four surfaces across three parties**, with no combined approval.
13. **Rollover states what will not change** before it acts.
14. **All 95 capabilities accounted for** — 90 surfaced, 5 explicitly classified. Unchanged at lock.
15. **All 71 workflows have a human entry point**, or are marked FUTURE by a locked stage. Unchanged
    at lock.
16. **All 15 modules classified** — three have no direct human surface, correctly.
17. **27 missing screens** named and traced. Unchanged at lock.
18. **Every current page and mockup family classified** — none deleted, none chosen. Stage 22 decides.
19. **Conflicts: C-47 WITHDRAWN / NOT APPLICABLE** (invalid assumption, identifier retained,
    reasoning preserved) · **C-48, C-49, C-50, C-51 remain OPEN with their identifiers unchanged.**
    Nothing was renumbered.
20. **No authority and no role was added.** `AUTH-FRONT-OFFICE` does not exist. **`PERMISSIONS.md`
    required no amendment and was not touched.**
21. **Owner questions: zero open.** UXQ-1 DECIDED A · UXQ-2 DECIDED A · UXQ-3 decided by owner
    clarification.
22. **Stage 8 is not reopened.** No module ownership was moved, no invariant softened, no locked
    decision rewritten.

```
STAGE 9 — ROLE EXPERIENCE, SCREENS & NAVIGATION
STATUS: LOCKED
Locked: 24 August 2026 by the owner (BytHub Technology Ltd)

STOP BEFORE STAGE 10
```
