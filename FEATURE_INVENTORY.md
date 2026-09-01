# FEATURE_INVENTORY.md — Stage 3: Features

```
STAGE 3 — FEATURES
STATUS: LOCKED
Locked: 23 August 2026 by the owner (BytHub Technology Ltd)
```

**This is the canonical feature catalogue.** Later stages may refine *how* a feature works, but must
not silently remove a locked feature requirement. A later stage that finds a conflict with Stages 1–3
**flags it** — it does not modify the product.

**Governed by** `PRODUCT.md` (Stage 1, LOCKED) and `USERS.md` (Stage 2, LOCKED).
**Sources:** the repository at `restructure/aug-2026`, the 242-endpoint surface, 41 schema tables,
`CURRENT_SYSTEM_MAP.md`, `CURRENT_BEHAVIOUR_BASELINE.md`, `RESTRUCTURE_STATE.md`, the Stitch mockup
generations, and the original specification.

**This is an inventory, not a design.** No database, service, endpoint, state-machine, permission or
UI decisions are made here.

---

## How to read a feature record

```
F-nnn · Name — PRIORITY · STATE
  Purpose   why it exists
  Users     Stage 2 users who interact with it
  Impl      every implementation found (not a selection)
  Parity    Stage 0D behaviour that must survive (B-n)
  Conflicts C-n from Stage 1/2, or new ones raised here
  Deps      other features required
  Direction what locked Stage 1/2 requires, conceptually
  Stages    later stages that must resolve it
```

**PRIORITY** — `CORE` · `IMPORTANT SUPPORTING` · `OPTIONAL MODULE` · `INTERNAL INFRASTRUCTURE` ·
`FUTURE` · `OUT OF SCOPE`

**STATE** — `WORKING` · `PARTIAL` · `EXPERIMENTAL` · `LEGACY` · `DUPLICATED` · `BROKEN` · `MISSING` ·
`DOCUMENTED-ONLY` · `RESTRUCTURED` · `RESTRUCTURED-BUT-UNVERIFIED`

**A note on `RESTRUCTURED-BUT-UNVERIFIED`.** Per `RESTRUCTURE_STATE.md`, **no test suite has been
executed** in this analysis. Anything the August pass touched is marked unverified regardless of how
sound the code reads. That is an evidence statement, not a criticism.

---

# GROUP A — Platform & tenant operations *(internal BytHub)*

**F-001 · School tenant lifecycle** — INTERNAL INFRASTRUCTURE · WORKING
- **Purpose** Create, activate, suspend, archive, request deletion and delete a school tenant.
- **Users** `owner`, `platform_admin`
- **Impl** `owner.routes.ts` (`/api/owner/schools*`, suspend/archive/restore/request-deletion/delete); `SCHOOL_STATUSES = active | pending_setup | suspended | archived | pending_deletion | deleted`
- **Parity** B-2 — suspended/archived/deleted schools are refused at the session choke point
- **Conflicts** C-10 (customer-shaped global dashboard); US-08 (owner vs platform_admin authority undifferentiated)
- **Deps** F-003, F-050
- **Direction** Internal only [D-06]. Destructive operations belong to `owner`; routine lifecycle to `platform_admin` [US-08]
- **Stages** 7, 8, 16

**F-002 · Support mode** — INTERNAL INFRASTRUCTURE · WORKING
- **Purpose** Let BytHub act inside one named tenant, explicitly and audibly, without standing access.
- **Users** `owner`, `platform_admin`
- **Impl** `owner.routes.ts` enter/exit (two alias pairs); `isInSupportMode`, `supportSchoolId`; `canManageUser` refuses platform requests outside support mode
- **Parity** B-8
- **Conflicts** —
- **Deps** F-001, F-050
- **Direction** Preserve exactly. This is the mechanism that keeps D-06 honest.
- **Stages** 7, 16

**F-003 · First-admin invitation & school onboarding** — INTERNAL INFRASTRUCTURE · WORKING
- **Purpose** Hand a new school its first administrator account.
- **Users** `platform_admin` → `school_admin`
- **Impl** `owner.routes.ts` invite-admin / resend / revoke; `/api/owner/pending-setups`
- **Parity** B-1 (hashed invite tokens)
- **Conflicts** New **C-18**: the invite link is written to the log in full when email delivery fails, un-gated (`owner.routes.ts:641`)
- **Deps** F-010, F-055
- **Direction** Keep; close C-18 in Stage 16
- **Stages** 16

**F-004 · Platform dashboard & system health** — INTERNAL INFRASTRUCTURE · WORKING
- **Purpose** Show BytHub the state of the platform and its tenants.
- **Users** `owner`, `platform_admin`
- **Impl** `dashboard.routes.ts` `/api/owner/dashboard`; `owner.routes.ts` `/api/owner/system-health`, `/api/owner/activity`, `/api/owner/email-status`; `client/src/pages/admin/owner.tsx` (1,208 lines), `system-health.tsx`
- **Conflicts** **C-10** — presented as a customer-facing "global dashboard"
- **Direction** Re-frame as an internal console [D-06]. Content largely justified; framing is not.
- **Stages** 8, 9

**F-005 · Operations console — typed operations (Tier 1)** — INTERNAL INFRASTRUCTURE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Do ~90% of support work without anyone typing SQL.
- **Users** `owner`, `platform_admin`
- **Impl** `server/console/operations.ts` — school suspend/reactivate, user MFA reset, send password reset, payment status correction; `/api/owner/console/operations`, `/op/:name`
- **Parity** B-8
- **Deps** F-050
- **Direction** Preserve and extend. This is the right shape for support.
- **Stages** 7, 16

**F-006 · Operations console — read-only query tier (Tier 2)** — INTERNAL INFRASTRUCTURE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Ad-hoc reads that cannot mutate anything, enforced by Postgres rather than regex.
- **Users** `owner`, `platform_admin`
- **Impl** `db-console.routes.ts` `/api/owner/db/query`, `/tables`, `/tables/:table`; `console_ro` role + view schema from `migrations/001_console_hardening.sql`
- **Conflicts** **C-19** — depends on `001_console_hardening.sql`, which **cannot run on a fresh database** and is deliberately skipped by CI. Whether production actually has `console_ro` is unverified.
- **Direction** Keep the five DB-level controls. Resolve the migration baseline.
- **Stages** 15, 16, 21

**F-007 · Operations console — break-glass writes (Tier 3)** — INTERNAL INFRASTRUCTURE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Emergency writes, gated hard.
- **Users** `owner` only [US-08]
- **Impl** `/api/owner/console/elevate`, `/elevate/end`, `/write`; TOTP + reason + 15-minute elevation
- **Direction** Assign to `owner`, not `platform_admin` [US-08]
- **Stages** 7, 16

**F-008 · Destructive tenant operations** — INTERNAL INFRASTRUCTURE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Wipe a school's data; purge a deleted tenant.
- **Users** `owner` only [US-08]
- **Impl** `/api/owner/db/danger/wipe-school/:schoolId`, `/purge-school/:schoolId`; 7-day `pending_deletion` cooldown enforced by reading `console_audit`
- **Parity** B-8
- **Direction** `owner` only. Cooldown and audit-derived eligibility must survive.
- **Stages** 7, 16

**F-009 · Console audit trail** — INTERNAL INFRASTRUCTURE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Make every privileged platform action attributable — a GDPR Art. 33 prerequisite.
- **Impl** `server/console/audit.ts` (`consoleAudit`, tiered); 18 call sites; `/api/owner/console/audit`
- **Parity** B-8 — the previous console logged **nothing**
- **Direction** Preserve absolutely.
- **Stages** 16, 19

