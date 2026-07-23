# ScholarShelf — Master Workflow Map

**The end-to-end, role-by-role workflow reference for ScholarShelf.** This is the "source of truth" that `WORKFLOW_COVERAGE_MATRIX.md` refers to. Read `PROJECT_MASTER.md` first for architecture and data model; this document covers *how work flows through the system*. Owner: BytHub Technology Ltd. Production: https://www.scholarshelf.co.uk

_Last updated: 2026-07-23. Reflects the staff-invite wizard, staff-parent linking, enrolment auto-email, parent-dashboard redesign, and per-copy book tracking added this cycle._

---

## 1. How to read this document

Each workflow lists the **actor** (role that drives it), the **steps**, the **system reaction** (what ScholarShelf does automatically), and any **emails** sent. State machines for the key objects are collected in §14. A quick legend:

- **Actor roles:** Owner (BytHub), School Admin, Finance, IT, Teacher, Parent.
- **Automatic** = the system does it with no user action.
- **Email** = an automated message via Resend (full list in §13).

---

## 2. Roles & entry points

| Role | Lands on | Drives these workflows |
|---|---|---|
| Owner / Platform admin | `/admin/owner` | School lifecycle, first-admin invites, support mode, DB console |
| School Admin | `/admin` | Catalogue, copies, classes, students, families, enrolment, staff invites, allocations, reports, branding |
| Finance | `/finance` | Allocations, payment verification, financial reports |
| IT Personnel | `/admin/website` | Public website CMS + branding only |
| Teacher | `/teacher` | Class distribution, extra-copy requests, parent messages |
| Parent | `/parent` | Baskets, payments, collection, messages |
| Public visitor | `/school/:code` | Published website only |

---

## 3. The system lifecycle at a glance

```
Owner creates school
   └─> First-admin invite ──> Admin accepts ──> Setup wizard ──> GO LIVE
                                                     │
        ┌────────────────────────────────────────────┘
        ▼
  School Admin sets up operations:
     • Catalogue (books) ──> Book intake: register copies, print labels, scan-confirm
     • Bundles (book levels) ──> assign to classes
     • Classes + teachers
     • Students (manual / CSV import)
     • Families + guardians ──> parent onboarding (auto linking-code email)
     • Staff (multi-step invite wizard, dual-role + family linking)
        │
        ▼
  Distribution cycle (per class, per term/year):
     Admin assigns bundle to class
       └─> Finance creates allocation (pending)
             └─> Teacher confirms received / absent / out-of-stock
                   └─> Basket generated for the student
                         └─> Parent submits payment reference
                               └─> Finance confirms
                                     └─> Ready for collection
                                           └─> Collected  ✓
```

---

## 4. Workflow — Platform & school onboarding  (Owner)

1. Owner opens `/admin/schools` → **Create school** (name, code, contact).
2. Owner sends the **first-admin invite** to the school's admin email.
   - *System:* creates a `pending` invite (7-day expiry), school status `pending_admin_invite`.
   - *Email:* **School setup invite** to the admin.
3. Admin opens the invite link → sets name, username, password → **accept**.
   - *System:* creates the admin account, school status → `operational_setup_in_progress`, session started.
4. Admin runs the **6-step setup wizard** (`/admin/setup`): branding, payment app name, first classes/books, etc.
5. Setup progress / go-live checklist tracks completion → school status `complete` / `active`.

**Gotcha:** the invite email must be a *new* email — one account per email, one staff account per school. Reusing an email that already has an account (even on another school) is blocked.

---

## 5. Workflow — Staff onboarding  (School Admin) — multi-step wizard

Driven from `/admin/users` → **Invite Staff** (opens the wizard).

1. **Staff details** — first/last name, work email, employee ref, department, job title, start date, phone.
   - *System:* **smart existing-account detection** — if the email already has an account, a banner appears and the flow switches to *adding a role to that single login* (dual-role) instead of creating a duplicate.
2. **Role & access** — Teacher / Finance / IT / School Admin. Teacher also picks classes, subjects, year groups.
3. **Family connection** — "Does this staff member have children here?" No → staff-only. Yes → link a family.
4. **Find family** (if Yes) — search existing families, select one.
5. **Confirm relationship** — relationship + guardian permissions.
6. **Review** — summary + unified-account outcome.
7. **Send** → invite created.
   - *Email:* **Staff invitation** with a 7-day link.
   - *If dual-role (existing account):* the new role is added to the existing login, no new invite.

