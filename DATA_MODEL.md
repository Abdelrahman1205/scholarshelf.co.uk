# DATA_MODEL.md — Stage 6: Conceptual Data Model

```
STAGE 6 — DATA MODEL
STATUS: LOCKED
Locked: 23 August 2026 by the owner (BytHub Technology Ltd)
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` — all LOCKED. A later stage that finds a conflict **flags it**; it does not change the
model.

## Owner decisions recorded at lock (OD-1 … OD-3)

*Recorded as Stage 6 decisions. Earlier stages are not rewritten to imply these were known sooner.*

| ID | Decision | Effect on this model |
|---|---|---|
| **OD-1** | **A single money event MAY be applied across multiple requirement items — including items belonging to several siblings.** The money event, the *application* of that money, and the derived settlement position are three different things and must not be conflated. Settlement position remains **derived, never independently writable**. | DM-033 stays a money event. **New DM-057 · Payment application** carries the money-to-item link. DM-035 is unchanged and remains derived. |
| **OD-2** | **Academic periods are SCHOOL-OWNED.** Each school defines its own labels, boundaries and rollover. ScholarShelf may offer sensible defaults or templates; the platform imposes no universal academic calendar. | **Confirms DM-016** as a school-owned entity. Rollover is a per-school ritual. Defaults/templates are a Stage 9/15 convenience, not a constraint. |
| **OD-3** | **One active class membership per child** within an academic period. The supplementary/community-school case is **not** a multi-membership case: the child keeps one main class; the *class* may have several teachers; a Quran teacher may be staffed to several classes; staffing may optionally be subject-specific. | **Confirms DM-021** (single active membership) and **DM-019** (many staffings per class, one person staffed to many classes, optional subject). Shared subject teachers MUST NOT be reinterpreted as extra memberships for the child. |

**This document models real-world concepts, not tables.** No SQL, no migrations, no ORM, no keys, no
column types. Stage 15 turns this into a physical database.

**The discipline applied to every candidate entity:**

1. What real-world thing is this?
2. Does it have an identity of its own?
3. Does it have a lifecycle of its own?
4. Must its history survive changes elsewhere?
5. Is it an entity, or actually a property, a state, or an event?
6. Does current code split one real concept across several tables?
7. Does current code combine several real concepts into one table?

**A recurring answer.** Several things the current schema stores as a *mutable status* are, in the
real world, an **event that happened**. An event cannot be "changed" — only followed by another
event. Where that is true this document says so, because it is the difference between a system that
can answer "what happened in September" and one that cannot.

---

## Reading an entity record

```
DM-nnn · Name — OWNERSHIP
  Purpose · Identity · Attributes (conceptual) · Relationships · Lifecycle
  History · BR · WF · Today · Gap · Stages
```

**OWNERSHIP** — `PLATFORM` · `SCHOOL` · `FAMILY/ACCOUNT` · `CYCLE` · `SYSTEM`

---

# A · Platform and tenancy

**DM-001 · School** — PLATFORM
*Purpose* The customer. One tenant. *Identity* Stable from creation; survives renaming and rebranding.
*Attributes* legal/display name · status in its lifecycle · setup progress · the sector it operates in
(mainstream / supplementary).
*Relationships* `SCHOOL 1 → MANY` children, classes, staff, catalogue, cycles.
*Lifecycle* created by BytHub → pending setup → active → suspended / archived → pending deletion →
purged after cooldown.
*History* Its status history matters — "was this school suspended in March?" is an audit question.
*BR* 001, 004, 007, 008, 033 · *WF* 001, 003, 005 · *Today* `schools`, maps cleanly.
*Stages* 15.

**DM-002 · School code** — PLATFORM
*Purpose* The short human-usable identifier through which tenant identity and configuration are
resolved. *Is it an entity?* **No — an attribute of the school**, but a distinctive one: it is the
resolution key for public routes and for sign-in.
*Constraint* unique across the platform, stable once issued (changing it breaks links families hold).
*BR* 033 · *WF* 064 · *Today* `schools.code`. *Stages* 15.

**DM-003 · School identity** — SCHOOL
*Purpose* How ScholarShelf looks and reads *as that school* — dashboards, portal, transactional email.
*Identity* one per school. *Attributes* logo · colours · visual identity · permitted presentation
customisation · email/communication identity.
*Ownership note* **[US-02] This is CORE**, not part of the CMS module. The CMS *consumes* it.
*Lifecycle* created with the school; edited; may be reset to defaults.
*BR* 034, 035, 036 · *WF* 002 · *Today* `school_branding` — but currently fused with website styling
(**C-5**). *Stages* 8, 12, 15.

**DM-004 · School policy** — SCHOOL
*Purpose* The per-school choices four locked decisions assume: finance authority overlap [US-05] ·
finance's child-data visibility [US-07] · permitted presentation customisation [US-02] · any future
configurable rule (e.g. dual authorisation, BR-041).
*Is it an entity?* **Yes — one deliberate concept, not several settings bolted on.** It has its own
lifecycle, must be audited when changed, and will grow.
*History* Changes must be attributable — "who allowed admins to confirm payments, and when?"
*BR* 037, 038, 041, 122 · *WF* 002 · *Today* **nothing** (**C-17**). *Stages* 7, 15.

