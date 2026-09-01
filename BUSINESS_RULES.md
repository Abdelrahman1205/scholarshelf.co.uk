# BUSINESS_RULES.md — Stage 4: Business Rules

```
STAGE 4 — BUSINESS RULES
STATUS: LOCKED
Locked: 23 August 2026 by the owner (BytHub Technology Ltd)
```

**Governed by** `PRODUCT.md` (Stage 1) · `USERS.md` (Stage 2) · `FEATURE_INVENTORY.md` (Stage 3) — all LOCKED.

A later stage that finds a conflict with these rules **flags it**. It does not change the product.

**What this document is.** The rules that must always be true for ScholarShelf to behave correctly as
a product. Not an implementation plan, not a schema, not a permission matrix.

**What it is not.** A transcription of current code. Where the code enforces something the product
does not require, that is recorded as an **implementation accident** or **legacy behaviour**, not
promoted to a rule.

---

## Reading a rule

```
BR-nnn · Name — CLASSIFICATION · ENFORCEMENT
  ▸ the rule itself
  Why · Actors · Features · Enforced at · Parity · Conflicts · Stages
```

**CLASSIFICATION**

| | |
|---|---|
| `LOCKED` | Required by a locked Stage 1–3 decision |
| `EXISTING` | A confirmed rule of the product as it stands, and correct |
| `ACCIDENT` | True of the code today, but a consequence of how it was built — not a product requirement |
| `LEGACY` | Historical behaviour, retained pending controlled removal |
| `OPEN` | The product genuinely cannot determine this yet |

**ENFORCEMENT**

| | |
|---|---|
| `STRUCTURAL` | Enforced where it cannot be forgotten — DB constraint, transaction, single choke point |
| `PARTIAL` | Enforced in some paths, not all |
| `UI-ONLY` | The screen prevents it; the API does not |
| `DUPLICATED` | Enforced in more than one place, with drift risk |
| `UNENFORCED` | Nothing enforces it today |
| `CONFLICTING` | Two places enforce contradictory versions |

---

# DOMAIN 1 — Tenant isolation

**BR-001 · One school per staff session** — EXISTING · STRUCTURAL
▸ A session whose role is tenant-scoped MUST be pinned to exactly one school, and every read and
write in that session MUST be scoped to it.
*Why* Cross-tenant leakage of children's data is the product's worst failure. *Actors* all school
staff. *Features* F-001, F-030, F-052. *Enforced at* `ensureSessionSchoolIsActive` (one choke point)
+ `schoolFilter` in storage (57 sites). *Parity* B-2. *Stages* 7, 12, 16.

**BR-002 · A null school is not "all schools"** — EXISTING · STRUCTURAL
▸ IF a session's role is tenant-scoped AND its school is null, THEN the request MUST be refused (403)
and audited.
*Why* `schoolFilter(null)` emits no WHERE clause — a staff account with no school would read every
tenant. *Enforced at* `auth.ts:352`. *Parity* B-2. *Stages* 7, 16.

**BR-003 · Parents are scoped by relationship, not by school** — LOCKED (US-01) · STRUCTURAL
▸ A parent account MUST NOT carry a tenant. Its scope MUST derive from its confirmed child
relationships.
*Why* One guardian may have children at more than one school; forcing a `schoolId` breaks the portal.
*Features* F-033, F-034. *Enforced at* `TENANT_SCOPED_ROLES` deliberately excludes `parent`.
*Parity* B-2 — "blocking parents here takes out the entire parent portal". *Stages* 6, 7.

**BR-004 · Platform roles are untenanted by design** — LOCKED (D-06) · STRUCTURAL
▸ `owner` and `platform_admin` MUST be excluded from tenant scoping; a null school for them means
"all tenants".
*Stages* 7, 16.

**BR-005 · Cross-tenant reads report absence, not refusal** — EXISTING · PARTIAL
▸ A request for a resource in another tenant MUST return "not found", never "forbidden".
*Why* A 403 confirms the resource exists. *Enforced at* route conventions; not centrally guaranteed.
*Stages* 7, 14.

**BR-006 · Foreign keys supplied in a request body are validated against the session's school** — EXISTING · STRUCTURAL
▸ IF a request body names a student, class, book or bundle, THEN it MUST be asserted to belong to the
session's school before use.
*Enforced at* `assertStudentInSchool`, `assertClassInSchool`, `assertBookInSchool`,
`assertBookLevelInSchool` — **in storage**, so a route cannot forget. *Parity* B-2. *Stages* 12, 13.

**BR-007 · An inactive school cannot be operated** — EXISTING · STRUCTURAL
▸ IF a school is suspended, archived, pending deletion or deleted, THEN all sessions scoped to it MUST
be refused and destroyed.
*Features* F-001. *Enforced at* `ensureSessionSchoolIsActive`. *Parity* B-2. *Stages* 7, 16.

**BR-008 · BytHub reaches tenant data only through support mode** — LOCKED (D-06) · STRUCTURAL
▸ A platform role MUST NOT read or write a school's operational data except inside an explicit,
scoped, audited support context.
*Features* F-002. *Enforced at* `canManageUser` + `isInSupportMode`. *Parity* B-8. *Stages* 7, 16.

**BR-009 · A tenant boundary is enforced in one place** — LOCKED (PP-004) · STRUCTURAL
▸ Tenant scoping MUST be enforced at shared choke points, never by each route remembering.
*Why* This is the codebase's most valuable asset and the thing most easily lost in a rebuild.
*Conflicts* — *Stages* 12, 13.

---

# DOMAIN 2 — Accounts and identity

**BR-010 · A guardian record is not an account** — LOCKED (US-01) · PARTIAL
▸ The school's record of an adult responsible for a child MUST be independent of any login. A guardian
MAY exist with no account; an account MAY exist before any guardian link; a child MAY have several
guardians; disabling or deleting an account MUST NOT destroy the guardian record.
*Features* F-033. *Enforced at* `guardians.userId` nullable + `ON DELETE SET NULL`. *Why partial* the
separation is structural in the schema but not stated anywhere as a rule, so Stage 6 could collapse it.
*Stages* 6, 7, 16.

**BR-011 · A staff profile is not an account** — LOCKED (US-01) · PARTIAL
▸ A school's record of a teacher (department, subjects) MUST be separable from the login.
*Enforced at* `teacher_profiles` unique per `(userId, schoolId)`. *Stages* 6.

**BR-012 · Role comes from the session, never the request** — EXISTING · STRUCTURAL
▸ A caller's role MUST be resolved server-side from stored state. A request MUST NOT be able to assert
a role.
*Parity* B-1. *Stages* 7, 16.

**BR-013 · Authorisation is against the active context** — LOCKED (Stage 2 §4) · STRUCTURAL
▸ Where a person holds several contexts, every authorisation decision MUST be made against the context
currently active in the session, not the stored primary role.
*Why* Hiding UI enforces nothing. *Features* F-017. *Stages* 7.

**BR-014 · A context may be earned** — LOCKED (Stage 2 §4) · EXISTING
▸ A context MUST become available when the underlying relationship is real — a confirmed child link
grants the parent context; a current class assignment grants the teacher context — as well as when it
is explicitly granted.
*Consequence* "Who is a parent" is not answerable from the stored role alone. *Features* F-017, F-019.
*Stages* 6, 7.

**BR-015 · A context switch is validated and audited** — EXISTING · STRUCTURAL
▸ IF a switch is requested to a context the account does not hold, THEN it MUST be refused (403).
Every switch MUST be audited, and simulated switches MUST be distinguishable from real ones.
*Enforced at* `POST /api/auth/context`. *Parity* B-1. *Stages* 7, 19.

**BR-016 · Nobody changes their own authority** — EXISTING · STRUCTURAL
▸ A user MUST NOT change their own role, and MUST NOT suspend their own account.
*Enforced at* `enforceRoleUpdateGuards`, suspend handler. *Stages* 7.

**BR-017 · Platform authority is not grantable from the application** — EXISTING · STRUCTURAL
▸ `owner` and `platform_admin` MUST NOT be assignable or removable through any school-facing or
platform dashboard workflow.
*Enforced at* `enforceRoleUpdateGuards` (refuses for everyone, owners included). *Stages* 7, 16.

