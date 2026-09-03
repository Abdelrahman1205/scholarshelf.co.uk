# EduBook Dashboard Workflow Audit

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

**Phase 2 — School Admin Setup & Operations Control Centre**
**Last updated:** 2026-05-25

---

## Overview

The School Admin Dashboard has been rebuilt as a full operational control centre. It guides the school through EduBook setup and provides real-time operational visibility.

Data is sourced from two dedicated backend endpoints:
- `GET /api/admin/dashboard-summary` — aggregated stats, tenant-isolated by `session.schoolId`
- `GET /api/admin/recent-activity` — last 20 audit log entries

When database connectivity is unavailable, dashboard summary and activity endpoints return safe fallback data so the control centre remains operational.

Both endpoints require `requireRole("admin", "school_admin")` and never trust `schoolId` from the frontend.

---

## Dashboard Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | Welcome Header | Greeting with admin first name + system status badge |
| 2 | Setup Progress Checklist | 9-step checklist with progress bar, links to incomplete steps |
| 3 | Key Statistics (11 cards) | Real-time stat cards, all clickable to relevant section |
| 4 | Quick Action Cards (8 cards) | Direct navigation buttons for daily operations |
| 5 | Attention Required Panel | Contextual warnings for issues requiring action |
| 6 | Recent Activity Feed | Last 8 audit log entries with timestamps |
| 7 | Workflow Navigation | Quick-access links to all sections |

---

## Button / Metric Audit Table

| Section | Button / Metric | Expected Result | Status | Fix Applied | Remaining Issue |
|---------|----------------|-----------------|--------|-------------|-----------------|
| **Setup Checklist** | School profile completed | Shows ✓ when admin account exists | ✅ Working | Always true when logged in (no school profile table yet) | No dedicated school profile model |
| **Setup Checklist** | Classes created | ✓ when `classes.length > 0` | ✅ Working | Queries `/api/admin/dashboard-summary` via storage | None |
| **Setup Checklist** | Books added | ✓ when `books.length > 0` | ✅ Working | Queries storage school-scoped | None |
| **Setup Checklist** | Book bundles created | ✓ when `bookLevels.length > 0` | ✅ Working | Queries storage school-scoped | None |
| **Setup Checklist** | Bundles assigned to classes | ✓ when `classBookLevels.length > 0` | ✅ Working | Queries storage school-scoped | None |
| **Setup Checklist** | Students added | ✓ when `students.length > 0` | ✅ Working | Queries storage school-scoped | None |
| **Setup Checklist** | Parent codes generated | ✓ when `linkingCodes.length > 0` | ✅ Working | Queries storage school-scoped | None |
| **Setup Checklist** | Parents linked | ✓ when any code `isUsed = true` | ✅ Working | Approximated via used linking codes | No direct school-scoped parent count |
| **Setup Checklist** | Payment setup reviewed | ✓ when any payment exists | ✅ Working | Based on payment existence | No explicit "reviewed" flag in schema |
| **Stats** | Total Books | Count of books in school catalogue | ✅ Working | School-scoped via `getBooks(sid)` | None |
| **Stats** | Low Stock Books | Books where stock < threshold | ✅ Working | School-scoped via `getLowStockBooks(sid)` logic | None |
| **Stats** | Total Students | Count of students | ✅ Working | School-scoped via `getStudents(sid)` | None |
| **Stats** | Parents Linked | Used linking codes count | ✅ Working | Approximated from `isUsed=true` codes | No direct parent-child school-scoped count |
| **Stats** | Parent Codes Not Sent | `isUsed=false` codes count | ✅ Working | School-scoped via `getLinkingCodes(sid)` | None |
| **Stats** | Pending Payments | Payments with `status=pending` | ✅ Working | School-scoped via `getPayments(undefined, sid)` | None |
| **Stats** | Payments Submitted | Total payments (all statuses) | ✅ Working | School-scoped | None |
| **Stats** | Payments Verified | Payments with `status=completed` | ✅ Working | School-scoped | None |
| **Stats** | Ready for Distribution | Allocations with `status=allocated` | ✅ Working | School-scoped via `getAllocations(undefined, sid)` | None |
| **Stats** | Teacher Confirmations | Allocations awaiting teacher receipt | ✅ Working | Same as allocated count | Cannot distinguish teacher-unconfirmed vs other |
| **Stats** | Extra Copy Requests | Requests with `status=pending` | ✅ Working | School-scoped via `getExtraCopyRequests({schoolId})` | None |
| **Actions** | Add Book → `/admin/books` | Navigates to Books section | ✅ Working | Real route, section exists | None |
| **Actions** | Create Book Bundle → `/admin/levels` | Navigates to Book Levels section | ✅ Working | Real route, section exists | None |
| **Actions** | Add Student → `/admin/students` | Navigates to Students section | ✅ Working | Real route, section exists | None |
| **Actions** | Generate Parent Codes → `/admin/codes` | Navigates to Linking Codes section | ✅ Working | Real route, section exists | None |
| **Actions** | Review Payments → `/admin/payments` | Navigates to Payments section | ✅ Working | Real route, section exists | None |
| **Actions** | View Teacher Requests → `/admin/requests` | Navigates to Extra Requests section | ✅ Working | Real route, section exists | None |
| **Actions** | Manage Allocations → `/admin/allocations` | Navigates to Allocations section | ✅ Working | Real route, section exists | None |
| **Actions** | View Reports | Disabled with "Coming soon" label | ✅ Correct | No dead button — disabled with clear reason | Reports section not yet built (Phase 3+) |
| **Warnings** | Low stock warning | Links to `/admin/books` | ✅ Working | Conditional render, only shown when relevant | None |
| **Warnings** | Pending payments warning | Links to `/admin/payments` | ✅ Working | Conditional render | None |
| **Warnings** | Extra copy requests pending | Links to `/admin/requests` | ✅ Working | Conditional render | None |
| **Warnings** | Parent codes not used | Links to `/admin/codes` | ✅ Working | Conditional render | None |
| **Warnings** | Teacher confirmation pending | Links to `/admin/allocations` | ✅ Working | Conditional render | None |
| **Activity** | Recent Activity Feed | Shows last 8 tenant-safe audit log entries | ✅ Working | Endpoint filters by users in `session.schoolId`; demo admin (`schoolId=null`) sees demo/global logs | No `schoolId` column on audit logs yet; user-based filter is applied |
| **Navigation** | All 9 workflow links | Navigate to corresponding section | ✅ Working | All route to real existing sections | None |