**DM-005 · Site configuration** — SCHOOL *(CMS module)*
*Purpose* Website-specific presentation: theme choices, page styling, site assets. **Consumes** DM-003
rather than duplicating it. *Relationships* `SCHOOL 1 → 1` site configuration; `1 → MANY` sections and
media. *BR* 035 · *WF* 062–064 · *Today* mixed into `school_branding` + `school_website_sections`.
*Stages* 8, 12.

**DM-006 · Support engagement** — PLATFORM
*Purpose* A bounded period during which a BytHub operator acts inside one named tenant.
*Is it an entity?* **Yes** — it has a start, an end, an actor, a subject school, and everything done
inside it must be attributable to it.
*Attributes* operator · school · started · ended · reason.
*BR* 008, 121 · *WF* 004 · *Today* session fields only — no record of the engagement itself.
*Gap* the engagement is invisible after the session ends. *Stages* 16, 19.

---

# B · People and access

> **The distinction Stage 2 locked (US-01) and Stage 6 must preserve:**
> ```
> PERSON ACCOUNT  ≠  GUARDIAN RECORD        (school's record of a responsible adult)
> PERSON ACCOUNT  ≠  STAFF PROFILE          (school's record of a member of staff)
> ```
> An account is **platform-level identity**. A guardian record and a staff profile are
> **school-owned relationship records**. Each side can exist without the other.

**DM-007 · Person account** — PLATFORM
*Purpose* A login identity. *Identity* stable across role changes, school changes and name changes.
*Attributes* credentials · contact identity (email, username) · account status (active, disabled) ·
second-factor enrolment.
*Relationships* `ACCOUNT 0..1 → 1` school *(staff)*; `ACCOUNT 0 → n` guardian records; `ACCOUNT 0 → n`
staff profiles.
*Lifecycle* created by invitation or self-registration → active → **disabled** (the normal leaver
action, US-04) → erased only by a privacy process.
*History* The account's actions remain attributable after it is disabled. **Disabling must not orphan
anything.**
*BR* 010, 011, 012, 016, 018, 019, 020, 021, 022 · *WF* 007, 009, 016 · *Today* `users` — which also
carries `schoolId` and `role`, conflating identity with relationship. *Stages* 7, 15.

**DM-008 · Role grant** — SCHOOL
*Purpose* An explicit statement that this account holds this role, here.
*Is it an entity?* **Yes**, and it should stop being a string in a general-purpose permissions table.
*Attributes* account · school · role · granted by · granted at · revoked at.
*Relationships* `ACCOUNT 1 → MANY` role grants.
*BR* 013, 014, 017 · *WF* 008 · *Today* `users.role` (primary) **plus** `SECONDARY_ROLE:<x>` strings in
`user_permissions`, which also carries branding grants and a test flag (**C-23**) — **three concepts in
one table**. *Stages* 7, 15.

**DM-009 · Access context** — SYSTEM · **derived, not stored**
*Purpose* The set of roles an account may currently act as. *Why derived* it is the union of explicit
grants (DM-008), **current** class staffing (DM-019) and **current** guardian relationships (DM-014).
Storing it would immediately drift from those three.
*BR* 013, 014 · *WF* — · *Today* computed at sign-in — correct, and to be preserved conceptually.

**DM-010 · Guardian record** — SCHOOL
*Purpose* The school's record of an adult responsible for a child. **Exists independently of any
login.** *Identity* stable within the school; survives the account being disabled or erased.
*Attributes* name · relationship to the child · contact details · primary-contact flag · portal access
status (none / invited / active) · optional link to an account.
*Relationships* `FAMILY 1 → MANY` guardians; `GUARDIAN 0..1 → 1` account; `GUARDIAN 1 → MANY` children
*(via the family)*.
*History* **Must survive** deletion of the account (US-01 case 5).
*BR* 010, 025 · *WF* 014, 015, 018 · *Today* `guardians` — already the right shape.
*Stages* 15, 16.

**DM-011 · Staff profile** — SCHOOL
*Purpose* The school's record of a member of staff — the counterpart to DM-010. *Attributes* role
context · department · subjects · created by · start and end of service.
*Note* Today only *teacher* profiles exist. The concept generalises: a finance officer's tenure is the
same kind of fact.
*BR* 011, 021 · *WF* 006, 009, 010 · *Today* `teacher_profiles`. *Stages* 15.

**DM-012 · Invitation** — SCHOOL
*Purpose* A time-limited, single-use offer to create or extend access. *Attributes* email · intended
role · issuing school · issuer · expiry · status · optional family link and relationship (the
staff-who-is-also-a-parent case).
*Lifecycle* issued → accepted / expired / revoked. **Never reusable.**
*History* invite history survives the issuer's account being removed.
*BR* 023, 026 · *WF* 001, 006, 007 · *Today* `invites`, maps cleanly. *Stages* 15, 16.

**DM-013 · Linking code** — SCHOOL
*Purpose* The only route from an account to a child. *Attributes* code · bound email · target child or
family · expiry · single-use marker · redemption record.
*Lifecycle* issued → previewed *(no state change)* → redeemed → dead. Rotation kills the old one.
*History* who redeemed it and when is an audit fact.
*BR* 104–108 · *WF* 015, 017, 023 · *Today* `child_linking_codes`, maps cleanly. *Stages* 15, 16.