**BR-018 · A user's school is not editable** — EXISTING · STRUCTURAL
▸ A user record MUST NOT be moved between tenants through user administration.
*Why* Their students, allocations and payments do not follow them. *Parity* B-1 (S7). *Stages* 7.

**BR-019 · Only named fields are editable** — EXISTING · STRUCTURAL
▸ User updates MUST operate on an allowlist. Anything else in the request body MUST be ignored.
*Parity* B-1 (S7 — the body used to be spread wholesale, including `schoolId` and the MFA columns).
*Stages* 7, 14.

**BR-020 · Identity collisions are refused, not silently resolved** — EXISTING · STRUCTURAL
▸ IF a username or email change would collide with another account, THEN it MUST be refused (409).
*Why* A silent collision hands one person another person's account. *Enforced at* route checks +
`users_email_lower_unique_idx` on `lower(btrim(email))`. *Parity* B-1. *Stages* 6, 15.

**BR-021 · Disable is the normal way a staff member leaves** — LOCKED (US-04) · PARTIAL
▸ WHEN a staff member leaves, their access MUST be disabled and their sessions invalidated; their
historical actions MUST remain attributable.
*Features* F-020, F-021. *Why partial* suspend/reactivate/offboard-staff exist and work, but a
destructive `DELETE` remains reachable from the same admin surface. *Conflicts* **C-12**. *Stages* 7, 16.

**BR-022 · Deleting an account is a privacy operation, not an administrative one** — LOCKED (US-04) · CONFLICTING
▸ Erasure MUST be a controlled privacy process, MUST NOT be a routine dashboard action, and MUST NOT
be the mechanism for removing access.
*Features* F-022. *Enforced at* nowhere — `DELETE /api/users/:id` is an ordinary admin endpoint.
*Conflicts* **C-12**. *Stages* 7, 16.

**BR-023 · Removing a staff role must not remove a family relationship** — LOCKED (US-01, US-04) · STRUCTURAL
▸ IF a departing staff member is also a guardian at the school, THEN their staff roles MUST be removed
while their parent access and child links survive.
*Features* F-021 — already implemented, and refuses (409) when there is no parent role to preserve.
*Stages* 7.

**BR-024 · Deleting an account removes the claims that account left behind** — EXISTING · STRUCTURAL
▸ WHEN an account is erased, any child link keyed on its email address MUST be removed with it.
*Why* `parent_children` keys on an email string; an orphaned row could be claimed by anyone
registering that address. *Parity* B-1 (S3). *Stages* 6, 16.

**BR-025 · Parent access ends when no child requires it** — LOCKED (US-03) · UNENFORCED
▸ WHEN an account has no remaining active child relationship requiring portal access, THEN its access
MUST become inactive. The account and its history MUST NOT be destroyed.
*Why* A sibling or a new school relationship must remain possible without corrupting history.
*Features* F-035. *Conflicts* **C-15**. *Stages* 5, 6, 7, 16 (retention, reactivation, anonymisation).

**BR-026 · An invitation is single-purpose and expires** — EXISTING · STRUCTURAL
▸ An invitation MUST be stored hashed, MUST expire, and MUST be usable once.
*Facts today* staff/admin invites 7 days; password reset 1 hour; MFA challenge 5 minutes.
*Features* F-003, F-012, F-013. *Parity* B-1. *Stages* 16.

**BR-027 · Account discovery is not possible through recovery** — EXISTING · STRUCTURAL
▸ Password-reset responses MUST be identical whether or not the account exists.
*Parity* B-1. *Stages* 16.

**BR-028 · A privileged session is short; a family session is long** — EXISTING · STRUCTURAL
▸ Session lifetime MUST reflect the harm a stolen session can do.
*Facts today* platform/admin/finance/IT 8 h · teacher 24 h · parent 30 days. *Stages* 16.

**BR-029 · Success is not reported before the session is durable** — EXISTING · STRUCTURAL
▸ An authentication response MUST NOT be sent before the session has been persisted.
*Why* The client can redirect and land on "Not authenticated" after a successful sign-in.
*Parity* B-1. *Stages* 12.

**BR-030 · Platform authority requires a second factor** — EXISTING · PARTIAL
▸ A platform role MUST hold MFA to act.
*Why partial* Not required for `school_admin` or `finance` — the roles that touch money and pupil PII.
*Conflicts* **C-21**. *Stages* 16 (scope decision).

**BR-031 · Credential-guessing is bounded per account and per source** — EXISTING · STRUCTURAL
▸ Authentication and code-redemption attempts MUST be rate-limited on a key the client cannot forge.
*Facts today* sign-in 5/account/15 min and 50/IP/15 min · sign-up 5/IP/h · forgot 3/IP/15 min · reset
5/IP/15 min · MFA verify 10/user/15 min · console elevation 5/user/15 min. *Parity* B-6. *Stages* 16.

**BR-032 · A child is never a user** — LOCKED (D-09) · PARTIAL
▸ ScholarShelf MUST NOT issue accounts to students. A child is a domain entity managed by authorised
adults.
*Features* F-079. *Why partial* the role still exists in the enum, unreachable but present.
*Conflicts* **C-7**. *Stages* 7, 22.

---

# DOMAIN 3 — School configuration

**BR-033 · The school code resolves tenant identity** — LOCKED (US-02) · EXISTING
▸ A school's code MUST be the identifier through which its identity and configuration are resolved.
*Features* F-026. *Stages* 6, 8, 9.

**BR-034 · One product, one design system, tenant branding** — LOCKED (US-02) · PARTIAL
▸ A school MAY configure logo, colours, visual identity, permitted dashboard customisation, and its
school- and family-facing branding. A school MUST NOT receive a differently architected application:
UX architecture, components, accessibility, information architecture and interaction patterns remain
canonical.
*Features* F-025. *Stages* 8, 9, 10, 12.

**BR-035 · Core identity is core; website styling is the module** — LOCKED (US-02, D-05) · CONFLICTING
▸ School identity that drives dashboards, the portal and transactional email MUST belong to
ScholarShelf Core. The CMS module MUST consume it and MAY add website-specific styling on top.
*Enforced at* nowhere — today they are one surface. *Conflicts* **C-5**. *Stages* 8, 12, 13.

**BR-036 · Family-facing communication carries the school's identity** — LOCKED (PP-006) · EXISTING
▸ Communication to families MUST be presented as coming from the school.
*Features* F-061. *Conflicts* **C-24** (base64 logos likely stripped by major mail clients). *Stages* 17.

**BR-037 · Admin/finance separation is a school's choice** — LOCKED (US-05) · CONFLICTING
▸ Whether a school administrator also holds finance authority MUST be configurable per school. An
administrator MUST NOT hold finance authority merely because the role groups are coded together.
*Enforced at* the opposite is coded — `FINANCE_ROLES = [...ADMIN_UI_ROLES, "finance"]`.
*Conflicts* **C-13**. *Stages* 7.

**BR-038 · Finance's view of child data is configurable within least privilege** — LOCKED (US-07) · UNENFORCED
▸ A school MAY decide what finance sees beyond the reconciliation minimum — child identity, class
context, family association, amount required, settlement state, funding information. Configuration
MUST NOT be able to cross a tenant boundary or weaken a platform security control.
*Conflicts* **C-17**. *Stages* 6, 7.

**BR-039 · Fulfilment route is chosen per child, not per school** — LOCKED (Q-3) · UNENFORCED
▸ A child's fulfilment route MUST be explicit. The family MAY choose **authorised reception
collection** or **teacher hand-over to the student**. The selected route MUST determine the
subsequent custody and distribution workflow.
*Supersedes* the earlier school-wide framing, which is **withdrawn** — it MUST NOT survive as a
hidden default. Different children in the same class may legitimately use different routes.
*Why* Families differ: one parent collects at reception, another wants the book to reach the child in
class. Forcing a school-wide setting gets one of them wrong every time.
*Features* F-053a *(product meaning restated by this decision)*. *Enforced at* nowhere — no
fulfilment-route concept exists at any layer. *Conflicts* **C-35**, new **C-36**. *Stages* 5, 6, 9.