---

# GROUP B — Identity, authentication & sessions

**F-010 · Sign-in / sign-out** — CORE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Establish an authenticated session with a server-resolved role.
- **Users** all account holders
- **Impl** `auth.routes.ts` — **`/api/auth/sign-in` and `/api/auth/login` are alias pairs**, as are `sign-out`/`logout`; bcrypt-12; session regeneration; role-specific `SESSION_MAX_AGE` (parent 30d, staff 8h, teacher 24h)
- **Parity** B-1 — `session.save()` before the success response (race fix); `safeUser()`; session regeneration
- **Conflicts** New **C-20** — duplicate alias endpoints across auth, support-mode, users and family enrolment
- **Direction** One canonical route per operation; aliases deprecated, not deleted
- **Stages** 14, 22

**F-011 · Parent self-registration** — CORE · WORKING
- **Purpose** Let a guardian create their own portal account.
- **Users** prospective parent
- **Impl** `/api/auth/sign-up-parent`; rate-limited 5/hour/IP; username rule surfaced before typing
- **Parity** B-6 — the username rule is stated up front and enforced in the server's own words
- **Deps** F-030
- **Stages** 5, 9

**F-012 · Invitation acceptance** — CORE · WORKING
- **Purpose** Turn an emailed invite into an account, optionally linking family relationships.
- **Users** invited staff and guardians
- **Impl** `/api/invites/:token`, `/api/invites/:token/accept`, `/api/auth/accept-invite`; `invites` carries `familyId` + `relationship` + `guardianPermissions`
- **Parity** B-1 (hashed tokens), B-5
- **Direction** The staff-who-is-also-a-parent path is the concrete expression of §4 multi-context [US-01]
- **Stages** 5, 7

**F-013 · Password reset** — CORE · WORKING
- **Purpose** Recover access without an admin.
- **Impl** `/api/auth/forgot-password`, `/reset-password`; hashed tokens; anti-enumeration
- **Conflicts** **C-18** — the reset link is logged in full when delivery fails (`auth.routes.ts:450`, and again in `console/operations.ts:127`), un-gated
- **Stages** 16

**F-014 · Multi-factor authentication (TOTP)** — CORE · PARTIAL
- **Purpose** Protect privileged accounts.
- **Users** all; **mandatory for platform roles only**
- **Impl** `server/mfa.ts` (RFC 6238, hand-rolled, correct); `mfa.routes.ts` setup/enable/disable/verify/recovery-codes; enforcement at `auth.ts:456`
- **Parity** B-1
- **Conflicts** New **C-21** — **not enforced for `school_admin` or `finance`**, the roles that touch money and pupil PII; `mfa_secret` stored in plaintext; no TOTP replay protection
- **Direction** Enforcement scope is a Stage 16 decision; the mechanism is sound
- **Stages** 7, 16

**F-015 · Rate limiting** — CORE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Make credential stuffing and code-guessing expensive.
- **Impl** Postgres-backed `rate_limits`; keyed on `req.ip` (C3 fix); six auth call sites; user-keyed for linking codes
- **Parity** B-6
- **Stages** 16

---

# GROUP C — Roles, contexts & staff lifecycle

**F-016 · Role model & role resolution** — CORE · WORKING
- **Purpose** One vocabulary for who someone is.
- **Impl** `USER_ROLES` (8, incl. inert `student`); `LEGACY_ROLE_MAP` resolving `admin → school_admin`; role groups in `core/constants.ts` **and** duplicated in `middleware/auth.ts`
- **Conflicts** **C-7** (`student`), **C-13** (`FINANCE_ROLES` hard-codes admins as finance), new **C-22** — role-group constants declared in two files
- **Direction** Retire `admin` from the product vocabulary, keep the alias for stored data; `student` to the deprecation register
- **Stages** 7, 13, 22

**F-017 · Multi-context switching** — CORE · WORKING
- **Purpose** Let one human act as staff, teacher and parent without separate logins.
- **Users** anyone holding more than one context
- **Impl** `getUserAccessProfile` (explicit `SECONDARY_ROLE:*` grants + derived parent context from `parent_children`/pending codes + derived teacher context from either assignment model); `POST /api/auth/context`; `requireRole` authorises against the **active context**
- **Parity** B-1 — context validated server-side, switch audited, simulation distinguished from real
- **Direction** **Preserve the behaviour; do not lock the implementation** [Stage 2 §4]
- **Stages** 7

**F-018 · Staff invitation wizard** — IMPORTANT SUPPORTING · WORKING
- **Purpose** Onboard staff, including staff who are also parents at the school.
- **Users** `school_admin`
- **Impl** `POST /api/invites`; `client/src/pages/admin/invite-staff-wizard.tsx` (617 lines); dual-role + family linking
- **Deps** F-012, F-030
- **Stages** 5, 9

**F-019 · Secondary role grants** — IMPORTANT SUPPORTING · WORKING
- **Purpose** Give an existing account an additional role.
- **Impl** `POST /api/admin/users/:userId/roles/parent`, `/roles/teacher`, `DELETE /roles/:role`; stored as `SECONDARY_ROLE:<role>` rows in `user_permissions`
- **Conflicts** New **C-23** — `user_permissions` is a single untyped string table carrying three unrelated concerns: branding grants, secondary roles, and the `TEST_SUPERUSER` flag
- **Stages** 6, 7

**F-020 · Staff suspend / reactivate** — CORE · WORKING
- **Purpose** Remove access without removing history.
- **Impl** `POST /api/admin/users/:userId/suspend` → `status: "disabled"`, `/reactivate` → `active`; self-suspension refused; audited
- **Direction** **This is the US-04 mechanism and it already exists.** Make it the normal action.
- **Stages** 7, 9

**F-021 · Staff offboarding preserving parent access** — CORE · WORKING
- **Purpose** When a staff member leaves but is still a parent at the school, remove the staff roles and keep the family relationship.
- **Impl** `POST /api/admin/users/:userId/offboard-staff` — strips staff secondary roles, downgrades a staff primary role to `parent`, refuses (409) if there is no parent role to preserve
- **Direction** Exactly what US-04 + US-01 require. **Was not documented anywhere** — see §12.
- **Stages** 5, 7

**F-022 · Hard account deletion** — CORE · WORKING *(but conflicts with locked Stage 2)*
- **Purpose** Remove an account entirely.
- **Impl** `DELETE /api/users/:id` and `/api/admin/users/:id` → `storage.deleteUser` deletes the row, nulls `invites.invitedBy`, and deletes `parent_children` rows keyed on the email (the S3 fix)
- **Conflicts** **C-12** — US-04 makes *disable* the normal action; delete must become a controlled privacy operation, not a dashboard button
- **Direction** Keep the capability; change who may reach it and when
- **Stages** 7, 16

**F-023 · Temporary / time-bounded class assignment** — CORE · **MISSING**
- **Purpose** Cover teachers and TAs get access to a class for a bounded period, then lose it automatically. [LOCKED US-10]
- **Users** `school_admin` grants; `teacher` receives
- **Impl** **None.** Both assignment models (`classes.teacherId`, `class_teacher_assignments`) are open-ended with no start or end.
- **Conflicts** **C-14**
- **Deps** F-026, F-041
- **Direction** `USER → CLASS ASSIGNMENT → START → END`; expiry removes access. Preserves D-08 rather than bypassing it.
- **Stages** 4, 5, 6, 7

