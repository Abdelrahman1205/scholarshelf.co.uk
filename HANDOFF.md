# ScholarShelf / BytHub — Agent Handoff Document
> Generated: 2026-07-01 | For: Fable continuation agent

---

## 1. Project Identity

| Item | Value |
|---|---|
| Product name | **ScholarShelf** (school-facing) / **BytHub** (platform owner) |
| Live URL | https://scholarshelf.co.uk |
| Vercel project | bytehubtechnology / scholarshelf-co-uk-wwao |
| Git remote | GitHub (push triggers Vercel auto-deploy) |
| DB | Neon PostgreSQL (serverless) |
| Local folder | `C:\Users\abood\OneDrive\Desktop\Book-Management-System(1)\Book-Management-System` |

---

## 2. Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS v4, shadcn/ui, Wouter routing, TanStack Query v5 |
| Backend | Express 5, TypeScript, Drizzle ORM, Neon (serverless pg) |
| Auth | express-session, bcryptjs, session-based RBAC |
| Email | Resend (optional — app works without it) |
| Schema migrations | `npm run db:push` (runs `drizzle-kit push`, Windows only) |
| Deployment | Vercel (serverless functions) |

---

## 3. Critical Constraints

### NTFS File Writes
**ALL file writes MUST use Python via bash.** The Edit/Write tools truncate files on Windows NTFS.

```python
# Always use this pattern:
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
```

### Git index.lock
The `.git/index.lock` file often exists and blocks git operations from bash.
The user must run this in PowerShell before committing:
```powershell
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
```

### DB Schema Changes
After modifying `shared/schema.ts`, the user must run:
```powershell
npm run db:push
```
(This uses esbuild Windows binary — cannot be run from Linux bash)

### Security — NEVER enter secrets
NEVER type passwords, SESSION_SECRET, DATABASE_URL, API keys, or tokens into any field.

---

## 4. Role System

| Role | Access |
|---|---|
| `owner` / `platform_admin` | BytHub owner dashboard — all schools, DB console, metrics |
| `school_admin` | Full school admin panel |
| `it_personnel` | Same as school_admin |
| `finance` | Finance/payments section |
| `teacher` | Teacher portal |
| `parent` | Parent portal |

Middleware groups in `server/core/constants.ts`:
- `ADMIN_UI_ROLES` — school admin, IT, owner
- `FINANCE_ROLES` — finance, school admin, owner
- `PLATFORM_OWNER_ROLES` — owner, platform_admin

Session stores `activeContext` for multi-role users (context switcher UI exists).

---

## 5. Key File Map

```
shared/schema.ts              — Drizzle schema (source of truth for DB)
server/storage.ts             — All DB access methods (~2650 lines)
server/config/database.ts     — getDb() (Drizzle/Neon) + getPool() (pg Pool)
server/config/env.ts          — Zod env validation (import env, not process.env)
server/middleware/auth.ts     — requireAuth, requireRole middleware
server/core/constants.ts      — ADMIN_UI_ROLES, FINANCE_ROLES, PLATFORM_OWNER_ROLES
server/routes/index.ts        — Registers all route files onto Express app
server/routes/auth.routes.ts  — Login, logout, /me, register, password reset
server/routes/family.routes.ts — Family CRUD + family link codes
server/routes/public.routes.ts — GET /api/public/schools/:code (no auth)
server/routes/db-console.routes.ts — Owner DB Console (table browser, SQL, danger zone)
server/routes/dashboard.routes.ts  — /api/owner/dashboard (platform metrics)

client/src/App.tsx            — Wouter routes
client/src/components/layout.tsx — Sidebar nav (role-scoped navItems)
client/src/pages/admin.tsx    — Admin shell — sections map
client/src/pages/admin/       — Per-section components (classes, students, families, db-console, etc.)
client/src/pages/parent.tsx   — Parent portal (~1330 lines)
client/src/pages/school-public.tsx — /school/:code public landing page
```

