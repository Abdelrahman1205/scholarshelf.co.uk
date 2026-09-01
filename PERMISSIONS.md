# PERMISSIONS.md — Stage 7: Permissions & Authorisation

```
STAGE 7 — PERMISSIONS & AUTHORISATION
STATUS: LOCKED
Locked: 24 August 2026 by the owner (BytHub Technology Ltd)
```

**What "locked" means here.** Later stages **may** implement this contract, **may** discover conflicts
with it, and **may** record traceable owner amendments to it. They **must not** silently rewrite the
authorisation contract. A conflict is flagged, not absorbed.

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` — all LOCKED.
**Compared against** `CURRENT_SYSTEM_MAP.md` · `CURRENT_BEHAVIOUR_BASELINE.md` ·
`RESTRUCTURE_STATE.md` · `REBUILD_SAFETY.md`.

**The implementation is evidence, not authority.** Nothing here is derived from "role X can currently
call endpoint Y". Everything is derived from the locked product chain.

---

## 1. Purpose and principles

This document is the **authorisation contract**. It answers one question:

> Can **this person**, in **this context**, perform **this action** on **this specific resource**,
> **right now**?

Five principles govern every decision below.

**P1 · Role is not authority.** A job title says how someone is presented. It does not say what they
may do. This is the direct fix for **C-13**, where holding `school_admin` silently confers finance
authority on every administrator at every school.

**P2 · Authority is evaluated against the active context, not the stored role.** One human may
legitimately be staff, teacher and parent. Hiding a screen enforces nothing.

**P3 · Scope is part of the permission, never an afterthought.** "A teacher may view students" is not
a permission. "A teacher may view a child where an active staffing intersects that child's active
class membership" is.

**P4 · A relationship that has ended grants nothing.** Expiry is a fact, not a cleanup job. What the
person recorded while the relationship held stays valid and attributable.

**P5 · Security rules are not configuration.** Some authority is deliberately school-configurable
(§15). Tenant isolation, teacher scope, the guardian block, BytHub standing access and student login
are **not**, and must not become configurable for convenience.

---

## 2. The authorisation model

```
PERSON
   ↓                        who they are — a platform identity (DM-007)
ACTIVE CONTEXT
   ↓                        the hat they are wearing this session
ACTIVE AUTHORITIES
   ↓                        what that context is permitted to carry, here
CAPABILITY
   ↓                        the business action they want to take
RESOURCE
   ↓                        the specific thing they want to act on
SCOPE
   ↓                        whether that resource is within their reach
CONDITIONS
                            whether it is permitted right now
```

**The distinction that does the work is CONTEXT vs AUTHORITY.**

- A **context** is a presentation choice: which hat is on. Switching is deliberate and audited.
- An **authority** is a grant: a named bundle of business power, held by a person at a school.

**One active context carries zero, one, or many active authorities.** [LOCKED PA-1]

```
ONE ACTIVE CONTEXT
        ↓
ZERO / ONE / MANY ACTIVE AUTHORITIES

school_admin context
   ├── AUTH-SCHOOL
   └── AUTH-FINANCE     ← only where school policy grants it