**F-024 · Per-school policy & configuration** — CORE · **MISSING**
- **Purpose** Let each school configure admin/finance separation [US-05], finance's child-data visibility [US-07], and permitted presentation customisation [US-02].
- **Users** `school_admin` (and possibly `platform_admin` at onboarding)
- **Impl** **None as a general concept.** `school_branding` exists; `/api/admin/school/settings` exists but is narrow. There is no school-level policy mechanism.
- **Conflicts** **C-17** — three separate locked decisions all assume a configuration surface that does not exist
- **Direction** One deliberate configuration concept, not three settings bolted on. **This is the largest new structural requirement Stage 2 created.**
- **Stages** 6, 7, 8

---

# GROUP D — School identity & branding

**F-025 · School identity & branding configuration** — CORE · WORKING
- **Purpose** Every school's ScholarShelf looks and reads like *that school* — dashboards, portal, and transactional email.
- **Users** `school_admin`; `it_personnel` for website-specific styling only
- **Impl** `school_branding` table; `setup.routes.ts` — school-scoped (`/api/school/branding` + logo/banner/favicon/email-logo/pdf-logo/reset), owner-scoped (`/api/owner/schools/:schoolId/branding*`), public (`/api/public/schools/:code/branding`, `/email-logo`); `server/branding.ts`, `client/src/lib/branding.ts`, `client/src/pages/admin/branding.tsx`; `BRANDING_*` permission grants for `it_personnel`
- **Conflicts** **C-5** — US-02 puts core identity in Core and website styling in the CMS module; today they are one surface. New **C-24**: base64 logos in email are stripped by Gmail/Outlook, so branded email is likely broken in practice (audit M5, unverified)
- **Direction** `CORE DESIGN SYSTEM → SCHOOL CONFIGURATION (resolved by school code) → SCHOOL EXPERIENCE`. One product, one design system, tenant branding — **not** one UI per school. [US-02]
- **Stages** 8, 9, 10, 12

**F-026 · School code as tenant identifier** — CORE · WORKING
- **Purpose** Resolve the right tenant identity and configuration from a short human-usable code.
- **Impl** `schools.code`; sign-in prompts for it when the account has a school; `/school/:code` public route; `/api/public/schools/:code*`
- **Direction** US-02 elevates the school code to the resolution key for identity and configuration
- **Stages** 6, 8, 9

---

# GROUP E — Academic structure

**F-027 · Classes** — CORE · WORKING
- **Impl** `book.routes.ts` `/api/classes` CRUD; `classes` table with `academicYear`, `status`, `isArchived`, and a legacy `teacherId`
- **Conflicts** **C-1** (level vocabulary pinned to Reception/Y1–13 in `formatYearGroup`, D-01 needs school-appropriate terminology); **C-9** (`status` vs `isArchived` overlap; `classes.teacherId` duplicates `class_teacher_assignments`)
- **Direction** Class/level terminology must be school-appropriate without internationalising the product [D-01]
- **Stages** 6, 10, 15

**F-028 · Subjects** — IMPORTANT SUPPORTING · WORKING
- **Impl** `subjects` table; `/api/subjects` create/list/delete (**no update**)
- **Notes** Exists only to support subject-based teacher assignment
- **Stages** 6

**F-029 · Teacher–class assignment** — CORE · DUPLICATED
- **Purpose** Decide which teacher may see and act on which class.
- **Impl** **Two models**: legacy `classes.teacherId`, and `class_teacher_assignments` (`/api/classes/:id/teacher-assignments` CRUD). `storage.getTeacherClassIds` reads **both** — one canonical lookup over two storage models.
- **Parity** B-4 — the canonical lookup must not be re-forked; `tests/teacher-distribution.ts` guards it
- **Conflicts** **C-6** (visibility), **C-14** (no time bounds)
- **Direction** One assignment model, time-bounded [US-10], driving all teacher visibility [D-08]
- **Stages** 4, 5, 6, 7

---

# GROUP F — Student records & academic year

**F-030 · Student records** — CORE · WORKING
- **Impl** `book.routes.ts` `/api/students` CRUD + `/unarchive`; `family-enrollment.routes.ts` `/api/students/:id/profile`; `students` table with `status (active|inactive|alumni)`, `isArchived`, `archivedAt/By`, `gradeLevel`, `photoUrl`, `preferredReadingLevel`
- **Parity** B-2 — `assertStudentInSchool` on body-supplied foreign keys
- **Conflicts** **C-9** — one mutable `classId` means promotion rewrites history; `status` and `isArchived` overlap
- **Stages** 6, 15

**F-031 · Student book-level override** — IMPORTANT SUPPORTING · WORKING
- **Purpose** A child needs a different bundle from the rest of their class.
- **Impl** `student.routes.ts` `/api/students/:id/book-level-override` GET/PUT/DELETE + list; `student_book_levels`
- **Notes** **Undocumented anywhere** — see §12. Real and useful: it is how mixed-ability and mid-year joiners are handled.
- **Deps** F-036
- **Stages** 4, 5

**F-032 · Academic-year rollover** — CORE · **MISSING**
- **Purpose** Move a school deliberately from one academic cycle to the next: advance students, change classes, create classes, handle leavers and joiners, start the next distribution cycle — **without overwriting historical truth.** [LOCKED D-07]
- **Users** `school_admin`
- **Impl** **None.** `academic_year` is stamped on six tables and `shared/academic-year.ts` provides the vocabulary (`academicYearFor`, `currentAcademicYear`, `normaliseAcademicYear`, `academicYearSortKey`, `recentAcademicYears`), plus `migrations/003_academic_year.sql`. There is no rollover feature.
- **Conflicts** **C-9** — today promotion overwrites `students.classId` and retroactively rewrites every historical report
- **Deps** F-027, F-030, F-036, F-046, F-083
- **Direction** An explicit ritual the admin runs, and **the only thing that creates the next cycle** [FQ-04]. History immutable in meaning. Representation decided in 4/5/6/15.
- **Stages** 4, 5, 6, 15
- **Note** *The single largest product gap in the inventory. A school's second year is currently worse than its first.*

---

# GROUP G — Families, guardians & parent linking

**F-033 · Families & guardians** — CORE · WORKING
- **Purpose** Model the adults responsible for a child, as a school-owned record.
- **Impl** `family-enrollment.routes.ts` — families CRUD, search, `/families/:id/guardians`, `PATCH/DELETE /guardians/:id`, `/guardians/:id/invite`, `/families/:id/students`, enrol, save-draft (**two alias forms each**); `families`, `family_students`, `guardians` tables
- **Parity** B-5 — guardian↔portal binding is best-effort and non-fatal
- **Conflicts** **C-20** (alias endpoints); **US-01** now makes guardian ≠ account a product rule
- **Direction** Preserve the separation permanently; all five cases in `USERS.md` §1 must stay representable
- **Stages** 6, 7

**F-034 · Linking codes (parent ↔ child)** — CORE · WORKING
- **Purpose** Let a guardian prove they are entitled to a child, without the school handling passwords.
- **Impl** `student.routes.ts` `/api/linking-codes`, `/students/:id/linking-code`, `/rotate`; `parent.routes.ts` `/link-code/preview`, `/link-code/confirm`, **plus legacy `/link-child`**; `child_linking_codes`
- **Parity** B-6 — email-bound, single-use, expiring, user-keyed rate limit, audited; preview returns no PII beyond the name; preview and confirm normalise identically (the H8 fix); wrong-email surfaces as 403
- **Conflicts** New **C-25** — `/api/parent/link-child` is a legacy single-step path retained "for backward compat" alongside the two-step flow
- **Direction** One canonical flow; legacy path to the deprecation register
- **Stages** 5, 22

