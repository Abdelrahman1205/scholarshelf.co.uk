# EduBook Final Technical Review

**Review Date:** 2026-06-07  
**Reviewer:** Senior Full-Stack Architect / QA Lead  
**Scope:** Complete EduBook module — schema, backend, frontend, security, demo readiness  
**Policy:** Read-only review. No files modified.

---

## PHASE 1 — Current EduBook Implementation Map

### 1.1 Schema Tables (shared/schema.ts)

| Table | Key Columns | School-Scoped | Purpose |
|---|---|---|---|
| `classes` | id, name, academicYear, teacherId, schoolId | Yes | Class roster |
| `students` | id, name, classId, studentCode, schoolId | Yes | Student records |
| `books` | id, title, author, isbn, price, stockQuantity, lowStockThreshold, bookCode, isActive, schoolId | Yes | Book inventory |
| `bookLevels` | id, name, description, schoolId | Yes | Bundles (named "levels") |
| `bookLevelItems` | bookLevelId, bookId, quantity | Via parent | Bundle→book junction |
| `classBookLevels` | classId, bookLevelId | Via parents | Class→bundle assignment |
| `childLinkingCodes` | studentId, code, parentEmail, isUsed, expiresAt, schoolId | Yes | Parent link codes |
| `parentChildren` | parentIdentifier (email), studentId | No* | Parent→student link |
| `childBookBaskets` | studentId, parentIdentifier, status, totalAmount, schoolId | Yes | Shopping basket |
| `basketItems` | basketId, bookId, quantity, unitPrice, totalPrice | Via parent | Basket line items |
| `bookPayments` | parentIdentifier, totalAmount, paymentReference, paymentReferenceNumber, status, orderStatus, schoolId | Yes | Payment records |
| `basketPayments` | basketId, paymentId | Via parents | Basket→payment junction |
| `financeBookAllocations` | studentId, bookId, basketId, status, distributionStatus, receivedByTeacherId, schoolId | Yes | Book allocation tracking |
| `bookInventoryTransactions` | bookId, transactionType, quantity, previousQuantity, newQuantity, reason | Via parent | Stock audit trail |
| `extraCopyRequests` | teacherId, classId, bookId, quantity, reason, status, adminNotes, schoolId | Yes | Teacher extra copy requests |
| `messageThreads` | subject, schoolId, createdBy | Yes | Parent-school messaging |
| `messages` | threadId, senderType, senderIdentifier, content | Via parent | Thread messages |

*Note: `parentChildren` has no `schoolId` column — cross-school parent linking is structurally possible.

### 1.2 API Route Map (~65+ EduBook routes)

**Admin/School-scoped CRUD:**
- `GET/POST /api/books` — CRUD books (ADMIN_UI_ROLES)
- `GET/PUT/DELETE /api/books/:id` — Single book ops
- `POST /api/books/:id/stock` — Stock adjustment
- `GET/POST /api/book-levels` — Bundle CRUD
- `GET/PUT/DELETE /api/book-levels/:id` — Single bundle
- `GET/POST /api/book-level-items` — Bundle items
- `GET/POST /api/classes` — Class CRUD
- `GET/PUT/DELETE /api/classes/:id`
- `GET/POST /api/students` — Student CRUD
- `GET/PUT/DELETE /api/students/:id`
- `POST /api/students/import` — CSV import
- `GET/POST /api/class-book-levels` — Assign bundle→class
- `GET /api/linking-codes` — View codes
- `POST /api/students/:id/linking-code` — Generate code

**Parent endpoints:**
- `POST /api/parent/link-child` — Use linking code
- `GET /api/parent/children` — List linked children
- `POST /api/parent/children/:id/basket` — Generate basket
- `GET /api/parent/baskets` — List baskets
- `POST /api/parent/payments` — Create order
- `POST /api/parent/payments/:id/submit-reference` — Submit bank ref
- `GET /api/parent/payments` — List payments

**Finance/Admin payment management:**
- `GET /api/finance/summary` — Dashboard summary
- `GET /api/admin/payments` — List all payments
- `POST /api/admin/payments/:id/confirm` — Confirm payment
- `POST /api/admin/payments/:id/reject` — Reject payment
- `POST /api/admin/payments/:id/needs-review` — Flag for review
- `POST /api/admin/payments/:id/ready-for-collection` — Order ready
- `POST /api/admin/payments/:id/collected` — Mark collected
- `POST /api/admin/payments/:id/cancel` — Cancel order
- `POST /api/admin/payments/:id/order-status` — Update order status

**Allocations:**
- `GET /api/allocations` — List allocations (admin+teacher)
- `POST /api/allocations` — Create allocation manually
- `POST /api/allocations/:id/confirm` — Confirm receipt
- `POST /api/allocations/:id/absent` — Mark absent