```

A capability requires an **authority**, never a role string. A person's authorities come from role
grants (DM-008), active staffing (DM-019), active guardian relationships (DM-014) and **school policy**
(DM-004). Only the authorities belonging to the **active context** are live in a session — so a parent
browsing their child's basket carries no staff authority even though they hold it.

**A second authority does not imply a second context.** An administrator whose school has granted
finance authority exercises it **inside the `school_admin` context** — no switch, no second account
(PA-1, §7). What the audit records is the **authority exercised**, which is a separate fact from the
active context (§20).

This is what makes "school admin who is also finance at a small school" and "school admin who is
emphatically not finance at a large school" the same product without duplicate accounts.

**Authorities** *(six — deliberately few and business-meaningful)*

| ID | Authority | Held by | Note |
|---|---|---|---|
| **AUTH-SCHOOL** | School administration | `school_admin` context | Operating the school's book system |
| **AUTH-FINANCE** | Finance authority | `finance` context always; `school_admin` **only where school policy grants it** | The C-13 fix |
| **AUTH-TEACH** | Class teaching | `teacher` context, **per active staffing** | Never school-wide |
| **AUTH-FAMILY** | Family authority | `parent` context, **per active guardian relationship** | Relationship-derived, not tenant-derived |
| **AUTH-CMS** | Site administration | `it_personnel` context | Optional module; carries **no** operational authority |
| **AUTH-PLATFORM** | Platform operations | `platform_admin` and `owner` | Split further in §11–§12 |
| **AUTH-BREAKGLASS** | Exceptional destructive authority | `owner` **only** | Requires elevated authentication |

*(Seven rows; AUTH-PLATFORM and AUTH-BREAKGLASS are the C-16 fix.)*

---

## 3. Actor and context catalogue

### Customer-facing human contexts

| Context | Authority carried | Tenant | Derived from |
|---|---|---|---|
| `school_admin` | AUTH-SCHOOL, **+ AUTH-FINANCE only by school policy** | one school | explicit role grant |
| `finance` | AUTH-FINANCE | one school | explicit role grant |
| `teacher` | AUTH-TEACH, bounded per staffing | one school | **active staffing** (DM-019) — the context exists because the staffing does |
| `parent` | AUTH-FAMILY, bounded per relationship | **none** | **active guardian relationship** (DM-014) |
| `it_personnel` | AUTH-CMS | one school | explicit role grant · **CMS module only** |

### Internal BytHub contexts

| Context | Authority | Note |
|---|---|---|
| `platform_admin` | AUTH-PLATFORM | routine operations; tenant data **only inside support mode** |
| `owner` | AUTH-PLATFORM + AUTH-BREAKGLASS | exceptional and destructive operations |

### Legacy

| Item | Position |
|---|---|
| `admin` alias | Resolves to `school_admin`. Carries **no** authority of its own. Retire from the product vocabulary; keep the alias for stored data. |
| `student` role | **No capabilities, now or ever** (D-09). Marked for controlled deprecation; the child remains a first-class domain entity (DM-020). Stage 22 owns removal. |

### Non-account and system actors

| Actor | Authority | Bound to |
|---|---|---|
| Scheduler | Named scheduled operations only (§14) | one job, one school, one run date |
| Payment/reconciliation integration | Submit a settlement signal only | a named school, a named integration |
| Email provider | Delivery only | no read authority of any kind |
| Prospective parent (unauthenticated) | Pre-link actions only | nothing until a code is redeemed |
| Test-superuser mechanism | **Not a role.** A development flag that makes contexts available for simulation | **Cannot exist in production** |

---

## 4. Reusable scope definitions

Scope answers *is this resource within reach?* — separately from *may this action be taken at all?*

| ID | Scope | Definition |
|---|---|---|
| **SC-1** | `SAME_SCHOOL` | The resource belongs to the school the session is pinned to. The default for all school staff. |
| **SC-2** | `ASSIGNED_CLASSES` | The set of classes with an **active** staffing for this person (DM-019). |
| **SC-3** | `ASSIGNED_CHILDREN` | A child whose **active class membership** (DM-021) falls in `ASSIGNED_CLASSES`. *This is the only correct definition of "a teacher's children" — it is the intersection, not either side alone.* |
| **SC-4** | `OWN_CHILDREN` | A child with an **active** guardian relationship (DM-014) to this person. Crosses schools freely. |
| **SC-5** | `SELF` | The acting person's own account and profile. |
| **SC-6** | `SUPPORT_SCHOOL` | The one school named in an **active** support engagement (DM-006). |
| **SC-7** | `PLATFORM_GLOBAL` | Tenant metadata and platform state — **never** operational or child data. |
| **SC-8** | `PUBLISHED_PUBLIC` | Content a school has published for public view. |
| **SC-9** | `OWN_RECORDS` | Records this person authored, where a capability is narrowed to them. |
| **SC-10** | `SYSTEM_JOB` | The one job, school and run date a scheduled invocation is bound to. |
| **SC-11** | `INTEGRATION_SUBJECT` | The single settlement subject an integration message refers to, in the school the credential is bound to. |
| **SC-12** | `NONE` | No resource reach at all. The correct scope for an email provider. |

**SC-3 deserves emphasis.** Under OD-3 a child has one active class membership, and a class may have
several teachers. A shared Quran teacher staffed to Classes A, B and C reaches the children of all
three; a child in Class A is reachable by their Arabic *and* their Quran teacher. Neither requires the
child to belong to two classes.

---

## 5. Conditions

Conditions answer *is it permitted right now?*

| ID | Condition | Meaning |
|---|---|---|
| **CD-1** | `SCHOOL_ACTIVE` | The tenant is not suspended, archived, pending deletion or deleted. |
| **CD-2** | `STAFFING_ACTIVE` | The staffing granting reach has started and has not ended. |
| **CD-3** | `RELATIONSHIP_ACTIVE` | The guardian relationship granting reach has not ended. |
| **CD-4** | `FINANCE_AUTHORITY_HELD` | The active context carries AUTH-FINANCE — for `school_admin`, only where school policy grants it. |
| **CD-5** | `NOT_GUARDIAN_OF_TARGET` | The acting person is **not** a guardian of the child being acted on. **Hard, unconditional** (BR-056). |
| **CD-6** | `SUPPORT_ENGAGEMENT_ACTIVE` | An explicit, named-school support engagement is open. |
| **CD-7** | `ELEVATED_AUTH` | Elevated authentication is in force. *Conceptual only — Stage 16 owns the mechanism.* |
| **CD-8** | `PERIOD_OPEN` | The academic period is current, not closed. Closed periods take corrections, not edits. |
| **CD-9** | `NOT_SELF` | A person may not exercise the capability on their own account or authority. |
| **CD-10** | `POLICY_PERMITS` | A school policy setting allows it (§15). |
| **CD-11** | `PRE_HANDOVER` / `POST_HANDOVER` | Whether a successful hand-over (DM-043) has occurred for the item. Splits replacement Branch A from Branch B. |
| **CD-12** | `COOLDOWN_ELAPSED` | The required waiting period has passed (tenant purge). |

---

## 6. Capability catalogue

*Format:* **CAP-nnn · name** — authority · scope · conditions · audit
Resource · rules · workflows · current state.

`AUDIT` means exercising it MUST produce an attributable event (§20). Stage 19 designs the record.

### 6.1 School configuration

**CAP-001 · manage_school_identity** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
School identity and application branding (DM-003). Core, **not** the CMS module. BR-034, 035 · WF-002 ·
*Today* mixed with website styling (**C-5**).

**CAP-002 · manage_school_policy** — AUTH-SCHOOL · SC-1 · CD-1, CD-9 · **AUDIT**
The per-school authority settings in §15 (DM-004). **CD-9: an administrator must not grant themselves
finance authority** — that is the whole point of the setting. BR-037, 038, 041, 122 · *Today* **missing**
(**C-17**).

**CAP-003 · view_school_policy** — AUTH-SCHOOL / AUTH-FINANCE · SC-1 · CD-1
Reading the policy is not changing it.

**CAP-004 · manage_academic_periods** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
School-owned periods (DM-016, OD-2). BR-044–048 · WF-028.

**CAP-005 · run_rollover** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
The deliberate annual transition. Never automatic. BR-044, 045, 047 · WF-028 · *Today* **missing**.

### 6.2 Catalogue, bundles and stock

**CAP-006 · manage_catalogue** — AUTH-SCHOOL · SC-1 · CD-1
Book products (DM-026). BR-060 · *Today* correct, though the list endpoint lives in the wrong file
(**C-27**).

**CAP-007 · manage_bundles** — AUTH-SCHOOL · SC-1 · CD-1
Bundles and their lines (DM-027, DM-028).

**CAP-008 · assign_bundle_to_class** — AUTH-SCHOOL · SC-1 · CD-1, CD-8
What a class needs, in a period (DM-029). BR-057, 059 · WF-030.

**CAP-009 · manage_child_requirement_override** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
A child needs something other than their class's bundle (DM-030). BR-058 · WF-032.

**CAP-010 · manage_physical_copies** — AUTH-SCHOOL · SC-1 · CD-1
Copy identity and labels (DM-031). *Not* custody.

**CAP-011 · record_stock_intake** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Stock arriving (DM-032). BR-062.

**CAP-012 · correct_stock** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
A recorded adjustment with a reason — never a silent recount. BR-062, 114, 115 · WF-046.

**CAP-013 · view_stock_position** — AUTH-SCHOOL / AUTH-FINANCE · SC-1 · CD-1
Finance needs it to judge whether a confirmation will succeed.

### 6.3 Classes, staffing and children

**CAP-014 · manage_classes** — AUTH-SCHOOL · SC-1 · CD-1
Classes and the school's own level vocabulary (DM-017). BR-040 · **C-1**.

**CAP-015 · manage_subjects** — AUTH-SCHOOL · SC-1 · CD-1
DM-018. Small, and load-bearing for the community-school shape under OD-3.

**CAP-016 · manage_class_staffing** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Assigning people to classes, optionally per subject, **with a start and an end** (DM-019). BR-051–054 ·
WF-011, 012 · *Today* two models, neither time-bounded (**C-14**).

**CAP-017 · revoke_class_staffing** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Ending it early. Expiry needs no capability — it is a fact, not an action (P4).

**CAP-018 · manage_children** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Child records (DM-020). **A teacher never holds this** (BR-055).

**CAP-019 · manage_class_membership** — AUTH-SCHOOL · SC-1 · CD-1, CD-8 · **AUDIT**
Placing and moving a child between classes (DM-021). A move **ends** one membership and **starts**
another; it never rewrites the first. BR-045, 046 · WF-026 · *Today* **missing** (**C-9**).

**CAP-020 · archive_child** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Leaver handling. History survives (BR-049). *Destructive-adjacent — see §17.*

**CAP-021 · view_child_record** — AUTH-SCHOOL · SC-1 · CD-1 · | AUTH-TEACH · **SC-3** · CD-2 ·
| AUTH-FINANCE · SC-1 · **bounded by policy** (§9) · | AUTH-FAMILY · SC-4 · CD-3
The single most scope-sensitive read in the product. Four authorities, four different reaches.

### 6.4 Families, guardians and linking

**CAP-022 · manage_families** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
DM-022.

**CAP-023 · manage_guardians** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
The **school's record** of a responsible adult (DM-010) — **independent of any account**. Managing a
guardian is not managing a user. BR-010 · §13.

**CAP-024 · issue_linking_code** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
DM-013. BR-104 · WF-015.

**CAP-025 · rotate_linking_code** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Kills the previous code.

**CAP-026 · redeem_linking_code** — *(no prior authority)* · SC-5 · CD-3 on success · **AUDIT**
The one route from an account to a child. Held by an authenticated person with **no** existing
relationship — this is how AUTH-FAMILY is *acquired*. BR-104–108 · WF-017.

**CAP-027 · import_students_only** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
FQ-01 mode 1. BR-094–101 · WF-019.

**CAP-028 · import_students_and_families** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
FQ-01 mode 2. Same authority, same scope — **two modes of one capability**, not two powers.
WF-020.

**CAP-029 · send_pending_invitations** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Idempotent, rate-limited. WF-023.

### 6.5 Staff and accounts

**CAP-030 · invite_staff** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Including the staff-who-is-also-a-parent case. BR-023, 026 · WF-006.

**CAP-031 · grant_role** — AUTH-SCHOOL · SC-1 · CD-1, CD-9 · **AUDIT**
Granting a context to an account (DM-008). **CD-9: never to oneself** (BR-016). **Platform roles are
not grantable through this capability at all** — see §19.

**CAP-032 · grant_finance_authority** — AUTH-SCHOOL · SC-1 · CD-1, CD-9, CD-10 · **AUDIT**
Deliberately **separate from CAP-031**. This is the act that makes an administrator also finance, and
it must be visible, attributable and impossible to perform on oneself. The C-13 fix in one capability.

**CAP-033 · disable_staff_account** — AUTH-SCHOOL · SC-1 · CD-1, CD-9 · **AUDIT**
**The normal leaver action** (BR-021). Sessions end; history stays attributable. WF-009.

**CAP-034 · reactivate_staff_account** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**

**CAP-035 · offboard_staff_preserving_family** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Removes staff authority, keeps the guardian relationship and parent access (BR-023). WF-010 ·
*Today* **already implemented and correct**.

**CAP-036 · erase_account** — **Not an ordinary administrative capability.** §17.

**CAP-037 · view_staff_directory** — AUTH-SCHOOL · SC-1 · CD-1

**CAP-038 · manage_own_profile** — any context · SC-5
Excludes role, school and authority — those are never self-editable (BR-016, BR-018).

**CAP-039 · switch_context** — any context · SC-5 · **AUDIT**
Only to contexts the person genuinely holds. Refused otherwise (BR-015).

### 6.6 Cycle and requirements

**CAP-040 · open_cycle** — AUTH-SCHOOL *(usually system-initiated at enrolment)* · SC-1 · CD-1, CD-8 ·
**AUDIT**
DM-023. Q-1: created **at enrolment**, empty and legitimately so. WF-024.

**CAP-041 · view_cycle** — AUTH-SCHOOL · SC-1 · | AUTH-TEACH · SC-3 *(fulfilment facts only, §8)* ·
| AUTH-FINANCE · SC-1 *(settlement facts, §9)* · | AUTH-FAMILY · SC-4 *(own child)*
Four authorities see four different slices of the same record.

**CAP-042 · create_requirement_item** — AUTH-SCHOOL · SC-1 · CD-1, CD-8 · **AUDIT**
DM-024. Including a later addition that must not reopen a settled item (BR-128). WF-031, 033.

**CAP-043 · correct_requirement** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
A recorded correction, never a rewrite (BR-114). WF-029.

**CAP-044 · close_cycle** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Part of rollover. A closed cycle is historical.

### 6.7 Settlement

*Every capability in this section requires **AUTH-FINANCE** — which a `school_admin` holds only where
school policy grants it (CD-4). This section is the operational meaning of C-13's resolution.*

**CAP-045 · view_financial_position** — AUTH-FINANCE · SC-1 · CD-1, CD-4
Derived position (DM-035), never a stored total.

**CAP-046 · submit_payment_claim** — AUTH-FAMILY · SC-4 · CD-3
**A family asserts; it does not settle** (BR-071). The only settlement-adjacent capability a family
holds.

**CAP-047 · record_money_event** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
Money actually received: bank transfer, **cash**, instalment, or a future online payment (DM-033).
BR-065, 068, 070 · WF-035, 036, 037 · *Today* only the bank-reference path exists (**C-11**).

**CAP-048 · apply_payment** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
Applying a money event across requirement items, **including several siblings' items** (DM-057, OD-1).
Deliberately separate from CAP-047: receiving money and deciding what it pays for are different acts.

**CAP-049 · confirm_settlement** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
The act that moves stock and allocates books — one transaction, all or nothing (BR-077–081). WF-043.
**The single most consequential capability in the product.**

**CAP-050 · reject_settlement** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**

**CAP-051 · authorise_discount_or_subsidy** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
Reduces payable value. **Not money** (DM-034, BR-067). **No value threshold, no counter-signature**
(OQ-2). WF-038.

**CAP-052 · authorise_waiver_or_school_funding** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
The school pays. **Must never appear as money received or as revenue** (BR-066). Same eight audit facts
as CAP-051. **Any value.** WF-039.

**CAP-053 · correct_settlement** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
Correct forward (BR-114). Includes reversing an incorrect subsidy.

**CAP-054 · issue_refund** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
A refund of money is **not** a reversal of a waiver — the distinction survives (WF-058).

**CAP-055 · import_provider_records** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**

**CAP-056 · match_provider_record** — AUTH-FINANCE · SC-1 · CD-1, CD-4 · **AUDIT**
Ambiguous matches are never auto-applied (WF-042).

**CAP-057 · view_own_settlement_position** — AUTH-FAMILY · SC-4 · CD-3
A family sees what they owe, what they have paid, and that the school has covered an amount —
**without seeing any other family's position** (BR-066's confidentiality corollary).

### 6.8 Fulfilment, custody and hand-over

**CAP-058 · choose_fulfilment_route** — AUTH-FAMILY · SC-4 · CD-3 · **AUDIT**
| also AUTH-SCHOOL · SC-1 *(recording on the family's behalf)*
Reception collection or classroom delivery; postal is future (DM-039, OQ-1). **Must be resolved before
physical preparation or transfer.** WF-047.

**CAP-059 · change_fulfilment_route** — AUTH-FAMILY · SC-4 · CD-3 · | AUTH-SCHOOL · SC-1 · **AUDIT**
Simple before transfer; a **recorded operational transfer** after; after final hand-over it is
historical and goes through correction (WF-055).

**CAP-060 · prepare_fulfilment** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Gathering the copies. **No stockroom role** (US-09). WF-048.

**CAP-061 · transfer_custody_to_teacher** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
The classroom route's missing step (DM-042, BR-088). WF-050 · *Today* **no screen exists**.

**CAP-062 · hold_teacher_custody** — AUTH-TEACH · SC-2 · CD-2
Seeing what one is holding, and for whom. A read, but a scoped one.

**CAP-063 · record_hand_over** — AUTH-TEACH · **SC-3** · CD-2, **CD-5** · **AUDIT**
| also AUTH-SCHOOL · SC-1 *(reception collection, and the CD-5 fallback)*
**The product's defining action** (DM-043). One event, three routes.
**CD-5 is a hard block**: a teacher who is a guardian of the target child cannot perform or confirm it,
regardless of staffing (BR-056). §11.

**CAP-064 · record_reception_collection** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Includes confirming the recipient is the parent or an authorised family member (BR-130) — which is
resolved from the **guardian record** (DM-010), not from a name typed at a desk.

**CAP-065 · record_fulfilment_exception** — AUTH-TEACH · SC-3 · CD-2 · | AUTH-SCHOOL · SC-1 · **AUDIT**
Absent, short, refused, wrong recipient (DM-044). An **event** each time, not a status.

**CAP-066 · dispatch_postal** — *FUTURE* — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Recorded here only so the architecture does not exclude it (F-084, WF-068). Not implemented.

### 6.9 Replacements — the C-39 resolution

*Four capabilities, deliberately held by three different parties. This is the permission-side answer
to "do not collapse admin approval and the charge decision".*

**CAP-067 · request_replacement** — AUTH-TEACH · SC-3 · CD-2 · **AUDIT**
The teacher states **what is needed and why** — reason mandatory (DM-045). **The teacher has no
authority over whether the family pays.** WF-069.

**CAP-068 · provide_pre_handover_replacement** — AUTH-SCHOOL · SC-1 · CD-1, **CD-11 (PRE)** · **AUDIT**
Branch A. A school/supply-side problem before hand-over: replace it, account for the defective copy,
**create no payable requirement**. WF-034.

**CAP-069 · review_replacement_request** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
**Operational review only.** Whether the school can supply it, and from where. Explicitly **not** a
charge decision.

**CAP-070 · decide_replacement_charge** — AUTH-FINANCE · SC-1 · CD-1, CD-4, **CD-11 (POST)** · **AUDIT**
Branch B. Chargeable, or absorbed by the school — with a reason, an author and the resulting position
(DM-046). If chargeable, a new requirement item follows via CAP-042. WF-070 · *Today* **missing**
(**C-39**).

**CAP-071 · receive_returned_copy** — AUTH-SCHOOL · SC-1 · CD-1 · **AUDIT**
Exceptional return: receive, inspect, restock/damage/dispose (DM-048). **Never a lending loop.** WF-057.

### 6.10 Communication

**CAP-072 · message_family** — AUTH-SCHOOL · SC-1 · | AUTH-TEACH · **SC-3** · CD-2
A teacher may contact the families of children they are actively staffed to reach — **and no others**
(**C-6**).

**CAP-073 · message_school** — AUTH-FAMILY · SC-4 · CD-3

**CAP-074 · view_notifications** — any context · SC-5

**CAP-075 · manage_notification_preferences** — any context · SC-5

### 6.11 Reporting

**CAP-076 · view_operational_reports** — AUTH-SCHOOL · SC-1 · CD-1
Distribution, stock, class progress.

**CAP-077 · view_financial_reports** — AUTH-FINANCE · SC-1 · CD-1, CD-4
**Subsidy and waived amounts appear as what they are, never as revenue** (BR-066).

### 6.12 CMS module

**CAP-078 · manage_site_content** — AUTH-CMS · SC-1 · CD-1
**CAP-079 · publish_site_content** — AUTH-CMS · SC-1 · CD-1 · **AUDIT**
**CAP-080 · manage_media** — AUTH-CMS · SC-1 · CD-1
**CAP-081 · view_published_site** — *(unauthenticated)* · SC-8
Published content only, failing safe to empty (BR-035, WF-062–064).

> **AUTH-CMS carries no operational authority whatsoever.** No child, family, settlement, custody or
> staff capability appears anywhere in this document against AUTH-CMS. That boundary is currently one
> of the genuinely well-built things in the codebase and must survive the module split.

### 6.13 Platform operations

**CAP-082 · create_tenant** — AUTH-PLATFORM · SC-7 · **AUDIT**
**CAP-083 · invite_first_admin** — AUTH-PLATFORM · SC-7 · **AUDIT**
**CAP-084 · manage_tenant_lifecycle** — AUTH-PLATFORM · SC-7 · **AUDIT**
Suspend, archive, restore, request deletion. **Not purge.**
**CAP-085 · view_platform_state** — AUTH-PLATFORM · SC-7
Tenant metadata, platform health, job outcomes. **Never operational or child data.**
**CAP-086 · enter_support_mode** — AUTH-PLATFORM · SC-7 → opens SC-6 · **AUDIT**
**CAP-087 · exit_support_mode** — AUTH-PLATFORM · **AUDIT**
**CAP-088 · run_typed_support_operation** — AUTH-PLATFORM · **SC-6** · CD-6 · **AUDIT**
The ~90% of support work that involves no SQL. §13.
**CAP-089 · run_readonly_query** — AUTH-PLATFORM · SC-6 · CD-6 · **AUDIT**
Read-only enforced by the database, not by inspection of the query.
**CAP-090 · elevate_break_glass** — **AUTH-BREAKGLASS** · SC-6 · CD-6, CD-7 · **AUDIT**
**CAP-091 · perform_break_glass_write** — **AUTH-BREAKGLASS** · SC-6 · CD-6, CD-7 · **AUDIT**
**CAP-092 · purge_tenant** — **AUTH-BREAKGLASS** · SC-7 · CD-7, **CD-12** · **AUDIT**
Final and irreversible. §12, §17.

### 6.14 System actors

**CAP-093 · run_scheduled_job** — Scheduler · SC-10 · **AUDIT**
One job, one school, one run date. Idempotent by construction (BR-118).
**CAP-094 · submit_settlement_signal** — Integration · SC-11 · **AUDIT**
An integration may **submit a signal**; it may not confirm settlement. Confirmation stays a human
finance act (CAP-049).
**CAP-095 · deliver_notification** — Email provider · **SC-12**
Delivery only. **No read authority of any kind.** A delivery failure must never destroy the underlying
notification (BR-096's principle, DM-051/052).

---

## 7. School administrator authority

`school_admin` runs the school's book operation: configuration, catalogue, stock, classes, children,
families, guardians, staff, staffing, enrolment and import, rollover, reports, and operational
corrections.

**What it does NOT include:**

| Not included | Why |
|---|---|
| **Finance authority** | Only where school policy grants it (CAP-032, CD-4). **This is C-13's resolution.** |
| Deciding a replacement charge | Finance's call (CAP-070) |
| Erasing accounts as a routine act | §17 |
| Any other tenant | SC-1 |
| Platform capabilities | Never |
| Granting themselves anything | CD-9 |

**The two shapes the model must serve without duplicate accounts:**

```
SMALL / SUPPLEMENTARY SCHOOL          LARGER / MAINSTREAM SCHOOL
one person                             separate people
school_admin context                   school_admin context   → AUTH-SCHOOL
  → AUTH-SCHOOL                        finance context        → AUTH-FINANCE
  → AUTH-FINANCE  (policy grant)
