# DESIGN_SYSTEM.md — Stage 10: Design System & Presentation Contract

```
STAGE 10 — DESIGN SYSTEM & PRESENTATION CONTRACT
STATUS: LOCKED
Locked: 25 August 2026 by the owner (BytHub Technology Ltd)
```

**What "locked" means here.** Later stages **may** implement this presentation contract, **may**
discover implementation conflicts with it, and **may** record traceable owner amendments. They **must
not** silently rewrite the locked design and presentation contract. A conflict is flagged, not
absorbed.

In particular, **Stage 13** may implement the token, component and branding architecture and **Stage
22** may select and migrate implementations — but neither may silently decide *"actually we support
dark mode"* or *"actually every school's primary buttons use its brand colour"*. Both would require a
traceable owner amendment.

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` —
**all LOCKED**.
**Compared against** `CURRENT_SYSTEM_MAP.md` · `CURRENT_BEHAVIOUR_BASELINE.md` ·
`RESTRUCTURE_STATE.md` · `REBUILD_SAFETY.md`, and the shipped presentation layer read directly from
`C:\dev\scholarshelf` — **evidence only, never authority.**

**Presentation contract only.** No React component trees, component filenames, folders, packages,
imports, hooks, state management, frontend or backend routes, API endpoints or contracts, services,
repositories, middleware, database schema, SQL, permission enforcement, physical module separation,
migration sequence, or selection of any existing mockup or implementation.

**Stage 9 is not reopened.** Its six surfaces, 103 screens, nine work areas, handheld-first teacher
decision, terminology decision and reception-collection decision are taken as given.

---

## 1. Purpose and principles

Stage 9 established *who sees which surface, with which navigation, using which screen, to perform
which job.* Stage 10 establishes:

```
SCREEN
  → VISUAL HIERARCHY
    → INTERACTION PATTERN
      → STATE PRESENTATION
        → RESPONSIVE BEHAVIOUR
          → LANGUAGE
            → FORMATTING
              → ACCESSIBILITY
```

### The twelve principles this contract works to

**DS-P1 — One product, one design system, controlled school identity.** [US-02, locked]
A school may look recognisably like itself. It may not redesign the product.

**DS-P2 — The design system presents facts; it never invents them.**
Status labels come from the owning module (Stage 8, I-10). The design system decides how a status
*looks*, never what statuses *exist*. This is the presentation half of the discipline that C-45
violated.

**DS-P3 — Consequence is visible before commitment.**
The weight of a control matches the weight of what it does. Handing over a book, confirming a
settlement, correcting history, erasing an account and purging a tenant are five different acts and
must not share one red dialog.

**DS-P4 — A failure never wears the clothes of a fact.** [PP-009]
`LOADING`, `ERROR`, `EMPTY` and `REAL ZERO` are four visually and linguistically distinct states.
"£0.00 outstanding" is a finding. "We could not load it" is not a finding, and must never be dressed
as one.

**DS-P5 — Density follows the job.** [Stage 9 §34]
A teacher standing in a classroom and a finance officer reconciling a bank statement need different
amounts of information on screen. Both are served badly by one density.

**DS-P6 — The classroom is the design target for teacher screens.** [LOCKED UXQ-1]
Handheld-first is a completion criterion, not an enhancement.

**DS-P7 — Semantics are never negotiable by configuration.**
A school's brand colour may not become the danger colour, the focus indicator, or the disabled state.
Branding changes identity, never meaning.

**DS-P8 — Accessibility is part of the system, not a later pass.**
Contrast, focus, keyboard, targets, labels and non-colour signalling are specified with each pattern,
not appended to the end of the project.

**DS-P9 — The product speaks school language.** [LOCKED UXQ-2]
One concept, one name per audience. No architecture terms, no commerce terms the product has not
earned.

**DS-P10 — Nothing decorative earns space.**
No KPI wall, no chart that answers no question, no motion that delays a hand-over, no card that
exists because card styling exists.

**DS-P11 — One supported appearance.** [LOCKED DSQ-1]
ScholarShelf's Core operational application supports **light appearance only** in this rebuild. There
is no third state between supported and unsupported: an appearance is either reachable, deliberately
designed, accessibility-verified and maintained — or it is not maintained at all.

**DS-P12 — The school owns its identity; ScholarShelf owns action meaning.** [LOCKED DSQ-2]
Brand colour reaches identity surfaces. It never reaches the canonical primary-action colour, and it
never reaches semantics, focus, query states, support state or elevated authority.

---

### The two locked appearance and branding statements

```
ScholarShelf Core operational application:
Light appearance only.

System dark-mode preference:
Not honoured by this rebuild.

Future dark appearance:
May be introduced only as a new deliberate,
fully designed and accessibility-verified contract.
```

```
THE SCHOOL OWNS ITS IDENTITY.

SCHOLARSHELF OWNS ACTION MEANING.
```

---

## 2. Visual direction

### 2.1 What this product actually is

ScholarShelf handles **children, money, physical stock, custody and auditable decisions**, in schools,
mostly by people doing several jobs at once, often in September when everything happens at once.

### 2.2 Five explicit positions

Each position states what it *means in interface behaviour*, not how it feels.

| Dimension | Position | What it means in behaviour |
|---|---|---|
| **Calm ↔ Energetic** | **Calm, with earned emphasis** | Colour, weight and motion are budgeted. A screen has **at most one** emphatic element — usually the thing that needs a decision. If everything on a queue is urgent-red, nothing is. Emphasis is spent on *action required*, never on totals, headings or branding. |
| **Dense ↔ Spacious** | **Purposefully dense; spacious only where the job is one decision at a time** | Finance and stock screens fit comparable values on one screen without scrolling to compare. Teacher and parent screens do the opposite. Density is a **contract per surface** (§6), never a per-page choice. |
| **Institutional ↔ Consumer** | **Institutional, plainly written** | Records, dates, amounts and attribution are first-class and always visible. But the writing is plain English — a parent reads the same clear sentences a bursar does; the difference is how much detail they are shown, not how bureaucratic the tone is. |
| **Formal ↔ Friendly** | **Respectful, never chirpy** | No exclamation marks, no "Woohoo, all caught up!", no celebratory animation on a financial act. A school telling a family they owe £12 should sound like a school. Warmth comes from clarity and from not wasting people's time. |
| **Operational ↔ Decorative** | **Operational** | Every element answers one of: *where am I · what matters · what needs action · what can I do · what happened.* Anything that answers none of those is removed. |

### 2.3 Explicitly rejected directions

| Rejected | Why it fails ScholarShelf |
|---|---|
| **Generic SaaS dashboard** | Produces the KPI wall Stage 9 §20 forbids and invites Reporting to compute truth it does not own (C-45) |
| **Everything-is-a-card** | Destroys value comparison, which is finance's entire job (§13) |
| **Marketing-scale whitespace** | A distribution board with eight children per screen is unusable in September |
| **Neon / startup UI** | Semantic colour must carry meaning; a saturated palette leaves nowhere for danger to live |
| **Playful children's app** | Children are not users (D-09). The users are administrators, bursars, teachers and parents |
| **Clinical / hospital software** | Reads as unmaintained and makes families distrust a school-facing portal |
| **Spreadsheet pretending to be a web app** | Loses status semantics, accessibility and consequence hierarchy entirely |

### 2.4 The three qualities a screen is judged on

```
LEGIBLE      a person can find the one thing that needs them, at a glance
HONEST       nothing on screen claims more certainty than the system has
PROPORTIONATE the visual weight of a control matches the weight of the act
```

---

## 3. Canonical design system vs school branding

### 3.1 The locked two-layer model

```
SCHOLARSHELF DESIGN SYSTEM      ← canonical, not configurable
         ↓
CONTROLLED SCHOOL IDENTITY      ← a small, bounded set of inputs
         ↓
SCHOOL EXPERIENCE               ← recognisably that school, unmistakably ScholarShelf
```

### 3.2 What is canonical and can never be configured

Navigation architecture · the nine work areas · interaction patterns · information hierarchy ·
component behaviour · semantic colour meanings · status presentation rules · query-state rules ·
consequence tiers · responsive behaviour · density contracts · accessibility baseline · formatting ·
terminology register · focus indication · disabled indication · motion policy.

**A school cannot use branding configuration to redesign the product.** There is no theme marketplace,
no layout chooser, no navigation editor, and no CSS input.

### 3.3 What a school may customise

| Input | Where it appears |
|---|---|
| **School name** | Shell identity, page title, communications, public site |
| **School logo** | Shell identity mark, sign-in, communications, documents |
| **Favicon** | Browser tab |
| **Primary identity colour** | Identity strip, active navigation, selected controls, communication accents |
| **Secondary / accent identity colour** | Supporting identity accents only |
| **Communication identity** | Logo and name in school-facing email and documents |

That is the whole list. Everything else about how ScholarShelf looks is ScholarShelf's.

### 3.4 Where school colour may and may not appear — the **final** boundary [LOCKED DSQ-2]

**This boundary is final, not provisional. Stage 13 implements it; Stage 13 does not reinterpret it.**

| **MAY — identity surfaces** | **MAY NOT — canonical, always** |
|---|---|
| Identity strip | **The canonical primary-action colour** |
| School identity mark context | **Danger / destructive** |
| Active navigation indication | **Warning** |
| Selected-state indication on controls | **Success** |
| Section accents and rules | **Information** |
| School-facing communication | **Pending** |
| Public website (its own contract, §30) | **Disabled** |
| | **Focus indicator** |
| | **Financial-risk emphasis** |
| | **Support-engagement indication** |
| | **Elevated-authority / break-glass indication** |
| | **Any query-state treatment** |

### 3.4.1 The core rule

```
THE SCHOOL OWNS ITS IDENTITY.

SCHOLARSHELF OWNS ACTION MEANING.
```

```
School A — red identity
[ Confirm settlement ]  →  ScholarShelf navy

School B — green identity
[ Confirm settlement ]  →  ScholarShelf navy

School C — purple identity
[ Confirm settlement ]  →  ScholarShelf navy
```

The school is clearly recognisable. The meaning and visual hierarchy of an important product action
stay consistent everywhere ScholarShelf runs.

### 3.4.2 The four separated categories

```
SCHOOL BRAND            → identity

PRODUCT PRIMARY         → action hierarchy

SEMANTIC COLOURS        → success · warning · danger · information
                          pending · disabled · focus

RESERVED SYSTEM STATES  → support mode
                          elevated / break-glass authority
                          financial-risk emphasis
```

**School branding may override none of the semantic or reserved categories, and may not override the
canonical product primary-action colour.**

### 3.4.3 The four rules that make this enforceable

**B-1 · Semantic tokens are a closed set.** Brand input feeds *identity* tokens only. Semantic tokens
are not addressable by branding, in any direction. A school whose brand colour is red does not get
ambiguous destructive buttons, because destructive never reads from brand input.

**B-2 · Focus is never brand-coloured.** The focus indicator has its own canonical token, unreachable
by branding, meeting ≥ 3:1 against both the background and any adjacent fill. Today the code does the
opposite (**C-52**).

**B-3 · A brand colour is accepted only with a system-derived contrast-safe pairing.** Wherever brand
colour is displayed — that is, on the identity surfaces where it is now permitted — the text colour is
derived by the system and verified to ≥ 4.5:1; where the brand colour cannot carry text at any
derivable pairing, the system uses it as an **accent** (rule, bar, indicator) rather than a
text-bearing fill. **A school can never configure itself into unreadable text.** Today no contrast
check exists anywhere (**C-53**).

**B-4 · The primary-action token is not brand-addressable.** [LOCKED DSQ-2] The canonical
ScholarShelf primary action stays ScholarShelf navy in every school. This applies to **all** ordinary
primary actions throughout Core, and especially to consequential ones — *confirm settlement · hand
over books · transfer custody · prepare books* and every other permitted operational act. Their
consequence tiers may add finance, destructive or elevated framing per §10, §17, §18 and §20; **brand
input may not override any of those meanings.**

Because the canonical primary is not tenant-derived, it also meets its own contrast requirements
**independently of any school's branding** — verified once, held everywhere.

### 3.4.4 The appearance and branding matrix — stated so Stage 13 cannot reinterpret it

```
                          SCHOOL CONTROLLED?

Light appearance          NO — canonical
Dark appearance           NOT SUPPORTED

School name               YES
School logo               YES
Favicon                   YES
Identity colour           YES
Secondary identity        YES
Communication identity    YES

Primary action colour     NO
Danger                    NO
Warning                   NO
Success                   NO
Info                      NO
Pending                   NO
Focus                     NO
Disabled                  NO
Query-state semantics     NO
Support mode              NO
Break-glass / elevation   NO
Financial-risk emphasis   NO
```

### 3.5 The Core / CMS wall

```
CORE            school identity + application branding   ← §3.3 list, canonical system
CMS WEBSITE     website-specific styling                 ← broader, its own contract (§30)
```

**CMS site-theme choices never reach the operational application**, and the CMS studio itself — the
tool an IT person edits the site with — is an operational surface and uses the canonical system.

---

## 4. Colour system

### 4.0 Appearance — **light only** [LOCKED DSQ-1]

```
ScholarShelf Core operational application:
Light appearance only.

System dark-mode preference:
Not honoured by this rebuild.

Future dark appearance:
May be introduced only as a new deliberate,
fully designed and accessibility-verified contract.
```

**Every token, contrast ratio, state treatment and accessibility guarantee in this document is
specified for, and verified against, the light appearance — the only supported one.**

**The application does not "currently support both".** It does not. It contains **unused dark code**
that nothing can activate, which is a separate matter recorded as **C-55**. The `.dark` palette in
`index.css` is **outside the target contract** and must not be maintained as though it were supported.

**The rule that leaves no third state:**

```
SUPPORTED APPEARANCE      UNSUPPORTED APPEARANCE
→ reachable               → not maintained as dead
→ deliberately designed     parallel design code
→ accessibility verified
→ maintained
```

**Nothing is deleted by Stage 10.** Stage 13 applies the canonical light-only token and application
architecture; Stage 22 handles safe removal of the obsolete dark implementation during migration.

### 4.1 Four colour roles, kept apart

```
PRODUCT / BASE      surfaces, text, borders — ScholarShelf's own
                    INCLUDING the canonical primary-action colour [DSQ-2]