---

## Backend Endpoint Specifications

### GET /api/admin/dashboard-summary

**Auth:** `requireRole("admin", "school_admin")`
**Tenant:** Uses `sessionSchoolId(req)` — never trusts frontend schoolId

**Response:**
```json
{
  "totalBooks": 12,
  "lowStockBooks": 2,
  "totalStudents": 45,
  "parentsLinked": 32,
  "parentCodesNotSent": 8,
  "pendingPayments": 5,
  "paymentsSubmitted": 20,
  "paymentsVerified": 15,
  "readyForDistribution": 10,
  "teacherConfirmationsPending": 10,
  "extraCopyRequestsPending": 3,
  "totalClasses": 4,
  "totalBookLevels": 3,
  "totalLinkingCodes": 40,
  "setupChecklist": {
    "schoolProfileCompleted": true,
    "classesCreated": true,
    "booksAdded": true,
    "bookBundlesCreated": false,
    "bundlesAssignedToClasses": false,
    "studentsAdded": true,
    "parentCodesGenerated": true,
    "parentsLinked": true,
    "paymentSetupReviewed": false
  }
}
```

### GET /api/admin/recent-activity

**Auth:** `requireRole("admin", "school_admin")`
**Returns:** Last 20 audit log entries (array)

---

## Tenant Isolation Verification

| Check | Result |
|-------|--------|
| Dashboard summary uses `session.schoolId` | ✅ Yes — `sessionSchoolId(req)` |
| Frontend never passes schoolId to summary API | ✅ Correct — query key has no schoolId param |
| All storage calls in summary endpoint pass `sid` | ✅ Yes — all 9 parallel queries scoped |
| Demo admin (null schoolId) sees all data | ✅ Yes — `schoolFilter` returns `undefined` when schoolId is null |
| School admin with schoolId sees only their data | ✅ Yes — `schoolFilter` adds `WHERE school_id = ?` |

---

## Known Limitations (Phase 2)

| Limitation | Impact | Planned Fix |
|-----------|--------|-------------|
| School profile has no dedicated DB model | "School profile completed" always shows true | Phase 3: Add schools table with profile fields |
| Audit logs table has no schoolId column | Tenant filtering relies on user.schoolId mapping | Phase 3: Add `schoolId` to `audit_logs` for direct tenant filtering |
| "Parents linked" uses linking code proxy | May over/undercount in edge cases | Phase 3: School-scoped parentChildren query |
| "Teacher Confirmations" = "Ready for Distribution" | Same count, cannot distinguish | Phase 3: Add `teacherConfirmedAt` to allocations |
| Reports section not yet built | Action button is disabled with "Coming soon" | Phase 3+: Build reports/analytics section |

---

## Testing Checklist

- [x] TypeScript check passes (`tsc --noEmit`)
- [x] `GET /api/admin/dashboard-summary` returns 200 for admin/school_admin
- [x] `GET /api/admin/dashboard-summary` returns 403 for teacher/parent
- [x] `GET /api/admin/recent-activity` returns 200 for admin/school_admin
- [x] All 8 action buttons route to real pages or show disabled state
- [x] All 11 stat cards are clickable and route to correct section
- [x] All 9 setup checklist items link to the relevant section
- [x] Dashboard renders loading skeleton while fetching
- [x] Dashboard renders error state when API fails
- [x] Demo admin (null schoolId) sees demo data
- [x] No dead buttons (404s) anywhere on the dashboard
- [x] No cross-school data leakage in summary endpoint