> **AMENDED IN STAGE 5 (owner decision OQ-1).** There are **three** routes conceptually:
> ① authorised reception collection · ② classroom delivery via the teacher · ③ **postal delivery —
> FUTURE, for online students, not required in this rebuild** (F-084, WF-068). The current product
> offers ① and ②. Additionally: **the route MUST be resolved before books are physically prepared for
> collection or transferred to a teacher.** Route changes follow physical reality — simple before
> transfer, a recorded operational transfer after, and historical (corrected, never rewritten) after
> final hand-over. See WF-047, WF-055.

**BR-040 · Level and class terminology is school-appropriate** — LOCKED (D-01) · CONFLICTING
▸ Class and level vocabulary MUST suit the school — UK mainstream year groups or a supplementary
school's own levels — without internationalising the product. Currency, locale and regulation remain UK.
*Enforced at* the opposite is coded — `formatYearGroup` normalises everything to Reception/Year 1–13.
*Conflicts* **C-1**. *Stages* 6, 10.

**BR-041 · School configuration is one concept** — LOCKED (derived from US-02/05/07, FQ-03) · UNENFORCED
▸ Per-school policy MUST be a single deliberate concept, not several unrelated settings.
*Why* Four locked decisions each assume a configuration surface; none exists. *Features* F-024.
*Conflicts* **C-17**. *Stages* 6, 7, 8.

---

# DOMAIN 4 — The book-supply cycle *(central domain)*

**BR-042 · One cycle per child per academic year, created at enrolment** — LOCKED (FQ-04, Q-1) · UNENFORCED
▸ For each child and each academic year there MUST be exactly one book-supply cycle, and it MUST be
created **when the child becomes enrolled/active for that academic year**. It MUST NOT wait for a
bundle assignment, a requirement, a basket, a payment, settlement or distribution.
*Consequence* A newly created cycle legitimately contains no requirements, £0 required, £0 payable,
nothing settled, nothing allocated and nothing distributed.
*Why* It is the record against which money, allocation and custody reconcile (PP-001) — and it must
exist before any of them do, or the un-provisioned child is invisible. *Features* F-083.
*Enforced at* nowhere — baskets, payments and allocations are loose records with no owning cycle.
*Stages* 5, 6, 15.

**BR-126 · An empty cycle does not mean "nothing is required"** — LOCKED (Q-1) · UNENFORCED
▸ The product MUST be able to distinguish **"this child has nothing to pay"** from **"this child has
not yet been provisioned"**. An empty cycle MUST NOT be interpreted as the former.
*Why* This is how a school notices the child nobody set up — the failure that hardship and omission
both hide behind. *Stages* 5 (state distinctions), 6 (representation), 9.

**BR-043 · Mid-year activity stays inside the cycle** — LOCKED (FQ-04) · UNENFORCED
▸ An initial requirement, a mid-year joining, a new bundle assignment, an additional required book, a
replacement, an extra-copy request, a correction, a later settlement or funding event, and a later
distribution MUST all be activity **within** the child's existing cycle. None of them MUST create a
new cycle.
*Stages* 5, 6.

**BR-127 · A cycle contains one or more requirement items** — LOCKED (Q-2) · UNENFORCED
▸ A cycle MUST be able to hold more than one requirement/settlement episode. Each item MAY carry its
own required amount, payable amount, subsidy or discount, payments and instalments, outstanding
amount, settlement state, and allocation and distribution consequences — while remaining part of the
same child × academic-year cycle.
*Applies to* mid-year additions · changed class requirements · replacements that must be paid for ·
extra required books · mid-year joiners · later subsidy or funding decisions.
*Enforced at* nowhere as a concept. *Conflicts* new **C-37**. *Stages* 5, 6, 15.

**BR-128 · A later requirement never reopens an earlier settlement** — LOCKED (Q-2) · PARTIAL
▸ IF a new requirement is added after an earlier one was settled, THEN the earlier settlement MUST
remain settled. The new amount MUST be outstanding on its own item.
*Example* September: Maths + English, £40, settled. January: Science, £15, outstanding. The £40 MUST
NOT become unpaid.
*Why partial* separate baskets and payments already do not reopen one another — but nothing groups
them, so nothing guarantees the relationship or reports it correctly. *Stages* 5, 6, 15.

**BR-129 · A cycle's position is the sum of its items** — LOCKED (Q-2) · UNENFORCED
▸ A cycle's required, payable, settled and outstanding values MUST be derivable from its items, and
MUST NOT be maintained as an independent total that can disagree with them.
*Why* Two sources of truth for money is the defect this whole domain exists to prevent.
*Stages* 6, 15.

**BR-044 · Only rollover creates the next cycle** — LOCKED (D-07, FQ-04) · UNENFORCED
▸ A new cycle MUST be created only by the school's explicit annual rollover.
*Features* F-032. *Stages* 5, 6.

**BR-045 · A past year is immutable in meaning** — LOCKED (D-07) · CONFLICTING
▸ Moving into a new academic year MUST NOT change what was true in a previous one. A historical report
MUST return the same answer after rollover as before it.
*Enforced at* the opposite happens — `students.classId` is a single mutable pointer, so promotion
retroactively rewrites every historical report. *Conflicts* **C-9**. *Stages* 6, 15.

**BR-046 · Immutable in meaning is not immutable to correction** — LOCKED (D-07) · UNENFORCED
▸ A historical record MAY receive a correction. What MUST NOT happen is a later year silently
rewriting an earlier one.
*Why* Without this, BR-045 would forbid legitimate corrections. *Stages* 4→5, 12.

**BR-047 · Rollover is explicit and deliberate** — LOCKED (D-07) · UNENFORCED
▸ Rollover MUST be an action a school administrator takes, covering advancing students, class changes,
new classes, leavers, joiners, and starting the next cycle. It MUST NOT happen implicitly by date.
*Features* F-032. *Stages* 5, 7.

**BR-048 · Year attribution is stamped, not derived** — EXISTING · PARTIAL
▸ A record that belongs to an academic year MUST carry that year at write time.
*Enforced at* `academicYear` on six tables, including baskets and payments. *Why partial* stamped in
some paths only, and nothing validates it. *Stages* 6, 15.

**BR-049 · A leaver's history survives** — LOCKED (D-07) · PARTIAL
▸ A student leaving MUST NOT remove their previous cycles.
*Enforced at* `students.status = alumni` + archive fields exist. *Conflicts* **C-9**. *Stages* 5, 6.

**BR-050 · A mid-year joiner gets a cycle for the current year** — LOCKED (FQ-04) · UNENFORCED
▸ A child enrolled part-way through a year MUST receive a cycle for that year, not be deferred.
*Features* F-031 (the student-level override is how this is handled today). *Stages* 5, 6.

---

# DOMAIN 5 — Classes and teacher assignment

**BR-051 · A teacher sees a class because they are assigned to it** — LOCKED (D-08) · PARTIAL
▸ A teacher MUST have access only to their currently assigned classes and the student and distribution
data those classes require.
*Enforced at* class-filtered for allocations; broader elsewhere. *Conflicts* **C-6**. *Stages* 7, 9.

**BR-052 · One canonical teacher→class resolution** — EXISTING · STRUCTURAL
▸ There MUST be exactly one operation that answers "which classes does this teacher have".
*Why* A second, slightly different lookup previously left subject-assigned teachers with an empty
distribution list and 404s on every action. *Enforced at* `storage.getTeacherClassIds` (reads both
storage models). *Parity* B-4 — must not be re-forked. *Stages* 12, 13.

**BR-053 · An assignment may be time-bounded** — LOCKED (US-10) · UNENFORCED
▸ A class assignment MAY carry a start and an end. WHEN it ends, the access it granted MUST end.
*Why* Cover teachers and TAs without a broad role, preserving BR-051. *Features* F-023.
*Conflicts* **C-14**. *Stages* 5, 6, 7.

**BR-054 · Cover is an assignment, never a role** — LOCKED (US-10) · N/A
▸ There MUST NOT be a `cover_teacher` role.
*Stages* 7.

