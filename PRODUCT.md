# PRODUCT.md — Stage 1: App Vision

```
STAGE 1 — APP VISION
STATUS: LOCKED
Locked: 23 August 2026 by the owner (BytHub Technology Ltd)
```

**What "locked" means.** Later stages treat everything here as a requirement unless the owner
explicitly changes it. If a later stage discovers something that conflicts with this document,
**flag the conflict** — do not silently adjust the product vision to fit the code.

**Evidence base:** `CURRENT_SYSTEM_MAP.md`, `CURRENT_BEHAVIOUR_BASELINE.md`, `RESTRUCTURE_STATE.md`,
the repository at `restructure/aug-2026` `37b1fa8`, and the original specification in
`attached_assets/`.

Tags used below:

- **[CONFIRMED]** — supported by the repository or verified behaviour.
- **[DECIDED]** — settled by owner decision D-01…D-10 (§15).
- **[IMPLIED]** — suggested by the system, still not formally decided.

---

## 1. ScholarShelf overview

ScholarShelf is a **UK multi-tenant school platform for the complete lifecycle of supplying and
selling required books to children** — from catalogue and class requirements, through family payment
or approved funding, to stock allocation, physical custody and classroom hand-over, keeping the whole
process auditable and school-specific. [DECIDED]

It serves **UK mainstream schools and UK supplementary/weekend schools**. [DECIDED D-01]

One deployment serves many schools, isolated by `schoolId`. BytHub Technology Ltd sits above all
tenants as **internal platform operator** — not as a customer-facing group/trust dashboard.
[DECIDED D-06]

The core operational spine:

```
CATALOGUE
   ↓
BOOK / BUNDLE REQUIREMENTS
   ↓
CLASS
   ↓
CHILD
   ↓
FAMILY
   ↓
AMOUNT REQUIRED
   ↓
PAYMENT / FUNDING / SUBSIDY
   ↓
CONFIRMATION
   ↓
ALLOCATION
   ↓
STOCK MOVEMENT
   ↓
PHYSICAL CUSTODY
   ↓
TEACHER HAND-OVER
   ↓
COLLECTED
   ↓
AUDITABLE HISTORY
```

Alongside the spine, the **school website / CMS is an optional, separately positioned module** — real
product value, but not part of the book-distribution core. [DECIDED D-05]

---

## 2. Product vision

