# WORKFLOWS.md — Stage 5: Workflows

```
STAGE 5 — WORKFLOWS
STATUS: LOCKED
Locked: 23 August 2026 by the owner (BytHub Technology Ltd)
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` — all LOCKED.
A later stage that finds a conflict with these workflows **flags it**; it does not change the product.

**Purpose.** How actors, rules and features move through time from a trigger to a completed outcome.
No database, no architecture, no state machines, no implementation selection.

**Method note.** Where the current code carries several statuses for one real-world happening, this
document describes **the happening**, not the statuses. §16 does that reduction explicitly.

---

## Reading a workflow

```
WF-nnn · Name — BAND
  T    trigger            A    actors            P    preconditions
  Flow                    numbered sequence
  Alt                     valid variations
  Exc                     failures and edge cases
  BR / F                  rules and features
  Data                    concepts touched (names only, not tables)
  Audit                   what must be attributable
  Now                     what represents this today
  Parity                  Stage 0D behaviour that must survive
  Gap                     what is missing or conflicting
  Stages                  where it is resolved
```

**BAND** — `CORE` · `SUPPORTING` · `CMS MODULE` · `INTERNAL`

---

# A · School lifecycle

**WF-001 · Onboard a school** — INTERNAL
T BytHub agrees a new school. A `platform_admin`. P none.
Flow 1 create the tenant with its school code · 2 tenant enters `pending_setup` · 3 invite the first
administrator by email · 4 invitation expires in 7 days.
Alt resend · revoke and reissue.
Exc email delivery fails → invitation still exists and can be resent; **the link must not be written
to a log** (BR-124).
BR 004, 008, 017, 026, 033, 121 · F F-001, F-003.
Data tenant · school code · invitation.
Audit tenant created · invitation issued, resent, revoked.
Now `owner.routes.ts` `/api/owner/schools`, `/invite-admin`, `/resend`, `/revoke`.
Gap **C-18** — the invite link is logged in full on delivery failure, un-gated.
Stages 16.

**WF-002 · First-admin setup to go-live** — SUPPORTING
T the first administrator accepts. A `school_admin`. P tenant `pending_setup`.
Flow 1 accept invitation, set credentials · 2 configure school identity (BR-034) · 3 create classes ·
4 build the catalogue · 5 add students and families · 6 complete the go-live checklist · 7 tenant
becomes `active`.
Alt branding skipped and returned to later.
Exc setup abandoned → tenant stays `pending_setup`; nothing operational is reachable.
BR 026, 033, 034, 040, 041 · F F-071, F-025, F-027, F-039.
Now `setup.routes.ts` `/api/admin/setup-status`, `/setup-complete`; `admin/setup.tsx`.
Gap BR-040 — the level vocabulary is fixed at Reception/Y1–13, so a supplementary school cannot name
its own levels (**C-1**). BR-041 — no general school-configuration surface (**C-17**).
Stages 6, 9, 10.

**WF-003 · Suspend and reactivate a school** — INTERNAL
T non-payment, request, or incident. A `platform_admin`.
Flow 1 set status suspended · 2 **every session scoped to that school is refused and destroyed** ·
3 later, reactivate → status active → sessions resume normally.
BR 007, 121 · F F-001, F-005.
Parity **B-2** — the choke point returns `false`, never a `Response`; returning a truthy object let
suspended schools keep operating.
Now `owner.routes.ts` suspend/restore; `ensureSessionSchoolIsActive`.
Stages 7, 16.

**WF-004 · Enter and leave support mode** — INTERNAL
T a school raises a problem. A `platform_admin`. P a named school.
Flow 1 enter support for one school id · 2 platform user now acts inside that tenant only · 3 act ·
4 exit → cross-tenant reach restored, tenant reach removed.
Exc attempting to manage a platform account while in support mode → refused.
BR 008, 121 · F F-002.
Audit entry, every action performed inside, exit.
Now `owner.routes.ts` enter/exit (**two alias pairs**, C-20).
Parity **B-8**.
Stages 7, 16.

**WF-005 · Archive, request deletion, purge** — INTERNAL
T school leaves the platform. A `platform_admin` (archive, request) → `owner` (purge).
Flow 1 archive → read-only, sessions refused · 2 request deletion → `pending_deletion`, cooldown
starts · 3 **7 days must pass**, eligibility read from the audit trail · 4 `owner` purges under
break-glass.
Exc restore before purge.
BR 004, 007, 008, 121 · F F-001, F-008.
Audit each transition; the purge names its author and reason.
Gap **US-08** — purge is currently reachable by both platform roles; it should be `owner` only.
Stages 7, 16.

---

# B · Staff

**WF-006 · Invite staff** — SUPPORTING
T a new member of staff joins. A `school_admin`.
Flow 1 choose role · 2 optionally link them to a family as a guardian · 3 send invitation ·
4 invitation expires.
BR 017, 026, 037 · F F-018, F-012.
Data invitation · role · optional family link and relationship.
Gap BR-037 — an invited administrator silently gains finance authority (**C-13**).
Stages 7.

**WF-007 · Accept a staff invitation** — SUPPORTING
T staff member opens the link. A the invitee.
Flow 1 validate token · 2 create the account · 3 **if the invitation carried a family link, bind them
as a guardian and grant the parent context** · 4 land on their role's default screen.
Alt the person already has an account → the role is added rather than a second account created.
Exc expired or already used → refused, with a distinguishable message.
BR 012, 014, 020, 023, 026 · F F-012, F-019.
Parity **B-1** (hashed tokens, session regeneration, `session.save` before the response).
Now `auth.routes.ts` accept-invite; `invites.familyId` / `relationship`.
Stages 7.

**WF-008 · Grant or remove a secondary role** — SUPPORTING
T someone takes on a second job. A `school_admin`.
Flow 1 add the role · 2 the context appears in their switcher · 3 removing it withdraws the context.
BR 013, 014, 015 · F F-019, F-017.
Gap **C-23** — role grants share one untyped string table with branding permissions and a test flag.
Stages 6, 7.

**WF-009 · Suspend a staff member** — CORE
T staff member leaves or is suspended. A `school_admin`.
Flow 1 set status disabled · 2 sessions invalidated · 3 history remains attributable · 4 reactivate
if they return.
Exc self-suspension refused.
BR 016, 021, 022 · F F-020.
Now `POST /api/admin/users/:userId/suspend` / `/reactivate` — **already implemented and correct**.
Gap **C-12** — a destructive `DELETE` sits on the same admin surface (BR-022).
Stages 7, 16.