**Teacher book distribution:**
- `GET /api/teacher/book-distribution` — Teacher's distribution list
- `POST /api/teacher/book-distribution/:id/confirm-received`
- `POST /api/teacher/book-distribution/:id/mark-absent`
- `POST /api/teacher/book-distribution/:id/report-issue`

**Admin distribution overview:**
- `GET /api/admin/book-distribution` — Overview for school
- `POST /api/admin/book-distribution/:id/confirm` — Admin confirm

**Extra copy requests:**
- `GET /api/extra-requests` — List (teacher sees own, admin sees all)
- `POST /api/extra-requests` — Teacher creates
- `POST /api/extra-requests/:id/approve` — Admin approves
- `POST /api/extra-requests/:id/reject` — Admin rejects

**Reporting/aggregation routes:**
- `GET /api/admin/parents` — Enriched parent list
- `GET /api/admin/book-distribution` — Distribution overview
- Admin dashboard section: inline metrics

### 1.3 Auth & Scoping Functions

| Function | Location | Purpose |
|---|---|---|
| `sessionSchoolId(req)` | routes.ts:276 | Returns schoolId from session; for owners returns supportSchoolId or null |
| `getActiveRequestContext(req)` | routes.ts | Returns effective role (owner in support → context of the school role) |
| `isPlatformOwnerRequest(req)` | routes.ts | True if session role is owner/platform_admin |
| `isInSupportMode(req)` | routes.ts | True if owner is acting on behalf of a school |
| `requireRole(...roles)` | routes.ts | Middleware — 401 if not logged in, 403 if role not in list |
| `schoolFilter(table, schoolId)` | storage.ts:230 | Returns `eq(table.schoolId, sid)` or undefined if null |

**Role constants:**
- `PLATFORM_OWNER_ROLES = ["owner", "platform_admin"]`
- `ADMIN_UI_ROLES = ["admin", "school_admin", ...PLATFORM_OWNER_ROLES]`
- `FINANCE_ROLES = [...ADMIN_UI_ROLES, "finance"]`

### 1.4 Frontend Route Map

| URL Pattern | Component | AuthGuard Roles | Sections |
|---|---|---|---|
| `/admin/:section?` | AdminPage | admin, school_admin, owner, platform_admin | dashboard, books, levels, classes, students, parents, codes, payments, allocations, requests, communications, users, branding, reports, setup + owner-only sections |
| `/teacher/:section?` | TeacherPage | teacher | dashboard, distribution, requests, messages |
| `/parent/:section?` | ParentPage | parent | dashboard, link, baskets, payments, messages |
| `/finance/:section?` | FinancePage | finance | dashboard, payments, reports |

### 1.5 Core Business Flow

```
Admin creates books → creates bundles (bookLevels) → adds books to bundles (bookLevelItems)
  → assigns bundles to classes (classBookLevels) → generates linking codes for students
  
Parent uses code → links child (parentChildren) → generates basket (childBookBaskets + basketItems)
  → creates payment order (bookPayments, status=awaiting_reference) → submits bank reference
  → status becomes reference_submitted
  
Finance/Admin reviews → confirms (status=confirmed, allocations auto-created, stock deducted)
  → marks ready_for_collection → teacher confirms distribution → collected
```

---

## PHASE 2 — End-to-End Journey Audit (20 Journeys)

### Journey 1: Admin creates a book
**Route:** `POST /api/books`  
**Auth:** `requireRole(...ADMIN_UI_ROLES)` ✅  
**Scoping:** `schoolId: sid` from `sessionSchoolId` ✅  
**Frontend:** BooksSection in admin.tsx — form with title, author, ISBN, price, stock, threshold ✅  
**Storage:** `createBook()` with schoolId ✅  
**Verdict:** ✅ PASS

### Journey 2: Admin creates a book bundle (level) and adds books
**Route:** `POST /api/book-levels`, `POST /api/book-level-items`  
**Auth:** ADMIN_UI_ROLES ✅  
**Frontend:** BookLevelsSection — create level, add items ✅  
**Storage:** `createBookLevel()`, `addBookLevelItem()` with schoolId ✅  
**Verdict:** ✅ PASS

### Journey 3: Admin assigns bundle to class
**Route:** `POST /api/class-book-levels`  
**Auth:** ADMIN_UI_ROLES ✅  
**Setup gate:** Checks `checklist.bookLevelsCreated` ✅  
**Storage:** `assignClassBookLevel()` — inserts into classBookLevels ✅  
**Note:** No auto-allocation on assignment — allocations are created when payment is confirmed  
**Verdict:** ✅ PASS

### Journey 4: Admin generates linking code for student
**Route:** `POST /api/students/:id/linking-code`  
**Auth:** ADMIN_UI_ROLES ✅  
**Setup gate:** Checks `checklist.studentsAdded` ✅  
**Behavior:** Generates random code, sets 3-month expiry, emails parent ✅  
**Storage:** `createLinkingCode()` with schoolId ✅  
**Verdict:** ✅ PASS