SEMANTIC            meaning: success, warning, danger, info, pending, disabled, focus
SCHOOL IDENTITY     bounded brand input (§3.3) — identity surfaces only [DSQ-2]
BAND DISTINCTION    Core vs Internal platform vs CMS studio (§4.6)
```

### 4.2 Base

The shipped tokens are sound and are adopted, with their verified contrast:

| Role | Value | Note |
|---|---|---|
| Background | `210 33% 98%` (#f7f9fb) | Not pure white — cards read as cards without borders doing all the work |
| Surface (card) | `0 0% 100%` | |
| Foreground | `204 9% 11%` | |
| Muted foreground | `223 5% 28%` | Verified ≥ 4.5:1 on both background and card |
| **Primary — the canonical action colour** | `217 62% 9%` (#091426) deep navy | **ScholarShelf's own, in every school. Never brand-derived** [LOCKED DSQ-2]. Meets its contrast requirements independently of any tenant's branding |
| Border | `233 9% 72%` | **2.09:1** — visible edge |
| Border (strong) | `233 9% 58%` | **3.29:1** — for any control whose outline is the only cue it is a control (WCAG 1.4.11) |
| Radius | `0.75rem`, four-step scale | |

### 4.3 Semantic — the closed set

| Token | Meaning in this product | Shipped? |
|---|---|---|
| **success** | A thing completed and confirmed by its owning module — settled, handed over, published | ✔ `152 62% 30%`, 5.18:1 |
| **warning** | A thing that will go wrong without attention — stock will not cover confirmed demand, an assignment is expiring, a route is unresolved before preparation | ✔ `32 88% 34%`, 5.13:1 |
| **danger** | Failure, refusal, or a destructive consequence | ✔ `0 75% 42%` |
| **info** | Contextual, non-urgent explanation | **MISSING — added here** |
| **pending** | *Correctly* waiting on someone else. A submitted claim awaiting finance is **not** a warning | **MISSING — added here** |
| **neutral** | Ordinary, no state | ✔ via muted |
| **disabled** | Unavailable, with a stated reason | Partial — no dedicated token |
| **focus** | Keyboard focus. **Its own token; never brand-derived** | **Conflated with `--ring` today — C-52** |

**Why `info` and `pending` must exist.** Without them, everything non-success becomes a warning. A
family's "Reference submitted — waiting for the school to confirm" is the system working correctly;
rendering it amber teaches families and finance officers that amber means nothing.

**Each semantic role provides three values** — a foreground (≥4.5:1 on surface), a fill for pills and
banners, and a border — so a status never depends on one of the three alone.

### 4.4 Colour is never the only signal

Every semantic use carries **at least one non-colour cue**: a shape or icon, a text label, or position.
A status pill always contains its word. A destructive button is never distinguished from a primary
button by colour alone.

### 4.5 Brand input — recap of the final boundary [LOCKED DSQ-2]

Brand colour feeds **identity tokens only**. It never feeds §4.3's semantic set, and **it never feeds
§4.2's canonical primary-action colour.** See §3.4, and the matrix at §3.4.4.

### 4.6 Band distinction — Core · Platform · CMS studio

Stage 9 locked that the internal band is not Core with a null school (C-10). One design language,
three unmistakable bands:

| Band | Distinction |
|---|---|
| **Core school operations** | The school's identity is present — its name, its mark, its identity colour in the shell. That presence *is* the signal "you are inside a school". |
| **BytHub Platform (S-6)** | **No school identity anywhere.** ScholarShelf's own mark, a distinct shell treatment (a darker, plainly non-tenant shell), and a persistent "ScholarShelf Platform" identity. The operator must never wonder whether they are inside a school. |
| **CMS studio (S-4)** | Canonical Core system, plus an explicit *editing* frame: the edited site's content is always shown inside a clearly bounded preview region that reads as content-being-edited, never as the studio's own chrome. |
| **Support engagement** | Overrides all of the above (§19) |

---

## 5. Typography

### 5.1 Strategy

One family for the interface — a humanist sans with genuine tabular figures (the shipped Inter
qualifies) — plus one monospace for references, codes and identifiers.

**`--font-heading` is currently an alias of `--font-sans`.** The contract makes that deliberate rather
than accidental: **one interface family, differentiated by size and weight, not by a second typeface.**
A second display face buys nothing in an operational product and costs a font load on a classroom
handheld.

### 5.2 Scale

| Role | Size / line-height | Weight | Used for |
|---|---|---|---|
| **H1 · Page title** | 24 / 32 | 600 | One per screen. *Where am I.* |
| **H2 · Section** | 20 / 28 | 600 | Major regions |
| **H3 · Subsection** | 16 / 24 | 600 | Panel and card titles |
| **Body** | 15 / 24 | 400 | Operational default |
| **Body-large** | 16 / 26 | 400 | **Teacher and parent surfaces** |
| **Table** | 14 / 20 | 400 | Data-dense rows |
| **Label** | 13 / 20 | 500 | Field labels, column headers |
| **Help / caption** | 13 / 20 | 400 | Assistance and metadata |
| **Numeric — money and quantity** | inherits size | **500, tabular figures** | Always tabular so columns align |
| **Button** | 15 / 1 (Core) · **16 / 1 (teacher)** | 500 | |
| **Alert text** | 15 / 24 | 400, heading 600 | |
| **Long-form** | 16 / 28 | 400 | CMS editing, policy text |

**Absolute floor: 12px**, and only for non-essential metadata. Nothing a person must read to do their
job is below 13px.

> **Audit note.** Shipped page titles are `text-3xl` (30px) with `font-bold` (700). The contract sets
> 24 / 600. Thirty-pixel bold titles consume the emphasis budget that *action required* needs.

### 5.3 Weights

400 body · 500 labels, buttons, numerics · 600 headings and emphasised values. **700 is not used** —
at operational density it reads as shouting and flattens the difference between a heading and an
alert.

### 5.4 What the hierarchy must answer

```
WHERE AM I?          H1 + context indicator (DS-004)
WHAT MATTERS?        one emphatic element, at most
WHAT NEEDS ACTION?   action-required treatment (§14, §31)
WHAT CAN I DO?       action bar (DS-006), one primary
WHAT HAPPENED?       attribution and history, at label/help weight
```

### 5.5 Density ceiling

No screen exceeds **two type sizes above body plus two below** in one region. A screen needing more
levels is a screen doing more than one job.

---

## 6. Spacing, sizing and density

### 6.1 Scale

A **4px base**: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. No arbitrary values.

### 6.2 Three density families — the job chooses, never the page

| Family | Row / item height | Vertical rhythm | Control height |
|---|---|---|---|
| **OPERATIONAL** | 40px | 12px | 36px |
| **STANDARD** | 48px | 16px | 40px |
| **COMFORTABLE** | 56px+ | 20–24px | **44px minimum** |

### 6.3 Assignment by surface — a contract, not a preference

| Context | Family | Why |
|---|---|---|
| **finance** | **OPERATIONAL** | Reconciliation is comparison. Values must be visible together |
| **school_admin** | **STANDARD** | Broad operational overview; occasional dense tables adopt OPERATIONAL *within the table only* |
| **teacher** | **COMFORTABLE** | Handheld-first (UXQ-1). One child at a time |
| **parent** | **COMFORTABLE** | Occasional use, mixed devices, consequential information |
| **it_personnel** | **STANDARD** | Editing work |
| **platform_admin / owner** | **OPERATIONAL** | System tables and diagnostics |
| **Entry & Account (S-1)** | **COMFORTABLE** | Every user, every device, often under stress |
| **Public site (S-5)** | Own contract (§30) | |

**Two prohibitions, stated plainly:**

- **The teacher surface is never a shrunken finance table.** A dense grid does not become a teacher
  screen by getting narrower.
- **Finance is never four giant cards per screen.** Card-per-record destroys the comparison that is
  finance's entire job.

### 6.4 Touch and pointer targets

| Rule | Value |
|---|---|
| **Any control on a teacher screen (UX-064…UX-070)** | **≥ 44 × 44 px**, at every width |
| **Any control on any surface below the MD breakpoint** | **≥ 44 × 44 px** |
| **Pointer-only, desktop-only, dense table controls** | **≥ 24 × 24 px** with ≥ 24px clear offset (WCAG 2.2 AA 2.5.8) — **never in the teacher path** |
| **Spacing between adjacent independent actions** | ≥ 8px |
| **Spacing between adjacent actions of *different consequence*** | **≥ 12px**, and they must not be visually equal weight |

> **Audit note.** Shipped buttons are `min-h-9` (36px) default and `min-h-8` (32px) small. Both are
> below the 44px this contract requires for the teacher path and for narrow widths. Stage 0's finding
> of 24px targets is consistent with this. **Stage 13 owns adoption.**

---

## 7. Layout system

### 7.1 Shell

```
┌──────────────────────────────────────────────────────────────┐
│ IDENTITY STRIP   school mark · school name · CONTEXT (DS-004)│
│                  notifications · account                      │
├───────────────┬──────────────────────────────────────────────┤
│ PRIMARY NAV   │ PAGE HEADER   title · scope · ACTION BAR     │
│ (work areas)  ├──────────────────────────────────────────────┤
│               │ FILTER BAR (where the screen has one)        │
│ SECONDARY NAV ├──────────────────────────────────────────────┤
│ (within area) │ CONTENT                                       │
│               │                                               │
│               │ SUPPORTING INFORMATION (secondary emphasis)   │
└───────────────┴──────────────────────────────────────────────┘
                                    SIDE PANEL / DRAWER ▸
```

### 7.2 Region rules

| Region | Contract |
|---|---|
| **Identity strip** | Always present when authenticated. Carries school identity, active context, and any override state (support · elevation · history) |
| **Primary navigation** | The context's work areas (Stage 9 §4.2). Never more than nine |
| **Secondary navigation** | Within one area. Never a second full menu |
| **Page header** | One H1, one scope line, one action bar. Never two competing titles |
| **Action bar** | **At most one primary action.** Others are secondary or in an overflow |
| **Filter bar** | Applied filters are always visible as removable tokens — a filtered empty result must never be mistaken for a real empty |
| **Content** | One job. If it needs three unrelated jobs, it is three screens |
| **Supporting information** | Explicitly lower emphasis; never carries the primary action |
| **Side panel / drawer** | For a related record or a focused sub-task without losing place. **Never** for a primary workflow on a handheld |

### 7.3 Composition without ownership

A Stage 9 screen may compose several modules (UX-019 composes seven). The layout must express that as
**distinct, titled, separately-stated regions** — each visibly a view of a different thing —
**never** as a universal record with a long tab strip. A tab strip implies one object with facets; the
child record is seven modules' facts standing next to each other.

**Rule:** a composed detail surface presents **at most five** primary regions before it must be split.
Every region states what it is a view of.

---

## 8. Navigation presentation

| Element | Contract |
|---|---|
| **Active area** | Indicated by **two** cues: a fill or pill *and* a weight change. Never colour alone |
| **School identity colour** | May colour the active indication. May not be the only difference between active and inactive |
| **Entitlement** | An un-entitled optional module (CMS) is **absent**. No greyed item, no lock icon, no upsell (DS-P1, UXQ/MA-2) |
| **Authority** | The Money area appears only where the context carries AUTH-FINANCE. **Never** shown disabled (Stage 9 §6, R-3) |
| **Discoverability ≠ authorisation** | Navigation is a wayfinding surface. Absence is not enforcement (Stage 9 UX-P4) |
| **Counts** | A work area may carry a count **only** where it is an action-required count, from the owning module. Never a vanity total |
| **Teacher** | Six items, always reachable, no nesting, target ≥ 44px (§6.4) |
| **Parent** | The primary navigation is the children list; each child carries its school name as a persistent, non-decorative label |
| **Platform** | Routine areas and the owner's **Exceptional operations** area are visually separated by a rule and a distinct treatment (§20) — never adjacent peers |

---

## 9. Dashboard presentation

### 9.1 The purposes are locked — Stage 9 owns them

```
school_admin      "What needs me today?"
finance           "What money needs a decision?"
teacher           "Which class, and how much is left?"
parent            "What does each child need, and is anything waiting on me?"
platform_admin    "Which tenants need operational attention?"
it_personnel      "What is the state of the website?"
```

### 9.2 The contract every dashboard obeys

**D-1 · Every element answers the screen's question.** An element that cannot be traced to the
question is removed. There is no "general interest" region.

**D-2 · Action before information.** The screen opens with what needs a decision. Summary follows.
Never the reverse.

**D-3 · Composition only.** Every figure is asked of its owning module. No dashboard derives a
lifecycle count itself. This is the presentation-level guard against **C-45**.

**D-4 · Query state per region.** Each region resolves LOADING / ERROR / EMPTY / REAL ZERO
independently (§15). One failed region never blanks the page, and never renders as zero.

**D-5 · Emphasis budget.** At most **one** emphatic element. A dashboard where six things are red has
told the user nothing.

**D-6 · Role-appropriate density** per §6.3.

**D-7 · No KPI wall.** Explicitly forbidden: a grid of twelve count tiles; charts that answer no
question; an undifferentiated activity feed; a metric shown because it is available.

### 9.3 When each element type is legitimate

| Element | Legitimate when | Never |
|---|---|---|
| **Actionable queue** | Items need a decision by *this* person | As a read-only list dressed as work |
| **Status summary** | A small set of states answers the question directly | As a totals wall |
| **Count** | It is an *action-required* count from the owning module | As a vanity metric |
| **Trend** | A direction changes what the person does today | Because a chart looks like a dashboard |
| **Alert** | Something is wrong or will be | For routine states |
| **Recent activity** | Attribution genuinely aids the job (platform, audit) | As filler on customer dashboards |
| **Shortcut** | A frequent task is otherwise several steps away | As a duplicate of the navigation |

---

## 10. Buttons and action hierarchy

### 10.1 Seven levels

| Level | Weight | Rule |
|---|---|---|
| **Primary** | Solid, **canonical ScholarShelf navy — never brand-coloured** [LOCKED DSQ-2] | **At most one per screen region** |
| **Secondary** | Outlined | Alternatives and cancels |
| **Tertiary** | Text-weight | Low-consequence, in-context |
| **Destructive** | Solid or outlined **danger** | Never colour alone — always the word, and never adjacent to primary at equal weight |
| **Exceptional** | Distinct elevated treatment (§20) | Owner break-glass and purge only. Never reachable as a routine control |
| **Inline** | Within a row or field | ≥ 24×24 desktop / ≥ 44×44 handheld |
| **Link / navigation** | Text link | Never used for an action that changes state |

**Three equally prominent primary buttons on one decision screen is a contract violation.**

**The primary action looks the same in every school** [LOCKED DSQ-2]. A bursar moving between two
ScholarShelf schools, a support engineer reading a screenshot, and a training document all rely on
*"the navy button is the action"*. That is why the primary-action token is not brand-addressable
(§3.4.3 B-4).

### 10.2 Consequence differentiation for the named acts

| Act | Level | Tier (§17) |
|---|---|---|
| Hand over books · record collection | **Primary** | T1 |
| Prepare · transfer custody to teacher | **Primary** | T1 |
| Approve / reject a replacement (operational) | Primary / Secondary-destructive | T1 |
| **Confirm settlement** | **Primary + finance-authority framing** (§18) | **T2** |
| **Reject a claim** | **Destructive + finance framing** | **T2** |
| Authorise discount · subsidy · waiver · school funding | Primary + finance framing | T2 |
| **Issue refund** | **Destructive + finance framing** | **T2** |
| Decide replacement charge | Primary + finance framing | T2 |
| **Correct stock · settlement · requirement · history** | **Secondary, with a correction frame** | **T3** |
| **Run rollover** | **Primary, behind a review step** | **T4** |
| Close cycle · offboard staff · archive child | Secondary | T4 |
| **Erase an account** | **Destructive, out of ordinary navigation** | **T5** |
| **Break-glass elevate / write · purge tenant** | **Exceptional** | **T6** |

**Correction is deliberately not destructive-red.** A correction is a legitimate, recorded act
(DM-047), not a deletion. Colouring it as danger teaches administrators to fear the honest path and
prefer the silent edit.

### 10.3 Cancel

Cancel is always **secondary**, always present where a form can be abandoned, and never destructive-
coloured — cancelling a form destroys nothing.

---

## 11. Forms

### 11.1 Two fundamentally different interactions

```
EDITING A SETTING              RECORDING A BUSINESS EVENT
────────────────────           ──────────────────────────
a website title                confirming settlement
a notification preference      handing over books
school identity colour         correcting stock
                               issuing a refund
                               running rollover

