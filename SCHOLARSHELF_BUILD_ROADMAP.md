# ScholarShelf — Build Roadmap (target workflow → what to develop)

Triage of the optimised master workflow spec against the current codebase. Status key: **✅ Have** · **🔧 Upgrade** (exists but the spec wants more) · **🆕 New** (net-new build).

_Created 2026-07-23. Companion to `SCHOLARSHELF_MASTER_WORKFLOW_MAP.md` (current state) and `PROJECT_MASTER.md`._

---

## Gap analysis

| Area | Status | Notes |
|---|---|---|
| Platform creates school + first-admin invite | ✅ Have | Owner flow + school-setup invite exist. **🔧** add subscription package + start date fields. |
| Admin accepts → setup wizard | ✅ Have | 6-step wizard exists. |
| Staff invite wizard + dual-role (staff-parent) | ✅ Have | Built this cycle. |
| **Multi-teacher, subject-based class assignment** | 🆕 New | **Biggest gap.** Today a class stores one `teacherId`. Spec needs `class_teacher_assignments` (class × subject × teacher × year, roles, active flag). **Hard blocker for MSS** (21 classes, per-class Arabic teacher, 5 Quran teachers shared across classes). |
| Staff record vs login account separation | 🔧 Upgrade | Wizard always invites. Add "save record only / save + invite / draft". |
| Conflict-of-interest controls | 🔧 Upgrade | Teacher-can't-distribute-own-child exists; extend to enrolment approval, payment verify, refund. |
| Students & families + duplicate detection | ✅ Have | Enrolment + name/DOB/email duplicate checks exist. |
| Parent onboarding (linking code, auto-email, CSV) | ✅ Have | Built + auto-email this cycle. |
| Catalogue (title SKU `bookCode`) | ✅ Have | Separate from copy code, as the spec wants. |
| **Stock intake batches** (supplier, cost, batch status) | 🔧 Upgrade | `book_copies` has `academicYear` but no batch entity. Add `stock_intake_batches` (supplier, ref, cost, batch status draft→verified→closed). |
| Per-copy tracking + labels + scan-confirm | ✅ Have | Built this cycle. |
| **Copy status lifecycle** | 🔧 Upgrade | Current: in_stock/allocated/sold/damaged/lost/returned + verified. Spec: add `reserved`, `ready_for_collection`, `collected`, `written_off`, `pending_verification`. **Correction: don't auto-mark `sold` at payment** — separate payment/stock/handover. |
| Bundles + assign to class/year/student | ✅ Have | `book_levels` + overrides. |
| **Auto-draft allocations** | 🔧 Upgrade | Today Finance creates allocations manually. Spec: admin assigns bundle → system auto-creates draft allocations; Finance only for pricing/exemptions. |
| **Distribution policy config** (pay-before / handover-before / no-payment) | 🆕 New | System currently assumes pay-then-collect. Schools differ (MSS may hand over first or charge nothing). Needs a school-level policy setting driving the flow. |
| Teacher distribution (received/absent/out-of-stock/partial) | ✅ Have | 🔧 add exempt / declined / requires-follow-up. |
| Copy selection: FIFO vs scan mode at handover | 🆕 New | Deferred provenance. FIFO auto-assign at collection, optional scan mode. |
| **Payment statuses** | 🔧 Upgrade | Have awaiting/submitted/under-review/confirmed/rejected/cancelled. Add `partially_paid`, `overpaid`, `refund_pending`, `partially_refunded`, `refunded`. |
| **Stock reservation after payment** + `paid_awaiting_stock` | 🆕 New | Reserve specific copies on confirm; never falsely mark ready when stock is short. |
| Collection sheet (offline roster) | ✅ Have | Built this cycle. |
| Collector verification at handover (signature/PIN/receipt) | 🆕 New | Record exact copies + collector + method. |
| Reconciliation worklist | ✅ Have | Built this cycle (payment-side). 🔧 add damaged/out-of-stock aggregation. |
| **Returns / replacements / refunds / corrections** | 🆕 New | Largely outside the app today. Needs return inspection, replacement linked to original allocation, partial refunds without deleting history, reversible actions kept in audit. |
| **Academic-year rollover wizard** | 🆕 New | Promote students, archive class memberships, carry catalogue/stock forward, never overwrite history. |
| Readiness checks → activate | 🔧 Upgrade | Setup wizard exists; add an explicit required-items gate + "Activate" + data-protection confirmation. |
| Notifications | ✅ Have | ~14 emails exist. 🔧 add partial-payment, awaiting-stock, refund, collection-reminder, outstanding-distribution, low-stock. |
| Reports | 🔧 Upgrade | Admin/finance reports exist; add the inventory report set (by title/year, verified/reserved/collected, damaged/lost/write-offs, intake batches, movement history). |
| Audit log | ✅ Have | `audit_logs`; 🔧 ensure before/after values + reason on sensitive actions. |
| MFA enforcement, least-priv DB role, tenant-isolation tests | 🆕 New | From `PROJECT_MASTER.md` §8 — launch hardening. |
| Legal: Privacy Policy, DPA, DPIA, ICO registration | 🆕 New | Children's data — the real launch gate. |

---

## Recommended build order

**Phase 1 — MSS blocker + foundations (do first)**
1. **`class_teacher_assignments`** — multi-teacher, subject-based class assignment, with teacher access scoped to active assignments. Without this MSS cannot run. Schema + assignment UI + access changes.
2. **Distribution policy config** (pay-before / handover-before / no-payment) at school level.
3. **Copy lifecycle correction** — add reserved/ready_for_collection/collected; stop auto-"sold" at payment; separate payment vs stock vs handover status.

**Phase 2 — money + stock integrity**
4. Payment statuses: partial / overpaid / refund set.
5. Stock reservation on payment + `paid_awaiting_stock`.
6. Returns / replacements / refunds / corrections (with audit-preserving reversals).
7. Auto-draft allocations (remove the manual Finance step).

**Phase 3 — inventory depth**
8. Stock intake batches (supplier/cost/status).
9. FIFO vs scan copy selection at handover (closes per-copy provenance).
10. Inventory report set + expanded notifications.

**Phase 4 — lifecycle + governance**
11. Academic-year rollover wizard.
12. Staff-record-vs-account separation + conflict-of-interest controls.
13. Collector verification at handover.
14. Readiness gate + activation.

**Parallel track — launch gate (not code)**
- Legal/compliance: Privacy Policy, DPA per school, DPIA, ICO registration.
- Security hardening: MFA enforcement, least-privilege DB role, orphan-guardian cleanup so `db:push` works, tenant-isolation tests.

---

## Note on the deferred item
The spec's "don't auto-sell at payment; go in_stock → reserved → allocated → ready_for_collection → collected" is the correct version of the previously-deferred per-copy provenance. Item 3 + 5 + 9 above implement it properly (reservation at payment, physical handover marks collected), keeping payment status separate from physical possession.