**DM-014 · Guardian–child relationship** — SCHOOL
*Purpose* The confirmed link between a responsible adult and a child. **This is what scopes a parent
account** — not a tenant. *Attributes* guardian · child · relationship · confirmed at · ended at.
*History* Ending a relationship must not erase what the guardian could see and do while it held.
*BR* 003, 010, 014, 025 · *WF* 017, 018, 027 · *Today* `parent_children` **keyed on an email string**,
plus `family_students` — **one concept in two places**, and the email key is why deleting an account
must clean up claims (BR-024). *Stages* 15, 16.

**DM-015 · Session** — SYSTEM
*Purpose* An authenticated period of access. *Attributes* account · active context · tenant scope ·
support engagement if any · expiry.
*Note* Lifetime varies by role by design — staff 8 h, teacher 24 h, family 30 days.
*BR* 001, 002, 007, 013, 028, 029 · *Today* `user_sessions`. *Stages* 16.

---

# C · Academic structure

**DM-016 · Academic period** — SCHOOL
*Purpose* The year a cycle belongs to. *Is it a value or an entity?* **An entity, owned by the school.**
Reasoning: D-01 serves both mainstream and supplementary schools, whose years do not start and end
alike; D-07 requires an explicit rollover with a boundary; and reports must be able to say *which*
year without parsing a string. A bare `"2026/27"` cannot carry a start date, an end date, or a state.
*Attributes* label · start · end · state (future / current / closed).
*Relationships* `SCHOOL 1 → MANY` periods; `PERIOD 1 → MANY` cycles.
*Lifecycle* created (usually by rollover) → current → closed. **A closed period is not edited.**
*History* Closing a period is the moment history becomes immutable in meaning (BR-045).
*BR* 044–048 · *WF* 028 · *Today* a free-text `academicYear` on six tables (**C-9**).
*Stages* 15.

**DM-017 · Class** — SCHOOL
*Purpose* A teaching group. *Attributes* name · the school's own level/year label · period · status.
*Note* **[D-01] The level vocabulary belongs to the school**, not to a fixed UK ladder (**C-1**).
*Relationships* `SCHOOL 1 → MANY` classes; `CLASS 1 → MANY` memberships, staffings, requirements.
*BR* 040, 057, 059 · *WF* 002, 028 · *Today* `classes`, plus a legacy `teacherId` that duplicates
DM-019, and overlapping `status`/`isArchived`. *Stages* 15.

**DM-018 · Subject** — SCHOOL
*Purpose* What is taught, where staffing is by subject rather than by form. *Note* Small, but real for
supplementary schools — the code's own example is a shared Quran teacher.
*Today* `subjects` (create/list/delete, no update). *Stages* 15.

**DM-019 · Class staffing** — SCHOOL
*Purpose* The assignment of a person to a class **for a period of time**. *Is it an entity?* **Yes** —
US-10 requires start and end, and expiry must remove access without anyone acting.
*Attributes* class · person · optional subject · **start** · **end** · granted by.
*Relationships* `CLASS 1 → MANY` staffings; `PERSON 1 → MANY` staffings.
*Lifecycle* granted → active → expired or revoked. **Expiry is a fact, not a cleanup job.**
*History* What a cover teacher recorded while assigned stays valid after expiry.
*BR* 051, 052, 053, 054 · *WF* 011, 012, 013 · *Today* **two** models — `classes.teacherId` and
`class_teacher_assignments` — neither time-bounded (**C-14**). *Stages* 7, 15.

**DM-020 · Child** — SCHOOL
*Purpose* The pupil. Not a user (D-09). *Identity* stable across class moves, year changes and name
changes. *Attributes* name · date of birth · the school's own identifiers · status (active / inactive /
alumni) · photo where the school holds one.
*Note* **The child's class is NOT an attribute of the child** — see DM-021. That single mutable
pointer is the root of **C-9**.
*Relationships* `SCHOOL 1 → MANY` children; `CHILD 1 → MANY` memberships, cycles, guardian
relationships.
*BR* 006, 030, 049 · *WF* 024, 027 · *Today* `students`, carrying `classId`. *Stages* 15.

**DM-021 · Class membership** — SCHOOL
*Purpose* **Which class a child was in, and when.** *Is it an entity?* **Yes, and it is the single most
important structural change Stage 6 proposes.**
*Reasoning* D-07 forbids a later year rewriting an earlier one. A March class move must not change
where the child was in September. A mutable pointer on the child cannot express that; a membership
with a start and an end can.
*Attributes* child · class · period · start · end · reason for ending.
*Relationships* `CHILD 1 → MANY` memberships over time; **within one period, normally exactly one
active membership** — but see **OD-3** in §13.
*History* **Immutable once ended.** Reports resolve a child's class *as at a date*.
*BR* 045, 046, 048, 049 · *WF* 026, 028 · *Today* **nothing** — `students.classId` (**C-9**).
*Stages* 15.

**DM-022 · Family** — SCHOOL
*Purpose* The household grouping that lets siblings be enrolled, invited and settled together.
*Attributes* family name/reference · primary contact.
*Relationships* `FAMILY 1 → MANY` children; `1 → MANY` guardians.
*BR* 010, 075 · *WF* 014, 020 · *Today* `families` + `family_students`. *Stages* 15.

---

# D · The book-supply cycle