Reads as: an editor            Reads as: an event
Save is: a save                Commit is: a stated consequence
Undo: change it back           Undo: a NEW recorded correction
```

**Business events must read as events.** They state what is about to become true, who is doing it, and
under what authority. They are never a bare "Save".

### 11.2 The field contract

| Element | Rule |
|---|---|
| **Label** | Always visible, above the field. **Never** placeholder-as-label |
| **Help text** | Below the label, before the field — read before, not after, the mistake |
| **Required / optional** | **Optional is marked.** Required is the default and is not decorated. Whichever is rarer is what gets marked; if most fields are optional, invert and state the convention on the form |
| **Validation timing** | **On blur** for format; **on submit** for cross-field and business rules. **Never on every keystroke** — it punishes typing |
| **Error** | Adjacent to the field, programmatically associated, with an icon and text, never colour alone. States what to do, not what failed |
| **Grouping** | Fieldsets with visible legends where fields share meaning |
| **Multi-step** | Visible position, ability to go back without loss, no step that cannot be reviewed before commit |
| **Dirty state** | Unsaved changes are indicated persistently, and leaving warns once |
| **Cancel** | Always available; never destructive-coloured |
| **Irreversible** | Follows §17's tier, not a generic "Are you sure?" |

### 11.3 Submission

A submitting form disables its **primary** control only, states that it is working, and never blanks
the form. On failure the entered values are preserved — every time, without exception.

---

## 12. Tables and data-dense work

### 12.1 Where tables are the right answer

Finance reconciliation · stock · children · staff · provider records · reporting · platform tenant
lists. **Comparison of like values across records is a table's job, and cards cannot do it.**

### 12.2 The contract

| Aspect | Rule |
|---|---|
| **Column hierarchy** | Identity first, then the deciding value, then supporting, then status, then actions. The column a person came to compare is never below the fold horizontally |
| **Money and quantity** | **Right-aligned, tabular figures**, consistent decimals (§26) |
| **Sorting** | Explicit, on the header, with current state announced. Default sort is stated |
| **Filtering** | Applied filters visible as removable tokens above the table — **always**, because a filtered table with no rows must never read as a real empty (§15) |
| **Selection** | Visible count, visible clear, and the bulk action states how many records it will affect |
| **Row actions** | Never hover-only (§22). Present at rest, or in a per-row menu with an accessible name |
| **Status** | A status column carries the owning module's word (§14). Never a design-system synonym |
| **Pagination** | Presentation states what is shown and what exists ("41–60 of 412"). Infinite lists are acceptable only where no total is needed and never in finance |
| **States** | LOADING / ERROR / EMPTY / REAL ZERO resolve **inside the table region**, keeping headers visible so the shape of the missing thing is legible (§15) |
| **Sticky** | Header row sticks; on wide tables the identity column sticks |

### 12.3 Narrow screens

A table below MD becomes a **record list** (DS-009): identity line, the deciding value, status, one
action. **It does not become a horizontally scrolling table**, and it does not become a stack of
decorative cards. Which fields survive is decided per table, in favour of the deciding value.

**Finance is the exception that proves the rule:** below MD, finance tables prioritise child · payable
· outstanding · status, and everything else moves to the record detail. Comparison is preserved on the
one dimension the person is actually reconciling.

---

## 13. Cards and summaries

| Appropriate | Inappropriate |
|---|---|
| A child summary on the family home | Finance reconciliation |
| The parent's per-child entry point | Any school-wide list of comparable records |
| A teacher's class progress summary | Stock tables |
| A small actionable summary on a dashboard | Anything where values must be compared |
| A record summary above a detail surface | Anything chosen because card styling exists |

**The anti-cardification rule:** if a person's task is *comparing the same field across records*, it is
a table. If the task is *choosing one of a few things and going there*, it may be a card. When the
count of items is unbounded, it is a table.

**A card is never a container for a dense table.** Nesting a dense table inside a card wastes the
horizontal space the table needs.

---

## 14. Status presentation

### 14.1 The rule that prevents a seventh vocabulary

```
DOMAIN OWNS THE FACT   →   DESIGN SYSTEM PRESENTS IT

NEVER: DESIGN SYSTEM INVENTS A STATUS
```

Stage 5 §10 found one real-world ending — *the books reached the person who takes them away* —
modelled **six times**. Stage 6 reduced it. **Stage 10 must not re-create the problem visually.**

### 14.2 Four hard rules

**S-1 · The label is the owning module's word.** If MOD-007 says *Settled*, the pill says "Settled".
The design system never substitutes *Complete*, *Done*, *Paid* or *Distributed* for a domain fact.

**S-2 · No design-system-only statuses.** There is no "Complete" state that exists because a screen
wanted one. Reporting in particular may not label; it may only render what it composed.

**S-3 · One concept, one presentation, everywhere.** A settlement position looks the same on the
family screen, the finance queue and the child record. Different *detail*, identical *semantics*.

**S-4 · Colour maps to semantics, not to vocabulary.** *Settled* → success. *Awaiting confirmation* →
**pending**, not warning. *Rejected* → danger. *Outstanding, not yet due* → neutral. *Outstanding,
overdue* → warning. The mapping is declared once, per owning module's status set, and never re-decided
per screen.

### 14.3 Presentation

A status is a **pill**: fill, border, **always its word**, and an optional icon. Never a bare dot,
never colour alone, never an abbreviation. In dense tables the pill may be compact but never loses its
word.

---

## 15. Query states

**This is Stage 10's most important deliverable, and the owning stage for C-32.**

### 15.1 The four states

```
LOADING     we do not know yet
ERROR       we asked and could not obtain the answer
EMPTY       we asked successfully and there is genuinely nothing
REAL ZERO   we asked successfully and the answer is zero — itself information
```

### 15.2 The contract

| | **LOADING** | **ERROR** | **EMPTY** | **REAL ZERO** |
|---|---|---|---|---|
| **Visual** | Neutral placeholder occupying the region's real shape; headers/labels retained | **Danger-bordered panel** with its own region; never inline grey text | Neutral panel, **muted**, clearly a state | **Ordinary content.** A zero is a fact and looks like one |
| **Wording** | "Loading <the thing>…" | "**Could not load <the thing>.**" + what it does *not* mean | "**No <things> yet.**" + how one comes to exist | The value itself: "£0.00 outstanding" |
| **Indicator** | Motion-light progress, `role="status"`, `aria-live="polite"` | Danger icon + `role="alert"` | Neutral icon or none | None |
| **Actions** | Page actions disabled; navigation always available | **Retry always offered**; unrelated actions stay available | **The creating action is offered** ("Add a child") | All ordinary actions available |
| **Retry** | — | Explicit control, states it is retrying, never silently loops | — | — |
| **Prior data** | Retained where a refresh, replaced where a first load | **Retained only if explicitly marked stale** (§15.4) | — | — |
| **MUST NOT** | Imply empty, zero, complete or success | **Render any number, currency value, count, or reassuring absence** | Be produced by a failure or by an active filter | Be used where the query did not succeed |

### 15.3 The sentence that must always be available on an error

> "We could not load this. **This is not a sign that there is nothing to show.**"

The shipped `query-state.tsx` already says almost exactly this. **It is adopted as the canonical
wording.**

### 15.4 Stale data

Where prior data is retained after a failed refresh it is **explicitly marked stale**, with the time it
was last known good, and any action that depends on its accuracy is disabled with that reason stated.
Silent staleness on a money screen is indistinguishable from a lie.

### 15.5 EMPTY is never produced by a filter

A filtered result with no rows says **"No results for these filters"** and offers to clear them. It
never says "No children have been added yet." A filter that hides everything is not an absence of
records.

### 15.6 The forbidden renders — Stage 9 §29, mapped

Every screen Stage 9 named, with what a failure must never look like:

| Screen | A failure must **never** render |
|---|---|
| UX-045 Settlement position | `£0 outstanding` · "Nothing outstanding" |
| UX-046 Payment claim review | "No claims to review" · a zero queue count |
| UX-063 Finance home | Any monetary figure · "You're all caught up" |
| UX-054 Financial reports | `£0.00` · an empty chart implying no revenue |
| UX-076 Payment & funding history | "No payments" · a zero total |
| UX-032 Stock position | "In stock" · any available quantity — **a failure here can let a confirmation proceed** |
| UX-018 Children register | `No students` |
| UX-065 Class hand-over list | An empty class · "All children have their books" |
| UX-037 Fulfilment board | "Nothing to prepare" |
| UX-038 Prepare | "Nothing to prepare" |
| UX-040 Reception collection | "No collections ready" |
| UX-067 Books I'm holding | **"You hold nothing"** |
| UX-072 Child's year | **"Your child needs nothing"** · `£0.00` |
| UX-071 Family home | "You're all caught up" · "Nothing needs you" |
| UX-089 Platform operations home | **"All tenants healthy"** |
| UX-090 Tenant directory | "No tenants" |

**Rule for all sixteen: on ERROR, no number, no currency value, no count, no reassurance.**

### 15.7 What Stage 10 does not do here

**No `QueryState` component is designed.** Stage 13 owns physical adoption and component structure;
Stage 22 owns selection. §37 records the current adoption honestly.

---

## 16. Errors and feedback

### 16.1 Seven levels

| Level | Presentation | Recovery |
|---|---|---|
| **Field validation** | Inline, adjacent, associated with the field | Correct and resubmit |
| **Action failure** | Inline near the action, values preserved | Retry; the form is intact |
| **Recoverable section failure** | Danger panel **within that region**; the rest of the page works | Retry that region |
| **Full-page failure** | Full-region panel; navigation still works | Retry, or go elsewhere |
| **Permission refusal** | Plain statement of what is not available and under which context | Switch context if another has it |
| **Expired context** | Distinct from refusal: *it was yours, and lapsed* — staffing ended, relationship ended, role removed, school suspended | Sign in again, or choose a remaining context |
| **Support / elevation failure** | Explicit, in the elevated visual state, never silently downgraded to ordinary | Stated next step |

### 16.2 What an error may and may not say

**May:** what happened in plain English · what it does not mean · what to do next · a short opaque
reference for support · when it was last known good.

**May not:** stack traces · SQL · internal identifiers of other tenants · file paths · library names ·
secrets or tokens · anything that tells an unauthorised person that a record exists.

### 16.3 The support reference

A failure may carry a **short opaque reference** the user can quote. It is meaningless outside
ScholarShelf's own logs and reveals nothing about the system. That is the whole of the technical
detail an end user ever sees.

### 16.4 Feedback for success

Confirmation is proportionate: an inline state change for routine acts, a persistent statement for
business events (§35). **No celebratory motion or language on a financial or custody act.**

---

## 17. High-risk / destructive actions — seven tiers

| Tier | Acts | Presentation contract |
|---|---|---|
| **T0 Routine** | Filter, sort, navigate, edit a draft | No confirmation. Undo by doing it again |
| **T1 Operational commit** | Hand over · record collection · prepare · transfer custody · review a replacement | **Inline confirm** stating what will be recorded and about which child. Immediate, unmistakable feedback. No dialog on the teacher path — a dialog costs a tap that a person holding books cannot spare |
| **T2 Financially consequential** | Confirm settlement · reject a claim · discount · subsidy · waiver · school funding · refund · replacement charge | **Consequence statement** (what becomes true, for whom, for how much) **+ authority statement** (§18) **+ explicit confirm**. For **confirm settlement**, the statement names all three effects as one act (§35) |
| **T3 Historical correction** | Correct stock · correct settlement · correct a requirement · correct a historical record | **Before → after**, side by side, **+ a mandatory reason**. Framed as a *correction*, not a deletion; the original remains visible |
| **T4 Structural** | **Run rollover** · close a cycle · offboard staff · archive a child | **Full consequence statement, including an explicit "what will NOT change" block** (Stage 9 §17), **+ a review step for exceptions**. Never a single button on a settings page |
| **T5 Privacy / destructive** | **Erase an account** (CAP-036) | **Not in ordinary navigation at all.** Consequence statement, mandatory reason, **typed confirmation of the subject's name**, and an explicit statement of what is *retained* |
| **T6 Exceptional platform** | **Break-glass elevate · break-glass write · purge tenant** | **Elevated visual state** (§20) · reason required and displayed · consequence · time-box visible · a statement that the act is alerted and attributed. Never reachable from a routine list |

### 17.1 Rules across all tiers

- **No single generic red dialog.** The tier decides the presentation.
- **The confirm control names the act** — "Confirm settlement", "Run rollover", "Purge Saint Jude
  Academy" — never "OK", never "Yes".
- **The consequence is stated before the control**, always in that order.
- **Irreversibility is stated in words**, never implied by colour.
- **A reason field, where required, is required** — the control does not enable without it.

*Stage 16 owns security mechanics; Stage 19 owns audit. Stage 10 owns only what is seen.*

---

## 18. Finance-authority presentation — PA-1

### 18.1 What is locked

```
school_admin context + AUTH-FINANCE
  → the Money area appears
  → NO context switch
  → sensitive finance ACTS announce themselves as finance acts
  → finance READS do not