**BR-055 · A teacher does not write student records** — EXISTING · PARTIAL
▸ A teacher MUST NOT create or edit a student record.
*Enforced at* route roles. *Stages* 7.

**BR-056 · A teacher does not hand over to their own child — hard block** — LOCKED (Q-4) · UNENFORCED
▸ A teacher MUST NOT perform or confirm distribution or hand-over for a student for whom that teacher
is recorded as a guardian. The hand-over MUST instead be completed by an authorised school
administrator.
*No exceptions.* There is no warn-and-continue, no per-school override, and no teacher
self-confirmation.
*Why* Segregation of duties over goods and money, in the one place a member of staff has a personal
interest.
*Enforced at* nowhere — no guardian-conflict check exists on any distribution path.
*Conflicts* new **C-38**. *Features* F-055. *Stages* 5 (operational workflow), 7 (authorisation
mechanism), 9 (how the screen presents it).

**BR-131 · A blocked hand-over is completed by an administrator** — LOCKED (Q-4) · UNENFORCED
▸ IF a child's route is teacher hand-over AND their assigned teacher is their guardian, THEN the
normal teacher hand-over MUST NOT proceed, and a school administrator MUST perform and record it.
*Why* The block must not leave the child without their books. *Stages* 5, 7, 9.

---

# DOMAIN 6 — Catalogue and requirements

**BR-057 · A book requirement comes from the class, not the child** — EXISTING · STRUCTURAL
▸ A child's required books MUST derive from the bundle assigned to their class.
*Features* F-041, F-042, F-045. *Stages* 5, 6.

**BR-058 · A child may have an override** — EXISTING · STRUCTURAL
▸ A child MAY have a book-level override that supersedes their class's bundle.
*Why* Mixed ability and mid-year joiners. *Features* F-031 — real, and undocumented until Stage 3.
*Stages* 5, 6.

**BR-059 · A bundle assignment is scoped to a year** — EXISTING · PARTIAL
▸ A class↔bundle assignment MAY be scoped to an academic year.
*Enforced at* `class_book_levels` optional academic year. *Stages* 6.

**BR-060 · Price is non-negative** — EXISTING · STRUCTURAL
▸ A book price MUST NOT be negative.
*Enforced at* `insertBookSchema` — now actually used by the route. *Parity* B-7. *Stages* 15.

**BR-061 · Money is exact** — EXISTING · STRUCTURAL
▸ Monetary values MUST be stored and totalled as exact decimals, never floating point.
*Enforced at* `numeric(10,2)`. *Conflicts* audit M4 — the digest converts money to float. *Stages* 15.

**BR-062 · Stock movement is recorded, not just applied** — EXISTING · STRUCTURAL
▸ Every stock change MUST leave a transaction record with its type, quantities before and after, and
who performed it.
*Features* F-043. *Stages* 6, 19.

**BR-063 · A required book with no stock is a visible fact** — EXISTING · PARTIAL
▸ IF a required book cannot be supplied, THEN the shortfall MUST be surfaced, not swallowed.
*Enforced at* extra-copy stock error surfaced (B-6); `out_of_stock` distribution status.
*Stages* 5, 9.

---

# DOMAIN 7 — Settlement

*The domain most changed by locked decisions. Six routes reach one position.*

**BR-064 · Six values, distinctly** — LOCKED (D-10) · UNENFORCED
▸ The product MUST distinguish **required value · payable value · subsidy or discount · amount
settled · amount outstanding · school-funded or waived amount**. These MUST NOT be collapsed into one
"total".
*Features* F-049. *Enforced at* nowhere — one `totalAmount` exists. *Conflicts* **C-8**, **C-11**.
*Stages* 5, 6, 15.

**BR-065 · One settled position, several legitimate routes** — LOCKED (D-02, D-10) · UNENFORCED
▸ A cycle's position MAY be settled by online payment, bank transfer with a reference, cash recorded
by finance, instalments, a school subsidy or discount, or the school funding it outright. Every route
MUST reach the same settled position. There MUST NOT be parallel accounting paths.
*Stages* 4→5, 6, 12, 15.

**BR-066 · A waiver is never a payment** — LOCKED (D-10, US-06) · UNENFORCED
▸ A school-funded or waived amount MUST NOT be recorded as money received, MUST NOT appear as revenue,
and MUST be distinguishable from a payment in every report.
*Why* Otherwise the school's own accounts are wrong, and hardship becomes invisible.
*Stages* 5, 6, 15.

**BR-067 · A subsidy reduces what is payable; it is not cash** — LOCKED (D-10) · UNENFORCED
▸ A discount or subsidy MUST reduce the payable value, MUST NOT be recorded as an amount received, and
MUST remain attributable to whoever granted it.
*Stages* 5, 6.

**BR-068 · Instalments accumulate** — LOCKED (D-10) · UNENFORCED
▸ Several payments MAY contribute to one position. The position MUST be settled only when the
outstanding amount reaches zero.
*Consequence* "Paid" stops being a boolean. *Stages* 5, 6, 15.

**BR-069 · Finance authorises funding, waiver, subsidy and discount** — LOCKED (US-06) · UNENFORCED
▸ These MUST be authorised by finance (or by a school administrator where the school has configured
that overlap — BR-037), MUST be explicit, MUST be attributable to a named person, and MUST be audited.
*Note* No approval threshold or counter-authorisation is created. IF Stage 5 shows the workflow needs
one, that returns to the owner rather than being invented. *Stages* 5, 7, 19.

**BR-070 · Cash is recorded by an authorised person, not claimed by a family** — LOCKED (D-10) · UNENFORCED
▸ A cash payment MUST be recorded by school staff with settlement authority; a family MUST NOT be able
to assert it.
*Open point* Real schools take cash at reception (Stage 2 §9). Today reception passes it to finance;
if that proves unworkable it becomes a delegated capability or a configuration, **not a new role**.
*Stages* 5, 7.

**BR-071 · A family claims; finance confirms** — EXISTING · STRUCTURAL
▸ A family MAY assert that they have paid. A family MUST NOT set a settlement status.
*Parity* B-6. *Stages* 7.

**BR-072 · A payment reference is unique within a school** — EXISTING · STRUCTURAL
▸ A payment reference MUST be unique per school, compared case- and whitespace-insensitively.
*Enforced at* unique index on `(school_id, upper(btrim(reference)))` **and** application-level
duplicate detection normalising identically. *Parity* B-3 — "application validation and database
constraints must agree". *Stages* 15.

**BR-073 · One order per basket** — EXISTING · STRUCTURAL
▸ A basket MUST NOT carry more than one payment.
*Enforced at* 409 `duplicate_order` + unique index on `basket_payments(basket_id)`. *Parity* B-3.
*Stages* 15.

**BR-074 · One basket per child per requirement** — EXISTING · STRUCTURAL
▸ Repeating the create action MUST NOT produce a second pending basket.
*Why* Double-click previously created two pending baskets and a double-pay risk. *Parity* B-3.
*Stages* 5.

**BR-075 · A family settles once across siblings** — EXISTING · STRUCTURAL
▸ One payment MAY cover several children's baskets.
*Enforced at* `basket_payments`. *Parity* B-3. *Stages* 5, 6.

**BR-076 · Online payment must be possible without rebuilding settlement** — LOCKED (D-02) · UNENFORCED
▸ The settlement model MUST be capable of an online payment route without restructuring the others.
*Note* No payment implementation before Stages 12/17. *Features* F-050. *Conflicts* **C-2** — the
portal advertises card checkout that does not exist. *Stages* 12, 14, 17.

---

# DOMAIN 8 — Confirmation and allocation

**BR-077 · Confirmation, stock movement and allocation are one act** — EXISTING · STRUCTURAL
▸ Confirming a settled position, deducting stock and allocating books to the child MUST succeed
together or not at all.
*Why* The product's core invariant (PP-001, PP-002). *Enforced at* `storage.confirmPayment`, one
transaction. *Parity* **B-3 in full**. *Stages* 12, 15.