**DM-023 · Book-supply cycle** — CHILD × PERIOD
*Purpose* **The product's central record** (PP-001). One per child per academic period.
*Identity* the pair (child, period). It is the same cycle all year.
*Created* **at enrolment** [Q-1] — before any requirement, basket, payment or distribution exists.
*Attributes* child · period · state · opened at · closed at.
*Critical distinction* An **empty** cycle means *nothing has been required yet*. It must be
distinguishable from *nothing is owed* [BR-126]. That is how a school finds the child nobody
provisioned.
*Relationships* `CHILD 1 → 1 PER PERIOD` cycle; `CYCLE 1 → MANY` requirement items.
*Lifecycle* opened at enrolment → active all year → closed at rollover. **A closed cycle is
historical.**
*History* Immutable in meaning. Corrections are recorded against it, never as rewrites [BR-046].
*BR* 042, 043, 044, 045, 046, 050, 126 · *WF* 024, 025, 028, 029 · *Today* **nothing**.
*Stages* 15.

**DM-024 · Requirement item** — CYCLE
*Purpose* One requirement/settlement episode inside a cycle [Q-2] — the September bundle, a January
addition, a chargeable replacement, a mid-year joiner's initial set.
*Identity* its own, within the cycle.
*Attributes* cycle · origin (class bundle / override / addition / replacement) · created at · required
value · **payable value** · state.
*Relationships* `CYCLE 1 → MANY` items; `ITEM 1 → MANY` requirement lines, money events, funding
events, allocations, fulfilment instructions.
*Lifecycle* created → payable → settled → fulfilled. **Adding a new item never reopens a settled
one** [BR-128].
*History* Immutable once settled, except by a recorded correction.
*BR* 127, 128, 129 · *WF* 031, 033, 070 · *Today* approximated by `child_book_baskets` with a single
`totalAmount` (**C-37**). *Stages* 15.

**DM-025 · Requirement line** — CYCLE
*Purpose* One book, in one requirement item, at a stated price and quantity.
*Note* Price is captured **at the moment of requirement**, not read live from the catalogue — otherwise
a later price change rewrites what a family was asked for.
*BR* 060, 061 · *Today* `basket_items`, which does already carry unit price. *Stages* 15.

---

# E · Catalogue and stock

**DM-026 · Book product** — SCHOOL
*Purpose* A title the school supplies. *Attributes* title · author · ISBN · price · description · cover ·
active flag · stock thresholds.
*Relationships* `PRODUCT 1 → MANY` physical copies, bundle lines, requirement lines.
*BR* 060 · *Today* `books`. *Stages* 15.

**DM-027 · Bundle** — SCHOOL
*Purpose* A named set of books ("Year 4 pack") so a school assigns one thing to a class rather than
eight. *Today* `book_levels`. *Stages* 15.

**DM-028 · Bundle line** — SCHOOL
*Purpose* One product and quantity within a bundle. *Today* `book_level_items`. *Stages* 15.

**DM-029 · Class requirement assignment** — SCHOOL
*Purpose* "This class needs this bundle, in this period." *Attributes* class · bundle · period ·
effective from.
*Note* This is what makes a requirement item appear for every child in the class.
*BR* 057, 059 · *WF* 030 · *Today* `class_book_levels`. *Stages* 15.

**DM-030 · Child requirement override** — SCHOOL
*Purpose* This child needs something other than their class's bundle — mixed ability, a mid-year
joiner, a repeat year. *BR* 058 · *WF* 032 · *Today* `student_book_levels` — real and undocumented
until Stage 3. *Stages* 15.

**DM-031 · Physical copy** — SCHOOL
*Purpose* An individually identifiable book on a shelf. **The substrate custody needs.**
*Identity* its copy code, stable for life.
*Attributes* product · copy code · acquisition · condition.
*Critical* **Where it is now is NOT an attribute of the copy** — that is DM-041, derived from DM-042.
Storing a mutable location on the copy is the same mistake as `students.classId`.
*BR* 085, 092 · *Today* `book_copies` with a mutable `status` mixing condition, commitment and location
(**one field, three concepts**). *Stages* 15.

**DM-032 · Stock movement** — SCHOOL · **event**
*Purpose* Why the stock count changed. *Attributes* product · type (intake / commitment / correction /
damage / loss / exceptional restock) · quantity · before · after · reason · actor · time.
*Note* An **event**, never edited. The count is the consequence.
*BR* 062, 079, 092 · *WF* 043, 046, 057 · *Today* `book_inventory_transactions` — already event-shaped
and already carrying before/after. Keep. *Stages* 15.

---

# F · Settlement

> The most careful decomposition in this document. **Six concepts, but not six entities.**
> Three are events, one is an instruction, and **two are derived and must not be stored.**

**DM-033 · Money event** — CYCLE · **event**
*Purpose* Money actually moved. *Attributes* requirement item · amount · method (bank transfer / cash /
future online) · reference where one exists · received at · recorded by · provider record where matched.
*Note* Several money events may contribute to one requirement item — this is how instalments work
[BR-068]. No "paid" boolean exists anywhere.
*Lifecycle* claimed by a family *(a claim is itself an event)* → confirmed by finance → possibly
reversed by a later correction event. **Never edited in place.**
*BR* 065, 068, 070, 071, 072, 118 · *WF* 035, 036, 037, 041, 042 · *Today* `book_payments` —
one record, one reference, one status, no instalments. *Stages* 15.