**F-035 · Parent access lifecycle** — CORE · **MISSING**
- **Purpose** Parent access becomes inactive automatically when no active child relationship requires it. [LOCKED US-03]
- **Impl** **None.** There is no concept of "this account no longer has an active child".
- **Conflicts** **C-15**
- **Deps** F-030, F-032, F-033
- **Direction** Access inactive, account and history preserved so a sibling or new school relationship can be considered. Retention, reactivation and anonymisation → Stage 16.
- **Stages** 5, 6, 7, 16

---

# GROUP H — Bulk enrolment & import

**F-036 · Family enrolment spreadsheet import** — IMPORTANT SUPPORTING · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Onboard a whole school's families in one pass.
- **Users** `school_admin`
- **Impl** `server/services/enrollment-import/` (8 modules: spreadsheet parser, row validator, date/class/family/student resolvers, `import-service.ts` 726 lines, template); `/api/families/enroll/import/fields`, `/template`, `/analyze`, `/commit`; `client/src/pages/admin/family-enrollment-import.tsx` (655 lines)
- **Parity** B-5 — **one transaction for the whole commit**, including one family linking code per touched family; **emails sent after commit, never inside it**; re-running does not re-issue a live code; the school snapshot is re-read inside the transaction
- **Deps** F-033, F-034, F-055
- **Direction** **[DECIDED FQ-01]** This is the `STUDENTS + FAMILY/GUARDIANS` mode of one import capability. Preserve the transactional contract exactly — it is the highest-value change the August pass made, and consolidation must not lose it.
- **Stages** 4, 5, 13, 22

**F-037 · Student-only import** — IMPORTANT SUPPORTING · DUPLICATED
- **Purpose** Import pupils **without** guardian data — where the school's MIS is the source of student data, the export carries no guardian information, families will be linked later, or students must exist before family onboarding completes. **[DECIDED FQ-01: a legitimate product use case, kept.]**
- **Impl** `student.routes.ts` `/api/students/import/preview`, `/import/confirm`; `client/src/pages/admin/students.tsx`
- **Conflicts** **C-26** — two independent pipelines with different validation, preview semantics and transactional guarantees. **The duplication is an implementation problem, not a product one:** both *use cases* are required.
- **Direction** **[DECIDED FQ-01]** One ScholarShelf import capability with two modes — `STUDENTS ONLY` and `STUDENTS + FAMILY/GUARDIANS`. **Preserve both pipelines for now**; the family importer's transactional guarantees (B-5) are part of the parity baseline and must not be lost in consolidation. Consolidation is decided in Stages 4, 5, 13 and 22 — **not** by "newest wins".
- **Stages** 4, 5, 13, 22

**F-038 · Pending-invitation safety net** — IMPORTANT SUPPORTING · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Re-send invitations to guardians whose email arrived late or bounced.
- **Impl** `POST /api/families/invitations/send-pending`; idempotent and rate-limited
- **Parity** B-5
- **Stages** 5

---

# GROUP I — Catalogue, bundles & inventory

**F-039 · Book catalogue** — CORE · WORKING
- **Impl** `book.routes.ts` create/update/delete, `/by-isbn/:isbn`, `/scan/:code`; **but `GET /api/books` (the list) lives in `setup.routes.ts:40`** — new **C-27**, ownership split across files
- **Parity** B-7 — negative prices refused at both ends (`insertBookSchema` was previously unused by the route)
- **Stages** 13, 14

**F-040 · ISBN scanning & external lookup** — IMPORTANT SUPPORTING · PARTIAL
- **Purpose** Add books by scanning rather than typing.
- **Impl** `html5-qrcode` + `jsbarcode` client-side; `/api/books/by-isbn/:isbn`, `/scan/:code`
- **Notes** The original spec and pitch promise **automatic title/author lookup from Open Library**. No such integration was found in the server. → §11
- **Stages** 3, 17

**F-041 · Book levels (bundles)** — CORE · WORKING
- **Purpose** Assign one bundle to a class instead of eight books.
- **Impl** `/api/book-levels` CRUD, `/:id/items`, `DELETE /api/book-level-items/:id`; `book_levels`, `book_level_items`
- **Parity** B-2 — `assertBookLevelInSchool`, `assertBookInSchool` on item writes
- **Stages** 6

**F-042 · Class ↔ bundle assignment** — CORE · WORKING
- **Impl** `/api/class-book-levels` list/create/delete; `class_book_levels` with optional academic year
- **Parity** B-2 (`assertClassInSchool` + `assertBookLevelInSchool`), B-7 (removal confirms by name)
- **Deps** F-027, F-041
- **Stages** 5

**F-043 · Stock levels & inventory transactions** — CORE · WORKING
- **Impl** `/api/books/:id/stock`, `/api/books/low-stock`, `/api/inventory-transactions`; `book_inventory_transactions` with `purchase | return | damage | allocation | adjustment`
- **Parity** B-3 — stock deduction is inside the settlement transaction; insufficient stock rolls the whole confirmation back with a named message
- **Conflicts** **C-4** — the `return` transaction type implies lending; D-04 says sold
- **Stages** 4, 6

**F-044 · Physical copy identity & labels** — IMPORTANT SUPPORTING · WORKING
- **Purpose** Give individual copies an identity so custody can be tracked.
- **Impl** `book_copies` (`in_stock | allocated | sold | damaged | lost | returned`); `/api/books/:id/copies`, `/api/book-copies/lookup/:code`, `PATCH /api/book-copies/:id`, `/verify`; `client/src/pages/admin/book-copies.tsx` label printing
- **Conflicts** **C-4** (`returned`)
- **Deps** F-039
- **Direction** The substrate D-03 needs. Per-copy provenance at settlement confirmation is designed but not built (§8).
- **Stages** 4, 5, 6

---

# GROUP J — Ordering & settlement

**F-045 · Child book basket** — CORE · WORKING
- **Purpose** Turn "this child is in this class" into "this is what is owed".
- **Impl** `parent.routes.ts` `/api/parent/children/:id/basket`, `/baskets`, `/children/:id/books`; `child_book_baskets`, `basket_items`
- **Parity** B-3 — duplicate-basket guard (double-click previously created two pending baskets → double-pay risk)
- **Deps** F-042, F-031, F-083
- **Direction** **[DECIDED FQ-04]** A basket is *activity inside* a child's academic-year cycle, not a cycle in itself.
- **Stages** 4, 5, 6

**F-083 · Book-supply cycle (child × academic year)** — CORE · **MISSING**
- **Purpose** **[DECIDED FQ-04]** `CHILD → ACADEMIC YEAR → ONE BOOK-SUPPLY CYCLE`. One cycle per child per academic year — e.g. *Adam, 2026/27* — carrying **all** of that year's activity.
- **Users** every core user; it is the object the whole product hangs off
- **Impl** **None as an entity.** `academic_year` is stamped on six tables and `shared/academic-year.ts` supplies the vocabulary, but there is no cycle object. Baskets, payments and allocations are currently loose records with no owning cycle.
- **Conflicts** **C-9** — one mutable `students.classId` means the next year rewrites the last one
- **Deps** F-030, F-032, F-042, F-045
- **Direction** Activity that stays **inside** the existing cycle: initial September requirement · mid-year joining · new bundle assignment · an additional required book · a replacement · a teacher extra-copy request · a correction · a later payment or funding event · a later distribution. **None of these create a new cycle.** Only the annual rollover (F-032) creates the next one. Historical cycles are **immutable in meaning** — a later academic year must never rewrite what was true in an earlier one. This does *not* forbid corrections to a historical record; it forbids retroactive rewriting.
- **Stages** 4, 5, 6, 15
- **Note** *This is now the product's central object, and it does not exist. Stages 4–6 turn it into rules, lifecycle and entities; Stage 15 decides representation.*