**WF-010 · Offboard staff, preserving the parent relationship** — CORE
T a staff member who is also a guardian leaves the staff role. A `school_admin`.
Flow 1 remove staff secondary roles · 2 if a staff role was primary, downgrade the account to parent ·
3 guardian record, child links and parent access all survive.
Exc no parent role to preserve → refused (409) with an explanation, and the administrator uses WF-009.
BR 010, 021, 023 · F F-021.
Now `POST /api/admin/users/:userId/offboard-staff` — **already implemented**, and matches US-01/US-04
precisely. Undocumented before Stage 3.
Stages 7.

**WF-011 · Assign a teacher to a class** — CORE
T timetabling. A `school_admin`.
Flow 1 assign · 2 the teacher context becomes available · 3 the class appears in their list.
Alt subject-based assignment for a shared teacher.
BR 014, 051, 052 · F F-029.
Parity **B-4** — one canonical teacher→class lookup; a second one previously left subject-assigned
teachers with an empty distribution list and 404s on every action.
Gap two storage models behind one lookup; no time bounds.
Stages 6, 7.

**WF-012 · Temporary class assignment (cover, TA)** — CORE
T a teacher is absent, or a TA supports the class. A `school_admin`.
Flow 1 assign the person to the class **with a start and an end** · 2 access begins at start ·
3 access ends at end, with no further action.
Alt end it early.
Exc an assignment that has expired must not grant access even if the screen still lists it.
BR 051, 053, 054 · F F-023.
Data assignment · start · end.
Audit who granted it, for which class, for how long.
Now **nothing** — both assignment models are open-ended (**C-14**).
Stages 6, 7.

**WF-013 · Assignment expiry** — CORE
T the end time passes. A the system.
Flow 1 access to the class ends · 2 anything the person recorded while assigned remains theirs and
remains valid.
BR 053, 123 · Gap **C-14**.
Stages 6, 7.

---

# C · Guardians and parents

**WF-014 · Create a guardian with no account** — CORE
T the school records who is responsible for a child. A `school_admin`.
Flow 1 create the guardian on the family with name, relationship, contact, primary-contact flag ·
2 portal access status is "none" · 3 the child is fully operable with no guardian login at all.
BR 010, 011 · F F-033.
Now `families/:id/guardians`. Already correct — this is the US-01 shape.
Stages 6.

**WF-015 · Invite a guardian to the portal** — CORE
T the school wants the family online. A `school_admin`.
Flow 1 issue a linking code bound to the guardian's email · 2 send it · 3 portal status becomes
"invited".
Exc delivery fails → WF-025 re-sends; **the code must not be logged** (BR-124).
BR 026, 102, 103, 104 · F F-034, F-038.
Parity **B-5** — a completed enrolment auto-issues a code and sets "invited"; a test that asserted
otherwise was corrected, not the code.
Stages 5→9.

**WF-016 · Parent self-registration** — CORE
T a guardian creates their own account. A prospective parent.
Flow 1 register (rate-limited) · 2 no children are attached yet · 3 they proceed to WF-017.
Exc username rule violated → **the rule is stated before typing, in the server's own words**.
BR 011, 020, 027, 031 · F F-011.
Parity **B-6** — a parent named O'Brien previously got "Registration failed. Please try again." and
could retry forever.
Stages 9.

**WF-017 · Redeem a linking code** — CORE
T the guardian has a code. A `parent`.
Flow 1 preview — the code is normalised and checked; **the child's name is returned and nothing
else** · 2 the guardian confirms · 3 the link is created · 4 the guardian record is bound to the
account, best-effort · 5 portal status becomes "active".
Alt family code links several children at once.
Alt rotate — an administrator issues a new code; the old one stops working.
Exc used → distinct message. Expired → distinct message. **Belongs to another email → 403, not 404.**
Binding the guardian record fails → the redemption still stands.
BR 003, 014, 104, 105, 106, 107, 108 · F F-034.
Parity **B-6** in full — preview and confirm must normalise identically; they once did not, so a
parent saw their child's name and was then told the code was invalid.
Audit the redemption, with the children linked.
Stages 7, 12.

**WF-018 · Parent access becomes inactive** — CORE
T the account's last active child relationship ends — leaver, rollover, unlinking. A the system.
Flow 1 detect that no active relationship requires portal access · 2 access becomes inactive ·
3 **the account and all history are retained**.
Alt a sibling enrols later, or a new school relationship is created → access is restored without
re-creating the account.
BR 025, 010 · F F-035.
Now **nothing** — there is no concept of "no active children" (**C-15**).
Stages 6, 7, 16 (retention, reactivation, anonymisation).

---

# D · Enrolment and import

**WF-019 · Student-only import** — SUPPORTING
T the school has a pupil export with no guardian data. A `school_admin`.
Flow 1 upload · 2 **analyse and preview** — rows validated, students matched or new, classes resolved ·
3 administrator reviews · 4 commit in one transaction · 5 each imported child gets a cycle for the
current year (WF-024).
Alt classes created where missing, within this tenant only.
Exc invalid rows → WF-021.
BR 094, 095, 098, 099, 101 · F F-037.
Gap **C-26** — this pipeline's validation, preview semantics and transactional guarantees differ from
WF-020's. Both use cases are required (FQ-01); the duplication is not.
Stages 13, 22.

**WF-020 · Student + family/guardian import** — SUPPORTING
T the school maintains its own enrolment data. A `school_admin`.
Flow 1 upload · 2 analyse against a re-read school snapshot · 3 review · 4 **commit everything in one
transaction, including one linking code per touched family** · 5 **after the commit succeeds**, send
invitations · 6 each child gets a cycle.
Exc a mail outage **must not** lose an import of 300 families. Re-running must not re-issue a code
already in a guardian's inbox.
BR 094–103 · F F-036.
Parity **B-5** in full — this is the highest-value guarantee in the codebase.
Audit the import, its author, and the rows committed.
Stages 13, 22.