**DM-057 · Payment application** — CYCLE · *(added at Stage 6 lock, owner decision OD-1)*
*Purpose* The link between **one money event** and **one requirement item**, carrying how much of that
money is applied to that item.
*Why a separate concept* [OD-1] One payment may span several items and several siblings, and one item
may be met by several payments. That is a many-to-many, and the amount applied belongs on the link —
not on either end. Putting it on the money event forces one payment per item; putting it on the item
forces one item per payment. Both are wrong.
*Attributes* money event · requirement item · amount applied · applied by · applied at.
*Relationships* `MONEY EVENT 1 → MANY` applications; `REQUIREMENT ITEM 1 → MANY` applications.
*Invariant* the sum of a money event's applications MUST NOT exceed the money received.
*Note* This generalises what `basket_payments` already does for siblings today — the mechanism exists,
it just carries no amount and knows nothing about items.
*BR* 065, 068, 075, 129 · *WF* 035, 037, 040 · *Today* `basket_payments` (link only, no amount).
*Stages* 15.

**DM-034 · Funding adjustment** — CYCLE · **event**
*Purpose* The school decided not to charge, or to charge less: subsidy · discount · waiver ·
school-funded. **These are not money.**
*Attributes* requirement item · type · amount · reason · **authorising finance user** · time ·
financial position before and after.
*Constraint* **Must never be countable as revenue or as an amount received** [BR-066, BR-067].
*Note* Deliberately a **separate entity from DM-033**, not a payment with a flag. A flag on a payment
is exactly how a waiver ends up in a revenue total.
*BR* 064, 066, 067, 069, 119 · *WF* 038, 039, 040, 070 · *Today* **nothing** (**C-11**).
*Stages* 15, 19.

**DM-035 · Settlement position** — **derived, MUST NOT be stored**
*Purpose* Where a requirement item, or a whole cycle, stands.
*Derivation* `required` (sum of lines) → `payable` (required − funding adjustments) → `settled` (sum of
money events) → `outstanding` (payable − settled) → `state` (outstanding ≤ 0 → settled).
*Why not stored* Two sources of truth for money is the defect this entire domain exists to prevent
[BR-129]. A stored total that disagrees with its events is worse than no total.
*Caveat for Stage 15* A **materialised** figure for performance is a physical-design decision, and is
acceptable **only** if it is provably derived and never independently writable.
*BR* 064, 065, 129 · *Today* `book_payments.totalAmount` + `child_book_baskets.totalAmount` — two
stored totals that can disagree. *Stages* 15.

**DM-036 · Payment reference** — SCHOOL
*Purpose* The string a family puts on a bank transfer so the money can be matched to a child.
*Is it an entity?* **Borderline — recommend: an attribute of the money event**, with a school-wide
uniqueness rule. It has no lifecycle of its own.
*Constraint* unique per school, compared case- and whitespace-insensitively, **and the application's
comparison must match the database's** [BR-072].
*Today* `book_payments.paymentReference` + a unique index. Correct. *Stages* 15.

**DM-037 · Provider payment record** — SCHOOL
*Purpose* A line from an external provider's export, awaiting or holding a match.
*Today* `provider_payments`. *Note* named "Stripe" but it is a spreadsheet import (**C-28**).
*Stages* 15, 17.

**DM-038 · Verification attempt** — SYSTEM · **event**
*Purpose* An attempt to match a provider record to a requirement item, and its outcome.
*Note* Keep as an event: the history of *what was tried* is what makes a reconciliation dispute
answerable. *Today* `payment_verification_attempts`. *Stages* 15.

---

# G · Fulfilment, allocation and custody

**DM-039 · Fulfilment instruction** — CYCLE
*Purpose* How this child's books are to reach them: **reception collection · classroom delivery ·
postal (future)**.
*Entity or property?* **Recommend an entity attached to the requirement item**, with an optional
cycle-level default.
*Reasoning* (a) OQ-1 requires route changes to be **recorded**, and a bare property cannot hold
history; (b) a replacement may legitimately be collected differently from the September bundle, so the
item is the right grain; (c) the future postal route carries route-specific data (a destination) that
does not belong on a cycle; (d) it must be **resolved before physical routing**, which is an
instruction's lifecycle, not a field's.
*Attributes* requirement item · route · chosen by · chosen at · superseded by.
*Lifecycle* chosen → active → superseded *(recorded, per WF-055)* → historical after final hand-over.
*BR* 039, 087 · *WF* 047, 055, 068 · *Today* **nothing** (**C-36**). *Stages* 15.

**DM-040 · Allocation** — CYCLE
*Purpose* **Specific copies are committed to this child.** *Distinct from* settlement confirmation
(which is money), stock movement (which is counting), custody (which is location), and hand-over
(which is the ending).
*Attributes* requirement item · product · quantity · specific copies where known · committed at.
*Lifecycle* committed → fulfilled → or released by a correction.
*BR* 077, 080, 082 · *WF* 043 · *Today* `finance_book_allocations`, carrying **three status columns**
that belong to three different concepts. *Stages* 15.

**DM-041 · Custody holding** — **derived, MUST NOT be stored**
*Purpose* Who physically has this copy **now**.
*Derivation* the latest custody event for that copy.
*Possible holders* school stock · prepared for fulfilment · a named teacher · the reception holding
area · the child/family · exceptional-return processing · in transit *(future postal)*.
*Why derived* A stored "current custody" is a cached answer that drifts. The current implementation
proves the point — `tryCustody` swallows illegal transitions, so the stored status can silently
disagree with what happened.
*BR* 085, 086, 093 · *Today* `custody_status` on the allocation **and** `book_copies.status` — two
caches of one answer. *Stages* 15.

