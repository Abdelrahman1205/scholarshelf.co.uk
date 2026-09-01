# USERS.md — Stage 2: Users

```
STAGE 2 — USERS
STATUS: LOCKED
Locked: 23 August 2026 by the owner (BytHub Technology Ltd)
```

**Governed by** `PRODUCT.md` (Stage 1, LOCKED). **Scope:** who the people are, what they are
responsible for, and where their boundaries sit. **Not in scope:** the permission matrix — Stage 7.

**What "locked" means.** US-01…US-10 are requirements. If a later stage finds something that
conflicts with them, **flag the conflict** — do not silently alter Stage 2.

---

## 1. Person ≠ account — a product rule, not an implementation detail

**[LOCKED US-01]** A guardian is a **school-owned relationship/person record**. A parent account is a
**platform login identity**. These must never be collapsed.

```
A PERSON                 the human being
A GUARDIAN RECORD        the school's record of an adult responsible for a child
                         (name, relationship, phone, primary contact)
                         OWNED BY THE SCHOOL TENANT
A PORTAL ACCOUNT         a login (users row, role = parent)
                         NOT owned by any tenant — schoolId is null
```

The model must permanently support:

1. a **guardian with no account**;
2. an **account that exists before** any guardian linkage;
3. **several guardians for one child**;
4. **one account connected to children** across the appropriate relationships;
5. **disabling or deleting an account without destroying** the school's historical guardian record.

[CONFIRMED in code] `guardians` carries `fullName`, `relationship`, `isPrimaryContact`,
`portalAccessStatus` (`none | invited | active`) and a **nullable** `userId` with `ON DELETE SET
NULL`. All five cases are already representable.

**The same shape recurs for staff:**

```
GUARDIAN         ≠   PARENT LOGIN
TEACHER PROFILE  ≠   USER LOGIN
```

`teacher_profiles` is the school's record of a teacher (department, subjects, created-by), unique per
`(userId, schoolId)`; `users` is the account. [CONFIRMED]

**Do not generalise this into a universal architecture yet.** Stage 6 decides where the distinction
belongs in the final data model.

---

## 2. School identity and branding — where it sits

**[LOCKED US-02]** ScholarShelf has **one canonical design system**. Each school customises its own
presentation **within controlled boundaries**, resolved through its **school code**.

```
SCHOLARSHELF CORE DESIGN SYSTEM
        ↓
SCHOOL-SPECIFIC CONFIGURATION      (resolved by school code)
        ↓
SCHOOL EXPERIENCE
```

A school's configuration covers logo, colours, visual identity, permitted dashboard customisation,
school-facing branding, family-facing branding, and transactional communication identity.

**It does not mean a separately designed application per school.** UX architecture, components,
accessibility requirements, information architecture, interaction patterns and application structure
remain canonical:

```
ONE PRODUCT + ONE DESIGN SYSTEM + TENANT-SPECIFIC BRANDING
        not
ONE COMPLETELY DIFFERENT UI PER SCHOOL
```

**Boundary with the CMS module** — this refines `PRODUCT.md` D-05:

```
CORE                  school identity + application branding
                      (dashboards, parent portal, transactional emails,
                       school identity throughout the operational app)

CMS OPTIONAL MODULE   consumes core identity
                      + adds website-specific styling, theme choices,
                        page presentation and website assets
```

Carried to Stages 8, 9, 10 and 12. **Not implemented now.**

---

## 3. The user model

### 3.1 CORE CUSTOMER-FACING USERS

---

#### **School Administrator** — `school_admin` (legacy alias `admin`)