**BR-078 · Confirmation is claimed exactly once** — EXISTING · STRUCTURAL
▸ IF two confirmations race, THEN exactly one MUST produce side effects; the other MUST return the
current state unchanged.
*Enforced at* conditional `UPDATE … WHERE status NOT IN (…) RETURNING *`. *Note* The original race
did not reproduce; the lock is kept because it makes the outcome structural rather than timing-
dependent. *Stages* 12.

**BR-079 · Insufficient stock fails the whole confirmation** — EXISTING · STRUCTURAL
▸ IF stock is insufficient, THEN nothing MUST change, and the message MUST name the title.
*Enforced at* no `catch {}` around the deduction; message *"Not enough stock: <title>. Restock before
confirming — nothing has been changed."* *Parity* B-3. *Stages* 5, 18.

**BR-080 · Nothing leaves the shelf unaccounted for** — LOCKED (PP-002) · PARTIAL
▸ Books MUST NOT be allocated until the position is settled, **or** an authorised exception is
recorded. "It got handed out somehow" MUST NOT be representable.
*Why partial* true today for payment; the exception routes (BR-065…BR-070) do not exist yet.
*Stages* 5, 12.

**BR-081 · A legacy partial run must not be re-applied** — EXISTING · STRUCTURAL
▸ IF a basket has already been allocated, THEN confirmation MUST NOT allocate it again.
*Why* Baskets may have been half-processed by the old non-transactional code. *Parity* B-3. *Stages* 12.

**BR-082 · Allocation, distribution and custody are three different facts** — EXISTING · STRUCTURAL
▸ The allocation lifecycle, the teacher hand-over state and the physical custody state MUST remain
distinct and MUST NOT be merged.
*Parity* B-4. *Conflicts* see BR-083. *Stages* 5, 6, 15.

**BR-083 · One real-world event is modelled once** — LOCKED (FQ-03) · CONFLICTING
▸ A single real-world event MUST NOT be represented by two competing status vocabularies.
*Evidence* Six overlapping vocabularies exist today: `PAYMENT_STATUSES` (incl.
`ready_for_collection`, `collected`), `ORDER_STATUSES` (incl. `pending_student_collection`,
`partially_distributed`, `distributed`), `DISTRIBUTION_STATUSES`, `ALLOCATION_STATUSES`, custody
states, and `child_book_baskets.status`. *Conflicts* **C-35**. *Stages* 5, 6, 15.

**BR-084 · A declared status set matches what the code writes** — EXISTING · STRUCTURAL
▸ Status constants MUST match the values actually written, and MUST be enforced by the database.
*Enforced at* migration 006 builds each CHECK from *declared ∪ values already present*, so it cannot
reject a row production writes today; undeclared values are raised as NOTICEs.
*Rule for the future* Any new constraint MUST be built the same way. *Stages* 15.

---

# DOMAIN 9 — Physical custody

*D-03 requires full custody. FQ-02 and FQ-03 bound it. The state model below is **derived from the
product**, not adopted from the current machine.*

**BR-085 · A copy has one custodian at a time** — LOCKED (D-03) · UNENFORCED
▸ At any moment a physical copy MUST have exactly one recorded position: with the school, with a
teacher, or with a child.
*Features* F-044, F-053. *Stages* 5, 6.

**BR-086 · Custody advances through real events** — LOCKED (D-03) · CONFLICTING
▸ A custody change MUST correspond to something that physically happened. The lifecycle the product
needs is: *available → reserved for a child → prepared → handed to a teacher (where the school uses
classroom distribution) → issued to the child → sale complete*, with exceptions for absent, damaged
and lost.
*Enforced at* a machine exists but `tryCustody` swallows every illegal transition, so it records
rather than enforces. *Conflicts* **C-3**. *Stages* 5, 6.
*Instruction from Stage 3:* **do not patch the current constants to make tests pass.**

**BR-087 · Custody follows the child's chosen route** — LOCKED (Q-3) · CONFLICTING
▸ Custody MUST support two legitimate paths, selected per child:
```
RECEPTION   prepared → ready for reception collection → handed to parent/family → collected
TEACHER     prepared → handed to teacher → teacher holds custody → handed to student → issued
```
Where the route is teacher hand-over, issuing to the child completes the hand-over in one action;
where it is reception collection, readiness and hand-over are separate events. The product MUST NOT
force one physical path on every child.
*Note* These labels are **not** the final state-machine vocabulary — Stage 5 derives the workflow
first, Stage 6 the model. *Features* F-053a. *Conflicts* **C-35**, **C-36**. *Stages* 5, 6, 9.

**BR-088 · "Handed to teacher" is a real step on the teacher route** — LOCKED (D-03, Q-3) · UNENFORCED
▸ WHERE a child's route is teacher hand-over, the transfer from the school's stock into the teacher's
custody MUST be recordable, and the teacher MUST be able to hold custody of books not yet given out.
*Features* F-054 — declared as a state, driven by nothing, with no screen.
*Actor* school admin or authorised operations — **no stockroom role** (US-09). *Stages* 5, 9.

**BR-130 · Reception collection requires an authorised recipient** — LOCKED (Q-3) · UNENFORCED
▸ WHERE a child's route is reception collection, the hand-over MUST record that the books were given
to the parent or an authorised family member, and MUST be performed by school staff.
*Why* A book leaving reception with the wrong adult is the failure this route creates. Who counts as
authorised follows from the guardian record (BR-010), not from an ad-hoc name.
*Stages* 5, 7, 9.

**BR-089 · The sale completes at issue** — LOCKED (D-04) · UNENFORCED
▸ WHEN a book is issued to a child, the sale MUST be complete. There MUST NOT be an expected return.
*Stages* 5, 6.

**BR-090 · `returned` is not part of the normal lifecycle** — LOCKED (FQ-02) · CONFLICTING
▸ A return MUST NOT be a normal custody state for every book.
*Enforced at* the opposite is declared — `returned` sits in the custody machine, in
`book_copies.status`, and as an inventory transaction type. *Conflicts* **C-4**.
*Note* Those fields **stay in place** until Stages 4–6 decide what survives as BR-091. *Stages* 5, 6.

**BR-091 · A return is an exceptional correction** — LOCKED (FQ-02) · UNENFORCED
▸ A sold book MAY come back only as a correction or refund — wrong book supplied, duplicate issue,
incorrect order, cancelled sale, refund, damaged on issue, administrative correction. The chain MUST
be: *original sale → return/correction event → financial correction if applicable → physical book
received → inspection → restock, damaged or disposed.* The original sale MUST NOT be erased.
*Features* F-082. *Stages* 5, 6.

**BR-092 · A damaged or lost copy leaves stock explicitly** — EXISTING · PARTIAL
▸ A copy that is damaged or lost MUST be removed from available stock by a recorded event, not by
silent adjustment.
*Enforced at* `book_copies.status`, inventory transaction types. *Stages* 5, 6.

**BR-093 · Backfill is not state** — ACCIDENT · UNENFORCED
▸ Custody state MUST NOT depend on per-process memory.
*Evidence* `ensureCustodyBackfill` uses a module-level `Set`, which in a serverless function is
per-instance and re-runs on every cold start. *Classification* implementation accident — record it,
do not build on it. *Stages* 12, 13.

---

# DOMAIN 10 — Import

*FQ-01: one capability, two modes.*

**BR-094 · Two import modes, one capability** — LOCKED (FQ-01) · DUPLICATED
▸ ScholarShelf MUST support importing **students only** and importing **students with families and
guardians**. Both MUST obey the same rules for identity, duplicates, transactions and invitations.
*Enforced at* two separate pipelines with different guarantees. *Conflicts* **C-26**. *Stages* 5, 13, 22.

**BR-095 · An import commits completely or not at all** — EXISTING · STRUCTURAL
▸ All data changes in one import MUST occur in a single transaction.
*Enforced at* `commitImport` — and the school snapshot is re-read **inside** the transaction so
decisions are made against committed state. *Parity* B-5. *Stages* 12.

**BR-096 · Email is sent after the commit, never inside it** — EXISTING · STRUCTURAL
▸ Invitations MUST be sent only after the import has committed, and a mail failure MUST NOT lose the
import.
*Why* A send is slow and cannot be un-sent; an outage must not destroy an import of 300 families.
*Parity* B-5. *Stages* 12, 18.