**DM-042 · Custody event** — SCHOOL · **event**
*Purpose* A physical movement that actually happened. *Attributes* copy (or allocation) · from holder ·
to holder · actor · role · time · note.
*Note* **Events are the source of truth; the state machine validates transitions between them.** Stage
5's real-event map is authoritative, not the current enum.
*BR* 085, 086, 088, 123 · *WF* 048, 050, 053, 055 · *Today* `custody_events` exists — the right shape,
undermined by the swallowed-exception problem (**C-3**). *Stages* 15.

**DM-043 · Hand-over** — SCHOOL · **event**
*Purpose* **The moment the books reached the person who takes them away.** The product's whole point.
*Attributes* requirement item · copies · route taken · **recipient** (the child, or a named authorised
family member) · performed by · time.
*Note* **One event, three routes.** A classroom hand-over, a reception collection and a future postal
delivery are the same fact reached differently. §12 shows the six current statuses collapsing into
this.
*Constraint* Where the route is teacher delivery **and the teacher is the child's guardian, the teacher
cannot be the performer** [BR-056] — an administrator is.
*BR* 056, 087, 109, 110, 130, 131 · *WF* 049, 051, 052, 068 · *Today* **six representations**.
*Stages* 15.

**DM-044 · Fulfilment exception** — SCHOOL · **event**
*Purpose* The hand-over was attempted and did not complete: child absent · not enough copies · refused ·
wrong recipient presented · undelivered *(future postal)*.
*Note* An **event**, not a status. "Absent on 12 March" and "absent on 19 March" are two facts, and a
status field can only hold one.
*BR* 110, 111 · *WF* 053, 054 · *Today* `student_absent` / `out_of_stock` as mutable statuses in two
vocabularies. *Stages* 15.

---

# H · Corrections and replacements

**DM-045 · Replacement request** — SCHOOL
*Purpose* A teacher states **what is needed and why**. *Attributes* child · product · reason
*(mandatory)* · requested by · time · whether the original had already been handed over.
*Critical* **The request is not a charge.** [OQ-3] The teacher must not decide whether the family pays.
*Lifecycle* raised → reviewed operationally → **finance decides** (DM-046) → fulfilled.
*BR* 112 · *WF* 069 · *Today* `extra_copy_requests` — has the mandatory reason and approve/reject, but
no charge decision and no finance notification (**C-39**). *Stages* 15.

**DM-046 · Charge decision** — CYCLE · **event**
*Purpose* Finance's determination of whether a post-hand-over replacement is chargeable [OQ-3].
*Entity or attribute?* **A separate event.** It has its own author, time, reason and financial
consequence, and it must be auditable independently of the request that prompted it.
*Attributes* replacement request · chargeable or absorbed · reason · authorising finance user · time ·
resulting requirement item where chargeable.
*Rule it encodes* before a successful hand-over → **no charge, never a decision**. After → finance
decides.
*BR* 069, 112, 119, 127 · *WF* 034, 070 · *Today* **nothing**. *Stages* 15, 19.

**DM-047 · Correction event** — SCHOOL/CYCLE · **event**
*Purpose* The general mechanism by which a mistake is put right without erasing what was recorded:
payment correction · wrong book · stock correction · mistaken hand-over · mistaken allocation ·
incorrect subsidy · mistaken class assignment.
*Attributes* subject record · what changed · reason · actor · time · before and after.
*Principle* **Correct forward** [BR-114]. A correction is always an addition.
*WF* 029, 046, 056, 058 · *Today* partial — the console has a typed payment-status correction; most
other paths mutate in place. *Stages* 15, 19.

**DM-048 · Return processing** — SCHOOL
*Purpose* A sold copy has come back **as an exception** [FQ-02]: received → inspected → outcome
(restock / damaged / disposed).
*Attributes* original sale reference · copy · received at · inspected by · outcome · resulting stock
movement.
*Constraint* **Never a lending loop.** The original sale is not erased [BR-091].
*WF* 057 · *Today* three unrelated mechanisms, none joined to a sale (**C-4**). *Stages* 15.

---

# I · Communication

**DM-049 · Message thread** — SCHOOL · **DM-050 · Message** — SCHOOL
*Purpose* A conversation about a child or a position, and its messages. *Constraint* a teacher's
threads are limited to families of their **currently assigned** classes [BR-051].
*Today* `message_threads`, `messages`, `message_audit_logs`. *Stages* 15.

**DM-051 · Notification** — SYSTEM
*Purpose* Something a person needs to know: a new payable requirement · a settlement event · books
ready · an invitation · a message.
*Entity or event?* **Both, and they must be separated** — the *notification* is a durable record that
this person was told this thing; a **delivery attempt** (DM-052) is what happened when the system tried
to send it. Conflating them means a failed email erases the fact that the person was owed the message.
*Attributes* recipient · subject · kind · created at · read at.
*WF* 071 · *Today* `notification_preferences` and ad-hoc sends; no durable notification record.
*Stages* 15, 18.

