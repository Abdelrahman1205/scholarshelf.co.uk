# V1 Security Fixes — Deployment Checklist

**Date:** 2026-06-07
**Branch:** current working branch
**Target:** https://www.scholarshelf.co.uk (Vercel + Neon PostgreSQL)

---

## Part 1: Pre-Deploy Verification

### 1.1 Confirm changed files

Only these 3 files contain security-fix changes:

```
server/routes.ts    (+16 lines, -5 lines)  — basket ownership guard, link-child error mapping
server/storage.ts   (+19 lines, -2 lines)  — useLinkingCode() expiry + parentEmail + used checks
CLIENT_READY_BUTTON_AUDIT.md (+264 lines)  — documentation only
```

Supporting files changed in earlier sessions (not part of this security fix):

```
.gitignore          — added .fuse_hidden* exclusion
tsconfig.json       — added .fuse_hidden* to exclude array
```

Verify with:
```bash
git diff --stat -- server/routes.ts server/storage.ts CLIENT_READY_BUTTON_AUDIT.md
```

### 1.2 Confirm TypeScript passes

```bash
npx tsc --noEmit
# Expected: 0 errors, exit code 0
```

### 1.3 Confirm no unrelated server/shared/client logic changed

```bash
git diff --name-only -- server/routes.ts server/storage.ts
# Should show exactly these 2 files
```

Review the diff to confirm only these functions changed:
- `server/routes.ts`: `POST /api/parent/link-child` error handling, `POST /api/parent/children/:id/basket` ownership guard
- `server/storage.ts`: `useLinkingCode()` — 3 new guard checks added before the existing link logic

### 1.4 Suggested commit message

```
fix(security): add parent basket ownership check, linking code expiry and email validation

- S1 CRITICAL: POST /api/parent/children/:id/basket now verifies parent
  is linked to student via parentChildren before creating basket (403)
- S2 HIGH: useLinkingCode() rejects expired codes (checks expiresAt)
- S3 HIGH: useLinkingCode() validates parentEmail match (case-insensitive)
- S4: Already-used codes now return distinct error vs nonexistent codes
- Updated CLIENT_READY_BUTTON_AUDIT.md with fix details and smoke tests
```

---

## Part 2: Deploy

This project deploys via Vercel with GitHub integration.

### 2.1 Commit and push

```bash
# Stage only the security-fix files
git add server/routes.ts server/storage.ts CLIENT_READY_BUTTON_AUDIT.md

# Optional: also stage the supporting files if not already committed
git add .gitignore tsconfig.json

# Commit
git commit -m "fix(security): add parent basket ownership check, linking code expiry and email validation"

# Push to trigger Vercel deploy
git push origin main
```

### 2.2 Monitor deploy

1. Check Vercel dashboard: https://vercel.com (project: scholarshelf.co.uk)
2. Wait for build to complete (typically 1-2 minutes)
3. Verify build log shows no errors
4. Confirm deployment URL is live

---

## Part 3: Post-Deploy Smoke Tests

Run these tests after the deploy completes. All use curl against the live site.

### 3.1 Login

```bash
BASE="https://www.scholarshelf.co.uk"

# Parent
curl -s -c /tmp/pd_parent.txt -X POST "$BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"username":"parent","password":"parent123","schoolCode":"DEMO-001"}'
# Expect: 200 with role=parent

# Teacher2
curl -s -c /tmp/pd_teacher2.txt -X POST "$BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher2","password":"teacher123","schoolCode":"DEMO-001"}'
# Expect: 200 with role=teacher

# Finance
curl -s -c /tmp/pd_finance.txt -X POST "$BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"username":"finance","password":"finance123","schoolCode":"DEMO-001"}'
# Expect: 200 with role=finance
```

### 3.2 S1 — Basket ownership (CRITICAL)

```bash
# Get parent's linked children
LINKED_ID=$(curl -s -b /tmp/pd_parent.txt "$BASE/api/parent/children" | \
  python3 -c "import sys,json;c=json.load(sys.stdin);print(c[0]['studentId'] if c else '')")

# TEST: Basket for own child — should succeed
curl -s -b /tmp/pd_parent.txt -X POST "$BASE/api/parent/children/$LINKED_ID/basket" \
  -H "Content-Type: application/json" -w "\nHTTP:%{http_code}"
# Expect: 201 or 400 "already has basket"

# TEST: Basket for fake UUID — should get 403
curl -s -b /tmp/pd_parent.txt -X POST \
  "$BASE/api/parent/children/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/basket" \
  -H "Content-Type: application/json" -w "\nHTTP:%{http_code}"
# Expect: 403 "You are not authorised to create a basket for this student"

# TEST: Basket for real unlinked student — should get 403
# (use any student ID that is NOT the parent's linked child)
curl -s -b /tmp/pd_parent.txt -X POST \
  "$BASE/api/parent/children/<OTHER_STUDENT_ID>/basket" \
  -H "Content-Type: application/json" -w "\nHTTP:%{http_code}"
# Expect: 403 "You are not authorised to create a basket for this student"
```

### 3.3 S2 — Linking code expiry

```bash
# TEST: Already-used code
curl -s -b /tmp/pd_parent.txt -X POST "$BASE/api/parent/link-child" \
  -H "Content-Type: application/json" -d '{"code":"A2M-TUCD"}'
# Expect: 400 "This linking code has already been used."

# TEST: Nonexistent code
curl -s -b /tmp/pd_parent.txt -X POST "$BASE/api/parent/link-child" \
  -H "Content-Type: application/json" -d '{"code":"ZZZZ-FAKE"}'
# Expect: 404 "Invalid linking code"
```

