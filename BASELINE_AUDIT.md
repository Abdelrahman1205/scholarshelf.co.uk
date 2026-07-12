# ScholarShelf — Final-Stage Baseline Audit

*Required deliverable per §4 of the completion spec, produced **before** any code changes. It is grounded in direct inspection of the schema, routes, client, and navigation — not filenames or assumptions.*

> **Environment note.** `tsc`, the production build, and the test suites cannot be run inside the assistant's sandbox (its file mount truncates large files — an infra quirk). Those three must be run on the developer machine. §4.1–4.3 are therefore marked **RUN LOCALLY**; last known state from prior local runs: **`tsc` clean, `npm run build` succeeds, family + security suites present and runnable via `npm test`.**

---

## A. Build / test status (§4.1–4.3)

| Check | Command | Status |
|---|---|---|
| Type check | `npx tsc --noEmit` | RUN LOCALLY — last local run: **clean** |
| Production build | `npm run build` | RUN LOCALLY — last local run: **succeeds** (chunk-size + import.meta warnings only) |
| Tests | `npm test` (`test:security`, `test:family`) | RUN LOCALLY — suites exist (18 family + 6 security cases); require dev server running |

---

## B. Route modules (§4.4) — 20 modules, ~209 endpoints

`allocation(16) auth(13) book(26) cron(2) dashboard(5) db-console(6) family(8, LEGACY) family-enrollment(12, CURRENT) index(1) message(11) mfa(6) notification(6) owner(21) parent(9) payment(8) public(2) setup(22) student(9) user(17) website(9)`

## C. Frontend routes (§4.5)

`/login /register /accept-invite /accept-invite/:token /forgot-password /reset-password / /school/:code /admin/:section? /teacher/:section? /parent/:section? /finance/:section? /security`

Role shells resolve a `:section` to a component; the admin shell has 24 sections.

## D. Navigation (§4.6) — current admin nav

Grouped: **Overview** (Dashboard, Setup) · **School Data** (Families, New Enrollment, Students, Classes) · **Books & Stock** (Books, Bundles) · **Orders** (Payments, Allocations, Extra Requests) · **Communication** (Communications, Parent Invites) · **Insights** (Reports) · **Admin** (Users, Branding). Owner and IT have their own configs. *The standalone "Parents" nav item was already folded into Families.*

## E. Database tables by domain (§4.7) — 32 total

- **Family/identity:** `families`, `guardians`, `family_students`, `students`, `child_linking_codes`, `parent_children`, `users`, `invites`
- **Books/stock:** `books`, `book_levels`, `book_level_items`, `class_book_levels`, `student_book_levels`, `book_inventory_transactions`, `classes`
- **Orders/payment:** `child_book_baskets`, `basket_items`, `book_payments`, `basket_payments`, `finance_book_allocations`, `extra_copy_requests`
- **Platform/CMS/misc:** `schools`, `audit_logs`, `rate_limits`, `notification_preferences`, `school_website_sections`, `media_assets`, `message_threads`

## F. Status values (§4.8) — verified from schema defaults

| Entity | Column | Values |
|---|---|---|
| School | `status` / `setupStatus` | active … / `pending_admin_invite` → … |
| User | `status` | `active` (role is single `text`; **no `secondaryRoles` column** — see §K) |
| Invite | `status` | `pending` → accepted/expired/revoked |
| Family | `status` | `draft` → `ready` → `enrolled` |
| Guardian | `portalAccessStatus` | `none` → `invited` → `active` |
| Student | `status` | `active` / `inactive` / `alumni` |
| Basket/order | `orderStatus` | `awaiting_payment_reference` → … |
| Payment | `status` | `awaiting_reference` → `reference_submitted` → `confirmed`/`rejected`/`needs_review` → `ready_for_collection` → `collected` / `cancelled` |
| Allocation | `status` / `distributionStatus` | `allocated` / `pending_distribution` → received/absent |
| Extra request | `status` | `pending` → approved/rejected |
| Message thread | `status` | `open` → closed/archived |

**Gap vs spec §14 (custody):** there is no single explicit **book-custody** status chain (`AVAILABLE → RESERVED → PREPARED → HANDED_TO_TEACHER → ISSUED → COLLECTED` + exceptions). Custody is currently *inferred* across `payment.status`, `allocation.status`, and `allocation.distributionStatus`. This is the biggest modelling gap for §14.

## G. Family reader/writer trace (§4.9)

| Table | Writers/readers (server) |
|---|---|
| `families` | `family.routes` (legacy), `family-enrollment.routes` (current), `db-console`, `storage` |
| `guardians` | `family-enrollment.routes` only |
| `family_students` | `family-enrollment.routes`, `storage` |
| `parent_children` | `storage` only |
| `child_linking_codes` | `storage` (used by `family.routes` link-code, `parent.routes` redemption, `student.routes`) |

## H. Family-API consumer matrix (§4.10, §8) — **key finding**