**WF-021 · Invalid or partial rows** — SUPPORTING
T validation finds problems. A `school_admin`.
Flow 1 the preview names every problem row and why · 2 the administrator fixes the source or excludes
rows · 3 commit proceeds for the rest, or is abandoned entirely.
Open point **whether a partial commit is permitted at all.** BR-095 says an import commits completely
or not at all — which is about *atomicity of the committed set*, not about whether excluded rows may
be dropped. Stage 6 must not read it as forbidding row exclusion.
BR 095, 098, 099 · Stages 6, 9.

**WF-022 · Re-run an import** — SUPPORTING
T corrected data, or an unclear first result. A `school_admin`.
Flow 1 re-upload · 2 identity resolution matches the existing students, families and guardians ·
3 **live linking codes are left alone** · 4 only genuine changes are applied.
BR 097, 099, 100 · Parity **B-5**.
Gap identity resolution differs between the two pipelines (**C-26**).
Stages 13.

**WF-023 · Send pending invitations** — SUPPORTING
T guardians whose email arrived late or bounced. A `school_admin`.
Flow 1 request pending invitations · 2 idempotent, rate-limited (4 per school per hour) · 3 codes
already live are reused, not reissued.
BR 097, 103 · F F-038.
Stages 5→9.

---

# E · Academic year and the cycle

**WF-024 · Enrol a child and open their cycle** — CORE
T a child becomes enrolled/active for an academic year. A `school_admin`, or an import.
Flow 1 the child becomes active for the year · 2 **their book-supply cycle for that year is created
immediately** · 3 the cycle is empty — no requirements, £0 required, £0 payable, nothing settled,
nothing allocated, nothing distributed.
**The empty cycle is the point.** It is what makes "this child has nothing to pay" distinguishable
from "nobody has provisioned this child".
BR 042, 126 · F F-083, F-030.
Data child · academic year · cycle.
Audit the cycle's creation.
Now **nothing** — no cycle object exists (**C-37**, C-9).
Stages 6, 15.

**WF-025 · Mid-year joiner** — CORE
T a child arrives in February. A `school_admin`.
Flow 1 enrol → cycle opens for the current year (WF-024) · 2 their class's current requirement is
applied, or a child-specific override is used · 3 settlement and fulfilment proceed normally.
BR 043, 050, 058, 127 · F F-031, F-083.
Now handled in practice by the student book-level override — real, and undocumented until Stage 3.
Stages 6.

**WF-026 · Class move within a year** — CORE
T a child changes class in March. A `school_admin`.
Flow 1 the child's class changes from that date · 2 **what was true before the move stays true** —
earlier requirements, settlements and hand-overs remain attributed to the old class · 3 any new
requirement follows the new class.
BR 045, 046, 048, 127 · Gap **C-9** — `students.classId` is a single mutable pointer, so a move
silently rewrites history.
Stages 6, 15.

**WF-027 · Leaver** — CORE
T a child leaves. A `school_admin`.
Flow 1 the child becomes inactive or alumni · 2 **their cycles and history survive** · 3 outstanding
amounts remain visible · 4 if this was the guardian's last active child, WF-018 runs.
BR 025, 045, 049 · Stages 6, 16.

**WF-028 · Annual rollover** — CORE
T the school moves to the next academic year. A `school_admin`, deliberately — never by date alone.
Flow 1 the administrator starts rollover for the next year · 2 advance students to their next class ·
3 create new classes · 4 mark leavers · 5 admit joiners · 6 **create each continuing child's cycle for
the new year** · 7 the previous year's cycles close and become historical.
**Constraint** After rollover, every report about the previous year must return exactly what it
returned before it.
Alt run it in stages; review before committing.
Exc a child with an outstanding position in the old year — the outstanding amount stays on the old
cycle, and must not migrate into the new one.
BR 044, 045, 046, 047, 048, 049 · F F-032, F-083.
Data cycle · class membership by year · academic year.
Audit the rollover, its author, and the population moved.
Now **nothing** (**C-9**).
Stages 6, 15.

**WF-029 · Correct a historical record** — CORE
T a mistake in a past year is found. A `school_admin` or `finance`.
Flow 1 record a correction against the original record, naming the author and the reason · 2 the
original entry survives · 3 reports reflect the correction, and can show what changed.
**Distinction** BR-045 forbids a *later year silently rewriting* an earlier one. BR-046 explicitly
permits a *deliberate, attributed correction*.
BR 045, 046, 114, 115 · Stages 6, 12, 19.

---

# F · Requirements

**WF-030 · Assign a bundle to a class** — CORE
T the school decides what a class needs. A `school_admin`.
Flow 1 build the bundle · 2 assign it to the class, optionally for an academic year · 3 every child in
that class now has a requirement.
Exc removal confirms by name.
BR 057, 059 · F F-041, F-042.
Parity **B-2** (tenant asserts on both sides), **B-7** (confirm by name).
Stages 6.

**WF-031 · Create a child's initial requirement item** — CORE
T a bundle applies to the child. A the system, on assignment or enrolment.
Flow 1 a requirement item is created inside the child's cycle · 2 it carries a required value ·
3 subsidy or discount may reduce the payable value (WF-039) · 4 the family is told what is owed.
BR 042, 057, 064, 127 · F F-045, F-083.
Now a basket with one `totalAmount`, not owned by any cycle (**C-37**).
Stages 6, 15.

**WF-032 · Child-specific override** — SUPPORTING
T mixed ability, or a joiner needing a different set. A `school_admin`.
Flow 1 set an override for the child · 2 it supersedes the class bundle · 3 the requirement item is
built from the override.
BR 058 · F F-031.
Stages 6.

**WF-033 · Add a requirement after an earlier settlement** — CORE
T a class requirement changes in January, or a child needs an extra book. A `school_admin`.

```
EXISTING SETTLED ITEM          Sept · Maths + English · £40 · SETTLED
              +
NEW REQUIREMENT                Jan  · Science          · £15 · OUTSTANDING
              ↓
SAME ANNUAL CYCLE  +  NEW SETTLEMENT ITEM
```

Flow 1 a **new item** is created inside the same cycle · 2 the earlier item stays settled — **the £40
must not become unpaid** · 3 the new item is settled by any legitimate route · 4 fulfilment for the
new item proceeds independently.
Exc the family disputes it → messaging, and possibly WF-040 or WF-041.
BR 043, 127, 128, 129 · F F-083, F-045.
Audit who added the requirement, and why.
Now **nothing groups the items** (**C-37**).
Stages 6, 15.