```

### 18.2 The contract

**F-1 · Placement — at the point of action, inside the commit surface.** Not a persistent banner, not
a shell badge, not a nav decoration. It appears where the decision is made and nowhere else.

**F-2 · Form — a statement, not a warning.** A short line inside the T2 consequence block:

```
CONFIRM SETTLEMENT — Amina Bello · September books · £48.50
This will confirm the settlement, allocate the copies and reduce stock.

Performed under finance authority, and recorded as such.
                                       [ Cancel ]  [ Confirm settlement ]
```

**F-3 · Treatment.** Neutral-emphasis, with a small consistent authority mark. **Not danger-coloured**
— confirming a legitimate settlement is not dangerous, it is authoritative. Danger colouring is
reserved for rejection and refund.

**F-4 · Reads are never framed.** Viewing a child's payable position on UX-019 carries no finance
framing. The administrator already holds that under AUTH-SCHOOL.

**F-5 · Identical for both holders.** A standalone `finance` officer and an administrator holding
AUTH-FINANCE see the *same* statement on the same act. The statement is about the **authority
exercised**, not about who the person is — which is exactly PA-1's separation.

**F-6 · Four prohibitions.**

```
✘ a "Finance mode" toggle, banner or shell state
✘ any suggestion that a context switch is needed or possible
✘ framing every financial READ as sensitive
✘ conflating role with authority in any label
```

### 18.3 Which acts carry it

CAP-047 · CAP-048 · CAP-049 · CAP-050 · CAP-051 · CAP-052 · CAP-053 · CAP-054 · CAP-070. No others.

---

## 19. Support-mode presentation — PA-2

### 19.1 What the operator must never wonder

> *Am I looking globally, or inside School A?*

### 19.2 The contract

**SM-1 · Persistent and unmistakable.** A support engagement is indicated on **every screen, at all
times**, in the identity strip's top-level position — not a toast, not a one-time notice.

**SM-2 · It names all three facts.**

```
╔════════════════════════════════════════════════════════════════════╗
║  SUPPORT ENGAGEMENT ACTIVE                                         ║
║  Saint Jude Academy · "Investigating duplicate payment references" ║
║  Started 14:05 · every action is recorded          [ End support ] ║
╚════════════════════════════════════════════════════════════════════╝
```

School · reason · that actions are recorded. The **End support** control is always present in it.

**SM-3 · A distinct treatment, not a semantic colour.** Support mode uses its own reserved
presentation — **not** danger (nothing is wrong) and **not** warning (nothing will go wrong). It is a
*state*, and it reads as one: a distinct band that displaces the ordinary identity strip.

**SM-4 · The school's own identity is subordinated.** Inside a support engagement, the school's name
appears **as the subject of the engagement**, and its branding does not dress the shell. The operator
must never be visually convinced they are a member of that school's staff.

**SM-5 · The scope is stated on data.** Screens inside the engagement state that they are scoped to
that one school, so a list is never mistaken for a platform-wide list.

**SM-6 · Account recovery is inside it.** PA-2 is locked: there is no recovery shortcut outside an
engagement, and therefore no presentation of one.

*Enforcement is Stage 13 and Stage 16. Stage 10 owns the visible state.*

---

## 20. Owner / break-glass presentation

### 20.1 The requirement

```
ORDINARY PLATFORM OPERATION   and   BREAK-GLASS OPERATION
must be impossible to confuse.
```

### 20.2 The contract

**E-1 · Separated in navigation.** The owner's **Exceptional operations** area is separated from
routine platform areas by a rule and a distinct treatment. It is never a peer item beside "Tenants".

**E-2 · Elevation is a visible mode.** While elevated authority is in force, the interface carries a
**persistent elevated state** — a distinct border treatment on the whole working region plus a
persistent statement. It cannot be dismissed.

**E-3 · Time is visible.** Elevation is time-boxed (Stage 7). The remaining time is **always on
screen**, not discoverable. An expiring elevation states that it is expiring.

**E-4 · Consequence in words.**

```
┌────────────────────────────────────────────────────────────┐
│ ELEVATED AUTHORITY IN FORCE · 11 minutes remaining         │
│ Reason: "Restoring a mis-linked guardian record"           │
│ Every action is recorded and alerted.                      │
└────────────────────────────────────────────────────────────┘

PURGE TENANT — Saint Jude Academy
  This permanently and irreversibly destroys this school's data.
  Cooldown elapsed: yes.   This cannot be undone by anyone, including you.

  Type the school's name to continue:  [                    ]
                                        [ Cancel ]  [ Purge ]