**Final ScholarShelf is the system of record for the book-supply cycle in a UK school** — the place
where the money (or the school's decision to fund it) and the physical book meet against a named
child, and the place anyone can look afterwards to answer "who has what, who settled it, and who
handed it over."

It is deliberately **not** a school MIS, not a library lending system, not an e-commerce platform, and
not an accounting package. It is a narrow operation done completely, for a job schools do today
across a spreadsheet, a paper register, a bank statement and a messaging group.

---

## 3. Problem statement

Every term a school moves several hundred physical books to several hundred children, and money in
the opposite direction, through four people who never see each other's records:

| Who | What they hold today |
|---|---|
| School admin | which child is in which class, and which books that class needs |
| Finance | the bank statement, cash tin, and a pile of transfer references |
| Teacher | the physical books, and 30 children in front of them |
| Family | a request for money, and no visibility of what happens next |

The failure modes are specific and expensive, and each is visible in the product's own design:

1. **Books handed out that were never settled.** [CONFIRMED — allocation happens only after confirmation]
2. **Money received that cannot be matched to a child.** [CONFIRMED — unique reference + uniqueness constraint]
3. **Stock that quietly disappears.** [CONFIRMED — transactional deduction + `book_inventory_transactions`]
4. **No record of who received what.** [CONFIRMED — timestamped hand-over]
5. **Sibling and family complexity.** [CONFIRMED — one payment across several baskets]
6. **Children whose books are funded, subsidised, paid in cash or paid in instalments.** Today this
   has no representation at all, so the system's implicit answer to hardship is "no books".
   [DECIDED D-10 — must be supported, explicitly and auditably]

The underlying reality: **this is a physical-logistics problem with a settlement attached, not a
payment problem with logistics attached.** Any decision that treats it as e-commerce will get the
classroom wrong.

---

## 4. Primary user groups (high level — Stage 2 does the detail)

| Group | In one line | Status |
|---|---|---|
| **School operations** | Sets up catalogue, classes, students, families and staff; owns the school's data | Core, customer-facing |
| **School finance** | Turns payments, cash, instalments and funding decisions into settled records | Core, customer-facing |
| **The classroom** | Hands books to children and records what happened — **restricted to their assigned classes** | Core, customer-facing [DECIDED D-08] |
| **The family** | Sees what their child needs, settles it, and collects | Core, customer-facing |
| **BytHub platform operations** | Onboards, supports, suspends and administers school tenants | **Internal only** [DECIDED D-06] |
| **School web presence** | Runs the public site and branding | **Optional CMS module** [DECIDED D-05] |
| **The public** | Sees a school's published page | Part of the optional CMS module |

**Students are not users of ScholarShelf.** [DECIDED D-09] A child is a domain entity whose record is
managed by authorised adults. The inert `student` role in the code is architectural residue, recorded
for controlled deprecation — **not to be deleted now**.

---

## 5. Core value proposition

**For the school:** the cycle stops being four disconnected records. Nothing leaves the shelf without
a settled position — paid, funded, discounted or deliberately waived — and every one of those is
explicit and auditable. Every hand-over is timestamped. Any question a parent asks can be answered
without opening a bank statement.

**For the family:** one place that says what their child needs, what is owed, how to settle it, and
whether it landed — instead of a letter home and silence.

**For BytHub:** one deployment serving many schools, with the tenant boundary enforced structurally
rather than by discipline.

---

## 6. Product statement

> **ScholarShelf helps UK schools get the right books into the right children's hands — paid for,
> funded or subsidised, and fully accounted for — by joining the catalogue, the family's settlement
> and the classroom hand-over into a single auditable record for each child.**

**Fuller description.**

ScholarShelf is a multi-tenant platform for the one operation a UK school's textbook or
reading-scheme cycle actually consists of: deciding what each class needs, telling families, settling
the cost, and physically handing the books over. A school builds its catalogue, groups books into
bundles, and assigns a bundle to a class; from that moment the system knows exactly what every child
in that class needs. Families link to their children and see what is owed. That amount can be settled
in more than one legitimate way — online payment, bank transfer against a reference, cash recorded by
finance, instalments, a school subsidy, or books the school funds outright — and each route is
explicit, attributable and auditable. Only once the position is confirmed does stock move and the
books become that child's. On distribution day the teacher works through their own class list on a
phone or tablet and records who received their books, who was absent, and what was out of stock. The
physical copies are trackable through that journey rather than disappearing between the stockroom and
the classroom.

What makes that worth building as a product rather than a spreadsheet is the join. Inventory tools
know stock but not children. Payment tools know money but not classes, siblings, subsidies or
hand-over. School MIS platforms know children but do not sell them a physical item and do not run the
classroom hand-over. ScholarShelf exists because it holds all of it against one record and keeps it
consistent — transactionally, and with an audit trail that survives the academic year, including the
September rollover into the next one.

Around that spine sits the operational apparatus a real school needs: family and guardian enrolment
including bulk import, staff onboarding, admin↔family messaging, stock and revenue reporting, and
per-school branding. The public school website and CMS is a genuine capability but a **separate
optional module**, and BytHub's platform tier is **internal operations infrastructure**, not a
product sold to school groups.

---

## 7. Why the product exists — and what schools do without it

**Current alternative.** [CONFIRMED by the original specification and pitch]

- A spreadsheet of which class needs which books.
- A list of who has paid, reconciled by eye against a bank statement, plus a cash tin.
- Printed class registers ticked by hand on distribution day.
- Ad-hoc family communication by letter, email or messaging app.
- Stock counted manually, if at all.
- Funding and hardship decisions held in someone's head or a side conversation.

**Why they fail at scale.** Each is a separate copy of the truth, updated by a different person, at a
different time, with no constraint linking them. The spreadsheet cannot refuse to hand out a book
nobody settled. The bank statement cannot tell you which child a transfer belongs to. The paper
register tells finance nothing. And none of them survive September.

**Why a generic tool does not fit.**

- **E-commerce/payment tools** have no concept of a class, a bundle assigned to a class, a sibling
  group settling once, a school subsidy, or a hand-over event. [CONFIRMED — these are the core entities]
- **School MIS/SIS** knows the children but does not run a paid physical-goods distribution.
- **Library software** models lending and return. ScholarShelf sells books permanently.
  [DECIDED D-04]

---

## 8. What makes ScholarShelf different

1. **It is the only place where settlement and physical custody reconcile against a named child.**
   Confirmation, stock deduction and allocation are one atomic act. [CONFIRMED]
2. **It is designed around the classroom moment, not the checkout.** Hand-over is a first-class event
   with its own vocabulary — received, absent, out of stock, partially collected. [CONFIRMED]
3. **Physical custody is tracked deliberately**, from reservation through preparation and hand-over
   to collection, with exception states. [DECIDED D-03 — the *current* implementation is not the
   final machine; the rules are designed in Stages 4–5]
4. **Settlement is plural by design.** Online payment, bank transfer, cash, instalments, subsidy and
   school funding are different routes to the same settled position — not different systems.
   [DECIDED D-02 + D-10]
5. **The tenant boundary is structural.** Isolation lives at one choke point and inside the storage
   layer. [CONFIRMED — the codebase's most valuable asset]
6. **Role boundaries are enforced by the server, not hidden in the UI**, and teachers see only their
   own classes. [CONFIRMED for the mechanism; DECIDED D-08 for the teacher rule]
7. **It fits both UK mainstream and UK supplementary schools**, without pretending to be an
   internationalised product. [DECIDED D-01]

---

## 9. Main expected outcome

A school running ScholarShelf can say, at any point in the year and without opening anything else:

- every child's required books, by class;
- what each child owes, what has been settled, by which route, and what the school funded or discounted;
- what has been physically handed over, by whom, and when;
- where the remaining copies are;
- what happened to anything that went wrong — absent child, out of stock, damaged copy;
- and all of the above for **previous** academic years, unaltered by this year's rollover.
  [DECIDED D-07]

And it can say all of that to a parent, a governor, an auditor or the ICO. [IMPLIED — audit logging
is pervasive and GDPR framing is explicit throughout the project's documents]

---

## 10. High-level product scope

*Product-level boundary only. The full feature catalogue is Stage 3.*

### CORE PRODUCT — remove any of these and it is not ScholarShelf

| | Status |
|---|---|
| Book catalogue and stock levels | [CONFIRMED] |
| Bundles ("book levels") and assignment to classes | [CONFIRMED] |
| Classes and students, with school-appropriate level/class terminology | [CONFIRMED + D-01] |
| Families, guardians, and family↔child linking | [CONFIRMED] |
| The child's required-books record for a cycle | [CONFIRMED] |
| **Amount required, and settlement by any legitimate route** — payment, cash, instalments, subsidy, school funding | [DECIDED D-02 + D-10] |
| Confirmation, allocation and atomic stock movement | [CONFIRMED] |
| **Physical custody tracking through the operational lifecycle** | [DECIDED D-03] |
| Classroom hand-over and collection, scoped to the teacher's own classes | [CONFIRMED + D-08] |
| **Explicit academic-year rollover that preserves historical truth** | [DECIDED D-07] |
| Multi-tenant isolation and role-based access | [CONFIRMED] |
| Audit trail of money, funding decisions, PII and cross-tenant actions | [CONFIRMED] |

### IMPORTANT SUPPORTING CAPABILITY

Family enrolment + bulk import with invitations · staff onboarding, invites, setup wizard and go-live
checklist · admin↔family messaging · stock, distribution and revenue reporting · per-school branding
of the school's own communications · notifications and the daily digest · copy-level identity and
label printing · reconciliation of imported provider payment data · teacher extra-copy requests.
[all CONFIRMED]

### OPTIONAL MODULE — separately positioned, preserved intact

**School website / CMS**: typed page sections, drafts and publishing, media library, public site
rendering, and the `it_personnel` role and its server-side boundary. [DECIDED D-05]

> The architecture should eventually allow `SCHOLARSHELF CORE + OPTIONAL SCHOOL WEBSITE/CMS MODULE`.
> Until that module boundary is deliberately designed, **everything listed here is preserved as-is**.

### INTERNAL INFRASTRUCTURE — not a product surface

BytHub platform tier: school tenant management, onboarding, support access, suspension and lifecycle,
platform administration, controlled operational tooling. [DECIDED D-06]

### FUTURE / POSSIBLE EXPANSION

- **Real online payment as the primary route** — architecture must be capable of it; not implemented now [D-02]
- Automatic per-copy provenance at settlement confirmation (designed, not built)
- MIS/SIS integration (Wonde, Arbor, SIMS) so student data is not re-keyed
- Offline-tolerant classroom hand-over
- Custom domains and SEO/SSR — within the CMS module
- Configurable level/class vocabulary beyond the initial UK sets [D-01]

### OUT OF SCOPE

- Being a school MIS/SIS (attendance, behaviour, assessment, timetabling)
- **Library lending, loans, renewals, overdue management** [DECIDED D-04]
- **Student logins / student accounts** [DECIDED D-09]
- **Customer-facing multi-academy-trust or school-group management** [DECIDED D-06]
- Non-UK / internationalised operation as a product goal [DECIDED D-01]
- General e-commerce beyond a child's required books
- A bookkeeping or accounting ledger
- Teaching and learning content, reading progress, attainment
- A general-purpose website builder sold on its own merits

---

## 11. Product boundaries — where responsibility starts and stops

| Boundary | ScholarShelf's side | The other side |
|---|---|---|
| **Settlement** | Determines what is owed; records how it was settled — payment, cash, instalment, subsidy, school funding — and by whose authority | Banks and payment providers move money. ScholarShelf never confirms funds by itself |
| **Student data** | Holds the children it needs to run distribution | The school's MIS remains the enrolment source of truth; ScholarShelf imports |
| **The physical book** | Records intended and recorded custody | The shelf, the trolley and the classroom are real; the system reflects them |
| **The family relationship** | Provides the channel, in the school's name | The school owns the relationship |
| **Accounting** | Reports what was owed, settled, funded and outstanding | The school's finance system does the accounts |
| **Data protection** | Processor: isolation, audit, retention, deletion | The school is the controller |
| **The school's public web presence** | Optional module, if bought | Otherwise entirely outside the product |

---

## 12. Product principles

Nine. Each is a test a later decision can be checked against.

**PP-001 — One record per child per cycle.** Amount owed, settlement, allocation and physical custody
reconcile against that record. A feature that creates a second place where any of those live is
wrong, however convenient.

**PP-002 — Nothing leaves the shelf unaccounted for.** Either the position is settled, or the
exception is deliberate, named, authorised and recorded. "It got handed out somehow" must not be
representable. [CONFIRMED — what `confirmPayment`'s atomicity buys]

**PP-003 — Settlement route is a detail; the settled position is the product.** Online payment, bank
transfer, cash, instalments, subsidy and school funding are different paths to one auditable
position, never parallel accounting systems. [DECIDED D-02 + D-10]

**PP-004 — The tenant boundary is absolute, and enforced in one place.** Guaranteed structurally, not
by every route remembering. Any design that distributes this responsibility is rejected.

**PP-005 — Least privilege, especially about children.** A teacher sees their own classes. Nobody
sees a child's data because their job title happens to be broad. [DECIDED D-08]

**PP-006 — History is immutable.** Moving into a new academic year must never rewrite what was true
in the last one. [DECIDED D-07]

**PP-007 — The classroom is the least forgiving surface.** Hand-over happens on a phone, standing up,
with 30 children waiting. If a workflow cannot survive that it is not finished. [IMPLIED — the
original spec says "designed for use on tablets and phones"; Stage 0 found 24px tap targets and
hover-only controls, so this is aspirational today]

**PP-008 — Everything touching money, funding decisions, a child's record, or another tenant is
auditable.** Who, what, when, before, after.

**PP-009 — A failed request never looks like a settled fact.** "£0.00 taken" and "you're all caught
up" must mean the system knows, not that the request failed. [CONFIRMED — the rule `query-state.tsx`
exists to enforce, currently 2/42 adopted]

---

## 13. Relationship to the existing prototype

**The product already exists and largely works.** Stage 1 named what has been built and decided what
survives. Nothing in CORE PRODUCT is speculative except where marked [DECIDED] — those are
capabilities the product now requires but the code does not yet fully have.

| Prototype reality | Locked position |
|---|---|
| Started as one supplementary school with Arabic level names (براعم, تمهيدي); now hard-pinned to Reception/Years 1–13, en-GB, GBP | **UK, both sectors.** Level/class terminology must become school-appropriate rather than fixed to one vocabulary. Currency, locale and regulation stay UK. [D-01] |
| Parent portal presents card checkout; `paymentIntegration.ts` is a stub; real mechanism is bank transfer + manual reconciliation; Stripe data arrives as an imported spreadsheet | **Bank-transfer reconciliation is real and must be preserved.** Online payment is the eventual primary route; the architecture must be capable of it. **No payment work in this stage.** [D-02] |
| Five-state custody machine exists but is advisory — `tryCustody` swallows illegal transitions; no "hand books to teacher" screen | **Full custody tracking is in scope.** The current machine is *not* the final one; rules come from Stages 4–5. Do not patch it opportunistically. [D-03] |
| Custody contains `returned`; inventory has a `return` transaction type | **Books are sold, not lent.** These are not canonical requirements. Stages 4–6 decide whether any return concept survives purely as a correction/refund path. [D-04] |
| Complete headless CMS, media library, branding and a dedicated `it_personnel` role, unrelated to the book lifecycle | **Optional, separately priced module.** Preserved intact until the module boundary is designed. [D-05] |
| Full owner tier, support mode, three-tier hardened DB console | **Internal BytHub operations only.** Not a customer-facing group dashboard. [D-06] |
| `academic_year` stamped on six tables; no rollover; one mutable `students.classId` | **An explicit rollover workflow is required, and history must be preserved.** How history is represented is Stages 4/5/6/15. [D-07] |
| Allocations class-filtered; other teacher views broader | **Assigned classes only.** The current inconsistency is a defect, not a requirement. [D-08] |
| Inert `student` role in `USER_ROLES` | **Students are not users.** Legacy residue — record for controlled deprecation, do not delete now. [D-09] |
| One settlement path only: `paymentMethod` defaults to `"external_reference"`; no waiver, discount, cash, instalment or exemption concept anywhere | **Must support school-funded/waived, cash, instalments and discount/subsidy**, distinguishing list value, payable value, subsidy, paid, outstanding and waived. Schema design is Stages 4/5/6. [D-10] |

**Still not to be reverse-engineered into requirements without a decision:** the `finance` role being
separate from `admin`, and the three parallel parent-onboarding paths (invite / linking code / CSV
auto-invite). Both are carried to Stage 2 and Stage 3.

---

## 14. Confirmed facts vs assumptions

**[CONFIRMED] — safe to build on**

- The lifecycle in §1 and every non-[DECIDED] CORE item in §10.
- Multi-tenant with a structural isolation boundary; parents scoped by family, not `schoolId`.
- Current roles: owner, platform_admin, school_admin (alias `admin`), finance, it_personnel, teacher, parent, plus inert student.
- Three separate status vocabularies (allocation / distribution / custody) are meaningful and distinct.
- Bank transfer + reference + human confirmation is today's real settlement mechanism.
- Payment reconciliation is spreadsheet import, not a live payment integration.
- Audit logging is pervasive; GDPR framing is explicit throughout.

**[DECIDED] — now requirements**

D-01 UK, both sectors, flexible level vocabulary · D-02 online payment is the eventual primary route,
bank transfer preserved · D-03 full custody tracking · D-04 books are sold · D-05 CMS is an optional
module · D-06 owner tier is internal only · D-07 explicit rollover, history immutable · D-08 teachers
see assigned classes only · D-09 students are not users · D-10 plural settlement and funding routes.

**[IMPLIED] — still not formally decided**

- The teacher surface is meant to be mobile-first (PP-007).
- The school is data controller, ScholarShelf processor.
- One distribution cycle per class per academic year is the normal rhythm.
- Schools procure in spring for a September start.

---

## 15. Locked decisions (D-01 … D-10)

| ID | Decision | Carried into |
|---|---|---|
| **D-01** | **UK mainstream *and* UK supplementary/weekend schools.** Not dependent on Reception/Year 1–13 vocabulary; school-appropriate level/class terminology, without internationalising the product. UK regulation, currency and locale. | 2, 6, 9, 10, 15, 16 |
| **D-02** | **Eventual primary route is real online payment.** Current bank-transfer/reference reconciliation is real functionality and is preserved through the rebuild. Architecture must be capable of genuine online payment. **No payment implementation yet.** | 3, 5, 12, 14, 17 |
| **D-03** | **Full physical custody tracking is in scope** — reserved, prepared, handed to teacher, issued/collected, plus exception states. The current machine is not automatically final; rules are designed in Stages 4–5 before any implementation. | 4, 5, 6, 9, 15 |
| **D-04** | **Books are sold permanently.** Not a lending platform. `returned` / inventory `return` are not canonical; Stages 4–6 decide whether an exceptional correction/refund path is needed. | 3, 4, 5, 6 |
| **D-05** | **School website/CMS is an optional, separately priced module.** CMS, media, publishing, public site and `it_personnel` preserved until the module architecture is deliberately designed. **Refined by Stage 2 US-02:** *core school identity and application branding belong to ScholarShelf Core* (they drive dashboards, the parent portal and transactional email); the CMS module **consumes** core identity and adds website-specific styling and assets on top. | 3, 8, 9, 10, 12, 22 |
| **D-06** | **Owner / platform_admin is internal BytHub operations only** — tenant management, onboarding, support, suspension/lifecycle, platform administration, controlled operational tooling. Not a customer-facing MAT product. | 2, 7, 8, 16 |
| **D-07** | **Explicit annual rollover workflow** — advancing students, class changes, new classes, leavers, joiners, next cycle — **without overwriting historical truth.** Representation decided in 4/5/6/15. | 4, 5, 6, 15 |
| **D-08** | **Teachers see only their assigned classes and the students/distribution data those classes require.** Current inconsistency is a defect. | 2, 7, 9, 16 |
| **D-09** | **Students are not users.** No student login in the final product. The inert `student` role is legacy residue: record for eventual deprecation, do not delete now. | 2, 7, 16, 22 |
| **D-10** | **Multiple legitimate settlement and funding routes**: school-funded/hardship/waived (explicit, auditable, never disguised as a payment), cash recorded by finance, part-payments/instalments, discount/subsidy. Requires distinguishing **list/required value · payable value · subsidy/discount · amount paid · amount outstanding · school-funded/waived**. Schema design deferred. | 3, 4, 5, 6, 15 |

**D-02 + D-10 combined constraint.** The settlement model must never collapse to "online payment
only". It must support:

```
AMOUNT OWED
      ↓
      ├── ONLINE PAYMENT
      ├── BANK TRANSFER + REFERENCE
      ├── CASH RECORDED BY FINANCE
      ├── INSTALMENTS
      ├── SCHOOL-FUNDED / WAIVED
      └── DISCOUNT / SUBSIDY
```

…without creating disconnected accounting paths. This is a later-stage design problem, not a Stage 1
one.

---

## 16. Conflicts to carry forward (flag, do not silently resolve)

These are places where the locked vision and the current code disagree. They are recorded so later
stages resolve them deliberately.

| # | Conflict | Owning stage |
|---|---|---|
| C-1 | Level/class vocabulary is hard-pinned to Reception/Year 1–13 in `formatYearGroup`; D-01 requires school-appropriate terminology | 6, 10 |
| C-2 | Parent portal advertises card checkout that does not exist; D-02 says preserve bank transfer and be capable of online payment — the UI currently misrepresents both | 3, 9 |
| C-3 | Custody machine is advisory (`tryCustody` swallows illegal transitions) and there is no "hand books to teacher" screen; D-03 requires real custody | 4, 5, 9 |
| C-4 | `returned` custody state and inventory `return` type imply lending; D-04 says sold | 4, 6 |
| C-5 | CMS, media, branding and `it_personnel` are woven into the same app, routes and role model; D-05 requires a module boundary | 8, 12, 13 |
| C-6 | Teacher visibility is class-scoped for allocations and broader elsewhere; D-08 requires assigned-class-only everywhere | 7, 9 |
| C-7 | `student` is in `USER_ROLES` (but has no landing path and is excluded from the test account); D-09 says not a user — deprecate through the register | 2, 7, 22 |
| C-8 | Exactly one settlement path exists (`paymentMethod` default `"external_reference"`); D-10 requires six | 4, 5, 6, 15 |
| C-9 | `students.classId` is a single mutable pointer, so promotion rewrites history; D-07 forbids that | 6, 15 |
| C-10 | The owner tier ships a customer-shaped "global dashboard" and cross-tenant reporting; D-06 says internal ops only | 8, 9 |

---

## 17. What Stage 1 does *not* do

No feature catalogue (Stage 3), no role-by-role permission architecture (Stage 7), no workflow
diagrams (Stage 5), no data model (Stage 6), no schema (Stage 15). The Stage 0 technical findings —
custody enforcement, query-state adoption, `storage.ts` ownership, migration baseline, MFA/CSP/
sensitive logging, cron scalability, test gaps — are **carried forward**, not fixed here.