**WF-034 · Replacement needed BEFORE the student received the book (Branch A)** — CORE
T wrong book selected, wrong copy prepared, damaged before hand-over, a manufacturing defect found
before hand-over, or any school/supply-side error. A `teacher` or `school_admin`.
```
PROBLEM DETECTED
  → the original copy DOES NOT COUNT as a successful student hand-over
  → replacement provided
  → NO EXTRA FAMILY CHARGE
```
Flow 1 the problem is recorded against the child's fulfilment, **before** any successful hand-over ·
2 the defective or wrong copy is accounted for in stock and custody (WF-057) · 3 a replacement copy is
prepared and fulfilled by the child's chosen route · 4 **no new payable requirement is created**.
**[LOCKED OQ-3, Branch A]** This is the school correcting its own fulfilment problem. It MUST NOT
reach the settlement domain at all.
Exc insufficient stock for the replacement → surfaced, not swallowed; the child's hand-over stays
incomplete rather than being recorded as done.
BR 063, 080, 091, 114, 127 · F F-056, F-082.
Audit what was wrong, who found it, which copy was withdrawn, which replaced it.
Stages 6, 9.

**WF-069 · Replacement request AFTER the student received the book (Branch B)** — CORE
T a book is lost, damaged, destroyed, or otherwise needs replacing **after** a successful hand-over.
A `teacher` requests; `finance` and `school_admin` are notified.
```
TEACHER REQUESTS REPLACEMENT  →  REASON MANDATORY  →  REQUEST SUBMITTED
        →  FINANCE AND SCHOOL ADMIN NOTIFIED
```
Flow 1 the teacher states **what is needed and why** — the reason is mandatory · 2 the request is
submitted · 3 finance and the school administrator are notified · 4 the administrator may review it
operationally · 5 **finance decides whether it is chargeable** (WF-070).
**[LOCKED OQ-3, Branch B]** The teacher **MUST NOT** decide whether the family is charged. Their
responsibility ends at *what is needed* and *why*.
**Four separate real-world events — do not collapse them:**
```
TEACHER REQUEST → ADMIN OPERATIONAL REVIEW → FINANCE CHARGE DECISION → FAMILY SETTLEMENT
```
**"Replacement needed" does not mean "family owes money."**
BR 069, 112, 118, 127 · F F-056.
Data replacement request · reason · requester · child · book.
Audit the request and its reason.
Now `extra_copy_requests` exists with a mandatory reason and approve/reject — but it carries **no
charge decision and no finance notification** (**C-39**).
Stages 6, 7, 9.

**WF-070 · Finance decides whether a replacement is chargeable** — CORE
T a Branch-B replacement request exists. A `finance` (or `school_admin` where the school has
configured that overlap, BR-037).

**If NOT chargeable**
```
REPLACEMENT APPROVED → SCHOOL ABSORBS COST → NO NEW FAMILY PAYABLE POSITION → REPLACEMENT PROCEEDS
```
The decision and its reason MUST be audited.

**If chargeable**
```
EXISTING ANNUAL CYCLE
  → NEW REPLACEMENT REQUIREMENT ITEM
  → product = the required replacement book
  → price / payable amount
  → new payable position
  → PARENT NOTIFIED  (WF-071)
```
**The previously settled requirement stays settled.**
```
ADAM — 2026/27
  INITIAL BOOKS          £45   SETTLED ✓
  REPLACEMENT MATHS      £12   OUTSTANDING
```
It must **not** become an unpaid £57 position — this is Q-2's rule (BR-128) applied to replacements.
Flow 1 finance reviews the request · 2 decides chargeable or absorbed, with a reason · 3 if
chargeable, a new requirement item is created inside the child's existing cycle (WF-033) · 4 the
family is notified (WF-071) · 5 the replacement is fulfilled by the child's route.
BR 069, 118, 119, 127, 128, 129 · F F-049, F-083.
Audit the decision, the author, the reason, the amount, and the before/after position.
Now **nothing** — no charge-decision concept exists (**C-39**).
Stages 6, 7, 19.

**WF-071 · Notify the family of a new payable requirement** — CORE
T a new payable requirement item is created — a chargeable replacement, a mid-year addition, or a
changed class requirement. A the system → `parent`.
```
NEW PAYABLE BOOK REQUIREMENT → IN-APP NOTIFICATION AND/OR EMAIL
        → PARENT SEES THE NEW REQUIREMENT → PARENT SETTLES IT BY A VALID ROUTE
```
The notification identifies: the **child** · the **book or product** · an appropriate **reason or
explanation** · the **amount payable** · the **settlement action required**.
**Internal staff notes MUST NOT be exposed.** Detailed wording belongs to a later stage.
BR 036, 071, 127 · F F-060, F-061.
Audit the notification sent, and to whom.
Stages 9, 18.

---

# G · Settlement

*Six routes, one settled position (BR-065). Each of the following settles **one requirement item**.*

**WF-035 · Bank transfer with a reference** — CORE
T the family is told what is owed. A `parent` → `finance`.
Flow 1 the family sees the item and the school's bank details · 2 a unique reference is issued ·
3 the family transfers and submits the reference · 4 finance matches it against the statement ·
5 finance **confirms** → WF-043.
Alt one payment covers several children (BR-075).
Exc reference already used in this school → refused. Basket already has an order → 409
`duplicate_order`. Reference typed with different case or spacing → still matched.
BR 064, 065, 071, 072, 073, 074, 075 · F F-046.
Parity **B-3**, **B-6** — reference normalised on entry; a dialog dismissal must not erase a
hand-copied reference.
Now the only implemented route.
Stages 12, 15.

**WF-036 · Cash recorded by finance** — CORE
T a family pays cash at the school. A `finance`.
Flow 1 an authorised person records the amount received, against the item · 2 the position moves
toward settled · 3 a receipt is available to the family.
**Constraint** the family cannot assert this themselves (BR-071).
Exc cash handed in at reception → today reception passes it to finance; **not** a new role (US-09).
BR 065, 070, 071, 118 · F F-049.
Audit who received it, how much, when.
Now **nothing** (**C-11**).
Stages 6, 7, 15.