```

Same product, same account model, one policy setting. No second login, and no role invented to
express the combination.

**No context switch is required.** [LOCKED PA-1] Where school policy has granted AUTH-FINANCE to an
administrator, every finance capability in §6.7 is available **directly from the `school_admin`
context** — confirming a settlement, recording cash, authorising a subsidy or making a waiver decision
needs no switch into a finance context.

```
Person A                              Person B
active context: school_admin          active context: finance
authorities:    AUTH-SCHOOL           authorities:    AUTH-FINANCE
                AUTH-FINANCE
```

**Both shapes remain valid, and the standalone `finance` context is not removed** — it remains the
right shape for a person whose job *is* finance.

**Two things PA-1 does NOT change:**

1. `school_admin` **never** carries AUTH-FINANCE by default. It comes from a policy grant (CAP-032)
   or not at all. **The C-13 resolution is untouched.**
2. Every finance-sensitive action must record **AUTH-FINANCE as the authority exercised**, even though
   the active context reads `school_admin` (§20).

---

## 8. Teacher authority and assigned-class scope

**The universal rule — the resolution of C-6:**

> A teacher may act on a child **only where an active class staffing intersects that child's active
> class membership** (SC-3, CD-2).

Applied to **every** teacher-facing capability without exception: viewing children, viewing cycles,
recording hand-over, recording exceptions, requesting replacements, messaging families, and holding
custody. There is no teacher-facing read anywhere in this document scoped more broadly than SC-3.

**What the community-school shape looks like under OD-3:**

```
Class A  ├── Arabic teacher (main)      Class B  ├── Arabic teacher (other)
         └── Quran teacher ─────────────────────  └── same Quran teacher