| | |
|---|---|
| **Who** | The person who runs the book operation for one school — often an office manager, bursar's assistant, or a senior teacher with an admin hat. |
| **Account created by** | BytHub, as the first-admin invite at onboarding; thereafter by another school admin. [CONFIRMED] |
| **Managed by** | Other school admins. **Not** by BytHub except in explicit, audited support mode. [CONFIRMED — `canManageUser`] |
| **Tenant** | Exactly one school. |
| **Why they use it** | It is their job. They are accountable for every child having the right books. |
| **Responsibilities** | Catalogue and stock · bundles and their assignment to classes · classes and students · families and guardians · enrolment and bulk import · staff invites and **temporary class assignments** [US-10] · school identity configuration [US-02] · reports · running the annual rollover [D-07]. |
| **Needs to see** | Everything operational in their school. |
| **Must never see** | Another school's data. Platform infrastructure. |
| **Creates** | Books, copies, bundles, classes, students, families, guardians, linking codes, staff invites, class assignments, allocations. |
| **Edits** | The above, plus staff records within their school. |
| **Approves** | Extra-copy requests · enrolment imports · go-live. |
| **Records** | Distribution decisions, notes, corrections. |
| **Disables** | Staff accounts, student records (archive), families. **Disable is the normal action** [US-04]. |
| **Deletes** | Nothing routinely. Deletion/anonymisation is a controlled privacy process. [US-04] |
| **Finance authority** | **Not automatic.** Whether a school admin also holds finance authority is **configured per school** [LOCKED US-05]. An admin must not gain finance powers merely because the code groups the roles. |
| **When they leave** | Account disabled, sessions invalidated, history remains attributable. [US-04] |
| **Multiple roles?** | Yes, commonly — see §4. |
| **Band** | Core, customer-facing. |

---

#### **Finance** — `finance`