```

**E-5 · Danger hierarchy within T6.** Read-only elevated inspection < elevated write < purge. Purge is
the most emphatic presentation in the entire product, and nothing else is allowed to look like it.

**E-6 · Never routine.** No exceptional operation appears as a row action, a dashboard shortcut, a
bulk action, or a keyboard shortcut.

**E-7 · Ordinary platform work never borrows the treatment.** If elevation styling appears on routine
tenant administration, the signal is destroyed.

*Authentication and elevation mechanics are Stage 16.*

---

## 21. Teacher handheld-first contract — UXQ-1

### 21.1 The path being optimised

```
find child → verify books → record hand-over → move to next child
```

Everything below serves that loop. Applies to **UX-064 · UX-065 · UX-066 · UX-067 · UX-068 · UX-069 ·
UX-070**.

### 21.2 The contract

| Requirement | Value |
|---|---|
| **Design target** | XS (< 480px), portrait, one hand |
| **Minimum touch target** | **44 × 44 px**, at every width |
| **Spacing between frequent actions** | ≥ 12px |
| **Spacing between actions of different consequence** | ≥ 16px, and never equal weight — *Hand over* and *Report an exception* must never be adjacent equal buttons |
| **Primary action position** | **Persistent at the bottom of the viewport** on XS/SM — thumb-reachable, always visible, never requiring a scroll to the end of a list |
| **Taps to record a hand-over from the class list** | **≤ 2** (select child → confirm). No dialog, no intermediate page |
| **Text size** | Body-large (16 / 26) minimum; the child's name is the largest element on the screen |
| **Tables** | **None below MD.** The class list is a record list (DS-009) of one child per row: name, readiness, one action |
| **Hover** | **Nothing is hover-only, anywhere on this surface** — there is no hover on a phone |
| **Class progress** | Visible **without scrolling**, at all times: "18 of 24 handed over" |
| **Interruption** | Position in the class is preserved across background/foreground and reload. A teacher who is interrupted returns to the same child |
| **Confirmation feedback** | Immediate, in-place, unmistakable — the row changes state and states it. No toast that can be missed while looking at a child |
| **Repeated handling** | The next child is reachable **without returning to a menu**; the loop does not pass through the dashboard |
| **Offline / poor signal** | A failure is loud, local and retryable, and the hand-over is **not** shown as recorded (§15). School wifi is the assumption, not the exception |
| **Motion** | Minimal; nothing that delays the next tap (§24) |
| **Larger screens** | **Fully usable.** The layout gains width and shows more per row — it does not become a different product, and it does not become a table |

### 21.3 The own-child case

Stage 9 locked that the child remains visible with no action. Presentation: the row shows the child,
shows readiness, and **in place of the action** states *"Handled by the school office — you are
recorded as a guardian of this child."* Neutral treatment, not danger, not disabled-with-tooltip —
**there is no control at all**, and a tooltip on a phone is unreachable anyway.

---

## 22. Responsive contract by surface

### 22.1 Breakpoints

| Name | Range | Typical |
|---|---|---|
| **XS** | < 480px | Phone, portrait, one hand |
| **SM** | 480 – 767px | Large phone, phone landscape |
| **MD** | 768 – 1023px | Tablet |
| **LG** | 1024 – 1439px | Laptop |
| **XL** | ≥ 1440px | Office workstation |

**MD is set at 768px to match the shipped `useIsMobile` primitive** — the contract does not
gratuitously contradict a working boundary.

### 22.2 Per surface

| Surface | XS / SM | MD | LG / XL |
|---|---|---|---|
| **S-1 Entry & Account** | Single column, comfortable, primary action reachable without scrolling | Same, centred | Same, centred; never stretched full width |
| **S-2 Teacher** | **The design target.** §21 in full | Record list widens; still no tables; targets stay 44px | Wider rows, more per row. **Never becomes a table** |
| **S-2 School admin** | Functional but secondary. Navigation collapses; tables become record lists; one job per screen | Navigation collapses to a drawer; tables keep 3–4 columns | **The working surface.** Full shell, full tables, side panels available |
| **S-2 Finance** | Functional: child · payable · outstanding · status, detail behind the record. **Comparison preserved on the reconciling dimension** | Progressive disclosure — deciding columns kept, supporting columns dropped, never horizontally scrolled off | **The working surface.** Full tables, OPERATIONAL density, split view for claim-and-detail |
| **S-3 Family** | **Natural.** Single column, one child at a time, comfortable | Two-column child list | Centred, **max content width** — never a stretched dashboard |
| **S-4 CMS studio** | Viewing and light editing only; structural editing states it needs a larger screen rather than degrading badly | Editing workable, preview stacked | Editing plus side-by-side preview |
| **S-5 Public site** | Fully responsive; its own contract (§30) | | |
| **S-6 Platform** | Read and triage; diagnostics readable; exceptional operations **still fully guarded** (§20) | Tables at 3–4 columns | **The working surface.** Full diagnostics |

### 22.3 Rules that hold everywhere

- **No surface transforms identically to another.** The job decides.
- **Nothing essential is hover-only, at any width** — this is an accessibility rule, not a mobile one.
- **A narrow layout never becomes an endless vertical stack of cards.** Below MD, prioritisation and
  progressive disclosure are used instead — decide what matters, show that.
- **Text reflows to 320px CSS width without loss of content or function** (WCAG 1.4.10).
- **The primary action is reachable without horizontal scrolling at every width.**

---

## 23. Accessibility

**Baseline: WCAG 2.2 Level AA across the canonical design system, plus the named additions below.**
This is mandatory for every pattern, not a later polish stage. **Unchanged by DSQ-1 and DSQ-2** —
except that it is now verified against **one** appearance rather than two, which is precisely what
makes it holdable.

```
one supported appearance  →  light  →  WCAG 2.2 AA baseline
```

| Area | Requirement |
|---|---|
| **Text contrast** | ≥ **4.5:1** normal, ≥ **3:1** large (≥ 24px, or ≥ 19px bold). 1.4.3 |
| **Non-text contrast** | ≥ **3:1** for control boundaries, focus indicators, status pills, chart marks and icons carrying meaning. 1.4.11 — the shipped `--border-strong` (3.29:1) exists for exactly this |
| **Colour alone** | **Never** the only signal. 1.4.1 |
| **Keyboard** | Every action reachable and operable; no traps; a visible skip-to-content. 2.1.1, 2.1.2 |
| **Focus visible** | Always, with **its own token, never brand-derived** (§4.3, **C-52**), ≥ 3:1 against adjacent colours, and never clipped by overflow. 2.4.7, 2.4.11 |
| **Focus order** | Follows visual order; dialogs and drawers trap focus while open and **return it to the invoking control** on close. 2.4.3 |
| **Labels** | Every control has a programmatic name; the accessible name **starts with** the visible label. 2.5.3, 4.1.2 |
| **Target size** | ≥ **24 × 24** minimum with offset (2.5.8 AA); **≥ 44 × 44 on the teacher surface and below MD** — this contract exceeds AA there deliberately |
| **Error association** | Errors programmatically associated with their field, identified in text, with a suggestion. 3.3.1, 3.3.3 |
| **Status announcements** | Query states, submission outcomes and queue changes announced politely; errors assertively. 4.1.3 |
| **Reduced motion** | `prefers-reduced-motion` removes all non-essential motion. 2.3.3 |
| **Zoom / scaling** | Usable at **200% zoom** and at **320px** reflow width, with no loss of content or function. 1.4.4, 1.4.10 |
| **Text spacing** | No loss when a user overrides line-height, letter- and word-spacing. 1.4.12 |
| **Tables** | Real headers with scope, a caption or accessible name, sort state announced, no layout tables |
| **Dialogs** | Modal semantics, labelled, Escape closes, focus trapped and restored |
| **Forms** | Labels, grouping, required state, validation and errors all programmatic |
| **Language** | Page language declared — **and per-element language where a school's class vocabulary is not English** (§28) |
| **Motion-free path** | Every task completable with all motion disabled |

**The branding accessibility rule** [LOCKED DSQ-2]**:** a school's chosen colour **can never** break:

```
text contrast · focus contrast · disabled state
semantic state · action hierarchy
```

Where a chosen colour cannot meet contrast in a permitted identity role, the system uses it as an
accent instead. And because the canonical **primary action is not brand-derived**, it meets its own
contrast requirements **independently of tenant branding** — one verification, held in every school.

Today no such check exists anywhere (**C-53**).

---

## 24. Motion

**Motion is subtle, purposeful, non-blocking, and removable.**

| Legitimate | Duration |
|---|---|
| State change on a record (a row becoming handed-over) | ≤ 150ms |
| Drawer / dialog entry and exit | ≤ 200ms |
| Progress and loading indication | continuous, low-amplitude |
| Focus movement | instant; never animated |

**Forbidden:** decorative motion · celebratory animation on financial or custody acts · anything that
delays a control becoming operable · parallax · attention-seeking loops · motion that reflows a list a
user is about to tap.

**Teacher rule:** on UX-064…UX-070, motion never sits between a tap and its effect. The next child is
tappable immediately.

**`prefers-reduced-motion` removes all of it**, and every task remains completable.

---

## 25. Iconography

| Rule | |
|---|---|
| **Icon alone** | Only where the meaning is universal *and* the control has an accessible name *and* it is not a consequential action. Close, search, filter, menu, back |
| **Label mandatory** | **Every consequential action.** Hand over · confirm · reject · refund · correct · rollover · erase · purge. **A teacher must never decode an icon while handing books to a child** |
| **Meaning stability** | One icon, one meaning, product-wide. An icon never means two things in two contexts |
| **Destructive symbols** | Reserved. Never used decoratively |
| **Status symbols** | Accompany the word; never replace it (§14.3) |
| **Navigation** | Icon **plus** label at all widths. A collapsed navigation shows labels on focus and hover, and is not the only way to reach anything |
| **Decorative icons** | Hidden from assistive technology |

**Canonical source: deferred.** Choosing an icon library is an implementation dependency, not a
presentation contract — **Stage 13**. What Stage 10 fixes is the *rules*, a single consistent line
weight and optical size, and that **exactly one** icon system is used product-wide. Two systems are
currently declared (**C-54**).

---

## 26. UK formatting contract — C-33

**D-01 locks ScholarShelf to the UK.** There is no internationalisation. Everything below is pinned to
**en-GB / GBP**, and the shipped `format.ts` already implements most of it — it is adopted as the
canonical contract.

### 26.1 Money

| Case | Presentation |
|---|---|
| Standard | **`£48.50`** |
| Grouped | **`£1,234.50`** — thousands separated |
| Zero | **`£0.00`** — never "0", "—", "free" or blank |
| Decimals | **Always exactly two.** Trailing zeros always shown |
| Negative / refund | **`−£12.00`** with a true minus sign, **plus a textual qualifier** ("Refunded") — a minus sign alone is too easy to miss on a money screen |
| Credit balance | `£12.00 in credit` — words, not a bare negative |
| Alignment | **Right-aligned, tabular figures**, in every table and every comparison |
| Bare number | Two decimals, no symbol — inputs and exports only |

**`£0.00` is only ever shown for a successful query.** On failure, §15.

### 26.2 Dates

| Case | Presentation |
|---|---|
| Standard | **`12 Mar 2026`** — unambiguous, which numeric UK/US forms are not |
| Dense tables and date inputs | **`12/03/2026`** — only where the long form cannot fit, and only within a column whose header makes the format clear |
| With time | **`12 Mar 2026, 14:05`** — 24-hour |
| Historical timestamp | Full form with time, and **never** relative |
| Relative | Permitted **only** for recent, non-consequential activity ("2 hours ago"), never for a financial, custody or audit fact |
| Absent | **`—`** |

**Rule:** anything a person may be asked to reconcile, audit or dispute is shown in the unambiguous
long form.

### 26.3 Time

24-hour, `14:05`. School-local. Times are never shown without their date on a historical record.

### 26.4 Numbers

Thousands separated (`1,204 copies`). Quantities are integers with no decimals. Percentages to at most
one decimal, always with the base stated ("18 of 24").

### 26.5 Academic periods

**`2026/27`** — four-digit start, two-digit end, forward slash, no spaces. Everywhere: headings,
tables, selectors, exports and communications. Never `2026-2027`, never `2026/2027`, never `26/27`.

### 26.6 Telephone and postcode

Displayed **as captured**, with UK postcodes shown in their conventional upper-case spaced form where
the stored value permits. **No validation rules are invented here** — Stage 15 owns representation.

### 26.7 Names and identifiers

Payment references and codes: **monospace**, preserving case, never auto-capitalised, and selectable in
one action — a bursar copies them into a bank statement.

---

## 27. Terminology register — UXQ-2

**One concept, one name per audience.** Audiences may differ in precision; they may never contradict.
The Stage 6 domain names are architecture and appear in **no** interface.

| Concept (domain) | Parent / family | School admin | Teacher | Finance | Never |
|---|---|---|---|---|---|
| DM-020 Child | *your child* · the child's name | **Child** | **Child** | **Child** | "Student record", "pupil ID", "subject" |
| DM-022 Family · DM-010 Guardian | *your family* | **Family** · **Guardian** | **Family** | **Family** | "Account holder", "customer", "payer" |
| DM-023 Book-supply cycle | **Books for 2026/27** | **Books for the year** | — | **The child's year** | **"Cycle"**, "Book-supply cycle", "Basket", "Order" |
| DM-024 Requirement item | **September books** · **Additional January book** | **Book requirement** | *what this child is due* | **Requirement** | **"Requirement Item"**, "Order", "Invoice", "Line item" |
| DM-025 Requirement line | *the books* · titles | **Books in this requirement** | **Books** | **Items** | "SKUs", "products" |
| Settlement position | **Payment needed** / **Paid — settled** | **Outstanding** / **Settled** | — | **Outstanding** / **Settled** | "Balance due", "invoice status", "Complete" |
| CAP-046 Payment claim | **Tell the school you have paid** | **Payment claim** | — | **Claim** | "Payment" (a claim is not a payment) |
| DM-036 Payment reference | **Your payment reference** | **Reference** | — | **Reference** | "Transaction ID", "order number" |
| DM-034 Funding adjustment | **Help with the cost** | **Funding** | — | **Funding adjustment** | "Credit", "voucher" |
| Discount | **Reduced by the school** | **Discount** | — | **Discount** | "Coupon", "promo" |
| Subsidy | **Help with the cost** | **Subsidy** | — | **Subsidy** | "Grant" |
| School-funded | **Paid by the school** | **School-funded** | — | **School-funded** | "Comp", "free" |
| Waiver | **The school has waived this** | **Waived** | — | **Waived** | "Written off", "cancelled" |
| CAP-060 Preparation | *being got ready* | **Preparation** | — | — | "Picking", "packing", "fulfilment" (to families) |
| DM-043 Hand-over | **Received** | **Hand-over** | **Hand over** | — | "Delivered", "Distributed", "Complete" |
| CAP-064 Reception collection | **Collect from the school office** | **Collection** | — | — | "Pickup", "Will call" |
| DM-039 Fulfilment route | **How you would like the books** — *collect from the office* / *given out in class* | **Route** | — | — | "Delivery method", "shipping" |
| Previous periods | **Previous years** | **Previous years** | **Previous classes** | **Previous years** | "Archive", "History dump" |
| DM-045 Replacement | **Replacement book** | **Replacement** | **Replacement** | **Replacement charge** | "Extra copy", "reorder" |
| DM-047 Correction | *corrected by the school* | **Correction** | — | **Correction** | "Edit", "Adjustment", "Fix" |
| DM-011 Staff · DM-019 Class staffing | — | **Staff** · **Class staffing** | *my classes* | — | "Users", "Assignments", "Employees" |
| DM-004 School policy | — | **School policy** | — | **School policy** | "Settings", "Config", "Preferences" |
| DM-006 Support engagement | — | — | — | — | **Support engagement** (platform only). Never "impersonation", never "login as" |
| Academic period | **2026/27** | **2026/27** | **2026/27** | **2026/27** | "School year 26-27", "AY2026" |

### 27.1 Three enforcement rules

**T-1 · A concept never acquires a fifth name.** New wording for an existing concept is a change to
this register, not a screen-level choice.

**T-2 · Precision may increase toward finance; meaning may not change.** "Payment needed" and
"Outstanding" are the same fact at two levels of formality. "Complete" and "Settled" are not.

**T-3 · No architecture words, ever.** `Cycle`, `Requirement Item`, `Allocation`, `Custody event`,
`DM-nnn`, `CAP-nnn` appear in no interface, in no export, and in no email.

---

## 28. School / class vocabulary — C-1 presentation

### 28.1 The problem, precisely

ScholarShelf serves UK mainstream **and** supplementary/weekend schools (D-01). The shipped
`formatYearGroup` does not merely display a year group — it **rewrites the school's own vocabulary
into UK year groups**: `"Grade 4" → "Year 4"`, `"4" → "Year 4"`, `"R" → "Reception"`.

A supplementary school that calls its groups *Level 4* or *تمهيدي* is being told what its classes are
called by the software.

### 28.2 The contract

**V-1 · The interface renders the school's configured terminology, verbatim.** Whatever a school
called a class or level is what every screen shows — administrator, teacher, parent, finance,
communications and exports alike.

**V-2 · No normalisation, no translation, no inference.** The presentation layer never maps one
vocabulary onto another and never derives a year group from a number.

**V-3 · UK year groups are a default, not a vocabulary.** A new mainstream school may be *offered*
Reception / Year 1–13 as a starting point during setup. Once configured, it is that school's
vocabulary like any other.

**V-4 · Sorting is by the school's configured order, not by parsing the label.** "Level 10" must not
sort before "Level 2" because a string sort says so.

**V-5 · Non-Latin scripts are first-class.** Class labels may be in any script, including
right-to-left. They are rendered with the correct element-level language and direction, must not be
transliterated, and must not break table alignment.

**V-6 · Nothing hard-codes the words.** No filter chip, no export header, no email template, no
selector contains a literal "Year" that is not part of a school's configured label.

**Legitimate examples, all equally valid:** `Year 3` · `Level 4` · `Beginner` · `تمهيدي` · `Class A` ·
`Upper Sixth` · `Group 2`.

**Stage 15 still owns representation.** Stage 10 resolves only what is displayed.

---

## 29. History presentation — C-49

### 29.1 What the user must never mistake

A closed period must never look like editable current state.

### 29.2 The contract

**H-1 · Persistent historical context.** Any view of a closed period carries a **persistent
indicator** (DS-028) naming the period and stating it is closed — in the page header region, present
at every scroll position.

```
┌─────────────────────────────────────────────────────────────┐
│ VIEWING 2025/26 · CLOSED PERIOD · read-only                 │
│ Corrections to a closed period are recorded as corrections. │
│                                    [ Return to 2026/27 ]    │
└─────────────────────────────────────────────────────────────┘
```

**H-2 · A distinct, muted surface treatment.** Historical content is visibly a different surface from
current operational content — recessive, not decorative, and never colour alone (the indicator's words
carry it).

**H-3 · No editing affordances.** Not disabled controls — **absent** controls. The only act available
is a correction (T3), and it is labelled as a correction.

**H-4 · Values render as they were.** Amounts, class labels, year-group vocabulary and status words
are shown in the period's own terms, not re-expressed in this year's. A class called "Year 3 Blue" in
2025/26 stays "Year 3 Blue" even if the school has since renamed it.

**H-5 · Corrections are visible as corrections.** Shown adjacent to what they corrected, with
attribution and date, never as a silently different value (DM-047).

**H-6 · The period is always named.** No screen says "last year". Every historical figure carries its
period.

**H-7 · Reachable from the record.** The child record and the family's child view both offer previous
years in place; the archive is not the only route.

---

## 30. CMS / public website boundary

### 30.1 The wall

```
CORE DESIGN SYSTEM          →  the ScholarShelf operational application (S-1, S-2, S-3, S-6)
                               canonical, not configurable beyond §3.3

WEBSITE-SPECIFIC THEME      →  the public school site (S-5) only
                               broader school-specific presentation