**WF-037 · Instalments** — CORE
T a family pays in parts. A `parent`, `finance`.
Flow 1 a payment is recorded against the item · 2 the outstanding amount reduces · 3 further payments
accumulate · 4 **the item is settled only when outstanding reaches zero**.
Consequence "paid" stops being a boolean.
Exc the family stops paying → the item stays partly settled and visibly outstanding; fulfilment does
not proceed (BR-080, BR-109) unless a subsidy or waiver closes the gap.
BR 065, 068, 129 · F F-049.
Now **nothing**.
Stages 6, 15.

**WF-038 · Subsidy or discount** — CORE
T the school reduces what a family must pay. A `finance` (or `school_admin` where configured).
Flow 1 finance applies a subsidy or discount to the item, with a reason · 2 **the payable value
reduces; nothing is recorded as received** · 3 the family sees the reduced amount · 4 the remainder
settles by any route.
BR 064, 066, 067, 069, 119 · F F-049.
**Audit record [LOCKED OQ-2]** — child · cycle and requirement item · amount · type of adjustment ·
reason · authorising finance user · date and time · financial position before and after.
**No approval threshold.** [LOCKED OQ-2] Finance may authorise a discount, subsidy, waiver or
school-funded amount **regardless of value**. There is no "over £X → second approver" rule and no
senior-approver role. If real customer evidence later requires dual authorisation, that becomes a
future **configurable policy** (BR-041), not something invented now.
Stages 6, 7, 19.

**WF-039 · School-funded or waived** — CORE
T the school pays for a child's books. A `finance`.
Flow 1 finance records the position as school-funded or waived, with a reason · 2 **it must not appear
as money received, and must not appear as revenue** · 3 the item becomes settled · 4 fulfilment
proceeds exactly as for a paid item.
**Constraint** the family must never be able to tell, from their portal, that another family was
subsidised.
BR 064, 066, 069, 119 · F F-049.
**Audit record [LOCKED OQ-2]** — the same eight facts as WF-038, and mandatory: this is money the
school chose not to receive. **No threshold, no counter-signature, any value.**
Now **nothing**. The system's current answer to hardship is "no books".
Stages 6, 15, 19.

**WF-040 · Mixed settlement of one item** — CORE
T a £40 item is met by a £15 subsidy, £15 cash and £10 transfer. A `finance`.
Flow 1 each contribution is recorded with its own route and author · 2 the item's outstanding amount
reduces with each · 3 the item settles at zero · 4 reporting can still say how much was money and how
much was the school's own funding.
BR 065, 066, 067, 068, 129 · Stages 6, 15.

**WF-041 · Online payment** — CORE *(future boundary only)*
T the family pays by card or open banking. A `parent`.
Flow 1 the family pays · 2 the provider confirms · 3 the position settles **through the same
confirmation path as every other route** — no parallel accounting.
BR 065, 076 · F F-050.
Now a stub, plus a working HMAC webhook verifier that fails closed. **No payment work before Stages
12/17.** The portal currently advertises this (**C-2**).
Stages 12, 14, 17.

**WF-042 · Provider reconciliation** — SUPPORTING
T a provider export arrives. A `finance`.
Flow 1 import the spreadsheet · 2 candidate matches are proposed against outstanding items · 3 finance
accepts or rejects each · 4 accepted matches settle via the normal confirmation path.
Exc ambiguous match → left for manual decision, never auto-applied.
BR 065, 071, 072 · F F-051.
Gap **C-28** — named "Stripe" but it is a spreadsheet import.
Stages 14, 17.

---

# H · Allocation and stock

**WF-043 · Confirm settlement → allocate → deduct stock** — CORE
T finance confirms an item. A `finance`.
Flow **one act, all or nothing**: 1 claim the item exactly once · 2 mark it settled · 3 allocate the
books to the child · 4 deduct stock · 5 commit.
Exc insufficient stock → WF-044. Concurrent confirmation → WF-045. Already-allocated basket from an
old partial run → not allocated twice.
BR 077, 078, 079, 080, 081 · F F-048, F-052.
Parity **B-3 in full** — the product's core invariant.
Audit who confirmed, what changed, and the resulting position.
Stages 12, 15.

**WF-044 · Insufficient stock at confirmation** — CORE
T not enough copies. A `finance`.
Flow 1 **the whole confirmation rolls back — nothing changes** · 2 the message names the title:
*"Not enough stock: <title>. Restock before confirming — nothing has been changed."* · 3 the school
restocks · 4 finance confirms again.
BR 079, 063 · Parity **B-3**.
Stages 12, 18.

**WF-045 · Concurrent confirmation** — CORE
T two people confirm at once, or a double-click. A `finance`.
Flow 1 exactly one caller claims the item · 2 the other returns the current state, unchanged, with no
side effects.
BR 073, 074, 078 · Parity **B-3**.
Note the original race did not reproduce; the lock is kept because it makes the outcome structural
rather than a matter of timing.
Stages 12.

**WF-046 · Stock correction** — SUPPORTING
T a miscount, damage in storage, or a delivery discrepancy. A `school_admin`.
Flow 1 record an adjustment with type, quantities before and after, and a reason · 2 stock changes as
a consequence of the record, not instead of it.
BR 062, 114, 115 · F F-043.
Stages 6, 19.

---

# I · Fulfilment

*The domain most changed by Q-3. **Two routes, chosen per child, by the family.***

**WF-047 · Resolve the fulfilment route** — CORE
T the child has books to fulfil. A `parent` chooses; the school records.
```
CHILD HAS BOOKS TO FULFIL  →  FULFILMENT ROUTE RESOLVED  →  PHYSICAL PREPARATION / ROUTING
```
Flow 1 the family chooses · 2 the choice is recorded against the child's requirement · 3 the
subsequent workflow follows it.
**The route MUST be known before books are physically prepared for collection or transferred to a
teacher.** [LOCKED OQ-1] Nothing physical is routed against an unresolved route.
**Routes — current product:** ① **reception collection** (WF-049) · ② **classroom delivery**
(WF-050 → WF-051).
**Route — future:** ③ **postal delivery** (WF-068), available only where the future online-student
capability applies.
**Different children in the same class may legitimately differ.**
BR 039, 087 · F F-053a, F-084.
Audit the choice, and any later change.
Now **nothing** — no fulfilment-route concept exists anywhere (**C-36**).
Note Stage 9 owns which screen carries the choice. Stage 5 fixes only the ordering above.
Stages 6, 9.