**F-046 · Payment claim & reference** — CORE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** The family says "I have transferred this, here is the reference".
- **Impl** `/api/parent/payments`, `/payments/:id/submit-reference`, `/api/parent/payments`; `book_payments` (`paymentMethod` default `"external_reference"`), `basket_payments`
- **Parity** B-3 — 409 `duplicate_order`; unique indexes on `basket_payments(basket_id)` and `book_payments(school_id, upper(btrim(ref)))`; app-level duplicate detection normalises identically to the index. B-6 — reference normalised `trim().toUpperCase()`; dialog dismissal does not erase a hand-copied reference.
- **Conflicts** **C-18** — parent email + reference logged on email-send failure (`parent.routes.ts:350`)
- **Stages** 4, 5, 6

**F-047 · Family (multi-child) settlement** — CORE · WORKING
- **Purpose** A parent with three children settles once.
- **Impl** `basket_payments` joins one `book_payment` to several baskets
- **Parity** B-3
- **Stages** 4, 5

**F-048 · Settlement confirmation** — CORE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Finance turns a claim into a settled position; stock moves; the books become the child's.
- **Users** `finance` (and `school_admin` where the school configures it [US-05])
- **Impl** `payment.routes.ts` `/api/admin/payments/:id/confirm`, `/reject`, `/needs-review`, `/cancel`, `/ready-for-collection`, `/collected`, `/order-status`; `storage.confirmPayment`
- **Parity** **B-3 in full** — one transaction; conditional `UPDATE … WHERE status NOT IN (…) RETURNING *` as the claim-lock; no `catch {}` around stock deduction; per-basket guard retained for legacy partial runs; money is `numeric(10,2)`
- **Direction** This transaction is the product's core invariant. Any settlement route added by D-10 must land in the same place.
- **Stages** 4, 5, 12, 15

**F-049 · Alternative settlement routes** — CORE · **MISSING**
- **Purpose** Cash, instalments, discount/subsidy, and school-funded/waived positions. [LOCKED D-10, authority: `finance` per US-06]
- **Users** `finance`
- **Impl** **None.** One path exists (`external_reference`). No waiver, discount, exemption, part-payment or cash concept anywhere in the schema or the API.
- **Conflicts** **C-11**, **C-8**
- **Deps** F-045, F-046, F-048
- **Direction** The model must distinguish **list/required value · payable value · subsidy/discount · amount paid · amount outstanding · school-funded/waived**, with every route reaching one settled position and **never making a waiver look like money received**. No disconnected accounting paths.
- **Stages** 4, 5, 6, 15
- **Note** *Second-largest gap after F-032, and the one most likely to surface in a real school's first term.*

**F-050 · Online payment capability** — FUTURE · **MISSING**
- **Purpose** The eventual primary settlement route. [D-02]
- **Impl** **None.** `paymentIntegration.ts` is a stub with a working HMAC webhook verifier (fails closed). No payment SDK.
- **Conflicts** **C-2** — the parent portal advertises card checkout that does not exist
- **Direction** Architecture must be *capable* of it; bank transfer preserved. **No payment work before Stage 12/17.**
- **Stages** 12, 14, 17

**F-051 · Provider payment reconciliation** — IMPORTANT SUPPORTING · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Match imported provider records to claims automatically.
- **Impl** `server/services/payment-verification/` (5 modules); `/api/finance/stripe/import`, `/stripe/status`, `/verification/run`, `/api/admin/payments/:id/verify`, `/verification`, `/manual-verify`, `/manual-reject`; `provider_payments`, `payment_verification_attempts`; `client/src/pages/admin/reconciliation.tsx`
- **Conflicts** New **C-28** — named "Stripe" throughout, but it is **spreadsheet import**, not an API integration. The naming has already misled the project's own documentation.
- **Direction** Rename to what it is; keep the matcher, which becomes more valuable, not less, when F-050 arrives
- **Stages** 14, 17

---

# GROUP K — Allocation, custody & distribution

**F-052 · Allocation** — CORE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** Bind specific books to a specific child once the position is settled.
- **Impl** `allocation.routes.ts` `/api/allocations` list/create; `finance_book_allocations` with **three distinct status columns** — `status` (allocation lifecycle), `distribution_status` (hand-over), `custody_status`; `ALLOCATION_STATUSES = allocated | received | absent | cancelled`
- **Parity** B-4 — the three vocabularies must never be merged; `migrations/006` builds each CHECK from *declared ∪ observed* so it cannot reject live rows
- **Deps** F-048
- **Stages** 4, 5, 6, 15

**F-053 · Physical custody lifecycle** — CORE · PARTIAL
- **Purpose** Know where the physical copy is throughout the operational lifecycle. [LOCKED D-03]
- **Impl** `server/custody.ts` — `reserved → prepared → handed_to_teacher → issued → collected` plus `absent | returned | lost | damaged`, with `ALLOWED_TRANSITIONS`; `custody_events`; `/api/allocations/:id/custody` GET/POST; `backfillCustodyStatus`
- **Conflicts** **C-3** — `tryCustody` swallows every illegal transition in a bare `catch {}`, so the machine **records rather than enforces**; `ensureCustodyBackfill` uses a module-level `Set`, which is per-instance memory in a serverless function. **C-4** — `returned` implies lending.
- **Direction** D-03 is locked, but **the current machine is not the final one.** Rules come from Stages 4–5, then the data model, then implementation. **Do not patch the constants to make tests pass.** Two locked constraints now bound it: **[FQ-02]** `returned` is not a normal state — returns are exceptional corrections (F-082); **[FQ-03]** `issued` and `collected` may be **one event or two depending on the school's distribution method**, and the final machine must not duplicate the same real-world event.
- **Stages** 4, 5, 6, 15

**F-053a · Fulfilment route (per child)** — CORE · **MISSING**
> **SUPERSEDED IN PART — Stage 4, Q-3.** This record was written as a *school-level* distribution
> method. The owner's Stage 4 decision replaces that: the route is chosen **per child, by the
> family** — authorised reception collection, or teacher hand-over — and children in the same class
> may differ. The school-wide framing is withdrawn and must not survive as a hidden default.
> See `BUSINESS_RULES.md` BR-039, BR-087, BR-088, BR-130 and conflict C-36. The two *shapes* below
> remain accurate as descriptions of the two routes.
- **Purpose** ~~A school's distribution method determines whether issue and collection are one event or two.~~ **Per child:** the chosen route determines whether issue and collection are one event or two.
  - *Classroom*: `TEACHER HAS BOOK → HANDS TO CHILD → CHILD HAS BOOK` — **issued = collected**, one action completes both.
  - *Office/reception*: `PREPARED → READY FOR COLLECTION → FAMILY ARRIVES → HANDED OVER → COLLECTED` — two distinct events.