Children belong to ONE class each.
The Quran teacher reaches the children of A and B — because they are staffed to A and B.
```

**Temporal behaviour (P4, BR-053):**

| | |
|---|---|
| Before start | No access. |
| While active | Full teacher capabilities, bounded to SC-3. |
| After end | **No current access, with no cleanup action required.** |
| Historically | Everything recorded while active remains valid and attributable. An expired staffing does not invalidate a hand-over the teacher performed in March. |

**A teacher never holds:** `manage_children`, any settlement capability, any charge decision, any
school configuration, or any reach into an unassigned class.

---

## 9. Finance authority

Finance is defined by **what it decides**, not by what it can see: incoming money, reconciliation,
references, cash, instalments, discounts, subsidy, school-funded positions, waivers, settlement
confirmation, financial reporting, and replacement charge decisions.

**Two people may hold AUTH-FINANCE by two different routes, and both are correct** [PA-1]:

| | Active context | Authorities | Route |
|---|---|---|---|
| A finance officer | `finance` | AUTH-FINANCE | explicit role grant |
| An administrator at a school that granted it | `school_admin` | AUTH-SCHOOL **+** AUTH-FINANCE | school policy grant (CAP-032) |

Everything in §6.7 behaves identically for both. The difference is **not** what they may do; it is
what the audit records as the authority exercised, and whether the school ever chose to grant it.

**Locked from OQ-2 and carried here unchanged:** finance may authorise discount, subsidy, waiver and
school-funded amounts **at any value**; there is **no approval threshold**, no senior-approver role and
no counter-signature; **full audit is mandatory** — child, cycle and item, amount, type, reason,
authorising person, timestamp, and financial position before and after.

### Finance's view of child data — the C-17 resolution

Both extremes are wrong. Finance that cannot identify the child cannot reconcile; finance that sees
everything about every child holds PII it has no business need for.

**Three bands:**

| Band | Contents | Configurable? |
|---|---|---|
| **Always available** — the operational minimum | child's name · their class · family association · what is required · payable value · settled and outstanding · funding and subsidy applied · payment references and history | **No.** Fixed. Reconciliation is impossible without it, and making it optional would produce a configuration in which finance cannot do its job. |
| **Optionally available** — by school policy | date of birth · contact details · fuller family detail · sibling context beyond the paying group | **Yes** (CD-10, DM-004). Some schools want finance to answer parents directly; others do not. |
| **Never available on finance authority alone** | photographs · safeguarding or pastoral notes · anything held for teaching rather than settlement · **another school's anything** | **No.** Not configurable in either direction. |

A person who holds both AUTH-SCHOOL and AUTH-FINANCE sees the union — but through AUTH-SCHOOL, and
that is a policy decision the school made deliberately (CAP-032).

---

## 10. Parent and guardian relationship authority

**Authority derives from the relationship, not from a role string** (§13). A `parent` account with no
active guardian relationship holds nothing.

**What a family may do for their own children (SC-4, CD-3):** view required books and the settlement
position · submit a payment claim · see that a school-funded or subsidised amount has been applied to
*their* child · choose and change the fulfilment route · collect at reception where the guardian record
authorises them · message the school · receive notifications · link additional children by code.

**What a family may never do:** set any settlement status (BR-071) · see another child, another family
or another family's funding position · reach any staff operation · reach a school's data because one
child attends it · act on a child whose relationship has ended.

**When the last relationship ends (C-15, BR-025, WF-018):**

```
last active guardian relationship ends
        → AUTH-FAMILY becomes inactive automatically — no administrative action
        → the account and all history are retained
        → a later sibling or a new school relationship restores it without recreating anything