| | |
|---|---|
| **Who** | The person who reconciles money for the school. In a supplementary school this may be the same human as the admin; in a mainstream school it is the finance office. Both are supported. [US-05] |
| **Account created by** | School admin, via the staff invite wizard. [CONFIRMED] |
| **Managed by** | School admin. |
| **Tenant** | One school. |
| **Why they use it** | To turn incoming money **and funding decisions** into a settled position per child, and to answer "did that family pay?" |
| **Responsibilities** | Confirming settlement · matching bank references · recording **cash** · recording **instalments** · applying **discount/subsidy** · recording **school-funded/waived** positions · allocations · financial reporting and reconciliation. [D-10] |
| **Authorises** | **[LOCKED US-06] Finance authorises waivers, school-funded books, subsidy and discount.** These must be explicit, attributable, auditable, and **never made to look like money was received.** No new senior-approver role is created. If later analysis shows a real need for thresholds or counter-authorisation, **flag it to the owner** — do not invent one. |
| **Needs to see** | **[LOCKED US-07] Configurable per school, within least privilege.** The normal minimum: child identity · relevant class/context · family/payment association · amount required · settlement state · funding/subsidy information. "Configurable" never means bypassing tenant isolation or platform security boundaries. |
| **Must never see** | Another school. |
| **Creates** | Allocations · settlement records · funding, subsidy and waiver records. |
| **Edits** | Settlement status; review notes. |
| **Approves** | **The role's defining act** — confirming a settled position. |
| **Deletes** | Nothing. Corrections are recorded, not erased. → Stage 4. |
| **Extra controls** | Confirmation is irreversible in effect (stock moves, books become the child's). Waiver and discount concern money the school will not receive. |
| **When they leave** | Disabled, never routinely deleted — confirmations are financial history. [US-04] |
| **Band** | Core, customer-facing. |

---

#### **Teacher** — `teacher`

| | |
|---|---|
| **Who** | A class teacher, form tutor, or a subject teacher shared across classes (the code's own example: a shared Quran teacher in a supplementary school). [CONFIRMED] |
| **Account created by** | School admin, via invite. |
| **Managed by** | School admin. |
| **Tenant** | One school. |
| **Assignment** | Two models coexist today: legacy `classes.teacherId`, and `class_teacher_assignments` (subject-based, many-to-many). `storage.getTeacherClassIds` reads both. [CONFIRMED] |
| **Temporary assignment** | **[LOCKED US-10]** Cover teachers and teaching assistants are handled by **time-bounded class assignment**, not a new role: `USER → CLASS ASSIGNMENT → START → END`. When the assignment expires, access expires. This **preserves** D-08 rather than bypassing it. Workflow belongs to Stages 4, 5, 6, 7. |
| **Why they use it** | On distribution day, to hand books to 30 children and record what happened — on a phone, standing up. |
| **Responsibilities** | Hand-over · recording received / absent / out-of-stock / issue · requesting extra copies · messaging families of their own classes. |
| **Needs to see** | **Only their assigned classes and the students and distribution data those classes require.** [LOCKED D-08] |
| **Must never see** | Other classes' children. Financial detail beyond "settled / not settled". Another school. |
| **Creates** | Hand-over records · extra-copy requests · messages. |
| **Edits** | Distribution status and notes for their own classes. **Never a student record.** [CONFIRMED invariant] |
| **Approves / Deletes** | Nothing. |
| **Extra controls** | A teacher must not distribute to their own child. [Stated in the workflow map; **verify in Stage 7**] |
| **When they leave** | Assignments end; hand-over records survive. [US-04] |
| **Band** | Core, customer-facing. |

> **Conflict C-6.** Allocations are class-filtered today; other teacher-facing reads are broader.
> D-08 makes assigned-class-only the rule everywhere.

---

#### **Parent / Guardian account** — `parent`

| | |
|---|---|
| **Who** | A parent, carer or other adult responsible for one or more children, possibly across more than one school. |
| **Account created by** | Themselves, three ways: emailed invite · linking code after self-registration · auto-invitation from a spreadsheet enrolment import. Public self-signup exists and is rate-limited. [CONFIRMED] |
| **Managed by** | Themselves, for the account. The school manages the **guardian record**, not the login. [US-01] A school admin can manage a parent account only where that parent is linked to their school. [CONFIRMED] |
| **Tenant** | **None.** `schoolId` is null; scope comes from `parent_children` and family links. Deliberate — must not be "simplified". [CONFIRMED, and protected in the behaviour baseline] |
| **Why they use it** | To find out what their child needs, what is owed, how to settle it, and whether it landed. |
| **Responsibilities** | Linking to their children · reviewing what is required · settling · collecting. |
| **Needs to see** | Their own children only: required books, amount owed, amount settled, amount outstanding, how to settle, collection status, messages. |
| **Must never see** | Any other child or family. School-internal data. **Whether another family was subsidised or waived.** |
| **Creates** | Their account · order/basket · a payment claim with a reference. |
| **Approves** | Nothing — they *claim*, finance *confirms*. [CONFIRMED invariant] |
| **Deletes** | Nothing. Data-subject deletion is a GDPR process. → Stage 16. |
| **Access lifecycle** | **[LOCKED US-03]** When the account no longer has any active child/relationship requiring portal access, **access becomes inactive automatically.** The account and historical records are **not** destroyed, so a future sibling or a new school relationship can be considered without corrupting history. Retention period, reactivation behaviour, deletion/anonymisation and legal retention → **Stage 16**. |
| **Extra controls** | Linking codes are email-bound, single-use, expiring, user-keyed rate-limited and audited. [CONFIRMED] Session lifetime 30 days for parents vs 8 hours for staff. [CONFIRMED] |
| **Band** | Core, customer-facing. |

---

### 3.2 OPTIONAL CMS MODULE

#### **IT Personnel** — `it_personnel`

| | |
|---|---|
| **Who** | Whoever maintains the school's public web presence. Often not operational staff at all. |
| **Created / managed by** | School admin. |
| **Tenant** | One school. |
| **Responsibilities** | Page sections, drafts and publishing · media library · **website-specific** styling and assets. |
| **Must never see** | **Any operational or child data whatsoever.** A real server-side boundary today, not hidden navigation. [CONFIRMED — one of the genuinely good things in the codebase] |
| **Relationship to branding** | **[LOCKED US-02]** Core school identity belongs to **ScholarShelf Core**. The CMS module **consumes** it and adds website-specific configuration on top. `it_personnel` therefore configures the *website's* presentation, not the school's core identity. |
| **Extra controls** | The URL scheme allowlist that blocks `javascript:` — a stored-XSS fix that must survive. [CONFIRMED] |
| **Band** | **Optional CMS module** [D-05]. |

#### **Public visitor**

No account. Sees a school's **published** website sections at `/school/:code`; the endpoint fails
safe to empty. [CONFIRMED] Band: **Optional CMS module**.

> **Conflict C-5.** The CMS, media and `it_personnel` are woven through the same app, routes and role
> model; D-05 requires a module boundary. US-02 now settles the branding question: **core identity is
> core**, website styling is module. The split still has to be designed (Stages 8/12/13).

---

### 3.3 INTERNAL BYTHUB

**[LOCKED US-08] Keep both roles, but they must diverge.** They are currently two names with
identical authority in every authorisation decision; that must end.

#### **Platform Administrator** — `platform_admin`

Routine BytHub platform operations: onboarding schools · tenant support · tenant lifecycle
operations within authorised bounds · routine platform administration · support-mode operations.

#### **Owner** — `owner`

Highest-level BytHub authority, reserved for exceptional and high-risk operations: destructive
platform operations · highest-level security controls · break-glass capabilities · sensitive platform
configuration · database-console elevation where appropriate · **control of platform administrators**.

**Common to both:**

| | |
|---|---|
| **Who** | BytHub Technology Ltd staff. |
| **Created by** | BytHub, out of band. Platform-owner role assignment is **blocked from the dashboard entirely**, for everyone including owners. [CONFIRMED — `enforceRoleUpdateGuards`] |
| **Tenant** | None — null `schoolId` means "all tenants" by design, which is why platform roles are excluded from `TENANT_SCOPED_ROLES`. [CONFIRMED] |
| **Must never have** | Routine access to a school's children or money outside explicit support mode. |
| **Extra controls** | **MFA mandatory, server-side.** [CONFIRMED] Support mode is explicit, scoped to one `supportSchoolId`, audited. [CONFIRMED] The DB console is three-tier — typed operations, Postgres-enforced read-only queries, break-glass writes behind TOTP + reason + 15-minute elevation — and every action is audited. School purge requires a 7-day `pending_deletion` cooldown. [CONFIRMED] |
| **Band** | **Internal.** Not a customer-facing product surface. [D-06] |

The exact permission boundary between the two belongs to **Stage 7 and Stage 16**. **Do not
restructure the role implementation yet.**

> **Conflict C-10.** The owner tier ships a customer-shaped "global dashboard" with cross-tenant
> reporting. D-06 says internal ops. Stages 8–9 decide how much of that surface is justified.

---

### 3.4 DOMAIN ENTITY — NOT A USER

#### **Student** — `student` (legacy residue)

**[LOCKED D-09]** Students are not users. No student login in the final product.

Present in `USER_ROLES` and nowhere that matters: **no** `CONTEXT_DEFAULT_PATHS` entry (so it cannot
land anywhere after sign-in), and explicitly listed in `TEST_ACCOUNT_EXCLUDED_ROLES` alongside
`owner` and `platform_admin`. [CONFIRMED] The residue is small, which makes eventual removal cheap —
and makes it important not to build on the role in the meantime.

**Action:** record for controlled deprecation. **Do not delete now.**

A child remains a first-class *domain entity* (`students`, with `active | inactive | alumni` plus
archive fields), managed entirely by authorised adults.

---

### 3.5 NON-ACCOUNT / SYSTEM ACTORS

Not accounts, but each is an authorisation surface and must be modelled.

| Actor | What it is | How it authenticates | Notes |
|---|---|---|---|
| **Scheduler** | Daily digest/notification run at 07:00 | `CRON_SECRET` via `Authorization`, constant-time compare | Idempotent per `(job, school_id, run_date)`; drains within a 24 s budget [CONFIRMED] |
| **Payment / integration webhook caller** | External payment or reconciliation system | HMAC-SHA256, **fails closed** if no secret | The natural integration point when D-02's online payment arrives |
| **Email provider (Resend)** | Outbound delivery on the school's behalf | API key | Sends in the **school's** identity, per US-02 |
| **Test-superuser mechanism** | One development account able to act as every role | `TEST_SUPERUSER` permission row; **off in production** unless `ALLOW_TEST_SUPERUSER=true` | Not a role — a flag that makes every context available. Cannot simulate `owner`, `platform_admin` or `student` [CONFIRMED] |
| **Prospective parent** | Someone at public sign-up or invite acceptance | None yet | Rate-limited; anti-enumeration on reset; a linking code is the only route to a child [CONFIRMED] |

No other genuine machine actor was found.

---

## 4. One human, several contexts

**Preserve this behaviour conceptually. Do not lock the current technical implementation as the final
architecture** — Stage 7 determines the final permission/context model.

```
ONE HUMAN ACCOUNT
        ↓
AVAILABLE CONTEXTS
        ├── STAFF
        ├── TEACHER
        └── PARENT
```

A context may come from:

- **explicit role assignment** — `SECONDARY_ROLE:<role>` grants;
- **actual class assignment** — either assignment model;
- **actual family/child relationship** — `parent_children` or a pending linking code.

Two product facts follow:

1. **A context can be earned, not only granted.** A staff member linked to a child *becomes* able to
   act as a parent without an admin granting anything. Correct, and to be preserved — but it means
   "who is a parent" is not answerable from `users.role` alone.
2. **Authorisation is against the active context, not the stored role.** Hiding UI enforces nothing;
   the API is the boundary. This must survive any UI rebuild.

The staff invite wizard already supports "teacher who is also a parent here" directly, via
`invites.familyId` + `relationship` + `guardianPermissions`. [CONFIRMED]

---

## 5. High-level user matrix

*Responsibilities and boundaries only — **not** a permission specification. Stage 7 owns that.*

| Role | Band | Tenant | Created by | Primary responsibility | Never sees |
|---|---|---|---|---|---|
| `owner` | Internal BytHub | none (all) | BytHub, out of band | Exceptional / high-risk platform authority; controls platform admins | Routine school data outside support mode |
| `platform_admin` | Internal BytHub | none (all) | BytHub, out of band | Routine platform ops: onboarding, support, tenant lifecycle | Break-glass and destructive controls |
| `school_admin` | Core | one school | BytHub first-admin, then peers | Run the book operation | Other schools; platform infrastructure |
| `finance` | Core | one school | School admin | Settle, reconcile, **authorise waiver/subsidy/funding** | Other schools; child data beyond the configured minimum |
| `teacher` | Core | one school | School admin | Hand over books for **assigned** classes (incl. temporary assignments) | Other classes; financial detail |
| `parent` | Core | **none** (family-scoped) | Self, via invite / code / import | Settle and collect for own children | Any other child or family |
| `it_personnel` | **Optional CMS module** | one school | School admin | Public site content and website styling | **All operational and child data** |
| Public visitor | **Optional CMS module** | — | — | Read published pages | Everything else |
| `student` | **Not a user (D-09)** | — | — | — | — |
| Scheduler / webhook / email / test-superuser | Infrastructure | — | — | Automated actions | — |

---

## 6. Roles that merge, split, or disappear — resolved

| Change | Outcome |
|---|---|
| `admin` → merge into `school_admin` | **Proceed.** Already only a legacy alias resolved by `LEGACY_ROLE_MAP`; keep the alias for stored data, retire it from the product vocabulary. Migration is Stage 22. |
| `student` → disappear | **Locked D-09.** Deprecate through the register; do not delete now. |
| `owner` / `platform_admin` → **differentiate** | **Locked US-08.** Both kept; authority diverges. Boundary in Stages 7 and 16. |
| `finance` vs `school_admin` overlap | **Locked US-05.** Configurable per school. `FINANCE_ROLES` currently hard-codes admin roles as finance — see C-13. |
| `it_personnel` → keep, relocate to the CMS module | **Locked D-05 + US-02.** Server-side boundary preserved exactly as built; core identity moves to core. |
| Stockroom role | **Locked US-09 — not created.** `SCHOOL ADMIN / AUTHORISED OPERATIONS → prepares stock → TEACHER → receives/distributes`. Reconsider only if a real customer demonstrates the need. |
| Senior approver role | **Locked US-06 — not created.** Waiver/subsidy authority sits with finance. |
| Cover teacher role | **Locked US-10 — not created.** Cover is a **time-bounded assignment**, not a role. |

**No new roles are created at Stage 2.**

---

## 7. Locked Stage 2 decisions (US-01 … US-10)

| ID | Decision | Carried into |
|---|---|---|
| **US-01** | Guardian record and parent account stay **permanently separate**; five cases in §1 must remain representable | 6, 7, 16 |
| **US-02** | One canonical design system + **tenant-specific branding/configuration resolved by school code**; core identity is Core, website styling is CMS module | 8, 9, 10, 12 |
| **US-03** | Parent access becomes **inactive automatically** when no active child relationship requires it; nothing destroyed; retention rules → Stage 16 | 5, 6, 7, 16 |
| **US-04** | Staff leavers: **disable, not delete.** Sessions invalidated; history stays attributable. Deletion/anonymisation is a separate controlled privacy process | 6, 7, 16 |
| **US-05** | Admin/finance separation is **configurable per school** | 7 |
| **US-06** | **Finance authorises** waiver, school-funded, subsidy and discount. Explicit, attributable, auditable, never disguised as a payment. No senior-approver role. Flag to the owner if thresholds prove necessary | 4, 7 |
| **US-07** | Finance's child-data visibility is **configurable per school within least privilege**; never a route around tenant isolation | 7 |
| **US-08** | Keep `owner` and `platform_admin`, but **differentiate** their authority | 7, 16 |
| **US-09** | **No stockroom role** | — |
| **US-10** | Cover/TA access is a **time-bounded class assignment** (`USER → CLASS ASSIGNMENT → START → END`), not a role | 4, 5, 6, 7 |

---

## 8. Conflicts between the current implementation and locked Stages 1–2

| # | Conflict | Owning stage |
|---|---|---|
| **C-5** | CMS, media and `it_personnel` are woven into core; D-05 + US-02 require a module boundary with core identity staying in core | 8, 12, 13 |
| **C-6** | Teacher visibility is class-scoped for allocations, broader elsewhere; D-08 requires assigned-class-only everywhere | 7, 9 |
| **C-7** | `student` in `USER_ROLES`; D-09 says not a user | 7, 22 |
| **C-10** | Owner tier ships a customer-shaped global dashboard; D-06 says internal ops only | 8, 9 |
| **C-11** | **No one can record cash, instalments, discount or waiver** — the capability does not exist. Not a permission gap: a missing product surface | 3, 4, 7 |
| **C-12** | `deleteUser` **hard-deletes** the user row; US-04 makes disable the normal action | 6, 7, 16 |
| **C-13** | `FINANCE_ROLES = [...ADMIN_UI_ROLES, "finance"]` hard-codes admins as finance; US-05 requires per-school configuration | 7 |
| **C-14** | **No time-bounded class assignment exists.** Both assignment models are open-ended; US-10 requires start/end | 5, 6, 7 |
| **C-15** | **Parent access never deactivates.** No concept of "no active children"; US-03 requires automatic inactivity | 5, 6, 7, 16 |
| **C-16** | `owner` and `platform_admin` are identical in every authorisation decision; US-08 requires divergence | 7, 16 |
| **C-17** | Finance visibility is not configurable at all — it inherits admin's view of student records; US-05 and US-07 both require per-school configuration, and **no school-level configuration mechanism exists anywhere in the product** | 6, 7 |

**C-17 deserves emphasis.** US-05, US-07 and US-02 all assume per-school configuration. The product
currently has *school branding* but no general notion of **school policy/configuration**. That is a
new product concept the later stages must design deliberately, not three unrelated settings bolted on.

---

## 9. Flagged for the owner, not decided here

Per US-06, these are surfaced rather than invented:

- **Cash at reception.** In many schools cash is handed over at reception, not in the finance office.
  US-06 places settlement authority with finance and US-09 declines new roles, so today's answer is
  "reception passes it to finance". If that proves unworkable for a real customer, the options are a
  delegated capability on an existing role or a per-school configuration — **not** a new role. Flagged.
- **Approval thresholds / counter-authorisation** for waivers and subsidies. Not created, per US-06.
  Stage 4 will say whether the business rules imply one; if they do, it comes back to the owner.

---

## 10. What Stage 2 deliberately did not do

No permission matrix, no endpoint-by-endpoint authorisation, no UI or navigation design, no role
migration plan, no configuration schema. Stage 7 owns permissions; Stage 9 owns each role's screens;
Stage 16 owns retention and privacy; Stage 22 owns migration.