**Acceptance:** invitee opens the link → sets name/username/password → account created with the staff role. **If the invite carried a family link, on acceptance they also get the Parent role and are auto-linked to that family's children** with the chosen relationship (they can then toggle between Staff and Parent views).

---

## 6. Workflow — Catalogue & book intake  (School Admin)

**6a. Add a book (catalogue).** `/admin/books` → add title, optional ISBN, price, stock threshold. ISBN is now optional metadata; the ScholarShelf `bookCode` (title SKU) is the internal identifier.

**6b. Register physical copies (NEW — per-copy tracking).** `/admin/book-copies`:

1. Pick the title, enter **quantity** + **academic year** → **Generate copies**.
   - *System:* mints that many unique copy codes (`SSC-000123-7`, Luhn check digit), each `in_stock`.
2. **Print labels** → Code-128 barcode sheet → apply one label to each physical book.
3. **Confirm labels (scan)** → scan each label.
   - *System:* sets `verifiedAt`; unknown/duplicate codes are flagged immediately (catches mislabels).
4. Live stock = count of `in_stock` copies; status per copy is visible and editable (in_stock / allocated / sold / damaged / lost / returned).

> Teachers never scan. Scanning happens **only here, at registration.** Linking a copy to a specific student is deferred (see §15).

**6c. Bundles.** `/admin/levels` → create a bundle (book level), add books, assign to a class. Per-student overrides supported. Assigning a bundle emails the class teacher (**class book-list updated**).

---

## 7. Workflow — Classes & students  (School Admin)

1. **Classes** `/admin/classes` → create class, assign a teacher.
2. **Students** `/admin/students` → add manually, or **CSV/XLSX import** (preview → confirm). Archive/unarchive supported; history preserved.
3. A student profile shows class, book list, guardians, allocations, and distribution history.

---

## 8. Workflow — Family enrolment & parent onboarding  (School Admin → Parent)

**8a. Enrol a family.** `/admin/families` (or the enrolment flow) → household + guardians + students, atomic (all-or-nothing).
- *System:* on a **non-draft** enrolment with ≥1 student and a guardian with a valid email, a linking-code email is **sent automatically** to the primary guardian. Drafts send nothing.
- *Email:* **Parent linking code**.

**8b. Three onboarding routes:**
- **(A) Auto (enrolment):** as above — the linking-code email goes out on enrolment.
- **(B) Manual invite:** `Invite guardian` on a family/guardian → linking-code email.
- **(C) CSV import:** a `parent_email` column auto-generates invites/codes.

**8c. Parent links their children:**
1. Parent registers at `/register` (or signs in).
2. Enters the linking code at `/parent/link` → **preview** → **confirm**.
   - *System:* links the child (or all children for a family code) to the parent account.
   - *Email:* **Welcome parent** on account creation.

---

## 9. Workflow — Distribution cycle  (Admin → Finance → Teacher)

1. **Admin** assigns a bundle to a class (§6c).
2. **Finance** creates the allocation → status `pending`.
3. **Teacher** on distribution day (`/teacher/distribution`), per student, marks:
   - **received** → basket generated for that student → ordering can begin;
   - **absent** → revisit later;
   - **out_of_stock** → surfaced to admin (not silently swallowed).
   - A **teacher never distributes to their own child** (blocked).
   - "Partially collected" badge shown where relevant.
4. Teachers may submit **extra-copy requests** → admin approves/rejects.

---

## 10. Workflow — Ordering, payment & collection  (Parent → Finance)

1. **Parent** (`/parent`) sees each child's basket. New dashboard shows baskets, an order summary, and recent orders.
   - *Email:* **Payment instructions** when an order is created.
2. Parent pays via the school's payment app, then **submits the payment reference** (`/parent/payments`). Family basket: a parent with ≥2 children can **Pay for All Children** in one order.
   - *State:* `awaiting_reference` → `reference_submitted`.
   - *Email:* **Payment submitted** (confirmation to parent).