```

Retention, reactivation and anonymisation rules are **Stage 16**. Stage 7 fixes only that access
lapses with the relationship and identity does not.

---

## 11. The guardian hand-over block

```
teacher initiates hand-over
        → is the acting person a guardian of THIS child?
              NO  → proceed, subject to SC-3 and CD-2
              YES → DENIED
                    → an authorised school administrator performs and records it
```

**This is a capability + resource + relationship condition — not a role** (CD-5 on CAP-063). The
teacher keeps `record_hand_over` in general; it is refused for this specific child.

**Hard block, per BR-056:** no warning-and-continue, no per-school override, no self-confirmation, and
it is explicitly **excluded from school-configurable authority** (§15). The administrator fallback
(CAP-063 via AUTH-SCHOOL, BR-131) exists so the block never leaves a child without their books.

Edge case noted, not solved: where the administrator is *also* the child's guardian, the school
escalates internally. Rare, and not a permission-model problem.

---

## 12. Platform administrator vs owner — the C-16 resolution

The two are currently indistinguishable in every authorisation decision. They must not be.

| | `platform_admin` — AUTH-PLATFORM | `owner` — AUTH-PLATFORM **+ AUTH-BREAKGLASS** |
|---|---|---|
| Tenant creation, onboarding, first-admin invite | ✔ | ✔ |
| Suspend, archive, restore, request deletion | ✔ | ✔ |
| Enter support mode, typed support operations | ✔ | ✔ |
| Read-only queries inside support | ✔ | ✔ |
| Platform state and diagnostics | ✔ | ✔ |
| **Break-glass elevation and writes** | ✘ | ✔ (CD-7) |
| **Final tenant purge** | ✘ | ✔ (CD-7, CD-12) |
| **Granting or removing platform authority** | ✘ | ✔ — out of band only (§19) |
| **Changing what `platform_admin` may do** | ✘ | ✔ |

`owner` is therefore **not** "platform_admin with a nicer title": it is the holder of the three
authorities that can destroy a tenant, bypass the read-only boundary, or change who else holds
platform power. Everything routine belongs to `platform_admin`.

---

## 13. Support-mode authority

BytHub has **no standing operational access**. Tenant data requires an explicit engagement (DM-006).

```
explicit support engagement → one named school → bounded capabilities → every action audited → exit
```

| | |
|---|---|
| **Outside support mode** | Tenant lifecycle · first-admin invites · platform state · entering support. **No child, family, settlement, custody or message data. No school staff accounts. None.** |
| **Inside support mode (SC-6)** | Typed support operations · read-only queries · **account-level support for that school** · the bounded set the engagement defines. Every action attributable to the engagement. |
| **Prohibited even inside support mode** | Acting as a school user · granting themselves school authority · managing another platform account · **anything requiring AUTH-BREAKGLASS unless the actor is `owner`** · reaching a second school in the same engagement. |

Support mode is a **narrowing**, not a widening: it trades cross-tenant metadata reach for bounded
access to exactly one tenant. It must never become "platform staff can see everything whenever they
want".

### Account recovery is a tenant operation [LOCKED PA-2]

**There is no account-recovery exception to the support boundary.** Resetting or re-enrolling MFA,
helping recover a locked account, sending an account recovery, or any other account-level intervention
on a school's staff is a **tenant operation** and therefore requires an active support engagement.

```
PLATFORM_ADMIN
      ↓ normal platform scope
CANNOT operate on tenant accounts
      ↓
identify the school  →  enter explicit support engagement  →  SUPPORT_SCHOOL scope
      →  perform the authorised support action  →  audit  →  exit support
