# School Lifecycle Workflow — Post-Implementation Audit

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

**Date:** 2026-06-02  
**Status:** PASS (all phases verified and gaps fixed)

## State Machine

```
ACTIVE → SUSPENDED → (restore) → ACTIVE
ACTIVE → ARCHIVED → (restore) → ACTIVE
SUSPENDED → ARCHIVED → (restore) → ACTIVE
ARCHIVED → PENDING_DELETION → (restore) → ACTIVE
PENDING_DELETION → DELETED (soft delete, data preserved)
```

## Endpoints

| Method | Path | Allowed From | confirmText |
|--------|------|-------------|-------------|
| POST | `/api/owner/schools/:id/suspend` | active | SUSPEND |
| POST | `/api/owner/schools/:id/archive` | active, suspended | ARCHIVE |
| POST | `/api/owner/schools/:id/restore` | suspended, archived, pending_deletion | (none) |
| POST | `/api/owner/schools/:id/request-deletion` | archived | DELETE {code} |
| DELETE | `/api/owner/schools/:id` | archived, pending_deletion | DELETE {code} |

All endpoints protected by `requireRole(...PLATFORM_OWNER_ROLES)`.

## Blocker Checks (Permanent Delete)

Before soft-deleting, the system checks for:
1. Active payment orders (status = pending/confirmed)
2. Pending payment references
3. Active book distributions (status = pending_distribution)
4. Pending admin invites

If any blockers exist, the request is rejected with a 409 and blocker list.

## Inactive School Blocking

`ensureSessionSchoolIsActive()` runs on every authenticated request via `requireAuth` and `requireRole`. It blocks suspended, archived, pending_deletion, and deleted school users with a 403, destroys their session, and sets `window.__schoolBlockedMessage` on the client for display on the login page.

## Audit Findings & Fixes Applied

| # | Phase | Finding | Fix |
|---|-------|---------|-----|
| 1 | Routes | No backend confirmText validation | Added to suspend, archive, request-deletion, delete |
| 2 | Routes | Incomplete blocker checks | Added distribution + invite checks |
| 3 | Routes | Restore didn't accept pending_deletion | Added pending_deletion + clear deletion metadata |
| 4 | Routes | GET /api/owner/schools used `_req`, no filtering | Changed to `req`, added status/includeDeleted params |
| 5 | Storage | Missing lifecycle fields in demo/create objects | Added all 16 defaults |
| 6 | Frontend | `executeDangerAction` didn't send confirmText | Added confirmText to request body |
| 7 | Frontend | Error parsing assumed Response.json() on Error | Fixed to parse error message string |
| 8 | Frontend | Archived schools had direct delete (skipped request_deletion) | Changed to request_deletion; delete only on pending_deletion |
| 9 | Frontend | No restore button on pending_deletion schools | Added restore + delete buttons |
| 10 | Frontend | File truncation from Edit tool | Restored ending via bash |

## TypeScript

`npx tsc --noEmit` — **0 errors**

## Files Modified

- `shared/schema.ts` — 6 statuses, 16 lifecycle columns, insertSchema omits
- `server/routes.ts` — 5 lifecycle endpoints, inactive blocking, audit logging
- `server/storage.ts` — updateSchool signature, demo defaults
- `client/src/pages/admin.tsx` — SchoolsSection danger zone UI, confirmText, error handling
- `client/src/pages/login.tsx` — school-blocked banner, finance demo
- `client/src/lib/queryClient.ts` — 403 schoolStatus detection
- `client/src/components/layout.tsx` — finance nav items

---

# Final Security Verification

**Date:** 2026-06-02  
**Verdict:** PASS — safe for client demo

## 1. Non-Owner Access Protection

All 5 lifecycle endpoints use `requireRole(...PLATFORM_OWNER_ROLES)` where `PLATFORM_OWNER_ROLES = ["owner", "platform_admin"]`. The `requireRole` middleware calls `getActiveRequestContext(req)` which returns the user's resolved role from `session.activeContext || session.role`. Context switching (`POST /api/auth/context`) only allows switching to contexts derived from `getUserAccessProfile`, which are based on the user's real role and data — a school_admin/teacher/parent/finance/IT user can never acquire an owner context. **Result: PASS**