3. **Finance/Admin** reviews (`/admin/payments` or `/finance/payments`) → **confirm**, **reject**, or **needs-review**.
   - *Email:* **Payment verified** or **Payment could not be verified**.
   - Duplicate-reference and duplicate-basket guards prevent double payment.
4. Confirmed → **ready_for_collection**.
   - *Email:* **Books ready to collect**.
5. Handover → **collected**.
   - *Email:* **Collection receipt**.
6. Scheduled: **unpaid-order reminders** to parents; **admin daily digest** to staff.

---

## 11. Workflow — Messaging, reports, branding  (various)

- **Messaging:** parent ↔ staff threads (`/parent/messages`, `/admin/communications`), unread badges, admin oversight, close thread.
- **Reports:** `/admin/reports` — inventory, payments (with lifecycle counts), distribution, class breakdown, users, bundles; CSV export.
- **Branding:** `/admin/branding` — logo/banner/favicon/email-logo/pdf-logo + colours/font, live preview, reflected on public page and emails.

---

## 12. Workflow — Website CMS & owner/platform ops

- **IT (`/admin/website-content`):** edit typed sections (hero/about/announcement/contact/custom) → draft → publish → rendered on the public `/school/:code` page. URL-scheme allowlist blocks `javascript:` (stored-XSS defence). IT sees website + branding only.
- **Owner (`/admin/owner`):** platform metrics; school lifecycle (create / suspend / archive / restore / request-deletion / delete — cascades on `schoolId`); first-admin invites; **support mode** (operate inside one tenant, then exit); **DB console** (browse / SQL / danger actions, owner-only).

---

## 13. Emails triggered across workflows

| Email | Trigger | Recipient |
|---|---|---|
| School setup invite | Owner invites first admin | Admin |
| Staff invitation | Admin sends staff invite | Invitee |
| Parent linking code | Enrolment (auto) / Invite guardian / CSV | Guardian |
| Welcome parent | Parent account created | Parent |
| Payment instructions | Order created | Parent |
| Payment submitted | Parent submits reference | Parent |
| Payment verified | Finance confirms | Parent |
| Payment could not be verified | Finance rejects | Parent |
| Books ready to collect | Order ready for collection | Parent |
| Collection receipt | Order collected | Parent |
| Class book-list updated | Bundle assigned to a class | Teacher |
| Unpaid reminder | Scheduled | Parent |
| Admin daily digest | Scheduled | Staff |
| Password reset | Forgot-password request | The user |

All send via Resend and are non-blocking (a failure logs and never breaks the request).

---

## 14. State machines

**Payment / order:** `awaiting_reference → reference_submitted → (needs_review) → confirmed → ready_for_collection → collected`. Side paths: `rejected`, `cancelled`.

**Distribution (per student):** `pending → received | absent | out_of_stock`; `partially_collected` badge.

**Book copy (per physical book):** `in_stock → allocated → sold`; write-offs `damaged` / `lost`; `returned` (unused). `verifiedAt` set at intake scan-confirm.

**Invite:** `pending → accepted`; expires after 7 days; dual-role invites add a role to an existing account instead.

**School:** `pending_admin_invite → operational_setup_in_progress → active`; lifecycle: `suspended`, `archived`, `deletion_requested`, `deleted`.

---

## 15. Deferred / next

**Per-copy provenance at payment confirmation.** Not yet built. When a payment is confirmed, auto-assign that many `in_stock` copies of each ordered book (FIFO by `copyNumber`) → `status='sold'` + `studentId` + `paymentId` + `soldAt`, then show a "copies received" list on the student profile and order view. This closes the loop ("these exact copies went to this student") **without any teacher scanning** — the link is a side effect of the sale. Hook point: the payment-confirm handler in `payment.routes.ts`. See `PROJECT_MASTER.md` §18.

---

## 16. Cross-cutting rules

- **Multi-tenant isolation:** `schoolId` always comes from the session; cross-tenant reads return a safe 404.
- **RBAC invariants:** IT never touches operational/PII data; parents/students never write payment status; teachers never write student records or distribute to their own child; only the owner acts across tenants.
- **Audit:** privileged and state-changing actions are written to `audit_logs`.
- **Security:** bcrypt-12, session regeneration on login, httpOnly + secure + sameSite=strict cookies, hashed reset/invite tokens, distributed rate limiting, webhook HMAC. See `SECURITY_REVIEW.md`.