```

**No recovery-bypass capability exists, and none is to be created.** If a school is locked out,
identifying which school and which account is involved is an **operational** support problem — it does
not justify standing tenant-account authority.

Outside support mode a `platform_admin` may operate on: tenant metadata · onboarding · tenant
lifecycle · platform health · the platform-level capabilities in §6.13.
They may **not** operate on: school staff accounts · child records · family records · settlement
records · any school operational data · **account recovery for a tenant**.

Owner-only break-glass rules (§12, §17) are unchanged by this decision, and support mode is not
broadened by it.

---

## 14. System and integration actors

| Actor | May | May never |
|---|---|---|
| **Scheduler** | Invoke the named scheduled operations for one job, one school, one run date (CAP-093) | Act as a user · read outside its job's subject · run twice for one date |
| **Payment / reconciliation integration** | Submit a settlement **signal** for a subject in the school its credential is bound to (CAP-094) | **Confirm settlement** · create or modify children, families or requirements · reach a second school. *A valid signature is authentication; it is not authority over a tenant.* |
| **Email provider** | Deliver (CAP-095) | Read anything. Scope SC-12 — none |
| **Prospective parent** | Register · look up an invitation by token · redeem a code | Reach any child before a code is redeemed · enumerate accounts |
| **Test-superuser** | Simulate contexts **in development only** | **Exist in production.** It is a mechanism, not a role, and it must not redefine any rule in this document |

---

## 15. Fixed product rules vs school-configurable authority

**School-configurable (DM-004, CD-10) — four settings, no more:**

| Setting | Effect | Locked by |
|---|---|---|
| Does `school_admin` also hold AUTH-FINANCE? | CD-4 on the whole of §6.7 | US-05 |
| Finance's optional child-data band | §9 middle band only | US-07 |
| Permitted presentation customisation | Within the canonical design system | US-02 |
| *(Reserved)* future policy such as dual authorisation | Only if real evidence demands it | OQ-2 |

**FIXED — must never become configurable, for any reason:**

- Cross-tenant isolation (BR-001–009)
- A teacher reaching an unassigned class (BR-051, SC-3)
- The teacher self-hand-over block (BR-056, CD-5)
- BytHub standing access to tenant data (§13)
- Student login (D-09)
- Historical attribution and immutability (BR-045, BR-114)
- Finance's operational minimum, and its never-band (§9 outer bands)
- A family setting a settlement status (BR-071)
- Platform authority being non-grantable in-app (§19)

> The test: **a setting exists to serve a real difference between schools. It must never exist to
> make a security rule negotiable.**

---

## 16. Relationship and temporal conditions

Every scope in this model resolves **as at now**, and every one of them can lapse.

| Scope | Granted by | Lapses when | Historical effect |
|---|---|---|---|
| SC-2 / SC-3 | Active staffing (DM-019) | The staffing ends or expires | Past actions stay valid and attributable |
| SC-4 | Active guardian relationship (DM-014) | The relationship ends; the child leaves | Past visibility ends; past actions remain recorded |
| SC-6 | Support engagement (DM-006) | The engagement is exited | Everything done inside stays attributable to it |
| SC-1 | Role grant + active school | The grant is revoked, or the school becomes inactive (CD-1) | Unaffected |

**The rule that ties them together:** authorisation is computed from **current** relationships;
attribution is computed from **the relationship that held at the time**. Confusing the two is how a
system either strands a teacher's March record or lets an expired assignment keep working.

---

## 17. Destructive and exceptional operations

**Editing is not deleting.** Normal product behaviour is disable, archive and correct-forward.

| Operation | Authority | Conditions | Note |
|---|---|---|---|
| Disable a staff account | AUTH-SCHOOL | CD-9 | **The normal leaver action** (BR-021) |
| Archive a child | AUTH-SCHOOL | — | History survives (BR-049) |
| Correct a record | AUTH-SCHOOL / AUTH-FINANCE | — | Always an addition (BR-114) |
| **Erase an account (CAP-036)** | **Not an ordinary administrative capability** | — | A controlled privacy process, not a dashboard button (BR-022, **C-12**). Stage 16 owns who executes it and how |
| Archive a tenant | AUTH-PLATFORM | — | Reversible |
| Request tenant deletion | AUTH-PLATFORM | — | Starts the cooldown |
| **Purge a tenant (CAP-092)** | **AUTH-BREAKGLASS — `owner` only** | CD-7, CD-12 | Irreversible. Eligibility read from the audit record |
| **Break-glass write (CAP-091)** | **AUTH-BREAKGLASS — `owner` only** | CD-6, CD-7 | Time-boxed, reasoned, alerted |

---

## 18. Permission matrix

*Summary only. The capability records in §6 are authoritative. Scope words carry meaning.*

| Capability | School Admin | Finance | Teacher | Parent | IT (CMS) | Platform Admin | Owner |
|---|---|---|---|---|---|---|---|
| Manage catalogue, bundles, stock | SAME SCHOOL | VIEW ONLY | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Manage classes & subjects | SAME SCHOOL | NO | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Manage class staffing | SAME SCHOOL | NO | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Manage children | SAME SCHOOL | NO | **NO** | NO | NO | SUPPORT MODE | SUPPORT MODE |
| View a child's record | SAME SCHOOL | SCHOOL POLICY (bounded) | **ASSIGNED CLASSES** | **OWN CHILDREN** | **NO** | SUPPORT MODE | SUPPORT MODE |
| Manage families & guardians | SAME SCHOOL | NO | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Import (both modes) | SAME SCHOOL | NO | NO | NO | NO | NO | NO |
| Invite & manage staff | SAME SCHOOL | NO | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Grant finance authority | SAME SCHOOL, NOT SELF | NO | NO | NO | NO | NO | NO |
| Disable a staff account | SAME SCHOOL, NOT SELF | NO | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Erase an account | **NO** (privacy process) | NO | NO | NO | NO | NO | **OWNER ONLY** |
| Run rollover | SAME SCHOOL | NO | NO | NO | NO | NO | NO |
| Create a requirement item | SAME SCHOOL | NO | NO | NO | NO | NO | NO |
| View financial position | **WITH FINANCE AUTHORITY** | SAME SCHOOL | NO | **OWN CHILDREN ONLY** | NO | NO | NO |
| Record money / cash / instalment | **WITH FINANCE AUTHORITY** | SAME SCHOOL | NO | NO | NO | NO | NO |
| Apply a payment across items | **WITH FINANCE AUTHORITY** | SAME SCHOOL | NO | NO | NO | NO | NO |
| Confirm settlement | **WITH FINANCE AUTHORITY** | SAME SCHOOL | NO | NO | NO | SUPPORT MODE (typed correction only) | SUPPORT MODE |
| Authorise subsidy / waiver | **WITH FINANCE AUTHORITY** | SAME SCHOOL, ANY VALUE | NO | NO | NO | NO | NO |
| Submit a payment claim | NO | NO | NO | **OWN CHILDREN** | NO | NO | NO |
| Choose / change fulfilment route | SAME SCHOOL (on behalf) | NO | NO | **OWN CHILDREN** | NO | NO | NO |
| Prepare fulfilment | SAME SCHOOL | NO | NO | NO | NO | NO | NO |
| Transfer custody to a teacher | SAME SCHOOL | NO | NO | NO | NO | NO | NO |
| **Record hand-over** | SAME SCHOOL | NO | **ASSIGNED CLASSES, NOT OWN CHILD** | NO | NO | NO | NO |
| Record a fulfilment exception | SAME SCHOOL | NO | ASSIGNED CLASSES | NO | NO | NO | NO |
| Request a replacement | SAME SCHOOL | NO | **ASSIGNED CLASSES** | NO | NO | NO | NO |
| Review a replacement (operational) | SAME SCHOOL | NO | NO | NO | NO | NO | NO |
| **Decide a replacement charge** | **WITH FINANCE AUTHORITY** | SAME SCHOOL | **NO** | NO | NO | NO | NO |
| Message families | SAME SCHOOL | NO | **ASSIGNED CLASSES** | *(school only)* | NO | NO | NO |
| Manage site content & media | *(view)* | NO | NO | NO | **SAME SCHOOL** | NO | NO |
| Manage school identity | SAME SCHOOL | NO | NO | NO | **NO** | SUPPORT MODE | SUPPORT MODE |
| Manage school policy | SAME SCHOOL, NOT SELF | NO | NO | NO | NO | NO | NO |
| Tenant lifecycle | NO | NO | NO | NO | NO | **YES** | YES |
| Enter support mode | NO | NO | NO | NO | NO | **YES** | YES |
| Typed support operation | NO | NO | NO | NO | NO | **SUPPORT MODE** | SUPPORT MODE |
| Read-only query | NO | NO | NO | NO | NO | SUPPORT MODE | SUPPORT MODE |
| Break-glass write | NO | NO | NO | NO | NO | **NO** | **OWNER ONLY** |
| Purge a tenant | NO | NO | NO | NO | NO | **NO** | **OWNER ONLY** |

---

## 19. Hard denial rules

The architecture must make each of these impossible — not merely un-navigable.

1. School staff reaching **any** resource in another tenant.
2. **Finance authority appearing because someone is an administrator.** It comes from a policy grant
   or not at all.
3. A teacher reaching a class they are not actively staffed to — in **any** feature, not just
   distribution.
4. An **expired or revoked** staffing retaining any current access.
5. A parent reaching a child they have no active guardian relationship with.
6. A parent reaching a school's data because one of their children attends it.
7. A family setting any settlement status.
8. **A teacher handing over, or confirming hand-over, to their own child** — regardless of staffing,
   school policy or override attempt.
9. A platform administrator reading school operational or child data **outside an active support
   engagement**.
9a. A platform administrator performing **any account-level operation on a school's staff outside an
   active support engagement** — including MFA reset, unlocking and account recovery. **Labelling an
   operation "recovery" does not move it outside the tenant boundary** [PA-2].
10. A platform administrator performing an **owner-only** operation — break-glass or purge.
11. **Platform authority being granted or removed through any school-facing or platform dashboard
    workflow.** It is an out-of-band act.
12. A **student** authenticating as a product user.
13. The **CMS role acquiring any operational authority** because it administers the school's website.
14. **Test-superuser behaviour reaching production**, or redefining any rule in this document.
15. An **integration credential** exercising ordinary user authority, or confirming settlement.
16. Anyone granting **themselves** authority, or changing their own role.
17. A **closed academic period** being edited rather than corrected.
18. **Hard deletion standing in for disabling** a staff account.

---

## 20. Audit-required capabilities

**67 of 95 capabilities require audit.** *(Corrected by **A7-001** — the PROPOSED figure was 58; the per-capability register below marks 67, and the register is authoritative. No capability, flag, authority, scope or condition changed.)* Every capability touching:

money · funding, waivers and subsidies · replacement charge decisions · child records · guardian
records · staff authority and role grants · class staffing · school policy · fulfilment route ·
custody and hand-over · corrections · tenant lifecycle · support mode · destructive operations ·
scheduled and integration actions.

**Two audit requirements Stage 7 fixes conceptually** (Stage 19 designs the record):

1. **A discretionary action carries a reason.** Waivers, subsidies, charge decisions, corrections,
   break-glass and purge are choices, not consequences — "who" and "what" are not enough.
2. **A privileged action carries both its context and the authority it exercised — as two separate
   facts.** [LOCKED PA-1] Because an administrator may hold AUTH-FINANCE without switching context,
   "which hat they were wearing" and "which authority they used" no longer answer each other. The
   record must be able to state:

   ```
   actor:              Person A
   active context:     school_admin
   authority exercised: AUTH-FINANCE
   capability:         CAP-049 confirm settlement
   ```

   Plus the support engagement, where one applies. Without this, "the administrator confirmed a
   payment" cannot be checked against whether they held finance authority at that moment.
   **Stage 19 owns the physical event design — fields, tables and formats are not decided here.**

**And one hard prohibition (BR-124, C-18):** an audit or log record must never contain a live
credential, a reset or invitation link, or a family's contact details alongside a payment reference.

---

## 21. Comparison with the current implementation

| Area | Classification | Detail |
|---|---|---|
| Tenant isolation choke point | **ALREADY CORRECT** | One place, boolean return, storage-level asserts. The model's SC-1 is exactly this. **Preserve.** |
| Parent scoping by relationship | **ALREADY CORRECT** | `parent` excluded from tenant-scoped roles by design. SC-4 formalises it. |
| Context switching | **ALREADY CORRECT** in behaviour | Validated server-side, audited, authorises against the active context. The **mechanism** (`SECONDARY_ROLE:*` strings in a shared table) is **DUPLICATED/LEGACY** — see C-23. |
| `it_personnel` boundary | **ALREADY CORRECT** | A real server-side wall. AUTH-CMS keeps it. |
| Teacher class lookup | **PARTIAL** | One canonical lookup exists; the **scope it feeds is applied inconsistently** (**C-6**). |
| `FINANCE_ROLES` | **TOO BROAD / CONFLICTING** | Hard-codes every admin role as finance. Directly contradicts CD-4 (**C-13**). |
| `TENANT_SCOPED_ROLES` | **ALREADY CORRECT** | Correct exclusions for platform and parent. |
| Teacher assignment time bounds | **MISSING** | No start/end anywhere (**C-14**). CD-2 cannot be evaluated. |
| Parent access lapse | **MISSING** | No concept of "no active children" (**C-15**). |
| `owner` vs `platform_admin` | **CONFLICTING** | Identical in every check (**C-16**). §12 separates them. |
| Finance data visibility | **MISSING** | No policy surface at all (**C-17**). |
| Replacement charge authority | **MISSING** | Approval is operational only; no finance decision (**C-39**). |
| Guardian-conflict block | **MISSING** | No check on any path (**C-38**). |
| Fulfilment route authority | **MISSING** | No route concept (**C-36**). |
| Hard delete vs disable | **CONFLICTING** | Both reachable from the same admin surface (**C-12**). |
| `student` role | **LEGACY** | Present in the enum, unreachable. No capabilities here. |
| Support mode | **ALREADY CORRECT** in principle | Explicit, scoped, audited. The **engagement record itself** is missing (DM-006). |
| Test superuser | **ALREADY CORRECT** | Server-side flag, production-disabled, cannot simulate `owner`/`platform_admin`/`student`. |
| `requireRole(...)` as the authorisation primitive | **TOO NARROW** | Checks a **role**, so authority cannot be granted independently of a job title. This is the structural reason C-13 exists. → **C-40** |

---

## 22. Conflicts

### Resolved conceptually by Stage 7 — 6

| # | Resolution |
|---|---|
| **C-6** | SC-3 applied universally: active staffing ∩ active membership, for every teacher-facing capability. |
| **C-13** | Role/authority split. AUTH-FINANCE is a **policy grant** (CAP-032, CD-4), never implied by AUTH-SCHOOL. |
| **C-16** | AUTH-PLATFORM vs AUTH-BREAKGLASS. `owner` holds three capabilities `platform_admin` does not. |
| **C-17** | Three-band finance visibility: fixed minimum · policy-configurable middle · never-band. |
| **C-38** | CD-5 on CAP-063, with the administrator fallback. A condition, not a role. |
| **C-39** | Four capabilities across three parties: CAP-067 teacher · CAP-069 admin operational · CAP-070 **finance** charge · CAP-042 resulting requirement. |

### Carried forward — 6

| # | Carried to |
|---|---|
| **C-7** `student` residue | Stage 22 (controlled removal) |
| **C-12** hard delete vs disable | Stage 16 (who may erase, and how) |
| **C-14** no time-bounded staffing | Stage 15 (representation) |
| **C-15** parent access never lapses | Stage 15, Stage 16 (retention) |
| **C-23** `user_permissions` carrying three concerns | Stage 15 |
| **C-36** no fulfilment-route concept | Stage 15 |

### New — 2

| # | Conflict | Stage |
|---|---|---|
| **C-40** | **Authorisation is role-keyed, not authority-keyed.** `requireRole(...)` is the primitive throughout, so no capability can be granted independently of a job title. Every fix in §7, §9 and §12 requires an authority layer that does not exist. **This is the single structural change Stage 7 asks of the architecture.** | 12, 13 |
| **C-41** | **Integration credential scope is unverified.** The payment webhook authenticates by HMAC and fails closed, which is right — but whether the handler binds the message to a single tenant was **not confirmed** in this analysis. If it does not, a valid signature reaches any school. **Verify before Stage 16 signs off.** | 16 |

> **PA-1 and PA-2 being decided does not resolve either conflict.**
> **C-40** is if anything sharpened by PA-1: an administrator exercising AUTH-FINANCE from the
> `school_admin` context is exactly the case a role-keyed `requireRole(...)` cannot express, and the
> audit requirement in §20 needs an authority the current code has no concept of.
> **C-41** is untouched by both decisions.
> Both remain **unresolved in implementation** and carried forward as listed.

---

## 23. Owner decisions — all **DECIDED**

**PA-1 — DECIDED A.**
A school administrator holding AUTH-FINANCE **does not switch context**. The `school_admin` context may
carry both AUTH-SCHOOL and AUTH-FINANCE. Finance-sensitive audit events record **AUTH-FINANCE as the
authority exercised**, separately from the active context.
*Unchanged by this:* `school_admin` never carries AUTH-FINANCE by default — it is a policy grant
(CAP-032) or nothing. The C-13 resolution stands. The standalone `finance` context stands.
*Applied in* §2, §7, §9, §20.
*Decision resolved.* **Implementation consequences carry to Stage 9** (how the combined context
presents) **and Stage 19** (how the audit record represents context vs authority exercised).

**PA-2 — DECIDED A.**
Platform administrators **may not perform tenant account-recovery operations outside Support Mode**.
Account-level intervention on a school's staff — MFA reset, unlocking, sending a recovery — requires an
active support engagement for the named school. **There is no recovery bypass**, and no bypass
capability is to be created.
*Unchanged by this:* owner-only break-glass rules, and the scope of Support Mode itself.
*Applied in* §13, §19.
*Decision resolved.* **Implementation consequences carry to Stage 13** (support architecture and
enforcement) **and Stage 16** (security review of the boundary).

**No open Stage 7 owner decisions remain.**

> **A decision being resolved is not the same as it being implemented.** Both PA-1 and PA-2 are settled
> as product rules. Neither is enforced by the current code, and neither is claimed to be.

---

## 24. What Stage 7 deliberately does not decide

No screens, navigation or role experiences (Stage 9) · no endpoints or HTTP shapes (Stage 14) · no
middleware, guards or enforcement mechanism (Stages 12–13) · no permission tables, joins or indexes
(Stage 15) · no authentication, MFA, session, token, rate-limit or encryption design (Stage 16) — where
a capability needs elevated authentication, this document says only *that it does* (CD-7) · no state
machines · no migration or selection between competing implementations (Stage 22).

---

# SUMMARY

1. **Capabilities: 95** (CAP-001 … CAP-095).
2. **Reusable scopes: 12** (SC-1 … SC-12), plus **12 conditions** (CD-1 … CD-12) and **7 authorities**.
3. **Fixed vs configurable:** **four** school-configurable settings — admin/finance overlap · finance's
   optional child-data band · permitted presentation customisation · one reserved future policy.
   **Nine** rules are explicitly fixed and must never become configurable (§15).
4. **Conflicts resolved conceptually:** C-6, C-13, C-16, C-17, C-38, C-39.
5. **Carried forward:** C-7 → Stage 22 · C-12 → Stage 16 · C-14 → Stage 15 · C-15 → Stages 15/16 ·
   C-23 → Stage 15 · C-36 → Stage 15.
6. **New conflicts:** **C-40** authorisation is role-keyed rather than authority-keyed (Stages 12, 13) ·
   **C-41** integration credential tenant scope unverified (Stage 16).
7. **Owner decisions: none open.** **PA-1 DECIDED (A)** — no context switch; authority exercised is
   recorded separately from active context. **PA-2 DECIDED (A)** — no account-recovery exception to the
   support boundary.
8. **Stage ownership of everything unresolved:**
   - **Stage 9** — role experience, including how a combined `school_admin` + AUTH-FINANCE context presents *(PA-1 consequence)*
   - **Stages 12–13** — the authority layer and its enforcement *(C-40)*; support architecture *(PA-2 consequence)*
   - **Stage 14** — API shape
   - **Stage 15** — representation of staffing bounds, relationships, policy, routes *(C-14, C-15, C-23, C-36)*
   - **Stage 16** — erasure and retention *(C-12, C-15)*, elevated authentication, integration credential scope *(C-41)*, and the security review of the support boundary *(PA-2 consequence)*
   - **Stage 19** — audit record design, including context vs authority exercised *(PA-1 consequence)*
   - **Stage 22** — legacy removal *(C-7)*
9. **Status: LOCKED — 24 August 2026.**
10. **STOPPING BEFORE STAGE 8.**

---

## Amendment register — Stage 7

**Verified before assigning: Stage 7 had no amendment register and no prior amendment. A7-001 is the
first.** Stage 7 remains **LOCKED — 24 August 2026**. This register is **append-only**; the locked body
text above is not rewritten.

---

### A7-001 · Audit-required capability count — the headline is corrected to 67

**Class: FACTUAL RECONCILIATION / COUNT CORRECTION ONLY.**

**Raised 1 September 2026, on the owner's instruction, resolving C-103.**

```
THE HEADLINE SAID       "58 of 95 capabilities require audit."      §20
THE REGISTER MARKS      67
STAGE 19 ENUMERATED     67, mechanically, and built its taxonomy on it