```

### 30.2 Rules

**W-1 · The CMS studio is an operational tool.** S-4 uses the **canonical** design system in full —
canonical navigation, density, forms, query states, accessibility — even while editing a site that
looks nothing like it.

**W-2 · Edited content is always framed.** The site's own styling appears only inside a clearly
bounded preview region that reads as *content being edited*. It never dresses the studio's chrome,
controls or state presentation.

**W-3 · No leakage into Core.** A website theme cannot change any operational colour, spacing, layout
rule, status presentation, query state or accessibility behaviour. There is no shared theme channel.

**W-4 · The public site has its own contract.** Responsive, accessible to the same WCAG 2.2 AA
baseline, and rendering **published content only** — but it is not bound to Core's density, layout or
navigation rules, because it is a school's website, not an application.

**W-5 · Fails safely to empty.** An unpublished or absent site renders as nothing. It never errors in
a way that reveals the tenant exists.

**W-6 · No path into Core** beyond an ordinary sign-in link.

---

## 31. Pattern catalogue

Stable **presentation-pattern identifiers**. These are design patterns, **not React components**, and
no filename, package or component structure is implied. Stage 13 owns physical structure.

Each pattern is specified as: *Purpose · Used by · Visual hierarchy · Interaction · Responsive ·
Accessibility · States · Must not.*

### Shell and wayfinding

**DS-001 · Application shell** — the frame every authenticated screen sits in. *Used by:* all
surfaces. *Hierarchy:* identity strip → navigation → page region. *Responsive:* navigation collapses
to a drawer below MD; identity strip and context indicator never collapse. *Accessibility:*
skip-to-content, landmark regions, keyboard-reachable navigation. *States:* ordinary · support
engagement (§19) · elevated authority (§20) · historical context (§29). *Must not:* hide the active
context at any width; let branding alter its structure.

**DS-002 · Primary navigation** — the context's work areas. *Used by:* all authenticated surfaces.
*Interaction:* active by fill **and** weight. *Responsive:* drawer below MD; icon+label always.
*Accessibility:* current item programmatically marked; targets ≥ 44px below MD. *Must not:* show
un-entitled modules; show unauthorised areas disabled; exceed nine items.

**DS-003 · Secondary navigation** — within one work area. *Must not:* become a second full menu.

**DS-004 · Context indicator** — states the active context and the school it is pinned to. *Used by:*
every authenticated screen. *Interaction:* opens the context chooser where more than one exists.
*Must not:* offer a "finance" switch (PA-1); disappear at any width.

**DS-005 · Page header** — one H1, one scope line, one action bar. *Must not:* carry two competing
titles or more than one primary action.

**DS-006 · Action bar** — the screen's actions. *Hierarchy:* one primary, then secondary, then
overflow. *Responsive:* the primary is persistent and thumb-reachable below SM on the teacher surface
(§21). *Must not:* present three primaries.

**DS-007 · Filter bar** — applied filters as removable tokens, always visible. *Must not:* allow a
filtered result to read as a real empty (§15.5).

### Data

**DS-008 · Data table** — §12 in full. *States:* all four query states resolve inside the table with
headers retained. *Must not:* be hover-only for row actions; horizontally scroll the deciding column
off screen.

**DS-009 · Record list** — the narrow-screen replacement for a table, and the teacher's class list.
*Hierarchy:* identity → deciding value → status → one action. *Accessibility:* each row is a labelled
region; targets ≥ 44px. *Must not:* become decorative cards; drop the deciding value.

**DS-010 · Work queue** — items needing a decision by this person. *Hierarchy:* subject → what is
being decided → the decision. *Interaction:* the decision is reachable from the row. *States:* an
empty queue is a **real zero** and says so plainly. *Must not:* mix information-only items with
action-required items (§31 of Stage 9); manufacture urgency.

**DS-011 · Record summary** — a compact identity-plus-key-facts block. *Used by:* family home, child
record, tenant record. *Must not:* carry a status it computed itself.

**DS-012 · Record detail surface** — §7.3 and §33. *Hierarchy:* **IDENTITY → CURRENT FACTS → HISTORY →
ACTIONS**. *Must not:* imply the page owns the facts; exceed five primary regions.

**DS-013 · Section panel** — a titled region within a detail surface, stating what it is a view of.

**DS-014 · Side panel / drawer** — a related record or focused sub-task. *Accessibility:* focus
trapped, Escape closes, focus restored. *Must not:* carry a primary workflow on a handheld.

**DS-015 · Dialog** — a blocking decision. *Accessibility:* modal semantics, labelled, focus trapped
and restored. *Must not:* appear on the teacher hand-over path (§21).

### Input

**DS-016 · Form** — §11. *States:* clean · dirty · submitting · failed (values preserved).

**DS-017 · Field** — §11.2. *Accessibility:* label, help, error all programmatically associated.
*Must not:* use a placeholder as its label.

**DS-018 · Multi-step workflow** — visible position, reversible, reviewable before commit. *Used by:*
setup, import, rollover, invitation.

**DS-019 · Button / action** — §10's seven levels.

**DS-020 · Consequence confirmation** — the T1–T6 surfaces (§17). *Hierarchy:* consequence → authority
(where applicable) → reason (where required) → controls. *Must not:* be one generic red dialog;
enable the control before a required reason exists.

### State

**DS-021 · Status indicator** — §14. *Must not:* invent a status; use colour alone; drop the word.

**DS-022 · Query state** — §15's four states. *Must not:* on ERROR, render any number, currency value,
count, or reassuring absence.

**DS-023 · Inline feedback** — the outcome of an act, in place. *Accessibility:* announced politely,
assertively on failure. *Must not:* be the only record of a consequential outcome; be celebratory on a
financial or custody act.

**DS-024 · Page banner** — a persistent page-level condition. *Used by:* stale data, closed period,
degraded state.

**DS-025 · Finance-authority indicator** — §18. *Must not:* be a shell badge, a mode, or danger-
coloured.

**DS-026 · Support-engagement indicator** — §19. Persistent, names school and reason, carries the exit.

**DS-027 · Elevated-authority indicator** — §20. Persistent, shows remaining time, cannot be dismissed.

**DS-028 · Historical-context indicator** — §29. Persistent, names the period, states read-only.

**DS-029 · Notification item** — the durable notification record (DM-051). *Must not:* present a
delivery outcome as the notification (§36).

**DS-030 · Empty / zero panel** — the distinct EMPTY and REAL ZERO presentations. *Must not:* be
reachable from a failure or from an active filter.

### Values and identity

**DS-031 · Teacher hand-over card** — the row-level unit of §21. *Hierarchy:* child's name largest →
readiness → one action. *Interaction:* ≤ 2 taps to record. *Must not:* be hover-dependent; show money;
present an override where CD-5 blocks.

**DS-032 · Progress meter** — "18 of 24 handed over". *Accessibility:* the numbers are text, not only a
bar. *Must not:* imply completion of a business state it does not own.

**DS-033 · Money value** — §26.1. Tabular, right-aligned, two decimals, refunds signed **and** worded.

**DS-034 · Date / time value** — §26.2–26.3. Long form for anything reconcilable.

**DS-035 · School identity mark** — logo and name. *Must not:* appear in the platform band; dress the
shell during a support engagement.

---

## 32. Surface → design traceability

| Surface | Density | Breakpoint target | Branding | Bands and indicators | Notable rules |
|---|---|---|---|---|---|
| **S-1 Entry & Account** | COMFORTABLE | Every width; single column | School mark where the school is known; otherwise ScholarShelf | DS-004 after sign-in | Never discloses whether an address exists (§16.2) |
| **S-2 School admin** | STANDARD (OPERATIONAL inside tables) | **LG/XL primary**, functional below | Full §3.3 | DS-004; DS-025 on T2 acts; DS-028 on history | Nine work areas; Money area only with AUTH-FINANCE |
| **S-2 Finance** | **OPERATIONAL** | **LG/XL primary**, comparison preserved below | Full §3.3 | DS-004; **DS-025 on every T2 act** | Three data bands (Stage 9 §7.3); tables not cards |
| **S-2 Teacher** | **COMFORTABLE** | **XS primary** (§21) | Full §3.3 | DS-004 | 44px targets · no tables · no hover · ≤ 2 taps |
| **S-3 Family** | COMFORTABLE | **XS/SM natural**, max width at XL | The school of **each child**, per child | DS-004 | Child-first navigation; no tenant pin; no commerce language |
| **S-4 CMS studio** | STANDARD | MD+ for structural editing | Canonical system; edited content framed | — | §30's wall |
| **S-5 Public site** | Own contract | All | Broad, school-specific | — | Published only; fails safely to empty |
| **S-6 Platform** | OPERATIONAL | LG/XL primary | **No school identity** | DS-026 support · DS-027 elevation | Exceptional operations separated (§20) |

---

## 33. High-risk capability → presentation traceability

| Capability | Tier | Pattern | Presentation requirements |
|---|---|---|---|
| **CAP-049 confirm settlement** | **T2** | DS-020 + DS-025 | Consequence naming **all three effects as one act** · finance-authority statement · explicit confirm · **no partial success ever shown** (§35) |
| **CAP-050 reject settlement** | **T2** | DS-020 + DS-025 | Destructive treatment · states the family will be told · reason |
| **CAP-051 discount / subsidy** | T2 | DS-020 + DS-025 | Amount, child, what becomes payable afterwards · finance statement |
| **CAP-052 waiver / school funding** | T2 | DS-020 + DS-025 | As CAP-051; states the school bears the value |
| **CAP-053 correct settlement** | **T3** | DS-020 | **Before → after** · mandatory reason · framed as correction, not deletion |
| **CAP-054 issue refund** | **T2** | DS-020 + DS-025 | Destructive treatment · amount and recipient · **`−£12.00` plus the word "Refund"** (§26.1) |
| **CAP-070 replacement charge** | T2 | DS-020 + DS-025 | States that a chargeable outcome creates a new requirement the family will be told about |
| **CAP-012 correct stock** | **T3** | DS-020 | Before → after quantities · mandatory reason |
| **CAP-043 correct requirement** | T3 | DS-020 | Before → after · mandatory reason |
| **CAP-063 record hand-over** | **T1** | DS-031 | Inline, ≤ 2 taps, immediate in-place feedback · **no dialog** · absent (not disabled) where CD-5 blocks |
| **CAP-064 reception collection** | T1 | DS-020 (inline) | Names the child **and the authorised recipient** before recording |
| **CAP-061 transfer custody to teacher** | T1 | DS-020 | Names the receiving teacher and the count; only actively-staffed teachers offerable |
| **CAP-005 run rollover** | **T4** | DS-018 + DS-020 | Full consequence **plus an explicit "what will NOT change" block** · exception review step · never one button |
| **CAP-044 close cycle** | T4 | DS-020 | Consequence · what remains readable |
| **CAP-035 offboard staff** | T4 | DS-020 | States plainly what is **preserved** — the account, the guardian relationship, all history |
| **CAP-036 erase account** | **T5** | DS-020 | **Not in ordinary navigation** · typed confirmation of the subject's name · mandatory reason · states what is retained |
| **CAP-086 enter support mode** | T1 | DS-026 | Names school and reason before entry; the indicator persists thereafter |
| **CAP-090 elevate break-glass** | **T6** | DS-027 | Elevated state · reason · time-box visible · alerted |
| **CAP-091 break-glass write** | **T6** | DS-020 + DS-027 | Consequence · irreversibility in words · inside the elevated state only |
| **CAP-092 purge tenant** | **T6** | DS-020 + DS-027 | **The most emphatic presentation in the product** · typed school name · cooldown stated · "cannot be undone by anyone, including you" |

---

## 34. Query-danger screen → contract traceability

Every screen Stage 9 §29 named is covered in **§15.6**, with the specific render each must never
produce on failure: UX-045 · UX-046 · UX-063 · UX-054 · UX-076 · UX-032 · UX-018 · UX-065 · UX-037 ·
UX-038 · UX-040 · UX-067 · UX-072 · UX-071 · UX-089 · UX-090. **Sixteen screens, all covered.**

**The single rule they share:** on ERROR — **no number, no currency value, no count, no reassuring
absence.**

---

## 35. Confirmations and feedback

### 35.1 The five outcomes

| Outcome | Presentation |
|---|---|
| **Accepted** | The control states it is working; the form stays intact |
| **Completed** | The affected record visibly changes state **in place**, and states what happened. For T2–T6, a persistent statement, not only a transient one |
| **Failed** | Inline, values preserved, retry available, and **the record is not shown as changed** |
| **Pending** | Only where the domain genuinely has a pending state — a submitted claim awaiting finance. Rendered with the **pending** semantic (§4.3), never warning |
| **Background delivery pending** | The notification exists; its delivery has not completed (§36) |

### 35.2 Atomicity — I-2

Confirming settlement is **one business act** across MOD-007, MOD-008 and MOD-005 (MA-1).

```
SUCCESS   →  the entire act succeeded
FAILURE   →  NOTHING happened
```

**Three prohibitions:**

- Never present allocation or stock deduction as independently successful.
- Never show a progress sequence implying three separable steps.
- Never leave a screen in a state a user could read as "settled but not allocated".

On failure the wording is explicit: **"Nothing has been changed."** Where stock could not cover the
requirement (WF-044) or another confirmation won the race (WF-045), the screen says which, and still
says nothing was changed.

### 35.3 Partial outcomes where the domain does allow them

Import (WF-021) legitimately produces accepted and rejected rows. That is a **real** partial outcome
and is presented as one: counts, the rejected rows, and what to do. The contract forbids **inventing**
partial success, not reporting genuine partial results.

---

## 36. Notification vs delivery presentation

Stage 8's distinction, preserved visually:

```
NOTIFICATION TRUTH        a product fact — this person is owed this message   MOD-009
      ≠