**DM-052 · Delivery attempt** — SYSTEM · **event**
*Purpose* One attempt to deliver a notification by a channel, and its outcome.
*Note* **A failed delivery must never destroy the underlying fact** — the same principle as
emails-after-commit in the importer [BR-096].
*Constraint* **Never records a live credential or link** [BR-124] (**C-18**). *Stages* 18, 19.

---

# J · Governance

**DM-053 · Audit event** — PLATFORM · **event**
*Purpose* Attributability. *Conceptual requirements* actor · action · subject resource · time ·
before and after where meaningful · **reason where the action is discretionary** · tenant and context
(including any support engagement).
*Note* Today's audit records are scattered across three tables with different shapes. Stage 19 designs
the final scheme; Stage 6 only fixes **what an audit event must be able to say**.
*BR* 118–125 · *Stages* 19.

**DM-054 · Console operation record** — PLATFORM · **event**
*Purpose* A privileged platform action: a typed operation, an elevation, a break-glass write, a
destructive operation. *Note* Purge eligibility is **read from this record** — it is load-bearing, not
just a log. *Today* `console_audit`. *Stages* 16, 19.

**DM-055 · Job run** — SYSTEM · **event**
*Purpose* One execution of scheduled work, per school per day. *Attributes* job · school · run date ·
state · started · finished · how much remained.
*Constraint* Its uniqueness per `(job, school, date)` is what stops a retry double-emailing families
about money [BR-118]. *Today* `cron_job_runs`. Keep. *Stages* 15.

---

# K · Future

**DM-056 · Dispatch** — SCHOOL · **FUTURE ONLY**
*Purpose* The postal/courier leg of the future online-student route [F-084, WF-068].
*Conceptual shape only* fulfilment instruction · destination · dispatched at · delivery outcome.
*Explicitly not modelled now* carriers, tracking, shipping rates, address validation.
*Requirement on Stage 12* only that DM-039 and DM-043 do not make a third route impossible.
*Stages* 12, then later only if activated.

---

# SUMMARY

## 1. Total conceptual entities

**57** (DM-001 … DM-057). Of these, **4 are explicitly derived and must not be stored** as
independent truth (DM-009, DM-035, DM-041, and DM-036 if treated as an entity), and **1 is future-only**
(DM-056). **DM-057 payment application** was added at lock by owner decision OD-1.

## 2. Entity groups

A Platform & tenancy (6) · B People & access (9) · C Academic structure (7) · D The cycle (3) ·
E Catalogue & stock (7) · F Settlement (6) · G Fulfilment, allocation & custody (6) ·
H Corrections & replacements (4) · I Communication (4) · J Governance (3) · K Future (1).

## 3. Core entities — 30

DM-001, 003, 004, 007, 010, 011, 013, 014, 016, 017, 019, 020, **021**, 022, **023**, **024**, 025,
026, 029, 031, 032, **033**, **034**, **039**, 040, **042**, **043**, 044, **046**, 047.

The eight in bold are the ones the product cannot work correctly without and **does not have today**.

## 4. Supporting entities — 17

DM-002, 005, 008, 012, 015, 018, 027, 028, 030, 037, 038, 045, 048, 049, 050, 051, 052.

## 5. Internal entities — 4

DM-006 support engagement · DM-053 audit event · DM-054 console operation · DM-055 job run.

## 6. Future-only — 1

DM-056 dispatch.

## 7. Existing tables that map cleanly to one entity — 14

`schools` · `invites` · `child_linking_codes` · `families` · `books` · `book_levels` ·
`book_level_items` · `class_book_levels` · `student_book_levels` · `book_inventory_transactions` ·
`provider_payments` · `payment_verification_attempts` · `cron_job_runs` · `guardians`.

`guardians` and `book_inventory_transactions` deserve mention: both are already the right shape — the
guardian record is properly separated from the account, and stock movement is already an event with
before/after. **Keep both.**

## 8. Existing tables that combine several concepts — 7

| Table | Concepts fused |
|---|---|
| `users` | platform identity + tenant membership + role |
| `user_permissions` | branding grants + secondary roles + the test-superuser flag |
| `finance_book_allocations` | allocation + distribution outcome + custody, in three status columns |
| `book_copies` | copy identity + condition + commitment + location, in one status |
| `students` | the child + **current class membership** |
| `book_payments` | money event + settlement position + order lifecycle + collection lifecycle |
| `school_branding` | core school identity **+** website presentation (**C-5**) |

## 9. One concept split across several tables or statuses — 6

| Concept | Currently spread across |
|---|---|
| **Hand-over (DM-043)** | six statuses across four tables — see §12 |
| **Guardian–child relationship (DM-014)** | `parent_children` (email-keyed) + `family_students` |
| **Teacher assignment (DM-019)** | `classes.teacherId` + `class_teacher_assignments` |
| **Custody holding (DM-041)** | `custody_status` on the allocation + `book_copies.status` |
| **Settlement position (DM-035)** | `book_payments.totalAmount` + `child_book_baskets.totalAmount` |
| **Return (DM-048)** | custody `returned` + `book_copies.status` + inventory `return` type |

## 10. Required by Stages 1–5, completely missing today — 12

DM-004 school policy · DM-016 academic period as an entity · **DM-021 class membership over time** ·
**DM-023 book-supply cycle** · **DM-024 requirement item** · **DM-033/DM-034 money vs funding as
separate events** · **DM-039 fulfilment instruction** · DM-043 hand-over as one event ·
**DM-046 charge decision** · DM-048 return processing · DM-051 durable notification ·
DM-019's time bounds.