**WF-048 · Prepare a child's books** — CORE
T the item is settled and allocated. A `school_admin` or authorised operations — **not a stockroom
role** (US-09).
Flow 1 specific copies are gathered for the child · 2 the copies are recorded as prepared for them ·
3 the route determines what happens next: WF-049 or WF-050.
BR 085, 086, 088 · F F-044, F-053.
Stages 6, 9.

**WF-049 · Reception collection** — CORE
T route = reception. A school staff at reception; the family.
Flow 1 books become ready for collection · 2 the family is told · 3 the family arrives · 4 **staff
confirm the recipient is the parent or an authorised family member** · 5 hand-over recorded ·
6 collected.
Exc nobody collects → the books stay ready, and the school can chase. Wrong adult presents → refused,
and recorded.
BR 010, 087, 130 · F F-053a.
Data guardian record (who is authorised) · readiness · hand-over.
Audit who handed over, to whom, when.
Now **nothing for the recipient check**; a `ready_for_collection → collected` payment lifecycle exists
and is forced on every child regardless of route (**C-35**).
Stages 6, 7, 9.

**WF-050 · Teacher route — transfer into teacher custody** — CORE
T route = teacher, books prepared. A `school_admin` → `teacher`.
Flow 1 books leave the school's store for a named teacher · 2 **the teacher holds custody of books not
yet given out** · 3 the teacher can see what they are holding and for whom.
Exc the teacher is unavailable → the transfer waits, or an administrator takes it back.
BR 085, 086, 088 · F F-054.
Now **no screen exists**; `handed_to_teacher` is a declared state nothing drives.
Stages 6, 9.

**WF-051 · Teacher route — hand to the student** — CORE
T distribution day. A `teacher`.
Flow 1 the teacher works through their class list · 2 for each child, records **received**, **absent**,
**out of stock** or **an issue** · 3 a recorded receipt completes the hand-over — for this route,
issuing to the child *is* collection.
**Constraint** must work on a phone, one-handed, with a class waiting (BR-113).
Exc guardian conflict → WF-052.
BR 051, 056, 087, 109, 110, 113 · F F-055.
Parity **B-4** (one canonical class lookup), **B-7** ("Mark Absent" must have an error path).
Gap Stage 0 found 24px tap targets and hover-only controls on exactly this screen.
Stages 9, 10.

**WF-052 · Guardian conflict — administrator hands over** — CORE
T route = teacher, and the assigned teacher is the child's guardian. A `school_admin`.

```
teacher route → teacher is guardian → BLOCKED → school admin performs and records the hand-over
```

Flow 1 the conflict is detected before the teacher can act · 2 **the teacher cannot proceed — no
warning-and-continue, no override, no self-confirmation** · 3 the child is routed to an administrator ·
4 the administrator performs and records the hand-over.
Exc the administrator is also the guardian → escalate within the school. *(Rare; noted, not solved
here.)*
BR 056, 131 · F F-055.
Audit the block, and the administrator's hand-over.
Now **nothing** — no guardian-conflict check exists on any path (**C-38**).
Stages 7, 9.

**WF-053 · Student absent** — CORE
T the child is not there. A `teacher` or reception staff.
Flow 1 record absent · 2 the books remain the child's and remain in custody · 3 the hand-over is
retried later.
BR 087, 110, 123 · Stages 6, 9.

**WF-054 · Partial availability or out of stock at hand-over** — CORE
T some books are missing at the moment of hand-over. A `teacher`.
Flow 1 record what was handed over and what was not · 2 the shortfall is visible to the school ·
3 the remainder is handed over later, without repeating the first part.
BR 063, 111 · Stages 6, 9.

**WF-055 · Change the fulfilment route** — CORE
T the family changes their mind, or the school needs to. A `parent` or `school_admin`.
**Governing principle [LOCKED OQ-1]: physical reality decides how hard the change is.**

| When | What happens |
|---|---|
| **Before physical transfer** | A simple change of the recorded route. Nothing has moved. |
| **After books have moved into another person's custody** | An **operational transfer**: the books come back from the teacher (or out of the collection holding area) and are re-routed. **The movement is recorded** — custody history is never silently erased. |
| **After final hand-over** | The route is **historical**. It is not rewritten. Anything further goes through a correction workflow (WF-056). |

BR 039, 086, 087, 114 · Stages 6, 9.

**WF-068 · Postal delivery** — CORE *(FUTURE — not required in this rebuild)*
T route = postal, where the future online-student capability applies. A `school_admin` or authorised
operations.
```
BOOKS PREPARED → POSTAL / COURIER DISPATCH → DELIVERY → RECEIPT / DELIVERY OUTCOME RECORDED
```
Flow 1 books prepared for the child · 2 dispatched · 3 delivered · 4 **the delivery outcome is
recorded** — the same real-world ending as the other two routes (RE-8), reached differently.
Exc non-delivery, refusal, or loss in transit → the hand-over is not complete; the child's books are
still owed.
**[OWNER AMENDMENT, Stage 5, OQ-1]** Postal fulfilment is a **future product capability**, intended
primarily for future online students. It is **not required to be implemented in this rebuild**. The
architecture must simply not make it impossible.
**Do NOT design now:** courier integrations · postal APIs · tracking providers · shipping tables ·
address validation. Those belong to later stages if and when the capability is activated.
BR 039, 085, 087 · F **F-084** *(added during Stage 5 — see the amendment note in
`FEATURE_INVENTORY.md`)*.
Stages 12 (must not be architecturally excluded), and later stages only if activated.

---

# J · Exceptional return

*Never a lending loop (BR-090). Exceptional by definition.*

**WF-056 · Wrong book, duplicate issue, or cancelled sale** — CORE
T the school or the family finds an error. A `school_admin`, `finance`.
Flow 1 record the correction event against the original sale · 2 **the original sale is not erased** ·
3 if money must move, a financial correction is recorded (WF-058) · 4 if a book must come back,
WF-057 runs.
**The financial and physical corrections are separate facts** — either may happen without the other.
BR 091, 114, 115, 116 · F F-082.
Stages 6, 19.