| API | Server module | **Client consumers** | Source of truth | Safe-to-retire |
|---|---|---|---|---|
| `/api/admin/families/*` (legacy) | `family.routes.ts` | **NONE (0 references in `client/src`)** | join table only | **YES — orphaned by the frontend** |
| `/api/families/*` (current) | `family-enrollment.routes.ts` | `families.tsx`, `family-enrollment.tsx` | `students.family_id` (+ join, self-healing backfill) | current — keep |

**This is the linchpin:** the legacy family endpoints are already **unused by the UI**. Retirement risk is far lower than the spec assumed. Remaining check before deletion: confirm no **email link**, **dashboard card**, **CSV import path**, or **server-internal call** targets them (the link-code generator in `family.routes` is the one piece of behaviour to relocate — see slice plan).

## I. Page-retirement audit (§10)

| Page / route | File | Classification | Replacement / action |
|---|---|---|---|
| Families directory `/admin/families` | families.tsx | **KEEP + IMPROVE** | becomes the full **Family workspace** |
| New Enrollment `/admin/family-enroll` | family-enrollment.tsx | **KEEP + IMPROVE** | unified wizard (add staff-parent branch) |
| Students directory `/admin/students` | students.tsx | **KEEP** | fast lookup; "Add" already routes to enrollment |
| Student profile (in Students detail) | student-profile.tsx | **KEEP** | already read-only drill-in |
| Parents `/admin/parents` | parents.tsx | **MERGE → HIDE** | remove from nav (done); redirect `/admin/parents → /admin/families` |
| Parent Invites `/admin/codes` | linking-codes.tsx | **KEEP (monitor)** | still shows sent codes; guardian invite now the primary path |
| Legacy family API `/api/admin/families/*` | family.routes.ts | **REDIRECT/DEPRECATE → DELETE** | 0 client consumers; relocate link-code, then remove |
| Staff directory | *(does not exist yet)* | **BUILD** | §11 requires a Staff page (currently users.tsx is generic) |

*No standalone "Add Parent" or "Add Student" pages exist — creation already funnels through enrollment, so several of the spec's assumed legacy pages are already absent.*

## J. Custody & idempotency posture (§13, §14)

- **Idempotency:** payment lifecycle transitions and allocation confirm exist, but not all are provably idempotent under repeated clicks (spec §9/§10). Needs explicit guards + tests (payment double-confirm, double-collect, stock double-deduct).
- **Unknown `/api/*`:** confirm a catch-all returns a **structured** API error (spec §13) — needs verification/addition.

## K. Staff-parent identity gap (§5, §7) — **largest new work item**

- `users.role` is a **single `text` column**. The UI references `secondaryRoles`, but there is **no first-class multi-role model** on the user identity, and **no `staff_profile` / `guardian_profile` linkage** to a single user.
- Guardians link to portal users **only** via `child_linking_codes` redemption — there is no explicit `guardian.userId` relationship (spec §8 wants one).
- Consequence: a teacher who is also a parent can currently end up as **two accounts**. Delivering §5–§7 (one identity, roles attached, staff-invite-with-children, role switch, staff-departure-preserves-parent) is a genuine schema + flow build, not a tweak.

---

## L. Recommended vertical-slice order (§17, §23)

Smallest-safe-change first; each slice ends with the developer running `tsc` + build + the relevant tests locally before the next.

1. **Legacy family retirement (low risk, high clarity).** Relocate the `link-code` behaviour off `family.routes` into the current module; add `/admin/parents → /admin/families` redirect; add the structured catch-all for unknown `/api/*`; mark `/api/admin/families/*` deprecated (log + 410/redirect) — *0 client consumers makes this safe now.* Tests: legacy-route redirect + unknown-route error.
2. **Explicit guardian↔user relationship** (`guardians.userId` nullable FK + status surfaced) so portal identity isn't implied by code redemption. Backfill from existing links. Additive/reversible.
3. **Staff-parent unified identity**: first-class multi-role on the user (`user_roles` or `secondaryRoles`), `staff_profile`/`guardian_profile` linkage, staff-invite-with-children branch, role switcher, staff-departure guard. *Largest slice — do after 1–2.*
4. **Book-custody state machine** (§14): one custody status + a `custody_events` log, mapped onto the existing payment/allocation transitions without rewriting them.
5. **Idempotency + tests** for payments/allocations/stock (§9, §15): idempotency keys/guards + the full test matrices.
6. **Security/perf** (§16, §17): expand rate-limiting to all mutations, validate `DATABASE_SSL_CA`, route-level code splitting, object-storage plan.
7. **API standardisation + repository split + CI** (§18, §20): consistent envelope, `storage.ts` → per-domain repositories, GitHub Actions running tsc + build + all suites.

Each slice preserves existing data, keeps working journeys live, and is reversible.

---

*Baseline complete. No production code was changed to produce this report. Recommended next action: **Slice 1 (legacy family retirement)** — it is now provably low-risk and unblocks the rest.*