THE DETAILED REGISTER IS AUTHORITATIVE.  THE HEADLINE WAS WRONG.
```

**The count, verified mechanically at correction:**

```
95 capability definition lines            CAP-001 ... CAP-095, contiguous

66  carry **AUDIT** on the definition line itself
 1  carries **AUDIT** on its immediate continuation line
        CAP-040 open_cycle -- its definition line ends with the
        parenthetical "(usually system-initiated at enrolment)", which
        pushed the marker onto the next line

67  AUDIT-REQUIRED CAPABILITIES
28  NOT audit-required

   -- 66 + 1 = 67 is exactly why a line-based count returned a different
      number from a register-based one, and why the register wins
```

**What this amendment changes:**

| | |
|---|---|
| **§20's headline** | **"58 of 95 capabilities require audit"** → **"67 of 95 capabilities require audit"** |

**What this amendment does NOT change:**

| | |
|---|---|
| **Capabilities** | **none added, none removed.** CAP-001 … CAP-095 is unchanged |
| **AUDIT flags** | **none changed.** Not one capability's marker is added, removed or moved |
| **Authority** | unchanged — AUTH-\* assignments stand |
| **Scope** | unchanged — SC-\* assignments stand |
| **Conditions** | unchanged — CD-\* assignments stand |
| **Stage 19's taxonomy** | **unchanged.** AET-001 … AET-102 were built against the register's 67 and were already correct |
| **PA-1 · PA-2** | unchanged |
| **Owner questions** | 0 |

**C-103 state after this amendment: TARGET SPECIFICATION RESOLVED.**

```
C-103 WAS A DISAGREEMENT BETWEEN A HEADLINE AND ITS OWN REGISTER.
   The register was right.  The headline is corrected to match it.

NO IMPLEMENTATION WORK IS REQUIRED TO CHANGE A COUNT.
   -- Stage 19's audit coverage was already built against 67
   -- Stage 20's taxonomy-coverage check already enumerates the register
   -- there is NO batch whose job is to edit this number, and inventing
      one would be a fake implementation task
```