DELIVERY ATTEMPT          a transport result — the email left or did not      MOD-015
```

| | Where it appears | Presentation |
|---|---|---|
| **Notification** | DS-029, in the recipient's notification centre (UX-007) | The message, its subject, when it arose. **Its existence does not depend on delivery** |
| **Delivery outcome** | Internal only — UX-093 | An infrastructure fact, in the platform band |

**Rules:**
- A **failed delivery never removes or hides the notification.** Under WF-071 the notification may be
  telling a family they now owe money.
- A school's notification list **never shows delivery diagnostics**.
- A delivery failure that matters operationally surfaces as a **platform** concern, not as a school's
  error.
- Reporting never generates a notification (I-10).

---

## 37. Current presentation audit

Read directly from the working tree. **Evidence, not authority. Nothing is deleted, and nothing is
selected — Stage 22 owns selection.**

| Current pattern | Classification | Finding |
|---|---|---|
| **Semantic `--success` / `--warning` tokens with documented contrast** (5.18:1, 5.13:1) | **USEFUL FOUNDATION** | Correct approach, verified ratios, adopted by this contract |
| **`--border` 2.09:1 and `--border-strong` 3.29:1** | **USEFUL FOUNDATION** | The 1.4.11 case is already understood and solved. Adopted |
| **`--input` fixed from pure-white to 3.29:1** | **USEFUL FOUNDATION** | Form controls previously had no visible boundary. Adopted |
| **`client/src/lib/format.ts`** (en-GB, GBP, 24-hour, unambiguous dates) | **USEFUL FOUNDATION** | Adopted as the canonical formatting contract (§26) |
| **`client/src/components/query-state.tsx`** | **USEFUL FOUNDATION, ZERO ADOPTION** | Its wording is adopted verbatim (§15.3). **See the correction below** |
| **`formatYearGroup` rewriting "Grade 4" → "Year 4"** | **MISLEADING** | Actively overrides a school's own vocabulary. **C-1**, resolved at presentation by §28 |
| **Two token systems in one `@theme` block** — shadcn HSL tokens *and* Material 3 hex tokens | **DUPLICATED** | Two design languages coexist with no rule for which wins. **C-54** |
| **Two icon systems** — `lucide-react` in 39 of 42 page files, plus a `material-symbols-outlined` CSS class | **DUPLICATED** | One canonical system required. **C-54** |
| **`--ring` (focus) overwritten by school branding** | **ACCESSIBILITY PROBLEM** | The focus indicator becomes the school's colour, unvalidated. **C-52** |
| **`--primary` set from brand hex with no contrast check and no paired foreground** | **ACCESSIBILITY PROBLEM + BOUNDARY VIOLATION** | A pale brand colour yields white-on-pale text on every primary button. **And under DSQ-2 the primary-action token is not brand-addressable at all**, so this violates the locked boundary as well as contrast. **C-53** |
| **`.dark` palette fully maintained but never activated** | **LEGACY — OUTSIDE THE TARGET CONTRACT** | No provider sets the class; `next-themes` is imported only by the toaster. The dark `--primary` has also drifted to a different hue from light. **DSQ-1 decided light-only**, so this palette is now explicitly outside the contract. **C-55**, open in implementation. **Not removed by Stage 10** |
| **Page titles at `text-3xl` / `font-bold`** | **PARTIALLY ALIGNED** | Contract sets 24 / 600 (§5.2) |
| **`--font-heading` aliased to `--font-sans`** | **ALIGNED** | Made deliberate by §5.1 |
| **Button sizes `min-h-9` / `min-h-8` / `h-9 w-9`** | **RESPONSIVE / ACCESSIBILITY PROBLEM** | 36px and 32px, below the 44px this contract requires on the teacher path and below MD (§6.4) |
| **20 raw `toFixed(2)` money renders · 20 raw locale date calls** | **INCONSISTENT** | `format.ts` is imported by 14 files. **C-33**, contract set by §26 |
| **`describeApiError` used by 4 page files** | **PARTIALLY ALIGNED** | accept-invite · owner · register · reset-password. Four of forty-two |
| **`useIsMobile` — a single 768px boundary** | **PARTIALLY ALIGNED** | The only responsive primitive. §22.1 keeps 768 as MD and adds the rest |
| **Hover-only reveals** (`opacity-0 group-hover:opacity-100`) in families, sidebar, toast | **ACCESSIBILITY PROBLEM** | Unreachable on touch; §12.2 and §22.3 forbid it |
| **`:focus-visible` outline 2px + 2px offset, globally** | **USEFUL FOUNDATION** | Correct approach — undermined only by C-52's brand-coloured ring |
| **Four dashboard generations + ~40 Stitch mockups in two to three generations** | **DUPLICATED** | Purposes fixed by Stage 9 §20; presentation contract by §9. **Selection remains Stage 22** |
| **Three generations of `scholarshelf_DESIGN.md` + a handoff PDF** | **DUPLICATED** | Documentation has the same generations problem as the UI |
| **Material Symbols + Inter + JetBrains Mono declared** | **PARTIALLY ALIGNED** | Inter and a monospace are adopted; the icon font is part of **C-54** |

### 37.1 A correction to a previously recorded figure

**Stages 0, 3 and 9 recorded that `query-state.tsx` was "adopted by 2 of 42 page files".** Verified
directly in this session: the only file in `client/src` that references `QueryState` is
**`query-state.tsx` itself**. Adoption is **0 of 42**, not 2 of 42.

`describeApiError` is used by **4** page files, not 6 — the figure 6 counted `query-state.tsx` and
`lib/errors.ts` alongside them.

**C-32 is therefore worse than previously recorded**, and this document states the corrected figures
rather than repeating the earlier ones. The earlier documents are LOCKED and are not edited; the
correction is recorded here, openly, at the stage that verified it.

---

## 38. C-1 presentation resolution

**Resolved at the presentation level by §28.** The interface renders each school's configured
class/level terminology verbatim — no normalisation, no translation, no inference, no hard-coded
"Year" anywhere, school-configured sort order, and full support for non-Latin and right-to-left
labels. UK year groups become a setup-time default, not the product's vocabulary.

**Not resolved:** representation and schema. **Stage 15.** The shipped `formatYearGroup` remains as it
is until Stage 13/22 apply the contract.

---

## 39. C-31 presentation resolution

**Conceptually resolved.** Stage 9 fixed each dashboard's *purpose*; §9 fixes the *presentation
contract* every surviving dashboard must obey — shared hierarchy, action-before-information, shared
spacing and density by role, shared query-state behaviour, an emphasis budget of one, composition-only
figures, and the explicit prohibition on a KPI wall.

**Not resolved:** which of the four dashboard generations becomes the built screen. **Stage 22.**

---

## 40. C-32 presentation resolution

**Conceptually resolved, and Stage 10 is the owning stage.** §15 defines the four states, their visual
treatment, wording, indicators, action availability, retry, prior-data and stale-data handling, and
what each must never show; §15.5 keeps filters from manufacturing empties; §15.6 maps all sixteen
Stage 9 §29 danger screens to the render each must never produce.

**Not resolved — and worse than recorded.** Adoption is **0 of 42** page files (§37.1), not 2. **Stage
13 owns physical adoption**; no `QueryState` component is designed here.

---

## 41. C-33 presentation resolution

**Conceptually resolved.** §26 sets one canonical UK contract: money (`£48.50`, `£1,234.50`, `£0.00`,
always two decimals, `−£12.00` **plus the word "Refund"**, right-aligned tabular figures), dates
(`12 Mar 2026`; `12/03/2026` only in dense columns; `12 Mar 2026, 14:05`; relative time banned on
financial, custody and audit facts), 24-hour time, thousands separators, and academic periods as
**`2026/27`** everywhere.

**Not resolved:** 20 raw money renders and 20 raw date calls remain outside `format.ts`, which is
imported by 14 files. **Stage 13 owns adoption; Stage 22 owns selection.**

---

## 42. C-48 presentation resolution

**Resolved at the design-language level.** §27's register and §29's history rules give the family
experience its cycle-shaped language and hierarchy:

```
CHILD
 → BOOKS FOR 2026/27
   → September books          Paid / settled
   → Additional January book  Payment needed
 → Previous years ▸
```

Each requirement carries its **own** settlement state and its own presentation; there is no blended
family total that hides which child needs what, and no `Requirement Item`, `Basket`, `Cart`, `Order` or
`Checkout` anywhere in the register.

**Not resolved in code.** `parent.tsx` is still organised as *Baskets* and *Payments*. **C-48 remains
an open implementation conflict** — Stage 13 and Stage 22.

---

## 43. Conflicts carried forward

### 43.1 Resolved conceptually by Stage 10

| # | Resolution | Still unresolved |
|---|---|---|
| **C-1** | §28 — school-configured vocabulary rendered verbatim | **Yes** — representation, Stage 15 |
| **C-31** | §9 — one presentation contract for every surviving dashboard | **Yes** — selection, Stage 22 |
| **C-32** | §15 — the full four-state contract, all sixteen danger screens mapped | **Yes** — adoption is **0 of 42**, Stage 13 |
| **C-33** | §26 — one canonical UK formatting contract | **Yes** — 20 + 20 raw renders remain, Stage 13/22 |
| **C-48** | §27, §29, §42 — cycle-shaped family language and hierarchy | **Yes** — `parent.tsx` still order-shaped, Stage 13/22 |

**A presentation contract is not an implementation.** Every row above is **conceptually resolved /
implementation open** — each remains open in the repository.

### 43.1.1 Register status at lock — stable identifiers, nothing renumbered

```
C-47   WITHDRAWN / NOT APPLICABLE
        historical identifier preserved

C-48   CONCEPTUALLY RESOLVED / IMPLEMENTATION OPEN
        target presentation resolved

C-52   OPEN
        branding currently owns focus incorrectly

C-53   OPEN
        branding implementation violates the identity-only
        boundary and lacks contrast validation

C-54   OPEN
        duplicate token / icon systems

C-55   OPEN IN IMPLEMENTATION
        target decision now resolved:
        dark appearance is not supported
```

**No identifier was renumbered, reused or deleted.** No repository code has changed.

### 43.2 Given a presentation treatment, but owned elsewhere

| # | What Stage 10 contributes |
|---|---|
| **C-5** | §3.5, §30 — the Core/CMS wall as a presentation rule. Structural split: Stage 12/13/15 |
| **C-11** | §27 — canonical names for cash, instalments, discount, subsidy, school-funded and waived, so the missing routes arrive with settled language. Stage 15 |
| **C-13 / C-50** | §18 — the finance-authority presentation PA-1 requires. Authority-keyed navigation: Stage 13 |
| **C-39 / C-51** | §10.2, §33 — distinct treatments for the teacher's request, the administrator's review and finance's charge decision, so no single "Approve" is natural. Stage 15 |
| **C-44 / C-10** | §4.6, §32 — the platform band is visually unmistakable. Physical separation: Stage 13 |
| **C-45** | §9 D-3, §14 S-2 — dashboards compose, never compute; Reporting may not label. Stage 12/15 |
| **C-46** | §36 — notification and delivery presented differently. Durable record: Stage 15 |
| **C-49** | §29 — the full historical-context presentation. Period-scoped reads: Stage 15 |
| **C-12** | §17 T5 — erasure is out of ordinary navigation. Process: Stage 16 |
| **C-14 / C-15** | §27, §35 — expiry and lapse read as expected events, not failures. Stage 15/16 |
| **C-36** | §27 — "How you would like the books" as the family's route language. Stage 15 |
| **C-37** | §27, §42 — requirement-level language and per-requirement settlement. Stage 15 |
| **C-24** | §3.3 — communication identity is logo and name, which §26 and Stage 17 must deliver without base64 embedding |

### 43.3 Untouched by Stage 10

**C-2 · C-3 · C-4 · C-6 · C-7 · C-9 · C-17 · C-18 · C-19 · C-20 · C-22 · C-23 · C-25 · C-26 · C-27 ·
C-28 · C-29 · C-30 · C-35 · C-38 · C-40 · C-41 · C-42 · C-43** — unchanged, with the owners earlier
stages assigned. (C-2 was resolved conceptually at Stage 9; Stage 10 adds nothing to it beyond the
settlement wording already covered by §27.)
**C-47** remains **WITHDRAWN / NOT APPLICABLE**, and is not reopened, reused or renumbered.

---

## 44. New conflicts

Existing identifiers run through **C-51**, with **C-47 retained but withdrawn**. New conflicts
continue at **C-52**.

---

### C-52 — **OPEN** · School branding overwrites the focus indicator

**Conflict.** `applyBrandingToDocument` sets `--ring` — the global focus-visible outline colour — to
the school's primary brand colour, with no validation of any kind.

**Current behaviour.**
```
root.style.setProperty("--primary", hsl);
root.style.setProperty("--ring", hsl);     ← the focus indicator
```
A school whose brand colour is pale yellow, light grey or near-white gets a focus indicator that is
effectively invisible against the `#f7f9fb` background — across the entire product, for every keyboard
user, on every control.

**Target presentation contract.** §3.4 B-2 and §4.3: **focus has its own token, unreachable by
branding**, meeting ≥ 3:1 against both the background and any adjacent fill. Brand colour feeds
identity tokens only.

**Why it matters.** Focus visibility is WCAG 2.4.7 and 2.4.11, and it is the *only* thing a keyboard
user has. This is not a theming preference — a school can currently make the product unusable for a
keyboard user without knowing it, and without any warning.

**Reinforced by DSQ-2.**

```
focus
→ canonical design-system token
→ NEVER school-brand derived
```

**Status: OPEN — implementation.** The target is decided; the code still takes the focus indicator.
**Not implementation-resolved.**

**Later owning stage.** **Stage 13** (the branding application boundary). Stage 10 owns the rule.

---

### C-53 — **OPEN** · Brand colours are unvalidated, and brand colour becomes the product primary

**Conflict.** `--primary`, `--secondary` and `--accent` are set from the school's hex values with no
contrast check anywhere in client or server, and **without setting the matching `-foreground`
tokens**.

**Current behaviour.** `--primary-foreground` stays white. A school choosing a pale primary gets
white-on-pale text on every primary button, every active navigation pill and every selected control —
potentially near 1:1. `server/branding.ts` validates image bytes rigorously and colours not at all.

**Target presentation contract** — **narrowed by DSQ-2:**

```
C-53 target:

brand colour is validated for the limited identity surfaces
where it is permitted to appear;

brand colour does NOT become the canonical application
primary-action colour.
```

The contrast rule still applies **wherever brand colour is displayed**:

```
brand colour behind text
→ system chooses a contrast-safe foreground

unsafe fill
→ colour used as an accent rather than a text-bearing fill
```

**A school can never configure itself into unreadable text.**

**DSQ-2 substantially narrows the work.** Because the primary-action token is no longer
brand-addressable at all (§3.4.3 B-4), brand colour never sits behind the product's most critical
label — so validation applies to a small, bounded set of identity surfaces rather than to every
primary control in the product.

**Why it matters.** WCAG 1.4.3, invisibly to the person who chose the colour — and, since DSQ-2, a
violation of the locked identity-only boundary as well.

**Status: OPEN — implementation.** The current implementation violates both halves of the target: it
lets brand colour become the product primary, and it validates nothing. **Not
implementation-resolved.**

**Later owning stage.** **Stage 13** owns the physical branding boundary, with validation surfaced at
UX-012. Stage 10 owns the rule.

---

### C-54 — **OPEN** · Two token systems and two icon systems coexist with no rule for which wins

**Conflict.** `index.css` declares shadcn HSL semantic tokens **and** a block of Material 3 hex tokens
(`--color-primary-container`, `--color-surface-container-*`, `--color-outline`, `--color-error-container`
and others) in the same `@theme` block. Separately, `lucide-react` is used in **39 of 42** page files
while a `material-symbols-outlined` icon-font class is defined in CSS.

**Current behaviour.** Two design languages are declared side by side. Nothing states which is
canonical, so a new screen can legitimately be built from either, and two screens can be "correct" and
visually unrelated. The same is true of icons.

**Target presentation contract.** **Exactly one** token system and **exactly one** icon system,
product-wide (§4, §25). The tokens this contract adopts are the semantic set in §4.3; the icon system
is deferred to Stage 13 as an implementation dependency, but the *rule* that there is only one is
fixed here.

**Why it matters.** This is how the four dashboard generations happened. A design system with two
vocabularies does not prevent drift — it licenses it.

**Status: OPEN — implementation.** **Stage 10 does not select which physical implementation
survives**, and does not pick an icon system. Only the rule that there is exactly one of each is fixed
here.

**Later owning stage.** **Stage 13** determines the canonical physical component and token
architecture; **Stage 22** handles migration and removal.

---

### C-55 — **OPEN IN IMPLEMENTATION, TARGET DECIDED** · A dark theme is maintained, unreachable, and drifted

**Conflict.** `index.css` carries a complete `.dark` palette with per-token contrast annotations, and
`@custom-variant dark` is declared. **Nothing in the application ever sets the `dark` class.**
`next-themes` is imported by exactly one file — the toaster — and no provider exists.