Note: To test expiry, you would need to create a linking code with `expiresAt` in the past via admin, then attempt to use it. The guard is: `if (expiresAt && new Date(expiresAt) < new Date()) → 400 "expired"`.

### 3.4 S3 — Linking code parentEmail

Note: To test email mismatch, you need a valid unused code that has `parentEmail` set to a different email. Create one via admin, then attempt to link as the parent user. The guard is: `if (code.parentEmail !== caller.email) → 403 "not assigned to your email"`.

### 3.5 Existing workflows still work

```bash
# Finance summary
curl -s -b /tmp/pd_finance.txt "$BASE/api/finance/summary" -w "\nHTTP:%{http_code}"
# Expect: 200

# Teacher distributions
curl -s -b /tmp/pd_teacher2.txt "$BASE/api/teacher/book-distribution" -w "\nHTTP:%{http_code}"
# Expect: 200

# Parent children
curl -s -b /tmp/pd_parent.txt "$BASE/api/parent/children" -w "\nHTTP:%{http_code}"
# Expect: 200

# Parent baskets
curl -s -b /tmp/pd_parent.txt "$BASE/api/parent/baskets" -w "\nHTTP:%{http_code}"
# Expect: 200
```

### 3.6 Tenant isolation regression

```bash
# Parent cannot access admin endpoints
curl -s -b /tmp/pd_parent.txt "$BASE/api/books" -w "\nHTTP:%{http_code}"
# Expect: 403

# Teacher cannot access finance endpoints
curl -s -b /tmp/pd_teacher2.txt "$BASE/api/finance/summary" -w "\nHTTP:%{http_code}"
# Expect: 403

# Unauthenticated cannot access any protected endpoint
curl -s "$BASE/api/allocations" -w "\nHTTP:%{http_code}"
# Expect: 401
```

### 3.7 Pass/fail summary

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1 | Parent basket for own child | 201 or 400 | |
| 2 | Parent basket for fake UUID | 403 | |
| 3 | Parent basket for unlinked student | 403 | |
| 4 | Already-used linking code | 400 "already been used" | |
| 5 | Nonexistent linking code | 404 | |
| 6 | Finance summary | 200 | |
| 7 | Teacher distributions | 200 | |
| 8 | Parent children | 200 | |
| 9 | Parent baskets | 200 | |
| 10 | Parent → admin books | 403 | |
| 11 | Teacher → finance summary | 403 | |
| 12 | Unauthenticated → allocations | 401 | |

---

## Part 4: Production Database Fix — Demo Account schoolId

### Problem

Demo accounts `admin`, `teacher`, `parent` have `schoolId=null` in the production Neon database. This causes `sessionSchoolId()` to return null, which means these accounts cannot access any school-scoped endpoints.

The `finance` and `teacher2` accounts already have the correct schoolId. The `owner` account correctly has `schoolId=null` (platform owners are not school-scoped).

### Safe SQL fix

Connect to the Neon database console or use `psql`:

```sql
-- Step 1: Find the demo school ID by school code (do NOT hardcode UUIDs)
SELECT id, name, school_code
FROM schools
WHERE school_code = 'DEMO-001';
-- Expected: one row with the Al-Noor school UUID
```

```sql
-- Step 2: Preview which users will be updated (DRY RUN)
SELECT id, username, role, email, school_id
FROM users
WHERE username IN ('admin', 'teacher', 'parent')
  AND role IN ('school_admin', 'teacher', 'parent')
  AND school_id IS NULL;
-- Expected: 3 rows (admin, teacher, parent) — all with school_id = NULL
-- If 0 rows: they were already fixed. Stop here.
-- If unexpected rows appear: do NOT proceed. Investigate first.
```

```sql
-- Step 3: Apply the fix (uses subquery — no hardcoded UUID)
UPDATE users
SET school_id = (
  SELECT id FROM schools WHERE school_code = 'DEMO-001' LIMIT 1
)
WHERE username IN ('admin', 'teacher', 'parent')
  AND role IN ('school_admin', 'teacher', 'parent')
  AND school_id IS NULL;
-- Expected: UPDATE 3
```

```sql
-- Step 4: Verify the fix
SELECT id, username, role, email, school_id
FROM users
WHERE username IN ('admin', 'teacher', 'parent', 'finance', 'teacher2', 'bythub')
ORDER BY role;
-- Expected:
--   admin    → school_id = <Al-Noor UUID>
--   teacher  → school_id = <Al-Noor UUID>
--   parent   → school_id = <Al-Noor UUID>
--   finance  → school_id = <Al-Noor UUID> (already correct)
--   teacher2 → school_id = <Al-Noor UUID> (already correct)
--   bythub   → school_id = NULL (correct — owner is not school-scoped)
```

### Post-fix login test

After running the SQL, verify these accounts can now log in without `schoolCode`:

```bash
# These should now work WITHOUT schoolCode parameter
curl -s -X POST "$BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expect: 200 with role=school_admin, schoolId=<UUID>

curl -s -X POST "$BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher","password":"teacher123"}'
# Expect: 200 with role=teacher, schoolId=<UUID>

curl -s -X POST "$BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"username":"parent","password":"parent123"}'
# Expect: 200 with role=parent, schoolId=<UUID>
```

### Safety notes

- This does NOT change authentication logic
- This does NOT change owner support-mode security
- This does NOT weaken any role checks
- This only sets the correct school association for demo accounts that were missing it
- The WHERE clause is defensive: it only updates users with the exact username, role, AND null schoolId
- If the school code changes, the subquery adapts automatically
- Owner account is explicitly excluded (different role)