## 11. Derived values that should NOT be stored

| Value | Derive from |
|---|---|
| Access context (DM-009) | role grants + current staffing + current guardian relationships |
| Settlement position — required, payable, settled, outstanding, "is settled" (DM-035) | requirement lines + money events + funding adjustments |
| Custody holding (DM-041) | the latest custody event for the copy |
| A child's current class | the class membership active as at today |
| Cycle totals | the sum of its requirement items |
| "Has the child received their books" | the presence of a hand-over event |

Stage 15 may materialise any of these for performance — **only where provably derived and never
independently writable.**

## 12. The status reduction

`CURRENT STATUS → REAL-WORLD CONCEPT → KEEP / MERGE / DERIVE / LEGACY`

| Current | Real-world concept | Verdict |
|---|---|---|
| `PAYMENT_STATUSES.awaiting_reference / reference_submitted` | a family's **claim** that they paid | **MERGE** → a money event with a claim and a confirmation |
| `PAYMENT_STATUSES.needs_review` | a reconciliation **task**, not a state of money | **LEGACY** → a work-queue view, derived |
| `PAYMENT_STATUSES.confirmed` | finance **confirmed** the position | **DERIVE** from DM-035 |
| `PAYMENT_STATUSES.rejected / cancelled` | a **correction event** | **MERGE** → DM-047 |
| `PAYMENT_STATUSES.ready_for_collection` | books **prepared** and awaiting a reception collection | **MERGE** → a custody event, only on the reception route |
| `PAYMENT_STATUSES.collected` | **the hand-over happened** | **MERGE** → DM-043 |
| `ORDER_STATUSES.*` (8 values) | a presentation summary of the four facts above | **DERIVE** — no stored order status |
| `child_book_baskets.status` | the requirement item's settlement position | **DERIVE** from DM-035 |
| `ALLOCATION_STATUSES.allocated` | copies **committed** to the child | **KEEP** as DM-040's existence |
| `ALLOCATION_STATUSES.received` | **the hand-over happened** | **MERGE** → DM-043 |
| `ALLOCATION_STATUSES.absent / cancelled` | a fulfilment **exception**, or a correction | **MERGE** → DM-044 / DM-047 |
| `DISTRIBUTION_STATUSES.pending_distribution` | nothing has happened yet | **DERIVE** — absence of events |
| `DISTRIBUTION_STATUSES.received_by_student` | **the hand-over happened** | **MERGE** → DM-043 |
| `DISTRIBUTION_STATUSES.student_absent / out_of_stock / issue_reported` | fulfilment **exceptions** | **MERGE** → DM-044 |
| `custody_status.*` | where the copy **is now** | **DERIVE** from DM-042 |
| `book_copies.status` in_stock / allocated / sold | location and commitment | **DERIVE** from DM-042 + DM-040 |
| `book_copies.status` damaged / lost | the copy's **condition** — genuinely an attribute | **KEEP**, but as condition, not location |
| `book_copies.status` returned | an exceptional **return** | **MERGE** → DM-048 |

**The headline:** the six representations of RE-8 collapse into **one hand-over event**. But note what
*survives*: "finance considers the position closed" (DM-035, derived) and "the child physically has
the books" (DM-043) **are different facts** — a reception-collection school needs both. The reduction
removes duplication, not distinction.

**Are these workflow states, entity states, presentation states, or events?** Mostly the last: of the
~40 status values examined, the great majority describe **things that happened**, and the current
model stores them as things that *are*. That is why a class move rewrites September, why an absent
child on two dates is one fact, and why a swallowed custody exception leaves a status that never
happened.

## 13. Owner decisions — all three **DECIDED**

| ID | Question | Decision | Consequence |
|---|---|---|---|
| **OD-1** | Is settlement per requirement item, or can one payment span items? | **One money event MAY span multiple requirement items, including several siblings' items.** Money event ≠ application of money ≠ derived position | **DM-057 payment application** added. The amount applied lives on the link. Settlement position stays derived and never independently writable |
| **OD-2** | Who defines the academic period? | **The school.** Each school defines its own labels, boundaries and rollover. Defaults and templates are offered, never imposed | DM-016 confirmed as school-owned. Rollover is a per-school ritual |
| **OD-3** | Can a child be in more than one class at a time? | **No — one active class membership per period.** The community-school case is solved by **staffing**, not by memberships: one main class, several teachers, a shared subject teacher staffed across classes | DM-021 and DM-019 confirmed. **Shared subject teachers MUST NOT be reinterpreted as extra memberships** |

**No open owner decisions remain in Stage 6.**

### Why OD-3 matters more than it looks

It settles where the community-school shape lives. Requirements flow from **the child's one class**
(DM-029), so requirement generation stays simple. Teacher reach flows from **staffing** (DM-019), so a
Quran teacher staffed to Classes A, B and C reaches all three — and a child in Class A is reachable by
both their Arabic and their Quran teacher, without the child ever belonging to two classes. Stage 7
inherits a clean rule: **a teacher may see a child where an active staffing intersects that child's
active membership.**

---

## What Stage 6 deliberately did not do

No tables, keys, types, indexes, constraints or migrations (Stage 15). No permissions (Stage 7). No
modules or folders (Stages 8, 13). No state machines — the events above are named, their permitted
sequences are not. And no selection between competing current implementations (Stage 22).