- **Impl** **None.** The product currently ships *both* halves and forces both on every school: a payment-side `ready_for_collection → collected` lifecycle **and** a custody-side `issued → collected`, with no notion of which one a given school uses.
- **Conflicts** New **C-35** — the same real-world event is represented twice, and neither is configurable
- **Deps** F-024 (per-school configuration), F-053, F-055
- **Direction** The school's chosen method drives the workflow. **Do not force one physical workflow onto every school**, and do not model one event twice.
- **Stages** 4, 5, 6, 9

**F-054 · "Hand books to teacher" step** — CORE · **MISSING**
- **Purpose** The custody transition between stockroom and classroom.
- **Impl** **No screen exists.** `handed_to_teacher` is a declared state nothing drives.
- **Conflicts** **C-3**
- **Deps** F-053
- **Direction** Required by D-03. Actor is `school_admin`/authorised operations — **no stockroom role** [US-09].
- **Stages** 4, 5, 9

**F-055 · Teacher distribution workflow** — CORE · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** The classroom moment: hand books to 30 children and record what happened.
- **Users** `teacher`
- **Impl** `allocation.routes.ts` `/api/teacher/book-distribution` + `/confirm-received`, `/mark-absent`, `/mark-out-of-stock`, `/report-issue`; admin mirror at `/api/admin/book-distribution`; `client/src/pages/teacher.tsx` (1,010 lines); `DISTRIBUTION_STATUSES = pending_distribution | received_by_student | student_absent | issue_reported | out_of_stock`
- **Parity** B-4 — one canonical teacher-class lookup; B-7 — "Mark Absent" has an `onError`
- **Conflicts** **C-6** (visibility), **C-14** (no temporary assignment), **PP-007** — Stage 0 found 24px tap targets and hover-only controls on the screen that is meant to be used standing up
- **Stages** 5, 9, 10

**F-056 · Extra-copy requests** — IMPORTANT SUPPORTING · WORKING
- **Purpose** A teacher needs another copy mid-distribution.
- **Impl** `/api/extra-requests` list/create, `/:id/approve`, `/:id/reject`; `extra_copy_requests`
- **Parity** B-6 — the extra-copy stock error is surfaced, not swallowed
- **Stages** 4, 5

**F-057 · Collection sheet** — IMPORTANT SUPPORTING · RESTRUCTURED-BUT-UNVERIFIED
- **Purpose** The printed sheet a school hands out on collection day.
- **Impl** `client/src/pages/admin/collection-sheet.tsx`
- **Parity** B-11 — `formatDateTime()` was called with no argument, printing "printed —" on every sheet a school hands out
- **Stages** 9, 10

---

# GROUP L — Communication

**F-058 · Admin ↔ parent messaging** — IMPORTANT SUPPORTING · WORKING
- **Impl** `message.routes.ts` parent + teacher thread endpoints; `notification.routes.ts` `/api/admin/communications*`; `message_threads`, `messages`, `message_audit_logs`; `client/src/pages/admin/communications.tsx`
- **Conflicts** New **C-29** — the **payment webhook** (`POST /api/webhooks/payment-update`) is registered inside `message.routes.ts`. Pure misplacement.
- **Stages** 13

**F-059 · Teacher ↔ parent messaging** — IMPORTANT SUPPORTING · WORKING
- **Impl** `/api/teacher/message-threads*`, `/message-unread`
- **Conflicts** **C-6** — must be limited to families of assigned classes
- **Stages** 7

**F-060 · Notifications & preferences** — IMPORTANT SUPPORTING · WORKING
- **Impl** `/api/notifications/summary`, `/preferences` GET/PATCH; `notification_preferences`
- **Stages** 5, 18

**F-061 · Transactional email** — CORE · WORKING
- **Impl** `server/email.ts` (767 lines) over Resend; per-school branding on every send
- **Conflicts** **C-24** (base64 logos likely stripped by major clients); **C-18** (log fallbacks print live links)
- **Direction** Sends in the **school's** identity [US-02]
- **Stages** 16, 17, 18

**F-062 · Daily digest job** — IMPORTANT SUPPORTING · RESTRUCTURED-BUT-UNVERIFIED
- **Impl** `cron.routes.ts` `/api/cron/run` GET+POST; `CRON_SECRET` constant-time compare; `DRAIN_BUDGET_MS = 24_000`; idempotent per `(job, school_id, run_date)` via `cron_job_runs`
- **Parity** B-10 — a retry must never double-email parents about money
- **Conflicts** New **C-30** — no test asserts that a large school resumes on the next invocation; the architecture for large tenants (batching/checkpoints/cursor) is undecided
- **Stages** 12, 18

---

# GROUP M — Reporting

**F-063 · Admin dashboards & summaries** — IMPORTANT SUPPORTING · WORKING
- **Impl** `dashboard.routes.ts` `/api/admin/dashboard-summary`, `/book-management-summary`, `/recent-activity`; **four competing dashboard screens** in the mockup generations (`admin_dashboard_scholarshelf`, `_command_center`, `_master_command_center`, `_grouped_navigation`)
- **Conflicts** New **C-31** — four dashboard design generations, one shipped implementation
- **Parity** B-7 — a failed query must not render as a confident zero
- **Stages** 9, 10

**F-064 · Financial & distribution reports** — IMPORTANT SUPPORTING · PARTIAL
- **Impl** `/api/admin/reports`, `/api/finance/summary`; `client/src/pages/admin/reports.tsx`
- **Notes** **CSV export is documented and deferred** — not built. Payment-lifecycle counts were fixed (collected payments were vanishing from revenue).
- **Direction** D-10 changes what a financial report must show: subsidy and waived amounts are not revenue
- **Stages** 4, 5, 9

**F-065 · Student profile & distribution history** — IMPORTANT SUPPORTING · WORKING
- **Impl** `/api/students/:id/profile`; `client/src/pages/admin/student-profile.tsx`
- **Stages** 9

---

# GROUP N — School website & CMS *(optional module)*

**F-066 · Page sections CMS** — OPTIONAL MODULE · WORKING
- **Impl** `website.routes.ts` sections CRUD + `/move`; `school_website_sections`; typed sections (hero/about/announcement/contact/custom), draft→published
- **Parity** B-9 — URL scheme allowlist blocks `javascript:` (stored-XSS fix)
- **Stages** 8, 12

**F-067 · Media library** — OPTIONAL MODULE · WORKING
- **Impl** `/api/media` CRUD; `media_assets`; `file-type` + multer validation
- **Stages** 8, 12

**F-068 · Public school website** — OPTIONAL MODULE · WORKING
- **Impl** `public.routes.ts` `/api/public/schools/:code`, `/website`; `client/src/pages/school-public.tsx`; published-only, fails safe to empty
- **Parity** B-9
- **Stages** 8, 12

**F-069 · IT dashboard & website summary** — OPTIONAL MODULE · WORKING
- **Impl** `/api/it/website-summary`; `client/src/pages/admin/it-dashboard.tsx`
- **Conflicts** **C-5**
- **Stages** 8, 9, 12

**F-070 · Public contact form** — OPTIONAL MODULE · WORKING
- **Impl** `POST /api/public/contact`; `client/src/pages/contact.tsx`
- **Stages** 12

---

# GROUP O — Setup, compliance & infrastructure

**F-071 · School setup wizard & go-live checklist** — IMPORTANT SUPPORTING · WORKING
- **Impl** `setup.routes.ts` `/api/admin/setup-status`, `/setup-complete`, `/setup/branding-skip`, `/api/admin/school/settings`, `/api/school/payment-info`; `client/src/pages/admin/setup.tsx`; `normalizeSchoolSetupStatus`
- **Deps** F-025, F-027, F-039
- **Stages** 5, 9