**WF-057 · Physical return, inspection, outcome** — CORE
T a book comes back. A `school_admin`.
Flow 1 receive the copy · 2 record it against the original sale · 3 **inspect** · 4 outcome: restock,
mark damaged, or dispose · 5 stock changes as a consequence of the recorded outcome.
BR 062, 091, 092 · F F-082.
Now three unrelated mechanisms exist (`returned` custody state, `book_copies.status`, an inventory
`return` type) and **nothing joins them to the sale** (**C-4**).
Stages 6.

**WF-058 · Refund** — CORE
T money must go back. A `finance`.
Flow 1 record a refund against the item, with a reason · 2 the settled position changes to reflect it ·
3 **a refunded subsidy or waiver is not a refund of money** — the distinction survives · 4 the original
settlement record stands.
BR 066, 114, 115, 116, 118 · Stages 6, 19.

---

# K · Communication

**WF-059 · Admin ↔ family thread** — SUPPORTING
T either side starts a conversation. A `school_admin`, `parent`.
Flow 1 a thread is opened about a child or a position · 2 messages exchanged · 3 the thread can be
closed.
BR 003, 120 · F F-058. Stages 9.

**WF-060 · Teacher ↔ family thread** — SUPPORTING
T a teacher contacts a family. A `teacher`, `parent`.
Constraint **only families of the teacher's assigned classes** (BR-051).
Gap teacher-facing reads are broader than D-08 allows (**C-6**).
F F-059. Stages 7.

**WF-061 · Daily digest** — SUPPORTING
T 07:00 each day. A the scheduler.
Flow 1 authenticate with a constant-time secret compare · 2 for each school with pending work, build
and send the digest · 3 **stop at a wall-clock budget and record how many schools are left** ·
4 resume on the next run.
Exc a retry must **never** double-email families about money — guaranteed by idempotency per
`(job, school, run date)`.
BR 118 · F F-062. Parity **B-10**.
Gap no test asserts that a large school resumes; the architecture for large tenants is undecided
(**C-30**).
Stages 12, 18.

---

# L · CMS module

**WF-062 · Edit and publish a page section** — CMS MODULE
T the school updates its site. A `it_personnel`.
Flow 1 edit a typed section as a draft · 2 publish · 3 the public site reflects it.
Constraint URLs are restricted to an allowed scheme set — this blocks `javascript:` and is a
stored-XSS fix that must survive (**B-9**).
BR 035 · F F-066. Stages 8, 12.

**WF-063 · Manage media** — CMS MODULE
T assets are needed. A `it_personnel`.
Flow upload with type validation · organise · reference from sections.
F F-067. Stages 8, 12.

**WF-064 · Public visitor views a school site** — CMS MODULE
T someone opens `/school/:code`. A public visitor.
Flow 1 resolve the school by code · 2 render **published sections only** · 3 fail safe to empty.
BR 033 · F F-068. Parity **B-9**. Stages 8, 12.

---

# M · BytHub internal operations

**WF-065 · Typed console operation** — INTERNAL
T a support request. A `platform_admin`.
Flow 1 choose a typed operation — suspend a school, reset a user's MFA, send a password reset,
correct a payment status · 2 **no SQL is typed** · 3 the operation is audited.
BR 008, 121 · F F-005. Parity **B-8**. Stages 7, 16.

**WF-066 · Read-only query** — INTERNAL
T a question the typed operations cannot answer. A `platform_admin`.
Flow 1 the query runs as a database role with SELECT-only grants on a schema of views · 2 the session
is read-only and always rolls back · 3 views exclude credentials · 4 audited.
BR 121 · F F-006.
Gap **C-19** — this depends on a migration that cannot run on a fresh database and is skipped by CI;
whether production has the role is unverified.
Stages 15, 16, 21.

**WF-067 · Break-glass write** — INTERNAL
T an emergency nothing else can fix. A `owner` only (US-08).
Flow 1 elevate with a second factor and a stated reason · 2 elevation lasts 15 minutes · 3 write ·
4 alert and audit.
BR 121 · F F-007. Stages 7, 16.

---

# SUMMARY

## 1. Total workflows

**71 workflows** (WF-001 … WF-071) across 13 groups. Four were added by the Stage 5 locking
decisions: **WF-068** postal delivery *(future)*, **WF-069** post-hand-over replacement request,
**WF-070** finance charge decision, **WF-071** notify the family of a new payable requirement.
**WF-034** was rewritten from "extra required copy" into the pre-hand-over (Branch A) correction.

## 2. Core — 47

WF-003, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 024, 025, 026, 027, 028, 029, 030, 031,
033, **034**, 035, 036, 037, 038, 039, 040, 041, 043, 044, 045, 047, 048, 049, 050, 051, 052, 053,
054, 055, 056, 057, 058, **068**, **069**, **070**, **071**.

## 3. Supporting — 15

WF-002, 006, 007, 008, 019, 020, 021, 022, 023, 032, 042, 046, 059, 060, 061.

## 4. Optional CMS module — 3

WF-062, 063, 064.

## 5. Internal BytHub — 7

WF-001, 004, 005, 065, 066, 067 *(and WF-003 straddles: initiated internally, felt by the school)*.

## 6. Already strongly implemented — 18

WF-003, 004, 007, 009, **010**, 011, 014, 016, 017, 019, 020, 022, 023, 030, 035, 043, 044, 045,
plus the CMS three and the console three.

Two deserve naming: **WF-010** (offboarding that preserves parent access) and **WF-043** (the
confirmation transaction) are the two workflows the rebuild most needs to leave alone.

## 7. Implemented in competing ways — 6

| Workflow | Competing representations |
|---|---|
| WF-019 / WF-020 import | Two pipelines, different validation, preview semantics and transactional guarantees (**C-26**) |
| WF-011 teacher assignment | Two storage models behind one lookup |
| WF-017 linking | Two-step preview/confirm **and** a legacy single-step path (**C-25**) |
| WF-004 support mode | Two alias endpoint pairs (**C-20**) |
| WF-049 / WF-051 hand-over | Both a payment-side collection lifecycle and a distribution-side one, forced on every child (**C-35**) |
| WF-002 setup | The books list lives in the setup routes, the rest of the catalogue elsewhere (**C-27**) |

## 8. Missing, required by locked decisions — 25