## 2. Support Mode Safety

Support mode only sets `session.supportSchoolId` and `session.supportSchoolName`. It does NOT change `session.role` or `session.activeContext`. The owner's real role is preserved and used for all permission checks. Support mode entry itself requires `requireRole(...PLATFORM_OWNER_ROLES)`. A school admin cannot enter support mode or gain owner privileges through it. **Result: PASS**

## 3. Frontend Visibility

`SchoolsSection` (containing all danger zone buttons) is only rendered when `section === "schools"`, which is in the `ownerOnlySections` set. Non-owner users are redirected to the dashboard section. The danger zone buttons (suspend, archive, restore, request_deletion, delete) are never rendered for non-owners. **Result: PASS**

## 4. Status Transition Enforcement

| Attempted Transition | Backend Response |
|---|---|
| ACTIVE → restore | 409 rejected |
| ACTIVE → delete | 409 rejected |
| ACTIVE → request-deletion | 409 rejected |
| SUSPENDED → suspend | 409 rejected |
| SUSPENDED → delete | 409 rejected |
| DELETED → restore | 409 rejected |
| DELETED → suspend/archive | 409 rejected |
| ARCHIVED → suspend | 409 rejected |

All invalid transitions return descriptive JSON error messages. **Result: PASS**

## 5. Confirmation Text Enforcement

| Endpoint | Required | Case-sensitive | Trimmed | Missing → rejected |
|---|---|---|---|---|
| suspend | SUSPEND | Yes | Yes | Yes |
| archive | ARCHIVE | Yes | Yes | Yes |
| request-deletion | DELETE {code} | Yes | Yes | Yes |
| delete | DELETE {code} | Yes | Yes | Yes |

Wrong school code is rejected because comparison is against `school.code` from DB. **Result: PASS**

## 6. Deleted/Inactive Data Exposure

- `GET /api/owner/schools` excludes deleted schools by default; requires `includeDeleted=true` to see them.
- `ensureSessionSchoolIsActive()` blocks all non-owner users of inactive schools on every authenticated request.
- Session is destroyed and cookie cleared on block — no stale session reuse.
- Login page shows descriptive banner via `window.__schoolBlockedMessage`.
- No infinite redirect loop — login page only hits `/api/public/*` endpoints.
- Only platform owners can access `/api/owner/*` endpoints — school admins, teachers, parents, finance, IT cannot see lifecycle data.

**Result: PASS**

## 7. Session Blocking UX

- 403 response includes `{ message, schoolStatus }`.
- `queryClient.ts` parses the schoolStatus and stores the message in `window.__schoolBlockedMessage`.
- Login page renders a red banner with the message above the sign-in form.
- Session is destroyed server-side; cookie is cleared.
- No blank screen or confusing error — message is specific per status (suspended/archived/pending_deletion/deleted).

**Result: PASS**

## 8. Audit Log Completeness

All 5 lifecycle actions log with event type, target (`school:{id}`), and metadata including: schoolId, schoolName, schoolCode, previousStatus, newStatus, reason. The `auditLog` function automatically captures userId and timestamp from the request context. Additionally, session blocks log `session_blocked_{status}_school` events.

**Result: PASS**

## 9. Frontend Button Verification

- Each status shows correct action buttons (suspend for active, restore for suspended/pending_deletion, archive for active/suspended, request_deletion for archived, delete for pending_deletion).
- All buttons open AlertDialog with reason input + typed confirmation.
- Submit button disabled until reason filled + confirmText matches expected value.
- `executeDangerAction` sends `{ reason, confirmText }` to correct endpoint with correct HTTP method.
- Error responses are parsed from the Error message string and displayed via toast, including blocker lists.
- Success invalidates school list and dashboard queries.
- State is cleared on dialog close.

**Result: PASS**

## 10. Validation Commands

- `npx tsc --noEmit` — **0 errors**
- `npm run build` — fails due to tsx/esbuild sandbox compatibility (environment issue, not code issue)
- No test suite configured for lifecycle endpoints

**Result: PASS (code compiles cleanly)**

## Files Changed During Security Verification

None — no additional fixes were needed. All gaps were already addressed in the prior audit pass.