**BR-097 · Re-running an import does not invalidate live invitations** — EXISTING · STRUCTURAL
▸ Repeating an import MUST NOT re-issue a code that is already in a guardian's inbox.
*Parity* B-5. *Stages* 5.

**BR-098 · An import previews before it commits** — EXISTING · STRUCTURAL
▸ An import MUST be analysable before it changes anything.
*Enforced at* both pipelines (`analyze`/`commit`, `preview`/`confirm`) — one of the few things they
agree on. *Stages* 5, 9.

**BR-099 · Identity resolution is deterministic** — EXISTING · PARTIAL
▸ Matching a row to an existing student, family, guardian or class MUST follow one stated rule set,
and MUST be the same in both import modes.
*Enforced at* separate resolvers in the enrolment service; the student-only path resolves differently.
*Conflicts* **C-26**. *Stages* 4→5, 13.

**BR-100 · Guardian email identity is normalised once** — EXISTING · STRUCTURAL
▸ Email identity MUST be compared case- and whitespace-insensitively everywhere.
*Enforced at* `users_email_lower_unique_idx`, `parent_children_identifier_lower_idx`. *Parity* B-5.
*Stages* 15.

**BR-101 · An import may create classes; it may not create tenants** — EXISTING · STRUCTURAL
▸ Class resolution MAY create a missing class within the session's school. An import MUST NOT reach
another school.
*Stages* 5, 7.

**BR-102 · A completed enrolment issues a linking code** — EXISTING · STRUCTURAL
▸ WHEN an enrolment completes, a linking code MUST be issued and the guardian's portal status set to
invited.
*Note* A test previously asserted `none`; **the test was corrected, not the code** — this is shipped
behaviour. *Parity* B-5. *Stages* 5.

**BR-103 · Failed delivery is recoverable** — EXISTING · STRUCTURAL
▸ There MUST be an idempotent way to re-send pending invitations.
*Enforced at* `POST /api/families/invitations/send-pending`, rate-limited 4/school/hour.
*Features* F-038. *Stages* 5.

---

# DOMAIN 11 — Linking and distribution

**BR-104 · A code is the only route from an account to a child** — EXISTING · STRUCTURAL
▸ Linking a guardian account to a child MUST require a code that is email-bound, single-use, expiring
and rate-limited, and the redemption MUST be audited.
*Facts today* codes expire at 30 days; rate limit is keyed on the user. *Parity* B-6. *Stages* 7, 16.

**BR-105 · A preview reveals nothing beyond the name** — EXISTING · STRUCTURAL
▸ Previewing a code MUST NOT disclose PII beyond the child's name.
*Parity* B-6. *Stages* 9.

**BR-106 · Preview and confirmation agree** — EXISTING · STRUCTURAL
▸ A code accepted at preview MUST be accepted at confirmation.
*Why* A parent previously saw their child's name and was then told "Invalid linking code" because the
two steps normalised differently. *Parity* B-6. *Stages* 12.

**BR-107 · The wrong person is told they are the wrong person** — EXISTING · STRUCTURAL
▸ IF a code belongs to another email, THEN the refusal MUST be distinguishable (403) from an invalid
code (404).
*Parity* B-6. *Stages* 18.

**BR-108 · Linking succeeds even if the follow-up does not** — EXISTING · STRUCTURAL
▸ Binding a guardian record to the account after redemption is best-effort and MUST NOT roll back a
successful redemption.
*Parity* B-6. *Stages* 12, 18.

**BR-109 · Hand-over requires a settled position** — LOCKED (PP-002) · PARTIAL
▸ A teacher MUST NOT record a hand-over for a child whose cycle is not settled — by payment, funding,
subsidy or waiver.
*Why partial* true for payment today; the other routes do not exist. *Stages* 5, 7.

**BR-110 · The classroom records what actually happened** — EXISTING · STRUCTURAL
▸ Hand-over MUST be able to record received, absent, out of stock, and an issue — not only success.
*Features* F-055. *Parity* B-4. *Stages* 5, 9.

**BR-111 · Partial distribution is a real state** — EXISTING · PARTIAL
▸ A child MAY receive some of their books and not others.
*Stages* 5, 6.

**BR-112 · An extra copy is requested, not taken** — EXISTING · STRUCTURAL
▸ A teacher MAY request an additional copy; it MUST be approved before it affects stock.
*Features* F-056. *Stages* 5, 7.

> **AMENDED IN STAGE 5 (owner decision OQ-3).** This rule treated the request as one approve/reject
> act. It is now **four distinct real-world events** that MUST NOT be collapsed:
> `TEACHER REQUEST → ADMIN OPERATIONAL REVIEW → FINANCE CHARGE DECISION → FAMILY SETTLEMENT`.
> The teacher states **what is needed and why** — a reason is mandatory — and **MUST NOT** decide
> whether the family is charged. Two branches:
> **(A) problem found *before* a successful hand-over** — wrong book, wrong copy, damaged or defective
> on issue, any school/supply-side error: the original does not count as handed over, a replacement is
> provided, and **no family charge arises**.
> **(B) a replacement needed *after* a successful hand-over** — lost, damaged, destroyed: **finance**
> decides whether it is chargeable. If not, the school absorbs it. If so, a **new requirement item** is
> created inside the child's existing annual cycle (BR-127, BR-128) and the family is notified.
> See WF-034, WF-069, WF-070, WF-071. New conflict **C-39**.

**BR-113 · The classroom surface must work standing up** — LOCKED (PP-007) · UNENFORCED
▸ Hand-over MUST be usable on a phone, one-handed, by someone with a class in front of them.
*Enforced at* nothing — Stage 0 found 24px tap targets and hover-only controls on exactly this screen.
*Stages* 9, 10.

---

# DOMAIN 12 — Corrections

**BR-114 · Correct forward, do not erase** — LOCKED (derived from PP-008, D-07) · PARTIAL
▸ A mistake MUST be corrected by a recorded compensating event, not by rewriting or deleting the
original record.
*Applies to* payment correction, wrong book, return/refund, stock correction, mistaken hand-over,
mistaken allocation, incorrect subsidy, mistaken student assignment.
*Enforced at* partially — the console has a typed "payment status correction" operation; most other
paths mutate in place. *Stages* 5, 6, 12, 19.

**BR-115 · A correction names its reason and its author** — LOCKED (PP-008) · PARTIAL
▸ Every correction MUST record who made it, when, and why.
*Enforced at* console operations require a reason; ordinary admin corrections do not. *Stages* 5, 19.

**BR-116 · A financial correction and a physical correction are separate facts** — LOCKED (FQ-02) · UNENFORCED
▸ Money returning and a book returning MUST be recordable independently — one may happen without the
other.
*Why* A refund may be given without the book coming back, and a wrong book may be swapped with no
money moving. *Features* F-082. *Stages* 5, 6.

**BR-117 · A cancelled cycle keeps its history** — EXISTING · PARTIAL
▸ Cancelling an order MUST leave the record and its history intact.
*Enforced at* `cancelled` exists in payment, order and allocation vocabularies. *Stages* 5, 6.

---

# DOMAIN 13 — Audit

**BR-118 · Money is always attributable** — EXISTING · STRUCTURAL
▸ Every settlement, confirmation, rejection and financial correction MUST record who, what, when and
the resulting state.
*Stages* 19.

**BR-119 · Funding decisions are always attributable** — LOCKED (D-10, US-06) · UNENFORCED
▸ Every waiver, subsidy, discount and school-funded position MUST record who authorised it and why.
*Why* It is money the school chose not to receive. *Stages* 19.

**BR-120 · Access to children's data is attributable** — EXISTING · PARTIAL
▸ Reads and writes of child PII by privileged roles MUST be auditable.
*Enforced at* writes audited; reads largely not. *Stages* 16, 19.

**BR-121 · Platform actions are attributable** — EXISTING · STRUCTURAL
▸ Tenant lifecycle changes, support-mode entry and exit, console operations, elevations and
destructive operations MUST all be audited.
*Parity* B-8 — the old console logged nothing while routine logins were audited. *Stages* 19.