**F-072 · Audit logging** — CORE · WORKING
- **Impl** `audit_logs`, `message_audit_logs`, `console_audit`; `auditLog()` throughout
- **Parity** B-2, B-8
- **Direction** PP-008 — money, **funding decisions** [D-10], child records and cross-tenant actions
- **Stages** 16, 19

**F-073 · Privacy, security & contact pages** — IMPORTANT SUPPORTING · WORKING
- **Impl** `client/src/pages/privacy.tsx`, `security.tsx`, `contact.tsx`, `public-footer.tsx`; consent notices at account creation
- **Stages** 16

**F-074 · Health & production smoke check** — INTERNAL INFRASTRUCTURE · RESTRUCTURED-BUT-UNVERIFIED
- **Impl** `GET /api/health`; `script/smoke-boot.ts` compiles and boots **`api/index.ts` — the artefact Vercel actually runs**
- **Parity** B-12 — replace only with something demonstrably stronger; ordered before the build in CI
- **Stages** 20, 21

**F-075 · Client query-state & error description** — CORE · PARTIAL
- **Purpose** A failed request must never look like a settled fact. (PP-009)
- **Impl** `client/src/components/query-state.tsx`, `client/src/lib/errors.ts`
- **Parity** B-7 in full
- **Conflicts** New **C-32** — adopted by **2 of 42** page files; `describeApiError` by 6
- **Direction** Universal adoption is a UX requirement, not a tidy-up
- **Stages** 9, 10, 13

**F-076 · UK formatting layer** — CORE · PARTIAL
- **Impl** `client/src/lib/format.ts` — en-GB, GBP, `formatYearGroup` normalising `4 | Y4 | Grade 4 | R`
- **Parity** B-11
- **Conflicts** **C-1** — pinned to Reception/Y1–13; D-01 needs school-appropriate terminology. New **C-33** — adopted by 14 files; 20 raw `toLocaleDateString` calls and 20 raw `toFixed(2)` money renders remain
- **Stages** 6, 9, 10

**F-077 · Universal test account** — INTERNAL INFRASTRUCTURE · WORKING
- **Impl** `shared/test-superuser.ts`, `server/middleware/test-superuser.ts`; `TEST_SUPERUSER` permission row; off in production unless `ALLOW_TEST_SUPERUSER=true`; cannot simulate `owner`, `platform_admin` or `student`
- **Stages** 16, 20

**F-078 · Demo seeding endpoint** — INTERNAL INFRASTRUCTURE · LEGACY
- **Impl** `POST /api/seed-users` registered in `server/routes/index.ts`; `script/seed-demo-users.cjs`; `DEMO-001` accounts
- **Conflicts** New **C-34** — a seeding endpoint registered in the production route table. The audit could not verify the `DEMO-001` accounts are dead in production.
- **Stages** 16, 21

---

# GROUP P — Out-of-scope legacy, and what replaces it

**F-079 · Student login** — OUT OF SCOPE · LEGACY
- **Impl** `student` in `USER_ROLES` only; no landing path; excluded from the test account
- **Direction** [D-09] Deprecation register. **Do not delete now.**
- **Stages** 22

**F-080 · Library lending cycle** — OUT OF SCOPE · LEGACY
- **Impl** `returned` in the custody machine and in `book_copies.status`; `return` in `book_inventory_transactions`
- **Direction** **[DECIDED FQ-02]** There is **no** normal lending/return cycle: `BOOK SOLD → HANDED TO CHILD → SALE COMPLETE`. `returned` must **not** be a normal custody state for every book. The legacy return fields **remain in place** until Stages 4–6 decide what survives as part of F-082.
- **Stages** 4, 5, 6

**F-082 · Exceptional return & correction** — CORE · **MISSING** *(as a defined process)*
- **Purpose** **[DECIDED FQ-02]** A sold book may come back **only** as an exceptional correction or refund — wrong book supplied, duplicate issue, incorrect order, cancelled sale, refund, damaged-on-issue replacement, administrative correction.
- **Users** `finance` (financial correction), `school_admin` (physical receipt and inspection)
- **Impl** **No defined process.** Three unrelated mechanisms exist that a correction path could use — the `returned` custody state, `book_copies.status = returned`, and `book_inventory_transactions.return` — but nothing joins them and nothing links a return to the original sale or to a financial correction.
- **Conflicts** **C-4** — those three mechanisms currently read as lending support
- **Deps** F-043, F-044, F-048, F-053
- **Direction** The chain the product needs is `ORIGINAL SALE → RETURN/CORRECTION EVENT → FINANCIAL CORRECTION IF APPLICABLE → PHYSICAL BOOK RECEIVED BACK → INSPECTION → RESTOCK / DAMAGED / DISPOSED`. Exceptional by definition — it must not become an everyday path, and it must not erase the original sale.
- **Stages** 4, 5, 6

**F-081 · Customer-facing multi-academy-trust management** — OUT OF SCOPE · N/A
- **Direction** [D-06] The owner tier is internal. Cross-tenant reporting stays an internal console.
- **Stages** 8

---

# OWNER AMENDMENT — added during Stage 5

> **Traceability note.** Stage 3 was locked on 23 August 2026 **before** this capability was
> introduced. It was added by owner decision during **Stage 5 (OQ-1)** and is recorded here as an
> amendment. The original Stage 3 lock is not rewritten to imply it existed earlier.

**F-084 · Postal / courier fulfilment for online students** — FUTURE · **MISSING**
- **Purpose** A third fulfilment route: books are dispatched to the child rather than collected at
  reception or handed over in class. Intended primarily for **future online students**.
- **Users** `school_admin` or authorised operations; the family receives.
- **Impl** **None**, and none is required in this rebuild.
- **Direction** `BOOKS PREPARED → POSTAL/COURIER DISPATCH → DELIVERY → RECEIPT/OUTCOME RECORDED`.
  It reaches **the same real-world ending as the other two routes** (RE-8 in `WORKFLOWS.md` §10),
  by a different path. **The architecture must not make it impossible; nothing more.**
- **Explicitly not to be designed now** courier integrations · postal APIs · tracking providers ·
  shipping tables · address validation.
- **Deps** F-053a (route resolution), F-044, F-083.
- **Workflows** WF-047 (route resolution), WF-068 (the route itself).
- **Stages** 12 — only to confirm it is not architecturally excluded. Later stages only if activated.

---

# SUMMARY

## 1. Total feature count

**84 features** (F-001 … F-083, including F-053a) across **16 groups**. Three were added by the
Stage 3 locking decisions: **F-082** exceptional return & correction [FQ-02], **F-053a** distribution
method [FQ-03], **F-083** book-supply cycle [FQ-04].

## 2. Feature groups

A Platform & tenant operations (9) · B Identity, authentication & sessions (6) · C Roles, contexts &
staff lifecycle (9) · D School identity & branding (2) · E Academic structure (3) · F Student records
& academic year (3) · G Families, guardians & linking (3) · H Bulk enrolment & import (3) ·
I Catalogue, bundles & inventory (6) · J Ordering & settlement (8) · K Allocation, custody &
distribution (7) · L Communication (5) · M Reporting (3) · N Website & CMS (5) · O Setup, compliance &
infrastructure (8) · P Out-of-scope legacy and its replacement (4).