**Current behaviour.** Dark styles are written, reviewed and maintained on every change, and can never
be seen. Worse, the two palettes have **diverged**: light `--primary` is deep navy `217 62% 9%`, dark
`--primary` is indigo `243 80% 66%` — a different hue, so the two themes are not the same product's
two appearances.

**Target — DECIDED by DSQ-1:**

```
C-55 target:
LIGHT ONLY
```

Dark appearance is **not supported** by this rebuild, and the `.dark` palette is **outside the target
contract**. The rule that leaves no third state:

```
SUPPORTED APPEARANCE      UNSUPPORTED APPEARANCE
→ reachable               → not maintained as dead
→ deliberately designed     parallel design code
→ accessibility verified
→ maintained
```

**Why it matters.** Unreachable code that every change must keep consistent is a permanent tax with no
benefit, and the drift means the "dark mode" that would appear if it were ever switched on is not the
product anyone designed.

**Status: OPEN IN IMPLEMENTATION — target decision resolved.** The palette is still in the codebase
and still maintained. **Not implementation-resolved, and nothing is deleted by Stage 10.**

**Later owning stage.** **Stage 13** applies the canonical light-only token and application
architecture where appropriate; **Stage 22** handles safe removal of the obsolete dark implementation
during migration and cleanup.

---

## 45. Owner decisions — all **DECIDED**

```
DSQ-1 — DECIDED A

ScholarShelf supports light appearance only for this rebuild.
The existing unreachable dark palette is outside the product contract.
Future dark mode requires a new deliberate, fully verified design contract.


DSQ-2 — DECIDED A

School brand colour is restricted to identity surfaces.
The canonical ScholarShelf primary action remains ScholarShelf navy.
School branding may never override product semantics,
focus, query states, support state or elevated authority.
```

**Zero Stage 10 owner questions remain open.**

---

### DSQ-1 — DECIDED A · Light appearance only for this rebuild

**The decision.** ScholarShelf's canonical operational application supports **light appearance only**
for this rebuild. Dark mode is **not** part of the Stage 10 design contract.

This does **not** mean ScholarShelf can never support dark mode. It means dark mode is not a supported
appearance in the current rebuild, **and must not be maintained as if it were.**

**The owner's reasoning.** The current code contains a dark palette that cannot be activated by the
application, has no appearance provider, has already drifted from the light palette, and requires
maintenance while providing no user-facing capability.

**The rule that leaves no third state:**

```
SUPPORTED APPEARANCE      UNSUPPORTED APPEARANCE
→ reachable               → not maintained as dead
→ deliberately designed     parallel design code
→ accessibility verified
→ maintained
```

*Applied in* §1 (**DS-P11**, new principle, and the locked appearance statement) · **§4.0** (the
appearance contract) · §23 (one appearance to verify against) · §37 (audit row reclassified) · §44
(**C-55** target decided) · §46 (later-stage ownership).

*Consequence for C-55.* **C-55 remains a real, open implementation conflict** — the palette is still
in the code and still maintained. Stage 10 resolves only the *product decision*: **light only**.
**Stage 13** applies the canonical light-only architecture where appropriate; **Stage 22** handles safe
removal during migration and cleanup. **No code is deleted at Stage 10.**

*Not decided:* nothing about the future. A dark appearance may be introduced later **only** as a new,
deliberate, fully designed and accessibility-verified contract — not by reviving the drifted palette.

---

### DSQ-2 — DECIDED A · School branding is identity-only

**The decision.** School brand colour may appear on **identity surfaces**. It may **not** appear on the
canonical primary-action language of ScholarShelf.

```
THE SCHOOL OWNS ITS IDENTITY.

SCHOLARSHELF OWNS ACTION MEANING.
```

```
School A — red identity      [ Confirm settlement ] → ScholarShelf navy
School B — green identity    [ Confirm settlement ] → ScholarShelf navy
School C — purple identity   [ Confirm settlement ] → ScholarShelf navy
```

**School-controlled branding:** school name · school logo · favicon · primary identity colour ·
secondary/accent identity colour · communication identity.

**Brand colour may be used for:** identity strip · school identity mark · active navigation ·
selected-state indication · section accents · school-facing communications · the public website, per
the separate CMS contract.

**Brand colour may not control:** primary action buttons · danger · warning · success · information ·
pending · disabled · focus · financial-risk presentation · support engagement · elevated / break-glass
state · query states.

**Primary actions must not become brand-coloured.** This applies to all ordinary primary actions
throughout Core, and especially to consequential ones — *confirm settlement · hand over books ·
transfer custody · prepare books* and every other permitted operational act. Their consequence tiers
may add finance, destructive or elevated framing per §10, §17, §18 and §20; **branding must not
override those meanings.**

*Applied in* §1 (**DS-P12**, new principle, and the locked core rule) · **§3.4** (the boundary, now
final, with §3.4.1 the core rule, §3.4.2 the four separated categories, §3.4.3 the four enforcing
rules including **B-4**, and **§3.4.4 the appearance-and-branding matrix**) · §4.1, §4.2, §4.5 (the
primary token is not brand-addressable) · §10.1 and §10.2 (the primary action looks the same in every
school) · §23 (the branding accessibility rule) · §37 (audit row reclassified as a boundary violation)
· §44 (**C-53** target narrowed).

*Consequence for C-53.* Narrowed, not resolved: brand colour is validated for the limited identity
surfaces where it is permitted, and **does not become the canonical primary-action colour**. The
contrast rule still applies wherever brand colour is displayed. **C-53 is not implementation-resolved
— Stage 13 owns the physical branding boundary.**

*Consequence for C-52.* Reinforced: **focus is a canonical design-system token, never school-brand
derived.** **C-52 is not implementation-resolved.**

*Unchanged.* The optional CMS and public website remain a separate presentation concern. The public
school website may carry broader school-specific website styling under the CMS contract (§30), and
**DSQ-2 does not restrict it.** The CMS studio itself continues to use the canonical ScholarShelf
operational design system.

---

## 46. What Stage 10 deliberately does not decide

| Not decided | Owner |
|---|---|
| React component trees · shared components · component filenames · folders · packages · imports · hooks · state management | **Stage 13** |
| Physical adoption of the query-state contract across all pages (**C-32**) | **Stage 13** |
| Physical adoption of the formatting contract (**C-33**) | **Stage 13** |
| The physical branding boundary that fixes **C-52** and **C-53** — including making the primary-action token non-brand-addressable | **Stage 13** |
| **Which token system and which icon system survive** (**C-54**) — Stage 10 fixes only that there is exactly one of each | **Stage 13**, migration **Stage 22** |
| **Safe removal of the obsolete dark implementation** (**C-55**) — the product decision is made (light only); nothing is deleted here | **Stage 13** applies light-only architecture · **Stage 22** removes |
| Authority-keyed rather than role-keyed navigation (**C-40**, **C-50**) | **Stage 13** |
| Physical separation of the internal band (**C-44**) | **Stage 13** |
| Frontend and backend routes · URLs | **Stage 13 / 14** |
| API endpoints · request and response contracts | **Stage 14** |
| Tables · columns · keys · indexes · representation of class/level vocabulary (**C-1**), fulfilment route, requirement item, durable notification | **Stage 15** |
| Permission enforcement · session · elevation mechanics · account erasure process | **Stage 16** |
| Email and document template implementation | **Stage 17** |
| Audit mechanics behind the attribution this contract displays | **Stage 19** |
| **Which existing implementation or mockup becomes the built screen** | **Stage 22** |
| Migration order and sequencing | **Stage 22** |

---

## 47. Success criteria — answered

```
Can School A and School B look recognisably different?
  → Yes: name, logo, favicon, identity strip, active navigation, selected
    states, section accents, communications. Within §3.3's bounded list.

Can they have completely different app layouts?
  → No. Navigation architecture, interaction patterns, hierarchy, density,
    semantics, states and accessibility are canonical and not configurable.

What does ERROR look like compared with EMPTY?
  → ERROR: danger-bordered panel, role="alert", "Could not load <thing>.
    This is not a sign that there is nothing to show.", retry offered,
    AND NO NUMBER OF ANY KIND.
    EMPTY: neutral muted panel, "No <things> yet.", plus how one comes to
    exist, plus the creating action. Never produced by a failure or a filter.

Can failed finance data display £0?
  → No. §15.6 names all sixteen screens where that would be dangerous.

How is money formatted?
  → £48.50 · £1,234.50 · £0.00 · always two decimals · −£12.00 with the word
    "Refund" · right-aligned tabular figures.

How is an academic year displayed?
  → 2026/27. Everywhere. Never 2026-2027, 2026/2027 or 26/27.

Can class terminology be "Level 4" rather than "Year 4"?
  → Yes. The school's configured vocabulary is rendered verbatim, in any
    script, with no normalisation and no hard-coded "Year" anywhere.

Does teacher handheld-first now have actual responsive rules?
  → Yes. XS is the design target; breakpoints at 480/768/1024/1440.

What is the minimum interaction/touch contract for teacher?
  → 44 × 44px targets · ≥12px between frequent actions · ≥16px between
    actions of different consequence · persistent thumb-reachable primary ·
    ≤ 2 taps to record a hand-over · no tables · no hover · no dialogs ·
    progress always visible · position preserved across interruption.

Does finance use the same density as parent?
  → No. Finance is OPERATIONAL (40px rows) because reconciliation is
    comparison. Parent is COMFORTABLE (56px+) because it is occasional,
    consequential, and mixed-device.

How does an admin know an action is using AUTH-FINANCE?
  → A statement inside the confirmation surface: "Performed under finance
    authority, and recorded as such." Neutral, at the point of action, on
    the nine T2 capabilities only. No mode, no banner, no switch, no
    framing of reads.

How does a platform admin know Support Mode is active?
  → A persistent band displacing the identity strip on every screen, naming
    the school, the reason, the start time, and carrying "End support". The
    school's branding does not dress the shell.

How does owner elevation look different from ordinary platform work?
  → A persistent elevated state on the whole working region, remaining time
    always on screen, reason displayed, and a separated Exceptional
    operations area. Purge carries the most emphatic presentation in the
    product and requires the school's name typed.

Can school branding redefine danger/success colours?
  → No. Semantic tokens are a closed set, unreachable by brand input — and
    that includes focus, disabled, and every query state.

Does the family UI call things Requirement Item / Order?
  → No. "Books for 2026/27", "September books", "Additional January book".

Can a historic year look like editable current state?
  → No. Persistent period indicator, recessive surface, ABSENT (not
    disabled) editing controls, and values rendered in the period's own terms.

Can CMS website styling leak into Core?
  → No. There is no shared theme channel, and the CMS studio itself uses the
    canonical system.

Has any React component been designed?
  → No. DS-001…DS-035 are presentation patterns. No filename, package or
    component structure is implied.

Has any implementation been selected?
  → No. Stage 22 owns selection.
```

---

## 48. Summary

1. **One supported appearance — light** [LOCKED DSQ-1]. System dark preference is not honoured; the
   unreachable `.dark` palette is outside the contract and is not maintained as though supported.
2. **The school owns its identity; ScholarShelf owns action meaning** [LOCKED DSQ-2]. Brand colour
   reaches identity surfaces only.
3. **The canonical primary action is ScholarShelf navy in every school** — not brand-addressable, and
   meeting its contrast requirements independently of any tenant's branding.
4. **Visual direction fixed on five explicit dimensions**, each defined by interface behaviour, with
   seven directions explicitly rejected.
5. **A final branding boundary**, stated as a core rule, four separated categories, four enforcing
   rules and an explicit matrix — so Stage 13 cannot reinterpret it.
6. **Semantic tokens are a closed set unreachable by branding** — success, warning, danger, info,
   pending, disabled and focus, plus the reserved system states.
7. **`info` and `pending` added**, because without them everything non-success becomes a warning.
8. **Typography: one family, eleven roles, 24/600 page titles, 700 never used**, 12px absolute floor.
9. **Three density families assigned by job** — OPERATIONAL, STANDARD, COMFORTABLE.
10. **Five breakpoints (480 / 768 / 1024 / 1440)** with per-surface behaviour.
11. **The teacher handheld contract is unchanged and specific**: 44px targets, ≤ 2 taps, persistent
    thumb-reachable primary, no tables, no hover, no dialogs, visible progress, preserved position.
12. **The query-state contract is complete** — four states across seven dimensions, all sixteen Stage 9
    danger screens mapped to the render each must never produce.
13. **Seven consequence tiers**, from routine to purge, with no single generic red dialog.
14. **Finance authority is a statement at the point of action** — nine capabilities, neutral, no mode.
15. **Support mode and elevation are persistent, unmissable, and cannot be dismissed.**
16. **UK formatting is canonical and specific**, including `2026/27` and signed-and-worded refunds.
17. **A terminology register covering 24 concepts across four audiences.**
18. **WCAG 2.2 AA baseline unchanged**, now verified against one appearance rather than two.
19. **35 presentation patterns, DS-001…DS-035** — patterns, not components, contiguous.
20. **C-1, C-31, C-32, C-33 and C-48 conceptually resolved / implementation open** — none marked
    code-resolved.
21. **C-52 OPEN · C-53 OPEN · C-54 OPEN · C-55 OPEN IN IMPLEMENTATION with its target decided.**
    **C-47 stays WITHDRAWN.** No identifier renumbered, reused or deleted.
22. **The correction to C-32 stands as recorded:** `query-state.tsx` adoption is **0 of 42**, not 2 of
    42; `describeApiError` is used by **4** page files, not 6. The earlier locked documents are
    preserved unedited; the correction is recorded here, at the stage that verified it.
23. **Owner questions: zero open.** DSQ-1 DECIDED A · DSQ-2 DECIDED A.
24. **No code, no CSS, no components, no folders, no API, no schema, no permission change, no dark-mode
    removal, no token or branding implementation change, no icon system selected, and no implementation
    selected for migration.**

```
STAGE 10 — DESIGN SYSTEM & PRESENTATION CONTRACT
STATUS: LOCKED
Locked: 25 August 2026 by the owner (BytHub Technology Ltd)

STOP BEFORE STAGE 11
```
