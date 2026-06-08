# ScholarShelf Workflow Coverage Matrix

**Audited:** 2026-06-08  
**Source of truth:** SCHOLARSHELF_MASTER_WORKFLOW_MAP.md  
**Codebase:** server/routes.ts, server/storage.ts, shared/schema.ts, client/src/pages/*

---

## Legend

| Status | Meaning |
|---|---|
| ✅ COMPLETE | Fully implemented backend + frontend |
| ⚠️ PARTIAL | Core works but some edge cases, sub-flows, or spec requirements missing |
| ❌ MISSING | Not implemented at all |
| 🔴 BROKEN | Route/feature exists but has a bug |
| 🛡️ SECURITY RISK | Implementation has a security gap |

---

## §4 — BHT Owner Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 4.1 | Owner Login | ✅ COMPLETE | `/api/auth/sign-in`, owner role guard, owner dashboard |
| 4.2 | Create New School | ✅ COMPLETE | `POST /api/owner/schools`, unique code validation, audit log |
| 4.3 | Initial School Setup by BHT | ✅ COMPLETE | Setup wizard, `/api/admin/setup-status` stored in DB |
| 4.4 | Invite First School Admin | ✅ COMPLETE | `/api/owner/schools/:schoolId/invite-admin`, email sent via Resend |
| 4.5 | Owner Support Mode | ✅ COMPLETE | `/api/owner/enter-support/:schoolId`, exit endpoint, audit log, banner UI |

---

## §5 — School Admin Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 5.1 | Admin Accept Invite | ✅ COMPLETE | `/api/auth/accept-invite`, token validation, expiry/used checks |
| 5.2 | School Setup Continuation | ✅ COMPLETE | Multi-step wizard, backend-stored `setupStatus`, wizard hides after completion |
| 5.3 | Create Year Groups | ⚠️ PARTIAL | No `year_groups` table. Classes have an `academicYear` text field as a workaround. No dedicated year group management UI or routes. |
| 5.4 | Create Classes | ✅ COMPLETE | `ClassesSection`, `/api/classes` CRUD, teacher assignment |
| 5.5 | Add Student Manually | ✅ COMPLETE | `StudentsSection`, `/api/students` POST with school-scoped validation |
| 5.6 | Bulk Import Students | ❌ MISSING | No CSV import route, no preview/confirm flow, no template download |
| 5.7 | Create Family Group | ❌ MISSING | No `family_groups` table, no routes (`/api/admin/family-groups`), no UI |
| 5.8 | Generate Student Link Code | ✅ COMPLETE | `LinkingCodesSection`, `/api/students/:id/linking-code`, QR + barcode |
| 5.9 | Generate Family Link Code | ❌ MISSING | Requires family groups (§5.7) — not implemented |
| 5.10 | Manage Books | ✅ COMPLETE | `BooksSection`, full CRUD, stock tracking, barcode scan/print, ISBN lookup |
| 5.11 | Create Book Bundle | ✅ COMPLETE | `BookLevelsSection` (named "levels" internally), `/api/book-levels` + items |
| 5.12 | Assign Bundle to Class | ✅ COMPLETE | `/api/class-book-levels`, preview affected students, allocations created |
| 5.13 | Assign Bundle to Individual Student | ⚠️ PARTIAL | Allocations can be created per student via admin allocations table, but no dedicated "assign bundle to student" UI flow |

---

## §6 — Parent Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 6.1 | Parent Registration | ✅ COMPLETE | `register.tsx`, `/api/auth/sign-up-parent` |
| 6.2 | Parent Login | ✅ COMPLETE | Children loaded on login, redirect to link page if no children |
| 6.3 | Unified Link Code Preview | ❌ MISSING | No `POST /api/parent/link-code/preview` endpoint. Current flow (`/api/parent/link-child`) immediately links with no preview step. |
| 6.4 | Confirm Single Student Link | ⚠️ PARTIAL | `/api/parent/link-child` works but combines preview + confirm in one step. Spec requires a two-step flow with preview before confirmation. |
| 6.5 | Confirm Family Link | ❌ MISSING | Requires family groups — not implemented |
| 6.6 | Parent Dashboard Multi-Child | ⚠️ PARTIAL | Multiple children can be linked and listed. No explicit child switcher tab/selector on dashboard overview. Books/basket shown per child. |
| 6.7 | View Required Books | ✅ COMPLETE | Parent can see book allocations via baskets/payment flow |
| 6.8 | Generate Basket for One Child | ✅ COMPLETE | `POST /api/parent/children/:id/basket` with ownership check (S1 fix) |
| 6.9 | Generate Family Basket | ❌ MISSING | No `POST /api/parent/baskets/family` — requires family groups |
| 6.10 | Parent Payment Instructions | ✅ COMPLETE | Payment reference shown, bank details in UI, email sent |
| 6.11 | Parent Payment Status | ✅ COMPLETE | All statuses shown with badges, parent can submit reference |

---

## §7 — Finance Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 7.1 | Finance Login | ✅ COMPLETE | `/api/auth/sign-in`, finance role, finance dashboard |
| 7.2 | View Pending Payments | ✅ COMPLETE | `/api/admin/payments`, payment table with status filter |
| 7.3 | Confirm Single-Student Payment | ✅ COMPLETE | `/api/admin/payments/:id/confirm`, allocation statuses updated, email sent |
| 7.4 | Confirm Family Payment | ⚠️ PARTIAL | Confirmation works on any basket (family basket not implemented), but per-student allocation breakdown on confirmation is not shown |
| 7.5 | Reject Payment | ✅ COMPLETE | `/api/admin/payments/:id/reject` with reason, email sent to parent |
| 7.6 | Finance Reporting | ⚠️ PARTIAL | `/api/admin/reports` exists, shows totals. No class/year-group breakdown filter, no export (CSV/PDF). |

---

## §8 — Book Allocation Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 8.1 | Allocation Creation | ✅ COMPLETE | Created on bundle-class assignment, student-level records |
| 8.2 | Allocation Status Lifecycle | ⚠️ PARTIAL | Core statuses work. `out_of_stock`, `partially_collected` not implemented. |
| 8.3 | Allocation Update | ⚠️ PARTIAL | `PATCH /api/allocations/:id` exists for distribution status. No admin UI to manually change allocation quantity/book. |
| 8.4 | Book Collection | ⚠️ PARTIAL | Teacher distribution workflow handles collection (`confirm-received`). No dedicated collection dashboard searchable by payment reference. |

---

## §9 — Teacher Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 9.1 | Teacher Login | ✅ COMPLETE | Login, teacher dashboard with assigned classes/students |
| 9.2 | Teacher Views Assigned Classes | ⚠️ PARTIAL | Teacher sees all school students (scoped by school). Classes not explicitly "assigned" via a teacher-class join table — uses `teacherId` FK on classes. Only one teacher per class. |
| 9.3 | Teacher Who Is Also Parent | ❌ MISSING | No dual-context role switcher. A teacher cannot use parent features without a separate parent account. |

---

## §10 — IT Admin / Branding Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 10.1 | Branding View | ✅ COMPLETE | Branding loaded on all dashboards, emails, and PDFs |
| 10.2 | Branding Manage | ✅ COMPLETE | `BrandingSection`, RBAC-controlled, `BRANDING_MANAGE` permission, audit log |
| 10.3 | Public School Website | ❌ MISSING | No `school_website_pages`, no website content management, no `/api/public/schools/:code/website`. Only public branding endpoint exists. |

---

## §11 — Email Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 11.1 | Admin Invite Email | ✅ COMPLETE | `sendSchoolSetupInviteEmail` / `sendInviteEmail` via Resend |
| 11.2 | Parent Link Code Email | ✅ COMPLETE | `sendParentCodeEmail` — sent when admin generates/sends code |
| 11.3 | Payment Instructions Email | ✅ COMPLETE | `sendPaymentSubmittedEmail` — sent on reference submission |
| 11.4 | Payment Confirmed Email | ✅ COMPLETE | `sendPaymentVerifiedEmail` — sent on finance confirm |
| 11.5 | Payment Rejected Email | ✅ COMPLETE | `sendPaymentRejectedEmail` — sent on finance reject |

---

## §12 — Reporting Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 12.1 | Admin Dashboard Reporting | ✅ COMPLETE | Students, books, payments, allocations, low stock, outstanding |
| 12.2 | Owner Platform Reporting | ⚠️ PARTIAL | School list, setup status, pending setups. No support activity tracking, no platform usage (logins, etc.). |

---

## §13 — School Lifecycle Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 13.1 | School Status Lifecycle | ✅ COMPLETE | All 6 statuses: active, suspended, archived, pending_deletion, deleted |
| 13.2 | Suspend School | ✅ COMPLETE | `/api/owner/schools/:id/suspend`, typed confirmation, session destruction |
| 13.3 | Restore School | ✅ COMPLETE | `/api/owner/schools/:id/restore` |
| 13.4 | Archive School | ✅ COMPLETE | `/api/owner/schools/:id/archive`, data preserved |
| 13.5 | Request School Deletion | ✅ COMPLETE | `/api/owner/schools/:id/request-deletion`, requires archived state |

---

## §16 — Critical Edge Cases

| # | Edge Case | Status | Notes |
|---|---|---|---|
| 16.1 | Parent Has Multiple Children | ⚠️ PARTIAL | Multiple individual children linkable. No family group / single family basket. |
| 16.2 | Teacher Is Also Parent | ❌ MISSING | No dual-context support — separate accounts required |
| 16.3 | Parent with Children in Different Schools | ⚠️ PARTIAL | `parentChildren` uses email (not school-scoped) so technically works. No school grouping in parent UI. |
| 16.4 | Two Parents for Same Student | ⚠️ PARTIAL | Multiple parents can link to same student. No explicit guardian relationship type or multi-guardian management UI. |
| 16.5 | Incorrect Family Group | ❌ MISSING | Family groups not implemented |
| 16.6 | Link Code Leaked / Rotate | ⚠️ PARTIAL | No rotate endpoint. Admin can delete code and generate a new one manually, but no one-click rotation with audit log. |
| 16.7 | Payment Basket Price Snapshot | ✅ COMPLETE | `unitPrice` and `totalPrice` stored at basket item creation — changes after don't corrupt totals |
| 16.8 | School Code Shows as UUID | ✅ COMPLETE | `formatSchoolDisplay()` checks UUID regex and never shows raw UUID to users |

---

## Route Map Gap Analysis (§14)

| Spec Route | Implemented? | Actual Route |
|---|---|---|
| `POST /api/auth/login` | ✅ | `/api/auth/sign-in` |
| `POST /api/auth/logout` | ✅ | `/api/auth/sign-out` |
| `GET /api/auth/me` | ✅ | `/api/auth/me` |
| `POST /api/auth/accept-invite` | ✅ | `/api/auth/accept-invite` |
| `POST /api/owner/schools` | ✅ | `/api/owner/schools` |
| `POST /api/owner/schools/:id/invite-admin` | ✅ | `/api/owner/schools/:schoolId/invite-admin` |
| `POST /api/owner/schools/:id/support-mode/start` | ✅ | `/api/owner/enter-support/:schoolId` |
| `POST /api/owner/support-mode/end` | ✅ | `/api/owner/exit-support` |
| `GET /api/admin/setup-status` | ✅ | `/api/admin/setup-status` |
| `GET /api/admin/year-groups` | ❌ MISSING | — |
| `POST /api/admin/year-groups` | ❌ MISSING | — |
| `GET /api/admin/classes` | ✅ | `/api/classes` |
| `GET /api/admin/students` | ✅ | `/api/students` |
| `POST /api/admin/students/import/preview` | ❌ MISSING | — |
| `POST /api/admin/students/import/confirm` | ❌ MISSING | — |
| `POST /api/admin/students/:id/generate-link-code` | ✅ | `/api/students/:id/linking-code` |
| `GET /api/admin/family-groups` | ❌ MISSING | — |
| `POST /api/admin/family-groups` | ❌ MISSING | — |
| `POST /api/admin/family-groups/:id/generate-link-code` | ❌ MISSING | — |
| `POST /api/parent/link-code/preview` | ❌ MISSING | — |
| `POST /api/parent/link-code/confirm` | ❌ MISSING | `/api/parent/link-child` (no preview step) |
| `GET /api/parent/children/:studentId/books` | ❌ MISSING | — |
| `POST /api/parent/baskets/family` | ❌ MISSING | — |
| `GET /api/admin/books` | ✅ | `/api/books` |
| `GET /api/admin/book-bundles` | ✅ | `/api/book-levels` (named differently) |
| `POST /api/admin/book-bundles/:id/assign-class` | ✅ | `/api/class-book-levels` POST |
| `POST /api/admin/book-bundles/:id/assign-student` | ❌ MISSING | — |
| `GET /api/finance/payments` | ✅ | `/api/admin/payments` (finance role allowed) |
| `POST /api/finance/payments/:id/confirm` | ✅ | `/api/admin/payments/:id/confirm` |
| `POST /api/finance/payments/:id/reject` | ✅ | `/api/admin/payments/:id/reject` |
| `GET /api/finance/reports` | ✅ | `/api/admin/reports` (finance role allowed) |
| `GET /api/branding` | ✅ | `/api/school/branding` |
| `POST /api/branding/logo` | ✅ | `/api/school/branding/logo` |
| `GET /api/public/schools/:schoolCode/website` | ❌ MISSING | — |

---

## Summary by Priority

### 🔴 Priority 1 gaps (must fix)

| Gap | Impact |
|---|---|
| Student hard-delete (§3.4) | Finance/allocation records become orphaned — data integrity risk |
| Link code has no preview step (§6.3-6.4) | Parent cannot verify the correct child before linking |

### 🟡 Priority 2 gaps (needed for real school use)

| Gap | Impact |
|---|---|
| Link code rotation (§16.6) | Cannot invalidate leaked codes |
| `GET /api/parent/children/:studentId/books` | Parent has no direct way to view a child's book list without generating a basket |
| Student bulk import CSV (§5.6) | Schools must add students one by one — unusable at scale |
| Individual student bundle assignment UI (§5.13) | Cannot override default class bundle for one student |
| Finance report export / class filtering (§7.6) | Cannot produce per-class payment reports |
| Year groups (§5.3) | No structured academic year groupings |

### 🟢 Priority 3 gaps (platform maturity)

| Gap | Impact |
|---|---|
| Family groups + family link codes (§5.7, §5.9) | Full multi-sibling management not possible |
| Family basket payment (§6.9, §7.4) | One payment for multiple children not supported |
| Teacher-is-also-parent dual context (§9.3) | Edge case requiring separate accounts |
| Public school website (§10.3) | No public-facing school page |
| Owner platform usage metrics (§12.2) | Support activity and login tracking not shown |

---

## What Is Working Well

- Full auth lifecycle: sign-in, sign-up, invite accept, forgot/reset password
- Complete school lifecycle management (suspend, archive, delete with all guards)
- Owner support mode (explicit, audit-logged, scoped)
- All 4 security fixes (S1-S4) confirmed live in production
- Payment workflow end-to-end: basket → reference → finance review → confirm/reject → email notifications
- Teacher book distribution workflow: allocations → distribution → confirm received/absent
- Branding system: logo, colours, theme, email headers, PDF logos
- Parent-teacher messaging with thread management
- Barcode/QR code generation for books
- Inventory tracking with low-stock alerts
- Multi-tenant school isolation (tenant session enforced server-side)
- All email notifications functional (Resend provider)