## 3. Core features — 38

F-010–F-017, F-020–F-027, F-029, F-030, F-032–F-035, F-039, F-041–F-049, F-052–F-055, F-053a, F-061,
F-072, F-075, F-076, F-082, F-083.

## 4. Important supporting — 24

F-018, F-019, F-028, F-031, F-036–F-038, F-040, F-044, F-051, F-056–F-060, F-062–F-065, F-071, F-073.

## 5. Optional CMS module — 5

F-066 Page sections · F-067 Media library · F-068 Public website · F-069 IT dashboard · F-070 Contact
form. Plus the **core-side** dependency F-025 (school identity), which US-02 keeps in Core.

## 6. Internal BytHub — 12

F-001–F-009 (tenant lifecycle, support mode, onboarding, platform dashboard, three console tiers,
destructive ops, console audit), F-074, F-077, F-078.

## 7. Future — 1

F-050 Online payment. *(Also non-feature future items already captured in `PRODUCT.md` §10:
per-copy provenance at confirmation, MIS/SIS integration, offline classroom, custom domains.)*

## 8. Required by locked decisions but currently MISSING — 10

| ID | Feature | Locked by | Why it matters |
|---|---|---|---|
| **F-083** | **Book-supply cycle** (child × academic year) | **FQ-04** | The product's central object. Baskets, payments and allocations are currently loose records with no owning cycle. |
| **F-032** | Academic-year rollover | D-07 | Promotion currently overwrites `students.classId` and rewrites history. **A school's second year is worse than its first.** |
| **F-049** | Alternative settlement routes (cash, instalments, discount/subsidy, school-funded/waived) | D-10, US-06 | One path exists. The system's implicit answer to hardship is "no books". Most likely to surface in term one. |
| **F-024** | Per-school policy & configuration | US-02, US-05, US-07, **FQ-03** | Four locked decisions now assume a configuration surface that does not exist anywhere. |
| **F-053a** | Distribution method (classroom vs office) | **FQ-03** | Both halves ship today and both are forced on every school; the same real-world event is modelled twice. |
| **F-082** | Exceptional return & correction | **FQ-02** | Three unrelated return mechanisms exist; nothing joins them to the original sale or to a financial correction. |
| **F-023** | Time-bounded class assignment | US-10 | Cover and TA access with no way to expire it. |
| **F-035** | Parent access lifecycle | US-03 | No concept of "no active children". |
| **F-054** | "Hand books to teacher" step | D-03 | A declared custody state nothing drives. |
| **F-050** | Online payment | D-02 | Future direction; the portal already advertises it. |

Partially present but materially short of the locked requirement: **F-053** custody (records, does
not enforce), **F-050** online payment (stub only), **F-075/F-076** (foundations at 5–33% adoption).

## 9. Existing features inconsistent with locked Stage 1/2 — 8

F-079 student login (D-09) · F-080 lending concepts (D-04) · F-081 MAT framing / F-004 global
dashboard (D-06) · F-022 hard deletion as a dashboard action (US-04) · F-016 `FINANCE_ROLES`
hard-coding admins as finance (US-05) · F-055/F-059 teacher visibility (D-08) · F-025 branding
straddling core and module (US-02) · F-050's card-checkout promise in the parent portal (D-02, C-2).

## 10. Duplicate / competing implementations — 8

| # | Duplication | Reference |
|---|---|---|
| 1 | **Two enrolment import pipelines** — family enrolment service vs student CSV import | C-26, F-036/F-037 |
| 2 | **Two teacher-assignment models** — `classes.teacherId` vs `class_teacher_assignments` (one canonical lookup already reads both) | F-029 |
| 3 | **Alias endpoint pairs** — `sign-in`/`login`, `sign-out`/`logout`, `enter-support`/`support-mode/enter`, `users/:id`/`admin/users/:id`, `families/enroll`/`families/:id/enroll`, `save-draft` ×2 | C-20 |
| 4 | **Two parent-linking flows** — two-step preview/confirm vs legacy `/link-child` | C-25 |
| 5 | **Role-group constants declared twice** — `core/constants.ts` and `middleware/auth.ts` | C-22 |
| 6 | **Four dashboard design generations**, one shipped | C-31 |
| 7 | **`user_permissions` carrying three unrelated concerns** — branding grants, secondary roles, test flag | C-23 |
| 8 | **Two schema-deployment mechanisms** — `drizzle-kit push` and seven SQL migrations | (Stage 0) |

Plus **misplacements** rather than duplicates: `GET /api/books` in `setup.routes.ts` (C-27) and the
payment webhook in `message.routes.ts` (C-29).

## 11. Documented but not implemented — 5

1. **Card checkout in the parent portal** — `paymentIntegration.ts` is a stub (C-2).
2. **"Automatic Stripe payment verification"** — spreadsheet import, no SDK (C-28).
3. **Open Library automatic ISBN lookup** — promised in the original spec and the pitch; not found in the server (F-040).
4. **Financial report CSV export** — deferred, still absent (F-064).
5. **"Hand books to teacher" screen** — described in the restructure report as missing; still missing (F-054).

*(Also, per Stage 0: `PROJECT_MASTER.md` states 29 tables where 41 exist, "no migration files" where
seven exist, and 18 route files where 19 exist.)*

## 12. Implemented but not documented — 6

1. **F-021 staff offboarding preserving parent access** — exactly what US-04 and US-01 require, already built, mentioned in no product document.
2. **F-020 suspend / reactivate** — the US-04 mechanism already exists.
3. **F-031 student book-level override** — how mixed-ability and mid-year joiners are handled.
4. **F-044 physical copy identity and label printing** — the substrate D-03 needs.
5. **F-028 subjects**, and subject-based teacher assignment.
6. **F-019 secondary role grants** via `SECONDARY_ROLE:*` — the mechanism the whole multi-context model rests on.

*This list matters: three of the six are direct partial answers to decisions the owner made in
Stage 2 believing nothing existed.*

## 13. Owner decisions — all four **DECIDED**

| ID | Question | Decision | Consequence |
|---|---|---|---|
| **FQ-01** | Which import pipeline is the product's? | **DECIDED — A: both.** Student-only **and** student + family/guardian are legitimate use cases | One import capability, two modes. **Both pipelines preserved for now**; the family importer's transactional guarantees stay in the parity baseline. Consolidation → Stages 4, 5, 13, 22. F-036, F-037 |
| **FQ-02** | Does a sold book ever come back? | **DECIDED — A: only as an exceptional correction/refund.** No lending cycle | New **F-082**. `returned` is not a normal custody state. Legacy return fields stay until Stages 4–6 decide what survives. F-080, F-043, F-044, F-053 |
| **FQ-03** | Is "collected" distinct from "issued"? | **DECIDED — C: depends on the school's distribution method** | New **F-053a**. Classroom → issued = collected. Office → two events. The final state machine must not model the same real-world event twice. F-053, F-055, F-024 |
| **FQ-04** | What is a cycle? | **DECIDED — A: one book-supply cycle per child per academic year** | New **F-083**, now the product's central object. All mid-year activity stays inside the existing cycle; only rollover creates the next one; historical cycles are immutable in meaning. F-032, F-045, F-052 |

**No open owner questions remain at Stage 3.**

---

## What Stage 3 deliberately did not do

No database structure, service or folder architecture, endpoint design, state machines, permission
matrix, UI layouts, or implementation order. No implementation selection between competing versions —
that is Stage 22's migration matrix, and it will not be decided by "newest wins".