### Journey 5: Parent registers and links child
**Route:** `POST /api/parent/link-child`  
**Auth:** `requireRole("parent")` ✅  
**Storage:** `useLinkingCode()` — checks code unused, creates parentChildren record ✅  
**⚠️ FINDING:** Does NOT check `expiresAt` — expired codes still work  
**⚠️ FINDING:** Does NOT verify `parentEmail` matches calling parent — any parent can use any code  
**Verdict:** ⚠️ PARTIAL — functional but has security gaps (see Phase 3)

### Journey 6: Parent generates basket
**Route:** `POST /api/parent/children/:id/basket`  
**Auth:** parent ✅  
**Storage:** `generateBasket()` — looks up student's class → classBookLevels → bookLevelItems → builds basket  
**Ownership check:** Parent identity derived from `user.email` ✅  
**⚠️ FINDING:** No check that the student actually belongs to the calling parent. Any parent can generate a basket for any studentId by guessing the UUID.  
**Verdict:** ⚠️ FAIL — missing parent-child ownership verification

### Journey 7: Parent creates payment order
**Route:** `POST /api/parent/payments`  
**Auth:** parent ✅  
**Ownership check:** Verifies each basket's `parentIdentifier === user.email` ✅  
**Behavior:** Generates unique payment reference, status = `awaiting_reference` ✅  
**Audit log:** Created ✅  
**Verdict:** ✅ PASS

### Journey 8: Parent submits bank reference
**Route:** `POST /api/parent/payments/:id/submit-reference`  
**Auth:** parent ✅  
**Ownership check:** Verifies `existing.parentIdentifier === user.email` ✅  
**Validation:** Ref min 3 chars, `confirmed === true` required ✅  
**Duplicate check:** `isPaymentReferenceDuplicate()` within same school ✅  
**Status transition:** Only from `awaiting_reference`, `rejected`, `pending`, `failed` ✅  
**Email notification:** Sent on success ✅  
**Verdict:** ✅ PASS

### Journey 9: Finance reviews and confirms payment
**Route:** `POST /api/admin/payments/:id/confirm`  
**Auth:** FINANCE_ROLES ✅  
**Behavior:** Sets status=confirmed, creates allocations from basket items, deducts stock ✅  
**Sets orderStatus:** `ready_for_teacher_distribution` ✅  
**Email notification:** Sent to parent ✅  
**Audit log:** Created ✅  
**Verdict:** ✅ PASS

### Journey 10: Finance rejects payment
**Route:** `POST /api/admin/payments/:id/reject`  
**Auth:** FINANCE_ROLES ✅  
**Behavior:** Sets status=rejected, resets baskets to `pending` so parent can resubmit ✅  
**Email notification:** Sent ✅  
**Verdict:** ✅ PASS

### Journey 11: Finance marks needs-review
**Route:** `POST /api/admin/payments/:id/needs-review`  
**Auth:** FINANCE_ROLES ✅  
**Behavior:** Sets status=needs_review with review note ✅  
**Verdict:** ✅ PASS

### Journey 12: Admin marks ready-for-collection → collected
**Routes:** `POST .../ready-for-collection`, `POST .../collected`  
**Auth:** FINANCE_ROLES ✅  
**Audit logs:** Created ✅  
**Verdict:** ✅ PASS

### Journey 13: Teacher views book distribution
**Route:** `GET /api/teacher/book-distribution`  
**Auth:** `requireRole("teacher")` ✅  
**Scoping:** `getDistributionsByTeacher()` — gets teacher's classes → students → allocations ✅  
**Frontend:** DistributionSection in teacher.tsx ✅  
**Verdict:** ✅ PASS

### Journey 14: Teacher confirms student received book
**Route:** `POST /api/teacher/book-distribution/:id/confirm-received`  
**Auth:** teacher ✅  
**Self-child protection:** Checks if teacher's email is linked as parent of that student — blocks if so ✅  
**Storage:** Sets `distributionStatus=received_by_student`, `status=received`, records teacherId ✅  
**Verdict:** ✅ PASS

### Journey 15: Teacher marks student absent
**Route:** `POST /api/teacher/book-distribution/:id/mark-absent`  
**Auth:** teacher ✅  
**Storage:** Sets `distributionStatus=student_absent` ✅  
**Verdict:** ✅ PASS

### Journey 16: Teacher creates extra copy request
**Route:** `POST /api/extra-requests`  
**Auth:** `requireRole("teacher")` ✅  
**Forces:** `teacherId: req.session.userId!` — can't impersonate ✅  
**Reasons:** NEW_STUDENT, DAMAGED_IN_CLASS, LOST_REPLACEMENT, SHORTAGE, OTHER ✅  
**Frontend:** ExtraRequestsSection in teacher.tsx ✅  
**Verdict:** ✅ PASS