**BR-122 · Configuration changes are attributable** — LOCKED (US-02/05/07, FQ-03) · UNENFORCED
▸ Changing a school's policy — finance authority, finance visibility, distribution method, branding —
MUST be audited.
*Features* F-024. *Stages* 19.

**BR-123 · Custody and distribution are attributable** — LOCKED (D-03) · PARTIAL
▸ Every custody transition and hand-over MUST record who performed it and when.
*Enforced at* `custody_events` records actor and role; illegal transitions are swallowed, so the
record can be incomplete. *Conflicts* **C-3**. *Stages* 12, 19.

**BR-124 · An audit trail never contains a live credential** — EXISTING · CONFLICTING
▸ Logs and audit records MUST NOT contain password-reset links, invitation links, or a family's
contact details alongside a payment reference.
*Enforced at* the opposite happens in four places when email delivery fails — `auth.routes.ts:450`,
`owner.routes.ts:641`, `console/operations.ts:127`, `parent.routes.ts:350`, none dev-gated.
*Conflicts* **C-18**. *Stages* 16, 19.

**BR-125 · A failed request is never reported as a settled fact** — LOCKED (PP-009) · PARTIAL
▸ A failed read MUST NOT render as zero, empty or "all caught up".
*Why* Finance must not report "£0.00 taken" because a request dropped. *Enforced at*
`query-state.tsx` — adopted by 2 of 42 pages. *Conflicts* **C-32**. *Stages* 9, 13.

---

# SUMMARY

## 1. Total business rules

**131 rules** across 13 domains. Six were added by the Stage 4 locking decisions: **BR-126** (empty
cycle ≠ nothing required, Q-1) · **BR-127**, **BR-128**, **BR-129** (requirement items, Q-2) ·
**BR-130** (authorised recipient at reception, Q-3) · **BR-131** (administrator completes a blocked
hand-over, Q-4). Six existing rules were rewritten: **BR-039**, **BR-042**, **BR-043**, **BR-056**,
**BR-087**, **BR-088**.

## 2. Rules by domain

| Domain | Rules | Count |
|---|---|---|
| 1 · Tenant isolation | BR-001–009 | 9 |
| 2 · Accounts and identity | BR-010–032 | 23 |
| 3 · School configuration | BR-033–041 | 9 |
| 4 · Book-supply cycle | BR-042–050, 126–129 | 13 |
| 5 · Classes and teacher assignment | BR-051–056, 131 | 7 |
| 6 · Catalogue and requirements | BR-057–063 | 7 |
| 7 · Settlement | BR-064–076 | 13 |
| 8 · Confirmation and allocation | BR-077–084 | 8 |
| 9 · Physical custody | BR-085–093, 130 | 10 |
| 10 · Import | BR-094–103 | 10 |
| 11 · Linking and distribution | BR-104–113 | 10 |
| 12 · Corrections | BR-114–117 | 4 |
| 13 · Audit | BR-118–125 | 8 |

## 2a. Enforcement tally

| | Count |
|---|---|
| STRUCTURAL | 59 |
| PARTIAL | 26 |
| UNENFORCED | 35 |
| CONFLICTING | 11 |
| **Total** | **131** |

*Correction to the previous draft: the structural count was stated as 55 and the partial/unenforced
lists did not sum to the stated total. Recounted from the per-rule tags, the pre-decision figures were
59 / 25 / 30 / 11 = 125. The table above is the post-decision recount.*

**There are no OPEN rules.** BR-056 was the last one and is now locked.

## 3. Strongly enforced (STRUCTURAL) — 59

The product's real backbone. Notably: the tenant choke point (BR-001, 002, 007), storage-level foreign
key assertions (BR-006), the confirmation transaction and its claim-lock (BR-077, 078, 079, 081),
reference and basket uniqueness with matching DB constraints (BR-072, 073, 074), the import
transaction and its email-after-commit contract (BR-095, 096, 097), the linking-code defences
(BR-104–108), and the canonical teacher lookup (BR-052).

## 4. Partially enforced — 26

BR-005, 010, 011, 021, 030, 032, 034, 048, 049, 051, 055, 059, 062, 063, 080, 092, 099, 109, 111,
114, 115, 117, 120, 123, 125, **128**.

The pattern is consistent: **the server-side security boundary is strong; consistency of presentation
and of lifecycle is weak.**

## 5. UI-only rules — 0 found

Notable, and to the codebase's credit. The Stage 0 audit's "authorization as silent client redirects"
(M2) is real but concerns *navigation*, not authorisation — `requireRole` runs server-side in every
case examined. The one place a UI-only rule would be expected — the admin section allowlists in
`admin.tsx` — controls which screen renders, not what the API permits.

## 6. Not enforced anywhere — 35

Every one traces to a locked Stage 1–4 decision the code has not caught up with:

- **Cycle** BR-042, 043, 044, 046, 047, 050, **126**, **127**, **129**
- **Settlement** BR-064, 065, 066, 067, 068, 069, 070, 076
- **Custody & fulfilment** BR-085, 088, 089, 091, **130**
- **Configuration** BR-038, 039, 041
- **Identity & access** BR-025, 053, **056**, **131**
- **Audit** BR-119, 122
- **Correction** BR-116
- **Other** BR-054 (n/a by design), BR-093 (implementation accident), BR-113

## 7. Contradicted by current code — 11

| Rule | The code does the opposite |
|---|---|
| BR-022 | Deletion is an ordinary admin endpoint |
| BR-035 | Core identity and website styling are one surface |
| BR-037 | `FINANCE_ROLES` hard-codes admins as finance |
| BR-040 | `formatYearGroup` normalises every school to Reception/Y1–13 |
| BR-045 | `students.classId` is mutable, so rollover rewrites history |
| BR-083 | Six overlapping status vocabularies model the same events |
| BR-086 | `tryCustody` swallows illegal transitions |
| BR-087 | Both distribution models ship, forced on every school |
| BR-090 | `returned` is declared as a normal state in three places |
| BR-124 | Live links and PII are logged on email failure, un-gated |
| BR-094 | Two import pipelines with different guarantees |

## 8. Inherited from the Stage 0 parity contract — 41

Rules carrying a `Parity` reference to `CURRENT_BEHAVIOUR_BASELINE.md`: BR-001, 002, 006, 007, 008,
012, 015, 018, 019, 020, 024, 026, 027, 028, 029, 031, 052, 060, 063, 071, 072, 073, 074, 075, 077,
078, 079, 081, 082, 095, 096, 097, 100, 102, 104, 105, 106, 107, 108, 110, 121.

**These must survive the rebuild.** They are the rules with demonstrated failure modes behind them.

## 9. New rules created by Stage 1–3 decisions — 38

| Decision | Rules created |
|---|---|
| D-01 UK, both sectors | BR-040 |
| D-02 online payment eventually | BR-065, 076 |
| D-03 full custody | BR-085, 086, 088, 123 |
| D-04 books are sold | BR-089 |
| D-05 + US-02 CMS module / core identity | BR-033, 034, 035 |
| D-06 internal platform tier | BR-004, 008 |
| D-07 rollover | BR-044, 045, 046, 047, 049 |
| D-08 teacher scope | BR-051 |
| D-09 no student users | BR-032 |
| D-10 settlement routes | BR-064, 066, 067, 068, 070, 119 |
| US-01 person ≠ account | BR-003, 010, 011, 023 |
| US-03 parent access lifecycle | BR-025 |
| US-04 disable not delete | BR-021, 022 |
| US-05 configurable finance authority | BR-037 |
| US-06 finance authorises funding | BR-069 |
| US-07 configurable finance visibility | BR-038 |
| US-10 temporary assignment | BR-053, 054 |
| FQ-01 two import modes | BR-094 |
| FQ-02 exceptional return | BR-090, 091, 116 |
| FQ-03 distribution method | BR-039, 083, 087 |
| FQ-04 the cycle | BR-042, 043, 050 |
| **Q-1** cycle opens at enrolment | BR-042 (rewritten), **126** |
| **Q-2** requirement items | **127**, **128**, **129** |
| **Q-3** fulfilment route per child | BR-039 (rewritten), BR-087, BR-088 (rewritten), **130** |
| **Q-4** guardian hard block | BR-056 (locked), **131** |
| PP-009 failed ≠ settled | BR-125 |