---

## 6. Database Tables (whitelisted for DB Console)

`schools`, `school_branding`, `users`, `user_roles`, `classes`, `students`,
`parent_children`, `child_linking_codes`, `books`, `book_levels`,
`class_book_levels`, `student_book_overrides`, `book_baskets`, `basket_items`,
`book_payments`, `payment_basket_links`, `allocations`, `extra_copy_requests`,
`families`, `family_students`, `audit_logs`, `invites`

---

## 7. Recently Completed Work (this session)

| # | Feature | Status |
|---|---|---|
| 64 | Family basket payment — "Pay for All Children" banner when 2+ pending baskets; multi-child dialog; combined `basketIds[]` | ✅ Done |
| 65 | Public school page `/school/:code` — no auth, shows logo/banner/contact, Register + Login CTAs | ✅ Done |
| 66 | Owner platform metrics — `totalStudents`, `totalBaskets`, `totalConfirmedPayments`, `totalRevenue`, `totalParents`, `totalTeachers` added to `/api/owner/dashboard` + dashboard UI | ✅ Done |
| 67 | BytHub DB Console — 3-tab page (Table Browser / SQL Console / Danger Zone) at `/admin/db-console`, owner-only | ✅ Done |
| — | Fix: `RESEND_FROM_EMAIL=""` Vercel startup crash — `z.preprocess` coerces empty string to undefined | ✅ Done |

---

## 8. Pending / Uncommitted Work

The user has a **git index.lock** problem and hasn't committed several batches.
All TypeScript checks pass (`npx tsc --noEmit` = no output).

Files changed but NOT yet committed (need PowerShell):
```powershell
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
npm run db:push   # for families/familyStudents/yearGroup schema changes
git add -A -- shared/ server/ client/src/
git commit -m "feat: all Priority 2+3 gaps, DB Console, env fix"
git push
```

---

## 9. Known Stale Tasks (safe to deprioritise)

- **Task #38/#39** — Clean architecture refactor (repositories/services layer). Large refactor, not urgent. Mark deleted if not needed.
- **Task #57** — "TypeScript check + commit" — effectively superseded by all the commits above.

---

## 10. Features NOT Yet Built (potential next work)

1. **Email notifications** — Resend is wired up but emails only send for invites. Could add:
   - Parent payment confirmation email
   - Teacher allocation notification
   - School admin weekly summary

2. **Audit log UI** — `audit_logs` table exists and is populated, but there's no dedicated viewer (Activity Logs page shows owner-level events only).

3. **Rate limiter persistence** — Warning in logs: in-memory rate limiter not enforced across Vercel instances. Replace with Redis or pg-backed store.

4. **Parent notification bell** — notifications table exists, UI shows count, but mark-as-read and notification detail view are thin.

5. **Teacher portal book distribution UI** — allocations can be created via API but teacher UI for bulk distribution is minimal.

---

## 11. Environment Variables Required on Vercel

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | Neon connection string |
| `SESSION_SECRET` | ✅ Yes (prod) | Must be ≥ 32 chars |
| `NODE_ENV` | ✅ Yes | Set to `production` |
| `RESEND_API_KEY` | Optional | Email sending |
| `RESEND_FROM_EMAIL` | Optional | e.g. `noreply@scholarshelf.co.uk` |
| `PAYMENT_WEBHOOK_SECRET` | Optional | Payment webhook verification |

---

## 12. How to Run Locally

```powershell
cd "C:\Users\abood\OneDrive\Desktop\Book-Management-System(1)\Book-Management-System"
npm install
npm run db:push     # sync schema to Neon
npm run dev         # starts Vite + Express on :5000
```

Create the first account with `npx tsx script/seed-test-account.ts` (development only).
There are no built-in demo accounts and no seed endpoint — test fixtures live in
`tests/support/seed-fixtures.ts` and are loaded with `npm run test:fixtures` against a
scratch database.

---

*End of handoff document*