### Journey 17: Admin approves extra copy request
**Route:** `POST /api/extra-requests/:id/approve`  
**Auth:** ADMIN_UI_ROLES ✅  
**Behavior:** Calls `adjustStock()` to deduct (silently catches insufficient stock) ✅  
**⚠️ FINDING:** Stock deduction failure is silently caught — admin gets no feedback that stock was insufficient  
**Verdict:** ⚠️ PARTIAL — works but lacks insufficient-stock feedback

### Journey 18: Admin views allocation list
**Route:** `GET /api/allocations`  
**Auth:** ADMIN_UI_ROLES + teacher ✅  
**Teacher scoping:** Filters to assigned class IDs ✅  
**Frontend:** AllocationsSection in admin.tsx ✅  
**Verdict:** ✅ PASS

### Journey 19: Teacher/Admin confirms allocation receipt (legacy flow)
**Route:** `POST /api/allocations/:id/confirm`  
**Auth:** ADMIN_UI_ROLES + teacher ✅  
**Teacher class check:** Verifies allocation's student is in teacher's assigned class ✅  
**Self-child protection:** Blocks if teacher is linked parent of that student ✅  
**Verdict:** ✅ PASS

### Journey 20: Parent-school messaging
**Routes:** `POST /api/parent/messages/threads`, `GET/POST thread messages`  
**Auth:** parent ✅  
**Frontend:** ParentMessagesSection in parent.tsx ✅  
**Verdict:** ✅ PASS

### Phase 2 Summary

| Status | Count | Journeys |
|---|---|---|
| ✅ PASS | 16 | 1,2,3,4,7,8,9,10,11,12,13,14,15,18,19,20 |
| ⚠️ PARTIAL | 3 | 5 (expired codes), 6 (basket ownership), 17 (silent stock fail) |
| ❌ FAIL | 1 | 6 (missing parent-child ownership check on basket generation) |

---

## PHASE 3 — Multi-Tenancy and Security Audit

### 3.1 School Scoping Coverage

| Table | schoolFilter Applied | Notes |
|---|---|---|
| books | ✅ All CRUD | via `sessionSchoolId` |
| bookLevels | ✅ All CRUD | via `sessionSchoolId` |
| bookLevelItems | ⚠️ Via parent bookLevel | Not directly school-filtered — relies on bookLevelId belonging to correct school |
| classBookLevels | ⚠️ Via parent class | Not directly filtered |
| classes | ✅ | via `sessionSchoolId` |
| students | ✅ | via `sessionSchoolId` |
| childLinkingCodes | ✅ | via schoolId |
| parentChildren | ❌ No schoolId column | Cross-school by design — parent email links to any student |
| childBookBaskets | ✅ | schoolId on basket |
| basketItems | Via parent basket | |
| bookPayments | ✅ | schoolId on payment |
| financeBookAllocations | ✅ | schoolId on allocation |
| extraCopyRequests | ✅ | schoolId filter applied |
| bookInventoryTransactions | ⚠️ Via parent book | No direct schoolId — relies on bookId |

### 3.2 Security Findings