## 9a. New conflicts recorded by the Stage 4 decisions

| # | Conflict | Owning stage |
|---|---|---|
| **C-36** | **No fulfilment-route concept exists at any layer.** Q-3 makes the route a per-child, family-chosen fact; the code has no place to record it and no workflow that branches on it. The earlier school-wide framing in F-053a is **withdrawn** and must not survive as a hidden default. | 5, 6, 9 |
| **C-37** | **No requirement-item concept exists.** A child has one basket with one `totalAmount`. Q-2 requires a cycle to hold several separately settled items. | 5, 6, 15 |
| **C-38** | **No guardian-conflict check exists on any distribution path.** Q-4 is a hard block; nothing today would stop a teacher confirming hand-over to their own child. | 5, 7, 9 |

## 10. Owner decisions — all four **DECIDED**

| ID | Question | Decision | Rules affected |
|---|---|---|---|
| **Q-1** | When does a cycle begin? | **A — at enrolment.** It does not wait for a bundle, requirement, basket, payment, settlement or distribution. An empty cycle is legitimate, and must be distinguishable from "nothing required" | BR-042, BR-126 |
| **Q-2** | Can requirements change after settlement? | **B — a new requirement is a separately settled item inside the same annual cycle.** A January addition must not make September's settled £40 appear unpaid | BR-127, BR-128, BR-129 |
| **Q-3** | How do books reach the child? | **Per child, family-chosen** — authorised reception collection **or** teacher hand-over. Not per school, not per class. Children in the same class may differ | BR-039, BR-087, BR-088, BR-130 |
| **Q-4** | Teacher handing over to their own child? | **Hard block.** No warning-and-continue, no configuration override, no self-confirmation. An administrator performs and records it instead | BR-056, BR-131 |

**No open owner decisions remain in Stage 4.**

## 11. Superseded within earlier stages

`FEATURE_INVENTORY.md` F-053a was written as *"distribution method (classroom vs office), a school
choice"*. The Q-3 decision **replaces that product meaning** with a per-child, family-chosen
fulfilment route. Recorded here rather than silently rewritten; the Stage 3 entry carries a
supersession note.

## 12. Note on Q-3's effect

Q-3 is the decision with the widest reach, because it moves a fact the code has no home for from the
school level to the child level. Two consequences worth carrying into Stage 5:

1. **The route is chosen, so there is a choosing.** Somebody, at some moment, picks it. Stage 5 must
   establish when the family chooses, what the default is if they do not, and whether the choice can
   change after books are prepared. *(If changing the route mid-flight needs a product rule rather
   than a workflow, that returns to the owner rather than being invented — see Stage 5.)*
2. **Two paths, one completed outcome.** Both routes end with the same real-world fact — the child
   has their books. The final model must not represent that fact twice because it arrived by two
   routes. This is the same trap BR-083 already names.

---

## What Stage 4 deliberately did not do

No workflow diagrams (Stage 5), no entities (Stage 6), no permission matrix (Stage 7), no state
machines beyond naming the events they must represent, no schema (Stage 15), and **no selection
between competing implementations** — including the two import pipelines and the six status
vocabularies. Naming a contradiction is not resolving it.

---

## Amendment register — Stage 4

**Append-only. Later stages may implement these rules and may record traceable owner amendments here.
They must not silently rewrite them. If a later finding conflicts with anything above: FLAG THE
CONFLICT.**

**Verified before assigning: Stage 4 had no amendment register and no prior amendment. A4-001 is the
first.**

### A4-001 · BR-095's import transaction boundary, reconciled with locked Stage 18

```
A4-001 · Import transaction granularity
RAISED BY   Stage 20 as C-105, 31 August 2026
DECIDED BY  THE OWNER — BytHub Technology Ltd, 1 September 2026
AFFECTS     BR-095 · and, by reference, BR-096 · BR-098 · WF-021
TYPE        TARGET CLARIFICATION.  BR-095's identifier, text and history stand.
STATUS      RECORDED.  This amendment governs the TARGET.
```

**THE CHRONOLOGY, because that is what makes this a reconciliation rather than a rewrite.**

```
STAGE 4    BR-095 recorded as EXISTING · STRUCTURAL
           "All data changes in one import MUST occur in a single transaction."
           Enforced at commitImport.  Stages: 12.
           ── this was, and remains, a TRUE DESCRIPTION OF THE CURRENT SYSTEM

STAGE 4    WF-021 already anticipated the tension, in its own words:
           "Open point — whether a partial commit is permitted at all. BR-095 says
            an import commits completely or not at all — which is about ATOMICITY
            OF THE COMMITTED SET, not about whether excluded rows may be dropped."

STAGE 18   OPS-D021 decided the target explicitly, naming and REJECTING the
           all-or-nothing chunk:
           "each LOGICAL ROW is one transaction … a chunk of 100 is a BATCHING
            UNIT for progress and memory, NOT a rollback unit"

STAGE 20   raised the contradiction as C-105 rather than silently picking a side.

OWNER      1 September 2026: Stage 18 OPS-D021 governs the target.
```

**THE TARGET — two boundaries, and they are different kinds of thing.**

**A · PREVIEW / VALIDATION — a workflow boundary**

```
upload ─► parse ─► map ─► validate ─► PREVIEW

PREVIEW WRITES NO PRODUCT TRUTH.

Where unresolved invalid rows remain, normal commit is NOT AVAILABLE
   ── unless the administrator uses the already-locked explicit ROW-EXCLUSION
      workflow (WF-021), in which case the excluded rows are excluded and the
      remainder commits.

BR-098 is unchanged: an import previews before it changes anything.
```

**B · COMMIT — a database boundary**

```
EACH LOGICAL ROW IS ONE ATOMIC BUSINESS UNIT.

WITHIN one logical row        child · family / guardian relation ·
                              class membership · requirements ·
                              and every required dependent fact
                              ── ALL COMMIT, OR NONE COMMIT

ACROSS rows                   row 1 may commit
                              row 2 may commit
                              row 3 may fail
                              ── and rows already committed REMAIN COMMITTED

DURABLE PROGRESS              the import session records progress after each row
RESUME                        does not duplicate a committed row      OPS-D022
HALF-COMMITTED ROW            IMPOSSIBLE — a logical row is one transaction

A CHUNK                       is a batching / memory / progress unit
                              ── IT IS NOT A ROLLBACK UNIT
```

**Why the target differs from what BR-095 describes, in the owner's terms:** Stage 18 stated the
admin-visible consequence plainly — *"a single bad row on line 63 would discard 99 good ones, and the
admin would re-upload the whole file to fix one typo."* **A 200-row spreadsheet with three typos is
the ordinary case, not the exceptional one.**

**What is NOT changed by this amendment**

| | |
|---|---|
| **BR-095's identifier and text** | **unchanged, and not withdrawn.** It remains the accurate record of the CURRENT implementation, which is what an `EXISTING` rule is for |
| **BR-096** | unchanged — email is sent after the commit, never inside it, and a mail failure loses no import |
| **BR-097** | unchanged — re-running an import does not re-issue a live invitation code |
| **BR-098** | unchanged — an import previews before it commits |
| **BR-099** | unchanged — identity resolution is deterministic and identical in both modes |
| **WF-021** | unchanged — and its "open point" is now closed by this amendment |

**C-105 · TARGET SPECIFICATION RESOLVED.** The contradiction was between two target statements, and
one target now governs.

```
C-105  ──►  TARGET SPECIFICATION RESOLVED

WHAT THIS DOES NOT MEAN
   ── it does NOT mean the current implementation satisfies the target
   ── the current import still commits all-or-nothing, and still exists as
      TWO pipelines with different guarantees
   ── THAT remains C-26, which is a CURRENT-STATE conflict and is UNCHANGED

C-105 and C-26 ARE NOT MERGED.  One was about which target is right;
the other is about what the code does today.
```