WF-012 temporary assignment · WF-013 expiry · WF-018 parent inactivity · WF-024 open a cycle ·
WF-025 mid-year joiner *(partly)* · WF-026 class move without rewriting history · WF-028 rollover ·
WF-029 historical correction · WF-031 requirement item · WF-033 later requirement · **WF-034
pre-hand-over correction as a defined path** · WF-036 cash · WF-037 instalments · WF-038 subsidy ·
WF-039 school-funded/waived · WF-040 mixed settlement · WF-047 route resolution · WF-049 authorised
recipient · WF-050 teacher custody · WF-052 guardian conflict · WF-055 route change ·
WF-056/057/058 exceptional return · **WF-069 post-hand-over replacement request routed to finance** ·
**WF-070 charge decision** · **WF-071 new-payable notification**.

*(WF-068 postal is **future**, not counted as missing.)*

## 9. Contradicted by current code — 7

WF-024/WF-028 (a class move or promotion rewrites history) · WF-033 (no way to hold two separately
settled items) · WF-047 (no route concept) · WF-051/WF-052 (nothing blocks a teacher handing over to
their own child) · WF-049 (a collection lifecycle applies to every child regardless of route) ·
WF-057 (`returned` reads as a normal lifecycle state) · WF-009/WF-010 (a destructive delete sits
beside the correct disable path).

## 10. One event, six vocabularies

**The core reduction.** Asking *what actually happened* rather than *what status was set*:

| # | The real-world event | Software representations today |
|---|---|---|
| RE-1 | The school decided this child needs these books | bundle assignment · basket creation — **2** |
| RE-2 | The family was told what is owed | basket total · payment record created — **2** |
| RE-3 | Value moved, or the school decided not to charge | payment reference submitted — **1** *(the other five routes have none)* |
| RE-4 | An authorised person confirmed the position is settled | `PAYMENT_STATUSES.confirmed` · `ORDER_STATUSES.payment_confirmed` · basket status — **3** |
| RE-5 | Specific copies were committed to this child | `ALLOCATION_STATUSES.allocated` · `book_copies.status=allocated` · custody `reserved` · basket `allocated` — **4** |
| RE-6 | Copies were physically gathered | custody `prepared` — **1** |
| RE-7 | Copies moved into a teacher's hands | custody `handed_to_teacher` *(declared, nothing drives it)* — **1** |
| RE-8 | **The books reached the person who takes them away** | `PAYMENT_STATUSES.collected` · `ORDER_STATUSES.distributed` · `ORDER_STATUSES.pending_student_collection` · `DISTRIBUTION_STATUSES.received_by_student` · `ALLOCATION_STATUSES.received` · custody `issued`/`collected` — **6** |
| RE-9 | The hand-over did not happen | absent: `DISTRIBUTION_STATUSES.student_absent` · `ALLOCATION_STATUSES.absent` · custody `absent` — **3**; out of stock: `DISTRIBUTION_STATUSES.out_of_stock` · `ORDER_STATUSES.partially_distributed` — **2** |
| RE-10 | A book came back | custody `returned` · `book_copies.status=returned` · inventory `return` — **3**, none joined to a sale |

**Read the two ends together.** RE-8 — the moment the product exists for — is modelled **six times**.
RE-3, where five of the six locked settlement routes live, is modelled **once**.

That asymmetry is the shape of the work: the codebase over-describes the ending and under-describes
the middle. Stage 6 should not carry six vocabularies forward on the grounds that they exist.

**Not a conclusion, a finding.** Some of these six are genuinely different facts — *finance considers
the order closed* and *the child physically has the books* are not the same thing, and a school that
uses reception collection needs both. Stage 6 decides which distinctions are real. What Stage 5
establishes is that **the current count is not evidence.**

## 11. Owner decisions — all three **DECIDED**

| ID | Question | Decision | Workflows affected |
|---|---|---|---|
| **OQ-1** | When is the route chosen, and can it change? | **Three routes conceptually** — reception collection, classroom delivery, and **postal delivery (future, online students)**. Current product offers the first two. The route MUST be resolved **before** physical preparation or transfer. Changes follow physical reality: simple before transfer · a recorded operational transfer after · historical after final hand-over, corrected not rewritten | WF-047, WF-055, WF-068 |
| **OQ-2** | Do waivers need an approval threshold? | **No threshold.** Finance authorises discount, subsidy, waiver and school-funded amounts at any value. No approval workflow, no senior-approver role. **Full audit is mandatory** — eight facts including before/after position. Dual authorisation, if ever needed, becomes a configurable policy | WF-038, WF-039 |
| **OQ-3** | Is a replacement chargeable? | **Sometimes — and the charge is a finance decision.** **Branch A** (problem before hand-over): school error, replacement provided, **no family charge**. **Branch B** (after hand-over): teacher requests with a mandatory reason → finance and admin notified → **finance** decides chargeable or absorbed → if chargeable, a new requirement item inside the existing cycle, and the family is notified | WF-034, WF-069, WF-070, WF-071 |

**No open owner decisions remain in Stage 5.**

## 12. Amendments to earlier locked stages

Recorded rather than silently applied, so the history stays traceable.

| Stage | Amendment | How it is recorded |
|---|---|---|
| **Stage 3** | **Postal fulfilment** did not exist when Stage 3 was locked. It is a new **FUTURE** capability introduced by the owner during Stage 5. | Added to `FEATURE_INVENTORY.md` as **F-084**, explicitly marked *added during Stage 5 by owner amendment*. The original Stage 3 lock is not rewritten to pretend it was there. |
| **Stage 4** | **BR-039** was written for **two** routes. There are now three, the third being future-only. | `BUSINESS_RULES.md` BR-039 carries a Stage 5 amendment note. |
| **Stage 4** | **BR-112** treated an extra copy as a single approve/reject act. OQ-3 splits it into four distinct events. | BR-112 carries a Stage 5 amendment note pointing at WF-034 / WF-069 / WF-070 / WF-071. |

## 13. New conflict recorded

**C-39 · No replacement charge decision exists.** `extra_copy_requests` carries a mandatory reason and
an approve/reject action — but approval is operational only. There is no finance notification, no
charge decision, no link to a requirement item, and no notification to the family. OQ-3 requires all
four. *(Owning stages 6, 7, 9.)*

---

## What Stage 5 deliberately did not do

No entities or attributes (Stage 6), no permission matrix (Stage 7), no state machines — the
transitions above are named as *events*, not as states — no screens (Stage 9), no schema (Stage 15),
and **no selection between competing implementations** (Stage 22).