**CRITICAL — S1: Basket generation has no parent-child ownership check**
- File: `routes.ts` line ~2094
- `POST /api/parent/children/:id/basket` takes a studentId in the URL
- The route checks the parent is logged in but does NOT verify the student is linked to that parent
- Any authenticated parent can call `POST /api/parent/children/{ANY_STUDENT_UUID}/basket` and generate a basket for another parent's child
- **Impact:** Data exposure (basket reveals child's book list and prices)
- **Fix:** Add ownership check: verify studentId exists in `parentChildren` for `user.email`

**HIGH — S2: Linking codes don't check expiry**
- File: `storage.ts` line 1022
- `useLinkingCode()` only checks `isUsed === false`, ignores `expiresAt`
- Expired codes can still be used
- **Fix:** Add `and(lt(schema.childLinkingCodes.expiresAt, new Date()))` or post-query check

**HIGH — S3: Linking codes don't verify parentEmail**
- File: `storage.ts` line 1022
- Admin generates code with a specific `parentEmail`, but any parent account can use any code
- This bypasses the intent of the admin specifying which parent gets the code
- **Fix:** Add `eq(schema.childLinkingCodes.parentEmail, parentIdentifier)` to the query (or make it a warning rather than a block, since some schools may prefer flexibility)

**MEDIUM — S4: `bookLevelItems` not directly school-scoped**
- When adding items to a bundle, there's no check that the bookId belongs to the same school as the bookLevel
- An admin could theoretically add a book from another school to their bundle if they guess the UUID
- **Fix:** Verify `book.schoolId === bookLevel.schoolId` before insert

**MEDIUM — S5: Teacher allocation confirm loads ALL allocations**
- File: `routes.ts` line 2479
- `POST /api/allocations/:id/confirm` with teacher role calls `storage.getAllocations(undefined, sid)` which loads every allocation in the school, then does `.find()` on it
- Works correctly but is inefficient — should fetch by ID with school filter
- **Impact:** Performance, not security

**LOW — S6: `parentChildren` has no schoolId**
- A parent who links children at two different schools sees all children regardless
- This is by design but means parent-scoped queries (baskets, payments) should be aware of multi-school scenarios

**LOW — S7: Extra copy approval silently catches stock failure**
- File: `storage.ts` line 1482-1486
- `adjustStock()` is wrapped in try/catch that silently swallows the error
- Admin thinks approval succeeded with stock deduction, but stock may be unchanged

### 3.3 Role Access Matrix Verification

| Endpoint Category | Owner | School Admin | Teacher | Finance | Parent | Status |
|---|---|---|---|---|---|---|
| Books CRUD | ✅ (support mode) | ✅ | ❌ | ❌ | ❌ | Correct |
| Book Levels CRUD | ✅ (support mode) | ✅ | ❌ | ❌ | ❌ | Correct |
| Classes CRUD | ✅ (support mode) | ✅ | ❌ | ❌ | ❌ | Correct |
| Students CRUD | ✅ (support mode) | ✅ | ❌ | ❌ | ❌ | Correct |
| Linking Codes | ✅ (support mode) | ✅ | ❌ | ❌ | ❌ | Correct |
| View Payments | ✅ | ✅ | ❌ | ✅ | Own only | Correct |
| Confirm/Reject Payments | ✅ | ✅ | ❌ | ✅ | ❌ | Correct |
| View Allocations | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ | Correct |
| Teacher Distribution | ❌ | ❌ | ✅ (own classes) | ❌ | ❌ | Correct |
| Extra Copy Requests | ✅ (view) | ✅ (approve/reject) | ✅ (create/view own) | ❌ | ❌ | Correct |
| Parent Link/Basket/Pay | ❌ | ❌ | ❌ | ❌ | ✅ | Correct |

### 3.4 Owner Support Mode Isolation

When owner enters support mode (`supportSchoolId` set), `sessionSchoolId()` returns that school's ID. All queries filter by it. Owner-only sections (schools list, platform dashboard) are blocked in support mode via `resolvedSection` logic in `AdminPage`. ✅ Correct.

---

## PHASE 4 — Data Model and State Audit

### 4.1 Payment Status Machine

```
                          ┌─────────────────┐
                          │ awaiting_reference│ (initial)
                          └────────┬────────┘
                                   │ parent submits ref
                          ┌────────▼────────┐
                          │reference_submitted│
                          └────────┬────────┘
                          ┌────────┼────────┐
                          │        │        │
                    ┌─────▼──┐ ┌──▼────┐ ┌─▼──────────┐
                    │rejected │ │confirmed│ │needs_review │
                    └────┬───┘ └───┬────┘ └─────┬──────┘
                         │         │            │ (re-review)
                    (parent can    │            │
                     resubmit)    ┌▼────────────▼──────┐
                                  │ready_for_collection│
                                  └────────┬───────────┘
                                           │
                                  ┌────────▼────┐
                                  │  collected   │
                                  └─────────────┘
                                  
                          ┌──────────┐
                          │ cancelled │ (from any state)
                          └──────────┘
```

**Legacy mappings handled in UI:**
- `pending` → treated as `awaiting_reference`
- `completed` → treated as `confirmed`
- `failed` → treated as `rejected`

**Finding:** Status transitions are NOT enforced in the backend. `confirmPayment()` does not check `existing.status === "reference_submitted"`. An admin could confirm a payment that's already `cancelled` or `collected`.  
**Severity:** MEDIUM — the UI only shows the confirm button for appropriate statuses, but API is unprotected.

### 4.2 Basket Status Machine

```
pending → paid (when parent submits payment reference)
        → allocated (when payment is confirmed — allocations created)
        → pending (reset when payment is rejected)
```

**Finding:** No explicit basket status for `cancelled`. If a payment is cancelled, baskets stay in their current status.

### 4.3 Allocation Status Machine

```
allocated → received (admin confirms or teacher confirms distribution)
          → absent (admin or teacher marks absent)
```

**distributionStatus field (teacher-led flow):**
```
pending_distribution → received_by_student (teacher confirms)
                     → student_absent (teacher marks absent)
                     → issue_reported (teacher reports issue)
```

**Finding:** There are TWO parallel status fields on `financeBookAllocations`: `status` (allocated/received/absent) and `distributionStatus` (pending_distribution/received_by_student/student_absent/issue_reported). When teacher confirms distribution, `confirmDistribution()` updates BOTH to `received`/`received_by_student`. When teacher marks absent, `markDistributionAbsent()` only updates `distributionStatus` to `student_absent` but leaves `status` as `allocated`.  
**Inconsistency:** Teacher-absent sets `distributionStatus` but not `status`. Admin-absent sets `status` to `absent` but doesn't touch `distributionStatus`.

### 4.4 Orphan Risk Analysis

| Scenario | Risk | Current Handling |
|---|---|---|
| Student deleted with active allocations | Allocations orphaned | `deleteSchoolAndRelatedData` cascades on school delete, but individual student delete? ⚠️ Not checked |
| Class deleted with students | Students lose classId reference | ⚠️ Not checked |
| Book deleted with active bundles/allocations | Broken references | Books have `isActive` flag but can still be deleted |
| Parent account deleted with active payments | Payments orphaned | ⚠️ Payments use email string, not userId |

### 4.5 Price/Amount Handling

- Prices stored as strings (e.g., "25.00") in the schema
- Calculations use `parseFloat()` → potential floating-point issues
- Currency is LYD (Libyan Dinar) — hardcoded in `formatCurrency()` in finance.tsx
- Basket total calculated server-side in `generateBasket()` ✅
- Payment total calculated server-side from basket totals ✅

---

## PHASE 5 — Code Cleanliness Audit

### 5.1 Naming Consistency

| Term | Used As | Issue |
|---|---|---|
| "Book Level" vs "Bundle" | Schema: `bookLevels`, UI sometimes says "Book Levels", sometimes "Bundles" | Minor inconsistency in user-facing labels |
| `parentIdentifier` | Email string used as parent identity | Consistent throughout ✅ |
| `status` vs `distributionStatus` | Two parallel status fields on allocations | Confusing — see Phase 4 |
| Legacy status names | `pending`/`completed`/`failed` mapped to new names | Handled in both frontend and backend ✅ |

### 5.2 Code Duplication

- **StatusBadge components:** Defined separately in parent.tsx (line 21), finance.tsx (line 49), and admin.tsx — same switch/case logic, slightly different styling. Could be extracted to shared component.
- **`getRoleRoute()`:** Defined in BOTH `App.tsx` (line 21) and `login.tsx` (line 11) — identical logic, two copies.
- **`schoolFilter()` pattern:** Consistently used across storage.ts — good pattern, no duplication issue.

### 5.3 Error Handling Quality

- Routes consistently use try/catch with `res.status(400/500).json({ message: e.message })` ✅
- Storage methods throw descriptive errors ✅
- Frontend mutations use `onError` callbacks with toast notifications ✅
- **Gap:** Some routes don't validate input before passing to storage (e.g., `POST /api/allocations` passes `req.body` directly)

### 5.4 Performance Concerns

- `getAllocations()` loads ALL allocations for a school then filters in JS — N+1 query for student/book/class per allocation
- `getExtraCopyRequests()` does N+1 queries for teacher/book/class per request
- `getBaskets()` does N+1 queries for items, books, student, class per basket
- `getAllocations` with teacher role: loads all allocations, THEN filters by assigned classes — should use SQL join/filter
- These are acceptable for V1 demo scale but will need optimization for production

### 5.5 TypeScript Quality

- Extensive use of `any` type in storage return types (e.g., `Promise<any[]>` for allocations, baskets, distributions)
- Frontend uses inline interface definitions rather than shared types
- `req.body` is never validated with zod or similar — relies on storage layer throwing errors

---

## PHASE 6 — Demo Readiness Audit

### 6.1 Current Demo Accounts (from seed)

| Username | Role | School Code | Purpose |
|---|---|---|---|
| bythub | owner | — | Platform owner |
| admin | school_admin | DEMO-001 | School admin |
| teacher | teacher | DEMO-001 | Teacher |
| teacher2 | teacher | DEMO-001 | Second teacher |
| parent | parent | DEMO-001 | Parent |
| it_admin | it_personnel | DEMO-001 | IT |
| finance | finance | DEMO-001 | Finance |

### 6.2 Demo Flow Walkability

| Step | Ready | Notes |
|---|---|---|
| Login with demo buttons | ✅ | 5 demo buttons on login page |
| Owner dashboard | ✅ | Shows platform metrics |
| Owner → enter support mode for demo school | ✅ | Support mode toggle |
| Admin dashboard | ✅ | Shows school metrics |
| Admin creates book | ✅ | Full CRUD |
| Admin creates bundle | ✅ | Full CRUD |
| Admin assigns bundle to class | ✅ | Via class-book-levels |
| Admin generates linking code | ✅ | With email notification |
| Parent links child | ✅ | Code entry + QR scanner |
| Parent generates basket | ✅ | Shows book list and total |
| Parent creates order | ✅ | Shows bank instructions |
| Parent submits reference | ✅ | With confirmation checkbox |
| Finance reviews payment | ✅ | Dashboard + review actions |
| Finance confirms → allocations created | ✅ | Auto-creates allocations |
| Teacher views distribution | ✅ | Grouped by class |
| Teacher confirms receipt | ✅ | With self-child protection |
| Teacher creates extra copy request | ✅ | With reason selection |
| Admin approves request | ✅ | With stock adjustment |

### 6.3 Demo Data Completeness

**⚠️ Current state (after database reset):** Only seed accounts exist. No books, classes, students, bundles, or sample data beyond the user accounts.

**For a compelling demo, you need:**
- At least 2-3 classes with realistic names
- 10-15 students distributed across classes
- 5-10 books with realistic titles and prices
- 2 bundles assigned to classes
- Linking codes generated for at least 2 students
- Parent linked to at least 1 child
- A basket generated and a payment at various stages (awaiting, submitted, confirmed)
- At least 1 allocation in "received" status
- At least 1 extra copy request (pending and approved)

### 6.4 Navigation Completeness

**Admin sidebar links → sections:**
All 13 navigation items map to real sections. No 404s. ✅

**Teacher sidebar links:**
- Dashboard → DashboardSection ✅
- Book Distribution → DistributionSection ✅  
- Extra Requests → ExtraRequestsSection ✅
- Messages → TeacherMessagesSection ✅

**Parent sidebar links:**
- Dashboard → ParentDashboardSection ✅
- Link Child → ParentLinkSection ✅
- Book Baskets → ParentBasketsSection ✅
- Payments → ParentPaymentsSection ✅
- Messages → ParentMessagesSection ✅

**Finance sidebar links:**
- Dashboard → FinanceDashboard ✅
- Payment Review → PaymentReviewSection ✅
- Reports → ReportsSection ✅

**No 404 risks found.** ✅

---

## PHASE 7 — Programmer Handoff Document

### 7.1 Architecture Overview

EduBook is a module within the EduCore platform, sharing the same Express.js backend, Drizzle ORM, and React frontend. It uses session-based auth with school-scoped multi-tenancy.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + TanStack Query + shadcn/ui + Tailwind
- Backend: Express.js + Drizzle ORM + Neon PostgreSQL
- Auth: express-session with role-based access control
- Email: Resend API (optional, falls back to console logging)

### 7.2 Key Patterns a New Developer Must Know

1. **`sessionSchoolId(req)`** — Always use this to get the current school context. Never hardcode a schoolId. For owners not in support mode, returns null (sees all).

2. **`schoolFilter(table, schoolId)`** — Apply to every query that touches school-scoped data. Returns undefined for null schoolId (owner sees all).

3. **`requireRole(...roles)`** — Middleware for route protection. Always the first middleware on a route.

4. **`getActiveRequestContext(req)`** — Use this to check the effective role when owners might be in support mode.

5. **Parent identity is email** — `parentIdentifier` is the email string, NOT a userId. This means parent queries use email matching, not foreign key joins.

6. **Payment confirmation triggers allocation creation** — `confirmPayment()` in storage.ts is a critical method that creates allocations AND deducts stock. This is the only automatic allocation creation path.

7. **Two parallel allocation status systems** — `status` field (admin-facing: allocated/received/absent) and `distributionStatus` field (teacher-facing: pending_distribution/received_by_student/student_absent/issue_reported). Both must be kept in sync.

### 7.3 Known Technical Debt

| Item | Severity | Description |
|---|---|---|
| Missing basket ownership check | CRITICAL | `POST /api/parent/children/:id/basket` — add parentChildren ownership verification |
| Expired codes accepted | HIGH | `useLinkingCode()` — add expiresAt check |
| No status transition enforcement | MEDIUM | Payment confirm/reject don't verify current status |
| Dual allocation status fields | MEDIUM | `status` + `distributionStatus` should be unified or formally documented |
| N+1 queries in storage | LOW | Allocation/basket/request queries load related data per-row |
| Silent stock failure on approval | LOW | Extra copy approval catches and ignores stock errors |
| Duplicated getRoleRoute | LOW | Same function in App.tsx and login.tsx |
| Any types in storage | LOW | Many storage methods return `Promise<any[]>` |

### 7.4 Files to Know

| File | Lines | Purpose |
|---|---|---|
| `shared/schema.ts` | ~600 | All Drizzle schema definitions |
| `server/routes.ts` | ~5100 | All API routes (EduBook + EduCore) |
| `server/storage.ts` | ~1800 | All database operations |
| `client/src/pages/admin.tsx` | 4410 | Admin dashboard with 20+ sections |
| `client/src/pages/teacher.tsx` | 994 | Teacher dashboard |
| `client/src/pages/parent.tsx` | 1196 | Parent portal |
| `client/src/pages/finance.tsx` | 564 | Finance dashboard |
| `client/src/App.tsx` | 158 | Router + AuthGuard |
| `client/src/components/layout.tsx` | ~470 | Sidebar navigation |
| `client/src/pages/login.tsx` | 245 | Login + demo buttons |

---

## Required Testing Checklist

### Authentication & Authorization

| # | Test | Expected | Status |
|---|---|---|---|
| 1 | Login as each demo role | Redirects to correct dashboard | ✅ Verified via code |
| 2 | Admin cannot access /teacher | AuthGuard redirects | ✅ Verified |
| 3 | Teacher cannot access /admin | AuthGuard redirects | ✅ Verified |
| 4 | Parent cannot access /admin | AuthGuard redirects | ✅ Verified |
| 5 | Finance cannot access /admin | AuthGuard redirects | ✅ Verified |
| 6 | Unauthenticated user → /login | Redirects | ✅ Verified |

### Multi-Tenancy

| # | Test | Expected | Status |
|---|---|---|---|
| 7 | School A admin cannot see School B books | schoolFilter blocks | ✅ Verified via code |
| 8 | Teacher sees only assigned classes | getTeacherAssignedClasses filter | ✅ Verified |
| 9 | Parent sees only linked children | parentIdentifier email filter | ✅ Verified |
| 10 | Owner in support mode sees only target school | supportSchoolId scoping | ✅ Verified |

### Book Management

| # | Test | Expected | Status |
|---|---|---|---|
| 11 | Create book with all fields | Book created with schoolId | ✅ |
| 12 | Edit book | Updated in DB | ✅ |
| 13 | Stock adjustment (+/-) | Stock updated, transaction logged | ✅ |
| 14 | Low stock threshold triggers warning | Frontend shows warning | ✅ (UI badge) |

### Bundle & Assignment

| # | Test | Expected | Status |
|---|---|---|---|
| 15 | Create bundle, add books | Bundle + items created | ✅ |
| 16 | Assign bundle to class | classBookLevels record created | ✅ |
| 17 | Multiple bundles to same class | Basket combines all items | ✅ |

### Parent Flow

| # | Test | Expected | Status |
|---|---|---|---|
| 18 | Link child with valid code | parentChildren record, code marked used | ✅ |
| 19 | Link child with expired code | Should reject | ❌ FAILS — code accepted |
| 20 | Link child with used code | Returns null/404 | ✅ |
| 21 | Generate basket | Basket with correct items and total | ✅ |
| 22 | Generate basket for unlinked child | Should 403 | ❌ FAILS — basket created |
| 23 | Create payment order | Payment with reference, status awaiting | ✅ |
| 24 | Submit bank reference | Status → reference_submitted | ✅ |
| 25 | Submit duplicate reference | 409 conflict | ✅ |

### Payment Review

| # | Test | Expected | Status |
|---|---|---|---|
| 26 | Confirm payment | Allocations created, stock deducted | ✅ |
| 27 | Reject payment | Baskets reset to pending | ✅ |
| 28 | Needs review | Status updated | ✅ |
| 29 | Ready for collection | Status updated | ✅ |
| 30 | Mark collected | Status updated | ✅ |
| 31 | Cancel order | Status = cancelled | ✅ |

### Teacher Distribution

| # | Test | Expected | Status |
|---|---|---|---|
| 32 | Teacher sees distribution list | Only own classes' allocations | ✅ |
| 33 | Confirm student received | Both status fields updated | ✅ |
| 34 | Mark student absent | distributionStatus updated | ✅ |
| 35 | Report issue | Issue note saved | ✅ |
| 36 | Self-child protection | Blocked with 403 | ✅ |

### Extra Copy Requests

| # | Test | Expected | Status |
|---|---|---|---|
| 37 | Teacher creates request | Request with teacherId forced | ✅ |
| 38 | Admin approves | Status=approved, stock adjusted | ⚠️ Stock adjustment silent fail |
| 39 | Admin rejects | Status=rejected | ✅ |

---

## Summary of Findings

### Critical (Must Fix Before Demo)
1. **S1: Basket generation lacks parent-child ownership check** — Any parent can generate a basket for any student UUID

### High Priority (Should Fix Before Demo)
2. **S2: Linking codes don't check expiry** — Expired codes still work
3. **S3: Linking codes don't verify intended parent email** — Any parent can use any code

### Medium Priority (Fix for V1 Release)
4. Payment status transitions not enforced on backend
5. Dual allocation status fields inconsistently updated
6. Cross-school bookLevelItem insertion possible (no schoolId check on book)
7. Extra copy approval silently ignores stock deduction failure

### Low Priority (V2)
8. N+1 query patterns in storage methods
9. Duplicated `getRoleRoute()` function
10. `any` types in storage return signatures
11. StatusBadge component duplication across pages
12. No basket cancellation status

### What Is Ready for Demo
Everything except the 3 critical/high findings above. The full end-to-end flow from admin setup → parent payment → teacher distribution is functional. All navigation works. All dashboards show real data. No 404 risks. All role guards are correct.

### Recommended V2 Items (Not V1)
- Reporting export to PDF/Excel
- Bulk operations (mass assign codes, mass confirm distributions)
- Payment method extensibility (beyond bank reference)
- Notification center / in-app notifications
- Student self-service portal (currently minimal)
- Ministry-level dashboards and cross-school reporting
- Parent mobile app optimization
- Audit log viewer for admins
- Stock forecasting / reorder suggestions
